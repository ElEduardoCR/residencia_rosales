#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_SOURCE = resolve(PROJECT_ROOT, '.private-import/normalized-records.json');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TABLES = ['pacientes', 'personal', 'medicamentos_paciente'];

export class ImportError extends Error {}

// Deliberately no fuzzy matching: spelling, strengths and dose units are not corrected.
export function normalizeName(value) {
  return String(value ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .trim().replace(/\s+/g, ' ').toLocaleLowerCase('es');
}

function check(condition, message) {
  if (!condition) throw new ImportError(message);
}

function dateOrNull(value) {
  if (value == null || value === '') return null;
  check(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value), 'Hay una fecha incompleta o inválida en el archivo.');
  const date = new Date(`${value}T12:00:00Z`);
  check(!Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value, 'Hay una fecha inexistente en el archivo.');
  return value;
}

function textOrNull(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function lines(values) {
  return values.filter(Boolean).join('\n') || null;
}

function field(label, value) {
  return value == null || value === '' ? null : `${label}: ${value}`;
}

function patientCareNotes(patient) {
  // Some import files keep care instructions separately; preserve both representations.
  const notes = [
    ...(textOrNull(patient.notas)?.split(/\r?\n/) ?? []),
    ...(patient.indicaciones_cuidado ?? []).map((instruction) => instruction.texto_original),
  ].map(textOrNull).filter(Boolean);
  return lines([...new Set(notes)]);
}

function sourceLabel(source, reference) {
  const key = typeof reference === 'string' ? reference : reference?.documento;
  const name = source.fuentes?.[key] ?? key ?? 'Documento adjunto';
  const location = typeof reference === 'object' && reference
    ? [field('tabla', reference.tabla), field('fila', reference.fila)].filter(Boolean).join(', ')
    : '';
  return `${name}${location ? ` (${location})` : ''}`;
}

function validateSource(source) {
  check(source?.version === 1, 'Versión de importación no compatible.');
  check(Array.isArray(source.pacientes) && Array.isArray(source.personal), 'Faltan las listas de pacientes o personal.');
  const ids = new Set();
  for (const rows of [source.pacientes, source.personal]) {
    const names = new Set();
    for (const row of rows) {
      check(UUID.test(row.id ?? ''), 'Hay un identificador inválido en el archivo.');
      check(!ids.has(row.id), 'Hay identificadores duplicados en el archivo.');
      ids.add(row.id);
      const name = normalizeName(row.nombre);
      check(name && !names.has(name), 'Hay nombres vacíos o repetidos en el archivo; conciliar antes de importar.');
      names.add(name);
      dateOrNull(row.fecha_nacimiento);
    }
  }
  for (const patient of source.pacientes) {
    check(Array.isArray(patient.medicamentos), 'Falta una lista de medicamentos de paciente.');
    check(Array.isArray(patient.alergias) && Array.isArray(patient.enfermedades), 'Las alergias y enfermedades deben ser listas.');
    const names = new Set();
    for (const medication of patient.medicamentos) {
      check(UUID.test(medication.id ?? '') && !ids.has(medication.id), 'Hay un identificador de medicamento inválido o repetido.');
      ids.add(medication.id);
      const name = normalizeName(medication.medicamento_nombre);
      check(name && !names.has(name), 'Hay medicamentos vacíos o repetidos para un mismo paciente.');
      names.add(name);
      check(textOrNull(medication.texto_original), 'Un medicamento no tiene transcripción original.');
    }
  }
}

function identityIndex(rows, table) {
  const byId = new Map();
  const byName = new Map();
  for (const row of rows) {
    check(UUID.test(row.id ?? ''), `Identificador existente inválido en ${table}.`);
    byId.set(row.id, row);
    const key = normalizeName(row.nombre);
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(row);
  }
  return { byId, byName };
}

function existingIdentity(row, index, table) {
  const byId = index.byId.get(row.id);
  const matches = index.byName.get(normalizeName(row.nombre)) ?? [];
  check(matches.length <= 1, `Hay nombres existentes ambiguos en ${table}; conciliar antes de importar.`);
  if (byId) {
    check(normalizeName(byId.nombre) === normalizeName(row.nombre), `Un identificador existente pertenece a otro nombre en ${table}.`);
    check(!matches.length || matches[0].id === byId.id, `Hay una identidad duplicada en ${table}.`);
  }
  const found = byId ?? matches[0];
  if (table === 'pacientes' && found?.fecha_nacimiento && row.fecha_nacimiento) {
    check(found.fecha_nacimiento === row.fecha_nacimiento, 'Un nombre de paciente coincide pero su fecha de nacimiento difiere.');
  }
  return found;
}

/** Pure planner. Existing rows are preserved, never updated or reactivated. */
export function buildImportPlan(source, existing = {}) {
  validateSource(source);
  const plan = Object.fromEntries(TABLES.map((table) => [table, []]));
  const expectedIds = Object.fromEntries(TABLES.map((table) => [table, []]));
  const skipped = Object.fromEntries(TABLES.map((table) => [table, 0]));
  const patientIndex = identityIndex(existing.pacientes ?? [], 'pacientes');
  const staffIndex = identityIndex(existing.personal ?? [], 'personal');
  const patientIds = new Map();

  for (const patient of source.pacientes) {
    const found = existingIdentity(patient, patientIndex, 'pacientes');
    const id = found?.id ?? patient.id;
    patientIds.set(patient.id, id);
    expectedIds.pacientes.push(id);
    if (found) { skipped.pacientes++; continue; }
    plan.pacientes.push({
      id,
      nombre: patient.nombre,
      fecha_nacimiento: dateOrNull(patient.fecha_nacimiento),
      sexo: patient.sexo ?? null,
      tipo_sangre: patient.tipo_sangre ?? null,
      alergias: patient.alergias,
      enfermedades: patient.enfermedades,
      tutor_nombre: patient.tutor_nombre ?? null,
      tutor_parentesco: patient.tutor_parentesco ?? null,
      tutor_contacto: patient.tutor_contacto ?? null,
      peso: patient.peso ?? null,
      talla: patient.talla ?? null,
      estatura: patient.estatura ?? null,
      activo: true,
      notas: lines([
        field('Fuente documental', sourceLabel(source, patient.fuente_principal)),
        field('Fecha de importación documental', source.fecha_extraccion),
        patient.requiere_revision ? 'Requiere revisión documental. Verificar vigencia e indicaciones antes de administrar.' : null,
        field('Edad escrita en la fuente (no se usa para calcular la edad)', patient.edad_texto_original),
        field('Alergias, transcripción original', patient.alergias_texto_original),
        field('Responsable, transcripción original', patient.responsable_texto_original),
        field('Nombre del responsable en actualización', patient.tutor_nombre_octubre),
        patientCareNotes(patient),
        'Información transcrita de documentos; no sustituye una indicación médica validada.',
      ]),
    });
  }

  for (const person of source.personal) {
    const found = existingIdentity(person, staffIndex, 'personal');
    expectedIds.personal.push(found?.id ?? person.id);
    if (found) { skipped.personal++; continue; }
    plan.personal.push({
      id: person.id,
      nombre: person.nombre,
      user_id: null,
      rol: 'enfermero',
      puesto: person.puesto ?? null,
      turno: person.turno ?? null,
      telefono: person.telefono ?? null,
      email: person.email ?? null,
      direccion: person.direccion ?? null,
      contacto_emergencia: person.contacto_emergencia ?? null,
      contacto_emergencia_tel: person.contacto_emergencia_tel ?? null,
      cedula: person.cedula ?? null,
      activo: true,
      notas: lines([
        field('Fuente documental', sourceLabel(source, person.fuente)),
        field('Titulación / escolaridad (texto original)', person.titulacion),
        field('Fecha de nacimiento', dateOrNull(person.fecha_nacimiento)),
        field('Edad escrita en la fuente', person.edad_texto_original),
        field('Estado civil', person.estado_civil),
        field('Número de hijos', person.hijos),
        field('Edades de hijos (texto original)', person.edades_hijos_texto),
        field('Municipio', person.municipio),
        field('Estado', person.estado),
        'Perfil de personal sin cuenta de acceso. El rol técnico por defecto no acredita profesión ni asigna un puesto.',
      ]),
    });
  }

  const medicationIds = new Map();
  const medicationNames = new Map();
  for (const medication of existing.medicamentos_paciente ?? []) {
    medicationIds.set(medication.id, medication);
    const key = `${medication.paciente_id}:${normalizeName(medication.medicamento_nombre)}`;
    if (!medicationNames.has(key)) medicationNames.set(key, []);
    medicationNames.get(key).push(medication);
  }
  for (const patient of source.pacientes) {
    const patientId = patientIds.get(patient.id);
    for (const medication of patient.medicamentos) {
      const key = `${patientId}:${normalizeName(medication.medicamento_nombre)}`;
      const matches = medicationNames.get(key) ?? [];
      const byId = medicationIds.get(medication.id);
      check(matches.length <= 1, 'Hay medicamentos existentes duplicados para un paciente; conciliar antes de importar.');
      if (byId) {
        check(byId.paciente_id === patientId && normalizeName(byId.medicamento_nombre) === normalizeName(medication.medicamento_nombre), 'Un identificador de medicamento existente pertenece a otra indicación.');
        check(!matches.length || matches[0].id === byId.id, 'Hay una indicación existente duplicada.');
      }
      const found = byId ?? matches[0];
      expectedIds.medicamentos_paciente.push(found?.id ?? medication.id);
      if (found) { skipped.medicamentos_paciente++; continue; }
      plan.medicamentos_paciente.push({
        id: medication.id,
        paciente_id: patientId,
        inventario_id: null,
        medicamento_nombre: medication.medicamento_nombre,
        dosis: textOrNull(medication.dosis),
        frecuencia: textOrNull(medication.frecuencia),
        turnos: [],
        presentacion: medication.presentacion ?? null,
        cantidad: medication.cantidad ?? 0,
        minimo: medication.minimo ?? 0,
        maximo: medication.maximo ?? null,
        lugar_compra: medication.lugar_compra ?? null,
        activo: true,
        notas: lines([
          'Requiere revisión documental. Sin turnos programados; validar la indicación antes de administrar.',
          field('Fuente documental', sourceLabel(source, medication.fuente)),
          field('Texto original', medication.texto_original),
          ...(medication.alertas ?? []).map((alert) => field('Observación documental', alert.detalle)),
          patient.fuente_principal === 'fichas' ? 'Vigencia pendiente: el paciente no aparece en la actualización de octubre de 2026.' : null,
          medication.cantidad == null || medication.minimo == null
            ? 'Existencias no verificadas. Los valores 0 de cantidad/mínimo son valores técnicos obligatorios; no representan un conteo físico.'
            : null,
          'No se infieren unidades, vías, concentraciones ni horas no documentadas.',
        ]),
      });
    }
  }
  return { rows: plan, expectedIds, skipped };
}

export function summarizePlan(plan) {
  return {
    por_insertar: Object.fromEntries(TABLES.map((table) => [table, plan.rows[table].length])),
    existentes_conservados: plan.skipped,
    medicamentos_sin_programar: plan.rows.medicamentos_paciente.length,
  };
}

function remoteError(error, operation, table) {
  // Postgres details/hints can include row contents; never print them or credentials.
  const code = /^[A-Z0-9_]{1,20}$/i.test(error?.code ?? '') ? ` (${error.code})` : '';
  return new ImportError(`No se pudo ${operation} ${table}${code}. Verifica conexión, permisos y migraciones. Una ejecución parcial puede reintentarse sin sobrescribir registros.`);
}

export async function readExisting(client) {
  const columns = {
    pacientes: 'id,nombre,fecha_nacimiento',
    personal: 'id,nombre',
    medicamentos_paciente: 'id,paciente_id,medicamento_nombre',
  };
  const existing = {};
  for (const table of TABLES) {
    existing[table] = [];
    for (let start = 0; ; start += 1000) {
      const { data, error } = await client.from(table).select(columns[table]).order('id').range(start, start + 999);
      if (error) throw remoteError(error, 'consultar', table);
      existing[table].push(...data);
      if (data.length < 1000) break;
    }
  }
  return existing;
}

export async function applyImportPlan(client, plan) {
  const inserted = Object.fromEntries(TABLES.map((table) => [table, 0]));
  for (const table of TABLES) {
    for (let start = 0; start < plan.rows[table].length; start += 100) {
      const rows = plan.rows[table].slice(start, start + 100);
      const { data, error } = await client.from(table)
        .upsert(rows, { onConflict: 'id', ignoreDuplicates: true }).select('id');
      if (error) throw remoteError(error, 'importar', table);
      inserted[table] += data?.length ?? 0;
    }
  }
  for (const table of TABLES) {
    for (let start = 0; start < plan.expectedIds[table].length; start += 100) {
      const ids = plan.expectedIds[table].slice(start, start + 100);
      const { data, error } = await client.from(table).select('id').in('id', ids);
      if (error) throw remoteError(error, 'verificar', table);
      check(new Set(data.map((row) => row.id)).size === ids.length, `La verificación de ${table} no coincide con lo esperado. Puede reintentarse la importación.`);
    }
  }
  return inserted;
}

export function parseArguments(args) {
  const options = { apply: false, checkRemote: false, file: DEFAULT_SOURCE };
  let explicitDryRun = false;
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--apply') options.apply = true;
    else if (args[index] === '--dry-run') explicitDryRun = true;
    else if (args[index] === '--check-remote') options.checkRemote = true;
    else if (args[index] === '--file') {
      check(args[index + 1] && !args[index + 1].startsWith('--'), 'Falta la ruta del archivo para --file.');
      options.file = resolve(args[++index]);
    } else throw new ImportError('Opción no reconocida. Usa --dry-run, --check-remote, --apply o --file.');
  }
  check(!(options.apply && explicitDryRun), 'Usa --dry-run o --apply, no ambos.');
  return options;
}

