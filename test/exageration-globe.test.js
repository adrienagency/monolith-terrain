// L'EXAGÉRATION UNIQUE — Tâche E du plan « UNE SEULE TERRE »
// (`docs/superpowers/plans/2026-08-21-terre-unique.md`).
//
// ══════════ CE QUE CE FICHIER VÉRIFIE ═══════════════════════════════════════
//
// Le globe passait son relief à l'exagération **18** (`globe.js`,
// `params.globeExaggeration ?? 18`) pendant que le socle le passait à **2,8**
// (`BASE_EXAG`) — le facteur **6,4** du §3 du plan. La Tâche B a regardé l'écran
// et l'a chiffré : **l'objet est DEBOUT**, près de cinq fois plus haut que large.
// Cette tâche branche le globe sur le partage (`monde/exageration-continue.js`),
// dont il devient le **quatorzième lecteur**.
//
//   ① LE PILOTE — `zc = demZoom + f`, et il est BORNÉ PAR CONSTRUCTION.
//   ② IL NE REFERME AUCUNE BOUCLE — et c'est mesuré des deux côtés : le nouveau
//      pilote rejoue la table d'Adrien sur toute la descente, l'ancien s'en
//      écarte puis GÈLE à 2,8.
//   ③ LE GLOBE EST LE QUATORZIÈME LECTEUR — et il ne bouge PAS sans drapeau.
//   ④ LA MESURE DE CONTRÔLE — le rapport hauteur/largeur du bloc. **Un bloc doit
//      redevenir un bloc.**
//   ⑤ LES MUTATIONS — remettre 18 tue ④b ; retirer une surcharge tue ③c.
//
// ══════════ POURQUOI LE PILOTE EST `_levelZoom`, ET PAS LA DISTANCE ═════════
//
// ⚠️ **DEUX PILOTES ONT DÉJÀ ÉCHOUÉ, ET LE TROISIÈME A ÉTÉ REJOUÉ AVANT D'ÊTRE
// ÉCRIT.** Piloté par l'altitude de cadrage il DIVERGE (gain 1,44, test ③ de
// `fenetre-branchee.test.js`) ; piloté par la largeur de sol visible
// (`zoomCadrage`) il GÈLE à 2,8 — mesuré à l'écran, et **rejoué ici** par le
// test ②b, qui referme la boucle à la main.
//
// ⚠️ **LA CAUSE EST STRUCTURELLE, ET ELLE N'ÉPARGNE AUCUNE GRANDEUR DE LA
// CAMÉRA** : au cran, `poseCranContinu` (`loi-altitude.js`) repose la caméra à
// `camY × facteurEchelle`, et `facteurEchelle` **contient le rapport des
// exagérations**. Toute quantité tirée de la pose d'après-cran — distance,
// hauteur de caméra, distance horizontale — porte donc l'exagération et referme
// la boucle. C'est cette mesure qui a écarté `f = log2(dRef / d)`, pourtant la
// forme la plus évidente, AVANT de l'implémenter.
//
// ⚠️ **`_levelZoom` (`modes.js:222`) EST LA SEULE GRANDEUR PROPRE**, et ce n'est
// pas un choix esthétique : `_rescale` l'écrase à zéro (`_resetZoom`) à CHAQUE
// cran, et `_applyZoom` ne lui ajoute que le RAPPORT de distance du glissé
// (`log(newDist / dist)`). Le repositionnement du cran n'y entre jamais. Elle est
// de plus DÉJÀ bornée à `[-STEP_IN, STEP_OUT] = [-ln2, +ln2]` par `_applyZoom` :
// `f = -_levelZoom / ln2` vit donc dans `[-1, +1]` **sans qu'on ait à poser de
// garde-fou**, et `zc = demZoom + f` dans `[z-1, z+1]`.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  zoomCran,
  majExagerationCran,
  PAS_NIVEAU,
  courbeExageration,
  exagPalier,
  creerExagerationPartagee,
  poserExageration,
  surchargesStockees,
  zoomCadrage,
  EXAG_BASE,
} from '../src/monde/exageration-continue.js'
import { distanceArrivee, empriseBlocM, DISTANCE_MAX_SURFACE } from '../src/loi-altitude.js'
import { construireSolideCrop } from '../src/monde/parois-crop.js'
import { repereCrop, coinNormalise } from '../src/monde/crop-sphere.js'
import { exposantCoin } from '../src/fenetre-clip.js'
import { Globe } from '../src/globe.js'

