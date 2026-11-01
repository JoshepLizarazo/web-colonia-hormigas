# 🐜 Simulador de Colonia de Hormigas — Modo Dios

![HTML5](https://img.shields.io/badge/HTML5-Canvas-E34F26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-responsive-1572B6?logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES%20Modules-F7DF1E?logo=javascript&logoColor=black)
![Dependencias](https://img.shields.io/badge/dependencias-0-success)

Autómata celular interactivo basado en **Optimización por Colonia de Hormigas (ACO)**. Dos colonias, negra y roja, compiten por la comida en un mundo de **500 × 500 celdas**. Ninguna hormiga "piensa": cada una solo mira su vecindad de 3 × 3 y se mueve según los gradientes de feromonas. Usted puede alterar el entorno en tiempo real con los pinceles.

> 📸 _Espacio para el GIF de la simulación (`assets/`)._

## Cómo correrlo

No requiere instalación ni compilación. Como usa módulos ES, se abre desde un servidor estático y no con doble clic:

```bash
python -m http.server 8000
```

Luego abra `http://localhost:8000`. También funciona directo en GitHub Pages.

## Manual rápido

| Control | Qué hace |
|---|---|
| **▶ Play / ⏸ Pausa / 🔄 Reset** | Arranca, detiene o regenera el mundo inicial. |
| **Pinceles** | Clic o arrastre sobre el mapa: Muro, Comida, Veneno, Hormiga N., Hormiga R., Borrar y Depredador. |
| **Grosor** | Tamaño del pincel: 1×1, 3×3, 5×5, 7×7 o 9×9. |
| **Visor químico** | Superpone el rastro de comida (azul) y la alarma (amarillo). |
| **Delay** | Pausa entre turnos, de 0 a 0,5 s (variable global `DELAY`). |
| **Estadísticas** | Turno actual y población viva de cada colonia. |

## Arquitectura

El mundo es un **único tensor `uint8` de M × N × 7**, sin objetos por hormiga, y funciona con **doble búfer** (`lectura` → `escritura` → intercambio).

| Capa | Contenido |
|---|---|
| 0 | Física: alfabeto Σ de 16 estados |
| 1 | Rastro de comida |
| 2 | Alarma / peligro |
| 3 | Feromona real negra (GPS al nido) |
| 4 | Necroferomonas |
| 5 | Reclutamiento (reservada) |
| 6 | Feromona real roja |

### Ciclo de cada turno

1. **Detección humana:** se aplican los trazos de los pinceles sobre la matriz de lectura.
2. **Física:** difusión por convolución 3 × 3 y evaporación entera de las capas químicas.
3. **Biología:** reglas δ de movimiento, recolección, combate y emisión.
4. **Doble búfer:** se intercambian las matrices.
5. **Renderizado:** la capa 0 se pinta en el `<canvas>` con un colormap fijo.
6. **Control de tiempo:** se espera `DELAY` segundos.

### Estructura

```
index.html
src/
├── constantes.js   Σ, capas, probabilidades y colormap
├── tensor.js       Tensor y doble búfer
├── mundo.js        Mundo inicial (Reset)
├── fisica.js       Difusión y evaporación
├── biologia.js     Funciones de transición δ
├── render.js       Tensor → píxeles
├── pinceles.js     Clic → (fila, columna) → sobrescritura
├── main.js         Ciclo de vida y panel
└── css/styles.css
```

## Reglas principales (δ)

- **Obrera sin carga:** sube por el rastro de comida, huye de la alarma y se aleja del nido. Mantiene un rumbo y gira de vez en cuando.
- **Obrera junto a comida:** la comida desaparece, la obrera queda cargada y se inyecta 255 en la capa 1.
- **Obrera cargada:** deja rastro y sube por la feromona real de su colonia. Al tocar su nido entrega la comida, que suma a las reservas.
- **Nido:** si la reina vive y hay reservas, produce obreras (80 %) y soldados (20 %).
- **Soldado:** acude a la alarma. Si dos soldados enemigos se tocan, ambas celdas pasan a VACIO. Mata a las obreras y a la reina enemigas.
- **Veneno:** se expande lentamente y convierte en cadáver a toda hormiga vecina.
- **Depredador:** deambula y convierte en VACIO a cualquier hormiga vecina.
- **Cadáver:** emite necroferomonas, las obreras lo limpian y se descompone con el tiempo.

## Decisiones respecto al documento de arquitectura

| Tema | Decisión | Por qué |
|---|---|---|
| Profundidad del tensor | 7 capas en lugar de 6 | Cada colonia necesita su propia feromona real; con una sola, las obreras rojas regresarían al nido negro. |
| Bits libres del `uint8` | Bit 4 = carga comida, bit 5 = sobre arena, bits 6-7 = rumbo | Σ solo ocupa 4 bits. Así se guarda lo que el alfabeto no cubre sin romperlo. |
| Feromona real | Propagación tipo onda (máximo 3 × 3 − 1) | Con difusión + evaporación en `uint8` el olor del nido no llega a más de ~7 celdas; la onda da un gradiente de ~250 celdas que rodea los muros. |
| Kernel de difusión | `[1 c 1]` con `c` distinto por capa | Permite que la alarma se expanda rápido y que el rastro de comida sea fino y duradero. |
| Agua | No incluida | Se menciona en la visión general, pero no está en el alfabeto de 16 estados. |
