// LECTEUR DU BANC R33 — les sept mesures, en espace globe et en pixels.
//
//   node scripts/lit-sonde-r33.mjs .banc/R33/releve.json
//
// Écrit `.banc/R33/mesures-<etiquette>.json` (lu par test/attaque-r33-ROUGE.mjs)
// et imprime les tableaux. Aucune grandeur n'est en unités de bloc.
import fs from 'node:fs'
import path from 'node:path'
import * as THREE from 'three'

const fichier = process.argv[2] || '.banc/R33/releve.json'
const J = JSON.parse(fs.readFileSync(fichier, 'utf8'))
const MPU = J.MPU, CX = J.W / 2, CY = J.H / 2
const D2R = Math.PI / 180

// ══════════ L'AXE HÉLICOÏDAL ENTRE DEUX IMAGES ══════════════════════════════
// Déplacement rigide (p0,q0) → (p1,q1) : ΔR = q1·q0⁻¹, t = p1 − ΔR·p0. Pour une
// rotation d'angle θ autour d'un axe `a` passant par `c` (c ⊥ a) :
//   t_perp = (I − ΔR)·c   ⇒   c = ½ t_perp + ½ cot(θ/2) (a × t_perp)
// Distance du centre de la Terre (origine) à l'axe = |c|. Pas = t·a.
function axeHelicoidal(f0, f1) {
  const q0 = new THREE.Quaternion(...f0.gq), q1 = new THREE.Quaternion(...f1.gq)
  const dR = q1.clone().multiply(q0.clone().invert())
  let w = Math.max(-1, Math.min(1, dR.w))
  let s = Math.sqrt(Math.max(0, 1 - w * w))
  if (dR.w < 0) { dR.x = -dR.x; dR.y = -dR.y; dR.z = -dR.z; w = -w }
  const theta = 2 * Math.acos(w)
  // ⚠️ sous 1e-4 rad (0,006°) le cot(θ/2) amplifie le bruit de float : on ne
  // classe pas une image immobile
  if (theta < 1e-4) return null
  const a = new THREE.Vector3(dR.x, dR.y, dR.z).divideScalar(s)
  const p0 = new THREE.Vector3(...f0.g), p1 = new THREE.Vector3(...f1.g)
  const t = p1.clone().sub(p0.clone().applyQuaternion(dR))
  const pas = t.dot(a)
  const tp = t.clone().addScaledVector(a, -pas)
  const c = tp.clone().multiplyScalar(0.5).addScaledVector(a.clone().cross(tp), 0.5 / Math.tan(theta / 2))
  return { thetaDeg: theta / D2R, distanceM: c.length() * MPU, pasM: pas * MPU, axe: [a.x, a.y, a.z] }
}
// auto-test de la formule sur un cas synthétique
{
  const c0 = new THREE.Vector3(3, -2, 5), a = new THREE.Vector3(0.2, 0.9, -0.3).normalize(), th = 0.37
  const R = new THREE.Quaternion().setFromAxisAngle(a, th)
  const p0 = new THREE.Vector3(10, 4, -7), q0 = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3, -1.1, 0.5))
  const p1 = c0.clone().add(p0.clone().sub(c0).applyQuaternion(R)), q1 = R.clone().multiply(q0)
  const r = axeHelicoidal({ g: p0.toArray(), gq: q0.toArray() }, { g: p1.toArray(), gq: q1.toArray() })
  const c0perp = c0.clone().addScaledVector(a, -c0.dot(a))
  if (Math.abs(r.distanceM / MPU - c0perp.length()) > 1e-9 || Math.abs(r.thetaDeg - th / D2R) > 1e-9) { console.error('auto-test de l axe hélicoïdal FAUX', r, c0perp.length()); process.exit(3) }
}

const grandCercleDeg = (a, b) => {
  if (!a || !b) return null
  const u = (ll) => new THREE.Vector3(Math.cos(ll[0] * D2R) * Math.sin(ll[1] * D2R), Math.sin(ll[0] * D2R), Math.cos(ll[0] * D2R) * Math.cos(ll[1] * D2R))
  return Math.acos(Math.max(-1, Math.min(1, u(a).dot(u(b))))) / D2R
}
const dpx = (p, q) => (p && q) ? Math.hypot(p[0] - q[0], p[1] - q[1]) : null
const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null }
const max = (a) => { const s = a.filter(Number.isFinite); return s.length ? Math.max(...s) : null }
const f = (x, n = 0) => (x == null || !Number.isFinite(x) ? '—' : Number(x).toLocaleString('fr-FR', { maximumFractionDigits: n }))

// les gestes sont DÉCOUVERTS dans les étiquettes : un glissé a `/pendant`, une
// molette a `/cran1`
const gestesDe = (b, marque) => [...new Set(b.frames.map((x) => x.tag).filter((t) => t.endsWith(`/${marque}`)).map((t) => t.slice(b.nom.length + 1, -(marque.length + 1))))]
const mesures = { fichier, etiquette: J.etiquette, quand: J.quand, voile: J.voile, poseDemarrage: J.poseDemarrage, bancs: [] }

