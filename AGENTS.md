# AGENTS.md

Calculadora de faltas para FP en Andalucía. **Un HTML y dos scripts, sin nada
más.** No hay `package.json`, ni build, ni CI, ni `node_modules`. El
entregable se abre con doble clic en `index.html` y tiene que funcionar desde
`file://`. Cualquier dependencia que añadas aquí es un defecto.

Los ficheros son: `index.html` (todo el CSS y toda la UI en un `<style>` y un
`<script>`), `calculo.js` (aritmética), `guardado.js` (exportar/importar),
`test/*.test.js`, `README.md`, y dos imágenes.

## Comandos

```bash
node --test                      # 62 tests. SIN argumentos.
```

`node --test test/` **falla en Windows** (MODULE_NOT_FOUND). Pasa sólo la
carpeta y no vale; `node --test` a secas es lo único que funciona. El README
publica ese comando, así que no lo cambies sin actualizar el README.

El resto de la verificación **no está en el repo**: vive en
`C:\Users\chris\.faltas-dev` con jsdom 30, puppeteer-core 25 y
markdownlint-cli2, instalados a propósito fuera para que el entregable siga
siendo ligero. Si esa carpeta no existe, `node --test` es todo lo que hay; no la
instales dentro del repo. Chrome se toma del sistema:
`C:\Program Files\Google\Chrome\Application\chrome.exe`.

```bash
cd C:\Users\chris\.faltas-dev
node ui.test.js       <repo>              # 159, interacción en jsdom
node degrada.test.js  <repo>              # 12, qué pasa si falta un .js
node ciclo-real.js    <repo> [ancho]      # 21, exporta a disco y reimporta
node audit.js         <repo> [ancho] [alto]   # 65, repetir en 1440/1024/768/390/320
node geo-guardado.js  <repo> [ancho] [alto]   # 24, geometría del bloque nuevo
node sintaxis.js      <repo>              # 23, sintaxis y codificación
node dead-code.js                          # 0/79 clases, 0/15 var. CSS,
                                          # 35 funciones, 0/15 exports de
                                          # calculo.js, 0/6 de guardado.js
node md-truth.js                           # 46, el README contra el código
node md-check.js ; node md-align.js
npx markdownlint-cli2 "<repo>\README.md" "<repo>\AGENTS.md"
```

Ojo con la firma: `audit`, `ciclo-real`, `geo-guardado`, `sintaxis`, `ui.test`,
`degrada.test` y los `probe*` toman el repo en `argv[2]`; **`dead-code`,
`md-truth`, `md-check`, `md-align`, `api-usage` y `geo` llevan la ruta escrita a
mano** y no aceptan argumentos. En los `probe*.js` hay restos de sesiones
anteriores: no son una fuente de verdad.

Para un solo test: `node --test --test-name-pattern="presupuestoHoras"`.

## Lo que no se toca

- **La regla legal.** Orden de 18/09/2025 (BOJA nº 180 C1) art. 2.4, que
  reproduce los arts. 27.5-27.6 del Decreto 147/2025: mínimo 80% de asistencia
  = máximo 20% de inasistencia, **por módulo** y sobre la duración total del
  módulo (fase de empresa incluida). Está en `calculo.js` como
  `ASISTENCIA_MINIMA_PORCENTAJE = 80`, de ahí sale `INASISTENCIA_MAXIMA` por
  resta. **No la "mejores":** el 15% es la norma Valenciana, no la andaluza. El
  redondeo es `Math.floor((h * 20) / 100)`, **siempre hacia abajo**; redondear
  arriba haría prometer horas que no existen. Sólo el **modo A** es el criterio
  legal.
- **Sin color.** Todo el CSS vive en la escala de grises y `audit.js` lo
  comprueba. Para distinguir estados, peso, bordes y texto, no color.
- **Sin animación fuera de `@media (prefers-reduced-motion: no-preference)`**,
  con un bloque `reduce` aparte que pone a cero `.ayuda`, `.globo`, `.modo` y
  `.barra .relleno`. Si añades una transición, va dentro de `no-preference`.
- **Sin persistencia ni red**: nada de `localStorage`, `sessionStorage`,
  `indexedDB`, `fetch` ni `XMLHttpRequest`. El guardado es el botón Exportar.
  Cero llamadas de red, siempre.
- **Nada de `type="module"` ni `import`/`export`**: sobre `file://` el CORS lo
  bloquea. Los dos `.js` son scripts planos con envoltorio UMD; el script en
  línea va dentro de un IIFE. `index.html` los carga con dos `<script src>`.

