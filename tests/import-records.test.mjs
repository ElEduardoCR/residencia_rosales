import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyImportPlan,
  buildImportPlan,
  normalizeName,
  parseArguments,
  readExisting,
  summarizePlan,
} from '../scripts/import-records.mjs';

const patientId = '11111111-1111-4111-8111-111111111111';
const staffId = '22222222-2222-4222-8222-222222222222';
const medicationId = '33333333-3333-4333-8333-333333333333';
const existingId = '44444444-4444-4444-8444-444444444444';

function fixture() {
  return {
    version: 1,
    fuentes: { fichas: 'Ficha de prueba.docx' },
    fecha_extraccion: '2026-10-27',
    pacientes: [{
      id: patientId,
      nombre: 'Paciente de Prueba',
      fecha_nacimiento: '1940-01-02',
      fuente_principal: 'fichas',
      alergias: ['Penicilina'],
      enfermedades: [],
      medicamentos: [{
        id: medicationId,
        medicamento_nombre: 'Producto de prueba 25g',
        dosis: 'Día: 1/2; Noche: 1',
        frecuencia: 'Día / Noche',
        texto_original: 'Producto de prueba 25g | Día: 1/2 | Noche: 1',
        fuente: { documento: 'fichas', tabla: 0, fila: 4 },
        cantidad: null,
        minimo: null,
        turnos: ['matutino'],
        alertas: [{ detalle: 'Verificar unidad literal 25g.' }],
      }],
    }],
    personal: [{
      id: staffId,
      nombre: 'Persona de Prueba',
      fecha_nacimiento: '1990-04-03',
      titulacion: 'Escolaridad documentada',
      hijos: 0,
      fuente: { documento: 'fichas', tabla: 1, fila: 0 },
    }],
  };
}

function mockClient(initial = {}) {
  const tables = {
    pacientes: structuredClone(initial.pacientes ?? []),
    personal: structuredClone(initial.personal ?? []),
    medicamentos_paciente: structuredClone(initial.medicamentos_paciente ?? []),
  };
  const writes = [];
  return {
    tables,
    writes,
    from(table) {
      return {
        select() {
          return {
            order() {
              return { async range(start, end) { return { data: tables[table].slice(start, end + 1), error: null }; } };
            },
            async in(column, values) { return { data: tables[table].filter((row) => values.includes(row[column])), error: null }; },
          };
        },
        upsert(rows, options) {
          writes.push({ table, rows: structuredClone(rows), options });
          assert.deepEqual(options, { onConflict: 'id', ignoreDuplicates: true });
          const inserted = [];
          for (const row of rows) {
            if (tables[table].some((existing) => existing.id === row.id)) continue;
            tables[table].push(structuredClone(row));
            inserted.push({ id: row.id });
          }
          return { async select() { return { data: inserted, error: null }; } };
        },
      };
    },
  };
}

test('name matching tolerates accents and whitespace, not different names or concentrations', () => {
  assert.equal(normalizeName('  María   PRUEBA  '), normalizeName('maria prueba'));
  assert.notEqual(normalizeName('Maria Prueba'), normalizeName('Maria Otra'));
  assert.notEqual(normalizeName('Producto 25g'), normalizeName('Producto 25mg'));
});

test('CLI defaults to local dry run and only --apply permits writes', () => {
  assert.equal(parseArguments([]).apply, false);
  assert.equal(parseArguments(['--dry-run']).checkRemote, false);
  assert.equal(parseArguments(['--check-remote']).apply, false);
  assert.equal(parseArguments(['--apply']).apply, true);
  assert.throws(() => parseArguments(['--apply', '--dry-run']));
  assert.throws(() => parseArguments(['--file']));
});

test('transcription preserves doses, warnings, provenance and unknown fields without scheduling', () => {
  const source = fixture();
  const untouched = structuredClone(source);
  const plan = buildImportPlan(source);
  const medication = plan.rows.medicamentos_paciente[0];
  assert.equal(medication.medicamento_nombre, 'Producto de prueba 25g');
  assert.equal(medication.dosis, source.pacientes[0].medicamentos[0].dosis);
  assert.deepEqual(medication.turnos, []);
  assert.equal(medication.cantidad, 0);
  assert.equal(medication.minimo, 0);
  assert.equal(medication.presentacion, null);
  assert.match(medication.notas, /Requiere revisión documental/);
  assert.match(medication.notas, /Existencias no verificadas/);
  assert.match(medication.notas, /Texto original: Producto de prueba 25g/);
  assert.match(medication.notas, /Ficha de prueba.docx \(tabla: 0, fila: 4\)/);
  assert.equal(plan.rows.pacientes[0].sexo, null);
  assert.deepEqual(plan.rows.pacientes[0].enfermedades, []);
  assert.equal(plan.rows.personal[0].user_id, null);
  assert.equal(plan.rows.personal[0].rol, 'enfermero');
  assert.equal(plan.rows.personal[0].puesto, null);
  assert.match(plan.rows.personal[0].notas, /Número de hijos: 0/);
  assert.deepEqual(source, untouched);
});

