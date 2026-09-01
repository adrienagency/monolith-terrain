// LES PAROIS DU BLOC ET LA GRILLE DE RELEVÉ — Tâche R22.
//
// Quatre options du Studio, mortes sous le mode sphère, et deux natures
// différentes qu'il ne faut pas confondre :
//
//   · **48 « Afficher le socle » et 50 « Couleur de la tranche »** pilotaient un
//     objet qui EXISTE — les parois de `parois-crop.js` sont bâties et rendues.
//     Il leur manquait le branchement.
//   · **19 « Taille de la grille » et 20 « Opacité de la grille »** pilotaient
//     quelque chose qui N'EXISTAIT PAS : le nuanceur du crop ne portait pas une
//     ligne de grille. C'est une écriture, pas un rebranchement.
//
// ══════════ CE QUI ÉTAIT MESURÉ AVANT, ET COMMENT ══════════════════════════
//
// `scripts/sonde-r22.mjs`, Chrome sans tête, RTX 3080 / ANGLE D3D11, La Réunion
// au cadrage d'ouverture, mouvement ambiant coupé, **fenêtre 1:1 de 512 × 320
// pixels du tampon de dessin** — ⚠️ **PAS un condensé** : le brief le dit et
// c'est vérifié, une moyenne de boîte ANNULE un motif fin, et une grille EST un
// motif fin. Plancher de bruit mesuré sur place, deux témoins consécutifs :
// **0,0000 / 0,0000** pour les quatre.
//
//     option                          moyenne   gradient
//     48 Afficher le socle             0,0004    0,0006
//     50 Couleur de la tranche         0,0000    0,0000
//     20 Opacité de la grille          0,0000    0,0000
//     19 Taille de la grille           0,0000    0,0000
//
// Les chiffres d'après sont dans `.banc/R22/` et dans `rapport-R22.md`.
//
// ══════════ LA CONVERSION D'UNITÉ, QUI EST LE SUJET DE LA MOITIÉ DU FICHIER ══
//
// ⚠️ **C'EST LA CLASSE DE DÉFAUT N° 1 DE CE CHANTIER** (neuf occurrences :
// 121,6 · 10 · 130,4 · 6, une portée de flou de 1 465 km, des toponymes 1 830 m
// sous les Alpes). `uGridStep` est un pas au sol en UNITÉS DE BLOC ; le crop ne
// connaît que `qCrop`, dans [−1, 1]. `pasGrilleBloc` porte la conversion, et
// **le facteur qui manquait est 28** — le demi-côté du bloc.
//
// ⚡ **ET LE PIÈGE EST L'EXAGÉRATION.** `intervalleCourbesBloc`, le modèle que
// le brief désigne, DIVISE par elle : c'est une longueur verticale. Le pas de
// grille est HORIZONTAL et n'en porte pas. La recopier aurait multiplié le pas
// par 18 — 0,62 cellule sur tout le bloc au lieu de 11,2. ⑤ l'exerce.
//
// ⚠️ **CE QUE CE FICHIER NE PEUT PAS TESTER** : que le GPU exécute ce texte et
// que l'écran porte un carroyage. Seul l'écran le dit — `.banc/R22/`.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  pasGrilleBloc,
  cellulesGrilleCrop,
  intervalleCourbesBloc,
  largeurCropM,
  HABILLAGE_MONDE,
  COTE_CROP_UNITES,
} from '../src/monde/habillage-crop.js'
import { CHAMPS_HABILLAGE, habillageDifferent } from '../src/monde/branchement-crop.js'
import { Globe } from '../src/globe.js'

const GLOBE = readFileSync(new URL('../src/globe.js', import.meta.url), 'utf8')
const MAIN = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
const TERRAIN = readFileSync(new URL('../src/terrain.js', import.meta.url), 'utf8')
const PLINTH = readFileSync(new URL('../src/plinth.js', import.meta.url), 'utf8')
const CREATE_PANEL = readFileSync(new URL('../src/ui/create-panel.js', import.meta.url), 'utf8')
const MAP_PANEL = readFileSync(new URL('../src/ui/map-panel.js', import.meta.url), 'utf8')

const iFrag = GLOBE.indexOf('const FRAG')
const FRAG = GLOBE.slice(iFrag, GLOBE.indexOf('\n`\n', iFrag))
// le bloc de grille, découpé une fois : plusieurs tests s'y appuient
const iGrille = FRAG.indexOf('LA GRILLE DE RELEVE DU BLOC, PORTEE SUR LA DECOUPE')
const BLOC_GRILLE = FRAG.slice(FRAG.indexOf('if (uGridOpacity', iGrille), FRAG.indexOf('10° graticule', iGrille))

// ⚠️ **LE RELEVÉ DE RÉFÉRENCE, PRIS DANS L'APPLICATION VIVANTE**, pas inventé
// pour ce fichier : `.banc/R22/apres-R22-t1.json`, La Réunion, cadrage
// d'ouverture. `uCropDemiM` est ce que le globe a calculé, `grillePasM` ce que
// la conversion a rendu. Ils servent d'ancre à ①c et ②c.
const RELEVE = {
  cropDemiM: 13678.209546548289,
  pasM_gridStep5: 2442.53741902648,
  pasM_gridStep2: 977.0149676105921,
  extentMetersDem: 27354.269019739164,
  crop: { demi: 0.0003662109375, cy: 0.5604248046875 },
}

