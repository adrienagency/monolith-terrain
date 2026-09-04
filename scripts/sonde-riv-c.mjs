// SONDE RIV-C — LE DÉLAI JUSQU'AU PREMIER TRAIT D'EAU.
//
// RIV a mesuré POURQUOI l'eau met 13,7 s à apparaître (attente Overpass à
// vide). RIV-C mesure la GRANDEUR QU'ADRIEN RESSENT : combien de temps entre
// « je décide d'aller là » et « un trait bleu est dans la scène ».
//
// ⚠️ TROIS CHOSES QUE CETTE SONDE FAIT ET QUE LES PRÉCÉDENTES NE FAISAIENT PAS
//
// ① **UN CONTEXTE DE NAVIGATEUR NEUF PAR CAS.** Le disjoncteur d'`overpass.js`
//    (OVERPASS_PANNE_MS = 60 s) et son cache de requêtes vivent dans le REALM
//    de la page. Deux cas mesurés dans la même page : le second trouve la
//    branche Overpass déjà coupée, donc gratuite, et rend un chiffre magnifique
//    qui ne veut rien dire. C'est ce qui a rendu ce défaut insaisissable
//    pendant des mois. Un `createBrowserContext()` par cas, fermé après.
//
// ② **LA SONDE EST DANS LA BOUCLE, PAS AUTOUR.** Le premier trait d'eau est un
//    ÉTAT TRANSITOIRE : il apparaît, puis une seconde peinture le remplace.
//    Interroger la scène après coup ne rend que le dernier état. On regarde
//    donc à chaque image (`requestAnimationFrame`) si le groupe `water` porte
//    au moins un objet dessinable, et on retient le PREMIER instant.
//
// ③ **LE COMPTE DE PIXELS D'EAU STABILISÉ**, pour prouver qu'on n'a rien perdu.
//    Pas une capture d'écran (SwiftShader, tuiles de relief qui arrivent quand
//    elles veulent : deux captures ne sont jamais identiques au bit), mais la
//    signature de la GÉOMÉTRIE d'eau : nombre d'objets, de sommets, et somme
//    des positions arrondie. C'est ce que le calque met à l'écran, et c'est
//    déterministe.
//
// Usage : node scripts/sonde-riv-c.mjs --port 7431 [--etiquette avant]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const A = process.argv.slice(2)
const opt = (n, d = null) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] ? A[i + 1] : d }
const PORT = opt('--port', '7431')
const ETIQ = opt('--etiquette', 'mesure')
const REPOS = Number(opt('--repos', '80000'))
const SCENARIO = opt('--scenario', 'A') // A = vol direct · B = on est déjà là, on plonge

function trouverChrome() {
  const d = opt('--chrome', process.env.CHROME_PATH); if (d) return d
  const p = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((x) => fs.existsSync(x))
  if (!p) { console.error('Chrome introuvable'); process.exit(2) } return p
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
const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10)

// ══════ L'INSTRUMENT, POSÉ AVANT LE VOL ═════════════════════════════════════
// `__rivc.t0` est planté par le vol lui-même ; tout est relatif à lui.
const INSTRUMENT = () => {
  if (window.__rivc) return
  const eau = window.__exp.mapLayers.water
  window.__rivc = { t0: null, premierTrait: null, premierObjet: null, rebuilds: [], peintures: 0 }

  // La signature de ce que le calque met à l'écran, à un instant donné.
  window.__rivc.signature = () => {
    let objets = 0, sommets = 0, traits = 0, remplis = 0
    let somme = 0
    eau.group.traverse((x) => {
      const g = x.geometry
      if (!g) return
      objets++
      const st = g.attributes?.instanceStart
      const po = g.attributes?.position
      if (st) { traits++; sommets += st.count * 2; const a = st.array; for (let i = 0; i < a.length; i++) somme += a[i] }
      else if (po) { remplis++; sommets += po.count; const a = po.array; for (let i = 0; i < a.length; i++) somme += a[i] }
    })
    return { objets, sommets, traits, remplis, somme: Math.round(somme * 1000) / 1000 }
  }

  // ⚠️ DANS LA BOUCLE, ET ON RELÈVE LE **CREUX**, PAS SEULEMENT LE PREMIER TRAIT.
  //
  // ⛔ **LE PREMIER TRAIT EST UNE MAUVAISE GRANDEUR QUAND ON EST DÉJÀ SUR PLACE**
  // — et ça m'a fait publier un faux « pas de défaut ». Sur un plongeon z11→z13,
  // l'eau de z11 est ENCORE À L'ÉCRAN au moment où on lance le geste : la sonde
  // voit un trait à 40 ms et conclut que tout va bien. Ce que le visiteur voit,
  // lui, c'est l'eau qui S'EN VA (`_clear()` en tête de `rebuild`) et ne revient
  // qu'au bout de l'attente. La grandeur juste est donc la durée du TROU.
  window.__rivc.creux = []
  let vide = null
  const oeil = () => {
    if (window.__rivc.t0 != null) {
      const s = window.__rivc.signature()
      const t = performance.now() - window.__rivc.t0
      const plein = s.traits > 0 || s.remplis > 0
      if (plein) {
        if (window.__rivc.premierTrait == null) window.__rivc.premierTrait = t
        if (vide !== null) { window.__rivc.creux.push({ debut: vide, fin: t }); vide = null }
      } else if (vide === null) vide = t
      if (s.objets > 0 && window.__rivc.premierObjet == null) window.__rivc.premierObjet = t
    }
    requestAnimationFrame(oeil)
  }
  requestAnimationFrame(oeil)

  const vrai = eau.rebuild.bind(eau)
  eau.rebuild = async function (ctx) {
    const e = { t0: performance.now(), t1: null, osm: false, sig: null }
    window.__rivc.rebuilds.push(e)
    try { return await vrai(ctx) } finally {
      e.t1 = performance.now(); e.osm = eau.usingOsm; e.sig = window.__rivc.signature()
    }
  }
}

