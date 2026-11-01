// =====================================================================
// Física de fluidos: difusión y evaporación de las feromonas (sección 7.2)
// Lee las capas químicas de la matriz de lectura y escribe en la de escritura.
// =====================================================================
import {
  M, N, CELDAS, CAPAS, MASCARA_ESTADO, MURO, ARENA, FLAG_ARENA,
  CAPA_REAL_N, CAPA_REAL_R, CONSERVACION, CONSERVACION_ARENA, CENTRO_KERNEL,
  DECAIMIENTO_REAL, DECAIMIENTO_REAL_ARENA,
} from './constantes.js';
import { capa } from './tensor.js';

// Resultado intermedio de la pasada horizontal (máximo 255 × (c + 2)).
const parcial = new Uint16Array(CELDAS);

export function fisica(lectura, escritura) {
  const suelo = capa(lectura, 0);
  for (let c = 1; c < CAPAS; c++) {
    const origen = capa(lectura, c);
    const destino = capa(escritura, c);
    if (c === CAPA_REAL_N || c === CAPA_REAL_R) propagarOnda(suelo, origen, destino);
    else difundir(suelo, origen, destino, CENTRO_KERNEL[c], CONSERVACION[c]);
  }
}

// Difusión por convolución con el kernel 3×3 [1 c 1]ᵀ·[1 c 1] / (c + 2)² y
// evaporación entera. El kernel es separable: una pasada horizontal y otra
// vertical procesan todo el tablero, equivalente a scipy.signal.convolve2d.
function difundir(suelo, origen, destino, centro, conserva) {
  for (let y = 0; y < M; y++) {
    const f = y * N;
    parcial[f] = centro * origen[f] + origen[f + 1];
    for (let i = f + 1; i < f + N - 1; i++) {
      parcial[i] = origen[i - 1] + centro * origen[i] + origen[i + 1];
    }
    parcial[f + N - 1] = origen[f + N - 2] + centro * origen[f + N - 1];
  }

  const divisor = (centro + 2) * (centro + 2);
  const medio = divisor >> 1;
  for (let i = 0; i < CELDAS; i++) {
    const arriba = i >= N ? parcial[i - N] : 0;
    const abajo = i < CELDAS - N ? parcial[i + N] : 0;
    let v = ((arriba + centro * parcial[i] + abajo + medio) / divisor) | 0;

    const byte = suelo[i];
    const estado = byte & MASCARA_ESTADO;
    if (estado === MURO) {
      v = 0; // El muro bloquea los olores
    } else {
      v = ((v * conserva) / 100) | 0;
      if (estado === ARENA || (byte & FLAG_ARENA)) v = ((v * CONSERVACION_ARENA) / 100) | 0;
    }
    destino[i] = v;
  }
}

// Feromona real: con difusión + evaporación en uint8 el olor del nido no
// pasa de ~7 celdas y las obreras cargadas nunca encuentran el camino.
// Se usa una dilatación 3×3 (máximo de la vecindad, como
// scipy.ndimage.maximum_filter) menos un decaimiento fijo: la señal avanza
// una celda por tick, baja de 1 en 1 y, como los muros valen 0, rodea los obstáculos.
function propagarOnda(suelo, origen, destino) {
  for (let y = 0; y < M; y++) {
    const f = y * N;
    parcial[f] = Math.max(origen[f], origen[f + 1]);
    for (let i = f + 1; i < f + N - 1; i++) {
      parcial[i] = Math.max(origen[i - 1], origen[i], origen[i + 1]);
    }
    parcial[f + N - 1] = Math.max(origen[f + N - 2], origen[f + N - 1]);
  }

  for (let i = 0; i < CELDAS; i++) {
    const arriba = i >= N ? parcial[i - N] : 0;
    const abajo = i < CELDAS - N ? parcial[i + N] : 0;
    const byte = suelo[i];
    const estado = byte & MASCARA_ESTADO;
    if (estado === MURO) {
      destino[i] = 0;
      continue;
    }
    const caida = estado === ARENA || (byte & FLAG_ARENA) ? DECAIMIENTO_REAL_ARENA : DECAIMIENTO_REAL;
    const v = Math.max(arriba, parcial[i], abajo) - caida;
    destino[i] = v > 0 ? v : 0;
  }
}
