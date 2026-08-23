// L'ATLAS DE NORMALES — Tâche P12.
//
// ⛔ CE QUE CES TESTS EXISTENT POUR EMPÊCHER, ET CE N'EST PAS UNE HYPOTHÈSE :
// la sonde d'ambiante de P3 a rendu pendant onze tâches un coefficient de ciel
// **27,7 % trop grand**, parce qu'elle échantillonnait UNE MOITIÉ de sphère de
// normales et régressait dessus comme si l'irradiance ne dépendait que de
// `N·haut`. Rien ne l'a signalé : le nombre était plausible, le rendu juste, et
// l'erreur ne se voyait qu'en comparant le bloc au socle dans la même page.
//
// La parade est de ne plus rien échantillonner : on mesure exactement les DEUX
// grandeurs que le nuanceur consomme, l'irradiance au zénith et au nadir. Ce
// fichier vérifie que la géométrie, les plages de lecture et la réduction
// disent bien ça — et **il APPARIE les deux conversions**, comme la Tâche P10
// l'a fait pour la monnaie du gradient : une face et sa plage de lecture ne
// peuvent pas dériver l'une de l'autre sans qu'un test rougisse.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as THREE from 'three'

import {
  ZENITH,
  NADIR,
  NORMALES_ATLAS,
  DEBORD,
  ECART,
  MARGE_MIN,
  facesAtlas,
  bandesLecture,
  irradianceBande,
  dispersionBande,
} from '../src/monde/atlas-normales.js'
// ⚠️ **LA SONDE EST IMPORTÉE POUR ÊTRE EXÉCUTÉE, PAS SEULEMENT LUE** — voir la
// section ⑤ : les assertions de chaîne des sections ④ ne prouvaient rien sur ce
// que `coefAmbiante` FAIT, et une survivante de la relecture P8→P12 l'a montré.
import { coefAmbiante, AMBIANTE_NULLE, _sondeInterne } from '../src/sonde-ambiante.js'

const SONDE = readFileSync(new URL('../src/sonde-ambiante.js', import.meta.url), 'utf8')
const SRC = readFileSync(new URL('../src/monde/atlas-normales.js', import.meta.url), 'utf8')

// le coin `s` de la face `i`, tel que `facesAtlas` l'écrit
const sommet = (f, i, s) => [f.positions[(i * 4 + s) * 3], f.positions[(i * 4 + s) * 3 + 1], f.positions[(i * 4 + s) * 3 + 2]]
const sommetIndexe = (f, v) => [f.positions[v * 3], f.positions[v * 3 + 1], f.positions[v * 3 + 2]]
const normale = (f, i, s) => [f.normales[(i * 4 + s) * 3], f.normales[(i * 4 + s) * 3 + 1], f.normales[(i * 4 + s) * 3 + 2]]
const bornesY = (f, i) => {
  let lo = Infinity
  let hi = -Infinity
  for (let s = 0; s < 4; s++) {
    const y = sommet(f, i, s)[1]
    if (y < lo) lo = y
    if (y > hi) hi = y
  }
  return [lo, hi]
}

// ══════════ ① LA GÉOMÉTRIE ══════════════════════════════════════════════════

test('①a les deux normales sont les DEUX PÔLES, et rien d’autre', () => {
  // ⚠️ Le nuanceur évalue `mix(sol, ciel, 0.5·ndu + 0.5)` : il vaut `ciel` à
  // `ndu = +1` et `sol` à `ndu = −1`. Ce sont ces deux grandeurs-là qu'on
  // mesure, donc ces deux normales-là et pas des voisines.
  assert.deepEqual([...ZENITH], [0, 1, 0])
  assert.deepEqual([...NADIR], [0, -1, 0])
  assert.equal(NORMALES_ATLAS.length, 2)
  for (const n of NORMALES_ATLAS) {
    const l = Math.hypot(n[0], n[1], n[2])
    assert.ok(Math.abs(l - 1) < 1e-15, `normale non unitaire : ${l}`)
  }
})

test('①b ⛔ LA BANDE DU BAS EST LE NADIR — la ligne 0 est en bas', () => {
  // ⛔ `readRenderTargetPixels` rend la ligne 0 EN BAS (convention OpenGL).
  // Échanger les deux normales éclairerait le bloc par en dessous, et AUCUNE
  // erreur ne serait levée : le ciel et le sol sont deux triplets du même type.
  assert.equal(NORMALES_ATLAS[0], NADIR)
  assert.equal(NORMALES_ATLAS[1], ZENITH)
  const f = facesAtlas(NORMALES_ATLAS)
  // la face 0 est la BASSE, et elle porte `ndu = −1`
  assert.ok(bornesY(f, 0)[1] < bornesY(f, 1)[0], 'la face 0 doit être sous la face 1')
  assert.equal(normale(f, 0, 0)[1], -1)
  assert.equal(normale(f, 1, 0)[1], 1)
})

