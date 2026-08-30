# SDD ledger — plan: docs/superpowers/plans/2026-08-22-globe-studio.md

Successeur de `.superpowers/sdd/2026-08-21-terre-unique/progress.md` (tâches A–I, structure
livrée). **Ce plan-ci livre le RENDU et le STUDIO.**

## Les consignes qui gouvernent (Adrien, 2026-08-21 nuit)

- **D1** zéro niveau, zéro saut, **et fondu entre niveaux** · **D2** le bloc grandit en
  continu depuis la sphère (**`seuil-socle.js` disparaît**) · **D3** toutes les options du
  studio conservées et adaptées, **vérifiées une par une** · **D5** ⛔ **NE PAS TOUCHER AU
  MODE PLAT** (`terrain.js`, `plinth.js`, `ocean.js`) — **la dépose est ANNULÉE** ·
  **D6** exagération ≈2 au zoom max, variation limitée · **D7** ⛔ **LES TROUS D'ABORD** ·
  **D8** repenser pour la sphère, ne pas transposer.

## Les deux études qui fondent l'ordre

- `.superpowers/sdd/2026-08-21-terre-unique/inventaire-studio.md` — **89 entrées, 34 plates.**
- `.superpowers/sdd/2026-08-21-terre-unique/etude-fondu-niveaux.md` — ⛔ **LES ARÊTES DROITES
  NE SONT PAS GÉOMÉTRIQUES.** `minFade` dépend de `fwidth(vUv) * uTilePx` (**local à la
  tuile**) et le grain est indexé sur `vUv`. **Le morphing ne peut structurellement rien y
  faire.** ➡️ **Texture AVANT morphing.**

## Ordre imposé

**J** surface → **K** texture → **L** exagération → **M** paliers → **N** bloc continu →
**O** morphing → **P1…P8** studio → **Q** nettoyage.

## Journal

- **Tâche J livrée** (`de51c53`) — DONE_WITH_CONCERNS. Vérifié : arbre propre, **3 644 tests**
  (+16), `audit:tests` **201/201**, **20/20 mutations sémantiques tuées**, page chargée
  drapeau levé ET baissé. **24 captures dans `.banc/vues-J/`.**
  - ✅ **BATHYMÉTRIE BRANCHÉE.** L'obstacle écrit dans `main.js` était RÉEL (`demanderEmprise`
    remplace `gardeHauteurs`) : la sortie n'est pas un second appel mais **une seule
    réservation qui connaît les deux emprises**, via un `aussi` dont **le défaut `null`
    reproduit le dépôt au bit près** — le patron de la Tâche F, appliqué sans qu'on le lui
    rappelle. Même caméra : **couverture 0,0125 → 1**, `bathy` **false → true**,
    148 225 nœuds, **0 manquant**, 97,6 % sous le niveau de la mer, min **−4 970 m**.
    ⚠️ **Et la texture demi-flottante que le GPU LIT dit la même chose** — pas seulement le JS.
  - ✅ **ZOOM DEPUIS L'EMPRISE** (`zoomPourEmprise`, budget 25 tuiles — le chiffre de la Tâche F).
  - ✅ **DÉBORDEMENT FERMÉ** : portée **29,39 → 3** demi-côtés, **200 km de mer flottante en
    moins**. Le fondu du bord suit l'estompage sur la superellipse. ⚠️ **Ce faisant il
    RÉVEILLE `uCropCoin`/`uCropCoinN`, déclarés dans `MER_FRAG` et lus par PERSONNE depuis la
    Tâche F** — cinquième constante morte du chantier, trouvée en passant.
  - **`reserverHauteurs` non régressé** (`veilleCrop.refus = []` aux deux zooms).
    **`terrain.js`, `plinth.js`, `ocean.js` non modifiés — D5 respectée.**
  - ⛔ **CE QUI RESTE FAUX, ÉTABLI PAR ÉLIMINATION ET NON SUPPOSÉ : au-dessus de ~20 km la mer
    se lit en TACHES BLEUES ET VERTES.** Mer cachée → le fond du crop est un plateau vert
    uniforme ; houle et clapot à zéro → **le marbrage disparaît entièrement**. Les creux de
    houle (**73 m mesurés**) passent derrière un fond marin rendu **à l'altitude ZÉRO**.
    ➡️ **LE CHAMP DE LA MER A UN FOND ; LA SURFACE DU CROP N'EN A PAS.** C'est ce désaccord
    qu'on voit. **Trois sorties nommées, toutes hors périmètre : bathymétrie dans les tuiles,
    houle coupée, `depthTest: false`.** ⚠️ **L'implémenteur recommande de traiter ça AVANT K.**
  - Réserves : aucun chronométrage · `COUVERTURE_MER_MIN = 0,99` **posé, pas mesuré** ·
    **un seul lieu** (La Réunion, z10/z12) · la mer reste presque d'un seul bleu car **96 % du
    champ dépasse le budget de lagon de 1 537 m** (réglage de rampe → P2) ·
    **`uCoastMaskOn` du globe vaut 0 alors que le contexte porte un masque** — constaté, pas creusé.
  - ⚠️ **PIÈGE NEUF, À RETENIR : `flux-terrain.js` est le SEUL fichier LF du dépôt.** Un outil
    d'édition l'a réécrit en CRLF et **`git diff` annonçait 1 541 lignes pour 87 réelles.**
    ➡️ **Vérifier `git diff --stat` contre `git diff --ignore-cr-at-eol --stat` après chaque
    édition.** C'est le CINQUIÈME agent que les fins de ligne piègent.
- **Tâche J : relecture — NON-CONFORMITÉ ❌. 1 critique, 2 importants, 2 mineurs.
  Le CODE tient ; c'est une AFFIRMATION DE VÉRIFICATION qui tombe.**
  - ⛔ **CRITIQUE — « la texture demi-flottante que le GPU LIT dit la même chose » NE TIENT
    PAS.** `champ.texture` est une `THREE.DataTexture` bâtie **directement sur le MÊME
    `Uint16Array`** que le calcul JS de couverture — **aucun clone, et aucun chemin de
    relecture GPU indépendant n'existe** dans ce qu'expose `__exp` (l'unique
    `readRenderTargetPixels` du dépôt sert une sonde matérielle sans rapport). « Décodé à la
    main dans la page » signifie presque certainement **relire `texture.image.data`, donc le
    même tableau JS.** ⚠️ **Les captures corroborent le correctif ; c'est l'AFFIRMATION qui
    est sans fondement.** ➡️ **À retirer ou à étayer.**
  - ⚠️ **IMPORTANT — le relecteur a posé 5 mutations de son cru : 4 tuées, UNE SURVIT.**
    Retirer la **remise de priorité entre tuiles de bloc et tuiles de mer** dans la file
    (`flux-terrain.js:458`, `9e8` contre `1e9`) **ne casse rien**. C'est un comportement
    **voulu et commenté, avec ZÉRO couverture** — trou dormant, **absent des 20 mutations
    nommées**.
  - ⚠️ **IMPORTANT — le script de mutation et le protocole de capture vivent dans un
    scratchpad personnel INACCESSIBLE** : le « 20/20 tué » **n'est pas auditable depuis le
    dépôt**, contrairement à tous les autres chiffres qui remontent à `J-releves-bruts.json`.
    ➡️ **Convention du chantier : les bancs restent dans `.banc/`.** C'est ce qui a permis de
    trancher le désaccord de la Tâche D.
  - ✅ **Tout le reste est propre** : chaque chiffre du rapport **concorde exactement** avec le
    JSON brut · `npm test` reproduit à **3 644** · `audit:tests` 201/201 · **D5 pleinement
    respectée** (fichiers interdits intouchés, défaut `aussi: null` **bit à bit confirmé par
    le code ET un test**) · ⚠️ **et les captures montrent honnêtement le défaut NON corrigé
    (le marbrage) au lieu de le cacher.**
  - **Contrôle CRLF fait** : `git diff --stat` et `--ignore-cr-at-eol --stat` concordent.
  - ⏸️ **TOUR 1 EN ATTENTE** — l'implémenteur de J bis occupe l'arbre.
