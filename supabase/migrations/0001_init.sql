-- =====================================================================
--  RESIDENCIA ROSALES — Esquema inicial de base de datos
--  Ejecutar UNA vez en Supabase (SQL Editor) o vía psql.
--  Incluye: extensiones, tablas, RLS, políticas, storage, triggers y
--  el menú semanal pre-cargado.
--  El catálogo de medicamentos (12,800+) se carga aparte (ver README).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Extensiones
-- ---------------------------------------------------------------------
create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists pg_trgm;    -- búsqueda de texto (autocompletado)

-- ---------------------------------------------------------------------
-- Utilidad: actualizar updated_at automáticamente
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

-- =====================================================================
--  1. PERSONAL  (enfermeros / cuidadores / administrativos)
-- =====================================================================
create table if not exists public.personal (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid references auth.users(id) on delete set null,
  nombre                  text not null,
  puesto                  text,                         -- Enfermero, Cuidador, Médico, Admin...
  turno                   text check (turno in ('matutino','vespertino','nocturno','mixto')),
  telefono                text,
  email                   text,
  direccion               text,
  contacto_emergencia     text,                         -- nombre del contacto de emergencia
  contacto_emergencia_tel text,
  cedula                  text,                         -- cédula profesional
  notas                   text,
  activo                  boolean not null default true,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
drop trigger if exists trg_personal_updated on public.personal;
create trigger trg_personal_updated before update on public.personal
  for each row execute function public.set_updated_at();

-- =====================================================================
--  2. CATÁLOGO DE MEDICAMENTOS  (lista maestra para autocompletar)
-- =====================================================================
create table if not exists public.medicamentos_catalogo (
  id        bigint generated always as identity primary key,
  nombre    text not null,
  principio text,
  forma     text,
  tipo      text not null default 'otro' check (tipo in ('pastilla','ml','otro'))
);
-- índice trigram para búsqueda rápida con ILIKE '%texto%'
create index if not exists idx_catalogo_nombre_trgm
  on public.medicamentos_catalogo using gin (nombre gin_trgm_ops);

-- =====================================================================
--  3. INVENTARIO DE MEDICAMENTOS  (existencias de la residencia)
-- =====================================================================
create table if not exists public.inventario_medicamentos (
  id          uuid primary key default gen_random_uuid(),
  catalogo_id bigint references public.medicamentos_catalogo(id) on delete set null,
  nombre      text not null,
  tipo        text not null default 'pastilla' check (tipo in ('pastilla','ml','otro')),
  unidad      text not null default 'pieza',     -- 'pieza' | 'ml' | etc.
  cantidad    numeric not null default 0,
  minimo      numeric not null default 0,        -- punto de resurtido
  ubicacion   text,
  notas       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
drop trigger if exists trg_inventario_updated on public.inventario_medicamentos;
create trigger trg_inventario_updated before update on public.inventario_medicamentos
  for each row execute function public.set_updated_at();

-- Movimientos de inventario (entradas / salidas / ajustes) — historial
create table if not exists public.inventario_movimientos (
  id           uuid primary key default gen_random_uuid(),
  inventario_id uuid not null references public.inventario_medicamentos(id) on delete cascade,
  tipo         text not null check (tipo in ('entrada','salida','ajuste')),
  cantidad     numeric not null,
  motivo       text,
  personal_id  uuid references public.personal(id) on delete set null,
  created_at   timestamptz not null default now()
);

-- =====================================================================
--  4. PACIENTES
-- =====================================================================
create table if not exists public.pacientes (
  id               uuid primary key default gen_random_uuid(),
  foto_url         text,
  nombre           text not null,
  sexo             text check (sexo in ('M','F','Otro')),
  tipo_sangre      text,                         -- A+, A-, B+, ... O-
  fecha_nacimiento date,
  alergias         text[] not null default '{}', -- 1 o varias
  enfermedades     text[] not null default '{}', -- 1 o varias
  tutor_nombre     text,
  tutor_parentesco text,
  tutor_contacto   text,
  peso             numeric,                       -- kg
  talla            numeric,                       -- cm (medida adicional)
  estatura         numeric,                       -- cm (para IMC)
  -- IMC calculado automáticamente a partir de peso y estatura (cm)
  imc numeric generated always as (
    case when peso is not null and estatura is not null and estatura > 0
      then round((peso / ((estatura/100.0) * (estatura/100.0)))::numeric, 1)
      else null end
  ) stored,
  notas            text,
  activo           boolean not null default true, -- false = dado de baja
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
drop trigger if exists trg_pacientes_updated on public.pacientes;
create trigger trg_pacientes_updated before update on public.pacientes
  for each row execute function public.set_updated_at();

-- =====================================================================
--  5. MEDICAMENTOS DEL PACIENTE  (prescripción / tratamiento obligatorio)
-- =====================================================================
create table if not exists public.medicamentos_paciente (
  id                 uuid primary key default gen_random_uuid(),
  paciente_id        uuid not null references public.pacientes(id) on delete cascade,
  inventario_id      uuid references public.inventario_medicamentos(id) on delete set null,
  medicamento_nombre text not null,
  dosis              text,
  frecuencia         text,
  turnos             text[] not null default '{}', -- {'matutino','vespertino','nocturno'}
  activo             boolean not null default true,
  notas              text,
  created_at         timestamptz not null default now()
);

-- =====================================================================
--  6. ACTIVIDADES Y EVENTOS POR TURNO
-- =====================================================================
-- 6a. Registro por turno: evacuaciones y orina (enteros) + enfermero responsable
create table if not exists public.registros_turno (
  id            uuid primary key default gen_random_uuid(),
  paciente_id   uuid not null references public.pacientes(id) on delete cascade,
  fecha         date not null,
  turno         text not null check (turno in ('matutino','vespertino','nocturno')),
  evacuaciones  integer not null default 0 check (evacuaciones >= 0),
  orina         integer not null default 0 check (orina >= 0),
  enfermero_id  uuid references public.personal(id) on delete set null, -- responsable que verificó
  notas         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (paciente_id, fecha, turno)
);
drop trigger if exists trg_regturno_updated on public.registros_turno;
create trigger trg_regturno_updated before update on public.registros_turno
  for each row execute function public.set_updated_at();

-- 6b. Alimentación e hidratación (por día)
create table if not exists public.registros_alimentacion (
  id                   uuid primary key default gen_random_uuid(),
  paciente_id          uuid not null references public.pacientes(id) on delete cascade,
  fecha                date not null,
  almuerzo             boolean not null default false,
  comida               boolean not null default false,
  cena                 boolean not null default false,
  colacion_matutina    boolean not null default false,
  colacion_vespertina  boolean not null default false,
  vasos_agua           integer not null default 0 check (vasos_agua >= 0), -- 235 ml c/u
  enfermero_id         uuid references public.personal(id) on delete set null,
  notas                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (paciente_id, fecha)
);
drop trigger if exists trg_regalim_updated on public.registros_alimentacion;
create trigger trg_regalim_updated before update on public.registros_alimentacion
  for each row execute function public.set_updated_at();

-- 6c. Administración de medicamentos (obligatorio / extra con motivo)
create table if not exists public.administracion_medicamentos (
  id                 uuid primary key default gen_random_uuid(),
  paciente_id        uuid not null references public.pacientes(id) on delete cascade,
  fecha              date not null,
  turno              text check (turno in ('matutino','vespertino','nocturno')),
  hora               time,
  inventario_id      uuid references public.inventario_medicamentos(id) on delete set null,
  medicamento_nombre text not null,
  tipo               text not null default 'obligatorio' check (tipo in ('obligatorio','extra')),
  dosis              text,
  motivo             text,                       -- requerido cuando tipo = 'extra' (para qué se usó)
  enfermero_id       uuid references public.personal(id) on delete set null,
  created_at         timestamptz not null default now()
);

-- =====================================================================
--  7. VISITAS  (registro de visitantes a la residencia)
-- =====================================================================
create table if not exists public.visitas (
  id               uuid primary key default gen_random_uuid(),
  paciente_id      uuid references public.pacientes(id) on delete cascade,
  visitante_nombre text not null,
  parentesco       text,
  fecha            date not null default current_date,
  hora_entrada     time,
  hora_salida      time,
  motivo           text,
  created_at       timestamptz not null default now()
);

-- =====================================================================
--  8. SALIDAS  (el tutor se lleva al paciente fuera de la residencia)
--     Estancia máxima 20 días. Inventario, condición física y firmas.
-- =====================================================================
create table if not exists public.salidas (
  id                       uuid primary key default gen_random_uuid(),
  paciente_id              uuid not null references public.pacientes(id) on delete cascade,
  quien_lo_lleva           text not null,
  parentesco               text,
  fecha_salida             date not null,
  hora_salida              time,
  fecha_regreso_estimada   date,
  fecha_regreso            date,                 -- null mientras está fuera
  hora_regreso             time,
  -- inventario que lleva el paciente: arreglo de {nombre, llevado, notas}
  inventario               jsonb not null default '[]'::jsonb,
  condicion_fisica_salida  text,
  condicion_fisica_regreso text,
  firma_salida_url         text,                 -- imagen de firma (storage)
  firma_regreso_url        text,
  estado                   text not null default 'fuera' check (estado in ('fuera','regresado')),
  notas                    text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  -- la estancia fuera no debe superar 20 días
  constraint salida_max_20_dias check (
    fecha_regreso is null or (fecha_regreso - fecha_salida) <= 20
  ),
  constraint salida_estimada_max_20 check (
    fecha_regreso_estimada is null or (fecha_regreso_estimada - fecha_salida) <= 20
  )
);
drop trigger if exists trg_salidas_updated on public.salidas;
create trigger trg_salidas_updated before update on public.salidas
  for each row execute function public.set_updated_at();

-- =====================================================================
--  9. MENÚ SEMANAL
-- =====================================================================
create table if not exists public.menu_semanal (
  id          uuid primary key default gen_random_uuid(),
  dia         text not null check (dia in ('lunes','martes','miercoles','jueves','viernes','sabado','domingo')),
  tiempo      text not null check (tiempo in ('desayuno','colacion_matutina','comida','colacion_vespertina','cena')),
  descripcion text not null default '',
  updated_at  timestamptz not null default now(),
  unique (dia, tiempo)
);
drop trigger if exists trg_menu_updated on public.menu_semanal;
create trigger trg_menu_updated before update on public.menu_semanal
  for each row execute function public.set_updated_at();

-- Pre-cargar la cuadrícula del menú (7 días x 5 tiempos)
insert into public.menu_semanal (dia, tiempo, descripcion)
select d, t, ''
from unnest(array['lunes','martes','miercoles','jueves','viernes','sabado','domingo']) as d
cross join unnest(array['desayuno','colacion_matutina','comida','colacion_vespertina','cena']) as t
on conflict (dia, tiempo) do nothing;

-- =====================================================================
--  ROW LEVEL SECURITY
--  Política: cualquier usuario autenticado (personal con login) puede
--  leer y escribir. La capa pública (anon) no tiene acceso.
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'personal','medicamentos_catalogo','inventario_medicamentos','inventario_movimientos',
    'pacientes','medicamentos_paciente','registros_turno','registros_alimentacion',
    'administracion_medicamentos','visitas','salidas','menu_semanal'
  ] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "acceso_autenticado" on public.%I;', t);
    execute format(
      'create policy "acceso_autenticado" on public.%I for all to authenticated using (true) with check (true);', t
    );
  end loop;
end $$;

-- =====================================================================
--  STORAGE  (fotos de pacientes y firmas)
-- =====================================================================
insert into storage.buckets (id, name, public) values
  ('fotos-pacientes','fotos-pacientes', true),
  ('firmas','firmas', true)
on conflict (id) do nothing;

drop policy if exists "storage_auth_rw" on storage.objects;
create policy "storage_auth_rw" on storage.objects
  for all to authenticated
  using (bucket_id in ('fotos-pacientes','firmas'))
  with check (bucket_id in ('fotos-pacientes','firmas'));

drop policy if exists "storage_public_read" on storage.objects;
create policy "storage_public_read" on storage.objects
  for select to public
  using (bucket_id in ('fotos-pacientes','firmas'));

-- =====================================================================
--  FIN DEL ESQUEMA
-- =====================================================================
