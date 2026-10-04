# FaltasProMax

Calculadora de faltas para **Formación Profesional en Andalucía** (grados D y E).
Responde a una pregunta concreta: _¿cuántas horas, jornadas o semanas puedo
faltar sin perder la evaluación continua?_

Abre `index.html` en el navegador. No necesita servidor, instalación ni conexión:
no hay dependencias, ni build, ni llamadas de red, y no se guarda nada por tu
cuenta. Si quieres conservar tu ficha, la exportas tú con un botón.

```text
index.html            la calculadora (HTML + CSS + JS, sin dependencias)
calculo.js            la lógica de cálculo, aislada del DOM
guardado.js           exportar e importar la ficha, también aislado del DOM
Gif.gif               el logo, también favicon
Gif-poster.png        fotograma 0 del GIF, para quien tenga «reducir movimiento»
test/calculo.test.js  tests de la lógica con node:test
test/guardado.test.js tests de exportar e importar con node:test
```

`Gif.gif` y `Gif-poster.png` son imágenes, no dependencias: el HTML sigue
funcionando igual aunque no estén, salvo el logo y el favicon.

## El dato importante: no es un 20% del curso

Lo que se cree normalmente —«puedo faltar el 20% de las horas del año»— **no es
legal**. La norma aplica el límite **módulo a módulo**, y el denominador es la
duración _total_ del módulo, no las horas ya transcurridas.

> **Orden de 18 de septiembre de 2025** (BOJA nº 180 C1), **art. 2.4**, que
> reproduce los arts. 27.5 y 27.6 del **Decreto 147/2025**:
>
> «En la modalidad presencial y en la parte presencial de la modalidad
> semipresencial, la evaluación continua de los aprendizajes requerirá la
> asistencia regular y obligatoria, tanto en el centro docente como en la fase de
> formación en empresa u organismo equiparado, de al menos el 80 por ciento de la
> duración total del módulo, ámbito o proyecto, a partir de la fecha en la que el
> alumnado se haya matriculado.»

Cuatro consecuencias que la calculadora refleja:

| Lo que dice la norma             | Qué significa para ti                    |
| -------------------------------- | ---------------------------------------- |
| **80% mínimo de asistencia**     | ⇒ como máximo un 20% de inasistencia     |
| **Módulo a módulo**, no al curso | cada módulo tiene su propia bolsa        |
| **Sobre el total** del módulo    | las faltas se acumulan como saldo        |
| **Incluye la fase de empresa**   | las horas de empresa cuentan en el total |

Puedes pasarte en un módulo de 60 h y tener el margen entero en otro de 240 h, y
aun así haber perdido la evaluación continua en el primero. El modo A lo muestra
módulo a módulo y señala cuál se te acaba antes.

### El redondeo nunca va a tu favor

Con un módulo de 96 h, el 20% son 19,2 h:

| Faltas | Asistes | Asistencia | ¿Conserva la evaluación continua? |
| ------ | ------- | ---------- | --------------------------------- |
| 19 h   | 77 h    | 80,2%      | Sí                                |
| 20 h   | 76 h    | 79,2%      | No                                |

Por eso `presupuestoHoras()` redondea **siempre hacia abajo**. Redondear hacia
arriba diría que puedes faltar un día más, y sería falso.

## Los tres modos

Se pueden elegir, pero **sólo el modo A es el criterio legal**; la interfaz lo
marca con una insignia.

|       | Modo             | Qué hace                                         |
| ----- | ---------------- | ------------------------------------------------ |
| **A** | **Por módulo**   | **LEGAL.** Presupuesto del 20% módulo a módulo.  |
| **B** | Global del curso | 20% de todas las horas sumadas. No es legal.     |
| **C** | Proyección       | Extrapola tu ritmo actual. Avisa con antelación. |

## Qué pasa si te pasas

- Pierdes el derecho a la **evaluación continua** de ese módulo, **no** la
  convocatoria: conservas el derecho a las pruebas objetivas que determine el
  equipo docente (art. 2.5).
- La pérdida debe notificarse formalmente, con el modelo del **Anexo I**,
  firmada por el/la tutor/a y con el visto bueno de dirección (art. 2.6). Si no
  te avisan, hay un problema de procedimiento.
- **Aparte:** el art. 9.1 permite **anular de oficio la matrícula** —con pérdida
  de plaza y de convocatorias— a partir del 15 de noviembre si acumulas **45
  días hábiles de inasistencia injustificada** en el conjunto de tus módulos.
  Esto es mucho más duro que el 20%, y la calculadora lo avisa aparte.

## Sobre las faltas justificadas

El art. 2.4 habla de «asistencia regular y obligatoria» y **no distingue**
justificadas de injustificadas. Sólo el art. 9 dice explícitamente «injustificada».
En la práctica cada centro lo aplica según su proyecto educativo.

Por defecto la calculadora **las cuenta** (la lectura literal y conservadora),
porque ausente es ausente. Se puede desactivar en «Ajustes generales».

## Guardar tu ficha

La calculadora no guarda nada sola: si cierras la pestaña, se pierde. Hay dos
botones para que el guardado dependa de ti y sólo de ti.