// ══════════ ① LA CONVERSION — sa formule, et ses refus ══════════════════════

test('①a le pas au sol est `valeurBloc × largeurSolM / span` — écrit, pas deviné', () => {
  // le cas d'école : un bloc de 56 unités large de 5 600 m fait 100 m par unité
  assert.equal(pasGrilleBloc({ valeurBloc: 1, largeurSolM: 5600, span: 56 }), 100)
  assert.equal(pasGrilleBloc({ valeurBloc: 5, largeurSolM: 5600, span: 56 }), 500)
  // et le span par défaut est celui du bloc, pas un nombre à part
  assert.equal(
    pasGrilleBloc({ valeurBloc: 3, largeurSolM: 5600 }),
    pasGrilleBloc({ valeurBloc: 3, largeurSolM: 5600, span: COTE_CROP_UNITES })
  )
})

test('①b LINÉAIRE DES DEUX CÔTÉS, ET INVERSE DU SPAN — la loi, pas trois cas', () => {
  // ⚠️ **UNE FORMULE SE VÉRIFIE SUR SA FORME, PAS SUR UN POINT.** Trois égalités
  // bien choisies passeraient aussi avec un `+` à la place d'un `×`.
  for (const L of [1000, 27356.4, 250000]) {
    for (const s of [56, 168]) {
      const base = pasGrilleBloc({ valeurBloc: 1, largeurSolM: L, span: s })
      for (const v of [0.5, 2, 5, 14]) {
        const p = pasGrilleBloc({ valeurBloc: v, largeurSolM: L, span: s })
        assert.ok(Math.abs(p - base * v) < 1e-9, `pas linéaire en valeurBloc (${L}, ${s}, ${v})`)
      }
      // doubler le span à emprise égale DIVISE le pas par deux
      const large = pasGrilleBloc({ valeurBloc: 1, largeurSolM: L, span: s * 2 })
      assert.ok(Math.abs(large * 2 - base) < 1e-9, 'le span ne divise pas')
    }
  }
})

test('①c LA DISTANCE CONNUE AU SOL — le relevé de La Réunion, reproduit', () => {
  // ⚡ **C'EST LA VÉRIFICATION QUE LE BRIEF EXIGE : « contre une distance connue
  // au sol », pas à l'œil.** La demi-largeur vient du globe vivant ; on la
  // renvoie dans la conversion et on doit retomber sur les deux pas relevés.
  const L = RELEVE.cropDemiM * 2
  const p5 = pasGrilleBloc({ valeurBloc: 5, largeurSolM: L, span: 56 })
  const p2 = pasGrilleBloc({ valeurBloc: 2, largeurSolM: L, span: 56 })
  assert.ok(Math.abs(p5 - RELEVE.pasM_gridStep5) < 1e-6, `${p5} ≠ ${RELEVE.pasM_gridStep5}`)
  assert.ok(Math.abs(p2 - RELEVE.pasM_gridStep2) < 1e-6, `${p2} ≠ ${RELEVE.pasM_gridStep2}`)
  // et le nombre de mètres par unité de scène est bien celui annoncé partout
  assert.ok(Math.abs(L / 56 - 488.5075) < 1e-3, `${L / 56} m par unité`)
})

test('①d `largeurCropM` DU DÉPÔT rend la largeur que le globe a mesurée', () => {
  // ⚠️ **UN ORACLE INDÉPENDANT** : `largeurCropM` est écrite pour la marge de
  // côte (Tâche C), longtemps avant cette tâche. Si elle et le relevé de
  // l'application divergeaient, c'est que `poserHabillage` ne l'appelle pas.
  const L = largeurCropM(RELEVE.crop)
  assert.ok(Math.abs(L - RELEVE.cropDemiM * 2) < 1e-6, `${L} ≠ ${RELEVE.cropDemiM * 2}`)
})

test('①e TOUTE ENTRÉE ABSURDE REND `null`, JAMAIS 0 — un 0 deviendrait un NaN', () => {
  // ⛔ Le § « écrêtage de Mercator » de `globe.js` dit où mène un NaN ici : une
  // comparaison FAUSSE, donc un fragment gardé, donc le contraire du but.
  for (const arg of [
    undefined, {},
    { valeurBloc: 0, largeurSolM: 5600, span: 56 },
    { valeurBloc: -3, largeurSolM: 5600, span: 56 },
    { valeurBloc: 5, largeurSolM: 0, span: 56 },
    { valeurBloc: 5, largeurSolM: NaN, span: 56 },
    { valeurBloc: 5, largeurSolM: 5600, span: 0 },
    { valeurBloc: Infinity, largeurSolM: 5600, span: 56 },
    { valeurBloc: '', largeurSolM: 5600, span: 56 },
  ]) {
    assert.equal(pasGrilleBloc(arg), null, `${JSON.stringify(arg)} ne rend pas null`)
  }
})

// ══════════ ② L'ORACLE DU COMPTE — le socle et le crop tracent le MÊME nombre ═

