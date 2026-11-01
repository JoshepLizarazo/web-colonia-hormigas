// =====================================================================
// Lógica de entorno y biología: funciones de transición δ (sección 8)
// Lee la matriz de lectura y escribe el nuevo estado en la de escritura.
// La hormiga no se "mueve": la celda vecina vacía pasa a ser hormiga y
// la celda original vuelve a ser tierra.
// =====================================================================
import {
  M, N, CELDAS, MASCARA_ESTADO, FLAG_CARGA, FLAG_ARENA, MASCARA_RUMBO, DESPLAZAMIENTO_RUMBO,
  PERSISTENCIA, PROB_GIRO,
  TIERRA, ARENA, COMIDA, VENENO, CADAVER, DEPREDADOR,
  NIDO_N, REINA_N, OBRERA_N, SOLDADO_N, NIDO_R, REINA_R, OBRERA_R, SOLDADO_R,
  CAPA_COMIDA, CAPA_ALARMA, CAPA_NECRO, COLONIAS, NEGRA, ROJA,
  PROB_MUERTE_NATURAL, PROB_NACIMIENTO, PROPORCION_SOLDADOS, PROB_LIMPIEZA,
  PROB_DESCOMPOSICION, PROB_EXPANSION_VENENO, PROB_MOVER_DEPREDADOR, RASTRO_REGRESO, OLOR_COMIDA,
} from './constantes.js';
import { capa } from './tensor.js';

// Vecindad de Moore (8 vecinos) como desplazamientos de índice.
const VECINOS = [-N - 1, -N, -N + 1, -1, 1, N - 1, N, N + 1];
const VECINO_DY = [-1, -1, -1, 0, 0, 1, 1, 1];
const VECINO_DX = [-1, 0, 1, -1, 1, -1, 0, 1];

// Rumbos diagonales (dy, dx): 0 = NE, 1 = SE, 2 = SO, 3 = NO.
const RUMBO_DY = [-1, 1, 1, -1];
const RUMBO_DX = [1, 1, -1, -1];

const rumboDe = (byte) => (byte & MASCARA_RUMBO) >> DESPLAZAMIENTO_RUMBO;
const conRumbo = (valor, rumbo) => (valor & ~MASCARA_RUMBO) | (rumbo << DESPLAZAMIENTO_RUMBO);
export const rumboAlAzar = () => (Math.random() * 4) | 0;

// Rumbo diagonal que más se parece a un paso hacia el vecino k.
function rumboDelPaso(k) {
  const dy = VECINO_DY[k] || (Math.random() < 0.5 ? -1 : 1);
  const dx = VECINO_DX[k] || (Math.random() < 0.5 ? -1 : 1);
  if (dy < 0) return dx > 0 ? 0 : 3;
  return dx > 0 ? 1 : 2;
}

// Estado global de cada colonia: comida almacenada y si su reina vive.
export const colonias = { reservas: [0, 0], reinaViva: [true, true] };

// Modos de movimiento: qué gradientes químicos persigue cada casta.
const EXPLORAR = 0;  // Obrera sin carga: sigue comida, huye de la alarma y del nido
const REGRESAR = 1;  // Obrera cargada: sube por la feromona real de su colonia
const PATRULLAR = 2; // Soldado: acude a la alarma y recorre los rastros
const DEAMBULAR = 3; // Depredador: paseo aleatorio

// Vistas de las capas para el tick en curso.
let fisL, fisE, comidaL, alarmaL, necroL, comidaE, alarmaE, necroE;
const realL = [null, null];
const realE = [null, null];

const candidatos = new Int32Array(8);
const direcciones = new Int32Array(8);
const pesos = new Float64Array(8);

export function biologia(lectura, escritura, tick) {
  fisL = capa(lectura, 0);
  fisE = capa(escritura, 0);
  comidaL = capa(lectura, CAPA_COMIDA);
  alarmaL = capa(lectura, CAPA_ALARMA);
  necroL = capa(lectura, CAPA_NECRO);
  comidaE = capa(escritura, CAPA_COMIDA);
  alarmaE = capa(escritura, CAPA_ALARMA);
  necroE = capa(escritura, CAPA_NECRO);
  for (const col of [NEGRA, ROJA]) {
    realL[col] = capa(lectura, COLONIAS[col].capaReal);
    realE[col] = capa(escritura, COLONIAS[col].capaReal);
  }

  // Lo que nadie modifica en este turno se conserva tal cual.
  fisE.set(fisL);

  // Se alterna el sentido del barrido para que ninguna dirección gane siempre los empates.
  const adelante = tick % 2 === 0;
  for (let yy = 1; yy < M - 1; yy++) {
    const y = adelante ? yy : M - 1 - yy;
    for (let xx = 1; xx < N - 1; xx++) {
      const i = y * N + (adelante ? xx : N - 1 - xx);
      const byte = fisL[i];
      switch (byte & MASCARA_ESTADO) {
        case OBRERA_N: obrera(i, byte, NEGRA); break;
        case OBRERA_R: obrera(i, byte, ROJA); break;
        case SOLDADO_N: soldado(i, byte, NEGRA); break;
        case SOLDADO_R: soldado(i, byte, ROJA); break;
        case REINA_N: reina(i, NEGRA); break;
        case REINA_R: reina(i, ROJA); break;
        case NIDO_N: nido(i, NEGRA); break;
        case NIDO_R: nido(i, ROJA); break;
        case COMIDA: emitir(comidaE, i, OLOR_COMIDA); break;
        case CADAVER: cadaver(i); break;
        case VENENO: veneno(i); break;
        case DEPREDADOR: depredador(i); break;
      }
    }
  }
}

