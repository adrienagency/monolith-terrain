// LA LOI DE TEXTURE ANCRÉE AU MONDE — Tâche K du plan « LE STUDIO SUR LE GLOBE »
// (`docs/superpowers/plans/2026-08-22-globe-studio.md`).
//
// ══════════ CE QUE CE FICHIER GARDE ════════════════════════════════════════
//
//   ① LA LOI PURE — le facteur « mètres de sol par pixel d'écran » ne dépend QUE
//      de la distance, du fov et de la hauteur du cadre ; il est linéaire en
//      distance, et il rend 0 (donc « loi non posée ») sur toute entrée absurde.
//   ② LA RÉSOLUTION DE RÉFÉRENCE est une propriété du MONDE — elle se dérive de
//      `ZOOM_SOCLE` et de la circonférence du dépôt, jamais d'une tuile.
//   ③ LE GRAIN — sa coordonnée est CONTINUE (deux points voisins du sol rendent
//      deux coordonnées voisines), elle ne dépend d'AUCUNE grandeur de tuile, et
//      sa fréquence se dérive du 941,7 du dépôt au lieu d'être posée.
//   ④ LE NUANCEUR, EXTRAIT PUIS EXÉCUTÉ — les quatre affectations de `globe.js`
//      (`texelTuile`, `texelMonde`, `texel`, `grainX`, `grainY`) sont prises AU
//      TEXTE, traduites mécaniquement et APPELÉES. C'est le patron de
//      `test/estompage-terre.test.js` (⑤) : une mutation fait tomber une VALEUR,
//      pas une chaîne.
//   ⑤ L'ÉTEINT EST L'ANCIEN — `uMppFacteur` à 0 rend, sur les deux sites,
//      exactement l'expression du dépôt. C'est la garde que `uCropOn`, `uHabOn`
//      et `uMerRampeOn` portent déjà, et pour la même raison : la vue orbitale
//      en production ne doit pas bouger.
//   ⑥ LE BRANCHEMENT — `poserLoiMonde` / `retirerLoiMonde` sont EXERCÉES sur un
//      globe minimal, et le texte de `main.js` est vérifié (aucun test de ce
//      dépôt ne charge `main.js`, §0 du plan) : la loi est appelée par image,
//      sous drapeau, avec le fov LU EN DIRECT et la hauteur du TAMPON DE DESSIN.
//
// ⚠️ **CE QUE CE FICHIER NE PEUT PAS TESTER** : que le GPU exécute bien ce
// texte, et que l'image qui en sort ferme les arêtes. Seul l'écran le dit —
// l'Étape 4 de la tâche et son compte rendu (`rapport-K.md`, captures dans
// `.banc/vues-K/`) sont là pour ça.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// ⚠️ **`new Globe()` NE TIENT PAS SOUS NODE SANS CE POSTICHE** : `rebuildRamp`
// appelle `document.createElement('canvas')` au constructeur. C'est le patron de
// `test/damier-cadre.test.js`. Le posticher plutôt que d'emprunter la méthode au
// prototype est ici INDISPENSABLE : ce qu'on veut vérifier, c'est justement que
// `_materialFor` — une fermeture d'instance, pas une méthode de prototype —
// étale les MÊMES objets d'uniforme dans chaque matériau.
globalThis.document = {
  createElement: () => ({
    width: 0,
    height: 0,
    getContext: () => ({
      createLinearGradient: () => ({ addColorStop() {} }),
      fillRect() {},
      set fillStyle(_v) {},
    }),
  }),
}
const { Globe } = await import('../src/globe.js')
import {
  GRAIN_CELLULES_PAR_TUILE,
  GRAIN_PAR_PIXEL,
  METRES_PAR_DEGRE,
  TUILE_REF_PX,
  coordonneeGrain,
  facteurMppParUnite,
  loiTextureMonde,
  resolutionRefM,
} from '../src/monde/loi-texture-monde.js'
import { CIRCONFERENCE_M } from '../src/monde/habillage-crop.js'
import { ZOOM_SOCLE } from '../src/monde/seuil-socle.js'
import { ORBITAL_M_PER_UNIT } from '../src/geo.js'

const SRC_GLOBE = new URL('../src/globe.js', import.meta.url)
const SRC_MAIN = new URL('../src/main.js', import.meta.url)
const SRC_MODULE = new URL('../src/monde/loi-texture-monde.js', import.meta.url)
const GLOBE = readFileSync(SRC_GLOBE, 'utf8')
const MAIN = readFileSync(SRC_MAIN, 'utf8')

// ══════════ ① LA LOI PURE ══════════════════════════════════════════════════

