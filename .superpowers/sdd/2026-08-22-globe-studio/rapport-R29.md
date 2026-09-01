# R29 — SORTIR DU CROP À LA MOLETTE : CE QUI BLOQUAIT N'ÉTAIT NI LA BUTÉE NI LE COMPTEUR

Arbre `C:\Dev\wt-sor`, branche `sortie-crop`. Serveur `npm run dev --port 5841`
(arrêté à la fin). Instrument : `scripts/sonde-sortie-r29.mjs`, Chrome sans tête
1280 × 800, relevé **DANS la boucle** (`controls.update` enveloppé). Sorties dans
`.banc/R29/` — dix-neuf fichiers, `avant-*` et `apres-*` sous le MÊME protocole.

**Le défaut est réel, il est reproduit, et il n'est à aucun des trois endroits
que le brief soupçonnait.** Il est dans le **balayage de retour au nadir de
D16 ter** : il bloque `_franchirSiBesoin` pendant 130 images, le compteur y
encaisse jusqu'à **treize niveaux**, et `_levelZoom = reste` en jetait **douze**.

---

## ① EN QUOI MON BANC DIFFÈRE DU GESTE RÉEL — chaque chiffre en dépend

Ce dépôt a vu trois audits rendre trois plafonds différents parce que leurs bancs
différaient sans le dire. Voici le mien, en entier.

| | R23 | R27 | **R29** |
|---|---|---|---|
| ce qui pousse le dézoom | API de l'appli | `modes.cranZoom(-1)` | **`Input.dispatchMouseEvent` type `mouseWheel`, `deltaY = +100`** et **`modes.stepWider()`** (le bouton « − », `ui/zoom-stepper.js`) |
| attente entre deux crans | glissé libre | `wait(8)` + attente de `busy` | **paramétrée** : `--rafale` (4 images ≈ 66 ms, le défilement continu) · `--cadence N` pour le bouton · sinon extinction complète du glissé |
| voile d'accueil | levé | levé | **retiré du DOM** (`.ce-hubveil`), plus Échap |
| pose de départ | pente d'arrivée **et** couchée | pente d'arrivée | **les deux, mesurées** : φ = 46,55° et φ = 88,2° (glissé réel, bouton tenu) |
| descente jusqu'au bloc | API | `cranZoom(1)` | API **ou** `--descente-molette` (178 crans de molette réels) |

⚠️ **TROIS DIFFÉRENCES DE BANC CHANGENT LE RÉSULTAT, ET ELLES SONT MESURÉES :**

1. **La CADENCE décide de tout.** Le même geste, même correctif, même parcours :
   un clic par image → 47 clics jusqu'à l'orbite ; un clic par 100 ms → 18 ;
   un clic par 330 ms → 17. Un banc qui ne publie pas sa cadence ne dit rien.
2. **Huit `cranZoom(-1)` appelés d'affilée en synchrone en perdent sept** —
   `cranZoom` sortait sur `busy`, et un `_rescale` dure des centaines de
   millisecondes. C'est le fait ① du brief, et c'est un vrai défaut du bouton,
   pas seulement un artefact de banc : je l'ai corrigé.
3. **La pose de départ change l'altitude d'un facteur 26,6**, pas le nombre de
   crans (§⑤).

---

## ② LA TABLE — DU BLOC À L'ORBITE, À LA MOLETTE RÉELLE

`.banc/R29/apres-rafale.json` · défilement continu, un événement de molette
toutes les 4 images · pose de départ : la pente d'arrivée, φ = 46,55° ·
`maxDistance = 150`, `SEUIL_MORT_M = 40 342,8 m`.

Les premiers crans un par un, puis les deux repères qui comptent (la mort du
crop au 39, le premier niveau franchi au 48), puis un cran sur vingt. La table
complète des 179 crans est dans le fichier de banc.

