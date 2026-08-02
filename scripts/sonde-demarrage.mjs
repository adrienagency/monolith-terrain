// SONDE DE DÉMARRAGE — chiffre le préchauffage des shaders et l'instant du
// premier dessin, SUR LE BUILD DE PRODUCTION.
//
// ---------------------------------------------------------------------------
// QUAND S'EN SERVIR
// ---------------------------------------------------------------------------
// Avant ET après toute intervention sur :
//   • le préchauffage (src/warmup.js),
//   • la chaîne de rendu (composer, passes de post-traitement, cibles HDR),
//   • ce qui retient le premier dessin (le drapeau `programmesPrets` de main.js).
//
// POURQUOI ELLE EXISTE. La classe de défaut qu'elle attrape ne laisse AUCUNE
// trace exploitable : pas de test rouge, pas d'erreur bloquante, souvent pas
// même une ligne en console. Le 28/07/2026, le préchauffage était mort depuis
// des jours — `compileAsync` levait dans un `setTimeout` interne à three, la
// promesse ne se réglait jamais, et le premier dessin attendait le garde-fou de
// 6 s à CHAQUE chargement. Tout le monde voyait « ça rame un peu au départ » et
// personne ne pouvait le chiffrer. Cette sonde rend ce défaut mesurable en une
// commande.
//
// ⚠️ ET SURTOUT : elle mesure sur le BUILD DE PRODUCTION, jamais sur le serveur
// de dev. Ce n'est pas un détail de confort. Sur le dev, le défaut ci-dessus ne
// se reproduit JAMAIS — tout y est plus lent et plus étalé, et la course des
// matériaux libérés ne se gagne pas. Mesurer en dev rend un faux négatif
// rassurant. Voir l'en-tête de src/warmup.js pour la matrice complète de ce qui
// reproduit et de ce qui ne reproduit pas.
//
// ---------------------------------------------------------------------------
// COMMENT LIRE SON VERDICT
// ---------------------------------------------------------------------------
// Une ligne par démarrage, puis un récapitulatif par case. Deux colonnes
// comptent :
//
//   verdict     ce que rend warmupPrograms(). C'est LE signal.
//                 ok            le préchauffage a fini son travail. Attendu.
//                 delai         il a été abandonné au bout de timeoutMs (6 s).
//                               ⇒ DÉFAUT : le premier dessin a attendu 6 s pour
//                                 rien. C'est la signature exacte de la
//                                 régression de 2026-07-28.
//                 indisponible  renderer sans compile()/properties : three trop
//                               ancien, ou renderer factice. Pas un défaut en
//                               soi, mais le préchauffage ne sert à rien.
//                 <autre texte> une levée a été rattrapée (contexte WebGL perdu,
//                               scène mal formée). À lire tel quel.
//
//   1er dessin  l'instant, depuis la navigation, où la carte est dessinée pour
//               la première fois. main.js enchaîne
//               `warmupPrograms(...).then(() => programmesPrets = true)`, donc
//               c'est le verdict qui le libère, à une image près.
//
//   TypeError   nombre de démarrages ayant levé une erreur non rattrapée. Doit
//               être 0. Toute valeur non nulle est un défaut, même si le
//               verdict est `ok` — une levée hors chaîne de promesses ne
//               remonte nulle part ailleurs.
//
// ORDRE DE GRANDEUR (RTX 3080, ANGLE D3D11, headless 1280×800, démarrage nu,
// f3=0) : sain ⇒ ok×6, premier dessin ~3 400 ms, 0 TypeError. Régressé ⇒
// delai×4 sur 6, premier dessin ~7 600 ms, 4 TypeError sur 6. Les valeurs
// absolues dépendent de la machine ; c'est l'ÉCART avant/après qui se lit.
//
// ---------------------------------------------------------------------------
// EMPLOI
// ---------------------------------------------------------------------------
//   node scripts/sonde-demarrage.mjs                     # état actuel, cas qui échoue
//   node scripts/sonde-demarrage.mjs --runs 10           # plus de tirages (c'est une COURSE)
//   node scripts/sonde-demarrage.mjs --zones toutes      # + Chamonix et La Réunion
//   node scripts/sonde-demarrage.mjs --f3 0,1            # les deux modes
//   node scripts/sonde-demarrage.mjs --avant <fichier.js>  # comparer à une autre
//                                                          # version de warmup.js
//
// `--avant` est le mode avant/après : le fichier donné est substitué à
// src/warmup.js AU MOMENT DU BUILD, par un alias vite, dans un dossier de
// travail temporaire. Le dépôt n'est JAMAIS modifié — on peut donc mesurer une
// version pré-correctif sans rien toucher, et pendant qu'une autre session
// travaille dans le worktree. Exemple :
//   git show <commit>:src/warmup.js > /tmp/avant.js
//   node scripts/sonde-demarrage.mjs --avant /tmp/avant.js --runs 10
//
// Chrome : --chrome <chemin>, ou la variable CHROME_PATH. Sinon les
// emplacements usuels sont essayés.
// Dépendance : puppeteer-core (non déclarée dans package.json — la sonde est un
// outil de diagnostic, pas une dépendance du produit). `npm i -D puppeteer-core`
// si elle manque ; le message d'erreur le rappelle.

