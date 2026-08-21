// LE GARDIEN — l'identité unique de tout ce qui empêche ShibuMap de planter.
//
// « On va appeler ce système "le gardien" dont le rôle est de faire en sorte
//   que shibumap ne plante jamais. Il y a déjà pas mal de choses que le gardien
//   contrôle, il faudrait les regrouper sous une identité unique. »   — Adrien
//
// Module PUR : ni three.js, ni DOM, ni `location`, ni `localStorage`. Il reçoit
// ses entrées, il rend un verdict. C'est la convention de `fenetre-reglage.js`,
// dont ce fichier reprend la forme jusque dans le détail (une raison rendue
// même quand c'est oui, une absence d'information qui ne refuse jamais).
//
// ═══════════ CE QUE LE GARDIEN FAIT, ET CE QU'IL NE FAIT PAS ════════════════
//
// IL FAIT : décider si une COUCHE cartographique optionnelle (lumières
// nocturnes, occupation du sol, hauteur de canopée…) peut s'allumer sans
// emmener la machine par le fond, tenir la comptabilité de ce qui est déjà
// allumé, et dire quoi éteindre pour échanger.
//
// IL NE FAIT PAS : mesurer. Le gardien ne chronomètre aucune image, ne lit
// aucune mémoire, n'installe aucun capteur. Tout ce qu'il sait de l'état de la
// machine, il le LIT chez ceux qui le savent déjà — la table de
// `palier-machine.js` et le palier courant du gouverneur de `perf.js`. C'est le
// raisonnement exact de `fenetre-reglage.js` : lire la table existante plutôt
// qu'écrire un seuil concurrent à côté d'elle.
//
// IL N'ÉTEINT RIEN NON PLUS. Il refuse d'ALLUMER ; il ne retire jamais une
// couche que le visiteur a choisie, même quand le budget s'effondre sous ses
// pieds. Même règle que les drapeaux `dirty` de perf.js : une fois que l'humain
// a la main sur un levier, l'automate ne la reprend pas.
//
// ═══════════ DÉCISION 1 — SUR QUOI PORTE LE BUDGET ? ════════════════════════
//
// Trois candidats étaient sur la table.
//
//   • LA MÉMOIRE VIDÉO ESTIMÉE. Écartée. On ne sait pas la mesurer dans un
//     navigateur, et ce qu'on croit mesurer ment : `usedJSHeapSize` ne voit que
//     les tableaux typés — un masque côtier en CanvasTexture pèse 16 Mo HORS
//     tas (le canevas) et 16 Mo DEDANS (l'ImageData). Il compte en plus tout ce
//     qui est mort mais pas encore ramassé. Le dépôt porte déjà la cicatrice :
//     un banc lancé sans `--expose-gc` a rendu 205, 215, puis 306 et 453 Mo pour
//     le MÊME code, et ces chiffres ont ouvert une chasse à une fuite qui
//     n'existait pas (voir l'en-tête de test/damier-memoire.test.js). Fonder un
//     garde-fou sur une grandeur qui a déjà menti, c'est fabriquer la panne.
//
//   • UN COÛT MESURÉ À CHAUD (on allume, on regarde, on décide). Écarté, et
//     c'est le refus le plus important du fichier : une mesure ne peut arriver
//     qu'APRÈS l'allumage. Or tout l'objet du gardien est de refuser AVANT que
//     la machine ne souffre. Un coût mesuré transforme chaque essai en pari, et
//     rend le même clic tantôt accepté tantôt refusé selon la zone, le zoom,
//     l'heure — c'est-à-dire un système que personne ne peut ni tester ni
//     comprendre.
//
//   • → RETENU : UN SCORE COMPOSITE, EN « PARTS », DÉCLARÉ AU CATALOGUE.
//     Chaque couche annonce un coût entier, fixe, connu avant le premier clic.
//     Composite parce qu'une couche coûte sur PLUSIEURS axes à la fois : la
//     couche « étoiles » ne pèse presque rien en mémoire mais consomme du
//     remplissage ; la couche « sentiers » pèse peu à l'écran mais ouvre un
//     circuit réseau Overpass et fabrique de la géométrie drapée sur le fil
//     principal. Un budget en mégaoctets déclarerait les étoiles gratuites.
//
// L'UNITÉ. Une « part » vaut UNE DALLE VOISINE DE DAMIER — la charge que
// block-grid.js ajoute autour du bloc central pour le contexte. C'est la seule
// unité du dépôt qui soit à la fois mesurée (79 Mo par dalle, relevé du
// 2026-07-27) et déjà dosée par machine (`damierMax` dans la table des
// paliers). Les couches sont exactement de même nature que ces dalles : du
// contexte optionnel posé sur la carte essentielle.
//
// ⚠️ ET C'EST UNE CALIBRATION, PAS UNE MESURE. Les coûts du catalogue ont été
// posés à la main, par famille (une texture drapée, un réseau vectoriel, un
// champ d'étoiles). Le jour où une couche s'avère plus lourde que déclarée, LE
// CHIFFRE DU CATALOGUE EST LE BOUTON À TOURNER — pas la formule, pas la
// capacité. C'est pour ça que chaque entrée porte une `note` qui dit d'où sort
// son chiffre : sans elle, personne ne saura sur quoi le recalibrer.
//
// ═══════════ DÉCISION 2 — COMMENT SAIT-ON QUE LE PC SOUFFRE ? ═══════════════
//
// On ne le mesure pas : ON LE DEMANDE AU GOUVERNEUR. `perf.js` expose `tier`
// (le palier courant) et `startTier` (celui où la session a démarré). L'écart
// entre les deux EST la définition de la souffrance, et elle a été écrite par
// le code qui mesure, pas par celui-ci.
//
// ⚠️ POURQUOI ON NE REGARDE PAS LES IMAGES SOI-MÊME — LE PIÈGE DU dt.
// Pendant la construction du MNT, les images durent des centaines de
// millisecondes sans que la machine soit en difficulté : c'est un FIGEMENT du
// fil principal, pas une lenteur. Une mesure naïve accuserait une machine
// saine. Le dépôt a payé ce piège comptant : le gouverneur, nourri de vrais dt
// pendant `fetchAndBuildDem`, lisait « 6,7 img/s », plongeait de T0 à T3 d'un
// bond, coupait les ombres — et three recompilait TOUS ses programmes, 1 936 ms
// chronométrées, avant de tout remonter. Quatre changements de palier et deux
// recompilations sur une machine qui n'avait jamais ramé.
//
// Le correctif vit dans main.js, au guichet du gouverneur :
//     canStep: () => mode === 'surface' && !busy && !recording && !demBusy
// En lisant `tier` plutôt que des images, le gardien HÉRITE gratuitement de ce
// guichet, de la fenêtre en durée (FENETRE_S), de l'écart d'à-coup (ACOUP_S) et
// des 20 s entre deux changements. Écrire un second capteur ici, c'était
// s'engager à réapprendre les quatre pièges un par un.
//
// ═══════════ DÉCISION 3 — L'HYSTÉRÉSIS ═════════════════════════════════════
//
// Deux sources de clignotement, deux réponses.
//
//   • CÔTÉ SOUFFRANCE : aucune à écrire. `tier` ne bouge qu'après 2,5 s sous le
//     seuil, 12 s au-dessus, et jamais moins de 20 s après le changement
//     précédent. C'est déjà l'hystérésis la plus lente du dépôt.
//
//   • CÔTÉ BUDGET : celle-là est à nous. Le cas réel n'est pas l'oscillation de
//     l'occupation (elle ne change que sur un clic), c'est la CAPACITÉ qui fond
//     et revient quand le gouverneur descend puis remonte d'un cran. Sans
//     marge, tous les interrupteurs du panneau s'éteignent et se rallument
//     ensemble. D'où `MARGE_DEBLOCAGE` : une couche déjà refusée exige UNE PART
//     DE PLUS que le strict nécessaire pour redevenir allumable.
//
//     La mémoire d'un seul état (`bloqueePrecedemment`) suffit, et le module
//     reste pur : c'est exactement l'idiome de `echantillonRetenu(dt,
//     precedentLong)` dans perf.js — l'appelant porte le passé, la fonction
//     porte la règle.
//
// ═══════════ DÉCISION 4 — L'ÉCHAPPATOIRE, ET POURQUOI ELLE EXISTE ═══════════
//
// `?gardien=0` désarme les refus. Non par indulgence : parce qu'un garde-fou
// qu'on ne peut pas désarmer empêche de mesurer sa propre nécessité. Pour
// savoir si la couche « sentiers » fait vraiment tomber un iMac 2015, il faut
// pouvoir l'y allumer.
//
// ⚠️ ET IL NE VERROUILLE PAS — C'EST LA LEÇON DU `?f3=1`. La première version
// de ce paramètre-là bloquait l'interrupteur tant qu'il était présent : Adrien,
// qui ouvre son serveur par une adresse qui le porte, s'est retrouvé ENFERMÉ
// dans le mode, sans porte de sortie dans l'interface. Ici, `desarme` est un
// ÉTAT DE DÉPART passé à chaque appel, que l'interface peut rebasculer quand
// elle veut ; le gardien n'en garde aucune trace.
//
// Deux garanties tiennent avec le désarmement :
//   1. LE SILENCE N'EST JAMAIS AUTORISÉ. Désarmé, le gardien ne dit pas « oui »
//      tout court : il dit « oui, MAIS voici ce que j'aurais refusé et
//      pourquoi ». Un système qui dégrade en silence est indébogable à
//      distance — c'est déjà la règle du diagnostic de palier dans main.js.
//   2. LA COMPTABILITÉ CONTINUE. Le budget, le dépassement et les propositions
//      d'échange restent calculés et affichables. Désarmer coupe le refus, pas
//      la mesure.

