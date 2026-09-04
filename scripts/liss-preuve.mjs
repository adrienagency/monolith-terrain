// LISS — LA PREUVE DES TROIS INTERDITS, ET LE PRIX DU LISSAGE.
//
// Tout se fait EN NODE, sur les tuiles réelles du disque, avec notre propre
// décodeur PNG (`liss-png.mjs`) : ni navigateur, ni serveur, ni canevas qui
// « corrigerait » une donnée numérique.
//
// ⛔ AUCUNE ÉCRITURE dans public/data/bathy — c'est une JONCTION PARTAGÉE entre
// une douzaine d'arbres. On lit, on calcule en mémoire, on écrit le relevé dans
// .banc/LISS/.
//
//   node scripts/liss-preuve.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { tuileMetres } from './liss-png.mjs'
import { lisseAbysse, rayonAbyssePx, resolutionBathyM, ABYSSE_M, ABYSSE_FONDU_M, RAYON_ABYSSE_M } from '../src/bathy.js'

const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const BATHY = path.join(RACINE, 'public', 'data', 'bathy')
const ICI = path.join(RACINE, '.banc', 'LISS')
fs.mkdirSync(ICI, { recursive: true })

const lon2x = (lon, z) => Math.floor(((lon + 180) / 360) * 2 ** z)
const lat2y = (lat, z) => {
  const s = Math.sin((lat * Math.PI) / 180)
  return Math.floor(((0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI))) * 2 ** z)
}
const y2lat = (y, z) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** z))) * 180) / Math.PI

// ── les lieux du critère ─────────────────────────────────────────────────────
const LIEUX = [
  { nom: 'Camargue', lat: 43.45, lon: 4.6, quoi: 'littoral' },
  { nom: 'Bretagne (Brest)', lat: 48.4, lon: -4.6, quoi: 'littoral' },
  { nom: 'fjord de Bergen', lat: 60.4, lon: 5.3, quoi: 'littoral' },
  { nom: 'Rodrigues', lat: -19.7, lon: 63.42, quoi: 'littoral' },
  { nom: 'Moorea', lat: -17.53, lon: -149.83, quoi: 'littoral + lagon' },
  { nom: 'lagon de Moorea', lat: -17.48, lon: -149.85, quoi: 'haut-fond' },
  { nom: 'plateau de Saint-Brandon', lat: -16.58, lon: 59.62, quoi: 'haut-fond' },
  { nom: 'Porquerolles', lat: 43.0, lon: 6.2, quoi: 'littoral' },
]

// toutes les tuiles présentes sur disque, par niveau
function tuilesDuNiveau(z, max = Infinity) {
  const base = path.join(BATHY, String(z))
  if (!fs.existsSync(base)) return []
  const out = []
  for (const dx of fs.readdirSync(base)) {
    for (const f of fs.readdirSync(path.join(base, dx))) {
      if (!f.endsWith('.png')) continue
      out.push({ z, x: +dx, y: +f.slice(0, -4) })
      if (out.length >= max) return out
    }
  }
  return out
}

