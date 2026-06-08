<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useFinanzas, formatearMonto, DIAS_EN_PAPELERA } from '../composables/useFinanzas'

const {
  cuentas,
  movimientos,
  eliminarMovimiento,
  papelera,
  restaurarDePapelera,
  eliminarDePapeleraDefinitivamente,
  tasaParaFecha,
} = useFinanzas()

// Guarda el "id" del movimiento que está desplegado (o null si ninguno).
// Como solo guardamos UN id, al tocar otro movimiento el anterior se
// cierra solo — es la forma más simple de lograr "uno abierto a la vez".
const movimientoExpandido = ref(null)

function alternarDetalle(id) {
  movimientoExpandido.value = movimientoExpandido.value === id ? null : id
}

// Mismo patrón que "confirmandoReinicio" en Configuración: nunca
// borramos algo de un solo click. Acá guardamos el id del movimiento
// que está pidiendo confirmación (o null si ninguno) — así solo puede
// haber UNA tarjeta de "¿seguro?" abierta a la vez en toda la lista.
const confirmandoBorrado = ref(null)

function cancelarBorrado() {
  confirmandoBorrado.value = null
}

function confirmarBorrado(id) {
  eliminarMovimiento(id)
  confirmandoBorrado.value = null
  // Si estaba expandido, lo cerramos: ya no está en el historial,
  // mostrar su detalle abierto quedaría "colgado" de la nada.
  if (movimientoExpandido.value === id) movimientoExpandido.value = null
}

// Igual que "mostrarFormCuenta" en Resumen: la papelera arranca oculta
// y se despliega al tocar el ícono — no hace falta verla todo el tiempo.
const mostrarPapelera = ref(false)

const papeleraOrdenada = computed(() =>
  [...papelera.value].sort((a, b) => b.eliminadoEl - a.eliminadoEl)
)

// La tasa "de ese día": reutiliza la búsqueda histórica del composable
// (la misma que usa Configuración para "tasa vigente"), pero pidiéndole
// la fecha del movimiento en vez de la de hoy. Así, un gasto de hace
// tres meses muestra la tasa de hace tres meses — no la de hoy.
function tasaDelMomento(mov) {
  return tasaParaFecha(mov.fecha)
}

// "ahora" es un reloj reactivo: lo actualizamos cada segundo, y como
// formatearMomento() lo lee, Vue vuelve a calcular el texto ("hace 8
// min 41 s", etc.) cada vez que cambia — sin que tengamos que tocar
// nada más. Así el tiempo "avanza" solo en pantalla.
const ahora = ref(Date.now())
let temporizador = null

// onMounted / onUnmounted son "hooks de ciclo de vida": código que Vue
// ejecuta cuando el componente aparece en pantalla y cuando desaparece.
// Acá arrancamos el reloj al montar... y MUY IMPORTANTE: lo apagamos al
// desmontar (cuando cambiás de pestaña). Si no lo hiciéramos, el
// temporizador seguiría corriendo en segundo plano para siempre y la
// app iría consumiendo más y más recursos cada vez que volvés a esta vista.
onMounted(() => {
  temporizador = setInterval(() => {
    ahora.value = Date.now()
  }, 1000)
})

onUnmounted(() => {
  clearInterval(temporizador)
})

const DIEZ_MINUTOS_EN_MS = 10 * 60 * 1000

