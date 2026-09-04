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
//   · NON DÉCLARÉ — un `test/*.mjs` qui n'est ni dans la liste, ni dans la
//     table HORS_SUITE ci-dessous. Voir le paragraphe suivant.
//
// ⚠️ 2026-09-04 — LA ZONE D'OMBRE DES `.mjs`. Cet audit ne regardait que
// `*.test.js`. À côté vivaient six `test/attaque-*.mjs` (93 326 octets) qui ne
// tournent jamais et que l'audit annonçait pourtant « aucun écart ». Ils sont
// hors suite POUR DE BONNES RAISONS — chacun exige un serveur `vite`, un Chrome
// piloté par CDP, ou lit `.banc/` qui est dans `.gitignore` — mais rien ne
// l'écrivait nulle part de façon vérifiable, et « c'est voulu » dans un
// commentaire de tête n'est pas un contrôle.
//
// Désormais l'audit VOIT les `.mjs`, et exige que chacun soit déclaré ici avec
// sa raison. Un nouveau `.mjs` déposé dans `test/` fait rougir l'audit tant
// qu'on ne l'a pas soit inscrit dans `package.json`, soit déclaré ci-dessous.
// C'est la seule façon d'empêcher la zone d'ombre de revenir.

import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

// Les fichiers de `test/` délibérément hors de `npm test`, et POURQUOI. Un
// fichier ne peut sortir de la suite qu'en entrant ici.
const HORS_SUITE = {
  'test/attaque-b1-ROUGE.mjs':
    'barème exécutable de l’attaque bathymétrie B1 — exige `npm run dev` + Chrome (B1_PORT, B1_CHROME) ; moitié pure inscrite : bathy.test.js, bathy-platier-b5.test.js',
  'test/attaque-b3-REANCRE.mjs':
    'les deux critères de B1 réancrés par le coordinateur — même serveur, même Chrome ; moitié pure inscrite : bathy-nappe-b3.test.js',
  'test/attaque-bt-ROUGE.mjs':
    'mesure au GPU de l’attaque BlueTopo — exige serveur + Chrome (BTA_PORT) ; bathy-bluetopo-bt-i.test.js, inscrit, la cite comme sa moitié GPU',
  'test/attaque-ge-ROUGE.mjs':
    'barème exécutable des gestes Google Earth — un chargement de page PAR GESTE (~6 min) ; c’est lui qui a rendu la note 9,75/10 de rapport-GE3.md, et scripts/sonde-ge3.mjs est tenu inchangé pour qu’il se relise sans une ligne modifiée',
  'test/attaque-r30-ROUGE.mjs':
    'les cinq gardes de JOURNAL de R30 — elles lisent `.banc/`, qui est dans .gitignore ; les six tests purs ont été scindés dans pivot-molette.test.js, inscrit',
  'test/attaque-r33-ROUGE.mjs':
    'gardes de journal de R33 — lisent `.banc/R33/*.json` écrit par scripts/lit-sonde-r33.mjs ; hors suite pour la même raison que R30',
}

const RACINE = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))

const paquet = JSON.parse(readFileSync(join(RACINE, 'package.json'), 'utf8'))
const listes = paquet.scripts?.test?.match(/test\/[\w.-]+\.test\.js/g) || []
const surDisque = readdirSync(join(RACINE, 'test'))
  .filter((f) => f.endsWith('.test.js'))
  .map((f) => `test/${f}`)

// Les autres fichiers exécutables de `test/` — ceux que le motif `*.test.js`
// ne voit pas. Ils doivent être déclarés dans HORS_SUITE, ou inscrits.
const autres = readdirSync(join(RACINE, 'test'))
  .filter((f) => (f.endsWith('.mjs') || f.endsWith('.spec.js') || f.endsWith('.test.mjs')) && !f.endsWith('.test.js'))
  .map((f) => `test/${f}`)

const orphelins = surDisque.filter((f) => !listes.includes(f))
const fantomes = listes.filter((f) => !surDisque.includes(f))
const doublons = listes.filter((f, i) => listes.indexOf(f) !== i)
const nonDeclares = autres.filter((f) => !listes.includes(f) && !(f in HORS_SUITE))
// une déclaration qui ne correspond plus à aucun fichier : la table a vieilli
const declarationsMortes = Object.keys(HORS_SUITE).filter((f) => !autres.includes(f))

const ecarts = orphelins.length + fantomes.length + doublons.length
  + nonDeclares.length + declarationsMortes.length

console.log(`${listes.length} listés · ${surDisque.length} sur disque`)
console.log(`${autres.length} hors suite, tous déclarés avec leur raison (voir HORS_SUITE)`)

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
if (nonDeclares.length) {
  console.error(`  ⛔ ${nonDeclares.length} FICHIER(S) DE TEST NON DÉCLARÉ(S) — ni dans la liste, ni dans HORS_SUITE :`)
  for (const f of nonDeclares) console.error(`       ${f}`)
  console.error('     Inscrivez-les dans la ligne "test" de package.json, ou déclarez-les')
  console.error('     dans HORS_SUITE (scripts/audit-tests.mjs) AVEC LA RAISON.')
  console.error('     ⚠️ « c\'est voulu » dans un commentaire de tête n\'est pas un contrôle.')
}
if (declarationsMortes.length) {
  console.error(`  ⚠️  ${declarationsMortes.length} DÉCLARATION(S) HORS_SUITE sans fichier :`)
  for (const f of declarationsMortes) console.error(`       ${f}`)
  console.error('     Le fichier a été supprimé ou renommé : retirez sa ligne de HORS_SUITE.')
}
if (doublons.length) {
  console.error(`  ⚠️  ${doublons.length} DOUBLON(S) dans la liste :`)
  for (const f of [...new Set(doublons)]) console.error(`       ${f}`)
}
console.error('')
process.exit(1)
