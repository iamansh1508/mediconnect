import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The API serves this app in production, so the browser always talks to one origin.
// In development Vite plays that role by forwarding API and socket traffic to the backend.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:5000',
      '/socket.io': { target: 'http://localhost:5000', ws: true },
    },
  },
})
