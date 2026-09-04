// SONDE TUILE — TEINTE : LA RAMPE EST-ELLE INVARIANTE D'UN NIVEAU À L'AUTRE ?
//
// ⚡ **LA QUESTION D'ADRIEN, ET C'EST LA MOITIÉ QUE PERSONNE N'AVAIT MESURÉE.**
// Il ne dit pas « plus floue », il dit *« une carte PLUS COLORÉE en moins bonne
// définition »*. Deux causes possibles, et elles n'ont pas le même correctif :
//   ① la RAMPE dépend du niveau — alors la couleur du même terrain saute d'un
//      niveau à l'autre, et c'est la rampe qu'il faut rendre invariante ;
//   ② la rampe est invariante, et ce qui change est l'ÉCHANTILLONNAGE : une
//      tuile grossière porte un seul raster décodé pour la hauteur ET la couleur
//      (CN1), donc un relief lissé, des normales plus plates, moins d'ombrage
//      fin — et donc une teinte plus nue à rampe identique.
//
// On mesure le même cadre, à la même altitude, en forçant la finesse du crop à
// deux niveaux voisins. ⛔ **Rien n'est dérivé du code** : on lit les PIXELS.
//
//   node scripts/sonde-tuile-teinte.mjs --port 9917 --lieu alpes --alt 600 \
//     --niveaux 13,14,15,16
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const A = process.argv.slice(2)
const opt = (n, d = null) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = Number(opt('--port', '9917'))
const LIEU = opt('--lieu', 'alpes')
const ALT = Number(opt('--alt', '600'))
const ZOOM_BLOC = Number(opt('--zoombloc', '15'))
const NIVEAUX = String(opt('--niveaux', '13,14,15,16')).split(',').map(Number)
// ⚡ **L'EXPÉRIENCE QUI DÉPARTAGE LES DEUX CAUSES.** `globe.js` fait
// `col = teintePente(col, penteSol(...), uSlopeTint)` : la COULEUR est une
// fonction de la PENTE MESURÉE, et la pente est lue sur le raster de la tuile,
// donc à SA finesse. `--slopetint 0` éteint ce terme. Si l'écart chromatique
// entre niveaux s'effondre alors, la teinte ne vient pas d'une rampe qui
// dépendrait du niveau (elle n'en dépend pas : les uniformes de rampe vivent
// dans `this.uniforms`, partagés par toutes les tuiles) mais de la pente lue sur
// un relief lissé — et le correctif n'est pas dans la rampe.
const SLOPE = opt('--slopetint', null)
const SORTIE = opt('--sortie', path.join(RACINE, '.banc', 'TUILE'))
const LARGEUR = 1280, HAUTEUR = 720
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
const LIEUX = { alpes: [45.92, 6.87], majorque: [39.62, 2.98], beauce: [48.20, 1.72], zermatt: [46.02, 7.75] }

