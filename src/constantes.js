// =====================================================================
// Diccionario de constantes (sección 8.2 del documento de arquitectura)
// Nunca se programa con números sueltos: todo pasa por estos nombres.
// =====================================================================

// --- Dimensiones del mundo: M filas × N columnas ----------------------
export const M = 500;
export const N = 500;
export const CELDAS = M * N;

// --- Profundidad del tensor --------------------------------------------
// Capa 0 = física. Capas 1 a 5 = química (documento).
// Capa 6 = feromona real roja: el documento menciona una feromona real
// por colonia pero reserva una sola capa; sin separarlas, una obrera
// roja cargada de comida volvería al nido negro.
export const CAPAS = 7;
export const CAPA_FISICA = 0;
export const CAPA_COMIDA = 1;        // Rastro de comida (volátil)
export const CAPA_ALARMA = 2;        // Alarma / peligro (expansión veloz)
export const CAPA_REAL_N = 3;        // Feromona real negra (GPS al nido)
export const CAPA_NECRO = 4;         // Necroferomonas (cadáveres)
export const CAPA_RECLUTAMIENTO = 5; // Reclutamiento (reservada)
export const CAPA_REAL_R = 6;        // Feromona real roja

// --- Σ: alfabeto de 16 estados de la Capa 0 (Cuadro 1) -----------------
export const TIERRA = 0;      // Tierra húmeda: transitable
export const VACIO = TIERRA;
export const ARENA = 1;       // Arena seca: acelera la evaporación
export const MURO = 2;        // Bloquea movimiento y olores
export const COMIDA = 3;      // Desaparece al contacto con obreras
export const VENENO = 4;      // Expansivo, aniquila estados biológicos
export const CADAVER = 5;     // Inerte, emite necroferomonas
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

// --- Bits del byte de la Capa 0 ---------------------------------------
// Los 16 estados ocupan los 4 bits bajos del uint8; los bits libres
// guardan información que el alfabeto no cubre.
export const MASCARA_ESTADO = 0x0f;
export const FLAG_CARGA = 0x10; // La obrera lleva comida
export const FLAG_ARENA = 0x20; // La hormiga está parada sobre arena
// Bits 6-7: rumbo de la hormiga (0 = NE, 1 = SE, 2 = SO, 3 = NO).
// Sin memoria de dirección la hormiga solo daría vueltas cerca del nido.
export const MASCARA_RUMBO = 0xc0;
export const DESPLAZAMIENTO_RUMBO = 6;

// --- Colonias ----------------------------------------------------------
export const NEGRA = 0;
export const ROJA = 1;
export const COLONIAS = [
  { obrera: OBRERA_N, soldado: SOLDADO_N, nido: NIDO_N, reina: REINA_N, capaReal: CAPA_REAL_N },
  { obrera: OBRERA_R, soldado: SOLDADO_R, nido: NIDO_R, reina: REINA_R, capaReal: CAPA_REAL_R },
];

// --- Física química (sección 7.2) ---------------------------------------
// Porcentaje que CONSERVA cada capa por tick: (v * 95) // 100 = evaporar 5 %.
// Las capas reales (3 y 6) no usan este valor: se propagan como onda.
export const CONSERVACION = [0, 99, 90, 0, 97, 95, 0];
// Peso central c del kernel separable [1 c 1]: con c alto la capa casi no se
// esparce (rastro fino y duradero); con c = 2 se expande rápido (alarma).
export const CENTRO_KERNEL = [0, 6, 2, 0, 4, 2, 0];
export const CONSERVACION_ARENA = 85; // Evaporación extra sobre arena seca
// Feromona real: cada celda toma el máximo de su vecindad menos este valor.
// Resultado: un gradiente lineal de ~250 celdas que rodea los muros.
export const DECAIMIENTO_REAL = 1;
export const DECAIMIENTO_REAL_ARENA = 2;

// --- Biología (sección 8) ---------------------------------------------
export const PROB_MUERTE_NATURAL = 0.00015;
export const PROB_NACIMIENTO = 0.012;     // Por celda de nido y tick
export const PROPORCION_SOLDADOS = 0.2;
export const PROB_LIMPIEZA = 0.05;        // Obrera retira un cadáver vecino
export const PROB_DESCOMPOSICION = 0.003; // Cadáver vuelve a tierra
export const PROB_EXPANSION_VENENO = 0.0008;
export const PROB_MOVER_DEPREDADOR = 0.5;
export const RASTRO_REGRESO = 200;        // Feromona que deja la obrera cargada
export const OLOR_COMIDA = 160;           // La comida perfuma la Capa 1 a su alrededor
export const PERSISTENCIA = 0.8;          // Cuánto prefiere seguir su rumbo
export const PROB_GIRO = 0.03;            // Giro espontáneo de 90° por tick
export const RESERVAS_INICIALES = 40;     // Comida inicial de cada colonia
export const OBRERAS_INICIALES = 60;
export const SOLDADOS_INICIALES = 10;

// --- Tiempo (sección 7.3) ---------------------------------------------
export const DELAY_INICIAL = 0.05; // segundos

// --- Colormap (sección 6.1) -------------------------------------------
export const ESTADOS = [
  { id: TIERRA, nombre: 'Tierra húmeda', color: '#5a3e26' },
  { id: ARENA, nombre: 'Arena seca', color: '#b89b62' },
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