- **Tâche J bis livrée** (`a5b188e`) — DONE_WITH_CONCERNS. Vérifié : arbre propre,
  **3 683 tests** (+39), `audit:tests` **202/202**, page chargée drapeau levé ET baissé.
  **18 captures + relevés bruts dans `.banc/vues-Jbis/`.**
  - ✅ **LA SORTIE N°1 ÉTAIT ATTEIGNABLE ET ELLE EST PRISE** — la CAUSE, pas le symptôme.
    La surface du crop lit **le champ MÊME que la mer lit** : pas une seconde fusion
    (`poserMer` cuisait déjà 385² de `fuseBathymetry`, et **une fusion par tuile serait
    FAUSSE** — le §4 de `flux-terrain.js` l'écrit déjà). Module pur `src/monde/fond-crop.js`,
    maillon `fond` en **deuxième position** de la chaîne (parois et rampe le **lisent**).
  - **Les chiffres** (3 105 sondes en eau) : écart surface↔champ **920,7 → 2,85 m**,
    max **2 116,27 → 310,01 m**, surface à zéro exact **90,4 → 1,9 %**,
    `uOceanDepth` **130,36 → 2 106,77 m**, `baseY` **×2,718**.
    ⚠️ **La houle accusée par la Tâche J faisait 73 m : le désaccord en faisait 12,6 fois
    plus.** Et la réponse mesurée à l'Étape 1 : **les tuiles z12 du bloc ne portent que
    13,6 % de la profondeur** (−288,36 m contre −2 116,3 m).
  - ✅ **LE MARBRAGE BLEU-ET-VERT A DISPARU** (`Jbis-20` contre `J-final-17`), et sous la mer
    il y a **un vrai talus** au lieu du plateau vert.
  - ⛔ **MAIS CE N'EST TOUJOURS PAS LE SOCLE, ET IL LE DIT** : **la frange d'écume devient le
    défaut DOMINANT à 5,5 km** · le bloc est **2,7× plus profond** — conséquence honnête,
    mais ⚠️ **le mode plat NORMALISE là où le crop EXAGÈRE : décision produit NON VALIDÉE** ·
    les jupes pendent toujours · tout reste délavé.
  - **Les deux constats creusés, et les deux ont rendu quelque chose :**
    - **`uCoastMaskOn = 0` est un RAFRAÎCHISSEMENT absent, pas un branchement absent** — et
      c'était bien une part du plateau vert : le masque changerait **67 084 px sans le fond,
      5 761 avec** (**11,6× moins**) : **le fond le subsume.**
    - **`uCropCoin`/`uCropCoinN` réveillés et lus par QUATRE lecteurs** — mais `poserCrop`
      pose ses défauts `0`/`2` : ⚠️ **le crop est un CARRÉ** là où le socle a un rayon
      **2,24/28** et un exposant **4,4**.
  - ⚠️ **DEUX DÉFAUTS TROUVÉS PAR L'ÉCRAN, PAS PAR LA LECTURE** : les parois **ne suivaient
    pas** (`baseY` identique au millionième pour une surface descendue de **2 116 m**), et la
    reprise laissait **la rampe périmée** (`uOceanDepth = 130,36` avec 2 116 m dessous).
  - **Mutation 36/36 tuées — AU TROISIÈME TOUR.** ⚠️ **19/35 au premier : ses tests de LOI
    PURE étaient bons, ses tests de BRANCHEMENT manquaient TOUS.** Et **une mutation a survécu
    à son propre test parce que sa sonde tombait sur la diagonale.**
  - ⛔ **LA CONSIGNE CRLF HÉRITÉE ÉTAIT FAUSSE DANS SA RAISON, ET IL L'A CORRIGÉE :**
    **382 des 533 fichiers sont CRLF dans l'arbre, TOUS les blobs sont LF**, et c'est
    `core.autocrlf` (true système / false dépôt) qui l'explique.
    ➡️ **N'IMPORTE LEQUEL des 382 peut produire un faux diff, pas un seul.**
    **Corriger cette phrase dans tous les briefs suivants.**
- ⚡ **COUPURE DE COURANT (2026-08-22, ~03:30).** Deux agents perdus en vol : le tour 1 de J
  et la relecture de J bis. **Rien n'est perdu — le registre a fait son travail de carte de
  récupération.** État retrouvé : `HEAD = a5b188e`, un seul fichier modifié non commité.
- **Tâche J, tour 1 : COMPLET, commité par le contrôleur** (`6fba7dd`).
  L'implémenteur avait **tout fini avant la coupure** ; seul le commit manquait. Vérifié
  intégralement avant de poser : **3 684 tests**, `audit:tests` **202/202**, `node --check`,
  arbre propre après.
  - ⛔ **CRITIQUE traité, et RETIRÉ plutôt que rafistolé** : la phrase « la texture que le GPU
    échantillonne dit la même chose » **n'était pas une preuve indépendante** — la
    `DataTexture` est bâtie sur **le même `Uint16Array`**, sans clone, et **aucun chemin de
    relecture GPU n'existe pour la mer dans ce dépôt**. Remplacée par ce qu'elle prouve
    réellement. ⚠️ **Quatrième chiffre-titre retiré de sa propre initiative sur ce chantier.**
  - ✅ **Le trou dormant est couvert** : un test vise désormais **l'argument passé à
    `_request`** (`1e9` pour le bloc, `9e8` pour la mer seule), et non un effet indirect sur
    la file — **`_pump` re-trie à chaque tour, donc observer `g.queue` après coup mesurerait
    le TRI, pas la valeur posée.** Le raisonnement est écrit dans le test.
  - ✅ **Le banc a quitté le scratchpad pour `.banc/mutation-J-tour1.md`.**
  - **Deux worktrees fantômes retirés** (`wt-relecJbis`, laissé par la relecture interrompue).
- **Tâche J : complete** (`de51c53` + `6fba7dd`, 1 tour, 2 mineurs différés).
- **Tâche J bis : relecture — CONFORMITÉ ✅. 0 critique, 1 important, 1 mineur.**
  - ✅ **L'AFFIRMATION D'ARCHITECTURE TIENT, ET LE DÉPÔT L'ÉCRIT LITTÉRALEMENT** :
    `flux-terrain.js:743-749` dit qu'une fusion bathymétrique PAR TUILE
    **« priverait `fuseBathymetry` des neuf dixièmes de ses échantillons »**. Lire le champ
    que la mer cuit déjà (385² de `fuseBathymetry`) **était donc le bon geste, pas un
    contournement.**
  - ✅ **TOUS les chiffres vérifiés EXACTEMENT** contre `Jbis-releves-bruts.json`, **dont deux
    recalculés indépendamment depuis la source** (`exposantCoin(0.6) = 4,4`,
    `uSlabCorner = 2,24` sur un demi-côté de 28). **Aucun mélange de dénominateurs** —
    première tâche du chantier à passer ce contrôle sans une seule retenue.
  - ✅ **D5 respectée** : les trois fichiers interdits **absents du diff**. `parois-crop.js`
    est le seul fichier partagé élargi, et **son comportement par défaut à zéro est
    VERROUILLÉ par un test que le relecteur a fait échouer pour le prouver.**
  - ✅ **Campagne rejouée** : 8 des mutations annoncées reproduites (**toutes tuées**), plus
    **3 mutations de son cru VISANT LE BRANCHEMENT** — la faiblesse que l'implémenteur avait
    lui-même déclarée — **toutes tuées avec un diagnostic clair.**
  - ⚠️ **IMPORTANT — un trou dormant réel** : la borne `h > 0` d'`altitudeMaillage`
    (`src/monde/fond-crop.js:89`) **n'est pas testée entre 0 et ~100 m** avec un vrai champ de
    fond ; l'élargir à `h > 100` **survit aux 275 tests concernés**. ⚠️ **Le code de
    production est JUSTE aujourd'hui : c'est un trou de COUVERTURE, pas un défaut livré.**
    ⏸️ **Tour 1 mis en file** — l'arbre est occupé par la Tâche K, et la Tâche K prime.
  - ✅ **Les captures sont honnêtes** : `Jbis-00`/`Jbis-20` montrent exactement ce que le
    rapport annonce, **y compris les défauts NON corrigés visibles dans la capture de
    « réussite »** (jupes qui pendent, aspect délavé).
- **⚡ OBSERVATION D'ADRIEN (2026-08-22, matin) — ÉLARGIT LE DIAGNOSTIC DE LA TÂCHE K.**
  Trois captures **au MÊME zoom Z9**, seul l'angle change : *« des textures totalement
  différentes selon le point de vue »* — vert uniforme au nadir, texture crénelée et
  clignotante en isométrique.
  ➡️ **CE N'EST DONC PAS SEULEMENT UNE COUTURE ENTRE NIVEAUX : C'EST UNE DÉPENDANCE À
  L'ANGLE DE VUE.** Vérifié dans le code :
  - ⚠️ **SEPT `fwidth` dans le nuanceur de fragment, pas deux** : `:679` échantillonnage ·
    `:816` bordure du crop · `:977` anticrénelage de côte (**commentaire disant que sa garde
    est un uniforme — peut-être légitime, à ne pas toucher**) · `:985` et `:1006` largeur des
    courbes · **`:1013` `minFade`** · `:1022` graticule. **`fwidth` mesure par PIXEL D'ÉCRAN :
    le raccourci de perspective fait basculer les sept d'un coup.**
  - ⚠️ **La mer se dégrade PAR SOMMET depuis la distance caméra** (`globe.js:148-157`,
    `dMer = distance(cameraPosition, monde)`, **avec sortie anticipée**) : en vue oblique,
    **mer proche et mer lointaine sont traitées différemment DANS LA MÊME IMAGE**, sur un
    maillage assez grossier pour que ça se lise en plaques. **Hors périmètre de K — mais son
    banc doit la DISTINGUER, sinon il ment (huitième façon).**
  - ➡️ **CRITÈRE DE SORTIE DURCI, transmis à K** : *deux vues du même lieu à la même
    altitude, sous deux angles, doivent rendre la même LOI de texture — pas la même image.*
- **⚡ SECONDE OBSERVATION D'ADRIEN (2026-08-22) — ET ELLE RENVERSE LA DÉCISION 4.**
  Onze captures, de l'orbite à Z13 : *« on dirait qu'il y a plein de façons de traiter
  l'affichage de la terre… la mer est bleu profond, puis clair, puis verte. On ne peut pas
  conserver une texture unique à tous les niveaux ? »*
  **CAUSE ÉTABLIE DANS LE CODE, pas supposée :**
  - La couleur de la mer vaut **`t = 0,35 · (1 − clamp(−h / uOceanDepth, 0, 1))`**
    (`globe.js`, le bloc `float t =`).
  - ⛔ **`uOceanDepth` N'EST PAS UNE CONSTANTE : elle est RE-MESURÉE SUR LE CROP** à chaque
    pose (`globe.js:2091`, `poserRampe` → `echelleRampe`), et **le crop rétrécit quand on
    descend**. En orbite, `retirerRampe` rend `RAMPE_MONDE` : **profondeur 6 000 m**
    (`rampe-crop.js:377-382`). Autour de La Réunion, la Tâche J bis a relevé **2 106 m** —
    et **130 m avant sa correction**.
  - ➡️ **Donc la MÊME profondeur physique reçoit une couleur DIFFÉRENTE à chaque altitude.**
    À 6 000 m d'échelle, un fond à −4 000 m donne `t = 0,117` → **bleu profond**.
    À 2 106 m d'échelle, un fond à −500 m donne `t = 0,267` → **turquoise clair**.
    Et quand l'échelle devient petite, tout le fond remonte vers **`t = 0,35`**, qui est
    **la limite mer/terre, donc la première teinte de TERRE : le VERT.**
  - ⚠️ **C'EST EXACTEMENT CE QUE LA TÂCHE D AVAIT PRÉDIT ET QU'ON A ACCEPTÉ** : « la rampe
    locale rend le crop plus sombre, pas plus clair », et « une plaine à côté d'un crop alpin
    sera monochrome ». **Adrien voit aujourd'hui la conséquence de la décision 4.**
  - ➡️ **DÉCISION 4 RENVERSÉE PAR SA DEMANDE PLUS RÉCENTE** (« une texture unique à tous les
    niveaux »). **La plus récente prime.** ⚠️ **Mais elle rouvre le grief d'origine de la
    Tâche C — la rampe mondiale rendait « une masse plate et orange » — donc la sortie n'est
    NI l'une NI l'autre : il faut une échelle qui varie CONTINÛMENT et LENTEMENT, jamais
    re-mesurée par saut à chaque pose de crop.**
  - **Le « vectoriel »** qu'il croit voir est le trait de côte : `cote = 1 − smoothstep(0,
    fwidth(landness)·1,5, |landness − 0,5|)` mixé avec `uInk` — un trait **anticrénelé par
    fragment**, donc net à une échelle et absent à une autre. Encore un `fwidth`.
  - **Le Z13 déchiré** (polygones ouverts) reste à diagnostiquer.
  ➡️ **NOUVELLE TÂCHE À INSÉRER : L'ÉCHELLE DE COULEUR CONTINUE — après K, avant L.**
- ⚠️ **CONTRAINTE GLOBALE, PROMUE APRÈS DEUX RÉCIDIVES : LES BANCS RESTENT DANS `.banc/`.**
  La Tâche J s'est fait reprendre là-dessus ; la relecture de J bis relève **le même défaut**
  (son script de mutation vit hors dépôt, donc le « 36/36 » n'est pas auditable). Le
  relecteur a compensé **en rejouant 11 mutations lui-même** — mais c'est du travail refait.
  ➡️ **À écrire dans TOUS les briefs suivants, implémenteurs comme relecteurs.**
  **Raison, et elle est concrète : c'est parce que deux bancs étaient restés sur le disque
  qu'on a pu trancher le désaccord de la Tâche D — où l'implémenteur avait raison contre son
  relecteur.**
- **Tâche K livrée** (`92b8da6`) — vérifié : arbre propre, **3 717 tests** (+33),
  `audit:tests` **203/203**, **37/37 mutations sémantiques tuées**, worktree retiré, page
  chargée drapeau levé ET baissé, **zéro erreur console/GLSL**.
  - ✅ **L'ÉTAPE 1 EST FAITE, ET ELLE TRANCHE.** Banc A/B GPU, **témoin = 0 pixel EXACTEMENT**
    sur deux rendus synchrones, **banc prouvé non inerte**. Même altitude, même jeu de
    tuiles, **nadir 8° contre isométrique 55°** :
    | poste gelé | part de l'image changée (nadir / iso) |
    |---|---|
    | **`minFade`** | **23,5 % / 41,0 %** |
    | grain désindexé | 42,0 % / 28,8 % — **mais amplitude 9 à 12× plus faible** |
    | `decodeMetersAA` | ~1,9 % |
    | `crowd` | **0,05 %** |
    **Seul `minFade` déplace la fraction PLATE** (38,4 → 24,9 % au nadir ; 36,0 → 14,3 % en
    isométrique). ⚠️ **`minFade` domine, et sa part grandit ×1,74 avec l'inclinaison : LA
    DÉPENDANCE À L'ANGLE, MESURÉE.** C'est exactement ce qu'Adrien décrivait.
  - ✅ **AUDIT DES SEPT `fwidth` : UN SEUL est en espace-tuile de bout en bout — `minFade`.**
    Les six autres mesurent des **mètres, des degrés, une couverture de côte**.
    ⚠️ **`fwidth(landness)` en `:977` est bien LÉGITIME** (garde par uniformes) — **ma
    réserve était juste, il ne l'a pas touché.**
  - ✅ **Le correctif : une grandeur d'ancrage UNIQUE — les mètres de sol par pixel d'écran**,
    tirés de la **profondeur en espace de vue** (varying, **zéro octet de géométrie**), du
    **fov lu en direct** et du tampon de dessin. `uMppFacteur = 0` rend le dépôt **au bit
    près**, la loi n'est posée que sous `?terre=unique`. **Production intouchée.**
  - ✅ **À L'ÉCRAN : L'ARÊTE DROITE DISPARAÎT** (`E1-coin-haut-gauche-avant/apres.png`).
    ⚠️ **Et le mécanisme réel était PIRE que « des courbes manquantes » : sur une tuile
    grossière le terme des courbes DÉGÉNÈRE EN APLAT qui assombrit la tuile entière.**
  - ⛔ **MAIS AUTOUR DU BLOC LA MER RESTE UN PATCHWORK DE PLAQUES DROITES, et son correctif
    n'y change rien** (`E2`, `F0`). **Ça ne ressemble toujours pas au socle.**
  - **Réserves, toutes déclarées :** la résolution de donnée par niveau et le saut non borné
    à la frontière du crop **restent ouverts** · l'échelle de rampe re-mesurée par pose
    (**`uLandMax` 5 600 → 2 691,25 m relevé**) et le **`h == 0` qui prend la branche TERRE —
    LE GRAND APLAT VERT** — sont des chantiers à part, et ⚠️ **il dit franchement que le
    périmètre élargi est trop large pour une seule tâche** · ⚠️ **les courbes du globe sont
    ÉTEINTES dans le template livré (`contourOpacity = 0`), donc le poste `minFade` y est
    multiplié par zéro** · ⚠️ **DÉFAUT NEUF, PORTÉ PAR PERSONNE : à estompage intermédiaire,
    les tuiles semi-transparentes et leurs jupes se mélangent en PLAQUES DIAGONALES** ·
    la dégradation per-sommet de la mer non touchée · la preuve « drapeau baissé » est
    **indirecte** (440 tuiles, shader compilé, zéro erreur), faute d'avoir pu cadrer la
    planète entière.
  - ➡️ **VERDICT DU CONTRÔLEUR : LA VOIE B TIENT. Ce n'était PAS une impasse, et la grille
    concentrique n'est pas nécessaire.** La mesure le prouve : la dépendance à l'angle avait
    **une cause unique**, et elle est fermée.
- **⚡ RELEVÉ EN DIRECT DANS L'APPLICATION (2026-08-22), après qu'Adrien a comparé son socle
  de production au crop au MÊME cadrage Z12 :**
  `uEstompage 1 · uCropOn 1 · uHabOn 1 · **uSolOn 0** · **uCoastMaskOn 0** · uLandMax 2 573 ·
  uOceanDepth 3 033` · matériaux : **`transparent: true`, et l'un avec `depthWrite: false`**.
  ➡️ **TROIS CAUSES NOMMÉES POUR CE QU'IL VOIT :**
  1. ⛔ **`uCoastMaskOn = 0` — LE TRAIT DE CÔTE EST ÉTEINT.** C'est le « rafraîchissement
     absent » que la Tâche J bis avait relevé **et laissé**. ➡️ **À reprendre en P4, et c'est
     visible à l'œil nu.**
  2. ⛔ **`uSolOn = 0`** — occupation du sol éteinte (jamais vue à l'écran, déjà au §8).
  3. ⛔ **`transparent: true` + `depthWrite: false` → LE BLOC EST TRANSLUCIDE.** C'est
     exactement le **défaut neuf que la Tâche K a signalé sans le porter** : « à estompage
     intermédiaire, les tuiles semi-transparentes et leurs jupes se mélangent en plaques
     diagonales ». ⚠️ **Adrien le voit comme « la mer ne fonctionne plus » — c'est en réalité
     le bloc qu'on traverse du regard.**
  ➡️ **ET LE RESTE N'EST PAS UN BUG, C'EST UNE ABSENCE** : l'habillage du socle n'est pas
  porté. La Tâche C l'avait chiffré — les quatre postes portés ne déplacent que **1,01 % des
  pixels**, et *« ce qui fait la richesse de l'image du socle, c'est le texture shading et la
  rampe locale »*. **C'est l'ACTE III du plan, pas encore commencé.**
  ➡️ **DÉCISION DU CONTRÔLEUR : la translucidité et le trait de côte éteint passent AVANT
  l'Acte III — ce sont des défauts, pas des manques.**
- **Tâche K : relecture — CONFORMITÉ ✅. 0 critique, 2 importants, 1 mineur.**
  - ✅ **LA MESURE TIENT, RECALCULÉE À LA MAIN.** Le relecteur a refait **chaque nombre** des
    tables depuis `.banc/vues-K/90-duo.json` et `E0-avant-apres.json` : **tous concordent
    jusqu'au dernier chiffre**. ⚠️ **Et le témoin est une VRAIE preuve à 0 pixel, pas un banc
    inerte.**
  - ✅ ⚠️ **DÉTAIL QUI HONORE L'IMPLÉMENTEUR : ses DEUX PREMIÈRES ITÉRATIONS ÉTAIENT CASSÉES**
    (`20-`/`30-nadir-mesures.json`, **témoin à 92,86 %** — le grain de film est animé). **Il
    les a exclues de sa liste de traces ET a déclaré le piège lui-même.** Le relecteur le
    confirme. **C'est le comportement qu'on veut : garder la trace de l'erreur, l'écarter du
    résultat, et le dire.**
  - ✅ **Les sept `fwidth` ré-audités un par un.** La garde `landness` est **exacte** et le
    code **non touché** par le diff.
  - ✅ **`uMppFacteur = 0` rend le dépôt AU BIT PRÈS** — vérifié par **égalité de texte GLSL**,
    et **verrouillé par des tests**. **Le fov vivant est bien lu, et testé.**
  - ✅ **37/37 reproduites indépendamment** en worktree isolé. **D5 respectée** (les quatre
    interdits intouchés). **Aucune capture embellie.**
  - ⚠️ **IMPORTANT ×2 — deux mutations du relecteur SURVIVENT** : échanger **largeur et
    hauteur du tampon de dessin**, et **forcer la latitude à 0**. **Trous de couverture
    réels**, bornés au chemin expérimental `?terre=unique`, **sans exposition en production**.
    (Une troisième s'est révélée équivalente après traçage de `majCameraFond()`.)
  - ⏸️ **Tour 1 mis en file** — l'arbre est occupé par K bis, et **les trois défauts visibles
    signalés par Adrien passent devant.**
- **Tâche K bis livrée** (`d6d6478`) — vérifié : arbre propre, **3 745 tests** (+28),
  `audit:tests` **204/204**, **35/35 mutations** (3 survivantes au 1er tour, **toutes trois
  des tests de BRANCHEMENT insuffisants** — la faiblesse récurrente, corrigée), page chargée
  drapeau levé ET baissé. **12 captures dans `.banc/vues-Kbis/`.**
  - ⛔ **LA MESURE A DIT CE QUE MON BRIEF IGNORAIT, ET C'EST PIRE QUE PRÉVU :**
    - **`uOceanDepth` ne rétrécit pas : il S'EFFONDRE À 8,7 mm à Z13** — aucun point sous le
      niveau de la mer dans le crop, donc `echelleRampe` rend **son plancher de division**.
      **C'est le champ gris qui remplit tout le cadre.**
    - **`uLandBas` SAUTE de 0 à 533,7 m** → tout le relief sous 534 m s'écrase sur la première
      teinte de terre. **Second mécanisme du vert, que personne n'avait vu.**
    - ⚠️ **ET LE NOMBRE QUI PEINT RÉELLEMENT LA MER N'ÉTAIT PAS DANS LE PÉRIMÈTRE** : dès que
      `poserMer` a pris, le fond marin lit **la rampe nautique indexée par `uMerFondBudgetM`**,
      pas `uRamp`. **Traité.**
  - ✅ **La loi** : module pur `src/monde/echelle-continue.js`. Les mesures **ne sont plus
    posées mais ANCRÉES PAR CRAN D'ALTITUDE** (`round(log2 m)`, le pas `Math.LN2` de
    `modes.js`), **une fois par cran** ; le nuanceur reçoit une **courbe Fritsch–Carlson
    IMPORTÉE d'`exageration-continue.js`, pas recopiée**, évaluée par image en `log1p` ;
    **une mesure dégénérée n'est PAS une ancre.** Plus `uMerZeroSousEau` pour que **`h == 0`
    quitte la branche terre**.
  - ✅ **À L'ÉCRAN (Z13)** : avant, **un champ gris uniforme d'un bord à l'autre** et le bloc
    réduit à une tache délavée. Après, **le champ gris a disparu**, les alentours redeviennent
    un dégradé de planète, le bloc se lit. **À Z6 les deux images sont superposables** — le
    témoin de non-régression.
  - **Les chiffres, deux monnaies jamais mélangées** : `t` **0,3499 → 0,0727** (179 → 37
    texels sur 512), `dMer01` **0,1394 → 0,0121**. **Entre Z9/Z11/Z13, là où Adrien regarde :
    179 → 3 texels.** Gain local conservé : **332 contre 182** (×1,82).
    ⚠️ **ET IL REFUSE DE REPRENDRE LE « 163/368, ×2,26 » DE LA TÂCHE C, que son recomptage ne
    retrouve pas.** **Sixième chiffre écarté de sa propre initiative sur ce chantier.**
  - ⚠️ **IL A RETIRÉ UN DE SES PROPRES CHIFFRES** : un second A/B GPU sur l'échelle, **parce
    que son témoin est SALE** — deux rendus synchrones diffèrent sur **98,6 %** des pixels
    une fois le post-traitement rallumé, et couper grain, vignette, animations et AO n'y
    change rien. **Le premier A/B tient : témoin 0 pixel exactement sur 1 241 595.**
  - ⛔ **DÉFAUT RÉEL TROUVÉ, NON CORRIGÉ — ET IL EXPLIQUE BEAUCOUP : À L'ORBITE LE CROP RESTE
    POSÉ** (`uCropOn = 1` à **3 000 km**) **et la planète entière porte la rampe du dernier
    bloc.** C'est pourquoi le jeu « six stations » ne s'améliore quasiment pas.
    ➡️ **À TRAITER : c'est un branchement manquant, pas un réglage.**
  - Réserves : écart résiduel **non nul** (3 texels entre Z9/Z11/Z13, 37 sur la descente) ·
    **la première visite d'un cran neuf déplace encore la courbe** — *« on ne connaît pas un
    relief avant de l'avoir mesuré »* · **la vue nadir où l'aplat occupe le cadre n'a pas été
    refaite** · un seul lieu · **la mer autour reste un patchwork de plaques droites** (son
    banc le distingue : **identique pixel pour pixel** entre les deux états) · **au large,
    un champ presque blanc troué de flaques bleu foncé, déjà là avant lui, non diagnostiqué**.
  - **Périmètre débordé et déclaré** : `poserMer` et `sousEauCrop` sont dans le commit,
    **la mesure ayant montré qu'ils portaient la moitié du défaut**. **Rien du mode plat.**
- **⚡ D9 — LA LOI DE ZOOM, MESURÉE PAR ADRIEN SUR GOOGLE EARTH (2026-08-22).**
  Deux captures, altitudes lues dans la barre d'état de Google Earth :
  **63 170 km → 299 m**, en **10 tours de molette**, soit **≈ 37 crans** sur sa machine.
  **Dérivation (exacte, refaite) :**
  | | |
  |---|---|
  | rapport d'altitude | **211 270,9** |
  | octaves du trajet | **17,689** |
  | **par CRAN de molette (37)** | **facteur ×1,39288** · **0,47807 octave** · `ln = 0,33138` |
  | par TOUR de molette (10) | facteur ×3,40788 · 1,76887 octave · `ln = 1,22609` |
  ⛔ **CE QUE FAIT LE DÉPÔT AUJOURD'HUI : `STEP_IN = STEP_OUT = Math.LN2` (`modes.js`), donc
  un FACTEUR 2 — UNE OCTAVE — PAR CRAN.** Le même trajet ne prend que **17,7 crans** au lieu
  de 37.
  ➡️ **SHIBUMAP EST 2,09× PLUS GROSSIER PAR CRAN QUE GOOGLE EARTH.** C'est mesuré, pas
  ressenti — et **ça explique en grande partie la sensation de saut** dont Adrien se plaint
  depuis le début.
  ➡️ **À INTÉGRER DANS LA TÂCHE M (la mort des paliers)** : `ln = 0,33138` par cran de
  molette, **loi continue, aucun palier**. ⚠️ **Et ce n'est PAS `Math.LN2 / 2` (= 0,34657) :
  l'écart est de 4,4 %, donc on pose la valeur mesurée, pas une jolie fraction.**
  ⚠️ **Réserve à porter dans le brief : le nombre de crans par tour de molette dépend de la
  souris d'Adrien.** Ce qui est invariant, c'est **le facteur par cran**, pas le compte par
  tour. **Le réglage doit donc porter sur le CRAN.**
- ⚠️ **FAUTE DU CONTRÔLEUR, LA MÊME QUE LA 2ᵉ DÉJÀ INSCRITE** : j'ai passé un script Python
  en ligne dans bash **avec des accents graves dedans**, interprétés comme des substitutions
  de commande. **Trois valeurs ont été effacées du plan** (`ln = 0,33138`,
  `STEP_IN = STEP_OUT = Math.LN2`, `Math.LN2 / 2`) — le texte restait lisible et **faux par
  omission**. Réparé avec l'outil d'édition. ➡️ **La règle existait déjà : les scripts
  d'édition passent par un fichier. Je l'ai violée. Elle est ré-affirmée ici.**
- **Tâche K bis : relecture — CONFORMITÉ ✅. 0 critique, 2 importants, 3 mineurs.**
  - ✅ **Les TROIS découvertes de la mesure confirmées** par lecture de `rampe-crop.js` et du
    nuanceur : l'effondrement de `uOceanDepth` sur le plancher de division, le saut de
    `uLandBas` à 533,7 m, et **`uMerFondBudgetM` qui peint réellement la mer à la place de
    `uRamp`**.
  - ✅ **Tous les chiffres-titres recalculés indépendamment depuis les JSON bruts —
    concordants AU TEXEL.** CRLF contrôlé, **35/35 rejouées**, D5 confirmée.
  - ⚠️ **IMPORTANT — 2 des 3 mutations de BRANCHEMENT du relecteur SURVIVENT** (bascule
    `||`→`&&` dans la détection de déplacement de `poserCrop`, et un durcissement de borne
    dans `valeurChamp`). ➡️ **La faiblesse que l'implémenteur avait lui-même déclarée est
    RÉELLE et PAS ENCORE FERMÉE.** C'est la troisième tâche d'affilée où le branchement
    résiste : **à traiter comme un défaut de méthode du chantier, pas comme un oubli isolé.**
  - ⚠️ **IMPORTANT — le défaut d'orbite est CONFIRMÉ RÉEL et NON minimisé** :
    **`veilleCrop.poserMode` n'est appelé NULLE PART dans `src/`.**
    ⚠️ **C'est exactement ce que l'inventaire du studio avait relevé comme trouvaille n°3, et
    que j'avais laissé en « à vérifier ». Deux agents indépendants l'ont trouvé.**
    ➡️ **Déjà dans le périmètre de la Tâche K ter (défaut n°4), en cours.**
- **Tâche K ter livrée** (`6ec0094`) — vérifié : **3 770 tests** (+25), `audit:tests`
  **204/204**, **24/24 mutations dont 15 VISANT LE BRANCHEMENT** (la faiblesse récurrente,
  enfin ciblée), page chargée drapeau levé ET baissé.
  - ⛔ **LE DÉFAUT N°1 N'ÉTAIT PAS `transparent` — ET LA VRAIE CAUSE EST REMARQUABLE.**
    `pn` (la superellipse) est **écrêtée à zéro dans tout le rectangle intérieur** : au dedans
    `d = pn - uCropCoin` valait **la CONSTANTE** `-uCropCoin`, donc **`fwidth(d) = 0`**.
    Et `poserCrop` a `corner = 0` par défaut → **`uCropCoin = 0`**. Le `smoothstep` était donc
    évalué **au milieu exact de son intervalle** et rendait **0,5**.
    ➡️ **TOUTE LA SURFACE DU CROP ÉTAIT DESSINÉE À COUVERTURE 0,5.** Voilà le verre.
    ✅ **Et `transparent: !!this._crop` est CONSERVÉ, avec un test qui l'exige** — l'estompage
    en a besoin pour les alentours. **Le garde-fou du brief a servi.**
    **Mesure appariée** (AVANT repris par `git stash`, même cadre 1 440 000 px, témoins 0 px) :
    l'A/B `uCropCoin 0 → 0,2` déplaçait **17,7148 %** du cadre, il en déplace **0,3885 %**.
  - ⛔ **LES DÉFAUTS N°2 ET N°3 SONT UN SEUL DÉFAUT — ET C'EST UNE COURSE.** L'habillage
    **n'est jamais rafraîchi** (il ne refuse jamais, la chaîne ne se repose que si le lieu
    change) ; masque de côte, mosaïque d'occupation du sol et `amplitudeM` **arrivent après**.
    ⚠️ **Les deux issues ont été observées le même jour à la même URL.** Réparé par
    comparaison des dix champs surveillés et repose **sur changement seulement**.
  - ⛔ **DÉFAUT N°4 : `veilleCrop.poserMode` était ÉCRITE, TESTÉE, ET APPELÉE DE NULLE PART.**
    À 3 000 km : `uCropOn=1`, `uCoastMaskOn=1`, `uLandMax=2 584`, parois et mer encore en
    scène. Après : **`RAMPE_MONDE` revient (5 600 / 6 000), rien ne reste.**
    ✅ **Aucun seuil d'altitude introduit** — la consigne « zéro saut » tenue.
  - ⚠️ **LE BANC A FAILLI MENTIR — HUITIÈME FAÇON, ET ELLE EST NEUVE : le canevas de la page
    a `depth: false`.** Un `renderer.render` vers lui dessine **sans profondeur**, et **un
    bloc OPAQUE y ressemble à du VERRE**. Captures effacées, chemin écarté, A/B refaits dans
    une cible à profondeur (témoin **0 sur 4 prises** contre **98,55 %** pour le compositeur).
  - ⚠️ **TROIS CHIFFRES RETIRÉS EN ROUTE** (un « 100 % » d'une cible mal dimensionnée, un
    `retour` de 8,51 % dû à un `await`) — et **il CONSERVE une prise de témoin aberrante qu'il
    n'explique pas** plutôt que de la cacher. **Neuvième retrait volontaire du chantier.**
  - **Réserves :** **l'occupation du sol reste éteinte et n'a JAMAIS été vue à l'écran sur le
    globe** — éteinte par défaut dans le mode plat aussi, **et elle s'est rééteinte seule à
    trois tentatives** · ⚠️ **les plaques droites de la mer au nadir SUBSISTENT, mais il les a
    LOCALISÉES : elles disparaissent quand on cache la nappe `crop-mer`** — donc ni la surface
    du crop ni la rampe · trous de surface côté est et jupes débordantes : pré-existants.
  - ⛔ **« Côte à côte avec le socle de production, ça ne ressemble toujours pas au socle » :
    ni texture shading, ni analyse de relief, ni matière de parois, ni cartouche. C'est
    l'ACTE III.** *Sixième tâche à l'écrire plutôt que de conclure au succès.*
  - ⚠️ **Il signale que `applyIsoView` dérive de `controls.maxDistance`, donc le crop et le
    socle N'OCCUPENT PAS la même fraction du cadre à vue isométrique identique** —
    **ça gênera toute comparaison côte à côte tant que ce ne sera pas réglé.**
- **Plan corrigé et commité** (`9d6f8fd`) : phrase dupliquée retirée, **fichier remis en LF**
  (mon édition l'avait réécrit en CRLF → **faux diff de 710 lignes pour 34 réelles**, exactement
  le piège que je fais inscrire dans tous les briefs). **Signalé par la Tâche K ter, pas par moi.**
- **⚡ D10 — EXAGÉRATION FIXE À ×2 SUR TOUTE LA MAP** (Adrien, 2026-08-22) :
  *« ça évitera les sauts et les rechargements »*.
  ⚠️ **DÉCISION QUI SUPPRIME LE PROBLÈME À LA RACINE, ET QUI REMPLACE PLUSIEURS CHOSES :**
  - **Remplace D6** (« ≈2 au zoom maximal, variation limitée ») → **plus aucune variation.
    Une constante, partout, à toute altitude.**
  - ➡️ **`setExaggeration` n'est plus appelée en cours de route → `_rechargeTuiles()` non plus
    → LES 12 À 21 SECONDES DE RECHARGEMENT DISPARAISSENT** sans porter le relief au GPU.
  - ➡️ **Le portage dans le nuanceur de sommets devient FACULTATIF**, plus un préalable.
    **Différé, pas abandonné** — il rendrait l'exagération vivante un jour.
  - ➡️ **`exageration-continue.js` (Tâche E : courbe Fritsch-Carlson, ancres, 14 lecteurs)
    devient SANS OBJET sur le chemin `?terre=unique`.** ⚠️ **NE PAS LE SUPPRIMER** — il sert
    au mode plat et il est gardé par des tests. **Il rend la constante sur ce chemin.**
  - ⚠️ **CONTREPARTIE MESURÉE, À DIRE PLUTÔT QU'À DÉCOUVRIR** : la Tâche E a relevé qu'à
    **×2,8** la silhouette du limbe passe de **≈7 px à ≈1 px** sur un cadrage plein disque.
    **À ×2, la Terre vue de l'orbite sera quasiment lisse.** **Cohérent avec la référence
    d'Adrien** (Google Earth est lisse depuis l'espace) — **mais à montrer à l'écran.**
  - ⛔ **Le mode plat garde son `demExaggeration` intact (D5).**
  ➡️ **Injecté dans `brief-M.md` §③. La Tâche N en cours n'est pas concernée.**
- **⚡ D11 — IL N'Y A PLUS QU'UN SEUL MODE : LA SPHÈRE** (Adrien, 2026-08-22) :
  *« Il n'y a plus de mode plat !!! Il y a juste un seul mode sphère, on ne touche plus au
  mode plat, c'est juste une SAUVEGARDE. »*
  ⛔ **CECI CORRIGE D4.** J'avais écrit que les deux chemins coexistaient et que **« chaque
  option est à régler DEUX FOIS »** — **c'était faux, et ça doublait inutilement l'Acte III.**
  - **Le mode plat est une sauvegarde GELÉE**, pas un chemin parallèle à maintenir.
  - ⛔ **L'interdiction de le modifier reste ENTIÈRE** — `shibumap.com` tourne dessus.
    **On n'y touche pas, ET on ne l'adapte pas non plus.**
  - ➡️ **Tout vise la sphère, et elle seule. Aucun réglage en double.**
    ⚠️ **L'Acte III est donc DEUX FOIS PLUS LÉGER qu'annoncé.**
  - **Le drapeau `?terre=unique` reste le chemin d'essai, défaut `false`** — Adrien n'a pas
    demandé de basculer la production.
- **⚡ Et : « Ne me montre pas, c'est ok pour ×2. »** ➡️ **Aucun banc sur la lissité du limbe.**
  **Retiré du brief M.** *Adrien tranche sans démonstration quand il a déjà la mesure — ne pas
  lui en refaire une.*
- **⚡ D12 — L'INTERDICTION D5 EST LEVÉE** (Adrien, 2026-08-22) : *« Il n'y a PAS
  d'interdiction de modifier `terrain.js`, `plinth.js` et `ocean.js`. Il faut absolument les
  adapter à la nouvelle version, ou créer une copie de ces éléments avec un nom différent pour
  les adapter à la vue sphérique. »*
  ➡️ **RÈGLE D'ARBITRAGE ÉCRITE DANS `regle-D12.md`, à joindre à TOUS les briefs suivants.**
  - ⚠️ **C'EST LE DÉBLOCAGE DE L'ACTE III**, donc de la demande la plus forte d'Adrien —
    *« retrouver la texture comme elle était avant »*. La Tâche C avait mesuré que les quatre
    postes portés ne déplacent que **1,01 % des pixels**, et écrit que **la richesse du socle
    vient du TEXTURE SHADING et de la rampe locale** — qui vivent dans `terrain.js` /
    `terrain-analysis.js`, **hors d'atteinte tant que D5 tenait.**
  - ⛔ **LE PIÈGE : « copier » est EXACTEMENT ce qu'Adrien a refusé au départ.** Ses mots :
    *« il vaut mieux calculer 2 terres qu'une seule ? au niveau ressources ça me paraît
    aberrant »*. **Copier `terrain.js` en entier recréerait la duplication qu'on a passé une
    semaine à détruire.**
  - ➡️ **ORDRE DE PRÉFÉRENCE IMPOSÉ : ① ÉLARGIR** (défaut bit-à-bit — patron établi **six
    fois** : `distanceRivage`, `aussi: null`, le maillon `fond`, `uMppFacteur = 0`,
    `uMerZeroSousEau = 0`, le terme nul de K ter) · **② EXTRAIRE EN MODULE PUR PARTAGÉ**
    dans `src/monde/`, testable sous node (le dépôt a déjà cette architecture) ·
    **③ COPIER SOUS UN AUTRE NOM en DERNIER RECOURS, jamais un fichier entier**, et l'en-tête
    doit dire de quoi ça dérive, pourquoi l'élargissement était impossible, et ce qui devra
    être resynchronisé.
  - ⚠️ **D11 tient toujours et ne dit PAS la même chose** : on n'ADAPTE pas le mode plat aux
    nouveautés (il reste une sauvegarde). **D12 dit qu'on peut TOUCHER à ses fichiers pour
    servir la sphère. On les ouvre pour en TIRER, pas pour les faire évoluer.**
- **⚡ D13 — AUTORISATION PLEINE** (Adrien, 2026-08-22) : *« On se moque que ShibuMap tourne,
  il est en version alpha et personne ne l'utilise encore, tu peux modifier tout ce que tu
  veux, tu as l'autorisation. »*
  ➡️ **REMPLACE D5, D11 ET D12. Plus aucun fichier protégé.** Règle réécrite dans
  `regle-D12.md`, à joindre à tous les briefs.
  - ⚠️ **Le cérémonial du « défaut au bit près » n'est PLUS obligatoire** — il existait pour
    protéger une production **qui n'existe pas**. ➡️ **On adapte DIRECTEMENT.**
    ⚠️ **MAIS il garde une vertu qui n'est pas la sécurité : il rend la MESURE possible.**
    Un drapeau qui éteint un changement permet un **A/B à témoin nul** — ce qui a produit les
    meilleures preuves du chantier (`uKminFade`, `uCropCoin 0 → 0,2`).
    ➡️ **À garder comme INSTRUMENT DE BANC, pas comme filet.**
  - ⚠️ **Le vrai filet, c'est git.** Une sauvegarde vit dans l'historique, **pas dans un
    second moteur qu'il faut maintenir vivant.** ➡️ **Plus une minute sur la parité du plat.**
  - ⛔ **COPIER reste le dernier recours — mais pour un motif qui n'a JAMAIS été la
    production** : ce chantier existe parce qu'Adrien a refusé **deux Terres calculées
    séparément** (*« au niveau ressources ça me paraît aberrant »*). **Cet argument tient
    toujours.** Ordre : **① adapter · ② extraire en module pur · ③ copier, jamais entier.**
  - ⚠️ **CE QUI NE SE RELÂCHE PAS : tests, mutations, bancs, regarder l'écran.**
    L'autorisation porte sur **ce qu'on a le droit de casser**, **pas sur la rigueur de la
    preuve.** **Neuf chiffres retirés par leurs propres auteurs — rien là-dedans ne bouge.**
- **⚡ D14 — AGENTS NOTEURS DE CONFORMITÉ VISUELLE** (Adrien, 2026-08-22, avant de partir) :
  *« Utilise des agents noteurs qui jugeront la conformité visuelle avec celle précédant le
  passage en mode sphère. »* ➡️ **Protocole écrit dans `brief-noteur.md`.**
  - **La référence est une IMAGE** : le socle de production, drapeau baissé, même lieu, même
    cadrage. Pas une intention.
  - ⛔ **PIÈGE BLOQUANT, relevé par K ter : `applyIsoView` dérive de `controls.maxDistance`,
    donc crop et socle N'OCCUPENT PAS la même fraction du cadre.** ➡️ **Un noteur qui compare
    sans apparier note du CADRAGE, pas du rendu. L'appariement doit être PROUVÉ (fraction du
    cadre à 1 % près) avant toute note.**
  - Six critères notés séparément + une note globale + **la liste ordonnée de ce qui manque**
    — *c'est elle qui sert, plus que la note.*
- **CONSIGNE DE MARCHE : Adrien est parti. « Ne t'arrête plus, force-toi à aller jusqu'au
  bout. » Boucle SDD sans interruption jusqu'à complétion.**
- **ORDRE DE MARCHE ARRÊTÉ :** **N** (le crop seul, EN COURS) → sa relecture → **M** (mort des
  paliers + `Math.LN2/2` + exagération ×2 fixe + aucun rechargement) → **l'appariement de
  cadrage** (préalable à toute notation) → **ACTE III, LA TEXTURE** (débloqué par D13 : le
  texture shading de `terrain.js` est enfin atteignable — *c'est la demande la plus forte
  d'Adrien*) → notation → le reste du studio.
- **Tâche N livrée** (`62c05fc`) — vérifié : arbre propre, **3 806 tests** (+36),
  `audit:tests` **205/205**, page chargée drapeau levé ET baissé.
  - ✅ **LE CHIFFRE QUI DIT SI ÇA A SERVI.** Au repos, altitude de bloc :
    **351 tuiles dessinées dont 315 ENTIÈREMENT HORS CROP** — chaque fragment `discard`é,
    **chaque appel de dessin payé**. Après : **36 dessinées, ZÉRO hors crop**, et
    **60 tuiles parcourues par image contre 688**.
    A/B **apparié** à 26 594 m (même caméra, drapeau basculé en direct) :
    **326 → 144 dessinées, 182 → 0 hors crop.**
  - ✅ **À l'écran** : avant, le bloc est **noyé dans une nappe délavée qui couvre tout
    l'écran**, ses parois invisibles. Après, **le bloc seul sur le fond, détaché.**
    Dézoom filmé sur **1 664 images : une bascule à l'aller, une au retour, 1 346 ms —
    aucun battement.**
  - ✅ **L'HYSTÉRÉSIS EST MESURÉE, PAS DEVINÉE**, et la mesure a **invalidé le critère naïf** :
    au repos strict l'écart vaut **exactement zéro sur 3 216 images**, mais **la traîne
    d'amortissement est ASYMPTOTIQUE** (encore **7,7 × 10⁻¹¹** après 603 images) —
    ⚠️ **donc « non nul » n'est PAS un critère utilisable.** Seuil `10⁻⁴` = **4,7 fois sous
    le pic du geste le plus doux mesuré** ; à `10⁻³` ce geste ne compte **aucune** image.
  - **Mutation : 25 dont 16 sur le BRANCHEMENT, 25/25 tuées au TROISIÈME tour** (19 → 24 → 25).
    ⚠️ **Les survivantes ont trouvé DEUX CODES MORTS** (sixième et septième du chantier) —
    le `modeSurface &&` du relais et le `kids.length > 0` de la règle sans-trou — **retirés
    plutôt que testés à vide** ; **un défaut réel** (l'oubli de la référence d'altitude ne se
    faisait qu'à l'aller vers l'orbite) ; et ⚠️ **un test faible instructif : TOUS ses tests
    passaient le globe PAR SA VALEUR alors que la production le passe PAR UNE FONCTION** —
    **la faute était invisible sous la seule forme que la production n'emploie pas.**
  - ⛔ **TROIS DÉFAUTS VISIBLES QU'IL SIGNALE, ET DEUX SONT NEUFS** : **la nappe de mer et le
    dessus du bloc NE SONT PAS LA MÊME SURFACE** — deux arêtes distinctes sur le flanc
    gauche, **un débordement en porte-à-faux à droite**. ⚠️ **Maintenant que la Terre autour
    ne le cache plus, c'est LE PREMIER DÉFAUT VISIBLE du bloc au repos.**
    Et l'habillage n'est pas porté (parois blanc uni, **liseré de côte énorme**).
  - **Réserves honnêtes** : le cache n'a pas eu besoin d'être protégé **parce qu'au repos il
    ne déborde pas** (250 à 1 244 tuiles pour 1 700) — ⚠️ **raisonnement valable tant qu'il ne
    déborde pas, non mesuré sur un crop continental** · **le gain rétrécit avec le cran** :
    à z10 le crop fait 576 tuiles, **le gain tombe à ~un quart** — ⚠️ *« annoncer on divise
    par dix serait faux »*. **Dixième chiffre borné volontairement.**
- **Tâche N : relecture — CONFORMITÉ ✅ avec réserves. 0 critique, 3 importants, 5 mineurs.**
  - ✅ **LE CHIFFRE FONDATEUR EST VÉRIFIÉ AU BIT PRÈS** depuis les JSON bruts (351→36, 315→0,
    688→60), **y compris l'A/B apparié** à 26 594 m : **même signature de lieu, même altitude
    à 10⁻¹¹ près — une VRAIE paire, pas deux prises successives.**
  - ✅ **La campagne est authentique** (journaux sur disque conformes au récit).
    ✅ **Les deux codes morts étaient RÉELLEMENT morts** — le relecteur a testé le pavage des
    tuiles sur **200 000 tirages : 0 violation.**
  - ✅ **La loi d'estompage (Tâche G) est BYTE-IDENTIQUE avant/après** — la consigne « tu
    changes QUAND, jamais la loi » est tenue.
  - ✅ **Ses trois mutations de branchement sont toutes TUÉES.**
  - ⚠️ **IMPORTANT 1 — « 3 216 images à écart nul, 53 s » EST PRÉSENTÉ COMME UN RELEVÉ VIVANT
    alors qu'aucune trace de cette longueur n'existe sur disque : c'est une BOUCLE DE TEST
    SYNTHÉTIQUE rejouant la même constante.** ⚠️ **Onzième chiffre à corriger sur ce chantier
    — et cette fois ce n'est pas une monnaie fausse, c'est une NATURE de preuve surdéclarée.**
  - ⚠️ **IMPORTANT 2 — une SURVIVANTE réelle trouvée par le relecteur** : `kids.every(...)` →
    `kids.some(...)` dans **la règle sans-trou de `_traverse`** survit à 181 tests.
    **Ligne PRÉEXISTANTE, non touchée par ce diff — mais directement invoquée par le
    raisonnement qui justifie un des retraits de code mort.**
  - ⚠️ **IMPORTANT 3 — la correction « globe par valeur vs par fonction » ne tient qu'à UN
    SEUL test sur 9 usages** dans le fichier : juste aujourd'hui, **fragile à un refactor.**
  - ⏸️ **Tour 1 mis en file** — l'arbre est occupé par la Tâche M (« ultra important »).
- **Tâche M livrée** (`a0e0499`) — vérifié : arbre propre, **3 845 tests** (+39),
  `audit:tests` **206/206**, **42/42 mutations**, page chargée drapeau levé ET baissé,
  **CRLF contrôlé** (les deux `--stat` concordent).
  - ✅ **LE CRITÈRE EST TENU, MESURÉ DANS L'APPLICATION VIVANTE** : descente **1 600 km →
    506 m, 1 158 images : ZÉRO saut, ZÉRO recul, ZÉRO `_rechargeTuiles`.**
    **Pire rapport image-à-image sur toute la descente : 1,026** — et c'est le glissé orbital,
    pas une transition.
    **Même trajet, drapeau basculé en direct dans la même session : ×3,2000 à la traversée
    orbite→surface, ×1,1429 au cran z7→z8, et 616 TUILES PRÊTES RENDUES AU RÉSEAU.**
  - ⚡ **TROIS CHOSES PLUS PROFONDES QUE MON BRIEF — ET LA PREMIÈRE ME CORRIGE :**
    1. ⛔ **`STEP_IN` FAISAIT DEUX MÉTIERS** : le cran (libre, ×√2, mesuré) **et le budget du
       niveau de MNT** (×2 — **la grille de tuiles, pas un réglage**). ⚠️ **C'est CETTE
       confusion qui valait « deux fois trop », pas une simple valeur mal choisie.**
       Séparés ; **la molette est inchangée au bit près.**
    2. ⛔ **L'ACCROCHAGE N'EST PAS `poseCranContinu`, C'EST LA GRANDEUR QU'ELLE CONSERVE.**
       Reposer la caméra est **obligatoire** (l'unité change) ; elle conservait l'altitude
       **VERTICALE**, qui porte l'exagération. **Les deux discontinuités mesurées valent
       EXACTEMENT `exagération(z7)` et `3,2/2,8`.** L'invariant est désormais `altitudeFondM`,
       et la conversion tombe **sur la même image** que le changement d'emprise —
       ⚠️ **ce qui ferme au passage l'image à moitié d'altitude qui faisait ONZE BASCULES
       du seuil.**
    3. **`escalier-zoom.js` NE PEUT PAS disparaître entier** : `intersectionGlobe` (empêche de
       plonger à l'antipode) et `viseeArrivee` (**a supprimé 700 km de dérive**) **ne sont pas
       des paliers.** ⚠️ **Mon brief demandait « le module entier » — j'avais tort.**
  - ⛔ **CE QU'IL VOIT ET NE MAQUILLE PAS : en dessous de ~3 km L'IMAGE N'EST PAS COMPOSÉE** —
    la nappe de mer **coupe le relief en plein milieu du crop**, et à 900 m la caméra est
    contre une paroi. ⚠️ **Ces altitudes ne sont atteignables QUE depuis cette tâche.**
    *« La descente est continue jusqu'au sol ; je ne prétends pas qu'elle soit belle jusqu'au
    sol. »* **Et le porte-à-faux de la mer signalé par N est confirmé, bien visible.**
  - ⚠️ **DEUX BANCS QUI ONT MENTI, DÉCLARÉS** : la première campagne a rendu **42/42 sur un
    worktree SANS `node_modules`** — **tout échouait déjà** ; et **le volet caché du navigateur
    mettait `camera.aspect` à `NaN`**, rendant **un écran vide sans une seule erreur**.
    ⚠️ **Le chiffre « après » du volet ④ n'a PAS pu être relevé dans l'application vivante
    (429 du fournisseur de tuiles)** — il vient d'un banc hors réseau à témoin nul,
    **et c'est dit à chaque fois.** **Douzième borne volontaire du chantier.**
  - ⚠️ **RÉSERVE POUR ADRIEN** : **l'exagération figée à ×2 déplace d'un facteur 1,4 tous les
    seuils dérivés d'`altitudeCadrageM()`** — **le crop naît plus haut**.
    ➡️ **Décision du contrôleur en son absence : ACCEPTÉ.** Naître plus haut sert « aucun
    saut » et Adrien a validé ×2 sans réserve. **À lui confirmer au retour.**
  - Autres réserves : **les boutons `+`/`−` disparaissent avec l'indicateur** sous ce drapeau ·
    **le clic sur le globe consulte encore `DIVE_TIERS`** · l'élan orbital ne traverse pas la
    porte.
- **Tâche M : relecture — CONFORMITÉ ✅. 0 critique, 0 important, 3 mineurs.
  LA TÂCHE LA PLUS PROPRE DU CHANTIER.**
  - ✅ **Le critère recalculé DIRECTEMENT depuis `AP-descente.json` — concordant jusqu'au
    dernier chiffre publié.** Les discontinuités « avant » (**×3,2000, ×1,1429, 616 tuiles**)
    **recalculées depuis `AV-rafales.json` : exactes.**
  - ✅ **Le relecteur a évité le piège que la tâche venait de payer** : il a vérifié que
    `npm test` **s'exécute vraiment** dans son worktree neuf (3 844/3 845, l'échec étant un
    fichier de données gitignoré, sans rapport avec le diff).
  - ✅ **LES TROIS CORRECTIONS À MON BRIEF SONT VÉRIFIÉES DANS LE CODE** — les deux métiers de
    `STEP_IN`, la grandeur conservée comme vraie coupable, et la survie nécessaire
    d'`escalier-zoom.js`. ⚠️ **Y compris que les valeurs de la table d'exagération
    (2,5 / 5 / 4 / 3,2 / 2,8) correspondent EXACTEMENT à la fonction vivante.**
    ➡️ **Mon brief avait tort trois fois, et l'implémenteur avait raison trois fois.**
  - ✅ **Trois mutations de branchement du relecteur : toutes tuées.** Une n'était attrapée
    **que par une expression régulière sur le texte source**, pas par un test de comportement
    → **mineur signalé.**
  - ✅ **Captures inspectées : elles correspondent ou SOUS-ESTIMENT ce que le texte annonce**
    (bande grise en plein crop et image de collision contre une paroi vérifiées).
  - Mineurs : un garde de test purement textuel · **un renvoi cassé dans `brief-M.md` vers une
    section d'arbitrage absente** (ma faute : le fichier `regle-D12.md` porte en réalité D13) ·
    le décompte de tests d'un artefact de worktree.
- **Tâche M : complete** (`a0e0499`, 0 tour, 3 mineurs différés).
- **FILE DES TOURS DE CORRECTION, tous derrière P2 (la texture) qui occupe l'arbre :**
  **J bis** (borne `h > 0` non couverte) · **K** (2 mutations survivantes, chemin
  expérimental) · **N** (nature de preuve surdéclarée · `kids.every → kids.some` survit ·
  correction fragile à un seul test).
  ➡️ **DÉCISION : les regrouper en UN SEUL tour de correction quand P2 rendra l'arbre.**
  Aucun n'est visible à l'écran, tous sont de la couverture — **trois dispatches séparés
  coûteraient trois fois le contexte pour le même résultat.**
- **Tâche P2 livrée** (`06b2339`) — ⚡ **LE SAUT VISUEL DU CHANTIER.** Vérifié : arbre propre,
  **3 872 tests** (+27), `audit:tests` **207/207**, **34/34 mutations dont 20 sur le
  branchement**.
  - ✅ **CADRAGES APPARIÉS** — le piège qui invalidait toute comparaison est fermé. ⚠️ **Le
    « 0,009 % » ci-dessus était le chiffre publié à l'époque ; corrigé plus bas (ligne ~760)
    et dans `rapport-P2.md` §1 — la source donne 0,05 %, pas 0,009 %.**
  - ✅ **À l'écran** : avant, **un dégradé brun-vert lisse, sans un grain**. Après, **les
    crêtes sont peignées, les ravines creusées, les remparts du cirque se détachent un par un,
    la couronne sommitale passe au blanc, les fonds de vallon virent au vert humide.**
    **101 423 pixels changés = 40,4 % du bloc**, amplitude moyenne **62,5/255**,
    **témoin nul PROUVÉ** (cacher le globe change 251 157 px), aller-retour exact.
  - ⛔ **LE PORTAGE ÉTAIT PLUS PROFOND QUE MON BRIEF, ET LA COMPARAISON APPARIÉE L'A RÉVÉLÉ —
    PAS LES TESTS.** `hNorm` **n'est pas la même grandeur des deux côtés** : le socle
    normalise sur l'amplitude **COMPLÈTE** de son MNT, **fond marin compris**, donc le niveau
    de la mer y tombe à **0,4462, pas à zéro**. Appliqué au `hNorm` de la Tâche D, le pivot
    0,65 rendait `rampT = 0` pour **tout ce qui est sous 1 163 m** : **une île entièrement
    verte, texturée mais fausse.** Le nuanceur emploie désormais `hNormRelief`, converti
    depuis `uOceanDepth`/`uLandMax` — **écart au socle : 0,0029.**
  - ⚡ **ET IL A CHOISI D'EXTRAIRE PLUTÔT QUE DE TRANSCRIRE** : la loi vit dans
    `src/monde/naturel-crop.js` (module pur) que **`terrain.js` ET `globe.js` injectent** —
    **une seule écriture**, et **un test interdit qu'une formule reparaisse ailleurs**.
    ✅ **Socle de production vérifié BIT-IDENTIQUE : 0 pixel sur 1 024 000, sur trois
    chargements, `git stash` à l'appui.** ➡️ **C'est l'option ② de la règle D13, et c'était
    la bonne.**
  - ⛔ **LA RÉSERVE QUI DEVIENT LE PROCHAIN SUJET : L'ÉCART DE LUMIÈRE EST ENTIER.**
    Le socle est un **`MeshStandardMaterial` ÉCLAIRÉ**, dosé par `mapTint`, passé au
    compositeur ; **la tuile du globe est une COULEUR NUE.**
    ⚠️ *« Aucune rampe ne comblera cet écart, et c'est lui qui saute aux yeux maintenant. »*
  - ⚠️ **Il a RETIRÉ sa première campagne de coût** : en séries séparées elle mesurait **une
    dérive d'ordre, pas le poste**. La campagne **ABBA** retenue donne **+0,039 ms ± 0,015**
    sur 1,024 Mpx, **à 2,6 écarts-types du bruit**. **Treizième retrait volontaire.**
  - Réserves : **le coût de LIAISON des deux samplers n'est pas mesuré** (il faudrait deux
    builds) — *« je le dis plutôt que d'en donner un chiffre »* · un seul lieu, un seul
    cadrage · **`mapTint` et `slopeTint` laissés**, motif écrit dans le module.
- **NOTATION 01 — la première note de conformité visuelle : GLOBALE 3,5/10.**
  (`notation-01.md`, captures et relevés dans `.banc/vues-notation/`.)
  - ⚡ **DÉCOUVERTE DE PROTOCOLE QUI CHANGE TOUT : sous `?terre=unique` le socle n'est PAS
    détruit, il est CACHÉ** (`main.js:4544`, `terrain.mesh.visible = false`).
    ➡️ **On peut donc rallumer le socle DANS LA MÊME PAGE et rendre les deux blocs à la MÊME
    SECONDE, même palette, même MNT.** ⚠️ **À imposer à toutes les notations suivantes.**
  - ⛔ **ET IL LE FALLAIT** : sa première série comparait **deux chargements**, qui **n'avaient
    pas la même palette** (paroi socle `c06a44` contre `params.plinthColor = '#d8d4cc'`).
    **Toute comparaison de teinte entre chargements était FAUSSE.** Série laissée sur le
    disque, **non utilisée pour noter la couleur.**
  - **Appariement** : intérieur **+0,0032 %**, côte **−0,058 %**. ⚠️ **Et le piège mord bien :
    à caméra identique, 216 061 px contre 294 304 — ×1,362 en aire.**
  - ⚠️ **Son premier balayage est RETIRÉ** (non monotone : l'application se recadre quand on
    bouge sa caméra). Le retenu passe par **un clone** — deux mesures du même point rendent
    **232 566 et 232 566**. **Témoins : 0 pixel sur 1 024 000, partout.**
    **Quatorzième retrait volontaire du chantier.**
  | critère | note | mesure |
  |---|---|---|
  | Richesse du relief | **6/10** | énergie de détail **11,661 vs 16,435 → 71 % du socle** |
  | Palette et contraste | **3/10** | hors bande orange **0,26 % vs 16,92 % (×65)** ; **6 secteurs de teinte sur 12 à ZÉRO pixel** |
  | Trait et bordure | **3/10** | porte-à-faux ouest ; ⚖️ `uContourOpacity = 0` **des DEUX côtés — non imputable au crop** |
  | La mer | **2/10** | écume **26 128 vs 3 376 px (×7,7)** ; teinte 210–240° **×29,2** |
  | Parois et base | **2/10** | `d8d4cc` contre `c06a44` **au même instant** ; ombre portée **26 729 px vs 0** |
  | Propreté | **3/10** | **≥6 jupes pendantes**, écume en plaques |
  - ➡️ **« Non, ça ne ressemble toujours pas au socle — mais le peigné est réel et CE N'EST
    PLUS LA TEXTURE QUI MANQUE. »** *Huitième tâche à le dire plutôt qu'à conclure au succès.*
  - **LES CINQ MANQUES, PAR ORDRE :**
    1. ⚡ **L'ÉCLAIRAGE DES TUILES** — *P2 confirmé PAR L'EXPÉRIENCE* : couper l'hémisphère du
       socle retire **53,7 % de sa richesse de teinte** et **58,7 % de ses neutres** ; couper
       le soleil retire **43,3 % de son énergie de détail**.
       ⛔ **MAIS CORRECTION À P2 : le compositeur n'est PAS en cause** — `composer.addPass(
       passeFond, 0)` (`main.js:4412`) **y fait passer le crop aussi.**
       Où : nuanceur de tuile `globe.js` ~1039-1240, **`uSunDir`/`uShadowColor` y sont DÉJÀ**.
       Coût : peu de GLSL, **mais l'accord d'exposition avec le `MeshPhysicalMaterial` est
       délicat.**
    2. **LA COULEUR DES PAROIS** — `globe.js:3520` code **`#d8d4cc` EN DUR**.
       ⚡ **Coût TRÈS FAIBLE : le gain le moins cher du tableau.**
    3. **L'ÉCUME** — `globe.js:322-324` + normalisation du déclin (`3120-3128`). Coût moyen,
       **résolution du champ à vérifier** (bande quantifiée).
    4. **Nappe de mer ≠ dessus du bloc** — coût **cher** (accord de géométrie à trois).
       ⚠️ **Plus grave à l'œil que 2 et 3, placé après eux par RENTABILITÉ.**
    5. **Jupes + ombre portée** — `skirtDrop` (`globe.js:4127-4162`) ; l'ombre bute sur
       **`passeFond.skipShadowMapUpdate = true`** (`main.js:4410`).
  - ⚠️ **Une mesure ABANDONNÉE plutôt que fausse** : la largeur de la frange côtière **ne
    sépare pas l'écume des crêtes enneigées** — aucune largeur reportée.