**Exportar** descarga un archivo `faltas-AAAA-MM-DD.json` en tu ordenador con lo
que hayas escrito: el modo, las horas por jornada, los días lectivos, el
interruptor de justificadas y los módulos con sus horas. **Importar** vuelve a
cargar ese archivo; si ya tenías módulos escritos te pregunta antes de
sustituirlos.

El archivo se genera y se lee en el propio navegador, con `Blob` y `FileReader`.
No hay servidor, no hay subidas y no hay red: el `.json` no sale de tu
ordenador.

Dos decisiones deliberadas:

- **Los resultados no se guardan.** Se recalculan al importar, para que un
  archivo viejo no pueda traerte números que ya no cuadran con la norma. El
  archivo lleva sólo entradas, nunca salidas.
- **Un archivo ajeno no puede romper nada.** `guardado.js` no confía en lo que
  lee: exige una etiqueta de formato y un número de versión, y descarta lo que
  no reconoce para poder ampliarlo más adelante. Un módulo que no sea un objeto
  se vuelve una fila en blanco en vez de desaparecer, las horas negativas o
  imposibles se quedan en 0, y no se traga más de 40 módulos, que es el mismo
  tope del botón «+ Añadir». Los nombres van a `input.value`, nunca a
  `innerHTML`, así que un archivo manipulado no puede inyectar nada.

Un archivo que no se puede leer no borra lo que ya tenías: sale un aviso
explicando el motivo, y la tabla se queda como estaba.

## Tests

```bash
node --test
```

Sin argumentos, a propósito: `node --test test/` falla en Windows.

62 tests que no necesitan instalar nada:

- **31** de la aritmética y los límites legales: redondeo hacia abajo, precisión
  de coma flotante, el límite de 96 h que motivo el redondeo, el interruptor de
  justificadas, los cortes de riesgo, el módulo crítico, los días hábiles y que
  **sólo el modo A esté marcado como legal**.
- **31** de exportar e importar: que una ida y vuelta devuelva la ficha
  idéntica, que los resultados no se guarden, que se rechace el JSON inválido, el
  de otro programa, el que no trae módulos y el de una versión más nueva, y que
  un número negativo, un imposible o una entrada que no es un objeto no rompan
  nada.

Además se verificaron, con herramientas de desarrollo que viven fuera del repo,
159 comprobaciones de interacción en jsdom y 65 en Chrome real en cinco anchos
(1440, 1024, 768, 390 y 320): paleta, contraste WCAG con linealización sRGB,
ausencia de scroll horizontal, insignia legal, columna del modo C, logo, ayudas
con ratón y teclado, count-up y el comportamiento con «reducir movimiento»
activado por CDP. Más dos suites propias: 12 comprobaciones de que la página
aguanta que falten los `.js`, y 21 de un ciclo real en Chrome que exporta a
disco, vacía la tabla y vuelve a importar el archivo del disco.

## La lista de verificación del README

Porque un README que miente es peor que uno que no existe, cada afirmación
comprobable de este README se verifica contra el código con scripts que viven
fuera del repo.

## Interfaz

Blanco y negro, sin un solo color: todo el CSS vive en la escala de grises y
todos los textos pasan AA de contraste (≥ 4,5:1) tanto en la tarjeta negra como
en el papel. Los módulos en riesgo se marcan con trama diagonal en lugar de
rojo, y el modo legal se distingue por el relleno sólido de su insignia. Sin
scroll horizontal, de 1440 px a 320 px de ancho.

El logo es el GIF animado y también el favicon. Es la única imagen de la página:
es un recurso de marca, no una decisión de estilo, y su paleta ya es de grises,
así que no lleva `grayscale()`.

### Las ayudas «?»

Cada ajuste, cada bloque de la tabla y los modos llevan al lado un `?` que
explica qué se espera ahí y por qué. Se abre al pasar el ratón, al enfocar con el
teclado y al pulsar, que es el único gesto que existe en una pantalla táctil; se
cierra con Escape o al tocar fuera.

El texto de los ajustes vive en un único mapa `AYUDAS`, dentro de `index.html`;
el de los modos viene de `calculo.js`, que ya lo tenía para las tarjetas. Así
ningún rótulo se duplica ni se desincroniza del cálculo. El de los modos va en el
titular de su sección, y no en cada tarjeta, porque sus tarjetas ya son
`<button>` y no se puede anidar otro `<button>` dentro sin invalidar el HTML.

### Movimiento

Las cifras cuentan hacia su valor en lugar de aparecer de golpe, las barras se
deslizan, y las tarjetas de módulo entran escalonadas. Todo va dentro de
`@media (prefers-reduced-motion: no-preference)`: quien tenga «reducir
movimiento» en el sistema no ve ninguna transición, y el logo cambia al PNG
estático porque un GIF no se puede pausar desde CSS.

El count-up nunca es un requisito: si el motor no tiene `requestAnimationFrame`
o el valor no ha cambiado, se escribe directamente. Una animación que mienta
sobre el estado final de la calculadora sería peor que no animar.

## Aviso

Esto es una herramienta de cálculo, no un servicio de asesoramiento legal. El
art. 2.4 deja margen al centro y al profesorado, así que **lo que prevalecerá es
lo que diga tu tutores** sobre cómo se aplican las faltas justificadas y las
recuperaciones de asistencia.
