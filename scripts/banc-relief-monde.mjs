// BANC DE CHRONOMÉTRAGE — règle D15, Tâche R6.
//
// ⛔ **UNE TÂCHE D15 QUI NE CHRONOMÈTRE PAS EST UNE TÂCHE NON FINIE.** Ce que
// D15 rend global — la normale par fragment et l'ombrage de relief — tournait
// sur les 36 tuiles du crop ; global, il tourne sur TOUT ce qui est traversé.
// Ce banc mesure ce que ça coûte, par image, à cadrage identique.
//
// ══════════ LA MÉTHODE, ET ELLE EST REPRISE DE `rapport-R2.md` ══════════════
//
//   ① **RENDU PILOTÉ, PAS SUBI.** La boucle rAF de l'application est CAPTURÉE
//      (voir `installerHorloge`) et c'est le banc qui appelle
//      `composer.render()`. Sans ça, on mesure l'entrelacement de deux
//      producteurs d'images, pas le coût d'un nuanceur.
//      ⚠️ **ET `globe.update()` NE TOURNE PLUS** — c'est voulu : on chronomètre
//      le DESSIN, pas le streaming du quadtree, qui est du réseau.
//   ② **UN POINT DE SYNCHRONISATION AUX DEUX BOUTS.** WebGL est asynchrone ;
//      sans lui on chronomètre la mise en file, pas l'exécution.
//      ⛔ **ET CE N'EST PAS `gl.finish()`, C'EST `gl.readPixels`.** Mesuré sur
//      cette machine (`.banc/R6/diag.mjs`, trois blocs de 40 images sur la même
//      scène) : `gl.finish()` a rendu **2,197 / 3,490 / 0,505 ms** par image —
//      un facteur SEPT entre deux blocs identiques — quand `readPixels(1×1)` a
//      rendu **0,657 / 0,640 / 0,700**. Sous ANGLE/D3D11, `finish` ne barre pas
//      la route ; une lecture de pixel, si.
//   ③ **DES RENDUS DE CHAUFFE JETÉS** au début de chaque bloc.
//   ④ **ORDRE DES VARIANTES TOURNANT** (ABBA), pour que la dérive thermique
//      et le gouverneur de fréquence ne tombent pas toujours sur la même.
//   ⑤ **DIFFÉRENCES APPARIÉES** : on ne compare pas deux moyennes, on moyenne
//      la différence par PAIRE, prise à quelques millisecondes d'écart.
//
// ⚠️ **AUCUNE RECOMPILATION ICI, ET C'EST UN ÉCART ASSUMÉ AVEC R2.** Les deux
// postes se coupent par des UNIFORMES (`uNormaleFineOn`, `uReliefMondeGain`),
// pas par des `#define` : le programme GPU est le MÊME des deux côtés. C'est ce
// qui rend l'appariement propre — et c'est aussi pourquoi la chauffe est là
// pour la thermique, pas pour un cache de shaders.
//
// EMPLOI
//   node scripts/banc-relief-monde.mjs --port 5519 --altitude 2000000
//   node scripts/banc-relief-monde.mjs --paires 24 --images 20

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = fileURLToPath(new URL('..', import.meta.url))
const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] ? A[i + 1] : d }
const PORT = Number(opt('--port', '5519'))
const PAIRES = Number(opt('--paires', '20'))
const IMAGES = Number(opt('--images', '16'))
const CHAUFFE = Number(opt('--chauffe', '40'))
const SORTIE = opt('--sortie', null)
const ALTITUDES = (opt('--altitudes', '2000000,120000,40000')).split(',').map(Number)
// ⚠️ **QUEL POSTE ON COUPE.** `deux` mesure D15 en entier ; `normale` isole la
// normale par fragment ; `gain` isole l'ombrage de relief. La décomposition
// compte parce que la normale fine est DÉJÀ payée par le crop depuis P9 : sous
// le seuil, ce que D15 ajoute est le seul `gain`.
const POSTE = opt('--poste', 'deux')
const ADRESSE = opt('--adresse', 'terre=unique&frontiere=1&seuil=1&globe=continu&socle=quadtree&f3=0&planete=eclairee')

