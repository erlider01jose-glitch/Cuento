<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { useFinanzas, formatearMonto } from '../composables/useFinanzas'

const {
  tasas,
  tasaActual,
  perfil,
  actualizarPerfil,
  registrarTasa,
  restaurarDeFabrica,
  exportarDatos,
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
const mensajeTasa = ref('')

function guardarTasa() {
  const valor = Number(nuevaTasa.value)
  if (!nuevaTasa.value || valor <= 0) {
    mensajeTasa.value = 'Ingresá un valor válido (ej: 130.00).'
    return
  }
  registrarTasa({ fecha: new Date().toISOString().slice(0, 10), valor })
  mensajeTasa.value = '✓ Tasa guardada.'
  nuevaTasa.value = ''
}

// computed: el historial ordenado del más reciente al más viejo —
// así la persona ve primero la tasa de hoy y puede revisar hacia atrás.
const historial = computed(() => [...tasas.value].sort((a, b) => b.fecha.localeCompare(a.fecha)))

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
      <p v-if="tasaActual" class="tasa-actual">
        1 USD = {{ formatearMonto(tasaActual.valor, 'VES') }}
        <span class="fecha-tasa">· cargada el {{ tasaActual.fecha }}</span>
      </p>
      <p v-else class="tasa-actual sin-cargar">Todavía no cargaste ninguna tasa.</p>

      <form class="form-tasa" @submit.prevent="guardarTasa">
        <input
          type="number"
          v-model="nuevaTasa"
          min="0"
          step="0.01"
          placeholder="Ej: 130.00"
        />
        <button type="submit">Guardar tasa de hoy</button>
      </form>
      <p class="ayuda">
        Por ahora se carga a mano; la idea es que más adelante la app la traiga sola desde una API.
      </p>
      <p v-if="mensajeTasa" class="mensaje-tasa">{{ mensajeTasa }}</p>

      <details v-if="historial.length > 0" class="historial">
        <summary>Ver historial de tasas ({{ historial.length }})</summary>
        <ul>
          <li v-for="t in historial" :key="t.fecha">
            <span>{{ t.fecha }}</span>
            <span>1 USD = {{ formatearMonto(t.valor, 'VES') }}</span>
            <span class="origen">{{ t.origen === 'manual' ? 'manual' : 'API' }}</span>
          </li>
        </ul>
      </details>
    </section>

    <section class="bloque">
      <h3>Tus datos</h3>
      <p class="ayuda" style="margin-top: 0">
        Descargá un archivo .json con todo lo cargado — billeteras, movimientos, tasas y
        más. Es tu respaldo y lo que te va a permitir migrar a otra base de datos el día
        de mañana sin perder nada.
      </p>
      <button class="exportar" @click="exportarDatos">⬇ Exportar datos (.json)</button>
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

.exportar {
  margin-top: 4px;
  padding: 10px;
  width: 100%;
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
