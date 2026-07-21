import { defineConfig } from 'vite'

export default defineConfig({
  // relative asset paths so the build works at any URL
  // (GitHub Pages subpath, workers.dev, local file preview)
  base: './',
  // dev only: honour the port assigned by the launcher (PORT env), so several
  // sessions can run their own server without fighting over a hardcoded port
  server: process.env.PORT ? { port: Number(process.env.PORT), strictPort: true } : {},
})
