# 🐜 Simulador de Colonia de Hormigas — Modo Dios

![HTML5](https://img.shields.io/badge/HTML5-Canvas-E34F26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-responsive-1572B6?logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES%20Modules-F7DF1E?logo=javascript&logoColor=black)
![Dependencias](https://img.shields.io/badge/dependencias-0-success)

Autómata celular interactivo basado en **Optimización por Colonia de Hormigas (ACO)**. Dos colonias, negra y roja, conviven en un mundo de **500 × 500 celdas**, y usted puede alterar el entorno en tiempo real con los pinceles.

El motor es un **port a JavaScript del `MotorNumPy` v6 del Subgrupo 3 (Sprint 3)**: mismas constantes, kernels, tabla de evaporación, radar del depredador, terreno de arena y reglas, en el mismo orden. Así se puede ver en el navegador, sin Colab, exactamente lo que calcula el motor en Python.

> 📸 _Espacio para el GIF de la simulación (`assets/`)._

## Cómo correrlo

No requiere instalación ni compilación. Como usa módulos ES, se abre desde un servidor estático y no con doble clic:

```bash
python -m http.server 8000
```

Luego abra `http://localhost:8000`. También está publicado en GitHub Pages.

## Manual rápido

| Control | Qué hace |
|---|---|
| **▶ Play / ⏸ Pausa / 🔄 Reset** | Arranca, detiene o regenera el mundo inicial. |
| **Pinceles** | El mapa arranca vacío. Colonia N. y Colonia R. ponen un nido con su reina en cada clic. Muro, Comida, Veneno, Hormiga N., Hormiga R., Borrar, Depredador, Arena seca, Cadáver y Basurero pintan con clic o arrastre. |
| **Feromonas** | Pintan una de las cinco capas químicas con intensidad 220 (los pinceles -1 a -5 de la API). |
| **Grosor** | Tamaño del pincel: 1×1, 3×3, 5×5, 7×7 o 9×9. |
| **Visor químico** | Superpone cualquiera de las cinco capas: rastro de comida, alarma, feromona real, necroferomonas y reclutamiento. |
| **Delay** | Pausa entre turnos, de 0 a 0,5 s (variable global `DELAY`). |
| **Estadísticas** | Turno actual y población viva de cada colonia. |

## Arquitectura

El mundo es un **tensor `uint8` de 500 × 500 × 6** con doble búfer.

| Capa | Contenido | Kernel de difusión |
|---|---|---|
| 0 | Física: alfabeto Σ de 16 estados | — |
| 1 | Rastro de comida | Medio (60 / 10) |
| 2 | Alarma / peligro | Rápido (20 / 20) |
| 3 | Feromona real | Lento (80 / 5) |
| 4 | Necroferomonas | Medio |
| 5 | Reclutamiento | Medio |

### Ciclo de cada turno (`avanzar_tick`)

1. Se drena la **cola de acciones del Modo Dios** sobre la matriz actual, se registra la arena pintada como terreno y se copia la matriz actual a la siguiente.
2. **Física:** evaporación del 5 % por tabla y difusión por convolución en cruz, redondeada: `(suma + 50) // 100`. Los muros absorben la química.
3. **Biología**, en este orden: movimiento del depredador (radar de 8 casillas) → ataque del depredador → combate → veneno (tope del 8 % del mapa) → emisión de reinas, cadáveres, comida y basureros → recolección → cálculo de rumbos y rastro → movimiento de hormigas → ataque → combate → recolección → limpieza de cadáveres → nacimientos → emisión → muro perimetral y química anulada en los muros.
4. Se intercambian los búferes.
5. Se dibuja la capa 0 en el `<canvas>` y se espera `DELAY` segundos.

### Estructura

```
index.html
src/
├── constantes.js   Σ, capas, kernels, tabla de evaporación, colormap
├── tensor.js       Tensor y doble búfer
├── mundo.js        Mundo inicial (Reset)
├── fisica.js       Evaporación y difusión
├── biologia.js     Reglas biológicas del motor
├── render.js       Tensor → píxeles
├── pinceles.js     Cola de acciones del Modo Dios
├── main.js         Ciclo de vida y panel
└── css/styles.css
```

## Equivalencias con el motor en Python

| Python (NumPy) | JavaScript |
|---|---|
| Máscaras booleanas calculadas al inicio de cada regla | Copia (`foto`) de la capa física al inicio de cada regla |
| `trasladar` (fuera del mapa no hay nada) | Vecinos con comprobación de bordes |
| `argmax` + ruido de 1e-7 en float32 | Igual, con `Math.fround`: en un empate de valores ≥ 2 gana la primera dirección, como en el motor |
| `escanear_gradiente_quimico` sobre todo el tablero | Se evalúa solo en las celdas con hormiga o depredador; el resultado es el mismo |
| Radar con 8 `maximum_filter` sucesivos | Búsqueda en anchura desde las presas hasta 8 casillas; da el mismo mapa de calor |
| `_movimiento_vectorizado` por dirección en orden aleatorio | Igual, con celdas reservadas y arena restaurada al salir |
| `terreno_arena` | `motor.terreno` |

## Adaptaciones para la web

- **Pinceles Hormiga N. y Hormiga R.:** el boceto los pide, pero la API del Modo Dios no los acepta. En la web escriben `OBRERA_N` y `OBRERA_R`.
- **Integración de la API:** en el cuaderno, la instancia `motor_numpy` se crea sin `api`. En la web la cola siempre se procesa al inicio del tick, como hace el motor cuando recibe la API.
- **Mundo inicial:** el motor no define uno de 500 × 500. La web arranca vacía, solo con el muro perimetral, y el usuario construye todo con los pinceles.
- **Pinceles Colonia N. y Colonia R.:** cada clic pone un nido con su reina debajo, como en los mapas del motor. La API acepta `NIDO_N` y `NIDO_R`, pero no las reinas. Funcionan con clic, no al arrastrar, para no sembrar decenas de colonias en un trazo.
- **`DELAY` inicial:** 0,05 s, como en el boceto. El motor usa 0,5 s.
