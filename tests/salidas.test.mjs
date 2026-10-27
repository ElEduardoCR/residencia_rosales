import assert from "node:assert/strict";
import test from "node:test";
import { validarFechasSalida, leerDatosSalida } from "../src/lib/salidas.ts";

test("acepta regreso el mismo día y el límite exacto de 20 días", () => {
  assert.equal(validarFechasSalida("2026-10-27", "2026-10-27", "10:00", "11:00"), null);
  assert.equal(validarFechasSalida("2026-10-27", "2026-11-16"), null);
});

test("rechaza fechas anteriores y más de 20 días", () => {
  assert.match(validarFechasSalida("2026-10-27", "2026-10-26"), /anterior/);
  assert.match(validarFechasSalida("2026-10-27", "2026-11-17"), /20/);
});

test("coteja horas solamente si la salida y el regreso ocurren el mismo día", () => {
  assert.match(validarFechasSalida("2026-10-27", "2026-10-27", "10:00", "09:59"), /anterior/);
  assert.equal(validarFechasSalida("2026-10-27", "2026-10-28", "23:00", "08:00"), null);
  assert.equal(validarFechasSalida("2026-10-27", "2026-10-27", "10:00", "10:00"), null);
});

test("rechaza fechas vacías y no válidas", () => {
  assert.match(validarFechasSalida("", "2026-10-27"), /Indica/);
  assert.match(validarFechasSalida("2026-10-27", ""), /Indica/);
  assert.match(validarFechasSalida("2026-10-27", "invalid"), /Revisa/);
  assert.match(validarFechasSalida("2026-02-28", "2026-02-30"), /Revisa/);
  assert.equal(validarFechasSalida("2028-02-28", "2028-02-29"), null);
});

test("conserva notas históricas de texto y tolera notas vacías", () => {
  assert.equal(leerDatosSalida("Texto histórico").observaciones, "Texto histórico");
  assert.equal(leerDatosSalida(null).motivo, "");
  assert.equal(leerDatosSalida("{json incompleto").observaciones, "{json incompleto");
});

test("lee campos nuevos de la versión conocida y descarta tipos inesperados", () => {
  const datos = leerDatosSalida('{"version":1,"destino":"Centro","motivo":42,"familiarRegreso":"Persona responsable"}');
  assert.equal(datos.destino, "Centro");
  assert.equal(datos.familiarRegreso, "Persona responsable");
  assert.equal(datos.motivo, "");
  assert.equal(leerDatosSalida('{"version":2,"destino":"Centro"}').observaciones, '{"version":2,"destino":"Centro"}');
});
