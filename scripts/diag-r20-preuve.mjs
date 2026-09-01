// DIAG R20 ⑬ — LA PREUVE DU NOUVEAU DÉFAUT, RIEN DE FORCÉ.
//
// ⚡ **On ne pose AUCUN réglage.** L'application démarre sur son gabarit
// d'ouverture (`shibustart.json`) et on la laisse faire : ce qu'on mesure est
// exactement ce qu'Adrien verra. L'ancien ciel est rejoué par-dessus, ensuite,
// pour donner l'AVANT dans la même page et sur la même machine.
//
// ⚠️ **CINQ DISPOSITIONS PAR LIEU** : à 3–6 grappes, deux tirages du même
// réglage s'écartent plus que deux réglages (497 contre 11 628 pixels mesurés).
// Une pose unique ne prouve rien — on rend la MÉDIANE et l'étendue.
//
// ⚠️ **COMPTAGE PIXEL À PIXEL SUR LE TAMPON ENTIER**, pas une moyenne sur
// vignette : `scripts/instrument-r20-pleine.js`.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const A = process.argv.slice(2)
const opt = (n, d = null) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] ? A[i + 1] : d }
const PORT = Number(opt('--port', '5572'))
const SORTIE = opt('--sortie', path.join(RACINE, '.banc/R20/preuve'))
const GRAINES = Number(opt('--graines', '5'))
fs.mkdirSync(SORTIE, { recursive: true })

// L'ANCIEN ciel, tel qu'il était dans shibustart.json avant l'arbitrage
const ANCIEN = { cloudOpacity: 0.6, cloudAltSpread: 0.97, cloudCoverage: 0.85 }

const LIEUX = [
  { nom: 'la-reunion', lat: -21.2484, lon: 55.7666, quoi: 'ile volcanique, le lieu d ouverture' },
  { nom: 'alpes', lat: 46.6863, lon: 7.8632, quoi: 'massif continental (Interlaken)' },
  { nom: 'pacifique', lat: -8.5, lon: -140.0, quoi: 'plein ocean (au large des Marquises)' },
]

