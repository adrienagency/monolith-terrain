// ═══════════════════════════════════════════════════════════════════════════
// LE COMPOSITEUR D'AFFICHE — ET LA FIDÉLITÉ, QUI EST LE SEUL TEST QUI COMPTE
// ═══════════════════════════════════════════════════════════════════════════
//
// Ce fichier prouve quatre choses, et une seule d'entre elles est une propriété
// de code ordinaire.
//
// ① LA FIDÉLITÉ. Le compositeur et le DOM doivent poser le cartouche, le logo
//    et leur voile AUX MÊMES FRACTIONS. C'est ce qui permet à l'écran de
//    validation d'être le fichier plutôt qu'une maquette. Le test RELIT
//    ui/affiche.css et exige que chaque `cqw`, chaque couleur, chaque
//    interlettrage du CSS soit celui de la table du module. Si l'un des deux
//    dérive, il rougit — et il rougit AVANT le tirage, pas après.
//
// ② L'ATTRIBUTION EST INCRUSTÉE. Obligation de licence : les sources
//    bathymétriques fines imposent leur formulation MOT POUR MOT. Un test
//    dessine une affiche sur un contexte 2D enregistreur et exige que la phrase
//    exacte s'y trouve. Vérifié par mutation : retirer l'incrustation le tue.
//
// ③ LE VIGNETTAGE ET LE GRAIN NE FONT PAS DE DAMIER. C'est la réserve nº 2 de
//    la tâche 6, et la preuve est une invariance : appliquer les effets bande
//    par bande doit donner EXACTEMENT le même octet qu'en une fois. Un test de
//    contrôle vérifie qu'une réapplication « par bande, chaque bande pour
//    elle-même » — le défaut qu'on évite — donne bien, elle, un résultat
//    différent : sans lui, l'invariance pourrait être vraie par platitude.
//
// ④ L'ÉCHELLE DU GRAIN GARDE UNE TAILLE PHYSIQUE, à toutes les densités.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  CQW_CARTOUCHE, CQW_LOGO_MARGE, TYPO_CARTOUCHE, ENCRES, VOILE_HAUTEUR,
  POLICE_TITRE, POLICE_MONO, COINS_LOGO, VALIDATION_MAX_PX,
  ATTRIBUTION_FRACTION_HAUTEUR, ATTRIBUTION_PX_MIN, ATTRIBUTION_PAD_EM,
  CQW_SIGNATURE, TYPO_SIGNATURE, SIGNATURE_TEXTE, SIGNATURE_OMBRE_EM, planSignature,
  coordonneesCartouche, texteCartouche, zoneFinie, densiteEffective,
  echelleGrainSurface, mentionsAffiche, planCartouche, planLogo, planAttribution,
  planComposition, facteurVignettage, melangeOverlay, bruitCellule,
  reappliquerEffetsPixels, composerSurToile, supportAffiche, tailleValidation,
  srgbVersLineaire, lineaireVersSrgb,
} from '../src/compositeur-affiche.js'
import { EXPORT_CREDIT } from '../src/export.js'
import { NO_NAVIGATION, SOURCES, normalizeIndex, creditsForBounds } from '../src/bathy-sources.js'
import { MM_PAR_POUCE } from '../src/print-page.js'
import { DPI_GRAIN } from '../src/export-effets.js'

const lire = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')
const CSS_AFFICHE = lire('../src/ui/affiche.css')
const CSS_JETONS = lire('../src/ui/v28.css')
const JS_AFFICHE = lire('../src/ui/affiche.js')

// Le bloc d'un sélecteur, tel qu'il est écrit. On exige le sélecteur EXACT en
// début de ligne : `.af-cartouche` ne doit pas attraper `.af-cartouche.sombre`.
function blocCss(css, selecteur) {
  const i = css.indexOf(`\n${selecteur} {`)
  assert.notEqual(i, -1, `sélecteur introuvable dans le CSS : ${selecteur}`)
  const j = css.indexOf('}', i)
  return css.slice(i + selecteur.length + 3, j)
}

/** La valeur d'une propriété dans un bloc, telle quelle. */
function prop(bloc, nom) {
  const m = bloc.match(new RegExp(`(?:^|;|\\n)\\s*${nom}\\s*:\\s*([^;]+)`))
  return m ? m[1].trim() : null
}

/** Les nombres en `cqw` d'une déclaration, dans l'ordre. */
const cqwDe = (valeur) => [...String(valeur).matchAll(/(-?[\d.]+)cqw/g)].map((m) => parseFloat(m[1]))

// ═══════════════════════════════════════════════════════════════════════════
// ① LA FIDÉLITÉ — LE CSS EST LA RÉFÉRENCE, LE MODULE DOIT LA SUIVRE
// ═══════════════════════════════════════════════════════════════════════════

test('fidélité : le padding et le gap du cartouche sont ceux du CSS', () => {
  const b = blocCss(CSS_AFFICHE, '.af-cartouche')
  assert.deepEqual(cqwDe(prop(b, 'padding')), [
    CQW_CARTOUCHE.padHaut, CQW_CARTOUCHE.padCote, CQW_CARTOUCHE.padBas,
  ])
  assert.deepEqual(cqwDe(prop(b, 'gap')), [CQW_CARTOUCHE.gap])
  // le cartouche couvre TOUTE la largeur de la feuille : c'est ce qui fait
  // qu'un `cqw` de son padding et un `cqw` de ses enfants mesurent la même
  // chose, et donc qu'il n'y a qu'une seule échelle dans tout le module
  assert.equal(prop(b, 'left'), '0')
  assert.equal(prop(b, 'right'), '0')
  assert.equal(prop(b, 'bottom'), '0')
  assert.equal(prop(b, 'container-type'), 'inline-size')
})

test('fidélité : les trois tailles de police du cartouche sont celles du CSS', () => {
  const lieu = blocCss(CSS_AFFICHE, '.af-cart-lieu')
  const sous = blocCss(CSS_AFFICHE, '.af-cart-sous')
  const alt = blocCss(CSS_AFFICHE, '.af-cart-alt')
  assert.deepEqual(cqwDe(prop(lieu, 'font-size')), [CQW_CARTOUCHE.lieu])
  assert.deepEqual(cqwDe(prop(sous, 'font-size')), [CQW_CARTOUCHE.sous])
  assert.deepEqual(cqwDe(prop(sous, 'margin-top')), [CQW_CARTOUCHE.sousMarge])
  assert.deepEqual(cqwDe(prop(alt, 'font-size')), [CQW_CARTOUCHE.alt])
})

test('fidélité : interlettrage, graisse et interligne sont ceux du CSS', () => {
  const lieu = blocCss(CSS_AFFICHE, '.af-cart-lieu')
  const sous = blocCss(CSS_AFFICHE, '.af-cart-sous')
  const alt = blocCss(CSS_AFFICHE, '.af-cart-alt')
  assert.equal(parseFloat(prop(lieu, 'letter-spacing')), TYPO_CARTOUCHE.lieu.espacement)
  assert.equal(parseFloat(prop(lieu, 'font-weight')), TYPO_CARTOUCHE.lieu.poids)
  assert.equal(parseFloat(prop(lieu, 'line-height')), TYPO_CARTOUCHE.lieu.interligne)
  assert.equal(parseFloat(prop(sous, 'letter-spacing')), TYPO_CARTOUCHE.sous.espacement)
  assert.equal(parseFloat(prop(alt, 'letter-spacing')), TYPO_CARTOUCHE.alt.espacement)
  assert.equal(parseFloat(prop(sous, 'opacity')), TYPO_CARTOUCHE.sous.opacite)
  assert.equal(parseFloat(prop(alt, 'opacity')), TYPO_CARTOUCHE.alt.opacite)
  // la sous-ligne est en capitales dans le DOM : le compositeur doit la mettre
  // en capitales lui aussi, sinon les coordonnées n'ont pas la même largeur
  assert.equal(prop(sous, 'text-transform'), 'uppercase')
  assert.equal(TYPO_CARTOUCHE.sous.majuscules, true)
  assert.equal(prop(alt, 'text-align'), 'right')
})

