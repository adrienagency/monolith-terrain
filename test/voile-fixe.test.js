// LE VOILE ET LA LIMITE DES ARBRES CESSENT DE SE RE-NORMALISER — Tâche BLA.
//
// > **Adrien, 2026-09-05 (vidéo 22 h 30) :** le relief est brun et contrasté à
// > z9–z10, **blanc et délavé à z11–z14**, en mode « Naturel ».
//
// Le coupable, nommé par extinction dans l'application vivante
// (`scripts/diag-bla-extinction.mjs`, `.banc/BLA/avant/extinction.json`) : la
// PERSPECTIVE AÉRIENNE, dont le voile d'ALTITUDE lit un `hNorm` normalisé sur
// le domaine vivant — Δlum −21,7 / Δchroma +25,1 quand on l'éteint à z9, contre
// −2 / +3 pour l'humidité et −0,4 / +0,6 pour la limite des arbres.
//
// ⚡ **CE BANC DOIT MORDRE** (pieges-communs.md : « une suite verte ne prouve
// rien »). Chaque test ci-dessous a été rejoué contre une mutation nommée dans
// `rapport-BLA.md`, et la mutation le fait tomber.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { facteursHNormRef, facteurDistanceVoile, DISTANCE_VOILE_M, COTE_REF_M } from '../src/rampe-fixe.js'
import { hNormRef, voile, humiditeY, GLSL_NATUREL } from '../src/monde/naturel-crop.js'
import { CHAMPS_HABILLAGE } from '../src/monde/branchement-crop.js'

const lire = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8')
const sansComm = (t) => t.replace(/\/\/[^\n]*/g, ' ')
const GLOBE = sansComm(lire('../src/globe.js'))
const TERRAIN = sansComm(lire('../src/terrain.js'))
const MAIN = sansComm(lire('../src/main.js'))
const GRILLE = sansComm(lire('../src/block-grid.js'))

// Les domaines RELEVÉS dans l'application vivante, Provence 44,2 / 5,78
// (`.banc/BLA/avant/extinction.json`) : le globe `[uReliefBas ; uLandMax]`.
const VIVANTS = {
  z9: { basM: 19.4, ampM: 3791.8 - 19.4 },
  z11: { basM: 358.4, ampM: 1770.0 - 358.4 },
  z13: { basM: 529.1, ampM: 1613.8 - 529.1 },
}
// la référence : le MNT de 42 km d'arrivée (z11), [358 ; 1 823] m
const REF = { basM: 358, ampM: 1823 - 358 }
const hNormVivant = (hM, d) => Math.min(Math.max((hM - d.basM) / d.ampM, 0), 1)

// ══════════ ① LA LOI — L'INVARIANCE PAR CRAN ═══════════════════════════════

test('① ⚡ LE CŒUR : le même point du sol garde le même voile quand le domaine s’effondre', () => {
  // Le voile d'altitude à `fd = 0` (au centre), pour trois altitudes réelles du
  // lieu, sous les curseurs de la vidéo (hazeAmt 0,68, hazeAlt 0,5, hazeDist 0,5).
  for (const hM of [700, 1000, 1300, 1600]) {
    const voiles = Object.values(VIVANTS).map((d) => {
      const f = facteursHNormRef(REF, d)
      return voile({ hNorm: hNormRef(hNormVivant(hM, d), f.a, f.b), fd: 0, hazeAmt: 0.68, hazeAlt: 0.5, hazeDist: 0.5 })
    })
    const etendue = Math.max(...voiles) - Math.min(...voiles)
    assert.ok(etendue < 1e-9, `${hM} m : le voile s'étend de ${etendue} entre z9 et z13 (${voiles.join(', ')})`)
  }
})

