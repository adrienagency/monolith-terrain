import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  deriveUiTokens,
  uiTokenBases,
  auditUiTokens,
  paletteTint,
  contrastRatio,
  relativeLuminance,
  compositeOver,
  UI_BASE,
  UI_TOKEN_VARS,
  ACCENT_HUE_SHIFT,
  ACCENT_MIN_STRENGTH,
  MIN_INK_RATIO,
  MIN_MUTED_RATIO,
  MIN_ACCENT_RATIO,
} from '../src/ui-theme.js'
import { srgbToOklab, oklabToLch } from '../src/palette.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CATALOG = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/templates/data.json'), 'utf8'))
const PALETTES = CATALOG.palettes
const THEMES = [false, true]
const themeName = (d) => (d ? 'sombre' : 'clair')

// ------------------------------------------------------------ l'outil de mesure
// Si le ratio est faux, tout le reste du fichier ment. On le cale d'abord sur
// les valeurs canoniques de WCAG 2.x.
test('contrastRatio et relativeLuminance suivent WCAG', () => {
  assert.equal(+contrastRatio('#000000', '#ffffff').toFixed(4), 21)
  assert.equal(contrastRatio('#7f7f7f', '#7f7f7f'), 1)
  assert.equal(relativeLuminance('#ffffff'), 1)
  assert.equal(relativeLuminance('#000000'), 0)
  // symétrique : l'ordre des arguments n'entre pas dans la formule
  assert.equal(contrastRatio('#1c1917', '#fcfcfd'), contrastRatio('#fcfcfd', '#1c1917'))
  // 50 % de noir sur du blanc = le gris exactement à mi-chemin en 8 bits
  assert.equal(compositeOver('#000000', 0.5, '#ffffff'), '#808080')
  assert.equal(compositeOver('#123456', 1, '#ffffff'), '#123456')
  assert.equal(compositeOver('#123456', 0, '#ffffff'), '#ffffff')
})

// ============================================================================
// LE TEST QUI VAUT TOUS LES AUTRES — les 136 palettes du catalogue, dans les
// deux thèmes, ne produisent JAMAIS une interface sous le seuil de lisibilité.
// ============================================================================
test('les 136 palettes du catalogue tiennent le contraste, dans les deux thèmes', () => {
  assert.equal(PALETTES.length, 136, 'le catalogue a changé de taille — recaler le banc')
  const fails = []
  for (const dark of THEMES) {
    for (const p of PALETTES) {
      const a = auditUiTokens(p.rampStops, { dark })
      if (a.ink < MIN_INK_RATIO) fails.push(`${p.slug} (${themeName(dark)}) encre/verre ${a.ink.toFixed(2)}`)
      if (a.muted < MIN_MUTED_RATIO) fails.push(`${p.slug} (${themeName(dark)}) muted/verre ${a.muted.toFixed(2)}`)
    }
  }
  assert.deepEqual(fails, [], `${fails.length} palette(s) illisible(s)`)
})

test('l’encre tient aussi sur la PORCELAINE, qui est opaque et n’est pas le verre', () => {
  // la barre de recherche du bas est une bulle porcelaine, pas un panneau de
  // verre : son fond a sa propre clarté, et le texte y est le même
  for (const dark of THEMES) {
    for (const p of PALETTES) {
      const a = auditUiTokens(p.rampStops, { dark })
      assert.ok(a.inkOnPorcelain >= MIN_INK_RATIO, `${p.slug} (${themeName(dark)}) : ${a.inkOnPorcelain.toFixed(2)}`)
    }
  }
})

test('l’accent reste un composant visible : 3:1 contre le verre ET contre le blanc', () => {
  // 3:1 = WCAG 1.4.11 (contraste des composants d'interface). L'accent sert de
  // couleur de TEXTE (var(--ce-accent) sur du verre) et de FOND de bouton avec
  // un label blanc dessus : les deux comptent.
  for (const dark of THEMES) {
    for (const p of PALETTES) {
      const a = auditUiTokens(p.rampStops, { dark })
      assert.ok(a.accent >= MIN_ACCENT_RATIO, `${p.slug} (${themeName(dark)}) accent/verre ${a.accent.toFixed(2)}`)
      assert.ok(a.accentOnWhite >= MIN_ACCENT_RATIO, `${p.slug} (${themeName(dark)}) blanc/accent ${a.accentOnWhite.toFixed(2)}`)
    }
  }
})

