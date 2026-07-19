// Go-to travel: paste coordinates or search a place name, then let the mode
// machine fly there over the globe and dive into surface mode.

import { parseLatLon } from './geo.js'
import { stepZoom } from './modes.js'

const NOMINATIM = 'https://nominatim.openstreetmap.org/search'

// name → { lat, lon, label } via Nominatim (no key; be a polite client)
export async function geocode(query) {
  const url = `${NOMINATIM}?format=json&limit=1&q=${encodeURIComponent(query)}`
  const r = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!r.ok) throw new Error(`geocoding → HTTP ${r.status}`)
  const results = await r.json()
  if (!results.length) return null
  const hit = results[0]
  return { lat: parseFloat(hit.lat), lon: parseFloat(hit.lon), label: hit.display_name }
}

// Wire the two GUI fields to the mode machine. `modes.flyTo` does the rest.
// `getFineZoom` (optional): the user's own finest detail zoom — task 30
// Fix B: "quand on rentre une localité, ne fais pas apparaître le zoom
// maxi... mais le niveau supérieur, sinon on ne comprend pas ce qu'on voit."
// A bare paste/search used to hand flyTo() no zoom at all, which lands on
// the FINEST tier available (modes.js's _dive(): `tier.zoom ?? getFineZoom()`
// when tr.zoom is null) — too tight to show what's actually around the
// place. landingZoom() below steps one staircase notch OUT from that finest
// zoom (stepZoom's own coarsen direction, the same helper the coarsen-wheel
// path already uses) and hands flyTo() that explicit zoom instead, so the
// arrival shows the locality WITH its surroundings. GPX framing (main.js's
// frameTrack) is a separate call path and is untouched by this.
function landingZoom(getFineZoom) {
  if (!getFineZoom) return null
  return stepZoom(getFineZoom(), -1)
}

export function createGoto({ modes, announce, getFineZoom }) {
  return {
    async go(text) {
      const c = parseLatLon(text)
      if (!c) {
        announce('UNREADABLE COORDINATES — TRY “45.8326, 6.8652”')
        return false
      }
      if (!(await modes.flyTo(c.lat, c.lon, landingZoom(getFineZoom)))) {
        announce('NAVIGATION BUSY — TRY AGAIN IN A MOMENT')
        return false
      }
      announce(`COURSE SET — ${c.lat.toFixed(4)}, ${c.lon.toFixed(4)}`)
      return true
    },

    async search(query) {
      if (!query || !query.trim()) return false
      announce(`SEARCHING — ${query.toUpperCase()}`)
      try {
        const hit = await geocode(query.trim())
        if (!hit) {
          announce('NO MATCH FOUND')
          return false
        }
        if (!(await modes.flyTo(hit.lat, hit.lon, landingZoom(getFineZoom)))) {
          announce('NAVIGATION BUSY — TRY AGAIN IN A MOMENT')
          return false
        }
        announce(`TARGET — ${hit.label.split(',').slice(0, 2).join(',').toUpperCase()}`)
        return true
      } catch {
        announce('SEARCH OFFLINE — USE COORDINATES')
        return false
      }
    },
  }
}
