// La géométrie d'une affiche, mesurée plutôt que crue.
//
// Ce module existe pour une raison chiffrée : l'export plafonne à 3 840 px, ce
// qui fait 32,5 cm à 300 dpi. Une carte postale. Les tests ci-dessous verrouillent
// les trois choses qui coûtent un tirage quand elles sont fausses : l'arrondi,
// la confusion fond perdu / marge de sécurité, et la couture entre deux tuiles.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MM_PAR_POUCE,
  DPI_IMPRESSION,
  FOND_PERDU_MM,
  MARGE_SECURITE_MM,
  FORMATS_AFFICHE,
  pxPourMm,
  mmPourPx,
  geometriePage,
  planTuiles,
  cadrageTuile,
  poidsRendu,
  formatAtteintCm,
} from '../src/print-page.js'

// ── Le chiffre qui justifie tout le module ──────────────────────────────────

test('3 840 px, la limite d’aujourd’hui, ne font que 32,5 cm à 300 dpi', () => {
  const cm = formatAtteintCm(3840)
  assert.ok(cm > 32 && cm < 33, `${cm.toFixed(1)} cm`)
  // …et un 50 × 70 en réclame 5 906
  assert.equal(pxPourMm(500), 5906)
  assert.equal(pxPourMm(700), 8268)
})

test('la conversion arrondit AU SUPÉRIEUR, jamais au plus proche', () => {
  // 500 mm à 300 dpi = 5 905,51 px. Arrondi au plus proche il rendrait 5 906
  // aussi, mais 100 mm = 1 181,10 tranche : au plus proche c'est 1 181, et il
  // manque alors un dixième de millimètre de matière sur le bord.
  assert.equal(pxPourMm(100), 1182)
  assert.equal(pxPourMm(25.4), 300, 'un pouce pile vaut exactement le dpi')
  assert.equal(MM_PAR_POUCE, 25.4)
})

test('une entrée absurde rend zéro, jamais NaN ni Infinity', () => {
  assert.equal(pxPourMm(0), 0)
  assert.equal(pxPourMm(-10), 0)
  assert.equal(pxPourMm(100, 0), 0)
  assert.equal(mmPourPx(NaN), 0)
})

// ── Fond perdu et marge de sécurité : deux choses opposées ──────────────────

test('le fond perdu s’AJOUTE dehors, il ne se retire pas dedans', () => {
  const g = geometriePage({ format: '50x70' })
  assert.deepEqual(g.finiPx, [5906, 8268], 'le format annoncé est le format APRÈS coupe')
  // 3 mm de chaque côté → 506 × 706 mm à produire
  assert.deepEqual(g.totalMm, [506, 706])
  assert.deepEqual(g.totalPx, [pxPourMm(506), pxPourMm(706)])
  assert.ok(g.totalPx[0] > g.finiPx[0] && g.totalPx[1] > g.finiPx[1], 'le rendu déborde le fini')
})

test('les deux marges ne se confondent pas, et la sécurité est la plus large', () => {
  // Le fond perdu est ce qu'on coupe ; la marge de securite ce qu'on s'interdit.
  // Confondre les deux, c'est soit un liseré blanc, soit un nom de lieu rogné.
  assert.ok(MARGE_SECURITE_MM > FOND_PERDU_MM, 'la zone interdite doit couvrir la tolérance de coupe')
  const g = geometriePage({ format: 'a2' })
  assert.equal(g.fondPerduMm, FOND_PERDU_MM)
  assert.equal(g.margeSecuriteMm, MARGE_SECURITE_MM)
})

test('sans fond perdu, le rendu vaut exactement le fini', () => {
  // Le cas de l'imprimante de bureau, qui ne massicote pas.
  const g = geometriePage({ format: 'a3', fondPerduMm: 0 })
  assert.deepEqual(g.totalPx, g.finiPx)
})

