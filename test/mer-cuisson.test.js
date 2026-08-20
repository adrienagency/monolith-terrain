// LE MASQUE DE MER NE SE CUIT QUE S'IL SERA LU.
//
// Dans tout le nuanceur, `seaMask` n'est échantillonné QU'UNE FOIS : la branche
// ELSE de `underwater`, celle qui se déclenche quand le trait de côte ne fait
// PAS autorité. Or entre z4 et z15 (COAST_ZOOM_MIN/MAX) le trait de côte fait
// autorité partout : le champ y était construit à chaque cuisson et JAMAIS
// ÉCHANTILLONNÉ — 113 ms de travailleur et jusqu'à 5,3 Mo par bloc pour rien.
//
// ⚠️ ET IL N'EST PAS MORT PARTOUT. Aux zooms fins (z16–z17, Suisse et France)
// le masque côtier n'est pas servi, `uCoastMaskOn` vaut 0, et le masque de mer
// redevient LA SEULE SOURCE de la mer. Le supprimer sans condition peindrait
// ces zooms-là en terre. D'où les deux bords ci-dessous, testés tous les deux.
//
// ⚠️ CE QUE CE FICHIER DÉFEND VRAIMENT, c'est que les DEUX prédicats — celui du
// fragment et celui du CPU — restent LE MÊME. S'ils divergeaient un jour, on
// obtiendrait un bloc sans mer et SANS ERREUR : le champ jamais cuit, l'uniforme
// resté à zéro, aucune exception nulle part. La section 1 verrouille donc la
// source unique sur le nuanceur ASSEMBLÉ, pas sur une relecture du texte.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as THREE from 'three'
import { Terrain, COTE_AUTORITE_GLSL, coteFaitAutorite } from '../src/terrain.js'
import { computeTerrainJob, jobCouvertParEnVol } from '../src/terrain-jobs.js'

const src = (p) => readFileSync(fileURLToPath(new URL(`../src/${p}`, import.meta.url)), 'utf8')

// ── Le décor minimal ────────────────────────────────────────────────────────
// Un Terrain RÉEL : three.js construit ses matériaux et ses textures hors
// navigateur, seul le contexte WebGL manquerait — et on ne rend rien ici.
const PARAMS = {
  color: '#888888',
  envMapIntensity: 1,
  mapTint: 1,
  contourInterval: 100,
  contourOpacity: 0.3,
  contourWeight: 0.7,
  gridStep: 10,
  gridOpacity: 0.2,
  heightContrast: 1,
  heightPivot: 0.5,
  slopeTint: 0.3,
  contourColor: '#000000',
  gradLow: '#eeeecc',
  gradMid1: '#88aa66',
  gradMid2: '#aa8855',
  gradHigh: '#ffffff',
}
const faitTerrain = (extra = {}) => new Terrain({ ...PARAMS, ...extra })

// MNT côtier : la moitié ouest sous 0 m ET touchant le bord — de la VRAIE mer
// au sens topologique de sea-mask.js, pas une cuvette intérieure.
function demCotier(size = 96) {
  const data = new Float32Array(size * size)
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) data[y * size + x] = (x - size * 0.45) * 4 + 6 * Math.sin(y / 5)
  return { data, size, metersPerPixel: 20, extentMeters: 20 * size, empriseCote: 1 }
}

// Le champ R8 du masque côtier, tel que coast-mask.js le rend : > 127 = terre.
function champCotier(n = 32) {
  const data = new Uint8Array(n * n)
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) data[y * n + x] = x < n * 0.45 ? 0 : 255
  return { data, width: n, height: n }
}
const uneTextureCotiere = () => new THREE.DataTexture(new Uint8Array([255]), 1, 1, THREE.RedFormat)

// Le fragment ASSEMBLÉ : on rejoue `onBeforeCompile` sur un nuanceur bouchon
// qui ne porte que les jalons que terrain.js remplace. C'est le vrai texte GLSL
// que la carte compile, pas une relecture du fichier source.
function fragmentAssemble(terrain) {
  const stub = {
    uniforms: {},
    vertexShader: '#include <common>\n#include <begin_vertex>\n',
    fragmentShader:
      '#include <common>\n#include <color_fragment>\n#include <emissivemap_fragment>\n' +
      '#include <normal_fragment_maps>\n#include <lights_fragment_end>\n',
  }
  terrain.material.onBeforeCompile(stub)
  return stub.fragmentShader
}

