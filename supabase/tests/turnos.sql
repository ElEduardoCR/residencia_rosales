-- Synthetic fixtures only; all changes are rolled back.
-- Run only in a test database with the migrations applied and no configured shift hours.
-- Uses the postgres role to create fictional fixtures, then authenticated roles to verify permissions.
-- psql -v ON_ERROR_STOP=1 -f supabase/tests/turnos.sql
-- A failed assertion aborts the transaction; disconnect or ROLLBACK before retrying.
begin;
create temporary table turnos_test_ctx(k text primary key,id uuid not null) on commit drop;
insert into turnos_test_ctx select k,gen_random_uuid() from unnest(array['admin_auth','nurse_auth','other_auth','admin','nurse','other','patient','patient2','med','pending','unverified','agenda_med','care','sol','event','correction','night','sleep']) k;
create temporary table turnos_test_results(test text primary key,ok boolean not null) on commit drop;
grant select,update on turnos_test_ctx to authenticated,anon;
grant select,insert on turnos_test_results to authenticated,anon;
create function pg_temp.tid(key text) returns uuid language sql as $$select id from turnos_test_ctx where k=key;$$;
create function pg_temp.expect_error(operation text,payload jsonb,expected text) returns void language plpgsql as $$declare failed boolean:=false;begin
 begin perform public.turnos_operar(operation,payload);exception when others then
  if position(expected in sqlerrm)>0 then failed:=true;else raise;end if;
 end;
 assert failed,'Operation unexpectedly allowed: '||coalesce(operation,'NULL');
end;$$;
insert into auth.users(id) select id from turnos_test_ctx where k like '%_auth';
insert into public.personal(id,user_id,nombre,rol,turno,activo) values
 (pg_temp.tid('admin'),pg_temp.tid('admin_auth'),'TEST Turnos Admin','admin','mixto',true),
 (pg_temp.tid('nurse'),pg_temp.tid('nurse_auth'),'TEST Turnos Nurse','enfermero','mixto',true),
 (pg_temp.tid('other'),pg_temp.tid('other_auth'),'TEST Turnos Other','enfermero',null,true);
insert into public.pacientes(id,nombre,activo,tiene_cistoflo) values
 (pg_temp.tid('patient'),'TEST Turnos Patient',true,true),(pg_temp.tid('patient2'),'TEST Turnos Patient2',true,false);
insert into public.medicamentos_paciente(id,paciente_id,medicamento_nombre,dosis,activo,cantidad,stock_verificado_at,notas) values
 (pg_temp.tid('med'),pg_temp.tid('patient'),'TEST Reviewed Medication','TEST dose',true,10,clock_timestamp(),null),
 (pg_temp.tid('agenda_med'),pg_temp.tid('patient'),'TEST Agenda Medication','TEST dose',true,10,clock_timestamp(),null),
 (pg_temp.tid('pending'),pg_temp.tid('patient'),'TEST Pending Medication','TEST dose',true,10,clock_timestamp(),'Requiere revisión documental.'),
 (pg_temp.tid('unverified'),pg_temp.tid('patient'),'TEST Uncounted Medication','TEST dose',true,10,null,null);
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.tid('nurse_auth')::text,true);
do $$declare c jsonb;begin
 c:=public.turnos_operar('contexto');assert not(c->>'configurada')::boolean,'Run before production hours are configured';
 perform pg_temp.expect_error('horarios',jsonb_build_object('matutino','00:00','vespertino','08:00','nocturno','16:00','vigenteDesde',(now() at time zone 'America/Mexico_City')::date),'administrador');
 perform pg_temp.expect_error(null,'{}','Operación no válida');
 insert into turnos_test_results values('initial_empty_and_staff_cannot_configure',true);
