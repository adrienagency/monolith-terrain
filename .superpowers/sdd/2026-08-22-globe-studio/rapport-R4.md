# Rapport R4 — LA POSE DE CAMÉRA NE SAUTE PLUS

**Statut : DONE_WITH_CONCERNS.**
Branche `regroupement`, arbre `C:\Dev\wt-merge`, sur `d366a40`.

> ══════════════════════════════════════════════════════════════════════════
> ## ⚠️ TOUR DE CORRECTION — CE QUI A CHANGÉ DEPUIS LA PREMIÈRE LIVRAISON
>
> La relecture a rendu **un constat critique et huit autres. Les neuf sont
> fondés**, et je n'en réfute aucun. **Trois chiffres publiés au premier tour
> étaient faux** ; ils sont retirés et remplacés par des relevés que j'ai faits
> moi-même, sur la RTX 3080 d'Adrien.
>
> | constat | ce qu'il devient | où |
> |---|---|---|
> | **C1 — « 0,97°/image sur GPU réel », non mesuré** | **FONDÉ, et c'est pire : un DÉFAUT, pas un chiffre.** Mesuré par moi : **4,135°, six pas au-dessus de 3°**. Le code est corrigé, la mesure d'après donne **1,500°**. | §4 |
> | **I2 — 9 mutations sur 26 survivent** | **FONDÉ pour sept.** Sept sont tuées par 12 tests neufs de comportement ; **deux sont des mutants ÉQUIVALENTS**, démontré et vérifié en rejouant la mutation. | §9 |
> | **I3 — la conclusion sur les parois généralisée à la géométrie** | **FONDÉ — et la mesure d'origine était biaisée par son propre plancher.** Remesurée grain gelé : **la géométrie n'est PAS soldée.** | §1 ③ |
> | **I4 — compte de franchissements faux** | **FONDÉ.** **11 sur 11 → 0 sur 11**, recomptés sur les traces. | §0, §1 ① |
> | **m5 — `46,551°` faux, six fois** | **FONDÉ.** **46,548157698978°** aux six endroits, et l'identification est exacte, pas approchée. | partout |
> | **m6 — la décomposition ne vaut que pour une scène, en pleine mer** | **FONDÉ.** Bornée explicitement. | §1 ③ |
> | **m7 — trois assertions de texte source** | **FONDÉ.** Retirées, remplacées par du comportement. | §9 |
> | **m9 — « 31 % de la plage de luminance »** | **FONDÉ.** Reformulé : 79 niveaux sur 255. | §1 ② |
> | **m8 — le cadeau pour R6 est derrière une porte binaire** | **FONDÉ**, repris tel quel et transmis. | §5 |
>
> ⚡ **Et une information venue de la tâche R6 a rouvert la mesure du §1 ③** :
> « grain gelé, le plancher tombe à 0,00 ». **Vérifié par moi, et c'est presque
> vrai — mais le 43 % retiré ne revient pas pour autant.** Voir §1 ③.
> ══════════════════════════════════════════════════════════════════════════

**Commits :** `9af9b4f` + `6876607` (premier tour), puis, au tour de correction,
**`e6e34d3` (m5) · `e18a8f5` (C1) · `5465a0f` (I2 + m7) · `d5add61` (I3 + m6)** —
détail et vérification commit par commit au §10.
**4 214 tests, 0 échec** (4 202 au début du tour de correction, +12 tests neufs) ·
`npm run audit:tests` : **216 = 216**.

> ⚠️ **Le `WITH_CONCERNS` porte sur DEUX choses, et une seule est du code** :
> le claquement de contenu reste entier (§5), et **deux des trois points du
> brief sont contredits par la mesure** (§1). Le saut de pose, lui, est fermé et
> chiffré des deux côtés.

---

## 0. EN UN COUP D'ŒIL

Descente instrumentée **de `MAX_ALT_M` (60 000 km) au sol**, drapeau levé
(`?terre=unique&frontiere=1&seuil=1&globe=continu&socle=quadtree&f3=0`), une
ligne par image de rendu. Grandeur : **l'inclinaison de la visée par rapport au
nadir LOCAL** — 0° = à la verticale, 90° = rasant.

| grandeur | avant (`d366a40`) | après (tour de correction) |
|---|---|---|
| plus grand écart d'inclinaison d'une image à la suivante | **46,548°** | **1,500°** — le plafond, §4 |
| écart d'inclinaison à la plongée orbite → surface | **46,548° en 1 image** | **46,548° en 54 images / 1 912 ms** |
| **franchissements de niveau tournant la caméra** | **11 sur 11**, de **0,970° à 10,394°** | **0 sur 11** |
| plus grand écart après le balayage, jusqu'à z14 | — | **0,000°** |
| plage d'inclinaison après le balayage | 34,52° → 54,05° (**dérive de 19,5°**) | **46,548° et rien d'autre** |
| altitude de naissance du crop | 32,3 km | inchangée |
| bascules de `veilleCrop` sur la descente | 1 | 1 |

⛔ **LA LIGNE DES FRANCHISSEMENTS DISAIT « 7 SUR 7 » ET « 0 SUR 10 » — c'était
faux (constat I4).** La trace en contient **onze de chaque côté**, recomptés par
moi (§1 ①). Le correctif les ferme **tous les onze** : le résultat est meilleur
que ce qui était écrit, mais un compte qui se présente comme complet doit l'être.

⚠️ **ET LA LIGNE DU PLUS GRAND ÉCART DISAIT « 4,12°, BORNÉ À 4,23° » — c'était
un chiffre de banc présenté comme une borne, et la borne ne bornait rien
(constat C1).** Mesurée par moi en Chrome VISIBLE sur la RTX 3080 d'Adrien, la
pointe valait **4,135°**, avec **six pas au-dessus de 3° par balayage**. C'est un
défaut, pas une formulation : il est corrigé au §4, et la même mesure rejouée
après correction donne **1,500°, zéro pas au-dessus de 2°**.

| descente, GPU réel, Chrome visible | balayage | pas de pointe | > 3° | > 2° |
|---|---|---|---|---|
| `.banc/R4/r4c-gpu-avant.json` (avant correction) | 34 img / 1 974 ms | **4,135°** | **6** | **11** |
| `.banc/R4/r4c-gpu-apres.json` (après) | 54 img / 1 912 ms | **1,500°** | **0** | **0** |

**Drapeau baissé** (`?f3=0`), même sonde, même départ, rejoué par moi au tour de
correction (`.banc/R4/r4c-prod-apres.json`) : inclinaisons distinctes
**0,000° / 46,548° / 59,330°**, plongée **0,000° → 46,548° en une image**,
`uCropOn` max 0, `veilleCrop.bascules` 0, **0 erreur de page** — identique au
caractère près à la trace prise sur `d366a40` (`relec-prod-avant2.json`). **La
production est rigoureusement inchangée**, et c'est vérifié à l'écran, pas déduit.

---

## 1. ⛔ CE QUE LE BRIEF DIT, ET QUE LA MESURE CONTREDIT