| cran | `d` | altitude (m) | emprise (m) | crop | mode | zoom | `_levelZoom` |
|---|---|---|---|---|---|---|---|
| 0 | 47,93 | 14 917 | 51 152 | **oui** | surface | z11 | -0,3466 |
| 1 | 48,04 | 14 951 | 51 152 | **oui** | surface | z11 | -0,3442 |
| 2 | 48,30 | 15 029 | 51 152 | **oui** | surface | z11 | -0,3389 |
| 3 | 48,69 | 15 148 | 51 152 | **oui** | surface | z11 | -0,3308 |
| 4 | 49,21 | 15 306 | 51 152 | **oui** | surface | z11 | -0,3202 |
| 5 | 49,84 | 15 498 | 51 152 | **oui** | surface | z11 | -0,3074 |
| 6 | 50,59 | 15 725 | 51 152 | **oui** | surface | z11 | -0,2925 |
| 7 | 51,44 | 15 984 | 51 152 | **oui** | surface | z11 | -0,2758 |
| 8 | 52,40 | 16 275 | 51 152 | **oui** | surface | z11 | -0,2574 |
| 10 | 54,61 | 16 945 | 51 152 | **oui** | surface | z11 | -0,2161 |
| 15 | 61,77 | 19 120 | 51 152 | **oui** | surface | z11 | -0,0928 |
| 20 | 70,76 | 21 849 | 51 152 | **oui** | surface | z11 | 0,0431 |
| 25 | 82,96 | 25 552 | 51 152 | **oui** | surface | z11 | 0,2021 |
| 30 | 96,63 | 29 702 | 51 152 | **oui** | surface | z11 | 0,3547 |
| 35 | 114,80 | 35 219 | 51 152 | **oui** | surface | z11 | 0,5270 |
| 38 | 127,36 | 39 031 | 51 152 | **oui** | surface | z11 | 0,6308 |
| **39** | 131,85 | **40 394** | 51 152 | **non** | surface | z11 | 0,6654 |
| 40 | 132,88 | 42 406 | 51 152 | non | surface | z11 | 0,7145 |
| **48** | 61,89 | 56 242 | **102 306** | non | surface | **z10** | 0,3060 |
| 60 | 49,09 | 88 745 | 204 610 | non | surface | z9 | 0,0863 |
| 80 | 47,01 | 170 611 | 409 834 | non | surface | z8 | 0,0641 |
| 100 | 49,01 | 357 193 | 822 116 | non | surface | z7 | 0,1117 |
| 120 | 49,36 | 723 740 | 1 653 923 | non | surface | z6 | 0,1265 |
| 140 | 49,93 | 1 447 117 | 3 268 817 | non | surface | z5 | 0,1268 |
| 160 | 48,93 | 2 902 824 | 6 691 558 | non | surface | z4 | 0,1301 |
| 170 | 65,84 | 3 906 015 | 6 691 558 | non | surface | z4 | 0,4270 |
| **179** | 266,52 | — | 6 691 558 | non | **orbital** | z4 | 0 |

⚡ **La mort du crop tombe au cran 39, DANS le premier niveau** : le crop meurt
sur une ALTITUDE (40 342,8 m), pas sur un niveau de MNT. Le premier
franchissement, lui, n'arrive qu'au cran 48 — et il conserve l'altitude
(42 406 → 56 242 m par la seule croissance de `d`, l'emprise doublant pendant que
`camY` est divisé par deux).

### LE NOMBRE DE CRANS

| geste | crans pour tuer le crop | crans pour l'orbite |
|---|---|---|
| **molette, défilement continu, pente d'arrivée** | **39** | **179** |
| molette, défilement continu, couchée à φ = 88,2° | 138 | 179 |
| molette, descente ET remontée à la molette | 35 | 178 |
| **bouton « − », un clic par 330 ms** | **3** | **17** |
| bouton « − », un clic par 100 ms | 3 | **18** (avant : 24) |
| bouton « − », un clic par image | 3 | 47 (avant : 54) |

