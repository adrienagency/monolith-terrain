# Globe continu et socle de proximité — plan d'implémentation

> **Pour les agents :** SOUS-COMPÉTENCE REQUISE : `superpowers:subagent-driven-development`. Cases à cocher (`- [ ]`).
> Chargez aussi, selon la tâche : `threejs-geometry` (Phase 2), `threejs-shaders` (Phase 3), `threejs-fundamentals` (Phase 1), `threejs-animation` (Phase 4).

**But :** remplacer la navigation par paliers de ShibuMap par une caméra continue de l'orbite au sol, sur laquelle un socle éditorial apparaît sous un seuil de proximité.

**Architecture :** le quadtree de `src/globe.js` — qui existe, streame déjà z2→z11 avec division/fusion, hystérésis et éviction LRU — devient la **seule** source de relief. Le bloc actuel cesse d'être une cuisson pour devenir une **fenêtre bornée** ouverte sur ce flux. Les statistiques globales restent calculées sur le cadre, mais **lissées dans le temps**.

**Pile :** three.js r172, WebGL2, Vite. Aucune nouvelle dépendance de rendu.

---

## Ce qui est validé, et qui ne se rediscute pas

Tranché avec Adrien le 2026-08-08. Un agent que l'une de ces lignes gêne le **signale** ; il ne la contourne pas.

1. **Une seule caméra**, de l'orbite au sol. Plus de paliers, plus de voile de chargement.
2. **Le globe est le mode par défaut.** Le socle apparaît sous un seuil de proximité et disparaît quand on remonte.
3. **Le socle suit le cadrage en continu** — son emprise géographique change avec la vue.
4. **Le socle complet apparaît d'un coup**, parois et dalle comprises, avec une transition à dessiner.
5. **La gravure des parois ne s'écrit qu'à l'arrêt de la caméra.**
6. **Forme neutre** : le format d'impression se choisit à l'export, pas pendant la navigation.
7. **Mer animée, météo, cycle du jour : en mode socle uniquement.** Le globe garde son rendu actuel.
8. **Les statistiques sont LISSÉES, pas rebasées sur le monde.** ⚠️ La raison est d'Adrien, et elle est juste : une rampe calée sur des références mondiales rendrait monochrome toute zone à faible dénivelé. La normalisation par cadre n'est pas un défaut, c'est ce qui rend chaque endroit lisible.
9. **Un GPX déposé fait voler la caméra jusqu'au tracé** et y pose le socle.
10. **Aucune obligation de compatibilité** avec les liens `#r=` existants : le site n'est pas diffusé. L'ancien moteur devient obsolète, les gabarits seront refaits. ⚠️ **Mais les tracés doivent rester exacts et bien positionnés.**
11. **Cible : 60 images/s sur un portable récent.** Le téléphone dégrade la portée et le détail ; il ne rame pas.
12. **Aucune cuisson mondiale nouvelle.** On navigue sur le relief, qui couvre déjà le monde en flux. Le sol et la canopée ne se cuisent qu'à la composition ; **la canopée se streame** quand l'utilisateur active l'option.

13. **Le flou pendant le mouvement est ACCEPTÉ.** Tranché par Adrien le 2026-08-20, après la mesure du prototype : « on garde le flou pendant qu'on bouge ».

⚠️ **Ce n'est pas une tolérance, c'est le contrat.** Pour ne jamais déchirer, la fenêtre attend une couverture complète au même zoom ; elle passe donc une partie du vol avec un niveau de retard — mesuré à **45 % du temps, cache réseau chaud**, donc dans le meilleur cas. Le rendu est net dès l'arrêt.

**Conséquence pour les agents : ne « corrigez » jamais ce flou.** C'est le comportement de Google Earth et celui que décrit Hoppe (« la charge de rendu diminue quand on va plus vite »). Quelqu'un le prendra pour un défaut de chargement et voudra forcer l'affichage du niveau fin avant qu'il soit complet — **c'est précisément ce qui ramène les déchirures**. Le seul réglage légitime porte sur la vitesse de rattrapage à l'arrêt, jamais sur l'attente pendant le mouvement.

## Deux règles ajoutées après l'état de l'art du 2026-08-08

Elles ne viennent pas d'Adrien : elles viennent de ce que d'autres ont payé avant nous. **Elles priment sur le confort d'implémentation.**

