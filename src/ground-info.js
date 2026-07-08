// Ground info: the cartographic blurb laid out on the base around the slab —
// place name, coordinates, elevation range, a short description. Data is pulled
// from free, no-key web sources (Nominatim reverse-geocode + Wikipedia geo
// search/summary) plus the loaded DEM's own elevation stats. The anecdote
// source is a pluggable hook (`fetchAnecdote`) so a Claude Sonnet backend can
// be dropped in later without touching the rest.

const NOMINATIM = 'https://nominatim.openstreetmap.org'
const WIKI = 'https://en.wikipedia.org'

// ---------------------------------------------------------------- pure format

// "45.8326°N  6.8652°E" — decimal, hemisphere-suffixed. Pure & tested.
export function formatCoord(lat, lon) {
  const ns = lat >= 0 ? 'N' : 'S'
  const ew = lon >= 0 ? 'E' : 'W'
  return `${Math.abs(lat).toFixed(4)}°${ns}  ${Math.abs(lon).toFixed(4)}°${ew}`
}

// "40°50′57″N" degrees-minutes-seconds for one axis
export function toDMS(value, isLat) {
  const hemi = isLat ? (value >= 0 ? 'N' : 'S') : value >= 0 ? 'E' : 'W'
  let v = Math.abs(value)
  const d = Math.floor(v)
  v = (v - d) * 60
  const m = Math.floor(v)
  const s = Math.round((v - m) * 60)
  return `${d}°${String(m).padStart(2, '0')}′${String(s).padStart(2, '0')}″${hemi}`
}

// "ELEV  1,035 – 3,305 m  ·  mean 2,100 m" from DEM meters. Pure & tested.
export function formatElevation(minM, maxM, meanM) {
  const m = (x) => Math.round(x).toLocaleString('en-US')
  return `ELEV  ${m(minM)} – ${m(maxM)} m  ·  mean ${m(meanM)} m`
}

// clean a Wikipedia extract into a short one/two-sentence blurb
export function trimBlurb(text, maxChars = 260) {
  if (!text) return ''
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= maxChars) return clean
  const cut = clean.slice(0, maxChars)
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '))
  return (lastStop > 80 ? cut.slice(0, lastStop + 1) : cut.trimEnd() + '…').trim()
}

// ---------------------------------------------------------------- fetchers

async function reverseGeocode(lat, lon) {
  const url = `${NOMINATIM}/reverse?format=json&lat=${lat}&lon=${lon}&zoom=9&accept-language=en`
  const r = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!r.ok) throw new Error(`nominatim → HTTP ${r.status}`)
  const j = await r.json()
  const a = j.address || {}
  const name =
    a.state || a.region || a.county || a.city || a.town || a.village || j.name || j.display_name?.split(',')[0] || ''
  return { name: name.trim(), country: (a.country || '').trim() }
}

// nearest Wikipedia article to the coordinates, with its summary extract
async function nearbyWikipedia(lat, lon) {
  const geo = `${WIKI}/w/api.php?action=query&list=geosearch&gscoord=${lat}%7C${lon}&gsradius=10000&gslimit=1&format=json&origin=*`
  const gr = await fetch(geo)
  if (!gr.ok) throw new Error(`wiki geosearch → HTTP ${gr.status}`)
  const gj = await gr.json()
  const hit = gj.query?.geosearch?.[0]
  if (!hit) return { title: '', extract: '' }
  const sum = `${WIKI}/api/rest_v1/page/summary/${encodeURIComponent(hit.title)}`
  const sr = await fetch(sum)
  if (!sr.ok) return { title: hit.title, extract: '' }
  const sj = await sr.json()
  return { title: hit.title, extract: sj.extract || '' }
}

// default anecdote source — the nearest Wikipedia article's summary. Swap this
// hook for a Claude Sonnet call (needs a key/proxy) when one is available.
export async function wikipediaAnecdote({ lat, lon }) {
  try {
    const { title, extract } = await nearbyWikipedia(lat, lon)
    return { title, text: trimBlurb(extract) }
  } catch {
    return { title: '', text: '' }
  }
}

// Assemble the ground-info payload for a location. Never throws — every source
// degrades to a sane fallback so the cartouche always has something to show.
export async function gatherGroundInfo({ lat, lon, dem, fetchAnecdote = wikipediaAnecdote }) {
  const out = {
    coord: formatCoord(lat, lon),
    coordDMS: `${toDMS(lat, true)}  ${toDMS(lon, false)}`,
    elevation: dem ? formatElevation(dem.minM, dem.maxM, dem.meanM) : '',
    name: '',
    country: '',
    title: '',
    blurb: '',
  }
  const [place, anecdote] = await Promise.allSettled([
    reverseGeocode(lat, lon),
    Promise.resolve(fetchAnecdote({ lat, lon })),
  ])
  if (place.status === 'fulfilled') {
    out.name = place.value.name
    out.country = place.value.country
  }
  if (anecdote.status === 'fulfilled' && anecdote.value) {
    out.title = anecdote.value.title || ''
    out.blurb = anecdote.value.text || ''
  }
  if (!out.name) out.name = out.title || 'UNCHARTED SECTOR'
  return out
}