end;$$;
select set_config('request.jwt.claim.sub',pg_temp.tid('admin_auth')::text,true);
select public.turnos_operar('horarios',jsonb_build_object('matutino','00:00','vespertino','08:00','nocturno','16:00','vigenteDesde',(now() at time zone 'America/Mexico_City')::date));
select public.turnos_operar('entrar');
select set_config('request.jwt.claim.sub',pg_temp.tid('nurse_auth')::text,true);
do $$declare c jsonb;j uuid;payload jsonb;r jsonb;begin
 c:=public.turnos_operar('contexto');j:=(c->'ventana'->>'id')::uuid;
 payload:=jsonb_build_object('solicitudId',pg_temp.tid('sol'),'jornadaId',j,'pacienteId',pg_temp.tid('patient'),'tipo','glucosa','valor',100,'contexto','ayuno');
 perform pg_temp.expect_error('registrar',payload,'Entrar al turno');
 perform public.turnos_operar('entrar');
 r:=public.turnos_operar('registrar',payload);update turnos_test_ctx set id=(r->'evento'->>'id')::uuid where k='event';
 assert r->'evento'->>'personal_id'=pg_temp.tid('nurse')::text,'Wrong actor';
 assert (public.turnos_operar('registrar',payload)->'evento'->>'id')::uuid=pg_temp.tid('event'),'Retry must be idempotent';
 perform pg_temp.expect_error('registrar',payload||jsonb_build_object('solicitudId',gen_random_uuid(),'ocurridoAt',now()+interval '1 day'),'no estar en el futuro');
 perform pg_temp.expect_error('registrar',payload||jsonb_build_object('solicitudId',gen_random_uuid(),'ocurridoAt','2000-01-01T00:00:00Z'),'hora debe pertenecer');
 perform pg_temp.expect_error('registrar',payload||jsonb_build_object('solicitudId',gen_random_uuid(),'tipo','cistoflo','pacienteId',pg_temp.tid('patient2'),'valor',50),'Cistoflo');
 perform pg_temp.expect_error('corregir',jsonb_build_object('solicitudId',gen_random_uuid(),'eventoId',pg_temp.tid('event'),'motivo','TEST wrong actor','valor',101),'administrador');
 perform public.turnos_operar('registrar',payload||jsonb_build_object('solicitudId',gen_random_uuid(),'tipo','cistoflo','valor',0));
 perform public.turnos_operar('registrar',payload||jsonb_build_object('solicitudId',gen_random_uuid(),'tipo','cistoflo','valor',50));
 assert (select sum(valor) from public.turnos_eventos where paciente_id=pg_temp.tid('patient') and tipo='cistoflo')=50,'Cistoflo must accumulate';
 insert into turnos_test_results values('entry_actor_idempotence_time_and_cistoflo',true);
 begin update public.turnos_eventos set personal_id=pg_temp.tid('admin') where id=pg_temp.tid('event');raise exception 'Direct event update allowed';exception when insufficient_privilege then null;end;
 begin insert into public.registros_turno(paciente_id,fecha,turno) values(pg_temp.tid('patient'),current_date,'matutino');raise exception 'Legacy insert allowed';exception when insufficient_privilege then null;end;
 begin insert into public.agenda_realizaciones(tarea_id,fecha,personal_id) values(gen_random_uuid(),current_date,pg_temp.tid('nurse'));raise exception 'Direct agenda write allowed';exception when insufficient_privilege then null;end;
 begin insert into public.administracion_medicamentos(paciente_id,fecha,medicamento_nombre,tipo) values(pg_temp.tid('patient'),current_date,'TEST forbidden','extra');raise exception 'Legacy med allowed';exception when insufficient_privilege then null;end;
 insert into turnos_test_results values('direct_and_legacy_writes_denied',true);
end;$$;
select set_config('request.jwt.claim.sub',pg_temp.tid('other_auth')::text,true);
do $$declare c jsonb;begin
 c:=public.turnos_operar('contexto');assert not(c->>'puedeEntrar')::boolean,'Unassigned staff can enter';
 perform pg_temp.expect_error('entrar','{}','asignación');
 insert into turnos_test_results values('other_shift_denied',true);
