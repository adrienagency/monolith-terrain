# Globe continu et socle de proximité — plan d'implémentation

> **Pour les agents :** SOUS-COMPÉTENCE REQUISE : `superpowers:subagent-driven-development`. Cases à cocher (`- [ ]`).
> Chargez selon la tâche : `threejs-geometry` (Phase 2), `threejs-shaders` (Phase 3), `threejs-fundamentals` (Phase 1), `threejs-animation` (Phase 4), et **`anthropic-skills:three-doctor` avant tout commit qui touche la boucle de rendu**.

**But :** remplacer la navigation par paliers de ShibuMap par une caméra continue de l'orbite au sol, sur laquelle un socle éditorial apparaît sous un seuil de proximité.

**Architecture :** le quadtree de `src/globe.js` devient la seule source de relief. Le bloc cesse d'être une cuisson pour devenir une **fenêtre bornée** ouverte sur ce flux. ⚠️ **On ne découpe pas le maillage du quadtree : on rééchantillonne son cache dans une grille propre à la fenêtre.** Les statistiques globales restent calculées sur le cadre, mais lissées dans le temps.

**Pile :** three.js r172, WebGL2, Vite. Aucune nouvelle dépendance de rendu.

**Version :** réécriture complète du 2026-08-20, après le prototype et son attaque. Les versions précédentes contenaient trois chiffres faux et un test qui ne mordait pas.

---

## 1. Les treize décisions validées

Tranchées avec Adrien. Un agent que l'une d'elles gêne le **signale** ; il ne la contourne pas.

1. **Une seule caméra**, de l'orbite au sol. Plus de paliers, plus de voile de chargement.
2. **Le globe est le mode par défaut.** Le socle apparaît sous un seuil de proximité et disparaît quand on remonte.
3. **Le socle suit le cadrage en continu** — son emprise géographique change avec la vue.
4. **Le socle complet apparaît d'un coup**, parois et dalle comprises, avec une transition à dessiner.
5. **La gravure des parois ne s'écrit qu'à l'arrêt de la caméra.**
6. **Forme neutre** : le format d'impression se choisit à l'export.
7. **Mer animée, météo, cycle du jour : en mode socle uniquement.**
8. **Les statistiques sont LISSÉES, pas rebasées sur le monde.** ⚠️ Raison d'Adrien, et elle est juste : une rampe calée sur des références mondiales rendrait monochrome toute zone à faible dénivelé. La normalisation par cadre est ce qui rend chaque endroit lisible.
9. **Un GPX déposé fait voler la caméra jusqu'au tracé** et y pose le socle.
10. **Aucune obligation de compatibilité** avec les liens `#r=` existants. ⚠️ **Mais les tracés doivent rester exacts et bien positionnés.**
11. **Cible : 60 images/s sur un portable récent.** Le téléphone dégrade portée et détail ; il ne rame pas.
12. **Aucune cuisson mondiale nouvelle.** Le sol et la canopée ne se cuisent qu'à la composition ; **la canopée se streame** à l'activation de l'option.
13. **Le flou pendant le mouvement est ACCEPTÉ**, et net dès l'arrêt.

⚠️ **La décision 13 est un contrat, pas une tolérance.** Quelqu'un prendra ce flou pour un défaut de chargement et voudra afficher le niveau fin avant qu'il soit complet — **c'est précisément ce qui ramène les déchirures**. Le seul réglage légitime porte sur la vitesse de rattrapage à l'arrêt.

---

## 2. Les trois règles d'architecture

Elles ne viennent pas d'Adrien : elles viennent de ce que d'autres ont payé. **Elles priment sur le confort d'implémentation.**

### R1 — Aucune décision de cadrage ne lit une grandeur dérivée du terrain chargé

Le choix du niveau de détail et le seuil du socle se calculent sur des grandeurs **de caméra** — altitude au-dessus de l'ellipsoïde — **jamais** sur la hauteur du sol chargé, ni sur `meanM`, ni sur rien qui bouge avec les statistiques lissées.