function analyse(t) {
  const f = path.join(BATHY, String(t.z), String(t.x), `${t.y}.png`)
  if (!fs.existsSync(f)) return null
  const { w, h, m } = tuileMetres(f)
  if (w !== h) return null
  const lat = y2lat(t.y + 0.5, t.z)
  const maille = resolutionBathyM(t.z, lat) * (256 / w)
  const r = rayonAbyssePx(maille)
  const d = Float32Array.from(m)
  const t0 = process.hrtime.bigint()
  lisseAbysse(d, w, { mailleM: maille })
  const ms = Number(process.hrtime.bigint() - t0) / 1e6

  let changes = 0
  let violeHautFond = 0   // ⛔ INTERDIT 2 : un pixel au-dessus de −500 m a bougé
  let violeCote = 0       // ⛔ INTERDIT 1 : un pixel émergé (≥ 0) a bougé
  let violeCote2 = 0      // ⛔ INTERDIT 3 : un pixel a changé de côté (signe)
  let maxApresChange = -Infinity  // la valeur la MOINS profonde parmi les modifiés
  let maxDelta = 0
  let somDelta2 = 0
  for (let i = 0; i < m.length; i++) {
    const a = m[i], b = d[i]
    if (a === b) continue
    changes++
    if (a >= -ABYSSE_M) violeHautFond++
    if (a >= 0 || b >= 0) violeCote++
    if ((a < 0) !== (b < 0)) violeCote2++
    if (b > maxApresChange) maxApresChange = b
    const dd = Math.abs(b - a)
    if (dd > maxDelta) maxDelta = dd
    somDelta2 += dd * dd
  }
  // ══════════ LA TRANSITION — Y A-T-IL UNE LIGNE DE NIVEAU À −500 m ? ═════════
  //
  // ⚠️ LA BONNE QUESTION N'EST PAS « quelle est la plus grosse marche du champ
  // de correction Δ » — celle-là tombe là où le RELIEF est le plus raide, et
  // elle ne dit rien du seuil. C'est : **l'isobathe du seuil est-elle un endroit
  // PARTICULIER ?** On compare donc, sur les mêmes tuiles, la marche latérale de
  // Δ sur les paires de pixels qui TRAVERSENT l'isobathe −500 m, à celle des
  // paires entièrement dans l'abysse. Si la première n'excède pas la seconde,
  // il n'y a pas de ligne : il n'y a que du relief.
  let marcheSeuil = 0   // paires qui traversent −500 m
  let marcheAbysse = 0  // paires entièrement sous −1 000 m
  let marcheMax = 0
  let profMarche = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w - 1; x++) {
      const i = y * w + x
      const g = Math.abs((d[i] - m[i]) - (d[i + 1] - m[i + 1]))
      if (g > marcheMax) { marcheMax = g; profMarche = m[i] }
      const a = m[i], b = m[i + 1]
      if ((a < -ABYSSE_M) !== (b < -ABYSSE_M)) { if (g > marcheSeuil) marcheSeuil = g }
      else if (a < -1000 && b < -1000) { if (g > marcheAbysse) marcheAbysse = g }
    }
  }
  // LARGEUR DE LA TRANSITION EN PIXELS : le fondu s'étale de −500 à −1 000 m.
  // On compte, ligne par ligne, combien de pixels séparent les deux isobathes.
  const larg = []
  for (let y = 0; y < h; y++) {
    let debut = -1
    for (let x = 0; x < w; x++) {
      const v = m[y * w + x]
      if (v < -ABYSSE_M && debut < 0) debut = x
      else if (debut >= 0 && v < -(ABYSSE_M + ABYSSE_FONDU_M)) { larg.push(x - debut); debut = -1; break }
      else if (debut >= 0 && v >= -ABYSSE_M) debut = -1
    }
  }
  larg.sort((p, q) => p - q)
  return {
    ...t, w, lat: +lat.toFixed(2), mailleM: +maille.toFixed(0), rayonPx: r,
    pixels: m.length, changes, partChange: +(100 * changes / m.length).toFixed(1),
    violeHautFond, violeCote, violeCote2,
    maxApresChange: Number.isFinite(maxApresChange) ? +maxApresChange.toFixed(2) : null,
    maxDelta: +maxDelta.toFixed(1), rmsDelta: +(changes ? Math.sqrt(somDelta2 / changes) : 0).toFixed(2),
    marcheMax: +marcheMax.toFixed(2), profMarche: +profMarche.toFixed(0),
    marcheSeuil: +marcheSeuil.toFixed(2), marcheAbysse: +marcheAbysse.toFixed(2),
    largeurTransitionPx: larg.length ? larg[Math.floor(larg.length / 2)] : null,
    ms: +ms.toFixed(2),
  }
}

// ══════════ ① LE RAYON PAR NIVEAU — la règle s'éteint sur le grossier ════════
console.log(`\n① RAYON DÉRIVÉ — ${RAYON_ABYSSE_M} m au sol, converti en pixels de tuile`)
console.log('   z   maille équateur   r px   maille 60°N   r px')
for (let z = 4; z <= 12; z++) {
  const m0 = resolutionBathyM(z, 0), m6 = resolutionBathyM(z, 60)
  console.log(`   ${String(z).padStart(2)}   ${m0.toFixed(0).padStart(13)}   ${String(rayonAbyssePx(m0)).padStart(4)}   ${m6.toFixed(0).padStart(11)}   ${String(rayonAbyssePx(m6)).padStart(4)}`)
}

// ══════════ ② LES CINQ LITTORAUX ET LES HAUTS-FONDS ═════════════════════════
console.log('\n② ⛔ LES INTERDITS SUR LES LIEUX DU CRITÈRE (tuile z8, et z10 si présente)')
console.log('   lieu                       z  tuile        r   modifiés   ⛔haut-fond ⛔côte ⛔signe   moins profond modifié')
const lieux = []
for (const L of LIEUX) {
  for (const z of [8, 10, 12]) {
    const t = { z, x: lon2x(L.lon, z), y: lat2y(L.lat, z) }
    const a = analyse(t)
    if (!a) continue
    lieux.push({ lieu: L.nom, quoi: L.quoi, ...a })
    console.log(`   ${(L.nom + ' [' + L.quoi + ']').padEnd(26)} ${z}  ${String(a.x).padStart(5)}/${String(a.y).padEnd(5)} ${String(a.rayonPx).padStart(2)}   ${String(a.changes).padStart(8)}   ${String(a.violeHautFond).padStart(9)} ${String(a.violeCote).padStart(6)} ${String(a.violeCote2).padStart(6)}   ${a.maxApresChange === null ? '—' : a.maxApresChange + ' m'}`)
  }
}

