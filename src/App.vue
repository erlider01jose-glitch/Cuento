<script setup>
// "<script setup>" es la forma moderna y resumida de escribir la lógica
// de un componente Vue: todo lo que declares acá (variables, funciones,
// componentes importados) queda disponible automáticamente en el <template>
// de abajo, sin tener que "exportarlo" a mano.

import { ref, computed, watch, onMounted } from 'vue'
import ResumenView from './views/ResumenView.vue'
import MovimientoForm from './views/MovimientoForm.vue'
import MovimientosList from './views/MovimientosList.vue'
import ConfiguracionView from './views/ConfiguracionView.vue'
import CuentasPorCobrarView from './views/CuentasPorCobrarView.vue'
import EstadisticasView from './views/EstadisticasView.vue'
import AsistenteInicial from './components/AsistenteInicial.vue'
import { useFinanzas } from './composables/useFinanzas'

// ref() crea una variable "reactiva": cuando su valor cambia, Vue
// actualiza solo automáticamente las partes del template que la usan
// (no hace falta volver a "dibujar" la pantalla a mano).
// Para leer/escribir su valor en JS se usa ".value"; en el template
// se usa directo "vistaActual" (Vue se encarga de "desenvolverla").
const vistaActual = ref('resumen')

const { cuentas, movimientos, autoActualizarSiCorresponde } = useFinanzas()

// Al montar la app: si el usuario tiene activada la actualización automática
// de tasas y ya pasó el intervalo configurado, trae la tasa desde la API.
onMounted(autoActualizarSiCorresponde)

// "En blanco" = la persona todavía no hizo nada más allá de lo que
// la app trae de fábrica (las dos cuentas "Efectivo" y ningún
// movimiento). Es justo la señal para ofrecerle el asistente de
// bienvenida — no tendría sentido mostrárselo a alguien que ya
// está usando la app activamente.
const appEnBlanco = computed(
  () => movimientos.value.length === 0 && cuentas.value.every((c) => c.nombre === 'Efectivo')
)

// OJO con un detalle importante: NO podemos basar "se muestra o no" en
// "appEnBlanco" de forma directa. ¿Por qué? Porque el asistente, en su
// propio paso 2, hace que la persona agregue billeteras — ¡y en el
// instante en que agrega la primera, "appEnBlanco" pasa a ser false!
// Si la visibilidad dependiera de eso, la ventana se cerraría sola a
// mitad de camino, justo cuando más sentido tiene seguir mostrándola.
//
// Por eso usamos un ref propio que arranca en el valor inicial de
// "appEnBlanco" (se abre solo si la app empieza en blanco) y después
// vive su propia vida: solo se cierra cuando la persona lo cierra
// (botón "✕" o "Saltar"), y solo se vuelve a abrir cuando la app
// TRANSICIONA de "no en blanco" a "en blanco" — el caso de "Restaurar
// valores de fábrica", que es justo lo que el usuario esperaba ver.
const mostrarAsistente = ref(appEnBlanco.value)

watch(appEnBlanco, (ahora, antes) => {
  if (ahora && !antes) mostrarAsistente.value = true
})

function cerrarAsistente() {
  mostrarAsistente.value = false
  // Al terminar (o saltar) el asistente, lo más natural es aterrizar
  // en "Resumen": ahí es donde la persona ve reflejado todo lo que
  // acaba de cargar (perfil, billeteras, tasa).
  vistaActual.value = 'resumen'
}

const pestañas = [
  { id: 'resumen', etiqueta: 'Resumen' },
  { id: 'nuevo', etiqueta: 'Nuevo' },
  { id: 'movimientos', etiqueta: 'Movimientos' },
  { id: 'estadisticas', etiqueta: 'Estadísticas' },
]
</script>