async function chargerPuppeteer() {
  for (const p of [path.join(RACINE, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'),
    'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js']) {
    if (fs.existsSync(p)) return (await import('file:///' + p.split('\\').join('/'))).default
  }
  process.exit(2)
}
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
const instrument = fs.readFileSync(path.join(RACINE, 'scripts/instrument-r20-pleine.js'), 'utf8')
const med = (a) => { const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length / 2)] }
const puppeteer = await chargerPuppeteer()
const nav = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=1280,900'] })
const out = { graines: GRAINES, ancien: ANCIEN, lieux: [] }
try {
  const page = await nav.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('shibumap-ui-advanced', '1') } catch {} })
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction(() => window.__exp?.composer, { timeout: 90000, polling: 100 })
  await dodo(18000)
  await page.keyboard.press('Escape')
  await page.evaluate(() => { window.__exp.params.animations = false })
  await dodo(2500)
  await page.evaluate(instrument)
  await dodo(800)

  // ce que l'application a VRAIMENT chargé, sans qu'on y touche
  out.auDemarrage = await page.evaluate(() => {
    const p = window.__exp.params
    return {
      cloudsEnabled: p.cloudsEnabled, cloudOpacity: p.cloudOpacity, cloudAltitude: p.cloudAltitude,
      cloudAltSpread: p.cloudAltSpread, cloudCoverage: p.cloudCoverage,
      grappes: window.__exp.clouds.sky.target, entites: window.__exp.clouds.group.children[0]?.count,
      palier: window.__palierMachine?.palier ?? null,
    }
  })
  console.log('AU DEMARRAGE (rien de force)', JSON.stringify(out.auDemarrage))

  const APRES = {
    cloudOpacity: out.auDemarrage.cloudOpacity,
    cloudAltSpread: out.auDemarrage.cloudAltSpread,
    cloudCoverage: out.auDemarrage.cloudCoverage,
  }
  out.apres = APRES

    // ⛔ **L'AVANT DOIT PORTER AUSSI L'ANCIEN BUDGET DE GRAPPES.** Rejouer les
  // seuls réglages de l'ancien gabarit sur le nouveau tableau de paliers a
  // rendu 5 grappes au lieu de 3 : c'était un AVANT qui n'a jamais existé, et
  // il flattait de moitié le point de départ. On force donc le compte d'avant
  // — round(4 × (0,65 + 0,6 × 0,18)) = 3 — pendant la série AVANT seulement.
  const serie = async (etiq, reglages, lieu, grappesForcees = null) => {
    const px = []
    const ent = []
    let cible = null
    for (let g = 0; g < GRAINES; g++) {
      const etat = await page.evaluate(([v, seed, gr]) => {
        const e = window.__exp
        if (gr) e.clouds._targetCount = () => gr
        else delete e.clouds._targetCount
        Object.assign(e.params, v, { cloudsEnabled: true, seaSeed: seed })
        e.clouds.build(e.params)
        return { cible: e.clouds.sky.target, entites: e.clouds.group.children[0]?.count }
      }, [reglages, 101 + g * 977, grappesForcees])
      await dodo(2600)
      await page.evaluate(() => window.__r20p.prendre('ON'))
      if (g === 0) await page.screenshot({ path: path.join(SORTIE, `${lieu}-${etiq}.png`) })
      await page.evaluate(() => { window.__exp.params.cloudsEnabled = false; window.__exp.clouds.setVisible(false) })
      await dodo(2000)
      await page.evaluate(() => window.__r20p.prendre('OFF'))
      await page.evaluate(() => { window.__exp.params.cloudsEnabled = true; window.__exp.clouds.setVisible(true) })
      const r = await page.evaluate(() => window.__r20p.compter('ON', 'OFF', 2))
      px.push(r.pixelsTouches)
      ent.push(etat.entites)
      cible = etat.cible
      await dodo(800)
    }
    return {
      etiq, cible, entites: ent, pixels: px,
      medianePixels: med(px), min: Math.min(...px), max: Math.max(...px),
      pourcent: +((med(px) / 1024000) * 100).toFixed(4),
    }
  }

  await page.evaluate(() => window.__r20p.prendre('P1'))
  await dodo(900)
  await page.evaluate(() => window.__r20p.prendre('P2'))
  out.plancher = await page.evaluate(() => window.__r20p.compter('P1', 'P2', 2))
  console.log('plancher', JSON.stringify(out.plancher))

  for (const L of LIEUX) {
    // ⛔ **LE DÉPLACEMENT SE PROUVE.** Un premier tour a rendu les MÊMES
    // chiffres aux trois lieux, au pixel près : `loadRealTerrain` sort tout de
    // suite si un chargement est déjà en vol (`if (demBusy) return`), et la
    // sonde mesurait trois fois La Réunion en croyant faire le tour du monde.
    // C'est le cousin exact des trois captures d'une autre tâche prises
    // au-dessus de l'Ukraine en croyant viser la Suisse.
    // ⛔ **LE DÉPLACEMENT SE PROUVE PAR LA MESURE, PAS PAR UN CHAMP.** Une
    // version de cette sonde réessayait le chargement six fois en interrogeant
    // `dem.centre` — un champ qui n'existe pas : la garde rendait toujours faux,
    // les rappels se marchaient dessus (`if (demBusy) return`), et les trois
    // lieux ont rendu les MÊMES chiffres au pixel près. **C'est le cousin exact
    // des trois captures d'une autre tâche prises au-dessus de l'Ukraine en
    // croyant viser la Suisse.** On revient donc à l'appel unique, et **c'est
    // l'écart entre les comptes de pixels qui atteste le déplacement** : trois
    // lieux qui rendent le même nombre, c'est un lieu mesuré trois fois.
    // ⛔ **`loadRealTerrain({ centreSur })` NE DÉPLACE PAS LA CARTE.** Il
    // recentre la découpe autour de `params.demLat/demLon`, qu'il ne touche
    // pas : trois lieux demandés, trois fois le même relief, et des comptes de
    // pixels identiques au pixel près. **LE point d'entrée de « on va quelque
    // part » est `modes.loadSurface(lat, lon, zoom)`** — il pose `demLat`,
    // `demLon` et `demZoom` AVANT d'appeler `fetchAndBuildDem` (main.js, et le
    // commentaire l'y écrit en toutes lettres).
    //
    // ⚠️ **ET LE DÉPLACEMENT EST VÉRIFIÉ SUR `params`**, pas supposé : une
    // version de cette sonde interrogeait `dem.centre`, un champ qui n'existe
    // pas, et concluait donc toujours à l'échec sans le dire.
    if (L.nom !== 'la-reunion') {
      // ⚠️ `modes.loadSurface` n'est PAS exposée sur `__exp.modes` — vérifié en
      // énumérant l'objet. On refait donc ce qu'elle fait : poser `demLat`,
      // `demLon`, `demZoom` **avant** le chargement. Sans ces trois lignes, la
      // découpe se recentre autour de l'ancien lieu et la carte ne bouge pas.
      await page.evaluate(async (ll) => {
        try {
          const e = window.__exp
          e.params.demLat = ll.lat
          e.params.demLon = ll.lon
          e.params.demZoom = 12
          e.params.demLocation = 'Custom'
          await e.loadRealTerrain({ centreSur: { lat: ll.lat, lon: ll.lon } })
        } catch (err) { window.__erreurLieu = String(err) }
      }, L)
      await dodo(26000)
      await page.evaluate(() => { window.__exp.params.animations = false })
      await dodo(2500)
    }
    const ou = await page.evaluate(() => ({
      lat: +Number(window.__exp.params.demLat).toFixed(3),
      lon: +Number(window.__exp.params.demLon).toFixed(3),
      zoom: window.__exp.params.demZoom,
      erreur: window.__erreurLieu ?? null,
    }))
    console.log('  position reelle du bloc :', JSON.stringify(ou))
    const avant = await serie('AVANT', ANCIEN, L.nom, 3)
    const apres = await serie('APRES', APRES, L.nom)
    out.lieux.push({
      ...L, positionReelle: ou, avant, apres,
      gain: avant.medianePixels ? +(apres.medianePixels / avant.medianePixels).toFixed(2) : null,
    })
    console.log('LIEU', L.nom,
      '| AVANT', avant.cible, 'grappes,', avant.medianePixels, 'px', avant.pourcent + '%', JSON.stringify([avant.min, avant.max]),
      '| APRES', apres.cible, 'grappes,', apres.medianePixels, 'px', apres.pourcent + '%', JSON.stringify([apres.min, apres.max]))
  }

  // ⚠️ **LE PEUPLEMENT MET DU TEMPS À CONVERGER.** Un premier tour lisait le
  // compte d'entités dans la foulée de `setTier` et rendait 27 aux QUATRE
  // paliers : la cible avait changé, les entités pas encore. On laisse donc la
  // simulation redescendre entre deux paliers.
  // ⚠️ **LE PEUPLEMENT MET DU TEMPS À CONVERGER**, et un premier tour a rendu
  // 27 entités aux QUATRE paliers : la cible avait changé, les entités pas
  // encore. On reconstruit le ciel à chaque palier et on laisse la simulation
  // redescendre. ⚡ La CIBLE, elle, est une loi pure — `cloudCountForTier` —
  // et `test/nuages-globe.test.js` la tient déjà sans navigateur.
  // ⛔ **LA BOUCLE DE RENDU RÉIMPOSE LE PALIER À CHAQUE IMAGE** :
  // `clouds.setTier?.(aq?.tier ?? 0)` (main.js). Écrire `clouds._tier` depuis
  // une sonde ne tient donc pas une image — les quatre paliers ont rendu 6
  // grappes et un `_tier` relu à 0. **C'est le troisième membre de la même
  // famille**, après `setVisible` que `majNuagesGlobe` rallume et
  // `cloudCoverage` poussé à l'envers. On écrit donc à la SOURCE, `aq.tier`.
  out.paliers = []
  for (const t of [0, 1, 2, 3]) {
    await page.evaluate((x) => {
      const e = window.__exp
      delete e.clouds._targetCount
      // ⚠️ `aq.tier` est réécrit par le gouverneur : on passe par SA méthode.
      if (e.aq?.setTier) e.aq.setTier(x)
      e.clouds.setTier(x)
      e.clouds.build(e.params)
    }, t)
    await dodo(4500)
    const r = await page.evaluate(() => ({
      tier: window.__exp.clouds._tier,
      grappes: window.__exp.clouds.sky.target,
      entites: window.__exp.clouds.group.children[0]?.count ?? null,
    }))
    out.paliers.push({ palier: t, ...r })
    console.log('  palier', t, JSON.stringify(r))
  }
  await page.evaluate(() => { const e = window.__exp; if (e.aq) e.aq.tier = 0; e.clouds.setTier(0); e.clouds.build(e.params) })
} catch (err) {
  out.erreur = String(err?.stack || err)
  console.error(out.erreur)
} finally {
  fs.writeFileSync(path.join(SORTIE, 'diag-preuve.json'), JSON.stringify(out, null, 1))
  await nav.close()
}
