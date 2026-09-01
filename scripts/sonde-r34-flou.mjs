// SONDE DE LA PROFONDEUR DE CHAMP — Tâche R34 (règle D20).
//
// ⛔ **CE QU'ELLE JUGE EST EN PIXELS, PAS EN PARAMÈTRES.** La règle d'Adrien est
// visuelle : « à réglage égal, même flou apparent à 5 km et à 5 000 km ». Un
// paramètre bien posé sur une passe inerte ne vaut rien ; un paramètre en unités
// de bloc lu par une caméra en unités de globe vaut 1/k fois trop loin. On ne
// lit donc pas `params` : on lit **l'image** et **le tampon de profondeur**.
//
// ══════════ L'INSTRUMENT, EN QUATRE PIÈCES ═════════════════════════════════
//
// ① **LA VÉRITÉ DE PROFONDEUR** — `distanceProfondeur(px, py)` rend la distance
//    caméra → surface DESSINÉE sous un pixel, dans l'espace de la caméra qui
//    écrit la profondeur (`camGlobe` sous la fusion). Elle relit
//    `composer.inputBuffer.depthTexture` avec le MÊME calcul que le nuanceur de
//    cercle de confusion de `postprocessing` (`length(viewPosition)`) — c'est
//    donc exactement la distance que le flou compare à sa mise au point. Rien
//    n'est supposé sur le relief : ce qui est dans le tampon est ce qui est
//    dessiné, montagne exagérée comprise.
//
// ② **LES MIRES** — cinq panneaux noir|blanc (arête verticale, texture 2×1 en
//    `NearestFilter`) injectés dans la scène rendue, face à la caméra, sur les
//    rayons de cinq positions d'écran, à `d = f × {0,1 · 0,8 · 1 · 1,2 · 2}` de la
//    caméra où `f` est la mise au point RÉELLEMENT écrite dans le nuanceur.
//    `depthFunc: AlwaysDepth` + `depthWrite` : la mire écrit sa profondeur, donc
//    le flou la voit à sa distance, même posée « dans » une montagne.
//    ⚠️ `−100 %` serait la caméra elle-même (d = 0) : la mire « au plus près »
//    est à d = 0,1 f. Le cercle de confusion y est saturé de toute façon dès que
//    |d − f| dépasse la plage.
//
// ③ **LA LARGEUR DE TRANSITION 10 → 90 %** — sur la ligne de pixels qui traverse
//    l'arête de chaque mire, on relit la luminance de l'image NETTE (`dofPass`
//    éteinte) et de l'image FLOUE, et on mesure la distance en pixels entre le
//    point où la luminance a franchi 10 % de la marche et celui où elle en a
//    franchi 90 %. Une arête nette vaut 1 à 2 px (SMAA) ; un flou de rayon r
//    l'étale sur ~1,2 r. C'est le chiffre du tableau.
//
// ④ **LE CERCLE DE CONFUSION RELU** — `dof.renderTargetCoC` (rouge = proche,
//    vert = lointain, dans [0, 1]) au centre de chaque mire, × `bokehScale` =
//    le rayon NOMINAL en texels que la convolution applique. Il recoupe ③.
//
// ⚠️ **TROIS PIÈGES QUE LA SONDE NEUTRALISE** : le grain (`NoiseEffect`) repose
// un bruit neuf par rendu — coupé ; la planète tourne seule après 3 s
// (`params.animations = false` gèle `dtAmb`) ; le voile d'accueil `.ce-hubveil`
// avale les gestes — retiré, et `elementFromPoint` au centre est vérifié.
//
// EMPLOI
//   npm run dev -- --port 6401 --strictPort
//   node scripts/sonde-r34-flou.mjs --port 6401 --tag avant --sortie <dossier>
//   node scripts/sonde-r34-flou.mjs --port 6401 --tag apres --etapes cout --cpu 4 --dpr 2
//
//   npm i --no-save puppeteer-core@25.8.0   (même réserve que les autres sondes)

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = fileURLToPath(new URL('..', import.meta.url))
const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] ? A[i + 1] : d }
const PORT = Number(opt('--port', '6401'))
const TAG = opt('--tag', 'avant')
const SORTIE = opt('--sortie', '.superpowers/sdd/2026-08-22-globe-studio/traces-R34')
const ETAPES = opt('--etapes', 'agit,autofocus,mires,repli').split(',')
const CPU = Number(opt('--cpu', '1'))
const DPR = Number(opt('--dpr', '1'))
const LAT = Number(opt('--lat', '-21.2'))
const LON = Number(opt('--lon', '55.5'))
const SEUIL = 4
const CAPTURES = opt('--captures', '1') !== '0'
const SCENARIOS = (opt('--scenarios', '5km,130km,2000km,orbite')).split(',')

function trouverChrome() {
  const donne = opt('--chrome', process.env.CHROME_PATH)
  if (donne) return donne
  const pistes = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium',
  ]
  const t = pistes.find((p) => fs.existsSync(p))
  if (!t) { console.error('Chrome introuvable — passe --chrome <chemin>.'); process.exit(2) }
  return t
}
const puppeteer = await (async () => {
  try { return (await import('puppeteer-core')).default } catch { /* on cherche ailleurs */ }
  const pistes = [
    'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
    'C:/Dev/wt-warm/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
  ]
  for (const c of pistes) {
    if (!fs.existsSync(c)) continue
    return (await import('file:///' + c)).default
  }
  console.error('puppeteer-core absent : npm i --no-save puppeteer-core@25.8.0'); process.exit(2)
})()

