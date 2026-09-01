// LE BRANCHEMENT — Tâche 6 bis du plan « globe continu »
// (`docs/superpowers/plans/2026-08-08-globe-continu.md`).
//
// ══════════ CE QUE CE FICHIER GARDE ════════════════════════════════════════
//
//   ① ⚠️ **LE PIÈGE PRINCIPAL, ET IL A DÉJÀ MORDU DEUX FOIS SUR CE DÉPÔT** :
//      un réglage écrit d'un côté et jamais transmis à l'autre. Les DOUZE
//      lecteurs de l'exagération (`terrain.js` ×5, `ocean.js` ×2, `gpx.js`,
//      `main.js` ×4) doivent lire **le même partage, au même instant**. Le test
//      ①a **échoue si un seul d'entre eux relit `params.demExaggeration`**, et
//      le test ①b prouve que le repli n'est pas ce qui les fait passer ;
//   ② LA CALIBRATION DU PILOTE — `zoomCadrage` rend **exactement** le zoom du
//      bloc à la pose d'arrivée, pour z de 3 à 15. C'est ce qui fait qu'AU
//      REPOS Adrien retrouve sa table, surcharges comprises ;
//   ③ ⚠️ **LE POINT FIXE, MESURÉ** — le pilote ne doit PAS lire l'exagération,
//      sans quoi `exag → altitude → zoom → exag` boucle avec un gain de 1,44 et
//      diverge. Le test le montre en chiffres, sur la vraie courbe ;
//   ④ LA MESURE DE CONTRÔLE DE LA DÉCISION 14 — le rapport d'exagération au
//      cran z4 → z5 : **×2,0000 avant, ×1,0000 après** ;
//   ⑤ LE CHEMIN DE PRODUCTION INTACT — drapeau éteint, `poserExageration` rend
//      la valeur d'`exagForZoom` au bit près, surcharges comprises ;
//   ⑥ LES MUTATIONS — remettre un lecteur sur `params.demExaggeration` tue ①a ;
//      piloter par une grandeur qui contient l'exagération tue ③ ; retirer le
//      recalage de `zoomCadrage` tue ② ;
//   ⑦ LA RÈGLE DU MODULE — `exageration-continue.js` **n'importe rien**, et
//      c'est ce qui évite le cycle `terrain.js → fenetre-bornee.js →
//      terrain.js` qui ne se serait vu qu'en production.
//
// ⚠️ **CE QUE CE FICHIER NE GARDE PAS, ET IL FAUT LE DIRE** : la fenêtre n'est
// PAS branchée à la place du bloc — voir le bilan de la tâche dans le plan. Les
// Étapes 1, 2 et 5 du plan (« un changement de cran ne reconstruit aucune
// géométrie ») portent sur ce branchement-là et vivent avec lui.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import {
  lireExageration,
  poserExageration,
  creerExagerationPartagee,
  majExagerationCadrage,
  zoomCadrage,
  courbeExageration,
  exagPalier,
  surchargesStockees,
  EXAG_ANCRES,
  EXAG_BASE,
  MPP_Z0,
  PX_BLOC,
} from '../src/monde/exageration-continue.js'
import { blockExtentMeters } from '../src/landmarks.js'
import { distanceArrivee, DISTANCE_MAX_SURFACE } from '../src/loi-altitude.js'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const lire = (rel) => readFileSync(join(RACINE, rel), 'utf8')

// ══════════ L'OUTIL : LIRE LE CODE SANS SES COMMENTAIRES ═══════════════════
//
// ⚠️ **SANS CE DÉPOUILLEMENT LE TEST SERAIT UN DÉCOR.** Les quatre fichiers
// PARLENT de `params.demExaggeration` dans des commentaires qui expliquent
// justement pourquoi on ne le lit plus : un `grep` nu les compterait comme des
// lecteurs et le test échouerait pour la mauvaise raison — ou, pire, on
// supprimerait les commentaires pour le faire passer.
function sansCommentaires (src) {
  let out = ''
  let i = 0
  let etat = 'code' // code | ligne | bloc | guillemet | gabarit
  let delim = ''
  while (i < src.length) {
    const c = src[i]
    const d = src[i + 1]
    if (etat === 'code') {
      if (c === '/' && d === '/') { etat = 'ligne'; i += 2; continue }
      if (c === '/' && d === '*') { etat = 'bloc'; i += 2; continue }
      if (c === '"' || c === "'") { etat = 'guillemet'; delim = c; out += c; i++; continue }
      if (c === '`') { etat = 'gabarit'; out += c; i++; continue }
      out += c; i++; continue
    }
    if (etat === 'ligne') { if (c === '\n') { etat = 'code'; out += '\n' } i++; continue }
    if (etat === 'bloc') { if (c === '*' && d === '/') { etat = 'code'; i += 2; continue } if (c === '\n') out += '\n'; i++; continue }
    if (etat === 'guillemet') { if (c === '\\') { out += src.slice(i, i + 2); i += 2; continue } if (c === delim) etat = 'code'; out += c; i++; continue }
    // gabarit
    if (c === '\\') { out += src.slice(i, i + 2); i += 2; continue }
    if (c === '`') etat = 'code'
    out += c; i++
  }
  return out
}

/**
 * Les lectures DIRECTES de `params.demExaggeration` dans un CODE déjà dépouillé
 * de ses commentaires. ⚠️ **Une AFFECTATION n'est pas une lecture** : c'est
 * l'écrivain, et il a le droit d'exister — il n'y en a qu'un.
 */
function lecturesDansCode (code, etiquette = '') {
  const trouvees = []
  const re = /(^|[^\w$.])((?:this\.)?params)\s*\.\s*demExaggeration\s*(={1,3}|[^=])/g
  let m
  while ((m = re.exec(code))) {
    if (m[3] === '=') continue // affectation simple : l'écrivain
    const ligne = code.slice(0, m.index).split('\n').length
    trouvees.push(etiquette ? `${etiquette}:${ligne}` : `ligne ${ligne}`)
  }
  return trouvees
}

/** Le même, sur un fichier du dépôt. */
function lecturesDirectes (rel) {
  return lecturesDansCode(sansCommentaires(lire(rel)), rel)
}

// ⚠️ **ON ÉLARGIT CETTE LISTE, ON NE LA REMPLACE JAMAIS.** Elle s'appelle
// `LES_QUATRE` parce qu'elle en portait quatre ; la Tâche E (plan « UNE SEULE
// TERRE ») y ajoute `src/globe.js`, qui cesse d'avoir sa propre exagération
// verticale. **Le nom reste** : le renommer ferait sortir du document les
// références qui le citent, et c'est l'accident que le §0 du plan interdit.
const LES_QUATRE = ['src/terrain.js', 'src/ocean.js', 'src/gpx.js', 'src/main.js', 'src/globe.js']

// ══════════ ① LE PIÈGE PRINCIPAL : UN SEUL RÉGLAGE, DOUZE LECTEURS ═════════

test('①a aucun des douze lecteurs ne lit encore `params.demExaggeration`', () => {
  const restants = LES_QUATRE.flatMap(lecturesDirectes)
  assert.deepEqual(
    restants,
    [],
    `Ces lectures court-circuitent le partage — elles liront une valeur périmée dès que l'exagération bougera :\n  ${restants.join('\n  ')}`,
  )
})

