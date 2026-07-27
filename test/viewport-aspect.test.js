import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { PerspectiveCamera, Vector3 } from 'three'
import { isRenderableSize, safeAspect } from '../src/viewport.js'

const ROOT = path.join(import.meta.dirname, '..')

// ---------------------------------------------------------------------------
// LE MÉCANISME — pourquoi un aspect NaN ne fait aucun bruit
// ---------------------------------------------------------------------------
// Ces deux premiers tests ne vérifient pas notre code : ils épinglent le
// comportement de three qui rend le bug si difficile à voir. Si un jour three
// se met à lever une exception sur un aspect NaN, ils casseront — et ce sera
// une bonne nouvelle à connaître.

test('un aspect NaN empoisonne uniquement le x de la projection — y et z restent justes', () => {
  const cam = new PerspectiveCamera(50, 0 / 0, 0.1, 1000) // conteneur 0×0
  cam.updateProjectionMatrix()
  cam.updateMatrixWorld()
  const p = new Vector3(1, 2, -10).project(cam)
  assert.ok(Number.isNaN(p.x), 'x doit être NaN : seul l’élément [0] dépend de l’aspect')
  assert.ok(Number.isFinite(p.y) && Number.isFinite(p.z), 'y et z restent valides — d’où le silence')
})

test('un aspect NaN ne se répare pas tout seul : il faut un redimensionnement valide', () => {
  const cam = new PerspectiveCamera(50, 0 / 0, 0.1, 1000)
  cam.updateProjectionMatrix()
  cam.updateMatrixWorld()
  // autant d’updateProjectionMatrix que l’on veut : la valeur pourrie est dans
  // camera.aspect, pas dans la matrice, donc elle est recopiée à l’identique
  cam.updateProjectionMatrix()
  assert.ok(Number.isNaN(new Vector3(1, 2, -10).project(cam).x))
  cam.aspect = 1280 / 720
  cam.updateProjectionMatrix()
  assert.ok(Number.isFinite(new Vector3(1, 2, -10).project(cam).x))
})

// ---------------------------------------------------------------------------
// LES DEUX GARDE-FOUS
// ---------------------------------------------------------------------------

test('isRenderableSize rejette 0, les négatifs et le non-numérique', () => {
  assert.equal(isRenderableSize(1280, 720), true)
  assert.equal(isRenderableSize(2, 2), true)
  assert.equal(isRenderableSize(0, 0), false)
  assert.equal(isRenderableSize(1280, 0), false)
  assert.equal(isRenderableSize(0, 720), false)
  assert.equal(isRenderableSize(-4, 720), false)
  assert.equal(isRenderableSize(0 / 0, 720), false)
  assert.equal(isRenderableSize(1280, undefined), false)
  assert.equal(isRenderableSize(1 / 0, 720), false)
})

test('safeAspect reste fini quoi qu’on lui donne', () => {
  assert.equal(safeAspect(1280, 720), 1280 / 720)
  assert.equal(safeAspect(0, 0), 1)
  assert.equal(safeAspect(1920, 0), 1920)
  assert.equal(safeAspect(0, 1080), 1 / 1080)
  for (const [w, h] of [[-8, 4], [0 / 0, 720], [undefined, null], [1280, 0 / 0]]) {
    assert.ok(Number.isFinite(safeAspect(w, h)), `safeAspect(${w}, ${h}) doit être fini`)
  }
})

// Le scénario réel du 27/07/2026 : une frame à 0×0 (panneau masqué) puis retour
// à 1280×720. Sans le garde-fou, la première passe pose un NaN que la seconde
// ne suffit pas à faire oublier partout ailleurs dans la frame ; avec, l’aspect
// n’est jamais autre chose qu’un nombre.
test('une frame à 0×0 suivie d’un retour à 1280×720 ne laisse jamais l’aspect non fini', () => {
  const cam = new PerspectiveCamera(50, 1024 / 768, 0.1, 1000)
  const onResize = ([w, h]) => {
    if (!isRenderableSize(w, h)) return
    cam.aspect = w / h
    cam.updateProjectionMatrix()
  }
  onResize([0, 0])
  assert.equal(cam.aspect, 1024 / 768, 'le dernier aspect connu doit survivre au 0×0')
  onResize([1280, 720])
  assert.equal(cam.aspect, 1280 / 720)
})

// ---------------------------------------------------------------------------
// LES DEUX APPELANTS, VERROUILLÉS DANS LA SOURCE
// ---------------------------------------------------------------------------
// main.js n’est pas importable en test (monolithe qui touche au DOM et à WebGL)
// et applySize n’est pas exporté par export.js : on relit donc la source. Ces
// tests cassent le jour où quelqu’un réécrit `camera.aspect = rw / rh` sans
// garde-fou — c’est exactement ce qu’on veut savoir, parce que rien d’autre,
// ni test ni console, ne le signalerait.

test('main.js : le resize teste la taille AVANT d’écrire camera.aspect', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/main.js'), 'utf8')
  const at = src.indexOf("window.addEventListener('resize'")
  assert.ok(at > 0, 'gestionnaire de redimensionnement introuvable dans main.js')
  const body = src.slice(at, at + 1200)
  const garde = body.indexOf('isRenderableSize')
  const ecriture = body.indexOf('camera.aspect =')
  assert.ok(garde > 0, 'le resize doit filtrer la taille par isRenderableSize (voir viewport.js)')
  assert.ok(ecriture > 0 && garde < ecriture, 'le filtre doit précéder l’écriture de camera.aspect')
})

test('export.js : applySize borne l’aspect au lieu de diviser la taille brute', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/export.js'), 'utf8')
  assert.match(src, /camera\.aspect = safeAspect\(width, height\)/)
  assert.doesNotMatch(src, /camera\.aspect = width \/ height/)
})
