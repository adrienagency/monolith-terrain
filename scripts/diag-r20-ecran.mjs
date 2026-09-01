// DIAG R20 ④ — LE CIEL EST-IL À L'ÉCRAN, ET QUE FAIT CHAQUE CURSEUR ?
//
// ⛔ **AVANT LE RELOGEMENT, CE BANC RENDAIT 0,000 / 0,000 À 18 km** : le volume
// était allumé, peuplé de 16 instances, et dessiné dans un tampon que personne
// ne regarde. Cette sonde repose la MÊME question, avec le MÊME instrument
// (`scripts/instrument-r20.js`, condensé 256 × 160, moyenne et gradient).
//
// ⚠️ **TROIS PIÈGES D'INSTRUMENT, TOUS MESURÉS SUR CE CHANTIER** :
//   · un condensé trop grossier ANNULE un motif fin (64 × 40 ratait des
//     crêtes ; 256 × 160 + gradient les voit) — d'où l'instrument partagé ;
//   · **le mouvement ambiant fait un plancher de 0,3693 qui tombe à 0,0000 une
//     fois coupé** — `params.animations = false`, et on le VÉRIFIE en mesurant
//     l'écart d'une image à elle-même avant de mesurer quoi que ce soit ;
//   · **le globe tourne seul à ~2 °/s** après 3 s — trois captures d'une autre
//     tâche ont été prises au-dessus de l'Ukraine en croyant viser la Suisse.
//
// ⚠️ **ET LES CURSEURS SE POUSSENT PAR LE DOM**, pas par `params` : certains ne
// commitent qu'au RELÂCHEMENT (`change`), et écrire `params.x` directement
// testerait un chemin qu'Adrien n'emprunte jamais. On envoie donc `input` PUIS
// `change`, et on relit `params` pour vérifier que la valeur a bien pris.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opt = (n, d = null) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d }
const PORT = Number(opt('--port', '5565'))
const SORTIE = opt('--sortie', path.join(RACINE, '.banc/R20/ecran'))
const SEUL = opt('--seul', null)
fs.mkdirSync(SORTIE, { recursive: true })