Le brief et le recadrage m'ont donné trois points. ① est juste dans
l'observation, faux dans la cause — et il est **fermé**. ② est **faux**, et je le
réfute sur les propres images d'Adrien.

⚠️ **③ ÉTAIT ANNONCÉ COMME RÉFUTÉ AU PREMIER TOUR ; IL NE L'EST QUE POUR
MOITIÉ.** La réfutation tenait dans le régime mesuré — animations allumées, où
rien de géométrique ne dépasse le bruit — mais **le régime était mal choisi, et
le banc mesurait son propre plancher.** Remesuré grain gelé, la géométrie
ressort : les parois pèsent trois à treize fois le plancher, et **le fond du crop
huit fois les parois**. Le §1 ③ est **entièrement refait** ci-dessous, et
**c'était le constat I3 de la relecture**.

### ① « Entre `t23` et `t26`, la caméra a changé de POSE » — l'observation est juste, la cause ne l'est pas

Le brief place ce changement de pose au voisinage du crop. **Mesuré, à trois
décimales : la naissance du crop ne touche pas à la caméra.**

Trace `avant-max`, images 2089 → 2090, altitude 32,27 km, `uCropOn` passe de 0 à 1 :

    | image | uCropOn | inclinaison |
    | 2089  |    0    | 54,047°     |
    | 2090  |    1    | 54,047°     |

Les sauts de pose sont ailleurs, et il y en a **deux familles** :

⛔ **CE TABLEAU S'ARRÊTAIT À LA NAISSANCE DU CROP SANS LE DIRE, ET LE COMPTE QUI
L'ACCOMPAGNAIT — « 7 sur 7 » — SE PRÉSENTAIT COMME COMPLET (constat I4).** Il ne
l'était pas : **la trace en contient onze**, dont **quatre non listés**. Recomptés
par moi sur `avant-max.json`, en repérant chaque fin de rechargement en surface
(`busy` retombe à faux) :

| image | événement | inclinaison | altitude |
|---|---|---|---|
| 346 | **plongée orbite → surface** | 0,000° → **46,548°** | 5 977 km |
| 652 | franchissement z3 → z4 | 46,548° → 36,154° (**−10,394°**) | 2 953 km |
| 884 | z4 → z5 | 36,154° → 34,522° (−1,632°) | 1 476 km |
| 1098 | z5 → z6 | 34,522° → 37,093° (+2,571°) | 739 km |
| 1335 | z6 → z7 | 37,093° → 38,387° (+1,294°) | 369 km |
| 1556 | z7 → z8 | 38,387° → 40,981° (+2,594°) | 185 km |
| 1768 | z8 → z9 | 40,981° → 45,918° (+4,937°) | 92 km |
| 1984 | z9 → z10 | 45,918° → **54,047°** (+8,128°) | 46 km |
| **2202** | **z10 → z11** | **−0,970°** | **22,9 km** |
| **2428** | **z11 → z12** | **−3,544°** | **11,5 km** |
| **2663** | **z12 → z13** | **−6,807°** | **5,7 km** |
| **2895** | **z13 → z14** | **+6,067°** | **2,9 km** |

➡️ **La fourchette réelle est donc 0,970° à 10,394° sur ONZE franchissements**,
pas « 1,29° à 10,39° sur sept ». Après correction, les onze rendent **0,000°** —
et les quatre derniers, qui n'étaient pas comptés, sont fermés eux aussi.

⚠️ **`46,548°` n'est pas un nombre approché — et « au centième près » était une
sous-estimation, pas une prudence (constat m5).** C'est une **identité
géométrique** : `PENTE_ARRIVEE = {y: 18, z: 19}` (`loi-altitude.js:53`) pose la
caméra d'arrivée le long de `(0, 18, 19)` depuis une cible qui est à son aplomb,
donc l'angle au nadir vaut `atan(19/18) = 90° − atan(18/19)` **par construction,
à toute altitude**. Calculé : **46,548157698978°**. Relevé dans la trace :
**46,548157698978194°**. **Treize décimales.**

⛔ **ET LE CHIFFRE IMPRIMÉ ÉTAIT FAUX : 46,551°, répété SIX fois** (ici, deux
blocs de commentaire, deux tolérances de test). Corrigé aux six endroits ; les
deux tolérances de test passent de 0,01/0,05 à 1e-9 et 0,01 — au-delà, elles
cachaient précisément cette erreur-là.

En orbite la caméra vise le centre de la planète — donc le nadir local, à
**toutes** les altitudes (0,000° relevé sur toute la portion orbitale). En
surface, la pose d'arrivée de ShibuMap est oblique. La bascule des deux repères
EST le saut.

Et les franchissements ne « bougent » pas la caméra au hasard : ils font
**dériver l'angle de vue de 19,5°** au fil d'une descente, de 34,5° à 54,1°.
Le commentaire de `_suivreEmprise` promettait le contraire depuis la Tâche M.

### ② « L'assombrissement touche l'interface HTML, donc c'est une surcouche au niveau de la page » — ⛔ IL N'Y EN A PAS

Le brief demande de trouver une surcouche sombre. **Elle n'existe pas, et
l'instrument qui le dit a un témoin positif.**

Mesuré sur les 39 images d'Adrien (luminance moyenne, `jpeg-js`) :

| ce qu'on mesure | t01…t23 | **t24** | **t25** | **t26** | t27…t37 | **t38–t39** |
|---|---|---|---|---|---|---|
| **bouton « Publier »** (élément DOM **opaque**) | 141,1–143,3 | **143,3** | **142,0** | **141,4** | 141,4–143,3 | **111,6 / 111,9** |

⚡ **La colonne `t38–t39` est le TÉMOIN POSITIF, et c'est elle qui rend la
réfutation solide.** À `t38` Adrien ouvre le panneau **Paramètres**, qui pose un
vrai voile sombre sur la page : le bouton tombe de 142 à **111**. **L'instrument
est donc démontrablement sensible à exactement le phénomène décrit — et à
`t24`/`t25`/`t26` il ne bouge pas d'un niveau.**

Ce qui se passe à `t25`, c'est **du flou, et il est hors de la page** :

| ce qu'on mesure | valeur typique t01…t39 | **t25** | **t26** |
|---|---|---|---|
| luminance de la **barre d'URL de Chrome** | 220,6–222,2 | 221,8 | 220,6 |
| **netteté** de la barre d'URL (variance du laplacien) | 81,6–90,7 | **57,4** | **70,8** |

La barre d'URL n'appartient pas à la page : ShibuMap ne peut ni l'assombrir ni
la flouter. Sa netteté chute quand même. **C'est la vidéo — encodage ou capture —
pas l'application.**

Et dans l'application elle-même, mes propres captures de descente le confirment :

| altitude | bouton « Publier » (DOM) | carte « Mes créations » (DOM) | **canevas 3D** |
|---|---|---|---|
| 53 461 m | 152 | 201 | 169 |
| 40 957 m | 152 | 201 | 168 |
| **35 377 m** (crop absent) | **152** | 204 | **173** |
| **30 487 m** (crop posé) | **152** | 195 | **94** |
| 22 908 m | 152 | 195 | 100 |

