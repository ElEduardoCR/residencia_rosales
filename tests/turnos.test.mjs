import test from 'node:test';
import assert from 'node:assert/strict';
import { fechaTurnos, fechaValidaTurnos, minutosTurnos, validarHorariosTurno, validarMedicionTurno, isoDesdeFechaHoraTurnos, eventosVigentesTurno } from '../src/lib/turnos.ts';

test('residence dates and conversion keep midnight independent of device timezone', () => {
  assert.equal(fechaTurnos('2026-10-31T05:59:59Z'), '2026-10-30');
  assert.equal(fechaTurnos('2026-10-31T06:00:00Z'), '2026-10-31');
  assert.equal(isoDesdeFechaHoraTurnos('2026-10-31', '00:00'), '2026-10-31T06:00:00.000Z');
  assert.equal(isoDesdeFechaHoraTurnos('2026-10-30', '23:59:59'), '2026-10-31T05:59:59.000Z');
  for (const [date, time] of [['2026-02-29', '12:00'], ['2026-10-30', '24:00'], ['2026-10-30', '08:80'], ['2026-10-30', '8:00']]) assert.equal(isoDesdeFechaHoraTurnos(date, time), null);
});
test('calendar validation rejects rollover dates and accepts leap days', () => {
  for (const date of ['2026-02-29', '2026-04-31', '2026-1-01', '', null]) assert.equal(fechaValidaTurnos(date), false);
  assert.equal(fechaValidaTurnos('2028-02-29'), true);
});
test('shift hours require three explicit ordered boundaries without defaults', () => {
  const valid = { matutino: '07:00', vespertino: '15:00', nocturno: '23:00', vigenteDesde: '2026-11-01' };
  assert.equal(validarHorariosTurno(valid), null);
  for (const change of [{ matutino: '' }, { vespertino: '07:00' }, { nocturno: '06:00' }, { nocturno: '24:00' }, { vigenteDesde: '2026-11-31' }]) assert.ok(validarHorariosTurno({ ...valid, ...change }));
  assert.equal(minutosTurnos('00:00:00'), 0);
  assert.equal(minutosTurnos('23:59:59'), 1439);
});
test('measurement absence differs from zero and units do not infer a diagnosis', () => {
  assert.equal(validarMedicionTurno('sueno', 0), null);
  assert.equal(validarMedicionTurno('cistoflo', 0), null);
  assert.ok(validarMedicionTurno('sueno', null));
  assert.ok(validarMedicionTurno('sueno', undefined));
  assert.ok(validarMedicionTurno('glucosa', 0));
  assert.equal(validarMedicionTurno('glucosa', 123, 'despues_comida'), null);
  assert.ok(validarMedicionTurno('glucosa', 123, 'diagnostico'));
  for (const value of [NaN, Infinity, -1, 25]) assert.ok(validarMedicionTurno('sueno', value));
});
test('append-only correction chains preserve raw history and select a single active leaf', () => {
  const original = { id: 'a', raiz_id: 'a', corrige_id: null, anulado: false, valor: 0 };
  const correction = { id: 'b', raiz_id: 'a', corrige_id: 'a', anulado: false, valor: 2 };
  const annulment = { id: 'c', raiz_id: 'a', corrige_id: 'b', anulado: true, valor: 2 };
  const restoration = { id: 'd', raiz_id: 'a', corrige_id: 'c', anulado: false, valor: 0 };
  const raw = [original, correction, annulment, restoration];
  assert.deepEqual(eventosVigentesTurno([original]), [original]);
  assert.deepEqual(eventosVigentesTurno([correction, original]), [correction]);
  assert.deepEqual(eventosVigentesTurno(raw.slice(0, 3)), []);
  assert.deepEqual(eventosVigentesTurno(raw), [restoration]);
  assert.equal(raw[0].valor, 0);
  assert.equal(raw.length, 4);
});
