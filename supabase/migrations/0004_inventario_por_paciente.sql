-- =====================================================================
--  RESIDENCIA ROSALES — Migración 0004
--  Inventario de medicamentos POR PACIENTE (en lugar de global).
--  Cada paciente maneja el mismo medicamento con su propia dosis,
--  lugar de compra, mínimo y máximo.
--  Ejecutar DESPUÉS de 0003. Es idempotente.
-- =====================================================================

create table if not exists public.inventario_paciente (
  id           uuid primary key default gen_random_uuid(),
  paciente_id  uuid not null references public.pacientes(id) on delete cascade,
  catalogo_id  bigint references public.medicamentos_catalogo(id) on delete set null,
  nombre       text not null,
  tipo         text not null default 'pastilla' check (tipo in ('pastilla','ml','otro')),
  unidad       text not null default 'pieza',        -- 'pieza' | 'ml' | ...
  dosis        text,                                 -- dosis para ESTE paciente
  cantidad     numeric not null default 0,
  minimo       numeric not null default 0,           -- resurtir cuando baje a esto
  maximo       numeric,                              -- nivel objetivo / máximo
  lugar_compra text,                                 -- dónde se compra
  ubicacion    text,
  notas        text,
  activo       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_invpac_paciente on public.inventario_paciente(paciente_id);

drop trigger if exists trg_invpac_updated on public.inventario_paciente;
create trigger trg_invpac_updated before update on public.inventario_paciente
  for each row execute function public.set_updated_at();

-- RLS: cualquier usuario autenticado (admin o enfermero) puede gestionarlo.
alter table public.inventario_paciente enable row level security;
drop policy if exists "acceso_auth" on public.inventario_paciente;
create policy "acceso_auth" on public.inventario_paciente
  for all to authenticated using (true) with check (true);

-- Nota: la tabla global inventario_medicamentos queda en desuso (se conserva
-- para no romper referencias; ya no se usa en la aplicación).

-- =====================================================================
--  FIN MIGRACIÓN 0004
-- =====================================================================
