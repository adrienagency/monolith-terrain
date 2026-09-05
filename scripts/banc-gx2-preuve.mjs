// BANC GX2 — LA PREUVE À L'ÉCRAN : les pixels du tracé, comptés et SURLIGNÉS.
//
// ⚠️ **CE BANC EXISTE PARCE QUE LES SEPT TESTS NE PROUVENT RIEN À L'ÉCRAN.**
// L'auteur des tests le dit lui-même : ils gardent le CÂBLAGE, pas les pixels —
// un correctif simulé les rend tous verts en laissant 0 pixel affiché. La note
// se prend donc ici, au navigateur.
//
// LA MÉTHODE, héritée de `banc-gx1-position.mjs` et de ses trois faux constats :
//   ① ⛔ **jamais un comptage par COULEUR** (44 102 pixels « de tracé » sur une
//      image qui n'en a aucun — les rampes de ShibuMap sont roses et saumon).
//      On compte par DIFFÉRENCE : image avec le tracé, image sans, pixels qui
//      changent. Le témoin A/A (deux images consécutives, tracé allumé) doit
//      rendre 0.
//   ② ⛔ **jamais `composer.render()` à la main** (586 000 pixels d'écart, grain
//      coupé) : les images viennent de la boucle de l'application, capturée par
//      une FILE de rAF.
//   ③ ⛔ **jamais `page.mouse.wheel`** (le voile `.ce-elemwrap` l'avale) ni de
//      lien profond : le zoom se fait par `modes.cranZoom`.
//
// CE QU'IL PRODUIT, sous `.banc/GX2/` :
//   · `<etiq>-z<k>.png`           l'image telle qu'Adrien la voit ;
//   · `<etiq>-z<k>-surligne.png`  la MÊME image, pixels du tracé peints en vert
//     fluo — c'est la preuve visuelle qu'ils sont bien là où on les annonce ;
//   · `<etiq>.json`               tous les chiffres.
//
// EMPLOI  node scripts/banc-gx2-preuve.mjs --port 9471 [--gpx .banc/x.gpx]
//         [--etiquette x] [--adresse "terre=deux"]

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const RACINE = fileURLToPath(new URL('..', import.meta.url))
const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] ? A[i + 1] : d }
const ADRESSE = opt('--adresse', '')
const PORT = opt('--port', '9471')
const GPX = path.resolve(RACINE, opt('--gpx', '.banc/marathon-mont-blanc-90km.gpx'))
const ETIQ = opt('--etiquette', 'mb')
const SORTIE = path.resolve(RACINE, '.banc/GX2')
fs.mkdirSync(SORTIE, { recursive: true })
const PP = 'C:/Users/adrie/AppData/Local/Temp/claude/G--My-Drive--GITHUB/ed4e3ecd-eb07-4312-a4ba-d4e3ef43c3f0/scratchpad/pp/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'
const puppeteer = (await import(pathToFileURL(process.env.PUPPETEER_CORE || PP).href)).default

