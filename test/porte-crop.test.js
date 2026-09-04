// LA PORTE DU CROP DOIT S'OUVRIR DANS LES DEUX SENS — Tâche PORTE.
//
// ⚡ **CE QUI REND CE FICHIER NÉCESSAIRE, ET C'EST UN CHIFFRE.** Un agent a
// rapporté « la molette sort du crop mais n'y fait plus rentrer — porte à sens
// unique ». ⛔ **Réfuté, 8 chargements** (`.banc/PORTE/avant-retour-8.json`, un
// cran par lecture, aller PUIS retour) : **le crop renaît 8/8**. Mais la mesure
// a trouvé autre chose, et de vrai : la porte n'est pas à sens unique, **elle
// est à PENTE**. Sortie **8 à 10 crans**, retour **21 à 32**.
//
// **La cause n'est ni la renaissance ni son seuil — c'est le SURVOL de la
// sortie.** Le crop mourait entre **41 119 et 58 160 m** puis la caméra montait
// jusqu'à **45 555 – 63 890 m**, c'est-à-dire jusqu'à `1,6 × SEUIL_MORT_M` =
// **64 549 m**, la visée de `MARGE_SORTIE` elle-même. SORTIE l'avait écrite
// « sans effet, puisque la poussée est arrêtée à la mort du crop » ; elle avait
// tout l'effet, parce que le budget est en log-DISTANCE et que les
// franchissements CONSERVENT l'altitude : le budget ne sait pas où il en est en
// altitude, donc il ne peut pas s'arrêter au bon endroit.
//
// ➡️ **LE CORRECTIF : la poussée reçoit un `reste()`** — ce qui MANQUE en
// log-altitude pour que D21 ① prononce la mort — lu à chaque image. `≤ 0`
// arrête la course ; sinon le pas de l'image y est **écrêté**, ce qui supprime
// la dernière marche (une image vaut ici +43 % d'altitude) sans toucher au taux.
//
// ⛔ **ET C'EST POURQUOI CE N'EST PAS UN PLAFOND DE PAS FIXE.** Un
// `PAS_SORTIE_MAX_LOG = 0,12` a été écrit, mesuré et retiré : il bornait bien le
// survol (mort à 40 366 – 41 654 m, 8/8) mais divisait le taux par trois à
// `dt = 0,06 s`, et la sortie passait de 8-9 crans à **15-40**
// (`.banc/PORTE/apres-retour-8.json`). Le § ④ garde les deux moitiés du critère.
//
// Mesuré après (`apres2-retour-8.json`, `apres-ar3-4.json`) : sortie **8-10**,
// mort **41 124 – 41 814 m**, retour **21-22**, aller-retour **12/12 sans
// dérive**.
//
// ⚠️ **CE QUE CE FICHIER NE PEUT PAS TESTER** : que le crop renaisse vraiment à
// l'écran. Ça se mesure au navigateur, huit chargements —
// `scripts/sonde-porte.mjs` et `rapport-PORTE.md`.

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Y_CIBLE } from '../src/loi-altitude.js'
import { SEUIL_MORT_M, SEUIL_NAISSANCE_M } from '../src/monde/seuil-socle.js'

const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const lire = (p) => fs.readFileSync(path.join(RACINE, p), 'utf8')
const MAIN = lire('src/main.js')
const MODES_SRC = lire('src/modes.js')

// Le même banc de pacotille que `sortie-crop.test.js` — trois fichiers plus
// loin, et volontairement recopié : ce banc EST la moitié du test, et l'importer
// d'un autre fichier de test lierait deux tâches par leur outillage.
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
  const { Modes, BUDGET_NIVEAU, TAUX_SORTIE_LOG_S } = await import('../src/modes.js')
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
  return { m, camera, controls, etat, BUDGET_NIVEAU, TAUX_SORTIE_LOG_S }
}

// ══════════ ① LE RESTE ÉCRÊTE LE PAS — LE SURVOL, EN UNITAIRE ══════════════