const lire = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

const courbe = courbeExageration()

// ══════════ ① LE PILOTE — BORNÉ PAR CONSTRUCTION ════════════════════════════

test('① au repos (`_levelZoom = 0`) le pilote rend EXACTEMENT le cran', () => {
  for (let z = 3; z <= 15; z++) {
    assert.equal(zoomCran({ demZoom: z, zoomNiveau: 0 }), z, `z=${z}`)
  }
})

test('①b aux deux butées du niveau il rend EXACTEMENT le cran voisin', () => {
  // ⚠️ **C'EST LA CONTINUITÉ DU CRAN, ET ELLE EST EXACTE, PAS APPROCHÉE.** À la
  // butée d'entrée `_levelZoom = -ln2` : `zc = z + 1`. Le cran tombe alors,
  // `demZoom` devient `z + 1` et `_resetZoom()` remet `_levelZoom` à zéro :
  // `zc = (z + 1) + 0 = z + 1`. **La même valeur des deux côtés** — l'exagération
  // ne saute pas, ce qui est la décision 14 mot pour mot.
  for (let z = 3; z <= 14; z++) {
    assert.equal(zoomCran({ demZoom: z, zoomNiveau: -PAS_NIVEAU }), z + 1, `butée IN z=${z}`)
    assert.equal(zoomCran({ demZoom: z, zoomNiveau: +PAS_NIVEAU }), z - 1, `butée OUT z=${z}`)
  }
  assert.equal(PAS_NIVEAU, Math.LN2, '`STEP_IN` de `modes.js` vaut `Math.LN2`')
})

test('①c BORNÉ PAR CONSTRUCTION — même nourri d\'absurdités', () => {
  for (const l of [-100, -1e9, 100, 1e9, 1e-300]) {
    const zc = zoomCran({ demZoom: 9, zoomNiveau: l })
    assert.ok(zc >= 8 && zc <= 10, `_levelZoom=${l} → zc=${zc}, hors de [z-1, z+1]`)
  }
  // …et il ne rend jamais NaN sur une entrée illisible : il retombe sur le cran.
  for (const l of [NaN, undefined, null, 'x']) {
    assert.equal(zoomCran({ demZoom: 9, zoomNiveau: l }), 9, `_levelZoom=${l}`)
  }
  assert.ok(Number.isNaN(zoomCran({ demZoom: NaN, zoomNiveau: 0 })), 'sans cran, il n\'y a rien à rendre')
})

test('①d `_levelZoom` est bien remis à zéro à CHAQUE cran — sinon la borne ment', () => {
  // ⚠️ **LA BORNE `[z-1, z+1]` NE TIENT QUE PARCE QUE `_rescale` APPELLE
  // `_resetZoom()`.** Sans lui, `_levelZoom` accumulerait d'un niveau à l'autre
  // et le pilote sortirait de sa fenêtre au deuxième cran. C'est une propriété
  // de `modes.js`, pas de ce module : elle se garde donc contre la source.
  const src = sansCommentaires(lire('src/modes.js'))
  const debut = src.indexOf('async _rescale(')
  assert.ok(debut > 0, '`_rescale` a disparu de `modes.js`')
  const corps = src.slice(debut, src.indexOf('\n  }', debut))
  assert.ok(/this\._resetZoom\s*\(\s*\)/.test(corps),
    '`_rescale` ne remet plus `_levelZoom` à zéro — la borne du pilote tombe')
  assert.ok(/_levelZoom\s*=\s*0/.test(src), '`_resetZoom` n\'écrase plus `_levelZoom`')
  // …et la butée du niveau est bien celle qu'on recopie.
  assert.ok(/export const STEP_IN = Math\.LN2/.test(src), '`STEP_IN` a changé de valeur')
  assert.ok(/export const STEP_OUT = Math\.LN2/.test(src), '`STEP_OUT` a changé de valeur')
})

// ══════════ ② IL NE REFERME AUCUNE BOUCLE — ET C'EST MESURÉ ═════════════════

test('② le nouveau pilote ne voit ni exagération, ni échelle, ni distance', () => {
  const src = sansCommentaires(lire('src/monde/exageration-continue.js'))
  const debut = src.indexOf('export function zoomCran')
  assert.ok(debut > 0, '`zoomCran` a disparu')
  const corps = src.slice(debut, src.indexOf('\n}', debut))
  for (const interdit of [/exag/i, /echelle/i, /distance/i, /camY/]) {
    assert.equal(interdit.test(corps), false, `\`zoomCran\` lit ${interdit} — la boucle se referme`)
  }
})

