// LES COTES D'ALTITUDE SUR LA SPHÈRE — Tâche R24, option 22 « Points cotés ».
//
// ⛔ **CE QUI EST GARDÉ ICI EST UN COMPORTEMENT, PAS UN TEXTE.** Ce dépôt a vu
// une mutation survivre à 4 082 tests derrière une assertion d'expression
// régulière sur le source. Les lois sont donc SORTIES du corps de
// `createLabels` (`repereCote`, `poseCoteGlobe`) pour qu'on puisse les exécuter.
//
// ⚠️ **LE POSEUR DE PAPIER N'EST PAS UNE INVENTION DU TEST** : `creerPoseurGlobe`
// est le vrai, celui de `monde/sol-globe.js`, que les rivières, les toponymes et
// les sommets consomment déjà.
import test from 'node:test'
import assert from 'node:assert/strict'
import { repereCote, poseCoteGlobe, DEGAGEMENT_COTE, createLabels } from '../src/labels.js'
import { creerPoseurGlobe, poseurPlat } from '../src/monde/sol-globe.js'
import { repereGlobe } from '../src/monde/frontiere-rendu.js'
import { EARTH_RADIUS_M } from '../src/geo.js'

// ⚠️ Les grandeurs sont celles RELEVÉES à La Réunion, mode sphère par défaut,
// z12 (`.banc/R24/sol-bloc-vs-globe.json`) : emprise 27 354,269 m, exagération 2,
// `meanM = 440,764`. Elles ne sont pas rondes exprès — un jeu rond masquerait
// une conversion inversée qui rendrait quand même « quelque chose de plausible ».
const EXTENT = 27354.269019739164
const SPAN = 56
const EXAG = 2
const MEAN = 440.76394798946444
const R = 100

function poseurDeTest({ hM = () => 1200, lat = -21.26, lon = 55.74 } = {}) {
  return creerPoseurGlobe({
    sample: () => 0,
    hauteurM: hM,
    // une réciproque JOUABLE : le bloc couvre `EXTENT` mètres pour `SPAN`
    // unités, donc un déplacement de x unités vaut x × EXTENT / SPAN mètres.
    versLatLon: (x, z) => ({
      lat: lat - (z * (EXTENT / SPAN)) / 111320,
      lon: lon + (x * (EXTENT / SPAN)) / (111320 * Math.cos((lat * Math.PI) / 180)),
    }),
    echelleBloc: (SPAN / EXTENT) * EXAG,
    meanM: MEAN,
    exagerationGlobe: EXAG,
    rayon: R,
  })
}

test('① LE REPÈRE LOCAL EST CELUI DU POINT, ET IL EST ORTHONORMÉ', () => {
  const p = poseurDeTest()
  const { est, haut, sud } = repereCote(p, 7, -4, 0.5)
  for (const [nom, v] of [['est', est], ['haut', haut], ['sud', sud]]) {
    assert.ok(Math.abs(v.length() - 1) < 1e-9, `${nom} n’est pas unitaire : ${v.length()}`)
  }
  assert.ok(Math.abs(est.dot(haut)) < 1e-9, 'est et haut ne sont pas orthogonaux')
  assert.ok(Math.abs(est.dot(sud)) < 1e-9, 'est et sud ne sont pas orthogonaux')
  assert.ok(Math.abs(haut.dot(sud)) < 1e-9, 'haut et sud ne sont pas orthogonaux')
})

test('② IL VAUT `repereGlobe` DE `frontiere-rendu.js` — deux chemins, une loi', () => {
  // ⚠️ La confrontation, pas la recopie : `repereCote` dérive le repère de DEUX
  // appels à `placer`, `repereGlobe` l'écrit en sinus et cosinus. S'ils
  // divergent, l'un des deux ment.
  const lat = -21.26, lon = 55.74
  const p = poseurDeTest({ lat, lon })
  const { est, haut, sud } = repereCote(p, 0, 0, 0)
  const ref = repereGlobe(lat, lon)
  const proche = (v, a, nom) => {
    for (let i = 0; i < 3; i++) {
      assert.ok(Math.abs(v.getComponent(i) - a[i]) < 1e-6,
        `${nom}[${i}] : ${v.getComponent(i)} au lieu de ${a[i]} — le repère local n’est pas celui du globe`)
    }
  }
  proche(est, ref.est, 'est')
  proche(haut, ref.haut, 'haut')
  proche(sud, ref.sud, 'sud')
})

