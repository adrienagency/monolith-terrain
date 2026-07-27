// ANALYSE DU RELIEF — les champs que le shader lit pour peindre autre chose
// qu'une rampe d'altitude.
//
// LE PROBLÈME. Aujourd'hui la couleur de la terre tient en deux lignes : une
// rampe 1D indexée par l'altitude, plus un brunissage des pentes fortes. Une
// rampe 1D donne NÉCESSAIREMENT une couleur constante le long de chaque courbe
// de niveau — c'est la définition même de « colorié par couche ». Deux points à
// 1 200 m, l'un au fond d'un vallon humide, l'autre sur une croupe sèche et
// ventée, reçoivent la même teinte. Sur les cartes qui font référence (Imhof,
// Tibor Nagy) ils n'ont pas la même.
//
// CE QUE CE MODULE FABRIQUE, et pourquoi chaque champ existe :
//
//   texShade  — le « peigné » des crêtes. Laplacien FRACTIONNAIRE de Leland
//               Brown : une dérivée d'ordre ~0,5, entre la pente (ordre 1) et
//               l'altitude (ordre 0). Pourquoi pas la pente ? Parce qu'une
//               dérivée PREMIÈRE ne distingue pas une crête d'un ravin : les
//               deux ont des flancs raides. La dérivée fractionnaire, elle,
//               répond à la COURBURE — positive sur une croupe convexe,
//               négative dans un talweg concave — tout en gardant, contrairement
//               au laplacien pur (ordre 2), la lisibilité des grandes formes.
//               C'est exactement la signature qu'on cherche.
//   wetness   — concavité à ~1 km : l'eau descend et s'accumule dans les creux.
//               Proxy grossier mais honnête de l'humidité topographique, et
//               c'est le SECOND AXE qui casse la coloration par couche.
//   aspect    — l'exposition, mais celle du MASSIF, pas celle du pixel.
//   hillshade — le modelé lumineux classique. Au dézoom, les bandes fines du
//               texture shading tombent sous la taille du pixel et se moyennent
//               en gris : c'est lui qui garde le massif lisible.
//
// Module PUR : ni DOM, ni three.js, ni fetch. Testable en node
// (test/terrain-analysis.test.js), sur le modèle de bathy.js et relief-grade.js.

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)

// Un DEM peut porter des trous (tuile absente → NaN, cf. decodeTerrarium). Une
// seule valeur non finie contamine TOUT le flou par sommes glissantes — la
// somme courante devient NaN et ne redevient jamais un nombre. On assainit donc
// à l'entrée plutôt que de tester à chaque pixel dans la boucle chaude.
function finiteCopy(src) {
  const out = new Float32Array(src.length)
  for (let i = 0; i < src.length; i++) {
    const v = src[i]
    out[i] = Number.isFinite(v) ? v : 0
  }
  return out
}

/**
 * Flou par boîte séparable, en SOMMES GLISSANTES : O(1) par pixel quel que soit
 * le rayon. C'est ce qui rend abordable une pile de 7 flous jusqu'au rayon 64
 * sur un DEM 768² — un flou naïf y coûterait 129 lectures par pixel.
 * Le patron existe déjà en Uint8 dans sea-mask.js (blurMask) ; ici en Float32
 * et sans la ré-addition de toute la fenêtre à chaque colonne.
 * Bords : la valeur du bord est répétée (clamp), jamais de retour à zéro qui
 * creuserait un faux fossé tout autour de la dalle.
 *
 * @param {Float32Array} src
 * @param {Float32Array} dst - peut être === src
 * @param {number} size - côté de la grille carrée
 * @param {number} r - rayon en pixels (fenêtre 2r+1)
 * @param {Float32Array} [tmp] - scratch réutilisable (évite une allocation)
 * @returns {Float32Array} dst
 */
