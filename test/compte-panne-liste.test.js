import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// LE DÉFAUT QUE CE FICHIER EMPÊCHE DE REVENIR.
//
// « Mes cartes » avalait l'échec de sa lecture et affichait l'écran vide. Un
// organisateur qui a douze courses lisait donc « Tu n'as pas encore publié de
// carte », se voyait proposer « Composer ma première carte », et n'avait aucun
// moyen de réessayer. Le produit lui affirmait, en face, quelque chose de faux
// sur son propre travail.
//
// ⚠️ CE N'ÉTAIT PAS UNE ERREUR D'INATTENTION, C'EST LA PENTE NATURELLE. Écrire
// `catch { cartes = [] }` est la façon la plus courte de ne pas planter, elle
// se relit très bien, et elle est fausse : « je n'ai rien pu lire » et « il n'y
// a rien » sont deux choses différentes, qui appellent deux écrans différents.
// La correction se défera donc toute seule à la première simplification bien
// intentionnée, si rien ne la retient.
//
// ⚠️ ET AUCUN TEST NORMAL NE PEUT LA RETENIR : `src/ui/compte.js` importe sa
// feuille de style, donc `node --test` ne sait pas le charger. On lit la
// source. C'est grossier, et c'est la seule sentinelle disponible ici — la
// seule autre étant `vite build`, qui ne juge que la syntaxe.

const SOURCE = readFileSync(new URL('../src/ui/compte.js', import.meta.url), 'utf8')

test('l’échec de lecture reste distinct de la liste vide', () => {
  // Le `catch` doit lever un drapeau. S'il se contente de vider la liste,
  // l'écran ne peut plus faire la différence, quoi qu'il affiche ensuite.
  const avale = /catch\s*(\([^)]*\))?\s*\{\s*cartes\s*=\s*\[\]\s*\}/.test(SOURCE)
  assert.equal(
    avale,
    false,
    'le catch de mesCartes vide la liste sans rien signaler : « pas pu lire » redevient « rien à lire »',
  )
  assert.match(SOURCE, /panne\s*=\s*true/, 'rien ne marque l’échec de lecture')
})

test('l’écran de panne existe, et il rassure avant d’expliquer', () => {
  // La règle de tout ce module : on répond d'abord à la peur (« j'ai perdu mon
  // travail »), ensuite on parle de la panne. Le titre porte donc ce qui EST,
  // pas ce qui a échoué.
  assert.match(SOURCE, /Tes cartes sont toujours là/, 'le titre rassurant a disparu')
  assert.match(SOURCE, /n’ont pas bougé|n'ont pas bougé/, 'la phrase qui dit ce qui n’est PAS perdu a disparu')
})

test('la panne offre un geste, pas seulement un constat', () => {
  // Sans ce bouton, l'écran est une impasse polie : on sait que ça a raté, on
  // ne peut rien y faire, et le seul recours est de recharger la page.
  assert.match(SOURCE, /button\('Réessayer'/, 'le bouton Réessayer a disparu')
})

test('le repli du panneau est retenu d’un chargement à l’autre', () => {
  // Au téléphone, ce panneau couvrait 30,8 % de l'écran à CHAQUE chargement,
  // planté au milieu de la carte, et le replier ne servait à rien : il
  // revenait. La préférence doit donc être écrite ET relue.
  assert.match(SOURCE, /localStorage\.setItem\(CLE_REPLI/, 'le repli n’est plus mémorisé')
  assert.match(SOURCE, /CLE_REPLI/, 'la clé de préférence a disparu')
})