test('fidélité : les encres et le voile dégradé sont ceux du CSS', () => {
  assert.equal(prop(blocCss(CSS_AFFICHE, '.af-cartouche'), 'color'), ENCRES.clair.texte)
  assert.equal(prop(blocCss(CSS_AFFICHE, '.af-cartouche.sombre'), 'color'), ENCRES.sombre.texte)
  const voileClair = blocCss(CSS_AFFICHE, '.af-cartouche::before')
  const voileSombre = blocCss(CSS_AFFICHE, '.af-cartouche.sombre::before')
  assert.equal(parseFloat(prop(voileClair, 'height')) / 100, VOILE_HAUTEUR)
  for (const [bloc, encre] of [[voileClair, ENCRES.clair], [voileSombre, ENCRES.sombre]]) {
    const fond = prop(bloc, 'background')
    // `to top` : l'opaque est EN BAS — le compositeur doit poser ses arrêts
    // dans cet ordre-là, sinon le voile est à l'envers et le texte illisible
    assert.match(fond, /linear-gradient\(to top,/)
    const rgba = [...fond.matchAll(/rgba\(([^)]+)\)/g)].map((m) => m[1].split(',').map((n) => parseFloat(n)))
    assert.deepEqual(rgba[0].slice(0, 3), encre.voile)
    assert.equal(rgba[0][3], encre.voileAlpha)
    assert.equal(rgba[1][3], 0, 'le second arrêt du dégradé doit être transparent')
  }
})

test('fidélité : les quatre coins du logo et leur marge sont ceux du CSS', () => {
  for (const coin of COINS_LOGO) {
    const b = blocCss(CSS_AFFICHE, `.af-logo[data-coin='${coin}']`)
    const valeurs = cqwDe(b)
    assert.equal(valeurs.length, 2, `le coin ${coin} doit poser deux offsets`)
    for (const v of valeurs) assert.equal(v, CQW_LOGO_MARGE)
    // et sur les BONS bords : un logo « bas droite » posé en haut à gauche
    // passerait toutes les autres vérifications
    assert.equal(/\btop\s*:/.test(b), coin === 'hg' || coin === 'hd')
    assert.equal(/\bleft\s*:/.test(b), coin === 'hg' || coin === 'bg')
  }
  // `height: auto` : la hauteur du logo se déduit du ratio de l'image
  assert.equal(prop(blocCss(CSS_AFFICHE, '.af-logo'), 'height'), 'auto')
})

test('fidélité : la signature ShibuMap est posée comme le CSS la pose', () => {
  const b = blocCss(CSS_AFFICHE, '.af-signature')
  assert.deepEqual(cqwDe(prop(b, 'font-size')), [CQW_SIGNATURE.taille])
  assert.deepEqual(cqwDe(prop(b, 'left')), [CQW_SIGNATURE.gauche])
  assert.deepEqual(cqwDe(prop(b, 'bottom')), [CQW_SIGNATURE.bas])
  assert.equal(parseFloat(prop(b, 'font-weight')), TYPO_SIGNATURE.poids)
  assert.equal(parseFloat(prop(b, 'letter-spacing')), TYPO_SIGNATURE.espacement)
  assert.equal(parseFloat(prop(b, 'opacity')), TYPO_SIGNATURE.opacite)
  // `line-height: 1` : la boîte vaut la taille de police, ce dont dépend le
  // calcul de la ligne de base dans `planSignature`
  assert.equal(parseFloat(prop(b, 'line-height')), 1)
  assert.equal(prop(b, 'color'), ENCRES.clair.texte)
  assert.equal(prop(blocCss(CSS_AFFICHE, '.af-signature.sombre'), 'color'), ENCRES.sombre.texte)
  // sans cartouche : blanc sur ombre, et l'ombre a le flou du module
  const nu = blocCss(CSS_AFFICHE, '.af-signature.nu')
  assert.equal(prop(nu, 'color'), '#ffffff')
  assert.deepEqual(cqwDe(prop(nu, 'text-shadow')), [CQW_SIGNATURE.taille * SIGNATURE_OMBRE_EM])
})

test('fidélité : l’écran d’édition affiche la MÊME signature que le fichier', () => {
  // ⚠️ SI CE TEST TOMBE, la marque n'apparaît qu'à l'écran de validation, ou
  // n'apparaît que sur le fichier : dans les deux cas l'acheteur découvre après
  // coup quelque chose qu'il n'avait pas composé.
  assert.match(JS_AFFICHE, /import \{[^}]*SIGNATURE_TEXTE[^}]*\} from '\.\.\/compositeur-affiche\.js'/)
  assert.match(JS_AFFICHE, /el\('div', 'af-signature', SIGNATURE_TEXTE\)/)
  assert.equal(JS_AFFICHE.includes(`'${SIGNATURE_TEXTE}'`), false, 'le nom ne se recopie pas dans l’écran')
})

test('fidélité : les deux familles de police sont celles des jetons', () => {
  const racine = CSS_JETONS.slice(0, CSS_JETONS.indexOf('}'))
  assert.equal(prop(racine, '--ce-font'), POLICE_TITRE)
  assert.equal(prop(racine, '--ce-mono'), POLICE_MONO)
})

test('fidélité : l’écran de validation a la taille de l’aperçu d’édition', () => {
  const m = JS_AFFICHE.match(/APERCU_MAX_PX\s*=\s*(\d+)/)
  assert.ok(m, 'APERCU_MAX_PX doit exister dans ui/affiche.js')
  assert.equal(parseInt(m[1], 10), VALIDATION_MAX_PX)
})

test('fidélité : le texte du cartouche n’a plus qu’une source', () => {
  // ⚠️ SI CE TEST TOMBE, quelqu'un a réécrit un formatage de coordonnées dans
  // l'écran d'édition. Deux façons d'écrire une latitude, c'est un écart entre
  // ce qui est validé et ce qui est vendu — et il ne se voit qu'après la vente.
  assert.match(JS_AFFICHE, /import \{[^}]*texteCartouche[^}]*\} from '\.\.\/compositeur-affiche\.js'/)
  assert.equal(JS_AFFICHE.includes("'N', 'S'"), false)
  assert.equal(JS_AFFICHE.includes('toFixed(3)'), false)
})

// ═══════════════════════════════════════════════════════════════════════════
// LE TEXTE
// ═══════════════════════════════════════════════════════════════════════════

test('les coordonnées s’écrivent comme un cartographe les écrit', () => {
  assert.equal(coordonneesCartouche(45.8326, 6.8652), '45.833° N  ·  6.865° E')
  assert.equal(coordonneesCartouche(-33.9, -18.4), '33.900° S  ·  18.400° O')
  assert.equal(coordonneesCartouche(NaN, 3), '')
})

test('le cartouche prend le titre saisi, sinon le nom du lieu', () => {
  const lieu = { nom: 'Mont Blanc', lat: 45.83, lon: 6.86, altMax: 4805.2 }
  assert.equal(texteCartouche({ titre: 'Chamonix', lieu }).lieu, 'Chamonix')
  assert.equal(texteCartouche({ titre: '', lieu }).lieu, 'Mont Blanc')
  assert.equal(texteCartouche({ lieu }).alt, '4805 m')
  assert.equal(texteCartouche({ lieu: { ...lieu, altMax: null } }).alt, '')
})

// ═══════════════════════════════════════════════════════════════════════════
// LE RECTANGLE FINI — LE FOND PERDU N'EST PAS UN REPÈRE
// ═══════════════════════════════════════════════════════════════════════════

test('le fond perdu sort du repère : tout se mesure sur le format fini', () => {
  const f = zoneFinie({ largeur: 7087, hauteur: 5032, fondPerduPx: 35 })
  assert.deepEqual(f, { x: 35, y: 35, largeur: 7087 - 70, hauteur: 5032 - 70 })
})