const nav = await puppeteer.launch({
  executablePath: opt('--chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe'), headless: 'new',
  args: ['--headless=new', '--hide-scrollbars', '--window-size=1440,1024', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'],
})
const page = await nav.newPage()
await page.setViewport({ width: 1440, height: 1024 })
const erreurs = []
page.on('pageerror', (e) => { erreurs.push(String(e.message)); console.error('  [page] ' + e.message) })
await page.goto(`http://127.0.0.1:${PORT}/${ADRESSE ? '?' + ADRESSE : ''}`, { waitUntil: 'load', timeout: 120000 })
await page.waitForFunction('window.__exp && window.__exp.gpxLayer', { timeout: 120000 })
await new Promise((r) => setTimeout(r, 8000)); await page.keyboard.press('Escape'); await new Promise((r) => setTimeout(r, 6000))

await page.evaluate(async () => {
  const e = window.__exp
  e.params.grain = 0        // ③ sans ça, deux images identiques diffèrent de ~340 000 pixels
  e.params.animations = false
  const vrai = window.requestAnimationFrame.bind(window)
  let file = []
  window.__h = { tourner: (n) => new Promise((res) => { let reste = n; const pas = () => { const lot = file; file = []; if (!lot.length) return res(false); const t = performance.now(); for (const cb of lot) cb(t); if (--reste <= 0) return res(true); vrai(pas) }; vrai(pas) }) }
  window.requestAnimationFrame = (cb) => { file.push(cb); return file.length }
  window.__c = () => e.gpxLayer.layers?.[0]?.gpx || null
  window.__lire = async (u) => { const im = await createImageBitmap(await (await fetch(u)).blob()); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; c.getContext('2d').drawImage(im, 0, 0); return { c, d: c.getContext('2d').getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height } }
  // ① la différence, et RIEN d'autre. Rend aussi l'image surlignée.
  // ⛔ **LA ZONE UTILE EXCLUT LE HUD — ET C'EST UN FAUX CONSTAT PAYÉ ICI.** À
  // mi-lecture, un relevé annonçait 2 526 « pixels de tracé » sur une image où
  // la vue 3D ne montrait QUE LE CIEL : le profil, la barre de progression et
  // les chiffres « restants » avancent entre deux captures, et éteindre le
  // calque cache aussi son bandeau de profil. On ne compte donc QUE dans le
  // rendu 3D, bandeau de course et panneaux exclus.
  window.__zone = () => {
    const z = { x0: 0, y0: 0, x1: innerWidth, y1: innerHeight }
    const bas = document.querySelector('.course-bar, .cb-root, .gpx-profile')
    if (bas) { const r = bas.getBoundingClientRect(); if (r.height > 0) z.y1 = Math.min(z.y1, r.top) }
    for (const s of ['.studio', '.panel-left', '.gpx-panel']) {
      const el = document.querySelector(s); if (!el) continue
      const r = el.getBoundingClientRect()
      if (r.width > 200 && r.left < 40) z.x0 = Math.max(z.x0, r.right)
    }
    return z
  }
  window.__diff = async (aUrl, bUrl, surligne = false) => {
    const a = await window.__lire(aUrl), b = await window.__lire(bUrl)
    const z = window.__zone()
    let n = 0, x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9
    const ctx = a.c.getContext('2d')
    const img = ctx.getImageData(0, 0, a.w, a.h)
    // le rapport pixels du tampon / pixels CSS (viewport 1440×1024 ici, donc 1)
    const s = a.w / innerWidth
    for (let i = 0; i < a.d.length; i += 4) {
      const p = i / 4, x = p % a.w, y = (p / a.w) | 0
      if (x < z.x0 * s || x >= z.x1 * s || y < z.y0 * s || y >= z.y1 * s) continue
      const k = Math.max(Math.abs(a.d[i] - b.d[i]), Math.abs(a.d[i + 1] - b.d[i + 1]), Math.abs(a.d[i + 2] - b.d[i + 2]))
      if (k > 12) {
        n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
        if (surligne) { img.data[i] = 0; img.data[i + 1] = 255; img.data[i + 2] = 90; img.data[i + 3] = 255 }
      }
    }
    let url = null
    if (surligne) { ctx.putImageData(img, 0, 0); url = a.c.toDataURL('image/png') }
    return { pixels: n, boite: n ? { x0, x1, y0, y1 } : null, surligne: url }
  }
  window.__alt = () => e.altitudeCadrageM?.() ?? null
  window.__cout = () => {
    const r = e.pilote?.renderer ?? null
    const info = window.__renderer?.info ?? null
    return { info: info ? { calls: info.render.calls, triangles: info.render.triangles, geometries: info.memory.geometries, textures: info.memory.textures } : null, r: !!r }
  }
})
// ⚠️ **UN TOUR NE DOIT JAMAIS POUVOIR PENDRE.** La file de rAF ne se vide que si
// l'application en redemande ; un onglet sans tête qui cesse de composer laisse
// la promesse en suspens et le banc s'arrête pour toujours au premier cran, sans
// rien dire. On borne, et on continue : mieux vaut un relevé bruyant qu'un banc
// qui ne rend jamais la main.
const tourner = (n) => Promise.race([
  page.evaluate((k) => window.__h.tourner(k), n),
  new Promise((r) => setTimeout(() => r('délai'), 20000)),
])
const seulementLecture = A.includes('--lecture-seule')
const snap = async () => 'data:image/png;base64,' + await page.screenshot({ encoding: 'base64' })
const ecris = (nom, dataUrl) => fs.writeFileSync(path.join(SORTIE, `${ETIQ}-${nom}.png`), Buffer.from(dataUrl.split(',')[1], 'base64'))

const gpxTexte = fs.readFileSync(GPX, 'utf8')
await page.evaluate((t) => window.__exp.loadGpxText(t), gpxTexte)
// la pose se MESURE (le drapage existe-t-il ?), elle ne se compte pas en tours
const drapePret = async () => page.evaluate(() => {
  const w = window.__c()?.track?.world
  if (!w?.length) return false
  let v = 0
  for (let i = 1; i < w.length; i++) if (Math.abs(w[i].y - w[0].y) > 1e-4) v++
  return v > w.length * 0.5
})
for (let i = 0; i < 40; i++) {
  await tourner(120); await new Promise((r) => setTimeout(r, 1500))
  if (i >= 11 && await drapePret()) break
}
// le panneau du Race Studio couvre la moitié gauche de l'écran : on le ferme,
// l'image d'Adrien est celle de la carte.
await page.evaluate(() => {
  for (const s of ['.studio-quit', '.studio .close', '.rs-close', '.studio-close']) {
    const b = document.querySelector(s); if (b) { b.click(); return s }
  }
  return null
})
await tourner(60)

const R = { etiquette: ETIQ, gpx: path.basename(GPX), adresse: ADRESSE, erreurs, crans: [], lecture: [] }
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1] }

