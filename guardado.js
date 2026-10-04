/*
 * FaltasProMax — exportar e importar la ficha (sin DOM, sin estado global).
 *
 * Es la única parte de la calculadora que lee datos de fuera: el archivo puede
 * estar corrupto, editado a mano o hecho a propósito. Por eso `desdeTexto` no
 * confía en nada de lo que lee y devuelve un estado limpio o un motivo, nunca
 * una excepción. Un archivo de texto no puede tumbar la página.
 *
 * Lo que se guarda es sólo lo que has escrito: modo, horas por jornada, días
 * lectivos, el interruptor de justificadas y los módulos con sus horas. Los
 * resultados NO se guardan, porque se recalculan al importar: si se guardaran,
 * un archivo viejo traería números que ya no cuadran con la norma vigente.
 *
 * Uso como módulo CommonJS (tests) y como script plano en el navegador.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Guardado = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** Etiqueta que debe traer el archivo. Evita aceptar un JSON cualquiera. */
  var FORMATO = 'faltas-promax';
  var VERSION = 1;

  /** El mismo tope que usa el botón «+ Añadir módulo». */
  var MAX_MODULOS = 40;

  /** Un nombre de módulo de 120 caracteres es ya un absurdo. */
  var MAX_NOMBRE = 120;

  var MODOS = ['A', 'B', 'C'];
  var HORAS_POR_DIA_POR_DEFECTO = 6;
  var DIAS_POR_SEMANA_POR_DEFECTO = 5;

  /**
   * Acepta sólo un número finito no negativo, en number o en texto.
   * Lo vacío ("" o null) se queda vacío: el formulario lo usa para lo que aún
   * no se ha rellenado, y confundirlo con un 0 sería inventar un cero.
   */
  function horas(v) {
    if (v === '' || v == null) return '';
    var n = Number(v);
    if (!isFinite(n) || n < 0) return 0;
    return n;
  }

  /** Sólo se acepta lo que sea > 0, igual que hacen los campos del formulario. */
  function positivo(v, porDefecto) {
    var n = Number(v);
    return isFinite(n) && n > 0 ? n : porDefecto;
  }

  function nombreDe(v) {
    if (v == null) return '';
    return String(v).slice(0, MAX_NOMBRE);
  }

  /**
   * Normaliza un módulo. Una entrada que no es un objeto (null, un número, un
   * texto suelto) se convierte en un módulo en blanco en vez de desaparecer:
   * así no desaparece ninguna fila de la tabla y el usuario ve el hueco.
   */
  function moduloDe(m) {
    var mod = m && typeof m === 'object' ? m : {};
    return {
      nombre: nombreDe(mod.nombre),
      horasTotales: horas(mod.horasTotales),
      justificadas: horas(mod.justificadas),
      injustificadas: horas(mod.injustificadas),
      horasTranscurridas: horas(mod.horasTranscurridas)
    };
  }

  function hoy() {
    return new Date().toISOString().slice(0, 10);
  }

  /* ------------------------------------------------------------------ *
   * Exportar
   * ------------------------------------------------------------------ */

  /**
   * Convierte el estado de la página en el texto del archivo.
   * No toca el estado que recibe: se monta una copia con los campos justos.
   */
  function aTexto(estado) {
    var e = estado || {};
    var modulos = e.modulos || [];
    var salida = [];
    for (var i = 0; i < modulos.length && i < MAX_MODULOS; i++) {
      salida.push(moduloDe(modulos[i]));
    }
    return JSON.stringify(
      {
        formato: FORMATO,
        version: VERSION,
        exportado: hoy(),
        modo: MODOS.indexOf(e.modo) > -1 ? e.modo : 'A',
        horasPorDia: positivo(e.horasPorDia, HORAS_POR_DIA_POR_DEFECTO),
        diasLectivosPorSemana: positivo(e.diasLectivosPorSemana, DIAS_POR_SEMANA_POR_DEFECTO),
        justificadasCuentan: e.justificadasCuentan !== false,
        modulos: salida
      },
      null,
      2
    );
  }

  /* ------------------------------------------------------------------ *
   * Importar
   * ------------------------------------------------------------------ */

  function fallo(mensaje) {
    return { ok: false, error: mensaje };
  }

  /**
   * Lee el texto de un archivo y devuelve `{ok: true, estado}` o
   * `{ok: false, error: <motivo en español>}`. Nunca lanza.
   */
  function desdeTexto(texto) {
    if (typeof texto !== 'string' || !texto.trim()) {
      return fallo('El archivo está vacío.');
    }

    var datos;
    try {
      datos = JSON.parse(texto);
    } catch (e) {
      return fallo('No se ha podido leer el archivo: el formato no es JSON válido.');
    }
    if (!datos || typeof datos !== 'object' || Array.isArray(datos)) {
      return fallo('No se ha podido leer el archivo: el formato no es JSON válido.');
    }

    if (datos.formato !== FORMATO) {
      return fallo(
        'Este archivo no es una ficha de FaltasProMax (le falta la etiqueta "' + FORMATO + '").'
      );
    }

    // La versión decide si esta copia sabe leer el archivo. Sin campo se asume
    // la 1, que es como nacieron los primeros archivos. Un número más alto
    // significa que el archivo se grabó con una versión posterior: no se puede
    // adivinar qué campos traiga, así que se rechaza en vez de importarlo a
    // medias. Un valor que no sea un número se rechaza también, porque
    // Number(true) es 1 y Number([]) es 0, y eso no es una versión de nada.
    if (datos.version !== undefined && datos.version !== null) {
      var esNumero = typeof datos.version === 'number' || typeof datos.version === 'string';
      var nVersion = Number(datos.version);
      if (!esNumero || !isFinite(nVersion) || nVersion < 0) {
        return fallo(
          'El archivo declara una versión que no se reconoce ("' +
            String(datos.version).slice(0, 12) + '"). Sólo se leen los archivos ' +
            'de esta misma versión.'
        );
      }
      if (nVersion > VERSION) {
        return fallo(
          'El archivo es de la versión ' + nVersion + ', más nueva que esta ' +
            'página, que entiende hasta la ' + VERSION + '. Si el archivo lo ha ' +
            'sacado otra calculadora más nueva, actualízate.'
        );
      }
    }

    // Un archivo sin la sección de módulos se acepta como una ficha vacía; lo
    // que no se acepta es que la sección exista y no sea una lista.
    if (datos.modulos === undefined) {
      datos.modulos = [];
    } else if (!Array.isArray(datos.modulos)) {
      return fallo('El archivo no contiene una lista de módulos reconocible.');
    }

    var modulos = [];
    var total = Math.min(datos.modulos.length, MAX_MODULOS);
    for (var i = 0; i < total; i++) {
      modulos.push(moduloDe(datos.modulos[i]));
    }

    return {
      ok: true,
      estado: {
        modo: MODOS.indexOf(datos.modo) > -1 ? datos.modo : 'A',
        horasPorDia: positivo(datos.horasPorDia, HORAS_POR_DIA_POR_DEFECTO),
        diasLectivosPorSemana: positivo(datos.diasLectivosPorSemana, DIAS_POR_SEMANA_POR_DEFECTO),
        // Sólo el false explícito desactiva el interruptor.
        justificadasCuentan: datos.justificadasCuentan !== false,
        modulos: modulos
      }
    };
  }

  return {
    FORMATO: FORMATO,
    VERSION: VERSION,
    MAX_MODULOS: MAX_MODULOS,
    MAX_NOMBRE: MAX_NOMBRE,
    aTexto: aTexto,
    desdeTexto: desdeTexto
  };
});
