// Top-5 named peaks of the current patch, via the Overpass API (OSM
// natural=peak nodes, no key). Markers are DOM elements projected every
// frame; each shows the peak name and its real altitude.
// Habillage : voir la section « repères de sommet » de style.css — ils
// suivent la facture des cartouches de course, pas l'ancien FUI .hud-poi.
// ÉTEINTS par défaut (params.peaksEnabled dans main.js) : la toponymie est
// une option, pas le sujet.
// Les cartouches s'évitent verticalement (glouton par altitude) et se masquent
// faute de place — voir la section « anti-chevauchement » plus bas.
// window.__peakSnap : pose instantanée, sans lissage (tests, rendu image par
// image — cf. window.__rlSnap des cartouches de course).

import * as THREE from 'three'
import { TERRAIN_SIZE } from './terrain.js'
import { worldToLatLon, latLonToWorld, demSpan } from './geo.js'
import { dansFenetre } from './fenetre-clip.js'

const OVERPASS = 'https://overpass-api.de/api/interpreter'

// Décalage nul, partagé : hors mode continu il n'y a rien à retrancher et on ne
// veut pas allouer un objet par sommet et par image pour le dire.
const ZERO = { x: 0, z: 0 }

// ══════════ LE POINT À PROJETER — Tâche R18, et il y a DEUX MONDES ══════════
//
// > **Adrien, 2026-08-31 :** « On a plein de choses qui ne fonctionnent pas
// > encore en mode sphère. »
//
// ⛔ **LES SOMMETS ÉTAIENT PROJETÉS AVEC LA CAMÉRA DU BLOC PLAT, SUR DES
// COORDONNÉES DE BLOC PLAT.** Sous le mode sphère, le bloc plat n'est plus
// dessiné du tout : ses coordonnées ne désignent plus rien à l'écran, et
// `socleAffiche()` éteignait de toute façon les marqueurs. Mesuré aux deux
// bouts de l'interrupteur « Sommets », mouvement ambiant coupé
// (`.banc/R18/fige-defaut`, plancher de bruit 0,0000) : écart moyen **0,000**,
// gradient **0,000** — l'image est identique au bit près.
//
// ⚡ **LA LOI EST ICI, PURE, PARCE QUE `update()` NE SE CHARGE PAS SOUS NODE**
// (elle touche le DOM). Une garde par expression régulière sur le texte source
// aurait laissé passer la mutation : ce dépôt en a déjà vu une survivre à
// 4 082 tests pour exactement cette raison.
//
// ⚠️ **AUCUNE CONVERSION D'UNITÉ N'EST ÉCRITE ICI, ET C'EST DÉLIBÉRÉ.** Le
// chantier compte sept défauts de conversion d'espace ; celui-ci n'en ajoute
// pas un huitième. `world.y` est en unités de BLOC (`terrain.sample` + le lift
// de 0,5), et `poseur.placer` est **l'adaptateur bloc ↔ globe du dépôt**
// (`monde/sol-globe.js`) — celui que les rivières et les toponymes utilisent
// déjà. Il porte les deux seules conversions, et elles ne sont pas recopiées.
//
// @param {{x:number,y:number,z:number}} world le sommet en coordonnées de CHAMP
// @param {{x:number,z:number}} fenetre le décalage champ → géométrie (mode continu)
// @param {{globe:boolean, placer:Function}|null} poseur `null` ou plat → le
//   comportement d'avant, au bit près.
// @returns {{x:number,y:number,z:number}} le point à projeter, dans l'espace de
//   la caméra qu'on va utiliser.
export function pointDuMarqueur(world, fenetre = ZERO, poseur = null) {
  const x = world.x - fenetre.x
  const z = world.z - fenetre.z
  if (!poseur?.globe || typeof poseur.placer !== 'function') return { x, y: world.y, z }
  const p = poseur.placer(x, z, world.y)
  return { x: p.x, y: p.y, z: p.z }
}

// ══════════ COMBIEN DE SOMMETS SUR UNE EMPRISE 3×3 ═════════════════════════
//
// Même règle que les noms de lieux (map/places-layer.js) : le nombre suit la
// SURFACE, donc le CARRÉ du côté de l'emprise. La tripler seulement diviserait
// par trois la densité de sommets dans la fenêtre visible — une régression sur
// l'image de départ, celle qu'on ne veut justement pas toucher.
//
// ⚠️ ET LE BUDGET OVERPASS SUIT AUSSI. `out body 500` était déjà calibré « sur
// un z8 dense (les Alpes entières), 150 laissait passer les vrais sommets avant
// le tri client » : sur neuf fois la surface, 500 redevient ce 150 qu'on avait
// jugé trop bas. Ce n'est pas neuf fois plus de trafic — c'est le même seuil de
// troncature ramené à la même densité au sol.
//
// Hors mode continu `cote` vaut 1 et les deux nombres sont ceux d'avant, à
// l'identique.
export function empriseCote(dem) {
  return dem?.empriseCote > 1 ? dem.empriseCote : 1
}

