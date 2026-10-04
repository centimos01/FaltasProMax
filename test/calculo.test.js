/*
 * Tests de la lógica de cálculo de FaltasProMax.
 * Ejecutar con:  node --test
 * Sin argumentos: `node --test test/` falla en Windows.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../calculo.js');

/* ------------------------------------------------------------------ *
 * presupuestoHoras — el 20% de la duración total del módulo
 * ------------------------------------------------------------------ */

test('presupuestoHoras: el 20% de la duración total del módulo', () => {
  assert.equal(C.presupuestoHoras(60), 12);
  assert.equal(C.presupuestoHoras(100), 20);
  assert.equal(C.presupuestoHoras(200), 40);
  assert.equal(C.presupuestoHoras(240), 48);
});

test('presupuestoHoras: redondea hacia abajo, nunca hacia arriba', () => {
  // 96 h -> 19,2 h de margen. 19 es lo que se puede faltar con seguridad.
  assert.equal(C.presupuestoHoras(96), 19);
  // 57 h -> 11,4 h
  assert.equal(C.presupuestoHoras(57), 11);
  // 96,5 h
  assert.equal(C.presupuestoHoras(96.5), 19);
});

test('presupuestoHoras: sin error de coma flotante en resultados enteros', () => {
  // 100 * 0.2 === 20.000000000000004 en coma flotable: el floor naïve falla.
  // Por eso se multiplica antes de dividir.
  for (const h of [5, 10, 25, 40, 50, 55, 70, 90, 105, 110, 150, 160, 200, 240, 300]) {
    assert.equal(
      C.presupuestoHoras(h),
      Math.floor((h * 20) / 100),
      `horas=${h}`
    );
    assert.equal(C.presupuestoHoras(h) % 1, 0, `horas=${h} debe ser entero`);
  }
});

test('presupuestoHoras: entradas degeneradas devuelven 0', () => {
  assert.equal(C.presupuestoHoras(0), 0);
  assert.equal(C.presupuestoHoras(-50), 0);
  assert.equal(C.presupuestoHoras(NaN), 0);
  assert.equal(C.presupuestoHoras(undefined), 0);
  assert.equal(C.presupuestoHoras(Infinity), 0);
});

/* ------------------------------------------------------------------ *
 * El límite legal del 80% — el caso que motiva el redondeo
 * ------------------------------------------------------------------ */

test('límite legal: en un módulo de 96 h, 19 faltas son legales y 20 no', () => {
  const horas = 96;

  const alLimite = C.evaluarModulo(
    { nombre: 'X', horasTotales: horas, injustificadas: 19 },
    {}
  );
  assert.equal(alLimite.conservaEvaluacionContinua, true);
  assert.equal(alLimite.asistenciaMinima, 77);
  // Asiste 96 - 19 = 77 h -> 77/96 = 80,2%
  assert.ok((horas - 19) / horas >= 0.8);

  const excedido = C.evaluarModulo(
    { nombre: 'X', horasTotales: horas, injustificadas: 20 },
    {}
  );
  assert.equal(excedido.conservaEvaluacionContinua, false);
  assert.equal(excedido.excedenteHoras, 1);
  assert.equal(excedido.riesgo, 'perdida');
  // Asiste 76 h -> 76/96 = 79,2%
  assert.ok((horas - 20) / horas < 0.8);
});

test('asistenciaMinimaHoras: es el complemento exacto del presupuesto', () => {
  for (const h of [60, 96, 100, 200, 240]) {
    const r = C.evaluarModulo({ horasTotales: h }, {});
    assert.equal(r.asistenciaMinima + r.presupuestoHoras, h);
  }
});

/* ------------------------------------------------------------------ *
 * Justificadas vs. injustificadas
 * ------------------------------------------------------------------ */

test('las inasistencias injustificadas siempre consumen presupuesto', () => {
  for (const justificadasCuentan of [true, false]) {
    const r = C.evaluarModulo(
      { horasTotales: 200, justificadas: 30, injustificadas: 5 },
      { justificadasCuentan }
    );
    // 5 injustificadas dentro del presupuesto de 40 -> conserva
    assert.equal(r.conservaEvaluacionContinua, true);
    assert.equal(r.inasistenciasComputan, justificadasCuentan ? 35 : 5);
  }
});

