// LE BRANCHEMENT DU CROP — Tâche I du plan « UNE SEULE TERRE »
// (`docs/superpowers/plans/2026-08-21-terre-unique.md`).
//
// Module PUR : ni DOM, ni three.js, ni fetch. Il n'importe que la loi des seuils
// (`seuil-socle.js`) et parle au globe par sa seule interface publique. Tout se
// vérifie sous node (`test/crop-branche.test.js`).
//
// ══════════ 0. POURQUOI CE FICHIER EXISTE ═══════════════════════════════════
//
// ⚠️ **LE PLAN N'AVAIT AUCUNE TÂCHE QUI BRANCHE CE QU'IL CONSTRUIT.** Les Tâches
// A à G ont posé six méthodes sur le globe — `poserCrop`,
// `construireParoisCrop`, `poserHabillage`, `poserRampe`, `poserMer`,
// `poserEstompage` — et, au 2026-08-21, `src/` hors `globe.js` comptait **zéro
// appelant de production** pour les cinq premières. L'application se comportait
// donc exactement comme avant le chantier, et **c'est Adrien qui l'a vu** :
// « j'ai l'impression de ne pas être sur le bon serveur ». Il était sur le bon
// serveur.
//
// ⚠️ **LA VEILLE VIT DANS UN MODULE, comme celle du socle et celle de
// l'estompage, et pour la même raison** : aucun test ne charge `main.js`, et
// l'état inter-images est précisément ce qui se casse en silence.
//
// ══════════ 1. CE QUI EST RÉUTILISÉ, ET CE QUI N'EST PAS REFAIT ═════════════
//
// ⚠️ **LES SEUILS SONT CEUX DU SOCLE, AU BIT PRÈS.** `socleVisible` décide déjà
// quand le socle plat naît (32 274 m) et meurt (40 343 m, hystérésis ×1,25).
// **C'est la MÊME décision pour le crop** — c'est même toute l'idée du chantier :
// le socle DEVIENT une découpe dans la planète. En refaire un second jeu de
// seuils, c'est deux mondes qui divergent d'une image puis d'un palier. Ce
// module n'écrit donc aucun nombre d'altitude.
//
// ⚠️ **ET IL N'ÉCRIT AUCUN `fov` NON PLUS.** Le champ de vision entre par le
// contexte, que `main.js` remplit depuis la caméra VIVANTE. La Tâche F s'est
// fait prendre à porter un `fov = 33` introuvable dans le dépôt ; son correctif
// l'a remplacé par `FOV_DEG = 30`, ce qui est juste pour un DÉFAUT — mais un
// relevé sur l'application vivante (2026-08-21) donne `params.fov = 33`,
// `camera.fov = 33`, `camGlobe.fov = 33`, parce qu'un template appliqué au
// démarrage repose `params.fov` (`templates-user.js` sauvegarde `'fov'`).
// **« 33 n'existe nulle part dans le dépôt » était vrai de la SOURCE et faux de
// l'application qui tourne.** Le fov est donc une entrée, jamais une constante.
//
// ══════════ 2. L'ORDRE DES MAILLONS, ET IL N'EST PAS DÉCORATIF ══════════════
//
// `construireParoisCrop`, `poserRampe` et `poserMer` sortent toutes les trois
// en tête de corps si `this._crop` est nul, et `poserHabillage` y lit sa marge
// de côte (`uMargeCoteM`, `margeCoteDuCrop`). **La découpe passe donc en
// premier, et ce n'est pas un ordre de lecture : c'est une dépendance.** Le
// globe factice du test refuse comme le vrai, de sorte qu'une permutation change
// le COMPORTEMENT et pas seulement l'ordre d'une liste.
//
// ══════════ 3. LE REFUS N'EST PAS UNE FIN — LA REPRISE ══════════════════════
//
// ⚠️ **SANS ELLE, LE BRANCHEMENT NE MONTRE RIEN, ET C'EST ARITHMÉTIQUE.** Au
// moment où le crop naît, le quadtree n'a pas encore les tuiles fines de son
// emprise : `construireParoisCrop` et `poserRampe` rendent un refus de
// couverture. Or leur contrat, écrit dans `globe.js`, est que **« le refus ne
// touche pas à ce qui est en place »** — c'est ce qui les rend acceptables, et
// c'est aussi ce qui fait que **rien n'arrive jamais si personne ne redemande**.
//
// La reprise ne rejoue QUE les maillons qui ont refusé, et jamais la découpe :
// reconstruire les parois coûte un balayage du contour, la rampe 128² points, la
// mer un champ de 385² — les rejouer tous à chaque image serait un gel par
// image. `periodeReprise` est un nombre d'IMAGES, pas un temps : le module est
// pur, il n'a pas d'horloge.
//
// ══════════ 4. CE QUE CE MODULE NE FAIT PAS ════════════════════════════════
//
//   · **il ne cache pas le bloc plat** — c'est `main.js` qui tient la liste des
//     calques de surface, et il n'y en a QU'UNE (cinq accidents de liste
//     dupliquée sont racontés dans ce fichier-là) ;
//   · **il ne décide pas quand il a le droit de décider** — la garde du cran
//     (`modes.busy`, la largeur du bloc désaccordée d'une image) vit dans
//     `main.js`, à côté de celle du seuil du socle, parce que c'est là que ces
//     grandeurs existent ;
//   · **il n'anime pas la mer** — `animerMer(dt)` est une cadence, donc une
//     affaire de boucle d'image.

import { socleVisible, auBloc as auBlocSeuil } from './seuil-socle.js'

/**
 * Les maillons de la chaîne, dans l'ordre où ils doivent être posés.
 * ⚠️ `crop` en tête : les cinq autres refusent sans lui (voir le §2).
 *
 * ⚠️ **`fond` EST EN DEUXIÈME, ET CE N'EST PAS UN RANGEMENT — Tâche J bis.** Il
 * donne au globe le relief SOUS-MARIN du crop, et les deux maillons qui le
 * suivent le LISENT : `parois` pose la base du bloc sous le point le plus bas de
 * la surface (le « basin guard » de `parois-crop.js`), `rampe` cale ses couleurs
 * sur la profondeur mesurée. Posé après eux, le fond aurait donné un bloc dont
 * le flanc commence deux kilomètres au-dessus de sa propre surface et une rampe
 * calée sur 130,36 m là où il y en a 2 116,3 (les deux chiffres sont relevés dans
 * l'application vivante — `.banc/vues-Jbis/Jbis-releves-bruts.json`).
 */
export const MAILLONS = Object.freeze(['crop', 'fond', 'parois', 'habillage', 'rampe', 'mer'])

/**
 * Les maillons qui LISENT le fond, dans l'ordre de `MAILLONS`.
 *
 * ⚠️ **SANS CETTE LISTE, LA REPRISE LAISSE UN BLOC INCOHÉRENT, ET ÇA A ÉTÉ VU À
 * L'ÉCRAN.** La nappe bathymétrique est ASYNCHRONE : au premier passage le fond
 * REFUSE (couverture ou bathymétrie absente) pendant que `parois` et `rampe`,
 * eux, PRENNENT — sur une surface encore plate. `reprendre` ne rejoue que ce qui
 * a refusé : quand le fond finit par prendre, la rampe garde sa profondeur d'une
 * surface qui n'existe plus. Relevé dans l'application, La Réunion z12 :
 * `uOceanDepth = 130,36 m` avec un fond de **2 116,3 m** sous les pieds.
 *
 * ⚠️ **ET L'HABILLAGE N'EN EST PAS**, ce n'est pas un oubli : il recopie quatre
 * postes du socle et ne mesure aucune hauteur. La mer non plus — elle cuit son
 * propre champ.
 */
export const LECTEURS_DU_FOND = Object.freeze(['parois', 'rampe'])

