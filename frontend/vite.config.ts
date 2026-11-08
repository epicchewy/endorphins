import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { sentryTanstackStart } from '@sentry/tanstackstart-react/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  plugins: [
    tailwindcss(),
    tanstackStart({ srcDirectory: 'app' }),
    // Release builds with SENTRY_AUTH_TOKEN, SENTRY_ORG and SENTRY_PROJECT upload hidden
    // source maps, then delete them so Bun never serves them.
    ...(process.env.SENTRY_AUTH_TOKEN
      ? [sentryTanstackStart({ telemetry: false, autoInstrumentMiddleware: false })]
      : []),
    react(),
  ],
  resolve: {
    alias: [
      ...(mode === 'e2e'
        ? ['client', 'server'].map((side) => ({
            find: new RegExp(`^~/auth/${side}$`),
            replacement: fileURLToPath(
              new URL(
                `./test/identity/${side}.${side === 'client' ? 'tsx' : 'ts'}`,
                import.meta.url,
              ),
            ),
          }))
        : []),
      { find: '~', replacement: fileURLToPath(new URL('./app', import.meta.url)) },
    ],
  },
  build: { outDir: mode === 'e2e' ? 'build-e2e' : 'build' },
  server: {
    host: '127.0.0.1',
    port: 3100,
    strictPort: true,
    proxy: { '/api': { target: process.env.API_ORIGIN ?? 'http://127.0.0.1:8088' } },
  },
}))
