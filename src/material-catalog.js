// Relief-material catalog — the single source of truth for every material the
// terrain can wear. Categories group the picker (nature / rock / sand / …) and
// the structure is deliberately open: adding a material is one entry here, and
// it flows to the terrain (OPAQUE_TERRAIN_MATS is derived from this) and to the
// Shaders-panel vignette picker with zero other edits.
//
//   kind 'glass' → the vendored transmission material (handled specially)
//   kind 'dir'   → real CC0 PBR set lazy-loaded from public/textures/<id>/
//                  (diff.jpg / nor_gl.jpg / rough.jpg) with a thumb.jpg vignette
//   kind 'tex'   → procedural CanvasTexture stack (material-textures.js), shown
//                  with a CSS `swatch` instead of an image thumbnail
//
// PBR sources: ambientCG & Poly Haven, all CC0 (see public/textures/LICENSE.txt).

// ordered category list — drives the grouping + labels in the picker
export const MATERIAL_CATEGORIES = [
  { id: 'premium', label: 'Premium' },
  { id: 'nature', label: 'Nature' },
  { id: 'roche', label: 'Roche' },
  { id: 'sable', label: 'Sable & sol' },
  { id: 'marbre', label: 'Marbre & pierre' },
  { id: 'neige', label: 'Neige' },
  { id: 'tissu', label: 'Tissu' },
  { id: 'metal', label: 'Métal' },
  { id: 'atelier', label: 'Procédural' },
]

// thumbnail path for a dir material
const thumb = (id) => `textures/${id}/thumb.jpg`

