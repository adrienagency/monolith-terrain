// LE CRÉDIT D'ORTHOPHOTO — Tâche R9 du plan « LE STUDIO SUR LE GLOBE »
// (`docs/superpowers/plans/2026-08-22-globe-studio.md`), tour de correction.
//
// ══════════ CE QUE CE FICHIER VÉRIFIE, ET POURQUOI IL EXISTE ════════════════
//
// ⛔ **R9 A INVERSÉ LE DÉFAUT QU'IL DEVAIT ÉVITER.** La Tâche R1 ② avait borné le
// crédit d'orthophoto au drapeau — `if (aerialAttribution && !terreUniqueBranchee)`
// — sur l'argument explicite « sous `terre unique`, l'orthophoto n'est JAMAIS à
// l'écran ». R9 branche la photo SUR LA DÉCOUPE : la prémisse tombe, et la
// mention légale disparaît **au moment précis où elle devient obligatoire**.
//
// ⛔⛔ **ET LE TEST QUI GARDAIT CETTE GARDE LA VERROUILLAIT.**
// `test/visibilite-surface.test.js` ③ exigeait le TEXTE de la ligne, par
// expression régulière : la suite ne se contentait pas de manquer le défaut,
// **elle rougissait sur sa correction**. C'est la classe de défaut la plus
// coûteuse de ce chantier, prise par l'autre bout — d'ordinaire le grep laisse
// passer une mutation, ici il interdisait la réparation.
//
// ══════════ COMMENT — LE NUANCEUR SERT D'ORACLE ════════════════════════════
//
// La question est **« le crédit décrit-il ce qui est peint ? »**. Elle n'a
// qu'une réponse vraie : celle du nuanceur, qui décide seul de peindre ou non.
// ② **EXTRAIT la garde du bloc aérien de `src/globe.js`, la traduit et
// l'EXÉCUTE** contre `orthophotoPeinteSurLeCrop`, sur la table de vérité
// complète. Si l'un des deux change d'avis, le test rougit — et il rougit dans
// les deux sens, ce qu'aucune assertion de texte ne sait faire.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { creditOrthophoto, orthophotoPeinteSurLeCrop } from '../src/monde/credit-orthophoto.js'

const GLOBE_SRC = readFileSync(new URL('../src/globe.js', import.meta.url), 'utf8')
/** ⚠️ SANS SES COMMENTAIRES — la Tâche K ter a trouvé une assertion verte parce
 *  qu'elle lisait une formule DANS un commentaire. */
const GLOBE_NU = GLOBE_SRC.replace(/\/\/[^\n]*/g, '')

const ATTR = '© IGN · NASA GIBS'

/** Le stub d'uniformes, à la forme de `globe.uniforms` : `{ value }`. */
const uni = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { value: v }]))
/** Un crop vivant qui peint la photo — le cas nominal de R9. */
const PEINT = { uCropOn: 1, uAerialOn: 1, uAerialOpacity: 1 }

// ══════════ ① LA LOI DU CRÉDIT — LES QUATRE CAS, ET LE CINQUIÈME ═══════════

test('① SOUS LE DRAPEAU, PHOTO PEINTE : LE CRÉDIT EST LÀ — c’est la régression de R9', () => {
  // ⛔ **C'EST LE CONSTAT CRITIQUE.** Mesuré à l'écran sous
  // `?terre=unique&frontiere=1`, `uAerialOn = 1` : l'imagerie IGN était peinte
  // sur la sphère et « Orthophotos © IGN · NASA GIBS » était ABSENT. Une
  // obligation de licence, pas une coquetterie.
  assert.equal(creditOrthophoto({ terreUnique: true, attribution: ATTR, peinte: true }), ATTR)
})

