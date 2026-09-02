// LA CADENCE AU REPOS — PF4, bug n° 2. Voir src/cadence-repos.js.
//
//   ① la loi : en orbite, au repos depuis plus de DELAI_REPOS_MS, une image
//      sur DIVISEUR est dessinée ; tout le reste dessine à pleine cadence
//   ② chaque interrupteur rend la pleine cadence : geste, vol, occupation,
//      enregistrement, surface
//   ③ le branchement de `main.js`, sur le texte : le saut est APRÈS toute la
//      logique de l'image et AVANT `composer.render`, et il ne s'applique pas
//      pendant un enregistrement

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dessinerCetteImage, DELAI_REPOS_MS, DIVISEUR } from '../src/cadence-repos.js'

const repos = { mode: 'orbital', occupe: false, vol: false, tenu: false, msDepuisGeste: DELAI_REPOS_MS + 1, enregistrement: false, animations: true }

test('① au repos en orbite : une image sur DIVISEUR, et le compte est exact sur 600 images', () => {
  let dessinees = 0
  for (let i = 0; i < 600; i++) if (dessinerCetteImage({ ...repos, compteur: i })) dessinees++
  assert.equal(dessinees, 600 / DIVISEUR)
  assert.equal(DIVISEUR, 2, 'le diviseur est 2 : 60 → 30 i/s, 0,067° de rotation entre deux dessins')
  // la première image du repos est dessinée (compteur 0) : pas de trou au passage
  assert.equal(dessinerCetteImage({ ...repos, compteur: 0 }), true)
  assert.equal(dessinerCetteImage({ ...repos, compteur: 1 }), false)
})

test('② chaque interrupteur rend la pleine cadence — sur l’image impaire, qui serait sautée', () => {
  const impaire = { ...repos, compteur: 1 }
  assert.equal(dessinerCetteImage(impaire), false, 'témoin : au repos, l’image impaire est sautée')
  assert.equal(dessinerCetteImage({ ...impaire, mode: 'surface' }), true, 'en surface la mer et les nuages bougent : jamais de saut')
  assert.equal(dessinerCetteImage({ ...impaire, occupe: true }), true, 'plongée en cours')
  assert.equal(dessinerCetteImage({ ...impaire, vol: true }), true, 'vol de caméra')
  assert.equal(dessinerCetteImage({ ...impaire, tenu: true }), true, 'souris qui tient la caméra')
  assert.equal(dessinerCetteImage({ ...impaire, enregistrement: true }), true, 'export vidéo : chaque image compte')
  assert.equal(dessinerCetteImage({ ...impaire, msDepuisGeste: DELAI_REPOS_MS }), true, 'à la limite exacte : encore un geste récent')
  assert.equal(dessinerCetteImage({ ...impaire, msDepuisGeste: 0 }), true)
  assert.equal(dessinerCetteImage({ ...impaire, msDepuisGeste: NaN }), true, 'un délai non mesurable ne saute rien')
  // animations coupées : la planète est figée, on saute quand même une image sur deux, pas plus
  assert.equal(dessinerCetteImage({ ...impaire, animations: false }), false)
  assert.equal(dessinerCetteImage({ ...repos, animations: false, compteur: 2 }), true)
  // sans argument : pleine cadence (surface par défaut)
  assert.equal(dessinerCetteImage(), true)
  // diviseur 1 (l'échappatoire `?cadence=pleine`) : chaque image, comme avant
  assert.equal(dessinerCetteImage({ ...impaire, diviseur: 1 }), true)
  assert.equal(dessinerCetteImage({ ...impaire, diviseur: undefined }), false, 'undefined = le diviseur par défaut')
})

test('③ main.js : le saut de dessin est posé après la logique de l’image, avant composer.render, hors enregistrement', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
  const tick = main.slice(main.indexOf('function tick()'))
  const saut = tick.indexOf('dessinerCetteImage(')
  assert.ok(saut > 0, 'tick() n’appelle pas dessinerCetteImage')
  const rendu = tick.indexOf('composer.render(dtAmb)')
  const gouverneur = tick.indexOf('aq.update(dtBrut)')
  const prets = tick.indexOf('if (!programmesPrets) return')
  assert.ok(prets < saut && saut < gouverneur && gouverneur < rendu, 'ordre attendu : programmesPrets → saut de cadence → aq.update → composer.render')
  // le saut lit l'enregistrement : une capture vidéo ne doit jamais perdre une image
  assert.match(tick.slice(saut, saut + 400), /enregistrement:\s*!!recorder\?\.recording/)
  // le délai est CELUI de la rotation propre : même horloge, même seuil
  assert.match(tick.slice(saut, saut + 400), /msDepuisGeste:\s*performance\.now\(\)\s*-\s*Math\.max\(lastUserInput,\s*dernierPointeur\)/)
  // l'échappatoire de mesure : `?cadence=pleine` rend le diviseur 1
  assert.match(main, /get\('cadence'\)\s*===\s*'pleine'/)
  assert.match(tick.slice(saut, saut + 500), /diviseur:\s*cadencePleine\s*\?\s*1\s*:\s*undefined/)
})
