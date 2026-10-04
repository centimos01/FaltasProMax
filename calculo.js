/*
 * FaltasProMax — lógica de cálculo (sin DOM, sin estado).
 *
 * Base legal (Comunidad Autónoma de Andalucía):
 *   Orden de 18 de septiembre de 2025, BOJA nº 180 C1, artículo 2.4, que reproduce
 *   el artículo 27.5 y 27.6 del Decreto 147/2025, de 17 de septiembre:
 *
 *   "En la modalidad presencial y en la parte presencial de la modalidad
 *    semipresencial, la evaluación continua de los aprendizajes requerirá la
 *    asistencia regular y obligatoria, tanto en el centro docente como en la fase
 *    de formación en empresa u organismo equiparado, de al menos el 80 por ciento
 *    de la duración total del módulo, ámbito o proyecto, a partir de la fecha en
 *    la que el alumnado se haya matriculado."
 *
 * Consecuencias que esta lógica refleja:
 *   - El umbral es POR MÓDULO, nunca por curso: el art. 2.4 dice "duración total
 *     del módulo, ámbito o proyecto".
 *   - El denominador es la duración TOTAL del módulo, no las horas ya
 *     transcurridas. Las faltas se comportan como un saldo que se consume.
 *   - Mínimo 80% de asistencia  ->  máximo 20% de inasistencia.
 *
 * Uso como módulo CommonJS (tests) y como script plano en el navegador.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Calculo = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ------------------------------------------------------------------ *
   * Constantes normativas
   * ------------------------------------------------------------------ */

  /** Asistencia mínima exigida por el art. 2.4 de la Orden. */
  var ASISTENCIA_MINIMA_PORCENTAJE = 80;

  /** Inasistencia máxima derivada: 100 - 80 = 20% de la duración total. */
  var INASISTENCIA_MAXIMA_PORCENTAJE = 100 - ASISTENCIA_MINIMA_PORCENTAJE;

  /** Días hábiles de inasistencia injustificada que acarrean anulación de oficio (art. 9.1). */
  var DIAS_HABILES_ANULACION_OFICIO = 45;

  /**
   * Metadatos de los modos de cálculo.
   * `legal: true` sólo en el modo A. Los otros dos se ofrecen porque son
   * atajos útiles o concepciones habituales, pero no son el criterio legal.
   */
  var MODOS = {
    A: {
      id: 'A',
      titulo: 'Por módulo',
      criterio: 'Criterio legal',
      legal: true,
      resumen: 'Presupuesto de faltas en cada módulo por separado.',
      detalle:
        'Es lo que dice el BOJA: el 20% se aplica a la duración total de cada ' +
        'módulo. Cada módulo tiene su propia bolsa, así que puedes pasarte en uno ' +
        'de 60 h y tener el margen entero en otro de 240 h.'
    },
    B: {
      id: 'B',
      titulo: 'Global del curso',
      criterio: 'Orientativo',
      legal: false,
      resumen: '20% de todas las horas del curso sumadas.',
      detalle:
        'No existe como límite legal: el BOJA no computa el curso entero. Úsalo ' +
        'como referencia rápida para dimensionar, nunca como margen seguro.'
    },
    C: {
      id: 'C',
      titulo: 'Proyección sobre lo transcurrido',
      criterio: 'Atajo a la baja',
      legal: false,
      resumen: 'A este ritmo, ¿con cuántas faltas acabarás el módulo?',
      detalle:
        'Proyecta las faltas actuales sobre las horas ya transcurridas para ' +
        'estimar dónde vas a acabar. No es el criterio legal (que usa la duración ' +
        'total), pero avisa con antelación si vas por mal camino.'
    }
  };

  /* ------------------------------------------------------------------ *
   * Primitivas de cálculo
   * ------------------------------------------------------------------ */

  /**
   * Horas de inasistencia tolerables en un bloque de `horasTotales`.
   *
   * Se redondea SIEMPRE hacia abajo. Es el único redondeo que no sobreestima el
   * margen: con 96 h, el 20% son 19,2 h; faltar 19 h deja 80,2% de asistencia
   * (legal) y faltar 20 h deja 79,2% (ilegal). Multiplicar antes de dividir
   * evita el error de coma flotante en los casos de resultado entero
   * (100 * 20 / 100 === 20 exacto).
   */
  function presupuestoHoras(horasTotales) {
    var h = Number(horasTotales);
    if (!isFinite(h) || h <= 0) return 0;
    return Math.floor((h * INASISTENCIA_MAXIMA_PORCENTAJE) / 100);
  }

  /** Asistencia que hay que conservar para no perder la evaluación continua. */
  function asistenciaMinimaHoras(horasTotales) {
    var h = Number(horasTotales);
    if (!isFinite(h) || h <= 0) return 0;
    return h - presupuestoHoras(h);
  }

  /**
   * Inasistencias que consumen presupuesto.
   *
   * Las injustificadas siempre cuentan. Las justificadas dependen del criterio
   * del centro: el art. 2.4 no las distingue (sólo el art. 9, anulación de
   * oficio, habla explícitamente de "injustificada"), por eso es configurable.
   */
  function inasistenciasQueCuentan(modulo, opciones) {
    var mod = modulo || {};
    var op = opciones || {};
    var injustificadas = Math.max(0, Number(mod.injustificadas) || 0);
    var justificadas = Math.max(0, Number(mod.justificadas) || 0);
    return injustificadas + (op.justificadasCuentan ? justificadas : 0);
  }

  /**
   * Nivel de riesgo, para pintar la barra sin salirse de la paleta monocroma.
   *
   * `conserva` es autoritativo, pero un porcentaje por encima de 100 implica
   * por sí solo que el presupuesto está reventado: así el resultado no depende
   * de que el llamante mantenga el flag sincronizado.
   */
  function clasificarRiesgo(porcentajeConsumido, conserva) {
    var pct = Number(porcentajeConsumido);
    if (!isFinite(pct)) pct = 0;
    if (!conserva || pct > 100) return 'perdida';
    if (pct >= 80) return 'limite';
    if (pct >= 50) return 'aviso';
    return 'ok';
  }

  /**
   * Convierte un saldo de horas en jornadas y semanas lectivas.
   *
   * Las jornadas se redondean hacia abajo porque una jornada parcial no es un
   * día libre: sólo cuenta como jornada completa si caben todas sus horas.
   */
  function desglosarHoras(horas, opciones) {
    var op = opciones || {};
    var horasPorDia = Number(op.horasPorDia) > 0 ? Number(op.horasPorDia) : 6;
    var diasLectivosPorSemana =
      Number(op.diasLectivosPorSemana) > 0 ? Number(op.diasLectivosPorSemana) : 5;
    var horasPorSemana = horasPorDia * diasLectivosPorSemana;
    var h = Math.max(0, Number(horas) || 0);

    var jornadas = Math.floor(h / horasPorDia);
    var restoRedondeado = Math.round((h - jornadas * horasPorDia) * 100) / 100;

    return {
      horas: h,
      jornadasCompletas: jornadas,
      horasRestantes: restoRedondeado,
      horasPorDia: horasPorDia,
      diasLectivosPorSemana: diasLectivosPorSemana,
      horasPorSemana: horasPorSemana,
      semanasLectivas: horasPorSemana > 0 ? h / horasPorSemana : 0,
      mesesAproximados: horasPorSemana > 0 ? h / (horasPorSemana * 4) : 0
    };
  }

  /* ------------------------------------------------------------------ *
   * Evaluación por módulo  (sustenta los modos A y C)
   * ------------------------------------------------------------------ */

  function evaluarModulo(modulo, opciones) {
    var mod = modulo || {};
    var horasTotales = Math.max(0, Number(mod.horasTotales) || 0);
    var existe = horasTotales > 0;
    var presupuesto = presupuestoHoras(horasTotales);
    var computan = inasistenciasQueCuentan(mod, opciones);
    var conserva = computan <= presupuesto;
    var saldo = presupuesto - computan;
    var porcentajeConsumido = !existe
      ? 0
      : presupuesto > 0
        ? (computan / presupuesto) * 100
        : computan > 0
          ? 100
          : 0;

    return {
      nombre: mod.nombre || 'Módulo',
      horasTotales: horasTotales,
      existe: existe,
      presupuestoHoras: presupuesto,
      asistenciaMinima: asistenciaMinimaHoras(horasTotales),
      justificadas: Math.max(0, Number(mod.justificadas) || 0),
      injustificadas: Math.max(0, Number(mod.injustificadas) || 0),
      inasistenciasComputan: computan,
      conservaEvaluacionContinua: existe && conserva,
      soldeadasHoras: Math.max(0, saldo),
      excedenteHoras: Math.max(0, -saldo),
      porcentajeConsumido: porcentajeConsumido,
      riesgo: existe ? clasificarRiesgo(porcentajeConsumido, conserva) : 'vacio',
      proyeccion: proyectar(modulo, opciones)
    };
  }

  /**
   * Proyección lineal: si se mantiene el ritmo actual de inasistencia sobre las
   * horas ya transcurridas, con cuántas faltas acabaría el módulo.
   * Devuelve null si no hay horas transcurridas con las que comparar.
   */
  function proyectar(modulo, opciones) {
    var mod = modulo || {};
    var horasTotales = Math.max(0, Number(mod.horasTotales) || 0);
    var transcurridas = Math.max(0, Number(mod.horasTranscurridas) || 0);
    if (horasTotales <= 0 || transcurridas <= 0) return null;

    var consumidas = inasistenciasQueCuentan(mod, opciones);
    var presupuesto = presupuestoHoras(horasTotales);
    var proyeccionHoras = (consumidas / transcurridas) * horasTotales;

    return {
      horasTranscurridas: transcurridas,
      horasPendientes: Math.max(0, horasTotales - transcurridas),
      consumidas: consumidas,
      proyeccionHoras: proyeccionHoras,
      presupuestoHoras: presupuesto,
      dentroDePresupuesto: proyeccionHoras <= presupuesto,
      margenReal: presupuesto - proyeccionHoras
    };
  }

  /* ------------------------------------------------------------------ *
   * Evaluación del curso completo
   * ------------------------------------------------------------------ */

  /**
   * Agrega los módulos.
   *
   * `presupuestoGlobalHoras` es ORIENTATIVO: el BOJA no contempla un umbral a
   * nivel de curso. Se calcula porque sirve para dimensionar de un vistazo, pero
   * el consumidor debe marcarlo como no legal.
   */
  function evaluarCurso(modulos, opciones) {
    var lista = Array.isArray(modulos) ? modulos : [];
    var evaluaciones = lista.map(function (m) {
      return evaluarModulo(m, opciones);
    });

    var totalHoras = evaluaciones.reduce(function (acc, e) {
      return acc + e.horasTotales;
    }, 0);
    var presupuestoGlobal = presupuestoHoras(totalHoras);
    var computadas = evaluaciones.reduce(function (acc, e) {
      return acc + e.inasistenciasComputan;
    }, 0);

    // Módulo que se queda sin margen antes: el más consumido en proporción y,
    // a igualdad de consumo, el de menos horas (es el que antes se agota en
    // jornadas reales).
    var candidatos = evaluaciones
      .filter(function (e) {
        return e.existe;
      })
      .sort(function (a, b) {
        if (b.porcentajeConsumido !== a.porcentajeConsumido) {
          return b.porcentajeConsumido - a.porcentajeConsumido;
        }
        return a.horasTotales - b.horasTotales;
      });

    return {
      modulos: evaluaciones,
      totalHoras: totalHoras,
      presupuestoGlobalHoras: presupuestoGlobal,
      inasistenciasComputadas: computadas,
      margenGlobalHoras: Math.max(0, presupuestoGlobal - computadas),
      excedenteGlobalHoras: Math.max(0, computadas - presupuestoGlobal),
      moduloCritico: candidatos.length > 0 ? candidatos[0] : null,
      modulosPerdidos: evaluaciones.filter(function (e) {
        return e.existe && !e.conservaEvaluacionContinua;
      })
    };
  }

  /**
   * Días hábiles de inasistencia injustificada acumulados (art. 9.1 de la
   * Orden): a partir de 45, el centro puede anular de oficio la matrícula.
   *
   * Convierte a jornadas con las horas por día del módulo; por eso recibe las
   * opciones de desglose en lugar de inventar una conversión fija.
   */
  function evaluarDiasHabiles(evaluaciones, opciones) {
    var op = opciones || {};
    var horasPorDia = Number(op.horasPorDia) > 0 ? Number(op.horasPorDia) : 6;
    var lista = Array.isArray(evaluaciones) ? evaluaciones : [];

    var dias = lista.reduce(function (acc, e) {
      return acc + (horasPorDia > 0 ? e.injustificadas / horasPorDia : 0);
    }, 0);
    var diasRedondeados = Math.floor(dias);

    return {
      diasHabiles: diasRedondeados,
      diasHabilesExactos: Math.round(dias * 100) / 100,
      limite: DIAS_HABILES_ANULACION_OFICIO,
      diasRestantes: Math.max(0, DIAS_HABILES_ANULACION_OFICIO - diasRedondeados),
      enRiesgo: diasRedondeados >= DIAS_HABILES_ANULACION_OFICIO
    };
  }

  /* ------------------------------------------------------------------ *
   * API pública. Todo lo que se exporta está usado por index.html o por
   * test/calculo.test.js: si sobra algo, se borra de aquí en vez de dejar
   * una puerta que nadie abre.
   * ------------------------------------------------------------------ */

  return {
    ASISTENCIA_MINIMA_PORCENTAJE: ASISTENCIA_MINIMA_PORCENTAJE,
    INASISTENCIA_MAXIMA_PORCENTAJE: INASISTENCIA_MAXIMA_PORCENTAJE,
    DIAS_HABILES_ANULACION_OFICIO: DIAS_HABILES_ANULACION_OFICIO,
    MODOS: MODOS,
    presupuestoHoras: presupuestoHoras,
    asistenciaMinimaHoras: asistenciaMinimaHoras,
    desglosarHoras: desglosarHoras,
    evaluarModulo: evaluarModulo,
    proyectar: proyectar,
    evaluarCurso: evaluarCurso,
    evaluarDiasHabiles: evaluarDiasHabiles,
    clasificarRiesgo: clasificarRiesgo
  };
});