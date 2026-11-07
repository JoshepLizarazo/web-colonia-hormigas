// =====================================================================
// Inyección de eventos: clics del usuario sobre el lienzo (sección 6.3)
// Port de la API Modo Dios: cola de acciones que se drena al inicio del tick.
// =====================================================================
import { M, N, CELDAS, CAPAS, VACIO, NIDO_N, REINA_N, NIDO_R, REINA_R } from './constantes.js';
import { capa } from './tensor.js';

export const GROSORES = [1, 3, 5, 7, 9];

// Modos de pincel: pintar_celda, borrar_celda y colocar una colonia.
export const PINTAR = 0;
export const BORRAR = 1;
export const COLONIA = 2;

// Colonia: nido en la celda del clic y su reina debajo, como en los mapas del motor.
const REINA_DE = { [NIDO_N]: REINA_N, [NIDO_R]: REINA_R };

export const pincel = { estado: 0, modo: PINTAR, grosor: 3 };

// Cola de acciones pendientes [fila, col, estado, modo, grosor, ...].
const cola = [];

export function conectarLienzo(canvas, alPintar) {
  let ultima = null;

  const celda = (ev) => {
    const caja = canvas.getBoundingClientRect();
    return [
      Math.floor(((ev.clientY - caja.top) / caja.height) * M),
      Math.floor(((ev.clientX - caja.left) / caja.width) * N),
    ];
  };

  canvas.addEventListener('pointerdown', (ev) => {
    canvas.setPointerCapture(ev.pointerId);
    ultima = celda(ev);
    encolar(ultima[0], ultima[1]);
    alPintar();
  });

  canvas.addEventListener('pointermove', (ev) => {
    // Una colonia por clic: arrastrar no siembra más nidos
    if (!ultima || pincel.modo === COLONIA) return;
    const actual = celda(ev);
    trazarLinea(ultima, actual);
    ultima = actual;
    alPintar();
  });

  const soltar = () => { ultima = null; };
  canvas.addEventListener('pointerup', soltar);
  canvas.addEventListener('pointercancel', soltar);
}

// pintar_celda / borrar_celda / colonia
function encolar(fila, col) {
  cola.push(fila, col, pincel.estado, pincel.modo, pincel.grosor);
}

// Bresenham: un arrastre rápido no deja huecos entre dos lecturas del puntero.
function trazarLinea([f0, c0], [f1, c1]) {
  const df = Math.abs(f1 - f0), dc = Math.abs(c1 - c0);
  const sf = f0 < f1 ? 1 : -1, sc = c0 < c1 ? 1 : -1;
  let error = dc - df;
  let f = f0, c = c0;
  while (f !== f1 || c !== c1) {
    const e2 = 2 * error;
    if (e2 > -df) { error -= df; c += sc; }
    if (e2 < dc) { error += dc; f += sf; }
    encolar(f, c);
  }
}

const recortar = (v, max) => Math.max(0, Math.min(max, v));

// procesar_cola_acciones + _aplicar_accion
export function procesarCola(tensor) {
  const fisica = capa(tensor, 0);
  for (let k = 0; k < cola.length; k += 5) {
    const [fila, col, estado, modo, grosor] = cola.slice(k, k + 5);
    if (modo === COLONIA) {
      // Dentro del muro perimetral, con espacio para la reina debajo
      if (fila >= 1 && fila <= M - 3 && col >= 1 && col <= N - 2) {
        fisica[fila * N + col] = estado;
        fisica[(fila + 1) * N + col] = REINA_DE[estado];
      }
      continue;
    }
    const radio = grosor >> 1;
    const f0 = recortar(fila - radio, M - 1), f1 = recortar(fila + radio, M - 1);
    const c0 = recortar(col - radio, N - 1), c1 = recortar(col + radio, N - 1);
    for (let f = f0; f <= f1; f++) {
      for (let c = c0; c <= c1; c++) {
        const i = f * N + c;
        if (modo === BORRAR) {
          fisica[i] = VACIO;
          for (let q = 1; q < CAPAS; q++) tensor[q * CELDAS + i] = 0;
        } else {
          fisica[i] = estado;
        }
      }
    }
  }
  cola.length = 0;
}
