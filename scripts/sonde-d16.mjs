// SONDE D16 — QUATRE FAMILLES PAR IMAGE, ET DEUX TÉMOINS QUI PROUVENT QU'ELLE VOIT.
//
// ══════════ POURQUOI UN INSTRUMENT DE PLUS ══════════════════════════════════
//
// Trois tâches ont mesuré cette descente et les trois ont mesuré UNE grandeur :
//   · Tâche M   → l'ALTITUDE. « aucun saut » pendant qu'Adrien filmait une bascule.
//   · Tâche R4  → l'ORIENTATION. A trouvé la bascule (46,548°), l'a lissée.
//   · une autre → la LUMINANCE. Aveugle à un effacement qui éclaircit.
//
// D16 exige les QUATRE ensemble, par image :
//   ① POSITION  — `camera.position`, et le déplacement d'une image à l'autre
//                 RAPPORTÉ à la distance à la cible (un mètre à 60 000 km n'est
//                 pas un mètre à 5 km : la grandeur sans dimension est la seule
//                 comparable d'un bout à l'autre de la descente).
//   ② AXE       — le vecteur de visée en monde, et l'angle entre deux images.
//                 ⚠️ **DEUX ANGLES, PAS UN** : `dVisee` (l'axe de la caméra,
//                 celui qu'Adrien voit tourner) et `dIncl` (l'inclinaison au
//                 nadir LOCAL, comparable entre orbite et surface — la grandeur
//                 de R4). Ils diffèrent dès que la caméra se déplace en orbite.
//   ③ ÉCHELLE   — l'emprise du bloc, `k = extentMeters / span / ORBITAL_M_PER_UNIT`,
//                 l'altitude de cadrage, la distance à la cible, le fov.
//   ④ CONTENU   — un condensé 16×10 de l'IMAGE RENDUE, lu sur le tampon de
//                 dessin par une chaîne de `blitFramebuffer` (chaque étage
//                 divise par deux : c'est une VRAIE moyenne de boîte, pas un
//                 point échantillonné). ⚠️ Deux distances en sortent :
//                 `dImg` (moyenne des écarts absolus par tuile, 0-255) et
//                 `dLum` (écart de luminance moyenne). **`dLum` est là pour
//                 MONTRER qu'il est aveugle** : un effacement qui éclaircit et
//                 un autre qui assombrit peuvent rendre le même `dLum`.
//
// Plus, par image : quelle caméra a rendu (`camera` du bloc / `camGlobe` du
// fond, dans l'ordre des passes), `uCropOn`, le zoom du bloc, et le nombre de
// requêtes réseau parties depuis l'image précédente.
//
// ══════════ LES DEUX TÉMOINS — SANS EUX AUCUN CHIFFRE NE VAUT ═══════════════
//
// **TÉMOIN NUL** (`--temoins`) : deux relevés d'un état IDENTIQUE. La vue est
// laissée au repos, sans entrée, et on lit ce que l'instrument rend quand rien
// ne change. C'est le PLANCHER DE BRUIT, et il est mesuré ici et pas supposé —
// le chantier a déjà payé un plancher de 8,97 dont personne n'a su dire la cause.
//
// **TÉMOIN POSITIF** (`--temoins`) : une rupture CONNUE, dont la valeur se
// calcule d'avance. On rejoue la plongée d'AVANT la Tâche R4 sans toucher à
// `src/` : au milieu du balayage de pose, on appelle `modes._avancerFonduPose(1)`
// depuis la page — la caméra saute en UNE image à la pose oblique finale.
// L'angle attendu vaut `angleTotalDeg × (1 − e)`, lu sur `modes._fonduPose`
// AVANT le saut. L'instrument doit le retrouver sur `dIncl`. ⚠️ Un instrument
// qui ne retrouve pas ce chiffre-là ne mesure rien du reste.
//
// EMPLOI
//   node scripts/sonde-d16.mjs --temoins 1 --etiquette temoins
//   node scripts/sonde-d16.mjs --scenario descente --etiquette descente-60000km
//   node scripts/sonde-d16.mjs --scenario remontee --etiquette remontee
//   node scripts/sonde-d16.mjs --scenario clic     --etiquette clic-globe
//   ... --visible 1   (fenêtre Chrome à l'écran ; sans tête par défaut)
//
// Sort `.banc/D16/<etiquette>.json` — une ligne par IMAGE RENDUE.
//
// ⛔ LECTURE SEULE SUR `src/`. Ce fichier n'écrit dans la page que :
//   · des enveloppes autour de `renderer.render` et `composer.render`
//     (elles appellent l'original et ne changent aucun argument) ;
//   · les gestes que l'utilisateur ferait (molette, clic, Échap) ;
//   · pour le TÉMOIN POSITIF seulement, l'appel de méthode décrit ci-dessus.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const ICI = path.join(RACINE, '.banc', 'D16')
fs.mkdirSync(ICI, { recursive: true })

