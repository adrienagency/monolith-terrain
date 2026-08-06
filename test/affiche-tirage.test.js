// RENDRE AVANT D'ENCAISSER — le branchement, verrouillé par relecture de source.
//
// ⚠️ POURQUOI PAR RELECTURE, ET NON PAR EXÉCUTION. `src/ui/affiche.js` importe
// une feuille de style et `src/main.js` importe three.js, WebGL et le DOM :
// aucun des deux ne se charge sous node. C'est LA faiblesse structurelle du
// projet, écrite en toutes lettres au ledger de la tâche 3 — aucun test ne
// charge main.js, et une erreur de syntaxe y est passée sous 2 552 tests verts.
// La relecture de source ne remplace pas une exécution ; elle attrape la seule
// classe de régression qui compte ici : quelqu'un qui, en réorganisant, remet le
// paiement AVANT le rendu, ou débranche l'annulation.
//
// Ce que ce fichier tient, dans l'ordre de ce que ça coûterait :
//   1. l'ORDRE — le fichier est produit avant que la caisse s'ouvre ;
//   2. l'ANNULATION — elle existe et elle est consultée ;
//   3. la MÉMOIRE — les bandes sont prises pour être lâchées ;
//   4. le GEL — posé après la mise au repos, jamais avant ;
//   5. le CONTOURNEMENT D'ATELIER — Alt + clic survit aux `await` ajoutés.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const lire = (p) => readFileSync(fileURLToPath(new URL(`../${p}`, import.meta.url)), 'utf8')
const AFFICHE = lire('src/ui/affiche.js')
const MAIN = lire('src/main.js')
const EXPORT = lire('src/export.js')
const CSS = lire('src/ui/affiche.css')

// ═══════════════════════════════════════════════════════════════════════════
// 1. L'ORDRE — LA CLASSE D'ÉCHEC QUI DISPARAÎT
// ═══════════════════════════════════════════════════════════════════════════

test('⚠️ LE FICHIER EST RENDU AVANT QUE LA CAISSE S’OUVRE', () => {
  // Payer puis rendre, c'est accepter qu'un pilote refuse une tuile APRÈS le
  // débit. L'ordre dans la source EST la garantie : les deux appels sont dans le
  // même bloc `try`, et il n'y a pas d'autre chemin vers `onCommander`.
  const iTirage = AFFICHE.indexOf('ctx.rendreTirage(')
  const iCaisse = AFFICHE.indexOf('ctx.onCommander?.(')
  assert.ok(iTirage > 0, 'rendreTirage n’est pas appelé')
  assert.ok(iCaisse > 0, 'onCommander n’est pas appelé')
  assert.ok(iTirage < iCaisse, 'le paiement s’ouvre avant que le fichier soit rendu')
  // et un seul appel à la caisse : deux chemins, c'est un chemin non couvert
  assert.equal(AFFICHE.split('ctx.onCommander?.(').length - 1, 1)
})

