<script setup>
// Este componente es un MODAL: una ventana que se superpone a toda la
// app (ver ".fondo" con position:fixed) y la "bloquea" hasta que la
// persona la cierra. Vue lo trata como cualquier otro componente — la
// "magia" de que tape todo es pura CSS (position:fixed + z-index alto).

import { ref, reactive } from 'vue'
import {
  useFinanzas,
  MONEDAS,
  SIMBOLOS_MONEDA,
  BANCOS_VENEZUELA,
  EXCHANGES_Y_BILLETERAS_DIGITALES,
} from '../composables/useFinanzas'

// defineEmits declara qué eventos puede "emitir" (disparar) este
// componente hacia quien lo usa. App.vue escucha "cerrar" con
// "@cerrar" para saber cuándo ocultar el asistente.
const emit = defineEmits(['cerrar'])

const { monedasEnUso, agregarCuenta, registrarTasa, actualizarPerfil } = useFinanzas()

// Vamos avanzando por pasos con un string en vez de un número — así
// "paso === 'billeteras'" se entiende solo, sin tener que recordar
// "¿el paso 2 era cuál?".
const paso = ref('perfil')

function cerrar() {
  emit('cerrar')
}

// --- Paso 1: datos personales (todo opcional, no afecta ningún cálculo) ---
const perfilForm = reactive({ nombre: '', apellido: '', fechaNacimiento: '' })

function continuarDesdePerfil() {
  actualizarPerfil({ ...perfilForm })
  paso.value = 'billeteras'
}

// --- Paso 2: billeteras ---
// "list" necesita un id único en TODA la página para conectar el
// input con su <datalist>. Como ResumenView ya tiene uno fijo
// ("instituciones-sugeridas") y este modal puede convivir con esa
// vista detrás, generamos uno propio al azar para no chocar.
const idDatalist = `instituciones-asistente-${Math.random().toString(36).slice(2)}`

const nuevaBilletera = reactive({ nombre: '', tipo: 'activo', moneda: 'USD' })
const billeterasAgregadas = ref([])

function agregarBilletera() {
  const nombre = nuevaBilletera.nombre.trim()
  if (!nombre) return
  agregarCuenta({ ...nuevaBilletera, nombre })
  billeterasAgregadas.value.push({ nombre, moneda: nuevaBilletera.moneda })
  nuevaBilletera.nombre = ''
  nuevaBilletera.tipo = 'activo'
  nuevaBilletera.moneda = 'USD'
}

function continuarDesdeBilleteras() {
  // Si ahora hay cuentas en más de una moneda, todavía falta la tasa
  // de cambio para que los totales combinados tengan sentido. Si no,
  // no hace falta — terminamos acá.
  if (monedasEnUso.value.length > 1) {
    paso.value = 'tasa'
  } else {
    cerrar()
  }
}

// --- Paso 3: tasa de cambio (solo aparece si hace falta) ---
const nuevaTasa = ref('')

function guardarTasaYTerminar() {
  const valor = Number(nuevaTasa.value)
  if (nuevaTasa.value && valor > 0) {
    registrarTasa({ fecha: new Date().toISOString().slice(0, 10), valor })
  }
  cerrar()
}
</script>

