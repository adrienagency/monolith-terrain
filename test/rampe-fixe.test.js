// LA RAMPE FIXE — Tâche RAMP.
//
// ⚡ **CE BANC DOIT MORDRE, ET LA PREUVE EST UNE CAMPAGNE DE MUTATION** (voir
// `rapport-RAMP.md` §« la morsure ») : « une suite verte ne prouve rien », dit
// le brief — une garde de ce dépôt est déjà restée verte avec le cœur du
// correctif arraché. Chaque test ci-dessous a été rejoué contre une mutation
// nommée, et la mutation le fait tomber.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  COTE_REF_M, fenetreRef, statsFenetre, loiEnMetres, versDomaine, transpose,
} from '../src/rampe-fixe.js'
import { gradeForDem } from '../src/relief-grade.js'

// ══════════ ① LA FENÊTRE DE RÉFÉRENCE ══════════════════════════════════════

test('① la fenêtre de référence est le MÊME carré au sol à toutes les échelles', () => {
  // Les cinq emprises RELEVÉES aux Alpes suisses, neuf crans
  // (`.banc/RAMP-AVANT/crans.json`) : 40 770 · 20 385 · 10 192 · 5 096 · 2 548 m,
  // MNT 1 536² à chacune.
  const n = 1536
  const cotes = [40770, 20385, 10192, 5096, 2548]
  const sols = cotes.map((ext) => {
    const f = fenetreRef(n, ext)
    return { ext, f, solM: f.couvre ? (f.n1 / n) * ext : null }
  })
  // au zoom d'arrivée le carré tient DANS le MNT et fait bien 40 km au sol
  assert.equal(sols[0].f.couvre, true)
  assert.ok(Math.abs(sols[0].solM - COTE_REF_M) < 20, `40 km attendus, ${sols[0].solM} m`)
  // ⚡ et il est CENTRÉ — à un texel près, et pas plus. ⚠️ J'avais d'abord écrit
  // l'égalité stricte : elle est FAUSSE, et c'est le test qui l'a dit avant le
  // rapport. `1536 − 1507 = 29`, un reste IMPAIR : une marge vaut 15, l'autre
  // 14. Un texel de 26,5 m au cran 0. L'égalité stricte ne peut tenir que sur un
  // reste pair, ce qu'aucune échelle ne garantit.
  assert.ok(Math.abs(sols[0].f.i0 - (n - sols[0].f.i0 - sols[0].f.n1)) <= 1)
  // plus fin, le MNT est plus petit que le carré : on ne pose plus de référence
  for (let i = 1; i < sols.length; i++) {
    assert.equal(sols[i].f.couvre, false, `cran ${i} : ${sols[i].ext} m devrait être trop étroit`)
    assert.equal(sols[i].f.n1, n)
  }
  // ⛔ MUTATION : `extentM > coteRefM` → `extentM > 0` rend `couvre` vrai partout,
  // et la référence se reposerait à chaque cran — le défaut lui-même. ROUGE ici.
})

test('① un dézoomage ne déplace pas la référence : le carré reste 40 km', () => {
  const n = 1536
  for (const ext of [40770, 81540, 163080, 400000]) {
    const f = fenetreRef(n, ext)
    assert.equal(f.couvre, true)
    assert.ok(Math.abs((f.n1 / n) * ext - COTE_REF_M) < 0.02 * COTE_REF_M)
  }
})

// ══════════ ② LES STATISTIQUES DE LA FENÊTRE ═══════════════════════════════

// un MNT synthétique : une pyramide, plus un « voisin » très haut dans un coin.
// ⚠️ Le voisin est LE POINT du test : c'est lui qui entre dans le MNT quand on
// dézoome et qui écrasait la rampe. La fenêtre centrale ne doit pas le voir.
function mntPyramide(n, sommet = 4000, voisin = 9000) {
  const d = new Float32Array(n * n)
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const u = (2 * i) / (n - 1) - 1
      const v = (2 * j) / (n - 1) - 1
      d[j * n + i] = sommet * Math.max(0, 1 - Math.max(Math.abs(u), Math.abs(v)))
    }
  }
  d[0] = voisin
  d[n * n - 1] = -500
  return d
}