⚠️ **179 N'EST PAS UN DÉFAUT, C'EST L'ARITHMÉTIQUE D'UN RÉGLAGE D'ADRIEN.**
`CRANS_PAR_NIVEAU = 20` (`modes.js`, « AU MOINS 20 CRANS EST UNE CONTRAINTE
D'ADRIEN, PAS UN EFFET DE BORD ») × neuf niveaux de z11 à la porte orbitale =
180. Mesuré, niveau par niveau : **48, 11, 20, 20, 20, 20, 19** à la pente d'arrivée
et **40, 19, 20, 20, 20, 19, 20** couchée à 88,2°. **Les cinq derniers niveaux
valent 20 crans, au cran près** ; les deux premiers sont irréguliers pour une
raison lisible — la descente laisse le compteur à `−ln2 / 2` (un demi-niveau
déjà dépensé vers l'intérieur), donc le premier niveau en coûte 48 et le second
rattrape à 11. **Le seul nombre à changer si Adrien veut moins de crans est
`CRANS_PAR_NIVEAU`, il est isolé, et je ne l'ai pas touché** : ce n'est pas un
défaut, c'est une préférence, et elle est à lui.

⚡ **Le bouton, lui, met 17 clics** — `PAS_CRAN = ln2 / 2`, deux clics par
niveau. C'est le chemin « raisonnable » que le brief réclame, et c'est
précisément celui qui était cassé.

### L'ALTITUDE MONTE — le critère à part entière

| banc | crans où l'altitude BAISSE |
|---|---|
| `apres-rafale` (179 crans) | **0 / 179** |
| `apres-rafale-couchee` (179 crans) | **0 / 179** |
| `apres-bouton-c6` (18 clics) | **0 / 18** |
| `apres-bouton-rapide` (47 clics) | **0 / 47** |

⛔ **ET ELLE NE BAISSAIT PAS AVANT NON PLUS** : `avant-rafale` **0/179**,
`avant-bouton-c20` **0/17**. Le « 18 717 → 17 554 m » du brief ne s'est
**pas reproduit** sur le geste réel — voir §⑥.

---

## ③ LE PIVOT REVIENT AU CENTRE DE LA TERRE, SANS SAUT

### Les images qui encadrent la mort du crop (`apres-rafale`, img 530-541)

`pTerre` = projection du centre de la Terre par `camGlobe`, en pixels sur
1280 × 800 ; `pBloc` = projection du centre du bloc.

| img | crop | écart à l'axe | `pTerre` (px) | `pBloc` (px) | `d` | altitude |
|---|---|---|---|---|---|---|
| 530 | oui | 14,6917 | 640,0 · 1787,6 | 744,3 · 469,3 | 130,565 | 40 003 m |
| 531 | oui | 14,7040 | 640,0 · 1787,6 | 743,8 · 469,0 | 131,222 | 40 203 m |
| 532 | oui | 14,7040 | 640,0 · 1787,4 | 743,8 · 469,0 | 131,222 | 40 203 m |
| 533 | oui | 14,7159 | 640,0 · 1787,4 | 743,3 · 468,6 | 131,854 | 40 394 m |
| **534** | **non** | 14,7159 | 640,0 · **1787,2** | **743,3 · 468,6** | 131,854 | 40 394 m |
| 535 | non | 14,3508 | 640,0 · 1787,2 | 738,8 · 465,1 | 133,772 | 40 977 m |
| 536 | non | 14,3508 | 640,0 · 1787,2 | 738,8 · 465,1 | 133,772 | 40 977 m |
| 539 | non | 13,9560 | 640,0 · 1777,7 | 735,9 · 463,1 | 133,700 | 41 099 m |

⚡ **À l'image de la bascule (533 → 534), le centre du bloc ne bouge pas d'un
pixel** (743,3 · 468,6 des deux côtés) et le centre de la Terre se déplace de
**0,2 px**. La bascule elle-même ne se voit pas.

### Le retour, dans la remontée ordinaire

| | mesuré |
|---|---|
| écart à l'axe à la mort du crop | **14,7159 u** |
| images pour revenir sur l'axe | **120** (2 s à 60 Hz) |
| écart final | **1,388 × 10⁻¹⁷ u** |
| saut max du centre du bloc, par image | 34,48 px |
| saut max du centre de la Terre, par image | 39,13 px |
| bascules de `veille-repos` | **7 → 7** (aucune) |

⚠️ **Les 34 et 39 px NE SONT PAS le recentrage** — c'est la conclusion n° 6 de
R27, et je la reproduis sous mon banc : le balayage de D16 ter tourne pendant
tout le retour et il domine la mesure. Le §④ isole le recentrage.

---

## ④ `veille-repos` NE VOIT RIEN, ET D16 ter TIENT

### Le recentrage, SEUL à l'écran — protocole R27 §③, rejoué

Hors du crop, glissé éteint (`_zoomVel === 0`), `busy` faux, balayage fini. On
décale **rigidement** caméra ET cible de 12,7208 u, puis **plus un geste**.

| | mesuré | contre `SEUIL_BOUGE_LOG = 1e-4` |
|---|---|---|
| images pour revenir sur l'axe | **53** | — |
| écart final | **0,0000000** | — |
| distance avant → après | **79,35866233825236 → 79,35866233825236** | **égalité au bit** |
| **`|Δ ln d|` MAX** | **0,00000** | — |
| saut max du centre du bloc | **4,0710 px** | (plafond de loi 4,05 px, R27 §réserve 2) |
| saut max du centre de la Terre | **0,0000 px** | — |
| bascules de `veille-repos` | **8 → 8** | — |
| `veilleRepos.dernierEcart` max | **0,00000** | — |

**Zéro, et pas « sous le seuil ».** C'est `(P + δ) − (T + δ) = P − T`, l'algèbre
de R27, que je n'ai pas touchée et qui tient sous mon correctif.

⛔ **ET LE PREMIER RELEVÉ DE CE MÊME PROTOCOLE ÉTAIT FAUX** — voir §⑥ n° 4 : il
rendait `|Δ ln d| = 1,69 × 10⁻³` et une distance qui passait de 71,36 à 79,30.
C'était le glissé inertiel qui courait encore (`ZOOM_TAU = 1,2 s`). « Plus un
geste » veut dire attendre `_zoomVel === 0`, pas attendre un peu.

### D16 ter

La bascule de trois quarts arrive au bloc et pas avant : le balayage `versNadir`
s'arme **une seule fois**, sur le front descendant de `surLeBloc`, et il finit
(mesuré image par image : `t` de 0 à 1, `e` de 0 à 1, `angleTotalDeg = 46,55`,
**130 images**). Je n'ai touché **ni son armement, ni sa loi, ni sa durée** :
mon correctif ne fait que ne plus perdre ce que le compteur encaisse pendant
qu'il tourne. Le compteur d'armements est dans la sonde (`__R29.armements`)
exactement parce qu'un balayage qui ne finit pas et un balayage qui se ré-arme
rendent tous les deux « vrai à chaque image ».

---

## ⑤ POURQUOI R23 ET R27 ONT CONCLU QUE C'ÉTAIT RÉPARÉ

**Leurs deux correctifs sont justes, ils tiennent tous les deux, et je n'en
retire aucun.** Ce n'est aucune des trois hypothèses du brief.

### Les trois hypothèses du brief, confrontées

| hypothèse | verdict | la mesure |
|---|---|---|
| ① « leurs bancs n'appelaient pas le même chemin que la molette » | **vraie pour R27, fausse pour R23** | R23 a corrigé `_applyZoom`, le chemin de la molette. R27 a corrigé `cranZoom`, le chemin du bouton. Les deux chemins sont couverts. |
| ② « les deux correctifs se sont annulés à la fusion » | ⛔ **RÉFUTÉE** | Les deux vivent, à deux endroits différents de `modes.js`, et les deux se mesurent : au plafond, `_applyZoom` compte 2/60 d'intention par image (test ① de `retour-orbite.test.js`, vert) et `cranZoom` compte `ln √2` (test ③ bis, vert). |
| ③ « `maxDistance = 150` mord avant le compteur » | ⛔ **RÉFUTÉE sur la molette** | Sur les 179 crans de `apres-rafale`, `d` culmine à **132,88** (133,77 en relevé par image) — il n'atteint **jamais** 150. Couché à 88,2°, il culmine à **137,51**. La butée ne mord pas sur ce chemin : **le franchissement de niveau divise `d` par deux** avant qu'elle n'arrive. |

⚡ **Elle mord sur le BOUTON, et seulement là** : `avant-bouton-rapide`, `d` colle
à **150,00** pendant **14 clics**, `_levelZoom` monte à **13,52**, altitude figée
à **134 225 m**, `z` bloqué à **10**. C'est le relevé du brief. Et la butée n'en
est que le symptôme : la cause est en dessous.

### LA VRAIE CAUSE, ET POURQUOI AUCUN DES DEUX BANCS NE POUVAIT LA VOIR

`_franchirSiBesoin` refuse de franchir pendant le balayage de pose. Le
commentaire qui défend cette garde promet, depuis la Tâche R4 :

> *« Le compteur de budget, lui, TRAVERSE : le niveau se franchit à l'image
> suivant la fin du balayage, **sans rien perdre**. »*

⛔ **`_levelZoom = reste` ne tenait pas cette promesse.** `franchissement(9,01)`
rend `niveaux = 13` et `reste = 0,0` : on franchissait **un** niveau et on
posait le compteur à **zéro**, donc **douze niveaux à la poubelle**.

Et rien ne rappelait `_franchirSiBesoin` une fois le geste fini : ni
`_applyZoom` (le glissé est mort), ni `cranZoom` (il n'y a plus de clic).

**Trois raisons pour lesquelles les deux bancs précédents disaient oui :**

1. ⛔ **Leur cadence attendait `busy`, jamais `_fonduPose`.** R27 attendait
   `!modes.busy` entre deux crans ; R23 laissait courir un glissé de 1,2 s. Le
   balayage `versNadir`, lui, s'arme **exactement sur la mort du crop** et dure
   **130 images**. Un clic ne tombait jamais dedans. **Sur ma sonde, la garde
   fautive n'est visible que parce que je relève les QUATRE gardes séparément** :
   `busy false · travel false · dive false · **fondu true**` sur douze crans
   consécutifs, avec `getCoarsenTarget()` vrai tout du long.
2. ⛔ **Le cas à UN niveau est exactement celui où `= reste` est juste.** La
   garde `⑫ GARDE M4` de `zoom-continu.test.js` s'appelle *« un franchissement ne
   se lance PAS pendant le balayage, **et il n'est pas PERDU** »* et elle pose
   `_levelZoom = PAS_NIVEAU × 1,2` — **un** niveau. `reste = budget − 1 × pas`
   y vaut exactement ce qu'il faut. **Le test verrouillait le défaut en
   affirmant le contraire**, et il reste vert sous mon correctif (c'est mon
   témoin d'identité au bit, `④ bis`). Il fallait treize niveaux pour le voir.
3. ⛔ **`cranZoom` jetait le clic sur `busy`** — sept sur huit. R27 a corrigé le
   **clamp** de ce chemin (compter l'intention au plafond) et a laissé le
   **rejet** au-dessus, deux lignes plus haut. Son banc appelait `cranZoom` puis
   attendait `busy`, donc il ne pouvait pas le voir non plus.

### LE FACTEUR, ÉTABLI AVANT DE DÉCIDER — le 21,9× de R23 est JUSTE

Le brief interdit de toucher `maxDistance` ou `SEUIL_MORT_M` sans écrire le
facteur. **Je n'ai touché ni l'un ni l'autre**, et voici la mesure qui dit
pourquoi R23 avait raison — et ce qu'elle rate.

`altitudeCadrageM = camY × emprise / span` et `camY = d cos φ + y_cible`.
Deux poses relevées au même bloc z11, même cran 0 :

| pose | φ | `d` | `camY` | altitude |
|---|---|---|---|---|
| pente d'arrivée | 46,55° | 47,93 | 32,661 | **14 917 m** |
| couchée, butée polaire | 88,20° | 49,69 | 1,261 | **562 m** |

| facteur | valeur |
|---|---|
| `cos(46,55°) / cos(88,2°)` — **le facteur de R23** | **21,90** |
| rapport de `camY` mesuré | 25,90 |
| rapport d'altitude mesuré | **26,56** |

⚡ **Le 21,9 de R23 est confirmé à trois chiffres, et il n'explique que 82 % de
l'écart.** Le reste vient de `Y_CIBLE = −0,3` : à φ = 88,2° la cible enterrée
retranche 0,3 u sur un `camY` qui n'en vaut que 1,56, soit **+24 %** — c'est la
**réserve n° 2 de R23** (« `Y_CIBLE` est une constante de mode plat, et c'est la
CAUSE PROFONDE ») qui se mesure ici pour la première fois en altitude. Je ne
l'ouvre pas : c'est un chantier à part, et R27 a écrit pourquoi le déplacer
bouge l'instrument (0,94 % d'altitude, donc le seuil de naissance du crop).

⛔ **Et cet écart de 26,6× NE coûte PAS de crans supplémentaires jusqu'à
l'orbite** : 179 dans les deux poses. Il coûte des crans pour tuer le CROP (39
contre 138), parce que le crop meurt sur une ALTITUDE. **C'est géométriquement
honnête** : couché vers l'horizon, on est réellement 26 fois plus bas. Chaque
cran vaut le même `Δ ln(altitude)` aux deux poses ; il y a simplement 4,7
doublements de plus à faire. **Ce n'est donc pas là qu'il fallait corriger**, et
c'est la deuxième raison de ne pas remonter `maxDistance` : borner l'altitude au
lieu de la distance exigerait `d = 3 284 u` à la butée polaire, pour un bloc de
56 u de côté — la caméra à cinquante-huit blocs de distance, regardant à côté.

---

## ⑥ CE QUE J'AI CRU PUIS RÉFUTÉ

**Sept choses, et les trois premières auraient produit un troisième rapport
faux.**

1. ⛔ **« Le geste réel ne sort jamais du crop, comme le dit le brief. »**
   **Faux, et c'est ma première mesure.** Molette réelle, défilement continu,
   pose d'arrivée : le crop meurt au **cran 39** (40 394 m > 40 342,8), l'orbite
   est atteinte au **cran 179**, l'altitude monte à chaque cran. Couchée à
   88,2° : crop mort au cran 138, orbite au 179. Descente ET remontée à la
   molette : crop mort au 35, orbite au 178. **Sur le chemin de la molette, il
   n'y a jamais eu de blocage** — ni avant mon correctif, ni après.

2. ⛔ **« C'est la butée `maxDistance = 150` qui mord (hypothèse ③). »** Réfutée
   sur la molette : `d` culmine à **132,88** sur 179 crans, et à **137,51** quand
   la vue est couchée — jamais 150. Le franchissement divise `d` par deux avant que la butée
   n'arrive. ⚡ **Elle mord bel et bien sur le BOUTON — mais elle n'y est que le
   symptôme.** J'ai failli publier « la butée mord, il faut la desserrer », ce
   que le brief interdit précisément, et j'aurais desserré un symptôme.

3. ⛔ **« `ZOOM_STOP = 0,015` rogne la moitié de chaque cran, il faut le
   dériver de l'impulsion. »** Mesuré : un cran ISOLÉ, glissé éteint entre
   chaque, ne délivre que **0,016987** de log-distance au lieu des
   `ZOOM_IMPULSE × ZOOM_TAU = ln2/20 = 0,034657` de la loi — **49,0 %**. J'ai
   cru tenir un défaut. **Il n'y en a pas** : la constante est calibrée pour le
   **défilement continu**, où la vitesse s'accumule bien au-dessus de
   `ZOOM_STOP` — et là, mesuré niveau par niveau : **20, 21, 20, 20, 20, 19,
   21 crans**, la loi d'Adrien au cran près. Mon banc « un cran, puis
   extinction » est le bout pessimiste, pas le geste. Corriger aurait donné
   13 crans par niveau en défilement continu, c'est-à-dire cassé la contrainte
   au nom de laquelle je corrigeais.

4. ⛔ **« Mon protocole de retour isolé mesure le recentrage. »** Il rendait
   `|Δ ln d| = 1,69 × 10⁻³` — **17 fois le seuil** — et une distance qui passait
   de 71,36 à 79,30 u. Le recentrage est **rigide**, donc invariant en distance
   par construction : la mesure ne pouvait pas être la sienne. C'était le glissé
   inertiel qui courait encore (`ZOOM_TAU = 1,2 s`, et j'avais attendu 60
   images). Après attente de `_zoomVel === 0` : **0,00000, et la distance
   identique au bit.** C'est la faute n° 6 de R27, reproduite trait pour trait.

5. ⛔ **« Le balayage `_fonduPose` ne finit jamais. »** Douze crans consécutifs à
   `fondu: true` : j'ai écrit « il est armé à vie ». **Faux.** En instrumentant
   `_armerFonduPose` : **deux armements**, et le second avance proprement
   (`e` de 0 à 1, `angleTotalDeg = 46,55`, `pasMaxDeg = 1,5`) et finit en
   **130 images**. Mon banc envoyait un clic par image : les douze crans tenaient
   dans les 2,2 secondes du balayage. **Un état vrai à chaque image ne dit pas
   s'il est le même état** — c'est pour ça que la sonde compte les armements.

6. ⛔ **« Au clic par image, l'avant n'atteint JAMAIS l'orbite. »** Je l'ai écrit
   après avoir lu les 30 premières lignes d'une table qui en avait 54. **Il
   l'atteint au clic 54** (contre 47 après). Le gain honnête ne se lit pas là :
   il se lit à **100 ms de cadence, 24 → 18 clics**, pour un minimum théorique
   de 17. Une table tronquée est un banc tronqué.

7. ⛔ **« Il faut retirer un des deux correctifs (attendu ⑥). »** Non : les deux
   tiennent et les deux se mesurent séparément. Ce qu'il fallait retirer, c'est
   `_levelZoom = reste` — une ligne que **ni R23 ni R27 n'ont écrite** ; elle
   date de la Tâche M et son commentaire promettait déjà l'inverse de ce qu'elle
   faisait.

---

## ⑦ LE CORRECTIF

`src/modes.js`, trois endroits, **64 lignes ajoutées dont 45 de commentaire**.

1. **`_franchirSiBesoin` dépense UN niveau par appel et garde le reste.**
   `this._levelZoom = reste` → `+= BUDGET_NIVEAU` (affiner) / `-= BUDGET_NIVEAU`
   (élargir et porte orbitale). ⚠️ **Identique au bit quand un seul niveau est
   dû** — `reste` vaut alors `budget − 1 × pas`, exactement ce que retranche la
   ligne. La différence ne vit que dans le cas à plusieurs niveaux, c'est-à-dire
   le défaut.

2. **`cranZoom` n'a plus `busy` dans son rejet.** Pendant un chargement il
   encaisse l'**intention** (`ln(facteurCran(dir))`) et **n'écrit pas la
   caméra** — elle appartient à `_rescale`, qui pose la cible d'arrivée et
   convertit les unités. Même asymétrie que partout ailleurs : vers l'intérieur,
   au zoom fin, le compteur ne court pas. `travel` et `_diveTween` restent des
   rejets durs.

3. **`update()` rappelle `_franchirSiBesoin` par image**, dans la branche de
   surface, **juste après le bloc du balayage** — qui pose `_fonduPose = null` à
   l'image où il finit, donc le niveau part dès CETTE image. C'est la doctrine
   du fichier (« armée ici, la bascule avance dès la MÊME image »).

⛔ **CE QUE JE N'AI PAS TOUCHÉ**, et c'est la moitié du travail :
`maxDistance` · `SEUIL_MORT_M` · `SEUIL_NAISSANCE_M` · `Y_CIBLE` ·
`CRANS_PAR_NIVEAU` · `ZOOM_STOP` · `ZOOM_IMPULSE` · `ZOOM_TAU` ·
`PAS_POSE_MAX_DEG` · `DUREE_FONDU_POSE_S` · l'armement du balayage · le
recentrage de R27 · `controls.target` (jamais écrit). `git diff` sur `src/` ne
sort que `modes.js`.

### AVANT / APRÈS, MÊME BANC

| geste | avant | après |
|---|---|---|
| bouton, un clic par 330 ms | orbite au **17e** | orbite au **17e** — inchangé |
| bouton, un clic par 100 ms | orbite au **24e** | orbite au **18e** |
| bouton, un clic par image | orbite au **54e**, `d` collée à 150,00 pendant 14 clics, `_levelZoom` à 13,52 | orbite au **47e** |
| huit `cranZoom(-1)` pendant un chargement | **1 cran compté sur 8** | **8 sur 8**, caméra intacte |
| molette continue, pente d'arrivée | 179 crans, crop mort au 39 | **179, crop mort au 39** — inchangé |
| molette continue, couchée 88,2° | 180 crans | **179** |

⚡ **Le correctif ne change RIEN au chemin qui marchait déjà** (la molette, et le
bouton à cadence humaine lente). Il ne rend que ce qui était jeté.

---

## ⑧ LES TESTS

**Huit tests neufs** dans `test/retour-orbite.test.js` (déjà inscrit dans la
liste explicite de `package.json` — aucun fichier à ajouter, donc aucun test qui
ne tournerait jamais).

| test | ce qu'il exige |
|---|---|
| `④` | treize niveaux encaissés pendant le balayage se dépensent **tous, un par un**, et le compteur garde son reste à chaque tour |
| `④ bis` | **témoin** : à UN niveau dû, le compteur rend **exactement** `reste` — `assert.equal`, pas un seuil |
| `④ ter` | même loi vers l'intérieur |
| `⑤` | huit clics pendant un chargement comptent **huit** crans, et **la caméra n'a pas bougé** |
| `⑤ bis` | **témoin** : l'asymétrie du zoom fin tient pendant un chargement |
| `⑤ ter` | **témoin** : en orbite, un chargement laisse le cran tranquille |
| `⑥` | une image ordinaire suffit à franchir ce que le geste a laissé |
| `⑥ bis` | **témoin** : une image ordinaire au repos ne franchit **rien** |
| `⑥ ter` | garde de source, **bornée au bloc du balayage** — `_franchirSiBesoin` apparaît trois fois dans `modes.js`, une recherche sur tout le fichier resterait verte si la troisième disparaissait |

⚠️ **MUTATION VÉRIFIÉE** : correctif retiré, **cinq des huit tombent**
(`④`, `④ ter`, `⑤`, `⑥`, `⑥ ter`) et les **quatre témoins restent verts**
(`④ bis`, `⑤ bis`, `⑤ ter`, `⑥ bis`) — c'est ce qu'on leur demande.

⚠️ **Et un ulp a failli faire passer le défaut pour une loi** : à
`_levelZoom = 13 × ln2` exactement, `13 × ln2 − 12 × ln2` retombe **un ulp sous
`ln2`** et la troncature rend 0 — le treizième niveau se perdait dans le
`double`, pas dans le code. Le test pose donc **13,5 niveaux**, ce que le banc a
relevé de toute façon (9,01 puis 13,52).

| | valeur |
|---|---|
| `npm test` | **4 650 tests · 0 échec** (base à battre : 4 641) |
| tests ajoutés | **8** (+1 sous-test compté) |
| `npm run audit:tests` | **240 listés · 240 sur disque · aucun écart** |
| fichiers de test ajoutés à `package.json` | **aucun** — tout est dans un fichier déjà listé |
| console du navigateur | **aucune erreur autre que des 404 de tuiles**, identiques avant et après (relevées à chaque exécution par la sonde) |

⚠️ **Octets vérifiés** : `src/modes.js`, `test/retour-orbite.test.js` et
`scripts/sonde-sortie-r29.mjs` relus octet par octet — **aucun caractère de
contrôle** hors tabulation/retour à la ligne. L'ajout au fichier de tests a été
fait en **binaire** (`fs.appendFileSync` d'un tampon), pas par un shell.

---

## ⑨ RÉSERVES OUVERTES

1. ⚠️ **179 crans de molette pour aller du bloc à l'orbite.** C'est
   `CRANS_PAR_NIVEAU = 20` × neuf niveaux, et la loi est tenue au cran près. **À
   trancher avec Adrien** : s'il trouve ça long, le nombre à changer est unique,
   isolé et documenté. Le bouton, lui, met 17 clics.

2. ⛔ **Le balayage de D16 ter gèle le franchissement 130 images (2,2 s) après
   chaque mort de crop.** Plus rien n'est perdu, mais l'utilisateur qui clique
   pendant ces 2,2 s voit sa vue immobile puis rattraper d'un coup. **Je n'ai
   pas touché au balayage** : c'est le geste qu'Adrien a demandé, et R27 a montré
   qu'on le *translate* au lieu de l'attendre. La même solution est peut-être
   applicable au franchissement — la garde deviendrait inutile — mais c'est un
   autre chantier, et elle demande de savoir ce que `_rescale` fait à la caméra
   pendant qu'il tourne.

3. ⚠️ **`Y_CIBLE = −0,3` coûte +24 % d'altitude perdue à la butée polaire**, en
   plus du 21,9× de la géométrie. C'est la réserve n° 2 de R23, mesurée ici en
   altitude pour la première fois. Toujours pas ouverte.

4. ⚠️ **Le coût par image n'est pas chiffré.** `_franchirSiBesoin` par image,
   c'est une division et quatre comparaisons, sans allocation, et il sort avant
   la division dans le cas courant. Mais ce n'est pas mesuré, et un « coût
   indiscernable de zéro » non mesuré est exactement ce que
   `lecons-campagne-R.md` §② reproche.

5. ⚠️ **Le relevé du brief (`d = 150,000`, altitude 18 717 m, emprise 27 354 m,
   crop vivant, `_levelZoom` 0 → 0,008 sur 32 crans) n'a PAS été reproduit tel
   quel.** Sa signature — caméra collée à 150, altitude figée, compteur qui
   n'avance presque pas — je la reproduis **sur le bouton** ; l'emprise 27 354 m
   dit un bloc z12 sur un autre lieu que le mien, et le « 0,008 sur 32 crans »
   dit des crans qui n'atteignaient pas `_applyZoom` (le voile, ou
   `molettePendantCadrageDamier` après un clic sur le bouton caméra, qui avale
   les crans mous et remet `maxDistance` à 150 — **piste non close**).

6. ⚠️ **Le cadrage du damier avale la molette et je ne l'ai pas mesuré.**
   `molettePendantCadrageDamier` rend `true` — cran mangé — tant que
   `doitVraimentDezoomer` n'est pas satisfait, et il pose `d ≈ maxDistance ×
   0,97 ≈ 145`. Si Adrien a cliqué le bouton caméra avant de dézoomer, il a un
   deuxième chemin où la molette ne fait rien. **C'est la piste à mesurer
   ensuite**, et c'est celle qui colle le mieux au « 32 crans, 0,008 ».