// ══════════ LE RAFRAÎCHISSEMENT DE L'HABILLAGE — Tâche K ter ════════════════
//
// ⛔ **L'HABILLAGE ÉTAIT POSÉ UNE FOIS, ET UNE SEULE, ET IL ARRIVAIT TROP TÔT.**
// Il « ne refuse jamais » (voir le poseur), donc `reprendre` ne le rejoue jamais ;
// et la chaîne entière ne se repose que si la SIGNATURE DU LIEU change. Or trois
// des choses qu'il transporte n'existent PAS encore quand le crop naît :
//
//   · le masque de côte — cuit par le bloc plat, il arrive après ;
//   · la mosaïque d'occupation du sol — elle n'existe que si l'utilisateur
//     allume la couche, ce qui peut arriver n'importe quand ;
//   · `amplitudeM`, qui CALE l'intervalle des courbes de niveau.
//
// **Relevé dans l'application vivante le 2026-08-22, La Réunion z12** :
// `contexteCrop().habillage.coastMask` **non nul** pendant que le globe portait
// `uCoastMaskOn = 0`, et `uContourInterval = 500` (le défaut mondial) pendant
// qu'`amplitudeM` valait **4 737,2 m**. Et couche d'occupation du sol allumée à
// la main : `terrain.mapUniforms.uSolOn = 1`, `ctx.habillage.sol` et `solLut`
// tous deux posés, **`globe.uniforms.uSolOn` resté à 0**.
//
// ⚠️ **C'EST UNE COURSE, PAS UNE PANNE FRANCHE — ET C'EST CE QUI L'A CACHÉE.**
// Sur un chargement où le masque arrive AVANT la première pose, l'image est
// juste. Sur un autre, elle ne l'est pas. Les deux ont été observés le même
// jour, sur la même machine, à la même URL.
//
// ⚠️ **LA RÉPARATION NE PASSE PAS PAR UN REFUS.** Faire refuser l'habillage
// tant qu'un masque manque le ferait rejouer toutes les `periodeReprise` images
// pour toujours dans les crops CONTINENTAUX, où il n'y a légitimement ni côte ni
// occupation du sol. On compare donc ce qu'on a POSÉ à ce que le contexte
// PORTE, et on ne repose que sur changement — **exactement la garde de
// `creerVeilleEstompage`** (« `appliquer` n'est appelé QUE lorsque la valeur
// posée change »). `poserHabillage` n'écrit que des uniformes : c'est le maillon
// le moins cher de la chaîne, et le seul qu'on puisse surveiller par image.

/**
 * Les champs de l'habillage qui décident de ce que le nuanceur allume.
 *
 * ⚠️ **LA LISTE EST FERMÉE, ET C'EST VOULU.** Comparer `Object.keys` du contexte
 * ferait dépendre le rafraîchissement de ce que `main.js` ajoute un jour dans
 * l'objet ; ici on nomme ce qu'on surveille, et un champ neuf qui devrait l'être
 * se déclare ici. Les trois vecteurs (`solOffset`, `solScale`, `solTexel`) n'y
 * sont pas : ce sont des objets MUTÉS EN PLACE par le socle (`setSol` fait
 * `.set(...)`), donc leur identité ne bouge jamais — mais ils ne changent
 * qu'avec `sol`, dont l'identité, elle, change.
 */
