import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

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
})