// combien de texels de mer dans le masque actuellement posé
function texelsDeMer(terrain) {
  const img = terrain.mapUniforms.uSeaMask.value?.image
  if (!img?.data) return 0
  let n = 0
  for (const v of img.data) if (v > 127) n++
  return n
}

// ═══════════ 1. LE PRÉDICAT, UNE SEULE SOURCE POUR DEUX LECTEURS ═══════════

test('le fragment tranche `underwater` sur LA constante, pas sur une copie', () => {
  // Sur le SOURCE : l'interpolation elle-même. Une ligne réécrite en dur
  // passerait le test d'après (elle dirait le même texte AUJOURD'HUI) et
  // laisserait les deux prédicats libres de diverger demain.
  assert.match(
    src('terrain.js'),
    /bool underwater = \$\{COTE_AUTORITE_GLSL\}/,
    'le prédicat du fragment est réécrit en dur : il peut diverger de coteFaitAutorite sans bruit'
  )
})

test('… et la constante arrive VRAIMENT dans le nuanceur assemblé', () => {
  const frag = fragmentAssemble(faitTerrain())
  assert.ok(
    frag.includes(`bool underwater = ${COTE_AUTORITE_GLSL}`),
    'le fragment compilé ne porte pas le prédicat partagé'
  )
  // et la lecture de seaMask est bien dans l'AUTRE branche, la seule du
  // nuanceur — commentaires GLSL retirés, sinon on compterait de la prose.
  const code = frag.replace(/\/\/[^\n]*/g, '')
  assert.equal(
    (code.match(/\bseaMask\b/g) || []).length,
    3,
    'seaMask doit rester DÉCLARÉ, ÉCHANTILLONNÉ, et LU UNE SEULE FOIS : une deuxième lecture ferait mentir la garde de cuisson'
  )
  assert.match(code, /: \(vWorldPos\.y < uSeaY && seaMask > 0\.5\)/)
})

test('coteFaitAutorite lit le MÊME uniforme AU MÊME SEUIL que le fragment', () => {
  const m = COTE_AUTORITE_GLSL.match(/^(\w+) > ([\d.]+)$/)
  assert.ok(m, `prédicat illisible côté GLSL : « ${COTE_AUTORITE_GLSL} »`)
  const [, nom, texte] = m
  assert.equal(nom, 'uCoastMaskOn')
  assert.match(texte, /\./, 'un entier nu ne compile pas comme flottant en GLSL')
  const seuil = Number(texte)
  // `>` est STRICT des deux côtés — l'égalité ne fait pas autorité
  assert.equal(coteFaitAutorite({ [nom]: { value: seuil } }), false)
  assert.equal(coteFaitAutorite({ [nom]: { value: seuil + 1e-6 } }), true)
  assert.equal(coteFaitAutorite({ [nom]: { value: seuil - 1e-6 } }), false)
  assert.equal(coteFaitAutorite({}), false, 'pas d’uniforme = pas d’autorité')
})

// ═══════════ 2. LE CALCUL DÉPORTÉ : `avecMer` est un vrai interrupteur ══════

const demPlat = () => {
  const size = 64
  const data = new Float32Array(size * size)
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) data[y * size + x] = (x - size * 0.45) * 3.5 + 8 * Math.sin(y / 5)
  return { data, size, metersPerPixel: 19.1 }
}

test('computeTerrainJob : par DÉFAUT le masque de mer est cuit, comme avant', () => {
  const d = demPlat()
  const r = computeTerrainJob({ data: d.data, size: d.size, metersPerPixel: d.metersPerPixel })
  assert.ok(r.sea instanceof Uint8Array, 'le défaut doit rester la cuisson : c’est le cas z16–z17')
  assert.equal(r.seaSize, d.size)
  assert.ok([...r.sea].some((v) => v > 127), 'un MNT côtier doit rendre de la mer')
})

test('computeTerrainJob : `avecMer: false` ne cuit RIEN — et ne touche à rien d’autre', () => {
  const d = demPlat()
  const avec = computeTerrainJob({ data: d.data, size: d.size, metersPerPixel: d.metersPerPixel })
  const sans = computeTerrainJob({ data: d.data, size: d.size, metersPerPixel: d.metersPerPixel, avecMer: false })
  assert.equal(sans.sea, null)
  assert.equal(sans.seaSize, 0)
  // l'analyse de relief ne dépend QUE des altitudes : elle doit être identique
  assert.equal(sans.analysisSize, avec.analysisSize)
  assert.deepEqual([...sans.analysis], [...avec.analysis])
})