test('② les statistiques ne portent QUE sur la fenêtre — le voisin hors carré ne compte pas', () => {
  const n = 256
  const data = mntPyramide(n)
  const fen = fenetreRef(n, 80000, 40000) // moitié du MNT
  assert.equal(fen.couvre, true)
  const st = statsFenetre(data, n, fen)
  assert.ok(st.maxM < 4001, `le sommet vaut ${st.maxM}, le voisin à 9 000 m a fui dans la fenêtre`)
  assert.ok(st.minM > -1, `le trou à −500 m a fui dans la fenêtre (${st.minM})`)
  // et sur le MNT entier, lui, les deux sont là
  const tout = statsFenetre(data, n, { i0: 0, n1: n })
  assert.equal(tout.maxM, 9000)
  assert.equal(tout.minM, -500)
  // ⛔ MUTATION : boucler de 0 à n au lieu de i0..i0+n1 rend `maxM = 9000`. ROUGE.
})

test('② l’histogramme de la fenêtre compte exactement ses points', () => {
  const n = 64
  const data = mntPyramide(n)
  const fen = { i0: 8, n1: 32 }
  const st = statsFenetre(data, n, fen)
  assert.equal(st.vus, 32 * 32)
  let somme = 0
  for (const c of st.histogram) somme += c
  assert.equal(somme, 32 * 32, 'chaque point vu doit tomber dans exactement une case')
})

// ══════════ ③ LA LOI EN MÈTRES, ET SON ALLER-RETOUR ════════════════════════

test('③ la loi en mètres, puis retour au même domaine, rend le réglage de départ', () => {
  const r = { heightPivot: 0.42, heightContrast: 3.8 }
  const loi = loiEnMetres(r, 1124, 3505)
  assert.ok(Math.abs(loi.pivotM - (1124 + 0.42 * 3505)) < 1e-9)
  assert.ok(Math.abs(loi.fenetreM - 3505 / 3.8) < 1e-9)
  const back = versDomaine(loi, 1124, 3505)
  assert.ok(Math.abs(back.heightPivot - 0.42) < 1e-12)
  assert.ok(Math.abs(back.heightContrast - 3.8) < 1e-12)
})

test('③ ⚡ LE CŒUR : la loi en mètres est INVARIANTE quand le domaine s’effondre', () => {
  // Les cinq domaines RELEVÉS (`.banc/RAMP-AVANT/crans.json`), du cran 0 au 9.
  const domaines = [
    { basM: 692, ampM: 3930 },
    { basM: 1124, ampM: 3505 },
    { basM: 1985, ampM: 2239 },
    { basM: 2318, ampM: 1250 },
    { basM: 2461, ampM: 799 },
  ]
  const ref = domaines[0]
  const reglage = { heightPivot: 0.49129770992366417, heightContrast: 2.4061224489795916 }
  const attendu = loiEnMetres(reglage, ref.basM, ref.ampM)
  for (const d of domaines) {
    const t = transpose(reglage, ref, d)
    const loi = loiEnMetres(t, d.basM, d.ampM)
    assert.ok(Math.abs(loi.pivotM - attendu.pivotM) < 1e-6,
      `pivotM ${loi.pivotM} ≠ ${attendu.pivotM} sur [${d.basM} ; ${d.basM + d.ampM}]`)
    assert.ok(Math.abs(loi.fenetreM - attendu.fenetreM) < 1e-6,
      `fenetreM ${loi.fenetreM} ≠ ${attendu.fenetreM}`)
  }
  // ⛔ MUTATION 1 : `transpose` qui rend `reglage` tel quel (le dépôt d'avant)
  //    → pivotM 2 622,8 puis 2 843,0 · 3 084,7 · 2 932,0 · 2 853,5 m. ROUGE.
  // ⛔ MUTATION 2 : `heightContrast: ampM / fenetreM` → `contrasteRef` (on oublie
  //    le rapport d'amplitudes) → fenetreM ÷4,9. ROUGE.
})

test('③ ⚡ SANS LE CORRECTIF, LA MÊME SUITE DÉRIVE — la garde mord', () => {
  // La preuve par l'absurde, et elle est chiffrée sur les MÊMES domaines : si
  // l'on garde le réglage TEL QUEL d'un domaine à l'autre (le dépôt d'avant),
  // la loi en mètres bouge. Un test qui ne saurait pas distinguer les deux
  // serait un test qui ne sert à rien.
  const domaines = [
    { basM: 692, ampM: 3930 }, { basM: 1124, ampM: 3505 },
    { basM: 1985, ampM: 2239 }, { basM: 2318, ampM: 1250 }, { basM: 2461, ampM: 799 },
  ]
  const reglage = { heightPivot: 0.49, heightContrast: 2.4 }
  const lois = domaines.map((d) => loiEnMetres(reglage, d.basM, d.ampM))
  const pivots = lois.map((l) => l.pivotM)
  const fens = lois.map((l) => l.fenetreM)
  assert.ok(Math.max(...pivots) - Math.min(...pivots) > 200,
    'sans transposition le pivot DOIT dériver, sinon la mesure ne mesure rien')
  assert.ok(Math.max(...fens) / Math.min(...fens) > 4,
    'sans transposition la fenêtre DOIT s’effondrer d’un facteur > 4')
})