Sinon : `meanM` déplace le terrain → la distance au sol change → le seuil et l'emprise changent → `meanM` change. Et comme les statistiques sont lissées, on ajoute un **retard**. Gain plus retard font un **oscillateur**.

⚠️ Le précédent est exact : le fil le plus long de Cesium sur le rechargement en boucle s'est terminé sur une altitude de caméra dérivée du terrain. Deux ingénieurs y avaient d'abord répondu « impossible à éviter » et « augmentez le cache » — **les deux mauvaises réponses**, et celles vers lesquelles on glissera.

### R2 — Aucune tuile Google, jamais, nulle part

Les *Photorealistic 3D Tiles* interdisent le cache, l'usage hors-ligne et la « geodata extraction or resale ». **Une affiche imprimée est une sortie hors-ligne dérivée et revendue.** Exclues de bout en bout, essais compris — parce qu'un essai finit par rester.

Utilisable, licences vérifiées : **Mapterhorn** (BSD-3 / CC BY 4.0, attribution déjà en place), **AWS Terrain Tiles** (domaine public), **Natural Earth** (domaine public), **GLOBathy** (CC0), **3DTilesRendererJS** (Apache-2.0).

### R3 — La descente est bornée par ce que le réseau soutient

⚠️ **Règle ajoutée après l'attaque du 2026-08-20**, et elle est neuve.

Mesuré : à froid, le zoom effectif **plafonne à z11 sur 12 Mb/s et z9 sur 4 Mb/s** au lieu de z13, avec **83 % des images en retard** et un retard moyen de **3,67 niveaux**. À z9 un texel vaut 213 m — **dix-sept texels sur toute la largeur du socle**.

Ce n'est plus le flou accepté par la décision 13 : **c'est une autre carte**. La caméra ne doit donc pas pouvoir descendre plus vite que le flux ne suit, sinon elle arrive dans un endroit qu'elle ne peut pas montrer.

---

## 3. L'état des lieux, mesuré

### Les cinq statistiques calculées sur le cadre

⚠️ **Les repères de l'étude du 2026-07-29 avaient bougé.** Ceux-ci ont été relevés le 2026-08-08.

| ce qui est décidé en regardant tout le cadre | où |
|---|---|
| le zéro vertical (`meanM`) | `src/terrain.js:2108`, `:2175` |
| le niveau de la dalle (`globalMin`) | `src/plinth.js:143`, `:148`, `:196` |
| où est la mer | `src/sea-mask.js:50` — **traitée, voir §4** |
| la rampe de couleurs (p08/p50/p92) | `src/relief-grade.js:80`, `:127` |
| le peigné des crêtes (`robustScale`) | `src/terrain-analysis.js:152` |

**Elles sont CINQ et non six.** La hiérarchie relative des routes que citait l'étude n'existe plus — la couche a disparu du dépôt. **Ne la cherchez pas.**

### Ce qui existe et qu'on ne réécrit pas

- `src/globe.js` — quadtree z2→z11, `SPLIT_RATIO` 0,38 avec hystérésis, raffinement sans trous, LRU, six requêtes concurrentes.
- `src/coast-mask.js` — rasterise les polygones Natural Earth du z4 au z15.
- Les pyramides : `sol` et `canopee` (z8/z9 **mondiaux**, ~3 Ko/tuile), `bathy` z4→z10, `lake-tiles` (`world: true`), `coast-z6` (grille complète).
- `src/flags.js` — le drapeau qui isolera les deux moteurs.
- Toute la chaîne d'export, les comptes, la boutique, le Race Studio.

---

## 4. Ce qui est DÉJÀ FAIT

### ✅ La côte mondiale fait autorité — `1465731`

La côte Natural Earth tranche `MER` et `TERRE` ; la diffusion depuis les bords ne décide plus que d'`INDECIS`. Six mutants, six tués.

