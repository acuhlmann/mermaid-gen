import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

function normalizeBase(value) {
  const s = (value ?? '/').trim() || '/'
  if (s === '/') return '/'
  return s.endsWith('/') ? s : `${s}/`
}

// https://vite.dev/config/
// Set VITE_BASE_PATH for subdirectory deploys (e.g. /hackathon/ behind a load balancer).
export default defineConfig({
  base: normalizeBase(process.env.VITE_BASE_PATH),
  plugins: [react()],
  resolve: {
    alias: {
      // PostCSS (pulled in by @antv/infographic) expects Node built-ins; Vite otherwise
      // injects empty externals that throw at runtime (see Vite troubleshooting).
      'source-map-js': require.resolve('source-map-js'),
      path: require.resolve('path-browserify'),
      url: path.join(__dirname, 'src/shims/node-url-stub.js'),
      fs: path.join(__dirname, 'src/shims/node-fs-stub.js')
    }
  },
  optimizeDeps: {
    include: ['source-map-js', 'path-browserify', '@antv/infographic']
  }
})