**Le canevas perd 79 niveaux de luminance — 173 → 94 — quand le DOM opaque n'en
perd aucun.** Ce qui s'assombrit est la SCÈNE, vue au travers de panneaux
translucides. Il n'y a rien à trouver au niveau de la page.

⚠️ **CETTE PHRASE DISAIT « 31 % DE LA PLAGE DE LUMINANCE » (constat m9), et
c'était une formulation qui glissait.** 79 niveaux, c'est **31 % des 255 de
l'ÉCHELLE** — pas une baisse relative de 31 %, laquelle vaut **46 %**
(79/173). Le calcul était juste, la phrase ne l'était pas ; on donne donc les
niveaux, qui ne se prêtent à aucune lecture double.

⚠️ **`_whiteout` (`modes.js`) n'y est pour rien non plus, et pour deux raisons
indépendantes** : `.whiteout { background: #ffffff }` (`style.css:590`) — il est
**blanc** —, et `_continu()` le court-circuite sous le drapeau.

### ③ « Le fondu de la GÉOMÉTRIE seule — la découpe et les parois » — ⚠️ LA MESURE D'ORIGINE MESURAIT SON PROPRE BRUIT

Le recadrage me confie la géométrie et laisse le style à R6.
`scripts/sonde-claquement.mjs` immobilise la caméra à **~28 800 m** (le crop vient
de naître) et retire les maillons un par un, en capturant l'image composée.

⛔ **CE PARAGRAPHE EST ENTIÈREMENT REFAIT (constats I3 et m6, plus une
information de la tâche R6).** La première version concluait « les parois ne
pèsent rien », sur la foi d'un plancher de bruit de 8,97 — **et elle avait
raison dans le régime mesuré, mais le régime était mal choisi.** Trois défauts,
tous corrigés dans le banc :

1. **Le plancher n'était pas un plancher, c'était de l'ambiance qu'on pouvait
   éteindre.** `params.animations = false` (`src/animations.js`, interrupteur
   unique) alimente les agréments avec `dtAmb = 0`.
2. **Tout était comparé à la PREMIÈRE capture.** Le premier état retiré était à
   900 ms de la référence, le dernier à 4 500 : un banc qui dérive attribue au
   dernier maillon ce qui n'est que du temps écoulé.
3. **L'écart se calculait « hors du script ».** Il se calcule dedans, désormais,
   avec son cadre (1200×640) et sa formule de luminance sous les yeux.

**Le banc porte donc `--anim 0` et un TROISIÈME témoin**, et il rend deux
tableaux. Voici celui qui compte : chaque état comparé au **précédent**, tous à
900 ms d'écart. Deux passes, pour montrer la reproductibilité.

