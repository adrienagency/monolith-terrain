// UN RÉGLAGE DE LA MATIÈRE DU TERRAIN APPARTIENT AU DAMIER ENTIER — pas au
// seul bloc central.
//
// ═══════════════════════════════════════════════════════════════════════════
// POURQUOI CE TEST EXISTE, ET POURQUOI IL NE PORTE PAS SUR UN RÉGLAGE
// ═══════════════════════════════════════════════════════════════════════════
// Le même défaut a été trouvé TROIS FOIS, chaque fois par l'utilisateur devant
// son écran, chaque fois sur un réglage différent :
//   1. les arrondis du socle (`uCoinsDamier`) ;
//   2. le découpage de la surface de carte dans le shader (`uMaskSpan`) ;
//   3. l'heure — la couche nocturne éteignait le sol du bloc central pendant
//      que les voisines restaient en plein jour, coupant la carte en deux le
//      long d'une jointure.
// Chaque correctif a traité SON cas. Le suivant est réapparu ailleurs, parce
// que la faille n'appartient pas au réglage : elle appartient au CHEMIN.
// `src/main.js` tient une référence sur le terrain du bloc central (`terrain`)
// et une sur le damier (`blockGrid`) ; rien n'oblige un réglage écrit sur la
// première à passer par la seconde. Un test par réglage ne protège que le
// réglage qu'il nomme — le septième passerait, comme les six suivants sont
// passés après le premier.
//
// On vérifie donc une PROPRIÉTÉ, pas une liste :
//
//   ① COUVERTURE — tout réglage de la matière du terrain (uniforme du shader,
//     ou propriété du `material` three) que `main.js` écrit sur le bloc central
//     doit aussi être écrit sur les dalles voisines : par `block-grid.js` (dont
//     `_applyLook`/`restyle`), par un essaimage explicite de `main.js` sur
//     `cell.terrain`, ou par le partage de textures (`_pushShared`). Sinon :
//     figurer dans `PROPRES_A_LA_DALLE`, avec sa raison.
//
//   ② PÉAGE — le code qui écrit sur le centre un réglage que `_applyLook`
//     TRANSMET doit atteindre `blockGrid`. `_applyLook` ne tourne que sur
//     `restyle()` et à la naissance d'une dalle : un réglage transmis que
//     personne ne rediffuse laisse les voisines en arrière jusqu'au prochain
//     changement de palette ou de fond. C'est exactement le cas des courbes de
//     niveau — présentes dans `_applyLook`, jamais rediffusées par le curseur
//     qui les change. La propriété ① ne l'attrape pas ; il faut les deux.
//
//   ③ POIGNÉE — `terrain.mapUniforms` cédé EN BLOC à un autre module sort du
//     champ des deux propriétés ci-dessus : le module écrit ce qu'il veut,
//     ailleurs. Chaque cession doit être nommée dans `POIGNEES_CEDEES` — et si
//     elle sert à ÉCRIRE, le fichier qui reçoit la poignée est balayé par la
//     propriété ② comme s'il était main.js. C'est ce qui empêche le prochain
//     panneau de contourner tout le reste : la propriété suit la DONNÉE (les
//     uniformes du bloc central), pas le fichier.
//
// Les trois propriétés se lisent sur la SOURCE. C'est un balayage statique, pas
// une exécution : `main.js` tire three.js, le DOM, des workers et le réseau —
// il n'est pas importable sous node, et le rendre importable pour ce test
// coûterait plus cher que le test lui-même. Les limites de ce choix sont
// écrites en toutes lettres à la fin du fichier (« CE QUE CE TEST NE VOIT
// PAS ») ; les lire fait partie du contrat.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const lire = (p) => fs.readFileSync(path.join(RACINE, p), 'utf8')

// ⚠️ LES COMMENTAIRES SONT DE LA PROSE, PAS DU CODE (même piège que
// test/xss-course.test.js). Ce dépôt CITE dans ses commentaires le code fautif
// d'avant — y compris, juste au-dessus, `uCoinsDamier` et `uMaskSpan`. Balayer
// la source sans retirer les commentaires, c'est faire échouer le test sur la
// description des défauts qu'il vérifie être corrigés.
// ⚠️ ET LE COMPTE DE LIGNES EST PRÉSERVÉ : les messages d'échec donnent un
// numéro de ligne, et un commentaire de bloc avalé décalerait tout le fichier.
const codeSeul = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:'"`])\/\/.*$/gm, '$1')

// ═══════════════════════════════════════════════════════════════════════════
// LES EXCEPTIONS — À MODIFIER CONSCIEMMENT, JAMAIS PAR RÉFLEXE
// ═══════════════════════════════════════════════════════════════════════════
// Ajouter une ligne ici, c'est déclarer qu'un réglage NE DOIT PAS suivre le
// damier. Neuf fois sur dix ce n'est pas ce qu'on veut : le geste normal est de
// faire suivre les voisines, pas de les exempter.

