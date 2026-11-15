import { defineConfig } from 'vite'

// The API serves this app in production, so the browser always talks to one origin.
// In development Vite plays that role by forwarding API and socket traffic to the backend.
// JSX is compiled by Vite's built-in esbuild; edits reload the page (no React Fast Refresh plugin).
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  // Libraries mark files "use client" for server-rendering frameworks; meaningless in this browser-only app.
  build: { rollupOptions: { onwarn: (w, warn) => w.code !== 'MODULE_LEVEL_DIRECTIVE' && warn(w) } },
  server: {
    proxy: {
      '/api': 'http://localhost:5000',
      '/socket.io': { target: 'http://localhost:5000', ws: true },
    },
  },
})
