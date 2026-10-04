/*
 * Tests de la exportación y la importación de la ficha.
 * Ejecutar con:  node --test
 * Sin argumentos: `node --test test/` falla en Windows.
 *
 * Estas funciones son la única parte de la calculadora que lee datos de fuera:
 * un archivo puede estar corrupto, editado a mano o hecho a propósito. Por eso
 * se prueban los tres estados (correcto, válido y corrupto) y no sólo el bueno.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../guardado.js');

/* Una ficha con de todo: números, un cero, un vacío y un texto con tilde. */
const FICHA = {
  modo: 'A',
  horasPorDia: 6,
  diasLectivosPorSemana: 5,
  justificadasCuentan: true,
  modulos: [
    {
      nombre: 'Lenguaje y Práctica Musical',
      horasTotales: 96,
      justificadas: 2,
      injustificadas: 6,
      horasTranscurridas: ''
    },
    {
      nombre: 'Historia de la Música',
      horasTotales: 64,
      justificadas: 0,
      injustificadas: 5,
      horasTranscurridas: 40
    }
  ]
};

const Clonar = (o) => JSON.parse(JSON.stringify(o));

/* ------------------------------------------------------------------ *
 * aTexto — exportar
 * ------------------------------------------------------------------ */

test('aTexto: produce un JSON que se puede volver a leer', () => {
  const texto = G.aTexto(FICHA);
  assert.equal(typeof texto, 'string');
  assert.doesNotThrow(() => JSON.parse(texto));
});

test('aTexto: no modifica la ficha que se le pasa', () => {
  const antes = Clonar(FICHA);
  G.aTexto(FICHA);
  assert.deepEqual(FICHA, antes);
});

test('aTexto: lleva la etiqueta de formato y la versión', () => {
  const datos = JSON.parse(G.aTexto(FICHA));
  assert.equal(datos.formato, G.FORMATO);
  assert.equal(datos.version, G.VERSION);
});

test('aTexto: lleva la fecha de exportación como AAAA-MM-DD', () => {
  const datos = JSON.parse(G.aTexto(FICHA));
  assert.match(datos.exportado, /^\d{4}-\d{2}-\d{2}$/);
});

test('aTexto: guarda las horas del módulo, no los resultados calculados', () => {
  const datos = JSON.parse(G.aTexto(FICHA));
  assert.equal(datos.modulos.length, 2);
  assert.equal(datos.modulos[0].horasTotales, 96);
  // Nada de lo que se calcula: si se guardara, al importar podría quedar viejo.
  for (const clave of ['presupuesto', 'margen', 'resultado', 'riesgo', 'conserva']) {
    assert.equal(datos.modulos[0][clave], undefined, `no debe guardar ${clave}`);
  }
});

/* ------------------------------------------------------------------ *
 * Ida y vuelta: lo que se exporta se importa igual
 * ------------------------------------------------------------------ */

test('ida y vuelta: una ficha completa vuelve idéntica', () => {
  const r = G.desdeTexto(G.aTexto(FICHA));
  assert.equal(r.ok, true, r.error);
  assert.deepEqual(r.estado, FICHA);
});

test('ida y vuelta: una ficha sin módulos también vuelve', () => {
  const vacia = { ...Clonar(FICHA), modulos: [] };
  const r = G.desdeTexto(G.aTexto(vacia));
  assert.equal(r.ok, true, r.error);
  assert.deepEqual(r.estado, vacia);
});

test('ida y vuelta: el modo C y el interruptor apagado se conservan', () => {
  const c = { ...Clonar(FICHA), modo: 'C', justificadasCuentan: false, horasPorDia: 4.5 };
  const r = G.desdeTexto(G.aTexto(c));
  assert.equal(r.ok, true, r.error);
  assert.deepEqual(r.estado, c);
});

test('ida y vuelta: un módulo sin nombre ni horas sobrevive', () => {
  const enBlanco = {
    ...Clonar(FICHA),
    modulos: [{ nombre: '', horasTotales: '', justificadas: '', injustificadas: '', horasTranscurridas: '' }]
  };
  const r = G.desdeTexto(G.aTexto(enBlanco));
  assert.equal(r.ok, true, r.error);
  assert.deepEqual(r.estado, enBlanco);
});

/* ------------------------------------------------------------------ *
 * desdeTexto — archivos que no son nuestros o que están rotos
 * ------------------------------------------------------------------ */

test('desdeTexto: rechaza texto que no es JSON', () => {
  const r = G.desdeTexto('esto no es un archivo');
  assert.equal(r.ok, false);
  assert.equal(r.estado, undefined);
});

test('desdeTexto: rechaza un JSON vacío', () => {
  assert.equal(G.desdeTexto('').ok, false);
});

test('desdeTexto: rechaza JSON sin la etiqueta de formato', () => {
  const r = G.desdeTexto('{"modulos":[]}');
  assert.equal(r.ok, false);
  assert.match(r.error, /faltas-promax/);
});