test('aucun NaN, aucune couleur hors format, sur tout le catalogue', () => {
  const hex = /^#[0-9a-f]{6}$/
  for (const dark of THEMES) {
    for (const p of PALETTES) {
      const t = deriveUiTokens(p.rampStops, { dark })
      for (const k of Object.keys(UI_TOKEN_VARS)) {
        assert.ok(typeof t[k] === 'string' && t[k].length > 0, `${p.slug} ${k} vide`)
        assert.ok(!/NaN|undefined|null/.test(t[k]), `${p.slug} ${k} = ${t[k]}`)
      }
      for (const k of ['ink', 'accent', 'porcelain']) assert.match(t[k], hex, `${p.slug} ${k}`)
      const b = uiTokenBases(p.rampStops, { dark })
      for (const v of [b.tintHue, b.tintChroma, b.strength]) assert.ok(Number.isFinite(v))
    }
  }
})

// ============================================================================
// LE REPLI SÛR — à teinte nulle, la sortie EST v28.css.
// ============================================================================
test('strength 0 reproduit v28.css à l’octet près', () => {
  const light = deriveUiTokens(PALETTES[0].rampStops, { dark: false, strength: 0 })
  assert.equal(light.ink, '#1c1917')
  assert.equal(light.muted, 'rgba(28, 25, 23, 0.55)')
  assert.equal(light.accent, '#ea580c')
  assert.equal(light.glass, 'rgba(252, 252, 253, 0.62)')
  assert.equal(light.glassStrong, 'rgba(252, 252, 253, 0.8)')
  assert.equal(light.border, 'rgba(255, 255, 255, 0.55)')
  assert.equal(light.hairline, 'rgba(28, 25, 23, 0.08)')
  assert.equal(light.shadow, '0 10px 40px rgba(28, 25, 23, 0.12)')
  assert.equal(light.track, 'rgba(28, 25, 23, 0.14)')
  assert.equal(light.hover, 'rgba(28, 25, 23, 0.05)')
  assert.equal(light.porcelain, '#fbfbfc')

  const dark = deriveUiTokens(PALETTES[0].rampStops, { dark: true, strength: 0 })
  assert.equal(dark.ink, '#e7e5e4')
  assert.equal(dark.muted, 'rgba(231, 229, 228, 0.55)')
  assert.equal(dark.glass, 'rgba(24, 22, 21, 0.6)')
  assert.equal(dark.glassStrong, 'rgba(24, 22, 21, 0.82)')
  assert.equal(dark.border, 'rgba(255, 255, 255, 0.09)')
  assert.equal(dark.hairline, 'rgba(231, 229, 228, 0.08)')
  assert.equal(dark.shadow, '0 10px 40px rgba(0, 0, 0, 0.5)')
  assert.equal(dark.track, 'rgba(231, 229, 228, 0.16)')
  assert.equal(dark.hover, 'rgba(231, 229, 228, 0.06)')
  assert.equal(dark.porcelain, '#17191d')
})

