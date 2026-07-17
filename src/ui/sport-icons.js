// Sport icons for GPX layers (task 22 §3) — a small, consistent set of
// outdoor-race disciplines drawn inline as monochrome line SVGs, same
// grammar as every other panel icon in this app (viewBox 0 0 24 24,
// stroke="currentColor", stroke-width ~1.8 — see route-panel.js's own ICON
// constant). Deliberately minimal/geometric, not illustrative, so they read
// at 16px in a layer row AND as a small billboard above the playback head
// (see gpx.js's HEAD_ICON_BASE_H) without turning to mud.
//
// This module is pure/DOM-free EXCEPT the two rasterizers at the bottom
// (iconToTexture / fileToTexture), which need Image/canvas — kept separate
// so the icon table + sanitizer are unit-testable without a DOM (see
// test/sport-icons.test.js).

export const DEFAULT_SPORT = 'trail'

// Every path below shares one visual language: a single silhouette/gesture,
// no fill except small solid accents (wheels, head dots) — legible at both
// panel-row size and the tiny world-space billboard.
export const SPORTS = [
  {
    key: 'trail',
    label: 'Trail / Running',
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="15.5" cy="4.2" r="1.6" fill="currentColor" stroke="none"/><path d="M8 21l2.4-5.2-2-2.3 1-4.3 3.4 2.7 3.6-1.3M9.6 12l-3.6 1.4M13.8 15.8L17 17.4l1.6 3.6"/></svg>',
  },
  {
    key: 'swim',
    label: 'Swimming',
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="17" cy="5" r="1.6" fill="currentColor" stroke="none"/><path d="M10 13l4-3.4 3.4 2.6M2 17c1.6 1.4 3.2 1.4 4.8 0 1.6-1.4 3.2-1.4 4.8 0 1.6 1.4 3.2 1.4 4.8 0 1.6-1.4 3.2-1.4 4.8 0M2 20.6c1.6 1.4 3.2 1.4 4.8 0 1.6-1.4 3.2-1.4 4.8 0 1.6 1.4 3.2 1.4 4.8 0 1.6-1.4 3.2-1.4 4.8 0"/></svg>',
  },
  {
    key: 'road-bike',
    label: 'Road cycling',
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="17.5" r="3.2"/><circle cx="18.5" cy="17.5" r="3.2"/><path d="M5.5 17.5l5-9h5.5l2.5 9M10.5 8.5H8.2M13 12.2l-2 5.3h7.5"/><circle cx="15" cy="5" r="1.5" fill="currentColor" stroke="none"/></svg>',
  },
  {
    key: 'mtb',
    label: 'Mountain bike',
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="17.5" r="3.2"/><circle cx="19" cy="17.5" r="3.2"/><path d="M5 17.5l3.5-8-1-2M8.5 9.5H7M12 5.5h3l4 12M12 5.5l-2.5 4 3 4-3.5 4"/><circle cx="14.5" cy="5.5" r="1.5" fill="currentColor" stroke="none"/></svg>',
  },
  {
    key: 'cx',
    label: 'Cyclocross',
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="17.5" r="3"/><circle cx="18.5" cy="17.5" r="3"/><path d="M5.5 17.5l5-9h5.5l2.5 9M10.5 8.5H8.2M13 12.2l-2 5.3h7.5"/><circle cx="15" cy="5" r="1.4" fill="currentColor" stroke="none"/><path d="M2.5 21l2-1.6M2.5 18l2.4-1.2" stroke-width="1.4"/></svg>',
  },
  {
    key: 'hike',
    label: 'Hiking',
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9.5" cy="4" r="1.6" fill="currentColor" stroke="none"/><path d="M3 21l4-8.5 2.4-2 1.6 3-1.6 3.2M7.4 12.5l4.4 1 3.2-4.3M15 9.2l3.6 1.4-1.4 6.7M6 21l3-3.6M19.6 3.5L16.2 20"/></svg>',
  },
  {
    key: 'ski',
    label: 'Ski / Nordic',
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="4.4" r="1.6" fill="currentColor" stroke="none"/><path d="M8 9.5l4-1.6 4 1.6M9 10l3 2 3-2M4 20.5L20 15M4 15L20 20.5M12 8v10"/></svg>',
  },
  {
    key: 'kayak',
    label: 'Kayak / Canoe',
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 15.5C6 19 18 19 21.5 15.5c-3 1.3-16 1.3-19 0z"/><path d="M2.5 15.5C6 13 18 13 21.5 15.5"/><path d="M4 5.5L20 18.5M6.2 7.2L4.5 9.6M17.8 14.4l1.7 2.4" /></svg>',
  },
]

const SPORT_MAP = new Map(SPORTS.map((s) => [s.key, s]))