test('desdeTexto: rechaza JSON con la etiqueta de otro programa', () => {
  const r = G.desdeTexto(JSON.stringify({ formato: 'otra-cosa', modulos: [] }));
  assert.equal(r.ok, false);
});

test('desdeTexto: acepta la versión 1 y también el archivo sin versión', () => {
  // El archivo sin versión es el caso más antiguo posible: se asume la 1.
  for (const archivo of [
    { formato: G.FORMATO, modulos: [] },
    { formato: G.FORMATO, version: 1, modulos: [] },
    { formato: G.FORMATO, version: '1', modulos: [] },
    { formato: G.FORMATO, version: 0, modulos: [] }
  ]) {
    const r = G.desdeTexto(JSON.stringify(archivo));
    assert.equal(r.ok, true, `version=${archivo.version}: ${r.error}`);
  }
});

test('desdeTexto: rechaza una versión más nueva que esta copia', () => {
  // Si mañana se amplía el archivo, un archivo de la nueva versión no debe
  // interpretarse con las reglas viejas: se rechaza y se dice por qué.
  const r = G.desdeTexto(JSON.stringify({ formato: G.FORMATO, version: 2, modulos: [] }));
  assert.equal(r.ok, false);
  assert.match(r.error, /2/);
  assert.match(r.error, /versi[oó]n/i);
});

test('desdeTexto: una versión que no es un número se rechaza', () => {
  for (const version of ['dos', {}, [], true, -1, 1.5]) {
    const r = G.desdeTexto(
      JSON.stringify({ formato: G.FORMATO, version, modulos: [] })
    );
    assert.equal(r.ok, false, `version=${JSON.stringify(version)} debería rechazarse`);
  }
});

test('desdeTexto: un archivo demasiado nuevo no devuelve estado a medias', () => {
  // desdeTexto es puro: el rechazo es un fallo limpio, sin estado a medias que
  // el llamador pueda usar por error.
  const r = G.desdeTexto(
    JSON.stringify({ formato: G.FORMATO, version: 99, modulos: [{ nombre: 'Nuevo' }] })
  );
  assert.equal(r.ok, false);
  assert.equal(r.estado, undefined);
});

test('desdeTexto: cada fallo explica un motivo distinto', () => {
  // Si todos los errores dijeran lo mismo, el usuario no sabría qué arreglar.
  const roto = G.desdeTexto('{{{').error;
  const ajeno = G.desdeTexto('{"hola":1}').error;
  assert.notEqual(roto, ajeno);
  for (const e of [roto, ajeno]) {
    assert.equal(typeof e, 'string');
    assert.ok(e.length > 10, `mensaje demasiado corto: "${e}"`);
  }
});

test('desdeTexto: rechaza cuando modulos no es una lista', () => {
  for (const malo of [{}, 'hola', 42, null]) {
    const r = G.desdeTexto(
      JSON.stringify({ formato: G.FORMATO, version: G.VERSION, modulos: malo })
    );
    assert.equal(r.ok, false, `modulos=${JSON.stringify(malo)} debería rechazarse`);
  }
});

/* ------------------------------------------------------------------ *
 * desdeTexto — valores raros dentro de un archivo nuestro
 * ------------------------------------------------------------------ */

test('desdeTexto: un modo ausente o inválido cae en A', () => {
  for (const modo of [undefined, 'Z', 'a', '', 7, null]) {
    const r = G.desdeTexto(JSON.stringify({ formato: G.FORMATO, modulos: [], modo }));
    assert.equal(r.ok, true, r.error);
    assert.equal(r.estado.modo, 'A', `modo=${JSON.stringify(modo)}`);
  }
});

test('desdeTexto: respeta las horas por jornada y los días válidos', () => {
  const con = (horasPorDia, diasLectivosPorSemana) =>
    G.desdeTexto(
      JSON.stringify({ formato: G.FORMATO, modulos: [], horasPorDia, diasLectivosPorSemana })
    ).estado;
  assert.equal(con(4, 4).horasPorDia, 4);
  assert.equal(con(7.5, 6).horasPorDia, 7.5);
  assert.equal(con(4, 6).diasLectivosPorSemana, 6);
});

test('desdeTexto: horas por jornada imposibles caen al valor por defecto', () => {
  // Mismo criterio que el campo del formulario: sólo se acepta lo que es > 0.
  for (const malo of [0, -3, 'hola', null, undefined, NaN]) {
    const r = G.desdeTexto(JSON.stringify({ formato: G.FORMATO, modulos: [], horasPorDia: malo }));
    assert.equal(r.estado.horasPorDia, 6, `horasPorDia=${malo}`);
  }
  for (const malo of [0, -3, 'hola', null, undefined, NaN]) {
    const r = G.desdeTexto(
      JSON.stringify({ formato: G.FORMATO, modulos: [], diasLectivosPorSemana: malo })
    );
    assert.equal(r.estado.diasLectivosPorSemana, 5, `diasLectivosPorSemana=${malo}`);
  }
});