### R1 — Aucune décision de cadrage ne lit une grandeur dérivée du terrain chargé

⚠️ **C'est le piège le plus probable de tout ce plan.** Le choix du niveau de détail et le seuil du socle doivent se calculer sur des grandeurs **de caméra** — altitude au-dessus de l'ellipsoïde, distance au centre de la Terre — **jamais** sur la hauteur du sol chargé, ni sur `meanM`, ni sur quoi que ce soit qui bouge avec les statistiques lissées.

Sinon : `meanM` déplace le terrain verticalement → la distance caméra-sol change → la fraction d'écran change → le seuil et l'emprise changent → `meanM` change. Et comme les statistiques sont lissées, on ajoute un **retard**. Gain plus retard font un **oscillateur**, pas une boucle stable.

Le précédent est exact : le fil le plus long de Cesium sur le rechargement en boucle s'est terminé sur une altitude de caméra dérivée du terrain, instable aux frontières de tuiles. Deux ingénieurs y avaient d'abord répondu « impossible à éviter » et « augmentez le cache » — **les deux mauvaises réponses**, et celles vers lesquelles on glissera naturellement.

⚠️ L'hystérésis de la Tâche 3 protège d'**une** bascule qui clignote. Elle ne protège **pas** de cette boucle-là.

### R2 — Aucune tuile Google, jamais, nulle part

Les *Photorealistic 3D Tiles* de Google interdisent le cache, l'usage hors-ligne et la « geodata extraction or resale ». **Une affiche imprimée est une sortie hors-ligne dérivée et revendue.** Elles sont donc exclues de bout en bout, y compris pour un simple essai — parce qu'un essai finit par rester.

Ce qui est utilisable, licences vérifiées : **Mapterhorn** (code BSD-3, données CC BY 4.0, attribution déjà en place dans `dem-source.js`), **AWS Terrain Tiles** (domaine public), **Natural Earth** (domaine public), **GLOBathy** (CC0), **3DTilesRendererJS** (Apache-2.0).

---

## L'état des lieux, vérifié le 2026-08-08

⚠️ **Les repères de l'étude du 2026-07-29 ont bougé.** Ceux-ci sont à jour, relevés le jour de l'écriture :

| ce qui est décidé en regardant tout le bloc | où, aujourd'hui |
|---|---|
| le zéro vertical (`meanM`) | `src/terrain.js:2108`, `:2175` |
| le niveau de la dalle (`globalMin`) | `src/plinth.js:143`, `:148`, `:196` |
| **où est la mer** (diffusion depuis les bords) | `src/sea-mask.js:50`, `buildSeaMask` |
| la rampe de couleurs (quantiles p08/p50/p92) | `src/relief-grade.js:80`, `:127` |
| le peigné des crêtes (`robustScale`) | `src/terrain-analysis.js:152` |

**Elles sont CINQ et non six.** La hiérarchie relative des routes que citait l'étude n'existe plus — la couche a disparu du dépôt. Ne la cherchez pas.

**Ce qui existe déjà, et qu'on ne réécrit pas :**

- `src/globe.js` — quadtree z2→z11, `SPLIT_RATIO` 0,38 avec hystérésis, raffinement sans trous (un parent tient tant que ses quatre enfants ne sont pas prêts), LRU à 420 tuiles, six requêtes concurrentes.
- `src/coast-mask.js` — **rasterise déjà les polygones de côte Natural Earth du z4 au z15**, et `terrain.js:954` échantillonne déjà `uCoastMask`.
- Les pyramides de tuiles : `public/data/sol` et `canopee` (z8 et z9 **mondiaux**, ~3 Ko la tuile), `bathy` z4→z10, `lake-tiles` (`"world": true`), `coast-z6` (64 colonnes = grille complète).
- `src/flags.js` — le drapeau qui isolera les deux moteurs.
- Toute la chaîne d'export, les comptes, la boutique, le Race Studio, la publication.

---

## Structure des fichiers