import { PALIERS } from './palier-machine.js'

// Les protections déjà écrites reçoivent ici leur adresse unique. On RÉEXPORTE,
// on ne réimplémente pas : si l'une de ces fonctions se met à répondre autre
// chose parce qu'elle est passée par ce fichier, ce n'est pas un regroupement,
// c'est un bug — et test/gardien.test.js le dit.
export { PALIERS, PLANCHER_DENSITE, SEUILS_CHARGE, TABLEAU, CLASSES_CARTE, estimerPalier, reglagesServis, classerCarte, classerCharge, classerReseau, sonderMachine, palierMemorise, palierDeDepart, plafondDeRemontee } from './palier-machine.js'
export { VOISINES_3X3, machinePorteContinu, forceUrl, continuActif, etatInterrupteur } from './fenetre-reglage.js'
export { echantillonRetenu, fenetreMure, palierVise, FENETRE_S, FENETRE_FRAMES, DOWN_FPS } from './perf.js'
export { PLAFOND_MPX, MAX_PIXEL_RATIO, screenPixelRatio, densiteSousPlafond } from './viewport.js'
export { DEM_MEMO_MAX, LACS_MEMO_MAX_OCTETS, demMemoOctets } from './dem-memo.js'
export { gateFor, GATE_PHONE, GATE_WEBGL } from './boot-gate.js'

// ---------------------------------------------------------------------------
// L'UNITÉ DE COMPTE
// ---------------------------------------------------------------------------
// Une part = une dalle voisine de damier. 79 Mo relevés le 2026-07-27 sur Le Var
// isolé en z12 (masque côtier 2048² en texture ET en ImageData, analyse 1536²,
// géométrie 385², MNT Float32 1536², masques de découpe et de mer). Ce chiffre
// ne sert à AUCUN calcul ici : il est là pour que « 4 parts » veuille dire
// quelque chose à celui qui lit, et pour que l'interface puisse l'écrire.
export const PART_MO = 79