test('repeated imports are idempotent and preserve existing edited rows', async () => {
  const source = fixture();
  const client = mockClient();
  const first = buildImportPlan(source, await readExisting(client));
  await applyImportPlan(client, first);
  assert.equal(client.writes.length, 3);
  client.tables.pacientes[0].notas = 'Actualización posterior';
  client.tables.personal[0].rol = 'admin';
  client.tables.medicamentos_paciente[0].activo = false;
  const second = buildImportPlan(source, await readExisting(client));
  assert.deepEqual(summarizePlan(second).por_insertar, { pacientes: 0, personal: 0, medicamentos_paciente: 0 });
  await applyImportPlan(client, second);
  assert.equal(client.writes.length, 3);
  assert.equal(client.tables.pacientes[0].notas, 'Actualización posterior');
  assert.equal(client.tables.personal[0].rol, 'admin');
  assert.equal(client.tables.medicamentos_paciente[0].activo, false);
});

test('care instructions survive separate fields without duplicating already joined notes', () => {
  const source = fixture();
  source.pacientes[0].indicaciones_cuidado = [
    { texto_original: 'Indicación de cuidado de prueba.' },
    { texto_original: 'Segunda indicación de cuidado.' },
  ];
  source.pacientes[0].notas = 'Indicación de cuidado de prueba.\nNota adicional.';
  let notes = buildImportPlan(source).rows.pacientes[0].notas;
  assert.equal(notes.split('Indicación de cuidado de prueba.').length - 1, 1);
  assert.match(notes, /Segunda indicación de cuidado\./);
  assert.match(notes, /Nota adicional\./);
  source.pacientes[0].notas = null;
  notes = buildImportPlan(source).rows.pacientes[0].notas;
  assert.match(notes, /Indicación de cuidado de prueba\./);
  assert.match(notes, /Segunda indicación de cuidado\./);
  assert.equal(notes.includes('[object Object]'), false);
});

test('matching an existing normalized name remaps prescription foreign keys', async () => {
  const source = fixture();
  const client = mockClient({ pacientes: [{ id: existingId, nombre: '  PACIENTE  DE PRUEBA ', fecha_nacimiento: '1940-01-02' }] });
  const plan = buildImportPlan(source, await readExisting(client));
  assert.equal(plan.rows.pacientes.length, 0);
  assert.equal(plan.rows.medicamentos_paciente[0].paciente_id, existingId);
  await applyImportPlan(client, plan);
  assert.equal(client.tables.pacientes.length, 1);
});

test('the same medication name for the same patient is preserved even with a different ID', () => {
  const source = fixture();
  const plan = buildImportPlan(source, {
    pacientes: [{ id: patientId, nombre: 'Paciente de Prueba' }],
    medicamentos_paciente: [{ id: existingId, paciente_id: patientId, medicamento_nombre: 'Producto de prueba 25g' }],
  });
  assert.equal(plan.rows.medicamentos_paciente.length, 0);
  assert.deepEqual(plan.expectedIds.medicamentos_paciente, [existingId]);
});

test('incomplete and impossible dates are rejected, missing dates are preserved as null', () => {
  const source = fixture();
  source.pacientes[0].fecha_nacimiento = '1940-02';
  assert.throws(() => buildImportPlan(source), /fecha incompleta/);
  source.pacientes[0].fecha_nacimiento = '1940-02-31';
  assert.throws(() => buildImportPlan(source), /fecha inexistente/);
  source.pacientes[0].fecha_nacimiento = null;
  assert.equal(buildImportPlan(source).rows.pacientes[0].fecha_nacimiento, null);
});

test('ambiguous names, conflicting birth dates and IDs abort before writes', () => {
  const source = fixture();
  assert.throws(() => buildImportPlan(source, { pacientes: [
    { id: patientId, nombre: 'Paciente de Prueba' },
    { id: existingId, nombre: 'Paciente de Prueba' },
  ] }), /ambiguos/);
  assert.throws(() => buildImportPlan(source, { pacientes: [
    { id: existingId, nombre: 'Paciente de Prueba', fecha_nacimiento: '1950-01-02' },
  ] }), /fecha de nacimiento difiere/);
  assert.throws(() => buildImportPlan(source, { pacientes: [
    { id: patientId, nombre: 'Otra persona' },
  ] }), /otro nombre/);
});

test('database errors omit raw row details and secrets', async () => {
  const secret = 'confidential-token-and-patient';
  const client = { from() { return { upsert() { return { async select() {
    return { data: null, error: { code: '23503', message: secret, details: secret, hint: secret } };
  } }; } }; } };
  await assert.rejects(applyImportPlan(client, buildImportPlan(fixture())), (error) => {
    assert.match(error.message, /23503/);
    assert.equal(error.message.includes(secret), false);
    return true;
  });
});
