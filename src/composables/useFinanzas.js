import { ref, computed, watch } from 'vue'

const CLAVE_ALMACENAMIENTO = 'mis-finanzas-datos'

// Categorías predefinidas, tomadas tal cual del plan (ver plan/PLAN.md)
export const CATEGORIAS_INGRESO = ['Sueldo', 'Ventas', 'Otros']
export const CATEGORIAS_GASTO = [
  'Cuidado personal',
  'Ropa y calzado',
  'Vivienda',
  'Alimentación',
  'Transporte',
  'Salud',
  'Ocio',
  'Insumos / materia prima',
]

// Categorías que la app misma usa para etiquetar movimientos generados
// automáticamente desde "Cuentas por cobrar" (préstamos y cobros). A
// propósito NO van en CATEGORIAS_INGRESO/CATEGORIAS_GASTO de arriba:
// esas alimentan el selector de "Nuevo movimiento" manual, y mostrar
// ahí categorías pensadas para movimientos automáticos confundiría más
// de lo que ayuda. agregarMovimiento() acepta cualquier string como
// categoría — no hace falta que esté en esas listas para funcionar.
const CATEGORIA_PRESTAMO_OTORGADO = 'Préstamo otorgado'
const CATEGORIA_COBRO_TRABAJO = 'Cobro de trabajo'
const CATEGORIA_COBRO_PRESTAMO = 'Cobro de préstamo'
const CATEGORIA_GANANCIA_PRESTAMO = 'Ganancia de préstamo'

// Instituciones sugeridas para el campo "Billetera": así la persona
// no tiene que escribir el nombre completo de su banco de memoria —
// elige de una lista y listo. Lista de bancos tomada de los códigos
// de pago móvil vigentes en Venezuela (https://webunc.com/listado-de-codigos-de-bancos-y-su-abreviacion/).
// Las separamos en dos grupos porque el desplegable los muestra
// agrupados ("Bancos" vs. "Exchanges y billeteras digitales").
export const BANCOS_VENEZUELA = [
  'Banco de Venezuela',
  'Banco Provincial',
  'Banesco',
  'Banco Mercantil',
  'Banco Nacional de Crédito (BNC)',
  'Banco del Tesoro',
  'Banco Activo',
  'Banco Plaza',
  'Bancaribe',
  'Banco Exterior',
  'Banco Occidental de Descuento (BOD)',
  'Banco Caroní',
  'Banco Sofitasa',
  'Banco Venezolano de Crédito',
  'Bancamiga',
  'Banplus',
  'BFC Banco Fondo Común',
  '100% Banco',
  'Mi Banco',
  'Bangente',
  'Banco Bicentenario',
  'Citibank',
]

export const EXCHANGES_Y_BILLETERAS_DIGITALES = [
  'Binance',
  'Zinli',
  'Zelle',
  'PayPal',
  'Reserve',
  'AirTM',
  'Wally',
  'Skrill',
]

// Cuántos días se conserva un movimiento eliminado en la papelera antes
// de borrarse en forma permanente y automática (ver purgarPapelera). La
// exportamos porque la vista la necesita para mostrar "se borra
// definitivamente en X días" en cada elemento.
export const DIAS_EN_PAPELERA = 5

// Monedas soportadas (la app es para Venezuela: conviven dólares y bolívares).
export const MONEDAS = ['USD', 'VES']
export const SIMBOLOS_MONEDA = { USD: '$', VES: 'Bs' }

