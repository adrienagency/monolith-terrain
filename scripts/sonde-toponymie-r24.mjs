// SONDE TOPONYMIE R24 — COMBIEN D'ÉTIQUETTES SONT VIVANTES, À CINQ ALTITUDES.
//
// ⛔ Elle ne lit PAS le code. Elle compte ce qui est RÉELLEMENT à l'écran :
//   · les repères de sommet (`peaks.js`) — du DOM, donc l'`opacity` lue sur
//     l'élément, jamais `markers.length` (un marqueur hors champ existe encore) ;
//   · les cotes d'altitude (`labels.js`) — de la géométrie, donc la visibilité
//     EFFECTIVE : le produit des `visible` de toute la chaîne de parents ;
//   · les toponymes (`map/places-layer.js`) — des sprites, même règle.
//
// ⚠️ **ELLE MESURE LA HAUTEUR D'UN REPÈRE AU-DESSUS DU SOL DESSINÉ**, en
// mètres, au lieu de la supposer. Deux chemins indépendants :
// `globe.hauteurDessinee(lat, lon)` rend la hauteur que le GPU dessine ;
// `poseur.metresDe(world.y)` rend celle où le repère est planté. Leur écart est
// la seule preuve qu'un sommet n'est pas SOUS le sol — le défaut « toponymes
// plantés 1 830 m sous les Alpes » de ce chantier.
//
// ⚠️ **LE COÛT RÉSEAU SE COMPTE AU PROTOCOLE, PAS DANS LA PAGE.**
// `performance.getEntriesByType('resource')` plafonne à 250 entrées et
// sous-compterait en silence ; on écoute `response` côté Chrome.
//
// ══════════ LES DEUX MANIPULATIONS DE BANC, DÉCLARÉES ══════════════════════
//
// ⚠️ ① **`controls.maxDistance` EST DESSERRÉ POUR MONTER.** Sur cette branche,
// le dézoom est BORNÉ : `cranZoom(-1)`, `stepWider()` et une molette réelle
// (16 crans) laissent tous la vue à **z12 / 18 321 m**, mesuré. L'orbite n'est
// pas atteignable au geste ici — c'est le chantier d'un autre agent
// (`modes.js`, `zoom-continu.js`). On pose donc la caméra à la distance voulue.
// L'altitude est PROPORTIONNELLE à la distance, relevé à quatre points :
// `altM / d = 244,3 · 244,2 · 244,2 · 244,2`.
//
// ⚠️ ② **OVERPASS EST INJOIGNABLE DEPUIS CETTE MACHINE** — `Connect Timeout` sur
// les quatre adresses d'`overpass-api.de`, 502 sur `kumi.systems` et
// `private.coffee`, expiration sur `maps.mail.ru`, vérifié au node ET au Chrome.
// Sans sommets, la moitié de la mesure n'existe pas. `--sommets-simules` sert
// donc une réponse fabriquée SUR PLACE, dont les nœuds sont posés sur une grille
// de l'emprise demandée et **SANS balise `ele`** : l'altitude vient alors du MNT
// réel, par le chemin de repli que `peaks.js` emprunte déjà pour les nœuds OSM
// non cotés. Ce qui est simulé, c'est la LISTE ; l'altitude et le sol restent
// ceux du dépôt. ⛔ Aucun nom fabriqué ne sort du banc.
//
// EMPLOI
//   node scripts/sonde-toponymie-r24.mjs --port 5931 --etiquette apres --sommets-simules
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opt = (n, d = null) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d }
const PORT = Number(opt('--port', '5931'))
const SORTIE = opt('--sortie', path.join(RACINE, '.banc/R24'))
const ETIQ = opt('--etiquette', 'releve')
const SIMULE = args.includes('--sommets-simules')
const CAPTURES = args.includes('--captures')
fs.mkdirSync(SORTIE, { recursive: true })

function trouverChrome() {
  const p = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((x) => fs.existsSync(x))
  if (!p) { console.error('Chrome introuvable'); process.exit(2) }
  return p
}
async function chargerPuppeteer() {
  for (const p of [path.join(RACINE, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'),
    'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
    'C:/Dev/wt-warm/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js']) {
    if (fs.existsSync(p)) return (await import('file:///' + p.replace(/\\/g, '/'))).default
  }
  console.error('puppeteer-core introuvable'); process.exit(2)
}
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))

