// ═══════════════════════════════════════════════════════════════════════════
// B1 — LES TESTS ROUGES DE L'ATTAQUE BATHYMÉTRIE
//
// ⚠️ CE FICHIER N'EST PAS DANS LA LISTE `test` DE package.json, ET C'EST VOULU :
//    il est ROUGE aujourd'hui. C'est le cahier des charges de B3 et le barème
//    de B4. Il n'y entrera que quand il passera au vert.
//
// LA COMMANDE (deux terminaux, ou le premier en arrière-plan) :
//
//     npm run dev -- --host 127.0.0.1 --port 6311
//     node --test test/attaque-b1-ROUGE.mjs
//
//   Variables : B1_PORT (6311 par défaut), B1_CHROME (chemin de chrome.exe).
//
// ⚠️ TOUT SEUIL EST EN MÈTRES DE PROFONDEUR OU EN NOMBRE DE REQUÊTES.
//    Aucune unité interne, aucun ratio sans dimension : un correctif ne peut
//    pas les rendre verts en changeant une échelle de rampe ou un uniforme.
//
// ⚠️ LA MESURE EST LUE AU GPU (`readPixels` sur la texture GL de la tuile,
//    décodage terrarium), patron `scripts/sonde-r36.mjs` : `t.heights` est
//    relâché dès le maillage bâti, et une lecture « côté code » ne verrait donc
//    pas ce que l'écran montre.
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
  const sortie = path.join(os.tmpdir(), 'b1-rouge-' + Math.random().toString(36).slice(2) + '.json')
  const a = ['scripts/sonde-b1.mjs', '--port', PORT, '--sortie', sortie, ...args]
  if (process.env.B1_CHROME) a.push('--chrome', process.env.B1_CHROME)
  execFileSync(process.execPath, a, { cwd: RACINE, stdio: ['ignore', 'ignore', 'inherit'], timeout: 900000 })
  const r = JSON.parse(fs.readFileSync(sortie, 'utf8'))
  fs.rmSync(sortie, { force: true })
  return r
}

// Une seule session de navigateur pour les cinq premiers tests : le pixel n'est
// déterministe qu'en orbite, et A/B doit se faire DANS LA MÊME SESSION.
let DESCENTE = null
const descente = () => (DESCENTE ??= sonde([
  '--scenario', 'descente', '--attente', '8000',
  '--alts', '250,110,60',
  '--lieux', 'Java,Mer Noire,Caspienne,Baikal,Leman',
]).descente)

const au = (nom, altKm) => {
  const l = descente().find((r) => r.nom.toLowerCase().includes(nom.toLowerCase()) && r.altKm === altKm)
  assert.ok(l, 'point absent du relevé : ' + nom + ' @' + altKm + ' km')
  assert.ok(l.gpu && l.gpu.trouve, 'aucune tuile prête au GPU pour ' + nom + ' @' + altKm + ' km')
  return l
}

// ─── ① LE DÉFAUT CENTRAL : le fond disparaît au-delà de z10 ──────────────────
// Fosse de la Sonde, référence −7 290 m (GEBCO). Le crop rend −7 105 m ; le
// globe rend 0,0 m dès que sa tuile passe z10 — la fosse la plus profonde de
// l'océan Indien devient une plaine au niveau de la mer.
test('B1-1 · fosse de la Sonde en approche : le globe doit rendre au moins 6 000 m de fond', () => {
  const l = au('Java', 110)
  assert.ok(l.gpu.mGpu <= -6000,
    `globe ${l.gpu.mGpu.toFixed(1)} m à z${l.gpu.z} (crop ${l.crop?.mCrop} m, référence ${l.ref} m) — attendu ≤ −6 000 m`)
})

// ─── ② L'ÉCART GLOBE / CROP — la colonne qui départage ───────────────────────
// C'est LE chiffre du rapport : au même point, au même zoom, dans la même
// session. Sous z11 il vaut quelques dizaines de mètres ; à z11 il explose.
test('B1-2 · globe et crop doivent s accorder à 200 m près sur le fond de la mer Noire', () => {
  for (const alt of [250, 110, 60]) {
    const l = au('Mer Noire', alt)
    if (l.crop?.mCrop == null) continue
    const ecart = Math.abs(l.gpu.mGpu - l.crop.mCrop)
    assert.ok(ecart <= 200,
      `à ${alt} km (z${l.gpu.z}) : globe ${l.gpu.mGpu.toFixed(1)} m, crop ${l.crop.mCrop} m — écart ${ecart.toFixed(1)} m, attendu ≤ 200 m`)
  }
})

