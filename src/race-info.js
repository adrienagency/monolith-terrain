// Known-race lookup for a loaded GPX. On import we ask Wikipedia what notable
// races/sporting events sit at the track's location, keep the big ones, and let
// the user open a card with the race's character, its main winners (men/women)
// and general advice — or close it. Live Wikipedia only, nothing invented: any
// field we can't source from the article is simply omitted.
//
// DOM-free. The bubble UI lives in ui/race-panel.js.

const NOMINATIM = 'https://nominatim.openstreetmap.org'
const wiki = (lang) => `https://${lang}.wikipedia.org`

// event/race vocabulary (fr + en) — a page is a candidate only if it reads as a
// sporting event, not a mountain/lake/town that geosearch also returns.
const RACE_RE = /(marathon|semi-marathon|trail|ultra|ultra-?trail|cyclosportive|triathlon|ironman|course à pied|foulée|corrida|ekiden|diagonale|utmb|championnat|grand prix|grand-prix|critérium|criterium|classique|\brace\b|\brun\b|running|regatta|régate|\bskyrace\b|vertical\s?kilomet|course cycliste|course de|\b\d[\d\s.,]{2,}\s?(km|kilom))/i

// strong hints the page is a big event: an explicit participant / finisher count
const PART_RE = /([\d][\d\s.,]{2,})\s*(participants?|coureurs?|concurrents?|inscrits?|finish|athlètes?|runners?)/i

function parseParticipants(text = '') {
  const m = text.match(PART_RE)
  if (!m) return null
  const n = parseInt(m[1].replace(/[\s.,]/g, ''), 10)
  return Number.isFinite(n) ? n : null
}

// biography guard: geosearch/text-search surface athletes (winners) whose bios
// mention "trail/ultra"; drop anything that reads as a person, not an event.
const PERSON_RE = /\b(née?\s+le\s+\d|born\s+(on\s+)?\d|is\s+an?\s+[\w\s'-]{0,34}(runner|athlete|cyclist|skier|racer)|est\s+une?\s+[\w\s'-]{0,34}(coureu|athlète|cycliste|skieu|traileu))/i

// generic sport/discipline articles (not a specific event) that keyword-match
const GENERIC_RE = /\((course à pied|sport|discipline|athlétisme|running)\)|^(trail|marathon|semi-marathon|triathlon|cyclisme|course à pied|ultra-trail|running|skyrunning)$/i

export function looksLikeRace(title = '', extract = '') {
  if (GENERIC_RE.test(title.trim())) return false
  if (PERSON_RE.test(extract)) return false
  return RACE_RE.test(`${title}\n${extract}`)
}

async function jget(url) {
  const r = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

// batch intro extracts + url + thumbnail for a set of titles
async function fetchExtracts(lang, titles) {
  if (!titles.length) return {}
  const t = titles.slice(0, 20).map(encodeURIComponent).join('%7C')
  const url = `${wiki(lang)}/w/api.php?action=query&prop=extracts%7Cinfo%7Cpageimages&exintro=1&explaintext=1&inprop=url&piprop=thumbnail&pithumbsize=320&titles=${t}&format=json&origin=*`
  const j = await jget(url)
  return j.query?.pages ?? {}
}

// Find candidate races near a GPX track centre. Returns [] on any failure.
export async function findRacesNear(lat, lon, { lang = 'fr' } = {}) {
  try {
    // 1) geosearch: pages tagged near the coordinates
    const geo = await jget(`${wiki(lang)}/w/api.php?action=query&list=geosearch&gscoord=${lat}%7C${lon}&gsradius=25000&gslimit=40&format=json&origin=*`)
    const near = geo.query?.geosearch ?? []
    const distByTitle = new Map(near.map((g) => [g.title, g.dist]))

    // 2) place name → text search for races named after the area
    let searchTitles = []
    try {
      const rg = await jget(`${NOMINATIM}/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&accept-language=${lang}`)
      const a = rg.address || {}
      const place = a.city || a.town || a.village || a.municipality || a.county || a.state || rg.name
      if (place) {
        const sr = await jget(`${wiki(lang)}/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(place + ' course marathon trail')}&srlimit=12&format=json&origin=*`)
        searchTitles = (sr.query?.search ?? []).map((s) => s.title)
      }
    } catch {}

    // merge candidate titles, cap the extract fetch
    const titles = [...new Set([...near.map((g) => g.title), ...searchTitles])].slice(0, 20)
    const pages = await fetchExtracts(lang, titles)

    const cands = []
    for (const p of Object.values(pages)) {
      if (!p.title || p.missing !== undefined) continue
      const extract = p.extract || ''
      if (!looksLikeRace(p.title, extract)) continue
      cands.push({
        title: p.title,
        lang,
        url: p.fullurl || `${wiki(lang)}/wiki/${encodeURIComponent(p.title)}`,
        thumb: p.thumbnail?.source || null,
        summary: extract,
        participants: parseParticipants(extract),
        dist: distByTitle.get(p.title) ?? 99999,
      })
    }
    // rank: explicit big fields first, then closest, then longer summaries
    cands.sort((a, b) => (b.participants || 0) - (a.participants || 0) || a.dist - b.dist || b.summary.length - a.summary.length)
    return cands.slice(0, 6)
  } catch {
    return []
  }
}

// Pull richer detail for a chosen race: full description + winners parsed from a
// Palmarès / Winners section (best-effort; omitted if not found).
export async function fetchRaceDetail({ title, lang, url }) {
  const out = { title, url, description: '', winners: [] }
  try {
    const j = await jget(`${wiki(lang)}/w/api.php?action=query&prop=extracts%7Cinfo&explaintext=1&inprop=url&titles=${encodeURIComponent(title)}&format=json&origin=*`)
    const page = Object.values(j.query?.pages ?? {})[0]
    if (!page) return out
    out.url = page.fullurl || url
    const text = page.extract || ''
    out.description = text.split(/\n==/)[0].trim().slice(0, 900)
    // winners: scan a Palmarès / Vainqueurs / Winners section for recent names
    const sec = text.match(/\n==+\s*(Palmarès|Vainqueurs|Winners|Records)[^\n]*\n([\s\S]{0,1200})/i)
    if (sec) {
      const lines = sec[2].split('\n').map((l) => l.trim()).filter((l) => l && !/^==/.test(l) && /\d{4}|hommes?|femmes?|men|women|:/i.test(l))
      out.winners = lines.slice(0, 8)
    }
  } catch {}
  return out
}
