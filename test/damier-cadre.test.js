// LE CARTOUCHE GRAVÉ S'ÉCARTE AVEC LE DAMIER — et revient quand il se referme.
//
// « Lorsqu'on a plusieurs cases, les blocs se construisent SUR les textes. Il
// faut que les textes s'éloignent tout en restant à la même distance du bloc le
// plus proche qu'ils le sont actuellement. Les textes vont donc s'éloigner vers
// le sud, l'est et l'ouest en fonction de la grille produite. Et se rapprocher
// si je change de vue et que j'ai moins de blocs affichés. » (Adrien)
//
// ⚠️ POURQUOI CE FICHIER EXÉCUTE `GroundInfoLayer` AU LIEU DE SE CONTENTER DE
// LA FONCTION PURE. `ecartTextes` peut être parfaite et le cartouche rester
// collé au bloc central : il suffit qu'un seul des sept anciens `HALF` n'ait pas
// été branché, ou que `setCarre` ne re-pose pas les plans. Une batterie qui ne
// teste que le calcul laisserait passer exactement le défaut qu'Adrien voit à
// l'écran. On instancie donc la VRAIE couche — three.js se construit très bien
// hors navigateur, seul le `document` manque, et il tient en vingt lignes.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { centreDuCarre, ecartTextes } from '../src/damier-carre.js'
import {
  modeCameraDamier,
  doitVraimentDezoomer,
  poseDamier,
  cumuleDezoom,
  SEUIL_SORTIE_ENSEMBLE,
  OUBLI_MOLETTE_MS,
} from '../src/vue-ensemble.js'

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

const TAILLE = 56
const ECART = 0.06 // la marge des plans muraux (ground-info-layer.js, FROLE)
const GAP = 6 // l'anneau de sécurité de la mise au sol