test('①a le facteur est la trigonométrie de la perspective, rejouée', () => {
  // hauteur vue à la distance d : 2 d tan(fov/2) ; répartie sur hauteurPx.
  for (const fovDeg of [20, 30, 33, 60, 90]) {
    for (const hauteurPx of [256, 731, 860, 2160]) {
      const attendu = ((2 * Math.tan((fovDeg * Math.PI) / 360)) / hauteurPx) * ORBITAL_M_PER_UNIT
      assert.ok(
        Math.abs(facteurMppParUnite({ fovDeg, hauteurPx }) - attendu) < 1e-12,
        `fov ${fovDeg}, hauteur ${hauteurPx}`
      )
    }
  }
})

test('①b LINÉAIRE EN DISTANCE — deux fois plus loin, deux fois plus de sol par pixel', () => {
  // ⚠️ MUTATION VISÉE : mettre le facteur au carré, ou l'inverser. Les deux
  // passent une comparaison de signe et tombent ici.
  const f = facteurMppParUnite({ fovDeg: 33, hauteurPx: 731 })
  assert.ok(Math.abs(2 * f * 3 - f * 6) < 1e-9)
  assert.ok(f > 0)
})

test('①c LA HAUTEUR DIVISE, LE FOV MULTIPLIE — un écran plus haut résout MIEUX', () => {
  const bas = facteurMppParUnite({ fovDeg: 33, hauteurPx: 400 })
  const haut = facteurMppParUnite({ fovDeg: 33, hauteurPx: 800 })
  assert.ok(haut < bas, 'doubler la hauteur du cadre doit HALVER les mètres par pixel')
  assert.ok(Math.abs(haut * 2 - bas) < 1e-12)
  const etroit = facteurMppParUnite({ fovDeg: 20, hauteurPx: 731 })
  const large = facteurMppParUnite({ fovDeg: 60, hauteurPx: 731 })
  assert.ok(large > etroit, 'un champ plus large voit plus de sol par pixel')
})

test('①d TOUTE ENTRÉE ABSURDE REND 0 — et 0 veut dire « loi non posée »', () => {
  // ⚠️ Ce n'est pas de la coquetterie : un NaN dans `uMppFacteur` ferait
  // basculer CHAQUE fragment sur la branche monde avec une échelle absurde —
  // un écran noir sans un mot d'erreur.
  const mauvais = [
    { fovDeg: 0, hauteurPx: 731 },
    { fovDeg: 180, hauteurPx: 731 },
    { fovDeg: NaN, hauteurPx: 731 },
    { fovDeg: -33, hauteurPx: 731 },
    { fovDeg: 33, hauteurPx: 0 },
    { fovDeg: 33, hauteurPx: NaN },
    { fovDeg: 33, hauteurPx: -10 },
    { fovDeg: 33, hauteurPx: 731, metresParUnite: 0 },
    {},
  ]
  for (const o of mauvais) assert.equal(facteurMppParUnite(o), 0, JSON.stringify(o))
  for (const o of mauvais) assert.equal(loiTextureMonde(o), null, JSON.stringify(o))
})

test('①e AUCUN FOV PAR DÉFAUT DANS LE MODULE — il le reçoit, il ne le devine pas', () => {
  // ⚠️ §0 du plan : le code dit `FOV_DEG = 30`, l'application vivante tourne à
  // **33** parce qu'un template repose `params.fov`. Deux fautes critiques ont
  // déjà été payées là-dessus. Un fov écrit ici serait la troisième.
  const code = readFileSync(SRC_MODULE, 'utf8').replace(/\/\/[^\n]*/g, ' ')
  assert.ok(!/FOV/.test(code), 'le module connaît un FOV — il doit le recevoir')
  assert.ok(!/\bfovDeg\s*=\s*\d/.test(code), 'un fov par défaut est écrit dans le module')
})

// ══════════ ② LA RÉSOLUTION DE RÉFÉRENCE ═══════════════════════════════════

test('②a elle se dérive de ZOOM_SOCLE et de la circonférence du dépôt', () => {
  for (const lat of [0, -21.115, 45, 60, -80]) {
    const attendu = (CIRCONFERENCE_M * Math.cos((lat * Math.PI) / 180)) / (2 ** ZOOM_SOCLE * TUILE_REF_PX)
    assert.ok(Math.abs(resolutionRefM({ lat }) - attendu) < 1e-9, `lat ${lat}`)
  }
})

