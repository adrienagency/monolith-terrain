// DIAGNOSTIC DE BARRIÈRE GPU — Tâche R6, constat C1.
//
// ⛔ **CE QUI A CRÉÉ CE FICHIER.** Le rapport R6 du premier tour publiait six
// chiffres (`gl.finish()` 2,197 / 3,490 / 0,505 ms contre `readPixels(1×1)`
// 0,657 / 0,640 / 0,700) qui **n'existaient que dans un commentaire d'en-tête**
// d'un script de diagnostic qui ne contenait NI `finish`, NI `readPixels`, NI le
// moindre chronométrage. La conclusion était vraie — la relecture l'a reproduite
// — mais **la trace manquait**. Trente chiffres ont été retirés par leurs
// propres auteurs sur ce chantier ; celui-ci est mesuré ici, ou il n'est pas dit.
//
// ⚠️ **ET UN CONFLIT DE MESURE EST OUVERT SUR CE CHANTIER** : une autre tâche
// affirme que `gl.finish()` synchronise bien sur SON banc (six blocs à
// 0,445–0,455 ms, rapport 1,022). Ce script ne cherche donc pas à trancher par
// autorité : il pose **trois questions que les deux bancs peuvent rejouer**.
//
//   ① `finish` barre-t-il la route DU TOUT ? — on compare trois barrières sur
//      le MÊME bloc : `gl.finish()`, `gl.readPixels(1×1)`, et **aucune**. Une
//      barrière qui rend le même temps que « aucune » ne barre rien.
//   ② ⚡ **QUELLE PART DU TEMPS RÉEL LA BARRIÈRE CAPTURE-T-ELLE ?** C'est la
//      question décisive, et elle ne dépend d'aucune hypothèse : le temps de
//      pendule autour de N blocs, clos par une lecture de pixel franche, est
//      incompressible. Si la somme des blocs vaut 100 % de ce mur, la barrière
//      attribue tout le travail ; si elle vaut 40 %, elle en perd 60 %.
//   ③ **LA CHARGE DÉPART-ELLE LES DEUX BANCS ?** Chaque mesure est rejouée à
//      1, 2 et 4 rendus par image comptée. Si les deux barrières se rejoignent
//      à forte charge et divergent à charge faible, alors les deux bancs ne
//      mesurent pas la même chose, et **aucun des deux n'a besoin d'avoir tort**.
//
// EMPLOI
//   npm run dev -- --port 5519 --strictPort
//   node scripts/diag-barriere-gpu.mjs --sortie <fichier.json>
//
// ⚠️ **APRÈS UN `npm ci`, CE SCRIPT NE DÉMARRE PAS TOUT SEUL — RÉSERVE I3.**
// `puppeteer-core` n'est PAS dans `package.json` (c'est un outil de diagnostic,
// pas une dépendance produit). **La phrase à rejouer est :**
//     npm i --no-save puppeteer-core@25.8.0
// Chrome est cherché aux emplacements usuels ; sinon `--chrome <chemin>` ou
// `CHROME_PATH`. Les relevés, eux, sont commités : ils vivent sous
// `.superpowers/sdd/2026-08-22-globe-studio/traces-R6/`, PAS sous `.banc/`, qui
// est gitignoré (`.gitignore:44`) et ne survit pas à la fusion.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = fileURLToPath(new URL('..', import.meta.url))
const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] ? A[i + 1] : d }
const PORT = Number(opt('--port', '5519'))
const SORTIE = opt('--sortie', null)
const BLOCS = Number(opt('--blocs', '6'))
const IMAGES = Number(opt('--images', '40'))
const CHAUFFE = Number(opt('--chauffe', '40'))
const ALTITUDES = (opt('--altitudes', '2000000,40000')).split(',').map(Number)
const CHARGES = (opt('--charges', '1,2,4')).split(',').map(Number)
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
    console.error('puppeteer-core absent : npm i puppeteer-core  (ou --no-save)'); process.exit(2)
  }
})()

