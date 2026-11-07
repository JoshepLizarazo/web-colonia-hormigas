// =====================================================================
// Reglas biológicas (port de aplicar_reglas_biologicas del motor NumPy, Sprint 3)
//
// Cada regla del motor trabaja con máscaras calculadas al inicio de la regla
// y escribe sobre la capa física de escritura. Aquí se replica igual: se toma
// una foto de la capa física al empezar cada regla y las vecindades se leen
// de esa foto. Como np.roll, la vecindad da la vuelta en los bordes (toroide).
// =====================================================================
import {
  M, N, CELDAS, VACIO, ARENA_SECA, MURO, COMIDA, VENENO, CADAVER,
  NIDO_N, REINA_N, OBRERA_N, SOLDADO_N, NIDO_R, REINA_R, OBRERA_R, SOLDADO_R,
  BASURERO, DEPREDADOR,
  CAPA_RASTRO_COMIDA, CAPA_ALARMA, CAPA_FEROMONA_REAL, CAPA_NECROFEROMONAS, CAPA_RECLUTAMIENTO,
  PROB_MUERTE_VENENO, PROB_EXPANSION_VENENO, LIMITE_VENENO, PROB_NACIMIENTO, FRACCION_SOLDADOS,
  DESPLAZAMIENTOS,
} from './constantes.js';
import { capa } from './tensor.js';

// Tablas de pertenencia: conjunto[estado] === 1 si el estado está en el conjunto.
const conjunto = (...estados) => {
  const t = new Uint8Array(256);
  for (const e of estados) t[e] = 1;
  return t;
};
const HORMIGAS = conjunto(OBRERA_N, SOLDADO_N, OBRERA_R, SOLDADO_R);
const HORMIGAS_Y_REINAS = conjunto(OBRERA_N, SOLDADO_N, REINA_N, OBRERA_R, SOLDADO_R, REINA_R);
const OBRERAS = conjunto(OBRERA_N, OBRERA_R);
const COLONIA_N = conjunto(OBRERA_N, SOLDADO_N);
const COLONIA_R = conjunto(OBRERA_R, SOLDADO_R);
const ES = (e) => conjunto(e);
const ES_DEPREDADOR = ES(DEPREDADOR);
const ES_SOLDADO_N = ES(SOLDADO_N);
const ES_SOLDADO_R = ES(SOLDADO_R);
const ES_VENENO = ES(VENENO);
const ES_COMIDA = ES(COMIDA);
const ES_NIDO_N = ES(NIDO_N);
const ES_NIDO_R = ES(NIDO_R);

// Índices de fila/columna vecinas con vuelta en los bordes, como np.roll.
const FILA_ARRIBA = Int32Array.from({ length: M }, (_, y) => ((y - 1 + M) % M) * N);
const FILA_ABAJO = Int32Array.from({ length: M }, (_, y) => ((y + 1) % M) * N);
const COL_IZQ = Int32Array.from({ length: N }, (_, x) => (x - 1 + N) % N);
const COL_DER = Int32Array.from({ length: N }, (_, x) => (x + 1) % N);

// Foto de la capa física al empezar cada regla (las máscaras del motor).
const foto = new Uint8Array(CELDAS);

// escanear_presencia_3x3 evaluado en una celda: ¿algún vecino de la foto está en el conjunto?
function tocaA(i, tabla) {
  const y = (i / N) | 0;
  const x = i - y * N;
  const fa = FILA_ARRIBA[y], fc = y * N, fb = FILA_ABAJO[y];
  const xi = COL_IZQ[x], xd = COL_DER[x];
  return (
    tabla[foto[fa + x]] | tabla[foto[fb + x]] | tabla[foto[fc + xi]] | tabla[foto[fc + xd]] |
    tabla[foto[fa + xi]] | tabla[foto[fa + xd]] | tabla[foto[fb + xi]] | tabla[foto[fb + xd]]
  ) === 1;
}