export const MATERIALS = [
  // --- premium -----------------------------------------------------------
  { id: 'glass', label: 'Verre', cat: 'premium', kind: 'glass', swatch: 'linear-gradient(135deg,#dbeafe,#f0f9ff 45%,#bae6fd)' },

  // --- nature ------------------------------------------------------------
  { id: 'grass', label: 'Herbe', cat: 'nature', kind: 'dir', dir: 'textures/grass/', thumb: thumb('grass'), metalness: 0, roughness: 0.9, normalScale: 1.4, envMapIntensity: 0.35, repeat: 8 },

  // --- roche -------------------------------------------------------------
  { id: 'rock036', label: 'Roche foncée', cat: 'roche', kind: 'dir', dir: 'textures/rock036/', thumb: thumb('rock036'), metalness: 0, roughness: 0.9, normalScale: 1.4, envMapIntensity: 0.4, repeat: 5 },
  { id: 'rock058', label: 'Roche brute', cat: 'roche', kind: 'dir', dir: 'textures/rock058/', thumb: thumb('rock058'), metalness: 0, roughness: 0.95, normalScale: 1.6, envMapIntensity: 0.4, repeat: 5 },
  { id: 'rock063', label: 'Roche patinée', cat: 'roche', kind: 'dir', dir: 'textures/rock063/', thumb: thumb('rock063'), metalness: 0, roughness: 0.92, normalScale: 1.5, envMapIntensity: 0.4, repeat: 5 },
  { id: 'rocks011', label: 'Éboulis', cat: 'roche', kind: 'dir', dir: 'textures/rocks011/', thumb: thumb('rocks011'), metalness: 0, roughness: 0.95, normalScale: 1.5, envMapIntensity: 0.4, repeat: 4 },

  // --- sable & sol -------------------------------------------------------
  // 'sand' (Sable moucheté) retiré du catalogue (Adrien).
  { id: 'ground081', label: 'Terre', cat: 'sable', kind: 'dir', dir: 'textures/ground081/', thumb: thumb('ground081'), metalness: 0, roughness: 0.95, normalScale: 1.3, envMapIntensity: 0.45, repeat: 7 },

  // --- marbre & pierre ---------------------------------------------------
  { id: 'marble021', label: 'Marbre veiné', cat: 'marbre', kind: 'dir', dir: 'textures/marble021/', thumb: thumb('marble021'), metalness: 0.05, roughness: 0.3, normalScale: 0.7, envMapIntensity: 1.1, repeat: 4 },
  { id: 'marble006', label: 'Marbre blanc', cat: 'marbre', kind: 'dir', dir: 'textures/marble006/', thumb: thumb('marble006'), metalness: 0.05, roughness: 0.28, normalScale: 0.6, envMapIntensity: 1.15, repeat: 4 },
  { id: 'onyx002', label: 'Onyx', cat: 'marbre', kind: 'dir', dir: 'textures/onyx002/', thumb: thumb('onyx002'), metalness: 0.1, roughness: 0.32, normalScale: 0.8, envMapIntensity: 1.0, repeat: 4 },
  // ═══════ LA PREMIÈRE MATIÈRE QUI LAISSE PASSER LA LUMIÈRE ══════════════════
  //
  // `sss` est un champ NOUVEAU et FACULTATIF : une matière qui ne le déclare pas
  // laisse le terme éteint (uMatSSS à zéro, voir terrain.js). L'albâtre est le
  // cas d'école — une pierre claire dont la crête s'allume par la tranche quand
  // le soleil passe derrière. C'est précisément ce que le marbre poli juste
  // au-dessus ne fait PAS : lui RENVOIE la lumière, il ne la laisse pas entrer.
  //
  //   force    combien de lumière ressort (0 à ~1,5)
  //   teinte   la couleur de ce qui a traversé — TOUJOURS plus chaude que la
  //            pierre : c'est le rouge qui se promène le plus loin dans un
  //            milieu diffusant, la raison pour laquelle une main devant une
  //            lampe est rouge et non grise
  //   nettete  l'exposant du halo : bas = diffusion large, haut = liseré serré
  //
  // ⚠️ SA RUGOSITÉ EST PLUS HAUTE QUE CELLE DU MARBRE, à dessein. Un albâtre
  // poli miroir renverrait tant de spéculaire que la lumière traversante
  // passerait dessous sans se voir — les deux se disputent le même pixel.
  //
  // Les images viennent du jeu onyx002 (ambientCG, CC0), copiées dans leur
  // propre dossier pour que la matière soit AUTONOME : un vrai relevé d'albâtre
  // s'y substituera sans toucher une ligne de code.
  //
  // ⚠️ PAS marble006, ET C'EST UNE MESURE, PAS UN GOÛT. Sa carte de diffusion a
  // une luminance moyenne de 25 sur 255 — c'est un marbre NOIR, malgré son
  // étiquette « Marbre blanc » deux lignes plus haut (défaut préexistant,
  // signalé à Adrien). Une pierre à 10 % de réflectance ne peut rien laisser
  // passer : le relief ressortait entièrement noir, et la diffusion, seule à
  // l'éclairer, se lisait comme un éclairage d'appoint au lieu d'une
  // translucidité. L'onyx est à 148 sur 255, et c'est de toute façon LA pierre
  // translucide de référence.
  { id: 'albatre', label: 'Albâtre', cat: 'marbre', kind: 'dir', dir: 'textures/albatre/', thumb: thumb('albatre'), metalness: 0, roughness: 0.52, normalScale: 0.5, envMapIntensity: 0.9, repeat: 4, sss: { force: 0.85, teinte: '#ff9a5e', nettete: 3.2 } },

  // --- neige -------------------------------------------------------------
  { id: 'snow014', label: 'Neige fraîche', cat: 'neige', kind: 'dir', dir: 'textures/snow014/', thumb: thumb('snow014'), metalness: 0, roughness: 0.6, normalScale: 1.1, envMapIntensity: 0.8, repeat: 6 },

  // --- tissu -------------------------------------------------------------
  { id: 'fabric062', label: 'Toile', cat: 'tissu', kind: 'dir', dir: 'textures/fabric062/', thumb: thumb('fabric062'), metalness: 0, roughness: 0.9, normalScale: 1.2, envMapIntensity: 0.35, repeat: 7 },

  // --- métal -------------------------------------------------------------
  { id: 'metal042a', label: 'Métal brossé', cat: 'metal', kind: 'dir', dir: 'textures/metal042a/', thumb: thumb('metal042a'), metalness: 0.9, roughness: 0.4, normalScale: 1.2, envMapIntensity: 1.4, repeat: 6 },
  { id: 'metal048c', label: 'Métal patiné', cat: 'metal', kind: 'dir', dir: 'textures/metal048c/', thumb: thumb('metal048c'), metalness: 0.85, roughness: 0.45, normalScale: 1.3, envMapIntensity: 1.4, repeat: 6 },

  // --- procédural (canvas) ----------------------------------------------
  { id: 'carbon', label: 'Carbone', cat: 'atelier', kind: 'tex', tex: 'carbon', swatch: 'linear-gradient(135deg,#1f2226,#3a3f45 50%,#15171a)', metalness: 0.45, roughness: 0.5, normalScale: 1.2, envMapIntensity: 1.3, repeat: 10 },
]

// derived lookup: id → material
export const MATERIAL_BY_ID = Object.fromEntries(MATERIALS.map((m) => [m.id, m]))

// materials grouped by category, in catalog order, skipping empty categories
export function materialsByCategory() {
  return MATERIAL_CATEGORIES.map((c) => ({ ...c, items: MATERIALS.filter((m) => m.cat === c.id) })).filter((c) => c.items.length)
}
