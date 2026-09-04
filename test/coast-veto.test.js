// ═══════════════════════════════════════════════════════════════════════════
// VETO — LE TRAIT DE CÔTE DÉCIDE, PAS UNE SOURCE GROSSIÈRE.
//
// PLAT a posé le garde d'échelle (`CELLULE_MAX_PX`) et a mesuré, honnêtement,
// qu'il ne mord PAS à z11–z13 : la Camargue y perdait encore 100 % de deux
// tuiles. À z12 la tuile est uniformément à +0,13 m (marais IGN) et un
// remplissage WebP est uniformément à +0,3 m — quatre discriminants LOCAUX
// testés par PLAT, aucun ne les sépare. L'information manque parce qu'elle est
// NON LOCALE : c'est le trait de côte vectoriel.
//
// CE FICHIER VERROUILLE LES DEUX MOITIÉS DU CORRECTIF :
//   ① le veto empêche la bande de bruit de noyer une terre déclarée par la côte
//     — sans lui, ces tests échouent (le champ sort intégralement en mer) ;
//   ⛔ ② LA MER RESTE LA MER. Un veto qui aurait aussi fermé la porte du zéro
//     exact aurait asséché les étangs de Camargue. C'est le test « l'étang
//     garde son eau », et il est aussi important que le premier.
// ═══════════════════════════════════════════════════════════════════════════
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { NOISE_BAND, fuseBathymetry } from '../src/bathy.js'
import {
  TUILES_Z6_MAX,
  bboxDepuisUV,
  erodeTerre,
  latDepuisV,
  lonDepuisU,
  rayonVeto,
  uDepuisLon,
  vDepuisLat,
} from '../src/coast-veto.js'

const f32 = (a) => Float32Array.from(a)

// LE CHAMP DE CAMARGUE À z12, tel que PLAT l'a mesuré : un marais uniformément
// à +0,13 m, et EMODnet qui réclame −2,04 m partout (elle ne connaît pas le
// delta du Rhône). Un carré de 16×16 suffit à déclencher la bande de bruit
// (FILL_MIN_SONDES = 64 sondes au pas de 17 → il en faut ≥ 1 088 pixels).
const N = 64
const marais = () => f32(new Array(N * N).fill(0.13))
const emodnet = () => f32(new Array(N * N).fill(-2.04))

test('sans veto, la bande de bruit noie TOUT le marais — le défaut d’Adrien', () => {
  const out = fuseBathymetry(marais(), emodnet())
  let noyes = 0
  for (const v of out) if (v < 0) noyes++
  assert.equal(noyes, N * N, 'c’est le relevé PLAT : 100 % de la tuile z12')
})

test('le veto rend le marais à la terre, au mètre près', () => {
  const veto = new Uint8Array(N * N).fill(1)
  const out = fuseBathymetry(marais(), emodnet(), { terreVeto: veto })
  let noyes = 0
  for (const v of out) if (v < 0) noyes++
  assert.equal(noyes, 0)
  // ⚠️ ET LA TERRE NE BOUGE PAS D'UN CENTIMÈTRE : le veto ne rend pas de la
  // terre, il refuse une reclassification. La valeur reste celle du terrarium.
  for (const v of out) assert.equal(v, Math.fround(0.13))
})

test('le veto est LOCAL : une moitié vetée, l’autre noyée', () => {
  const veto = new Uint8Array(N * N)
  for (let y = 0; y < N; y++) for (let x = 0; x < N / 2; x++) veto[y * N + x] = 1
  const out = fuseBathymetry(marais(), emodnet(), { terreVeto: veto })
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const sec = out[y * N + x] >= 0
      assert.equal(sec, x < N / 2, `pixel ${x},${y}`)
    }
  }
})

// ⛔ LE TEST QUI GARDE LA MER EN MER. L'étang du Vaccarès arrive dans la fusion
// par le ZÉRO EXACT du terrarium (contours organiques, `.banc/PLAT/apres/
// cam15-muets.png`), pas par la bande de bruit. Le veto ne doit pas y toucher.
test('l’étang garde son eau : le veto ne ferme pas la porte du zéro exact', () => {
  const land = marais()
  const sea = emodnet()
  // une lagune : le terrarium est MUET (0 exact) sur un disque au milieu
  const dedans = (i) => {
    const x = i % N, y = (i / N) | 0
    return (x - N / 2) ** 2 + (y - N / 2) ** 2 < 12 ** 2
  }
  for (let i = 0; i < land.length; i++) if (dedans(i)) land[i] = 0
  const veto = new Uint8Array(N * N).fill(1) // la côte dit TERRE PARTOUT
  const out = fuseBathymetry(land, sea, { terreVeto: veto })
  let eau = 0, sec = 0
  for (let i = 0; i < out.length; i++) {
    if (dedans(i)) { assert.ok(out[i] < 0, 'la lagune doit rester en eau'); eau++ }
    else { assert.ok(out[i] >= 0, 'le marais doit rester terre'); sec++ }
  }
  assert.ok(eau > 400 && sec > 3000)
})

