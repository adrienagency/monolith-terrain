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
// Relevé du 2026-08-02 : sol 78 070 (dont le socle mondial z8-z9, 76 060) ·
//   canopee 71 570 (dont le socle mondial z8-z9, 68 332).
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
// panne que ce fichier existe pour empêcher, et c'est le premier poste de
// `dist/` à avoir pu la produire à cette échelle. (La canopée l'a dépassé le
// soir même — voir la section suivante.)
//
// Le plancher est volontairement bas (60 000 pour 78 070 relevés) : la
// couverture va grandir, et ce qu'on attrape ici c'est le zéro, pas la marge.
// ═══════════════════════════════════════════════════════════════════════════
// POURQUOI `data/canopee` A REJOINT LA LISTE LE 2026-08-02, LE SOIR
// ═══════════════════════════════════════════════════════════════════════════
//
// ⚠️ CE FICHIER PORTAIT ICI, LE MATIN MÊME, LA CONSIGNE INVERSE — et elle était
// juste. La voici, parce que c'est le basculement qui compte, pas la ligne :
//
//   « La hauteur de canopée est cuite et livrée (3 228 tuiles, 28,5 Mo). Elle
//     n'a pourtant PAS de plancher ici […]. La canopée en est au stade d'AVANT :
//     trois zones (Mont-Blanc, Landes, Paris). Hors d'elles, `refreshCanopee`
//     lit le manifeste, ne trouve rien, ÉTEINT l'interrupteur et l'écrit à
//     l'écran. Un `dist/` amputé de ces tuiles ne produit donc pas la panne
//     silencieuse que ce fichier existe pour empêcher : il produit une couche
//     visiblement absente, qui se dit absente.
//     ⚠️ LE JOUR OÙ UN SOCLE MONDIAL DE CANOPÉE EST CUIT, CETTE LIGNE DEVIENT
//     OBLIGATOIRE — et personne ne le remarquera tout seul, puisque rien ne
//     casse. Le déclencheur n'est pas « il y a beaucoup de tuiles », c'est
//     « le manifeste couvre une zone dont le client ne peut plus sortir ». »
//
// CE JOUR EST ARRIVÉ. Le socle mondial z8-z9 est cuit : la zone « Monde » couvre
// -180,-60,180,84, c'est-à-dire toute l'emprise que l'ETH modélise. La porte de
// sortie du client est donc FERMÉE — `zoneCanopeePour` trouve toujours une zone,
// `refreshCanopee` n'éteint plus jamais l'interrupteur, et la couche PROMET de
// la donnée partout.
//
// ⚠️ ET LE MANIFESTE SURVIT À TOUT CE QUI TUE LES TUILES. Il fait 3 Ko et il est
// versionné dans `public/` ; les 71 569 PNG, eux, sont hors dépôt, donc absents
// d'un worktree neuf, donc absents de `dist/`, donc absents du site. Le résultat
// serait exactement la panne que ce fichier existe pour empêcher : interrupteur
// allumé, mosaïque vide, carte strictement inchangée, et l'utilisateur qui lit
// « la donnée dit qu'il n'y a pas d'arbres ici ». Aucun test ne rougirait,
// aucune console ne parlerait.
//
// ⚠️ ET C'EST DÉSORMAIS LE PLUS GROS POSTE DE `dist/` — 885 Mo, davantage que
// la bathymétrie (303 Mo) et l'occupation du sol (286 Mo) RÉUNIES. La canopée
// pèse trois fois le sol pour un nombre de tuiles COMPARABLE : une hauteur est
// un champ continu et bruité, là où une classe d'occupation forme de grandes
// plaques identiques que deflate avale d'un coup. Ce n'est donc pas seulement
// la couche la plus facile à perdre, c'est la plus visible à l'oeil quand elle
// manque.
//
// LE PLANCHER : 55 000, pour 71 570 fichiers relevés le 2026-08-02 (le socle
// mondial z8-z9, 68 332 tuiles, + les 3 237 tuiles fines z10-z14 des trois zones
// déjà cuites, + le manifeste). Même marge que `data/sol` : ~77 % du relevé. La
// couverture ne peut que grandir (z10 est chiffré à ~197 000 tuiles, les zones
// fines se multiplient), et ce qu'on attrape ici c'est le ZÉRO et
// l'effondrement, pas la variation normale.
const PLANCHERS = {
  'data/bathy': 20000,
  'data/coast-z6': 2000,
  'data/lake-tiles': 2000,
  'data/water-tiles': 400,
  'data/map/cells': 4000,
  'data/sol': 60000,
  'data/canopee': 55000,
}