test('②a le compte de cellules du crop ÉGALE celui du socle — sur 40 combinaisons', () => {
  // ⚡ **C'EST L'ORACLE, ET IL NE PASSE PAR AUCUN NUANCEUR.** Le socle trace
  // `span / gridStep` cellules par construction (`champXZ() / uGridStep` sur un
  // bloc de `span` unités) ; le crop en trace `largeurSolM / pas_m`. Les deux
  // doivent être le MÊME nombre, sinon les deux Terres ne portent pas la même
  // carte — et c'est précisément ce que « une seule Terre » interdit.
  for (const L of [1000, 5600, 27356.419093096578, 137000, 250000]) {
    for (const s of [56, 112, 168]) {
      for (const v of [0.5, 2, 5, 9.5, 14]) {
        const p = pasGrilleBloc({ valeurBloc: v, largeurSolM: L, span: s })
        const cell = cellulesGrilleCrop({ largeurSolM: L, pasM: p })
        assert.ok(Math.abs(cell - s / v) < 1e-9, `${L}/${s}/${v} : ${cell} ≠ ${s / v}`)
      }
    }
  }
})

test('②b au réglage du produit, ça fait 11,2 cellules sur 27,4 km', () => {
  const L = RELEVE.cropDemiM * 2
  const cell = cellulesGrilleCrop({ largeurSolM: L, pasM: RELEVE.pasM_gridStep5 })
  assert.ok(Math.abs(cell - 11.2) < 1e-9, `${cell} ≠ 11,2`)
  assert.ok(Math.abs(cellulesGrilleCrop({ largeurSolM: L, pasM: RELEVE.pasM_gridStep2 }) - 28) < 1e-9)
})

test('②c MÉLANGER LES DEUX LARGEURS SE VOIT ICI — et c’est pourquoi on ne le fait pas', () => {
  // ⚠️ `dem.extentMeters` et `largeurCropM(repère)` mesurent la MÊME largeur au
  // sol par deux chemins, et diffèrent de 0,0079 % à La Réunion. Nourrir le pas
  // de l'une et la coordonnée de l'autre décale le compte — invisible, et faux.
  // Ce test ne demande pas que l'écart soit gros : il demande qu'il EXISTE, pour
  // que personne ne remplace `largeurSolM` par `extentMeters` « puisque c'est
  // pareil ».
  const L = RELEVE.cropDemiM * 2
  const pasMelange = pasGrilleBloc({ valeurBloc: 5, largeurSolM: RELEVE.extentMetersDem, span: 56 })
  const cellMelange = cellulesGrilleCrop({ largeurSolM: L, pasM: pasMelange })
  assert.notEqual(cellMelange, 11.2)
  assert.ok(Math.abs(cellMelange - 11.2) < 0.01, 'l’écart doit rester petit — il est invisible, pas absent')
  assert.ok(Math.abs(cellMelange - 11.2009) < 1e-3, `${cellMelange}`)
})

// ══════════ ③ CE QUE LE NUANCEUR ÉCRIT ═════════════════════════════════════

test('③a la grille est indexée sur le SOL, jamais sur l’écran ni sur la tuile', () => {
  // ⚠️ **LE DÉFAUT QU'ADRIEN A DÉJÀ ATTRAPÉ À L'ŒIL DEUX FOIS**, et que
  // `terrain.js` documente : indexé sur la géométrie ou sur `vUv`, un motif
  // reste COLLÉ À L'ÉCRAN pendant que le relief défile, ou se répète une fois
  // par tuile. La grille se lit donc en `qCrop`, la coordonnée locale du crop.
  assert.match(BLOC_GRILLE, /vec2 solM = qCrop \* uCropDemiM;/)
  assert.match(BLOC_GRILLE, /vec2 gq = solM \/ uGridStepM;/)
  assert.equal(/vUv/.test(BLOC_GRILLE), false, 'la grille ne doit pas lire l’UV de tuile')
  assert.equal(/gl_FragCoord/.test(BLOC_GRILLE), false, 'la grille ne doit pas lire l’écran')
})

test('③b LE TRAIT EST CELUI DU SOCLE, TERME À TERME', () => {
  // le socle, `terrain.js`, bloc « survey grid » : `fract(g + 0.5) - 0.5`, un
  // `smoothstep(0, d × 1.4, dist)` par axe, et le MAX des deux.
  const iSocle = TERRAIN.indexOf('--- survey grid in world x/z')
  const socle = TERRAIN.slice(iSocle, iSocle + 800)
  assert.match(socle, /abs\(fract\(g \+ 0\.5\) - 0\.5\)/)
  assert.match(socle, /1\.0 - smoothstep\(0\.0, dg\.x \* 1\.4, distGrid\.x\)/)
  assert.match(socle, /max\(gx, gz\)/)
  // et le crop dit la même chose, aux noms près
  assert.match(BLOC_GRILLE, /abs\(fract\(gq \+ 0\.5\) - 0\.5\)/)
  assert.match(BLOC_GRILLE, /1\.0 - smoothstep\(0\.0, dgq\.x \* 1\.4, distG\.x\)/)
  assert.match(BLOC_GRILLE, /1\.0 - smoothstep\(0\.0, dgq\.y \* 1\.4, distG\.y\)/)
  assert.match(BLOC_GRILLE, /max\(gxC, gzC\)/)
})

