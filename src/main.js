// =====================================================================
// Ciclo de vida del sandbox (sección 9) y conexión con el panel de control
// =====================================================================
import {
  ESTADOS, DELAY_INICIAL, MURO, COMIDA, VENENO, OBRERA_N, OBRERA_R, DEPREDADOR, VACIO,
} from './constantes.js';
import { motor, intercambiar } from './tensor.js';
import { generarMundo } from './mundo.js';
import { fisica, limpiarMuros } from './fisica.js';
import { biologia, censo } from './biologia.js';
import { prepararLienzo, dibujar } from './render.js';
import { pincel, GROSORES, conectarLienzo, procesarCola } from './pinceles.js';

const PINCELES = {
  muro: MURO,
  comida: COMIDA,
  veneno: VENENO,
  'hormiga-n': OBRERA_N,
  'hormiga-r': OBRERA_R,
  depredador: DEPREDADOR,
  borrar: VACIO,
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

// Un turno completo: avanzar_tick() del motor del Subgrupo 3.
function paso() {
  motor.escritura.set(motor.lectura);        // np.copyto(matriz_siguiente, matriz_actual)
  procesarCola(motor.escritura);             // 1. Detección humana (cola Modo Dios)
  fisica(motor.lectura, motor.escritura);    // 2. Evaporación y difusión
  biologia(motor.lectura, motor.escritura);  // 3. Reglas biológicas
  limpiarMuros(motor.escritura);             //    libres_post
  intercambiar();                            // 4. Doble búfer
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

function elegirPincel(valor) {
  pincel.estado = PINCELES[valor];
  pincel.borrar = valor === 'borrar'; // borrar_celda también limpia las feromonas
}
for (const radio of document.querySelectorAll('input[name="pincel"]')) {
  radio.addEventListener('change', () => elegirPincel(radio.value));
  const muestra = radio.parentElement.querySelector('.muestra');
  muestra.style.background = ESTADOS[PINCELES[radio.value]].color;
}
elegirPincel(document.querySelector('input[name="pincel"]:checked').value);

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
  if (corriendo) return; // En marcha, el paso 1 del ciclo drena la cola
  procesarCola(motor.lectura);
  pintarPantalla();
});

// --- Leyenda del alfabeto Σ -------------------------------------------------
$('leyenda').innerHTML = ESTADOS
  .map(({ id, nombre, color }) => `<li><span class="muestra" style="background:${color}"></span>${id} · ${nombre}</li>`)
  .join('');

reiniciar();
