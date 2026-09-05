// CA1 — le bilan d'un banc à N chargements : l'ordre des événements, image par
// image, et les chiffres du barème. Sort aussi les images du screencast qui
// correspondent aux instants de la vidéo d'Adrien (r_014 / r_020 / r_025).
//
//   node scripts/bilan-ca1.mjs .banc/CA1/dezoom8.json [--cast]
import fs from 'node:fs'
import path from 'node:path'
const [,, fichier] = process.argv
const CAST = process.argv.includes('--cast')
const R = JSON.parse(fs.readFileSync(fichier, 'utf8'))
const ms = (x) => (x == null ? '—' : `${Math.round(x)} ms`)
const lignes = []
const L = (s) => { lignes.push(s); console.log(s) }
L(`# ${path.basename(fichier)} — ${R.passes.length} chargements · rafale ${R.rafale} crans / ${R.espace} ms · pixels ${R.pixels} · cpu ×${R.cpu}`)
const tableau = []
for (const [k, P] of R.passes.entries()) {
  if (P.erreur) { L(`passe ${k + 1} : ⛔ ${P.erreur}`); continue }
  const imgs = P.courbe.filter((r) => r.frame != null)
  const marques = P.courbe.filter((r) => r.marque)
  const m1 = marques.find((r) => r.marque === 'cran-dezoom-1')
  // le geste qui a produit les paliers : la dernière marque de dézoom avant le premier palier
  const paliers = []
  for (let i = 1; i < imgs.length; i++) if (imgs[i].cropDemi !== imgs[i - 1].cropDemi) paliers.push({ i, r: imgs[i], avant: imgs[i - 1] })
  const p12 = paliers.find((p) => p.r.demZoom === 12 && p.r.cropDemi > p.avant.cropDemi)
  const p11 = paliers.find((p) => p.r.demZoom === 11 && p.r.cropDemi > p.avant.cropDemi)
  const geste = [...marques].reverse().find((r) => r.marque.startsWith('cran-dezoom') && p12 && r.t <= p12.r.t) || m1
  const t0 = geste?.t ?? P.tDebut
  const rel = (r) => r.t - t0
  const premierHors = imgs.find((r) => r.t >= t0 && (r.horsPx ?? 0) > 0)
  const premierDessHors = imgs.find((r) => r.t >= t0 && r.dessineesHors > 0)
  const premierEst = imgs.find((r) => r.t >= t0 && r.uEstompage < 0.999)
  const premierPermis = imgs.find((r) => r.t >= t0 && r.dehorsPermis)
  const premierSeul0 = imgs.find((r) => r.t >= t0 && !r.cropSeul)
  const annonce12 = imgs.find((r) => r.t >= t0 && /Z12/.test(r.annonce) && r.busy)
  const annonce11 = imgs.find((r) => r.t >= t0 && /Z11/.test(r.annonce) && r.busy)
  const apres11 = p11 ? imgs.filter((r) => r.t >= p11.r.t) : []
  const finProv = apres11.find((r) => !r.provisoire)
  const finRefusMer = apres11.find((r) => !/mer/.test(r.refus))
  const finRefus = apres11.find((r) => !r.refus)
  const finHors = (() => { let last = null; for (const r of imgs) if (r.t >= t0 && (r.horsPx ?? 0) > 0) last = r; return last })()
  const reposSeul = apres11.find((r) => r.cropSeul && r.uEstompage >= 0.999)
  const net = apres11.find((r) => r.file === 0 && r.vol === 0 && !r.refus && !r.busy && r.parois && !r.provisoire && r.cropSeul)
  const horsMax = Math.max(0, ...imgs.map((r) => r.horsPx ?? 0))
  const horsImgs = imgs.filter((r) => (r.horsPx ?? 0) > 0).length
  const dessHorsImgs = imgs.filter((r) => r.dessineesHors > 0).length
  const mixte = imgs.filter((r) => r.pose && r.uEstompage < 0.999 && (!r.parois || r.provisoire || r.paroisDemi !== r.cropDemi || /mer|parois|fond/.test(r.refus))).length
  const mixteProv = imgs.filter((r) => r.pose && r.uEstompage < 0.999 && r.provisoire).length
  const provImgs = imgs.filter((r) => r.provisoire).length
  const zMinApres11 = p11 ? Math.min(...apres11.slice(0, 200).map((r) => r.zMin ?? 99)) : null
  const zServiMin = p12 ? Math.min(...imgs.filter((r) => r.t >= p12.r.t && r.t <= (net?.t ?? Infinity)).map((r) => r.zServi ?? 99)) : null
  const cropMort = imgs.filter((r) => !r.pose).length
  // le re-zoom : chaque palier vers le fin
  const rezoom = paliers.filter((p) => p.r.cropDemi < p.avant.cropDemi).map((p) => ({ z: p.r.demZoom, hors: (p.r.horsPx ?? 0), prov: p.r.provisoire, paroisOk: p.r.paroisDemi === p.r.cropDemi, refus: p.r.refus, seul: p.r.cropSeul, est: p.r.uEstompage }))
  const rezoomHors = imgs.filter((r) => rezoom.length && r.t >= (marques.find((m) => m.marque === 'cran-zoom-1')?.t ?? Infinity) && (r.horsPx ?? 0) > 0).length
  const dt = imgs.map((r) => r.dt).filter((x) => x > 0).sort((a, b) => a - b)
  const q = (f) => (dt.length ? +dt[Math.min(dt.length - 1, Math.floor(f * dt.length))].toFixed(1) : null)
  const dtGeste = imgs.filter((r) => r.t >= t0 && r.t <= t0 + 8000).map((r) => r.dt).sort((a, b) => a - b)
  const qg = (f) => (dtGeste.length ? +dtGeste[Math.min(dtGeste.length - 1, Math.floor(f * dtGeste.length))].toFixed(1) : null)
  const row = {
    passe: k + 1, temoinHors: P.temoin.horsPxMax, temoinDessin: P.temoin.dessinPxMin,
    altDepart: P.depart.alt, permis: premierPermis && rel(premierPermis), seul0: premierSeul0 && rel(premierSeul0),
    annonce12: annonce12 && rel(annonce12), pose12: p12 && rel(p12.r), parois12: p12 && (p12.r.paroisDemi === p12.r.cropDemi ? (p12.r.provisoire ? 'PROV' : 'déf.') : 'ANCIENNES'), refus12: p12?.r.refus, alt12: p12?.r.alt,
    annonce11: annonce11 && rel(annonce11), pose11: p11 && rel(p11.r), parois11: p11 && (p11.r.paroisDemi === p11.r.cropDemi ? (p11.r.provisoire ? 'PROV' : 'déf.') : 'ANCIENNES'), refus11: p11?.r.refus, alt11: p11?.r.alt, zMinDans11: zMinApres11,
    premierEst: premierEst && rel(premierEst), premierEstAlt: premierEst?.alt, premierHors: premierHors && rel(premierHors), premierHorsPx: premierHors?.horsPx, premierDessHors: premierDessHors && rel(premierDessHors),
    finProv: finProv && rel(finProv), finRefusMer: finRefusMer && rel(finRefusMer), finRefus: finRefus && rel(finRefus), finHors: finHors && rel(finHors), reposSeul: reposSeul && rel(reposSeul), net: net && rel(net),
    horsMax, horsImgs, dessHorsImgs, mixte, mixteProv, provImgs, zServiMin, cropMort,
    rezoom: rezoom.map((z) => `z${z.z}:${z.paroisOk ? (z.prov ? 'PROV' : 'déf.') : 'ANC'}${z.refus ? '/' + z.refus : ''}${z.hors ? '/HORS' + z.hors : ''}${z.seul ? '' : '/seul0'}`).join(' '), rezoomHors,
    dtP50: q(0.5), dtP99: q(0.99), dtGesteP50: qg(0.5), dtGesteP99: qg(0.99), requetes: P.requetes, busyBloque: (P.busyBloque || []).length, images: imgs.length,
    _t0: t0, _origine: P.origine, _p12: p12, _p11: p11, _finProv: finProv, _reposSeul: reposSeul, _premierHors: premierHors, _cast: P.cast,
  }
  tableau.push(row)
  const pub = Object.fromEntries(Object.entries(row).filter(([c]) => !c.startsWith('_')))
  L(`passe ${k + 1} : ${JSON.stringify(pub)}`)
}
// la synthèse
const nums = (c) => tableau.map((r) => r[c]).filter((x) => typeof x === 'number')
const plage = (c) => { const v = nums(c); return v.length ? (Math.min(...v) === Math.max(...v) ? `${Math.min(...v)}` : `${Math.min(...v)} – ${Math.max(...v)}`) : '—' }
const compte = (c, f) => `${tableau.filter((r) => f(r[c])).length}/${tableau.length}`
L('\n## synthèse (ms depuis le premier cran du geste qui franchit ; N = ' + tableau.length + ')')
for (const c of ['temoinHors', 'altDepart', 'permis', 'seul0', 'annonce12', 'pose12', 'alt12', 'annonce11', 'pose11', 'alt11', 'zMinDans11', 'premierEst', 'premierEstAlt', 'premierHors', 'premierHorsPx', 'premierDessHors', 'finProv', 'finRefusMer', 'finRefus', 'finHors', 'reposSeul', 'net', 'horsMax', 'horsImgs', 'dessHorsImgs', 'mixte', 'mixteProv', 'provImgs', 'zServiMin', 'cropMort', 'rezoomHors', 'dtP50', 'dtP99', 'dtGesteP50', 'dtGesteP99', 'requetes', 'busyBloque']) L(`- ${c} : ${plage(c)}`)
L(`- parois12 : ${tableau.map((r) => r.parois12).join(' ')} · refus12 : ${tableau.map((r) => r.refus12 || '-').join(' ')}`)
L(`- parois11 : ${tableau.map((r) => r.parois11).join(' ')} · refus11 : ${tableau.map((r) => r.refus11 || '-').join(' ')}`)
L(`- re-zoom : ${tableau.map((r) => r.rezoom || '(aucun palier)').join(' | ')}`)
L(`- hors px avant l'emprise z12 : ${compte('premierHors', (v) => typeof v === 'number') } passes avec un premier pixel hors ; premierHors < pose12 : ${tableau.filter((r) => typeof r.premierHors === 'number' && r.premierHors < r.pose12).length}/${tableau.length} ; = pose12 (même image) : ${tableau.filter((r) => typeof r.premierHors === 'number' && r.premierHors === r.pose12).length}/${tableau.length}`)
fs.writeFileSync(fichier.replace(/\.json$/, '-bilan.md'), lignes.join('\n') + '\n')

