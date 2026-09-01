// SONDE R22 — LES PAROIS DU BLOC ET LA GRILLE, MESUREES SUR DES PIXELS.
//
// ⚠️ **PLEINE RESOLUTION, ET C'EST LA RAISON D'ETRE DE CE SCRIPT.** L'instrument
// de R18/R19 condense l'image (256 x 160 au mieux) par une chaine de blits qui
// divisent par deux. Une moyenne de boite ANNULE un motif fin, et le brief de
// R22 le dit en toutes lettres : « une grille EST un motif fin ». On lit donc
// une FENETRE 1:1 du tampon de dessin — aucun redimensionnement, aucun filtre.
//
// Le reste du protocole est celui de R18/R19, sans changement :
//   · on pilote les VRAIS controles du DOM (input.value + evenement `input`,
//     PUIS `change` — certains curseurs ne commitent qu'au relachement) ;
//   · on moyenne N images consecutives pour absorber le mouvement ambiant ;
//   · on mesure un PLANCHER DE BRUIT sur place, deux temoins sans rien toucher ;
//   · deux grandeurs : la moyenne des ecarts de couleur, et le GRADIENT local
//     (|dx| + |dy| de luminance), qui voit un motif la ou la couleur ne bouge pas.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opt = (n, d = null) => {
  const i = args.indexOf(n)
  return i >= 0 && args[i + 1] ? args[i + 1] : d
}
const has = (n) => args.includes(n)

const PORT = Number(opt('--port', '5731'))
const SORTIE = opt('--sortie', path.join(RACINE, '.banc/R22'))
const NOM = opt('--nom', 'releve')
const IMAGES = Number(opt('--images', '8'))
const REPOS_MS = Number(opt('--repos', '900'))
const VISIBLE = has('--visible')
const CAPTURES = has('--captures')
// La fenetre lue, en pixels du tampon de dessin, centree. 1:1, jamais reduite.
const FEN_L = Number(opt('--fenL', '512'))
const FEN_H = Number(opt('--fenH', '320'))

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

// ══════════ L'INSTRUMENT — UNE FENETRE 1:1, PAS UN CONDENSE ═════════════════
function poserInstrumentR22(FEN_L, FEN_H, PROF) {
  const e = window.__exp
  if (!e) return 'pas de __exp'
  if (window.__r22) return 'déjà posé'
  const R = e.renderer
  const gl = R.getContext()
  const CV = R.domElement
  const px = new Uint8Array(FEN_L * FEN_H * 4)
  // ⚠️ readPixels DIRECT sur le tampon de dessin, dans une fenetre centree.
  // Aucun blit, donc aucun filtrage : un trait d'un pixel reste un trait d'un
  // pixel. C'est tout l'ecart avec l'instrument de R18.
  function lire() {
    const x0 = Math.max(0, (CV.width - FEN_L) >> 1)
    const y0 = Math.max(0, (CV.height - FEN_H) >> 1)
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null)
    gl.readPixels(x0, y0, FEN_L, FEN_H, gl.RGBA, gl.UNSIGNED_BYTE, px)
    R.resetState?.()
    const t = new Float32Array(FEN_L * FEN_H * 3)
    for (let i = 0, j = 0; i < FEN_L * FEN_H; i++) { t[j++] = px[i * 4]; t[j++] = px[i * 4 + 1]; t[j++] = px[i * 4 + 2] }
    return t
  }
  const N = FEN_L * FEN_H * 3
  const etat = { n: 0, slots: {}, FEN_L, FEN_H, erreur: null }
  window.__r22 = etat
  const tampon = []
  function boucle() {
    try {
      tampon.push(lire())
      if (tampon.length > PROF) tampon.shift()
      etat.n++
    } catch (err) { etat.erreur = String(err).slice(0, 160) }
    requestAnimationFrame(boucle)
  }
  function gradientDe(moy) {
    const g = new Float32Array(FEN_L * FEN_H)
    const lum = new Float32Array(FEN_L * FEN_H)
    for (let i = 0; i < FEN_L * FEN_H; i++) lum[i] = 0.299 * moy[i * 3] + 0.587 * moy[i * 3 + 1] + 0.114 * moy[i * 3 + 2]
    for (let y = 0; y < FEN_H; y++) for (let x = 0; x < FEN_L; x++) {
      const i = y * FEN_L + x
      const dx = x + 1 < FEN_L ? Math.abs(lum[i + 1] - lum[i]) : 0
      const dy = y + 1 < FEN_H ? Math.abs(lum[i + FEN_L] - lum[i]) : 0
      g[i] = dx + dy
    }
    return g
  }
  etat.vider = () => { tampon.length = 0; etat.n = 0 }
  etat.pret = (k) => tampon.length >= k
  etat.capturer = (nom, k) => {
    const im = tampon.slice(-k)
    if (!im.length) return 0
    const moy = new Float32Array(N)
    for (const t of im) for (let i = 0; i < N; i++) moy[i] += t[i]
    for (let i = 0; i < N; i++) moy[i] /= im.length
    etat.slots[nom] = { moy, grad: gradientDe(moy) }
    return im.length
  }
  etat.distance = (a, b) => {
    const A = etat.slots[a], B = etat.slots[b]
    if (!A || !B) return null
    let sm = 0
    for (let i = 0; i < N; i++) sm += Math.abs(A.moy[i] - B.moy[i])
    let sg = 0
    for (let i = 0; i < FEN_L * FEN_H; i++) sg += Math.abs(A.grad[i] - B.grad[i])
    return { moy: sm / N, grad: sg / (FEN_L * FEN_H) }
  }
  requestAnimationFrame(boucle)
  return 'posé'
}

