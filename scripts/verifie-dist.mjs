#!/usr/bin/env node
// LE GARDE-FOU DU DÉPLOIEMENT — il compte ce que `dist/` contient VRAIMENT, et
// refuse de laisser partir un site amputé.
//
// ═══════════════════════════════════════════════════════════════════════════
// POURQUOI CE FICHIER EXISTE, et pourquoi une note ne suffisait pas
// ═══════════════════════════════════════════════════════════════════════════
//
// Tous les dossiers de données cuites (`public/data/bathy`, `coast-z6`,
// `lake-tiles`, `water-tiles`, `map/cells`) sont RÉGÉNÉRABLES, donc hors dépôt.
// Un `git worktree add` neuf les crée VIDES, `vite build` copie ce vide dans
// `dist/`, et `netlify deploy --dir dist` REMPLACE TOUT LE SITE — il n'y a pas
// de fusion incrémentale.
//
// LA PANNE EST SILENCIEUSE, et c'est ce qui la rend redoutable :
//   · aucun test ne rougit
//   · aucune erreur n'apparaît en console
//   · le site se charge, la carte s'affiche
// Seul l'œil la voit : le fond des mers repasse à plat, et la mer se couvre de
// rectangles de la taille d'une tuile.
//
// C'est arrivé DEUX FOIS.
//   · 2026-07-28 — 20 625 tuiles bathymétriques mondiales disparues du site,
//     sur plusieurs déploiements de suite.
//   · 2026-07-31 — revenue. Une note avait pourtant été écrite après la
//     première fois, et elle était juste.
//
// ⚠️ CE QUE LA SECONDE FOIS A APPRIS, et qui justifie du CODE plutôt qu'une
// note : PLUSIEURS SESSIONS DÉPLOIENT. Une note ne protège que celle qui la
// lit. La session qui a rejoué la panne ne l'avait jamais ouverte — elle ne
// travaillait même pas sur ce sujet, elle corrigeait un préalable CORS. Aucune
// discipline individuelle ne couvre ça : il faut un refus mécanique.
//
// ═══════════════════════════════════════════════════════════════════════════
// LES SEUILS
// ═══════════════════════════════════════════════════════════════════════════
//
// Ce sont des PLANCHERS, pas des égalités. Le catalogue grandit (la France
// EMODnet a ajouté 931 tuiles bathy en juillet) et un seuil exact obligerait à
// éditer ce fichier à chaque cuisson — donc à le contourner, donc à le perdre.
// On borne par le bas, largement sous le relevé du jour : ce qu'on attrape,
// c'est le ZÉRO et l'effondrement, pas la variation normale.
//
// Relevé du 2026-07-31, pour situer les marges :
//   bathy 21 557 · coast-z6 2 361 · lake-tiles 2 256 · water-tiles 488 ·
//   map/cells 5 140
// Relevé du 2026-08-02 : sol 78 070 (dont le socle mondial z8-z9, 76 060).
//
// ═══════════════════════════════════════════════════════════════════════════
// POURQUOI `data/sol` A REJOINT LA LISTE LE 2026-08-02
// ═══════════════════════════════════════════════════════════════════════════
//
// L'occupation du sol n'y était PAS, et c'était juste : elle ne couvrait que
// trois zones (Mont-Blanc, Nice, Paris). Hors de ces zones le client lisait le
// manifeste, ne trouvait rien, ÉTEIGNAIT l'interrupteur et le disait. L'absence
// était donc gérée, et un `dist/` amputé de cette couche se voyait tout de
// suite : la couche n'existait plus, personne ne pouvait croire le contraire.
//
// ⚠️ LE SOCLE MONDIAL z8-z9 A CHANGÉ CE CONTRAT. Toute vue tombe désormais dans
// une zone cuite : le client n'éteint plus jamais l'interrupteur, il PROMET de
// la donnée partout. Si `dist/` part sans les tuiles mais avec le manifeste —
// et le manifeste, lui, ne fait que 2 Ko, il survit à tout — l'interrupteur
// reste allumé devant une carte strictement inchangée. C'est mot pour mot la
// panne que ce fichier existe pour empêcher, et c'est maintenant le plus gros
// poste de `dist/` qui peut la produire.
//
// Le plancher est volontairement bas (60 000 pour 78 070 relevés) : la
// couverture va grandir, et ce qu'on attrape ici c'est le zéro, pas la marge.
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ POURQUOI `data/canopee` N'EST PAS DANS LA LISTE (2026-08-02)
// ═══════════════════════════════════════════════════════════════════════════
//
// La hauteur de canopée est cuite et livrée (3 228 tuiles, 28,5 Mo). Elle n'a
// pourtant PAS de plancher ici, et c'est le même raisonnement, appliqué à la
// lettre, que celui qui a fait entrer `data/sol` juste au-dessus :
//
//   ⚠️ CE GARDE-FOU PROTÈGE UNE PROMESSE, PAS UNE DONNÉE.
//
// L'occupation du sol n'y était pas tant qu'elle ne couvrait que trois zones,
// et elle y est entrée le jour du socle mondial — parce que ce jour-là toute vue
// est tombée dans une zone cuite, donc le client a cessé de pouvoir dire non,
// donc son interrupteur est devenu une PROMESSE tenue par des fichiers.
//
// La canopée en est au stade d'AVANT : trois zones (Mont-Blanc, Landes, Paris).
// Hors d'elles, `refreshCanopee` lit le manifeste, ne trouve rien, ÉTEINT
// l'interrupteur et l'écrit à l'écran. Un `dist/` amputé de ces tuiles ne
// produit donc pas la panne silencieuse que ce fichier existe pour empêcher : il
// produit une couche visiblement absente, qui se dit absente.
//
// ⚠️ LE JOUR OÙ UN SOCLE MONDIAL DE CANOPÉE EST CUIT, CETTE LIGNE DEVIENT
// OBLIGATOIRE — et personne ne le remarquera tout seul, puisque rien ne casse.
// Le déclencheur n'est pas « il y a beaucoup de tuiles », c'est « le manifeste
// couvre une zone dont le client ne peut plus sortir ».
const PLANCHERS = {
  'data/bathy': 20000,
  'data/coast-z6': 2000,
  'data/lake-tiles': 2000,
  'data/water-tiles': 400,
  'data/map/cells': 4000,
  'data/sol': 60000,
}

