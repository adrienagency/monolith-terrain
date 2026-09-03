// ═══════════════════════════════════════════════════════════════════════════
// B3 — LES DEUX CRITÈRES RÉANCRÉS PAR LE COORDINATEUR, RENDUS EXÉCUTABLES
//
// ⚠️ CE FICHIER N'EST PAS DANS LA LISTE `test` DE package.json, pour la même
//    raison que `attaque-b1-ROUGE.mjs` : il exige un serveur et un Chrome.
//
//     npm run dev -- --host 127.0.0.1 --port 6311
//     node --test test/attaque-b3-REANCRE.mjs
//
// POURQUOI IL EXISTE. Deux seuils de B1 ne mesuraient pas ce qu'ils
// annonçaient, et le coordinateur les a réancrés SANS BAISSER LA BARRE :
//
//  · CRITÈRE 5 — B1 sondait la Caspienne à 38,5/51,5 et la Méditerranée à
//    35,5/19 en y attendant les profondeurs MAXIMALES de ces bassins. Balayage
//    de nos propres tuiles z8 (`scripts/releve-tuiles-b3.mjs`) : la fosse
//    caspienne est à −1 048 m en **38,962/50,738** et la fosse Calypso à
//    −5 136 m en **36,547/21,102** — soit 80 km et 200 km plus loin. Aux
//    points de B1, −592 m et −3 690 m sont les BONNES valeurs. Même seuil,
//    bon endroit.
//
//  · CRITÈRE 3 — « étendue 9×9 ≥ 5 m » demandait 5 m de dénivelé sur 126 m au
//    sol (z12, tuile 512 px) dans la plaine abyssale de la mer Noire, soit 4 %
//    de pente. Remplacé par : **le globe doit porter le même relief que le
//    damier au même endroit, à ±50 %**.
//
//    ⚠️ ET LA COMPARAISON SE FAIT À SURFACE AU SOL ÉGALE. Comparer deux
//    fenêtres de 9 texels quand un texel ne fait pas la même taille des deux
//    côtés mesure la taille de la tuile, pas le relief : à z11 le globe sert
//    du 256 px et le damier du 512 px, donc le globe voit DEUX FOIS plus de
//    sol et trouve mécaniquement ~2× plus d'étendue. La grandeur comparée est
//    donc une PENTE, en m/km. Contre-épreuve mesurée : au large de Chesapeake,
//    où le damier sert de l'AWS 256 px comme le globe, l'étendue BRUTE donne
//    déjà 0,96 (z11) et 1,00 (z12) sans aucune correction.
// ═══════════════════════════════════════════════════════════════════════════
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const PORT = process.env.B1_PORT || '6311'
const RACINE = path.resolve(import.meta.dirname, '..')

function sonde(args) {
  const sortie = path.join(os.tmpdir(), 'b3-reancre-' + Math.random().toString(36).slice(2) + '.json')
  const a = ['scripts/sonde-b1.mjs', '--port', PORT, '--sortie', sortie, ...args]
  if (process.env.B1_CHROME) a.push('--chrome', process.env.B1_CHROME)
  execFileSync(process.execPath, a, { cwd: RACINE, stdio: ['ignore', 'ignore', 'inherit'], timeout: 900000 })
  const r = JSON.parse(fs.readFileSync(sortie, 'utf8'))
  fs.rmSync(sortie, { force: true })
  return r
}

// Une seule session pour tous les tests : le pixel n'est déterministe qu'en
// orbite, et l'A/B globe-damier doit se faire DANS LA MÊME SESSION.
let D = null
const descente = () => (D ??= sonde([
  '--scenario', 'descente', '--attente', '8000', '--alts', '110,60',
  '--points', 'scripts/points-b3.json',
  '--lieux', 'Java,Mer Noire,Fosse s,Calypso,Kourile,Large d,Mer Rou',
]).descente)

const au = (nom, altKm) => {
  const l = descente().find((r) => r.nom.toLowerCase().includes(nom.toLowerCase()) && r.altKm === altKm)
  assert.ok(l, 'point absent du relevé : ' + nom + ' @' + altKm + ' km')
  assert.ok(l.gpu && l.gpu.trouve, 'aucune tuile prête au GPU pour ' + nom + ' @' + altKm + ' km')
  return l
}

// Côté d'un texel AU SOL, en mètres — c'est lui qui rend les deux fenêtres
// comparables.
const texelM = (z, px, lat) => (40075017 * Math.cos((lat * Math.PI) / 180)) / (2 ** z * px)
// Le damier sert du 512 px sur Mapterhorn et du 256 px sur AWS.
const cropPx = (c) => (c.source === 'mapterhorn' ? 512 : 256)
// La PENTE de la fenêtre : mètres de dénivelé par kilomètre de sol.
const penteParKm = (etendue, z, px, lat) => (etendue / (9 * texelM(z, px, lat))) * 1000

