// =====================================================================
// Diccionario de constantes (sección 8.2 del documento de arquitectura)
// Valores tomados del motor NumPy del Subgrupo 3 (Sprint 3).
// =====================================================================

// --- Dimensiones del mundo: ALTO filas × ANCHO columnas ---------------
export const M = 500;
export const N = 500;
export const CELDAS = M * N;

// --- Capas del tensor M×N×6 -------------------------------------------
export const CAPAS = 6;
export const CAPA_FISICA = 0;
export const CAPA_RASTRO_COMIDA = 1;
export const CAPA_ALARMA = 2;
export const CAPA_FEROMONA_REAL = 3;
export const CAPA_NECROFEROMONAS = 4;
export const CAPA_RECLUTAMIENTO = 5;

// --- Σ: alfabeto de 16 estados de la Capa 0 (Cuadro 1) -----------------
export const VACIO = 0;
export const ARENA_SECA = 1;
export const MURO = 2;
export const COMIDA = 3;
export const VENENO = 4;
export const CADAVER = 5;
export const NIDO_N = 6;
export const REINA_N = 7;
export const OBRERA_N = 8;
export const SOLDADO_N = 9;
export const NIDO_R = 10;
export const REINA_R = 11;
export const OBRERA_R = 12;
export const SOLDADO_R = 13;
export const BASURERO = 14;
export const DEPREDADOR = 15;

export const MASCARA_ESTADO = 0x0f;

// --- Física química ----------------------------------------------------
// Evaporación del 5 % por tabla: (v * 95) // 100 calculado en uint16.
export const TABLA_EVAPORACION = Uint8Array.from({ length: 256 }, (_, v) => Math.floor((v * 95) / 100));

// Kernels de difusión en cruz [0 l 0; l c l; 0 l 0] / 100.
const KERNEL_LENTO = { centro: 80, lado: 5 };
const KERNEL_MEDIO = { centro: 60, lado: 10 };
const KERNEL_RAPIDO = { centro: 20, lado: 20 };
// Uno por capa química, de la 1 a la 5.
export const KERNELS = [KERNEL_MEDIO, KERNEL_RAPIDO, KERNEL_LENTO, KERNEL_MEDIO, KERNEL_MEDIO];

// --- Biología ------------------------------------------------------------
export const PROB_MUERTE_VENENO = 0.125;
export const PROB_EXPANSION_VENENO = 0.03;
export const LIMITE_VENENO = 0.15;      // Fracción máxima del mapa con veneno
export const PROB_NACIMIENTO = 0.05;
export const FRACCION_SOLDADOS = 0.2;

// Vecindad de Moore en el orden del motor: arriba, abajo, izq, der y diagonales.
export const DESPLAZAMIENTOS = [
  [-1, 0], [1, 0], [0, -1], [0, 1],
  [-1, -1], [-1, 1], [1, -1], [1, 1],
];

// --- Tiempo (sección 7.3) ---------------------------------------------
export const DELAY_INICIAL = 0.05; // segundos

// --- Colormap (sección 6.1) -------------------------------------------
export const ESTADOS = [
  { id: VACIO, nombre: 'Tierra húmeda', color: '#5a3e26' },
  { id: ARENA_SECA, nombre: 'Arena seca', color: '#b89b62' },
  { id: MURO, nombre: 'Muro / roca', color: '#2f2f35' },
  { id: COMIDA, nombre: 'Comida', color: '#7cc142' },
  { id: VENENO, nombre: 'Veneno / ácido', color: '#c026ff' },
  { id: CADAVER, nombre: 'Cadáver', color: '#a8a29e' },
  { id: NIDO_N, nombre: 'Nido negro', color: '#15151b' },
  { id: REINA_N, nombre: 'Reina negra', color: '#ffd23f' },
  { id: OBRERA_N, nombre: 'Obrera negra', color: '#000000' },
  { id: SOLDADO_N, nombre: 'Soldado negro', color: '#3d3d6b' },
  { id: NIDO_R, nombre: 'Nido rojo', color: '#6e1010' },
  { id: REINA_R, nombre: 'Reina roja', color: '#ff5fa2' },
  { id: OBRERA_R, nombre: 'Obrera roja', color: '#ff2d2d' },
  { id: SOLDADO_R, nombre: 'Soldado rojo', color: '#ffa07a' },
  { id: BASURERO, nombre: 'Basurero', color: '#4e342e' },
  { id: DEPREDADOR, nombre: 'Depredador', color: '#22d3ee' },
];
export const COLOR_RASTRO_COMIDA = '#38bdf8';
export const COLOR_ALARMA = '#ffe14d';