// ---------------------------------------------------------------------------
// LE CATALOGUE — chaque couche annonce son coût AVANT le premier clic
// ---------------------------------------------------------------------------
// Trois familles, trois ordres de grandeur. La `note` n'est pas de la
// décoration : c'est ce qui permettra de recalibrer un chiffre sans avoir à
// redécouvrir pourquoi il valait ça.
//
//   1 part  — rien à draper, rien à télécharger par tuile. Le coût est du
//             remplissage ou de la mise en page d'étiquettes sur le fil
//             principal, pas de la mémoire.
//   2 parts — une texture drapée sur le relief. Elle se paie PAR DALLE du
//             damier : c'est ce qui la rend deux fois plus chère qu'un ciel.
//   3 parts — une texture drapée qui, en plus, est lue par le processeur (elle
//             nourrit l'analyse de relief) ou porte ses mips.
//   4 parts — un réseau vectoriel Overpass : circuit réseau (avec son
//             disjoncteur, son plafond de 48 Mo et ses 6 s d'attente), décodage,
//             puis géométrie drapée fabriquée sur le fil principal.
//
// Les familles à 1, à 3 et à 4 parts n'ont plus de membre aujourd'hui (voir juste
// en dessous) : depuis que l'occupation du sol est retombée de 3 à 2, les TROIS
// couches du catalogue coûtent 2. Elles restent décrites parce que ce sont les
// REPÈRES DE L'ÉCHELLE des coûts : sans elles, « 2 parts » ne se comparerait plus
// à rien, et la prochaine couche serait chiffrée à l'estime.
//
// ═══════════ LE MÉNAGE DU 2026-08-02 — QUATRE ENTRÉES RETIRÉES ══════════════
//
// Adrien : « retire les cases étoiles, volcans, pistes de ski, et sentiers ».
// Ces quatre entrées portaient `aProduire: true` : elles ANNONÇAIENT ce qui
// vient sans rien peindre. Un catalogue n'est pas une feuille de route ; quatre
// lignes grisées en permanence dans un panneau de six, c'est un panneau qu'on
// cesse de lire.
//
// ⚠️ LEURS CHIFFRES MESURÉS NE SONT PAS PERDUS, ET ILS NE SONT PAS DANS CE
// DÉPÔT. Le jour où l'une de ces couches revient, son coût se relit dans les
// maquettes : G:\My Drive\_GITHUB\shibumap-maquettes-couches\
//   · pistes de ski — 3,1 Mo, 1 681 objets, 1,3 s ;
//   · sentiers      — 7,3 Mo, 136 503 points, 5,8 s.
// Ces relevés portent sur UN SEUL BLOC. En mode continu 3×3, il faut les
// multiplier par ~9 : c'est ce facteur, et pas le poids brut, qui justifiait les
// 4 parts de la famille Overpass.
//
// ═══════════ POURQUOI `aProduire` RESTE, ALORS QU'AUCUNE COUCHE NE LE PORTE ══
//
// ⚠️ NE SUPPRIMEZ PAS `aProduire` PARCE QU'IL N'A PLUS D'UTILISATEUR. Ce n'est
// pas du code mort : c'est le garde-fou qui a empêché CINQ INTERRUPTEURS DE
// MENTIR le 2026-08-01. `setCouche` dans main.js ne connaissait que les lumières
// nocturnes et l'occupation du sol ; les cinq autres interrupteurs s'allumaient,
// consommaient leur budget, et ne peignaient rien.
//
// Un interrupteur qui ment est précisément ce que ce fichier existe pour
// interdire (« un interrupteur qui s'allume sur une machine qui ne suit pas est
// pire qu'un interrupteur absent »).
//
// Et surtout : LA PROCHAINE COUCHE NAÎTRA AVEC. On écrit toujours l'entrée du
// catalogue avant d'écrire le rendu — c'est l'ordre naturel, puisque le coût se
// discute avant de coder. `aProduire: true` est ce qui rend cet intervalle
// honnête. Son test (`test/gardien.test.js`) l'éprouve donc sur un catalogue
// FICTIF, pour qu'il tienne debout sans dépendre de l'inventaire du jour.
//
// ⚠️ CE DRAPEAU SE RETIRE EN MÊME TEMPS QUE LE RENDU ARRIVE, pas avant, pas
// après. Le laisser sur une couche qui peint la rendrait inaccessible ; l'ôter
// d'une couche qui ne peint pas remettrait le mensonge en place.
export const COUCHES = [
  {
    id: 'lumieres-nocturnes',
    nom: 'Lumières nocturnes',
    cout: 2,
    note: 'une texture drapée par dalle, plus une passe de mélange additive. Une texture drapée se paie autant de fois qu’il y a de dalles au damier — c’est ce qui la sépare d’un effet de ciel.',
  },
  {
    id: 'occupation-sol',
    nom: 'Occupation du sol',
    // ⚠️ 3 → 2, LE 2026-08-02, POUR LA MÊME RAISON QUE LA CANOPÉE JUSTE EN
    // DESSOUS — et cette entrée-ci avait été oubliée au passage.
    //
    // Sa note justifiait le 3 par « la pyramide de mips ». Or
    // `occupation-sol-layer.js` fait `generateMipmaps = false` DEUX FOIS, et
    // l'en-tête du même fichier déclare les mips INTERDITS : un mip est une
    // moyenne, et moyenner deux codes de classe en fabrique un troisième qui
    // n'existe pas. La note affirmait donc exactement ce que le code interdit.
    //
    // Et le second motif du 3 ne tient pas davantage : la famille à 3 parts est
    // définie plus haut comme « une texture drapée qui, EN PLUS, est lue par le
    // processeur ». Vérifié : aucun `getImageData` ni `readPixels` dans
    // `occupation-sol.js` ni dans son calque — la donnée ne remonte jamais côté
    // processeur. Cette couche est structurellement IDENTIQUE à la canopée :
    // même table de 256 entrées, même `drawImage`, mêmes mips coupés.
    //
    // Le dégât était réel, et ce fichier l'écrit lui-même : une couche qui
    // réclame plus qu'elle ne consomme fait refuser une VRAIE couche derrière
    // elle sur les petites machines.
    cout: 2,
    note: 'texture drapée par dalle avec table de correspondance : la même charge que les lumières nocturnes, plus une recoloration par classe. Pas de mips — un mip est une moyenne, et moyenner deux codes de classe en invente un troisième.',
  },
  {
    id: 'canopee',
    nom: 'Hauteur de canopée',
    // ⚠️ 3 → 2, LE 2026-08-02, PARCE QUE LA COUCHE A CHANGÉ DE NATURE — et la
    // note d'avant décrivait une couche qui n'a jamais existé.
    //
    // Elle annonçait « LUE PAR LE PROCESSEUR : elle nourrit l'analyse de
    // relief ». C'était l'hypothèse d'une canopée qui aurait été du VOLUME :
    // pour déformer la géométrie il aurait fallu ramener les hauteurs sur le fil
    // principal et les mêler au MNT, d'où les 390 ms d'analyse invoqués.
    //
    // Cette hypothèse est morte, et elle est morte MESURÉE : 40 m de houppier
    // valent 0,19 % de la largeur d'un bloc, et le maillage à z12 a un pas de
    // 54 m au sol — une lisière tient sur UN sommet (le dossier complet est en
    // tête de src/canopee.js). La couche est donc une COULEUR DRAPÉE, et une
    // couleur drapée ne remonte jamais côté processeur : les octets vont du
    // réseau au canevas au GPU sans qu'une seule hauteur soit lue en JavaScript.
    //
    // Son coût réel est donc EXACTEMENT celui des lumières nocturnes : une
    // texture drapée par dalle du damier, plus une passe de mélange. La table de
    // correspondance est une texture de 1 Ko partagée par toutes les dalles, et
    // il n'y a PAS de pyramide de mips (coupée exprès, voir
    // src/map/canopee-layer.js). C'est 2 parts.
    //
    // ⚠️ Laisser 3 n'aurait pas été « prudent » : une couche qui réclame plus
    // qu'elle ne consomme fait refuser une VRAIE couche derrière elle sur les
    // petites machines. Le Gardien existe pour dire juste, pas pour dire haut.
    cout: 2,
    note: 'une texture drapée par dalle, plus une passe de mélange par rampe de hauteur. Même charge que les lumières nocturnes : la donnée ne remonte jamais côté processeur (c’est une couleur, pas du relief — voir l’en-tête de src/canopee.js), la table de correspondance pèse 1 Ko, et il n’y a pas de pyramide de mips.',
  },
]

