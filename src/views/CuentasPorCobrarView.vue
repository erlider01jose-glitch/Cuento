<script setup>
import { ref, reactive } from 'vue'
import { useFinanzas, MONEDAS, SIMBOLOS_MONEDA, formatearMonto } from '../composables/useFinanzas'

const {
  cuentas,
  cuentasPorCobrar,
  totalPorCobrar,
  monedaReferencia,
  montoPendiente,
  agregarCuentaPorCobrar,
  registrarAbono,
} = useFinanzas()

function nombreCuenta(id) {
  return cuentas.value.find((c) => c.id === id)?.nombre ?? '—'
}

function fechaDeHoy() {
  return new Date().toISOString().slice(0, 10)
}

// --- Nueva cuenta por cobrar ---
const mostrarFormNueva = ref(false)
const nuevaCxc = reactive({
  persona: '',
  tipo: 'trabajo',
  concepto: '',
  monto: null,
  moneda: 'USD',
  fecha: fechaDeHoy(),
  cuentaOrigenId: cuentas.value[0]?.id ?? null,
})
const mensajeNueva = ref('')

function guardarCxc() {
  if (!nuevaCxc.persona.trim() || !nuevaCxc.monto) {
    mensajeNueva.value = 'Completá quién te debe y el monto antes de guardar.'
    return
  }

  agregarCuentaPorCobrar({
    persona: nuevaCxc.persona.trim(),
    tipo: nuevaCxc.tipo,
    concepto: nuevaCxc.concepto.trim(),
    montoOriginal: Number(nuevaCxc.monto),
    moneda: nuevaCxc.moneda,
    fecha: nuevaCxc.fecha,
    cuentaOrigenId: nuevaCxc.tipo === 'prestamo' ? Number(nuevaCxc.cuentaOrigenId) : null,
  })

  nuevaCxc.persona = ''
  nuevaCxc.tipo = 'trabajo'
  nuevaCxc.concepto = ''
  nuevaCxc.monto = null
  nuevaCxc.moneda = 'USD'
  nuevaCxc.fecha = fechaDeHoy()
  mensajeNueva.value = ''
  mostrarFormNueva.value = false
}

// --- Detalle y cobros ---
// Mismo patrón que MovimientosList: guardamos el id de la única
// cuenta "desplegada" (o null si ninguna) — al tocar otra, la
// anterior se cierra sola.
const expandidoId = ref(null)

function alternarDetalle(id) {
  expandidoId.value = expandidoId.value === id ? null : id
  // Al cambiar de cuenta expandida, reiniciamos el mini-formulario de
  // cobro: como solo se ve el de la cuenta abierta, alcanza con UN
  // objeto reactive compartido en vez de uno por cada cuenta.
  nuevoAbono.monto = null
  nuevoAbono.fecha = fechaDeHoy()
  nuevoAbono.cuentaDestinoId = cuentas.value[0]?.id ?? null
}

const nuevoAbono = reactive({
  monto: null,
  fecha: fechaDeHoy(),
  cuentaDestinoId: cuentas.value[0]?.id ?? null,
})

function registrarCobro(cxc) {
  if (!nuevoAbono.monto) return
  registrarAbono({
    cuentaPorCobrarId: cxc.id,
    fecha: nuevoAbono.fecha,
    monto: Number(nuevoAbono.monto),
    cuentaDestinoId: Number(nuevoAbono.cuentaDestinoId),
  })
  nuevoAbono.monto = null
  nuevoAbono.fecha = fechaDeHoy()
}
</script>