export const CHAMPS_HABILLAGE = Object.freeze([
  'coastMask',
  'sol',
  'solLut',
  'solOpacite',
  // ══════ LA PHOTO AÉRIENNE — Tâche R9 ═══════════════════════════════════════
  //
  // ⚠️ **ELLE ARRIVE PLUS TARD QUE TOUT LE RESTE DE CETTE LISTE, ET C'EST
  // POURQUOI ELLE DOIT Y ÊTRE.** L'analyse vient d'un travailleur local ; la
  // mosaïque aérienne vient **du réseau**, après la composition de dix-sept
  // tuiles au mieux — et l'utilisateur l'allume depuis la barre de carte, à un
  // instant que rien ne prévoit. Sans cette ligne, `refreshAerial` poserait la
  // photo sur le socle et le globe ne la verrait **qu'au prochain changement de
  // LIEU** : le bouton resterait inerte à l'œil, exactement le défaut que cette
  // tâche répare. C'est la course nommée par la Tâche K ter, aggravée d'un
  // aller-retour réseau.
  //
  // ⚠️ **`aerialOffset` / `aerialScale` N'Y SONT PAS**, même exemption et même
  // raison que `solOffset` / `solScale` : `terrain.setAerial` les MUTE EN PLACE
  // (`.set(...)`), donc leur identité ne bouge jamais — mais ils ne changent
  // qu'avec `aerial`, dont l'identité, elle, change à chaque composition.
  'aerial',
  'aerialOpacite',
  // ⚠️ **ET LE FONDU CÔTIER AUSSI — TOUR DE CORRECTION DE R9.** C'est une
  // TIRETTE (« Fondu à la côte », `ui/map-panel.js`), donc l'utilisateur la bouge
  // à un instant que rien ne prévoit — exactement l'argument de `aerialOpacite`
  // juste au-dessus. Et c'est un SCALAIRE : `Object.is` le voit changer, et il ne
  // reposera pas l'habillage soixante fois par seconde.
  'aerialCoastFade',
  // ══════ LA MATIÈRE DU RELIEF — Tâche R25, option 38 ═══════════════════════
  //
  // ⚠️ **DIX CHAMPS, ET ILS DOIVENT ÊTRE ICI POUR LA RAISON D'`aerialCoastFade`
  // ET DES QUATRE DE LA GRILLE : CE SONT UN SÉLECTEUR ET QUATRE TIRETTES.**
  // L'utilisateur clique une vignette de matière à un instant que rien ne
  // prévoit ; un champ absent de cette liste n'est jamais comparé, donc jamais
  // reposé — la matière ne changerait qu'au prochain changement de LIEU. C'est
  // la course de la Tâche K ter, et elle rend le sélecteur inerte un
  // chargement sur deux.
  //
  // ⚠️ **`matMap` / `matNormal` SONT DES TEXTURES, ET LEUR IDENTITÉ EST STABLE**
  // — `terrain._loadTextureSet` les met en cache par dossier (`this._texSets`),
  // donc `Object.is` voit bien « même matière » et « matière changée ». C'est
  // l'inverse du cas `hazeColor`, où un `THREE.Color` muté en place ne se
  // comparait pas.
  'matMap',
  'matNormal',
  'matRepeat',
  'matBump',
  'matNoiseOn',
  'matNoiseCut',
  'matNoiseSoft',
  'matNoiseScale',
  'matAboveZero',
  'matBandeM',
  'amplitudeM',
  'contourIntervalM',
  'contourOpacity',
  'contourWeight',
  // ══════ LA GRILLE DE RELEVÉ — Tâche R22, options 19 et 20 ══════════════════
  //
  // ⚠️ **QUATRE SCALAIRES, ET ILS DOIVENT ÊTRE ICI POUR LA MÊME RAISON QUE
  // `aerialCoastFade` : CE SONT DES TIRETTES.** L'utilisateur bouge « Taille de
  // la grille » à un instant que rien ne prévoit ; un champ absent de cette
  // liste n'est jamais comparé, donc jamais reposé — la grille ne changerait
  // qu'au prochain changement de LIEU ou de palette. C'est la course que la
  // Tâche K ter a nommée, et qui rend un défaut invisible un chargement sur deux.
  //
  // ⚠️ **`gridSpanBloc` AUSSI, ET IL N'EST PAS UNE TIRETTE** : il change quand
  // l'emprise du bloc change (mode continu), et le pas au sol en dépend
  // directement. Absent d'ici, un élargissement d'emprise laisserait le
  // carroyage à l'échelle de l'emprise précédente.
  'gridStepBloc',
  'gridOpacite',
  'gridCouleur',
  'gridSpanBloc',
  'grainForceM',
  'grainEchelle',
  // ⚠️ **`normaleFine` — Tâche P9, ET SANS CETTE LIGNE ELLE S'ÉTEINDRAIT SEULE.**
  // La veille ne repose l'habillage que lorsqu'un champ SURVEILLÉ change ; un
  // champ absent d'ici n'est jamais comparé, donc jamais reposé — mais il est
  // bel et bien PASSÉ à chaque pose déclenchée par un autre champ. Le défaut
  // serait donc muet tant que rien d'autre ne bouge, et se réparerait tout seul
  // au premier changement de palette : exactement la course que la Tâche K ter
  // a nommée, et qui rend un défaut invisible un chargement sur deux.
  'normaleFine',
  // ══════ LA COLORISATION NATURELLE — Tâche P2 ═══════════════════════════════
  //
  // ⚠️ **`analyse` EST LE CHAMP LE PLUS EN RETARD DE TOUTE LA LISTE, ET C'EST
  // POURQUOI IL DOIT Y ÊTRE.** Le masque de côte arrive du réseau ; l'analyse,
  // elle, arrive d'un TRAVAILLEUR après une dizaine de flous sur le MNT entier —
  // `terrain.js` mesure **464 ms** rien que pour La Réunion sur un retour de
  // zoom. Elle ne peut donc pas être là quand le crop naît. Sans cette ligne, le
  // peigné n'apparaîtrait qu'au prochain changement de LIEU : c'est la course
  // que la Tâche K ter a nommée, aggravée d'un demi-seconde de retard garanti.
  //
  // ⚠️ **ET `rampe2D` CHANGE D'IDENTITÉ À CHAQUE PALETTE** : `rebuildRamp`
  // DISPOSE l'ancienne texture et en fabrique une neuve. Absent d'ici, le globe
  // aurait gardé un `THREE.Texture` disposé — une table morte, et le rendu qui
  // va avec, jusqu'au prochain déplacement.
  'analyse',
  'rampe2D',
  'texShade',
  'wetK',
  'expoK',
  'hemi',
  'treeLine',
  'heightContrast',
  'heightPivot',
  // ══════ LE GRADE DU BLOC — Tâche GRA ═══════════════════════════════════════
  //
  // ⚠️ **QUATRE SCALAIRES DE PLUS, ET LEUR ABSENCE D'ICI SE PAIERAIT COMME
  // CELLE DE `normaleFine` DEUX CENTS LIGNES PLUS HAUT.** `pivotAutoSocle` et
  // `contrasteAutoSocle` changent à **chaque `applyAutoShade`**, c'est-à-dire à
  // chaque chargement de relief ; `socleBasM` / `socleAmpM` changent à chaque
  // changement de MNT, donc **à chaque zoom**. Or c'est précisément le zoom que
  // cette tâche répare : un champ absent de cette liste n'est jamais comparé,
  // donc jamais reposé, et la correction n'arriverait qu'au prochain changement
  // de palette. Le défaut serait muet un chargement sur deux — la course que la
  // Tâche K ter a nommée.
  'pivotAutoSocle',
  'contrasteAutoSocle',
  'socleBasM',
  'socleAmpM',
  'hazeAmt',
  'hazeAlt',
  'hazeDist',
  // ⚠️ **UNE CHAÎNE, ET C'EST CE QUI LA REND SURVEILLABLE.** `uHazeColor` est un
  // `THREE.Color` MUTÉ EN PLACE par le socle, comme `solOffset`/`solScale` : son
  // identité ne bouge jamais. `contexteCrop` en transmet donc la valeur
  // hexadécimale, qui, elle, se compare par `Object.is`.
  'hazeColor',
  // ══════ L'ÉCLAIRAGE DU BLOC — Tâche P3 ════════════════════════════
  //
  // ⚠️ **C'EST LA SEULE VEILLE PAR IMAGE DE LA CHAÎNE, ET LE SOLEIL BOUGE À
  // CHAQUE DIXIÈME D'HEURE.** `poserCrop` ne tourne qu'au changement de lieu et
  // `construireParoisCrop` qu'à l'arrêt (elle balaie plus de mille points du
  // contour) : un soleil posé par l'une des deux resterait figé sur l'heure de
  // sa naissance, et la tirette de 24 h n'aurait plus aucun effet sur le bloc.
  //
  // ⚠️ **ET TOUS SONT DES SCALAIRES OU DES CHAÎNES**, parce que `Object.is` est
  // la seule comparaison de ce module : un objet `eclairage` reconstruit à
  // chaque image différerait toujours de lui-même et reposerait l'habillage
  // entier soixante fois par seconde.
  'centreLat',
  'centreLon',
  'soleilAzimut',
  'soleilElevation',
  'soleilCouleur',
  'soleilIntensite',
  'hemiCiel',
  'hemiSol',
  'hemiIntensite',
  // ⚠️ **L'AMBIANTE EST UN NOMBRE MESURÉ, PAS UNE CONSTANTE** : c'est
  // l'irradiance que `scene.environment` verse sur une surface diffuse
  // (`src/sonde-ambiante.js`), multipliée par les deux intensités vivantes. Elle
  // pèse **47 %** de l'irradiance totale du socle et suit le cycle horaire —
  // absente d'ici, le bloc s'éclairerait à l'ambiante de son premier instant.
  'ambianteCoef',
  'ambianteIntensite',
  // ══════ L'APPOINT ET L'OMBRAGE DES PENTES — Tâche R21 ═════════════════════
  //
  // ⚠️ **CINQ CHAMPS DE PLUS, ET L'ABSENCE DE L'UN D'EUX SE PAIERAIT COMME
  // CELLE DE `normaleFine` CENT LIGNES PLUS HAUT** : un champ absent d'ici n'est
  // jamais comparé, donc jamais reposé de son propre chef — il PASSE bien à
  // chaque pose déclenchée par un autre champ. Le défaut serait donc muet tant
  // que rien d'autre ne bouge, et se réparerait tout seul au premier changement
  // d'heure : exactement la course que la Tâche K ter a nommée. Or l'appoint est
  // **le seul réglage de lumière que le cycle horaire ne pilote pas** — rien ne
  // bouge derrière lui, il n'y a aucune réparation fortuite à espérer.
  //
  // ⚠️ **ET LES CINQ SONT DES SCALAIRES OU DES CHAÎNES**, comme les douze
  // au-dessus : `Object.is` est la seule comparaison de ce module.
  'appointAzimut',
  'appointElevation',
  'appointCouleur',
  'appointIntensite',
  // ⚠️ **`slopeTint` EST UNE COUCHE DE CARTE, PAS UNE LUMIÈRE**, et il est ici
  // pour la même raison que les dix curseurs d'Atlas : un curseur qu'on traîne
  // doit se voir sans attendre le prochain changement de lieu.
  'slopeTint',
  // ⛔ **ET LA PAROI A LA SIENNE, QUI N'EST PAS CELLE-LÀ — Tâche P8.** Le relief
  // voit `scene.environment` (« the neutral room env ») ; la paroi voit son
  // propre `wallMat.envMap` (« their own studio env map »), et `three`
  // n'applique `scene.environmentIntensity` qu'aux matériaux SANS `envMap` à
  // eux. La paroi du crop empruntait l'ambiante du RELIEF — **1,54 fois plus
  // forte à plat sur un mur vertical**, les deux mesurées au même instant dans
  // la même page — et en sortait **1,68 fois trop claire**. Les deux champs
  // suivent la palette (un préréglage PBR repose `envMap` et `envMapIntensity`)
  // et le cycle horaire, donc leur place est ICI et pas à la construction.
  'paroiAmbianteCoef',
  'paroiAmbianteIntensite',
  'albedoBase',
  'albedoTeinte',
  // ⚠️ **`paroiCouleur` N'EST PAS `params.plinthColor`, ET C'EST TOUT LE
  // DÉFAUT** : `plinth.setColors` ne retient `params.plinthColor` que si le socle
  // n'est ni en verre ni sur un préréglage PBR. Relevé au même instant dans la
  // même page : `params.plinthColor = #d8d4cc`, paroi vivante `c06a44`. La
  // valeur qui compte est celle du matériau, et elle change avec la palette
  // sans que les parois du crop soient rebâties — d'où sa place ICI.
  'paroiCouleur',
  // ══════ LA COUCHE APPARENCE — Tâche P3 ════════════════════════════
  //
  // ⛔ **LE GABARIT D'OUVERTURE L'ALLUME, ET PERSONNE NE L'AVAIT VUE.**
  // `public/templates/defaults/shibustart.json` pose `look.surfaceFx = 9`.
  // Mesuré le 2026-08-22 : elle multiplie l'albédo du socle par **0,59** (socle
  // rendu albédo BLANC sous un hémisphère blanc d'irradiance 1 : 0,591 couche
  // allumée contre 0,997 couche éteinte). Sans elle, le crop éclairé sortait
  // **1,7 fois trop clair**.
  //
  // ⚠️ **`fxTime` N'Y EST PAS**, et c'est une obligation : il avance à chaque
  // image, donc il mettrait cette liste à « différent » soixante fois par
  // seconde. Il passe par `globe.poserTempsApparence`, hors de cette veille.
  'surfaceFx',
  'fxBlend',
  'fxOpacity',
  'fxScale',
  'fxColA',
  'fxColB',
  'fxColC',
  'fxP1',
  'fxP2',
  'fxP3',
  'fxDemiBloc',
  // ⚠️ **DEUX NOMBRES ET NON UN `Vector2`** : `uFenetre` est muté EN PLACE par
  // le socle, donc son identité ne bouge jamais et `Object.is` ne verrait
  // jamais la fenêtre bouger — la remarque que cette liste porte déjà pour
  // `solOffset` / `solScale`, sauf qu'ici la parade est possible.
  'fxFenetreX',
  'fxFenetreY',
])

