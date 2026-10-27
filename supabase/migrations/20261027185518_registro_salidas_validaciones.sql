-- El registro conserva los nuevos campos en notas (JSON versionado) y
-- el cotejo de pertenencias en inventario (JSONB); no elimina datos previos.

-- Una sola salida abierta por residente, incluso con envíos simultáneos.
create unique index if not exists salidas_una_abierta_por_paciente
  on public.salidas (paciente_id) where estado = 'fuera';

alter table public.salidas drop constraint if exists salida_max_20_dias;
alter table public.salidas add constraint salida_max_20_dias check (
  fecha_regreso is null or (fecha_regreso - fecha_salida) between 0 and 20
);
alter table public.salidas drop constraint if exists salida_estimada_max_20;
alter table public.salidas add constraint salida_estimada_max_20 check (
  fecha_regreso_estimada is null or (fecha_regreso_estimada - fecha_salida) between 0 and 20
);
alter table public.salidas drop constraint if exists salida_orden_horas;
alter table public.salidas add constraint salida_orden_horas check (
  fecha_regreso is distinct from fecha_salida or hora_salida is null
  or hora_regreso is null or hora_regreso >= hora_salida
);
alter table public.salidas drop constraint if exists salida_estado_fechas;
alter table public.salidas add constraint salida_estado_fechas check (
  (estado = 'fuera' and fecha_regreso is null)
  or (estado = 'regresado' and fecha_regreso is not null)
);
