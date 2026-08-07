#!/usr/bin/env node
// VIDER `dist/` AVANT DE CONSTRUIRE — avec de l'obstination.
//
// Sous Windows, `vite build` échoue par intermittence sur `ENOTEMPTY:
// dist\data` : il vide le répertoire de sortie lui-même, et un antivirus, un
// indexeur ou un simple explorateur ouvert dessus garde une poignée quelques
// centaines de millisecondes. Ce n'est pas une erreur de code — c'est un
// verrou de système de fichiers qui se relâche tout seul.
//
// ⚠️ POURQUOI ÇA MÉRITE UN SCRIPT PLUTÔT QU'UN HAUSSEMENT D'ÉPAULES : `dist/`
// contient 2,5 Go répartis en plus de 150 000 fichiers (canopée, sol,
// bathymétrie, côtes). Sur un tel volume, la probabilité qu'AU MOINS UN
// fichier soit tenu au mauvais moment n'est plus négligeable, elle est
// courante. Et l'échec tombe APRÈS `build:mapcells`, donc après plusieurs
// minutes de travail — au pire endroit possible.
//
// On réessaie donc, brièvement, au lieu d'abandonner à la première poignée.

import { rmSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const DIST = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), 'dist')

// Sept tentatives sur environ six secondes. Au-delà, ce n'est plus une poignée
// qui traîne : c'est un vrai problème, et il vaut mieux le dire que boucler.
const TENTATIVES = 7

function attendre(ms) {
  // Attente synchrone assumée : ce script est un préalable de build, il n'a
  // personne à laisser travailler pendant ce temps.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

if (!existsSync(DIST)) {
  console.log('dist/ absent — rien à nettoyer.')
} else {
  let reste = null
  for (let i = 1; i <= TENTATIVES; i++) {
    try {
      rmSync(DIST, { recursive: true, force: true, maxRetries: 3, retryDelay: 120 })
      reste = null
      break
    } catch (err) {
      reste = err
      if (i < TENTATIVES) attendre(i * 250)
    }
  }
  if (reste) {
    console.error('')
    console.error(`  ⛔ Impossible de vider dist/ après ${TENTATIVES} tentatives : ${reste.code || reste.message}`)
    console.error('')
    console.error('  Un programme tient un fichier dedans. Les suspects habituels :')
    console.error('    · un explorateur de fichiers ouvert sur dist/ ou un de ses sous-dossiers')
    console.error('    · un serveur de prévisualisation encore en cours (npx netlify dev, vite preview)')
    console.error('    · une analyse antivirus en train de parcourir les 150 000 fichiers')
    console.error('')
    process.exit(1)
  }
  console.log('dist/ vidé.')
}
