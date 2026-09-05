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
// Ce que ces tests gardent : la permission `dehorsPermis` de
// `branchement-crop.js` — donnée par `armerSortie` (la molette en dézoom, et
// elle seule), consommée par le retour au repos, le zoom avant et les bascules.
// Vérifié par mutation (2026-09-05) : retirer le terme `!dehorsPermis` du relais
// fait rougir ①, ② et ③ ; consommer la permission à CHAQUE image de repos (au
// lieu du front montant) fait rougir ④ ; ne pas la consommer au retour au repos
// fait rougir ② et ⑥ ; un `armerSortie` qui ne la donne plus fait rougir ② et ④.
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

test('② la molette en dézoom rallume le dehors ; le retour au repos CONSOMME la permission', () => {
  const { g, est, veille } = monter()
  veille.armerSortie()
  assert.equal(veille.dehorsPermis, true, '`armerSortie` ne donne pas la permission')
  veille.maj(ALT, bouge(1))
  assert.equal(veille.repos, false, 'sous la molette, le dehors ne se rallume pas')
  assert.equal(g.cropSeul, false)
  assert.equal(est.etat.repos, false)
  calme(veille, bouge(1))
  assert.equal(veille.repos, true, 'la vue posée ne recroppe pas')
  assert.equal(veille.dehorsPermis, false, 'le retour au repos n’a pas consommé la permission')
  // et le glissé qui suit, une minute plus tard, ne la retrouve pas
  for (let i = 2; i <= 40; i++) veille.maj(ALT, bouge(i))
  assert.equal(veille.repos, true, 'un glissé après un cran isolé a rallumé la Terre')
  assert.equal(g.cropSeul, true)
})

test('③ un zoom AVANT retire la permission', () => {
  const { veille } = monter()
  veille.armerSortie()
  veille.desarmerSortie()
  assert.equal(veille.dehorsPermis, false)
  for (let i = 1; i <= 40; i++) veille.maj(ALT, bouge(i))
  assert.equal(veille.repos, true, 'le zoom avant rallume le dehors')
})

test('④ une permission donnée AU REPOS survit jusqu’au geste — front montant, pas niveau', () => {
  // ⚠️ Le cran de molette arrive au DOM AVANT la première image du glissement :
  // à cet instant la vue est encore au repos. Consommer la permission à chaque
  // image de repos la tuerait avant le geste qu'elle autorise, et la molette
  // ne rallumerait plus jamais le dehors.
  const { veille } = monter()
  veille.armerSortie()
  for (let i = 0; i < 5; i++) veille.maj(ALT, D) // cinq images posées, cran déjà reçu
  assert.equal(veille.dehorsPermis, true, 'la permission est consommée avant le geste')
  veille.maj(ALT, bouge(1))
  assert.equal(veille.repos, false, 'la molette ne rallume plus le dehors')
})

test('⑤ la naissance et la mort du crop consomment la permission', () => {
  const g = globeDePapier()
  const veille = creerVeilleCrop({ globe: () => g, contexte: ctx, estompage: estompageDePapier(), repos: creerVeilleRepos() })
  veille.maj(SEUIL_MORT_M * 2, D) // pas de crop
  veille.armerSortie()
  veille.maj(ALT, D) // naissance
  assert.equal(veille.pose, true)
  assert.equal(veille.dehorsPermis, false, 'la naissance n’a pas consommé la permission')
  veille.armerSortie()
  veille.maj(SEUIL_MORT_M * 1.01, D) // mort, intention armée
  assert.equal(veille.pose, false)
  assert.equal(veille.dehorsPermis, false, 'la mort n’a pas consommé la permission')
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
