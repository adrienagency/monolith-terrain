// Barre « liquide » réutilisable (réf. capture Enroll validée Adrien) : les
// boutons d'un même groupe partagent une silhouette de bulles qui FUSIONNENT
// par des tailles concaves (filtre SVG « goo » : flou + seuil d'alpha), et
// l'état actif est une bulle sombre qui coule d'un bouton à l'autre (les
// transitions left/width des bulles passent PAR le filtre → morph fluide).
// Les boutons restent au-dessus du calque, nets — seul le fond est liquide.
//
// Usage : liquidize(cluster, { items: () => [...boutons] }) — cluster en
// position:relative, boutons SANS fond propre (la bulle est leur fond).
// L'état se lit sur les classes du bouton : .on → bulle encre, .accent →
// bulle accent. Pensé pour être réutilisé ailleurs (demande Adrien).
import { el } from './kit.js'

let gooDefs = null
function ensureGoo() {
  if (gooDefs) return
  // ⚠️ le @property de v28.css ne prend pas toujours (tooling/HMR) — sans
  // enregistrement typé, --lq-angle s'anime en DISCRET (saut 0→360 à 50 %)
  // et le liseré semble immobile. L'enregistrement JS garantit l'interpolation.
  try { CSS.registerProperty?.({ name: '--lq-angle', syntax: '<angle>', inherits: true, initialValue: '0deg' }) } catch {}
  gooDefs = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  gooDefs.setAttribute('class', 'lq-defs')
  gooDefs.setAttribute('aria-hidden', 'true')
  // Flou 8 + seuil alpha 20a-9 (bord à 0.45) sur des bulles OPAQUES (la
  // translucidité vit sur le calque, après le filtre) : à 4px d'écart,
  // l'alpha au milieu ≈ 0.8 → pincement large, la proportion de la réf
  // Enroll. Région élargie : le débord par défaut (10 %) rognait le flou.
  gooDefs.innerHTML =
    '<defs><filter id="ce-goo" x="-30%" y="-60%" width="160%" height="220%">' +
    '<feGaussianBlur in="SourceGraphic" stdDeviation="8" result="b"/>' +
    '<feColorMatrix in="b" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9" result="g"/>' +
    '<feComposite in="SourceGraphic" in2="g" operator="atop"/></filter></defs>'
  document.body.append(gooDefs)
}

// MARGE du calque goo : il déborde du cluster pour que le flou du filtre ne
// se fasse pas rogner au bord — les bulles compensent via translate (CSS).
export const LQ_PAD = 12

