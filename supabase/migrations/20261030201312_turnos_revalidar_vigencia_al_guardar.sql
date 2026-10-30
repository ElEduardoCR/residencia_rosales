begin;
-- Validate wall-clock time again after any row-lock wait; transaction start time must not prolong a shift.
create or replace function private.turnos_actual()
returns jsonb language plpgsql security invoker set search_path='' as $$
declare d date; t text;v jsonb; hoy date:=(clock_timestamp() at time zone 'America/Mexico_City')::date;
begin
 foreach d in array array[hoy-1,hoy] loop
  foreach t in array array['matutino','vespertino','nocturno'] loop
   v:=private.turnos_ventana(d,t);
   if v is not null and clock_timestamp()>=(v->>'inicio')::timestamptz and clock_timestamp()<(v->>'fin')::timestamptz then return v;end if;
  end loop;
 end loop;return null;
end;$$;
create or replace function private.turnos_operar(p_operacion text,p_datos jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 actor public.personal%rowtype;j public.turnos_jornadas%rowtype;v jsonb;permitido boolean;sesion boolean;
 hoy date:=(clock_timestamp() at time zone 'America/Mexico_City')::date;fecha_config date;ini time;medio time;noche time;
 med public.medicamentos_paciente%rowtype;pac public.pacientes%rowtype;rut public.turnos_rutinas%rowtype;ag public.agenda_tareas%rowtype;
 e public.turnos_eventos%rowtype;anterior public.turnos_eventos%rowtype;sol uuid;delta numeric;saldo numeric;cantidad_nueva numeric;
 agenda_realizacion uuid;ocurrido timestamptz;motivo text;
begin
 if p_operacion is null or p_operacion not in ('contexto','entrar','horarios','rutina','archivar_rutina','asignacion','cistoflo','conteo','registrar','corregir') then raise exception 'TURNO: Operación no válida.';end if;
 select * into actor from public.personal where user_id=auth.uid() and activo for share;
 if not found then raise exception 'TURNO: Inicia sesión con una cuenta activa de personal.';end if;
 if p_operacion in ('contexto','entrar') then
  v:=private.turnos_actual();
  if v is null then return jsonb_build_object('configurada',exists(select 1 from public.turnos_horarios),'puedeEntrar',false,'motivo','Los horarios de los turnos todavía no están vigentes. Pide al administrador que los configure.','ventana',null,'sesion',false);end if;
  permitido:=actor.rol='admin' or actor.turno='mixto' or actor.turno=v->>'turno';
  if p_operacion='entrar' then
   if not coalesce(permitido,false) then raise exception 'TURNO: Tu asignación no corresponde al turno vigente. Solicita el cambio al administrador.';end if;
   perform pg_advisory_xact_lock(hashtextextended('turnos_configuracion',0));
   -- Re-read after the configuration lock to avoid a racing schedule change.
   v:=private.turnos_actual();
   if v is null or not coalesce(actor.rol='admin' or actor.turno='mixto' or actor.turno=v->>'turno',false) then raise exception 'TURNO: El turno cambió. Actualiza antes de ingresar.';end if;
   insert into public.turnos_jornadas(fecha,turno,horario_id,inicio,fin) values((v->>'fecha')::date,v->>'turno',(v->>'horario_id')::uuid,(v->>'inicio')::timestamptz,(v->>'fin')::timestamptz)
     on conflict(fecha,turno) do nothing;
   select * into j from public.turnos_jornadas where fecha=(v->>'fecha')::date and turno=v->>'turno';
   insert into public.turnos_sesiones(jornada_id,personal_id) values(j.id,actor.id) on conflict(jornada_id,personal_id) do nothing;
   v:=private.turnos_actual();
  end if;
  sesion:=exists(select 1 from public.turnos_sesiones where jornada_id=(v->>'id')::uuid and personal_id=actor.id);
  return jsonb_build_object('configurada',true,'puedeEntrar',coalesce(permitido,false),'motivo',case when coalesce(permitido,false) then null else 'Tu asignación no corresponde al turno vigente.' end,'ventana',v,'sesion',sesion);
 end if;
 if p_operacion in ('horarios','rutina','archivar_rutina','asignacion','cistoflo','conteo','corregir') and actor.rol<>'admin' then raise exception 'TURNO: Esta operación corresponde al administrador.';end if;
 if p_operacion='horarios' then
  fecha_config:=(p_datos->>'vigenteDesde')::date;ini:=(p_datos->>'matutino')::time;medio:=(p_datos->>'vespertino')::time;noche:=(p_datos->>'nocturno')::time;
  if fecha_config is null or ini is null or medio is null or noche is null or not(ini<medio and medio<noche and noche<time '24:00') then raise exception 'TURNO: Revisa el orden y las horas de los turnos.';end if;
  perform pg_advisory_xact_lock(hashtextextended('turnos_configuracion',0));
  if fecha_config<hoy or (exists(select 1 from public.turnos_horarios) and fecha_config<hoy+1) then raise exception 'TURNO: Los cambios de horario deben comenzar mañana o después.';end if;
  if exists(select 1 from public.turnos_jornadas where fin>(fecha_config::timestamp at time zone 'America/Mexico_City')) then raise exception 'TURNO: Ese cambio afectaría un turno ya abierto. Elige una fecha posterior.';end if;
  insert into public.turnos_horarios(vigente_desde,matutino,vespertino,nocturno,creado_por) values(fecha_config,ini,medio,noche,actor.id);
  return jsonb_build_object('ok',true);
 elsif p_operacion='rutina' then
  if nullif(p_datos->>'pacienteId','') is not null and not exists(select 1 from public.pacientes where id=(p_datos->>'pacienteId')::uuid and activo) then raise exception 'TURNO: Selecciona un paciente activo.';end if;
  insert into public.turnos_rutinas(paciente_id,turno,titulo,detalle,dias_semana,creado_por)
   values(nullif(p_datos->>'pacienteId','')::uuid,p_datos->>'turno',btrim(p_datos->>'titulo'),nullif(btrim(p_datos->>'detalle'),''),array(select jsonb_array_elements_text(p_datos->'diasSemana')::int),actor.id);
  return jsonb_build_object('ok',true);
 elsif p_operacion='archivar_rutina' then
  update public.turnos_rutinas set activo=false where id=(p_datos->>'rutinaId')::uuid;
  if not found then raise exception 'TURNO: No se encontró la rutina.';end if;return jsonb_build_object('ok',true);
 elsif p_operacion='asignacion' then
  if p_datos->>'turno' is not null and p_datos->>'turno' not in ('matutino','vespertino','nocturno','mixto') then raise exception 'TURNO: Selecciona un turno válido.';end if;
  update public.personal set turno=p_datos->>'turno' where id=(p_datos->>'personalId')::uuid and activo;
  if not found then raise exception 'TURNO: No se encontró el integrante activo.';end if;return jsonb_build_object('ok',true);
 elsif p_operacion='cistoflo' then
  if jsonb_typeof(p_datos->'tieneCistoflo')<>'boolean' then raise exception 'TURNO: Indica si el paciente utiliza Cistoflo.';end if;
  update public.pacientes set tiene_cistoflo=(p_datos->>'tieneCistoflo')::boolean where id=(p_datos->>'pacienteId')::uuid;
  if not found then raise exception 'TURNO: No se encontró el paciente.';end if;return jsonb_build_object('ok',true);
 elsif p_operacion='conteo' then
  cantidad_nueva:=(p_datos->>'cantidad')::numeric;motivo:=btrim(p_datos->>'motivo');
  if cantidad_nueva is null or not(cantidad_nueva>=0 and cantidad_nueva<=1000000000) or char_length(coalesce(motivo,'')) not between 3 and 2000 then raise exception 'TURNO: Indica la cantidad contada y el motivo del ajuste.';end if;
  select * into med from public.medicamentos_paciente where id=(p_datos->>'medicamentoId')::uuid and activo for update;
  if not found then raise exception 'TURNO: No se encontró el medicamento activo.';end if;
  if (p_datos->>'cantidadEsperada')::numeric is distinct from med.cantidad then raise exception 'TURNO: Las existencias cambiaron mientras contabas. Actualiza y confirma el conteo nuevamente.';end if;
  update public.medicamentos_paciente set cantidad=cantidad_nueva,stock_verificado_at=clock_timestamp(),
    notas=nullif(regexp_replace(coalesce(notas,''),'(^|\n)Existencias no verificadas\.?[^\n]*','\1','gi'),'') where id=med.id;
  insert into public.turnos_inventario_movimientos(medicamento_id,tipo,delta,saldo_antes,saldo_despues,motivo,personal_id)
    values(med.id,'conteo',cantidad_nueva-med.cantidad,med.cantidad,cantidad_nueva,motivo,actor.id);
  return jsonb_build_object('ok',true);
 end if;
 if p_operacion not in ('registrar','corregir') then raise exception 'TURNO: Operación no válida.';end if;
 sol:=(p_datos->>'solicitudId')::uuid;if sol is null then raise exception 'TURNO: Actualiza el formulario antes de registrar.';end if;
 perform pg_advisory_xact_lock(hashtextextended(sol::text||actor.id::text,0));
 select * into e from public.turnos_eventos where personal_id=actor.id and solicitud_id=sol;
 if found then return jsonb_build_object('ok',true,'evento',to_jsonb(e));end if;
 e.id:=gen_random_uuid();e.solicitud_id:=sol;e.personal_id:=actor.id;e.registrado_at:=clock_timestamp();
 if p_operacion='corregir' then
  select * into anterior from public.turnos_eventos where id=(p_datos->>'eventoId')::uuid for update;
  if not found then raise exception 'TURNO: No se encontró el registro a corregir.';end if;
  if exists(select 1 from public.turnos_eventos where corrige_id=anterior.id) then raise exception 'TURNO: Otra corrección ya reemplazó ese registro. Actualiza el historial.';end if;
  motivo:=btrim(p_datos->>'motivo');if char_length(coalesce(motivo,'')) not between 3 and 2000 then raise exception 'TURNO: Explica el motivo de la corrección.';end if;
  e.jornada_id:=anterior.jornada_id;e.paciente_id:=anterior.paciente_id;e.tipo:=anterior.tipo;e.titulo:=anterior.titulo;e.detalle:=case when p_datos?'detalle' then nullif(btrim(p_datos->>'detalle'),'') else anterior.detalle end;
  e.valor:=case when p_datos?'valor' then (p_datos->>'valor')::numeric else anterior.valor end;e.contexto:=coalesce(p_datos->>'contexto',anterior.contexto);
  e.ocurrido_at:=coalesce((p_datos->>'ocurridoAt')::timestamptz,anterior.ocurrido_at);
  e.corrige_id:=anterior.id;e.raiz_id:=anterior.raiz_id;e.anulado:=coalesce((p_datos->>'anulado')::boolean,false);e.motivo_correccion:=motivo;
  e.rutina_id:=anterior.rutina_id;e.agenda_tarea_id:=anterior.agenda_tarea_id;e.agenda_fecha:=anterior.agenda_fecha;e.medicamento_id:=anterior.medicamento_id;e.dosis:=anterior.dosis;
  e.cantidad:=case when p_datos?'cantidad' then (p_datos->>'cantidad')::numeric else anterior.cantidad end;
 else
  e.jornada_id:=(p_datos->>'jornadaId')::uuid;e.paciente_id:=(p_datos->>'pacienteId')::uuid;e.tipo:=p_datos->>'tipo';e.titulo:=nullif(btrim(p_datos->>'titulo'),'');
  e.detalle:=nullif(btrim(p_datos->>'detalle'),'');e.valor:=(p_datos->>'valor')::numeric;e.contexto:=p_datos->>'contexto';e.ocurrido_at:=coalesce((p_datos->>'ocurridoAt')::timestamptz,clock_timestamp());
  e.raiz_id:=e.id;e.anulado:=false;e.rutina_id:=nullif(p_datos->>'rutinaId','')::uuid;e.agenda_tarea_id:=nullif(p_datos->>'agendaTareaId','')::uuid;e.agenda_fecha:=nullif(p_datos->>'agendaFecha','')::date;
  e.medicamento_id:=nullif(p_datos->>'medicamentoId','')::uuid;e.cantidad:=(p_datos->>'cantidad')::numeric;
 end if;
 select * into j from public.turnos_jornadas where id=e.jornada_id;
 if not found then raise exception 'TURNO: Entra al turno vigente antes de registrar.';end if;
 if p_operacion='registrar' then
  if clock_timestamp()<j.inicio or clock_timestamp()>=j.fin then raise exception 'TURNO: Este turno ya terminó o todavía no empieza.';end if;
  if actor.rol<>'admin' and actor.turno is distinct from 'mixto' and actor.turno is distinct from j.turno then raise exception 'TURNO: No puedes registrar en un turno distinto al asignado.';end if;
  if not exists(select 1 from public.turnos_sesiones where jornada_id=j.id and personal_id=actor.id) then raise exception 'TURNO: Pulsa Entrar al turno antes de registrar.';end if;
 end if;
 if e.ocurrido_at<j.inicio or e.ocurrido_at>=j.fin or e.ocurrido_at>clock_timestamp() then raise exception 'TURNO: La hora debe pertenecer a este turno y no estar en el futuro.';end if;
 select * into pac from public.pacientes where id=e.paciente_id;
 if not found or (p_operacion='registrar' and not pac.activo) then raise exception 'TURNO: Selecciona un paciente activo.';end if;
 if e.tipo not in ('cuidado','incidencia','glucosa','cistoflo','sueno','medicamento') then raise exception 'TURNO: Tipo de registro no válido.';end if;
 if char_length(coalesce(e.detalle,''))>4000 then raise exception 'TURNO: Las observaciones exceden 4000 caracteres.';end if;
 if e.tipo='glucosa' then
  if e.valor is null or not(e.valor>0 and e.valor<=2000) then raise exception 'TURNO: Revisa el valor de glucosa en mg/dL.';end if;
  e.unidad:='mg/dL';e.contexto:=coalesce(e.contexto,'sin_especificar');
  if e.contexto not in ('ayuno','antes_comida','despues_comida','sin_especificar') then raise exception 'TURNO: Selecciona el contexto de la glucosa.';end if;e.titulo:='Glucosa';
 elsif e.tipo='cistoflo' then
  if (p_operacion='registrar' and not pac.tiene_cistoflo) or e.valor is null or not(e.valor>=0 and e.valor<=10000) then raise exception 'TURNO: Revisa el paciente y el volumen vaciado del Cistoflo en ml.';end if;
  e.unidad:='ml';e.contexto:=null;e.titulo:='Vaciado de Cistoflo';
 elsif e.tipo='sueno' then
  if j.turno<>'nocturno' or e.valor is null or not(e.valor>=0 and e.valor<=24) then raise exception 'TURNO: El sueño se registra una vez por noche, entre 0 y 24 horas.';end if;
  e.unidad:='h';e.contexto:=null;e.titulo:='Horas de sueño';
 else e.valor:=null;e.unidad:=null;e.contexto:=null;end if;
 if e.tipo='incidencia' and char_length(coalesce(e.detalle,''))<1 then raise exception 'TURNO: Describe la incidencia.';end if;
 if e.rutina_id is not null then
  select * into rut from public.turnos_rutinas where id=e.rutina_id;
  if not found or e.tipo<>'cuidado' or (p_operacion='registrar' and (not rut.activo or rut.turno<>j.turno or (rut.paciente_id is not null and rut.paciente_id<>pac.id) or not(extract(dow from j.fecha)::integer=any(rut.dias_semana)))) then raise exception 'TURNO: La rutina no corresponde a este paciente y turno.';end if;
  e.titulo:=rut.titulo;
 end if;
 if e.agenda_tarea_id is not null then
  select * into ag from public.agenda_tareas where id=e.agenda_tarea_id;
  if not found or ag.paciente_id<>pac.id or (ag.tipo='medicamento')<>(e.tipo='medicamento') then raise exception 'TURNO: La actividad no corresponde a este paciente.';end if;
  if p_operacion='registrar' then
   ocurrido:=(e.agenda_fecha+ag.hora) at time zone 'America/Mexico_City';
   if e.agenda_fecha is null or not ag.activo or e.agenda_fecha<ag.fecha_inicio or (ag.fecha_fin is not null and e.agenda_fecha>ag.fecha_fin) or not(extract(dow from e.agenda_fecha)::integer=any(ag.dias_semana)) or ocurrido<j.inicio or ocurrido>=j.fin then raise exception 'TURNO: La actividad no está programada dentro de este turno.';end if;
   if exists(select 1 from public.agenda_realizaciones where tarea_id=ag.id and fecha=e.agenda_fecha) then raise exception 'TURNO: La actividad ya está realizada. Consulta su historial.';end if;
  end if;
  e.titulo:=ag.titulo;
  if e.tipo='medicamento' and e.medicamento_id is distinct from ag.medicamento_id then raise exception 'TURNO: El medicamento no coincide con la actividad.';end if;
 end if;
 if e.rutina_id is not null and e.agenda_tarea_id is not null then raise exception 'TURNO: Elige una sola actividad de origen.';end if;
 if e.tipo='medicamento' then
  select * into med from public.medicamentos_paciente where id=e.medicamento_id for update;
  if not found or med.paciente_id<>pac.id or (p_operacion='registrar' and (not med.activo or coalesce(med.notas,'')~*'requiere revisión documental' or med.stock_verificado_at is null or coalesce(med.notas,'')~*'Existencias no verificadas' or char_length(btrim(coalesce(med.dosis,'')))=0)) then raise exception 'TURNO: Revisa la indicación y registra el conteo de existencias antes de administrar.';end if;
  if e.cantidad is null or not(e.cantidad>0 and e.cantidad<=100000) then raise exception 'TURNO: Escribe la cantidad administrada en unidades del inventario.';end if;
  if p_operacion='registrar' then
   e.titulo:=med.medicamento_nombre;e.dosis:=med.dosis;
   if e.agenda_tarea_id is null and exists(select 1 from public.turnos_eventos where jornada_id=j.id and medicamento_id=med.id and corrige_id is null) and char_length(btrim(coalesce(e.detalle,'')))<3 then raise exception 'TURNO: Ya hay una administración de este medicamento en el turno. Revisa el historial y explica el motivo si corresponde registrar otra.';end if;
   if e.agenda_tarea_id is null and exists(select 1 from public.agenda_tareas a where a.medicamento_id=med.id and a.activo and exists(select 1 from generate_series(j.fecha::timestamp,(j.fecha+1)::timestamp,interval '1 day') d where d::date>=a.fecha_inicio and (a.fecha_fin is null or d::date<=a.fecha_fin) and extract(dow from d)::integer=any(a.dias_semana) and (d::date+a.hora) at time zone 'America/Mexico_City'>=j.inicio and (d::date+a.hora) at time zone 'America/Mexico_City'<j.fin)) then raise exception 'TURNO: Registra este medicamento desde su actividad programada para evitar duplicados.';end if;
   if exists(select 1 from public.administracion_medicamentos a where a.paciente_id=pac.id and a.fecha=(e.ocurrido_at at time zone 'America/Mexico_City')::date and a.turno_evento_id is null and (a.medicamento_paciente_id=med.id or (a.medicamento_paciente_id is null and a.medicamento_nombre=med.medicamento_nombre))) then raise exception 'TURNO: Hay una administración anterior en el registro diario. El administrador debe revisar el historial antes de duplicarla.';end if;
  end if;
  delta:=case when p_operacion='corregir' and not anterior.anulado then anterior.cantidad else 0 end-case when e.anulado then 0 else e.cantidad end;
  if p_operacion='corregir' and exists(select 1 from public.turnos_inventario_movimientos m where m.medicamento_id=med.id and m.tipo='conteo' and m.created_at>(select created_at from public.turnos_inventario_movimientos where evento_id=e.raiz_id)) then
   delta:=0;motivo:=motivo||' · Sin ajuste de existencias: un conteo posterior al registro original determina el saldo actual.';
  end if;
  saldo:=med.cantidad+delta;if saldo<0 then raise exception 'TURNO: Las existencias no alcanzan para la cantidad indicada.';end if;
  update public.medicamentos_paciente set cantidad=saldo where id=med.id;
 else
  if e.medicamento_id is not null or e.cantidad is not null then raise exception 'TURNO: Solo una administración puede vincular medicamento y cantidad.';end if;
 end if;
 e.titulo:=coalesce(e.titulo,case e.tipo when 'incidencia' then 'Incidencia' else 'Cuidado' end);
 if p_operacion='registrar' and (clock_timestamp()<j.inicio or clock_timestamp()>=j.fin) then raise exception 'TURNO: El turno terminó mientras guardabas. Actualiza el turno; una corrección histórica requiere al administrador.';end if;
 insert into public.turnos_eventos select e.*;
 if e.tipo='medicamento' then
  insert into public.turnos_inventario_movimientos(medicamento_id,evento_id,tipo,delta,saldo_antes,saldo_despues,motivo,personal_id)
  values(med.id,e.id,case when p_operacion='corregir' then 'correccion' else 'administracion' end,delta,med.cantidad,saldo,coalesce(motivo,'Administración registrada en el turno'),actor.id);
 end if;
 if p_operacion='registrar' then
  if e.agenda_tarea_id is not null then
   insert into public.agenda_realizaciones(tarea_id,fecha,personal_id,observaciones,turno_evento_id) values(e.agenda_tarea_id,e.agenda_fecha,actor.id,e.detalle,e.id) returning id into agenda_realizacion;
  end if;
  if e.tipo='medicamento' then
   insert into public.administracion_medicamentos(paciente_id,fecha,turno,hora,medicamento_nombre,tipo,dosis,enfermero_id,created_at,agenda_realizacion_id,medicamento_paciente_id,turno_evento_id,motivo)
   values(pac.id,(e.ocurrido_at at time zone 'America/Mexico_City')::date,null,(e.ocurrido_at at time zone 'America/Mexico_City')::time,med.medicamento_nombre,'obligatorio',e.dosis,actor.id,e.registrado_at,agenda_realizacion,med.id,e.id,e.detalle);
  end if;
 end if;
 return jsonb_build_object('ok',true,'evento',to_jsonb(e));
exception when unique_violation then raise exception 'TURNO: Ese cuidado ya tiene un registro. Actualiza para ver quién lo realizó.';
end;$$;
commit;
