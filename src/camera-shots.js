// Plans de caméra — le VOCABULAIRE DE CINÉMA de ShibuMap.
//
// À ne pas confondre avec camera-automation.js, qui reste en place pour le
// panneau Caméra : celui-ci fait osciller la caméra autour d'un point
// (orbit/pan/crane…). C'est de la géométrie, pas de la mise en scène, et c'est
// précisément ce qu'Adrien ne veut plus pour le bouton cinéma : « je veux de
// VRAIS mouvements de caméra, des poursuites au sol, qui passent entre les
// montagnes COMME DANS UN FILM ».
//
// Ce qui sépare ici un PLAN d'une oscillation, et qui est vérifié par les tests :
//
//   1. UNE INTENTION. Un plan part d'un cadrage et arrive à un autre, et son
//      sujet est pris dans le relief RÉEL — le sommet le plus haut, l'entrée de
//      vallée la plus basse — jamais tiré au sort ni posé au centre du bloc.
//   2. UNE ACCÉLÉRATION. Tout est piloté par `e = easeInOutCubic(s)` : ça part
//      lentement, ça file au milieu, ça freine à l'arrivée. La vitesse constante
//      est la signature du mouvement automatique.
//   3. LE REGARD SUIT LE MOUVEMENT. Une poursuite regarde où elle va, une
//      orbite regarde son sujet, et le passage de l'un à l'autre fait le plan.
//   4. LA PROXIMITÉ EST L'EFFET. Une paroi qui défile à trois mètres vaut cent
//      survols à mille. La poursuite vise le passage serré, pas l'évitement large.
//   5. UN PLAN FINIT. Comme tout est fonction de `e`, la vitesse s'éteint d'elle-
//      même à l'arrivée : le plan se pose sur un cadrage tenable au lieu de
//      s'interrompre au milieu d'un virage.
//
// Le module est PUR — pas de three.js, pas de DOM, pas d'état global — donc
// entièrement testable (test/camera-shots.test.js). Le lecteur en fin de fichier
// se contente d'écrire les poses dans la caméra.
//
// Toutes les distances sont exprimées en fraction de `half` (demi-emprise du
// bloc, 28 unités monde dans l'app) : les plans se comportent pareil quelle que
// soit l'échelle du bloc.

// --------------------------------------------------------------- utilitaires

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
const lerp = (a, b, t) => a + (b - a) * t

// interpolation adoucie entre deux bornes (0 avant `a`, 1 après `b`)
function smoothstep(a, b, x) {
  if (b === a) return x < a ? 0 : 1
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

// ------------------------------------------------------ courbes d'accélération
//
// « Le cinéma part lentement, prend de la vitesse, ralentit à l'arrivée. »
// easeInOutCubic est la courbe de référence des trois plans : sa dérivée vaut 0
// aux deux bouts et 3 au milieu, soit un rapport de 100 entre le départ (t=0,05)
// et le milieu — largement de quoi se lire à l'œil.

export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

export function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3)
}

export function easeInCubic(t) {
  return t * t * t
}

// ------------------------------------------------------------ grille de relief
//
// On échantillonne le relief UNE FOIS au moment de composer le plan, pas à
// chaque image. C'est la leçon de drone-cam.js : tout est connu à l'avance, donc
// on résout hors ligne au lieu de deviner image par image.
//
// n = 56 par défaut : 3 136 appels à terrain.sample (~10 ms mesuré), assez fin
// pour qu'une cellule fasse 1 unité monde sur un bloc de 56.

export function buildHeightGrid({ sampleGround, half, n = 56 }) {
  const h = new Float32Array(n * n)
  const cell = (2 * half) / n
  let min = Infinity
  let max = -Infinity
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = -half + (i + 0.5) * cell
      const z = -half + (j + 0.5) * cell
      const y = sampleGround(x, z)
      const v = Number.isFinite(y) ? y : 0
      h[j * n + i] = v
      if (v < min) min = v
      if (v > max) max = v
    }
  }
  return { n, half, cell, h, min, max }
}

// centre de la cellule (i, j) en coordonnées monde
export function gridToWorld(g, i, j) {
  return { x: -g.half + (i + 0.5) * g.cell, z: -g.half + (j + 0.5) * g.cell }
}

// Cellule contenant (x, z). BORNÉE : un point hors bloc retombe sur la cellule
// de bord au lieu de sortir du tableau — le damier voisin n'est pas notre sujet.
export function worldToGrid(g, x, z) {
  return {
    i: clamp(Math.floor((x + g.half) / g.cell), 0, g.n - 1),
    j: clamp(Math.floor((z + g.half) / g.cell), 0, g.n - 1),
  }
}

// Hauteur interpolée (bilinéaire) entre les centres de cellules — sans ça le
// couloir avancerait par marches d'escalier.
export function sampleGrid(g, x, z) {
  const u = clamp((x + g.half) / g.cell - 0.5, 0, g.n - 1)
  const v = clamp((z + g.half) / g.cell - 0.5, 0, g.n - 1)
  const i0 = Math.floor(u)
  const j0 = Math.floor(v)
  const i1 = Math.min(i0 + 1, g.n - 1)
  const j1 = Math.min(j0 + 1, g.n - 1)
  const fx = u - i0
  const fz = v - j0
  const a = g.h[j0 * g.n + i0]
  const b = g.h[j0 * g.n + i1]
  const c = g.h[j1 * g.n + i0]
  const d = g.h[j1 * g.n + i1]
  return lerp(lerp(a, b, fx), lerp(c, d, fx), fz)
}