<template>
  <div class="app">
    <header class="app-header">
      <!--
        El espaciador a la izquierda es "invisible" (mismo ancho que el
        botón de la derecha): así el título queda centrado de verdad,
        en vez de recorrerse hacia la izquierda para compensar el botón.
        Es un truco común en layouts con un solo ícono a un costado.
      -->
      <span class="espaciador"></span>
      <h1>Mis Finanzas</h1>
      <button
        class="boton-config"
        :class="{ activo: vistaActual === 'configuracion' }"
        title="Configuración"
        @click="vistaActual = 'configuracion'"
      >
        ⚙
      </button>
    </header>

    <!--
      v-for: repite este elemento por cada ítem del arreglo "pestañas"
        (similar a un .map en JS, pero declarado en el HTML).
      :key: identificador único que Vue necesita para saber qué elemento
        es cuál cuando la lista cambia (buena práctica siempre que uses v-for).
      :class: enlaza una clase CSS de forma dinámica — agrega "activa"
        solo cuando esta pestaña es la vistaActual.
      @click: escucha el evento "click" (forma corta de v-on:click) y,
        al tocar la pestaña, cambia el valor de vistaActual.
    -->
    <nav class="tabs">
      <button
        v-for="pestaña in pestañas"
        :key="pestaña.id"
        :class="['tab', { activa: vistaActual === pestaña.id }]"
        @click="vistaActual = pestaña.id"
      >
        {{ pestaña.etiqueta }}
      </button>
    </nav>

    <main class="contenido">
      <!--
        v-if / v-else-if: renderizado condicional — Vue muestra solo
        el bloque cuya condición es verdadera. Es la forma de "cambiar
        de pantalla" sin necesitar un sistema de rutas todavía.
      -->
      <ResumenView v-if="vistaActual === 'resumen'" @ir-a-por-cobrar="vistaActual = 'porcobrar'" />
      <MovimientoForm v-else-if="vistaActual === 'nuevo'" />
      <MovimientosList v-else-if="vistaActual === 'movimientos'" />
      <ConfiguracionView v-else-if="vistaActual === 'configuracion'" />
      <CuentasPorCobrarView v-else-if="vistaActual === 'porcobrar'" />
      <EstadisticasView v-else-if="vistaActual === 'estadisticas'" />
    </main>
  </div>

  <!--
    Vue 3 permite que un componente tenga más de una "raíz" en su
    template (antes había que envolver todo en un único <div>). Por
    eso este modal puede vivir afuera de ".app": queda flotando por
    encima de todo gracias a "position: fixed" en su propio CSS,
    sin importar en qué pestaña estés parado.
  -->
  <AsistenteInicial v-if="mostrarAsistente" @cerrar="cerrarAsistente" />
</template>

<style scoped>
/*
  "scoped" hace que estos estilos apliquen SOLO a este componente
  (Vue les agrega un atributo único por debajo). Así evitamos que
  los estilos de un componente "se filtren" y rompan otro.
*/
.app {
  max-width: 480px;
  margin: 0 auto;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg);
}

.app-header {
  padding: 20px 16px 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.app-header h1 {
  margin: 0;
  font-size: 1.4rem;
  color: var(--accent);
  text-align: center;
}

.espaciador,
.boton-config {
  flex: 0 0 36px;
  height: 36px;
}

.boton-config {
  border: none;
  border-radius: 999px;
  background: var(--surface);
  color: var(--muted);
  font-size: 1.1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease, color 0.15s ease;
}

.boton-config:hover,
.boton-config.activo {
  background: var(--accent);
  color: #fff;
}

.tabs {
  display: flex;
  gap: 4px;
  padding: 8px;
  position: sticky;
  top: 0;
  background: var(--bg);
  z-index: 5;
}

.tab {
  flex: 1;
  padding: 10px 8px;
  border: none;
  border-radius: 10px;
  background: var(--surface);
  color: var(--muted);
  font-size: 0.85rem;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.tab.activa {
  background: var(--accent);
  color: #fff;
}

.contenido {
  flex: 1;
  padding: 8px 16px 32px;
}
</style>