**Mesuré :** +13 162 cellules de mer à Bergen, +8 889 à Brest, +889 à Bora Bora, **zéro perdue** — têtes de fjord, chenaux derrière un seuil, passes entre les motu.

⚠️ **Et une découverte qui périme une prémisse de l'étude de juillet** : la cuvette « bleue au bord, verte cent pixels plus loin » **ne peut plus se voir**. Depuis la mer v6, le trait de côte prend déjà toute la décision entre z4 et z15. Le gain n'est donc pas visuel aujourd'hui — il est structurel pour la Phase 3.

### ✅ Le champ mort n'est plus cuit — `e73de50`

Entre z4 et z15, le masque de mer était construit et **jamais lu** : `seaMask` n'apparaît qu'à trois lignes du nuanceur, et son unique lecture est dans la branche que le trait de côte court-circuite.

**Mesuré :** recuisson d'un bloc de Brest z13, **37,1 ms → 0** ; à l'échelle de l'atlas 3×3, **226 ms → 0**, plus 5,06 Mo qui ne partent plus au travailleur.

⚠️ **La PREMIÈRE cuisson subsiste** — elle est réellement lue pendant l'attente du trait de côte et sur un échec de chargement. Ce qui disparaît, ce sont toutes les suivantes.

**La vérification à citer en exemple :** cinq rendus du même bloc — masque réel, tout-terre, tout-mer, masque éteint, masque réel — **un seul et même hachage sur tous les pixels**, plus un contrôle prouvant que la vérification mord.

### ✅ Le repère relatif — `150f817`

**Pas représentable : 0,486 m → 3,8 mm à z11, 1,9 mm à z13, 0,48 mm de z15 à z20.** Trois mutants sur quatre tués.

**La mesure qui parle :** avant, un écart d'un mètre était relu **entre 0,687 m et 1,458 m** selon l'endroit du globe. Après : à 2·10⁻⁴ m près.

⚠️ **Deux corrections à ce plan, trouvées en l'exécutant :**

1. **Le test que j'avais spécifié ne mordait pas.** « Deux sommets distants d'un mètre doivent être distincts en float32 » : sur **33 345 paires**, **zéro** ne s'effondre — un écart de norme 1 m a toujours une composante ≥ 1,19 pas représentable. **Cette assertion passe toujours.** Celle qui mord est l'écart **RESTITUÉ**.
2. **L'origine se prend sur la surface DÉPLACÉE**, pas sur le centre de la tuile. À l'exagération 18, un sommet à 8 848 m est à 2,5 unités du centre non déplacé : prendre `t.center` aurait laissé le pas à 1,5 cm. **Le facteur mille tient à ce seul choix.**

### ✅ Le prototype a répondu, et l'attaque l'a corrigé

**Verdict géométrique : l'objet tient.** Huit trajets — antiméridien, pôle, archipel, côte découpée, rotation rapide, dézoom brutal, téléportation — **aucun NaN, aucun triangle dégénéré, aucun trou**.

⚠️ **LA DÉCISION D'ARCHITECTURE, ET ELLE COMMANDE TOUTE LA PHASE 2 : ON NE COUD PAS LES TUILES.** La couture — le T-junction — n'existe que si l'on essaie de **découper** le maillage du quadtree à l'emprise. On construit une grille régulière propre à la fenêtre et on va **chercher** la hauteur dans le cache, en coordonnées de pixel global. La topologie devient **fixe** : les sommets hauts des parois **sont** les sommets de bord de la surface, la dalle s'appuie sur le même anneau bas. **Il n'y a pas de T-junction parce qu'il n'y a pas de jonction.**

**Mais trois des quatre chiffres du prototype étaient optimistes** — corrigés par l'attaque, confiance **6/10** :

