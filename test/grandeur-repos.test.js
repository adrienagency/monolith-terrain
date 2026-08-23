// LA GRANDEUR DU REPOS — Tâche R1, tour 2, constat C2 de la relecture.
//
// ⛔ **CE FICHIER EXISTE PARCE QU'UNE MUTATION A SURVÉCU À 4 131 TESTS.**
// `distanceCadrageM()` qui rend `altitudeCadrageM()` annulait le correctif ① en
// entier — la veille du repos redevenait nourrie de l'altitude, l'orbite
// réveillait de nouveau la planète autour du crop — et **pas un test ne
// rougissait**, parce que le seul garde-fou était une expression régulière sur
// le texte de `main.js`.
//
// ══════════ CE QUE CE FICHIER GARDE ════════════════════════════════════════
//
//   ① LA LOI, PAR LE COMPORTEMENT — une orbite laisse la grandeur RIGOUREUSEMENT
//      immobile pendant que l'altitude s'effondre ; un zoom la fait bouger dans
//      le rapport EXACT du geste. ⚠️ **Aucune assertion ne compare deux littéraux
//      du fichier de test entre eux** : chaque attendu est calculé indépendamment
//      de ce qui est exercé.
//   ② LES ENTRÉES MOLLES — `null`, jamais `0` ni `NaN`.
//   ③ LE CORPS de `distanceCadrageM`, pas seulement sa signature. C'est
//      exactement par là que la mutation M9 est passée.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { grandeurRepos } from '../src/monde/grandeur-repos.js'
import { creerVeilleRepos, SEUIL_BOUGE_LOG } from '../src/monde/veille-repos.js'

const MAIN = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')

// La pose relevée à l'écran le 2026-08-23, drapeau levé, vue posée sur le crop
// (`.banc/R1/ecran-R1.json`). On rejoue de VRAIS gestes dessus.
const CIBLE = { x: 0, y: -1.5, z: 0 }
const CAMERA = { x: 88.49222477294595, y: 72.71928529343855, z: 88.49222477294593 }

// Une orbite : on tourne l'écart caméra↔cible autour de la cible, rayon tenu
// exactement constant. C'est ce que fait OrbitControls sur un cliquer-glisser.
function orbite({ camera, cible }, dTheta, dPhi) {
  const ox = camera.x - cible.x, oy = camera.y - cible.y, oz = camera.z - cible.z
  const r = Math.sqrt(ox * ox + oy * oy + oz * oz)
  const theta = Math.atan2(ox, oz) + dTheta
  const phi = Math.acos(Math.max(-1, Math.min(1, oy / r))) + dPhi
  const s = Math.sin(phi)
  return {
    x: cible.x + r * s * Math.sin(theta),
    y: cible.y + r * Math.cos(phi),
    z: cible.z + r * s * Math.cos(theta),
  }
}

// ══════════════════════════════════════════════════════════════════ ① la loi

test('① UNE ORBITE laisse la grandeur RIGOUREUSEMENT immobile — 40 poses', () => {
  // ⚠️ **C'EST LA MUTATION M9 QUI SE JOUE ICI.** Rendre l'altitude au lieu de la
  // distance fait exploser le premier relevé et laisse le second intact.
  const poses = []
  // ⚠️ **LE PAS EST CHOISI POUR QUE L'INCLINAISON MORDE SANS PASSER L'HORIZON** :
  // 39 × 0,011 rad amène la polaire de 1,036 à 1,465, donc la hauteur de 74,2 à
  // 15,4 unités — un facteur 4,8, et `y` reste positif (un `y` négatif ferait un
  // logarithme de nombre négatif dans le second relevé).
  for (let i = 0; i < 40; i++) poses.push(orbite({ camera: CAMERA, cible: CIBLE }, i * 0.011, i * 0.011))
  const g = poses.map((p) => grandeurRepos({ camera: p, cible: CIBLE }))
  const ecarts = []
  for (let i = 1; i < g.length; i++) ecarts.push(Math.abs(Math.log(g[i] / g[i - 1])))
  assert.ok(Math.max(...ecarts) < 1e-12, `l’orbite fait bouger la grandeur de ${Math.max(...ecarts)}`)
  assert.equal(ecarts.filter((e) => e > SEUIL_BOUGE_LOG).length, 0, 'une orbite pure a franchi le seuil')

  // ⚠️ **ET LA MÊME ORBITE FAIT S'EFFONDRER L'ALTITUDE.** Sans ce second volet,
  // une grandeur constamment nulle passerait le relevé ci-dessus : c'est la
  // moitié du test qui interdit le `return` muet.
  const ys = poses.map((p) => p.y - CIBLE.y)
  const ecartsY = []
  for (let i = 1; i < ys.length; i++) ecartsY.push(Math.abs(Math.log(ys[i] / ys[i - 1])))
  assert.ok(Math.max(...ecartsY) > SEUIL_BOUGE_LOG * 50,
    'la pose de test ne fait plus bouger l’altitude : le banc ne prouve plus rien')
  assert.ok(ys[0] / ys[ys.length - 1] > 3, `l’altitude n’a chuté que d’un facteur ${ys[0] / ys[ys.length - 1]}`)
})

