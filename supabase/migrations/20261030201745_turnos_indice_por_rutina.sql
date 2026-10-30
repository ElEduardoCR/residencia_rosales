-- Cover the routine foreign key used to link historical care events.
create index turnos_eventos_rutina_idx on public.turnos_eventos(rutina_id);