test('①c chaque face porte SA normale sur ses quatre sommets', () => {
  const f = facesAtlas(NORMALES_ATLAS)
  for (let i = 0; i < NORMALES_ATLAS.length; i++) {
    for (let s = 0; s < 4; s++) assert.deepEqual(normale(f, i, s), [...NORMALES_ATLAS[i]])
  }
})

test('①d les faces DÉBORDENT du cadre : aucun pixel lu n’est à couverture partielle', () => {
  // ⚠️ Si une face s'arrêtait exactement sur le bord du cadre, le pixel du bord
  // mélangerait la face et le fond — et le fond vaut ZÉRO, donc l'irradiance
  // lue serait trop basse d'une fraction inconnue.
  const f = facesAtlas(NORMALES_ATLAS)
  const n = NORMALES_ATLAS.length
  for (let i = 0; i < n; i++) {
    let xlo = Infinity
    let xhi = -Infinity
    for (let s = 0; s < 4; s++) {
      const x = sommet(f, i, s)[0]
      if (x < xlo) xlo = x
      if (x > xhi) xhi = x
    }
    assert.ok(xlo <= -1 - DEBORD + 1e-12, `face ${i} : bord gauche à ${xlo}`)
    assert.ok(xhi >= 1 + DEBORD - 1e-12, `face ${i} : bord droit à ${xhi}`)
  }
  assert.ok(bornesY(f, 0)[0] <= -1 - DEBORD + 1e-12, 'la face du bas doit déborder par le bas')
  assert.ok(bornesY(f, n - 1)[1] >= 1 + DEBORD - 1e-12, 'la face du haut doit déborder par le haut')
  assert.ok(DEBORD > 0)
})

test('①e les faces sont SÉPARÉES d’un écart non nul, et posées en z = 0', () => {
  const f = facesAtlas(NORMALES_ATLAS)
  const trou = bornesY(f, 1)[0] - bornesY(f, 0)[1]
  // ⚠️ tolérance de FLOTTANT SIMPLE : `facesAtlas` rend un `Float32Array`, donc
  // 0,05 y vaut 0,050 000 000 745. Exiger 1e−12 sur une valeur passée par un
  // float32 est une faute de précision, pas une exigence.
  assert.ok(Math.abs(trou - 2 * ECART) < 1e-6, `écart mesuré ${trou}, attendu ${2 * ECART}`)
  assert.ok(ECART > 0)
  for (let i = 0; i < 2; i++) for (let s = 0; s < 4; s++) assert.equal(sommet(f, i, s)[2], 0)
})

test('①f l’enroulement est DIRECT : les faces regardent la caméra', () => {
  // ⚠️ La caméra de la sonde est en +Z et regarde −Z. Une face à l'enroulement
  // inverse serait vue de dos : `gl_FrontFacing` faux, et un jour où quelqu'un
  // poserait `side: DoubleSide`, three retournerait la normale — donc le ciel
  // et le sol s'échangeraient, en silence.
  // ⚠️ **ON LIT L'INDEX, PAS L'ORDRE DES COINS — une survivante l'a exigé.**
  // La campagne a retourné les DEUX triangles dans `idx.set(...)` et le test
  // n'a pas rougi : il supposait `[0,1,2]` et `[0,2,3]`. Or c'est l'INDEX que
  // le GPU parcourt, et c'est lui qui décide de `gl_FrontFacing`.
  const f = facesAtlas(NORMALES_ATLAS)
  assert.equal(f.index.length, 12)
  for (let t = 0; t < f.index.length / 3; t++) {
    const a = sommetIndexe(f, f.index[t * 3])
    const b = sommetIndexe(f, f.index[t * 3 + 1])
    const c = sommetIndexe(f, f.index[t * 3 + 2])
    const z = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
    assert.ok(z > 0, `triangle ${t} (${f.index[t * 3]},${f.index[t * 3 + 1]},${f.index[t * 3 + 2]}) : normale géométrique en ${z}`)
  }
})

test('①g l’index décrit deux triangles par face, sur les sommets de CETTE face', () => {
  const f = facesAtlas(NORMALES_ATLAS)
  assert.equal(f.index.length, 2 * 6)
  assert.equal(f.positions.length, 2 * 4 * 3)
  for (let i = 0; i < 2; i++) {
    for (let k = 0; k < 6; k++) {
      const v = f.index[i * 6 + k]
      assert.ok(v >= i * 4 && v < (i + 1) * 4, `la face ${i} référence le sommet ${v}`)
    }
  }
})

