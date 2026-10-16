/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // VITE_DEV_HTTPS=1: serve the dev site over HTTPS (self-signed certificate) so
  // other machines on the network get a secure context — browsers only offer
  // crypto.subtle there, which payload encryption needs. Pair it with
  // VITE_API_BASE_URL=/api/v1 so API calls go through the proxy below on the
  // same HTTPS origin (no mixed content, no CORS).
  const https = env.VITE_DEV_HTTPS === '1'
  return {
  plugins: [react(), tailwindcss(), ...(https ? [basicSsl()] : [])],
  css: {
    postcss: {},
  },
  server: {
    port: 3000,
    host: true,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: env.VITE_PROXY_TARGET || 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rolldownOptions: {
      output: {
        // Third-party code in vendor-*.js, our code everywhere else: the
        // production image obfuscates only our code (see Dockerfile) —
        // obfuscating public libraries adds no protection and breaks some
        // of them (i18next's self-referencing class).
        codeSplitting: {
          groups: [{ name: 'vendor', test: /node_modules/ }],
        },
      },
    },
  },
  preview: {
    port: 8002,
    host: true,
    allowedHosts: true,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
  },
}
})
