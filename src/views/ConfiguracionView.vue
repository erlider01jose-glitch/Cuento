<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { useFinanzas, formatearMonto } from '../composables/useFinanzas'

const {
  tasas,
  tasaActual,
  tasaOficialActual,
  perfil,
  actualizarPerfil,
  registrarTasa,
  obtenerTasaDesdeAPI,
  restaurarDeFabrica,
  exportarDatos,
  importarDatos,
} = useFinanzas()

// --- Perfil ---
// reactive() arma una "copia de trabajo" del perfil: editás acá sin
// tocar el original hasta apretar "Guardar". El watch mantiene esta
// copia sincronizada si "perfil" cambia desde afuera (por ejemplo, si
// el asistente de bienvenida lo completa mientras esta vista ya está
// montada — caso raro, pero así nunca queda desactualizada).
const perfilForm = reactive({ ...perfil.value })
const mensajePerfil = ref('')

watch(
  perfil,
  (nuevo) => {
    Object.assign(perfilForm, nuevo)
  },
  { deep: true }
)

function guardarPerfil() {
  actualizarPerfil({ ...perfilForm })
  mensajePerfil.value = '✓ Perfil guardado.'
}

// --- Tasa de cambio ---
const nuevaTasa = ref('')
const tipoTasaManual = ref('paralelo') // 'paralelo' | 'oficial'
const mensajeTasa = ref('')
const cargandoTasa = ref(false)

function guardarTasa() {
  const valor = Number(nuevaTasa.value)
  if (!nuevaTasa.value || valor <= 0) {
    mensajeTasa.value = 'Ingresá un valor válido (ej: 130.00).'
    return
  }
  registrarTasa({ fecha: new Date().toISOString().slice(0, 10), valor, tipo: tipoTasaManual.value })
  mensajeTasa.value = `✓ Tasa ${tipoTasaManual.value === 'paralelo' ? 'paralela' : 'oficial'} guardada.`
  nuevaTasa.value = ''
}

async function traerTasaDesdeAPI() {
  cargandoTasa.value = true
  mensajeTasa.value = ''
  try {
    const { paralelo, oficial } = await obtenerTasaDesdeAPI()
    const partes = []
    if (paralelo) partes.push(`Paralela: ${paralelo.toFixed(2)} Bs`)
    if (oficial) partes.push(`Oficial: ${oficial.toFixed(2)} Bs`)
    mensajeTasa.value = `✓ ${partes.join(' · ')}`
  } catch {
    mensajeTasa.value = '✗ No se pudo conectar con la API. Revisá tu internet.'
  } finally {
    cargandoTasa.value = false
  }
}

// historial ordenado del más reciente al más viejo, separado por tipo.
const historialParalelo = computed(() =>
  tasas.value.filter((t) => t.tipo === 'paralelo').sort((a, b) => b.fecha.localeCompare(a.fecha))
)
const historialOficial = computed(() =>
  tasas.value.filter((t) => t.tipo === 'oficial').sort((a, b) => b.fecha.localeCompare(a.fecha))
)

// --- Importar / exportar datos ---
// "inputArchivo" no guarda un dato sino una REFERENCIA al <input> oculto
// de abajo (ver ref="inputArchivo"). Así podemos "clickearlo" desde
// código (abrirSelectorDeArchivo) y mostrar nuestro propio botón en vez
// del feo selector nativo.
const inputArchivo = ref(null)
const mensajeDatos = ref('')

function abrirSelectorDeArchivo() {
  inputArchivo.value.click()
}

async function manejarArchivoSeleccionado(evento) {
  const archivo = evento.target.files[0]
  if (!archivo) return

  try {
    await importarDatos(archivo)
    mensajeDatos.value = '✓ Datos importados correctamente.'
  } catch {
    mensajeDatos.value = '✗ El archivo no tiene un formato válido.'
  }
  // Limpiamos el input para poder volver a elegir el mismo archivo si hace falta.
  evento.target.value = ''
}