## Trampas verificadas (las he pisado)

- **Colisiones de nombre.** Ya existen `aviso()` (caja de avisos del panel de
  resultados) y la clase `.aviso`. Añadí un `var aviso` y el panel de resultados
  entero se rompía con `appendChild(undefined)`. Busca antes de nombrar; hay
  ~35 funciones en el IIFE y 79 clases.
- **`num()` escribe decimales con coma** (formato español). Un
  `<input type="number">` necesita punto, o el navegador lo rechaza. Para
  escribir valores en campos usa `String(v)`, como hace `aplicarEstado`.
- **El tope de 40 módulos está en tres sitios**: `MAX_MODULOS` en `guardado.js`,
  un `disabled` del botón Añadir y un `return` en su manejador, ambos con el 40
  escrito a mano en `index.html`. Si subes uno, súbenlos los tres;
  `md-truth.js` lo verifica.
- **`pintar()` es una línea**: `montarAyudas(); pintarModos(); pintarModulos();
  pintarResultado();`. Después de importar, llama a las tres últimas, **no** a
  `pintar()`: volvería a montar los botones `?` de las ayudas por duplicado.
- **Los nombres de módulo van a `input.value`, nunca a `innerHTML`**, que no
  aparece en el repo y no debe aparecer: es el límite de XSS de una
  funcionalidad que lee ficheros de fuera.
- **Al importar, el estado son dos mitades**: el objeto `estado` *y* los campos
  del formulario. Si escribes sólo una, el siguiente ajuste que toque el usuario
  pisa lo importado.
- **`Math.floor` y coma flotante**: 96 h dan 19,2 h de margen y el margen es 19.
- **El ejemplo tiene un empate real** (dos módulos con 7 h de margen), así que
  los tests de salida tienen que admitir cualquiera de los dos.

## Bugs de las herramientas de test

Merecen la pena porque se pierden horas:

- **jsdom** no tiene `URL.createObjectURL` (hay que sustituirlo), ni
  `requestAnimationFrame` sin `pretendToBeVisual`, y `resources: 'usable'` es
  **imprescindible**: sin él los `<script src>` no se cargan nunca y mides lo
  mismo en todos los casos. `input.files` es sólo lectura: sustitúyelo con
  `Object.defineProperty`. `FileReader` es asíncrono de verdad, hay que esperar.
- **El count-up** sigue animando cuando `waitForFunction` resuelve: espera
  ~600 ms antes de comparar cifras.
- **`Intl` en español** escribe 10239 como `"10.239"`, no `"10239"`.
- **Contraste WCAG**: hay que **linealizar sRGB** (`s <= 0.03928 ? s/12.92 :
  ((s+0.055)/1.055)^2.4`). Sin eso los colores grises pasan o fallan por azar.
- **Chrome reevalúa `<source media>` de forma asíncrona**: espera a
  `currentSrc`, no a un `sleep`.

## El README está verificado por máquina

`md-truth.js` cuenta las llamadas a `test(` y las compara con las cifras que
publica el README (ahora 31 + 31 = 62), y comprueba que los ficheros que el
README dice que existen existen. **Si añades un test, actualiza el número del
README en el mismo commit o el checker falla.** Lo mismo con `markdownlint`
(tablas alineadas con `md-align.js`, nada de emoji, encabezado de tabla siempre
relleno).

## Español, y cómo escribir

Todo el texto de cara al usuario, los comentarios, los nombres de variables y
el README van en español de España, con tildes y eñes. Se cita la norma en
español y se usa «» para citas, no "".

**Al escribir ficheros usa la herramienta de escritura, nunca una here-string
de PowerShell**: `Get-Content`/`Out-File` y las here-strings destrozan el UTF-8
y se te colan caracteres de otros idiomas en los comentarios. Pasa después un
grep de palabras inglesas sobre los comentarios que hayas escrito; ha pasado
varias veces (incluido un carácter chino dentro de un `/* */`).

Revisa también la aritmética de los textos: «30 h semanales con 6 h al día» son
cinco jornadas *por semana*, no cuatro al mes. Ya se corrigió una vez.

## Git

`.gitattributes` tiene `* text=auto`, así que git avisa de LF→CRLF en cada
fichero. Los ficheros están en LF. **Los avisos son benignos, no los
"arregles"**: convertirlos genera un diff entero sin ningún cambio real.

`Gif.gif` y `Gif-poster.png` son imágenes, no código: si no están, la página
funciona igual salvo el logo y el favicon. La rama es `main`, el remoto es
`https://github.com/centimos01/FaltasProMax.git`.