| | prototype | attaque |
|---|---|---|
| reconstruction, médiane, N=256 | 7,2 ms | **8,3 ms** — au-dessus du seuil **à la médiane** |
| retard de zoom, cache chaud | 45 % | **64 %** |
| retard de zoom, à froid | non mesuré | **83 %**, moyenne 3,67 niveaux, p90 à 10 |
| zoom atteint | z13 | **z11 à 12 Mb/s, z9 à 4 Mb/s** |
| battement d'éviction | « non observé » | **10 829 décodages** pour un cache de 420, en un vol |
| N = 128 | 2,2 ms | **1,7 ms** — la stratégie à deux résolutions est confirmée |

Les 7,2 ms excluaient 1,10 ms de téléversement de sommets (1,54 Mo/image) et ~2,5 ms de décodage en microtâche.

⚠️ **ET L'APPAREIL DE PREUVE DU PROTOTYPE NE VALAIT PRESQUE RIEN.** À lire avant d'écrire le moindre test de la Phase 2 :

- Les « 231 audits topologiques » étaient **un seul** : ils portent sur `this.indices`, écrit une fois au constructeur.
- Le test d'étanchéité n'utilisait **qu'un angle**, sous lequel il ne voit ni une dalle retournée — *le bug même qu'il dit avoir attrapé* — ni une dalle absente, ni un mur entier manquant.
- **Un trou de 128×128 mailles — 1,78 km de côté, la moitié de la fenêtre — rendait 0 pixel de trou**, parce qu'à l'exagération 18 le socle devient une aiguille 10,6:1 occupant 0,66 % du cadre.
- Un audit d'arêtes annonce « 0 bord libre » sur un **solide retourné**, à juste titre.
- Un test de silhouette passe **à vide** si l'objet est hors cadre.

**Remplacement validé par l'attaque :** volume signé recentré + dégénérés + NaN, **6 sabotages détectés sur 6**, ~10 ms, **sans rendu**.

---

## 5. Structure des fichiers

| fichier | responsabilité |
|---|---|
| `src/monde/flux-terrain.js` **(créer)** | le quadtree en source unique : demander une emprise, recevoir les tuiles — **avec plafond, annulation et éviction des `loading`** |
| `src/monde/fenetre-bornee.js` **(créer)** | extraire un maillage fermé par **rééchantillonnage**, jamais par découpe |
| `src/monde/audit-solide.js` **(créer)** | volume signé, dégénérés, NaN — l'audit qui ne se laisse pas berner |
| `src/monde/statistiques-lissees.js` **(créer)** | les quatre statistiques restantes, amorties, avec zone morte |
| `src/monde/seuil-socle.js` **(créer)** | naissance et mort du socle, sur une **altitude de caméra** |
| `src/globe.js` **(modifier)** | descendre sous z11, cache en formule |
| `src/escalier-zoom.js` **(retirer en fin de parcours)** | les paliers n'existent plus |

---

## 6. PHASE 1 — Le flux et la caméra

### Tâche 4 bis : LE FLUX QUI NE SE COINCE PAS ⚠️ EN PREMIER

**Fichiers :** créer `src/monde/flux-terrain.js` · modifier `src/globe.js` · tester `test/flux-terrain.test.js`

**Interfaces produites :**
- `demanderEmprise(flux, { emprise, zoom })` → `void`
- `tuilesPretes(flux, emprise)` → `Map`
- `PLAFOND_EN_VOL` → nombre maximal de requêtes simultanées

**Le défaut, mesuré par l'attaque.** Un panoramique latéral à 4 km d'altitude, 90° de balayage : **2 943 tuiles bloquées en `loading`**, crédit à −2 551, **zoom effectif figé à z2**, **aucune récupération après 30 s d'immobilité**. Une traversée suffit pour que le vol suivant reste à z2.

**Trois causes, trois corrections :**
1. Les requêtes ne sont **pas plafonnées**.
2. Elles ne sont **jamais annulées** quand le cadrage a changé.
3. `_evictJusqua` n'évince que les tuiles `ready` — **une tuile `loading` occupe une entrée pour toujours**, et le cache se remplit de fantômes.