// ── UN RELEVÉ : pixels par différence + témoin de bruit + capture surlignée ──
// ⚠️ **DEUX TOURS AVANT CHAQUE CAPTURE, PAS UN.** Avec un seul, trois relevés
// sur vingt sont sortis à EXACTEMENT 0 pixel de différence alors que le témoin
// de bruit de la même image en annonçait 2 500 : deux images identiques au
// pixel près pendant que la scène bouge, c'est une capture RENDUE DEUX FOIS, pas
// un tracé absent. Un faux zéro de plus — et exactement le genre que ce chantier
// paie depuis le début.
async function releve(nom, { image = false } = {}) {
  await tourner(2); const a = await snap()
  await tourner(2); const a2 = await snap()               // témoin A/A
  await page.evaluate(() => { window.__c().group.visible = false })
  await tourner(2); const b = await snap()
  await page.evaluate(() => { window.__c().group.visible = true })
  await tourner(2)
  const bruit = (await page.evaluate((x, y) => window.__diff(x, y), a, a2)).pixels
  const d = await page.evaluate((x, y, s) => window.__diff(x, y, s), a2, b, image)
  if (image) { ecris(nom, a2); ecris(`${nom}-surligne`, d.surligne) }
  return { nom, pixels: d.pixels, bruit, boite: d.boite, alt: await page.evaluate(() => window.__alt()) }
}

// ── ⓵ QUATRE ÉCHELLES : le tracé tient-il du cadrage large au cadrage serré ──
for (let k = 0; k < (seulementLecture ? 0 : 4); k++) {
  const r = await releve(`z${k}`, { image: true })
  const trois = []
  for (let j = 0; j < 3; j++) trois.push((await releve(`z${k}-bis`)).pixels)
  r.repetes = trois
  R.crans.push(r)
  console.log(`  cran ${k}  alt=${r.alt == null ? '—' : Math.round(r.alt) + ' m'}  tracé=${r.pixels} px  (répétés ${trois.join(' ')})  bruit=${r.bruit}`)
  // ⛔ pas `page.mouse.wheel` : le voile l'avale. `cranZoom`, comme le produit.
  await page.evaluate(() => window.__exp.modes.cranZoom?.(1))
  for (let i = 0; i < 6; i++) { await tourner(90); await new Promise((res) => setTimeout(res, 1200)) }
}