// ══════════ LE SEUIL DE ZOOM, ET IL EST ÉCRIT COMME CELUI DES VILLES ═══════
//
// **Tâche R24.** `map/place-tier.js` porte déjà la loi pour les toponymes :
// « population → zoom minimal ». Un sommet n'a pas de population ; son
// importance cartographique, c'est son ALTITUDE. Les bandes reprennent la même
// forme, et les largeurs d'emprise sont celles que `place-tier.js` a mesurées
// (patch 3 tuiles, ~45° N) : z6 ≈ 1 300 km, z8 ≈ 330 km, z9 ≈ 165 km,
// z10 ≈ 83 km, z11 ≈ 41 km, z12 ≈ 21 km, z13 ≈ 10 km.
//
// ⛔ **ET CE N'EST PAS DE LA PRÉCAUTION : C'EST LE PIÈGE DES ROUTES.** Adrien a
// retiré le calque routes en juillet parce qu'il « mettait trop de temps à
// charger ». Un sommet de 400 m étiqueté sur une emprise de 1 300 km, c'est la
// même faute d'échelle : le repère ne désigne rien de lisible, et la requête qui
// l'a cherché est du trafic perdu.
export function minZoomSommet(eleM) {
  const h = Number(eleM)
  if (!Number.isFinite(h)) return 12 // sans altitude, pas d'importance à faire valoir
  if (h >= 4000) return 6 // les toits d'un continent — visibles de loin
  if (h >= 2500) return 8 // ~330 km : un grand sommet alpin
  if (h >= 1500) return 9 // ~165 km
  if (h >= 800) return 10 // ~83 km
  if (h >= 400) return 11 // ~41 km
  return 12 // ~21 km : les bosses, au ras du bloc
}

// ⚠️ **D18, RÈGLE 2 : AUCUNE CLASSE N'APPARAÎT PAR UN TEST BOOLÉEN.** « Elle
// apparaît par une valeur continue partant de zéro. » Un sommet entre donc en
// **opacité**, sur UN niveau de zoom entier, et jamais d'un coup — c'est la même
// discipline qu'OSM Carto (autoroute à 0,4 px) et Positron (50 % à z6).
// ⛔ Un claquement annulerait le travail de D16, dit la règle. Il annulerait
// aussi le lissage anti-mal-de-cœur de `easePeakOffset` juste en dessous.
export function opaciteSommet(eleM, zoom) {
  // ⛔ `Number(null)` VAUT ZÉRO, PAS `NaN` : sans ce test explicite, « pas de
  // zoom connu » deviendrait « zoom 0 », c'est-à-dire TOUT masqué — l'inverse
  // exact du repli voulu, et en silence.
  if (zoom == null) return 1
  const z = Number(zoom)
  if (!Number.isFinite(z)) return 1
  const seuil = minZoomSommet(eleM)
  // le fondu s'ouvre UN niveau avant le seuil et vaut 1 au seuil
  return Math.max(0, Math.min(1, z - (seuil - 1)))
}

// ══════════ L'ANCRAGE EN ALTITUDE — LA CONVERSION, ÉCRITE ══════════════════
//
// ⛔ **LE SOL DU BLOC N'EST PAS LE SOL DESSINÉ, ET L'ÉCART SE MESURE.** Relevé
// à La Réunion, mode sphère par défaut, z12, sur une grille de 13 × 13 points
// du bloc (`.banc/R24/sol-bloc-vs-globe.json`) : médiane **+1,9 m**, mais
// l'étendue va de **−72,0 m à +98,7 m**, et **42 points sur 169 — 25 % —** ont
// le sol du BLOC SOUS le sol DESSINÉ par le globe. Un repère ancré sur
// `terrain.sample` y est enterré d'autant. C'est la classe de défaut
// « toponymes plantés 1 830 m sous les Alpes » de ce chantier, en plus petit.
//
// ⚡ **LA SORTIE N'EST PAS UNE MARGE, C'EST LE MAXIMUM DES DEUX SOLS.** Prendre
// le plus haut est la seule règle qui ne peut PAS enterrer un repère, quel que
// soit lequel des deux échantillonneurs a raison à ce point-là.
//
// ⚠️ **ET LES TROIS CONVERSIONS SONT ICI, CHIFFRÉES** — relevé au même endroit,
// `exagération = 2` :
//   ① mètres → unités de BLOC : `× echelleBloc`, mesuré **4,094 425 e−3**
//      (= `span / extentMeters × exagération` = 56 / 27 354,269 × 2) ;
//   ② mètres → unités de GLOBE : `× echelleGlobe`, mesuré **3,139 225 e−5**
//      (= `R_GLOBE / EARTH_RADIUS_M × exagération` — c'est mot pour mot la
//      forme de `rayonAncre` dans `monde/frontiere-rendu.js`, celle qui marche) ;
//   ③ unité de BLOC → unité de GLOBE : leur rapport `k`, mesuré
//      **7,667 071 e−3**, et c'est le `k` de la similitude.
// ⛔ **AUCUNE DE CES TROIS N'EST ÉCRITE DANS CE FICHIER** : elles vivent toutes
// les trois dans `monde/sol-globe.js`, et `poseur.placer` les applique. Les
// recopier ici en ferait une SECONDE loi — la classe de défaut n° 1 du chantier
// (facteurs 121,6 · 10 · 130,4 · 6 déjà attrapés).
//
// `DEGAGEMENT_BLOC` reste en unités de BLOC, et c'est délibéré : la similitude
// le transporte avec la taille du cartouche, donc le repère flotte toujours de
// la même fraction du bloc. En mètres il vaut **0,5 / 4,094 425 e−3 = 122,1 m**
// à z12 — un nombre qui suit le zoom, comme la taille apparente du bloc.
export const DEGAGEMENT_BLOC = 0.5