// ---------------------------------------------------------------- les sujets
//
// « Sers-toi du relief réel — le sommet le plus haut, la vallée la plus creusée
// — comme sujet du plan. » Le sujet n'est jamais le centre du bloc.

// Le point le plus haut du bloc : le sujet par défaut de presque tous les plans.
//
// Cherché dans la PARTIE CENTRALE du bloc (75 % par défaut), et c'est une leçon
// du terrain : sur Chamonix z12 le point culminant est le mont Blanc, à
// z = 26,5 pour un demi-bloc de 28 — soit collé au bord. Une orbite de rayon 28
// autour d'un tel sujet passe la moitié du plan hors du bloc, à filmer le vide.
// Un sujet doit être DANS la scène. À défaut de sommet intérieur, on reprend le
// bloc entier plutôt que de renoncer.
export function findSummit(g, { marge = 0.75 } = {}) {
  const lim = g.half * marge
  let best = -1
  for (let j = 0; j < g.n; j++) {
    for (let i = 0; i < g.n; i++) {
      const w = gridToWorld(g, i, j)
      if (Math.abs(w.x) > lim || Math.abs(w.z) > lim) continue
      const k = j * g.n + i
      if (best < 0 || g.h[k] > g.h[best]) best = k
    }
  }
  if (best < 0) { best = 0; for (let k = 1; k < g.h.length; k++) if (g.h[k] > g.h[best]) best = k }
  const i = best % g.n
  const j = (best - i) / g.n
  const w = gridToWorld(g, i, j)
  return { x: w.x, y: g.h[best], z: w.z }
}

// Limite la PENTE de l'axe de visée. Sans ça, une poursuite au ras du sol pointe
// le nez en l'air dès que le couloir monte devant elle : mesuré sur Chamonix,
// la caméra visait 53° au-dessus de l'horizontale et ne cadrait plus que du
// ciel. Un plan de poursuite regarde le long de la vallée, pas au zénith.
// On ne touche qu'à l'altitude de la cible : la DIRECTION horizontale, elle,
// reste celle du mouvement.
export function limitePente(pos, target, penteMax = 0.36 /* ~20° */) {
  const dh = Math.hypot(target.x - pos.x, target.z - pos.z)
  if (dh < 1e-6) return target
  const dy = target.y - pos.y
  const max = dh * penteMax
  if (dy > max) return { x: target.x, y: pos.y + max, z: target.z }
  if (dy < -max) return { x: target.x, y: pos.y - max, z: target.z }
  return target
}

// L'entrée de vallée : le point BAS le plus ÉLOIGNÉ du sommet. C'est de là que
// part la poursuite, pour que le plan ait de la course devant lui et finisse
// sur le sommet.
export function findValleyMouth(g, summit) {
  const range = g.max - g.min || 1
  // on ne retient que le tiers bas du relief : une « entrée de vallée » qui
  // serait déjà à mi-pente n'aurait aucun sens
  const plafond = g.min + range * 0.3
  let best = null
  let bestD = -1
  for (let j = 0; j < g.n; j++) {
    for (let i = 0; i < g.n; i++) {
      const y = g.h[j * g.n + i]
      if (y > plafond) continue
      const w = gridToWorld(g, i, j)
      const d = Math.hypot(w.x - summit.x, w.z - summit.z)
      if (d > bestD) { bestD = d; best = { x: w.x, y, z: w.z } }
    }
  }
  // Relief sans point bas (bloc entièrement en pente) : on se rabat sur le coin
  // le plus loin du sommet plutôt que de renoncer au plan.
  if (!best) {
    let bd = -1
    for (const [i, j] of [[0, 0], [g.n - 1, 0], [0, g.n - 1], [g.n - 1, g.n - 1]]) {
      const w = gridToWorld(g, i, j)
      const d = Math.hypot(w.x - summit.x, w.z - summit.z)
      if (d > bd) { bd = d; best = { x: w.x, y: g.h[j * g.n + i], z: w.z } }
    }
  }
  return best
}

// ------------------------------------------------------------------ le couloir
//
// « Le plan, c'est le CHOIX DU COULOIR, et un couloir se choisit dans le relief
// (la ligne de plus faible altitude entre deux crêtes), pas au hasard. »
//
// C'est un plus-court-chemin de Dijkstra à 8 voisins où le coût d'une cellule
// n'est PAS sa distance mais son altitude : traverser une crête coûte
// `climbPenalty` fois plus cher que longer le fond. Le chemin résultant est,
// littéralement, la ligne de plus faible altitude entre l'entrée et le sommet.
//
// climbPenalty = 10 : mesuré sur le relief d'essai (crêtes à 30, fond à 2), le
// détour par la vallée devient 7,5× moins cher que le franchissement direct —
// assez pour que le couloir contourne, sans rendre l'approche finale du sommet
// impossible (le sommet EST le but, il faut bien y monter à la fin).

