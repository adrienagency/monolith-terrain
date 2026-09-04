// Dépouille le journal du banc CAR : par cran, durée cachée (N4), images où le
// cartouche visible porte d'anciennes coordonnées (N3), délai bloc→coordonnées
// justes (N3), rapport cartouche/parois max (N5).
import fs from 'node:fs'
const J = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const S = J.sonde
const coordDe = (lat, lon) => `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? 'N' : 'S'}  ${Math.abs(lon).toFixed(4)}°${lon >= 0 ? 'E' : 'W'}`
const marques = [...new Set(S.map((s) => s.m))].filter(Boolean)
const out = []
for (const m of marques) {
  const seg = S.filter((s) => s.m === m)
  if (!seg.length) continue
  const dt = (a, b) => +(b.t - a.t).toFixed(0)
  // périodes cachées
  let cache = 0, nCache = 0, deb = null
  for (let i = 0; i < seg.length; i++) {
    if (!seg[i].v && deb == null) deb = seg[i]
    if (seg[i].v && deb != null) { cache += dt(deb, seg[i]); nCache++; deb = null }
  }
  if (deb != null) { cache += dt(deb, seg[seg.length - 1]); nCache++ }
  // dernier changement de lieu (lat/lon des params), puis coord juste
  const cible = seg[seg.length - 1]
  const coordCible = coordDe(cible.lat, cible.lon)
  const iChg = seg.findIndex((s) => s.lat === cible.lat && s.lon === cible.lon && s.z === cible.z)
  const iJuste = seg.findIndex((s, i) => i >= iChg && s.v && s.coord === coordCible)
  const mensonge = seg.filter((s, i) => i >= iChg && s.v && s.coord && s.coord !== coordCible)
  const rapMax = Math.max(...seg.filter((s) => s.v && s.rapport).map((s) => s.rapport), 0)
  const rapMaxT = seg.find((s) => s.v && s.rapport === rapMax)
  out.push({
    cran: m, images: seg.length, duree: dt(seg[0], cible),
    z: `${seg[0].z}→${cible.z}`,
    cacheMs: cache, periodesCachees: nCache,
    delaiBlocVersCoordJusteMs: iChg >= 0 && iJuste >= 0 ? dt(seg[iChg], seg[iJuste]) : (iChg >= 0 ? 'jamais' : 'n/a'),
    imagesMensonge: mensonge.length,
    mensongeMs: mensonge.length ? dt(mensonge[0], mensonge[mensonge.length - 1]) + 16 : 0,
    exMensonge: mensonge[0] ? `${mensonge[0].coord} (${mensonge[0].nom}) affiché à ${coordCible}` : '',
    rapportMax: rapMax, rapportMaxT: rapMaxT ? rapMaxT.t : null,
  })
}
console.table(out)
