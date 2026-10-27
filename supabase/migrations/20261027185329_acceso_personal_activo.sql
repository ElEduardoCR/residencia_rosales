-- Los expedientes y archivos solo son accesibles al personal activo.
create schema if not exists private;
grant usage on schema private to authenticated;

create or replace function private.es_personal_activo()
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.personal where user_id = auth.uid() and activo
  );
$$;
create or replace function private.es_admin_activo()
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.personal where user_id = auth.uid() and activo and rol = 'admin'
  );
$$;
revoke all on function private.es_personal_activo() from public, anon;
revoke all on function private.es_admin_activo() from public, anon;
grant execute on function private.es_personal_activo(), private.es_admin_activo() to authenticated;
create index if not exists personal_user_activo_idx on public.personal(user_id) where activo;

-- No conceder acceso por registrarse. Solo enlazar correos de plantilla previamente autorizados.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.personal set user_id = new.id
    where lower(email) = lower(new.email) and user_id is null and activo;
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.es_admin(), public.mi_rol() from public, anon;

do $$
declare t text; p record; admin_only boolean;
begin
  foreach t in array array[
    'personal','pacientes','inventario_medicamentos','inventario_movimientos',
    'inventario_paciente','menu_semanal','medicamentos_paciente','actividades_programadas',
    'medicamentos_catalogo','registros_turno','registros_alimentacion',
    'administracion_medicamentos','actividades_completadas','salidas','visitas',
    'push_subscriptions','accesos_visitantes'
  ] loop
    if to_regclass('public.' || t) is null then continue; end if;
    for p in select policyname from pg_policies where schemaname='public' and tablename=t loop
      execute format('drop policy %I on public.%I',p.policyname,t);
    end loop;
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon',t);
    execute format('grant select,insert,update,delete on public.%I to authenticated, service_role',t);
    admin_only := t = any(array['personal','pacientes','inventario_medicamentos','inventario_movimientos','inventario_paciente','menu_semanal','medicamentos_paciente','actividades_programadas','medicamentos_catalogo','accesos_visitantes']);
    execute format('create policy personal_lectura on public.%I for select to authenticated using ((select private.es_personal_activo()))',t);
    execute format('create policy personal_escritura on public.%I for all to authenticated using ((select private.%I())) with check ((select private.%I()))',t,
      case when admin_only then 'es_admin_activo' else 'es_personal_activo' end,
      case when admin_only then 'es_admin_activo' else 'es_personal_activo' end);
  end loop;
end $$;
grant usage, select on all sequences in schema public to authenticated, service_role;

update storage.buckets set public = false where id in ('fotos-pacientes','firmas');
drop policy if exists storage_auth_rw on storage.objects;
drop policy if exists storage_public_read on storage.objects;
drop policy if exists archivos_personal on storage.objects;
create policy archivos_personal on storage.objects for all to authenticated
using (bucket_id in ('fotos-pacientes','firmas') and (select private.es_personal_activo()))
with check (bucket_id in ('fotos-pacientes','firmas') and (select private.es_personal_activo()));
