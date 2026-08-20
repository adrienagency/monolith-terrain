#!/usr/bin/env node
// L'AUDIT DISQUE-CONTRE-LISTE — un test commité qui ne tourne jamais.
//
// `npm test` de ce dépôt n'est pas un motif de fichiers : c'est une LISTE
// EXPLICITE de 178 chemins, écrite à la main dans package.json. Un fichier de
// test ajouté sur le disque et oublié dans cette liste **ne s'exécute jamais**,
// et rien ne le signale : la suite affiche fièrement ses milliers de verts.
//
// ⚠️ CE N'EST PAS UNE CRAINTE THÉORIQUE. C'est déjà arrivé sur ce dépôt, et la
// procédure de contrôle existait — mais seulement dans la tête de qui s'en
// souvenait, réimprovisée en ligne de commande à chaque fois. Une procédure
// qu'on retape de mémoire est une procédure qu'on finit par sauter.
//
//   npm run audit:tests
//
// Trois écarts possibles, et ils n'ont pas la même gravité :
//   · ORPHELIN — sur le disque, absent de la liste. Le pire : le fichier existe,
//     il a l'air de protéger quelque chose, et il ne tourne pas.
//   · FANTÔME — dans la liste, absent du disque. Bruyant : `node --test` échoue,
//     donc il se remarque tout seul.
//   · DOUBLON — deux fois dans la liste. Sans danger, mais c'est le symptôme
//     d'une édition à la main qui a dérapé.

import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const RACINE = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))

const paquet = JSON.parse(readFileSync(join(RACINE, 'package.json'), 'utf8'))
const listes = paquet.scripts?.test?.match(/test\/[\w.-]+\.test\.js/g) || []
const surDisque = readdirSync(join(RACINE, 'test'))
  .filter((f) => f.endsWith('.test.js'))
  .map((f) => `test/${f}`)

const orphelins = surDisque.filter((f) => !listes.includes(f))
const fantomes = listes.filter((f) => !surDisque.includes(f))
const doublons = listes.filter((f, i) => listes.indexOf(f) !== i)

const ecarts = orphelins.length + fantomes.length + doublons.length

console.log(`${listes.length} listés · ${surDisque.length} sur disque`)

if (!ecarts) {
  console.log('Aucun écart.')
  process.exit(0)
}

console.error('')
if (orphelins.length) {
  console.error(`  ⛔ ${orphelins.length} ORPHELIN(S) — sur le disque, jamais exécuté(s) :`)
  for (const f of orphelins) console.error(`       ${f}`)
  console.error('     Ajoutez-les à la ligne "test" de package.json, ou supprimez-les.')
  console.error('     ⚠️ Un test qui ne tourne pas est pire qu\'un test absent : il rassure.')
}
if (fantomes.length) {
  console.error(`  ⛔ ${fantomes.length} FANTÔME(S) — listé(s), absent(s) du disque :`)
  for (const f of fantomes) console.error(`       ${f}`)
}
if (doublons.length) {
  console.error(`  ⚠️  ${doublons.length} DOUBLON(S) dans la liste :`)
  for (const f of [...new Set(doublons)]) console.error(`       ${f}`)
}
console.error('')
process.exit(1)
