// LA LUMIÈRE DE LA MER — Tâche EAU (2026-09-05).
//
// ① la LOI vit dans `src/monde/eau-lumiere.js` (module pur) et se vérifie sous
//    node, chiffre par chiffre, contre ses SOURCES (Schlick, Cox & Munk) ;
// ② le GLSL est TRADUIT puis EXÉCUTÉ contre les jumeaux JS — le protocole de
//    `test/eau-refraction.test.js` : seuls les mots du langage sont remplacés,
//    aucune formule n'est réécrite ici ;
// ③ `MER_FRAG` (`src/globe.js`) INJECTE le texte et n'en réécrit aucune formule.
//
// ⚠️ **CE QUI RESTE HORS DE PORTÉE** : que la mer soit BELLE. Seul l'écran le
// dit — `scripts/sonde-eau.mjs`, `.banc/EAU/pour-adrien/`, et l'œil d'Adrien.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  F0_EAU, INDICE_EAU, schlickEau,
  COX_MUNK, varianceCoxMunk, VENT_DE_HOULE, ventDeHoule,
  PLAFOND_GLITTER, glitterSoleil,
  SSS, lueurSousSurface,
  SEUIL_CRETE, creteMoutonnante, couvertureMoutons,
  CIEL, cielReflechi,
  GLSL_EAU_LUMIERE,
} from '../src/monde/eau-lumiere.js'

const GLOBE_SRC = readFileSync(new URL('../src/globe.js', import.meta.url), 'utf8')
const OCEAN_SRC = readFileSync(new URL('../src/ocean.js', import.meta.url), 'utf8')
const sansComm = (s) => s.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
const GLOBE_NU = sansComm(GLOBE_SRC)

// ══════════ L'OUTILLAGE — TRADUIRE LE GLSL, PUIS L'EXÉCUTER ════════════════