// ---------------------------------------------------------------------------
// LE CATALOGUE EST UN ARGUMENT, PAS UNE CONSTANTE — et voici pourquoi
// ---------------------------------------------------------------------------
//
// Toutes les fonctions de budget ci-dessous acceptent un `catalogue`, et se
// rabattent sur `COUCHES` quand on ne leur en donne pas. Aucun appelant de
// l'application n'en passe : main.js et couches-panel.js interrogent le vrai
// catalogue, exactement comme avant. C'EST POUR LES TESTS, et ce n'est pas une
// commodité — c'est une correction.
//
// ⚠️ CE QUI S'EST PASSÉ LE 2026-08-02. Retirer quatre couches du catalogue a
// cassé TREIZE tests de test/gardien.test.js, alors qu'aucune règle de budget
// n'avait bougé d'une virgule. La cause : ces tests se servaient des couches
// réelles comme EXEMPLES DE COÛT (« une couche à 3 parts », « le plus petit
// sacrifice », « la marge de déblocage »). Le catalogue passant de 18 à 7 parts,
// tous les scénarios de dépassement changeaient de sens en même temps.
//
// Une règle de budget dont les tests rougissent parce qu'on AJOUTE ou RETIRE une
// couche est une règle mal testée : elle éprouve un inventaire au lieu d'une
// loi. Et ce projet retirera et ajoutera encore des couches — la canopée est
// arrivée en juillet, quatre entrées sont parties en août.
//
// Le paramètre coûte deux lignes ici et rend les tests de budget définitivement
// indépendants du contenu du panneau. Les tests qui portent VRAIMENT sur
// l'inventaire (les trois couches qu'Adrien veut voir, l'unicité des
// identifiants, l'existence des notes) continuent, eux, d'interroger `COUCHES` —
// c'est leur sujet.

// L'index d'un catalogue : sa table par identifiant, son coût le plus cher, et
// le rang de chaque entrée (qui tranche les égalités de sacrifice).
//
// ⚠️ IL EST MÉMORISÉ PAR TABLEAU. `evaluerCouche` est appelé à chaque battement
// du panneau et à chaque dixième d'heure de la tirette temporelle : reconstruire
// une Map à chaque appel transformerait un module pur en dépense. La WeakMap
// laisse partir un catalogue de test dès que le test se termine.
const INDEX = new WeakMap()

function indexer(catalogue) {
  const liste = Array.isArray(catalogue) ? catalogue : COUCHES
  const connu = INDEX.get(liste)
  if (connu) return connu
  const idx = {
    liste,
    parId: new Map(liste.map((c) => [c.id, c])),
    rang: new Map(liste.map((c, i) => [c.id, i])),
    // Le coût le plus cher du catalogue. Il sert de valeur par défaut aux
    // identifiants inconnus (voir coutCouche).
    coutMax: liste.reduce((m, c) => Math.max(m, c.cout), 0),
  }
  INDEX.set(liste, idx)
  return idx
}

/** L'entrée du catalogue, ou null si l'identifiant n'y est pas. */
export function couche(id, catalogue = COUCHES) {
  return indexer(catalogue).parId.get(id) || null
}

/**
 * Le coût d'une couche, en parts.
 *
 * ⚠️ UN INCONNU COÛTE LE MAXIMUM, PAS ZÉRO. Une couche branchée dans
 * l'interface mais oubliée au catalogue ne doit surtout pas devenir gratuite :
 * c'est le chemin silencieux par lequel un budget se vide sans que personne ne
 * voie rien. Même famille de décision que `classerCarte`, où ce qu'on ne
 * reconnaît pas tombe dans une ligne prudente plutôt que dans la plus généreuse.
 */
export function coutCouche(id, catalogue = COUCHES) {
  const idx = indexer(catalogue)
  return idx.parId.get(id)?.cout ?? idx.coutMax
}

// ---------------------------------------------------------------------------
// LA CAPACITÉ — elle se lit dans la table des paliers, pas à côté d'elle
// ---------------------------------------------------------------------------

// La moitié de ce que la machine porte en dalles voisines. UN seul choix est
// fait ici, et le voici en toutes lettres :
//
// LE DAMIER EST DU CONTEXTE QUE LE VISITEUR N'A PAS DEMANDÉ ; LES COUCHES SONT
// DES CHOSES QU'IL DEMANDE EXPRESSÉMENT. Leur accorder autant qu'au damier
// doublerait le pic de charge de la page — on servirait deux fois ce que la
// table a jugé supportable. La moitié maintient le total sous 1,5 fois ce que
// la machine porte déjà aujourd'hui, et surtout : elle SUIT LA TABLE. Le jour
// où quelqu'un remonte le `damierMax` du palier 3 de 4 à 8, le budget des
// couches suivra sans qu'on touche à ce fichier — exactement ce que
// fenetre-reglage.js a obtenu en lisant `damierMax` au lieu d'écrire
// « palier ≥ 3 → refus ».
//
// ⚠️ CE QUI N'A PAS ÉTÉ MESURÉ, ET QUE JE N'AFFIRME PAS : que douze parts de
// couches tiennent réellement sur une machine de palier 0. Ce rapport de moitié
// s'appuie sur la table, PAS sur un banc. Le premier lot de couches réellement
// implémentées est ce qui le confirmera ou le fera bouger — et si ça bouge,
// c'est ici, en un seul endroit.
const RAPPORT_DAMIER = 2

export function partsPortees(machine) {
  const damier = machine?.damierMax
  // Pas de verdict = pas de refus. Règle commune à tout palier-machine.js et à
  // machinePorteContinu : refuser sur une absence d'information punirait les
  // machines dont on ne sait rien, qui sont souvent les plus récentes.
  if (!Number.isFinite(damier) || damier <= 0) return partsPortees(PALIERS[0])
  return Math.max(1, Math.floor(damier / RAPPORT_DAMIER))
}

/**
 * De combien de crans le gouverneur a-t-il dû descendre depuis son départ ?
 *
 * C'est LA définition de « le PC commence à souffrir », et elle est empruntée,
 * pas inventée : `tier` et `startTier` sont les deux accesseurs publics de
 * createAdaptiveQuality (perf.js).
 *
 * @param {{tier?:number, startTier?:number}|null} gouverneur
 */
export function cransPerdus(gouverneur) {
  const t = gouverneur?.tier
  const d = gouverneur?.startTier
  if (!Number.isFinite(t) || !Number.isFinite(d)) return 0
  // Jamais négatif : le gouverneur a le droit de regagner UN palier au-dessus
  // de son départ (plafondDeRemontee) quand la machine tient. Ce cadeau ne doit
  // pas gonfler le budget des couches — un signal ne peut qu'AGGRAVER le
  // verdict, jamais l'adoucir (la règle interne de palier-machine.js).
  return Math.max(0, t - d)
}

/**
 * Le budget de couches, en parts, pour cette machine dans cet état.
 *
 * Deux rabots, dans cet ordre :
 *   1. le palier de DÉPART du gouverneur peut être plus sévère que la carte —
 *      un téléphone démarre à 3 même avec un Adreno « fort », parce qu'il
 *      n'atteint l'application que comme visionneuse. On prend le plus sévère
 *      des deux, jamais le plus généreux ;
 *   2. chaque cran perdu depuis le départ COUPE LE BUDGET EN DEUX. Pas un cran
 *      constant : la profondeur de la chute décide, comme dans `palierVise`.
 *      Une machine qui a plongé de trois paliers n'a pas perdu trois couches,
 *      elle n'a presque plus rien à donner.
 */