// petit tas binaire — Dijkstra sur 3 136 cellules, inutile d'importer quoi que ce soit
class Heap {
  constructor() { this.a = [] }
  get size() { return this.a.length }
  push(node) {
    const a = this.a
    a.push(node)
    let i = a.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      if (a[p].c <= a[i].c) break
      const t = a[p]; a[p] = a[i]; a[i] = t
      i = p
    }
  }
  pop() {
    const a = this.a
    const top = a[0]
    const last = a.pop()
    if (a.length) {
      a[0] = last
      let i = 0
      for (;;) {
        const l = 2 * i + 1
        const r = l + 1
        let m = i
        if (l < a.length && a[l].c < a[m].c) m = l
        if (r < a.length && a[r].c < a[m].c) m = r
        if (m === i) break
        const t = a[m]; a[m] = a[i]; a[i] = t
        i = m
      }
    }
    return top
  }
}

export function findCorridor(g, from, to, { climbPenalty = 10, climbCost = 6 } = {}) {
  const n = g.n
  const range = g.max - g.min || 1
  const a = worldToGrid(g, from.x, from.z)
  const b = worldToGrid(g, to.x, to.z)
  const src = a.j * n + a.i
  const dst = b.j * n + b.i

  const dist = new Float64Array(n * n).fill(Infinity)
  const prev = new Int32Array(n * n).fill(-1)
  const vu = new Uint8Array(n * n)
  dist[src] = 0
  const pq = new Heap()
  pq.push({ k: src, c: 0 })

  while (pq.size) {
    const { k } = pq.pop()
    if (vu[k]) continue
    vu[k] = 1
    if (k === dst) break
    const i = k % n
    const j = (k - i) / n
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue
        const ni = i + di
        const nj = j + dj
        if (ni < 0 || nj < 0 || ni >= n || nj >= n) continue
        const nk = nj * n + ni
        if (vu[nk]) continue
        const pas = Math.hypot(di, dj) * g.cell
        // altitude normalisée de la cellule visée : c'est ELLE qui fait le prix
        const hn = (g.h[nk] - g.min) / range
        // et une surtaxe sur la MONTÉE, pour préférer longer une courbe de
        // niveau plutôt que d'escalader puis redescendre
        const montee = Math.max(0, g.h[nk] - g.h[k]) / range
        const c = dist[k] + pas * (1 + climbPenalty * hn) + climbCost * montee * g.cell
        if (c < dist[nk]) { dist[nk] = c; prev[nk] = k; pq.push({ k: nk, c }) }
      }
    }
  }

  // remontée du chemin
  const out = []
  let k = dst
  if (dist[dst] === Infinity) return [{ x: from.x, z: from.z }, { x: to.x, z: to.z }]
  while (k !== -1) {
    const i = k % n
    const j = (k - i) / n
    const w = gridToWorld(g, i, j)
    out.push({ x: w.x, z: w.z })
    if (k === src) break
    k = prev[k]
  }
  out.reverse()
  return out
}

// ------------------------------------------------- rééchantillonnage et lissage
//
// Le chemin de Dijkstra est en escalier (8 directions seulement). On le
// rééchantillonne à pas constant puis on le lisse, sinon la caméra bégaierait
// à chaque diagonale. Même recette que resamplePath/smoothPath de drone-cam.js,
// en 2D.

export function resampleXZ(pts, spacing) {
  if (!pts || pts.length < 2) return pts ? pts.slice() : []
  const out = [{ x: pts[0].x, z: pts[0].z }]
  let carry = 0
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]
    const b = pts[i]
    const segLen = Math.hypot(b.x - a.x, b.z - a.z)
    if (segLen < 1e-9) continue
    let d = spacing - carry
    while (d < segLen) {
      const t = d / segLen
      out.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t })
      d += spacing
    }
    carry = segLen - (d - spacing)
  }
  const last = pts[pts.length - 1]
  const tail = out[out.length - 1]
  // On n'ajoute le dernier point que s'il est assez loin : sinon le plan
  // finirait sur un pas minuscule, et la caméra ferait un à-coup à l'arrivée.
  if (Math.hypot(last.x - tail.x, last.z - tail.z) > spacing * 0.5) out.push({ x: last.x, z: last.z })
  return out
}

export function smoothXZ(pts, passes = 2, win = 2) {
  if (!pts || pts.length < 3) return pts ? pts.slice() : []
  let cur = pts.map((p) => ({ x: p.x, z: p.z }))
  for (let p = 0; p < passes; p++) {
    const next = cur.map((q) => ({ ...q }))
    for (let i = 1; i < cur.length - 1; i++) {
      let sx = 0
      let sz = 0
      let c = 0
      for (let j = Math.max(0, i - win); j <= Math.min(cur.length - 1, i + win); j++) {
        sx += cur[j].x; sz += cur[j].z; c++
      }
      next[i] = { x: sx / c, z: sz / c }
    }
    cur = next
  }
  return cur
}

