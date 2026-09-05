// CA1 — lecture d'une passe : les images où l'état change, et l'ordre des événements.
import fs from 'node:fs'
const [,, fichier, passeArg] = process.argv
const R = JSON.parse(fs.readFileSync(fichier, 'utf8'))
const P = R.passes[Number(passeArg ?? 0)]
const rec = P.courbe
const imgs = rec.filter((r) => r.frame != null)
const t0 = P.tDebut
const cle = (r) => [r.demZoom, r.pose, r.cropDemi, r.paroisDemi, r.provisoire, r.parois, r.cropSeul, r.refus, r.dehorsPermis, r.armee, r.auRepos, r.busy, r.annonce, r.mode, (r.horsPx ?? 0) > 0, r.dessineesHors > 0, r.uEstompage >= 0.999, r.uEstompage <= 0.001, r.attente, r.sondes].join('|')
let prev = null
const lignes = []
for (const r of rec) {
  if (r.marque) { lignes.push(`── ${String(r.t - t0).padStart(6)} ms  ${r.marque}`); continue }
  const k = cle(r)
  if (k === prev) continue
  prev = k
  lignes.push(`${String(r.t - t0).padStart(6)} ms  z${r.demZoom} pose:${r.pose ? 1 : 0} crop:${r.cropDemi} parois:${r.parois ? (r.paroisDemi === r.cropDemi ? '=' : r.paroisDemi) : 'NUL'}${r.provisoire ? ' PROV' : ''} seul:${r.cropSeul ? 1 : 0} porte:${r.porteRepos} est:${r.uEstompage} permis:${r.dehorsPermis ? 1 : 0} arm:${r.armee ? 1 : 0} repos:${r.auRepos ? 1 : 0} busy:${r.busy ? 1 : 0} refus:${r.refus || '-'} zS:${r.zServi}/${r.zCible} dess:${r.dessinees}(${r.dessineesHors} hors, z${r.zMin}-${r.zMax}) px hors:${r.horsPx ?? '?'} dedans:${r.dedansPx ?? '?'} alt:${r.alt} altG:${r.altGlobe} camY:${r.camY} L:${r.largeurM == null ? '?' : Math.round(r.largeurM)}${r.attente ? ' ATTENTE(' + r.sondes + ')' : ''} mode:${r.mode} ${r.annonce ? '« ' + r.annonce + ' »' : ''}`)
}
console.log(lignes.join('\n'))
console.log('\nbilan', JSON.stringify(P.bilan, null, 0).slice(0, 1500))
console.log('temoin', JSON.stringify(P.temoin), 'crans', JSON.stringify(P.crans), 'crans2', JSON.stringify(P.crans2.map((c) => [c.demZoom, c.pose, c.alt])))