// ─── ③ LE FOND MARIN N'EST PAS UN APLAT ─────────────────────────────────────
// Étendue max−min sur une fenêtre de 9×9 texels, EN MÈTRES, lue au GPU. Un
// fond réel n'est jamais plat au mètre près sur 9 texels ; le crop garde 1 à
// 3 m de relief là où le globe rend exactement 0,00.
test('B1-3 · le fond marin doit porter du relief en approche, pas un aplat', () => {
  for (const [nom, alt] of [['Java', 110], ['Mer Noire', 110], ['Mer Noire', 60]]) {
    const l = au(nom, alt)
    assert.ok(l.gpu.fen.etendue >= 5,
      `${nom} @${alt} km (z${l.gpu.z}) : étendue 9×9 = ${l.gpu.fen.etendue.toFixed(2)} m — attendu ≥ 5 m (crop : ${l.crop?.fen?.etendue} m)`)
  }
})

// ─── ④ LA CASPIENNE — le remplissage de la source fine tient lieu de fond ────
// Fond à −1 053 m (surface −28 m, 1 025 m d'eau). Le globe rend −29 m dès z8 :
// c'est la SURFACE, pas le fond.
test('B1-4 · Caspienne : le globe doit rendre au moins 800 m de fond', () => {
  const l = au('Caspienne', 110)
  assert.ok(l.gpu.mGpu <= -800,
    `globe ${l.gpu.mGpu.toFixed(1)} m à z${l.gpu.z} (crop ${l.crop?.mCrop} m, référence ${l.ref} m) — attendu ≤ −800 m`)
})

// ─── ⑤ LES LACS — aucun fond, à aucun zoom, sur aucun des deux chemins ───────
// Baïkal : surface +456 m, 1 642 m d'eau, fond à −1 187 m. Léman : surface
// +372 m, 309 m d'eau, fond à +63 m. Le globe rend la SURFACE, à ±7 m.
test('B1-5 · les grands lacs doivent avoir un fond, pas une plaque à leur surface', () => {
  const cas = [
    { nom: 'Baikal', surface: 456, fond: -1187 },
    { nom: 'Leman', surface: 372, fond: 63 },
  ]
  for (const c of cas) {
    const l = au(c.nom, 110)
    const sousLaSurface = c.surface - l.gpu.mGpu
    assert.ok(sousLaSurface >= 100,
      `${c.nom} : globe ${l.gpu.mGpu.toFixed(1)} m, soit ${sousLaSurface.toFixed(1)} m sous la surface (+${c.surface} m) — attendu ≥ 100 m, fond réel ${c.fond} m`)
  }
})

// ─── ⑥ LE RÉSEAU — le globe ne demande JAMAIS une tuile bathymétrique ────────
// Compté par le protocole, pas par la lecture du code : 191 requêtes de tuiles
// d'altitude sur trois zones, zéro vers /data/bathy/.
test('B1-6 · le globe doit consulter la cascade bathymétrique par le réseau', () => {
  const r = sonde(['--scenario', 'reseau'])
  for (const z of r.zones) {
    const bathy = z.comptes.bathy?.total ?? 0
    const terrain = (z.comptes['aws-terrarium']?.total ?? 0) + (z.comptes.mapterhorn?.total ?? 0)
    assert.ok(bathy > 0,
      `${z.nom} : ${terrain} tuiles d'altitude demandées, ${bathy} tuile bathymétrique — attendu ≥ 1`)
  }
})

// ─── ⑦ LA CASCADE DÉCLARÉE N'EST PAS LA CASCADE CUITE ────────────────────────
// `bathy-sources.js` catalogue quatre fournisseurs ; l'index n'en porte QU'UN
// au-dessus du socle (EMODnet, France métropolitaine). BlueTopo (z12, 2–16 m)
// et Copernicus n'ont aucune zone : sur la côte est des États-Unis, le plafond
// retombe au socle GEBCO z8, soit 498 m de résolution au lieu de 16 m.
test('B1-7 · chaque source déclarée doit avoir au moins une zone dans l index', async () => {
  const { SOURCES } = await import('../src/bathy-sources.js')
  const idx = JSON.parse(fs.readFileSync(path.join(RACINE, 'public/data/bathy/index.json'), 'utf8'))
  const cuites = new Set([idx.base.source, ...idx.zones.map((z) => z.source)])
  const manquantes = Object.keys(SOURCES).filter((id) => !cuites.has(id))
  assert.deepEqual(manquantes, [],
    `déclarées dans SOURCES mais absentes de l'index : ${manquantes.join(', ')} — l'index ne porte que ${[...cuites].join(', ')}`)
})
