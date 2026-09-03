// UN MATÉRIAU POUR TOUTES LES TUILES — PF4, levier n° 1 du profil PF1.
//
// ⛔ **UNE INSTANCE DE `ShaderMaterial` PAR TUILE, 128 UNIFORMES CHACUNE, 330 À
// 637 VIVANTES** : à chaque appel de dessin three voyait un matériau NEUF
// (`refreshMaterial`), rejouait `refreshMaterialUniforms` et téléversait la
// liste entière. PF1 : `rendu.objets` = 23–41 % de l'image, `uniformMatrix4fv`
// + `upload` = 20–22 % des échantillons V8.
//
// Mesuré avant d'écrire (PF4, orbite 2 000 km, 73 tuiles visibles sur 360,
// CPU ×4, animations coupées) : `composer.render` p50 **8,6–9,7 ms → 4,6 ms**
// en donnant le même matériau à toutes les tuiles.
//
// LA RÈGLE : un seul `ShaderMaterial` (les 120 uniformes PARTAGÉS y vivent déjà :
// `this.uniforms`, étalé jadis dans chaque copie), et ce qui est PROPRE à la
// tuile — `uTex`, `uTilePx`, `uUvParMonde`, et la photo `uPhoto`/`uPhotoOn`/
// `uPhotoUv` — vit sur le maillage (`mesh.userData.tuile`) et est posé dans les
// uniformes juste avant SON dessin (`onBeforeRender`), avec
// `uniformsNeedUpdate` pour que three le téléverse. Six valeurs par tuile au
// lieu de cent vingt-huit ; et `refreshMaterial` ne se déclenche plus qu'une
// fois par image.
//
// ⚠️ `onBeforeRender` est appelé par three AVANT `setProgram`, avec `this` = le
// maillage : c'est ce qui rend l'ordre juste (les valeurs sont posées, PUIS
// téléversées). Un matériau sans `uniforms.uTex` (celui qu'un test emprunte)
// est laissé tel quel.
//
// Échappatoire : `?tuiles=amont` rend un matériau par tuile, comme avant.

import * as THREE from 'three'

// `?nom=amont` : l'échappatoire commune des correctifs PF4 (mesure avant/après
// dans un seul build). Sans `location` (node, tests), jamais.
export function amontDemande(nom) {
  try {
    return typeof location !== 'undefined' && new URLSearchParams(location.search).get(nom) === 'amont'
  } catch {
    return false
  }
}

// Ce qui est propre à UNE tuile, sans objet uniforme autour.
export function valeursTuile(texture, tilePx = 256, uvParMonde = 1) {
  return { uTex: texture, uTilePx: tilePx, uUvParMonde: uvParMonde, uPhoto: null, uPhotoOn: 0, uPhotoUv: new THREE.Vector4(0, 0, 1, 1) }
}

// Le `onBeforeRender` d'une tuile : `this` est le maillage (three l'appelle en
// méthode). Pose les six valeurs propres et demande le téléversement.
export function avantDessinTuile(renderer, scene, camera, geometry, material) {
  const t = this.userData && this.userData.tuile
  const u = material && material.uniforms
  if (!t || !u || !u.uTex) return
  u.uTex.value = t.uTex
  u.uTilePx.value = t.uTilePx
  u.uUvParMonde.value = t.uUvParMonde
  u.uPhoto.value = t.uPhoto
  u.uPhotoOn.value = t.uPhotoOn
  u.uPhotoUv.value.copy(t.uPhotoUv)
  material.uniformsNeedUpdate = true
}

// LA FABRIQUE : `creer(texture, tilePx, uvParMonde)` bâtit un ShaderMaterial de
// tuile (c'est globe.js qui sait le faire — VERT, FRAG, `this.uniforms`) ; ici
// on décide s'il est partagé. `pour` garde la signature historique de
// `_materialFor`, que les tests empruntent.
export function creerFabriqueMateriau({ creer, amont = false } = {}) {
  let partage = null
  return {
    get partage() {
      return partage
    },
    pour(texture, tilePx = 256, uvParMonde = 1) {
      if (amont) return creer(texture, tilePx, uvParMonde)
      if (!partage) partage = creer(null, tilePx, uvParMonde)
      // le matériau rendu PORTE les valeurs demandées (contrat historique de
      // `_materialFor`, que test/crop-eclairage ⑧e bis relit) ; au dessin,
      // `avantDessinTuile` les repose de toute façon pour CHAQUE tuile
      const u = partage.uniforms
      if (u && u.uTex) { u.uTex.value = texture; u.uTilePx.value = tilePx; u.uUvParMonde.value = uvParMonde }
      return partage
    },
    // ne jette jamais le matériau partagé : il survit à la tuile
    liberer(mesh) {
      const mm = mesh && mesh.material
      // R37 : un parent dessiné partiellement porte `[partagé, invisible]`
      const m = Array.isArray(mm) ? mm[0] : mm
      if (m && m !== partage) m.dispose()
    },
    // le maillage d'une tuile : ses valeurs propres et son `onBeforeRender`,
    // seulement quand le matériau est le partagé (sinon la tuile a le sien)
    equiper(mesh, texture, tilePx, uvParMonde) {
      if (!mesh || !partage || mesh.material !== partage) return false
      mesh.userData.tuile = valeursTuile(texture, tilePx, uvParMonde)
      mesh.onBeforeRender = avantDessinTuile
      return true
    },
  }
}

// La photo d'une tuile : sur le maillage quand le matériau est partagé, dans
// les uniformes du matériau propre sinon. `r` = { tex, ox, oy, sx, sy } ou null.
export function habillerPhotoTuile(mesh, r) {
  const v = mesh && mesh.userData && mesh.userData.tuile
  if (v) {
    if (!r) { v.uPhotoOn = 0; v.uPhoto = null; return true }
    v.uPhoto = r.tex
    v.uPhotoUv.set(r.ox, r.oy, r.sx, r.sy)
    v.uPhotoOn = 1
    return true
  }
  const u = mesh && mesh.material && mesh.material.uniforms
  if (!u || !u.uPhotoOn) return false // matériau emprunté par un test : rien à habiller
  if (!r) {
    // ⚠️ ON REND AUSSI LE SAMPLER, pas seulement le drapeau : une texture
    // évincée à laquelle un matériau tiendrait encore serait téléversée à la
    // première image où la tuile redeviendrait visible.
    u.uPhotoOn.value = 0
    u.uPhoto.value = null
    return true
  }
  u.uPhoto.value = r.tex
  u.uPhotoUv.value.set(r.ox, r.oy, r.sx, r.sy)
  u.uPhotoOn.value = 1
  return true
}

// Jeter le matériau d'une tuile depuis une méthode du globe — y compris quand
// la méthode est EMPRUNTÉE par un test sur un objet sans fabrique : alors
// c'est un dispose() ordinaire, comme avant.
export function libererMateriauTuile(globe, mesh) {
  const fab = globe && globe._fabriqueMateriau
  if (fab) return fab.liberer(mesh)
  const m = mesh && mesh.material
  if (m && typeof m.dispose === 'function') m.dispose()
}