/**
 * L'habillage à poser diffère-t-il de celui qui est posé ?
 *
 * ⚠️ **`Object.is`, PAS `==`** : `null` et `undefined` sont deux réponses
 * différentes (« pas de masque » contre « champ absent du contexte »), et un
 * `NaN` d'amplitude ne doit pas se comparer égal à lui-même autrement que par
 * `Object.is` — sans quoi une amplitude devenue `NaN` gèlerait l'intervalle.
 *
 * `null` posé au départ signifie « rien n'a jamais été posé » : tout contexte
 * diffère alors, y compris un contexte vide.
 *
 * @param {object|null} pose - ce que `poserHabillage` a reçu la dernière fois
 * @param {object|null|undefined} voulu - ce que le contexte porte à cette image
 */
export function habillageDifferent(pose, voulu) {
  if (!pose) return true
  const v = voulu || {}
  for (const champ of CHAMPS_HABILLAGE) {
    if (!Object.is(pose[champ], v[champ])) return true
  }
  return false
}

// ══════════ L'ORBITE RETIRE LE CROP — Tâche K ter, défaut n° 4 ══════════════
//
// ⛔ **`poserMode` ÉTAIT ÉCRITE, TESTÉE, ET APPELÉE DE NULLE PART.** `maj` sort
// à sa première ligne utile sur `if (!modeSurface) return pose` — mais rien dans
// `main.js` ne disait jamais à cette veille qu'on avait quitté la surface.
// `veilleSocle` et `veilleEstompage` recevaient le mode depuis
// `setSurfaceVisible` ; celle-ci, non. **C'est un branchement absent, pas un
// réglage**, et c'est exactement la classe d'erreur qui a créé ce fichier.
//
// **Relevé le 2026-08-22, mode `orbital`, 3 000 km d'altitude**
// (`.banc/vues-Kter/AV-orbite.json`) : `uCropOn = 1`, `uHabOn = 1`,
// `uCoastMaskOn = 1`, `uLandMax = 2 584,4 m`, `uOceanDepth = 1 262,0 m`, parois
// ET mer du bloc encore dans la scène. Conséquences, toutes visibles :
//
//   · tout sommet au-dessus de 2 584 m saturait en blanc sur la planète entière,
//     et tout océan plus profond que 1 262 m saturait de même ;
//   · le masque de côte cuit pour La Réunion, lu en `ClampToEdge`, décidait de
//     la terre et de la mer **sur toute la sphère** ;
//   · les parois et la nappe de mer du bloc restaient en orbite.
//
// C'est la réserve n° 3 de la Tâche K bis, et c'est aussi pourquoi son jeu de
// six stations « ne s'améliorait quasiment pas » : la station orbitale portait
// la rampe du dernier crop.
//
// ⚠️ **CE N'EST PAS UN SEUIL DE PLUS — LA CONSIGNE « ZÉRO SAUT » TIENT.** On
// n'introduit aucune altitude : on branche le MÊME interrupteur de mode que les
// deux autres veilles reçoivent déjà, sur la MÊME bascule surface/orbite de
// `modes.js`, qui existe et est franche depuis toujours. La loi continue de
// l'estompage n'est pas touchée — elle reste `estompageTerre(altitude)`, et le
// retrait du crop en orbite est le comportement que `retirerCrop` porte depuis
// la Tâche A.
//
// ⚠️ **ET SOUS `terre unique`, L'ESTOMPAGE N'A QU'UN SEUL ÉCRIVAIN** : cette
// veille relaie `estompage.poserMode` elle-même (voir `poserMode`, plus bas).
// Appeler `veilleEstompage.poserMode` à côté ferait deux chemins pour un seul
// geste — mot pour mot l'argument que `majSeuilSocle` écrit déjà pour `maj`.

/** L'instantané qu'on garde pour la comparaison — les champs surveillés, seuls. */
function instantaneHabillage(habillage) {
  const src = habillage || {}
  const out = {}
  for (const champ of CHAMPS_HABILLAGE) out[champ] = src[champ]
  return out
}

/**
 * Les champs de la FORME du bloc — Tâche P6.
 *
 * ⚠️ **`half` EN EST, ET CE N'EST PAS DÉCORATIF** : c'est lui qui normalise
 * `corner`, donc deux valeurs de `half` pour un même `corner` sont deux
 * silhouettes. La fenêtre continue le déplace (`uSlabHalf` vaut 28 hors damier,
 * autre chose dedans) — c'est déjà la raison pour laquelle `fxDemiBloc` figure
 * dans `CHAMPS_HABILLAGE`.
 */
export const CHAMPS_FORME = Object.freeze(['half', 'corner', 'expo', 'fractionProfondeur'])

/**
 * La forme du bloc, aplatie depuis le contexte — Tâche P6.
 *
 * ⚠️ **ELLE VIT DANS DEUX SOUS-OBJETS ET C'EST UNE SEULE GRANDEUR** : `half`,
 * `corner` et `expo` vont à `poserCrop` (la silhouette vue de dessus),
 * `fractionProfondeur` va à `construireParoisCrop` (l'épaisseur). Les surveiller
 * séparément ferait deux veilles pour un seul geste — et un bloc dont le contour
 * s'arrondit sans que son flanc suive.
 */
export function formeDuCrop(ctx) {
  const f = ctx?.forme || {}
  const p = ctx?.parois || {}
  return { half: f.half, corner: f.corner, expo: f.expo, fractionProfondeur: p.fractionProfondeur }
}

/**
 * La forme à poser diffère-t-elle de celle qui est posée ?
 *
 * ⚠️ **MÊME CONTRAT QU'`habillageDifferent`, `Object.is` COMPRIS**, et pour la
 * même raison : un `NaN` d'arrondi ne doit pas se comparer égal à lui-même.
 */
export function formeDifferente(pose, voulu) {
  if (!pose) return true
  const v = voulu || {}
  for (const champ of CHAMPS_FORME) {
    if (!Object.is(pose[champ], v[champ])) return true
  }
  return false
}

// Un maillon rend `{ refus }` — `null` s'il a pris, une chaîne sinon — et,
// pour la mer seule, une `promesse` dont le refus n'arrive que plus tard.
const POSEURS = {
  // ══════════ LA FORME DU BLOC — Tâche P6 ═══════════════════════════════════
  //
  // ⛔ **`poserCrop` PORTE `corner`, `expo` ET `half` DEPUIS LA TÂCHE A, ET
  // AUCUN APPELANT NE LES A JAMAIS PASSÉS.** Le crop tournait donc sur
  // `corner = 0`, `expo = 2` — un carré à angles VIFS — pendant que le socle vit
  // sur `params.slabCorner = 0,04` et `params.slabCornerSmoothing = 0,6`,
  // c'est-à-dire un rayon d'arrondi de **8 % du demi-côté** et un exposant de
  // squircle de **4,4**. Relevé le 2026-08-22 au même instant dans la même page :
  // `uCropCoin = 0` et `uCropCoinN = 2` contre `uSlabCorner = 2,24`,
  // `uSlabCornerN = 4,4`, `uSlabHalf = 28`. **C'est la SILHOUETTE du bloc**, et
  // `parois-crop.js` §4 le dit déjà : `cornerR` s'y traduit par `forme.coin`,
  // « le rayon NORMALISÉ que `poserCrop` pose déjà ».
  //
  // ⚠️ **LE COIN ARRIVE EN UNITÉS DU SOCLE ET SE NORMALISE DANS `poserCrop`** —
  // par `coinNormalise(corner, half)`, la SEULE conversion, celle qui existait
  // déjà. Une normalisation faite ici en serait une seconde.
  crop({ globe, centre, zoom, tuilesParBloc, forme }) {
    const rep = globe.poserCrop({ centre, zoom, tuilesParBloc, ...(forme || {}) })
    return { refus: rep ? null : 'crop' }
  },
  fond({ globe, fond }) {
    // ⚠️ **UN GLOBE SANS `poserFondCrop` N'EST PAS UNE PANNE.** Ce module est
    // vérifiable sous node contre un globe de papier (`test/crop-branche.test.js`), et
    // il a toujours accepté les faux globes qui portent les méthodes qu'ils
    // exercent. Un fond absent laisse la surface du dépôt — c'est exactement le
    // comportement d'avant la Tâche J bis, et il ne se signale pas par un refus
    // qui bloquerait la reprise pour toujours.
    if (typeof globe.poserFondCrop !== 'function') return { refus: null }
    const r = globe.poserFondCrop(fond || {})
    // ⚠️ **`neuf` DIT QUE LA SURFACE A CHANGÉ, ET LA REPRISE EN A BESOIN** — voir
    // `LECTEURS_DU_FOND`. `rebati` compte les maillages reconstruits : zéro veut
    // dire « le même fond qu'avant », donc rien à rejouer derrière.
    return { refus: r ? (r.refus ?? null) : 'crop', neuf: !!(r && r.rebati > 0) }
  },
  parois({ globe, parois }) {
    const r = globe.construireParoisCrop(parois || undefined)
    // ⚠️ `null` SIGNIFIE « PAS DE CROP », et c'est un refus comme un autre —
    // `construireParoisCrop` sort à sa première ligne quand `_crop` est nul.
    return { refus: r ? (r.refus ?? null) : 'crop' }
  },
  habillage({ globe, habillage }) {
    globe.poserHabillage(habillage || {})
    // ⚠️ **L'HABILLAGE NE REFUSE JAMAIS**, et ce n'est pas un oubli : il ne
    // mesure rien, il recopie quatre postes du socle. Ce qui manque (une texture
    // pas encore là) se voit par un uniforme éteint, pas par un refus.
    return { refus: null }
  },
  rampe({ globe, rampe }) {
    const r = globe.poserRampe(rampe || undefined)
    return { refus: r ? (r.refus ?? null) : 'crop' }
  },
  mer({ globe, mer }) {
    // ⚠️ **LA SEULE ASYNCHRONE DE LA CHAÎNE** : `poserMer` importe `ocean.js`
    // dynamiquement (three n'est pas résoluble sous node par une importation
    // statique). Son refus n'existe donc PAS encore quand la chaîne rend la
    // main — une reprise qui ne lirait que le retour synchrone laisserait une
    // mer absente pour toujours.
    return { refus: null, promesse: Promise.resolve(globe.poserMer(mer || {})) }
  },
}

