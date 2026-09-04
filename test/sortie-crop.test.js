// LA MOLETTE DOIT SORTIR DU CROP EN QUELQUES CRANS — Tâche SORTIE, D21 ① amendée.
//
// > **Adrien, 2026-09-04 :** le retour du crop à z10 a supprimé la bande où le
// > clic droit maintenu sortait du crop (elle n'existait que grâce à z7). **Les
// > sorties du crop sont désormais DEUX** — le dézoom à la molette et le bouton
// > « map monde ». Le clic droit reste un pan dans le crop, c'est acté.
//
// ⚡ **CE QUI REND CE FICHIER NÉCESSAIRE, ET C'EST UN CHIFFRE.** Avant ce
// correctif, la deuxième sortie coûtait **161 à 162 crans** (`.banc/SORTIE/
// avant-sortie-2.json`, un cran par lecture, un chargement par mesure), et
// CHASSE en avait relevé **241 à 260** sur un autre dispositif. Après :
// **8 à 9 crans, 8/8**, confirmés au 3ᵉ **8/8** (`apres-sortie-8.json`).
//
// ⛔ **LA CAUSE DES CRANS MORTS N'EST PAS LE PAS DE MOLETTE** — relevé cran par
// cran (`avant-mortes.json`) : crans **21 à 43**, `d` collée à
// `controls.maxDistance = 150`, **altitude figée à 616 m**, `_levelZoom` de 0,01
// à 0,68. Le plafond clippe le déplacement, le compteur encaisse l'intention
// (R23), et le franchissement qui libère la caméra CONSERVE l'altitude. C'est
// ce mécanisme-là que le § ② rejoue en unitaire.
//
// ══════════ CE QUE CE FICHIER GARDE ════════════════════════════════════════
//   ① LA CONFIRMATION — trois crans d'affilée, et un cran isolé ne sort JAMAIS.
//   ② LA POUSSÉE — elle pompe l'INTENTION, le seul levier que le plafond ne
//      clippe pas ; et elle rend l'excès de compteur en s'arrêtant.
//   ③ LE BRANCHEMENT — `main.js` n'est chargé par aucun test de ce dépôt
//      (§0 du plan) : on en vérifie le TEXTE, patron de `crop-intention`.
//   ④ DEUX SORTIES — la règle et les tests disent le même nombre.
//
// ⚠️ **CE QUE CE FICHIER NE PEUT PAS TESTER** : que le geste sorte vraiment du
// crop à l'écran. Ça se mesure au navigateur, huit chargements, un geste par
// chargement — `scripts/sonde-sortie.mjs` et `rapport-SORTIE.md`.

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Y_CIBLE } from '../src/loi-altitude.js'
import { creerConfirmationSortie, CRANS_SORTIE, FENETRE_SORTIE_MS } from '../src/monde/sortie-molette.js'

const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const lire = (p) => fs.readFileSync(path.join(RACINE, p), 'utf8')
const MAIN = lire('src/main.js')
const MODES_SRC = lire('src/modes.js')
const D21 = lire('.superpowers/sdd/2026-08-22-globe-studio/regle-D21.md')

// ══════════ ① LA CONFIRMATION ══════════════════════════════════════════════

test('① un cran de dézoom ISOLÉ ne confirme rien — le critère d’Adrien, mot pour mot', () => {
  const c = creerConfirmationSortie()
  assert.equal(c.cran(120, 1000, true), false)
  assert.equal(c.arme, false)
  // et même mille fois isolé : chaque cran est séparé du précédent par plus
  // d'une fenêtre, donc chacun est le PREMIER de son geste
  for (let i = 0; i < 1000; i++) {
    assert.equal(c.cran(120, 10_000 + i * (FENETRE_SORTIE_MS + 1), true), false, `cran isolé n° ${i} a confirmé`)
  }
})

test('① bis trois crans d’affilée confirment, et une seule fois', () => {
  const c = creerConfirmationSortie()
  assert.equal(c.cran(120, 1000, true), false)
  assert.equal(c.cran(120, 1050, true), false)
  assert.equal(c.cran(120, 1100, true), true, 'le 3ᵉ cran doit confirmer')
  // ⚠️ **ET PAS DEUX FOIS** : la poussée est en route ; la relancer à chaque
  // cran suivant lui remettrait un budget neuf, donc une sortie sans fin.
  assert.equal(c.cran(120, 1150, true), false)
  assert.equal(c.cran(120, 1200, true), false)
  assert.equal(CRANS_SORTIE, 3)
})