| fichier | responsabilité |
|---|---|
| `src/monde/flux-terrain.js` **(créer)** | le quadtree promu en source unique de relief : demander une emprise, recevoir les tuiles prêtes |
| `src/monde/fenetre-bornee.js` **(créer)** | extraire de ce flux un maillage **fermé** — surface, parois, dalle — pour une emprise donnée |
| `src/monde/statistiques-lissees.js` **(créer)** | les quatre statistiques restantes, avec amortissement et zone morte |
| `src/monde/seuil-socle.js` **(créer)** | quand le socle naît et meurt — module pur, calculable sous node |
| `src/sea-mask.js` **(modifier)** | la côte mondiale devient l'autorité, dans les deux sens |
| `src/globe.js` **(modifier)** | descendre sous z11, exposer son cache au flux |
| `src/escalier-zoom.js` **(retirer en fin de parcours)** | les paliers n'existent plus |

---

## PHASE 0 — Ce qui vaut le coup quel que soit le sort du chantier

⚠️ **Ces deux tâches ne sont pas des préalables techniques : ce sont des paris couverts.** La première corrige un défaut visible aujourd'hui ; la seconde répond en un jour à la seule question qui peut tuer le projet. **Aucune ligne n'est perdue si on renonce ensuite.**

### Tâche 1 : la côte mondiale devient l'autorité, dans les deux sens

**Fichiers :** modifier `src/sea-mask.js`, `src/terrain.js` (autour de `:954`) · tester `test/sea-mask.test.js`, `test/coast-mask.test.js`

**Interfaces produites :**
- `buildSeaMask(dem, { seaLevelM, minBasinFrac, landMask, coteMondiale })` — un argument de plus, les autres inchangés
- `MER`, `TERRE`, `INDECIS` — les trois états exportés

**Le défaut, mesuré.** `buildSeaMask` décide où est la mer par **diffusion depuis les bords du cadre**, plus un rattrapage « grand bassin » à 2 % de la surface. Conséquence relevée par l'étude du 2026-07-29 : **la même cuvette est peinte en bleu quand elle touche le bord du socle, et en vert cent pixels plus loin.**

S'y ajoute une asymétrie relevée pendant l'enquête sur la mer du 2026-08-07 : **`uCoastMask` peut forcer la TERRE mais jamais la MER** — 223 cellules sur 5 184 à Bergen, 150 à Bora Bora, 89 à Brest, toutes des récifs et des fjords.

**Ce qu'on fait.** La côte Natural Earth, qui couvre le monde et que `coast-mask.js` sait déjà rasteriser du z4 au z15, devient autoritaire **dans les deux sens**. La diffusion depuis les bords ne subsiste qu'en repli, là où la côte vectorielle n'a rien à dire.

⚠️ **C'est la seule des cinq statistiques que le lissage ne peut PAS rattraper**, parce qu'elle est **binaire** : un bassin se remplit ou ne se remplit pas. Lisser un booléen donnerait un lac qui apparaît en fondu — pire qu'un saut. La retirer du lot est donc le préalable de la Phase 3, et c'est un gain visuel dès aujourd'hui sur le moteur actuel.

- [ ] **Étape 1 — écrire les deux tests qui échouent.** Premier : une cuvette fermée sous le niveau de la mer, à l'intérieur des terres selon la côte vectorielle, doit rester TERRE — qu'elle touche ou non le bord du cadre. Second, le témoin : un bras de mer que la diffusion n'atteint pas mais que la côte déclare mer doit devenir MER.
- [ ] **Étape 2 — les lancer, vérifier qu'ils échouent.** Le second doit échouer aujourd'hui : `uCoastMask` ne sait pas encore forcer la mer.
- [ ] **Étape 3 — implémenter.** Trois états au lieu de deux. La côte tranche `MER` et `TERRE` ; la diffusion ne décide plus que d'`INDECIS`.
- [ ] **Étape 4 — vérifier par mutation.** Neutraliser l'autorité de la côte : les deux tests doivent mourir. ⚠️ Une défense dont le test reste vert quand on la retire ne défend rien — c'est arrivé trois fois sur ce dépôt.
- [ ] **Étape 5 — regarder à l'écran.** Bergen, Bora Bora, Brest : les trois cas mesurés. Joindre ce qu'on voit, pas ce que le code devrait faire.
- [ ] **Étape 6 — `npm test` en entier, `node --check`, `npx vite build`, audit disque-vs-liste, puis commit.**

### Tâche 2 : le prototype jetable qui décide de tout