/**
 * Pose la chaîne entière sur un globe : découpe, parois, habillage, rampe, mer.
 *
 * ⚠️ **ELLE NE TOURNE PAS PAR IMAGE.** Les parois balaient le contour, la rampe
 * `pas²` points, la mer cuit un champ de 385² : décision 5 du plan précédent,
 * « la gravure ne s'écrit qu'à l'arrêt ». C'est la veille qui décide quand.
 *
 * @param {object} arg
 * @param {object} arg.globe le globe (`src/globe.js`), ou n'importe quoi qui en
 *   porte les six méthodes — c'est ce qui rend ce module vérifiable sous node
 * @param {{lat:number, lon:number}} arg.centre le centre du BLOC, pas le lieu
 *   demandé : voir `latLonOrigineBloc()` dans `main.js`
 * @param {number} arg.zoom fixe la LARGEUR du crop, pas sa finesse
 * @param {number} arg.tuilesParBloc
 * @param {object} [arg.habillage] ce que `poserHabillage` attend
 * @param {object} [arg.rampe] ce que `poserRampe` attend
 * @param {object} [arg.parois] ce que `construireParoisCrop` attend
 * @param {object} [arg.mer] ce que `poserMer` attend
 * @returns {{refus: string[], mer: Promise<*>}}
 */
export function poserChaineCrop(arg = {}) {
  const { globe } = arg
  if (!globe || typeof globe.poserCrop !== 'function') {
    throw new TypeError('poserChaineCrop : il faut un globe — une chaîne muette est une chaîne absente')
  }
  const refus = []
  let mer = Promise.resolve(null)
  for (const nom of MAILLONS) {
    const r = POSEURS[nom](arg)
    if (r.refus) refus.push(nom)
    if (r.promesse) mer = r.promesse
  }
  return { refus, mer }
}

/**
 * L'automate qui tient le crop d'une image à l'autre.
 *
 * ⚠️ **IL A LA MÊME FORME QUE `creerVeilleSocle`, ET C'EST VOULU** : deux
 * automates qui décident de la même chose sur la même altitude doivent se lire
 * l'un à côté de l'autre. Ce qu'il a en plus est le §3 (la reprise) et la
 * SIGNATURE du lieu : un crop figé au premier bloc chargé serait le défaut que
 * `recadrerFenetre` a déjà payé une fois (Tâche 6 septies).
 *
 * @param {object} arg
 * @param {object|(() => object)} arg.globe le globe, ou une fonction qui le rend
 *   — `main.js` l'assigne tard, et un `undefined` figé ne se rattraperait pas
 * @param {() => (object|null)} arg.contexte ce que la chaîne doit recevoir à
 *   cette image ; `null` quand il n'y a pas encore de bloc, et **on n'invente
 *   alors aucun lieu**
 * @param {{maj:Function, poserMode:Function}|null} [arg.estompage] la veille de
 *   la Tâche G. ⚠️ **UN SEUL POINT D'ALIMENTATION** : un crop qui naîtrait sur
 *   une altitude et une planète qui s'effacerait sur une autre se contrediraient
 *   à l'écran.
 * @param {((ctx:object) => void)|null} [arg.reserverHauteurs] ⚠️ **SANS LUI, LES
 *   PAROIS ET LA RAMPE REFUSENT POUR TOUJOURS, ET C'EST MESURÉ.** Relevé à
 *   l'écran le 2026-08-21 (La Réunion z12, 600 tuiles de globe en cache) :
 *   `globe.tuilesAvecHauteurs().length` = **0**, donc `couverture` = **0**, donc
 *   `construireParoisCrop` et `poserRampe` rendent `refus: 'couverture'` à
 *   chaque tentative. La cause n'est pas un manque de réseau : `_buildMesh`
 *   RELÂCHE `t.heights` dès le maillage bâti (Tâche 4 sexies), **sauf pour les
 *   clés réservées par `gardeHauteurs`**. Quelqu'un doit donc réserver l'emprise
 *   du crop — `demanderEmprise` du flux —, et ce quelqu'un n'est pas ce module,
 *   qui est pur. Appelé à la pose et à chaque reprise, jamais par image.
 * @param {(() => void)|null} [arg.masquerSocle] ⚠️ **CE QUI FAIT QU'IL N'Y A PLUS
 *   QU'UNE TERRE, ET SANS LUI IL Y EN A DEUX.** Le bloc plat est opaque et se
 *   dessine APRÈS la passe de fond : laissé allumé, il recouvre le crop en
 *   entier et l'écran est exactement celui d'avant le chantier — c'est ce que
 *   l'Étape 6 a vu à la première image, `terrain.mesh.visible === true` avec
 *   `uCropOn === 1`. Appelé **une fois par entrée en surface**, jamais par
 *   image : la liste des calques qu'il touche en compte quatorze.
 * @param {{maj:Function, oublier:Function}|null} [arg.repos] la veille du repos
 *   (Tâche N, `veille-repos.js`). ⚠️ **ELLE EST NOURRIE ICI ET NULLE PART
 *   AILLEURS** : les automates qui décident à la même image doivent décider sur
 *   la même IMAGE — pas, comme ce commentaire l'a soutenu jusqu'à la Tâche R1,
 *   sur le même NOMBRE. Elle reçoit le second argument de `maj`, la DISTANCE
 *   caméra↔cible, et non l'altitude : voir le §1 de `veille-repos.js`, qui
 *   porte la mesure. Absente, le comportement est celui d'avant la Tâche N, au
 *   bit près — les alentours restent dessinés au repos.
 * @param {number} [arg.periodeReprise] en IMAGES — voir le §3
 * @param {boolean} [arg.cropAuDepart] l'état de l'application au chargement
 * @param {boolean} [arg.modeSurfaceAuDepart]
 */
