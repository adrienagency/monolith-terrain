// LE BANC DE LA POURSUITE — les chiffres qu'Adrien a demandés, mesurés sur le
// tracé réel et sur le relief réel.
//
// À utiliser dans la console de l'app, une fois le GPX chargé :
//     const b = await import('/src/poursuite-banc.js')
//     await b.bancPoursuite()
//
// CE QU'IL MESURE, ET COMMENT LE LIRE :
//
//   · `cache`     — la part du temps où le SUJET EST INVISIBLE derrière le
//                   relief. C'est LA mesure de ce mode : une caméra de poursuite
//                   qui perd son sujet a échoué, même si tout le reste est beau.
//                   L'objectif est zéro.
//   · `gardeMin`  — la garde au sol minimale. Le sujet impose la trajectoire, il
//                   ne suspend pas la physique : elle doit rester positive.
//   · `sweep`     — vitesse angulaire de l'axe de visée, en °/s. Seuil de
//                   lisibilité retenu pour le pilote : 75. Ce mode le sollicite
//                   davantage, parce que le sujet, lui, tourne vraiment.
//   · `acc`       — accélération de la caméra, en multiples de celle d'un virage
//                   nominal. C'est la dérivée seconde, celle qui donne la nausée.
//   · `besoin`    — combien d'images ont réclamé une levée d'occlusion. C'est le
//                   compteur de qualité du PLAN CUIT : s'il est haut, c'est la
//                   cuisson qui est fausse, pas le filet qui est mal réglé.
//
// ⚠️ ON MESURE PAR PLAN, ET ON EXCLUT LES RACCORDS. Une COUPE n'est pas un
// à-coup : au raccord entre deux plans, position et cadrage sautent
// volontairement. Mesurées sans cette précaution, les six coupes du clip
// donnaient 3 472 °/s de balayage et 20 296 fois l'accélération nominale — on
// mesurait le montage au lieu du mouvement. Et le détail PAR PLAN est ce qui a
// trouvé les vrais défauts : la moyenne les noyait, alors qu'un plan à 29 % de
// sujet caché saute aux yeux dès qu'on sépare.

import { preparerPoursuite, poursuiteComplete, sujetVisible } from './poursuite.js'

export function mesurerPoursuite(ctx, { dt = 1 / 60 } = {}) {
  const poses = poursuiteComplete(ctx, { dt })
  const sg = ctx.sampleGround
  const peau = ctx.profil.garde * 0.5
  // référence d'accélération : celle d'un virage au rayon nominal
  const ref = (ctx.profil.v * ctx.profil.v) / ctx.profil.rayon
  const par = {}
  let p1 = null
  let p2 = null
  let d1 = null
  let planPrec = null
  const tot = { n: 0, cache: 0, besoin: 0, plancher: 0, gardeMin: Infinity, coupes: 0, leveMax: 0 }

  for (const p of poses) {
    const o = (par[p.plan] = par[p.plan] || { n: 0, cache: 0, besoin: 0, leveMax: 0, accMax: 0, sweepMax: 0, roulisMax: 0 })
    o.n++
    tot.n++
    if (!sujetVisible({ sampleGround: sg, cam: p.pos, sujet: p.sujet, peau })) { o.cache++; tot.cache++ }
    if (p.besoinLeve > 1e-3) { o.besoin++; tot.besoin++ }
    if (p.leve > o.leveMax) o.leveMax = p.leve
    if (p.leve > tot.leveMax) tot.leveMax = p.leve
    if (p.plancher) tot.plancher++
    if (Math.abs(p.roulis) > o.roulisMax) o.roulisMax = Math.abs(p.roulis)
    const sol = sg(p.pos.x, p.pos.z)
    const g = p.pos.y - (Number.isFinite(sol) ? sol : 0)
    if (g < tot.gardeMin) tot.gardeMin = g

    if (planPrec !== null && planPrec !== p.plan) { tot.coupes++; p1 = null; p2 = null; d1 = null }
    planPrec = p.plan
    const d = { x: p.target.x - p.pos.x, y: p.target.y - p.pos.y, z: p.target.z - p.pos.z }
    const l = Math.hypot(d.x, d.y, d.z) || 1
    const dir = { x: d.x / l, y: d.y / l, z: d.z / l }
    if (d1) {
      const dot = Math.min(1, dir.x * d1.x + dir.y * d1.y + dir.z * d1.z)
      const s = (Math.acos(dot) * 180) / Math.PI / dt
      if (s > o.sweepMax) o.sweepMax = s
    }
    d1 = dir
    if (p2) {
      const a = Math.hypot(p.pos.x - 2 * p1.x + p2.x, p.pos.y - 2 * p1.y + p2.y, p.pos.z - 2 * p1.z + p2.z) / (dt * dt) / ref
      if (a > o.accMax) o.accMax = a
    }
    p2 = p1
    p1 = { ...p.pos }
  }

  const vit = poses.map((p) => p.vitesseKmh)
  return {
    resume: {
      images: tot.n,
      cache: tot.cache,
      pctCache: +((100 * tot.cache) / tot.n).toFixed(2),
      gardeMin: +tot.gardeMin.toFixed(3),
      plancher: tot.plancher,
      besoinLeve: tot.besoin,
      leveMax: +tot.leveMax.toFixed(3),
      coupes: tot.coupes,
      duree: +ctx.duree.toFixed(1),
      acceleration: +ctx.prof.acceleration.toFixed(0),
      dureeReelleH: +(ctx.prof.dureeReelle / 3600).toFixed(2),
      troncon: ctx.troncon,
      hauteurM: ctx.hauteurM,
      vKmhMin: +Math.min(...vit).toFixed(1),
      vKmhMax: +Math.max(...vit).toFixed(1),
      ligne: { fenetre: ctx.ligneInfo.fenetre, arret: ctx.ligneInfo.arret, ecart: +ctx.ligneInfo.ecart.toFixed(2) },
    },
    parPlan: Object.fromEntries(Object.entries(par).map(([k, o]) => [k, {
      n: o.n,
      cache: o.cache,
      pct: +((100 * o.cache) / o.n).toFixed(1),
      besoin: o.besoin,
      leveMax: +o.leveMax.toFixed(2),
      acc: +o.accMax.toFixed(0),
      sweep: +o.sweepMax.toFixed(0),
      roulisDeg: +((o.roulisMax * 180) / Math.PI).toFixed(1),
    }])),
  }
}

// Raccourci console : lit la course chargée dans l'app et mesure.
export async function bancPoursuite(opts = {}) {
  const e = globalThis.window?.__exp
  if (!e) throw new Error('window.__exp indisponible')
  const t = e.gpxLayer?.track?.world
  if (!t || t.length < 8) throw new Error('aucune course chargée')
  const ctx = preparerPoursuite({
    trace: t.map((p) => ({ x: p.x, y: p.y, z: p.z })),
    sampleGround: (x, z) => { const v = e.terrain.sample?.(x, z); return Number.isFinite(v) ? v : 0 },
    half: 28,
    metresParUnite: e.dem ? e.dem.extentMeters / 56 : 1,
    exagerationV: e.params.demExaggeration || 1,
    ...opts,
  })
  if (!ctx) return { erreur: 'contexte impossible' }
  return { ctx, ...mesurerPoursuite(ctx) }
}
