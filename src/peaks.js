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
import { worldToLatLon, latLonToWorld } from './geo.js'

const OVERPASS = 'https://overpass-api.de/api/interpreter'

export async function fetchTopPeaks(dem, count = 5) {
  const h = TERRAIN_SIZE / 2
  const north = worldToLatLon(dem, 0, -h).lat
  const south = worldToLatLon(dem, 0, h).lat
  const west = worldToLatLon(dem, -h, 0).lon
  const east = worldToLatLon(dem, h, 0).lon
  // 500-node budget: on a dense z8 patch (whole Alps) 150 was low enough to
  // miss the actual highest summits before the client-side sort
  const q = `[out:json][timeout:20];node["natural"="peak"]["name"](${south},${west},${north},${east});out body 500;`
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
    .slice(0, count)
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

export const PEAK_CONST = { PEAK_CART_H, PEAK_GAP, PEAK_MARGE, PEAK_DEADZONE, PEAK_GLISSE, PEAK_HOLD } // exposé pour les tests

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
  constructor({ terrain, getDem, announce, onFocus }) {
    this.terrain = terrain
    this.getDem = getDem
    this.announce = announce
    this.onFocus = onFocus // (worldVec3, name) → orbit above the summit
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
      for (const p of peaks) {
        const w = latLonToWorld(dem, p.lat, p.lon)
        if (Math.abs(w.x) > TERRAIN_SIZE / 2 || Math.abs(w.z) > TERRAIN_SIZE / 2) continue
        const y = this.terrain.sample(w.x, w.z) + 0.5
        const ele = p.ele ?? Math.round(this.terrain.heightToFeet(y - 0.5) / 3.28084)
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
        el.addEventListener('click', () => this.onFocus?.(world, p.name))
        // tw : largeur du cartouche, mesurée paresseusement dans update() (les
        // fontes arrivent après le premier rendu) ; shownFor part plein pour
        // que la toute première pose soit immédiate — le délai de PEAK_HOLD ne
        // concerne que les RÉapparitions.
        const marker = { el, tag, world, name: p.name, ele, lat: p.lat, lon: p.lon, tw: 0, shownFor: PEAK_HOLD }
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

  update(camera, w, h, visible) {
    let hoveredOn = false
    const vis = [] // dans l'ordre des marqueurs, donc par altitude décroissante
    this._frame++
    for (const m of this.markers) {
      this._v.copy(m.world).project(camera)
      const on = visible && this._v.z < 1
      m.el.style.opacity = on ? 1 : 0
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