test('un travail « sans mer » en vol ne couvre PAS une demande qui la réclame', () => {
  const dem = {}
  const base = { dem, cote: null, maxSize: 0, seaMax: 0, analyse: true }
  assert.equal(jobCouvertParEnVol({ ...base, mer: false }, { ...base, mer: true }), false)
  assert.equal(jobCouvertParEnVol({ ...base, mer: true }, { ...base, mer: false }), true)
  assert.equal(jobCouvertParEnVol({ ...base, mer: true }, { ...base, mer: true }), true)
})

// ═══════════ 3. LE TERRAIN, EXÉCUTÉ — les deux bords ════════════════════════

test('SANS trait de côte (z16–z17) : le masque de mer EST cuit, et il porte la mer', async () => {
  const t = faitTerrain()
  t.dem = demCotier()
  assert.equal(t.mapUniforms.uCoastMaskOn.value, 0, 'le décor : aucune autorité côtière')
  t._buildFields()
  await t.fieldsReady
  assert.equal(t.mapUniforms.uSeaMaskOn.value, 1, 'sans le masque de mer, ces zooms n’ont plus de mer du tout')
  assert.ok(texelsDeMer(t) > 1000, `masque vide : ${texelsDeMer(t)} texels de mer`)
})

test('AVEC trait de côte (z4–z15) : le masque de mer n’est PAS cuit', async () => {
  const t = faitTerrain()
  t.dem = demCotier()
  const placeholder = t.mapUniforms.uSeaMask.value
  // le chemin RÉEL : le masque arrive du réseau et relance les champs
  t.setCoastMask(uneTextureCotiere(), champCotier())
  await t.fieldsReady
  assert.equal(t.mapUniforms.uCoastMaskOn.value, 1)
  assert.equal(t.mapUniforms.uSeaMaskOn.value, 0, 'champ cuit alors que le nuanceur ne le lira jamais')
  assert.equal(t.mapUniforms.uSeaMask.value, placeholder, 'une DataTexture a été posée pour rien')
})

test('… et le reste du travail passe : en Naturel l’analyse de relief part seule', async () => {
  // Le trait de côte est déjà là quand les champs se relancent — c'est le cas
  // du masque servi par le cache LRU de main.js, et celui du passage en mode
  // Naturel après coup (setColorMode rappelle _buildFields).
  const t = faitTerrain({ colorMode: 'natural' })
  t.dem = demCotier()
  t.setCoastMask(uneTextureCotiere(), champCotier())
  t._buildFields()
  await t.fieldsReady
  assert.equal(t.mapUniforms.uAnalysisOn.value, 1, 'le peigné des crêtes, lui, doit être là')
  assert.equal(t.mapUniforms.uSeaMaskOn.value, 0, 'le travail part, mais SANS le champ que personne ne lira')
})

test('le trait de côte LÂCHÉ rend l’autorité au masque de mer, qui se cuit', async () => {
  // C'est la transition qui casserait tout si le prédicat CPU était figé :
  // main.js lâche le masque dès qu'on sort de la bande z4–z15.
  const t = faitTerrain()
  t.dem = demCotier()
  t.setCoastMask(uneTextureCotiere(), champCotier())
  await t.fieldsReady
  assert.equal(t.mapUniforms.uSeaMaskOn.value, 0)
  t.setCoastMask(null)
  await t.fieldsReady
  assert.equal(t.mapUniforms.uCoastMaskOn.value, 0)
  assert.equal(t.mapUniforms.uSeaMaskOn.value, 1, 'sans côte et sans masque de mer, le bloc n’a plus de mer')
  assert.ok(texelsDeMer(t) > 1000)
})

test('rien à cuire → rien n’est posté, et la promesse se résout quand même', async () => {
  // Le voile de chargement attend `fieldsReady` : une promesse qui pend
  // laisserait l'application voilée pour toujours.
  const t = faitTerrain()
  t.dem = demCotier()
  t.setCoastMask(uneTextureCotiere(), champCotier())
  assert.ok(t.fieldsReady instanceof Promise)
  assert.equal(await t.fieldsReady, null)
})