function trouverChrome() {
  const donne = opt('--chrome', process.env.CHROME_PATH)
  if (donne) return donne
  const pistes = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/chromium',
  ]
  const t = pistes.find((p) => fs.existsSync(p))
  if (!t) { console.error('Chrome introuvable — passe --chrome <chemin>.'); process.exit(2) }
  return t
}
const puppeteer = await (async () => {
  try { return (await import('puppeteer-core')).default } catch {
    console.error('puppeteer-core absent : npm i --no-save puppeteer-core'); process.exit(2)
  }
})()

const nav = await puppeteer.launch({
  executablePath: trouverChrome(), headless: 'new',
  args: ['--headless=new', '--hide-scrollbars', '--mute-audio', '--window-size=1280,800',
    '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-dev-shm-usage',
    // ⚠️ SANS CETTE LIGNE, Chrome plafonne le rendu à la fréquence de l'écran
    // virtuel et toutes les mesures rendent le même chiffre.
    '--disable-frame-rate-limit', '--disable-gpu-vsync'],
})
const page = await nav.newPage()
await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 })
page.on('pageerror', (e) => console.error('  [page] ' + e.message))

const url = `http://localhost:${PORT}/?${ADRESSE}`
console.log('→ ' + url)
await page.goto(url, { waitUntil: 'load', timeout: 90000 })
await page.waitForFunction('window.__exp && window.__exp.globe && window.__exp.globe.uniforms', { timeout: 90000 })
await new Promise((r) => setTimeout(r, 6000))
await page.keyboard.press('Escape')
await new Promise((r) => setTimeout(r, 10000))

const materiel = await page.evaluate(() => {
  const gl = window.__exp.renderer.getContext()
  const d = gl.getExtension('WEBGL_debug_renderer_info')
  return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'inconnu'
})
console.log('matériel : ' + materiel + '   poste coupé : ' + POSTE)

// ⚠️ **LA BOUCLE DE L'APPLICATION EST CAPTURÉE, PAS TUÉE — ET LA PREMIÈRE
// VERSION DE CE BANC S'Y EST FAIT PRENDRE.** En remplaçant `rAF` par un no-op,
// la chaîne mourait pour de bon : les deux altitudes suivantes ont été mesurées
// sur le quadtree de la PREMIÈRE (249 tuiles, 55 dessinées, aux trois lignes).
// On garde donc la main sur le rappel : `tourner(n)` rend n images à
// l'application (le streaming reprend), `figer()` la laisse en suspens pendant
// que le banc, lui, appelle `composer.render()` autant qu'il veut.
async function installerHorloge() {
  await page.evaluate(() => {
    if (window.__R6_horloge) return
    const vrai = window.requestAnimationFrame.bind(window)
    // ⛔ **UNE FILE, PAS UN SEUL EMPLACEMENT — ET LA PREMIÈRE VERSION EST MORTE
    // DESSUS.** `tick()` n'est pas le seul appelant de `requestAnimationFrame`
    // dans cette application (transitions d'interface, cartouches, veilles).
    // Avec un seul emplacement, le dernier inscrit ÉCRASE `tick`, la chaîne de
    // rendu meurt, et le banc mesure trois altitudes sur le même quadtree :
    // 151 tuiles, 18 appels de dessin et 134 373 triangles aux trois lignes,
    // y compris à 2 000 000 m. C'est le relevé qui a fait trouver le défaut.
    let file = []
    window.__R6_horloge = {
      vrai,
      tourner: (n) => new Promise((res) => {
        let reste = n
        const pas = () => {
          const lot = file
          file = []
          if (!lot.length) return res(false)
          const t = performance.now()
          for (const cb of lot) cb(t)
          if (--reste <= 0) return res(true)
          vrai(pas)
        }
        vrai(pas)
      }),
    }
    window.requestAnimationFrame = (cb) => { file.push(cb); return file.length }
  })
}
const tourner = (n) => page.evaluate((k) => window.__R6_horloge.tourner(k), n)