// Índice de la celda vecina en la dirección d (0 a 7), con vuelta en los bordes.
function vecino(i, d) {
  const y = (i / N) | 0;
  const x = i - y * N;
  const [dy, dx] = DESPLAZAMIENTOS[d];
  return ((y + dy + M) % M) * N + ((x + dx + N) % N);
}

// escanear_gradiente_quimico evaluado en una celda: dirección del valor máximo
// (empates al azar, como el ruido de 0.01 del motor) y ese valor máximo.
let maximo = 0;
function direccionMaxima(capaQuimica, i) {
  let mejor = 0;
  let empates = 0;
  maximo = -1;
  for (let d = 0; d < 8; d++) {
    const v = capaQuimica[vecino(i, d)];
    if (v > maximo) { maximo = v; mejor = d; empates = 1; }
    else if (v === maximo && Math.random() * ++empates < 1) mejor = d;
  }
  return mejor;
}

// Cuenta la población para el panel de estadísticas.
export function censo(tensor) {
  const fisica = capa(tensor, 0);
  let negras = 0, rojas = 0;
  for (let i = 0; i < CELDAS; i++) {
    if (COLONIA_N[fisica[i]]) negras++;
    else if (COLONIA_R[fisica[i]]) rojas++;
  }
  return { negras, rojas };
}

// ---------------------------------------------------------------------
// aplicar_reglas_biologicas(lectura, escritura)
// ---------------------------------------------------------------------
export function biologia(lectura, escritura) {
  const cf = capa(escritura, 0);
  const cc = capa(escritura, CAPA_RASTRO_COMIDA);
  const ca = capa(escritura, CAPA_ALARMA);
  const cr = capa(escritura, CAPA_FEROMONA_REAL);
  const cn = capa(escritura, CAPA_NECROFEROMONAS);
  const crec = capa(escritura, CAPA_RECLUTAMIENTO);

  reglaDepredador(cf);
  reglaCombate(cf, ca);
  reglaVeneno(cf);
  emisionInmutables(cf, cr, cn);
  movimiento(cf, lectura);
  recoleccionComida(cf, cc);
  limpiezaCadaveres(cf, crec);
  generacionNidos(cf);

  // Restricción de frontera con muros perimetrales
  for (let x = 0; x < N; x++) { cf[x] = MURO; cf[(M - 1) * N + x] = MURO; }
  for (let y = 0; y < M; y++) { cf[y * N] = MURO; cf[y * N + N - 1] = MURO; }
}

function reglaDepredador(cf) {
  foto.set(cf);
  for (let i = 0; i < CELDAS; i++) {
    if (HORMIGAS[foto[i]] && tocaA(i, ES_DEPREDADOR)) cf[i] = VACIO;
  }
}

function reglaCombate(cf, ca) {
  foto.set(cf);
  for (let i = 0; i < CELDAS; i++) {
    const e = foto[i];
    if ((COLONIA_N[e] && tocaA(i, ES_SOLDADO_R)) || (COLONIA_R[e] && tocaA(i, ES_SOLDADO_N))) {
      cf[i] = VACIO;
      ca[i] = 255;
    }
  }
}

function reglaVeneno(cf) {
  foto.set(cf);
  let celdasVeneno = 0;
  for (let i = 0; i < CELDAS; i++) {
    if (foto[i] === VENENO) celdasVeneno++;
    else if (HORMIGAS_Y_REINAS[foto[i]] && tocaA(i, ES_VENENO) && Math.random() < PROB_MUERTE_VENENO) cf[i] = CADAVER;
  }
  if (celdasVeneno / CELDAS >= LIMITE_VENENO) return;
  for (let i = 0; i < CELDAS; i++) {
    const e = cf[i];
    if ((e === VACIO || e === ARENA_SECA) && tocaA(i, ES_VENENO) && Math.random() < PROB_EXPANSION_VENENO) cf[i] = VENENO;
  }
}

