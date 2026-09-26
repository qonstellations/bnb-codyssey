import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { resolve } from 'path'

// Dev-only: serve run.html for /run/* (mirrors vercel.json rewrites, which
// don't apply to `vite dev` — without this the SPA fallback serves index.html
// whose router has no /run route, so every participant link hits NotFound).
function runRewrite() {
  return {
    name: 'run-rewrite',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0].startsWith('/run/')) {
          req.url = '/run.html'
        }
        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), runRewrite()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        run: resolve(import.meta.dirname, 'run.html'),
      },
    },
  },
})