// bumpFor() (optionnel) : renvoie le bouton ACTIF — une petite bulle ronde
// vient chevaucher le bord haut de la capsule à son aplomb et le déforme en
// bosse (tension de liquide, réf. vidéo Adrien / Liquid Glass Apple) ; la
// transition CSS de la bulle fait VOYAGER la bosse d'un bouton à l'autre.
// rim: true (optionnel) — LISERÉ MÉTAL LIQUIDE sur le pourtour (recette du
// bouton adrienagency.com) : un second calque goo derrière, bulles gonflées
// de +1.6px, peintes d'un conic-gradient qui TOURNE autour du centre de la
// barre (teintes --lq-m1/--lq-m2 dérivées de la palette de la carte). Pas de
// sheen par-dessus les boutons — juste la rotation sur le pourtour (Adrien).
const RIM = 1.6
export function liquidize(cluster, { items, inflate = 4, bumpFor, rim = false } = {}) {
  ensureGoo()
  const goo = el('div', 'lq-goo')
  cluster.prepend(goo)
  // le liseré s'insère AVANT le goo dans le DOM → il peint derrière, seul
  // son débord de +1.6px reste visible sur le pourtour
  const rimLayer = rim ? el('div', 'lq-goo lq-rim') : null
  if (rimLayer) cluster.prepend(rimLayer)
  const rims = new Map()
  const rimFor = (key) => {
    let b = rims.get(key)
    if (!b) { b = el('i', 'lq-blob lq-rimblob'); rimLayer.append(b); rims.set(key, b) }
    return b
  }
  const blobs = new Map() // bouton → bulle
  let raf = 0
  const place = (blob, x, y, w, h) => {
    blob.style.left = x + 'px'
    blob.style.top = y + 'px'
    blob.style.width = w + 'px'
    blob.style.height = h + 'px'
  }
  // pose la bulle-liseré jumelle (+RIM px) et cale le CENTRE de son conic sur
  // le centre de la RANGÉE — toutes les bulles partagent ainsi une seule
  // rotation cohérente autour de la barre
  const placeRim = (key, x, y, w, h, base) => {
    if (!rimLayer) return
    const b = rimFor(key)
    place(b, x - RIM, y - RIM, w + RIM * 2, h + RIM * 2)
    b.style.setProperty('--lq-cx', (base.width / 2 - (x - RIM)).toFixed(1) + 'px')
    b.style.setProperty('--lq-cy', (base.height / 2 - (y - RIM)).toFixed(1) + 'px')
  }
  const blobFor = (key) => {
    let b = blobs.get(key)
    if (!b) { b = el('i', 'lq-blob'); goo.append(b); blobs.set(key, b) }
    return b
  }
  // ⚠️ UN CLUSTER PEUT MOURIR, ET IL FAUT ALORS TOUT REPRENDRE (voir `detruire`
  // en bas de fonction) : tant que la barre du bas était le seul appelant, le
  // cluster était PERMANENT et la question ne se posait pas. L'écran de
  // connexion, lui, naît et meurt à chaque ouverture.
  let mort = false
  const sync = () => {
    raf = 0
    if (mort) return
    const base = cluster.getBoundingClientRect()
    if (!base.width) return // cluster masqué (display:none) — rien à dessiner
    // un item peut être { key, el } : la bulle est alors keyée sur `key`, pas
    // sur l'élément — quand `el` CHANGE (switch simple ⇄ avancé), la MÊME
    // bulle transitionne vers la nouvelle géométrie : le fond se MORPHE
    // un item peut aussi être { key, box: {x,y,w,h} } : une bulle PUREMENT
    // ANALYTIQUE, sans élément à mesurer. C'est ce qui porte le pont liquide
    // et le cartouche du bas : leur géométrie est CALCULÉE (à partir de ce
    // qui ne bouge pas), donc la bulle reçoit sa cible d'un coup et sa propre
    // transition CSS fait le voyage — au lieu de courir après un rect en
    // cours d'animation, avec un tour de retard.
    const raw = items ? items() : [...cluster.children]
    const live = raw
      .map((n) => (n && (n.el !== undefined || n.box !== undefined) ? n : { key: n, el: n }))
      .filter((n) => (n.box ? n.box.w > 0 : n.el && n.el !== goo && n.el.offsetParent !== null))
    const seen = new Set()
    if (!live.length) {
      // mode focus (grande tirette) : les boutons sont cachés, une seule
      // bulle couvre tout le cluster pour lui garder un fond
      const b = blobFor(cluster)
      seen.add(cluster)
      place(b, 0, 0, base.width, base.height)
      placeRim(cluster, 0, 0, base.width, base.height, base)
      b.classList.remove('dark', 'accent')
    }
    for (const it of live) {
      const b = blobFor(it.key)
      seen.add(it.key)
      let x
      let y
      let w
      let h
      if (it.box) {
        x = it.box.x
        y = it.box.y
        w = it.box.w
        h = it.box.h
      } else {
        const r = it.el.getBoundingClientRect()
        x = r.left - base.left - inflate
        y = r.top - base.top - inflate
        w = r.width + inflate * 2
        h = r.height + inflate * 2
      }
      place(b, x, y, w, h)
      placeRim(it.key, x, y, w, h, base)
      // sombre/accent en OPT-IN (lq-dark / lq-accent) — rectif Adrien : la
      // bulle Avancé reste blanche, l'état actif parle par le mot/l'icône
      b.classList.toggle('dark', !!(it.el?.classList.contains('lq-dark')))
      b.classList.toggle('accent', !!(it.el?.classList.contains('lq-accent')))
    }
    // la bosse du bouton actif — un rond qui dépasse du bord haut et que le
    // goo fond dans la capsule
    const target = bumpFor?.()
    if (target && target.offsetParent !== null) {
      const b = blobFor('__bump')
      seen.add('__bump')
      const r = target.getBoundingClientRect()
      // PLAFOND 46 : la coche est une petite bosse de tension, pas une bulle
      // proportionnelle. Sans lui, une porte de l'accueil (≈110px de haut, mise
      // en colonne) donnerait un rond de 79px qui crèverait le haut de la
      // capsule. 46 laisse les deux hauteurs de barre intactes (30 / 44 tactile).
      const d = Math.round(Math.min(r.height, 46) * 0.72)
      const bx = r.left - base.left + (r.width - d) / 2
      const by = -d * 0.36
      place(b, bx, by, d, d)
      placeRim('__bump', bx, by, d, d, base)
      b.classList.remove('dark', 'accent')
    }
    for (const [k, b] of blobs) if (!seen.has(k)) { b.remove(); blobs.delete(k) }
    for (const [k, b] of rims) if (!seen.has(k)) { b.remove(); rims.delete(k) }
  }
  // rAF est SUSPENDU onglet caché (piège connu du projet) — fallback timeout
  // pour que les bulles suivent aussi quand la page tourne en arrière-plan
  const ask = () => {
    if (raf || mort) return
    raf = 1
    if (document.hidden) setTimeout(() => { raf = 0; sync() }, 16)
    else requestAnimationFrame(() => { raf = 0; sync() })
  }
  // ⚠️ sync écrit les styles des bulles → ignorer les mutations des calques
  // goo/liseré eux-mêmes, sinon boucle rAF infinie observer→sync→observer
  const mutations = new MutationObserver((recs) => {
    if (recs.some((r) => !goo.contains(r.target) && !(rimLayer && rimLayer.contains(r.target)))) ask()
  })
  mutations.observe(cluster, { attributes: true, childList: true, subtree: true })
  const tailles = new ResizeObserver(ask)
  tailles.observe(cluster)
  window.addEventListener('resize', ask)
  document.fonts?.ready?.then(ask)
  // filet : un déplacement piloté par la FEUILLE DE STYLE seule (HMR CSS,
  // media query, thème) ne mute ni le DOM ni la taille du cluster — aucun
  // observer ne le voit. Un poll doux rattrape ces dérives (2-5 bulles, coût
  // négligeable ; les écritures identiques sont filtrées côté observer).
  const sondage = setInterval(ask, 600)
  ask()

  // ⚠️ LE DÉMONTAGE — RETIRER LE CLUSTER DU DOM NE SUFFIT PAS, ET C'EST MESURÉ.
  // Le minuteur ci-dessus, les deux observateurs et l'écouteur `resize` vivent
  // sur `window`, pas sur le cluster : ils lui survivent. Six ouvertures de
  // l'écran de connexion laissaient six `setInterval` et six écouteurs derrière
  // elles, zéro `clearInterval` — chacun sondant toutes les 600 ms un cluster
  // détaché, et retenant tout son sous-arbre en mémoire. Invisible en
  // démonstration, cumulatif sur une longue session.
  // ⚠️ C'EST UN AJOUT, PAS UN CHANGEMENT DE CONTRAT : la barre du bas est
  // permanente et n'appelle rien de tout ça — elle continue de n'utiliser que
  // `refresh` et `sync`, exactement comme avant.
  const detruire = () => {
    if (mort) return
    mort = true
    clearInterval(sondage)
    mutations.disconnect()
    tailles.disconnect()
    window.removeEventListener('resize', ask)
  }
  // `sync` est le sync IMMÉDIAT (pas de rAF intercalé) : pendant un voyage
  // piloté frame par frame (barre d'accueil ⇄ barre du bas), passer par ask()
  // ajouterait une frame de retard entre le contenu et son fond.
  return { refresh: ask, sync, detruire }
}
