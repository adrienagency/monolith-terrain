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

const LES_QUATRE = ['src/terrain.js', 'src/ocean.js', 'src/gpx.js', 'src/main.js']

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
  const attendu = { 'src/terrain.js': 5, 'src/ocean.js': 2, 'src/gpx.js': 1, 'src/main.js': 6 }
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
      // ⚠️ Des composantes de `color` sortent NaN des DEUX côtés sur ce MNT
      // bouchon (`Math.pow(hn, 0.85)` avec `hn < 0`, `terrain.js:_ecrireRelief`).
      // C'est un défaut PRÉEXISTANT, mesuré identique sur les deux chemins : on
      // le constate ici au lieu de le masquer.
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

test('⑧f LE DRAPEAU EST ÉTEINT, et sans lui la fenêtre n\'existe même pas', async () => {
  const { FLAGS } = await import('../src/flags.js')
  assert.equal(FLAGS.globeContinu, false, 'le branchement ne part pas en production tant qu\'Adrien ne l\'a pas vu')
  const { t, p } = await terrainDeBanc(false)
  t.setDem(demBouchon(64, 20)); t.rebuild(p)
  assert.equal(t.fenetreBornee, null, 'la fenêtre a été fabriquée sans le drapeau')
  assert.equal(t.mesh.geometry.drawRange.count, Infinity, 'le chemin de production ne borne rien')
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
  assert.ok(/demanderEmprise\(flux, \{ emprise, zoom: params\.demZoom \}\)/.test(code), 'le socle ne demande plus le zoom du bloc')
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

test('⑩i LE DRAPEAU EST ÉTEINT, ET IL EXIGE `?globe=continu`', async () => {
  const { FLAGS, socleQuadtreeActif } = await import('../src/flags.js')
  // ⚠️ **UN RÉGIME MESURÉ FAUX NE PART PAS SOUS LE DRAPEAU QU'ON DEMANDE À
  // ADRIEN D'OUVRIR** — c'est la discipline de la Tâche 6 bis A, et la mesure
  // qui l'exige ici est la BATHYMÉTRIE : 642 m (Nice) à 961 m (La Réunion)
  // d'écart moyen en mer, le fond marin lu à zéro. Voir `flags.js`.
  assert.equal(FLAGS.socleQuadtree, false, 'le socle quadtree ne part pas en production tant que la mer est plate')
  assert.equal(FLAGS.globeContinu, false)
  // sans `globe=continu` il n'y a pas de fenêtre à remplir : la fonction le dit
  // elle-même, et pas seulement par convention.
  assert.equal(typeof socleQuadtreeActif, 'function')
  assert.equal(socleQuadtreeActif(), false, 'les deux drapeaux sont éteints : la fonction doit rendre faux sous node')
  const src = lire('src/flags.js')
  assert.ok(/socleQuadtreeActif\(\)\s*\{\s*\n?\s*if \(!globeContinuActif\(\)\) return false/.test(src), 'le socle quadtree ne dépend plus de la fenêtre bornée')
  // ⚠️ et `main.js` ne pose le crochet QUE derrière ce drapeau — sinon
  // `?globe=continu` perdrait la bathymétrie sans que personne l'ait demandé.
  const code = sansCommentaires(lire('src/main.js'))
  assert.ok(/if \(socleQuadtreeActif\(\)\) terrain\.hauteursDeFlux\s*=/.test(code), 'le crochet n\'est plus derrière son drapeau')
})