// ---------------------------------------------------------- garde au sol (3D)
//
// Adapté de l'évitement des terres de fleet.js, dont la méthode est la bonne :
// une distance de VEILLE devant soi, un ÉCHANTILLONNAGE DU SEGMENT (et pas
// seulement de son extrémité, sinon on saute par-dessus une crête étroite), un
// BALAYAGE DE CAPS du plus petit écart au plus grand.
//
// La transposition en 3D change la question : un bateau contourne, une caméra
// peut aussi PASSER AU-DESSUS. La route est donc « libre » si l'altitude de vol
// domine le relief de `garde` sur toute la veille.

// Caps essayés de part et d'autre, du plus faible écart au plus fort : on
// préfère toujours l'inflexion la plus douce (mêmes valeurs que fleet.js — un
// virage qui se lit, pas une embardée).
const SCAN = [0.35, -0.35, 0.7, -0.7, 1.05, -1.05, 1.4, -1.4, 1.75, -1.75, 2.1, -2.1, 2.6, -2.6, Math.PI]

// Combien de points on teste le long de la veille. Un seul point à l'arrivée
// laisserait sauter par-dessus une arête étroite.
const VEILLE_PAS = 4

export function routeLibre3D({ sampleGround, x, z, y, cap, dist, garde, steps = VEILLE_PAS }) {
  const dx = Math.sin(cap)
  const dz = Math.cos(cap)
  for (let i = 1; i <= steps; i++) {
    const t = (dist * i) / steps
    if (sampleGround(x + dx * t, z + dz * t) + garde > y) return false
  }
  return true
}

// Quel cap prendre ? Retourne { cap, ecart, climb }. `climb` = aucune route
// horizontale ne dégage : il faut MONTER. « Si aucune route n'est libre, elle
// prend de l'altitude plutôt que de s'arrêter net. »
export function chooseHeading({ sampleGround, x, z, y, cap, veille, garde, steps = VEILLE_PAS }) {
  if (routeLibre3D({ sampleGround, x, z, y, cap, dist: veille, garde, steps })) {
    return { cap, ecart: 0, climb: false }
  }
  for (const e of SCAN) {
    if (routeLibre3D({ sampleGround, x, z, y, cap: cap + e, dist: veille, garde, steps })) {
      return { cap: cap + e, ecart: e, climb: false }
    }
  }
  return { cap, ecart: 0, climb: true }
}

// Altitude de vol minimale au point (x, z) en visant `cap` : le plus haut du
// relief sur la veille, plus la garde. C'est ce qui fait MONTER la caméra AVANT
// la paroi au lieu de la percuter — l'anticipation, pas la réaction.
export function altitudeDeSecurite({ sampleGround, x, z, cap, veille, garde, steps = VEILLE_PAS }) {
  const dx = Math.sin(cap)
  const dz = Math.cos(cap)
  let h = sampleGround(x, z)
  for (let i = 1; i <= steps; i++) {
    const t = (veille * i) / steps
    const s = sampleGround(x + dx * t, z + dz * t)
    if (s > h) h = s
  }
  return h + garde
}

// ------------------------------------------------------------------ dolly zoom
//
// L'effet Vertigo : on AVANCE et on ouvre le champ de vision juste ce qu'il faut
// pour que le sujet garde la même taille à l'écran, pendant que l'arrière-plan
// enfle. C'est ce couple qui le distingue d'un simple travelling.
//
// Taille écran ∝ h / (d · tan(fov/2)). Pour la garder constante quand d change,
// il faut d · tan(fov/2) = cte, d'où fov = 2·atan(k/d).

// L'invariant du plan, fixé par la pose de départ.
export function dollyAnchor(dist0, fov0Deg) {
  return dist0 * Math.tan((fov0Deg * Math.PI) / 360)
}

// Bornes de sécurité : sous 8° la perspective s'aplatit en télé-écrasement, et
// au-delà de 110° la déformation de bord devient un défaut de rendu, pas un
// effet. Le Vertigo réel du plan reste largement dans cette fenêtre (35 → 69°).
export function fovForDolly(dist, k) {
  const f = (2 * Math.atan(k / Math.max(dist, 1e-6)) * 180) / Math.PI
  return clamp(f, 8, 110)
}

// Fraction de la hauteur d'écran occupée par un objet de hauteur `h`. Sert aux
// tests : c'est CETTE grandeur que le dolly zoom doit garder constante.
export function tailleEcran(h, dist, fovDeg) {
  return h / dist / (2 * Math.tan((fovDeg * Math.PI) / 360))
}

// ------------------------------------------------- top-down toujours au nord
//
// NOUVELLE RÈGLE (Adrien) : « le point de vue top down doit toujours être
// orienté nord ». Le nord du monde est -Z (cf. main.js, `north: { x: 0, z: -1 }`).
//
// CE QUE LA MESURE A DONNÉ. L'ancienne vue portait `dir = (0, 100, -0.6)` et le
// commentaire « top-down, nord en haut » — c'était FAUX de 180° : elle cadrait
// le SUD en haut. Ce n'est donc pas le chemin d'arrivée du tween qui était en
// cause, c'est le SIGNE du biais.
//
// POURQUOI un biais tout court. Une vue parfaitement verticale a un roulis
// indéterminé : `up` = (0,1,0) est alors parallèle à l'axe de visée, et le haut
// de l'écran n'est plus défini. Le petit décalage horizontal lève l'ambiguïté —
// le haut de l'écran devient la projection de `up` sur le plan image, donc il
// pointe à l'opposé du décalage. Un biais vers +Z met bien le nord (-Z) en haut.
//
// POURQUOI PAS forcer `up` = nord, qui semblerait plus direct : `up` est aussi
// le pôle dont OrbitControls se sert pour son repère sphérique. Le mettre à
// (0,0,-1) ferait orbiter la carte autour de l'axe Z dès que l'utilisateur
// attrape la vue. On garde donc `up` = (0,1,0) partout, et c'est la DIRECTION
// qui porte la règle.
//
// Le cadrage ne dépend alors que de la pose d'arrivée : il est identique quelle
// que soit la vue d'origine, ce que le test des six origines vérifie.