// Les positions sont des sommes de flottants (56*3/2 + 0,06) : on compare à
// 1e-9, ce qui est mille fois plus serré que le millième d'unité auquel ce
// chantier tient déjà ses cotes — « au chiffre près » reste vrai.
const presque = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg || ''} — ${a} ≠ ${b}`)

// ═══════════════════════════════════════════════════════════════════════════
// ① LE CALCUL
// ═══════════════════════════════════════════════════════════════════════════

test('en 1x1 les textes ne bougent pas d\'un pouce', () => {
  const e = ecartTextes({ i0: 0, j0: 0, cote: 1 }, TAILLE, ECART)
  assert.equal(e.sud, TAILLE / 2 + ECART, 'exactement HALF + 0,06, comme avant')
  assert.equal(e.nord, -(TAILLE / 2 + ECART))
  assert.equal(e.est, TAILLE / 2 + ECART)
  assert.equal(e.ouest, -(TAILLE / 2 + ECART))
})

test('en 3x3 les textes s\'ecartent d\'un cote de carre entier', () => {
  const e = ecartTextes({ i0: -1, j0: -1, cote: 3 }, TAILLE, ECART)
  assert.equal(e.sud, (TAILLE * 3) / 2 + ECART)
  // LA DISTANCE AU BLOC LE PLUS PROCHE EST INCHANGÉE : le bloc du bord sud
  // finit en 3*56/2 = 84, le texte est a 84,06. Ecart : 0,06, comme en 1x1.
  presque(e.sud - (TAILLE * 3) / 2, ECART)
  presque(e.est - (TAILLE * 3) / 2, ECART)
  presque(-e.ouest - (TAILLE * 3) / 2, ECART)
})

test('en 2x2 les textes suivent le decalage du carre', () => {
  const c = { i0: -1, j0: -1, cote: 2 }
  const centre = centreDuCarre(c, TAILLE)
  const e = ecartTextes(c, TAILLE, ECART)
  // le bord sud du carre est a centre.z + cote*TAILLE/2
  assert.equal(e.sud, centre.z + (TAILLE * 2) / 2 + ECART)
  assert.notEqual(e.sud, (TAILLE * 2) / 2 + ECART, 'ne pas oublier le decalage')
  // et le carre s'etend vers le NORD-OUEST : c'est de ce cote que ca s'ecarte
  presque(e.ouest, -(TAILLE * 1.5) - ECART, 'le bord ouest a recule d\'un bloc')
  presque(e.sud, TAILLE / 2 + ECART, 'le bord sud est celui du bloc central')
})

test('un 2x2 ancre au sud-est ecarte les textes du cote sud', () => {
  // l'ancrage d'un cote PAIR peut tomber des deux cotes de zero (damier-carre.js)
  const e = ecartTextes({ i0: 0, j0: 0, cote: 2 }, TAILLE, ECART)
  assert.equal(e.sud, TAILLE * 1.5 + ECART)
  assert.equal(e.nord, -(TAILLE / 2) - ECART, 'rien a gagner au nord')
})

test('les textes se rapprochent quand la grille retrecit', () => {
  const large = ecartTextes({ i0: -1, j0: -1, cote: 3 }, TAILLE, ECART)
  const etroit = ecartTextes({ i0: 0, j0: 0, cote: 1 }, TAILLE, ECART)
  assert.ok(etroit.sud < large.sud, 'le retour au 1x1 doit ramener les textes')
})

test('la marge ne se multiplie jamais avec le cote', () => {
  // C'EST LA PROPRIÉTÉ, pas les trois valeurs ci-dessus : « à la MÊME distance
  // du bloc le plus proche ». Un `(demi + marge) * cote` passerait les tests
  // 1×1 et échouerait ici.
  for (const cote of [1, 2, 3, 4, 5]) {
    const i0 = -Math.floor((cote - 1) / 2)
    const e = ecartTextes({ i0, j0: i0, cote }, TAILLE, ECART)
    const c = centreDuCarre({ i0, j0: i0, cote }, TAILLE)
    presque(e.sud - (c.z + (TAILLE * cote) / 2), ECART, `cote ${cote}`)
    presque(e.est - (c.x + (TAILLE * cote) / 2), ECART, `cote ${cote}`)
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// ② LA COUCHE, EXÉCUTÉE
// ═══════════════════════════════════════════════════════════════════════════

// Un `document` de vingt lignes : `textCanvas` ne demande qu'une mesure et un
// contexte muet. Les largeurs sont déterministes (10 px par caractère) pour que
// deux rendus successifs se comparent au chiffre près.
function faitCanvas() {
  const c = { width: 1, height: 1 }
  c.getContext = () => ({
    font: '',
    textBaseline: '',
    textAlign: '',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    globalAlpha: 1,
    measureText: (t) => ({ width: String(t).length * 10 }),
    fillText() {},
    beginPath() {},
    arc() {},
    stroke() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    drawImage() {},
  })
  return c
}
globalThis.document = { createElement: () => faitCanvas(), fonts: { load: async () => {} } }

const THREE = await import('three')
const { GroundInfoLayer } = await import('../src/ground-info-layer.js')

const INFO = {
  name: 'Chamonix',
  country: 'France',
  coord: '45.9231°N  6.8697°E',
  coordDMS: '45°55′N  6°52′E',
  elevation: 'ELEV  1,035 – 3,305 m',
  scale: '1:50 000',
  description: 'Une vallee alpine profonde, cernee de glaciers et de sommets.',
  anecdote: 'Le mont Blanc culmine a 4 808 m.',
  title: 'Chamonix-Mont-Blanc',
}

function faitCouche() {
  const scene = new THREE.Scene()
  const couche = new GroundInfoLayer({
    scene,
    getBaseY: () => -8,
    getInk: () => '#222222',
    getWallInk: () => '#eeeeee',
    wallsVisible: () => true,
  })
  couche.render(INFO)
  return couche
}

// Les plans MURAUX portent renderOrder 6, les plans au SOL renderOrder 4 :
// c'est le seul discriminant stable entre les deux familles.
const murs = (c) => c.meshes.filter((m) => m.renderOrder === 6)
const sols = (c) => c.meshes.filter((m) => m.renderOrder === 4)
const pose = (l) => l.map((m) => [+m.position.x.toFixed(6), +m.position.y.toFixed(6), +m.position.z.toFixed(6), +m.rotation.y.toFixed(6)])
// la rose des vents est le seul plan CARRÉ de 24 unités (le crédit Wikipédia
// fait 24 de large lui aussi, mais pas de haut)
const rose = (c) => sols(c).find((m) => m.geometry.parameters.width === 24 && m.geometry.parameters.height === 24)

test('la couche pose bien les deux familles de plans', () => {
  const c = faitCouche()
  assert.ok(sols(c).length >= 6, 'le cartouche au sol est complet')
  assert.equal(murs(c).length, 2, 'nom + coordonnees graves sur le flanc')
})

test('sur un bloc seul, le flanc grave reste a 28,06 et le cadre a 34', () => {
  const c = faitCouche()
  for (const m of murs(c)) assert.equal(m.position.z, TAILLE / 2 + ECART)
  // le bloc de titre part du bord sud + l'anneau de securite (34) et descend
  const titre = sols(c)[0]
  assert.ok(titre.position.z > TAILLE / 2 + GAP, 'au sud de l\'anneau de securite')
  // la rose des vents est au coin nord-est du cadre
  assert.equal(rose(c).position.x, TAILLE / 2 + GAP + 12)
  assert.equal(rose(c).position.z, -(TAILLE / 2 + GAP) - 12)
})

test('en 3x3 tout le cartouche s\'ecarte d\'un bloc, marges inchangees', () => {
  const c = faitCouche()
  const avant = pose(sols(c))
  const roseAvant = rose(c).position.clone()
  assert.equal(c.setCarre({ i0: -1, j0: -1, cote: 3 }), true, 'le cartouche est re-pose')

  for (const m of murs(c)) assert.equal(m.position.z, (TAILLE * 3) / 2 + ECART, 'le flanc grave suit')
  presque(rose(c).position.x - roseAvant.x, TAILLE, 'la rose recule d\'un bloc vers l\'est')
  presque(rose(c).position.z - roseAvant.z, -TAILLE, '...et d\'un bloc vers le nord')

  // ET LA MARGE N'A PAS BOUGÉ : le texte le plus au sud reste a la meme
  // distance du bord du damier qu'il l'etait du bord du bloc.
  const apres = pose(sols(c))
  const sudAvant = Math.min(...avant.map((p) => p[2])) // le plus au NORD
  const sudApres = Math.min(...apres.map((p) => p[2]))
  presque(sudApres - sudAvant, -TAILLE, 'le bord nord recule d\'un bloc, pas plus')
  const estAvant = Math.max(...avant.map((p) => p[0]))
  const estApres = Math.max(...apres.map((p) => p[0]))
  presque(estApres - estAvant, TAILLE)
})

test('le retour au 1x1 remet chaque texte a sa valeur d\'origine, au chiffre pres', () => {
  const c = faitCouche()
  const solAvant = pose(sols(c))
  const murAvant = pose(murs(c))
  c.setCarre({ i0: -1, j0: -1, cote: 3 })
  assert.notDeepEqual(pose(sols(c)), solAvant, 'le 3x3 a bien deplace quelque chose')
  c.setCarre({ i0: 0, j0: 0, cote: 1 })
  assert.deepEqual(pose(sols(c)), solAvant, 'pas « a peu pres » : a la valeur d\'avant')
  assert.deepEqual(pose(murs(c)), murAvant)
})

test('en 2x2 les textes suivent le centre decale, ils ne se collent pas d\'un cote', () => {
  const c = faitCouche()
  // carre nord-ouest : il s'etend vers -x et -z, le bord sud ne bouge pas
  c.setCarre({ i0: -1, j0: -1, cote: 2 })
  for (const m of murs(c)) assert.equal(m.position.z, TAILLE / 2 + ECART, 'le flanc sud est deja le bon')
  // le nom grave se cale a 6,5 du bord OUEST du damier, pas de celui du bloc
  const nom = murs(c)[0]
  assert.ok(nom.position.x < -TAILLE, `le nom a suivi le bord ouest (x=${nom.position.x})`)

  // …et un 2x2 ancre au sud-est ecarte au sud sans rien gagner au nord
  c.setCarre({ i0: 0, j0: 0, cote: 2 })
  for (const m of murs(c)) presque(m.position.z, TAILLE * 1.5 + ECART)
  presque(rose(c).position.z, -(TAILLE / 2 + GAP) - 12, 'le nord n\'a pas bouge')
})

test('le flanc NORD se mire sur le centre du carre, pas sur l\'origine', () => {
  // Race Studio grave les DEUX flancs : le texte cale a gauche du flanc sud doit
  // se caler a droite du flanc nord. Se mirer sur zero le jetterait hors du mur
  // des que le carre est decale.
  const c = faitCouche()
  c.setRace({ name: 'UTMB', dplus: 10000, dminus: 10000, start: 'CHAMONIX', finish: 'CHAMONIX' })
  c.setCarre({ i0: -1, j0: -1, cote: 2 })
  const ouest = -TAILLE * 2 // le bord ouest du carre
  const est = TAILLE / 2 // …et son bord est
  for (const m of c.raceMeshes) {
    assert.ok(m.position.x >= ouest && m.position.x <= est, `plan course dans le mur (x=${m.position.x})`)
  }
  const sud = c.raceMeshes.filter((m) => m.rotation.y === 0)
  const nord = c.raceMeshes.filter((m) => m.rotation.y !== 0)
  assert.equal(sud.length, nord.length)
  // miroir exact autour du centre du carre (-28)
  for (let i = 0; i < sud.length; i++) assert.ok(Math.abs(sud[i].position.x + nord[i].position.x - 2 * -28) < 1e-9)
})

test('les plans course suivent le damier eux aussi', () => {
  const c = faitCouche()
  c.setRace({ name: 'UTMB', dplus: 10000, dminus: 10000, start: 'CHAMONIX', finish: 'CHAMONIX' })
  const avant = pose(c.raceMeshes)
  const estAvant = Math.max(...c.raceMeshes.map((m) => m.position.x))

  c.setCarre({ i0: -1, j0: -1, cote: 3 })
  for (const m of c.raceMeshes) assert.equal(Math.abs(m.position.z), (TAILLE * 3) / 2 + ECART, 'le flanc a recule')
  // le cartouche d'infos est calé sur le bord EST : il recule d'un bloc entier
  presque(Math.max(...c.raceMeshes.map((m) => m.position.x)) - estAvant, TAILLE, 'le cartouche d\'infos suit le bord est')

  // …et le logo (ici la marque ShibuMap, qui le remplace quand il n'y en a pas)
  // reste CENTRÉ SUR LE FLANC — c'est-à-dire sur le carré, pas sur zéro
  c.setCarre({ i0: -1, j0: -1, cote: 2 })
  const hMarque = 8 * 0.28 // wallH * 0.28
  const marque = c.raceMeshes.filter((m) => Math.abs(m.geometry.parameters.height - hMarque) < 1e-9)
  assert.equal(marque.length, 2, 'la marque est gravee sur les deux flancs')
  for (const m of marque) presque(m.position.x, -TAILLE / 2, 'centree sur le carre 2x2, pas sur zero')

  c.setCarre({ i0: 0, j0: 0, cote: 1 })
  assert.deepEqual(pose(c.raceMeshes), avant, 'et tout revient exactement')
})

// ═══════════════════════════════════════════════════════════════════════════
// ③ LA CHARGE : `onGridChanged` part a CHAQUE dalle
// ═══════════════════════════════════════════════════════════════════════════

test('une rafale de 24 arrivees ne re-pose le cartouche que sur un changement de FORME', () => {
  const c = faitCouche()
  let poses = 0
  const vrai = c.render.bind(c)
  c.render = (i) => { poses++; return vrai(i) }
  // ce que `empriseVivante()` rend au fil d'un remplissage de 5x5 : la forme
  // s'ouvre d'un cran, puis vingt dalles arrivent sans rien changer
  const rafale = [
    { i0: 0, j0: 0, cote: 1 },
    { i0: -1, j0: -1, cote: 2 },
    { i0: -1, j0: -1, cote: 3 },
    { i0: -2, j0: -2, cote: 5 },
  ]
  let n = 0
  for (const forme of rafale) for (let k = 0; k < 6; k++) { c.setCarre(forme); n++ }
  assert.equal(n, 24, '24 arrivees de dalle')
  assert.equal(poses, 3, 'trois formes NOUVELLES, trois poses — pas 24')
  assert.equal(c.setCarre({ i0: -2, j0: -2, cote: 5 }), false, 'et la 25e ne fait rien')
})

test('un carre de meme cote mais de coin different est une forme neuve', () => {
  const c = faitCouche()
  c.setCarre({ i0: -1, j0: -1, cote: 2 })
  assert.equal(c.setCarre({ i0: 0, j0: 0, cote: 2 }), true, 'meme cote, autre coin : a re-poser')
})

// ═══════════════════════════════════════════════════════════════════════════
// ④ QUI GAGNE : LE DAMIER
// ═══════════════════════════════════════════════════════════════════════════

test('le damier l\'emporte sur le resserrement de la zone isolee, sans l\'oublier', () => {
  const c = faitCouche()
  c.setFrameScale(0.5)
  assert.equal(c.group.scale.x, 0.5, 'sur un bloc seul, la zone isolee decide')
  c.setCarre({ i0: -1, j0: -1, cote: 3 })
  assert.equal(c.group.scale.x, 1, 'des que des dalles sont POSEES, le damier decide')
  assert.equal(c.group.scale.z, 1)
  c.setCarre({ i0: 0, j0: 0, cote: 1 })
  assert.equal(c.group.scale.x, 0.5, 'le resserrement etait garde, pas perdu')
})

test('setFrameScale reste sans effet tant que le damier tient le sol', () => {
  const c = faitCouche()
  c.setCarre({ i0: -1, j0: -1, cote: 3 })
  c.setFrameScale(0.4)
  assert.equal(c.group.scale.x, 1, 'l\'ordre des appels ne change rien')
  assert.equal(c.group.scale.y, 1, 'Y ne bouge jamais')
})

// ═══════════════════════════════════════════════════════════════════════════
// ⑤ LE CÂBLAGE
// ═══════════════════════════════════════════════════════════════════════════
//
// ⚠️ SANS CE DERNIER TEST, LES DIX-SEPT AUTRES RESTERAIENT VERTS AVEC LE DÉFAUT
// D'ADRIEN INTACT À L'ÉCRAN : il suffirait que personne n'appelle `setCarre`.
// `main.js` tire three.js, le DOM, des workers et le réseau — il n'est pas
// importable sous node, donc on le LIT, exactement comme le fait déjà
// test/damier-uniformes.test.js et pour la même raison. Un balayage statique
// voit qu'un appel a disparu ; il ne voit pas s'il part au bon moment.
const SRC_MAIN = fs.readFileSync(path.join(RACINE, 'src/main.js'), 'utf8')

test('main.js branche le cartouche sur onGridChanged, et lit l\'emprise VIVANTE', () => {
  const decl = /function cartoucheSuitLeDamier\(\)\s*\{([\s\S]*?)\n\}/.exec(SRC_MAIN)
  assert.ok(decl, 'le pont damier → cartouche existe')
  assert.match(decl[1], /groundInfo\.setCarre\(/, 'il pousse le carre dans la couche')
  assert.match(decl[1], /empriseVivante\(\)/, 'ce qui est POSE...')
  assert.doesNotMatch(decl[1], /carreCourant\(\)/, '...pas ce que le trace a RECLAME (plafonne a 3x3)')

  const boucle = /blockGrid\.onGridChanged = \(\) => \{([\s\S]*?)\n\}/.exec(SRC_MAIN)
  assert.ok(boucle, 'la boucle du damier existe')
  assert.match(boucle[1], /cartoucheSuitLeDamier\(\)/, 'le cartouche est rappele a chaque changement de damier')
})

// ═══════════════════════════════════════════════════════════════════════════
// ⑥ LE BOUTON CAMÉRA CADRE TOUT LE DAMIER (Tâche 10)
// ═══════════════════════════════════════════════════════════════════════════
//
// « Le bouton camera en vue multi-cases permettra de voir toutes les cases a la
// fois en isometrique sans passer au zoom inferieur. Et on reviendra au mode
// precedent si une seule case est affichee. Si dans ce mode de vue,
// l'utilisateur continue de dezoomer, alors on dezoome vraiment. » (Adrien)

const rad = (d) => (d * Math.PI) / 180

// ---- 1. quel comportement le bouton doit prendre ---------------------------

test('en 1x1 le bouton camera garde son comportement d\'avant', () => {
  assert.equal(modeCameraDamier({ cote: 1 }), 'bloc')
})

test('des qu\'il y a plusieurs cases, le bouton cadre l\'ensemble', () => {
  assert.equal(modeCameraDamier({ cote: 2 }), 'ensemble', 'DEUX cases suffisent, pas trois')
  assert.equal(modeCameraDamier({ cote: 3 }), 'ensemble')
  assert.equal(modeCameraDamier({ cote: 5 }), 'ensemble', 'le 5x5 de la zone isolee aussi')
})

test('sans carre lisible, le bouton reste celui d\'avant', () => {
  // un damier pas encore synchronise ne doit pas envoyer la camera a 500 unites
  for (const carre of [undefined, null, {}, { cote: 0 }, { cote: NaN }]) {
    assert.equal(modeCameraDamier(carre), 'bloc', JSON.stringify(carre))
  }
})

test('la fenetre continue n\'a PAS de damier : le bouton n\'y cadre rien', () => {
  // Son emprise 3x3 est celle du CHAMP ; le socle reste UN bloc et c'est le
  // relief qui defile dedans (damier-carre.js, coteGeometrique). Reculer la
  // camera pour « tout voir » y cadrerait du vide autour d'un bloc unique.
  assert.equal(modeCameraDamier({ cote: 3 }, { continu: true }), 'bloc')
  assert.equal(modeCameraDamier({ cote: 3 }, { continu: false }), 'ensemble')
})

// ---- 2. la pose : tout le carre, et le zoom RENDU INCHANGÉ -----------------

// LE PIÈGE : cadrer l'ensemble ne doit PAS changer le zoom geographique.
// Un dezoom d'escalier rechargerait tout le damier a une autre resolution —
// et la demande dit explicitement « sans passer au zoom inferieur ».
test('cadrer l\'ensemble ne consomme pas un cran de zoom', () => {
  const pose = poseDamier({ zoom: 12, cote: 3 }, { fovDeg: 45, marge: 1.1 })
  assert.equal(pose.zoom, 12, 'le zoom geographique doit etre rendu inchange')
  assert.ok(pose.hauteur > 0, 'la camera monte pour tout voir')
  assert.ok(Number.isFinite(pose.cible.x) && Number.isFinite(pose.cible.z))
})

test('le zoom rendu est CELUI QU\'ON A DONNÉ, pas une constante', () => {
  // ⚠️ CE TEST EXISTE PARCE QUE `assert.equal(pose.zoom, 12)` SEUL NE PROUVE
  // RIEN : il survit a un `zoom: 12` code en dur. Deux zooms differents, et une
  // implementation qui invente sa valeur meurt sur l'un des deux.
  for (const z of [3, 7, 12, 16]) {
    assert.equal(poseDamier({ zoom: z, cote: 3 }, { fovDeg: 45, marge: 1.1 }).zoom, z, `zoom ${z}`)
    assert.equal(poseDamier({ zoom: z, cote: 1 }, { fovDeg: 45, marge: 1.1 }).zoom, z, `zoom ${z} en 1x1`)
  }
})

test('la pose isometrique cadre le carre, pas le seul bloc principal', () => {
  const seul = poseDamier({ zoom: 12, cote: 1 }, { fovDeg: 45, marge: 1.1 })
  const large = poseDamier({ zoom: 12, cote: 3 }, { fovDeg: 45, marge: 1.1 })
  assert.ok(large.hauteur > seul.hauteur, 'un 3x3 demande de monter plus haut')
  assert.equal(large.zoom, seul.zoom, 'et toujours sans changer de zoom')
  // …et il monte EXACTEMENT trois fois plus haut : le recul est lineaire en
  // cote. Un cadrage qui n'aurait retenu que le bloc central passerait le
  // « plus haut » ci-dessus par accident (marge, arrondi) mais pas ce rapport.
  presque(large.hauteur / seul.hauteur, 3, 'un 3x3 recule d\'un facteur 3, pas d\'un cheveu')
})

test('la sphere cadree circonscrit les QUATRE COINS du carre au sol', () => {
  // C'est la propriete qui distingue « cadrer le carre » de « cadrer le trace »
  // ou « cadrer le centre » : le rayon vaut la DEMI-DIAGONALE du carre.
  // rayon = distance * tan(fov/2) / marge
  for (const cote of [1, 2, 3, 5]) {
    const fovDeg = 30
    const marge = 1.1
    const p = poseDamier({ zoom: 12, cote, taille: TAILLE }, { fovDeg, marge })
    const rayon = (p.distance * Math.tan(rad(fovDeg / 2))) / marge
    presque(rayon, ((TAILLE * cote) / 2) * Math.SQRT2, `cote ${cote}`)
  }
})

test('la pose est la vraie isometrie : azimut 45, site atan(1/√2)', () => {
  const p = poseDamier({ zoom: 12, cote: 3, taille: TAILLE }, { fovDeg: 30, marge: 1.1 })
  const dx = p.position.x - p.cible.x
  const dz = p.position.z - p.cible.z
  presque(dx, dz, 'azimut 45 : x et z egalement ecartes')
  assert.ok(dx > 0, 'la camera est bien reculee, pas posee sur la cible')
  presque(p.hauteur / p.distance, Math.sin(Math.atan(1 / Math.SQRT2)), 'site isometrique')
  presque(p.hauteur, p.position.y, 'la hauteur EST celle de la camera')
})

test('un carre de cote PAIR se cadre sur son centre, pas sur l\'origine', () => {
  // ⚠️ LE PIÈGE QUI A COÛTÉ DEUX RONDES À LA MER. Le centre d'un 2x2 tombe sur
  // une jointure : viser (0,0) decadrerait la vue d'un demi-bloc.
  const carre = { i0: -1, j0: -1, cote: 2 }
  const p = poseDamier({ zoom: 12, ...carre, taille: TAILLE }, { fovDeg: 30, marge: 1.1 })
  const c = centreDuCarre(carre, TAILLE)
  presque(p.cible.x, c.x, 'la cible suit centreDuCarre')
  presque(p.cible.z, c.z)
  assert.notEqual(p.cible.x, 0, 'surtout PAS l\'origine')

  // et un 2x2 ancre a l'oppose vise l'autre cote de zero
  const autre = poseDamier({ zoom: 12, i0: 0, j0: 0, cote: 2, taille: TAILLE }, { fovDeg: 30, marge: 1.1 })
  presque(autre.cible.x, TAILLE / 2)
  presque(autre.cible.x, -p.cible.x, 'les deux ancrages sont symetriques autour de zero')
})

test('un cote IMPAIR reste centre sur le bloc principal', () => {
  for (const cote of [1, 3, 5]) {
    const p = poseDamier({ zoom: 12, cote, taille: TAILLE }, { fovDeg: 30, marge: 1.1 })
    presque(p.cible.x, 0, `cote ${cote}`)
    presque(p.cible.z, 0, `cote ${cote}`)
  }
})

test('la marge et le champ de vision sont vraiment consommes', () => {
  const serre = poseDamier({ zoom: 12, cote: 3 }, { fovDeg: 30, marge: 1 })
  const large = poseDamier({ zoom: 12, cote: 3 }, { fovDeg: 30, marge: 1.3 })
  presque(large.distance / serre.distance, 1.3, 'la marge multiplie le recul')
  const etroit = poseDamier({ zoom: 12, cote: 3 }, { fovDeg: 15, marge: 1.1 })
  assert.ok(etroit.distance > serre.distance, 'un objectif plus long recule davantage')
})

// ---- 3. « s'il continue de dezoomer, on dezoome vraiment » ------------------

// ET SON REVERS : si l'utilisateur insiste, il doit pouvoir sortir.
test('un dezoom franc sort du cadrage et dezoome vraiment', () => {
  assert.equal(doitVraimentDezoomer({ mode: 'ensemble', cumul: 0.2 }), false, 'un cran mou ne sort pas')
  assert.equal(doitVraimentDezoomer({ mode: 'ensemble', cumul: 1.5 }), true, 'l\'insistance sort')
})

test('hors du cadrage, tout dezoom est un vrai dezoom', () => {
  assert.equal(doitVraimentDezoomer({ mode: 'bloc', cumul: 0.1 }), true)
  // ⚠️ ET AUSSI POUR UN MODE INCONNU OU ABSENT. Un `mode !== 'bloc'` a la place
  // du `mode !== 'ensemble'` gelerait la molette de toute l'application des
  // qu'un appelant oublie le champ.
  assert.equal(doitVraimentDezoomer({ cumul: 0.1 }), true, 'mode absent')
  assert.equal(doitVraimentDezoomer({ mode: 'orbite', cumul: 0 }), true, 'mode inconnu')
  assert.equal(doitVraimentDezoomer(), true, 'aucun argument du tout')
})

test('le seuil est franchi À la valeur, pas seulement au-dela', () => {
  // borne le seuil des DEUX cotes : un seuil deplace, ou un `>` a la place du
  // `>=`, meurt ici.
  assert.equal(doitVraimentDezoomer({ mode: 'ensemble', cumul: SEUIL_SORTIE_ENSEMBLE }), true)
  assert.equal(doitVraimentDezoomer({ mode: 'ensemble', cumul: SEUIL_SORTIE_ENSEMBLE - 1e-9 }), false)
})

test('UN cran de souris ne sort jamais, DEUX sortent', () => {
  // C'est la justification du seuil, et elle se teste. Un cran de souris vaut
  // 100 px (Chrome) ou 120 px (Windows/Firefox) : les deux valent 1 apres
  // normalisation, et 1 < seuil <= 2.
  for (const px of [100, 120, 240]) {
    const un = cumuleDezoom(0, px, 0)
    assert.equal(un, 1, `un cran de ${px} px vaut exactement 1`)
    assert.equal(doitVraimentDezoomer({ mode: 'ensemble', cumul: un }), false, `un seul cran de ${px} px reste`)
    const deux = cumuleDezoom(un, px, 60)
    assert.equal(doitVraimentDezoomer({ mode: 'ensemble', cumul: deux }), true, `deux crans de ${px} px sortent`)
  }
})

test('une caresse de pave tactile ne defait pas le cadrage', () => {
  let c = 0
  for (let k = 0; k < 5; k++) c = cumuleDezoom(c, 4, 30) // 5 evenements de 4 px
  presque(c, 0.2, '20 px cumules')
  assert.equal(doitVraimentDezoomer({ mode: 'ensemble', cumul: c }), false)
  // …mais un balayage franc a deux doigts, lui, sort
  for (let k = 0; k < 40; k++) c = cumuleDezoom(c, 4, 12)
  assert.equal(doitVraimentDezoomer({ mode: 'ensemble', cumul: c }), true, '180 px : c\'est un geste')
})

test('un cran isole ne s\'ajoute pas a un total perime', () => {
  const un = cumuleDezoom(0, 100, 40)
  assert.equal(cumuleDezoom(un, 100, OUBLI_MOLETTE_MS + 1), 1, 'le silence a remis le compteur a zero')
  assert.equal(cumuleDezoom(un, 100, OUBLI_MOLETTE_MS), 2, '…mais pas AVANT la fin du silence')
})

test('seul le DEZOOM compte dans le cumul', () => {
  // deltaY < 0 = on s'approche : ca ne fait pas avancer une sortie par dezoom.
  assert.equal(cumuleDezoom(0.5, -400, 10), 0.5)
  assert.equal(cumuleDezoom(0.5, 0, 10), 0.5)
  assert.equal(cumuleDezoom(0.5, NaN, 10), 0.5)
  // …et le silence remet a zero meme sans cran de dezoom
  assert.equal(cumuleDezoom(0.5, -400, OUBLI_MOLETTE_MS + 1), 0)
})

// ═══════════════════════════════════════════════════════════════════════════
// ⑦ LE CÂBLAGE DU BOUTON — même règle que ⑤ : main.js se LIT
// ═══════════════════════════════════════════════════════════════════════════
//
// ⚠️ SANS CETTE SECTION, TOUT CE QUI PRÉCÈDE RESTERAIT VERT AVEC LE BOUTON
// INCHANGÉ À L'ÉCRAN. Et le point le plus fragile n'est PAS testable autrement :
// « sans passer au zoom inferieur » est une propriete de ce que le cadrage
// N'APPELLE PAS.

test('le bouton camera choisit entre l\'ensemble et la vue d\'avant', () => {
  const btn = /flyIso: \(\) => \{([\s\S]*?)\n  \},/.exec(SRC_MAIN)
  assert.ok(btn, 'le bouton iso a bien une branche')
  assert.match(btn[1], /modeCameraDamier\(|modeBoutonCamera\(\)/, 'il demande au damier quoi faire')
  assert.match(btn[1], /cadreLeDamier\(\)/, 'plusieurs cases → il cadre l\'ensemble')
  assert.match(btn[1], /applyIsoView\(/, 'une seule case → son comportement d\'avant')
})

test('le cadrage lit l\'emprise VIVANTE et ne touche JAMAIS au zoom', () => {
  const fn = /function cadreLeDamier\(\)\s*\{([\s\S]*?)\n\}/.exec(SRC_MAIN)
  assert.ok(fn, 'le cadrage du damier existe')
  assert.match(fn[1], /poseDamier\(/, 'il delegue la pose au module pur')
  assert.match(fn[1], /empriseVivante\(\)|carrePourCamera\(\)/, 'ce qui est POSE...')
  assert.doesNotMatch(fn[1], /carreCourant\(\)/, '...pas ce que le trace a RECLAME')
  // ⚠️ LE CŒUR DE LA DEMANDE : le cadrage recule la CAMÉRA, il ne change pas la
  // CARTE. Un seul de ces appels et les neuf dalles se rechargeraient a une
  // autre resolution.
  assert.doesNotMatch(fn[1], /demZoom\s*=[^=]/, 'aucune ecriture du zoom geographique')
  assert.doesNotMatch(fn[1], /loadRealTerrain|pasEscalier|stepZoom|_coarsen|enterOrbit/, 'aucun cran d\'escalier')

  const lecture = /const carre = carrePourCamera\(\)/.test(fn[1])
  assert.ok(lecture, 'il lit le carre une fois, en tete')
  const src = /function carrePourCamera\(\)\s*\{([\s\S]*?)\n\}/.exec(SRC_MAIN)
  assert.ok(src, 'et carrePourCamera existe')
  assert.match(src[1], /empriseVivante/, 'et c\'est bien l\'emprise vivante qu\'il rend')
})

test('la molette rend la butee AVANT de laisser l\'escalier dezoomer', () => {
  // ⚠️ L'ORDRE EST LA CORRECTION. modes.js decide « je suis en butee » en
  // comparant la distance a controls.maxDistance ; rendre `false` sans avoir
  // remis la vraie valeur laisserait la porte orbitale fermee pour toujours.
  const fn = /function molettePendantCadrageDamier\(deltaY\)\s*\{([\s\S]*?)\n\}/.exec(SRC_MAIN)
  assert.ok(fn, 'le hook molette existe')
  assert.match(fn[1], /doitVraimentDezoomer\(/, 'c\'est la regle pure qui tranche')
  assert.match(fn[1], /cumuleDezoom\(/, 'un CUMUL de molette, pas un booleen')
  // ⚠️ CE TEST A DÉJÀ SURVÉCU À SA PROPRE MUTATION une fois : il cherchait le
  // PREMIER `quitteCadrageDamier()`, celui de la branche « on s'approche », et
  // restait donc vert quand on supprimait celui de la branche « il insiste ».
  // On ancre maintenant la recherche APRÈS la règle qui tranche.
  const regle = fn[1].indexOf('doitVraimentDezoomer(')
  const rendu = fn[1].indexOf('quitteCadrageDamier()', regle)
  const faux = fn[1].lastIndexOf('return false')
  assert.ok(regle >= 0, 'la regle est consultee')
  assert.ok(rendu > regle && faux > rendu, 'on rend la butee, PUIS on laisse passer le cran')

  assert.match(SRC_MAIN, /cadrageWheel: \(deltaY\) =>/, 'et modes.js recoit bien le hook')
})

test('modes.js consulte le cadrage avant de compter ses crans', () => {
  const SRC_MODES = fs.readFileSync(path.join(RACINE, 'src/modes.js'), 'utf8')
  const geste = SRC_MODES.indexOf('_zoomGesture(e) {')
  assert.ok(geste > 0)
  const appel = SRC_MODES.indexOf('this.hooks.cadrageWheel?.(', geste)
  const compteur = SRC_MODES.indexOf('this._lastWheelT = now', geste)
  assert.ok(appel > geste, 'le hook est branche dans le geste de molette')
  assert.ok(compteur > appel, 'et il passe AVANT que le geste ne soit compte comme frais')
})