import { readdirSync, statSync, existsSync, lstatSync } from 'node:fs'
import path from 'node:path'

const dist = process.argv[2] || 'dist'

// Compte récursif. `lstatSync` sur le dossier de tête : une JONCTION Windows
// (mklink /J) compte ses fichiers comme s'ils étaient là — c'est vrai pour
// `find` comme pour nous, et c'est ce qui a failli masquer le défaut lors du
// diagnostic. On la signale donc explicitement plutôt que de la taire : un
// dossier de données qui est une jonction dans `dist` n'a rien à y faire, et
// rien ne garantit que le téléverseur la suive.
function compte(dir) {
  let n = 0
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) n += compte(p)
    else if (e.isFile()) n++
  }
  return n
}

if (!existsSync(dist)) {
  console.error(`\n  ✗ ${dist}/ n'existe pas. Lance d'abord :  npx vite build\n`)
  process.exit(1)
}

console.log(`\n  Contrôle de ${dist}/ avant déploiement\n`)
let faute = 0
for (const [rel, plancher] of Object.entries(PLANCHERS)) {
  const p = path.join(dist, rel)
  if (!existsSync(p)) {
    console.error(`  ✗ ${rel.padEnd(18)} ABSENT            (plancher ${plancher})`)
    faute++
    continue
  }
  const jonction = lstatSync(p).isSymbolicLink()
  const n = compte(p)
  const ok = n >= plancher && !jonction
  const note = jonction ? '  ⚠ JONCTION, pas de vrais fichiers' : ''
  console.log(`  ${ok ? '✓' : '✗'} ${rel.padEnd(18)} ${String(n).padStart(6)} fichiers  (plancher ${plancher})${note}`)
  if (!ok) faute++
}

if (faute) {
  console.error(`\n  ✗ ${faute} poste(s) en défaut — NE PAS DÉPLOYER.\n`)
  console.error('  La cause la plus probable : tu construis depuis un worktree neuf,')
  console.error('  où les données cuites (hors dépôt) sont absentes. Deux parades :\n')
  console.error('    · construire depuis un arbre qui les possède, ou')
  console.error('    · poser des jonctions, puis RECONSTRUIRE :\n')
  console.error('        foreach ($d in @("bathy","coast-z6","lake-tiles","water-tiles")) {')
  console.error('          cmd /c mklink /J "<worktree>\\public\\data\\$d" "C:\\Dev\\monolith-terrain\\public\\data\\$d"')
  console.error('        }')
  console.error('        npm run build:mapcells && npx vite build\n')
  console.error('  ⚠️ Déployer malgré ce refus met le site EN LIGNE AMPUTÉ, sans')
  console.error('     qu\'aucun test ni aucune console ne le signale.\n')
  process.exit(1)
}

console.log('\n  ✓ dist est complet — déploiement autorisé.\n')
