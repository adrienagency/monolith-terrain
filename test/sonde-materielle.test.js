// LA SONDE MATÉRIELLE — en tests, sur des limites SIMULÉES.
//
// CE QU'ON VÉRIFIE ICI, ET POURQUOI ÇA NE SE VÉRIFIE PAS AUTREMENT. Le défaut
// que cette sonde existe pour empêcher est invisible : le pilote annonce 8 192
// et alloue moins, un canevas 2D de 12 Mpx est refusé EN SILENCE sur iOS, une
// cible de rendu naît incomplète sans lever. Dans les trois cas on obtient une
// image, elle est fausse, et on ne l'apprend qu'après le tirage payé.
//
// On ne peut pas allouer un tampon WebGL sous node. C'est exactement pour ça que
// les essais sont INJECTÉS : ici on simule des machines — une qui ment, une qui
// refuse la cible, une qui refuse le grand canevas — et on vérifie que la sonde
// en tire la bonne grille de formats. Ce que le test NE couvre pas et ne prétend
// pas couvrir : que les essais branchés dans main.js allouent vraiment ce qu'ils
// disent allouer. Ça, ça se regarde sur un vrai tirage (tâche 8).
//
// L'ordre des vérifications suit ce que ça coûte :
//   1. le plus petit des deux plafonds, jamais l'un des deux ;
//   2. le budget mémoire, retourné en côté maximal ;
//   3. DÉGRADER D'ABORD, CACHER ENSUITE — la décision d'Adrien ;
//   4. les refus des essais réels, qui priment sur tout ce qui est déclaré.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FORMATS_AFFICHE, geometriePage, poidsRendu } from '../src/print-page.js'
import { DPI_NOMINAL, DPI_PLANCHER, PLAFOND_REFERENCE } from '../src/export-dpi.js'
import {
  COTE_SONDE,
  PARTS_MEMOIRE,
  BUDGET_PLANCHER_OCTETS,
  MEMOIRE_DEFAUT_GO,
  FACTEUR_BANDE,
  limiteGL,
  budgetMemoire,
  limiteDepuisMemoire,
  grilleAffiche,
  ligneFormat,
  dpiRetenu,
  replierSur,
  largeurBandeMax,
  sonderMateriel,
} from '../src/sonde-materielle.js'

// Un contexte WebGL de comédie : deux plafonds, et rien d'autre.
const glFaux = (texture, tampon) => ({
  MAX_TEXTURE_SIZE: 'MAX_TEXTURE_SIZE',
  MAX_RENDERBUFFER_SIZE: 'MAX_RENDERBUFFER_SIZE',
  getParameter(nom) {
    if (nom === 'MAX_TEXTURE_SIZE') return texture
    if (nom === 'MAX_RENDERBUFFER_SIZE') return tampon
    return undefined
  },
})