- **Tâche P2 : relecture — NON-CONFORMITÉ ❌. 1 critique, 3 importants, 4 mineurs.**
  ⚠️ **Non-conformité LIMITÉE : la tâche n'est pas à refaire, mais un chiffre-titre n'est pas
  traçable à sa propre source.**
  - ✅ **LA TROUVAILLE `hNorm` ≠ `hNormRelief` EST RÉELLE**, recalculée indépendamment :
    **le seuil de 1 163 m tombe EXACTEMENT juste.** ⚡ **Et le relecteur a fait mieux que
    vérifier : il a MUTÉ `hNormRelief` → `hNorm` dans `globe.js`. Le test `⑤d` tue la
    régression AUJOURD'HUI — mais RIEN, avant P2, ne l'aurait fait.**
    ➡️ **CONFIRMÉ : c'est la comparaison À L'ÉCRAN, pas les tests, qui a révélé le bug.
    ENSEIGNEMENT DE MÉTHODE POUR TOUT LE CHANTIER.**
  - ✅ **L'extraction est propre** : `naturel-crop.js` **réellement pur** (aucun import), les
    deux nuanceurs **injectent le même texte GLSL**, et **le test d'unicité MORD** (vérifié en
    y réinjectant une formule dupliquée).
  - ✅ **Trois mutations de branchement du relecteur, TOUTES TUÉES** (retrait de `hemi` de la
    surveillance, contournement de la garde `uAnalysisOn`, court-circuit de `contexteCrop`).
  - ⚡ **LE DÉSACCORD EST TRANCHÉ : LE NOTEUR AVAIT RAISON, P2 AVAIT TORT.**
    `main.js:4412` **fait bien passer le crop par la même passe de gradation finale**
    (`main.js:2430`) que le socle. **Le compositeur n'est pas en cause.**
  - ✅ **Suite réellement exécutée** (piège du 42/42 fantôme évité par jonction
    `node_modules`) : **3 871/3 872 en 32 s réelles**, l'unique échec étant un fichier de
    données absent d'un worktree neuf.
  - ⛔ **CRITIQUE — le chiffre-titre « cadrages appariés à 0,009 %, cent fois mieux que le 1 %
    demandé » NE SE RETROUVE PAS DANS SA PROPRE SOURCE** (`cadrage-apparie.json`), qui ne
    contient que **5 essais et non 10**, et calcule elle-même **−0,05 %** pour la paire
    retenue. **Le rapport a substitué une mesure ULTÉRIEURE et SÉPARÉE (251 157 au lieu de
    251 258) pour cette seule ligne, sans le dire.**
    ⚠️ **C'est exactement le défaut endémique du chantier — QUINZIÈME occurrence.**
    **La conclusion de fond tient (0,05 % reste 20× mieux que la barre), le chiffre publié
    non.**
  - ⏸️ **Ajouté à la file des tours groupés.**
