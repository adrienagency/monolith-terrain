# Tâche J bis — LA BATHYMÉTRIE DANS LA SURFACE DU CROP

**Statut : DONE_WITH_CONCERNS.**
**La sortie n° 1 était atteignable, elle est prise, et la cause est fermée** : la
surface du crop porte désormais le relief sous-marin, lu dans **le champ même que
la mer lit**. Le désaccord que la Tâche J avait établi par élimination tombe de
**920,7 m à 2,85 m** d'écart moyen. **Mais ce que je vois à l'écran n'est toujours
pas le socle**, et le §6 dit lequel des défauts restants domine maintenant.

- Base : `de51c53` · branche `regroupement`
- `npm test` **3 683** (3 644 avant, **+39**) · `npm run audit:tests` **202/202** ·
  `node --check` sur les cinq fichiers touchés · arbre propre après commit
- Captures : `.banc/vues-Jbis/` · relevés bruts : `.banc/vues-Jbis/Jbis-releves-bruts.json`
- Mutation : **36/36 tuées** au troisième tour (19/35 au premier) — voir le §8

> ⚠️ **TOUS LES CHIFFRES DE CE RAPPORT SONT LUS DANS L'APPLICATION QUI TOURNE**,
> par `window.__exp`, et sont dans `Jbis-releves-bruts.json`. Aucun n'est recopié
> d'un test, d'un commentaire ou d'une tâche précédente.
> ⛔ **LES DÉNOMINATEURS SONT NOMMÉS À CHAQUE FOIS**, et il y en a **quatre**
> distincts dans ce rapport : les **échantillons de tuile** (256²/tuile), les
> **nœuds de champ** (385² = 148 225), les **sondes en eau** (3 105, un nœud sur
> quatre sur l'emprise du CROP), et les **pixels du bloc** (202 018). Ils ne se
> mélangent nulle part.

---

## 1. Étape 1 — LA MESURE : les tuiles ne portent pas le fond, et de combien

La question de la tâche était : *« les tuiles terrarium portent-elles des valeurs
négatives exploitables ? »* **Réponse : quelques-unes, et loin de suffire.**

Relevé sur l'application vivante, La Réunion z12, tuiles SOUS RÉSERVATION :

| | tuiles | échantillons | négatifs | zéros EXACTS | le plus bas |
|---|---|---|---|---|---|
| **z12 (le bloc)** | 9 | 2 359 296 | 69 638 (**2,95 %**) | 695 085 (**29,5 %**) | **−288,36 m** |
| z11 (l'emprise de la mer) | 25 | 1 638 400 | 8 803 (0,54 %) | 1 204 027 (73,5 %) | −4 297 m |

Le champ fusionné (`remplirHauteurs` + `fuseBathymetry`), lui, sur **148 225
nœuds** :

| emprise | portée | sous le niveau de la mer | zéros exacts | le plus bas |
|---|---|---|---|---|
| **le CROP** | 1 | 48 228 (**32,54 %**) | **0** | **−2 116,3 m** |
| la calotte | 3 | 101 017 (68,15 %) | 3 | −3 510,5 m |

➡️ **Sur l'emprise du bloc, le terrarium porte 288,36 m des 2 116,3 m de fond,
soit 13,6 %.** ⚠️ **Le dénominateur est l'emprise du CROP, pas celle de la
calotte** : rapporter les mêmes 288 m aux 3 510,5 m de la calotte aurait donné
**8,2 %**, un autre chiffre pour une autre question. Le terrarium sert la frange
côtière (jusqu'à −288 m), pas le fond marin.

**Et le désaccord lui-même**, sur **3 105 sondes EN EAU** de l'emprise du crop
(un nœud de champ sur quatre), la surface étant lue par `globe.hauteurSurface` :

| | profondeur MOYENNE de la surface | écart moyen surface↔champ | écart max | surface à zéro EXACT |
|---|---|---|---|---|
| **avant** | **0,22 m** | **920,7 m** | **2 116,27 m** | **90,4 %** |
| **après** | **919,71 m** | **2,85 m** | **310,01 m** | **1,9 %** |

La houle que la Tâche J accusait fait **73 m**. Le désaccord en faisait **920,7**,
soit **12,6 fois** — deux grandeurs en mètres, la même monnaie des deux côtés.
**Ce n'était donc pas la mer qui débordait, c'était le sol qui manquait.**

⚠️ **Les 2,85 m restants ne sont pas du bruit et je dis d'où ils viennent** : la
sonde lit le champ posé sur la **calotte** (385 nœuds sur 3 largeurs de crop)
pendant que la référence de ce tableau est un champ cuit sur le **crop seul**
(385 nœuds sur 1 largeur). C'est l'écart de rééchantillonnage entre deux grilles,
pas une erreur de loi ; il culmine à 310 m sur la pente la plus raide du talus.

## 2. Étape 3 — ce qui a été écrit, et pourquoi ça ne coûte pas une seconde fusion

**⭐ SORTIE 1 PRISE. On ne refusionne rien : on lit le champ qui existe déjà.**
`poserMer` cuit déjà 385² de `fuseBathymetry` sur l'emprise de la calotte
(Tâche J). Fabriquer une seconde fusion « pour les tuiles » aurait donné deux lois
à faire coïncider — et le §4 de `flux-terrain.js` explique déjà pourquoi une
fusion **par tuile** serait FAUSSE (les aplats de remplissage se constatent sur
l'emprise entière, jamais sur un neuvième d'histogramme).

⚠️ **Et 385 nœuds sont déjà PLUS FINS que la source** : sur `PORTEE_CROP = 3`,
ça fait **128 nœuds en travers du bloc**, quand la bathymétrie plafonne à
`BATHY_BASE_ZMAX = 8` — soit `3 × 256 / 2^(12−8)` = **48 pixels de donnée vraie**
en travers. Cuire « à la résolution des tuiles » n'aurait peint que de
l'interpolation, pour quatre fois la mémoire.

| fichier | ce qui change |
|---|---|
| `src/monde/fond-crop.js` | **NEUF**, pur : `altitudeMaillage`, `altitudeSonde`, `uvFond`, `echantillonnerFond`, `cleFond` |
| `src/globe.js` | `posAt` passe par `altitudeMaillage` · `hauteurSurface` par `altitudeSonde` · `poserFondCrop` / `retirerFondCrop` / `_poserTextureFond` / `_refaireMaillagesDuFond` · quatre uniformes (`uFondChamp`, `uFondOn`, `uFondPortee`, `uFondMetres`) et six lignes de fragment · `construireParoisCrop` descend `plancherMer` · `retirerCrop` retire le fond |
| `src/monde/branchement-crop.js` | `MAILLONS` passe à **six** (`fond` en deuxième) · `LECTEURS_DU_FOND` · la reprise entraîne les lecteurs |
| `src/monde/parois-crop.js` | le repli d'un point INCONNU devient un zéro écrit, au lieu de `plancherMer` |
| `src/main.js` | `contexteCrop().fond`, **dérivé de `ctx.mer`** et non recopié |
| tests | `fond-crop` (35, neuf) · `crop-branche` (+4) · `mer-sphere` ②d réécrit · `crop-habillage` ① (5 → 6 samplers) |

**Deux lois, et elles diffèrent parce que le dépôt diffère.** Sans fond,
`_buildMesh` écrête à zéro (`Math.max(h, 0)`) alors que `hauteurSurface` a
TOUJOURS rendu la valeur brute, négatifs compris. Une loi unique aurait changé
le comportement d'un des deux côtés **sans fond posé** — et le défaut par défaut
doit reproduire le dépôt au bit près (patron de `distanceRivage`, Tâche F, et
d'`aussi`, Tâche J). Avec un fond, les deux rendent la MÊME valeur : c'est
exactement le désaccord qu'on ferme.

**Une seule loi, deux lecteurs.** `uvFond` est la transcription mot pour mot de
`uvF = aCrop / (2.0 * uMerPortee) + 0.5` (`MER_VERT`), et le fragment du globe
lit `qCrop / (2.0 * uFondPortee) + 0.5`. Un test confronte les trois écritures.

## 3. Ce que le fond entraîne, et qui n'était pas dans l'énoncé

⚠️ **DEUX CHOSES SE SONT RÉVÉLÉES À L'ÉCRAN, PAS À LA LECTURE.**

**① Les parois ne suivaient pas.** Le §4 de `parois-crop.js` posait
`plancherMer = 0` en le justifiant : *« le globe pose ses sommets à
`Math.max(sampleHeights(...), 0)`, une paroi qui suivrait la bathymétrie brute
passerait SOUS la surface dessinée »*. C'est l'inverse depuis qu'un fond est
posé — et **mesuré** : `baseY` valait **−0,054 132 359 8** avec ET sans fond, au
millionième près, pour une surface descendue de 2 116 m. Le bloc avait une
surface au fond de la fosse et un flanc qui commençait deux kilomètres au-dessus.
Corrigé : `plancherMer` suit le fond. `baseY` vaut maintenant **−0,147 117**,
soit **2,718 fois plus profond**.

**② La reprise laissait la rampe périmée.** La nappe bathymétrique est
ASYNCHRONE : au premier passage le maillon `fond` REFUSE pendant que `parois` et
`rampe` PRENNENT, sur une surface encore plate. `reprendre` ne rejoue que ce qui
a refusé — donc quand le fond finissait par prendre, la rampe gardait sa
profondeur d'avant. **Relevé : `uOceanDepth = 130,36 m` avec 2 116,3 m de fond
sous les pieds.** D'où `LECTEURS_DU_FOND`. Après correctif, dans l'application
rechargée toute seule : **`uOceanDepth = 2 106,77 m`**.

## 4. Le coût — MESURÉ, pas déclaré

| | |
|---|---|
| une pose de fond **avec** reconstruction (34 maillages) | **42,2 ms** |
| une pose de fond **sans** reconstruction (champ identique) | **9,2 ms** |
| le champ gardé sur le globe | 592 900 octets (385², `Float32Array`) |
| sa texture (canal R, demi-flottant) | 296 450 octets |

⚠️ **Ce n'est pas par image.** `poserFondCrop` tourne au cran et à la reprise ;
il ne rebâtit que si la clé du fond a changé (`cleFond`, qui porte la
bathymétrie ET la profondeur maximale — sans quoi une nappe arrivée après coup
laisserait la surface plate en se croyant à jour).

⚠️ **La précision du demi-flottant est mesurée** : à 0,218 unité (la profondeur
maximale × l'échelle), l'ulp vaut **2,8 m au sol**. La houle qui traversait le
fond en faisait 73.

## 5. Le drapeau baissé — le mode plat est intouché

`http://localhost:5503/?globe=continu&socle=quadtree&f3=0&frontiere=1&seuil=1`,
page chargée jusqu'au bout, aucune exception : `terreUniqueBranchee false` ·
`veilleCrop.pose false` · `globe._mer` absent · **`globe._fondCrop` absent** ·
`uCropOn 0` · **`uFondOn 0`, `uFondChamp null`, `uFondMetres 1`** ·
`terrain.mesh.visible true`. Capture `Jbis-40-drapeau-baisse-mode-plat.png`.

`terrain.js`, `plinth.js`, `ocean.js` **ne sont pas modifiés**. Le seul fichier
partagé élargi est `parois-crop.js`, et **son défaut reproduit le dépôt au bit
près** (`plancherMer = 0`, verrouillé par un test) ; le repli d'un point inconnu
y rendait déjà zéro, il est simplement écrit comme tel au lieu d'être dérivé
d'une variable qui, elle, a changé de sens.

⚠️ **Une différence avec le relevé de la Tâche J, et elle n'est pas de moi** :
`uEstompageOn` vaut **1** ici (la Tâche J notait 0). Sans conséquence — tout
l'estompage vit à l'intérieur du bloc `if (uCropOn > 0.5)`, qui est sauté. C'est
un instant différent, pas un changement.

---

## 6. CE QUE JE VOIS À L'ÉCRAN — et non, ça ne ressemble toujours pas au socle

**Ce qui est réparé se voit, et le témoin le prouve.**
`.banc/vues-J/J-final-17-apres-commit.png` (le témoin exigé) montre une mer en
**taches bleues et vertes**. `Jbis-20-page-rechargee-12km.png`, même lieu, même
altitude (12 686 m), page rechargée et chaîne arrivée SEULE à `refus: []` :
**le marbrage a disparu.** La mer est une nappe continue, et sous elle il y a un
bassin qui descend — `Jbis-30/31-*-mer-cachee.png` opposent le **plateau vert
uniforme** de la Tâche J au **talus bleu** d'aujourd'hui.

**Le chiffre d'écran, avec son dénominateur et sa réserve.** Protocole du §0,
règle 2 : mer cachée, on **CACHE le groupe du globe et on compte ce qui CHANGE**
(le fond de scène est repris DANS CHAQUE ÉTAT, parce que reposer la rampe repeint
aussi le ciel). Sur les **202 018 pixels du bloc** (sur 739 840 du tampon), même
caméra, même image :

| | avant | après |
|---|---|---|
| verdâtres (`G > B + 8`) | 85,8 % | **55,8 %** |
| bleutés (`B ≥ G`) | 0,6 % | **21,4 %** |

⚠️ **CE CHIFFRE DIT UN SENS, PAS UN TAUX, et je préfère l'affaiblir que le
maquiller** : le classement est grossier — le socle **crème** du bloc a
`G − B = 30` et compte donc comme « verdâtre », et la terre du volcan aussi. Le
dénominateur contient la terre et les parois, qui n'ont aucune raison de devenir
bleues.

**Ce qui ne va toujours pas, par ordre de ce que ça coûte à l'œil :**

1. ⛔ **LA FRANGE D'ÉCUME EST ÉNORME.** À 5,5 km (`Jbis-21-descente-5-5km.png`),
   une bande blanche large et tachetée court sur tout le littoral et mange
   plusieurs centaines de mètres de mer. Elle existait déjà dans le témoin de la
   Tâche J ; elle est simplement devenue le défaut DOMINANT maintenant que la mer
   derrière est lisible. **Non mesurée, non touchée** — c'est `uMerEcume` /
   `shoreSurf`, donc P2 ou une tâche de mer.
2. ⚠️ **LE BLOC EST DEVENU 2,7 FOIS PLUS PROFOND**, et c'est la conséquence
   HONNÊTE du fond : à l'exagération 2,8, 2 116 m de fosse font 0,093 unité sur un
   bloc large de 0,429. Le mode plat, lui, **normalise** son relief dans une
   fenêtre bornée (`terrain.fenetreBornee`) au lieu d'appliquer une exagération
   brute. **Je ne sais pas si Adrien voudra cette profondeur-là** ; c'est une
   décision de produit, elle rejoint la Tâche L (l'exagération bornée, D6).
3. ⚠️ **LES JUPES PENDENT TOUJOURS SOUS LE BLOC** (`Jbis-20`, en bas à droite).
   `skirtDrop` vaut `min(max(chord × 0,012 ; 0,1) ; 0,9)` : sur une tuile z12 la
   corde fait ~0,20 unité, donc c est le PLANCHER de 0,1 qui gagne — soit **23 %
   de la largeur du crop** (0,4292). Un plancher calibré pour une planète,
   appliqué à un bloc. Déjà au catalogue
   de la Tâche Q. Elles dépassent un peu MOINS qu'avant, la base ayant descendu.
4. ⚠️ **TOUT RESTE DÉLAVÉ**, et les frontières de tuiles se lisent encore comme
   des aplats droits sur les flancs du volcan. C'est le sujet de la Tâche K, et
   `Jbis-40-drapeau-baisse-mode-plat.png` dit à quel point l'écart est grand : le
   socle a du grain, une terre cuite, un turquoise de lagon et des coins
   ARRONDIS ; le crop a un carré pâle.

## 7. Les deux constats de la Tâche J, creusés

**① `uCoastMaskOn` du globe vaut 0 — c'est un RAFRAÎCHISSEMENT absent, pas un
branchement absent.** Relevé : `terrain.mapUniforms.uCoastMaskOn = 1` avec sa
texture, `contexteCrop().habillage.coastMask` non nul, `globe.uniforms.uCoastMask
= null`. **Le maillon `habillage` a été posé AVANT que le masque du socle ne soit
prêt, et il ne refuse JAMAIS** (c'est écrit dans `branchement-crop.js` : « ce qui
manque se voit par un uniforme éteint, pas par un refus ») — donc la reprise ne
le rejoue pas. La chaîne est bonne, personne ne la rappelle.

**Et oui, c'était bien une part du plateau vert — mesuré, et le fond le
subsume.** En posant le masque à la main, sur le même tampon de 739 840 pixels :

| | pixels changés par le masque de côte |
|---|---|
| **sans** le fond (l'état que la Tâche J a constaté) | **67 084** (9,07 %) |
| **avec** le fond | **5 761** (0,78 %) |

Soit **11,6 fois moins**. `Jbis-14-sans-fond-avec-masque.png` montre ce que le
masque seul aurait donné : une mer BLEUE, mais **plate, à l'altitude zéro** — le
symptôme masqué, la cause intacte. **Je n'ai pas branché le rafraîchissement** :
décider comment l'habillage se rafraîchit est une question d'habillage (P2/P4),
et les 5 761 pixels restants sont la bande des polders et lagons, pas le plateau.

**② `uCropCoin` / `uCropCoinN` : réveillés, oui ; portant la forme du socle,
non.** Ils ont bien **quatre lecteurs** aujourd'hui (le `discard` du fragment du
globe, le bord de la mer dans `MER_FRAG`, `construireSolideCrop`,
`mesurerRelief`). **Mais `poserCrop` pose ses DÉFAUTS** — `corner = 0`,
`expo = 2` — et personne ne lui passe autre chose : relevé vivant
`uCropCoin = 0`, `uCropCoinN = 2`, quand le socle qu'il remplace porte
`uSlabCorner = 2,24` sur un demi-côté de 28 (**0,08 normalisé**) et un exposant
**4,4**. **Le crop est donc un CARRÉ là où le socle a des coins arrondis**, et ça
se voit en comparant `Jbis-20` à `Jbis-40`. La superellipse est appliquée, mais
avec un rayon nul : elle dégénère en carré. Ce n'est plus une constante morte,
c'est une constante **mal alimentée** — et corriger ça change la silhouette du
bloc partout, donc pas ici.

## 8. La campagne de mutation — **TROIS TOURS, ET LES DEUX PREMIERS ÉTAIENT MAUVAIS**

**36 mutations sémantiques**, chacune change le COMPORTEMENT et non une chaîne
qu'une assertion cherche : défaut d'écrêtage retiré, terre prise dans le champ,
`min(hFond, 0)` remplacé par `hFond` (des DEUX côtés), `null` devenu zéro, `uvFond`
sans son demi-champ / sur la portée au lieu du diamètre / retourné nord-sud, borne
du champ retirée, bilinéaire réduite au plus proche nœud, champ lu transposé, clé
sans la bathymétrie, `posAt` et `hauteurSurface` qui ignorent le fond, refus de
couverture et `exigerBathy` désarmés, reconstruction systématique puis jamais,
`uFondMetres` porteur de l'échelle au lieu de son inverse, `uFondPortee` figé,
`retirerCrop` qui laisse le fond, `plancherMer` remis à zéro, nuanceur qui ignore
le fond / le laisse déborder / fait sortir une butte, `poserFondCrop` sans crop et
sans `remplir`, `fond` posé après ses lecteurs, `LECTEURS_DU_FOND` vidé, `neuf`
toujours vrai puis toujours faux, reprise qui rejoue deux fois, portée du fond
désaccordée de celle de la mer, `remplir` retiré du contexte.

⛔ **PREMIER TOUR : 19 TUÉES, 14 SURVIVANTS, 2 INAPPLICABLES.** Un mauvais
résultat, et il disait quelque chose de précis : **tout ce qui vivait dans les
MÉTHODES du globe et dans le NUANCEUR passait à travers**, parce qu'aucun test ne
les appelait. J'avais écrit des tests pour la loi pure et cru que ça suffisait.

**Ce que le premier tour a fait écrire :**
- **huit tests sur `poserFondCrop` / `retirerFondCrop` / `_poserTextureFond` /
  `_refaireMaillagesDuFond`**, en empruntant les vraies méthodes
  (`Globe.prototype.X.call(faux, …)`, le précédent de `globe-precision`) ;
- **quatre tests qui EXÉCUTENT le nuanceur** : le bloc GLSL est extrait de la
  source, translittéré mécaniquement en JavaScript (`min`/`max`/`abs` → `Math`,
  la lecture de texture → un échantillonneur de papier) puis **opposé à
  `altitudeSonde`**. C'est le procédé de `mer-sphere.test.js`, qui « EXTRAIT
  cette expression pour la confronter à elle » ;
- **deux tests de reprise réécrits** : `⑥ ter bis` faisait prendre le fond DÈS LA
  POSE, donc la reprise ne rappelait jamais le maillon et `neuf: true` survivait ;
- **les deux mutations INAPPLICABLES** venaient d'apostrophes typographiques dans
  mes motifs de recherche — corrigées, elles sont devenues applicables (et la
  première s'est dédoublée : la même faute existe dans les DEUX lois).

⛔ **DEUXIÈME TOUR : 34 TUÉES, 2 SURVIVANTS, 0 INAPPLICABLE.** Et les deux
survivants étaient instructifs :
- **« le champ lu transposé » a survécu À SON PROPRE TEST.** J'avais écrit un test
  contre cette mutation-là au premier tour ; il tombait sur le BORD du champ, où
  l'écrêtage de `i0` ramenait la sonde sur la diagonale — exactement le défaut
  qu'il devait attraper, une seconde fois. **Une sonde sur la diagonale d'une
  matrice ne distingue jamais une transposition.**
- **« `retirerCrop` laisse le fond en place »** : personne ne testait `retirerCrop`.

✅ **TROISIÈME TOUR : 36 TUÉES, 0 SURVIVANT, 0 INAPPLICABLE.**

⚠️ **CE QUE JE RETIENS, ET ÇA VAUT PLUS QUE LE 36/36** : mes tests de LOI PURE
étaient bons du premier coup ; ce sont les tests de BRANCHEMENT qui manquaient
tous. Une loi pure se teste facilement et se croit testée ; ce qui casse à l'écran
vit dans les méthodes qui l'appellent et dans le nuanceur qui la transcrit. **Sans
la campagne, j'aurais livré quatorze trous en croyant avoir bien travaillé.**

⚠️ **EN PLACE, AVEC SAUVEGARDES OCTET PAR OCTET, PAS DANS UN `git worktree`** —
même raison que la Tâche J : `core.autocrlf` a déjà rendu de faux survivants à
quatre agents de ce chantier, un aller-retour d'octets ne retraduit aucune fin de
ligne, et l'arbre testé est **celui qui tourne**. Le script vérifie l'empreinte
SHA-256 de chacun des cinq fichiers après chaque mutation, et à la fin.
Il est laissé sur le disque : `…/scratchpad/mutations-Jbis.py`.

## 8 bis. LES FINS DE LIGNE — et le piège n'est pas celui qu'on croyait

`git diff --stat` et `git diff --ignore-cr-at-eol --stat` rendent **le même
compte** sur les huit fichiers modifiés. Vérifié après chaque édition.

⚠️ **J'ai trouvé un fichier déjà abîmé en arrivant** :
`docs/superpowers/plans/2026-08-22-globe-studio.md` était dans l'arbre en CRLF
alors que son blob est en LF — `git diff` annonçait **625 lignes pour 52 réelles**.
Remis en LF avant le commit. **Ce n'est pas mon édition** (le fichier était déjà
modifié à mon arrivée : c'est l'ajout de la Tâche J bis au plan), mais il part
dans le même commit, et il fallait le dire.

⛔ **ET LA CONSIGNE HÉRITÉE EST FAUSSE DANS SA RAISON, JE L'AI MESURÉE.** La
Tâche J écrit que **`src/monde/flux-terrain.js` est le SEUL fichier LF du
dépôt**. Compté à l'octet sur `src/`, `test/`, `scripts/` et `docs/` :
**533 fichiers, dont 382 en CRLF dans l'arbre de travail** — et
**TOUS les blobs sont en LF**, `flux-terrain.js` compris, vérifié par
`git show HEAD:<f>`. Le vrai mécanisme est celui-ci :

- **`core.autocrlf` vaut `true` au niveau SYSTÈME** (`C:/Program Files/Git/etc/gitconfig`)
  et **`false` au niveau du DÉPÔT** (`C:/Dev/monolith-terrain/.git/config`, que ce
  worktree partage) ;
- l'arbre a donc été **extrait en CRLF** (quand le `true` du système s'appliquait),
  et l'index porte le `stat` de ces fichiers-là — c'est pour ça que `git status`
  les dit propres alors que leurs octets ne sont pas ceux du blob ;
- **depuis, `autocrlf = false` : git ne convertit plus rien.** Tout outil qui
  réécrit un de ces 382 fichiers **en gardant ses CRLF** enverra donc le fichier
  ENTIER dans le blob. C'est exactement le « 1 541 lignes pour 87 réelles » de la
  Tâche J, et ça n'a jamais eu de rapport avec une particularité de
  `flux-terrain.js`.

➡️ **La consigne (`git diff --stat` contre `git diff --ignore-cr-at-eol --stat`
après chaque édition) reste la bonne** — c'est sa justification qu'il faut
corriger, et le prochain agent doit savoir que **n'importe lequel des 382 est
concerné**, pas un seul. Les fichiers que j'ai touchés sont ressortis en LF sur
le disque (l'outil d'édition normalise), ce qui **coïncide avec leurs blobs** :
le diff est donc propre, et c'est vérifié plutôt que supposé.

## 9. Réserves

1. ⛔ **La frange d'écume est le nouveau défaut dominant** (§6, point 1). Elle
   n'est ni mesurée ni touchée, et je ne l'ai vue qu'à 5,5 km.
2. ⚠️ **Le bloc 2,7 fois plus profond est une décision de produit non validée.**
   Le mode plat normalise, le crop exagère. C'est cohérent avec ce que la Tâche J
   demandait, mais Adrien n'a pas vu ce bloc-là avant aujourd'hui.
3. ⚠️ **La boucle rAF du volet de prévisualisation s'arrête dès que le volet
   n'est plus composite**, et ça a coûté une heure. Les captures et les mesures
   sont prises APRÈS que la chaîne a atteint son régime établi TOUTE SEULE
   (`refus: []`) ; les états avant/après sont ensuite obtenus en appelant
   `retirerFondCrop` / `poserFondCrop` + `construireParoisCrop` + `poserRampe`
   **à la main**, sur la même caméra et la même image. **Ce n'est pas la boucle
   d'image qui les a produits**, et c'est écrit dans les relevés bruts.
4. ⚠️ **Un seul lieu, une seule altitude de mesure.** La Réunion, z12, 12 686 m
   (plus une vue à 5,5 km). Rien n'a été vu à haute latitude, ni à cheval sur
   l'antiméridien, ni sur un crop **entièrement continental** — où le champ n'a
   aucun nœud sous zéro et où le fond ne devrait donc rien changer. Le chemin est
   raisonné (un `min(hFond, 0)` sur un champ tout positif rend zéro, c'est-à-dire
   le dépôt), **pas observé**.
5. ⚠️ **`_refaireMaillagesDuFond` ne rebâtit QUE les tuiles qui ont encore leurs
   hauteurs**, c'est-à-dire l'emprise réservée. La calotte est réservée, donc le
   cas ne se pose pas aujourd'hui — **mais il se posera si la portée du champ
   dépasse un jour la réservation**, et alors une tuile hors réservation gardera
   son fond plat sans qu'aucune erreur ne se lève.
6. ⚠️ **Le fond CUIT SON PROPRE CHAMP**, il n'emprunte pas celui de la mer :
   deux `remplirHauteurs` de 385² par pose de chaîne au lieu d'un. Mesuré à
   **9,2 ms** la cuisson seule. Un cache aurait dû décider de sa propre
   fraîcheur, ce qui est la question que la nappe asynchrone rend difficile.
   **Le prix est petit et il est dit ; ce n'est pas « négligeable ».**
7. ⚠️ **Les 2,85 m d'écart résiduel** viennent de deux grilles de champ
   différentes (§1), pas d'une erreur de loi — mais je ne l'ai vérifié que par le
   raisonnement et l'ordre de grandeur, **pas par un banc dédié**.
8. ⚠️ **Le chiffre d'écran vert/bleu est grossier** (§6) et je le donne comme un
   sens, pas comme un taux. Un classement par teinte contre la rampe nautique
   aurait été juste ; je ne l'ai pas fait plutôt que de publier un taux faux.