// ─── CRITÈRE 5 RÉANCRÉ · la Caspienne, à sa fosse ───────────────────────────
test('B3-5a · Caspienne, fosse sud (38,962 / 50,738) : au moins 800 m de fond, à z11 ET z12', () => {
  for (const alt of [110, 60]) {
    const l = au('Fosse sud de la Caspienne', alt)
    assert.ok(l.gpu.mGpu <= -800,
      `à ${alt} km (z${l.gpu.z}) : globe ${l.gpu.mGpu.toFixed(1)} m (damier ${l.crop?.mCrop} m, nos tuiles ${l.ref} m) — attendu ≤ −800 m`)
  }
})

// ─── CRITÈRE 5 RÉANCRÉ · la Méditerranée, à la fosse Calypso ────────────────
test('B3-5b · Calypso (36,547 / 21,102) : à 300 m de −5 136 m, à z11 ET z12', () => {
  for (const alt of [110, 60]) {
    const l = au('Calypso', alt)
    const ecart = Math.abs(l.gpu.mGpu - l.ref)
    assert.ok(ecart <= 300,
      `à ${alt} km (z${l.gpu.z}) : globe ${l.gpu.mGpu.toFixed(1)} m contre ${l.ref} m — écart ${ecart.toFixed(1)} m, attendu ≤ 300 m`)
  }
})

// ─── CRITÈRE 5 RÉANCRÉ · la mer Noire, inchangée ────────────────────────────
test('B3-5c · mer Noire : à 300 m de −2 212 m, à z11 ET z12', () => {
  for (const alt of [110, 60]) {
    const l = au('Mer Noire', alt)
    const ecart = Math.abs(l.gpu.mGpu - -2212)
    assert.ok(ecart <= 300,
      `à ${alt} km (z${l.gpu.z}) : globe ${l.gpu.mGpu.toFixed(1)} m contre −2 212 m — écart ${ecart.toFixed(1)} m`)
  }
})

// ─── CRITÈRE 3 REFORMULÉ · même relief que le damier, à ±50 % ───────────────
test('B3-3 · le globe porte le MÊME relief que le damier, à ±50 %, à surface au sol égale', () => {
  for (const [nom, alt] of [['Java', 110], ['Mer Noire', 110], ['Mer Noire', 60]]) {
    const l = au(nom, alt)
    assert.ok(l.crop?.fen?.etendue > 0, `${nom} @${alt} : le damier n'a pas de relief à comparer`)
    const pg = penteParKm(l.gpu.fen.etendue, l.gpu.z, l.gpu.px, l.lat)
    const pc = penteParKm(l.crop.fen.etendue, l.crop.zoom, cropPx(l.crop), l.lat)
    const rapport = pg / pc
    assert.ok(rapport >= 0.5 && rapport <= 1.5,
      `${nom} @${alt} km (z${l.gpu.z}) : globe ${pg.toFixed(2)} m/km, damier ${pc.toFixed(2)} m/km — rapport ${rapport.toFixed(2)}, attendu 0,50–1,50`)
    // ⛔ ET IL NE DOIT PAS ÊTRE PLAT : le rapport seul serait satisfait par deux
    // aplats à zéro. C'est ce que ce test remplace, pas ce qu'il oublie.
    assert.ok(l.gpu.fen.etendue > 0,
      `${nom} @${alt} km : étendue 9×9 = 0,00 m — c'est l'absence de donnée, pas un fond lisse`)
  }
})

// ─── LE CORRECTIF NE VAUT PAS QU'AUX POINTS NOMMÉS ──────────────────────────
// ⛔ « Un correctif qui ne vaut qu'aux points nommés sera coupé. » Ces lieux ne
// sont dans AUCUN seuil du barème et n'ont servi à régler quoi que ce soit :
// ils vérifient que la cascade descend PARTOUT.
test('B3-G · sur trois points hors barème, le globe suit le damier et n est jamais à zéro', () => {
  for (const nom of ['Kouriles', 'Large du Cap', 'Mer Rouge']) {
    for (const alt of [110, 60]) {
      const l = au(nom, alt)
      assert.ok(l.gpu.mGpu < -500,
        `${nom} @${alt} km (z${l.gpu.z}) : globe ${l.gpu.mGpu.toFixed(1)} m — la mer y a disparu`)
      const ecart = Math.abs(l.gpu.mGpu - l.crop.mCrop)
      assert.ok(ecart <= 200,
        `${nom} @${alt} km : globe ${l.gpu.mGpu.toFixed(1)} m, damier ${l.crop.mCrop} m — écart ${ecart.toFixed(1)} m`)
      assert.ok(l.gpu.fen.etendue > 0, `${nom} @${alt} km : aplat à 0,00 m`)
    }
  }
})