// Formatea un monto "a la venezolana" (punto de miles, coma decimal) y
// le antepone el símbolo de la moneda ($ o Bs). La exportamos desde acá
// — junto a SIMBOLOS_MONEDA, de la que depende — para que las tres
// vistas que muestran montos (Resumen, formulario y listado) usen
// exactamente el mismo formato sin repetir la función tres veces.
export function formatearMonto(monto, moneda) {
  const simbolo = SIMBOLOS_MONEDA[moneda] ?? ''
  const signo = monto < 0 ? '-' : ''
  const numero = Math.abs(monto).toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${signo}${simbolo} ${numero}`
}

function hoyISO() {
  return new Date().toISOString().slice(0, 10)
}

function cargarDatosIniciales() {
  const guardado = localStorage.getItem(CLAVE_ALMACENAMIENTO)
  if (guardado) {
    try {
      const datos = JSON.parse(guardado)
      // Compatibilidad: datos guardados antes de agregar monedas no
      // tienen "moneda" en sus cuentas — les asignamos USD por defecto
      // para no perder información ni romper la app.
      datos.cuentas?.forEach((c) => {
        if (!c.moneda) c.moneda = 'USD'
      })
      datos.tasas ??= []
      datos.monedaReferencia ??= 'USD'
      datos.perfil ??= { nombre: '', apellido: '', fechaNacimiento: '' }
      datos.cuentasPorCobrar ??= []
      datos.papelera ??= []
      return datos
    } catch {
      // Si el JSON guardado está corrupto, arrancamos de cero en vez de romper la app.
    }
  }
  return datosDeFabrica()
}

// Estado "de fábrica": lo que ve alguien que abre la app por primera
// vez, y también a lo que se vuelve al usar "Restaurar valores de
// fábrica" en Configuración. Vive en su propia función para no repetir
// esta estructura en los dos lugares que la necesitan.
function datosDeFabrica() {
  return {
    // Solo "Efectivo": es lo único universal sin importar dónde vivas
    // o qué bancos uses. Todo lo demás (bancos, exchanges, billeteras
    // digitales...) la persona lo agrega ella misma como "Billetera"
    // — no tiene sentido inventarle una cuenta de un banco que quizás
    // ni usa. Arrancamos con una en cada moneda (USD y VES) porque la
    // app es para Venezuela: es habitual manejar efectivo en ambas.
    cuentas: [
      { id: 1, nombre: 'Efectivo', tipo: 'activo', moneda: 'USD', saldo: 0 },
      { id: 2, nombre: 'Efectivo', tipo: 'activo', moneda: 'VES', saldo: 0 },
    ],
    movimientos: [],
    tasas: [], // historial de tasas de cambio: { fecha, valor, origen }
    monedaReferencia: 'USD', // moneda en la que se muestran los totales combinados
    // Datos personales opcionales que se piden en el asistente de
    // bienvenida. No los usa ningún cálculo — es solo para que la app
    // se sienta "tuya" (por ejemplo, podríamos saludar "Hola, José").
    perfil: { nombre: '', apellido: '', fechaNacimiento: '' },
    // Dinero que te deben: trabajos sin cobrar y préstamos otorgados.
    // Ver agregarCuentaPorCobrar/registrarAbono para la forma exacta
    // de cada elemento — vacío de fábrica, igual que movimientos.
    cuentasPorCobrar: [],
    // Movimientos eliminados recientemente: cada uno guarda sus datos
    // originales tal cual (para poder restaurarlo) más "eliminadoEl"
    // (cuándo se borró). Ver eliminarMovimiento/restaurarDePapelera.
    papelera: [],
  }
}

const datosIniciales = cargarDatosIniciales()

// Quita de la papelera, en silencio, lo que ya lleva más de
// DIAS_EN_PAPELERA días ahí adentro. La llamamos UNA vez al cargar la
// app — alcanza, porque nadie deja la pestaña abierta varios días
// seguidos sin recargarla; y si lo hiciera, se corrige solo la
// próxima vez que abra la app.
function purgarPapelera(lista) {
  const limite = Date.now() - DIAS_EN_PAPELERA * 24 * 60 * 60 * 1000
  return lista.filter((m) => m.eliminadoEl > limite)
}

// OJO: estos ref() están definidos AFUERA de useFinanzas(), a nivel de
// módulo. Por eso, sin importar cuántas veces o desde qué componente se
// llame a useFinanzas(), todos comparten exactamente la MISMA data
// reactiva. Es la forma más simple de tener "estado global" en Vue 3
// sin agregar una librería extra (como Pinia) — alcanza para esta app.
const cuentas = ref(datosIniciales.cuentas)
const movimientos = ref(datosIniciales.movimientos)
// "valor" = cuántos bolívares equivalen a 1 dólar ese día (ej: 130).
// "origen" distingue si la cargó la persona a mano o, a futuro, una API.
const tasas = ref(datosIniciales.tasas)
const monedaReferencia = ref(datosIniciales.monedaReferencia)
const perfil = ref(datosIniciales.perfil)
const cuentasPorCobrar = ref(datosIniciales.cuentasPorCobrar)
// purgarPapelera() se aplica ACÁ, al armar el ref inicial — así, apenas
// se abre la app, ya no carga en memoria nada vencido (y el próximo
// guardado en localStorage sale "limpio" sin que haga falta tocar nada más).
const papelera = ref(purgarPapelera(datosIniciales.papelera))

let siguienteIdCuenta = Math.max(0, ...cuentas.value.map((c) => c.id)) + 1
let siguienteIdMovimiento = Math.max(0, ...movimientos.value.map((m) => m.id)) + 1
let siguienteIdCuentaPorCobrar = Math.max(0, ...cuentasPorCobrar.value.map((c) => c.id)) + 1
// Los abonos viven dentro de cada "cuenta por cobrar" (no son una
// colección aparte), así que su contador de IDs recorre todos los
// abonos de todas ellas para no repetir un id entre dos cuentas.
let siguienteIdAbono =
  Math.max(0, ...cuentasPorCobrar.value.flatMap((c) => c.abonos.map((a) => a.id))) + 1

// watch "observa" todo lo de arriba. Cada vez que algo cambia (deep:
// true = revisa también el interior de los objetos, no solo si el
// array entero fue reemplazado), vuelve a guardar todo en localStorage.
// Así nunca hay que acordarse de "guardar a mano".
watch(
  [cuentas, movimientos, tasas, monedaReferencia, perfil, cuentasPorCobrar, papelera],
  () => {
    localStorage.setItem(
      CLAVE_ALMACENAMIENTO,
      JSON.stringify({
        cuentas: cuentas.value,
        movimientos: movimientos.value,
        tasas: tasas.value,
        monedaReferencia: monedaReferencia.value,
        perfil: perfil.value,
        cuentasPorCobrar: cuentasPorCobrar.value,
        papelera: papelera.value,
      })
    )
  },
  { deep: true }
)

// Busca la tasa vigente en una fecha: la más reciente cargada hasta
// ese día (nunca una "futura" respecto a la fecha consultada — eso
// importa para convertir movimientos de fechas pasadas correctamente,
// algo clave en un país con inflación donde la tasa de hoy no sirve
// para convertir algo de hace tres meses).
function buscarTasaPara(fecha) {
  const candidatas = tasas.value
    .filter((t) => t.fecha <= fecha)
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
  return candidatas[0] ?? null
}

export function useFinanzas() {
  const totalesPorMonedaYTipo = computed(() => {
    const totales = {}
    for (const cuenta of cuentas.value) {
      totales[cuenta.moneda] ??= { activo: 0, pasivo: 0 }
      totales[cuenta.moneda][cuenta.tipo] += cuenta.saldo
    }
    return totales
  })

  // Distintas monedas que aparecen en tus cuentas. Si solo hay una, no
  // hace falta ninguna tasa para mostrar totales — todo está ya en la
  // misma unidad.
  const monedasEnUso = computed(() => Object.keys(totalesPorMonedaYTipo.value))

  // La tasa vigente HOY — la que se usa para convertir saldos actuales
  // a la moneda de referencia. Es el ÚNICO lugar de donde el resto de
  // la app obtiene "la tasa actual": el día de mañana, cuando se
  // conecte una API que la traiga sola, alcanza con cambiar esta
  // función (o agregar una fuente más) sin tocar nada del resto de la app.
  const tasaActual = computed(() => buscarTasaPara(hoyISO()))

  // ¿Hace falta una tasa para mostrar los totales combinados, pero no
  // hay ninguna cargada? (varias monedas en juego + sin tasa = no se
  // puede calcular un total fiel).
  const faltaTasa = computed(() => monedasEnUso.value.length > 1 && !tasaActual.value)

  // Convierte un monto de una moneda a otra usando la tasa vigente en
  // la fecha indicada (o la de hoy, si no se especifica). Si no hay
  // tasa cargada para esa fecha, devuelve null — quien lo use decide
  // cómo mostrar esa ausencia (ver faltaTasa).
  function convertir(monto, monedaOrigen, monedaDestino, fecha = hoyISO()) {
    if (monedaOrigen === monedaDestino) return monto
    const tasa = buscarTasaPara(fecha)
    if (!tasa) return null
    // 1 USD = tasa.valor Bs
    return monedaOrigen === 'USD' ? monto * tasa.valor : monto / tasa.valor
  }

  function totalConvertido(tipo) {
    return cuentas.value.reduce((suma, cuenta) => {
      if (cuenta.tipo !== tipo) return suma
      const convertido = convertir(cuenta.saldo, cuenta.moneda, monedaReferencia.value)
      return convertido === null ? suma : suma + convertido
    }, 0)
  }

  // Cuánto falta cobrar de una cuenta por cobrar puntual: el monto
  // original menos lo que ya se aplicó a capital en sus abonos (la
  // parte de "ganancia" de un abono NO reduce la deuda — ver
  // registrarAbono más abajo, que es donde se separan ambas cosas).
  function montoPendiente(cxc) {
    const aplicadoAlCapital = cxc.abonos.reduce((suma, abono) => suma + abono.aplicadoCapital, 0)
    return Math.max(0, cxc.montoOriginal - aplicadoAlCapital)
  }

  // computed crea un valor "derivado": Vue lo recalcula solo cuando
  // alguno de los datos de los que depende cambia (acá, las cuentas,
  // la tasa o la moneda de referencia elegida).
  const totalActivos = computed(() => totalConvertido('activo'))
  const totalPasivos = computed(() => totalConvertido('pasivo'))

  // Igual que totalConvertido, pero para "lo que te deben": cada
  // cuenta por cobrar puede estar en una moneda distinta, así que
  // convertimos lo pendiente de cada una a la moneda de referencia
  // antes de sumar.
  const totalPorCobrar = computed(() =>
    cuentasPorCobrar.value.reduce((suma, cxc) => {
      const convertido = convertir(montoPendiente(cxc), cxc.moneda, monedaReferencia.value)
      return convertido === null ? suma : suma + convertido
    }, 0)
  )

  // Lo que te deben sigue siendo "tuyo" aunque lo tenga otra persona —
  // por eso cuenta como un activo más acá. Esto además mantiene todo
  // matemáticamente consistente: prestar $100 desde Efectivo baja
  // totalActivos en $100 pero sube totalPorCobrar en $100 — el
  // patrimonio neto no se mueve, que es lo correcto (no te volviste
  // ni más rico ni más pobre por prestar, solo cambiaste de forma
  // en la que tenés ese dinero).
  const patrimonioNeto = computed(
    () => totalActivos.value + totalPorCobrar.value - totalPasivos.value
  )

  function cambiarMonedaReferencia(moneda) {
    monedaReferencia.value = moneda
  }

  // Mezcla los cambios con el perfil existente en vez de reemplazarlo
  // entero — así, si en el futuro alguien llama esto con un solo campo
  // (ej: solo el apellido), no borra accidentalmente el resto.
  function actualizarPerfil(cambios) {
    perfil.value = { ...perfil.value, ...cambios }
  }

  // Versión "exportable" de buscarTasaPara: la usa el detalle de un
  // movimiento para mostrar "la tasa de ese día" (no la de hoy — en
  // un país con inflación, la tasa cambia, y lo que importa para
  // entender un gasto viejo es la que regía cuando ocurrió).
  function tasaParaFecha(fecha) {
    return buscarTasaPara(fecha)
  }

  // Carga (o corrige) la tasa de un día puntual. Si ya existía una
  // para esa fecha, la reemplaza — así podés corregir un error de
  // tipeo sin terminar con dos tasas para el mismo día.
  function registrarTasa({ fecha, valor }) {
    const existente = tasas.value.find((t) => t.fecha === fecha)
    if (existente) {
      existente.valor = valor
      existente.origen = 'manual'
    } else {
      tasas.value.push({ fecha, valor, origen: 'manual' })
    }
  }

  function agregarCuenta({ nombre, tipo, moneda }) {
    cuentas.value.push({ id: siguienteIdCuenta++, nombre, tipo, moneda, saldo: 0 })
  }

  function agregarMovimiento({ fecha, tipo, categoria, monto, cuentaId, nota = '' }) {
    movimientos.value.push({
      id: siguienteIdMovimiento++,
      fecha,
      // Date.now() = milisegundos exactos del momento de carga. "fecha"
      // es el día que el usuario eligió (puede cargar algo de ayer);
      // "creadoEn" es el instante real en que quedó registrado, y es
      // lo que usamos para mostrar "hace 8 min" o la hora exacta.
      creadoEn: Date.now(),
      tipo,
      categoria,
      monto,
      cuentaId,
      nota, // texto libre y opcional — detalle que el detalle del movimiento muestra
    })

    // Ajustamos el saldo de la cuenta afectada: un ingreso lo suma, un gasto lo resta.
    // El monto queda automáticamente en la moneda de esa cuenta — no
    // hace falta convertir nada al cargar un movimiento.
    const cuenta = cuentas.value.find((c) => c.id === cuentaId)
    if (cuenta) {
      cuenta.saldo += tipo === 'ingreso' ? monto : -monto
    }
  }

  function eliminarMovimiento(id) {
    const indice = movimientos.value.findIndex((m) => m.id === id)
    if (indice === -1) return

    // Antes de borrar, revertimos su efecto sobre el saldo de la cuenta
    // (si no, el saldo quedaría "descuadrado" con la lista de movimientos).
    const [movimiento] = movimientos.value.splice(indice, 1)
    const cuenta = cuentas.value.find((c) => c.id === movimiento.cuentaId)
    if (cuenta) {
      cuenta.saldo -= movimiento.tipo === 'ingreso' ? movimiento.monto : -movimiento.monto
    }

    // En vez de perderlo para siempre, lo mandamos a la papelera con la
    // marca de "cuándo" — desde ahí se puede restaurar, y si nadie lo
    // hace, se borra solo a los DIAS_EN_PAPELERA días (ver purgarPapelera).
    papelera.value.push({ ...movimiento, eliminadoEl: Date.now() })
  }

  // Lo saca de la papelera, lo vuelve a poner en el historial y le
  // re-aplica su efecto al saldo — como si se acabara de cargar de nuevo.
  // "...movimiento" descarta "eliminadoEl" (ya no aplica una vez restaurado).
  function restaurarDePapelera(id) {
    const indice = papelera.value.findIndex((m) => m.id === id)
    if (indice === -1) return

    const [{ eliminadoEl, ...movimiento }] = papelera.value.splice(indice, 1)
    movimientos.value.push(movimiento)

    const cuenta = cuentas.value.find((c) => c.id === movimiento.cuentaId)
    if (cuenta) {
      cuenta.saldo += movimiento.tipo === 'ingreso' ? movimiento.monto : -movimiento.monto
    }
  }

  // Borrado definitivo manual (sin esperar los DIAS_EN_PAPELERA): la
  // persona puede vaciar un elemento de la papelera cuando quiera. Como
  // ya salió del historial al eliminarse la primera vez, acá no hay
  // saldo que revertir — solo desaparece de la papelera.
  function eliminarDePapeleraDefinitivamente(id) {
    const indice = papelera.value.findIndex((m) => m.id === id)
    if (indice !== -1) papelera.value.splice(indice, 1)
  }

  // Registra que alguien te debe plata. Hay dos casos bien distintos:
  //  - "trabajo": un servicio que ya hiciste pero todavía no te pagan.
  //    Esa plata nunca estuvo en ninguna cuenta — no se genera ningún
  //    movimiento, simplemente queda anotado que te lo deben.
  //  - "prestamo": plata real que sale de una de tus cuentas/billeteras.
  //    Acá SÍ generamos un movimiento de gasto que baja esa cuenta —
  //    igual que si hubieras "gastado" esa plata (solo que, a cambio,
  //    ahora aparece como un activo nuevo en "C. Cobrar").
  function agregarCuentaPorCobrar({
    persona,
    tipo,
    concepto = '',
    montoOriginal,
    moneda,
    fecha,
    cuentaOrigenId = null,
    nota = '',
  }) {
    const esPrestamo = tipo === 'prestamo'
    cuentasPorCobrar.value.push({
      id: siguienteIdCuentaPorCobrar++,
      persona,
      tipo,
      concepto,
      montoOriginal,
      moneda,
      fecha,
      cuentaOrigenId: esPrestamo ? cuentaOrigenId : null,
      abonos: [],
    })

    if (esPrestamo && cuentaOrigenId) {
      agregarMovimiento({
        fecha,
        tipo: 'gasto',
        categoria: CATEGORIA_PRESTAMO_OTORGADO,
        monto: montoOriginal,
        cuentaId: cuentaOrigenId,
        nota: nota || `Préstamo a ${persona}`,
      })
    }
  }

  // Registra un cobro (parcial o total) de una cuenta por cobrar.
  // El monto cobrado se reparte automáticamente en dos partes:
  //  - "aplicadoCapital": lo que reduce la deuda (hasta lo que faltaba).
  //  - "ganancia": lo que sobra por encima de lo que faltaba — solo
  //    puede pasar en préstamos que devuelven más de lo prestado, y
  //    se registra solo, como ingreso aparte, sin que el usuario tenga
  //    que hacer la cuenta ni cargarlo a mano.
  // Guardamos ambas partes en el propio abono para que el historial
  // sea auto-explicativo (no hay que recalcular nada para entenderlo).
  function registrarAbono({ cuentaPorCobrarId, fecha, monto, cuentaDestinoId, nota = '' }) {
    const cxc = cuentasPorCobrar.value.find((c) => c.id === cuentaPorCobrarId)
    if (!cxc) return

    const pendienteAntes = montoPendiente(cxc)
    const aplicadoCapital = Math.min(monto, pendienteAntes)
    const ganancia = monto - aplicadoCapital

    cxc.abonos.push({
      id: siguienteIdAbono++,
      fecha,
      monto,
      aplicadoCapital,
      ganancia,
      cuentaDestinoId,
      nota,
    })

    const categoriaCapital =
      cxc.tipo === 'prestamo' ? CATEGORIA_COBRO_PRESTAMO : CATEGORIA_COBRO_TRABAJO

    if (aplicadoCapital > 0) {
      agregarMovimiento({
        fecha,
        tipo: 'ingreso',
        categoria: categoriaCapital,
        monto: aplicadoCapital,
        cuentaId: cuentaDestinoId,
        nota: nota || `Cobro a ${cxc.persona}`,
      })
    }
    if (ganancia > 0) {
      agregarMovimiento({
        fecha,
        tipo: 'ingreso',
        categoria: CATEGORIA_GANANCIA_PRESTAMO,
        monto: ganancia,
        cuentaId: cuentaDestinoId,
        nota: `Ganancia por préstamo a ${cxc.persona}`,
      })
    }
  }

  // Exporta todo a un archivo .json descargable. Es la "puerta de salida"
  // de los datos: si el día de mañana migramos a otra base de datos,
  // este archivo es exactamente lo que se necesita para no perder nada
  // (incluye monedas y el historial de tasas, no solo cuentas y movimientos).
  function exportarDatos() {
    const datos = JSON.stringify(
      {
        cuentas: cuentas.value,
        movimientos: movimientos.value,
        tasas: tasas.value,
        monedaReferencia: monedaReferencia.value,
        perfil: perfil.value,
        cuentasPorCobrar: cuentasPorCobrar.value,
        papelera: papelera.value,
      },
      null,
      2
    )
    const blob = new Blob([datos], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const enlace = document.createElement('a')
    enlace.href = url
    enlace.download = `mis-finanzas-${hoyISO()}.json`
    enlace.click()
    URL.revokeObjectURL(url)
  }

  // Importa un archivo .json (por ejemplo, uno exportado antes) y
  // reemplaza los datos actuales por los del archivo.
  function importarDatos(archivo) {
    return new Promise((resolve, reject) => {
      const lector = new FileReader()
      lector.onload = () => {
        try {
          const datos = JSON.parse(lector.result)
          datos.cuentas?.forEach((c) => {
            if (!c.moneda) c.moneda = 'USD'
          })
          cuentas.value = datos.cuentas ?? []
          movimientos.value = datos.movimientos ?? []
          tasas.value = datos.tasas ?? []
          monedaReferencia.value = datos.monedaReferencia ?? 'USD'
          perfil.value = datos.perfil ?? { nombre: '', apellido: '', fechaNacimiento: '' }
          cuentasPorCobrar.value = datos.cuentasPorCobrar ?? []
          // Igual que al cargar la app: purgamos lo vencido del archivo
          // importado, así no "resucitan" elementos que ya deberían
          // haberse borrado definitivamente hace rato.
          papelera.value = purgarPapelera(datos.papelera ?? [])
          siguienteIdCuenta = Math.max(0, ...cuentas.value.map((c) => c.id)) + 1
          siguienteIdMovimiento = Math.max(0, ...movimientos.value.map((m) => m.id)) + 1
          siguienteIdCuentaPorCobrar = Math.max(0, ...cuentasPorCobrar.value.map((c) => c.id)) + 1
          siguienteIdAbono =
            Math.max(0, ...cuentasPorCobrar.value.flatMap((c) => c.abonos.map((a) => a.id))) + 1
          resolve()
        } catch (error) {
          reject(error)
        }
      }
      lector.onerror = () => reject(lector.error)
      lector.readAsText(archivo)
    })
  }

  // Borra TODO lo guardado y vuelve al estado de fábrica (las dos
  // cuentas de ejemplo en USD, sin movimientos ni tasas). Es
  // irreversible — quien llama a esto debe pedir confirmación antes
  // (ver ConfiguracionView, que pide confirmar igual que el aviso de
  // saldo negativo del formulario de movimientos).
  function restaurarDeFabrica() {
    const datos = datosDeFabrica()
    cuentas.value = datos.cuentas
    movimientos.value = datos.movimientos
    tasas.value = datos.tasas
    monedaReferencia.value = datos.monedaReferencia
    perfil.value = datos.perfil
    cuentasPorCobrar.value = datos.cuentasPorCobrar
    papelera.value = datos.papelera
    siguienteIdCuenta = Math.max(0, ...cuentas.value.map((c) => c.id)) + 1
    siguienteIdMovimiento = Math.max(0, ...movimientos.value.map((m) => m.id)) + 1
    siguienteIdCuentaPorCobrar = Math.max(0, ...cuentasPorCobrar.value.map((c) => c.id)) + 1
    siguienteIdAbono =
      Math.max(0, ...cuentasPorCobrar.value.flatMap((c) => c.abonos.map((a) => a.id))) + 1
  }

  return {
    cuentas,
    movimientos,
    tasas,
    tasaActual,
    monedaReferencia,
    perfil,
    monedasEnUso,
    faltaTasa,
    totalActivos,
    totalPasivos,
    totalPorCobrar,
    patrimonioNeto,
    convertir,
    cambiarMonedaReferencia,
    actualizarPerfil,
    registrarTasa,
    tasaParaFecha,
    agregarCuenta,
    agregarMovimiento,
    eliminarMovimiento,
    papelera,
    restaurarDePapelera,
    eliminarDePapeleraDefinitivamente,
    cuentasPorCobrar,
    montoPendiente,
    agregarCuentaPorCobrar,
    registrarAbono,
    restaurarDeFabrica,
    exportarDatos,
    importarDatos,
  }
}
