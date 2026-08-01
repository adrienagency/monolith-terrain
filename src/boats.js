// Bateaux — le RENDU de la flotte (src/fleet.js tient le modèle : positions,
// caps, fondu, sommeil). Un seul InstancedMesh, donc UN appel de dessin quel
// que soit le nombre de bateaux.
//
// LA HOULE EST LUE SUR LE GPU, PAS RECALCULÉE.
// GERSTNER_GLSL est le morceau de shader que la mer utilise déjà (ocean.js).
// On l'injecte tel quel dans le shader de sommets du bateau et on lui passe les
// MÊMES uniformes — pas des copies, les objets eux-mêmes. Trois conséquences :
// aucune duplication de la formule, synchronisation exacte par construction, et
// un changement d'état de la mer suit tout seul puisque c'est le même tableau
// de spectre qui est lu.
//
// Le prix à payer : le processeur ne connaît jamais la hauteur d'un bateau.
// C'est sans conséquence ici (le modèle n'a besoin que du plan XZ), mais ça
// comptera le jour où la fumée devra sortir de la cheminée au bon endroit.

import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { GERSTNER_GLSL } from 'ocean-waves'
import MODEL_URL from './assets/steamer.glb?url'
import { seedFleet, stepBoat, fleetAsleep, boatScale, MIN_ZOOM, FLEET_SLOTS } from './fleet.js'

// Le nombre d'instances SUIT le modèle : un seul bateau par bloc (Adrien).
// Le dimensionner à part invitait la dérive — huit places réservées ici pour
// une flotte qui n'en remplit qu'une.
//
// ⚠️ SUR UNE EMPRISE 3×3, NEUF BLOCS. `seedFleet` sème `cote²` fois plus de
// places pour que la densité DANS LA FENÊTRE ne bouge pas (voir son en-tête) :
// l'InstancedMesh doit pouvoir toutes les porter. Neuf instances d'un vapeur,
// c'est 9 matrices — rien, et toujours un seul appel de dessin.
const MAX_BOATS = FLEET_SLOTS * 9

// Part de la hauteur de coque qui passe SOUS la flottaison. Un bateau ne se
// pose pas sur l'eau, il s'y enfonce (Adrien) — sans ça il a l'air d'un jouet
// posé sur une table.
const SINK = 0.28

export class Boats {
  constructor(scene) {
    this.group = new THREE.Group()
    this.group.name = 'boats'
    scene.add(this.group)
    this.mesh = null
    this.boats = []
    this.uniforms = null
    this._time = 0
    this._loading = null
    this._fen = { x: 0, z: 0 } // décalage de fenêtre du mode continu 3×3
    this._m = new THREE.Matrix4()
    this._q = new THREE.Quaternion()
    this._v = new THREE.Vector3()
    this._s = new THREE.Vector3()
  }

  // Charge le modèle une seule fois, à la demande. Tant qu'il n'est pas là, la
  // flotte existe côté modèle mais ne dessine rien — aucun blocage du démarrage.
  load() {
    this._loading ??= new Promise((resolve) => {
      const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
      loader.load(
        MODEL_URL,
        (gltf) => {
          let src = null
          gltf.scene.traverse((o) => { if (!src && o.isMesh) src = o })
          resolve(src || null)
        },
        undefined,
        () => resolve(null) // absent ou illisible : la carte marche sans bateaux
      )
    })
    return this._loading
  }

  // Les uniformes de la mer, PARTAGÉS (pas copiés) — voir l'en-tête.
  setSea(seaMaterial) {
    this.sea = seaMaterial?.uniforms || null
  }

  async build({ zoom, half, seed, isSea, extentMeters, terrainSize, force = false, cote = 1 }) {
    // GARDÉ pour le pas : le bateau doit consulter la terre à chaque image, pas
    // seulement au moment d'être semé. Sans ça il traverse la côte.
    this._isSea = isSea || null
    // ⚠️ `slots: FLEET_SLOTS`, PAS `MAX_BOATS`. `MAX_BOATS` est la RÉSERVE de
    // l'InstancedMesh (neuf blocs) ; le nombre de places par bloc, lui, est
    // toujours un. Les confondre remettrait neuf bateaux dans le bloc central.
    this.boats = seedFleet({ zoom, half, seed, isSea, slots: FLEET_SLOTS, force, cote })
    if (!this.boats.length) { this._dispose(); return }
    const src = await this.load()
    if (!src || !this.boats.length) { this._dispose(); return }

    this._dispose()
    const scale = boatScale(terrainSize, extentMeters)
    // L'ORIGINE DU MODÈLE EST AU CENTRE DE SA BOÎTE, pas à la flottaison :
    // la prendre pour le trait d'eau noyait le bateau à moitié avant même
    // d'appliquer SINK. On ancre donc sur la QUILLE (bbox.min.y) et on
    // enfonce de SINK de la hauteur — ce que dit la constante.
    src.geometry.computeBoundingBox()
    const bb = src.geometry.boundingBox
    this._sink = bb.min.y * scale + SINK * (bb.max.y - bb.min.y) * scale
    const mat = this._makeMaterial(src.material)
    const mesh = new THREE.InstancedMesh(src.geometry, mat, MAX_BOATS)
    mesh.name = 'boats-instanced'
    mesh.frustumCulled = false // les sommets bougent dans le shader
    mesh.castShadow = false // à cette échelle l'ombre coûte plus qu'elle n'apporte
    // opacité PAR INSTANCE : c'est elle qui porte le fondu de sortie de carte
    mesh.geometry.setAttribute(
      'aFade',
      new THREE.InstancedBufferAttribute(new Float32Array(MAX_BOATS), 1)
    )
    this.mesh = mesh
    this._scale = scale
    this.group.add(mesh)
    this._writeMatrices()
  }

