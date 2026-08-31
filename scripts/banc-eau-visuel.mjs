// LE COÛT VISUEL DU CALQUE D'EAU — Tâche R14, étapes 5 et 6.
//
// ⛔ **ALLÉGER EN DÉGRADANT L'IMAGE N'EST PAS OPTIMISER.** Ce banc capture la
// MÊME scène avant et après, sur deux lieux et deux zooms, et chiffre l'écart.
//
// ⚠️ **LE PLANCHER DE BRUIT D'ABORD, LE CHIFFRE ENSUITE.** Avant chaque
// capture, deux TÉMOINS : deux captures d'un état strictement identique, dont
// l'écart moyen par pixel est le plancher au-dessous duquel aucun écart n'est
// lisible. Les animations sont coupées (`params.animations = false`) — sans
// quoi le plancher mange le résultat.
//
// EMPLOI
//   npm run dev -- --port 5553 --strictPort
//   node scripts/banc-eau-visuel.mjs --etiquette avant
//   node scripts/banc-eau-visuel.mjs --etiquette apres
//   node scripts/banc-eau-visuel.mjs --compare avant,apres

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const A = process.argv.slice(2)
const opt = (n, d = null) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] ? A[i + 1] : d }
const PORT = opt('--port', '5553')
const ETIQUETTE = opt('--etiquette', 'avant')
const COMPARE = opt('--compare', null)
const SORTIE = path.join(RACINE, '.banc', 'R14')
fs.mkdirSync(SORTIE, { recursive: true })

const VUES = [
  { nom: 'chamonix-z6', lat: 45.9237, lon: 6.8694, zoom: 6 },
  { nom: 'chamonix-z9', lat: 45.9237, lon: 6.8694, zoom: 9 },
  { nom: 'anvers-z6', lat: 51.2194, lon: 4.4025, zoom: 6 },
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
    'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js']) {
    if (fs.existsSync(p)) return (await import('file:///' + p.split(String.fromCharCode(92)).join('/'))).default
  }
  console.error('puppeteer-core introuvable'); process.exit(2)
}
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
const b64url = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

// Le comparateur vit dans la PAGE : c'est le seul décodeur PNG dont on dispose
// sans ajouter une dépendance à un dépôt qui n'en veut pas.
const DIFF = async (deux) => {
  const lire = async (u) => {
    const i = new Image()
    await new Promise((r, j) => { i.onload = r; i.onerror = j; i.src = u })
    const c = document.createElement('canvas')
    c.width = i.width; c.height = i.height
    c.getContext('2d').drawImage(i, 0, 0)
    return c.getContext('2d').getImageData(0, 0, c.width, c.height).data
  }
  const [x, y] = [await lire(deux[0]), await lire(deux[1])]
  let s = 0, n = 0, bouges = 0, pire = 0
  for (let p = 0; p < x.length; p += 4) {
    const d = (Math.abs(x[p] - y[p]) + Math.abs(x[p + 1] - y[p + 1]) + Math.abs(x[p + 2] - y[p + 2])) / 3
    s += d; n++
    if (d > pire) pire = d
    if (d > 8) bouges++
  }
  return { ecart: +(s / n).toFixed(4), partBougee: +(bouges / n).toFixed(5), pire: +pire.toFixed(1), pixels: n }
}

