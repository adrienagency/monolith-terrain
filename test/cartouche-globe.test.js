// LE CARTOUCHE DANS L'ESPACE DU GLOBE — Tâche D16-c.
//
// **Adrien :** « Répare l'apparition de la data autour du socle — données
// Wikipédia et tout le reste, elles n'apparaissent plus. »
//
// ══════════ CE QUE CE FICHIER GARDE ════════════════════════════════════════
//
//   ① LE REPÈRE — la similitude ancrée sur l'ORIGINE du bloc rend le repère du
//      crop, mesuré au navigateur le 2026-08-31 (les six nombres sont dans
//      l'en-tête de `src/monde/cartouche-globe.js`).
//   ② L'ÉCHELLE — une seule homothétie porte TOUTES les longueurs du cartouche.
//      C'est ce qui empêche le « texte de 1 465 km de haut ».
//   ③ LA BASE — la seule conversion portée à la main, et le SENS de sa division.
//   ④ LE CÂBLAGE de `main.js`, LU (aucun test de ce dépôt ne charge `main.js`).

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { ancrageCartouche, baseCartoucheEnBloc } from '../src/monde/cartouche-globe.js'
import { R_GLOBE } from '../src/geo.js'

const MAIN = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')

// Le relevé du navigateur, La Réunion, mode sphère par défaut, 2026-08-31.
const RELEVE = {
  lat: -21.248422235627014,
  lon: 55.7666015625,
  extentMeters: 27354.269019739164,
  span: 56,
  // `globe._parois` — le maillage des parois du crop, DÉJÀ POSÉ par le globe
  position: [77.05483557224011, -36.24123732749129, 52.43209925138887],
  quaternion: [0.7295304024548144, 0.2640562864582355, -0.3859942726668014, 0.4990672208675199],
  k: 0.007667070940797353,
  // `globe._baseYCrop` — le fond du crop, en unités de GLOBE
  baseYCropGlobe: -0.11997935843827294,
  // `plinth.baseY` — le fond du bloc PLAT, en unités de bloc. **Ce n'est PAS la
  // même hauteur**, et c'est tout l'objet de ③.
  plinthBaseY: -17.407432447782675,
}

const proche = (a, b, eps, quoi) =>
  assert.ok(Math.abs(a - b) <= eps, `${quoi} : ${a} au lieu de ${b} (écart ${Math.abs(a - b)})`)

// ═══════════════════════════════════════════════════════════════ ① le repère

test('① l’ancrage rend EXACTEMENT le repère du crop déjà posé par le globe', () => {
  const a = ancrageCartouche(RELEVE)
  for (let i = 0; i < 3; i++) {
    proche(a.position[i], RELEVE.position[i], 1e-9, `position[${i}]`)
  }
  for (let i = 0; i < 4; i++) {
    proche(a.quaternion[i], RELEVE.quaternion[i], 1e-12, `quaternion[${i}]`)
  }
})

test('① l’origine du bloc se pose SUR la sphère, pas dedans ni dessus', () => {
  const a = ancrageCartouche(RELEVE)
  proche(Math.hypot(...a.position), R_GLOBE, 1e-9, 'rayon de l’ancre')
})

test('① l’ancre suit le LIEU — deux lieux, deux ancres', () => {
  const a = ancrageCartouche(RELEVE)
  const b = ancrageCartouche({ ...RELEVE, lat: 45.9, lon: 6.87 })
  assert.ok(Math.hypot(a.position[0] - b.position[0], a.position[1] - b.position[1], a.position[2] - b.position[2]) > 50,
    'l’ancre ne bouge pas d’un lieu à l’autre : le cartouche resterait à La Réunion')
})

// ══════════════════════════════════════════════════════════════ ② l’échelle

test('② UNE seule homothétie porte toutes les longueurs — et c’est `k`', () => {
  const a = ancrageCartouche(RELEVE)
  proche(a.echelle, RELEVE.k, 1e-15, 'échelle')
  // le demi-bloc transporté = la demi-largeur du crop mesurée sur la boîte
  // englobante de `crop-parois` (0,2144811 … 0,2146865 en x)
  proche((RELEVE.span / 2) * a.echelle, 0.21467798634232588, 1e-12, 'demi-bloc transporté')
})

test('② ⛔ LE TEXTE DE 1 465 km — l’échelle NE PEUT PAS être 1', () => {
  // Une hauteur de texte du cartouche vaut 1,5 unité de bloc (`_sideLabel`).
  // Laissée telle quelle dans l'espace du globe, elle ferait
  // 1,5 × ORBITAL_M_PER_UNIT = 95 565 m … de RAYON de planète, soit un texte de
  // **1 465 km** au sol une fois ramené à l'emprise du bloc. C'est le défaut que
  // le brief nomme, et il tient dans cette seule assertion.
  const a = ancrageCartouche(RELEVE)
  assert.ok(a.echelle < 0.01, 'l’échelle vaut 1 : le cartouche est à l’échelle de la PLANÈTE')
  const hauteurTexteGlobe = 1.5 * a.echelle
  proche(hauteurTexteGlobe * 63710, 1.5 * (RELEVE.extentMeters / RELEVE.span), 1e-6,
    'la hauteur de texte ne retombe pas sur ses mètres de bloc')
})

test('② l’échelle suit l’emprise — dézoomer AGRANDIT l’unité de bloc', () => {
  const proche_ = ancrageCartouche(RELEVE)
  const loin = ancrageCartouche({ ...RELEVE, extentMeters: RELEVE.extentMeters * 512 })
  proche(loin.echelle / proche_.echelle, 512, 1e-9, 'rapport des échelles')
})