test('①h la loi vaut pour un nombre QUELCONQUE de faces', () => {
  // ⚠️ La géométrie ne doit pas être écrite « pour deux » : le jour où la sonde
  // voudra un troisième point, elle ne doit pas redécouvrir le débord.
  for (const n of [1, 3, 5]) {
    const normales = Array.from({ length: n }, (_, i) => [0, -1 + (2 * i) / Math.max(1, n - 1) || 0, 0])
    const f = facesAtlas(normales)
    assert.equal(f.positions.length, n * 4 * 3)
    for (let i = 0; i + 1 < n; i++) {
      assert.ok(bornesY(f, i)[1] < bornesY(f, i + 1)[0], `faces ${i} et ${i + 1} non ordonnées`)
    }
    assert.ok(bornesY(f, 0)[0] <= -1 - DEBORD + 1e-12)
    assert.ok(bornesY(f, n - 1)[1] >= 1 + DEBORD - 1e-12)
  }
})

// ══════════ ② LES PLAGES DE LECTURE, APPARIÉES À LA GÉOMÉTRIE ═══════════════

test('②a les plages ne se chevauchent pas et tiennent dans le tampon', () => {
  for (const cote of [16, 32, 64, 128]) {
    const b = bandesLecture(2, cote)
    assert.ok(b[0].debut >= 0, `cote ${cote}`)
    assert.ok(b[1].fin <= cote - 1, `cote ${cote}`)
    assert.ok(b[0].fin < b[1].debut, `cote ${cote}`)
    for (const p of b) assert.ok(p.fin >= p.debut, `plage vide à cote ${cote}`)
  }
})

test('②b ⚡ L’INVARIANT QUI APPARIE LES DEUX CONVERSIONS', () => {
  // ⚡ C'est la parade de la Tâche P10 (`TOUR × UNITE = 2πR`), appliquée ici :
  // `facesAtlas` dit OÙ chaque normale est dessinée, `bandesLecture` dit OÙ on
  // la lit. Ce sont DEUX conversions du même découpage, et rien ne les tenait
  // ensemble. On l'écrit une fois : **le centre de chaque ligne lue doit tomber
  // STRICTEMENT à l'intérieur de la face de sa bande.**
  for (const cote of [16, 32, 64, 128, 256]) {
    const f = facesAtlas(NORMALES_ATLAS)
    const b = bandesLecture(NORMALES_ATLAS.length, cote)
    for (let i = 0; i < 2; i++) {
      const [lo, hi] = bornesY(f, i)
      for (let ligne = b[i].debut; ligne <= b[i].fin; ligne++) {
        const y = ((ligne + 0.5) / cote) * 2 - 1
        assert.ok(y > lo && y < hi, `cote ${cote}, bande ${i}, ligne ${ligne} : y = ${y} hors de [${lo} ; ${hi}]`)
      }
    }
  }
})

test('②c la marge écarte bien la couture, et sans elle l’invariant TOMBE', () => {
  // ⚠️ La preuve que `MARGE` porte quelque chose : à marge nulle, une ligne lue
  // tombe dans l'écart entre les deux faces, là où il n'y a RIEN à lire.
  const f = facesAtlas(NORMALES_ATLAS)
  const cote = 64
  // ⚠️ `ecart = 0` retire la couture DU CALCUL sans la retirer de la géométrie :
  // c'est exactement la mutation qu'on veut voir mourir.
  const sansMarge = bandesLecture(2, cote, 0).map((p, i) => (i === 0 ? { debut: p.debut, fin: cote / 2 - 1 } : { debut: cote / 2, fin: p.fin }))
  let fautes = 0
  for (let i = 0; i < 2; i++) {
    const [lo, hi] = bornesY(f, i)
    for (let ligne = sansMarge[i].debut; ligne <= sansMarge[i].fin; ligne++) {
      const y = ((ligne + 0.5) / cote) * 2 - 1
      if (!(y > lo && y < hi)) fautes++
    }
  }
  assert.ok(fautes > 0, 'à marge nulle, au moins une ligne doit tomber dans la couture')
  assert.ok(MARGE_MIN >= 1)
})

test('②d les plages de la sonde livrée, à COTE = 64', () => {
  assert.deepEqual(bandesLecture(2, 64), [{ debut: 0, fin: 28 }, { debut: 35, fin: 63 }])
  // ⚠️ et la marge SUIT la taille : à 256, trois lignes n'auraient pas suffi
  assert.deepEqual(bandesLecture(2, 256), [{ debut: 0, fin: 119 }, { debut: 136, fin: 255 }])
})

