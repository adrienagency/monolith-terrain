// Race Studio — cartouches HTML en espace écran, ancrées aux points 3D.
// Contrat (Adrien) : taille CONSTANTE quelle que soit la perspective, tout
// reste lisible, pas de chevauchement (résolu par layoutCartouches — et
// DÉBRAYABLE via params.gpxLabelAvoid). Les POI transport passent par le même
// pipeline en style « chip ». Pure DOM + projection : aucun objet three dans
// la scène, donc zéro coût GPU et un rendu net à toutes les tailles.
import * as THREE from 'three'
import './ui/race-labels.css'
import { layoutCartouches } from './race-model.js'

// pictos 14×14 monochromes (currentColor) — langage ShibuMap, inspirés des
// composants Transju (ravito/services) + besoins transport d'Adrien
export const PICTOS = {
  ravito: '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3 1v5M5 1v5M4 6v7M4 1v2"/><path d="M10 1c-1.5 0-2 2-2 3.5S9 7 10 7v6M10 1v6"/></svg>',
  eau: '<svg viewBox="0 0 14 14" fill="currentColor"><path d="M7 1.5C7 1.5 3 6.5 3 9a4 4 0 0 0 8 0c0-2.5-4-7.5-4-7.5z"/></svg>',
  repas: '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2 8h10a5 5 0 0 1-10 0z" fill="currentColor"/><path d="M4 5c0-1 1-1 1-2M7 5c0-1 1-1 1-2"/></svg>',
  dodo: '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M1 11V5M1 9h12v2M4 9V7h9a2 2 0 0 0-2-2H4"/><circle cx="3.5" cy="6.5" r="1" fill="currentColor"/></svg>',
  wc: '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3"><text x="7" y="10.5" text-anchor="middle" font-size="9" font-weight="700" fill="currentColor" stroke="none">WC</text></svg>',
  vue: '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M1 7s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z"/><circle cx="7" cy="7" r="1.6" fill="currentColor"/></svg>',
  col: '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 12l4-7 2.5 4L10 4l3 8"/></svg>',
  secours: '<svg viewBox="0 0 14 14" fill="currentColor"><path d="M5.5 1h3v4.5H13v3H8.5V13h-3V8.5H1v-3h4.5z"/></svg>',
  arrivee: '<svg viewBox="0 0 14 14" fill="currentColor"><path d="M2 1h1v12H2zM4 1h8v6H4zM5 2v1.5h1.5V2zM8 2v1.5h1.5V2zM6.5 3.5V5H8V3.5zM9.5 3.5V5H11V3.5zM5 5v1.5h1.5V5zM8 5v1.5h1.5V5z" fill-rule="evenodd"/></svg>',
  gare: '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="3" y="1.5" width="8" height="8" rx="1.5"/><path d="M3 6.5h8M5 12l-1 1.5M9 12l1 1.5M5.5 9.5V12h3V9.5"/><circle cx="5.5" cy="8" r=".6" fill="currentColor"/><circle cx="8.5" cy="8" r=".6" fill="currentColor"/></svg>',
  bus: '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="2" y="2" width="10" height="9" rx="1.5"/><path d="M2 7h10"/><circle cx="4.5" cy="12.2" r="1" fill="currentColor"/><circle cx="9.5" cy="12.2" r="1" fill="currentColor"/></svg>',
  telepherique: '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M1 3l12-2M7 2.5V5"/><rect x="4" y="5" width="6" height="6" rx="1.2"/><path d="M4 8h6"/></svg>',
  aeroport: '<svg viewBox="0 0 14 14" fill="currentColor"><path d="M13 8l-5-2V2.5a1 1 0 0 0-2 0V6L1 8v1.5l5-1v2.6L4.5 12v1l2.5-.7 2.5.7v-1L8 11.1V8.5l5 1z"/></svg>',
  metro: '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="7" cy="7" r="5.6"/><path d="M4 9.5V4.8L7 8l3-3.2v4.7" stroke-linejoin="round"/></svg>',
  bateau: '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M2 9h10l-1.5 3h-7z" fill="currentColor"/><path d="M7 9V2M7 2l4 5H7"/></svg>',
}
export const PICTO_KEYS = ['ravito', 'eau', 'repas', 'dodo', 'wc', 'vue', 'col', 'secours', 'arrivee']