test('desdeTexto: un interruptor que no es booleano se pone como estaba', () => {
  const con = (justificadasCuentan) =>
    G.desdeTexto(
      JSON.stringify({ formato: G.FORMATO, modulos: [], justificadasCuentan })
    ).estado.justificadasCuentan;
  assert.equal(con(false), false);
  assert.equal(con(true), true);
  for (const raro of ['sí', 0, 1, null, undefined]) {
    assert.equal(con(raro), true, `justificadasCuentan=${JSON.stringify(raro)}`);
  }
});

test('desdeTexto: las horas en texto se convierten en número', () => {
  const r = G.desdeTexto(
    JSON.stringify({
      formato: G.FORMATO,
      modulos: [{ nombre: 'X', horasTotales: '96', justificadas: '2', injustificadas: '6' }]
    })
  );
  assert.equal(r.ok, true, r.error);
  assert.equal(r.estado.modulos[0].horasTotales, 96);
  assert.equal(r.estado.modulos[0].justificadas, 2);
  assert.equal(r.estado.modulos[0].injustificadas, 6);
});

test('desdeTexto: las horas en blanco siguen en blanco, no en cero', () => {
  // El formulario usa "" para lo que aún no se ha rellenado, y se ve distinto
  // que un 0. Al importar no hay que inventar un cero.
  const r = G.desdeTexto(
    JSON.stringify({
      formato: G.FORMATO,
      modulos: [{ nombre: 'X', horasTotales: '', justificadas: null, injustificadas: undefined }]
    })
  );
  assert.equal(r.estado.modulos[0].horasTotales, '');
  assert.equal(r.estado.modulos[0].justificadas, '');
  assert.equal(r.estado.modulos[0].injustificadas, '');
});

test('desdeTexto: un número negativo o imposible se queda en 0', () => {
  // Infinity no aparece: JSON.stringify lo convierte en null, así que un
  // Infinity dentro de un archivo es en realidad un null.
  const r = G.desdeTexto(
    JSON.stringify({
      formato: G.FORMATO,
      modulos: [{ nombre: 'X', horasTotales: -5, justificadas: 'muchas', injustificadas: 'NaN' }]
    })
  );
  assert.equal(r.ok, true, r.error);
  assert.equal(r.estado.modulos[0].horasTotales, 0);
  assert.equal(r.estado.modulos[0].justificadas, 0);
  assert.equal(r.estado.modulos[0].injustificadas, 0);
});

test('desdeTexto: una entrada de módulo que no es un objeto no rompe nada', () => {
  const r = G.desdeTexto(
    JSON.stringify({ formato: G.FORMATO, modulos: [null, 'x', 5, { nombre: 'Real', horasTotales: 60 }] })
  );
  assert.equal(r.ok, true, r.error);
  assert.equal(r.estado.modulos.length, 4, 'no se pierde ninguna fila');
  assert.equal(r.estado.modulos[0].nombre, '');
  assert.equal(r.estado.modulos[3].nombre, 'Real');
  assert.equal(r.estado.modulos[3].horasTotales, 60);
});

test('desdeTexto: acota un nombre de módulo desmedido', () => {
  const larguisimo = 'M'.repeat(5000);
  const r = G.desdeTexto(
    JSON.stringify({ formato: G.FORMATO, modulos: [{ nombre: larguisimo, horasTotales: 60 }] })
  );
  assert.equal(r.ok, true, r.error);
  assert.equal(r.estado.modulos[0].nombre.length, G.MAX_NOMBRE);
});

test('desdeTexto: ignora lo que no conoce, para poder ampliar el archivo', () => {
  const r = G.desdeTexto(
    JSON.stringify({
      formato: G.FORMATO,
      version: G.VERSION,
      modulos: [{ nombre: 'X', horasTotales: 60, unCampoDelFuturo: 'lo que sea' }],
      unaSeccionDelFuturo: { a: 1 }
    })
  );
  assert.equal(r.ok, true, r.error);
  assert.equal(r.estado.modulos[0].unCampoDelFuturo, undefined);
  assert.equal(r.estado.unaSeccionDelFuturo, undefined);
});

test('desdeTexto: no se traga más módulos de los que la tabla admite', () => {
  const muchos = Array.from({ length: G.MAX_MODULOS + 25 }, (_, i) => ({
    nombre: 'M' + i,
    horasTotales: 60
  }));
  const r = G.desdeTexto(JSON.stringify({ formato: G.FORMATO, modulos: muchos }));
  assert.equal(r.ok, true, r.error);
  assert.equal(r.estado.modulos.length, G.MAX_MODULOS);
});

test('desdeTexto: el texto exportado por aTexto pasa sus propias validaciones', () => {
  // Si aTexto emitiera algo que desdeTexto rechaza, exportar e importar
  // estaría roto justo en el camino que el usuario espera que funcione.
  const r = G.desdeTexto(G.aTexto(FICHA));
  assert.equal(r.ok, true, r.error);
});