const puppeteer = await chargerPuppeteer()
const nav = await puppeteer.launch({
  executablePath: trouverChrome(), headless: true,
  args: ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--hide-scrollbars', '--mute-audio', '--window-size=1280,800'],
})
try {
  const page = await nav.newPage()
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 })

  if (COMPARE) {
    // On a besoin d'une page seulement pour son décodeur d'images.
    await page.goto('about:blank')
    const [a, b] = COMPARE.split(',')
    const releve = { quand: new Date().toISOString(), a, b, vues: [] }
    for (const v of VUES) {
      const fa = path.join(SORTIE, `${a}-${v.nom}.png`)
      const fb = path.join(SORTIE, `${b}-${v.nom}.png`)
      if (!fs.existsSync(fa) || !fs.existsSync(fb)) { console.log(`${v.nom} : capture manquante`); continue }
      const d = await page.evaluate(DIFF, [
        'data:image/png;base64,' + fs.readFileSync(fa).toString('base64'),
        'data:image/png;base64,' + fs.readFileSync(fb).toString('base64'),
      ])
      releve.vues.push({ vue: v.nom, ...d })
      console.log(`${v.nom.padEnd(12)} écart moyen ${String(d.ecart).padStart(7)} · part > 8 : ${d.partBougee} · pire pixel ${d.pire}`)
    }
    fs.writeFileSync(path.join(SORTIE, `visuel-${a}-vs-${b}.json`), JSON.stringify(releve, null, 1), 'utf8')
    console.log('→', path.join(SORTIE, `visuel-${a}-vs-${b}.json`))
  } else {
    const releve = { quand: new Date().toISOString(), etiquette: ETIQUETTE, vues: [] }
    // ⚠️ **UNE SEULE PAGE, ET `flyTo` PLUTÔT QU'UN LIEN D'ÉTAT.** Le lien `#s=`
    // a été essayé d'abord : Chrome ne recharge pas un document dont SEUL le
    // fragment change, les trois vues sont revenues identiques (z10, 15 194
    // segments les trois fois). `flyTo` est la voie que `sonde-eau-memoire.mjs`
    // emploie déjà, et sa reproductibilité est vérifiée — deux exécutions
    // séparées ont rendu 451 485 sommets de remplissage au sommet près.
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 120000 })
    await page.waitForFunction(() => window.__exp?.mapLayers && window.__exp?.globe, { timeout: 90000, polling: 100 })
    await dodo(6000)
    await page.keyboard.press('Escape')
    // ⚠️ ANIMATIONS COUPÉES AVANT LES TÉMOINS, pas après : c'est ce que le
    // plancher est censé mesurer.
    await page.evaluate(() => { window.__exp.params.animations = false })
    await dodo(1500)
    for (const v of VUES) {
      await page.evaluate(async (a) => { await window.__exp.modes.flyTo(a.lat, a.lon, a.zoom) }, v)
      // ⚠️ **28 s, ET C'EST LE PLANCHER QUI L'A IMPOSÉ.** À 14 s, les deux
      // témoins de Chamonix z6 s'écartaient encore de 1,84 par pixel (pire
      // pixel 198) : ce n'était pas du bruit, c'étaient les tuiles de relief
      // qui arrivaient encore. Un plancher mal établi a déjà fait retirer un
      // chiffre juste sur ce chantier.
      await dodo(28000)
      // ══════════ CE QUE LE PREMIER TOUR A APPRIS, ET QUI A FAILLI COÛTER UN
      // FAUX RÉSULTAT ═════════════════════════════════════════════════════════
      //
      // ⛔ Premier essai : écart moyen de 7,9 à 11,0 par pixel entre « avant »
      // et « après », vingt à cent fois le plancher de bruit intra-session.
      // Lu tel quel, c'était une régression visuelle massive. **Ce n'en était
      // pas une** : un TÉMOIN (le même code, capturé dans une seconde session)
      // a rendu 7,89 / 10,10 / 10,96 — les mêmes chiffres à trois décimales.
      //
      // Deux causes, toutes deux visibles sur la capture :
      //  ① **L'HEURE DÉRIVE.** La pastille affichait 15 h 06 quand le défaut de
      //     `params.timeOfDay` vaut 10 : l'éclairage n'était pas le même d'une
      //     session à l'autre, donc l'image entière changeait.
      //  ② **LE CADRAGE NE MONTRAIT PAS L'EAU.** `flyTo` pose la caméra au ras
      //     du sol : la capture était un flanc de montagne en gros plan, sans
      //     un pixel de rivière ni de lac. On aurait comparé deux images qui ne
      //     contenaient pas le sujet.
      //
      // ➡️ On fige donc l'heure, puis on prend la vue isométrique du bloc.
      await page.evaluate(() => { window.__exp.params.timeOfDay = 10; window.__exp.applyTimeOfDay(10) })
      await dodo(1000)
      await page.evaluate(() => { window.__exp.applyIsoView(0) })
      await dodo(9000)
      await page.evaluate(() => { window.__exp.params.timeOfDay = 10; window.__exp.applyTimeOfDay(10) })
      await dodo(3000)
      const etat = await page.evaluate(() => {
        const e = window.__exp
        const eau = e.mapLayers.water
        let seg = 0, som = 0, oct = 0
        const vus = new Set()
        eau.group.traverse((o) => {
          const g = o.geometry; if (!g) return
          for (const nom of Object.keys(g.attributes)) {
            const at = g.attributes[nom]; const arr = at.isInterleavedBufferAttribute ? at.data.array : at.array
            if (vus.has(arr.buffer)) continue; vus.add(arr.buffer); oct += arr.byteLength
          }
          if (g.index && !vus.has(g.index.array.buffer)) { vus.add(g.index.array.buffer); oct += g.index.array.byteLength }
          if (o.isLineSegments2) seg += g.attributes.instanceStart?.count ?? 0
          else if (o.isMesh) som += g.attributes.position?.count ?? 0
        })
        return { zoom: e.params.demZoom, objets: eau.group.children.length, visible: eau.group.visible, segments: seg, sommetsRemplis: som, octets: oct, animations: e.params.animations, grain: e.params.grain }
      })
      // ── DEUX TÉMOINS : le plancher de bruit de CETTE vue ─────────────────
      await dodo(700)
      const t1 = 'data:image/png;base64,' + await page.screenshot({ encoding: 'base64' })
      await dodo(700)
      const t2 = 'data:image/png;base64,' + await page.screenshot({ encoding: 'base64' })
      const plancher = await page.evaluate(DIFF, [t1, t2])
      // la capture retenue est le SECOND témoin (état posé)
      fs.writeFileSync(path.join(SORTIE, `${ETIQUETTE}-${v.nom}.png`), Buffer.from(t2.split(',')[1], 'base64'))

      // ══════════ LE COÛT VISUEL, MESURÉ DANS UNE SEULE SESSION ═══════════
      //
      // ⛔ **COMPARER DEUX SESSIONS NE RÉPOND PAS À LA QUESTION.** Mesuré :
      // deux sessions du MÊME code s'écartent de 9,6 à 11,6 par pixel (voir
      // `visuel-apres-vs-temoin.json`) — le plancher inter-session est cent
      // fois le plancher intra-session, et il noie tout écart plus fin.
      //
      // ⚡ **ON POSE DONC LA QUESTION AUTREMENT, ET SANS SORTIR DE LA SESSION :
      // on REMET dans la scène vivante exactement ce que la tâche a retiré** —
      // `computeVertexNormals()` sur chaque maillage de remplissage,
      // `computeLineDistances()` sur chaque lot de traits — et on recapture. Si
      // l'image ne bouge pas plus que ses deux témoins, alors ces deux attributs
      // ne participaient à AUCUN pixel : c'est ce que la tâche affirme, mesuré
      // au lieu d'être déduit.
      const remis = await page.evaluate(() => {
        let maillages = 0, lots = 0
        window.__exp.mapLayers.water.group.traverse((o) => {
          // ⚠️ `LineSegments2` DÉRIVE DE `Mesh` : son `isMesh` vaut vrai. Tester
          // `isMesh` d'abord faisait poser des normales sur les huit sommets de
          // la boîte d'instance et laissait les lots de traits intouchés — le
          // premier tour a rendu « 8 maillages + 0 lots » et n'a donc rien dit
          // des longueurs de pointillé. L'ordre des deux tests est le résultat.
          if (o.isLineSegments2) { if (!o.geometry.attributes.instanceDistanceStart) { o.computeLineDistances(); lots++ } }
          else if (o.isMesh && !o.geometry.attributes.normal) { o.geometry.computeVertexNormals(); maillages++ }
        })
        return { maillages, lots }
      })
      await dodo(1400)
      const r1i = 'data:image/png;base64,' + await page.screenshot({ encoding: 'base64' })
      await dodo(700)
      const r2i = 'data:image/png;base64,' + await page.screenshot({ encoding: 'base64' })
      const restitution = { ...(await page.evaluate(DIFF, [t2, r2i])), ...remis }
      restitution.plancherApres = (await page.evaluate(DIFF, [r1i, r2i])).ecart

      releve.vues.push({ vue: v.nom, ...etat, plancher, restitution })
      console.log(`${v.nom.padEnd(12)} z${etat.zoom} · ${etat.objets} objets · ${etat.segments} seg · ${etat.sommetsRemplis} som · ${(etat.octets / 1048576).toFixed(2)} Mo · visible=${etat.visible} · PLANCHER ${plancher.ecart} (pire ${plancher.pire})`)
      console.log(`             restitution (${remis.maillages} maillages + ${remis.lots} lots) : écart ${restitution.ecart} · pire ${restitution.pire} · part>8 ${restitution.partBougee} · plancher après ${restitution.plancherApres}`)
    }
    fs.writeFileSync(path.join(SORTIE, `visuel-${ETIQUETTE}.json`), JSON.stringify(releve, null, 1), 'utf8')
    console.log('→', path.join(SORTIE, `visuel-${ETIQUETTE}.json`))
  }
} finally {
  await nav.close()
}