// --- Restaurar valores de fábrica ---
// Mismo patrón que la advertencia de saldo negativo en el formulario
// de movimientos: nunca ejecutamos algo destructivo de un solo click,
// primero mostramos una tarjeta de confirmación explícita.
const confirmandoReinicio = ref(false)

function restaurar() {
  restaurarDeFabrica()
  confirmandoReinicio.value = false
}
</script>

<template>
  <div class="configuracion">
    <h2>Configuración</h2>

    <section class="bloque">
      <h3>Tu perfil</h3>
      <p class="ayuda" style="margin-top: 0">
        Datos opcionales — no afectan ningún cálculo, son solo para que la app se sienta tuya.
      </p>

      <form class="form-perfil" @submit.prevent="guardarPerfil">
        <label class="campo-perfil">
          Nombre
          <input v-model="perfilForm.nombre" type="text" placeholder="Ej: José" />
        </label>
        <label class="campo-perfil">
          Apellido
          <input v-model="perfilForm.apellido" type="text" placeholder="Ej: Pérez" />
        </label>
        <label class="campo-perfil">
          Fecha de nacimiento
          <input v-model="perfilForm.fechaNacimiento" type="date" />
        </label>
        <button type="submit" class="guardar-perfil">Guardar perfil</button>
      </form>
      <p v-if="mensajePerfil" class="mensaje-tasa">{{ mensajePerfil }}</p>
    </section>

    <section class="bloque">
      <h3>Tasa de cambio (USD → Bs)</h3>

      <!-- Tasas actuales -->
      <div class="tasas-actuales">
        <div class="tasa-chip">
          <span class="tasa-etiqueta">Paralela (Binance)</span>
          <span v-if="tasaActual" class="tasa-valor">
            {{ formatearMonto(tasaActual.valor, 'VES') }}
            <small>· {{ tasaActual.fecha }}</small>
          </span>
          <span v-else class="tasa-valor sin-cargar">Sin datos</span>
        </div>
        <div class="tasa-chip">
          <span class="tasa-etiqueta">Oficial (BCV)</span>
          <span v-if="tasaOficialActual" class="tasa-valor">
            {{ formatearMonto(tasaOficialActual.valor, 'VES') }}
            <small>· {{ tasaOficialActual.fecha }}</small>
          </span>
          <span v-else class="tasa-valor sin-cargar">Sin datos</span>
        </div>
      </div>

      <!-- Obtener desde API -->
      <button class="exportar" :disabled="cargandoTasa" @click="traerTasaDesdeAPI">
        {{ cargandoTasa ? 'Consultando...' : '⟳ Actualizar desde Binance / BCV' }}
      </button>

      <!-- Tasa manual -->
      <p class="ayuda" style="margin-top: 12px">O ingresala a mano:</p>
      <div class="tipo-tasa">
        <label :class="['tipo-opcion', { activa: tipoTasaManual === 'paralelo' }]">
          <input v-model="tipoTasaManual" type="radio" value="paralelo" /> Paralela
        </label>
        <label :class="['tipo-opcion', { activa: tipoTasaManual === 'oficial' }]">
          <input v-model="tipoTasaManual" type="radio" value="oficial" /> Oficial (BCV)
        </label>
      </div>
      <form class="form-tasa" @submit.prevent="guardarTasa">
        <input
          type="number"
          v-model="nuevaTasa"
          min="0"
          step="0.01"
          :placeholder="tipoTasaManual === 'paralelo' ? 'Ej: 762.78' : 'Ej: 563.29'"
        />
        <button type="submit">Guardar</button>
      </form>

      <p v-if="mensajeTasa" class="mensaje-tasa">{{ mensajeTasa }}</p>

      <!-- Auto-actualización -->
      <div class="auto-update">
        <label class="auto-update-toggle">
          <input
            type="checkbox"
            :checked="perfil.autoActualizarTasa"
            @change="actualizarPerfil({ autoActualizarTasa: $event.target.checked })"
          />
          Actualizar tasa automáticamente al abrir la app
        </label>
        <div v-if="perfil.autoActualizarTasa" class="auto-update-intervalo">
          <span class="ayuda">Frecuencia:</span>
          <select
            :value="perfil.intervaloActualizacion"
            @change="actualizarPerfil({ intervaloActualizacion: $event.target.value })"
          >
            <option value="siempre">Cada vez que abro la app</option>
            <option value="horario">Como máximo cada hora</option>
            <option value="diario">Como máximo una vez al día</option>
          </select>
        </div>
        <p v-if="perfil.ultimaActualizacionTasa" class="ayuda">
          Última actualización automática:
          {{ new Date(perfil.ultimaActualizacionTasa).toLocaleString('es-VE') }}
        </p>
      </div>

      <!-- Historiales -->
      <details v-if="historialParalelo.length > 0" class="historial">
        <summary>Historial paralela ({{ historialParalelo.length }})</summary>
        <ul>
          <li v-for="t in historialParalelo" :key="t.fecha + t.tipo">
            <span>{{ t.fecha }}</span>
            <span>{{ formatearMonto(t.valor, 'VES') }}</span>
            <span class="origen">{{ t.origen === 'manual' ? 'manual' : 'API' }}</span>
          </li>
        </ul>
      </details>
      <details v-if="historialOficial.length > 0" class="historial">
        <summary>Historial oficial BCV ({{ historialOficial.length }})</summary>
        <ul>
          <li v-for="t in historialOficial" :key="t.fecha + t.tipo">
            <span>{{ t.fecha }}</span>
            <span>{{ formatearMonto(t.valor, 'VES') }}</span>
            <span class="origen">{{ t.origen === 'manual' ? 'manual' : 'API' }}</span>
          </li>
        </ul>
      </details>
    </section>

    <section class="bloque">
      <h3>Tus datos</h3>
      <p class="ayuda" style="margin-top: 0">
        Exportar guarda un archivo .json con todo lo cargado — billeteras, movimientos,
        tasas y más. Es tu respaldo y lo que te va a permitir migrar a otra base de datos
        el día de mañana sin perder nada. Importar hace lo contrario: reemplaza lo
        cargado por el contenido de un archivo .json exportado antes.
      </p>
      <div class="acciones-datos">
        <button class="exportar" @click="exportarDatos">⬇ Exportar datos (.json)</button>
        <button class="exportar" @click="abrirSelectorDeArchivo">⬆ Importar datos</button>
      </div>
      <!--
        Input de archivo oculto con CSS (ver .oculto): lo disparamos por
        código con inputArchivo.value.click(), así podemos mostrar un botón
        con nuestro propio estilo en vez del feo selector nativo. @change
        se dispara cuando el usuario elige un archivo.
      -->
      <input
        ref="inputArchivo"
        type="file"
        accept="application/json"
        class="oculto"
        @change="manejarArchivoSeleccionado"
      />
      <p v-if="mensajeDatos" class="mensaje-tasa">{{ mensajeDatos }}</p>
    </section>

    <section class="bloque peligro">
      <h3>Restaurar valores de fábrica</h3>
      <p class="ayuda">
        Borra todas tus billeteras, movimientos y tasas guardadas, y deja la app como recién
        instalada. <strong>No se puede deshacer.</strong> Si querés conservar un respaldo antes,
        usá "Exportar datos (.json)" de arriba.
      </p>

      <button v-if="!confirmandoReinicio" class="boton-peligro" @click="confirmandoReinicio = true">
        Restaurar valores de fábrica
      </button>

      <div v-else class="confirmacion">
        <p class="confirmacion-texto">
          ⚠ Esto va a borrar TODOS tus datos guardados y no se puede deshacer. ¿Seguro que querés continuar?
        </p>
        <div class="confirmacion-acciones">
          <button type="button" class="cancelar" @click="confirmandoReinicio = false">Cancelar</button>
          <button type="button" class="confirmar-peligro" @click="restaurar">Sí, borrar todo</button>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.configuracion h2 {
  margin: 0 0 16px;
}