// ══════════ LES CONTROLES DU DOM, RETROUVES PAR LEUR LIBELLE ════════════════
function poserControles() {
  const nomDe = (r) => {
    const lab = r.querySelector('.ce-label')
    return lab ? [...lab.childNodes].filter((x) => x.nodeType === 3).map((x) => x.textContent).join('').trim() : ''
  }
  const table = new Map()
  for (const r of document.querySelectorAll('.ce-row')) {
    const nom = nomDe(r)
    if (!nom || table.has(nom)) continue
    table.set(nom, r)
  }
  window.__r22.lignes = table
  window.__r22.pose = (nom, v) => {
    const r = table.get(nom)
    if (!r) return 'absent'
    const rng = r.querySelector('input[type=range]')
    const col = r.querySelector('input[type=color]')
    const tog = r.querySelector('button.ce-toggle')
    if (rng) {
      rng.value = String(v)
      rng.dispatchEvent(new Event('input', { bubbles: true }))
      rng.dispatchEvent(new Event('change', { bubbles: true }))
      return rng.value
    }
    if (col) {
      col.value = String(v)
      col.dispatchEvent(new Event('input', { bubbles: true }))
      col.dispatchEvent(new Event('change', { bubbles: true }))
      return col.value
    }
    if (tog) {
      const veut = v === true || v === 'on'
      if (tog.classList.contains('on') !== veut) tog.click()
      return tog.classList.contains('on') ? 'on' : 'off'
    }
    return 'type inconnu'
  }
  window.__r22.visible = (nom) => {
    const r = table.get(nom)
    if (!r) return 'absent'
    return r.style.display === 'none' ? 'cachée' : 'visible'
  }
  return [...table.keys()]
}

const dodo = (ms) => new Promise((r) => setTimeout(r, ms))