test('un fond perdu absurde ne rend jamais un rectangle vide', () => {
  const f = zoneFinie({ largeur: 100, hauteur: 100, fondPerduPx: 9000 })
  assert.ok(f.largeur > 0 && f.hauteur > 0)
})

test('⚠️ l’attribution reste DANS le format fini — sinon elle part au massicot', () => {
  // Le défaut exact que corrige ce module : `stampCredit` posait la ligne à
  // 1,5 % du bord du FICHIER. Sur un fichier à fond perdu, c'est dans la chute.
  const fini = zoneFinie({ largeur: 7087, hauteur: 5032, fondPerduPx: 35 })
  const att = planAttribution({ fini, texte: 'x' })
  assert.ok(att.base <= fini.y + fini.hauteur, 'la ligne déborde sous le trait de coupe')
  assert.ok(att.x <= fini.x + fini.largeur, 'la ligne déborde après le trait de coupe')
  const marge = fini.y + fini.hauteur - att.base
  assert.ok(marge > 0 && marge < fini.hauteur * 0.05)
})

test('la géométrie de l’attribution est celle de stampCredit', () => {
  const fini = zoneFinie({ largeur: 4000, hauteur: 6000 })
  const att = planAttribution({ fini, texte: 'x' })
  const taille = Math.max(ATTRIBUTION_PX_MIN, Math.round(6000 * ATTRIBUTION_FRACTION_HAUTEUR))
  assert.equal(att.taille, taille)
  assert.equal(fini.hauteur - att.base, Math.round(taille * ATTRIBUTION_PAD_EM))
  // et le plancher de 11 px tient sur une vignette
  assert.equal(planAttribution({ fini: zoneFinie({ largeur: 200, hauteur: 300 }), texte: 'x' }).taille, ATTRIBUTION_PX_MIN)
})

test('l’encre de l’attribution suit le cartouche, sinon elle est invisible', () => {
  const fini = zoneFinie({ largeur: 4000, hauteur: 6000 })
  // blanc à 72 % sur le voile blanc à 82 % : on aurait cru l'avoir incrustée
  assert.equal(planAttribution({ fini, texte: 'x', cartouche: true }).couleur, ENCRES.clair.texte)
  assert.equal(planAttribution({ fini, texte: 'x', cartouche: true, sombre: true }).couleur, ENCRES.sombre.texte)
  const nue = planAttribution({ fini, texte: 'x' })
  assert.equal(nue.couleur, '#ffffff')
  assert.ok(nue.ombre > 0, 'sans cartouche, la ligne garde son ombre portée')
})

// ═══════════════════════════════════════════════════════════════════════════
// LA MISE EN PAGE — INDÉPENDANTE DE L'ÉCHELLE, PAR CONSTRUCTION
// ═══════════════════════════════════════════════════════════════════════════

const LIEU = { nom: 'Mont Blanc', lat: 45.8326, lon: 6.8652, altMax: 4805 }

const planPour = (largeur, hauteur, extra = {}) =>
  planComposition({
    largeur, hauteur, largeurMm: 700,
    cartouche: { actif: true, sombre: false, titre: 'Chamonix', lieu: LIEU },
    logo: { taille: 12, coin: 'bd', ratio: 2 },
    attribution: 'crédit',
    ...extra,
  })

test('⚠️ LA MISE EN PAGE EST LA MÊME À TOUTE ÉCHELLE — c’est ce qui fait que l’écran de validation est le fichier', () => {
  // 1 100 px d'un côté, 7 087 de l'autre : le rapport exact des deux surfaces
  // que ce module doit rendre identiques.
  const petit = planPour(1100, 781)
  const grand = planPour(7087, 5032)
  const k = grand.fini.largeur / petit.fini.largeur
  const proche = (a, b, quoi) =>
    assert.ok(Math.abs(a - b) < 1e-6 * Math.max(1, Math.abs(b)), `${quoi} : ${a} ≠ ${b}`)
  for (const clef of ['lieu', 'sous', 'alt']) {
    proche(grand.cartouche[clef].taille, petit.cartouche[clef].taille * k, `taille ${clef}`)
    proche(grand.cartouche[clef].espacement, petit.cartouche[clef].espacement * k, `espacement ${clef}`)
    // les positions se mesurent depuis le bord de la feuille, donc à l'échelle
    proche(grand.fini.hauteur - (grand.cartouche[clef].base - grand.fini.y),
      (petit.fini.hauteur - (petit.cartouche[clef].base - petit.fini.y)) * k, `base ${clef}`)
  }
  for (const clef of ['largeur', 'hauteur']) {
    proche(grand.logo[clef], petit.logo[clef] * k, `logo ${clef}`)
    proche(grand.cartouche.voile[clef], petit.cartouche.voile[clef] * k, `voile ${clef}`)
  }
})

test('le cartouche se cale sur le bas de la feuille, l’altitude sur la ligne du lieu', () => {
  const p = planPour(4000, 5600)
  const padBas = (CQW_CARTOUCHE.padBas / 100) * p.fini.largeur
  const padCote = (CQW_CARTOUCHE.padCote / 100) * p.fini.largeur
  // `align-items: baseline` du flex : l'altitude s'aligne sur le NOM DU LIEU
  assert.equal(p.cartouche.alt.base, p.cartouche.lieu.base)
  assert.equal(p.cartouche.lieu.x, p.fini.x + padCote)
  assert.equal(p.cartouche.alt.x, p.fini.x + p.fini.largeur - padCote)
  assert.equal(p.cartouche.alt.alignement, 'right')
  // la sous-ligne est SOUS le nom du lieu, et au-dessus du padding du bas
  assert.ok(p.cartouche.sous.base > p.cartouche.lieu.base)
  assert.ok(p.cartouche.sous.base < p.fini.y + p.fini.hauteur - padBas)
})

test('le voile part du bas et fait 240 % de la hauteur du cartouche', () => {
  // sans fond perdu — l'écran de validation — le rectangle peint EST le dégradé
  const p = planPour(4000, 5600)
  assert.equal(p.cartouche.voile.y + p.cartouche.voile.hauteur, p.fini.y + p.fini.hauteur)
  assert.equal(p.cartouche.voile.degradeBas, p.fini.y + p.fini.hauteur)
  assert.equal(p.cartouche.voile.degradeHaut, p.cartouche.voile.y)
  assert.ok(Math.abs((p.cartouche.voile.degradeBas - p.cartouche.voile.degradeHaut) / p.cartouche.boite.hauteur - VOILE_HAUTEUR) < 1e-9)
})

// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ LE FOND PERDU DOIT PROLONGER L'IMAGE FINALE — LE DÉFAUT LE PLUS GRAVE
// ═══════════════════════════════════════════════════════════════════════════
//
// Vu sur un tirage réel, à l'angle d'une affiche sombre : un aplat sombre, et
// une bande turquoise le long de deux bords. La mer. La carte brute réapparue
// dans le fond perdu, parce que le voile s'arrêtait au format FINI pendant que
// le pavage, lui, prolongeait bien la carte.
//
// Le fond perdu existe pour absorber la dérive du massicot : une dérive de
// quelques dixièmes de millimètre faisait donc apparaître une bande CLAIRE sur
// le bord d'une affiche sombre — le défaut même que le fond perdu doit rendre
// impossible.
//
// La ligne de partage, et c'est elle que ces tests tiennent :
//   · UN OBJET (cartouche, logo, attribution) ne sort JAMAIS du format fini ;
//   · UN TRAITEMENT DE L'IMAGE (voile, vignettage, grain) va au bord du FICHIER.

const FOND_PERDU_PX = 35
const planAvecFondPerdu = (extra = {}) =>
  planPour(4000, 5600, { fondPerduPx: FOND_PERDU_PX, vignette: 0.6, ...extra })

