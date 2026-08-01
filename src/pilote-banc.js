// LE BANC DU PILOTE — la preuve de non-collision, mesurée SUR DU RELIEF RÉEL.
//
// ⚠️ POURQUOI CE FICHIER EXISTE. « Un banc synthétique ment » est la leçon la
// plus chère de ce dépôt : les normales par différences centrées donnaient
// 0,008° d'écart sur relief synthétique et 118,9° sur du MNT réel. Le pilote a
// reproduit la leçon à l'identique — sur les reliefs d'essai de
// test/pilote.test.js, y compris bruités, le plancher de dernier recours ne
// s'engageait JAMAIS ; sur 240 vols de MNT réel à Chamonix, il s'engageait
// 1 463 fois. Trois défauts se cachaient là et nulle part ailleurs (veille
// sous-échantillonnée, pas de ressource d'urgence, descente aussi rapide que la
// montée). Aucun n'aurait été trouvé par node.
//
// COMMENT S'EN SERVIR (le dépôt n'a pas de moteur 3D hors navigateur) :
//
//   1. `npm run dev`, ouvrir l'app, laisser le bloc se charger
//   2. dans la console :
//        const b = await import('/src/pilote-banc.js')
//        await b.bancZone('Chamonix', 45.92, 6.87)   // ou La Réunion, Annecy…
//
// Ce que rend le banc, et comment le lire :
//   · `gardeMin`      — LA garantie. Doit rester > 0 sur tous les pas de tous
//                       les vols. C'est la non-collision, prouvée, pas ressentie.
//   · `plancher`      — combien de fois le garde-fou de dernier recours a dû
//                       rattraper la dynamique. Chaque engagement est un plan
//                       mal jugé ; c'est le compteur qu'on cherche à annuler.
//   · `accMax`        — accélération maximale, EN MULTIPLES de l'accélération
//                       d'un virage nominal. Au-delà de ~4, c'est un à-coup.
//   · `sweepMax`      — balayage de l'axe de visée en °/s. Au-delà de ~75, le
//                       plan devient illisible.
//   · `refus`         — pourquoi des couloirs ont été écartés avant engagement.
//                       Un banc sans aucun refus est suspect : ça voudrait dire
//                       que la vérification ne sert à rien.
//
// ⚠️ COMMENT ON OBTIENT DES CENTAINES DE RELIEFS RÉELS AVEC UN SEUL JEU DE
// TUILES. On ne change pas de zone à chaque vol (chaque changement coûte un
// chargement réseau) : on fait TOURNER et GLISSER l'échantillonneur sous le
// bloc. Chaque angle découpe le même MNT autrement — d'autres vallées, d'autres
// crêtes, d'autres sorties sur le bord. Le relief reste réel de bout en bout,
// avec tout son grain ; seule la fenêtre change. 24 angles × 5 décalages ×
// 2 profils = 240 vols par zone, en ~25 s.

import { planifierVol, creerVol, stepPilote, poseDe } from './pilote.js'

// Un vol complet, instrumenté. Rend les mesures, pas les poses.
export function bancVol({ sampleGround, half, profil, duree = 40, dt = 1 / 60 }) {
  const plan = planifierVol({ sampleGround, half, profil })
  if (!plan) return { plan: null }
  plan.sampleGround = sampleGround
  const ref = (plan.profil.v * plan.profil.v) / plan.profil.rayon // accélération d'un virage nominal
  let etat = creerVol(plan)
  let prev = null
  let prev2 = null
  let dirPrev = null
  const m = { pas: 0, gardeMin: Infinity, roulisMax: 0, accMax: 0, sweepMax: 0, sortiesBloc: 0 }
  for (let i = 0; i < Math.round(duree / dt); i++) {
    etat = stepPilote(etat, dt, plan, { sampleGround })
    if (etat.phase === 'fini') break
    const po = poseDe(etat, plan, { sampleGround })
    m.pas++
    const sol = sampleGround(po.pos.x, po.pos.z)
    const g = po.pos.y - (Number.isFinite(sol) ? sol : 0)
    if (g < m.gardeMin) m.gardeMin = g
    if (Math.abs(po.roulis) > m.roulisMax) m.roulisMax = Math.abs(po.roulis)
    if (Math.abs(po.pos.x) > half || Math.abs(po.pos.z) > half) m.sortiesBloc++
    if (prev2) {
      const a = Math.hypot(
        po.pos.x - 2 * prev.x + prev2.x,
        po.pos.y - 2 * prev.y + prev2.y,
        po.pos.z - 2 * prev.z + prev2.z,
      ) / (dt * dt) / ref
      if (a > m.accMax) m.accMax = a
    }
    // Le balayage se mesure en ANGLE : un même déplacement de cible est anodin
    // à 200 unités et violent à 5.
    const d = { x: po.target.x - po.pos.x, y: po.target.y - po.pos.y, z: po.target.z - po.pos.z }
    const l = Math.hypot(d.x, d.y, d.z) || 1
    const dir = { x: d.x / l, y: d.y / l, z: d.z / l }
    if (dirPrev) {
      const dot = Math.min(1, dir.x * dirPrev.x + dir.y * dirPrev.y + dir.z * dirPrev.z)
      const deg = (Math.acos(dot) * 180) / Math.PI / dt
      if (deg > m.sweepMax) m.sweepMax = deg
    }
    dirPrev = dir
    prev2 = prev
    prev = { ...po.pos }
  }
  return { plan, etat, ...m }
}

