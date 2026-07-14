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
const RACE_RE = /(marathon|maratón|maratona|semi-marathon|trail|ultra|ultra-?trail|cyclosportive|triathlon|ironman|course à pied|foulée|corrida|ekiden|diagonale|utmb|championnat|championship|grand prix|grand-prix|critérium|criterium|classique|classic|\brace\b|\brun\b|running|\blauf\b|carrera|\bcorsa\b|\bgara\b|regatta|régate|\bskyrace\b|vertical\s?kilomet|course cycliste|course de|\b\d[\d\s.,]{2,}\s?(km|kilom))/i

// strong hints the page is a big event: an explicit participant / finisher count
const PART_RE = /([\d][\d\s.,]{2,})\s*(participants?|coureurs?|concurrents?|inscrits?|finish|athlètes?|runners?)/i

function parseParticipants(text = '') {
  const m = text.match(PART_RE)
  if (!m) return null
  const n = parseInt(m[1].replace(/[\s.,]/g, ''), 10)
  return Number.isFinite(n) ? n : null
}

// biography guard: geosearch/search surface athletes/people (e.g. race winners
// or the Boston bomber) — drop anything that reads as a person, not an event.
const PERSON_RE = /\bborn\b|née?\s+le?\s*\d|geboren|nacido|nato|\(\s*[\w.]+\s+\d{1,2},?\s+\d{4}\s*[–-]|is\s+an?\s+[\w\s'’.-]{0,50}(runner|athlete|racer|cyclist|skier|skyrunner)\b|(est|était)\s+une?\s+[\w\s'’.-]{0,50}(coureu|athlète|traileu|cycliste|skieu)/i

// generic sport/discipline articles (not a specific event)
const GENERIC_RE = /\((course à pied|sport|discipline|athlétisme|running)\)|^(trail|marathon|semi-marathon|triathlon|cyclisme|course à pied|ultra-trail|running|skyrunning)$/i

// geographic / infrastructure features geosearch returns near the coords whose
// text happens to mention a race (mountains, lakes, towns, tramways, footpaths)
const GEO_RE = /\b(is|was|est|était)\s+(an?|une?|le|la|the)\s+[\w\s'’-]{0,32}(mountain|massif|summit|sommet|peak|\bpic\b|lake|\blac\b|glacier|valley|vallée|river|rivière|tramway|railway|cable\s?car|téléphérique|commune|municipality|\bcity\b|town|village|hiking\s+trail|heritage\s+trail|long-distance\s+(path|trail)|footpath|sentier|GR\s?\d)/i

// strong race words in the TITLE — an unambiguous event
const TITLE_RACE_RE = /\b(marathon|maratón|maratona|ultra-?trail|triathlon|ironman|utmb|corrida|ekiden|diagonale|cyclosportive|grand prix|championnat|championship|skyrace|\brace\b|10\s?km|20\s?km|100\s?km)\b/i
// the article defines itself as a race/competition (first ~260 chars). NB: in
// French "un trail" IS a trail race; the English "hiking/heritage trail" path is
// already dropped by GEO_RE above, so allowing bare "trail" here is safe.
const EVENT_INTRO_RE = /\b(is|was|est|était|ist|es una|è una)\b[\w\s'’,.-]{0,60}\b(race|running event|foot\s?race|road race|trail|ultramarathon|marathon|course (à pied|cycliste|de montagne|pédestre)|épreuve|compétition|cyclosportive|triathlon|regatta|régate|wettlauf|carrera|corsa|gara podistica)\b/i

export function looksLikeRace(title = '', extract = '') {
  const t = title.trim()
  if (GENERIC_RE.test(t)) return false
  const head = extract.slice(0, 260)
  if (PERSON_RE.test(head)) return false
  if (GEO_RE.test(head)) return false
  // accept only if the title is unmistakably a race OR the intro defines one
  return TITLE_RACE_RE.test(t) || EVENT_INTRO_RE.test(head)
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

// country → the most useful Wikipedia language for local events; English is
// always tried too so the feature works worldwide, not just in France.
const CC_LANG = {
  fr: 'fr', be: 'fr', ch: 'fr', lu: 'fr', mc: 'fr', ci: 'fr', sn: 'fr',
  de: 'de', at: 'de', es: 'es', mx: 'es', ar: 'es', cl: 'es', co: 'es', pe: 'es',
  it: 'it', pt: 'pt', br: 'pt', nl: 'nl', jp: 'ja', se: 'sv', no: 'no', pl: 'pl',
}

// gather candidates from ONE Wikipedia language edition near the coordinates
async function candidatesForLang(lang, lat, lon, place) {
  const geo = await jget(`${wiki(lang)}/w/api.php?action=query&list=geosearch&gscoord=${lat}%7C${lon}&gsradius=25000&gslimit=40&format=json&origin=*`).catch(() => ({}))
  const near = geo.query?.geosearch ?? []
  const distByTitle = new Map(near.map((g) => [g.title, g.dist]))
  let searchTitles = []
  if (place) {
    const sr = await jget(`${wiki(lang)}/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(place + ' marathon trail')}&srlimit=10&format=json&origin=*`).catch(() => ({}))
    searchTitles = (sr.query?.search ?? []).map((s) => s.title)
  }
  const titles = [...new Set([...near.map((g) => g.title), ...searchTitles])].slice(0, 20)
  const pages = await fetchExtracts(lang, titles)
  const out = []
  for (const p of Object.values(pages)) {
    if (!p.title || p.missing !== undefined) continue
    const extract = p.extract || ''
    if (!looksLikeRace(p.title, extract)) continue
    out.push({
      title: p.title,
      lang,
      url: p.fullurl || `${wiki(lang)}/wiki/${encodeURIComponent(p.title)}`,
      thumb: p.thumbnail?.source || null,
      summary: extract,
      participants: parseParticipants(extract),
      dist: distByTitle.get(p.title) ?? 99999,
    })
  }
  return out
}

// Find candidate races near a GPX track centre, worldwide: the country's own
// Wikipedia language + English. Returns [] on any failure.
export async function findRacesNear(lat, lon, { lang } = {}) {
  try {
    let place = null
    let cc = null
    try {
      const rg = await jget(`${NOMINATIM}/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&accept-language=en`)
      const a = rg.address || {}
      place = a.city || a.town || a.village || a.municipality || a.county || a.state || rg.name
      cc = (a.country_code || '').toLowerCase()
    } catch {}
    const langs = [...new Set([lang || CC_LANG[cc] || 'en', 'en'])]
    const batches = await Promise.all(langs.map((l) => candidatesForLang(l, lat, lon, place).catch(() => [])))
    // merge, de-dup by normalised title (same race across editions)
    const seen = new Set()
    const cands = []
    for (const c of batches.flat()) {
      // normalise across editions: drop accents, punctuation, disambiguation
      const key = c.title.toLowerCase().replace(/\s*\(.*$/, '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')
      if (seen.has(key)) continue
      seen.add(key)
      cands.push(c)
    }
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
    const sec = text.match(/\n==+\s*(Palmarès|Vainqueurs|Winners|Champions|Records|Ganadores|Sieger|Albo d'oro|Vincitori)[^\n]*\n([\s\S]{0,1200})/i)
    if (sec) {
      const lines = sec[2].split('\n').map((l) => l.trim()).filter((l) => l && !/^==/.test(l) && /\d{4}|hommes?|femmes?|men|women|:/i.test(l))
      out.winners = lines.slice(0, 8)
    }
  } catch {}
  return out
}
