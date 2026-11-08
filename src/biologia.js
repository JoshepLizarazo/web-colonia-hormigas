// =====================================================================
// Reglas biológicas: port de MotorNumPy.aplicar_reglas_biologicas
// (motor v6 del Subgrupo 3, Sprint 3).
//
// Las reglas se aplican en el mismo orden y sobre la matriz de escritura,
// como en el motor. Cuando una regla del motor calcula sus máscaras antes de
// escribir, aquí se toma una foto de la capa física y las vecindades se leen
// de ella. Las vecindades no dan la vuelta en los bordes (trasladar).
// =====================================================================
import {
  M, N, CELDAS, VACIO, ARENA_SECA, MURO, COMIDA, VENENO, CADAVER,
  NIDO_N, REINA_N, OBRERA_N, SOLDADO_N, NIDO_R, REINA_R, OBRERA_R, SOLDADO_R,
  BASURERO, DEPREDADOR,
  CAPA_RASTRO_COMIDA, CAPA_ALARMA, CAPA_FEROMONA_REAL, CAPA_NECROFEROMONAS, CAPA_RECLUTAMIENTO, CAPAS,
  PROB_MUERTE_VENENO, PROB_EXPANSION_VENENO, FRACCION_MAXIMA_VENENO, PROB_NACIMIENTO, FRACCION_SOLDADOS,
  PROB_MOVIMIENTO_DEPREDADOR, RADIO_RADAR_DEPREDADOR, PROB_MOVIMIENTO_ARENA, PROB_RETORNO_REAL,
  INTENSIDAD_RASTRO_MOVIMIENTO, DESPLAZAMIENTOS,
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
const ES_SOLDADO_N = conjunto(SOLDADO_N);
const ES_SOLDADO_R = conjunto(SOLDADO_R);
const ES_VENENO = conjunto(VENENO);
const ES_COMIDA = conjunto(COMIDA);
const ES_NIDO_N = conjunto(NIDO_N);
const ES_NIDO_R = conjunto(NIDO_R);

const DY = Int32Array.from(DESPLAZAMIENTOS, ([dy]) => dy);
const DX = Int32Array.from(DESPLAZAMIENTOS, ([, dx]) => dx);

// Foto de la capa física (las máscaras que el motor calcula antes de escribir).
const foto = new Uint8Array(CELDAS);

// escanear_presencia_3x3 en una celda: ¿algún vecino de Moore está en el conjunto?
// Fuera del mapa no hay nada (sin efecto toroidal).
function toca(fuente, i, tabla) {
  const y = (i / N) | 0;
  const x = i - y * N;
  for (let d = 0; d < 8; d++) {
    const yy = y + DY[d], xx = x + DX[d];
    if (yy < 0 || yy >= M || xx < 0 || xx >= N) continue;
    if (tabla[fuente[yy * N + xx]]) return true;
  }
  return false;
}

// escanear_gradiente_quimico en una celda. Devuelve la dirección y deja el
// valor máximo en `maximo`. Fuera del mapa el valor es 0.
// El motor desempata sumando un ruido de 1e-7 en float32, que se pierde con
// cualquier valor >= 2: en un empate gana la primera dirección. Se replica igual.
let maximo = 0;
const RUIDO = Math.fround(1e-7);
function gradiente(capaQuimica, i) {
  const y = (i / N) | 0;
  const x = i - y * N;
  let mejor = 0;
  let mejorConRuido = -1;
  maximo = 0;
  for (let d = 0; d < 8; d++) {
    const yy = y + DY[d], xx = x + DX[d];
    const v = yy < 0 || yy >= M || xx < 0 || xx >= N ? 0 : capaQuimica[yy * N + xx];
    if (v > maximo) maximo = v;
    const conRuido = Math.fround(v + Math.fround(Math.fround(Math.random()) * RUIDO));
    if (conRuido > mejorConRuido) { mejorConRuido = conRuido; mejor = d; }
  }
  return mejor;
}

const azar8 = () => (Math.random() * 8) | 0;

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
const lista = new Int32Array(CELDAS);    // Celdas de las entidades que se mueven
const rumbos = new Int8Array(CELDAS);    // Dirección elegida por cada una
const dejaRastro = new Uint8Array(CELDAS);

export function biologia(escritura, terreno) {
  const cf = capa(escritura, 0);
  const cc = capa(escritura, CAPA_RASTRO_COMIDA);
  const ca = capa(escritura, CAPA_ALARMA);
  const cr = capa(escritura, CAPA_FEROMONA_REAL);
  const cn = capa(escritura, CAPA_NECROFEROMONAS);
  const crec = capa(escritura, CAPA_RECLUTAMIENTO);

  // Desplazamiento del depredador, ataque después de avanzar y alarma.
  moverDepredadores(cf, ca, terreno);
  reglaDepredador(cf, ca);
  reglaCombate(cf, ca);
  reglaVeneno(cf, ca);
  emisionInmutables(cf, cr, cn, cc, crec);

  // Recoger antes de moverse.
  recoleccionComida(cf, cc, terreno);

  // Obreras: comida -> necro -> reclutamiento -> retorno ocasional a la reina -> azar.
  // Soldados: alarma -> reclutamiento -> retorno ocasional a la reina -> azar.
  let total = 0;
  for (let i = 0; i < CELDAS; i++) {
    const e = cf[i];
    if (!HORMIGAS[e]) continue;
    const dReal = gradiente(cr, i);
    const vuelta = maximo > 0 && Math.random() < PROB_RETORNO_REAL;
    const dRec = gradiente(crec, i);
    const hayRec = maximo > 0;
    let d;
    let rastro = 0;
    if (OBRERAS[e]) {
      const dComida = gradiente(cc, i);
      if (maximo > 0) {
        d = dComida;
        rastro = 1; // Rastro continuo al detectar olor de comida
      } else {
        const dNecro = gradiente(cn, i);
        d = maximo > 0 ? dNecro : hayRec ? dRec : vuelta ? dReal : azar8();
      }
    } else {
      const dAlarma = gradiente(ca, i);
      d = maximo > 0 ? dAlarma : hayRec ? dRec : vuelta ? dReal : azar8();
    }
    lista[total] = i;
    rumbos[total] = d;
    dejaRastro[total] = rastro;
    total++;
  }
  for (let k = 0; k < total; k++) {
    const i = lista[k];
    if (dejaRastro[k] && cc[i] < INTENSIDAD_RASTRO_MOVIMIENTO) cc[i] = INTENSIDAD_RASTRO_MOVIMIENTO;
  }

  moverEntidades(cf, total, false, null, terreno);

  // Interacciones que aparecen al final del movimiento.
  reglaDepredador(cf, ca);
  reglaCombate(cf, ca);
  recoleccionComida(cf, cc, terreno);
  limpiezaCadaveres(cf, crec, terreno);
  generacionNidos(cf);
  emisionInmutables(cf, cr, cn, cc, crec);

  // Perímetro físico estable y señales anuladas en los muros.
  for (let x = 0; x < N; x++) { cf[x] = MURO; cf[(M - 1) * N + x] = MURO; }
  for (let y = 0; y < M; y++) { cf[y * N] = MURO; cf[y * N + N - 1] = MURO; }
  for (let i = 0; i < CELDAS; i++) {
    if (cf[i] !== MURO) continue;
    for (let c = 1; c < CAPAS; c++) escritura[c * CELDAS + i] = 0;
  }
}

// ---------------------------------------------------------------------
// _movimiento_vectorizado: un paso por entidad, sin colisiones.
// Las 8 direcciones se recorren en orden aleatorio. El destino se juzga sobre
// el mapa original del movimiento y una celda reservada no recibe a nadie más.
// Al salir de una celda se restaura la arena que había debajo.
// ---------------------------------------------------------------------
const original = new Uint8Array(CELDAS);
const reservado = new Uint8Array(CELDAS);
const movido = new Uint8Array(CELDAS);

function moverEntidades(cf, total, permitePresas, alarma, terreno) {
  if (total === 0) return;
  original.set(cf);
  reservado.fill(0);
  movido.fill(0, 0, total);

  const orden = [0, 1, 2, 3, 4, 5, 6, 7];
  for (let k = 7; k > 0; k--) {
    const j = (Math.random() * (k + 1)) | 0;
    [orden[k], orden[j]] = [orden[j], orden[k]];
  }

  for (const d of orden) {
    for (let k = 0; k < total; k++) {
      if (movido[k] || rumbos[k] !== d) continue;
      const i = lista[k];
      const y = (i / N) | 0;
      const yy = y + DY[d], xx = i - y * N + DX[d];
      if (yy < 0 || yy >= M || xx < 0 || xx >= N) continue; // Fuera del mapa cuenta como muro
      const j = yy * N + xx;
      const destino = original[j];
      if (!(destino === VACIO || destino === ARENA_SECA || (permitePresas && HORMIGAS[destino]))) continue;
      if (reservado[j]) continue;
      // Arena seca: mayor dificultad de desplazamiento.
      if (terreno[j] && PROB_MOVIMIENTO_ARENA < 1 && !(Math.random() < PROB_MOVIMIENTO_ARENA)) continue;

      cf[i] = terreno[i] ? ARENA_SECA : VACIO;
      cf[j] = original[i];
      movido[k] = 1;
      reservado[j] = 1;
      if (alarma) alarma[j] = 255; // Destinos y víctimas del depredador
    }
  }
}

// ---------------------------------------------------------------------
// Radar v6 del depredador: mapa de calor hasta 8 casillas de la presa más
// cercana (vecindad de Moore, los muros detienen la propagación).
// Equivale a las 8 dilataciones con maximum_filter del motor.
// ---------------------------------------------------------------------
const calor = new Uint8Array(CELDAS);
const frente = new Int32Array(CELDAS);

function radarPresas(cf) {
  const R = RADIO_RADAR_DEPREDADOR;
  calor.fill(0);
  let fin = 0;
  for (let i = 0; i < CELDAS; i++) {
    if (HORMIGAS[cf[i]]) { calor[i] = R + 1; frente[fin++] = i; }
  }
  if (fin === 0) return false;
  let inicio = 0;
  for (let distancia = 1; distancia <= R; distancia++) {
    const limite = fin;
    for (let k = inicio; k < limite; k++) {
      const i = frente[k];
      const y = (i / N) | 0;
      const x = i - y * N;
      for (let d = 0; d < 8; d++) {
        const yy = y + DY[d], xx = x + DX[d];
        if (yy < 0 || yy >= M || xx < 0 || xx >= N) continue;
        const j = yy * N + xx;
        if (calor[j] || cf[j] === MURO) continue;
        calor[j] = R + 1 - distancia;
        frente[fin++] = j;
      }
    }
    inicio = limite;
  }
  return true;
}

function moverDepredadores(cf, ca, terreno) {
  let hay = false;
  for (let i = 0; i < CELDAS; i++) if (cf[i] === DEPREDADOR) { hay = true; break; }
  if (!hay) return;

  const conRadar = radarPresas(cf);
  let total = 0;
  for (let i = 0; i < CELDAS; i++) {
    if (cf[i] !== DEPREDADOR) continue;
    ca[i] = 255; // Alarma en la posición de partida
    const azar = azar8();
    const rumbo = conRadar ? gradiente(calor, i) : 0;
    const d = conRadar && calor[i] > 0 ? rumbo : azar;
    if (!(Math.random() < PROB_MOVIMIENTO_DEPREDADOR)) continue;
    lista[total] = i;
    rumbos[total] = d;
    total++;
  }
  moverEntidades(cf, total, true, ca, terreno);
}

// El depredador ataca obreras y soldados adyacentes (no a las reinas) y
// marca la alarma en todo su entorno.
function reglaDepredador(cf, ca) {
  for (let i = 0; i < CELDAS; i++) {
    if (cf[i] !== DEPREDADOR) continue;
    ca[i] = 255;
    const y = (i / N) | 0;
    const x = i - y * N;
    for (let d = 0; d < 8; d++) {
      const yy = y + DY[d], xx = x + DX[d];
      if (yy < 0 || yy >= M || xx < 0 || xx >= N) continue;
      const j = yy * N + xx;
      if (HORMIGAS[cf[j]]) cf[j] = CADAVER;
      if (cf[j] !== MURO) ca[j] = 255;
    }
  }
}

function reglaCombate(cf, ca) {
  foto.set(cf);
  for (let i = 0; i < CELDAS; i++) {
    const e = foto[i];
    if ((COLONIA_N[e] && toca(foto, i, ES_SOLDADO_R)) || (COLONIA_R[e] && toca(foto, i, ES_SOLDADO_N))) {
      cf[i] = CADAVER;
      ca[i] = 255;
    }
  }
}

// Veneno: letalidad probabilística y expansión con un tope real de ocupación.
const candidatos = new Int32Array(CELDAS);
function reglaVeneno(cf, ca) {
  let celdasVeneno = 0;
  for (let i = 0; i < CELDAS; i++) if (cf[i] === VENENO) celdasVeneno++;
  if (celdasVeneno === 0) return;

  foto.set(cf);
  for (let i = 0; i < CELDAS; i++) {
    if (HORMIGAS_Y_REINAS[foto[i]] && toca(foto, i, ES_VENENO) && Math.random() < PROB_MUERTE_VENENO) {
      cf[i] = CADAVER;
      ca[i] = 255;
    }
  }

  const limite = Math.floor(CELDAS * FRACCION_MAXIMA_VENENO);
  const disponibles = Math.max(0, limite - celdasVeneno);
  if (disponibles === 0 || PROB_EXPANSION_VENENO === 0) return;
  let n = 0;
  for (let i = 0; i < CELDAS; i++) {
    const e = cf[i];
    if ((e === VACIO || e === ARENA_SECA) && toca(foto, i, ES_VENENO) && Math.random() < PROB_EXPANSION_VENENO) {
      candidatos[n++] = i;
    }
  }
  // Si hay más candidatos que cupo, se eligen al azar sin repetir.
  const cantidad = Math.min(n, disponibles);
  for (let k = 0; k < cantidad; k++) {
    if (n > disponibles) {
      const j = k + ((Math.random() * (n - k)) | 0);
      [candidatos[k], candidatos[j]] = [candidatos[j], candidatos[k]];
    }
    cf[candidatos[k]] = VENENO;
  }
}

// Las fuentes emiten cada turno: reinas, cadáveres, comida y basureros.
function emisionInmutables(cf, cr, cn, cc, crec) {
  for (let i = 0; i < CELDAS; i++) {
    const e = cf[i];
    if (e === REINA_N || e === REINA_R) cr[i] = 255;
    else if (e === CADAVER) cn[i] = 255;
    else if (e === COMIDA) cc[i] = 255;
    else if (e === BASURERO) crec[i] = 255;
  }
}

function recoleccionComida(cf, cc, terreno) {
  foto.set(cf);
  for (let i = 0; i < CELDAS; i++) {
    const e = foto[i];
    if (OBRERAS[e] && toca(foto, i, ES_COMIDA)) {
      cc[i] = 255;
    } else if (e === COMIDA && toca(foto, i, OBRERAS)) {
      cf[i] = terreno[i] ? ARENA_SECA : VACIO;
      cc[i] = 255;
    }
  }
}

function limpiezaCadaveres(cf, crec, terreno) {
  foto.set(cf);
  for (let i = 0; i < CELDAS; i++) {
    if (foto[i] === CADAVER && toca(foto, i, OBRERAS)) {
      cf[i] = terreno[i] ? ARENA_SECA : VACIO;
      crec[i] = 255;
    }
  }
}

function generacionNidos(cf) {
  foto.set(cf);
  for (let i = 0; i < CELDAS; i++) {
    if (foto[i] !== VACIO) continue;
    const cercaN = toca(foto, i, ES_NIDO_N);
    const cercaR = toca(foto, i, ES_NIDO_R);
    if (!cercaN && !cercaR) continue;
    // Las mismas tiradas sirven para ambas colonias; si toca ambos nidos, nace negra.
    if (!(Math.random() < PROB_NACIMIENTO)) continue;
    const soldado = Math.random() < FRACCION_SOLDADOS;
    if (cercaN) cf[i] = soldado ? SOLDADO_N : OBRERA_N;
    else cf[i] = soldado ? SOLDADO_R : OBRERA_R;
  }
}