export const NORTH = { x: 0, y: 0, z: -1 }

// Direction de la vue du dessus, depuis la cible. Le +Z n'est PAS cosmétique :
// c'est lui qui décide de l'orientation à l'écran (voir ci-dessus).
export const TOP_DOWN_DIR = { x: 0, y: 100, z: 0.6 }

// Angle (degrés) entre le nord du monde et le haut de l'écran. 0 = nord en haut.
// Reconstruit la base caméra à la main (mêmes conventions que THREE.lookAt) pour
// rester testable sans three.js.
export function northScreenAngleDeg({ eye, target, up }) {
  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })
  const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x })
  const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z
  const norm = (v) => {
    const l = Math.hypot(v.x, v.y, v.z) || 1
    return { x: v.x / l, y: v.y / l, z: v.z / l }
  }
  const f = norm(sub(target, eye)) // axe de visée
  const r = norm(cross(f, up)) // droite écran
  const u = cross(r, f) // haut écran (orthogonalisé)
  // composantes du nord dans le plan de l'écran
  return (Math.atan2(dot(NORTH, r), dot(NORTH, u)) * 180) / Math.PI
}

// ------------------------------------------------------------------ les rails
//
// Un rail = une polyligne paramétrée par son abscisse curviligne normalisée.
// C'est ce qui permet de piloter TOUT le plan par un seul paramètre `e` déjà
// accéléré : la vitesse s'éteint alors d'elle-même à l'arrivée.

function makeRail(pts) {
  const cum = [0]
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]
    const b = pts[i]
    cum.push(cum[i - 1] + Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z))
  }
  const len = cum[cum.length - 1] || 1
  return {
    pts,
    len,
    at(u) {
      const d = clamp(u, 0, 1) * len
      let lo = 0
      let hi = cum.length - 1
      while (lo < hi - 1) {
        const mid = (lo + hi) >> 1
        if (cum[mid] <= d) lo = mid
        else hi = mid
      }
      const seg = cum[hi] - cum[lo] || 1
      const t = clamp((d - cum[lo]) / seg, 0, 1)
      const a = pts[lo]
      const b = pts[hi]
      return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t) }
    },
  }
}

// ------------------------------------------------------------------ les plans

export const SHOTS = [
  { id: 'canyon', name: '1', label: 'Poursuite au ras du sol' },
  { id: 'travelling', name: '2', label: "Travelling d'accompagnement" },
  { id: 'vertigo', name: '3', label: 'Dolly zoom (Vertigo)' },
  { id: 'survol', name: '4', label: 'Survol haute altitude' },
  { id: 'contreplongee', name: '5', label: 'Contre-plongée' },
  { id: 'poi', name: '6', label: 'Orbite resserrée sur le sommet' },
  { id: 'serie', name: '7', label: 'Série aléatoire' },
]

// Contexte commun : on prépare une fois la grille et les deux sujets.
function scene(ctx) {
  const { sampleGround, half } = ctx
  const g = buildHeightGrid({ sampleGround, half, n: 56 })
  const summit = findSummit(g)
  return { g, summit, mouth: findValleyMouth(g, summit), half, sampleGround, fov: ctx.fov ?? ctx.start?.fov ?? 30 }
}

// Plancher de sécurité appliqué à CHAQUE pose échantillonnée, tous plans
// confondus. Le rail donne la forme cinématographique ; ceci est le garde-fou,
// et c'est lui qui rend vraie la garantie « aucun plan ne passe sous le relief »
// même quand l'interpolation entre deux points du rail coupe une bosse.
function plancher(sampleGround, pos, garde) {
  const sol = sampleGround(pos.x, pos.z)
  const min = (Number.isFinite(sol) ? sol : 0) + garde
  if (pos.y < min) pos.y = min
  return pos
}