import { readdirSync, statSync, existsSync, lstatSync, readFileSync } from 'node:fs'
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

// Ce que le MANIFESTE de la couche annonce, ou 0 s'il n'y en a pas.
//
// Une couche tuilée écrit un `index.json` qui liste ses zones avec, pour chacune,
// le nombre de tuiles cuites. C'est la seule source qui bouge en même temps que
// la donnée : la lire vaut mieux que toute constante recopiée à la main.
// Silencieux par principe — les couches sans manifeste (bathy, coast-z6…)
// gardent leur plancher, et un JSON illisible ne doit pas empêcher le contrôle
// des autres postes.
function attenduParManifeste(dossier) {
  try {
    const doc = JSON.parse(readFileSync(path.join(dossier, 'index.json'), 'utf-8'))
    if (!Array.isArray(doc?.zones)) return 0
    return doc.zones.reduce((t, z) => t + (Number.isFinite(z?.tuiles) ? z.tuiles : 0), 0)
  } catch {
    return 0
  }
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
  const attendu = attenduParManifeste(p)
  // ⚠️ LE MANIFESTE PORTE LE COMPTE EXACT, ET ON NE LE LISAIT PAS. Les planchers
  // en dur laissaient perdre 23 % du socle EN SILENCE (78 070 tuiles pour un
  // plancher de 60 000 ; 71 570 pour 55 000) — c'est-à-dire précisément
  // l'amputation partielle que ce fichier existe pour attraper.
  //
  // VÉRIFIÉ : `sol` annonce 76 060 et le disque en a 76 060 ; `canopee` annonce
  // 68 332, disque 68 332. Le seuil s'auto-ajuste donc à chaque cuisson, et il
  // n'y a plus de constante à éditer — donc plus de constante à oublier.
  //
  // Les 2 % de marge absorbent l'écart normal entre « tuiles annoncées par zone »
  // et fichiers sur le disque (une tuile peut appartenir à deux zones qui se
  // recouvrent, et le manifeste les compte séparément).
  const seuil = attendu ? Math.max(plancher, Math.floor(attendu * 0.98)) : plancher
  const ok = n >= seuil && !jonction
  const note = jonction
    ? '  ⚠ JONCTION, pas de vrais fichiers'
    : attendu && n < attendu
      ? `  ⚠ le manifeste en annonce ${attendu.toLocaleString('fr-FR')}`
      : ''
  console.log(`  ${ok ? '✓' : '✗'} ${rel.padEnd(18)} ${String(n).padStart(6)} fichiers  (seuil ${seuil})${note}`)
  if (!ok) faute++
}

if (faute) {
  console.error(`\n  ✗ ${faute} poste(s) en défaut — NE PAS DÉPLOYER.\n`)
  console.error('  La cause la plus probable : tu construis depuis un worktree neuf,')
  console.error('  où les données cuites (hors dépôt) sont absentes. Deux parades :\n')
  console.error('    · construire depuis un arbre qui les possède, ou')
  console.error('    · poser des jonctions, puis RECONSTRUIRE :\n')
  // ⚠️ `sol` ET `canopee` MANQUAIENT À CETTE LISTE, et ce sont les DEUX PLUS
  // GROS POSTES de `dist/`. Suivre les instructions imprimées puis reconstruire
  // échouait donc ENCORE, sur les deux couches les plus lourdes : une consigne
  // de réparation incomplète coûte plus cher que pas de consigne du tout.
  // Elles ne viennent pas du même arbre que les quatre autres, d'où les deux
  // lignes séparées.
  console.error('        foreach ($d in @("bathy","coast-z6","lake-tiles","water-tiles")) {')
  console.error('          cmd /c mklink /J "<worktree>\\public\\data\\$d" "C:\\Dev\\monolith-terrain\\public\\data\\$d"')
  console.error('        }')
  console.error('        cmd /c mklink /J "<worktree>\\public\\data\\sol"     "C:\\Dev\\wt-cuisson\\public\\data\\sol"')
  console.error('        cmd /c mklink /J "<worktree>\\public\\data\\canopee" "C:\\Dev\\wt-canopee\\public\\data\\canopee"')
  console.error('        npm run build:mapcells && npx vite build\n')
  console.error('  ⚠️ Déployer malgré ce refus met le site EN LIGNE AMPUTÉ, sans')
  console.error('     qu\'aucun test ni aucune console ne le signale.\n')
  process.exit(1)
}

console.log('\n  ✓ dist est complet — déploiement autorisé.\n')