// ══════════ ③ LA RÉDUCTION ══════════════════════════════════════════════════

function tampon(cote, valeur) {
  const t = new Float32Array(cote * cote * 3)
  for (let ligne = 0; ligne < cote; ligne++) {
    for (let col = 0; col < cote; col++) {
      const v = valeur(ligne, col)
      const i = (ligne * cote + col) * 3
      t[i] = v[0]
      t[i + 1] = v[1]
      t[i + 2] = v[2]
    }
  }
  return t
}

test('③a E = π × (blanc − noir) : le facteur est celui de BRDF_Lambert', () => {
  // ⚠️ La sortie d'une surface d'albédo 1 vaut `E / π` (`BRDF_Lambert` de
  // three) : sans le π, l'irradiance rendue serait 3,14 fois trop petite et le
  // bloc trois fois trop sombre. Un test qui compare deux moyennes entre elles
  // ne le verrait pas — celui-ci compare à une valeur POSÉE.
  const cote = 64
  const blanc = tampon(cote, () => [0.5, 0.25, 0.125])
  const noir = tampon(cote, () => [0.1, 0.05, 0.025])
  const b = bandesLecture(2, cote)
  const E = irradianceBande(blanc, noir, cote, b[1])
  assert.ok(Math.abs(E[0] - 0.4 * Math.PI) < 1e-6, `${E[0]}`)
  assert.ok(Math.abs(E[1] - 0.2 * Math.PI) < 1e-6)
  assert.ok(Math.abs(E[2] - 0.1 * Math.PI) < 1e-6)
})

test('③b la soustraction du spéculaire est une SOUSTRACTION, et elle est bornée à 0', () => {
  const cote = 32
  const b = bandesLecture(2, cote)
  // un noir plus clair que le blanc n'a pas de sens physique : on borne
  const E = irradianceBande(tampon(cote, () => [0.1, 0.1, 0.1]), tampon(cote, () => [0.4, 0.4, 0.4]), cote, b[0])
  assert.deepEqual(E, [0, 0, 0])
  // et le spéculaire, lui, est bien retiré
  const F = irradianceBande(tampon(cote, () => [1, 1, 1]), tampon(cote, () => [0.04, 0.04, 0.04]), cote, b[0])
  assert.ok(Math.abs(F[0] - 0.96 * Math.PI) < 1e-6)
})

test('③c les deux bandes lisent DEUX endroits différents du tampon', () => {
  // ⛔ Si les deux plages tombaient au même endroit, `ciel` et `sol` seraient
  // égaux et le bloc s'éclairerait à plat — sans qu'aucune erreur ne soit levée.
  const cote = 64
  const b = bandesLecture(2, cote)
  const blanc = tampon(cote, (ligne) => (ligne < cote / 2 ? [0.2, 0.2, 0.2] : [0.9, 0.9, 0.9]))
  const noir = tampon(cote, () => [0, 0, 0])
  const bas = irradianceBande(blanc, noir, cote, b[0])
  const haut = irradianceBande(blanc, noir, cote, b[1])
  assert.ok(Math.abs(bas[0] - 0.2 * Math.PI) < 1e-6, `bas = ${bas[0]}`)
  assert.ok(Math.abs(haut[0] - 0.9 * Math.PI) < 1e-6, `haut = ${haut[0]}`)
})

test('③d la dispersion vaut ZÉRO sur une bande propre, et DÉNONCE un intrus', () => {
  // ⚡ C'est le témoin de la mesure : tous les pixels d'une bande portent la
  // MÊME normale, donc le même nombre. `coefAmbiante` le publie.
  const cote = 64
  const b = bandesLecture(2, cote)
  const noir = tampon(cote, () => [0, 0, 0])
  assert.equal(dispersionBande(tampon(cote, () => [0.5, 0.5, 0.5]), noir, cote, b[1]), 0)
  // un pixel étranger DANS la plage : la dispersion le voit
  const sale = tampon(cote, (ligne, col) => (ligne === b[1].debut + 3 && col === 7 ? [0.1, 0.1, 0.1] : [0.5, 0.5, 0.5]))
  assert.ok(dispersionBande(sale, noir, cote, b[1]) > 0.7)
  // le même pixel HORS de la plage : la marge fait son travail, elle ne le voit pas
  const propre = tampon(cote, (ligne, col) => (ligne === b[1].debut - 1 && col === 7 ? [0.1, 0.1, 0.1] : [0.5, 0.5, 0.5]))
  assert.equal(dispersionBande(propre, noir, cote, b[1]), 0)
})