test('① UN ZOOM fait bouger la grandeur dans le rapport EXACT du geste', () => {
  // une molette est une homothétie de l'écart caméra↔cible : la grandeur doit
  // suivre le facteur, au bit près.
  for (const k of [0.5, 0.9, 1.37, 2, 7]) {
    const p = {
      x: CIBLE.x + (CAMERA.x - CIBLE.x) * k,
      y: CIBLE.y + (CAMERA.y - CIBLE.y) * k,
      z: CIBLE.z + (CAMERA.z - CIBLE.z) * k,
    }
    const rapport = grandeurRepos({ camera: p, cible: CIBLE }) / grandeurRepos({ camera: CAMERA, cible: CIBLE })
    assert.ok(Math.abs(rapport - k) < 1e-12, `zoom ×${k} rendu comme ×${rapport}`)
  }
})

test('① UN PANORAMIQUE ne la fait pas bouger du tout', () => {
  // cible ET caméra translatées du même vecteur — ce que fait `OrbitControls.pan`
  const d0 = grandeurRepos({ camera: CAMERA, cible: CIBLE })
  for (let i = 1; i <= 20; i++) {
    const v = i * 0.6
    const d = grandeurRepos({
      camera: { x: CAMERA.x + v, y: CAMERA.y, z: CAMERA.z + v },
      cible: { x: CIBLE.x + v, y: CIBLE.y, z: CIBLE.z + v },
    })
    assert.equal(d, d0, `un panoramique de ${v} unités a bougé la grandeur`)
  }
})

test('① LA LOI PRISE PAR LES DEUX BOUTS — hauteur constante à distance variable, et l’inverse', () => {
  // ⚠️ **C'EST LE TEST QUE L'ÉTAPE 2 DU BRIEF DEMANDAIT**, posé cette fois sur la
  // fonction que la PRODUCTION appelle, et non sur une recopie dans le test.
  //
  // a) même hauteur de caméra, distances différentes → la grandeur DOIT séparer
  const a = grandeurRepos({ camera: { x: 10, y: 50, z: 0 }, cible: { x: 0, y: 0, z: 0 } })
  const b = grandeurRepos({ camera: { x: 90, y: 50, z: 0 }, cible: { x: 0, y: 0, z: 0 } })
  assert.ok(Math.abs(Math.log(b / a)) > SEUIL_BOUGE_LOG, 'la grandeur ignore un changement de distance')
  // b) même distance, hauteurs très différentes → la grandeur NE DOIT PAS bouger
  const r = 100
  const haut = { x: 0, y: r, z: 0 }
  const bas = { x: r * Math.cos(0.05), y: r * Math.sin(0.05), z: 0 }
  const c = grandeurRepos({ camera: haut, cible: { x: 0, y: 0, z: 0 } })
  const d = grandeurRepos({ camera: bas, cible: { x: 0, y: 0, z: 0 } })
  assert.ok(Math.abs(Math.log(d / c)) < 1e-12, 'la grandeur bouge à distance constante')
  // ⚠️ et les deux hauteurs sont bien très différentes — sinon (b) ne prouve rien
  assert.ok(haut.y / bas.y > 19, 'les deux poses ont presque la même hauteur : (b) ne prouve rien')
})