**Fichiers :** `prototype/` **hors du dépôt**. ⚠️ Pas dans `src/`, pas dans `test/`, pas dans `package.json`.

**La question, et il n'y en a qu'une :** peut-on extraire un **objet fermé** — surface, parois, dalle — d'un quadtree qui se raffine en permanence, à une emprise qui change en continu, **sans que l'objet se déchire pendant qu'on vole** ?

C'est le seul risque qui peut tuer le projet. Tout le reste est du travail.

- [ ] **Étape 1** — une page three.js nue : le quadtree de `src/globe.js` importé tel quel, une caméra libre, rien d'autre. Pas de mer, pas de palette, pas de gravure, pas de socle gravé.
- [ ] **Étape 2** — une emprise rectangulaire qu'on déplace et redimensionne à la souris, avec ses limites géographiques affichées en surimpression.
- [ ] **Étape 3** — en extraire une surface fermée : parois verticales et dalle. ⚠️ **Le point dur est la couture** : deux tuiles voisines n'ont pas la même densité de maillage, et une jupe mal fermée laisse voir le vide entre deux niveaux de détail. C'est exactement ce que `globe.js` évite déjà par son raffinement sans trous — lire comment il s'y prend avant d'inventer.
- [ ] **Étape 4** — voler. Traverser un massif, passer d'un océan à une côte, descendre de z6 à z13 sans s'arrêter, sur un portable récent.
- [ ] **Étape 5 — mesurer, et écrire le verdict** dans `.superpowers/sdd/prototype-fenetre-bornee.md` : images par seconde pendant le vol, nombre de déchirures visibles, **temps de reconstruction du maillage borné à chaque changement d'emprise**, et la réponse en une phrase.

**Le chiffre qui tranche :** si la reconstruction du maillage borné dépasse **~8 ms**, elle ne tient pas dans une image à 60 Hz et il faudra la différer — ce qui ramène au troisième choix qu'Adrien a écarté, « le socle se referme quand la caméra se pose ». **Il faut le savoir avant d'écrire la Phase 2, pas après.**

---

## PHASE 1 — La caméra continue

⚠️ **À n'entamer qu'une fois le verdict de la Tâche 2 rendu.**

### Tâche 3 : `seuil-socle.js` — quand le socle naît et meurt

**Fichiers :** créer `src/monde/seuil-socle.js` · tester `test/seuil-socle.test.js`

**Interfaces produites :**
- `socleVisible({ altitudeEllipsoideM, visibleAvant })` → `boolean`
- `SEUIL_NAISSANCE_M`, `SEUIL_MORT_M` → les deux altitudes, en mètres

⚠️ **L'ENTRÉE EST UNE ALTITUDE DE CAMÉRA AU-DESSUS DE L'ELLIPSOÏDE, PAS UNE FRACTION D'ÉCRAN.** Une première version de ce plan prenait `fractionEcran` — c'était **faux**, et c'est la règle R1 qui l'interdit : la fraction d'écran dépend de la distance au sol, donc du terrain chargé, donc de `meanM`, qui est lissé. On aurait fabriqué un oscillateur.

L'altitude au-dessus de l'ellipsoïde ne dépend **que** de la caméra. Elle est stable par construction, quel que soit l'état du chargement.

⚠️ **Le seuil DOIT aussi avoir une hystérésis**, et `SEUIL_MORT_M` doit être strictement supérieur à `SEUIL_NAISSANCE_M` (on naît en descendant, on meurt en remontant plus haut). Sans cet écart, une caméra posée pile sur la limite fait clignoter le socle. C'est le même défaut que `SPLIT_RATIO` / `MERGE_RATIO` a déjà résolu dans `globe.js` — reprendre ce patron, il est éprouvé sur ce dépôt.

⚠️ Mais l'hystérésis ne traite **que** le clignotement d'une bascule. Elle ne protège pas de la boucle R1 : seule l'entrée en altitude le fait.

Module pur : ni DOM, ni three.js, testable sous node — même discipline qu'`escalier-zoom.js`, qu'il remplace.

