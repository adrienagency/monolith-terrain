// RÉSERVE DE PALETTES DU MODE ALÉATOIRE (bouton dé, shuffleLook dans main.js).
//
// CONTRAINTE (Adrien) : « le mode aléatoire se base sur des palettes qui
// n'existent plus alors que j'ai des centaines de palettes en réserve dans
// l'appli ». Le shuffle ne piochait QUE dans les 4 looks intégrés de
// templates.js, en ignorant :
//   · les 136 palettes du catalogue boutique (public/templates/data.json),
//   · les palettes VALIDÉES par l'utilisateur (localStorage, user-palettes.js),
//   · les templates installés/importés (localStorage, templates-user.js),
//   · les générateurs procéduraux de palette.js — generateEarthPalette (8
//     biomes terrestres) et generatePalette (théorie des couleurs, dont les
//     règles sont épinglées par 300 graines de test) qui n'était plus appelé
//     nulle part dans l'application : du code mort depuis l'arrivée des biomes.
//
// Ce module rassemble tout ça en une réserve unique, PURE (ni DOM ni three.js,
// `rng` injectable) et surtout FILTRÉE : une palette qui ne tient pas la règle
// « jamais de random moche » n'entre pas dans la réserve.

import { generateEarthPalette, generatePalette } from './palette.js'

const HEX = /^#[0-9a-fA-F]{6}$/

// Poids par source. La boutique domine (c'est la vraie réserve « des
// centaines »), les procéduraux garantissent la variété infinie, les palettes
// de l'utilisateur pèsent lourd parce qu'il les a choisies lui-même.
export const SOURCE_WEIGHTS = Object.freeze({ shop: 4, user: 3, template: 2, earth: 3, theory: 2 })
// sources toujours disponibles (générateurs) — pas besoin de réserve chargée
const GENERATED = ['earth', 'theory']

// luminance perçue approximative d'un #rrggbb (sRGB, suffisant pour trier)
export function lum(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const mixHex = (a, b, t) => {
  const to = (v) => Math.round(v).toString(16).padStart(2, '0')
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16))
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16))
  return `#${pa.map((v, i) => to(v + (pb[i] - v) * t)).join('')}`
}

// Rééchantillonne une rampe quelconque sur N arrêts équidistants. applyPalette
// (main.js) écrase les 8 arrêts existants avec src[min(i, len−1)] : une source
// à 4 arrêts y répéterait 5 fois sa dernière teinte. On interpole plutôt.
export function resampleStops(stops, n = 8) {
  const src = stops.slice().sort((a, b) => a.p - b.p)
  if (!src.length) return []
  return Array.from({ length: n }, (_, i) => {
    const x = i / (n - 1)
    if (x <= src[0].p) return { c: src[0].c, p: +x.toFixed(2) }
    for (let k = 0; k < src.length - 1; k++) {
      const a = src[k], b = src[k + 1]
      if (x <= b.p) {
        const t = b.p === a.p ? 0 : (x - a.p) / (b.p - a.p)
        return { c: mixHex(a.c, b.c, t), p: +x.toFixed(2) }
      }
    }
    return { c: src[src.length - 1].c, p: +x.toFixed(2) }
  })
}

// Toute source (entrée boutique, palette utilisateur, look de template) →
// l'objet palette que applyPalette sait consommer, ou null si inexploitable.
export function normalizePalette(src, kind = 'shop', name = '') {
  if (!src || typeof src !== 'object') return null
  const raw = Array.isArray(src.rampStops) ? src.rampStops : []
  const stops = raw
    .filter((s) => s && typeof s.c === 'string' && HEX.test(s.c) && Number.isFinite(s.p))
    .map((s) => ({ c: s.c.toLowerCase(), p: Math.min(1, Math.max(0, s.p)) }))
  if (stops.length < 4) return null
  const oc = ['oceanShallow', 'oceanMid', 'oceanDeep'].map((k) => (typeof src[k] === 'string' && HEX.test(src[k]) ? src[k].toLowerCase() : null))
  if (oc.some((c) => !c)) return null
  const ramp = resampleStops(stops, 8)
  // l'encre : celle de la source, sinon le stop le plus sombre poussé au noir —
  // les traits de contour doivent rester lisibles sur la planche
  const inkSrc = [src.ink, src.contourColor].find((c) => typeof c === 'string' && HEX.test(c))
  const darkest = ramp.reduce((a, b) => (lum(a.c) <= lum(b.c) ? a : b)).c
  return {
    kind,
    name: String(name || src.name || 'PALETTE').slice(0, 40),
    rampStops: ramp,
    oceanShallow: oc[0],
    oceanMid: oc[1],
    oceanDeep: oc[2],
    ink: inkSrc ? inkSrc.toLowerCase() : mixHex(darkest, '#000000', 0.6),
  }
}