for (const b of J.bancs) {
  const F = b.frames
  const par = (suffixe) => F.filter((x) => x.tag === `${b.nom}/${suffixe}`)
  const B = { nom: b.nom, mode: b.depart.mode, altimetreM: b.depart.altCadrage, altFondM: b.depart.altFond, zoom: b.depart.zoom, cropPose: b.depart.cropPose, horsDuCrop: b.depart.horsDuCrop, glisses: {}, molettes: {} }
  for (const g of gestesDe(b, 'pendant')) {
    const avant = par(`${g}/avant`), pendant = par(`${g}/pendant`), apres = par(`${g}/apres`)
    if (!avant.length || !pendant.length || !apres.length) continue
    const a0 = avant[avant.length - 1], p1 = apres[0], pN = apres[apres.length - 1]
    const axes = []
    const serie = [a0, ...pendant, p1]
    for (let i = 1; i < serie.length; i++) { const r = axeHelicoidal(serie[i - 1], serie[i]); if (r) axes.push(r) }
    const saisie = pendant.filter((x) => x.pSaisi && x.pSaisi[2] === 1).map((x) => dpx(x.pSaisi, x.curseur))
    const saisieDerriere = pendant.filter((x) => x.pSaisi && x.pSaisi[2] !== 1).length
    const terreDeplacement = pendant.concat(apres).map((x) => dpx(x.pTerre, a0.pTerre))
    B.glisses[g] = {
      images: pendant.length, rotationsComptees: axes.length,
      angleTotalDeg: axes.reduce((s, r) => s + r.thetaDeg, 0),
      // ① le pivot, en mètres du centre de la Terre
      cibleM_avant: a0.cibleM, cibleM_apres: pN.cibleM,
      axeDistanceM_mediane: med(axes.map((r) => r.distanceM)), axeDistanceM_max: max(axes.map((r) => r.distanceM)), axeDistanceM_min: axes.length ? Math.min(...axes.map((r) => r.distanceM)) : null,
      axePasM_max: max(axes.map((r) => Math.abs(r.pasM))),
      // ② la signature orbite / lacet
      dSousCamDeg: grandCercleDeg(a0.sousCam, p1.sousCam), dSousCibleDeg: grandCercleDeg(a0.sousCible, p1.sousCible),
      dAzDeg: p1.az - a0.az, dPhiDeg: p1.phi - a0.phi,
      // ③ le centre de la Terre à l'écran
      pTerre_avant: a0.pTerre, pTerre_apres: p1.pTerre, pTerre_deplacementMaxPx: max(terreDeplacement),
      pTerre_ecartCentreEcran_avant: dpx(a0.pTerre, [CX, CY]), pTerre_ecartCentreEcran_apres: dpx(p1.pTerre, [CX, CY]),
      pTerre_devant_apres: p1.pTerre ? p1.pTerre[2] : null,
      // ④ l'angle verticale locale / axe optique
      angleVert_avant: a0.angleVertCam, angleVert_max: max(pendant.concat(apres).map((x) => x.angleVertCam)), angleVert_apres: p1.angleVertCam,
      angleVertCible_max: max(pendant.concat(apres).map((x) => x.angleVertCible)),
      phi_avant: a0.phi, phi_apres: p1.phi,
      // ⑥ le point saisi sous le curseur
      saisiEcartPx_max: max(saisie), saisiEcartPx_final: saisie.length ? saisie[saisie.length - 1] : null, saisiImagesDerriere: saisieDerriere,
      // l'altitude de la caméra qui rend
      altCamM_avant: a0.altCamM, altCamM_apres: p1.altCamM, altCamM_min: Math.min(...pendant.map((x) => x.altCamM)),
      ecartAxeBloc_avant: a0.ecartAxeBloc, ecartAxeBloc_apres: pN.ecartAxeBloc,
      busy: pendant.some((x) => x.busy), fondu: pendant.some((x) => x.fondu),
    }
  }
  for (const g of gestesDe(b, 'cran1')) {
    const avant = par(`${g}/avant`), glisse = par(`${g}/glisse`), apres = par(`${g}/apres`)
    if (!avant.length || !apres.length) continue
    const a0 = avant[avant.length - 1], pN = apres[apres.length - 1]
    const crans = []
    for (let k = 1; k <= 9; k++) {
      const fr = par(`${g}/cran${k}`)
      if (!fr.length) break
      crans.push({ k, ecartPx_max: max(fr.map((x) => dpx(x.pCentreAvant, [CX, CY]))), ecartPx_fin: dpx(fr[fr.length - 1].pCentreAvant, [CX, CY]), derriere: fr.filter((x) => x.pCentreAvant && x.pCentreAvant[2] !== 1).length })
    }
    const tout = F.filter((x) => x.tag.startsWith(`${b.nom}/${g}/`) && x.tag !== `${b.nom}/${g}/avant`)
    B.molettes[g] = {
      crans, glisseImages: glisse.length,
      centreEcartPx_max: max(tout.map((x) => dpx(x.pCentreAvant, [CX, CY]))),
      centreEcartPx_final: dpx(pN.pCentreAvant, [CX, CY]),
      centreDerriere: tout.filter((x) => x.pCentreAvant && x.pCentreAvant[2] !== 1).length,
      altCamM_avant: a0.altCamM, altCamM_apres: pN.altCamM, zoom_avant: a0.zoom, zoom_apres: pN.zoom,
      angleVert_avant: a0.angleVertCam, angleVert_apres: pN.angleVertCam,
      pTerre_deplacementPx: dpx(pN.pTerre, a0.pTerre),
      cibleM_apres: pN.cibleM, ecartAxeBloc_apres: pN.ecartAxeBloc,
      busy: tout.some((x) => x.busy), cropPose_apres: pN.cropPose,
    }
  }
  mesures.bancs.push(B)
}

