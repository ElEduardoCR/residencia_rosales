import test from 'node:test';
import assert from 'node:assert/strict';
import { filtrarHistorial, historialDeEventos, metricasHistorial, normalizarBusqueda, rangoMesHistorial, sumarDiasHistorial } from '../src/lib/historial.ts';
import { historialPrevio } from '../src/lib/historial-legacy.ts';

const jornada = {id:'noche',fecha:'2026-10-29',turno:'nocturno',inicio:'2026-10-30T02:00:00Z',fin:'2026-10-30T14:00:00Z'};
const base = {id:'original',raiz_id:'original',solicitud_id:'request',jornada_id:'noche',paciente_id:'ana',tipo:'glucosa',titulo:'Glucosa',detalle:null,valor:100,unidad:'mg/dL',contexto:'ayuno',ocurrido_at:'2026-10-30T03:00:00Z',personal_id:'enfermera',registrado_at:'2026-10-30T03:05:00Z',corrige_id:null,anulado:false,motivo_correccion:null,rutina_id:null,agenda_tarea_id:null,agenda_fecha:null,medicamento_id:null,dosis:null,cantidad:null};
const filtro = {desde:'2026-10-01',hasta:'2026-10-31',paciente:'',tipo:'',turno:'',texto:''};
let nextEntry = 0;
const entry = (extra={}) => ({id:`entry-${nextEntry++}`,paciente_id:'ana',tipo:'glucosa',titulo:'Glucosa',detalle:null,fecha:'2026-10-29',hora:'21:00',ocurrido_at:null,registrado_at:'2026-10-30T03:05:00Z',personal_id:'enfermera',turno:'nocturno',fuente:'Registro de turno',valor:100,contexto:'ayuno',...extra});

test('accent-insensitive text finds an incident from a month ago and respects patient/date/type/shift',()=>{
  assert.equal(normalizarBusqueda(' VÓMITO '),'vomito');
  const rows=[entry({tipo:'incidencia',titulo:'Vómito',fecha:'2026-09-29'}),entry({paciente_id:'otro',tipo:'incidencia',titulo:'Vómito',fecha:'2026-09-29'})];
  assert.equal(filtrarHistorial(rows,{...filtro,desde:'2026-09-01',hasta:'2026-09-30',paciente:'ana',texto:'vomito',tipo:'incidencia',turno:'nocturno'}).length,1);
  assert.equal(filtrarHistorial(rows,filtro).length,0);
});
test('correction chains show latest node plus original and never average replaced values',()=>{
  const correction={...base,id:'corrected',corrige_id:'original',valor:120,personal_id:'admin',registrado_at:'2026-10-31T13:00:00Z',motivo_correccion:'Error de captura'};
  const rows=historialDeEventos([correction,base],[jornada]);
  assert.equal(rows.length,1);assert.equal(rows[0].valor,120);assert.equal(rows[0].revisiones[0].personal_id,'enfermera');
  assert.equal(metricasHistorial(rows)[0].glucosa.promedio,120);assert.equal(metricasHistorial(rows)[0].glucosa.n,1);
});
test('annulled latest records remain auditable but do not contribute to metrics',()=>{
  const rows=historialDeEventos([base,{...base,id:'annulled',corrige_id:'original',anulado:true,motivo_correccion:'Registro duplicado'}],[jornada]);
  assert.equal(rows[0].anulado,true);assert.equal(rows[0].revisiones.length,1);assert.deepEqual(metricasHistorial(rows),[]);
});
test('a later correction moving the occurrence outside the chosen range removes the old value',()=>{
  const rows=historialDeEventos([base,{...base,id:'next',corrige_id:'original',ocurrido_at:'2026-11-01T15:00:00Z'}],[jornada]);
  assert.equal(filtrarHistorial(rows,filtro).length,0);
});
test('original note remains searchable with correction visibly attached',()=>{
  const rows=historialDeEventos([{...base,detalle:'Refiere vómito'}, {...base,id:'next',corrige_id:'original',detalle:'Captura corregida'}],[jornada]);
  assert.equal(filtrarHistorial(rows,{...filtro,texto:'vomito'}).length,1);
});
test('glucose summaries separate patients and contexts',()=>{
  const [ana,luis]=metricasHistorial([entry({valor:80}),entry({valor:120,contexto:'despues_comida'}),entry({paciente_id:'luis',valor:300})]);
  assert.equal(ana.glucosa.promedio,100);assert.equal(luis.glucosa.promedio,300);
  assert.equal(ana.glucosaContextos.length,2);assert.equal(ana.glucosaContextos[0].resumen.promedio,80);
});
test('Cistoflo uses total, number of emptyings and recorded days only, including real zero',()=>{
  const m=metricasHistorial([entry({tipo:'cistoflo',valor:0}),entry({tipo:'cistoflo',valor:200}),entry({tipo:'cistoflo',valor:400,fecha:'2026-10-30'})])[0];
  assert.equal(m.cistoflo.total,600);assert.equal(m.cistoflo.n,3);assert.equal(m.cistoflo.promedio,200);
  assert.equal(m.diasCistoflo,2);assert.equal(m.promedioCistofloDia,300);
});
test('sleep includes zero nights, excludes absent observations and counts the recorded night across midnight',()=>{
  const events=historialDeEventos([{...base,tipo:'sueno',valor:0,unidad:'h',ocurrido_at:'2026-10-30T12:00:00Z'}],[jornada]);
  assert.equal(events[0].noche,'2026-10-29');
  const m=metricasHistorial([...events,entry({tipo:'sueno',valor:8,noche:'2026-10-28'}),entry({tipo:'sueno',valor:null,noche:'2026-10-27'})])[0];
  assert.equal(m.sueno.n,2);assert.equal(m.sueno.promedio,4);
});
test('calendar presets handle leap months and crossing years',()=>{
  assert.deepEqual(rangoMesHistorial('2028-02'),{desde:'2028-02-01',hasta:'2028-02-29'});
  assert.equal(sumarDiasHistorial('2026-01-01',-1),'2025-12-31');
});
test('legacy notes stay text, without invented incidence, exact hour or author',()=>{
  const rows=historialPrevio({turnos:[{id:'old',paciente_id:'ana',fecha:'2026-09-29',turno:'nocturno',evacuaciones:0,orina:1,notas:'Presentó vómito',enfermero_id:null}],alimentacion:[],medicamentos:[],actividades:[],completadas:[],agenda:[],realizadas:[]});
  assert.equal(rows[0].tipo,'eliminacion');assert.equal(rows[0].hora,null);assert.equal(rows[0].personal_id,null);
  assert.equal(filtrarHistorial(rows,{...filtro,desde:'2026-09-01',hasta:'2026-09-30',texto:'vomito'}).length,1);
  assert.deepEqual(metricasHistorial(rows),[]);
});
test('legacy agenda medication and linked administration are one auditable event with recorded dose',()=>{
  const rows=historialPrevio({turnos:[],alimentacion:[],medicamentos:[{id:'med',agenda_realizacion_id:'done',paciente_id:'ana',fecha:'2026-10-29',dosis:'5 mg',medicamento_nombre:'Medicamento',enfermero_id:'enfermera'}],actividades:[],completadas:[],agenda:[{id:'task',paciente_id:'ana',tipo:'medicamento',titulo:'Medicamento'}],realizadas:[{id:'done',tarea_id:'task',fecha:'2026-10-29',realizada_at:'2026-10-30T03:00:00Z',personal_id:'enfermera',observaciones:null}]});
  assert.equal(rows.length,1);assert.equal(rows[0].tipo,'medicamento');assert.match(rows[0].detalle,/5 mg/);
});