const nav = await puppeteer.launch({
  executablePath: trouverChrome(), headless: 'new',
  args: ['--headless=new', '--hide-scrollbars', '--mute-audio', '--window-size=1280,800',
    '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-dev-shm-usage'],
})
const page = (await nav.pages())[0]
await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: DPR })
if (CPU > 1) await page.emulateCPUThrottling(CPU)
const erreurs = []
page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text().slice(0, 300)) })
page.on('pageerror', (e) => erreurs.push('PAGEERROR ' + String(e).slice(0, 300)))
const images = (n) => page.evaluate((k) => new Promise((r) => { let i = 0; const t = () => (++i >= k ? r() : requestAnimationFrame(t)); requestAnimationFrame(t) }), n)
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))

await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 120000 })
await page.waitForFunction('!!(window.__exp && window.__exp.controls && window.__exp.THREE)', { timeout: 240000 })
await page.waitForFunction("!!document.getElementById('loading')?.classList.contains('hidden')", { timeout: 180000 })
await page.keyboard.press('Escape').catch(() => {})
await page.evaluate(() => { document.querySelectorAll('.ce-hubveil').forEach((e) => e.remove()) })
await images(30)

// ─────────────────────────────────────────────── l'instrument, côté page
await page.evaluate(() => {
  const e = window.__exp
  const T = e.THREE
  const fusion = !!(e.frontiereActive && e.terreUniqueBranchee && e.camGlobe)
  const camFx = () => (fusion ? e.camGlobe : e.camera)
  const sceneFx = () => (fusion ? e.sceneGlobe : e.scene)
  const dofPass = () => e.composer.passes.find((p) => p.effects && p.effects.some((x) => x.constructor.name === 'DepthOfFieldEffect')) || null
  const dof = () => { const p = dofPass(); return p ? p.effects.find((x) => x.constructor.name === 'DepthOfFieldEffect') : null }
  const gl = e.renderer.getContext()
  const taille = () => [gl.drawingBufferWidth, gl.drawingBufferHeight]
  // mètres par unité de la caméra qui lit la profondeur
  const mpu = () => {
    if (fusion) return 6371000 / 100
    if (e.modes.mode === 'orbital') return 6371000 / 100
    return e.dem && e.dem.extentMeters ? e.dem.extentMeters / 56 : 1
  }
  const allumer = () => {
    if (!dofPass()) {
      const lab = [...document.querySelectorAll('label')].find((x) => /bokeh/i.test(x.textContent || ''))
      if (!lab) throw new Error('interrupteur bokeh introuvable')
      lab.parentElement.querySelector('button.ce-toggle').click()
    }
    const p = dofPass()
    if (!p) throw new Error('passe DoF absente après le clic')
    p.enabled = true
    return p
  }
  const grainOff = () => {
    for (const p of e.composer.passes) {
      const n = p.effects && p.effects.find((f) => f.constructor.name === 'NoiseEffect')
      if (n) n.blendMode.opacity.value = 0
    }
  }
  const rendre = () => {
    if (e.majCameraFond) e.majCameraFond()
    e.composer.render(0.016); e.composer.render(0.016)
  }
  const pixels = () => {
    const [w, h] = taille()
    const a = new Uint8Array(w * h * 4)
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, a)
    return a
  }
  const ecart = (a, b, seuil) => {
    const N = a.length / 4
    let n = 0, somme = 0, max = 0
    for (let i = 0; i < N; i++) {
      const j = i * 4
      const d = Math.max(Math.abs(a[j] - b[j]), Math.abs(a[j + 1] - b[j + 1]), Math.abs(a[j + 2] - b[j + 2]))
      if (d > seuil) n++
      somme += d
      if (d > max) max = d
    }
    return { pixels: n, pct: +(100 * n / N).toFixed(3), moyen: +(somme / N).toFixed(3), max, N }
  }
  // ① la vérité de profondeur — même calcul que circle-of-confusion.frag
  let prof = null
  const prepProfondeur = () => {
    const tex = e.composer.depthTexture || e.composer.inputBuffer.depthTexture
    if (!tex) throw new Error('pas de texture de profondeur sur le compositeur (la passe DoF doit exister)')
    const [w, h] = taille()
    if (prof && prof.w === w && prof.h === h && prof.tex === tex) return prof
    const log = !!e.renderer.capabilities.logarithmicDepthBuffer
    const mat = new T.ShaderMaterial({
      uniforms: {
        depthBuffer: { value: tex }, projectionMatrix: { value: new T.Matrix4() }, projectionMatrixInverse: { value: new T.Matrix4() },
        cameraNear: { value: 1 }, cameraFar: { value: 2 },
      },
      defines: log ? { LOG_DEPTH: '1' } : {},
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `#include <packing>
        uniform highp sampler2D depthBuffer; uniform mat4 projectionMatrix; uniform mat4 projectionMatrixInverse;
        uniform float cameraNear; uniform float cameraFar; varying vec2 vUv;
        void main(){
          float depth = texture2D(depthBuffer, vUv).r;
          #ifdef LOG_DEPTH
          float d = pow(2.0, depth * log2(cameraFar + 1.0)) - 1.0; float a = cameraFar / (cameraFar - cameraNear); float b = cameraFar * cameraNear / (cameraNear - cameraFar); depth = a + b / d;
          #endif
          float viewZ = perspectiveDepthToViewZ(depth, cameraNear, cameraFar);
          vec4 clip = vec4(vec3(vUv, depth) * 2.0 - 1.0, 1.0);
          float clipW = projectionMatrix[2][3] * viewZ + projectionMatrix[3][3];
          clip *= clipW;
          vec3 vp = (projectionMatrixInverse * clip).xyz;
          gl_FragColor = vec4(length(vp), depth, viewZ, 1.0);
        }`,
      depthTest: false, depthWrite: false,
    })
    const rt = new T.WebGLRenderTarget(w, h, { type: T.FloatType, format: T.RGBAFormat, depthBuffer: false, minFilter: T.NearestFilter, magFilter: T.NearestFilter })
    const sc = new T.Scene()
    sc.add(new T.Mesh(new T.PlaneGeometry(2, 2), mat))
    const cam = new T.OrthographicCamera(-1, 1, 1, -1, -1, 1)
    prof = { w, h, tex, mat, rt, sc, cam, log }
    return prof
  }
  const distanceProfondeur = (px, py) => {
    const p = prepProfondeur()
    const c = camFx()
    p.mat.uniforms.projectionMatrix.value.copy(c.projectionMatrix)
    p.mat.uniforms.projectionMatrixInverse.value.copy(c.projectionMatrixInverse)
    p.mat.uniforms.cameraNear.value = c.near
    p.mat.uniforms.cameraFar.value = c.far
    const cible = e.renderer.getRenderTarget()
    e.renderer.setRenderTarget(p.rt)
    e.renderer.render(p.sc, p.cam)
    e.renderer.setRenderTarget(cible)
    const f = new Float32Array(4)
    e.renderer.readRenderTargetPixels(p.rt, Math.round(px), p.h - 1 - Math.round(py), 1, 1, f)
    return { distance: f[0], depth: f[1], viewZ: f[2] }
  }
  // ② les mires
  let mires = []
  const textureMire = (() => {
    const cv = document.createElement('canvas'); cv.width = 2; cv.height = 1
    const cx = cv.getContext('2d'); cx.fillStyle = '#000'; cx.fillRect(0, 0, 1, 1); cx.fillStyle = '#fff'; cx.fillRect(1, 0, 1, 1)
    const t = new T.CanvasTexture(cv); t.minFilter = T.NearestFilter; t.magFilter = T.NearestFilter; t.generateMipmaps = false
    return t
  })()
  const poserMires = (liste, largeurPx = 110) => {
    retirerMires()
    const c = camFx()
    c.updateMatrixWorld(); c.updateProjectionMatrix()
    const [w, h] = taille()
    for (const m of liste) {
      const nd = new T.Vector3(m.nx, m.ny, 0.5).unproject(c)
      const o = new T.Vector3().setFromMatrixPosition(c.matrixWorld)
      const dir = nd.sub(o).normalize()
      const d = m.d
      const pos = o.clone().addScaledVector(dir, d)
      // la taille APPARENTE est fixée : `largeurPx` pixels quelle que soit la distance
      const largeur = d * 2 * Math.tan((c.fov * Math.PI) / 360) * (largeurPx / h)
      const geo = new T.PlaneGeometry(largeur, largeur * 0.6)
      // ⚠️ `transparent: true` N'EST PAS UN STYLE : les tuiles du globe sont des
      // matériaux transparents (estompage), donc dessinées APRÈS tous les opaques
      // — une mire opaque était recouverte par le relief dessiné ensuite, même
      // avec `AlwaysDepth`. Transparente et `renderOrder` maximal, elle passe
      // en dernier et impose sa profondeur.
      const mat = new T.MeshBasicMaterial({ map: textureMire, toneMapped: false, transparent: true, opacity: 1, depthTest: true, depthWrite: true, depthFunc: T.AlwaysDepth, side: T.DoubleSide })
      const mesh = new T.Mesh(geo, mat)
      mesh.position.copy(pos)
      mesh.quaternion.copy(c.quaternion)
      mesh.renderOrder = 100000
      mesh.frustumCulled = false
      sceneFx().add(mesh)
      const proj = pos.clone().project(c)
      mires.push({ mesh, ...m, px: (proj.x * 0.5 + 0.5) * w, py: (0.5 - proj.y * 0.5) * h })
    }
    return mires.map((m) => ({ d: m.d, nx: m.nx, ny: m.ny, px: m.px, py: m.py }))
  }
  const retirerMires = () => { for (const m of mires) { m.mesh.parent && m.mesh.parent.remove(m.mesh); m.mesh.geometry.dispose(); m.mesh.material.dispose() }; mires = [] }
  // ③ une ligne de luminance à travers une arête
  const ligne = (a, px, py, demi) => {
    const [w, h] = taille()
    const y = h - 1 - Math.round(py)
    const out = []
    for (let x = Math.round(px) - demi; x <= Math.round(px) + demi; x++) {
      if (x < 0 || x >= w) { out.push(null); continue }
      const j = (y * w + x) * 4
      out.push(+(0.2126 * a[j] + 0.7152 * a[j + 1] + 0.0722 * a[j + 2]).toFixed(2))
    }
    return out
  }
  // ④ le cercle de confusion relu
  const lireCoC = (px, py) => {
    const d = dof(); if (!d) return null
    const rt = d.renderTargetCoC
    const u = new Uint8Array(4)
    e.renderer.readRenderTargetPixels(rt, Math.round(px * rt.width / taille()[0]), rt.height - 1 - Math.round(py * rt.height / taille()[1]), 1, 1, u)
    return { proche: +(u[0] / 255).toFixed(4), lointain: +(u[1] / 255).toFixed(4) }
  }
  const etat = () => {
    const d = dof(); const c = camFx(); const m = e.modes
    return {
      mode: m.mode, busy: !!m.busy, altM: m.altM, altCadrageM: e.altitudeCadrageM ? e.altitudeCadrageM() : null,
      zoom: e.params.demZoom, emprise: e.dem ? e.dem.extentMeters : null, fusion, mpu: mpu(),
      palier: (window.__palierMachine || {}).palier, palierNom: (window.__palierMachine || {}).nom,
      camFx: c === e.camGlobe ? 'camGlobe' : 'camera', near: c.near, far: c.far, fov: c.fov,
      dofPasse: !!dofPass(), dofActive: !!(dofPass() && dofPass().enabled),
      cocFocus: d ? d.cocMaterial.focusDistance : null, cocPlage: d ? d.cocMaterial.focusRange : null,
      bokehScale: d ? d.bokehScale : null,
      params: { autoFocus: e.params.autoFocus, focusDistance: e.params.focusDistance, focusRange: e.params.focusRange, focusRatio: e.params.focusRatio, bokehEnabled: e.params.bokehEnabled, bokehScale: e.params.bokehScale },
      tampon: taille(), pixelRatio: e.renderer.getPixelRatio(),
      sousLeCentre: (() => { const el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2); return el ? el.tagName + '.' + String(el.className).slice(0, 30) : null })(),
      camPos: [camFx().position.x, camFx().position.y, camFx().position.z],
    }
  }
  window.__R34 = { e, T, fusion, camFx, sceneFx, dofPass, dof, allumer, grainOff, rendre, pixels, ecart, distanceProfondeur, poserMires, retirerMires, ligne, lireCoC, etat, mpu, taille }
})