test('① ter un cran de ZOOM AVANT remet le compte à zéro — comme il désarme `sortieArmee`', () => {
  const c = creerConfirmationSortie()
  c.cran(120, 1000, true)
  c.cran(120, 1050, true)
  assert.equal(c.cran(-120, 1100, true), false, 'un zoom avant ne confirme jamais')
  assert.equal(c.compte, 0)
  assert.equal(c.cran(120, 1150, true), false, 'le compte est reparti de zéro')
  assert.equal(c.cran(120, 1200, true), false)
  assert.equal(c.cran(120, 1250, true), true)
})

test('① quater la fenêtre coud un GESTE, pas trois corrections de cadrage', () => {
  const c = creerConfirmationSortie()
  c.cran(120, 1000, true)
  c.cran(120, 1000 + FENETRE_SORTIE_MS + 1, true) // trop tard : c'est un geste neuf
  assert.equal(c.compte, 1)
  assert.equal(c.cran(120, 1000 + FENETRE_SORTIE_MS + 50, true), false)
  assert.equal(c.cran(120, 1000 + FENETRE_SORTIE_MS + 100, true), true)
})

test('① quinquies ⛔ HORS DU CROP, LA MOLETTE EST INCHANGÉE', () => {
  const c = creerConfirmationSortie()
  for (let i = 0; i < 50; i++) assert.equal(c.cran(120, 1000 + i * 50, false), false)
  assert.equal(c.compte, 0, 'un cran hors du crop a compté')
  // et la bascule du crop consomme l'intention
  c.cran(120, 5000, true); c.cran(120, 5050, true)
  c.reinitialiser()
  assert.equal(c.compte, 0)
  assert.equal(c.cran(120, 5100, true), false, 'la réinitialisation n’a pas repris le compte à zéro')
})

// ══════════ ② LA POUSSÉE POMPE L'INTENTION ═════════════════════════════════

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
  const corps = el()
  globalThis.document = { createElement: () => el(), body: corps, addEventListener() {} }
  return corps
}

async function machine({ continu = true, maxDistance = 150 } = {}) {
  domDePacotille()
  const THREE = await import('three')
  const { Modes, BUDGET_NIVEAU } = await import('../src/modes.js')
  const camera = new THREE.PerspectiveCamera(33, 16 / 9, 0.5, 1400)
  const etat = { emprise: 1e6, franchis: 0 }
  const controls = {
    target: new THREE.Vector3(0, Y_CIBLE, 0),
    minDistance: 6, maxDistance, enabled: true, maxPolarAngle: 0,
    rotateSpeed: 1, enableZoom: false, enablePan: true,
    getDistance() { return camera.position.distanceTo(this.target) },
    update() {},
  }
  const hooks = {
    zoomContinu: () => continu,
    empriseBlocM: () => etat.emprise,
    coteBloc: () => 56,
    getFineZoom: () => 15,
    surfaceMaxDistance: () => maxDistance,
    surfaceCamAltMeters: () => 0,
    getSurfaceLatLon: () => ({ lat: 45.83, lon: 6.86 }),
    setSurfaceVisible() {}, setEffectsEnabled() {},
    getRefineTarget: () => ({ lat: 45.83, lon: 6.86, zoom: 12 }),
    getCoarsenTarget: () => ({ lat: 45.83, lon: 6.86, zoom: 10 }),
    async loadSurface() { etat.franchis++; etat.emprise *= 2 },
  }
  const m = new Modes({ camera, controls, globe: { setVisible() {} }, domElement: { addEventListener() {} }, hooks })
  m.mode = 'surface'
  return { m, camera, controls, etat, BUDGET_NIVEAU }
}

