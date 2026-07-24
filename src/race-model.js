// Race Studio — logique pure (testée en node) : accrochage km→point,
// dénivelés, résolution de chevauchement des cartouches, format .shibumap-race.

export function snapToKm(cumKm, km) {
  if (!cumKm?.length) return 0
  if (km <= cumKm[0]) return 0
  const last = cumKm.length - 1
  if (km >= cumKm[last]) return last
  let i = cumKm.findIndex((v) => v >= km)
  if (i <= 0) return 0
  return km - cumKm[i - 1] <= cumKm[i] - km ? i - 1 : i
}

// D+/D- avec hystérésis : on n'accumule un segment que quand le cumul depuis
// le dernier point de bascule dépasse le seuil (le bruit DEM ne compte pas)
export function ascentStats(eles, { hysteresis = 8 } = {}) {
  let dplus = 0
  let dminus = 0
  if (!eles?.length) return { dplus, dminus }
  let ref = eles[0]
  for (let i = 1; i < eles.length; i++) {
    const d = eles[i] - ref
    if (d >= hysteresis) { dplus += d; ref = eles[i] }
    else if (d <= -hysteresis) { dminus += -d; ref = eles[i] }
  }
  return { dplus: Math.round(dplus), dminus: Math.round(dminus) }
}

// pousse verticalement les cartouches pour qu'ils ne se chevauchent pas —
// glouton : tri par y souhaité, chacun posé sous le précédent si besoin.
// avoid:false (toggle Adrien) → positions d'origine, rien ne bouge.
export function layoutCartouches(items, { avoid = true, gap = 6, minY = 0, maxY = Infinity } = {}) {
  if (!avoid) return items.map((it) => it.y)
  const order = items.map((it, i) => ({ ...it, i })).sort((a, b) => a.y - b.y)
  let bottom = minY
  const out = new Array(items.length)
  for (const it of order) {
    const y = Math.min(Math.max(it.y, bottom), maxY - it.h)
    out[it.i] = y
    bottom = y + it.h + gap
  }
  return out
}

const num = (v, d = null) => (Number.isFinite(+v) ? +v : d)

export function serializeRace({ race, look, gpxText }) {
  return JSON.stringify({ format: 'shibumap-race', version: 1, race, look, gpx: gpxText })
}

export function parseRace(text) {
  try {
    const j = JSON.parse(text)
    if (j?.format !== 'shibumap-race' || !j.race) return null
    const r = j.race
    return {
      race: {
        name: String(r.name || ''),
        logo: typeof r.logo === 'string' ? r.logo : null,
        waypoints: (Array.isArray(r.waypoints) ? r.waypoints : []).map((w) => ({
          km: num(w.km, 0),
          name: String(w.name || ''),
          alt: num(w.alt),
          pictos: Array.isArray(w.pictos) ? w.pictos.map(String) : [],
          cutoff: String(w.cutoff || ''),
        })),
        transports: {
          cats: Array.isArray(r.transports?.cats) ? r.transports.cats.map(String) : [],
          removed: Array.isArray(r.transports?.removed) ? r.transports.removed.map(String) : [],
        },
      },
      look: j.look && typeof j.look === 'object' ? j.look : {},
      gpxText: typeof j.gpx === 'string' ? j.gpx : '',
    }
  } catch { return null }
}
