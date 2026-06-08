<script setup>
import { reactive, computed, ref } from 'vue'
import {
  useFinanzas,
  CATEGORIAS_INGRESO,
  CATEGORIAS_GASTO,
  SIMBOLOS_MONEDA,
  formatearMonto,
} from '../composables/useFinanzas'

const { cuentas, agregarMovimiento, fondos, monedaReferencia, convertir, usarFondo } = useFinanzas()

// Fondo opcional que el usuario elige para vincular el gasto
const fondoSeleccionadoId = ref(null)

// Solo mostramos fondos con saldo > 0 en el selector
const fondosConSaldo = computed(() => fondos.value.filter((f) => f.saldo > 0.001))

// reactive() es como ref(), pero pensado para AGRUPAR varios campos
// relacionados en un solo objeto. La diferencia práctica: con reactive
// accedés directo a "form.monto" (sin ".value"), tanto en el script
// como en el template. Se usa mucho para representar formularios.
const form = reactive({
  tipo: 'gasto',
  fecha: new Date().toISOString().slice(0, 10), // hoy, en formato AAAA-MM-DD
  categoria: '',
  monto: null,
  cuentaId: cuentas.value[0]?.id ?? null,
  nota: '', // texto libre y opcional: detalle que luego se ve en el historial
})

const mensaje = ref('')

// Cuando un gasto dejaría una cuenta en negativo, no lo guardamos
// directo: guardamos acá los datos "en pausa" junto con el texto de
// aviso, y el template muestra una tarjeta para confirmar o cancelar.
// null = no hay ninguna advertencia pendiente.
const advertencia = ref(null)

// computed: la lista de categorías a mostrar depende de si el
// movimiento es un ingreso o un gasto. Se recalcula sola cada vez
// que el usuario cambia "form.tipo".
const categoriasDisponibles = computed(() =>
  form.tipo === 'ingreso' ? CATEGORIAS_INGRESO : CATEGORIAS_GASTO
)

// La cuenta que el usuario eligió en "Cuenta afectada". La necesitamos
// para dos cosas: mostrar en qué moneda se va a registrar el monto
// (el campo "Monto" no tiene su propio selector de moneda — toma
// automáticamente la de la cuenta) y para armar el aviso de saldo
// negativo con el símbolo correcto ($ o Bs).
const cuentaSeleccionada = computed(() =>
  cuentas.value.find((c) => c.id === Number(form.cuentaId)) ?? null
)

function manejarEnvio() {
  if (!form.categoria || !form.monto || !form.cuentaId) {
    mensaje.value = 'Completá categoría, monto y cuenta antes de guardar.'
    return
  }

  const datos = {
    fecha: form.fecha,
    tipo: form.tipo,
    categoria: form.categoria,
    monto: Number(form.monto),
    cuentaId: Number(form.cuentaId),
    nota: form.nota.trim(),
  }

  const cuenta = cuentas.value.find((c) => c.id === datos.cuentaId)
  const saldoResultante = cuenta.saldo + (datos.tipo === 'ingreso' ? datos.monto : -datos.monto)

  // Una cuenta de ACTIVO (efectivo, banco, etc.) representa plata real:
  // no debería poder "gastarse" más de lo que tiene. Si eso pasara, lo
  // más probable es que sea un error de tipeo (monto o cuenta
  // equivocada) — así que avisamos y pedimos confirmar a propósito,
  // en vez de guardarlo en silencio y descuadrar tus cuentas.
  if (cuenta.tipo === 'activo' && saldoResultante < 0) {
    advertencia.value = {
      datos,
      texto: `"${cuenta.nombre}" quedaría en ${formatearMonto(saldoResultante, cuenta.moneda)}. ¿Registrar el movimiento igual?`,
    }
    return
  }

  guardar(datos)
}

function confirmarAdvertencia() {
  guardar(advertencia.value.datos)
}

function cancelarAdvertencia() {
  advertencia.value = null
  mensaje.value = 'Movimiento cancelado — revisá el monto o la cuenta.'
}