test('③c ⛔ AUCUN `minFade` DANS LA GRILLE — la leçon de R19, gardée', () => {
  // ⛔ **C'EST LE PIÈGE N° 1 QUE LE BRIEF SIGNALE.** Les courbes du crop
  // mouraient sur ce fondu de minification : sous le crop, `texel` vaut 3,00 et
  // `clamp(1,6 − 3,00 × 0,55)` rend ZÉRO. Une grille qui passerait par là serait
  // parfaite et invisible. Le socle, qui est le modèle, n'en a aucun.
  assert.equal(/minFade/.test(BLOC_GRILLE), false, 'la grille ne doit pas passer par minFade')
  assert.equal(/texel/.test(BLOC_GRILLE), false, 'la grille ne doit pas lire texel')
  // et le socle n'en a pas non plus, dans SON bloc de grille — l'oracle
  const iSocle = TERRAIN.indexOf('--- survey grid in world x/z')
  assert.equal(/minFade/.test(TERRAIN.slice(iSocle, iSocle + 800)), false)
})

test('③d LA COUVERTURE DU CROP MULTIPLIE, ELLE NE GARDE PAS LA BRANCHE', () => {
  // ⚠️ `dedansCrop` vaut ZÉRO hors découpe, donc la planète nue et la vue
  // orbitale sont intouchées — et c'est une couverture DOUCE, donc la grille
  // fond au bord du bloc au lieu d'y poser une arête d'un pixel.
  assert.match(BLOC_GRILLE, /\* uGridOpacity \* dedansCrop;/)
  // ⛔ mais elle n'entre PAS dans la garde : `fwidth` sous une garde qui dépend
  // de la DONNÉE a une dérivée indéfinie. La garde est faite de trois uniformes.
  assert.match(BLOC_GRILLE, /^if \(uGridOpacity > 0\.001 && uGridStepM > 0\.0 && uCropDemiM > 0\.0\) \{/)
})

test('③e ELLE PEINT AVEC `uGridColor`, PAS AVEC L’ENCRE DES COURBES', () => {
  // le socle a DEUX encres — `uContourColor` et `uGridColor` — et le nuancier
  // « Grille » du panneau Fonds pilote la seconde. Peindre la grille du crop
  // avec `uInk` aurait donné deux Terres de couleurs différentes au même
  // réglage.
  assert.match(BLOC_GRILLE, /col = mix\(col, uGridColor, grille\);/)
  assert.match(TERRAIN, /diffuseColor\.rgb = mix\(diffuseColor\.rgb, uGridColor, grid\);/)
})

test('③f L’ORDRE EST CELUI DU SOCLE : les courbes, puis la grille, puis le graticule', () => {
  // ⚠️ **L'ORDRE EST UN ARGUMENT, PAS UNE HABITUDE** : le carroyage passe
  // PAR-DESSUS les courbes, sinon un relief dense l'efface par morceaux et une
  // grille trouée n'est plus une grille.
  const iContour = FRAG.indexOf('col = mix(col, uInk, contour);')
  const iGrilleMix = FRAG.indexOf('col = mix(col, uGridColor, grille);')
  const iGratic = FRAG.indexOf('col = mix(col, uInk, gl * uGraticuleOpacity);')
  assert.ok(iContour > 0 && iGrilleMix > 0 && iGratic > 0)
  assert.ok(iContour < iGrilleMix, 'la grille doit passer APRÈS les courbes')
  assert.ok(iGrilleMix < iGratic, 'la grille du bloc doit précéder le graticule de la planète')
  // et le socle a le même ordre — l'oracle
  assert.ok(TERRAIN.indexOf('--- contour lines') < TERRAIN.indexOf('--- survey grid in world x/z'))
})

test('③g LE GRATICULE N’EST PAS LA GRILLE — deux objets, deux uniformes', () => {
  // ⚡ **C'EST LE DÉPARTAGE QUE R22 A RÉFUTÉ.** L'inventaire rangeait 19 et 20
  // dans « aucun sens sur la sphère », au motif que le graticule lat/lon tenait
  // lieu de grille. Ce sont deux objets : l'un est un maillage de PLANÈTE en
  // degrés, l'autre un carroyage de BLOC en mètres au sol. Ce test interdit
  // qu'on les refonde un jour en un seul.
  assert.match(FRAG, /vec2 g = vLatLon \/ 10\.0;/)
  assert.match(FRAG, /uniform float uGraticuleOpacity;/)
  assert.match(FRAG, /uniform float uGridOpacity;/)
  assert.equal(/vLatLon/.test(BLOC_GRILLE), false, 'la grille du bloc ne se mesure pas en degrés')
})

// ══════════ ④ LE BRANCHEMENT — de la tirette au nuanceur ════════════════════

const val = (v) => ({ value: v })
const couleurStub = (hex) => ({ hex, set(v) { this.hex = v; return this }, getHexString() { return String(this.hex).replace('#', '') } })

function globeStub(crop = RELEVE.crop) {
  return {
    _crop: crop,
    uniforms: {
      uHabOn: val(0), uCoastMask: val(null), uCoastMaskOn: val(0), uMargeCoteM: val(0),
      uSol: val(null), uSolLut: val(null), uSolOn: val(0), uSolOpacite: val(1),
      uSolOffset: val({ set() {} }), uSolScale: val({ set() {} }), uSolTexel: val({ set() {} }),
      uAerial: val(null), uAerialOn: val(0), uAerialOpacity: val(1),
      uAerialOffset: val({ set() {} }), uAerialScale: val({ set() {} }), uAerialCoastFade: val(0),
      uContourInterval: val(500), uContourOpacity: val(0.55), uContourWeight: val(0.7),
      uGridStepM: val(HABILLAGE_MONDE.gridPasM),
      uGridOpacity: val(HABILLAGE_MONDE.gridOpacite),
      uGridColor: val(couleurStub(HABILLAGE_MONDE.gridCouleur)),
      uCropDemiM: val(0),
      uGrainForceM: val(0), uGrainEchelle: val(96), uNormaleFineOn: val(0),
      uAnalysis: val(null), uAnalysisOn: val(0),
      uTexShade: val(0), uWetK: val(0), uExpoK: val(0), uHemi: val(0), uTreeLine: val(0),
      uRampCrop: val(null), uRampCropOn: val(0),
      uHeightContrast: val(0), uHeightPivot: val(0),
      uHazeAmt: val(0), uHazeAlt: val(0), uHazeDist: val(0),
      uHazeColor: val(couleurStub('#ffffff')),
      uEclairageOn: val(0),
      uSoleilDir: val(vecStub()), uSoleilIrr: val(vecStub()),
      uHemiHaut: val(vecStub()), uCielIrr: val(vecStub()), uSolIrr: val(vecStub()),
      uParoiCielIrr: val(vecStub()), uParoiSolIrr: val(vecStub()),
      uAlbedoBase: val(vecStub()), uAlbedoTeinte: val(0),
      uParoiCouleur: val(couleurStub('#d8d4cc')),
      uSurfaceFx: val(0), uFxBlend: val(0), uFxOpacite: val(0), uFxScale: val(1), uFxTime: val(0),
      uFxColA: val(couleurStub('#000000')), uFxColB: val(couleurStub('#000000')), uFxColC: val(couleurStub('#000000')),
      uFxP1: val(0), uFxP2: val(0), uFxP3: val(0),
      uFxDemiBloc: val(28), uFxFenetre: val({ set() {} }),
    },
  }
}
function vecStub() {
  return { x: 0, y: 0, z: 0, set() { return this }, fromArray() { return this }, normalize() { return this }, copy() { return this } }
}
const poserHab = (g, arg) => Globe.prototype.poserHabillage.call(g, arg)
const retirerHab = (g) => Globe.prototype.retirerHabillage.call(g)

test('④a `poserHabillage` CONVERTIT — la tirette entre en unités, l’uniforme sort en mètres', () => {
  const g = globeStub()
  poserHab(g, { gridStepBloc: 5, gridOpacite: 0.4, gridSpanBloc: 56 })
  assert.ok(Math.abs(g.uniforms.uCropDemiM.value - RELEVE.cropDemiM) < 1e-6)
  assert.ok(Math.abs(g.uniforms.uGridStepM.value - RELEVE.pasM_gridStep5) < 1e-6)
  assert.equal(g.uniforms.uGridOpacity.value, 0.4)
  // ⛔ **ET LA VALEUR BRUTE NE PASSE JAMAIS** : c'est la mutation « on oublie la
  // conversion », celle qui a coûté neuf fois sur ce chantier.
  assert.notEqual(g.uniforms.uGridStepM.value, 5)
})

test('④b SANS CROP, LA GRILLE S’ÉTEINT — pas de NaN, pas de pas deviné', () => {
  const g = globeStub(null)
  poserHab(g, { gridStepBloc: 5, gridOpacite: 0.9, gridSpanBloc: 56 })
  assert.equal(g.uniforms.uCropDemiM.value, 0)
  assert.equal(g.uniforms.uGridStepM.value, HABILLAGE_MONDE.gridPasM)
  assert.equal(g.uniforms.uGridOpacity.value, HABILLAGE_MONDE.gridOpacite)
})

test('④c LA TIRETTE À ZÉRO ÉTEINT AUSSI — `pasGrilleBloc` rend `null`, l’opacité suit', () => {
  const g = globeStub()
  poserHab(g, { gridStepBloc: 0, gridOpacite: 1, gridSpanBloc: 56 })
  assert.equal(g.uniforms.uGridOpacity.value, 0, 'une grille de pas nul ne doit pas se peindre')
  assert.equal(g.uniforms.uGridStepM.value, HABILLAGE_MONDE.gridPasM)
})

test('④d `poserHabillage` SANS RIEN DIRE n’allume pas de grille', () => {
  // ⚠️ le patron du fichier : « un poste éteint doit rendre l'image d'avant ».
  const g = globeStub()
  poserHab(g, {})
  assert.equal(g.uniforms.uGridOpacity.value, 0)
  assert.equal(g.uniforms.uGridStepM.value, 0)
})

test('④e `retirerHabillage` REND LES QUATRE — sinon la planète garde le pas d’un crop mort', () => {
  // ⛔ **C'EST LE DÉFAUT EXACT QUE LE TOUR 1 DE LA TÂCHE C A CORRIGÉ SUR
  // `uContourInterval`** : ces uniformes sont PARTAGÉS par toutes les tuiles.
  const g = globeStub()
  poserHab(g, { gridStepBloc: 5, gridOpacite: 0.4, gridCouleur: '#ff0000', gridSpanBloc: 56 })
  retirerHab(g)
  assert.equal(g.uniforms.uGridStepM.value, HABILLAGE_MONDE.gridPasM)
  assert.equal(g.uniforms.uGridOpacity.value, HABILLAGE_MONDE.gridOpacite)
  assert.equal(g.uniforms.uGridColor.value.hex, HABILLAGE_MONDE.gridCouleur)
  assert.equal(g.uniforms.uCropDemiM.value, 0)
})

test('④f LE SPAN DU BLOC VIVANT EST UTILISÉ — pas 56 en dur', () => {
  // ⚠️ en mode continu le bloc couvre plusieurs emprises ; un span figé
  // multiplierait le pas par cette emprise. Même argument que `contourIntervalM`.
  const g = globeStub()
  poserHab(g, { gridStepBloc: 5, gridOpacite: 1, gridSpanBloc: 168 })
  const attendu = pasGrilleBloc({ valeurBloc: 5, largeurSolM: RELEVE.cropDemiM * 2, span: 168 })
  assert.ok(Math.abs(g.uniforms.uGridStepM.value - attendu) < 1e-9)
  assert.notEqual(g.uniforms.uGridStepM.value, RELEVE.pasM_gridStep5)
})

test('④g LA VEILLE SURVEILLE LES QUATRE CHAMPS — sinon la tirette arrive trop tard', () => {
  // ⚠️ un champ absent de `CHAMPS_HABILLAGE` n'est jamais comparé, donc jamais
  // reposé : la grille ne changerait qu'au prochain changement de LIEU.
  for (const champ of ['gridStepBloc', 'gridOpacite', 'gridCouleur', 'gridSpanBloc']) {
    assert.ok(CHAMPS_HABILLAGE.includes(champ), `${champ} n'est pas surveillé`)
  }
  const pose = {}
  for (const c of CHAMPS_HABILLAGE) pose[c] = null
  for (const champ of ['gridStepBloc', 'gridOpacite', 'gridCouleur', 'gridSpanBloc']) {
    assert.equal(habillageDifferent(pose, { ...pose, [champ]: 'autre' }), true, `${champ} bougé SEUL ne repose pas`)
  }
})

test('④h `contexteCrop` LIT LES UNIFORMES DU SOCLE, PAS `params`', () => {
  // ⚠️ `ui/map-panel.js` écrit `terrain.mapUniforms.uGridStep` EN DIRECT, sans
  // repasser par `params` à tous les coups — même règle que les dix curseurs
  // d'Atlas et que l'intervalle des courbes.
  const i = MAIN.indexOf('function contexteCrop')
  assert.ok(i > 0, '`contexteCrop` introuvable')
  const bloc = MAIN.slice(i, MAIN.indexOf('\n}\n', i)).replace(/\/\/[^\n]*/g, ' ')
  assert.match(bloc, /gridStepBloc: terrain\.mapUniforms\.uGridStep\.value/)
  assert.match(bloc, /gridOpacite: terrain\.mapUniforms\.uGridOpacity\.value/)
  assert.match(bloc, /gridCouleur: `#\$\{terrain\.mapUniforms\.uGridColor\.value\.getHexString\(\)\}`/)
  assert.match(bloc, /gridSpanBloc: TERRAIN_SIZE \*/)
  assert.equal(/gridStepBloc: params\./.test(bloc), false, '`params` n’est pas la source de vérité')
})

// ══════════ ⑤ LE PIÈGE DE L’EXAGÉRATION ════════════════════════════════════

test('⑤a LE PAS DE GRILLE N’A PAS D’EXAGÉRATION, L’INTERVALLE DES COURBES EN A UNE', () => {
  // ⚡ **LA MOITIÉ DU DANGER DE CETTE TÂCHE TIENT DANS CE TEST.** Le brief
  // désigne `intervalleCourbesBloc` comme LE modèle à copier ; le copier
  // entièrement aurait porté son `/ exagération` sur une longueur horizontale.
  const SRC = readFileSync(new URL('../src/monde/habillage-crop.js', import.meta.url), 'utf8')
  const i = SRC.indexOf('export function pasGrilleBloc')
  const corps = SRC.slice(i, SRC.indexOf('\n}\n', i))
  assert.equal(/exageration/.test(corps), false, 'le pas de grille ne doit pas voir l’exagération')
  // et la signature elle-même ne l'accepte pas — on ne peut pas la lui passer
  assert.equal(/exageration/.test(SRC.slice(i, SRC.indexOf(')', i))), false)
})

test('⑤b ET LE CHIFFRE DE L’ERREUR ÉVITÉE : le pas 18 fois trop FIN, 201,6 cellules', () => {
  // On rejoue la faute qu'on refuse — passer le pas de grille par la conversion
  // des COURBES, celle que le brief désigne comme modèle. Elle divise par
  // `echelleBloc = (span / L) × exagération`, donc elle rend un pas **18 fois
  // plus court**, pas 18 fois plus long.
  //
  // ⚠️ **ET LE SENS DE L'ERREUR COMPTE : CE N'EST PAS UNE GRILLE DISPARUE, C'EST
  // UNE BOUILLIE.** 201,6 cellules en travers de 27,4 km, soit une ligne tous
  // les 136 m sur un écran où le bloc fait quelques centaines de pixels : les
  // traits se rejoignent en un aplat moiré. C'est mot pour mot ce que
  // `intervalleCourbesBloc` raconte de son propre cas raté (« neuf mille
  // courbes, donc une bouillie, donc rien ») — la même faute, l'autre sens.
  const L = RELEVE.cropDemiM * 2
  const juste = pasGrilleBloc({ valeurBloc: 5, largeurSolM: L, span: 56 })
  const faux = intervalleCourbesBloc({ valeurBloc: 5, extentMeters: L, exageration: 18, span: 56 })
  assert.ok(Math.abs(juste / faux - 18) < 1e-9, `le facteur d’erreur est ${juste / faux}`)
  const cellFausses = cellulesGrilleCrop({ largeurSolM: L, pasM: faux })
  assert.ok(Math.abs(cellFausses - 11.2 * 18) < 1e-9, `${cellFausses}`)
  assert.ok(Math.abs(cellFausses - 201.6) < 1e-9)
  assert.ok(faux < 140, `une ligne tous les ${faux.toFixed(0)} m : illisible`)
})

// ══════════ ⑥ OPTION 48 — « Afficher le socle » ═════════════════════════════

test('⑥a `setParoisVisibles` RETIENT l’état, même sans parois bâties', () => {
  // ⚠️ **C'EST LE CŒUR DU CORRECTIF.** `construireParoisCrop` fabrique un mesh
  // NEUF à chaque déplacement : un `visible = false` posé sur l'ancien serait
  // perdu, et le socle reviendrait tout seul.
  const g = { _parois: null, _paroisVisibles: true }
  Globe.prototype.setParoisVisibles.call(g, false)
  assert.equal(g._paroisVisibles, false)
  const mesh = { visible: true }
  g._parois = mesh
  Globe.prototype.setParoisVisibles.call(g, false)
  assert.equal(mesh.visible, false)
  Globe.prototype.setParoisVisibles.call(g, true)
  assert.equal(mesh.visible, true)
})

test('⑥b LE MESH NEUF PREND L’ÉTAT RETENU — sinon le socle revient au déplacement', () => {
  const i = GLOBE.indexOf('construireParoisCrop({')
  assert.ok(i > 0)
  const corps = GLOBE.slice(i, GLOBE.indexOf('\n  retirerParoisCrop', i))
  assert.match(corps, /mesh\.visible = this\._paroisVisibles/)
  // et l'application vient APRÈS l'ajout au groupe, donc rien ne peut la défaire
  assert.ok(corps.indexOf('this.group.add(mesh)') < corps.indexOf('mesh.visible = this._paroisVisibles'))
})

test('⑥c ON CACHE, ON NE RETIRE PAS — quatre géométries voisines en dépendent', () => {
  // ⛔ `retirerParoisCrop` remet à nul `_baseYCrop`, `_retraitBaseCrop`,
  // `_plancherJupeCrop` et `_retraitJupeCrop` : le rideau d'eau (P4) et les
  // jupes de tuiles (P7, P13, P14) les LISENT. Un réglage d'affichage qui
  // retirerait les parois casserait trois géométries.
  const i = GLOBE.indexOf('setParoisVisibles(v) {')
  assert.ok(i > 0)
  const corps = GLOBE.slice(i, GLOBE.indexOf('\n  }', i))
  assert.equal(/retirerParoisCrop|group\.remove|dispose/.test(corps), false, 'setParoisVisibles ne doit RIEN détruire')
  assert.match(corps, /this\._parois\.visible = this\._paroisVisibles/)
})

test('⑥d `main.js` LE BRANCHE SUR `params.plinth`, ET PAS SUR `vue.socle`', () => {
  // ⛔ **LA DIFFÉRENCE DE FOND** : `vue.socle` dit si le bloc PLAT est dessiné,
  // et il est FAUX sous la sphère. Accrocher les parois de la découpe à lui les
  // aurait éteintes exactement là où on veut les voir.
  const appels = MAIN.match(/globe\?\.setParoisVisibles\?\.\([^)]*\)/g) || []
  assert.equal(appels.length, 2, `${appels.length} sites d’appel, on en veut deux`)
  for (const a of appels) {
    assert.match(a, /!!params\.plinth && !params\.regionMode/)
    assert.equal(/vue\.socle/.test(a), false, 'les parois du crop ne suivent pas `vue.socle`')
  }
  // l'un dans `onPlinthToggled` (le doigt), l'autre dans `poserVisibiliteSocle`
  // (le changement de mode) — deux instants, pas deux copies de la même règle.
  const iToggle = MAIN.indexOf('onPlinthToggled: () => {')
  assert.ok(MAIN.slice(iToggle, iToggle + 1600).includes('globe?.setParoisVisibles?.('))
  const iVue = MAIN.indexOf('function poserVisibiliteSocle(')
  assert.ok(MAIN.slice(iVue, MAIN.indexOf('\n}\n', iVue)).includes('globe?.setParoisVisibles?.('))
})

