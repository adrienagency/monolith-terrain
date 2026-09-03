// ═══════════════════════════════════════════════════════════════════════════
// BT-A — LES TESTS ROUGES DE L'ATTAQUE « CÔTES AMÉRICAINES / BlueTopo »
//
// ⚠️ CE FICHIER N'EST PAS DANS LA LISTE `test` DE package.json, ET C'EST VOULU :
//    il est ROUGE aujourd'hui. C'est le cahier des charges de l'intégrateur et
//    le barème du noteur. Il n'y entrera que quand il passera au vert.
//
// LA COMMANDE (deux terminaux, ou le premier en arrière-plan) :
//
//     npm run dev -- --host 127.0.0.1 --port 6533
//     node --test test/attaque-bt-ROUGE.mjs
//
//   Variables : BTA_PORT (6533 par défaut), BTA_CHROME (chemin de chrome.exe).
//
// ⚠️ TOUT SEUIL EST EN MÈTRES DE PROFONDEUR, EN PENTE PAR KILOMÈTRE, OU EN
//    NOMBRE DE REQUÊTES. Aucune unité interne, aucun ratio de rampe : un
//    correctif ne peut pas les verdir en changeant une échelle ou un uniforme.
//
// ⚠️ LA MESURE EST LUE AU GPU (`readPixels` sur la texture GL de la tuile,
//    décodage terrarium), patron `scripts/sonde-r36.mjs` puis `sonde-b1.mjs` :
//    `t.heights` est relâché dès le maillage bâti, et une lecture « côté code »
//    ne verrait pas ce que l'écran montre. `gl.getError()` a rendu 0 sur les
//    88 lectures de cette campagne, y compris sur les aplats à 0,00 m.
//
// ⚠️ CHAQUE COORDONNÉE A ÉTÉ VÉRIFIÉE CONTRE UNE SOURCE EXTERNE le 2026-09-03
//    (api.opentopodata.org, jeux `gebco2020` et `etopo1`, et `ned10m` pour les
//    Grands Lacs). Deux seuils du barème précédent visaient 80 et 200 km à côté
//    de la fosse qu'ils croyaient sonder : ici, la valeur externe est écrite en
//    commentaire au-dessus de chaque seuil.
// ═══════════════════════════════════════════════════════════════════════════
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const PORT = process.env.BTA_PORT || '6533'
const RACINE = path.resolve(import.meta.dirname, '..')

function sonde(args) {
  const sortie = path.join(os.tmpdir(), 'bta-rouge-' + Math.random().toString(36).slice(2) + '.json')
  const a = ['scripts/sonde-bt-a.mjs', '--port', PORT, '--sortie', sortie, ...args]
  if (process.env.BTA_CHROME) a.push('--chrome', process.env.BTA_CHROME)
  execFileSync(process.execPath, a, { cwd: RACINE, stdio: ['ignore', 'ignore', 'inherit'], timeout: 2400000 })
  const r = JSON.parse(fs.readFileSync(sortie, 'utf8'))
  fs.rmSync(sortie, { force: true })
  return r
}

// Une seule session de navigateur pour tous les tests de fond : le pixel n'est
// déterministe qu'en orbite, et l'A/B doit se faire DANS LA MÊME SESSION.
let USA = null
const usa = () => (USA ??= sonde(['--scenario', 'usa', '--attente', '8000', '--dbg', '9471']).mesures)
let RESEAU = null
const reseau = () => (RESEAU ??= sonde(['--scenario', 'reseau', '--dbg', '9481']).zones)

const au = (nom, z) => {
  const l = usa().find((r) => r.nom.toLowerCase().includes(nom.toLowerCase()) && r.z === z)
  assert.ok(l, 'point absent du relevé : ' + nom + ' à z' + z)
  assert.ok(l.mGlobe != null, 'aucune tuile prête au GPU pour ' + nom + ' à z' + z)
  return l
}

