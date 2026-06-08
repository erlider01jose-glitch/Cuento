<script setup>
import { ref } from 'vue'
import { useFinanzas, formatearMonto } from '../composables/useFinanzas'

const { tasaActual, tasaOficialActual } = useFinanzas()

const visible = ref(false)
let temporizador = null

function alternar() {
  if (visible.value) {
    visible.value = false
    clearTimeout(temporizador)
    return
  }
  visible.value = true
  clearTimeout(temporizador)
  temporizador = setTimeout(() => { visible.value = false }, 3000)
}
</script>

<template>
  <div class="widget-tasa">
    <Transition name="popup">
      <div v-if="visible" class="popup-tasas" role="status" aria-live="polite">
        <p class="popup-titulo">Tasas hoy</p>
        <div class="popup-fila">
          <span class="popup-etiqueta">Paralela</span>
          <span class="popup-valor">
            {{ tasaActual ? formatearMonto(tasaActual.valor, 'VES') : '—' }}
          </span>
        </div>
        <div class="popup-fila">
          <span class="popup-etiqueta">BCV</span>
          <span class="popup-valor">
            {{ tasaOficialActual ? formatearMonto(tasaOficialActual.valor, 'VES') : '—' }}
          </span>
        </div>
        <p class="popup-nota">por 1 USD</p>
      </div>
    </Transition>

    <button class="btn-flotante" @click="alternar" :title="visible ? 'Cerrar' : 'Ver tasas'">
      <!--
        Punto indicador: verde si hay al menos una tasa de hoy,
        gris si no hay ninguna registrada.
      -->
      <span
        class="indicador"
        :class="(tasaActual || tasaOficialActual) ? 'indicador-ok' : 'indicador-vacio'"
      ></span>
      <span class="btn-icono">Bs/$</span>
    </button>
  </div>
</template>

<style scoped>
.widget-tasa {
  position: fixed;
  bottom: 24px;
  right: 16px;
  z-index: 100;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}

/* ── Botón flotante ── */
.btn-flotante {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: none;
  background: var(--accent);
  color: #fff;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  opacity: 0.55;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.25);
  transition: opacity 0.2s ease, transform 0.15s ease;
}

.btn-flotante:hover,
.btn-flotante:focus-visible {
  opacity: 1;
  transform: scale(1.08);
}

.btn-icono {
  line-height: 1;
}

/* Punto indicador de estado */
.indicador {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 1.5px solid var(--accent);
}

.indicador-ok    { background: #4ade80; }
.indicador-vacio { background: #94a3b8; }

/* ── Popup ── */
.popup-tasas {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px 14px;
  min-width: 160px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.18);
}

.popup-titulo {
  margin: 0 0 8px;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
}

.popup-fila {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 4px 0;
}

.popup-etiqueta {
  font-size: 0.82rem;
  color: var(--muted);
}

.popup-valor {
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}

.popup-nota {
  margin: 6px 0 0;
  font-size: 0.7rem;
  color: var(--muted);
  text-align: right;
}

/* ── Animación ── */
.popup-enter-active,
.popup-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.popup-enter-from,
.popup-leave-to {
  opacity: 0;
  transform: translateY(6px) scale(0.97);
}
</style>
