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

export function buildRaceLabels({ container, camera, getItems, params, onRemove }) {
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
    cart.className = isChip ? 'rl-chip' : 'rl-cart'
    if (isChip) {
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
      else if (JSON.stringify({ ...n.item, world: 0 }) !== JSON.stringify({ ...it, world: 0 })) {
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
    if (dirty) sync()
    if (!nodes.size) return
    const w = container.clientWidth
    const h = container.clientHeight
    // 1. projeter chaque ancre
    const sides = { left: [], right: [] } // cartouche placé à droite/gauche de l'ancre
    for (const n of nodes.values()) {
      v.copy(n.item.world).project(camera)
      const off = v.z > 1 || v.x < -1.15 || v.x > 1.15 || v.y < -1.15 || v.y > 1.15
      n.off = off
      if (off) { n.cart.classList.add('rl-hidden'); n.anchor.classList.add('rl-hidden'); n.leader.classList.add('rl-hidden'); continue }
      n.cart.classList.remove('rl-hidden'); n.anchor.classList.remove('rl-hidden'); n.leader.classList.remove('rl-hidden')
      n.ax = (v.x * 0.5 + 0.5) * w
      n.ay = (-v.y * 0.5 + 0.5) * h
      n.hh = n.item.kind === 'transport' ? CHIP_H : CART_H
      ;(n.ax < w * 0.5 ? sides.right : sides.left).push(n)
    }
    // 2. anti-chevauchement par côté (débrayable — params.gpxLabelAvoid)
    for (const key of ['right', 'left']) {
      const group = sides[key]
      if (!group.length) continue
      const ys = layoutCartouches(
        group.map((n) => ({ y: n.ay - n.hh / 2, h: n.hh })),
        { avoid: params.gpxLabelAvoid !== false, gap: 8, minY: 4, maxY: h - 4 }
      )
      group.forEach((n, i) => {
        const y = ys[i]
        const x = key === 'right' ? n.ax + LEAD : n.ax - LEAD - n.cart.offsetWidth
        n.cart.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`
        n.anchor.style.transform = `translate(${Math.round(n.ax - 3.5)}px, ${Math.round(n.ay - 3.5)}px)`
        // ligne de rappel : de l'ancre au bord du cartouche côté ancre
        const tx = key === 'right' ? n.ax + LEAD : n.ax - LEAD
        const ty = y + n.hh / 2
        const ang = Math.atan2(ty - n.ay, tx - n.ax)
        n.leader.style.width = `${Math.round(Math.hypot(tx - n.ax, ty - n.ay))}px`
        n.leader.style.transform = `translate(${Math.round(n.ax)}px, ${Math.round(n.ay)}px) rotate(${ang.toFixed(4)}rad)`
      })
    }
  }

  function dispose() { root.remove(); nodes.clear() }

  return { update, setDirty, dispose }
}