test('① SOUS LE DRAPEAU, PHOTO NON PEINTE : PAS DE CRÉDIT — la garde de R1 ② tient encore', () => {
  // ⚠️ **LA CORRECTION NE JETTE PAS L'ANCIENNE GARDE, ELLE LA GÉNÉRALISE.**
  // Avant R9, la découpe ne peignait jamais la photo : `peinte` valait toujours
  // faux, donc cette loi rend exactement ce que R1 ② rendait. C'est la même
  // règle, énoncée sur la bonne grandeur.
  assert.equal(creditOrthophoto({ terreUnique: true, attribution: ATTR, peinte: false }), null)
})

test('① SANS DRAPEAU : INTACT, y compris son défaut — laissé à l’arbitrage d’Adrien', () => {
  // ⛔ **LE DÉFAUT DE PRODUCTION N'EST PAS CORRIGÉ EN PASSANT.** Mesuré le
  // 2026-08-23 sans aucun drapeau (`.banc/R1-tour2/credit-prod.json`) : en
  // orbite, `terrain.mesh.visible` est faux — l'orthophoto n'est pas à l'écran —
  // et le crédit s'affiche quand même. Le corriger ici changerait le
  // comportement SANS drapeau, la seule garantie que ce chantier a tenue de bout
  // en bout. ⚠️ **Cette assertion est donc une DÉCISION, pas un oubli** : elle
  // rougira le jour où quelqu'un corrigera la production sans le dire.
  assert.equal(creditOrthophoto({ terreUnique: false, attribution: ATTR, peinte: false }), ATTR)
  assert.equal(creditOrthophoto({ terreUnique: false, attribution: ATTR, peinte: true }), ATTR)
})

test('① PAS D’ATTRIBUTION, PAS DE CRÉDIT — et ce verrou-là passe avant tous les autres', () => {
  // `aerialAttribution` ne vaut quelque chose que si une mosaïque a VRAIMENT été
  // composée et posée. Une mention au-dessus d'une mosaïque vide serait au choix
  // gratuite ou un mensonge sur ce qu'on regarde.
  for (const terreUnique of [true, false]) {
    for (const peinte of [true, false]) {
      assert.equal(creditOrthophoto({ terreUnique, attribution: null, peinte }), null)
      assert.equal(creditOrthophoto({ terreUnique, attribution: '', peinte }), null)
    }
  }
})

// ══════════ ② ⚡ LA GARDE DU NUANCEUR SERT D'ORACLE ════════════════════════

