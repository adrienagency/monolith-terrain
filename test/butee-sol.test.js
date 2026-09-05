// LA BUTÉE QUI TIENT LA CAMÉRA AU-DESSUS DU SOL — Tâche R23.
//
// ⚠️ **CE FICHIER REJOUE UN DÉFAUT MESURÉ, PAS UN DÉFAUT IMAGINÉ.** Les cotes
// des §② et §③ viennent de `.banc/R23/avant.json` (Chrome sans tête, 1280×800,
// glissé poussé à la butée puis 360° d'azimut EN RESTANT à la butée) :
// **−11,7616 unités** de hauteur caméra − sol au Mont-Blanc sur **450 images de
// 505**, −11,8422 à l'Everest, −8,6115 au Cervin.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { polaireMaxSol, distanceMinSol, POLAIRE_MAX_DURE, MARGE_SOL_U, PAS_PARCOURS } from '../src/monde/butee-sol.js'
import { NEAR_MAX } from '../src/loi-altitude.js'

const D2R = Math.PI / 180
const R2D = 180 / Math.PI

// la position de la caméra pour un angle polaire, convention `OrbitControls`
const pose = (d, phi, az = 0, cx = 0, cy = 0, cz = 0) => ({
  x: cx + d * Math.sin(phi) * Math.sin(az),
  y: cy + d * Math.cos(phi),
  z: cz + d * Math.sin(phi) * Math.cos(az),
})

// ══════════ ① LE PLAFOND DUR N'A PAS BOUGÉ ══════════════════════════════════

test('① le plafond dur reste 88,2° — le nombre n’est pas perdu, il est déclassé', () => {
  assert.equal(POLAIRE_MAX_DURE, Math.PI * 0.49)
  assert.ok(Math.abs(POLAIRE_MAX_DURE * R2D - 88.2) < 1e-9)
})

test('① sur un sol plat au niveau de la cible, la loi rend le plafond dur', () => {
  // ⚠️ le cas le plus courant : la mer. La butée d'avant était JUSTE là — c'est
  // pour ça que le premier relevé, fait au lieu de départ (un plan d'eau), n'a
  // rien vu : hauteur minimale 0,148 u, zéro image sous le sol.
  const a = polaireMaxSol({ distance: 150, cibleY: -0.3, sol: () => -0.3 })
  assert.equal(a, POLAIRE_MAX_DURE)
})

test('① sans échantillonneur, on rend le plafond — jamais zéro', () => {
  // « le manque de mesure et la mesure d'un manque sont deux choses »
  assert.equal(polaireMaxSol({ distance: 150 }), POLAIRE_MAX_DURE)
  assert.equal(polaireMaxSol({ distance: 150, sol: null }), POLAIRE_MAX_DURE)
  // un échantillonneur qui rend n'importe quoi ne fabrique pas de butée
  assert.equal(polaireMaxSol({ distance: 150, sol: () => NaN }), POLAIRE_MAX_DURE)
  assert.equal(polaireMaxSol({ distance: 150, sol: () => undefined }), POLAIRE_MAX_DURE)
})

test('① une distance absente ou nulle ne fabrique pas de butée non plus', () => {
  assert.equal(polaireMaxSol({ distance: 0, sol: () => 99 }), POLAIRE_MAX_DURE)
  assert.equal(polaireMaxSol({ distance: NaN, sol: () => 99 }), POLAIRE_MAX_DURE)
})

// ══════════ ② LE DÉFAUT MESURÉ, REJOUÉ ══════════════════════════════════════