test('las justificadas sólo consumen presupuesto si el centro las cuenta', () => {
  const mod = { horasTotales: 100, justificadas: 25, injustificadas: 0 };

  const contando = C.evaluarModulo(mod, { justificadasCuentan: true });
  assert.equal(contando.inasistenciasComputan, 25);
  assert.equal(contando.conservaEvaluacionContinua, false); // 25 > 20
  assert.equal(contando.riesgo, 'perdida');

  const sinContar = C.evaluarModulo(mod, { justificadasCuentan: false });
  assert.equal(sinContar.inasistenciasComputan, 0);
  assert.equal(sinContar.conservaEvaluacionContinua, true);
  assert.equal(sinContar.soldeadasHoras, 20);
});

/* ------------------------------------------------------------------ *
 * Clasificación de riesgo
 * ------------------------------------------------------------------ */

test('clasificarRiesgo: los cortes son 50% y 80% de presupuesto consumido', () => {
  assert.equal(C.clasificarRiesgo(0, true), 'ok');
  assert.equal(C.clasificarRiesgo(49.9, true), 'ok');
  assert.equal(C.clasificarRiesgo(50, true), 'aviso');
  assert.equal(C.clasificarRiesgo(79.9, true), 'aviso');
  assert.equal(C.clasificarRiesgo(80, true), 'limite');
  assert.equal(C.clasificarRiesgo(100, true), 'limite');
  assert.equal(C.clasificarRiesgo(100.1, true), 'perdida');
  // Perdida manda aunque el porcentaje sea bajo (no debería ocurrir, pero el
  // orden de las comprobaciones debe ser estable).
  assert.equal(C.clasificarRiesgo(1, false), 'perdida');
});

test('riesgo de un módulo en cada franja', () => {
  // Módulo de 200 h -> presupuesto de 40 h.
  const mk = (injust) =>
    C.evaluarModulo({ horasTotales: 200, injustificadas: injust }, {}).riesgo;

  assert.equal(mk(0), 'ok'); //    0 % 
  assert.equal(mk(16), 'ok'); //  40 %
  assert.equal(mk(19), 'ok'); //  47,5 %
  assert.equal(mk(20), 'aviso'); //  50 % -> aviso
  assert.equal(mk(31), 'aviso'); //  77,5 %
  assert.equal(mk(32), 'limite'); //  80 % -> límite
  assert.equal(mk(39), 'limite'); //  97,5 %
  assert.equal(mk(40), 'limite'); // 100 % justo, aún conserva
  assert.equal(mk(41), 'perdida'); // 102,5 % -> perdida
});

/* ------------------------------------------------------------------ *
 * Conversión a jornadas y semanas
 * ------------------------------------------------------------------ */

test('desglosarHoras: 19 h con jornadas de 6 h son 3 completas + 1 h', () => {
  const d = C.desglosarHoras(19, { horasPorDia: 6, diasLectivosPorSemana: 5 });
  assert.equal(d.jornadasCompletas, 3);
  assert.equal(d.horasRestantes, 1);
  assert.equal(d.horasPorSemana, 30);
  assert.equal(d.semanasLectivas, 19 / 30);
});

test('desglosarHoras: una jornada parcial no cuenta como día libre', () => {
  const d = C.desglosarHoras(17, { horasPorDia: 6 });
  assert.equal(d.jornadasCompletas, 2); // 12 h, no 17/6 = 2,83 -> 3
  assert.equal(d.horasRestantes, 5);
});

test('desglosarHoras: defaults sensatos si no vienen opciones', () => {
  const d = C.desglosarHoras(30);
  assert.equal(d.horasPorDia, 6);
  assert.equal(d.diasLectivosPorSemana, 5);
  assert.equal(d.horasPorSemana, 30);
  assert.equal(d.jornadasCompletas, 5);
  assert.equal(d.horasRestantes, 0);
  assert.equal(d.semanasLectivas, 1);
});

test('desglosarHoras: semanas y meses aproximados', () => {
  const d = C.desglosarHoras(120, { horasPorDia: 6, diasLectivosPorSemana: 5 });
  assert.equal(d.semanasLectivas, 4);
  assert.equal(d.mesesAproximados, 1);
});