// ─────────────────────────────────────────────── la pose des scénarios
async function poserOrbital(altM) {
  await page.evaluate((alt) => {
    const e = window.__exp; const m = e.modes
    m.orbAltTarget = alt / (6371000 / 100); m.orbAlt = m.orbAltTarget
  }, altM)
  await images(20)
}
async function plonger(zoom) {
  const mode = await page.evaluate(() => window.__exp.modes.mode)
  if (mode === 'orbital') {
    await page.evaluate((a) => { window.__exp.modes.plongeDepuisGlobe(a.lat, a.lon) }, { lat: LAT, lon: LON })
    await dodo(500)
    await page.waitForFunction('!window.__exp.modes.busy && !window.__exp.modes.travel', { timeout: 180000 }).catch(() => {})
    await images(30)
  }
  await page.evaluate((a) => window.__exp.modes._rescale({ lat: a.lat, lon: a.lon, zoom: a.zoom }, 'BANC R34'), { lat: LAT, lon: LON, zoom })
  await page.waitForFunction('!window.__exp.modes.busy', { timeout: 180000 }).catch(() => {})
  await images(30)
}
// la caméra de surface à une altitude métrique donnée, sur la direction d'arrivée
async function poserAltitudeSurface(altM) {
  for (let i = 0; i < 6; i++) {
    const r = await page.evaluate((alt) => {
      const e = window.__exp; const m = e.modes; const c = e.controls; const cam = e.camera
      const dir = cam.position.clone().sub(c.target)
      const d = dir.length(); dir.normalize()
      const altNow = m.altM
      const ratio = altNow > 0 ? alt / altNow : 1
      let d2 = d * Math.max(0.2, Math.min(5, ratio))
      d2 = Math.max(c.minDistance, Math.min(c.maxDistance, d2))
      cam.position.copy(c.target).addScaledVector(dir, d2)
      c.update()
      return { d, d2, altNow, dmin: c.minDistance, dmax: c.maxDistance }
    }, altM)
    await images(4)
    if (Math.abs(r.altNow - altM) / altM < 0.03) break
  }
  await images(60)
}
async function pointeur(fx, fy) {
  await page.mouse.move(Math.round(1280 * fx), Math.round(800 * fy))
}
// ⚠️ **LE DÉMARRAGE EST EN MODE `surface` À 5 KM (z12), PAS EN ORBITE** — mesuré
// avant d'écrire ces lignes : la porte orbitale ne s'ouvre que vers 7 à 12
// millions de mètres (`modes.js`). 2 000 km est donc un bloc z4 vu de haut, et
// « orbite » un quatrième scénario, atteint à la molette.
const scenarios = {
  '5km': { nom: '5 km (crop z13)', altM: 5e3, poser: async () => { await plonger(13); await poserAltitudeSurface(5e3) } },
  '130km': { nom: '130 km (surface z9)', altM: 130e3, poser: async () => { await plonger(9); await poserAltitudeSurface(130e3) } },
  '2000km': { nom: '2 000 km (surface z4)', altM: 2000e3, poser: async () => { await plonger(4); await poserAltitudeSurface(2000e3) } },
  orbite: { nom: '15 000 km (orbite)', altM: 15000e3, poser: async () => {
    for (let i = 0; i < 40; i++) {
      const m = await page.evaluate(() => window.__exp.modes.mode)
      if (m === 'orbital') break
      await page.evaluate(() => window.__exp.modes.cranZoom(-1))
      await images(8)
      await page.waitForFunction('!window.__exp.modes.busy', { timeout: 120000 }).catch(() => {})
    }
    await page.waitForFunction('!window.__exp.modes.busy && !window.__exp.modes.travel', { timeout: 120000 }).catch(() => {})
    await poserOrbital(15000e3)
  } },
}