export function creerVeilleCrop({
  globe,
  contexte,
  estompage = null,
  repos = null,
  masquerSocle = null,
  reserverHauteurs = null,
  periodeReprise = 30,
  cropAuDepart = false,
  modeSurfaceAuDepart = true,
  // ══════════ LA MER ET LES EFFETS N'EXISTENT QU'EN MODE CROP — PF3 ═════════
  //
  // > **Adrien :** « La mer et les effets n'apparaissent qu'en mode crop. »
  //
  // `surBascule(pose)` est appelé UNE fois à la naissance (`true`) et UNE fois
  // à la mort (`false`) du crop — jamais à un déménagement, jamais sur une
  // image stable. C'est la porte unique par laquelle `main.js` pose l'état du
  // compositeur (occlusion ambiante, grain) : un prédicat, une fonction, pas
  // d'interrupteur par image. La mer, elle, est déjà un maillon de la chaîne
  // (`poserMer` / `retirerMer`) : elle naît et meurt avec le crop sans rien de
  // plus.
  surBascule = null,
} = {}) {
  if (!globe) {
    throw new TypeError('creerVeilleCrop : il faut un `globe` (ou une fonction qui le rend)')
  }
  if (typeof contexte !== 'function') {
    throw new TypeError('creerVeilleCrop : `contexte` est obligatoire — sans lieu, le crop tomberait au milieu de l’Atlantique')
  }
  const lireGlobe = typeof globe === 'function' ? globe : () => globe

  let pose = !!cropAuDepart
  let modeSurface = !!modeSurfaceAuDepart
  // ══════════ D21 ① — L'INTENTION DE SORTIE ════════════════════════════════
  //
  // > **Adrien, 2026-09-04 :** *« Je voudrais que lorsqu'on passe en mode crop,
  // > on ne puisse plus revenir en mode non crop uniquement par l'altitude. »*
  //
  // ⚠️ **C'EST UN VERROU, PAS UN SEUIL.** Tant qu'il est faux, `socleVisible`
  // ne peut PAS retirer le crop, quelle que soit l'altitude : l'inclinaison, le
  // cap, les boutons de caméra, le redressement automatique de D16 ter, le vol
  // de présentation et le recalage peuvent tous faire monter `camera.position.y`
  // au-dessus de `SEUIL_MORT_M` sans conséquence.
  //
  // ⚠️ **IL EST ARMÉ PAR UN GESTE, ET DÉSARMÉ PAR TROIS ÉVÉNEMENTS** :
  //   · un dézoom (molette ou clic droit maintenu) l'arme (`armerSortie`) ;
  //   · un zoom AVANT le désarme (`desarmerSortie`) — sinon un aller-retour
  //     molette laisserait une mine amorcée sous le crop ;
  //   · la mort du crop le désarme (l'intention est consommée) ;
  //   · la naissance du crop le désarme (on vient d'entrer : rien n'est armé).
  //
  // ⛔ **LE BOUTON MONDE N'A PAS BESOIN DE LUI** : il appelle `enterOrbit`, donc
  // `poserMode(false)`, qui retire le crop par le chemin du MODE — un chemin qui
  // n'a jamais dépendu de l'altitude. C'est la troisième sortie de D21, et elle
  // était déjà une intention.
  let sortieArmee = false
  let signature = null
  let refus = []
  let bascules = 0
  let depuisPose = 0
  // ⚠️ **CE QU'ON A POSÉ, PAS CE QU'ON A VU** — voir `habillageDifferent`.
  let habillagePose = null
  let rafraichissements = 0
  // ⚠️ **LA FORME, SURVEILLÉE À PART — Tâche P6.** Elle n'est PAS dans la
  // signature de lieu, et c'est une décision de coût : `signature` déclenche
  // `poserTout`, donc un champ de mer de 385² et un balayage de rampe de 128², à
  // CHAQUE image d'un glissement de la tirette d'arrondi. Ici on ne rejoue que
  // les DEUX maillons qui lisent la forme.
  let formePosee = null
  let reformages = 0
  // ⚠️ **LES PROMESSES EN VOL SONT GARDÉES**, et pas par confort : sans elles un
  // test ne peut pas attendre le refus de la mer, et rien ne l'obligerait à
  // exister. C'est aussi ce qui permet à `retirerCrop` de ne pas se faire
  // écraser par une mer partie avant lui.
  let enVol = Promise.resolve()
  let jeton = 0
  // ⚠️ **UNE FOIS PAR ENTRÉE EN SURFACE, ET LE « UNE FOIS » COMPTE.** La liste
  // de calques que `masquerSocle` rappelle en touche quatorze : la repasser à
  // chaque image serait exactement ce que la garde de `creerVeilleSocle` évite.
  let socleMasque = false
  // ══════════ LE REPOS RELAYÉ — Tâche N ══════════════════════════════════════
  //
  // ⚠️ **DEUX DESTINATAIRES, UN SEUL ÉCRIVAIN.** Le repos commande deux choses
  // qui doivent être vraies ENSEMBLE ou fausses ensemble : l'estompage plein
  // (`poserRepos`, qui efface les alentours à l'écran) et le parcours réduit du
  // quadtree (`globe.poserCropSeul`, qui cesse de les calculer). Séparés, on
  // aurait un dessin sans coût ou un coût sans dessin — les deux moitiés du
  // défaut que cette tâche répare.
  //
  // ⚠️ **ET LE `ET` AVEC `pose` N'EST PAS UNE PRUDENCE, C'EST LA LOI.** Sans
  // crop, l'estompage plein efface la planète et ne met rien à la place : un
  // écran vide. C'est ce qui interdit à `estompage-terre.js` de porter cette
  // règle lui-même — il ne sait pas s'il y a une découpe.
  let auRepos = false
  let reposApplique = false
  // ══════════ D21 ② / D16 ter — L'ARRIVÉE AU BLOC, SÉPARÉE DE LA NAISSANCE ══
  //
  // ⚠️ **MESURÉ, ET C'EST LE DÉPARTAGE QUE LE BRIEF C1 DEMANDE.** `repos` (donc
  // `arriveeSurLeBloc` de `main.js`, donc `modes.js:1996`, donc la bascule de
  // trois quarts) valait « crop posé ET vue au repos ». Depuis que le crop naît
  // à 600 km, ce seul ET inclinerait la caméra en vue CONTINENTALE — ce que
  // D16 ter interdit mot pour mot (« pas avant »). On ajoute donc un second
  // automate, sur `SEUIL_BLOC_M` / `SEUIL_BLOC_MORT_M`, c'est-à-dire sur les
  // DEUX SEUILS D'AVANT D21, au bit près : la bascule tombe exactement là où
  // elle tombait hier.
  let auBloc = false
  let basculesRepos = 0

  function appliquerRepos(g) {
    // ⛔ **IL Y AVAIT ICI UN `modeSurface &&`, ET C'ÉTAIT DU CODE MORT —
    // TROUVÉ PAR LA CAMPAGNE DE MUTATION, PAS PAR LA RELECTURE.** Le
    // raisonnement écrit à côté était plausible (« l'orbite prime, comme pour
    // l'estompage »), et il était sans effet : **hors surface, `pose` est
    // TOUJOURS faux**. `poserMode(false)` appelle `retirer`, qui le remet à
    // faux ; et `decider` sort sur `if (!modeSurface) return pose` sans jamais
    // le lever. Aucun chemin n'atteint donc ce relais avec `modeSurface` faux
    // et `pose` vrai — une mutation qui retirait le terme SURVIVAIT. C'est la
    // définition du code mort que ce chantier a déjà trouvé cinq fois.
    // **Retiré plutôt que testé à vide**, exactement comme la garde
    // `if (nom === 'crop') continue` de `reprendre` et le `habillagePose = null`
    // de `retirer`. ⚠️ **L'INVARIANT QUI LE REMPLACE EST ÉCRIT ICI** : hors
    // surface, il n'y a pas de crop, donc rien à relayer.
    const voulu = !!(pose && auRepos)
    if (voulu === reposApplique) return reposApplique
    reposApplique = voulu
    basculesRepos++
    estompage?.poserRepos(voulu)
    // ⚠️ **UN GLOBE SANS `poserCropSeul` N'EST PAS UNE PANNE** — même contrat
    // que `poserFondCrop` (Tâche J bis) : ce module se vérifie sous node contre
    // un globe de papier, qui ne porte que les méthodes qu'il exerce.
    g?.poserCropSeul?.(voulu)
    return reposApplique
  }

  function suivreMer(promesse, monJeton) {
    enVol = promesse.then((r) => {
      if (monJeton !== jeton) return // une pose plus récente a pris la main
      const echoue = !r || !!r.refus
      const dedans = refus.includes('mer')
      if (echoue && !dedans) refus = [...refus, 'mer']
      else if (!echoue && dedans) refus = refus.filter((n) => n !== 'mer')
    }, () => {})
    return enVol
  }

  function poserTout(g, ctx) {
    // ⚠️ **AVANT LA CHAÎNE, PAS APRÈS.** `_buildMesh` relâche les hauteurs des
    // tuiles NON réservées : une tuile bâtie avant la réservation les a déjà
    // perdues, et `demanderEmprise` doit la redemander. L'ordre n'est pas
    // cosmétique — c'est celui que `flux-terrain.js` écrit déjà pour le socle.
    reserverHauteurs?.(ctx)
    jeton++
    const r = poserChaineCrop({ globe: g, ...ctx })
    refus = r.refus
    depuisPose = 0
    habillagePose = instantaneHabillage(ctx.habillage)
    formePosee = formeDuCrop(ctx)
    suivreMer(r.mer, jeton)
  }

  /**
   * ⚠️ **LE SEUL MAILLON QU'ON SURVEILLE PAR IMAGE, ET IL NE COÛTE QUE DES
   * UNIFORMES.** Voir le pavé « LE RAFRAÎCHISSEMENT DE L'HABILLAGE ».
   */
  function rafraichirHabillage(g, ctx) {
    if (!habillageDifferent(habillagePose, ctx.habillage)) return false
    POSEURS.habillage({ globe: g, ...ctx })
    habillagePose = instantaneHabillage(ctx.habillage)
    rafraichissements++
    return true
  }

  /**
   * LA FORME DU BLOC, SURVEILLÉE PAR IMAGE — Tâche P6.
   *
   * ⚠️ **DEUX MAILLONS, PAS SIX, ET LE CHOIX EST CHIFFRÉ.** Les tirettes
   * « arrondi » et « douceur des coins » du socle rebâtissent SES parois à
   * chaque image de glissement ; ici, rejouer la chaîne entière coûterait EN
   * PLUS un champ de mer de 385² et un balayage de rampe de 128² par image.
   *
   * ⚠️ **ET LA MER SUIT SANS ÊTRE REJOUÉE** : son matériau partage `uCropCoin`
   * et `uCropCoinN` avec les tuiles (`poserMer` les prend sur `this.uniforms`),
   * donc `poserCrop` seul déplace aussi le bord de la nappe. C'est la mécanique
   * d'uniformes partagés que la Tâche A a posée, pas un heureux hasard.
   *
   * ⚠️ **LA RAMPE, ELLE, N'EST PAS REJOUÉE, ET JE LE DIS** : `mesurerRelief`
   * échantillonne la superellipse, donc son amplitude bouge d'un cheveu quand
   * l'arrondi change. Elle se remesure au prochain déplacement. Un balayage de
   * `pas²` points par image de glissement n'en vaut pas le prix.
   */
  function rafraichirForme(g, ctx) {
    if (!formeDifferente(formePosee, formeDuCrop(ctx))) return false
    const r = POSEURS.crop({ globe: g, ...ctx })
    // ⚠️ **ET LES PAROIS AVEC, SINON LE BLOC EST À DEUX FORMES** : la surface
    // serait arrondie et son flanc resterait carré — pire que les deux carrés.
    const p = POSEURS.parois({ globe: g, ...ctx })
    formePosee = formeDuCrop(ctx)
    reformages++
    // un refus des parois retourne dans la file de reprise, comme partout
    if (p.refus && !refus.includes('parois')) refus.push('parois')
    return !r.refus
  }

  // ⚠️ **ELLE NE REJOUE QUE CE QUI A REFUSÉ, ET JAMAIS LA DÉCOUPE.** Rejouer la
  // chaîne entière pour rattraper une paroi coûterait le champ de mer (385²) et
  // le balayage de rampe (128²) à chaque tentative.
  function reprendre(g, ctx) {
    depuisPose = 0
    reserverHauteurs?.(ctx)
    // ⚠️ **IL Y AVAIT ICI UNE GARDE `if (nom === 'crop') continue`, ET C'ÉTAIT DU
    // CODE MORT — TROUVÉ PAR LA CAMPAGNE DE MUTATION, PAS PAR LA RELECTURE.** La
    // muter ne faisait rougir aucun test, et pour cause : `refus` ne peut PAS
    // contenir `'crop'`. `poserCrop` rend toujours son repère, et les trois
    // maillons qui refusent faute de découpe sont poussés sous LEUR nom, pas sous
    // le sien. Une garde qu'aucun chemin n'atteint est une garde qui ment sur ce
    // qu'elle protège ; retirée plutôt que testée à vide. **Si la découpe venait
    // un jour à refuser, la rejouer serait de toute façon le bon geste.**
    const restant = []
    // ⚠️ **LE FOND ENTRAÎNE SES LECTEURS — Tâche J bis, voir `LECTEURS_DU_FOND`.**
    let fondNeuf = false
    for (const nom of refus) {
      const r = POSEURS[nom]({ globe: g, ...ctx })
      if (nom === 'fond' && !r.refus && r.neuf) fondNeuf = true
      if (nom === 'mer') { const j = ++jeton; suivreMer(r.promesse, j); continue }
      if (r.refus) restant.push(nom)
    }
    if (fondNeuf) {
      for (const nom of LECTEURS_DU_FOND) {
        // ⚠️ **CELUI QUI VIENT D'ÊTRE REJOUÉ NE L'EST PAS DEUX FOIS** : le
        // balayage de la rampe fait `pas²` points et le contour des parois plus
        // de mille — les rejouer pour rien serait payer deux fois la reprise.
        if (refus.includes(nom)) continue
        const r = POSEURS[nom]({ globe: g, ...ctx })
        if (r.refus) restant.push(nom)
      }
    }
    refus = restant
  }

  function retirer(g) {
    jeton++
    g?.retirerCrop()
    pose = false
    signature = null
    refus = []
    // ⚠️ **L'INTENTION EST CONSOMMÉE.** La laisser armée ferait mourir le crop
    // suivant sur son premier soubresaut d'altitude, sans nouveau geste.
    sortieArmee = false
    // ⛔ **IL Y AVAIT ICI UN `habillagePose = null`, ET C'ÉTAIT DU CODE MORT —
    // TROUVÉ PAR LA CAMPAGNE DE MUTATION, PAS PAR LA RELECTURE.** Le
    // raisonnement écrit à côté était plausible (« `retirerCrop` appelle
    // `retirerHabillage`, donc ce qui est posé n'est plus ce qu'on croyait »), et
    // il était sans effet : **`pose` retombe à faux et `signature` à `null`, donc
    // la première image qui repose passe forcément par `poserTout`**, lequel
    // écrit l'instantané avant que `rafraichirHabillage` ne puisse le lire.
    // Aucun chemin n'atteint le rafraîchissement avec un instantané périmé. Une
    // mutation qui retirait la ligne SURVIVAIT — c'est la définition du code
    // mort que ce chantier a déjà trouvé quatre fois. **Retirée plutôt que
    // testée à vide**, exactement comme la garde `if (nom === 'crop') continue`
    // de `reprendre`, dix lignes plus bas.
    bascules++
    // ⚠️ **APRÈS `retirerCrop`** : quand le compositeur relit le régime, la mer
    // est déjà partie et `pose` est déjà faux — l'état qu'il lit est l'état final.
    surBascule?.(false)
  }

  // ⚠️ **LE CORPS DE `maj` VIT ICI POUR QU'IL N'Y AIT QU'UN SEUL POINT DE
  // SORTIE — Tâche N.** Il en compte six (orbite, globe absent, seuil, contexte
  // absent, pose, régime établi), et le repos doit être relayé sur TOUS : un
  // `appliquerRepos` recopié six fois serait six branchements à tenir d'accord,
  // c'est-à-dire la classe d'erreur que ce fichier existe pour fermer.
  function decider(altitudeEllipsoideM, distanceCibleM) {
      // ⚠️ **L'ESTOMPAGE EST NOURRI MÊME EN ORBITE**, et le §6 de
      // `estompage-terre.js` dit pourquoi : sa veille FORCE zéro hors surface,
      // là où celle du socle GÈLE. La priver de l'image la laisserait sur la
      // dernière valeur de surface — une planète effacée au moment précis où
      // elle redevient le sujet.
      estompage?.maj(altitudeEllipsoideM)
      if (!modeSurface) return pose
      // ⚠️ **APRÈS LA GARDE DE MODE, COMME LE SOCLE.** En orbite
      // `altitudeCadrageM()` rend un résidu (`veille-socle.js` §2) : le laisser
      // décider ferait basculer la vue de trois quarts sur du bruit.
      auBloc = auBlocSeuil({ altitudeEllipsoideM, auBlocAvant: auBloc })
      // ⚠️ **LA VEILLE DU REPOS NE REÇOIT PAS L'ALTITUDE, ELLE REÇOIT LA
      // DISTANCE — Tâche R1, ET C'EST MESURÉ.** Elle a reçu l'altitude jusqu'au
      // 2026-08-23, et un simple cliquer-glisser d'inclinaison la faisait
      // tomber de 17 624 m à 2 861 m à distance rigoureusement constante :
      // `auRepos` basculait, et la planète entière se rallumait autour du crop
      // sur un geste qui ne change aucune échelle. Le §1 de `veille-repos.js`
      // porte la mesure et le raisonnement.
      //
      // ⚠️ **LES DEUX GRANDEURS ARRIVENT ENSEMBLE, ET CE N'EST PAS UN CONFORT** :
      // l'estompage ci-dessus et le repos ici décident sur la MÊME image. Deux
      // appels séparés depuis `main.js` seraient deux images pour un geste, et
      // c'est la classe d'erreur que ce fichier existe pour fermer.
      //
      // ⚠️ **LA VEILLE DU REPOS N'EST NOURRIE QU'EN SURFACE, ET C'EST MESURÉ.**
      // En orbite la caméra n'a plus de cible au sol : `controls.target` y est
      // le centre de la planète et la distance devient un rayon orbital, d'une
      // toute autre échelle. Lui donner cette image ferait un écart énorme
      // entre deux régimes, donc un « mouvement » à chaque aller-retour
      // d'orbite. `poserMode` lui fait oublier sa référence, dans les deux sens.
      auRepos = repos ? repos.maj(distanceCibleM) : false
      // ⚠️ **LE BLOC PLAT PART AVANT TOUTE DÉCISION D'ALTITUDE, ET C'EST VOULU.**
      // Sous ce drapeau il n'a plus lieu d'exister à aucune altitude : le
      // laisser vivre au-dessus du seuil remettrait un socle devant la planète
      // entière — la capture d'Adrien à Z5, remise au goût du jour.
      if (!socleMasque) { socleMasque = true; masquerSocle?.() }
      const g = lireGlobe()
      if (!g) return pose
      // ⚡ **D21 ① — LA MORT DEMANDE UNE INTENTION.** Sans `sortieArmee`, la
      // branche `!voulu` ci-dessous est INATTEIGNABLE depuis un crop posé :
      // c'est toute la règle, en un argument.
      const voulu = socleVisible({ altitudeEllipsoideM, visibleAvant: pose, sortieArmee })
      if (!voulu) {
        if (pose) retirer(g)
        return false
      }
      const ctx = contexte()
      // pas encore de bloc : on n'invente pas un lieu, on attend la prochaine image
      if (!ctx || !ctx.centre) return pose
      const s = `${ctx.centre.lat}|${ctx.centre.lon}|${ctx.zoom}|${ctx.tuilesParBloc}`
      if (!pose || s !== signature) {
        // ⚠️ **UN DÉMÉNAGEMENT N'EST PAS UNE NAISSANCE** : le compteur de
        // bascules sert à mesurer le clignotement, pas les déplacements.
        const naissance = !pose
        if (naissance) bascules++
        // on vient d'entrer : aucune intention de sortie ne traîne
        if (naissance) sortieArmee = false
        pose = true
        signature = s
        poserTout(g, ctx)
        // ⚠️ **APRÈS `poserTout`, ET SEULEMENT À LA NAISSANCE** : un déménagement
        // rejoue la chaîne, pas le régime — l'état du compositeur n'a pas changé.
        if (naissance) surBascule?.(true)
        return true
      }
      depuisPose++
      if (refus.length && depuisPose >= periodeReprise) reprendre(g, ctx)
      // ⚠️ **APRÈS LA REPRISE, ET PAS AVANT.** La reprise peut reposer
      // l'habillage elle-même (s'il figurait dans les refus, ce qui n'arrive
      // pas aujourd'hui mais reste ouvert) ; le rafraîchissement doit juger sur
      // l'état FINAL de l'image, sinon il reposerait deux fois.
      // ⚠️ **LA FORME AVANT L'HABILLAGE, ET L'ORDRE COMPTE** : `poserHabillage`
      // dérive sa marge de côte du crop POSÉ (`margeCoteDuCrop(this._crop)`).
      // L'inverse la calculerait sur le repère d'avant le reformage.
      rafraichirForme(g, ctx)
      rafraichirHabillage(g, ctx)
      return true
  }

  return {
    /**
     * Une image, et DEUX grandeurs — voir le §1 de `veille-repos.js`.
     *
     * `altitudeEllipsoideM` est l'altitude géométrique de la caméra au-dessus
     * de l'ellipsoïde — règle R1, celle que `loi-altitude.js` porte SANS
     * `meanM`. Elle décide de la NAISSANCE du crop et nourrit l'estompage : ces
     * deux-là demandent « à quelle distance du sol suis-je ». Une altitude non
     * finie conserve l'état, même contrat que `socleVisible`.
     *
     * `distanceCibleM` est la distance de la caméra à `controls.target`. Elle
     * nourrit la veille du REPOS, et elle seule : celle-ci demande
     * « l'utilisateur change-t-il d'ÉCHELLE », ce qui n'est pas la même
     * question. ⚠️ **Son unité est indifférente** — l'écart y est un rapport
     * (`|Δ ln|`), donc unités du monde ou mètres au sol donnent le même nombre.
     * Absente ou non finie, la veille du repos CONSERVE son état : le crop
     * reste seul, ce qui est la panne la moins mauvaise (voir `veille-repos.js`).
     */
    maj(altitudeEllipsoideM, distanceCibleM) {
      const r = decider(altitudeEllipsoideM, distanceCibleM)
      // ⚠️ **APRÈS LA DÉCISION, JAMAIS AVANT.** `appliquerRepos` lit `pose` :
      // évalué en tête, il jugerait sur l'image d'avant et le crop naîtrait
      // toujours avec une image d'alentours dessinés.
      appliquerRepos(lireGlobe())
      return r
    },

    /**
     * Le mode de `modes.js`. ⚠️ Il PRIME : en orbite la planète est le sujet,
     * et une découpe dedans n'a plus aucun sens.
     */
    poserMode(surface) {
      modeSurface = !!surface
      estompage?.poserMode(surface)
      // ⚠️ **L'ORBITE REND SES CALQUES AU SOCLE**, et `modes.js` les rallume en
      // revenant : le masquage se redemande donc à chaque entrée en surface.
      if (!modeSurface) socleMasque = false
      if (!modeSurface && pose) retirer(lireGlobe())
      // ⚠️ **TOUT CHANGEMENT DE MODE FAIT OUBLIER L'ALTITUDE DE RÉFÉRENCE —
      // Tâche N, ET DANS LES DEUX SENS.** En orbite, `altitudeCadrageM()`
      // divise un `camera.position.y` orbital par l'échelle du DERNIER bloc
      // chargé : ce n'est pas une altitude, c'est un résidu
      // (`veille-socle.js`, §2). Comparer une altitude de surface à un résidu —
      // ou l'inverse — déclarerait un mouvement là où la caméra est posée. Ne
      // l'oublier qu'à l'aller laisserait le retour se faire sur la dernière
      // valeur d'orbite : c'est la MÊME faute, prise par l'autre bout.
      repos?.oublier?.()
      appliquerRepos(lireGlobe())
      return pose
    },

    /** Le crop est-il posé ? */
    get pose() { return pose },
    /** Le repos est-il RELAYÉ (donc : crop posé, en surface) — Tâche N. */
    get repos() { return reposApplique },
    /**
     * ⚡ **L'ARRIVÉE AU BLOC — D16 ter, et SEULEMENT elle.** Crop posé, vue au
     * repos, **et le socle occupe encore 60 % de la hauteur de l'image**. C'est
     * ce que `main.js` doit donner à `arriveeSurLeBloc`, pas `repos` tout seul :
     * depuis D21 le crop naît dix-huit fois plus haut que le bloc.
     */
    get arriveeBloc() { return reposApplique && auBloc },
    /** L'automate d'altitude de l'arrivée au bloc, seul — pour les sondes. */
    get auBloc() { return auBloc },
    /** D21 ① — l'intention de sortie est-elle armée ? */
    get sortieArmee() { return sortieArmee },
    /**
     * ⚡ **D21 ① — ARMER LA SORTIE.** Le seul moyen, avec le bouton monde, de
     * faire mourir le crop. Appelé sur un **dézoom à la molette** et sur un
     * **dézoom au clic droit maintenu** (`main.js`). ⚠️ N'a aucun effet sur la
     * naissance : D21 dit « la naissance garde son seuil ».
     */
    armerSortie() { sortieArmee = true; return sortieArmee },
    /**
     * ⚡ **ET LE DÉSARMEMENT, SUR UN ZOOM AVANT.** Le critère de C1 l'exige
     * ligne par ligne : « dans le crop, zoom avant (molette ou clic droit) → le
     * crop vit ». Sans ça, un aller-retour molette laisserait une mine amorcée.
     */
    desarmerSortie() { sortieArmee = false; return sortieArmee },
    /** Combien de fois le repos relayé a basculé : le compteur de battement. */
    get basculesRepos() { return basculesRepos },
    /** Les maillons qui ont refusé et que la reprise redemande. */
    get refus() { return [...refus] },
    /** Combien de fois le crop est né ou mort depuis le chargement. */
    get bascules() { return bascules },
    /** Combien de fois l'habillage a été RAFRAÎCHI hors pose — Tâche K ter. */
    get rafraichissements() { return rafraichissements },
    /** Combien de fois la FORME a été rejouée hors pose — Tâche P6. */
    get reformages() { return reformages },
    /** Le lieu sur lequel la chaîne est posée — pour les sondes et les bancs. */
    get signature() { return signature },
    /** La dernière mer partie, pour qui doit l'attendre (les tests, les bancs). */
    enVol() { return enVol },
  }
}
