import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { PerspectiveCamera, Vector3 } from 'three'
import { isRenderableSize, safeAspect, frameSize, applyRenderSize } from '../src/viewport.js'

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

// ---------------------------------------------------------------------------
// LE CADRE — pourquoi la window n'est jamais la taille de rendu
// ---------------------------------------------------------------------------
// Signalé le 28/07/2026 sur un vieux portable Windows : « le visuel bug sur la
// taille d'écran, se déforme, zoom à fond ». Ce n'était pas la lenteur, c'était
// sa CONSÉQUENCE. Le canevas ne remplit la fenêtre que dans le mode plein
// écran : en boutique, en Race Studio et en Studio, `#app` est un cadre réduit
// (voir store.css / studio.css / atelier.css — 42vw pris par la colonne), avec
// `overflow: hidden` et un canevas centré en `translate(-50%, -50%)`.
//
// Le resize de main.js le sait et mesure le CONTENEUR. Deux autres endroits ne
// le savaient pas et redimensionnaient sur `window.innerWidth/innerHeight` :
// le gouverneur de performance (perf.js, à chaque changement de palier) et le
// curseur « Échelle de rendu » (camera-panel.js). Or `composer.setSize()`
// rappelle `renderer.setSize(w, h)` avec updateStyle par défaut à true — il
// RÉÉCRIT donc la taille CSS du canevas.
//
// Mesuré (cadre Studio dans une fenêtre 1366×768, dpr 1) :
//   avant  canevas 762×768 CSS,  camera.aspect 0.9922, aspect canevas 0.9922
//   après UN palier de gouverneur :
//          canevas 1366×768 CSS, camera.aspect 0.9922, aspect canevas 1.7786
// soit 79 % d'écart : l'image est écrasée ET, le canevas débordant d'un cadre
// qui le rogne, on n'en voit plus que le milieu — « zoom à fond ».
//
// LE PIÈGE EST QU'IL NE SE DÉCLENCHE QUE SUR UNE MACHINE LENTE : le gouverneur
// ne bouge que sous les 30 fps. Sur un poste rapide, tout va bien, pour
// toujours. D'où la nécessité de le verrouiller par un test.

test('frameSize : le conteneur fait foi, la window n’est qu’un filet', () => {
  // cadre Studio de 762×768 dans une fenêtre de 1366×768 : c'est 762 qui gagne
  assert.deepEqual(frameSize(762, 768, 1366, 768), [762, 768])
  // plein écran : les deux disent la même chose
  assert.deepEqual(frameSize(1366, 768, 1366, 768), [1366, 768])
  // box du conteneur pas encore posée (0) → on se rabat sur la fenêtre
  assert.deepEqual(frameSize(0, 0, 1366, 768), [1366, 768])
  assert.deepEqual(frameSize(undefined, undefined, 1280, 720), [1280, 720])
})

test('frameSize : arrondi à l’entier PAIR inférieur — les demi-résolutions fractionnaires sont le carré noir', () => {
  assert.deepEqual(frameSize(1093, 615, 1366, 768), [1092, 614])
  assert.deepEqual(frameSize(911, 513, 1366, 768), [910, 512])
  // sous-pixel d'un zoom de page Chrome (1920 / 1,1 = 1745,45)
  assert.deepEqual(frameSize(1745.45, 981.8, 1920, 1080), [1744, 980])
})

test('frameSize : rien de non fini n’en sort, et 1 px donne bien 0', () => {
  for (const args of [[1, 1, 0, 0], [0, 0, 0, 0], [-4, 8, 0, 0], [0 / 0, 0 / 0, 0 / 0, 0 / 0], [1 / 0, 1 / 0, 0, 0]]) {
    const [w, h] = frameSize(...args)
    assert.ok(Number.isFinite(w) && Number.isFinite(h), `frameSize(${args}) doit rester fini`)
    assert.ok(w >= 0 && h >= 0)
  }
  assert.deepEqual(frameSize(1, 1, 0, 0), [0, 0]) // 1 px arrondi au pair inférieur = 0
})

// Un faux trio renderer/composer/caméra : applyRenderSize ne touche au DOM que
// par `renderer.domElement.parentElement`, donc il se teste sans navigateur.
const faux = (cw, ch) => {
  const vus = { renderer: null, composer: null }
  return {
    vus,
    renderer: {
      domElement: { parentElement: { clientWidth: cw, clientHeight: ch } },
      setSize: (w, h) => { vus.renderer = [w, h] },
    },
    composer: { setSize: (w, h) => { vus.composer = [w, h] } },
    camera: { aspect: 4 / 3, updateProjectionMatrix() { this.maj = (this.maj || 0) + 1 } },
  }
}

test('applyRenderSize : le canevas, le compositeur et la caméra sortent du MÊME couple de nombres', () => {
  const f = faux(762, 768)
  const taille = applyRenderSize(f)
  assert.deepEqual(taille, [762, 768])
  assert.deepEqual(f.vus.renderer, [762, 768])
  assert.deepEqual(f.vus.composer, [762, 768])
  assert.equal(f.camera.aspect, 762 / 768)
  assert.equal(f.camera.maj, 1, 'updateProjectionMatrix doit avoir été appelé')
})

test('applyRenderSize : le cas exact du vieux portable — le cadre du Studio, pas la fenêtre', () => {
  // ce que faisait perf.js : composer.setSize(1366, 768) alors que le cadre
  // ne fait que 762 de large. On vérifie que plus personne n'a 1366 en main.
  const f = faux(762, 768)
  applyRenderSize(f)
  assert.notDeepEqual(f.vus.composer, [1366, 768])
  const aspectCanevas = f.vus.renderer[0] / f.vus.renderer[1]
  assert.ok(Math.abs(aspectCanevas - f.camera.aspect) < 1e-9,
    `l’aspect du canevas (${aspectCanevas}) doit coller à celui de la caméra (${f.camera.aspect})`)
})

test('applyRenderSize : conteneur à 0×0 — on ne touche à RIEN, pas même à l’aspect', () => {
  const f = faux(0, 0)
  assert.equal(applyRenderSize(f), null)
  assert.equal(f.vus.renderer, null)
  assert.equal(f.vus.composer, null)
  assert.equal(f.camera.aspect, 4 / 3, 'le dernier aspect connu survit — voir le garde-fou du 27/07/2026')
})

test('applyRenderSize : la caméra est facultative (perf.js ne l’a pas), le reste marche quand même', () => {
  const f = faux(910, 512)
  assert.deepEqual(applyRenderSize({ renderer: f.renderer, composer: f.composer }), [910, 512])
  assert.deepEqual(f.vus.renderer, [910, 512])
  assert.deepEqual(f.vus.composer, [910, 512])
})

// ---------------------------------------------------------------------------
// LES DEUX COUPABLES, VERROUILLÉS DANS LA SOURCE
// ---------------------------------------------------------------------------
// Ces deux tests sont le cœur de la correction : la régression est invisible
// sur une machine rapide, donc seule la source peut la dénoncer.

for (const fichier of ['src/perf.js', 'src/ui/camera-panel.js']) {
  test(`${fichier} : ne redimensionne plus jamais sur window.innerWidth/innerHeight`, () => {
    const src = fs.readFileSync(path.join(ROOT, fichier), 'utf8')
    assert.doesNotMatch(src, /setSize\(\s*window\.inner/,
      'la window n’est pas le cadre du canevas — passer par applyRenderSize (viewport.js)')
    assert.match(src, /applyRenderSize/, 'la taille de rendu doit venir de viewport.js')
  })
}