test('②b LA DESCENTE ENTIÈRE — le nouveau rejoue la table, l\'ancien GÈLE à 2,8', () => {
  // ⚠️ **LES DEUX MOITIÉS SONT NÉCESSAIRES.** Sans la seconde on ne saurait pas
  // que la première mesure quelque chose : le pilote de cadrage rend lui aussi
  // la bonne valeur à certains crans.

  // (a) LE NOUVEAU — `_levelZoom` remis à zéro au cran, donc `f = 0`.
  for (let z = 3; z <= 15; z++) {
    const partage = creerExagerationPartagee()
    const v = majExagerationCran(partage, { demZoom: z, zoomNiveau: 0 })
    assert.ok(Math.abs(v - exagPalier(z)) < 1e-9, `cran z${z} : ${v} au lieu de ${exagPalier(z)}`)
  }

  // (b) L'ANCIEN — la boucle refermée à la main, exactement comme `_rescale` la
  //     referme : `d ← d × 2 × (exagAprès / exagAvant)`, `facteurEchelle` de
  //     `poseCranContinu`.
  const LAT = 45
  const dRef = distanceArrivee(DISTANCE_MAX_SURFACE)
  let d = dRef
  let e = courbe(3)
  const vus = []
  for (let z = 3; z <= 12; z++) {
    const dAvant = d / 2 // l'utilisateur a dépensé le budget du niveau
    const eAvant = e
    const zc = zoomCadrage({
      distance: dAvant,
      distanceReference: dRef,
      extentMeters: empriseBlocM({ zoom: z + 1, lat: LAT }),
      lat: LAT,
    })
    e = courbe(zc)
    d = dAvant * 2 * (e / eAvant)
    vus.push(e)
  }
  // ⚠️ **LE GEL EST MESURÉ, PAS AFFIRMÉ** : les six derniers crans (z8 → z13)
  // rendent tous la MÊME valeur, et c'est `EXAG_BASE`.
  const queue = vus.slice(-6)
  assert.equal(new Set(queue.map((x) => x.toFixed(6))).size, 1, `la queue devrait être figée : ${queue}`)
  assert.ok(Math.abs(queue[0] - EXAG_BASE) < 1e-9, `figée à ${queue[0]} au lieu de ${EXAG_BASE}`)
  // …et il s'écarte de la table dès le PREMIER cran : 5 au lieu de 2,5.
  assert.ok(Math.abs(vus[0] - exagPalier(4)) > 1, `premier cran : ${vus[0]} contre ${exagPalier(4)} attendus`)
})

test('②c les surcharges d\'Adrien traversent le nouveau pilote', () => {
  const faux = { getItem: (k) => (k === 'monolith.zoomExag' ? '{"5":3.9,"13":1.4}' : null) }
  const surcharges = surchargesStockees(faux)
  assert.deepEqual(surcharges, { 5: 3.9, 13: 1.4 })
  const partage = creerExagerationPartagee({ surcharges })
  assert.ok(Math.abs(majExagerationCran(partage, { demZoom: 5, zoomNiveau: 0 }) - 3.9) < 1e-9)
  assert.ok(Math.abs(majExagerationCran(partage, { demZoom: 13, zoomNiveau: 0 }) - 1.4) < 1e-9)
  // ⚠️ **ET LE CONTRE-TEST** : sans surcharge, ces deux crans rendent 5 et 2,8.
  const nu = creerExagerationPartagee()
  assert.ok(Math.abs(majExagerationCran(nu, { demZoom: 5, zoomNiveau: 0 }) - 5) < 1e-9)
  assert.ok(Math.abs(majExagerationCran(nu, { demZoom: 13, zoomNiveau: 0 }) - EXAG_BASE) < 1e-9)
})

// ══════════ ③ LE GLOBE EST LE QUATORZIÈME LECTEUR ═══════════════════════════
//
// ⚠️ **`new Globe()` NE TIENT PAS SOUS NODE** — `rebuildRamp` appelle
// `document.createElement('canvas')` au constructeur. On emprunte donc la
// méthode avec un `this` minimal, exactement comme `test/globe-precision.test.js`
// emprunte `_buildMesh`. Ce qui est vérifié, c'est la MÉTHODE, pas le montage.

