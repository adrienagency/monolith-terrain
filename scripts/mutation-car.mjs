// LA MORSURE, PROUVÉE PAR MUTATION DU PRODUIT — Tâche CAR.
// Quatre mutations, chacune retirant un morceau du correctif ; le test
// `test/cartouche-vrai.test.js` doit rougir sous chacune. Édition EN BINAIRE
// (Buffer), motif refusé s'il apparaît zéro ou plusieurs fois, restauration
// dans un `finally`, empreinte vérifiée.
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
const md5 = (p) => createHash('md5').update(fs.readFileSync(p)).digest('hex')
const MUTATIONS = [
  { nom: 'sans-rendu-immediat', fichier: 'src/ground-info-layer.js', de: 'if (this._policesPretes() && this.enabled) {', a: 'if (false) {' },
  { nom: 'annonce-muette', fichier: 'src/ground-info-layer.js', de: '    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false\n    ++this.reqId', a: '    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false\n    return false; ++this.reqId' },
  { nom: 'dem-revient-au-predicat', fichier: 'src/main.js', de: 'const voulu = !!params.groundInfo && cartoucheAffiche()', a: 'const voulu = !!params.groundInfo && !!dem && cartoucheAffiche()' },
  { nom: 'echelle-sur-emprise', fichier: 'src/main.js', de: '  const p = poseDesParois()\n  if (p) return p.echelle\n', a: '' },
  { nom: 'parois-largeur-ignoree', fichier: 'src/monde/cartouche-globe.js', de: 'echelle: o.largeur / o.span }', a: 'echelle: o.largeur / o.span * 2 }' },
]
const test = () => spawnSync('node', ['--test', 'test/cartouche-vrai.test.js'], { encoding: 'utf8', timeout: 120000 })
const bilan = []
const ref = test()
const compte = (s) => ({ pass: +(/ℹ pass (\d+)/.exec(s.stdout) || [])[1], fail: +(/ℹ fail (\d+)/.exec(s.stdout) || [])[1] })
bilan.push({ mutation: 'dépôt', ...compte(ref) })
for (const m of MUTATIONS) {
  const avant = md5(m.fichier)
  const buf = fs.readFileSync(m.fichier)
  const motif = Buffer.from(m.de.replace(/\n/g, buf.includes('\r\n') ? '\r\n' : '\n'), 'utf8')
  const i = buf.indexOf(motif)
  if (i < 0 || buf.indexOf(motif, i + 1) >= 0) { bilan.push({ mutation: m.nom, erreur: `motif trouvé ${i < 0 ? 0 : '2+'} fois` }); continue }
  try {
    fs.writeFileSync(m.fichier, Buffer.concat([buf.subarray(0, i), Buffer.from(m.a.replace(/\n/g, buf.includes('\r\n') ? '\r\n' : '\n'), 'utf8'), buf.subarray(i + motif.length)]))
    const r = test()
    const rouges = [...r.stdout.matchAll(/^✖ (.+?) \(/gm)].map((x) => x[1]).slice(0, 3)
    bilan.push({ mutation: m.nom, ...compte(r), rouges: rouges.join(' | ') })
  } finally {
    fs.writeFileSync(m.fichier, buf)
    if (md5(m.fichier) !== avant) throw new Error(`restauration ratée : ${m.fichier}`)
  }
}
console.table(bilan)
for (const m of MUTATIONS) console.log(m.fichier, md5(m.fichier))