// ══════════ ⑦ OPTION 50 — « Couleur de la tranche » ════════════════════════

function plinthStub({ isGlass = false, pbrColored = true } = {}) {
  return {
    isGlass,
    _pbrColored: pbrColored,
    wallMat: { color: couleurStub('#c06a44') },
    baseMat: { opacity: 0 },
  }
}
// on n'instancie pas `Plinth` (il bâtit des géométries et des textures) : on
// APPELLE sa méthode sur un porteur minimal, comme les tests d'habillage.
const PLINTH_MOD = await import('../src/plinth.js')
const setColors = (p, params, o) => PLINTH_MOD.Plinth.prototype.setColors.call(p, params, o)

test('⑦a UN CHOIX EXPLICITE BAT LE PRÉRÉGLAGE PBR — c’est le correctif', () => {
  // ⛔ Relevé dans l'application vivante au démarrage : `params.plinthColor =
  // #d8d4cc`, `wallMat.color = #c06a44`. Le curseur écrivait dans une variable
  // que personne ne relisait, et le crop lit le MATÉRIAU.
  const p = plinthStub({ pbrColored: true })
  setColors(p, { plinthColor: '#ff2000' }, { explicite: true })
  assert.equal(p.wallMat.color.hex, '#ff2000')
})

test('⑦b UNE RECOLORATION AUTOMATIQUE NE LE BAT PAS — et c’est la moitié qui reste', () => {
  // ⚠️ `_pbrColored` a été écrit pour qu'un mode sombre ou une teinte dérivée du
  // fond (`derivePlinthColor`) n'écrasent pas une matière choisie exprès. Il a
  // raison ; il traitait seulement le CURSEUR comme un de ces automatismes.
  const p = plinthStub({ pbrColored: true })
  setColors(p, { plinthColor: '#ff2000' })
  assert.equal(p.wallMat.color.hex, '#c06a44', 'une pose automatique ne doit pas battre le préréglage')
})