test('⚠️ LE VOILE DU CARTOUCHE VA JUSQU’AU BORD DU FICHIER, FOND PERDU COMPRIS', () => {
  const p = planAvecFondPerdu({ cartouche: { actif: true, sombre: true, titre: 'Chamonix', lieu: LIEU } })
  const v = p.cartouche.voile
  assert.equal(v.x, 0, 'le voile laisse du papier nu à gauche')
  assert.equal(v.x + v.largeur, p.largeur, 'le voile laisse du papier nu à droite')
  assert.equal(v.y + v.hauteur, p.hauteur, 'le voile laisse du papier nu en bas')
  // et il porte bien l'encre SOMBRE, celle de « écrire en clair (fond sombre) »
  assert.deepEqual(v.voile, ENCRES.sombre.voile)
})

test('⚠️ MAIS SON DÉGRADÉ RESTE ANCRÉ SUR LE FORMAT FINI — sinon l’acheteur reçoit une autre affiche', () => {
  const avec = planAvecFondPerdu()
  const sans = planPour(4000 - 2 * FOND_PERDU_PX, 5600 - 2 * FOND_PERDU_PX, { vignette: 0.6 })
  // les deux ont le MÊME rectangle fini ; les bouts du dégradé doivent donc
  // tomber au même endroit dans ce rectangle, au pixel près.
  const relatif = (p) => ({
    haut: p.cartouche.voile.degradeHaut - p.fini.y,
    bas: p.cartouche.voile.degradeBas - p.fini.y,
  })
  assert.deepEqual(relatif(avec), relatif(sans))
  assert.equal(avec.cartouche.voile.degradeBas, avec.fini.y + avec.fini.hauteur)
  // le rectangle peint, lui, descend PLUS BAS que le dernier arrêt : c'est ce
  // débord qui prolonge l'image finale dans le fond perdu.
  assert.ok(avec.cartouche.voile.y + avec.cartouche.voile.hauteur > avec.cartouche.voile.degradeBas)
})

test('⚠️ LE RECTANGLE VRAIMENT PEINT COUVRE LES BORDS QUE LE VOILE TOUCHE', () => {
  // La preuve porte sur le DESSIN, pas sur le plan : c'est `dessinerVoile` qui
  // décide, et c'est lui qui posait le rectangle trop court.
  const p = planAvecFondPerdu({ cartouche: { actif: true, sombre: true, titre: 'Chamonix', lieu: LIEU } })
  const bande = { x: 0, y: p.hauteur - 400, largeur: p.largeur, hauteur: 400 }
  const ctx = contexteEnregistreur(bande.largeur, bande.hauteur)
  composerSurToile(ctx, p, { toile: bande })
  const voile = ctx.journal.find((e) => e.type === 'rect' && e.fill?.type === 'degrade')
  assert.ok(voile, 'le voile n’est pas posé sur la bande du bas')
  // trois points du fond perdu, en coordonnées de la bande
  for (const [x, y, quoi] of [
    [0, bande.hauteur - 0.5, 'angle bas gauche du fichier'],
    [p.largeur - 0.5, bande.hauteur - 0.5, 'angle bas droit du fichier'],
    [FOND_PERDU_PX / 2, bande.hauteur - FOND_PERDU_PX / 2, 'fond perdu bas gauche'],
  ]) {
    assert.ok(
      x >= voile.x && x <= voile.x + voile.w && y >= voile.y && y <= voile.y + voile.h,
      `${quoi} n’est pas couvert par le voile : la carte brute y réapparaît`
    )
  }
  // et l'arrêt opaque du dégradé est AU-DESSUS du bas du rectangle : tout ce
  // qui est en dessous — le fond perdu — reçoit donc la couleur clampée, à
  // pleine opacité. C'est ça, « prolonger l'image finale ».
  assert.ok(voile.fill.y0 < voile.y + voile.h, 'le dégradé s’arrête au bas du rectangle au lieu du trait de coupe')
})

test('⚠️ LE CARTOUCHE, LUI, N’ENTRE PAS DANS LE FOND PERDU — il y serait coupé', () => {
  const p = planAvecFondPerdu()
  const dedans = (x, y, quoi) => assert.ok(
    x >= p.fini.x && x <= p.fini.x + p.fini.largeur && y >= p.fini.y && y <= p.fini.y + p.fini.hauteur,
    `${quoi} sort du format fini : le massicot le prend`
  )
  for (const clef of ['lieu', 'sous', 'alt']) {
    const l = p.cartouche[clef]
    // la ligne de base ET le haut des capitales : ni l'une ni l'autre ne dépasse
    dedans(l.x, l.base, `${clef} (ligne de base)`)
    dedans(l.x, l.base - l.taille, `${clef} (haut des capitales)`)
  }
  dedans(p.logo.x, p.logo.y, 'logo (angle haut gauche)')
  dedans(p.logo.x + p.logo.largeur, p.logo.y + p.logo.hauteur, 'logo (angle bas droit)')
  dedans(p.attribution.x, p.attribution.base, 'attribution')
})

test('⚠️ LE VIGNETTAGE ET LE GRAIN, EUX, TRAITENT AUSSI LE FOND PERDU', () => {
  // Ils s'appliquent en coordonnées du FICHIER : un bloc entièrement situé dans
  // le fond perdu doit donc être traité comme le reste. S'ils s'arrêtaient au
  // format fini, le fond perdu montrerait une image non traitée — le même
  // défaut que le voile, sur un autre calque.
  const p = planAvecFondPerdu()
  assert.ok(p.vignettage, 'le plan de contrôle doit porter un vignettage')
  const nu = new Uint8ClampedArray(4 * 4 * 4).fill(180)
  const coin = Uint8ClampedArray.from(nu)
  // un bloc dans le coin haut gauche du FICHIER, hors du format fini
  reappliquerEffetsPixels(coin, { largeur: 4, hauteur: 4, x: 0, y: 0 }, p)
  assert.notDeepEqual(Array.from(coin), Array.from(nu))
  // et il est plus sombre que le même bloc pris au centre : le vignettage
  // s'extrapole vers l'extérieur au lieu de s'arrêter au trait de coupe
  const centre = Uint8ClampedArray.from(nu)
  reappliquerEffetsPixels(centre, {
    largeur: 4, hauteur: 4,
    x: Math.round(p.fini.x + p.fini.largeur / 2), y: Math.round(p.fini.y + p.fini.hauteur / 2),
  }, p)
  assert.ok(coin[0] < centre[0], 'le coin du fond perdu n’est pas assombri')
})

test('les quatre coins du logo tombent bien dans les quatre coins', () => {
  const fini = zoneFinie({ largeur: 4000, hauteur: 6000, fondPerduPx: 35 })
  const marge = (CQW_LOGO_MARGE / 100) * fini.largeur
  const boites = Object.fromEntries(COINS_LOGO.map((c) => [c, planLogo({ fini, taille: 10, coin: c, ratio: 2 })]))
  for (const c of ['hg', 'bg']) assert.equal(boites[c].x, fini.x + marge)
  for (const c of ['hd', 'bd']) assert.equal(boites[c].x, fini.x + fini.largeur - marge - boites[c].largeur)
  for (const c of ['hg', 'hd']) assert.equal(boites[c].y, fini.y + marge)
  for (const c of ['bg', 'bd']) assert.equal(boites[c].y, fini.y + fini.hauteur - marge - boites[c].hauteur)
  // `height: auto` : la hauteur suit le ratio de l'image, jamais une fraction
  assert.equal(boites.hg.hauteur, boites.hg.largeur / 2)
  assert.equal(planLogo({ fini, taille: 10, coin: 'zz', ratio: 1 }).coin, 'hg')
})