export function capaciteParts({ machine = null, gouverneur = null } = {}) {
  const depart = gouverneur?.startTier
  const parDepart = Number.isFinite(depart) ? partsPortees(PALIERS[Math.max(0, Math.min(3, Math.round(depart)))]) : Infinity
  const base = Math.min(partsPortees(machine), parDepart)
  const crans = Math.min(3, cransPerdus(gouverneur))
  return Math.max(0, Math.floor(base / 2 ** crans))
}

// ---------------------------------------------------------------------------
// LA COMPTABILITÉ
// ---------------------------------------------------------------------------

// Il reste MARGE_TENDU parts ou moins → l'interface doit le montrer AVANT que
// le refus tombe. Un budget qui passe de « tout va bien » à « non » sans étape
// intermédiaire est vécu comme une panne ; c'est la même règle que les ombres
// qui passent par 'static' avant de disparaître.
export const MARGE_TENDU = 1

// Ce qu'il faut libérer EN PLUS du strict nécessaire pour qu'une couche déjà
// refusée redevienne allumable. Voir « DÉCISION 3 » dans l'en-tête.
export const MARGE_DEBLOCAGE = 1

/** La somme des coûts des couches allumées. Les doublons ne se paient qu'une fois. */
export function occupationParts(actives, catalogue = COUCHES) {
  if (!Array.isArray(actives)) return 0
  let total = 0
  for (const id of new Set(actives)) total += coutCouche(id, catalogue)
  return total
}

const mot = (n) => `${n} part${n > 1 ? 's' : ''}`

/**
 * Où en est le budget — tout ce qu'il faut pour dessiner une jauge et l'écrire.
 *
 * @returns {{capacite:number, occupation:number, restant:number,
 *            depassement:number, fraction:number, tendu:boolean, resume:string}}
 */
export function etatBudget({ actives = [], machine = null, gouverneur = null, catalogue = COUCHES } = {}) {
  const capacite = capaciteParts({ machine, gouverneur })
  const occupation = occupationParts(actives, catalogue)
  // ⚠️ LE RESTANT SE PLANCHERISE À 0 ET LE DÉPASSEMENT SORT À PART. Le cas
  // arrive vraiment : les couches sont allumées, PUIS le gouverneur descend
  // d'un cran et la capacité fond sous elles. Le gardien n'éteint rien — mais
  // une jauge à -3 parts et une barre à 140 % de large sont deux bugs
  // d'affichage que l'interface n'a pas à corriger elle-même.
  const restant = Math.max(0, capacite - occupation)
  const depassement = Math.max(0, occupation - capacite)
  const fraction = capacite > 0 ? Math.min(1, occupation / capacite) : 1
  const resume = depassement > 0
    ? `${mot(occupation)} allumées pour ${mot(capacite)} disponibles — ${mot(depassement)} au-delà du budget`
    : `${mot(occupation)} sur ${mot(capacite)} — il en reste ${restant}`
  return { capacite, occupation, restant, depassement, fraction, tendu: restant <= MARGE_TENDU, resume }
}

// ---------------------------------------------------------------------------
// « QUE DOIS-JE ÉTEINDRE POUR ALLUMER ÇA ? »
// ---------------------------------------------------------------------------
// Adrien veut pouvoir ÉCHANGER, pas seulement se voir refuser. La proposition
// vise LE PLUS PETIT SACRIFICE : d'abord une seule couche si l'une suffit à
// elle seule (un clic vaut mieux que deux), et parmi celles qui suffisent, la
// MOINS CHÈRE — on ne sacrifie pas les sentiers pour libérer une part quand les
// étoiles y pourvoient. Si aucune ne suffit seule, on prend les plus chères
// d'abord, ce qui minimise le nombre de couches à éteindre.
//
// L'ordre du catalogue tranche les égalités : deux couches au même coût doivent
// donner la même proposition d'une image à l'autre, sinon le libellé du bouton
// change tout seul sous les yeux du visiteur.
function choisirSacrifice(actives, deficit, catalogue = COUCHES) {
  if (deficit <= 0) return []
  const { rang } = indexer(catalogue)
  const candidats = [...new Set(actives)]
    .map((id) => ({ id, cout: coutCouche(id, catalogue), rang: rang.get(id) ?? Number.MAX_SAFE_INTEGER }))
    .sort((a, b) => a.cout - b.cout || a.rang - b.rang)

  const seule = candidats.find((c) => c.cout >= deficit)
  if (seule) return [seule.id]

  // Aucune ne suffit seule : les plus chères d'abord, pour en éteindre le moins
  // possible.
  const out = []
  let reste = deficit
  for (const c of [...candidats].reverse()) {
    out.push(c.id)
    reste -= c.cout
    if (reste <= 0) return out
  }
  // Même en éteignant TOUT, la couche ne rentre pas : elle est hors de portée
  // de cette machine. On rend une liste vide plutôt qu'une proposition qui ne
  // marcherait pas — et `evaluerCouche` le dit alors avec des mots.
  return []
}

/** La liste des couches à éteindre pour qu'`id` puisse s'allumer. Vide = rien à échanger. */
export function aRetirerPour({ id, actives = [], machine = null, gouverneur = null, bloqueePrecedemment = false, catalogue = COUCHES } = {}) {
  const cout = coutCouche(id, catalogue)
  const capacite = capaciteParts({ machine, gouverneur })
  const seuil = bloqueePrecedemment ? capacite - MARGE_DEBLOCAGE : capacite
  const liste = [...new Set(actives)].filter((x) => x !== id)
  return choisirSacrifice(liste, occupationParts(liste, catalogue) + cout - seuil, catalogue)
}

// ---------------------------------------------------------------------------
// LE VERDICT — « puis-je allumer cette couche ? »
// ---------------------------------------------------------------------------

export const OUI = 'oui'
export const OUI_MAIS = 'oui-avec-avertissement'
export const NON = 'non'

/**
 * Trois réponses, TOUJOURS une raison lisible par un humain.
 *
 * Un refus muet est explicitement écarté par Adrien — c'est le commentaire
 * d'`etatInterrupteur` dans fenetre-reglage.js : « un interrupteur qui s'allume
 * sur une machine qui ne suit pas est pire qu'un interrupteur absent ». Le
 * corollaire vaut aussi : un interrupteur qui refuse sans dire pourquoi est
 * pire qu'un interrupteur absent.
 *
 * @param {object} o
 * @param {string} o.id - la couche visée
 * @param {string[]} o.actives - les couches déjà allumées
 * @param {{damierMax?:number, nom?:string}|null} o.machine - verdict de sonderMachine()
 * @param {{tier?:number, startTier?:number}|null} o.gouverneur - le contrôleur de perf.js
 * @param {boolean} o.bloqueePrecedemment - cette couche était-elle refusée juste avant ?
 * @param {boolean} o.desarme - `?gardien=0` : on n'oppose plus de refus
 * @param {object[]} [o.catalogue] - le catalogue à consulter ; `COUCHES` par
 *        défaut. Voir « LE CATALOGUE EST UN ARGUMENT » plus haut.
 * @returns {{verdict:string, raison:string, cout:number, restantApres:number,
 *            aRetirer:string[], deja:boolean, desarme:boolean}}
 */