test('⑦c LE VERRE RESTE EXEMPTÉ, EXPLICITE OU NON', () => {
  // sa couleur de mur est un blanc de base, la teinte vit dans
  // `attenuationColor` (Beer-Lambert) : y poser la couleur du curseur ne
  // changerait rien à l'écran ET repeindrait la paroi du crop.
  const p = plinthStub({ isGlass: true, pbrColored: false })
  setColors(p, { plinthColor: '#ff2000' }, { explicite: true })
  assert.equal(p.wallMat.color.hex, '#c06a44')
})

test('⑦d SANS PRÉRÉGLAGE, RIEN NE CHANGE — le comportement du dépôt, au bit près', () => {
  const p = plinthStub({ pbrColored: false })
  setColors(p, { plinthColor: '#123456' })
  assert.equal(p.wallMat.color.hex, '#123456')
})

test('⑦e LE PANNEAU PASSE `explicite`, ET LES POSES AUTOMATIQUES NON', () => {
  assert.match(CREATE_PANEL, /ctx\.plinth\.setColors\(params, \{ explicite: true \}\)/)
  // ⚠️ `main.js` dérive `params.plinthColor` du fond puis appelle `setColors` :
  // celle-là ne doit JAMAIS être explicite, sinon la teinte automatique
  // écraserait la matière choisie — le défaut que `_pbrColored` existe pour
  // empêcher, retourné.
  for (const appel of MAIN.match(/plinth\.setColors\([^)]*\)/g) || []) {
    assert.equal(/explicite/.test(appel), false, `${appel} ne doit pas être explicite`)
  }
})