test('③e une bande vide rend zéro plutôt que NaN', () => {
  // ⚠️ Une division par zéro poserait NaN dans `uCielIrr`, et un NaN dans une
  // irradiance peint un trou noir.
  const E = irradianceBande(new Float32Array(48), new Float32Array(48), 4, { debut: 3, fin: 1 })
  assert.deepEqual(E, [0, 0, 0])
  assert.equal(dispersionBande(new Float32Array(48), new Float32Array(48), 4, { debut: 3, fin: 1 }), 0)
})

// ══════════ ④ LE BRANCHEMENT DANS LA SONDE ══════════════════════════════════

test('④a la sonde IMPORTE le module et n’écrit plus sa géométrie', () => {
  assert.match(SONDE, /from '\.\/monde\/atlas-normales\.js'/)
  assert.match(SONDE, /facesAtlas\(NORMALES_ATLAS\)/)
  // ⚠️ **UNE SEULE FOIS — UNE SURVIVANTE L'A EXIGÉ.** Les plages étaient
  // calculées dans `coefAmbiante` ET dans `_sondeInterne` : la campagne a changé
  // la première, et ce test a retrouvé la chaîne dans la seconde.
  assert.equal((SONDE.match(/bandesLecture\(/g) || []).length, 1,
    'les plages de lecture sont calculées DEUX fois : une mutation de l une passerait inaperçue')
  assert.match(SONDE, /const BANDES = bandesLecture\(NORMALES_ATLAS\.length, COTE\)/)
  // ⛔ la bille de P3 a disparu AVEC la loi qu'elle servait : plus de sphère,
  // plus de disque à rejeter, plus de régression sur une demi-sphère
  assert.doesNotMatch(SONDE, /SphereGeometry/)
  assert.doesNotMatch(SONDE, /sx \* sx \+ sy \* sy/)
})

test('④b ⛔ LE SOL VIENT DE LA BANDE 0 ET LE CIEL DE LA BANDE 1', () => {
  // ⛔ L'échange est invisible : deux triplets du même type, aucune erreur. Il
  // retournerait l'éclairage indirect du bloc de haut en bas.
  assert.match(SONDE, /const sol = irradianceBande\(blanc, noir, COTE, BANDES\[0\]\)/)
  assert.match(SONDE, /const ciel = irradianceBande\(blanc, noir, COTE, BANDES\[1\]\)/)
})

test('④c le spéculaire n’est PAS coupé sur la sonde, et c’est délibéré', () => {
  // ⚠️ three atténue le diffus indirect par `1 − max(totalScattering)` — mesuré
  // **0,991** dans la page vivante (`.banc/P12/D4-verif-irradiance-P12.json`).
  // Ce facteur, le relief du socle le subit ; la soustraction blanc − noir le
  // retient. Poser `specularIntensity: 0` rendrait l'irradiance « pure » et le
  // crop ressortirait presque 1 % trop clair.
  assert.doesNotMatch(SONDE, /specularIntensity: 0/)
  assert.match(SONDE, /roughness: 1, metalness: 0/)
  // les deux rendus, et l'ordre : blanc puis noir
  assert.ok(SONDE.indexOf('const blanc = rendreEtLire') < SONDE.indexOf('const noir = rendreEtLire'))
})

test('④d les gardes de P3 tiennent : cache, état du renderer, intensité 1', () => {
  // ⛔ **LA GARDE QUI TIENT LA PRODUCTION INTOUCHÉE** : sans environnement, la
  // sonde ne rend RIEN et l'appelant reçoit une ambiante nulle. Une sonde qui
  // tenterait de rendre avec `envTexture` à `null` peindrait un coefficient de
  // zéro — ou lancerait, sur le chemin du démarrage.
  assert.match(SONDE, /if \(!renderer \|\| !envTexture\) return AMBIANTE_NULLE/)
  assert.match(SONDE, /const CACHE = new WeakMap\(\)/)
  assert.match(SONDE, /const memo = CACHE\.get\(envTexture\)/)
  assert.match(SONDE, /_scene\.environment = envTexture/)
  assert.match(SONDE, /_scene\.environmentIntensity = 1/)
  // ⛔ **ET TOUT CE QUE LA SONDE EMPRUNTE AU RENDERER, ELLE LE REND.** Le §0 du
  // plan liste `autoClear === false` comme la première façon dont un banc a menti
  // sur ce chantier, et `PasseFond` a déjà avaleé `shadowMap.needsUpdate` une
  // fois. Une sonde qui laisse l'un des quatre derrière elle casse la page qui
  // l'appelle, pas elle-même.
  assert.match(SONDE, /renderer\.autoClear = autoAvant/)
  assert.match(SONDE, /renderer\.setClearColor\(clearAvant, alphaAvant\)/)
  assert.match(SONDE, /shadowMap\.needsUpdate = ombreAvant/)
  assert.match(SONDE, /renderer\.setRenderTarget\(cibleAvant\)/)
  assert.match(SONDE, /_scene\.environment = null/)
  assert.match(SONDE, /Object\.freeze/)
})

test('④e le module reste PUR : ni three, ni DOM, ni fetch', () => {
  // ⚠️ **ON RETIRE LES COMMENTAIRES AVANT DE CHERCHER.** L'en-tête DIT que le
  // module est pur — le mot « fetch » y figure — et un test qui lit le fichier
  // entier rougirait sur sa propre documentation. La tautologie inverse, et
  // elle s'écrit sans qu'on la voie.
  const code = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  assert.doesNotMatch(code, /\bimport\b/)
  assert.doesNotMatch(code, /THREE|document|window|fetch|require\(/)
  // et le témoin, sans lequel le retrait des commentaires ne prouverait rien
  assert.match(SRC, /fetch/)
})

// ══════════ ⑤ LE COMPORTEMENT DE LA SONDE, EXÉCUTÉE ═════════════════════════
//
// ⛔ **POURQUOI CETTE SECTION EXISTE — ET ELLE EXISTE PARCE QU'UNE SURVIVANTE
// L'A EXIGÉE, POUR LA SECONDE FOIS SUR CE CHANTIER.**
//
// La relecture groupée P8→P12 (constat I-3) a posé une mutation qui laisse
// INTACTES les deux lignes que ④b cherche dans le texte source —
// `const sol = irradianceBande(…, BANDES[0])` et `const ciel = … BANDES[1]` —
// et qui échange `ciel` et `sol` **dans l'objet gelé que `coefAmbiante`
// RETOURNE** :
//
//     ciel: Object.freeze(sol.map((v) => Math.max(0, v))),
//     sol:  Object.freeze(ciel.map((v) => Math.max(0, v))),
//
// ⛔ **`npm test` complet : 4 082 / 4 082, VERT.** Le bloc se serait éclairé par
// en dessous et rien n'aurait rougi.
//
// ⚠️ **C'EST EXACTEMENT LA FAUTE QUE LA SURVIVANTE `10f` DE LA TÂCHE P11 AVAIT
// DÉMASQUÉE UNE TÂCHE PLUS TÔT** (`test/mer-sphere.test.js` ⑫h exigeait une
// assertion de CHAÎNE, et la mutation passait à travers), **et que le §4 du
// rapport de P12 RACONTE** — avant de la réintroduire dans son propre fichier
// de test neuf.
//
// ➡️ **UNE ASSERTION QUI LIT LE TEXTE SOURCE NE PROUVE RIEN SUR CE QUE LE CODE
// FAIT.** Les tests ci-dessous EXÉCUTENT `coefAmbiante` contre un renderer de
// paille qui rend deux bandes de valeurs distinctes et connues d'avance. Ils
// ferment ④b (quelle bande est le ciel), et aussi les parties de ④d qui ne
// vivaient que dans des `assert.match` : le cache, la restitution de l'état du
// renderer, l'intensité d'environnement à 1 et la garde sans environnement.
//
// ⚠️ **ILS NE REMPLACENT PAS ④a–④d, ILS LES DOUBLENT.** Une assertion de chaîne
// garde une vertu — elle NOMME la ligne fautive — mais elle n'est plus SEULE
// sur le branchement.

const { COTE: COTE_SONDE } = _sondeInterne()

// float32 positif → demi-flottant IEEE 754, l'inverse exact de
// `demiFlottantVersFlottant` dans la sonde. Les trois valeurs employées ici
// (0,0625 · 0,25 · 1) sont des puissances de deux : l'aller-retour est EXACT,
// et aucune assertion ci-dessous ne repose sur un arrondi.
const versDemiFlottant = (v) => {
  if (v === 0) return 0
  const e = Math.floor(Math.log2(v))
  return ((e + 15) << 10) | (Math.round((v / Math.pow(2, e) - 1) * 1024) & 0x3ff)
}

const NOIR_SONDE = 0.0625 // le spéculaire que la soustraction doit retirer
const BAS_SONDE = 0.25 // moitié basse du tampon — le NADIR, donc `sol`
const HAUT_SONDE = 1 // moitié haute du tampon — le ZÉNITH, donc `ciel`

/**
 * Un renderer de paille qui peint la moitié BASSE du tampon à une valeur et la
 * moitié HAUTE à une autre, et qui journalise tout ce que la sonde lui emprunte.
 *
 * ⚠️ **LA COUPURE EST À `COTE / 2`, PAS AUX BORNES DES BANDES** : les deux
 * plages de lecture tombent chacune entièrement dans une moitié (0–28 et 35–63
 * à `COTE = 64`), donc chaque bande est UNIFORME et la dispersion doit valoir
 * zéro. Un banc qui peindrait exactement les plages ne prouverait rien sur la
 * marge — il rendrait la bonne réponse quelle que soit la marge.
 */
function rendererDePaille() {
  const journal = { autoClears: [], albedos: [], intensites: [], environnements: [] }
  return {
    journal,
    autoClear: false, // ⚠️ la valeur PIÈGE du §0 du plan : elle doit revenir
    shadowMap: { needsUpdate: true },
    _cible: { marque: 'la cible de la page' },
    _clear: new THREE.Color(0x123456),
    _alpha: 0.25,
    getRenderTarget() {
      return this._cible
    },
    setRenderTarget(t) {
      this._cible = t
    },
    getClearColor(c) {
      return c.copy(this._clear)
    },
    getClearAlpha() {
      return this._alpha
    },
    setClearColor(c, a) {
      this._clear = new THREE.Color(c)
      this._alpha = a
    },
    clear() {},
    render(scene) {
      const mesh = scene.children.find((o) => o.isMesh)
      journal.autoClears.push(this.autoClear)
      journal.albedos.push(mesh.material.color.r)
      journal.intensites.push(scene.environmentIntensity)
      journal.environnements.push(scene.environment)
    },
    readRenderTargetPixels(_cible, _x, _y, w, h, buf) {
      const albedo = journal.albedos[journal.albedos.length - 1]
      for (let ligne = 0; ligne < h; ligne++) {
        const v = albedo === 0 ? NOIR_SONDE : ligne < h / 2 ? BAS_SONDE : HAUT_SONDE
        const demi = versDemiFlottant(v)
        for (let col = 0; col < w; col++) {
          const i = (ligne * w + col) * 4
          buf[i] = demi
          buf[i + 1] = demi
          buf[i + 2] = demi
          buf[i + 3] = versDemiFlottant(1)
        }
      }
    },
  }
}

test('⑤a ⛔ EXÉCUTÉE, LA SONDE REND LE CIEL EN HAUT ET LE SOL EN BAS — la survivante I-3', () => {
  // ⛔ **C'EST LE TEST QUI TUE L'ÉCHANGE AU POINT D'USAGE.** Il ne lit pas une
  // ligne de source : il APPELLE `coefAmbiante` et regarde les deux nombres qui
  // en sortent. Un échange n'importe où entre la lecture du tampon et l'objet
  // gelé le fait rougir.
  const r = rendererDePaille()
  const a = coefAmbiante(r, new THREE.Texture())

  // l'oracle, écrit à la main : `E = π · (blanc − noir)` sur une bande uniforme
  const attSol = Math.PI * (BAS_SONDE - NOIR_SONDE)
  const attCiel = Math.PI * (HAUT_SONDE - NOIR_SONDE)
  assert.ok(attCiel > attSol)

  for (let k = 0; k < 3; k++) {
    assert.ok(
      a.ciel[k] > a.sol[k],
      `canal ${k} : le ciel (${a.ciel[k]}) doit depasser le sol (${a.sol[k]}) — le bloc s eclairerait par en dessous`
    )
    assert.ok(Math.abs(a.ciel[k] - attCiel) < 1e-6, `ciel canal ${k} : ${a.ciel[k]} au lieu de ${attCiel}`)
    assert.ok(Math.abs(a.sol[k] - attSol) < 1e-6, `sol canal ${k} : ${a.sol[k]} au lieu de ${attSol}`)
  }
  // le rapport est connu d'avance et il ne dépend d'aucun arrondi :
  // (1 − 0,0625) / (0,25 − 0,0625) = 5
  assert.ok(Math.abs(a.ciel[1] / a.sol[1] - 5) < 1e-9)

  // ⚠️ **ET LA SOUSTRACTION DU SPÉCULAIRE EST BIEN UNE SOUSTRACTION** : sans
  // elle le sol vaudrait π × 0,25 et le rapport tomberait à 4.
  assert.ok(Math.abs(a.sol[0] - Math.PI * BAS_SONDE) > 0.1, 'le rendu a albedo noir n est pas soustrait')
})

test('⑤b EXÉCUTÉE, le témoin de la mesure vaut ZÉRO et le compte de pixels est celui des plages', () => {
  const r = rendererDePaille()
  const a = coefAmbiante(r, new THREE.Texture())
  // tous les pixels d'une bande portent la même normale, donc le même nombre
  assert.equal(a.dispersion, 0, 'un pixel de couture ou de fond est entre dans la moyenne')
  const b = bandesLecture(NORMALES_ATLAS.length, COTE_SONDE)
  const attendu = (b[0].fin - b[0].debut + 1 + b[1].fin - b[1].debut + 1) * COTE_SONDE
  assert.equal(a.pixels, attendu)
  // et les deux plages tombent bien chacune dans UNE moitié du tampon : c'est
  // ce qui rend le témoin ci-dessus significatif
  assert.ok(b[0].fin < COTE_SONDE / 2, 'la bande du bas deborde dans la moitie haute')
  assert.ok(b[1].debut >= COTE_SONDE / 2, 'la bande du haut deborde dans la moitie basse')
})

test('⑤c EXÉCUTÉE, la sonde REND au renderer tout ce qu’elle lui a emprunté', () => {
  // ⛔ ④d ne vérifiait ça que par `assert.match` sur le texte. Le §0 du plan
  // liste `autoClear === false` comme la PREMIÈRE façon dont un banc a menti
  // ici, et `PasseFond` a déjà avalé `shadowMap.needsUpdate` une fois.
  const r = rendererDePaille()
  const cibleAvant = r._cible
  const clearAvant = r._clear.getHex()
  coefAmbiante(r, new THREE.Texture())
  assert.equal(r._cible, cibleAvant, 'la cible de rendu de la page n est pas reposee')
  assert.equal(r.autoClear, false, 'autoClear reste a ce que la sonde a mis')
  assert.equal(r.shadowMap.needsUpdate, true, 'la carte d ombres ne se remettra jamais a jour')
  assert.equal(r._clear.getHex(), clearAvant, 'la couleur d effacement n est pas reposee')
  assert.equal(r._alpha, 0.25, 'l alpha d effacement n est pas repose')

  // et PENDANT la mesure : deux rendus, blanc puis noir, à intensité 1,
  // `autoClear` forcé à `true`, avec l'environnement demandé
  assert.equal(r.journal.albedos.length, 2)
  assert.deepEqual(r.journal.albedos, [1, 0], 'blanc PUIS noir')
  assert.deepEqual(r.journal.autoClears, [true, true], 'autoClear doit valoir true PENDANT la mesure')
  assert.deepEqual(r.journal.intensites, [1, 1], 'la sonde mesure a environmentIntensity = 1')
  assert.ok(r.journal.environnements.every((e) => e !== null))
  // et la scène de la sonde ne garde pas la texture de la page
  assert.equal(_sondeInterne().scene.environment, null)
})

test('⑤d EXÉCUTÉE, le cache rend le MÊME objet et ne rend pas une seconde fois', () => {
  // ⚠️ `habillageDifferent` compare par `Object.is` : un objet neuf à chaque
  // image reposerait l'habillage entier à chaque image.
  const r = rendererDePaille()
  const env = new THREE.Texture()
  const a = coefAmbiante(r, env)
  const b = coefAmbiante(r, env)
  assert.ok(Object.is(a, b), 'deux appels sur la meme texture doivent rendre le MEME objet')
  assert.equal(r.journal.albedos.length, 2, 'le second appel a re-rendu : le cache ne mord pas')
  assert.ok(Object.isFrozen(a) && Object.isFrozen(a.ciel) && Object.isFrozen(a.sol))
  // une AUTRE texture, elle, se mesure
  coefAmbiante(r, new THREE.Texture())
  assert.equal(r.journal.albedos.length, 4)
})

test('⑤e EXÉCUTÉE, sans environnement la sonde ne rend RIEN et l’ambiante est nulle', () => {
  // ⛔ la garde qui tient le chemin de démarrage : une sonde qui rendrait ici
  // peindrait un coefficient de zéro, ou lancerait.
  const r = rendererDePaille()
  assert.ok(Object.is(coefAmbiante(r, null), AMBIANTE_NULLE))
  assert.ok(Object.is(coefAmbiante(null, new THREE.Texture()), AMBIANTE_NULLE))
  assert.equal(r.journal.albedos.length, 0, 'la sonde a rendu alors qu il n y a pas d environnement')
  assert.deepEqual([...AMBIANTE_NULLE.ciel], [0, 0, 0])
  assert.deepEqual([...AMBIANTE_NULLE.sol], [0, 0, 0])
})