// ---- 1. la poursuite au ras du sol ----------------------------------------
//
// LE plan qu'Adrien décrit : « une caméra qui va se balader au ras du sol passer
// entre les montagnes », pensé comme une prise de vue par drone FPV — la caméra
// suit un couloir de terrain, frôle les parois, et débouche sur le sommet.
//
// Le couloir vient de findCorridor (fond de vallée) ; l'altitude vient de
// altitudeDeSecurite (elle monte AVANT la paroi) ; le regard est porté en avant
// du mouvement, puis bascule sur le sommet pour le débouché final.
function planCanyon(ctx) {
  const S = scene(ctx)
  const { g, summit, mouth, half, sampleGround } = S
  const garde = half * 0.03 // ~0,84 unité sur un bloc de 56 : on frôle vraiment
  const veille = half * 0.18

  let voie = findCorridor(g, mouth, summit)
  voie = smoothXZ(resampleXZ(voie, half * 0.035), 2, 2)
  if (voie.length < 3) voie = [{ x: mouth.x, z: mouth.z }, { x: summit.x, z: summit.z }]

  // altitude de vol : anticipation du relief le long du cap courant
  const brut = voie.map((p, i) => {
    const n = voie[Math.min(i + 1, voie.length - 1)]
    const cap = Math.atan2(n.x - p.x, n.z - p.z)
    return { x: p.x, y: altitudeDeSecurite({ sampleGround, x: p.x, z: p.z, cap, veille, garde }), z: p.z }
  })
  // On lisse la ligne d'altitude (sinon la caméra sautille sur chaque bosse),
  // PUIS on revalide contre le sol : un lissage peut faire passer dessous.
  for (let pass = 0; pass < 2; pass++) {
    const next = brut.map((p) => ({ ...p }))
    for (let i = 1; i < brut.length - 1; i++) next[i].y = (brut[i - 1].y + brut[i].y + brut[i + 1].y) / 3
    for (let i = 0; i < next.length; i++) {
      const sol = sampleGround(next[i].x, next[i].z)
      next[i].y = Math.max(next[i].y, (Number.isFinite(sol) ? sol : 0) + garde)
      brut[i] = next[i]
    }
  }

  const rail = makeRail(brut)
  const cime = { x: summit.x, y: summit.y + half * 0.06, z: summit.z }
  // Regard porté en avant sur une DISTANCE FIXE (~0,45 demi-bloc), pas sur une
  // fraction du rail : un rail court donnerait sinon une visée collée au nez,
  // et la moindre bosse ferait basculer le cadre.
  const avance = Math.min(0.35, (half * 0.45) / rail.len)

  return {
    id: 'canyon',
    duration: 26,
    sample(s) {
      const e = easeInOutCubic(clamp(s, 0, 1))
      const pos = rail.at(e)
      // le débouché : la caméra se dégage un peu sur la fin pour livrer le panorama
      pos.y += half * 0.14 * smoothstep(0.72, 1, e)
      const devant = rail.at(Math.min(1, e + avance))
      // …et le regard bascule du « où je vais » vers le sujet du plan
      const k = 0.85 * smoothstep(0.75, 1, e)
      const brutTarget = {
        x: lerp(devant.x, cime.x, k),
        y: lerp(devant.y, cime.y, k),
        z: lerp(devant.z, cime.z, k),
      }
      const p = plancher(sampleGround, pos, garde)
      return { pos: p, target: limitePente(p, brutTarget), fov: S.fov }
    },
  }
}

// ---- 2. le travelling d'accompagnement ------------------------------------
//
// Travelling latéral : la caméra glisse parallèlement au sujet en le gardant
// cadré, et se resserre en avançant. C'est le « side tracking shot » du
// dictionnaire — le mouvement montre le VOLUME du relief par parallaxe.
function planTravelling(ctx) {
  const S = scene(ctx)
  const { summit, half, sampleGround } = S
  const garde = half * 0.05
  // axe du travelling : perpendiculaire à la ligne centre → sommet
  const a = Math.atan2(summit.x, summit.z)
  const perp = a + Math.PI / 2
  const course = half * 1.1 // longueur du chariot
  const d0 = half * 1.15
  const d1 = half * 0.8 // on se resserre en chemin
  const cible = { x: summit.x, y: summit.y + half * 0.05, z: summit.z }

  return {
    id: 'travelling',
    duration: 20,
    sample(s) {
      const e = easeInOutCubic(clamp(s, 0, 1))
      const d = lerp(d0, d1, e)
      const lat = lerp(-course / 2, course / 2, e)
      const pos = {
        x: summit.x + Math.sin(a) * d + Math.sin(perp) * lat,
        y: summit.y + half * 0.3 - half * 0.1 * e,
        z: summit.z + Math.cos(a) * d + Math.cos(perp) * lat,
      }
      return { pos: plancher(sampleGround, pos, garde), target: cible, fov: S.fov }
    },
  }
}

// ---- 3. le dolly zoom (Vertigo) -------------------------------------------
//
// On avance de 1,8 à 0,7 demi-bloc du sommet pendant que le champ s'ouvre de 30
// à ~69° : le sommet garde sa taille, tout le reste enfle. Sur les 12 derniers
// pourcents le champ revient à sa valeur de base — un plan doit se poser sur un
// cadrage TENABLE, et laisser l'app à 69° rendrait la navigation suivante fausse.
function planVertigo(ctx) {
  const S = scene(ctx)
  const { summit, half, sampleGround } = S
  const garde = half * 0.06
  const d0 = half * 1.8
  const d1 = half * 0.7
  const k = dollyAnchor(d0, S.fov)
  const a = Math.atan2(summit.x, summit.z) || 0.7
  const cible = { x: summit.x, y: summit.y + half * 0.04, z: summit.z }

  return {
    id: 'vertigo',
    duration: 16,
    sample(s) {
      const e = easeInOutCubic(clamp(s, 0, 1))
      const d = lerp(d0, d1, e)
      const pos = {
        x: summit.x + Math.sin(a) * d,
        y: summit.y + half * 0.22,
        z: summit.z + Math.cos(a) * d,
      }
      // compensation Vertigo, puis retour au champ de base pour finir tenable
      const fov = lerp(fovForDolly(d, k), S.fov, smoothstep(0.88, 1, e))
      return { pos: plancher(sampleGround, pos, garde), target: cible, fov }
    },
  }
}