test('②b LA CIRCONFÉRENCE N’EST PAS RÉÉCRITE — elle vient d’`habillage-crop.js`', () => {
  // ⚠️ Le dépôt porte 40 075 016,686 (WGS84, le pavage Web-Mercator). Une
  // seconde écriture — par exemple 2π × EARTH_RADIUS_M, qui vaut 0,11 % de
  // moins — divergerait dès le premier chiffre.
  const code = readFileSync(SRC_MODULE, 'utf8').replace(/\/\/[^\n]*/g, ' ')
  assert.ok(!/40\s?075/.test(code), 'la circonférence est recopiée dans le module')
  assert.ok(/from '\.\/habillage-crop\.js'/.test(code), 'elle doit être importée')
  assert.equal(CIRCONFERENCE_M, 40075016.686)
})

test('②c c’est une propriété du MONDE — elle ignore la tuile courante', () => {
  // ⚠️ C'EST LE COEUR DE LA TÂCHE. `uTilePx` vaut 256 ou 512 SELON LA TUILE, et
  // c'est ce « selon » qui fabrique l'arête droite. La référence, elle, ne
  // change pas d'une tuile à l'autre : à latitude égale, même valeur.
  const a = resolutionRefM({ lat: -21.115 })
  const b = resolutionRefM({ lat: -21.115 })
  assert.equal(a, b)
  // et un zoom plus profond donne bien une donnée plus fine, d'un facteur DEUX
  assert.ok(Math.abs(resolutionRefM({ lat: 0, zoom: 12 }) / resolutionRefM({ lat: 0, zoom: 13 }) - 2) < 1e-12)
})

test('②d entrées absurdes : 0, jamais un NaN', () => {
  for (const o of [{ lat: NaN }, { lat: 0, zoom: -1 }, { lat: 0, tuilePx: 0 }, { lat: Infinity }]) {
    assert.equal(resolutionRefM(o), 0, JSON.stringify(o))
  }
})

// ══════════ ③ LE GRAIN ═════════════════════════════════════════════════════

test('③a la fréquence SE DÉRIVE du 941,7 du dépôt — elle n’est pas posée', () => {
  assert.equal(GRAIN_CELLULES_PAR_TUILE, 941.7)
  assert.equal(TUILE_REF_PX, 256)
  assert.equal(GRAIN_PAR_PIXEL, 941.7 / 256)
  assert.ok(Math.abs(GRAIN_PAR_PIXEL - 3.678515625) < 1e-12)
})

test('③b CONTINU au passage d’une frontière de tuiles — c’est la propriété demandée', () => {
  // ⚠️ Deux points distants d'un dixième de mètre de part et d'autre d'un bord
  // de tuile z13 doivent rendre des coordonnées de grain distantes de la même
  // fraction de cellule. Avec `vUv`, l'une valait 0 et l'autre 1 : un saut de
  // 941,7 cellules — c'est-à-dire un grain qui change de taille d'un coup.
  const mpp = 20
  const bordLon = (360 * 4321) / 2 ** 13 - 180 // un bord de tuile z13, exactement
  const eps = 1e-6 // ~0,1 m en longitude
  const a = coordonneeGrain({ lat: -21.115, lon: bordLon - eps, mppEcran: mpp })
  const b = coordonneeGrain({ lat: -21.115, lon: bordLon + eps, mppEcran: mpp })
  const saut = Math.hypot(a[0] - b[0], a[1] - b[1])
  assert.ok(saut < 0.1, `saut de grain au bord de tuile : ${saut} cellule(s)`)
  // le témoin : ce que la loi du dépôt faisait au MÊME endroit — vUv y passe de
  // 1 à 0, donc 941,7 cellules d'un bord à l'autre.
  assert.ok(GRAIN_CELLULES_PAR_TUILE > 100 * 0.1, 'le témoin ne distingue plus rien')
})

test('③c la coordonnée ne dépend d’AUCUNE grandeur de tuile', () => {
  const code = readFileSync(SRC_MODULE, 'utf8').replace(/\/\/[^\n]*/g, ' ')
  for (const interdit of ['vUv', 'uTilePx', 'tileKey', 'uTex']) {
    assert.ok(!code.includes(interdit), `le module lit \`${interdit}\` — la loi redeviendrait locale`)
  }
})

test('③d le grain SUIT L’ÉCHELLE : deux fois plus de sol par pixel, deux fois moins de cellules', () => {
  // ⚠️ MUTATION VISÉE : multiplier au lieu de diviser par `mppEcran`. Le grain
  // deviendrait alors géant de près et invisible de loin — l'inverse exact.
  const a = coordonneeGrain({ lat: 10, lon: 20, mppEcran: 10 })
  const b = coordonneeGrain({ lat: 10, lon: 20, mppEcran: 20 })
  assert.ok(Math.abs(a[0] - 2 * b[0]) < 1e-9)
  assert.ok(Math.abs(a[1] - 2 * b[1]) < 1e-9)
})