const sortie = path.join(path.dirname(fichier), `mesures-${J.etiquette}.json`)
fs.writeFileSync(sortie, JSON.stringify(mesures, null, 1))

// ══════════ LES TABLEAUX ═══════════════════════════════════════════════════
console.log(`\n=== R33 / ${J.etiquette} — ${J.quand} · voile ${JSON.stringify(J.voile)} · départ ${JSON.stringify(J.poseDemarrage)}`)
for (const B of mesures.bancs) {
  console.log(`\n──── ${B.nom} · mode ${B.mode} · altimètre ${f(B.altimetreM / 1000, 1)} km · caméra qui rend ${f(B.altFondM / 1000, 1)} km · z${B.zoom} · crop posé ${B.cropPose} · horsDuCrop ${B.horsDuCrop}`)
  console.log('geste | ① cible (m du centre) | ① axe de rotation : distance au centre méd / max (m) | pas (m) | ② Δ sous-caméra / Δ sous-cible (°) | Δaz / Δφ (°) | ③ centre Terre px avant → après (écart au centre écran) | dépl. max px | ④ angle vert. avant / max / après (°) | ⑥ saisi−curseur max / final px')
  for (const [g, m] of Object.entries(B.glisses)) {
    console.log(`${g.padEnd(3)} | ${f(m.cibleM_avant).padStart(10)} | ${f(m.axeDistanceM_mediane).padStart(10)} / ${f(m.axeDistanceM_max).padStart(10)} | ${f(m.axePasM_max, 1)} | ${f(m.dSousCamDeg, 3)} / ${f(m.dSousCibleDeg, 3)} | ${f(m.dAzDeg, 2)} / ${f(m.dPhiDeg, 2)} | (${f(m.pTerre_avant?.[0])},${f(m.pTerre_avant?.[1])}) → (${f(m.pTerre_apres?.[0])},${f(m.pTerre_apres?.[1])})${m.pTerre_devant_apres === 0 ? ' DERRIÈRE' : ''} (${f(m.pTerre_ecartCentreEcran_avant)} → ${f(m.pTerre_ecartCentreEcran_apres)}) | ${f(m.pTerre_deplacementMaxPx, 1)} | ${f(m.angleVert_avant, 2)} / ${f(m.angleVert_max, 2)} / ${f(m.angleVert_apres, 2)} | ${f(m.saisiEcartPx_max, 1)} / ${f(m.saisiEcartPx_final, 1)}${m.saisiImagesDerriere ? ` (${m.saisiImagesDerriere} img derrière)` : ''}${m.busy ? ' BUSY' : ''}${m.fondu ? ' FONDU' : ''}`)
  }
  console.log('molette | ⑦ point du centre : écart au centre écran par cran (max) | max sur tout | final | alt caméra avant → après | z | angle vert. | centre Terre dépl. px')
  for (const [g, m] of Object.entries(B.molettes)) {
    console.log(`${g.padEnd(7)} | ${m.crans.map((c) => f(c.ecartPx_max, 1)).join(' · ').padEnd(20)} | ${f(m.centreEcartPx_max, 1)} | ${f(m.centreEcartPx_final, 1)} | ${f(m.altCamM_avant / 1000, 1)} → ${f(m.altCamM_apres / 1000, 1)} km | z${m.zoom_avant}→z${m.zoom_apres} | ${f(m.angleVert_avant, 1)}→${f(m.angleVert_apres, 1)} | ${f(m.pTerre_deplacementPx, 1)}${m.busy ? ' BUSY' : ''}${m.cropPose_apres ? ' CROP' : ''}`)
  }
}
console.log(`\nécrit : ${sortie}`)