const CART_H = 26 // hauteur fixe d'un cartouche (px) — pas de mesure DOM
const CHIP_H = 18
const LEAD = 16 // longueur de la ligne de rappel

export function buildRaceLabels({ container, camera, getItems, params, onRemove, getTrackWorlds }) {
  const root = document.createElement('div')
  root.className = 'rl-root'
  container.appendChild(root)

  const v = new THREE.Vector3()
  let dirty = true
  const nodes = new Map() // id → {cart, anchor, leader, item}

  const setDirty = () => { dirty = true }

  function buildNode(item) {
    const isChip = item.kind === 'transport'
    const cart = document.createElement('div')
    cart.className = isChip ? 'rl-chip' : item.kind === 'start' ? 'rl-cart rl-start' : 'rl-cart'
    if (item.kind === 'start') {
      // l'étiquette la PLUS importante (Adrien) : fond INVERSÉ (encre), logo
      // passé en blanc, km dans un GROS encadré couleur, START / FINISH en
      // gros, pictos (≤8) en dessous — toujours visible, jamais fenêtrée
      const logo = item.logo ? `<img class="rl-start-logo" src="${item.logo}" alt="">` : ''
      const pictos = (item.pictos || []).slice(0, 8).map((p) => PICTOS[p] || '').join('')
      cart.innerHTML = `${logo}<span class="rl-start-main">
        ${item.name ? `<b class="rl-start-name">${item.name}</b>` : ''}
        <span class="rl-start-word">${item.word || 'START'}</span>
        ${pictos ? `<span class="rl-picto">${pictos}</span>` : ''}
      </span><span class="rl-start-km">${item.totalKm} KM</span>`
    } else if (isChip) {
      cart.innerHTML = `${PICTOS[item.pictos?.[0]] || PICTOS.bus}<span>${item.name}</span><span class="rl-x" title="Retirer">✕</span>`
      cart.querySelector('.rl-x').addEventListener('click', (e) => { e.stopPropagation(); onRemove?.(item.id) })
    } else {
      const km = item.km != null ? `<span class="rl-km">${(+item.km).toFixed(item.km % 1 ? 1 : 0)}</span>` : ''
      const pictos = item.pictos?.length ? `<span class="rl-picto">${item.pictos.map((p) => PICTOS[p] || '').join('')}</span>` : ''
      const subBits = []
      if (item.alt != null) subBits.push(`${Math.round(item.alt)} m`)
      if (item.cutoff) subBits.push(`barrière ${item.cutoff}`)
      const sub = subBits.length ? `<span class="rl-sub">${subBits.join(' · ')}</span>` : ''
      cart.innerHTML = `${km}<span class="rl-name">${item.name || '—'}</span>${pictos}${sub}`
    }
    const anchor = document.createElement('i')
    anchor.className = 'rl-anchor'
    const leader = document.createElement('i')
    leader.className = 'rl-leader'
    root.append(leader, anchor, cart)
    return { cart, anchor, leader, item }
  }

  function sync() {
    const items = getItems() || []
    const seen = new Set()
    for (const it of items) {
      seen.add(it.id)
      const n = nodes.get(it.id)
      if (!n) nodes.set(it.id, buildNode(it))
      else if (JSON.stringify({ ...n.item, world: 0, faded: 0 }) !== JSON.stringify({ ...it, world: 0, faded: 0 })) {
        n.cart.remove(); n.anchor.remove(); n.leader.remove()
        nodes.set(it.id, buildNode(it))
      } else n.item = it // rafraîchit la référence world
    }
    for (const [id, n] of nodes) if (!seen.has(id)) { n.cart.remove(); n.anchor.remove(); n.leader.remove(); nodes.delete(id) }
    dirty = false
  }

  function update() {
    if (!params.gpxCartouches) { root.classList.add('rl-hidden'); return }
    root.classList.remove('rl-hidden')
    sync() // toujours — un zoom reconstruit les blocs et leurs Vector3
    if (!nodes.size) return
    const w = container.clientWidth
    const h = container.clientHeight
    // 1. projeter chaque ancre
    const vis = []
    for (const n of nodes.values()) {
      v.copy(n.item.world).project(camera)
      const off = v.z > 1 || v.x < -1.15 || v.x > 1.15 || v.y < -1.15 || v.y > 1.15
      n.off = off
      if (off) { n.cart.classList.add('rl-hidden'); n.anchor.classList.add('rl-hidden'); n.leader.classList.add('rl-hidden'); continue }
      n.cart.classList.remove('rl-hidden'); n.anchor.classList.remove('rl-hidden'); n.leader.classList.remove('rl-hidden')
      // lecture : fondu LENT (1,8 s) d'apparition/disparition via .rl-faded
      const faded = !!n.item.faded
      n.cart.classList.toggle('rl-faded', faded)
      n.anchor.classList.toggle('rl-faded', faded)
      n.leader.classList.toggle('rl-faded', faded)
      n.ax = (v.x * 0.5 + 0.5) * w
      n.ay = (-v.y * 0.5 + 0.5) * h
      // la sous-ligne (altitude/barrière) déborde de ~14px sous le cartouche
      const hasSub = n.item.kind !== 'transport' && (n.item.alt != null || n.item.cutoff)
      n.hh = n.item.kind === 'start' ? CART_H + (n.item.pictos?.length ? 14 : 0) : n.item.kind === 'transport' ? CHIP_H : CART_H + (hasSub ? 14 : 0)
      n.fw = n.cart.offsetWidth
      vis.push(n)
    }
    if (!vis.length) return
    // 2. placement SIMPLE (Adrien, remise à plat) : l'étiquette se pose À
    // CÔTÉ de son point — à droite par défaut, sinon à gauche, au-dessus,
    // en dessous, puis en s'étageant verticalement. Première place LIBRE
    // gagnée (pas de chevauchement d'étiquettes ni d'UI). Un point hors
    // écran/hors blocs n'affiche rien (culling plus haut + getItems).
    const avoid = params.gpxLabelAvoid !== false
    const placed = []
    const uiRects = []
    {
      const cref = container.getBoundingClientRect()
      for (const selUI of ['.gpx-profile:not(.hidden)', '.ce-bottombar']) {
        const elUI = document.querySelector(selUI)
        if (!elUI) continue
        const r = elUI.getBoundingClientRect()
        if (!r.width) continue
        uiRects.push({ x0: r.left - cref.left - 6, y0: r.top - cref.top - 6, x1: r.right - cref.left + 6, y1: r.bottom - cref.top + 6 })
      }
    }
    const free = (x, y, ww, hh2) => {
      if (x < 2 || y < 2 || x + ww > w - 2 || y + hh2 > h - 2) return false
      for (const r of uiRects) if (x < r.x1 && r.x0 < x + ww && y < r.y1 && r.y0 < y + hh2) return false
      for (const m of placed) if (x < m.fx + m.fw + 8 && m.fx < x + ww + 8 && y < m.fy + m.hh + 8 && m.fy < y + hh2 + 8) return false
      return true
    }
    // priorité de pose : Départ/Arrivée d'abord (toujours bien placés),
    // puis les points par km croissant, puis les transports
    const prio = (n) => (n.item.kind === 'start' ? -1e6 : n.item.kind === 'transport' ? 1e6 : n.item.km ?? 0)
    vis.sort((n1, n2) => prio(n1) - prio(n2))
    for (const n of vis) {
      const cands = [
        [n.ax + LEAD, n.ay - n.hh / 2, 'right'],
        [n.ax - LEAD - n.fw, n.ay - n.hh / 2, 'left'],
        [n.ax - n.fw / 2, n.ay - LEAD - n.hh, 'top'],
        [n.ax - n.fw / 2, n.ay + LEAD, 'bottom'],
      ]
      for (let k = 1; k <= 6; k++) {
        const dy = k * (n.hh + 12)
        cands.push([n.ax + LEAD, n.ay - n.hh / 2 - dy, 'right'])
        cands.push([n.ax + LEAD, n.ay - n.hh / 2 + dy, 'right'])
        cands.push([n.ax - LEAD - n.fw, n.ay - n.hh / 2 - dy, 'left'])
        cands.push([n.ax - LEAD - n.fw, n.ay - n.hh / 2 + dy, 'left'])
      }
      let ok = false
      if (avoid) {
        for (const [x, y, side] of cands) {
          if (free(x, y, n.fw, n.hh)) { n.fx = x; n.fy = y; n.side = side; ok = true; break }
        }
      } else {
        n.fx = Math.min(Math.max(n.ax + LEAD, 2), w - n.fw - 2)
        n.fy = Math.min(Math.max(n.ay - n.hh / 2, 2), h - n.hh - 2)
        n.side = 'right'
        ok = true
      }
      // aucune place libre autour du point (zone très dense en dézoom) :
      // l'étiquette se MASQUE plutôt que d'en recouvrir une autre — les
      // prioritaires gagnent (Départ, puis km croissants, transports enfin)
      n.declutter = !ok
      if (ok) placed.push(n)
    }

    // 5. application DOM — le cartouche GLISSE vers sa place (lissage
    // exponentiel ≈ ease-in-out, demande Adrien) ; la ligne de rappel vise
    // son bord côté ancre (pointillés neutres, jamais la couleur du tracé)
    for (const n of vis) {
      if (n.declutter) {
        n.cart.classList.add('rl-hidden')
        n.anchor.classList.add('rl-hidden')
        n.leader.classList.add('rl-hidden')
      }
    }
    for (const n of placed) {
      // ANTI mal de cœur (Adrien) : le cartouche est RIGIDE avec la carte —
      // c'est son OFFSET par rapport à l'ancre qui est collant : zone morte
      // de 22 px (il ne bouge pas du tout pour les petits reshuffles), puis
      // glissement TRÈS lent vers le nouvel emplacement. L'ancre, elle, suit
      // la carte sans latence, donc rien ne « flotte ».
      const tox = n.fx - n.ax
      const toy = n.fy - n.ay
      if (n.ox == null || window.__rlSnap) { n.ox = tox; n.oy = toy } // première pose : direct (__rlSnap : tests)
      else {
        const d = Math.hypot(tox - n.ox, toy - n.oy)
        // zone morte 8 px pour DÉCLENCHER un mouvement (SOUS les marges de
        // collision de 12 px : une étiquette figée ne peut jamais en
        // recouvrir une autre) — une fois engagé, il glisse JUSQU'AU BOUT
        if (d > 8) n.moving = true
        if (n.moving) {
          n.ox += (tox - n.ox) * 0.04
          n.oy += (toy - n.oy) * 0.04
          if (d < 1) { n.ox = tox; n.oy = toy; n.moving = false }
        }
      }
      n.sx = n.ax + n.ox
      n.sy = n.ay + n.oy
      n.cart.style.transform = `translate(${Math.round(n.sx)}px, ${Math.round(n.sy)}px)`
      n.anchor.style.transform = `translate(${Math.round(n.ax - 3.5)}px, ${Math.round(n.ay - 3.5)}px)`
      let tx
      let ty
      if (n.side === 'right') { tx = n.sx; ty = n.sy + n.hh / 2 }
      else if (n.side === 'left') { tx = n.sx + n.fw; ty = n.sy + n.hh / 2 }
      else {
        tx = Math.min(Math.max(n.ax, n.sx + 8), n.sx + n.fw - 8)
        ty = n.side === 'top' ? n.sy + n.hh : n.sy
      }
      const ang = Math.atan2(ty - n.ay, tx - n.ax)
      n.leader.style.width = `${Math.round(Math.hypot(tx - n.ax, ty - n.ay))}px`
      n.leader.style.transform = `translate(${Math.round(n.ax)}px, ${Math.round(n.ay)}px) rotate(${ang.toFixed(4)}rad)`
    }
  }

  function dispose() { root.remove(); nodes.clear() }

  return { update, setDirty, dispose, _nodes: nodes } // _nodes : sonde de debug (harmless)
}