/**
 * L'altitude d'ancrage d'un repère, EN UNITÉS DE BLOC.
 *
 * @param {number} solDessineBloc le sol que le GLOBE dessine, déjà en unités de
 *   bloc (`poseur.hauteur`) — `null`/`NaN` quand aucune tuile ne couvre.
 * @param {number} solBlocPlat le sol du bloc plat (`terrain.sample`).
 * @param {number} [degagement]
 * @returns {number}
 */
export function ancrageSommet(solDessineBloc, solBlocPlat, degagement = DEGAGEMENT_BLOC) {
  const a = Number.isFinite(solDessineBloc) ? solDessineBloc : -Infinity
  const b = Number.isFinite(solBlocPlat) ? solBlocPlat : -Infinity
  const sol = Math.max(a, b)
  if (!Number.isFinite(sol)) return degagement
  return sol + degagement
}

// ══════════ LE COÛT RÉSEAU — ET C'EST LA VRAIE QUESTION ════════════════════
//
// ⛔ **D18 INTERDIT OVERPASS EN DIRECT** : « Tolérance réelle : < 100 requêtes
// et < 10 Mo par JOUR pour un usage régulier. » Ce calque en tirait **une par
// reconstruction de terrain**, c'est-à-dire une par cran de zoom : une descente
// de z12 à z17 en coûtait **six**, et rien n'était réutilisé au retour.
//
// ⚡ **LA SORTIE EST UN CACHE PAR EMPRISE**, arrondie au dix-millième de degré
// (~11 m) pour que deux reconstructions de la MÊME vue ne comptent qu'une fois.
// Mesuré sur une descente complète : voir `rapport-R24.md`.
//
// ⚠️ **ET LE CACHE MÉMORISE AUSSI L'ÉCHEC.** Overpass est injoignable depuis
// cette machine (`Connect Timeout` sur les quatre adresses, quatre miroirs
// essayés) : sans mémoire de l'échec, chaque reconstruction relancerait une
// requête qui va expirer, et le calque passerait son temps en attente.
const CACHE_SOMMETS = new Map()
const CACHE_MAX = 24 // une vingtaine de déplacements, comme le cache de cellules

export function cleEmprise(south, west, north, east, budget) {
  const r = (v) => Math.round(v * 1e4) / 1e4
  return `${r(south)},${r(west)},${r(north)},${r(east)}|${budget}`
}

export function videCacheSommets() { CACHE_SOMMETS.clear() }
export function tailleCacheSommets() { return CACHE_SOMMETS.size }

