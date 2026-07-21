import { defineConfig } from 'vite'
import fs from 'node:fs'
import path from 'node:path'

// 'ocean-waves' : source LIVE si le repo ocean-lab est cloné à côté (toute
// modification du générateur de vagues y est visible ici immédiatement),
// sinon copie vendorée commitée (CI, autres machines).
// `npm run sync:waves` réaligne le vendor avant commit/deploy.
const live = path.resolve(__dirname, '../ocean-lab/src/lib/index.js')
const vendored = path.resolve(__dirname, 'src/vendor/ocean-waves/index.js')

export default defineConfig({
  // relative asset paths so the build works at any URL
  // (GitHub Pages subpath, workers.dev, local file preview)
  base: './',
  resolve: { alias: { 'ocean-waves': fs.existsSync(live) ? live : vendored } },
  server: {
    fs: { allow: [path.resolve(__dirname), path.resolve(__dirname, '../ocean-lab')] },
    // dev only: honour the port assigned by the launcher (PORT env), so several
    // sessions can run their own server without fighting over a hardcoded port
    ...(process.env.PORT ? { port: Number(process.env.PORT), strictPort: true } : {}),
  },
})
