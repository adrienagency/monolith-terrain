// LES DEUX PHRASES QUE L'ÉCRAN D'AFFICHE FABRIQUE À PARTIR DE NOMBRES
//
// La taille écrite sous la feuille, et la cause d'une densité dégradée. Elles
// ne sont pas des libellés fixes : elles se construisent, elles ont chacune une
// condition de silence, et c'est pour ça qu'elles vivent hors de
// `src/ui/affiche.js` (voir src/affiche-mots.js). Ici on les éprouve avec des
// valeurs, pas avec une expression régulière posée sur du code source.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { tailleSousFeuille, noteDensite } from '../src/affiche-mots.js'
import { geometriePage, FORMATS_AFFICHE } from '../src/print-page.js'
import { dpiPour } from '../src/export-dpi.js'

// ═══════════════════════════════════════════════════════════════════════════
// 1. LA TAILLE, SOUS LA FEUILLE
// ═══════════════════════════════════════════════════════════════════════════

test('⚠️ LA TAILLE S’ÉCRIT SOUS LA FEUILLE, ET ELLE DIT AUSSI LE SENS', () => {
  // C'est la question qu'on se pose EN REGARDANT la feuille : « ça fait quelle
  // taille, cette chose ? » Elle vivait en 11 px collée au bouton d'achat, à
  // cinq cents pixels du visuel qu'elle décrit.
  const paysage = geometriePage({ format: '50x70', orientation: 'paysage' })
  assert.equal(tailleSousFeuille(paysage, 'paysage'), '70 × 50 cm · paysage')
  const portrait = geometriePage({ format: '50x70', orientation: 'portrait' })
  assert.equal(tailleSousFeuille(portrait, 'portrait'), '50 × 70 cm · portrait')
})

test('⚠️ L’ORDRE DES DEUX NOMBRES EST CELUI DE LA FEUILLE, PAS LE CÔTÉ COURT D’ABORD', () => {
  // Écrire « 50 × 70 » sous une feuille COUCHÉE obligerait à réfléchir pour
  // retrouver quel nombre va avec quel côté. Le premier nombre est toujours la
  // largeur réelle — c'est aussi l'ordre de `ligneVerite`, et deux ordres
  // différents sur le même écran seraient pires qu'un ordre discutable.
  for (const f of FORMATS_AFFICHE) {
    for (const sens of ['portrait', 'paysage']) {
      const g = geometriePage({ format: f.id, orientation: sens })
      const [a, b] = tailleSousFeuille(g, sens).match(/^([\d,.]+) × ([\d,.]+) cm/).slice(1)
      assert.equal(Number(a), g.largeurMm / 10, `${f.id} ${sens} : largeur en premier`)
      assert.equal(Number(b), g.hauteurMm / 10, `${f.id} ${sens} : hauteur en second`)
      // et en paysage la feuille est bien plus large que haute
      if (sens === 'paysage') assert.ok(Number(a) > Number(b))
    }
  }
})

test('la taille se tait plutôt que d’écrire « undefined × undefined »', () => {
  assert.equal(tailleSousFeuille(null, 'paysage'), '')
  assert.equal(tailleSousFeuille({}, 'paysage'), '')
  assert.equal(tailleSousFeuille({ largeurMm: 0, hauteurMm: 700 }, 'paysage'), '')
})

test('un sens inconnu retombe sur « paysage », le sens d’ouverture de l’écran', () => {
  // `etat.orientation` ne vaut jamais autre chose, mais une chaîne écrite sur
  // la feuille ne doit jamais pouvoir afficher un mot qui n'existe pas.
  const g = geometriePage({ format: 'a3', orientation: 'paysage' })
  assert.match(tailleSousFeuille(g, undefined), / · paysage$/)
  assert.match(tailleSousFeuille(g, 'travers'), / · paysage$/)
})

// ═══════════════════════════════════════════════════════════════════════════
// 2. LA DENSITÉ DÉGRADÉE DIT SA CAUSE
// ═══════════════════════════════════════════════════════════════════════════