const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = Number(opt('--port', '5537'))
const DEPART_M = Number(opt('--depart', '60000000'))
const ETIQ = opt('--etiquette', 'd16')
const SCENARIO = opt('--scenario', 'descente')
const TEMOINS = opt('--temoins', '0') !== '0'
const CRANS = Number(opt('--crans', '260'))
const PERIODE = Number(opt('--periode', '90'))
const VISIBLE = opt('--visible', '0') !== '0'
const IMAGES = opt('--images', '0') !== '0'
// l'altitude a laquelle la descente s'arrete — 60 km par defaut (le premier crop),
// 500 m pour le banc de precision float32 (voir le rapport, Etape 9).
const ARRIVEE_M = Number(opt('--arrivee', '60000'))
const URL_SUFFIXE = opt(
  '--url',
  '?terre=unique&frontiere=1&seuil=1&globe=continu&socle=quadtree&f3=0&planete=eclairee&soleil=heure'
)

function trouverChrome() {
  const donne = opt('--chrome', process.env.CHROME_PATH)
  if (donne) return donne
  const pistes = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome',
  ]
  const t = pistes.find((p) => fs.existsSync(p))
  if (!t) { console.error('Chrome introuvable — passe --chrome <chemin>.'); process.exit(2) }
  return t
}