test('desglosarHoras: no produce negativos ni NaN', () => {
  const d = C.desglosarHoras(-10, {});
  assert.equal(d.horas, 0);
  assert.equal(d.jornadasCompletas, 0);
  assert.equal(d.horasRestantes, 0);
  assert.equal(d.semanasLectivas, 0);
});

/* ------------------------------------------------------------------ *
 * Proyección (modo C)
 * ------------------------------------------------------------------ */

test('proyectar: devuelve null si no hay horas transcurridas', () => {
  assert.equal(C.proyectar({ horasTotales: 200, injustificadas: 4 }, {}), null);
  assert.equal(C.proyectar({ horasTotales: 200, horasTranscurridas: 0 }, {}), null);
  assert.equal(C.proyectar({ horasTotales: 0, horasTranscurridas: 50 }, {}), null);
});

test('proyectar: ritmo dentro de presupuesto', () => {
  // 200 h totales, 100 h ya transcurridas, 10 faltas -> 20 proyectadas = justo
  const p = C.proyectar(
    { horasTotales: 200, horasTranscurridas: 100, injustificadas: 10 },
    {}
  );
  assert.equal(p.proyeccionHoras, 20);
  assert.equal(p.presupuestoHoras, 40);
  assert.equal(p.dentroDePresupuesto, true);
  assert.equal(p.margenReal, 20);
  assert.equal(p.horasPendientes, 100);
});

test('proyectar: avisa cuando el ritmo acaba en exceso', () => {
  // 200 h totales, 100 h transcurridas, 30 faltas -> 60 proyectadas > 40
  const p = C.proyectar(
    { horasTotales: 200, horasTranscurridas: 100, injustificadas: 30 },
    {}
  );
  assert.equal(p.proyeccionHoras, 60);
  assert.equal(p.dentroDePresupuesto, false);
  assert.equal(p.margenReal, -20);
});

test('proyectar: sin faltas consumidas la proyección es cero', () => {
  const p = C.proyectar({ horasTotales: 120, horasTranscurridas: 60 }, {});
  assert.equal(p.proyeccionHoras, 0);
  assert.equal(p.dentroDePresupuesto, true);
});

/* ------------------------------------------------------------------ *
 * Curso completo
 * ------------------------------------------------------------------ */

test('evaluarCurso: suma horas y presupuesta el agregado', () => {
  const r = C.evaluarCurso(
    [
      { nombre: 'A', horasTotales: 200 },
      { nombre: 'B', horasTotales: 60 },
      { nombre: 'C', horasTotales: 40 },
    ],
    {}
  );
  assert.equal(r.totalHoras, 300);
  assert.equal(r.presupuestoGlobalHoras, 60); // 20% de 300
  assert.equal(r.modulos.length, 3);
});

test('evaluarCurso: el presupuesto global NO protege al que se pasa en un módulo', () => {
  const r = C.evaluarCurso(
    [
      { nombre: 'Corto', horasTotales: 60, injustificadas: 15 }, // 15 > 12 -> pierde
      { nombre: 'Largo', horasTotales: 240, injustificadas: 20 }, // 20 <= 48 -> conserva
    ],
    {}
  );

  // Globalmente: 35 de 60 de presupuesto. En apariencia vas bien.
  assert.equal(r.presupuestoGlobalHoras, 60);
  assert.equal(r.margenGlobalHoras, 25);
  assert.equal(r.margenGlobalHoras, 60 - (15 + 20));

  // Pero el módulo corto ya ha perdido la evaluación continua.
  assert.equal(r.modulosPerdidos.length, 1);
  assert.equal(r.modulosPerdidos[0].nombre, 'Corto');
  assert.equal(r.modulos[1].conservaEvaluacionContinua, true);
});

test('evaluarCurso: moduloCritico es el más consumido; a igualdad, el más corto', () => {
  const r = C.evaluarCurso(
    [
      { nombre: 'Largo medio', horasTotales: 240, injustificadas: 24 }, // 50%
      { nombre: 'Corto medio', horasTotales: 60, injustificadas: 6 }, //   50%
      { nombre: 'Tranquilo', horasTotales: 200, injustificadas: 1 }, // 2,5%
    ],
    {}
  );
  // Empate al 50%: gana el de menos horas.
  assert.equal(r.moduloCritico.nombre, 'Corto medio');
});