  _makeMaterial(srcMat) {
    const mat = srcMat ? srcMat.clone() : new THREE.MeshStandardMaterial({ color: '#d8d4cc' })
    mat.transparent = true
    mat.depthWrite = true
    mat.onBeforeCompile = (shader) => {
      // les uniformes de spectre sont ceux de la MER, partagés par référence
      const sea = this.sea
      for (const k of ['uWaveA', 'uWaveB', 'uWaveH', 'uChop', 'uSpeedMul', 'uLenScale', 'uWaterY']) {
        shader.uniforms[k] = sea?.[k] ?? { value: k === 'uWaveA' || k === 'uWaveB' ? [] : 0 }
      }
      shader.uniforms.uBoatTime = sea?.uTime ?? { value: 0 }
      shader.uniforms.uSink = { value: this._sink ?? 0 }
      this.uniforms = shader.uniforms

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
${GERSTNER_GLSL}
// GERSTNER_GLSL ne déclare QUE le spectre (uWaveA/uWaveB) ; les quatre
// réglages passés en arguments à oceanGerstner() sont à la charge de l'hôte.
// Les oublier ici ne casse rien de visible côté JS : le shader ne compile
// simplement pas, et l'InstancedMesh disparaît en silence.
uniform float uWaveH;
uniform float uChop;
uniform float uSpeedMul;
uniform float uLenScale;
uniform float uBoatTime;
uniform float uWaterY;
uniform float uSink;
attribute float aFade;
varying float vFade;`
        )
        .replace(
          '#include <project_vertex>',
          `vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
  mvPosition = instanceMatrix * mvPosition;
#endif
  vFade = aFade;
#ifdef USE_INSTANCING
  // La houle est lue AU CENTRE DE L'INSTANCE : une seule somme de seize vagues
  // par sommet, et surtout la MÊME pour toute la coque — un bateau ne se plie
  // pas, il tangue en bloc.
  vec2 bxz = vec2(instanceMatrix[3].x, instanceMatrix[3].z);
  vec3 nAcc; float crest;
  vec3 wav = oceanGerstner(bxz, uBoatTime, uWaveH, uChop, uSpeedMul, uLenScale, 1.0, nAcc, crest);
  // Gîte au PREMIER ORDRE autour du centre : à cette taille l'angle reste
  // petit, et une vraie matrice de rotation coûterait plus qu'elle ne se voit.
  vec3 rel = mvPosition.xyz - vec3(instanceMatrix[3].x, instanceMatrix[3].y, instanceMatrix[3].z);
  mvPosition.y += rel.x * nAcc.x + rel.z * nAcc.z;
  // flottaison : la coque s'enfonce, elle ne se pose pas
  mvPosition.y += uWaterY + wav.y - uSink;
#endif
  mvPosition = modelViewMatrix * mvPosition;
  gl_Position = projectionMatrix * mvPosition;`
        )

      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vFade;')
        .replace(
          '#include <dithering_fragment>',
          '#include <dithering_fragment>\n  gl_FragColor.a *= vFade;\n  if (gl_FragColor.a < 0.01) discard;'
        )
    }
    mat.needsUpdate = true
    return mat
  }

  _writeMatrices() {
    const mesh = this.mesh
    if (!mesh) return
    const fade = mesh.geometry.getAttribute('aFade')
    const s = this._scale
    for (let i = 0; i < MAX_BOATS; i++) {
      const b = this.boats[i]
      if (!b || b.dormant) {
        fade.array[i] = 0
        continue
      }
      this._q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), b.cap)
      // ⚠️ COORDONNÉES DE GÉOMÉTRIE, PAS DE CHAMP — et le groupe reste à
      // l'origine. La houle est lue DANS LE SHADER à `instanceMatrix[3].xz`
      // (voir _makeMaterial) : translater le groupe, comme on le fait pour les
      // calques du sol, aurait donné au bateau la vague d'un autre endroit que
      // celle que la mer dessine sous lui — un vapeur qui tangue à contretemps
      // de son propre sillage. On retranche donc le décalage ICI.
      this._v.set(b.x - this._fen.x, 0, b.z - this._fen.z)
      this._s.setScalar(s)
      mesh.setMatrixAt(i, this._m.compose(this._v, this._q, this._s))
      fade.array[i] = b.opacite
    }
    mesh.instanceMatrix.needsUpdate = true
    fade.needsUpdate = true
    // toute la flotte endormie : plus rien à dessiner NI à calculer
    this.group.visible = !fleetAsleep(this.boats)
  }

  // Le décalage de fenêtre du mode continu. Les positions des bateaux sont en
  // coordonnées de CHAMP (l'emprise 3×3 entière) ; c'est l'écriture des matrices
  // qui les ramène dans la géométrie. Hors mode continu il reste à (0,0).
  setFenetre(x, z) {
    this._fen.x = x
    this._fen.z = z
    this._writeMatrices()
  }

  update(dt, half, bord = half) {
    if (!this.mesh || !this.boats.length) return
    if (fleetAsleep(this.boats)) { this.group.visible = false; return }
    const opts = { bord, fenX: this._fen.x, fenZ: this._fen.z }
    for (let i = 0; i < this.boats.length; i++) this.boats[i] = stepBoat(this.boats[i], dt, half, this._isSea, opts)
    this._writeMatrices()
  }

  setVisible(v) { this.group.visible = v && !fleetAsleep(this.boats) }

  _dispose() {
    if (!this.mesh) return
    this.group.remove(this.mesh)
    this.mesh.material.dispose()
    this.mesh.dispose()
    this.mesh = null
  }

  dispose() { this._dispose() }
}

export { MIN_ZOOM }
