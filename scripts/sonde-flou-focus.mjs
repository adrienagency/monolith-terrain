// SONDE DU FLOU D'ARRIÈRE-PLAN — Tâche R10, étape 1.
//
// ⛔ **LA QUESTION QU'ELLE TRANCHE, ET ELLE PASSE AVANT TOUT LE RESTE :**
// **la mise au point du bokeh change-t-elle SEULEMENT quelque chose à l'écran
// sous `?terre=unique` ?** Si elle ne change rien, faire suivre le curseur à une
// mise au point inerte serait du polissage sur un effet invisible.
//
// Elle ne suppose rien : elle fait varier `params.focusDistance` d'un extrême à
// l'autre sur la MÊME image, relit le tampon de couleur avec `readPixels`, et
// **compte les pixels qui changent**. Un témoin (deux rendus au même réglage)
// donne le plancher de bruit de la mesure — sans lui, un compteur non nul ne
// prouve rien.
//
// ⚠️ **CE QU'ELLE MESURE EST DU PIXEL, PAS DU TEMPS.** Elle ne chronomètre rien,
// donc l'avertissement de méthode de ce chantier — « les bancs d'ici mesurent le
// temps de SOUMISSION CPU » — ne s'applique pas à elle. Ce qu'elle lit est le
// contenu du tampon après `composer.render()`, c'est-à-dire le résultat, pas la
// durée.
//
// ⚠️ **TROIS CONFIGURATIONS, ET C'EST LA COMPARAISON QUI FAIT LA PREUVE.** Une
// seule mesure sous le drapeau ne dirait pas si le défaut vient du drapeau ou du
// bokeh lui-même :
//
//   ① `production`   — aucun drapeau : une seule passe de rendu, bloc plat visible ;
//   ② `frontiere`    — `?frontiere=1&terre=deux` : les deux passes ET l'effacement
//                      de profondeur, MAIS le bloc plat est encore dessiné ;
//   ③ `terre-unique` — `?frontiere=1&terre=unique` : les deux passes, et le bloc
//                      plat est éteint — ce qu'on voit est la découpe sphérique.
//
// ⚠️ **LES RÉGLAGES DU BOKEH SONT ÉPINGLÉS, ET IL LE FAUT.** `main.js` TIRE AU
// SORT `bokehScale`, `focusRange` et `autoFocus` au démarrage (le brassage du
// look) : sans épinglage, les trois configurations ne compareraient pas la même
// optique. On pose `bokehScale = 16`, `focusRange = 23`.
//
// ⚠️ **LE GRAIN EST COUPÉ PENDANT LA MESURE.** `NoiseEffect` retire un bruit neuf
// à chaque rendu : mesuré ici, il met à lui seul 60 % des pixels au-dessus du
// seuil, et noie tout. Coupé, le témoin retombe à 0 pixel — c'est ce qui rend le
// compteur lisible.
//
// EMPLOI
//   npm run dev -- --port 5535 --strictPort
//   node scripts/sonde-flou-focus.mjs --port 5535 --sortie .banc/R10/flou-focus.json
//
// ⚠️ **APRÈS UN `npm ci`, ELLE NE DÉMARRE PAS TOUTE SEULE** (même réserve que
// `scripts/diag-barriere-gpu.mjs`) : `puppeteer-core` n'est pas une dépendance
// produit. La phrase à rejouer est :
//     npm i --no-save puppeteer-core@25.8.0

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = fileURLToPath(new URL('..', import.meta.url))
const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] ? A[i + 1] : d }
const PORT = Number(opt('--port', '5535'))
const SORTIE = opt('--sortie', '.banc/R10/flou-focus.json')
const CAPTURES = opt('--captures', '.banc/R10')
const SEUIL = Number(opt('--seuil', '4')) // écart par canal au-delà duquel un pixel « a changé »
const DISTANCES = (opt('--distances', '0.5,100,130,142.26,160,200,400')).split(',').map(Number)

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
  { nom: 'frontiere', requete: 'terre=deux&frontiere=1&seuil=1&globe=continu&socle=quadtree&f3=0&planete=eclairee&soleil=heure' },
  { nom: 'terre-unique', requete: 'terre=unique&frontiere=1&seuil=1&globe=continu&socle=quadtree&f3=0&planete=eclairee&soleil=heure' },
]

