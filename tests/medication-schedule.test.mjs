import assert from "node:assert/strict";
import test from "node:test";
import { medicamentoProgramado, puedeRegistrarTurno } from "../src/lib/medication-schedule.ts";

test("los registros importados sin turnos no crean administraciones obligatorias", () => {
  const importado = { activo: true, turnos: [], notas: "Requiere revisión documental. Sin turnos programados; validar la indicación antes de administrar." };
  assert.equal(medicamentoProgramado(importado), false);
  for (const turno of ["matutino", "vespertino", "nocturno"]) assert.equal(puedeRegistrarTurno(importado, turno), false);
});

test("la programación exige revisión aun cuando se hayan seleccionado turnos", () => {
  const pendiente = { activo: true, turnos: ["matutino"], notas: "Fuente documental. REQUIERE REVISIÓN DOCUMENTAL." };
  assert.equal(medicamentoProgramado(pendiente), false);
  assert.equal(puedeRegistrarTurno(pendiente, "matutino"), false);
});

test("solo habilita el turno explícito de un medicamento activo revisado", () => {
  const revisado = { activo: true, turnos: ["nocturno"], notas: "Indicación validada por el responsable." };
  assert.equal(medicamentoProgramado(revisado), true);
  assert.equal(puedeRegistrarTurno(revisado, "nocturno"), true);
  assert.equal(puedeRegistrarTurno(revisado, "matutino"), false);
  assert.equal(puedeRegistrarTurno({ ...revisado, activo: false }, "nocturno"), false);
});

test("sin turnos nunca se interpreta como todos los turnos, con o sin notas", () => {
  assert.equal(medicamentoProgramado({ activo: true, turnos: [], notas: null }), false);
  assert.equal(medicamentoProgramado({ activo: true, turnos: [], notas: "Uso según necesidad" }), false);
});