- [ ] **Étape 1** — écrire le test : en montant, le socle naît à `SEUIL_NAISSANCE` ; en redescendant, il ne meurt qu'à `SEUIL_MORT`. Puis le test qui compte : **osciller cent fois autour du seuil de naissance ne doit produire qu'une seule bascule.**
- [ ] **Étape 2** — le lancer, vérifier qu'il échoue.
- [ ] **Étape 3** — implémenter.
- [ ] **Étape 4** — vérifier par mutation : égaliser les deux seuils doit tuer le test d'oscillation.
- [ ] **Étape 5** — `npm test`, audit disque-vs-liste, commit.

### Tâche 3 bis : le repère relatif, AVANT de descendre

**Fichiers :** modifier `src/globe.js` (`_buildMesh`) · tester `test/globe-precision.test.js` (créer)

⚠️ **CETTE TÂCHE PASSE OBLIGATOIREMENT AVANT LA TÂCHE 4.** La faire après, c'est descendre dans une zone où le terrain tremble, chercher pourquoi, et remonter.

**Le chiffre.** `R_GLOBE = 100` (`src/geo.js:11`) place tous les sommets du globe à une magnitude où **le pas du float32 vaut 0,49 m au sol**. Or Mapterhorn sert du **0,42 m/pixel** à son zoom maximal — mesuré le 2026-08-08 : z17 à Chamonix, z15 pour le repli AWS. **Notre représentation s'épuise exactement là où la donnée s'arrête.**

Le précédent : deck.gl #7527, « casse à partir de z17 à cause du float32 », toujours ouverte.

**Le correctif :** un repère relatif au centre de la tuile (*relative-to-center*) dans `_buildMesh` — les positions des sommets sont exprimées depuis le centre de leur propre tuile, et la position mondiale vit dans la matrice de l'objet. Environ vingt lignes, **aucun changement de nuanceur**. La magnitude tombe de 100 à ~0,3, et le pas de 0,49 m à ~1 mm.

**FAIT le 2026-08-20, commit `150f817`.** Pas représentable : **0,486 m → 3,8 mm à z11, 1,9 mm à z13, 0,48 mm de z15 à z20**. Trois mutants sur quatre tués.

- [x] **Étape 1** — écrire le test.
- [x] **Étape 2** — le lancer, vérifier qu'il échoue.
- [x] **Étape 3** — implémenter le repère relatif.
- [x] **Étape 4** — vérifier par mutation.
- [x] **Étape 5** — regarder le globe de loin.
- [x] **Étape 6** — suite complète, build, audit, commit.

⚠️ **DEUX CORRECTIONS À CE PLAN, TROUVÉES EN L'EXÉCUTANT.**

**1. Le test que j'avais écrit ne mordait pas.** Je demandais : « deux sommets distants d'un mètre doivent avoir des positions distinctes en float32 ». Mesuré sur **33 345 paires** réparties sur le globe : **zéro** ne s'effondre — un écart de norme 1 m a toujours au moins une composante valant 1,19 pas représentable. **Cette assertion passe toujours, avant comme après, et ne prouve rien.**

Celle qui mord est l'écart **RESTITUÉ** : avant le correctif, un mètre était relu entre **0,687 m et 1,458 m** selon l'endroit du globe ; après, à 2·10⁻⁴ m près. **C'est la quantité qu'il faut mesurer — pas la distinction des positions, mais l'erreur sur la distance qu'on en relit.**

**2. L'origine se prend sur la surface DÉPLACÉE, pas sur le centre de la tuile.** À l'exagération 18 de production, un sommet à 8 848 m d'altitude se trouve à 2,5 unités du centre non déplacé — prendre `t.center` aurait laissé le pas à 1,5 cm au lieu de 0,48 mm. Le facteur mille se perd sur ce seul choix.

**Ce qui reste non vérifié :** aucune image en mouvement (le volet navigateur ne composite pas), rien au-delà de z11 à l'œil puisque `MAX_Z` tient toujours, et rien sur portable. Les gains z15–z20 sont prouvés par le calcul et le test, pas par l'œil.

### Tâche 4 : descendre le globe sous z11

**Fichiers :** modifier `src/globe.js` (`MAX_Z`, `CACHE_MAX`) · tester `test/globe-reseau.test.js`, `test/globe-eviction.test.js`

Le quadtree s'arrête à z11 parce qu'il ne servait qu'à la vue orbitale. Il doit descendre jusqu'aux zooms où vivent les blocs.