import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const RACINE = fileURLToPath(new URL('..', import.meta.url))

// ------------------------------------------------------------------ arguments
const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] ? A[i + 1] : d }
const RUNS = Number(opt('--runs', '6'))
const AVANT = opt('--avant', null)
const F3 = opt('--f3', '0').split(',').map((s) => s.trim()).filter(Boolean)
const TOUTES = opt('--zones', 'defaut') === 'toutes'
const PORT = Number(opt('--port', '5590'))

const b64url = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

// Le démarrage NU est le seul cas qui reproduise la régression de 2026-07-28 :
// c'est le seul qui passe par la transition Annecy→zone, donc le seul qui
// libère assez de matériaux pour gagner la course. Les deux zones de référence
// n'existent ici que pour surveiller les TEMPS, pas pour chercher le défaut.
const ZONES = [
  { nom: 'défaut (nu)', hash: '' },
  ...(TOUTES ? [
    { nom: 'Chamonix', hash: '#s=' + b64url({ loc: { lat: 45.92, lon: 6.87, zoom: 12 } }) },
    { nom: 'La Réunion', hash: '#s=' + b64url({ loc: { lat: -21.13, lon: 55.53, zoom: 13 } }) },
  ] : []),
]

// -------------------------------------------------------------------- Chrome
function trouverChrome() {
  const donne = opt('--chrome', process.env.CHROME_PATH)
  if (donne) return donne
  const pistes = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ]
  const t = pistes.find((p) => fs.existsSync(p))
  if (!t) {
    console.error('Chrome introuvable. Passe --chrome <chemin>, ou pose CHROME_PATH.')
    process.exit(2)
  }
  return t
}

async function chargerPuppeteer() {
  try {
    return (await import('puppeteer-core')).default
  } catch {
    console.error('puppeteer-core est absent. Cette sonde est un outil de diagnostic,')
    console.error('pas une dépendance du produit — installe-la à la demande :')
    console.error('  npm i -D puppeteer-core')
    process.exit(2)
  }
}

// --------------------------------------------------------------------- build
// Le build sort dans un dossier temporaire, hors du dépôt : `dist/` n'est pas
// écrasé, et une autre session peut construire en parallèle sans collision.
function construire(travail, env) {
  const outDir = path.join(travail, 'dist')
  // main.js écrit `import { warmupPrograms } from './warmup.js'` : un alias vite
  // matche le SPÉCIFICATEUR, pas le chemin résolu. On y branche TOUJOURS
  // l'enveloppe de mesure ; c'est elle qui décide ensuite quel module réel elle
  // enveloppe (celui du dépôt, ou celui de --avant). Son propre import est en
  // chemin ABSOLU, donc il ne retombe pas dans cet alias.
  const alias = `{ find: /^\\.\\/warmup\\.js$/, replacement: ${JSON.stringify(env.replace(/\\/g, '/'))} },`
  const conf = path.join(travail, 'vite.sonde.config.mjs')
  fs.writeFileSync(conf, `import fs from 'node:fs'
import path from 'node:path'
const RACINE = ${JSON.stringify(RACINE.replace(/\\/g, '/'))}
const live = path.resolve(RACINE, '../ocean-lab/src/lib/index.js')
const vendored = path.resolve(RACINE, 'src/vendor/ocean-waves/index.js')
export default {
  root: RACINE,
  base: './',
  resolve: { alias: [
    { find: 'ocean-waves', replacement: fs.existsSync(live) ? live : vendored },
    ${alias}
  ] },
  build: { outDir: ${JSON.stringify(outDir.replace(/\\/g, '/'))}, emptyOutDir: true },
}
`)
  console.log(`build de production${AVANT ? ` (warmup remplacé par ${path.basename(AVANT)})` : ''}…`)
  // On appelle le binaire de vite avec le node courant, pas `npx` : sous Windows
  // `npx.cmd` n'est pas exécutable par execFileSync (il faudrait un shell), et
  // passer par un shell rouvrirait la porte aux problèmes de quoting sur les
  // chemins à espaces.
  const vite = path.join(RACINE, 'node_modules/vite/bin/vite.js')
  if (!fs.existsSync(vite)) { console.error(`vite introuvable (${vite}) — lance "npm ci" d abord.`); process.exit(2) }
  execFileSync(process.execPath, [vite, 'build', '--config', conf], {
    cwd: RACINE, stdio: ['ignore', 'ignore', 'inherit'],
  })
  return outDir
}

// ------------------------------------------------------------------- serveur
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.woff2': 'font/woff2',
}
function servir(dist, port) {
  const s = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0].split('#')[0])
    let f = path.join(dist, u)
    try {
      if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(dist, 'index.html')
      res.writeHead(200, { 'content-type': MIME[path.extname(f)] ?? 'application/octet-stream' })
      fs.createReadStream(f).pipe(res)
    } catch { res.writeHead(404).end() }
  })
  return new Promise((r) => s.listen(port, () => r(s)))
}

