// Palettes VALIDÉES par l'utilisateur (Adrien : « pouvoir valider une palette
// et qu'elle s'enregistre dans les templates de couleurs »). Un enregistrement
// = un nom + la rampe 8 arrêts + la rampe océan + l'encre — exactement les clés
// palette d'un look de template, donc exportable/compatible à vie avec le
// format .shibumap-template.json (un look PARTIEL n'applique que ses clés).
// Stockage localStorage, plafonné pour rester raisonnable.

const LS_KEY = 'shibumap-user-palettes'
const MAX = 40

export function loadUserPalettes() {
  try {
    const arr = JSON.parse(localStorage.getItem(LS_KEY) || '[]')
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

export function saveUserPalettes(list) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(list.slice(0, MAX)))
  } catch {}
}

// capture la palette COURANTE des params → un enregistrement nommé
export function paletteFromParams(params, name) {
  return {
    id: `up_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e4)}`,
    name: (name || 'PALETTE').slice(0, 30),
    rampStops: (params.rampStops || []).map((s) => ({ c: s.c, p: s.p })),
    oceanShallow: params.oceanShallow,
    oceanMid: params.oceanMid,
    oceanDeep: params.oceanDeep,
    ink: params.contourColor,
  }
}
