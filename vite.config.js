import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
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
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