test('les valeurs d’usine du module sont bien celles écrites dans v28.css', () => {
  // Le repli n'est sûr que si les deux fichiers disent la même chose. Ce test
  // casse le jour où quelqu'un retouche un jeton dans la feuille sans le
  // reporter ici — c'est exactement ce qu'on veut savoir.
  const css = fs.readFileSync(path.join(ROOT, 'src/ui/v28.css'), 'utf8')
  const block = (sel) => {
    const i = css.indexOf(sel)
    assert.ok(i >= 0, `bloc ${sel} introuvable`)
    return css.slice(i, css.indexOf('}', i))
  }
  const read = (blk, name) => {
    const m = new RegExp(`--${name}:\\s*([^;]+);`).exec(blk)
    assert.ok(m, `--${name} absent`)
    return m[1].trim()
  }
  const root = block(':root {')
  const night = block('body.dark {')
  for (const [key, blk] of [['light', root], ['dark', night]]) {
    const base = UI_BASE[key]
    const t = deriveUiTokens([], { dark: key === 'dark', strength: 0 })
    assert.equal(read(blk, 'ce-ink'), base.ink, `--ce-ink (${key})`)
    assert.equal(read(blk, 'ce-porcelain'), base.porcelain, `--ce-porcelain (${key})`)
    assert.equal(read(blk, 'ce-muted'), t.muted, `--ce-muted (${key})`)
    assert.equal(read(blk, 'ce-glass'), t.glass, `--ce-glass (${key})`)
    assert.equal(read(blk, 'ce-glass-strong'), t.glassStrong, `--ce-glass-strong (${key})`)
    assert.equal(read(blk, 'ce-border'), t.border, `--ce-border (${key})`)
    assert.equal(read(blk, 'ce-hairline'), t.hairline, `--ce-hairline (${key})`)
    assert.equal(read(blk, 'ce-shadow-color'), t.shadowColor, `--ce-shadow-color (${key})`)
    assert.equal(read(blk, 'ce-track'), t.track, `--ce-track (${key})`)
    assert.equal(read(blk, 'ce-hover'), t.hover, `--ce-hover (${key})`)
  }
  assert.equal(read(root, 'ce-accent'), UI_BASE.light.accent)
  // l'ombre du goo n'a PAS de bascule sombre : elle ne vit que dans :root
  assert.equal(read(root, 'ce-goo-shadow'), deriveUiTokens([], { strength: 0 }).shadowColor)
  assert.ok(!/--ce-goo-shadow:/.test(night), 'le goo ne doit pas basculer en mode sombre')
})

// ============================================================================
// DÉTERMINISME
// ============================================================================
test('déterministe : deux appels identiques rendent exactement la même chose', () => {
  for (const dark of THEMES) {
    for (const p of PALETTES.slice(0, 24)) {
      assert.deepEqual(deriveUiTokens(p.rampStops, { dark }), deriveUiTokens(p.rampStops, { dark }))
    }
  }
})

test('l’ordre des arrêts en entrée n’a aucune influence', () => {
  // rampColorStops trie déjà, mais un template importé peut arriver en vrac :
  // la teinte se lit sur des positions, pas sur un rang de tableau.
  for (const p of PALETTES.slice(0, 40)) {
    const shuffled = p.rampStops.map((s, i) => ({ ...s, k: (i * 7) % p.rampStops.length })).sort((a, b) => a.k - b.k)
    assert.deepEqual(deriveUiTokens(shuffled, {}), deriveUiTokens(p.rampStops, {}))
  }
})

test('strength est monotone : plus fort = plus teinté, jamais l’inverse', () => {
  const stops = PALETTES.find((p) => p.slug === 'alpage').rampStops
  const chroma = (hex) => oklabToLch(srgbToOklab(hex)).C
  let prev = -1
  for (const s of [0, 0.25, 0.5, 0.75, 1]) {
    const c = chroma(uiTokenBases(stops, { strength: s }).glass)
    assert.ok(c >= prev - 1e-9, `chroma du verre non monotone à strength ${s}`)
    prev = c
  }
})

// ============================================================================
// BORNES — la teinte reste un BIAIS. Une interface qui prend la couleur
// franche de la carte fatigue et date : c'est un bug de design, pas un goût.
// ============================================================================
test('les neutres gardent une chroma LÉGÈRE sur tout le catalogue', () => {
  const chroma = (hex) => oklabToLch(srgbToOklab(hex)).C
  for (const dark of THEMES) {
    for (const p of PALETTES) {
      const b = uiTokenBases(p.rampStops, { dark })
      assert.ok(chroma(b.glass) <= 0.02, `${p.slug} verre trop coloré : ${chroma(b.glass).toFixed(3)}`)
      assert.ok(chroma(b.porcelain) <= 0.02, `${p.slug} porcelaine trop colorée`)
      assert.ok(chroma(b.ink) <= 0.03, `${p.slug} encre trop colorée`)
      assert.ok(chroma(b.border) <= 0.02, `${p.slug} bordure trop colorée`)
    }
  }
})