// ─────────────────────────────────────────────── les mesures
function largeurTransition(l) {
  const v = l.filter((x) => x != null)
  if (v.length < 20) return null
  const G = v.slice(0, 8).reduce((a, b) => a + b, 0) / 8
  const D = v.slice(-8).reduce((a, b) => a + b, 0) / 8
  const marche = D - G
  if (Math.abs(marche) < 20) return { largeur: null, marche: +marche.toFixed(1) }
  const s = Math.sign(marche)
  const lo = G + 0.1 * marche, hi = G + 0.9 * marche
  let x10 = null, x90 = null
  for (let i = 0; i < v.length; i++) { if (s * (v[i] - lo) >= 0) { x10 = i; break } }
  for (let i = v.length - 1; i >= 0; i--) { if (s * (v[i] - hi) <= 0) { x90 = i; break } }
  if (x10 == null || x90 == null) return { largeur: null, marche: +marche.toFixed(1) }
  return { largeur: Math.max(1, x90 - x10 + 1), marche: +marche.toFixed(1), x10, x90 }
}

async function mesurerAgit() {
  // les réglages du PRODUIT (ce que l'interrupteur allume), pointeur au centre
  await pointeur(0.5, 0.5)
  await page.evaluate(() => { const R = window.__R34; R.allumer(); R.grainOff(); R.e.params.animations = false })
  await images(60)
  return page.evaluate((seuil) => {
    const R = window.__R34; const p = R.dofPass(); const d = R.dof()
    // ⚠️ le brassage du look TIRE AU SORT bokehScale au démarrage (16,2 relevé) :
    // on épingle l'optique du dépôt (3,7), sinon « flou(3,7) » mentirait
    const sInitial = d.bokehScale
    d.bokehScale = 3.7
    const etat = R.etat()
    const cliche = (on) => { p.enabled = on; R.rendre(); return R.pixels() }
    const net = cliche(false)
    const temoin = R.ecart(net, cliche(false), seuil)
    const flou = R.ecart(net, cliche(true), seuil)
    // le même comptage à `bokehScale = 16` (l'optique de R10), le reste inchangé
    const s0 = d.bokehScale; d.bokehScale = 16
    const flou16 = R.ecart(net, cliche(true), seuil)
    d.bokehScale = s0
    // l'option 1 de l'inventaire : autofocus on/off, pointeur immobile
    p.enabled = true
    const a = cliche(true)
    R.e.params.autoFocus = !R.e.params.autoFocus
    R.rendre()
    const b = R.pixels()
    R.e.params.autoFocus = !R.e.params.autoFocus
    const option1 = R.ecart(a, b, seuil)
    return { etat, temoin, flou, flou16, option1, bokehScaleInitial: sInitial }
  }, SEUIL)
}