const LIEUX = [
  { nom: 'Rhone', lat: 45.764, lon: 4.8357 },
  { nom: 'Mississippi', lat: 29.15, lon: -89.25 },
  { nom: 'Sahara', lat: 23.4, lon: 12.6 },
]
const ZOOMS = [12, 13]

const SORTIE = path.join(RACINE, '.banc', 'RIV')
fs.mkdirSync(SORTIE, { recursive: true })
const puppeteer = await chargerPuppeteer()
const nav = await puppeteer.launch({
  executablePath: trouverChrome(), headless: true,
  args: ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=1280,900'],
})
const out = { quand: new Date().toISOString(), etiquette: ETIQ, scenario: SCENARIO, port: PORT, cas: [] }
try {
  for (const lieu of LIEUX) {
    for (const z of ZOOMS) {
      // ══ ① SESSION NEUVE : contexte de navigateur à part, jeté après ══════
      const ctx = await nav.createBrowserContext()
      const page = await ctx.newPage()
      await page.setViewport({ width: 1280, height: 800 })
      const cdp = await page.target().createCDPSession()
      await cdp.send('Network.enable')
      // ⚠️ getEntriesByType('resource') plafonne à 250 : on compte au protocole.
      const reqs = new Map(); const fini = []
      cdp.on('Network.requestWillBeSent', (e) => reqs.set(e.requestId, { url: e.request.url, t0: e.timestamp * 1000 }))
      cdp.on('Network.loadingFinished', (e) => { const r = reqs.get(e.requestId); if (r) { r.ms = e.timestamp * 1000 - r.t0; r.octets = e.encodedDataLength; fini.push(r) } })
      cdp.on('Network.loadingFailed', (e) => { const r = reqs.get(e.requestId); if (r) { r.ms = e.timestamp * 1000 - r.t0; r.octets = 0; r.echec = e.errorText; fini.push(r) } })

      await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 120000 })
      await page.waitForFunction(() => window.__exp?.mapLayers?.water, { timeout: 90000, polling: 20 })
      await page.evaluate(INSTRUMENT)
      await page.evaluate(() => { window.__exp.params.waterEnabled = true })
      // Le vol part TOUT DE SUITE : le disjoncteur est encore fermé, c'est le
      // seul instant où le défaut est visible.
      // ══ SCÉNARIO B : ON EST DÉJÀ LÀ, ON PLONGE SOUS LE SEUIL OSM ═══════
      // ⚠️ **C'EST LE SEUL SCÉNARIO OÙ LE DÉFAUT EST NU.** Sur un vol direct,
      // le trajet et l'arrivée du relief durent plus longtemps que l'attente
      // Overpass, qui se cache dedans (voir rapport-RIV-C.md). Ici on pose
      // d'abord la carte à z11 — z11 < OSM_MIN_ZOOM, donc AUCUNE requête
      // Overpass ne part, donc le disjoncteur reste FERMÉ — et l'eau est
      // dessinée. Puis on plonge à z12/z13 : la couche se reconstruit, et
      // c'est là qu'elle attendait six secondes en ayant déjà tout en main.
      // ══ SCÉNARIO C : LE SEUL QUI MET LE DÉFAUT À NU ═══════════════════
      // ⚠️ **B NE VOYAIT RIEN, ET VOICI POURQUOI — je l'ai publié faux une fois.**
      // La descente vers z11 traverse z12 : une paire de requêtes Overpass part,
      // abandonne à 6 s et OUVRE LE DISJONCTEUR pour 60 s. Tout ce qu'on mesure
      // dans la minute qui suit trouve donc la branche Overpass déjà coupée,
      // donc gratuite — 40 ms de creux, « aucun défaut ». C'est exactement le
      // piège que le brief annonçait, et il faut le payer en secondes d'attente
      // pour en sortir : on laisse le repos EXPIRER avant de plonger.
      if (SCENARIO === 'C') {
        await page.evaluate((a) => { try { window.__exp.modes.flyTo(a.lat, a.lon, 11) } catch { } }, { lat: lieu.lat, lon: lieu.lon })
        await dodo(REPOS) // > OVERPASS_PANNE_MS : le disjoncteur se referme
        await page.evaluate(() => { window.__rivc.rebuilds.length = 0 })
        await page.evaluate((a) => {
          window.__rivc.t0 = performance.now()
          window.__rivc.premierTrait = null; window.__rivc.premierObjet = null; window.__rivc.creux.length = 0
          try { window.__exp.modes.flyTo(a.lat, a.lon, a.z) } catch { }
        }, { lat: lieu.lat, lon: lieu.lon, z })
        await dodo(26000)
      } else if (SCENARIO === 'B') {
        await page.evaluate((a) => { try { window.__exp.modes.flyTo(a.lat, a.lon, 11) } catch { } }, { lat: lieu.lat, lon: lieu.lon })
        await dodo(26000)
        const avant = await page.evaluate(() => window.__rivc.signature())
        await page.evaluate(() => { window.__rivc.rebuilds.length = 0 })
        await page.evaluate((a) => {
          window.__rivc.t0 = performance.now()
          window.__rivc.premierTrait = null; window.__rivc.premierObjet = null; window.__rivc.creux.length = 0
          try { window.__exp.modes.flyTo(a.lat, a.lon, a.z) } catch { }
        }, { lat: lieu.lat, lon: lieu.lon, z })
        await dodo(26000)
        out.pose = avant
      } else {
        await page.evaluate((a) => {
          window.__rivc.t0 = performance.now()
          try { window.__exp.modes.flyTo(a.lat, a.lon, a.z) } catch { }
        }, { lat: lieu.lat, lon: lieu.lon, z })
        await dodo(32000)
      }
      const r = await page.evaluate(() => ({
        premierTrait: window.__rivc.premierTrait,
        premierObjet: window.__rivc.premierObjet,
        rebuilds: window.__rivc.rebuilds.map((e) => ({ mur: e.t1 - e.t0, depuisVol: e.t0 - window.__rivc.t0, osm: e.osm, sig: e.sig })),
        stabilise: window.__rivc.signature(),
        creux: window.__rivc.creux.map((c) => c.fin - c.debut),
        zoom: window.__exp.params.demZoom,
      }))
      const op = fini.filter((x) => /^https?:\/\/[^/]*(overpass|maps\.mail\.ru)/.test(x.url))
      const ligne = {
        lieu: lieu.nom, zoomDemande: z, zoomAtteint: r.zoom,
        premierTraitMs: r1(r.premierTrait), premierObjetMs: r1(r.premierObjet),
        plusLongCreuxMs: r.creux.length ? r1(Math.max(...r.creux)) : 0, creux: r.creux.map(r1),
        rebuilds: r.rebuilds.length,
        detail: r.rebuilds.map((e) => ({ mur: r1(e.mur), depuisVol: r1(e.depuisVol), osm: e.osm, objets: e.sig.objets, sommets: e.sig.sommets })),
        stabilise: r.stabilise,
        overpass: { n: op.length, echecs: op.filter((x) => x.echec).length, ms: op.map((x) => r1(x.ms)), octets: op.reduce((s, x) => s + (x.octets || 0), 0) },
        reseau: { n: fini.length, octets: fini.reduce((s, x) => s + (x.octets || 0), 0) },
      }
      out.cas.push(ligne)
      console.log(`── ${ligne.lieu} z${z} · premier trait ${ligne.premierTraitMs} ms · PLUS LONG CREUX ${ligne.plusLongCreuxMs} ms ${JSON.stringify(ligne.creux)} · ${ligne.rebuilds} reconstruction(s) · stabilisé ${JSON.stringify(ligne.stabilise)}`)
      console.log(`   overpass ${ligne.overpass.n} req (${ligne.overpass.echecs} échecs) ${JSON.stringify(ligne.overpass.ms)} · réseau ${ligne.reseau.n} req / ${(ligne.reseau.octets / 1e6).toFixed(1)} Mo`)
      await ctx.close()
    }
  }
} finally {
  await nav.close()
  const f = path.join(SORTIE, `riv-c-${SCENARIO}-${ETIQ}.json`)
  fs.writeFileSync(f, JSON.stringify(out, null, 1), 'utf8')
  console.log('→', f)
}