test('③e le `cos(lat)` est là — sinon le grain s’étire en bandes aux hautes latitudes', () => {
  // à latitude 60°, un degré de longitude vaut la MOITIÉ d'un degré de latitude
  const g = coordonneeGrain({ lat: 60, lon: 1, mppEcran: 10 })
  const h = coordonneeGrain({ lat: 60, lon: 2, mppEcran: 10 })
  const parDegreLon = h[0] - g[0]
  const parDegreLat = coordonneeGrain({ lat: 61, lon: 1, mppEcran: 10 })[1] - g[1]
  assert.ok(Math.abs(parDegreLon / parDegreLat - Math.cos((60 * Math.PI) / 180)) < 1e-9)
})

test('③f `mppEcran` nul ne fabrique pas un infini', () => {
  for (const mppEcran of [0, -1, 1e-9]) {
    const g = coordonneeGrain({ lat: -21, lon: 55, mppEcran })
    assert.ok(Number.isFinite(g[0]) && Number.isFinite(g[1]), `mpp ${mppEcran}`)
  }
})

// ══════════ ④ LE NUANCEUR, EXTRAIT PUIS EXÉCUTÉ ════════════════════════════
//
// ⚠️ **PAS UN GREP DE NOM.** On prend le TEXTE du GLSL, on le traduit
// mécaniquement en JS et on l'APPELLE. C'est la leçon du Tour 1 de la Tâche C
// (« une mutation doit changer le COMPORTEMENT, pas la CHAÎNE ») et la leçon de
// la Tâche J bis, qui n'a atteint 36/36 qu'au troisième tour parce que ses
// tests de BRANCHEMENT manquaient tous.

/** L'affectation `float <nom> = … ;` du nuanceur, prise au texte. */
function affectation(nom) {
  const i = GLOBE.indexOf(`float ${nom} = `)
  assert.ok(i >= 0, `le nuanceur doit porter « float ${nom} = »`)
  const j = GLOBE.indexOf(';', i)
  assert.ok(j > i, `« float ${nom} » sans point-virgule`)
  return GLOBE.slice(i + `float ${nom} = `.length, j)
}

