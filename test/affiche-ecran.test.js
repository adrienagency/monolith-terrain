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
  assert.match(BARS, /pubItem\(I\.imprimante, 'Imprimer mon affiche',/)
  assert.equal(BARS.includes("'Voir mon affiche'"), false)
  // et la sous-ligne garde la promesse de l'ancien libellé : on regarde d'abord
  const sous = BARS.match(/pubItem\(I\.imprimante, 'Imprimer mon affiche', '([^']+)'/)
  assert.ok(sous, 'la vignette d’entrée doit garder une sous-ligne')
  assert.match(sous[1], /vrai format/)
})

test('⚠️ ET L’ICÔNE EST UNE IMPRIMANTE, PAS UNE FLÈCHE DE TÉLÉVERSEMENT', () => {
  // Adrien, 2026-08-06 : l'entrée portait `I.export` — la flèche vers le haut,
  // partagée avec « Exporter une image ». Le geste annoncé était l'inverse de
  // celui qu'on propose : on ne dépose pas un fichier, on en sort un.
  const svg = BARS.match(/\n {2}imprimante:\s+'([^']+)'/)
  assert.ok(svg, 'le jeu d’icônes doit porter une imprimante')
  // même facture que le reste du jeu : grille de 24, trait 1,8, currentColor,
  // aucun remplissage — une icône qui sortirait du lot se verrait
  assert.match(svg[1], /viewBox="0 0 24 24"/)
  assert.match(svg[1], /stroke="currentColor"/)
  assert.match(svg[1], /stroke-width="1\.8"/)
  assert.match(svg[1], /fill="none"/)
  // et elle n'est pas la flèche de téléversement recopiée
  const exporte = BARS.match(/\n {2}export:\s+'([^']+)'/)
  assert.ok(exporte)
  assert.notEqual(svg[1], exporte[1])
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
  assert.match(AFFICHE, /Tu récupères ton PDF juste après/)
})

test('⚠️ LA PHRASE DE RÉASSURANCE PARLE FRANÇAIS, PAS CAHIER DES CHARGES', () => {
  // Adrien, 2026-08-06 : « le texte n'est pas très français, optimise ». Les
  // trois tournures qui l'avaient fait tiquer, épinglées une par une pour
  // qu'elles ne reviennent pas par une autre porte.
  const gratuite = AFFICHE.match(/return 'Le fichier est <b>offert<\/b>([^']+)'/)
  assert.ok(gratuite, 'la phrase à 0 € doit exister')
  const phrase = gratuite[1]
  // « mise en service » : du vocabulaire d'ingénieur sur un écran d'achat
  assert.equal(/mise en service/i.test(phrase), false)
  // « dès le retour » : le retour de quoi ? Il ne sait pas encore qu'il part
  assert.equal(/dès le retour/i.test(phrase), false)
  // les deux-points qui annoncent une liste : c'est un formulaire, pas une phrase
  assert.equal(phrase.includes(' : '), false)
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

// ═══════════════════════════════════════════════════════════════════════════
// 4. LA GRILLE DES FORMATS EST D'APLOMB
// ═══════════════════════════════════════════════════════════════════════════

test('⚠️ QUATRE COLONNES VRAIMENT ÉGALES : `minmax(0, 1fr)`, PAS `1fr`', () => {
  // La grille était posée de travers en portrait, et la cause n'était ni le
  // `gap` ni la pastille : `1fr` vaut `minmax(auto, 1fr)`, donc une colonne ne
  // descend jamais sous la largeur minimale de son contenu. Avec des libellés en
  // `nowrap`, « 30 × 40 cm » imposait sa loi à « A4 » et les quatre colonnes
  // sortaient à 41,9 / 70,1 / 64 / 70,1 px — sept pastilles sur un pas
  // irrégulier. Le `0` rend aux colonnes le droit de rétrécir.
  // toutes les déclarations de `.af-formats`, media query comprise : une seule
  // qui repartirait en `1fr` suffirait à retordre la grille sur son point de
  // rupture, là où personne ne regarde
  const regles = [...CSS.matchAll(/\.af-formats[^{]*\{[^}]*\}/g)]
    .map((m) => m[0])
    .filter((r) => r.includes('grid-template-columns'))
  assert.equal(regles.length, 2, 'la grille est déclarée en large ET en étroit')
  for (const r of regles) assert.match(r, /grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/)
})

test('le libellé de pastille perd son unité — c\u2019est ce qui fait tenir les colonnes', () => {
  // « cm » quatre fois, c'est du bruit qui coûtait la mise en page : la légende
  // dit « Format » et la ligne de vérité écrit « 50 × 70 cm · 250 dpi · … ».
  assert.match(AFFICHE, /export function etiquetteFormat/)
  assert.match(AFFICHE, /etiquetteFormat\(f\.label\)/)
  // le libellé complet ne disparaît pas pour autant : il passe dans l'infobulle
  assert.match(AFFICHE, /b\.title = f\.label/)
})

test('⚠️ LA RANGÉE RÉSERVE UN CARRÉ FIXE, ET LA CONSTANTE N\u2019EXISTE QU\u2019UNE FOIS', () => {
  // La pastille change de hauteur avec le sens (30 px debout, 20 à 24 couchée) :
  // sans bande réservée, les deux rangées de la grille n'avaient pas la même
  // hauteur et les noms ne s'alignaient pas de l'une à l'autre. Le côté est
  // décidé en JS (`COTE_VIGNETTE`) ; le CSS ne fait que le lire.
  const bloc = CSS.slice(CSS.indexOf('\n.af-fmt {'), CSS.indexOf('\n.af-fmt[hidden]'))
  assert.match(bloc, /grid-template-rows:\s*var\(--af-cote-vignette, 30px\) auto/)
  assert.match(AFFICHE, /grilleEl\.style\.setProperty\('--af-cote-vignette', `\$\{COTE_VIGNETTE\}px`\)/)
})

// ═══════════════════════════════════════════════════════════════════════════
// 5. LES TITRES PORTENT LEUR SUJET
// ═══════════════════════════════════════════════════════════════════════════

test('⚠️ « COMMENT TU LA REÇOIS » A RETROUVÉ SON SUJET', () => {
  // Adrien, 2026-08-06 : « il faut toujours le sujet ». Le titre commençait par
  // un complément et laissait le produit dans un pronom — « la » quoi ?
  assert.equal(AFFICHE.includes('Comment tu la reçois'), false)
  assert.match(AFFICHE, /af-legende', 'Comment on t’envoie ton affiche \?'/)
})

test('les autres titres du panneau ne commencent plus par un verbe ou un complément', () => {
  // La même règle appliquée partout, pas seulement là où Adrien l'a vue : les
  // étapes du tirage annonçaient des noms d'action (« Rendu du fichier… ») là
  // où l'écran d'à côté disait déjà « On fabrique ton fichier ».
  for (const mort of [
    'Écrire en clair (fond sombre)',
    'Vérification de ton affiche…',
    'Rendu du fichier…',
    'Ouverture du paiement sécurisé…',
    'Annulation…',
  ]) {
    assert.equal(AFFICHE.includes(`'${mort}'`), false, `« ${mort} » n’a pas de sujet`)
  }
  for (const vivant of [
    'On fabrique ton fichier',
    'On vérifie ton affiche…',
    'On rend ton fichier…',
    'On ouvre le paiement sécurisé…',
    'On annule…',
    'Ton fichier est prêt',
    'Texte clair sur fond sombre',
  ]) {
    assert.ok(AFFICHE.includes(`'${vivant}'`), `« ${vivant} » doit être écrit`)
  }
})