⚠️ **C'est l'interface que le prototype proposait telle quelle pour la Phase 2.**

- [ ] **Étape 1** — écrire le test qui échoue : **un panoramique latéral à basse altitude**, pas une descente. ⚠️ C'est le geste le plus banal de l'application, et celui que le vol de référence ne pouvait pas voir : dans une descente lisse, deux images consécutives demandent presque les mêmes tuiles. Assertion : après 90° de balayage puis 5 s d'immobilité, le nombre de tuiles `loading` revient sous `PLAFOND_EN_VOL` et le zoom effectif rejoint le zoom demandé.
- [ ] **Étape 2** — le lancer, vérifier qu'il échoue (zoom figé, file saturée).
- [ ] **Étape 3** — implémenter les trois corrections.
- [ ] **Étape 4** — vérifier par mutation : retirer le plafond, puis l'annulation, puis l'éviction des `loading` — **chacune doit tuer un test**.
- [ ] **Étape 5** — mesurer le battement : nombre de décodages complets sur un vol de référence. ⚠️ L'attaque en a compté **10 829 pour un cache de 420** ; donner le chiffre après.
- [ ] **Étape 6** — `npm test`, `node --check`, `npx vite build`, audit disque-vs-liste, commit.

### Tâche 3 : `seuil-socle.js` — quand le socle naît et meurt

**Fichiers :** créer `src/monde/seuil-socle.js` · tester `test/seuil-socle.test.js`

**Interfaces produites :**
- `socleVisible({ altitudeEllipsoideM, visibleAvant })` → `boolean`
- `SEUIL_NAISSANCE_M`, `SEUIL_MORT_M`

⚠️ **L'ENTRÉE EST UNE ALTITUDE DE CAMÉRA AU-DESSUS DE L'ELLIPSOÏDE, PAS UNE FRACTION D'ÉCRAN.** Règle R1. Une fraction d'écran dépend de la distance au sol, donc du terrain chargé, donc de `meanM`, qui est lissé — on fabriquerait un oscillateur.

⚠️ **Hystérésis obligatoire** : `SEUIL_MORT_M` strictement supérieur à `SEUIL_NAISSANCE_M`. Même patron que `SPLIT_RATIO` / `MERGE_RATIO` dans `globe.js`, éprouvé sur ce dépôt.

- [ ] **Étape 1** — test : en descendant, le socle naît à `SEUIL_NAISSANCE_M` ; en remontant, il ne meurt qu'à `SEUIL_MORT_M`. Puis celui qui compte : **osciller cent fois autour du seuil de naissance ne produit qu'une seule bascule**.
- [ ] **Étape 2** — le lancer, vérifier qu'il échoue.
- [ ] **Étape 3** — implémenter.
- [ ] **Étape 4** — mutation : égaliser les deux seuils tue le test d'oscillation.
- [ ] **Étape 5** — `npm test`, audit, commit.

### Tâche 4 : descendre le globe sous z11

**Fichiers :** modifier `src/globe.js` (`MAX_Z`, `CACHE_MAX`) · tester `test/globe-reseau.test.js`, `test/globe-eviction.test.js`

⚠️ **Le repère relatif (`150f817`) est un préalable, et il est fait.** Sans lui, on descendrait dans une zone où le terrain tremble.

⚠️ **Vérifier jusqu'où les tuiles existent réellement** chez AWS terrarium et mapterhorn. Descendre au-delà ne produit pas une erreur : ça produit des tuiles vides, donc un terrain plat, **en silence**. Mesuré le 2026-08-08 : z17 à Chamonix chez Mapterhorn, z15 pour le repli AWS.

⚠️ **`CACHE_MAX = 420` ne doit pas devenir un autre nombre : il doit devenir une FORMULE.** MapLibre tient `niveaux_conservés × tuiles_visibles_dans_le_cadre`, cinq niveaux par défaut. La limite suit alors le cadrage au lieu d'être un chiffre à re-régler.