test('⚠️ LA SIGNATURE EST HORS DE PORTÉE DES QUATRE COINS — c’est ce qui remplace un arbitrage', () => {
  // C'est LA propriété qui justifie d'avoir choisi une place fixe plutôt qu'une
  // place qui se déplace : la bande de pied est inatteignable par la boîte d'un
  // logo d'acheteur, quels que soient le coin, la taille du curseur et la forme
  // de l'image. Si elle tombe, la marque ShibuMap peut se retrouver SOUS le
  // logo de l'organisateur sur un fichier vendu.
  const max = Number(JS_AFFICHE.match(/curseur\('Taille', 4, (\d+(?:\.\d+)?)/)[1])
  assert.ok(max > 0, 'la taille maximale du curseur de logo doit se lire dans l’écran')
  for (const [W, H] of [[2480, 3508], [7205, 4961], [1100, 781], [4000, 6000], [1748, 2480]]) {
    for (const fondPerduPx of [0, 35]) {
      const fini = zoneFinie({ largeur: W, hauteur: H, fondPerduPx })
      const sig = planSignature({ fini })
      // ① elle reste DANS le format fini : rien ne part au massicot
      assert.ok(sig.base <= fini.y + fini.hauteur, 'la signature déborde sous le trait de coupe')
      assert.ok(sig.x >= fini.x, 'la signature déborde avant le trait de coupe')
      const hautSignature = sig.base - sig.taille
      // ② LES DEUX COINS DU BAS ne l'atteignent JAMAIS, quelle que soit la
      //    taille au curseur et quelle que soit la forme de l'image : leur boîte
      //    s'arrête au bord inférieur moins `CQW_LOGO_MARGE`, point.
      for (const coin of ['bg', 'bd']) {
        for (const taille of [4, 12, max]) {
          for (const ratio of [0.2, 1, 5]) {
            const b = planLogo({ fini, taille, coin, ratio })
            assert.ok(
              b.y + b.hauteur <= hautSignature,
              `un logo ${coin} de ${taille} cqw (ratio ${ratio}) touche la signature sur ${W}×${H}`
            )
          }
        }
      }
      // ③ LES DEUX COINS DU HAUT ne peuvent descendre jusqu'à elle qu'en ayant
      //    d'abord avalé l'affiche entière — un logo aussi haut se voit au
      //    premier coup d'œil, et aucune place ne survivrait à celui-là.
      const hauteurPourToucher = hautSignature - (fini.y + (CQW_LOGO_MARGE / 100) * fini.largeur)
      assert.ok(
        hauteurPourToucher > 0.85 * fini.hauteur,
        `un logo du haut atteint la signature en ne couvrant que ${(hauteurPourToucher / fini.hauteur * 100) | 0} % de la feuille`
      )
    }
  }
})

test('l’encre de la signature suit le cartouche, comme l’attribution', () => {
  const fini = zoneFinie({ largeur: 4000, hauteur: 6000 })
  assert.equal(planSignature({ fini, cartouche: true }).couleur, ENCRES.clair.texte)
  assert.equal(planSignature({ fini, cartouche: true, sombre: true }).couleur, ENCRES.sombre.texte)
  const nue = planSignature({ fini })
  assert.equal(nue.couleur, '#ffffff')
  assert.ok(nue.ombre > 0, 'sans voile sous elle, la signature garde son ombre portée')
  assert.equal(planSignature({ fini, cartouche: true }).ombre, 0)
  assert.equal(nue.texte, SIGNATURE_TEXTE)
})

test('un cartouche éteint ne dessine rien, ni voile ni texte', () => {
  const p = planPour(4000, 5600, { cartouche: { actif: false, titre: 'x', lieu: LIEU } })
  assert.equal(p.cartouche, null)
  // et l'attribution reprend alors son encre d'origine
  assert.equal(p.attribution.couleur, '#ffffff')
})

// ═══════════════════════════════════════════════════════════════════════════
// ④ L'ÉCHELLE DU GRAIN
// ═══════════════════════════════════════════════════════════════════════════

test('la cellule de grain garde une taille PHYSIQUE, quelle que soit la densité', () => {
  // 0,169 mm : un pixel de DPI_PLANCHER, le grain le plus fin que l'œil sépare
  const attendu = MM_PAR_POUCE / DPI_GRAIN
  for (const [px, mm] of [[8268, 700], [5906, 500], [1100, 700], [2552, 210], [4961, 420]]) {
    const cell = echelleGrainSurface({ largeurFiniePx: px, largeurMm: mm })
    const dpi = densiteEffective(px, mm)
    const tailleMm = (cell * MM_PAR_POUCE) / dpi
    if (dpi >= DPI_GRAIN) {
      // au-dessus du plancher, la cellule VAUT la taille visée, à l'arrondi
      // d'un pixel près — elle ne peut pas mesurer 1,4 px
      assert.ok(Math.abs(tailleMm - attendu) <= attendu * 0.5,
        `${px} px / ${mm} mm : cellule de ${tailleMm.toFixed(3)} mm au lieu de ${attendu.toFixed(3)}`)
    } else {
      // en dessous, le pixel LUI-MÊME est déjà plus gros que la cellule visée :
      // on ne peut pas tirer moins d'un pixel, et c'est le bon comportement —
      // c'est le grain par pixel de l'écran d'édition.
      assert.equal(cell, 1, `${px} px / ${mm} mm : la cellule doit tomber au plancher d'un pixel`)
      assert.ok(tailleMm >= attendu)
    }
  }
})

test('à 300 dpi la cellule fait 2 px, sur l’écran de validation elle en fait 1', () => {
  // un 50 × 70 paysage : 700 mm de large
  assert.equal(echelleGrainSurface({ largeurFiniePx: Math.round((700 / MM_PAR_POUCE) * 300), largeurMm: 700 }), 2)
  // le même, réduit à 1 100 px : le grain redevient par pixel, exactement comme
  // à l'écran d'édition — c'est la formule qui réconcilie les deux, pas un cas
  // particulier
  assert.equal(echelleGrainSurface({ largeurFiniePx: 1100, largeurMm: 700 }), 1)
})

test('sans largeur physique, pas de grain : on ne devine pas une échelle', () => {
  const p = planComposition({ largeur: 1000, hauteur: 1400, grain: 0.4, attribution: 'c' })
  assert.equal(p.grain, null)
  assert.equal(p.densiteDpi, null)
})

test('on ne réapplique que ce qui a été éteint', () => {
  const nu = planPour(1000, 1400, { vignette: 0, grain: 0 })
  assert.equal(nu.vignettage, null)
  assert.equal(nu.grain, null)
  const habille = planPour(1000, 1400, { vignette: 0.6, grain: 0.3 })
  assert.equal(habille.vignettage.darkness, 0.6)
  assert.equal(habille.grain.opacite, 0.3)
})

// ═══════════════════════════════════════════════════════════════════════════
// LE VIGNETTAGE — TRANSCRIT, PAS IMITÉ
// ═══════════════════════════════════════════════════════════════════════════

test('le vignettage vaut 1 au centre et assombrit les coins', () => {
  const o = { darkness: 0.6, offset: 0.28 }
  assert.equal(facteurVignettage(0.5, 0.5, o), 1)
  const coin = facteurVignettage(0, 0, o)
  assert.ok(coin > 0 && coin < 0.4, `coin à ${coin}`)
  // monotone du centre vers le coin : un vignettage qui remonterait quelque
  // part serait un anneau, pas un vignettage
  let precedent = 1
  for (let t = 0; t <= 1.0001; t += 0.05) {
    const f = facteurVignettage(0.5 - t * 0.5, 0.5 - t * 0.5, o)
    assert.ok(f <= precedent + 1e-12, `remontée à t=${t.toFixed(2)}`)
    precedent = f
  }
})

test('⚠️ darkness = 0 éteint VRAIMENT le vignettage — c’est ce qui autorise la neutralisation', () => {
  // main.js neutralise en posant `vignette.darkness = 0`. Si ce n'était qu'un
  // « presque », le pavage garderait un damier résiduel et le compositeur en
  // ajouterait un second par-dessus.
  for (let u = 0; u <= 1.0001; u += 0.1) {
    for (let v = 0; v <= 1.0001; v += 0.1) {
      assert.equal(facteurVignettage(u, v, { darkness: 0, offset: 0.28 }), 1)
    }
  }
})

test('le mélange OVERLAY du grain est celui de la bibliothèque', () => {
  // opacité nulle : l'identité, quel que soit le bruit
  assert.equal(melangeOverlay(0.3, 0.9, 0), 0.3)
  // fond sous 0,5 : multiplication ; au-dessus : écran
  assert.ok(Math.abs(melangeOverlay(0.25, 0.5, 1) - 0.25) < 1e-12)
  assert.ok(Math.abs(melangeOverlay(0.75, 0.5, 1) - 0.75) < 1e-12)
  assert.ok(melangeOverlay(0.25, 0.9, 1) > 0.25, 'un grain clair éclaircit un fond sombre')
  assert.ok(melangeOverlay(0.75, 0.1, 1) < 0.75, 'un grain sombre assombrit un fond clair')
})

test('les conversions sRVB sont réciproques', () => {
  // ⚠️ 1e-4 ET PAS 1e-9 : les deux seuils de la définition sRVB (0,04045 et
  // 0,0031308) sont des valeurs ARRONDIES de la spécification et ne sont pas
  // exactement réciproques. L'écart au coude vaut 2·10⁻⁵, soit un demi-millième
  // de cran sur 8 bits — invisible, mais réel.
  for (const c of [0, 0.02, 0.04045, 0.2, 0.5, 0.9, 1]) {
    assert.ok(Math.abs(lineaireVersSrgb(srgbVersLineaire(c)) - c) < 1e-4, `aller-retour sur ${c}`)
  }
  // et loin du coude, la réciprocité est exacte
  for (const c of [0.2, 0.5, 0.9]) {
    assert.ok(Math.abs(lineaireVersSrgb(srgbVersLineaire(c)) - c) < 1e-12)
  }
})

test('le grain est reproductible et sans état', () => {
  assert.equal(bruitCellule(3, 7), bruitCellule(3, 7))
  assert.notEqual(bruitCellule(3, 7), bruitCellule(4, 7))
  const valeurs = []
  for (let i = 0; i < 4000; i++) valeurs.push(bruitCellule(i % 80, Math.floor(i / 80)))
  const moyenne = valeurs.reduce((a, b) => a + b, 0) / valeurs.length
  assert.ok(moyenne > 0.45 && moyenne < 0.55, `moyenne ${moyenne}`)
  assert.ok(Math.min(...valeurs) >= 0 && Math.max(...valeurs) < 1)
})

// ═══════════════════════════════════════════════════════════════════════════
// ③ PAS DE DAMIER — L'INVARIANCE PAR BANDE
// ═══════════════════════════════════════════════════════════════════════════

function imageTest(w, h) {
  const px = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = (y * w + x) * 4
      px[p] = (x * 7 + y * 3) % 256
      px[p + 1] = (x * 11 + 40) % 256
      px[p + 2] = (y * 13 + 90) % 256
      px[p + 3] = 255
    }
  }
  return px
}

