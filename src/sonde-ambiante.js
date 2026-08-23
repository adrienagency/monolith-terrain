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
// On rend donc **deux irradiances, zénith et nadir**, que l'appelant ajoute aux
// deux couleurs de la lampe hémisphérique. Le nuanceur n'a alors rien de plus à
// faire : `mix(sol, ciel, 0.5 · ndu + 0.5)` est déjà exactement la loi que three
// écrit pour une `HemisphereLight`.
//
// ══════════ ⛔ ET LA PREMIÈRE VERSION LES OBTENAIT MAL — Tâche P12 ══════════
//
// La sonde de P3 était une **BILLE regardée de côté par une caméra
// orthographique**, et elle régressait l'irradiance sur la coordonnée d'écran
// `sy`. Son argument était juste — pour une sphère unité vue ainsi, `N·haut`
// **est** `sy` — mais il ne dit rien du reste : **les normales visibles sont
// toutes celles du demi-espace `Nz > 0`**, pondérées par l'aire d'écran.
//
// ⛔ **ET L'ENVIRONNEMENT N'EST PAS INVARIANT PAR ROTATION AUTOUR DE LA
// VERTICALE.** Mesuré dans la page vivante le 2026-08-23 (La Réunion z12,
// `.banc/P12/d3-hemisphere.js`) : à `ndu = 0,3`, l'irradiance va de **0,7225 à
// 2,6446 selon l'azimut** — **146 % d'amplitude**. Les deux moitiés de sphère
// rendent donc deux droites différentes, **×2,18 sur le terme de ciel**, et la
// sonde livrée retombait à 2,2 % de la moitié qu'elle voyait : **son rendu
// était juste, son échantillonnage était faux.**
//
// ⚡ **CE QUE ÇA COÛTAIT, MESURÉ TERME PAR TERME** (`.banc/P12/d1-irradiance.js`,
// atlas de 1 600 normales, socle rallumé dans la même page) : le soleil du crop
// est juste à **×1,0003**, sa lampe hémisphérique est **exacte**, et son
// environnement dépasse de **×1,2772**. **Tout le dépassement du noteur vit
// là.**
//
// ⚠️ **ET LA SECONDE FAUTE ÉTAIT UNE FAUTE DE MONNAIE, LA CINQUIÈME DE CE
// CHANTIER** : `ciel` et `sol` ne sont pas les coefficients d'un ajustement, ce
// sont **deux irradiances AUX PÔLES** — l'appelant les additionne à
// `hemi.color` et `hemi.groundColor`, où `skyColor` est par définition
// l'irradiance à `ndu = +1`. Y verser l'extrapolation d'une droite des moindres
// carrés met une valeur juste dans la mauvaise monnaie.
//
// ➡️ **LA SONDE MESURE DONC EXACTEMENT LES DEUX GRANDEURS QUE LE NUANCEUR
// CONSOMME, ET RIEN D'AUTRE** : deux faces, deux normales, `(0, +1, 0)` et
// `(0, −1, 0)`. Il n'y a plus d'échantillonnage à biaiser. La géométrie, les
// plages de lecture et la réduction vivent dans `src/monde/atlas-normales.js`,
// **module pur, vérifiable sous node** — c'est là que la mesure du 2026-08-23
// est écrite en entier.
//
// ⚡ **CE QUE ÇA VAUT, SUR LES NORMALES DU RELIEF** (`ndu ≥ 0,7`) : irradiance
// totale du crop contre celle du socle, **×1,1429 avant**, **×1,0006 après**.
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

import {
  NORMALES_ATLAS,
  facesAtlas,
  bandesLecture,
  irradianceBande,
  dispersionBande,
} from './monde/atlas-normales.js'

const COTE = 64 // pixels de côté — deux bandes de 28 lignes utiles après marge
const CACHE = new WeakMap() // texture d'environnement → { ciel, sol } gelé

export const AMBIANTE_NULLE = Object.freeze({
  ciel: Object.freeze([0, 0, 0]),
  sol: Object.freeze([0, 0, 0]),
})

