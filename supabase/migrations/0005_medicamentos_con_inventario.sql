-- =====================================================================
--  RESIDENCIA ROSALES — Migración 0005
--  El inventario se maneja DENTRO de los medicamentos del paciente
--  (no en una tabla aparte). Se agregan presentación y niveles de
--  existencia a medicamentos_paciente.
--  Ejecutar DESPUÉS de 0004. Es idempotente.
-- =====================================================================

alter table public.medicamentos_paciente
  add column if not exists presentacion text,          -- pastilla / ml / mg / cápsula / gotas / ...
  add column if not exists cantidad     numeric not null default 0,
  add column if not exists minimo       numeric not null default 0,
  add column if not exists maximo       numeric,
  add column if not exists lugar_compra text;

-- Nota: la tabla inventario_paciente (migración 0004) queda en desuso;
-- se conserva vacía para no romper nada.

-- =====================================================================
--  FIN MIGRACIÓN 0005
-- =====================================================================