test('① BRANCHÉE À LA VEILLE : une orbite ne réveille pas, une molette réveille', () => {
  // ⚠️ **LE BOUT EN BOUT, SANS `main.js`** : la grandeur de la production nourrit
  // la veille de la production. C'est la consigne d'Adrien, jouée sous node.
  const veille = creerVeilleRepos()
  veille.maj(grandeurRepos({ camera: CAMERA, cible: CIBLE }))
  const basculesAvant = veille.bascules
  for (let i = 1; i <= 30; i++) {
    const p = orbite({ camera: CAMERA, cible: CIBLE }, i * 0.01, i * 0.01)
    veille.maj(grandeurRepos({ camera: p, cible: CIBLE }))
  }
  assert.equal(veille.auRepos, true, 'une orbite a réveillé la vue — le défaut d’Adrien')
  assert.equal(veille.bascules, basculesAvant, `l’orbite a fait ${veille.bascules - basculesAvant} bascules`)
  // une seule molette suffit à réveiller — l'hystérésis est asymétrique à dessein
  const zoom = {
    x: CIBLE.x + (CAMERA.x - CIBLE.x) * 1.01,
    y: CIBLE.y + (CAMERA.y - CIBLE.y) * 1.01,
    z: CIBLE.z + (CAMERA.z - CIBLE.z) * 1.01,
  }
  veille.maj(grandeurRepos({ camera: zoom, cible: CIBLE }))
  assert.equal(veille.auRepos, false, 'un dézoom n’a pas réveillé la vue')
})

// ═════════════════════════════════════════════════════════ ② entrées molles

test('② une entrée manquante ou non finie rend `null`, jamais `0` ni `NaN`', () => {
  // `0` ferait `ln(0) = −Infinity`, donc un écart infini, donc un mouvement
  // PERMANENT : l'exact contraire de ce que la panne doit produire.
  for (const e of [undefined, {}, { camera: CAMERA }, { cible: CIBLE }, { camera: null, cible: CIBLE }]) {
    assert.equal(grandeurRepos(e), null)
  }
  assert.equal(grandeurRepos({ camera: { x: NaN, y: 0, z: 0 }, cible: CIBLE }), null)
  assert.equal(grandeurRepos({ camera: { x: Infinity, y: 0, z: 0 }, cible: CIBLE }), null)
  // et la veille CONSERVE son état sur ce `null` — le crop reste seul
  const veille = creerVeilleRepos()
  veille.maj(145.5)
  for (let i = 0; i < 50; i++) veille.maj(grandeurRepos({}))
  assert.equal(veille.auRepos, true)
  assert.equal(veille.bascules, 0)
})

// ═══════════════════════════════════════ ③ le CORPS de `distanceCadrageM`

test('③ `distanceCadrageM` DÉLÈGUE à la loi — c’est par là que M9 est passée', () => {
  // ⚠️ **L'ASSERTION LIT LE CORPS, PAS LA SIGNATURE.** La garde d'origine
  // vérifiait que `function distanceCadrageM()` existait et que
  // `veilleCrop.maj(alt, dist)` était écrit — jamais ce que la fonction REND.
  // Le corps était libre, et `return altitudeCadrageM()` y passait sans un seul
  // test rouge, en annulant le correctif ① en entier.
  const i = MAIN.indexOf('function distanceCadrageM()')
  assert.ok(i > 0, '`distanceCadrageM` a disparu ou changé de nom')
  const corps = MAIN.slice(i, MAIN.indexOf('\n}', i))
  assert.ok(/return grandeurRepos\(\{ camera: camera\.position, cible: controls\.target \}\)/.test(corps),
    `le corps ne délègue plus à la loi : ${corps}`)
  // ⛔ **ET IL NE LIT AUCUNE ALTITUDE.** C'est la mutation M9, mot pour mot.
  assert.ok(!/altitude/i.test(corps), `le corps de \`distanceCadrageM\` lit une altitude : ${corps}`)
  assert.ok(/import \{ grandeurRepos \} from '\.\/monde\/grandeur-repos\.js'/.test(MAIN),
    'la loi n’est pas importée')
})