async function mesurerAutofocus() {
  await page.evaluate(() => { const R = window.__R34; R.allumer(); R.grainOff(); R.e.params.animations = false; R.e.params.autoFocus = true })
  const trames = []
  const N = 20
  for (let i = 0; i < N; i++) {
    const fx = 0.25 + 0.5 * (i / (N - 1)), fy = 0.35 + 0.3 * (i / (N - 1))
    await pointeur(fx, fy)
    await images(1)
    const t = await page.evaluate((a) => {
      const R = window.__R34
      const px = a.fx * R.taille()[0], py = a.fy * R.taille()[1]
      const v = R.distanceProfondeur(px, py)
      const d = R.dof()
      const k = R.mpu()
      return { i: a.i, px: +px.toFixed(0), py: +py.toFixed(0), ecritU: d.cocMaterial.focusDistance, reelU: v.distance, depth: v.depth, ecritM: d.cocMaterial.focusDistance * k, reelM: v.distance * k, paramsFocus: R.e.params.focusDistance }
    }, { fx, fy, i })
    t.ecartM = t.ecritM - t.reelM
    t.rapport = t.reelM > 0 ? +(t.ecritM / t.reelM).toFixed(4) : null
    trames.push(t)
  }
  // et la valeur CONVERGÉE, pointeur immobile 60 images (sépare le retard de l'unité)
  await images(60)
  const converge = await page.evaluate((a) => {
    const R = window.__R34
    const px = a.fx * R.taille()[0], py = a.fy * R.taille()[1]
    const v = R.distanceProfondeur(px, py); const d = R.dof(); const k = R.mpu()
    return { ecritM: d.cocMaterial.focusDistance * k, reelM: v.distance * k, rapport: v.distance > 0 ? +(d.cocMaterial.focusDistance / v.distance).toFixed(4) : null, plageM: d.cocMaterial.focusRange * k, plageSurFocus: d.cocMaterial.focusDistance > 0 ? +(d.cocMaterial.focusRange / d.cocMaterial.focusDistance).toFixed(4) : null }
  }, { fx: 0.75, fy: 0.65 })
  return { trames, converge }
}

