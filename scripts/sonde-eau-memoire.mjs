// SONDE MÉMOIRE DU CALQUE D'EAU — Tâche R14, étape 1.
//
// ⚠️ **LE COÛT DE CE CALQUE EST DU CPU ET DE LA MÉMOIRE, PAS DES FRAGMENTS.**
// On ne mesure donc PAS avec la méthode GPU (barrière `gl.finish()` autour
// d'une passe) : elle pèse le dessin, pas ce qu'on garde. Ce qu'on relève ici :
//
//   · octets de géométrie CPU  — somme des tampons UNIQUES tenus par le calque
//     (les attributs entrelacés de `LineSegments2` partagent un tampon : on ne
//     le compte qu'une fois, sans quoi on double le chiffre) ;
//   · octets GPU               — les mêmes tampons, téléversés une fois chacun ;
//   · appels de dessin         — A/B calque affiché / caché sur la MÊME scène
//     vivante, médiane sur N images (la machine dérive, un bloc unique ment) ;
//   · segments                 — le nombre d'instances de `LineSegments2` ;
//   · temps de reconstruction  — médiane de N reconstructions alternées.
//
// EMPLOI
//   npm run dev -- --port 5553 --strictPort
//   node scripts/sonde-eau-memoire.mjs --tours 5
//
// ⚠️ `puppeteer-core` n'est PAS dans `package.json` (réserve I3, déjà connue) :
// le script va le chercher dans les arbres voisins.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const A = process.argv.slice(2)
const opt = (n, d = null) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] ? A[i + 1] : d }
const PORT = opt('--port', '5553')
const TOURS = Number(opt('--tours', '5'))
const ZOOMS = opt('--zooms', '6,9,12').split(',').map(Number)
const ETIQUETTE = opt('--etiquette', 'avant')
const LIEUX = [
  { nom: 'Chamonix', lat: 45.9237, lon: 6.8694 },
  { nom: 'Anvers', lat: 51.2194, lon: 4.4025 },
  { nom: 'Sahara', lat: 23.5, lon: 13.0 },
]

function trouverChrome() {
  const donne = opt('--chrome', process.env.CHROME_PATH)
  if (donne) return donne
  const pistes = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome']
  const t = pistes.find((p) => fs.existsSync(p))
  if (!t) { console.error('Chrome introuvable'); process.exit(2) }
  return t
}
async function chargerPuppeteer() {
  try { return (await import('puppeteer-core')).default } catch { /* voisins */ }
  for (const p of [path.join(RACINE, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'),
    'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
    'C:/Dev/monolith-terrain/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js']) {
    if (fs.existsSync(p)) return (await import('file:///' + p.split(String.fromCharCode(92)).join('/'))).default
  }
  console.error('puppeteer-core introuvable'); process.exit(2)
}
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
const med = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s.length % 2 ? s[s.length >> 1] : (s[(s.length >> 1) - 1] + s[s.length >> 1]) / 2 }
const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10)

