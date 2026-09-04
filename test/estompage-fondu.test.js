// LE FONDU DU REPOS — MIX, défaut ① d'Adrien (2026-09-04).
//
// > *« On a un scintillement, ou un affichage / désaffichage des différentes
// > couches : celles qui correspondent à la Terre vue de l'espace, et celles qui
// > correspondent à la Terre vue en mode crop. »*
//
// ══════════ CE QUE CES TESTS VERROUILLENT, ET LE CHIFFRE QUI LES A ÉCRITS ═══
//
// ⚡ **MESURÉ AVANT CORRECTION** — `.banc/MIX/avant.json`, Majorque, douze
// paliers de 253 km à 9 km, 1 506 images relevées DANS `composer.render` :
// à chaque cran de zoom, `uEstompage` fait **1 → 0 → 1, un flanc par IMAGE**
// (15 ms), deux fois par cran, 550 à 830 ms d'alentours à pleine opacité. Et à
// la MÊME image, le cache passait de **1 105 à 989 tuiles** et les tuiles
// dessinées de **297 à 287** : le parcours réduit coupait le dehors au moment
// précis où il fallait l'estomper.
//
// ⛔ **LES DEUX AUTRES CAUSES SONT RÉFUTÉES PAR LA MESURE, PAS PAR LE GOÛT.**
// Sur 46 à 233 images consécutives à chaque palier, caméra immobile et
// `uEstompage` constant, **zéro pixel sur 64 000 ne change de plus de 64
// niveaux** : pas de combat de profondeur. Et aucun état d'ordre (`uCropOn`,
// `uHabOn`, les parois) ne bascule au repos : pas de `renderOrder` instable.
//
// ⚠️ **CHACUN DE CES TESTS ÉCHOUE SUR LE CODE D'AVANT**, et c'est le seul
// critère qui les justifie.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  creerVeilleEstompage,
  estompageTerre,
  IMAGES_FONDU_REPOS,
  ALT_ESTOMPAGE_DEBUT_M,
  ALT_ESTOMPAGE_FIN_M,
} from '../src/monde/estompage-terre.js'
import { IMAGES_CALME } from '../src/monde/veille-repos.js'
import { creerVeilleCrop } from '../src/monde/branchement-crop.js'

const SRC_MAIN = fileURLToPath(new URL('../src/main.js', import.meta.url))
const SRC_BRANCHE = fileURLToPath(new URL('../src/monde/branchement-crop.js', import.meta.url))

// une altitude AU-DESSUS de la bande : la loi y vaut 0, donc la porte du repos
// y porte tout l'écart — c'est là que la marche valait UN.
const ALT_HAUTE = ALT_ESTOMPAGE_DEBUT_M * 4
// une altitude SOUS la bande : la loi y vaut 1, la porte n'a rien à fondre.
const ALT_BASSE = ALT_ESTOMPAGE_FIN_M / 2

// ══════════ ① LA DURÉE DU FONDU N'EST PAS POSÉE, ELLE EST LUE ══════════════

test('① la durée du fondu EST l’hystérésis du repos — pas un chiffre voisin', () => {
  assert.equal(IMAGES_FONDU_REPOS, IMAGES_CALME)
  assert.ok(IMAGES_FONDU_REPOS >= 2, 'un fondu d’une image est une marche')
})

test('① aucun compte d’images n’est écrit en dur dans le module', () => {
  const src = readFileSync(fileURLToPath(new URL('../src/monde/estompage-terre.js', import.meta.url)), 'utf8')
  const code = src.replace(/\/\/[^\n]*/g, ' ')
  assert.ok(!/IMAGES_FONDU_REPOS\s*=\s*\d/.test(code), 'la durée du fondu est posée au lieu d’être dérivée')
})

// ══════════ ② LA MARCHE D'UNE IMAGE A DISPARU — LE CRITÈRE D'ADRIEN ════════

