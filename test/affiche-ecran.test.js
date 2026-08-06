// L'ÉCRAN D'AFFICHE — CE QU'IL DIT, ET CE QU'IL MONTRE DU FORMAT
//
// ⚠️ PAR RELECTURE DE SOURCE, comme test/affiche-tirage.test.js et pour la même
// raison : `src/ui/affiche.js` importe une feuille de style et ne se charge pas
// sous node. La relecture ne remplace pas une exécution ; elle attrape la classe
// de régression qui coûte quelque chose ici — un libellé qui repart en arrière,
// une option grisée qui redevient muette, une pastille qui recommence à mentir
// sur la forme du format.
//
// Ce fichier tient trois choses, dans l'ordre où l'acheteur les rencontre :
//   1. LE POINT D'ENTRÉE dit qu'on imprime, pas qu'on regarde ;
//   2. L'ÉCRAN PRÉSENTE DEUX ISSUES, et la fermée dit POURQUOI elle est fermée ;
//   3. LA PASTILLE DE FORMAT prend le sens choisi, et sa proportion vient de la
//      même fonction que la feuille.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { FORMATS_AFFICHE, geometriePage } from '../src/print-page.js'

const lire = (p) => readFileSync(fileURLToPath(new URL(`../${p}`, import.meta.url)), 'utf8')
const AFFICHE = lire('src/ui/affiche.js')
const BARS = lire('src/ui/bars.js')
const CSS = lire('src/ui/affiche.css')

// ═══════════════════════════════════════════════════════════════════════════
// 1. LE POINT D'ENTRÉE
// ═══════════════════════════════════════════════════════════════════════════

test('⚠️ LE MENU DIT « IMPRIMER », PAS « VOIR »', () => {
  // À côté de « Exporter une image ou une vidéo », « Voir mon affiche » se
  // lisait comme un deuxième aperçu : le seul endroit d'où l'on sort un fichier
  // d'impression n'annonçait pas qu'il imprimait.
  assert.match(BARS, /pubItem\(I\.export, 'Imprimer mon affiche',/)
  assert.equal(BARS.includes("'Voir mon affiche'"), false)
  // et la sous-ligne garde la promesse de l'ancien libellé : on regarde d'abord
  const sous = BARS.match(/pubItem\(I\.export, 'Imprimer mon affiche', '([^']+)'/)
  assert.ok(sous, 'la vignette d’entrée doit garder une sous-ligne')
  assert.match(sous[1], /vrai format/)
})

// ═══════════════════════════════════════════════════════════════════════════
// 2. DEUX ISSUES, DONT UNE SEULE EST OUVERTE
// ═══════════════════════════════════════════════════════════════════════════

test('l’écran propose le téléchargement ET l’impression, et une seule est ouverte', () => {
  assert.match(AFFICHE, /export const CTA_TELECHARGER = 'Télécharger le fichier'/)
  // le bouton d'achat porte cette étiquette, et il la retrouve après un essai
  // qui a échoué : deux libellés en dur, c'est un bouton qui change de nom
  assert.equal(AFFICHE.split('CTA_TELECHARGER').length - 1 >= 3, true)
  assert.equal(AFFICHE.includes("'Recevoir le fichier'"), false)
  // l'autre issue existe, et elle est nommée
  assert.match(AFFICHE, /af-issue-nom', 'Faire imprimer et livrer'/)
})

test('⚠️ L’OPTION FERMÉE DIT POURQUOI, ET SI ÇA VAUT LA PEINE D’ATTENDRE', () => {
  // « Bientôt » tout seul laisse l'acheteur devant un calcul qu'il ne peut pas
  // faire. La phrase doit répondre aux deux questions d'un coup — pourquoi
  // c'est fermé, et ce qu'il perd à ne pas attendre.
  const phrase = AFFICHE.match(/'af-issue-phrase',\s*\n?\s*'([^']+)'/)
    || AFFICHE.match(/'af-issue-phrase',\s*'([^']+)'/)
  assert.ok(phrase, 'l’option fermée doit porter une phrase')
  assert.ok(phrase[1].length > 40, 'une option grisée qui ne dit rien ne vaut pas mieux qu’absente')
  // AUCUNE DATE PROMISE : une date manquée coûte plus cher qu'une absence de date
  assert.equal(/\b(20\d\d|janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre|semaines?|jours?|mois)\b/i.test(phrase[1]), false,
    `la phrase promet un délai : « ${phrase[1]} »`)
})

