// VIE — DANS LE CROP, LE DEHORS NE SE RALLUME QUE SOUS LA MOLETTE EN DÉZOOM.
//
// > **Adrien, 2026-09-05 :** *« quand on entre en mode crop on ne puisse plus
// > revoir la terre complète si la caméra remonte via un déplacement autre
// > qu'un scroll à la roulette, comme on avait dit auparavant. Notre correction
// > n'avait pas fonctionné. »*
//
// ⚡ **CE QUE LA MESURE A DIT (`.banc/VIE/avant-glisse-bas.json`, 8 chargements)** :
// D21 ① tenait — le crop ne mourait pas — mais la porte du REPOS, elle, s'ouvrait
// sur n'importe quel mouvement (c'est sa loi depuis la Tâche N), et au-dessus de
// `ALT_ESTOMPAGE_DEBUT_M` la loi d'altitude vaut 0 : la planète ENTIÈRE était
// redessinée autour d'un crop vivant. C'est le chemin (b) du brief.
//
// Ce que ces tests gardaient (VIE, 2026-09-05 matin) : une permission
// `dehorsPermis` donnée par `armerSortie` (la molette en dézoom), qui faisait
// tomber la porte du repos dès la première image du geste — la planète
// redessinée autour d'un crop VIVANT.
//
// ⚡ **RÉÉCRITS PAR CA2 (D27, 2026-09-05 après-midi) — CE QUI CHANGE, ET
// POURQUOI.** Adrien a filmé exactement ce que cette permission produisait au
// dézoom (« bourré de bugs […] ça évite d'afficher des éléments qui sont hors
// crop ») ; CA1 l'a mesuré : `dehorsPermis` à +40 ms, 52 000 px hors emprise
// pendant 105 – 206 images, le crop vivant de part et d'autre du palier. La
// lecture retenue (brief CA2, déduction cohérente avec les deux citations) :
// **la permission de la molette vaut pour la SORTIE — quand le crop meurt —
// pas entre deux paliers d'un crop qui vit.** Ce que ① et ③ gardaient tient
// toujours, et plus fort : AUCUN geste ne rallume le dehors tant que le crop
// vit — glissé, inclinaison, bouton, ET la molette. Ce qui change : ② et ④ ne
// disent plus « la molette rallume », ils disent « la molette ARME la sortie,
// et le dehors ne revient qu'à la mort du crop » ; ⑤ dit que `dehorsPermis` est
// DÉRIVÉ (vrai exactement quand il n'y a plus de crop), pas un état consommé.
// `test/crop-avant-tout.test.js` ① mesure le geste filmé lui-même.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { creerVeilleCrop } from '../src/monde/branchement-crop.js'
import { creerVeilleRepos, SEUIL_BOUGE_LOG, IMAGES_CALME } from '../src/monde/veille-repos.js'
import { SEUIL_NAISSANCE_M, SEUIL_MORT_M } from '../src/monde/seuil-socle.js'

const ALT = SEUIL_NAISSANCE_M * 0.9
const D = 145.5
const bouge = (i) => D * Math.exp(SEUIL_BOUGE_LOG * 3 * i)

function globeDePapier() {
  const g = {
    cropSeul: null,
    posesCropSeul: 0,
    poserCrop: () => ({ cx: 0.5, cy: 0.5, demi: 0.01 }),
    construireParoisCrop: () => ({ refus: null }),
    poserHabillage: () => {},
    poserRampe: () => ({ refus: null }),
    poserMer: async () => ({ refus: null }),
    retirerCrop: () => {},
    poserCropSeul(v) { g.cropSeul = v; g.posesCropSeul++; return v },
  }
  return g
}
const ctx = () => ({ centre: { lat: 44.2, lon: 5.78 }, zoom: 13, tuilesParBloc: 3, habillage: {} })
function estompageDePapier() {
  const etat = { repos: null, appels: [] }
  return { etat, maj() {}, poserMode() {}, poserRepos(v) { etat.repos = v; etat.appels.push(!!v) } }
}
function monter() {
  const g = globeDePapier()
  const est = estompageDePapier()
  const veille = creerVeilleCrop({ globe: () => g, contexte: ctx, estompage: est, repos: creerVeilleRepos() })
  veille.maj(ALT, D)
  assert.equal(veille.pose, true, 'le crop n’est pas posé')
  assert.equal(veille.repos, true, 'le repos n’est pas relayé au départ')
  return { g, est, veille }
}
const calme = (veille, d, alt = ALT) => { for (let i = 0; i < IMAGES_CALME + 1; i++) veille.maj(alt, d) }

test('① un glissé, une inclinaison, un bouton de caméra — le dehors reste ÉTEINT', () => {
  const { g, est, veille } = monter()
  // le mouvement est franc (3 × le seuil, 60 images), et il MONTE l'altitude
  // au-dessus de la mort du crop : c'est le geste d'Adrien, mesuré
  for (let i = 1; i <= 60; i++) veille.maj(ALT * (1 + i / 30), bouge(i))
  assert.equal(veille.pose, true, 'le crop est mort sans intention (D21 ①)')
  assert.equal(veille.repos, true, 'le relais du repos est tombé sur un mouvement sans molette')
  assert.equal(g.cropSeul, true, 'le quadtree est reparti parcourir le dehors')
  assert.equal(est.etat.appels.filter((v) => v === false).length, 0, '`poserRepos(false)` est parti sans molette')
  assert.equal(veille.dehorsPermis, false)
})

