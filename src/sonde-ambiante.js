// LA SONDE D'AMBIANTE — Tâche P3 du plan « LE STUDIO SUR LE GLOBE ».
//
// Elle répond à UNE question, et le crop ne peut pas s'éclairer comme le socle
// sans la réponse : **combien d'irradiance `scene.environment` verse-t-il sur
// une surface diffuse, et comment cette irradiance varie-t-elle avec la
// normale ?**
//
// ══════════ POURQUOI UNE MESURE ET PAS UNE CONSTANTE ════════════════════════
//
// ⚠️ **PARCE QUE L'AMBIANTE PÈSE PRESQUE LA MOITIÉ DE L'IRRADIANCE DU SOCLE, ET
// QUE LA TEXTURE CHANGE.** Relevé le 2026-08-22 sur l'application vivante (La
// Réunion, z12, socle rallumé dans la même page, rendu sans compositeur dans une
// cible demi-flottante, donc en linéaire et sans écrêtage) : soleil ≈ (2,09 ·
// 1,95 · 1,65), hémisphère ≈ (0,16 · 0,33 · 0,51), **environnement = (2,0155 ·
// 2,0153 · 2,0152)** sur **133 786 pixels**. Écrire 2,0155 en dur aurait tenu
// jusqu'au premier ciel HDRI — `applyBackground` remplace `scene.environment`,
// et rien n'aurait signalé que le nombre est devenu faux.
//
// ⛔ **ET UNE CONSTANTE AURAIT ÉTÉ FAUSSE DE 570 % DÈS LE PREMIER ESSAI.** La
// première version de ce fichier multipliait le coefficient par
// `material.envMapIntensity` — 0,15 sur le matériau du relief. Or `three`
// (`WebGLRenderer.js`, r172) ÉCRASE cet uniforme quand le matériau n'a pas
// d'`envMap` à lui et que la scène en a une :
//
//     if ( material.isMeshStandardMaterial && material.envMap === null && scene.environment !== null )
//         m_uniforms.envMapIntensity.value = scene.environmentIntensity;
//
// Relevé dans l'application : `terrain.material.envMap === null`. **`params.envMapIntensity`
// est donc du code MORT sur le relief**, et la seule intensité qui compte est
// `scene.environmentIntensity`. Le facteur 6,7 que ça donnait a été attrapé par
// la mesure du socle, pas par la lecture du code.
//
// ══════════ CE QU'ELLE REND : UN CIEL ET UN SOL, PAS UN NOMBRE ══════════════
//
// ⚠️ **L'IRRADIANCE D'UN ENVIRONNEMENT DÉPEND DE LA NORMALE** — sur le socle,
// son écart-type vaut **17,7 %** de sa moyenne, et un ciel HDRI est bleu en
// haut et brun en bas. Rendre une moyenne unique aurait jeté cette variation.
//
// On rend donc **deux irradiances, zénith et nadir**, obtenues par une
// RÉGRESSION LINÉAIRE de l'irradiance sur `N·haut` — et l'appelant les ajoute
// aux deux couleurs de la lampe hémisphérique. Le nuanceur n'a alors rien de
// plus à faire : `mix(sol, ciel, 0.5 · ndu + 0.5)` est déjà exactement la loi
// que three écrit pour une `HemisphereLight`, et c'est aussi la meilleure
// approximation du premier ordre d'un environnement.
//
// **La sonde est une SPHÈRE regardée de côté par une caméra ORTHOGRAPHIQUE.**
// Pour une sphère unité vue ainsi, la normale du point qui tombe en `(sx, sy)`
// de l'écran vaut `(sx, sy, √(1 − sx² − sy²))` : **`N·haut` EST la coordonnée
// écran `sy`**, sans aucun calcul. Le haut du disque donne le zénith, le bas le
// nadir, et tout l'entre-deux nourrit la régression.
//
// ══════════ LE SPÉCULAIRE EST RETIRÉ, ET IL EST RETIRÉ PAR SOUSTRACTION ═════
//
// ⚠️ **UNE SONDE D'ALBÉDO 1 MESURE LE DIFFUS *PLUS* LE SPÉCULAIRE.** Même à
// `roughness = 1` et `metalness = 0`, `F0 = 0,04` renvoie de la lumière — relevé
// sur le socle : **0,0089 sur 0,2237**, soit 4,0 %. On rend donc DEUX fois, la
// seconde avec un albédo NOIR (le diffus s'annule, le spéculaire reste), et on
// soustrait. C'est exact, et ça ne coûte qu'un second rendu de 64 × 64.
//
// ══════════ CE QUE LA SONDE NE DOIT PAS CASSER ═════════════════════════════
//
// ⚠️ **`WebGLRenderer.render` CONSOMME `shadowMap.needsUpdate`** — le dépôt a
// déjà payé ce défaut une fois (`PasseFond`, `main.js` : « la passe de fond
// l'aurait avalé et le bloc n'aurait plus jamais reçu sa carte, sans erreur,
// sans test rouge, juste des ombres figées »). On le sauve et on le repose,
// comme la cible de rendu, la couleur d'effacement et `autoClear`.
//
// ⚠️ **ET ELLE NE TOURNE QU'UNE FOIS PAR TEXTURE.** Le résultat est mis en
// cache dans une `WeakMap` et **rendu comme un objet GELÉ dont l'identité ne
// bouge pas** : c'est ce qui permet à `habillageDifferent` de le comparer par
// `Object.is` sans reposer l'habillage entier à chaque image.