⚠️ **Vérifier d'abord jusqu'où les tuiles d'altitude existent réellement** chez AWS terrarium et chez mapterhorn. Descendre au-delà de la donnée disponible ne produit pas une erreur : ça produit des tuiles vides, donc un terrain plat, en silence. **Le mesurer, pas le supposer.**

⚠️ **`CACHE_MAX = 420` ne doit pas devenir un autre nombre : il doit devenir une FORMULE.** Il a été calibré pour un globe ; à des zooms fins, la même limite couvre une surface bien plus petite et l'éviction se met à battre — on recharge en boucle ce qu'on vient de jeter.

MapLibre ne tient pas un nombre mais une règle : **`niveaux_conservés × tuiles_visibles_dans_le_cadre`**, cinq niveaux par défaut. C'est ce qu'on reprend : la limite suit alors le cadrage au lieu d'être un chiffre à re-régler à chaque zoom.

⚠️ **Et l'ordre d'éviction compte autant que la taille.** 3DTilesRendererJS a corrigé trois bugs d'éviction en cinq mois, dont un où « le LRU pouvait faire recharger les tuiles en boucle », et a dû passer à **« le plus profond d'abord, puis le moins récent »**. Un LRU nu ne suffit pas.

⚠️ **Troisième piège, spécifique aux tuiles terrarium** : un bit du canal rouge vaut **256 mètres**. deck.gl #10400 (2025) rapporte des pics verticaux aléatoires **uniquement en http**, parce que le décodage passait alors par un worker ; ni `premultiplyAlpha:'none'` ni `colorSpaceConversion:'none'` n'ont suffi, il a fallu décoder le PNG à la main. **Si on déporte un jour le décodage dans un worker, c'est exactement là que ça mordra.**

⚠️ **Un dernier point sur le raffinement.** `globe.js` n'affiche un enfant que lorsque ses quatre frères sont prêts — c'est ce qui le rend sans trous, et c'est très bien à l'échelle du globe. Mais **Cesium a chiffré ce choix et l'a abandonné en profondeur** : il oblige à charger quatre tuiles quand on n'en a besoin que d'une. Leur remplacement (rendre le parent et découper au fragment ce qui déborde de l'enfant, plus le saut de niveaux) leur a rendu **32 % de vitesse et 33 % de données**. À garder en tête si le prototype montre que le chargement traîne en descente rapide — ne pas le changer avant.

---

## PHASES 2 à 6 — le détail viendra après le prototype

⚠️ **Ce n'est pas un oubli, c'est une décision.** Écrire des étapes minute par minute pour la semaine huit avant que la semaine une ait dit si l'approche tient, c'est fabriquer du travail à jeter. Ces phases sont ici avec leurs décisions et leurs pièges connus ; elles seront détaillées quand la Tâche 2 aura rendu son verdict.

**Phase 2 — la fenêtre bornée** (`src/monde/fenetre-bornee.js`). L'extraction du maillage fermé, promue du prototype vers le dépôt, **derrière un drapeau de `src/flags.js`**. ⚠️ Les deux moteurs devront **coexister à l'écran** pour être comparés : le drapeau reste en place longtemps, ce n'est pas un interrupteur temporaire.

### Ce que le prototype a tranché, le 2026-08-20

**Verdict : l'objet tient.** Zéro déchirure sur 45 s de vol de z6 à z13, prouvée par 231 audits topologiques et 231 tests d'étanchéité en espace écran.

⚠️ **ET LA RAISON COMPTE PLUS QUE LE VERDICT : ON NE COUD PAS LES TUILES.** Le plan nommait « la couture » comme point dur — le T-junction, deux tuiles voisines de densités différentes. **Cette difficulté n'existe que si l'on essaie de DÉCOUPER le maillage du quadtree à l'emprise.** Le prototype fait autre chose : il construit une grille régulière propre à la fenêtre et va **chercher** la hauteur dans le cache de tuiles, en coordonnées de pixel global.

La topologie devient alors **fixe** : les indices sont calculés une fois, les sommets hauts des parois **sont** les sommets de bord de la surface, la dalle s'appuie sur le même anneau bas. Un trou devient topologiquement impossible — **il n'y a pas de T-junction parce qu'il n'y a pas de jonction.** C'est la décision d'architecture de toute la Phase 2 ; ne pas la reperdre.