const CLAMP = (x, a, b) => Math.min(Math.max(x, a), b)
const MIX = (a, b, t) => Array.isArray(a) ? a.map((x, i) => x + (b[i] - x) * t) : a + (b - a) * t
const SMOOTHSTEP = (a, b, x) => { const t = CLAMP((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t) }
const MUL = (a, b) => Array.isArray(a) ? a.map((x, i) => x * (Array.isArray(b) ? b[i] : b)) : (Array.isArray(b) ? b.map((y) => a * y) : a * b)

function traduire(glsl) {
  return glsl
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\b(?:float|vec2|vec3)\s+(\w+)\s*\(([^)]*)\)\s*\{/g, (_, nom, args) => {
      const noms = args.split(',').map((a) => a.trim().split(/\s+/).pop()).filter(Boolean)
      return `function ${nom}(${noms.join(', ')}) {`
    })
    .replace(/\bfloat\s+(\w+)\s*=/g, 'let $1 =')
    .replace(/\bvec3\s*\(([^()]*)\)/g, '[$1]')
    .replace(/\bclamp\s*\(/g, 'CLAMP(')
    .replace(/\bsmoothstep\s*\(/g, 'SMOOTHSTEP(')
    .replace(/\bmix\s*\(/g, 'MIX(')
    .replace(/\bmax\s*\(/g, 'Math.max(')
    .replace(/\bmin\s*\(/g, 'Math.min(')
    .replace(/\bexp\s*\(/g, 'Math.exp(')
    .replace(/\bpow\s*\(/g, 'Math.pow(')
    // les deux produits vecteur × scalaire / vecteur × vecteur de cielReflechi
    .replace(/horizon \* bas/g, 'MUL(horizon, bas)')
    .replace(/horizon \* \[([^\]]*)\]/g, 'MUL(horizon, [$1])')
}

// eslint-disable-next-line no-new-func
const NUANCEUR = new Function('CLAMP', 'MIX', 'SMOOTHSTEP', 'MUL',
  `${traduire(GLSL_EAU_LUMIERE)}
   return { schlickEau, varianceCoxMunk, glitterSoleil, lueurSousSurface, creteMoutonnante, cielReflechi }`
)(CLAMP, MIX, SMOOTHSTEP, MUL)

function* balayage(n = 23) { for (let i = 0; i <= n; i++) yield i / n }
const proche = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps

// ══════════ ① FRESNEL ═══════════════════════════════════════════════════════

test('①a F0 = 0,02 est DÉRIVÉ de l indice de l eau, pas posé', () => {
  const r0 = ((1 - INDICE_EAU) / (1 + INDICE_EAU)) ** 2
  assert.ok(Math.abs(r0 - F0_EAU) < 5e-4, `((1 − n)/(1 + n))² = ${r0}`)
  assert.equal(INDICE_EAU, 1.333)
})

test('①b Schlick : 0,02 au nadir, 1,0 au rasant — le critère du brief (≈ 1,0 / 0,02)', () => {
  assert.equal(schlickEau(1), F0_EAU)
  assert.equal(schlickEau(0), 1)
  // le rapport rasant / nadir du brief
  assert.ok(proche(schlickEau(0) / schlickEau(1), 50))
  // ⚠️ MONOTONE — c est ce qui tue un exposant retourné ou un signe inversé
  let prec = schlickEau(1)
  for (const t of balayage()) {
    const f = schlickEau(1 - t)
    assert.ok(f >= prec, `Schlick doit croître quand N·V baisse : ${f} < ${prec}`)
    prec = f
  }
  // et l ancienne loi du crop, rejouée comme TÉMOIN : 0 au nadir, 0,175 au rasant
  const ancienne = (c) => Math.min(Math.pow(1 - c, 5), 0.5) * 0.35
  assert.equal(ancienne(1), 0)
  assert.equal(ancienne(0), 0.175)
  assert.ok(schlickEau(0) / ancienne(0) > 5, 'la mer d avant ne devenait jamais un miroir')
})

test('①c le GLSL de Schlick, traduit et exécuté, EST le jumeau JS', () => {
  for (const t of balayage(41)) assert.ok(proche(NUANCEUR.schlickEau(t), schlickEau(t), 1e-12), `cos = ${t}`)
  assert.ok(proche(NUANCEUR.schlickEau(1.7), schlickEau(1.7)), 'écrêté au-dessus de 1')
  assert.ok(proche(NUANCEUR.schlickEau(-0.3), schlickEau(-0.3)), 'écrêté sous 0')
})

// ══════════ ② COX & MUNK ════════════════════════════════════════════════════

test('②a la variance des pentes est celle de Cox & Munk (1954) : σ² = 0,003 + 0,00512 U, la MOITIÉ par axe', () => {
  assert.deepEqual({ ...COX_MUNK }, { base: 0.003, pente: 0.00512, ventMax: 14 })
  assert.ok(proche(varianceCoxMunk(0), 0.0015))
  assert.ok(proche(varianceCoxMunk(10), (0.003 + 0.0512) / 2))
  // bornée à la plage MESURÉE : au-delà de 14 m/s on n extrapole pas
  assert.equal(varianceCoxMunk(40), varianceCoxMunk(14))
  assert.equal(varianceCoxMunk(-5), varianceCoxMunk(0))
  for (const t of balayage(41)) assert.ok(proche(NUANCEUR.varianceCoxMunk(t * 20), varianceCoxMunk(t * 20), 1e-12))
})

test('②b le vent dérivé de la houle reste dans la plage de Cox & Munk, et suit la houle', () => {
  assert.deepEqual({ ...VENT_DE_HOULE }, { base: 2, gain: 4 })
  assert.equal(ventDeHoule(0.5), 4)
  assert.equal(ventDeHoule(2), 10)
  assert.equal(ventDeHoule(100), COX_MUNK.ventMax)
  assert.equal(ventDeHoule(NaN), VENT_DE_HOULE.base)
  assert.ok(ventDeHoule(1) > ventDeHoule(0.5))
})

// ══════════ ③ LE MIROITEMENT ═══════════════════════════════════════════════

test('③a le miroitement est MAXIMAL quand H = N, décroît avec l angle, et s ÉLARGIT avec le vent', () => {
  const s2calme = varianceCoxMunk(2), s2vent = varianceCoxMunk(12)
  const pic = glitterSoleil(1, 0.7, 0.7, s2calme)
  assert.ok(pic > 0)
  let prec = pic
  for (const t of balayage(30)) {
    const c = 1 - 0.6 * t
    const g = glitterSoleil(c, 0.7, 0.7, s2calme)
    assert.ok(g <= prec + 1e-12, `le lobe doit décroître quand N·H baisse : ${g} > ${prec}`)
    prec = g
  }
  // à mi-lobe (N·H = 0,97), une mer ventée miroite PLUS qu une mer calme — la
  // tache s élargit avec le vent (Cox & Munk : « the surface gets steadily
  // rougher as the wind blows harder »)
  assert.ok(glitterSoleil(0.97, 0.7, 0.7, s2vent) > glitterSoleil(0.97, 0.7, 0.7, s2calme))
  // et le pic, lui, est PLUS BAS par vent fort : l énergie s étale
  assert.ok(glitterSoleil(1, 0.7, 0.7, s2vent) < glitterSoleil(1, 0.7, 0.7, s2calme))
  // le plafond est la borne visible
  assert.equal(glitterSoleil(1, 0.7, 0.7, 1e-5), PLAFOND_GLITTER)
})

test('③b le lobe est une distribution : son intégrale sur les pentes vaut ~1 (Beckmann normalisée)', () => {
  // ∫ D(θh) cosθh sinθh dθh dφ = 1 pour Beckmann. On intègre numériquement le
  // D nu, extrait de glitterSoleil en divisant par F/(4 N·V) avec F ≡ 1
  // (vDotH = 0 ⇒ Schlick = 1) et nDotV = 1 ⇒ facteur 1/4, remis par × 4.
  // ⚠️ Vent 12 m/s : au pic, D vaut 1/(2π σ²) = 4,9, sous le plafond de 6 —
  // le premier jet, à 6 m/s, tombait sous le plafond et l intégrale rendait
  // 0,62 : c est le plafond qui manquait, pas la loi.
  const s2 = varianceCoxMunk(12)
  let somme = 0
  const n = 4000
  for (let i = 0; i < n; i++) {
    const th = ((i + 0.5) / n) * (Math.PI / 2)
    const c = Math.cos(th)
    const D = 4 * glitterSoleil(c, 0, 1, s2)
    assert.ok(D < 4 * PLAFOND_GLITTER, 'le plafond ne doit pas mordre ici')
    somme += D * c * Math.sin(th) * (Math.PI / 2 / n) * 2 * Math.PI
  }
  assert.ok(Math.abs(somme - 1) < 0.05, `intégrale ${somme}`)
})

test('③c le GLSL du miroitement, traduit et exécuté, EST le jumeau JS', () => {
  for (const t of balayage(19)) {
    for (const u of [0.1, 0.5, 0.9]) {
      const a = NUANCEUR.glitterSoleil(1 - 0.3 * t, u, 0.2 + 0.7 * u, varianceCoxMunk(u * 14))
      const b = glitterSoleil(1 - 0.3 * t, u, 0.2 + 0.7 * u, varianceCoxMunk(u * 14))
      assert.ok(Math.abs(a - b) < 1e-9 * Math.max(1, b), `${a} ≠ ${b}`)
    }
  }
})

// ══════════ ④ LA LUEUR SOUS-SURFACE ════════════════════════════════════════

test('④a la lueur vit dans les CRÊTES, à CONTRE-JOUR, et ce qui est réfléchi n y entre pas', () => {
  assert.deepEqual({ ...SSS }, { poidsHauteur: 0.65, poidsCrete: 0.35, expo: 3, gain: 0.9 })
  assert.equal(lueurSousSurface(0, 0, 1, 0), 0, 'eau plate : rien')
  assert.equal(lueurSousSurface(1, 1, 0, 0), 0, 'dos au soleil : rien')
  assert.equal(lueurSousSurface(1, 1, -1, 0), 0, 'soleil dans le dos : rien (pas de négatif)')
  assert.ok(proche(lueurSousSurface(1, 1, 1, 0), SSS.gain))
  assert.equal(lueurSousSurface(1, 1, 1, 1), 0, 'tout réfléchi : rien ne rentre')
  assert.ok(lueurSousSurface(1, 0, 1, 0) > lueurSousSurface(0, 1, 1, 0), 'la hauteur pèse plus que la crête')
  // monotone en angle
  let prec = 0
  for (const t of balayage()) { const l = lueurSousSurface(1, 1, t, 0); assert.ok(l >= prec); prec = l }
  for (const t of balayage(11)) for (const c of [0, 0.5, 1]) {
    assert.ok(proche(NUANCEUR.lueurSousSurface(t, c, 0.8, 0.1), lueurSousSurface(t, c, 0.8, 0.1), 1e-12))
  }
})

// ══════════ ④bis LES MOUTONS ═══════════════════════════════════════════════

test('④b seule la part la plus cambrée de la crête moutonne, et la couverture visée est celle de Monahan', () => {
  assert.equal(SEUIL_CRETE, 0.62)
  assert.equal(creteMoutonnante(0), 0)
  assert.equal(creteMoutonnante(SEUIL_CRETE), 0)
  assert.equal(creteMoutonnante(1), 1)
  assert.equal(creteMoutonnante(1.5), 1, 'le jacobien peut dépasser 1 (clamp 1,5 dans oceanGerstner) : borné')
  assert.equal(creteMoutonnante(NaN), 0)
  let prec = 0
  for (const t of balayage()) { const c = creteMoutonnante(t); assert.ok(c >= prec); prec = c }
  // au seuil de la loi du socle (0,30 → 0,60), la crête remise à l échelle ne
  // mousse PAS : c est ce qui retire les plaques
  assert.equal(creteMoutonnante(0.6), 0)
  for (const t of balayage(21)) assert.ok(proche(NUANCEUR.creteMoutonnante(t * 1.5), creteMoutonnante(t * 1.5), 1e-12))
  // Monahan & O Muircheartaigh (1980) : 1 % à 10 m/s, croissance en U^3,41
  assert.ok(Math.abs(couvertureMoutons(10) - 0.0099) < 5e-4, `${couvertureMoutons(10)}`)
  assert.ok(couvertureMoutons(14) > 0.03 && couvertureMoutons(14) < 0.04)
  assert.ok(couvertureMoutons(5) < 0.002)
  assert.match(GLOBE_NU, /float creteEcume = vraieEau \? creteMoutonnante\(vCrete\) : vCrete;/)
  assert.match(GLOBE_NU, /ecumeMer\(creteEcume, fonduRive,/)
})

// ══════════ ⑤ LE CIEL RÉFLÉCHI ═════════════════════════════════════════════

test('⑤a le ciel est un DÉGRADÉ : horizon au rasant, zénith plus sombre et plus bleu en haut, mer sous l horizon', () => {
  const horizon = [0.74, 0.85, 0.92]
  assert.deepEqual(cielReflechi(horizon, 0), horizon)
  const haut = cielReflechi(horizon, 1)
  assert.deepEqual(haut, horizon.map((h, i) => h * CIEL.zenith[i]))
  assert.ok(haut[2] / haut[0] > horizon[2] / horizon[0], 'le zénith est plus bleu')
  assert.ok(haut[0] + haut[1] + haut[2] < horizon[0] + horizon[1] + horizon[2], 'et plus sombre')
  const bas = cielReflechi(horizon, -0.3)
  assert.deepEqual(bas, horizon.map((h) => h * CIEL.sousHorizon))
  for (const t of balayage(11)) {
    const e = -0.5 + 2 * t
    const a = NUANCEUR.cielReflechi(horizon, e), b = cielReflechi(horizon, e)
    for (let i = 0; i < 3; i++) assert.ok(proche(a[i], b[i], 1e-12), `élévation ${e}`)
  }
})

// ══════════ ⑥ L INJECTION — UNE SEULE ÉCRITURE ═════════════════════════════

test('⑥a `MER_FRAG` INJECTE `GLSL_EAU_LUMIERE` et ne réécrit aucune de ses formules', () => {
  assert.match(GLOBE_SRC, /\$\{GLSL_EAU_LUMIERE\}/)
  assert.match(GLOBE_SRC, /import \{ GLSL_EAU_LUMIERE, ventDeHoule \} from '\.\/monde\/eau-lumiere\.js'/)
  // le corps des cinq fonctions n apparaît qu une fois dans le dépôt : ici
  for (const motif of [/float schlickEau\(/, /float varianceCoxMunk\(/, /float glitterSoleil\(/, /float lueurSousSurface\(/, /float creteMoutonnante\(/, /vec3 cielReflechi\(/]) {
    assert.doesNotMatch(GLOBE_NU, motif, `${motif} réécrite dans globe.js`)
    assert.doesNotMatch(sansComm(OCEAN_SRC), motif, `${motif} réécrite dans ocean.js`)
  }
  // et le fragment les APPELLE toutes les cinq
  for (const nom of ['schlickEau(', 'varianceCoxMunk(', 'glitterSoleil(', 'lueurSousSurface(', 'cielReflechi(']) {
    assert.ok(GLOBE_NU.includes(nom), `${nom} n est pas appelée par MER_FRAG`)
  }
})

test('⑥b `uMerVraieEau` à zéro rend la loi d AVANT au caractère près — l instrument de l A/B', () => {
  // la branche else porte les DEUX lignes historiques, telles quelles
  assert.match(GLOBE_NU, /col = mix\(col, uSky, fres \* 0\.35\);/)
  assert.match(GLOBE_NU, /pow\(max\(dot\(N, H\), 0\.0\), uMerBrillance\) \* \(0\.5 \+ 1\.6 \* fres\)/)
  // et le Fresnel d avant sous le même interrupteur
  assert.match(GLOBE_NU, /float fres = vraieEau \? schlickEau\(nDotV\) : min\(pow\(1\.0 - nDotV, 5\.0\), 0\.5\);/)
  // le sommet publie la hauteur normalisée, le fragment la lit
  assert.match(GLOBE_NU, /varying float vHouleH;[\s\S]*vHouleH = clamp\(dy \/ max\(0\.5 \* ampMax, 1e-9\), 0\.0, 1\.0\);/)
  assert.match(GLOBE_NU, /lueurSousSurface\(vHouleH, vCrete, dot\(L, -V\), fres\)/)
  // le ciel est pondéré par Schlick ENTIER — pas par un 0,35 ressuscité
  assert.match(GLOBE_NU, /col = mix\(col, ciel, fres\);/)
  // et le miroitement prend la variance de Cox & Munk sur le vent VIVANT
  assert.match(GLOBE_NU, /float sigma2 = varianceCoxMunk\(uMerVentMs\);/)
})