.bloque {
  background: var(--surface);
  border-radius: var(--radius);
  padding: 16px;
  margin-bottom: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.bloque h3 {
  margin: 0 0 10px;
  font-size: 1rem;
}

.form-perfil {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.campo-perfil {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.85rem;
  color: var(--muted);
}

.campo-perfil input {
  padding: 9px 10px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  font-size: 0.95rem;
  color: var(--text);
  background: var(--bg);
}

.guardar-perfil {
  margin-top: 4px;
  padding: 10px;
  border: none;
  border-radius: var(--radius);
  background: var(--accent);
  color: #fff;
  font-size: 0.85rem;
  cursor: pointer;
}

.guardar-perfil:hover {
  background: var(--accent-dark);
}

.acciones-datos {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

.exportar {
  flex: 1;
  padding: 10px;
  border: 1px solid var(--accent);
  border-radius: var(--radius);
  background: transparent;
  color: var(--accent);
  font-size: 0.85rem;
  cursor: pointer;
}

.exportar:hover {
  background: var(--accent);
  color: #fff;
}

.oculto {
  display: none;
}

.tasas-actuales {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}

.tasa-chip {
  flex: 1;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tasa-etiqueta {
  font-size: 0.72rem;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.tasa-valor {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text);
}

.tasa-valor.sin-cargar {
  font-weight: 400;
  color: var(--muted);
  font-style: italic;
}

.tasa-valor small {
  font-weight: 400;
  font-size: 0.72rem;
  color: var(--muted);
}

.tipo-tasa {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.tipo-opcion {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  font-size: 0.85rem;
  cursor: pointer;
}

.tipo-opcion.activa {
  border-color: var(--accent);
  color: var(--accent);
}

.tipo-opcion input[type="radio"] {
  accent-color: var(--accent);
}

.auto-update {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.auto-update-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.88rem;
  cursor: pointer;
}

.auto-update-toggle input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: var(--accent);
  cursor: pointer;
}

.auto-update-intervalo {
  display: flex;
  align-items: center;
  gap: 8px;
}

.auto-update-intervalo select {
  flex: 1;
  padding: 7px 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  font-size: 0.85rem;
  background: var(--bg);
  color: var(--text);
}

.tasa-actual {
  margin: 0 0 10px;
  font-size: 0.95rem;
  font-weight: 500;
}

.tasa-actual.sin-cargar {
  color: var(--muted);
  font-weight: 400;
  font-style: italic;
}

.fecha-tasa {
  font-weight: 400;
  font-size: 0.78rem;
  color: var(--muted);
}

.form-tasa {
  display: flex;
  gap: 8px;
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

.ayuda {
  margin: 8px 0 0;
  font-size: 0.78rem;
  color: var(--muted);
}

.mensaje-tasa {
  margin: 6px 0 0;
  font-size: 0.82rem;
  color: var(--accent);
}

.historial {
  margin-top: 12px;
  font-size: 0.82rem;
}

.historial summary {
  cursor: pointer;
  color: var(--accent);
}

.historial ul {
  list-style: none;
  margin: 10px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.historial li {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  color: var(--muted);
}

.historial .origen {
  font-size: 0.72rem;
  text-transform: uppercase;
}

.peligro h3 {
  color: var(--liability);
}

.boton-peligro {
  margin-top: 4px;
  padding: 12px;
  width: 100%;
  border: 1px solid var(--liability);
  border-radius: var(--radius);
  background: transparent;
  color: var(--liability);
  font-size: 0.9rem;
  cursor: pointer;
}

.boton-peligro:hover {
  background: var(--liability);
  color: #fff;
}

.confirmacion {
  margin-top: 4px;
  border: 1px solid var(--liability);
  background: #fbeae6;
  border-radius: var(--radius);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.confirmacion-texto {
  margin: 0;
  font-size: 0.88rem;
  color: var(--liability);
}

.confirmacion-acciones {
  display: flex;
  gap: 8px;
}

.confirmacion-acciones button {
  flex: 1;
  padding: 10px;
  border-radius: var(--radius);
  font-size: 0.85rem;
  cursor: pointer;
  border: 1px solid var(--liability);
}

.cancelar {
  background: transparent;
  color: var(--liability);
}

.confirmar-peligro {
  background: var(--liability);
  color: #fff;
}
</style>