import * as THREE from 'three'

const COTE = 64 // pixels de côté — ~3 200 normales pour la régression
const CACHE = new WeakMap() // texture d'environnement → { ciel, sol } gelé

export const AMBIANTE_NULLE = Object.freeze({
  ciel: Object.freeze([0, 0, 0]),
  sol: Object.freeze([0, 0, 0]),
})

let _scene = null
let _cam = null
let _bille = null
let _cible = null
let _lecture = null

function demiFlottantVersFlottant(h) {
  const s = (h & 0x8000) >> 15
  const e = (h & 0x7c00) >> 10
  const f = h & 0x03ff
  if (e === 0) return (s ? -1 : 1) * Math.pow(2, -14) * (f / 1024)
  if (e === 0x1f) return f ? NaN : (s ? -Infinity : Infinity)
  return (s ? -1 : 1) * Math.pow(2, e - 15) * (1 + f / 1024)
}

function bati() {
  if (_scene) return
  _scene = new THREE.Scene()
  _bille = new THREE.Mesh(
    new THREE.SphereGeometry(1, 48, 32),
    new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 1, metalness: 0, envMapIntensity: 1 })
  )
  _scene.add(_bille)
  // orthographique, cadrée exactement sur le disque unité, regardant −Z : la
  // coordonnée écran `sy` EST alors `N·haut` (voir l'en-tête)
  _cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
  _cam.position.set(0, 0, 4)
  _cam.lookAt(0, 0, 0)
  _cible = new THREE.WebGLRenderTarget(COTE, COTE, {
    type: THREE.HalfFloatType,
    depthBuffer: true,
    colorSpace: THREE.LinearSRGBColorSpace,
  })
  _lecture = new Uint16Array(COTE * COTE * 4)
}

function rendreEtLire(renderer) {
  renderer.setRenderTarget(_cible)
  renderer.clear(true, true, true)
  renderer.render(_scene, _cam)
  renderer.readRenderTargetPixels(_cible, 0, 0, COTE, COTE, _lecture)
  const out = new Float32Array(COTE * COTE * 3)
  for (let i = 0, j = 0; i < COTE * COTE; i++, j += 3) {
    out[j] = demiFlottantVersFlottant(_lecture[i * 4])
    out[j + 1] = demiFlottantVersFlottant(_lecture[i * 4 + 1])
    out[j + 2] = demiFlottantVersFlottant(_lecture[i * 4 + 2])
  }
  return out
}

