// =====================================================================
// Inyección de eventos: clics del usuario sobre el lienzo (sección 6.3)
// Píxel de pantalla → (fila, columna) → sobrescritura forzosa del estado.
// =====================================================================
import {
  M, N, MASCARA_ESTADO, TIERRA, ARENA, FLAG_ARENA, DESPLAZAMIENTO_RUMBO,
  OBRERA_N, SOLDADO_N, OBRERA_R, SOLDADO_R,
} from './constantes.js';
import { capa } from './tensor.js';
import { rumboAlAzar } from './biologia.js';

export const GROSORES = [1, 3, 5, 7, 9];

export const pincel = { estado: 0, grosor: 3 };

// Trazos pendientes [fila, col, estado, grosor, ...]; se aplican en el paso 1 del ciclo.
const pendientes = [];

const esHormiga = (e) => e === OBRERA_N || e === SOLDADO_N || e === OBRERA_R || e === SOLDADO_R;

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
    if (!ultima) return;
    const actual = celda(ev);
    trazarLinea(ultima, actual);
    ultima = actual;
    alPintar();
  });

  const soltar = () => { ultima = null; };
  canvas.addEventListener('pointerup', soltar);
  canvas.addEventListener('pointercancel', soltar);
}

function encolar(fila, col) {
  pendientes.push(fila, col, pincel.estado, pincel.grosor);
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

export function aplicarPendientes(tensor) {
  const fisica = capa(tensor, 0);
  for (let k = 0; k < pendientes.length; k += 4) {
    const [fila, col, estado, grosor] = pendientes.slice(k, k + 4);
    const radio = (grosor - 1) / 2;
    // El borde del mundo es el muro perimetral y no se pinta.
    for (let f = Math.max(1, fila - radio); f <= Math.min(M - 2, fila + radio); f++) {
      for (let c = Math.max(1, col - radio); c <= Math.min(N - 2, col + radio); c++) {
        const i = f * N + c;
        const actual = fisica[i] & MASCARA_ESTADO;
        if (esHormiga(estado)) {
          // Las hormigas solo nacen sobre suelo libre
          if (actual === TIERRA || actual === ARENA) {
            fisica[i] = estado | (actual === ARENA ? FLAG_ARENA : 0) | (rumboAlAzar() << DESPLAZAMIENTO_RUMBO);
          }
        } else {
          fisica[i] = estado;
        }
      }
    }
  }
  pendientes.length = 0;
}