test('③ LE REPÈRE SUIT LE POINT, PAS LE CENTRE DU BLOC', () => {
  // ⛔ C'est la raison pour laquelle on n'emploie PAS `poseur.repereLocal()`,
  // qui rend le repère du CENTRE. Sur une emprise large, la verticale du coin
  // n'est plus celle du centre — à z4 (10 600 km) l'écart vaut des dizaines de
  // degrés, et la cote se coucherait sur la tangente d'un autre endroit.
  const p = poseurDeTest()
  const centre = repereCote(p, 0, 0, 0)
  const coin = repereCote(p, 27, 27, 0)
  const angle = Math.acos(Math.min(1, centre.haut.dot(coin.haut))) * (180 / Math.PI)
  assert.ok(angle > 0, 'le repère du coin est identique à celui du centre : il ne suit pas le point')
  // et il reste petit à z12 : ~27 unités = ~13 km, soit ~0,12° sur la sphère
  assert.ok(angle < 1, `écart aberrant : ${angle}°`)
})

test('④ L’ÉCHELLE EST LE `k` DE LA SIMILITUDE — le facteur 130,4 est le défaut', () => {
  const p = poseurDeTest()
  const pose = poseCoteGlobe(p, 3, 2, 1)
  assert.equal(pose.echelle, p.rapportSimilitude())
  // ⚠️ la valeur, pas seulement l'égalité : `k = echelleGlobe / echelleBloc`
  const k = ((R / EARTH_RADIUS_M) * EXAG) / ((SPAN / EXTENT) * EXAG)
  assert.ok(Math.abs(pose.echelle - k) < 1e-15, `k vaut ${pose.echelle} au lieu de ${k}`)
  // ⛔ ET IL EST TRÈS PETIT : oublier la conversion rendrait le plan 1/k fois
  // trop grand. C'est la classe de défaut « facteur 130,4 » du chantier.
  assert.ok(1 / pose.echelle > 100, `1/k = ${1 / pose.echelle} : la mise à l’échelle ne protège plus de rien`)
})

test('⑤ LA POSE MONTE AVEC L’ALTITUDE, ET DANS LE BON SENS', () => {
  // ⛔ le signe inversé est la moitié des sept défauts de conversion du chantier
  const p = poseurDeTest()
  const bas = poseCoteGlobe(p, 0, 0, 0)
  const haut = poseCoteGlobe(p, 0, 0, 1)
  assert.ok(haut.position.length() > bas.position.length(),
    'une cote plus haute ne sort pas plus loin du centre : le signe est inversé')
  // et l'écart vaut EXACTEMENT une unité de bloc convertie — pas un facteur
  // inventé au passage
  const attendu = p.rapportSimilitude()
  assert.ok(Math.abs(haut.position.length() - bas.position.length() - attendu) < 1e-9,
    `l’écart vaut ${haut.position.length() - bas.position.length()} au lieu de ${attendu}`)
})

test('⑥ LE DÉGAGEMENT EST EN UNITÉS DE BLOC, ET IL NE SE CONVERTIT PAS DEUX FOIS', () => {
  // il traverse DANS `y`, avec la position. Une seconde conversion le ferait
  // apparaître en plus du `k` déjà appliqué.
  const p = poseurDeTest()
  const sol = poseCoteGlobe(p, 5, 5, 0)
  const cote = poseCoteGlobe(p, 5, 5, DEGAGEMENT_COTE)
  const monte = cote.position.length() - sol.position.length()
  assert.ok(Math.abs(monte - DEGAGEMENT_COTE * p.rapportSimilitude()) < 1e-9,
    `le dégagement monte de ${monte} au lieu de ${DEGAGEMENT_COTE * p.rapportSimilitude()}`)
})

