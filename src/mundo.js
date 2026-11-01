// =====================================================================
// Generación del mundo inicial (estado que restaura el botón Reset)
// =====================================================================
import {
  M, N, CELDAS, TIERRA, ARENA, MURO, COMIDA, VENENO, DESPLAZAMIENTO_RUMBO,
  COLONIAS, NEGRA, ROJA, RESERVAS_INICIALES, OBRERAS_INICIALES, SOLDADOS_INICIALES,
} from './constantes.js';
import { capa } from './tensor.js';
import { colonias, rumboAlAzar } from './biologia.js';

const azar = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

// Posición (fila, columna) del centro de cada nido.
const NIDOS = [
  { fila: 250, col: 110, colonia: NEGRA },
  { fila: 250, col: 390, colonia: ROJA },
];

export function generarMundo(tensor) {
  tensor.fill(0);
  const fisica = capa(tensor, 0);

  // Solo se pinta el interior: el borde queda reservado para el muro perimetral.
  const poner = (fila, col, estado) => {
    if (fila > 0 && fila < M - 1 && col > 0 && col < N - 1) fisica[fila * N + col] = estado;
  };
  const circulo = (fila, col, radio, estado) => {
    for (let dy = -radio; dy <= radio; dy++) {
      for (let dx = -radio; dx <= radio; dx++) {
        if (dx * dx + dy * dy <= radio * radio) poner(fila + dy, col + dx, estado);
      }
    }
  };
  const rectangulo = (f0, c0, f1, c1, estado) => {
    for (let f = f0; f <= f1; f++) for (let c = c0; c <= c1; c++) poner(f, c, estado);
  };

  // Dunas de arena seca
  for (let k = 0; k < 7; k++) circulo(azar(40, 460), azar(40, 460), azar(18, 40), ARENA);

  // Muro central con un paso en el medio: obliga a las colonias a disputarse el centro
  rectangulo(60, 248, 200, 251, MURO);
  rectangulo(300, 248, 440, 251, MURO);
  // Muros sueltos
  for (let k = 0; k < 4; k++) {
    const f = azar(30, 470), c = azar(30, 470);
    if (Math.random() < 0.5) rectangulo(f, c, f + 1, c + azar(20, 60), MURO);
    else rectangulo(f, c, f + azar(20, 60), c + 1, MURO);
  }

  // Comida: un botín central disputado, fuentes cercanas a cada nido y dos lejanas
  circulo(250, 250, 10, COMIDA);
  circulo(185, 150, 8, COMIDA);
  circulo(315, 150, 8, COMIDA);
  circulo(185, 350, 8, COMIDA);
  circulo(315, 350, 8, COMIDA);
  circulo(35, 250, 8, COMIDA);
  circulo(465, 250, 8, COMIDA);
  circulo(azar(40, 460), azar(40, 460), 6, COMIDA);

  // Charcos de veneno
  circulo(azar(60, 440), azar(60, 200), 3, VENENO);
  circulo(azar(60, 440), azar(300, 440), 3, VENENO);

  // Nidos: se despeja la zona, 5×5 de nido con la reina en el centro
  for (const { fila, col, colonia } of NIDOS) {
    const c = COLONIAS[colonia];
    circulo(fila, col, 18, TIERRA);
    rectangulo(fila - 2, col - 2, fila + 2, col + 2, c.nido);
    poner(fila, col, c.reina);
    sembrarHormigas(fisica, fila, col, c.obrera, OBRERAS_INICIALES);
    sembrarHormigas(fisica, fila, col, c.soldado, SOLDADOS_INICIALES);
    colonias.reservas[colonia] = RESERVAS_INICIALES;
    colonias.reinaViva[colonia] = true;
  }

  // Muro perimetral
  for (let x = 0; x < N; x++) {
    fisica[x] = MURO;
    fisica[(M - 1) * N + x] = MURO;
  }
  for (let y = 0; y < M; y++) {
    fisica[y * N] = MURO;
    fisica[y * N + N - 1] = MURO;
  }
}

function sembrarHormigas(fisica, fila, col, estado, cantidad) {
  let puestas = 0;
  for (let intentos = 0; puestas < cantidad && intentos < cantidad * 20; intentos++) {
    const i = (fila + azar(-15, 15)) * N + (col + azar(-15, 15));
    if (i > 0 && i < CELDAS && fisica[i] === TIERRA) {
      fisica[i] = estado | (rumboAlAzar() << DESPLAZAMIENTO_RUMBO);
      puestas++;
    }
  }
}