/** Le `this` minimal dont `majExageration` et `setExaggeration` ont besoin. */
function fauxGlobe({ exagSuivie, exaggeration = 18 }) {
  return {
    exagSuivie,
    exaggeration,
    tiles: new Map(),
    recharges: 0,
    chargeRacines() { this.recharges++ },
    setExaggeration: Globe.prototype.setExaggeration,
    _rechargeTuiles: Globe.prototype._rechargeTuiles,
    majExageration: Globe.prototype.majExageration,
  }
}

test('③ le globe LIT le partage — il ne calcule plus sa propre valeur', () => {
  const src = lire('src/globe.js')
  assert.ok(/import\s*\{[^}]*lireExageration[^}]*\}\s*from\s*'\.\/monde\/exageration-continue\.js'/.test(src),
    '`globe.js` n\'importe pas `lireExageration` — il n\'est pas le quatorzième lecteur')
  const partage = creerExagerationPartagee()
  const g = fauxGlobe({ exagSuivie: true })
  poserExageration(partage, 3.2)
  assert.equal(g.majExageration({ exagPartage: partage }), 3.2)
  assert.equal(g.exaggeration, 3.2)
  assert.equal(g.recharges, 1, 'la géométrie est cuite : elle doit être redemandée')
  // …et une valeur INCHANGÉE ne redemande rien.
  g.majExageration({ exagPartage: partage })
  assert.equal(g.recharges, 1, 'le globe se recharge pour rien')
})

test('③b SANS DRAPEAU, RIEN NE CHANGE — le globe reste à 18', () => {
  const partage = creerExagerationPartagee()
  poserExageration(partage, 3.2)
  const g = fauxGlobe({ exagSuivie: false })
  assert.equal(g.majExageration({ exagPartage: partage }), 18)
  assert.equal(g.exaggeration, 18, 'la production a bougé sans qu\'on ouvre un drapeau')
  assert.equal(g.recharges, 0)
  // …et le défaut du constructeur est toujours 18, écrit noir sur blanc.
  assert.ok(/params\.globeExaggeration\s*\?\?\s*18/.test(lire('src/globe.js')),
    'le défaut de production du globe a changé de valeur')
})

test('③d le CONSTRUCTEUR naît à la bonne échelle — il ne naît pas à 18 puis saute', () => {
  // ⚠️ **CE TEST EXISTE PARCE QUE LA MUTATION « REMETTRE 18 » NE TUAIT RIEN.**
  // Rejouée contre le dépôt (`.banc/mutations-E.mjs`, M1), la remise de
  // `this.exaggeration = params.globeExaggeration ?? 18` au constructeur laissait
  // **les douze tests verts** : ③ emprunte `majExageration` sur un faux globe et
  // ne passe jamais par le constructeur. Le défaut, lui, est réel — un globe né à
  // 18 rendrait au réseau ses 964 tuiles au premier `syncExagToZoom`, pour rien.
  //
  // ⚠️ **ET IL SE VÉRIFIE SUR LE TEXTE, PAS À L'EXÉCUTION** : `new Globe()` appelle
  // `rebuildRamp`, donc `document.createElement`. C'est le patron de
  // `crop-parois.test.js` et de `crop-sphere.test.js`, pour la même raison.
  const src = sansCommentaires(lire('src/globe.js'))
  const debut = src.indexOf('constructor(params = {})')
  assert.ok(debut > 0, 'le constructeur du globe a disparu')
  const ctor = src.slice(debut, debut + 1400)
  assert.ok(/this\.exagSuivie\s*=/.test(ctor), 'le constructeur ne lit plus le drapeau')
  assert.ok(/this\.exaggeration\s*=[\s\S]{0,120}lireExageration\s*\(\s*params\s*\)/.test(ctor),
    'le globe naît encore à sa propre échelle : il sautera au premier cran')
  assert.ok(/globeExaggeration\s*\?\?\s*18/.test(ctor),
    'le défaut SANS DRAPEAU a disparu du constructeur — la production changerait')
})

test('③c le globe suit les surcharges d\'Adrien, cran par cran', () => {
  const faux = { getItem: () => '{"13":1.4}' }
  const partage = creerExagerationPartagee({ surcharges: surchargesStockees(faux) })
  const g = fauxGlobe({ exagSuivie: true })
  majExagerationCran(partage, { demZoom: 13, zoomNiveau: 0 })
  assert.ok(Math.abs(g.majExageration({ exagPartage: partage }) - 1.4) < 1e-9,
    `le globe rend ${g.exaggeration} au lieu de la surcharge 1,4`)
})