<template>
  <div class="fondo">
    <div class="tarjeta">
      <button class="cerrar-x" title="Saltar por ahora" @click="cerrar">✕</button>

      <!-- Paso 1: perfil -->
      <section v-if="paso === 'perfil'" class="paso">
        <h2>¡Bienvenido/a a Mis Finanzas! 👋</h2>
        <p class="ayuda">
          Antes de empezar, contanos un poco sobre vos. Es totalmente opcional — podés
          completarlo ahora, después desde Configuración, o nunca.
        </p>

        <label class="campo">
          Nombre
          <input v-model="perfilForm.nombre" type="text" placeholder="Ej: José" />
        </label>
        <label class="campo">
          Apellido
          <input v-model="perfilForm.apellido" type="text" placeholder="Ej: Pérez" />
        </label>
        <label class="campo">
          Fecha de nacimiento
          <input v-model="perfilForm.fechaNacimiento" type="date" />
        </label>

        <div class="acciones-paso">
          <button type="button" class="saltar" @click="cerrar">Saltar por ahora</button>
          <button type="button" class="continuar" @click="continuarDesdePerfil">Continuar</button>
        </div>
      </section>

      <!-- Paso 2: billeteras -->
      <section v-else-if="paso === 'billeteras'" class="paso">
        <h2>Agregá tus billeteras</h2>
        <p class="ayuda">
          Acá entran tus bancos, exchanges, billeteras digitales o tarjetas — cada una con su
          propia moneda y su propio saldo. Podés agregar varias antes de continuar.
        </p>

        <form class="form-billetera" @submit.prevent="agregarBilletera">
          <label class="campo-cuenta">
            Billetera
            <!--
              Mismo patrón que en "Resumen → Nueva cuenta": un input de
              texto conectado a un <datalist> con sugerencias agrupadas
              (🏦 bancos / 💱 exchanges) y, si lo que buscás no está en
              la lista, podés escribir cualquier nombre igual.
            -->
            <span class="campo-con-icono">
              <span class="icono-buscar">🔍</span>
              <input
                v-model="nuevaBilletera.nombre"
                type="text"
                :list="idDatalist"
                placeholder="Buscá tu banco o exchange, o escribí un nombre"
              />
            </span>
            <datalist :id="idDatalist">
              <option v-for="b in BANCOS_VENEZUELA" :key="b" :value="b" :label="`🏦 ${b} · Banco`" />
              <option
                v-for="d in EXCHANGES_Y_BILLETERAS_DIGITALES"
                :key="d"
                :value="d"
                :label="`💱 ${d} · Exchange / billetera digital`"
              />
            </datalist>
          </label>

          <div class="fila-campos">
            <label class="campo-cuenta">
              Tipo
              <select v-model="nuevaBilletera.tipo">
                <option value="activo">Activo</option>
                <option value="pasivo">Pasivo</option>
              </select>
            </label>
            <label class="campo-cuenta">
              Moneda
              <select v-model="nuevaBilletera.moneda">
                <option v-for="moneda in MONEDAS" :key="moneda" :value="moneda">
                  {{ SIMBOLOS_MONEDA[moneda] }} {{ moneda }}
                </option>
              </select>
            </label>
          </div>

          <button type="submit" class="agregar-billetera">+ Agregar a la lista</button>
        </form>

        <ul v-if="billeterasAgregadas.length > 0" class="agregadas">
          <li v-for="(b, i) in billeterasAgregadas" :key="i">
            ✓ {{ b.nombre }} <span class="moneda-tag">{{ b.moneda }}</span>
          </li>
        </ul>

        <div class="acciones-paso">
          <button type="button" class="saltar" @click="cerrar">Saltar por ahora</button>
          <button type="button" class="continuar" @click="continuarDesdeBilleteras">
            {{ billeterasAgregadas.length > 0 ? 'Continuar' : 'Continuar sin agregar' }}
          </button>
        </div>
      </section>

      <!-- Paso 3: tasa de cambio (solo si quedaron monedas mezcladas) -->
      <section v-else class="paso">
        <h2>Una última cosa: la tasa de cambio</h2>
        <p class="ayuda">
          Como ahora tenés billeteras en dólares y en bolívares, hace falta la tasa USD → Bs
          para que los totales combinados de "Resumen" salgan bien. Podés cargarla ahora o
          más tarde desde Configuración (⚙).
        </p>

        <form class="form-tasa" @submit.prevent="guardarTasaYTerminar">
          <input type="number" v-model="nuevaTasa" min="0" step="0.01" placeholder="Ej: 130.00" />
          <button type="submit">Guardar y terminar</button>
        </form>

        <div class="acciones-paso solo-saltar">
          <button type="button" class="saltar" @click="cerrar">Saltar por ahora</button>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