test('② ⚡ la loi du crédit rend EXACTEMENT ce que le nuanceur décide de peindre', () => {
  // ⚠️⚠️ **C'EST L'ASSERTION QUI DÉCIDE DU TOUR.** Le seul juge de « qu'est-ce
  // qui est peint » est `src/globe.js`. On EXTRAIT sa garde, on la traduit, on
  // l'EXÉCUTE, et on la compare à la loi sur la table de vérité complète. Aucune
  // condition n'est recopiée à la main : la référence est le code qui rend.
  const m = GLOBE_NU.match(/if \((uAerialOn > 0\.5 [^)]*dedansCrop > 0\.0)\) \{/)
  assert.ok(m, 'la garde du bloc aérien du nuanceur est introuvable ou a changé de forme')

  // ⚠️ **`dedansCrop` DEVIENT `uCropOn`, ET LA SUBSTITUTION EST PROUVÉE, PAS
  // SUPPOSÉE** : `dedansCrop` part à zéro et n'est affecté QUE dans la branche
  // `if (uCropOn > 0.5)`. Sans découpe, il vaut zéro, donc le bloc est sauté.
  assert.match(GLOBE_NU, /float dedansCrop = 0\.0;/)
  const iCrop = GLOBE_NU.indexOf('if (uCropOn > 0.5) {')
  const iAff = GLOBE_NU.indexOf('dedansCrop = dedans;')
  assert.ok(iCrop > 0 && iAff > iCrop, '`dedansCrop` n’est plus affecté sous `uCropOn` : la substitution ne tient plus')
  // ⚠️ **DEUX ÉCRITURES EN TOUT, ET PAS UNE DE PLUS** : la déclaration à zéro et
  // celle-là. Une troisième, ailleurs dans le nuanceur, casserait l'équivalence
  // `dedansCrop > 0 ⇔ uCropOn > 0.5` sur laquelle repose toute cette traduction.
  assert.equal((GLOBE_NU.match(/\bdedansCrop = /g) || []).length, 2,
    '`dedansCrop` reçoit une valeur ailleurs que sa déclaration et la branche du crop')

  // eslint-disable-next-line no-new-func
  const gardeNuanceur = new Function('uAerialOn', 'uAerialOpacity', 'dedansCrop', `return !!(${m[1]});`)

  for (const uCropOn of [0, 1]) {
    for (const uAerialOn of [0, 1]) {
      for (const uAerialOpacity of [0, 0.0005, 0.5, 1]) {
        const u = uni({ uCropOn, uAerialOn, uAerialOpacity })
        // `dedansCrop` vaut zéro hors découpe ; dedans, il monte vers 1.
        const attendu = gardeNuanceur(uAerialOn, uAerialOpacity, uCropOn > 0.5 ? 1 : 0)
        assert.equal(orthophotoPeinteSurLeCrop(u), attendu,
          `crop=${uCropOn} on=${uAerialOn} opacite=${uAerialOpacity} : la loi et le nuanceur ne disent pas la même chose`)
      }
    }
  }

  // ⚠️ **ET LA CONTRE-ÉPREUVE EST DANS LE TEST** : la table doit contenir des
  // VRAIS et des FAUX, faute de quoi l'égalité ci-dessus serait verte pour une
  // loi constante.
  assert.equal(orthophotoPeinteSurLeCrop(uni(PEINT)), true)
  assert.equal(orthophotoPeinteSurLeCrop(uni({ ...PEINT, uCropOn: 0 })), false)
})

test('② un globe absent, mort ou sans uniformes ne peint rien — et ne fait pas tomber le crédit', () => {
  // ⚠️ **`globe` EST RÉASSIGNÉ À LA PERTE DE CONTEXTE WebGL** (le pavé de
  // `veilleCrop` le dit), et `refreshOsmCredit` tourne au chargement, avant que
  // quoi que ce soit ne soit construit. Une exception ici effacerait la ligne de
  // crédit ENTIÈRE — GeoNames et l'occupation du sol avec.
  assert.equal(orthophotoPeinteSurLeCrop(null), false)
  assert.equal(orthophotoPeinteSurLeCrop(undefined), false)
  assert.equal(orthophotoPeinteSurLeCrop({}), false)
  // un globe en production : les trois uniformes existent et valent leur défaut
  assert.equal(orthophotoPeinteSurLeCrop(uni({ uCropOn: 0, uAerialOn: 0, uAerialOpacity: 1 })), false)
})

// ══════════ ③ LES DÉFAUTS DU GLOBE — LA PRODUCTION NE CRÉDITE RIEN ═════════

test('③ aux défauts du constructeur, la découpe ne peint pas — donc la production ne crédite pas', () => {
  // ⚠️ **`uCropOn` ET `uAerialOn` PARTENT À ZÉRO**, et c'est ce qui garantit que
  // la vue orbitale en production ne réclame aucune mention. Les deux défauts
  // sont lus DANS `globe.js`, pas recopiés ici.
  assert.match(GLOBE_NU, /uCropOn: \{ value: 0 \}/)
  assert.match(GLOBE_NU, /uAerialOn: \{ value: 0 \}/)
  const defaut = (nom) => Number(GLOBE_NU.match(new RegExp(`${nom}: \\{ value: ([\\d.]+) \\}`))[1])
  assert.equal(orthophotoPeinteSurLeCrop(uni({
    uCropOn: defaut('uCropOn'),
    uAerialOn: defaut('uAerialOn'),
    uAerialOpacity: defaut('uAerialOpacity'),
  })), false)
})
