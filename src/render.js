// =====================================================================
// Renderizado visual del tensor (sección 6.1)
// Convierte la Capa 0 en colores y superpone las capas químicas elegidas.
// =====================================================================
import {
  M, N, CELDAS, MASCARA_ESTADO, ARENA, ESTADOS,
  CAPA_COMIDA, CAPA_ALARMA, COLOR_RASTRO_COMIDA, COLOR_ALARMA,
} from './constantes.js';
import { capa } from './tensor.js';

const aRGB = (hex) => [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16));

// Colormap por estado, separado en canales para mezclar rápido.
const ROJO = new Uint8Array(16);
const VERDE = new Uint8Array(16);
const AZUL = new Uint8Array(16);
for (const { id, color } of ESTADOS) [ROJO[id], VERDE[id], AZUL[id]] = aRGB(color);

const RASTRO = aRGB(COLOR_RASTRO_COMIDA);
const ALARMA = aRGB(COLOR_ALARMA);

let contexto, imagen, pixeles;

export function prepararLienzo(canvas) {
  canvas.width = N;
  canvas.height = M;
  contexto = canvas.getContext('2d');
  imagen = contexto.createImageData(N, M);
  pixeles = new Uint32Array(imagen.data.buffer); // ABGR en little-endian
}

export function dibujar(tensor, verRastro, verAlarma) {
  const fisica = capa(tensor, 0);
  const rastro = capa(tensor, CAPA_COMIDA);
  const alarma = capa(tensor, CAPA_ALARMA);
  const quimica = verRastro || verAlarma;

  for (let i = 0; i < CELDAS; i++) {
    const e = fisica[i] & MASCARA_ESTADO;
    let r = ROJO[e], g = VERDE[e], b = AZUL[e];

    // Las feromonas se pintan solo sobre el suelo para no tapar a las hormigas.
    if (quimica && e <= ARENA) {
      if (verRastro && rastro[i]) {
        const a = Math.min(1, rastro[i] / 160) * 0.9;
        r += (RASTRO[0] - r) * a; g += (RASTRO[1] - g) * a; b += (RASTRO[2] - b) * a;
      }
      if (verAlarma && alarma[i]) {
        const a = Math.min(1, alarma[i] / 160) * 0.9;
        r += (ALARMA[0] - r) * a; g += (ALARMA[1] - g) * a; b += (ALARMA[2] - b) * a;
      }
    }
    pixeles[i] = 0xff000000 | (b << 16) | (g << 8) | r;
  }
  contexto.putImageData(imagen, 0, 0);
}