export function getSport(key) {
  return SPORT_MAP.get(key) || SPORT_MAP.get(DEFAULT_SPORT)
}

// ---------------------------------------------------------------- upload guards

// Both custom-icon paths (inline SVG markup or a rasterized PNG data URL)
// share one size ceiling — generous for a small glyph, well short of
// something that could bloat a share-link payload (see share-link.js's own
// RACE_LOGO_MAX_CHARS for the precedent this mirrors).
export const MAX_ICON_BYTES = 200_000

// A pasted/uploaded SVG is scriptable — this app already treats an uploaded
// race logo as untrusted (see race.mjs's isValidLogoDataUrl); an icon is the
// same category of risk, one rung more dangerous since SVG can carry <script>
// natively. Rather than trust a full DOMParser round-trip (still lets
// event-handler attributes through unless carefully re-walked), this is a
// bounded, deny-list regex pass: strip anything that could execute, then
// require what's left still looks like a plain <svg>. Not a general-purpose
// sanitizer — good enough for "small icon glyph", not for arbitrary SVG.
// Returns the cleaned markup, or null if the input isn't safely usable.
export function sanitizeSvgMarkup(text) {
  if (typeof text !== 'string' || !text.trim()) return null
  if (text.length > MAX_ICON_BYTES) return null
  let s = text
  // drop anything that can run script or load external content
  s = s.replace(/<script[\s\S]*?<\/script\s*>/gi, '')
  s = s.replace(/<!--[\s\S]*?-->/g, '')
  s = s.replace(/<foreignObject[\s\S]*?<\/foreignObject\s*>/gi, '')
  s = s.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
  s = s.replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
  s = s.replace(/\shref\s*=\s*"javascript:[^"]*"/gi, '')
  s = s.replace(/\sxlink:href\s*=\s*"(?!#)[^"]*"/gi, '')
  s = s.replace(/<iframe[\s\S]*?<\/iframe\s*>/gi, '')
  s = s.replace(/<object[\s\S]*?<\/object\s*>/gi, '')
  s = s.replace(/<embed\b[^>]*>/gi, '')
  if (!/<svg[\s>]/i.test(s)) return null
  if (/<script[\s>]/i.test(s)) return null // belt-and-suspenders after stripping above
  return s.trim()
}

// A rasterized upload must actually be an image/* data URL (mirrors
// race.mjs's LOGO_DATA_URL_RE allowlist — same shape of check, independent
// copy since this module has no import path to that Netlify function).
const IMAGE_DATA_URL_RE = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+=*$/
export function isValidIconDataUrl(dataUrl) {
  return typeof dataUrl === 'string' && dataUrl.length > 0 && dataUrl.length <= MAX_ICON_BYTES && IMAGE_DATA_URL_RE.test(dataUrl)
}

// ---------------------------------------------------------------- rasterizers (DOM)

// data:image/svg+xml decodes as a STANDALONE XML document — unlike
// innerHTML (how every SPORTS icon and panel ICON constant in this app
// normally gets drawn, which HTML5-parses a bare <svg> with no namespace
// just fine), Image.src on an <svg> missing xmlns fails to decode entirely
// (a silent onerror, no detail). None of this file's own SPORTS markup (nor
// a typical hand-authored icon someone uploads) bothers with xmlns since
// HTML parsing never needed it — inject it here, once, at the one call site
// that actually requires it, rather than demand every SVG source carry it.
function withXmlns(svg) {
  return /\sxmlns\s*=/.test(svg) ? svg : svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')
}

// Draws sanitized SVG markup (or a plain raster data URL) onto a small square
// canvas and hands back an ImageBitmap-ish <canvas> element a caller turns
// into a THREE.CanvasTexture — kept out of the pure section above so
// test/sport-icons.test.js can exercise the table + sanitizer without a DOM.
export function rasterizeToCanvas(svgOrDataUrl, { size = 128, color = '#3a4147' } = {}) {
  return new Promise((resolve, reject) => {
    const isDataUrl = /^data:/.test(svgOrDataUrl)
    const src = isDataUrl
      ? svgOrDataUrl
      : 'data:image/svg+xml;base64,' +
        btoa(unescape(encodeURIComponent(withXmlns(svgOrDataUrl.replace(/currentColor/g, color)))))
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = size
      c.height = size
      const ctx = c.getContext('2d')
      ctx.clearRect(0, 0, size, size)
      // letterbox into a square, small inset so it doesn't touch the edge
      const pad = size * 0.12
      ctx.drawImage(img, pad, pad, size - pad * 2, size - pad * 2)
      resolve(c)
    }
    img.onerror = () => reject(new Error('icon image failed to decode'))
    img.src = src
  })
}