const PLAN_EFFETS = planComposition({
  largeur: 61, hauteur: 47, largeurMm: 700,
  vignette: 0.6, grain: 0.35, attribution: 'c',
})

test('⚠️ RÉAPPLIQUER BANDE PAR BANDE DONNE LE MÊME OCTET QU’EN UNE FOIS', () => {
  // C'est TOUTE la question du damier. Le vignettage et le grain sont des
  // fonctions de la position dans l'AFFICHE ; une bande qui connaît sa position
  // les calcule exactement comme si l'image entière était ouverte — ce que
  // justement on refuse de faire (48 Mo par bande).
  const [w, h] = [PLAN_EFFETS.largeur, PLAN_EFFETS.hauteur]
  const enUneFois = reappliquerEffetsPixels(imageTest(w, h), { largeur: w, hauteur: h, x: 0, y: 0 }, PLAN_EFFETS)
  const source = imageTest(w, h)
  const parBandes = new Uint8ClampedArray(source.length)
  for (let y = 0; y < h; y += 7) {
    const hh = Math.min(7, h - y)
    const bande = source.slice(y * w * 4, (y + hh) * w * 4)
    reappliquerEffetsPixels(bande, { largeur: w, hauteur: hh, x: 0, y }, PLAN_EFFETS)
    parBandes.set(bande, y * w * 4)
  }
  assert.deepEqual([...parBandes], [...enUneFois])
})

test('⚠️ LE CONTRÔLE : une bande qui s’ignore produit BIEN un damier', () => {
  // Sans ce test, l'invariance ci-dessus pourrait être vraie par platitude —
  // un effet qui ne fait rien est invariant par tout. On refait donc la faute
  // exacte que le pavage commettait : chaque bande traitée comme si elle était
  // l'affiche entière. Le résultat DOIT différer, et largement.
  const [w, h] = [PLAN_EFFETS.largeur, PLAN_EFFETS.hauteur]
  const juste = reappliquerEffetsPixels(imageTest(w, h), { largeur: w, hauteur: h, x: 0, y: 0 }, PLAN_EFFETS)
  const source = imageTest(w, h)
  const damier = new Uint8ClampedArray(source.length)
  for (let y = 0; y < h; y += 7) {
    const hh = Math.min(7, h - y)
    const bande = source.slice(y * w * 4, (y + hh) * w * 4)
    // ⚠️ LA FAUTE : le plan est refait AUX DIMENSIONS DE LA BANDE, et l'origine
    // est remise à zéro. C'est très exactement ce que fait un effet d'écran sur
    // une tuile.
    const planBande = planComposition({
      largeur: w, hauteur: hh, largeurMm: 700, vignette: 0.6, grain: 0.35, attribution: 'c',
    })
    reappliquerEffetsPixels(bande, { largeur: w, hauteur: hh, x: 0, y: 0 }, planBande)
    damier.set(bande, y * w * 4)
  }
  let ecartMax = 0
  for (let i = 0; i < juste.length; i++) ecartMax = Math.max(ecartMax, Math.abs(juste[i] - damier[i]))
  assert.ok(ecartMax > 30, `le damier ne se voit pas (écart max ${ecartMax}) : le test ne prouve rien`)
})

test('sans effet à réappliquer, les pixels ne sont pas touchés', () => {
  const plan = planComposition({ largeur: 20, hauteur: 10, largeurMm: 700, attribution: 'c' })
  const avant = imageTest(20, 10)
  const apres = reappliquerEffetsPixels(imageTest(20, 10), { largeur: 20, hauteur: 10, x: 0, y: 0 }, plan)
  assert.deepEqual([...apres], [...avant])
})

// ═══════════════════════════════════════════════════════════════════════════
// ② L'ATTRIBUTION — OBLIGATION DE LICENCE
// ═══════════════════════════════════════════════════════════════════════════

// Un index bathymétrique minimal, du même format que public/data/bathy.
const INDEX_EMODNET = normalizeIndex({
  base: { source: 'gebco', zmax: 8 },
  zones: [{ id: 'fr', source: 'emodnet', zmax: 10, bbox: [-5.5, 47.5, -3.5, 49] }],
})
const BREST = { minLon: -5.0, minLat: 48.2, maxLon: -4.2, maxLat: 48.6 }
const TOKYO = { minLon: 139.4, minLat: 35.4, maxLon: 140.0, maxLat: 35.9 }

test('l’attribution nomme la source fine là où elle a creusé, et nulle part ailleurs', () => {
  const brest = mentionsAffiche({ bathyIndex: INDEX_EMODNET, bounds: BREST, creditsForBounds })
  const tokyo = mentionsAffiche({ bathyIndex: INDEX_EMODNET, bounds: TOKYO, creditsForBounds })
  // ⚠️ MOT POUR MOT : la formulation est imposée par la licence, elle ne se
  // paraphrase ni ne se traduit.
  assert.ok(brest.includes(SOURCES.emodnet.credit), 'la mention EMODnet manque sur une carte de Brest')
  assert.equal(tokyo.includes(SOURCES.emodnet.credit), false, 'EMODnet cité sur une carte du Japon : c’est faux')
  for (const ligne of [brest, tokyo]) {
    assert.ok(ligne.includes(NO_NAVIGATION), 'la mention « not to be used for navigation » est exigée par les quatre sources')
    assert.ok(ligne.includes('OpenStreetMap'), 'ODbL')
    assert.ok(ligne.includes('Mapterhorn'), 'Licence Ouverte 2.0, IGN RGE ALTI')
  }
})