// Un relief de bloc, LISSE ET PARTOUT — et pas un pic isolé. Le premier jet de
// ce fichier posait une gaussienne unique : à `d = 150` la caméra sortait à
// 149,9 unités du centre, c'est-à-dire loin du pic, et le test « reproduisait »
// un défaut absent. ⚠️ **Le relief d'un bloc REMPLIT le bloc.** Amplitude 0 à
// 16 unités — au bloc z12 du Mont-Blanc, 365,2 m par unité, soit 5 845 m de
// relief DESSINÉ et 2 922 m de relief réel (exagération unique ×2).
// ⚠️ **LA CIBLE EST SUR LE SOL**, et le premier jet l'oubliait : `_arrivalPose`
// vise `Y_CIBLE = −0,3`, c'est-à-dire le terrain lui-même. Un relief qui vaut 8
// à l'origine enterre la cible et rend le cas `d = 6` insoluble par
// construction — un défaut du BANC, pas de la loi.
const _brut = (x, z) => 8 * Math.sin(x / 12) * Math.cos((z - 6) / 14)
const RELIEF = (x, z) => _brut(x, z) - _brut(0, 0) - 0.3

// le pire dégagement sur un TOUR COMPLET, à une distance et un angle donnés —
// c'est le geste que le banc a relevé (360° d'azimut en restant à la butée)
function pireDegagement(d, phi, cy = -0.3) {
  let pire = Infinity
  for (let i = 0; i < 72; i++) {
    const az = (i * 5) * D2R
    const p = pose(d, phi, az, 0, cy, 0)
    pire = Math.min(pire, p.y - RELIEF(p.x, p.z))
  }
  return pire
}

test('② la butée d’AVANT (88,2° en dur) enfonce la caméra sous le sol, et de beaucoup', () => {
  // ⚠️ **C'EST LE DÉFAUT, ÉCRIT COMME UN TEST.** À `d` quelconque et
  // `φ = 88,2°`, la caméra n'est qu'à `d × cos(88,2°) = 0,0314 d` au-dessus de
  // la cible — 4,71 unités à `d = 150`, 0,94 à `d = 30`.
  assert.ok(Math.abs(150 * Math.cos(POLAIRE_MAX_DURE) - 4.712) < 0.01)
  const releve = [6, 15, 30, 60, 100, 150].map((d) => [d, pireDegagement(d, POLAIRE_MAX_DURE)])
  for (const [d, h] of releve) {
    assert.ok(h < 0, `à d = ${d}, la caméra devrait passer sous le sol (lu ${h.toFixed(4)})`)
  }
  // ⚠️ **LE BANC RESTE LE JUGE, PAS CE MODÈLE.** Au navigateur, sur le vrai
  // relief : −11,7616 u (Mont-Blanc), −11,8422 (Everest), −8,6115 (Cervin). Ce
  // relief-ci, d'amplitude 16, en rend −6,9 : il montre le MÉCANISME, pas
  // l'amplitude. On exige donc l'ordre de grandeur, pas le chiffre du terrain.
  const pire = Math.min(...releve.map(([, h]) => h))
  assert.ok(pire < -5, `pire dégagement ${pire.toFixed(4)}, attendu sous −5`)
})

test('② la loi ramène la butée et la caméra repasse AU-DESSUS du sol', () => {
  // ⚠️ **ET LA BUTÉE NE SE RESSERRE PAS PARTOUT — c'est le signe qu'elle est
  // JUSTE.** Dans les azimuts où le relief est bas, `88,2°` était déjà correct
  // et la loi rend le plafond dur : elle ne dépense pas de course pour rien.
  let resserre = 0
  for (const d of [6, 15, 30, 60, 100, 150]) {
    for (let i = 0; i < 36; i++) {
      const az = (i * 10) * D2R
      const phi = polaireMaxSol({ distance: d, cibleY: -0.3, azimut: az, sol: RELIEF })
      if (phi < POLAIRE_MAX_DURE) resserre++
      const p = pose(d, phi, az, 0, -0.3, 0)
      assert.ok(p.y - RELIEF(p.x, p.z) >= MARGE_SOL_U - 1e-9, `à d = ${d}, az = ${i * 10}°, marge non tenue`)
    }
  }
  assert.ok(resserre > 0, 'la butée ne s’est resserrée nulle part')
  assert.ok(resserre < 6 * 36, 'la butée s’est resserrée PARTOUT — elle dépense de la course pour rien')
})

