// SONDE DU SUIVI AU CURSEUR — Tâche R10, étape 2.
//
// ⛔ **ELLE EXISTE POUR CONTREDIRE UN ÉTAT DES LIEUX, ET IL FAUT DONC QU'ELLE
// MESURE.** Le brief de R10 dit : *« La mise au point existe DÉJÀ, mais au CLIC »*.
// C'est faux depuis le commit `0cbc647` : `main.js` marche le rayon **à chaque
// image**, depuis `mouse` (posé par le `pointermove` de `window`), et amortit le
// résultat. Cette sonde le prouve **sans toucher au code** : elle envoie des
// `pointermove` à des points d'écran choisis, attend, et relit
// `params.focusDistance`.
//
// Elle rend quatre choses, et aucune n'est une supposition :
//
//   ① **LE SUIVI** — `focusDistance` en fonction de la position du curseur, à
//      caméra immobile. Si le nombre bouge avec le curseur, la mise au point
//      suit le curseur.
//   ② **LES RATÉS** — ciel, hors-carte : `focusRayHit` rend `null` et la loi
//      actuelle GARDE la dernière valeur. On le vérifie au lieu de le croire.
//   ③ **L'AMORTISSEMENT** — on décale la mise au point de force, on relâche, et
//      on chronomètre le retour à 63 / 90 / 95 %. ⚠️ **Le chiffre dépend de la
//      cadence** (la loi est `+= écart * min(1, dt*8)`) : la cadence mesurée est
//      publiée avec lui, ou le chiffre ne vaut rien.
//   ④ **LE FACTEUR DE LA SIMILITUDE `k`** — sous `?terre=unique`, ce que
//      l'utilisateur regarde est rendu par `camGlobe`, pas par `camera`. `k` dit
//      de combien les deux espaces diffèrent, donc de combien la distance
//      calculée par l'autofocus se trompe pour les pixels réellement dessinés.
//      Il est RÉSOLU sur la pose réelle de `camGlobe` (une équation du second
//      degré sur `|camGlobe|`), pas recopié d'un module.
//
// ⚠️ **ET UN COÛT, QUI EST DU CPU ET RIEN D'AUTRE.** L'avertissement de méthode
// de ce chantier — « les bancs d'ici mesurent le TEMPS DE SOUMISSION CPU,
// indiscernable du temps sans barrière » — vise les mesures GPU. Ici la marche
// de rayon est du JavaScript pur sur un échantillonneur de hauteur : le temps de
// pendule autour de N appels EST le coût, il n'y a aucune file GPU au milieu.
// C'est dit ici pour qu'on ne recopie pas une méthode faite pour autre chose.
//
// EMPLOI
//   npm run dev -- --port 5535 --strictPort
//   node scripts/sonde-flou-curseur.mjs --port 5535 --sortie .banc/R10/flou-curseur.json
//
//   npm i --no-save puppeteer-core@25.8.0   (même réserve que les autres sondes)

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = fileURLToPath(new URL('..', import.meta.url))
const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] ? A[i + 1] : d }
const PORT = Number(opt('--port', '5535'))
const SORTIE = opt('--sortie', '.banc/R10/flou-curseur.json')

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
    console.error('puppeteer-core absent : npm i --no-save puppeteer-core@25.8.0'); process.exit(2)
  }
})()

const CONFIGS = [
  { nom: 'production', requete: '' },
  { nom: 'terre-unique', requete: 'terre=unique&frontiere=1&seuil=1&globe=continu&socle=quadtree&f3=0&planete=eclairee&soleil=heure' },
]

const nav = await puppeteer.launch({
  executablePath: trouverChrome(), headless: 'new',
  args: ['--headless=new', '--hide-scrollbars', '--mute-audio', '--window-size=1280,800',
    '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-dev-shm-usage'],
})

const releve = { date: new Date().toISOString(), port: PORT, configs: [] }