// ── ⓶ LA LECTURE : 20 relevés consécutifs, caméra figée ─────────────────────
// ⚠️ **LE SUIVI SE COUPE AVANT LE CLIC, PAS APRÈS** — voir le pavé ci-dessous.
await page.evaluate(() => {
  const e = window.__exp
  e.params.gpxFollow = false
  if (e.drone) e.drone.active = false
})
const bouton = await page.evaluate(() => {
  const b = document.querySelector('.cb-play'); if (!b) return false
  const r = b.getBoundingClientRect()
  b.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }))
  return true
})
// ⛔ **ON NE FIGE PLUS LA CAMÉRA À LA MAIN — DEUX FAUX ZÉROS PAYÉS POUR ÇA.**
// Couper `gpxFollow` et `drone.active` en plein vol de poursuite arrête la
// caméra où elle est, le nez dans le ciel ou face au versant d'à côté : vingt
// relevés sur vingt sortaient alors à **0 pixel de tracé AVEC UN TÉMOIN DE
// BRUIT À 0** — c'est-à-dire vingt captures rigoureusement identiques pendant
// que `headT` avançait de 0,145 à 0,286. Une scène qui change et une image qui
// ne change pas, ce n'est pas un tracé absent : c'est une caméra qui regarde
// ailleurs. (Vérifié à l'œil : `chamonix-apres-lecture.png` montre le tracé,
// large et net, à la fin de la même lecture.)
//
// ⚡ **LA LECTURE SE MESURE DONC EN PAUSE.** On laisse jouer avec la poursuite —
// le régime réel d'Adrien, qui garde le tracé dans le champ — puis on met en
// PAUSE avant chaque relevé : la caméra et le dévoilement sont alors immobiles,
// le plancher de bruit retombe à 0, et ce qu'on compte est bien le tracé.
const jouer = async (tours) => {
  await page.evaluate(() => window.__exp.gpxLayer.play())
  await tourner(tours)
  await page.evaluate(() => window.__exp.gpxLayer.pause())
  await tourner(3)
}

// ⛔ **ON NE VOLE PAS PENDANT QU'ON MESURE — ET C'EST LE TROISIÈME FAUX ZÉRO.**
// Deux tentatives ont figé la caméra APRÈS le décollage de la poursuite : la
// première le nez dans le ciel, la seconde dans une vallée où les 4 km déjà
// dévoilés n'entraient pas dans le champ (`mb-lecture-lect10.png`, capture
// gardée). Les deux annonçaient « 0 pixel » AVEC UN TÉMOIN DE BRUIT À 0 —
// c'est-à-dire vingt captures rigoureusement identiques : une caméra qui regarde
// ailleurs, pas un tracé absent.
//
// ⚡ **LE SUIVI EST DONC COUPÉ AVANT LE CLIC.** La caméra ne quitte plus le
// cadrage d'arrivée, le tracé ENTIER reste dans le champ, et les vingt relevés
// ne mesurent qu'UNE chose : le dévoilement avance-t-il en restant dessiné ?
// C'est mot pour mot la question du barème — « 0 image sans tracé, caméra
// figée, tracé dans le champ » — et la seule façon de la poser sans bruit.
await page.evaluate(() => {
  const e = window.__exp
  e.params.gpxFollow = false
  if (e.drone) e.drone.active = false
})
await tourner(10)
console.log(`\n  lecture lancée : ${bouton}`)
for (let i = 0; i < 20; i++) {
  // ⚠️ **DEUX RELEVÉS PAR IMAGE, ET UNE IMAGE N'EST DÉCLARÉE VIDE QUE SI LES
  // DEUX LE DISENT.** Un zéro isolé accompagné d'un témoin de bruit à 2 400
  // pixels est une contradiction : la scène bougeait, les deux captures étaient
  // identiques au pixel près — c'est la MÊME image rendue deux fois, pas un
  // tracé absent. On refuse donc de compter un zéro que sa répétition dément.
  const r = await releve(`lect${i}`, { image: i === 10 })
  const r2 = await releve(`lect${i}bis`)
  r.headT = await page.evaluate(() => window.__exp.gpxLayer.headT)
  r.confirme = r2.pixels
  R.lecture.push(r)
  console.log(`  image ${String(i).padStart(2)}  headT=${r.headT.toFixed(3)}  tracé=${r.pixels} px (bis ${r2.pixels})  bruit=${r.bruit}`)
  await jouer(20) // on relance, on avance le dévoilement, on remet en pause
}

const vides = R.lecture.filter((r) => r.pixels < 30 && r.confirme < 30).length
console.log(`\n══ VERDICT (${ETIQ}${ADRESSE ? ' · ' + ADRESSE : ''}) ══`)
console.log(`  au repos, quatre échelles : ${R.crans.map((c) => c.pixels).join(' · ')} px`)
console.log(`  en lecture, 20 relevés    : médiane ${med(R.lecture.map((r) => Math.max(r.pixels, r.confirme)))} px · IMAGES SANS TRACÉ (deux relevés concordants) : ${vides}/20`)
console.log(`  bruit (témoin A/A)        : médiane ${med([...R.crans, ...R.lecture].map((r) => r.bruit))} px`)
fs.writeFileSync(path.join(SORTIE, `${ETIQ}.json`), JSON.stringify(R, null, 1))
console.log(`\n→ .banc/GX2/${ETIQ}.json`)
await nav.close()