- **FILE DES TOURS DE CORRECTION — QUATRE, tous derrière P3 (l'éclairage) :**
  **J bis** (borne `h > 0`) · **K** (2 mutations survivantes, chemin d'essai) ·
  **N** (nature de preuve surdéclarée · `kids.every → kids.some` · correction fragile) ·
  **P2** (⛔ **le chiffre-titre non traçable**).
  ➡️ **UN SEUL tour groupé quand P3 rendra l'arbre.**
- **Tâche P3 livrée** (`0700848`) — vérifié : arbre propre, **3 905 tests** (+33),
  `audit:tests` **208/208**, **36/36 mutations dont 24 sur le branchement**, page chargée
  drapeau levé ET baissé. **Cadrages appariés à 0,048 %, socle RALLUMÉ DANS LA MÊME PAGE**
  (le protocole du noteur, adopté).
  - ✅ **À l'écran** : le bloc porte **les mêmes ocres, les mêmes rouges de rempart et la même
    couronne blanc cassé** que le socle, **et son versant à l'ombre s'assombrit**.
    **La tranche est terracotta (`c06a44`)** au lieu du `#d8d4cc` codé en dur.
  - ⚡ **TROIS CORRECTIONS À MON CAHIER DES CHARGES, TOUTES MESURÉES :**
    1. ⛔ **LE SOLEIL DU CROP N'ÉTAIT PAS LE SOLEIL — C'ÉTAIT LA CAMÉRA.** `main.js` repose
       `globe.setSunDir(camGlobe.position tournée de 42°)` **à chaque image**. Relevé :
       `uSunDir = (0,2282 · −0,3679 · 0,9014)` contre **`(0,4392 · 0,5631 · −0,7002)`** pour
       le soleil de la scène. ⚠️ **Personne ne l'avait vu en dix tâches.**
    2. ⛔ **L'AMBIANTE (`scene.environment`) PÈSE 47 % DE L'IRRADIANCE DU SOCLE**, et personne
       ne l'avait comptée — mesurée à `E = (2,0155 · 2,0153 · 2,0152)` sur **133 786 pixels**,
       **à l'exécution, pas posée en dur**. Au passage : **`params.envMapIntensity` est du
       CODE MORT sur le relief** (three l'écrase). **Huitième code mort du chantier.**
    3. ⛔ **LE GABARIT D'OUVERTURE ALLUME UNE COUCHE « APPARENCE » (`surfaceFx: 9`) QUI
       MULTIPLIE L'ALBÉDO DU SOCLE PAR 0,59.** **Aucune tâche ne l'avait nommée.** Sans elle
       le crop sortait **1,7 fois trop clair** — ⚠️ *« ce que ma première version a mis à
       l'écran avant que la mesure ne le dise »*.
  - **Résultat chiffré** (paire appariée, 223 634 px) : luminance moyenne **−12,3 % → +1,0 %** ·
    écart-type de luminance **+64,3 % → +6,4 %** · saturation **+24,0 % → −14,4 %** · neutres
    **−40,7 % → +20,7 %** · énergie de détail **+29,3 % → −19,6 %**.
    ➡️ **Six critères sur sept se rapprochent**, deux dépassent la cible et changent de signe.
  - ⛔ **« Non, ça ne ressemble toujours pas au socle »** : la mer **constellée de plaques
    blanches** et **ne rejoint pas le dessus du bloc**, les jupes pendent, **aucune ombre
    portée** — manques n° 3 à 5 du noteur. *Neuvième tâche à le dire.*
  - ⚠️ **Réserves** : **le coût n'est pas mesuré** (« le fragment le plus chaud vient de
    grossir ») · un seul lieu, un seul moment du jour · le motif de l'apparence est **ancré au
    bloc et non vérifié en mouvement** · ⛔ **la comparaison bit-à-bit du socle de P2 N'A PAS
    ÉTÉ REJOUÉE alors que `terrain.js` est touché en DEUX endroits.**
    ➡️ **À VÉRIFIER DANS LE TOUR GROUPÉ — c'est la garantie de P2 qui pourrait être rompue.**
- **Tour de correction GROUPÉ livré** (`3b332a7`) — **les SEPT points TRAITÉS**. Vérifié :
  arbre propre, **3 910 tests** (+5), `audit:tests` **208/208**.
  ⚡ **Et chaque test tueur a été VÉRIFIÉ EXPÉRIMENTALEMENT** : mutation remise sur le disque,
  test rejoué pour confirmer l'échec, puis remise à zéro avec `git diff --stat` vérifié vide
  — **avant de passer au point suivant.** *C'est la discipline qu'on cherchait depuis le début.*
  - **①** Le chiffre-titre de P2 corrigé : la source porte **5 essais et non 10**, et calcule
    **−0,05 %**. **« Vingt fois mieux » remplace « cent fois »**, conclusion préservée.
  - ⚡ **② LA REJOUÉE A RÉVÉLÉ AUTRE CHOSE, ET C'EST IMPORTANT : il existe un BRUIT DE RENDU
    D'UN CHARGEMENT À L'AUTRE, ≈ 2,2 % DES PIXELS, MÊME À CODE IDENTIQUE.**
    Le socle n'est donc **plus littéralement à 0 px** — mais **l'écart entre les deux codes
    n'est pas plus grand que ce plancher de bruit** : **aucune régression décelable de P3**.
    ⚠️ **CONSÉQUENCE À RETENIR : la garantie « 0 pixel sur trois chargements » annoncée par
    P2 était donc plus fragile qu'elle n'en avait l'air — toute preuve bit-à-bit ENTRE
    CHARGEMENTS doit désormais être adossée à un plancher de bruit mesuré.**
    ➡️ **DIXIÈME façon dont un banc peut mentir ici. À écrire dans le §0.**
  - **③** La phrase « 3 216 images » **requalifiée dans le code ET dans le rapport** : c'est
    une **boucle synthétique prouvant `ln(1) = 0` par construction**, pas un relevé vivant.
  - **④** `kids.every` → `kids.some` **couvert par un test sur un VRAI quadtree à mi-charge**.
  - **⑤** La correction « par valeur vs par fonction » **durcie par un test STRUCTUREL à la
    construction**, indépendant du test de comportement.
  - **⑥** Les deux survivantes de K couvertes · **⑦** la borne `h > 0` couverte avec un
    **vrai champ de fond fini**.
- **Tâche P4 livrée** (`a4ec5b1`, 4 commits) — vérifié : arbre propre, **3 947 tests** (+42),
  `audit:tests` **209/209**, **37/37 mutations dont 25 sur le branchement**.
  - ⛔ **MON BRIEF SE TROMPAIT SUR LES DEUX CAUSES, ET LE DIRE A FAIT GAGNER DU TEMPS :**
    1. **Les trois constantes que j'accusais (1,8 / 1,1 / 0,96) sont IDENTIQUES des deux côtés
       et n'ont jamais divergé.** Ce qui divergeait, ce sont **QUATRE ENTRÉES** : le déclin
       côtier (`ocean.js` lit `smoothstep(0, 0.35, max(2×profondeur, distance))`, **la calotte
       passait la distance BRUTE** — bande de ressac sur **68,72 %** des nœuds d'eau contre
       **10,41 %** avec la loi du socle) · les **deux accalmies vivantes**
       (`uViewCalm = 0,4039`, `uSurfCalm = 0,08` → **ressac 31 fois trop fort**) · le facteur
       `(0,5 + 0,5·uFoamScale)` · et **la tavelure indexée en espace de SPECTRE avec un `0,08`
       inventé — cellules 5,25 fois trop larges : CE SONT LES PLAQUES.**
    2. ⛔ **Le manque n°4 n'est PAS un désaccord `poserMer`/`construireParoisCrop` : les deux
       s'accordent parfaitement.** Sous l'eau **la lèvre du bloc plonge au fond marin pendant
       que la nappe reste à zéro**. ⚡ **LE SOCLE A UN RIDEAU D'EAU (1 474 sommets) QUE LE CROP
       N'AVAIT PAS** — A/B dans la même page : **cacher la jupe du socle change 30 453 px et
       fait apparaître le MÊME porte-à-faux.** ⚠️ **Trois tâches avaient signalé le symptôme ;
       aucune n'avait trouvé la cause.**
    3. ⛔ **Et corriger le signe de `bordDeMer` A FAIT DISPARAÎTRE LA MER ENTIÈRE** : `dBord`
       était **muet à l'intérieur** (`cq = max(…,0)`, et **`uCropCoin` vaut 0** dans
       l'application) — **le fondu ne pouvait STRUCTURELLEMENT pas rentrer.**
       ⚠️ **Un test VERROUILLAIT ce défaut depuis la Tâche J** ; réécrit avec son motif.
  - ✅ **À l'écran** : AVANT, **une dalle blanchâtre en plaques qui déborde par-dessus l'arête
    ouest**. APRÈS, **nappe bleue continue, liseré blanc fin collé au trait de côte, l'eau
    rencontre le mur.** Écume vraie, **témoin d'extinction pur des deux côtés, même seconde :
    1,86 % de la mer du crop contre 2,22 % au socle** — **désormais légèrement SOUS la
    référence.** Saturation **0,127 → 0,348** pour **0,319** au socle.
  - ⛔ **« Non, ça ne ressemble toujours pas au socle » — et le nouveau dominant est nommé :
    LE FOND MARIN DU CROP EST EN TERRASSES.** Écume éteinte, **86 % des pixels « clairs et
    peu saturés » restent** : **c'est le plateau peu profond, pas de l'écume.**
    ➡️ **C'est de la SURFACE (famille J bis / K), pas de la mer.** *Dixième tâche à le dire.*
  - ⚠️ **Réserves** : **l'état de mer du crop N'EST PAS BRANCHÉ** (chop 0,7 contre 1,
    `uFoamScale` 0,35 contre 1 — **deux mers différentes**, trou de branchement non fermé) ·
    **il n'a pas pu descendre à 3 km** (`controls.minDistance` bloque, `altitudeCadrageM`
    cesse de suivre à 5 445 m) donc **le troisième fait du brief reste ouvert** ·
    ⚠️ **LA PREUVE BIT-À-BIT DU SOCLE EST RETIRÉE — plancher de bruit à code identique
    33,28 % contre un effet de 31,58 % : LE PLANCHER EST PLUS GRAND QUE L'EFFET.**
    **Seizième retrait volontaire.**
- **Relecture groupée P3 + P4 — LES DEUX CONFORMITÉ ✅** (1 important + 1 mineur chacune).
  - ✅ **LES SIX AFFIRMATIONS-TITRES CONFIRMÉES DANS LE CODE SOURCE, pas dans la prose** :
    le soleil-caméra (`uSoleilDir` contre `uSunDir`), **`envMapIntensity` mort — vérifié
    contre le code de three lui-même**, `surfaceFx: 9` dans `shibustart.json`, les quatre
    entrées divergentes de la mer, **le rideau d'eau manquant**, et le défaut de distance
    signée de `dBord`.
  - ✅ **Suite RÉELLEMENT exécutée** (piège du worktree sans `node_modules` évité) :
    3 946/3 947, `audit:tests` 209/209.
  - ✅ **Trois mutations de branchement de son cru : toutes tuées avec un diagnostic précis.
    Aucun code mort trouvé.**
  - ✅ **Captures inspectées : NON embellies** — les manques visibles correspondent à la prose.
  - ✅ ⚡ **LE SEIZIÈME RETRAIT EST JUGÉ SAIN** : le raisonnement « plancher de bruit 33,28 %
    > effet 31,58 % » tient, **et les deux chiffres de bruit (2,2 % et 33,28 %) sont
    correctement gardés distincts selon leur contexte.**
  - ⚠️ **Deux écarts RÉELS, tous deux dans le RAPPORT et non dans le code :**
    1. **P3 §5** : *« cinq d'entre eux divisent l'écart par plus de deux »* est
       **arithmétiquement faux** recalculé depuis ses propres pourcentages — **seulement 3 sur
       6** dépassent un facteur 2. **Dix-septième chiffre à corriger.**
    2. **P4 §7** : la statistique CRLF de clôture **ne correspond qu'au PREMIER de ses quatre
       commits** (1 237/76/8 au lieu de 1 433/77/8 sur toute la plage) — **chiffre périmé,
       CRLF toujours propre.**
  - ➡️ **Les deux vont dans le prochain tour groupé — ce sont des corrections de rapport.**
- **Tâche P5 livrée** (`61de597` + `4a182a3`) — vérifié : arbre propre, **3 965 tests** (+18),
  `audit:tests` **209/209**, **38/38 mutations dont 26 sur le branchement**.
  - ⛔ **MON BRIEF ÉTAIT FAUX, ET IL LE PROUVE : LA BATHYMÉTRIE N'EST PAS QUANTIFIÉE.**
    Le champ rend **5 299 valeurs distinctes sur 5 448 nœuds d'eau**, sa pente est à **9,4 %**
    de celle du MNT du socle, sa courbure à **73-79 %**. *Sixième fois qu'un implémenteur
    corrige mon cahier des charges — et six fois sur six il avait raison.*
  - ⚡ **LES « GRADINS » ÉTAIENT DEUX ENTRÉES DE LA LOI DE COULEUR, POSÉES À DES DÉFAUTS QUE
    PERSONNE N'AVAIT JAMAIS BRANCHÉS :**
    - **`couleursFond` est un paramètre de `poserMer` QU'AUCUN APPELANT N'A JAMAIS PASSÉ** —
      la calotte gelait le défaut de `terrain.js` (`#dce8ec/#7fa8b8/#31576b`) quand le socle
      vit sur `#c8f2e4/#62cfc1/#136e7d`.
    - **`uMerFondBudgetM` prenait la profondeur de la CALOTTE (3 510,49 m)** là où le socle
      prend celle de **son BLOC (2 116 m)** : **la frange pâle était EXACTEMENT deux fois trop
      large** (38,88 % des nœuds d'eau contre 19,81 %).
    ✅ Les deux fermées : **la couleur du fond marin égale celle du socle à 1 unité sur 255
    par canal, à sept profondeurs** ; sur le fond nu, luminance **183,89 contre 184,64**.
  - ⚠️ **IL A RETIRÉ UNE MESURE** : sa première rugosité (« le champ est 5 à 7 fois plus
    lisse ») **était le BRUIT D'ARRONDI ENTIER du MNT du socle** — le même champ arrondi au
    mètre rend **0,531 contre 0,526**. **Dix-huitième retrait.** Et **une mutation NEUTRE**
    (dernière clé gagnante dans un littéral d'objet) **dite, pas comptée.**
  - ⚡ **LE SECOND LOT AVAIT SIX ÉCARTS, PAS DEUX** : houle, chop, écume, échelle d'écume,
    brillance, **et LA VITESSE (`uSpeedMul` 0,4 contre `uMerVitesse: 1` codé en dur) que
    PERSONNE n'avait nommée — la houle du crop défilait 2,5 fois trop vite.**
    Écrivain unique : `majReglagesMer`, par image, depuis les uniformes vivants.
    ⚠️ **Un test existant a attrapé sa première écriture**, qui cédait `terrain.mapUniforms`
    en bloc.
  - ⛔ **NOUVEAU DOMINANT : le flanc EST est un grand aplat beige à arête en ESCALIER** —
    la face de la paroi, **que la nappe ne couvre pas jusqu'à la frontière** — **avec les
    jupes qui pendent dessous. Plus visible que ce qu'il vient de réparer.**
    Et ⚡ **« presque tout ce qui reste vit dans la LAME D'EAU, pas dans le fond »** :
    concentration de luminance **80,97 % contre 30,33 %** avec la nappe, **40,14 % contre
    38,73 %** sans elle.
  - Réserves : l'échelle de longueur de houle non branchée (**×1,818, mesurée**) ·
    **la vitesse — précisément ce qui ne se voit pas au repos — non vérifiée en mouvement.**
- ⚡⚡ **MOTIF SYSTÉMIQUE ENFIN NOMMÉ, ET IL FAUT L'ATTAQUER EN BLOC :
  DES PARAMÈTRES À DÉFAUTS QUE PERSONNE N'A JAMAIS BRANCHÉS.**
  Déjà trouvés **un par un, au fil des tâches** : la **couleur des parois** (`#d8d4cc` en dur)
  · **`uSky`** · **`couleursFond`** · **la direction du soleil** (c'était la CAMÉRA) ·
  **l'ambiante** (47 % de l'irradiance, jamais comptée) · **`surfaceFx: 9`** (albédo ×0,59) ·
  **`uMerFondBudgetM`** · **six réglages d'état de mer dont la VITESSE**.
  ➡️ **PROCHAINE TÂCHE : un AUDIT EXHAUSTIF de tous les paramètres du crop contre leurs
  homologues du socle — au lieu de les découvrir un par un, tâche après tâche.**
- **Tâche P6 livrée** (`f78cb3f`, 4 commits) — ⚡ **L'AUDIT A PAYÉ, ET AU-DELÀ.** Vérifié :
  arbre propre, **4 001 tests** (+36), `audit:tests` **209/209**,
  **72/72 mutations dont 57 (79 %) visant le branchement.**
  - ⚡ **LE TABLEAU — 77 lignes lues DANS LA MÊME PAGE À LA MÊME SECONDE** (`.banc/P6/TABLEAU-P6.json`) :
    | classement | compte |
    |---|---:|
    | ⛔ **jamais branchés, trouvés ET fermés** | **20** |
    | ✅ déjà branchés (C, P2, P3, P4, P5), dont 4 par conversion | **43** |
    | ⚠️ **non fermés, listés par écart visuel** | **11** |
    | sans homologue | **3** |
  - **Les vingt fermés** : ⛔ **le soleil de la MER et des PAROIS était AUSSI la caméra —
    P3 n'avait corrigé que les tuiles**, et ⚡ **le terminateur de planète appliqué aux parois
    EST le grand aplat beige que P5 signalait en réserve n°1** · `uSunColor` `#ffffff` en dur ·
    **quatre réglages de lame d'eau SANS AUCUN uniforme côté crop** (`uTransp 0,57` → eau
    **1,556× trop opaque**, `uSunFx`, `uDayLight`, `uDetail`) · les deux couleurs d'eau ·
    le spectre et son échelle · ⚡ **LA FORME DU BLOC : le crop était un CARRÉ À ANGLES VIFS**
    contre un squircle 0,08/4,4 · la profondeur.
  - ⛔ **CORRECTION À MON BRIEF, ET ELLE EST PLUS PROFONDE QUE LE MOTIF QUE J'AVAIS NOMMÉ :
    le pire défaut n'était pas un paramètre ABSENT mais UNE VALEUR JUSTE DANS LA MAUVAISE
    MONNAIE.** `uMerHoule` en **unités de socle** sur un maillage en **unités de scène** :
    **121,6 fois trop haute**, ⚠️ **et P5 l'a AGGRAVÉE ×4 en la branchant « correctement »**.
    **Elle repliait le maillage et peignait la mer en rubans à bords en escalier.**
    ⚡ **Trouvée À L'ÉCRAN, pas dans le code : tous les relevés de valeurs disaient
    « branché, concordant ».**
  - ⚡⚡ **SECONDE LEÇON DE MÉTHODE, À GARDER POUR TOUT LE CHANTIER : UNE CONCORDANCE AU
    DÉFAUT N'EST PAS UN BRANCHEMENT.** `couleurs` et `profondeur` rendaient **exactement** la
    valeur du socle **par coïncidence** — **c'est le témoin (`lakeColor → #c81e1e`) qui les a
    démasqués.** ➡️ **Tout audit de branchement doit passer par un TÉMOIN ABERRANT, jamais
    par une simple égalité de valeurs.**
  - **Mesure** (cadrage apparié **+0,0024 %**, témoin **0 canal**) : la concentration de
    luminance sur le masque de la mer passe de **80,97 % (P5) à 48,50 %** contre **30,25 %**
    au socle — **et le socle se reproduit à 0,08 point près**, ce qui rend la comparaison
    légitime.
  - ⛔ **« Non, ça ne ressemble toujours pas au socle »** : **le flanc en escalier reste le
    dominant**, et le détail local de la mer est encore **2,5 à 2,9× plus faible**
    (réfraction, caustiques, résolution du champ — **trois causes nommées, aucune tranchée**).
  - **Dix réserves**, dont : **aucune mesure de coût** · le clapot de normale ne déplace rien
    à cette altitude (**0,01 point — « je ne le porte pas à mon crédit »**) · ⚠️ **une mutation
    de son premier tour était NEUTRE : il la RETIRE plutôt que de la compter.**
    **Dix-neuvième retrait volontaire.**
- **NOTATION 02 (hash noté `f78cb3f`) — GLOBALE 5,3/10 CONTRE 3,5. +1,8 POINT.**
  **Trois des cinq manques de la note 01 sont fermés, chiffres à l'appui.**
  | critère | 01 | **02** | écart | mesure |
  |---|---|---|---|---|
  | Richesse du relief | 6 | **6** | **=** | énergie **65,7 %** du socle (contre 71,0 %) ⚠️ **et couper la lumière du CROP ne lui coûte que 4,22 % de modelé, contre 45,39 % au SOCLE** |
  | Palette et contraste | 3 | **7** | **+4** | hors-orange **×65 → ×2,20** ; secteurs vides **6 → 2** ; neutres passés en **excédent** |
  | Trait et bordure | 3 | **5** | **+2** | débordement terre disparu ; **forme = squircle du socle** ; mais frange en marches, nappe qui déborde **×98** |
  | La mer | 2 | **5** | **+3** | écume **×7,74 → 0** ; saturation **+40,6 % → +9,5 %** ; ⚠️ mais **+63,4 % de luminance et ZÉRO pixel de bleu profond** (socle : 7 375) |
  | Parois et base | 2 | **5** | **+3** | couleur juste **et PROUVÉE EN LA BOUGEANT** ; face sombre **1,68× trop claire** — *la réserve non mesurée de P6, levée* |
  | Propreté | 3 | **3** | **=** | plaques parties ; **12 langues / 2 186 px de jupes** contre 3 px au socle, tablier **×98** |
  - **Preuves** : appariements **+0,00308 %**, **+0,00186 %**, **−0,017 %** (balayés sur un
    CLONE de caméra, **même exécution JS que la mesure**) · **témoin nul 0 canal sur
    3 072 000 partout** · témoins non vides 194 591 / 214 655 / 129 412 px.
  - ⚡ **DÉCOUVERTE DE MÉTHODE QUI CONDITIONNE TOUTE COMPARAISON : le rendu de la notation 01
    n'est PAS l'ACES du harnais P3–P6, c'est l'OCTET LINÉAIRE** — **seul des trois testés à
    retrouver le socle** (énergie 14,883 contre 16,435 ; **ACES rend 4,202**).
    ➡️ **Les tâches P3 à P6 mesuraient donc sous une autre courbe de tonalité que les
    notations. À imposer dans tous les bancs suivants.**
  - **LES CINQ MANQUES :**
    1. ⛔ **LA NAPPE DE MER QUI DÉBORDE LA PAROI + LES JUPES** — **41 949 px de tablier contre
       428 (×98)**, 4 lames pendantes, 12 langues. Cher (accord à trois) ; **jupes : faible.**
    2. **Détail et profondeur de la mer** — ⚡ **cause NEUVE : le bleu manque en TEINTE, pas
       en détail. Une passe de réfraction n'ajoutera pas un secteur absent.**
    3. **Matière et exposition des parois** — face sombre 26,63 contre 15,88 ; **faible**
       (deux constantes mesurables).
    4. ⚡ **La frange côtière quantifiée en marches — LE VRAI « ESCALIER », et il est sur la
       FRANGE, pas sur le fond.** Piste : la porter par `uCoastMask` plutôt que par le champ.
    5. **Le dernier tiers du relief** — ⚠️ **la lumière n'est plus le levier (4,22 %)** ;
       `grainForceM` toujours non passé.
  - ⚖️ **DEUX CORRECTIONS DE JUSTICE** : `uContourOpacity = 0` **des deux côtés** ; et
    ⛔ **l'ombre portée n'est PAS notable aujourd'hui** (`shadowMode = 'off'`,
    `sun.castShadow = false`, **0 px des DEUX côtés**) — **le manque n°5 de la note 01 était
    donc en partie faux.**
  - **Huit réserves déclarées**, dont un saut de masque inexpliqué, **un témoin non concluant
    gardé comme tel**, et ⚠️ **un témoin de sa main qui a abîmé l'état une fois — dit plutôt
    qu'effacé.**
- **Tâche P7 livrée** (`6373339`) — vérifié : arbre propre, **4 014 tests** (+13),
  `audit:tests` **209/209**, **31/31 mutations dont 20 sur le branchement**.
  **46 captures, 12 relevés dans `.banc/P7/`.**
  - ⛔ **MON BRIEF SE TROMPAIT SUR LA CAUSE DU TABLIER — et le noteur aussi.**
    **P4 AVAIT BIEN BÂTI LE RIDEAU D'EAU** (2 040 triangles, relevés vivants).
    ⚡ **IL NE SE DESSINAIT PAS : `construireJupeMer` posait ses index dans l'EXACT INVERSE du
    sens des parois bâties sur le MÊME anneau** — alors que **son propre commentaire
    prétendait les suivre** — **avec un matériau en `FrontSide`** (la jupe du socle est
    `DoubleSide`). Faces avant tournées vers l'intérieur → **rideau éliminé au culling** :
    **52 264 px de géométrie qui n'en rendaient 1 519.**
    ➡️ **Ce n'était pas « cher — un accord de géométrie à trois » : C'EST DEUX LIGNES.**
  - ✅ **À l'écran** : avant, **une nappe pâle à bord lobé passe par-dessus l'arête haute de la
    paroi sur tout le flanc mouillé**. Après, **la mer rencontre le mur le long d'un seul fil
    cyan — l'image du socle.** A/B à témoin nul (retournement du tampon d'index, **retour au
    pixel**) : le liséré de fond marin nu tombe de **5 314 px à 186 px** sur les 210 colonnes
    concernées (**socle : 441**). ⚡ **`DoubleSide` rend exactement la même image : on répare
    le SENS, on ne paie pas la seconde face.**
  - ⚡ **LES JUPES ÉTAIENT LA QUATRIÈME « VALEUR JUSTE DANS LA MAUVAISE MONNAIE »** :
    `skirtDrop` vaut **0,1–0,9 unité de globe**, **le bloc n'a que 0,05–0,095 d'épaisseur**.
    **2 186 px en 12 langues → 1 px en 1 langue.**
    ⚡ **Et ses 2 186 px / 12 colonnes sont AU PIXEL ET À LA COLONNE le relevé du noteur —
    ce qui valide les deux bancs l'un par l'autre.**
    ⚠️ **Le piège n'était pas la borne mais L'ORDRE** (les parois exigent des tuiles bâties) →
    retaille idempotente appelée des deux côtés. **Et la seconde sortie proposée par le noteur
    n'aurait pas marché : 168 tuiles sur 168 percent le plancher, pas seulement celles de
    frontière.**
  - ⛔ **IL A INTRODUIT UN DÉFAUT ET LE DIT** : **467 px de rideau passent devant la paroi**,
    en deux lames. **352 des 467 sont imputables au déplacement HORIZONTAL de houle appliqué
    au haut du ruban** (témoin `uMerHoule = 0`, retour exact) ; **le socle n'applique à sa
    jupe que la verticale**. Le fermer **défait la soudure que P4 a bâtie** — arbitrage à
    trois pièces. **Son essai à l'écran n'a pas conclu et il RETIRE cette mesure.**
  - ⚠️ **Il n'a PAS reproduit le « ×98 » du noteur** — cinq conventions essayées, aucune ne
    rend 41 949/428. **Il publie SA convention, pas le facteur de l'autre.** ⚠️ **Et il retire
    un premier chiffre à lui** (48 906 contre 44 196) : **il comptait la plage et la falaise.**
    **Vingt-et-unième et vingt-deuxième retraits.**
  - ⛔ **ONZIÈME FAÇON DONT UN BANC MENT, ET ELLE ME CONCERNE : LE VOLET DE NAVIGATEUR DE LA
    SESSION NE COMPOSITE PAS** — `requestAnimationFrame` rend **0 image en 3,7 s** et **la
    chaîne du crop ne se pose jamais**. Il a dû piloter **un Chrome à part** (GPU réel).
    ➡️ **Mes propres captures dans le panneau sont donc suspectes. À écrire dans le §0.**