test('① ⛔ LE DERNIER PAS EST ÉCRÊTÉ AU RESTE — c’est le survol de 64 549 m, rejoué', async () => {
  // ⚠️ **LE DÉFAUT EN UN CHIFFRE.** `dt = 0,06 s` (les ~16 images/s mesurées
  // pendant la course) donne un pas de `6 × 0,06 = 0,36` nat, soit **×1,43
  // d'altitude EN UNE IMAGE**. S'il ne reste que 0,05 nat à faire, dépenser 0,36
  // c'est franchir le seuil de 36 % de trop — et l'utilisateur repaie chacun de
  // ces mètres au retour, à 0,0347 nat par cran.
  const { m, camera } = await machine()
  camera.position.set(0, 40 + Y_CIBLE, 0)
  const niv0 = m.zoomNiveau()
  m.armerPousseeSortie(3, () => 0.05)
  m._avancerPousseeSortie(0.06)
  const pris = m.zoomNiveau() - niv0
  assert.ok(pris <= 0.05 + 1e-9, `le pas a dépensé ${pris.toFixed(4)} nat alors qu’il ne restait que 0,05 : le survol est de retour`)
  assert.ok(pris > 0.04, `le pas n’a rien dépensé du tout (${pris.toFixed(4)}) : la course n’avance plus`)
})

test('① bis un reste ≤ 0 arrête la course sur-le-champ, sans dépenser l’image', async () => {
  const { m, camera } = await machine()
  camera.position.set(0, 40 + Y_CIBLE, 0)
  const niv0 = m.zoomNiveau()
  m.armerPousseeSortie(3, () => 0)
  assert.equal(m.pousseeSortieActive, true)
  m._avancerPousseeSortie(0.06)
  assert.equal(m.pousseeSortieActive, false, 'la course continue alors que le crop est déjà mort')
  assert.equal(m.zoomNiveau(), niv0, 'une image de trop a été dépensée : le reste est lu APRÈS le pas')
})

test('① ter un reste qui n’est pas un nombre fini arrête aussi — jamais de course aveugle', async () => {
  for (const mauvais of [NaN, Infinity, undefined, null, 'x']) {
    const { m, camera } = await machine()
    camera.position.set(0, 40 + Y_CIBLE, 0)
    m.armerPousseeSortie(3, () => mauvais)
    m._avancerPousseeSortie(0.06)
    assert.equal(m.pousseeSortieActive, false, `un reste ${String(mauvais)} laisse la course filer`)
  }
})

test('① quater le reste est relu À CHAQUE IMAGE, pas une fois pour toutes', async () => {
  // ⚠️ C'est tout l'intérêt d'une fermeture : l'altitude bouge pendant la course.
  const { m, camera } = await machine()
  camera.position.set(0, 40 + Y_CIBLE, 0)
  let lectures = 0
  m.armerPousseeSortie(10, () => { lectures++; return 1 })
  for (let i = 0; i < 5; i++) m._avancerPousseeSortie(0.02)
  assert.equal(lectures, 5, `le reste n’a été lu que ${lectures} fois pour 5 images`)
})

test('① quinquies la course s’arrête au tour où le reste tombe à zéro, pas après', async () => {
  const { m, camera } = await machine()
  camera.position.set(0, 40 + Y_CIBLE, 0)
  let restant = 0.24
  m.armerPousseeSortie(10, () => restant)
  for (let i = 0; i < 10 && m.pousseeSortieActive; i++) {
    m._avancerPousseeSortie(0.02) // 0,12 nat voulu, écrêté au restant
    restant -= 0.12
  }
  assert.equal(m.pousseeSortieActive, false)
})

// ══════════ ② LA SORTIE EN 8-9 CRANS N'EST PAS PAYÉE POUR ÇA ═══════════════

