// BATHYMÉTRIE — fusionner un relief terrarium avec une source marine plus fine.
//
// Pourquoi : les tuiles terrarium d'AWS n'ont sous l'eau qu'ETOPO1, à ~1 850 m
// de résolution. Les bassins sont lisses, les dorsales floues, et une côte est
// illisible. GEBCO_2026 donne 464 m (et les sources côtières régionales
// descendent bien plus bas encore) — d'où ce module, qui décide COMMENT les
// deux se rencontrent.
//
// LA RÈGLE, en une phrase : la terre ne bouge jamais, la mer prend la
// profondeur de la source fine, et le raccord se fait en fondu au large.
//
// ⚠️ « La terre ne bouge jamais » n'est pas une précaution de style, c'est la
// leçon d'une session entière passée sur les polders : un trait de côte qui se
// déplace d'un pixel, et Amsterdam se retrouve sous la mer du Nord. La source
// fine ne sert donc QU'À CREUSER — elle ne peut jamais faire émerger un pixel
// que le relief de référence dit immergé, ni l'inverse.
//
// Module PUR : ni DOM, ni three.js, ni fetch. Testable en node.

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)
const smooth = (t) => {
  const x = clamp01(t)
  return x * x * (3 - 2 * x)
}

// Profondeur (en mètres sous 0) à partir de laquelle la source fine parle
// SEULE. Au-dessus, on mélange, pour que le raccord au rivage soit invisible.
export const BLEND_DEPTH = 25

// Un pixel de mer reste de la mer : on ne le laisse jamais remonter à 0.
const SEA_EPS = 0.05

/**
 * Fusionne deux champs d'altitude de MÊME taille, en mètres.
 *
 * @param {Float32Array} land - relief de référence (terrarium). Fait autorité
 *   sur le trait de côte et sur toute la terre émergée.
 * @param {Float32Array|null} sea - bathymétrie fine, alignée pixel à pixel.
 *   `null` ou taille différente ⇒ on rend `land` inchangé (repli sûr).
 * @param {{blendDepth?: number, seaLevel?: number}} [opts]
 * @returns {Float32Array} un NOUVEAU tableau (les entrées ne sont pas mutées)
 */
export function fuseBathymetry(land, sea, opts = {}) {
  if (!land) return land
  if (!sea || sea.length !== land.length) return land.slice()
  const blend = Math.max(1e-3, opts.blendDepth ?? BLEND_DEPTH)
  const level = opts.seaLevel ?? 0
  const out = new Float32Array(land.length)
  for (let i = 0; i < land.length; i++) {
    const l = land[i]
    // TERRE — intouchable, et c'est elle qui définit le rivage
    if (l >= level) {
      out[i] = l
      continue
    }
    const s = sea[i]
    if (!Number.isFinite(s)) {
      out[i] = l
      continue
    }
    // MER — la source fine ne peut que creuser sous le niveau, jamais émerger
    const deep = Math.min(s, level - SEA_EPS)
    // fondu : 0 au rivage (on garde le relief de référence), 1 au large
    const t = smooth((level - l) / blend)
    out[i] = l + (deep - l) * t
  }
  return out
}

/**
 * Décode un bloc RGBA de tuiles terrarium en mètres.
 * meters = R*256 + G + B/256 − 32768 — le même encodage que nos tuiles, ce qui
 * permet de servir la bathymétrie SANS toucher au décodeur du terrain.
 *
 * @param {Uint8ClampedArray|Uint8Array} rgba
 * @param {Float32Array} [into] - tableau à remplir (évite une allocation)
 */
// ⚠️ L'ALPHA EST LA DONNÉE MANQUANTE, et c'est le piège de ce module. Un
// canevas naît en noir TRANSPARENT ; là où aucune tuile n'a été peinte — cas
// NORMAL, puisqu'on n'écrit pas les tuiles sans mer — le triplet (0,0,0) se
// décode en −32768 m, soit « fosse abyssale ». Bug vu à l'écran : la mer Égée
// passait de −4 427 m à −32 768 m de fond. On rend donc NaN sur alpha nul, et
// la fusion l'ignore comme n'importe quelle valeur non finie.
export function decodeTerrarium(rgba, into) {
  const n = rgba.length >> 2
  const out = into && into.length === n ? into : new Float32Array(n)
  for (let i = 0; i < n; i++) {
    if (rgba[i * 4 + 3] === 0) {
      out[i] = NaN
      continue
    }
    out[i] = rgba[i * 4] * 256 + rgba[i * 4 + 1] + rgba[i * 4 + 2] / 256 - 32768
  }
  return out
}

/**
 * Encode une altitude en mètres vers le triplet terrarium.
 * Réciproque exacte de `decodeTerrarium` à 1/256 m près — c'est ce que le
 * tuileur écrit dans les PNG.
 *
 * @param {number} m - mètres
 * @returns {[number, number, number]} R, G, B entiers 0-255
 */
export function encodeTerrarium(m) {
  // la plage encodable est [−32768, +32767.996] ; on borne plutôt que de
  // laisser un débordement produire une altitude absurde
  const v = Math.min(32767.99, Math.max(-32768, m)) + 32768
  const r = Math.floor(v / 256)
  const g = Math.floor(v - r * 256)
  const b = Math.round((v - r * 256 - g) * 256)
  // l'arrondi de B peut atteindre 256 : on reporte sur G (et G sur R)
  if (b === 256) return g === 255 ? [r + 1, 0, 0] : [r, g + 1, 0]
  return [r, g, b]
}

/**
 * Quelle tuile de notre jeu bathymétrique couvre la tuile demandée ?
 * Notre jeu s'arrête à `maxZoom` (au-delà, la donnée n'a rien de plus à dire) :
 * une demande plus profonde retombe sur l'ancêtre, avec la sous-fenêtre à y
 * lire. C'est le SURZOOM, et il est honnête : un fond marin à 464 m est lisse
 * par nature, l'interpoler n'invente rien.
 *
 * @returns {{z:number, x:number, y:number, scale:number, ox:number, oy:number}}
 *   scale = combien de fois la tuile ancêtre est plus large ; ox/oy = position
 *   de la sous-fenêtre, en fraction de l'ancêtre (0..1).
 */
export function overzoomTile(z, x, y, maxZoom) {
  if (z <= maxZoom) return { z, x, y, scale: 1, ox: 0, oy: 0 }
  const d = z - maxZoom
  const scale = 2 ** d
  const px = Math.floor(x / scale)
  const py = Math.floor(y / scale)
  return { z: maxZoom, x: px, y: py, scale, ox: (x - px * scale) / scale, oy: (y - py * scale) / scale }
}