export async function main(args = process.argv.slice(2)) {
  const options = parseArguments(args);
  let source;
  try { source = JSON.parse(await readFile(options.file, 'utf8')); }
  catch { throw new ImportError('No se pudo leer el archivo JSON privado de importación. Revisa que exista y tenga JSON válido.'); }
  // Validate locally before reading credentials or contacting the project.
  let plan = buildImportPlan(source);
  let client;
  if (options.apply || options.checkRemote) {
    const { default: nextEnv } = await import('@next/env');
    nextEnv.loadEnvConfig(PROJECT_ROOT, true, { info() {}, error() {} });
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    check(url && key, 'Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local. La simulación local funciona sin credenciales.');
    let parsed;
    try { parsed = new URL(url); } catch { throw new ImportError('La URL configurada de Supabase no es válida.'); }
    check(parsed.protocol === 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname), 'Se requiere HTTPS para enviar datos a Supabase.');
    const { createClient } = await import('@supabase/supabase-js');
    client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    plan = buildImportPlan(source, await readExisting(client));
  }
  const summary = summarizePlan(plan);
  if (options.apply) {
    const inserted = await applyImportPlan(client, plan);
    process.stdout.write(`${JSON.stringify({ modo: 'aplicado_y_verificado', ...summary, insertados: inserted }, null, 2)}\n`);
  } else {
    process.stdout.write(`${JSON.stringify({ modo: options.checkRemote ? 'simulacion_con_lectura_remota' : 'simulacion_local', ...summary, escritura_realizada: false }, null, 2)}\n`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof ImportError ? error.message : 'No se completó la importación. Revisa el archivo, la conexión y la configuración local.'}\n`);
    process.exitCode = 1;
  });
}
