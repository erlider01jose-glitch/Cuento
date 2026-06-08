<script setup>
import { reactive, ref, computed } from 'vue'
import {
  useFinanzas,
  MONEDAS,
  SIMBOLOS_MONEDA,
  formatearMonto,
  BANCOS_VENEZUELA,
  EXCHANGES_Y_BILLETERAS_DIGITALES,
} from '../composables/useFinanzas'

const {
  cuentas,
  movimientos,
  totalActivos,
  totalPasivos,
  totalPorCobrar,
  patrimonioNeto,
  monedaReferencia,
  monedasEnUso,
  faltaTasa,
  cambiarMonedaReferencia,
  agregarCuenta,
} = useFinanzas()

// ResumenView no tiene su propio "router" — la pantalla la elige
// App.vue a través de "vistaActual". Por eso, para llevar a la
// persona a la vista de "Cuentas por cobrar" al tocar esa tarjeta,
// emitimos un evento hacia arriba (mismo patrón que "cerrar" en
// AsistenteInicial) y App.vue decide qué hacer con él.
const emit = defineEmits(['ir-a-por-cobrar'])

// Separamos las cuentas en dos grupos: "Efectivo" (las que la app trae
// de fábrica, siempre presentes) y "Billeteras" (todo lo que la
// persona agregó ella misma — bancos, exchanges, tarjetas...).
// Identificamos "Efectivo" por su nombre exacto: es el único nombre
// que la propia app asigna; cualquier otro lo eligió la persona.
const cuentasEfectivo = computed(() => cuentas.value.filter((c) => c.nombre === 'Efectivo'))
const billeteras = computed(() => cuentas.value.filter((c) => c.nombre !== 'Efectivo'))

// Para mostrar primero las billeteras "más activas", buscamos el
// momento del último movimiento de cada cuenta (objeto { cuentaId:
// timestamp }). Las que nunca tuvieron movimientos no entran acá, y al
// ordenar caen al final (su "última actividad" vale 0).
const ultimaActividadPorCuenta = computed(() => {
  const ultimas = {}
  for (const mov of movimientos.value) {
    if (!ultimas[mov.cuentaId] || mov.creadoEn > ultimas[mov.cuentaId]) {
      ultimas[mov.cuentaId] = mov.creadoEn
    }
  }
  return ultimas
})

const billeterasOrdenadas = computed(() =>
  [...billeteras.value].sort((a, b) => {
    const actividadA = ultimaActividadPorCuenta.value[a.id] ?? 0
    const actividadB = ultimaActividadPorCuenta.value[b.id] ?? 0
    return actividadB - actividadA
  })
)

// Para no abrumar con una lista larga, mostramos solo las 3 billeteras
// con movimientos más recientes — con un botón "Ver más" que despliega
// el resto (y solo aparece si en verdad hay más de 3).
const LIMITE_BILLETERAS = 3
const mostrarTodasLasBilleteras = ref(false)

const billeterasVisibles = computed(() =>
  mostrarTodasLasBilleteras.value
    ? billeterasOrdenadas.value
    : billeterasOrdenadas.value.slice(0, LIMITE_BILLETERAS)
)

// "mostrarFormCuenta" controla si el formulario de "Nueva cuenta" está
// abierto o escondido detrás del botón "+ Nueva cuenta". Es un patrón
// muy común en Vue: un ref booleano que un botón prende/apaga con
// @click, y el template usa con v-if para mostrar u ocultar algo.
const mostrarFormCuenta = ref(false)
const nuevaCuenta = reactive({ nombre: '', tipo: 'activo', moneda: 'USD' })

function guardarCuenta() {
  if (!nuevaCuenta.nombre.trim()) return
  agregarCuenta({ ...nuevaCuenta, nombre: nuevaCuenta.nombre.trim() })
  nuevaCuenta.nombre = ''
  nuevaCuenta.tipo = 'activo'
  nuevaCuenta.moneda = 'USD'
  mostrarFormCuenta.value = false
}