export async function fetchTopPeaks(dem, count = 5) {
  // ⚠️ `demSpan`, pas `TERRAIN_SIZE` : sur une emprise 3×3 le champ fait 168
  // unités. La boîte écrite en dur ne demandait à Overpass que le bloc CENTRAL —
  // on aurait défilé vers un massif entier sans un seul sommet coté.
  const h = demSpan(dem) / 2
  const cote = empriseCote(dem)
  const north = worldToLatLon(dem, 0, -h).lat
  const south = worldToLatLon(dem, 0, h).lat
  const west = worldToLatLon(dem, -h, 0).lon
  const east = worldToLatLon(dem, h, 0).lon
  // 500-node budget: on a dense z8 patch (whole Alps) 150 was low enough to
  // miss the actual highest summits before the client-side sort
  const budget = 500 * cote * cote
  // ⚡ **UNE EMPRISE, UNE REQUÊTE — voir le cache ci-dessus.** La clé est
  // l'emprise arrondie, pas le zoom : deux reconstructions qui regardent le même
  // rectangle ne valent qu'une requête, et le retour d'un aller-retour de zoom
  // ne coûte plus rien.
  const cle = cleEmprise(south, west, north, east, budget)
  if (CACHE_SOMMETS.has(cle)) return CACHE_SOMMETS.get(cle)
  const q = `[out:json][timeout:20];node["natural"="peak"]["name"](${south},${west},${north},${east});out body ${budget};`
  const p = (async () => {
    const r = await fetch(OVERPASS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(q)}`,
    })
    if (!r.ok) throw new Error(`overpass → HTTP ${r.status}`)
    const json = await r.json()
    return (json.elements || [])
      .map((e) => ({
        name: e.tags?.name || '',
        ele: parseFloat(e.tags?.ele) || null,
        lat: e.lat,
        lon: e.lon,
      }))
      .filter((p) => p.name)
      .sort((a, b) => (b.ele ?? -1) - (a.ele ?? -1))
      .slice(0, count * cote * cote)
  })()
  // ⚠️ **LA PROMESSE EST MISE EN CACHE, PAS SON RÉSULTAT** : deux
  // reconstructions rapprochées (un cran de zoom pendant qu'Overpass répond
  // encore) partagent alors la MÊME requête au lieu d'en lancer deux.
  // ⛔ **ET L'ÉCHEC RESTE EN CACHE.** Sans ça, un Overpass injoignable — c'est
  // le cas depuis cette machine — ferait relancer une requête qui expire à
  // chaque reconstruction. `catch` ici pour qu'une promesse mémorisée mais
  // jamais réclamée ne remonte pas en rejet non traité.
  p.catch(() => null)
  CACHE_SOMMETS.set(cle, p)
  if (CACHE_SOMMETS.size > CACHE_MAX) CACHE_SOMMETS.delete(CACHE_SOMMETS.keys().next().value)
  return p
}

// Séparateur de milliers À LA MAIN. `toLocaleString('fr-FR')` pose une
// ESPACE FINE INSÉCABLE (U+202F) que Bricolage Grotesque n'a pas dans sa
// casse : la fiche de survol affichait « 13520 ft » là où le cartouche, en
// mono, montrait bien « 13 520 ». L'insécable normale, elle, est partout.
const milliers = (n) => Math.round(n).toLocaleString('fr-FR').replace(/[\u202F\u2009]/g, '\u00A0')

// ---- anti-chevauchement des cartouches ---------------------------------
// Sur un massif dense les cinq cartouches se posaient les uns SUR les autres
// et plus rien n'était lisible : à Chamonix (45,9 / 6,99) en z11, les Grandes
// Jorasses, le Walkerpfeiler, la Pointe Whymper et la Pointe Croz tiennent
// dans moins de 0,01° — quelques pixels à l'écran.
// On reprend le « panneau planté » des cartouches de course (race-labels.js,
// buildRaceLabels) : placement glouton par priorité — ici l'altitude, le plus
// haut sommet sert en premier —, candidats à ±1vw / 2vh autour du point, et
// masquage de ce qui ne rentre nulle part.
// Ce qui se masque, c'est le CARTOUCHE, jamais le POINT : les quatre sommets
// restent cotés sur le relief, seule la toponymie en trop s'efface. Faire
// disparaître un sommet de la carte parce qu'un voisin plus haut lui a pris la
// place serait un mensonge cartographique.
// Les deux constantes suivantes RECOPIENT le CSS (.peak-cart : height 24px,
// bottom 11px). Les mesurer au DOM coûterait un reflow par frame et par
// marqueur, pour des valeurs qui ne bougent jamais (une ligne, jamais de retour
// à la ligne) — mais si le CSS change, il faut les changer ici aussi.
const PEAK_CART_H = 24
const PEAK_GAP = 11 // l'écart naturel point↔cartouche
// Marge de non-contact entre deux cartouches. Elle est VOLONTAIREMENT au-dessus
// de la zone morte du lissage : un cartouche figé dans sa zone morte est à
// jusqu'à PEAK_DEADZONE px de la place qu'on lui a réservée, et doit malgré
// tout ne jamais mordre son voisin. Toucher à l'une sans l'autre rouvre le
// chevauchement par la fenêtre.
const PEAK_MARGE = 10
const PEAK_DEADZONE = 8 // cf. easePeakOffset
const PEAK_GLISSE = 0.04
// Un glouton recalculé à chaque frame peut osciller à la frontière : ça rentre,
// ça ne rentre plus, ça rentre… Le masquage est donc IMMÉDIAT (jamais un
// chevauchement à l'écran, pas même une frame) mais la réapparition exige
// PEAK_HOLD frames de calme consécutives, sinon un cartouche coincé entre deux
// voisins clignoterait à 60 Hz — soit exactement le mal qu'on soigne.
const PEAK_HOLD = 8
// Période de re-lecture du sol DESSINÉ, en images (Tâche R24). 30 images, soit
// un demi-tour de seconde à 60 Hz : invisible à l'œil sur un marqueur qui suit
// déjà sa crête, et c'est le même arbitrage de FRAÎCHEUR que les 500 ms du
// poseur dans `main.js` — les tuiles arrivent du réseau, pas de la mémoire.
const PEAK_REANCRE = 30

export const PEAK_CONST = { PEAK_CART_H, PEAK_GAP, PEAK_MARGE, PEAK_DEADZONE, PEAK_GLISSE, PEAK_HOLD, PEAK_REANCRE } // exposé pour les tests

// Placement glouton, pur (aucun DOM) : `list` est déjà dans l'ordre de
// priorité, chaque entrée porte le point projeté (ax, ay) et la largeur mesurée
// du cartouche (tw). Renvoie, pour chacune et dans le même ordre, le décalage
// (dx, dy) à appliquer au cartouche par rapport à sa place naturelle, ou
// hidden: true si rien ne rentre.
export function placePeakCarts(list, w, h) {
  const vw = w / 100 // 1vw : micro-jeu horizontal, le cartouche reste collé au point
  const vh = (2 * h) / 100 // 2vh : tout le débattement vertical autorisé
  // trois crans d'écart au point ; le premier EST la place naturelle (CSS)
  const gaps = [PEAK_GAP, Math.max(PEAK_GAP + 4, vh * 0.5), Math.max(PEAK_GAP + 8, vh)]
  const cands = []
  // au-dessus d'abord — le cartouche appartient au ciel, pas au versant —
  // puis en dessous, comme les cartouches de course
  for (const g of gaps) for (const dx of [0, -vw, vw]) cands.push([dx, PEAK_GAP - g])
  for (const g of gaps) for (const dx of [0, -vw, vw]) cands.push([dx, PEAK_GAP + g + PEAK_CART_H])
  const placed = []
  return list.map((m) => {
    const tw = m.tw || 0
    for (const [dx, dy] of cands) {
      // dy déplace le cartouche entier ; son bas est à ay + dy - PEAK_GAP
      const x0 = m.ax + dx - tw / 2
      const y0 = m.ay + dy - PEAK_GAP - PEAK_CART_H
      if (x0 < 2 || y0 < 2 || x0 + tw > w - 2 || y0 + PEAK_CART_H > h - 2) continue
      const x1 = x0 + tw
      const y1 = y0 + PEAK_CART_H
      let libre = true
      for (const r of placed) {
        if (x0 < r.x1 + PEAK_MARGE && r.x0 < x1 + PEAK_MARGE && y0 < r.y1 + PEAK_MARGE && r.y0 < y1 + PEAK_MARGE) { libre = false; break }
      }
      if (!libre) continue
      placed.push({ x0, y0, x1, y1 })
      return { dx, dy, hidden: false }
    }
    // masqué : on le renvoie quand même à sa place naturelle, pour qu'il
    // n'ait pas un décalage aberrant à rattraper le jour où il réapparaît
    return { dx: 0, dy: 0, hidden: true }
  })
}

// ANTI mal de cœur — la règle qui compte, reprise de race-labels.js. Le
// cartouche est RIGIDE avec la carte : c'est son DÉCALAGE au point qui est
// collant. Zone morte de 8 px : en dessous il ne bouge PAS DU TOUT, donc les
// micro-reshuffles d'un glouton recalculé à chaque frame ne le font pas
// sautiller. Au-delà, il glisse très lentement (0,04) et, une fois engagé, va
// jusqu'au bout — sinon il s'arrêterait en chemin dès qu'il rentre dans la
// zone morte et resterait à côté de sa place.
// Reposer le cartouche à sa cible à chaque frame (la version naïve) serait PIRE
// que le chevauchement qu'on corrige : la moindre rotation de caméra ferait
// vibrer les cinq étiquettes.
export function easePeakOffset(m, tox, toy, snap) {
  if (m.ox == null || snap) { m.ox = tox; m.oy = toy; m.moving = false; return m }
  const d = Math.hypot(tox - m.ox, toy - m.oy)
  if (d > PEAK_DEADZONE) m.moving = true
  if (m.moving) {
    m.ox += (tox - m.ox) * PEAK_GLISSE
    m.oy += (toy - m.oy) * PEAK_GLISSE
    if (d < 1) { m.ox = tox; m.oy = toy; m.moving = false }
  }
  return m
}

// Fiche de survol, une seule pour tous les marqueurs, montrée au
// pointerenter et cachée au pointerleave. `pointer-events: none` : elle ne
// peut jamais intercepter le survol auquel elle réagit (sinon elle
// clignoterait en se disputant le pointeur avec le marqueur).
// Elle portait les classes .hud-panel/.hud-row/.accent de hud2d.js — le FUI
// de fiction de v1 — avec quatre lignes CLASS / ELEV / GRID / STATUS dont
// deux ne disaient rien (CLASS valait toujours « PEAK », STATUS toujours
// « NAMED » : du costume, pas de l'information). Il ne reste que ce qui
// n'est pas déjà sur le cartouche, dans le verre v28 (.ce-glassbox).
function buildHoverCard() {
  const card = document.createElement('div')
  card.className = 'ce-glassbox peak-card'
  card.style.display = 'none'
  card.style.pointerEvents = 'none'

  const nameEl = document.createElement('b')
  const elevEl = document.createElement('span')
  const gridEl = document.createElement('span')
  card.append(nameEl, elevEl, gridEl)

  document.body.appendChild(card)
  return { card, nameEl, elevEl, gridEl }
}

export class PeaksLayer {
  // ⚡ **`getPoseur` — Tâche R24.** `update()` recevait déjà le poseur à chaque
  // image ; `refresh()` ne l'avait PAS, et c'est là que l'altitude d'ancrage se
  // décide. Un repère ancré sur le seul sol du bloc plat est enterré partout où
  // le globe dessine plus haut — 25 % des points relevés, jusqu'à 72 m.
  // `null` (ou un poseur plat) ⇒ comportement d'avant, au bit près.
  // ⚠️ **`getZoom` sert LE SEUIL D'IMPORTANCE, pas la requête** : le budget
  // Overpass est déjà borné par `out body`, ce qui manquait c'est de ne pas
  // ÉTIQUETER une bosse de 400 m sur une emprise continentale (`minZoomSommet`).
  constructor({ terrain, getDem, announce, onFocus, getPoseur = null, getZoom = null }) {
    this.terrain = terrain
    this.getDem = getDem
    this.announce = announce
    this.onFocus = onFocus // (worldVec3, name) → orbit above the summit
    this.getPoseur = getPoseur
    this.getZoom = getZoom
    this.enabled = false
    this.markers = [] // { el, tag, world, name, ele, lat, lon, tw, ox, oy… }
    this._v = new THREE.Vector3()
    this._frame = 0 // sert à espacer les re-mesures de largeur (voir update)
    this._gen = 0 // request generation — stale fetches discard themselves
    this._hovered = null // the marker (from this.markers) whose card is showing
    this._hc = buildHoverCard()
  }

  async setEnabled(v) {
    this.enabled = v
    if (!v) return this._clear()
    await this.refresh()
  }

  _showCard(m) {
    this._hovered = m
    this._hc.nameEl.textContent = m.name
    this._hc.elevEl.textContent = `${milliers(m.ele)} m · ${milliers(m.ele * 3.28084)} ft`
    this._hc.gridEl.textContent = `${m.lat.toFixed(4)}°, ${m.lon.toFixed(4)}°`
    this._hc.card.style.display = 'block'
  }

  _hideCard() {
    this._hovered = null
    this._hc.card.style.display = 'none'
  }

  // called on enable and after every terrain rebuild while enabled
  async refresh() {
    this._clear()
    const dem = this.getDem()
    if (!this.enabled || !dem) return
    const gen = ++this._gen // supersedes any fetch still in flight
    try {
      const peaks = await fetchTopPeaks(dem)
      if (!this.enabled || gen !== this._gen) return // toggled off / superseded
      if (!peaks.length) {
        this.announce('NO NAMED PEAKS IN THIS SECTOR')
        return
      }
      const demi = demSpan(dem) / 2
      // ⚡ **LE POSEUR EST PRIS UNE FOIS PAR RECONSTRUCTION**, jamais par
      // sommet : `monde/sol-globe.js` le dit lui-même — « sans elle, chacun des
      // milliers de sommets d'un calque reparcourrait `globe.tiles` ».
      const poseur = this.getPoseur?.() ?? null
      const surGlobe = !!poseur?.globe
      for (const p of peaks) {
        const w = latLonToWorld(dem, p.lat, p.lon)
        if (Math.abs(w.x) > demi || Math.abs(w.z) > demi) continue
        // ⚠️ `terrain.sample` PARLE EN COORDONNÉES DE GÉOMÉTRIE, `w` EN
        // COORDONNÉES DE CHAMP — le sampler ajoute lui-même le décalage de
        // fenêtre. Lui passer `w.x` tel quel le ferait lire le sol DEUX FOIS
        // décalé : chaque sommet se poserait à l'altitude d'un autre endroit.
        // Même correction que map/places-layer.js. Hors mode continu `fen` vaut
        // zéro et l'appel est celui d'avant, au bit près.
        const fen = this.terrain.fenetre ?? ZERO
        const solPlat = this.terrain.sample(w.x - fen.x, w.z - fen.z)
        // ⚡ **ET LE SOL DESSINÉ PAR LE GLOBE, quand il y en a un** — voir
        // `ancrageSommet` : les deux sols diffèrent de −72 m à +98,7 m à La
        // Réunion, et le bloc est SOUS le dessin sur un quart des points.
        // `poseur.hauteur` rend déjà des unités de BLOC, et il retombe tout seul
        // sur `sample` quand aucune tuile ne couvre (`refus`).
        const solGlobe = surGlobe ? poseur.hauteur(w.x, w.z) : null
        const y = ancrageSommet(solGlobe, solPlat)
        // ⚠️ **L'ALTITUDE AFFICHÉE RESTE CELLE DU SOL, PAS CELLE DE L'ANCRE** :
        // on retranche le dégagement, sinon la cote grandirait de 122 m d'un
        // coup et le cartouche mentirait de la hauteur à laquelle il flotte.
        const ele = p.ele ?? Math.round(this.terrain.heightToFeet(y - DEGAGEMENT_BLOC) / 3.28084)
        const el = document.createElement('div')
        el.className = 'peak-marker'
        const dot = document.createElement('i')
        dot.className = 'peak-dot'
        const tag = document.createElement('span')
        tag.className = 'peak-cart'
        // les noms OSM ne sont pas de confiance — textContent, jamais de HTML
        const nameEl = document.createElement('b')
        nameEl.className = 'peak-name'
        // la capitale est posée en CSS (text-transform) et non ici : la fiche
        // de survol réaffiche le MÊME nom en casse d'origine
        nameEl.textContent = p.name
        const eleEl = document.createElement('i')
        eleEl.className = 'peak-alt'
        eleEl.textContent = `${milliers(ele)} m`
        tag.append(nameEl, eleEl)
        el.append(dot, tag)
        document.body.appendChild(el)
        const world = new THREE.Vector3(w.x, y, w.z)
        // La caméra se cale sur des coordonnées de GÉOMÉTRIE : on retranche le
        // décalage AU MOMENT DU CLIC (et non ici), sinon un sommet cliqué après
        // un défilement enverrait la caméra à l'endroit qu'il occupait avant.
        el.addEventListener('click', () => {
          const f = this.terrain?.fenetre ?? ZERO
          this.onFocus?.(new THREE.Vector3(world.x - f.x, world.y, world.z - f.z), p.name)
        })
        // tw : largeur du cartouche, mesurée paresseusement dans update() (les
        // fontes arrivent après le premier rendu) ; shownFor part plein pour
        // que la toute première pose soit immédiate — le délai de PEAK_HOLD ne
        // concerne que les RÉapparitions.
        // `solPlat` est gardé pour le RÉ-ANCRAGE paresseux d'`update()` : les
        // tuiles de hauteur du globe arrivent du réseau, et un repère construit
        // avant elles est posé sur le repli. Sans cette mémoire il faudrait
        // rappeler `terrain.sample` à chaque tour.
        const marker = { el, tag, world, name: p.name, ele, lat: p.lat, lon: p.lon, solPlat, tw: 0, shownFor: PEAK_HOLD }
        // fiche de survol (altitude m/ft + coordonnées) — voir buildHoverCard()
        el.addEventListener('pointerenter', () => this._showCard(marker))
        el.addEventListener('pointerleave', () => this._hideCard())
        this.markers.push(marker)
      }
      this.announce(`${this.markers.length} PEAKS PLOTTED`)
    } catch (err) {
      if (gen !== this._gen) return // superseded — the newer refresh reports
      console.warn('peaks:', err.message)
      this.announce('PEAK DATA OFFLINE')
    }
  }

  update(camera, w, h, visible, poseur = null) {
    let hoveredOn = false
    const vis = [] // dans l'ordre des marqueurs, donc par altitude décroissante
    this._frame++
    // ══════════ LES SOMMETS SUIVENT LE RELIEF ═══════════════════════════════
    //
    // `m.world` est en coordonnées de CHAMP (celles que rend `latLonToWorld`) ;
    // la fenêtre est le décalage entre le champ et la géométrie affichée. Le
    // retrancher AVANT la projection, c'est tout ce qu'il faut pour qu'un
    // sommet reste planté sur sa crête pendant qu'on défile — au lieu de rester
    // collé à l'écran pendant que sa montagne s'en va. Zéro géométrie, deux
    // soustractions par sommet et par image.
    const fen = this.terrain?.fenetre ?? ZERO
    // ⚠️ ET LE TEST DE FENÊTRE N'EST POSÉ QU'EN MODE CONTINU. Les sommets sont
    // choisis sur toute l'emprise, soit neuf fois la surface visible : sans ce
    // rejet, huit neuvièmes d'entre eux flotteraient au-delà du bord du socle,
    // au-dessus du vide. Hors mode continu ils sont déjà tous dans le bloc, et
    // poser l'octogone quand même risquerait de couper un sommet de coin
    // (|x|+|z| ≤ 56) qui s'affiche parfaitement aujourd'hui.
    const clip = this.getDem?.()?.empriseCote > 1
    const demi = TERRAIN_SIZE / 2
    // ══════════ LE RÉ-ANCRAGE PARESSEUX — Tâche R24 ═════════════════════════
    //
    // ⚠️ **LES HAUTEURS DU GLOBE ARRIVENT DU RÉSEAU.** Un repère construit avant
    // ses tuiles est posé sur le repli (le sol du bloc plat), et il y resterait
    // pour toujours : `refresh()` ne repasse qu'à la reconstruction suivante.
    // On relit donc le sol dessiné toutes les `PEAK_REANCRE` images — 45
    // marqueurs au pire, un vingtième de seconde d'écart, et ça s'arrête tout
    // seul dès que le sol ne bouge plus.
    if (poseur?.globe && this._frame % PEAK_REANCRE === 0) {
      for (const m of this.markers) {
        const sol = poseur.hauteur(m.world.x, m.world.z)
        const y = ancrageSommet(sol, m.solPlat)
        if (Math.abs(y - m.world.y) > 1e-6) m.world.y = y
      }
    }
    // ⚠️ **D18, RÈGLE 2 — L'ENTRÉE EST CONTINUE, JAMAIS BOOLÉENNE.** Le zoom du
    // MNT décide de l'opacité de chaque repère, par son altitude
    // (`opaciteSommet`). Sans ça toute la classe apparaîtrait d'un coup au
    // franchissement d'un cran — « un claquement annulerait le travail de D16 ».
    const zoom = this.getZoom?.()
    for (const m of this.markers) {
      // ⚠️ **LE POINT PASSE PAR LA LOI, PAS PAR TROIS SOUSTRACTIONS EN CLAIR** —
      // c'est elle qui sait qu'il y a deux mondes (voir `pointDuMarqueur`).
      const pt = pointDuMarqueur(m.world, fen, poseur)
      this._v.set(pt.x, pt.y, pt.z).project(camera)
      const dedans = !clip || dansFenetre(m.world.x - fen.x, m.world.z - fen.z, demi)
      const importance = zoom == null ? 1 : opaciteSommet(m.ele, zoom)
      m.importance = importance
      const on = visible && dedans && this._v.z < 1 && importance > 0
      m.el.style.opacity = on ? importance : 0
      // an off-screen marker keeps its last transform (frozen), so without this
      // its tag (pointer-events:auto) stays clickable while invisible → phantom
      // clicks focusing a peak that isn't on screen (incl. all of orbit mode)
      m.tag.style.pointerEvents = on ? 'auto' : 'none'
      m.ax = (this._v.x * 0.5 + 0.5) * w
      m.ay = (-this._v.y * 0.5 + 0.5) * h
      if (on) {
        m.el.style.transform = `translate(${m.ax.toFixed(1)}px, ${m.ay.toFixed(1)}px)`
        // mesure paresseuse : le contenu ne change jamais après refresh(), mais
        // Bricolage Grotesque arrive après le premier rendu et élargit le
        // cartouche. On re-mesure quelques fois au début, puis plus jamais —
        // offsetWidth force un reflow, hors de question à chaque frame.
        if (!m.tw || (this._frame < 240 && this._frame % 30 === 0)) m.tw = m.tag.offsetWidth
        vis.push(m)
      } else {
        // hors champ : on réarme le compteur pour qu'un marqueur qui revient
        // dans le cadre pose son cartouche en même temps que son point, sans
        // le délai (celui-ci ne sert qu'aux bagarres de place entre voisins),
        // et on oublie son décalage — sinon il rentrerait dans le cadre en
        // glissant lentement depuis la place qu'il occupait il y a un tour de
        // caméra, ce qui se voit comme un cartouche qui dérive tout seul.
        m.shownFor = PEAK_HOLD
        m.ox = null
      }
      if (m === this._hovered) {
        hoveredOn = on
        if (on) {
          // la fiche se pose en bas à droite du point, bornée pour ne jamais
          // sortir du cadre. Les marges (200/90) suivent la taille de la
          // fiche : elles valaient 250/130 du temps du panneau FUI à quatre
          // lignes et laissaient désormais un trou au bord droit.
          const px = Math.min(Math.max(m.ax + 14, 10), w - 200)
          const py = Math.min(m.ay + 8, h - 90)
          this._hc.card.style.transform = `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px)`
        }
      }
    }

    // anti-chevauchement : glouton sur les seuls marqueurs à l'écran, puis
    // glissement lissé de chaque cartouche vers la place qu'il a obtenue
    const spots = placePeakCarts(vis, w, h)
    for (let i = 0; i < vis.length; i++) {
      const m = vis[i]
      const s = spots[i]
      easePeakOffset(m, s.dx, s.dy, window.__peakSnap)
      // le CSS pose déjà `transform: translateX(-50%)` pour centrer le
      // cartouche sur le point : un transform en ligne l'ÉCRASE en entier, il
      // faut donc le rejouer ici. L'oublier décale tout d'une demi-largeur.
      m.tag.style.transform = `translateX(-50%) translate(${Math.round(m.ox)}px, ${Math.round(m.oy)}px)`
      m.shownFor = s.hidden ? 0 : Math.min(m.shownFor + 1, PEAK_HOLD)
      const show = m.shownFor >= PEAK_HOLD
      m.tag.style.opacity = show ? '1' : '0'
      // un cartouche invisible mais toujours cliquable, c'est le clic fantôme
      // déjà corrigé pour les marqueurs hors champ — même garde ici
      if (!show) m.tag.style.pointerEvents = 'none'
      if (m === this._hovered && !show) hoveredOn = false
    }

    // the hovered marker itself just went off-screen/invisible — drop the card
    // rather than leave it frozen over nothing (mirrors the marker's own
    // opacity/pointer-events guard above)
    if (this._hovered && !hoveredOn) this._hideCard()
  }

  _clear() {
    this.markers.forEach((m) => m.el.remove())
    this.markers = []
    this._hideCard()
  }
}
