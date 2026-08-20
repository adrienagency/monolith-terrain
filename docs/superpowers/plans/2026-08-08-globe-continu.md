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
- `socleVisible({ fractionEcran, visibleAvant })` → `boolean`
- `SEUIL_NAISSANCE`, `SEUIL_MORT` → les deux fractions

⚠️ **Le seuil DOIT avoir une hystérésis**, et `SEUIL_MORT` doit être strictement inférieur à `SEUIL_NAISSANCE`. Sans cet écart, une caméra posée pile sur la limite fait clignoter le socle. C'est le même défaut que `SPLIT_RATIO` / `MERGE_RATIO` a déjà résolu dans `globe.js` — reprendre ce patron, il est éprouvé sur ce dépôt.

Module pur : ni DOM, ni three.js, testable sous node — même discipline qu'`escalier-zoom.js`, qu'il remplace.

- [ ] **Étape 1** — écrire le test : en montant, le socle naît à `SEUIL_NAISSANCE` ; en redescendant, il ne meurt qu'à `SEUIL_MORT`. Puis le test qui compte : **osciller cent fois autour du seuil de naissance ne doit produire qu'une seule bascule.**
- [ ] **Étape 2** — le lancer, vérifier qu'il échoue.
- [ ] **Étape 3** — implémenter.
- [ ] **Étape 4** — vérifier par mutation : égaliser les deux seuils doit tuer le test d'oscillation.
- [ ] **Étape 5** — `npm test`, audit disque-vs-liste, commit.

### Tâche 4 : descendre le globe sous z11

**Fichiers :** modifier `src/globe.js` (`MAX_Z`, `CACHE_MAX`) · tester `test/globe-reseau.test.js`, `test/globe-eviction.test.js`

Le quadtree s'arrête à z11 parce qu'il ne servait qu'à la vue orbitale. Il doit descendre jusqu'aux zooms où vivent les blocs.

⚠️ **Vérifier d'abord jusqu'où les tuiles d'altitude existent réellement** chez AWS terrarium et chez mapterhorn. Descendre au-delà de la donnée disponible ne produit pas une erreur : ça produit des tuiles vides, donc un terrain plat, en silence. **Le mesurer, pas le supposer.**

⚠️ **Et surveiller `CACHE_MAX = 420`.** Il a été calibré pour un globe ; à des zooms fins, la même limite couvre une surface bien plus petite et l'éviction se met à battre — on recharge en boucle ce qu'on vient de jeter. Mesurer la mémoire réelle avant de choisir un nouveau chiffre, et l'écrire dans le code.

---

## PHASES 2 à 6 — le détail viendra après le prototype

⚠️ **Ce n'est pas un oubli, c'est une décision.** Écrire des étapes minute par minute pour la semaine huit avant que la semaine une ait dit si l'approche tient, c'est fabriquer du travail à jeter. Ces phases sont ici avec leurs décisions et leurs pièges connus ; elles seront détaillées quand la Tâche 2 aura rendu son verdict.

**Phase 2 — la fenêtre bornée** (`src/monde/fenetre-bornee.js`). L'extraction du maillage fermé, promue du prototype vers le dépôt, **derrière un drapeau de `src/flags.js`**. ⚠️ Les deux moteurs devront **coexister à l'écran** pour être comparés : le drapeau reste en place longtemps, ce n'est pas un interrupteur temporaire.

**Phase 3 — les statistiques lissées** (`src/monde/statistiques-lissees.js`). Les quatre restantes après la Tâche 1 : `meanM`, `globalMin`, les quantiles de rampe, `robustScale`. ⚠️ **C'est de l'auto-exposition**, exactement comme sur un appareil photo — et comme elle, il lui faut une **zone morte**, sinon la vue dérive en permanence sur des variations insignifiantes.

**Phase 4 — la transition et le vol.** La bascule globe → socle avec son effet, à dessiner avec Adrien. Le vol de la caméra vers un GPX déposé. ⚠️ **Le vol ne doit pas devenir le nouveau temps de chargement** : c'est précisément ce qu'on supprime. Le mesurer comme tel.

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