// Decide cómo mostrar el momento de un movimiento:
//  - si pasaron menos de 10 minutos → "hace 8 min 41 s"
//  - si pasó más → la hora exacta, formato "8:56 PM"
// Es una función normal (no "computed") porque necesita un dato
// distinto por cada movimiento de la lista; al leer "ahora.value"
// adentro, igual queda conectada al reloj reactivo de arriba.
function formatearMomento(mov) {
  // Compatibilidad: movimientos guardados antes de agregar "creadoEn"
  // no lo tienen — para esos, usamos la medianoche de su fecha.
  const creadoEn = mov.creadoEn ?? new Date(`${mov.fecha}T00:00:00`).getTime()
  const transcurrido = ahora.value - creadoEn

  if (transcurrido >= 0 && transcurrido < DIEZ_MINUTOS_EN_MS) {
    const segundosTotales = Math.floor(transcurrido / 1000)
    const minutos = Math.floor(segundosTotales / 60)
    const segundos = segundosTotales % 60
    return minutos > 0 ? `hace ${minutos} min ${segundos} s` : `hace ${segundos} s`
  }

  const fecha = new Date(creadoEn)
  const sufijo = fecha.getHours() >= 12 ? 'PM' : 'AM'
  const horas12 = fecha.getHours() % 12 || 12
  const minutosConCero = fecha.getMinutes().toString().padStart(2, '0')
  return `${mov.fecha} · ${horas12}:${minutosConCero} ${sufijo}`
}

const UN_DIA_EN_MS = 24 * 60 * 60 * 1000

// "hace 0/1/2... días" desde que se eliminó. Como lee "ahora.value",
// queda conectada al mismo reloj reactivo de arriba (igual que
// formatearMomento) — no por precisión, sino para que el contador de
// "días restantes" de abajo se actualice solo si dejás la pantalla
// abierta cruzando la medianoche.
function formatearEliminado(item) {
  const dias = Math.floor((ahora.value - item.eliminadoEl) / UN_DIA_EN_MS)
  if (dias <= 0) return 'hoy'
  return dias === 1 ? 'hace 1 día' : `hace ${dias} días`
}

// Cuántos días faltan para que la papelera lo borre solo. Redondeamos
// "para arriba" (Math.ceil): si falta una hora, mejor mostrar "1 día"
// que "0 días" — sería confuso ver "0" y que el ítem siga ahí.
function diasRestantes(item) {
  const limite = item.eliminadoEl + DIAS_EN_PAPELERA * UN_DIA_EN_MS
  const restante = Math.max(0, limite - ahora.value)
  return Math.ceil(restante / UN_DIA_EN_MS)
}

// computed: mostramos los movimientos del más nuevo al más viejo.
// [...movimientos.value] copia el array antes de ordenar, para no
// alterar el original (sort() ordena "in place").
const movimientosOrdenados = computed(() =>
  [...movimientos.value].sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id)
)

function cuenta(cuentaId) {
  return cuentas.value.find((c) => c.id === cuentaId) ?? null
}

function nombreCuenta(cuentaId) {
  return cuenta(cuentaId)?.nombre ?? '—'
}

// El monto de un movimiento está en la moneda de SU cuenta (no se
// convierte nada al guardarlo — ver agregarMovimiento en el
// composable). Por eso, para mostrarlo con el símbolo correcto,
// necesitamos buscar a qué cuenta pertenece ese movimiento.
function formatearMontoMovimiento(mov) {
  const c = cuenta(mov.cuentaId)
  return formatearMonto(mov.monto, c?.moneda ?? 'USD')
}

</script>