// ═════════════════════════════════════════════════════════════════ ③ la base

test('③ la base du cartouche est celle du CROP, pas celle du bloc plat', () => {
  const b = baseCartoucheEnBloc(RELEVE.baseYCropGlobe, RELEVE.k, RELEVE.plinthBaseY)
  proche(b, -15.648656359738265, 1e-9, 'base en unités de bloc')
  // ⛔ **1,76 unité d'écart avec `plinth.baseY`, soit 11 % de la profondeur du
  // crop.** Servir le repli ici enterrerait le cartouche sous le fond du crop.
  assert.ok(Math.abs(b - RELEVE.plinthBaseY) > 1.5,
    'la base rendue est celle du bloc plat : le cartouche flottera sous le crop')
})

test('③ ⛔ LE SENS DE LA DIVISION — multiplier au lieu de diviser colle le texte au relief', () => {
  const bon = baseCartoucheEnBloc(RELEVE.baseYCropGlobe, RELEVE.k, RELEVE.plinthBaseY)
  const faux = RELEVE.baseYCropGlobe * RELEVE.k // la mutation
  assert.ok(Math.abs(bon) > 15 && Math.abs(faux) < 0.01,
    'la mutation « × au lieu de ÷ » n’est pas distinguée')
  // et le rapport entre les deux est `1/k²` : 17 013 ici, plus de 13 millions à z16
  assert.ok(Math.abs(bon / faux) > 1e4)
})

test('③ sans crop posé, on retombe sur la base du bloc plat — pas sur NaN', () => {
  // premières images, retour d'orbite : `_baseYCrop` vaut `null`.
  for (const absent of [null, undefined, NaN]) {
    assert.equal(baseCartoucheEnBloc(absent, RELEVE.k, RELEVE.plinthBaseY), RELEVE.plinthBaseY)
  }
  // et une échelle absente ne fabrique pas d'infini
  for (const k of [0, -1, NaN, null]) {
    assert.equal(baseCartoucheEnBloc(RELEVE.baseYCropGlobe, k, RELEVE.plinthBaseY), RELEVE.plinthBaseY)
  }
})

// ═══════════════════════════════════════════════ ④ le câblage de `main.js`, LU

test('④ le cartouche est ADOPTÉ par la scène du globe — sinon rien n’est dessiné', () => {
  // ⛔ **C'EST LA MOITIÉ DU DÉFAUT.** D16-a a supprimé la passe de surface : la
  // scène du bloc n'est plus rendue du tout. Un `setVisible(true)` seul ne
  // montrerait donc RIEN. Le groupe doit changer de scène.
  assert.ok(/sceneGlobe\.add\(groupeCartouche\)/.test(MAIN),
    'le groupe d’ancrage n’est pas adopté par `sceneGlobe` : la passe de surface est éteinte, rien ne sera dessiné')
  assert.ok(/new GroundInfoLayer\(\{\s*\n\s*scene: groupeCartouche,/.test(MAIN),
    '`GroundInfoLayer` ne reçoit plus le groupe d’ancrage')
})

test('④ l’ancrage se REPOSE à chaque image, par la loi et pas à la main', () => {
  const i = MAIN.indexOf('function majCartoucheGlobe(')
  assert.ok(i > 0, '`majCartoucheGlobe` a disparu ou changé de nom')
  const corps = MAIN.slice(i, MAIN.indexOf('\n}', i)).replace(/\/\/[^\n]*/g, '')
  assert.ok(/ancrageCartouche\(\{/.test(corps), 'la loi n’est pas appelée : le repère est recalculé à la main')
  assert.ok(/\.scale\.setScalar\(/.test(corps), 'l’échelle n’est pas posée : le cartouche gardera sa taille de bloc')
  // ⚠️ **ET IL SORT QUAND LE CARTOUCHE EST CACHÉ.** Ce dépôt a déjà eu un
  // indicateur qui tournait 38 s à cause de recalculs empilés ; celui-ci est
  // arithmétique, mais il n'a aucune raison de tourner en orbite.
  assert.ok(/if \(!voulu\) return/.test(corps),
    'l’ancrage se recalcule même caché')
  // ⚠️ **ET IL N'ÉCRIT LA VISIBILITÉ QUE SUR CHANGEMENT** — sous le mode sphère
  // le bloc naît et meurt sur une ALTITUDE, sans qu'aucun des quatre sites
  // d'événement ne se produise ; mais écrire à chaque image serait un second
  // interrupteur permanent.
  assert.ok(/if \(voulu !== groundInfo\.group\.visible\) groundInfo\.setVisible\(voulu\)/.test(corps),
    'la visibilité n’est pas synchronisée sur le crop, ou elle est écrite à chaque image')
  assert.ok(MAIN.indexOf('majCartoucheGlobe()', i) > 0, '`majCartoucheGlobe` n’est jamais appelée')
})

test('④ la base servie au cartouche passe par la conversion, pas par `plinth.baseY` seul', () => {
  const i = MAIN.indexOf('getBaseY: () =>')
  assert.ok(i > 0, '`getBaseY` a disparu ou changé de forme')
  const corps = MAIN.slice(i, MAIN.indexOf('\n  getInk', i)).replace(/\/\/[^\n]*/g, '')
  assert.ok(/baseCartoucheEnBloc\(/.test(corps),
    '`getBaseY` ne convertit plus la base du crop : le cartouche flottera 1,76 unité sous le fond')
})