test('①b les treize passent par `lireExageration`, et le compte est celui du plan', () => {
  // ⚠️ **LE COMPTE EST UNE ASSERTION, PAS UNE STATISTIQUE.** Le plan disait
  // douze (`terrain.js` ×5, `ocean.js` ×2, `gpx.js` ×1, `main.js` ×4) ; si un
  // de plus apparaît sans passer par ici, ce test le dit.
  // ⚠️ **LE TREIZIÈME EST ARRIVÉ AVEC LA TÂCHE 6 ter, ET IL EST LÉGITIME** :
  // `terrain.fabriqueFenetre` (`main.js`) passe l'exagération à
  // `construireFenetre`, sans quoi la fenêtre bornée aurait sa PROPRE échelle
  // verticale — exactement le réglage écrit d'un côté et jamais transmis à
  // l'autre que ce fichier existe pour interdire. Le compte de `main.js` passe
  // donc de 4 à 5, EN PLACE : les trois autres n'ont pas bougé d'un caractère.
  // ⚠️ **ET LE QUATORZIÈME EST ARRIVÉ AVEC LA TÂCHE 6 quinquies, POUR LA MÊME
  // RAISON, ET CE TEST L'A ATTRAPÉ À LA PREMIÈRE EXÉCUTION** : `recadrerFenetre`
  // (`terrain.hauteursDeFlux`, `main.js`) repose la fenêtre sur l'emprise du
  // cadrage courant, et l'exagération en fait partie — elle change à CHAQUE
  // cran (`syncExagToZoom`). Sans elle, le socle garderait l'échelle verticale
  // du premier zoom pour toujours. Le compte de `main.js` passe de 5 à 6, EN
  // PLACE ; les trois autres lignes n'ont toujours pas bougé d'un caractère.
  // ⚠️ **ET LA TÂCHE 6 septies EN A RETIRÉ UN, PAS AJOUTÉ — C'EST LA SEULE
  // BAISSE DE CE COMPTE, ET ELLE A SA RAISON.** Les deux lectures nées avec les
  // Tâches 6 ter et 6 quinquies (`fabriqueFenetre` et `hauteursDeFlux`) posaient
  // CHACUNE sa liste de réglages de fenêtre ; elles passent désormais toutes
  // deux par `cadrageFenetre()`, l'écrivain unique, qui lit l'exagération UNE
  // fois. Deux listes de réglages ne peuvent plus diverger au premier réglage
  // ajouté. Le compte de `main.js` revient donc de 6 à 5, EN PLACE ; les trois
  // autres lignes n'ont toujours pas bougé d'un caractère.
  // ⚠️ **ET LE QUATORZIÈME ET LE QUINZIÈME SONT ARRIVÉS AVEC LA TÂCHE E, DANS
  // `src/globe.js`, ET ILS SONT LÉGITIMES.** Le globe portait sa PROPRE échelle
  // verticale — `params.globeExaggeration ?? 18` contre `BASE_EXAG = 2,8` pour
  // le socle, **facteur 6,4** — et c'est ce qui faisait « deux Terres » (§3 du
  // plan « UNE SEULE TERRE »). Il en a **deux** : le constructeur, qui doit
  // naître à la bonne échelle plutôt que sauter à la première image, et
  // `majExageration`, l'entrée que `syncExagToZoom` appelle. Les quatre autres
  // lignes n'ont pas bougé d'un caractère.
  // ⚠️ **ET LE SEIZIÈME EST ARRIVÉ AVEC LA TÂCHE D16-b, ET C'EST EXACTEMENT
  // POUR CETTE RAISON-LÀ QU'IL PASSE PAR ICI.** Le poseur des calques de
  // carte (`mapLayers.poserFabricantDePoseur`, `main.js`) convertit les mètres
  // du globe en unités de bloc : `(span / extentMeters) × exagération`. C'est
  // la formule de `terrain._makeDemSampler`, et elle DOIT lire la même
  // exagération que lui — une valeur figée y poserait les rivières et les
  // toponymes à une autre altitude que le relief qu'ils drapent, au facteur
  // `exagAvant / exagApres`. Le compte de `main.js` passe de 5 à 6, EN PLACE ;
  // les quatre autres lignes n'ont pas bougé d'un caractère.
  // ⚠️ **ET LE DIX-SEPTIÈME EST ARRIVÉ AVEC LA TÂCHE R18, POUR LA MÊME RAISON
  // EXACTEMENT QUE LE SEIZIÈME.** Les SOMMETS (`peaksLayer`) sont projetés sous
  // la sphère à travers le même adaptateur bloc ↔ globe que les rivières et les
  // toponymes (`poseurDesReperes`, `main.js`) : il lui faut la même `echelleBloc`,
  // donc la même exagération VIVANTE. Une valeur figée poserait les repères de
  // sommet à une autre altitude que le relief qu'ils désignent, au facteur
  // `exagAvant / exagApres` — c'est la classe de défaut n° 1 de ce chantier
  // (SEPT conversions ratées, dont un facteur 121,6). Le compte de `main.js`
  // passe de 6 à 7, EN PLACE ; les quatre autres lignes n'ont pas bougé d'un
  // caractère.
  // ⚠️ **ET LE DIX-HUITIÈME EST ARRIVÉ AVEC LA TÂCHE R19, POUR LA MÊME RAISON
  // ENCORE.** La tirette « Intervalle des courbes » est en unités de BLOC et le
  // nuanceur du globe compare des MÈTRES : `contexteCrop` (`main.js`) la
  // convertit par `intervalleCourbesBloc`, dont le facteur est
  // `(span / extentMeters) × exagération` — la loi de hauteur du socle. Une
  // exagération FIGÉE y donnerait des courbes espacées d'un autre pas que le
  // relief qu'elles dessinent, au facteur `exagAvant / exagApres`, et le crop
  // et le socle cesseraient de tracer les mêmes lignes. Le compte de `main.js`
  // passe de 7 à 8, EN PLACE ; les quatre autres lignes n'ont pas bougé d'un
  // caractère.
  // ⚠️ **ET LE DIX-NEUVIEME EST ARRIVE AVEC LA TACHE R25, POUR LA RAISON DU
  // DIX-HUITIEME, MOT POUR MOT.** La bascule « Au-dessus du niveau zero » pose
  // au socle une demi-bande de fondu de 0,05 UNITE DE SCENE, sur un relief deja
  // exagere ; le nuanceur du globe compare des METRES et son niveau de la mer
  // vaut 0. `matiereDuCrop` (`main.js`) la convertit par `bandeZeroMatiereM`,
  // dont le facteur est `(span / extentMeters) × exagération` — la MÊME loi de
  // hauteur que l'intervalle des courbes, et le test `②` de
  // `matiere-sphere.test.js` vérifie que les deux fonctions rendent la MÊME
  // valeur sur la même entrée. Une exagération FIGÉE y donnerait une bande
  // fausse du facteur `exagAvant / exagApres` : à exagération 2 elle vaut
  // **12,21 m**, à exagération 4 elle vaut **6,11 m**. Le compte de `main.js`
  // passe de 8 à 9, EN PLACE ; les quatre autres lignes n'ont pas bougé d'un
  // caractère.
  const attendu = { 'src/terrain.js': 5, 'src/ocean.js': 2, 'src/gpx.js': 1, 'src/main.js': 9, 'src/globe.js': 2 }
  const vus = {}
  for (const f of LES_QUATRE) {
    const code = sansCommentaires(lire(f))
    vus[f] = (code.match(/lireExageration\s*\(/g) || []).length
  }
  assert.deepEqual(vus, attendu)
})

test('①c le partage est bien UN SEUL objet : bouger sa valeur bouge les douze lectures', () => {
  const partage = creerExagerationPartagee()
  // les douze lecteurs reçoivent des OBJETS `params` différents (`terrain.js`
  // reçoit le sien, `block-grid.js:1133` en fabrique une COPIE par étalement,
  // `gpx.js` garde le sien sous `this.params`) — ce qu'ils partagent, c'est
  // l'objet `exagPartage`, et c'est exactement ce qu'on vérifie ici.
  const p1 = { demExaggeration: 2.8, exagPartage: partage }
  const p2 = { ...p1 } // la copie de `block-grid.js`
  const p3 = { demExaggeration: 99, exagPartage: partage } // un `params` périmé
  poserExageration(partage, 4.25)
  assert.equal(lireExageration(p1), 4.25)
  assert.equal(lireExageration(p2), 4.25)
  assert.equal(lireExageration(p3), 4.25, 'le partage doit primer sur un `demExaggeration` périmé')
})

test('①d MUTATION — remettre un lecteur sur `params.demExaggeration` tue ①a', () => {
  // On rejoue le détecteur de ①a sur des sources SABOTÉES, sans toucher au
  // dépôt. ⚠️ **C'est la seule façon de savoir que ①a mord** : un test qui
  // passe sur un dépôt propre ne dit rien tant qu'on ne l'a pas vu échouer.
  assert.equal(lecturesDansCode('const scale = (span / dem.ext) * params.demExaggeration\n').length, 1)
  assert.equal(lecturesDansCode('const exag = this.params.demExaggeration\n').length, 1)
  assert.equal(lecturesDansCode('exagerationV: params.demExaggeration || 1,\n').length, 1)
  // …et il ne mord PAS sur l'écrivain, le seul autorisé
  assert.equal(lecturesDansCode('params.demExaggeration = 2.5\n').length, 0)
  // …ni sur une comparaison, ni sur une propriété homonyme d'un autre objet
  assert.equal(lecturesDansCode('if (L.demExaggeration != null) {}\n').length, 0)
})

test('①e le détecteur ignore les commentaires, et c\'est vérifié', () => {
  const avecCommentaire = '// on ne lit plus params.demExaggeration\nconst a = 1\n'
  assert.equal(sansCommentaires(avecCommentaire).includes('demExaggeration'), false)
  const avecBloc = '/* params.demExaggeration */\nconst a = 1\n'
  assert.equal(sansCommentaires(avecBloc).includes('demExaggeration'), false)
  // …mais PAS le vrai code
  assert.equal(sansCommentaires('const a = params.demExaggeration\n').includes('demExaggeration'), true)
})

// ══════════ ② LA CALIBRATION — AU REPOS, LA TABLE D'ADRIEN EST INTACTE ═════

test('② `zoomCadrage` rend EXACTEMENT le zoom du bloc à la pose d\'arrivée', () => {
  const dRef = distanceArrivee(DISTANCE_MAX_SURFACE)
  assert.equal(dRef, 141, 'la pose d\'arrivée du dépôt vaut 141 unités (loi-altitude.js:123)')
  for (let z = 3; z <= 15; z++) {
    for (const lat of [0, 45, 45.9, -33.9, 60]) {
      const ext = blockExtentMeters(z, lat)
      const zc = zoomCadrage({ distance: dRef, distanceReference: dRef, extentMeters: ext, lat })
      assert.ok(Math.abs(zc - z) < 1e-12, `z=${z} lat=${lat} → ${zc}`)
    }
  }
})

test('②b et la courbe y rend donc la valeur d\'AUJOURD\'HUI, surcharges comprises', () => {
  const surcharges = { 5: 3.9, 9: 1.75 } // deux surcharges d'Adrien, inventées pour le test
  const partage = creerExagerationPartagee({ surcharges })
  const dRef = distanceArrivee(DISTANCE_MAX_SURFACE)
  for (let z = 3; z <= 12; z++) {
    const v = majExagerationCadrage(partage, {
      distance: dRef,
      distanceReference: dRef,
      extentMeters: blockExtentMeters(z, 45.9),
      lat: 45.9,
    })
    const attendu = exagPalier(z, { surcharges })
    assert.ok(Math.abs(v - attendu) < 1e-9, `z=${z} : ${v} au lieu de ${attendu}`)
  }
})

test('②c MUTATION — retirer le recalage sur la pose d\'arrivée tue ②', () => {
  // `zoomCadrage` sans le facteur `dRef` (c\'est-à-dire le zoom métrique nu)
  const nu = (ext, lat) => Math.log2((MPP_Z0 * Math.cos((lat * Math.PI) / 180) * PX_BLOC) / (distanceArrivee(DISTANCE_MAX_SURFACE) * ext))
  const ecart = nu(blockExtentMeters(10, 45), 45) - 10
  // ⚠️ **ET L'ÉCART EST MESURÉ, PAS AFFIRMÉ** : sans recalage la courbe serait
  // lue 7,14 niveaux à côté, donc `EXAG_BASE` partout au lieu de la table.
  assert.ok(Math.abs(ecart) > 1, `sans recalage l'écart vaut ${ecart} — s'il était nul, ② ne prouverait rien`)
})

// ══════════ ③ LE POINT FIXE — POURQUOI LE PILOTE EST HORIZONTAL ════════════

test('③ le pilote ne lit JAMAIS l\'exagération — et la boucle qu\'on évite diverge', () => {
  // (a) la preuve statique : la signature n'a pas d'entrée d'exagération, et le
  //     corps du module ne divise par aucune échelle verticale.
  const src = sansCommentaires(lire('src/monde/exageration-continue.js'))
  const corps = src.slice(src.indexOf('export function zoomCadrage'))
  const fin = corps.indexOf('\n}')
  assert.equal(/exag/i.test(corps.slice(0, fin)), false, '`zoomCadrage` ne doit pas voir l\'exagération')

  // (b) la preuve chiffrée : si on la lui donnait — `altitude = camY / (échelle
  //     × exag)`, la formule d'`altitudeCadrageM` (`main.js:3545`) — le gain de
  //     la boucle dépasse 1 entre z4 et z5, donc elle DIVERGE.
  const courbe = courbeExageration()
  const h = 1e-6
  let gainMax = 0
  for (let z = 4; z <= 5; z += 0.01) {
    const derivee = (courbe(z + h) - courbe(z - h)) / (2 * h)
    const gain = Math.abs(derivee / (Math.LN2 * courbe(z)))
    if (gain > gainMax) gainMax = gain
  }
  assert.ok(gainMax > 1, `gain de boucle mesuré ${gainMax.toFixed(3)} — s'il était < 1 la parade serait inutile`)

  // (c) et l'itération le montre pour de vrai : partie de deux valeurs
  //     voisines, la boucle fermée s'ÉCARTE au lieu de converger.
  const boucle = (exag0, n) => {
    let e = exag0
    for (let k = 0; k < n; k++) {
      // camY figé : le zoom apparent monte quand l'exagération monte
      const zApparent = 4.5 + Math.log2(e / 3.75)
      e = courbe(Math.min(5, Math.max(4, zApparent)))
    }
    return e
  }
  const ecartAvant = 0.02
  const ecartApres = Math.abs(boucle(3.75 + ecartAvant, 12) - boucle(3.75 - ecartAvant, 12))
  assert.ok(ecartApres > 2 * ecartAvant, `la boucle fermée devrait diverger : ${ecartAvant} → ${ecartApres}`)
})

// ══════════ ④ LA MESURE DE CONTRÔLE DE LA DÉCISION 14 ══════════════════════

test('④ le cran z4 → z5 : ×2,0000 avant, ×1 après', () => {
  const avant = exagPalier(5) / exagPalier(4)
  assert.equal(avant, 2, 'la table d\'aujourd\'hui double bel et bien au cran z4 → z5')

  // APRÈS : au cran, la caméra ne bouge pas — c'est `params.demZoom` qui change.
  // Le pilote, lui, ne connaît que la géométrie : `d` et `extentMeters`. Or au
  // cran `extentMeters` est DIVISÉ PAR DEUX et la caméra est reposée à la pose
  // d'arrivée, donc `d` est multiplié par deux : le zoom de cadrage est
  // INCHANGÉ, et l'exagération avec lui.
  const lat = 45.9
  const dRef = distanceArrivee(DISTANCE_MAX_SURFACE)
  const partage = creerExagerationPartagee()
  const avantCran = majExagerationCadrage(partage, { distance: dRef, distanceReference: dRef, extentMeters: blockExtentMeters(4, lat), lat })
  const apresCran = majExagerationCadrage(partage, { distance: dRef * 2, distanceReference: dRef, extentMeters: blockExtentMeters(5, lat), lat })
  const rapport = apresCran / avantCran
  assert.ok(Math.abs(rapport - 1) < 1e-12, `rapport au cran = ${rapport} (attendu 1)`)

  // ⚠️ **ET LE CONTRE-TEST, SANS QUOI ④ NE PROUVE RIEN** : le même geste sur la
  // table en escalier rend bien 2. C'est la seule façon de savoir que la
  // mesure porte sur ce qui change.
  assert.equal(exagPalier(5) / exagPalier(4), 2)
})

test('④b et entre deux crans la valeur GLISSE au lieu de sauter', () => {
  // 45 s à 60 Hz de z4 à z5 — le pas du plan, 0,003705 zoom par image.
  const courbe = courbeExageration()
  const pas = (5 - 4) / 270
  let sautMax = 1
  for (let z = 4; z < 5; z += pas) {
    const r = courbe(z + pas) / courbe(z)
    if (r > sautMax) sautMax = r
  }
  assert.ok(sautMax < 1.01, `le plus gros saut d'une image à l'autre vaut ×${sautMax.toFixed(6)}`)
  // et il n'est PAS nul : la courbe monte vraiment de 2,5 à 5.
  assert.ok(sautMax > 1.001, `×${sautMax.toFixed(6)} — une courbe plate ne serait pas la décision 14`)
})

// ══════════ ⑤ LE CHEMIN DE PRODUCTION, INTACT AU BIT PRÈS ══════════════════

test('⑤ drapeau éteint : `poserExageration` rend exactement `exagForZoom`', () => {
  const magasin = { 6: 3.33 }
  const exagForZoom = (z) => magasin[z] ?? EXAG_ANCRES[z] ?? EXAG_BASE // `main.js:3138`
  const partage = creerExagerationPartagee({ surcharges: magasin })
  for (let z = 0; z <= 16; z++) {
    poserExageration(partage, exagForZoom(z))
    assert.equal(lireExageration({ exagPartage: partage }), exagForZoom(z), `z=${z}`)
  }
})

test('⑤b les surcharges d\'Adrien survivent — `localStorage` sous `monolith.zoomExag`', () => {
  const faux = { getItem: (k) => (k === 'monolith.zoomExag' ? '{"5":3.9,"7":1.2,"x":9,"8":-1}' : null) }
  const s = surchargesStockees(faux)
  assert.deepEqual(s, { 5: 3.9, 7: 1.2 }, 'les clés non entières et les valeurs ≤ 0 sont écartées')
  const partage = creerExagerationPartagee({ surcharges: s })
  const dRef = distanceArrivee(DISTANCE_MAX_SURFACE)
  const v = majExagerationCadrage(partage, { distance: dRef, distanceReference: dRef, extentMeters: blockExtentMeters(5, 45), lat: 45 })
  assert.ok(Math.abs(v - 3.9) < 1e-9, `la surcharge z5 = 3,9 doit primer sur l'ancre 5 — reçu ${v}`)
})

// ══════════ ⑥ LES RECOPIES, GARDÉES CONTRE LA SOURCE ═══════════════════════
//
// ⚠️ **§1 DE `/threejs-optimisation`, QUESTION 2 : « les constantes du fichier
// sont-elles dupliquées ailleurs ? »** Elles le sont — `main.js` n'exporte ni
// `BASE_EXAG` ni `ZOOM_EXAG_DEFAULTS`, et aucun test ne peut charger `main.js`.
// Ces trois assertions sont ce qui empêche les copies de diverger en silence,
// exactement comme `camera-continue.test.js` le fait déjà pour
// `loi-altitude.js`. ⚠️ **On ÉLARGIT cette garde, on ne la remplace pas.**

test('⑥ `EXAG_BASE` est bien le `demExaggeration` du boot de `main.js`', () => {
  const m = /\n\s*demExaggeration:\s*([0-9.]+)\s*,/.exec(sansCommentaires(lire('src/main.js')))
  assert.ok(m, 'la valeur de boot a disparu de `params` — ou elle a changé de forme')
  assert.equal(Number(m[1]), EXAG_BASE, '`main.js` et `exageration-continue.js` ont divergé')
})

test('⑥b la table des ancres est la même des deux côtés', () => {
  const src = sansCommentaires(lire('src/main.js'))
  const m = /ZOOM_EXAG_DEFAULTS\s*=\s*(\{[^}]*\})/.exec(src)
  assert.ok(m, '`ZOOM_EXAG_DEFAULTS` a disparu de `main.js`')
  // eslint-disable-next-line no-new-func
  const table = new Function(`return ${m[1]}`)()
  assert.deepEqual(table, EXAG_ANCRES)
  const b = /BASE_EXAG\s*=\s*([0-9.]+)/.exec(src)
  assert.ok(b && Number(b[1]) === EXAG_BASE, '`BASE_EXAG` a divergé')
})

