// TEINTE DE L'INTERFACE — les jetons CSS de v28.css dérivés de la PALETTE de la
// carte, sous garantie de lisibilité. Module PUR : ni DOM, ni three.js, ni
// fetch (même contrat que bathy.js / relief-grade.js), testable en node
// (test/ui-theme.test.js).
//
// POURQUOI. Le projet dérive déjà trois choses de la palette : l'ombre ambiante
// (deriveAoColor), la brume (deriveHazeColor) et le liseré métal de la barre
// liquide (deriveMetalTints). L'interface, elle, restait en STONE fixe : une
// carte lagon turquoise portait un cartouche brun chaud, et ça se voyait. Ici on
// va au bout du même patron — mais une interface n'est pas un décor : si un
// jeton devient illisible, la fonctionnalité coûte plus qu'elle ne rapporte.
// D'où la moitié « garantie » de ce fichier, qui BORNE la clarté jusqu'à ce que
// le ratio WCAG passe au lieu d'espérer qu'il passe.
//
// LES TROIS RÈGLES
//   1. Point de départ = les valeurs EXACTES de v28.css. Chaque jeton est
//      interpolé de sa valeur d'usine vers sa cible teintée par `strength`.
//      À strength = 0 la sortie reproduit v28.css à l'octet près : c'est le
//      repli sûr, et c'est ce que le test « identité » vérifie.
//   2. Les neutres portent un BIAIS LÉGER, pas une couleur. Une chroma forte
//      sur un fond d'interface fatigue en dix minutes et date en un an. Les
//      cibles ci-dessous sont volontairement basses (0.008–0.016) : à l'écran
//      c'est la différence entre « posé à côté de la carte » et « accordé ».
//      L'ombre, elle, a droit à plus de chroma (règle du peintre — même
//      raisonnement que deriveAoColor : une ombre n'est pas grise).
//   3. L'accent TOURNE. Un accent à la teinte de la carte se noie dans le
//      relief — c'est précisément le pixel qui doit rester trouvable. Il part
//      donc à +150° (complémentaire fendue) : assez loin pour ne jamais être
//      confondu avec la carte, assez près pour rester un accord et pas un
//      juron. Le liseré liquide (--lq-m1/--lq-m2) chante la tonique, l'accent
//      chante sa complémentaire : c'est un accord, les deux racontent bien la
//      même palette. Seul jeton à BASCULER au lieu de se fondre : un accent
//      à mi-chemin serait un beige mort (voir uiTokenBases).
//
// CE QUE « CONTRASTE » VEUT DIRE ICI. Le verre est translucide au-dessus d'une
// carte 3D dont on ne sait rien : aucun ratio n'est calculable contre un
// arrière-plan inconnu. Le contrat porte donc sur la COULEUR DE BASE du verre,
// prise opaque — c'est la surface que le backdrop-filter (blur 20px +
// saturate 1.5) fait tendre vers elle, et c'est déjà le contrat implicite du
// design actuel (les valeurs d'usine le passent). Tout ce que ce module promet,
// il le promet sur cette base-là, et le test le mesure exactement comme ça.

import { srgbToOklab, oklabToSrgb, oklabToLch, lchToOklab } from './palette.js'

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
const clamp01 = (v) => clamp(v, 0, 1)
const HEX_RE = /^#?[0-9a-fA-F]{6}$/