for (const cfg of CONFIGS) {
  const page = await nav.newPage()
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 })
  page.on('pageerror', (e) => console.error('  [page] ' + e.message))
  const url = `http://localhost:${PORT}/` + (cfg.requete ? '?' + cfg.requete : '')
  console.log('\n→ ' + cfg.nom + ' : ' + url)
  await page.goto(url, { waitUntil: 'load', timeout: 90000 })
  await page.waitForFunction('window.__exp && window.__exp.terrain && window.__exp.terrain.sample', { timeout: 90000 })
  await new Promise((r) => setTimeout(r, 6000))
  await page.keyboard.press('Escape')
  await new Promise((r) => setTimeout(r, 14000))

  const res = await page.evaluate(async () => {
    const e = window.__exp
    const attends = (n) => new Promise((r) => { let k = n; const p = () => { if (--k <= 0) return r(); requestAnimationFrame(p) }; requestAnimationFrame(p) })
    const bouge = (x, y) => window.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, bubbles: true, isPrimary: true, pointerType: 'mouse' }))
    const distCam = () => +e.camera.position.distanceTo(e.controls.target).toFixed(3)

    // ── la cadence réelle de CE navigateur, mesurée, pas supposée
    const t0 = performance.now(); await attends(31)
    const msParImage = +((performance.now() - t0) / 30).toFixed(2)

    // ── ① LE SUIVI, à caméra immobile : on refuse la mesure si la caméra bouge
    const W = innerWidth, H = innerHeight
    const points = [[0.5, 0.15], [0.5, 0.30], [0.5, 0.45], [0.5, 0.60], [0.5, 0.75], [0.15, 0.50], [0.85, 0.50]]
    const suivi = []
    for (const [fx, fy] of points) {
      const avant = distCam()
      bouge(W * fx, H * fy)
      await attends(60)
      const apres = distCam()
      suivi.push({ x: fx, y: fy, focus: +e.params.focusDistance.toFixed(3), camDist: apres, cameraImmobile: Math.abs(apres - avant) < 1e-3 })
    }

    // ── ② LES RATÉS : le ciel, tout en haut de l'écran
    bouge(W * 0.5, H * 0.45); await attends(60)
    const avantCiel = +e.params.focusDistance.toFixed(3)
    bouge(W * 0.5, 2); await attends(60)
    const apresCiel = +e.params.focusDistance.toFixed(3)
    // hors fenêtre : plus AUCUN pointermove n'arrive, `mouse` garde sa valeur
    const apresSortie = +e.params.focusDistance.toFixed(3)

    // ── ③ L'AMORTISSEMENT
    bouge(W * 0.5, H * 0.5); await attends(60)
    const cible = e.params.focusDistance
    const depart = cible * 0.4
    e.params.focusDistance = depart
    const tA = performance.now(); const trace = []
    for (let i = 0; i < 90; i++) { await attends(1); trace.push([+(performance.now() - tA).toFixed(1), e.params.focusDistance]) }
    const seuil = (f) => { const v = depart + (cible - depart) * f; const s = trace.find((t) => t[1] >= v); return s ? s[0] : null }

    // ── ④ LE FACTEUR DE LA SIMILITUDE (n'existe que si la passe de fond est là)
    let k = null, equivalentGlobe = null
    if (e.camGlobe) {
      const R = 100, c = e.camera.position, g = e.camGlobe.position
      const a2 = c.x * c.x + c.y * c.y + c.z * c.z, b2 = 2 * R * c.y, c2 = R * R - g.lengthSq()
      k = +((-b2 + Math.sqrt(b2 * b2 - 4 * a2 * c2)) / (2 * a2)).toFixed(7)
      equivalentGlobe = +(cible * k).toFixed(4)
    }

    // ── LE COÛT DE LA MARCHE DE RAYON — CPU pur, un temps de pendule sur N appels
    const mod = await import('/src/autofocus.js')
    const cam = e.camera
    const dirs = []
    for (let i = 0; i < 32; i++) {
      const nx = (i % 8) / 4 - 0.875, ny = Math.floor(i / 8) / 2 - 0.75
      const V = new cam.position.constructor(nx, ny, 0.5)
      V.applyMatrix4(cam.projectionMatrixInverse).applyMatrix4(cam.matrixWorld)
      const d = V.sub(cam.position).normalize()
      dirs.push({ x: d.x, y: d.y, z: d.z })
    }
    const o = { x: cam.position.x, y: cam.position.y, z: cam.position.z }
    const demiCote = 28
    for (let i = 0; i < 2000; i++) mod.focusRayHit(o, dirs[i % 32], e.terrain.sample, { halfExtent: demiCote }) // chauffe
    const tB = performance.now(); const N = 20000
    let touches = 0
    for (let i = 0; i < N; i++) if (mod.focusRayHit(o, dirs[i % 32], e.terrain.sample, { halfExtent: demiCote }) != null) touches++
    const usParAppel = +(((performance.now() - tB) * 1000) / N).toFixed(2)

    return {
      msParImage,
      autoFocusParDefaut: e.params.autoFocus,
      socleVisible: !!(e.terrain && e.terrain.mesh && e.terrain.mesh.visible),
      terreUnique: !!e.terreUniqueBranchee,
      suivi,
      etendueSuivi: +(Math.max(...suivi.map((s) => s.focus)) - Math.min(...suivi.map((s) => s.focus))).toFixed(3),
      ciel: { avant: avantCiel, apres: apresCiel, gardeLaDerniere: Math.abs(apresCiel - avantCiel) < 0.01, apresSortie },
      amortissement: { depart: +depart.toFixed(3), cible: +cible.toFixed(3), t63: seuil(0.632), t90: seuil(0.9), t95: seuil(0.95), arrivee: +trace[trace.length - 1][1].toFixed(3) },
      similitude: { k, distanceAutofocus: +cible.toFixed(3), equivalentGlobe, rapport: k ? +(1 / k).toFixed(1) : null },
      coutMarche: { appels: N, usParAppel, tauxDeTouche: +(touches / N).toFixed(3), noteMethode: 'CPU pur — aucune file GPU au milieu, le temps de pendule EST le coût' },
    }
  })

  console.log('  cadence : ' + res.msParImage + ' ms/image · autoFocus par défaut : ' + res.autoFocusParDefaut + ' · socle visible : ' + res.socleVisible)
  console.log('  suivi (focusDistance selon le curseur) : étendue ' + res.etendueSuivi)
  for (const s of res.suivi) console.log('    (' + s.x + ' ; ' + s.y + ') → ' + s.focus + (s.cameraImmobile ? '' : '  ⚠ caméra en mouvement'))
  console.log('  ciel : ' + res.ciel.avant + ' → ' + res.ciel.apres + ' · garde la dernière : ' + res.ciel.gardeLaDerniere)
  console.log('  amortissement : t63 ' + res.amortissement.t63 + ' ms · t90 ' + res.amortissement.t90 + ' ms · t95 ' + res.amortissement.t95 + ' ms')
  console.log('  similitude k = ' + res.similitude.k + ' → la mise au point vaut ' + res.similitude.distanceAutofocus + ' pour ' + res.similitude.equivalentGlobe + ' unités réelles (rapport ' + res.similitude.rapport + ')')
  console.log('  marche de rayon : ' + res.coutMarche.usParAppel + ' µs/appel (' + res.coutMarche.appels + ' appels)')

  releve.configs.push({ nom: cfg.nom, url, ...res })
  await page.close()
}

await nav.close()
const cible = path.resolve(RACINE, SORTIE)
fs.mkdirSync(path.dirname(cible), { recursive: true })
fs.writeFileSync(cible, JSON.stringify(releve, null, 1), 'utf8')
console.log('\nrelevé : ' + cible)
