// LE PIVOT SOUS LA MOLETTE, L'ACCUEIL, ET LA VUE D'ENSEMBLE — Tâche R29 bis.
//
// ══════════ D'OÙ VIENT CE FICHIER ══════════════════════════════════════════
//
// `test/attaque-r30-ROUGE.mjs` est la livraison de l'attaquant : onze tests
// **attendus rouges**, décrivant des défauts mesurés et non corrigés. Son
// en-tête pose la condition de sa propre fin :
//
//   > « le jour où ces onze rouges deviendront verts, ce fichier doit être
//   > RENOMMÉ en `.test.js` et inscrit dans `package.json` — ou supprimé. Tant
//   > qu'il dort en `.mjs`, il ne protège rien. »
//
// Ils sont verts. Mais **cinq des onze sont des GARDES DE JOURNAL** et lisent
// `.banc/`, qui est dans `.gitignore` : les inscrire dans `npm test` rendrait la
// suite rouge sur tout dépôt frais — c'est-à-dire exactement le contraire de ce
// que l'audit protège. On scinde donc :
//
//   · les SIX tests PURS (A, A bis, B, B bis, C, C bis) vivent ICI, dans
//     `npm test`, et protègent le code sans aucun journal ;
//   · les CINQ gardes de journal (A ter, B ter, D, D bis, E) restent dans le
//     `.mjs`, avec la commande qui les rejoue en tête de fichier.
//
// ⚠️ **Chacun porte le chiffre mesuré qui le fonde.** Un test de non-régression
// sans son relevé est une opinion.

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Y_CIBLE } from '../src/loi-altitude.js'
import {
  cumuleDezoom,
  doitVraimentDezoomer,
  OUBLI_MOLETTE_MS,
  CONSTANTE_OUBLI_MS,
  SEUIL_SORTIE_ENSEMBLE,
} from '../src/vue-ensemble.js'

const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const lire = (p) => fs.readFileSync(path.join(RACINE, p), 'utf8')

// ═══════════════════════════════════════════════════════════════════════════
// ① L'ACCUEIL REND LA MOLETTE
//
// MESURÉ (`.banc/R30/voile.json`, trois chargements sur trois, pose stable sur
// 400 images à `d = 145,5000`) : **37 crans de molette envoyés à la souris,
// 0 reçu** par `modes._zoomGesture` ; un glissé de 160 px : rien. Un CLIC, et
// tout repart. Le voile porte `pointer-events: auto` et `hub.js` n'avait que
// trois sorties — clic, focus du champ, Échap.
// Après : `d` 145,5 → 101,19 et l'altimètre 18,2 → 24,0 km sur les mêmes crans.
// ═══════════════════════════════════════════════════════════════════════════