// ══════════ LES ESSAIS ══════════════════════════════════════════════════════
// Chaque essai : un libelle de controle, une valeur AVANT et une valeur APRES.
// Le temoin (meme etat deux fois) est mesure au meme endroit, dans la meme passe.
const ESSAIS = [
  { id: '48-socle', label: 'Afficher le socle', avant: true, apres: false, titre: 'Afficher le socle (48) — allumé → éteint' },
  { id: '50-tranche', label: 'Couleur de la tranche', avant: '#d8d4cc', apres: '#ff2000', titre: 'Couleur de la tranche (50) — beige → rouge' },
  { id: '20-opacite', label: 'Opacité de la grille', avant: '0', apres: '1', titre: 'Opacité de la grille (20) — 0 → 1' },
  { id: '19-taille', label: 'Taille de la grille', avant: '14', avantAussi: [['Opacité de la grille', '1']], apres: '2', titre: 'Taille de la grille (19) — 14 → 2 (opacité 1)' },
  // ⚡ EN PRIME, ET IL N'ÉTAIT PAS DEMANDÉ : l'encre de la grille. Elle vient
  // avec, parce qu'une grille peinte à l'encre des COURBES aurait été d'une
  // autre couleur que celle du socle au même réglage.
  // ⚠️ **CELUI-CI NE PASSE PAS PAR UNE `.ce-row`, ET IL FAUT LE DIRE.** Le
  // nuancier « Grille » vit dans le FORMULAIRE DE CRÉATION DE PALETTE
  // (`create-panel.js`, `buildPaletteCreation`), qui n'est pas monté tant qu'on
  // n'a pas cliqué « Créer une palette » : la sonde ne le trouve pas dans le
  // DOM, et le premier tour a rendu « absent » — pas « ne fait rien ».
  // On emprunte donc l'AUTRE chemin réel de cette valeur, celui des palettes et
  // des gabarits : `applyGridContour`, exposé sur `__exp`. Ce n'est pas un
  // chemin parallèle inventé pour la mesure — c'est celui que `applyPalette`,
  // `applyTemplate` et `resetAll` empruntent tous.
  {
    id: '19b-encre',
    titre: 'Couleur « Grille » — encre sombre → rouge (opacité 1, pas 2), par `applyGridContour`',
    avantAussi: [['Opacité de la grille', '1'], ['Taille de la grille', '2']],
    js: (hex) => {
      const e = window.__exp
      e.applyGridContour({
        contourInterval: e.params.contourInterval,
        contourOpacity: e.params.contourOpacity,
        contourColor: e.params.contourColor,
        contourWeight: e.params.contourWeight,
        gridStep: e.terrain.mapUniforms.uGridStep.value,
        gridOpacity: e.terrain.mapUniforms.uGridOpacity.value,
        gridColor: hex,
      })
      return '#' + e.terrain.mapUniforms.uGridColor.value.getHexString()
    },
    avant: '#242220',
    apres: '#ff2000',
  },
]

const puppeteer = await chargerPuppeteer()
const nav = await puppeteer.launch({
  executablePath: trouverChrome(),
  headless: !VISIBLE,
  args: [...(VISIBLE ? [] : ['--headless=new']), '--no-sandbox',
    '--window-size=1280,900', '--autoplay-policy=no-user-gesture-required'],
})
fs.mkdirSync(SORTIE, { recursive: true })
const rapport = { port: PORT, images: IMAGES, reposMs: REPOS_MS, fenetre: [FEN_L, FEN_H], essais: [] }