export function boxBlur(src, dst, size, r, tmp) {
  const n = size * size
  if (!(r > 0)) {
    if (dst !== src) dst.set(src)
    return dst
  }
  const rr = Math.min(r | 0, size - 1)
  const w = 2 * rr + 1
  const inv = 1 / w
  const mid = tmp && tmp.length >= n ? tmp : new Float32Array(n)

  // --- passe horizontale
  for (let y = 0; y < size; y++) {
    const row = y * size
    let sum = src[row] * (rr + 1)
    for (let i = 1; i <= rr; i++) sum += src[row + Math.min(i, size - 1)]
    for (let x = 0; x < size; x++) {
      mid[row + x] = sum * inv
      sum += src[row + Math.min(x + rr + 1, size - 1)] - src[row + Math.max(x - rr, 0)]
    }
  }
  // --- passe verticale
  for (let x = 0; x < size; x++) {
    let sum = mid[x] * (rr + 1)
    for (let i = 1; i <= rr; i++) sum += mid[Math.min(i, size - 1) * size + x]
    for (let y = 0; y < size; y++) {
      dst[y * size + x] = sum * inv
      sum += mid[Math.min(y + rr + 1, size - 1) * size + x] - mid[Math.max(y - rr, 0) * size + x]
    }
  }
  return dst
}

/**
 * TEXTURE SHADING (Leland Brown) — laplacien fractionnaire d'ordre `alpha`.
 *
 * La formulation d'origine passe par une FFT : filtrer par |k|^alpha dans le
 * domaine de Fourier. On l'approxime ici par une somme pondérée de BANDES
 * PASSANTES, chacune étant la différence de deux flous d'octaves voisines :
 *
 *     T = Σ  r^(−alpha) · ( B_r(h) − B_2r(h) )     avec r = 1, 2, 4, 8, 16, 32
 *
 * Pourquoi c'est légitime : B_r − B_2r est un passe-bande centré sur la
 * fréquence 1/r, et pondérer chaque bande par r^(−alpha) revient à multiplier
 * le spectre par |k|^alpha en escalier d'octaves. On perd la précision de la
 * FFT, on gagne une passe linéaire sans dépendance et sans padding.
 *
 * SIGNE : sur une crête, le flou étroit retient le sommet que le flou large a
 * déjà rasé ⇒ B_r > B_2r ⇒ T positif. Dans un talweg, l'inverse ⇒ T négatif.
 * C'est CE signe qui donne le rendu peigné : les croupes s'éclaircissent, les
 * ravins se creusent, à altitude égale.
 *
 * @returns {Float32Array} T, en unités arbitraires (voir robustScale)
 */
export function textureShade(h, size, { alpha = 0.5, octaves = 6 } = {}) {
  const n = size * size
  const out = new Float32Array(n)
  if (!h || h.length < n || size < 3) return out
  const src = finiteCopy(h)
  const tmp = new Float32Array(n)
  let lo = boxBlur(src, new Float32Array(n), size, 1, tmp) // B_1
  let hi = new Float32Array(n)
  for (let k = 0; k < octaves; k++) {
    const r = 1 << k
    boxBlur(src, hi, size, r * 2, tmp) // B_2r
    const w = Math.pow(r, -alpha)
    for (let i = 0; i < n; i++) out[i] += w * (lo[i] - hi[i])
    const swap = lo // B_2r devient le B_r de l'octave suivante : zéro flou refait
    lo = hi
    hi = swap
  }
  return out
}

/**
 * ÉCHELLE ROBUSTE — le p95 de |T|, par échantillonnage.
 *
 * Sans lui, l'intensité du peigné dépendrait du terrain : les Alpes et un delta
 * hollandais ne produisent pas les mêmes amplitudes de courbure, à trois ordres
 * de grandeur près. En divisant par le p95 on obtient un champ dont l'échelle
 * est la même partout, et le curseur de l'UI redevient ce qu'il doit être : un
 * réglage de LOOK, pas une compensation de relief. Même doctrine que
 * relief-grade.js, qui cadre la rampe sur les quantiles au lieu du min/max.
 * Le p95 et non le max : un seul pixel aberrant (bord de tuile, artefact) ne
 * doit pas éteindre toute la carte.
 */
export function robustScale(T, { p = 0.95, samples = 4096 } = {}) {
  const n = T ? T.length : 0
  if (!n) return 1
  const count = Math.min(n, samples)
  // pas IMPAIR et parcours modulaire : un pas qui tomberait pile sur la largeur
  // de la grille n'échantillonnerait qu'une colonne — donc qu'un seul type de
  // terrain. L'imparité suffit à décorréler des tailles usuelles (768, 1024…).
  const step = Math.max(1, Math.floor(n / count)) | 1
  const vals = []
  let idx = 0
  for (let k = 0; k < count; k++) {
    const v = Math.abs(T[idx])
    if (Number.isFinite(v)) vals.push(v)
    idx = (idx + step) % n
  }
  if (!vals.length) return 1
  vals.sort((a, b) => a - b)
  const s = vals[Math.min(vals.length - 1, Math.round(clamp01(p) * (vals.length - 1)))]
  return s > 1e-12 ? s : 1 // terrain plat : repli neutre, jamais de division par 0
}