// ─── ① LE DÉFAUT CENTRAL : la carte n'ajoute plus rien après z11 ─────────────
//
// L'étendue max−min sur 9×9 texels est divisée par DEUX exactement quand on
// passe de z12 à z13 à taille de tuile constante (512 px) : c'est la loi de
// l'interpolation linéaire d'une surface qui ne reçoit aucune donnée nouvelle.
// Mesuré sur 12 des 13 points où la comparaison est licite : 0,500 · 0,500 ·
// 0,500 · 0,505 · 0,495 · 0,508 · 0,556 · 0,563 · 0,507 · 0,513 · 0,522 ·
// 0,501. Une source à 16 m qui MORD à z12/z13 ne peut pas rendre 0,50 : le
// texel z13 fait 61 m au sol à 37° N, et BlueTopo y a quatre valeurs distinctes.
//
// La contre-épreuve est dans le même relevé : au Golden Gate, où la fenêtre
// 9×9 chevauche la CÔTE (donc du terrarium terrestre, qui lui a du détail à
// z13), le rapport monte à 0,810. La mer est plate ; la terre ne l'est pas.
test('BT-1 · Chesapeake : la carte doit ajouter du détail entre z12 et z13', () => {
  const a = au('Chesapeake - embouchure', 12)
  const b = au('Chesapeake - embouchure', 13)
  const r = b.etendueGlobe / a.etendueGlobe
  assert.ok(r >= 0.70,
    `etendue 9x9 z12 ${a.etendueGlobe.toFixed(2)} m -> z13 ${b.etendueGlobe.toFixed(2)} m, rapport ${r.toFixed(3)} ` +
    `— attendu >= 0,70 (interpolation pure = 0,50 ; cote au Golden Gate = 0,81)`)
})

// ─── ② LE FOND EST GELÉ DÈS z11 ──────────────────────────────────────────────
//
// Le même texel GEBCO z8 est surzoomé jusqu'à z13 : la valeur ne bouge plus.
// Mesuré, |globe(z13) − globe(z11)| : Chesapeake 0,06 m · bassin médian 0,02 ·
// Virginia Beach 0,01 · New York Bight 0,02 · Georges Bank 0,04 · Louisiane
// 0,00 · Floride 0,01 m. Une source à 16 m DOIT faire bouger cette valeur :
// entre z11 (976 m au sol) et z13 (61 m) elle décrit un autre morceau de fond.
test('BT-2 · Chesapeake et New York : le fond doit changer entre z11 et z13', () => {
  for (const nom of ['Chesapeake - embouchure', 'New York Bight']) {
    const a = au(nom, 11)
    const b = au(nom, 13)
    const d = Math.abs(b.mGlobe - a.mGlobe)
    assert.ok(d >= 1.0,
      `${nom} : globe ${a.mGlobe.toFixed(2)} m a z11 et ${b.mGlobe.toFixed(2)} m a z13 — ` +
      `${d.toFixed(2)} m d'ecart, attendu >= 1,00 m`)
  }
})

// ─── ③ LA PROFONDEUR DES BAIES, CONTRE LA CARTE MARINE ───────────────────────
//
// 37,00 / −76,05, entree de la baie de Chesapeake (abords du chenal de Thimble
// Shoal). Externe : gebco2020 −10 m, etopo1 −10 m ; le chenal drague y est cote
// a 55 pieds (16,8 m) et les fonds naturels voisins sont a 10-14 m (NOAA
// chart 12222). Le globe rend −4,4 m : entre 5,6 et 12 m manquants dans une
// baie qui n'en fait que douze. C'est LE regime que BlueTopo (2-16 m) corrige.
test('BT-3 · Chesapeake : la baie doit avoir au moins 9 m de fond', () => {
  for (const z of [11, 12]) {
    const l = au('Chesapeake - embouchure', z)
    assert.ok(l.mGlobe <= -9.0,
      `z${z} : globe ${l.mGlobe.toFixed(1)} m (damier ${l.mDamier} m, externe gebco2020/etopo1 -10 m) — attendu <= -9,0 m`)
  }
})

