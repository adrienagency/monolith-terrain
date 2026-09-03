# RAPPORT R37 — LE FLOU DE ZOOM : dessiner les enfants prêts, et ne plus jeter ce qui est net

Branche `raffinement-partiel` (arbre `C:\Dev\wt-raf`). Terrain : `src/globe.js`
(`_traverse`, le raffinement, la file des enfants, `_pump`, `_evictJusqua`),
`src/monde/flux-terrain.js` (étape 3 de `demanderEmprise`, six lignes),
`src/monde/materiau-tuile.js` (`liberer`, deux lignes), `test/veille-repos.test.js` ⑦,
`test/raffinement-partiel.test.js` (neuf), `scripts/sonde-r37.mjs`, `scripts/couture-r37.py`.
Rien dans le nuanceur, rien dans la caméra.

> Adrien : « Lors des zooms, je vois les zones déjà chargées qui redeviennent floues
> puis se remettent en haute définition à chaque niveau de transition. »

## 0. LE BANC

Chrome sans tête (`--headless=new`), 1280×720, pixelRatio 1, RTX 3080 (ANGLE D3D11),
palier machine **0**, réseau classé « lent » par l'application (1,3–1,6 Mb/s), serveur
`vite` de dev sur 6931. Sonde `scripts/sonde-r37.mjs` : altitude posée au bouton vers
800 km (z8, la pose tombe entre 560 et 705 km selon le tirage), puis **rafale de molette
(40 ms) jusqu'à 20 km (z13)** — le geste de PF2. Le crop vit à cette altitude (naissance
32 km), donc la descente traverse la vidéo d'Adrien de bout en bout.

**Ce qu'elle relève DANS `update()`, à chaque image**, sur une grille de 32 × 18 points
d'écran : la tuile DESSINÉE sous chaque point (rayon → sphère → lat/lon → quadtree,
masque de quadrant compris), le niveau que `_traverse` VEUT là (`chord / dist` contre
`SPLIT_RATIO`, ou le zoom prescrit du crop), d'où :
- **retard** — fraction d'écran dessinée ≥ 1 niveau sous ce que le parcours veut
  (c'est « le parent étiré » au sens du brief ; ≥ 2× de texel par pixel coïncide) ;
- **recul** — fraction d'écran où la tuile dessinée est PLUS GROSSIÈRE qu'à l'image
  d'avant (une zone nette qui redevient floue) ;
- **trou** — aucun tuile dessinée sous un point de planète visible (hors crop au repos,
  `uEstompage = 1`, rien ne se dessine PAR DESSEIN — exclu) ;
- les compteurs `_rechargeTuiles`, `poserCrop`, évictions de tuiles dessinées,
  annulations en vol de tuiles du champ ; `_traverse`, `update`, dessinées, cache ;
  requêtes au protocole CDP par phase.

**A/B dans la même session**, par des leviers débrayables (`globe.raffinementPartiel`,
`globe.protegerEnfants`, `globe.prelecture`, `redemanderSurPlace` retiré) — quatre
variantes : `avant` (les trois débrayés), `partiel` (le raffinement partiel seul),
`surplace` (partiel + rechargement sur place + enfants protégés), `complet` (+
prélecture). ⚠️ Le geste n'est pas déterministe (la molette est inertielle : 1 100 à
2 300 images par descente), la machine était partagée avec B5, BT-I et GE2 : **médianes
de 2 à 4 tirages entrelacés**, valeurs individuelles entre parenthèses. Traces :
`.banc/R37/*.json`, captures `.banc/R37/*-NNN.png` (ignorés par git).

## 1. LE DIAGNOSTIC — lequel des deux défauts Adrien voit-il ?

**Image par image sur sa vidéo** (`vid33/k001…k040.jpg`, 2 images/s, netteté = laplacien
moyen sur le centre) : k14 nette (5,5), **k15 et k16 floues (3,4)**, k17 nette (5,3) ;
second cycle k23 (2,85) ; et **entre k14 et k15 la caméra n'a pas bougé** (même
cadrage, mêmes coordonnées au HUD, le bandeau « niveau de détail » s'allume en bas à
gauche). Un parent étiré par le zoom se floute PROGRESSIVEMENT (×1,8 de texel au
seuil) ; ici tout l'écran tombe d'un coup, sans geste, de deux à trois niveaux. **C'est
le second défaut : une zone nette qui redevient floue.**

