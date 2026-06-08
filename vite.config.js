import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ command }) => {
  // GitHub Pages publica el repo "Cuento" en "usuario.github.io/Cuento/" —
  // es decir, la app NO vive en la raíz del dominio sino en esa subcarpeta.
  // "base" le dice a Vite (y de paso al manifest de la PWA, más abajo) que
  // arme todas las rutas con ese prefijo cuando hace el build de
  // producción. En desarrollo seguimos usando "/" para no romper nada al
  // correr "npm run dev" localmente (ahí la app vive en la raíz).
  const base = command === 'build' ? '/Cuento/' : '/'

  return {
    base,
    server: {
      // "host: true" hace que el servidor escuche en todas las interfaces de
      // red (no solo localhost) — necesario para entrar desde el celular por
      // la IP local o a través de un túnel como Cloudflare/ngrok.
      //
      // "allowedHosts: true" desactiva la verificación del header "Host" que
      // Vite hace por seguridad (por defecto solo acepta "localhost"). Los
      // túneles (ej: trycloudflare.com) llegan con un nombre de host distinto
      // cada vez, así que sin esto Vite respondería "Blocked request".
      // Es seguro relajarlo así en desarrollo: el servidor solo corre en tu
      // máquina y nadie más puede arrancarlo.
      host: true,
      allowedHosts: true,
    },
    plugins: [
      vue(),
      // VitePWA agrega dos cosas al compilar la app:
      //  1. Un "manifest" (manifest.webmanifest): metadata que el navegador
      //     usa para mostrar el botón "Instalar app" y crear el ícono en el
      //     teléfono/escritorio (nombre, colores, íconos).
      //  2. Un "service worker": un script que el navegador ejecuta en
      //     segundo plano, cachea los archivos de la app y permite que
      //     funcione offline una vez instalada.
      // registerType: 'autoUpdate' hace que, cuando subamos una nueva
      // versión, la app se actualice sola la próxima vez que se abra.
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          name: 'Mis Finanzas',
          short_name: 'Finanzas',
          description: 'Registro personal de activos, pasivos, ingresos y gastos',
          theme_color: '#2f6f4f',
          background_color: '#f6f7f9',
          display: 'standalone',
          // Tienen que coincidir con "base" de arriba: si no, el ícono
          // instalado intentaría abrir la app en la raíz del dominio
          // (usuario.github.io/) en vez de "usuario.github.io/Cuento/",
          // y el navegador respondería con un 404.
          start_url: base,
          scope: base,
          icons: [
            { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'maskable-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
      }),
    ],
  }
})