async function poserAltitude(m) {
  return page.evaluate((cible) => {
    const e = window.__exp
    const cam = e.camera, ct = e.controls
    ct.minDistance = 1e-4; ct.maxDistance = 1e12
    const t = ct.target
    const dir = cam.position.clone().sub(t).normalize()
    for (let i = 0; i < 40; i++) {
      const a = e.altitudeCadrageM()
      if (!Number.isFinite(a) || a <= 0) break
      const d = cam.position.distanceTo(t)
      const nd = d * (cible / a)
      if (!Number.isFinite(nd) || nd <= 0) break
      cam.position.copy(t).addScaledVector(dir, nd)
      ct.update?.()
      if (Math.abs(e.altitudeCadrageM() - cible) / cible < 0.004) break
    }
    return e.altitudeCadrageM()
  }, m)
}

await installerHorloge()

const resultats = []
for (const alt of ALTITUDES) {
  const vraie = await poserAltitude(alt)
  // ⚠️ **LE QUADTREE DOIT FINIR DE CHARGER CE CADRAGE-CI** : on chronomètre une
  // scène posée, pas une scène qui se remplit. 900 images rendues à
  // l'application, entrecoupées d'attentes pour laisser le réseau répondre.
  for (let i = 0; i < 6; i++) { await tourner(150); await new Promise((r) => setTimeout(r, 2000)) }

  const r = await page.evaluate(async ({ paires, images, chauffe, poste }) => {
    const e = window.__exp
    const u = e.globe.uniforms
    const gl = e.renderer.getContext()

    // ① LE BANC PREND LA MAIN. `__R6_horloge` retient le rappel de
    // l'application : tant que le banc ne le rend pas, `tick()` ne tourne pas.
    // ⚠️ Le grain de film et les nuages sont figés en plus (`animations`), pour
    // que deux blocs consécutifs dessinent la MÊME image.
    e.params.animations = false

    const tuiles = e.globe.tiles ? e.globe.tiles.size : null
    // combien de tuiles sont réellement DESSINÉES à cette image
    let dessinees = 0
    try {
      e.globe.group.traverse((o) => { if (o.isMesh && o.visible && o.parent && o.parent.visible) dessinees++ })
    } catch { dessinees = -1 }

    const gain = u.uReliefMondeGain.value || 0.9
    const poser = (on) => {
      if (poste !== 'gain') u.uNormaleFineOn.value = on ? 1 : 0
      if (poste !== 'normale') u.uReliefMondeGain.value = on ? gain : 0
    }
    const px = new Uint8Array(4)
    const barrer = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)

    const bloc = (on) => {
      poser(on)
      barrer()
      const t0 = performance.now()
      for (let i = 0; i < images; i++) e.composer.render(0)
      barrer()
      return (performance.now() - t0) / images
    }

    // ③ LA CHAUFFE, JETÉE.
    poser(true)
    for (let i = 0; i < chauffe; i++) e.composer.render(0)
    barrer()
    // ⚠️ CE QUE LE GPU DESSINE VRAIMENT, PAR IMAGE — pas une supposition sur le
    // quadtree. ⛔ **ET `autoReset` DOIT ÊTRE COUPÉ** : `composer.render()`
    // enchaîne PLUSIEURS `renderer.render()`, et chacun remet le compteur à
    // zéro. Lu tel quel, il rendait `appels = 1` — la dernière passe plein
    // écran, et rien d'autre.
    e.renderer.info.autoReset = false
    e.renderer.info.reset()
    e.composer.render(0)
    const dessin = {
      appels: e.renderer.info.render.calls,
      triangles: e.renderer.info.render.triangles,
    }
    e.renderer.info.autoReset = true

    // ④ ⑤ ORDRE TOURNANT (ABBA) ET DIFFÉRENCES APPARIÉES.
    const diffs = [], tOn = [], tOff = []
    for (let p = 0; p < paires; p++) {
      let a, b
      if (p % 2 === 0) { b = bloc(false); a = bloc(true) }
      else { a = bloc(true); b = bloc(false) }
      tOn.push(a); tOff.push(b); diffs.push(a - b)
    }
    poser(true)

    // ══════ ⚡ LE TÉMOIN — CE BANC SAIT-IL VOIR UNE DIFFÉRENCE ? ═══════════
    //
    // ⛔ **UN Δ INDISCERNABLE NE VAUT RIEN SI L'INSTRUMENT EST AVEUGLE.** Le
    // témoin refait EXACTEMENT le même protocole apparié sur une différence
    // CONNUE : un bloc qui rend deux fois plus d'images que l'autre. Sa réponse
    // attendue est le coût d'une image entière. S'il la trouve, l'instrument
    // voit ; et son intervalle donne le plancher de bruit du banc.
    const blocDouble = (double) => {
      poser(true)
      barrer()
      const t0 = performance.now()
      for (let i = 0; i < images; i++) { e.composer.render(0); if (double) e.composer.render(0) }
      barrer()
      return (performance.now() - t0) / images
    }
    const tDiffs = []
    for (let p = 0; p < paires; p++) {
      let a, b
      if (p % 2 === 0) { b = blocDouble(false); a = blocDouble(true) } else { a = blocDouble(true); b = blocDouble(false) }
      tDiffs.push(a - b)
    }

    const moy = (x) => x.reduce((s, v) => s + v, 0) / x.length
    const et = (x) => { const m = moy(x); return Math.sqrt(x.reduce((s, v) => s + (v - m) ** 2, 0) / (x.length - 1)) }
    const med = (x) => { const y = [...x].sort((a, b) => a - b); const i = y.length >> 1; return y.length % 2 ? y[i] : (y[i - 1] + y[i]) / 2 }
    const m = moy(diffs), s = et(diffs)
    return {
      tuiles, dessinees, dessin,
      msOn: +moy(tOn).toFixed(4), msOff: +moy(tOff).toFixed(4),
      medOn: +med(tOn).toFixed(4), medOff: +med(tOff).toFixed(4),
      diffMoy: +m.toFixed(4),
      // ⚠️ **LA MÉDIANE EST LÀ PARCE QUE LA MOYENNE MENT ICI.** Un bloc sur
      // vingt paie une pause du ramasse-miettes ou un compositing de la page,
      // et une seule valeur à +30 ms déplace la moyenne de 1,5 ms. La médiane
      // des différences APPARIÉES est le chiffre qu'on lit ; la moyenne et son
      // intervalle restent affichés pour qu'on voie l'écart entre les deux.
      diffMed: +med(diffs).toFixed(4),
      // intervalle de confiance à 95 % de la MOYENNE des différences appariées
      diffIC95: +(1.96 * s / Math.sqrt(diffs.length)).toFixed(4),
      diffs: diffs.map((v) => +v.toFixed(4)),
      temoinMed: +med(tDiffs).toFixed(4),
      temoinMoy: +moy(tDiffs).toFixed(4),
      temoinIC95: +(1.96 * et(tDiffs) / Math.sqrt(tDiffs.length)).toFixed(4),
    }
  }, { paires: PAIRES, images: IMAGES, chauffe: CHAUFFE, poste: POSTE })

  r.altitude = Math.round(vraie)
  resultats.push(r)
  console.log(
    `${String(r.altitude).padStart(9)} m  tuiles=${String(r.tuiles).padStart(4)} appels=${String(r.dessin.appels).padStart(4)} tri=${String(r.dessin.triangles).padStart(8)}  ` +
    `off=${r.medOff.toFixed(3)} on=${r.medOn.toFixed(3)} ms (med)  ` +
    `Δmed=${r.diffMed >= 0 ? '+' : ''}${r.diffMed.toFixed(3)}  ` +
    `Δmoy=${r.diffMoy >= 0 ? '+' : ''}${r.diffMoy.toFixed(3)} ± ${r.diffIC95.toFixed(3)} ms/image  ` +
    `| témoin(1 image de plus) ${r.temoinMoy.toFixed(3)} ± ${r.temoinIC95.toFixed(3)}`)
}

if (SORTIE) {
  const f = path.resolve(RACINE, SORTIE)
  fs.mkdirSync(path.dirname(f), { recursive: true })
  fs.writeFileSync(f, JSON.stringify({ url, materiel, poste: POSTE, paires: PAIRES, images: IMAGES, chauffe: CHAUFFE, resultats }, null, 2))
  console.log('→ ' + f)
}
await nav.close()
