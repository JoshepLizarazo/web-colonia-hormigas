# 🐜 Simulador de Colonia de Hormigas — Modo Dios

![HTML5](https://img.shields.io/badge/HTML5-Canvas-E34F26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-responsive-1572B6?logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES%20Modules-F7DF1E?logo=javascript&logoColor=black)
![Dependencias](https://img.shields.io/badge/dependencias-0-success)

Autómata celular interactivo basado en **Optimización por Colonia de Hormigas (ACO)**. Dos colonias, negra y roja, conviven en un mundo de **500 × 500 celdas**, y usted puede alterar el entorno en tiempo real con los pinceles.

El motor es un **port a JavaScript del motor NumPy del Subgrupo 3 (Sprint 3)**: mismas constantes, kernels, tabla de evaporación y reglas, en el mismo orden. Así se puede ver en el navegador, sin Colab, exactamente lo que calcula el motor en Python.

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
| **Pinceles** | El mapa arranca vacío. Colonia N. y Colonia R. ponen un nido con su reina en cada clic. Muro, Comida, Veneno, Hormiga N., Hormiga R., Borrar y Depredador pintan con clic o arrastre. |
| **Grosor** | Tamaño del pincel: 1×1, 3×3, 5×5, 7×7 o 9×9. |
| **Visor químico** | Superpone el rastro de comida (azul) y la alarma (amarillo). |
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

1. Se copia la matriz actual a la siguiente y se drena la **cola de acciones del Modo Dios**.
2. **Física:** evaporación del 5 % por tabla y difusión por convolución en cruz `// 100`. Los muros absorben la química.
3. **Biología**, en este orden: depredador → combate → veneno → emisión de reinas y cadáveres → movimiento → recolección → limpieza de cadáveres → nacimientos → muro perimetral.
4. Los muros nuevos borran la química (`libres_post`) y se intercambian los búferes.
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
| `np.roll` (la vecindad da la vuelta en los bordes) | Índices vecinos con módulo |
| `argmax` + ruido de 0.01 para desempatar | Máximo con desempate uniforme al azar |
| `escanear_gradiente_quimico` sobre todo el tablero | Se evalúa solo en las celdas con hormiga; el resultado es el mismo |
| Las 8 direcciones de movimiento en orden aleatorio | Igual; los movimientos de cada dirección se aplican a la vez |

## Adaptaciones para la web

- **Pinceles Hormiga N. y Hormiga R.:** el boceto los pide, pero la API del Modo Dios no los acepta. En la web escriben `OBRERA_N` y `OBRERA_R`.
- **Integración de la API:** en el cuaderno, la llamada a `procesar_cola_acciones` está comentada dentro de `avanzar_tick`. En la web se ejecuta en ese mismo punto.
- **Mundo inicial:** el motor no define uno de 500 × 500. La web arranca vacía, solo con el muro perimetral, y el usuario construye todo con los pinceles.
- **Pinceles Colonia N. y Colonia R.:** cada clic pone un nido con su reina debajo, como en los mapas del motor. La API acepta `NIDO_N` y `NIDO_R`, pero no las reinas. Funcionan con clic, no al arrastrar, para no sembrar decenas de colonias en un trazo.
- **`DELAY` inicial:** 0,05 s, como en el boceto. El motor usa 0,5 s.