try {
  const page = await nav.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  const erreurs = []
  page.on('pageerror', (er) => erreurs.push(String(er.message).slice(0, 200)))
  await page.evaluateOnNewDocument(() => {
    try {
      localStorage.setItem('shibumap-ui-advanced', '1')
      localStorage.setItem('shibumap-workmode', 'studio')
    } catch {}
  })

  async function preparer() {
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 120000 })
    await page.waitForFunction(() => window.__exp?.modes && window.__exp?.globe && window.__exp?.composer, { timeout: 90000, polling: 100 })
    await dodo(9000)
    await page.keyboard.press('Escape')
    await dodo(3000)
    await page.evaluate(() => {
      for (const p of document.querySelectorAll('.ce-panel')) p.classList.remove('collapsed')
      for (const s of document.querySelectorAll('.ce-section')) s.classList.add('open')
      document.body.classList.add('ce-railL-off', 'ce-railR-off')
    })
    await dodo(1200)
    // ⚡ LE MOUVEMENT AMBIANT EST COUPE — le globe tourne seul a ~1,9 °/s apres
    // 3 s d'inactivite, et un releve sur une scene qui derive ne mesure que la
    // derive. Le plancher de bruit le prouve : deux temoins consecutifs.
    await page.evaluate(() => { window.__exp.params.animations = false })
    await dodo(1500)
    await page.evaluate(poserInstrumentR22, FEN_L, FEN_H, Math.max(IMAGES + 4, 12))
    await dodo(600)
    return page.evaluate(poserControles)
  }

  const libelles = await preparer()
  rapport.gpu = await page.evaluate(() => {
    try {
      const gl = window.__exp?.renderer?.getContext?.()
      const d = gl?.getExtension('WEBGL_debug_renderer_info')
      return d ? String(gl.getParameter(d.UNMASKED_RENDERER_WEBGL)) : 'inconnu'
    } catch (er) { return 'erreur: ' + er.message }
  })
  rapport.etat = await page.evaluate(() => {
    const e = window.__exp
    const u = e.globe?.uniforms || {}
    const val = (k) => (u[k]?.value?.getHexString ? '#' + u[k].value.getHexString() : u[k]?.value ?? null)
    return {
      mode: e.modes?.mode,
      cropOn: val('uCropOn'), habOn: val('uHabOn'),
      cropDemi: val('uCropDemi'), cropCentre: u.uCropCentre ? [u.uCropCentre.value.x, u.uCropCentre.value.y] : null,
      gridStepBloc: e.terrain?.mapUniforms?.uGridStep?.value ?? null,
      gridOpacite: e.terrain?.mapUniforms?.uGridOpacity?.value ?? null,
      gridColor: e.terrain?.mapUniforms?.uGridColor?.value ? '#' + e.terrain.mapUniforms.uGridColor.value.getHexString() : null,
      contourIntervalGlobeM: val('uContourInterval'),
      grillePasM: val('uGridStepM'), grilleOpaciteGlobe: val('uGridOpacity'), cropDemiM: val('uCropDemiM'),
      slabHalf: e.terrain?.mapUniforms?.uSlabHalf?.value ?? null,
      extentMeters: e.terrain?.dem?.extentMeters ?? null,
      empriseCote: e.terrain?.dem?.empriseCote ?? null,
      plinthParam: e.params?.plinth ?? null,
      plinthColorParam: e.params?.plinthColor ?? null,
      wallMatColor: e.plinth?.wallMat?.color ? '#' + e.plinth.wallMat.color.getHexString() : null,
      paroiCouleurUniforme: val('uParoiCouleur'),
      paroisVisibles: e.globe?._parois?.visible ?? null,
      camera: e.camera ? [e.camera.position.x, e.camera.position.y, e.camera.position.z] : null,
      cible: e.controls?.target ? [e.controls.target.x, e.controls.target.y, e.controls.target.z] : null,
      fov: e.camera?.fov ?? null,
    }
  })
  rapport.libelles = libelles.filter((n) => /grille|socle|tranche|courbes/i.test(n))
  rapport.visibilite = await page.evaluate((noms) => Object.fromEntries(noms.map((n) => [n, window.__r22.visible(n)])),
    ['Afficher le socle', 'Couleur de la tranche', 'Taille de la grille', 'Opacité de la grille'])

  async function capturer(nom) {
    await page.evaluate(() => window.__r22.vider())
    await page.waitForFunction((k) => window.__r22.pret(k), { polling: 60, timeout: 30000 }, IMAGES)
    return page.evaluate((n, k) => window.__r22.capturer(n, k), nom, IMAGES)
  }

  for (const ess of ESSAIS) {
    const ligne = { id: ess.id, titre: ess.titre, label: ess.label }
    // état AVANT
    for (const [l, v] of ess.avantAussi || []) await page.evaluate((a, b) => window.__r22.pose(a, b), l, v)
    ligne.poseAvant = ess.js
      ? await page.evaluate(ess.js, ess.avant)
      : await page.evaluate((l, v) => window.__r22.pose(l, v), ess.label, ess.avant)
    await dodo(REPOS_MS)
    await capturer('avant')
    // témoin : le MÊME état, une seconde fois — le plancher de bruit sur place
    await dodo(REPOS_MS)
    await capturer('temoin')
    ligne.plancher = await page.evaluate(() => window.__r22.distance('avant', 'temoin'))
    if (CAPTURES) await page.screenshot({ path: path.join(SORTIE, `${ess.id}-avant.png`) })
    // état APRÈS
    ligne.poseApres = ess.js
      ? await page.evaluate(ess.js, ess.apres)
      : await page.evaluate((l, v) => window.__r22.pose(l, v), ess.label, ess.apres)
    await dodo(REPOS_MS)
    await capturer('apres')
    ligne.ecart = await page.evaluate(() => window.__r22.distance('avant', 'apres'))
    if (CAPTURES) await page.screenshot({ path: path.join(SORTIE, `${ess.id}-apres.png`) })
    ligne.uniformes = await page.evaluate(() => {
      const e = window.__exp
      const u = e.globe?.uniforms || {}
      const v = (k) => (u[k]?.value?.getHexString ? '#' + u[k].value.getHexString() : u[k]?.value ?? null)
      return {
        gridStepBloc: e.terrain?.mapUniforms?.uGridStep?.value ?? null,
        gridOpaciteBloc: e.terrain?.mapUniforms?.uGridOpacity?.value ?? null,
        grillePasM: v('uGridStepM'), grilleOpaciteGlobe: v('uGridOpacity'), cropDemiM: v('uCropDemiM'),
        paroiCouleur: v('uParoiCouleur'),
        wallMatColor: e.plinth?.wallMat?.color ? '#' + e.plinth.wallMat.color.getHexString() : null,
        paroisVisibles: e.globe?._parois?.visible ?? null,
        gridColorBloc: e.terrain?.mapUniforms?.uGridColor?.value ? '#' + e.terrain.mapUniforms.uGridColor.value.getHexString() : null,
        gridColorGlobe: u.uGridColor?.value?.getHexString ? '#' + u.uGridColor.value.getHexString() : null,
      }
    })
    // retour à l'état d'avant, pour ne pas contaminer l'essai suivant
    if (ess.js) await page.evaluate(ess.js, ess.avant)
    else await page.evaluate((l, v) => window.__r22.pose(l, v), ess.label, ess.avant)
    for (const [l] of ess.avantAussi || []) await page.evaluate((a) => window.__r22.pose(a, '0'), l)
    await dodo(REPOS_MS)
    rapport.essais.push(ligne)
    console.log(`${ess.id}  écart moy ${ligne.ecart?.moy?.toFixed(4)} / grad ${ligne.ecart?.grad?.toFixed(4)}   plancher ${ligne.plancher?.moy?.toFixed(4)} / ${ligne.plancher?.grad?.toFixed(4)}`)
  }
  // ══════ LE SOCLE ÉTEINT SURVIT-IL À UNE RECONSTRUCTION DES PAROIS ? ═══════
  //
  // ⚠️ **C'EST LE RISQUE N° 1 DE L'OPTION 48, ET IL NE SE VOIT PAS SUR UNE
  // IMAGE FIXE.** `construireParoisCrop` fabrique un mesh NEUF à chaque
  // déplacement. On éteint le socle, on force une reconstruction, et on relit.
  rapport.persistance = await page.evaluate(async () => {
    const e = window.__exp
    const nomDe = (r) => {
      const lab = r.querySelector('.ce-label')
      return lab ? [...lab.childNodes].filter((x) => x.nodeType === 3).map((x) => x.textContent).join('').trim() : ''
    }
    for (const r of document.querySelectorAll('.ce-row')) {
      if (nomDe(r) !== 'Afficher le socle') continue
      const t = r.querySelector('button.ce-toggle')
      if (t?.classList.contains('on')) t.click()
    }
    const avant = {
      retenu: e.globe._paroisVisibles,
      mesh: e.globe._parois?.visible ?? null,
      uuid: e.globe._parois?.uuid ?? null,
    }
    // ⚠️ **ON REJOUE LE MAILLON DU BRANCHEMENT, PAS UN CHEMIN PARALLÈLE** :
    // `branchement-crop.js` appelle `construireParoisCrop(parois || undefined)`
    // à chaque changement de lieu. Sans argument, elle reprend ses défauts.
    let rebati = 'non tenté'
    try {
      const r = e.globe.construireParoisCrop(undefined)
      rebati = r ? (r.refus ? `refus: ${r.refus}` : 'rebâti') : 'pas de crop'
    } catch (err) { rebati = 'erreur: ' + String(err.message).slice(0, 90) }
    const apres = {
      retenu: e.globe._paroisVisibles,
      mesh: e.globe._parois?.visible ?? null,
      uuid: e.globe._parois?.uuid ?? null,
    }
    return { avant, rebati, apres, meshNeuf: avant.uuid !== apres.uuid }
  })
  rapport.erreurs = erreurs
} finally {
  await nav.close()
}
fs.writeFileSync(path.join(SORTIE, `${NOM}.json`), JSON.stringify(rapport, null, 2), { encoding: 'utf8' })
console.log('→', path.join(SORTIE, `${NOM}.json`))