// ---- 4. le survol haute altitude ------------------------------------------
//
// Plan d'ouverture : on domine tout le bloc et on le traverse en diagonale, avec
// une descente lente sur la fin qui rend l'échelle du relief lisible.
function planSurvol(ctx) {
  const S = scene(ctx)
  const { g, summit, half, sampleGround } = S
  const garde = half * 0.1
  const alt0 = g.max + half * 1.45
  const alt1 = g.max + half * 0.95
  // diagonale passant par le sommet, pour que le sujet traverse le cadre
  const a = Math.atan2(summit.x, summit.z) + Math.PI * 0.35
  const R = half * 1.35

  return {
    id: 'survol',
    duration: 24,
    sample(s) {
      const e = easeInOutCubic(clamp(s, 0, 1))
      const u = lerp(-1, 1, e)
      const pos = {
        x: summit.x * 0.3 + Math.sin(a) * R * u,
        y: lerp(alt0, alt1, e),
        z: summit.z * 0.3 + Math.cos(a) * R * u,
      }
      // Le regard précède le déplacement, incliné vers le relief — mais BORNÉ
      // au bloc : la caméra part d'au-delà du bord, et un point de visée libre
      // l'emmenait cadrer le vide en fin de traversée (mesuré : 100,0 pour un
      // demi-bloc de 100). Le sujet d'un survol, c'est le bloc.
      const lim = half * 0.9
      const target = {
        x: clamp(pos.x + Math.sin(a) * half * 0.55, -lim, lim),
        y: g.min,
        z: clamp(pos.z + Math.cos(a) * half * 0.55, -lim, lim),
      }
      return { pos: plancher(sampleGround, pos, garde), target, fov: S.fov }
    },
  }
}

// ---- 5. la contre-plongée --------------------------------------------------
//
// « Contre-plongée d'écrasement » : la caméra est posée au pied du sommet et
// regarde vers le haut — l'angle qui donne sa puissance au relief. Elle recule
// et s'élève à peine, pour que la masse au-dessus d'elle grandisse encore.
function planContrePlongee(ctx) {
  const S = scene(ctx)
  const { summit, half, sampleGround } = S
  const garde = half * 0.025 // très bas : c'est l'angle qui fait le plan
  const a = Math.atan2(summit.x, summit.z) || 1.1
  const d0 = half * 0.34
  const d1 = half * 0.62
  // La cible est au-dessus de la caméra — c'est ce qui définit la contre-plongée
  // — mais SUR le sommet, pas dans le vide au-dessus de lui : viser trop haut ne
  // cadrait plus que du ciel (mesuré sur Chamonix, cible à +14 unités du sommet).
  // C'est la masse du relief qui doit écraser le cadre, donc elle doit y être.
  const cime = { x: summit.x, y: summit.y + half * 0.1, z: summit.z }

  return {
    id: 'contreplongee',
    duration: 15,
    sample(s) {
      const e = easeInOutCubic(clamp(s, 0, 1))
      const d = lerp(d0, d1, e)
      const pos = {
        x: summit.x + Math.sin(a) * d,
        y: 0,
        z: summit.z + Math.cos(a) * d,
      }
      // on colle au sol : le plancher fixe l'altitude, on n'ajoute qu'un souffle
      const sol = sampleGround(pos.x, pos.z)
      pos.y = (Number.isFinite(sol) ? sol : 0) + garde + half * 0.03 * e
      return { pos: plancher(sampleGround, pos, garde), target: cime, fov: S.fov }
    },
  }
}

// ---- 6. l'orbite resserrée sur le sommet -----------------------------------
//
// « Tourne en zoomant autour des points d'intérêt » : orbite + resserrement,
// autour du SOMMET et non du centre du bloc — c'est toute la différence avec
// l'ancienne automation `orbit`.
function planPoi(ctx) {
  const S = scene(ctx)
  const { summit, half, sampleGround } = S
  const garde = half * 0.05
  const r0 = half * 1.0
  const r1 = half * 0.42 // < 0,75 × r0 : l'orbite se RESSERRE pour de bon
  const a0 = Math.atan2(summit.x, summit.z)
  const balayage = Math.PI * 1.15 // ~207°, de quoi faire le tour du sujet
  const cible = { x: summit.x, y: summit.y + half * 0.03, z: summit.z }

  return {
    id: 'poi',
    duration: 22,
    sample(s) {
      const e = easeInOutCubic(clamp(s, 0, 1))
      const th = a0 + balayage * e
      const r = lerp(r0, r1, e)
      const pos = {
        x: summit.x + Math.sin(th) * r,
        y: summit.y + lerp(half * 0.42, half * 0.16, e),
        z: summit.z + Math.cos(th) * r,
      }
      return { pos: plancher(sampleGround, pos, garde), target: cible, fov: S.fov }
    },
  }
}