test('le paysage échange les côtés, il ne redimensionne rien', () => {
  const p = geometriePage({ format: '50x70' })
  const l = geometriePage({ format: '50x70', orientation: 'paysage' })
  assert.deepEqual([l.largeurMm, l.hauteurMm], [p.hauteurMm, p.largeurMm])
  assert.equal(l.largeurMm * l.hauteurMm, p.largeurMm * p.hauteurMm)
})

test('un format inconnu rend null, il n’invente pas une page', () => {
  assert.equal(geometriePage({ format: 'timbre-poste' }), null)
  assert.equal(geometriePage({}), null)
  assert.equal(geometriePage({ format: 'a2', dpi: 0 }), null)
})

test('tous les formats du catalogue sont en portrait, côté court en premier', () => {
  for (const f of FORMATS_AFFICHE) {
    assert.ok(f.mm[0] < f.mm[1], `${f.id} n’est pas en portrait : ${f.mm}`)
    assert.ok(f.label.length > 0)
  }
  const ids = FORMATS_AFFICHE.map((f) => f.id)
  assert.equal(new Set(ids).size, ids.length, 'deux formats partagent un id')
})

// ══════════ LE TUILAGE — LA COUTURE QUI SE VOIT SUR UN TIRAGE ═══════════════

test('la somme des tuiles retombe EXACTEMENT sur la taille pleine', () => {
  // ⚠️ LE défaut à ne jamais laisser passer. Un pixel perdu entre deux tuiles
  // est invisible à l'écran et parfaitement visible sur 70 cm de papier : une
  // ligne claire de 0,08 mm qui court sur toute la hauteur.
  for (const format of FORMATS_AFFICHE.map((f) => f.id)) {
    for (const maxTuile of [512, 1024, 2048, 4096]) {
      const g = geometriePage({ format })
      const plan = planTuiles(g.totalPx, maxTuile)
      const largeurs = plan.tuiles.filter((t) => t.j === 0).reduce((s, t) => s + t.w, 0)
      const hauteurs = plan.tuiles.filter((t) => t.i === 0).reduce((s, t) => s + t.h, 0)
      assert.equal(largeurs, g.totalPx[0], `${format}/${maxTuile} : largeur ${largeurs} ≠ ${g.totalPx[0]}`)
      assert.equal(hauteurs, g.totalPx[1], `${format}/${maxTuile} : hauteur ${hauteurs} ≠ ${g.totalPx[1]}`)
    }
  }
})

test('les tuiles pavent sans trou ni recouvrement', () => {
  const plan = planTuiles([5906, 8268], 2048)
  // chaque tuile commence exactement là où la précédente finit
  for (const t of plan.tuiles) {
    const gauche = plan.tuiles.find((u) => u.j === t.j && u.i === t.i - 1)
    if (gauche) assert.equal(t.x, gauche.x + gauche.w, 'trou ou recouvrement horizontal')
    const dessus = plan.tuiles.find((u) => u.i === t.i && u.j === t.j - 1)
    if (dessus) assert.equal(t.y, dessus.y + dessus.h, 'trou ou recouvrement vertical')
  }
  // et la surface totale vaut celle de l'affiche, au pixel près
  const aire = plan.tuiles.reduce((s, t) => s + t.w * t.h, 0)
  assert.equal(aire, 5906 * 8268)
})

test('aucune tuile ne dépasse le plafond du matériel', () => {
  for (const maxTuile of [512, 1024, 2048, 8192]) {
    const plan = planTuiles([5906, 8268], maxTuile)
    for (const t of plan.tuiles) {
      assert.ok(t.w <= maxTuile && t.h <= maxTuile, `tuile ${t.w}×${t.h} au-dessus de ${maxTuile}`)
      assert.ok(t.w > 0 && t.h > 0, 'tuile vide')
    }
  }
})

test('une affiche qui tient d’un coup ne se découpe pas pour rien', () => {
  const plan = planTuiles([1200, 900], 2048)
  assert.equal(plan.tuiles.length, 1)
  assert.deepEqual([plan.colonnes, plan.lignes], [1, 1])
})