test('l’accent RESTE dans la famille de la carte, et se distingue par la chroma', () => {
  // ⚠️ Ce test encodait l'inverse : il exigeait 90° d'écart, parce que l'accent
  // tournait à la complémentaire pour ne jamais se noyer dans le relief. Adrien
  // a tranché autrement — « je préfère moins de lisibilité, mais rester dans la
  // palette » — et un cyan sur une carte sépia se lisait effectivement comme
  // étranger. L'accent ne se distingue donc plus par la TEINTE mais par la
  // CHROMA : c'est ça qu'on vérifie ici, sur tout le catalogue.
  //
  // Le piège que ce test attrapait reste valable et reste couvert : oklabToSrgb
  // clampe canal par canal, et une cible hors gamut sRGB revenait avec une teinte
  // FAUSSE (la palette « ecrins » rendait du vert à 145° pour une cible à 219°).
  // D'où la vérification d'écart MAXIMAL ci-dessous : sans mise en gamut, elle
  // casserait.
  const dist = (a, b) => Math.abs(((b - a + 540) % 360) - 180)
  let checked = 0
  for (const dark of THEMES) {
    for (const p of PALETTES) {
      const b = uiTokenBases(p.rampStops, { dark })
      if (b.strength < ACCENT_MIN_STRENGTH) {
        // sous le seuil : la teinte de la carte n'est pas fiable, l'accent
        // d'usine garde la main — et il ne doit surtout pas dériver
        assert.equal(b.accent, UI_BASE[dark ? 'dark' : 'light'].accent, `${p.slug} sous le seuil`)
        continue
      }
      const a = oklabToLch(srgbToOklab(b.accent))
      // 1. DANS la famille : l'accent ne doit pas partir ailleurs. La tolérance
      //    n'est pas nulle — le recalage de clarté qui garantit le contraste
      //    peut faire dériver la teinte de quelques degrés en bord de gamut.
      assert.ok(
        dist(b.tintHue, a.h) <= 25,
        `${p.slug} : l'accent a quitté la palette — carte ${b.tintHue.toFixed(0)}° / accent ${a.h.toFixed(0)}°`
      )
      // 2. DISTINGUABLE : c'est la chroma qui fait l'accent, pas la teinte. Elle
      //    doit écraser celle des neutres (0,009 à 0,016), sinon le bouton
      //    d'action se confond avec le fond de l'interface.
      assert.ok(a.C > 0.05, `${p.slug} : accent trop terne pour être un accent (C ${a.C.toFixed(3)})`)
      checked++
    }
  }
  assert.ok(checked > 200, `banc trop maigre : ${checked} accents vérifiés`)
  assert.equal(ACCENT_HUE_SHIFT, 0)
})

test('la mise en gamut garde la TEINTE demandée au lieu de la clamper', () => {
  // le cas « ecrins » en direct : cible bleue hors gamut à cette clarté
  const ecrins = PALETTES.find((p) => p.slug === 'ecrins')
  const b = uiTokenBases(ecrins.rampStops, {})
  const want = (b.tintHue + ACCENT_HUE_SHIFT) % 360
  const got = oklabToLch(srgbToOklab(b.accent)).h
  assert.ok(Math.abs(((got - want + 540) % 360) - 180) < 8, `teinte trahie : ${want.toFixed(0)}° → ${got.toFixed(0)}°`)
})

test('les jetons couvrent exactement les variables CSS attendues', () => {
  const t = deriveUiTokens(PALETTES[0].rampStops, {})
  assert.deepEqual(Object.keys(t).sort(), Object.keys(UI_TOKEN_VARS).sort())
})