test('② ⛔ LE TAUX N’EST PAS TOUCHÉ — tant qu’il reste du chemin, la poussée va plein pot', async () => {
  // ⚡ **C'est la moitié du critère que le plafond de pas fixe avait perdue** :
  // à `dt = 0,06 s`, `PAS_SORTIE_MAX_LOG = 0,12` divisait le taux par trois et
  // la sortie passait de 8-9 crans à 15-40. Écrêter au RESTE ne coûte rien tant
  // que le reste est grand.
  const { m, camera, TAUX_SORTIE_LOG_S } = await machine()
  camera.position.set(0, 40 + Y_CIBLE, 0)
  const niv0 = m.zoomNiveau()
  m.armerPousseeSortie(10, () => 99) // beaucoup de chemin devant
  m._avancerPousseeSortie(0.06)
  const pris = m.zoomNiveau() - niv0
  assert.ok(Math.abs(pris - TAUX_SORTIE_LOG_S * 0.06) < 1e-9, `le pas vaut ${pris.toFixed(4)} au lieu de ${(TAUX_SORTIE_LOG_S * 0.06).toFixed(4)} : le taux a été rogné`)
})

test('② bis ⛔ AUCUN PLAFOND DE PAS FIXE N’EST REVENU DANS LA COURSE', () => {
  // Il a été écrit, mesuré, et retiré — avec sa mesure. Qu'il ne revienne pas
  // par distraction : il rachèterait le survol en reperdant la sortie.
  assert.ok(!/PAS_SORTIE_MAX_LOG\s*[,)]/.test(MODES_SRC.slice(MODES_SRC.indexOf('_avancerPousseeSortie(dt)'))), 'un plafond de pas fixe est revenu dans `_avancerPousseeSortie`')
  assert.match(MODES_SRC, /export const TAUX_SORTIE_LOG_S = 6\b/)
})

test('② ter sans `reste`, le comportement de SORTIE est conservé au bit', async () => {
  // La rétro-compatibilité n'est pas une politesse : `armerPousseeSortie` est
  // appelée par `sortie-crop.test.js` sans second argument, et ce banc-là garde
  // les 23 crans morts.
  const { m, camera, TAUX_SORTIE_LOG_S } = await machine()
  camera.position.set(0, 40 + Y_CIBLE, 0)
  const niv0 = m.zoomNiveau()
  assert.equal(m.armerPousseeSortie(3), true)
  m._avancerPousseeSortie(0.05)
  assert.ok(Math.abs((m.zoomNiveau() - niv0) - TAUX_SORTIE_LOG_S * 0.05) < 1e-9)
  assert.equal(m.pousseeSortieActive, true)
})

test('② quater un `reste` qui n’est pas une fonction est ignoré, pas planté', async () => {
  const { m, camera } = await machine()
  camera.position.set(0, 40 + Y_CIBLE, 0)
  assert.equal(m.armerPousseeSortie(3, 0.05), true, 'un nombre passé par erreur ne doit pas empêcher la sortie')
  m._avancerPousseeSortie(0.05)
  assert.equal(m.pousseeSortieActive, true)
})

// ══════════ ③ LE BRANCHEMENT — `main.js` n'est chargé par aucun test ════════

test('③ la poussée est armée AVEC le reste, et le reste est une fermeture', () => {
  const i = MAIN.indexOf('function confirmerSortieMolette')
  assert.ok(i > 0)
  const corps = MAIN.slice(i, MAIN.indexOf('\n}', i))
  assert.match(corps, /armerPousseeSortie\?\.\(budget,\s*resteSortieLog\)/, 'la poussée est armée sans son terminus : le survol revient')
})