// Une machine confortable : tout passe, les essais réussissent.
const MACHINE_LARGE = {
  gl: glFaux(16384, 16384),
  memoireGo: 16,
  essaiCible: () => true,
  essaiToile: () => true,
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. LES DEUX PLAFONDS
// ═══════════════════════════════════════════════════════════════════════════

test('limiteGL rend le PLUS PETIT des deux plafonds, dans les deux sens', () => {
  assert.equal(limiteGL(glFaux(16384, 8192)), 8192)
  assert.equal(limiteGL(glFaux(8192, 16384)), 8192)
  assert.equal(limiteGL(glFaux(4096, 4096)), 4096)
})

test('un plafond illisible rend 0, jamais une valeur par défaut optimiste', () => {
  // ⚠️ C'EST LE DÉFAUT D'ORIGINE EN MINIATURE. Compléter le manquant par l'autre
  // — ou par 8 192 « comme tout le monde » — c'est promettre une résolution que
  // personne n'a vérifiée. `degradePour` traite 0 comme « on ne sait pas ».
  assert.equal(limiteGL(glFaux(8192, 0)), 0)
  assert.equal(limiteGL(glFaux(undefined, 8192)), 0)
  assert.equal(limiteGL(glFaux(NaN, 8192)), 0)
  assert.equal(limiteGL(null), 0)
  assert.equal(limiteGL({}), 0)
  assert.equal(limiteGL({ getParameter() { throw new Error('contexte perdu') } }), 0)
})

// ═══════════════════════════════════════════════════════════════════════════
// 2. LE BUDGET MÉMOIRE, RETOURNÉ EN CÔTÉ
// ═══════════════════════════════════════════════════════════════════════════

test('le budget est une PART de la mémoire, avec un plancher', () => {
  assert.equal(budgetMemoire(16), (16 * 1e9) / PARTS_MEMOIRE)
  // 1 Go / 8 = 125 Mo, sous le plancher : c'est le plancher qui gagne
  assert.equal(budgetMemoire(1), BUDGET_PLANCHER_OCTETS)
  // absente (Safari, Firefox) : la valeur par défaut, pas zéro et pas l'infini
  assert.equal(budgetMemoire(undefined), budgetMemoire(MEMOIRE_DEFAUT_GO))
  assert.equal(budgetMemoire(0), budgetMemoire(MEMOIRE_DEFAUT_GO))
  assert.equal(budgetMemoire(NaN), budgetMemoire(MEMOIRE_DEFAUT_GO))
})

test('le budget se retourne en côté maximal — et le calcul est celui de poidsRendu', () => {
  const budgetOctets = 400e6
  const { tuile } = poidsRendu({ totalPx: [1, 1], tuilePx: [COTE_SONDE, COTE_SONDE], echantillons: 4 })
  const attendu = Math.floor((budgetOctets - tuile) / (FACTEUR_BANDE * COTE_SONDE * 4))
  assert.equal(limiteDepuisMemoire({ budgetOctets }), attendu)
  // et il DÉCROÎT quand le budget se resserre : sans ça, la conversion ne
  // servirait à rien (une constante déguisée passerait tous les autres tests)
  assert.ok(limiteDepuisMemoire({ budgetOctets: 300e6 }) < attendu)
})

test('un budget plus petit que la tuile elle-même rend 0 — pas un nombre négatif', () => {
  assert.equal(limiteDepuisMemoire({ budgetOctets: 10e6 }), 0)
})

test('le plancher de budget laisse passer le pire format mesuré (178 Mo, A2 paysage)', () => {
  // La tâche 6 a MESURÉ le pic. Si le plancher tombait sous ce chiffre, la sonde
  // retirerait de la grille un format qu'on sait produire.
  const g = geometriePage({ format: 'a2', orientation: 'paysage' })
  assert.ok(limiteDepuisMemoire({ budgetOctets: BUDGET_PLANCHER_OCTETS }) >= g.totalPx[0])
})

// ═══════════════════════════════════════════════════════════════════════════
// 3. DÉGRADER D'ABORD, CACHER ENSUITE
// ═══════════════════════════════════════════════════════════════════════════

test('sur une machine large, TOUS les formats sont là, à leur densité nominale', () => {
  const grille = grilleAffiche({ limitePx: PLAFOND_REFERENCE })
  assert.equal(grille.length, FORMATS_AFFICHE.length)
  for (const g of grille) {
    assert.ok(g.dispo, `${g.id} devrait être disponible`)
    assert.equal(g.portrait.dpi, DPI_NOMINAL[g.id])
    assert.equal(g.paysage.dpi, DPI_NOMINAL[g.id])
    assert.equal(g.degrade, false)
  }
})

test('⚠️ ON BAISSE LA DENSITÉ AVANT DE RETIRER LE FORMAT', () => {
  // 6 000 px : plus assez pour un 50 × 70 à 250 dpi, largement assez pour le
  // rendre plus bas. Le format DOIT rester, dégradé.
  const l = ligneFormat(grilleAffiche({ limitePx: 6000 }), '50x70')
  assert.ok(l.dispo, 'le 50 × 70 ne doit pas disparaître pour un plafond de 6 000')
  assert.ok(l.paysage.dpi < DPI_NOMINAL['50x70'], 'il doit avoir été dégradé')
  assert.ok(l.paysage.dpi >= DPI_PLANCHER)
  assert.equal(l.degrade, true)
  // et les pixels rendus tiennent VRAIMENT sous le plafond — c'est la propriété,
  // pas la densité affichée
  assert.ok(Math.max(...l.paysage.px) <= 6000)
  assert.ok(Math.max(...l.portrait.px) <= 6000)
})

test('à 4 096 px, le 50 × 70 et le 61 × 91 SORTENT de la grille — conséquence assumée', () => {
  // C'est la conséquence que la tâche 1 a écrite noir sur blanc. Si elle change,
  // ce n'est pas un détail : ce sont les deux formats qu'on regarde de près
  // avant de payer.
  const grille = grilleAffiche({ limitePx: 4096 })
  assert.equal(ligneFormat(grille, '50x70').dispo, false)
  assert.equal(ligneFormat(grille, '61x91').dispo, false)
  assert.equal(ligneFormat(grille, 'a4').dispo, true)
  assert.equal(ligneFormat(grille, 'a3').dispo, true)
})

test('à 2 048 px — le plancher garanti de WebGL2 — seul l’A4 survit', () => {
  const grille = grilleAffiche({ limitePx: 2048 })
  assert.deepEqual(grille.filter((g) => g.dispo).map((g) => g.id), ['a4'])
})

test('une limite nulle ne cache pas seulement : elle vide la grille', () => {
  assert.equal(grilleAffiche({ limitePx: 0 }).some((g) => g.dispo), false)
})

test('⚠️ LES DEUX SENS RENDENT LA MÊME DENSITÉ — c’est le même papier, tourné', () => {
  // Et c'est une PROPRIÉTÉ, pas une coïncidence : `degradePour` borne le PLUS
  // GRAND des deux côtés, qui ne change pas quand on tourne la feuille. La
  // vérifier ici évite qu'un appelant croie devoir demander les deux et annonce
  // une densité en portrait et une autre en paysage sur le même produit.
  for (const limite of [PLAFOND_REFERENCE, 6000, 4800, 3000]) {
    const grille = grilleAffiche({ limitePx: limite })
    for (const g of grille) {
      assert.equal(
        dpiRetenu(grille, g.id, 'portrait'),
        dpiRetenu(grille, g.id, 'paysage'),
        `${g.id} à ${limite} px : les deux sens divergent`
      )
    }
  }
  const grille = grilleAffiche({ limitePx: 4096 })
  assert.equal(dpiRetenu(grille, '61x91', 'portrait'), null)
  assert.equal(dpiRetenu(grille, 'format-inventé', 'portrait'), null)
})

test('replierSur garde le FORMAT avant de garder le sens', () => {
  const grille = grilleAffiche({ limitePx: 4096 })
  // le 61 × 91 n'existe plus du tout : on part sur autre chose, mais dans le
  // sens demandé — c'est le sens qu'on vient de voir à l'écran.
  const r = replierSur(grille, '61x91', 'paysage')
  assert.ok(r && r.format !== '61x91')
  assert.equal(r.orientation, 'paysage')
  assert.ok(ligneFormat(grille, r.format)[r.orientation])
  // un format jouable n'est pas touché
  assert.deepEqual(replierSur(grille, 'a4', 'portrait'), { format: 'a4', orientation: 'portrait' })
  // et quand rien ne passe, on le dit
  assert.equal(replierSur(grilleAffiche({ limitePx: 0 }), 'a4', 'portrait'), null)
})

test('largeurBandeMax rend la plus large des bandes que la grille demanderait', () => {
  const grille = grilleAffiche({ limitePx: PLAFOND_REFERENCE })
  const attendu = Math.max(...grille.flatMap((g) => [g.portrait, g.paysage].filter(Boolean).map((r) => r.px[0])))
  assert.equal(largeurBandeMax(grille), attendu)
  assert.equal(largeurBandeMax([]), 0)
})

// ═══════════════════════════════════════════════════════════════════════════
// 4. LES ESSAIS RÉELS PRIMENT SUR CE QUI EST DÉCLARÉ
// ═══════════════════════════════════════════════════════════════════════════

test('la sonde retient le plus petit de TOUS les plafonds', () => {
  const s = sonderMateriel(MACHINE_LARGE)
  assert.equal(s.limiteGL, 16384)
  assert.ok(s.limiteMemoire > 0)
  assert.equal(s.limitePx, Math.min(s.limiteGL, s.limiteMemoire, s.largeurBandeSondee))
  assert.equal(s.cible, true)
  assert.equal(s.toile, true)
  assert.equal(s.raison, null)
  assert.ok(s.grille.every((g) => g.dispo))
})

test('⚠️ UNE MACHINE QUI MENT : elle annonce 16 384 mais refuse la grande bande', () => {
  // C'est le défaut iOS, mot pour mot : le canevas 2D est créé, il est vide, et
  // rien ne lève. Sans l'essai, on vendrait un 61 × 91 sur cette machine.
  const refusAuDela = (seuil) => (largeur) => largeur <= seuil
  const s = sonderMateriel({ ...MACHINE_LARGE, essaiToile: refusAuDela(5000) })
  assert.equal(s.limiteGL, 16384)
  assert.ok(s.limitePx <= 5000, `limite retenue ${s.limitePx}`)
  assert.equal(ligneFormat(s.grille, '61x91').dispo, false)
  assert.equal(ligneFormat(s.grille, 'a4').dispo, true)
})

test('la sonde redescend par paliers plutôt que de tout perdre', () => {
  // La bande voulue est refusée, sa moitié passe : on garde la moitié, on ne
  // renonce pas. Trois essais au plus — la sonde coûte une image, pas une seconde.
  let essais = 0
  const s = sonderMateriel({
    ...MACHINE_LARGE,
    essaiToile: (largeur) => { essais++; return largeur <= 5000 },
  })
  assert.ok(essais >= 2 && essais <= 3, `${essais} essais de canevas`)
  assert.ok(s.largeurBandeSondee > 0)
  assert.ok(s.grille.some((g) => g.dispo))
})

test('une cible de tuile refusée arrête tout — 2 048 est le plancher du pavage', () => {
  const s = sonderMateriel({ ...MACHINE_LARGE, essaiCible: () => false })
  assert.equal(s.cible, false)
  assert.equal(s.limitePx, 0)
  assert.equal(s.grille.some((g) => g.dispo), false)
  assert.match(s.raison, /cible/)
})

test('un canevas refusé jusqu’au côté de tuile arrête tout aussi', () => {
  const s = sonderMateriel({ ...MACHINE_LARGE, essaiToile: () => false })
  assert.equal(s.toile, false)
  assert.equal(s.limitePx, 0)
  assert.equal(s.grille.some((g) => g.dispo), false)
  assert.match(s.raison, /bande/)
})

test('un essai qui LÈVE est un essai qui échoue — jamais un écran perdu', () => {
  const s = sonderMateriel({ ...MACHINE_LARGE, essaiCible: () => { throw new Error('pilote grognon') } })
  assert.equal(s.cible, false)
  assert.equal(s.limitePx, 0)
})

test('des plafonds illisibles n’essaient même pas d’allouer', () => {
  let touche = 0
  const s = sonderMateriel({
    gl: null,
    essaiCible: () => { touche++; return true },
    essaiToile: () => { touche++; return true },
  })
  assert.equal(touche, 0, 'inutile d’allouer 65 Mo pour une machine qu’on ne comprend pas')
  assert.equal(s.limitePx, 0)
  assert.match(s.raison, /plafonds/)
})

test('sans essais branchés, la sonde reste sur les plafonds déclarés', () => {
  // C'est le chemin d'un appelant qui ne fournit rien : on ne doit ni tout
  // refuser, ni prétendre avoir mesuré.
  const s = sonderMateriel({ gl: glFaux(8192, 8192), memoireGo: 8 })
  assert.equal(s.cible, null)
  assert.equal(s.toile, null)
  assert.equal(s.limitePx, Math.min(8192, s.limiteMemoire))
})

test('la mémoire peut mordre AVANT le pilote, et c’est tout l’intérêt', () => {
  // ⚠️ `degradePour` ne couvre PAS la mémoire (tâche 1). Sur une machine qui
  // annonce 16 384 mais n'a que 0,5 Go, le plancher de budget commande, et il
  // doit se voir dans la limite retenue.
  const s = sonderMateriel({ ...MACHINE_LARGE, memoireGo: 0.5 })
  assert.equal(s.budgetOctets, BUDGET_PLANCHER_OCTETS)
  assert.ok(s.limiteMemoire < s.limiteGL, 'le budget doit mordre avant le pilote')
  assert.equal(s.limitePx, Math.min(s.limiteMemoire, s.largeurBandeSondee))
})

test('la largeur sondée est celle d’une VRAIE bande, pas le plafond du pilote', () => {
  // Allouer 16 384 × 2 048 pour sonder coûterait 134 Mo qu'aucun tirage ne
  // demande : le plus grand format s'arrête à ~7 100 px de large.
  const vues = []
  sonderMateriel({ ...MACHINE_LARGE, essaiToile: (l, h) => { vues.push([l, h]); return true } })
  assert.equal(vues.length, 1)
  assert.equal(vues[0][1], COTE_SONDE)
  assert.ok(vues[0][0] < 16384, `sondé à ${vues[0][0]} px, soit le plafond du pilote`)
  const grilleLarge = grilleAffiche({ limitePx: 16384 })
  assert.equal(vues[0][0], largeurBandeMax(grilleLarge))
})