function emisionInmutables(cf, cr, cn) {
  for (let i = 0; i < CELDAS; i++) {
    const e = cf[i];
    if (e === REINA_N || e === REINA_R) cr[i] = 255;
    else if (e === CADAVER) cn[i] = 255;
  }
}

// Dirección asignada en este turno a la hormiga de cada celda.
const direccion = new Int8Array(CELDAS);
const yaSeMovio = new Uint8Array(CELDAS);
const hormigas = new Int32Array(CELDAS);
const origenes = new Int32Array(CELDAS);
const destinos = new Int32Array(CELDAS);

function movimiento(cf, lectura) {
  const comida = capa(lectura, CAPA_RASTRO_COMIDA);
  const necro = capa(lectura, CAPA_NECROFEROMONAS);
  const alarma = capa(lectura, CAPA_ALARMA);

  // Obreras: comida -> necroferomona -> azar. Soldados: alarma -> azar.
  let total = 0;
  for (let i = 0; i < CELDAS; i++) {
    const e = cf[i];
    if (!HORMIGAS[e]) continue;
    let d;
    if (OBRERAS[e]) {
      d = direccionMaxima(comida, i);
      if (maximo === 0) {
        d = direccionMaxima(necro, i);
        if (maximo === 0) d = (Math.random() * 8) | 0;
      }
    } else {
      d = direccionMaxima(alarma, i);
      if (maximo === 0) d = (Math.random() * 8) | 0;
    }
    direccion[i] = d;
    hormigas[total++] = i;
  }

  yaSeMovio.fill(0);
  // Las 8 direcciones se procesan en orden aleatorio; dentro de cada una, todos
  // los movimientos ocurren a la vez sobre el estado previo a esa dirección.
  const orden = [0, 1, 2, 3, 4, 5, 6, 7];
  for (let k = 7; k > 0; k--) {
    const j = (Math.random() * (k + 1)) | 0;
    [orden[k], orden[j]] = [orden[j], orden[k]];
  }
  for (const d of orden) {
    let n = 0;
    for (let k = 0; k < total; k++) {
      const i = hormigas[k];
      if (direccion[i] !== d || yaSeMovio[i] || !HORMIGAS[cf[i]]) continue;
      const j = vecino(i, d);
      if (cf[j] === VACIO || cf[j] === ARENA_SECA) {
        origenes[n] = i;
        destinos[n] = j;
        n++;
      }
    }
    for (let k = 0; k < n; k++) {
      cf[destinos[k]] = cf[origenes[k]];
      cf[origenes[k]] = VACIO;
      yaSeMovio[destinos[k]] = 1;
    }
  }
}

function recoleccionComida(cf, cc) {
  foto.set(cf);
  for (let i = 0; i < CELDAS; i++) {
    const e = foto[i];
    if (OBRERAS[e] && tocaA(i, ES_COMIDA)) cc[i] = 255;
    else if (e === COMIDA && tocaA(i, OBRERAS)) cf[i] = VACIO;
  }
}

function limpiezaCadaveres(cf, crec) {
  foto.set(cf);
  for (let i = 0; i < CELDAS; i++) {
    if (foto[i] === CADAVER && tocaA(i, OBRERAS)) {
      cf[i] = VACIO;
      crec[i] = 255;
    } else if (cf[i] === BASURERO) {
      crec[i] = 255;
    }
  }
}

function generacionNidos(cf) {
  foto.set(cf);
  for (let i = 0; i < CELDAS; i++) {
    if (foto[i] !== VACIO) continue;
    const cercaN = tocaA(i, ES_NIDO_N);
    const cercaR = tocaA(i, ES_NIDO_R);
    if (!cercaN && !cercaR) continue;
    // Las mismas tiradas sirven para ambas colonias, como en el motor
    if (Math.random() >= PROB_NACIMIENTO) continue;
    const soldado = Math.random() < FRACCION_SOLDADOS;
    if (cercaN) cf[i] = soldado ? SOLDADO_N : OBRERA_N;
    else cf[i] = soldado ? SOLDADO_R : OBRERA_R;
  }
}