// Cuenta la población de la matriz y actualiza qué reinas siguen vivas.
export function censo(tensor) {
  const fisica = capa(tensor, 0);
  let negras = 0, rojas = 0, reinasN = 0, reinasR = 0;
  for (let i = 0; i < CELDAS; i++) {
    switch (fisica[i] & MASCARA_ESTADO) {
      case OBRERA_N: case SOLDADO_N: negras++; break;
      case OBRERA_R: case SOLDADO_R: rojas++; break;
      case REINA_N: reinasN++; break;
      case REINA_R: reinasR++; break;
    }
  }
  colonias.reinaViva[NEGRA] = reinasN > 0;
  colonias.reinaViva[ROJA] = reinasR > 0;
  return { negras, rojas };
}

// ---------------------------------------------------------------------
// Utilidades de escritura
// ---------------------------------------------------------------------
const esSuelo = (e) => e === TIERRA || e === ARENA;

// Una celda está libre si es suelo antes y después de lo ya escrito en este turno.
function libre(n) {
  return esSuelo(fisL[n] & MASCARA_ESTADO) && esSuelo(fisE[n] & MASCARA_ESTADO);
}

function ocupar(n, valor) {
  fisE[n] = valor | ((fisE[n] & MASCARA_ESTADO) === ARENA ? FLAG_ARENA : 0);
}

// Devuelve la celda al suelo que la hormiga tenía debajo.
function liberar(i) {
  fisE[i] = fisL[i] & FLAG_ARENA ? ARENA : TIERRA;
}

function emitir(capaQuimica, i, valor) {
  if (capaQuimica[i] < valor) capaQuimica[i] = valor;
}

function morir(i) {
  fisE[i] = CADAVER;
  emitir(alarmaE, i, 255);
}

// ---------------------------------------------------------------------
// Escáner de vecindad (sección 8.3)
// ---------------------------------------------------------------------
let hayVeneno, hayDepredador, haySoldadoEnemigo, hayObreraEnemiga, hayReinaEnemiga, hayNidoPropio;
let vecinoComida, vecinoCadaver;

function escanear(i, col) {
  const propia = COLONIAS[col];
  const enemiga = COLONIAS[1 - col];
  hayVeneno = hayDepredador = haySoldadoEnemigo = hayObreraEnemiga = hayReinaEnemiga = hayNidoPropio = false;
  vecinoComida = vecinoCadaver = -1;
  for (let k = 0; k < 8; k++) {
    const n = i + VECINOS[k];
    const e = fisL[n] & MASCARA_ESTADO;
    if (e === VENENO) hayVeneno = true;
    else if (e === DEPREDADOR) hayDepredador = true;
    else if (e === enemiga.soldado) haySoldadoEnemigo = true;
    else if (e === enemiga.obrera) hayObreraEnemiga = true;
    else if (e === enemiga.reina) hayReinaEnemiga = true;
    else if (e === COMIDA) vecinoComida = n;
    else if (e === CADAVER) vecinoCadaver = n;
    else if (e === propia.nido || e === propia.reina) hayNidoPropio = true;
  }
}