test('un calcul de crédits qui échoue ne produit JAMAIS une affiche sans mention', () => {
  const casse = () => { throw new Error('index illisible') }
  assert.equal(mentionsAffiche({ bathyIndex: null, bounds: BREST, creditsForBounds: casse }), EXPORT_CREDIT)
  assert.equal(mentionsAffiche({}), EXPORT_CREDIT)
  assert.equal(mentionsAffiche({ bounds: BREST, creditsForBounds: () => [] }).length > 0, true)
})

// ─────────────────────────────────────────────────────────────────────────────
// Le contexte 2D enregistreur : de quoi vérifier CE QUI EST DESSINÉ sous node.
// ─────────────────────────────────────────────────────────────────────────────

function contexteEnregistreur(largeur, hauteur) {
  const buf = new Uint8ClampedArray(largeur * hauteur * 4).fill(200)
  const journal = []
  const ctx = {
    largeur, hauteur, journal,
    font: '10px x', fillStyle: '#000', globalAlpha: 1, textAlign: 'left',
    textBaseline: 'alphabetic', letterSpacing: '0px', shadowColor: '', shadowBlur: 0,
    _pile: [],
    save() { this._pile.push({ font: this.font, fillStyle: this.fillStyle, globalAlpha: this.globalAlpha, textAlign: this.textAlign, letterSpacing: this.letterSpacing, shadowBlur: this.shadowBlur }) },
    restore() { Object.assign(this, this._pile.pop() || {}) },
    measureText(t) { return { width: t.length * (parseFloat(this.font) || 10) * 0.5 } },
    fillText(t, x, y) { journal.push({ type: 'texte', texte: t, x, y, font: this.font, fill: this.fillStyle, alpha: this.globalAlpha, align: this.textAlign, ls: this.letterSpacing }) },
    fillRect(x, y, w, h) { journal.push({ type: 'rect', x, y, w, h, fill: this.fillStyle }) },
    createLinearGradient(x0, y0, x1, y1) {
      const arrets = []
      return { type: 'degrade', x0, y0, x1, y1, arrets, addColorStop(o, c) { arrets.push([o, c]) } }
    },
    drawImage(img, x, y, w, h) { journal.push({ type: 'image', img, x, y, w, h }) },
    getImageData(x, y, w, h) {
      const d = new Uint8ClampedArray(w * h * 4)
      for (let j = 0; j < h; j++) d.set(buf.subarray(((y + j) * largeur + x) * 4, ((y + j) * largeur + x + w) * 4), j * w * 4)
      return { data: d, width: w, height: h }
    },
    putImageData(img, x, y) {
      for (let j = 0; j < img.height; j++) {
        buf.set(img.data.subarray(j * img.width * 4, (j + 1) * img.width * 4), ((y + j) * largeur + x) * 4)
      }
    },
  }
  return ctx
}

const PLAN_DESSIN = planComposition({
  largeur: 1100, hauteur: 781, largeurMm: 700,
  cartouche: { actif: true, sombre: false, titre: 'Chamonix', lieu: LIEU },
  vignette: 0.6, grain: 0,
  attribution: `${EXPORT_CREDIT} · ${SOURCES.emodnet.credit} · ${NO_NAVIGATION}`,
})

test('⚠️ L’ATTRIBUTION EST INCRUSTÉE — MOT POUR MOT — SUR L’AFFICHE COMPOSÉE', () => {
  // ⚠️ SI CE TEST TOMBE, l'affiche part sans sa mention obligatoire : ce n'est
  // pas un ornement manquant, c'est une violation de licence sur une image
  // VENDUE. Vérifié par mutation : retirer l'appel à `dessinerAttribution` de
  // `composerSurToile` le tue.
  const ctx = contexteEnregistreur(1100, 781)
  composerSurToile(ctx, PLAN_DESSIN)
  const textes = ctx.journal.filter((e) => e.type === 'texte').map((e) => e.texte)
  assert.ok(textes.includes(PLAN_DESSIN.attribution.texte), `attribution absente ; textes posés : ${JSON.stringify(textes)}`)
  assert.ok(PLAN_DESSIN.attribution.texte.includes(SOURCES.emodnet.credit))
  assert.ok(PLAN_DESSIN.attribution.texte.includes(NO_NAVIGATION))
})

test('⚠️ LA SIGNATURE EST DANS LE FICHIER, PAS SEULEMENT À L’ÉCRAN', () => {
  // Sans elle sur la toile, l'affiche vendue sort anonyme alors que l'aperçu et
  // l'écran de validation la montraient. Vérifié par mutation : retirer l'appel
  // à `dessinerSignature` de `composerSurToile` tue ce test.
  const ctx = contexteEnregistreur(1100, 781)
  composerSurToile(ctx, PLAN_DESSIN)
  const pose = ctx.journal.find((e) => e.type === 'texte' && e.texte === SIGNATURE_TEXTE)
  assert.ok(pose, `signature absente ; textes posés : ${JSON.stringify(ctx.journal.filter((e) => e.type === 'texte').map((e) => e.texte))}`)
  // et elle appartient à la BANDE DU BAS, à elle seule : une signature dessinée
  // sur chaque bande d'un tirage pavé s'imprimerait douze fois
  const haut = contexteEnregistreur(1100, 200)
  composerSurToile(haut, PLAN_DESSIN, { toile: { x: 0, y: 0, largeur: 1100, hauteur: 200 } })
  assert.equal(haut.journal.some((e) => e.type === 'texte' && e.texte === SIGNATURE_TEXTE), false)
})

test('le cartouche composé porte les trois lignes, et son voile en dégradé', () => {
  const ctx = contexteEnregistreur(1100, 781)
  composerSurToile(ctx, PLAN_DESSIN)
  const textes = ctx.journal.filter((e) => e.type === 'texte').map((e) => e.texte)
  const t = texteCartouche({ titre: 'Chamonix', lieu: LIEU })
  assert.ok(textes.includes(t.lieu))
  assert.ok(textes.includes(t.sous.toUpperCase()))
  assert.ok(textes.includes(t.alt))
  const voile = ctx.journal.find((e) => e.type === 'rect' && e.fill?.type === 'degrade')
  assert.ok(voile, 'le voile du cartouche n’est pas posé')
  // `to top` : opaque en bas, transparent en haut — le dégradé part donc du bas
  assert.ok(voile.fill.y0 > voile.fill.y1)
  assert.match(voile.fill.arrets[0][1], /rgba\(255, 255, 255, 0.82\)/)
  assert.match(voile.fill.arrets[1][1], /, 0\)$/)
})

test('l’ordre du dessin est celui de l’écran : les effets sous le cartouche', () => {
  // À l'écran, le cartouche est du DOM PAR-DESSUS l'image : le vignettage ne
  // l'assombrit pas. L'inverser ici assombrirait le titre dans les coins.
  const ctx = contexteEnregistreur(1100, 781)
  const ordre = []
  const vraiPut = ctx.putImageData.bind(ctx)
  ctx.putImageData = (...a) => { ordre.push('effets'); return vraiPut(...a) }
  const vraiFill = ctx.fillText.bind(ctx)
  ctx.fillText = (...a) => { ordre.push('texte'); return vraiFill(...a) }
  composerSurToile(ctx, PLAN_DESSIN)
  assert.equal(ordre[0], 'effets')
  assert.equal(ordre.lastIndexOf('effets') < ordre.indexOf('texte'), true)
})

test('une bande ne dessine que ce qui la traverse, aux bonnes coordonnées', () => {
  const bande = { x: 0, y: 600, largeur: 1100, hauteur: 181 }
  const ctx = contexteEnregistreur(1100, 181)
  composerSurToile(ctx, PLAN_DESSIN, { toile: bande })
  const att = ctx.journal.find((e) => e.type === 'texte' && e.texte === PLAN_DESSIN.attribution.texte)
  assert.ok(att, 'l’attribution manque sur la bande du bas')
  // ramenée aux coordonnées de la bande, pas à celles du fichier
  assert.equal(att.y, PLAN_DESSIN.attribution.base - bande.y)
  assert.ok(att.y >= 0 && att.y <= bande.hauteur)
})