test('② la garantie porte sur TOUT le chemin, pas seulement sur son bout', () => {
  // ⚠️ un sommet EN COURS DE ROUTE ne se voit pas si on ne teste que l'arrivée :
  // c'est exactement la faute « un relevé sur une image ne prouve rien ».
  const phi = polaireMaxSol({ distance: 150, cibleY: -0.3, sol: RELIEF })
  for (let k = 0; k <= 200; k++) {
    const p = pose(150, (phi * k) / 200, 0, 0, -0.3, 0)
    const h = p.y - RELIEF(p.x, p.z)
    assert.ok(h >= MARGE_SOL_U - 1e-9, `à φ = ${((phi * k) / 200 * R2D).toFixed(2)}°, hauteur ${h.toFixed(4)}`)
  }
})

test('② la garantie tient à TOUTES les distances et à TOUS les azimuts', () => {
  // 360° d'azimut × 12 distances : c'est le geste que le banc a relevé, et c'est
  // sur 360° qu'il a trouvé 450 images sous le sol sur 505.
  let pire = Infinity
  for (let ia = 0; ia < 36; ia++) {
    const az = (ia * 10) * D2R
    for (const d of [6, 10, 15, 22, 30, 45, 60, 75, 90, 110, 130, 150]) {
      const phi = polaireMaxSol({ distance: d, cibleY: -0.3, azimut: az, sol: RELIEF })
      for (let k = 0; k <= 40; k++) {
        const p = pose(d, (phi * k) / 40, az, 0, -0.3, 0)
        pire = Math.min(pire, p.y - RELIEF(p.x, p.z))
      }
    }
  }
  assert.ok(pire >= MARGE_SOL_U - 1e-9, `hauteur minimale ${pire.toFixed(4)}, attendue ≥ ${MARGE_SOL_U}`)
})

// ══════════ ③ LA MARGE, ET D'OÙ ELLE VIENT ══════════════════════════════════

test('③ la marge dépasse le plan proche saturé — sinon le sol traverse la coupe', () => {
  // `planProche` sature à NEAR_MAX = 0,5 (`loi-altitude.js`). Une marge plus
  // petite laisserait le terrain passer devant le plan de coupe avant de
  // toucher la caméra : on verrait l'intérieur de la montagne sans être dedans.
  assert.ok(MARGE_SOL_U > NEAR_MAX, `marge ${MARGE_SOL_U} contre plan proche ${NEAR_MAX}`)
  assert.equal(MARGE_SOL_U, 2 * NEAR_MAX)
})

// ══════════ ④ LA BUTÉE NE DOIT PAS FABRIQUER UN NOUVEAU SAUT ════════════════

test('④ la butée varie continûment avec la distance — pas de claquement d’angle', () => {
  // ⚠️ **UNE BUTÉE QUI CLAQUE EST UN SAUT COMME UN AUTRE**, et la campagne vient
  // d'en supprimer. `OrbitControls` ramène `φ` sur `maxPolarAngle` à chaque
  // image : si la butée sautait quand la distance glisse, la vue sauterait avec.
  // Le glissé descend d'au plus un cran (×√2 ≈ 1,414) par image de repos ; on
  // prend un pas BIEN plus gros (×1,05 par image sur toute la course) et on
  // exige que le pas d'angle reste sous le plafond de R4 (1,5°/image).
  let pire = 0
  let d = 150
  let avant = polaireMaxSol({ distance: d, cibleY: -0.3, sol: RELIEF })
  while (d > 6) {
    d = Math.max(6, d / 1.05)
    const apres = polaireMaxSol({ distance: d, cibleY: -0.3, sol: RELIEF })
    pire = Math.max(pire, Math.abs(apres - avant) * R2D)
    avant = apres
  }
  assert.ok(pire <= 1.5, `pas d’angle maximal ${pire.toFixed(4)}°, plafond R4 1,5°`)
  // et le témoin : SANS l'affinage du dernier pas, la grille seule rendrait des
  // marches de 3,675° au moins — c'est ce que ce test attrape.
  assert.ok(pire < POLAIRE_MAX_DURE / PAS_PARCOURS * R2D, 'la butée avance encore par marches de grille')
})