test('l’option fermée n’est PAS un bouton désactivé', () => {
  // Un bouton grisé de la même forme que celui d'à côté se lit comme un
  // chargement qui n'a pas abouti : on reclique, on recharge la page.
  const bloc = CSS.slice(CSS.indexOf('\n.af-issue {'), CSS.indexOf('\n.af-issue-phrase'))
  assert.ok(bloc.length > 0, '.af-issue doit exister dans le CSS')
  assert.equal(/background:\s*var\(--ce-accent\)/.test(bloc), false)
  assert.equal(/cursor:\s*pointer/.test(bloc), false)
  assert.match(bloc, /cursor:\s*default/)
  // et le bouton d'achat, lui, garde son fond accentué : la hiérarchie tient
  const cta = CSS.slice(CSS.indexOf('\n.af-cta {'), CSS.indexOf('\n.af-cta:hover'))
  assert.match(cta, /background:\s*var\(--ce-accent\)/)
})

test('à 0 €, l’étiquette et la phrase de réassurance restent cohérentes avec le nouveau bouton', () => {
  // Le bouton dit « Télécharger le fichier · Gratuit », et la phrase en dessous
  // parle du même fichier : le jour où le prix remonte, les deux se dérivent du
  // même chiffre, elles ne se réécrivent pas à la main.
  assert.match(AFFICHE, /export function etiquettePrix/)
  assert.match(AFFICHE, /euros > 0 \? `\$\{euros\} €` : 'Gratuit'/)
  assert.match(AFFICHE, /export function phraseRassurance/)
  assert.match(AFFICHE, /Le PDF se télécharge dès le retour/)
})

// ═══════════════════════════════════════════════════════════════════════════
// 3. LA PASTILLE DE FORMAT SUIT LE SENS
// ═══════════════════════════════════════════════════════════════════════════

test('⚠️ LA PASTILLE PREND SA FORME DE `geometriePage`, LA MÊME QUE LA FEUILLE', () => {
  // Retourner les millimètres à la main dans la pastille serait une SECONDE
  // façon de décider d'un sens : le jour où l'une des deux change, la pastille
  // annonce une forme et la feuille en montre une autre.
  assert.match(AFFICHE, /function dessinerVignette\(vignette, id, sens\) \{/)
  const corps = AFFICHE.slice(AFFICHE.indexOf('function dessinerVignette'), AFFICHE.indexOf('function dessinerVignette') + 500)
  assert.match(corps, /geometriePage\(\{ format: id, orientation: sens/)
  // les DEUX côtés sont posés : une seule dimension ferait changer la hauteur
  // de la rangée à chaque bascule de sens
  assert.match(corps, /style\.width/)
  assert.match(corps, /style\.height/)
  // et elle est redessinée quand le sens change, pas seulement à la création
  assert.match(AFFICHE, /for \(const \[id, vignette\] of vignettesFormat\)/)
  assert.equal(AFFICHE.includes('vignette.style.aspectRatio'), false, 'un aspect-ratio figé au portrait ne doit plus traîner')
})

test('la proportion dessinée est celle du format, et elle se retourne avec le sens', () => {
  // ⚠️ LA GRILLE NE PORTE PAS SEPT FORMES : la famille ISO (A4, A3, A2) partage
  // le même √2, et 30 × 40 a la même forme que 40 × 50. La pastille ne sert donc
  // pas à DISTINGUER les sept — elle sert à ne pas MENTIR : trois familles de
  // proportions bien réelles (0,707 · 0,750 · 0,667), qui doivent se voir, et
  // se retourner quand on choisit « Paysage ».
  for (const f of FORMATS_AFFICHE) {
    const [court, long] = f.mm
    const p = geometriePage({ format: f.id, orientation: 'portrait', fondPerduMm: 0 })
    const y = geometriePage({ format: f.id, orientation: 'paysage', fondPerduMm: 0 })
    assert.equal(p.largeurMm / p.hauteurMm, court / long, `${f.id} en portrait`)
    assert.equal(y.largeurMm / y.hauteurMm, long / court, `${f.id} en paysage`)
    assert.ok(p.largeurMm < p.hauteurMm && y.largeurMm > y.hauteurMm)
  }
  const familles = new Set(FORMATS_AFFICHE.map((f) => (f.mm[0] / f.mm[1]).toFixed(3)))
  assert.ok(familles.size >= 3, 'une pastille qui ne montrerait qu’une seule forme ne servirait à rien')
})

test('la pastille reste soumise à `hidden` : un format retiré par la sonde ne revient pas', () => {
  // ⚠️ La règle qui a coûté cher : `display: grid` sur `.af-fmt` bat l'attribut
  // `hidden` de la feuille du navigateur. Poser une largeur en JS sur la
  // pastille ne doit pas réveiller un bouton que la sonde matérielle a retiré —
  // il produirait un fichier qu'on venait de juger impossible.
  assert.match(CSS, /\.af-fmt\[hidden\], \.af-seg button\[hidden\] \{ display: none; \}/)
  assert.match(AFFICHE, /b\.hidden = !ligneFormat\(grilleFormats, id\)\?\.dispo/)
  // et la pastille est redessinée dans le sens que CE format donnerait
  assert.match(AFFICHE, /replierSur\(grilleFormats, id, etat\.orientation\)\?\.orientation/)
})