test('② LA POUSSÉE POMPE L’INTENTION MÊME COLLÉE AU PLAFOND — les 23 crans morts, en unitaire', async () => {
  const { m, camera, controls, BUDGET_NIVEAU } = await machine()
  // la caméra est DÉJÀ au plafond : c'est l'état des crans 21 à 43 du relevé,
  // où le dézoom ordinaire ne déplaçait plus rien pendant 23 crans.
  camera.position.set(0, controls.maxDistance + Y_CIBLE, 0)
  const d0 = controls.getDistance()
  assert.ok(Math.abs(d0 - controls.maxDistance) < 1e-6)
  const niv0 = m.zoomNiveau()
  assert.equal(m.armerPousseeSortie(3), true)
  m._avancerPousseeSortie(0.05)
  // ⛔ le mouvement est clippé — comme `_applyZoom` le clippe, on ne s'en cache pas
  assert.ok(Math.abs(controls.getDistance() - d0) < 1e-6, 'le plafond ne clippe plus : le banc ne mesure plus le défaut')
  // ✅ mais l'INTENTION, elle, est encaissée — c'est le seul levier qui reste
  assert.ok(m.zoomNiveau() > niv0 + 0.2, `le compteur n’a pris que ${(m.zoomNiveau() - niv0).toFixed(4)}`)
  assert.ok(m.zoomNiveau() - niv0 <= 0.3 + 1e-9, 'le taux de pompage a débordé son pas de temps')
  assert.ok(BUDGET_NIVEAU > 0)
})

test('② bis la poussée cesse quand son budget est dépensé, et se borne dans le temps', async () => {
  const { m, camera } = await machine()
  camera.position.set(0, 40, 0)
  m.armerPousseeSortie(0.3)
  assert.equal(m.pousseeSortieActive, true)
  m._avancerPousseeSortie(0.05) // 0,3 log/s × 6 = 0,3 : le budget est épuisé
  m._avancerPousseeSortie(0.05)
  assert.equal(m.pousseeSortieActive, false, 'la poussée court après son budget')
  // et la borne de temps, seule, l'arrête aussi
  m.armerPousseeSortie(1e6)
  for (let i = 0; i < 200; i++) m._avancerPousseeSortie(0.05)
  assert.equal(m.pousseeSortieActive, false, 'une poussée sans fin tiendrait la caméra pour toujours')
})

test('② ter ⛔ L’EXCÈS DE COMPTEUR EST RENDU À L’ARRÊT — sinon la sortie continue seule', async () => {
  // ⚠️ **R29 : « un niveau par appel, et le RESTE RESTE ».** Un compteur laissé
  // plein après la mort du crop ferait franchir des niveaux tout seul jusqu'à
  // la porte orbitale — la molette aurait deux sorties en une, dont une que
  // personne n'a demandée.
  const { m, camera, BUDGET_NIVEAU } = await machine()
  camera.position.set(0, 40, 0)
  m._levelZoom = 5 * BUDGET_NIVEAU
  m.armerPousseeSortie(2)
  assert.equal(m.annulerPousseeSortie(), true)
  assert.ok(m.zoomNiveau() <= BUDGET_NIVEAU, `le compteur reste à ${m.zoomNiveau().toFixed(3)}, soit ${(m.zoomNiveau() / BUDGET_NIVEAU).toFixed(1)} niveaux`)
})

test('② quater la poussée ne s’arme QUE en surface et en régime continu', async () => {
  const plat = await machine({ continu: false })
  assert.equal(plat.m.armerPousseeSortie(2), false, 'le régime hérité (`?terre=deux`) n’a pas de crop à quitter')
  const orbite = await machine()
  orbite.m.mode = 'orbital'
  assert.equal(orbite.m.armerPousseeSortie(2), false)
  const bon = await machine()
  assert.equal(bon.m.armerPousseeSortie(2), true)
  assert.equal(bon.m.armerPousseeSortie(2), false, 'une poussée déjà en route ne se relance pas')
  assert.equal(bon.m.armerPousseeSortie(-1), false)
  assert.equal(bon.m.armerPousseeSortie(NaN), false)
})

// ══════════ ③ LE BRANCHEMENT ═══════════════════════════════════════════════

test('③ la confirmation est prise AU GESTE, dans `intentionZoom`', () => {
  // ⚡ **LA LEÇON SYSTÉMIQUE DU CHANTIER** : un correctif de geste se mesure —
  // et se branche — sur le GESTE, jamais sur l'API qui lui ressemble.
  // `_zoomGesture` sort tôt sur six gardes ; la confirmation s'y perdrait,
  // exactement comme l'intention de D21 ① s'y perdrait.
  const i = MAIN.indexOf('function intentionZoom')
  assert.ok(i > 0)
  const corps = MAIN.slice(i, MAIN.indexOf('\n}', i))
  assert.match(corps, /confirmerSortieMolette\(deltaY\)/)
  assert.match(MAIN, /import \{ creerConfirmationSortie \} from '\.\/monde\/sortie-molette\.js'/)
})

