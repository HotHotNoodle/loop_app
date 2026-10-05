import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Same-origin API in dev: cookies stay first-party and no CORS is needed.
    proxy: { '/api': 'http://localhost:4000' },
  },
})
