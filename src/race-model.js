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
//
// ⚠️ `debut`/`fin` SONT DES BORNES, PAS UN slice(). Le carnet de course
// (carnet-course.js) appelle ceci à CHAQUE IMAGE de lecture pour le « D+ qui
// reste » : écrit `ascentStats(eles.slice(idx))`, ça allouerait un tableau de
// 10 000 flottants soixante fois par seconde — 600 000 copies/s pour un
// chiffre qui bouge de quelques mètres. Les bornes coûtent deux entiers.
// Le BALAYAGE, lui, reste O(n) et c'est irréductible : l'hystérésis fait
// dépendre le résultat du point de DÉPART, donc aucun cumul partiel ne peut
// être précalculé une fois pour toutes (un « D+ restant » tiré d'une somme
// suffixe mentirait aux abords des seuils). C'est l'allocation qu'on
// supprime, pas la boucle — et c'est l'allocation qui coûtait.
export function ascentStats(eles, { hysteresis = 8, debut = 0, fin = null } = {}) {
  let dplus = 0
  let dminus = 0
  if (!eles?.length) return { dplus, dminus }
  const dernier = eles.length - 1
  const a = Math.max(0, Math.min(Math.trunc(debut) || 0, dernier))
  const b = fin == null ? dernier : Math.max(a, Math.min(Math.trunc(fin), dernier))
  let ref = eles[a]
  for (let i = a + 1; i <= b; i++) {
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

// garde : +null vaut 0 en JS — null/'' doivent rester d, jamais devenir 0
const num = (v, d = null) => (v == null || v === '' ? d : Number.isFinite(+v) ? +v : d)

// ⚠️ LE LOGO DE COURSE EST UNE URL CHOISIE PAR UN TIERS TANT QU'ON NE L'A PAS
// VÉRIFIÉE. Il valait `typeof r.logo === 'string' ? r.logo : null` — donc
// `https://moi.example/pixel.gif` passait tel quel, et ground-info-layer.js
// (`img.src = r.logo`) allait le chercher : l'adresse IP, l'en-tête
// User-Agent et le Referer de CHAQUE destinataire du lien partaient chez
// l'auteur du lien, sans un clic. Le logo de PREMIER NIVEAU était déjà filtré
// (share-link.js, parseRacePayload) ; celui rangé dans `race` ne l'était pas,
// alors que les deux arrivent du même POST anonyme.
// LA RÈGLE VIT ICI, ET UNE SEULE FOIS : share-link.js l'importe (l'inverse
// ferait un cycle, share-link importe déjà parseRace). Même allowlist que le
// serveur (netlify/functions/race.mjs) et que logo-course.js.
export const LOGO_DATA_URL_RE = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+=*$/

// Un logo qui ne correspond pas devient null : une course sans logo s'affiche
// très bien, une course avec un mouchard non.
const logoSur = (v) => (typeof v === 'string' && LOGO_DATA_URL_RE.test(v) ? v : null)

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
        logo: logoSur(r.logo),
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