test('② la SORTIE du repos ne saute plus : aucune image ne déplace la couche d’un demi', () => {
  const vus = []
  const v = creerVeilleEstompage({ appliquer: (f) => vus.push(f) })
  v.maj(ALT_HAUTE)
  v.poserRepos(true) // premier relais : franc, il n'y a rien à fondre
  assert.equal(v.valeur, 1)
  vus.length = 0
  // le geste commence : la vue bouge, le repos tombe
  v.poserRepos(false)
  const suite = [v.valeur]
  for (let i = 0; i < IMAGES_FONDU_REPOS + 5; i++) { v.maj(ALT_HAUTE); suite.push(v.avancerFondu()) }
  assert.equal(suite.at(-1), 0, 'le fondu doit finir par rendre la planète entière')
  let pire = 0
  for (let i = 1; i < suite.length; i++) pire = Math.max(pire, Math.abs(suite[i] - suite[i - 1]))
  assert.ok(pire < 0.5, `une image déplace la couche de ${pire} — c’est un affichage/désaffichage`)
})

test('② le RETOUR au repos ne saute pas non plus — la mesure comptait DEUX marches par cran', () => {
  const v = creerVeilleEstompage({ appliquer: () => {} })
  v.maj(ALT_HAUTE)
  v.poserRepos(true)
  v.poserRepos(false)
  for (let i = 0; i < IMAGES_FONDU_REPOS + 5; i++) { v.maj(ALT_HAUTE); v.avancerFondu() }
  // la vue se stabilise : on recroppe
  v.poserRepos(true)
  const suite = [v.valeur]
  for (let i = 0; i < IMAGES_FONDU_REPOS + 5; i++) { v.maj(ALT_HAUTE); suite.push(v.avancerFondu()) }
  assert.equal(suite.at(-1), 1)
  let pire = 0
  for (let i = 1; i < suite.length; i++) pire = Math.max(pire, Math.abs(suite[i] - suite[i - 1]))
  assert.ok(pire < 0.5, `le retour au repos saute de ${pire}`)
})

test('② un aller-retour complet du repos ne compte AUCUNE image scintillante — 20 images consécutives', () => {
  // ⚠️ **LE CRITÈRE EST CELUI DU BRIEF** : zéro image scintillante sur vingt
  // consécutives pendant la transition. Une image est scintillante si l'opacité
  // de la couche « Terre autour » saute d'au moins un demi en une image.
  const v = creerVeilleEstompage({ appliquer: () => {} })
  v.maj(ALT_HAUTE)
  v.poserRepos(true)
  const suite = []
  v.poserRepos(false)
  for (let i = 0; i < 20; i++) { v.maj(ALT_HAUTE); suite.push(v.avancerFondu()) }
  v.poserRepos(true)
  for (let i = 0; i < 20; i++) { v.maj(ALT_HAUTE); suite.push(v.avancerFondu()) }
  let scintillantes = 0
  for (let i = 1; i < suite.length; i++) if (Math.abs(suite[i] - suite[i - 1]) >= 0.5) scintillantes++
  assert.equal(scintillantes, 0)
})

// ══════════ ③ LA LOI N'EST PAS TOUCHÉE ═════════════════════════════════════

test('③ hors repos, la valeur posée est la LOI, au bit près', () => {
  const v = creerVeilleEstompage({ appliquer: () => {} })
  for (const alt of [ALT_HAUTE, ALT_ESTOMPAGE_DEBUT_M * 0.8, ALT_ESTOMPAGE_FIN_M * 1.2, ALT_BASSE]) {
    v.maj(alt)
    assert.equal(v.valeur, estompageTerre({ altitudeEllipsoideM: alt }), `la loi est altérée à ${alt} m`)
  }
})

test('③ SOUS la bande la loi vaut UN : le fondu y est invisible par construction', () => {
  // C'est ce que la mesure relève déjà — sous 19 364 m, `uEstompage` ne
  // bascule jamais, avant comme après.
  const v = creerVeilleEstompage({ appliquer: () => {} })
  v.maj(ALT_BASSE)
  v.poserRepos(true)
  v.poserRepos(false)
  for (let i = 0; i < IMAGES_FONDU_REPOS + 5; i++) { v.maj(ALT_BASSE); assert.equal(v.avancerFondu(), 1) }
})

test('③ l’ORBITE prime toujours, et SANS fondu — la Terre y est le sujet', () => {
  const v = creerVeilleEstompage({ appliquer: () => {} })
  v.maj(ALT_HAUTE)
  v.poserRepos(true)
  assert.equal(v.valeur, 1)
  v.poserMode(false)
  assert.equal(v.valeur, 0, 'un fondu à l’entrée en orbite laisserait une planète effacée')
})

