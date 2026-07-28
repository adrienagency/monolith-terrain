import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { PerspectiveCamera, Vector3 } from 'three'
import {
  isRenderableSize, safeAspect, frameSize, applyRenderSize,
  screenPixelRatio, glSizeLimit, fitDrawingBuffer, MAX_PIXEL_RATIO,
  densiteSousPlafond, PLAFOND_MPX,
} from '../src/viewport.js'

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

// Le resize écrivait `camera.aspect` lui-même, derrière un isRenderableSize.
// Il ne l'écrit plus DU TOUT : applyRenderSize porte le garde-fou (et depuis
// le 28/07/2026 le plafond matériel), le resize n'a plus qu'à le laisser
// renoncer. Ce test garde donc l'intention d'origine par l'autre bout : plus
// personne ne pose l'aspect à la main dans ce gestionnaire.
test('main.js : le resize n’écrit plus camera.aspect lui-même', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/main.js'), 'utf8')
  const at = src.indexOf("window.addEventListener('resize'")
  assert.ok(at > 0, 'gestionnaire de redimensionnement introuvable dans main.js')
  const body = src.slice(at, at + 1600)
  assert.doesNotMatch(body, /camera\.aspect\s*=/,
    'l’aspect se pose dans applyRenderSize, une seule fois, avec son garde-fou (voir viewport.js)')
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

// ---------------------------------------------------------------------------
// LE PLAFOND MATÉRIEL — le rabotage muet de Chrome
// ---------------------------------------------------------------------------
// Signalé le 28/07/2026, même vieux portable : « zoom à fond », image déformée.
// Quand le tampon de dessin demandé dépasse ce que la carte accepte, Chrome ne
// lève RIEN — ni exception, ni avertissement — et rabote DIMENSION PAR
// DIMENSION, pas proportionnellement. Mesuré : 16384×800 demandés donnent
// 8192×800 (aspect 20,5 → 10,2) ; 24576×8192 donnent 5760×5760 (aspect 3 → 1).
// La caméra, elle, garde l'aspect du conteneur : l'image est écrasée.
//
// Le déclencheur était `pixelRatio: 2` EN DUR : sur une machine dont
// MAX_TEXTURE_SIZE vaut 2048 ou 4096 (circuit graphique intégré ancien), un
// écran large ×2 franchit la limite. D'où ces tests : le calcul « taille
// demandée + limite matérielle → taille retenue » est pur, donc c'est lui qui
// porte la couverture.

test('screenPixelRatio : la densité RÉELLE de l’écran, bornée — dans les deux sens', () => {
  assert.equal(screenPixelRatio(1), 1)
  assert.equal(screenPixelRatio(2), 2)
  // Windows à 125 % : on rendait 2 (60 % de pixels payés pour rien)
  assert.equal(screenPixelRatio(1.25), 1.25)
  // écran à 250 % : on rendait 2, donc PLUS FLOU que ce que l’écran demande
  // tout en payant plein pot. Le plafond reste 2 — au-delà le gain est nul et
  // le coût quadratique — mais la lecture corrige le sens « trop peu ».
  assert.equal(screenPixelRatio(2.5), MAX_PIXEL_RATIO)
  assert.equal(screenPixelRatio(3), 2)
  // rien de non numérique ne doit sortir d’ici : 1 est le repli sûr
  for (const v of [undefined, null, 0, -1, 0 / 0, 'deux']) assert.equal(screenPixelRatio(v), 1, `screenPixelRatio(${v})`)
  assert.equal(screenPixelRatio(1 / 0), MAX_PIXEL_RATIO)
  assert.equal(screenPixelRatio(3, 1), 1, 'le plafond est paramétrable (export offline)')
})

test('glSizeLimit : on retient la contrainte la PLUS BASSE des deux', () => {
  const gl = (tex, rb) => ({
    MAX_TEXTURE_SIZE: 0x0d33,
    MAX_RENDERBUFFER_SIZE: 0x84e8,
    getParameter: (c) => (c === 0x0d33 ? tex : rb),
  })
  assert.equal(glSizeLimit(gl(16384, 16384)), 16384)
  // une cible du compositeur est un renderbuffer : si LUI est plus bas, c’est
  // lui qui décide, même quand les textures montent plus haut
  assert.equal(glSizeLimit(gl(8192, 4096)), 4096)
  assert.equal(glSizeLimit(gl(2048, 16384)), 2048)
  // pas de contexte / valeurs absurdes : 0 = « aucune limite connue », et
  // fitDrawingBuffer ne rabote alors rien du tout (ne jamais brider à l’aveugle)
  assert.equal(glSizeLimit(null), 0)
  assert.equal(glSizeLimit({}), 0)
  assert.equal(glSizeLimit(gl(0, 0)), 0)
  assert.equal(glSizeLimit(gl(0 / 0, undefined)), 0)
})

test('fitDrawingBuffer : sous la limite, on ne touche à RIEN', () => {
  const f = fitDrawingBuffer(1366, 768, 2, 16384)
  assert.equal(f.clamped, false)
  assert.equal(f.ratio, 2)
  assert.deepEqual([f.width, f.height], [2732, 1536])
})

test('fitDrawingBuffer : UNE SEULE dimension qui dépasse — le cas exact qui déforme', () => {
  // 8192×400 CSS à la densité 2 = 16384×800 demandés. Chrome rend 8192×800 :
  // l’aspect passe de 20,48 à 10,24, l’image est écrasée d’un facteur deux.
  const limite = 8192
  const f = fitDrawingBuffer(8192, 400, 2, limite)
  assert.equal(f.clamped, true)
  assert.ok(Math.max(f.width, f.height) <= limite, `${f.width}×${f.height} doit tenir sous ${limite}`)
  // LES DEUX côtés ont reculé du même facteur : c’est toute la correction
  assert.deepEqual([f.width, f.height], [8192, 400])
  const attendu = 8192 / 400
  assert.ok(Math.abs(f.width / f.height - attendu) / attendu < 0.002,
    `aspect retenu ${f.width / f.height} au lieu de ${attendu}`)
})

test('fitDrawingBuffer : le second cas mesuré — 24576×8192 raboté en carré par Chrome', () => {
  // 12288×4096 CSS à la densité 2. Chrome renvoyait 5760×5760 : aspect 3 → 1.
  const f = fitDrawingBuffer(12288, 4096, 2, 5760)
  assert.equal(f.clamped, true)
  assert.deepEqual([f.width, f.height], [5760, 1920])
  assert.equal(f.width / f.height, 3, 'l’aspect 3:1 doit survivre au rabotage')
})

test('fitDrawingBuffer : le vieux portable — 1366×768 à la densité 2 sur une carte à 2048', () => {
  const f = fitDrawingBuffer(1366, 768, 2, 2048)
  assert.equal(f.clamped, true)
  assert.ok(f.ratio < 2 && f.ratio > 1, `densité retenue ${f.ratio}`)
  assert.ok(Math.max(f.width, f.height) <= 2048)
  const attendu = 1366 / 768
  assert.ok(Math.abs(f.width / f.height - attendu) / attendu < 0.002,
    `l’aspect doit tenir : ${f.width / f.height} contre ${attendu}`)
  // 2042×1148, et pas 2048×1151 : quelques pixels rendus pour que les DEUX
  // côtés soient pairs. Mesuré en direct le 28/07/2026 — à 1151, l'AO en
  // demi-résolution repart en 575,5 et on rachète le carré noir. Le prix est
  // de 0,006 % d'aspect et de trois pixels de finesse.
  assert.deepEqual([f.width, f.height], [2042, 1148])
  assert.equal(1148 / 2, 574, 'la demi-résolution doit être un ENTIER')
})

test('fitDrawingBuffer : un tampon raboté a TOUJOURS deux côtés pairs (demi-résolutions entières)', () => {
  // le compositeur taille ses cibles sur le TAMPON, pas sur le CSS : une
  // densité fractionnaire redonne un tampon impair, donc des demi-résolutions
  // en .5 — le carré noir. Voir densitePaire dans viewport.js.
  for (const [w, h, r, lim] of [
    [1366, 768, 2, 2048], [1920, 1080, 2, 2048], [2560, 1080, 1.5, 1024],
    [1366, 768, 1.5, 1024], [3840, 2160, 2, 4096], [1600, 900, 2, 2048],
  ]) {
    const f = fitDrawingBuffer(w, h, r, lim)
    assert.equal(f.clamped, true, `${w}×${h}@${r}/${lim} devrait être raboté`)
    assert.equal(f.width % 2, 0, `largeur impaire : ${f.width}×${f.height}`)
    assert.equal(f.height % 2, 0, `hauteur impaire : ${f.width}×${f.height}`)
  }
})

test('fitDrawingBuffer : la taille CSS seule peut déjà dépasser — la densité passe sous 1', () => {
  // écran 4K dans un cadre plein, carte à 2048 : même à la densité 1 ça ne tient
  // pas. Mieux vaut une image moins fine qu’une image écrasée.
  const f = fitDrawingBuffer(3840, 2160, 1, 2048)
  assert.ok(f.ratio < 1, `densité retenue ${f.ratio}`)
  assert.deepEqual([f.width, f.height], [2048, 1152])
  assert.ok(Math.abs(f.width / f.height - 3840 / 2160) < 0.002)
})

test('fitDrawingBuffer : sans limite connue, aucun rabotage (ne jamais brider à l’aveugle)', () => {
  for (const limite of [0, -1, undefined, null, 0 / 0, 1 / 0]) {
    const f = fitDrawingBuffer(4096, 4096, 2, limite)
    assert.equal(f.clamped, false, `limite=${limite}`)
    assert.equal(f.ratio, 2)
  }
})

test('fitDrawingBuffer : une densité absurde retombe sur 1, jamais sur NaN', () => {
  for (const r of [0, -2, 0 / 0, undefined, null, 1 / 0]) {
    const f = fitDrawingBuffer(1280, 720, r, 16384)
    assert.ok(Number.isFinite(f.ratio) && f.ratio > 0, `ratio=${r} → ${f.ratio}`)
    assert.ok(Number.isFinite(f.width) && Number.isFinite(f.height))
  }
})

test('fitDrawingBuffer : pile SUR la limite, on ne rabote pas (pas de perte gratuite)', () => {
  const f = fitDrawingBuffer(1024, 512, 2, 2048)
  assert.equal(f.clamped, false)
  assert.equal(f.ratio, 2)
  assert.deepEqual([f.width, f.height], [2048, 1024])
})

test('fitDrawingBuffer : balayage — jamais au-dessus de la limite, et l’aspect tient toujours', () => {
  const limites = [1024, 2048, 4096, 8192, 16384]
  const tailles = [[320, 240], [1366, 768], [1920, 1080], [2560, 1080], [3840, 2160], [7680, 800], [800, 7680]]
  for (const limite of limites) {
    for (const [w, h] of tailles) {
      for (const r of [0.5, 0.85, 1, 1.25, 1.5, 2]) {
        const f = fitDrawingBuffer(w, h, r, limite)
        assert.ok(Math.max(f.width, f.height) <= limite,
          `${w}×${h}@${r} sur ${limite} → ${f.width}×${f.height} dépasse`)
        assert.ok(f.width >= 1 && f.height >= 1, `${w}×${h}@${r} sur ${limite} → tampon vide`)
        if (f.clamped) {
          assert.equal((f.width | f.height) % 2, 0,
            `${w}×${h}@${r} sur ${limite} → ${f.width}×${f.height} : côté impair = demi-résolution en .5`)
        }
        const attendu = w / h
        const ecart = Math.abs(f.width / f.height - attendu) / attendu
        // un pixel de rognage sur le petit côté, pas un facteur deux
        assert.ok(ecart < 0.01, `${w}×${h}@${r} sur ${limite} : aspect ${f.width / f.height} contre ${attendu}`)
      }
    }
  }
})

// --- applyRenderSize, maintenant qu'il porte le plafond -------------------

// Le même faux trio, plus le contexte WebGL et la densité. `limite` à 0 = la
// carte ne dit rien (comme les tests d'origine ci-dessus, qui n'ont donc pas
// bougé d'une ligne).
const fauxGl = (cw, ch, limite = 0) => {
  const vus = { renderer: null, composer: null, ratio: null }
  return {
    vus,
    renderer: {
      domElement: { parentElement: { clientWidth: cw, clientHeight: ch } },
      setSize: (w, h) => { vus.renderer = [w, h] },
      setPixelRatio: (r) => { vus.ratio = r },
      getPixelRatio: () => vus.ratio ?? 1,
      getContext: () => ({
        MAX_TEXTURE_SIZE: 0x0d33,
        MAX_RENDERBUFFER_SIZE: 0x84e8,
        getParameter: () => limite,
      }),
    },
    composer: { setSize: (w, h) => { vus.composer = [w, h] } },
    camera: { aspect: 4 / 3, updateProjectionMatrix() { this.maj = (this.maj || 0) + 1 } },
  }
}

// capture de console.warn le temps d'un appel
const avecWarn = (fn) => {
  const vrai = console.warn
  const dits = []
  console.warn = (...a) => dits.push(a.join(' '))
  try { fn() } finally { console.warn = vrai }
  return dits
}

test('applyRenderSize : machine normale — rien ne change, et rien ne s’affiche en console', () => {
  // ⚠️ le cadre est délibérément PETIT (1120×630 × densité 2 = 2,82 Mpx) : il
  // doit tenir sous la barre haute de 2K, sinon ce test ne mesurerait plus le
  // rabotage matériel mais le plafond de pixels — deux garde-fous distincts.
  const f = fauxGl(1120, 630, 16384)
  const dits = avecWarn(() => assert.deepEqual(applyRenderSize({ ...f, pixelRatio: 2 }), [1120, 630]))
  assert.deepEqual(f.vus.renderer, [1120, 630], 'la taille CSS ne bouge pas d’un pixel')
  assert.deepEqual(f.vus.composer, [1120, 630])
  assert.equal(f.vus.ratio, 2, 'la densité demandée est servie telle quelle')
  assert.equal(dits.length, 0, 'aucun avertissement sur une machine capable')
})

// ⚠️ chaque test ci-dessous prend une taille de cadre DIFFÉRENTE, et ce n'est
// pas cosmétique : l'avertissement est mémorisé (une console noyée ne se lit
// pas), donc deux tests sur le même couple taille/densité ne verraient qu'un
// seul message — le second passerait pour muet.
test('applyRenderSize : carte à 2048 — la densité recule, l’aspect NE BOUGE PAS', () => {
  const f = fauxGl(1600, 900, 2048)
  avecWarn(() => applyRenderSize({ ...f, pixelRatio: 2 }))
  assert.deepEqual(f.vus.renderer, [1600, 900], 'la taille CSS reste celle du cadre')
  assert.equal(f.camera.aspect, 1600 / 900, 'la caméra suit le CADRE, jamais le tampon raboté')
  assert.ok(f.vus.ratio < 2, `la densité doit avoir reculé (${f.vus.ratio})`)
  const buf = [Math.floor(1600 * f.vus.ratio), Math.floor(900 * f.vus.ratio)]
  assert.ok(Math.max(...buf) <= 2048, `tampon ${buf} au-dessus de 2048`)
  assert.ok(Math.abs(buf[0] / buf[1] - f.camera.aspect) / f.camera.aspect < 0.002,
    `aspect du tampon ${buf[0] / buf[1]} contre caméra ${f.camera.aspect}`)
})

test('applyRenderSize : le rabotage se DIT, avec les chiffres — le silence est le vrai défaut', () => {
  const f = fauxGl(1366, 768, 2048)
  const dits = avecWarn(() => applyRenderSize({ ...f, pixelRatio: 2 }))
  assert.equal(dits.length, 1, 'un avertissement, et un seul')
  const txt = dits[0]
  // Le tampon DEMANDÉ à la carte, c'est celui d'après la barre haute de 2K :
  // sur ce cadre elle a déjà ramené la densité de 2 à ~1,87, et c'est bien ce
  // chiffre-là que le pilote a refusé. On le recalcule plutôt que de le figer,
  // pour que le test dise la règle et pas une valeur magique.
  const large = Math.floor(1366 * densiteSousPlafond(1366, 768, 2))
  for (const n of [String(large), '2048', '1366']) {
    assert.ok(txt.includes(n), `l’avertissement doit porter ${n} : « ${txt} »`)
  }
})

test('applyRenderSize : on n’inonde pas la console — même situation, un seul message', () => {
  const f = fauxGl(1280, 720, 2048)
  const dits = avecWarn(() => {
    applyRenderSize({ ...f, pixelRatio: 2 })
    applyRenderSize({ ...f, pixelRatio: 2 })
    applyRenderSize({ ...f, pixelRatio: 2 })
  })
  assert.equal(dits.length, 1)
})

test('applyRenderSize : sans densité passée, on relit celle du renderer', () => {
  const f = fauxGl(910, 512, 16384)
  f.vus.ratio = 1.5
  applyRenderSize({ renderer: f.renderer, composer: f.composer })
  assert.equal(f.vus.ratio, 1.5)
  assert.deepEqual(f.vus.renderer, [910, 512])
})

test('applyRenderSize : un contexte WebGL absent (canevas perdu) ne casse rien', () => {
  const f = fauxGl(1280, 720, 16384)
  f.renderer.getContext = () => { throw new Error('contexte perdu') }
  assert.deepEqual(applyRenderSize({ ...f, pixelRatio: 2 }), [1280, 720])
  assert.equal(f.vus.ratio, 2)
})

// ---------------------------------------------------------------------------
// LES SOURCES, VERROUILLÉES
// ---------------------------------------------------------------------------
// Le plafond ne vaut que s'il est SUR LE CHEMIN. Trois endroits posaient la
// densité à la main juste avant d'appeler applyRenderSize : ils la
// contournaient donc entièrement.

// Les lignes de code (commentaires exclus) qui contiennent un motif. On teste
// la LISTE, pas la source entière : un assert.doesNotMatch sur main.js recrache
// 260 ko dans le rapport d'échec, ce qui rend la panne illisible.
const lignes = (fichier, motif) =>
  fs.readFileSync(path.join(ROOT, fichier), 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => !l.startsWith('//') && motif.test(l))

test('main.js : la densité vient de l’écran, plus jamais d’un 2 en dur', () => {
  assert.deepEqual(lignes('src/main.js', /pixelRatio:\s*2\s*,/), [],
    'pixelRatio codé à 2 : c’est le déclencheur du rabotage (voir viewport.js)')
  assert.equal(lignes('src/main.js', /screenPixelRatio\(\s*window\.devicePixelRatio/).length, 1,
    'la densité réelle de l’écran doit être lue, puis bornée par screenPixelRatio')
})

for (const fichier of ['src/perf.js', 'src/ui/camera-panel.js', 'src/main.js']) {
  test(`${fichier} : personne ne pose la densité à la main — elle passe par applyRenderSize`, () => {
    assert.deepEqual(lignes(fichier, /renderer\.setPixelRatio\(/), [],
      'setPixelRatio direct = plafond matériel contourné : passer pixelRatio à applyRenderSize')
  })
}

test('main.js : le resize passe par applyRenderSize, pas par son propre setSize', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/main.js'), 'utf8')
  const at = src.indexOf("window.addEventListener('resize'")
  const body = src.slice(at, at + 1600)
  assert.match(body, /applyRenderSize/, 'le resize doit servir la taille par la fonction unique')
  assert.doesNotMatch(body, /composer\.setSize\(/, 'plus de seconde source de vérité dans le resize')
})

// ---------------------------------------------------------------------------
// LA BARRE HAUTE DE PIXELS — « réso 2K max » (Adrien, 28/07/2026)
// ---------------------------------------------------------------------------
// MAX_PIXEL_RATIO borne un FACTEUR ; celle-ci borne le TOTAL. Sans elle, un
// iMac 5K poussait 14,7 Mpx par image en pleine qualité — trois images par
// seconde, ventilateur à fond, et aucune tirette pour s'en apercevoir. Ces
// tests décrivent la barre par ses effets sur des machines nommées.

// même faux trio, mais celui-ci retient la DENSITÉ servie : c'est elle que le
// plafond change, jamais les dimensions du cadre.
const fauxDense = (cw, ch) => {
  const vus = { ratio: null, renderer: null }
  return {
    vus,
    renderer: {
      domElement: { parentElement: { clientWidth: cw, clientHeight: ch } },
      setSize: (w, h) => { vus.renderer = [w, h] },
      setPixelRatio: (r) => { vus.ratio = r },
    },
    camera: { aspect: 1, updateProjectionMatrix() {} },
  }
}
// les pixels réellement poussés à chaque image
const mpxServis = (f) => (f.vus.renderer[0] * f.vus.renderer[1] * f.vus.ratio ** 2) / 1e6

test('densiteSousPlafond : 1080p à densité 1 passe INTACT', () => {
  // La non-régression la plus importante : la majorité du trafic ne doit rien
  // sentir. 1920×1080 = 2,07 Mpx, largement sous la barre de 3,69.
  assert.equal(densiteSousPlafond(1920, 1080, 1), 1)
})

test('densiteSousPlafond : tout écran 16:9 se retrouve servi en 2560×1440', () => {
  // La barre est un PLAFOND : on passe dessous, jamais dessus. L'arrondi au
  // millième vers le bas coûte quelques pixels sur les très grands écrans —
  // d'où la marge basse, qui vérifie qu'on reste tout de même au ras.
  for (const [w, h, r] of [[2560, 1440, 2], [3840, 2160, 1], [1920, 1080, 2]]) {
    const d = densiteSousPlafond(w, h, r)
    const servis = (w * h * d * d) / 1e6
    assert.ok(servis <= PLAFOND_MPX, `${w}×${h} sert ${servis} Mpx, AU-DESSUS de la barre`)
    assert.ok(servis > PLAFOND_MPX * 0.99, `${w}×${h} sert ${servis} Mpx, on gaspille de la finesse`)
    assert.ok(Math.abs(w * d - 2560) < 5, `${w}×${h} → ${Math.round(w * d)} px de large au lieu de 2560`)
  }
})

test('densiteSousPlafond : un cadre non mesurable ne dégrade RIEN', () => {
  // même règle que partout dans ce fichier : sans chiffre fiable on sert ce
  // qu'on nous demande. Brider à l'aveugle serait pire que le mal.
  assert.equal(densiteSousPlafond(0, 0, 2), 2)
  assert.equal(densiteSousPlafond(1920, 1080, 2, 0), 2)
  assert.equal(densiteSousPlafond(1920, 1080, 2, Infinity), 2)
})

test('applyRenderSize : l’iMac 5K tombe à densité 1 — 14,7 Mpx deviennent 3,69', () => {
  // macOS rapporte 2560×1440 CSS à densité 2. C'est LA machine du 28/07.
  const f = fauxDense(2560, 1440)
  applyRenderSize({ ...f, pixelRatio: 2 })
  assert.equal(f.vus.ratio, 1)
  assert.deepEqual(f.vus.renderer, [2560, 1440], 'le CADRE ne bouge pas : seule la densité recule')
  assert.ok(mpxServis(f) <= PLAFOND_MPX + 0.01)
})

test('applyRenderSize : un 1080p ordinaire garde exactement sa densité', () => {
  const f = fauxDense(1920, 1080)
  applyRenderSize({ ...f, pixelRatio: 1 })
  assert.equal(f.vus.ratio, 1, 'la barre ne mord pas ici')
})

test('applyRenderSize : la tirette « Échelle de rendu » est bornée elle aussi', () => {
  // C'est la seule entorse à « le réglage manuel gagne toujours », et elle est
  // délibérée : un 5K poussé à la main est exactement le cas qui fait souffler
  // le ventilateur. Sous la barre, la tirette garde tout son effet — le second
  // cas le prouve.
  const fort = fauxDense(2560, 1440)
  applyRenderSize({ ...fort, pixelRatio: 2 })
  assert.ok(mpxServis(fort) <= PLAFOND_MPX + 0.01, 'même demandée à la main, la barre tient')

  const doux = fauxDense(1280, 720)
  applyRenderSize({ ...doux, pixelRatio: 1.5 })
  assert.equal(doux.vus.ratio, 1.5, 'sous la barre, la tirette fait exactement ce qu’elle dit')
})

test('la barre haute vaut 2560×1440, le même « 2K » que le menu d’export', () => {
  // Deux définitions du mot « 2K » dans le même produit, c'est une incohérence
  // à découvrir un jour. export-presets.js a tranché pour le QHD ; on suit.
  assert.equal(PLAFOND_MPX, (2560 * 1440) / 1e6)
  const src = fs.readFileSync(path.join(ROOT, 'src/export-presets.js'), 'utf8')
  assert.match(src, /2560/, 'le cran « 2K » de l’export doit rester le même nombre')
})

test('L’EXPORT N’EST PAS BORNÉ : il ne passe pas par applyRenderSize', () => {
  // Le plafond borne l'AFFICHAGE temps réel, jamais le rendu qu'on livre. Un
  // export 4K doit rester un vrai 4K. Ce test épingle la séparation des deux
  // chemins : si un jour l'enregistreur se met à appeler applyRenderSize, les
  // exports se retrouveraient silencieusement rabotés à 2K.
  const src = fs.readFileSync(path.join(ROOT, 'src/export-recorder.js'), 'utf8')
  assert.doesNotMatch(src, /applyRenderSize/,
    'l’enregistreur force sa taille par applySize (export.js), et doit continuer')
})