// L'échantillonneur tourné/glissé : c'est lui qui donne des centaines de
// reliefs RÉELS différents à partir d'un seul jeu de tuiles.
export function fenetre(sampleGround, theta, ox = 0, oz = 0) {
  const c = Math.cos(theta)
  const s = Math.sin(theta)
  return (x, z) => {
    const v = sampleGround(c * x - s * z + ox, s * x + c * z + oz)
    return Number.isFinite(v) ? v : 0
  }
}

const DECALAGES = [[0, 0], [6, -5], [-7, 4], [3, 8], [-4, -9]]

// Le banc d'une zone. `charger` est optionnel : s'il est fourni, il est attendu
// AVANT de mesurer (chargement des tuiles).
export async function bancZone(nom, { sampleGround, half, charger = null, angles = 24, profils = ['avion', 'helico'] } = {}) {
  if (charger) await charger()
  const t0 = (globalThis.performance || Date).now()
  const r = {
    zone: nom, vols: 0, sansPlan: 0, refus: {},
    gardeMin: Infinity, plancher: 0, plancherMax: 0, pas: 0,
    roulisMax: 0, accMax: 0, sweepMax: 0, sortiesBloc: 0, hauteurMoy: 0,
  }
  for (let a = 0; a < angles; a++) {
    for (const [ox, oz] of DECALAGES) {
      for (const profil of profils) {
        const sg = fenetre(sampleGround, (a * 2 * Math.PI) / angles, ox, oz)
        const v = bancVol({ sampleGround: sg, half, profil })
        if (!v.plan) { r.sansPlan++; continue }
        r.vols++
        r.pas += v.pas
        r.plancher += v.etat.plancher
        if ((v.etat.plancherMax || 0) > r.plancherMax) r.plancherMax = v.etat.plancherMax
        r.hauteurMoy += v.plan.hauteurMax
        r.sortiesBloc += v.sortiesBloc
        if (v.gardeMin < r.gardeMin) r.gardeMin = v.gardeMin
        if (v.roulisMax > r.roulisMax) r.roulisMax = v.roulisMax
        if (v.accMax > r.accMax) r.accMax = v.accMax
        if (v.sweepMax > r.sweepMax) r.sweepMax = v.sweepMax
        for (const x of v.plan.refus || []) r.refus[x.raison] = (r.refus[x.raison] || 0) + 1
      }
    }
  }
  r.ms = Math.round((globalThis.performance || Date).now() - t0)
  r.gardeMin = +r.gardeMin.toFixed(4)
  r.roulisMaxDeg = +((r.roulisMax * 180) / Math.PI).toFixed(1)
  r.accMax = +r.accMax.toFixed(2)
  r.sweepMax = +r.sweepMax.toFixed(0)
  r.plancherMax = +r.plancherMax.toFixed(3)
  r.plancherPct = +((100 * r.plancher) / Math.max(1, r.pas)).toFixed(3)
  r.hauteurMoy = +(r.hauteurMoy / Math.max(1, r.vols)).toFixed(2)
  delete r.roulisMax
  return r
}

// ============================================================ les captures
//
// « Le juge est l'œil, pas le test. » Un vol peut être irréprochable en chiffres
// et laid à l'image — c'est arrivé deux fois pendant ce chantier (la caméra
// volait à 5 unités du fond en ne cadrant que de la pente ; puis elle suivait un
// couloir de bord de bloc qui cadrait le socle). On tire donc des images.
//
// ⚠️ POURQUOI CE N'EST PAS UN SIMPLE `screenshot`. Onglet caché, la boucle rAF
// de l'app est gelée : rien ne se compose, la capture expire. On avance donc le
// temps À LA MAIN — on pose la caméra, on appelle `composer.render`, on lit le
// canvas — et on POSTE le PNG binaire vers un petit serveur local. Le relais du
// base64 par le chat corrompt les images ; c'est une leçon des tournages
// précédents (skill shibumap-shots), pas une préférence.