/** Une expression GLSL scalaire, rendue exécutable. */
function loi(expr, noms) {
  const js = expr
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/\s+/g, ' ')
    // `vLatLon.y` n'est pas un identifiant JS : on l'aplatit en `vLatLon_y`,
    // c'est la SEULE réécriture de nom, et elle ne change aucune opération.
    .replace(/\bvLatLon\.([xy])\b/g, 'vLatLon_$1')
    .replace(/\bmax\s*\(/g, 'Math.max(')
    .replace(/\bmin\s*\(/g, 'Math.min(')
    .replace(/\bcos\s*\(/g, 'Math.cos(')
    .replace(/\bclamp\s*\(/g, 'CLAMP(')
    .replace(/\bradians\s*\(/g, 'RADIANS(')
    .trim()
  const CLAMP = (v, a, b) => Math.min(b, Math.max(a, v))
  const RADIANS = (d) => (d * Math.PI) / 180
  // eslint-disable-next-line no-new-func
  const f = new Function(...noms, 'CLAMP', 'RADIANS', `return (${js});`)
  return (args) => f(...noms.map((n) => args[n]), CLAMP, RADIANS)
}

test('④a `texel` bascule sur `uMppFacteur`, et l’ÉTEINT est la loi du dépôt', () => {
  const f = loi(affectation('texel'), ['uMppFacteur', 'texelMonde', 'texelTuile'])
  assert.equal(f({ uMppFacteur: 0, texelMonde: 7, texelTuile: 3 }), 3, 'éteint, ce doit être la loi de tuile')
  assert.equal(f({ uMppFacteur: 51.6, texelMonde: 7, texelTuile: 3 }), 7, 'posée, ce doit être la loi de monde')
})

test('④b `texelMonde` est bien « mètres par pixel / résolution de référence »', () => {
  const f = loi(affectation('texelMonde'), ['mppEcran', 'uResRefM'])
  for (const [mpp, res] of [[20, 17.8], [5, 17.8], [100, 4.5], [1, 1]]) {
    assert.ok(Math.abs(f({ mppEcran: mpp, uResRefM: res }) - mpp / res) < 1e-12, `${mpp}/${res}`)
  }
  // ⚠️ et la garde de division : une résolution nulle ne rend pas un infini
  assert.ok(Number.isFinite(f({ mppEcran: 20, uResRefM: 0 })))
})

test('④c `mppEcran` est le produit profondeur × facteur — rien d’autre', () => {
  const f = loi(affectation('mppEcran'), ['vProfCam', 'uMppFacteur'])
  for (const d of [0.1, 0.4, 3, 100]) {
    assert.ok(Math.abs(f({ vProfCam: d, uMppFacteur: 43.888 }) - d * 43.888) < 1e-9, `d ${d}`)
  }
})

test('④c-bis le nuanceur de SOMMETS rend la PROFONDEUR, pas la longueur du vecteur', () => {
  // ⚠️ **CETTE MUTATION A SURVÉCU AU PREMIER TOUR** (`.banc/mutations-K.mjs`,
  // M25) : `length(mv.xyz)` passe tous les tests de loi pure, et se trompe
  // pourtant. Un pixel couvre `2 z tan(fov/2) / hauteurPx` d'un plan
  // perpendiculaire à l'axe de vue : la grandeur exacte est la PROFONDEUR.
  // `length` surestime de 1/cos(θ) sur les bords — jusqu'à +8 % au coin à
  // fov 33 — donc la loi varierait avec la POSITION À L'ÉCRAN. Le départage se
  // fait sur un point HORS AXE : sur l'axe les deux écritures coïncident, et un
  // test posé là n'aurait rien distingué.
  const i = GLOBE.indexOf('vProfCam = ')
  assert.ok(i > 0, 'le nuanceur de sommets ne pose plus vProfCam')
  const expr = GLOBE.slice(i + 'vProfCam = '.length, GLOBE.indexOf(';', i))
  const js = expr.replace(/\bmv\.xyz\b/g, '[mv.x, mv.y, mv.z]').replace(/\blength\s*\(/g, 'LEN(')
  // eslint-disable-next-line no-new-func
  const f = new Function('mv', 'LEN', `return (${js});`)
  const LEN = (v) => Math.hypot(v[0], v[1], v[2])
  assert.ok(Math.abs(f({ x: 0, y: 0, z: -100 }, LEN) - 100) < 1e-9, 'sur l’axe, la profondeur vaut 100')
  const horsAxe = f({ x: 30, y: 20, z: -100 }, LEN)
  assert.ok(Math.abs(horsAxe - 100) < 1e-9, `hors axe, la loi rend ${horsAxe} au lieu de 100`)
  // le témoin : ce que `length` aurait rendu au même endroit — il distingue bien
  assert.ok(Math.abs(LEN([30, 20, -100]) - 100) > 5, 'le témoin ne distingue plus rien')
})

test('④d `minFade` garde la courbe du dépôt : 1 près, 0 loin, et le genou à 1,09', () => {
  // ⚠️ La courbe ne change pas — seule son ENTRÉE change. Une mutation qui
  // toucherait 1.6 ou 0.55 déplacerait le fondu de moitié.
  const f = loi(affectation('minFade'), ['texel'])
  assert.equal(f({ texel: 0 }), 1)
  assert.ok(Math.abs(f({ texel: 1.5 }) - (1.6 - 1.5 * 0.55)) < 1e-12)
  assert.equal(f({ texel: 1.6 / 0.55 }), 0)
  assert.equal(f({ texel: 100 }), 0)
  // le genou (là où le fondu s'amorce) : texel = 0,6/0,55 = 1,0909…
  assert.ok(Math.abs(f({ texel: 0.6 / 0.55 }) - 1) < 1e-12)
  assert.ok(f({ texel: 1.2 }) < 1)
})

test('④e `grainX` / `grainY` du GLSL sont le JUMEAU EXACT de `coordonneeGrain`', () => {
  // ⚠️ **C'EST LE TEST DE TRANSCRIPTION.** Le GLSL et le JS sont deux écritures
  // de la même loi ; deux écritures jumelles finissent par diverger (terrain.js
  // porte déjà cette cicatrice). Ici elles sont confrontées sur une grille.
  const fx = loi(affectation('grainX'), ['vLatLon_x', 'vLatLon_y', 'uMetresParDegre', 'mppEcran', 'uGrainParPixel'])
  const fy = loi(affectation('grainY'), ['vLatLon_x', 'uMetresParDegre', 'mppEcran', 'uGrainParPixel'])
  // ⚠️ ET LES DEUX COMPOSANTES NE SONT PAS INTERCHANGEABLES : `vLatLon.x` est la
  // LATITUDE, `vLatLon.y` la LONGITUDE (convention de `globe.js`, posée par
  // l'attribut `latlon`). Les échanger étirerait le grain à l'envers.
  assert.ok(affectation('grainX').includes('vLatLon.y'), 'grainX doit lire la LONGITUDE')
  assert.ok(affectation('grainY').includes('vLatLon.x'), 'grainY doit lire la LATITUDE')
  for (const lat of [-60, -21.115, 0, 33.7, 70]) {
    for (const lon of [-179.5, -55, 0, 55.536, 179.9]) {
      for (const mppEcran of [0.5, 20, 300, 12000]) {
        const attendu = coordonneeGrain({ lat, lon, mppEcran })
        const args = {
          vLatLon_x: lat,
          vLatLon_y: lon,
          uMetresParDegre: METRES_PAR_DEGRE,
          mppEcran,
          uGrainParPixel: GRAIN_PAR_PIXEL,
        }
        const gx = fx(args)
        const gy = fy(args)
        const ech = Math.max(1, Math.abs(attendu[0]), Math.abs(attendu[1]))
        assert.ok(Math.abs(gx - attendu[0]) < 1e-9 * ech, `x lat ${lat} lon ${lon} mpp ${mppEcran}`)
        assert.ok(Math.abs(gy - attendu[1]) < 1e-9 * ech, `y lat ${lat} lon ${lon} mpp ${mppEcran}`)
      }
    }
  }
})

test('④f `grainP` bascule sur `uMppFacteur`, et l’ÉTEINT est LE TEXTE DU DÉPÔT', () => {
  // ⚠️ **LA GARANTIE DE NON-RÉGRESSION DE LA PRODUCTION.** Sans `poserLoiMonde`,
  // le grain doit être exactement `vUv * 941.7 + vLatLon`, l'expression d'avant
  // la Tâche K. La vue orbitale de shibumap.com en dépend.
  const i = GLOBE.indexOf('vec2 grainP = ')
  assert.ok(i >= 0)
  const expr = GLOBE.slice(i + 'vec2 grainP = '.length, GLOBE.indexOf(';', i))
  assert.ok(/uMppFacteur\s*>\s*0\.0\s*\?/.test(expr), 'la bascule doit se faire sur uMppFacteur')
  assert.ok(/:\s*vUv\s*\*\s*941\.7\s*\+\s*vLatLon\s*$/.test(expr.trim()), `éteint ≠ dépôt : ${expr}`)
})

test('④g `texelTuile` est, LUI AUSSI, le texte du dépôt, intact', () => {
  const expr = affectation('texelTuile').replace(/\/\/[^\n]*/g, '').trim()
  assert.equal(expr, 'max(fwidth(vUv).x, fwidth(vUv).y) * uTilePx')
})

test('④h LES SIX AUTRES `fwidth` NE SONT PAS TOUCHÉS — l’audit de la tâche', () => {
  // ⚠️ Le nuanceur porte SEPT `fwidth`. Un seul était en espace-tuile de bout en
  // bout (`minFade`) ; les six autres mesurent des mètres, des degrés ou une
  // couverture de côte — des grandeurs de MONDE par pixel d'écran, donc des
  // largeurs de trait légitimes. Ce test fige le compte : si quelqu'un en ajoute
  // ou en retire un, la question se rouvre.
  const iFrag = GLOBE.indexOf('const FRAG')
  const frag = GLOBE.slice(iFrag, GLOBE.indexOf('\n`\n', iFrag))
  // ⚠️ **LES COMMENTAIRES SONT RETIRÉS D'ABORD** : ce fichier PARLE de `fwidth`
  // plusieurs fois. Compter les mentions au lieu des appels aurait fait un test
  // qui tombe sur une phrase — exactement la mutation de CHAÎNE qu'on refuse.
  const code = frag.replace(/\/\/[^\n]*/g, ' ')
  const appels = code.match(/fwidth\s*\(/g) || []
  const sites = code.split('\n').filter((l) => /fwidth\s*\(/.test(l))
  // SEPT sites, HUIT appels : `texelTuile` en porte deux (les deux composantes
  // de `fwidth(vUv)`), et c'est le seul.
  assert.equal(sites.length, 7, `le nuanceur porte ${sites.length} sites de fwidth, pas 7`)
  assert.equal(appels.length, 8, `le nuanceur porte ${appels.length} appels à fwidth, pas 8`)
  assert.equal(sites.filter((l) => (l.match(/fwidth\s*\(/g) || []).length === 2).length, 1)
  // et celui de la côte garde sa garde par UNIFORME — c'est ce qui rend sa
  // dérivée définie, et c'est pour ça qu'on ne l'a pas touché.
  const iCote = code.indexOf('fwidth(landness)')
  assert.ok(iCote > 0)
  const avant = code.slice(Math.max(0, iCote - 300), iCote)
  assert.ok(/uHabOn > 0\.5 && uCoastMaskOn > 0\.5/.test(avant), 'la garde de la côte doit rester un uniforme')
})

// ══════════ ⑤ LE BRANCHEMENT ═══════════════════════════════════════════════

function globeMinimal() {
  return new Globe({ radius: 100 })
}

test('⑤a `poserLoiMonde` écrit les quatre uniformes, et ils sont PARTAGÉS', () => {
  const g = globeMinimal()
  assert.equal(g.uniforms.uMppFacteur.value, 0, 'au repos, la loi est retirée')
  const ok = g.poserLoiMonde({ fovDeg: 33, hauteurPx: 731, lat: -21.115 })
  assert.equal(ok, true)
  const attendu = loiTextureMonde({ fovDeg: 33, hauteurPx: 731, lat: -21.115 })
  assert.equal(g.uniforms.uMppFacteur.value, attendu.mppFacteur)
  assert.equal(g.uniforms.uResRefM.value, attendu.resRefM)
  assert.equal(g.uniforms.uGrainParPixel.value, attendu.grainParPixel)
  assert.equal(g.uniforms.uMetresParDegre.value, attendu.metresParDegre)
})

test('⑤b `retirerLoiMonde` remet 0 — donc le dépôt, au bit près', () => {
  const g = globeMinimal()
  g.poserLoiMonde({ fovDeg: 33, hauteurPx: 731, lat: 0 })
  assert.ok(g.uniforms.uMppFacteur.value > 0)
  g.retirerLoiMonde()
  assert.equal(g.uniforms.uMppFacteur.value, 0)
})

test('⑤c une pose IMPOSSIBLE ne touche à RIEN et le dit', () => {
  // ⚠️ Un `NaN` posé ici basculerait chaque fragment sur la branche monde avec
  // une échelle absurde. La pose doit refuser, pas écrire à moitié.
  const g = globeMinimal()
  g.poserLoiMonde({ fovDeg: 33, hauteurPx: 731, lat: 0 })
  const avant = g.uniforms.uMppFacteur.value
  for (const o of [{ fovDeg: NaN, hauteurPx: 731 }, { fovDeg: 33, hauteurPx: 0 }, {}]) {
    assert.equal(g.poserLoiMonde(o), false, JSON.stringify(o))
    assert.equal(g.uniforms.uMppFacteur.value, avant, 'la pose refusée a quand même écrit')
  }
})

test('⑤d le matériau de tuile reçoit les uniformes PARTAGÉS, pas une copie', () => {
  // ⚠️ La leçon de `test/damier-uniformes.test.js` : une poignée cédée à une
  // variable n'atteint jamais les dalles voisines. Ici la loi est une propriété
  // du MONDE — si chaque tuile en gardait une copie, elle rementirait par tuile,
  // c'est-à-dire exactement le défaut que la tâche répare.
  const g = globeMinimal()
  const mat = g._materialFor(256)
  assert.equal(mat.uniforms.uMppFacteur, g.uniforms.uMppFacteur, 'uMppFacteur n’est pas partagé')
  assert.equal(mat.uniforms.uResRefM, g.uniforms.uResRefM)
  g.poserLoiMonde({ fovDeg: 33, hauteurPx: 731, lat: 12 })
  assert.ok(mat.uniforms.uMppFacteur.value > 0, 'la pose n’atteint pas le matériau')
  // et `uTex`/`uTilePx`, eux, restent PROPRES à la tuile — on ne les a pas cassés
  assert.notEqual(mat.uniforms.uTilePx, g.uniforms.uTilePx)
})

test('⑤e `main.js` appelle la loi PAR IMAGE, et avant `globe.update`', () => {
  // ⚠️ Aucun test de ce dépôt ne charge `main.js` (§0 du plan) : on en vérifie
  // le TEXTE, comme `test/crop-habillage.test.js` et `test/estompage-terre.test.js`.
  assert.ok(MAIN.includes('majLoiTextureMonde()'), 'la loi n’est appelée nulle part')
  const iAppel = MAIN.indexOf('  majLoiTextureMonde()')
  const iUpdate = MAIN.indexOf('globe.update(camGlobe, dtAmb)')
  assert.ok(iAppel > 0 && iUpdate > iAppel, 'la loi doit être posée AVANT le dessin du globe')
})

test('⑤f le fov est LU EN DIRECT sur la caméra, jamais écrit en dur', () => {
  const i = MAIN.indexOf('function majLoiTextureMonde()')
  assert.ok(i > 0)
  const corps = MAIN.slice(i, MAIN.indexOf('\n}', i))
  assert.ok(/fovDeg:\s*cam\?\.fov\s*\?\?\s*camera\.fov/.test(corps), `le fov n’est pas lu en direct : ${corps}`)
  assert.ok(!/fovDeg:\s*\d/.test(corps), 'un fov en dur dans le branchement')
  assert.ok(!/FOV_DEG/.test(corps), 'le branchement lit la constante au lieu de la caméra vivante')
})

test('⑤g la hauteur est celle du TAMPON DE DESSIN, pas du CSS', () => {
  // ⚠️ Sur un écran Retina le tampon fait deux fois la hauteur en points.
  // `clientHeight` doublerait les mètres par pixel et effacerait les courbes de
  // niveau sur les seules machines à forte densité.
  const i = MAIN.indexOf('function majLoiTextureMonde()')
  const corps = MAIN.slice(i, MAIN.indexOf('\n}', i))
  assert.ok(/getDrawingBufferSize/.test(corps), 'la hauteur ne vient pas du tampon de dessin')
  assert.ok(!/clientHeight|innerHeight/.test(corps))
})

test('⑤g bis C’EST LA HAUTEUR DU TAMPON, PAS SA LARGEUR', () => {
  // ⚠️ **MUTATION SURVIVANTE TROUVÉE PAR LA RELECTURE K, HORS `.banc/mutations-K.mjs`** :
  // `hauteurPx: _tailleDessin.y` → `_tailleDessin.x` (la LARGEUR) survivait aux
  // 33/33 tests d'alors, parce qu'aucun ne vérifiait QUEL axe du tampon est lu —
  // seulement que `getDrawingBufferSize` est appelé (⑤g) et que le CSS ne
  // l'est pas. Sur un cadre non carré (le cas général), cette mutation
  // fausserait `mppEcran` d'un facteur largeur/hauteur, silencieusement.
  const i = MAIN.indexOf('function majLoiTextureMonde()')
  const corps = MAIN.slice(i, MAIN.indexOf('\n}', i))
  assert.ok(
    /hauteurPx:\s*_tailleDessin\.y\b/.test(corps),
    `la hauteur ne vient pas de \`_tailleDessin.y\` : ${corps}`,
  )
  assert.ok(
    !/hauteurPx:\s*_tailleDessin\.x\b/.test(corps),
    'la hauteur lit la LARGEUR du tampon de dessin',
  )
})

test('⑤g ter LA LATITUDE DE L’ANCRE EST TRANSMISE, JAMAIS FORCÉE À L’ÉQUATEUR', () => {
  // ⚠️ **DEUXIÈME MUTATION SURVIVANTE DE LA RELECTURE K** : `lat:
  // Number.isFinite(ancre?.lat) ? ancre.lat : 0` → `lat: 0` (toujours
  // l'équateur) survivait aux 33/33 tests d'alors — aucun ne vérifiait que
  // `ancre.lat` est effectivement lu. Le `cos(lat)` de `resolutionRefM`
  // deviendrait silencieusement faux à toute latitude non nulle (La Réunion,
  // −21,115° comprise).
  const i = MAIN.indexOf('function majLoiTextureMonde()')
  const corps = MAIN.slice(i, MAIN.indexOf('\n}', i))
  assert.ok(
    /lat:\s*Number\.isFinite\(ancre\?\.lat\)\s*\?\s*ancre\.lat\s*:\s*0/.test(corps),
    `la latitude n'est pas lue sur l'ancre en direct : ${corps}`,
  )
  assert.ok(!/lat:\s*0\s*[,}]/.test(corps.replace(/lat:\s*Number\.isFinite\(ancre\?\.lat\)\s*\?\s*ancre\.lat\s*:\s*0/, '')),
    'une seconde écriture force la latitude à 0 ailleurs dans le branchement')
})

test('⑤h HORS DRAPEAU, la loi est RETIRÉE — la production ne bouge pas', () => {
  const i = MAIN.indexOf('function majLoiTextureMonde()')
  const corps = MAIN.slice(i, MAIN.indexOf('\n}', i))
  assert.ok(
    /if \(!terreUniqueBranchee\) \{ globe\.retirerLoiMonde\(\); return \}/.test(corps),
    `le garde de drapeau manque ou a changé : ${corps}`
  )
})

test('⑤i aucun échafaudage de banc n’est resté dans le nuanceur', () => {
  // ⚠️ L'Étape 1 a posé quatre uniformes de mesure (`uKminFade`, `uKgrain`,
  // `uKaa`, `uKcrowd`). Ils ont servi, ils sont partis. Ce test empêche qu'un
  // prochain tour les réintroduise en douce.
  for (const nom of ['uKminFade', 'uKgrain', 'uKaa', 'uKcrowd', 'BANC K']) {
    assert.ok(!GLOBE.includes(nom), `\`${nom}\` est resté dans src/globe.js`)
  }
})