async function mesurerMires(bokehScale, cle) {
  await pointeur(0.5, 0.5)
  await page.evaluate(() => { const R = window.__R34; R.allumer(); R.grainOff(); R.e.params.animations = false; R.e.params.autoFocus = true })
  await images(60) // l'autofocus du produit se pose au centre
  const r = await page.evaluate((a) => {
    const R = window.__R34; const p = R.dofPass(); const d = R.dof()
    const [w, h] = R.taille()
    R.e.params.autoFocus = false // on fige la mise au point que le produit vient d'écrire
    const f = d.cocMaterial.focusDistance
    const plage = d.cocMaterial.focusRange
    const centre = R.distanceProfondeur(w / 2, h / 2)
    const s0 = d.bokehScale; d.bokehScale = a.bokehScale
    // ⚠️ la mire « au plus près » ne peut pas passer sous le plan proche de la
    // caméra (planProche, ~1/7 de l'altitude) : 0,1 f ou 1,5 × near, le plus grand
    const c = R.camFx()
    const ratios = [Math.max(0.1, (1.5 * c.near) / f), 0.8, 1.0, 1.2, 2.0]
    const nx = [-0.8, -0.4, 0, 0.4, 0.8]
    const liste = ratios.map((r, i) => ({ d: f * r, ratio: +r.toFixed(3), nx: nx[i], ny: 0.0 }))
    const posees = R.poserMires(liste)
    p.enabled = false; R.rendre(); const net = R.pixels()
    p.enabled = true; R.rendre(); const flou = R.pixels()
    window.__R34.captureEnCours = true
    const lignes = posees.map((m, i) => ({
      ratio: +ratios[i].toFixed(3), d: m.d, dM: m.d * R.mpu(), px: +m.px.toFixed(1), py: +m.py.toFixed(1),
      net: R.ligne(net, m.px, m.py, 40), flou: R.ligne(flou, m.px, m.py, 40),
      coc: R.lireCoC(m.px + 12, m.py), cocMireGauche: R.lireCoC(m.px - 12, m.py),
      profondeurMire: R.distanceProfondeur(m.px + 12, m.py).distance,
      profondeurMireGauche: R.distanceProfondeur(m.px - 12, m.py).distance,
      focusAuRendu: d.cocMaterial.focusDistance,
    }))
    return { f, fM: f * R.mpu(), plage, plageM: plage * R.mpu(), plageSurFocus: f > 0 ? plage / f : null, centreReel: centre.distance, centreReelM: centre.distance * R.mpu(), bokehScale: a.bokehScale, lignes, etat: R.etat(), s0 }
  }, { bokehScale })
  // la capture, mires posées et flou actif — la preuve qu'on peut regarder
  if (CAPTURES) {
    await images(2)
    const nom = `mires-${TAG}-${cle}-bokeh${String(bokehScale).replace('.', '_')}.png`
    await page.screenshot({ path: path.join(path.resolve(RACINE, SORTIE), nom) })
    r.capture = nom
  }
  await page.evaluate((s0) => { const R = window.__R34; R.retirerMires(); R.dof().bokehScale = s0; R.dofPass().enabled = true }, r.s0)
  for (const l of r.lignes) {
    l.transitionNet = largeurTransition(l.net)
    l.transitionFlou = largeurTransition(l.flou)
    l.rayonNominalPx = l.coc ? +(Math.max(l.coc.proche, l.coc.lointain) * bokehScale).toFixed(2) : null
  }
  return r
}

async function mesurerRepli() {
  await page.evaluate(() => { const R = window.__R34; R.allumer(); R.grainOff(); R.e.params.animations = false; R.e.params.autoFocus = true })
  // ① pointeur posé SUR LA TOILE (vérifié par elementFromPoint — le panneau
  //    « Mes créations » couvre le haut droit), loin du centre : la mise au
  //    point converge là
  const P = await page.evaluate(() => {
    const canvas = window.__exp.renderer.domElement
    for (const [fx, fy] of [[0.8, 0.6], [0.2, 0.6], [0.8, 0.45], [0.2, 0.3]]) {
      if (document.elementFromPoint(fx * window.innerWidth, fy * window.innerHeight) === canvas) return { fx, fy }
    }
    return null
  })
  if (!P) return { erreur: 'aucun point de toile libre' }
  await pointeur(P.fx, P.fy)
  await images(90)
  const depart = await page.evaluate((P) => { const R = window.__R34; const d = R.dof(); const [w, h] = R.taille(); return { point: P, surToile: R.e.pointeurSurToile, ecritU: d.cocMaterial.focusDistance, centreU: R.distanceProfondeur(w / 2, h / 2).distance, sousPointeurU: R.distanceProfondeur(P.fx * w, P.fy * h).distance } }, P)
  // ② un élément DOM qui n'est pas la toile — le premier trouvé sur une grille
  const cible = await page.evaluate(() => {
    const canvas = window.__exp.renderer.domElement
    for (let y = 8; y < window.innerHeight; y += 24) for (let x = 8; x < window.innerWidth; x += 24) {
      const el = document.elementFromPoint(x, y)
      if (el && el !== canvas && el.tagName !== 'HTML' && el.tagName !== 'BODY') return { x, y, tag: el.tagName + '.' + String(el.className).slice(0, 30) }
    }
    return null
  })
  if (!cible) return { depart, erreur: 'aucun élément hors toile trouvé' }
  await page.mouse.move(cible.x, cible.y)
  const t0 = await page.evaluate(() => performance.now())
  const suivi = []
  for (let i = 0; i < 90; i++) {
    await images(1)
    suivi.push(await page.evaluate(() => { const R = window.__R34; const d = R.dof(); return { t: performance.now(), ecritU: d.cocMaterial.focusDistance } }))
  }
  const fin = await page.evaluate(() => { const R = window.__R34; const [w, h] = R.taille(); return { centreU: R.distanceProfondeur(w / 2, h / 2).distance } })
  const a = depart.ecritU, b = suivi[suivi.length - 1].ecritU
  const seuils = {}
  for (const f of [0.63, 0.9, 0.95]) {
    const s = suivi.find((x) => Math.abs(x.ecritU - a) >= f * Math.abs(b - a))
    seuils[f] = s ? +(s.t - t0).toFixed(0) : null
  }
  const cadence = suivi.length > 1 ? +((suivi.length - 1) * 1000 / (suivi[suivi.length - 1].t - suivi[0].t)).toFixed(1) : null
  return { depart, cible, arrivee: { ecritU: b, centreU: fin.centreU, ecartCentre: +(b - fin.centreU).toFixed(4) }, glissementMs: seuils, cadenceHz: cadence, suivi: suivi.map((s) => ({ t: +(s.t - t0).toFixed(0), u: +s.ecritU.toFixed(4) })) }
}