// « Jamais de random moche » — le filtre d'entrée dans la réserve.
export function isElegantPalette(p) {
  if (!p || !Array.isArray(p.rampStops) || p.rampStops.length !== 8) return false
  if (!p.rampStops.every((s) => HEX.test(s.c))) return false
  const ls = p.rampStops.map((s) => lum(s.c))
  // une rampe qui ne bouge pas = un aplat : le relief perdrait toute lecture
  if (Math.max(...ls) - Math.min(...ls) < 0.1) return false
  const [sh, mi, de] = [p.oceanShallow, p.oceanMid, p.oceanDeep]
  if (![sh, mi, de].every((c) => typeof c === 'string' && HEX.test(c))) return false
  // la mer doit TOUJOURS s'assombrir avec la profondeur (règle de palette.js)
  if (!(lum(sh) > lum(mi) && lum(mi) > lum(de))) return false
  return true
}

// signature de dédoublonnage : deux entrées de même rampe sont la même palette
const signature = (p) => p.rampStops.map((s) => s.c).join('')

// Assemble la réserve concrète. `builtins` / `userTemplates` sont des LOOKS
// (objets à plat portant rampStops/ocean*), pas des palettes : on lit dedans.
export function buildPalettePool({ shop = [], userPalettes = [], userTemplates = [], builtins = [] } = {}) {
  const out = []
  const seen = new Set()
  const push = (src, kind, name) => {
    const p = normalizePalette(src, kind, name)
    if (!p || !isElegantPalette(p)) return
    const sig = signature(p)
    if (seen.has(sig)) return
    seen.add(sig)
    out.push(p)
  }
  for (const e of shop) push(e, 'shop', e?.name)
  for (const e of userPalettes) push(e, 'user', e?.name)
  // un template intégré range sa palette sous .palette, un template utilisateur
  // l'étale dans .look — les deux formes traversent le même normalizePalette
  for (const t of builtins) push(t?.palette || t, 'template', t?.label || t?.name)
  for (const t of userTemplates) push(t?.look || t, 'template', t?.name)
  return out
}

const pickIn = (rng, arr) => arr[Math.floor(rng() * arr.length)]

// Tire une SOURCE (pondérée) puis une palette dedans. Les générateurs sont
// toujours disponibles, donc la réserve n'est jamais vide même hors ligne.
export function pickShufflePalette(rng = Math.random, pool = []) {
  const buckets = new Map()
  for (const p of pool) {
    if (!buckets.has(p.kind)) buckets.set(p.kind, [])
    buckets.get(p.kind).push(p)
  }
  const kinds = [...new Set([...buckets.keys(), ...GENERATED])]
  const total = kinds.reduce((s, k) => s + (SOURCE_WEIGHTS[k] || 1), 0)
  let r = rng() * total
  let kind = kinds[kinds.length - 1]
  for (const k of kinds) {
    r -= SOURCE_WEIGHTS[k] || 1
    if (r <= 0) { kind = k; break }
  }
  if (buckets.has(kind)) return pickIn(rng, buckets.get(kind))
  // générateur : on retire jusqu'à ce que le tirage passe le filtre d'élégance
  // (il passe quasi toujours — la boucle est un garde-fou, pas une stratégie)
  for (let i = 0; i < 8; i++) {
    const raw = kind === 'earth' ? generateEarthPalette(rng) : generatePalette(rng, 'light')
    const p = normalizePalette(raw, kind, raw.name)
    if (p && isElegantPalette(p)) return p
  }
  return pool.length ? pickIn(rng, pool) : normalizePalette(generateEarthPalette(rng), 'earth')
}