// El interruptor de la tarjeta de Patrimonio neto solo conoce dos
// estados (USD/VES), así que alternar es más simple que "elegir de
// una lista": si está en uno, pasa al otro.
function alternarMonedaReferencia() {
  cambiarMonedaReferencia(monedaReferencia.value === 'USD' ? 'VES' : 'USD')
}
</script>

<template>
  <div class="resumen">
    <p v-if="faltaTasa" class="aviso">
      ⚠ Tenés cuentas en distintas monedas pero todavía no cargaste una tasa de cambio — anda a
      <strong>Configuración (⚙)</strong> para cargarla; mientras tanto los totales de abajo no
      van a incluir todas tus cuentas.
    </p>

    <section class="patrimonio">
      <!--
        Este interruptor solo tiene sentido si hay cuentas en ambas
        monedas (si no, no hay nada que "combinar" ni que elegir).
        Es un botón con dos textos fijos ($ y Bs) y un fondo que se
        desliza de un lado al otro con una transición CSS — alternar
        el estado alcanza con cambiar una clase; la animación la hace
        el navegador solo.
      -->
      <button
        v-if="monedasEnUso.length > 1"
        class="interruptor-moneda"
        :title="`Mostrar totales en ${monedaReferencia === 'USD' ? 'bolívares' : 'dólares'}`"
        @click="alternarMonedaReferencia"
      >
        <span class="interruptor-resaltado" :class="{ izquierda: monedaReferencia === 'VES' }"></span>
        <span class="interruptor-texto" :class="{ activa: monedaReferencia === 'VES' }">Bs</span>
        <span class="interruptor-texto" :class="{ activa: monedaReferencia === 'USD' }">$</span>
      </button>

      <p class="etiqueta">Patrimonio neto</p>
      <p class="monto" :class="{ negativo: patrimonioNeto < 0 }">
        {{ formatearMonto(patrimonioNeto, monedaReferencia) }}
      </p>
      <p class="formula">Activos − Pasivos = lo que es realmente tuyo</p>
    </section>

    <div class="totales">
      <div class="total total-activo">
        <span class="etiqueta">Activos</span>
        <span class="monto">{{ formatearMonto(totalActivos, monedaReferencia) }}</span>
      </div>
      <div class="total total-pasivo">
        <span class="etiqueta">Pasivos</span>
        <span class="monto">{{ formatearMonto(totalPasivos, monedaReferencia) }}</span>
      </div>
      <!--
        A diferencia de Activos/Pasivos (que solo informan), esta
        tarjeta también es un "atajo": tocarla te lleva a la vista
        donde podés cargar y cobrar lo que te deben. Por eso es un
        <button> en vez de un <div> — semánticamente, es una acción.
      -->
      <button class="total total-cobrar" @click="emit('ir-a-por-cobrar')">
        <span class="etiqueta">C. Cobrar</span>
        <span class="monto">{{ formatearMonto(totalPorCobrar, monedaReferencia) }}</span>
      </button>
    </div>

    <h2>Efectivo</h2>
    <ul class="cuentas">
      <li v-for="cuenta in cuentasEfectivo" :key="cuenta.id" class="cuenta">
        <span class="nombre">{{ cuenta.nombre }}</span>
        <span class="moneda-tag">{{ cuenta.moneda }}</span>
        <span class="tipo" :class="cuenta.tipo">{{ cuenta.tipo === 'activo' ? 'Activo' : 'Pasivo' }}</span>
        <span class="saldo">{{ formatearMonto(cuenta.saldo, cuenta.moneda) }}</span>
      </li>
    </ul>

    <!--
      La sección "Billeteras" solo aparece si la persona registró
      alguna — no tiene sentido mostrar un título vacío para algo que
      todavía no existe (ver datosDeFabrica: la app nunca crea una
      billetera sola, eso lo hace la persona a propósito).
    -->
    <template v-if="billeteras.length > 0">
      <h2 class="titulo-grupo">Billeteras</h2>
      <ul class="cuentas">
        <li v-for="cuenta in billeterasVisibles" :key="cuenta.id" class="cuenta">
          <span class="nombre">{{ cuenta.nombre }}</span>
          <span class="moneda-tag">{{ cuenta.moneda }}</span>
          <span class="tipo" :class="cuenta.tipo">{{ cuenta.tipo === 'activo' ? 'Activo' : 'Pasivo' }}</span>
          <span class="saldo">{{ formatearMonto(cuenta.saldo, cuenta.moneda) }}</span>
        </li>
      </ul>

      <!--
        El botón solo se muestra si en verdad hay más de
        LIMITE_BILLETERAS — mostrarlo con una sola billetera de más
        sería molesto. Alterna entre mostrar todas y volver a
        achicar la lista.
      -->
      <button
        v-if="billeteras.length > LIMITE_BILLETERAS"
        class="ver-mas"
        @click="mostrarTodasLasBilleteras = !mostrarTodasLasBilleteras"
      >
        {{
          mostrarTodasLasBilleteras
            ? 'Ver menos'
            : `Ver ${billeteras.length - LIMITE_BILLETERAS} más`
        }}
      </button>
    </template>

    <!--
      Botón que alterna (toggle) la visibilidad del formulario: cada
      click invierte el booleano. v-if/v-else deciden cuál de los dos
      bloques se muestra — nunca los dos a la vez.
    -->
    <button v-if="!mostrarFormCuenta" class="boton-nueva-cuenta" @click="mostrarFormCuenta = true">
      + Nueva cuenta
    </button>

    <form v-else class="form-cuenta" @submit.prevent="guardarCuenta">
      <label class="campo-cuenta">
        Billetera
        <!--
          "list" conecta este input con el <datalist> de abajo: el
          navegador muestra las opciones como sugerencias que se van
          filtrando solas a medida que escribís (búsqueda incluida,
          sin necesitar un botón aparte). "label" es lo que se ve en
          la sugerencia (con el ícono de categoría); "value" es lo que
          realmente se copia al input al elegirla. Si lo que buscás no
          está en la lista, podés escribir cualquier nombre — el campo
          sigue siendo de texto libre.
        -->
        <span class="campo-con-icono">
          <span class="icono-buscar">🔍</span>
          <input
            v-model="nuevaCuenta.nombre"
            type="text"
            list="instituciones-sugeridas"
            placeholder="Buscá tu banco o exchange, o escribí un nombre"
            required
          />
        </span>
        <datalist id="instituciones-sugeridas">
          <option v-for="b in BANCOS_VENEZUELA" :key="b" :value="b" :label="`🏦 ${b} · Banco`" />
          <option
            v-for="d in EXCHANGES_Y_BILLETERAS_DIGITALES"
            :key="d"
            :value="d"
            :label="`💱 ${d} · Exchange / billetera digital`"
          />
        </datalist>
        <span class="ayuda-campo">Ej: Banco de Venezuela, Binance, Zinli... o el nombre que prefieras.</span>
      </label>

      <div class="fila-campos">
        <label class="campo-cuenta">
          Tipo
          <select v-model="nuevaCuenta.tipo">
            <option value="activo">Activo</option>
            <option value="pasivo">Pasivo</option>
          </select>
        </label>

        <label class="campo-cuenta">
          Moneda
          <select v-model="nuevaCuenta.moneda">
            <option v-for="moneda in MONEDAS" :key="moneda" :value="moneda">
              {{ SIMBOLOS_MONEDA[moneda] }} {{ moneda }}
            </option>
          </select>
        </label>
      </div>

      <div class="acciones-cuenta">
        <button type="button" class="cancelar-cuenta" @click="mostrarFormCuenta = false">Cancelar</button>
        <button type="submit" class="guardar-cuenta">Guardar cuenta</button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.aviso {
  background: var(--aviso-bg);
  border: 1px solid var(--expense);
  color: var(--expense);
  border-radius: var(--radius);
  padding: 12px 14px;
  font-size: 0.85rem;
  margin-bottom: 16px;
}