// ══════════ LE COMPTAGE, POSÉ DANS LA PAGE ══════════════════════════════════
function compteur() {
  const e = window.__exp
  if (!e) return 'pas de __exp'
  const visEff = (o) => { let v = o.visible, p = o.parent; while (v && p) { v = p.visible; p = p.parent } return v }
  window.__r24 = {
    // ⛔ **`opacity` SE LIT EN NOMBRE, PAS EN CHAÎNE.** Depuis R24 un repère
    // ENTRE en opacité (D18, règle 2) : comparer à la chaîne `'1'` compterait
    // zéro pendant tout le fondu, et le tableau dirait « rien à l'écran » alors
    // que la moitié de la classe est en train d'apparaître.
    sommets() {
      const L = e.peaksLayer
      if (!L) return { total: 0, vives: 0, cartouches: 0 }
      let vives = 0, cart = 0
      for (const m of L.markers) {
        const o = parseFloat(m.el.style.opacity)
        const on = !(o >= 0) ? true : o > 0
        if (on) vives++
        if (on && parseFloat(m.tag.style.opacity) > 0) cart++
      }
      return { total: L.markers.length, vives, cartouches: cart }
    },
    cotes() {
      const g = e.labels
      if (!g) return { total: 0, vives: 0, groupeVisible: false }
      const parentOk = visEff(g)
      let vives = 0
      for (const c of g.children) if (c.visible && parentOk) vives++
      return { total: g.children.length, vives, groupeVisible: parentOk, espaceGlobe: !!g.userData?.espaceGlobe, refus: g.userData?.refusCotes ?? null }
    },
    toponymes() {
      const L = e.mapLayers?.places
      if (!L) return { total: 0, vives: 0 }
      let total = 0, vives = 0
      for (const m of L.meshes || []) { if (!m.isSprite) continue; total++; if (m.visible && visEff(m)) vives++ }
      return { total, vives }
    },
    // ⚠️ **LE POSEUR SE FABRIQUE SUR PLACE QUAND `__exp` NE LE PORTE PAS.**
    // Sans ça, la version d'AVANT ne rendrait aucune mesure d'ancrage et il n'y
    // aurait rien à comparer — un tableau avant/après avec une moitié vide.
    // C'est le MÊME constructeur que la production (`poseurPourReconstruction`),
    // avec la MÊME échelle de bloc, recopiée de `main.js`.
    async poseur() {
      if (typeof e.poseurDesReperes === 'function') return e.poseurDesReperes()
      // ⛔ **PAS DE MÉMOÏSATION ICI.** Les tuiles de hauteur arrivent du réseau
      // et le zoom change entre deux relevés : un poseur gardé rendrait la
      // couverture d'il y a cinq minutes, et `refus` mentirait.
      const m = await import('/src/monde/sol-globe.js')
      const dem = e.terrain?.dem
      if (!dem || !e.globe) return null
      const cote = dem.empriseCote > 1 ? dem.empriseCote : 1
      const echelleBloc = ((56 * cote) / dem.extentMeters) * (e.globe.exaggeration ?? 1)
      // ⚠️ `globe.exaggeration` et `lireExageration(params)` sont ÉGALES sous
      // `terre unique` — c'est ce que `monde/sol-globe.js` §⑤ vérifie plutôt que
      // de le supposer.
      return m.poseurPourReconstruction({ globe: e.globe, dem, sample: e.terrain.sample, echelleBloc, actif: true })
    },
    // LA HAUTEUR AU-DESSUS DU SOL DESSINÉ, EN MÈTRES — deux chemins indépendants.
    async ancrages() {
      const L = e.peaksLayer
      const poseur = await this.poseur()
      if (!L || !poseur?.globe || !e.globe) return null
      return L.markers.map((m) => {
        const solM = e.globe.hauteurDessinee(m.lat, m.lon)
        const repM = poseur.metresDe(m.world.y)
        return {
          nom: m.name, osmM: m.ele,
          repereM: repM == null ? null : +repM.toFixed(1),
          solDessineM: solM == null ? null : +solM.toFixed(1),
          hauteurSurSolM: solM == null || repM == null ? null : +(repM - solM).toFixed(1),
        }
      })
    },
    etat() {
      return {
        mode: e.modes?.mode, altM: Math.round(e.altitudeCadrageM?.() ?? -1),
        z: e.params?.demZoom, d: +e.camera.position.length().toFixed(1),
        crop: e.globe?.baseYCrop != null,
        reperes: e.reperesAffiches?.() ?? null,
        peaksEnabled: e.params?.peaksEnabled, labelsOpt: e.params?.labels,
      }
    },
    // ⚠️ **UN RELEVÉ SUR UNE IMAGE NE PROUVE RIEN SI LE SYSTÈME OSCILLE** : le
    // désencombrement des toponymes est recalculé à 5 Hz et le ré-ancrage des
    // sommets toutes les 30 images. Vingt images consécutives, min/méd/max.
    async serie(n = 20) {
      const c = [], t = [], s = []
      for (let i = 0; i < n; i++) {
        await new Promise((r) => requestAnimationFrame(() => r()))
        c.push(this.cotes().vives); t.push(this.toponymes().vives); s.push(this.sommets().vives)
      }
      const st = (a) => { const b = [...a].sort((x, y) => x - y); return { min: b[0], med: b[(b.length / 2) | 0], max: b[b.length - 1] } }
      return { cotes: st(c), toponymes: st(t), sommets: st(s) }
    },
  }
  return 'posé'
}