// ─── ④ LA PENTE PAR KILOMÈTRE SUR LES PLATEAUX ───────────────────────────────
//
// La pente par kilometre (moyenne des |differences| entre texels voisins,
// ramenee au sol) est la grandeur qui dit si la carte DECRIT le fond ou le
// lisse. Aujourd'hui, a z12, quatre plateaux americains rendent moins de
// 0,70 m/km : Chesapeake median 0,61 · Virginia Beach 0,13 · Georges Bank 0,12
// · Louisiane 0,01 · Floride 0,00 · Tampa 0,65. Or nos propres temoins tiennent
// 7 a 12 m/km avec de la donnee de 115 a 464 m (Manche 11,5 · Brest 1,3 apres
// surzoom, 7,4 a z11 · mer Noire 7,3 · Java 7,2). Le seuil est pose a 2 m/km,
// soit SIX fois moins que ce que la Manche rend deja : il ne demande pas a la
// carte d'inventer du relief, il lui demande de ne pas etre un plan.
test('BT-4 · les plateaux americains doivent porter au moins 2 m/km de pente a z12', () => {
  const rates = []
  for (const nom of ['Plateau au large de Virginia Beach', 'Georges Bank', 'Plateau louisianais', 'Plateau ouest-Floride']) {
    const l = au(nom, 12)
    if (!(l.penteKmGlobe >= 2.0)) rates.push(`${nom} ${l.penteKmGlobe.toFixed(3)} m/km`)
  }
  assert.equal(rates.length, 0,
    `sous 2,00 m/km a z12 : ${rates.join(' · ')} — pour comparaison, la Manche rend 11,51 m/km au meme zoom`)
})

// ─── ⑤ LA CASCADE DESCEND-ELLE SOUS z8 DANS LES EAUX AMÉRICAINES ? ───────────
//
// Releve au protocole (Network.requestWillBeSent / responseReceived), 15 s de
// vol a 110 km sur chaque zone. Aujourd'hui, a Chesapeake : 14 tuiles bathy,
// TOUTES entre z3 et z8, ZERO au-dela — pendant que 116 tuiles d'ALTITUDE
// partent en z9, z10 et z11. Meme chose au detroit de Puget (13 bathy, z3..z8)
// et dans le golfe du Mexique (15 bathy, z4..z8). Dans la Manche, temoin, la
// cascade descend a z10 (36 tuiles z10) parce que la zone `fr-metro` le declare.
// Zero 404 partout : la carte ne CHERCHE meme pas plus fin, l'index l'en empeche.
test('BT-5 · Chesapeake et Puget : le globe doit demander des tuiles bathy sous z8', () => {
  const manques = []
  for (const nom of ['Chesapeake', 'Puget']) {
    const z = reseau().find((r) => r.nom.includes(nom))
    assert.ok(z, 'zone absente du releve : ' + nom)
    const fines = Object.entries(z.zoomsBathy || {}).filter(([k]) => Number(k.slice(1)) >= 9)
    const nFines = fines.reduce((s, [, v]) => s + v.ok, 0)
    if (nFines < 1) manques.push(`${nom} : ${JSON.stringify(z.zoomsBathy)} (altitude : ${JSON.stringify(z.zoomsAlt)})`)
  }
  assert.equal(manques.length, 0, 'aucune tuile bathy au-dela de z8 — ' + manques.join(' · '))
})

// ─── ⑥ LA CASCADE DÉCLARÉE EST-ELLE LA CASCADE CUITE ? ───────────────────────
//
// `src/bathy-sources.js` catalogue BlueTopo (16 m, CC0-1.0, credit ecrit) et
// Copernicus. `public/data/bathy/index.json` ne connait que `fr-metro`,
// `leman` et `baikal`. Une zone declaree, creditee, testee — et vide — est le
// defaut le plus discret de ce depot : c'est le meme test que B1-7, reste
// rouge apres B3, et il vise ici la moitie BlueTopo seulement (Copernicus
// exige un compte : B3 l'a etabli, on ne le compte pas contre l'integrateur).
test('BT-6 · BlueTopo est catalogue : il doit avoir une zone dans index.json', async () => {
  const r = await fetch('http://127.0.0.1:' + PORT + '/data/bathy/index.json')
  assert.equal(r.status, 200)
  const idx = await r.json()
  const zones = (idx.zones || []).filter((z) => z.source === 'bluetopo')
  assert.ok(zones.length >= 1,
    `aucune zone bluetopo dans index.json — zones presentes : ${(idx.zones || []).map((z) => z.id + '/' + z.source).join(', ')}`)
  assert.ok(zones.some((z) => z.zmax >= 12),
    `zone bluetopo presente mais plafond trop bas : ${JSON.stringify(zones)} — attendu zmax >= 12 (2-16 m natif)`)
})