// Compression douce vers 0..1, 0,5 = neutre. x/(1+|x|) est une sigmoïde sans
// exponentielle : elle ne SATURE jamais vraiment, donc les extrêmes gardent un
// ordre au lieu de s'aplatir en 0 et 1 comme le ferait un clamp brutal.
const soft = (x) => 0.5 + 0.5 * (x / (1 + Math.abs(x)))

/**
 * T (unités arbitraires) → 0..1 encodable sur 8 bits, 0,5 = plat.
 * `k` est le gain avant compression : au-delà de ~2 le champ sature et le
 * peigné devient une gravure au trait.
 */
export function encodeTextureShade(T, scale, k = 1.6) {
  const n = T ? T.length : 0
  const out = new Float32Array(n)
  const s = Number.isFinite(scale) && scale > 1e-12 ? scale : 1
  const g = k / s
  for (let i = 0; i < n; i++) {
    const v = T[i]
    out[i] = Number.isFinite(v) ? soft(v * g) : 0.5
  }
  return out
}

// Rayon de flou en PIXELS pour une distance voulue en mètres. Un DEM z12 sous
// nos latitudes fait ~26 m/px, un z6 ~1 700 m/px : le même rayon en pixels n'y
// décrit pas du tout la même chose sur le terrain.
function radiusForMeters(meters, metersPerPixel, fallback, max) {
  if (!Number.isFinite(metersPerPixel) || metersPerPixel <= 0) return fallback
  return clamp(Math.round(meters / metersPerPixel), 1, max)
}

/**
 * HUMIDITÉ TOPOGRAPHIQUE (proxy) — concavité à grande échelle, ~1 km.
 *
 * L'eau descend et s'accumule là où le terrain est concave : fonds de vallon,
 * cirques, plaines d'épandage. On mesure donc l'écart entre l'altitude locale
 * et l'altitude MOYENNE du kilomètre alentour : positif = on est plus bas que
 * son voisinage = un creux qui collecte. C'est un proxy, pas un TWI hydrologique
 * (qui demanderait un calcul d'accumulation de flux) — mais c'est le terme
 * dominant du TWI, pour une passe de flou au lieu d'un tri topologique.
 *
 * @returns {Float32Array} 0..1, 0,5 = ni creux ni bosse, >0,5 = humide
 */
export function wetness(h, size, { radius = null, metersPerPixel = null, k = 1.6 } = {}) {
  const n = size * size
  if (!h || h.length < n || size < 3) return new Float32Array(n).fill(0.5)
  const r = radius ?? radiusForMeters(1000, metersPerPixel, 16, 96)
  const src = finiteCopy(h)
  const blur = boxBlur(src, new Float32Array(n), size, r)
  const c = blur // réutilisé sur place : blur devient la concavité
  for (let i = 0; i < n; i++) c[i] = blur[i] - src[i]
  return encodeTextureShade(c, robustScale(c), k)
}

/**
 * EXPOSITION DU MASSIF — l'orientation du versant, calculée sur un DEM FLOUTÉ
 * à ~500 m.
 *
 * ⚠️ LE PIÈGE, et il coûte cher si on l'oublie : terrain.js ajoute par-dessus le
 * DEM un bruit FBM de détail (params.detail). Une exposition calculée sur la
 * normale brute épouse ce bruit et la carte se MOUCHETTE — des milliers de
 * micro-versants alternant chaud et froid, un grain de poivre coloré. Or ce
 * qu'on veut peindre, ce n'est pas l'orientation d'un pixel, c'est celle du
 * VERSANT : l'adret et l'ubac sont des faits de massif. D'où le flou préalable.
 *
 * Convention de grille : y croît vers le SUD (ligne 0 = nord, comme le DEM et
 * comme le sampler de terrain.js). Le gradient (gx, gy) pointe vers le HAUT de
 * la pente en repère (est, sud) ; la direction de la FACE est donc −(gx, gy),
 * dont la composante nord vaut +gy.
 *
 * @returns {Float32Array} 0..1 — 0,5 = plat ou orienté est/ouest, 1 = plein nord
 */
