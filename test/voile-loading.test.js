// LA CARTE `#loading` — Tâche 2 du plan « globe continu »
// (`docs/superpowers/plans/2026-08-08-globe-continu.md`).
//
// ══════════ CE QUE CE FICHIER GARDE ═════════════════════════════════════════
//
// **C'est le pop-up qu'Adrien nomme** : la carte de marque centrée (nom,
// baseline, orbe qui tourne) que `showLoading()` relève à chaque cran de zoom,
// et qui **floute l'application entière à 16 px pendant qu'elle est là**.
//
// Deux assertions, et ce sont celles que la tâche demande :
//
//   ① **`showLoading` n'est plus appelé sur le chemin du zoom** — le chemin
//      `loadSurface → fetchAndBuildDem → regenerateTerrain`, là où l'attente a
//      disparu (Tâche 6 septies).
//   ② **`style.css` ne floute plus l'application à l'arrêt** — c'est le
//      contraire exact de la décision 13, qui n'accepte le flou que **pendant**
//      le mouvement.
//
// ══════════ LA FORME DU TEST, TRANCHÉE (Étape 1) ════════════════════════════
//
// **Assertion de texte source**, et il n'y a pas d'autre voie : `src/main.js`
// n'est chargé par AUCUN test de ce dépôt (`grep -c "src/main.js" test/*.js`
// ne rend que des lectures de fichier, jamais un `import`). C'est la convention
// que onze fichiers de test emploient déjà — `fenetre-branchee.test.js`,
// `escalier-surface.test.js`, `camera-continue.test.js` en tête.
//
// ⚠️ **CE QUI EST MESURÉ, ET CE QUI NE L'EST PAS.** Les deux défauts ci-dessous
// ont été relevés le 2026-08-21 sur l'application vivante (port 5503), pas
// déduits de la lecture :
//
//   · `?globe=crans` (le régime de PRODUCTION), La Réunion z12, un rechargement
//     de terrain : `#loading` est relevée **deux fois** (`fetchAndBuildDem`
//     puis `regenerateTerrain`) et reste à l'écran **1 177 ms**, pendant
//     lesquelles `getComputedStyle(#app).filter` vaut **`blur(16px)`** et son
//     `transform` **`matrix(1.04, …)`**.
//   · `?globe=continu&socle=quadtree&f3=0`, même lieu, cran z12 → z13 :
//     `loadSurface` rend la main en **468 ms**, et la carte remonte
//     **326 ms PLUS TARD**, par-dessus une application déjà libre — encore
//     visible **9,7 s** après. C'est le pop-up posé sur le trou qu'il ne cache
//     plus.
//
// ══════════ ET LES QUATRE EFFETS DE BORD DE `hideLoading` ═══════════════════
//
// Aucun n'est protégé par un test ailleurs. Ce fichier les épingle, non pour
// les figer, mais pour qu'on ne les emporte pas SANS LE SAVOIR : ③ à ⑥.

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
// ⚠️ FINS DE LIGNE NORMALISÉES — même raison qu'à `escalier-surface.test.js` :
// ce dépôt vit sous Windows avec `autocrlf`, et le découpage de fonction
// ci-dessous échouerait selon qui a touché le fichier en dernier.
const lis = (f) => fs.readFileSync(path.join(RACINE, f), 'utf8').replace(/\r\n/g, '\n')
const SRC_MAIN = lis('src/main.js')
const SRC_CSS = lis('src/style.css')
const HTML = lis('index.html')