test('⑥c `params.demExaggeration` est un ACCESSEUR sur le partage, pas un champ', () => {
  // ⚠️ **C'est ce qui rend impossible d'oublier un écrivain.** Ils sont au
  // moins cinq et dispersés (`syncExagToZoom`, le curseur de
  // `ui/create-panel.js:419`, les `Object.assign(params, look)` des gabarits, la
  // restauration de lien partagé, `SHIBU_START`). Un seul emplacement de
  // stockage, donc aucun oubli possible.
  const src = sansCommentaires(lire('src/main.js'))
  assert.ok(/Object\.defineProperty\(params,\s*'demExaggeration'/.test(src))
  assert.ok(/get:\s*\(\)\s*=>\s*exagPartage\.valeur/.test(src))
  assert.ok(/set:\s*\(v\)\s*=>\s*\{\s*poserExageration\(exagPartage,\s*v\)\s*\}/.test(src))
  // et le curseur de l'interface écrit bien dessus (il n'a donc rien à savoir)
  assert.ok(/params\.demExaggeration\s*=\s*/.test(sansCommentaires(lire('src/ui/create-panel.js'))))
})

test('⑥d le régime continu est DERRIÈRE SON PROPRE drapeau, et le bloc reste pour la production', () => {
  const src = sansCommentaires(lire('src/main.js'))
  const i = src.indexOf('function syncExagToZoom')
  assert.ok(i > 0)
  const corps = src.slice(i, src.indexOf('\n}', i))
  // ⚠️ **`exagContinueActive` ET NON `globeContinuActif`, ET C'EST UNE MESURE À
  // L'ÉCRAN QUI L'A EXIGÉ** — voir le tableau des deux descentes Z12 → Z4 dans
  // `flags.js`. Adossé à `globeContinu`, le régime continu aurait aplati la
  // table d'Adrien à ×2,8 partout sous le drapeau qu'on lui demande d'ouvrir.
  assert.ok(/exagContinueActive\(\)/.test(corps), 'le régime continu doit avoir son propre drapeau')
  assert.ok(/exagForZoom\(params\.demZoom\)/.test(corps), 'le chemin du bloc doit rester intact')
})

test('⑥e et ce drapeau est ÉTEINT — un régime mesuré faux ne part pas en production', () => {
  const src = sansCommentaires(lire('src/flags.js'))
  assert.match(src, /exagContinue:\s*false/, 'la mesure Z12 → Z4 interdit de le mettre à true')
  assert.match(src, /export function exagContinueActive/)
  // et l'échappatoire d'adresse existe, sinon personne ne pourra le revoir
  assert.match(src, /paramAdresse\('exag'\)/)
})

// ══════════ ⑦ LA RÈGLE DU MODULE : IL N'IMPORTE RIEN ═══════════════════════

test('⑦ `exageration-continue.js` n\'importe rien — sinon le cycle revient', () => {
  const code = sansCommentaires(lire('src/monde/exageration-continue.js'))
  const imports = code.match(/^\s*import\s/gm) || []
  assert.deepEqual(imports, [], 'un seul import ici rouvre le cycle terrain.js → fenetre-bornee.js → terrain.js')
})

test('⑦b et `fenetre-bornee.js` ré-exporte la même chose, donc rien n\'est perdu', async () => {
  const fb = await import('../src/monde/fenetre-bornee.js')
  const ec = await import('../src/monde/exageration-continue.js')
  for (const nom of ['exagPalier', 'courbeExageration', 'exagerationContinue', 'altitudeDepuisZoom', 'zoomDepuisAltitude', 'creerExagerationPartagee', 'majExageration', 'surchargesStockees', 'EXAG_BASE', 'EXAG_ANCRES', 'CLE_EXAG', 'FOV_DEG', 'FRACTION_REFERENCE', 'ZOOM_EXAG_MAX']) {
    assert.equal(fb[nom], ec[nom], `${nom} doit être LE MÊME objet des deux côtés`)
  }
})

// ════════════════════════════════════════════════════════════════════════════
// ⑧ LA FENÊTRE À LA PLACE DU BLOC — Tâche 6 ter
// ════════════════════════════════════════════════════════════════════════════
//
// ⚠️ **C'EST LE TEST QUI COMPTE POUR ADRIEN : un changement de cran ne
// reconstruit AUCUNE géométrie.** Il a été REJOUÉ CONTRE LE DÉPÔT avant d'être
// écrit (`.banc/rejeu-cran.mjs`, hors dépôt) : sur le chemin de production,
// après un cran, `geometry`, `position.array`, `normal.array` et `color.array`
// sont TOUS des objets neufs. ⑧a garde ce constat comme témoin — sans lui, ⑧b
// pourrait passer sur un dépôt où plus rien ne se reconstruirait, et personne ne
// le saurait.
//
// ⚠️ **ET ⑧c EST L'AUTRE MOITIÉ** : ne rien réallouer ne sert à rien si l'image
// change. Les deux chemins doivent peindre le MÊME bloc, attribut par attribut.

const PARAMS_TERRAIN = {
  color: '#888888', envMapIntensity: 1, mapTint: 1, contourInterval: 100,
  contourOpacity: 0.3, contourWeight: 0.7, gridStep: 10, gridOpacity: 0.2,
  heightContrast: 1, heightPivot: 0.5, slopeTint: 0.3, contourColor: '#000000',
  gradLow: '#eeeecc', gradMid1: '#88aa66', gradMid2: '#aa8855', gradHigh: '#ffffff',
  source: 'real', resolution: 64, seed: 7, demExaggeration: 2.8, detail: 0.5,
}

/** Un MNT bouchon — le CRAN, c'est le même centre à un `metersPerPixel` plus fin. */
function demBouchon (size, mpp) {
  const data = new Float32Array(size * size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) data[y * size + x] = 700 * Math.sin(x / 9) + 400 * Math.cos(y / 7) + 30 * Math.sin(x * 2.3 + y * 1.7)
  }
  let min = Infinity
  let max = -Infinity
  let s = 0
  for (const v of data) { if (v < min) min = v; if (v > max) max = v; s += v }
  return { data, size, metersPerPixel: mpp, extentMeters: mpp * size, minM: min, maxM: max, meanM: s / data.length, empriseCote: 1 }
}

async function terrainDeBanc (globeContinu) {
  const { Terrain } = await import('../src/terrain.js')
  const { construireFenetre } = await import('../src/monde/fenetre-bornee.js')
  const { empriseSocle } = await import('../src/monde/seuil-socle.js')
  const p = { ...PARAMS_TERRAIN, globeContinu }
  const t = new Terrain(p)
  // ⚠️ EXACTEMENT la fabrique de `main.js` — `rayonCoin: 0`, et rien d'autre.
  t.fabriqueFenetre = (n) => construireFenetre({
    emprise: empriseSocle({ centre: { lat: 45.8326, lon: 6.8652 }, zoom: 12 }),
    n,
    rayonCoin: 0,
    largeurM: t.dem?.extentMeters || null,
    exageration: p.demExaggeration,
  })
  return { t, p }
}

/** Les quatre tampons et l'index, par RÉFÉRENCE. */
const tampons = (g) => ({
  geo: g,
  position: g.attributes.position.array,
  normal: g.attributes.normal.array,
  color: g.attributes.color.array,
  uv: g.attributes.uv.array,
  index: g.index.array,
})

test('⑧a TÉMOIN — sur le chemin de PRODUCTION, un cran reconstruit tout', async () => {
  const { t, p } = await terrainDeBanc(false)
  t.setDem(demBouchon(64, 30)); t.rebuild(p)
  const avant = tampons(t.mesh.geometry)
  t.setDem(demBouchon(64, 15)); t.rebuild(p) // LE CRAN
  const apres = tampons(t.mesh.geometry)
  // ⚠️ Rejoué contre le dépôt AVANT d'être écrit : les quatre sont neufs.
  assert.notEqual(apres.geo, avant.geo, 'la géométrie n\'est plus reconstruite : re-mesurer avant de conclure')
  assert.notEqual(apres.position, avant.position)
  assert.notEqual(apres.normal, avant.normal)
  assert.notEqual(apres.color, avant.color)
  // ⚠️ `uv`, en revanche, était DÉJÀ partagé — `gridTemplate` mémorise son
  // gabarit. Le dire ici évite de croire que la 6 ter l'a gagné.
  assert.equal(apres.uv, avant.uv, 'le gabarit de `gridTemplate` partage déjà ses `uv`')
})

test('⑧b SOUS LA FENÊTRE BORNÉE — un cran ne réalloue RIEN', async () => {
  const { t, p } = await terrainDeBanc(true)
  t.setDem(demBouchon(64, 30)); t.rebuild(p)
  const avant = tampons(t.mesh.geometry)
  const f = t.fenetreBornee
  assert.ok(f, 'la fenêtre n\'a pas été adoptée')
  assert.equal(avant.position, f.geometrie, 'le maillage ne porte pas les tampons DE LA FENÊTRE')
  assert.equal(avant.normal, f.normales)
  assert.equal(avant.uv, f.uv)
  assert.equal(avant.index, f.indices)

  t.setDem(demBouchon(64, 15)); t.rebuild(p) // LE CRAN
  const apres = tampons(t.mesh.geometry)
  // ⚠️ IDENTITÉ DE RÉFÉRENCE — la seule assertion qui distingue « mis à jour »
  // de « reconstruit à l'identique ». C'est le cran qui disparaît.
  assert.equal(apres.geo, avant.geo, 'la géométrie a été reconstruite')
  assert.equal(apres.position, avant.position, 'les positions ont été réallouées')
  assert.equal(apres.normal, avant.normal, 'les normales ont été réallouées')
  assert.equal(apres.color, avant.color, 'les couleurs ont été réallouées')
  assert.equal(apres.uv, avant.uv)
  assert.equal(apres.index, avant.index, 'la topologie a été refaite')
  assert.equal(t.fenetreBornee, f, 'la fenêtre elle-même a été refaite')
  // …et le relief a bien été écrit, sinon on garderait des tampons morts
  let bouges = 0
  const nb = (PARAMS_TERRAIN.resolution + 1) ** 2
  for (let i = 0; i < nb; i++) if (apres.position[i * 3 + 1] !== 0) bouges++
  assert.ok(bouges > nb / 2, `${bouges} sommets sur ${nb} portent un relief`)
})

test('⑧c LES DEUX CHEMINS PEIGNENT LE MÊME BLOC — attribut par attribut', async () => {
  // ⚠️ Ne rien réallouer ne vaut rien si l'image change. À `rayonCoin = 0` la
  // nappe de la fenêtre EST le gabarit de `gridTemplate` : l'égalité doit être
  // BIT À BIT, pas « à une tolérance près ».
  const a = await terrainDeBanc(false)
  const b = await terrainDeBanc(true)
  for (const { t, p } of [a, b]) { t.setDem(demBouchon(64, 20)); t.rebuild(p) }
  const A = tampons(a.t.mesh.geometry)
  const B = tampons(b.t.mesh.geometry)
  const nb = (PARAMS_TERRAIN.resolution + 1) ** 2
  for (const [nom, k] of [['position', 3], ['normal', 3], ['color', 3], ['uv', 2]]) {
    for (let i = 0; i < nb * k; i++) {
      // ⚠️ **CETTE TOLÉRANCE DÉCRIVAIT UN NaN QUE CE BANC-CI NE PRODUIT PAS —
      // ET IL A FALLU DEUX PASSES POUR LE DIRE JUSTE.** Le bilan de la Tâche 6
      // ter annonçait « trois composantes de `color` NaN des DEUX côtés »
      // (`Math.pow(hn, 0.85)` avec `hn < 0`, `terrain.js:_ecrireRelief`).
      // Rejoué le 2026-08-21 sur CE banc exact : **zéro composante NaN sur
      // 12 675 (production) et 13 446 (fenêtre)**, `hn` minimal 0,0015 — parce
      // que le point le plus bas de `demBouchon` est à −1 130 m, où
      // `landFactor = smoothstep(0, 90, raw)` éteint le grain qui aurait pu
      // faire passer un sommet sous `minH`. **Le défaut, lui, est bien réel :
      // sur un champ ALPIN il tombe, et ⑫h le mesure — 421 sommets sous
      // `minH`.** `terrain.js` borne donc `hn` à zéro. La branche ci-dessous
      // est devenue morte : on la garde parce qu'elle ne coûte rien, et ⑫g
      // comme ⑫h exigent, eux, l'absence totale de NaN.
      if (!Number.isFinite(A[nom][i]) || !Number.isFinite(B[nom][i])) {
        assert.equal(Number.isFinite(A[nom][i]), Number.isFinite(B[nom][i]), `${nom}[${i}] : un NaN d'un seul côté`)
        continue
      }
      assert.equal(A[nom][i], B[nom][i], `${nom}[${i}]`)
    }
  }
  for (let i = 0; i < PARAMS_TERRAIN.resolution ** 2 * 6; i++) {
    assert.equal(A.index[i], B.index[i], `index[${i}]`)
  }
  assert.deepEqual(a.t.mapUniforms.uHeightRange.value.toArray(), b.t.mapUniforms.uHeightRange.value.toArray())
  assert.equal(a.t.mapUniforms.uSeaY.value, b.t.mapUniforms.uSeaY.value)
})

test('⑧d SEULE LA NAPPE EST DESSINÉE — la jupe est dans le tampon, pas à l\'écran', async () => {
  // ⚠️ Sans cette borne, le matériau du terrain peindrait les parois de la
  // fenêtre PAR-DESSUS le socle de `plinth.js`. Le damier n'est pas touché :
  // `block-grid.js` continue d'appeler `buildSlabWalls`.
  const { t, p } = await terrainDeBanc(true)
  t.setDem(demBouchon(64, 20)); t.rebuild(p)
  const res = PARAMS_TERRAIN.resolution
  const f = t.fenetreBornee
  assert.equal(t.mesh.geometry.drawRange.count, f.trianglesNappe * 3)
  assert.equal(f.trianglesNappe, res * res * 2)
  // la jupe existe bel et bien — c'est elle qui portera la gravure à l'arrêt
  assert.ok(f.nbSommets > (res + 1) ** 2, 'la fenêtre n\'a plus de parois')
  assert.ok(f.indices.length > f.trianglesNappe * 3, 'la fenêtre n\'a plus de dalle')
  // …et elle n'est PAS levée à hauteur de terrain par `_ecrireRelief`
  for (let s = 0; s < f.anneau.length; s++) {
    assert.equal(f.geometrie[(f.iBas + s) * 3 + 1], f.baseY, `le sommet bas ${s} a été soulevé`)
  }
})

test('⑧e MUTATION — réintroduire une reconstruction tue ⑧b', async () => {
  const { t, p } = await terrainDeBanc(true)
  t.setDem(demBouchon(64, 30)); t.rebuild(p)
  const avant = t.mesh.geometry.attributes.position.array
  // la mutation : le point de décision du branchement rend `null`, comme s'il
  // n'existait pas — c'est exactement « remettre le gabarit »
  t._geometrieRebuild = () => null
  t.setDem(demBouchon(64, 15)); t.rebuild(p)
  assert.notEqual(t.mesh.geometry.attributes.position.array, avant, 'la mutation ne mute rien')
  assert.throws(() => assert.equal(t.mesh.geometry.attributes.position.array, avant))
})