<template>
  <div class="movimientos">
    <div class="acciones">
      <!--
        El ícono de papelera abre/cierra la sección de abajo. La
        "insignia" roja con el conteo solo aparece si hay algo adentro
        — como una notificación, para que sea obvio que hay elementos
        esperando ser restaurados (o que se van a borrar solos pronto).
      -->
      <button class="accion papelera-boton" :class="{ activa: mostrarPapelera }" title="Papelera" @click="mostrarPapelera = !mostrarPapelera">
        🗑 Papelera
        <span v-if="papelera.length > 0" class="insignia">{{ papelera.length }}</span>
      </button>
    </div>

    <!--
      Sección plegable: arranca oculta y se abre/cierra con el botón
      "🗑 Papelera" de arriba — igual que "mostrarFormCuenta" en Resumen.
    -->
    <section v-if="mostrarPapelera" class="seccion-papelera">
      <h2>🗑 Papelera</h2>
      <p class="ayuda">
        Lo que borrás queda acá durante {{ DIAS_EN_PAPELERA }} días — podés restaurarlo
        cuando quieras. Pasado ese plazo, se borra solo para siempre.
      </p>

      <ul v-if="papeleraOrdenada.length > 0" class="lista">
        <li v-for="item in papeleraOrdenada" :key="item.id" class="item papelera-item" :class="item.tipo">
          <div class="fila sin-click">
            <div class="info">
              <span class="categoria">{{ item.categoria }}</span>
              <span class="detalle">
                Eliminado {{ formatearEliminado(item) }} · {{ nombreCuenta(item.cuentaId) }}
                · se borra para siempre en {{ diasRestantes(item) }}
                {{ diasRestantes(item) === 1 ? 'día' : 'días' }}
              </span>
            </div>
            <span class="monto">{{ item.tipo === 'ingreso' ? '+' : '-' }}{{ formatearMontoMovimiento(item) }}</span>
          </div>
          <div class="papelera-acciones">
            <button type="button" class="restaurar" @click="restaurarDePapelera(item.id)">↩ Restaurar</button>
            <button type="button" class="borrar-definitivo" @click="eliminarDePapeleraDefinitivamente(item.id)">
              Eliminar para siempre
            </button>
          </div>
        </li>
      </ul>
      <p v-else class="vacio">La papelera está vacía.</p>
    </section>

    <h2>Historial</h2>
    <ul class="lista">
      <li v-for="mov in movimientosOrdenados" :key="mov.id" class="item" :class="mov.tipo">
        <!--
          Toda la fila es clickeable y alterna el detalle de ABAJO.
          El botón "✕" usa "@click.stop": ese ".stop" frena la
          propagación del evento para que tocar "borrar" no también
          dispare el "click" de la fila (si no, al borrar se abriría
          o cerraría el detalle al mismo tiempo — confuso).
        -->
        <div class="fila" @click="alternarDetalle(mov.id)">
          <div class="info">
            <span class="categoria">{{ mov.categoria }}</span>
            <span class="detalle">{{ formatearMomento(mov) }} · {{ nombreCuenta(mov.cuentaId) }}</span>
          </div>
          <span class="monto">{{ mov.tipo === 'ingreso' ? '+' : '-' }}{{ formatearMontoMovimiento(mov) }}</span>
          <button class="borrar" title="Eliminar" @click.stop="confirmandoBorrado = mov.id">✕</button>
        </div>

        <!--
          Tarjeta de confirmación — mismo patrón que "Restaurar valores
          de fábrica" en Configuración: nunca destruimos algo de un
          solo click. Es un bloque HERMANO de ".fila" (no un hijo), así
          que tocar sus botones no dispara "alternarDetalle" por
          propagación — no hace falta ".stop".
        -->
        <div v-if="confirmandoBorrado === mov.id" class="confirmacion-borrado">
          <p class="confirmacion-texto">
            ¿Eliminar este movimiento? Quedará en la papelera por {{ DIAS_EN_PAPELERA }} días,
            por si te arrepentís.
          </p>
          <div class="confirmacion-acciones">
            <button type="button" class="cancelar" @click="cancelarBorrado">Cancelar</button>
            <button type="button" class="confirmar-peligro" @click="confirmarBorrado(mov.id)">Sí, eliminar</button>
          </div>
        </div>

        <!--
          El detalle solo aparece para el movimiento "expandido". Acá
          mostramos justo lo que pidió el usuario: la nota (si la
          cargó) y la tasa de cambio que regía el día de esa
          transacción — no la de hoy, que en un país con inflación
          puede ser muy distinta.
        -->
        <div v-if="movimientoExpandido === mov.id" class="expandido">
          <p v-if="mov.nota" class="nota">📝 {{ mov.nota }}</p>
          <p v-else class="nota vacia">Sin nota para este movimiento.</p>

          <p v-if="tasaDelMomento(mov)" class="tasa-momento">
            💱 Tasa de ese día: 1 USD = {{ formatearMonto(tasaDelMomento(mov).valor, 'VES') }}
            <span class="fecha-tasa">· cargada el {{ tasaDelMomento(mov).fecha }}</span>
          </p>
          <p v-else class="tasa-momento vacia">No había una tasa de cambio cargada para esa fecha.</p>
        </div>
      </li>
    </ul>
    <p v-if="movimientosOrdenados.length === 0" class="vacio">
      Todavía no registraste ningún movimiento. Andá a "Nuevo movimiento" para cargar el primero.
    </p>
  </div>