// ─── ⑦ LES GRANDS LACS SONT LA SURFACE, AU CENTIMÈTRE ────────────────────────
//
// Le globe rend +176,9 m au large de Muskegon (lac Michigan) et +173,8 m dans
// le bassin central du lac Erie. La preuve que c'est bien LA NAPPE et pas un
// fond : `api.opentopodata.org/v1/ned10m` (USGS 10 m, terrestre) rend
// 176,91 m et 173,80 m aux MEMES coordonnees — nos deux valeurs a 1 cm pres.
// Etendue 9x9 : 0,00 m a z10, z11, z12 ET z13, aux deux points. C'est une
// plaque, pas un lac. Fonds documentes (NOAA NCEI) : Michigan ~100 m sous la
// nappe a ce point, Erie ~60 m.
test('BT-7 · Grands Lacs : le fond doit etre au moins 30 m sous la nappe', () => {
  const nappes = { 'Lac Michigan': 176.91, 'Lac Erie': 173.80 }
  const manques = []
  for (const [nom, nappe] of Object.entries(nappes)) {
    const l = au(nom, 12)
    const sous = nappe - l.mGlobe
    if (!(sous >= 30)) manques.push(`${nom} : globe ${l.mGlobe.toFixed(1)} m, soit ${sous.toFixed(2)} m sous la nappe ned10m ${nappe} m`)
  }
  assert.equal(manques.length, 0, manques.join(' · '))
})

// ─── ⑧ LE TÉMOIN ÉLIMINATOIRE : rien ne bouge hors des eaux américaines ──────
//
// Ce test est VERT aujourd'hui, et c'est exactement pour ca qu'il est ici : il
// doit le RESTER. La Manche a deja bouge de 4 m sur ce chantier, soit 80 % de
// la tolerance du barème precedent. Valeurs de reference relevees ce jour, au
// GPU, dans la session du tableau ① :
//   Manche z11 -72,5 / z12 -72,5   (externe gebco2020 -72)
//   Brest  z11 -21,2 / z12 -21,2   (externe gebco2020 -25 ; zone EMODnet)
//   mer Noire z11 -2199,9 / z12 -2199,8   (externe gebco2020 -2197)
//   Java   z11 -7105,1 / z12 -7105,2       (externe gebco2020 -7114)
//   Leman  z11 +62,0  / z12 +62,0          (swissBATHY3D / CIPEL +62)
test('BT-8 · NON-REGRESSION : les cinq temoins hors USA ne bougent pas de plus de 5 m', () => {
  const AVANT = {
    'TEMOIN Manche': { 11: -72.5, 12: -72.5 },
    'TEMOIN Rade de Brest': { 11: -21.2, 12: -21.2 },
    'TEMOIN Mer Noire': { 11: -2199.9, 12: -2199.8 },
    'TEMOIN Fosse de la Sonde': { 11: -7105.1, 12: -7105.2 },
    'TEMOIN Leman': { 11: 62.0, 12: 62.0 },
  }
  const derives = []
  for (const [nom, parZoom] of Object.entries(AVANT)) {
    for (const [z, avant] of Object.entries(parZoom)) {
      const l = au(nom, Number(z))
      const d = Math.abs(l.mGlobe - avant)
      if (d > 5) derives.push(`${nom} z${z} : ${avant} m -> ${l.mGlobe.toFixed(1)} m (${d.toFixed(1)} m)`)
    }
  }
  assert.equal(derives.length, 0, 'temoins hors USA deplaces de plus de 5 m : ' + derives.join(' · '))
})