// Rotation de Rodrigues — c'est ce qui incline `up` autour de l'axe de visée et
// fait basculer l'horizon dans le cadre. Écrit à la main pour que ce fichier
// n'importe pas three.js.
export function rotAutour(v, k, a) {
  const c = Math.cos(a)
  const s = Math.sin(a)
  const dot = k.x * v.x + k.y * v.y + k.z * v.z
  return {
    x: v.x * c + (k.y * v.z - k.z * v.y) * s + k.x * dot * (1 - c),
    y: v.y * c + (k.z * v.x - k.x * v.z) * s + k.y * dot * (1 - c),
    z: v.z * c + (k.x * v.y - k.y * v.x) * s + k.z * dot * (1 - c),
  }
}

// Déroule un vol dans l'app et tire une image aux numéros demandés.
// `poste(nom, blob)` reçoit chaque PNG ; par défaut on POSTe sur localhost:5388.
export async function apercuVol({ profil = 'avion', prefixe = 'vol', images = [40, 240, 480, 720, 960, 1200], poste = null } = {}) {
  const e = globalThis.window?.__exp
  if (!e) throw new Error('window.__exp indisponible')
  const envoi = poste || (async (nom, blob) => { await fetch('http://localhost:5388/' + nom, { method: 'POST', body: blob }) })
  const sg = (x, z) => e.terrain.sample?.(x, z) ?? 0
  const plan = planifierVol({ sampleGround: sg, half: 28, profil })
  if (!plan) return { plan: null, raison: 'aucun couloir engageable sur ce bloc' }
  plan.sampleGround = sg
  let etat = creerVol(plan)
  const voulues = new Set(images)
  const max = Math.max(...images)
  const out = []
  for (let i = 1; i <= max; i++) {
    etat = stepPilote(etat, 1 / 60, plan, { sampleGround: sg })
    if (etat.phase === 'fini') break
    if (!voulues.has(i)) continue
    const po = poseDe(etat, plan, { sampleGround: sg })
    const d = { x: po.target.x - po.pos.x, y: po.target.y - po.pos.y, z: po.target.z - po.pos.z }
    const l = Math.hypot(d.x, d.y, d.z) || 1
    const axe = { x: d.x / l, y: d.y / l, z: d.z / l }
    const up = rotAutour({ x: 0, y: 1, z: 0 }, axe, -po.roulis)
    e.camera.position.set(po.pos.x, po.pos.y, po.pos.z)
    e.camera.up.set(up.x, up.y, up.z)
    e.camera.lookAt(po.target.x, po.target.y, po.target.z)
    e.controls.target.set(po.target.x, po.target.y, po.target.z)
    e.clouds?.update?.(1 / 60, e.params, e.camera)
    e.camera.updateMatrixWorld()
    e.composer.render(0.016)
    const blob = await new Promise((r) => e.renderer.domElement.toBlob(r, 'image/png'))
    const nom = `${prefixe}-${String(i).padStart(4, '0')}.png`
    await envoi(nom, blob)
    out.push(`${nom} roulis=${((po.roulis * 180) / Math.PI).toFixed(1)}° garde=${(po.pos.y - sg(po.pos.x, po.pos.z)).toFixed(2)} tangage=${((Math.atan2(d.y, Math.hypot(d.x, d.z)) * 180) / Math.PI).toFixed(1)}°`)
  }
  return {
    plan: {
      encaissement: +plan.encaissementMoyen.toFixed(2),
      interiorite: +(plan.interiorite ?? 0).toFixed(2),
      largeurMin: +plan.largeurMin.toFixed(2),
      hauteurMax: +plan.hauteurMax.toFixed(2),
      debouche: plan.debouche,
    },
    images: out,
  }
}

// Raccourci console : `bancShibu('Chamonix', 45.92, 6.87)` charge la zone dans
// l'app puis mesure. Il lit `window.__exp`, donc il ne sert QUE dans l'app.
export async function bancShibu(nom, lat, lon, zoom = 12, opts = {}) {
  const e = globalThis.window?.__exp
  if (!e) throw new Error('window.__exp indisponible — ce raccourci ne sert que dans l app')
  return bancZone(`${nom} ${lat}/${lon} z${zoom}`, {
    sampleGround: (x, z) => e.terrain.sample?.(x, z) ?? 0,
    half: 28,
    charger: async () => {
      e.params.demLat = lat
      e.params.demLon = lon
      e.params.demZoom = zoom
      await e.loadRealTerrain()
    },
    ...opts,
  })
}
