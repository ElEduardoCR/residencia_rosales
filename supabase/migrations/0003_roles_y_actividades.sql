-- =====================================================================
--  RESIDENCIA ROSALES — Migración 0003
--  Roles, control de acceso por rol, flujo de visitantes,
--  actividades programadas, firmas de salida y suscripciones push.
--  Ejecutar DESPUÉS de 0001_init.sql. Es idempotente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. ROLES EN PERSONAL
-- ---------------------------------------------------------------------
alter table public.personal add column if not exists rol text not null default 'enfermero';
alter table public.personal drop constraint if exists personal_rol_chk;
alter table public.personal add constraint personal_rol_chk check (rol in ('admin','enfermero'));

-- Helpers de rol (SECURITY DEFINER para no entrar en recursión con RLS)
create or replace function public.es_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.personal
    where user_id = auth.uid() and rol = 'admin' and activo
  );
$$;

create or replace function public.mi_rol()
returns text language sql stable security definer set search_path = public as $$
  select rol from public.personal where user_id = auth.uid() limit 1;
$$;

-- Al crear un usuario de auth: enlazar a un registro de personal existente
-- (por email) o crear uno nuevo. El PRIMER usuario del sistema es admin.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  existe_admin boolean;
  enlazado boolean := false;
begin
  update public.personal
    set user_id = new.id
    where email = new.email and user_id is null;
  if found then
    return new;
  end if;

  select exists(select 1 from public.personal where rol = 'admin') into existe_admin;
  insert into public.personal (user_id, nombre, email, rol)
  values (
    new.id,
    coalesce(nullif(split_part(new.email, '@', 1), ''), 'Usuario'),
    new.email,
    case when existe_admin then 'enfermero' else 'admin' end
  );
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 2. FIRMAS DE SALIDA (enfermero que entrega / recibe + sus firmas)
-- ---------------------------------------------------------------------
alter table public.salidas
  add column if not exists enfermero_entrega_id        uuid references public.personal(id) on delete set null,
  add column if not exists enfermero_recibe_id         uuid references public.personal(id) on delete set null,
  add column if not exists firma_salida_enfermero_url  text,
  add column if not exists firma_regreso_enfermero_url text;
-- (firma_salida_url y firma_regreso_url existentes = firma del tutor / quien lo lleva)

-- ---------------------------------------------------------------------
-- 3. ACTIVIDADES PROGRAMADAS (recurrentes, por hora) — las crea el admin
-- ---------------------------------------------------------------------
create table if not exists public.actividades_programadas (
  id          uuid primary key default gen_random_uuid(),
  titulo      text not null,
  descripcion text,
  paciente_id uuid references public.pacientes(id) on delete cascade, -- null = general
  hora        time not null,
  dias_semana int[] not null default '{0,1,2,3,4,5,6}', -- 0=domingo .. 6=sábado (JS getDay)
  activo      boolean not null default true,
  creado_por  uuid references public.personal(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- Registro de cumplimiento (una por actividad por día)
create table if not exists public.actividades_completadas (
  id            uuid primary key default gen_random_uuid(),
  actividad_id  uuid not null references public.actividades_programadas(id) on delete cascade,
  fecha         date not null,
  completada_at timestamptz not null default now(),
  enfermero_id  uuid references public.personal(id) on delete set null,
  a_tiempo      boolean not null default true,
  motivo_retraso text,           -- requerido si a_tiempo = false
  notas         text,
  unique (actividad_id, fecha)
);

-- ---------------------------------------------------------------------
-- 4. SUSCRIPCIONES PUSH (notificaciones en segundo plano)
-- ---------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  personal_id uuid references public.personal(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 5. ACCESOS DE VISITANTES (registro por seguridad)
-- ---------------------------------------------------------------------
create table if not exists public.accesos_visitantes (
  id               uuid primary key default gen_random_uuid(),
  visitante_nombre text not null,
  telefono         text not null,
  paciente_id      uuid references public.pacientes(id) on delete cascade,
  created_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY POR ROL
--    - Lectura: cualquier autenticado (admin o enfermero).
--    - Gestión (alta/edición de pacientes, inventario, menú, personal,
--      prescripciones y actividades programadas): solo admin.
--    - Registro de trabajo (turnos, alimentación, administración,
--      cumplimiento, salidas, visitas, push): admin o enfermero.
--    - Los visitantes NO acceden a las tablas; se sirven desde el
--      servidor con la service role.
-- ---------------------------------------------------------------------
alter table public.actividades_programadas enable row level security;
alter table public.actividades_completadas enable row level security;
alter table public.push_subscriptions      enable row level security;
alter table public.accesos_visitantes      enable row level security;

do $$
declare t text;
begin
  -- Grupo "solo admin escribe, todos los autenticados leen"
  foreach t in array array[
    'personal','pacientes','inventario_medicamentos','inventario_movimientos',
    'menu_semanal','medicamentos_paciente','actividades_programadas'
  ] loop
    execute format('drop policy if exists "acceso_autenticado" on public.%I;', t);
    execute format('drop policy if exists "leer_auth" on public.%I;', t);
    execute format('drop policy if exists "insert_admin" on public.%I;', t);
    execute format('drop policy if exists "update_admin" on public.%I;', t);
    execute format('drop policy if exists "delete_admin" on public.%I;', t);
    execute format('create policy "leer_auth"   on public.%I for select to authenticated using (true);', t);
    execute format('create policy "insert_admin" on public.%I for insert to authenticated with check (public.es_admin());', t);
    execute format('create policy "update_admin" on public.%I for update to authenticated using (public.es_admin()) with check (public.es_admin());', t);
    execute format('create policy "delete_admin" on public.%I for delete to authenticated using (public.es_admin());', t);
  end loop;

  -- Grupo "cualquier autenticado registra (admin o enfermero)"
  foreach t in array array[
    'registros_turno','registros_alimentacion','administracion_medicamentos',
    'actividades_completadas','salidas','visitas','push_subscriptions'
  ] loop
    execute format('drop policy if exists "acceso_autenticado" on public.%I;', t);
    execute format('drop policy if exists "acceso_auth" on public.%I;', t);
    execute format('create policy "acceso_auth" on public.%I for all to authenticated using (true) with check (true);', t);
  end loop;

  -- Catálogo: leer e insertar (para "agregar uno que no está en la lista")
  execute 'drop policy if exists "acceso_autenticado" on public.medicamentos_catalogo';
  execute 'drop policy if exists "leer_auth" on public.medicamentos_catalogo';
  execute 'drop policy if exists "insert_auth" on public.medicamentos_catalogo';
  execute 'create policy "leer_auth" on public.medicamentos_catalogo for select to authenticated using (true)';
  execute 'create policy "insert_auth" on public.medicamentos_catalogo for insert to authenticated with check (true)';

  -- Accesos de visitantes: solo admin puede leerlos (se insertan vía service role)
  execute 'drop policy if exists "leer_admin" on public.accesos_visitantes';
  execute 'create policy "leer_admin" on public.accesos_visitantes for select to authenticated using (public.es_admin())';
end $$;

-- =====================================================================
--  FIN MIGRACIÓN 0003
-- =====================================================================