test('③ le PREMIER relais est franc — sinon la planète se montre à l’arrivée', () => {
  // `veille-repos.js` : « il démarre au repos, et ce n'est pas un détail ».
  const vus = []
  const v = creerVeilleEstompage({ appliquer: (f) => vus.push(f) })
  v.maj(ALT_HAUTE)
  v.poserRepos(true)
  assert.equal(v.valeur, 1)
  assert.deepEqual(vus, [1])
})

// ══════════ ④ LE PARCOURS RÉDUIT ATTEND LA FIN DU FONDU ════════════════════

function globeDePapier(journal) {
  return {
    poserCrop: () => ({ cx: 0.5, cy: 0.5, demi: 0.01, zoom: 10 }),
    construireParoisCrop: () => ({ refus: null }),
    poserHabillage: () => {},
    poserRampe: () => ({ refus: null }),
    poserMer: () => ({ refus: null }),
    poserCropSeul: (v) => journal.push(v),
    retirerCrop: () => {},
    majEchelleRampe: () => {},
  }
}

test('④ `poserCropSeul(true)` n’est POSÉ qu’une fois le fondu achevé', () => {
  const journal = []
  const g = globeDePapier(journal)
  const est = creerVeilleEstompage({ appliquer: () => {} })
  const repos = { auRepos: true, maj() { return this.auRepos }, oublier() {} }
  const v = creerVeilleCrop({
    globe: () => g,
    contexte: () => ({ centre: { lat: 39.57, lon: 2.65 }, zoom: 10, tuilesParBloc: 3 }),
    estompage: est,
    repos,
  })
  // le crop naît, la vue est au repos : premier relais franc, coupe immédiate
  v.maj(ALT_HAUTE, 100)
  assert.deepEqual(journal, [true], 'le premier repos doit couper tout de suite')
  // le geste commence
  journal.length = 0
  repos.auRepos = false
  v.maj(ALT_HAUTE, 200)
  assert.deepEqual(journal, [false], 'le dehors doit se redessiner dès la première image du geste')
  // le geste dure : le fondu descend jusqu'au bout
  for (let i = 0; i < IMAGES_FONDU_REPOS; i++) { est.avancerFondu(); v.maj(ALT_HAUTE, 200) }
  assert.deepEqual(journal, [false], 'le parcours a rebasculé pendant le geste')
  // la vue se stabilise : le fondu part, mais le parcours NE DOIT PAS couper
  journal.length = 0
  repos.auRepos = true
  v.maj(ALT_HAUTE, 200)
  assert.deepEqual(journal, [], 'le parcours a coupé pendant que le fondu courait encore')
  // le fondu court
  for (let i = 0; i < IMAGES_FONDU_REPOS; i++) { est.avancerFondu(); v.maj(ALT_HAUTE, 200) }
  assert.deepEqual(journal, [true], 'le parcours n’a jamais coupé, ou il a coupé plus d’une fois')
})

// ══════════ ⑤ LE BRANCHEMENT — main.js n'est chargé par AUCUN test ══════════

test('⑤ `majEstompage` avance le fondu SANS la garde de `busy`', () => {
  // ⛔ **C'EST LE POINT DE BRANCHEMENT, ET IL EST FRAGILE.** Le fondu doit
  // courir PENDANT le cran ; `majSeuilSocle` s'arrête sur `modes.busy`, donc
  // sur toutes les images du cran. Un `avancerFondu` posé derrière cette garde
  // rendrait la marche qu'il existe pour supprimer.
  const src = readFileSync(SRC_MAIN, 'utf8')
  const i = src.indexOf('function majEstompage()')
  assert.ok(i > 0, '`majEstompage` a disparu de `main.js`')
  const corps = src.slice(i, src.indexOf('\n}', i))
  const iFondu = corps.indexOf('avancerFondu')
  const iBusy = corps.indexOf('modes?.busy')
  assert.ok(iFondu > 0, '`majEstompage` n’avance jamais le fondu')
  assert.ok(iBusy < 0 || iFondu < iBusy, 'le fondu est avancé APRÈS la garde `busy` — il gèlera pendant le cran')
})

test('⑤ `branchement-crop.js` sépare le parcours réduit du relais de repos', () => {
  const src = readFileSync(SRC_BRANCHE, 'utf8')
  const code = src.replace(/\/\/[^\n]*/g, ' ')
  assert.ok(code.includes('fonduAcheve'), 'le parcours réduit ne consulte pas le fondu')
  assert.ok(code.includes('cropSeulApplique'), 'le parcours réduit n’a pas son propre état posé')
})