// Elige un vecino libre por ruleta: cada candidato pesa exp(puntaje), donde el
// puntaje combina los gradientes químicos y la preferencia por seguir el rumbo.
function mover(i, valor, modo, col) {
  const real = col < 0 ? null : realL[col];
  let rumbo = rumboDe(fisL[i]);
  const rdy = RUMBO_DY[rumbo], rdx = RUMBO_DX[rumbo];
  let total = 0;
  let cuantos = 0;
  for (let k = 0; k < 8; k++) {
    const n = i + VECINOS[k];
    if (!libre(n)) continue;
    const alineacion = VECINO_DY[k] * rdy + VECINO_DX[k] * rdx; // de -2 a 2
    let s = 0;
    if (modo === EXPLORAR) s = 0.06 * comidaL[n] - 0.04 * alarmaL[n] + 0.006 * necroL[n] - 0.05 * real[n] + PERSISTENCIA * alineacion;
    else if (modo === REGRESAR) s = 0.8 * real[n] + 0.005 * comidaL[n];
    else if (modo === PATRULLAR) s = 0.05 * alarmaL[n] + 0.015 * comidaL[n] + PERSISTENCIA * alineacion;
    else s = PERSISTENCIA * alineacion;
    candidatos[cuantos] = n;
    direcciones[cuantos] = k;
    pesos[cuantos] = Math.exp(s);
    total += pesos[cuantos];
    cuantos++;
  }
  if (cuantos === 0) {
    // Encerrada: se queda quieta y prueba otro rumbo
    fisE[i] = conRumbo(fisE[i], rumboAlAzar());
    return;
  }

  let r = Math.random() * total;
  let elegido = 0;
  for (; elegido < cuantos - 1; elegido++) {
    r -= pesos[elegido];
    if (r <= 0) break;
  }

  const k = direcciones[elegido];
  if (modo === REGRESAR || VECINO_DY[k] * rdy + VECINO_DX[k] * rdx < 0) {
    // De regreso, o si un obstáculo la desvió, adopta la dirección del paso
    rumbo = rumboDelPaso(k);
  } else if (Math.random() < PROB_GIRO) {
    rumbo = (rumbo + (Math.random() < 0.5 ? 1 : 3)) & 3;
  }
  liberar(i);
  ocupar(candidatos[elegido], conRumbo(valor, rumbo));
}

// ---------------------------------------------------------------------
// Reglas por estado
// ---------------------------------------------------------------------
function obrera(i, byte, col) {
  escanear(i, col);
  if (hayDepredador) { liberar(i); emitir(alarmaE, i, 255); return; }
  if (hayVeneno || haySoldadoEnemigo || Math.random() < PROB_MUERTE_NATURAL) { morir(i); return; }

  const valor = byte & (MASCARA_ESTADO | FLAG_CARGA);

  if (byte & FLAG_CARGA) {
    // Entrega la comida al tocar su nido o su reina
    if (hayNidoPropio) {
      // Entrega y da media vuelta para volver por donde vino
      fisE[i] = conRumbo(byte & ~FLAG_CARGA, (rumboDe(byte) + 2) & 3);
      colonias.reservas[col]++;
      return;
    }
    emitir(comidaE, i, RASTRO_REGRESO);
    mover(i, valor, REGRESAR, col);
    return;
  }

  // Recolección: la comida desaparece y se inyecta 255 en la Capa 1
  if (vecinoComida >= 0 && (fisE[vecinoComida] & MASCARA_ESTADO) === COMIDA) {
    fisE[vecinoComida] = TIERRA;
    fisE[i] = byte | FLAG_CARGA;
    emitir(comidaE, i, 255);
    return;
  }

  // Limpieza: retira cadáveres vecinos
  if (vecinoCadaver >= 0 && Math.random() < PROB_LIMPIEZA && (fisE[vecinoCadaver] & MASCARA_ESTADO) === CADAVER) {
    fisE[vecinoCadaver] = TIERRA;
  }

  mover(i, valor, EXPLORAR, col);
}

function soldado(i, byte, col) {
  escanear(i, col);
  if (hayDepredador) { liberar(i); emitir(alarmaE, i, 255); return; }
  if (hayVeneno || Math.random() < PROB_MUERTE_NATURAL) { morir(i); return; }
  // Combate entre soldados: ambas celdas pasan a VACIO (cada una lo resuelve en su turno)
  if (haySoldadoEnemigo) { liberar(i); emitir(alarmaE, i, 255); return; }
  // Ante una obrera o reina enemiga se queda a pelear y llama refuerzos
  if (hayObreraEnemiga || hayReinaEnemiga) { emitir(alarmaE, i, 255); return; }
  mover(i, byte & MASCARA_ESTADO, PATRULLAR, col);
}

function reina(i, col) {
  escanear(i, col);
  if (hayDepredador) { liberar(i); emitir(alarmaE, i, 255); return; }
  if (hayVeneno || haySoldadoEnemigo) { morir(i); return; }
  emitir(realE[col], i, 255);
}

function nido(i, col) {
  emitir(realE[col], i, 255);
  if (!colonias.reinaViva[col] || colonias.reservas[col] <= 0 || Math.random() >= PROB_NACIMIENTO) return;
  const n = i + VECINOS[(Math.random() * 8) | 0];
  if (!libre(n)) return;
  const c = COLONIAS[col];
  ocupar(n, conRumbo(Math.random() < PROPORCION_SOLDADOS ? c.soldado : c.obrera, rumboAlAzar()));
  colonias.reservas[col]--;
}

function cadaver(i) {
  emitir(necroE, i, 255);
  if (Math.random() < PROB_DESCOMPOSICION) fisE[i] = TIERRA;
}

function veneno(i) {
  if (Math.random() >= PROB_EXPANSION_VENENO) return;
  const n = i + VECINOS[(Math.random() * 8) | 0];
  if (libre(n)) fisE[n] = VENENO;
}

function depredador(i) {
  if (Math.random() < PROB_MOVER_DEPREDADOR) mover(i, DEPREDADOR, DEAMBULAR, -1);
}
