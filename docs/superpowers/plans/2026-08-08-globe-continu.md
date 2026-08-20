# Globe continu et socle de proximité — plan d'implémentation

> **Pour les agents :** SOUS-COMPÉTENCE REQUISE : `superpowers:subagent-driven-development`. Cases à cocher (`- [ ]`).
> Chargez selon la tâche : `threejs-geometry` (Phase 2), `threejs-shaders` (Phase 3), `threejs-fundamentals` (Phase 1), `threejs-animation` (Phase 4), et **`anthropic-skills:three-doctor` avant tout commit qui touche la boucle de rendu**.

**But :** remplacer la navigation par paliers de ShibuMap par une caméra continue de l'orbite au sol, sur laquelle un socle éditorial apparaît sous un seuil de proximité.

**Architecture :** le quadtree de `src/globe.js` devient la seule source de relief. Le bloc cesse d'être une cuisson pour devenir une **fenêtre bornée** ouverte sur ce flux. ⚠️ **On ne découpe pas le maillage du quadtree : on rééchantillonne son cache dans une grille propre à la fenêtre.** Les statistiques globales restent calculées sur le cadre, mais lissées dans le temps.

**Pile :** three.js r172, WebGL2, Vite. Aucune nouvelle dépendance de rendu.

**Version :** réécriture complète du 2026-08-20, après le prototype et son attaque. Les versions précédentes contenaient trois chiffres faux et un test qui ne mordait pas.

---

## 0. Comment on vérifie — à lire AVANT toute tâche

### ⚠️ AUCUN CHIFFRE DE CE PLAN N'EST À CROIRE S'IL N'EST PAS SOURCÉ

Trois révisions de ce document ont posé des constantes **à l'instinct**, présentées comme des valeurs : `PLAFOND_FILE = 512`, des seuils de socle à 120 et 180 km. Un attaquant les a mesurées. **Les deux étaient fausses** — 512 dépassait le budget entier du cache, et les seuils l'étaient d'un facteur dix-huit.

**Règle, désormais :** un chiffre de ce plan porte soit **sa mesure et sa source**, soit la mention **« À MESURER »** avec le protocole. Il n'y a pas de troisième cas, et **une valeur non sourcée est un bogue du plan**, pas un détail à régler plus tard.



**Ces commandes sont la fin obligatoire de chaque tâche.** La dernière étape de chaque tâche dit « **la clôture du §0** » et ne les recopie pas.

⚠️ **UNE VERSION DE CE PLAN LES RECOPIAIT EN PLUS COURT dans quatre tâches** — `npx vite build` nu, sans redirection, sans `nettoie:dist`, avec un « audit » qui ne nommait pas sa commande. Un agent lisant la version courte aurait sauté les gardes en toute bonne foi. **C'est exactement le reproche que ce plan fait à sa propre décision 13** : un avertissement qu'on ne relit pas ne protège de rien.

```
npm test              # la suite entière — 3 062 verts au 2026-08-20
npm run audit:tests   # disque contre liste
node --check <fichier>  # sur CHAQUE fichier modifié
npm run nettoie:dist && npx vite build > /tmp/build.log 2>&1
```

⚠️ **`npm test` N'EST PAS UN MOTIF DE FICHIERS : c'est une LISTE de 178 chemins écrite à la main dans `package.json`.** Un test ajouté au disque et oublié dans la liste **ne tourne jamais**, et la suite affiche fièrement ses milliers de verts. **Ajoutez votre fichier à la ligne `test`, puis lancez `npm run audit:tests`** — il sort en erreur s'il trouve un orphelin.

⚠️ **NE PIPEZ JAMAIS `vite build` DANS `tail`.** Le processus survit au shell, et le build suivant entre en collision sur `dist/` (`ENOTEMPTY`, 150 000 fichiers). **Redirigez vers un fichier.** `npm run nettoie:dist` vide `dist/` avec obstination — sept tentatives — parce qu'un antivirus tient régulièrement un fichier au mauvais moment.

⚠️ **AUCUN TEST NE CHARGE `src/main.js`.** `node --check` et `vite build` sont le seul filet sur ce fichier.

### Le « vol de référence », défini une fois

Plusieurs tâches demandent de mesurer « sur un vol de référence ». **C'est celui-ci, et il ne s'improvise pas** :

**45 secondes, de l'Atlantique (260 km d'altitude) au Mont-Blanc (2,2 km), l'emprise suivant la caméra, à 60 Hz.** C'est le trajet du prototype, et c'est ce qui rend les chiffres comparables d'une tâche à l'autre.

⚠️ **Il ne suffit PAS à lui seul.** L'attaque a montré qu'il ne voit pas le défaut le plus courant : c'est une **descente lisse**, où deux images consécutives demandent presque les mêmes tuiles. **Ajoutez toujours un panoramique latéral à basse altitude** — 90° de balayage à 4 km — qui est le geste le plus banal de l'application et celui qui a révélé les 2 943 tuiles bloquées.

### Les mesures citées dans ce plan

Elles viennent d'un prototype jetable et de son attaque, **tous deux hors dépôt et gitignorés** (`prototype/`, `.superpowers/sdd/`). ⚠️ **Elles ne survivront pas à un worktree neuf.** Elles sont donc recopiées dans ce document là où elles servent, et **c'est ce document qui fait foi**.

**À refaire soi-même** — le plan le dit à chaque fois : tout chiffre qui **décide** d'une tâche (le budget d'image, le zoom soutenable, le battement d'éviction). **À croire sur parole** : les chiffres géométriques, vérifiés deux fois et cohérents entre eux.

---

### ⚠️ LA COMPÉTENCE `/threejs-optimisation` EST OBLIGATOIRE SUR CE PLAN

Elle a été écrite **à partir de ce dépôt**, en observant ce que deux agents ratent quand ils auditent `globe.js` sans aide. Ses cinq sections ne sont pas des généralités : chacune correspond à une erreur réellement commise dans ce plan.

| section | ce qu'elle attrape | où elle mord dans ce plan |
|---|---|---|
| §1 — l'audit s'arrête au fichier | `globe.js` a réinventé sa source au lieu d'utiliser `dem-source.js` | **Tâche 4 alpha** — trouvée en trente secondes de `grep`, jamais par la lecture ligne à ligne |
| §2 — ce qui rend une limite inatteignable | `MAX_Z = 11` est du code mort ; le point fixe `capacité − occupé` | **Tâche 4**, causes 1 et 3 — et l'obligation d'écrire le champ de vision |
| §3 — ce qui ment quand on mesure | sonde posée après la fonction, chronomètre qui exclut le téléversement, **suite verte qui verrouille le défaut** | **§0**, et l'Étape 2 de la Tâche 4 |
| §4 — le float32 à l'échelle planétaire | le pas représentable s'épuise avant la donnée | déjà corrigé (`150f817`) — sert ici à **vérifier**, pas à supposer |
| §5 — le tri spatial avant le fin | l'horizon en dur, l'absence de frustum, **et l'ordre des correctifs** | **Tâche 4**, étapes 3-5 — c'est elle qui interdit d'ouvrir le crédit en premier |

⚠️ **Le résultat mesuré de la phase verte :** sans la compétence, l'audit conclut que le quadtree « est propre et bien commenté ». Avec elle, il découvre qu'**il ne fait pas son travail**. Elle a été décisive sur trois trouvailles sur cinq, et sans effet sur les autres — **c'est exactement ce qu'elle annonce**, et il ne faut pas en attendre plus.

### ⚠️ LA SECONDE RÈGLE DU §0 : ON ÉLARGIT UNE LISTE, ON NE LA REMPLACE PAS

**Ce document a été corrigé par lots successifs, et le même accident s'est produit cinq fois.** Il mérite sa règle, parce qu'il coûte plus cher que les erreurs qu'il prétend réparer :

1. Un remplacement **global** a dupliqué deux blocs d'étapes dans quatre tâches à la fois — deux tâches se sont retrouvées sans aucune étape parlant de leur propre module.
2. Une correction de repères a fait **sortir du document** le vrai pop-up de l'application : les numéros cités étaient faux, la thèse était juste, et la liste a été remplacée au lieu d'être élargie.
3. Le commit écrit pour **réparer** cet accident l'a **reproduit** sur une autre liste.
4. Un script écrit en ligne dans un terminal a fait interpréter des accents graves comme des commandes : deux noms ont été avalés au §10, laissant des parenthèses vides.
5. Une assertion fausse a été remplacée par **une autre assertion fausse, aux mêmes valeurs**, faute d'avoir été rejouée contre le dépôt.

**Les quatre règles qui en découlent, et elles valent pour l'agent qui exécutera ce plan :**

- ⚠️ **On ÉLARGIT une liste de fichiers ou de repères, on ne la remplace jamais.** Un repère faux se corrige **en place** ; les justes qui l'entourent restent.
- ⚠️ **Un remplacement de texte se borne à UNE section, et échoue bruyamment si le motif n'y apparaît pas exactement une fois.** Jamais de remplacement global sur ce document.
- ⚠️ **Une assertion se rejoue contre le dépôt AVANT d'être écrite.** Deux versions successives d'une même étape ont été fausses aux mêmes valeurs parce que personne ne l'avait exécutée.
- ⚠️ **Un script d'édition passe par un fichier, jamais par une ligne de commande.** Les accents graves de ce document sont innombrables et le shell les interprète.


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

⚠️ **LES REPÈRES DE LIGNE PÉRIMENT VITE — Y COMPRIS CEUX-CI.** Ceux de l'étude du 2026-07-29 avaient tous bougé ; ceux de la première version de ce plan ont bougé de **29 lignes en six heures**, invalidés par `e73de50`, l'un des commits que ce document revendique lui-même comme faits.

**Relevés le 2026-08-20. Vérifiez-les avant de vous y fier** — `grep -n` coûte trois secondes, une fausse piste coûte une heure.

| ce qui est décidé en regardant tout le cadre | où |
|---|---|
| le zéro vertical (`meanM`) | `src/terrain.js:2137`, `:2204`, `:2238` |
| le niveau de la dalle (`globalMin`) | `src/plinth.js:143`, `:148`, `:196` |
| où est la mer | `src/sea-mask.js:50` — **traitée, voir §4** |
| la rampe de couleurs (p08/p50/p92) | `src/relief-grade.js:80`, `:127` |
| le peigné des crêtes (`robustScale`) | `src/terrain-analysis.js:152` |

**Elles sont CINQ et non six.** La hiérarchie relative des routes que citait l'étude n'existe plus — la couche a disparu du dépôt. **Ne la cherchez pas.**

### Ce qui existe et qu'on ne réécrit pas

- `src/globe.js` — quadtree z2→z11, `SPLIT_RATIO` 0,38 avec hystérésis, raffinement sans trous, LRU, six requêtes concurrentes.
- `src/coast-mask.js` — rasterise les polygones Natural Earth du z4 au z15.
- Les pyramides : `sol` et `canopee` (z8/z9 **mondiaux**, **3,8 Ko/tuile** — mesuré sur 16 234 et 59 826 fichiers ; ce plan écrivait « ~3 Ko »), `bathy` z4→z10, `lake-tiles` (`world: true`), `coast-z6` (grille complète).
- `src/flags.js` — **existe** (4 057 octets, `export const FLAGS`), et portera le drapeau qui isole les deux moteurs. ⚠️ Un rapport de validation l'a cru absent : il est bien là.
- Toute la chaîne d'export, les comptes, la boutique, le Race Studio.

---

### ⚠️ CE PLAN A COMMIS L'ERREUR QUE SA PROPRE COMPÉTENCE DÉCRIT AU §1

**Un sous-système « fenêtre continue 3×3 » existe déjà dans ce dépôt, fusionné sur main le 2026-08-01, et ce plan ne le déclarait nulle part.** Vérifié sur disque, module par module :

| module existant | ce qu'il fait déjà | ce que ce plan proposait de créer |
|---|---|---|
| `src/dem-emprise.js` | `originesEmprise`, `recollerEmprise`, `rectFenetre`, `statsRect`, `enVolBorne`, `EMPRISE_COTE = 3` | `flux-terrain.js`, et une partie de `fenetre-bornee.js` |
| `src/fenetre-clip.js` | `exposantCoin`, `pointCoin`, `arcCoin`, `plansFenetre`, `dansFenetre` | ⚠️ **`exposantCoin` (`:71`) est DÉJÀ un export** — le paramètre du même nom de `construireFenetre` est une **collision** |
| `src/plinth.js` | `computeSlab` (`:138`), `buildSlabWalls` (`:232`, **douze options**) | `construireFenetre`, dont la signature n'en couvre que **cinq** |
| `src/block-grid.js:768` | le damier appelle `buildSlabWalls` — **13 fichiers `test/damier-*.test.js`, empreintes bit à bit** | rien : le mot « damier » n'apparaissait pas une fois dans ce plan |
| `src/fenetre-finesse.js` | `pasFinesse`, `resDeFinesse`, `REPOS_S = 0,4`, `V_REPOS = 2`, `RES_REPOS_MAX = 768` | ⚠️ **toute la Tâche 7** |
| `src/terrain.js` | `resMaillage` (`:2016`), `RES_FENETRE_CONTINUE = 384` (`:61`) | les deux résolutions de la Tâche 7 |
| `src/mer-emprise.js`, `src/fenetre-course.js` | champ de mer sur emprise variable, déplacement élastique | — |

Le tout derrière `FLAGS.fenetreContinue` — ⚠️ **qui vaut `false` (`flags.js:25`) : ce sous-système est fusionné et testé, PAS actif.** Sept fichiers de test lui sont dédiés.

⚠️ **PREMIÈRE ACTION DE CE PLAN, AVANT TOUTE TÂCHE : lire ces modules et trancher, module par module, réutiliser ou remplacer — et l'écrire ici.** C'est exactement le §1 de `/threejs-optimisation` — « l'audit s'arrête au fichier ; zéro occurrence est un signal, pas un soulagement » — et ce plan y est tombé sur son propre sujet.

⚠️ **C'est la SEULE « première action » du document.** Les tâches portent ensuite des marqueurs d'ordre **relatif** (« LA PREMIÈRE DU BLOC », « EN DERNIER », « APRÈS LA TÂCHE 4 ») : ils se lisent **à l'intérieur de leur bloc**, jamais contre celui-ci. **L'ordre complet est au §10.**

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

**Remplacement validé par l'attaque :** volume signé recentré + dégénérés + NaN. ⚠️ **CE PLAN A ÉCRIT « 6 SABOTAGES DÉTECTÉS SUR 6 » ET C'EST FAUX** : rejoué au banc, **trois passent pour sains** — dalle absente, mur manquant, et un trou couvrant un quart de la surface (qui ne coûte que 4 % de volume). Il faut le volume signé autour de **deux** origines. Voir la Tâche 5.