test('⚠️ UNE DENSITÉ DÉGRADÉE DIT SA CAUSE ET CE QUE ÇA CHANGE', () => {
  // La ligne de vérité annonce parfois 210 dpi. Quelqu'un qui a lu « 300 »
  // partout ailleurs en conclut que le produit est au rabais, alors que c'est
  // SA machine qui est en cause et que son affiche sera nette quand même.
  const note = noteDensite({ dpi: 210, nominal: 250, largeurCm: 70, hauteurCm: 50 })
  // ① la cause, et elle est du côté de la machine, pas du produit
  assert.match(note, /carte graphique/)
  // ② les deux chiffres, pour qu'il n'ait pas à les chercher
  assert.match(note, /250 dpi/)
  assert.match(note, /210 dpi/)
  // ③ la conséquence : rien, à cette taille-là
  assert.match(note, /reste nette/)
  assert.match(note, /50 × 70 cm/)
})

test('⚠️ ELLE SE TAIT À LA DENSITÉ NOMINALE', () => {
  // Une note permanente qui rassure sur un problème inexistant finit par le
  // faire chercher : c'est le contraire de ce qu'on veut ici.
  assert.equal(noteDensite({ dpi: 250, nominal: 250, largeurCm: 50, hauteurCm: 70 }), '')
  // et jamais au-dessus non plus (`degradePour` ne monte pas, mais la phrase ne
  // doit pas dépendre de cette promesse-là)
  assert.equal(noteDensite({ dpi: 300, nominal: 250, largeurCm: 50, hauteurCm: 70 }), '')
})

test('elle se tait aussi quand un des nombres manque, plutôt que d’inventer', () => {
  assert.equal(noteDensite(), '')
  assert.equal(noteDensite({ dpi: 210, largeurCm: 50, hauteurCm: 70 }), '')
  assert.equal(noteDensite({ nominal: 250, largeurCm: 50, hauteurCm: 70 }), '')
  assert.equal(noteDensite({ dpi: 210, nominal: 250 }), '')
  assert.equal(noteDensite({ dpi: 0, nominal: 250, largeurCm: 50, hauteurCm: 70 }), '')
})

test('⚠️ LA TAILLE CITÉE EST TOUJOURS « PETIT × GRAND », QUEL QUE SOIT LE SENS', () => {
  // Ici, contrairement à la légende sous la feuille, on ne décrit pas un objet
  // qu'on a sous les yeux : on nomme un FORMAT. « 50 × 70 cm » est le nom du
  // papier dans les deux sens, et c'est celui qu'il retrouvera chez l'imprimeur.
  const couche = noteDensite({ dpi: 210, nominal: 250, largeurCm: 70, hauteurCm: 50 })
  const debout = noteDensite({ dpi: 210, nominal: 250, largeurCm: 50, hauteurCm: 70 })
  assert.equal(couche, debout)
  assert.match(couche, /À 50 × 70 cm/)
})

test('⚠️ AUCUN REPROCHE À CELUI QUI EST EN TRAIN D’ACHETER', () => {
  // « Ta carte graphique ne tient pas les 300 dpi » est un fait ; « ton
  // ordinateur est trop faible » est un jugement, et on ne juge pas la machine
  // de quelqu'un au moment où il sort sa carte bancaire.
  const note = noteDensite({ dpi: 210, nominal: 300, largeurCm: 61, hauteurCm: 91 })
  for (const mot of [/trop faible/i, /insuffisant/i, /limité/i, /vieux/i, /obsolète/i, /désolé/i]) {
    assert.equal(mot.test(note), false, `« ${note} » ne doit pas porter ${mot}`)
  }
})

test('la note s’accorde avec la table des densités nominales, pas avec un 300 écrit à la main', () => {
  // ⚠️ TOUS LES FORMATS NE SONT PAS À 300 DPI. Annoncer « les 300 dpi » en dur
  // mentirait sur un 61 × 91, dont le nominal est plus bas — et ce serait
  // découvert par un acheteur, pas par nous.
  for (const f of FORMATS_AFFICHE) {
    const nominal = dpiPour(f.id)
    if (!nominal) continue
    const note = noteDensite({ dpi: nominal - 10, nominal, largeurCm: 50, hauteurCm: 70 })
    assert.match(note, new RegExp(`les ${nominal} dpi`), `${f.id} doit citer SA densité nominale`)
  }
  const nominaux = new Set(FORMATS_AFFICHE.map((f) => dpiPour(f.id)).filter(Boolean))
  assert.ok(nominaux.size > 1, 'si tous les formats avaient la même densité, ce test ne prouverait rien')
})