// ═══════════════════════════════════════════════════════════════════════════
// LE BRANCHEMENT SUR LE PAVAGE — PAR LA TOILE, PAS PAR L'ORCHESTRATEUR
// ═══════════════════════════════════════════════════════════════════════════

test('supportAffiche compose chaque bande avant de l’encoder, dans l’ordre', () => {
  const composees = []
  const base = {
    creerToile(largeur, hauteur) {
      const ctx = contexteEnregistreur(largeur, hauteur)
      return {
        largeur, hauteur,
        poser() {},
        contexte2d: () => ctx,
        encoder: async () => {
          composees.push({ largeur, hauteur, textes: ctx.journal.filter((e) => e.type === 'texte').map((e) => e.texte) })
          return 'blob'
        },
        liberer() {},
      }
    },
  }
  const sup = supportAffiche({ plan: PLAN_DESSIN, base })
  // trois bandes de 260, 260, 261 : la somme retombe sur la hauteur du fichier
  const hauteurs = [260, 260, 261]
  const promesses = hauteurs.map((h) => {
    const t = sup.creerToile(1100, h)
    return t.encoder('image/png', 0.95)
  })
  return Promise.all(promesses).then((blobs) => {
    assert.deepEqual(blobs, ['blob', 'blob', 'blob'])
    assert.equal(sup.hauteurCouverte(), 781)
    // l'attribution est en bas à droite : elle appartient à la DERNIÈRE bande,
    // et à elle seule
    assert.equal(composees[0].textes.includes(PLAN_DESSIN.attribution.texte), false)
    assert.ok(composees[2].textes.includes(PLAN_DESSIN.attribution.texte))
  })
})

test('une toile sans contexte accessible encode quand même, mais le dit', () => {
  const avert = []
  const vrai = console.warn
  console.warn = (m) => avert.push(String(m))
  try {
    const base = { creerToile: () => ({ poser() {}, encoder: async () => 'nu', liberer() {} }) }
    const sup = supportAffiche({ plan: PLAN_DESSIN, base })
    return sup.creerToile(10, 10).encoder('image/png', 1).then((b) => {
      assert.equal(b, 'nu')
      assert.equal(avert.length, 1)
      assert.match(avert[0], /SANS cartouche ni attribution/)
    })
  } finally {
    console.warn = vrai
  }
})

test('supportAffiche refuse de se passer d’un support de base', () => {
  assert.throws(() => supportAffiche({ plan: PLAN_DESSIN }), /support de base/)
})

// ═══════════════════════════════════════════════════════════════════════════
// L'ÉCRAN DE VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

test('l’écran de validation réduit le format FINI à 1 100 px', () => {
  const t = tailleValidation([8268, 5906])
  assert.equal(Math.max(t.largeur, t.hauteur), VALIDATION_MAX_PX)
  // l'aspect survit à l'arrondi près
  assert.ok(Math.abs(t.largeur / t.hauteur - 8268 / 5906) < 1e-3)
  // portrait aussi
  const p = tailleValidation([5906, 8268])
  assert.equal(Math.max(p.largeur, p.hauteur), VALIDATION_MAX_PX)
})

// ─────────────────────────────────────────────────────────────────────────────
// Trois propriétés que les mutations ont d'abord SURVÉCUES — donc trois trous.
// ─────────────────────────────────────────────────────────────────────────────

test('⚠️ LE GRAIN EST TIRÉ PAR CELLULE, PAS PAR PIXEL', () => {
  // Sans ça, l'échelle calculée par `echelleGrain` ne sert à rien : le fichier
  // repart avec un bruit blanc par pixel, invisible à 300 dpi et
  // incompressible. La mutation « cellule = 1 » doit mourir ici.
  const plan = planComposition({ largeur: 300, hauteur: 20, largeurMm: MM_PAR_POUCE, grain: 0.5 })
  assert.equal(plan.grain.cellulePx, 2, 'la surface est à 300 dpi : la cellule fait 2 px')
  const w = 300
  const h = 20
  const px = new Uint8ClampedArray(w * h * 4).fill(255)
  for (let i = 0; i < w * h; i++) { px[i * 4] = 128; px[i * 4 + 1] = 128; px[i * 4 + 2] = 128 }
  reappliquerEffetsPixels(px, { largeur: w, hauteur: h, x: 0, y: 0 }, plan)
  const lire = (x, y) => px[(y * w + x) * 4]
  // les quatre pixels d'une même cellule portent le MÊME tirage
  assert.equal(lire(0, 0), lire(1, 0))
  assert.equal(lire(0, 0), lire(0, 1))
  assert.equal(lire(0, 0), lire(1, 1))
  // et la cellule voisine porte le sien : au moins une différence sur vingt
  let differences = 0
  for (let c = 1; c < 20; c++) if (lire(2 * c, 0) !== lire(0, 0)) differences++
  assert.ok(differences > 12, `${differences} cellules voisines seulement diffèrent`)
})

test('⚠️ LES EFFETS S’APPLIQUENT EN LUMIÈRE LINÉAIRE, PAS SUR LES OCTETS sRVB', () => {
  // Sur le GPU, la chaîne d'effets travaille en linéaire et l'encodage sRVB
  // n'a lieu qu'à la toute fin. Multiplier directement les octets d'un canevas
  // donnerait des coins visiblement plus clairs que l'image validée à l'écran.
  const plan = planComposition({ largeur: 101, hauteur: 101, largeurMm: 700, vignette: 0.6 })
  const px = new Uint8ClampedArray(4).fill(255)
  px[0] = px[1] = px[2] = 128
  // le coin haut-gauche : c'est là que le vignettage mord le plus
  reappliquerEffetsPixels(px, { largeur: 1, hauteur: 1, x: 0, y: 0 }, plan)
  const f = facteurVignettage(0, 0, plan.vignettage)
  const attenduLineaire = Math.round(lineaireVersSrgb(srgbVersLineaire(128 / 255) * f) * 255)
  const attenduNaif = Math.round(128 * f)
  assert.ok(Math.abs(px[0] - attenduLineaire) <= 1, `${px[0]} ≠ ${attenduLineaire} (linéaire)`)
  // et les deux chemins sont bien DISCERNABLES : sinon ce test ne prouverait rien
  assert.ok(Math.abs(attenduLineaire - attenduNaif) > 8,
    `les deux espaces donnent la même valeur (${attenduLineaire} / ${attenduNaif}) : le test ne prouve rien`)
})

test('⚠️ la sous-ligne du cartouche passe en capitales, comme le CSS l’impose', () => {
  // `text-transform: uppercase` sur `.af-cart-sous`. Les coordonnées sont déjà
  // en capitales — la faute serait donc invisible sur elles, et seulement sur
  // elles. On la débusque avec un texte qui, lui, a des minuscules.
  const fini = zoneFinie({ largeur: 1000, hauteur: 1400 })
  const p = planCartouche({ fini, textes: { lieu: 'Chamonix', sous: '45.833° n · 6.865° e', alt: '4805 m' } })
  assert.equal(p.sous.texte, '45.833° N · 6.865° E')
  // le nom du lieu, lui, garde sa casse : le CSS ne la touche pas
  assert.equal(p.lieu.texte, 'Chamonix')
})

test('des bandes qui débordent l’affiche sont signalées, pas subies', () => {
  const avert = []
  const vrai = console.warn
  console.warn = (m) => avert.push(String(m))
  try {
    const base = { creerToile: () => ({ poser() {}, contexte2d: () => contexteEnregistreur(4, 4), encoder: async () => 'b', liberer() {} }) }
    const sup = supportAffiche({ plan: PLAN_DESSIN, base })
    sup.creerToile(1100, 500)
    assert.equal(avert.length, 0)
    sup.creerToile(1100, 500) // 1 000 px de trop
    assert.equal(avert.length, 1)
    assert.match(avert[0], /du haut vers le bas/)
  } finally {
    console.warn = vrai
  }
})