const SORTIE = path.join(RACINE, '.banc', 'R14')
fs.mkdirSync(SORTIE, { recursive: true })
const puppeteer = await chargerPuppeteer()
const nav = await puppeteer.launch({
  executablePath: trouverChrome(), headless: true,
  args: ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=1280,900'],
})
const releve = { quand: new Date().toISOString(), etiquette: ETIQUETTE, tours: TOURS, lignes: [] }
try {
  const page = await nav.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  page.on('console', (m) => { if (m.type() === 'error') console.log('  [page]', m.text().slice(0, 160)) })
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction(() => window.__exp?.mapLayers && window.__exp?.globe, { timeout: 90000, polling: 100 })
  await dodo(6000)
  await page.keyboard.press('Escape')
  await dodo(1500)
  // ⚠️ ANIMATIONS GELÉES : elles bougeraient le nombre d'appels de dessin entre
  // les deux moitiés de l'A/B.
  await page.evaluate(() => { window.__exp.params.animations = false })

  for (const lieu of LIEUX) {
    for (const z of ZOOMS) {
      await page.evaluate(async (a) => { await window.__exp.modes.flyTo(a.lat, a.lon, a.z) }, { lat: lieu.lat, lon: lieu.lon, z })
      await dodo(11000)
      // un tour à blanc : la première reconstruction paie le réseau (tuiles).
      await page.evaluate(() => window.__exp.rebuildMapLayers())
      await dodo(6000)

      const l = await page.evaluate(async (a) => {
        const e = window.__exp
        const eau = e.mapLayers.water
        const rendu = e.renderer

        // ── OCTETS : tampons UNIQUES, comptés une seule fois ────────────────
        const inventaire = () => {
          const vus = new Set()
          let octets = 0, segments = 0, sommetsRemplis = 0
          const objets = []
          eau.group.traverse((o) => {
            const g = o.geometry
            if (!g) return
            let mien = 0
            const compte = (arr) => {
              if (!arr) return
              const buf = arr.buffer ?? arr
              if (vus.has(buf)) return
              vus.add(buf); octets += arr.byteLength; mien += arr.byteLength
            }
            for (const nom of Object.keys(g.attributes)) {
              const at = g.attributes[nom]
              compte(at.isInterleavedBufferAttribute ? at.data.array : at.array)
            }
            if (g.index) compte(g.index.array)
            let seg = 0
            if (o.isLineSegments2 || o.isLine2) seg = g.attributes.instanceStart ? g.attributes.instanceStart.count : 0
            else if (o.isMesh) sommetsRemplis += g.attributes.position ? g.attributes.position.count : 0
            segments += seg
            objets.push({
              type: o.isLineSegments2 ? 'traits' : o.isMesh ? 'remplissage' : o.type,
              ordre: o.renderOrder,
              largeurPx: o.material?.linewidth ?? null,
              segments: seg,
              sommets: g.attributes.position ? g.attributes.position.count : null,
              octets: mien,
            })
          })
          return { octets, segments, sommetsRemplis, objets }
        }

        const mesureRebuild = async () => { const t = performance.now(); await e.rebuildMapLayers(); return performance.now() - t }

        // ── TEMPS : reconstructions répétées ────────────────────────────────
        const temps = []
        const chronos = []
        for (let i = 0; i < a.tours; i++) { temps.push(await mesureRebuild()); chronos.push(eau.chrono) }

        const inv = inventaire()

        // ── APPELS DE DESSIN : A/B affiché / caché, alterné ─────────────────
        // ⚠️ `renderer.info` se remet à zéro à CHAQUE `render()`, et le
        // compositeur en fait plusieurs par image : lu tel quel, il rend le
        // nombre d'appels de la DERNIÈRE passe (1) et pas celui de l'image.
        // On coupe donc la remise à zéro automatique et on la fait soi-même,
        // sur une frontière d'image.
        // On compte les appels sur une FENÊTRE de plusieurs images et on divise
        // par le nombre d'images comptées soi-même : l'ordre entre le rAF de la
        // sonde et celui de l'application est indécidable sur UNE image, il ne
        // pèse plus rien sur cinquante — et il s'annule de toute façon dans la
        // différence affiché / caché.
        rendu.info.autoReset = false
        const fenetre = (ms) => new Promise((res) => {
          rendu.info.reset()
          let n = 0
          const t0 = performance.now()
          const f = () => { n++; if (performance.now() - t0 >= ms) return res(rendu.info.render.calls / n); requestAnimationFrame(f) }
          requestAnimationFrame(f)
        })
        const on = [], off = []
        const etaitVisible = eau.group.visible
        for (let i = 0; i < a.tours; i++) {
          eau.group.visible = true; await fenetre(300); on.push(await fenetre(700))
          eau.group.visible = false; await fenetre(300); off.push(await fenetre(700))
        }
        eau.group.visible = etaitVisible
        rendu.info.autoReset = true

        // combien de seaux de largeur ?
        const seaux = inv.objets.filter((o) => o.type === 'traits').map((o) => o.largeurPx)

        return {
          zoom: e.params.demZoom, temps, chronos, on, off,
          octets: inv.octets, segments: inv.segments, sommetsRemplis: inv.sommetsRemplis,
          objets: inv.objets.length, detail: inv.objets, seaux,
          usingOsm: eau.usingOsm,
          geometriesRendu: rendu.info.memory.geometries,
          // ⚠️ **CE QUI PART VRAIMENT AU GPU.** three.js ne lie (et donc ne
          // téléverse) que les attributs ACTIFS du programme compilé. Si
          // `normal` n'apparaît dans les attributs d'aucun programme de
          // remplissage, alors l'attribut `normal` d'une géométrie d'eau ne
          // franchissait pas le pilote : son coût était du TAS, pas de la VRAM.
          // On le lit plutôt que de l'affirmer.
          programmes: [...rendu.info.programs].map((p) => ({ nom: p.name, attributs: Object.keys(p.getAttributes()).sort() })),
        }
      }, { tours: TOURS })

      l.lieu = lieu.nom
      l.medTemps = r1(med(l.temps))
      l.medOn = r1(med(l.on)); l.medOff = r1(med(l.off))
      l.appelsEau = r1(l.medOn - l.medOff)
      l.medChrono = {}
      for (const k of Object.keys(l.chronos[0] ?? {})) l.medChrono[k] = r1(med(l.chronos.map((c) => c[k])))
      releve.lignes.push(l)
      console.log(`${lieu.nom.padEnd(9)} z${String(l.zoom).padEnd(2)} · ${String(l.objets).padStart(2)} objets · ${String(l.seaux.length).padStart(2)} seaux · ${String(l.segments).padStart(6)} seg · ${(l.octets / 1048576).toFixed(2)} Mo · ${String(l.appelsEau).padStart(5)} appels · ${String(l.medTemps).padStart(7)} ms`)
      console.log(`             chrono  ${Object.entries(l.medChrono).map(([k, v]) => `${k} ${v}`).join(' · ')}`)
    }
  }
} finally {
  await nav.close()
  const f = path.join(SORTIE, `memoire-${ETIQUETTE}.json`)
  fs.writeFileSync(f, JSON.stringify(releve, null, 1), 'utf8')
  console.log('→', f)
}