| écart consécutif | ambiance ANIMÉE (le régime d'Adrien) | ambiance GELÉE, passe 1 | passe 2 |
|---|---|---|---|
| crop entier → témoin (rien touché) | 9,51 · 46,7 % | 5,11 · 14,3 % | 2,81 · 7,6 % |
| **témoin → témoin** (**LE PLANCHER**) | **9,17 · 45,3 %** | **0,13 · 0,2 %** | **0,47 · 0,9 %** |
| témoin → **sans parois** | 9,21 · 44,8 % | **1,76 · 3,6 %** | **1,57 · 3,2 %** |
| sans parois → **sans fond du crop** | 19,76 · 58,8 % | **13,53 · 46,2 %** | **14,00 · 47,3 %** |
| sans fond → **sans style** | 39,46 · 86,4 % | **25,55 · 74,6 %** | **25,84 · 74,9 %** |
| sans style → planète nue | 11,67 · 55,1 % | 0,74 · 0,8 % | 0,62 · 0,7 % |

**Ce que ça dit, et c'est différent de ce qui était écrit :**

- ⚡ **Le plancher gelé est quasi nul — 0,13 à 0,47 — mais PAS 0,00, et pas tout
  de suite.** La première capture d'après référence vaut encore 2,8 à 5,1 : la
  scène finit de se poser. Il faut **deux** témoins pour le voir. *(L'information
  venue de R6 — « le plancher tombe à 0,00 » — est donc juste en direction, et
  optimiste d'un cheveu sur cette scène-ci.)*
- ⛔ **LE 43 % NE REVIENT PAS.** Retirer les parois déplace **3,2 à 3,6 % des
  pixels** de plus de 8 niveaux, pas 43. Le 43 % ÉTAIT le grain, et le retirer
  était juste. **Je ne le déterre pas.**
- ⚠️ **MAIS « les parois ne pèsent rien » était trop fort.** À 1,57–1,76 contre
  un plancher de 0,13–0,47, elles pèsent **trois à treize fois le plancher** :
  elles étaient **noyées**, pas absentes. Dans le régime où Adrien joue
  (animations allumées), elles restent invisibles sous un plancher de 9,2 —
  **la conclusion pratique tient, la conclusion générale non.**
- ⛔ **ET LA GÉOMÉTRIE N'EST PAS SOLDÉE, C'ÉTAIT LE CONSTAT I3.** Le **fond du
  crop** pèse **13,5 à 14,0**, soit **environ huit fois les parois** et **trente
  fois le plancher gelé** — et le fond est de la géométrie, pas du style. La
  première version l'écartait comme « incohérent à mesurer » (le démontage à
  chaud casse l'image) sans jamais dire que la part géométrique restait donc
  ouverte. **Elle l'est.**
- Le **style** reste le premier poste : **25,6 à 25,8**, soit près du double du
  fond. C'est bien ce que D15 confie à R6.

⚠️ **RÉSERVE DE LECTURE, ET ELLE PORTE SUR TOUTE LA COLONNE « GELÉE ».** Les
états sont **cumulatifs** : « sans fond » est mesuré à partir de « sans parois ».
Chaque écart consécutif dit donc « ce que ce maillon-ci ajoute, une fois les
précédents retirés », pas « ce que ce maillon vaut seul ». Et le démontage à
chaud laisse la scène incohérente (`2-sans-fond.png` est visiblement troué) :
**ces chiffres sont des ordres de grandeur, pas des budgets de fondu.**

⚠️ **ET ILS NE VALENT QUE POUR UNE SCÈNE — celle-ci, EN PLEINE MER (constat
m6).** Le banc part du lieu de démarrage par défaut ; `0-crop-entier.png` est un
aplat bleu-vert et `4-planete-nue.png` l'aplat olive de D15. Les grands écarts
mesurent donc pour l'essentiel **« la mer contre l'olive »**. Sur une scène de
terre — Zagora, ce que filme Adrien — la répartition peut être tout autre.
**Aucune des lignes ci-dessus n'est transposable sans être remesurée.**

---

## 2. L'INSTRUMENT QUI MANQUAIT

**`scripts/sonde-descente.mjs`** — une descente pilotée, **une ligne par image de
rendu**. Elle enregistre l'altitude de cadrage, la distance à la cible, **la
direction de visée en coordonnées monde**, l'inclinaison au nadir local, la
position et la cible, `uCropOn`, `veilleCrop.pose`/`.bascules`/`.repos`,
`veilleEstompage.valeur`, le mode, `modes.busy` et le zoom du bloc.
**`scripts/lit-sonde-descente.mjs`** en tire les trois tableaux du §0.

⚠️ **Pourquoi la Tâche M n'a rien vu, et pourquoi elle avait raison quand même.**
Elle mesurait **l'altitude** et son rapport d'une image à l'autre. Une caméra qui
bascule du nadir à l'oblique **sans bouger d'un mètre** garde son altitude ET son
rapport d'altitude : sa mesure ne pouvait structurellement pas voir ce défaut.
Sa mesure est bonne, son périmètre ne l'était pas — le brief le disait déjà.

Trois pièges rencontrés en montant le banc, tous corrigés dans le script et
documentés dedans, parce que chacun a d'abord produit un faux résultat :

1. ⛔ **`Input.dispatchMouseEvent` vise le PIXEL, pas l'écouteur.** Au centre de
   la vue, ce pixel porte un bouton d'interface (`document.elementFromPoint(640,
   400)` rend `BUTTON.ce-wm-btn`) et `modes.js` écoute sur `renderer.domElement`.
   **120 crans, zéro mouvement.** Le banc dispatche donc sur le canvas.
2. ⛔ **L'écran d'accueil recouvre tout, et il porte un `backdrop-filter`.** Les
   premières captures rendaient **215 de luminance moyenne** pour un écran
   d'accueil flouté. Le banc appuie sur Échap et **vérifie** que le centre de la
   vue est bien le canvas.
3. ⛔ **L'application DÉMARRE en surface à ~12,5 km**, c'est-à-dire *déjà* sous la
   naissance du crop. Une descente qui part de là ne traverse rien : la première
   version de la sonde de claquement a mesuré **5 842 m** en croyant en mesurer
   32 000. Les deux sondes repassent par l'orbite avant de descendre.
4. ⛔ **« CHROME SANS TÊTE TOURNE EN SWIFTSHADER » — FAUX, et c'est le piège qui a
   coûté le plus cher** (tour de correction). Le banc écrit maintenant le pilote
   WebGL dans chaque trace : on ne le suppose plus.

⚠️ **SUR LA MÉTHODE DE CHRONOMÉTRAGE, ET LA MISE EN GARDE VENUE DE R6** — « `gl.finish()`
ne barre pas la route sous ANGLE/D3D11, c'est `readPixels(1×1)` qui synchronise ».
**Elle ne touche pas ce banc, et je le dis pour qu'on n'y revienne pas** :
`sonde-descente.mjs` n'appelle **ni `gl.finish` ni `readPixels`**. Ses durées
d'image sont des horodatages `performance.now()` pris dans une boucle
`requestAnimationFrame`, et la grandeur de C1 — **le pas d'inclinaison** — est lue
sur l'état de la caméra, pas sur une horloge GPU. Aucun chiffre de C1 ne dépend
d'une synchronisation de pilote.

⚠️ **CE QUE CE BANC-LÀ NE SAIT PAS FAIRE, EN REVANCHE** : sa sonde vit dans SA
propre `requestAnimationFrame`, distincte de celle du rendu. Selon l'ordre
d'appel, un échantillon peut tomber avant ou après la boucle de rendu de la même
image — d'où, dans les traces, quelques couples aberrants (un pas de 3,64° sur
« 8 ms »). **Les ANGLES sont justes ; les MILLISECONDES par image sont à ±1
image.** C'est sans effet sur le pas de pointe, qui ne dépend que des angles.

**Étape 7 du brief — le segment jamais vérifié.** Les deux relevés (avant et
après) partent de **`MAX_ALT_M` = 60 000 km**, pas de 1 600 km. Le segment
au-dessus de 1 600 km ne contient **aucun** événement : `mode` reste `orbital`,
l'inclinaison vaut 0,000° et rien ne bascule jusqu'à la porte de plongée
géométrique, à ~6 000 km. **Le trou est comblé, et il était vide.**

---

## 3. LA PREMIÈRE RÉPARATION — LA CIBLE CHANGEAIT DE REPÈRE TOUTE SEULE

C'est **la sixième fois sur ce chantier** qu'une grandeur juste est exprimée dans
le mauvais repère, et le brief le pressentait.

`_rescale`, régime continu, écrivait :

```js
this.controls.target.copy(arrival.target)   // la visée du NOUVEAU bloc
if (continu) { this._suivreEmprise(); ... } // qui relit la direction… sur quoi ?
```

`_suivreEmprise` calculait ensuite `direction = caméra − cible`. **La caméra était
encore dans le repère du bloc quitté, la cible déjà dans celui du bloc chargé.**
La pente qu'il promettait de conserver était déjà fausse au moment où il la lisait.

Le relevé, images 651 → 652 :

| image | caméra | cible | inclinaison |
|---|---|---|---|
| 651 | (−2,229 ; 23,821 ; 25,157) | (−2,229 ; −0,156 ; −0,153) | 46,548° |
| 652 | (−8,418 ; 44,628 ; 38,989) | (4,814 ; −0,297 ; **8,949**) | **36,154°** |

**La cible saute de 9,1 unités en z, en une image** — ce qui est normal : le bloc
d'après a sa propre origine et `_cibleVisee` rend le même point géographique dans
le nouveau repère.

**La réparation :** `poseFranchissement` (`src/monde/zoom-continu.js`, §4 bis) —
module pur, testé sous node. **Elle prend les DEUX cibles**, donc l'erreur n'est
plus *écrivable* : ce n'est plus un commentaire qui l'interdit. `_suivreEmprise`
reçoit un argument `cibleAvant`, et `_rescale` le lit **une ligne avant** de
réécrire la cible.

⚠️ **`prevDir` ne pouvait pas servir**, bien qu'il existât déjà juste au-dessus :
il est lu **avant** le chargement, or sous le drapeau le glissé inertiel continue
de courir pendant tout l'`await` (`_applyZoom` ignore `busy` — Tâche M). Sa
direction est celle d'il y a quelques images.

⚠️ **Deux gardes ajoutées, chacune pour un cas mesuré** : avec `cibleAvant`, on
repose **même à emprise égale** (le suiveur par image a pu convertir pendant
l'`await`, et sortir laisserait la caméra ancrée sur une cible qui n'existe
plus) ; et sans emprise mémorisée on **ré-ancre sans convertir** au lieu de ne
rien faire.

**Résultat mesuré : ONZE franchissements, de z3 à z14, plus grand écart
d'inclinaison 0,000°.** L'angle de vue vaut **46,548° et rien d'autre** sur toute
la descente, contre une dérive de 19,5° avant.

⚠️ **CE RÉSULTAT ÉTAIT ANNONCÉ « dix franchissements, 0,0215° » ; les deux
chiffres étaient trop prudents (constat I4).** Il y a **onze** franchissements de
part et d'autre, recomptés sur les traces ; et le `0,0215°` venait d'une fenêtre
qui commençait une image trop tôt — **à lecture stricte, l'inclinaison ne prend
plus qu'une seule valeur**, 46,548157698978°, de la fin du balayage au sol.

---

## 4. LA SECONDE — LA PLONGÉE ARRIVE AU NADIR, PUIS BALAIE

⚠️ **Ce n'est PAS un bogue de repère, et c'est pourquoi je n'ai pas « corrigé »
la pose.** La vue de trois quarts (`PENTE_ARRIVEE = {y: 18, z: 19}`) **est** le
produit. Le défaut n'est pas la pose d'arrivée, c'est qu'on y arrive en une image.

La plongée arrive désormais **au nadir** — la pose exacte que l'orbite quittait —
puis l'inclinaison balaie jusqu'à l'oblique. C'est la transition qu'Adrien
accepte, à la place du claquement qu'il refuse.

⚠️ **L'ALTITUDE NE BOUGE PAS D'UN MÈTRE PENDANT LE BALAYAGE**, sans quoi je
rouvrais le défaut de la Tâche M par l'autre bout. `poseFonduArrivee`
(`zoom-continu.js`, §4 ter) interpole **l'ANGLE**, à `camera.position.y`
constant — or `altitudeFondM = camY × emprise / span`. Un test rejoue 41 points
du balayage et refuse le moindre écart de `camY`.

⚠️ **Et `camY` se relit à chaque image, pas une fois à l'armement** : le glissé
inertiel court pendant le balayage. Le figer aurait annulé la molette de
l'utilisateur pendant une seconde entière — donc rendu la main avec un saut.

**La durée se dérive d'un budget par image, elle ne se choisit pas.** Avec la
quadratique adoucie aux deux bouts, la vitesse de pointe vaut le double de la
moyenne : `2 × 46,54816 / (durée × 60)` degrés par image à 60 Hz. **1,1 s** est
la plus courte qui tienne le pas de pointe sous 1,5°.

### ⛔ LE CONSTAT C1 — ET C'ÉTAIT UN DÉFAUT, PAS UNE FORMULATION

**La première version enchaînait ces deux phrases :**

> « 1,1 s est la plus courte qui tienne le pas de pointe **sous 1,5°** »
> « le pire cas est BORNÉ quel que soit le débit d'images […] soit **4,23°** au pire »

⛔ **Les deux ne peuvent pas être vraies en même temps.** 4,23° n'est pas « sous
1,5° », c'est trois fois plus. Le plafond `Math.min(dtBrut, 0,05)` de `main.js`
bornait le pas de TEMPS ; il ne bornait pas ce qu'Adrien regarde, qui est un
ANGLE. Et la réserve 3 annonçait par-dessus **« 0,97°/image sur son GPU »** —
**un chiffre qui n'était dérivable de rien** : la table du rapport lui-même donne
1,41° à 60 Hz, la simulation exacte de la courbe 1,389°, et 0,97° demanderait
87 Hz.

**Trois choses vérifiées par moi, dans cet ordre.**

**① La prémisse était fausse.** « Chrome sans tête tourne en SwiftShader » — non.
`WEBGL_debug_renderer_info`, relu par moi dans les deux configurations, rend la
**RTX 3080 des deux côtés** (`.banc/R4/r4c-pilote-sanstete.json`, et le champ
`gpu` que la sonde écrit désormais dans chaque trace).
`--enable-unsafe-swiftshader` **autorise** le repli logiciel, il ne l'impose pas.
**Le banc mesurait déjà le vrai GPU.**

**② La mesure, en Chrome VISIBLE, sur la machine d'Adrien.** La sonde porte
maintenant `--visible 1` :

| `.banc/R4/r4c-gpu-avant.json` | valeur |
|---|---|
| pilote | ANGLE (NVIDIA GeForce RTX 3080, D3D11) |
| balayage | 34 images / 1 974 ms |
| **pas de pointe** | **4,135°** sur une image de 95 ms |
| **pas > 3°** | **6** |
| pas > 1,5° | 13 |

**Ce n'est pas un artefact de banc : c'est ce que voit Adrien.** La plongée est
exactement le moment où l'application charge la surface — les images de 90, 160,
195 et 225 ms n'y sont pas un accident, elles y sont la règle.

**③ La correction : on borne l'ANGLE, pas le temps.** `avancerFonduPose`
(`zoom-continu.js`, §4 quater) plafonne le pas d'inclinaison à
**`PAS_POSE_MAX_DEG = 1,5°`** — **exactement le budget dont `DUREE_FONDU_POSE_S`
était dérivée**, promu de vœu à invariant. L'inclinaison balayée vaut
`46,54816° × e` (le §4 ter interpole l'élévation linéairement en `e`), donc
plafonner est **exact, pas approché** ; et quand le plafond mord, `t` est
**remonté par la réciproque de la courbe** au lieu d'être laissé courir — sans
quoi l'image suivante rattraperait le retard d'un coup.

**La même descente, rejouée après correction** (`.banc/R4/r4c-gpu-apres.json`) :

| | avant | après |
|---|---|---|
| pas de pointe | **4,135°** | **1,500°** — le plafond, atteint |
| pas > 3° | **6** | **0** |
| pas > 2° | 11 | **0** |
| balayage | 34 img / 1 974 ms | 54 img / **1 912 ms** |

⚡ **ET L'ÉTIREMENT REDOUTÉ N'A PAS EU LIEU** : le balayage prend **1 912 ms au
lieu de 1 974**. Le plafond n'allonge pas le mouvement, il **redistribue** les
degrés que les images longues avalaient d'un coup. Sur une machine beaucoup plus
lente il s'étirerait — la simulation sur la suite de `dt` relevée donne
**2 371 ms au lieu de 2 082**, +14 % — et c'est le prix assumé : **le seul
comportement qui tienne « la caméra ne claque jamais » sans mentir.** Le test
⑫ bis grave la borne haute à 3 s.

⚠️ **ET LE GARDE-FOU DE TEST NE POUVAIT PAS ÉCHOUER.** `assert.ok(plusGrandPas <
3)` était alimenté par le `dt` **parfait de 1/60** du banc `machine()`, où la
courbe donne 1,41° : aucune bêtise n'aurait pu le faire rougir. Trois tests neufs
le remplacent, tous alimentés par la **suite de `dt` relevée au navigateur**, y
compris un test de MUTATION qui rejoue la loi d'avant et **exige** qu'elle
franchisse 4° et six pas de 3° (§9).

⚠️ **`main.js` N'EST PAS TOUCHÉ.** L'écrêtage `Math.min(dtBrut, 0,05)` reste
exactement où il est et tel qu'il est ; le plafond angulaire vit dans
`modes.js` + `zoom-continu.js`. **Aucune ligne de `src/main.js` n'a été modifiée
par R4, ni au premier tour ni à celui-ci** — R7 peut fusionner sans arbitrage.

⚠️ **`_franchirSiBesoin` est gardé contre le balayage.** Un franchissement lancé
pendant lui écrirait une nouvelle cible et se battrait pour la même caméra. Le
compteur de budget, lui, traverse : le niveau se franchit à l'image suivante,
sans rien perdre. **Cette garde est désormais testée par le comportement** (§9).

---

## 5. ⛔ CE QUI RESTE ENTIER : LE CLAQUEMENT DE CONTENU

**Je n'ai pas fondu la naissance du crop.** Le §1 ③ disait au premier tour que le
fondu assigné par le recadrage « n'aurait rien racheté » ; **remesuré grain gelé,
c'est trop fort** — les parois pèsent trois à treize fois le plancher, et **le
FOND du crop, qui est de la géométrie lui aussi, pèse huit fois les parois**.
L'état est donc, sans détour :

- `uCropOn` vaut toujours **0 ou 1** (`globe.js:3027` et `3187`). Aucun fondu.
- Le canevas passe de **173 à 94** de luminance en une image, à 32,3 km.
- `poserTout` / `retirer` (`branchement-crop.js`) montent et démontent la chaîne
  entière d'un coup.

**Ce que la mesure dit du fondu croisé, la « piste évidente » du brief.** Le
mécanisme existe **déjà à moitié** et personne ne l'avait dit : `uEstompage` est
un paramètre **continu** (`estompage-terre.js`), la couverture de tuile vaut
`mix(1.0, dedans, estompeTuile)` (`globe.js:1496`) et l'alpha du fragment la
porte (`globe.js:2073`). Relevé pendant la descente : l'estompage vaut **0,22 à
la naissance du crop** et monte jusqu'à 1. **Le dehors se fond déjà ; c'est le
DEDANS qui surgit.**

⚠️ **MAIS CE PARAMÈTRE CONTINU EST DERRIÈRE UNE PORTE BINAIRE, ET R6 DOIT LE
SAVOIR (constat m8, repris tel quel de la relecture) :**

    float estompeTuile = uEstompageOn > 0.5 ? uEstompage : 1.0;   // globe.js:1492

`uEstompageOn` vaut 0 par défaut, passe à 1 par `poserEstompage`
(`globe.js:3222`) et retombe à 0 par `retirerEstompage` (`globe.js:3274`) — donc
**un interrupteur 0/1 de la même famille que `uCropOn`**. Le cadeau est réel, la
porte aussi.

⛔ **Et le dedans ne peut pas se fondre sans réécrire le nuanceur des tuiles.**
`uCropOn` n'est pas un gain, c'est une porte : `if (uCropOn > 0.5)`
(`globe.js:1421`), `surLeFond` (`globe.js:1301`), et six interrupteurs frères
(`uHabOn`, `uEclairageOn`, `uMerRampeOn`, `uRampCropOn`, `uAnalysisOn`,
`uNormaleFineOn`) que la chaîne allume ensemble. Un fondu croisé demanderait
d'évaluer **les deux apparences par fragment** et de les mélanger, sur un
nuanceur **partagé par toutes les tuiles du globe** — donc un coût de rendu, sur
lequel `rapport-R2.md` a établi la méthode et D15 la pose déjà comme la vraie
question. **Ce n'est pas une étape, c'est une tâche.**

➡️ **Et D15 la rend en partie sans objet** : si la planète cesse d'être nue, les
deux images à raccorder se ressemblent, et il restera à fondre bien moins.
**Je n'ai écrit aucune ligne de fondu de style** — rien à défaire côté R6.

---

## 6. RÉSERVES

1. ⚠️ **Le balayage de la plongée dure ~1,9 s MESURÉES sur la machine d'Adrien,
   pendant lesquelles la caméra tient la main.** C'est un choix de produit que je
   n'ai pas fait valider : Adrien accepte « une transition », il n'a pas dit
   *laquelle*. **Ce qu'il verra, chiffré : 1 912 ms, pas de pointe 1,500°, aucun
   pas au-dessus de 2°** (`.banc/R4/r4c-gpu-apres.json`). Deux constantes nommées
   le gouvernent, chacune avec sa dérivation : `DUREE_FONDU_POSE_S = 1,1` et
   `PAS_POSE_MAX_DEG = 1,5`. Les changer coûte une ligne chacune.
   ⚠️ **La question à poser à Adrien dans ces termes-là** : « une seconde neuf de
   caméra pilotée, à 1,5° par image au pire » — pas « une transition ».
2. ⚠️ **Le balayage part du nadir, donc la première seconde après une plongée
   montre la carte à plat.** À 6 000 km c'est un globe vu du dessus, ce qui est
   exactement la continuité voulue ; à basse altitude (plongée par clic sur un
   palier fin) c'est une vue de dessus du bloc pendant une seconde. **Non jugé à
   l'œil par Adrien.** Une garde exclut le cas où l'aplomb passerait sous
   `minDistance`.
3. ⛔ **RÉSERVE RETIRÉE — ELLE ÉTAIT FAUSSE DE BOUT EN BOUT (constat C1).** Elle
   disait : « Chrome sans tête tourne en SwiftShader […] le `4,12°` est le
   plafond structurel de `dt`, pas ce que verra Adrien — où la loi donne
   **0,97°/image**. Non mesuré sur GPU réel. » **La prémisse est fausse** (le
   banc était déjà sur la RTX 3080, vérifié), **le 0,97° n'était dérivable de
   rien**, et **la mesure sur GPU réel donne 4,135° avec six pas au-dessus de
   3°**. Ce n'était pas une réserve, c'était un défaut : il est **corrigé** au
   §4, et remesuré à **1,500°**. Ce qui subsiste comme réserve honnête tient en
   une ligne : **le plafond angulaire n'a été mesuré que sur UNE machine, une
   RTX 3080 sous Windows**, et sur une machine beaucoup plus lente le balayage
   s'étirerait (simulé : +14 %, borné à 3 s par le test ⑫ bis, **non mesuré sur
   petite machine**).
4. ⚠️ **Le claquement de contenu est intact** (§5), et c'est la moitié du titre de
   la tâche. Adrien le reverra.
5. ⚠️ **Les écarts par pixel du §1 ③ dépendent du RÉGIME D'ANIMATION, et c'est
   la leçon de méthode de ce tour.** Grain animé — le régime d'Adrien — le
   plancher vaut **9,2** et **rien de géométrique ne s'en détache**. Grain gelé,
   il tombe à **0,13–0,47** et la hiérarchie apparaît : parois 1,6–1,8, fond du
   crop 13,5–14,0, style 25,6–25,8. **Les deux planchers se publient ensemble** :
   l'un dit ce qu'on voit, l'autre ce qui est là. ⚠️ **Plusieurs bancs de ce
   chantier ont comparé des captures grain allumé sans le savoir.**
6. ⚠️ **`.banc/` est ignoré par git.** Les traces et les captures citées ici sont
   **sur disque seulement**. Les deux sondes, elles, sont dans `scripts/` et
   commitées — précisément pour ne pas les reperdre.
7. ⚠️ **L'éclairage n'a pas été touché** (R7), ni le relief absent de z6 à z10
   (R6), ni `DETAIL_DEFAULTS`. **Mon fondu ne croise pas les deux éclairages** :
   je n'ai pas construit de fondu de style.

---

## 7. FICHIERS

| fichier | ce qui change |
|---|---|
| `src/monde/zoom-continu.js` | **+3 lois pures** : `poseFranchissement` (§4 bis), `poseFonduArrivee` (§4 ter), **`avancerFonduPose` + `adoucir` / `adoucirInverse` (§4 quater, tour de correction)** |
| `src/modes.js` | `_suivreEmprise(cibleAvant)`, `_rescale` lui passe l'ancienne cible, `_armerFonduPose` / `_avancerFonduPose`, `DUREE_FONDU_POSE_S`, garde de `_franchirSiBesoin` · **tour de correction : `PAS_POSE_MAX_DEG`, `angleTotalDeg` posé à l'armement, `update` passe par la loi** |
| `test/zoom-continu.test.js` | section ⑪, 7 tests · **tour de correction : section ⑫ + ⑫ bis, 12 tests neufs de comportement ; 3 assertions de texte source RETIRÉES ; 2 tolérances resserrées** |
| `scripts/sonde-descente.mjs` | la descente image par image · **tour de correction : `--visible`, et le pilote WebGL écrit dans la trace** |
| `scripts/lit-sonde-descente.mjs` | le lecteur de trace |
| `scripts/sonde-claquement.mjs` | la décomposition du claquement · **tour de correction : `--anim 0`, un 3ᵉ témoin, et le TABLEAU calculé dans le script (il ne l'était pas)** |

⛔ **`src/main.js` : AUCUNE LIGNE TOUCHÉE**, ni au premier tour ni à celui-ci —
vérifiable par `git diff d366a40 HEAD -- src/main.js`, qui est vide. La tâche R7
peut fusionner son éclairage sans arbitrage avec R4. ⛔ **`src/globe.js` : aucune
ligne touchée non plus** — les sept interrupteurs de style et le nuanceur du globe
sont intacts, ils appartiennent à R6.

**Les tests qui mordent sur le branchement, pas sur le texte :**

- ⑪ *la pose de franchissement garde l'inclinaison, quel que soit le saut de
  cible* — rejoue le relevé du navigateur.
- ⑪ *MUTATION — lire la direction sur la cible D'APRÈS rouvre le saut de 10°* —
  **sans elle, l'assertion précédente serait une tautologie.**
- ⑪ *BRANCHEMENT — un franchissement ne tourne PAS la caméra, **visée mobile
  comprise*** — ⚠️ **la visée mobile est tout le test.** Le banc de `machine()`
  n'avait pas de crochet `viseeDuLieu` : la cible restait à l'origine d'un niveau
  au suivant, et le défaut était **structurellement invisible**. C'est pour ça
  qu'il a survécu à `npm test` jusqu'ici. Ce test échoue à **−8,329°** sur le code
  d'avant.
- ⑪ *BRANCHEMENT — la plongée arrive AU NADIR puis balaie* — vérifie
  l'inclinaison de départ, l'inclinaison d'arrivée, **l'altitude de fond à chaque
  image** et le plus grand pas. ⚠️ **Son seuil descend de 3° à 1,5°** au tour de
  correction — mais il reste alimenté par un `dt` parfait, donc il ne peut pas
  garder grand-chose : c'est ⑫ bis qui garde.
- ⑪ *DRAPEAU BAISSÉ — la plongée pose la vue oblique tout de suite, comme avant* —
  grave **46,46°**, le relevé du dépôt d'avant R4. ⚠️ Ce n'est pas 46,54816° et ce
  n'est pas une tolérance molle : hors drapeau `_posePlongee` rend une position
  **absolue**, et les 0,3 unité de `Y_CIBLE` valent exactement les 0,09° d'écart.

**Et les trois du tour de correction, qui rejouent le `dt` DU NAVIGATEUR :**

- ⑫ bis *MUTATION — sans le plafond, le `dt` relevé rouvre 4° et six pas au-dessus
  de 3°* — **sans elle, les deux suivantes seraient des tautologies.** Elle rejoue
  la loi du premier jet au caractère près, sur la suite de 40 durées d'image
  relevée dans `.banc/R4/r4c-gpu-avant.json`, et **exige** le défaut.
- ⑫ bis *le plafond tient sur le `dt` relevé, et le balayage s'étire au lieu de
  sauter* — pointe ≤ 1,5°, et l'étirement **borné à 3 s**.
- ⑫ bis *BRANCHEMENT — la plongée rejouée sur le `dt` relevé ne franchit plus le
  plafond* — la vraie machinerie (`Modes.update`), le `dt` du navigateur, et une
  assertion de plus : **que le plafond ait effectivement MORDU** sur cette
  suite-là, sans quoi le test repasserait tout seul si on le retirait.

---

## 8. ÉTAT DES NEUF ÉTAPES DU BRIEF

| étape | état |
|---|---|
| 1 — reproduis et filme | ✅ `scripts/sonde-descente.mjs`, traces et captures dans `.banc/R4/` |
| 2 — chiffre le saut | ✅ §1 ① : image 346, **46,548°** ; **onze** franchissements de **0,970° à 10,394°** (recomptés au tour de correction) |
| 3 — trouve la surcouche sombre | ⛔ **elle n'existe pas** — §1 ②, avec témoin positif |
| 4 — test rouge sur la continuité du contenu | ⚠️ **rouge sur la continuité de la POSE**, pas du contenu — le contenu n'est pas corrigé (§5) |
| 5 — le fondu | ⛔ **non fait** — et le « pourquoi » du premier tour est **corrigé** : la géométrie n'est pas soldée (§1 ③) |
| 6 — la pose de caméra | ✅ les deux causes, fermées et mesurées |
| 7 — le segment jamais mesuré | ✅ les deux relevés partent de `MAX_ALT_M` ; il est vide |
| 8 — mesure après, même instrument | ✅ §0, et comparaison aux 39 images au §1 |
| 9 — clôture drapeau levé ET baissé | ✅ rejouée au tour de correction (`r4c-prod-apres`) : production inchangée, 0 erreur |

---

## 9. ⛔ LES NEUF MUTATIONS SURVIVANTES — CE QU'ELLES SONT DEVENUES

**Le constat I2 était le plus dur à entendre, et il était juste.** Neuf mutations
sur vingt-six survivaient aux 4 202 tests, **et quatre d'entre elles étaient
exactement les gardes que ce rapport défendait le plus longuement**. Un
successeur pouvait les juger inutiles, les retirer, et laisser la suite verte.

⚠️ **UNE ASSERTION QUI LIT LE TEXTE SOURCE NE PROUVE RIEN**, et ce fichier en
portait la démonstration : une mutation a survécu à 4 082 tests pour cette raison
exacte. **Les douze tests neufs sont donc tous des tests de COMPORTEMENT.** Aucun
ne lit `SRC_MODES`.

**Campagne rejouée par moi, mutation par mutation, contre `test/zoom-continu.test.js` :**

| mutation | ce qu'elle défait | verdict |
|---|---|---|
| **Z5** `const d = brute` | la distance n'est plus écrêtée | ⚰️ **TUÉE** — ⑫ GARDE Z5 |
| **Z6** garde `penteMin` retirée | la visée rasante n'est plus refusée | ⚰️ **TUÉE** — ⑫ GARDE Z6 |
| **Z13** `const e = avancement` | l'avancement n'est plus borné à [0,1] | ⚰️ **TUÉE** — ⑫ GARDE Z13 |
| **M4** `\|\| this._fonduPose` retiré | un franchissement se lance pendant le balayage | ⚰️ **TUÉE** — ⑫ GARDE M4 |
| **M5** `if (avant === emprise) return` | on ne repose plus à emprise égale | ⚰️ **TUÉE** — ⑫ GARDE M5 |
| **M9** courbe adoucie → linéaire | le facteur de pointe ×2 dont la durée est dérivée | ⚰️ **TUÉE** — ⑫ GARDE M9 |
| **M11** garde `minDistance × 1,05` | une arrivée trop basse s'arme quand même | ⚰️ **TUÉE** — ⑫ GARDE M11 |
| **M7** `empriseAvant: avant` | — | ✅ **MUTANT ÉQUIVALENT** (démonstration ci-dessous) |
| **M10** garde `direction.y > 1e-3` | — | ✅ **MUTANT ÉQUIVALENT** (démonstration ci-dessous) |

Et, ajoutées par ce tour, les deux mutations du plafond :

| mutation | verdict |
|---|---|
| `pasMaxDeg: PAS_POSE_MAX_DEG` → `Infinity` | ⚰️ **TUÉE** — ⑫ bis BRANCHEMENT |
| le plafond neutralisé dans la loi elle-même | ⚰️ **TUÉE** — ⑫ bis, deux tests |

### ⚠️ LES DEUX ÉQUIVALENTS, ET POURQUOI CE N'EST PAS UNE ESQUIVE

⛔ **Je ne dis pas « c'est équivalent » parce que je n'ai pas trouvé de test. Je
le dis parce que le chemin de code le prouve, et je l'ai vérifié en rejouant la
mutation.**

**M7 — `empriseAvant: avant > 0 ? avant : emprise` → `empriseAvant: avant`.**
La valeur part dans `camYApresNiveau`, qui commence par :

    if (!Number.isFinite(camY) || !(empriseAvant > 0) || !(empriseApres > 0)) return camY

`_empriseVue` ne vaut jamais qu'`null` ou un nombre strictement positif. Donc :
quand `avant > 0`, les deux écritures passent `avant` ; quand `avant` est `null`,
l'une passe `null` — et la garde rend `camY` **inchangée** — tandis que l'autre
passe `emprise`, et `camY × emprise / emprise` vaut **camY inchangée**. **Les deux
branches rendent le même nombre, dans tous les cas.** Le ternaire est une
redondance défensive, déjà garantie par la garde de `camYApresNiveau`.

⚠️ **Ce qui n'est PAS équivalent, en revanche, c'est la moitié qui compte** : la
sortie anticipée `if (!(avant > 0)) return`. Celle-là est une vraie mutation, et
elle est **tuée** par ⑫ GARDE M7 *et* par ⑪ BRANCHEMENT.

**M10 — garde `direction.y > 1e-3` de `_armerFonduPose`.**
`direction` est **normalisée** juste au-dessus, et `poseFonduArrivee` porte la
garde jumelle `sinFin > penteMin` avec `penteMin = 1e-3` sur **la même grandeur
normalisée**. `_armerFonduPose` finit par `this._avancerFonduPose(0)`, qui
rend `null` et remet `_fonduPose` à `null` sans toucher à la caméra. **Le
balayage s'arme puis se désarme dans le même appel : rien d'observable ne
change.**

➡️ **Les deux gardes restent en place** — elles disent l'intention à l'endroit où
on la lit — et **les deux ont quand même un test** (⑫ GARDE M7, ⑫ GARDE M10). Ces
tests épinglent le CONTRAT, qui, lui, cesserait d'être tenu si la garde jumelle
de l'autre fonction bougeait.

### m7 — LES TROIS ASSERTIONS DE TEXTE SOURCE

Retirées de la section ⑥ : la signature `_suivreEmprise(cibleAvant = null) {`, la
mention de `poseFranchissement` dans son corps, et la forme exacte de l'appel
dans `_rescale`. **Ce qu'elles prétendaient couvrir est couvert par le
comportement** (⑫ GARDE M5, ⑫ GARDE M7, ⑪ BRANCHEMENT). Ce qui reste de texte
source en ⑥ est un **ordre d'appel** entre trois lecteurs de `main.js` — une
contrainte de séquence qu'aucune valeur ne porte, donc le seul endroit où lire la
source est légitime.

---

## 10. LES COMMITS DU TOUR DE CORRECTION

| commit | constat | fichiers |
|---|---|---|
| **`e6e34d3`** | **m5** — `46,551°` était faux, la valeur exacte est `46,548157698978°` | `modes.js`, `zoom-continu.js`, `zoom-continu.test.js` |
| **`e18a8f5`** | **C1** — le pas de pointe valait 4,135° sur le GPU d'Adrien | `modes.js`, `zoom-continu.js`, `sonde-descente.mjs` |
| **`5465a0f`** | **I2 + m7** — les gardes n'avaient aucun test ; les assertions de texte source retirées | `zoom-continu.test.js` |
| **`d5add61`** | **I3 + m6** — le banc mesurait son propre bruit ; la géométrie n'est pas soldée | `sonde-claquement.mjs` |

**Chaque commit intermédiaire a été vérifié vert séparément**
(`git checkout <sha> && node --test test/zoom-continu.test.js`) : 46, 46, 58, 58
tests, 0 échec.

⚠️ **DEUX CONSTATS N'ONT PAS DE COMMIT, ET C'EST NORMAL** : **I4** (les comptes de
franchissements) et **m9** (la formulation des 79 niveaux) ne vivent que dans ce
rapport — et `.superpowers/sdd/` est **ignoré par git** sur ce chantier, comme
tous les rapports qui l'ont précédé. Ils sont sur disque, pas dans un commit.

⚠️ **ET DEUX CORRECTIONS DE m5 SONT PARTIES AVEC C1 PLUTÔT QU'AVEC m5** : le
`46,551°` du bloc de dérivation de `DUREE_FONDU_POSE_S` et la tolérance du test
de branchement sont **dans les blocs que C1 réécrit entièrement**. Les séparer
aurait demandé de découper une ligne en deux. Le commit `e6e34d3` le dit.

⚠️ **CE QUE JE N'AI PAS TOUCHÉ, ET QUI APPARTIENT À D'AUTRES** : `src/main.js`
(zéro ligne — R7), `src/globe.js` et ses sept interrupteurs de style (zéro ligne
— R6), le fondu de contenu (R6, `regle-D15.md`).
