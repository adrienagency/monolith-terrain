// OMBRAGE AUTO — calcule les 4 réglages de la section « Ombrage » du panneau
// Terrain (teinte hypsométrique, contraste d'altitude, pivot d'altitude,
// ombrage des pentes) à partir du relief RÉELLEMENT chargé. Module PUR : ni
// DOM ni three.js, testable en node (test/relief-grade.test.js).
//
// CONTRAINTE DE DÉPART (le shader, terrain.js) — le fragment lit :
//     hNorm = (y − minH) / (maxH − minH)            ← normalisé sur TOUT le DEM
//     rampT = clamp(0.5 + (hNorm − pivot) × contraste, 0, 1)
// L'amplitude en mètres est donc DÉJÀ annulée par la normalisation. Ce qui
// décide du rendu, ce n'est pas « 4000 m ou 30 m », c'est la POSITION et la
// LARGEUR du nuage d'altitudes ÉMERGÉES à l'intérieur de [minM, maxM].
//
// RÈGLE RETENUE
//   · pivot     = médiane des altitudes émergées (ramenée en hNorm). La teinte
//                 du MILIEU de la rampe tombe là où il y a de la matière : la
//                 rampe hypsométrique utilise toute sa gamme au lieu de gâcher
//                 la moitié de ses arrêts sous la mer ou au-dessus des crêtes.
//   · contraste = SPAN / (p92 − p08) des mêmes altitudes. Un grand dénivelé
//                 étale le nuage → bande large → contraste DOUX (sinon tout
//                 sature en deux aplats) ; un delta plat tasse tout en bas de
//                 la plage → bande étroite → contraste FORT (sinon aplat
//                 uniforme). Les 8 % de queue saturent VOLONTAIREMENT : c'est
//                 ce qui donne les sommets « neige » et les fonds unis.
//   · les deux réglages « matière » suivent la PENTE moyenne réelle, mesurée
//     par le rapport de relief r = (maxM − minM) / extentM (sans dimension) :
//       slopeTint monte avec r — pas de pentes = rien à ombrer, et sur un plat
//                 un fort ombrage de pente ne ferait que salir la carte ;
//       mapTint   descend quand r monte — sur un relief tourmenté le modelé
//                 lumineux (hillshade) raconte déjà tout, la rampe peut se
//                 faire discrète ; sur un plat elle est la SEULE à parler.

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
const r2 = (v) => Math.round(v * 100) / 100
const r1 = (v) => Math.round(v * 10) / 10

// Largeur de la fenêtre de rampe, en fraction de la bande p08–p92 utile.
// 1 / SPAN < 1 ⇒ la rampe déploie ses 8 teintes sur un peu MOINS que la bande
// utile, les queues saturent : c'est le « punch » des planches d'Adrien.
const SPAN = 1.15

// Garde-fous (jamais de réglage moche, même sur un DEM dégénéré). Les bornes
// restent DANS les plages des curseurs de l'UI (create-panel.js).
const CONTRAST_MIN = 1.2
const CONTRAST_MAX = 12
const PIVOT_MIN = 0.06
const PIVOT_MAX = 0.94
// bornes calées sur les valeurs des planches d'Adrien (templates.js) : la
// teinte descend au plus bas à 0.68 (= ICELAND, le plus sculpté) et l'ombrage
// de pente plafonne à 0.55 (= FALLOUT WASTELANDS, le plus mordant) — au-delà
// les versants virent au brun boueux.
const TINT_MIN = 0.68
const TINT_MAX = 0.95
const SLOPE_MIN = 0.08
const SLOPE_MAX = 0.55

// Emprise horizontale par défaut si l'appelant ne la fournit pas : un bloc de
// 3 tuiles au zoom 11 sous nos latitudes ≈ 20 km.
const DEFAULT_EXTENT_M = 20000

// Repli neutre : un DEM plat comme une table, ou illisible.
export const NEUTRAL_GRADE = Object.freeze({ mapTint: 0.9, heightContrast: 4, heightPivot: 0.5, slopeTint: 0.2 })

// Histogramme d'altitudes sur [minM, maxM] — une passe sur le DEM brut.
// `data` : Float32Array (dem.data) ou n'importe quel tableau indexable.
export function elevationHistogram(data, minM, maxM, bins = 256) {
  const hist = new Uint32Array(bins)
  const span = maxM - minM
  if (!(span > 0) || !data || !data.length) return hist
  const k = bins / span
  for (let i = 0; i < data.length; i++) {
    const b = (data[i] - minM) * k
    hist[b <= 0 ? 0 : b >= bins ? bins - 1 : b | 0]++
  }
  return hist
}

