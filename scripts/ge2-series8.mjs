// GE2 tour 2 — lit une série de sonde-ge3 (--repete 8) et rend, par geste, les
// huit valeurs des grandeurs du barème GE3. Huit chargements, jamais moins.
import fs from 'node:fs'
const f = process.argv[2] || '.banc/GE2/series8-apres.json'
const J = JSON.parse(fs.readFileSync(f, 'utf8'))
const fmt = (a, n = 3) => a.map((v) => (v == null ? 'null' : (+v).toFixed(n))).join(' · ')
const stat = (a) => { const v = a.filter((x) => Number.isFinite(x)); return v.length ? { min: Math.min(...v), max: Math.max(...v), n: v.length } : null }
for (const [nom, passes] of Object.entries(J.gestes)) {
  const P = Array.isArray(passes) ? passes : [passes]
  console.log('\n== ' + nom + ' (' + P.length + ' chargements)')
  console.log('  phi avant   : ' + fmt(P.map((p) => p.diagAvant?.phiDeg), 2))
  console.log('  rotation °  : ' + fmt(P.map((p) => p.rotationDeg)))
  console.log('  dAzimut °   : ' + fmt(P.map((p) => p.dAzimutDeg)))
  console.log('  dTilt °     : ' + fmt(P.map((p) => p.dTiltDeg)))
  console.log('  rapport d   : ' + fmt(P.map((p) => p.rapportDistance), 4))
  console.log('  rapport alt : ' + fmt(P.map((p) => p.rapportAlt), 4))
  console.log('  centre0 px  : ' + fmt(P.map((p) => p.centre0DerivePx), 1))
  console.log('  curseur0 px : ' + fmt(P.map((p) => p.curseur0DerivePx), 1))
  console.log('  saisi px    : ' + fmt(P.map((p) => p.saisiVsPointeurPx), 1))
  console.log('  |Δln d| max : ' + P.map((p) => p.deltaLndMax).join(' · '))
  if (P[0].elanDeg != null) {
    console.log('  élan °      : ' + fmt(P.map((p) => p.elanDeg)) + '   (% du geste : ' + fmt(P.map((p) => 100 * p.elanDeg / p.rotationDeg), 1) + ')')
    console.log('  élan ms     : ' + fmt(P.map((p) => p.elanDureeMs), 0))
  }
}
// la symétrie du clic droit : |ln(rapport_haut × rapport_bas)| par paire de chargements
const h = J.gestes['droit-glisse-V-haut'], b = J.gestes['droit-glisse-V-bas']
if (Array.isArray(h) && Array.isArray(b)) {
  const sym = h.map((x, i) => Math.abs(Math.log(x.rapportDistance * (b[i]?.rapportDistance ?? 1))))
  console.log('\n== symétrie C1 |ln(×haut · ×bas)| (seuil 0,05) : ' + fmt(sym, 4))
}