test('② D27 — la molette en dézoom ARME la sortie et ne rallume RIEN tant que le crop vit ; le dehors revient à la mort du crop', () => {
  const { g, est, veille } = monter()
  veille.armerSortie()
  assert.equal(veille.sortieArmee, true, '`armerSortie` n’arme pas l’intention (D21 ①)')
  assert.equal(veille.dehorsPermis, false, 'le crop vit : le dehors n’a pas la permission')
  // le geste : la distance bouge franchement, l'altitude monte SOUS la mort
  for (let i = 1; i <= 60; i++) veille.maj(Math.min(ALT * (1 + i / 60), SEUIL_MORT_M * 0.94), bouge(i))
  assert.equal(veille.pose, true, 'le crop est mort sous le seuil')
  assert.equal(veille.repos, true, 'sous la molette, le dehors s’est rallumé — c’est la vidéo d’Adrien')
  assert.equal(g.cropSeul, true, 'le quadtree est reparti parcourir le dehors')
  assert.equal(est.etat.appels.filter((v) => v === false).length, 0, '`poserRepos(false)` est parti pendant que le crop vivait')
  // la sortie est PRONONCÉE : l'intention armée et l'altitude de mort — le crop meurt, le dehors revient
  veille.maj(SEUIL_MORT_M * 1.01, bouge(61))
  assert.equal(veille.pose, false, 'la sortie armée n’a pas tué le crop')
  assert.equal(veille.dehorsPermis, true, 'le crop est mort et le dehors n’a toujours pas la permission')
  assert.equal(est.etat.repos, false, 'à la mort, le relais du repos n’est pas retombé : la planète resterait effacée')
  assert.equal(g.cropSeul, false)
})

test('③ un zoom AVANT retire la permission', () => {
  const { veille } = monter()
  veille.armerSortie()
  veille.desarmerSortie()
  assert.equal(veille.dehorsPermis, false)
  for (let i = 1; i <= 40; i++) veille.maj(ALT, bouge(i))
  assert.equal(veille.repos, true, 'le zoom avant rallume le dehors')
})

test('④ D27 — l’intention donnée AU REPOS survit jusqu’au geste (D21 ①), et le geste qui suit ne rallume rien', () => {
  // ⚠️ Le cran de molette arrive au DOM AVANT la première image du glissement :
  // à cet instant la vue est encore au repos. L'intention de sortie doit
  // survivre à ces images posées (c'est elle qui autorisera la mort) — mais
  // rien ne se dessine hors du crop avant cette mort.
  const { g, veille } = monter()
  veille.armerSortie()
  for (let i = 0; i < 5; i++) veille.maj(ALT, D) // cinq images posées, cran déjà reçu
  assert.equal(veille.sortieArmee, true, 'l’intention est consommée avant le geste')
  assert.equal(veille.dehorsPermis, false)
  veille.maj(ALT, bouge(1))
  assert.equal(veille.repos, true, 'la molette rallume le dehors sur un crop vivant')
  assert.equal(g.cropSeul, true)
})

test('⑤ D27 — `dehorsPermis` est DÉRIVÉ : vrai exactement quand il n’y a pas de crop, quoi qu’on ait armé', () => {
  const g = globeDePapier()
  const veille = creerVeilleCrop({ globe: () => g, contexte: ctx, estompage: estompageDePapier(), repos: creerVeilleRepos() })
  veille.maj(SEUIL_MORT_M * 2, D) // pas de crop
  assert.equal(veille.dehorsPermis, true, 'sans crop, la planète est le sujet : le dehors est permis')
  veille.armerSortie()
  veille.maj(ALT, D) // naissance
  assert.equal(veille.pose, true)
  assert.equal(veille.dehorsPermis, false, 'le crop est né : le dehors n’est plus permis')
  assert.equal(veille.sortieArmee, false, 'la naissance n’a pas remis l’intention à zéro (D21 ①)')
  veille.armerSortie()
  veille.maj(SEUIL_MORT_M * 1.01, D) // mort, intention armée
  assert.equal(veille.pose, false)
  assert.equal(veille.dehorsPermis, true, 'le crop est mort : le dehors est permis')
  assert.equal(veille.sortieArmee, false, 'la mort n’a pas consommé l’intention')
})

test('⑥ `sortieArmee` (D21 ①) SURVIT au repos ; la permission, non — ce ne sont pas la même chose', () => {
  const { veille } = monter()
  veille.armerSortie()
  veille.maj(ALT, bouge(1))
  calme(veille, bouge(1))
  assert.equal(veille.sortieArmee, true, 'l’intention de D21 ① a été consommée par le repos')
  assert.equal(veille.dehorsPermis, false)
  // et l'intention fait toujours son travail : au-dessus du seuil, le crop meurt
  veille.maj(SEUIL_MORT_M * 1.01, bouge(1))
  assert.equal(veille.pose, false)
})

test('⑦ dans `main.js`, `armerSortie` n’est appelée que par l’intention de zoom (la molette)', () => {
  // ⚠️ Un second appelant — un bouton de caméra, un glissé — redonnerait la
  // permission par une porte qui n'est pas la molette.
  const src = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8').replace(/\/\/[^\n]*/g, '')
  const appels = src.match(/\.armerSortie\?\.\(\)/g) ?? []
  assert.equal(appels.length, 2, `${appels.length} appels à armerSortie dans main.js (attendu : 2, veilleCrop et veilleSocle dans intentionZoom)`)
  assert.match(src, /function intentionZoom\(deltaY\)[\s\S]{0,200}veilleCrop\?\.armerSortie\?\.\(\)/)
})