test('evaluarCurso: tolera entradas vacías o no-array', () => {
  assert.equal(C.evaluarCurso([], {}).totalHoras, 0);
  assert.equal(C.evaluarCurso(null, {}).modulos.length, 0);
  assert.equal(C.evaluarCurso(undefined, {}).moduloCritico, null);
});

test('evaluarCurso: módulos sin horas no cuentan ni aparecen como perdidos', () => {
  const r = C.evaluarCurso(
    [
      { nombre: 'Sin datos', horasTotales: 0, injustificadas: 99 },
      { nombre: 'Real', horasTotales: 100 },
    ],
    {}
  );
  assert.equal(r.totalHoras, 100);
  assert.equal(r.modulosPerdidos.length, 0);
  assert.equal(r.modulos[0].riesgo, 'vacio');
  assert.equal(r.modulos[0].existe, false);
});

/* ------------------------------------------------------------------ *
 * Días hábiles — anulación de oficio (art. 9.1)
 * ------------------------------------------------------------------ */

test('evaluarDiasHabiles: convierte injustificadas a jornadas', () => {
  const ev = [C.evaluarModulo({ horasTotales: 200, injustificadas: 60 }, {})];
  const r = C.evaluarDiasHabiles(ev, { horasPorDia: 6 });
  assert.equal(r.diasHabilesExactos, 10); // 60 h / 6 h
  assert.equal(r.diasHabiles, 10);
  assert.equal(r.limite, 45);
  assert.equal(r.diasRestantes, 35);
  assert.equal(r.enRiesgo, false);
});

test('evaluarDiasHabiles: 45 días hábiles marca riesgo de anulación', () => {
  const ev = [C.evaluarModulo({ horasTotales: 2000, injustificadas: 270 }, {})];
  const r = C.evaluarDiasHabiles(ev, { horasPorDia: 6 }); // 270 / 6 = 45
  assert.equal(r.diasHabiles, 45);
  assert.equal(r.diasRestantes, 0);
  assert.equal(r.enRiesgo, true);
});

test('evaluarDiasHabiles: no puede quedar negativo', () => {
  const ev = [C.evaluarModulo({ horasTotales: 2000, injustificadas: 900 }, {})];
  const r = C.evaluarDiasHabiles(ev, { horasPorDia: 6 });
  assert.equal(r.diasRestantes, 0);
  assert.equal(r.enRiesgo, true);
});

/* ------------------------------------------------------------------ *
 * Metadatos de los modos — sólo A es legal
 * ------------------------------------------------------------------ */

test('MODOS: exactamente un modo marcado como legal, y es el A', () => {
  const legales = Object.values(C.MODOS).filter((m) => m.legal);
  assert.equal(legales.length, 1);
  assert.equal(legales[0].id, 'A');
});

test('MODOS: los tres modos tienen metadatos completos', () => {
  for (const id of ['A', 'B', 'C']) {
    const m = C.MODOS[id];
    assert.ok(m, `falta el modo ${id}`);
    for (const campo of ['titulo', 'criterio', 'resumen', 'detalle']) {
      assert.equal(typeof m[campo], 'string', `${id}.${campo}`);
      assert.ok(m[campo].length > 0, `${id}.${campo} vacío`);
    }
    assert.equal(typeof m.legal, 'boolean');
  }
});

test('MODOS: B y C declaran explícitamente que no son legales', () => {
  assert.equal(C.MODOS.B.legal, false);
  assert.equal(C.MODOS.C.legal, false);
  assert.match(C.MODOS.B.criterio, /Orientativo/i);
  assert.match(C.MODOS.C.criterio, /Atajo/i);
});

/* ------------------------------------------------------------------ *
 * Constantes normativas expuestas
 * ------------------------------------------------------------------ */

test('constantes: 80% mínimo de asistencia y 45 días hábiles', () => {
  assert.equal(C.ASISTENCIA_MINIMA_PORCENTAJE, 80);
  assert.equal(C.INASISTENCIA_MAXIMA_PORCENTAJE, 20);
  assert.equal(C.DIAS_HABILES_ANULACION_OFICIO, 45);
  assert.equal(
    C.ASISTENCIA_MINIMA_PORCENTAJE + C.INASISTENCIA_MAXIMA_PORCENTAJE,
    100
  );
});