// ⚠️ **LES COMMENTAIRES SONT RETIRÉS AVANT TOUTE ASSERTION D'ABSENCE, ET CE
// N'EST PAS UNE COMMODITÉ.** Ce dépôt commente abondamment ce qu'il RETIRE — les
// deux corrections de cette tâche citent, en toutes lettres et à l'endroit
// exact, le sélecteur et le `setTimeout` qu'elles suppriment, pour qu'on ne les
// remette pas par distraction. Une assertion qui lit le fichier brut serait
// donc satisfaite (ou trahie) par de la PROSE : c'est arrivé aux six assertions
// de ce fichier au premier essai, toutes les six d'un coup.
// La règle : **une absence se prouve sur le CODE, jamais sur le fichier.**
const sansCommentaires = (src) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, '') // blocs — la seule forme qui existe en CSS
    .split('\n')
    .filter((l) => !/^\s*\/\//.test(l)) // lignes de commentaire entières
    .join('\n')

// Le corps d'une fonction de PREMIER NIVEAU : de son en-tête jusqu'à
// l'accolade fermante en colonne zéro. `corpsDe` de `escalier-surface.test.js`
// coupe à deux espaces d'indentation (méthodes de classe) — ici les fonctions
// sont au premier niveau, d'où la variante. Le découpage se fait sur le fichier
// BRUT (l'en-tête doit être trouvable tel qu'il est écrit), le nettoyage après.
function corpsDe(src, entete) {
  const i = src.indexOf(entete)
  assert.ok(i > 0, `fonction introuvable : ${entete}`)
  const j = src.indexOf('\n}\n', i)
  assert.ok(j > i, `fin de fonction introuvable : ${entete}`)
  return sansCommentaires(src.slice(i, j))
}

const CODE_MAIN = sansCommentaires(SRC_MAIN)
const CODE_CSS = sansCommentaires(SRC_CSS)
const CORPS_FETCH = corpsDe(SRC_MAIN, 'async function fetchAndBuildDem({ centreSur = null, enVol = false } = {}) {')
const CORPS_LOAD_REAL = corpsDe(SRC_MAIN, 'async function loadRealTerrain(opts = {}) {')
const CORPS_HIDE = corpsDe(SRC_MAIN, 'function hideLoading() {')

// ══════════ ① LE CHEMIN DU ZOOM NE LÈVE PLUS LE VOILE ═══════════════════════

test('showLoading n’est plus appelé sur le chemin du zoom', () => {
  // ⚠️ **IL Y A DEUX LEVÉES SUR CE CHEMIN, PAS UNE**, et le plan n'en nommait
  // qu'une. `fetchAndBuildDem` lève la carte lui-même (`if (!enVol)`), PUIS
  // `regenerateTerrain` la relève une seconde fois — mesuré à l'écran : deux
  // mutations de classe à 21 ms d'intervalle. Retirer la première sans la
  // seconde n'aurait rien retiré du tout.
  assert.match(
    CORPS_FETCH,
    /regenerateTerrain\(\{ sansRideau: enVol \}\)/,
    'la reconstruction du chemin de vol relève encore la carte #loading'
  )
  assert.equal(
    /await regenerateTerrain\(\)/.test(CORPS_FETCH),
    false,
    '`regenerateTerrain()` nu : le rideau revient par la seconde porte'
  )
  // la première porte : elle ne s'ouvre QUE hors vol, et c'est déjà le cas
  // depuis la Tâche 6 septies — on l'épingle pour qu'elle ne se rouvre pas
  assert.match(CORPS_FETCH, /if \(!enVol\) showLoading\(\)/)
  assert.equal((CORPS_FETCH.match(/showLoading\(\)/g) ?? []).length, 1, 'une seule levée dans fetchAndBuildDem')
})

test('le PREMIER affichage au démarrage survit — c’est le seul légitime', () => {
  // ⚠️ ON NE SUPPRIME PAS LA CARTE, ON SUPPRIME SA RÉAPPARITION. Le balisage
  // est peint EN LIGNE par index.html au premier octet, sans classe `hidden` :
  // c'est lui, le premier affichage, et il ne passe par aucun appel JS.
  assert.match(HTML, /<div id="loading">/)
  assert.equal(/<div id="loading" class="hidden">/.test(HTML), false)
  assert.match(HTML, /window\.__ldStart = performance\.now\(\)/)
})

// ══════════ ② LE FLOU À L'ARRÊT ═════════════════════════════════════════════

test('style.css ne floute plus l’application à l’arrêt', () => {
  // ⚠️ **DÉCISION 13 : le flou est accepté PENDANT le mouvement, et net dès
  // l'arrêt.** Ici l'application ne bouge pas — elle attend — et elle était
  // floutée à 16 px. Mesuré, pas déduit : `getComputedStyle(#app).filter`
  // valait `blur(16px)` avec `body.ld-warm` posée et `#loading` visible.
  assert.equal(
    /#app[^{}]*\{[^}]*filter:\s*blur/.test(CODE_CSS),
    false,
    'une règle floute encore #app : le flou à l’arrêt est revenu'
  )
  assert.equal(
    CODE_CSS.includes('body.ld-warm:has(#loading:not(.hidden)) #app'),
    false,
    'le sélecteur du flou à l’arrêt est revenu'
  )
  // et le `scale` qui l'accompagnait part avec lui : il n'existait que pour
  // pousser dehors la frange grise que `blur()` échantillonnait aux bords
  assert.equal(
    /#app[^{}]*\{[^}]*transform:\s*scale\(1\.04\)/.test(CODE_CSS),
    false,
    'le zoom de 4 % qui accompagnait le flou est revenu'
  )
})

// ══════════ ③ à ⑥ — LES QUATRE EFFETS DE BORD DE `hideLoading` ══════════════

test('③ `ld-warm` est toujours posée, et elle garde son dernier emploi', () => {
  // Elle n'est POSÉE qu'ici, et elle ne disparaît pas avec cette tâche : le
  // flou parti, il lui reste `body.ld-warm #loading-bg { opacity: 0 }` —
  // éteindre le relief de fond aux chargements suivants, qui était sa raison
  // d'être d'origine.
  assert.match(CORPS_HIDE, /document\.body\.classList\.add\('ld-warm'\)/)
  assert.match(CODE_CSS, /body\.ld-warm #loading-bg \{\s*opacity: 0;/)
})

test('④ les seize tuiles racines gardent leurs DEUX demandeurs', () => {
  // `globe.chargeRacines()` ne s'appelle plus depuis `hideLoading` en direct :
  // la Tâche 1b a posé `assureRacinesGlobe`, idempotent, avec un filet à 20 s.
  // Les deux doivent rester — sans eux le globe ne se peuple jamais, sans
  // erreur et sans test rouge.
  assert.match(CORPS_HIDE, /assureRacinesGlobe\(\)/)
  assert.match(CODE_MAIN, /setTimeout\(assureRacinesGlobe, DELAI_FILET_RACINES_MS\)/)
  assert.match(CODE_MAIN, /const DELAI_FILET_RACINES_MS = 20000/)
})

test('⑤ le plancher de 2 000 ms ne s’applique QU’AU PREMIER congé', () => {
  // Il protège d'un éclair au démarrage, et il ne coûte rien ailleurs :
  // `loadingDismissedOnce` court-circuite tous les congés suivants.
  assert.match(CODE_MAIN, /const LOADING_MIN_MS = 2000/)
  assert.match(CORPS_HIDE, /if \(loadingDismissedOnce\) \{/)
  assert.match(CORPS_HIDE, /LOADING_MIN_MS - \(performance\.now\(\) - loadingStart\)/)
})

test('⑥ le voile de 2,6 s du `catch` a disparu — l’indicateur discret le remplace', () => {
  // ⚠️ **C'EST LA PLACE QUE LE §9 DÉSIGNE**, et la mesure du plan tient : le
  // `finally` relâche `demBusy` tout de suite, donc l'application est libre
  // pendant que la carte reste 2,6 s de plus. Adrien a tranché le 2026-08-20 :
  // un indicateur discret, jamais un voile.
  assert.equal(
    /setTimeout\(\(\) => \{\s*hideLoading\(\)/.test(CORPS_LOAD_REAL),
    false,
    'le voile réarmé 2,6 s après la panne réseau est revenu'
  )
  assert.equal(CORPS_LOAD_REAL.includes('2600'), false, 'le délai de 2 600 ms est revenu')
  assert.match(CORPS_LOAD_REAL, /indicateurRetard\.maj\(/, 'la panne réseau ne dit plus rien à l’écran')
})

// ══════════ ⑦ L'INDICATEUR DISCRET — LE DESSIN QUI MANQUAIT ═════════════════
//
// ⚠️ **CELUI-CI N'EST PAS UNE ASSERTION DE TEXTE SOURCE : IL S'EXÉCUTE.**
// `texteRetard` est la moitié PURE de `src/ui/indicateur-retard.js` — le module
// ne touche `document` que dans `initIndicateurRetard`, ce qui le rend
// importable en node sans jsdom. C'est la même séparation que
// `descente-bornee.js` fait entre l'état et le dessin, poussée d'un cran.

const { texteRetard, initIndicateurRetard } = await import('../src/ui/indicateur-retard.js')

test('⑦ l’indicateur est ÉTEINT quand la mesure manque', () => {
  // Même règle que `etatIndicateur` : « le manque de mesure et la mesure d'un
  // manque sont deux choses ». Un flux neuf n'a rien mesuré.
  assert.equal(texteRetard(), '')
  assert.equal(texteRetard({}), '')
  assert.equal(texteRetard({ enRetard: false, niveaux: 3 }), '')
})

test('⑦ il parle en NIVEAUX, jamais en pourcentage', () => {
  // ⚠️ « un niveau vaut un facteur deux de résolution, pas un pour cent »
  // (`descente-bornee.js`, §5). Un pourcentage inventerait une progression
  // continue là où il n'y a que des doublements.
  const un = texteRetard({ enRetard: true, niveaux: 1 })
  const trois = texteRetard({ enRetard: true, niveaux: 3 })
  assert.match(un, /1 niveau\b/)
  assert.match(trois, /3 niveaux\b/)
  for (const t of [un, trois, texteRetard({ enRetard: true })]) {
    assert.equal(t.includes('%'), false, `l’indicateur a affiché un pourcentage : ${t}`)
  }
})

test('⑦ allumé sans profondeur connue, il le dit sans inventer de chiffre', () => {
  // C'est le cas de la panne réseau : on sait que le détail n'est pas arrivé,
  // on ne sait pas de combien de niveaux on est en retard.
  assert.equal(texteRetard({ enRetard: true }), 'détail en cours…')
  assert.equal(texteRetard({ enRetard: true, niveaux: 0 }), 'détail en cours…')
  assert.equal(texteRetard({ enRetard: true, niveaux: null }), 'détail en cours…')
  assert.equal(texteRetard({ enRetard: true, texte: 'réseau' }), 'réseau')
})

test('⑦ sans DOM, le module s’importe et ne casse rien', () => {
  // Aucun test de ce dépôt n'a de `document` : `initIndicateurRetard` doit
  // rendre une commande inerte plutôt que de lever. Sans ça, ce fichier même
  // ne pourrait pas l'importer.
  const i = initIndicateurRetard(null)
  assert.equal(typeof i.maj, 'function')
  assert.equal(typeof i.eteint, 'function')
  i.maj({ enRetard: true, niveaux: 2 })
  i.eteint()
})

test('⑦ il est branché aux DEUX endroits où un retard est un FAIT', () => {
  // (a) la panne réseau — testée en ⑥ ci-dessus ;
  // (b) la couverture du socle sous `?socle=quadtree`, qui est une couverture
  //     OBSERVÉE (`zoomEffectif`) et non une prédiction de débit.
  // ⚠️ ON N'Y PASSE PAS `etatIndicateur`, ET C'EST UNE MESURE QUI L'INTERDIT :
  // sur un lien OISIF, `debitObserve` rendait 0,787 Mb/s et `zoomSoutenable`
  // en tirait z5 pour une demande de z12 — l'indicateur serait resté allumé en
  // permanence sur une connexion parfaite.
  assert.match(CODE_MAIN, /const zoomCouvert = zoomEffectif\(flux, emprise\)/)
  assert.match(CODE_MAIN, /enRetard: zoomCouvert < borne\.zoomDemande/)
  assert.equal(
    /etatIndicateur\(/.test(CODE_MAIN),
    false,
    '`etatIndicateur` est branché sur le chemin du socle : relire la mesure des 0,787 Mb/s avant de le remettre'
  )
  // et il s'éteint dès que le MNT arrive : un indicateur qui ne s'éteint pas
  // est un bandeau permanent, c'est-à-dire le pop-up sous un autre nom
  assert.match(CORPS_FETCH, /indicateurRetard\.eteint\(\)/)
})