end;$$;
select set_config('request.jwt.claim.sub',pg_temp.tid('nurse_auth')::text,true);
do $$declare j uuid;payload jsonb;r jsonb;begin
 j:=(public.turnos_operar('contexto')->'ventana'->>'id')::uuid;
 payload:=jsonb_build_object('solicitudId',gen_random_uuid(),'jornadaId',j,'pacienteId',pg_temp.tid('patient'),'tipo','medicamento','medicamentoId',pg_temp.tid('med'),'cantidad',2);
 perform pg_temp.expect_error('registrar',payload||jsonb_build_object('medicamentoId',pg_temp.tid('pending')),'Revisa la indicación');
 perform pg_temp.expect_error('registrar',payload||jsonb_build_object('medicamentoId',pg_temp.tid('unverified')),'Revisa la indicación');
 perform pg_temp.expect_error('registrar',payload||jsonb_build_object('cantidad',11),'existencias no alcanzan');
 assert (select cantidad from public.medicamentos_paciente where id=pg_temp.tid('med'))=10,'Failed write changed stock';
 r:=public.turnos_operar('registrar',payload);update turnos_test_ctx set id=(r->'evento'->>'id')::uuid where k='event';
 assert (select cantidad from public.medicamentos_paciente where id=pg_temp.tid('med'))=8,'Administration stock decrement failed';
 perform public.turnos_operar('registrar',payload);
 assert (select cantidad from public.medicamentos_paciente where id=pg_temp.tid('med'))=8,'Retry decremented stock twice';
 perform pg_temp.expect_error('registrar',payload||jsonb_build_object('solicitudId',gen_random_uuid()),'motivo');
 assert (select count(*) from public.administracion_medicamentos where turno_evento_id=pg_temp.tid('event'))=1,'Missing unified medication log';
 assert (select count(*) from public.turnos_inventario_movimientos where evento_id=pg_temp.tid('event'))=1,'Missing stock ledger';
 insert into turnos_test_results values('medication_eligibility_atomic_stock_and_retry',true);
end;$$;
select set_config('request.jwt.claim.sub',pg_temp.tid('admin_auth')::text,true);
do $$declare r jsonb;old_stock_stamp timestamptz;changed integer;begin
 select stock_verificado_at into old_stock_stamp from public.medicamentos_paciente where id=pg_temp.tid('med');
 r:=public.turnos_operar('corregir',jsonb_build_object('solicitudId',gen_random_uuid(),'eventoId',pg_temp.tid('event'),'motivo','TEST adjust amount','cantidad',3));
 update turnos_test_ctx set id=(r->'evento'->>'id')::uuid where k='correction';
 assert (select cantidad from public.medicamentos_paciente where id=pg_temp.tid('med'))=7,'Correction delta incorrect';
 assert (select cantidad from public.turnos_eventos where id=pg_temp.tid('event'))=2,'Original was changed';
 perform pg_temp.expect_error('corregir',jsonb_build_object('solicitudId',gen_random_uuid(),'eventoId',pg_temp.tid('event'),'motivo','TEST stale correction','cantidad',1),'Otra corrección');
 perform pg_temp.expect_error('conteo',jsonb_build_object('medicamentoId',pg_temp.tid('med'),'cantidad',15,'cantidadEsperada',8,'motivo','TEST stale stock'),'existencias cambiaron');
 perform public.turnos_operar('conteo',jsonb_build_object('medicamentoId',pg_temp.tid('med'),'cantidad',15,'cantidadEsperada',7,'motivo','TEST physical count'));
 update public.medicamentos_paciente set notas='TEST stale editor payload' where id=pg_temp.tid('med') and stock_verificado_at=old_stock_stamp;
 get diagnostics changed=row_count;
 assert changed=0,'Stale editor must not overwrite notes after a newer stock count';
 assert (select notas from public.medicamentos_paciente where id=pg_temp.tid('med')) is distinct from 'TEST stale editor payload','Stale notes were written';
 insert into turnos_test_results values('stale_medication_editor_after_count_rejected',true);
 r:=public.turnos_operar('corregir',jsonb_build_object('solicitudId',gen_random_uuid(),'eventoId',pg_temp.tid('correction'),'motivo','TEST annul after count','anulado',true));
 assert (select cantidad from public.medicamentos_paciente where id=pg_temp.tid('med'))=15,'Correction must preserve later physical count';
 assert (select delta from public.turnos_inventario_movimientos where evento_id=(r->'evento'->>'id')::uuid)=0,'Post-count correction must have zero stock delta';
 assert (select count(*) from public.turnos_eventos where raiz_id=pg_temp.tid('event'))=3,'Correction chain lost history';
 insert into turnos_test_results values('correction_chain_count_conflict_and_authoritative_count',true);
 begin update public.medicamentos_paciente set cantidad=17 where id=pg_temp.tid('med');raise exception 'Direct admin stock edit allowed';exception when raise_exception then if sqlerrm not like 'TURNO:%' then raise;end if;end;
 insert into turnos_test_results values('direct_admin_stock_change_denied',true);