</template>

<style scoped>
.acciones {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.accion {
  flex: 1;
  padding: 10px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-size: 0.85rem;
  cursor: pointer;
}

.accion:hover {
  border-color: var(--accent);
  color: var(--accent);
}

/*
  El botón de la papelera necesita "position: relative" para que la
  insignia (".insignia", con "position: absolute") se ubique relativa
  A ÉL y no a un ancestro lejano — el truco clásico para "anclar" un
  elemento a la esquina de otro.
*/
.papelera-boton {
  position: relative;
  flex: 0 0 auto;
}

.papelera-boton.activa {
  border-color: var(--accent);
  color: var(--accent);
}

.insignia {
  position: absolute;
  top: -6px;
  right: -6px;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 999px;
  background: var(--liability);
  color: #fff;
  font-size: 0.68rem;
  font-weight: 600;
  line-height: 18px;
  text-align: center;
}

.ayuda {
  color: var(--muted);
  font-size: 0.8rem;
  margin: 0 0 20px;
}

.lista {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.item {
  background: var(--surface);
  border-radius: var(--radius);
  padding: 12px 14px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  border-left: 4px solid var(--border);
}

.item.ingreso { border-left-color: var(--income); }
.item.gasto { border-left-color: var(--expense); }

.fila {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}

.expandido {
  margin: 10px 0 0;
  padding-top: 10px;
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.nota,
.tasa-momento {
  margin: 0;
  font-size: 0.82rem;
  color: var(--text);
}

.nota.vacia,
.tasa-momento.vacia {
  color: var(--muted);
  font-style: italic;
}

.fecha-tasa {
  color: var(--muted);
  font-size: 0.74rem;
}

.info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.categoria {
  font-weight: 500;
}

.detalle {
  font-size: 0.78rem;
  color: var(--muted);
}

.monto {
  font-weight: 600;
}

.item.ingreso .monto { color: var(--income); }
.item.gasto .monto { color: var(--expense); }

.borrar {
  border: none;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  font-size: 0.9rem;
  padding: 4px 6px;
}

.borrar:hover {
  color: var(--liability);
}

/* Misma paleta que ".confirmacion" de Configuración: rojo de "peligro" */
.confirmacion-borrado {
  margin: 10px 0 0;
  border: 1px solid var(--liability);
  background: #fbeae6;
  border-radius: var(--radius);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.confirmacion-texto {
  margin: 0;
  font-size: 0.84rem;
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

.confirmacion-acciones .cancelar {
  background: transparent;
  color: var(--liability);
}

.confirmacion-acciones .confirmar-peligro {
  background: var(--liability);
  color: #fff;
}

.seccion-papelera {
  margin-bottom: 24px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
}

.papelera-item .fila.sin-click {
  cursor: default;
}

.papelera-item .monto {
  color: var(--muted);
}

.papelera-acciones {
  margin: 10px 0 0;
  padding-top: 10px;
  border-top: 1px solid var(--border);
  display: flex;
  gap: 8px;
}

.papelera-acciones button {
  flex: 1;
  padding: 8px;
  border-radius: var(--radius);
  font-size: 0.8rem;
  cursor: pointer;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
}

.restaurar:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.borrar-definitivo:hover {
  border-color: var(--liability);
  color: var(--liability);
}

.vacio {
  color: var(--muted);
  font-size: 0.9rem;
  text-align: center;
}
</style>