const nav = await puppeteer.launch({
  executablePath: trouverChrome(), headless: 'new',
  args: ['--headless=new', '--hide-scrollbars', '--mute-audio', '--window-size=1280,800',
    '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-dev-shm-usage'],
})

const dossierCaptures = path.resolve(RACINE, CAPTURES)
fs.mkdirSync(dossierCaptures, { recursive: true })

const releve = { date: new Date().toISOString(), port: PORT, seuil: SEUIL, distances: DISTANCES, configs: [] }

for (const cfg of CONFIGS) {
  const page = await nav.newPage()
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 })
  page.on('pageerror', (e) => console.error('  [page] ' + e.message))
  const url = `http://localhost:${PORT}/` + (cfg.requete ? '?' + cfg.requete : '')
  console.log('\n→ ' + cfg.nom + ' : ' + url)
  await page.goto(url, { waitUntil: 'load', timeout: 90000 })
  await page.waitForFunction('window.__exp && window.__exp.terrain && window.__exp.terrain.sample', { timeout: 90000 })
  await new Promise((r) => setTimeout(r, 6000))
  // ⚠️ LE SAS D'ACCUEIL COUVRE L'ÉCRAN ET FIGE LA CAMÉRA (même piège que les
  // autres sondes de ce chantier) — sans cet Échap, la caméra n'est pas celle
  // que l'utilisateur regarde.
  await page.keyboard.press('Escape')
  await new Promise((r) => setTimeout(r, 12000))

  const materiel = await page.evaluate(() => {
    const gl = window.__exp.renderer.getContext()
    const d = gl.getExtension('WEBGL_debug_renderer_info')
    return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'inconnu'
  })

  // ── allumer le bokeh par l'INTERRUPTEUR DE L'INTERFACE, pas par une porte
  // dérobée : `setDofEnabled` n'est pas sur `window.__exp`, et c'est ce chemin-là
  // que l'utilisateur emprunte.
  const etat = await page.evaluate(() => {
    const e = window.__exp
    const lab = [...document.querySelectorAll('label')].find((x) => /bokeh/i.test(x.textContent || ''))
    if (!lab) return { erreur: 'interrupteur bokeh introuvable' }
    lab.parentElement.querySelector('button.ce-toggle').click()
    const passeDof = e.composer.passes.find((p) => p.effects && p.effects.some((x) => x.constructor.name === 'DepthOfFieldEffect'))
    if (!passeDof) return { erreur: 'passe DoF absente après le clic' }
    const dof = passeDof.effects.find((x) => x.constructor.name === 'DepthOfFieldEffect')
    // réglages ÉPINGLÉS : le brassage du look les tire au sort au démarrage
    e.params.bokehScale = 16; dof.bokehScale = 16
    e.params.focusRange = 23; dof.cocMaterial.worldFocusRange = 23
    // le grain repose un bruit neuf par rendu : il noierait le compteur
    const derniere = e.composer.passes[e.composer.passes.length - 1]
    const bruit = derniere.effects && derniere.effects.find((f) => f.constructor.name === 'NoiseEffect')
    if (bruit) bruit.blendMode.opacity.value = 0
    e.params.paused = true // fige nuages, mer, faune
    e.params.autoFocus = false // la mesure pilote la mise au point à la main
    window.__dof = dof
    return {
      passes: e.composer.passes.map((p) => p.constructor.name),
      socleVisible: !!(e.terrain && e.terrain.mesh && e.terrain.mesh.visible),
      terreUnique: !!e.terreUniqueBranchee,
      frontiere: !!e.frontiereActive,
      distanceCamera: +e.camera.position.distanceTo(e.controls.target).toFixed(2),
      near: e.camera.near, far: e.camera.far,
      bokehScale: e.params.bokehScale, focusRange: e.params.focusRange,
    }
  })
  if (etat.erreur) { console.error('  ⛔ ' + etat.erreur); await page.close(); continue }
  console.log('  ' + etat.passes.join(' → ') + ' | socle visible : ' + etat.socleVisible + ' | distance caméra : ' + etat.distanceCamera)

  // ── UNE ERREUR GL PAR IMAGE COMPOSÉE ? (le défaut tracé par R5)
  const gl = await page.evaluate(() => {
    const e = window.__exp
    const c = e.renderer.getContext()
    while (c.getError() !== c.NO_ERROR) { /* vider */ }
    if (e.majCameraFond) e.majCameraFond()
    e.composer.render(0.016)
    const errs = []
    let x, n = 0
    while ((x = c.getError()) !== c.NO_ERROR && n < 10) { errs.push(x); n++ }
    const info = (t) => (t ? { depthBuffer: t.depthBuffer, depthTexture: t.depthTexture ? { type: t.depthTexture.type, format: t.depthTexture.format } : null } : null)
    return { erreurs: errs, INVALID_OPERATION: c.INVALID_OPERATION, input: info(e.composer.inputBuffer), output: info(e.composer.outputBuffer) }
  })
  console.log('  erreurs GL par image composée : [' + gl.erreurs.join(', ') + '] (INVALID_OPERATION = ' + gl.INVALID_OPERATION + ')')

  // ── LE BALAYAGE
  const mesure = await page.evaluate((distances, seuil) => {
    const e = window.__exp
    const dof = window.__dof
    const c = e.renderer.getContext()
    const w = c.drawingBufferWidth, h = c.drawingBufferHeight, N = w * h
    const cliche = (fd) => {
      e.params.focusDistance = fd
      dof.cocMaterial.worldFocusDistance = fd
      if (e.majCameraFond) e.majCameraFond()
      e.composer.render(0.016); e.composer.render(0.016) // deux : la première remplit les tampons de l'effet
      const a = new Uint8Array(N * 4)
      c.readPixels(0, 0, w, h, c.RGBA, c.UNSIGNED_BYTE, a)
      return a
    }
    const ecart = (a, b) => {
      let n = 0, somme = 0, max = 0
      for (let i = 0; i < N; i++) {
        const j = i * 4
        const d = Math.max(Math.abs(a[j] - b[j]), Math.abs(a[j + 1] - b[j + 1]), Math.abs(a[j + 2] - b[j + 2]))
        if (d > seuil) n++
        somme += d
        if (d > max) max = d
      }
      return { pixels: n, pct: +(100 * n / N).toFixed(3), moyen: +(somme / N).toFixed(3), max }
    }
    const refs = distances.map(cliche)
    const lignes = [{ de: distances[0], a: 'TÉMOIN (même réglage, second rendu)', ...ecart(refs[0], cliche(distances[0])) }]
    for (let i = 1; i < refs.length; i++) lignes.push({ de: distances[0], a: distances[i], ...ecart(refs[0], refs[i]) })
    return { w, h, N, lignes }
  }, DISTANCES, SEUIL)

  for (const l of mesure.lignes) console.log('   ' + String(l.a).padEnd(38) + String(l.pixels).padStart(8) + ' px  ' + String(l.pct).padStart(7) + ' %  max ' + l.max)

  // ── LES CAPTURES : la mise au point au plus près, puis sur le relief
  const captures = []
  for (const fd of [DISTANCES[0], 142.26]) {
    await page.evaluate((v) => { window.__exp.params.focusDistance = v; window.__dof.cocMaterial.worldFocusDistance = v }, fd)
    await new Promise((r) => setTimeout(r, 700))
    const nom = `${cfg.nom}-focus-${String(fd).replace('.', '_')}.png`
    await page.screenshot({ path: path.join(dossierCaptures, nom) })
    captures.push(nom)
  }
  // et la référence SANS flou
  await page.evaluate(() => {
    const e = window.__exp
    const lab = [...document.querySelectorAll('label')].find((x) => /bokeh/i.test(x.textContent || ''))
    lab.parentElement.querySelector('button.ce-toggle').click()
  })
  await new Promise((r) => setTimeout(r, 700))
  const nomNet = `${cfg.nom}-bokeh-off.png`
  await page.screenshot({ path: path.join(dossierCaptures, nomNet) })
  captures.push(nomNet)

  releve.configs.push({ nom: cfg.nom, url, materiel, etat, gl, mesure: { taille: [mesure.w, mesure.h], lignes: mesure.lignes }, captures })
  await page.close()
}

await nav.close()

const cible = path.resolve(RACINE, SORTIE)
fs.mkdirSync(path.dirname(cible), { recursive: true })
fs.writeFileSync(cible, JSON.stringify(releve, null, 1), 'utf8')
console.log('\nrelevé : ' + cible)
console.log('captures : ' + dossierCaptures)