<template>
  <div class="por-cobrar">
    <h2>Cuentas por cobrar</h2>
    <p class="ayuda">
      Acá registrás lo que te deben: trabajos que ya hiciste pero todavía no te pagan, y plata
      que prestaste. Lo pendiente de cobrar suma a tu Patrimonio neto — sigue siendo tuyo,
      aunque lo tenga otra persona.
    </p>

    <section class="resumen-cobrar">
      <span class="etiqueta">Total pendiente de cobro</span>
      <span class="monto">{{ formatearMonto(totalPorCobrar, monedaReferencia) }}</span>
    </section>

    <p v-if="cuentasPorCobrar.length === 0" class="vacio">Todavía no registraste nada por cobrar.</p>

    <ul v-else class="lista-cxc">
      <li v-for="cxc in cuentasPorCobrar" :key="cxc.id" class="cxc">
        <!--
          Tocar la fila despliega/oculta el detalle — igual que un
          movimiento en "Movimientos". El ícono solo es una pista
          visual rápida de qué tipo de deuda es cada una.
        -->
        <div class="fila-cxc" @click="alternarDetalle(cxc.id)">
          <div class="info-cxc">
            <span class="persona">{{ cxc.tipo === 'prestamo' ? '💵' : '🔧' }} {{ cxc.persona }}</span>
            <span v-if="cxc.concepto" class="concepto">{{ cxc.concepto }}</span>
          </div>
          <div class="montos-cxc">
            <span class="pendiente" :class="{ pagado: montoPendiente(cxc) === 0 }">
              {{
                montoPendiente(cxc) === 0
                  ? '✓ Pagado'
                  : formatearMonto(montoPendiente(cxc), cxc.moneda)
              }}
            </span>
            <span class="original">de {{ formatearMonto(cxc.montoOriginal, cxc.moneda) }}</span>
          </div>
        </div>

        <div v-if="expandidoId === cxc.id" class="detalle-cxc">
          <p class="dato"><strong>Fecha:</strong> {{ cxc.fecha }}</p>
          <p v-if="cxc.tipo === 'prestamo'" class="dato">
            <strong>Salió de:</strong> {{ nombreCuenta(cxc.cuentaOrigenId) }}
          </p>

          <template v-if="cxc.abonos.length > 0">
            <h4>Cobros registrados</h4>
            <ul class="abonos">
              <li v-for="abono in cxc.abonos" :key="abono.id">
                <span>{{ abono.fecha }}</span>
                <span>{{ formatearMonto(abono.monto, cxc.moneda) }}</span>
                <!--
                  Si esta cuota incluyó "ganancia" (te devolvieron más
                  de lo que faltaba), lo marcamos aparte — así queda
                  claro qué parte fue cobro de la deuda y qué parte
                  fue ganancia, sin que vos tengas que calcularlo.
                -->
                <span v-if="abono.ganancia > 0" class="ganancia-tag">
                  +{{ formatearMonto(abono.ganancia, cxc.moneda) }} ganancia
                </span>
              </li>
            </ul>
          </template>

          <form
            v-if="montoPendiente(cxc) > 0"
            class="form-abono"
            @submit.prevent="registrarCobro(cxc)"
          >
            <h4>Registrar cobro</h4>
            <div class="fila-campos">
              <label class="campo-cuenta">
                Monto
                <input
                  type="number"
                  v-model="nuevoAbono.monto"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  required
                />
              </label>
              <label class="campo-cuenta">
                Fecha
                <input type="date" v-model="nuevoAbono.fecha" required />
              </label>
            </div>
            <label class="campo-cuenta">
              Entra a la cuenta
              <select v-model="nuevoAbono.cuentaDestinoId" required>
                <option v-for="c in cuentas" :key="c.id" :value="c.id">
                  {{ c.nombre }} ({{ c.moneda }})
                </option>
              </select>
            </label>
            <p class="ayuda-campo">
              Si el monto supera lo pendiente ({{ formatearMonto(montoPendiente(cxc), cxc.moneda) }}),
              la diferencia se registra sola como "Ganancia de préstamo".
            </p>
            <button type="submit" class="guardar-cuenta">Registrar cobro</button>
          </form>
          <p v-else class="saldado">Esta cuenta ya está saldada. ✓</p>
        </div>
      </li>
    </ul>

    <button v-if="!mostrarFormNueva" class="boton-nueva-cuenta" @click="mostrarFormNueva = true">
      + Nueva cuenta por cobrar
    </button>

    <form v-else class="form-cuenta" @submit.prevent="guardarCxc">
      <label class="campo-cuenta">
        ¿Quién te debe?
        <input v-model="nuevaCxc.persona" type="text" placeholder="Ej: Juan Pérez" required />
      </label>

      <!--
        Esta elección cambia el comportamiento del resto del
        formulario (más abajo aparece o no el campo "cuenta de
        origen") — por eso la ponemos primero y explicamos abajo,
        con texto que cambia solo, qué implica cada opción.
      -->
      <div class="tipo-cxc">
        <label>
          <input type="radio" value="trabajo" v-model="nuevaCxc.tipo" />
          🔧 Trabajo sin cobrar
        </label>
        <label>
          <input type="radio" value="prestamo" v-model="nuevaCxc.tipo" />
          💵 Préstamo
        </label>
      </div>
      <p class="ayuda-campo">
        {{
          nuevaCxc.tipo === 'trabajo'
            ? 'Un servicio que ya hiciste pero todavía no te pagan — esa plata nunca salió de ninguna cuenta, así que no afecta tus saldos.'
            : 'Plata real que prestaste desde una de tus cuentas — se va a descontar de ahí, como un gasto.'
        }}
      </p>

      <label class="campo-cuenta">
        Concepto <span class="opcional">(opcional)</span>
        <input v-model="nuevaCxc.concepto" type="text" placeholder="Ej: Reparación de nevera" />
      </label>

      <div class="fila-campos">
        <label class="campo-cuenta">
          Monto
          <input
            type="number"
            v-model="nuevaCxc.monto"
            min="0"
            step="0.01"
            placeholder="0.00"
            required
          />
        </label>
        <label class="campo-cuenta">
          Moneda
          <select v-model="nuevaCxc.moneda">
            <option v-for="moneda in MONEDAS" :key="moneda" :value="moneda">
              {{ SIMBOLOS_MONEDA[moneda] }} {{ moneda }}
            </option>
          </select>
        </label>
      </div>

      <label class="campo-cuenta">
        Fecha
        <input type="date" v-model="nuevaCxc.fecha" required />
      </label>

      <!--
        Solo tiene sentido elegir "de dónde sale la plata" si en
        verdad va a salir de algún lado — por eso este campo
        únicamente aparece para préstamos.
      -->
      <label v-if="nuevaCxc.tipo === 'prestamo'" class="campo-cuenta">
        ¿De qué cuenta sale la plata?
        <select v-model="nuevaCxc.cuentaOrigenId" required>
          <option v-for="c in cuentas" :key="c.id" :value="c.id">
            {{ c.nombre }} ({{ c.moneda }}) · {{ formatearMonto(c.saldo, c.moneda) }}
          </option>
        </select>
      </label>

      <p v-if="mensajeNueva" class="mensaje-aviso">{{ mensajeNueva }}</p>

      <div class="acciones-cuenta">
        <button type="button" class="cancelar-cuenta" @click="mostrarFormNueva = false">Cancelar</button>
        <button type="submit" class="guardar-cuenta">Guardar</button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.por-cobrar h2 {
  margin: 0 0 6px;
}

.ayuda {
  margin: 0 0 16px;
  font-size: 0.85rem;
  color: var(--muted);
}

.resumen-cobrar {
  background: var(--surface);
  border-radius: var(--radius);
  padding: 16px;
  margin-bottom: 18px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  border-top: 4px solid var(--income);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.resumen-cobrar .etiqueta {
  font-size: 0.8rem;
  color: var(--muted);
}

.resumen-cobrar .monto {
  font-size: 1.4rem;
  font-weight: 600;
  color: var(--text);
  margin: 0;
}

.vacio {
  color: var(--muted);
  font-size: 0.9rem;
  text-align: center;
  margin: 24px 0;
}

.lista-cxc {
  list-style: none;
  margin: 0 0 16px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cxc {
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  overflow: hidden;
}

.fila-cxc {
  padding: 12px 14px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}

.info-cxc {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.persona {
  font-weight: 500;
}

.concepto {
  font-size: 0.78rem;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.montos-cxc {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  white-space: nowrap;
}

.pendiente {
  font-weight: 600;
  color: var(--income);
}

.pendiente.pagado {
  color: var(--asset);
  font-size: 0.82rem;
}

.original {
  font-size: 0.72rem;
  color: var(--muted);
}

.detalle-cxc {
  padding: 0 14px 16px;
  border-top: 1px solid var(--border);
}

.dato {
  margin: 12px 0 0;
  font-size: 0.85rem;
  color: var(--muted);
}

.dato strong {
  color: var(--text);
  font-weight: 500;
}

.detalle-cxc h4 {
  margin: 16px 0 8px;
  font-size: 0.85rem;
  color: var(--text);
}

.abonos {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.82rem;
}

.abonos li {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--muted);
}

.ganancia-tag {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--income);
  background: #eaf1fa;
  border-radius: 999px;
  padding: 2px 8px;
}

.saldado {
  margin: 14px 0 0;
  font-size: 0.85rem;
  color: var(--asset);
}

.form-abono {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.boton-nueva-cuenta {
  margin-top: 4px;
  padding: 12px;
  width: 100%;
  border: 1px dashed var(--border);
  border-radius: var(--radius);
  background: transparent;
  color: var(--muted);
  font-size: 0.9rem;
  cursor: pointer;
}

.boton-nueva-cuenta:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.form-cuenta {
  margin-top: 4px;
  background: var(--surface);
  border-radius: var(--radius);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.campo-cuenta {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.85rem;
  color: var(--muted);
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

.opcional {
  font-weight: 400;
  font-size: 0.74rem;
}

.tipo-cxc {
  display: flex;
  gap: 16px;
  font-size: 0.85rem;
  color: var(--text);
}

.tipo-cxc label {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.ayuda-campo {
  margin: -2px 0 0;
  font-size: 0.74rem;
  color: var(--muted);
}

.fila-campos {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.acciones-cuenta {
  display: flex;
  gap: 8px;
}

.acciones-cuenta button {
  flex: 1;
  padding: 10px;
  border-radius: var(--radius);
  font-size: 0.85rem;
  cursor: pointer;
  border: 1px solid var(--border);
}

.cancelar-cuenta {
  background: transparent;
  color: var(--muted);
}

.guardar-cuenta {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}

.guardar-cuenta:hover {
  background: var(--accent-dark);
}

.mensaje-aviso {
  margin: 0;
  font-size: 0.82rem;
  color: var(--expense);
}
</style>