// ══════════ ④ L'OPTION — L'ANCIEN COMPORTEMENT, AU BIT ═════════════════════

test('④ ⛔ AU BIT : `ref === null` (option cochée) rend le MÊME nombre', () => {
  for (const p of [0.48, 0.49, 0.35, 0.53, 0.4015267175572519]) {
    for (const c of [2.4, 2.2, 1.9, 5.1, 3.4086734693877547]) {
      const r = { heightPivot: p, heightContrast: c }
      const t = transpose(r, null, { basM: 692, ampM: 3930 })
      assert.ok(Object.is(t.heightPivot, p), `${t.heightPivot} n'est pas LE MÊME nombre que ${p}`)
      assert.ok(Object.is(t.heightContrast, c))
    }
  }
})

test('④ ⛔ AU BIT : un domaine de référence ÉGAL au domaine vivant ne touche à rien', () => {
  const d = { basM: 692, ampM: 3930 }
  for (const p of [0.48, 0.35, 0.53]) {
    const r = { heightPivot: p, heightContrast: 2.4 }
    const t = transpose(r, d, { ...d })
    assert.ok(Object.is(t.heightPivot, p), `${t.heightPivot} ≠ ${p} au bit`)
    assert.ok(Object.is(t.heightContrast, 2.4))
  }
  // ⛔ MUTATION : retirer le court-circuit `ref.basM === vivant.basM && …` rend
  //    0,48000000000000004 pour 0,48 — vert sur une comparaison numérique,
  //    ROUGE sur `Object.is`. C'est exactement le « au bit » que le brief exige.
})

test('④ un domaine dégénéré (MNT plat, pas encore chargé) rend le réglage tel quel', () => {
  const r = { heightPivot: 0.5, heightContrast: 4 }
  assert.ok(Object.is(transpose(r, { basM: 0, ampM: 0 }, { basM: 0, ampM: 10 }).heightPivot, 0.5))
  assert.ok(Object.is(transpose(r, { basM: 0, ampM: 10 }, { basM: 0, ampM: 0 }).heightPivot, 0.5))
  assert.ok(Object.is(transpose(r, null, null).heightPivot, 0.5))
})

// ══════════ ⑤ LA RÈGLE EST CELLE DU CURSEUR, PAS UNE SECONDE RÈGLE ═════════

test('⑤ le grade de référence sort de `gradeForDem`, la fonction du dépôt', () => {
  const n = 256
  const data = mntPyramide(n, 4000, 9000)
  const fen = fenetreRef(n, 80000, 40000)
  const st = statsFenetre(data, n, fen)
  const g = gradeForDem({ minM: st.minM, maxM: st.maxM, meanM: st.meanM, histogram: st.histogram, extentM: 40000 })
  // les quatre réglages de la section « Ombrage » sont là, et dans leurs bornes
  for (const k of ['mapTint', 'heightContrast', 'heightPivot', 'slopeTint']) {
    assert.ok(Number.isFinite(g[k]), `${k} manquant`)
  }
  assert.ok(g.heightPivot >= 0.06 && g.heightPivot <= 0.94)
  assert.ok(g.heightContrast >= 1.2 && g.heightContrast <= 12)
})

// ══════════ ⑥ LE BRANCHEMENT — CE QUE LE DÉPÔT DOIT PORTER ═════════════════
//
// ⚠️ **SUR LE SOURCE, PARCE QUE LE DÉFAUT SERAIT MUET.** Le brief nomme le
// piège : « une garde est restée verte avec le cœur du correctif arraché ». Un
// module pur parfaitement testé mais DÉBRANCHÉ rendrait exactement le défaut
// d'avant sans qu'une seule ligne ne rougisse.

