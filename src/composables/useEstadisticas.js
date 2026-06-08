import { computed, ref } from 'vue'
import { useFinanzas } from './useFinanzas'

// Devuelve el ISO (YYYY-MM-DD) de una fecha Date.
function isoFecha(d) {
  return d.toISOString().slice(0, 10)
}

// Genera los últimos N períodos semanales (lunes→domingo), el más
// reciente primero. Índice 0 = semana actual.
function generarSemanas(n = 8) {
  const hoy = new Date()
  // día de la semana: lunes=0 … domingo=6
  const diaSemana = (hoy.getDay() + 6) % 7
  const lunesActual = new Date(hoy)
  lunesActual.setDate(hoy.getDate() - diaSemana)

  return Array.from({ length: n }, (_, i) => {
    const lunes = new Date(lunesActual)
    lunes.setDate(lunesActual.getDate() - i * 7)
    const domingo = new Date(lunes)
    domingo.setDate(lunes.getDate() + 6)

    const mesCorto = lunes.toLocaleDateString('es-VE', { month: 'short' })
    const etiqueta =
      i === 0 ? 'Esta sem.'
      : i === 1 ? 'Sem. ant.'
      : `${lunes.getDate()} ${mesCorto}`

    return { etiqueta, desde: isoFecha(lunes), hasta: isoFecha(domingo) }
  })
}

// Genera los últimos N meses completos, el más reciente primero.
function generarMeses(n = 6) {
  const hoy = new Date()
  return Array.from({ length: n }, (_, i) => {
    const primer = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)
    const ultimo = new Date(primer.getFullYear(), primer.getMonth() + 1, 0)
    const etiqueta = primer.toLocaleDateString('es-VE', { month: 'short', year: 'numeric' })
    return { etiqueta, desde: isoFecha(primer), hasta: isoFecha(ultimo) }
  })
}