// --------------------------------------------------------------------- mesure
// On n'instrumente pas le bundle (noms minifiés) : on enveloppe warmupPrograms
// au moment du build, via le même alias que `--avant`. L'enveloppe publie le
// verdict sur window, et rien d'autre ne change.
function enveloppe(travail, moduleReel) {
  const f = path.join(travail, 'enveloppe.js')
  fs.writeFileSync(f, `import { warmupPrograms as vrai } from ${JSON.stringify(moduleReel.replace(/\\/g, '/'))}
export function warmupPrograms(o) {
  return vrai(o).then((r) => {
    window.__sonde = { ...r, tResolu: Math.round(performance.now()) }
    return r
  })
}
`)
  return f
}

async function unDemarrage(puppeteer, chrome, port, zone, f3) {
  const nav = await puppeteer.launch({
    executablePath: chrome, headless: true,
    args: ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=1280,800'],
  })
  try {
    const page = await nav.newPage()
    await page.setViewport({ width: 1280, height: 800 })
    const erreurs = []
    page.on('pageerror', (e) => erreurs.push(e.message))
    await page.goto(`http://localhost:${port}/?f3=${f3}${zone.hash}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    // 20 s : largement au-delà du garde-fou de 6 s, pour voir un `delai` entier
    await page.waitForFunction(() => window.__sonde !== undefined, { timeout: 20000, polling: 50 }).catch(() => {})
    await new Promise((r) => setTimeout(r, 1500)) // laisser tomber les levées tardives
    const v = await page.evaluate(() => window.__sonde ?? null)
    return { zone: zone.nom, f3, verdict: v, erreurs }
  } finally {
    await nav.close()
  }
}

// ----------------------------------------------------------------------- main
const puppeteer = await chargerPuppeteer()
const chrome = trouverChrome()
const travail = fs.mkdtempSync(path.join(os.tmpdir(), 'sonde-demarrage-'))
let serveur = null
try {
  // L'enveloppe s'intercale devant le module réel (celui du dépôt, ou celui de
  // --avant), donc la mesure ne dépend pas de la variante mesurée.
  const reel = AVANT ? path.resolve(AVANT) : path.join(RACINE, 'src/warmup.js')
  if (AVANT && !fs.existsSync(reel)) { console.error(`--avant : fichier introuvable : ${reel}`); process.exit(2) }
  const env = enveloppe(travail, reel)
  const dist = construire(travail, env)
  serveur = await servir(dist, PORT)

  const tout = []
  for (const zone of ZONES) {
    for (const f3 of F3) {
      for (let i = 0; i < RUNS; i++) {
        const r = await unDemarrage(puppeteer, chrome, PORT, zone, f3)
        tout.push(r)
        const v = r.verdict
        console.log(
          `${r.zone.padEnd(12)} f3=${r.f3} run${String(i + 1).padStart(2)}  ` +
          `verdict=${v ? JSON.stringify({ ok: v.ok, raison: v.raison, ms: v.ms }) : 'JAMAIS RÉGLÉ'}  ` +
          `1er dessin=${String(v?.tResolu ?? 'AUCUN').padStart(5)} ms  TypeError=${r.erreurs.length}`,
        )
        for (const e of r.erreurs) console.log(`    ⚠ ${e.split('\n')[0]}`)
      }
    }
  }

  const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null }
  console.log(`\n=== RÉCAPITULATIF (n=${RUNS} par case${AVANT ? `, warmup = ${path.basename(AVANT)}` : ''}) ===`)
  console.log('zone         f3  verdicts                    1er dessin (méd.)  TypeError')
  let defaut = false
  for (const zone of ZONES) {
    for (const f3 of F3) {
      const g = tout.filter((r) => r.zone === zone.nom && r.f3 === f3)
      const cpt = {}
      for (const r of g) {
        const k = !r.verdict ? 'JAMAIS RÉGLÉ' : r.verdict.ok ? 'ok' : r.verdict.raison
        cpt[k] = (cpt[k] ?? 0) + 1
      }
      const err = g.reduce((s, r) => s + r.erreurs.length, 0)
      if (err > 0 || Object.keys(cpt).some((k) => k !== 'ok')) defaut = true
      console.log(
        `${zone.nom.padEnd(12)} ${f3}   ` +
        `${Object.entries(cpt).map(([k, v]) => `${k}×${v}`).join(' ').padEnd(26)}  ` +
        `${String(med(g.map((r) => r.verdict?.tResolu).filter((x) => x != null)) ?? '—').padStart(7)} ms        ${err}/${g.length}`,
      )
    }
  }
  console.log(defaut
    ? '\n⚠ DÉFAUT : un verdict autre que `ok`, ou une TypeError. Relire l en-tête de src/warmup.js.'
    : '\n✓ sain : tous les verdicts à `ok`, aucune TypeError.')
} finally {
  serveur?.close()
  fs.rmSync(travail, { recursive: true, force: true })
}