// Quantile en MÈTRES lu dans l'histogramme, en ne comptant que les cases au
// -dessus de `floorM` (le niveau de la mer pour nous). Renvoie null si aucune
// case ne passe le seuil — l'appelant décide alors du repli.
export function quantileFromHistogram(hist, minM, maxM, q, floorM = -Infinity) {
  const bins = hist.length
  const span = maxM - minM
  if (!(span > 0) || !bins) return null
  const w = span / bins
  // première case dont le CENTRE est au-dessus du plancher
  let first = 0
  while (first < bins && minM + (first + 0.5) * w < floorM) first++
  let total = 0
  for (let i = first; i < bins; i++) total += hist[i]
  if (!total) return null
  const target = q * total
  let acc = 0
  for (let i = first; i < bins; i++) {
    acc += hist[i]
    if (acc >= target) return minM + (i + 0.5) * w
  }
  return maxM
}

// Repli SANS histogramme : on modélise la courbe hypsométrique des terres
// émergées par une loi puissance de CDF F(x) = x^γ sur [0, 1] (x = altitude
// normalisée sur la bande émergée). Sa moyenne vaut γ/(γ+1), donc γ se déduit
// en forme close de la moyenne observée — pas d'itération, testable. La
// hypsométrie réelle est bien de cette famille : beaucoup de bas, peu de haut.
function powerLawQuantiles(landLo, maxM, meanLand, qs) {
  const w = maxM - landLo
  if (!(w > 0)) return qs.map(() => landLo)
  const m = clamp((meanLand - landLo) / w, 0.05, 0.95)
  const gamma = m / (1 - m)
  const invG = 1 / gamma
  return qs.map((q) => landLo + w * Math.pow(q, invG))
}

// gradeForDem({minM, maxM, meanM, histogram?, extentM?}) → les 4 réglages.
// `histogram` : sortie de elevationHistogram (fortement recommandé — sans lui
// on retombe sur l'approximation en loi puissance ci-dessus).
export function gradeForDem({ minM, maxM, meanM, histogram = null, extentM = DEFAULT_EXTENT_M } = {}) {
  if (!Number.isFinite(minM) || !Number.isFinite(maxM) || maxM - minM < 1e-6) return { ...NEUTRAL_GRADE }
  const amplitude = maxM - minM
  const mean = Number.isFinite(meanM) ? clamp(meanM, minM, maxM) : (minM + maxM) / 2

  // --- bande ÉMERGÉE : au-dessus de 0 m. Un bloc entièrement sous l'eau
  // (plein océan) n'a pas de terre à cadrer → on cadre alors tout le DEM.
  const hasLand = maxM > 0
  const landLo = hasLand ? Math.max(minM, 0) : minM

  let p08 = null, p50 = null, p92 = null
  if (histogram && histogram.length) {
    const floor = hasLand ? 0 : -Infinity
    p08 = quantileFromHistogram(histogram, minM, maxM, 0.08, floor)
    p50 = quantileFromHistogram(histogram, minM, maxM, 0.5, floor)
    p92 = quantileFromHistogram(histogram, minM, maxM, 0.92, floor)
  }
  if (p08 == null || p50 == null || p92 == null) {
    // moyenne des TERRES : meanM porte aussi le fond marin, donc il la tire
    // vers le bas — on la remonte au moins un peu au-dessus du rivage.
    const meanLand = Math.max(mean, landLo + 0.05 * (maxM - landLo))
    ;[p08, p50, p92] = powerLawQuantiles(landLo, maxM, meanLand, [0.08, 0.5, 0.92])
  }

  // --- pivot : la médiane émergée, ramenée dans l'espace hNorm du shader
  const toNorm = (m) => (m - minM) / amplitude
  const heightPivot = clamp(toNorm(p50), PIVOT_MIN, PIVOT_MAX)

  // --- contraste : inverse de la largeur de la bande utile (en hNorm)
  const band = Math.max(toNorm(p92) - toNorm(p08), 1e-3)
  const heightContrast = clamp(SPAN / band, CONTRAST_MIN, CONTRAST_MAX)

  // --- rapport de relief → les deux réglages « matière »
  const ext = Number.isFinite(extentM) && extentM > 0 ? extentM : DEFAULT_EXTENT_M
  // r ≈ 0.001 (delta plat) · 0.03 (moyenne montagne) · 0.15 (haute montagne)
  const rugged = clamp(amplitude / ext / 0.06, 0, 1) // saturé vers 0.06 = alpin
  const slopeTint = clamp(SLOPE_MIN + (SLOPE_MAX - SLOPE_MIN) * rugged, SLOPE_MIN, SLOPE_MAX)
  const mapTint = clamp(TINT_MAX - (TINT_MAX - TINT_MIN) * rugged, TINT_MIN, TINT_MAX)

  return {
    mapTint: r2(mapTint),
    heightContrast: r1(heightContrast),
    heightPivot: r2(heightPivot),
    slopeTint: r2(slopeTint),
  }
}