const PLANNERS = {
  canyon: planCanyon,
  travelling: planTravelling,
  vertigo: planVertigo,
  survol: planSurvol,
  contreplongee: planContrePlongee,
  poi: planPoi,
}

// Compose un plan. Retourne { id, duration, sample(s) } ou null.
// `serie` n'a pas de plan propre : c'est le lecteur qui enchaîne les six autres.
export function planShot(id, ctx) {
  const f = PLANNERS[id]
  if (!f) return null
  return f(ctx)
}

// ------------------------------------------------------------------ le lecteur
//
// Fin couche d'application : il compose un plan, l'échantillonne et écrit les
// poses dans la caméra. Aucun calcul cinématographique ici — tout est au-dessus,
// et donc tout est testé.
//
// Huit crans au bouton : les sept plans d'Adrien, puis un cran d'ARRÊT. C'est la
// réponse à « ne laisse pas Adrien prisonnier d'une caméra qui bouge toujours » :
// un neuvième clic revient au plan 1. Les plans 1 à 6 se terminent d'eux-mêmes
// et rendent la main ; seul le cran 7 (série) tourne en continu.

export class CameraShotPlayer {
  constructor({ camera, controls, sampleGround, half, baseFov = 30, rng = Math.random, onState = () => {} }) {
    this.camera = camera
    this.controls = controls
    this.sampleGround = sampleGround
    this.half = half
    this.baseFov = baseFov
    this.rng = rng
    this.onState = onState
    this.active = false
    this.index = -1 // -1 = aucun cran sélectionné
    this.plan = null
    this.t = 0
    this.serie = false
  }

  // Le numéro à afficher sur le bouton : le CRAN choisi, qu'il tourne encore ou
  // non. C'est la demande d'Adrien — « un petit numéro apparaît au-dessus quand
  // on change de caméra ». Le numéro dit QUELLE caméra ; l'allumage du bouton
  // dit si elle bouge.
  get badge() {
    return this.index >= 0 ? SHOTS[this.index].name : null
  }

  // Compose et lance le plan `id`. Retourne false si le plan n'a pas pu être bâti.
  _lancer(id) {
    const plan = planShot(id, {
      sampleGround: this.sampleGround,
      half: this.half,
      fov: this.baseFov,
      rng: this.rng,
    })
    if (!plan) return false
    this.plan = plan
    this.t = 0
    this.active = true
    return true
  }

  // Cran suivant. Retourne le libellé du badge ('1'..'7') ou null si on s'arrête.
  //
  // HUIT CRANS pour sept plans : le cran d'après le dernier est un ARRÊT. C'est
  // la sortie qu'il fallait prévoir — sans elle, une fois le bouton engagé la
  // caméra bougerait toujours. Un clic de plus et le cycle repart au plan 1.
  next() {
    const i = this.index + 1
    if (i >= SHOTS.length) { this.stop(); return null }
    this.index = i
    const shot = SHOTS[i]
    this.serie = shot.id === 'serie'
    const id = this.serie ? this._tirage() : shot.id
    if (!this._lancer(id)) { this.stop(); return null }
    this.onState()
    return shot.name
  }

  // un plan au hasard parmi les six vrais plans (la série n'en fait pas partie)
  _tirage() {
    const vrais = SHOTS.filter((s) => s.id !== 'serie')
    return vrais[Math.floor(this.rng() * vrais.length) % vrais.length].id
  }

  // Interrompt le mouvement mais GARDE le cran : l'utilisateur qui attrape la
  // caméra en plein plan doit retrouver le plan suivant au clic d'après, pas
  // repartir du début.
  cancel() {
    if (!this.active) return
    this.active = false
    this.plan = null
    this.serie = false
    this._restaurerFov()
    this.onState()
  }

  // Arrêt franc : plus aucun cran sélectionné, le badge s'efface.
  stop() {
    this.active = false
    this.plan = null
    this.index = -1
    this.serie = false
    this._restaurerFov()
    this.onState()
  }

  _restaurerFov() {
    if (this.camera && this.camera.fov !== this.baseFov) {
      this.camera.fov = this.baseFov
      this.camera.updateProjectionMatrix()
    }
  }

  update(dt) {
    if (!this.active || !this.plan) return
    this.t += dt
    const s = clamp(this.t / this.plan.duration, 0, 1)
    const f = this.plan.sample(s)

    this.camera.position.set(f.pos.x, f.pos.y, f.pos.z)
    this.controls.target.set(f.target.x, f.target.y, f.target.z)
    this.camera.up.set(0, 1, 0)
    this.camera.lookAt(f.target.x, f.target.y, f.target.z)
    if (Math.abs(this.camera.fov - f.fov) > 1e-3) {
      this.camera.fov = f.fov
      this.camera.updateProjectionMatrix()
    }

    if (s >= 1) {
      // Un plan finit. En série on enchaîne ; sinon la caméra se pose et rend
      // la main, sur le cadrage tenable où le plan l'a laissée. Le cran reste
      // sélectionné : le clic suivant passe au plan d'après.
      if (this.serie) this._lancer(this._tirage())
      else { this.active = false; this.plan = null; this._restaurerFov(); this.onState() }
    }
  }
}