test('① ⚡ SANS LE CORRECTIF, LE MÊME POINT BLANCHIT — la garde mord', () => {
  // Le chemin du dépôt d'avant : `hNorm` vivant, sans conversion. À 1 000 m le
  // voile vaut 0,19 à z9 et 0,02 à z13 — c'est ce qu'Adrien voyait passer.
  const voiles = Object.values(VIVANTS).map((d) =>
    voile({ hNorm: hNormVivant(1000, d), fd: 0, hazeAmt: 0.68, hazeAlt: 0.5, hazeDist: 0.5 }))
  const etendue = Math.max(...voiles) - Math.min(...voiles)
  assert.ok(etendue > 0.1, `le dépôt d'avant ne dérive plus (${etendue}) : ce test ne prouve rien`)
})

test('① la limite des arbres suit la même conversion : la végétation s’éteint à la MÊME altitude partout', () => {
  // treeLine 0,8 dans la référence = 358 + 0,8 × 1 465 = 1 530 m ; la bande de
  // 0,18 (264 m) va jusqu'à 1 794 m. À 1 400 m la végétation est entière, à
  // 1 900 m elle est partie — à TOUS les crans qui portent ces altitudes.
  // ⚠️ wetK 0,1 : le gain d'humidité (4,86) sature l'axe Y dès veg > 0,2 —
  // à wetK 1, « dans la bande » et « entière » rendaient le même 1,0
  const veg = (hM, d) => {
    const f = facteursHNormRef(REF, d)
    return humiditeY({ canalB: 1, canalA: 0.5, hNorm: hNormRef(hNormVivant(hM, d), f.a, f.b), wetK: 0.1, expoK: 0, hemi: 1, treeLine: 0.8 })
  }
  for (const [nom, d] of Object.entries(VIVANTS)) {
    assert.ok(veg(1400, d) > 0.9, `${nom} : à 1 400 m l'humidité vaut ${veg(1400, d)}`)
  }
  // ⚠️ SEUL z9 COUVRE 1 900 m : z11 culmine à 1 770 m et z13 à 1 614 m, leur
  // hNorm y est écrêté à 1, donc hNormRef vaut (1 770 − 358) / 1 465 = 0,964
  // ou 0,857 — DANS la bande. C'est le prix du clamp, dit dans rampe-fixe.js,
  // et il ne concerne que des altitudes ABSENTES du crop.
  const y19 = veg(1900, VIVANTS.z9)
  assert.ok(Math.abs(y19 - 0.5) < 1e-6, `z9 : à 1 900 m l'humidité vaut encore ${y19}`)
  // et DANS la bande, à une altitude que z9 et z11 portent tous les deux
  // (1 700 m), la végétation restante est la MÊME — c'est l'invariance
  assert.ok(Math.abs(veg(1700, VIVANTS.z9) - veg(1700, VIVANTS.z11)) < 1e-9)
  assert.ok(veg(1700, VIVANTS.z9) > 0.5 && veg(1700, VIVANTS.z9) < 1)
  // et SANS conversion, z9 gardait de la végétation à 1 900 m (hNorm 0,50 < 0,8)
  const sans = humiditeY({ canalB: 1, canalA: 0.5, hNorm: hNormVivant(1900, VIVANTS.z9), wetK: 0.1, expoK: 0, hemi: 1, treeLine: 0.8 })
  assert.ok(sans > 0.9, `le dépôt d'avant n'a plus de végétation à 1 900 m à z9 (${sans}) : la garde ne prouve rien`)
})

test('① les coefficients sont ceux de la dérivation : a = ampVivant / ampRef, b = (basVivant − basRef) / ampRef', () => {
  const f = facteursHNormRef(REF, VIVANTS.z9)
  assert.ok(Math.abs(f.a - 3772.4 / 1465) < 1e-9)
  assert.ok(Math.abs(f.b - (19.4 - 358) / 1465) < 1e-9)
  // et le chiffre du rapport : 2,58 à z9, 0,74 à z13
  assert.ok(Math.abs(f.a - 2.575) < 0.01)
  assert.ok(Math.abs(facteursHNormRef(REF, VIVANTS.z13).a - 0.740) < 0.01)
  // la composée est bien « mètres → référence » : 1 000 m tombe au même hNormRef
  for (const d of Object.values(VIVANTS)) {
    const g = facteursHNormRef(REF, d)
    assert.ok(Math.abs(hNormRef(hNormVivant(1000, d), g.a, g.b) - (1000 - 358) / 1465) < 1e-9)
  }
})

