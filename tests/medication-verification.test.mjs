import assert from "node:assert/strict";
import test from "node:test";
import { actualizarNotasVerificacion, existenciasSinVerificar, indicacionSinRevisar } from "../src/lib/medication-verification.ts";
import { medicamentoProgramado } from "../src/lib/medication-schedule.ts";

const review = "Requiere revisión documental. Sin turnos programados; validar la indicación antes de administrar.";
const stock = "Existencias no verificadas. Los valores 0 de cantidad/mínimo son valores técnicos obligatorios; no representan un conteo físico.";
const provenance = "Fuente documental: Fuente de prueba.docx (tabla: 0, fila: 2)\nTexto original: Producto de prueba 25g, Día: 1/2.\nObservación documental: Confirmar la unidad escrita.";
const original = `${review}\n${provenance}\n${stock}`;
const update = (options = {}) => actualizarNotasVerificacion({
  notas: original,
  notasOriginales: original,
  existenciasVerificadas: false,
  dosisYHorariosRevisados: false,
  fecha: "2026-10-27",
  ...options,
});

test("la incertidumbre del conteo depende del marcador incluso con cantidad mayor que cero", () => {
  const medicamento = { cantidad: 4, notas: original };
  assert.equal(existenciasSinVerificar(medicamento.notas), true);
  assert.equal(existenciasSinVerificar("Fuente documental: archivo\nExistencias verificadas mediante conteo el 2026-10-27."), false);
});

test("guardar sin verificar conserva ambos pendientes y su texto original", () => {
  assert.equal(update(), original);
  assert.equal(medicamentoProgramado({ activo: true, turnos: ["matutino"], notas: update() }), false);
});

test("un conteo explícito elimina solo su marcador y deja pendiente la indicación", () => {
  const notes = update({ existenciasVerificadas: true });
  assert.equal(existenciasSinVerificar(notes), false);
  assert.equal(indicacionSinRevisar(notes), true);
  assert.ok(notes.includes(provenance));
  assert.ok(notes.includes(review));
  assert.match(notes, /Existencias verificadas mediante conteo el 2026-10-27\./);
});

test("revisión explícita conserva fuente e indicación y habilita únicamente turnos elegidos", () => {
  const notes = update({ dosisYHorariosRevisados: true });
  assert.equal(indicacionSinRevisar(notes), false);
  assert.equal(existenciasSinVerificar(notes), true);
  assert.ok(notes.includes(provenance));
  assert.ok(notes.includes(stock));
  assert.match(notes, /Dosis y horarios revisados manualmente el 2026-10-27\./);
  assert.equal(medicamentoProgramado({ activo: true, turnos: [], notas: notes }), false);
  assert.equal(medicamentoProgramado({ activo: true, turnos: ["matutino"], notas: notes }), true);
});

test("borrar marcadores del textarea no equivale a verificar sus datos", () => {
  const notes = update({ notas: provenance });
  assert.equal(indicacionSinRevisar(notes), true);
  assert.equal(existenciasSinVerificar(notes), true);
  assert.ok(notes.includes(provenance));
});

test("la revisión no elimina menciones del texto original ni otras observaciones", () => {
  const quoted = "Texto original: Existencias no verificadas. Requiere revisión documental.";
  const notes = update({ notas: `${original}\n${quoted}`, existenciasVerificadas: true, dosisYHorariosRevisados: true });
  assert.ok(notes.includes(quoted));
  assert.ok(notes.includes(provenance));
});

test("volver a guardar una revisión no duplica fechas y desmarcar vuelve a dejarla pendiente", () => {
  const verified = update({ existenciasVerificadas: true, dosisYHorariosRevisados: true });
  assert.equal(update({ notas: verified, notasOriginales: verified, existenciasVerificadas: true, dosisYHorariosRevisados: true }), verified);
  const pending = update({ notas: verified, notasOriginales: verified });
  assert.equal(existenciasSinVerificar(pending), true);
  assert.equal(indicacionSinRevisar(pending), true);
});

test("los medicamentos sin importación documental conservan sus notas", () => {
  assert.equal(update({ notas: "Nota manual sin fuente importada.", notasOriginales: null }), "Nota manual sin fuente importada.");
});