export function evaluerCouche({ id, actives = [], machine = null, gouverneur = null, bloqueePrecedemment = false, desarme = false, catalogue = COUCHES } = {}) {
  const c = couche(id, catalogue)

  const listeAutres = [...new Set(actives)].filter((x) => x !== id)
  const capacite = capaciteParts({ machine, gouverneur })
  const occupationAutres = occupationParts(listeAutres, catalogue)

  // Une couche inconnue du catalogue est REFUSÉE, jamais ignorée. Sans coût
  // déclaré, le gardien ne sait rien d'elle : la laisser passer reviendrait à
  // lui accorder une exemption au moment précis où l'on a le moins
  // d'information sur elle.
  if (!c) {
    return {
      verdict: NON,
      raison: `couche « ${id} » absente du catalogue du gardien — son coût est inconnu, donc elle ne peut pas être budgétée`,
      cout: indexer(catalogue).coutMax,
      restantApres: Math.max(0, capacite - occupationAutres),
      aRetirer: [],
      deja: false,
      desarme: !!desarme,
    }
  }

  // Déjà allumée : c'est toujours oui. Le gardien refuse d'ALLUMER, il n'éteint
  // jamais — même quand la capacité a fondu sous les couches en place.
  if (new Set(actives).has(id)) {
    const b = etatBudget({ actives, machine, gouverneur, catalogue })
    return {
      verdict: OUI,
      raison: b.depassement > 0
        ? `« ${c.nom} » est allumée. Le budget est dépassé de ${mot(b.depassement)} depuis que la machine a faibli — le gardien ne l’éteint pas, mais il n’en laissera pas entrer d’autre.`
        : `« ${c.nom} » est allumée (${mot(c.cout)}). ${b.resume}.`,
      cout: c.cout,
      restantApres: b.restant,
      aRetirer: [],
      deja: true,
      desarme: !!desarme,
    }
  }

  const apres = occupationAutres + c.cout
  const seuil = bloqueePrecedemment ? capacite - MARGE_DEBLOCAGE : capacite
  const restantApres = Math.max(0, capacite - apres)
  const machineDit = machine?.nom ? `palier « ${machine.nom} »` : 'cette machine'
  const souffre = cransPerdus(gouverneur)
  const suffixeSouffrance = souffre > 0
    ? ` (budget divisé par ${2 ** souffre} : le gouverneur d’images a dû descendre de ${souffre} palier${souffre > 1 ? 's' : ''} depuis l’ouverture)`
    : ''

  if (apres <= seuil) {
    const raison = restantApres <= MARGE_TENDU
      ? `« ${c.nom} » tient tout juste : ${mot(c.cout)} sur les ${capacite} de ${machineDit}, il ne restera ${restantApres === 0 ? 'plus rien' : mot(restantApres)} après${suffixeSouffrance}.`
      : `« ${c.nom} » coûte ${mot(c.cout)} ; ${machineDit} en porte ${capacite}, il en restera ${restantApres}${suffixeSouffrance}.`
    return {
      verdict: restantApres <= MARGE_TENDU ? OUI_MAIS : OUI,
      raison,
      cout: c.cout,
      restantApres,
      aRetirer: [],
      deja: false,
      desarme: !!desarme,
    }
  }

  // ─────────── le refus, et il ne part jamais sans son remède ───────────
  const aRetirer = choisirSacrifice(listeAutres, apres - seuil, catalogue)
  const rappelHysteresis = bloqueePrecedemment
    ? ` Une part de marge est exigée en plus tant que la couche est refusée, pour que le panneau ne clignote pas quand le budget oscille.`
    : ''
  const raison = aRetirer.length
    ? `« ${c.nom} » coûte ${mot(c.cout)} et il n’en reste que ${Math.max(0, capacite - occupationAutres)} sur les ${capacite} de ${machineDit}${suffixeSouffrance}. Éteignez ${aRetirer.map((x) => `« ${couche(x, catalogue)?.nom ?? x} »`).join(' et ')} pour lui faire la place.${rappelHysteresis}`
    : `« ${c.nom} » coûte ${mot(c.cout)} à elle seule, et ${machineDit} n’en porte que ${capacite} en tout${suffixeSouffrance} : cette couche est hors de portée de cette machine, éteindre les autres n’y changerait rien.`

  if (desarme) {
    // Désarmé : on laisse passer, mais on ne se tait pas. Voir « DÉCISION 4 ».
    return {
      verdict: OUI_MAIS,
      raison: `Gardien désarmé (?gardien=0) — allumage autorisé malgré le verdict. ${raison}`,
      cout: c.cout,
      restantApres,
      aRetirer,
      deja: false,
      desarme: true,
    }
  }

  return { verdict: NON, raison, cout: c.cout, restantApres, aRetirer, deja: false, desarme: false }
}

// ---------------------------------------------------------------------------
// L'ÉCHAPPATOIRE
// ---------------------------------------------------------------------------

/**
 * `?gardien=0` désarme-t-il les refus ?
 *
 * ⚠️ Tout ce qui n'est pas exactement « 0 » est traité comme une ABSENCE, pas
 * comme une erreur — même règle que `forceUrl`. Un lien mal recopié ne doit pas
 * désarmer le seul système qui empêche la page de mourir, et la valeur par
 * défaut d'un garde-fou est TOUJOURS « armé ».
 *
 * @param {string|null|undefined} brut - la valeur brute du paramètre d'adresse
 */
export function desarmeUrl(brut) {
  return brut === '0'
}

// ---------------------------------------------------------------------------
// L'ÉTAT COMPLET — le contrat avec l'onglet « Couches »
// ---------------------------------------------------------------------------

/**
 * Tout le panneau en un appel : le budget, l'état de souffrance, et une ligne
 * par couche du catalogue, verdict et raison compris.
 *
 * L'interface n'a rien à recalculer et surtout rien à décider : si elle devait
 * refaire une soustraction pour griser un bouton, ce serait un deuxième endroit
 * où la règle vit — et deux règles finissent toujours par diverger.
 *
 * @param {object} o
 * @param {string[]} o.actives - les couches allumées
 * @param {object|null} o.machine - le verdict mémorisé de sonderMachine()
 * @param {{tier?:number, startTier?:number}|null} o.gouverneur - le contrôleur de perf.js
 * @param {string[]} o.bloquees - celles qui étaient refusées au rendu précédent
 *        (c'est ce jeu-là qui porte l'hystérésis : l'appelant garde le passé,
 *        le gardien garde la règle — l'idiome d'`echantillonRetenu`)
 * @param {boolean} o.desarme
 * @param {object[]} [o.catalogue] - le catalogue à consulter ; `COUCHES` par
 *        défaut. Voir « LE CATALOGUE EST UN ARGUMENT » plus haut.
 */