---

## 5. Structure des fichiers

| fichier | responsabilité |
|---|---|
| `src/monde/flux-terrain.js` **(créer — ⚠️ après avoir lu `dem-emprise.js`)** | le quadtree en source unique : demander une emprise, recevoir les tuiles — **avec plafond, annulation et éviction des `loading`** |
| `src/monde/fenetre-bornee.js` **(créer — ⚠️ après avoir lu `plinth.js` et `fenetre-clip.js`)** | extraire un maillage fermé par **rééchantillonnage**, jamais par découpe |
| `src/monde/audit-solide.js` **(créer)** | volume signé, dégénérés, NaN — l'audit qui ne se laisse pas berner |
| `src/monde/statistiques-lissees.js` **(créer)** | les quatre statistiques restantes, amorties, avec zone morte |
| `src/monde/seuil-socle.js` **(créer)** | naissance et mort du socle sur une **altitude de caméra**, **et le producteur d'`emprise`** |
| `src/dem-emprise.js` **(lire, peut-être réutiliser)** | ⚠️ `originesEmprise`, `recollerEmprise`, `rectFenetre`, `statsRect`, `enVolBorne` — **il fait déjà une partie du flux et de l'emprise** |
| `src/fenetre-clip.js` **(lire, peut-être modifier)** | la forme des coins, dont `plinth.js` **et** `ocean.js` tirent la leur — ⚠️ **`exposantCoin` y est déjà un export** |
| `src/landmarks.js` **(lire)** | `blockExtentMeters` (`:22`) — **la seule source de la largeur du socle** |
| `src/bathy.js` **(modifier)** | `overzoomTile` (`:578`), touché par le passage en 512 px |
| `src/plinth.js` **(modifier)** | accepter une emprise variable ; il garde le congé, les coins en superellipse et le liner |
| `src/ocean.js` **(modifier)** | il recalcule `uCornerR`, `uCornerN`, `buildRimGeometry` sur les mêmes constantes — sans lui, la mer cesse d'épouser le socle |
| `src/dem.js` **(lire)** | la politique à trois voies Mapterhorn / AWS / 404, `:245-263` |
| `src/dem-source.js` **(lire)** | `DEFAULT_SOURCE_ID`, `tilePx`, `maxZoom`, `REGION_ZOOM` |
| `src/block-grid.js` **(modifier)** | `:768` appelle `buildSlabWalls` — 13 fichiers de test, empreintes bit à bit |
| `src/fenetre-finesse.js` **(modifier ou remplacer)** | ⚠️ **il fait déjà la Tâche 7** |
| `src/terrain.js` **(modifier)** | `resMaillage` (`:2016`), `RES_FENETRE_CONTINUE = 384` (`:61`) |
| `src/main.js` **(modifier)** | **le seul endroit qui lit `FLAGS`** pour le globe, **et la carte `#loading`** — `showLoading` `:908`, `hideLoading` `:912`, `LOADING_MIN_MS` `:898`, l'appel `:3182`. ⚠️ **Les trois repères `:927`, `:3423`, `:3447` qu'une révision de ce plan citait sont des lignes de COMMENTAIRE — ne les cherchez pas.** |
| `src/monde/descente-bornee.js` **(créer)** | borner la descente au débit réellement observé — règle R3 |
| `src/flags.js` **(modifier)** | le drapeau qui isole le globe continu du globe orbital, **qui est en production** |
| `src/globe.js` **(modifier)** | horizon géométrique, frustum, crédit ; puis rebranchement sur la vraie source |
| `src/escalier-zoom.js` **(⚠️ NE PAS RETIRER — à découper)** | il exporte aussi `intersectionGlobe` et `viseeArrivee`, **importées par `main.js:31`** et sans rapport avec les paliers. Seuls `bornesEscalier`, `pasEscalier`, `paliersRetenus` et `palierDeClic` disparaissent avec eux |
| `src/modes.js` **(modifier)** | ⚠️ **la caméra, les paliers ET le rideau blanc** — `_dive`, `_rescale`, `_whiteout`, `DIVE_TIERS`, `orbAlt`, `minDistance`. **C'est lui qui fabrique la discontinuité ET le pop-up** |
| `src/style.css` **(modifier)** | `:535-547` — le rideau plein écran du voile |

---

## 6. PHASE 1 — Le flux et la caméra

### ⚠️ CE QUE CE PLAN NE LIVRE PAS — À LIRE AVANT DE COMMENCER

**Adrien a demandé trois choses. La cinquième attaque a vérifié, tâche par tâche, ce que le plan en porte :**

| la demande | qui la porte |
|---|---|
| « plus de pop-up de chargement » | ✅ **Tâche 2** — ⚠️ **il y a DEUX rideaux** : la carte `#loading` (`main.js`/`style.css`, plancher de 2 000 ms, **et elle floute l'app à 16 px à l'arrêt**) et le fondu `.whiteout` de `Modes`. Une révision de ce plan avait fait sortir le premier du document en corrigeant les repères du second. |
| « le déplacement totalement fluide, une seule caméra de l'orbite au sol » | ⚠️ **PERSONNE.** Le §6 s'appelle « le flux et **la caméra** » et ses cinq tâches parlent toutes du quadtree. La navigation par paliers vit dans `src/modes.js` (758 lignes : `orbAlt`, `DIVE_TIERS`, `pickDiveTier`, `controls.minDistance`, `cruise`), qui n'était **cité que deux fois, comme fournisseur de constantes pour un harnais**. → **Tâche 1, écrite ci-dessous.** |
| « le crop n'apparaît que lorsque la Terre occupe une partie importante de l'écran » | ✅ **Tâche 3**, et elle est exécutable. |

⚠️ **ET LA PARTIE DÉTAILLÉE AJOUTE UNE ATTENTE QUE PERSONNE N'HABILLE.** La règle R3 et la Tâche 4 ter bornent la descente au débit : **la caméra refuse le geste**. Le plan ne dit nulle part ce que l'utilisateur voit à cet instant — **c'est exactement l'instant qu'occupait le pop-up.** À trancher avec Adrien : un flou assumé (décision 13), un ralentissement, ou un indicateur discret.

**Voilà pourquoi la numérotation commençait à 3.** Les deux tâches manquantes ne manquaient pas par accident : ce sont celles qui touchent au visible.

### ⚠️ LE CHIFFRE QUI CADRE TOUTE LA PHASE 1

**Mesuré au banc, stable au dernier chiffre sur trois exécutions, descente orbite → z13 avec un réseau PARFAIT :**

> **Descente orbite → z13 : 8 rideaux · 24,2 % d'écran blanc · 48,4 % d'entrée morte.**
> **Remontée z13 → orbite : 11 rideaux · 35,3 % d'écran blanc · 70,8 % d'entrée morte.**
> **Clic-plongée : 4 rideaux · 49,2 % d'entrée morte · 94,8 % de bandeau.**

⚠️ **ET VOICI LA DÉCOMPOSITION QUI DIT CE QUE CE PLAN FERME — ET CE QU'IL NE FERME PAS.** L'entrée morte vaut **15,62 s sur 30 s (52,1 %)**, et elle se coupe en deux parts :

| | aujourd'hui | tous rideaux retirés |
|---|---|---|
| pendant le **rideau** | 7,73 s | **0 s** ✅ |
| pendant **`await loadSurface`** | 7,88 s | **7,88 s** ⚠️ |
| autre | 0 s | 0 s |

⚠️ **LES TÂCHES 1a-1c, 2, 2 bis ET 2 ter FERMENT 7,73 s SUR 15,62 s — LA MOITIÉ, ET PAS DAVANTAGE.** L'autre moitié est le verrou pendant le chargement, et **la Tâche 4 ne peut pas aider : `loadSurface → fetchAndBuildDem → loadDem` ne passe pas par `globe.js`** (vérifié). **C'est l'Étape 1 de la Tâche 1c qui doit la fermer, et c'est son seuil chiffré.** Et il reste encore, hors de tout périmètre actuel : `.fui-msg`/`announce` (**11,18 s de bandeau**) et les **1 516 ms de cuisson** de la Tâche 7.

⚠️ **ET LA MAJORITÉ NE VIENT PAS DE `_dive` : ils viennent de l'escalier de surface** (`_rescale`, `modes.js:452`, appelé par `_refine` `:436` et `_coarsen` `:445`). **Sur les 25 rideaux des quatre trajets, 17 sont posés par `_rescale`.** **C'est la première source du pop-up d'Adrien, et aucune tâche ne la portait.** → **Tâche 2 bis.**

Le réseau étant parfait dans ce banc, **la production est pire que ces chiffres, jamais meilleure.**

### Tâche 1 : la caméra continue — `modes.js` ⚠️ LA DÉCISION 1 N'AVAIT AUCUNE TÂCHE

**Fichiers :** modifier `src/modes.js` · modifier `src/main.js` · tester `test/camera-continue.test.js` (créer)

⚠️ **UNE PREMIÈRE VERSION DE CETTE TÂCHE ACCUSAIT LE MAUVAIS CODE.** Elle désignait `modes.js:397` (`tier.altM × 1,6`) : cette ligne est **dans le `catch`** de `loadSurface` — le chemin d'échec, un filet anti-martèlement, pas la discontinuité. Elle avait été trouvée par `grep`, sans ouvrir la fonction. **C'est le §1 de `/threejs-optimisation` appliqué au plan lui-même.**

**Le chemin nominal (`modes.js:407-429`) ne fait pas un saut d'altitude : il ÉCHANGE LE MOTEUR DE RENDU**, d'un bloc, derrière 960 ms de fondu au blanc. Sept gestes en une image :

1. `globe.setVisible(false)` et `setSurfaceVisible(true)` — **on change de monde**
2. `camera.near` / `camera.far` passent aux valeurs surface (`:414-415`)
3. `camera.up.set(0, 1, 0)` — **le repère bascule du géocentrique au local** (`:417`)
4. `camera.position` et `controls.target` sautent à `_arrivalPose` (`:419-420`)
5. `controls.minDistance = 6` (`:420`) — l'échelle change d'ordre de grandeur
6. `maxPolarAngle`, `rotateSpeed`, `enableZoom`, `enablePan` réécrits
7. `this.mode = 'surface'`

⚠️ **Le fondu au blanc n'est pas l'ornement du saut : il est là parce que le saut est invisible autrement.**

⚠️ **ET UN PLANCHER ORBITAL INTERDIT PHYSIQUEMENT « DE L'ORBITE AU SOL » :** `controls.minDistance = R_GLOBE + DIVE_ALT_M × 0,85` (`modes.js:326`). Tant qu'il est là, la caméra **ne peut pas** descendre en mode orbital. **Quatre sites écrivent `minDistance`** : `modes.js:326`, `:420`, `:639`, `main.js:1215`.

⚠️ **R1 EST DÉJÀ VIOLÉE EN PRODUCTION, ET CETTE TÂCHE HÉRITE DU DÉFAUT.** `surfaceCamAltMeters()` (`main.js:3594-3599`) rend `camera.position.y / scale + dem.meanM` — une quantité **dérivée du terrain**, lissée — et elle **pilote `enterOrbit`** (`modes.js:303`). Le gain de l'oscillateur est déjà câblé ; la Phase 3 y ajouterait le retard. **À traiter ici, pas à découvrir en Phase 3.**

⚠️ **ET LE TEST NE PEUT PAS ÊTRE UN TEST D'EXÉCUTION.** `Modes` appelle `document.createElement`, **il n'y a pas de jsdom dans ce dépôt** (`grep -c jsdom package.json` → 0), aucun test n'instancie `Modes`. Deux issues, à trancher à l'Étape 0 : **extraire la loi d'altitude en module pur** — patron d'`escalier-zoom.js` et de `fenetre-finesse.js`, tous deux purs et testés sous node — ou **assertion de texte source**, convention employée par **onze fichiers de test** de ce dépôt. ⚠️ **L'extraction est préférable : elle seule donne un test qui mord.**

⚠️ **CETTE TÂCHE EST TROP GROSSE POUR UN SEUL COMMIT, ET C'EST MESURÉ : onze cases sur `modes.js` (758 lignes) et `main.js` (~4 200 lignes), dont une décision d'architecture que ce plan qualifie lui-même de « geste le plus lourd ».** Toutes les autres tâches du document tiennent dans un commit ; celle-ci non. **Elle se fait en trois, dans cet ordre, chacune close par le §0 et son propre commit.**

#### Tâche 1a — l'instrument, et la mesure

⚠️ **CETTE SOUS-TÂCHE NE POSE PAS D'ASSERTION, ET C'EST DÉLIBÉRÉ.** Une version de ce plan lui faisait écrire « le test qui échoue » **puis** exiger la clôture du §0 — c'est-à-dire `npm test` vert. **Les deux sont incompatibles**, et la sortie la moins chère aurait été de neutraliser l'instrument (`test.todo`, assertion molle), ce qui l'aurait rendu inutile aux Tâches 1b et 1c qui s'appuient dessus. **Elle livre donc un instrument et des chiffres, pas un test rouge. L'assertion appartient à la Tâche 1b.**