### Le budget, et la stratégie à deux résolutions

| résolution | médiane | images > 8 ms |
|---|---|---|
| N = 256 (celle de `plinth.js`) | **7,2 ms** | **12 %** |
| N = 128 | **2,2 ms** | 3,9 % |

⚠️ **Mesuré sur RTX 3080 et 24 cœurs — très au-dessus de la cible « portable récent ».** Et c'est un **plancher** : ni mer, ni palette, ni gravure, ni statistiques lissées.

**Donc N = 256 à chaque image ne tient pas sur la cible.** La décision 4 d'Adrien — « le socle complet tout de suite » — reste tenable, mais **à deux résolutions** : N = 128 tant que la caméra bouge, N = 256 quand elle se pose. Plus une **zone morte** sur l'emprise : le prototype reconstruisait à *chaque* image, ce qui est le pire cas ; en pratique le cadrage ne change pas assez pour le justifier.

### Les deux pièges que le prototype a découverts

⚠️ **La règle sans trous n'échoue pas en déchirant : elle échoue en RETARDANT.** Pour ne pas déchirer, la fenêtre attend une couverture complète au même zoom — elle passe **45 % du vol avec un niveau de retard** (retard moyen 1,08), **cache réseau chaud**, donc dans le meilleur cas. Ce n'est pas un artefact, c'est du **flou**.

C'est exactement le comportement que décrit Hoppe (« rendering load actually decreases as the viewer moves faster ») et celui de Google Earth. **Mais il faut qu'Adrien sache que « fluide » voudra dire « flou pendant qu'on bouge », et net à l'arrêt.** Ce n'est pas un défaut à corriger, c'est le contrat à annoncer.

⚠️ **L'audit topologique valide un solide RETOURNÉ.** Au premier jet, les parois et la dalle étaient enroulées à l'envers, le socle était grand ouvert — et l'audit d'arêtes annonçait « 0 bord libre », **à juste titre**. Seul un test de silhouette avant/arrière l'a vu. Puis ce test est passé **à vide**, l'objet étant hors cadre, et tout a dû être remesuré avec une preuve de non-vacuité. **Un audit d'arêtes ne prouve pas qu'un solide est fermé dans le bon sens, et un test de silhouette ne prouve rien s'il ne prouve pas d'abord qu'il regarde quelque chose.**

### Les tâches de la Phase 2, maintenant que la question est tranchée

**Tâche 5 — `src/monde/fenetre-bornee.js`, l'extraction.**
Promouvoir le rééchantillonnage du prototype : une grille régulière propre à la fenêtre, alimentée par le cache de tuiles en coordonnées de pixel global. ⚠️ **Ne pas repartir du découpage du maillage du quadtree** — c'est le chemin que le prototype a écarté, et c'est celui qui ramène la jonction en T.
**Interfaces produites :** `construireFenetre({ emprise, n })` → `{ geometrie, indices, boiteEnglobante }` · `majHauteurs(fenetre, cacheTuiles)` → `void`

**Tâche 6 — les deux résolutions et la zone morte.**
N = 128 pendant que la caméra bouge, N = 256 quand elle se pose. Plus un seuil sous lequel un changement d'emprise ne déclenche **aucune** reconstruction. ⚠️ Le prototype reconstruisait à chaque image : c'est le pire cas, et c'est ce qui donne les 12 % de dépassement. La zone morte est ce qui rend la décision 4 tenable sur la cible.
**Interfaces produites :** `resolutionPour({ enMouvement })` → `128 | 256` · `empriseADerive(precedente, courante)` → `boolean`

**Tâche 7 — l'audit qui ne se laisse pas berner.**
⚠️ **Reprendre l'audit du prototype en corrigeant ses deux failles connues**, qui sont documentées et reproductibles :
1. Un audit d'arêtes annonce « 0 bord libre » sur un **solide retourné** — parois enroulées à l'envers, socle grand ouvert. Il faut donc un test d'**orientation**, pas seulement de fermeture.
2. Un test de silhouette passe **à vide** si l'objet est hors cadre. Il faut donc **prouver d'abord qu'on regarde quelque chose** — une assertion de non-vacuité avant toute assertion d'étanchéité.

**Ces deux failles ont réellement trompé le prototype.** Un test qui ne peut pas échouer ne prouve rien, et ces deux-là passaient en beauté.