export function etatCouches({ actives = [], machine = null, gouverneur = null, bloquees = [], desarme = false, catalogue = COUCHES } = {}) {
  const bloq = new Set(Array.isArray(bloquees) ? bloquees : [])
  const budget = etatBudget({ actives, machine, gouverneur, catalogue })
  const crans = cransPerdus(gouverneur)
  const liste = indexer(catalogue).liste
  return {
    budget,
    desarme: !!desarme,
    souffrance: {
      crans,
      tier: gouverneur?.tier ?? null,
      palierDepart: gouverneur?.startTier ?? null,
      // Toujours une phrase, y compris quand tout va bien : l'onglet doit
      // pouvoir dire « la machine tient » aussi clairement que « elle faiblit ».
      raison: crans > 0
        ? `Le gouverneur d’images a dû descendre de ${crans} palier${crans > 1 ? 's' : ''} depuis l’ouverture : le budget de couches est divisé par ${2 ** crans}.`
        : `Le gouverneur d’images n’a rien eu à dégrader depuis l’ouverture : le budget est entier.`,
    },
    couches: liste.map((c) => {
      const v = evaluerCouche({
        id: c.id,
        actives,
        machine,
        gouverneur,
        bloqueePrecedemment: bloq.has(c.id),
        desarme,
        catalogue,
      })
      // UNE COUCHE SANS RENDU NE S'ALLUME PAS, et ce refus est posé ICI et non
      // dans `evaluerCouche` — délibérément. `evaluerCouche` répond à une
      // question de BUDGET : « cette machine peut-elle la porter ? ». La
      // réponse reste oui, et elle resterait oui sur un ordinateur infiniment
      // puissant : le problème n'est pas la puissance, c'est qu'il n'y a rien
      // à peindre. Deux questions, deux endroits : mélanger les deux
      // empêcherait d'éprouver le budget sur une couche sans rendu, et
      // d'éprouver `aProduire` sans monter un scénario de budget autour.
      //
      // ⚠️ ET LE DÉSARMEMENT NE LE LÈVE PAS. `?gardien=0` désarme le budget,
      // pas la réalité : forcer l'allumage d'une couche sans rendu ne
      // montrerait rien et ferait croire à une panne.
      if (c.aProduire) {
        return {
          id: c.id,
          nom: c.nom,
          cout: c.cout,
          note: c.note,
          aProduire: true,
          active: false,
          verdict: NON,
          raison: `« ${c.nom} » est annoncée au catalogue, mais son rendu n’est pas encore écrit : l’allumer ne peindrait rien.`,
          restantApres: null,
          aRetirer: [],
        }
      }
      return {
        id: c.id,
        nom: c.nom,
        cout: c.cout,
        note: c.note,
        aProduire: false,
        active: new Set(actives).has(c.id),
        verdict: v.verdict,
        raison: v.raison,
        restantApres: v.restantApres,
        aRetirer: v.aRetirer,
      }
    }),
  }
}