⚠️ **L'ordre d'éviction compte autant que la taille.** 3DTilesRendererJS a corrigé trois bugs d'éviction en cinq mois, dont un où « le LRU pouvait faire recharger les tuiles en boucle », et a dû passer à **« le plus profond d'abord, puis le moins récent »**.

⚠️ **Piège terrarium** : un bit du canal rouge vaut **256 mètres**. deck.gl #10400 rapporte des pics verticaux aléatoires **uniquement en http**, parce que le décodage passait par un worker ; ni `premultiplyAlpha:'none'` ni `colorSpaceConversion:'none'` n'ont suffi, il a fallu décoder le PNG à la main.

⚠️ **Le raffinement sans trous coûte cher en profondeur.** Cesium l'a chiffré et abandonné : il oblige à charger quatre tuiles quand on n'en a besoin que d'une. Leur remplacement — rendre le parent, découper au fragment, sauter des niveaux — leur a rendu **32 % de vitesse et 33 % de données**. À garder en réserve ; **ne pas le changer avant que la Tâche 4 bis ait mesuré**.

- [ ] **Étape 1** — mesurer la profondeur réelle des deux sources, et l'écrire dans le code.
- [ ] **Étape 2** — test : à `MAX_Z`, une tuile demandée hors de la couverture rend un état explicite, **jamais un terrain plat silencieux**.
- [ ] **Étape 3** — remplacer `CACHE_MAX` par la formule ; test sur un cadrage large puis serré.
- [ ] **Étape 4** — tri d'éviction : profondeur d'abord, récence ensuite. Test : un vol de référence ne redécode pas une tuile déjà décodée dans la même seconde.
- [ ] **Étape 5** — mutation sur les trois.
- [ ] **Étape 6** — `npm test`, `node --check`, `npx vite build`, audit, commit.

### Tâche 4 ter : la descente bornée par le réseau — règle R3

**Fichiers :** créer `src/monde/descente-bornee.js` · tester `test/descente-bornee.test.js`

**Interfaces produites :** `zoomSoutenable({ debitObserveMbs, zoomDemande })` → `number`

Mesuré : à froid, le zoom effectif plafonne à **z11 sur 12 Mb/s, z9 sur 4 Mb/s**. À z9 un texel vaut 213 m — **dix-sept texels sur la largeur du socle**. Ce n'est pas le flou de la décision 13, **c'est une autre carte**.

- [ ] **Étape 1** — test : à débit observé faible, `zoomSoutenable` rend un zoom inférieur au demandé, et la caméra ne descend pas plus vite que lui.
- [ ] **Étape 2** — le lancer, vérifier qu'il échoue.
- [ ] **Étape 3** — implémenter. ⚠️ **Le débit s'observe, il ne se devine pas** : mesurer les octets réellement reçus par seconde, pas `navigator.connection`, qui ment et n'existe pas partout.
- [ ] **Étape 4** — mutation.
- [ ] **Étape 5** — `npm test`, audit, commit.

---

## 7. PHASE 2 — La fenêtre bornée

### Tâche 5 : `audit-solide.js` ⚠️ AVANT `fenetre-bornee.js`

**Fichiers :** créer `src/monde/audit-solide.js` · tester `test/audit-solide.test.js`

**Interfaces produites :** `auditerSolide(geometrie)` → `{ ferme, oriente, degeneres, nan }`

⚠️ **Il passe en premier parce que sans lui, on n'a aucun moyen de savoir si la Tâche 6 marche.** Le prototype s'est cru étanche pendant tout son vol avec un instrument aveugle.

**Ce qu'il doit détecter, et que l'ancien ratait :**
- un **solide retourné** — parois enroulées à l'envers, socle grand ouvert : un audit d'arêtes dit « 0 bord libre », **à juste titre** ;
- une **dalle absente**, un **mur entier manquant** ;
- un **trou de 128×128 mailles** — 1,78 km, la moitié de la fenêtre.