### Ce que le prototype n'a PAS pu vérifier

- **Aucune image en mouvement n'a été vue** : le volet navigateur ne composite pas. On ne sait donc pas si le changement de zoom effectif — toute la surface bascule d'un coup — se lit comme un saut désagréable. ⚠️ **À regarder en premier en Phase 2.**
- Rien n'a été mesuré sur un portable.
- Le cache est resté saturé à 420 du début à la fin : le battement d'éviction que redoute la Tâche 4 n'est pas chiffré.
- **La précision confirme la Tâche 3 bis** : float32 va bien à z13 (0,34 m pour un texel de 13,3 m), mais le quantum est fixe à 0,49 m — à z15 il vaut 15 % d'un texel, **et les tuiles existent jusque-là**.

**Phase 3 — les statistiques lissées** (`src/monde/statistiques-lissees.js`). Les quatre restantes après la Tâche 1 : `meanM`, `globalMin`, les quantiles de rampe, `robustScale`. ⚠️ **C'est de l'auto-exposition**, exactement comme sur un appareil photo — et comme elle, il lui faut une **zone morte**, sinon la vue dérive en permanence sur des variations insignifiantes.

**Phase 4 — la transition et le vol.** La bascule globe → socle avec son effet, à dessiner avec Adrien. Le vol de la caméra vers un GPX déposé. ⚠️ **Le vol ne doit pas devenir le nouveau temps de chargement** : c'est précisément ce qu'on supprime. Le mesurer comme tel.

⚠️ **ET LA TRANSITION N'EST PEUT-ÊTRE PAS QU'UN EFFET.** C'est la trouvaille la plus utile de l'état de l'art : il n'existe aucune source primaire sur le mécanisme globe → terrain de Google Earth, mais **MapLibre publie le sien**. Ils **changent de projection vers z12**, et cachent la bascule dans une zone où globe et Mercator coïncident, pilotée par un unique uniforme `globeness` — **précisément parce que le float32 ne donne qu'une valeur tous les 2,5 mètres**.

Autrement dit : chez eux, le fondu n'est pas une décoration, **c'est le mécanisme**. Si notre transition doit elle aussi masquer un changement de repère, elle doit être conçue avec cette contrainte, pas dessinée d'abord et branchée ensuite.

**Phase 5 — les données.** La canopée en flux à l'activation de l'option, plus **GLOBathy** pour la profondeur des lacs (1,4 million de plans d'eau, pixel de 30 m, licence **CC0**). ⚠️ Ces profondeurs sont **modélisées**, validées sur 1 503 lacs sur 1,4 million : à mentionner quelque part si on les affiche.

**Phase 6 — la dépose de l'ancien.** Retrait d'`escalier-zoom.js` et des paliers, nouveau format de partage, reprise des gabarits. ⚠️ **Une partie des 3 037 tests verrouille précisément les statistiques par bloc qu'on vient de débrancher. Ils devront être relus un par un** — travail lent, ingrat, et que les agents n'accélèrent pas.

---

## Ce qu'Adrien doit trancher en chemin

- **L'effet de transition** globe → socle : à dessiner ensemble, Phase 4.
- **La récupération de GLOBathy** : le catalogue Earth Engine impose un compte et des conditions commerciales à vérifier ; le dépôt de l'article est peut-être la meilleure porte.
- **Le sort des cartes déjà publiées** : il a dit qu'il n'y avait pas d'obligation. À confirmer avant de casser le format de partage — c'est irréversible pour les liens en circulation.

## Auto-revue

**Couverture :** les douze décisions validées ont chacune leur tâche ou leur phase.

**Non couvert, et assumé :** le détail minute par minute des Phases 2 à 6, pour la raison écrite plus haut.

**Cohérence des noms :** `socleVisible`, `SEUIL_NAISSANCE`, `SEUIL_MORT`, `buildSeaMask`, `MER`/`TERRE`/`INDECIS` sont employés à l'identique partout dans ce document.

**Le risque principal :** la Tâche 2. Si le maillage borné ne tient pas pendant le vol, la décision 4 — « le socle complet tout de suite » — tombe, et il faut revenir au socle qui se referme à l'arrêt de la caméra. **C'est pour ça qu'elle passe en premier.**
