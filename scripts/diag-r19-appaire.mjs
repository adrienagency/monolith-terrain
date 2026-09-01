// R19 — ÉTAPE 6 : DEUX LIEUX, ET LE SOCLE EN VIS-À-VIS, CADRAGES APPARIÉS.
//
// ⚡ **CE QUI REND L'APPARIEMENT EXACT** : les DEUX modes conduisent le bloc avec
// la MÊME caméra de scène (`camera` + `controls.target`) — sous la sphère,
// `majCameraFond` DÉRIVE `camGlobe` d'elle par la similitude qui ancre le globe
// sur le bloc. Poser la même position et la même cible des deux côtés donne donc
// le même cadrage du bloc, sans avoir à faire correspondre deux caméras.
//
// ⛔ **ET LE PREMIER JET NE L'AVAIT PAS** : `modes.flyTo` atterrit à une distance
// qui dépend du mode, et les deux captures de La Réunion ne montraient pas le
// même morceau d'île. On force donc le cadrage APRÈS l'atterrissage.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opt = (n, d = null) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d }
const PORT = Number(opt('--port', '5563'))
const SORTIE = opt('--sortie', path.join(RACINE, '.banc/R19'))
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))

// Le cadrage APPARIÉ, en unités de bloc (le bloc fait 56 de côté, centré en 0).
// Isométrique, comme la vue d'ouverture : on voit le relief ET ses courbes.
const CADRAGE = { pos: [46, 40, 58], cible: [0, 2, 0] }
const LIEUX = [
  { nom: 'reunion', lat: -21.1151, lon: 55.5364, zoom: 12 },
  { nom: 'montblanc', lat: 45.8326, lon: 6.8652, zoom: 12 },
]

function trouverChrome() {
  const p = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((x) => fs.existsSync(x))
  if (!p) { console.error('Chrome introuvable'); process.exit(2) }
  return p
}
async function chargerPuppeteer() {
  for (const p of [path.join(RACINE, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'),
    'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
    'C:/Dev/wt-warm/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'])
    if (fs.existsSync(p)) return (await import('file:///' + p.replace(/\\/g, '/'))).default
  process.exit(2)
}

const puppeteer = await chargerPuppeteer()
const nav = await puppeteer.launch({ executablePath: trouverChrome(), headless: true, args: ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=1280,900'] })
fs.mkdirSync(SORTIE, { recursive: true })
const journal = { cadrage: CADRAGE, vues: [] }
try {
  for (const mode of [{ nom: 'sphere', q: '' }, { nom: 'socle', q: '?terre=0' }]) {
    const page = await nav.newPage()
    await page.setViewport({ width: 1280, height: 800 })
    page.on('pageerror', (er) => console.log('ERREUR PAGE', String(er.message).slice(0, 200)))
    await page.goto(`http://localhost:${PORT}/${mode.q}`, { waitUntil: 'domcontentloaded', timeout: 120000 })
    await page.waitForFunction(() => window.__exp?.modes, { timeout: 90000, polling: 100 })
    await dodo(11000)
    await page.keyboard.press('Escape')
    await dodo(2500)
    // l'interface repliée : elle mange un tiers du cadre et n'a rien à dire ici
    await page.evaluate(() => {
      window.__exp.params.animations = false
      document.body.classList.add('ce-railL-off', 'ce-railR-off')
      for (const n of document.querySelectorAll('.ce-panel, .ce-dock, .ce-rail, .ce-topbar, .ce-hud, .ce-search, .ce-bottom, header, footer, nav')) n.style.visibility = 'hidden'
    })
    await dodo(1000)
    for (const l of LIEUX) {
      await page.evaluate(async (l) => window.__exp.modes.flyTo(l.lat, l.lon, l.zoom), l)
      await dodo(17000)
      // ⚠️ LES COURBES SE POSENT APRÈS L'ATTERRISSAGE : un changement de lieu
      // recharge le MNT et repasse par le gabarit, qui éteint les courbes.
      await page.evaluate((c) => {
        const e = window.__exp
        e.params.contourOpacity = 1
        e.terrain.mapUniforms.uContourOpacity.value = 1
        e.params.contourInterval = 0.29
        e.terrain.mapUniforms.uContourInterval.value = 0.29
        e.params.animations = false
        e.camera.position.set(c.pos[0], c.pos[1], c.pos[2])
        e.controls.target.set(c.cible[0], c.cible[1], c.cible[2])
        e.controls.update()
      }, CADRAGE)
      await dodo(5000)
      const etat = await page.evaluate(() => {
        const e = window.__exp
        return {
          cam: [+e.camera.position.x.toFixed(3), +e.camera.position.y.toFixed(3), +e.camera.position.z.toFixed(3)],
          cible: [+e.controls.target.x.toFixed(3), +e.controls.target.y.toFixed(3), +e.controls.target.z.toFixed(3)],
          fov: e.camera.fov,
          opSocle: e.terrain.mapUniforms.uContourOpacity.value,
          ivSocle: e.terrain.mapUniforms.uContourInterval.value,
          opGlobe: e.globe?.uniforms?.uContourOpacity?.value ?? null,
          ivGlobe: e.globe?.uniforms?.uContourInterval?.value ?? null,
          cropOn: e.globe?.uniforms?.uCropOn?.value ?? null,
        }
      })
      const f = path.join(SORTIE, `appaire-${l.nom}-${mode.nom}.png`)
      await page.screenshot({ path: f })
      journal.vues.push({ lieu: l.nom, mode: mode.nom, etat, capture: path.basename(f) })
      console.log(`${l.nom}/${mode.nom}`, JSON.stringify(etat))
    }
    await page.close()
  }
  fs.writeFileSync(path.join(SORTIE, 'etape6-appaire.json'), JSON.stringify(journal, null, 1))
} finally { await nav.close() }