// ══════════ LES IMAGES DU SCREENCAST — les instants de la vidéo ═════════════
if (CAST) {
  const row = tableau.find((r) => r._cast)
  if (!row) { console.log('pas de screencast'); process.exit(0) }
  const index = JSON.parse(fs.readFileSync(path.join(row._cast.dossier, 'index.json'), 'utf8'))
  const tPage = (f) => f.tEpochMs - row._origine
  const proche = (t) => index.reduce((a, b) => (Math.abs(tPage(b) - t) < Math.abs(tPage(a) - t) ? b : a))
  const t0 = row._t0
  const cibles = [
    ['00-avant-geste', t0 - 50],
    ['01-pose-z12', row._p12?.r.t + 20],
    ['02-pose-z11-provisoire', row._p11?.r.t + 40],
    ['03-planete-autour-pic', (row._premierHors?.t ?? t0) + 1500],
    ['04-fin-provisoire', row._finProv?.t + 20],
    ['05-repos-z11-crop-seul', (row._reposSeul?.t ?? t0 + 7000) + 300],
  ]
  const sortie = path.join(path.dirname(fichier), 'captures')
  fs.mkdirSync(sortie, { recursive: true })
  for (const [nom, t] of cibles) {
    if (!Number.isFinite(t)) continue
    const f = proche(t)
    const dest = path.join(sortie, `${nom}.jpg`)
    fs.copyFileSync(path.join(row._cast.dossier, f.nom), dest)
    console.log(`${nom} : ${f.nom} (t ${Math.round(tPage(f) - t0)} ms, visé ${Math.round(t - t0)} ms) → ${dest}`)
  }
}
