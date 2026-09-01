// SONDE R26 — LA PORTE DU BANC : L'ANCIENNE, LA NEUVE, ET CE QUE LES 45 s ACHETAIENT
//
// ⛔ **ON NE CORRIGE PAS UNE PORTE SANS MESURER CE QU'ELLE RETENAIT.** Le
// commentaire de `scripts/sonde-lumiere-r21.mjs` le dit lui-même : « NE PAS LA
// « CORRIGER » SANS RE-MESURER LE PLANCHER — tous les chiffres publiés dans
// `rapport-R21.md` l'ont été avec cette attente-là ». La question n'est donc pas
// « la porte est-elle mal écrite » (elle l'est, et R21 l'avait vu) mais :
//
// ⚡ **QUE SE PASSE-T-IL ENTRE LA FERMETURE DE LA PORTE CORRIGÉE ET LA 45ᵉ
// SECONDE ?** Si des tuiles arrivent encore dans cet intervalle, l'image change
// encore et la porte corrigée coupe trop tôt : les chiffres de R21 seraient
// irreproductibles. Si RIEN n'arrive, les 45 s ne payaient rien et la
// correction est neutre au regard des chiffres publiés.
//
// Les deux portes sont lancées **au même instant**, chacune avec son
// chronomètre : c'est la seule façon de comparer deux attentes sans que la
// première ne décale la seconde.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opt = (n, d = null) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d }
const has = (n) => args.includes(n)
const PORT = Number(opt('--port', '5711'))
const SORTIE = opt('--sortie', path.join(RACINE, '.banc/R26'))
const CHARGEMENTS = Number(opt('--chargements', '3'))
const APRES_MS = Number(opt('--apres', '45000'))
const VISIBLE = has('--visible')
const LARGEUR = 1280, HAUTEUR = 720
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))