test('① l’accueil a une sortie à la MOLETTE, et elle a la portée d’Échap', () => {
  const hub = lire('src/ui/hub.js')
  assert.match(hub, /addEventListener\(\s*['"]wheel['"]/, 'aucun écouteur `wheel` dans src/ui/hub.js')
  // ⚠️ **SUR LA FENÊTRE, PAS SUR LE VOILE — et c'est une mesure qui l'impose.**
  // Au centre de l'écran le geste tombe sur `BUTTON.ce-wm-btn`, frère du voile
  // et non son enfant : un écouteur posé sur `veil` ne le voit jamais. Premier
  // jet fait ainsi, journal identique au bit.
  assert.match(
    hub,
    /window\.addEventListener\(\s*['"]wheel['"][\s\S]{0,200}?isOpen\(\)[\s\S]{0,80}?escape\(\)/,
    'la sortie molette n’a pas la portée d’Échap : posée sur le voile, elle ne verrait '
    + 'jamais le geste, qui tombe sur BUTTON.ce-wm-btn'
  )
})

test('① bis tout geste que le voile CAPTE a une sortie', () => {
  const css = lire('src/ui/v28.css')
  const i = css.indexOf('body.ce-hub .ce-hubveil')
  assert.ok(i > 0, 'la règle qui allume le voile a disparu de v28.css')
  if (!/pointer-events:\s*auto/.test(css.slice(i, i + 120))) return // il ne capte plus rien
  const hub = lire('src/ui/hub.js')
  assert.match(hub, /veil\.addEventListener\(\s*['"]click['"]\s*,\s*escape/, 'le clic n’a plus de sortie')
  assert.match(hub, /addEventListener\(\s*['"]wheel['"]/, 'la molette n’a plus de sortie')
})

// ═══════════════════════════════════════════════════════════════════════════
// ② LA MOLETTE NE TRANSLATE PAS LA CIBLE HORS DU CROP
//
// ⚠️ **CE QUE CE PARAGRAPHE DISAIT, ET DANS QUEL ESPACE — R32.** Il s'appelait
// « le pivot tient l'AXE DE LA TERRE sous la molette » et mesurait
// `hypot(target.x, target.z)` : c'est l'axe du BLOC, c'est-à-dire l'aplomb du
// point sous la caméra — pas le centre de la Terre, qui est à `(0, −R_bloc, 0)`
// dans cet espace. Ce que le test garde vraiment, et qui reste juste : hors du
// crop, un cran de molette ne TRANSLATE pas la cible latéralement (le zoom est
// radial, D19 : « je scrolle vers le point visé au centre de l'écran »). Depuis
// R32 la cible peut être hors de l'axe du bloc hors du crop (la saisie de la
// Terre la déplace, et `_cibleVisee` vise le lieu demandé) : le test mesure
// donc que la molette ne la DÉPLACE pas, pas qu'elle est « sur l'axe ».
//
// MESURÉ au geste réel avant R29 bis (`.banc/R30/molette.json`) : 2 279 images
// sur 2 369 avec une cible translatée par le zoom vers le curseur, jusqu'à
// 13,2695 u. R29 bis l'a fermé hors du crop ; R32 étend la règle 2 de D19 au
// crop (pivot au centre de l'écran, plus au curseur).
// ═══════════════════════════════════════════════════════════════════════════

function domDePacotille() {
  const el = () => {
    const e = { className: '', innerHTML: '', textContent: '', style: {}, enfants: [] }
    e.classList = { add() {}, remove() {}, toggle() {}, contains: () => false }
    e.appendChild = (c) => { e.enfants.push(c); return c }
    e.remove = () => {}
    e.setAttribute = () => {}
    e.addEventListener = () => {}
    e.querySelector = () => el()
    return e
  }
  globalThis.document = { createElement: () => el(), body: el(), addEventListener() {} }
}

async function machine({ horsDuCrop = true } = {}) {
  domDePacotille()
  const THREE = await import('three')
  const { Modes } = await import('../src/modes.js')
  const camera = new THREE.PerspectiveCamera(33, 16 / 9, 0.5, 1400)
  const etat = { emprise: 1e6, charges: [] }
  const controls = {
    target: new THREE.Vector3(0, Y_CIBLE, 0),
    minDistance: 6, maxDistance: 150, enabled: true, maxPolarAngle: 0,
    rotateSpeed: 1, enableZoom: false, enablePan: true,
    getDistance() { return camera.position.distanceTo(this.target) },
    update() {},
  }
  const hooks = {
    zoomContinu: () => true,
    horsDuCrop: () => horsDuCrop,
    empriseBlocM: () => etat.emprise,
    empriseBlocMAuZoom: (z) => 1e6 * 2 ** (12 - z),
    coteBloc: () => 56,
    getFineZoom: () => 15,
    surfaceMaxDistance: () => 150,
    surfaceCamAltMeters: () => 0,
    getSurfaceLatLon: () => ({ lat: 45.83, lon: 6.86 }),
    setSurfaceVisible() {}, setEffectsEnabled() {},
    getRefineTarget: () => ({ lat: 45.83, lon: 6.86, zoom: 12 }),
    getCoarsenTarget: () => ({ lat: 45.83, lon: 6.86, zoom: 10 }),
    async loadSurface(_lat, _lon, zoom) { etat.charges.push(zoom); etat.emprise *= 2 },
    arriveeSurLeBloc: () => false,
    surLeBloc: () => false,
  }
  const m = new Modes({ camera, controls, globe: { setVisible() {} }, domElement: { addEventListener() {} }, hooks })
  m.mode = 'surface'
  camera.position.set(0, Y_CIBLE + 20, 20) // une pose de trois quarts ordinaire
  return { m, camera, controls, THREE }
}

test('② hors du crop, un cran de molette ne TRANSLATE pas la cible — le zoom est radial (D19, règle 2 au nadir)', async () => {
  const { m, controls, THREE } = await machine()
  // un pivot qui traîne d'un ancien cran ne doit pas compter hors du crop
  m._zoomPivot = new THREE.Vector3(8, Y_CIBLE, -6)
  m._zoomVel = -1 // un cran vers l'extérieur
  const avant = { x: controls.target.x, z: controls.target.z }
  m._applyZoom(1 / 60)
  const ecart = Math.hypot(controls.target.x - avant.x, controls.target.z - avant.z)
  assert.ok(ecart < 1e-9, `la cible a été translatée de ${ecart.toFixed(6)} u (espace bloc) par UNE image de molette`)
})

test('② bis …et `target.y` ne quitte pas `Y_CIBLE`', async () => {
  const { m, controls, THREE } = await machine()
  m._zoomPivot = new THREE.Vector3(8, Y_CIBLE + 4, -6)
  m._zoomVel = -1
  m._applyZoom(1 / 60)
  assert.ok(Math.abs(controls.target.y - Y_CIBLE) < 1e-9, `target.y = ${controls.target.y} au lieu de ${Y_CIBLE}`)
})

test('② ter SUR LE CROP, le zoom vise le point AU CENTRE DE L’ÉCRAN — D19, règle 2, et plus le curseur', async () => {
  // ⚠️ **D19 REMPLACE L'ARBITRAGE DE R29 bis** (« le zoom vers le curseur est
  // intact sur le crop ») : *« quand je scrolle pour zoomer ou dézoomer, je
  // scrolle vers le point visé au centre de l'écran »*. Sur le crop la vue est
  // inclinée : le point du cadre n'est pas la cible dès que le relief passe
  // entre les deux, et c'est lui qui gagne — le pivot reste donc actif sur le
  // crop, mais il est lu au CENTRE, où que soit la souris (test ④ de
  // pivot-terre.test.js pour la lecture ; ici, l'effet).
  const { m, controls, THREE } = await machine({ horsDuCrop: false })
  m._zoomPivot = new THREE.Vector3(8, Y_CIBLE, -6) // le point du cadre, posé par _zoomGesture
  m._zoomVel = -1
  m._applyZoom(1 / 60)
  const ecart = Math.hypot(controls.target.x, controls.target.z)
  assert.ok(ecart > 1e-6, 'le zoom vers le point du cadre a été éteint SUR LE CROP aussi')
  // et le point du cadre est lu au centre de l'écran, pas sous le curseur
  const src = lire('src/modes.js')
  assert.match(src, /this\._zoomNdc\.set\(0, 0\)/, '_zoomGesture ne prend plus son pivot au centre de l’écran')
  assert.doesNotMatch(src, /_zoomNdc\.set\(\(e\.clientX/, 'le pivot de zoom est revenu sous le curseur')
})

test('② quater le prédicat est le HOOK, et son absence garde le pivot', async () => {
  // ⚠️ Une seconde définition du crop finirait par diverger de `_cibleVisee` et
  // de `recentrerSurLaTerre` : `horsDuCrop` est le seul énoncé. Et un banc qui ne
  // le fournit pas ne décide pas du régime — on garde le pivot.
  const src = lire('src/modes.js')
  assert.match(
    src,
    /const P = this\.hooks\.horsDuCrop\?\.\(\) === true \? null : this\._zoomPivot/,
    '`_applyZoom` ne consulte plus le hook `horsDuCrop` pour décider du pivot de zoom'
  )
})

// ═══════════════════════════════════════════════════════════════════════════
// ③ LA MOLETTE N'EST PAS MORTE POUR QUI DÉFILE LENTEMENT
//
// `cumuleDezoom` remettait le cumul à ZÉRO au-delà de `OUBLI_MOLETTE_MS`. Un
// visiteur qui défile à deux crans par seconde repart de zéro à chaque cran :
// son cumul plafonne à **1,0** pour un seuil de **1,2**, et il ne sort JAMAIS du
// cadrage — vingt crans, cent, mille : le même 1,0. Et `min(1, deltaY / 100)`
// écrêtait un lancer de pavé tactile de 4 000 px au poids d'un cran de souris.
// ═══════════════════════════════════════════════════════════════════════════

test('③ vingt crans espacés de 500 ms finissent par sortir du cadrage', () => {
  let cumul = 0
  let sorti = 0
  for (let k = 0; k < 20; k++) {
    cumul = cumuleDezoom(cumul, 120, 500)
    if (doitVraimentDezoomer({ mode: 'ensemble', cumul })) { sorti = k + 1; break }
  }
  assert.ok(sorti > 0, `20 crans à 2 par seconde, cumul plafonné à ${cumul} pour un seuil de ${SEUIL_SORTIE_ENSEMBLE}`)
  assert.ok(sorti >= 2, `sorti au cran ${sorti} : un cran ISOLÉ ne doit jamais suffire`)
})

test('③ bis un balayage violent en un seul événement sort', () => {
  assert.ok(
    doitVraimentDezoomer({ mode: 'ensemble', cumul: cumuleDezoom(0, 4000, 500) }),
    'un événement de 4 000 px pèse encore le poids d’un cran de souris'
  )
})

test('③ ter les cinq invariants du seuil tiennent ENSEMBLE', () => {
  // ⚠️ **C'EST CE TEST QUI FIXE `CONSTANTE_OUBLI_MS`**, et pas l'inverse : les
  // 2 000 ms sont l'intervalle où les cinq tiennent à la fois. La fenêtre
  // mesurée est [1 500 ; 5 580] ms.
  const sort = (c) => doitVraimentDezoomer({ mode: 'ensemble', cumul: c })
  // ① un cran seul ne sort pas
  assert.equal(sort(cumuleDezoom(0, 100, 0)), false, 'un cran isolé sort')
  // ② deux crans rapprochés sortent
  assert.equal(sort(cumuleDezoom(cumuleDezoom(0, 100, 0), 100, 60)), true, 'deux crans à 60 ms ne sortent pas')
  // ③ une goutte toutes les 10 s ne sort JAMAIS
  let goutte = 0
  for (let k = 0; k < 500; k++) {
    goutte = cumuleDezoom(goutte, 100, 10000)
    assert.equal(sort(goutte), false, `une goutte toutes les 10 s est sortie au tour ${k + 1} (cumul ${goutte})`)
  }
  // ④ un balayage franc à deux doigts sort (40 événements de 4 px en 480 ms)
  let doigts = 0
  for (let k = 0; k < 45; k++) doigts = cumuleDezoom(doigts, 4, 12)
  assert.equal(sort(doigts), true, `un balayage de 180 px plafonne à ${doigts}`)
  // ⑤ une caresse de cinq événements de 4 px ne sort pas
  let caresse = 0
  for (let k = 0; k < 5; k++) caresse = cumuleDezoom(caresse, 4, 30)
  assert.equal(sort(caresse), false, `une caresse de 20 px sort (${caresse})`)
  // et les deux constantes sont bien distinctes : la cadence n'est pas la mémoire
  assert.ok(
    CONSTANTE_OUBLI_MS > OUBLI_MOLETTE_MS,
    'la constante de temps de l’oubli est retombée sur la cadence du geste : '
    + 'employée telle quelle, elle efface la mémoire dix fois trop vite (mesuré : '
    + 'le balayage à deux doigts tombait à 0,998 pour un seuil de 1,2)'
  )
})

test('③ quater l’oubli DÉCROÎT, il ne guillotine plus', () => {
  const un = cumuleDezoom(0, 100, 0)
  const court = cumuleDezoom(un, 100, 60)
  const moyen = cumuleDezoom(un, 100, OUBLI_MOLETTE_MS)
  const long = cumuleDezoom(un, 100, OUBLI_MOLETTE_MS * 10)
  assert.ok(court > moyen && moyen > long, `l’oubli n’est pas monotone : ${court} / ${moyen} / ${long}`)
  assert.ok(long > un, 'au-delà du silence, le total d’avant est remis à ZÉRO — la guillotine est revenue')
})