// ══════════ ③ LE BALAYAGE DE MASSE — 600 tuiles réelles ═════════════════════
console.log('\n③ ⛔ BALAYAGE — les interdits sur tout ce que le disque porte')
const masse = []
for (const z of [4, 5, 6, 7, 8, 10, 12]) {
  const liste = tuilesDuNiveau(z, 150)
  if (!liste.length) { console.log(`   z${z} : aucune tuile sur disque`); continue }
  let vh = 0, vc = 0, vs = 0, ch = 0, px = 0, mx = -Infinity, ms = 0, marche = 0
  for (const t of liste) {
    const a = analyse(t)
    if (!a) continue
    masse.push(a)
    vh += a.violeHautFond; vc += a.violeCote; vs += a.violeCote2
    ch += a.changes; px += a.pixels; ms += a.ms
    if (a.maxApresChange !== null && a.maxApresChange > mx) mx = a.maxApresChange
    if (a.marcheMax > marche) marche = a.marcheMax
  }
  console.log(`   z${String(z).padEnd(2)} ${String(liste.length).padStart(4)} tuiles · ${(100 * ch / px).toFixed(1).padStart(5)} % modifiés · ⛔ haut-fond ${vh} · côte ${vc} · signe ${vs} · moins profond modifié ${Number.isFinite(mx) ? mx.toFixed(2) + ' m' : '—'} · ${(ms / liste.length).toFixed(2)} ms/tuile`)
}

const tous = [...lieux, ...masse]
const total = {
  tuiles: tous.length,
  violeHautFond: tous.reduce((s, a) => s + a.violeHautFond, 0),
  violeCote: tous.reduce((s, a) => s + a.violeCote, 0),
  violeSigne: tous.reduce((s, a) => s + a.violeCote2, 0),
  moinsProfondModifie: Math.max(...tous.map((a) => a.maxApresChange ?? -Infinity)),
  marcheMax: Math.max(...tous.map((a) => a.marcheMax)),
  marcheSeuil: Math.max(...tous.map((a) => a.marcheSeuil)),
  marcheAbysse: Math.max(...tous.map((a) => a.marcheAbysse)),
  msMoyen: +(tous.reduce((s, a) => s + a.ms, 0) / tous.length).toFixed(2),
}
console.log(`\n④ VERDICT sur ${total.tuiles} tuiles`)
console.log(`   ⛔ pixels au-dessus de −${ABYSSE_M} m modifiés : ${total.violeHautFond}`)
console.log(`   ⛔ pixels émergés modifiés                    : ${total.violeCote}`)
console.log(`   ⛔ pixels ayant changé de côté (terre/mer)    : ${total.violeSigne}`)
console.log(`   le pixel modifié le MOINS profond            : ${total.moinsProfondModifie.toFixed(2)} m`)
console.log('')
console.log('⑤ LA TRANSITION — l’isobathe du seuil est-elle un endroit PARTICULIER ?')
const seuilM_ = Math.max(...tous.map((a) => a.marcheSeuil))
const abysM_ = Math.max(...tous.map((a) => a.marcheAbysse))
const largs = tous.map((a) => a.largeurTransitionPx).filter((v) => v != null).sort((p, q) => p - q)
console.log(`   marche latérale max de Δ SUR l’isobathe −${ABYSSE_M} m : ${seuilM_.toFixed(2)} m`)
console.log(`   marche latérale max de Δ EN PLEIN ABYSSE (< −1 000 m) : ${abysM_.toFixed(2)} m`)
console.log(`   ⇒ le seuil vaut ${(seuilM_ / (abysM_ || 1)).toFixed(2)} fois l’abysse : ${seuilM_ <= abysM_ ? 'PAS de ligne de niveau' : '⚠ à instruire'}`)
console.log(`   largeur médiane de la bande de fondu (−${ABYSSE_M} → −${ABYSSE_M + ABYSSE_FONDU_M} m) : ${largs[Math.floor(largs.length / 2)]} px (p10 ${largs[Math.floor(0.1 * largs.length)]}, p90 ${largs[Math.floor(0.9 * largs.length)]})`)
const dd = tous.map((a) => a.maxDelta).sort((p, q) => p - q)
console.log('')
console.log(`⑥ CE QUE LE LISSAGE DÉPLACE — |Δ| max par tuile : med ${dd[Math.floor(dd.length / 2)]} m · p90 ${dd[Math.floor(0.9 * dd.length)]} m · max ${dd[dd.length - 1]} m`)
console.log(`   coût                                        : ${total.msMoyen} ms par tuile, UNE FOIS (mémoïsé)`)
fs.writeFileSync(path.join(ICI, 'preuve.json'), JSON.stringify({ total, lieux, masse }, null, 2))
console.log(`\n   → ${path.join(ICI, 'preuve.json')}`)