/**
 * L'irradiance de `envTexture` sur une surface diffuse, POUR
 * `scene.environmentIntensity = 1` : `{ ciel, sol }`, deux triplets linéaires.
 *
 * ⚠️ **LE RÉSULTAT EST GELÉ ET MIS EN CACHE PAR TEXTURE.** Deux appels avec la
 * même texture rendent le MÊME objet — `Object.is` le voit, et l'habillage ne
 * se repose pas.
 *
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Texture|null} envTexture `scene.environment`
 */
export function coefAmbiante(renderer, envTexture) {
  if (!renderer || !envTexture) return AMBIANTE_NULLE
  const memo = CACHE.get(envTexture)
  if (memo !== undefined) return memo
  bati()
  const cibleAvant = renderer.getRenderTarget()
  const autoAvant = renderer.autoClear
  const ombreAvant = renderer.shadowMap.needsUpdate
  const clearAvant = renderer.getClearColor(new THREE.Color())
  const alphaAvant = renderer.getClearAlpha()
  _scene.environment = envTexture
  _scene.environmentIntensity = 1
  renderer.autoClear = true
  renderer.setClearColor(0x000000, 1)
  _bille.material.color.setRGB(1, 1, 1, THREE.LinearSRGBColorSpace)
  const blanc = rendreEtLire(renderer)
  _bille.material.color.setRGB(0, 0, 0, THREE.LinearSRGBColorSpace)
  const noir = rendreEtLire(renderer)
  _scene.environment = null
  renderer.setRenderTarget(cibleAvant)
  renderer.autoClear = autoAvant
  renderer.setClearColor(clearAvant, alphaAvant)
  renderer.shadowMap.needsUpdate = ombreAvant

  // Régression de E sur ndu = sy. `readRenderTargetPixels` rend la ligne 0 EN
  // BAS (convention OpenGL), donc sy croît avec l'indice de ligne.
  let n = 0
  let sX = 0
  let sXX = 0
  const sY = [0, 0, 0]
  const sXY = [0, 0, 0]
  for (let ligne = 0; ligne < COTE; ligne++) {
    const sy = ((ligne + 0.5) / COTE) * 2 - 1
    for (let col = 0; col < COTE; col++) {
      const i = (ligne * COTE + col) * 3
      const sx = ((col + 0.5) / COTE) * 2 - 1
      // hors du disque il n'y a pas de bille : la régression n'a rien à y lire
      if (sx * sx + sy * sy > 0.98) continue
      n++
      sX += sy
      sXX += sy * sy
      for (let k = 0; k < 3; k++) {
        // sortie = albédo · E / PI, albédo vaut 1 → E = PI · (blanc − noir)
        const e = Math.max(0, (blanc[i + k] - noir[i + k]) * Math.PI)
        sY[k] += e
        sXY[k] += e * sy
      }
    }
  }
  let res = AMBIANTE_NULLE
  const det = n * sXX - sX * sX
  if (n > 16 && Math.abs(det) > 1e-9) {
    const ciel = [0, 0, 0]
    const sol = [0, 0, 0]
    for (let k = 0; k < 3; k++) {
      const b = (n * sXY[k] - sX * sY[k]) / det // la pente : (ciel − sol) / 2
      const a = (sY[k] - b * sX) / n // l'ordonnée : (ciel + sol) / 2
      ciel[k] = Math.max(0, a + b)
      sol[k] = Math.max(0, a - b)
    }
    if (ciel.every(Number.isFinite) && sol.every(Number.isFinite)) {
      res = Object.freeze({ ciel: Object.freeze(ciel), sol: Object.freeze(sol), pixels: n })
    }
  }
  CACHE.set(envTexture, res)
  return res
}

/** Pour les bancs : l'intérieur de la sonde, sans le cache. */
export function _sondeInterne() {
  return { COTE, scene: _scene, bille: _bille, cible: _cible }
}