export function aspectSmooth(h, size, { radius = null, metersPerPixel = null } = {}) {
  const n = size * size
  const out = new Float32Array(n).fill(0.5)
  if (!h || h.length < n || size < 3) return out
  const r = radius ?? radiusForMeters(500, metersPerPixel, 8, 48)
  const src = finiteCopy(h)
  const sm = boxBlur(src, new Float32Array(n), size, r)
  const mpp = Number.isFinite(metersPerPixel) && metersPerPixel > 0 ? metersPerPixel : 1

  const north = new Float32Array(n)
  const mag = new Float32Array(n)
  for (let y = 0; y < size; y++) {
    const y0 = Math.max(y - 1, 0) * size
    const y1 = Math.min(y + 1, size - 1) * size
    const row = y * size
    for (let x = 0; x < size; x++) {
      const x0 = Math.max(x - 1, 0)
      const x1 = Math.min(x + 1, size - 1)
      const gx = (sm[row + x1] - sm[row + x0]) / (2 * mpp)
      const gy = (sm[y1 + x] - sm[y0 + x]) / (2 * mpp)
      const m = Math.hypot(gx, gy)
      const i = row + x
      mag[i] = m
      north[i] = m > 1e-12 ? gy / m : 0
    }
  }
  // Un plat n'a pas d'exposition : le pixel doit rester NEUTRE, pas prendre une
  // direction tirée du bruit numérique. On pondère donc par la pente, avec un
  // seuil issu du terrain lui-même (p95) — sinon un même seuil en degrés
  // rendrait toute une plaine neutre ou toute une montagne saturée.
  const ref = Math.max(robustScale(mag) * 0.3, 1e-9)
  for (let i = 0; i < n; i++) {
    const w = mag[i] / (mag[i] + ref)
    out[i] = clamp01(0.5 + 0.5 * north[i] * w)
  }
  return out
}

/**
 * OMBRAGE CLASSIQUE (Horn) — le modelé lumineux d'atlas, soleil au nord-ouest.
 *
 * Il fait doublon avec l'éclairage three.js ? Non : celui-ci est CUIT dans les
 * données, donc il survit au dézoom et à la nuit, et surtout il porte les
 * grandes formes là où le texture shading, tout en bandes fines, se moyenne en
 * gris uniforme dès que ses bandes passent sous la taille du pixel.
 *
 * @returns {Float32Array} 0..1
 */
export function hillshade(h, size, { metersPerPixel = 30, azimuthDeg = 315, altitudeDeg = 45, zFactor = 1 } = {}) {
  const n = size * size
  const out = new Float32Array(n).fill(0.5)
  if (!h || h.length < n || size < 3) return out
  const src = finiteCopy(h)
  const mpp = Number.isFinite(metersPerPixel) && metersPerPixel > 0 ? metersPerPixel : 1
  const az = (azimuthDeg * Math.PI) / 180
  const alt = (altitudeDeg * Math.PI) / 180
  // repère (est, sud, haut) : le nord vaut (0, −1, 0), d'où le signe du sud
  const sx = Math.sin(az) * Math.cos(alt)
  const sy = -Math.cos(az) * Math.cos(alt)
  const sz = Math.sin(alt)
  for (let y = 0; y < size; y++) {
    const y0 = Math.max(y - 1, 0) * size
    const y1 = Math.min(y + 1, size - 1) * size
    const row = y * size
    for (let x = 0; x < size; x++) {
      const x0 = Math.max(x - 1, 0)
      const x1 = Math.min(x + 1, size - 1)
      const gx = ((src[row + x1] - src[row + x0]) / (2 * mpp)) * zFactor
      const gy = ((src[y1 + x] - src[y0 + x]) / (2 * mpp)) * zFactor
      const inv = 1 / Math.sqrt(gx * gx + gy * gy + 1)
      out[row + x] = clamp01((-gx * sx - gy * sy + sz) * inv)
    }
  }
  return out
}

/**
 * Empaquette les quatre champs dans une RGBA 8 bits, prête pour une DataTexture.
 * Un seul texture2D dans le shader porte donc TOUTE l'analyse : le coût GPU du
 * nouveau rendu est exactement celui de l'ancien (une lecture de rampe), ce qui
 * est la raison pour laquelle ce chantier tient dans le budget.
 * Canal absent ⇒ 0,5, c'est-à-dire « neutre » pour les quatre.
 */
