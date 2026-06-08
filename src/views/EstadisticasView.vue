<script setup>
import { useEstadisticas } from '../composables/useEstadisticas'
import { useFinanzas, formatearMonto } from '../composables/useFinanzas'

const {
  vistaActiva,
  periodos,
  periodosMeses,
  maxFlujo,
  maxPatrimonio,
  resumenActual,
  resumenAnterior,
  variacionFlujo,
  saldoTotalVES,
  efectoDevaluacion,
  cxcResumen,
} = useEstadisticas()

const { monedaReferencia } = useFinanzas()

// Altura de una barra del gráfico (0–100 %) relativa al valor máximo.
function alturaBarra(valor, max) {
  if (!max || max === 0) return 0
  return Math.round((Math.abs(valor) / max) * 100)
}

function signoVariacion(v) {
  if (v === null) return ''
  return v > 0 ? '+' : ''
}
</script>

<template>
  <div class="estadisticas">

    <!-- ─── Tarjeta resumen del período actual ──────────────────────── -->
    <section class="bloque resumen-actual">
      <div class="selector-vista">
        <button
          :class="['btn-vista', { activo: vistaActiva === 'semanas' }]"
          @click="vistaActiva = 'semanas'"
        >Por semana</button>
        <button
          :class="['btn-vista', { activo: vistaActiva === 'meses' }]"
          @click="vistaActiva = 'meses'"
        >Por mes</button>
      </div>

      <h2 class="periodo-titulo">
        {{ vistaActiva === 'semanas' ? 'Esta semana' : 'Este mes' }}
      </h2>

      <div class="kpis">
        <div class="kpi kpi-ingreso">
          <span class="kpi-etiqueta">Ingresos</span>
          <span class="kpi-valor">{{ formatearMonto(resumenActual.ingresos, monedaReferencia) }}</span>
        </div>
        <div class="kpi kpi-gasto">
          <span class="kpi-etiqueta">Gastos</span>
          <span class="kpi-valor">{{ formatearMonto(resumenActual.gastos, monedaReferencia) }}</span>
        </div>
        <div class="kpi kpi-neto" :class="resumenActual.neto >= 0 ? 'positivo' : 'negativo'">
          <span class="kpi-etiqueta">Flujo neto</span>
          <span class="kpi-valor">{{ formatearMonto(resumenActual.neto, monedaReferencia) }}</span>
          <span v-if="variacionFlujo !== null" class="kpi-variacion">
            {{ signoVariacion(variacionFlujo) }}{{ variacionFlujo.toFixed(0) }}% vs período ant.
          </span>
        </div>
      </div>
    </section>

    <!-- ─── Gráfico de barras: flujo neto por período ───────────────── -->
    <section class="bloque">
      <h3 class="bloque-titulo">Flujo neto — últimos {{ vistaActiva === 'semanas' ? '8 períodos' : '6 meses' }}</h3>
      <div class="grafico-barras" role="img" :aria-label="`Gráfico de flujo neto por ${vistaActiva}`">
        <div
          v-for="(p, i) in periodos"
          :key="i"
          class="barra-col"
        >
          <!-- zona positiva (ingresos arriba) -->
          <div class="barra-zona barra-zona-arriba">
            <div
              v-if="p.neto > 0"
              class="barra barra-positiva"
              :style="{ height: alturaBarra(p.neto, maxFlujo) + '%' }"
              :title="formatearMonto(p.neto, monedaReferencia)"
            ></div>
          </div>
          <!-- zona negativa (gastos abajo) -->
          <div class="barra-zona barra-zona-abajo">
            <div
              v-if="p.neto < 0"
              class="barra barra-negativa"
              :style="{ height: alturaBarra(p.neto, maxFlujo) + '%' }"
              :title="formatearMonto(p.neto, monedaReferencia)"
            ></div>
          </div>
          <span class="barra-etiqueta">{{ p.etiqueta }}</span>
        </div>
      </div>
    </section>

    <!-- ─── Evolución del patrimonio (solo vista meses) ─────────────── -->
    <section class="bloque" v-if="vistaActiva === 'meses'">
      <h3 class="bloque-titulo">Evolución del patrimonio</h3>
      <div class="grafico-barras grafico-patrimonio" role="img" aria-label="Evolución del patrimonio por mes">
        <div
          v-for="(p, i) in periodosMeses"
          :key="i"
          class="barra-col"
        >
          <div class="barra-zona barra-zona-full">
            <div
              class="barra barra-patrimonio"
              :style="{ height: alturaBarra(p.patrimonio, maxPatrimonio) + '%' }"
              :title="formatearMonto(p.patrimonio, monedaReferencia)"
            ></div>
          </div>
          <span class="barra-etiqueta">{{ p.etiqueta }}</span>
        </div>
      </div>
    </section>

    <!-- ─── Comparación mes a mes ────────────────────────────────────── -->
    <section class="bloque" v-if="vistaActiva === 'meses' && periodosMeses.length >= 2">
      <h3 class="bloque-titulo">Comparación mensual</h3>
      <div class="tabla-meses">
        <div class="tabla-fila tabla-encabezado">
          <span>Mes</span>
          <span>Ingresos</span>
          <span>Gastos</span>
          <span>Flujo</span>
        </div>
        <div
          v-for="(p, i) in periodosMeses"
          :key="i"
          class="tabla-fila"
          :class="{ 'fila-actual': i === 0 }"
        >
          <span class="mes-etiqueta">{{ p.etiqueta }}</span>
          <span class="monto-ingreso">{{ formatearMonto(p.ingresos, monedaReferencia) }}</span>
          <span class="monto-gasto">{{ formatearMonto(p.gastos, monedaReferencia) }}</span>
          <span :class="['monto-neto', p.neto >= 0 ? 'positivo' : 'negativo']">
            {{ formatearMonto(p.neto, monedaReferencia) }}
          </span>
        </div>
      </div>
    </section>

    <!-- ─── Efecto devaluación (solo si hay saldo en VES) ───────────── -->
    <section class="bloque bloque-devaluacion" v-if="saldoTotalVES > 0">
      <h3 class="bloque-titulo">Efecto devaluación en tus bolívares</h3>
      <p class="devaluacion-descripcion">
        Muestra cuánto valdrían en USD tu saldo actual en VES
        ({{ formatearMonto(saldoTotalVES, 'VES') }}) si lo hubieras convertido
        en cada mes anterior — con la tasa de ese momento.
      </p>
      <div v-if="efectoDevaluacion.length === 0" class="vacio">
        No hay historial de tasas suficiente para calcular.
      </div>
      <div v-else class="grafico-barras" role="img" aria-label="Efecto de la devaluación por mes">
        <div
          v-for="(p, i) in efectoDevaluacion"
          :key="i"
          class="barra-col"
        >
          <div class="barra-zona barra-zona-full">
            <div
              v-if="p.valorUSD !== null"
              class="barra barra-devaluacion"
              :style="{ height: alturaBarra(p.valorUSD, Math.max(...efectoDevaluacion.filter(x=>x.valorUSD).map(x=>x.valorUSD))) + '%' }"
              :title="formatearMonto(p.valorUSD, 'USD')"
            ></div>
            <div v-else class="barra barra-sin-dato" style="height: 4px"></div>
          </div>
          <span class="barra-etiqueta">{{ p.etiqueta }}</span>
        </div>
      </div>
      <p class="devaluacion-nota">
        Si la barra más reciente es más baja que las anteriores, el dólar subió
        y tus bolívares valen menos en términos de USD.
      </p>
    </section>

    <!-- ─── Resumen de cuentas por cobrar ────────────────────────────── -->
    <section class="bloque" v-if="cxcResumen.enUSD > 0 || cxcResumen.enVES > 0">
      <h3 class="bloque-titulo">Cuentas por cobrar pendientes</h3>
      <div class="cxc-resumen">
        <div v-if="cxcResumen.enUSD > 0" class="cxc-fila">
          <span class="cxc-etiqueta">En dólares</span>
          <span class="cxc-valor ingreso">{{ formatearMonto(cxcResumen.enUSD, 'USD') }}</span>
        </div>
        <div v-if="cxcResumen.enVES > 0" class="cxc-fila">
          <span class="cxc-etiqueta">En bolívares</span>
          <span class="cxc-valor ingreso">{{ formatearMonto(cxcResumen.enVES, 'VES') }}</span>
        </div>
        <div v-if="cxcResumen.enVES > 0 && cxcResumen.enVESvalUSD > 0" class="cxc-fila cxc-equivalente">
          <span class="cxc-etiqueta">Equivalente en USD (tasa hoy)</span>
          <span class="cxc-valor ingreso">{{ formatearMonto(cxcResumen.enVESvalUSD, 'USD') }}</span>
        </div>
      </div>
    </section>

    <!-- Estado vacío: sin datos todavía -->
    <div
      v-if="periodos.every(p => p.ingresos === 0 && p.gastos === 0)"
      class="estado-vacio"
    >
      <p>Todavía no hay movimientos para mostrar estadísticas.</p>
      <p>Registrá tus primeros ingresos y gastos para ver el flujo aquí.</p>
    </div>

  </div>