// ══════════ ② L'IDENTITÉ AU BIT — LE CHEMIN DU DÉPÔT ═══════════════════════

test('② ⛔ AU BIT : sans référence, `hNormRef` rend `hNorm` — le MÊME nombre', () => {
  for (const nul of [null, undefined]) {
    const f = facteursHNormRef(nul, VIVANTS.z9)
    assert.ok(Object.is(f.a, 1) && Object.is(f.b, 0))
  }
  assert.deepEqual(facteursHNormRef(REF, null), { a: 1, b: 0 })
  // un domaine ÉGAL rend l'identité sans division (le court-circuit de `transpose`)
  assert.deepEqual(facteursHNormRef(REF, { ...REF }), { a: 1, b: 0 })
  // un domaine dégénéré (MNT plat, pas encore chargé) aussi
  assert.deepEqual(facteursHNormRef({ basM: 0, ampM: 0 }, VIVANTS.z9), { a: 1, b: 0 })
  assert.deepEqual(facteursHNormRef(REF, { basM: 5, ampM: -1 }), { a: 1, b: 0 })
  // et `x × 1 + 0` EST `x` en IEEE 754, pour un balayage de valeurs « sales »
  for (const x of [0, 0.1, 0.3, 0.48000000000000004, 0.7071067811865476, 1]) {
    assert.ok(Object.is(hNormRef(x, 1, 0), x), `${x} n'est pas rendu au bit`)
  }
})