// ------------------------------------------------------------------ couleurs
export function hexToRgb(hex) {
  const s = String(hex).trim()
  if (!HEX_RE.test(s)) return [0, 0, 0]
  const n = parseInt(s.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const rgbToHex = (r, g, b) =>
  `#${[r, g, b].map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('')}`

// Luminance RELATIVE au sens WCAG 2.x (sRGB linéarisé, pondération BT.709).
// Ce n'est PAS le L d'Oklab : Oklab sert à raisonner la couleur, WCAG à juger
// la lisibilité. Les confondre est l'erreur classique du sujet.
export function relativeLuminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const x = v / 255
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

// Ratio de contraste WCAG : (Lclair + 0.05) / (Lsombre + 0.05), ∈ [1, 21].
export function contrastRatio(a, b) {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

// `fg` posé à l'opacité `alpha` sur `bg` opaque → la couleur RÉELLEMENT vue.
// Indispensable pour --ce-muted, qui n'est pas une couleur mais une encre à 55 %.
export function compositeOver(fg, alpha, bg) {
  const f = hexToRgb(fg)
  const b = hexToRgb(bg)
  const a = clamp01(alpha)
  return rgbToHex(f[0] * a + b[0] * (1 - a), f[1] * a + b[1] * (1 - a), f[2] * a + b[2] * (1 - a))
}

const lch = (hex) => oklabToLch(srgbToOklab(hex))

// ------------------------------------------------------------ mise en gamut
// oklabToSrgb CLAMPE canal par canal quand la couleur sort du cube sRGB, et
// palette.js le dit : « brutal mais prévisible ». Prévisible pour un décalage
// de chroma minuscule ; pas pour un accent. Un bleu franc demandé à L 0.65 /
// C 0.185 n'existe pas en sRGB : le clamp l'a rendu VERT une fois sur le
// catalogue (palette « ecrins », teinte demandée 219°, teinte obtenue 145°).
// Un accent qui change de famille de couleur n'est plus un accent.
//
// La parade standard : garder la CLARTÉ et la TEINTE, sacrifier la chroma —
// on descend C jusqu'à ce que l'aller-retour rende bien la couleur demandée.
// Dichotomie sur C, avec palette.js comme seul convertisseur (aucune matrice
// réécrite ici). La tolérance est en distance Oklab, donc insensible au bruit
// de quantification 8 bits, qui vaut ~0.002.
function faithful(hex, L, C, h) {
  const want = lchToOklab({ L, C, h })
  const got = srgbToOklab(hex)
  return Math.hypot(got.a - want.a, got.b - want.b) <= 0.006 && Math.abs(got.L - L) <= 0.012
}
function toHex(L0, C0, h) {
  const L = clamp01(L0)
  const C = Math.max(0, C0)
  const hex = oklabToSrgb(lchToOklab({ L, C, h }))
  if (C < 1e-4 || faithful(hex, L, C, h)) return hex
  let lo = 0 // C = 0 est toujours dans le gamut (un gris de clarté L)
  let hi = C
  for (let i = 0; i < 18; i++) {
    const m = (lo + hi) / 2
    if (faithful(oklabToSrgb(lchToOklab({ L, C: m, h })), L, m, h)) lo = m
    else hi = m
  }
  return oklabToSrgb(lchToOklab({ L, C: lo, h }))
}
const rgba = (hex, a) => {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${a})`
}
// ------------------------------------------------------ la teinte de la carte
// MOYENNE VECTORIELLE PONDÉRÉE des arrêts en Oklab, et pas « le stop dominant ».
// Pourquoi le vecteur : chaque arrêt est un vecteur (a, b) dont la LONGUEUR est
// sa chroma. Les moyenner, c'est laisser les arrêts colorés décider et les gris
// se taire tout seuls — une rampe qui monte vers la neige ne se fait pas voler
// sa teinte par son sommet blanc. Et la longueur du vecteur moyen est
// exactement l'indicateur dont on a besoin : elle tombe à zéro pour une rampe
// monochrome (rien à teinter) ET pour une rampe dont les teintes s'annulent
// (vert + magenta : aucune dominante honnête à revendiquer). Un seul nombre
// répond donc aux deux questions « quelle teinte ? » et « à quel point ? ».
//
// Seule pondération explicite : la LARGEUR de bande que chaque arrêt gouverne
// (trapèzes). Sur une rampe aux arrêts inégaux, un long plateau pèse plus qu'un
// arrêt de transition, et les extrémités comptent naturellement pour moitié.
// Rien de plus : la chroma n'a pas besoin d'être remise en poids, elle EST déjà
// la longueur du vecteur qu'on additionne.
export function paletteTint(stops) {
  const list = (Array.isArray(stops) ? stops : [])
    .map((s) => (typeof s === 'string' ? { c: s, p: null } : s))
    .filter((s) => s && HEX_RE.test(String(s.c || '')))
  const n = list.length
  if (!n) return { h: 0, C: 0 }

  const ps = list.map((s, i) => (Number.isFinite(+s.p) ? clamp01(+s.p) : n > 1 ? i / (n - 1) : 0.5))
  const order = ps.map((p, i) => i).sort((i, j) => ps[i] - ps[j])
  const span = ps[order[n - 1]] - ps[order[0]]

  let A = 0
  let B = 0
  let W = 0
  for (let k = 0; k < n; k++) {
    const i = order[k]
    // largeur de bande gouvernée par l'arrêt (demi-segment de part et d'autre)
    const lo = ps[order[Math.max(0, k - 1)]]
    const hi = ps[order[Math.min(n - 1, k + 1)]]
    const seg = span > 0 ? (hi - lo) / 2 : 1 / n
    const { a, b } = srgbToOklab(list[i].c)
    // poids = largeur seule : la chroma est DÉJÀ la longueur du vecteur (a, b),
    // la repondérer par elle-même écraserait deux fois les neutres.
    A += a * seg
    B += b * seg
    W += seg
  }
  if (!(W > 0)) return { h: 0, C: 0 }
  const a = A / W
  const b = B / W
  const C = Math.hypot(a, b)
  if (!(C > 1e-6)) return { h: 0, C: 0 }
  return { h: (((Math.atan2(b, a) * 180) / Math.PI) % 360 + 360) % 360, C }
}

// Chroma moyenne à partir de laquelle on teinte À FOND. 0.045 en Oklab, c'est
// déjà une rampe franchement colorée (un vert de forêt isolé tourne autour de
// 0.06–0.09 ; une rampe entière, moyennée avec ses clairs et ses sombres,
// dépasse rarement 0.05). Au-delà on ne veut de toute façon pas plus.
const FULL_TINT_C = 0.045

// ------------------------------------------------------------ valeurs d'usine
// Copie EXACTE de v28.css (:root et body.dark). Toute divergence ici est un bug
// visible : c'est le point de départ de chaque interpolation et le repli sûr.
export const UI_BASE = Object.freeze({
  light: Object.freeze({
    ink: '#1c1917', // stone-900
    accent: '#ea580c', // orange-600
    glass: '#fcfcfd',
    border: '#ffffff',
    shadow: '#1c1917',
    porcelain: '#fbfbfc', // la bulle liquide (.lq-blob), opaque
    alpha: Object.freeze({ muted: 0.55, glass: 0.62, glassStrong: 0.8, border: 0.55, hairline: 0.08, shadow: 0.12, track: 0.14, hover: 0.05 }),
  }),
  dark: Object.freeze({
    ink: '#e7e5e4', // stone-200
    accent: '#ea580c',
    glass: '#181615',
    border: '#ffffff',
    shadow: '#000000',
    porcelain: '#17191d',
    alpha: Object.freeze({ muted: 0.55, glass: 0.6, glassStrong: 0.82, border: 0.09, hairline: 0.08, shadow: 0.5, track: 0.16, hover: 0.06 }),
  }),
})

// Chroma visée à pleine teinte, par jeton. Volontairement basses sur les
// surfaces (règle 2) ; l'ombre et l'accent respirent.
const TARGET_C = {
  light: { ink: 0.016, glass: 0.009, porcelain: 0.009, border: 0.014, shadow: 0.055, accent: 0.185 },
  dark: { ink: 0.014, glass: 0.013, porcelain: 0.013, border: 0.014, shadow: 0.0, accent: 0.185 },
}
// Décalage de clarté à pleine teinte : une teinte pure sur un blanc à L 0.99
// ne se voit pas. On descend le verre d'un cheveu (et on remonte celui du mode
// sombre) pour que la couleur ait de la place où exister.
const DELTA_L = {
  light: { glass: -0.012, porcelain: -0.012, ink: 0, border: -0.008 },
  dark: { glass: 0.012, porcelain: 0.012, ink: 0, border: 0 },
}
// L'ombre du mode sombre est un vrai noir : à L = 0 la chroma n'existe pas, et
// la relever reviendrait à éclaircir l'ombre. On la laisse noire (voir TARGET_C).

// Rotation de l'accent depuis la teinte de la carte.
//
// ⚠️ 0, ET C'EST UN CHOIX D'ADRIEN, PAS UN OUBLI. La version précédente
// tournait de 150° (complémentaire fendue) pour qu'un bouton d'action ne se
// noie jamais dans le relief. Le raisonnement tenait, mais le résultat se
// lisait comme étranger à la palette — un cyan sur une carte sépia. Arbitrage
// rendu : « je préfère moins de lisibilité, mais rester dans la palette ».
//
// L'accent reste donc DANS la famille de la carte. Il ne se distingue plus par
// la teinte mais par la CHROMA et la CLARTÉ : TARGET_C lui donne 0,185 de
// chroma, très au-dessus des 0,009 à 0,016 des neutres, et sa clarté est
// recalée sur ses deux contraintes de contraste juste en dessous.
//
// Ce qui n'est PAS négocié : le contrat de lisibilité. L'accent sert à la fois
// de couleur de texte sur le verre et de fond sous du texte blanc — les deux
// seuils de 3:1 continuent d'être garantis par nearestLightness. « Moins de
// lisibilité » veut dire moins de contraste de TEINTE, jamais moins que le
// plancher mesurable.
export const ACCENT_HUE_SHIFT = 0
// En dessous de cette force, la teinte dominante n'est pas fiable (une rampe
// quasi grise rend un angle arbitraire) : l'accent d'usine garde la main.
export const ACCENT_MIN_STRENGTH = 0.25

// Seuils du contrat de lisibilité.
export const MIN_INK_RATIO = 4.5 // WCAG AA, texte courant
export const MIN_MUTED_RATIO = 3 // texte secondaire / large
export const MIN_ACCENT_RATIO = 3 // WCAG 1.4.11, composants d'interface

// Interpole un jeton de sa valeur d'usine vers sa cible teintée.
//
// ⚠️ En Oklab RECTANGULAIRE (a, b), et surtout PAS en teinte polaire — c'est
// l'inverse de mixOklch, et pour une raison précise. Le stone d'usine est un
// gris CHAUD (teinte 56°) ; une carte bleue vise 250°. Une interpolation
// polaire passerait par tous les angles entre les deux et rendrait, à
// mi-chemin, un neutre MAGENTA que personne n'a demandé. En rectangulaire le
// chemin passe par le gris : la vieille chaleur s'éteint, la nouvelle teinte
// s'allume. C'est exactement ce qu'on veut d'un neutre — et c'est aussi
// pourquoi ce n'est pas le bon modèle pour l'accent (voir uiTokenBases).
function tinted(baseHex, { h, targetC, dL = 0 }, t) {
  if (!(t > 0)) return baseHex
  const from = lch(baseHex)
  const A = lchToOklab(from)
  const B = lchToOklab({ L: clamp01(from.L + dL), C: targetC, h })
  const L = from.L + (clamp01(from.L + dL) - from.L) * t
  const a = A.a + (B.a - A.a) * t
  const b = A.b + (B.b - A.b) * t
  return toHex(L, Math.hypot(a, b), (((Math.atan2(b, a) * 180) / Math.PI) % 360 + 360) % 360)
}

// Pousse L dans la direction `dir` (−1 plus sombre, +1 plus clair) jusqu'à ce
// que `ok(hex)` passe. Dichotomie sur la CLARTÉ, à teinte et chroma constantes :
// c'est le seul levier qui ne trahit pas la palette. Si même l'extrême échoue,
// on rend l'extrême (mieux vaut le maximum de contraste possible qu'un ratio
// choisi au hasard) — cas qui n'arrive pas avec les bases ci-dessus, mais le
// module ne peut pas le supposer.
function pushLightness(hex, dir, ok, steps = 24) {
  if (ok(hex)) return hex
  const { L, C, h } = lch(hex)
  const end = dir < 0 ? 0 : 1
  const endHex = toHex(end, C, h)
  if (!ok(endHex)) return endHex
  let lo = L // échoue
  let hi = end // passe
  for (let i = 0; i < steps; i++) {
    const m = (lo + hi) / 2
    if (ok(toHex(m, C, h))) hi = m
    else lo = m
  }
  return toHex(hi, C, h)
}

// Variante BILATÉRALE, pour l'accent : ses deux contraintes tirent en sens
// contraires en mode sombre (assez CLAIR pour se détacher du verre noir, assez
// SOMBRE pour qu'un label blanc tienne dessus). Une fenêtre existe toujours ;
// on cherche donc la clarté VALIDE la plus proche de celle qu'on voulait, en
// s'éloignant pas à pas des deux côtés à la fois. `prefer` départage à distance
// égale. Rend la couleur d'origine si aucune ne passe (jamais observé sur le
// catalogue, mais un module pur ne parie pas).
function nearestLightness(hex, ok, prefer = -1, steps = 256) {
  if (ok(hex)) return hex
  const { L, C, h } = lch(hex)
  for (let i = 1; i <= steps; i++) {
    const d = i / steps
    const first = clamp01(L + prefer * d)
    const second = clamp01(L - prefer * d)
    const a = toHex(first, C, h)
    if (ok(a)) return a
    const b = toHex(second, C, h)
    if (ok(b)) return b
  }
  return hex
}

/**
 * Les couleurs OPAQUES dont tous les jetons découlent, plus le diagnostic.
 * Séparé de deriveUiTokens pour que les tests mesurent des couleurs et pas des
 * chaînes CSS.
 */
export function uiTokenBases(stops, { dark = false, strength = 1 } = {}) {
  const key = dark ? 'dark' : 'light'
  const base = UI_BASE[key]
  const tint = paletteTint(stops)
  const t = clamp01(strength) * clamp01(tint.C / FULL_TINT_C)
  const h = tint.h

  const glass = tinted(base.glass, { h, targetC: TARGET_C[key].glass, dL: DELTA_L[key].glass }, t)
  const porcelain = tinted(base.porcelain, { h, targetC: TARGET_C[key].porcelain, dL: DELTA_L[key].porcelain }, t)
  const border = tinted(base.border, { h, targetC: TARGET_C[key].border, dL: DELTA_L[key].border }, t)
  const shadow = tinted(base.shadow, { h, targetC: TARGET_C[key].shadow }, t)

  // --- ENCRE : c'est elle qui porte la garantie. Deux contraintes d'un coup —
  // l'encre pleine à 4.5:1 et l'encre à 55 % (le « muted ») à 3:1, toutes deux
  // contre le verre pris opaque. La seconde est la plus dure : c'est elle qui
  // décide en pratique.
  const inkWanted = tinted(base.ink, { h, targetC: TARGET_C[key].ink, dL: DELTA_L[key].ink }, t)
  const inkOk = (hex) =>
    contrastRatio(hex, glass) >= MIN_INK_RATIO &&
    contrastRatio(compositeOver(hex, base.alpha.muted, glass), glass) >= MIN_MUTED_RATIO
  const ink = pushLightness(inkWanted, dark ? +1 : -1, inkOk)

  // --- ACCENT : la carte tourne de 150°, puis sa clarté se recale sur DEUX
  // contraintes — 3:1 contre le verre (l'accent sert de couleur de TEXTE dans
  // la moitié de v28.css) et 3:1 contre le blanc (l'accent sert aussi de FOND
  // de bouton, avec un label blanc dessus). En mode clair les deux tirent dans
  // le même sens ; en mode sombre elles s'opposent, d'où la recherche
  // bilatérale. Une teinte tournée change la luminance à clarté Oklab égale :
  // un accent moutarde est bien plus lumineux qu'un accent indigo, et c'est ce
  // recalage-là qui l'empêche de blanchir.
  // Un accent NE S'INTERPOLE PAS : il bascule. Le fondu rectangulaire qui
  // convient aux neutres passerait ici par un beige mort à mi-chemin, et un
  // accent désaturé n'est plus un accent. Sous le seuil, la rampe n'a de toute
  // façon pas de teinte digne de confiance (une carte quasi grise donne un
  // angle arbitraire) : l'orange d'usine reste, et c'est la bonne réponse.
  // Au-dessus, l'accent prend franchement la complémentaire de la carte.
  const accentWanted =
    t < ACCENT_MIN_STRENGTH
      ? base.accent
      : toHex(lch(base.accent).L, TARGET_C[key].accent, (h + ACCENT_HUE_SHIFT) % 360)
  const accentOk = (hex) =>
    contrastRatio(hex, glass) >= MIN_ACCENT_RATIO && contrastRatio(hex, '#ffffff') >= MIN_ACCENT_RATIO
  const accent = nearestLightness(accentWanted, accentOk, dark ? +1 : -1)

  return { ink, accent, glass, border, shadow, porcelain, tintHue: h, tintChroma: tint.C, strength: t }
}

/**
 * deriveUiTokens(stops, { dark, strength }) → les jetons de v28.css, prêts à
 * être écrits sur document.documentElement.style.
 *
 * @param {Array<{c:string,p:number}|string>} stops - la rampe de la carte
 *   (rampColorStops(params)). Volontairement PAS les couleurs de mer : une
 *   carte peut n'en montrer aucune, la terre est toujours là.
 * @param {{dark?:boolean, strength?:number}} opts - `strength` 0..1 dose la
 *   teinte ; 0 rend v28.css à l'identique.
 */
export function deriveUiTokens(stops, opts = {}) {
  const dark = !!opts.dark
  const a = UI_BASE[dark ? 'dark' : 'light'].alpha
  const b = uiTokenBases(stops, opts)
  const shadowColor = rgba(b.shadow, a.shadow)
  return {
    ink: b.ink,
    muted: rgba(b.ink, a.muted),
    accent: b.accent,
    glass: rgba(b.glass, a.glass),
    glassStrong: rgba(b.glass, a.glassStrong),
    border: rgba(b.border, a.border),
    hairline: rgba(b.ink, a.hairline),
    shadow: `0 10px 40px ${shadowColor}`,
    shadowColor,
    track: rgba(b.ink, a.track),
    hover: rgba(b.ink, a.hover),
    porcelain: b.porcelain,
  }
}

// Jeton → variable CSS. main.js boucle là-dessus, dans les deux sens (écrire /
// effacer), pour que l'interrupteur `uiTint` rende exactement v28.css.
export const UI_TOKEN_VARS = Object.freeze({
  ink: '--ce-ink',
  muted: '--ce-muted',
  accent: '--ce-accent',
  glass: '--ce-glass',
  glassStrong: '--ce-glass-strong',
  border: '--ce-border',
  hairline: '--ce-hairline',
  shadow: '--ce-shadow',
  shadowColor: '--ce-shadow-color',
  track: '--ce-track',
  hover: '--ce-hover',
  porcelain: '--ce-porcelain',
})

/**
 * Le banc de contraste, exporté pour que le test ET l'appelant mesurent la
 * MÊME chose : les ratios réels des jetons d'une palette donnée.
 */
export function auditUiTokens(stops, opts = {}) {
  const dark = !!opts.dark
  const a = UI_BASE[dark ? 'dark' : 'light'].alpha
  const b = uiTokenBases(stops, opts)
  return {
    ink: contrastRatio(b.ink, b.glass),
    muted: contrastRatio(compositeOver(b.ink, a.muted, b.glass), b.glass),
    accent: contrastRatio(b.accent, b.glass),
    accentOnWhite: contrastRatio(b.accent, '#ffffff'),
    inkOnPorcelain: contrastRatio(b.ink, b.porcelain),
    strength: b.strength,
    hue: b.tintHue,
  }
}