/*
  Pantalla completa: a diferencia de un modal "flotante" (tarjeta chica
  con fondo oscurecido detrás), acá ".fondo" tapa TODO el viewport con
  el propio fondo de la app, y ".tarjeta" ocupa el 100% del alto — es
  una "pantalla" más, no una ventana superpuesta. overflow-y permite
  hacer scroll si el contenido del paso no entra completo.
*/
.fondo {
  position: fixed;
  inset: 0;
  background: var(--bg);
  display: flex;
  justify-content: center;
  z-index: 100;
  overflow-y: auto;
}

.tarjeta {
  position: relative;
  background: var(--surface);
  padding: 48px 20px 28px;
  max-width: 480px;
  width: 100%;
  min-height: 100%;
  box-sizing: border-box;
}

.cerrar-x {
  position: absolute;
  top: 10px;
  right: 10px;
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 0.95rem;
  cursor: pointer;
  padding: 6px 9px;
  border-radius: 999px;
}

.cerrar-x:hover {
  background: var(--bg);
  color: var(--text);
}

.paso h2 {
  margin: 0 0 6px;
  font-size: 1.15rem;
  color: var(--accent);
}

.ayuda {
  margin: 0 0 16px;
  color: var(--muted);
  font-size: 0.83rem;
}

.campo {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.85rem;
  color: var(--muted);
  margin-bottom: 12px;
}

.campo input {
  padding: 10px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  font-size: 0.95rem;
  color: var(--text);
  background: var(--bg);
}

.campo-cuenta {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.85rem;
  color: var(--muted);
  margin-bottom: 12px;
}

.campo-cuenta input,
.campo-cuenta select {
  padding: 10px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  font-size: 0.95rem;
  color: var(--text);
  background: var(--bg);
}

.campo-con-icono {
  position: relative;
  display: block;
}

.icono-buscar {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.85rem;
  pointer-events: none;
}

.campo-con-icono input {
  width: 100%;
  padding-left: 32px;
}

.fila-campos {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.agregar-billetera {
  width: 100%;
  padding: 10px;
  border: 1px dashed var(--border);
  border-radius: var(--radius);
  background: transparent;
  color: var(--accent);
  font-size: 0.85rem;
  cursor: pointer;
}

.agregar-billetera:hover {
  border-color: var(--accent);
  background: #eef6f0;
}

.agregadas {
  list-style: none;
  margin: 14px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.85rem;
}

.agregadas li {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--income);
}

.agregadas .moneda-tag {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--muted);
  background: #eef1f4;
  border-radius: 999px;
  padding: 2px 7px;
}

.form-tasa {
  display: flex;
  gap: 8px;
  margin-bottom: 4px;
}

.form-tasa input {
  flex: 1;
  padding: 9px 10px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  font-size: 0.95rem;
  background: var(--bg);
  color: var(--text);
}

.form-tasa button {
  padding: 9px 12px;
  border: none;
  border-radius: var(--radius);
  background: var(--accent);
  color: #fff;
  font-size: 0.82rem;
  cursor: pointer;
  white-space: nowrap;
}

.form-tasa button:hover {
  background: var(--accent-dark);
}

.acciones-paso {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-top: 20px;
}

.acciones-paso.solo-saltar {
  justify-content: center;
}

.saltar {
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 0.82rem;
  cursor: pointer;
  text-decoration: underline;
}

.saltar:hover {
  color: var(--text);
}

.continuar {
  padding: 10px 18px;
  border: none;
  border-radius: var(--radius);
  background: var(--accent);
  color: #fff;
  font-size: 0.85rem;
  cursor: pointer;
}

.continuar:hover {
  background: var(--accent-dark);
}
</style>