test('⑦f LE CURSEUR EST CACHÉ QUAND IL NE PEUT RIEN PEINDRE — attendu n° 2 de R22', () => {
  // ⛔ « Aucun curseur affiché en mode sphère s'il n'agit pas. » Sous une tranche
  // de verre il ne peut rien peindre : on le cache, comme « Épaisseur des
  // courbes » en mode sombre.
  assert.match(CREATE_PANEL, /visibleWhen\(rangeeCouleurTranche, \(\) => params\.plinthFinish !== 'glass'\)/)
})

test('⑦g LE CROP LIT TOUJOURS LE MATÉRIAU, JAMAIS `params` — la règle ne bouge pas', () => {
  const i = MAIN.indexOf('function contexteCrop')
  const bloc = MAIN.slice(i, MAIN.indexOf('\n}\n', i))
  assert.match(bloc, /paroiCouleur: `#\$\{plinth\.wallMat\.color\.getHexString\(\)\}`/)
  assert.equal(/paroiCouleur:\s*params\.plinthColor/.test(bloc), false)
  // et `setColors` reste le SEUL endroit qui décide — pas une seconde loi
  assert.equal((PLINTH.match(/setColors\(params/g) || []).length, 1)
})

// ══════════ ⑧ L’INTERFACE NE MENT PLUS ═════════════════════════════════════

test('⑧a LA NOTE « la grille du bloc n’existe pas » A DISPARU', () => {
  // ⚠️ elle était VRAIE au mot près jusqu'à cette tâche. Elle ne l'est plus, et
  // une note fausse est pire qu'une absence de note.
  assert.equal(/la grille du bloc n’existe pas/.test(MAP_PANEL), false)
  assert.equal(/n’ont pas d’effet visible/.test(MAP_PANEL), false)
  assert.equal(/ce-bg-note/.test(MAP_PANEL), false, 'plus aucune note de panne dans « Courbes & grille »')
})

test('⑧b LES DEUX CURSEURS RESTENT AFFICHÉS, ET SANS MARQUE D’ÉTAPE', () => {
  assert.match(MAP_PANEL, /label: 'Taille de la grille'/)
  assert.match(MAP_PANEL, /label: 'Opacité de la grille'/)
  const iGrille = MAP_PANEL.indexOf("label: 'Taille de la grille'")
  assert.equal(/marqueEtape/.test(MAP_PANEL.slice(iGrille - 400, iGrille)), false)
})