export function useEstadisticas() {
  const {
    movimientos,
    cuentas,
    cuentasPorCobrar,
    monedaReferencia,
    tasaParaFecha,
    convertir,
  } = useFinanzas()

  // ─── helpers internos ───────────────────────────────────────────────

  // Convierte un monto (en la moneda de su cuenta) a la moneda de referencia
  // usando la tasa vigente en la fecha del movimiento.
  function enReferencia(monto, moneda, fecha) {
    if (moneda === monedaReferencia.value) return monto
    const resultado = convertir(monto, moneda, monedaReferencia.value, fecha)
    return resultado ?? 0 // si no hay tasa para esa fecha, lo ignoramos
  }

  // Saldo de una cuenta en una fecha pasada: reproduce todos los
  // movimientos de esa cuenta hasta esa fecha (sin tocar el saldo actual).
  function saldoEnFecha(cuentaId, fecha) {
    return movimientos.value
      .filter((m) => m.cuentaId === cuentaId && m.fecha <= fecha)
      .reduce((s, m) => s + (m.tipo === 'ingreso' ? m.monto : -m.monto), 0)
  }

  // Patrimonio neto en una fecha histórica (reconstruido de cero):
  // suma de cuentas convertidas con la tasa de ese día + cuentas por
  // cobrar pendientes registradas hasta esa fecha.
  function patrimonioEnFecha(fecha) {
    let total = 0

    for (const cuenta of cuentas.value) {
      const saldo = saldoEnFecha(cuenta.id, fecha)
      total += enReferencia(saldo, cuenta.moneda, fecha)
    }

    for (const cxc of cuentasPorCobrar.value) {
      if (cxc.fecha > fecha) continue // se registró después de esta fecha
      const pagado = cxc.abonos
        .filter((a) => a.fecha <= fecha)
        .reduce((s, a) => s + a.aplicadoCapital, 0)
      const pendiente = Math.max(0, cxc.montoOriginal - pagado)
      if (pendiente > 0) total += enReferencia(pendiente, cxc.moneda, fecha)
    }

    return total
  }

  // Ingresos, gastos y flujo neto (en moneda de referencia) de un período.
  function flujoEnPeriodo(desde, hasta) {
    let ingresos = 0
    let gastos = 0

    for (const mov of movimientos.value) {
      if (mov.fecha < desde || mov.fecha > hasta) continue
      const cuenta = cuentas.value.find((c) => c.id === mov.cuentaId)
      if (!cuenta) continue
      const val = enReferencia(mov.monto, cuenta.moneda, mov.fecha)
      if (mov.tipo === 'ingreso') ingresos += val
      else gastos += val
    }

    return { ingresos, gastos, neto: ingresos - gastos }
  }

  // ─── estado del selector ────────────────────────────────────────────

  // 'semanas' | 'meses'
  const vistaActiva = ref('semanas')

  // ─── períodos computados ────────────────────────────────────────────

  // Lista de períodos con su flujo calculado (siempre reactivo porque
  // usa movimientos.value dentro de flujoEnPeriodo).
  const periodosSemanas = computed(() =>
    generarSemanas(8).map((p) => ({ ...p, ...flujoEnPeriodo(p.desde, p.hasta) }))
  )

  const periodosMeses = computed(() =>
    generarMeses(6).map((p) => ({
      ...p,
      ...flujoEnPeriodo(p.desde, p.hasta),
      patrimonio: patrimonioEnFecha(p.hasta),
    }))
  )

  // El período que se muestra según la vista activa (semanas o meses).
  const periodos = computed(() =>
    vistaActiva.value === 'semanas' ? periodosSemanas.value : periodosMeses.value
  )

  // Máximo valor absoluto del flujo neto en los períodos visibles —
  // lo usamos para normalizar la altura de las barras del gráfico.
  const maxFlujo = computed(() =>
    Math.max(1, ...periodos.value.map((p) => Math.abs(p.neto)))
  )
  const maxPatrimonio = computed(() =>
    Math.max(1, ...periodosMeses.value.map((p) => p.patrimonio ?? 0))
  )

  // ─── resumen del período actual (semana o mes en curso) ─────────────

  const resumenActual = computed(() => periodos.value[0] ?? { ingresos: 0, gastos: 0, neto: 0 })
  const resumenAnterior = computed(() => periodos.value[1] ?? null)

  // Variación del flujo neto respecto al período anterior (en %).
  const variacionFlujo = computed(() => {
    const ant = resumenAnterior.value
    if (!ant || ant.neto === 0) return null
    return ((resumenActual.value.neto - ant.neto) / Math.abs(ant.neto)) * 100
  })

  // ─── efecto devaluación ─────────────────────────────────────────────

  // Saldo total en VES de todas las cuentas (valor vivo, no histórico).
  const saldoTotalVES = computed(() =>
    cuentas.value
      .filter((c) => c.moneda === 'VES')
      .reduce((s, c) => s + c.saldo, 0)
  )

  // Para cada mes de los últimos 6, cuánto valía el saldo VES actual
  // en USD (usando la tasa de ese mes). Muestra cuánto "perdiste" en
  // dólares sin haber gastado nada, solo por la devaluación.
  const efectoDevaluacion = computed(() => {
    if (saldoTotalVES.value === 0) return []
    return generarMeses(6).map((p) => {
      const tasa = tasaParaFecha(p.hasta)
      if (!tasa) return { ...p, valorUSD: null }
      const valorUSD = saldoTotalVES.value / tasa.valor
      return { ...p, valorUSD }
    })
  })

  // ─── cuentas por cobrar en contexto ────────────────────────────────

  const cxcResumen = computed(() => {
    const hoyISO = isoFecha(new Date())
    let enUSD = 0, enVES = 0, enVESvalUSD = 0

    for (const cxc of cuentasPorCobrar.value) {
      const pagado = cxc.abonos.reduce((s, a) => s + a.aplicadoCapital, 0)
      const pendiente = Math.max(0, cxc.montoOriginal - pagado)
      if (pendiente === 0) continue

      if (cxc.moneda === 'USD') {
        enUSD += pendiente
      } else {
        enVES += pendiente
        const tasa = tasaParaFecha(hoyISO)
        if (tasa) enVESvalUSD += pendiente / tasa.valor
      }
    }

    return { enUSD, enVES, enVESvalUSD }
  })

  return {
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
  }
}