test('le reste de la division va sur les PREMIÈRES tuiles, une unité chacune', () => {
  // 10 000 px en tuiles de 4 096 → trois colonnes. Le découpage naïf donnerait
  // 3 333 × 3 = 9 999, et le pixel manquant serait la couture.
  const plan = planTuiles([10000, 10000], 4096)
  const l = plan.tuiles.filter((t) => t.j === 0).map((t) => t.w)
  assert.deepEqual(l, [3334, 3333, 3333])
  assert.equal(l.reduce((a, b) => a + b), 10000)
})

test('la taille de tuile a un plancher : en dessous on paierait le tuilage pour rien', () => {
  // Une tuile de quelques pixels multiplierait les passes de rendu, chacune
  // avec son coût fixe, pour une surface ridicule. Le plancher vaut 64.
  // 100 px avec un plafond demandé à 4 : le plancher le relève à 64, donc deux
  // colonnes de 50 — et non vingt-cinq colonnes de 4.
  const plan = planTuiles([100, 100], 4)
  assert.deepEqual([plan.colonnes, plan.lignes], [2, 2])
  for (const t of plan.tuiles) assert.ok(t.w <= 64 && t.h <= 64)
  // et une image qui tient sous le plancher ne se découpe pas du tout
  assert.equal(planTuiles([50, 50], 4).tuiles.length, 1)
})

test('cadrageTuile décrit l’image ENTIÈRE, pas la tuile', () => {
  // ⚠️ Tout le contrat de setViewOffset. Lui passer la taille de la tuile
  // rendrait la scène complète dans CHAQUE tuile : on obtiendrait une planche
  // de miniatures au lieu d'une affiche.
  const plan = planTuiles([5906, 8268], 2048)
  const t = plan.tuiles.find((u) => u.i === 1 && u.j === 2)
  const c = cadrageTuile(plan, t)
  assert.deepEqual([c.fullWidth, c.fullHeight], [5906, 8268], 'le cadrage doit décrire l’affiche entière')
  assert.deepEqual([c.width, c.height], [t.w, t.h])
  assert.deepEqual([c.offsetX, c.offsetY], [t.x, t.y])
  assert.ok(c.offsetX > 0 && c.offsetY > 0, 'une tuile intérieure a bien un décalage')
})

// ── Ce que ça pèse, pour que le Gardien puisse dire non ─────────────────────

test('le poids dit pourquoi on tuile : la pleine passe, la tuile aussi', () => {
  const g = geometriePage({ format: '50x70' })
  const sansTuilage = poidsRendu({ totalPx: g.totalPx, tuilePx: g.totalPx, echantillons: 4 })
  const avecTuilage = poidsRendu({ totalPx: g.totalPx, tuilePx: [2048, 2048], echantillons: 4 })
  // en une passe, la pointe dépasse le gigaoctet
  assert.ok(sansTuilage.total > 1e9, `${(sansTuilage.total / 1e9).toFixed(2)} Go`)
  // en tuiles, la pointe retombe sous 400 Mo (le canevas plein domine)
  assert.ok(avecTuilage.total < 4e8, `${(avecTuilage.total / 1e6).toFixed(0)} Mo`)
  assert.ok(avecTuilage.total < sansTuilage.total / 2)
})

test('le canevas de composition, lui, reste en pleine taille — et on le dit', () => {
  const g = geometriePage({ format: '50x70' })
  const p = poidsRendu({ totalPx: g.totalPx, tuilePx: [1024, 1024] })
  // il ne dépend PAS de la taille de tuile : c'est le plancher incompressible
  const p2 = poidsRendu({ totalPx: g.totalPx, tuilePx: [256, 256] })
  assert.equal(p.pleine, p2.pleine)
  assert.ok(p.pleine > 190e6, 'un 50×70 en RGBA pèse ~195 Mo, et c’est irréductible')
})

test('DPI_IMPRESSION reste 300 : c’est le contrat avec l’imprimeur', () => {
  assert.equal(DPI_IMPRESSION, 300)
})
