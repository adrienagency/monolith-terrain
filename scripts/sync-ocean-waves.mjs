// Copie la lib ocean-waves depuis le repo source (C:\Dev\ocean-lab) vers
// src/vendor/. Le vendor commité sert au CI et aux machines sans ocean-lab ;
// en dev local, l'alias Vite pointe directement sur la source (voir
// vite.config.js) — ce script réaligne le vendor avant commit/deploy.
// Usage : npm run sync:waves  (échoue fort si ../ocean-lab est absent)
import fs from 'node:fs'
import path from 'node:path'

const SRC = path.resolve(import.meta.dirname, '../../ocean-lab/src/lib')
const DST = path.resolve(import.meta.dirname, '../src/vendor/ocean-waves')

if (!fs.existsSync(SRC)) {
  console.error(`introuvable : ${SRC} — cloner ocean-lab à côté du repo`)
  process.exit(1)
}
fs.rmSync(DST, { recursive: true, force: true })
fs.cpSync(SRC, DST, { recursive: true })
const files = fs.readdirSync(DST)
console.log(`sync ocean-waves → ${DST} (${files.join(', ')})`)