async function mesurerCout() {
  await pointeur(0.5, 0.5)
  await page.evaluate(() => { const R = window.__R34; R.allumer(); R.grainOff(); R.e.params.animations = false })
  await images(30)
  return page.evaluate(async () => {
    const R = window.__R34; const e = R.e; const p = R.dofPass()
    const gl = e.renderer.getContext()
    const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2')
    const dbg = gl.getExtension('WEBGL_debug_renderer_info')
    const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
    async function bloc(images) {
      for (let i = 0; i < 20; i++) e.composer.render(0)
      const q = ext ? gl.createQuery() : null
      const t0 = performance.now()
      if (q) gl.beginQuery(ext.TIME_ELAPSED_EXT, q)
      for (let i = 0; i < images; i++) e.composer.render(0)
      if (q) gl.endQuery(ext.TIME_ELAPSED_EXT)
      const cpuMs = (performance.now() - t0) / images
      if (!q) return { dispo: false, cpuMs }
      for (let k = 0; k < 400; k++) { if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break; await dodo(6) }
      const dispo = gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)
      const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT)
      const ns = dispo ? gl.getQueryParameter(q, gl.QUERY_RESULT) : null
      gl.deleteQuery(q)
      return { dispo, disjoint, gpuMs: ns == null ? null : ns / 1e6 / images, cpuMs }
    }
    const mediane = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)]
    // ⚠️ BLOCS ALTERNÉS avec/sans (7 paires) : une dérive thermique ou une
    // recompilation en cours ne tombe pas toute d'un seul côté
    const paires = []
    for (let b = 0; b < 7; b++) {
      p.enabled = true; const a = await bloc(30)
      p.enabled = false; const s = await bloc(30)
      paires.push({ avec: a, sans: s })
    }
    const ok = paires.filter((x) => x.avec.dispo && !x.avec.disjoint && x.sans.dispo && !x.sans.disjoint)
    const res = { pilote: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : null, tampon: R.taille(), pixelRatio: e.renderer.getPixelRatio(), minuterie: !!ext, etat: R.etat(), paires: paires.length, pairesValides: ok.length }
    res.avec = { gpuMs: ok.length ? +mediane(ok.map((x) => x.avec.gpuMs)).toFixed(3) : null, cpuMs: +mediane(paires.map((x) => x.avec.cpuMs)).toFixed(3) }
    res.sans = { gpuMs: ok.length ? +mediane(ok.map((x) => x.sans.gpuMs)).toFixed(3) : null, cpuMs: +mediane(paires.map((x) => x.sans.cpuMs)).toFixed(3) }
    res.passeGpuMs = ok.length ? +mediane(ok.map((x) => x.avec.gpuMs - x.sans.gpuMs)).toFixed(3) : null
    res.passeCpuMs = +mediane(paires.map((x) => x.avec.cpuMs - x.sans.cpuMs)).toFixed(3)
    // ⚡ ET LA PASSE SEULE, sous sa propre requête (une par image, posée autour de
    // `dofPass.render`) — c'est le chiffre qui ne dépend pas du reste de l'image
    if (ext) {
      const orig = p.render
      const reqs = []
      p.render = function (...a) { const q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); orig.apply(this, a); gl.endQuery(ext.TIME_ELAPSED_EXT); reqs.push(q) }
      p.enabled = true
      for (let i = 0; i < 10; i++) e.composer.render(0)
      reqs.splice(0).forEach((q) => gl.deleteQuery(q))
      for (let i = 0; i < 60; i++) e.composer.render(0)
      p.render = orig
      for (let k = 0; k < 400; k++) { if (reqs.every((q) => gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE))) break; await dodo(6) }
      const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT)
      const ms = reqs.filter((q) => gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)).map((q) => gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6)
      reqs.forEach((q) => gl.deleteQuery(q))
      res.passeSeule = { n: ms.length, disjoint, medianeMs: ms.length ? +mediane(ms).toFixed(3) : null, minMs: ms.length ? +Math.min(...ms).toFixed(3) : null, maxMs: ms.length ? +Math.max(...ms).toFixed(3) : null }
    }
    p.enabled = true
    return res
  })
}

