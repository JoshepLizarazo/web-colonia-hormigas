// =====================================================================
// Generación del mundo inicial (estado que restaura el botón Reset)
// Nidos al estilo del motor: una celda de nido con la reina al lado.
// =====================================================================
import {
  M, N, VACIO, ARENA_SECA, MURO, COMIDA, VENENO, DEPREDADOR,
  NIDO_N, REINA_N, NIDO_R, REINA_R,
} from './constantes.js';
import { capa } from './tensor.js';

const azar = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

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
  for (let k = 0; k < 7; k++) circulo(azar(40, 460), azar(40, 460), azar(18, 40), ARENA_SECA);

  // Muro central con un paso en el medio
  rectangulo(60, 248, 200, 251, MURO);
  rectangulo(300, 248, 440, 251, MURO);
  for (let k = 0; k < 4; k++) {
    const f = azar(30, 470), c = azar(30, 470);
    if (Math.random() < 0.5) rectangulo(f, c, f + 1, c + azar(20, 60), MURO);
    else rectangulo(f, c, f + azar(20, 60), c + 1, MURO);
  }

  // Comida: un botín central y fuentes a distintas distancias de cada nido
  circulo(250, 250, 10, COMIDA);
  circulo(220, 140, 6, COMIDA);
  circulo(280, 360, 6, COMIDA);
  circulo(185, 150, 8, COMIDA);
  circulo(315, 350, 8, COMIDA);
  circulo(35, 250, 8, COMIDA);
  circulo(465, 250, 8, COMIDA);

  // Charcos de veneno y un depredador
  circulo(azar(60, 440), azar(60, 200), 2, VENENO);
  circulo(azar(60, 440), azar(300, 440), 2, VENENO);
  poner(azar(100, 400), azar(200, 300), DEPREDADOR);

  // Nidos: se despeja la zona y se pone el nido con la reina debajo
  for (const [fila, col, nido, reina] of [[250, 110, NIDO_N, REINA_N], [250, 390, NIDO_R, REINA_R]]) {
    circulo(fila, col, 15, VACIO);
    poner(fila, col, nido);
    poner(fila + 1, col, reina);
  }

  // Muro perimetral (crear_tensor con marco)
  for (let x = 0; x < N; x++) {
    fisica[x] = MURO;
    fisica[(M - 1) * N + x] = MURO;
  }
  for (let y = 0; y < M; y++) {
    fisica[y * N] = MURO;
    fisica[y * N + N - 1] = MURO;
  }
}