test('③ bis le seuil de mort est LU, pas recopié', () => {
  assert.match(MAIN, /import \{ SEUIL_MORT_M \} from '\.\/monde\/seuil-socle\.js'/)
  const i = MAIN.indexOf('function confirmerSortieMolette')
  const corps = MAIN.slice(i, MAIN.indexOf('\n}', i))
  assert.match(corps, /SEUIL_MORT_M/)
  assert.match(corps, /altitudeCadrageM\(\)/, 'la poussée doit viser depuis l’altitude de CADRAGE (espace bloc), pas l’altitude de fond')
  assert.match(corps, /armerPousseeSortie/)
  // ⛔ aucune valeur de seuil réécrite à la main dans le branchement
  assert.ok(!/40\s*342|32\s*274/.test(corps), 'un seuil est recopié en dur dans le branchement')
})

test('③ ter la poussée est arrêtée par la MORT du crop, et par elle seule', () => {
  assert.match(MAIN, /surBascule:\s*\(\)\s*=>\s*\{\s*poserRegimeCrop\(\);\s*surBasculeCrop\(\)\s*\}/)
  const i = MAIN.indexOf('function surBasculeCrop')
  const corps = MAIN.slice(i, MAIN.indexOf('\n}', i))
  assert.match(corps, /!veilleCrop\?\.pose/)
  assert.match(corps, /annulerPousseeSortie/)
  assert.match(corps, /reinitialiser\(\)/)
})

test('③ quater la poussée est avancée à CHAQUE IMAGE, dans la branche surface', () => {
  assert.match(MODES_SRC, /if \(this\._sortieCourse && !this\._diveTween && !this\.travel\) this\._avancerPousseeSortie\(dt\)/)
  // ⚠️ **APRÈS `_applyZoom`** : les deux vont dans le même sens, et l'ordre est
  // celui de `_applyZoom` puis les courses, comme le glissé de clic.
  assert.ok(
    MODES_SRC.indexOf('this._avancerPousseeSortie(dt)') > MODES_SRC.indexOf('Math.abs(this._zoomVel) > ZOOM_STOP) this._applyZoom(dt)'),
    'la poussée est avancée avant l’élan de la molette'
  )
})

test('③ quinquies ⛔ LE PAS DE MOLETTE N’A PAS BOUGÉ D’UN BIT — D19 tient', () => {
  // ⚡ **C'est la contrainte qui a fait choisir la direction B.** D19 (les
  // contrôles Google Earth) est noté 9,75/10 : le zoom ordinaire du crop doit
  // rester doux et continu. La sortie est un second geste, pas un réglage du
  // premier — donc ces trois constantes sont intactes.
  assert.match(MODES_SRC, /const ZOOM_TAU = 1\.2\b/)
  assert.match(MODES_SRC, /export const CRANS_PAR_NIVEAU = 20\b/)
  assert.match(MODES_SRC, /const ZOOM_IMPULSE = BUDGET_NIVEAU \/ \(CRANS_PAR_NIVEAU \* ZOOM_TAU\)/)
  assert.match(MODES_SRC, /const ZOOM_VEL_MAX = 1\.3\b/)
})

// ══════════ ④ DEUX SORTIES, ET LA RÈGLE LE DIT ═════════════════════════════

test('④ D21 ① porte DEUX sorties, avec la raison chiffrée du retrait de la troisième', () => {
  assert.match(D21, /DEUX seules sorties|LES DEUX SEULES SORTIES/i, 'regle-D21.md annonce encore trois sorties')
  // la raison, et elle est chiffrée : le clic droit est un PAN dans le crop
  assert.match(D21, /pan/i)
  assert.match(D21, /8\/8/, 'le retrait de la troisième sortie doit porter sa mesure')
  // ⛔ et la molette porte SON chiffre, avant et après
  assert.match(D21, /161|162/, 'le coût mesuré de la molette a disparu de la règle')
})