test('④ la loi ne laisse pas de course sur la table : un poil plus loin, ça touche', () => {
  // ⚠️ **UNE BUTÉE TROP PRUDENTE SUPPRIMERAIT LA VUE DE TROIS QUARTS**, qui EST
  // le produit. La dichotomie rend l'angle à `88,2° / 2¹⁴` près : juste au-delà,
  // la marge DOIT être violée — sinon on aurait pu incliner davantage.
  const eps = (POLAIRE_MAX_DURE / PAS_PARCOURS) / 2 ** 13
  let verifies = 0
  for (const d of [6, 15, 30, 60]) {
    for (let i = 0; i < 36; i++) {
      const az = (i * 10) * D2R
      const phi = polaireMaxSol({ distance: d, cibleY: -0.3, azimut: az, sol: RELIEF })
      if (phi >= POLAIRE_MAX_DURE || phi <= 0) continue // aucune contrainte : rien à vérifier
      const p = pose(d, phi + eps, az, 0, -0.3, 0)
      assert.ok(p.y - RELIEF(p.x, p.z) < MARGE_SOL_U, `à d = ${d}, az = ${i * 10}°, il restait de la course`)
      verifies++
    }
  }
  assert.ok(verifies > 20, `seulement ${verifies} butées contraintes vérifiées`)
})

test('④ un relief qui dépasse même à l’aplomb ramène à l’aplomb, pas à l’absurde', () => {
  // caméra à 6 unités au-dessus d'une cible enfouie sous un plateau de 20 : il
  // n'y a AUCUN angle admissible. On rend 0 (l'aplomb), la valeur la plus sûre,
  // et surtout pas le plafond.
  const phi = polaireMaxSol({ distance: 6, cibleY: -0.3, sol: () => 20 })
  assert.equal(phi, 0)
})

// ══════════ ⑤ LE PLANCHER DE DISTANCE — QUAND LA CIBLE EST ENTERRÉE ═════════

test('⑤ une cible enterrée met la caméra sous le sol À TOUS LES ANGLES', () => {
  // ⚠️ **C'EST LE SECOND DÉFAUT, ET IL N'EST PAS ANGULAIRE.** `_cibleVisee` pose
  // `y = Y_CIBLE = −0,3` — une constante de plus — pendant que le sol y monte.
  // Relevé après le premier correctif : −5,0982 u sur **504 images de 504** au
  // Mont-Blanc, à `d = 6`, et la butée d'angle rendait 0 sans rien pouvoir.
  const solHaut = () => 5 // la cible (y = −0,3) est enterrée sous 5,3 unités
  assert.equal(polaireMaxSol({ distance: 6, cibleY: -0.3, sol: solHaut }), 0)
  assert.ok(-0.3 + 6 < 5 + MARGE_SOL_U, 'même à l’aplomb la marge n’est pas tenue')
})

test('⑤ le plancher de distance la sort — et il rend le plancher d’avant sur du plat', () => {
  const solHaut = () => 5
  const d = distanceMinSol({ cibleY: -0.3, sol: solHaut, plancher: 6 })
  assert.ok(Math.abs(d - (5 + MARGE_SOL_U + 0.3)) < 1e-9, `plancher ${d}`)
  assert.ok(-0.3 + d >= 5 + MARGE_SOL_U - 1e-9, 'la caméra à l’aplomb doit dégager')
  // sur du plat au niveau de la cible, RIEN ne change : le plancher d'avant
  assert.equal(distanceMinSol({ cibleY: -0.3, sol: () => -0.3, plancher: 6 }), 6)
  // et sans échantillonneur non plus
  assert.equal(distanceMinSol({ cibleY: -0.3, plancher: 6 }), 6)
})