export function packAnalysis({ texShade = null, hillshade: hs = null, wetness: wet = null, aspect = null } = {}, size) {
  const n = size * size
  const out = new Uint8Array(n * 4)
  const q = (arr, i) => {
    const v = arr ? arr[i] : 0.5
    return Math.round(clamp01(Number.isFinite(v) ? v : 0.5) * 255)
  }
  for (let i = 0; i < n; i++) {
    out[i * 4] = q(texShade, i)
    out[i * 4 + 1] = q(hs, i)
    out[i * 4 + 2] = q(wet, i)
    out[i * 4 + 3] = q(aspect, i)
  }
  return out
}

/**
 * SOUS-ÉCHANTILLONNAGE PAR MOYENNE DE BLOCS.
 *
 * ⚠️ MOYENNE ET NON PLUS-PROCHE-VOISIN, et ce n'est pas un raffinement : les
 * quatre champs de ce module sont des DÉRIVÉES du relief. Décimer en piquant un
 * pixel sur deux garderait le bruit haute fréquence du MNT et le replierait sur
 * les basses fréquences (aliasing) — le peigné des crêtes se mettrait à
 * moucheter au lieu de s'adoucir. La moyenne est le filtre passe-bas minimal
 * qui rend l'opération honnête.
 *
 * Le dernier bloc est TRONQUÉ quand le côté n'est pas divisible : on moyenne ce
 * qui existe plutôt que de lire hors du tableau.
 *
 * @returns {{data: Float32Array, size: number}}
 */
export function coarsenField(src, size, factor) {
  const f = Math.max(1, factor | 0)
  if (f === 1) return { data: src, size }
  const out = Math.ceil(size / f)
  const dst = new Float32Array(out * out)
  for (let y = 0; y < out; y++) {
    const y0 = y * f
    const y1 = Math.min(size, y0 + f)
    for (let x = 0; x < out; x++) {
      const x0 = x * f
      const x1 = Math.min(size, x0 + f)
      let somme = 0
      let n = 0
      for (let yy = y0; yy < y1; yy++) {
        const row = yy * size
        for (let xx = x0; xx < x1; xx++) {
          const v = src[row + xx]
          if (Number.isFinite(v)) { somme += v; n++ }
        }
      }
      dst[y * out + x] = n ? somme / n : 0
    }
  }
  return { data: dst, size: out }
}

/**
 * La chaîne complète, telle que terrain.js la consomme : un DEM en mètres →
 * la RGBA empaquetée. Regroupée ici (et non dans terrain.js) pour que le
 * pipeline entier reste testable sans navigateur.
 *
 * `maxSize` PLAFONNE le côté de l'analyse. Il existe pour les dalles VOISINES du
 * damier : elles héritaient d'une analyse à la taille du MNT (1536²) alors que
 * leur maillage est quatre fois plus grossier — 12 Mo de texture (mipmaps
 * comprises) et ~390 ms de flous par dalle pour un détail que la géométrie ne
 * peut pas restituer. Le bloc central, lui, ne passe JAMAIS de plafond : c'est
 * le héros, il porte le maillage qui justifie la finesse.
 *
 * @param {{data: Float32Array, size: number, metersPerPixel?: number}} dem
 */
export function analyzeDem(dem, { alpha = 0.5, octaves = 6, k = 1.6, maxSize = 0 } = {}) {
  // ⚠️ metersPerPixel SUIT le sous-échantillonnage. Les rayons de flou de
  // wetness (~1 km) et aspectSmooth (~500 m) sont exprimés en MÈTRES puis
  // convertis en pixels : oublier de le corriger doublerait leur portée
  // terrain et étalerait l'humidité sur deux kilomètres.
  const facteur = maxSize > 0 && dem.size > maxSize ? Math.ceil(dem.size / maxSize) : 1
  const { data, size } = coarsenField(dem.data, dem.size, facteur)
  const mpp = Number.isFinite(dem.metersPerPixel) ? dem.metersPerPixel * facteur : dem.metersPerPixel
  const T = textureShade(data, size, { alpha, octaves })
  const rgba = packAnalysis(
    {
      texShade: encodeTextureShade(T, robustScale(T), k),
      hillshade: hillshade(data, size, { metersPerPixel: mpp }),
      wetness: wetness(data, size, { metersPerPixel: mpp }),
      aspect: aspectSmooth(data, size, { metersPerPixel: mpp }),
    },
    size
  )
  return { rgba, size }
}
