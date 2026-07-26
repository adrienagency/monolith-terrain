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

// Un demi-pas de quantification terrarium (1/256 m). En deçà, une altitude est
// tenue pour une ABSENCE de mesure et non pour un terrain à l'altitude zéro.
const NODATA_EPS = 1 / 512

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
    // ⚠️ UN ZÉRO EXACT DANS LE RELIEF DE RÉFÉRENCE N'EST PAS DE LA TERRE PLATE,
    // C'EST UNE ABSENCE DE DONNÉE — et c'est le cas le plus fréquent en mer.
    // Mesuré au large de Toulon à z12 : la tuile terrarium est à 100 % à zéro
    // exact, 0 % de valeurs négatives. À Santorin, 73 % de zéros et 12 m de
    // profondeur maximale. La raison : à ces zooms les tuiles AWS viennent de
    // l'EU-DEM, qui ne décrit QUE la terre ; la mer y est un remplissage.
    //
    // Les traiter comme de la terre revenait à interdire à GEBCO d'y toucher —
    // d'où des fonds parfaitement plats à zéro dès qu'on approchait, alors que
    // tout allait bien de loin (là, les tuiles portent encore de l'ETOPO1).
    //
    // Le seuil vaut un demi-pas de quantification terrarium (1/256 m) : un
    // relief réel ne rend quasiment jamais 0,000 pile, un remplissage si.
    const noData = l > -NODATA_EPS && l < NODATA_EPS
    // TERRE — intouchable, et c'est elle qui définit le rivage
    if (l >= level && !noData) {
      out[i] = l
      continue
    }
    const s = sea[i]
    if (!Number.isFinite(s)) {
      out[i] = l
      continue
    }
    // ⚠️ UN ÉCHANTILLON ÉMERGÉ N'EST PAS UN FOND À ZÉRO — c'est une ABSENCE.
    // Le tuileur aplatit délibérément la terre à 0 (le canal G y coûtait 62 Ko
    // par tuile pour une information que cette fonction n'utilise jamais). Ce 0
    // ne mesure donc rien.
    //
    // Sans ce test, `Math.min(s, level - SEA_EPS)` le ramenait à −0,05 m et
    // ÉCRASAIT la mer à zéro. Invisible au large, catastrophique près des côtes :
    // au-delà de z8 on surzoome, et à z14 la tuile entière est reconstruite
    // depuis 4×4 pixels de l'ancêtre — près d'un rivage, presque tous émergés.
    // C'est le fond plat à zéro vu sur Santorin et Toulon, alors que les tuiles
    // portaient bien −2 408 m et −2 432 m.
    if (s >= level) {
      out[i] = l
      continue
    }
    // MER — la source fine ne peut que creuser sous le niveau, jamais émerger
    const deep = Math.min(s, level - SEA_EPS)
    // FONDU — il mesure la DISTANCE AU RIVAGE, et il change de pilote seulement
    // là où le relief de référence n'a rien à dire.
    //
    // Quand la référence porte une vraie bathymétrie, sa propre profondeur est
    // le bon indicateur : on garde le comportement d'origine, au pixel près.
    // Quand elle est muette (remplissage à zéro), il ne reste que la source
    // fine — et c'est un indicateur légitime, GEBCO étant elle aussi peu
    // profonde près des côtes.
    //
    // ⚠️ Ne PAS prendre le maximum des deux : au large la source fine dit
    // −2 000 m partout, le fondu saturerait à 1 jusque sur le rivage et le
    // trait de côte sauterait. Mesuré : un pixel de bord passait à −400 m.
    const base = noData ? level : l
    const t = smooth((level - (noData ? deep : l)) / blend)
    out[i] = base + (deep - base) * t
  }
  return out
}

/**
 * LISSE LE FOND MARIN à l'échelle des facettes du surzoom.
 *
 * POURQUOI. Nos tuiles bathymétriques s'arrêtent à z8 — c'est la résolution
 * native de GEBCO, il n'y a rien de plus fin à avoir. Au-delà, `overzoomTile`
 * reconstruit la dalle depuis une sous-fenêtre de l'ancêtre : à z12 la tuile
 * entière vient de 4×4 pixels, à z14 de 2×2. L'agrandissement bilinéaire en
 * fait de grandes facettes plates aux arêtes franches — l'« effet creusement
 * par cube » signalé par Adrien. La quantification en profondeur du tuileur
 * (pas de 4 m puis 8 m) ajoute ses propres terrasses par-dessus.
 *
 * Lisser à la TAILLE DE LA FACETTE ne détruit aucune information réelle : sous
 * 463 m au sol, il n'y en a plus. Ça n'efface que l'artefact.
 *
 * DEUX PRÉCAUTIONS, et elles ne sont pas facultatives :
 *   · le flou n'additionne QUE des pixels de mer — mélanger la terre ferait
 *     remonter le fond près des côtes et redescendre le rivage ;
 *   · il s'éteint au voisinage du rivage, où le relief de référence fait
 *     autorité et où le trait de côte ne doit pas bouger d'un pixel.
 *
 * @param {Float32Array} data - altitudes en mètres, modifiées SUR PLACE
 * @param {number} size - côté de la grille carrée
 * @param {{radius?: number, seaLevel?: number, fadeDepth?: number}} [opts]
 * @returns {Float32Array} `data`
 */
export function smoothSeaFloor(data, size, opts = {}) {
  const r = Math.floor(opts.radius ?? 0)
  if (!data || r < 1 || size < 3) return data
  const level = opts.seaLevel ?? 0
  // au-dessus de cette profondeur le lissage s'éteint : c'est la zone où le
  // rivage se joue, et elle doit rester nette
  const fade = Math.max(1e-3, opts.fadeDepth ?? 40)
  const n = size * size
  const val = new Float32Array(n)
  const wgt = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const v = data[i]
    if (v < level) { val[i] = v; wgt[i] = 1 }
  }
  // flou par boîte séparable, en sommes glissantes : O(1) par pixel quel que
  // soit le rayon, sinon un rayon de 32 coûterait 65 fois le prix
  const boxPass = (src, horizontal) => {
    const dst = new Float32Array(n)
    const w = 2 * r + 1
    for (let a = 0; a < size; a++) {
      let acc = 0
      const at = (b) => (horizontal ? a * size + b : b * size + a)
      for (let b = -r; b <= r; b++) acc += src[at(Math.min(size - 1, Math.max(0, b)))]
      for (let b = 0; b < size; b++) {
        dst[at(b)] = acc / w
        acc += src[at(Math.min(size - 1, b + r + 1))] - src[at(Math.max(0, b - r))]
      }
    }
    return dst
  }
  const vB = boxPass(boxPass(val, true), false)
  const wB = boxPass(boxPass(wgt, true), false)
  for (let i = 0; i < n; i++) {
    const v = data[i]
    if (v >= level || wB[i] < 1e-4) continue
    const moyenne = vB[i] / wB[i]
    // plein effet au large, nul au rivage
    const k = smooth((level - v) / fade)
    data[i] = v + (moyenne - v) * k
  }
  return data
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
