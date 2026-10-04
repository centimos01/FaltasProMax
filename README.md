# FaltasProMax

Calculadora de faltas para **Formación Profesional en Andalucía** (grados D y E).
Responde a una pregunta concreta: *¿cuántas horas, jornadas o semanas puedo
faltar sin perder la evaluación continua?*

Abre `index.html` en el navegador. No necesita servidor, instalación ni conexión:
no hay dependencias, ni build, ni llamadas de red, y no se guarda nada.

```
index.html          la calculadora (HTML + CSS + JS, sin dependencias)
calculo.js          la lógica de cálculo, aislada del DOM
test/calculo.test.js  tests de la lógica con node:test
```

## El dato importante: no es un 20% del curso

Lo que se cree normalmente —«puedo faltar el 20% de las horas del año»— **no es
legal**. La norma aplica el límite **módulo a módulo**, y el denominador es la
duración *total* del módulo, no las horas ya transcurridas.

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

| | |
|---|---|
| **80% mínimo de asistencia** | ⇒ máximo 20% de inasistencia |
| **Por módulo**, no por curso | cada módulo tiene su propia bolsa |
| **Sobre el total** del módulo | las faltas se acumulan como saldo a lo largo del curso |
| **Incluye la fase de empresa** | las horas de empresa forman parte del total del módulo |

Puedes pasarte en un módulo de 60 h tener el margen entero en uno de 240 h, y aun
así haber perdido la evaluación continua en el primero. El modo A lo muestra
módulo a módulo y señala cuál se te acaba antes.

### El redondeo nunca va a tu favor

Con un módulo de 96 h, el 20% son 19,2 h:

| Faltas | Asistes | Asistencia | |
|---|---|---|---|
| 19 h | 77 h | 80,2% | ✅ |
| 20 h | 76 h | 79,2% | ❌ |

Por eso `presupuestoHoras()` redondea **siempre hacia abajo**. Redondear hacia
arriba diría que puedes faltar un día más, y sería falso.

## Los tres modos

Se pueden elegir, pero **sólo el A es el criterio legal**; la interfaz lo marca.

| | Modo | Qué hace |
|---|---|---|
| **A** | **Por módulo** | **LEGAL.** Presupuesto del 20% en cada módulo por separado. |
| **B** | Global del curso | 20% de todas las horas sumadas. Orientativo: no existe como umbral legal. |
| **C** | Proyección | Extrapola tu ritmo actual sobre las horas ya dadas. Avisa con antelación, no es el criterio legal. |

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

## Tests

```bash
node --test test/calculo.test.js
```

31 tests sobre la aritmética y los límites legales: redondeo hacia abajo,
precisión de coma flotante, el límite de 96 h que motiva el redondeo, el
interruptor de justificadas, los cortes de riesgo, el módulo crítico, los
días hábiles y que **sólo el modo A esté marcado como legal**.

## Interfaz

Blanco y negro sin una sola color, y todos los textos pasan AA de contraste
(≥ 4,5:1) tanto en la tarjeta negra como en el papel. Los módulos en riesgo se
marcan con trama diagonal en lugar de rojo, y se distingue el modo legal por el
relleno sólido de su insignia. Sin scroll horizontal de 1440 px a 320 px.

## Aviso

Esto es una herramienta de cálculo, no un servicio de asesoramiento legal. El
art. 2.4 deja margen al centro y al profesorado, así que **lo que prevalecerá es
lo que diga tu tutors** sobre cómo se aplican las faltas justificadas y las
recuperaciones de asistencia.