test('un veto de la MAUVAISE TAILLE est ignoré, pas appliqué de travers', () => {
  const temoin = fuseBathymetry(marais(), emodnet())
  const out = fuseBathymetry(marais(), emodnet(), { terreVeto: new Uint8Array(7).fill(1) })
  assert.deepEqual(Array.from(out), Array.from(temoin))
})

test('sans terreVeto, la sortie est identique AU BIT à l’appel d’avant', () => {
  const a = fuseBathymetry(marais(), emodnet(), { noiseBand: NOISE_BAND })
  const b = fuseBathymetry(marais(), emodnet(), { noiseBand: NOISE_BAND, terreVeto: null })
  assert.deepEqual(Array.from(a), Array.from(b))
})

// ── la géométrie, pure ─────────────────────────────────────────────────────

test('Mercator normalisé : aller-retour lon/u et lat/v', () => {
  assert.equal(uDepuisLon(-180), 0)
  assert.equal(uDepuisLon(180), 1)
  assert.ok(Math.abs(lonDepuisU(uDepuisLon(4.6)) - 4.6) < 1e-9)
  assert.ok(Math.abs(vDepuisLat(0) - 0.5) < 1e-12)
  assert.ok(Math.abs(latDepuisV(vDepuisLat(43.45)) - 43.45) < 1e-9)
  // v croît vers le SUD — la convention des tuiles slippy, celle du masque
  assert.ok(vDepuisLat(60) < vDepuisLat(40))
})

test('bboxDepuisUV rend bien nord ≥ sud et ouest ≤ est', () => {
  const b = bboxDepuisUV({ u0: uDepuisLon(4.5), v0: vDepuisLat(43.6), u1: uDepuisLon(4.7), v1: vDepuisLat(43.3) })
  assert.ok(b.west < b.east && b.south < b.north)
  assert.ok(Math.abs(b.west - 4.5) < 1e-9 && Math.abs(b.north - 43.6) < 1e-9)
})

// ── l'érosion : c'est elle qui empêche le veto de figer le rivage ───────────

test('l’érosion retire la bordure de la terre, sur la largeur du rayon', () => {
  const w = 9, h = 9
  const brut = new Uint8Array(w * h).fill(1)
  const out = erodeTerre(brut, w, h, 2)
  // clamp-to-edge : les bords voient leur propre valeur répliquée, donc un champ
  // ENTIÈREMENT terre reste entièrement terre — c'est la convention de blurMask.
  assert.equal(Array.from(out).filter(Boolean).length, w * h)
})

test('l’érosion mange 30 m de terre autour d’un plan d’eau — le rivage reste au MNT', () => {
  const w = 21, h = 21
  const brut = new Uint8Array(w * h).fill(1)
  brut[10 * w + 10] = 0 // une cellule de mer au centre
  const out = erodeTerre(brut, w, h, 3)
  // toute cellule à ≤ 3 cases de la mer perd le veto : 7×7 = 49 cases
  let vetees = 0
  for (const v of out) if (v) vetees++
  assert.equal(vetees, w * h - 49)
  assert.equal(out[10 * w + 10], 0)
  assert.equal(out[10 * w + 13], 0, 'à 3 cases : encore dans la bande')
  assert.equal(out[10 * w + 14], 1, 'à 4 cases : la côte a le droit de parler')
})

test('un rayon nul rend le champ brut, sans copie ni surprise', () => {
  const brut = new Uint8Array([1, 0, 1, 1])
  assert.equal(erodeTerre(brut, 2, 2, 0), brut)
})

test('rayonVeto : 30 m de tolérance, converti au pas de la grille, plafonné', () => {
  assert.equal(rayonVeto(15), 2) // z12 en Camargue ≈ 13,9 m/cellule
  assert.equal(rayonVeto(0.433), 64) // z17 : le plafond mord (69 → 64)
  assert.equal(rayonVeto(1000), 0) // une emprise grossière : la côte se tait
  assert.equal(rayonVeto(NaN), 0)
})

test('TUILES_Z6_MAX borne la rafale réseau', () => {
  assert.ok(TUILES_Z6_MAX >= 4 && TUILES_Z6_MAX <= 64)
})
