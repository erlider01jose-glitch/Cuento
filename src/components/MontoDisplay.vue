<script setup>
import { computed } from 'vue'
import { formatearMonto } from '../composables/useFinanzas'

const props = defineProps({
  monto: { type: Number, required: true },
  moneda: { type: String, required: true },
  // 'auto' colorea según signo, 'ingreso'/'gasto' fuerza color, 'neutro' sin color
  color: { type: String, default: 'neutro' },
})

const texto = computed(() => formatearMonto(props.monto, props.moneda))

const claseColor = computed(() => {
  if (props.color === 'auto') return props.monto >= 0 ? 'positivo' : 'negativo'
  if (props.color === 'ingreso') return 'positivo'
  if (props.color === 'gasto') return 'negativo'
  return ''
})
</script>

<template>
  <span class="monto-display" :class="claseColor">{{ texto }}</span>
</template>

<style scoped>
.monto-display {
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum';
}

.positivo { color: var(--income); }
.negativo { color: var(--expense); }
</style>
