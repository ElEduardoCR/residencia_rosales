begin;
-- Cuidados explícitamente programados. No se infieren horas ni indicaciones clínicas.
create table public.agenda_tareas (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.pacientes(id) on delete restrict,
  tipo text not null check (tipo in ('medicamento','alimentacion','terapia','higiene','visita','otro')),
  titulo text not null check (char_length(btrim(titulo)) between 1 and 120),
  descripcion text check (char_length(descripcion) <= 2000),
  hora time not null check (hora < time '24:00'),
  fecha_inicio date not null,
  fecha_fin date check (fecha_fin >= fecha_inicio),
  dias_semana integer[] not null default '{0,1,2,3,4,5,6}'
    check (cardinality(dias_semana) between 1 and 7 and dias_semana <@ array[0,1,2,3,4,5,6] and array_position(dias_semana,null) is null),
  medicamento_id uuid references public.medicamentos_paciente(id) on delete restrict,
  activo boolean not null default true,
  archivada_at timestamptz,
  creado_por uuid references public.personal(id) on delete restrict,
  created_at timestamptz not null default now(),
  check ((tipo = 'medicamento') = (medicamento_id is not null)),
  check ((activo and archivada_at is null) or (not activo and archivada_at is not null))
);
create index agenda_tareas_paciente_idx on public.agenda_tareas(paciente_id);
create index agenda_tareas_fecha_idx on public.agenda_tareas(fecha_inicio,fecha_fin);
create index agenda_tareas_medicamento_idx on public.agenda_tareas(medicamento_id) where medicamento_id is not null;
create index agenda_tareas_autor_idx on public.agenda_tareas(creado_por);
create unique index agenda_tareas_sin_duplicados on public.agenda_tareas
  (paciente_id,tipo,titulo,hora,fecha_inicio,coalesce(fecha_fin,date '9999-12-31'),dias_semana) where activo;

create table public.agenda_realizaciones (
  id uuid primary key default gen_random_uuid(),
  tarea_id uuid not null references public.agenda_tareas(id) on delete restrict,
  fecha date not null,
  realizada_at timestamptz not null default now(),
  personal_id uuid not null references public.personal(id) on delete restrict,
  observaciones text check (char_length(observaciones) <= 1000),
  unique (tarea_id,fecha)
);
create index agenda_realizaciones_fecha_idx on public.agenda_realizaciones(fecha);
create index agenda_realizaciones_personal_idx on public.agenda_realizaciones(personal_id);

alter table public.agenda_tareas enable row level security;
alter table public.agenda_realizaciones enable row level security;
revoke all on public.agenda_tareas, public.agenda_realizaciones from public, anon, authenticated;
grant select, insert, update on public.agenda_tareas to authenticated;
grant select, insert on public.agenda_realizaciones to authenticated;
grant all on public.agenda_tareas, public.agenda_realizaciones to service_role;
create policy agenda_tareas_lectura on public.agenda_tareas for select to authenticated
  using ((select private.es_personal_activo()));
create policy agenda_tareas_alta on public.agenda_tareas for insert to authenticated
  with check ((select private.es_admin_activo()));
create policy agenda_tareas_archivar on public.agenda_tareas for update to authenticated
  using ((select private.es_admin_activo())) with check ((select private.es_admin_activo()));
create policy agenda_realizaciones_lectura on public.agenda_realizaciones for select to authenticated
  using ((select private.es_personal_activo()));
create policy agenda_realizaciones_alta on public.agenda_realizaciones for insert to authenticated
  with check ((select private.es_personal_activo()) and personal_id in (
    select id from public.personal where user_id = (select auth.uid()) and activo
  ));

-- INVOKER: every lookup and write keeps the caller's RLS permissions.
create function private.validar_tarea_agenda()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare med public.medicamentos_paciente%rowtype; autor uuid;
begin
  if tg_op = 'UPDATE' then
    if (new.paciente_id,new.tipo,new.titulo,new.descripcion,new.hora,new.fecha_inicio,new.fecha_fin,new.dias_semana,new.medicamento_id,new.creado_por,new.created_at)
       is distinct from
       (old.paciente_id,old.tipo,old.titulo,old.descripcion,old.hora,old.fecha_inicio,old.fecha_fin,old.dias_semana,old.medicamento_id,old.creado_por,old.created_at) then
      raise exception 'Archive the task and create a new schedule to preserve history' using errcode='23514';
    end if;
    if not old.activo and new.activo then raise exception 'Archived schedules cannot be reactivated' using errcode='23514'; end if;
    new.archivada_at := case when old.activo and not new.activo then clock_timestamp() else old.archivada_at end;
    return new;
  end if;
  if new.fecha_inicio < (now() at time zone 'America/Mexico_City')::date then
    raise exception 'Schedules must start today or later' using errcode='23514';
  end if;
  if not exists (select 1 from public.pacientes where id=new.paciente_id and activo) then
    raise exception 'Patient must be active' using errcode='23514';
  end if;
  if auth.uid() is not null then
    select id into autor from public.personal where user_id=auth.uid() and activo and rol='admin';
    if autor is null then raise exception 'Active administrator required' using errcode='42501'; end if;
    if new.creado_por is not null and new.creado_por <> autor then raise exception 'Creator must match session' using errcode='42501'; end if;
    new.creado_por := autor;
  end if;
  if new.fecha_fin is not null and not exists (
    select 1 from generate_series(new.fecha_inicio::timestamp,
      least(new.fecha_fin,new.fecha_inicio + 6)::timestamp,interval '1 day') as dia
    where extract(dow from dia)::integer = any(new.dias_semana)
  ) then raise exception 'No scheduled weekday occurs in the selected date range' using errcode='23514'; end if;
  new.created_at := clock_timestamp();
  if new.medicamento_id is not null then
    select * into med from public.medicamentos_paciente where id=new.medicamento_id;
    if not found or not med.activo or med.paciente_id <> new.paciente_id or coalesce(med.notas,'') ~* 'requiere revisión documental' then
      raise exception 'Medication must belong to patient and have a reviewed indication' using errcode='23514';
    end if;
    new.titulo := med.medicamento_nombre;
  end if;
  return new;