**Méthode validée par l'attaque :** volume signé recentré, plus dégénérés, plus NaN. **Sans rendu**, environ 10 ms.

- [ ] **Étape 1** — écrire **six sabotages** et le test qui les attend tous : solide retourné, dalle absente, mur manquant, trou central, triangle dégénéré, NaN.
- [ ] **Étape 2** — les lancer, vérifier que **chacun** échoue.
- [ ] **Étape 3** — implémenter.
- [ ] **Étape 4** — ⚠️ **le test de non-vacuité** : l'audit doit refuser de rendre un verdict sur une géométrie vide, au lieu de la déclarer saine. **C'est ainsi que le test de silhouette du prototype passait à vide.**
- [ ] **Étape 5** — mutation sur chacune des trois détections.
- [ ] **Étape 6** — `npm test`, audit disque-vs-liste, commit.

### Tâche 6 : `fenetre-bornee.js` — l'extraction

**Fichiers :** créer `src/monde/fenetre-bornee.js` · tester `test/fenetre-bornee.test.js`

**Interfaces produites :**
- `construireFenetre({ emprise, n })` → `{ geometrie, indices, boiteEnglobante }`
- `majHauteurs(fenetre, fluxTerrain)` → `void`

⚠️ **Par RÉÉCHANTILLONNAGE, jamais par découpe du maillage du quadtree.** C'est la décision d'architecture du §4.

- [ ] **Étape 1** — test : une fenêtre construite puis auditée par `auditerSolide` est fermée, orientée, sans dégénéré ni NaN.
- [ ] **Étape 2** — le lancer, vérifier qu'il échoue.
- [ ] **Étape 3** — implémenter : grille régulière propre à la fenêtre, hauteurs cherchées dans le cache en coordonnées de pixel global, parois dont les sommets hauts **sont** les sommets de bord, dalle en éventail sur le même anneau bas.
- [ ] **Étape 4** — test : sur cent emprises tirées au hasard, dont l'antiméridien et au-delà de 85° de latitude, l'audit passe **cent fois**.
- [ ] **Étape 5** — mutation : inverser l'enroulement de la dalle doit tuer le test d'orientation.
- [ ] **Étape 6** — `npm test`, `node --check`, `npx vite build`, audit, commit.

### Tâche 7 : les deux résolutions et la zone morte

**Fichiers :** modifier `src/monde/fenetre-bornee.js` · tester `test/fenetre-resolution.test.js`

**Interfaces produites :**
- `resolutionPour({ enMouvement })` → `128 | 256`
- `empriseADerive(precedente, courante)` → `boolean`

**Mesuré :** N=256 coûte **8,3 ms de médiane** — au-dessus du budget d'une image à 60 Hz, sur une machine très au-dessus de la cible, et **sans mer ni palette ni gravure**. N=128 coûte **1,7 ms**.

⚠️ **Le prototype reconstruisait à CHAQUE image** — le pire cas imaginable. La zone morte est ce qui rend la décision 4 tenable.

- [ ] **Étape 1** — test : en mouvement `resolutionPour` rend 128, à l'arrêt 256 ; une dérive d'emprise sous le seuil ne déclenche **aucune** reconstruction.
- [ ] **Étape 2** — le lancer, vérifier qu'il échoue.
- [ ] **Étape 3** — implémenter.
- [ ] **Étape 4** — mutation : supprimer la zone morte doit tuer le test de non-reconstruction.
- [ ] **Étape 5** — ⚠️ **mesurer sur un vol, et donner les deux chiffres** : reconstructions par seconde avant et après la zone morte.
- [ ] **Étape 6** — `npm test`, audit, commit.

⚠️ **Chargez `anthropic-skills:three-doctor` avant de commiter cette tâche** : c'est celle qui touche le plus la boucle de rendu, et le téléversement de 1,54 Mo de sommets par image en fait partie.