test('⑤ le plancher est INVARIANT quand la cible tourne autour de l’axe du bloc', () => {
  // ⚡ **C'EST LA CONDITION QUI PROTÈGE D16 ter.** R13 fait tourner la caméra ET
  // la cible autour de l'axe ; un plancher qui changerait pendant le glissé
  // ferait écrêter le rayon par `OrbitControls`, donc bouger la distance
  // caméra → cible — le signal exact de `veille-repos` (seuil 1e-4).
  const rayon = 17
  const valeurs = []
  for (let i = 0; i < 36; i++) {
    const a = (i * 10) * D2R
    valeurs.push(distanceMinSol({
      cibleX: rayon * Math.sin(a), cibleY: -0.3, cibleZ: rayon * Math.cos(a),
      sol: RELIEF, plancher: 6,
    }))
  }
  const ecart = Math.max(...valeurs) - Math.min(...valeurs)
  assert.ok(ecart < 1e-9, `le plancher varie de ${ecart} sur un tour — D16 ter serait dépensé`)
})

test('⑤ … et il varie bien quand la cible CHANGE de cercle (le panoramique)', () => {
  // le témoin de l'assertion précédente : un plancher qui ne bougerait JAMAIS
  // ne mesurerait rien. Il doit suivre le relief quand on se déplace.
  const a = distanceMinSol({ cibleX: 0, cibleY: -0.3, cibleZ: 0, sol: RELIEF, plancher: 6 })
  const b = distanceMinSol({ cibleX: 18, cibleY: -0.3, cibleZ: 0, sol: RELIEF, plancher: 6 })
  assert.ok(Math.abs(a - b) > 0.5, `planchers trop proches : ${a} et ${b}`)
})

test('⑤ plancher + butée d’angle : la caméra dégage à TOUTES les distances admissibles', () => {
  let pire = Infinity
  for (let ic = 0; ic < 12; ic++) {
    const ac = (ic * 30) * D2R
    for (const rayon of [0, 8, 17, 25]) {
      const cx = rayon * Math.sin(ac)
      const cz = rayon * Math.cos(ac)
      const dmin = distanceMinSol({ cibleX: cx, cibleY: -0.3, cibleZ: cz, sol: RELIEF, plancher: 6 })
      for (const d of [dmin, dmin * 1.5, 30, 70, 141].filter((v) => v >= dmin)) {
        for (let i = 0; i < 24; i++) {
          const az = (i * 15) * D2R
          const phi = polaireMaxSol({ distance: d, cibleX: cx, cibleY: -0.3, cibleZ: cz, azimut: az, sol: RELIEF })
          for (let k = 0; k <= 20; k++) {
            const p = pose(d, (phi * k) / 20, az, cx, -0.3, cz)
            pire = Math.min(pire, p.y - RELIEF(p.x, p.z))
          }
        }
      }
    }
  }
  assert.ok(pire >= MARGE_SOL_U - 1e-9, `hauteur minimale ${pire.toFixed(4)}, attendue ≥ ${MARGE_SOL_U}`)
})

test('⑤ le plancher ne passe JAMAIS au-dessus du plafond', () => {
  // aux zooms fins le relief EN UNITÉS grandit : le plancher calculé peut
  // dépasser `maxDistance`, et `OrbitControls` écrêterait entre deux bornes
  // croisées. Relevé au banc avant la garde : un plancher qui poussait la caméra
  // à **194,995 unités de dégagement** avec un plafond de 150.
  const enorme = () => 500
  assert.equal(distanceMinSol({ cibleY: -0.3, sol: enorme, plancher: 6, plafond: 150 }), 150)
  // et le plancher d'avant gagne contre un plafond absurde : on ne rend jamais
  // une borne sous le plancher physique
  assert.equal(distanceMinSol({ cibleY: -0.3, sol: enorme, plancher: 6, plafond: 2 }), 6)
})