// ① Réglages qui appartiennent À CHAQUE DALLE, pas au damier.
//    (vide aujourd'hui : la topographie, les masques par emprise et les
//    mosaïques de tuiles sont bien reposés par dalle — par block-grid.js ou par
//    les fonctions `peintCellule…` de main.js —, donc la propriété ① les voit
//    passer sans qu'on ait à les exempter. Une entrée ici porte sa raison.)
const PROPRES_A_LA_DALLE = {}

// ② Unités de code qui écrivent du « look » sur le centre sans prévenir le
//    damier — et qui ont raison de le faire. La clé est le nom de la fonction
//    (ou de la propriété qui porte la flèche).
const PORTES_SANS_PEAGE = {
  f3Tick: 'fenêtre continue : le 3×3 y est UN SEUL champ porté par le terrain central, le damier n\'a alors aucune cellule (voir shibumap-fenetre-continue) — il n\'y a personne à prévenir',
  f3PoseFenetre: 'fenêtre continue, même raison que f3Tick',
  f3Fige: 'fenêtre continue, même raison que f3Tick',
}

// ③ Sites où `terrain.mapUniforms` est cédé en bloc. La clé est un fragment
//    présent sur la ligne de cession.
//    · `ecrit` : le module écrit dedans → son fichier passe sous la propriété ②
//      (`poignee` = le nom de l'accesseur dans CE fichier, `damier` = le nom
//      sous lequel il y tient le damier).
//    · sinon, la cession est en lecture seule ou assumée, et `raison` dit
//      pourquoi.
const POIGNEES_CEDEES = {
  ScanController: {
    ecrit: false,
    raison: 'DAMIER : CONTRAINTE ASSUMÉE — les effets de balayage sont CALIBRÉS SUR UN BLOC (rayon, origine et durée en TERRAIN_SIZE / 2). Les étendre au damier n\'est pas un essaimage, c\'est un changement de géométrie de l\'effet. Le balayage s\'arrête donc au bord du bloc central, volontairement.',
  },
  buildMapPanel: {
    ecrit: true,
    fichier: 'src/ui/map-panel.js',
    poignee: 'u',
    damier: 'blockGrid',
    raison: 'les curseurs de courbes et de grille écrivent les uniformes du centre en direct — ils sont donc balayés par la propriété ② dans leur propre fichier',
  },
}

// Les contraintes assumées qui ne sont PAS des uniformes : invisibles aux trois
// propriétés, mais membres de la même famille de décisions. Le test ne peut pas
// les vérifier ; il vérifie qu'elles restent ÉCRITES, sous un marqueur unique.
const MARQUEUR_CONTRAINTE = 'DAMIER : CONTRAINTE ASSUMÉE'
const CONTRAINTES_ASSUMEES = [
  {
    fichier: 'src/main.js',
    quoi: 'les effets de balayage (scan), calibrés sur TERRAIN_SIZE / 2 : le radar s\'arrête au bord du bloc central',
  },
  {
    fichier: 'src/main.js',
    quoi: 'les calques de mapLayers (lacs, toponymes, routes) : une géométrie unique bâtie pour l\'emprise du DEM central, pas un uniforme — les étendre est un projet, pas une ligne',
  },
  {
    fichier: 'src/block-grid.js',
    quoi: 'les ombres portées coupées sur les voisines (−23,7 % de triangles par image, mesuré le 28/07/2026)',
  },
]

// ═══════════════════════════════════════════════════════════════════════════
// LE MODÈLE : QUI ÉCRIT QUOI SUR LA MATIÈRE DU TERRAIN
// ═══════════════════════════════════════════════════════════════════════════

