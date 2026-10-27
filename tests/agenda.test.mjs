import test from 'node:test';
import assert from 'node:assert/strict';
import {fechaAgendaValida,fechaHoraAgenda,minutosAgenda,tareaOcurreEnFecha,estadoTareaAgenda,validarNuevaTareaAgenda} from '../src/lib/agenda.ts';

const patient='11111111-1111-4111-8111-111111111111';
const medication='22222222-2222-4222-8222-222222222222';
const task={id:'task',paciente_id:patient,tipo:'terapia',titulo:'Movilidad asistida',descripcion:null,hora:'09:30:00',fecha_inicio:'2026-10-27',fecha_fin:null,dias_semana:[2,4],medicamento_id:null,activo:true,archivada_at:null,creado_por:null,created_at:'2026-10-27T12:00:00Z'};
const input={pacienteIds:[patient],tipo:'terapia',titulo:' Movilidad asistida ',hora:'09:30',fecha_inicio:'2026-10-27',dias_semana:[4,2]};

test('calendar dates reject impossible and malformed dates',()=>{
  for(const value of ['2026-02-29','2026-04-31','2026-1-01','',null,42]) assert.equal(fechaAgendaValida(value),false);
  assert.equal(fechaAgendaValida('2028-02-29'),true);
});
test('residence midnight does not depend on browser timezone',()=>{
  assert.deepEqual(fechaHoraAgenda('2026-10-28T05:59:00Z'),{fecha:'2026-10-27',minutos:1439});
  assert.deepEqual(fechaHoraAgenda('2026-10-28T06:00:00Z'),{fecha:'2026-10-28',minutos:0});
});
test('occurrences use chosen weekday and date boundaries',()=>{
  assert.equal(tareaOcurreEnFecha(task,'2026-10-27'),true);
  assert.equal(tareaOcurreEnFecha(task,'2026-10-28'),false);
  assert.equal(tareaOcurreEnFecha(task,'2026-10-22'),false);
  assert.equal(tareaOcurreEnFecha({...task,fecha_fin:'2026-10-27'},'2026-10-29'),false);
});
test('archiving preserves past occurrences but removes later ones',()=>{
  const archived={...task,activo:false,archivada_at:'2026-10-29T16:00:00Z'};
  assert.equal(tareaOcurreEnFecha(archived,'2026-10-27'),true);
  assert.equal(tareaOcurreEnFecha(archived,'2026-10-29'),true);
  assert.equal(tareaOcurreEnFecha(archived,'2026-11-03'),false);
});
test('status advances with clock, respects day, and only accepts matching completion',()=>{
  const now='2026-10-27T15:31:00Z';
  assert.equal(estadoTareaAgenda(task,'2026-10-27',null,'2026-10-27T15:30:00Z'),'pendiente');
  assert.equal(estadoTareaAgenda(task,'2026-10-27',null,now),'vencida');
  assert.equal(estadoTareaAgenda(task,'2026-10-29',null,now),'pendiente');
  assert.equal(estadoTareaAgenda(task,'2026-10-27',{tarea_id:'other',fecha:'2026-10-27'},now),'vencida');
  assert.equal(estadoTareaAgenda(task,'2026-10-27',{tarea_id:'task',fecha:'2026-10-27'},now),'completada');
});
test('hour parsing handles midnight and database seconds but rejects impossible hours',()=>{
  assert.equal(minutosAgenda('00:00:00'),0);assert.equal(minutosAgenda('23:59'),1439);
  for(const value of ['24:00','9:30','08:99','invalid'])assert.equal(Number.isNaN(minutosAgenda(value)),true);
});
test('new schedules require explicit dates, weekdays, patient and valid time',()=>{
  assert.equal(validarNuevaTareaAgenda({...input,fecha_inicio:'2026-10-26'},'2026-10-27').value,undefined);
  for(const changes of [{pacienteIds:[]},{dias_semana:[7]},{dias_semana:[null]},{hora:'24:00'},{fecha_fin:false},{fecha_fin:'2026-10-26'},{titulo:'  '}]) {
    assert.ok(validarNuevaTareaAgenda({...input,...changes},'2026-10-27').error);
  }
  const value=validarNuevaTareaAgenda({...input,pacienteIds:[patient,patient]},'2026-10-27').value;
  assert.deepEqual(value.pacienteIds,[patient]);assert.deepEqual(value.dias_semana,[2,4]);assert.equal(value.titulo,'Movilidad asistida');
});
test('a one-off date must match at least one chosen weekday',()=>{
  assert.ok(validarNuevaTareaAgenda({...input,fecha_fin:'2026-10-27',dias_semana:[1]},'2026-10-27').error);
  assert.ok(validarNuevaTareaAgenda({...input,fecha_fin:'2026-10-27'},'2026-10-27').value);
});
test('medication scheduling requires one patient and an explicit medication',()=>{
  assert.ok(validarNuevaTareaAgenda({...input,tipo:'medicamento'},'2026-10-27').error);
  assert.ok(validarNuevaTareaAgenda({...input,tipo:'medicamento',medicamento_id:medication},'2026-10-27').value);
  assert.ok(validarNuevaTareaAgenda({...input,medicamento_id:medication},'2026-10-27').error);
});