// ══════════ ④ LA MESURE DE CONTRÔLE — UN BLOC DOIT REDEVENIR UN BLOC ════════
//
// Le banc est celui de la Tâche B, au caractère près : mêmes réglages produit,
// même relief de synthèse alpin, même repère. Seule l'exagération change.

const HALF = 28
const CORNER = 0.04 * 56
const EXPO = exposantCoin(0.6)
const COIN = coinNormalise(CORNER, HALF)
const RAYON = 100
const RAYON_TERRE_M = 6371000
const CENTRE = { lat: 45, lon: 6.25 }
const REPERE = repereCrop({ centre: CENTRE })
const FORME = { coin: COIN, expo: EXPO }
const relief = (lat, lon) =>
  1200 + 900 * Math.sin((lon - CENTRE.lon) * 700) + 700 * Math.cos((lat - CENTRE.lat) * 820)

/** Le rapport hauteur / largeur du solide LIVRÉ, à une exagération donnée. */
function rapportHL(exag) {
  const s = construireSolideCrop({
    repere: REPERE,
    forme: FORME,
    rayon: RAYON,
    echelle: (RAYON / RAYON_TERRE_M) * exag,
    hauteur: relief,
  })
  const hauteur = s.hautMax - s.baseY
  return { hauteur, largeur: s.largeur, rapport: hauteur / s.largeur }
}

test('④ à l\'exagération du partage, le bloc est plus LARGE que HAUT', () => {
  const apres = rapportHL(EXAG_BASE)
  assert.ok(apres.rapport < 1,
    `hauteur ${apres.hauteur.toFixed(4)} / largeur ${apres.largeur.toFixed(4)} = ${apres.rapport.toFixed(3)}`)
})

test('④b MUTATION — remettre 18 tue ④', () => {
  // ⚠️ **C'EST LE CHIFFRE DE LA TÂCHE B, REJOUÉ.** Elle avait relevé « 0,77 pour
  // 0,164 » sur ce même relief ; le solide LIVRÉ, base comprise, donne **0,8084
  // pour 0,1640, soit un rapport de 4,930**.
  const avant = rapportHL(18)
  const apres = rapportHL(EXAG_BASE)
  assert.ok(avant.rapport > 4,
    `à 18 le bloc devrait être debout : ${avant.rapport.toFixed(3)}`)

  // ⚠️ **LA LARGEUR N'EST PAS TOUT À FAIT INDÉPENDANTE DE L'EXAGÉRATION, ET
  // C'EST MESURÉ, PAS SUPPOSÉ.** L'assertion écrite d'abord ici — « la largeur
  // ne bouge pas » — a ÉCHOUÉ contre le dépôt, et sa cause est géométrique :
  // l'anneau du contour est posé sur la surface DÉPLACÉE, et le déplacement est
  // RADIAL depuis le centre de la planète. Un relief plus haut évase donc le
  // bloc. **Écart mesuré entre ×18 et ×2,8 : +0,6305 %, soit 1,027·10⁻³ unité
  // (19 cm au sol).** C'est deux ordres sous la variation de hauteur (×5,66) :
  // le rapport mesure bien la hauteur, pas la largeur — mais il fallait le
  // chiffrer pour le dire.
  const evasement = avant.largeur / apres.largeur - 1
  assert.ok(evasement > 0 && evasement < 0.01,
    `évasement mesuré ${(evasement * 100).toFixed(4)} % — hors de la fourchette connue`)
  assert.ok(Math.abs(avant.rapport / apres.rapport - avant.hauteur / apres.hauteur) < 0.05,
    'l\'évasement fausserait le rapport s\'il pesait autant que la hauteur')

  // le facteur 6,4 du §3 du plan, retrouvé sur la hauteur AU-DESSUS DE LA BASE
  // (le solide livré, lui, rend 5,656 : la profondeur de la base, elle, ne
  // dépend que de la largeur — `FRACTION_PROFONDEUR`, 7/56).
  const facteur = avant.hauteur / apres.hauteur
  assert.ok(facteur > 5.5 && facteur < 5.8, `facteur mesuré ${facteur.toFixed(3)}, attendu 5,656`)
})