test('l’écran de validation est produit par le COMPOSITEUR, et avant le tirage', () => {
  // C'est la décision d'architecture du chantier : l'acheteur valide le fichier,
  // pas une maquette DOM. `rendreValidation` (main.js) passe par
  // `composerValidation`, réduit à VALIDATION_MAX_PX.
  const iValid = AFFICHE.indexOf('ctx.rendreValidation(')
  assert.ok(iValid > 0, 'rendreValidation n’est pas appelé')
  assert.ok(iValid < AFFICHE.indexOf('ctx.rendreTirage('))
  assert.match(MAIN, /rendreValidation: async \(/)
  assert.match(MAIN, /await composerValidation\(\{ image: bmp, toile, plan, logo: logoImg \}\)/)
  assert.match(MAIN, /tailleValidation\(finiPx\)/)
})

test('la progression est branchée sur onProgress, pas simulée', () => {
  assert.match(AFFICHE, /onProgress: \(f\) => \{/)
  assert.match(AFFICHE, /tirBarre\.style\.width = `\$\{pct\}%`/)
  // et l'orchestrateur l'appelle vraiment, tuile par tuile
  assert.match(EXPORT, /onProgress\?\.\(faites \/ plan\.tuiles\.length\)/)
})

// ═══════════════════════════════════════════════════════════════════════════
// 2. L'ANNULATION
// ═══════════════════════════════════════════════════════════════════════════

test('l’annulation existe, et l’orchestrateur la consulte', () => {
  assert.match(AFFICHE, /annule: \(\) => annulation/)
  assert.match(AFFICHE, /tirAnnuler\.addEventListener\('click'/)
  // export.js la lit entre deux tuiles — sinon le bouton ne serait qu'un décor
  assert.match(EXPORT, /if \(annule\?\.\(\)\) throw new Error\('Rendu annulé'\)/)
})

test('Échap pendant un tirage ANNULE le tirage, il ne ferme pas l’écran', () => {
  // Fermer laisserait l'orchestrateur peindre des tuiles dans une scène qu'on
  // est en train de rendre à la carte.
  assert.match(AFFICHE, /if \(enTirage\) \{ annulation = true;[\s\S]{0,120}return \}\s*\n\s*partir\(\)/)
  assert.match(AFFICHE, /fermer\.addEventListener\('click', \(\) => \{ if \(!enTirage\) partir\(\) \}\)/)
})

// ═══════════════════════════════════════════════════════════════════════════
// 3. LA MÉMOIRE — 21 À 89 MO PAR AFFICHE
// ═══════════════════════════════════════════════════════════════════════════

test('⚠️ LES BANDES SONT PRISES POUR ÊTRE LÂCHÉES', () => {
  // Fournir `surBande` dit à l'orchestrateur de ne PAS conserver les blobs. On
  // n'en garde que le poids — partir payer est une navigation, ces octets
  // meurent de toute façon, mais les tenir jusque-là peut faire manquer la place
  // au milieu du tirage.
  assert.match(AFFICHE, /surBande: \(b\) => \{ octets \+= b\?\.blob\?\.size \|\| 0 \}/)
  assert.ok(!/rendues\.push\(sortie\)[\s\S]{0,40}surBande/.test(EXPORT))
  assert.match(EXPORT, /rendues\.push\(\{ \.\.\.sortie, blob: null \}\)/)
  // et le poids est ANNONCÉ : quelqu'un qui reçoit 89 Mo par mail a le droit de
  // le savoir avant de payer
  assert.match(AFFICHE, /export function poidsLisible\(/)
  assert.match(AFFICHE, /const poids = poidsLisible\(octets\)/)
})

// ═══════════════════════════════════════════════════════════════════════════
// 4. LE GEL — LA MOITIÉ QUE LA TÂCHE 6 N'A PAS PU FERMER
// ═══════════════════════════════════════════════════════════════════════════

test('le gel est posé APRÈS la mise au repos, jamais avant', () => {
  // Posé avant, il refuserait la reconstruction qui EST la mise au repos : on
  // tirerait la carte telle qu'elle était au clic.
  const bloc = MAIN.slice(MAIN.indexOf('avantTirage: async ()'), MAIN.indexOf('avantTirage: async ()') + 220)
  assert.ok(bloc.indexOf('await rebuildMapLayers()') < bloc.indexOf('degeler = figerPourTirage()'), bloc)
  assert.match(MAIN, /degeler\?\.\(\)/)
})

test('le gel refuse les reconstructions NOUVELLES et la POSE de ce qui était en vol', () => {
  // ① les nouvelles
  assert.match(MAIN, /if \(carteGelee\(\)\) \{ _gelDemande = true; return Promise\.resolve\(\) \}/)
  // ② les atterrissages : les deux de la photo aérienne, nommément…
  assert.equal(MAIN.split('if (carteGelee()) { _gelDemande = true; return }').length - 1, 2)
  // …et les trois autres calques par leur garde commune
  assert.match(MAIN, /function couchePartieEnVol\(id, demAuDepart\) \{\s*\n\s*return carteGelee\(\) \|\|/)
  // ③ ce qui a été refusé est REDEMANDÉ au dégel
  assert.match(MAIN, /if \(_gelDemande\) \{ _gelDemande = false; rebuildMapLayers\(\) \}/)
})

test('⚠️ LA MISE AU REPOS ATTEND LES QUATRE CALQUES DE TEXTURE, PAS QUE LES ROUTES', () => {
  // C'est ce qui rendait l'attente d'avant incomplète : `rebuildMapLayers` ne
  // rendait que la promesse de `mapLayers.rebuild` pendant que la photo
  // aérienne, la nuit, l'occupation du sol et la canopée étaient encore en vol.
  assert.match(
    MAIN,
    /Promise\.all\(\[p, refreshAerial\(\), refreshNuit\(\), refreshSol\(\), refreshCanopee\(\)\]\.map\(calmement\)\)/
  )
  // et un calque qui échoue ne doit pas faire échouer l'attente des autres
  assert.match(MAIN, /const calmement = \(p\) => Promise\.resolve\(p\)\.catch\(/)
})

test('la boucle d’images s’arrête pendant le tirage', () => {
  // Sans ça, une image de rAF se glisse entre deux bandes, avance les nuages et
  // la mer, et rend la scène à la taille de la tuile précédente : le contenu
  // change d'une bande à l'autre sans qu'aucune donnée ne soit arrivée.
  const bloc = MAIN.slice(MAIN.indexOf('function figerPourTirage()'), MAIN.indexOf('function figerPourTirage()') + 900)
  assert.match(bloc, /loopPaused = true/)
  assert.match(bloc, /cancelAnimationFrame\(rafId\)/)
  assert.match(bloc, /loopPaused = false/)
})

test('les effets sont remis AVANT le dégel', () => {
  // Le dégel relance la boucle : si les effets n'étaient pas encore remis, la
  // première image d'après montrerait une carte sans vignettage ni grain.
  const fin = MAIN.slice(MAIN.indexOf('surBande, onProgress, annule,'))
  const i1 = fin.indexOf('restaurerEffets()')
  const i2 = fin.indexOf('degeler?.()')
  assert.ok(i1 > 0 && i2 > i1, 'restaurerEffets() doit précéder degeler?.()')
})

// ═══════════════════════════════════════════════════════════════════════════
// 5. LA SONDE, ET LE CONTOURNEMENT D'ATELIER
// ═══════════════════════════════════════════════════════════════════════════

test('la sonde est branchée sur le VRAI renderer et le VRAI document', () => {
  assert.match(MAIN, /sonder: \(\) => sonderMateriel\(\{/)
  assert.match(MAIN, /gl: renderer\.getContext\(\)/)
  assert.match(MAIN, /memoireGo: navigator\.deviceMemory/)
  // elle alloue, elle ne croit pas : une cible de tuile ET un canevas de bande,
  // et un pixel relu de chacun
  assert.match(MAIN, /new THREE\.WebGLRenderTarget\(cote, cote\)/)
  assert.match(MAIN, /renderer\.readRenderTargetPixels\(cible/)
  assert.match(MAIN, /g\.getImageData\(largeur - 1, hauteur - 1, 1, 1\)/)
  // et elle ne laisse rien derrière elle : la couleur d'effacement est un état
  // GLOBAL du renderer, le canevas de sonde pèse des dizaines de Mo
  assert.match(MAIN, /renderer\.setClearColor\(couleurAvant, alphaAvant\)/)
  assert.match(MAIN, /cible\.dispose\(\)/)
  assert.match(MAIN, /c\.width = 1\s*\n\s*c\.height = 1/)
})

test('la densité vendue vient de la sonde, pas de DPI_IMPRESSION en dur', () => {
  // Trois `geometriePage(... DPI_IMPRESSION)` cohabitaient dans cet écran. Avec
  // une densité qui peut être dégradée, trois sources auraient fini par annoncer
  // une densité et en rendre une autre.
  assert.match(AFFICHE, /const geoCourante = \(\) => geometriePage\(\{/)
  assert.match(AFFICHE, /dpi: dpiRetenu\(grilleFormats, etat\.format, etat\.orientation\) \?\? DPI_IMPRESSION/)
  assert.equal(AFFICHE.split('geometriePage({').length - 1, 1, 'une seule fabrique de géométrie')
})

test('⚠️ DÉGRADER D’ABORD, CACHER ENSUITE — et le cachage est le dernier recours', () => {
  // La densité a déjà été baissée par `degradePour` ; ici on ne retire QUE ce
  // qui ne passe même pas au plancher de 150 dpi.
  assert.match(AFFICHE, /b\.hidden = !ligneFormat\(grilleFormats, id\)\?\.dispo/)
  // et quand il ne reste rien, on le DIT plutôt que de laisser un bouton qui ne
  // peut rien produire
  assert.match(AFFICHE, /if \(!grilleFormats\.some\(\(g\) => g\.dispo\)\) \{\s*\n\s*cta\.disabled = true/)
})

test('⚠️ `display: grid` DE `.af-fmt` BAT L’ATTRIBUT `hidden` — il faut le rendre', () => {
  // Trouvé en lisant le style calculé sur la page réelle : un format retiré par
  // la sonde restait VISIBLE et CLIQUABLE, parce que toute règle d'auteur qui
  // redéclare `display` bat le `[hidden] { display: none }` du navigateur. Le
  // bouton aurait produit un fichier qu'on venait de juger impossible.
  assert.match(CSS, /\.af-fmt \{[^}]*display: grid/s, 'la prémisse a changé : revérifier la règle ci-dessous')
  assert.match(CSS, /\.af-fmt\[hidden\][^{]*\{[^}]*display: none/)
})

// ═══════════════════════════════════════════════════════════════════════════
// 6. LE FOND DE SCÈNE — LE DAMIER QU'AUCUN TEST N'AVAIT VU
// ═══════════════════════════════════════════════════════════════════════════

test('⚠️ LE FOND DE SCÈNE EST TRANCHÉ PAR TUILE, sinon l’affiche sort en damier', () => {
  // Vu sur le premier tirage réel : `scene.background` est une texture étirée
  // sur le VIEWPORT (background.js le dit en tête), et le viewport d'un pavage
  // c'est la tuile. Chaque tuile recevait le dégradé entier — 4 × 3 dégradés et
  // deux coutures en travers de la feuille. Le plan d'effets ne le range dans
  // aucune catégorie ; il n'y a donc que ce test pour le tenir.
  assert.match(MAIN, /function cadrerFondPourTuile\(fenetre\)/)
  assert.match(MAIN, /tex\.repeat\.set\(width \/ W, height \/ H\)/)
  // l'axe V est inversé entre une texture et un plan de tuiles
  assert.match(MAIN, /tex\.offset\.set\(offsetX \/ W, 1 - \(offsetY \+ height\) \/ H\)/)
  // appelé par tuile, restauré par tuile — le cycle de `preparerTuile`
  assert.match(MAIN, /const fond = cadrerFondPourTuile\(fenetre\)/)
  assert.match(MAIN, /restaurer\(\) \{ fond\?\.restaurer\(\); traits\.restaurer\(\); rendu\.restaurer\(\) \}/)
})

test('⚠️ LE PLAN D’EFFETS LIT L’ÉTAT VIVANT, PAS `params`', () => {
  // Observé sur un tirage réel : en lisant `params`, l'avertissement « l'affiche
  // sortira en damier » se déclenchait sur une affiche parfaitement recollée,
  // parce que les effets venaient d'être éteints deux lignes plus haut. Un
  // avertissement qui crie à tort est un avertissement perdu.
  const bloc = MAIN.slice(MAIN.indexOf('effets: {'), MAIN.indexOf('effets: {') + 1400)
  assert.match(bloc, /vignette: vignette\.darkness/)
  assert.match(bloc, /grain: grain\.blendMode\.opacity\.value/)
  // et il reste une vraie assertion : neutraliser AVANT de construire le plan
  const iNeutre = MAIN.indexOf('const restaurerEffets = neutraliserEffetsAffiche()', MAIN.indexOf('rendreTirage: async'))
  assert.ok(iNeutre > 0 && iNeutre < MAIN.indexOf('effets: {'))
})

test('le contournement d’atelier (Alt + clic) survit aux await ajoutés', () => {
  // ⚠️ `e.altKey` DOIT ÊTRE LU AVANT LE PREMIER `await`. L'événement ne survit
  // pas au tour de boucle : lu après, il serait toujours faux, et Adrien ne
  // pourrait plus éprouver la chaîne sans payer.
  const clic = AFFICHE.slice(AFFICHE.indexOf("cta.addEventListener('click'"))
  const iLu = clic.indexOf('const atelier = !!e.altKey')
  const iAwait = clic.indexOf('await ')
  assert.ok(iLu > 0, 'altKey n’est plus lu')
  assert.ok(iLu < iAwait, 'altKey est lu après un await : il sera toujours faux')
  assert.match(AFFICHE, /prix: PRIX_AFFICHE_EUR, atelier \}\)/)
  // et le code d'atelier reste demandé côté main.js, vérifié côté serveur
  assert.match(MAIN, /if \(commande\.atelier\) \{/)
})