const nav = await puppeteer.launch({
  executablePath: trouverChrome(), headless: 'new',
  args: ['--headless=new', '--hide-scrollbars', '--mute-audio', '--window-size=1280,800',
    '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-dev-shm-usage',
    // ⚠️ Sans ces deux lignes, Chrome plafonne le rendu à la fréquence de
    // l'écran virtuel et toutes les mesures rendent le même chiffre.
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
// ⚠️ LE SAS D'ACCUEIL COUVRE L'ÉCRAN ET FIGE LA CAMÉRA — sans cet Échap, une
// sonde de ce chantier a relevé dix-neuf paliers à la même altitude.
await page.keyboard.press('Escape')
await new Promise((r) => setTimeout(r, 10000))

const materiel = await page.evaluate(() => {
  const gl = window.__exp.renderer.getContext()
  const d = gl.getExtension('WEBGL_debug_renderer_info')
  return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'inconnu'
})
console.log('matériel : ' + materiel)

// ⚠️ **LA BOUCLE DE L'APPLICATION EST CAPTURÉE DANS UNE FILE, PAS TUÉE.**
// `tick()` n'est pas le seul appelant de `requestAnimationFrame` : avec un seul
// emplacement, le dernier inscrit l'écrase et la chaîne de rendu meurt — c'est
// le défaut n° 2 que le banc de R6 a payé. Même code que
// `scripts/banc-relief-monde.mjs`, volontairement.
await page.evaluate(() => {
  if (window.__R6_horloge) return
  const vrai = window.requestAnimationFrame.bind(window)
  let file = []
  window.__R6_horloge = {
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

const resultats = []
for (const alt of ALTITUDES) {
  const vraie = await poserAltitude(alt)
  // Le quadtree doit finir de charger CE cadrage : on chronomètre une scène
  // posée, pas une scène qui se remplit.
  for (let i = 0; i < 6; i++) { await tourner(150); await new Promise((r) => setTimeout(r, 2000)) }

  const r = await page.evaluate(async ({ blocs, images, chauffe, charges }) => {
    const e = window.__exp
    const gl = e.renderer.getContext()
    const px = new Uint8Array(4)
    // ⚠️ Grain de film et nuages figés : deux blocs consécutifs doivent dessiner
    // la MÊME image, sinon on compare deux scènes.
    e.params.animations = false

    const lirePixel = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
    const BARRIERES = {
      finish: () => gl.finish(),
      pixels: lirePixel,
      aucune: () => {},
    }

    e.renderer.info.autoReset = false
    e.renderer.info.reset()
    e.composer.render(0)
    const dessin = { appels: e.renderer.info.render.calls, triangles: e.renderer.info.render.triangles }
    e.renderer.info.autoReset = true

    /**
     * Un train de `blocs` blocs de `images` images, chacun encadré par la
     * barrière à l'essai. `mur` est le temps de pendule du train ENTIER, clos
     * par une lecture de pixel franche : il ne dépend PAS de la barrière, et
     * c'est lui qui dit ce que la barrière a capturé.
     */
    const train = (nom, charge) => {
      const barre = BARRIERES[nom]
      for (let i = 0; i < chauffe; i++) e.composer.render(0)
      lirePixel()
      const mur0 = performance.now()
      const t = []
      for (let b = 0; b < blocs; b++) {
        barre()
        const t0 = performance.now()
        for (let i = 0; i < images; i++) for (let c = 0; c < charge; c++) e.composer.render(0)
        barre()
        t.push((performance.now() - t0) / images)
      }
      lirePixel()
      const mur = (performance.now() - mur0) / (blocs * images)
      const somme = t.reduce((s, v) => s + v, 0) / t.length
      return {
        blocs: t.map((v) => +v.toFixed(4)),
        moy: +somme.toFixed(4),
        min: +Math.min(...t).toFixed(4),
        max: +Math.max(...t).toFixed(4),
        rapport: +(Math.max(...t) / Math.max(Math.min(...t), 1e-9)).toFixed(3),
        mur: +mur.toFixed(4),
        // ⚡ LA PART DU TEMPS RÉEL QUE LA BARRIÈRE ATTRIBUE AUX BLOCS.
        capture: +(somme / mur).toFixed(3),
      }
    }

    const sortie = []
    for (const charge of charges) {
      // ⚠️ **ORDRE TOURNANT ET PAIRES ENTRELACÉES** : trois barrières mesurées
      // l'une après l'autre subiraient la dérive thermique dans l'ordre. On
      // rejoue donc le triplet deux fois, en inversant l'ordre.
      const a = { finish: train('finish', charge), pixels: train('pixels', charge), aucune: train('aucune', charge) }
      const b = { aucune: train('aucune', charge), pixels: train('pixels', charge), finish: train('finish', charge) }
      sortie.push({ charge, aller: a, retour: b })
    }
    return { tuiles: e.globe.tiles ? e.globe.tiles.size : null, dessin, mesures: sortie }
  }, { blocs: BLOCS, images: IMAGES, chauffe: CHAUFFE, charges: CHARGES })

  r.altitude = Math.round(vraie)
  resultats.push(r)
  console.log(`\n${r.altitude} m — ${r.tuiles} tuiles, ${r.dessin.appels} appels, ${r.dessin.triangles} triangles`)
  for (const m of r.mesures) {
    console.log(`  charge ×${m.charge}`)
    for (const sens of ['aller', 'retour']) {
      for (const nom of ['finish', 'pixels', 'aucune']) {
        const x = m[sens][nom]
        console.log(
          `    ${sens.padEnd(7)} ${nom.padEnd(7)} blocs=[${x.blocs.map((v) => v.toFixed(3)).join(' ')}]  ` +
          `moy=${x.moy.toFixed(3)} min=${x.min.toFixed(3)} max=${x.max.toFixed(3)} max/min=${x.rapport.toFixed(2)}  ` +
          `mur=${x.mur.toFixed(3)}  capture=${(x.capture * 100).toFixed(1)} %`)
      }
    }
  }
}

if (SORTIE) {
  const f = path.resolve(RACINE, SORTIE)
  fs.mkdirSync(path.dirname(f), { recursive: true })
  fs.writeFileSync(f, JSON.stringify({
    url, materiel, quand: new Date().toISOString(),
    blocs: BLOCS, images: IMAGES, chauffe: CHAUFFE, charges: CHARGES, resultats,
  }, null, 2))
  console.log('\n→ ' + f)
}
await nav.close()