test('③ bis `resteSortieLog` lit l’altitude à l’appel et rend ce qui MANQUE', () => {
  const i = MAIN.indexOf('function resteSortieLog')
  assert.ok(i > 0, '`resteSortieLog` a disparu')
  const corps = MAIN.slice(i, MAIN.indexOf('\n}', i))
  assert.match(corps, /altitudeCadrageM\(\)/, 'le reste doit se lire sur l’altitude de CADRAGE (espace bloc), pas l’altitude de fond — REV n° 4')
  assert.match(corps, /SEUIL_MORT_M \* ARRET_SORTIE/)
  assert.match(corps, /Math\.log\(/, 'le reste est une LOG-altitude : la poussée écrête un pas en log')
  assert.ok(!/40\s*342|32\s*274/.test(corps), 'un seuil est recopié en dur')
})

test('③ ter ⛔ LA MARGE D’ARRÊT N’EST PAS LA MARGE DE BUDGET — c’est tout le correctif', () => {
  // ⚠️ **LE DÉFAUT ÉTAIT LÀ, EN UNE LIGNE.** Un seul nombre servait aux deux :
  // viser large (pour que la sortie tienne en 8-9 crans) ET s'arrêter (pour ne
  // pas survoler). Les deux besoins sont opposés. Ce sont deux constantes.
  const arret = Number(/const ARRET_SORTIE = ([\d.]+)/.exec(MAIN)?.[1])
  const marge = Number(/const MARGE_SORTIE = ([\d.]+)/.exec(MAIN)?.[1])
  assert.ok(Number.isFinite(arret) && Number.isFinite(marge))
  assert.ok(arret < 1.1, `ARRET_SORTIE = ${arret} : la poussée vise ${Math.round(SEUIL_MORT_M * arret)} m, soit ${Math.round(Math.log(SEUIL_MORT_M * arret / SEUIL_NAISSANCE_M) / 0.0347)} crans à repayer au retour`)
  assert.ok(arret > 1, `ARRET_SORTIE = ${arret} : la poussée s’arrête SOUS le seuil de mort, D21 ① ne prononce jamais la mort et la sortie ne se fait pas`)
  assert.ok(marge >= 1.5, `MARGE_SORTIE = ${marge} : le budget de la course a été rogné, et c’est lui qui donne la sortie en 8-9 crans`)
  assert.ok(marge > arret, 'le budget doit dépasser l’arrêt, sinon la course meurt avant d’arriver')
})

test('③ quater le seuil de MORT et le seuil de NAISSANCE restent séparés — D23', () => {
  // Le retour ne se règle PAS en abaissant le seuil de mort vers celui de
  // naissance : ce sont quatre constantes, et les refusionner coûtait 568 km
  // de D19 (C1, réfutation n° 5).
  const SOCLE = lire('src/monde/seuil-socle.js')
  assert.match(SOCLE, /export const SEUIL_NAISSANCE_M = SEUIL_BLOC_M/)
  assert.match(SOCLE, /export const SEUIL_MORT_M = SEUIL_BLOC_MORT_M/)
  assert.ok(SEUIL_MORT_M > SEUIL_NAISSANCE_M, 'l’hystérésis du crop a disparu : la bascule redevient un clignotant')
})

// ══════════ ④ LE CRITÈRE, ÉCRIT — pour qu’il ne se reperde pas ═════════════

test('④ le survol visé tient dans un aller-retour raisonnable — le calcul, pas la mesure', () => {
  // ⚠️ **CE TEST NE MESURE RIEN À L'ÉCRAN** — il vérifie que le CHIFFRE VISÉ est
  // tenable. La mesure est au navigateur (`apres2-retour-8.json`) : mort à
  // 41 124 – 41 814 m, retour 21-22 crans, 8/8.
  const arret = Number(/const ARRET_SORTIE = ([\d.]+)/.exec(MAIN)?.[1])
  const cransRetour = Math.log((SEUIL_MORT_M * arret) / SEUIL_NAISSANCE_M) / (Math.log(2) / 20)
  assert.ok(cransRetour < 8, `le retour depuis la visée coûte ${cransRetour.toFixed(1)} crans de pur survol`)
  // et avec l'ancienne visée (1,6), il en coûtait combien ?
  const avant = Math.log((SEUIL_MORT_M * 1.6) / SEUIL_NAISSANCE_M) / (Math.log(2) / 20)
  assert.ok(avant > 19, 'le calcul du défaut ne retrouve plus le défaut : le banc a changé de sens')
})