function trouverChrome() {
  const donne = opt('--chrome', process.env.CHROME_PATH)
  if (donne) return donne
  const t = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p))
  if (!t) { console.error('Chrome introuvable'); process.exit(2) }
  return t
}
async function chargerPuppeteer() {
  for (const p of [
    path.join(RACINE, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'),
    'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
    'C:/Dev/wt-warm/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
  ]) if (fs.existsSync(p)) return (await import('file:///' + p.split('\\').join('/'))).default
  console.error('puppeteer-core introuvable'); process.exit(2)
}

// Compteur d'arrivées, posé DANS la boucle de rendu : une tuile qui devient
// `ready` est une tuile qui va changer l'image à la prochaine composition.
function INSTRUMENTER() {
  const g = window.__exp?.globe
  if (!g) return 'pas de globe'
  if (window.__p26) return 'déjà posé'
  const R = { versReady: 0, frames: 0, enVolMax: 0 }
  window.__p26 = R
  const etats = new Map()
  const orig = g.update.bind(g)
  g.update = function (c, dt) {
    const out = orig(c, dt)
    R.frames++
    for (const t of g.tiles.values()) {
      const a = etats.get(t.key)
      if (a !== undefined && a !== 'ready' && t.state === 'ready') R.versReady++
      etats.set(t.key, t.state)
    }
    if (typeof g.tuilesEnVol === 'function') R.enVolMax = Math.max(R.enVolMax, g.tuilesEnVol())
    return out
  }
  return 'posé'
}

// ⚠️ DES EXPRESSIONS : `waitForFunction` évalue la chaîne.
const ANCIENNE =
  "(() => { const t = window.__exp && window.__exp.globe && window.__exp.globe.tiles; if (!t) return false;" +
  " let n = 0; for (const v of t.values()) if (v.state === 'loading' || v.state === 'empty') n++; return n === 0 })()"
const NEUVE = '(() => { const g = window.__exp && window.__exp.globe; return !!g && g.tuilesEnVol() === 0 })()'

async function lancer() {
  fs.mkdirSync(SORTIE, { recursive: true })
  const puppeteer = await chargerPuppeteer()
  const nav = await puppeteer.launch({
    executablePath: trouverChrome(),
    headless: VISIBLE ? false : 'new',
    args: [`--window-size=${LARGEUR},${HAUTEUR + 120}`, '--use-angle=default'],
    defaultViewport: { width: LARGEUR, height: HAUTEUR },
  })
  const journal = { port: PORT, chargements: [], apresMs: APRES_MS }
  for (let i = 0; i < CHARGEMENTS; i++) {
    const page = await nav.newPage()
    const cdp = await page.target().createCDPSession()
    let reseau = 0
    const HOTES = /mapterhorn|elevation-tiles-prod|amazonaws/
    await cdp.send('Network.enable')
    cdp.on('Network.requestWillBeSent', (ev) => { if (HOTES.test(ev.request.url)) reseau++ })

    const t0 = Date.now()
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 90000 })
    await page.waitForFunction('!!(window.__exp && window.__exp.globe)', { timeout: 90000 })
    const pose = await page.evaluate(INSTRUMENTER)
    await page.waitForFunction("!!document.getElementById('loading')?.classList.contains('hidden')", { timeout: 180000 })
    const msVoile = Date.now() - t0
    await page.evaluate(() => { document.body.classList.remove('ce-hub'); document.querySelector('.ce-hubveil')?.remove() })

    // ══ LES DEUX PORTES, LANCÉES AU MÊME INSTANT ══
    const depart = Date.now()
    const chrono = async (expr) => {
      let expiree = false
      await page.waitForFunction(expr, { polling: 100, timeout: 45000 }).catch(() => { expiree = true })
      return { ms: Date.now() - depart, expiree }
    }
    const [neuve, ancienne] = await Promise.all([chrono(NEUVE), chrono(ANCIENNE)])

    // ══ CE QUE LES 45 s ACHETAIENT : on observe APRÈS la porte corrigée ══
    const apres0 = await page.evaluate('({ ready: window.__p26.versReady, frames: window.__p26.frames })')
    const reseau0 = reseau
    await page.evaluate(() => { window.__p26.enVolMax = 0 })
    await dodo(APRES_MS)
    const apres1 = await page.evaluate('({ ready: window.__p26.versReady, frames: window.__p26.frames, enVolMax: window.__p26.enVolMax })')

    const l = {
      pose, msVoile, neuve, ancienne,
      apresPorte: {
        ms: APRES_MS,
        tuilesArrivees: apres1.ready - apres0.ready,
        requetesTuiles: reseau - reseau0,
        images: apres1.frames - apres0.frames,
        enVolMax: apres1.enVolMax,
      },
      requetesTuilesTotal: reseau,
    }
    journal.chargements.push(l)
    console.log(
      `#${i + 1} · voile ${msVoile} ms · porte NEUVE ${neuve.ms} ms${neuve.expiree ? ' (EXPIRÉE)' : ''}` +
      ` · porte ANCIENNE ${ancienne.ms} ms${ancienne.expiree ? ' (EXPIRÉE)' : ''}` +
      ` · après la neuve, en ${APRES_MS / 1000} s : ${l.apresPorte.tuilesArrivees} tuile(s) arrivée(s), ${l.apresPorte.requetesTuiles} requête(s), enVolMax ${l.apresPorte.enVolMax}`
    )
    await page.close()
  }
  const nom = path.join(SORTIE, 'porte.json')
  fs.writeFileSync(nom, JSON.stringify(journal, null, 2))
  const moy = (f) => (journal.chargements.reduce((a, c) => a + f(c), 0) / journal.chargements.length).toFixed(0)
  console.log(`\nmoyennes sur ${CHARGEMENTS} chargements : voile ${moy((c) => c.msVoile)} ms · porte neuve ${moy((c) => c.neuve.ms)} ms · porte ancienne ${moy((c) => c.ancienne.ms)} ms`)
  console.log(`gain par mesure : ${moy((c) => c.ancienne.ms - c.neuve.ms)} ms`)
  console.log('→', nom)
  await nav.close()
}
lancer().catch((e) => { console.error(e); process.exit(1) })