.patrimonio {
  position: relative;
  background: var(--surface);
  border-radius: var(--radius);
  padding: 20px;
  text-align: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  margin-bottom: 16px;
}

/*
  El interruptor: un botón ovalado con dos textos fijos ("Bs" a la
  izquierda, "$" a la derecha) y una "píldora" de color que vive
  detrás de uno de los dos. Al cambiar de moneda, le agregamos la
  clase ".izquierda" a la píldora — y como "transition" ya está
  declarado, el navegador anima sola la transformación en vez de
  saltar de golpe. position:absolute la saca del flujo del texto
  para que quede flotando en la esquina superior derecha de la tarjeta.
*/
.interruptor-moneda {
  position: absolute;
  top: 14px;
  right: 14px;
  display: flex;
  width: 58px;
  height: 28px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--bg);
  padding: 0;
  cursor: pointer;
  overflow: hidden;
}

.interruptor-resaltado {
  position: absolute;
  top: 2px;
  bottom: 2px;
  right: 2px;
  width: calc(50% - 2px);
  border-radius: 999px;
  background: var(--accent);
  transition: transform 0.25s ease;
}

.interruptor-resaltado.izquierda {
  transform: translateX(-100%);
}

.interruptor-texto {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--muted);
  transition: color 0.25s ease;
}