function trouverChrome() {
  const p = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find((x) => fs.existsSync(x))
  if (!p) { console.error('Chrome introuvable'); process.exit(2) }
  return p
}
async function chargerPuppeteer() {
  for (const p of [path.join(RACINE, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'),
    'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
    'C:/Dev/monolith-terrain/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js']) {
    if (fs.existsSync(p)) return (await import('file:///' + p.split('\\').join('/'))).default
  }
  console.error('puppeteer-core introuvable'); process.exit(2)
}
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
const instrument = fs.readFileSync(path.join(RACINE, 'scripts/instrument-r20.js'), 'utf8')

// LES QUINZE CURSEURS, PAR ORDRE DE VALEUR VISUELLE ATTENDUE. `cle` est le nom
// dans `params` ; `de`/`a` sont les deux bouts qu'on compare — le défaut, puis
// une valeur franche dans la plage ACTUELLE (les échelles ont changé : hériter
// d'anciennes valeurs donne un rendu qui a l'air d'une régression).
const CURSEURS = [
  { cle: 'cloudsEnabled', de: true, a: false, nom: '01-interrupteur' },
  { cle: 'cloudCoverage', de: 0.85, a: 2.4, nom: '02-couverture' },
  { cle: 'cloudOpacity', de: 0.6, a: 2.2, nom: '03-opacite' },
  { cle: 'cloudAltitude', de: 13.5, a: 5.0, nom: '04-altitude' },
  { cle: 'cloudBillow', de: 1.05, a: 2.9, nom: '05-bourgeonnement' },
  { cle: 'cloudScale', de: 5, a: 1.2, nom: '06-grain' },
  { cle: 'cloudBrightness', de: 5, a: 1.0, nom: '07-luminosite' },
  { cle: 'cloudContrast', de: 2.5, a: 0.4, nom: '08-contraste' },
  { cle: 'cloudTexMix', de: 0.4, a: 1.0, nom: '09-coton' },
  { cle: 'cloudSSS', de: 2, a: 0.0, nom: '10-translucidite' },
  { cle: 'cloudAltSpread', de: 0.97, a: 0.1, nom: '11-etalement' },
  { cle: 'windDir', de: 7, a: 200, nom: '12-direction-vent' },
  { cle: 'windSpeed', de: 1.7, a: 6.0, nom: '13-force-vent' },
  { cle: 'cloudDrift', de: 0.5, a: 2.0, nom: '14-derive' },
  { cle: 'cloudDriftVar', de: 1, a: 0.0, nom: '15-variation-derive' },
]

const puppeteer = await chargerPuppeteer()
const nav = await puppeteer.launch({ executablePath: trouverChrome(), headless: true, args: ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=1280,900'] })
const out = { curseurs: [], altitudes: [] }
try {
  const page = await nav.newPage()
  page.on('pageerror', (e) => { (out.erreursPage ??= []).push(String(e)) })
  await page.setViewport({ width: 1280, height: 800 })
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('shibumap-ui-advanced', '1'); localStorage.setItem('shibumap-workmode', 'studio') } catch {} })
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction(() => window.__exp?.globe && window.__exp?.composer, { timeout: 90000, polling: 100 })
  await dodo(12000)
  await page.keyboard.press('Escape')
  // ⛔ LE PLANCHER DE BRUIT : sans ça, 0,3693 d'écart ambiant noie tout.
  await page.evaluate(() => { window.__exp.params.animations = false })
  await dodo(2000)
  await page.evaluate(instrument)
  await dodo(1000)

  const capturer = async (etiq) => {
    await page.evaluate(() => window.__r20.vider())
    await page.waitForFunction(() => window.__r20.pret(8), { timeout: 30000, polling: 60 })
    await page.evaluate((n) => window.__r20.capturer(n, 8), etiq)
  }
  const ecart = (a, b) => page.evaluate(([x, y]) => window.__r20.distance(x, y), [a, b])

  // ── LE PLANCHER DE BRUIT, VÉRIFIÉ AVANT TOUTE MESURE ────────────────────
  await capturer('P1')
  await dodo(700)
  await capturer('P2')
  out.plancher = await ecart('P1', 'P2')
  console.log('plancher de bruit', JSON.stringify(out.plancher))

  // ── L'ÉTAT DU CIEL ──────────────────────────────────────────────────────
  out.etat = await page.evaluate(() => {
    const e = window.__exp
    const c = e.clouds
    const g = c?.group
    const m = g?.children?.[0]
    return {
      mode: e.modes.mode,
      parent: g?.parent?.name || g?.parent?.type || null,
      groupeVisible: !!g?.visible,
      groupeEchelle: g ? +g.scale.x.toFixed(9) : null,
      groupePos: g ? g.position.toArray().map((v) => +v.toFixed(4)) : null,
      instances: m?.count ?? null,
      uCamBloc: m?.material?.uniforms?.uCamBloc?.value?.toArray().map((v) => +v.toFixed(4)) ?? null,
      camGlobe: e.camGlobe?.position.toArray().map((v) => +v.toFixed(3)) ?? null,
      altKm: +(((e.camGlobe?.position.length() ?? 0) - 100) * 63.71).toFixed(0),
      uFadeCoquille: +(e.globe?.clouds?.uniforms?.uFade?.value ?? -1).toFixed(4),
    }
  })
  console.log('etat', JSON.stringify(out.etat))

  // ── LE CIEL EST-IL À L'ÉCRAN ? on l'éteint, on le rallume ───────────────
  await capturer('ON')
  await page.screenshot({ path: path.join(SORTIE, 'surface-18km-ON.png') })
  await page.evaluate(() => window.__exp.clouds.setVisible(false))
  await dodo(900)
  await capturer('OFF')
  await page.screenshot({ path: path.join(SORTIE, 'surface-18km-OFF.png') })
  await page.evaluate(() => window.__exp.clouds.setVisible(true))
  await dodo(900)
  await capturer('RET')
  out.presence = { ecart: await ecart('ON', 'OFF'), retour: await ecart('ON', 'RET') }
  console.log('PRESENCE', JSON.stringify(out.presence))

  // ── LES QUINZE CURSEURS, UN PAR UN, AVEC CAPTURE APRÈS CHACUN ───────────
  const pousser = (cle, val) => page.evaluate(([k, v]) => {
    const e = window.__exp
    // 1) par le DOM, comme Adrien : `input` PUIS `change` (relâchement)
    let vu = null
    for (const el of document.querySelectorAll('input,select')) {
      const n = el.name || el.id || el.dataset?.k || el.dataset?.key
      if (n !== k) continue
      vu = el.type
      if (el.type === 'checkbox') el.checked = !!v
      else el.value = String(v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
      break
    }
    // 2) repli : le chemin de l'interface programmée (mêmes fonctions que les
    //    presets et le partage de lien), quand le curseur n'est pas un <input>
    if (vu === null) {
      e.params[k] = v
      if (k === 'cloudsEnabled') { e.clouds.build(e.params); e.clouds.setVisible(!!v) }
      else e.clouds.build(e.params)
    }
    return { vu, lu: e.params[k] }
  }, [cle, val])

  await capturer('BASE')
  for (const c of CURSEURS) {
    if (SEUL && c.nom !== SEUL) continue
    const mis = await pousser(c.cle, c.a)
    await dodo(1400)
    await capturer('C')
    await page.screenshot({ path: path.join(SORTIE, `curseur-${c.nom}.png`) })
    const d = await ecart('BASE', 'C')
    const rendu = await pousser(c.cle, c.de)
    await dodo(1400)
    await capturer('R')
    const retour = await ecart('BASE', 'R')
    const ligne = { ...c, dom: mis.vu, lu: mis.lu, ecart: d, retour, rendu: rendu.lu }
    out.curseurs.push(ligne)
    console.log(c.nom, JSON.stringify({ dom: mis.vu, lu: mis.lu, ecart: d, retour }))
  }

  // ── TROIS ALTITUDES, DONT 18 km ET LE GLOBE ENTIER ──────────────────────
  const releverAlt = async (nom) => {
    const e = await page.evaluate(() => {
      const x = window.__exp
      return {
        mode: x.modes.mode,
        altKm: +(((x.camGlobe?.position.length() ?? 0) - 100) * 63.71).toFixed(0),
        cielVisible: !!x.clouds?.group?.visible,
        uFadeCoquille: +(x.globe?.clouds?.uniforms?.uFade?.value ?? -1).toFixed(4),
      }
    })
    await page.screenshot({ path: path.join(SORTIE, `altitude-${nom}.png`) })
    e.nom = nom
    out.altitudes.push(e)
    console.log('altitude', JSON.stringify(e))
  }
  await releverAlt('18km')
  await page.evaluate(() => window.__exp.modes.enterOrbit(1200000))
  await dodo(9000)
  await releverAlt('1200km')
  await page.evaluate(() => {
    const e = window.__exp
    e.camera.position.setLength(300)
    e.modes.orbAlt = e.modes.orbAltTarget = 200
    e.camera.lookAt(0, 0, 0)
    e.controls.update()
  })
  await dodo(8000)
  await releverAlt('globe-entier')
} catch (err) {
  out.erreur = String(err?.stack || err)
  console.error(out.erreur)
} finally {
  fs.writeFileSync(path.join(SORTIE, 'diag-ecran.json'), JSON.stringify(out, null, 1))
  await nav.close()
}