async function chargerPuppeteer() {
  const pistes = [
    path.join(RACINE, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'),
    'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
    'C:/Dev/wt-warm/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
  ]
  for (const p of pistes) {
    if (!fs.existsSync(p)) continue
    return (await import('file:///' + p.replace(/\\/g, '/'))).default
  }
  console.error('puppeteer-core introuvable.')
  process.exit(2)
}

// ══════════ L'INSTRUMENT, TEL QU'IL S'INSTALLE DANS LA PAGE ═════════════════
// Écrit comme une fonction sérialisée : elle court dans le contexte de la page.
function poserInstrument() {
  const e = window.__exp
  if (!e || window.__d16) return 'déjà posé'
  const R = e.renderer
  const gl = R.getContext()
  const CV = R.domElement

  // ── ④ le condensé de l'image : chaîne de blits qui divisent par deux ──────
  // Une moyenne de BOÎTE, étage par étage. Un blit LINÉAIRE direct de 1280 à 16
  // n'échantillonne que 2×2 texels : il RATERAIT un changement qui n'occupe pas
  // ces texels-là. La chaîne, elle, fait entrer toute l'image dans le condensé.
  const LARG = 16, HAUT = 10
  const etages = []
  function construireEtages() {
    for (const f of etages) { gl.deleteFramebuffer(f.fbo); gl.deleteRenderbuffer(f.rb) }
    etages.length = 0
    let w = CV.width, h = CV.height
    for (let i = 0; i < 12; i++) {
      const nw = Math.max(LARG, w >> 1)
      const nh = Math.max(HAUT, h >> 1)
      const rb = gl.createRenderbuffer()
      gl.bindRenderbuffer(gl.RENDERBUFFER, rb)
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.RGBA8, nw, nh)
      const fbo = gl.createFramebuffer()
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, rb)
      etages.push({ fbo, rb, w: nw, h: nh })
      w = nw; h = nh
      if (nw === LARG && nh === HAUT) break
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.bindRenderbuffer(gl.RENDERBUFFER, null)
    window.__d16.etages = etages.map((x) => [x.w, x.h])
  }

  const px = new Uint8Array(LARG * HAUT * 4)
  function condense() {
    if (!etages.length || etages[0].w * 2 < CV.width) construireEtages()
    let srcFbo = null, sw = CV.width, sh = CV.height
    for (const et of etages) {
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, srcFbo)
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, et.fbo)
      gl.blitFramebuffer(0, 0, sw, sh, 0, 0, et.w, et.h, gl.COLOR_BUFFER_BIT, gl.LINEAR)
      srcFbo = et.fbo; sw = et.w; sh = et.h
    }
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, srcFbo)
    gl.readPixels(0, 0, LARG, HAUT, gl.RGBA, gl.UNSIGNED_BYTE, px)
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null)
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    // three met en cache la liaison de tampon ; on la lui rend explicitement.
    R.resetState?.()
    const t = new Array(LARG * HAUT * 3)
    for (let i = 0, j = 0; i < LARG * HAUT; i++) { t[j++] = px[i * 4]; t[j++] = px[i * 4 + 1]; t[j++] = px[i * 4 + 2] }
    return t
  }

  // ── le réseau : combien de requêtes, et de quelle nature ──────────────────
  const reseau = { total: 0, tuiles: 0, noms: [] }
  try {
    const po = new PerformanceObserver((l) => {
      for (const en of l.getEntries()) {
        reseau.total++
        if (/\.(png|jpg|jpeg|webp|avif|pbf|terrain)(\?|$)/i.test(en.name) || /tiles?\//i.test(en.name)) {
          reseau.tuiles++
          if (reseau.noms.length < 4000) reseau.noms.push(Math.round(en.startTime) + ' ' + en.name.slice(-90))
        }
      }
    })
    po.observe({ type: 'resource', buffered: true })
  } catch (err) { reseau.erreur = String(err).slice(0, 80) }

  // ── ② quelle caméra rend, dans quel ordre ────────────────────────────────
  // ⚡ **ET CE QUE CHAQUE PASSE DESSINE RÉELLEMENT — TÂCHE D16, ÉTAPE 3.**
  // L'inventaire dit que la passe de surface « ne dessine plus rien » sous le
  // drapeau. C'est une affirmation, pas une mesure. On compte les appels de
  // dessin et les triangles AUTOUR de chaque passe : `renderer.info.render` est
  // remis à zéro par three au début de chaque `render`, donc l'état d'APRÈS est
  // exactement ce que CETTE passe a dessiné.
  const passes = []
  const dessins = []
  const renderOrig = R.render.bind(R)
  R.render = function (sc, cam) {
    const tag = cam === e.camera ? 'bloc' : cam === e.camGlobe ? 'fond' : 'autre'
    passes.push(tag)
    const r = renderOrig(sc, cam)
    const i = R.info.render
    dessins.push(tag + ':' + i.calls + '/' + i.triangles)
    return r
  }

  // ── ⑤ LES ANCRES CANDIDATES — Étape 2 : la similitude n'a pas d'obligation
  // d'être ancrée au CENTRE du bloc. On relève, par image, le lat/lon de trois
  // points du bloc, avec la MÊME arithmétique que `geo.js` (recopiée ici pour
  // que l'instrument reste sans importation) :
  //   · `a0`  — (0 · 0), le centre du bloc : **l'ancre d'aujourd'hui** ;
  //   · `aC`  — l'aplomb de la caméra ;
  //   · `aT`  — l'aplomb de la cible de `controls`.
  // ⚠️ Ce qui décide n'est pas laquelle est « juste » mais laquelle est
  // GÉOGRAPHIQUEMENT CONTINUE au franchissement : c'est la rotation du repère
  // local `B(ancre)` qui produit les 11,863°, et rien d'autre.
  const D2R_ = Math.PI / 180, R2D_ = 180 / Math.PI
  const mercY_ = (lat) => Math.log(Math.tan(lat * D2R_) + 1 / Math.cos(lat * D2R_))
  const SPAN_ = 56
  function mondeVersLatLonEmprise_(em, x, z, span) {
    let large = em.est - em.ouest
    if (large <= 0) large += 360
    let lon = em.ouest + (x / span + 0.5) * large
    lon = ((((lon + 180) % 360) + 360) % 360) - 180
    const mN = mercY_(em.nord), mS = mercY_(em.sud)
    const m = mN + (z / span + 0.5) * (mS - mN)
    return { lat: Math.atan(Math.sinh(m)) * R2D_, lon }
  }
  function worldToLatLon_(dem, x, z) {
    const span = SPAN_ * (dem?.empriseCote > 1 ? dem.empriseCote : 1)
    const px = (x / span + 0.5) * dem.size
    const py = (z / span + 0.5) * dem.size
    const n = 2 ** dem.zoom
    const tpx = dem?.tilePx || 256
    const tx = ((((dem.originTileX + px / tpx) % n) + n) % n)
    const ty = dem.originTileY + py / tpx
    const lon = (tx / n) * 360 - 180
    const lat = Math.atan(Math.sinh(Math.PI * (1 - (2 * ty) / n))) * R2D_
    return { lat, lon }
  }
  function ancreDe(x, z) {
    try {
      const f = e.terrain?.fenetreBornee
      if (f?.emprise) return mondeVersLatLonEmprise_(f.emprise, x, z, SPAN_)
      const dem = e.dem
      if (!dem) return null
      const fen = dem.empriseCote > 1 ? e.terrain?.fenetre : null
      return worldToLatLon_(dem, (fen?.x ?? 0) + x, (fen?.z ?? 0) + z)
    } catch (er) { return null }
  }

  const lignes = []
  const lireCrop = () => {
    const g = e.globe
    const u = g?.uniforms ?? g?._uniforms ?? null
    return u?.uCropOn ? u.uCropOn.value : null
  }
  const V3 = e.camera.position.constructor

  // ⚠️ **LE RELEVÉ SE FAIT APRÈS `composer.render`, ET C'EST LA SEULE PLACE
  // JUSTE.** Là, `modes.update` a déjà couru, `majCameraFond` aussi, et le
  // tampon de dessin porte EXACTEMENT l'image qui va s'afficher. Un rAF planté
  // ailleurs lirait un état à moitié posé ou une image d'avant.
  const compOrig = e.composer.render.bind(e.composer)
  e.composer.render = function (dt) {
    passes.length = 0
    dessins.length = 0
    const r = compOrig(dt)
    if (!window.__d16.on) return r
    try {
      const cam = e.camera
      const p = cam.position
      const v = new V3(0, 0, -1).applyQuaternion(cam.quaternion).normalize()
      const t = e.controls?.target
      const mode = e.modes?.mode ?? '?'
      let bx = 0, by = -1, bz = 0
      if (mode === 'orbital') {
        const n = Math.hypot(p.x, p.y, p.z) || 1
        bx = -p.x / n; by = -p.y / n; bz = -p.z / n
      }
      const cos = Math.max(-1, Math.min(1, v.x * bx + v.y * by + v.z * bz))
      const cg = e.camGlobe
      const gp = cg?.position
      const gv = cg ? new V3(0, 0, -1).applyQuaternion(cg.quaternion).normalize() : null
      const emprise = e.dem?.extentMeters ?? null
      const fp = e.modes?._fonduPose ?? null
      lignes.push({
        n: lignes.length,
        t: performance.now(),
        marque: window.__d16.marque, // marque posée par le pilote
        mode,
        busy: !!e.modes?.busy,
        fondu: fp ? { t: fp.t, e: fp.e, ang: fp.angleTotalDeg } : null,
        // ① position
        px: p.x, py: p.y, pz: p.z,
        tx: t?.x ?? null, ty: t?.y ?? null, tz: t?.z ?? null,
        // ② axe
        vx: v.x, vy: v.y, vz: v.z,
        incl: (Math.acos(cos) * 180) / Math.PI,
        // ③ échelle
        alt: e.altitudeCadrageM?.() ?? null,
        dist: e.distanceCadrageM?.() ?? null,
        altM: e.modes?.altM ?? null,
        emprise,
        span: e.terrain?.params?.size ?? null,
        fov: cam.fov,
        near: cam.near, far: cam.far,
        zoom: e.dem?.zoom ?? null,
        // les deux caméras
        passes: passes.slice(),
        dessins: dessins.slice(),
        gx: gp?.x ?? null, gy: gp?.y ?? null, gz: gp?.z ?? null,
        gvx: gv?.x ?? null, gvy: gv?.y ?? null, gvz: gv?.z ?? null,
        gfov: cg?.fov ?? null,
        // ④ contenu
        img: (window.__d16.dernier = condense()),
        // la luminance moyenne du condensé, gardée à part : elle survit au
        // dégraissage du brut et permet de tracer le PROFIL de l'image.
        lum: window.__d16.dernier.reduce((s, x) => s + x, 0) / window.__d16.dernier.length,
        crop: lireCrop(),
        // l'ANCRE de la similitude, et c'est elle qu'il faut voir bouger :
        // `poseFond` compose `quaternionDeBase(ancre)` avec la pose du bloc.
        lat: e.dem?.lat ?? null, lon: e.dem?.lon ?? null,
        // ⑤ les trois ancres candidates, au lat/lon
        a0: ancreDe(0, 0),
        aC: ancreDe(p.x, p.z),
        aT: t ? ancreDe(t.x, t.z) : null,
        bascules: e.veilleCrop?.bascules ?? null,
        repos: !!e.veilleRepos?.auRepos,
        estompe: e.veilleEstompage?.valeur ?? null,
        // réseau
        req: reseau.total, tuiles: reseau.tuiles,
      })
      window.__d16.marque = ''
    } catch (err) {
      lignes.push({ n: lignes.length, err: String(err).slice(0, 160) })
    }
    return r
  }

  window.__d16 = { on: true, marque: '', lignes, reseau, etages: [] }
  return 'posé'
}