- **Relecture groupée P5 + P6 + P7 — LES TROIS CONFORMITÉ ✅, aucun critique.**
  - ✅ **Les TROIS campagnes rejouées POUR DE VRAI au commit de chaque tâche** :
    **38/38, 72/72, 31/31 — correspondance exacte aux annonces.** Piège du worktree sans
    `node_modules` évité, **CRLF vérifié sur TOUTE la plage de chaque tâche**.
  - ✅ **Trois mutations de branchement du relecteur : toutes tuées.** **Trois tests cassés au
    hasard : tous échouent correctement** (aucun n'est vide). **Aucune fonction « fermée »
    n'est du code mort.**
  - ✅ **Les affirmations porteuses vérifiées contre le CODE, pas la prose** : `couleursFond`
    jamais passé · le budget calotte-contre-bloc · **le compte du tableau 20/43/11/3 = 77
    EXACT** · le soleil-caméra pour mer et parois · **`uMerHoule` ×121,6 auto-documenté dans
    la source** · **l'inversion de sens réparée en LITTÉRALEMENT deux lignes** · ⚡ **le
    désaccord d'unité de `skirtDrop` qui retrouve AU PIXEL le comptage du noteur** ·
    **et la régression auto-introduite, honnêtement mesurée.**
  - ⚠️ **IMPORTANT 1 — méthodologique** : **le harnais de P5 rend en LINÉAIRE BRUT**, pas dans
    la calibration que les notations emploient — **non déclaré dans son rapport**.
    ⚡ **P7 l'a corrigé en silence** (visible dans l'en-tête de son propre harnais) **sans
    jamais le nommer comme une correction.**
  - ⚠️ **IMPORTANT 2** : la méthode du **témoin aberrant** de P6 **n'a été sondée que sur 3
    des 43 entrées « déjà branchées »**, pas auditée exhaustivement.
  - Mineurs : des chiffres au pixel tirés de captures `.banc` **gitignorées donc non
    reproductibles** · ⚠️ **le désaccord du « ×98 » entre P7 et le noteur reste OUVERT des
    deux côtés** — *aucun des deux ne l'a tranché, et aucun ne l'a caché.*
  ➡️ **Les deux importants et les trois mineurs vont au prochain tour groupé.**