.interruptor-texto.activa {
  color: #fff;
}

.etiqueta {
  margin: 0;
  color: var(--muted);
  font-size: 0.85rem;
}

.monto {
  margin: 4px 0;
  font-size: 1.8rem;
  font-weight: 600;
  color: var(--accent);
}

.monto.negativo {
  color: var(--liability);
}

.formula {
  margin: 0;
  font-size: 0.78rem;
  color: var(--muted);
}

.totales {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 24px;
}

.total {
  background: var(--surface);
  border-radius: var(--radius);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  border-top: 4px solid var(--border);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.total-activo { border-top-color: var(--asset); }
.total-pasivo { border-top-color: var(--liability); }

/*
  Esta tarjeta es un <button>, así que además de su color distintivo
  (el mismo azul que ya usan los movimientos de "ingreso") hay que
  resetear los estilos que el navegador le pone por defecto a los
  botones (su propio borde, fuente y alineación) para que se vea
  igual de "tarjeta" que sus vecinas — y ocupe toda la fila, ya que
  por sí sola es más ancha que Activos/Pasivos uno al lado del otro.
*/
.total-cobrar {
  grid-column: 1 / -1;
  border: none;
  border-top: 4px solid var(--income);
  font: inherit;
  text-align: left;
  cursor: pointer;
  width: 100%;
  transition: box-shadow 0.15s ease, transform 0.1s ease;
}

.total-cobrar:hover {
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1);
}

.total-cobrar:active {
  transform: scale(0.99);
}

.total .etiqueta { font-size: 0.8rem; }
.total .monto { font-size: 1.2rem; margin: 0; color: var(--text); }

.cuentas {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cuenta {
  background: var(--surface);
  border-radius: var(--radius);
  padding: 12px 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.cuenta .nombre {
  flex: 1;
  font-weight: 500;
}

.cuenta .moneda-tag {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--muted);
  background: var(--chip-bg);
  border-radius: 999px;
  padding: 2px 7px;
}

.cuenta .tipo {
  font-size: 0.72rem;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--chip-bg);
  color: var(--muted);
}

.cuenta .tipo.activo { color: var(--asset); }
.cuenta .tipo.pasivo { color: var(--liability); }

.cuenta .saldo {
  font-weight: 600;
  white-space: nowrap;
}

.vacio {
  color: var(--muted);
  font-size: 0.9rem;
  text-align: center;
}

.titulo-grupo {
  margin-top: 22px;
}

.ver-mas {
  display: block;
  width: 100%;
  margin-top: 8px;
  padding: 8px;
  border: none;
  background: transparent;
  color: var(--accent);
  font-size: 0.82rem;
  text-decoration: underline;
  cursor: pointer;
}

.ver-mas:hover {
  color: var(--accent-dark);
}

.boton-nueva-cuenta {
  margin-top: 12px;
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
  margin-top: 12px;
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

.ayuda-campo {
  font-size: 0.74rem;
  color: var(--muted);
  font-weight: 400;
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
</style>