</template>

<style scoped>
.estadisticas {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.bloque {
  background: var(--surface);
  border-radius: 16px;
  padding: 16px;
}

.bloque-titulo {
  margin: 0 0 12px;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

/* ── Selector semanas / meses ── */
.selector-vista {
  display: flex;
  gap: 6px;
  margin-bottom: 12px;
}

.btn-vista {
  flex: 1;
  padding: 7px 0;
  border: none;
  border-radius: 8px;
  background: var(--bg);
  color: var(--muted);
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.btn-vista.activo {
  background: var(--accent);
  color: #fff;
}

/* ── Tarjeta resumen actual ── */
.periodo-titulo {
  margin: 0 0 10px;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text);
}

.kpis {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.kpi {
  background: var(--bg);
  border-radius: 10px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.kpi-neto {
  grid-column: 1 / -1;
  flex-direction: row;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 10px;
}

.kpi-etiqueta {
  font-size: 0.75rem;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.kpi-valor {
  font-size: 1.1rem;
  font-weight: 700;
}

.kpi-ingreso .kpi-valor { color: var(--income); }
.kpi-gasto .kpi-valor  { color: var(--expense); }
.kpi-neto.positivo .kpi-valor { color: var(--income); }
.kpi-neto.negativo .kpi-valor { color: var(--expense); }

.kpi-variacion {
  font-size: 0.78rem;
  color: var(--muted);
  margin-left: auto;
}

/* ── Gráficos de barras CSS ── */
.grafico-barras {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 140px;
}

.grafico-patrimonio {
  align-items: flex-end;
  height: 120px;
}

.barra-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
  gap: 2px;
}

/* Para el gráfico biaxial (positivo arriba / negativo abajo) */
.barra-zona {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.barra-zona-arriba {
  align-items: flex-end; /* la barra crece desde el centro hacia arriba */
}

.barra-zona-abajo {
  align-items: flex-start; /* la barra cuelga desde el centro hacia abajo */
}

.barra-zona-full {
  align-items: flex-end;
}

.barra {
  width: 70%;
  min-height: 3px;
  border-radius: 4px 4px 2px 2px;
  transition: height 0.3s ease;
}

.barra-positiva   { background: var(--income); }
.barra-negativa   { background: var(--expense); border-radius: 2px 2px 4px 4px; }
.barra-patrimonio { background: var(--accent); }
.barra-devaluacion { background: #e8b44a; } /* ámbar: señal de alerta */
.barra-sin-dato   { background: var(--muted); opacity: 0.3; border-radius: 4px; }

.barra-etiqueta {
  font-size: 0.62rem;
  color: var(--muted);
  text-align: center;
  line-height: 1.2;
  max-width: 100%;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

/* ── Tabla comparación mensual ── */
.tabla-meses {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tabla-fila {
  display: grid;
  grid-template-columns: 2fr 1.3fr 1.3fr 1.3fr;
  gap: 4px;
  font-size: 0.82rem;
  padding: 4px 0;
  border-bottom: 1px solid var(--bg);
}

.tabla-encabezado {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  border-bottom: 2px solid var(--bg);
}

.fila-actual {
  font-weight: 600;
}

.mes-etiqueta { color: var(--text); }
.monto-ingreso { color: var(--income); text-align: right; }
.monto-gasto   { color: var(--expense); text-align: right; }
.monto-neto    { text-align: right; }
.monto-neto.positivo { color: var(--income); }
.monto-neto.negativo { color: var(--expense); }

/* ── Devaluación ── */
.bloque-devaluacion {
  border-left: 3px solid #e8b44a;
}

.devaluacion-descripcion {
  font-size: 0.82rem;
  color: var(--muted);
  margin: 0 0 12px;
  line-height: 1.4;
}

.devaluacion-nota {
  font-size: 0.78rem;
  color: var(--muted);
  margin: 8px 0 0;
  font-style: italic;
}

/* ── Cuentas por cobrar ── */
.cxc-resumen {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cxc-fila {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
  background: var(--bg);
  border-radius: 8px;
}

.cxc-equivalente {
  opacity: 0.8;
  font-size: 0.85rem;
}

.cxc-etiqueta {
  font-size: 0.85rem;
  color: var(--muted);
}

.cxc-valor {
  font-weight: 600;
}

.cxc-valor.ingreso { color: var(--income); }

/* ── Estado vacío ── */
.estado-vacio {
  text-align: center;
  padding: 32px 16px;
  color: var(--muted);
  font-size: 0.9rem;
  line-height: 1.6;
}

.estado-vacio p { margin: 4px 0; }

.vacio {
  font-size: 0.85rem;
  color: var(--muted);
  text-align: center;
  padding: 12px 0;
}
</style>