- [ ] **Étape 0 — trancher la forme de l'instrument.** ⚠️ `Modes` appelle `document.createElement`, **il n'y a pas de jsdom dans ce dépôt** et aucun test n'instancie `Modes`. Deux voies : **extraire la loi d'altitude en module pur** (patron d'`escalier-zoom.js` et de `fenetre-finesse.js`, tous deux purs et testés sous node) ou **assertion de texte source** (onze fichiers de ce dépôt le font). ⚠️ **L'extraction est préférable : elle seule donnera un test qui mord à la Tâche 1b.**
- [ ] **Étape 1 — écrire l'instrument**, et un test qui **passe aujourd'hui** : il caractérise le comportement actuel — *l'altitude présente au moins un saut sur une descente de 1 600 km à 2 km*. ⚠️ **Un test de caractérisation, pas un test de spécification** : il documente ce qui est, et la Tâche 1b l'inversera. **Il est vert au commit, et c'est la seule façon honnête de clore cette sous-tâche.**
- [ ] **Étape 2 — relever les sauts, et les écrire ici.** ⚠️ **La grandeur échantillonnée doit être la MÊME de part et d'autre de la bascule de mode** — sinon on compare deux repères et le relevé ne veut rien dire. C'est le piège de cette tâche. **Cette liste est le plan de travail des Tâches 1b et 1c.**
- [ ] **Étape 3 — LA CLÔTURE DU §0**, les quatre commandes dans l'ordre, puis commit.


#### Tâche 1b — le changement de repère

- [ ] **Étape 1 — le test qui échoue**, sur l'instrument de la Tâche 1a : *l'altitude est **monotone et sa dérivée seconde bornée** sur une descente de 1 600 km à 2 km*. ⚠️ **C'est l'inverse du test de caractérisation de la 1a : celui-ci passe au rouge et celui-là devient faux. Retirez le test de caractérisation dans le même commit** — deux tests contradictoires verts sont pires qu'aucun.
- [ ] **Étape 1 bis — geste par geste.** `up`, `near`/`far`, pose, `minDistance` : chacun devient une fonction continue de l'altitude, ou disparaît.
- [ ] **Étape 2 — la frontière `globe.js` / `terrain.js`.** ⚠️ **C'est le geste le plus lourd : aujourd'hui l'un s'éteint quand l'autre s'allume.** Dites ce qui les fait coexister — recouvrement, fondu, ou remise du globe au rang de fond lointain.
- [ ] **Étape 3 — retirer le plancher orbital `modes.js:326`**, et unifier les **quatre** sites de `minDistance` (`:326`, `:420`, `:639`, `main.js:1215`) en une seule dérivation.
- [ ] **Étape 4 — mutation** : réintroduire un saut doit tuer le test de monotonie de la Tâche 1a.
- [ ] **Étape 5 — LA CLÔTURE DU §0**, les quatre commandes dans l'ordre, puis commit.

#### Tâche 1c — les mécanismes qui figent l'entrée

⚠️ **Aucune version de ce plan ne les nommait, et ils gèlent la caméra plus longtemps que les rideaux.**

- [ ] **Étape 1 — DÉVERROUILLER `this.busy` ET `demBusy`. ⚠️ CE PLAN N'AVAIT ICI QUE DES CONSTATS, SANS UN SEUL VERBE À L'IMPÉRATIF.**
  - `this.busy` — **dix-huit sites** dans `modes.js` (`:138`, `:203`, `:242`, `:296`, `:308`, `:386`…). Tant qu'il est vrai, **la molette, `flyTo`, les steppers et la caméra sont gelés**.
  - ⚠️ **`demBusy` — SECOND VERROU, ZÉRO MENTION DANS TOUTES LES VERSIONS DE CE PLAN.** Six sites dans `main.js` (`:3057`, `:3384-3385`, `:3413`, `:3602-3603`, `:3619`), il garde `canStep` **avec** `modes.busy`, et `:3602` lève `throw new Error('terrain busy')` → **bandeau « FAILED » à l'écran**.
  - **Le geste :** remplacer le verrou qui **interdit** le geste par un verrou qui **le met en file et le rejoue** à la fin de l'opération en cours. ⚠️ **Un verrou qui refuse est indistinguable d'une application qui a planté.**
  - **Le seuil, et ⚠️ CE PLAN MESURAIT LA MAUVAISE CHOSE** : une version prescrivait « `busy || demBusy` vrai, image par image ». **Un verrou qui met en file RESTE VRAI** — la métrique n'aurait pas bougé alors que le défaut aurait disparu. **Mesurez les GESTES REFUSÉS** : nombre d'entrées utilisateur (molette, `flyTo`, steppers) ignorées ou rejetées sur le vol de référence. **Cible : zéro.** ⚠️ **Et ne promettez pas « l'entrée morte sous 1 s » à cette étape** : le chargement lui-même dure, seul son caractère bloquant disparaît ici.
- [ ] **Étape 2 — `_loadDive` / `diveTo`** — le clic-plongée, **un second chemin de plongée entier**, distinct de `_dive`, avec un recul de caméra de **×3,32 à ×24,25** (le maximum se dérive du dépôt : `surfaceMaxDistance 150 × 0,97 / minDistance 6`).
- [ ] **Étape 3 — `enterOrbit`** (`modes.js:296`) — la remontée. ⚠️ **Mesuré : elle est PIRE que la descente — 11 rideaux contre 8, 35,3 % d'écran blanc, 70,8 % d'entrée morte.**
- [ ] **Étape 3 bis — le bandeau `announce` / `.fui-msg`. ⚠️ 11,18 s SUR 30, ET AUCUNE VERSION DE CE PLAN NE LE NOMMAIT.** Ce plan a longtemps cité le chiffre sans jamais citer le mécanisme. Le bandeau annonce « ACQUIRING SURFACE DATA », « FX ONLINE », « SURFACE DATA UNAVAILABLE — HOLDING ORBIT » : il **raconte les paliers** que ce chantier supprime. **Dites ce qu'il devient** — il disparaît avec eux, ou il change de propos.
- [ ] **Étape 4 — sortir `dem.meanM` de `surfaceCamAltMeters`** (`main.js:3594-3599`, règle R1), ou dire pourquoi il peut rester.
- [ ] **Étape 5 — poser le point d'appel de `zoomSoutenable`. ⚠️ SANS CETTE ÉTAPE, LA RÈGLE R3 N'A AUCUN PROPRIÉTAIRE.** La Tâche 4 ter fabrique la fonction mais délègue ici la moitié caméra, et cette tâche passe **avant** elle. **Posez le point d'appel sur le chemin de descente et laissez-le inerte** (`zoomSoutenable` renvoyant le zoom demandé) jusqu'à ce que la 4 ter le remplisse. Sinon personne ne le pose jamais.
- [ ] **Étape 6 — mutation** : remettre un gel d'entrée doit tuer le test.
- [ ] **Étape 7 — LA CLÔTURE DU §0**, les quatre commandes dans l'ordre, puis commit.


### Tâche 2 bis : l'escalier de surface ⚠️ 17 RIDEAUX SUR 25

**Fichiers :** modifier `src/modes.js` (`_rescale` `:452`, `_refine` `:436`, `_coarsen` `:445`) · tester `test/escalier-surface.test.js` (créer)

**C'est la première source du pop-up**, et elle n'était dans aucune tâche. Chaque cran de zoom en mode surface passe par `_rescale`, qui pose un rideau blanc **et téléporte la caméra** au point de présentation.

⚠️ **CETTE TÂCHE ET LA TÂCHE 1 SE MARCHENT DESSUS, ET L'ORDRE COMPTE.** Elles partagent `_arrivalPose` (`modes.js:358`, appelée par `_dive` `:417` **et** par `_rescale` `:469`), `loadSurface` et `_whiteout`. **Faites la Tâche 1 d'abord** : elle rend la pose continue, et **le « vérifier qu'il échoue » de celle-ci pourrait alors ne plus échouer**. Si c'est le cas, **c'est une bonne nouvelle, pas un test cassé** — écrivez-le et passez à l'Étape 3.

⚠️ **À TRANCHER AVEC ADRIEN AVANT DE COMMENCER.** Le commentaire de `:455` porte la mention *« Remplace la continuité d'altitude v42 »* : **une continuité d'altitude a déjà existé ici et Adrien l'a fait retirer.** Il faut savoir pourquoi avant de la rétablir. **C'est une question, pas une tâche.**

- [ ] **Étape 0 — trancher la forme du test, comme la Tâche 1a.** ⚠️ **Le test d'exécution n'est écrivable par aucune des deux voies que ce plan nomme** : `Modes` appelle `document.createElement`, pas de jsdom, aucun test ne l'instancie. **Module pur ou assertion de texte source : dites lequel avant l'Étape 1.**
- [ ] **Étape 1 — le test qui échoue : LE RIDEAU, ET LUI SEUL.** *Un changement de cran en mode surface ne pose aucun `_whiteout`.* ⚠️ **N'y mettez PAS la téléportation** — une version de ce plan l'y avait mise tout en interdisant de la retirer, ce qui rendait la tâche insoluble.
- [ ] **Étape 2** — le lancer, vérifier qu'il échoue.
- [ ] **Étape 3 — retirer le rideau de `_rescale`.** ⚠️ **C'est l'appelant `modes.js:468`, et il appartient à CETTE tâche** — la Tâche 2 ter traite les trois autres.
- [ ] **Étape 4 — mutation** : remettre le rideau doit tuer le test.
- [ ] **Étape 5 — LA TÉLÉPORTATION : ⚠️ NE LA RETIREZ PAS SANS ADRIEN, ET CETTE CASE PEUT RESTER OUVERTE.** `modes.js:455-458` porte « **v48 (retour Adrien)** : à chaque traversée d'étage on arrive au POINT DE PRÉSENTATION… **Remplace la continuité d'altitude v42** ». **C'est une demande explicite d'Adrien, avec sa raison écrite** ; la retirer, c'est défaire v48 pour revenir à v42. **Voir §9.** Tant que la réponse manque, **laissez-la, signalez-le, et clôturez sans elle.**
- [ ] **Étape 6 — LA CLÔTURE DU §0**, les quatre commandes dans l'ordre, puis commit.

### Tâche 2 : retirer la carte `#loading` ⚠️ C'EST LE POP-UP QU'ADRIEN NOMME

**Fichiers :** modifier `src/main.js` (`showLoading` `:908`, `hideLoading` `:912` **et ses trois appelants**, `LOADING_MIN_MS` `:898`, les appels `:3182` et `:3421`, **et `:937` — voir le piège**) · modifier `src/style.css` (`#loading` `:19-`, `body.ld-warm #loading-bg` `:168`, `body.ld-warm #app` `:182`, **et le `filter: blur(16px)` de `:186` sous le sélecteur `:has()` de `:185`**) · modifier `index.html` (le balisage, le peintre en ligne, `__ldStart`) · lire `src/ui/loading-hints.js` et `src/ui/hub.js` · tester `test/voile-loading.test.js` (créer)

⚠️ **ÉLARGISSEZ CETTE LISTE, NE LA REMPLACEZ PAS.** Ce plan a commis deux fois la même faute — corriger un repère faux en supprimant les justes qui l'entouraient. **Faites `grep -rn "loading\|ld-warm" src/ index.html` avant de commencer, et ajoutez ce que vous trouvez.**

⚠️ **CE PLAN A CRU QU'IL Y AVAIT TROIS FICHIERS : IL Y EN A SIX.** Cherchez `#loading` partout avant de commencer.

**Ce que c'est :** une carte de marque centrée — nom, baseline, orbe qui tourne — avec `#loading-bg` plein écran et **`LOADING_MIN_MS = 2000`, deux secondes minimum au premier affichage**. `showLoading()` est appelé **à chaque cran de zoom** par `loadSurface → fetchAndBuildDem` (`main.js:3182`).

⚠️ **ET ELLE FLOUTE L'APPLICATION ENTIÈRE À 16 px PENDANT QU'ELLE EST LÀ — À L'ARRÊT** (`style.css:185-186`). **C'est le contraire exact de la décision 13**, qui n'accepte le flou que **pendant** le mouvement.

⚠️ **PIÈGE DE RÉGRESSION, ET IL N'EST PROTÉGÉ PAR AUCUN TEST :** `hideLoading()` est le **seul endroit qui pose `ld-warm`** (`main.js:937`). Le supprimer sans le remplacer emporte tout le comportement de chargement à chaud. **Et aucun test ne charge `main.js`** — le filet n'existe pas.

⚠️ **CETTE TÂCHE ET LA TÂCHE 7 SE CONTREDISENT, ET AUCUNE DES DEUX NE LE SAIT.** `fenetre-finesse.js:135-149` mesure **1 516 ms de gel** pour la bascule vers 768 à champ non cuit, déclare la cuisson **incompressible** (285 ns le point, 5,31 M points), et dit que **ce qui est déplaçable, c'est le MOMENT : « sous le voile de chargement, où l'on attend déjà, plutôt qu'en pleine contemplation »** — le voile que cette tâche retire. **Tranchez-le explicitement : où va la seconde et demie une fois le voile parti ?**

⚠️ **NE FAITES PAS CETTE TÂCHE EN PREMIER.** La carte masque une attente réelle. L'ôter avant que les Tâches 1a-1c, 2 bis et 4 aient supprimé l'attente **ne supprime pas le pop-up : il montre le trou qu'il cachait.**

- [ ] **Étape 1 — le test qui échoue.** ⚠️ **Pas de test d'exécution** : aucun test n'importe `main.js`. **Assertion de texte source**, comme les onze fichiers de ce dépôt qui le font déjà : *`showLoading` n'est plus appelé sur le chemin du zoom*. ⚠️ **Et une seconde assertion sur le flou** : `style.css` ne floute plus `#app` à l'arrêt.
- [ ] **Étape 2** — le lancer sur le code d'aujourd'hui, vérifier qu'il échoue **sur les deux assertions**.
- [ ] **Étape 3 — retirer l'appel du chemin de zoom**, en gardant le premier affichage au démarrage — c'est le seul légitime.
- [ ] **Étape 4 — reloger `ld-warm`** ailleurs que dans `hideLoading`, ou dire pourquoi il disparaît avec.
- [ ] **Étape 5 — mutation** : remettre l'appel doit tuer le test.
- [ ] **Étape 6 — LA CLÔTURE DU §0**, les quatre commandes dans l'ordre, puis commit.

### Tâche 2 ter : retirer le fondu blanc `.whiteout` ⚠️ EN DERNIER

**Fichiers :** modifier `src/modes.js` (`_whiteout` `:282`, sa création `:271-273`, ses **quatre** appelants `:312`, `:408`, `:468`, `:628`) · modifier `src/style.css` (`:535-547`) · tester `test/voile-whiteout.test.js` (créer)

⚠️ **UNE PREMIÈRE VERSION DE CETTE TÂCHE DÉSIGNAIT TROIS LIGNES DE COMMENTAIRE** — `main.js:927`, `:3423`, `:3447`, trouvées en cherchant le mot « voile ». **Le rideau est fabriqué par `Modes` lui-même** : `_buildDom` crée le `div.whiteout` (`modes.js:271-273`) **sans passer par le constructeur**, donc aucun `grep` de `main.js` ne pouvait le voir. `_whiteout` = **480 ms opaque + 480 ms de retour**.

⚠️ **C'EST LA DERNIÈRE TÂCHE DU BLOC.** Le fondu masque le changement de repère de la Tâche 1 et la téléportation de la Tâche 2 bis. **Tant qu'elles ne sont pas faites, l'ôter rend le saut visible au lieu de le supprimer.**

- [ ] **Étape 1 — le test qui échoue** : **assertion de texte source** — aucun appel à `_whiteout` ne subsiste sur le chemin du zoom continu.
- [ ] **Étape 2** — le lancer sur le code d'aujourd'hui, vérifier qu'il échoue. ⚠️ **SI LES TROIS APPELANTS ONT DÉJÀ DISPARU** — les Tâches 1b, 1c et 2 bis passent avant et peuvent les emporter — **le test ne peut plus échouer. C'est une bonne nouvelle, pas un test cassé** : écrivez-le, gardez le test comme garde-fou contre le retour du rideau, et passez à l'Étape 4.
- [ ] **Étape 3 — trancher les TROIS appelants restants** : `:312`, `:408`, `:628`. ⚠️ **`:468` appartient à la Tâche 2 bis** — ce plan l'a réclamé deux fois. ⚠️ **`:408` est celui de `_dive`** : il ne peut partir qu'après les Tâches 1b et 1c. ⚠️ **Et l'un d'eux devient peut-être « l'indicateur discret » de la descente bornée — c'est la PREMIÈRE QUESTION DU §9, sans réponse.** Si elle manque, **posez une transition neutre et signalez-le**.
- [ ] **Étape 4 — mutation** : remettre un appel doit tuer le test.
- [ ] **Étape 5 — LA CLÔTURE DU §0**, les quatre commandes dans l'ordre, puis commit.


### Tâche 4 : rendre `MAX_Z` ATTEIGNABLE — et non le descendre ⚠️ LA PREMIÈRE DU BLOC QUADTREE

**Fichiers :** modifier `src/globe.js` (`_traverse`, seuil d'horizon, crédit) · **modifier `src/main.js`** (le seul fichier qui lit `FLAGS` sur ce chemin) · modifier `src/flags.js` (poser `globeContinu`) · modifier `test/globe-eviction.test.js` (déverrouiller `:204` et `:208`, **et lui donner une caméra**) — ⚠️ **aucune des trois corrections ne touche `MAX_Z` ni `CACHE_MAX`**, contrairement à ce qu'annonçait ce plan.

⚠️ **LA PRÉMISSE DE CETTE TÂCHE ÉTAIT FAUSSE.** Ce plan écrivait « le quadtree s'arrête à z11 ». Il n'y arrive **jamais** : mesuré, il plafonne à **z7**, et `MAX_Z = 11` est du code mort. Monter une constante qui n'est pas atteinte ne produit rien.

⚠️ **ET LA PREMIÈRE VERSION DE CETTE RÉÉCRITURE ÉTAIT FAUSSE AUSSI** — elle annonçait z6, cinq niveaux débloqués, et proposait un plancher de crédit qui **aggrave** le défaut. Un validateur a rejoué la mesure. **Les chiffres ci-dessous sont les siens, pas ceux du premier audit.**

#### Les trois causes — vérifiées dans le code, deux fois

1. **Le crédit de raffinement est nul en régime établi** (`globe.js:759`). Mesuré sur 24 images consécutives, six régimes : `marge = 0`, crédit octroyé **0**, **54 à 91 raffinements refusés par image, indéfiniment**.

   ⚠️ **MAIS `marge` N'EST PAS « VIDE PAR CONSTRUCTION » — ce plan l'a écrit, et c'est faux.** Le filet anti-gel du commentaire **fonctionne, à la discontinuité** : téléport Mont-Blanc saturé → Nouvelle-Zélande, `marge` vaut 280, puis 196, puis 24, puis 0 en quatre images — **280 requêtes financées**. C'est pourquoi le test « cache saturé puis la planète TOURNE » passe. **Toute réécriture du crédit doit conserver cette propriété.**

   ⚠️ **Et une valeur de 404 a été affirmée pour `marge` : c'est un artefact de sonde, décalée d'exactement une image.** Lue **après** le retour d'`update()`, elle trouve `this.frame = F` mais des marques posées à `F`, calcule `prev = F−1` qui ne correspond plus à rien, et compte **toutes les tuiles non racines prêtes** : au démarrage à froid elle rend 48, 156, 388, 404 — **toujours `tiles.size − 16`**. **Ce n'est pas une marge, c'est un effectif.**
2. **Le seuil d'horizon est une constante** (`globe.js:770`) : `dot < −0.35` (110°) au lieu du vrai horizon géométrique. À basse altitude, le code parcourt une calotte de plusieurs ordres de grandeur trop large.
3. **Aucun test de frustum dans `_traverse`** — zéro occurrence dans le fichier.

#### ⚠️ LE PLANCHER DE CRÉDIT — IL N'Y A PAS DE FALAISE À ENCADRER, IL Y A UN RÉGIME CHAOTIQUE

**Arbitré au banc le 2026-08-20** (`.superpowers/sdd/arbitrage-marge-zoom.md`), après que trois audits ont rendu trois réponses différentes. Balayage du plancher — 0, 4, 8, 16, 32, 64, 128, ∞ — relevé **image par image**, ce qu'aucun des trois n'avait fait :

- **Plancher ≥ 16, et ∞ : cycle limite de période 4.** Le globe **retombe à ses 16 tuiles racines une image sur quatre** (4→5→6→**2**→4→5→6→**2**). Une sphère nue qui clignote à 60 images par seconde.
- **Plancher 8**, le moins mauvais : oscille z6↔z8, ±22 % de tuiles dessinées, et **28 requêtes par image caméra strictement immobile, sans fin** — contre **0,0 aujourd'hui**.

⚠️ **Aucune valeur de plancher ne rend un état stable.** Ce plan a successivement écrit 64, puis 16, puis « la falaise est entre 8 et 16 » : **les trois cherchaient une marge autour d'un seuil qui n'existe pas.** Un tableau qui montre une falaise échantillonne une oscillation à une phase arbitraire.

⚠️ **ET LE CRÉDIT N'EST PAS LA CAUSE DU PLAFOND — IL EN EST LE MARQUEUR.** `crédit = CACHE_MAX − tiles.size + marge` vaut 0 **parce que** `tiles.size = CACHE_MAX = 420`, et le cache est plein **parce que 304 feuilles z6 couvrent tout l'hémisphère visible**. Le point fixe est le **budget**, pas le crédit. Relever le crédit avant de réduire l'emprise ne fait qu'accélérer le remplissage d'un cache déjà plein — **×14 sur le trafic, mesuré : 420 → 4 139-5 888 requêtes.**

#### ⚠️ Ce que la mesure ne dit PAS, et qu'il faut établir

- ⚠️ **LE CHAMP DE VISION N'EXPLIQUE RIEN DU DÉSACCORD DE BASE, ET CE PLAN A ÉCRIT LE CONTRAIRE.** Vérifié : `grep -ic fov src/globe.js` rend **0**, et `_traverse(t, camPos, camDir)` ne reçoit **que la position et la direction** de la caméra. **Le champ de vision ne peut pas influencer le zoom atteint dans le code d'aujourd'hui.** Il le pourra une fois le frustum de l'Étape 4 posé — c'est **à partir de là seulement** que toute mesure doit dire son fov (celui de production est **30°**, `main.js:263`).
- ⚠️ **LE ZOOM DE BASE N'A PAS DE VALEUR UNIQUE, ET CE PLAN A EU TORT DE GRAVER z6.** Quatre bancs ont rendu **z5, z6, z7 et z9** — et l'arbitrage a montré pourquoi : **c'est une grandeur à hystérésis**, qui dépend de l'état du cache à l'entrée et du protocole de parcours. Le plus large relevé (44 mesures, 11 altitudes × 4 latitudes, globe promené) donne **z6, 304-306 dessinées, 420 en cache, 0,0 requête au repos** ; un globe **neuf** à chaque station donne **z9** ; un autre banc **z5, 278 dessinées, 408 en cache**. **Aucun n'est faux.** ⚠️ **N'en recopiez aucun : l'Étape 1 établit le vôtre, en disant son protocole.**
- ✅ **Ce qui est vrai dans les quatre : l'altitude ne change rien.** Le globe est aussi grossier à 2 km qu'à 1 600 km, sur un facteur 800. **C'est le symptôme, et il ne dépend d'aucun banc.**
- ⚠️ **« 124 tuiles dessinées après correction » vient du banc dont le zoom de base n'est pas reproductible. À re-mesurer, ne le prenez pas comme objectif.** Ce qui tient : ce n'est pas 74, qui recollait deux paliers.
- ⚠️ **L'horizon SEUL ne débloque rien** : z7 → z7. Il ne devient utile qu'accompagné du frustum, **qui fait tout le travail**. Un audit lui a attribué un niveau de zoom : c'est faux.
- **Le même relevé donne un cache de 824** — c'est-à-dire **le double de `CACHE_MAX`**. ⚠️ Or l'étape sur le cache ci-dessous propose `5 × visibles` ≈ 370, ce qui **défait** ce que les trois causes viennent de débloquer. **Cette contradiction se tranche par la mesure, pas par un arbitrage d'écriture.**
- **La formule d'horizon a besoin de sa marge de corde.** Transcrite nue, elle écrête au limbe et **crée des trous**. Et les racines `z2` doivent en être exemptées.

#### ⚠️ L'ORDRE DES ÉTAPES EST LE SUJET — mesuré, pas déduit

**Le correctif de crédit appliqué SEUL empire tout** : mesuré à **5 676 requêtes** (×14) et un zoom qui **retombe à 2**. Il ne devient bénéfique qu'une fois la calotte réduite. Le tri spatial d'abord, le budget ensuite. **Ne réordonnez pas ces étapes.**

⚠️ **Et les tests verrouillent le défaut** — `test/globe-eviction.test.js:204` et `:208` : `zoomFinal >= 6` et `visiblesFinal > 200`, avec un commentaire qui explique que z6 est une limite de budget. Le plafond a été compris, puis **inscrit comme contrat**. Pire : `visiblesFinal > 200` **fait échouer le bon correctif**, qui descend à 17-30 tuiles. Les 17 tests passent pendant que le globe est gelé. **Si vous ne déverrouillez pas ces assertions d'abord, le rouge vous fera annuler la correction.**

#### Les étapes

- [ ] **Étape 0 — POSER LE DRAPEAU `globeContinu`, ET LE BRANCHER.** ⚠️ **`src/globe.js` n'importe PAS `flags.js` — vérifié, zéro occurrence.** Les seuls lecteurs de `FLAGS` sont `main.js`, `fenetre-reglage.js` et `ui/effects-panel.js`. Un drapeau posé dans `flags.js` sans câbler sa lecture **ne protège rien** : les corrections atterrissent sur le globe de production. **Le lecteur est `src/main.js`**, qui construit le globe : il passe l'option au constructeur, et `globe.js` ne connaît qu'un booléen, pas `FLAGS`. Suivre le patron de `FLAGS.fenetreContinue`, déjà en place.
- [ ] **Étape 1 — établir la base, et l'écrire. ⚠️ EN FIXANT L'ÉTAT DU CACHE À L'ENTRÉE, SANS QUOI LE CHIFFRE N'EST PAS REPRODUCTIBLE.** Le zoom atteint est une grandeur **à hystérésis** : même code, globe **neuf** à chaque station → **z9** ; globe **promené** sur les stations à la suite → z7 puis **z6, sans jamais remonter**. La cause est dans le fichier — une bouffée de crédit initiale, puis `tiles.size = CACHE_MAX`. ⚠️ **z6, z7 et z9 sont donc TROIS MESURES JUSTES de trois protocoles différents. N'en interdisez aucune : dites laquelle vous mesurez.**

  Six altitudes **nommées** : **1 600 km · 800 km · 200 km · 60 km · 8 km · 2 km**, à **quatre latitudes** (0°, 30°, 45°, 60° N). Relever zoom effectif, tuiles dessinées, taille de cache et **requêtes par image caméra immobile**, **sur 20 images consécutives, en exigeant la stabilité**. ⚠️ **Et NE COMPTEZ PAS DEPUIS L'IMAGE 0 : un globe neuf met quatre images à se stabiliser.** Jetez les cinq premières, puis relevez les vingt suivantes. Sans cette précaution, « 20 images stables » est impossible à obtenir et l'Étape 1 ne se termine jamais.
- [ ] **Étape 1 bis — DONNER UNE CAMÉRA AU HARNAIS. ⚠️ SANS ELLE, LES ÉTAPES 2 ET 4 SONT IMPOSSIBLES.** Le seul harnais qui fait voler le globe porte `{ position: new THREE.Vector3() }` (`test/globe-eviction.test.js:145` et `:225`) : **aucune orientation, aucune `projectionMatrix`** — zéro `PerspectiveCamera` dans tous les `test/globe-*.test.js`. Sans elle, l'Étape 4 n'a pas de frustum à tester et l'Étape 2 pas d'écran. Prescrivez `new THREE.PerspectiveCamera(30, 16/9, near, 1400)` avec **`near = clamp(orbAlt × 0,2, 0,01, 0,5)`** — ⚠️ **le `clamp` fait partie de la formule** (`modes.js:704`) ; sans lui, le plan proche part à zéro en orbite haute. Les trois valeurs sont dans le dépôt : `main.js:263`, `modes.js:704`, `modes.js:319`.
- [ ] **Étape 2 — DÉVERROUILLER LES TESTS, avant toute correction.** `globe-eviction.test.js:204` (`zoomFinal >= 6`) et `:208` (`visiblesFinal > 200`) décrivent le défaut comme un contrat, et la seconde **fait échouer le bon correctif**.

  ⚠️ **ET L'ASSERTION DE REMPLACEMENT DOIT SORTIR ROUGE AUJOURD'HUI.** Une version de ce plan proposait « toute tuile a un ancêtre `ready` » : **vrai par construction** (racines jamais évincées, règle sans-trou). Une autre disait « le zoom effectif suit l'altitude, au moins trois niveaux distincts » — ⚠️ **ambiguë, et l'une des deux lectures est VERTE aujourd'hui** : les niveaux **dessinés** sur une descente sont {2,3,4,5,6}, soit cinq, et `zoomsDessines` est déjà rempli par `globe-eviction.test.js:159`.

  **La lecture qui mord, et c'est celle-là qu'il faut écrire : `zmax`, relevé sur 20 images stables, prend au moins TROIS valeurs différentes entre les six altitudes nommées de l'Étape 1.** Aujourd'hui il n'en prend qu'une. ⚠️ **Vérifiez le rouge avant d'aller plus loin ; le §0 l'exige.** Et déverrouillez aussi `globe-eviction.test.js:202`.
- [ ] **Étape 3 — l'horizon géométrique**, avec sa marge de corde et l'exemption des racines `z2`. `globe.js:770` : `dot < −0.35` est 110,5° en dur, au lieu de `R/|camPos|` — **2,87° à 8 km**, soit une calotte jusqu'à **×1 076 trop large**. ⚠️ **Seul, il ne débloque AUCUN niveau de zoom** — mesuré z7 → z7. Il réduit la calotte parcourue, ce qui rend l'étape 4 possible ; il ne se juge pas sur le zoom. Test : à basse altitude, le nombre de tuiles parcourues chute d'un ordre de grandeur **sans qu'aucune tuile visible ne disparaisse**. ⚠️ La seconde moitié est celle qui attrape l'écrêtage au limbe.
- [ ] **Étape 4 — le test de frustum** dans `_traverse` (zéro occurrence aujourd'hui). ⚠️ **ET IL A UN PARAMÈTRE CACHÉ QUI VAUT TROIS NIVEAUX DE ZOOM : LA MARGE DU VOLUME ENGLOBANT.** À l'exagération 18 (`globe.js:278`), le relief sort de la sphère de **2,5 unités, soit 159 km**. Mesuré, 20 images stables : marge **0** → z11, cache 156, crédit 264 ; marge **2,5** (la correcte) → **z10, cache 420, crédit 0**. ⚠️ **Autrement dit, avec la bonne marge, le frustum seul NE SUFFIT PAS — et « 2 à 4 % des tuiles dans le champ » ne se reproduit pas : 55 % mesurés à 8 km.** Prenez la marge juste, mesurez, et n'espérez pas le chiffre facile.
- [ ] **Étape 5 — le crédit. ⚠️ À OUVRIR PAR DÉFAUT, après l'Étape 4.** Ce plan a écrit « les deux premières corrections ont suffi » : **faux aux deux altitudes où le socle vit**, une fois donnée au frustum la marge de volume englobant qu'il lui faut. Le crédit reste donc à traiter — mais **après** la réduction d'emprise, jamais avant.

  ⚠️ **CE QUE CETTE ÉTAPE NE DOIT PAS FAIRE : ajouter un plancher constant.** Mesuré, tout plancher ≥ 16 installe un cycle limite de période 4 où la planète retombe à ses 16 racines une image sur quatre. **Le critère d'acceptation porte sur la stabilité image par image** — `zmax` et tuiles dessinées constants sur **20 images**, requêtes au repos à zéro — **jamais sur un relevé à une seule image.**


  Le détail du défaut, pour mémoire : `globe.js:759`, `_credit = CACHE_MAX − tiles.size + marge`. En régime établi `marge = 0` et **54 à 91 raffinements sont refusés par image**. ⚠️ **Mais `marge` n'est PAS « vide par construction » — ce plan l'a écrit deux fois, et c'est faux** : à la discontinuité (téléport), elle vaut 280, 196, 24, puis 0 en quatre images, et finance 280 requêtes. **Le filet anti-gel du commentaire `743-752` tient ; il ne mord qu'aux discontinuités.**
- [ ] **Étape 6 — rendre évinçables les tuiles bloquées.** Une tuile en `error` ou en `loading` dont la requête ne revient jamais **occupe une place du budget définitivement**. C'est le même point fixe, par une autre porte. ⚠️ **Sans retourner l'ordre d'éviction** : ce plan a écrit trois fois « profondeur d'abord, récence ensuite » ; `globe.js` fait délibérément l'inverse — `a.lastUsed - b.lastUsed || parProfondeur(a, b)`, **récence au rang 1, profondeur au rang 2 seulement**, avec vingt lignes de commentaire et un test dédié vert. **C'est correct.** ⚠️ **ET N'ÉVINCEZ PAS UNE `loading` SANS ANNULER SA REQUÊTE** : le `.then` de `_pump` (`globe.js:532`) ajouterait un maillage orphelin. Garde : `if (!this.tiles.has(t.key)) return`.
- [ ] **Étape 7 — trancher le cache**, avec les chiffres de l'Étape 1 et non par principe. ⚠️ Si les corrections réclament 824, une formule qui rend 370 est une régression déguisée en optimisation. **Mesurez avant de choisir.**
- [ ] **Étape 8 — la mémoire retenue pour rien : ~210 Mo sur 327 Mo au cache plein.** `globe.js:238` — le canevas reste vivant via `CanvasTexture.image` après téléversement (**105 Mo**). Et `t.heights` (**105 Mo**) n'est relu que par `setExaggeration` (`:899`), **qui n'a aucun appelant dans tout le dépôt — vérifié**. ⚠️ Le commentaire de `:168` annonce « 380 Mo pour 1 500 tuiles » : la documentation **sous-estime d'un facteur 2,4**.
- [ ] **Étape 9 — les normales de bord.** ⚠️ **l'écrêtage est à `globe.js:257-260`** (`Math.min(..., 254)` / `255`), et non à `:623-648` qui n'en est que le consommateur : `sampleHeights` écrête alors que `tileToLatLon` donne la position complète — pente **407 m au bord contre 853 m au centre**, soit **47,7 % de la vraie pente** — ⚠️ **et ce chiffre n'est pas seulement mesuré, il se DÉRIVE du dépôt** (`gridFor` = 24, plus l'écrêtage) : il vaut donc comme source, pas comme relevé, d'où un liseré d'éclairage autour de chaque tuile.
- [ ] **Étape 10 — LA CLÔTURE DU §0**, les quatre commandes dans l'ordre, puis commit.

**Ce qui est établi, et qui ne dépend d'aucun banc :** l'altitude ne change rien au zoom atteint, et **le budget de cache est le point fixe** — la couverture d'un hémisphère sature `CACHE_MAX` à elle seule. **Réduire l'emprise est donc le seul levier qui attaque la cause.** ⚠️ **Le gain chiffré des étapes 3+4 reste à établir par l'Étape 1**, avec le protocole que vous aurez écrit.

⚠️ **CETTE TÂCHE PASSE AVANT TOUTES LES AUTRES DU BLOC.** Rebrancher la source (4 alpha) d'un quadtree qui n'atteint pas ses niveaux fins ne se verrait pas ; et calibrer un plafond de file (4 bis) avant elle, c'est le calibrer sur un trafic qui va tripler. **L'ordre est 4 → 4 alpha → 4 bis → 4 ter.**


### Tâche 4 alpha : rebrancher le globe sur la vraie source de relief ⚠️ APRÈS LA TÂCHE 4, AVANT LA 4 BIS

**Fichiers :** modifier `src/globe.js` · **modifier `src/bathy.js`** (`overzoomTile`, `:578`) · créer `test/globe-source.test.js` · ⚠️ **modifier les trois fichiers de test qui verrouillent le 256** : `test/globe-reseau.test.js:42-43` et `:97-98`, `test/globe-eviction.test.js:59-60`, `test/globe-precision.test.js:79` et `:83`.

⚠️ **LA LISTE DES VALEURS À CHANGER EST PLUS LARGE QUE `grep 256`, ET LES PIÈGES SONT DES DEUX CÔTÉS.** À changer : les tailles de tuile, **`heights[i + 256]` de `:266` ET `heights[i + 257]` de `:267`** (c'est 256 et 256+1 ; en 512 px ils deviennent 512 et 513, et en oublier un donne des altitudes fausses **en silence, sans ligne mixte visible**), le littéral de `:263`, les deux `254` de `:259-260`, ⚠️ **les deux `255` de `:257-258`, qui sont des BORNES D'INDEX et doivent devenir 511**, et le `256.0` du GLSL `:112`. **À NE PAS TOUCHER** : les deux radix terrarium de `:66` et `:236` — `dem-source.js:3` dit que Mapterhorn utilise le même encodage — et le `255.0` de `:65`, qui est une plage d'octet. ⚠️ **Les `255` de `:257-258` et celui de `:65` ne sont donc PAS de la même famille : ne les traitez pas ensemble.**

⚠️ **C'EST LA FAILLE LA PLUS GRAVE DU PLAN, ET ELLE EST SILENCIEUSE.** Trouvée par l'attaque du 2026-08-20, vérifiée à la main.

`src/globe.js:14` tape **en dur** `elevation-tiles-prod/terrarium` — et `globe.js` **n'importe rien** de `src/dem-source.js` (vérifié : zéro occurrence). Or ce module est la source réelle du produit :

| | source du globe aujourd'hui | source du produit |
|---|---|---|
| jeu | **AWS terrarium** | **Mapterhorn** (`DEFAULT_SOURCE_ID`) |
| résolution | **256 px** | **512 px WebP** |
| contenu | figé à **novembre 2017** | agrège IGN RGE ALTI, swissALTI3D… |
| zoom maximal | **15** | **17** |

Le dépôt écrit lui-même qu'AWS n'a « plus aucune information réelle au-delà de 6,6 m/pixel ».

**Donc promouvoir ce quadtree en « seule source de relief » sans le rebrancher dégraderait toute la matière première du produit — et rendrait le z17 annoncé inatteignable — sans lever la moindre erreur.** Un problème de flux se voit et se mesure ; **une matière première dégradée se livre sans que personne ne s'en aperçoive.**

### ⚠️ La règle d'Adrien, et le vrai danger de cette tâche

**« Privilégie toujours Mapterhorn où il est disponible. »** (Adrien, 2026-08-20.)

**C'est déjà la politique implémentée**, et `dem-source.js` la décrit mieux que ce plan ne saurait le faire :

- Mapterhorn est **la source par défaut** ; AWS est **le repli, pas le choix par défaut**.
- La couverture de Mapterhorn est **variable** : z12 partout sur les terres émergées, **z13 à z17 selon les pays**, et rien au-dessus de z4 en pleine mer.
- ⚠️ **« UN 404 N'EST PAS UNE PANNE. »** C'est Mapterhorn qui dit « je ne couvre pas ici, à ce zoom-là ». On ne bascule donc **jamais** sur un 404 : on surzoome depuis l'ancêtre, ou — si la zone n'est pas couverte du tout — **on prend AWS POUR CETTE ZONE SEULEMENT**.
- Une sonde (`probeMaxZoom`) mémorise le zoom maximal **par zone**, et `fallbackToAws` ne se déclenche que sur une vraie panne — réseau, 5xx, DNS, WebP indécodable — retenue pour toute la session.

⚠️ **LE VRAI DANGER DE CETTE TÂCHE N'EST DONC PAS DE CHOISIR LA MAUVAISE SOURCE : C'EST DE REMPLACER UNE POLITIQUE PAR UNE URL.** Un rebranchement naïf — `TILE_URL = DEM_SOURCES[actif].url` — semblerait juste et perdrait tout : la sonde par zone, le surzoom depuis l'ancêtre, le repli AWS **localisé**, et la distinction entre un 404 et une panne. On aurait alors une seule source pour la planète entière, choisie une fois, au lieu de la meilleure disponible à chaque endroit.

**Ce qu'il faut reprendre, ce sont les fonctions de `dem-source.js`, pas ses URL.**

⚠️ **ET LA POLITIQUE EST ÉCRITE DANS `src/dem.js:245-263`, PAS DANS `dem-source.js`.** Une version de ce plan ne citait pas ce fichier — c'est pourtant là que vivent les trois issues, commentées mot pour mot :

> *« un zoom → on y va, en surzoomant au-delà · null → zone hors couverture (pleine mer) → **AWS POUR CE CHARGEMENT**, sans toucher au choix de session : le bloc d'à côté, sur la terre ferme, doit continuer à profiter de Mapterhorn · panne → repli AWS pour TOUTE la session »*

**C'est ce bloc de dix-neuf lignes qu'il faut réutiliser**, avec `activeDemSource`, `resolveRegionMaxZoom`, `fallbackToAws` et `overzoomTile`. Une « zone » est une **tuile z8** (`REGION_ZOOM = 8`, `dem-source.js:139`).

### ⚠️ LE FAIT QUI CHANGE LE CALCUL DE CETTE TÂCHE

**Mapterhorn rend 404 au-dessus de z4 en pleine mer** (`dem-source.js`, en-tête). Or **la majorité des tuiles d'un globe sont océaniques**. Rebrancher le globe sur Mapterhorn signifie donc que **la plupart de ses tuiles retomberont sur AWS de toute façon** — ce qui est correct, mais change complètement le rapport bénéfice/coût de la tâche.

**Conséquence à trancher avant de commencer :** le gain de Mapterhorn ne se manifeste qu'**en descente sur les terres émergées**. Il est peut-être plus sage de **ne rebrancher que sous un certain zoom** — là où le socle vit — et de laisser le globe orbital sur AWS, qu'il utilise déjà et qui lui suffit. ⚠️ **Cette question est ouverte : elle se tranche par une mesure, pas par une préférence.**

⚠️ **ET LE PÉRIMÈTRE EST PLUS LARGE QU'IL N'Y PARAÎT — mesuré par l'attaque :**
- **Une dizaine d'expressions à 256 en dur** dans `globe.js`, sur huit lignes — ⚠️ **le compte « neuf » n'était pas reproductible : établissez-le et écrivez la liste.** Et il y a deux `255` que `grep 256` ne voit pas (`:257-260`).

⚠️ **DEUX 256 NE DOIVENT PAS ÊTRE TOUCHÉS : `globe.js:66` et `:236`** — c'est le radix de l'encodage terrarium, pas une taille de tuile. `dem-source.js:3` dit que Mapterhorn utilise **le même encodage**. Les confondre casse toutes les altitudes en silence.
- **Trois fichiers de test non déclarés** par ce plan les verrouillent.
- **La mémoire au moins quadruple** en passant de 256 à 512 px à nombre de tuiles constant. ⚠️ **ET CE PLAN DONNE DEUX CHIFFRES INCOMPATIBLES POUR LE MÊME CACHE PLEIN — 242 Mo ici, 327 Mo à l'Étape 8 de la Tâche 4 — puis projette 968 Mo, quand 4 × 242 fait bien 968 mais 4 × 327 fait 1 308.** **Les deux chiffres de départ ne peuvent pas être vrais ensemble : mesurez le vôtre à l'Étape 6 avant de décider quoi que ce soit.**
- Les étapes 3 et 4 de cette tâche **se contredisent** — l'une demande de rebrancher, l'autre que rien ne change pour le globe orbital. **Elles ne peuvent pas être vraies ensemble tant que la question ci-dessus n'est pas tranchée.**
- **256 est codé en dur** plusieurs fois dans `fetchTile` / `sampleTile` de `globe.js`. Mapterhorn sert du **512**. ⚠️ **Trancher explicitement** : soit le globe accepte les deux tailles, soit il rééchantillonne. **Ne pas laisser ce choix à l'improvisation.**
- `TILE_MEMO_MAX` est calibré pour du 256 (≈ 32 Mo) ; en 512 la même valeur ferait **128 Mo**.
- `resolveRegionMaxZoom` est **asynchrone**, et `_pump` de `globe.js` est **synchrone**. La jonction des deux est le vrai travail de cette tâche.

- [ ] **Étape 1** — test : l'URL construite par le globe passe par `DEM_SOURCES[DEFAULT_SOURCE_ID]`, et la profondeur maximale du globe **n'excède jamais** le `maxZoom` de la source active.
- [ ] **Étape 1 bis** — test : sur une zone **couverte** par Mapterhorn, le globe l'utilise ; sur une zone qui rend 404 à z12, il bascule sur AWS **pour cette zone**, et **continue d'utiliser Mapterhorn ailleurs dans la même session**. ⚠️ C'est l'assertion qui distingue une politique d'une URL.
- [ ] **Étape 2** — le lancer, vérifier qu'il échoue (aujourd'hui l'URL est en dur).
- [ ] **Étape 3 — TRANCHER LA QUESTION OUVERTE, en une ligne écrite ici.** ⚠️ Ce plan écrivait que ses étapes se contredisaient et laissait l'agent le signaler. **Ce n'est pas une tâche, c'est un renvoi.** La question : rebranche-t-on le globe **entier**, ou seulement **sous un zoom donné**, là où le socle vit ? ⚠️ **Et la mesure qui tranche se fait ICI, pas plus loin** — ce plan renvoyait à une étape ultérieure qui dépendait elle-même de celle-ci : **mesurez mémoire et requêtes du globe orbital en 256 puis en 512 avant de décider**, c'est l'affaire de vingt minutes et cela lève la boucle.
- [ ] **Étape 4 — la jonction `resolveRegionMaxZoom` async contre `_pump` synchrone.** ⚠️ **C'est le vrai travail de cette tâche, et aucune étape ne le portait.** La sonde par zone est asynchrone ; la pompe qui décide quelle tuile demander ne l'est pas. Dites ce que `_pump` fait pendant que la sonde n'a pas répondu : attendre (et geler), supposer AWS (et perdre Mapterhorn au premier passage), ou demander quand même et corriger après.
- [ ] **Étape 5 — les tailles.** Établir puis remplacer **la liste** des `256` de taille de tuile — ⚠️ **sans toucher aux deux radix terrarium (`globe.js:66` et `:236`)** — et traiter les deux `255` de `:257-260`. Puis `TILE_MEMO_MAX`, dont le budget est exprimé en tuiles et non en octets.
- [ ] **Étape 6 — la mémoire, mesurée avant de décider.** Le passage de 256 à 512 px **multiplie par quatre** l'occupation par tuile. ⚠️ **Relevez le cache plein en 256 px vous-même** — ce plan en donne deux valeurs contradictoires — **puis projetez, puis ajustez le nombre de tuiles. Pas l'inverse.**
- [ ] **Étape 7** — ⚠️ **vérifier que le globe orbital reste identique** sur ce que l'étape 3 a décidé de ne pas changer. C'est une fonction en production.
- [ ] **Étape 8** — mutation : revenir à l'URL en dur doit tuer le test.
- [ ] **Étape 9 — LA CLÔTURE DU §0**, les quatre commandes dans l'ordre, puis commit.

**Si cette tâche est jugée trop lourde**, l'alternative honnête est de **plafonner `MAX_Z` à 13 et de l'écrire** — mais alors la décision 1 (« de l'orbite au sol ») devient fausse, et il faut le dire à Adrien.

### Tâche 3 : `seuil-socle.js` — quand le socle naît et meurt

**Fichiers :** créer `src/monde/seuil-socle.js` · **lire `src/landmarks.js` et `src/dem-emprise.js` avant d'écrire** · tester `test/seuil-socle.test.js`

**Interfaces produites :**
- `socleVisible({ altitudeEllipsoideM, visibleAvant })` → `boolean`
- `empriseSocle({ centre, zoom })` → `{ ouest, sud, est, nord }` — ⚠️ **CETTE TÂCHE EST LE PRODUCTEUR D'`emprise`, que les Tâches 4 bis, 6 et 7 consomment et que personne ne fabriquait.** Elle se dérive de `blockExtentMeters` (`landmarks.js:22`) une fois le zoom du socle tranché ci-dessous. **Regardez d'abord `originesEmprise` et `rectFenetre` de `dem-emprise.js` : ils font peut-être déjà le travail.**
- `SEUIL_NAISSANCE_M`, `SEUIL_MORT_M` — **À MESURER.**

⚠️ **UNE VERSION DE CE PLAN AVAIT ÉCRIT 120 km ET 180 km, ET LES AVAIT RÉFUTÉES AVEC UN CHIFFRE QUI N'EXISTE PAS.** « Un socle de 3,56 km » : **cette valeur ne se trouve nulle part dans le dépôt**, et six chiffres de ce plan en descendaient. La vraie largeur vient de `blockExtentMeters(zoom, lat)` (`landmarks.js:22`, avec `BLOCK_TILES = 3`) et **dépend du zoom** — exécuté à 45° de latitude : **z13 = 10,4 km · z14 = 5,2 km · z15 = 2,6 km · z16 = 1,3 km**.

⚠️ **ET CELA REND UNE QUESTION VISIBLE QUE CE PLAN NE TRANCHAIT NULLE PART : À QUEL ZOOM LE SOCLE SE POSE-T-IL ?** Tant qu'elle est ouverte, aucun seuil d'altitude ne peut se calculer — la largeur varie d'un facteur huit entre z13 et z16. **Tranchez-la ici, avant le protocole.**

Pour mémoire, l'erreur d'origine : à un champ de 30°, un socle occupe **5,6 % de l'image** depuis 120 km — et le dépôt lui-même place 120 km au palier **z8** — ⚠️ ce plan écrivait z9, et c'est faux : `pickDiveTier(120000)` rend `{ altM: 200000, zoom: 8 }`, **exécuté** ; z9 couvre 50 à 100 km (`modes.js`, `DIVE_TIERS`), c'est-à-dire précisément l'altitude que la règle R3 qualifie d'« autre carte ».

**Protocole :** partir de la demande d'Adrien — « le crop apparaît quand la Terre occupe une partie assez importante de l'écran » — la traduire en **fraction d'image occupée par le socle**, viser autour de **60 % de la HAUTEUR de l'image**, et en déduire l'altitude par la trigonométrie du champ de vision (**30°**, `main.js:263`). ⚠️ **La hauteur et non la largeur, parce que le champ de vision de three.js EST vertical** — se tromper d'axe déplace le seuil d'un facteur égal au rapport d'aspect, **1,7 en 16/9**. Et 60 % linéaire n'est pas 60 % surfacique : encore un facteur 1,3.

⚠️ **ET LEVEZ LA CIRCULARITÉ AVANT DE CALCULER.** Si l'emprise suit le cadrage, la fraction d'écran est **constante par construction** et ne peut pas servir de seuil. Le calcul n'a de sens qu'avec **une largeur de socle FIXE** — celle du zoom que vous venez de trancher. ⚠️ **Puis convertir en altitude, et ne garder QUE l'altitude** : la fraction d'écran dépend du terrain chargé, ce que la règle R1 interdit.

**Ce qui est non négociable**, en revanche : `SEUIL_MORT_M` strictement supérieur à `SEUIL_NAISSANCE_M`. C'est l'écart qui empêche le clignotement, quel que soit le couple retenu.

⚠️ **L'ENTRÉE EST UNE ALTITUDE DE CAMÉRA AU-DESSUS DE L'ELLIPSOÏDE, PAS UNE FRACTION D'ÉCRAN.** Règle R1. Une fraction d'écran dépend de la distance au sol, donc du terrain chargé, donc de `meanM`, qui est lissé — on fabriquerait un oscillateur.

⚠️ **Hystérésis obligatoire** : `SEUIL_MORT_M` strictement supérieur à `SEUIL_NAISSANCE_M`. Même patron que `SPLIT_RATIO` / `MERGE_RATIO` dans `globe.js`, éprouvé sur ce dépôt.

- [ ] **Étape 1** — test : en descendant, le socle naît à `SEUIL_NAISSANCE_M` ; en remontant, il ne meurt qu'à `SEUIL_MORT_M`. Puis celui qui compte : **osciller cent fois autour du seuil de naissance ne produit qu'une seule bascule**.
- [ ] **Étape 2** — le lancer, vérifier qu'il échoue.
- [ ] **Étape 3** — implémenter `socleVisible` **et** `empriseSocle`, après avoir tranché le zoom du socle et vérifié ce que `dem-emprise.js` fournit déjà.

- [ ] **Étape 4** — mutation : égaliser les deux seuils tue le test d'oscillation.
- [ ] **Étape 5 — LA CLÔTURE DU §0**, les quatre commandes dans l'ordre, puis commit.

### Tâche 4 bis : LE FLUX QUI NE SE COINCE PAS ⚠️ APRÈS LES TÂCHES 4 ET 4 ALPHA

⚠️ **CETTE TÂCHE PORTAIT « EN PREMIER ». C'ÉTAIT L'ORDRE INVERSE DE CE QUI EST MESURÉ.** La Tâche 4 change ce que cette tâche est censée calibrer : après horizon + frustum, le pic de `loading` passe de **0 à 246** et le trafic d'un panoramique de **596 à 1 786 requêtes**. `PLAFOND_FILE` ne peut pas se calibrer avant. Et la Tâche 4 alpha fait passer les tuiles de PNG 256 px à WebP 512 px : **le bouchon écrit ici serait périmé le jour où elle s'exécute.**

**L'ordre est donc : 4 → 4 alpha → 4 bis → 4 ter.**

**Fichiers :** créer `src/monde/flux-terrain.js` · modifier `src/globe.js` · tester `test/flux-terrain.test.js` — ⚠️ **LISEZ `src/dem-emprise.js` AVANT DE CRÉER** : `originesEmprise`, `recollerEmprise`, `enVolBorne` et `EMPRISE_EN_VOL_MAX` font déjà une partie de ce travail, en production, derrière `FLAGS.fenetreContinue`.

**Interfaces produites :**
- `demanderEmprise(flux, { emprise, zoom })` → `void`
- `tuilesPretes(flux, emprise)` → `Map`
- `creerFlux({ globe })` → `flux` — la fabrique ; **aucune autre tâche ne la définit, elle appartient à celle-ci**
- `zoomEffectif(flux, emprise)` → `number` — le zoom réellement COUVERT, distinct du zoom demandé
- `debitObserve(flux)` → `number` — le débit en Mb/s déduit des tailles et durées des réponses déjà passées par ce flux. ⚠️ **SANS LUI LA TÂCHE 4 TER NE PEUT PAS COMMENCER** : elle consomme `debitObserveMbs`, et personne ne le produisait — signalé quatre fois. **Il se fabrique ici, dans une case à cocher de cette tâche.**
- `remplirHauteurs(flux, { emprise, n, sortie })` → `{ remplis, manquants }` — remplit **en une passe** un `Float32Array` de (n+1)² hauteurs pour l'emprise donnée.

⚠️ **PAR LOT, PAS PAR PIXEL, ET C'EST MESURÉ.** Une version de ce plan proposait `lireHauteur(flux, {x, y, z})`, appelée une fois par sommet. L'attaque l'a chronométrée : **+3,5 ms par reconstruction à N=256** (de 0,11 à 3,65 ms), **sans même l'interpolation bilinéaire** — sur un budget déjà déclaré dépassé à 8,3 ms. L'interface commode aurait mangé à elle seule la moitié de ce qui reste.

Une passe par tuile touchée, pas un appel par sommet.
- `PLAFOND_FILE` — longueur maximale de `this.queue`. ⚠️ **Ce n'est PAS le plafond de requêtes simultanées**, qui existe déjà (`MAX_CONCURRENT = 6`) et qu'on ne touche pas.

⚠️ **À MESURER — et une valeur inventée a déjà été réfutée ici.** Ce plan a écrit **512**. Mesuré par l'attaque : sur un panoramique, `loading` **plafonne à 286 à toutes les latences essayées** — l'assertion passait donc sur le code cassé, et la mutation ne pouvait rien tuer. Et **512 dépasse `CACHE_MAX` = 420** : la file seule aurait pu occuper plus que le budget entier du cache, provoquant le gel qu'elle prétend empêcher.

**Protocole :** mesurer le maximum de `loading` atteint sur le panoramique de référence à trois latences (nominale, ×4, ×24), puis choisir **strictement en dessous de ce maximum ET strictement en dessous du budget de cache**. La valeur n'a de sens que si l'assertion **échoue** sur le code d'aujourd'hui : le vérifier avant de la retenir.

**Le défaut, mesuré par l'attaque.** Un panoramique latéral à 4 km d'altitude, 90° de balayage : **2 943 tuiles bloquées en `loading`** *(⚠️ mesuré sur le PROTOTYPE modifié ; dans `src/globe.js` tel quel le crédit plafonne autour de 840, donc attendez-vous à un chiffre plus bas — le défaut est le même, son ampleur non)*, crédit à −2 551, **zoom effectif figé à z2**, **aucune récupération après 30 s d'immobilité**. Une traversée suffit pour que le vol suivant reste à z2.

**Trois causes, trois corrections.**

⚠️ **UNE VERSION DE CE PLAN SE TROMPAIT SUR LA PREMIÈRE, ET UN AGENT L'AURAIT CHERCHÉE EN VAIN.** Elle disait « les requêtes ne sont pas plafonnées ». **C'est faux** : `globe.js:17` porte `MAX_CONCURRENT = 6`, et `:527` le respecte. Le vrai défaut est ailleurs.

1. **La FILE n'est pas bornée.** `_request` marque une tuile `loading` **AVANT** de l'enfiler : le nombre de requêtes en vol est bien plafonné à six, mais rien ne borne `this.queue`, et chaque entrée y est déjà comptée comme `loading`. D'où les 2 943.
2. Aucune requête n'est **annulée** quand le cadrage a changé — il n'y a pas un seul `AbortController` dans le fichier.
3. `_evictJusqua` (`globe.js:863`) ne filtre que sur `ready` — **une tuile `loading` occupe une entrée pour toujours**, et le cache se remplit de fantômes. ⚠️ **Et dites ce que devient une requête refusée par `PLAFOND_FILE`** : `_request` marque la tuile `loading` **avant** de l'enfiler, donc un refus silencieux la laisse `loading` sans requête. Elle doit **redevenir `empty`** — ⚠️ **et surtout PAS `idle`, qui n'existe pas** : les états sont `empty | loading | ready | error` (`:521`, `:535`, `:542`, `:545`), et `_request` **n'ouvre que sur `empty`**. Une tuile garée dans un état inventé serait le fantôme permanent qu'on chasse.

⚠️ **C'est l'interface que le prototype proposait telle quelle pour la Phase 2.**

- [ ] **Étape 1** — écrire le test qui échoue : **un panoramique latéral à basse altitude**, pas une descente. ⚠️ C'est le geste le plus banal de l'application, et celui que le vol de référence ne pouvait pas voir : dans une descente lisse, deux images consécutives demandent presque les mêmes tuiles. Assertion : après 90° de balayage puis 5 s d'immobilité, le nombre de tuiles `loading` revient sous `PLAFOND_FILE` et le zoom effectif rejoint le zoom demandé.
- [ ] **Étape 1 ter — FABRIQUER `debitObserve(flux)`. ⚠️ SANS CETTE CASE, LA TÂCHE 4 TER NE PEUT PAS COMMENCER** — signalé cinq fois. Test : après trois réponses de tailles et durées connues, `debitObserve` rend leur débit agrégé ; sur un flux neuf il rend `null` et **non zéro** — zéro se propagerait en « réseau mort » dans `zoomSoutenable`.
- [ ] **Étape 2** — le lancer, vérifier qu'il échoue (zoom figé, file saturée).

⚠️ **LE HARNAIS DU DÉPÔT FERAIT PASSER CE TEST SUR DU CODE CASSÉ.** `test/globe-reseau.test.js:83-93` résout `fetch` en `setTimeout(0)` et rend la main entre les images : le compte de tuiles `loading` **retombe alors tout seul**, sans plafond, sans annulation, sans éviction. L'étape 2 échouerait à échouer. **Il faut un bouchon de `fetch` à résolution MANUELLE** — les requêtes ne se résolvent que lorsque le test le décide — sinon on ne mesure que l'ordonnanceur de node.
- [ ] **Étape 3** — implémenter les trois corrections.
- [ ] **Étape 4** — vérifier par mutation : retirer le plafond, puis l'annulation, puis l'éviction des `loading` — **chacune doit tuer un test**.
- [ ] **Étape 5** — mesurer le battement : nombre de décodages complets sur un vol de référence. ⚠️ L'attaque en a compté **10 829 pour un cache de 420** ; donner le chiffre après.
- [ ] **Étape 6 — LA CLÔTURE DU §0**, les quatre commandes dans l'ordre, puis commit.

### Tâche 4 ter : la descente bornée par le réseau — règle R3

**Fichiers :** créer `src/monde/descente-bornee.js` · tester `test/descente-bornee.test.js` — ⚠️ **et ne touchez pas à `flux-terrain.js` : `debitObserve` est fabriqué par la Tâche 4 bis, qui passe avant.**

**Interfaces produites :** `zoomSoutenable({ debitObserveMbs, zoomDemande })` → `number`

✅ **`debitObserve(flux)` est produit par la Tâche 4 bis** (son Étape 1 ter), qui passe avant celle-ci. ⚠️ **Vérifiez que cette case est bien cochée avant de commencer** : le manque a été signalé cinq fois avant d'être posé.

**Les deux points mesurés** : **z11 à 12 Mb/s**, **z9 à 4 Mb/s**. ⚠️ **Deux points ne font pas une courbe.** Commencez par une interpolation logarithmique entre eux, **mesurez un troisième point** (par exemple à 30 Mb/s) et corrigez. Le plan ne peut pas vous donner la loi : il vous donne deux points et l'obligation d'en trouver un troisième.

Mesuré : à froid, le zoom effectif plafonne à **z11 sur 12 Mb/s, z9 sur 4 Mb/s**. À z9 un texel vaut 213 m — **dix-sept texels sur la largeur du socle**. Ce n'est pas le flou de la décision 13, **c'est une autre carte**.

- [ ] **Étape 1** — test : à débit observé faible, `zoomSoutenable` rend un zoom inférieur au demandé. ⚠️ **La seconde moitié de cette assertion — « et la caméra ne descend pas plus vite que lui » — est HORS DU PÉRIMÈTRE de cette tâche** : elle appartient à la Tâche 1, qui tient la caméra. **Dites ici qui appelle `zoomSoutenable` et où** (`modes.js`, sur le chemin de descente), et laissez l'assertion caméra à la Tâche 1.
- [ ] **Étape 2** — le lancer, vérifier qu'il échoue.
- [ ] **Étape 3** — implémenter `zoomSoutenable`. ⚠️ **Le débit s'observe, il ne se devine pas** : il vient de `debitObserve(flux)` — octets réellement reçus par seconde — **jamais de `navigator.connection`**, qui ment et n'existe pas partout.

- [ ] **Étape 4** — mutation : **rendre `zoomSoutenable` constant (toujours le zoom demandé) doit tuer le test**. ⚠️ Ce plan écrivait le mot « mutation » nu — une mutation qui n'est pas nommée n'est pas exécutable.
- [ ] **Étape 5 — LA CLÔTURE DU §0**, les quatre commandes dans l'ordre, puis commit.

---

## 7. PHASE 2 — La fenêtre bornée

### Tâche 5 : `audit-solide.js` ⚠️ AVANT `fenetre-bornee.js`

**Fichiers :** créer `src/monde/audit-solide.js` · tester `test/audit-solide.test.js`

**Interfaces produites :** `auditerSolide({ geometrie, indices })` → `{ ferme, oriente, degeneres, nan, vide }`

⚠️ **Deux arguments, pas un** : `construireFenetre` rend `geometrie` et `indices` **séparément**, et une version de ce plan en demandait un seul — l'agent aurait dû deviner.
⚠️ **`vide` est un verdict, pas un détail** : sur une géométrie sans sommet, l'audit rend `vide: true` et **refuse de se prononcer sur le reste**. C'est ainsi que le test de silhouette du prototype passait à vide en se croyant vert.

⚠️ **Il passe en premier parce que sans lui, on n'a aucun moyen de savoir si la Tâche 6 marche.** Le prototype s'est cru étanche pendant tout son vol avec un instrument aveugle.

**Ce qu'il doit détecter, et que l'ancien ratait :**
- un **solide retourné** — parois enroulées à l'envers, socle grand ouvert : un audit d'arêtes dit « 0 bord libre », **à juste titre** ;
- une **dalle absente**, un **mur entier manquant** ;
- un **trou de 128×128 mailles** — 1,78 km, la moitié de la fenêtre.

**Méthode validée par l'attaque**, et elle tient en trois mesures, **sans aucun rendu**, environ 10 ms :

1. **Volume signé recentré.** Somme sur tous les triangles du produit mixte de leurs sommets ramenés au centre de la boîte englobante, divisée par six. **Un solide fermé et bien orienté rend un volume positif ; retourné, il rend le même volume au signe près.** C'est ce qui attrape le solide inversé qu'un audit d'arêtes déclare sain.
2. **Dégénérés.** Un triangle dont l'aire est sous un epsilon relatif à la taille du solide. ⚠️ **Valeur de départ : `1e-12 × (côté de la boîte englobante)²`**, à confirmer en vérifiant qu'un triangle sain de la fenêtre la plus fine (N=768) reste **trois ordres de grandeur au-dessus**. Ce plan laissait l'epsilon à l'agent : c'est un chiffre qui décide d'un verdict.
3. **NaN.** Un seul suffit à empoisonner la boîte englobante, donc le volume, donc le verdict — **le chercher en premier**.

- [ ] **Étape 1** — écrire **six sabotages** et le test qui les attend tous : solide retourné, dalle absente, mur manquant, trou central, triangle dégénéré, NaN.
- [ ] **Étape 2** — les lancer, vérifier que **chacun** échoue. ⚠️ **CE PLAN A ANNONCÉ « 6 SUR 6 » COMME MESURÉ, ET C'ÉTAIT FAUX** : avec les trois mesures qu'il prescrivait, **trois passaient pour sains**. Si vos six échouent du premier coup, **c'est votre banc qu'il faut suspecter**, pas votre chance.
- [ ] **Étape 3** — implémenter. ⚠️ **L'AUDIT PRESCRIT LAISSE PASSER TROIS SABOTAGES SUR SIX — MESURÉ AU BANC, PAS DÉDUIT.** Dalle absente (+7,35), mur manquant (+7,95) et **trou couvrant un quart de la surface** (+9,18 contre 9,568 pour le sain, soit **−4 % seulement**) rendent tous un volume positif et **passent pour sains**. Le plan annonçait « 6 sur 6 » : c'est faux.

  **Le correctif : calculer le volume signé autour de DEUX origines — et ⚠️ CE PLAN NE DISAIT PAS LESQUELLES, CE QUI SUFFIT À LE FAIRE ÉCHOUER.** Mesuré au banc sur une fenêtre fermée : **l'origine du monde laisse passer deux sabotages sur trois** (mur manquant 0,0 %, trou de dessus 0,3 %). La raison est exacte et se démontre : `V(O₂) − V(O₁) = −(O₂ − O₁) · Ā`, donc **un décalage vertical est aveugle au mur, un décalage horizontal est aveugle à la dalle. Seule une origine OBLIQUE — décalée sur les trois axes — les attrape toutes.**

  ⚠️ **Et l'écart « 58 à 296 % » n'est pas un seuil : il est proportionnel à l'aire du trou** (68,4 % pour un trou de 25 % de la surface, **1,3 % pour 0,4 %**). **Fixez le seuil sur le plus petit défaut que vous voulez attraper, et écrivez-le.** ✅ L'epsilon `1e-12 × côté²` est bon : six ordres de marge à n=768.
- [ ] **Étape 4** — ⚠️ **le test de non-vacuité** : l'audit doit refuser de rendre un verdict sur une géométrie vide, au lieu de la déclarer saine. **C'est ainsi que le test de silhouette du prototype passait à vide.**
- [ ] **Étape 5** — mutation sur chacune des trois détections.
- [ ] **Étape 6 — LA CLÔTURE DU §0**, les quatre commandes dans l'ordre, puis commit.

### Tâche 6 : `fenetre-bornee.js` — l'extraction

**Fichiers :** créer `src/monde/fenetre-bornee.js` · **modifier `src/plinth.js`, `src/ocean.js` et `src/fenetre-clip.js`** · tester `test/fenetre-bornee.test.js` **et les 13 `test/damier-*.test.js`**

⚠️ **AVANT D'ÉCRIRE UNE LIGNE, LISEZ CE QUI EXISTE.** `plinth.js:138` `computeSlab` et `plinth.js:232` `buildSlabWalls` (**douze options** — congé, chanfrein, AO de contact, liner, `masqueArrondi`, `bords`, `baseYFloor`) font déjà l'essentiel de ce que `construireFenetre` prétend faire ; `fenetre-clip.js` détient la forme des coins, dont `plinth.js` **et** `ocean.js` tirent la leur.

⚠️ **ET LE DAMIER APPELLE `buildSlabWalls` (`block-grid.js:768`)** — 13 fichiers de test, 243 tests, **empreintes bit à bit** (`damier-bords.test.js:351`). Ce plan ne prononçait pas une fois le mot « damier ». **Dites ce qu'il advient de `bords`, `masqueArrondi`, `baseYFloor`, `bordsHero`** — et portez la signature de `construireFenetre` aux douze options, ou écrivez pourquoi les sept autres se perdent.

⚠️ **Collision de nom : `exposantCoin` est déjà un export de `fenetre-clip.js:71`. Renommez le paramètre.**

**Interfaces produites :**
- `construireFenetre({ emprise, n, rayonCoin, **puissanceCoin**, profondeurDalle, exageration })` → `{ geometrie, indices, boiteEnglobante }` — ⚠️ **`puissanceCoin` et non `exposantCoin` : ce dernier est déjà un export de `fenetre-clip.js:71`.** Ce plan demandait « renommez-le » sans donner le nom ; le voici.
✅ **`emprise` est produite par la Tâche 3** (`empriseSocle`), qui passe avant celle-ci. ⚠️ **Ce plan a longtemps écrit que personne ne la produisait ; ce n'est plus vrai. Vérifiez que la Tâche 3 est faite avant de commencer.**

- `emprise` = `{ ouest, sud, est, nord }` en degrés. ⚠️ **`ouest > est` signifie que l'emprise franchit l'antiméridien** — c'est légal et le test l'exige.
- ⚠️ **Au-delà de 85,051° de latitude** (la limite de Mercator), l'emprise est **écrêtée** à cette valeur. Le prototype y était « silencieusement faux mais fermé » ; ici on tranche : on écrête, et un test le vérifie.
- `exageration` : sans elle, la dalle et les parois n'ont pas la bonne hauteur. ⚠️ **CE PLAN ÉCRIVAIT « défaut de production : 18 ». C'EST L'EXAGÉRATION DU GLOBE** (`globe.js:278`), **pas celle du socle.** Le socle vaut `BASE_EXAG = 2,8`, modulée par zoom — `{3: 2.5, 4: 2.5, 5: 5, 6: 4, 7: 3.2}` dans `main.js`. **À trancher explicitement : laquelle `construireFenetre` reçoit, et pourquoi.** Un facteur six d'écart entre les deux lectures.
- `profondeurDalle` : défaut de production **7** (`main.js:540`, `plinthDepth`). Le socle calcule `baseY = pointLePlusBas − profondeurDalle`.

⚠️ **LE SOCLE N'EST PAS UNE BOÎTE, ET UNE VERSION DE CE PLAN L'AVAIT RÉDUIT À ÇA.** `src/plinth.js` porte un congé à normales analytiques, des **coins en superellipse** (`slabCorner` / `slabCornerSmoothing`, réglés par défaut dans `main.js:566`) et un liner. Les oublier ne casserait pas le maillage : ça donnerait **un pavé droit à la place de l'objet ShibuMap**.

⚠️ **ET `ocean.js` DOIT ÊTRE INSCRIT DANS CETTE TÂCHE.** Il recalcule `uCornerR`, `uCornerN` et `buildRimGeometry` **sur les mêmes constantes** : si la fenêtre change de forme sans lui, la mer cesse d'épouser le socle. C'est la famille de défauts déjà rencontrée deux fois sur ce dépôt — un réglage écrit d'un côté, jamais transmis à l'autre.

⚠️ **Le sort de `plinth.js` est à trancher explicitement** : modifié pour accepter une emprise variable, ou remplacé. Il **est** au §5 depuis la révision du 2026-08-20 — une version antérieure de cette ligne affirmait le contraire, et c'était faux.
- `majHauteurs(fenetre, fluxTerrain)` → `void`

⚠️ **Par RÉÉCHANTILLONNAGE, jamais par découpe du maillage du quadtree.** C'est la décision d'architecture du §4.

- [ ] **Étape 1** — test : une fenêtre construite puis auditée par `auditerSolide` est fermée, orientée, sans dégénéré ni NaN.
- [ ] **Étape 2** — le lancer, vérifier qu'il échoue.
- [ ] **Étape 3** — implémenter : grille régulière propre à la fenêtre, hauteurs cherchées dans le cache en coordonnées de pixel global, parois dont les sommets hauts **sont** les sommets de bord, dalle en éventail sur le même anneau bas.
- [ ] **Étape 3 bis — écrire `majHauteurs(fenetre, fluxTerrain)`.** ⚠️ **Cette interface est déclarée par la tâche et aucune étape ne la fabriquait.** Test : après une mise à jour, les hauteurs de la fenêtre correspondent au flux, **sans reconstruire la géométrie** — c'est toute sa raison d'être.
- [ ] **Étape 4** — test : sur cent emprises tirées au hasard, dont l'antiméridien et au-delà de 85° de latitude, l'audit passe **cent fois** — ⚠️ **et le test de non-vacuité de la Tâche 5 refuse de rendre un verdict sur une géométrie vide.**

⚠️ **SANS CETTE PRÉCISION, LE TEST AUDITE CENT PAVÉS DROITS.** `construireFenetre` seule rend une boîte à hauteurs nulles, fermée et orientée **par construction** : elle passerait l'audit cent fois sans que le rééchantillonnage — la raison d'être de la tâche — soit touché par une seule assertion. **Deux assertions qui mordent** : au moins un sommet intérieur diffère du bord, et la hauteur relevée en un point connu vaut celle du relief bouchonné.
- [ ] **Étape 5** — mutation : inverser l'enroulement de la dalle doit tuer le test d'orientation.
- [ ] **Étape 6 — LA CLÔTURE DU §0**, les quatre commandes dans l'ordre, puis commit.

### Tâche 7 : les deux résolutions et la zone morte

⚠️ **CETTE TÂCHE RÉINVENTE `src/fenetre-finesse.js`, QUI EXISTE DÉJÀ** — module pur, testable sous node : `pasFinesse`, `resDeFinesse`, `REPOS_S = 0,4`, `V_REPOS = 2`, `RES_REPOS_MAX = 768`, plus `Terrain.resMaillage` (`terrain.js:2016`) et `RES_FENETRE_CONTINUE = 384` (`terrain.js:61`). ⚠️ **Nuance que ce plan a écrite trop fort : il n'est PAS « en production » — `flags.js:25` porte `fenetreContinue: false`, et `terrain.js:2017` est court-circuité hors `?f3=1`.** Il est fusionné et testé, pas actif. **Trancher : étendre ou remplacer.**

⚠️ **Et ses chiffres sont faux contre le dépôt :** les résolutions `128 | 256` sont **trois fois sous la production** (384 / 768), et le budget « 1,7 / 8,3 ms » vient d'un prototype **sans socle**, alors que ce dépôt mesure **5,5 / 8,7 / 14,6 / 24,5 ms** (script rejouable cité en `plinth.js:876`).

⚠️ **ET IL Y A 1 516 ms DE GEL QUE CETTE TÂCHE IGNORAIT.** `fenetre-finesse.js:135-149` les mesure : bascule vers 768 **à champ non cuit**, 1,5 s de gel arrivant 0,4 s après que la carte s'est posée, **sans que l'utilisateur ait touché à quoi que ce soit**. La cuisson est **incompressible** (285 ns le point, 5,31 M points) ; **ce qui est déplaçable, c'est le moment** — et le fichier dit lequel : « sous le voile de chargement ». ⚠️ **Or la Tâche 2 retire ce voile. Les deux tâches se contredisent : tranchez.**

⚠️ **ET LE MÊME COMMENTAIRE PRÉVIENT QUE « UN BANC SYNTHÉTIQUE NE L'AURAIT PAS VU — le module pur bascule en zéro milliseconde ».** Cette tâche prescrit précisément un module pur. **Le test de résolution ne verra donc pas le défaut le plus visible de la fonctionnalité.** Prévoyez-en un second, sur le chemin réel.

⚠️ **L'invariant que ce dépôt a payé pour apprendre : socle et maillage à la même résolution, sinon ils se décollent** (`plinth.js:865-879`).

**Fichiers :** ⚠️ **modifier `src/fenetre-finesse.js` et `src/terrain.js` — PAS créer un module neuf** (ou écrire ici pourquoi on les remplace) · modifier `src/monde/fenetre-bornee.js` · tester `test/fenetre-resolution.test.js` **et les 9 tests de la fenêtre continue**

**Interfaces produites :**
- `resolutionPour({ enMouvement })` → ⚠️ **PAS `128 | 256` : ce plan prescrivait des valeurs TROIS FOIS SOUS LA PRODUCTION.** Les valeurs du dépôt sont **384 en mouvement et 768 au repos** (`RES_FENETRE_CONTINUE`, `RES_REPOS_MAX`). **Partez de celles-là**, et si vous les baissez, dites contre quelle mesure.
- `empriseADerive(precedente, courante)` → `boolean` — vrai si le cadrage a bougé assez pour justifier une reconstruction. **Seuil de départ : 2 % de la diagonale de l'emprise.** ⚠️ **Non sourcé — mais le vrai défaut n'est pas là.**

⚠️ **UN POURCENTAGE DE DIAGONALE CHANGE DE SENS À CHAQUE ZOOM** : 2 % valent **200 m sur z13 et 51 m sur z15**, alors qu'une maille à N=128 vaut environ **80 m**. Le même seuil est donc tantôt plus grossier, tantôt plus fin que la maille qu'il est censé protéger. **Exprimez-le en MAILLES, pas en pourcentage** — c'est la seule unité qui garde le même sens à tous les zooms.

**Protocole :** balayer de **0,25 à 4 mailles**, relever les reconstructions par seconde (médiane et p90) **et le retard de l'emprise à l'arrêt de la caméra** — c'est ce second chiffre qui borne par le haut.

**Mesuré :** N=256 coûte **8,3 ms de médiane** — au-dessus du budget d'une image à 60 Hz, sur une machine très au-dessus de la cible, et **sans mer ni palette ni gravure**. N=128 coûte **1,7 ms**.

⚠️ **Le prototype reconstruisait à CHAQUE image** — le pire cas imaginable. La zone morte est ce qui rend la décision 4 tenable.

⚠️ **RAPPEL DE LA DÉCISION 13, PARCE QUE C'EST ICI QU'ON EST TENTÉ DE L'ENFREINDRE.** Baisser à N=128 pendant le mouvement **rend l'image plus grossière pendant qu'on bouge**. C'est voulu, Adrien l'a validé, et c'est le contrat. **Ne compensez pas** en forçant N=256 dès que « ça a l'air lent » : vous reprendriez les 8,3 ms et les 12 % de dépassement que cette tâche existe pour éviter.

- [ ] **Étape 1** — test : `resolutionPour({ enMouvement, resVoulue })` **ne dépasse JAMAIS `resVoulue`**, et **rend une résolution de mouvement STRICTEMENT INFÉRIEURE à celle de repos DÈS QUE `resVoulue` dépasse le plafond de mouvement**. ⚠️ **CE PLAN A ÉCRIT DEUX ASSERTIONS FAUSSES DE SUITE, ET AUX MÊMES VALEURS.** « rend 384 et 768 » est faux à `resVoulue` 256 et 384 ; « strictement inférieure au repos » est faux à 128, 256 **et** 384 — parce que `min(resVoulue, plafond)` est alors **égal** des deux côtés. **Le module existant plafonne au choix de l'utilisateur, et c'est voulu** : `resDeFinesse` porte en toutes lettres « ne pas servir `params.resolution` tel quel », et un utilisateur qui choisit 256 doit obtenir 256. **384 et 768 sont les valeurs par DÉFAUT (`RES_FENETRE_CONTINUE`, `RES_REPOS_MAX`), pas un contrat.** ⚠️ **Rejouez votre assertion contre `resDeFinesse` du dépôt AVANT de l'écrire — les deux versions précédentes ne l'ont pas fait.** Une dérive d'emprise sous le seuil ne déclenche **aucune** reconstruction, et **socle et maillage restent à la même résolution** (`plinth.js:865-879`).
- [ ] **Étape 2** — le lancer, vérifier qu'il échoue.
- [ ] **Étape 3** — implémenter.

- [ ] **Étape 4** — mutation : supprimer la zone morte doit tuer le test de non-reconstruction.
- [ ] **Étape 5** — ⚠️ **mesurer sur un vol, et donner les deux chiffres** : reconstructions par seconde avant et après la zone morte.
- [ ] **Étape 6 — LA CLÔTURE DU §0**, les quatre commandes dans l'ordre, puis commit.

⚠️ **Chargez `anthropic-skills:three-doctor` avant de commiter cette tâche** : c'est celle qui touche le plus la boucle de rendu, et le téléversement de 1,54 Mo de sommets par image en fait partie.

---

## 8. PHASES 3 à 6

⚠️ **Détaillées quand la Phase 2 aura mesuré.** Écrire la semaine huit avant que la six ait parlé, c'est fabriquer du travail à jeter.

**Phase 3 — les statistiques lissées** (`src/monde/statistiques-lissees.js`). Les quatre restantes : `meanM`, `globalMin`, les quantiles de rampe, `robustScale`. ⚠️ **C'est de l'auto-exposition**, et comme elle, il lui faut une **zone morte** — sinon la vue dérive en permanence sur des variations insignifiantes.

**Phase 4 — la transition et le vol.** ⚠️ **La transition n'est peut-être pas qu'un effet.** MapLibre **change de projection vers z12** et cache la bascule dans une zone où globe et Mercator coïncident, pilotée par un uniforme `globeness` — **parce que le float32 ne donne qu'une valeur tous les 2,5 m**. Chez eux le fondu **est** le mécanisme. Si notre transition doit masquer un changement de repère, elle se conçoit avec cette contrainte, pas se dessine d'abord.

**Phase 5 — les données.** Canopée en flux à l'activation. **GLOBathy** (1,4 M de plans d'eau, 30 m, **CC0**). ⚠️ Profondeurs **modélisées**, validées sur 1 503 lacs sur 1,4 million : à mentionner si on les affiche.

**Phase 6 — la dépose de l'ancien.** ⚠️ **CELLE-CI NE DEVRAIT PAS ÊTRE REPORTÉE : elle est chiffrable aujourd'hui et ne dépend d'aucune mesure de la Phase 2.** « Une partie des 3 062 tests » se compte : **11 fichiers, 193 tests, environ 20 secondes.** ⚠️ **Et `escalier-zoom.js` ne se retire PAS** — voir le §5 : il exporte `intersectionGlobe` et `viseeArrivee`, importées par `main.js:31` et sans rapport avec les paliers. **Seuls `bornesEscalier`, `pasEscalier`, `paliersRetenus` et `palierDeClic` s'en vont.** Reste : nouveau format de partage, reprise des gabarits.

---

## 9. Ce qu'Adrien doit trancher en chemin

- ⚠️ **CE QUE L'UTILISATEUR VOIT QUAND LE RÉSEAU REFUSE LA DESCENTE** (règle R3, Tâche 4 ter). La caméra cesse d'obéir : c'est exactement l'instant qu'occupait le pop-up. Flou assumé (décision 13), ralentissement progressif, ou indicateur discret ? **Aucune tâche ne peut trancher cela.**
- ⚠️ **LE « POINT DE PRÉSENTATION » DOIT-IL DISPARAÎTRE ?** `modes.js:455-458` porte « **v48 (retour Adrien)** : à chaque traversée d'étage on arrive au point de présentation — la même distance que la vue iso 1, en gardant l'angle de l'utilisateur. **Remplace la continuité d'altitude v42.** » ⚠️ **C'est une demande explicite d'Adrien, avec sa raison écrite, et la Tâche 2 bis propose de la défaire.** Il faut savoir ce qui n'allait pas dans v42 avant de refaire le même geste. **Aucune tâche ne peut trancher cela.**
- **L'effet de transition** globe → socle
- **La récupération de GLOBathy** : Earth Engine impose un compte et des conditions commerciales à vérifier ; le dépôt de l'article est peut-être la meilleure porte.
- **Le trait de côte au-delà de z15.** Mesuré : autour d'un bloc z16 à Brest, les polygones OSM pré-simplifiés à 30 m ne donnent que **51 segments pour 1,2 km de côté** *(le côté du bloc — ce plan écrivait « de côte », ce qui en faisait une longueur de rivage)* — médiane 123 m, pointes à 849 m. Rasterisés à 0,79 m la cellule, ils dessineraient un rivage à facettes. Soit on branche le champ processeur au-delà de z15, soit on raffine la donnée. **Le second est une décision de données, pas de code.**
- **Le déploiement de la mer corrigée.** ⚠️ **Ce plan écrit ailleurs que « le gain n'est pas visuel aujourd'hui » : les deux ne peuvent pas être vrais.** Ce qui est établi : la correction ajoute 13 162 cellules de mer à Bergen sans en perdre aucune. **Qu'elle se voie ou non à l'écran est précisément ce qu'il faut regarder avant de déployer** — c'est la décision d'Adrien, pas une affirmation du plan.

## 10. Auto-revue

**Couverture — et elle n'est pas complète, c'est écrit en tête du §6.** La **décision 1** (caméra continue) et la **suppression du voile** ont désormais leurs Tâches 1, 2 bis et 2. ⚠️ **Restent QUATRE décisions sans porteur, pas deux** : la **5** (la gravure ne s'écrit qu'à l'arrêt), la **6** (format d'impression à l'export), la **7** (mer, météo, cycle du jour en mode socle uniquement) et la **11** (60 img/s sur portable) — **elles n'existent qu'à la ligne où on les a votées.** Et `src/palier-machine.js`, le module qui fait déjà ce tri de matériel dans ce dépôt, n'est cité nulle part.


**Cohérence des noms** — employés à l'identique partout : `socleVisible`, `SEUIL_NAISSANCE_M`, `SEUIL_MORT_M`, `demanderEmprise`, `PLAFOND_FILE`, `auditerSolide`, `construireFenetre`, `majHauteurs`, `resolutionPour`, `empriseADerive`, `zoomSoutenable`, `debitObserve`.

**Ordre imposé, et il compte — les QUATORZE tâches, dans cet ordre.** ⚠️ **Bloc caméra d'abord** : **1a** (l'instrument, aucune correction), **1b** (le repère), **1c** (les verrous d'entrée), puis **2 bis** (l'escalier de surface). Ce sont elles qui suppriment l'attente. **Bloc quadtree ensuite** : **4 → 4 alpha → 3 → 4 bis → 4 ter** — la Tâche 3 avant la 4 bis, qui consomme son `emprise`. **Puis la Phase 2** : **5 (l'audit) avant 6 (l'extraction)** — sans instrument on ne saura pas si l'extraction marche — puis **7**. ⚠️ **ET LES DEUX RIDEAUX TOUT À LA FIN, dans cet ordre : Tâche 2 (`#loading`) puis Tâche 2 ter (`.whiteout`).** Une version de ce plan plaçait la Tâche 2 avant le bloc quadtree alors qu'elle exige elle-même que la Tâche 4 soit faite d'abord. **Ôter un rideau avant que l'attente ait disparu ne supprime pas le pop-up : il montre le trou qu'il cachait.**

**Le risque principal n'est plus la géométrie** : l'attaque a confirmé qu'on ne peut pas la déchirer. **C'est le flux** — plafond, annulation, éviction — et **le réseau**, qui décide du zoom réellement atteint.

**Ce qui n'est toujours pas vérifié :** aucune image en mouvement n'a jamais été vue (le volet navigateur ne composite pas), et rien n'a été mesuré sur un portable. Les deux valent pour le prototype comme pour son attaque.