end;$$;
-- Create an agenda fixture at the actual current hour, including an atomic medication link.
reset role;
insert into public.agenda_tareas(id,paciente_id,tipo,titulo,hora,fecha_inicio,medicamento_id)
 values(pg_temp.tid('care'),pg_temp.tid('patient'),'medicamento','TEST Agenda Medication',date_trunc('minute',now() at time zone 'America/Mexico_City')::time,(now() at time zone 'America/Mexico_City')::date,pg_temp.tid('agenda_med'));
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.tid('nurse_auth')::text,true);
do $$declare j uuid;p jsonb;r jsonb;begin
 j:=(public.turnos_operar('contexto')->'ventana'->>'id')::uuid;
 p:=jsonb_build_object('solicitudId',gen_random_uuid(),'jornadaId',j,'pacienteId',pg_temp.tid('patient'),'tipo','medicamento','medicamentoId',pg_temp.tid('agenda_med'),'cantidad',1);
 perform pg_temp.expect_error('registrar',p,'actividad programada');
 p:=p||jsonb_build_object('agendaTareaId',pg_temp.tid('care'),'agendaFecha',(now() at time zone 'America/Mexico_City')::date);
 r:=public.turnos_operar('registrar',p);
 assert (select count(*) from public.agenda_realizaciones where turno_evento_id=(r->'evento'->>'id')::uuid)=1,'Agenda was not linked';
 assert (select count(*) from public.administracion_medicamentos where turno_evento_id=(r->'evento'->>'id')::uuid and agenda_realizacion_id is not null)=1,'Medication was not linked';
 perform pg_temp.expect_error('registrar',p||jsonb_build_object('solicitudId',gen_random_uuid()),'ya está realizada');
 assert (select cantidad from public.medicamentos_paciente where id=pg_temp.tid('agenda_med'))=9,'Duplicate agenda decremented stock';
 insert into turnos_test_results values('agenda_medication_link_and_duplicate_prevention',true);
end;$$;
reset role;
-- Past night snapshots test date attribution, zero sleep, and correction without reopening the shift.
do $$declare d date:=(now() at time zone 'America/Mexico_City')::date-3;h uuid;v jsonb;begin
 insert into public.turnos_horarios(vigente_desde,matutino,vespertino,nocturno,creado_por) values(d,'07:00','15:00','23:00',pg_temp.tid('admin')) returning id into h;
 v:=private.turnos_ventana(d,'nocturno');assert (v->>'inicio')::timestamptz=(d+time '23:00') at time zone 'America/Mexico_City';assert (v->>'fin')::timestamptz=((d+1)+time '07:00') at time zone 'America/Mexico_City';
 insert into public.turnos_jornadas(id,fecha,turno,horario_id,inicio,fin) values(pg_temp.tid('night'),d,'nocturno',h,(v->>'inicio')::timestamptz,(v->>'fin')::timestamptz);
 insert into public.turnos_eventos(id,solicitud_id,jornada_id,paciente_id,tipo,titulo,valor,unidad,ocurrido_at,personal_id,raiz_id)
 values(pg_temp.tid('sleep'),gen_random_uuid(),pg_temp.tid('night'),pg_temp.tid('patient'),'sueno','Horas de sueño',0,'h',((d+1)+time '06:00') at time zone 'America/Mexico_City',pg_temp.tid('nurse'),pg_temp.tid('sleep'));
 insert into turnos_test_results values('night_crosses_midnight_keeps_start_date_and_zero_sleep',true);
end;$$;
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.tid('nurse_auth')::text,true);
select pg_temp.expect_error('registrar',jsonb_build_object('solicitudId',gen_random_uuid(),'jornadaId',pg_temp.tid('night'),'pacienteId',pg_temp.tid('patient'),'tipo','sueno','valor',1),'turno ya terminó');
select set_config('request.jwt.claim.sub',pg_temp.tid('admin_auth')::text,true);
do $$declare r jsonb;begin
 r:=public.turnos_operar('corregir',jsonb_build_object('solicitudId',gen_random_uuid(),'eventoId',pg_temp.tid('sleep'),'motivo','TEST explicit historical correction','valor',0));
 assert (r->'evento'->>'valor')::numeric=0,'Zero sleep was lost';
 assert (r->'evento'->>'jornada_id')::uuid=pg_temp.tid('night'),'Historical shift changed';
 perform pg_temp.expect_error('horarios',jsonb_build_object('matutino','01:00','vespertino','09:00','nocturno','17:00','vigenteDesde',(now() at time zone 'America/Mexico_City')::date),'mañana');
 insert into turnos_test_results values('historical_correction_without_reopening_and_schedule_version',true);
end;$$;
reset role;
select test,ok from turnos_test_results order by test;
rollback;