// ─────────────────────────────────────────────── la campagne
fs.mkdirSync(path.resolve(RACINE, SORTIE), { recursive: true })
const releve = { date: new Date().toISOString(), tag: TAG, port: PORT, cpu: CPU, dpr: DPR, lat: LAT, lon: LON, scenarios: [] }
for (const cle of SCENARIOS) {
  const sc = scenarios[cle]
  if (!sc) { console.error('scénario inconnu : ' + cle); continue }
  console.log('\n══ ' + sc.nom)
  await sc.poser()
  const bloc = { cle, nom: sc.nom, altViseeM: sc.altM }
  bloc.etat = await page.evaluate(() => window.__R34.etat())
  console.log('  mode ' + bloc.etat.mode + ' · alt ' + Math.round(bloc.etat.altM) + ' m · zoom ' + bloc.etat.zoom + ' · palier ' + bloc.etat.palier + ' · camFx ' + bloc.etat.camFx + ' near/far ' + bloc.etat.near + '/' + bloc.etat.far + ' · sous le centre ' + bloc.etat.sousLeCentre)
  if (ETAPES.includes('agit')) {
    bloc.agit = await mesurerAgit()
    console.log('  agit : témoin ' + bloc.agit.temoin.pixels + ' px · flou(3,7) ' + bloc.agit.flou.pixels + ' px (' + bloc.agit.flou.pct + ' %) · flou(16) ' + bloc.agit.flou16.pixels + ' px (' + bloc.agit.flou16.pct + ' %) · option 1 (autofocus on/off) ' + bloc.agit.option1.pixels + ' px')
    console.log('        focus écrit ' + bloc.agit.etat.cocFocus + ' u · plage ' + bloc.agit.etat.cocPlage + ' u · params.focusDistance ' + bloc.agit.etat.params.focusDistance + ' · focusRange ' + bloc.agit.etat.params.focusRange + ' · focusRatio ' + bloc.agit.etat.params.focusRatio)
  }
  if (ETAPES.includes('autofocus')) {
    bloc.autofocus = await mesurerAutofocus()
    const t = bloc.autofocus.trames
    console.log('  autofocus (20 images) : écrit/réel — ' + t.map((x) => x.rapport).join(' '))
    console.log('        convergé : écrit ' + Math.round(bloc.autofocus.converge.ecritM) + ' m · réel ' + Math.round(bloc.autofocus.converge.reelM) + ' m · rapport ' + bloc.autofocus.converge.rapport + ' · plage/focus ' + bloc.autofocus.converge.plageSurFocus)
  }
  if (ETAPES.includes('mires')) {
    bloc.mires = {}
    for (const s of [3.7, 16]) {
      const r = await mesurerMires(s, cle)
      bloc.mires[String(s)] = r
      console.log('  mires (bokehScale ' + s + ') : focus ' + Math.round(r.fM) + ' m (réel au centre ' + Math.round(r.centreReelM) + ' m) · plage ' + Math.round(r.plageM) + ' m = ' + (r.plageSurFocus != null ? r.plageSurFocus.toFixed(3) : '?') + ' × focus')
      console.log('        ' + r.lignes.map((l) => `${l.ratio}f: net ${l.transitionNet?.largeur ?? '?'} px → flou ${l.transitionFlou?.largeur ?? '?'} px (CoC ${l.coc ? Math.max(l.coc.proche, l.coc.lointain).toFixed(2) : '?'} → ${l.rayonNominalPx} px · prof/d ${(l.profondeurMire / l.d).toFixed(3)})`).join(' · '))
    }
  }
  if (ETAPES.includes('repli')) {
    bloc.repli = await mesurerRepli()
    if (bloc.repli.erreur) console.log('  repli : ' + bloc.repli.erreur)
    else console.log('  repli : point ' + JSON.stringify(bloc.repli.depart.point) + ' surToile ' + bloc.repli.depart.surToile + ' · départ ' + bloc.repli.depart.ecritU.toFixed(4) + ' u (sous pointeur ' + bloc.repli.depart.sousPointeurU.toFixed(4) + ', centre ' + bloc.repli.depart.centreU.toFixed(4) + ') → arrivée ' + bloc.repli.arrivee.ecritU.toFixed(4) + ' u (centre ' + bloc.repli.arrivee.centreU.toFixed(4) + ') · 63/90/95 % en ' + JSON.stringify(bloc.repli.glissementMs) + ' ms · cadence ' + bloc.repli.cadenceHz + ' Hz · cible ' + bloc.repli.cible.tag)
  }
  if (ETAPES.includes('marche')) {
    // le coût CPU de la marche de rayon (autofocus) — JavaScript pur, le pendule est le coût
    bloc.marche = await page.evaluate(() => {
      const e = window.__exp
      if (!e.distanceSousLaVisee) return { erreur: 'distanceSousLaVisee non exposée (avant)' }
      const T = e.THREE
      const pts = []
      for (let i = 0; i < 100; i++) pts.push(new T.Vector2(-0.8 + 1.6 * (i % 10) / 9, -0.6 + 1.2 * Math.floor(i / 10) / 9))
      for (let i = 0; i < 100; i++) e.distanceSousLaVisee(pts[i])
      const t0 = performance.now()
      let touches = 0
      for (let r = 0; r < 5; r++) for (let i = 0; i < 100; i++) { if (e.distanceSousLaVisee(pts[i]) != null) touches++ }
      const ms = (performance.now() - t0) / 500
      return { msParAppel: +ms.toFixed(4), touches: touches / 5, sur: 100 }
    })
    console.log('  marche : ' + JSON.stringify(bloc.marche))
  }
  if (ETAPES.includes('cout')) {
    bloc.cout = await mesurerCout()
    console.log('  coût : ' + bloc.cout.pilote + ' · tampon ' + bloc.cout.tampon.join('×') + ' (ratio ' + bloc.cout.pixelRatio + ') · image avec ' + bloc.cout.avec.gpuMs + ' ms GPU / ' + bloc.cout.avec.cpuMs + ' ms CPU · sans ' + bloc.cout.sans.gpuMs + ' / ' + bloc.cout.sans.cpuMs + ' · différence = ' + bloc.cout.passeGpuMs + ' ms GPU, ' + bloc.cout.passeCpuMs + ' ms CPU · passe seule ' + JSON.stringify(bloc.cout.passeSeule))
  }
  releve.scenarios.push(bloc)
}
releve.erreursConsole = erreurs
await nav.close()

const dossier = path.resolve(RACINE, SORTIE)
fs.mkdirSync(dossier, { recursive: true })
const nom = `flou-${TAG}${ETAPES.includes('cout') ? '-cout' : ''}${CPU > 1 || DPR > 1 ? `-cpu${CPU}-dpr${DPR}` : ''}.json`
fs.writeFileSync(path.join(dossier, nom), JSON.stringify(releve, null, 1), 'utf8')
console.log('\nrelevé : ' + path.join(dossier, nom))
if (erreurs.length) console.log('erreurs console : ' + erreurs.length + '\n  ' + erreurs.slice(0, 5).join('\n  '))