function trouverChrome() {
  const d = opt('--chrome', process.env.CHROME_PATH)
  if (d) return d
  const t = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p))
  if (!t) { console.error('Chrome introuvable'); process.exit(2) }
  return t
}
async function chargerPuppeteer() {
  // ⚠️ `node_modules` est une JONCTION partagée ici et puppeteer n'y est pas :
  // le repli sur `wt-f3` est celui des sondes CN1 et CN4, repris tel quel.
  for (const p of [path.join(RACINE, 'node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js'), path.join(RACINE, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'), 'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js', 'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js']) if (fs.existsSync(p)) return (await import('file:///' + p.split('\\').join('/'))).default
  console.error('puppeteer-core introuvable'); process.exit(2)
}

// ── LA LECTURE DE PIXELS ────────────────────────────────────────────────────
// ⚠️ **ON LIT LE TAMPON WEBGL, PAS UNE CAPTURE PNG.** Une capture passe par le
// compositeur et par l'encodeur du navigateur ; `readPixels` rend ce que le
// nuanceur a écrit. Et on ne lit que le CARRÉ CENTRAL — le bloc — pour ne pas
// moyenner le ciel et l'interface avec le terrain.
// ⛔ **ET LA LECTURE SE FAIT APRÈS `composer.render()`, PAS APRèS
// `renderer.render()` — DEUX FAUX ZÉROS PAYÉS POUR L'APPRENDRE.**
//   ① `readPixels` appelé depuis `page.evaluate`, donc ENTRE deux images : le
//     tampon de dessin est effacé (`preserveDrawingBuffer` est faux, comme il
//     doit l'être) et les vingt relevés rendaient `n = 0` — aucune donnée.
//   ② la lecture posée dans `renderer.render` : elle tourne bien, `servi` et le
//     cache se lisent — et **les pixels sortent tous à 0**. Le produit rend dans
//     un `EffectComposer` (bloom, DOF, tonemap, SMAA) : au moment où
//     `renderer.render` retourne, la cible liée est un tampon interne, pas
//     l'écran. Une sonde « qui tourne » et rend zéro n'est pas une mesure de
//     zéro (§3 de `/threejs-optimisation`, « prouver d'abord qu'on regarde
//     quelque chose ») : ici le témoin est `n` ET la variance des pixels.
// On enveloppe donc `composer.render`, la dernière écriture de l'image.
const POSER_SONDE = `(() => {
  const e = window.__exp
  if (e.__sondeTeinte) return true
  const c = e.composer
  const brut = c.render.bind(c)
  e.__sondeTeinte = { dernier: null }
  c.render = function (dt) {
    brut(dt)
    if (!e.__sondeTeinte.demande) return
    e.__sondeTeinte.demande = false
    e.__sondeTeinte.dernier = window.__lireCentre()
  }
  return true
})()`

const LIRE_CENTRE = `(() => {
  const e = window.__exp
  const gl = e.renderer.getContext()
  const c = e.renderer.domElement
  const L = c.width, H = c.height
  const cote = Math.floor(Math.min(L, H) * 0.5)
  const x0 = Math.floor((L - cote) / 2), y0 = Math.floor((H - cote) / 2)
  const buf = new Uint8Array(cote * cote * 4)
  gl.readPixels(x0, y0, cote, cote, gl.RGBA, gl.UNSIGNED_BYTE, buf)
  let r = 0, v = 0, b = 0, sat = 0, n = 0, alpha = 0
  const hist = new Float64Array(3)
  for (let i = 0; i < cote * cote; i++) {
    const R = buf[i * 4], V = buf[i * 4 + 1], B = buf[i * 4 + 2], Al = buf[i * 4 + 3]
    // ⚠️ **ON NE FILTRE PAS SUR L'ALPHA — IL VAUT ZÉRO ICI, ET C'EST NORMAL.**
    // Premier essai : « ne compter que les pixels opaques » rendait n = 0 sur les
    // 20 images. Le tampon de dessin du produit sort avec alpha 0 (la page
    // compose la toile par-dessus son propre fond) : filtrer dessus, c'est
    // jeter l'image entière. On compte tout, et on publie l'alpha moyen pour
    // que le relevé dise dans quel régime il a été pris.
    alpha += Al
    n++; r += R; v += V; b += B
    const mx = Math.max(R, V, B), mn = Math.min(R, V, B)
    sat += mx === 0 ? 0 : (mx - mn) / mx
    hist[0] += R * R; hist[1] += V * V; hist[2] += B * B
  }
  if (!n) return null
  const moy = [r / n, v / n, b / n]
  return {
    n, cote,
    moy,
    ecartType: [Math.sqrt(hist[0] / n - moy[0] ** 2), Math.sqrt(hist[1] / n - moy[1] ** 2), Math.sqrt(hist[2] / n - moy[2] ** 2)],
    saturation: sat / n,
    alphaMoy: alpha / n,
    servi: e.globe._zCropServi, cible: e.globe._zCropCible,
    slopeTint: e.globe.uniforms.uSlopeTint.value, rampCropOn: e.globe.uniforms.uRampCropOn?.value ?? null,
    niveaux: (() => { const s = new Set(); for (const t of e.globe.tiles.values()) if (t.mesh?.visible) s.add(t.z); return [...s].sort((a, b2) => a - b2) })(),
  }
})()`

async function lancer() {
  fs.mkdirSync(SORTIE, { recursive: true })
  const puppeteer = await chargerPuppeteer()
  const nav = await puppeteer.launch({
    executablePath: trouverChrome(), headless: 'new',
    args: [`--window-size=${LARGEUR},${HAUTEUR + 120}`, '--use-angle=default', '--no-sandbox'],
    defaultViewport: { width: LARGEUR, height: HAUTEUR, deviceScaleFactor: 1 },
  })
  const page = (await nav.pages())[0] || (await nav.newPage())
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('shibumap-workmode', 'studio') } catch {} })
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForFunction('!!(window.__exp && window.__exp.globe)', { timeout: 120000 })
  await page.waitForFunction("!!document.getElementById('loading')?.classList.contains('hidden')", { timeout: 240000 })
  await page.keyboard.press('Escape'); await dodo(500)
  await page.evaluate(() => { document.body.classList.remove('ce-hub'); document.querySelector('.ce-hubveil')?.remove(); document.querySelectorAll('.ce-elemwrap').forEach((n) => n.remove()) })
  await dodo(2500)
  const [lat, lon] = LIEUX[LIEU] || LIEUX.alpes
  // ⛔ **`modes.flyTo`, PAS UN LIEN PROFOND NI `gotoCtl.go`** — le piège payé par
  // DENT : le lien profond cuit la mer VIDE et `gotoCtl.go` atterrit 32× trop
  // serré en affichant une altitude qui a l'air juste.
  await page.evaluate(async ({ la, lo, z }) => {
    const m = window.__exp.modes
    if (m.mode === 'orbital') { await m.diveTo?.({ lat: la, lon: lo }); await new Promise((r) => setTimeout(r, 3000)) }
    await m._rescale({ lat: la, lon: lo, zoom: z }, 'TUILE')
  }, { la: lat, lo: lon, z: ZOOM_BLOC })
  await dodo(4000)
  await page.evaluate(async (a) => {
    const e = window.__exp, cam = e.camera, ct = e.controls
    ct.minDistance = 1e-6; ct.maxDistance = 1e12
    const dir = cam.position.clone().sub(ct.target).normalize()
    for (let i = 0; i < 60; i++) {
      const cur = e.altitudeCadrageM()
      if (!Number.isFinite(cur) || cur <= 0) break
      const d = cam.position.distanceTo(ct.target)
      const nd = d * (a / cur)
      if (!Number.isFinite(nd) || nd <= 0) break
      cam.position.copy(ct.target).addScaledVector(dir, nd)
      ct.update?.()
      await new Promise((r) => setTimeout(r, 120))
      if (Math.abs(e.altitudeCadrageM() - a) / a < 0.004) break
    }
  }, ALT)
  await dodo(10000)

  const releves = []
  for (const Z of NIVEAUX) {
    // ⚠️ **ON FORCE LA CIBLE, PAS LE PLAFOND** : `main.js` réécrit
    // `globe.zoomCropMax` à chaque image, un plafond posé ici serait effacé au
    // rendu suivant. `_zoomCropFin` est la LOI de finesse ; la remplacer sur
    // l'instance fige la cible sans toucher au reste de la chaîne.
    await page.evaluate((z) => { window.__exp.globe._zoomCropFin = () => z }, Z)
    if (SLOPE !== null) await page.evaluate((v) => { window.__exp.globe.uniforms.uSlopeTint.value = v }, Number(SLOPE))
    // ⚠️ **PAS UN RELEVÉ SUR UNE IMAGE** (cycle de période 4) : on laisse le
    // niveau se poser, puis on moyenne 20 images consécutives.
    await dodo(14000)
    await page.evaluate(`window.__lireCentre = () => ${LIRE_CENTRE}`)
    await page.evaluate(POSER_SONDE)
    const im = []
    for (let i = 0; i < 20; i++) {
      await page.evaluate(() => { window.__exp.__sondeTeinte.dernier = null; window.__exp.__sondeTeinte.demande = true })
      await page.waitForFunction('!!window.__exp.__sondeTeinte.dernier', { timeout: 15000, polling: 50 }).catch(() => {})
      im.push(await page.evaluate(() => window.__exp.__sondeTeinte.dernier))
      await dodo(120)
    }
    const bons = im.filter(Boolean)
    if (!bons.length) {
      const diag = await page.evaluate(() => {
        const e = window.__exp
        return { sonde: !!e.__sondeTeinte, lire: typeof window.__lireCentre, essai: (() => { try { return JSON.stringify(window.__lireCentre()).slice(0, 200) } catch (err) { return 'ERREUR ' + err.message } })() }
      })
      console.error(`z${Z} : aucun relevé — ${JSON.stringify(diag)}`)
      process.exit(3)
    }
    const med = (f) => { const v = bons.map(f).sort((a, b) => a - b); return v[Math.floor(v.length / 2)] }
    const r = {
      niveau: Z,
      servi: med((i) => i.servi), cible: med((i) => i.cible),
      niveauxVisibles: bons.at(-1).niveaux,
      moy: [0, 1, 2].map((k) => med((i) => i.moy[k])),
      ecartType: [0, 1, 2].map((k) => med((i) => i.ecartType[k])),
      saturation: med((i) => i.saturation),
      images: bons.length,
    }
    releves.push(r)
    console.log(`z${Z} → servi z${r.servi} · RVB ${r.moy.map((v) => v.toFixed(2)).join(' / ')} · écart-type ${r.ecartType.map((v) => v.toFixed(2)).join(' / ')} · saturation ${r.saturation.toFixed(4)} · visibles ${JSON.stringify(r.niveauxVisibles)} · uSlopeTint ${bons.at(-1).slopeTint} · uRampCropOn ${bons.at(-1).rampCropOn}`)
    await page.screenshot({ path: path.join(SORTIE, `teinte-${LIEU}-${ALT}m-z${Z}.png`) })
  }
  console.log('\n=== ÉCART DE TEINTE ENTRE NIVEAUX VOISINS (sur 255)')
  for (let i = 1; i < releves.length; i++) {
    const a = releves[i - 1], b = releves[i]
    if (a.servi === b.servi) { console.log(`z${a.niveau} → z${b.niveau} : ⛔ INVALIDE, la finesse servie n’a pas bougé (z${a.servi})`); continue }
    const d = [0, 1, 2].map((k) => b.moy[k] - a.moy[k])
    // ⚡ **SÉPARER LA TEINTE DE LA LUMINOSITÉ, PARCE QUE LA QUESTION D'ADRIEN EST
    // LA TEINTE.** Un écart identique sur les trois canaux n'est pas « une carte
    // plus colorée » : c'est la même carte plus claire ou plus sombre. On retire
    // donc la moyenne des trois écarts — ce qui reste est le déplacement
    // CHROMATIQUE, la seule grandeur qui dirait « la rampe n'est pas invariante ».
    const lum = (d[0] + d[1] + d[2]) / 3
    const chroma = d.map((v) => v - lum)
    console.log(`z${a.servi} → z${b.servi} : ΔR ${d[0].toFixed(2)} · ΔV ${d[1].toFixed(2)} · ΔB ${d[2].toFixed(2)} · Δluminosité ${lum.toFixed(2)} · ⚡ ΔCHROMA max ${Math.max(...chroma.map(Math.abs)).toFixed(2)}/255 · Δsaturation ${(b.saturation - a.saturation).toFixed(4)} · Δcontraste ${(b.ecartType[0] - a.ecartType[0]).toFixed(2)}`)
  }
  fs.writeFileSync(path.join(SORTIE, `teinte-${LIEU}-${ALT}m.json`), JSON.stringify({ lieu: LIEU, alt: ALT, zoomBloc: ZOOM_BLOC, releves }, null, 2))
  console.log('→', path.join(SORTIE, `teinte-${LIEU}-${ALT}m.json`))
  await nav.close()
}
lancer().catch((e) => { console.error(e); process.exit(1) })