test('⑧f LE DRAPEAU EST LEVÉ — et sans lui la fenêtre n\'existe toujours pas', async () => {
  const { FLAGS, globeContinuActif } = await import('../src/flags.js')
  // ⚠️ **CE TEST DISAIT « LE BRANCHEMENT NE PART PAS EN PRODUCTION TANT
  // QU'ADRIEN NE L'A PAS VU ». Adrien l'a vu, et il a tranché le 2026-08-30** :
  // « installe le mode sphère comme le mode par défaut, pour qu'on commence
  // directement en mode sphère au chargement ». La fenêtre bornée part donc en
  // production, et `shibumap.com` ne sert plus le socle plat.
  assert.equal(FLAGS.globeContinu, true, 'le mode sphère est le démarrage : la fenêtre bornée part en production')

  // ⚠️ **LA GARDE, ELLE, N'A PAS BOUGÉ D'UN POUCE, ET C'EST CE QUE CE TEST
  // GARDE DEPUIS TOUJOURS** : le chemin SANS drapeau — c'est-à-dire
  // `?globe=crans` — doit rester EXACTEMENT celui d'avant. `terrainDeBanc(false)`
  // le rejoue, et il ne dépend d'aucun défaut : c'est un booléen passé à la main.
  const { t, p } = await terrainDeBanc(false)
  t.setDem(demBouchon(64, 20)); t.rebuild(p)
  assert.equal(t.fenetreBornee, null, 'la fenêtre a été fabriquée sans le drapeau')
  assert.equal(t.mesh.geometry.drawRange.count, Infinity, 'le chemin `?globe=crans` ne borne rien')

  // ⛔ **L'ÉCHAPPATOIRE D'ADRESSE DE `globeContinuActif` N'ÉTAIT ÉVALUÉE NULLE
  // PART** — aucun test du dépôt n'appelait cette fonction, ni avec ni sans
  // `location`. Inverser ses deux branches ne faisait rougir personne. C'est le
  // drapeau RACINE des sept : c'est lui qui commande le démarrage en sphère, et
  // c'est par `?globe=crans` qu'on revient à la production d'avant. Les deux
  // branches sont exercées ci-dessous, chacune contre le défaut CONTRAIRE —
  // une branche ne mord jamais contre le défaut qui lui donne déjà raison.
  const avant = globalThis.location
  const defaut = FLAGS.globeContinu
  const q = (s) => { globalThis.location = { search: s } }
  try {
    q('')
    assert.equal(globeContinuActif(), true, 'adresse nue : le globe continu démarre')
    q('?globe=crans')
    assert.equal(globeContinuActif(), false, '`?globe=crans` doit COUPER un défaut allumé')
    q('?globe=0')
    assert.equal(globeContinuActif(), false, '`?globe=0` aussi')
    q('?globe=bidon')
    assert.equal(globeContinuActif(), true, 'une valeur inconnue retombe sur le drapeau nu')
    FLAGS.globeContinu = false
    q('')
    assert.equal(globeContinuActif(), false, 'défaut éteint : rien ne l’allume tout seul')
    q('?globe=continu')
    assert.equal(globeContinuActif(), true, '`?globe=continu` doit ALLUMER un défaut éteint')
    q('?globe=1')
    assert.equal(globeContinuActif(), true, '`?globe=1` aussi')
  } finally {
    FLAGS.globeContinu = defaut
    if (avant === undefined) delete globalThis.location
    else globalThis.location = avant
  }

  // ⚠️ et `main.js` pose bien ce booléen — sinon le drapeau ne protégerait rien
  const code = sansCommentaires(lire('src/main.js'))
  assert.ok(/params\.globeContinu\s*=\s*globeContinuActif\(\)/.test(code), '`main.js` ne pose plus `params.globeContinu`')
  assert.ok(/terrain\.fabriqueFenetre\s*=/.test(code), '`main.js` ne pose plus la fabrique de fenêtre')
  // ⚠️ et `terrain.js` n'importe TOUJOURS pas `fenetre-bornee.js` — le cycle
  // `terrain.js → fenetre-bornee.js → terrain.js` ne se verrait qu'en production.
  assert.equal(/from ['"]\.\/monde\/fenetre-bornee\.js['"]/.test(sansCommentaires(lire('src/terrain.js'))), false)
})

// ════════════════════════════════════════════════════════════════════════════
// ⑩ LA FENÊTRE LIT LE QUADTREE — Tâche 6 quinquies
// ════════════════════════════════════════════════════════════════════════════
//
// ⚠️ **C'EST L'ÉTAPE QUI TUE L'ATTENTE, ET LE TEST DIT EXACTEMENT ÇA** : sur un
// changement de cran, **aucun appel à `loadSurface`** n'est nécessaire pour que
// le socle affiche le relief DU LIEU. La Tâche 6 ter avait supprimé la
// RECONSTRUCTION ; les hauteurs, elles, venaient encore du MNT, donc de
// `loadSurface` — les ~7,9 s sur 30 que le §6 chiffre depuis le début.
//
// ⚠️ **REJOUÉ CONTRE LE DÉPÔT AVANT D'ÊTRE ÉCRIT** (`.banc/rejeu-6quinquies.mjs`,
// hors dépôt) : un `Terrain` sous `?globe=continu` **sans aucun `setDem`**
// adoptait bien la fenêtre et écrivait des `y` — mais **du relief PROCÉDURAL**,
// c'est-à-dire du bruit qui n'a rien à voir avec le lieu. ⑩a garde ce constat
// comme TÉMOIN : sans lui, ⑩b passerait sur un dépôt où le MNT reviendrait par
// une autre porte, et personne ne le saurait.

/** Une tuile de quadtree bouchon — `heights` en mètres, comme `_buildMesh`. */
function tuileBouchon (z, x, y, size = 256, f = (u, v) => 900 * Math.sin(u * 6.1) + 500 * Math.cos(v * 4.3)) {
  const heights = new Float32Array(size * size)
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) heights[j * size + i] = f(x + (i + 0.5) / size, y + (j + 0.5) / size)
  }
  return { z, x, y, size, heights, state: 'ready', key: `${z}/${x}/${y}` }
}

/**
 * Un flux bouchon : le cache du quadtree, sans réseau ni globe.
 *
 * ⚠️ `remplirHauteurs` ne lit du flux que `globe.tiles` — c'est tout ce qu'il
 * faut, et c'est ce qui permet de prouver le contrat SANS toucher au réseau.
 */
function fluxBouchon (tuiles) {
  const tiles = new Map()
  for (const t of tuiles) tiles.set(t.key, t)
  return { globe: { tiles }, demande: { zoom: tuiles[0].z }, reclamees: tiles }
}

/** Les tuiles qui couvrent l'emprise d'un bloc centré sur `lat`/`lon`. */
async function fluxDuBloc (lat, lon, zoom) {
  const { empriseBlocMNT } = await import('../src/geo.js')
  const { tuilesEmprise } = await import('../src/monde/flux-terrain.js')
  const emprise = empriseBlocMNT({ lat, lon, zoom })
  const liste = tuilesEmprise(emprise, zoom)
  return { emprise, flux: fluxBouchon(liste.map(({ z, x, y }) => tuileBouchon(z, x, y))) }
}

/** Le `Terrain` du branchement, SANS MNT — c'est-à-dire sans `loadSurface`. */
async function terrainSurFlux (lat, lon, zoom, { avecCrochet = true } = {}) {
  const { Terrain } = await import('../src/terrain.js')
  const { construireFenetre, majHauteurs } = await import('../src/monde/fenetre-bornee.js')
  const { emprise, flux } = await fluxDuBloc(lat, lon, zoom)
  // ⚠️ les paramètres du relief procédural sont COMPLETS : sans eux le témoin
  // rendrait des NaN et prouverait la mauvaise chose (mesuré au rejeu).
  const p = {
    ...PARAMS_TERRAIN, globeContinu: true, demZoom: zoom,
    amplitude: 6, scale: 0.05, octaves: 4, lacunarity: 2.1, gain: 0.5, warp: 2, detailScale: 0.5,
  }
  const t = new Terrain(p)
  t.fabriqueFenetre = (n) => construireFenetre({ emprise, n, rayonCoin: 0, exageration: p.demExaggeration })
  if (avecCrochet) {
    // ⚠️ **EXACTEMENT LE CROCHET DE `main.js`** : `majHauteurs` écrit les `y` et
    // les normales, et rend le compte des remplis / manquants.
    t.hauteursDeFlux = (fenetre) => {
      majHauteurs(fenetre, flux)
      return { remplis: fenetre.remplis, manquants: fenetre.manquants, zoom }
    }
  }
  return { t, p, flux, emprise }
}

/** L'écart maximal entre les `y` écrits et le relief NU du quadtree. */
function ecartAuQuadtree (pos, attendu, echelle) {
  let moy = 0
  for (const h of attendu) moy += h
  moy /= attendu.length
  let pire = 0
  for (let i = 0; i < attendu.length; i++) {
    const d = Math.abs(pos[i * 3 + 1] - (attendu[i] - moy) * echelle)
    if (d > pire) pire = d
  }
  return pire
}

test('⑩a TÉMOIN — sans le crochet, un socle sans MNT n\'affiche PAS le relief du lieu', async () => {
  const { t, p, emprise } = await terrainSurFlux(45.8326, 6.8652, 12, { avecCrochet: false })
  t.rebuild(p)
  assert.ok(t.fenetreBornee, 'la fenêtre n\'a pas été adoptée')
  const { remplirHauteurs } = await import('../src/monde/flux-terrain.js')
  const { flux } = await fluxDuBloc(45.8326, 6.8652, 12)
  const attendu = remplirHauteurs(flux, { emprise, n: t.fenetreBornee.n }).sortie
  const pire = ecartAuQuadtree(t.mesh.geometry.attributes.position.array, attendu, t.fenetreBornee.echelleVerticale)
  // ⚠️ le relief écrit N'EST PAS celui du quadtree : c'est du bruit procédural.
  assert.ok(pire > 1.5, `écart max ${pire.toFixed(3)} : le quadtree est déjà lu sans crochet, re-mesurer avant de conclure`)
})

test('⑩b SANS `loadSurface` — le socle porte le relief DU QUADTREE', async () => {
  const { t, p, emprise } = await terrainSurFlux(45.8326, 6.8652, 12)
  assert.equal(t.dem, null, 'ce banc ne doit charger AUCUN MNT — c\'est toute la question')
  t.rebuild(p)
  const f = t.fenetreBornee
  assert.ok(f, 'la fenêtre n\'a pas été adoptée')
  assert.ok(f.remplis > 0, 'aucune hauteur lue dans le quadtree')
  assert.equal(f.manquants, 0, 'l\'emprise bouchon est couverte en entier : un manquant serait un défaut de tuilage')
  const pos = t.mesh.geometry.attributes.position.array
  assert.equal(pos, f.geometrie, 'le maillage ne porte pas le tampon DE LA FENÊTRE')
  const { remplirHauteurs } = await import('../src/monde/flux-terrain.js')
  const { flux } = await fluxDuBloc(45.8326, 6.8652, 12)
  const attendu = remplirHauteurs(flux, { emprise, n: f.n }).sortie
  let moy = 0
  for (const h of attendu) moy += h
  moy /= attendu.length
  assert.ok(Math.abs(moy - f.moyenneM) < 1e-3, 'la fenêtre n\'a pas lu les mêmes hauteurs')
  // ⚠️ ÉCART BORNÉ PAR LE GRAIN, PAS NUL : `_ecrireRelief` ajoute le FBM de
  // détail par-dessus — voir ⑩g, qui exige justement qu'il soit là.
  const pire = ecartAuQuadtree(pos, attendu, f.echelleVerticale)
  assert.ok(pire < 1.5, `écart max ${pire.toFixed(3)} unité : ce n'est plus le relief du quadtree`)
})

test('⑩c LE RAFFINEMENT — une tuile plus fine arrive, RIEN n\'est réalloué', async () => {
  const { Terrain } = await import('../src/terrain.js')
  const { construireFenetre, majHauteurs } = await import('../src/monde/fenetre-bornee.js')
  const { empriseBlocMNT } = await import('../src/geo.js')
  const { tuilesEmprise } = await import('../src/monde/flux-terrain.js')
  const zoom = 12
  const emprise = empriseBlocMNT({ lat: 45.8326, lon: 6.8652, zoom })
  // grossier d'abord : les tuiles z10 qui couvrent tout, plates ; les z12 après.
  const grossieres = tuilesEmprise(emprise, 10).map(({ z, x, y }) => tuileBouchon(z, x, y, 256, () => 1200))
  const fines = tuilesEmprise(emprise, zoom).map(({ z, x, y }) => tuileBouchon(z, x, y))
  const tiles = new Map()
  for (const g of grossieres) tiles.set(g.key, g)
  const flux = { globe: { tiles }, demande: { zoom }, reclamees: tiles }
  const p = {
    ...PARAMS_TERRAIN, globeContinu: true, demZoom: zoom, detail: 0,
    amplitude: 6, scale: 0.05, octaves: 4, lacunarity: 2.1, gain: 0.5, warp: 2, detailScale: 0.5,
  }
  const t = new Terrain(p)
  t.fabriqueFenetre = (n) => construireFenetre({ emprise, n, rayonCoin: 0, exageration: p.demExaggeration })
  t.hauteursDeFlux = (fenetre) => {
    majHauteurs(fenetre, flux)
    return { remplis: fenetre.remplis, manquants: fenetre.manquants, zoom }
  }
  t.rebuild(p)
  const avant = tampons(t.mesh.geometry)
  const fenetreAvant = t.fenetreBornee
  // ⚠️ à hauteurs CONSTANTES la nappe est plate : c'est bien « le socle se
  // dessine à la résolution disponible », et c'est exactement ce qu'on affine.
  assert.equal(new Set(t.fenetreBornee.hauteursM).size, 1, 'le socle grossier devrait être uniforme ici')

  for (const f of fines) tiles.set(f.key, f) // LES TUILES FINES ARRIVENT
  const rapport = t.rafraichirFenetre(p)
  assert.ok(rapport, 'le raffinement n\'a rien lu')
  const apres = tampons(t.mesh.geometry)
  // ⚠️ IDENTITÉ DE RÉFÉRENCE — la seule assertion qui distingue « affiné » de
  // « reconstruit ». C'est toute la décision 13.
  assert.equal(apres.geo, avant.geo, 'la géométrie a été reconstruite au raffinement')
  assert.equal(apres.position, avant.position, 'les positions ont été réallouées')
  assert.equal(apres.normal, avant.normal, 'les normales ont été réallouées')
  assert.equal(apres.color, avant.color, 'les couleurs ont été réallouées')
  assert.equal(apres.index, avant.index, 'la topologie a été refaite')
  assert.equal(t.fenetreBornee, fenetreAvant, 'la fenêtre elle-même a été refaite')
  // …et le relief a VRAIMENT changé, sinon on aurait affiné du vide
  assert.ok(new Set(t.fenetreBornee.hauteursM).size > 1000, 'le raffinement n\'a pas apporté de détail')
})

test('⑩d MUTATION — remettre le remplissage sur le MNT tue ⑩b', async () => {
  const { t, p, emprise } = await terrainSurFlux(45.8326, 6.8652, 12)
  // la mutation : le point de décision refuse le flux — c'est exactement l'état
  // de la Tâche 6 ter, où `terrain.js` remplissait depuis son propre MNT.
  t._remplirDepuisFlux = () => null
  t.rebuild(p)
  const { remplirHauteurs } = await import('../src/monde/flux-terrain.js')
  const { flux } = await fluxDuBloc(45.8326, 6.8652, 12)
  const attendu = remplirHauteurs(flux, { emprise, n: t.fenetreBornee.n }).sortie
  const pire = ecartAuQuadtree(t.mesh.geometry.attributes.position.array, attendu, t.fenetreBornee.echelleVerticale)
  assert.ok(pire > 1.5, 'le relief est encore celui du quadtree : la mutation ne mord pas')
})

