import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  plugins: [tailwindcss(), tanstackStart({ srcDirectory: 'app' }), react()],
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