// Un « réglage de la matière » est soit un uniforme du shader de terrain
// (`uXxx.value = …`), soit une propriété du matériau three (`material.roughness
// = …`). Les deux se voient à l'écran de la même façon, et `setTerrainMatRoughness`
// — l'un des six frères recensés le 2026-08-05 — n'était QUE la seconde forme :
// ne regarder que les uniformes l'aurait laissé passer.
const ECRIT_UNIFORME = /\.(u[A-Z]\w*)\.value(?:\s*(?:\+|-|\*|\/|\|\|)?=(?!=)|\.(?:set|copy|setHex|setRGB|setScalar|fromArray|setX|setY|setZ|setW)\s*\()/g
// `needsUpdate` est exclu : c'est un drapeau de recompilation, pas un réglage.
const MATERIAU_IGNORE = new Set(['needsUpdate'])

// ⚠️ L'ALIAS EST OBLIGATOIRE, PAS UN CONFORT. `setLiquidMetal` fait
// `const m = this.material` puis `m.roughness = …` : chercher le seul
// `this.material.` manquerait le métal liquide en entier — et avec lui la
// moitié de la surface que `_applyLook` transmet.
function reglagesEcrits(corps, dans = new Set()) {
  for (const m of corps.matchAll(ECRIT_UNIFORME)) dans.add(m[1])
  const alias = new Set(['this'])
  for (const m of corps.matchAll(/(?:const|let)\s+([\w$]+)\s*=\s*this\.material\b/g)) alias.add(m[1])
  for (const a of alias) {
    const pref = a === 'this' ? 'this\\.material' : a
    for (const m of corps.matchAll(new RegExp(`\\b${pref}\\.([a-z]\\w*)\\s*=(?!=)`, 'g'))) {
      if (!MATERIAU_IGNORE.has(m[1])) dans.add('material.' + m[1])
    }
  }
  return dans
}

// Découpe une classe à plat (un niveau d'indentation) en méthodes. terrain.js et
// block-grid.js sont tous deux écrits comme ça ; le canari plus bas voit si la
// découpe cesse de suivre le fichier.
function methodesDe(source) {
  const out = {}
  let cur = null
  for (const l of source.split('\n')) {
    const m = l.match(/^ {2}([A-Za-z_$#][\w$]*)\s*\(/)
    if (m) { cur = m[1]; out[cur] = [] }
    if (cur) out[cur].push(l)
  }
  for (const k of Object.keys(out)) out[k] = out[k].join('\n')
  return out
}

// TERRAIN.JS — pour chaque méthode, TOUT ce qu'elle finit par écrire sur la
// matière, appels internes compris. Sans cette fermeture transitive, un
// `terrain.setSol(built)` dans main.js ne dirait rien de `uSolLut` : c'est le
// détour par les setters qui rend la famille invisible à l'œil nu.
const METH_TERRAIN = methodesDe(codeSeul(lire('src/terrain.js')))
const ferme = (() => {
  const direct = {}, appelle = {}
  for (const [nom, corps] of Object.entries(METH_TERRAIN)) {
    direct[nom] = reglagesEcrits(corps)
    appelle[nom] = new Set([...corps.matchAll(/\bthis\.(_?[A-Za-z]\w*)\s*\??\.?\(/g)]
      .map((m) => m[1]).filter((n) => n in METH_TERRAIN && n !== nom))
  }
  const cache = new Map()
  const f = (nom, pile = new Set()) => {
    if (cache.has(nom)) return cache.get(nom)
    if (pile.has(nom) || !(nom in direct)) return new Set()
    pile.add(nom)
    const out = new Set(direct[nom])
    for (const a of appelle[nom]) for (const u of f(a, pile)) out.add(u)
    pile.delete(nom)
    if (pile.size === 0) cache.set(nom, out)
    return out
  }
  f.direct = direct
  f.appelle = appelle
  return f
})()

// Ce que `main.js` écrit sur LE BLOC CENTRAL, c'est-à-dire sur la liaison
// `terrain` et sur elle seule. La garde `(?<![.\w$])` est ce qui distingue
// `terrain.mapUniforms…` (le centre) de `cell.terrain.mapUniforms…` (une dalle) :
// sans elle, l'essaimage se ferait passer pour le défaut.
const RE_CENTRE_UNIFORME = /(?<![.\w$])terrain\.mapUniforms\.(u[A-Z]\w*)\.value(?:\s*(?:\+|-|\*|\/)?=(?!=)|\.(?:set|copy|setHex|setRGB|setScalar)\s*\()/g
const RE_CENTRE_METHODE = /(?<![.\w$])terrain\.([A-Za-z_$][\w$]*)\s*\(/g

const MAIN_BRUT = lire('src/main.js')
const MAIN = codeSeul(MAIN_BRUT)
const BLOCK_GRID = codeSeul(lire('src/block-grid.js'))

// ─── ce que main.js pose sur le centre
const CENTRE = new Map() // réglage → par où
for (const m of MAIN.matchAll(RE_CENTRE_UNIFORME)) {
  if (!CENTRE.has(m[1])) CENTRE.set(m[1], `terrain.mapUniforms.${m[1]}`)
}
for (const m of MAIN.matchAll(RE_CENTRE_METHODE)) {
  for (const u of ferme(m[1])) if (!CENTRE.has(u)) CENTRE.set(u, `terrain.${m[1]}()`)
}

// ─── ce que les dalles voisines reçoivent. Trois canaux, et il faut les trois.
const PROPAGE = new Map()
// (a) block-grid.js possède le damier : `t`, `terrain` et `cell.terrain` y
//     désignent TOUJOURS la dalle courante ; le bloc central s'y nomme `mt` et
//     n'est que LU.
for (const m of BLOCK_GRID.matchAll(ECRIT_UNIFORME)) if (!PROPAGE.has(m[1])) PROPAGE.set(m[1], 'block-grid.js')
for (const m of BLOCK_GRID.matchAll(/\b(?:t|terrain|cell\??\.terrain)\s*\??\.\s*([A-Za-z_$][\w$]*)\s*\??\.?\(/g)) {
  for (const u of ferme(m[1])) if (!PROPAGE.has(u)) PROPAGE.set(u, `block-grid.js → .${m[1]}()`)
}
// (b) main.js essaime lui-même les mosaïques bâties par emprise (photo
//     aérienne, lumières nocturnes…) et recopie les horloges de shader par image
const ALIAS_DALLE = new Set(['cell\\??\\.terrain'])
for (const m of MAIN.matchAll(/(?:const|let)\s+([\w$]+)\s*=\s*cell\??\.terrain\b/g)) ALIAS_DALLE.add(m[1])
for (const a of ALIAS_DALLE) {
  for (const m of MAIN.matchAll(new RegExp(`\\b${a}\\s*\\??\\.\\s*mapUniforms\\.(u[A-Z]\\w*)\\.value\\s*=(?!=)`, 'g'))) {
    if (!PROPAGE.has(m[1])) PROPAGE.set(m[1], 'main.js, essaimage sur cell.terrain')
  }
  for (const m of MAIN.matchAll(new RegExp(`\\b${a}\\s*\\??\\.\\s*([A-Za-z_$][\\w$]*)\\s*\\(`, 'g'))) {
    for (const u of ferme(m[1])) if (!PROPAGE.has(u)) PROPAGE.set(u, `main.js, essaimage → .${m[1]}()`)
  }
}
// (c) LE PARTAGE DE TEXTURES, et il ne ressemble à aucun des deux autres : une
//     voisine EMPRUNTE la rampe et la rugosité du centre (`shareTexturesFrom`).
//     Quand le centre les recuit, `_pushShared()` repointe les emprunteuses
//     dans la foulée — sans `restyle`, sans naissance de dalle, sans que
//     main.js ait rien à faire. Ce canal se voit dans terrain.js, pas ailleurs.
const PARTAGE = ferme('_adoptShared')
for (const u of PARTAGE) if (!PROPAGE.has(u)) PROPAGE.set(u, 'partage de textures (_pushShared → _adoptShared)')

// ─── ce que `_applyLook` transmet. La propriété ② ne s'applique qu'à ces
//     réglages-là : ce sont les seuls dont la diffusion dépend d'un
//     DÉCLENCHEMENT. Ceux du partage en sont retirés — ils partent tout seuls.
const METH_GRILLE = methodesDe(BLOCK_GRID)
const LOOK = (() => {
  const corps = METH_GRILLE._applyLook
  assert.ok(corps, 'block-grid.js : `_applyLook` a disparu ou a été renommée — ce test ne sait plus quoi lire')
  const out = reglagesEcrits(corps)
  for (const m of corps.matchAll(/\bt\s*\??\.\s*([A-Za-z_$][\w$]*)\s*\??\.?\(/g)) for (const u of ferme(m[1])) out.add(u)
  for (const u of PARTAGE) out.delete(u)
  return out
})()

// ─── L'UNITÉ ENGLOBANTE d'une écriture : la plus petite fonction qui la
//     contient. Pas le fichier, pas la fonction de premier niveau : les
//     réglages qui manquaient le damier vivent souvent dans un `set: (v) => {…}`
//     au milieu d'un objet de contexte de panneau, et une granularité plus large
//     les aurait blanchis grâce au voisin d'à côté qui, lui, prévient le damier.
const MOTS_DE_CONTROLE = new Set(['if', 'for', 'while', 'switch', 'catch', 'else', 'do', 'try', 'return'])
function uniteEnglobante(src, idx) {
  let profondeur = 0
  for (let i = idx; i >= 0; i--) {
    const c = src[i]
    if (c === '}') { profondeur++; continue }
    if (c !== '{') continue
    if (profondeur > 0) { profondeur--; continue }
    const avant = src.slice(Math.max(0, i - 300), i).replace(/\s+$/, '')
    const tete = avant.match(/([A-Za-z_$][\w$]*)\s*\([^()]*\)\s*$/)
    const estFonction = /=>$/.test(avant)
      || /\bfunction\b[^()]*\([^()]*\)$/.test(avant)
      || (tete && !MOTS_DE_CONTROLE.has(tete[1]))
    if (!estFonction) continue // bloc de contrôle : on remonte encore
    let d = 0
    for (let j = i; j < src.length; j++) {
      if (src[j] === '{') d++
      else if (src[j] === '}' && --d === 0) return { debut: i, texte: src.slice(i, j + 1), nom: nomDUnite(avant) }
    }
    return { debut: i, texte: src.slice(i), nom: nomDUnite(avant) }
  }
  return null
}
// ⚠️ TOUS LES MOTIFS SONT ANCRÉS EN FIN DE CHAÎNE. `avant` s'arrête à
// l'accolade de l'unité cherchée, mais commence 300 caractères plus haut,
// c'est-à-dire au milieu de la fonction PRÉCÉDENTE : un motif non ancré rend
// son nom à elle, et l'exemption de `PORTES_SANS_PEAGE` se poserait alors sur
// la mauvaise unité.
function nomDUnite(avant) {
  return avant.match(/\bfunction\s+([\w$]+)\s*\([^()]*\)$/)?.[1]
    || avant.match(/([A-Za-z_$][\w$]*)\s*:\s*(?:async\s*)?\(?[^()]*\)?\s*=>$/)?.[1]
    || avant.match(/(?:const|let|var)\s+([\w$]+)\s*=\s*(?:async\s*)?\(?[^()]*\)?\s*=>$/)?.[1]
    || avant.match(/([A-Za-z_$][\w$]*)\s*\([^()]*\)$/)?.[1]
    || '(anonyme)'
}
const numLigne = (src, i) => src.slice(0, i).split('\n').length

// ─── les fonctions de premier niveau de main.js, pour le crédit transitif :
//     une fonction qui délègue à une fonction qui prévient le damier est en
//     règle (`setDarkMode` → `applyGridContour`, par exemple).
const FONCTIONS_MAIN = (() => {
  const out = []
  let cur = null
  for (const l of MAIN.split('\n')) {
    const d = l.match(/^(?:export\s+)?(?:async\s+)?function\s+([\w$]+)\s*\(/)
      || l.match(/^(?:const|let|var)\s+([\w$]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{/)
    if (d) { cur = { nom: d[1], corps: [l] }; out.push(cur); continue }
    if (cur) { cur.corps.push(l); if (/^\}/.test(l)) cur = null }
  }
  for (const f of out) f.corps = f.corps.join('\n')
  return new Map(out.map((f) => [f.nom, f]))
})()
const previentLeDamier = (() => {
  const vu = new Map()
  const f = (nom, pile = new Set()) => {
    if (vu.has(nom)) return vu.get(nom)
    const fn = FONCTIONS_MAIN.get(nom)
    if (!fn || pile.has(nom)) return false
    pile.add(nom)
    let r = /\bblockGrid\b/.test(fn.corps)
    if (!r) {
      for (const m of fn.corps.matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(/g)) {
        if (m[1] !== nom && FONCTIONS_MAIN.has(m[1]) && f(m[1], pile)) { r = true; break }
      }
    }
    pile.delete(nom)
    if (pile.size === 0) vu.set(nom, r)
    return r
  }
  return f
})()

// ─── le balayage de la propriété ②, sur un fichier quelconque
function portesSansPeage(fichier, src, brut, damier, motifs) {
  const parUnite = new Map()
  for (const { re, reglages } of motifs) {
    for (const m of src.matchAll(re)) {
      const look = [...reglages(m)].filter((u) => LOOK.has(u))
      if (!look.length) continue
      const ligne = numLigne(src, m.index)
      const u = uniteEnglobante(src, m.index)
      const nom = u?.nom ?? '(niveau module)'
      if (nom in PORTES_SANS_PEAGE) continue
      const re2 = new RegExp(`\\b${damier}\\b`)
      let ok = u ? re2.test(u.texte) : false
      if (!ok && u) {
        for (const c of u.texte.matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(/g)) {
          if (previentLeDamier(c[1])) { ok = true; break }
        }
      }
      if (ok) continue
      const cle = `${fichier}#${u?.debut ?? nom}`
      if (!parUnite.has(cle)) {
        parUnite.set(cle, {
          nom,
          ou: `${fichier.replace(/^src\//, '')}:${ligne}`,
          source: (brut.split('\n')[ligne - 1] ?? '').trim().slice(0, 96),
          look: new Set(),
        })
      }
      for (const r of look) parUnite.get(cle).look.add(r)
    }
  }
  return [...parUnite.values()]
}

// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────── canaris du balayage
// Un test d'architecture qui ne trouve plus rien passe au vert en silence, et
// c'est la seule façon dont celui-ci peut mentir. Les canaris fixent un plancher
// sur ce que le modèle DOIT voir ; les trois défauts déjà corrigés en sont les
// témoins, puisque leur correctif est justement d'être passés par le damier.
test('le modele voit bien la matiere du terrain (canaris du balayage)', () => {
  assert.ok(Object.keys(METH_TERRAIN).length > 50,
    `terrain.js : ${Object.keys(METH_TERRAIN).length} méthodes découpées, c'est trop peu — la découpe par indentation ne suit plus le fichier`)
  assert.ok(CENTRE.size > 60,
    `main.js n'écrirait que ${CENTRE.size} réglages sur le bloc central : le balayage ne trouve plus ce qu'il cherche`)
  assert.ok(LOOK.size > 30,
    `_applyLook ne transmettrait que ${LOOK.size} réglages : la lecture de block-grid.js a cassé`)
  for (const temoin of ['uCoinsDamier', 'uMaskSpan', 'uNuitIntensite']) {
    assert.ok(PROPAGE.has(temoin),
      `${temoin} n'est plus vu comme propagé aux voisines. C'est l'un des trois défauts DÉJÀ corrigés (arrondis du socle / découpe de surface / heure) : soit le correctif a été défait, soit ce test ne sait plus le lire.`)
  }
  assert.ok(LOOK.has('uContourColor'),
    '_applyLook ne transmet plus l\'encre des courbes — le correctif de la bascule jour/nuit a été défait')
  assert.ok(LOOK.has('material.roughness'),
    'la matière three n\'est plus lue (`const m = this.material` dans setLiquidMetal) : le balayage manquerait tout le métal liquide')
  // le canal du partage n'est un canal que tant que les deux cuissons du centre
  // repointent vraiment leurs emprunteuses
  for (const cuisson of ['rebuildRamp', 'rebuildRoughness']) {
    assert.ok(/_pushShared\(/.test(METH_TERRAIN[cuisson] ?? ''),
      `terrain.js : ${cuisson} n'appelle plus _pushShared() — les dalles voisines qui EMPRUNTENT sa texture ne suivent donc plus, et ce test croit encore le contraire.`)
  }
})

// ─────────────────────────────────────────────── ① couverture
test('tout reglage de la matiere ecrit sur le bloc central atteint les voisines', () => {
  const orphelins = [...CENTRE]
    .filter(([r]) => !PROPAGE.has(r) && !(r in PROPRES_A_LA_DALLE))
    .sort(([a], [b]) => a.localeCompare(b))
  assert.deepEqual(orphelins.map(([r]) => r), [], [
    '',
    'CES RÉGLAGES NE SONT POSÉS QUE SUR LE BLOC CENTRAL.',
    '',
    'Le damier pose des dalles voisines autour du bloc central. Chacun des',
    'réglages ci-dessous est écrit par main.js sur `terrain` (le centre) et',
    'n\'est jamais écrit sur `cell.terrain` (les voisines). À l\'écran, ça donne',
    'une carte coupée en deux le long d\'une jointure : le centre change, les',
    'voisines restent comme avant.',
    '',
    ...orphelins.map(([r, ou]) => `  · ${r.padEnd(24)} écrit par ${ou}`),
    '',
    'CE QU\'ON ATTEND DE VOUS, dans l\'ordre de préférence :',
    '',
    '  1. FAIRE SUIVRE LES VOISINES. C\'est presque toujours la bonne réponse.',
    '     · un réglage du LOOK (couleur, ombrage, matière) → l\'ajouter à la liste',
    '       recopiée par `_copieDuCentre` (src/block-grid.js), pour que les dalles',
    '       qui NAISSENT après le changement l\'aient aussi ; puis appeler',
    '       `blockGrid?.diffuseDuCentre()` depuis le code qui le change (voir la',
    '       propriété ② — les deux sont nécessaires, aucune ne suffit seule) ;',
    '     · un réglage qui dépend de l\'EMPRISE de la dalle (une mosaïque de',
    '       tuiles : photo aérienne, lumières nocturnes, occupation du sol…) →',
    '       une fonction `peintCellule…(cell)` dans main.js, appelée depuis',
    '       `blockGrid.onReady` ET depuis le rafraîchissement de la couche.',
    '       Patron de référence : `peintCelluleNuit`.',
    '',
    '  2. L\'EXEMPTER — seulement si le réglage appartient VRAIMENT à la dalle et',
    '     à elle seule. Ajouter une entrée nommée dans `PROPRES_A_LA_DALLE` (en',
    '     haut de ce fichier) AVEC SA RAISON. Une exemption sans raison lisible',
    '     est un défaut différé, pas une décision.',
    '',
    'Ce défaut en est à son troisième épisode connu (arrondis du socle, découpe',
    'de la surface de carte, heure) et a été trouvé les trois fois par',
    'l\'utilisateur devant son écran. Ce test existe pour vous éviter la',
    'quatrième.',
  ].join('\n'))
})

// ─────────────────────────────────────────────── ② péage
test('qui change le look du bloc central previent le damier', () => {
  const fautives = portesSansPeage('src/main.js', MAIN, MAIN_BRUT, 'blockGrid', [
    { re: RE_CENTRE_UNIFORME, reglages: (m) => [m[1]] },
    { re: RE_CENTRE_METHODE, reglages: (m) => ferme(m[1]) },
  ])
  // … et dans TOUT fichier à qui main.js a cédé la poignée des uniformes : la
  // propriété suit la donnée, pas le fichier. Sans ça, un panneau qui écrit
  // `u().uContourInterval.value` contourne le test en entier.
  for (const [, p] of Object.entries(POIGNEES_CEDEES)) {
    if (!p.ecrit) continue
    const brut = lire(p.fichier)
    const src = codeSeul(brut)
    fautives.push(...portesSansPeage(p.fichier, src, brut, p.damier, [
      { re: new RegExp(`\\b${p.poignee}\\(\\)\\s*\\.\\s*(u[A-Z]\\w*)\\.value\\s*=(?!=)`, 'g'), reglages: (m) => [m[1]] },
    ]))
  }
  assert.deepEqual(fautives.map((f) => f.ou), [], [
    '',
    'CE CODE CHANGE LE LOOK DU BLOC CENTRAL SANS PRÉVENIR LE DAMIER.',
    '',
    'Les réglages listés SONT bien transmis par `_applyLook` (src/block-grid.js)',
    '— le problème n\'est pas là. Le problème est que `_applyLook` ne tourne QUE',
    'sur `restyle()` et à la naissance d\'une dalle. Écrire ces réglages sur le',
    'seul centre sans rien déclencher laisse les voisines en arrière jusqu\'au',
    'prochain changement de palette ou de fond — c\'est-à-dire un temps',
    'indéterminé, pendant lequel la carte est coupée en deux à la jointure.',
    '',
    ...fautives.flatMap((f) => [
      `  · ${f.ou}  dans ${f.nom}`,
      `        ${f.source}`,
      `        réglages concernés : ${[...f.look].sort().join(', ')}`,
    ]),
    '',
    'CE QU\'ON ATTEND DE VOUS :',
    '',
    '  1. RAPPELER LE DAMIER. Le geste le moins cher d\'abord :',
    '     · une poignée de couleurs ou de scalaires → `blockGrid?.diffuseDuCentre()`,',
    '       qui recopie du centre sans rien recuire ni recompiler (mesuré :',
    '       quelques dizaines de microsecondes pour 24 dalles) — c\'est le geste',
    '       à faire même sur un curseur traîné ;',
    '     · un changement de MATÉRIAU ou de mode de colorisation →',
    '       `blockGrid?.restyle(params)`, plus complet et beaucoup plus cher : à',
    '       réserver aux gestes ponctuels, jamais sur un curseur traîné.',
    '     ⚠️ APRÈS la dernière écriture sur le centre, pas avant : la diffusion',
    '     recopie ce que le centre porte À CET INSTANT.',
    '',
    '  2. L\'EXEMPTER si le code ne concerne vraiment que le bloc central (le mode',
    '     « fenêtre continue » est le seul cas connu : le 3×3 y est un seul champ,',
    '     le damier n\'a aucune cellule). Ajouter une entrée nommée dans',
    '     `PORTES_SANS_PEAGE`, en haut de ce fichier, AVEC SA RAISON.',
  ].join('\n'))
})

// ─────────────────────────────────────────────── ③ poignée cédée
test('personne ne recoit les uniformes du bloc central en douce', () => {
  const cessions = []
  const lignes = MAIN.split('\n')
  lignes.forEach((l, i) => {
    if (!/(?<![.\w$])terrain\.mapUniforms(?!\s*\??\.\s*u[A-Z])/.test(l)) return
    // le nom du destinataire est sur la ligne, ou juste au-dessus : une cession
    // se fait souvent en argument nommé d'un appel qui commence quelques lignes
    // plus haut (`buildMapPanel({ … u: () => terrain.mapUniforms, … })`)
    const voisinage = lignes.slice(Math.max(0, i - 8), i + 1).join('\n')
    if (Object.keys(POIGNEES_CEDEES).some((k) => voisinage.includes(k))) return
    cessions.push(`  · main.js:${i + 1}  ${(MAIN_BRUT.split('\n')[i] ?? '').trim().slice(0, 96)}`)
  })
  assert.deepEqual(cessions, [], [
    '',
    'LES UNIFORMES DU BLOC CENTRAL SONT CÉDÉS EN BLOC À QUELQU\'UN.',
    '',
    ...cessions,
    '',
    'Un module qui reçoit `terrain.mapUniforms` écrit dedans quand il veut, et',
    'aucune des deux autres propriétés de ce fichier ne le voit passer : ce que',
    'ce module change n\'atteindra JAMAIS les dalles voisines.',
    '',
    'Déclarez la cession dans `POIGNEES_CEDEES` (en haut de ce fichier) :',
    '  · `ecrit: true` + le fichier, le nom de l\'accesseur et le nom sous lequel',
    '    ce fichier tient le damier → il passera sous la propriété ② comme',
    '    main.js, et ses curseurs devront diffuser (c\'est le cas du panneau',
    '    Carte, dont les curseurs de courbes écrivent le centre en direct) ;',
    '  · `ecrit: false` + la raison, si la cession est en lecture seule ou si la',
    '    contrainte est assumée (c\'est le cas du balayage radar, calibré sur un',
    '    seul bloc).',
  ].join('\n'))
})

// ────────────────────────────── les contraintes assumées restent écrites
test('les contraintes assumees du damier sont documentees dans le code', () => {
  const compte = (f) => lire(f).split(MARQUEUR_CONTRAINTE).length - 1
  const manquantes = CONTRAINTES_ASSUMEES.filter((c) => !compte(c.fichier))
    .map((c) => `  · ${c.fichier} — ${c.quoi}`)
  const total = [...new Set(CONTRAINTES_ASSUMEES.map((c) => c.fichier))].reduce((n, f) => n + compte(f), 0)
  const explication = [
    '',
    `Le marqueur « ${MARQUEUR_CONTRAINTE} » manque.`,
    '',
    'Trois choses du damier ne suivent PAS le bloc central, et c\'est voulu :',
    ...CONTRAINTES_ASSUMEES.map((c) => `  · ${c.fichier} — ${c.quoi}`),
    '',
    'Ce ne sont pas des uniformes, donc les propriétés ① à ③ ne peuvent pas les',
    'surveiller : la seule chose que ce test peut garantir, c\'est que la',
    'décision reste ÉCRITE à côté du code qui la porte, sous ce marqueur — pour',
    'que la prochaine personne qui trouve la coupure à l\'écran lise « c\'est',
    'assumé, voici pourquoi » au lieu de croire à un quatrième oubli.',
    '',
    'Remettez le marqueur et sa raison, ou retirez l\'entrée de',
    '`CONTRAINTES_ASSUMEES` si la contrainte a été levée.',
  ].join('\n')
  assert.deepEqual(manquantes, [], explication)
  assert.ok(total >= CONTRAINTES_ASSUMEES.length,
    `${total} marqueurs trouvés pour ${CONTRAINTES_ASSUMEES.length} contraintes assumées : l'un d'eux a été effacé.\n${explication}`)
})

// ═══════════════════════════════════════════════════════════════════════════
// CE QUE CE TEST NE VOIT PAS — à lire avant de s'y fier
// ═══════════════════════════════════════════════════════════════════════════
// · L'ORDRE. La propriété ② regarde SI une unité atteint `blockGrid`, pas QUAND.
//   Une fonction qui diffuse puis réécrit le centre passe au vert et laisse
//   pourtant les voisines en arrière — c'est le cas de `setDarkMode`, qui écrit
//   `uContourWeight` APRÈS `applyGridContour` ; d'où la diffusion explicite
//   ajoutée derrière cette écriture-là, que rien ici n'obligeait à mettre.
// · LES VALEURS. Rien ne vérifie que la voisine reçoit la MÊME valeur que le
//   centre — seulement qu'elle reçoit quelque chose. Une copie qui rejoue la
//   règle au lieu de recopier l'uniforme (le piège documenté dans `_applyLook`
//   pour `uContourWeight`) passerait au vert.
// · LE MOMENT. Une dalle NÉE plus tard reçoit `_applyLook` ; une dalle née plus
//   tôt reçoit la diffusion. Le test vérifie que les deux chemins existent, pas
//   qu'ils portent la même liste — c'est `_copieDuCentre`, appelée par les deux,
//   qui le garantit, et c'est une convention, pas une propriété vérifiée.
// · LE CHEMIN INDIRECT. Un réglage écrit sur le centre par un module tiers qui a
//   reçu l'objet `terrain` entier (et non `terrain.mapUniforms`) échappe aux
//   trois propriétés : la ③ ne surveille que la cession des uniformes.
// · CE QUI N'EST NI UN UNIFORME NI UNE PROPRIÉTÉ DE `material` : géométrie,
//   calques de `mapLayers`, drapeaux d'ombre, visibilité. D'où le marqueur
//   `DAMIER : CONTRAINTE ASSUMÉE`, qui est tout ce qu'on peut faire pour eux.
// · L'ALIASING. `const t = terrain` dans main.js rendrait les écritures
//   invisibles au balayage. Aucun n'existe aujourd'hui ; rien n'empêche d'en
//   écrire un demain.
// · LE RENDU. Aucune image n'est produite ici. Ce test dit que la valeur PART
//   vers les voisines, jamais qu'elle s'y voit juste.