**Le banc le retrouve et le nomme.** Sur les trois descentes « avant », le flou (Σ des
fractions d'écran en retard) se répartit en épisodes ; ceux où le `recul` atteint ≥ 30 %
de l'écran (une zone nette devenue grossière) portent **63 à 72 % du flou** (72 · 63 ·
70 ; 10,4 s / 5,1 s / 17,6 s de recul contre 4,7 / 3,8 / 4,5 s d'étirement). Le reste,
28 à 37 %, est le parent étiré au franchissement du seuil — la règle tout ou rien.

**Le mécanisme du recul, instrumenté dans `_traverse`** (état des enfants des parents
dessinés qui VEULENT descendre) : à l'image du recul, les enfants sont en `loading`
(9 sur 4 parents, 12 sur 4 parents…), pas absents, pas hors champ — **des tuiles prêtes,
dessinées l'image d'avant, remises en chargement.** L'auteur est `demanderEmprise`
(`flux-terrain.js`, étape 3) : à chaque niveau, le socle du bloc réclame les hauteurs
des tuiles de son emprise au zoom soutenable (10, 11, 12 sur ce réseau « lent ») —
exactement les tuiles du centre de l'écran — et, comme `_buildMesh` a relâché leurs
hauteurs (Tâche 4 sexies), il **jetait maillage et texture, remettait `empty`, et
redemandait.** Pendant le vol : la règle sans-trou remonte au parent (z9 sur 100 % de
l'écran, 12 tuiles dessinées au lieu de 56), puis le cache souple évince les descendants
devenus non porteurs (**818 → 637 tuiles en une image**, tous à retélécharger). Ni
`_rechargeTuiles` (0 appel — D10 tient, l'exagération est constante), ni une éviction
de tuile dessinée (0), ni `poserCrop` : c'est la redemande du flux, et R26 l'avait
frôlée (« `demanderEmprise → _annuler` annule en plein vol »).

## 2. LES CORRECTIFS, dans l'ordre

| # | levier | ce que ça fait |
|---|---|---|
| ① | **le raffinement partiel** (`_traverse`, `_dessinerPartiel`, `_decouperEnQuadrants`) | les enfants prêts du champ dessinent ; le parent ne dessine que sous les manquants. L'index du maillage est réordonné UNE fois par tuile en `[Q0][Q1][Q2][Q3][jupe]` (classement par centroïde uv, jupe = triangles ≥ `nV`) et découpé en cinq groupes ; le matériau devient `[partagé, invisible]` et chaque groupe pointe l'un ou l'autre — three saute un groupe dont le matériau est `visible = false`. **Aucune ligne de nuanceur.** Le matériau redevient le partagé à l'image suivante (`_partiels`), `liberer` et `_melangeCrop` tolèrent le tableau. `refined` garde son sens (« les quatre dessinent ») pour ne pas déplacer l'hystérésis. |
| ② | **le rechargement sur place** (`redemanderSurPlace`, `_jeterMaillage`, `_pump` `surPlace`) | une tuile prête que le flux redemande RESTE `ready` et dessinée ; l'entrée de file part chercher la donnée et ce n'est qu'à l'arrivée que `_pump` jette l'ancien maillage et bâtit le neuf — qui **hérite de la visibilité** (la promesse se résout entre `update()` et le rendu de la même image, mémoire de tuiles → microtâche ; sans cette ligne, un trou d'une image, vu au banc de test). En échec, la tuile reste telle quelle. `flux-terrain.js` étape 3 l'appelle quand le globe sait faire, sinon l'ancien chemin (globes de papier des tests). |
| ③ | **les enfants d'un parent dessiné sont évincés en dernier** (`_evictJusqua`) | un rang de plus entre « non porteuses » et « porteuses » ; le plafond dur reste atteignable. |
| ④ | **la prélecture un niveau à l'avance** (`_prelire`) | en DESCENTE seulement (rayon caméra qui décroît), chemin continu seulement, tuile dessinée dont `ratio > 0,7 × SPLIT_RATIO`, **au centre de l'écran seulement** (clé de PF2 ≥ 850, soit le bord de la tuile à < 0,6 NDC du centre), crédit de création ≥ 400 : ses enfants du champ partent à `_priorite(k) − 10` — la clé de PF2, en retrait, non suivie, purgée dès qu'une image ne la prélit plus. |

## 3. AVANT / APRÈS — le critère d'Adrien, en pixels

Descente 560–705 km → 12–18 km, médianes (tirages) :

| grandeur | avant (3) | partiel seul (2) | sur place (4) | complet (4) |
|---|---|---|---|---|
| **flou — fraction d'écran en retard ≥ 1 niveau, moyenne sur la descente** | **13 %** (7,3 · 13,4 · 13,0) | 9,4 % (7,3 · 11,4) | 5,8 % (6,7 · 5,7 · 5,9 · 4,2) | **3,9 %** (2,7 · 5,0 · 5,0 · 2,0) |
| flou p50 / p90 / max | 0 / 50 / 100 | 0 / 31 / 100 | 0 / 17 / 100 | 0 / **0** / 100 |
| images floues (> 5 % de l'écran) | **27,5 %** | 23,7 % | 17,4 % | **5,8 %** |
| durée cumulée des épisodes de flou | 15,0 s | 10,0 s | 6,0 s | 2,8 s |
| **recul — zone nette redevenue floue, max par image** | **100 %** | 100 % | 0,35 % (0 · 1,4 · 0 · 0,7) | **0 %** |
| part du flou due au recul | 70 % | 49 % | 0 % | 0 % |
| **trous** (planète visible sans tuile) | 0 | 0 | 0 | **0** |
| requêtes par descente | 568 (560–590) | 680 | 581 (540–683) | 610 (581–760) |
| Mio par descente | 15,9 | 20,5 | 15,8 | 17,1 |
| `_traverse` p50 / p99 (ms) | 0,3 / 1,3 | 0,4 / 1,6 | 0,4 / 1,4 | 0,4 / 1,4 |
| `update` p50 / p99 (ms) | 0,5 / 2,1 | 0,6 / 2,2 | 0,5 / 1,9 | 0,55 / 1,9 |
| appels de dessin (tuiles) p50 / max | 62 / 144 | 67 / 203 | 74 / 203 | 78 / 229 |
| parents partiels, max par image | 0 | 20 | 18 | 21 |
| cache max | 832 | 831 | 820 | 860 |
| calme après l'arrêt (ms) | 1 790 | 1 735 | 1 721 | 1 726 |

**Lecture.** Le max reste 100 % dans toutes les variantes : c'est l'image où le crop naît
(32 km, `poserCrop` prescrit z13 partout d'un coup) — un retard de un niveau sur tout
l'écran pendant que z13 arrive, sans recul. Ce qui change est **la surface × temps** :
13 % → 3,9 % de l'écran en moyenne (÷3,3), 27,5 % → 5,8 % des images (÷4,7), 15 s → 2,8 s
d'épisodes, et surtout **le recul passe de 100 % à 0** — la zone nette ne redevient plus
floue. Le p90 tombe à 0 : neuf images sur dix sont nettes partout où le parcours le veut.

**Le coût.** `_traverse` 0,4 / 1,4 ms (avant 0,3 / 1,3), `update` 0,55 / 1,9 (0,5 / 2,1),
requêtes 610 contre 568 (les tirages se recouvrent : 581–760 contre 560–590 ; le 760 est
un tirage à 66 Mio comme `surplace5` à 683/66 Mio — le réseau, pas le code), cache 860
contre 832. Les appels de dessin montent de 62 à 78 au p50 : ce sont les enfants prêts
dessinés au lieu du parent — c'est le but — plus, par parent partiel, un appel par
groupe visible (au pire 5 pour 21 parents). Pas de régression sur `_traverse`, pas de
×14.

**La couture** (`scripts/couture-r37.py`) : sur les captures où des parents partiels
sont à l'écran, différence de luminance à ±3 px de part et d'autre de l'arête
enfant/parent (projetée avec le relief), moins la même mesure 12 px plus loin dans
l'enfant (le témoin : la texture varie d'elle-même). Sur 4 descentes `complet` (19 à
37 arêtes chacune) : **p50 +0,6 · −0,1 · 0,0 · −1,1 ; p90 +2,0 · +3,1 · +7,6 · +5,9 ;
max +3,7 · +10,1 · +25,5 · +22,0 niveaux sur 255.** La médiane est nulle (l'arête ne se
voit pas plus qu'un pixel de texture voisin) ; le p90 reste sous 8 niveaux ; les maxima
à 22–25 sont des arêtes qui passent sur un trait de côte (le témoin, 12 px plus loin,
ne le voit pas). ⚠️ Les captures portent des **barres orange** aux bords de tuiles
pendant le rechargement du socle (« REFINING ») — **présentes AVANT R37 dans les
captures `avant`**, hors de mon terrain (socle / parois) : elles sont écartées de la
mesure (pixels `r − b > 40`), sinon elles se lisaient comme des coutures de 45 à 58.

**Ce que la prélecture apporte, mesuré** : sur place → complet, le flou moyen passe de
5,8 % à 3,9 %, les images floues de 17,4 % à 5,8 %, le p90 de 17 % à 0, pour 581 → 610
requêtes (+5 %, dans le bruit des tirages). Sans le garde-fou du centre, la même
prélecture coûtait **738 requêtes (+28 %) et 24 Mio** pour 4,7 % de flou : prélire les
bords, c'est payer des tuiles qui sortent du champ en descendant. Sans le garde-fou du
crédit, `test/globe-eviction` (cache 600, saturé) relevait **×1,85 de requêtes** par vol
— le piège du socle, mesuré ici. Elle vaut la peine avec ses deux gardes ; sans elles,
non.

**Le repos** : `veille-repos` ⑦ passe (42 · 0) ; aucun correctif n'écrit la caméra
(`_descend` LIT `camPos.length()`).

## 4. LES TESTS

- `test/veille-repos.test.js` ⑦ **réécrit** : « le crop doit être dessiné par
  EXACTEMENT les mêmes tuiles » → **« chaque point du crop est dessiné exactement une
  fois, avec et sans le drapeau, et pas plus grossier »** (grille 24 × 24 dans le crop,
  masque de quadrant compris : `couvertureCrop`). « MI-CHARGEMENT : un seul enfant
  manquant garde le parent dessiné (règle sans-trou) » → **« MI-CHARGEMENT : un seul
  enfant manquant sur quatre — le parent reste dessiné SOUS lui, les trois autres
  dessinent (raffinement partiel, R37) »** : masque = le quadrant du manquant, sous
  chaque enfant prêt une seule tuile pas plus grossière que lui, sous le manquant le
  parent seul.
- `test/raffinement-partiel.test.js` (7 tests) : ① la découpe (chaque triangle dans le
  quadrant de son centroïde uv, jupe en dernier, ensemble des triangles inchangé) ;
  ② mi-chargement : groupes ↔ masque ↔ matériau, personne ne dessine deux fois, matériau
  entier à l'image suivante, levier débrayé = ancienne règle ; ③ **couverture sur un vrai
  réseau RETENU** (les réponses lâchées une par une, 40 images) : zéro trou, zéro doublon,
  parents partiels vus ; ④ le rechargement sur place (dessinée à chaque image du vol,
  maillage remplacé à l'arrivée, neuf visible, idempotent, hauteurs gardées) ; ④ bis
  `demanderEmprise` passe par lui ; ⑤ l'éviction ; ⑥ la prélecture (descente seule,
  centre seul, retrait de priorité, remontée = rien, débrayée = rien).
- `test/materiau-tuile.test.js` ⑤ : le compte de `libererMateriauTuile(this, t.mesh)`
  passe de 4 à 5 (`_jeterMaillage`).
- **Mutations** : parent partiel dessiné entier → ② rougit ; règle tout ou rien → ②, ③,
  ⑦ rougissent ; le flux jette le maillage → ④ bis rougit ; éviction sans le rang → ⑤
  rougit. (⑦ ne voit pas la première mutation : il lit le masque, pas les groupes — ② le
  couvre.)
- `package.json` : `test/raffinement-partiel.test.js` ajouté à la liste explicite.
  **`npm run audit:tests` : 254 listés · 254 sur disque, aucun écart.**
- **`npm test` : 4 762 tests · 4 760 réussis · 0 échec** (2 `todo`/`skip` préexistants).
  Base de cette branche : 4 755 ; la base 4 774 annoncée inclut GE2, qui n'est pas
  fusionné ici.

## 5. CE QUE J'AI CRU PUIS RÉFUTÉ

1. **« Adrien voit le parent étiré. »** C'était l'hypothèse du brief (levier 1 en tête).
   La vidéo montre un flou SANS geste, et le banc l'attribue à 63–72 % au recul. Le
   raffinement partiel seul ne rend que 13 → 9,4 % ; c'est le rechargement sur place
   qui tue le recul (100 % → 0).
2. **« C'est `_rechargeTuiles` (l'exagération qui change à chaque cran). »** Compté :
   **0** appel sur toutes les descentes — D10 (exagération constante) tient. Réfuté par
   le compteur, pas par la lecture.
3. **« C'est le cache souple qui évince la zone nette. »** Les tuiles DESSINÉES évincées :
   **0**. Le cache souple évince bien 181 tuiles en une image, mais APRÈS le recul, comme
   conséquence (les descendants ne sont plus porteurs). Le levier ③ n'est donc qu'un
   filet ; sans ②, il ne change rien (variante `partiel` : recul 100 %).
4. **« La prélecture est gratuite. »** +28 % de requêtes sans garde-fou du centre, ×1,85
   sur un cache saturé — exactement le §5 de `/threejs-optimisation`. Avec les deux
   gardes : +5 %, dans le bruit.
5. **« Un maillage neuf peut naître invisible, `update()` le rallumera. »** Vrai pour une
   tuile qui arrive (le parent couvrait) ; faux pour un remplacement sur place : la
   promesse se résout AVANT le rendu de l'image, et l'ancien vient d'être jeté — un
   trou d'une image. Vu au banc de test ④, corrigé par l'héritage de visibilité.
6. **« `refined = true` pour un parent partiel. »** Ça déplaçait l'hystérésis
   (`MERGE_RATIO`) et faisait diverger `dalles-crop` ⑧ (avec/sans drapeau : 277 contre
   268 tuiles). `refined` garde son sens d'avant.
7. **« Les trous max 16–22 points du premier relevé sont des trous. »** Tous à
   `uEstompage = 1` (le repos, hors crop) : rien ne se dessine là par dessein (Tâche N),
   et le relevé `avant` en avait autant. La sonde ne compte plus que la planète visible.
8. **« Les coutures à 45–58 niveaux sont le raffinement partiel. »** Ce sont les barres
   orange du socle en rechargement, présentes dans les captures `avant` au même cadrage.
9. **« Le p50 du flou est le chiffre à battre. »** Il vaut 0 partout, avant comme après :
   la moitié des images d'une descente sont nettes. Ce qui bouge est la moyenne (la
   surface × le temps), le p90 et la fraction d'images floues — les trois sont donnés.

## 6. CE QUI RESTE

- Les **barres orange** aux bords de tuiles pendant « REFINING » (socle / parois),
  visibles dans toutes les captures, avant comme après — pas mon terrain, signalé.
- Le max à 100 % à la naissance du crop (`poserCrop` prescrit z13 d'un coup à 32 km) :
  un retard d'un niveau sur tout l'écran pendant ~1 s, sans recul. Une prescription
  progressive (z12 puis z13) le lisserait — décision de produit, pas prise ici.
- Le fondu parent → enfant (levier 4) : non fait ; la couture médiane est nulle, il ne
  paierait rien de mesuré.
- Un rechargement sur place d'un parent PARTIEL renaît entier pour une image (les
  enfants sous lui dessinent deux fois cette image-là) — pas de trou, pas mesuré à
  l'écran, noté.

## 7. COMMITS

Sur `raffinement-partiel` : le raffinement partiel + rechargement sur place + éviction
+ prélecture avec ses tests et sondes, puis ce rapport (`git add -f`). Serveur de dev
6931 arrêté en partant.