// ══════════ ④ LE REDRESSEMENT NE COMBAT PAS LE VOL DE POURSUITE — GX6 ③ ═════
//
// ⛔ **CE REDRESSEMENT REPOSE LA CAMÉRA SANS LA RÉ-VISER.** En orbite c'est
// sans conséquence (`controls.update()` ré-oriente à l'image suivante) ; pendant
// un vol de poursuite GPX, c'est l'image blanche. Mesuré, pile d'appel à
// l'appui (`scripts/banc-gx6-pile.mjs`) : après `drone.updateAt` la caméra est
// à (−23,64 · 6,35 · −16,22) et vise la tête (avant·tête 0,999) ; cette
// fonction la repose 39 unités plus loin, orientation inchangée, soit **176,5°
// de sa propre cible** — la tête sort du cadre et l'image de lecture n'a pas un
// pixel de tracé (Chamonix, 4 images sur 40).
//
// La garde EXÉCUTE la fonction extraite de `main.js` — une ligne commentée ne
// s'exécute pas, donc la mutation rougit.
import { readFileSync } from 'node:fs'
const MAIN_TXT = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
const SRC_REDRESSE = MAIN_TXT.match(/^function redresserSurLeSol\(\) \{[\s\S]*?^\}$/m)?.[0]

function redressementCable({ vol }) {
  assert.ok(SRC_REDRESSE, 'la fonction `redresserSurLeSol` n’existe plus dans main.js : relire cette garde')
  const camera = { position: { x: 0, y: -50, z: 30, set(x, y, z) { this.x = x; this.y = y; this.z = z; this.pose = true } } }
  const controls = {
    target: { x: 0, y: 0, z: 0 },
    getDistance: () => 40,
    getPolarAngle: () => 1.5, // franchement sous la butée
    getAzimuthalAngle: () => 0,
  }
  const terrain = { sample: () => 0 }
  const polaireMaxSolStub = () => 0.4 // max ≪ phi : le redressement DOIT tirer
  const drone = { active: vol }
  const params = { gpxFollow: vol }
  const gpxLayer = { isPlaying: () => vol }
  // ⚠️ `globe` DOIT être injecté même s'il n'est lu qu'en `globe?.…` : l'optionnel
  // protège d'un `undefined`, PAS d'un identifiant absent de la portée — sans lui
  // `new Function` lève `ReferenceError` et la garde ne mesure plus rien.
  // (`redresserSurLeSol` lit `globe.tuilesAvecHauteurs()` depuis la tâche FLU.)
  const globe = { tuilesAvecHauteurs: () => null }
  // `solDessine` : la lecture du sol DESSINÉ (tâche OBL). Le stub rend le même
  // plan que `terrain.sample` ci-dessus — la garde mesure le redressement, pas
  // le relief.
  const solDessine = () => 0
  const f = new Function('terrain', 'controls', 'camera', 'polaireMaxSol', 'drone', 'params', 'gpxLayer', 'globe', 'solDessine',
    SRC_REDRESSE + '\nreturn redresserSurLeSol')(terrain, controls, camera, polaireMaxSolStub, drone, params, gpxLayer, globe, solDessine)
  f()
  return camera.position
}

test('④ hors vol, le redressement tire bien la caméra (sinon la garde ne garde rien)', () => {
  const p = redressementCable({ vol: false })
  assert.ok(p.pose, 'le redressement n’a pas bougé la caméra : la fixture ne déclenche rien, la garde ne prouve rien')
})

test('④ pendant le vol de poursuite GPX, le redressement NE touche PAS la caméra (le drone a sa propre butée, et lui vise)', () => {
  const p = redressementCable({ vol: true })
  assert.ok(!p.pose,
    'le redressement a reposé la caméra pendant le vol : 39 unités plus loin, sans ré-viser, la tête sort du cadre et l’image de lecture n’a pas un pixel de tracé')
  assert.deepEqual({ x: p.x, y: p.y, z: p.z }, { x: 0, y: -50, z: 30 })
})
