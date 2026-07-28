// Reconnaissance du PINCEMENT — pur, sans DOM ni THREE, donc testable.
//
// Pourquoi ce module existe plutôt qu'un simple `controls.enableZoom = true` :
// le zoom de ShibuMap n'est pas un dolly, c'est un ESCALIER. La machine à modes
// (modes.js) tient un élan inertiel à l'intérieur d'un palier, et un nouveau
// geste contre la butée fait changer de palier — ce qui raffine ou dégrossit le
// relief, recharge les tuiles, bascule en orbite. Tout ce mécanisme n'a qu'une
// seule porte d'entrée : l'événement `wheel`. Rendre son pincement natif à
// OrbitControls aurait donné un zoom qui grossit la même géométrie sans jamais
// changer de palier — la carte s'approche, le relief reste grossier.
//
// Ce module traduit donc le pincement dans la langue de la molette : un `deltaY`
// signé et le point visé. Rien d'autre. Qui décide quoi en faire reste modes.js.

// Combien de pixels d'écartement il faut gagner ou perdre avant qu'on décrète
// « c'est un pincement ». Sans ce seuil, un déplacement à deux doigts (que
// OrbitControls assure déjà) zoomerait en même temps au moindre tremblement de
// la main, et la carte partirait dans les deux sens à la fois.
export const PINCH_DEAD_ZONE_PX = 14

// Un cran de molette vaut ~100 en deltaY dans les navigateurs de bureau, et
// c'est l'unité que modes.js attend. Le facteur convertit un RAPPORT
// d'écartement en crans : doubler l'écartement vaut environ 1,4 cran, ce qui
// donne un pincement large et calme plutôt que nerveux (réglé au doigt sur
// tablette émulée — un facteur 2 rendait la moindre pichenette brutale).
const NOTCH = 100
const NOTCHES_PER_DOUBLING = 1.4
// Plafond d'UN pas. Un doigt perdu puis retrouvé, ou une image sautée sous la
// charge, peut faire bondir l'écartement d'un facteur dix ; sans plafond la
// machine à modes franchirait plusieurs paliers de relief en une seule image.
const MAX_NOTCHES_PER_STEP = 4

// Deux écartements successifs → le deltaY équivalent. Négatif quand les doigts
// s'écartent (on entre), positif quand ils se rapprochent, exactement comme la
// molette. Zéro sur toute entrée dégénérée : jamais de NaN dans la caméra.
export function pinchNotches(spanAvant, spanApres) {
  if (!(spanAvant > 0) || !(spanApres > 0)) return 0
  const doublings = Math.log2(spanApres / spanAvant)
  const notches = -doublings * NOTCHES_PER_DOUBLING
  // `|| 0` normalise le -0 que produit un écartement inchangé : un -0 qui
  // remonte jusqu'à la caméra se propage en signe négatif là où on n'en veut pas.
  return clamp(notches, -MAX_NOTCHES_PER_STEP, MAX_NOTCHES_PER_STEP) * NOTCH || 0
}

// Suit un geste à deux doigts d'un bout à l'autre. `points` est une liste de
// { id, x, y } en coordonnées client ; seuls les DEUX PREMIERS comptent (une
// paume posée à côté ne doit pas changer le sens du geste).
export class PinchTracker {
  constructor() {
    this._reset()
  }

  _reset() {
    this._span = 0
    this._ids = null
    this._armed = false // la zone morte a-t-elle été franchie ?
    this._spanAuDepart = 0
  }

  // true si un pincement PEUT commencer (deux doigts au moins).
  start(points) {
    const pair = pairOf(points)
    if (!pair) {
      this._reset()
      return false
    }
    this._reset()
    this._ids = `${pair[0].id}|${pair[1].id}`
    this._span = span(pair)
    this._spanAuDepart = this._span
    return true
  }

  // Rend { deltaY, clientX, clientY } quand le geste zoome, sinon null.
  move(points) {
    const pair = pairOf(points)
    if (!pair || !this._span) return null
    // Un doigt levé puis reposé revient avec un autre identifiant : l'écartement
    // saute alors sans que la main ait bougé. On repart d'un geste neuf plutôt
    // que de traduire ce saut en crans.
    const ids = `${pair[0].id}|${pair[1].id}`
    if (ids !== this._ids) {
      this.start(points)
      return null
    }
    const s = span(pair)
    if (!s) return null

    if (!this._armed) {
      if (Math.abs(s - this._spanAuDepart) < PINCH_DEAD_ZONE_PX) return null
      this._armed = true
    }

    const deltaY = pinchNotches(this._span, s)
    this._span = s
    if (!deltaY) return null
    return {
      deltaY,
      // le zoom vise le milieu des deux doigts : c'est le point que la main
      // désigne, et modes.js s'en sert comme pivot fixe pour toute la glissade
      clientX: (pair[0].x + pair[1].x) / 2,
      clientY: (pair[0].y + pair[1].y) / 2,
    }
  }

  end() {
    this._reset()
  }

  get actif() {
    return this._armed
  }
}

function pairOf(points) {
  if (!Array.isArray(points) || points.length < 2) return null
  return [points[0], points[1]]
}

function span([a, b]) {
  const d = Math.hypot(b.x - a.x, b.y - a.y)
  return Number.isFinite(d) ? d : 0
}

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))

// --------------------------------------------------------------- l'appui bref
//
// « Le visiteur a-t-il DÉSIGNÉ ce point, ou fait-il tourner la carte ? » Le
// clic-pour-plonger tranchait à 6 px de dérive : juste pour une souris posée
// sur une table, trop serré pour un doigt. La pulpe roule en s'écrasant, et un
// appui parfaitement volontaire dérive de 8 à 12 px — sous l'ancien seuil, le
// visiteur qui tape sur un sommet ne déclenchait rien du tout.
export const TAP_SLOP_MOUSE_PX = 6
export const TAP_SLOP_TOUCH_PX = 14
export const TAP_MAX_MS = 400 // au-delà c'est un appui LONG, pas une désignation

// Combien de pixels de dérive tolérer selon ce qui a touché l'écran. Une source
// inconnue reste au seuil souris : mieux vaut rater un appui que plonger sur un
// geste qui n'en était pas un.
export function tapSlop(pointerType) {
  return pointerType === 'touch' || pointerType === 'pen' ? TAP_SLOP_TOUCH_PX : TAP_SLOP_MOUSE_PX
}

// Pur. `multiTouch` = un second doigt s'est posé pendant le geste : c'était donc
// un pincement ou un déplacement, jamais une désignation — sans ce garde-fou,
// relâcher un pincement faisait plonger la carte sur le point du premier doigt.
export function isTap({ moved, elapsedMs, pointerType, multiTouch = false } = {}) {
  if (multiTouch) return false
  if (!Number.isFinite(moved) || !Number.isFinite(elapsedMs)) return false
  return moved <= tapSlop(pointerType) && elapsedMs < TAP_MAX_MS
}
