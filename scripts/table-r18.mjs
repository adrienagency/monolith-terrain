// LE TABLEAU DE L'ÉTAPE 1 — la jointure de quatre relevés.
//
// ⚠️ **LE VERDICT SE LIT SUR DEUX GRANDEURS INDÉPENDANTES, ET LEUR DÉSACCORD
// EST L'INFORMATION.** L'écran a-t-il bougé (passes d'image, mouvement ambiant
// coupé pour que la scène soit reproductible au bit près), et la valeur
// a-t-elle atteint un uniforme du globe (sonde d'uniformes) ?
//
//   · bouge  + traverse → ✅
//   · bouge  + rien vu côté uniformes → ✅ quand même (le chemin passe
//     ailleurs : composer, scène, matériau de la mer du crop)
//   · ne bouge pas + traverse → ⚠️ branché mais invisible à cette échelle
//   · ne bouge pas + ne traverse pas → ⛔ écrit dans le vide
//
// ⛔ **LES OPTIONS DE MOUVEMENT NE SE JUGENT PAS SUR UNE IMAGE FIXE.** Vitesse
// de dérive, vitesse de houle, mouvements de caméra : mouvement coupé, elles
// rendent zéro PAR CONSTRUCTION. Elles portent la marque `mouvement` et se
// jugent à la traversée, jamais à l'écran.
import fs from 'node:fs'
import path from 'node:path'

const lire = (p) => JSON.parse(fs.readFileSync(p, 'utf8'))
const dernier = (dir, prefixe) => {
  const f = fs.readdirSync(dir).filter((x) => x.startsWith(prefixe)).sort()
  return path.join(dir, f[f.length - 1])
}

const FD = lire(dernier('.banc/R18/fige-defaut', 'sonde-'))
const FP = lire(dernier('.banc/R18/fige-pre', 'sonde-'))
const U = lire(dernier('.banc/R18/uniformes', 'uniformes-'))
const CARTE = lire('.banc/R18/carte-options.json')

// ⚠️ **TROIS OPTIONS RE-MESURÉES APRÈS UNE FAUTE D'INSTRUMENT**, et leur
// verdict s'inverse. La sonde n'émettait que `input` ; « Échelle fine »,
// « Détail fin » et « Échelle du détail » ne COMMITENT qu'au relâchement
// (`change`) — leur panneau y accroche `regenerateTerrain`. Une sonde qui ne
// lâche jamais le curseur mesure un curseur qu'on traîne : elle les déclarait
// morts. Les relevés d'origine sont écrasés ici, pas effacés :
// `.banc/R18/change2` et `.banc/R18/change3` portent les nouveaux.
const CORRIGES = ['change2', 'change3']
const parI = (r) => Object.fromEntries(r.lignes.map((l) => [l.i, l]))
const fd = parI(FD), fp = parI(FP)
for (const d of CORRIGES) {
  const rep = path.join('.banc/R18', d)
  if (!fs.existsSync(rep)) continue
  for (const l of lire(dernier(rep, 'sonde-')).lignes) {
    if (l.err || l.moy == null) continue
    fd[l.i] = l
    fp[l.i] = l
  }
}
const u = Object.fromEntries(U.lignes.map((l) => [l.i, l]))
const BRUIT_UNIFORME = new Set(['uFxTime', 'uTime', 'uMppFacteur'])
const uni = (i) => (u[i]?.globe || []).filter((k) => !BRUIT_UNIFORME.has(k))

// une option de MOUVEMENT : elle ne peut rien montrer sur une image figée
const MOUVEMENT = new Set([4, 5, 46, 85, 86, 87, 88, 97, 113])

// seuils ABSOLUS, en niveaux de gris moyens sur toute l'image (0-255).
// Étalonnage : « Hauteur des vagues » = 0,131 et se voit nettement sur une
// capture ; « Opacité des courbes » = 0,015 et ne se voit pas.
const RIEN = { moy: 0.005, grad: 0.01 }
const VU = { moy: 0.06, grad: 0.12 }

function verdict(i) {
  const a = fd[i], b = fp[i]
  const moy = Math.max(a?.moy ?? 0, b?.moy ?? 0)
  const grad = Math.max(a?.grad ?? 0, b?.grad ?? 0)
  const passe = (b?.moy ?? 0) > (a?.moy ?? 0) ? 'préconditions' : 'défaut'
  const un = uni(i)
  const rien = moy < RIEN.moy && grad < RIEN.grad
  if (MOUVEMENT.has(i)) return { code: un.length || !rien ? '⚠️' : '⛔', moy, grad, passe, un, note: 'mouvement' }
  if (moy >= VU.moy || grad >= VU.grad) return { code: '✅', moy, grad, passe, un }
  if (rien) return { code: un.length ? '⚠️' : '⛔', moy, grad, passe, un }
  return { code: '⚠️', moy, grad, passe, un }
}

const lignes = FD.lignes.map((l) => ({ ...l, v: verdict(l.i) }))
const compte = { '✅': 0, '⚠️': 0, '⛔': 0 }
for (const l of lignes) compte[l.v.code]++

let md = ''
let panneau = null, section = null
for (const l of lignes) {
  if (l.panneau !== panneau) {
    panneau = l.panneau; section = null
    md += `\n## Panneau « ${panneau} »${l.horsMode ? ' — *hors mode Studio*' : ''}\n`
  }
  if (l.section !== section) {
    section = l.section
    md += `\n**${section || '(sans section)'}**\n\n`
    md += '| # | à l’écran | écrit | lu par | sphère | moy | grad | uniformes du globe |\n'
    md += '|---|---|---|---|---|---|---|---|\n'
  }
  const c = CARTE[String(l.i)] || {}
  const un = l.v.un.length ? '`' + l.v.un.join('` `') + '`' : '—'
  const nom = l.nom + (l.v.note ? ' *(mouvement)*' : '')
  md += `| ${l.i} | ${nom} | ${c.param || '?'} → ${c.ecrit || '?'} | ${c.lecteur || '?'} | ${l.v.code} | ${l.v.moy.toFixed(3)} | ${l.v.grad.toFixed(3)} | ${un} |\n`
}

console.log(`✅ ${compte['✅']}   ⚠️ ${compte['⚠️']}   ⛔ ${compte['⛔']}   total ${lignes.length}`)
fs.writeFileSync('.banc/R18/tableau.md', md)
fs.writeFileSync('.banc/R18/verdicts.json', JSON.stringify(lignes.map((l) => ({
  i: l.i, panneau: l.panneau, section: l.section, nom: l.nom, type: l.type, code: l.v.code,
  moy: +l.v.moy.toFixed(4), grad: +l.v.grad.toFixed(4), passe: l.v.passe, mouvement: !!l.v.note, uni: l.v.un,
})), null, 1))
console.log('écrit : .banc/R18/tableau.md')