// ══════════ LA TOPONYMIE FICTIVE — ELLE NE DOIT JAMAIS ATTEINDRE LA SPHÈRE ══
//
// ⚠️ `createLabels` touche le DOM (canevas de texte). On lui en donne un
// MINIMAL plutôt que d'assertionner sur le source : ce dépôt a déjà vu une
// mutation survivre à une garde par expression régulière.
function poseDom() {
  if (globalThis.document) return () => {}
  const ctx = {
    font: '', fillStyle: '', textBaseline: '',
    measureText: (t) => ({ width: t.length * 10 }),
    fillText: () => {},
  }
  globalThis.document = {
    createElement: () => ({ width: 0, height: 0, getContext: () => ctx }),
  }
  return () => { delete globalThis.document }
}

test('⑦ AUCUN NOM DE MONUMENT VALLEY SUR LA SPHÈRE — pas même en mode procédural', () => {
  const rendre = poseDom()
  try {
    const p = poseurDeTest()
    // le pire cas : terrain PROCÉDURAL (`real: false`, celui qui autorise les
    // noms) ET poseur de globe. Avant R24, seul `!real` gardait la porte.
    const g = createLabels(() => 1, 7, { real: false, toFeet: (h) => h * 3.28084, poseur: p })
    // les noms fictifs, ce sont les 8 plans qui ne portent PAS de cote : le
    // bandeau de région + 7 lieux. En mode procédural il y a 9 cotes.
    assert.equal(g.children.length, 9,
      `${g.children.length} plans au lieu de 9 : des noms fictifs sont passés sur la sphère`)
    assert.equal(g.userData.espaceGlobe, true)
    // ⛔ et la marque qui interdit le pas de fenêtre est posée : sans elle,
    // `f3AncreAuSol` ajouterait un décalage de BLOC à des points de SPHÈRE.
  } finally { rendre() }
})

test('⑧ HORS SPHÈRE, RIEN NE CHANGE — le décor procédural est intact', () => {
  const rendre = poseDom()
  try {
    const g = createLabels(() => 1, 7, { real: false, toFeet: (h) => h * 3.28084 })
    assert.equal(g.children.length, 1 + 7 + 9, 'le décor procédural du dépôt a changé')
    assert.equal(g.userData.espaceGlobe, false)
    // le poseur PLAT est l'identité, comme partout ailleurs dans ce dépôt
    const plat = createLabels(() => 1, 7, { real: false, toFeet: (h) => h * 3.28084, poseur: poseurPlat(() => 1) })
    assert.equal(plat.children.length, g.children.length)
    assert.equal(plat.userData.espaceGlobe, false)
  } finally { rendre() }
})

test('⑨ LA COTE ANNONCE LE SOL QUE LE GLOBE DESSINE, pas celui du bloc plat', () => {
  const rendre = poseDom()
  try {
    // ⛔ Le défaut : `sample` (bloc) et `hauteurDessinee` (globe) diffèrent de
    // −72 m à +98,7 m à La Réunion. Ici on les rend franchement différents et on
    // vérifie que c'est le GLOBE qui parle.
    const p = poseurDeTest({ hM: () => 2000 })
    const solBlocFaux = () => -50 // en unités de bloc : très bas, et FAUX
    const g = createLabels(solBlocFaux, 3, { real: true, toFeet: (h) => (h / ((SPAN / EXTENT) * EXAG) + MEAN) * 3.28084, poseur: p })
    assert.equal(g.children.length, 14)
    // chaque cote est posée au rayon du sol dessiné (2 000 m) + le dégagement
    const attendu = R + 2000 * ((R / EARTH_RADIUS_M) * EXAG) + DEGAGEMENT_COTE * p.rapportSimilitude()
    for (const c of g.children) {
      assert.ok(Math.abs(c.position.length() - attendu) < 1e-6,
        `cote posée à ${c.position.length()} au lieu de ${attendu} — elle a suivi le bloc plat`)
      assert.ok(Math.abs(c.scale.x - p.rapportSimilitude()) < 1e-15, 'la cote n’est pas à l’échelle du globe')
    }
  } finally { rendre() }
})