function guardar(datos) {
  agregarMovimiento(datos)

  // Si el usuario vinculó el gasto a un fondo, descontamos de él.
  if (datos.tipo === 'gasto' && fondoSeleccionadoId.value) {
    const cuenta = cuentas.value.find((c) => c.id === datos.cuentaId)
    if (cuenta) {
      const enRef = convertir(datos.monto, cuenta.moneda, monedaReferencia.value, datos.fecha) ?? datos.monto
      usarFondo(Number(fondoSeleccionadoId.value), enRef)
    }
  }

  advertencia.value = null
  mensaje.value = '✓ Movimiento guardado.'
  form.categoria = ''
  form.monto = null
  form.nota = ''
  fondoSeleccionadoId.value = null
}
</script>

<template>
  <form class="formulario" @submit.prevent="manejarEnvio">
    <!--
      @submit.prevent: escucha el evento "submit" del formulario y
      ".prevent" evita que la página se recargue (el comportamiento
      por defecto del navegador al enviar un <form>).
    -->
    <h2>Registrar movimiento</h2>
    <p class="ayuda">Cuatro datos, como en el plan: fecha · monto · categoría · cuenta.</p>

    <!--
      v-model crea un "enlace de doble vía": el valor del input se
      copia a form.tipo, y si form.tipo cambia desde el código, el
      input también se actualiza. Es la forma estándar de conectar
      formularios con datos en Vue.
    -->
    <div class="segmentado">
      <label :class="{ activo: form.tipo === 'gasto' }">
        <input type="radio" value="gasto" v-model="form.tipo" />
        Gasto
      </label>
      <label :class="{ activo: form.tipo === 'ingreso' }">
        <input type="radio" value="ingreso" v-model="form.tipo" />
        Ingreso
      </label>
    </div>

    <label class="campo">
      Fecha
      <input type="date" v-model="form.fecha" required />
    </label>

    <label class="campo">
      Categoría
      <select v-model="form.categoria" required>
        <option value="" disabled>Elegí una categoría</option>
        <option v-for="cat in categoriasDisponibles" :key="cat" :value="cat">{{ cat }}</option>
      </select>
    </label>

    <label class="campo">
      Cuenta afectada
      <select v-model="form.cuentaId" required>
        <option v-for="cuenta in cuentas" :key="cuenta.id" :value="cuenta.id">
          {{ cuenta.nombre }} ({{ cuenta.moneda }})
        </option>
      </select>
    </label>

    <label class="campo">
      <!--
        El monto siempre queda en la moneda de la cuenta elegida — no
        hay forma de "mezclar" monedas en un mismo movimiento. Por eso
        mostramos acá el símbolo de esa cuenta: así la persona sabe, al
        tipear, si está anotando dólares o bolívares.
      -->
      Monto <span v-if="cuentaSeleccionada" class="simbolo-moneda">en {{ SIMBOLOS_MONEDA[cuentaSeleccionada.moneda] }} ({{ cuentaSeleccionada.moneda }})</span>
      <input type="number" v-model="form.monto" min="0" step="0.01" placeholder="0.00" required />
    </label>

    <label class="campo">
      <!--
        Es un campo de texto libre y OPCIONAL (por eso no lleva
        "required"): un lugar para anotar detalles que el monto y la
        categoría no cuentan por sí solos ("Compré arroz y harina",
        "Pago de la mitad del alquiler"...). v-model en un <textarea>
        funciona igual que en un <input> — Vue mantiene el texto
        sincronizado con "form.nota" en ambas direcciones. Esta nota
        después se ve en el detalle del movimiento, en "Movimientos".
      -->
      Nota <span class="opcional">(opcional)</span>
      <textarea
        v-model="form.nota"
        rows="2"
        placeholder="Ej: Compré ingredientes para la semana..."
      ></textarea>
    </label>

    <!--
      Mientras hay una advertencia pendiente, escondemos el botón de
      guardar (v-if="!advertencia") y mostramos en su lugar la tarjeta
      de confirmación. Así obligamos a una decisión explícita: "Guardar
      igual" o "Revisar" — nunca se guarda en silencio.
    -->
    <!-- Panel de fondos: solo aparece en gastos y si hay fondos configurados -->
    <div v-if="form.tipo === 'gasto' && fondos.length > 0" class="panel-fondos">
      <p class="panel-fondos-titulo">Fondos disponibles</p>
      <ul class="fondos-lista">
        <li v-for="f in fondos" :key="f.id" class="fondo-item">
          <span class="fondo-punto" :style="{ background: f.color }"></span>
          <span class="fondo-label">{{ f.nombre }}</span>
          <span class="fondo-disponible" :class="f.saldo < 0.01 ? 'sin-saldo' : ''">
            {{ formatearMonto(f.saldo, monedaReferencia) }}
          </span>
        </li>
      </ul>
      <label class="campo campo-fondo" v-if="fondosConSaldo.length > 0">
        Descontar de un fondo <span class="opcional">(opcional)</span>
        <select v-model="fondoSeleccionadoId">
          <option :value="null">— No descontar de ningún fondo</option>
          <option v-for="f in fondosConSaldo" :key="f.id" :value="f.id">
            {{ f.nombre }} · {{ formatearMonto(f.saldo, monedaReferencia) }} disponible
          </option>
        </select>
      </label>
    </div>

    <button v-if="!advertencia" type="submit" class="guardar">Guardar movimiento</button>

    <div v-else class="advertencia">
      <p class="advertencia-texto">⚠ {{ advertencia.texto }}</p>
      <div class="advertencia-acciones">
        <button type="button" class="revisar" @click="cancelarAdvertencia">Revisar</button>
        <button type="button" class="confirmar" @click="confirmarAdvertencia">Guardar igual</button>
      </div>
    </div>

    <p v-if="mensaje" class="mensaje">{{ mensaje }}</p>
  </form>