// ---------------------------------------------------------------------------
// LE RECENSEMENT — l'identité unique, en clair
// ---------------------------------------------------------------------------
// « Il y a déjà pas mal de choses que le gardien contrôle, il faudrait les
//   regrouper sous une identité unique. »
//
// Voici la liste. Elle est DONNÉE, pas commentaire : test/gardien.test.js
// vérifie que chaque module cité existe encore et porte encore l'identifiant
// annoncé. Sans ce test, cette liste serait de la documentation périmée en
// trois commits — et une documentation périmée sur un système de sécurité est
// pire que rien, elle fait croire qu'on est protégé.
//
// Ce que ce recensement NE FAIT PAS : changer un seul seuil. Regrouper, c'est
// donner une adresse commune. Si une valeur bouge en passant par ici, c'est un
// bug, pas un regroupement.
export const PROTECTIONS = [
  {
    cle: 'palier-machine',
    module: 'src/palier-machine.js',
    identifiant: 'PALIERS',
    protege: 'la première image, avant tout rendu',
    contre: 'un démarrage au maximum sur une machine qui ne suit pas (47 s de ventilateur mesurées le 28/07/2026 sur un iMac 27" 2015)',
    critere: 'classe de carte graphique × charge de pixels de l’écran → 4 paliers, chacun portant densité, budget de pixels, ombres, SSAO, DOF, grain, damierMax, analyseMax',
    pur: true,
  },
  {
    cle: 'gouverneur',
    module: 'src/perf.js',
    identifiant: 'palierVise',
    protege: 'la fluidité pendant toute la session',
    contre: 'une machine qui s’effondre après le démarrage — et contre le gouverneur lui-même, resté sourd des mois durant',
    critere: 'moyenne glissante sur une DURÉE (1,5 s et 6 images minimum) ; sous 30 im/s pendant 2,5 s → on descend de la hauteur de la chute ; au-dessus de 55 im/s pendant 12 s → un cran regagné ; 20 s minimum entre deux changements',
    pur: false,
  },
  {
    cle: 'ecart-acoup',
    module: 'src/perf.js',
    identifiant: 'echantillonRetenu',
    protege: 'la mesure elle-même',
    contre: 'un figement isolé (décompression de tuile, onglet réveillé) lu comme une lenteur — ET l’inverse : une machine sous 2 im/s qui n’alimentait jamais la fenêtre parce que TOUTES ses images dépassaient le seuil',
    critere: 'dt > 0,5 s écarté, SAUF si la précédente l’était déjà (un figement est isolé, une machine lente enchaîne) ; dt > 5 s toujours écarté',
    pur: true,
  },
  {
    cle: 'fenetre-continue',
    module: 'src/fenetre-reglage.js',
    identifiant: 'machinePorteContinu',
    protege: 'le mode continu 3×3 (neuf MNT au lieu d’un)',
    contre: 'l’allumage d’un mode qui charge neuf blocs sur une machine qui n’en porte pas huit',
    critere: 'damierMax ≥ 8 lu DANS la table des paliers, jamais un seuil écrit à côté ; jamais de refus sur une absence d’information',
    pur: true,
  },
  {
    cle: 'plafond-pixels',
    module: 'src/viewport.js',
    identifiant: 'PLAFOND_MPX',
    protege: 'la taille du tampon de dessin',
    contre: 'un 5K à densité 2 (14,7 Mpx par image) et contre Chrome qui rabote le tampon lui-même, une dimension à la fois et sans un mot',
    critere: '3,6864 Mpx (2560×1440) pour tout le monde, palier 0 compris ; on recule la DENSITÉ, jamais une dimension',
    pur: true,
  },
  {
    cle: 'aspect-nul',
    module: 'src/viewport.js',
    identifiant: 'densiteSousPlafond',
    protege: 'la matrice de projection',
    contre: 'un conteneur à 0×0 pendant un souffle → camera.aspect = NaN, définitif et muet : toutes les étiquettes ancrées à l’écran retombent dans le coin',
    critere: 'aucune taille nulle ne franchit le calcul ; arrondi pair (le carré noir de l’encodeur)',
    pur: true,
  },
  {
    cle: 'memoire-mnt',
    module: 'src/dem-memo.js',
    identifiant: 'DEM_MEMO_MAX',
    protege: 'le tas JS lors des allers-retours de zoom',
    contre: 'l’enflure d’un cache non borné (18,9 Mo minimum par entrée, 37,7 au pire)',
    critere: '2 entrées, éviction LRU ; l’analyse est rangée SOUS son MNT (WeakMap) et non dans un second cache parallèle, pour qu’ils ne puissent pas se désynchroniser',
    pur: true,
  },
  {
    cle: 'damier',
    module: 'src/block-grid.js',
    identifiant: 'NEIGHBOUR_RES',
    protege: 'la mémoire du navigateur quand le damier est plein',
    contre: '1 824 Mo de tas JS mesurés (Le Var isolé z12, 23 voisines) pour une limite pratique de 2 à 4 Go dans Chrome — le risque n°1 du damier, devant la vitesse',
    critere: 'maillage voisin 256 et champs bornés à 1024², soit au plus 4× la densité du maillage qui les porte ; le MNT n’est PAS réduit (il est lu par le processeur)',
    pur: false,
  },
  {
    cle: 'damier-echecs',
    module: 'src/block-grid.js',
    identifiant: 'DEM_FAIL_TTL_MS',
    protege: 'le réseau et le fil principal',
    contre: 'la redemande en boucle d’URL mortes (90 requêtes pour 45 URL absentes)',
    critere: '60 s de mémoire des échecs — un TTL et non un ensemble définitif : une coupure réseau n’est pas un 404 permanent',
    pur: false,
  },
  {
    cle: 'emprise-en-vol',
    module: 'src/dem-emprise.js',
    identifiant: 'EMPRISE_EN_VOL_MAX',
    protege: 'le pic de tas pendant la construction de l’emprise 3×3',
    contre: 'neuf MNT lancés d’un seul Promise.all — 160 Mo qui devenaient 386',
    critere: '3 chargements en vol au plus, résultats rendus dans l’ordre des entrées ; pic ramené à 215-246 Mo pour un temps total inchangé',
    pur: true,
  },
  {
    cle: 'finesse-au-repos',
    module: 'src/fenetre-finesse.js',
    identifiant: 'RES_REPOS_MAX',
    protege: 'l’onglet, à la première pause en emprise 3×3',
    contre: '302 Mo de champ de grain ((3×2048+1)² × 2 octaves) sur un budget de 260 Mo — l’onglet tué net',
    critere: 'résolution bornée à 768 au repos, par Math.min dans les DEUX branches (un choix utilisateur plus bas reste plus bas)',
    pur: true,
  },
  {
    cle: 'overpass-taille',
    module: 'src/map/overpass.js',
    identifiant: 'OVERPASS_MAXSIZE',
    protege: 'la mémoire et le fil principal face au réseau OSM',
    contre: 'une réponse de 238 Mo arrivant en 200 OK (z12 sur Paris centre, 351 414 chemins) : le repli « en cas d’échec » ne se déclenchait jamais, puisqu’il n’y avait pas d’échec',
    critere: '48 Mo injectés dans la requête elle-même — un garde-fou porteur, pas un bouton de réglage',
    pur: true,
  },
  {
    cle: 'overpass-attente',
    module: 'src/map/overpass.js',
    identifiant: 'OVERPASS_ATTENTE_MS',
    protege: 'le temps du visiteur',
    contre: 'des requêtes mortes de 31 à 42 s ; le [timeout:25] de la requête ne protège de rien, il ne court qu’après connexion',
    critere: '6 s d’attente puis abandon (la requête n’est pas annulée, elle reste au cache — seule l’attente l’est)',
    pur: true,
  },
  {
    cle: 'overpass-disjoncteur',
    module: 'src/map/overpass.js',
    identifiant: 'OVERPASS_PANNE_MS',
    protege: 'le reste de l’application quand Overpass tombe',
    contre: 'la répétition de requêtes vers un service injoignable',
    critere: '60 s de coupure, ouverte UNIQUEMENT sur absence de réponse — un 400 ou un 429 ne l’ouvre pas, couper l’eau partout pour ça fabriquerait la panne qu’on veut éviter',
    pur: true,
  },
  {
    cle: 'warmup',
    module: 'src/warmup.js',
    identifiant: 'warmupPrograms',
    protege: 'l’existence même de la page',
    contre: 'un pilote sans KHR_parallel_shader_compile qui ne lève jamais COMPLETION_STATUS_KHR — page morte. « Un gel de 2 s est un défaut ; une page morte est une panne. »',
    critere: '6 s de délai de garde, sondage toutes les 10 ms, et la fonction ne rejette JAMAIS',
    pur: true,
  },
  {
    cle: 'porte-de-demarrage',
    module: 'src/boot-gate.js',
    identifiant: 'gateFor',
    protege: 'le tout premier instant',
    contre: 'un appareil ou un navigateur qui ne peut pas rendre la scène (pas de WebGL2, téléphone, navigateur intégré à une application)',
    critere: 'une carte de refus explicite plutôt qu’un écran noir ; le lien partagé passe quand même, en visionneuse',
    pur: true,
  },
  {
    cle: 'nuages',
    module: 'src/clouds-sim.js',
    identifiant: 'CLOUD_HARD_MAX',
    protege: 'le remplissage GPU',
    contre: 'le recouvrement des boîtes raymarchées — 48 boîtes qui se recouvrent, 3 im/s mesurées',
    critere: '34 entités au maximum, quoi qu’il arrive ; le peuplement suit le palier du gouverneur (4/3/2/2 grappes)',
    pur: true,
  },
  {
    cle: 'globe-tuiles',
    module: 'src/globe.js',
    identifiant: 'TILE_MEMO_OCTETS_MAX',
    protege: 'la mémoire des tuiles du globe',
    contre: 'un cache d’ImageBitmap décodés sans fin',
    critere:
      '32 Mo d’ImageBitmap décodé, éviction LRU — un budget en OCTETS et non en entrées depuis que les tuiles font 256 px (AWS) ou 512 px (Mapterhorn) ; 6 chargements simultanés au plus',
    pur: false,
  },
  {
    cle: 'cellules-geo',
    module: 'src/map/geo-cells.js',
    identifiant: 'MAX_CELLS',
    protege: 'le chargement des données géographiques',
    contre: 'une emprise si large que le découpage en cellules coûterait plus que le fichier monolithe',
    critere: '64 cellules ; au-delà la fonction rend null et l’appelant bascule de source',
    pur: true,
  },
  {
    cle: 'calques-gpx',
    module: 'src/gpx-layers.js',
    identifiant: 'canAddLayer',
    protege: 'la pile de traces GPX',
    contre: 'un empilement sans fin de tracés drapés',
    critere: '10 calques ; addLayer rend null au-delà — le précédent le plus proche du gardien des couches',
    pur: true,
  },
]
