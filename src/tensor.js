// =====================================================================
// Tensor M×N×CAPAS en uint8 con arquitectura doble búfer (sección 7.1)
// =====================================================================
import { CELDAS, CAPAS } from './constantes.js';

// Las capas se guardan una detrás de otra (tensor[:, :, c] es un bloque
// contiguo de CELDAS bytes). Así cada capa se recorre de forma lineal.
function crearTensor() {
  return new Uint8Array(CELDAS * CAPAS);
}

export const motor = {
  lectura: crearTensor(),
  escritura: crearTensor(),
};

// Vista de una capa: equivale a tensor[:, :, c] en NumPy.
export function capa(tensor, c) {
  return tensor.subarray(c * CELDAS, (c + 1) * CELDAS);
}

// Fin del tick: la matriz de escritura pasa a ser la de lectura.
// Intercambiar referencias equivale a matriz_lectura = matriz_escritura.copy()
// sin copiar 1,75 MB por turno; la escritura se rellena completa en el siguiente tick.
export function intercambiar() {
  const anterior = motor.lectura;
  motor.lectura = motor.escritura;
  motor.escritura = anterior;
}