// ============================================================================
// PALETTES DÉGÉNÉRÉES — un seul arrêt, arrêts identiques, noir pur, blanc pur.
// Aucune ne doit produire de NaN, ni de division par zéro, ni de teinte tirée
// au hasard sur un gris (qui n'a pas de teinte).
// ============================================================================
const DEGENERATE = {
  'liste vide': [],
  'un seul arrêt': [{ c: '#8a6f4a', p: 0 }],
  'deux arrêts identiques': [{ c: '#3d6b52', p: 0.5 }, { c: '#3d6b52', p: 0.5 }],
  'noir pur': [{ c: '#000000', p: 0 }, { c: '#000000', p: 1 }],
  'blanc pur': [{ c: '#ffffff', p: 0 }, { c: '#ffffff', p: 1 }],
  'gris moyen': [{ c: '#808080', p: 0 }, { c: '#808080', p: 1 }],
  'positions toutes nulles': [{ c: '#c04000', p: 0 }, { c: '#0040c0', p: 0 }],
  'positions absentes': [{ c: '#c04000' }, { c: '#0040c0' }],
  'couleurs invalides': [{ c: 'rouge', p: 0 }, { c: '#zzzzzz', p: 1 }],
  'chaînes brutes': ['#c04000', '#0040c0'],
  'entrée nulle': null,
  'entrée non tableau': { c: '#123456' },
}

test('les palettes dégénérées ne produisent ni NaN ni couleur invalide', () => {
  for (const [label, stops] of Object.entries(DEGENERATE)) {
    for (const dark of THEMES) {
      const t = deriveUiTokens(stops, { dark })
      for (const [k, v] of Object.entries(t)) {
        assert.ok(typeof v === 'string' && !/NaN|undefined/.test(v), `${label} (${themeName(dark)}) ${k} = ${v}`)
      }
      const a = auditUiTokens(stops, { dark })
      assert.ok(a.ink >= MIN_INK_RATIO, `${label} (${themeName(dark)}) encre ${a.ink}`)
      assert.ok(a.muted >= MIN_MUTED_RATIO, `${label} (${themeName(dark)}) muted ${a.muted}`)
      assert.ok(a.accent >= MIN_ACCENT_RATIO, `${label} (${themeName(dark)}) accent ${a.accent}`)
      assert.ok(Number.isFinite(a.hue) && Number.isFinite(a.strength))
    }
  }
})

test('une rampe sans couleur ne teinte RIEN — elle rend v28.css', () => {
  // noir, blanc, gris, vide, illisible : aucune n'a de teinte à revendiquer.
  for (const label of ['liste vide', 'noir pur', 'blanc pur', 'gris moyen', 'couleurs invalides', 'entrée nulle', 'entrée non tableau']) {
    for (const dark of THEMES) {
      assert.deepEqual(
        deriveUiTokens(DEGENERATE[label], { dark }),
        deriveUiTokens([], { dark, strength: 0 }),
        `${label} (${themeName(dark)}) devrait rendre les valeurs d’usine`
      )
    }
  }
})

test('paletteTint : un gris rend une chroma nulle, deux teintes opposées s’annulent', () => {
  assert.deepEqual(paletteTint([]), { h: 0, C: 0 })
  assert.deepEqual(paletteTint([{ c: '#7f7f7f', p: 0 }, { c: '#7f7f7f', p: 1 }]), { h: 0, C: 0 })
  // le vecteur moyen est la bonne mesure : deux complémentaires de force égale
  // n'ont PAS de dominante, et le module doit le dire au lieu d'en inventer une
  const opposed = paletteTint([{ c: '#2f7d32', p: 0 }, { c: '#7d2f7a', p: 1 }])
  const single = paletteTint([{ c: '#2f7d32', p: 0 }, { c: '#2f7d32', p: 1 }])
  assert.ok(opposed.C < single.C * 0.5, `annulation attendue : ${opposed.C} vs ${single.C}`)
})

test('paletteTint ignore les arrêts gris au lieu de se laisser diluer par eux', () => {
  // une rampe alpine finit sur un blanc de neige : ce blanc ne doit pas voler
  // sa teinte à la rampe (c'est tout l'intérêt de la moyenne VECTORIELLE)
  const green = [{ c: '#3d6b52', p: 0 }, { c: '#3d6b52', p: 1 }]
  const greenWithSnow = [{ c: '#3d6b52', p: 0 }, { c: '#3d6b52', p: 0.85 }, { c: '#fdfdfd', p: 1 }]
  const a = paletteTint(green)
  const b = paletteTint(greenWithSnow)
  assert.ok(Math.abs(a.h - b.h) < 6, `teinte détournée par la neige : ${a.h} → ${b.h}`)
})