end;
$$;
revoke all on function private.validar_tarea_agenda() from public, anon;
grant execute on function private.validar_tarea_agenda() to authenticated, service_role;
create trigger agenda_validar_tarea before insert or update on public.agenda_tareas
  for each row execute function private.validar_tarea_agenda();

create function private.validar_realizacion_agenda()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare tarea public.agenda_tareas%rowtype; autor uuid; med public.medicamentos_paciente%rowtype;
begin
  select id into autor from public.personal where user_id=auth.uid() and activo;
  if autor is null or new.personal_id <> autor then raise exception 'Performer must match an active session' using errcode='42501'; end if;
  select * into tarea from public.agenda_tareas where id=new.tarea_id;
  if not found or not tarea.activo or new.fecha < tarea.fecha_inicio or (tarea.fecha_fin is not null and new.fecha > tarea.fecha_fin)
    or not (extract(dow from new.fecha)::integer = any(tarea.dias_semana))
    or new.fecha > (now() at time zone 'America/Mexico_City')::date then
    raise exception 'Task is not scheduled for this date or is in the future' using errcode='23514';
  end if;
  if not exists (select 1 from public.pacientes where id=tarea.paciente_id and activo) then
    raise exception 'Patient must be active' using errcode='23514';
  end if;
  if tarea.medicamento_id is not null then
    select * into med from public.medicamentos_paciente where id=tarea.medicamento_id;
    if not found or not med.activo or med.paciente_id <> tarea.paciente_id or coalesce(med.notas,'') ~* 'requiere revisión documental' then
      raise exception 'Medication indication requires review' using errcode='23514';
    end if;
  end if;
  new.personal_id := autor;
  new.realizada_at := clock_timestamp();
  return new;
end;
$$;
revoke all on function private.validar_realizacion_agenda() from public, anon;
grant execute on function private.validar_realizacion_agenda() to authenticated, service_role;
create trigger agenda_validar_realizacion before insert on public.agenda_realizaciones
  for each row execute function private.validar_realizacion_agenda();

-- A medication completion and its clinical history entry succeed or roll back together.
alter table public.administracion_medicamentos
  add column agenda_realizacion_id uuid unique references public.agenda_realizaciones(id) on delete restrict,
  add column medicamento_paciente_id uuid references public.medicamentos_paciente(id) on delete restrict;
create index administracion_medicamento_paciente_idx on public.administracion_medicamentos(medicamento_paciente_id) where medicamento_paciente_id is not null;
create function private.registrar_medicamento_agenda()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare tarea public.agenda_tareas%rowtype; med public.medicamentos_paciente%rowtype;
begin
  select * into tarea from public.agenda_tareas where id=new.tarea_id;
  if tarea.tipo = 'medicamento' then
    select * into med from public.medicamentos_paciente where id=tarea.medicamento_id;
    insert into public.administracion_medicamentos (
      paciente_id,fecha,hora,medicamento_nombre,tipo,dosis,enfermero_id,created_at,agenda_realizacion_id,medicamento_paciente_id,motivo
    ) values (
      tarea.paciente_id,new.fecha,(new.realizada_at at time zone 'America/Mexico_City')::time,
      med.medicamento_nombre,'obligatorio',med.dosis,new.personal_id,new.realizada_at,new.id,med.id,
      'Registrado desde la agenda. Hora programada: ' || to_char(tarea.hora,'HH24:MI') || case when new.observaciones is null then '' else '. ' || new.observaciones end
    );
  end if;
  return new;
end;
$$;
revoke all on function private.registrar_medicamento_agenda() from public, anon;
grant execute on function private.registrar_medicamento_agenda() to authenticated, service_role;
create trigger agenda_registrar_medicamento after insert on public.agenda_realizaciones
  for each row execute function private.registrar_medicamento_agenda();

create function private.proteger_administracion_agenda()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op='INSERT' then
    if new.agenda_realizacion_id is not null and not exists (
      select 1 from public.agenda_realizaciones r
      join public.agenda_tareas t on t.id=r.tarea_id
      join public.medicamentos_paciente m on m.id=t.medicamento_id
      where r.id=new.agenda_realizacion_id and t.tipo='medicamento'
        and new.paciente_id=t.paciente_id and new.medicamento_paciente_id=m.id
        and new.enfermero_id=r.personal_id and new.fecha=r.fecha
        and new.created_at=r.realizada_at and new.medicamento_nombre=m.medicamento_nombre
        and new.dosis is not distinct from m.dosis and new.turno is null
    ) then raise exception 'Medication history must match its agenda completion' using errcode='23514'; end if;
    return new;
  end if;
  if current_user not in ('postgres','service_role') and (old.agenda_realizacion_id is not null or (tg_op='UPDATE' and new.agenda_realizacion_id is distinct from old.agenda_realizacion_id)) then
    raise exception 'Agenda administration history cannot be changed' using errcode='42501';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function private.proteger_administracion_agenda() from public, anon;
grant execute on function private.proteger_administracion_agenda() to authenticated, service_role;
create trigger agenda_proteger_administracion before insert or update or delete on public.administracion_medicamentos
  for each row execute function private.proteger_administracion_agenda();

commit;