- **Tâche P8 livrée** (`a0a600a`) — vérifié : arbre propre, **4 021 tests** (+7),
  `audit:tests` **209/209**, **37/37 mutations dont 25 sur le branchement**,
  **CRLF identique sur toute la plage**. **59 captures, 17 relevés, 15 scripts dans `.banc/P8/`.**
  - ⚡ **① L'EXPOSITION DES PAROIS — la cause tient dans une demi-ligne de `three` que P3 avait
    DÉJÀ citée sans en tirer la conséquence** : `envMapIntensity` est mort sur le relief
    **PARCE QUE `terrain.material.envMap === null`**. ⛔ **Or LA PAROI DU SOCLE A SON PROPRE
    `envMap`** — `plinth.setEnvMap(makeSocleEnvMap(...))`, **une pièce sombre à intensité 1**,
    et `plinth.js` l'annonce en toutes lettres. **La paroi du crop lisait l'ambiante DU
    RELIEF, 1,54× plus forte à plat sur un mur vertical.**
    ✅ **Prouvé EN LE BOUGEANT DANS LES DEUX SENS, aller-retour exact** : retirer son studio au
    socle le fait passer de **15,88 à 38,11** (contraste 3,045 → 1,405) ; donner l'ambiante de
    la paroi au crop le fait passer de **26,63 à 17,87**. ⚡ **Et sur le MÊME maillage, la loi
    du crop rend la face claire à +1,0 % du socle, terme direct Lambert EXACT AU CENTIÈME
    (28,19 des deux côtés).**
    **Livré : face sombre 1,68× → 1,125× · contraste 1,52× → 1,22×. 82 % et 46 % de l'écart.**
  - ⛔ **② LA FRANGE — MON BRIEF SE TROMPE, ET LE NOTEUR AUSSI.** Ce n'est **ni** la résolution
    du champ, **ni** `uCoastMask`, **ni** l'interpolation par sommet — **six A/B**, dont deux
    décisifs : **nappe éteinte, le fond marin du crop est PARFAITEMENT LISSE** ; et recalculer
    `vProfondeur` **par fragment** rend **les mêmes dents aux mêmes endroits**.
    ⚡ **Ce qui manquait est le repli `max(bathymétrie, distanceRivage × 1,6)` d'`ocean.js`,
    absent de la calotte** — alors que **le champ du crop ne porte qu'UN ÉCHANTILLON VRAI TOUS
    LES 240 m** (autocorrélation de la dérivée seconde, pic à 3 nœuds sur 128).
    **Glacis 11,74 % → 9,74 % (socle 8,24 %), force périodique 0,2155 → −0,0237,
    aller-retour à 0 canal sur 4 096 000.**
  - ⚠️ **AUCUN DES DEUX POSTES N'EST FERMÉ, et il le dit.** Le studio de la paroi est
    **directionnel EN AZIMUT** (12,32 sur une face, 14,61 sur l'autre) et
    `mix(sol, ciel, 0.5·ndu+0.5)` **ne sait dire que `N·haut`**. **Fermer demande une base du
    premier ordre complète — ce qui touche aussi l'ambiante des tuiles.**
  - ⚠️ **IL A ÉTENDU LE REPLI PLUS LOIN QU'`ocean.js`, CONTRE SON PROPRE AVERTISSEMENT**
    (« c'etait lui le halo »), parce que posé sur la seule alpha il ne déplace rien.
    **Le halo reste un risque déclaré.**
  - ⛔ **ET UNE RÉGRESSION ASSUMÉE : le repli coûte 8,0 % de l'énergie de détail de la mer**
    et 17,5 % de son écart-type de luminance — **sur le manque n°2** — en échange d'un excès
    de clarté qui tombe de **+43,1 % à +36,9 %**.
  - **Le chanfrein n'est PAS pris, et il le dit : l'exposition n'était pas fermée.**
  - ⛔ **TREIZIÈME FAÇON DONT UN BANC MENT : `geler()` ne remplace que `requestAnimationFrame`,
    mais `tick()` SE RÉARME EN `setTimeout` dans un onglet caché — dans ce cas le gel ne gèle
    rien.** Vérifié : plancher **0 canal**, `uMerTemps` immobile.
  - **Deux mutations retirées comme neutres**, **une survivante qui a trouvé du code mort**
    (garde `Math.max(0, distance)` inerte, retirée). **Neuvième code mort du chantier.**

- **Tâche P9 — LIVRÉE** (`d9dc91f`, `ac58500`) — le bleu profond de la mer (manque n° 2) et le
  dernier tiers du relief (manque n° 5). `npm test` **4 027 / 4 027** (+6), `audit:tests`
  **209 / 209**, mutations **36 / 36** dont **20 sur le branchement**.
  ⛔ **LES DEUX PISTES DU BRIEF SONT MORTES, ET ELLE LE PROUVE.**
  - ⛔ **① LE GRAIN N'EST PAS LE LEVIER.** Converti (`grainForceM = detail × largeurCropM /
    COTE_CROP_UNITES / exagération` = **4,89 m** ; `grainEchelle = detailScale × 28` = **22,4**)
    et POSÉ dans la page : l'énergie de détail passe de **10,972 à 10,972 — 0,000 %**. Il faut
    **×50** (244 m de relief inventé) pour gagner 4,4 %, et le curseur plafonne à **36,7 m**.
    **Non porté, décision assumée ; la recette est écrite dans `main.js`.**
  - ⚡ **② LA CAUSE DES DEUX MANQUES EST UNE SEULE : LA NORMALE.** Lumière coupée des deux
    côtés, **le crop rend 10,250 d'énergie contre 8,723 au socle — sa COULEUR est déjà plus
    riche** ; c'est son OMBRAGE qui manque en entier, parce que `vNormalW` vient de
    `gridFor(z) = 24` quads par tuile — **5 625 sommets sur le bloc contre 594 434 au socle**,
    quand la texture de hauteur fait 256² par tuile et que le fragment la lit déjà.
    ➡️ **Normale reconstruite AU FRAGMENT** (loi de Mikkelsen que porte `three`, **moins la
    normalisation de sigma**, base = **sphère nue** et non `vNormalW`, repère de VUE pour la
    précision). **Énergie 10,963 → 15,721 contre 16,056 au socle : 68,3 % → 97,9 %.**
    Aller-retour d'uniforme **0 canal**, effet **401 550 canaux**.
  - ⛔ **③ LE BLEU PROFOND NE MANQUE PAS EN TEINTE.** Lame d'eau EXTRAITE du fond par un A/B à
    trois fonds (prédiction vérifiée à **0,56 octet**) : **teinte 210-225° des deux côtés**,
    **opacité 0,603 contre 0,609**. Et **ZÉRO pixel de bleu profond sur les DEUX fonds marins**.
    La lame du crop, inchangée, recomposée sur le fond DU SOCLE rend **12,90 % de bleu profond**
    contre 0,036 % sur le sien.
  - ⛔ **④ ET LE CHIFFRE-TITRE DU NOTEUR EST DOMINÉ PAR UNE RÉGION QUI N'EST PAS UNE MER.**
    Sur **14,51 %** de l'intersection, **le socle compose sa mer sur du VIDE** (fond rendu à
    0,03 octet ; le crop, lui, y a un fond à 112,81) — et **10 401 de ses 11 265 pixels de bleu
    profond (92,3 %) vivent là**. Sur la région où les deux ont vraiment un fond marin,
    **le crop a PLUS de bleu profond que le socle : 2 824 contre 864**, et son excès de clarté
    vaut **+16,8 %**, pas +36,9 %.
  - ⚡ **L'ÉNERGIE DE DÉTAIL DU FOND MARIN TOMBE PILE SUR CELLE DU SOCLE : 4,848 contre 4,839.**
  - ⚠️ **LE MANQUE N° 2 N'EST PAS FERMÉ, ET LA CAUSE RESTANTE EST MESURÉE MAIS NON TROUVÉE** :
    la lame d'eau du crop est **1,34 fois trop claire** à opacité ET teinte égales, facteur
    uniforme sur les trois canaux. **Piste n° 1 pour la suite.**
  - ⛔ **DEUX MUTATIONS RETIRÉES COMME NEUTRES — ELLES ONT TROUVÉ DU CODE MORT** (la projection
    des tangentes est un no-op prouvé par l'algèbre). **Dixième code mort du chantier**, retiré
    de la source, **et le commentaire qui le justifiait était FAUX** : corrigé, l'invariance est
    devenue une assertion. Trois autres survivantes = trois vrais trous de test, fermés.
  - ⚠️ **RIEN N'EST MESURÉ EN MOUVEMENT** : une normale dérivée par pixel PEUT scintiller,
    et un léger crénelage est visible au repos. C'est la réserve qui porte le plus de risque.
- **Tâche P9 livrée** (`ac58500`) — ⚡⚡ **LE PLUS GROS SAUT DU CHANTIER.** Vérifié : arbre
  propre, **4 027 tests** (+6), `audit:tests` **209/209**, **36/36 mutations dont 20 sur le
  branchement**, **CRLF sur toute la plage**, **plancher de bruit 0 canal, `uMerTemps`
  immobile** (le treizième piège, évité).
  - ⛔ **LES DEUX PISTES DE MON BRIEF SONT MORTES, ET IL LES A TUÉES PAR LA MESURE :**
    - **Le grain n'est pas le levier.** Il a fait la conversion réclamée
      (`grainForceM = 4,89 m`, `grainEchelle = 22,4`) et **l'a posée dans la page** :
      énergie **10,972 → 10,972, soit 0,000 %**. **Il faut ×50 (244 m de relief INVENTÉ) pour
      gagner 4,4 %, et le curseur plafonne à 36,7 m.** Non porté, **recette écrite** dans
      `main.js`.
    - **Le bleu profond ne manque PAS en teinte** — contre le noteur ET contre moi. A/B à
      **trois fonds** (prédiction vérifiée à **0,56 octet**, aller-retour 0 canal) :
      **teinte 210-225° des deux côtés, opacité 0,603 contre 0,609**, et **zéro pixel de bleu
      profond sur les DEUX fonds marins**. **La lame du crop, INCHANGÉE, recomposée sur le
      fond du socle rend 12,90 % de bleu profond contre 0,036 % sur le sien.**
  - ⚡⚡ **LA CAUSE RÉELLE, COMMUNE AUX DEUX MANQUES — ET PERSONNE NE L'AVAIT VUE EN QUINZE
    TÂCHES** : lumière coupée des deux côtés, **le crop rend 10,250 d'énergie contre 8,723 au
    socle** — ⚡ **sa couleur était DÉJÀ plus riche : c'est son OMBRAGE qui manquait en
    entier.** Parce que `vNormalW` vient de `gridFor(z) = 24` quads par tuile :
    ⛔ **5 625 sommets sur le bloc contre 594 434 au socle**, **alors que la texture de hauteur
    fait 256² par tuile et que le fragment la lit DÉJÀ.**
    ➡️ **Normale reconstruite AU FRAGMENT** (loi de Mikkelsen que porte `three`, **moins la
    normalisation de sigma — convention d'artiste, déclarée** ; base = sphère nue ; **repère
    de vue pour la précision RTC**).
  - ✅ **RÉSULTATS** : **relief 68,3 % → 97,9 %** du socle (10,963 → 15,721 contre 16,056),
    aller-retour d'uniforme à **0 canal** · **fond marin : 2,089 → 4,848 contre 4,839
    (+0,2 %)** · **bleu profond de la mer : 246 → 3 063.**
  - ⚡ **ET IL CORRIGE LE NOTEUR SUR UN POINT QUI FAUSSAIT LA NOTE** : sur **14,51 %** de
    l'intersection, ⛔ **LE SOCLE COMPOSE SA MER SUR DU VIDE** (fond à 0,03 octet ; le crop y a
    un fond à 112,81) — **et 10 401 de ses 11 265 pixels de bleu profond, soit 92,3 %, vivent
    LÀ.** ➡️ **Sur la région où les deux ont vraiment un fond marin, LE CROP A PLUS DE BLEU
    PROFOND QUE LE SOCLE : 2 824 contre 864**, et son excès de clarté vaut **+16,8 %**,
    pas +36,9 %.
  - ⚠️ **NON FERMÉ** : **la lame d'eau du crop est 1,34× trop claire à opacité et teinte
    égales** — **facteur uniforme sur les trois canaux, mesuré, CAUSE NON TROUVÉE.**
    *« C'est la piste n°1 pour la suite. »* Et ⚠️ **rien n'est mesuré EN MOUVEMENT : une
    normale dérivée par pixel peut scintiller, un léger crénelage est visible au repos.**
  - **Deux mutations retirées comme neutres — elles avaient trouvé DU CODE MORT** (la
    projection des tangentes est **un no-op prouvé par l'algèbre**), retiré, ⚠️ **et le
    commentaire qui le justifiait était FAUX, corrigé.** **Dixième code mort.**
    **Trois autres survivantes = trois vrais trous de test, fermés.**
- **NOTATION 03 (hash `ac58500`) — GLOBALE 6,6/10** contre **5,3** puis **3,5**.
  | critère | 01 | 02 | **03** | mesure |
  |---|---|---|---|---|
  | Richesse du relief | 6 | 6 | **8 (+2)** | énergie **65,7 % → 98,02 %** du socle · **retenu à 8 pour le crénelage** |
  | Palette et contraste | 3 | 7 | **7 (=)** | hors-orange ×2,20 → ×1,975 — **« sous la réserve de palette, je le lis comme rien n'a bougé »** |
  | Trait et bordure | 3 | 5 | **6 (+1)** | tablier **×98 → ×4,37** ; mais **terrain qui drape la paroi ×20** |
  | La mer | 2 | 5 | **7 (+2)** | **fond marin à +0,08 % du grain du socle** · écume 1 contre 1 |
  | Parois et base | 2 | 5 | **6 (+1)** | face sombre **×1,68 → ×1,125** · couleur **prouvée en la bougeant** (retour 0) |
  | Propreté | 3 | 3 | **4 (+1)** | jupes **2 186 px / 12 langues → 1 px / 1 langue** · ⛔ **clignotement enfin mesuré : ×360 le socle** |
  - ⚡⚡ **LA CONTRIBUTION NEUVE — LA MESURE EN MOUVEMENT, QUE PERSONNE N'AVAIT FAITE.**
    Décalage de caméra d'un nombre **ENTIER de pixels** (`setViewOffset`) : ni parallaxe, ni
    horloge. Résidu moyen après recalage :
    | dx | socle | crop normale fine ON | OFF |
    |---|---|---|---|
    | **1 px** | **0,030** | ⛔ **10,872** | 0,863 |
    | 2 px | 0,001 | ⚡ **0,800** | 0,834 |
    | **3 px** | 0,030 | ⛔ **10,856** | 0,865 |
    ➡️ ⛔ **ÉNORME AUX DÉCALAGES IMPAIRS, NUL AUX PAIRS : C'EST LA PARITÉ DES QUADS 2×2 DE
    `dFdx`/`dFdy`.** **38,49 % des pixels de surface bougent de plus de 8 octets pour UN SEUL
    pixel de caméra.** Plancher à dx = 0 : **0,000 des deux côtés**, recalage trouvé au bon
    décalage **dans les 24 cas**.
    ⚠️ **C'est une RÉGRESSION de P9, qu'il avait déclarée non mesurée. Elle est mesurée.**
  - ✅ ⚡ **LA CORRECTION DE P9 EST CONFIRMÉE, REFAITE INDÉPENDAMMENT, ET LA NOTE 02 EST
    CORRIGÉE** : le socle compose sa mer sur du vide sur **14,48 %** (P9 : 14,51 %), **92,67 %
    de son bleu profond vit là** (P9 : 92,3 %), et **sur la région où les deux ont un vrai
    fond, le crop en a PLUS : 2 828 contre 824.** Excès de clarté **+16,71 %**, pas +63,4 %.
    **Les cinq chiffres retombent sur ceux de P9 à 0,1–4,6 % près.**
    ⚠️ **Et il reprend la réserve de P9 : le « vide » est la couleur de nettoyage du banc,
    donc il n'impute pas un défaut au socle — il affirme seulement que le chiffre-titre de la
    note 02 y vivait.** *C'est exactement la prudence qu'on veut.*
  - **LES CINQ MANQUES :**
    1. ⛔ **LE SCINTILLEMENT DE LA NORMALE PAR FRAGMENT** — `normaleFineCrop`
       (`src/monde/eclairage-crop.js` §6) injectée à `globe.js:1586-1590`.
       ⚡ **« Ça ne se règle pas, ça change de loi : gradient en espace TEXTURE
       (`uUnitesParMetre` est DÉJÀ posé) au lieu des dérivées d'écran. »** **Moyen — et LA
       PREUVE EST ÉCRITE D'AVANCE : le résidu à dx=1 doit tomber à 0,800.**
    2. Terrain qui drape la paroi + lames de mer · 3. **la lame d'eau 1,34× trop claire**
       (cause non trouvée) · 4. frange en marches + pavage rectangulaire · 5. **la peinture
       rosée contre l'olive** — ⚡ **la rampe est le MÊME objet `three` des deux côtés : c'est
       la composition de l'ombrage.**
  - ➡️ **« Non, ça ne ressemble toujours pas au socle — MAIS POUR LA PREMIÈRE FOIS IL FAUT
    REGARDER DE PRÈS POUR LE DIRE. »** ⚡ **« Et le gain au repos a un prix que personne
    n'avait vu : la pièce qui ferme le relief est LA SEULE DU BLOC QUI NE SOIT PAS INVARIANTE
    PAR TRANSLATION. »**
- **Tâche P10 livrée** (`d258d0b`) — ⚡ **LE CRITÈRE EST ATTEINT, ET DÉPASSÉ.** Vérifié : arbre
  propre, **4 029 tests**, `audit:tests` **209/209**, **51/51 mutations en deux tours,
  42 visant le branchement (82,4 %)**, page chargée levé ET baissé, CRLF concordant.
  - ✅ **Protocole du noteur rejoué SANS UNE LIGNE MODIFIÉE** (seul le récepteur change de
    dossier) :
    | dx | socle | **crop ON (P10)** | crop OFF | crop ON (notation 03) |
    |---|---|---|---|---|
    | 1 px | 0,0320 | **0,8143** | 0,8627 | ⛔ **10,8724** |
    | 3 px | 0,0322 | **0,8163** | 0,8647 | ⛔ **10,8563** |
    | **pixels instables à dx=1** | 66 | ⚡ **6 (0,004 %)** | 5 | ⛔ **52 048 (38,49 %)** |
    ⚡ **La signature de parité a DISPARU** : l'écart pair/impair résiduel (0,0278) est
    **celui de la colonne témoin sans normale fine** (0,0288). **×360 → ×25,4.**
    **Sur la mer : 1,4617 → 0,3620 contre 0,3585 éteinte — le poste n'y est pas réduit,
    IL N'EXISTE PLUS.**
  - ⚡ **ET IL CORRIGE MON BRIEF** : « ≈ 0,800 » est la valeur des décalages **PAIRS**. Aux
    impairs, **le noteur mesure lui-même 0,863 sur un crop SANS normale fine** — c'est le
    plancher du reste du nuanceur. ➡️ **0,8143 est SOUS ce plancher.**
  - **L'échange, mesuré et assumé** : relief **98,02 % → 96,30 %** (−1,72 point), mais
    **écart-type de luminance et part de la lumière dans le modelé identiques à P9 AU
    CENTIÈME**, et ⚡ **le crénelage en escalier que le noteur facturait 2 points a disparu**
    sur la découpe ×6. ⚠️ **Il avait d'abord posé un demi-pas : 109,47 %, REFUSÉ PAR LA
    MESURE.**
  - ⛔ **CE QU'IL A DÉGRADÉ, ET IL LE DIT : la frange côtière en marches EMPIRE DE 5,9 %**
    (paliers 1,943 → 2,058), le socle se reproduisant à 0,3 %. **« Ce n'est pas du bruit :
    c'est le prix du pas plus large. »**
  - **La loi** : ⚡ **Mikkelsen RETIRÉE de `src/`** (survit dans le test **comme second
    oracle**, et un test prouve que **la loi livrée en est la RÉDUCTION** sur un repère
    orthonormé). À la place : `N = normalize(haut − gEst·est − gNord·nord)`, repère posé
    depuis **l'attribut `latlon`**, gradient par **4 lectures en espace UV**.
    ⚡ **PLUS UNE SEULE DÉRIVÉE D'ÉCRAN DANS LA NORMALE ; `vVue` a disparu du dépôt.**
    Trois lois deviennent des fonctions pour n'être écrites qu'une fois.
  - ⚡ **LES QUATRE SURVIVANTES DU PREMIER TOUR ONT CHACUNE TROUVÉ UN VRAI TROU — dont SON
    PROPRE test du cas dégénéré, QUI ÉTAIT UNE TAUTOLOGIE.** Deux fermées par des tests
    exécutables, dont **l'invariant `TOUR × UNITE = 2πR_GLOBE` qui apparie les deux
    conversions de monnaie** — *la parade systémique aux « valeurs dans la mauvaise monnaie ».*
  - **LE COÛT — la réserve n°9 du noteur, que NI P9 NI LUI n'avaient mesurée** : banc en
    alternance, 31 paires, surcoût médian **+0,0625 ms (+2,8 %)**, **du même ordre que le
    bruit propre du banc**. ⚠️ **Il publie une BORNE (< ~0,15 ms, < 7 %), pas un chiffre.**
    **Et ses deux premiers bancs étaient aveugles — leur propre témoin l'a dit.**
    **Vingt-troisième borne volontaire.**
- **Tâche P11 livrée** (`bf03bfe`) — vérifié : arbre propre, **4 055 tests** (+26),
  `audit:tests` **210/210**, **71/71 mutations dont 83,1 % sur le branchement**.
  - ⛔ **DOUZIÈME CORRECTION — ET CETTE FOIS MON BRIEF ET LE NOTEUR AVAIENT TORT ENSEMBLE.**
    Le noteur annonçait *« c'est la composition de l'ombrage »*. **Il a coupé la chaîne en
    deux — irradiance neutralisée à π DES DEUX CÔTÉS, aller-retour 0 canal :
    ⚡ IRRADIANCE NEUTRALISÉE, LE CROP N'A PAS UN SEUL PIXEL D'OLIVE.**
    ➡️ **L'écart vit dans L'ALBÉDO ; l'ombrage ne fait que l'atténuer.**
  - ⚡ **LA CAUSE EST UNE ANCRE.** `hNormRelief = (h + uOceanDepth) / (uLandMax + uOceanDepth)`,
    justifié par « le minimum du relief EST −uOceanDepth ». ⛔ **Vrai d'un crop QUI A DE LA
    MER, faux de tous les autres** : sans point sous le niveau de la mer, `profondeur` retombe
    au plancher de division, `echelle-continue` **refuse (à raison) de l'ancrer**, et
    l'uniforme garde **6 000 m MONDIAUX**. **Relevé vivant : `uOceanDepth = 6 000` pour un
    bloc dont le point le plus bas est à 107 m.** Pivot **0,685 au lieu de 0,41**, `rampT`
    partant de **0,48** — ⚡ **le crop n'atteignait JAMAIS la moitié basse de sa table.**
  - **Correctif** : cinquième grandeur ancrée `creux = terreBas − minM`, **positive (log1p) et
    RELATIVE** (l'identité survit à l'interpolation), **sans cas dégénéré**. **Défaut MONDE
    = −6 000, production intouchée au bit près.**
  - ✅ **Script du noteur rejoué, masques appariés à +0,0007 %** : olive **2 691 → 10 938**
    (socle **9 999**) · ocre 12 219 → 33 257 · vert 290 → 5 282 · rosé 4 326 → 2 260 ·
    neutres **34,88 % → 24,18 %** (socle **25,00**). **Hors-orange ×1,975 → ×0,859.**
    **Témoin bougé dans les DEUX SENS, aller-retour 0 canal.**
  - ⛔ **LE MANQUE N°2 : LA JUPE EST HORS DE CAUSE, MESURÉ** — éteinte dans la page,
    `dansLaBande` 54 430 → 54 356 : **0,14 %**. ⚡ **Le vrai défaut : l'anneau se posait sur la
    TEXTURE, le GPU dessine le MAILLAGE** (24 quads/tuile). **Écart sur 1 020 points :
    18,94 m en moyenne absolue, extrêmes −270/+202 m, ±10 px à l'écran, DANS LES DEUX SENS.**
    La paroi lit désormais `hauteurDessinee` ; **`poserRampe` reste sur la texture — la
    couleur lit la DONNÉE, la géométrie lit le MAILLAGE, et un test tue la mutation qui
    bascule les deux.** Gain **32,099 % → 31,942 %** (socle 28,37).
    ⛔ **Le reste est LA RÉSOLUTION : 72 segments par côté contre 768. Chiffré, non payé.**
  - ✅ **Résidu en mouvement** : dx=1 **0,8175**, dx=3 **0,8195** (socle 0,0302/0,0305 ;
    crop sans normale fine 0,8664/0,8680). **Aucune signature de parité.**
    ⚠️ **+0,4 % contre P10, cause à lui et nommée** (pente de rampe ×3,12) ; **la colonne
    éteinte monte pareil.**
  - ⚠️ **RÉSERVES, ET LA QUATRIÈME EST SÉRIEUSE :**
    1. ⛔ **IL DÉPASSE** : crop **+15,7 % de saturation, +16 % de hors-orange, +16,3 %
       d'énergie**. **Le signe s'inverse.** *« Au noteur d'arbitrer. »*
    2. ⛔ **Son banc s'est corrompu une fois** (chiffre jeté, refait) et un script **rate sa
       lecture — son propre témoin le dit.** *« Je laisse le verdict, pas le chiffre. »*
    3. **La dette P10 est intacte et mesurée** (2,060 contre 2,058) — **refus MOTIVÉ** : elle
       vit dans l'accord de bande de P10, **la toucher rouvre son poste n°1.**
    4. ⛔ **« La réserve un seul lieu MORD CETTE FOIS » : son correctif change de comportement
       selon que le crop A ou N'A PAS de mer, et IL N'A MESURÉ À L'ÉCRAN QUE LE CAS SANS
       MER.** ⚠️ **La Réunion, elle, EN A.** ➡️ **À vérifier en priorité.**
    5. **Il a RETIRÉ sa mesure de rugosité du bord** : *« elle ne mesure pas ce que son nom
       dit. »* **Vingt-quatrième retrait.**
- **NOTATION 04 (hash `bf03bfe`) — GLOBALE 6,7/10** contre 6,6 · 5,3 · 3,5.
  ⚠️ **« Le +0,1 cache +4 et −3 : les deux tâches ont fermé leur poste, deux effets de bord
  NON VISÉS reprennent presque tout. »**
  | critère | 01 | 02 | 03 | **04** |
  |---|---|---|---|---|
  | Richesse du relief | 6 | 6 | 8 | **8** |
  | Palette et contraste | 3 | 7 | 7 | **8 (+1)** |
  | Trait et bordure | 3 | 5 | 6 | **5 (−1)** |
  | La mer | 2 | 5 | 7 | **5 (−2)** |
  | Parois et base | 2 | 5 | 6 | **6** |
  | Propreté | 3 | 3 | 4 | **7 (+3)** |
  - **Preuves** : appariement +0,0007 % à −0,0376 % sur **7 balayages** · témoin nul **0 canal
    sur 4 096 000 partout**, `uMerTemps` immobile · ✅ **mouvement : dx=1 → 0,8180** (attendu
    ≈0,8175), socle 0,0321, **aucune signature de parité**, **11 pixels instables contre 66 au
    socle** — *le scintillement reste mort.*
  - ⚡ **ARBITRAGE DU DÉPASSEMENT : ACCEPTÉ, MAIS FACTURÉ.** Il arbitre sur **la distance de
    variation totale entre les deux distributions de teinte : 0,1859 → 0,0189, ÷9,8**
    (il reproduit le relevé de P11 **à la 4ᵉ décimale**). Somme des erreurs de palette
    **6,975 → 1,005, ÷6,94**. ⛔ **Mais le dépassement DÉPLACE L'ERREUR vers le critère ①**,
    où elle vaut **×7,6** en énergie et **×6,1** en écart-type — **les crêtes brûlent.**
    ➡️ **Solde : +1 point, pas +2.** ⚠️ **Et sur la saturation seule, P11 a raison CONTRE
    ELLE-MÊME : amplitude ÷1,11 seulement.**
  - ✅ ⚡ **LE RISQUE DU CAS AVEC MER EST LEVÉ, ET PROUVÉ EN LE BOUGEANT.** Au cadrage côte,
    `creux = 1 317,5802307128906` et la loi d'avant P11 donnent **EXACTEMENT la même ancre —
    écart 0,0 m, `rampT` identique aux 16 chiffres**. Poser la loi d'avant déplace **0 canal
    sur 4 096 000** ; **le témoin n'est pas vide** (−12 000 déplace 379 595 canaux, retour 0).
    Au cadrage **sans mer**, le même geste déplace **416 420 canaux** et **refait l'image de
    la notation 03**. **Borne : la dichotomie ne subsiste que pour un crop dont le point le
    plus bas serait entre −0,0175 m et 0.**
  - ⚡ **IL RETIRE SA PROPRE CLÉ DE LA NOTE 03** : albédo nu, irradiance neutralisée, **le crop
    et le socle sont d'accord à 0,44 % de saturation et 0,0058 de distance de teinte.**
    ⚡ **ET IL AJOUTE CE QUE LA MESURE DONNE EN PLUS : TOUT LE DÉPASSEMENT RESTANT EST DANS
    L'IRRADIANCE, uniforme sur les trois canaux (×1,0848 / ×1,0818 / ×1,0842) — UN TERME DE
    GAIN, PAS UN BRANCHEMENT.** *C'est ce qui rend le manque n°1 bon marché.*
  - **LES CINQ MANQUES :**
    1. ⚡ **L'ACCORD D'EXPOSITION** (+16,3 % énergie, +15,4 % contraste, +15,8 % saturation) —
       **entièrement dans l'irradiance**, `src/monde/eclairage-crop.js`. ⚡ **COÛT FAIBLE, et
       c'est le nouveau n°1.**
    2. ⛔ **LE GRAIN DU FOND MARIN, PERDU DE 24,6 %** — **le poste que la note 03 déclarait
       fermé à +0,08 % rend 75,41 %.** Cause prouvée : normale fine éteinte, **les deux états
       sont identiques (2,089 / 2,099)** ➡️ **c'est LE PAS ÉLARGI DE P10, hors de cause pour
       P11.** **Faible à mesurer, moyen à régler.**
    3. **La silhouette dix fois trop grossière** — **5 625 sommets contre 594 434** ; le socle
       coupe son mur **en aiguilles**, le crop **en courbe lisse**. **Cher, chiffré, non payé.**
    4. **La frange en marches (aggravée de 22 % depuis la note 03) et le pavage rectangulaire**
       — **mesuré pour la première fois : pic de période 15 px, socle aucun.** Route moins
       chère : `uCoastMask`.
    5. **Le chanfrein** — **liseré lumineux sur toute l'arête du socle, rien côté crop.
       Inchangé depuis la note 01.**
- **Tâche P12 livrée** (`6063c5e`, 4 commits) — vérifié : arbre propre, **4 082 tests** (+27),
  `audit:tests` **211/211**, **58/58 mutations en TROIS tours dont 47 (81 %) sur le
  branchement**.
  - ✅ **Résidu en mouvement : 0,8245 à dx=1 et 0,8258 à dx=3** — **tous deux SOUS le plancher
    du crop sans normale fine** (0,8713/0,8726), **10 pixels instables contre 49 au socle**,
    **aucune signature de parité. Le scintillement de P10 n'est pas revenu.**
  - ✅ **Grain du fond marin : 75,41 % → 84,91 %** du socle.
  - ⚡⚡ **LA TROUVAILLE, ET ELLE EST GRAVE : LE BRANCHEMENT ÉTAIT FIDÈLE AU BIT PRÈS —
    C'EST L'INSTRUMENT QUI ÉTAIT FAUX DEPUIS ONZE TÂCHES.**
    Un **atlas de normales** posé dans la page (validé trois fois : soleil ×1,0003 contre la
    formule analytique, hémisphère exact, albédo noir à 0) localise le facteur : **soleil
    juste, hémisphère juste, ENVIRONNEMENT ×1,2772**.
    ⛔ **Cause prouvée : `coefAmbiante` regardait une bille avec UNE caméra orthographique —
    donc UNE SEULE MOITIÉ de la sphère des normales.** Or **l'environnement varie de 146 %
    selon l'azimut** à `ndu = 0,3`, et **les deux moitiés rendent ×2,18 l'une de l'autre.**
    ⚠️ **Seconde faute, DE MONNAIE : `ciel`/`sol` sont deux irradiances AUX PÔLES, pas les
    coefficients d'un ajustement.** ➡️ Nouveau module pur `src/monde/atlas-normales.js`,
    **les deux conversions appariées par un invariant** (la parade de P10, réutilisée).
  - ✅ **Résultat** : saturation **+15,75 % → +3,07 %** · écart-type **+15,41 % → +8,11 %** ·
    distance de teinte **0,0289 → 0,0160** · moyenne RGB **+8,4 % → −3,9 %**.
    ⚡ **Et l'albédo nu NE BOUGE PAS : éclairage coupé, le crop rend les mêmes six grandeurs
    AU CHIFFRE PRÈS que le relevé du noteur.**
  - ✅ **Poste 2** : le pas est bien la cause (**bougé dans les deux sens, aller-retour 0
    canal**), ⚡ **mais l'argument de P10 portait sur le MNT — or sous l'eau la hauteur vient
    du CHAMP CUIT, six fois plus grossier : rien à filtrer.** Le pas suit donc la source.
    **Frange en marches 13,57 → 9,36 %** (socle 6,54) — ⚡ **la dette de P10 payée aux deux
    tiers** · **clarté de la lame d'eau +18,26 → +6,45 %** · **le relief ne bouge pas d'un
    centième.**
  - ⛔ **RÉSERVE PRINCIPALE : LE PAVAGE RECTANGULAIRE DOUBLE** (0,0828 → 0,1565). ⚡ **Ce que
    le pas resserré rend visible est LA FACETTE DE LA BILINÉAIRE DU CHAMP** — le vrai
    correctif est `CHAMP_FOND`, **chiffré à NEUF FOIS `remplirHauteurs`, non payé.**
    ➡️ ⚡ **« Le poste 2 et le poste 4 du noteur sont LE MÊME POSTE. »**
  - ⚠️ **« Le brief disait "branche-le" : IL N'Y AVAIT RIEN À BRANCHER. »** *Treizième
    correction de mon cahier des charges, treize sur treize.*
  - ⚠️ **Il n'a PAS refait chez lui les quatre chiffres-titres du noteur avant de les
    déplacer — faiblesse déclarée en §0** · ⛔ **il a RETIRÉ deux chiffres de ses propres
    en-têtes** (un ×1,0006 **qui était une prédiction, pas un rendu**).
    **Vingt-cinquième et vingt-sixième retraits.**
- **Relecture groupée P8–P12** — **P8, P9, P10, P11 : CONFORMITÉ ✅** · ⛔ **P12 :
  NON-CONFORMITÉ ❌ (1 critique, 3 importants, 3 mineurs).**
  - ✅ **LES CINQ CAMPAGNES REJOUÉES AU COMMIT DE CHAQUE TÂCHE : 37 · 36 · 51 · 71 · 58 =
    253 MUTATIONS, ZÉRO SURVIVANTE, ZÉRO NON-APPLIQUÉE.** Les cinq totaux `npm test`
    reproduits (**4 021 · 4 027 · 4 029 · 4 055 · 4 082**), `audit:tests` idem,
    **CRLF concordant sur les cinq plages entières.**
    ⚡ **Et il a EXIGÉ une preuve d'exécution** (un test lit `node_modules/three`, et les cinq
    totaux diffèrent entre eux) — le piège du worktree vide était réel.
  - ✅ **LES QUATRE AFFIRMATIONS EXTRAORDINAIRES TIENNENT :**
    **P12** — la sonde était bien une bille sous caméra orthographique (`Nz > 0`) ;
    **146,1 % d'amplitude azimutale**, **6,8273 / 3,13285 = ×2,179** entre les deux moitiés,
    **et la sonde livrée à 2,2 % de la moitié qu'elle voyait. Exact aux trois chiffres.**
    **P9** — 14,51 % et 92,3 % recalculés depuis le JSON brut : **10 401 / 11 265 = 92,33 %.**
    **P10** — la parité **crève les fichiers bruts**. **P11** — albédo olive du crop **= 0
    dur**, `uOceanDepth = 6 000` contre `terreBas = 107,46`.
  - ⛔ **C-1 (P12) — le §1.2 annonce « aller-retour à 0 canal » pour le banc qui porte le
    ×2,18 ; LE JSON DIT `retour: 933`.** La conclusion n'est pas menacée (**sa propre réserve
    n°9 déclare la bande 862–9 503**) — **mais c'est le témoin de propreté de l'affirmation la
    plus lourde des cinq tâches.**
  - ⚡⚡ **I-3 — SA MUTATION R7 SURVIT AUX 4 082 TESTS** : il a **échangé `ciel` et `sol` DANS
    L'OBJET RETOURNÉ**, en laissant intactes les deux lignes que le test cherche. **Vert.**
    ⛔ **Le seul garde est deux `assert.match` SUR LE TEXTE SOURCE — exactement l'assertion de
    NOM qu'une survivante de P11 avait démasquée UNE TÂCHE PLUS TÔT, et que P12 RACONTE DANS
    SON PROPRE §4.** *Le code livré est juste ; le trou est de couverture.*
    ✅ **Ses cinq autres mutations de branchement sont tuées, dont celle qui prouve que
    l'invariant `TOUR × UNITE` MORD.**
  - ⚠️ **I-1 (P9) — le « 5 625 sommets / cent cinq fois moins » est un calcul À LA MAIN que LE
    RELEVÉ DE LA MÊME EXÉCUTION CONTREDIT** : le JSON porte **`sommets: 29 978`**, et
    **le commentaire de la sonde écrivait l'attente « 5 625 au plus » — LA GARDE A SONNÉ SANS
    ÊTRE RAPPORTÉE.** Cause : `tuilesCrop()` rend **toutes** les tuiles, tous niveaux
    confondus. **L'argument survit** (le minimum est conservateur) **mais le chiffre s'est
    propagé jusqu'au poste 3 de la notation 04.**
  - ⚠️ **Une capture de P12 CONTREDIT SA PROPRE LÉGENDE** : la mer du socle y porte des bandes
    verticales nettes là où le rapport écrit « le socle n'en a aucun » — **démenti aussi par
    son second instrument.**
  - ✅ **Les aveux : exacts, tous les cinq** — l'avertissement d'`ocean.js` **vérifié mot pour
    mot à la ligne 532** · **le chiffre jeté de P11 n'apparaît NULLE PART sur le disque** ·
    P12 déclare le doublement du pavage **avant qu'on le trouve**. ⚠️ **Un seul incomplet :
    P10 mesurait son prix SUR UN SEUL AXE alors que le banc qu'il rejouait rendait les deux
    colonnes.**
  - ⛔ **TROUVAILLE DE SANTÉ DU DÉPÔT : sur un checkout PROPRE, `test/occupation-sol.test.js`
    échoue seul parce qu'il lit un fichier GITIGNORÉ.** ➡️ ⚠️ **« Le vert du chantier n'est
    pas reproductible depuis git seul. » À corriger — c'est une dette qui touche TOUT LE MONDE.**

- **TOUR DE CORRECTION P8 → P12** — `6063c5e..ee4e479` — `rapport-correction-P812.md`
  - ⚡ **LES SIX POINTS TRAITÉS. `npm test` 4 087 / 4 087 · `audit:tests` 211 / 211 · arbre
    propre · page chargée drapeau levé ET baissé, zéro `pageerror`.** Un seul commit, de TEST
    et de SANTÉ DU DÉPÔT : **aucune ligne du code livré des cinq tâches n'est touchée.**
  - ⛔ **LA SURVIVANTE I-3 EST FERMÉE PAR DU COMPORTEMENT** : `test/atlas-normales.test.js`
    gagne cinq tests (⑤a–⑤e) qui EXÉCUTENT `coefAmbiante` contre un renderer de paille.
    **R7 (celle du relecteur), R8 et R9 vérifiées expérimentalement** — et **R8/R9 prouvent
    que ④d était creux aussi : il reste VERT pendant que ⑤c rougit.**
    ⚠️ **Sondé ailleurs, pas supposé** : deux mutations du même genre dans
    `src/monde/eclairage-crop.js` sont **TUÉES**. Le trou vivait là où le module exige un
    renderer — donc là où personne ne l'avait exécuté.
  - ⚡ **LE VERT EST REPRODUCTIBLE DEPUIS GIT SEUL** : `test/occupation-sol.test.js` **SAUTE
    EN LE DÉCLARANT** (`t.skip`) quand `public/data/sol/index.json` manque. **Pas de
    reconstruction** : la donnée vient des COG d'ESA WorldCover, des heures de cuisson.
    ⚠️ **Le test voisin avait la garde mais un `return` MUET — donc vert, indistinguable
    d'un test qui a lu.** Corrigé aussi. Mesure : donnée absente → **4 087 tests, 0 échec,
    2 sautés.**
  - **Trois rapports et une notation corrigés sur leur source** : `rapport-P12.md` (témoin
    **933**, pas 0 · pavage du socle **0,0339**, pas « aucun »), `rapport-P9.md` +
    `notation-04.md` (**29 978** relevé, le « cent cinq fois » retiré, **×10,7 par axe**
    gardé, `nduEcartType` borné), `rapport-P10.md` (**−24,67 points sur le fond marin**,
    l'axe non mesuré).
  - ⛔ **UN CONSTAT RÉFUTÉ, PIÈCES À L'APPUI** : I-2 disait *« le banc qu'il rejouait rendait
    les deux colonnes »*. **`n4-mer.js` ne rend PAS la frange** (c'est `n5`), **et P10 n'a
    jamais rejoué `n4` — aucun `N4-*.json` dans `.banc/P10/`, son §0 liste trois scripts.**
    ➡️ **La version exacte est PLUS LOURDE** : il a restreint son banc sans le dire. *(Et le
    « deux tiers payés par P12 » vaut pour la frange (60 %), pas pour le fond marin (38,5 %).)*
  - ⚠️ **DETTE SIGNALÉE, NON TRAITÉE : 421 fichiers sont `i/lf w/crlf`** dans l'arbre
    (`core.autocrlf = false`, pas de `.gitattributes`). `git status` ne les voit pas tant que
    personne n'y touche ; **le premier agent qui en édite un fabrique un diff de fichier
    entier.** C'est arrivé sur `occupation-sol.test.js` (508/479 pour 33 lignes), réparé pour
    celui-là seulement.

- **Tour de correction P8–P12 livré** (`ee4e479`) — **les SIX points TRAITÉS**, dont **un
  constat RÉFUTÉ dans sa preuve**. Vérifié : arbre propre, **4 087 tests**, `audit:tests`
  **211/211**, **deux fichiers de `test/` UNIQUEMENT — aucune ligne du code livré touchée.**
  - **①** Le témoin republié depuis la source : **933 canaux sur 4 096 000 (0,023 %)**,
    comparé au **bas de la bande 862–9 503** que la réserve n°9 déclare **pour les
    aller-retours contenant un `await`** — **et le script en contient un.** ⚡ **Le `0` venait
    d'un AUTRE banc, qui vaut réellement 0.**
  - ⚡⚡ **② LA PIÈCE PRINCIPALE — cinq tests de COMPORTEMENT** exécutent la fonction contre un
    renderer de paille. **Vérifié expérimentalement, remise à zéro entre chaque** : la
    mutation du relecteur rougit le nouveau test ; ⚡ **et DEUX mutations de son cru rougissent
    le test neuf PENDANT QUE L'ASSERTION DE CHAÎNE RESTE VERTE — elle était creuse aussi.**
    Sondage ailleurs : deux échanges du même genre **sont tués** par des tests exécutables.
    ➡️ ⚡ **« Le trou vivait là où le module exige un renderer, donc là où personne ne l'avait
    exécuté. »** *La leçon la plus utile du chantier sur les tests.*
  - **③** Corrigé dans **le rapport ET la notation** ; garde de la sonde **citée** ; cause
    vérifiée. **« Cent cinq fois » retiré (mesure contre calcul), ×10,7 par axe gardé.**
  - **④** Il a **regardé la capture** : **les bandes y sont.** L'absolu tombe, le doublement
    **rechiffré (×1,9 / ×2,3 / ×4,6)**, **corrigé aussi dans la notation pour ne pas laisser
    le chiffre se propager.**
  - **⑤** Échec **reproduit d'abord**. **Saut DÉCLARÉ (`t.skip`), pas reconstruction** — la
    donnée vient des COG d'ESA WorldCover, **des heures de cuisson réseau**.
    ⚡ **Et il a trouvé mieux : le test voisin avait la garde mais un `return` MUET — donc
    vert, INDISTINGUABLE d'un test qui a lu.** Corrigé lui aussi.
    ➡️ **Donnée absente : 4 087 tests, 0 échec, 2 sautés.**
  - ⚡ **⑥ LE CONSTAT DU RELECTEUR EST RÉFUTÉ DANS SA PREUVE.** Il disait *« le banc qu'il
    rejouait rendait les deux colonnes »* : **ce banc ne rend PAS la frange** (c'est un autre),
    **et P10 n'a JAMAIS rejoué celui-là** — son §0 liste trois scripts, et **il n'existe aucun
    fichier de ce banc dans son dossier**. ⚡ **La version exacte est PLUS LOURDE : il a
    RESTREINT son banc sans le dire.** Corrigé au passage : **« deux tiers payés » vaut pour
    la frange (60 %), pas pour le fond marin (38,5 %).**
  - ⛔ **DETTE SIGNALÉE, HORS PÉRIMÈTRE, ET ELLE EXPLIQUE TOUT LE PASSÉ CRLF DU CHANTIER :
    421 FICHIERS DE L'ARBRE SONT `i/lf w/crlf`**, avec `core.autocrlf=false` **et AUCUN
    `.gitattributes`**. `git status` ne les voit pas tant qu'on n'y touche pas ; **un test a
    fabriqué un diff de 508/479 lignes pour 33 lignes modifiées.**
    ➡️ ⚡ **« Le prochain agent qui édite un de ces fichiers paiera la même chose. »**
- **Tâche P13 livrée** (`ee4e479..536f7a6`, **5 commits séparés** comme demandé) — vérifié :
  arbre propre, **4 105 tests** (+18), `audit:tests` **211/211**, page chargée levé ET baissé,
  ⚡ **PLUS UN SEUL `w/crlf` DANS L'ARBRE.**
  - ⚡ **① LA DETTE CRLF — ET MON BRIEF SE TROMPAIT SUR LE COÛT, DE FAÇON INSTRUCTIVE.**
    Il a **mesuré avant de toucher** : pour chacun des **1 067 fichiers suivis**, blob de
    l'index contre disque, puis contre disque CR retirés → **646 identiques, 421 égaux au CR
    près (147 708 octets), ZÉRO autre différence** — et `git ls-files --eol` rend **exactement
    les mêmes 421**.
    ⛔ **L'INDEX ÉTAIT DÉJÀ EN LF PARTOUT (aucun `i/crlf`) : LA DETTE VIVAIT DANS LA COPIE DE
    TRAVAIL, PAS DANS LE DÉPÔT.** Une fois `.gitattributes` posé, `git add --renormalize .`
    met en scène **exactement rien**. ➡️ **Le commit porte UN fichier, 42 lignes — pas 421.**
    **Piège reproduit** : toucher la seule mtime d'un fichier rendait **102 insertions /
    102 suppressions pour zéro ligne modifiée**.
    ⚠️ **Et il déclare que SON PREMIER SCRIPT DE MESURE A MENTI DANS LE SENS RASSURANT** —
    une regex à lui ne supportait pas la forme d'attribut et **annonçait 0**.
  - ⚡ **② LE CHANFREIN — les trois raisons de la Tâche B reprises une par une, et la datante
    est PÉRIMÉE DEUX FOIS** : l'exagération est fixe à 2, **et** les deux valeurs sont ancrées
    à **la LARGEUR, que l'exagération ne touche pas** — garde-fou mesuré **à ×10,3 et ×58 de
    mordre, aux deux exagérations.**
    ⚡ **La monnaie était le piège** (`0,16` sur un socle de 56, un crop de 0,163 → fractions
    de largeur). ⚡ **Et une constante prouvait que le chanfrein manquait : l'eau était rentrée
    d'un chanfrein de trop, ×3,67 l'écart voulu.**
    ✅ **À l'écran, A/B à témoin nul dans la même page** : la ligne de crête du mur passe de
    **−5,80 % à +58,25 %** au-dessus de la médiane ; profil **1,583 → 0,766 → 0,718** —
    **un fin liseré d'un pixel, pas une facette.**
  - ⛔ **RENTRER LE MUR A ROUVERT DEUX DETTES DU SOCLE** (« on voit l'eau à travers le bloc »,
    datée du 2026-08-03) : **792 px de mer et 82 px de tuiles sous le bas du mur**, contre 0
    avant. ✅ **Les deux refermées** (rideau conique, plancher de jupe au sommet du congé) —
    **retour à 0 px, 0 langue.**
  - ⛔ **NON FERMÉ, déclaré** : **le liseré de BASE du socle n'est pas reproduit** — le socle a
    **un vrai pic** (0,711 → **0,961** → 0,691), le crop **une montée monotone**.
    ⚡ **« C'est de l'éclairage, pas de la géométrie. »**
    Et **cinq traînées pâles sur le mur**, **cause prouvée par extinction (les jupes de
    tuiles)** : elles ne couvrent pas plus qu'avant (6 110 contre 6 560) **mais gagnent
    proprement le test de profondeur — régression d'APPARENCE, non fermée, sorties nommées.**
  - **Mutations 42/42, 83,3 % sur le branchement. SEPT survivantes**, dont ⚡ **une qui a
    démasqué un VRAI TROU DU CODE** (un invariant ne voit pas la position de l'apex) et ⚡ **une
    FAUTE DE PRÉCISION DANS SON PROPRE DÉTECTEUR** (`acos` d'un Float32 par lui-même rend
    0,015°).
  - ✅ **Mouvement publié : dx=1 crop 0,8248 · socle 0,0287**, état attendu retrouvé à +0,8 %,
    **aucune signature de parité.**
  - ⚠️ **Retour d'A/B NON NUL : 574 canaux (0,014 %), soit 1,3 % de ce qu'il mesure.
    « Je ne l'explique pas au-delà d'une hypothèse. »**
- **NOTATION 05 (hash `536f7a6`) — GLOBALE 7,3/10** contre 6,7 · 6,6 · 5,3 · 3,5.
  | critère | 01 | 02 | 03 | 04 | **05** |
  |---|---|---|---|---|---|
  | Richesse du relief | 6 | 6 | 8 | 8 | **9 (+1)** |
  | Palette et contraste | 3 | 7 | 7 | 8 | **9 (+1)** |
  | Trait et bordure | 3 | 5 | 6 | 5 | **6 (+1)** |
  | La mer | 2 | 5 | 7 | 5 | **6 (+1)** |
  | Parois et base | 2 | 5 | 6 | 6 | **7 (+1)** |
  | Propreté | 3 | 3 | 4 | 7 | **5 (−2)** |
  - ✅ Témoin nul **0 canal / 4 096 000 partout**, `uMerTemps` immobile · **mouvement dx=1
    crop 0,8250 / socle 0,0286** (attendu 0,8248 / 0,0287), **aucune signature de parité**.
    ⚠️ **Il n'atteint PAS le +0,0007 % d'appariement annoncé — la cible de surface a bougé de
    144 688 à 145 892 px sous P13 : c'est LE PREMIER SIGNE DES JUPES.**
  - ⛔ **LES TROIS AVEUX DE P13 SONT VRAIS — ET DEUX SONT PIRES QUE DÉCLARÉS :**
    1. **Le liseré de base n'est pas « non reproduit » : IL A RECULÉ.** Il reproduit les douze
       valeurs à la 4ᵉ décimale **et fait la soustraction que P13 n'avait pas faite sur ses
       PROPRES colonnes** : à d=0 le crop valait **0,5817 avant P13**, vaut **0,3702 après**,
       socle 0,7109 — **l'erreur est ×2,6.**
    2. ⛔ **« Cinq traînées » : il y en a 23** (68 colonnes, résidu 0,961) contre 4 au socle.
       ⚡ **Le « cinq » de P13 était un compte sur une découpe ×6.** Et son *« elles ne
       couvrent pas plus qu'avant »* est **vrai à la côte, FAUX à l'intérieur (×2,2)**.
    3. **Le retour de 574 canaux n'est PAS reproductible** : son script rejoué rend **1 174**,
       et **trois autres aller-retours rendent 0**. Bruit d'ordre de dessin, **qui ne menace
       aucun de ses chiffres de chanfrein, reproduits à la 3ᵉ décimale.**
  - ⚡ **VERDICT SUR « POSTE 2 = POSTE 4 » : À MOITIÉ VRAI.** Le reliquat de grain et le pavage
    **sont** un seul poste — **sa démonstration tient.** ⛔ **Mais la FRANGE n'en est pas**, et
    il a **trois** preuves, dont **la sienne : P13 a fait passer la frange de 9,20 % à 10,16 %
    sans toucher ni au champ ni au pas, RIEN QU'EN RENTRANT LE MUR.**
    ⚠️ **Et il signale que P13 AVAIT ce chiffre dans son propre JSON (10,09) et ne l'a pas lu.**
  - **LES CINQ MANQUES** : ① **les 23 traînées de jupe** (la jupe pend au rayon de la tuile, le
    mur est en dedans — **la longueur a été corrigée, pas le décalage latéral**) — **faible à
    moyen** · ② le pavage + le reliquat de grain — ⚠️ **plus cher que « 9× » : la constante
    porte elle-même l'argument qui l'interdit (384 est DÉJÀ plus fin que la source, 48 px de
    bathymétrie vraie)** · ③ la silhouette **×10,7 par axe** — **cher, jamais chiffré** ·
    ④ **l'éclairage de la paroi** — *« `mix(sol, ciel, …)` est une DROITE, l'irradiance vraie
    a un GENOU, et le pire écart tombe sur un mur VERTICAL »* · ⑤ la frange en marches.
  - ⚡⚡ **SA RÉPONSE À LA QUESTION D'ARBITRAGE — C'EST CE QUI ATTENDRA ADRIEN :**
    **RATTRAPABLE SANS CHANTIER (≈ +1 point) : ⑥ la décision de jupe (« le meilleur rapport du
    chantier, le banc existe »), ② le rosé, ① les +12,6 % d'énergie qui sont DANS L'ALBÉDO
    (la rampe ×3,12 de P11), et la moitié frange de ③.**
    ➡️ ⚡ **« 8,3/10 est atteignable SANS RIEN REBRANCHER. »**
    **HORS DE PROPORTION** : la **silhouette** (⚠️ **et sept rapports d'affilée déclarent
    n'avoir chronométré AUCUN coût de rendu — on ne peut pas décider sans cette mesure**) ·
    le **pavage** (*« peut-être pas soluble dans cette direction : la vraie question est la
    SOURCE bathymétrique »*) · l'**éclairage de la paroi** (**changement de MODÈLE, pas de
    coefficient**).
    ⚡ **« Si Adrien n'en ouvre qu'un, c'est le troisième » : il est le SEUL dont le gain se
    répartit sur TROIS critères — et le seul reste profond de ① : 22,32 % du modelé du crop
    vient de la lumière contre 45,51 % au socle. C'EST CE CHIFFRE QUI FAIT LIRE LE CROP COMME
    PEINT ET LE SOCLE COMME ÉCLAIRÉ.**
- **Tâche P14 livrée** (`17ddd41`) — DONE_WITH_CONCERNS. Vérifié : arbre propre,
  **4 115 tests** (+10), `audit:tests` **211/211**, page chargée levé (5 exécutions) ET baissé
  (**production intouchée : 591 361 sommets, tous les `u*On` à 0**).
  - ⛔ **① LA ROUTE NOMMÉE PAR P13 ET LE NOTEUR DÉSIGNE L'ENSEMBLE VIDE — ET C'EST MESURÉ
    VIDE.** L'emprise du crop vient de `terrain.fenetreBornee.emprise`, **donc elle est
    ALIGNÉE SUR LA GRILLE DE TUILES PAR CONSTRUCTION**. Éteindre les 14 tuiles que le test de
    traversée désigne (**des ancêtres z2/z3, à |u| = 519**) laisse **23 traînées sur 23**.
    ⚡ **Ce qui raye le mur, ce sont LES BORDS DES TUILES ENTIÈREMENT DEDANS.**
    ✅ **Livré** : `jupeHorsDuMur` (**une BANDE, pas un demi-plan** — sinon tout le quadtree
    grossier perd sa jupe) + une dilatation d'un cran le long de l'anneau. ⚡ **Le balayage du
    retrait est un ESCALIER À DEUX MARCHES tombant sur les anneaux du maillage : 23 → 17 avec
    la frontière seule, 23 → 9 avec son voisin — LE QUAD DE TRANSITION VAUT AUTANT QUE LA
    COUPE.**
    ✅ **Au banc du noteur rejoué intact** : traînées **23 → 9** (socle 4, **plancher de
    l'extinction totale : 10**) · colonnes **68 → 13** · résidu **0,961 → 0,604** · pic
    **12,51 → 9,59** · jupes couvrant du mur **903 → 253 px**.
    ⚡ **L'état livré passe SOUS le plancher de l'extinction totale.**
  - ⛔⛔ **② ET ③ SONT RÉFUTÉS PAR LA MESURE, PAS CORRIGÉS — ET LE « 8,3 SANS RIEN REBRANCHER »
    NE TIENT PAS :**
    - **③ n'est PAS la rampe ×3,12 de P11** : les deux amplitudes, **même page**, valent
      **2 896 m contre 2 967 m — 2,4 % d'écart**. Le balayage de l'ancre **ne descend jamais
      sous +9,6 %** et **multiplie la distance de teinte par 31**. ⚡ **L'extinction appariée
      le trouve dans LA NORMALE FINE DE P10** (rapport 1,111 → 0,775 quand on l'éteint) —
      **un gain que le noteur porte AU CRÉDIT du crop.** ➡️ **« C'est un arbitrage ① contre ⑥,
      pas un gain à baisser. »**
    - ⚡ **② EST LE SPÉCULAIRE DU SOCLE, isolé pour la PREMIÈRE FOIS du chantier** :
      **−3,94 % → −1,30 %** quand on l'éteint (424 828 canaux, retour 0), **et il porte aussi
      une part du rosé** (1,421 → 1,203). ➡️ ⛔ **Le reproduire = ajouter un terme spéculaire,
      c'est-à-dire LE POSTE QUE LE NOTEUR CLASSE HORS DE PROPORTION.**
    ➡️ ⚡ **« Un seul des trois postes était rattrapable. »**
  - **Le liseré de base est INCHANGÉ** par son travail (les 12 valeurs du noteur reproduites à
    la 4ᵉ décimale). ⚡ **« On ne peut pas le rendre en rentrant le mur : le socle rend un PIC
    et UNE DROITE NE FAIT PAS DE PIC. »**
  - **Onzième code mort** : `envMapIntensity = 0,15` sur le socle **ne déplace 0 canal** — pas
    d'`envMap` sur cet objet.
  - ✅ **Mouvement : dx=1 crop 0,8250 — l'état attendu AU CHIFFRE**, socle 0,0320,
    **10 pixels instables contre 66**, **retour 0 dans les 24 séries**.
  - **Réserves** : **9 traînées contre 4 au socle** (**les 5 restantes survivent à l'extinction
    totale**) · **au cadrage côte son retrait coûte 0,49 pt de frange et +313 px de nappe** ·
    un seul lieu · **aucun chronométrage**.
  - **Mutations 23/24** : **une survivante a montré une garde morte** (retirée), **une est
    ÉQUIVALENTE et vérifiée expérimentalement** (écart 1,5·10⁻⁸ contre une bande de 5,7·10⁻³),
    **et une troisième lui a fait écrire le test qui manquait.**
- **Relecture P13 + P14 — LES DEUX CONFORMITÉ ✅, 0 critique.**
  - ✅ **Piège du worktree vide évité par preuve** : `node_modules` installé dans CHAQUE
    worktree et **totaux vérifiés DIFFÉRENTS** — 4 087 → 4 105 → 4 115, 0 échec chacun.
  - ✅ **P13** : dette CRLF confirmée (**0 `w/crlf`, commit d'UN fichier / 42 lignes**),
    l'exagération fixe vérifiée **vivante dans le code**, **l'arithmétique des marges de
    garde-fou (×10,3 / ×58 / ×76 / ×431) auto-cohérente**, et **sa campagne de 42 mutations
    rejouée indépendamment : 42/42 exact.**
    ⚠️ **1 important** : un test annonce « le garde-fou mord quand on le force » mais
    **n'exerce que celui du congé, pas celui du chanfrein** — *le relecteur a cassé le second
    seul, et le test passe encore.*
  - ✅ **P14** : ⚡ **« la route vide » VÉRIFIÉE DANS LE CODE ET DANS LES DONNÉES** —
    l'emprise vient bien de `terrain.fenetreBornee.emprise`, et **éteindre les 14 tuiles
    « traversées » est mesuré comme une intervention NULLE (23/68/0,961 inchangés)** ·
    **traînées 23 → 9 reproduites exactement depuis le JSON brut** · ⚡ **l'équivalence de sa
    mutation reproduite indépendamment (1,521·10⁻⁸ contre une bande de 5,714·10⁻³)** ·
    campagne 23/24 reproduite · ⚡ **et LES DEUX RÉFUTATIONS CONFIRMÉES contre leurs données
    brutes** (le poste ③ à 2,4 % et non ×3,12 ; le poste ② −3,94 % → −1,30 %).
    ⚠️ **2 importants** : (1) **son propre JSON montre que la ligne « éclairage éteint » croise
    aussi 1,00 (0,863)**, ce qui contredit le mot « poste unique » — **la conclusion de fond
    survit** une fois cet état reconnu comme dégénéré (le rosé s'y effondre à 0,003) ;
    (2) ⚡ **une mutation du relecteur SURVIT** — un décalage d'un cran qui **retire le dernier
    sommet de l'anneau de bord** dans une boucle de lecture : **trou de couverture réel et
    étroit.**
- ⚡ **ÉTAT DU CHANTIER AU 2026-08-23 : 7,3/10, quatorze tâches livrées, TOUTES RELUES,
  4 115 tests, zéro critique ouvert.**
  **Les trois manques restants CONVERGENT TOUS VERS LE MÊME CHANTIER** — le modèle
  d'éclairage — **et il demande l'arbitrage d'Adrien** :
  **22,32 % du modelé du crop vient de la lumière contre 45,51 % au socle.**
- **Tour de correction P13–P14 livré** (`4cca4e7`) — **les TROIS points TRAITÉS, aucun
  réfuté.** Vérifié : arbre propre, **4 117 tests**, `audit:tests` **211/211**, page chargée
  levé ET baissé.
  - **①** Un test qui n'assertait **que** le garde-fou du congé assertait désormais **les deux
    séparément**. ⚡ **Vérifié en reproduisant la mutation exacte du relecteur : l'ancien test
    reste VERT, le neuf rougit.** Remise à zéro, diff vide.
  - **②** La phrase « poste unique » **réécrite** : elle nomme désormais **la ligne que le JSON
    portait (0,863)** et **explique pourquoi cet état est dégénéré** (le rosé s'y effondre
    à 0,003).
  - **③** Le décalage d'un cran fermé par **un test de COMPORTEMENT sur une vraie géométrie**,
    où **seul le dernier indice de l'anneau tombe dans la bande de garde**, isolé de ses
    voisins cycliques, **et qui appelle la vraie méthode**. ⚡ **Vérifié : la mutation du
    relecteur ne fait rougir QUE ce test.**

## ═══ ÉTAT DU CHANTIER — 2026-08-23, fin de la course autonome ═══

**7,3/10** (contre **3,5** au départ) · **quinze tâches livrées, TOUTES RELUES** ·
**4 117 tests, 0 échec** · **`audit:tests` 211/211** · **arbre propre** · **aucun critique
ouvert** · **production intouchée** (drapeau `?terre=unique` à `false` par défaut).

**Progression des notes** : ① relief 6→**9** · ② palette 3→**9** · ③ trait 3→**6** ·
④ mer 2→**6** · ⑤ parois 2→**7** · ⑥ propreté 3→**5**.

⚡ **CE QUI RESTE CONVERGE VERS UN SEUL CHANTIER — LE MODÈLE D'ÉCLAIRAGE**, et il demande
l'arbitrage d'Adrien :
- le liseré de base (*« le socle rend un PIC, une droite ne fait pas de pic »*)
- le rosé et les −4 % de luminance (**le SPÉCULAIRE du socle**, isolé par P14)
- le dernier tiers du modelé
➡️ **22,32 % du modelé du crop vient de la lumière contre 45,51 % au socle.**
**C'est ce chiffre qui fait lire le crop comme PEINT et le socle comme ÉCLAIRÉ.**

**Deux autres postes, hors de proportion et NON ouverts** : la **silhouette ×10,7 par axe**
(⚠️ **et huit rapports d'affilée déclarent n'avoir chronométré AUCUN coût de rendu — on ne
peut pas décider sans cette mesure**) · le **pavage** (*« la vraie question est la SOURCE
bathymétrique, pas la résolution du champ »*).

---

## SYNTHÈSE DE FIN DE COURSE — 2026-08-23

**Rapport publié pour Adrien** : Relevé de la Terre unique
→ https://claude.ai/code/artifact/e0b5ccc7-1b16-4c9d-865b-1283c667b29b

Contenu : la progression 3,5 → 7,3 par critère, la décision unique (le modèle
d'éclairage, 22,32 % contre 45,51 %), les deux chantiers classés hors de
proportion avec leur motif de refus, l'état du dépôt, et **les vingt-six chiffres
retirés par leurs propres auteurs** — c'est ce dernier point qui rend le reste
lisible.

**Rien n'a été ouvert sans lui.** Le modèle d'éclairage est un changement de
modèle, pas de coefficient : c'est son arbitrage.

**État à la remise** : `4cca4e7` · 4 117 tests, 0 échec · `audit:tests` 211/211 ·
arbre propre · production intouchée.