test('⑩e L\'EMPRISE EST CELLE DU BLOC, PAS CELLE D\'`empriseSocle` — et l\'écart est mesuré', async () => {
  const { empriseBlocMNT } = await import('../src/geo.js')
  const { patchLatLonBBox } = await import('../src/coast-mask.js')
  const { empriseSocle } = await import('../src/monde/seuil-socle.js')
  const lieux = [[45.8326, 6.8652, 12], [-21.115, 55.536, 12], [45.9237, 6.8694, 13], [35.36, 138.72, 14]]
  for (const [lat, lon, zoom] of lieux) {
    // ① UNE SEULE LOI : ce que `empriseBlocMNT` calcule sans rien charger est
    //    EXACTEMENT l'empreinte que `patchLatLonBBox` lit sur le MNT chargé.
    const n = 2 ** zoom
    const la = (lat * Math.PI) / 180
    const cx = Math.floor(((lon + 180) / 360) * n)
    const cy = Math.floor(((1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2) * n)
    const demBidon = { zoom, size: 768, tilePx: 256, originTileX: cx - 1, originTileY: cy - 1 }
    const b = patchLatLonBBox(demBidon)
    const e = empriseBlocMNT({ lat, lon, zoom })
    assert.equal(e.ouest, b.west, 'ouest')
    assert.equal(e.est, b.east, 'est')
    assert.equal(e.nord, b.north, 'nord')
    assert.equal(e.sud, b.south, 'sud')
    // ② ET `empriseSocle` EN DIFFÈRE — c'est la mesure qui a décidé la tâche.
    const s = empriseSocle({ centre: { lat, lon }, zoom })
    const largeurTuile = 360 / n
    const decalage = Math.abs(s.ouest - e.ouest) / largeurTuile
    assert.ok(Math.abs((s.est - s.ouest) - (e.est - e.ouest)) < 1e-9, 'les deux emprises ont bien la MÊME largeur')
    assert.ok(decalage > 1e-6, '`empriseSocle` coïncide avec l\'empreinte du bloc : re-mesurer avant de conclure')
    assert.ok(decalage < 0.5 + 1e-9, `décalage de ${decalage.toFixed(3)} tuile — au-delà d'une demi-tuile, la règle a changé`)
  }
})

test('⑩f `terrain.sample` LIT LA FENÊTRE — sinon le socle et la nappe divergent', async () => {
  const { t, p } = await terrainSurFlux(45.8326, 6.8652, 12)
  t.rebuild(p)
  const f = t.fenetreBornee
  const pos = f.geometrie
  const parCote = f.n + 1
  const demi = 28 // TERRAIN_SIZE / 2
  const pas = 56 / f.n
  // sur les NŒUDS de la grille, l'échantillonneur doit rendre le `y` du sommet,
  // à l'arrondi près : c'est ce que `plinth.js:computeSlab` lit pour ses parois.
  let pire = 0
  for (const [i, j] of [[0, 0], [1, 1], [17, 5], [f.n, f.n], [f.n - 1, 3], [32, 61]]) {
    const y = t.sample(-demi + i * pas, -demi + j * pas)
    pire = Math.max(pire, Math.abs(y - pos[(j * parCote + i) * 3 + 1]))
  }
  assert.ok(pire < 1e-4, `écart max ${pire} : \`terrain.sample\` ne lit pas la nappe affichée`)
  // ⚠️ **ET CETTE NAPPE EST BIEN CELLE DU QUADTREE.** Sans cette moitié le test
  // ne prouve qu'une COHÉRENCE — vraie des deux côtés, donc muette : mesuré, il
  // passait encore avec le point de décision neutralisé.
  const { remplirHauteurs } = await import('../src/monde/flux-terrain.js')
  const { flux } = await fluxDuBloc(45.8326, 6.8652, 12)
  const attendu = remplirHauteurs(flux, { emprise: f.emprise, n: f.n }).sortie
  let moy = 0
  for (const h of attendu) moy += h
  moy /= attendu.length
  let pireQ = 0
  for (const [i, j] of [[0, 0], [1, 1], [17, 5], [f.n, f.n], [f.n - 1, 3], [32, 61]]) {
    const y = t.sample(-demi + i * pas, -demi + j * pas)
    pireQ = Math.max(pireQ, Math.abs(y - (attendu[j * parCote + i] - moy) * f.echelleVerticale))
  }
  assert.ok(pireQ < 1.5, `écart max ${pireQ.toFixed(3)} au quadtree : \`terrain.sample\` décrit un AUTRE relief`)
  const code = sansCommentaires(lire('src/terrain.js'))
  assert.ok(/if \(depuisFlux\) this\.sample = this\._makeFenetreSampler\(/.test(code), 'le sampler de fenêtre n\'est plus posé par `rebuild`')
})

test('⑩g LE GRAIN FBM SURVIT AU CHEMIN DU FLUX', async () => {
  const { t, p, emprise } = await terrainSurFlux(45.8326, 6.8652, 12)
  t.rebuild(p)
  const avecGrain = Float32Array.from(t.mesh.geometry.attributes.position.array)
  const avecNormales = Float32Array.from(t.mesh.geometry.attributes.normal.array)
  const { t: t2, p: p2 } = await terrainSurFlux(45.8326, 6.8652, 12)
  t2.rebuild({ ...p2, detail: 0 })
  const sansGrain = t2.mesh.geometry.attributes.position.array
  const sansNormales = t2.mesh.geometry.attributes.normal.array
  const nb = (t.fenetreBornee.n + 1) ** 2
  // ⚠️ **LE SOCLE À GRAIN NUL EST EXACTEMENT LE QUADTREE**, et sans cette
  // assertion le test se contenterait d'un grain posé sur n'importe quel relief
  // — mesuré : il passait encore avec le point de décision neutralisé.
  const { remplirHauteurs } = await import('../src/monde/flux-terrain.js')
  const { flux } = await fluxDuBloc(45.8326, 6.8652, 12)
  const attendu = remplirHauteurs(flux, { emprise, n: t2.fenetreBornee.n }).sortie
  const nu = ecartAuQuadtree(sansGrain, attendu, t2.fenetreBornee.echelleVerticale)
  assert.ok(nu < 1e-3, `écart max ${nu} : à grain nul le socle devrait ÊTRE le quadtree`)
  let differents = 0
  for (let i = 0; i < nb; i++) if (avecGrain[i * 3 + 1] !== sansGrain[i * 3 + 1]) differents++
  assert.ok(differents > nb * 0.5, `${differents} sommets sur ${nb} portent le grain : il a disparu du chemin du flux`)
  // ⚠️ ET LES NORMALES SUIVENT LE GRAIN. Garder celles d'`appliquerHauteurs`
  // (qui écrit AVANT le grain) décrirait une surface qui n'est plus dessinée.
  let normDiff = 0
  for (let i = 0; i < nb * 3; i++) if (avecNormales[i] !== sansNormales[i]) normDiff++
  assert.ok(normDiff > nb, 'les normales ne suivent pas le grain')
})

test('⑩h `main.js` BRANCHE LE CROCHET, ET IL PASSE PAR R3 ET PAR `majHauteurs`', () => {
  const code = sansCommentaires(lire('src/main.js'))
  assert.ok(/terrain\.hauteursDeFlux\s*=/.test(code), '`main.js` ne pose plus le crochet des hauteurs')
  assert.ok(/creerFlux\(\{\s*globe\s*\}\)/.test(code), 'le flux n\'est plus créé sur le globe')
  // ⚠️ **ON DEMANDE LE ZOOM DU BLOC, ET `remplirBorne` A ÉTÉ RETIRÉ D'ICI SUR
  // UNE MESURE**, pas sur un goût : `debitObserve` rendait **0,787 Mb/s** sur un
  // lien OISIF, donc `zoomSoutenable` rendait **z5**, donc le socle réservait
  // **UNE tuile** (`5/16/11`) au lieu des neuf de son emprise — et rien ne le
  // rattrapait tant que la caméra ne bougeait pas. Voir la note dans `main.js`.
  // ⚠️ **ÉLARGI PAR LA TÂCHE J, PAS DÉPLACÉ** : `demanderEmprise` accepte une
  // SECONDE emprise (`aussi`, celle de la mer) parce que `gardeHauteurs` est
  // remplacée à chaque appel et que deux appels se reprendraient leurs tuiles.
  // Le zoom du BLOC reste celui-ci, et c'est ce que cette ligne défend.
  assert.ok(/demanderEmprise\(flux, \{ emprise, zoom: params\.demZoom[,\s}]/.test(code), 'le socle ne demande plus le zoom du bloc')
  // ⚠️ **ET LES DEUX APPELANTS PASSENT LE MÊME `aussi`.** Celui des deux qui
  // l'oublierait ANNULERAIT, à chaque image, les tuiles que l'autre vient de
  // demander (`demanderEmprise` rend à `empty` ce qui sort de `reclamees`) —
  // c'est-à-dire un fond marin qui ne se charge jamais, sans une erreur.
  const appels = code.match(/demanderEmprise\(flux, \{[^}]*\}(?:[^)]*)\)/g) || []
  assert.equal(appels.length, 2, `deux appelants attendus, ${appels.length} trouvés`)
  for (const a of appels) assert.ok(/aussi: empriseZoomMer\(\)/.test(a), `appel sans \`aussi\` : ${a}`)
  assert.equal(/remplirBorne\(/.test(code), false, '`remplirBorne` est revenu sur le chemin du socle : relire la mesure avant de le remettre')
  assert.ok(/majHauteurs\(fenetre, flux\)/.test(code), '`majHauteurs` n\'est plus appelé en production')
  // ⚠️ et le recadrage passe AVANT le remplissage, sinon le socle reste collé
  // au premier lieu chargé (mesuré à l'écran sur quatre lieux).
  const iRecadre = code.indexOf('recadrerFenetre(fenetre')
  const iRemplit = code.indexOf('demanderEmprise(flux')
  assert.ok(iRecadre > 0 && iRecadre < iRemplit, 'le recadrage ne passe plus avant le remplissage')
  // ⚠️ et le raffinement existe, sinon le socle resterait grossier pour toujours
  assert.ok(/socleRaffine\(\)/.test(code), 'le raffinement n\'est plus appelé par image')
  // ⚠️ ni `terrain.js` ni `main.js` ne ferment le cycle d'import
  const t = sansCommentaires(lire('src/terrain.js'))
  assert.equal(/from ['"]\.\/monde\/flux-terrain\.js['"]/.test(t), false, '`terrain.js` importe le flux : c\'est le cycle qui ne casse qu\'en production')
})

test('⑩i LE DRAPEAU EST LEVÉ, ET IL EXIGE `?globe=continu` — ÉVALUÉ', async () => {
  const { FLAGS, socleQuadtreeActif } = await import('../src/flags.js')
  // ⚠️ **UN RÉGIME MESURÉ FAUX NE PART PAS SOUS LE DRAPEAU QU'ON DEMANDE À
  // ADRIEN D'OUVRIR** — c'était la discipline de la Tâche 6 bis A, et la mesure
  // qui l'exigeait ici était la BATHYMÉTRIE : 642 m (Nice) à 961 m (La Réunion)
  // d'écart moyen en mer, le fond marin lu à zéro. **La Tâche 6 sexies a fermé
  // cette mesure-là** (`remplirHauteurs` fusionne `fuseBathymetry` ; 3,2 m à
  // Nice z12, 2,1 m à La Réunion z12), et Adrien a demandé le mode sphère au
  // démarrage le 2026-08-30. Le drapeau est donc LEVÉ. Les réserves qui restent
  // ne sont plus la mer : elles sont écrites au drapeau, dans `flags.js`.
  assert.equal(FLAGS.socleQuadtree, true, 'le socle quadtree part en production : la mer n’est plus plate')
  assert.equal(FLAGS.globeContinu, true, 'et la fenêtre bornée avec lui — c’est le mode sphère au chargement')
  assert.equal(typeof socleQuadtreeActif, 'function')

  // ⛔ **LA GARDE `?globe=continu` ÉTAIT GARDÉE PAR LE TEXTE SOURCE — ET C'EST
  // EXACTEMENT LA CLASSE DE DÉFAUT LA PLUS CHÈRE DE CE CHANTIER** : une
  // `assert.ok(/…/.test(src))` reste verte tant que la ligne existe, même si
  // elle n'est jamais exécutée. L'`assert.equal(socleQuadtreeActif(), false)`
  // d'à côté ne la sauvait pas : il passait parce que les DEUX drapeaux étaient
  // éteints, donc sans jamais distinguer laquelle des deux causes agissait.
  // Maintenant que les deux sont levés, la garde est ÉVALUÉE, et elle est la
  // seule chose qui puisse encore rendre `false`.
  const avant = globalThis.location
  const defaut = FLAGS.socleQuadtree
  const q = (s) => { globalThis.location = { search: s } }
  try {
    // ① la garde de dépendance, contre un `?globe` EXPLICITEMENT éteint
    q('?socle=quadtree&globe=crans')
    assert.equal(socleQuadtreeActif(), false, '`?globe=crans` doit couper le socle quadtree')
    q('?socle=quadtree&globe=0')
    assert.equal(socleQuadtreeActif(), false, '`?globe=0` aussi')
    q('?globe=crans')
    assert.equal(socleQuadtreeActif(), false, 'la garde prime sur le défaut levé')

    // ② le défaut, lu sur la VALEUR RENDUE, sans aucun paramètre
    q('')
    assert.equal(socleQuadtreeActif(), true, 'adresse nue : les deux drapeaux levés, le socle quadtree démarre')

    // ③ les DEUX branches de l'échappatoire, chacune contre le défaut CONTRAIRE
    //    — une branche ne mord jamais contre le défaut qui lui donne déjà raison.
    q('?globe=continu&socle=mnt')
    assert.equal(socleQuadtreeActif(), false, '`?socle=mnt` doit COUPER un défaut allumé')
    q('?globe=continu&socle=0')
    assert.equal(socleQuadtreeActif(), false, '`?socle=0` aussi')
    FLAGS.socleQuadtree = false
    q('?globe=continu')
    assert.equal(socleQuadtreeActif(), false, 'défaut éteint : `?globe=continu` seul ne l’allume pas')
    q('?globe=continu&socle=quadtree')
    assert.equal(socleQuadtreeActif(), true, '`?socle=quadtree` doit ALLUMER un défaut éteint')
    q('?globe=continu&socle=1')
    assert.equal(socleQuadtreeActif(), true, '`?socle=1` aussi')
  } finally {
    FLAGS.socleQuadtree = defaut
    if (avant === undefined) delete globalThis.location
    else globalThis.location = avant
  }

  // la même chose écrite dans le source — gardée EN PLUS de l'évaluation, jamais
  // à sa place : elle nomme la ligne qu'un relecteur doit retrouver.
  const src = lire('src/flags.js')
  assert.ok(/socleQuadtreeActif\(\)\s*\{\s*\n?\s*if \(!globeContinuActif\(\)\) return false/.test(src), 'le socle quadtree ne dépend plus de la fenêtre bornée')
  // ⚠️ et `main.js` ne pose le crochet QUE derrière ce drapeau — sinon
  // `?globe=continu` perdrait la bathymétrie sans que personne l'ait demandé.
  const code = sansCommentaires(lire('src/main.js'))
  assert.ok(/if \(socleQuadtreeActif\(\)\) terrain\.hauteursDeFlux\s*=/.test(code), 'le crochet n\'est plus derrière son drapeau')
})

// ════════════════════════════════════════════════════════════════════════════
// ⑪ LE BLOC CESSE D'ÊTRE GÉORÉFÉRENCÉ PAR LE MNT — Tâche 6 septies
// ════════════════════════════════════════════════════════════════════════════
//
// ⚠️ **REJOUÉ CONTRE LE DÉPÔT AVANT D'ÊTRE ÉCRIT** (`.banc/rejeu-6septies.mjs`
// et `-b.mjs`, hors dépôt), et **le rejeu a CONTREDIT le plan** :
//
//   · le plan prescrivait `terrain.fenetreBornee.echelleVerticale` comme
//     « l'échelle RÉELLE de la géométrie affichée ». **Elle ne l'est pas.**
//     Trois crans z12 → z13 → z14 sous `?globe=continu` SEUL : l'amplitude des
//     `y` de la nappe vaut **9,1989 → 18,3978 → 36,7955** (×2 par cran, exact),
//     pendant que `fenetre.echelleVerticale` reste à **0,00766707** — la valeur
//     du PREMIER cran, pour toujours. `appliquerHauteurs` est le seul écrivain
//     de ce champ, et il n'est appelé que sur le chemin du quadtree.
//   · **`recadrerFenetre` ne l'écrit pas non plus** : elle met `largeurM` à
//     jour (20 451 → 10 226 → 5 113 m, mesuré) et laisse `echelleVerticale`
//     intacte. Le contrat est en DEUX temps, et le plan n'en lisait qu'un.
//
// **Ce que ⑪ verrouille donc, et c'est UNE SEULE LOI** : la grandeur portée par
// la fenêtre est `largeurM`, et l'échelle s'en dérive avec l'exagération LUE
// VIVANTE (`echelleBloc`) — exactement la formule qu'`appliquerHauteurs` et
// `_makeDemSampler` posent tous les deux. Les deux régimes tombent alors sur le
// même chiffre, et le socle SANS MNT aussi.

const LIEU_ALPES = { lat: 45.8326, lon: 6.8652 }

/** Le `Terrain` de `main.js`, avec ses DEUX crochets de fenêtre. */
async function terrainRecadrable ({ avecMNT, avecFlux }) {
  const { Terrain } = await import('../src/terrain.js')
  const { construireFenetre, recadrerFenetre, majHauteurs } = await import('../src/monde/fenetre-bornee.js')
  const { empriseBlocMNT } = await import('../src/geo.js')
  const { empriseBlocM } = await import('../src/loi-altitude.js')
  const { tuilesEmprise } = await import('../src/monde/flux-terrain.js')

  const p = {
    ...PARAMS_TERRAIN, globeContinu: true,
    demLat: LIEU_ALPES.lat, demLon: LIEU_ALPES.lon, demZoom: 12,
    amplitude: 6, scale: 0.05, octaves: 4, lacunarity: 2.1, gain: 0.5, warp: 2, detailScale: 0.5,
  }
  const t = new Terrain(p)
  const emprise = () => empriseBlocMNT({ lat: p.demLat, lon: p.demLon, zoom: p.demZoom })
  // le MNT de `loadDem`, réduit à ce que le géoréférencement lui demande
  const poseMNT = () => {
    if (!avecMNT) return
    const size = 768
    const extentMeters = empriseBlocM({ zoom: p.demZoom, lat: p.demLat })
    const d = demBouchon(size, extentMeters / size)
    const n = 2 ** p.demZoom
    const la = (p.demLat * Math.PI) / 180
    d.zoom = p.demZoom
    d.originTileX = Math.floor(((p.demLon + 180) / 360) * n) - 1
    d.originTileY = Math.floor(((1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2) * n) - 1
    d.tilePx = 256
    d.extentMeters = extentMeters
    t.setDem(d)
  }
  const opts = () => ({
    emprise: emprise(),
    largeurM: t.dem?.extentMeters || null,
    exageration: p.demExaggeration,
  })
  t.fabriqueFenetre = (n) => construireFenetre({ ...opts(), n, rayonCoin: 0 })
  t.recadreFenetre = (f) => recadrerFenetre(f, opts())
  if (avecFlux) {
    t.hauteursDeFlux = (f) => {
      const liste = tuilesEmprise(f.emprise, p.demZoom)
      majHauteurs(f, fluxBouchon(liste.map(({ z, x, y }) => tuileBouchon(z, x, y))))
      return { remplis: f.remplis, manquants: f.manquants, zoom: p.demZoom }
    }
  }
  const cran = (zoom) => { p.demZoom = zoom; poseMNT(); t.rebuild(p) }
  return { t, p, cran, emprise }
}

/** L'amplitude des `y` de la NAPPE — l'échelle réellement dessinée. */
function amplitudeNappe (t, res) {
  const pos = t.mesh.geometry.attributes.position.array
  let min = Infinity
  let max = -Infinity
  for (let i = 0; i < (res + 1) ** 2; i++) {
    const y = pos[i * 3 + 1]
    if (y < min) min = y
    if (y > max) max = y
  }
  return max - min
}

test('⑪a TÉMOIN — `fenetre.echelleVerticale` NE SUIT PAS le cran, et le chiffre est celui du rejeu', async () => {
  const { t, cran, p } = await terrainRecadrable({ avecMNT: true, avecFlux: false })
  cran(12)
  const e0 = t.fenetreBornee.echelleVerticale
  const a12 = amplitudeNappe(t, p.resolution)
  cran(13)
  cran(14)
  // ⚠️ Ce test CONSTATE le défaut au lieu de le supposer : c'est lui qui
  // interdit de « corriger » la Tâche 6 septies en lisant `echelleVerticale`.
  assert.equal(t.fenetreBornee.echelleVerticale, e0,
    '`echelleVerticale` suit desormais le cran : re-mesurer avant de s\'en servir')
  // pendant que la nappe, elle, a bien quadruplé. ⚠️ **3,9337 et pas 4,0000, et
  // l'écart est EXPLIQUÉ, pas toléré** : le grain FBM que `_ecrireRelief` ajoute
  // aux `y` après l'échelle ne se divise pas par deux avec le bloc. C'est le
  // résidu du grain — mesuré au rejeu, pas une marge de confort.
  const a14 = amplitudeNappe(t, p.resolution)
  const r = a14 / a12
  assert.ok(r > 3.9 && r < 4.01, `la nappe n'a pas quadruple sur deux crans (${r.toFixed(4)})`)
})

test('⑪b LE RECADRAGE A LIEU À CHAQUE CRAN — l\'emprise et la largeur suivent SANS le quadtree', async () => {
  const { empriseBlocMNT } = await import('../src/geo.js')
  const { t, p, cran } = await terrainRecadrable({ avecMNT: false, avecFlux: false })
  cran(12)
  const f = t.fenetreBornee
  const largeur12 = f.largeurM
  for (const zoom of [13, 14]) {
    cran(zoom)
    assert.equal(t.fenetreBornee, f, 'la fenetre a ete REMPLACEE : le cran reconstruit a nouveau')
    const attendue = empriseBlocMNT({ lat: p.demLat, lon: p.demLon, zoom })
    assert.equal(f.emprise.ouest, attendue.ouest, `l'emprise est restee au cran precedent (z${zoom})`)
    assert.equal(f.emprise.nord, attendue.nord, `l'emprise est restee au cran precedent (z${zoom})`)
  }
  // la largeur au sol a été divisée par quatre — à la latitude du centre près,
  // qui bouge avec le calage sur la grille de tuiles (rejeu Q6 : ±0,14 %).
  const r = largeur12 / f.largeurM
  assert.ok(Math.abs(r - 4) < 4 * 0.005, `la largeur au sol ne suit pas le cran (rapport ${r.toFixed(5)})`)
})

test('⑪c UNE SEULE LOI — l\'échelle se dérive de `largeurM`, et les deux régimes tombent dessus', async () => {
  const { echelleBloc } = await import('../src/loi-altitude.js')
  const { TERRAIN_SIZE } = await import('../src/terrain.js')

  // ① avec MNT (`?globe=continu` seul) : la loi de la fenêtre EST celle du MNT
  const a = await terrainRecadrable({ avecMNT: true, avecFlux: false })
  for (const zoom of [12, 13, 14]) {
    a.cran(zoom)
    const f = a.t.fenetreBornee
    const parLaFenetre = echelleBloc({ extentMeters: f.largeurM, span: TERRAIN_SIZE, exageration: a.p.demExaggeration })
    const parLeMNT = echelleBloc({ extentMeters: a.t.dem.extentMeters, span: TERRAIN_SIZE, exageration: a.p.demExaggeration })
    assert.equal(parLaFenetre, parLeMNT, `z${zoom} : la fenetre et le MNT ne rendent plus la meme echelle`)
  }

  // ② sans MNT, sur le quadtree : la loi rend ce qu'`appliquerHauteurs` a écrit
  const b = await terrainRecadrable({ avecMNT: false, avecFlux: true })
  for (const zoom of [12, 13, 14]) {
    b.cran(zoom)
    const f = b.t.fenetreBornee
    assert.ok(f.remplis > 0, `z${zoom} : le quadtree bouchon n'a rien rempli`)
    const parLaFenetre = echelleBloc({ extentMeters: f.largeurM, span: TERRAIN_SIZE, exageration: b.p.demExaggeration })
    assert.ok(Math.abs(parLaFenetre / f.echelleVerticale - 1) < 1e-12,
      `z${zoom} : la loi (${parLaFenetre}) et appliquerHauteurs (${f.echelleVerticale}) divergent`)
  }
})

test('⑪d LA VISÉE SE LIT SUR L\'EMPRISE — et elle rend `latLonToWorld` au bit de flottant près', async () => {
  const geo = await import('../src/geo.js')
  const { latLonVersMondeEmprise, latLonToWorld, empriseBlocMNT } = geo
  assert.equal(typeof latLonVersMondeEmprise, 'function', '`geo.js` n\'exporte pas la conversion depuis l\'emprise')
  const { patchLatLonBBox } = await import('../src/coast-mask.js')
  const lieux = [
    ['Chamonix', 45.8326, 6.8652, 12],
    ['La Reunion', -21.1151, 55.5364, 12],
    ['Everest', 27.9881, 86.925, 13],
    ['Nice', 43.7102, 7.262, 11],
    ['antimeridien', -16.5, 179.94, 11],
  ]
  for (const [nom, lat, lon, zoom] of lieux) {
    const n = 2 ** zoom
    const la = (lat * Math.PI) / 180
    const dem = {
      zoom, size: 768, tilePx: 256,
      originTileX: Math.floor(((lon + 180) / 360) * n) - 1,
      originTileY: Math.floor(((1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2) * n) - 1,
    }
    const b = patchLatLonBBox(dem)
    const emprise = { ouest: b.west, sud: b.south, est: b.east, nord: b.north }
    // ① l'emprise SANS MNT est la même — c'est déjà ⑩e, on s'y adosse
    const e = empriseBlocMNT({ lat, lon, zoom })
    assert.equal(e.ouest, emprise.ouest, `${nom} : les deux emprises ont diverge`)
    // ② et la conversion balayée sur TOUTE l'empreinte, pas au seul centre
    let pire = 0
    for (let i = 0; i <= 8; i++) {
      for (let j = 0; j <= 8; j++) {
        const la2 = emprise.sud + ((emprise.nord - emprise.sud) * i) / 8
        let lo2 = emprise.ouest + (((emprise.est - emprise.ouest + 360) % 360) * j) / 8
        if (lo2 > 180) lo2 -= 360
        const w1 = latLonToWorld(dem, la2, lo2)
        const w2 = latLonVersMondeEmprise(emprise, la2, lo2)
        pire = Math.max(pire, Math.abs(w1.x - w2.x), Math.abs(w1.z - w2.z))
      }
    }
    // rejeu : 1,2e-12 à 8,5e-12 unité sur quatre lieux — c'est l'arrondi float64
    assert.ok(pire < 1e-9, `${nom} : ecart max ${pire.toExponential(3)} unite, au-dela de l'arrondi`)
  }
})

test('⑪e `main.js` — les grandeurs de cadrage LISENT LA FENÊTRE, pas `dem`', () => {
  const code = sansCommentaires(lire('src/main.js'))
  // ① l'échelle verticale et l'altitude de cadrage se dérivent d'UNE largeur
  assert.ok(/function largeurBlocM/.test(code), '`largeurBlocM` a disparu : la loi n\'a plus d\'ecrivain unique')
  const i = code.indexOf('function altitudeCadrageM')
  assert.ok(i > 0)
  assert.ok(/largeurBlocM\(\)/.test(code.slice(i, i + 700)), '`altitudeCadrageM` ne passe plus par la largeur du bloc')
  const j = code.indexOf('echelleVerticaleBloc()')
  assert.ok(j > 0)
  assert.ok(/largeurBlocM\(\)/.test(code.slice(j, j + 400)), '`echelleVerticaleBloc` ne passe plus par la largeur du bloc')
  // ⚠️ **ET NI L'UNE NI L'AUTRE NE LIT PLUS `dem.extentMeters`** — c'est ça,
  // « cesser d'être géoréférencé par le MNT ». Il en reste cinq lectures dans
  // `main.js` (le plancher du mode région, le cartouche, la note de relief,
  // l'échelle de nuit, les bateaux) : elles ne décident **pas** du cadrage de la
  // caméra, et les migrer est le reste de la Tâche 6 septies, pas celle-ci.
  assert.equal(/dem\.extentMeters/.test(code.slice(i, i + 700)), false, '`altitudeCadrageM` lit encore le MNT')
  assert.equal(/dem\.extentMeters/.test(code.slice(j, j + 400)), false, '`echelleVerticaleBloc` lit encore le MNT')
  // et l'unique lecteur de `dem.extentMeters` pour cette loi-là est `largeurBlocM`
  const k = code.indexOf('function largeurBlocM')
  assert.ok(/dem\?\.extentMeters/.test(code.slice(k, k + 300)), '`largeurBlocM` ne retombe plus sur le MNT quand il est là')
  // ② la visée passe par l'emprise de la fenêtre quand elle existe
  assert.ok(/latLonVersMondeEmprise\(/.test(code), '`viseeDuLieu` ne lit plus l\'emprise de la fenetre')
  // ③ et le recadrage est branché sur le rebuild, pas seulement sur le flux
  assert.ok(/terrain\.recadreFenetre\s*=/.test(code), '`main.js` ne pose plus le crochet de recadrage')
  const t = sansCommentaires(lire('src/terrain.js'))
  assert.ok(/this\.recadreFenetre\?\.\(/.test(t), '`_geometrieRebuild` ne recadre plus la fenetre qu\'il conserve')
})

test('⑪f MUTATION — retirer le recadrage du rebuild tue ⑪b', async () => {
  const { empriseBlocMNT } = await import('../src/geo.js')
  const { t, p, cran } = await terrainRecadrable({ avecMNT: false, avecFlux: false })
  cran(12)
  const gele = { ...t.fenetreBornee.emprise }
  t.recadreFenetre = null // la mutation : le rebuild garde la fenêtre telle quelle
  cran(13)
  const attendue = empriseBlocMNT({ lat: p.demLat, lon: p.demLon, zoom: 13 })
  assert.equal(t.fenetreBornee.emprise.ouest, gele.ouest, 'l\'emprise a suivi sans le crochet : la mutation ne mord pas')
  assert.notEqual(attendue.ouest, gele.ouest, 'le cran ne change pas l\'emprise : le banc ne prouve rien')
})

// ════════════════════════════════════════════════════════════════════════════
// ⑫ LE VOL DU MNT — Tâche 6 septies, la moitié qui retire vraiment l'attente
// ════════════════════════════════════════════════════════════════════════════
//
// ⚠️ **CE QUE MESURE LA TÂCHE, ET IL FAUT LIRE LES DEUX CHIFFRES ENSEMBLE.**
// Banc navigateur, descente z5 → z13 au Mont-Blanc (huit crans par
// `modes._refine()`, c'est-à-dire le chemin de la molette), sonde posée à CHAQUE
// `requestAnimationFrame`, réseau de cette machine :
//
//   | | avant | après |
//   |---|---|---|
//   | entrée morte | **25,41 s** et **25,50 s** | **0,21 / 0,09 / 0,16 s** |
//   | fraction du temps | 88,3 % et 83,1 % | **5,1 / 2,4 / 4,0 %** |
//   | dont rideau | 25,41 s et 25,50 s | **0 s** |
//   | par cran | 992 à 5 817 ms | **124 à 270 ms** |
//
// ⚠️ **ET LA DURÉE TOTALE DU BANC TOMBE DE 28,8 s À 4,0 s**, donc les deux
// colonnes ne couvrent PAS la même fenêtre de temps : ce qui se compare est
// l'attente absolue (25,4 s contre 0,16 s sur les mêmes huit crans), et la
// fraction, pas le nombre d'images.

test('⑫a LA RÉCIPROQUE — `mondeVersLatLonEmprise` rend `worldToLatLon` au bit de flottant près', async () => {
  const { mondeVersLatLonEmprise, worldToLatLon, latLonVersMondeEmprise } = await import('../src/geo.js')
  const { patchLatLonBBox } = await import('../src/coast-mask.js')
  assert.equal(typeof mondeVersLatLonEmprise, 'function', '`geo.js` n\'exporte pas la réciproque')
  const lieux = [
    ['Chamonix', 45.8326, 6.8652, 12],
    ['La Reunion', -21.1151, 55.5364, 12],
    ['Everest', 27.9881, 86.925, 13],
    ['Reykjavik', 64.1466, -21.9426, 9],
  ]
  for (const [nom, lat, lon, zoom] of lieux) {
    const n = 2 ** zoom
    const la = (lat * Math.PI) / 180
    const dem = {
      zoom, size: 768, tilePx: 256,
      originTileX: Math.floor(((lon + 180) / 360) * n) - 1,
      originTileY: Math.floor(((1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2) * n) - 1,
    }
    const b = patchLatLonBBox(dem)
    const emprise = { ouest: b.west, sud: b.south, est: b.east, nord: b.north }
    let pireDeg = 0
    let pireBoucle = 0
    for (let i = -4; i <= 4; i++) {
      for (let j = -4; j <= 4; j++) {
        const X = (i / 4) * 28
        const Z = (j / 4) * 28
        const a = worldToLatLon(dem, X, Z)
        const c = mondeVersLatLonEmprise(emprise, X, Z)
        pireDeg = Math.max(pireDeg, Math.abs(c.lat - a.lat), Math.abs(c.lon - a.lon))
        // ② et l'aller-retour est l'identité — sinon l'escalier de zoom dérive
        const w = latLonVersMondeEmprise(emprise, c.lat, c.lon)
        pireBoucle = Math.max(pireBoucle, Math.abs(w.x - X), Math.abs(w.z - Z))
      }
    }
    // relevé in situ (navigateur, MNT réel, La Réunion z13) : 7,1e-15 à 8,5e-14 °
    assert.ok(pireDeg < 1e-9, `${nom} : ecart max ${pireDeg.toExponential(3)} °, au-dela de l'arrondi`)
    assert.ok(pireBoucle < 1e-9, `${nom} : l'aller-retour derive de ${pireBoucle.toExponential(3)} unite`)
  }
})

test('⑫b SANS MNT, LE SOCLE N\'AFFICHE NI MASQUE DE MER NI ANALYSE — et c\'est voulu', async () => {
  // ⚠️ **LES LAISSER ALLUMÉS SERAIT PIRE QUE DE NE PAS LES AVOIR** : ce sont des
  // TEXTURES lues en UV de bloc, et sur le palier suivant la même UV couvre deux
  // fois moins de sol — le trait de côte se retrouverait à mi-chemin de son vrai
  // lieu, sans une erreur. C'est ce que le vol du MNT rend visible, et c'est la
  // décision 13 : grossier d'abord, net ensuite.
  const { t, p } = await terrainSurFlux(-21.1151, 55.5364, 12)
  // on ALLUME les deux à la main, comme le ferait un MNT du palier précédent
  t.mapUniforms.uSeaMaskOn.value = 1
  t.mapUniforms.uAnalysisOn.value = 1
  t.rebuild(p)
  assert.equal(t.dem, null, 'ce banc ne doit charger AUCUN MNT')
  assert.ok(t.fenetreBornee?.remplis > 0, 'le quadtree bouchon n\'a rien rempli : le banc ne prouve rien')
  assert.equal(t.mapUniforms.uSeaMaskOn.value, 0, 'le masque de mer du palier precedent survit au vol')
  assert.equal(t.mapUniforms.uAnalysisOn.value, 0, 'le champ d\'analyse du palier precedent survit au vol')
  // et la ligne d'eau, elle, vient bien de la fenêtre (elle ne peut pas venir
  // d'un `dem.meanM` qui n'existe pas)
  assert.ok(Number.isFinite(t.mapUniforms.uSeaY.value) && t.mapUniforms.uSeaY.value > -9999,
    'la ligne d\'eau est retombee sur le cas « pas de source »')
})

test('⑫c `main.js` — `loadSurface` N\'ATTEND PLUS le MNT, et le MNT continue derrière', () => {
  const code = sansCommentaires(lire('src/main.js'))
  // ① le vol existe, et il lâche le MNT du palier qu'on quitte
  const i = code.indexOf('function entrerEnVol')
  assert.ok(i > 0, '`entrerEnVol` a disparu')
  const vol = code.slice(i, i + 900)
  assert.ok(/_generationMNT\+\+/.test(vol), '`entrerEnVol` n\'incremente plus le numero de vol')
  assert.ok(/\bdem = null\b/.test(vol), '`entrerEnVol` garde le MNT du palier precedent : la carte serait fausse')
  assert.ok(/terrain\.setDem\(null\)/.test(vol), '`terrain` garde le MNT du palier precedent')
  assert.ok(/sansRideau: true/.test(vol), 'le vol leve le rideau par-dessus une application vivante')
  assert.ok(/blockGrid\?\.sync\(/.test(vol), 'les dalles voisines restent au palier precedent : la jointure serait coupee')
  // ② et `loadSurface` prend cette branche SANS `await` sur le MNT
  const j = code.indexOf('async loadSurface(')
  assert.ok(j > 0)
  const ls = code.slice(j, j + 1200)
  assert.ok(/await entrerEnVol\(\)/.test(ls), '`loadSurface` n\'attend plus que la fenetre soit posee')
  assert.ok(/\n\s*fetchAndBuildDem\(\{ centreSur: \{ lat, lon \}, enVol: true \}\)\.catch\(/.test(ls),
    'le MNT est de nouveau ATTENDU — ou bien sa promesse n\'a plus de preneur')
  // ③ la supersession, aux DEUX points d'attente
  const k = code.indexOf('async function fetchAndBuildDem')
  const fb = code.slice(k)
  const perimes = fb.match(/if \(perime\(\)\) return/g) || []
  assert.equal(perimes.length, 2, `${perimes.length} point(s) de supersession au lieu de 2 : deux crans rapides ecriraient dans le desordre`)
  assert.ok(/const gen = _generationMNT/.test(fb), 'le numero de vol n\'est plus capture avant le premier await')
})

test('⑫d LE VOL EXIGE LE SOCLE QUADTREE, ET SON DRAPEAU EST LEVÉ', async () => {
  const { FLAGS, socleQuadtreeActif } = await import('../src/flags.js')
  // ⚠️ **SANS LE QUADTREE, UN BLOC SANS MNT SE PEINDRAIT AU RELIEF PROCÉDURAL**
  // — du bruit qui n'a rien à voir avec le lieu (c'est le témoin ⑩a). Le vol ne
  // part donc pas sous `?globe=continu` seul : c'est `VOL_SANS_ATTENTE` qui
  // porte la garde, et elle reste intacte.
  //
  // ⛔ **CE QUE LE BASCULEMENT DU 2026-08-30 CHANGE ICI, ET IL FAUT LE DIRE :
  // LE VOL SANS ATTENTE PART MAINTENANT EN PRODUCTION.** Le commentaire d'avant
  // annonçait un drapeau « fermé tant que la mer y est plate » ; la mer n'est
  // plus plate depuis la Tâche 6 sexies (écart moyen tombé de 615 m à 3,2 m à
  // Nice z12), et Adrien a demandé la sphère au démarrage. Ce que la Tâche 6
  // sexies laissait ouvert reste ouvert et n'a PAS été mesuré à nouveau ici :
  // le coût par image du raffinement `render()` compris, le pic mémoire des
  // `fetchAndBuildDem` concurrents, et rien sur un portable. Voir `flags.js`.
  assert.equal(FLAGS.socleQuadtree, true, 'le socle quadtree part en production avec le mode sphère')
  assert.equal(socleQuadtreeActif(), true, 'adresse nue : le vol sans attente est armé')
  const code = sansCommentaires(lire('src/main.js'))
  assert.ok(/const VOL_SANS_ATTENTE = socleQuadtreeActif\(\)/.test(code), 'le vol ne depend plus du drapeau du socle quadtree')
  const i = code.indexOf('function volPossible')
  assert.ok(i > 0, '`volPossible` a disparu')
  const vp = code.slice(i, i + 300)
  assert.ok(/VOL_SANS_ATTENTE/.test(vp), 'le vol a perdu sa garde de drapeau')
  assert.ok(/terrain\.fenetreBornee/.test(vp), 'le vol ne verifie plus qu\'une fenetre porte le maillage')
  // ⚠️ l'emprise 3×3 est hors périmètre : son champ fait 168 unités quand la
  // géométrie en fait 56, et `empriseDuSocle` refuse déjà d'y fabriquer une
  // fenêtre. On l'écrit plutôt que de le sous-entendre (comme la 6 quinquies).
  assert.ok(/!fenetreContinueActive\(\)/.test(vp), 'le vol accepte l\'emprise 3x3, qui n\'a pas de fenetre a remplir')
})

test('⑫e L\'ESCALIER DE ZOOM CRANTE ENCORE PENDANT LE VOL — sinon la molette ne fait plus rien', () => {
  // ⚠️ **LE PLAN NE LISTAIT NI `viseeAuSol` NI CES DEUX PORTES**, et sans elles
  // tout le reste ne sert à rien : pendant le vol `dem` vaut `null`, donc
  // `getRefineTarget` aurait rendu `null` et le geste aurait été refusé en
  // silence — le gel qu'on retire, déplacé d'un cran.
  const code = sansCommentaires(lire('src/main.js'))
  for (const porte of ['getRefineTarget', 'getCoarsenTarget']) {
    const i = code.indexOf(porte + '()')
    assert.ok(i > 0, `${porte} a disparu`)
    const bloc = code.slice(i, i + 320)
    assert.ok(/\(!dem && !terrain\.fenetreBornee\)/.test(bloc), `${porte} refuse encore de cranter sans MNT`)
  }
  const j = code.indexOf('function viseeAuSol')
  assert.ok(j > 0, '`viseeAuSol` a disparu')
  assert.ok(/mondeVersLatLonEmprise\(/.test(code.slice(j, j + 500)), '`viseeAuSol` lit encore le MNT en priorite')
})

test('⑫f LE RIDEAU NE SE LÈVE PAS SUR UNE APPLICATION VIVANTE', () => {
  // ⚠️ **C'EST LA MOITIÉ DE LA TÂCHE 2 QUI DEVENAIT BLOQUANTE ICI** — le plan le
  // dit mot pour mot : « le rideau reviendrait par-dessus une application
  // vivante ». La carte `#loading` n'est PAS supprimée pour autant : elle garde
  // le PREMIER chargement, celui où il n'y a encore rien à regarder. La Tâche 2
  // reste donc à faire, et ce test dit exactement où on en est.
  const code = sansCommentaires(lire('src/main.js'))
  assert.ok(/function regenerateTerrain\(\{ sansRideau = false \} = \{\}\)/.test(code),
    '`regenerateTerrain` n\'a plus son mode sans rideau')
  assert.ok(/if \(!sansRideau\) showLoading\(\)/.test(code), 'le rideau se leve de nouveau sans condition')
  assert.ok(/if \(!sansRideau\) hideLoading\(\)/.test(code), 'le rideau se baisse de nouveau sans condition')
  assert.ok(/if \(!enVol\) showLoading\(\)/.test(code), '`fetchAndBuildDem` leve de nouveau le rideau en vol')
  // et le rideau existe TOUJOURS pour le premier chargement — la Tâche 2 n'est
  // pas faite, et prétendre le contraire serait le pire des deux
  assert.ok(/showLoading\(\)/.test(code), 'la carte `#loading` a disparu : c\'est la Tache 2, pas celle-ci')
})

test('⑫g AUCUNE COMPOSANTE DE COULEUR N\'EST NaN — sur les DEUX chemins et sur l\'emprise 3×3', async () => {
  // ⚠️ **CE TEST DIT CE QUE ⑧c NE POUVAIT PAS DIRE.** ⑧c compare les deux
  // chemins : il passe si les deux rendent NaN au même endroit. Celui-ci exige
  // qu'il n'y en ait AUCUN. Rejoué avant d'être écrit : sur le banc de ⑧c il
  // passait DÉJÀ (zéro NaN sur 12 675 et 13 446 composantes).
  //
  // ⚠️ **ET C'EST POURQUOI IL NE SUFFIT PAS : IL NE MORD PAS.** Vérifié le
  // 2026-08-21, la borne `Math.max(0, hn)` retirée de `_ecrireRelief` : ses
  // deux bancs restent VERTS, et seule la lecture de source de sa dernière
  // ligne rougit. **C'est ⑫h qui garde le COMPORTEMENT** — un champ alpin,
  // 421 sommets sous `minH`, et un rouge sur la couleur. Celui-ci garde ce
  // qu'il sait garder : qu'aucun des deux chemins n'introduit de NaN seul.
  const { Terrain } = await import('../src/terrain.js')
  const nbNaN = (t) => {
    const c = t.mesh.geometry.attributes.color.array
    let n = 0
    for (let i = 0; i < c.length; i++) if (!Number.isFinite(c[i])) n++
    return n
  }
  // ① les deux chemins de ⑧c
  for (const continu of [false, true]) {
    const { t, p } = await terrainDeBanc(continu)
    t.setDem(demBouchon(64, 20))
    t.rebuild(p)
    assert.equal(nbNaN(t), 0, `${continu ? 'fenetre' : 'production'} : des couleurs NaN`)
  }
  // ② et l'emprise 3×3, dont les extrema viennent d'un `dem.minM/maxM`
  //    QUANTIFIÉ au demi-mètre — c'est la seule branche où `hn` peut être < 0.
  const p3 = {
    ...PARAMS_TERRAIN, detailScale: 0.5,
    amplitude: 6, scale: 0.05, octaves: 4, lacunarity: 2.1, gain: 0.5, warp: 2,
  }
  const d = demBouchon(192, 20)
  d.empriseCote = 3
  // la quantification de `dem.js`, et un plancher DÉLIBÉRÉMENT relevé d'un mètre
  // au-dessus du vrai minimum : c'est exactement l'état que produit un grain FBM
  // qui descend sous des extrema arrondis.
  d.minM = Math.round((d.minM + 1) * 2) / 2
  d.maxM = Math.round(d.maxM * 2) / 2
  const t3 = new Terrain(p3)
  t3.setDem(d)
  t3.rebuild(p3)
  assert.equal(nbNaN(t3), 0, 'emprise 3x3 a extrema quantifies : des couleurs NaN')
  // et la borne est bien dans le code, pas seulement dans le résultat
  //
  // ⚠️ **LA LOI A DÉMÉNAGÉ — Tâche P3, et l'assertion la suit.** La valeur par
  // sommet vit désormais dans `src/monde/eclairage-crop.js` (`natGris`), que le
  // crop du globe INJECTE en GLSL et que `terrain.js` APPELLE : une écriture,
  // deux lecteurs. On exige donc les DEUX faits — la borne dans le module, et la
  // délégation dans `terrain.js` — sans quoi il suffirait de réécrire la formule
  // sur place pour que cette ligne reste verte.
  const src = sansCommentaires(lire('src/terrain.js'))
  assert.ok(/let v = natGris\(hn, ny\)/.test(src), '`_ecrireRelief` ne délègue plus à `natGris`')
  const loi = sansCommentaires(lire('src/monde/eclairage-crop.js'))
  assert.ok(
    /Math\.pow\(Math\.max\(0, hn\), GRIS_EXPO\)/.test(loi),
    'la borne de `hn` a disparu de `natGris`'
  )
  assert.ok(
    /pow\(max\(hn, 0\.0\), \$\{GRIS_EXPO\}\)/.test(loi),
    'la borne de `hn` a disparu du GLSL de `natGris`'
  )
})

// ══════════ ⑫h — LE BANC QUI MORD ══════════════════════════════════════════
//
// ⚠️ **⑫g NE MORDAIT PAS, ET C'EST MESURÉ.** Le 2026-08-21 la borne
// `Math.max(0, hn)` a été retirée de `_ecrireRelief` et ⑫g relancé : ses DEUX
// bancs sont restés VERTS, et seule sa dernière ligne — une lecture de la
// source — rougissait. Un test qui ne tient plus que par un `grep` ne garde
// rien : il s'éteint au premier renommage, et il annonce une couverture qu'il
// n'a pas.
//
// Ce qui protégeait ⑫g, c'est `landFactor = smoothstep(0, 90, raw)` de
// `_makeGridSampler` : sur `demBouchon`, le point le plus bas du champ est à
// −1 130 m, le grain FBM y est donc multiplié par ZÉRO, et le sommet du fond de
// champ vaut EXACTEMENT `minH`. Relever `dem.minM` d'un mètre — ce que fait
// ⑫g ② — n'y change rien : le grain qui devait franchir cet écart n'existe pas
// à cet endroit-là.
//
// **Le banc ci-dessous retire cette protection sans rien truquer** : un champ
// ALPIN, dont aucun point n'est sous 90 m — la situation de toute emprise de
// montagne, c'est-à-dire du cas d'usage principal de l'application. `landFactor`
// y vaut 1 PARTOUT, grain compris au minimum du champ. Et comme la branche
// `empriseCote > 1` remplace `minH` par `(dem.minM − meanM)·échelle` — le
// minimum du champ SANS grain — tout sommet posé sur le fond plat de la cuvette
// et tiré vers le bas par le grain passe SOUS `minH`.
//
// Mesuré le 2026-08-21 : **421 à 433 sommets sur 4 225** selon la graine,
// `hn` minimal −2,9·10⁻⁴, sur les DEUX chemins. Sans la borne, autant de
// `Math.pow(négatif, 0.85)`, donc autant de sommets NaN.

/**
 * Un MNT ALPIN — cuvette à fond PLAT, et **aucun point sous 90 m**.
 *
 * ⚠️ Le fond plat n'est pas une commodité : c'est ce qui rend le banc
 * insensible à la graine. Un minimum PONCTUEL ne mordrait que si le grain y est
 * négatif — une chance sur deux, mesurée (graines 7 et 11 : rien ; 42 et 101 :
 * un sommet). Le plateau met ~800 pixels à l'altitude minimale exacte, dont
 * quatre cents et quelques sous le grain, quelle que soit la graine.
 *
 * ⚠️ `size = 193` et non 192 : à `empriseCote = 3`, la géométrie de res 64 lit
 * les pixels `64…128` PAR PAS D'UN PIXEL EXACTEMENT (`(size − 1) / 3 = 64`).
 * Un sommet tombe donc SUR le pixel, sans interpolation qui remonterait
 * doucement au-dessus du minimum.
 */
function demAlpin (size, mpp) {
  const data = new Float32Array(size * size)
  const c = (size - 1) / 2
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const r = Math.hypot(x - c, y - c) / (c * Math.SQRT2)
      const m = Math.max(0, r - 0.12) / 0.88 // 0 sur le fond plat
      data[y * size + x] = 300 + 1200 * m + 40 * m * Math.sin(x * 2.3 + y * 1.7)
    }
  }
  let min = Infinity
  let max = -Infinity
  let s = 0
  for (const v of data) { if (v < min) min = v; if (v > max) max = v; s += v }
  return { data, size, metersPerPixel: mpp, extentMeters: mpp * size, minM: min, maxM: max, meanM: s / data.length, empriseCote: 3 }
}

test('⑫h UN SOMMET SOUS `minH` REND UNE COULEUR FINIE — le banc qui MORD', async () => {
  const res = PARAMS_TERRAIN.resolution
  const nappe = (res + 1) ** 2
  for (const continu of [false, true]) {
    const { t } = await terrainDeBanc(continu)
    // ⚠️ `detailScale` EST OBLIGATOIRE ICI, et ⑫g ② le savait sans le dire : à
    // `empriseCote > 1` le grain passe par `accordeDetailScale`, qui rendrait
    // NaN sur un `detailScale` absent — un NaN de RELIEF, pas de couleur, et le
    // banc mesurerait le mauvais défaut.
    const p = { ...PARAMS_TERRAIN, globeContinu: continu, detailScale: 0.5 }
    t.setDem(demAlpin(193, 20))
    t.rebuild(p)

    // ① LE BANC MORD-IL ENCORE ? Sans cette ligne, un jour où `landFactor`,
    //    l'échelle ou le grain changent, le test ci-dessous resterait vert en
    //    ne prouvant plus rien — c'est exactement ce qui est arrivé à ⑫g.
    const minH = t.mapUniforms.uHeightRange.value.x
    const pos = t.mesh.geometry.attributes.position.array
    let sous = 0
    for (let i = 0; i < nappe; i++) if (pos[i * 3 + 1] < minH) sous++
    assert.ok(sous > 0,
      `${continu ? 'fenetre' : 'production'} : plus aucun sommet sous minH — ce banc ne prouve plus rien`)

    // ② ET LA COULEUR RESTE FINIE. `Math.pow(x, 0.85)` rend NaN pour x < 0, et
    //    un NaN dans l'attribut `color` ne lève RIEN : il peint le sommet noir
    //    ou transparent selon le pilote, sans une ligne de journal.
    const col = t.mesh.geometry.attributes.color.array
    for (let i = 0; i < col.length; i++) {
      assert.ok(Number.isFinite(col[i]),
        `${continu ? 'fenetre' : 'production'} : color[${i}] vaut ${col[i]} — ${sous} sommets sont sous minH`)
    }
  }
})

// ══════════ ⑬ LA BATHYMÉTRIE DANS LE FLUX — Tâche 6 sexies ══════════════════
//
// ⚠️ **CE QUI MANQUAIT AU SOCLE, MESURÉ ET NON SUPPOSÉ.** Le bilan de la
// Tâche 6 quinquies : sur la TERRE le quadtree et le MNT s'accordent à 1,1–2,4 m
// de moyenne ; **en MER l'écart valait 642 m (Nice) à 961 m (La Réunion), et son
// maximum EXACTEMENT `|dem.minM|`** — le quadtree rendait zéro au point le plus
// profond. Rejoué le 2026-08-21 avec les VRAIES données
// (`.banc/rejeu-6sexies.mjs`, hors dépôt : tuiles AWS + `public/data/bathy/`) :
// **485,7 m à La Réunion, 615,0 m à Nice, 0,00 m sur la terre**, maximum égal à
// `|minM|` des deux côtés.
//
// ⚠️ **ET LE TEST VA JUSQU'À LA NAPPE, PAS SEULEMENT JUSQU'AU FLUX.** `⑬a` prouve
// que `majHauteurs` écrit des `y` NÉGATIFS, c'est-à-dire que la mer arrive
// jusqu'à la géométrie que `plinth.js`, les bateaux et le drapage GPX lisent par
// `terrain.sample`. Un flux juste dont la fenêtre ne verrait rien serait un
// défaut MUET, exactement comme celui que ⑩f et ⑩g gardent.

/**
 * Un bouchon DOM + réseau minimal, le temps d'une nappe bathymétrique.
 *
 * ⚠️ **LE FOND EST EN PENTE, ET CE N'EST PAS DÉCORATIF.** `appliquerHauteurs`
 * centre les `y` sur `fenetre.moyenneM` : un fond UNIFORME rendrait une nappe
 * strictement plate à `y = 0`, exactement comme une mer plate — le test
 * passerait sur `minM` et ne prouverait rien sur la géométrie. Mesuré : première
 * version de ⑬a, zéro sommet sous le niveau avec un fond à −1800 m partout.
 */
async function avecBathyBouchon (profondeurDe, fn) {
  const { encodeTerrarium } = await import('../src/bathy.js')
  const dalle = new Uint8ClampedArray(256 * 256 * 4)
  for (let j = 0; j < 256; j++) {
    for (let i = 0; i < 256; i++) {
      const [er, eg, eb] = encodeTerrarium(profondeurDe(i, j))
      const k = (j * 256 + i) * 4
      dalle[k] = er; dalle[k + 1] = eg; dalle[k + 2] = eb; dalle[k + 3] = 255
    }
  }
  const avant = {
    document: globalThis.document,
    fetch: globalThis.fetch,
    createImageBitmap: globalThis.createImageBitmap,
  }
  globalThis.document = {
    createElement: () => {
      const c = { width: 0, height: 0 }
      c.getContext = () => ({ drawImage () {}, getImageData: () => ({ data: dalle }) })
      return c
    },
  }
  globalThis.createImageBitmap = async (b) => b
  globalThis.fetch = async (url) => {
    if (!String(url).startsWith('data/bathy/')) return { ok: false, status: 404 }
    if (String(url).endsWith('index.json')) return { ok: false, status: 404 } // z8 partout
    return { ok: true, status: 200, blob: async () => ({ url, width: 256, height: 256 }) }
  }
  try {
    return await fn()
  } finally {
    globalThis.document = avant.document
    globalThis.fetch = avant.fetch
    globalThis.createImageBitmap = avant.createImageBitmap
  }
}

test('⑬a LA MER ARRIVE JUSQU\'À LA NAPPE — le socle porte des `y` sous le niveau', async () => {
  const { construireFenetre, majHauteurs } = await import('../src/monde/fenetre-bornee.js')
  const { demanderBathy } = await import('../src/monde/flux-terrain.js')
  const { _resetTileCaches } = await import('../src/dem.js')

  // ⚠️ **UNE EMPRISE OCÉANIQUE, ET LE TERRARIUM Y VAUT ZÉRO EXACT** — c'est ce
  // que `dem.js` a mesuré au large de Toulon (« la tuile est à 100 % à zéro
  // exact »), et c'est ce que `fuseBathymetry` lit comme une ABSENCE DE MESURE.
  const LAT = 42.5
  const LON = 6.0
  const ZOOM = 12
  const { emprise, flux } = await fluxDuBloc(LAT, LON, ZOOM)
  for (const t of flux.globe.tiles.values()) t.heights.fill(0)

  const n = 64
  const fenetre = construireFenetre({ emprise, n, rayonCoin: 0, exageration: 2.8 })

  // ① AVANT LA NAPPE — la mer est PLATE, et c'est le régime d'aujourd'hui.
  majHauteurs(fenetre, flux)
  assert.equal(fenetre.minM, 0, `minM ${fenetre.minM} : le témoin n'est pas une mer plate`)
  const platY = fenetre.geometrie.slice()
  const tampon = fenetre.geometrie

  // ② LA NAPPE ARRIVE — et elle est LOCALE : aucune attente réseau lointaine.
  await avecBathyBouchon((i, j) => -400 - 2400 * ((i + j) / 510), async () => {
    _resetTileCaches()
    const t0 = performance.now()
    const peinte = await demanderBathy(flux, { emprise, zoom: ZOOM })
    const msNappe = performance.now() - t0
    assert.ok(peinte, 'aucune tuile bathy peinte : le bouchon ne sert rien')
    assert.ok(msNappe < 500, `${msNappe.toFixed(0)} ms pour une nappe LOCALE de 9 tuiles`)
    const t1 = performance.now()
    majHauteurs(fenetre, flux)
    fenetre.msRemplissage = performance.now() - t1
  })

  // ③ ET LE FOND EST LÀ, DANS LA GÉOMÉTRIE — pas seulement dans `hauteursM`.
  assert.ok(fenetre.minM < -1000, `minM ${fenetre.minM} m : la mer est restée plate`)
  let sousZero = 0
  for (let i = 0; i < (n + 1) ** 2; i++) if (fenetre.geometrie[i * 3 + 1] < 0) sousZero++
  assert.ok(sousZero > 0, 'aucun sommet sous le niveau : la mer n\'atteint pas la géométrie')
  let bouge = 0
  for (let i = 0; i < (n + 1) ** 2; i++) if (fenetre.geometrie[i * 3 + 1] !== platY[i * 3 + 1]) bouge++
  assert.ok(bouge > (n + 1) ** 2 * 0.9, `${bouge} sommets sur ${(n + 1) ** 2} ont bougé : la fusion n'a touché qu'un coin`)

  // ④ ET SANS RECONSTRUIRE : le tampon de la fenêtre est le MÊME, PAR
  //    RÉFÉRENCE, avant et après l'arrivée de la mer. ⚠️ La nappe ne fait PAS
  //    (n+1)²·3 flottants — elle porte aussi l'anneau de jupe (12 675 contre
  //    13 446 relevés) : comparer une longueur au lieu d'une identité aurait
  //    échoué pour la mauvaise raison, et c'est arrivé.
  assert.equal(fenetre.geometrie, tampon, 'la fusion a réalloué la géométrie')
})

test('⑬c `main.js` LIT `revisionFlux` — il ne recompte pas les tuiles lui-même', () => {
  // ⚠️ **SANS CETTE ASSERTION, LA MUTATION VIT DANS UN ANGLE MORT.** Aucun test
  // ne charge `main.js` (le §0 le dit), donc remettre le signal de raffinement
  // sur le seul COMPTE de tuiles d'altitude n'aurait rougi nulle part : la mer
  // serait chargée, fusionnable, et jamais redessinée. Mesuré au banc de
  // mutation du 2026-08-21 : la mutation n° 6 SURVIVAIT à toute la suite.
  const src = sansCommentaires(lire('src/main.js'))
  assert.ok(/revisionFlux/.test(src), '`main.js` n\'importe plus `revisionFlux`')
  assert.ok(
    /tuilesLisiblesDuSocle\s*=\s*\(flux\)\s*=>\s*revisionFlux\(flux\)/.test(src),
    'le signal de raffinement du socle ne passe plus par `revisionFlux` : la mer n\'atteindra pas l\'écran'
  )
  assert.ok(
    !/for\s*\(const t of flux\.reclamees\.values\(\)\)/.test(src),
    '`main.js` recompte les tuiles lui-même : deux lois pour un seul signal'
  )
})

test('⑬b MUTATION PERMANENTE — un flux SANS nappe rend exactement le relief nu', async () => {
  // ⚠️ **C'EST LA MUTATION QUE LE PLAN DEMANDE, EN TEST PERMANENT** : retirer la
  // fusion doit ramener la mer plate. Un flux dont `bathy` est absent est
  // littéralement le dépôt d'avant la Tâche 6 sexies, et c'est aussi l'état
  // d'une emprise sans une seule tuile bathy cuite — le cas NORMAL en pleine
  // terre. Les deux doivent rendre le terrarium au bit près.
  const { construireFenetre, majHauteurs } = await import('../src/monde/fenetre-bornee.js')
  const { emprise, flux } = await fluxDuBloc(45.8326, 6.8652, 12)
  const n = 48
  const a = construireFenetre({ emprise, n, rayonCoin: 0, exageration: 2.8 })
  majHauteurs(a, flux)
  const ref = a.hauteursM.slice()

  flux.bathy = { prete: true, peintes: 0 } // nappe demandée, RIEN de peint
  const b = construireFenetre({ emprise, n, rayonCoin: 0, exageration: 2.8 })
  majHauteurs(b, flux)
  for (let k = 0; k < ref.length; k++) {
    assert.equal(b.hauteursM[k], ref[k], `hauteur ${k} : une nappe VIDE a modifié le relief`)
  }
})