test('② le jumeau JS et le TEXTE GLSL de `natHNormRef` disent la même chose', () => {
  const i = GLSL_NATUREL.indexOf('float natHNormRef(float hNorm, float a, float b) {')
  assert.ok(i > 0, 'natHNormRef est absent du texte GLSL')
  const corps = GLSL_NATUREL.slice(i, GLSL_NATUREL.indexOf('}', i))
  assert.match(corps, /return clamp\(hNorm \* a \+ b, 0\.0, 1\.0\);/)
  // exécuté, pas seulement lu : le texte, mot pour mot, contre le jumeau
  const js = corps.replace(/^[^{]*\{/, '').replace(/clamp\(/g, 'CL(').replace(/return/, 'return ')
  // eslint-disable-next-line no-new-func
  const fn = new Function('hNorm', 'a', 'b', 'CL', js)
  const CL = (v, lo, hi) => Math.min(Math.max(v, lo), hi)
  for (const [h, a, b] of [[0.2, 2.575, -0.23], [0.9, 0.74, 0.117], [0.5, 1, 0], [1, 3, 0.5], [0, 0.5, -0.4]]) {
    assert.equal(fn(h, a, b, CL), hNormRef(h, a, b))
  }
})

// ══════════ ③ LA DISTANCE DU VOILE, EN MÈTRES ══════════════════════════════

test('③ la borne du voile est la demi-emprise la plus large : 80 km, et la vue large y garde son image', () => {
  // ⛔ 20 km (la demi-emprise d'arrivée) GRISAIT LA VUE LARGE : chroma 52 → 20 à
  // z9, mesuré (`.banc/BLA/distance/distance.json`). Le chiffre et son tableau
  // sont dans rampe-fixe.js.
  assert.equal(DISTANCE_VOILE_M, 2 * COTE_REF_M)
  assert.equal(DISTANCE_VOILE_M, 80000)
  // à z9 (168 341 m relevé), le facteur vaut ~1 : la vue large d'aujourd'hui
  assert.ok(Math.abs(facteurDistanceVoile(168341 / 2) - 1.052) < 0.001)
  // au zoom d'arrivée (42 085 m) le bord du crop est à 21 km : un quart de brume
  assert.ok(Math.abs(facteurDistanceVoile(42085 / 2) - 0.263) < 0.001)
  // z13 (10 521 m) : le bord est à 5,3 km, le voile de distance y est marginal
  assert.ok(Math.abs(facteurDistanceVoile(10521 / 2) - 0.066) < 0.001)
  // ⚠️ et le MÊME point du sol reçoit la MÊME brume de distance à tous les crans :
  // un point à 4 km du centre vaut fd = 0,05 que le crop fasse 10 ou 168 km
  for (const extentM of [10521, 42085, 168341]) {
    const fdDemi = 4000 / (extentM / 2)
    assert.ok(Math.abs(fdDemi * facteurDistanceVoile(extentM / 2) - 0.05) < 1e-12)
  }
})

test('③ sans demi-largeur connue, le facteur vaut 1 — le dépôt au bit', () => {
  for (const v of [0, -1, NaN, undefined, null, Infinity]) assert.ok(Object.is(facteurDistanceVoile(v), 1), `${v}`)
})

// ══════════ ④ LE BRANCHEMENT — LÀ OÙ LES GARDES RESTENT VERTES À TORT ══════

test('④ les deux nuanceurs passent la limite des arbres ET le voile par `natHNormRef`', () => {
  // globe : l'entrée est hNormRelief (l'échelle du socle, ⑤d de crop-naturel)
  assert.ok(GLOBE.includes('float hNormNat = natHNormRef(hNormRelief, uHNormRefA, uHNormRefB);'))
  assert.ok(GLOBE.includes('natHumiditeY(anl.b, anl.a, hNormNat, uWetK, uExpoK, uHemi, uTreeLine)'))
  assert.ok(GLOBE.includes('natVoile(natHNormRef(hNormRelief, uHNormRefA, uHNormRefB), fd, hazeIci, uHazeAlt, uHazeDist)'))
  // socle : l'entrée est hNorm (uHeightRange)
  assert.ok(TERRAIN.includes('float hNormNat = natHNormRef(hNorm, uHNormRefA, uHNormRefB);'))
  assert.ok(TERRAIN.includes('natHumiditeY(anl.b, anl.a, hNormNat, uWetK, uExpoK, uHemi, uTreeLine)'))
  assert.ok(TERRAIN.includes('natVoile(natHNormRef(hNorm, uHNormRefA, uHNormRefB), fd, uHazeAmt, uHazeAlt, uHazeDist)'))
  // ⛔ et plus aucun lecteur sur le domaine vivant
  assert.ok(!/natVoile\(hNorm(?:Relief)?,/.test(GLOBE + TERRAIN), 'un voile lit encore le domaine vivant')
  assert.ok(!/natHumiditeY\(anl\.b, anl\.a, hNorm(?:Relief)?,/.test(GLOBE + TERRAIN), 'une limite des arbres lit encore le domaine vivant')
  // ⚠️ le pivot de rampe, lui, NE passe PAS par là : GRA et RAMP le transposent
  // déjà en mètres, une seconde conversion le déplacerait deux fois
  assert.ok(GLOBE.includes('natRampT(hNormRelief, pivot, uHeightContrast)'))
  assert.ok(TERRAIN.includes('natRampT(hNorm, pivot, uHeightContrast)'))
})

test('④ la distance du voile porte le facteur, des deux côtés', () => {
  assert.ok(GLOBE.includes('float fd = clamp(length(qCrop) * uFdFacteur, 0.0, 1.0);'))
  assert.ok(TERRAIN.includes('float fd = clamp(length(vWorldPos.xz - uBlockOffset) / max(uSlabHalf, 1e-3) * uFdFacteur, 0.0, 1.0);'))
  // le globe le pose à côté de uCropDemiM — le MÊME nombre, une seule source
  assert.match(GLOBE, /u\.uCropDemiM\.value = demiSolM[\s\S]{0,600}u\.uFdFacteur\.value = facteurDistanceVoile\(demiSolM\)/)
})

test('④ `_majGradeBloc` est l’écrivain UNIQUE des deux coefficients du globe — et il lit le domaine VIVANT', () => {
  const i = GLOBE.indexOf('  _majGradeBloc() {')
  const corps = GLOBE.slice(i, GLOBE.indexOf('\n  }\n', i))
  assert.match(corps, /facteursHNormRef\(/)
  assert.match(corps, /basM: u\.uReliefBas\.value, ampM: u\.uLandMax\.value - u\.uReliefBas\.value/)
  assert.match(corps, /u\.uHNormRefA\.value = f\.a/)
  assert.match(corps, /u\.uHNormRefB\.value = f\.b/)
  // deux écritures de uHNormRefA dans globe.js : l'écrivain, et le repos de retirerHabillage
  const ecritures = GLOBE.match(/u\.uHNormRefA\.value\s*=/g) || []
  assert.equal(ecritures.length, 2, `${ecritures.length} écritures de uHNormRefA — une de plus est un second écrivain`)
  // et retirerHabillage rend l'identité
  const j = GLOBE.indexOf('  retirerHabillage() {')
  const fin = GLOBE.slice(j, GLOBE.indexOf('\n  }\n', j))
  assert.match(fin, /u\.uHNormRefA\.value = 1/)
  assert.match(fin, /u\.uHNormRefB\.value = 0/)
  assert.match(fin, /u\.uFdFacteur\.value = 1/)
})

test('④ la référence traverse `contexteCrop` et la veille la surveille', () => {
  const i = MAIN.indexOf('function contexteCrop()')
  const bloc = MAIN.slice(i, MAIN.indexOf('\n}\n', i))
  assert.match(bloc, /refBasM: domaineRef\(\)\?\.basM \?\? null/)
  assert.match(bloc, /refAmpM: domaineRef\(\)\?\.ampM \?\? null/)
  for (const champ of ['refBasM', 'refAmpM']) assert.ok(CHAMPS_HABILLAGE.includes(champ), `${champ} n'est pas surveillé`)
  // et poserHabillage les range dans _gradeSocle, que _majGradeBloc lit
  assert.match(GLOBE, /refBasM: Number\.isFinite\(refBasM\) \? refBasM : null/)
  assert.match(GLOBE, /refAmpM: Number\.isFinite\(refAmpM\) \? refAmpM : null/)
})

test('④ le socle pose les trois uniformes dans `appliqueRampeFixe` — et les diffuse aux dalles voisines', () => {
  const i = MAIN.indexOf('function appliqueRampeFixe()')
  const corps = MAIN.slice(i, MAIN.indexOf('\n}\n', i))
  assert.match(corps, /const f = facteursHNormRef\(domaineRef\(\), domaineVivant\(\)\)/)
  assert.match(corps, /facteurDistanceVoile\([^)]*dem\.extentMeters \/ 2/)
  assert.match(corps, /terrain\.mapUniforms\.uHNormRefA\.value = f\.a/)
  assert.match(corps, /terrain\.mapUniforms\.uHNormRefB\.value = f\.b/)
  assert.match(corps, /terrain\.mapUniforms\.uFdFacteur\.value = fd/)
  // ⚠️ le test d'égalité couvre AUSSI les trois neufs : sinon un cran qui ne
  // change que la conversion (pas le pivot) ne reposerait rien
  assert.match(corps, /uHNormRefA\.value === f\.a/)
  assert.match(corps, /uFdFacteur\.value === fd/)
  assert.match(corps, /blockGrid\?\.diffuseDuCentre\(\)/)
  // et la copie vers les voisines
  assert.match(GRILLE, /um\.uHNormRefA\.value = uc\.uHNormRefA\.value/)
  assert.match(GRILLE, /um\.uHNormRefB\.value = uc\.uHNormRefB\.value/)
  assert.match(GRILLE, /um\.uFdFacteur\.value = uc\.uFdFacteur\.value/)
})

// ══════════ ⑤ LA RÉFÉRENCE EST CENTRÉE SUR LE LIEU, PAS SUR LE MNT ═════════
//
// Relevé (`scratchpad/sonde-ref.mjs`, Provence) : le bloc central est aligné
// sur les tuiles, son centre est à 20 km du lieu à z9, et la référence de RAMP
// valait [444 ; 2 103] m à z9 contre [362 ; 1 823] m à z11. Le voile d'altitude
// hérite de cet écart : c'est le résidu que `diag-bla-loi.mjs` a montré entre
// z9 et z11 avant ce recentrage.

test('⑤ le carré glisse vers le lieu, et s’écrête dans le MNT au lieu d’en sortir', async () => {
  const { fenetreRef, centrerFenetreRef, statsFenetre } = await import('../src/rampe-fixe.js')
  const n = 1536
  const fen = fenetreRef(n, 168341) // z9 : n1 = 365 texels
  assert.equal(fen.couvre, true)
  // centré sur le MNT : identique à `fenetreRef`
  const c = centrerFenetreRef(fen, n, 0.5, 0.5)
  assert.equal(c.ix0, fen.i0); assert.equal(c.iy0, fen.i0); assert.equal(c.glissePx, 0)
  // le lieu à 20 km à l'ouest et 15 km au sud du centre du MNT (z9 : 110 m/texel)
  const d = centrerFenetreRef(fen, n, 0.5 - 20000 / 168341, 0.5 + 15000 / 168341)
  assert.ok(d.ix0 < fen.i0 - 150 && d.iy0 > fen.i0 + 100, `le carré n'a pas suivi le lieu (${d.ix0}, ${d.iy0})`)
  assert.equal(d.glissePx, 0)
  // le lieu au bord : le carré glisse jusqu'au bord, jamais dehors
  const e = centrerFenetreRef(fen, n, 0.02, 0.99)
  assert.equal(e.ix0, 0); assert.equal(e.iy0, n - fen.n1)
  assert.ok(e.glissePx > 0)
  // un MNT plus petit que le carré : rien ne bouge (le MNT entier)
  const f = centrerFenetreRef(fenetreRef(n, 10521), n, 0.1, 0.9)
  assert.equal(f.couvre, false); assert.equal(f.n1, n); assert.equal(f.ix0, 0)
  // et `statsFenetre` lit bien la fenêtre DÉCALÉE : un pic posé hors du carré
  // centré mais dans le carré décalé est vu par l'un et pas par l'autre
  const data = new Float32Array(n * n).fill(100)
  data[(d.iy0 + 10) * n + (d.ix0 + 10)] = 3000 // dans le carré décalé, hors du centré (182 texels à l'ouest)
  assert.equal(statsFenetre(data, n, d).maxM, 3000)
  assert.equal(statsFenetre(data, n, fen).maxM, 100)
})

test('⑤ `main.js` centre la référence sur `dem.lat / dem.lon` par `latLonToWorld`', () => {
  const i = MAIN.indexOf('function majRampeRef()')
  const corps = MAIN.slice(i, MAIN.indexOf('\n}\n', i))
  assert.match(corps, /const centre = latLonToWorld\(dem, dem\.lat, dem\.lon\)/)
  assert.match(corps, /centrerFenetreRef\(fen0, n, centre\.x \/ span \+ 0\.5, centre\.z \/ span \+ 0\.5\)/)
  assert.match(corps, /statsFenetre\(dem\.data, n, fen\)/)
})