test('⑥ `main.js` transpose les deux uniformes de rampe, et rien d’autre', () => {
  const src = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
  // les deux uniformes de rampe ne s'écrivent plus qu'en un seul endroit
  // ⚠️ `=(?!=)` — sans la sentinelle, le test comptait aussi les DEUX lectures
  // `=== t.heightContrast` du garde d'égalité et rendait 4. Même piège que
  // `portesSansPeage` dans `test/damier-uniformes.test.js`, qui l'écrit déjà.
  const ecritures = [...src.matchAll(/mapUniforms\.uHeight(Pivot|Contrast)\.value\s*=(?!=)/g)]
  assert.equal(ecritures.length, 2, `uHeightPivot/uHeightContrast écrits ${ecritures.length} fois hors appliqueRampeFixe`)
  assert.match(src, /function appliqueRampeFixe\(\)\s*\{[\s\S]*?transpose\(/)
  assert.match(src, /uHeightContrast\.value = t\.heightContrast/)
  assert.match(src, /uHeightPivot\.value = t\.heightPivot/)
  // ⛔ MUTATION : réintroduire `uHeightPivot.value = s.heightPivot` dans
  //    `applyStyle` (le dépôt d'avant) fait passer le compte à 3. ROUGE.
})

test('⑥ l’option existe, et elle est ÉTEINTE par défaut', () => {
  const src = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
  assert.match(src, /rampeRenormalise:\s*false/, 'le défaut doit être `false` — décision d’Adrien')
  assert.match(src, /function setRampeRenormalise\(/)
  const panel = fs.readFileSync(new URL('../src/ui/create-panel.js', import.meta.url), 'utf8')
  assert.match(panel, /setRampeRenormalise/, 'le panneau doit porter la case')
  assert.match(panel, /Re-normaliser la teinte/)
})

test('⑥ la référence se pose MÊME quand « Ombrage auto » est éteint', () => {
  const src = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
  const f = src.slice(src.indexOf('function applyAutoShade'))
  const corps = f.slice(0, f.indexOf('\n}\n'))
  const iRef = corps.indexOf('majRampeRef()')
  const iAuto = corps.indexOf('params.shadeAuto')
  assert.ok(iRef >= 0 && iRef < iAuto, 'majRampeRef doit précéder le test de shadeAuto')
  // ⛔ MUTATION : remettre `if (!params.shadeAuto) return null` en tête laisse
  //    les cartes en ombrage manuel sans référence. ROUGE.
})

test('⑥ les uniformes se reposent même quand il n’y a rien à regrader', () => {
  const src = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
  const f = src.slice(src.indexOf('function applyAutoShade'))
  const corps = f.slice(0, f.indexOf('\n}\n'))
  assert.match(corps, /if \(!g\) \{[\s\S]*appliqueRampeFixe\(\)[\s\S]*return null/)
  // ⛔ MUTATION : `if (!g) return null` sans la repose → aux crans plus fins que
  //    40 km la loi suivrait le nouveau MNT, c'est-à-dire le défaut. ROUGE.
})

test('⑥ le grade auto part au globe dans le domaine VIVANT', () => {
  const src = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
  assert.match(src, /pivotAutoSocle: shadeGradeVivant\(\)\?\.heightPivot/)
  assert.match(src, /contrasteAutoSocle: shadeGradeVivant\(\)\?\.heightContrast/)
  assert.match(src, /function shadeGradeVivant\(\)\s*\{[\s\S]*?transpose\(shadeGrade/)
})

test('⑥ ⚡ chaque pose d’amplitude appelle le rendez-vous de la rampe — le flash', () => {
  const src = fs.readFileSync(new URL('../src/terrain.js', import.meta.url), 'utf8')
  const poses = [...src.matchAll(/uHeightRange\.value\.set\(minH, maxH\)\s*\n([\s\S]{0,900}?)_surAmplitude\?\.\(\)/g)]
  assert.equal(poses.length, 4, `${poses.length} poses suivies du rendez-vous, 4 attendues`)
  const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
  assert.match(main, /terrain\._surAmplitude = appliqueRampeFixe/)
  // ⛔ MUTATION : retirer UN des quatre `this._surAmplitude?.()` → 3 ≠ 4. ROUGE.
  // ⛔ MUTATION : retirer la ligne de `main.js` → le rendez-vous n'est jamais
  //    branché, et `.banc/RAMP-FLASH` remonte à 14–27 images à l'ancienne loi.
})

test('⑥ ⛔ `uHeightRange` n’est PAS figé : les avions et le balayage le lisent', () => {
  const src = fs.readFileSync(new URL('../src/terrain.js', import.meta.url), 'utf8')
  // les quatre poses de l'amplitude du MNT chargé sont intactes
  const poses = [...src.matchAll(/mapUniforms\.uHeightRange\.value\.set\(minH, maxH\)/g)]
  assert.equal(poses.length, 4, `${poses.length} poses de uHeightRange, 4 attendues`)
  const traffic = fs.readFileSync(new URL('../src/traffic.js', import.meta.url), 'utf8')
  assert.match(traffic, /uHeightRange\?\.value\?\.y/)
})
