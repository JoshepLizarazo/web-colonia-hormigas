// =====================================================================
// Física química (port de avanzar_tick del motor NumPy, Sprint 3)
// Evaporación por tabla + difusión por convolución en cruz, con muros que absorben.
// =====================================================================
import { M, N, CELDAS, CAPAS, MURO, TABLA_EVAPORACION, KERNELS } from './constantes.js';
import { capa } from './tensor.js';

// capa_limpia = evaporadas * libres
const limpia = new Uint8Array(CELDAS);

export function fisica(actual, siguiente) {
  const suelo = capa(actual, 0);

  for (let c = 1; c < CAPAS; c++) {
    const origen = capa(actual, c);
    const destino = capa(siguiente, c);
    const { centro, lado } = KERNELS[c - 1];

    for (let i = 0; i < CELDAS; i++) {
      limpia[i] = suelo[i] === MURO ? 0 : TABLA_EVAPORACION[origen[i]];
    }

    // convolve(mode="constant", cval=0), redondeado: (suma + 50) // 100, recortado a 0..255
    for (let y = 0; y < M; y++) {
      for (let x = 0; x < N; x++) {
        const i = y * N + x;
        const vecinos =
          (y > 0 ? limpia[i - N] : 0) + (y < M - 1 ? limpia[i + N] : 0) +
          (x > 0 ? limpia[i - 1] : 0) + (x < N - 1 ? limpia[i + 1] : 0);
        const v = Math.floor((centro * limpia[i] + lado * vecinos + 50) / 100);
        // matriz_siguiente[:, :, 1:6] *= libres
        destino[i] = suelo[i] === MURO ? 0 : v > 255 ? 255 : v;
      }
    }
  }
}