let _scene = null
let _cam = null
let _atlas = null
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
  // ⚠️ **LA GÉOMÉTRIE VIENT DU MODULE PUR, ELLE N'EST PAS ÉCRITE ICI.** Le
  // débord, l'écart entre bandes et l'ordre bas→haut sont les trois choses qui
  // décident de ce que la sonde mesure, et ce sont les trois que
  // `test/atlas-normales.test.js` peut exercer sous node.
  const f = facesAtlas(NORMALES_ATLAS)
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(f.positions, 3))
  geo.setAttribute('normal', new THREE.BufferAttribute(f.normales, 3))
  geo.setIndex(new THREE.BufferAttribute(f.index, 1))
  // ⚠️ **LE MATÉRIAU EST CELUI DU RELIEF DU SOCLE** — `MeshPhysicalMaterial`,
  // `roughness = 1`, `metalness = 0`, `specularIntensity` à son défaut de 1 :
  // c'est ce qui fait que la soustraction blanc − noir retient le facteur
  // d'énergie `1 − max(totalScattering)` que le relief subit lui aussi.
  _atlas = new THREE.Mesh(
    geo,
    new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 1, metalness: 0, envMapIntensity: 1 })
  )
  // ⚠️ **AUCUNE OMBRE, ET AUCUN ÉCRÊTAGE PAR LE TRONC** : les faces débordent
  // du cadre, donc leur boîte englobante déborde aussi.
  _atlas.castShadow = false
  _atlas.receiveShadow = false
  _atlas.frustumCulled = false
  _scene.add(_atlas)
  // orthographique, cadrée exactement sur `[-1, 1]²`, regardant −Z : les faces
  // sont posées en z = 0 et remplissent le cadre, débord compris
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
  _atlas.material.color.setRGB(1, 1, 1, THREE.LinearSRGBColorSpace)
  const blanc = rendreEtLire(renderer)
  _atlas.material.color.setRGB(0, 0, 0, THREE.LinearSRGBColorSpace)
  const noir = rendreEtLire(renderer)
  _atlas.material.color.setRGB(1, 1, 1, THREE.LinearSRGBColorSpace)
  _scene.environment = null
  renderer.setRenderTarget(cibleAvant)
  renderer.autoClear = autoAvant
  renderer.setClearColor(clearAvant, alphaAvant)
  renderer.shadowMap.needsUpdate = ombreAvant

  // ⚠️ **LA BANDE DU BAS EST LE NADIR** (`readRenderTargetPixels` rend la ligne
  // 0 en bas), et `NORMALES_ATLAS` est écrit dans cet ordre-là.
  const bandes = bandesLecture(NORMALES_ATLAS.length, COTE)
  const sol = irradianceBande(blanc, noir, COTE, bandes[0])
  const ciel = irradianceBande(blanc, noir, COTE, bandes[1])
  let res = AMBIANTE_NULLE
  if (ciel.every(Number.isFinite) && sol.every(Number.isFinite)) {
    res = Object.freeze({
      ciel: Object.freeze(ciel.map((v) => Math.max(0, v))),
      sol: Object.freeze(sol.map((v) => Math.max(0, v))),
      // ⚠️ **LE TÉMOIN DE LA MESURE** : tous les pixels d'une bande portent la
      // même normale, donc le même nombre. Un écart non nul dit qu'un pixel de
      // couture ou de fond est entré dans la moyenne.
      dispersion: Math.max(
        dispersionBande(blanc, noir, COTE, bandes[0]),
        dispersionBande(blanc, noir, COTE, bandes[1])
      ),
      pixels: (bandes[0].fin - bandes[0].debut + 1 + bandes[1].fin - bandes[1].debut + 1) * COTE,
    })
  }
  CACHE.set(envTexture, res)
  return res
}

/** Pour les bancs : l'intérieur de la sonde, sans le cache. */
export function _sondeInterne() {
  return { COTE, scene: _scene, atlas: _atlas, cible: _cible, bandes: bandesLecture(NORMALES_ATLAS.length, COTE) }
}