</template>

<style scoped>
.formulario {
  background: var(--surface);
  border-radius: var(--radius);
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.ayuda {
  margin: -8px 0 0;
  color: var(--muted);
  font-size: 0.85rem;
}

.segmentado {
  display: flex;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}

.segmentado label {
  flex: 1;
  text-align: center;
  padding: 10px;
  cursor: pointer;
  color: var(--muted);
  font-size: 0.9rem;
}

.segmentado label.activo {
  background: var(--accent);
  color: #fff;
}

.segmentado input {
  display: none;
}

.campo {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.85rem;
  color: var(--muted);
}

.simbolo-moneda {
  font-weight: 400;
  font-size: 0.78rem;
  color: var(--accent);
}

.opcional {
  font-weight: 400;
  font-size: 0.78rem;
  color: var(--muted);
}

.campo input,
.campo select,
.campo textarea {
  padding: 10px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  font-size: 1rem;
  color: var(--text);
  background: var(--bg);
}

.campo textarea {
  resize: vertical;
  font-family: inherit;
}

.guardar {
  padding: 12px;
  border: none;
  border-radius: var(--radius);
  background: var(--accent);
  color: #fff;
  font-size: 1rem;
  cursor: pointer;
}

.guardar:hover {
  background: var(--accent-dark);
}

.advertencia {
  border: 1px solid var(--liability);
  background: var(--peligro-bg);
  border-radius: var(--radius);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.advertencia-texto {
  margin: 0;
  font-size: 0.88rem;
  color: var(--liability);
}

.advertencia-acciones {
  display: flex;
  gap: 8px;
}

.advertencia-acciones button {
  flex: 1;
  padding: 10px;
  border-radius: var(--radius);
  font-size: 0.85rem;
  cursor: pointer;
  border: 1px solid var(--liability);
}

.revisar {
  background: transparent;
  color: var(--liability);
}

.confirmar {
  background: var(--liability);
  color: #fff;
}

.mensaje {
  margin: 0;
  text-align: center;
  font-size: 0.9rem;
  color: var(--accent);
}

/* ── Panel de fondos ── */
.panel-fondos {
  background: var(--bg);
  border-radius: var(--radius);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.panel-fondos-titulo {
  margin: 0;
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
}

.fondos-lista {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.fondo-item {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 0.85rem;
}

.fondo-punto {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.fondo-label {
  flex: 1;
  color: var(--text);
}

.fondo-disponible {
  font-weight: 600;
  color: var(--income);
  font-variant-numeric: tabular-nums;
}

.fondo-disponible.sin-saldo {
  color: var(--muted);
  font-weight: 400;
}

.campo-fondo select {
  width: 100%;
}
</style>