// ══════════ LA LECTURE — les quatre familles, image à image ═════════════════
//
// ⚠️ **LES FAMILLES SE LISENT SUR LES DEUX CAMÉRAS, ET C'EST TOUT LE POINT DE
// L'ÉTAPE 4.** Sous `?terre=unique` **la caméra qu'on VOIT est `camGlobe`** (la
// Tâche M l'a établi, §3.3) : c'est elle qui peint la planète, le bloc n'étant
// qu'une découpe posée devant. Un chiffre relevé sur `camera` seule décrit le
// repère du bloc, pas l'image. On publie donc les deux, côte à côte.
const R_GLOBE = 100
const ORBITAL_M_PER_UNIT = 6371000 / R_GLOBE

function analyse(lignes) {
  const out = []
  for (let i = 1; i < lignes.length; i++) {
    const a = lignes[i - 1], b = lignes[i]
    if (a.err || b.err) continue
    // ① position — le déplacement RAPPORTÉ à la distance à la cible.
    const dx = b.px - a.px, dy = b.py - a.py, dz = b.pz - a.pz
    const depl = Math.hypot(dx, dy, dz)
    const rayon = Math.max(1e-9, Math.hypot(b.px - (b.tx ?? 0), b.py - (b.ty ?? 0), b.pz - (b.tz ?? 0)))
    // ② axe — deux angles
    const c1 = Math.max(-1, Math.min(1, a.vx * b.vx + a.vy * b.vy + a.vz * b.vz))
    const dVisee = (Math.acos(c1) * 180) / Math.PI
    const dIncl = Math.abs(b.incl - a.incl)
    // ③ échelle
    const rAlt = a.alt > 0 && b.alt > 0 ? Math.max(a.alt / b.alt, b.alt / a.alt) : null
    const rDist = a.dist > 0 && b.dist > 0 ? Math.max(a.dist / b.dist, b.dist / a.dist) : null
    const rEmp = a.emprise > 0 && b.emprise > 0 ? Math.max(a.emprise / b.emprise, b.emprise / a.emprise) : null
    // ④ contenu
    let dImg = null, dLum = null
    if (a.img && b.img && a.img.length === b.img.length) {
      let s = 0, la = 0, lb = 0
      for (let k = 0; k < a.img.length; k++) { s += Math.abs(a.img[k] - b.img[k]); la += a.img[k]; lb += b.img[k] }
      dImg = s / a.img.length
      dLum = Math.abs(la - lb) / a.img.length
    }
    // ①' ②' ③' — LES MÊMES FAMILLES SUR LA CAMÉRA QUI REND LA PLANÈTE
    let deplG = null, deplGRel = null, dViseeG = null, inclG = null, dInclG = null, altFond = null, rAltFond = null
    if (a.gx != null && b.gx != null) {
      deplG = Math.hypot(b.gx - a.gx, b.gy - a.gy, b.gz - a.gz)
      const dA = Math.hypot(a.gx, a.gy, a.gz), dB = Math.hypot(b.gx, b.gy, b.gz)
      deplGRel = deplG / Math.max(1e-9, dB)
      const cg = Math.max(-1, Math.min(1, a.gvx * b.gvx + a.gvy * b.gvy + a.gvz * b.gvz))
      dViseeG = (Math.acos(cg) * 180) / Math.PI
      const inclDe = (p, v) => {
        const n = Math.hypot(p[0], p[1], p[2]) || 1
        const c = Math.max(-1, Math.min(1, v[0] * -p[0] / n + v[1] * -p[1] / n + v[2] * -p[2] / n))
        return (Math.acos(c) * 180) / Math.PI
      }
      const iA = inclDe([a.gx, a.gy, a.gz], [a.gvx, a.gvy, a.gvz])
      inclG = inclDe([b.gx, b.gy, b.gz], [b.gvx, b.gvy, b.gvz])
      dInclG = Math.abs(inclG - iA)
      altFond = (dB - R_GLOBE) * ORBITAL_M_PER_UNIT
      const altA = (dA - R_GLOBE) * ORBITAL_M_PER_UNIT
      if (altA > 0 && altFond > 0) rAltFond = Math.max(altA / altFond, altFond / altA)
    }
    // ⑤ le DÉPLACEMENT DE CHAQUE ANCRE CANDIDATE, en degrés d'arc.
    // ⚠️ C'est la grandeur qui prédit la rupture ③ : `quaternionDeBase(ancre)`
    // tourne du même angle que l'ancre parcourt sur la sphère.
    const arc = (u, v) => {
      if (!u || !v) return null
      const la1 = u.lat * Math.PI / 180, la2 = v.lat * Math.PI / 180
      const dLo = (v.lon - u.lon) * Math.PI / 180
      const c = Math.sin(la1) * Math.sin(la2) + Math.cos(la1) * Math.cos(la2) * Math.cos(dLo)
      return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI
    }
    out.push({
      dA0: arc(a.a0, b.a0), dAC: arc(a.aC, b.aC), dAT: arc(a.aT, b.aT),
      n: b.n, dt: Math.round((b.t - a.t) * 10) / 10, marque: b.marque || a.marque || '',
      mode: b.mode, modeAvant: a.mode, alt: b.alt, altM: b.altM, zoom: b.zoom,
      depl, deplRel: depl / rayon, dVisee, dIncl,
      deplG, deplGRel, dViseeG, inclG, dInclG, altFond, rAltFond,
      rAlt, rDist, rEmp, dImg, dLum,
      crop: b.crop, cropAvant: a.crop,
      passes: (b.passes || []).join('+'),
      dessins: (b.dessins || []).join(' '),
      dReq: (b.req ?? 0) - (a.req ?? 0), dTuiles: (b.tuiles ?? 0) - (a.tuiles ?? 0),
      fov: b.fov,
    })
  }
  return out
}