const puppeteer = await chargerPuppeteer()
const nav = await puppeteer.launch({
  executablePath: trouverChrome(), headless: true,
  args: ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=1280,900'],
})
const out = { port: PORT, etiquette: ETIQ, sommetsSimules: SIMULE, quand: new Date().toISOString() }
try {
  const page = await nav.newPage()
  await page.setViewport({ width: 1280, height: 800 })

  // ── le compteur réseau, au protocole ──────────────────────────────────────
  const reseau = { total: 0, octets: 0, parFamille: {} }
  const famille = (u) => {
    if (u.includes('overpass')) return 'overpass'
    if (u.includes('/data/map/')) return 'carto'
    if (u.includes('wikipedia') || u.includes('nominatim')) return 'cartouche'
    if (u.includes('amazonaws') || /terrarium|elevation|\/tiles\//.test(u)) return 'mnt'
    if (u.includes(`localhost:${PORT}`)) return 'appli'
    return 'autre'
  }
  const compter = (u, n) => {
    const f = famille(u)
    reseau.total++; reseau.octets += n
    const e = (reseau.parFamille[f] ||= { n: 0, octets: 0 })
    e.n++; e.octets += n
  }
  page.on('response', (r) => {
    const u = r.url()
    if (u.startsWith('data:')) return
    let n = 0
    try { n = Number(r.headers()['content-length'] || 0) } catch {}
    compter(u, n)
  })

  // ── ② la réponse Overpass fabriquée, quand elle est demandée ──────────────
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('shibumap-ui-advanced', '1'); localStorage.setItem('shibumap-workmode', 'studio') } catch {} })
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction(() => window.__exp?.globe && window.__exp?.composer, { timeout: 90000, polling: 100 })
  await dodo(14000)
  await page.keyboard.press('Escape')
  // ⛔ **L'INTERCEPTION NE S'OUVRE QU'APRÈS LE DÉMARRAGE, ET C'EST MESURÉ.**
  // Posée AVANT `goto`, elle a fait expirer le chargement — 90 s dépassées,
  // `__exp` jamais posé — deux fois de suite, avec `setRequestInterception`
  // comme avec `Fetch.enable` et son motif d'URL, alors que le MÊME chargement
  // sans elle aboutit en ~25 s. En mode dev l'application tire des centaines de
  // modules ES ; le robinet ne s'ouvre donc qu'une fois la page vivante, et
  // seulement sur Overpass — les sommets sont peuplés après, à l'interrupteur.
  if (SIMULE) {
    const cdp = await page.createCDPSession()
    await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*overpass*' }] })
    cdp.on('Fetch.requestPaused', async (ev) => {
      const bbox = /\(([-\d.]+),([-\d.]+),([-\d.]+),([-\d.]+)\)/.exec(decodeURIComponent(ev.request.postData || ''))
      let elements = []
      if (bbox) {
        const [, s, o, n, e] = bbox.map(Number)
        // 25 nœuds sur une grille 5×5 dans l'emprise, SANS `ele` : l'altitude
        // vient du MNT réel, par le chemin de repli du dépôt.
        for (let i = 1; i <= 5; i++) {
          for (let j = 1; j <= 5; j++) {
            elements.push({ type: 'node', id: i * 10 + j, lat: s + ((n - s) * i) / 6, lon: o + ((e - o) * j) / 6, tags: { natural: 'peak', name: `SONDE ${i}${j}` } })
          }
        }
      }
      const body = JSON.stringify({ elements })
      compter(ev.request.url + '#simulé', Buffer.byteLength(body))
      await cdp.send('Fetch.fulfillRequest', {
        requestId: ev.requestId,
        responseCode: 200,
        responseHeaders: [{ name: 'content-type', value: 'application/json' }, { name: 'access-control-allow-origin', value: '*' }],
        body: Buffer.from(body).toString('base64'),
      }).catch(() => null)
    })
  }

  await dodo(2500)
  // mouvement ambiant coupé : le globe tourne seul à ~1,9 °/s après 3 s
  await page.evaluate(() => { window.__exp.params.animations = false })
  await dodo(1200)
  await page.evaluate(compteur)

  // les deux interrupteurs de la tâche, ALLUMÉS par leur VRAI chemin
  await page.evaluate(() => {
    const e = window.__exp
    e.params.peaksEnabled = true
    e.peaksLayer.setEnabled(true)
    e.params.labels = true
    if (typeof e.setLabelsVisible === 'function') e.setLabelsVisible(true)
  })
  await dodo(10000)
  out.depart = await page.evaluate(() => window.__r24.etat())
  console.log('départ :', JSON.stringify(out.depart))
  out.reseauApresDepart = { total: reseau.total, octets: reseau.octets }

  const releve = async (nom) => {
    const r = await page.evaluate(async () => ({
      etat: window.__r24.etat(),
      cotes: window.__r24.cotes(),
      toponymes: window.__r24.toponymes(),
      sommets: window.__r24.sommets(),
      ancrages: await window.__r24.ancrages(),
      serie: await window.__r24.serie(20),
    }))
    r.reseauCumule = { total: reseau.total, octets: reseau.octets, parFamille: JSON.parse(JSON.stringify(reseau.parFamille)) }
    out[nom] = r
    console.log(nom.padEnd(12), JSON.stringify({ alt: r.etat.altM, z: r.etat.z, crop: r.etat.crop, S: r.serie.sommets, C: r.serie.cotes, T: r.serie.toponymes }))
    if (CAPTURES) await page.screenshot({ path: path.join(SORTIE, `${ETIQ}-${nom}.png`) })
  }

  // ── la manœuvre d'altitude (voir ① en tête) ───────────────────────────────
  // altM ≈ 244,2 × distance caméra, relevé à quatre points.
  const poser = async (altVoulueM, ms = 9000) => {
    await page.evaluate((alt) => {
      const e = window.__exp
      const d = Math.max(6, alt / 244.2)
      e.controls.maxDistance = Math.max(150, d * 1.02)
      e.camera.position.setLength(d)
      e.camera.far = Math.max(e.camera.far, d * 4)
      e.camera.updateProjectionMatrix()
      e.controls.update()
    }, altVoulueM)
    await dodo(ms)
  }

  await poser(3000000, 12000); await releve('orbiteHaute')
  await poser(1000000, 10000); await releve('milleKm')
  await poser(100000, 10000); await releve('centKm')
  // le seuil du crop : la vue la plus haute que le dézoom ATTEINT tout seul
  await page.evaluate(() => { const e = window.__exp; e.controls.maxDistance = 150; e.camera.position.setLength(149); e.controls.update() })
  await dodo(12000); await releve('seuilCrop')
  // le sol : on redescend par les crans de zoom du dépôt, comme un doigt
  for (let i = 0; i < 10; i++) { await page.evaluate(() => window.__exp.modes.cranZoom(+1)); await dodo(4000) }
  await dodo(6000); await releve('sol')

  out.reseau = reseau
  console.log('réseau :', JSON.stringify(reseau))
} catch (err) {
  out.erreur = String((err && err.stack) || err)
  console.error(out.erreur)
} finally {
  await nav.close()
  fs.writeFileSync(path.join(SORTIE, `${ETIQ}.json`), JSON.stringify(out, null, 1))
  console.log('→', path.join(SORTIE, `${ETIQ}.json`))
}
