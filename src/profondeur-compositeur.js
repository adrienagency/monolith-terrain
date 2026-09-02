// LA PROFONDEUR DU COMPOSITEUR — deux défauts de `postprocessing` 6.39, tenus
// ici, hors de `main.js`, pour qu'ils soient testables sans navigateur.
//
// ⛔ **`GL_INVALID_OPERATION` À CHAQUE IMAGE COMPOSÉE — tracé, et ce n'était PAS
// un désaccord de format.** Le pilote dit exactement ce qu'il refuse (PF4,
// `scripts/profil-pf4.mjs --scenario gl`, 602 images sur 602) :
//
//   GL_INVALID_OPERATION: glBlitFramebuffer: Read and write depth stencil
//   attachments cannot be the same image.
//
// Deux causes empilées, et il faut les deux :
//
// ① **`SMAAEffect` déclare l'attribut `DEPTH`** (`CONVOLUTION | DEPTH`, valeur 3)
//    alors qu'en détection de contours COULEUR — le réglage par défaut, celui
//    d'ici — son nuanceur ne lit jamais la profondeur. La passe finale demande
//    donc une texture de profondeur, et le compositeur monte toute sa
//    machinerie : une `DepthTexture` 32F « vivante », une cible « stable », un
//    `blitFramebuffer` par image, et le rattachement de la profondeur aux deux
//    tampons ping-pong à chaque passe. **Pour un effet qui ne la lit pas.**
//    Sans SMAA-DEPTH, la composition par défaut n'a plus de texture de
//    profondeur du tout : zéro blit, zéro rattachement.
//
// ② **La copie « stable » est la MÊME image GL que l'originale.**
//    `EffectComposer.createDepthTexture()` fait `depthTexture.clone()` ; or
//    `Texture.clone()` partage la `Source` (three r172), et `WebGLTextures`
//    dédoublonne les textures GL PAR SOURCE — les deux objets JS pointent la
//    même `WebGLTexture`. Le blit copie donc l'image sur elle-même : refusé.
//    Ici, la stable reçoit une `Source` à elle. Ce cas ne se présente plus que
//    quand un effet lit vraiment la profondeur (bokeh allumé) — et là le blit
//    doit réussir, sinon la « stable » n'est jamais écrite.
//
// ⚠️ Vérifié à chaud avant correction : `props.get(stable).__webglTexture ===
// props.get(vivante).__webglTexture` → true. La version amont 6.39.4 clone
// encore ; ce n'est pas un défaut de cette installation.

import { DepthTexture } from 'three'

// L'attribut DEPTH de `postprocessing` (EffectAttribute.DEPTH). Passé par
// l'appelant plutôt qu'importé ici : ce module ne dépend que de three.
export function sansLectureDeProfondeur(effet, DEPTH = 1) {
  if (!effet || typeof effet.getAttributes !== 'function') return effet
  effet.setAttributes(effet.getAttributes() & ~DEPTH)
  return effet
}

// Remplace la copie stable par une texture à Source distincte. Idempotent :
// le compositeur ne crée sa profondeur qu'une fois (tant qu'un effet la lit).
export function copieStableDistincte(composer) {
  if (!composer || typeof composer.createDepthTexture !== 'function' || composer._copieStableDistincte) return composer
  const original = composer.createDepthTexture
  composer.createDepthTexture = function () {
    const clone = original.call(this)
    const cible = this.depthRenderTarget
    if (!cible || !clone) return clone
    // ⚠️ Pas `clone.clone()` : ce serait la même Source, donc la même image.
    const stable = new DepthTexture()
    stable.name = clone.name || 'EffectComposer.StableDepth'
    stable.type = clone.type
    stable.format = clone.format
    stable.compareFunction = clone.compareFunction ?? null
    cible.depthTexture = stable
    return stable
  }
  composer._copieStableDistincte = true
  return composer
}
