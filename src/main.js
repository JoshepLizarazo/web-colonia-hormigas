// =====================================================================
// Ciclo de vida del sandbox (sección 9) y conexión con el panel de control
// =====================================================================
import {
  ESTADOS, DELAY_INICIAL, MURO, COMIDA, VENENO, OBRERA_N, OBRERA_R, DEPREDADOR, TIERRA,
} from './constantes.js';
import { motor, intercambiar } from './tensor.js';
import { generarMundo } from './mundo.js';
import { fisica } from './fisica.js';
import { biologia, censo } from './biologia.js';
import { prepararLienzo, dibujar } from './render.js';
import { pincel, GROSORES, conectarLienzo, aplicarPendientes } from './pinceles.js';

const PINCELES = {
  muro: MURO,
  comida: COMIDA,
  veneno: VENENO,
  'hormiga-n': OBRERA_N,
  'hormiga-r': OBRERA_R,
  depredador: DEPREDADOR,
  borrar: TIERRA,
};

const $ = (id) => document.getElementById(id);
const lienzo = $('lienzo');
const ui = {
  play: $('btn-play'),
  pausa: $('btn-pausa'),
  reset: $('btn-reset'),
  grosorMenos: $('grosor-menos'),
  grosorMas: $('grosor-mas'),
  grosorValor: $('grosor-valor'),
  verRastro: $('ver-rastro'),
  verAlarma: $('ver-alarma'),
  delay: $('delay'),
  delayValor: $('delay-valor'),
  tick: $('stat-tick'),
  negras: $('stat-negras'),
  rojas: $('stat-rojas'),
};

let DELAY = DELAY_INICIAL; // Variable global de tiempo que controla el deslizador
let corriendo = false;
let tick = 0;
let temporizador = null;

// Un turno completo, en el orden estricto del documento.
function paso() {
  aplicarPendientes(motor.lectura);                // 1. Detección humana
  fisica(motor.lectura, motor.escritura);          // 2. Física matemática
  biologia(motor.lectura, motor.escritura, tick);  // 3. Decisiones biológicas
  intercambiar();                                  // 4. Doble búfer
  tick++;
}

function pintarPantalla() {
  dibujar(motor.lectura, ui.verRastro.checked, ui.verAlarma.checked); // 5. Renderizado
  const { negras, rojas } = censo(motor.lectura);
  ui.tick.textContent = tick;
  ui.negras.textContent = negras;
  ui.rojas.textContent = rojas;
}

function ciclo() {
  if (!corriendo) return;
  paso();
  pintarPantalla();
  temporizador = setTimeout(ciclo, DELAY * 1000); // 6. Control de tiempo
}

function play() {
  if (corriendo) return;
  corriendo = true;
  actualizarBotones();
  ciclo();
}

function pausar() {
  corriendo = false;
  clearTimeout(temporizador);
  actualizarBotones();
}

function reiniciar() {
  pausar();
  tick = 0;
  generarMundo(motor.lectura);
  pintarPantalla();
}

function actualizarBotones() {
  ui.play.classList.toggle('activo', corriendo);
  ui.pausa.classList.toggle('activo', !corriendo);
}

// --- Panel de control -----------------------------------------------------
ui.play.addEventListener('click', play);
ui.pausa.addEventListener('click', pausar);
ui.reset.addEventListener('click', reiniciar);

for (const radio of document.querySelectorAll('input[name="pincel"]')) {
  radio.addEventListener('change', () => { pincel.estado = PINCELES[radio.value]; });
  const muestra = radio.parentElement.querySelector('.muestra');
  muestra.style.background = ESTADOS[PINCELES[radio.value]].color;
}
pincel.estado = PINCELES[document.querySelector('input[name="pincel"]:checked').value];

function cambiarGrosor(delta) {
  const k = GROSORES.indexOf(pincel.grosor) + delta;
  pincel.grosor = GROSORES[Math.max(0, Math.min(GROSORES.length - 1, k))];
  ui.grosorValor.textContent = `${pincel.grosor}×${pincel.grosor}`;
}
ui.grosorMenos.addEventListener('click', () => cambiarGrosor(-1));
ui.grosorMas.addEventListener('click', () => cambiarGrosor(1));

ui.delay.addEventListener('input', () => {
  DELAY = Number(ui.delay.value);
  ui.delayValor.textContent = `${DELAY.toFixed(2)} s`;
});

// Con la simulación en pausa, los cambios se ven al instante.
for (const casilla of [ui.verRastro, ui.verAlarma]) {
  casilla.addEventListener('change', () => { if (!corriendo) pintarPantalla(); });
}

// --- Lienzo ----------------------------------------------------------------
prepararLienzo(lienzo);
conectarLienzo(lienzo, () => {
  if (corriendo) return; // En marcha, el paso 1 del ciclo aplica los trazos
  aplicarPendientes(motor.lectura);
  pintarPantalla();
});

// --- Leyenda del alfabeto Σ -------------------------------------------------
$('leyenda').innerHTML = ESTADOS
  .map(({ id, nombre, color }) => `<li><span class="muestra" style="background:${color}"></span>${id} · ${nombre}</li>`)
  .join('');

reiniciar();