---

## 8. PHASES 3 à 6

⚠️ **Détaillées quand la Phase 2 aura mesuré.** Écrire la semaine huit avant que la six ait parlé, c'est fabriquer du travail à jeter.

**Phase 3 — les statistiques lissées** (`src/monde/statistiques-lissees.js`). Les quatre restantes : `meanM`, `globalMin`, les quantiles de rampe, `robustScale`. ⚠️ **C'est de l'auto-exposition**, et comme elle, il lui faut une **zone morte** — sinon la vue dérive en permanence sur des variations insignifiantes.

**Phase 4 — la transition et le vol.** ⚠️ **La transition n'est peut-être pas qu'un effet.** MapLibre **change de projection vers z12** et cache la bascule dans une zone où globe et Mercator coïncident, pilotée par un uniforme `globeness` — **parce que le float32 ne donne qu'une valeur tous les 2,5 m**. Chez eux le fondu **est** le mécanisme. Si notre transition doit masquer un changement de repère, elle se conçoit avec cette contrainte, pas se dessine d'abord.

**Phase 5 — les données.** Canopée en flux à l'activation. **GLOBathy** (1,4 M de plans d'eau, 30 m, **CC0**). ⚠️ Profondeurs **modélisées**, validées sur 1 503 lacs sur 1,4 million : à mentionner si on les affiche.

**Phase 6 — la dépose de l'ancien.** Retrait d'`escalier-zoom.js`, nouveau format de partage, reprise des gabarits. ⚠️ **Une partie des 3 062 tests verrouille les statistiques par cadre qu'on débranche. À relire un par un** — lent, ingrat, et que les agents n'accélèrent pas.

---

## 9. Ce qu'Adrien doit trancher en chemin

- **L'effet de transition** globe → socle — Phase 4, en tenant compte du point MapLibre ci-dessus.
- **La récupération de GLOBathy** : Earth Engine impose un compte et des conditions commerciales à vérifier ; le dépôt de l'article est peut-être la meilleure porte.
- **Le trait de côte au-delà de z15.** Mesuré : autour d'un bloc z16 à Brest, les polygones OSM pré-simplifiés à 30 m ne donnent que **51 segments pour 1,2 km de côte** — médiane 123 m, pointes à 849 m. Rasterisés à 0,79 m la cellule, ils dessineraient un rivage à facettes. Soit on branche le champ processeur au-delà de z15, soit on raffine la donnée. **Le second est une décision de données, pas de code.**
- **Le déploiement de la mer corrigée**, qui change l'image de manière visible et n'a pas encore été regardée.

## 10. Auto-revue

**Couverture :** les treize décisions et les trois règles ont chacune leur tâche ou leur phase.

**Cohérence des noms** — employés à l'identique partout : `socleVisible`, `SEUIL_NAISSANCE_M`, `SEUIL_MORT_M`, `demanderEmprise`, `PLAFOND_EN_VOL`, `auditerSolide`, `construireFenetre`, `majHauteurs`, `resolutionPour`, `empriseADerive`, `zoomSoutenable`.

**Ordre imposé, et il compte :** 4 bis (le flux) **avant** 6 (l'extraction), parce que l'extraction s'appuie sur une interface qui se coince aujourd'hui. Et 5 (l'audit) **avant** 6, parce que sans instrument on ne saura pas si l'extraction marche — le prototype s'est cru étanche pendant tout son vol.

**Le risque principal n'est plus la géométrie** : l'attaque a confirmé qu'on ne peut pas la déchirer. **C'est le flux** — plafond, annulation, éviction — et **le réseau**, qui décide du zoom réellement atteint.

**Ce qui n'est toujours pas vérifié :** aucune image en mouvement n'a jamais été vue (le volet navigateur ne composite pas), et rien n'a été mesuré sur un portable. Les deux valent pour le prototype comme pour son attaque.