const puppeteer = await chargerPuppeteer()
const nav = await puppeteer.launch({
  executablePath: trouverChrome(),
  headless: !VISIBLE,
  args: [...(VISIBLE ? [] : ['--headless=new']), '--no-sandbox', '--enable-unsafe-swiftshader',
    '--window-size=1280,900', '--autoplay-policy=no-user-gesture-required'],
})

const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
const sortie = { etiquette: ETIQ, scenario: SCENARIO, departM: DEPART_M, url: URL_SUFFIXE, visible: VISIBLE, temoins: {} }

try {
  const page = await nav.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  const erreurs = []
  page.on('pageerror', (er) => erreurs.push(String(er.message).slice(0, 200)))
  await page.goto(`http://localhost:${PORT}/${URL_SUFFIXE}`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction(() => window.__exp?.modes && window.__exp?.globe && window.__exp?.composer, { timeout: 90000, polling: 100 })
  sortie.gpu = await page.evaluate(() => {
    try {
      const gl = window.__exp?.renderer?.getContext?.()
      const d = gl?.getExtension('WEBGL_debug_renderer_info')
      return d ? String(gl.getParameter(d.UNMASKED_RENDERER_WEBGL)) : 'inconnu'
    } catch (er) { return 'erreur: ' + er.message }
  })
  console.log('pilote WebGL :', sortie.gpu)
  await dodo(7000)
  await page.keyboard.press('Escape')
  await dodo(2000)
  const accueil = await page.evaluate(() => {
    const el = document.elementFromPoint(640, 400)
    return el ? el.tagName + '.' + (el.className || '') : 'rien'
  })
  sortie.centreVue = accueil
  if (!/CANVAS/i.test(accueil)) console.log(`⚠️ le centre de la vue n'est pas le canvas mais ${accueil}`)

  console.log('instrument :', await page.evaluate(poserInstrument))
  sortie.etages = await page.evaluate(() => window.__d16.etages)

  const marque = (m) => page.evaluate((x) => { window.__d16.marque = x }, m)
  const vider = () => page.evaluate(() => { const l = window.__d16.lignes.splice(0); return l })
  const poserOrbite = async (altM) => {
    await page.evaluate((a) => { window.__exp.modes.enterOrbit(a); window.__d16.marque = 'orbite' }, altM)
    await dodo(3500)
    await page.evaluate((a) => {
      const m = window.__exp.modes
      const parUnite = m.orbAlt > 0 && m.altM > 0 ? m.altM / m.orbAlt : null
      if (parUnite) { m.orbAlt = m.orbAltTarget = a / parUnite }
    }, altM)
    await dodo(2000)
  }
  const molette = async (dy, n) => page.evaluate((d, i) => {
    const el = window.__exp.renderer.domElement
    el.dispatchEvent(new WheelEvent('wheel', { deltaY: d, clientX: 640, clientY: 400, bubbles: true, cancelable: true }))
    window.__d16.marque = (d < 0 ? 'mol-' : 'mol+') + i
  }, dy, n)

  // ══════════ LES TÉMOINS ═══════════════════════════════════════════════════
  if (TEMOINS) {
    // — TÉMOIN NUL nº1 : orbite haute au repos, aucune entrée.
    await poserOrbite(DEPART_M)
    await dodo(1200); await vider()
    await dodo(2500)
    sortie.temoins.nulOrbite = analyse(await vider())

    // — TÉMOIN POSITIF : la plongée d'AVANT R4, rejouée sans toucher à src/.
    // On descend jusqu'à ce que le balayage s'arme, puis on l'achève en UNE image.
    await poserOrbite(1600000)
    await vider()
    let arme = null
    for (let i = 0; i < 400; i++) {
      await molette(-120, i)
      await dodo(60)
      arme = await page.evaluate(() => {
        const f = window.__exp.modes?._fonduPose
        return f ? { t: f.t, e: f.e, ang: f.angleTotalDeg } : null
      })
      if (arme) break
    }
    sortie.temoins.fonduArme = arme
    if (arme) {
      // ⚠️ ON LIT L'ÉTAT JUSTE AVANT DE SAUTER : l'angle attendu est
      // `angleTotalDeg × (1 − e)`, et il se calcule AVANT, pas après.
      const avant = await page.evaluate(() => {
        const f = window.__exp.modes._fonduPose
        window.__d16.marque = 'avant-saut'
        return { t: f.t, e: f.e, ang: f.angleTotalDeg }
      })
      await dodo(50)
      const saut = await page.evaluate(() => {
        const m = window.__exp.modes
        const f = m._fonduPose
        if (!f) return null
        const attendu = f.angleTotalDeg * (1 - f.e)
        window.__d16.marque = 'SAUT'
        m._avancerFonduPose(1) // la pose oblique finale, en UNE image
        m._fonduPose = null
        return { attendu, eAvant: f.e, ang: f.angleTotalDeg }
      })
      await dodo(700)
      sortie.temoins.positif = { avant, saut, lignes: analyse(await vider()) }
    }

    // — TÉMOIN NUL nº2 : la MÊME vue de surface, au repos, deux fois.
    await dodo(2500); await vider()
    await dodo(2500)
    sortie.temoins.nulSurface = analyse(await vider())
    console.log('témoins relevés')
  }

  // ══════════ LES SCÉNARIOS ═════════════════════════════════════════════════
  const client = await page.createCDPSession()
  const dossierImg = path.join(ICI, `img-${ETIQ}`)
  if (IMAGES) fs.mkdirSync(dossierImg, { recursive: true })

  if (SCENARIO === 'descente' || SCENARIO === 'remontee') {
    await poserOrbite(DEPART_M)
    await vider()
    await marque('DEPART')
    for (let i = 0; i < CRANS; i++) {
      await molette(-120, i)
      await dodo(PERIODE)
      if (IMAGES && i % 6 === 0) {
        const b = await client.send('Page.captureScreenshot', { format: 'jpeg', quality: 70 })
        const a = await page.evaluate(() => window.__exp.altitudeCadrageM?.() ?? 0)
        fs.writeFileSync(path.join(dossierImg, `d${String(i).padStart(3, '0')}-alt${Math.round(a)}.jpg`), Buffer.from(b.data, 'base64'))
      }
      const fini = await page.evaluate((seuil) => {
        const x = window.__exp
        const g = x.globe
        const u = g?.uniforms ?? g?._uniforms ?? null
        const crop = u?.uCropOn ? u.uCropOn.value : 0
        return x.modes?.mode === 'surface' && crop > 0.5 && (x.altitudeCadrageM?.() ?? 1e9) < seuil
      }, ARRIVEE_M)
      if (fini) { await marque('CROP-ATTEINT'); break }
    }
    await dodo(2500)
    // ⚡ **QUI DESSINE ENCORE DANS LA SCÈNE DU BLOC — TÂCHE D16, ÉTAPE 3.**
    // La mesure dit que la passe du bloc rend 0 triangle sur 60,4 % des images
    // de surface et au plus 168 sur les autres. Avant de retirer la passe, il
    // faut NOMMER ce qui reste. On parcourt la scène et on liste ce qui est
    // visible ET porteur de géométrie, avec son compte de triangles.
    sortie.sceneBloc = await page.evaluate(() => {
      const out = []
      const visible = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true }
      window.__exp.scene.traverse((o) => {
        const g = o.geometry
        if (!g || !visible(o)) return
        const idx = g.index ? g.index.count : g.attributes?.position?.count ?? 0
        const tri = o.isMesh ? Math.round(idx / 3) : idx
        out.push({
          nom: o.name || '(sans nom)',
          type: o.type,
          tri,
          parents: (() => { const c = []; for (let p = o.parent; p; p = p.parent) c.push(p.name || p.type); return c.slice(0, 3).join('<') })(),
        })
      })
      return { mode: window.__exp.modes?.mode, objets: out.sort((a, b) => b.tri - a.tri).slice(0, 40), total: out.length }
    })
    const brut = await vider()
    sortie.descente = analyse(brut)
    // le brut sans le condensé : il ne sert plus une fois les écarts calculés,
    // et il pèse 480 nombres par image.
    sortie.brutDescente = brut.map(({ img, ...r }) => r)
  }

  if (SCENARIO === 'remontee') {
    await marque('REMONTEE')
    await vider()
    for (let i = 0; i < CRANS; i++) {
      await molette(120, i)
      await dodo(PERIODE)
      const fini = await page.evaluate(() => (window.__exp.modes?.altM ?? 0) > 3e7 && window.__exp.modes?.mode === 'orbital')
      if (fini) { await marque('ORBITE-ATTEINTE'); break }
    }
    await dodo(2500)
    sortie.remontee = analyse(await vider())
  }

  if (SCENARIO === 'clic') {
    // ⚠️ **LE CLIC N'EST ATTEIGNABLE QU'AU-DESSUS DE LA PORTE GÉOMÉTRIQUE.**
    // `plongeDepuisGlobe` exige `mode === 'orbital'` ; or dès qu'on touche la
    // molette, `_diveArmed` s'arme et la plongée part toute seule vers 12 000 km.
    // On CLIQUE donc sans molette, depuis l'altitude de départ.
    await poserOrbite(DEPART_M)
    await vider()
    await marque('AVANT-CLIC')
    await page.evaluate(() => {
      const el = window.__exp.renderer.domElement
      const r = el.getBoundingClientRect()
      const x = r.left + r.width / 2, y = r.top + r.height / 2
      for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
        el.dispatchEvent(new (type.startsWith('pointer') ? PointerEvent : MouseEvent)(type, {
          clientX: x, clientY: y, bubbles: true, cancelable: true, button: 0, buttons: type.endsWith('down') ? 1 : 0,
          pointerId: 1, pointerType: 'mouse', isPrimary: true,
        }))
      }
      window.__d16.marque = 'CLIC'
    })
    await dodo(6000)
    sortie.clic = analyse(await vider())
  }

  sortie.reseau = await page.evaluate(() => ({ total: window.__d16.reseau.total, tuiles: window.__d16.reseau.tuiles, noms: window.__d16.reseau.noms }))
  sortie.erreurs = erreurs
  fs.writeFileSync(path.join(ICI, `${ETIQ}.json`), JSON.stringify(sortie))
  console.log(`→ .banc/D16/${ETIQ}.json`)
  if (erreurs.length) console.log(`⚠️ ${erreurs.length} erreurs de page : ${erreurs.slice(0, 3).join(' | ')}`)
} finally {
  await nav.close()
}
