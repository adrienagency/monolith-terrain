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

Le tout derrière `FLAGS.fenetreContinue`, avec neuf fichiers de test dédiés.

⚠️ **PREMIÈRE ACTION DE CE PLAN, AVANT TOUTE TÂCHE : lire ces modules et trancher, module par module, réutiliser ou remplacer — et l'écrire ici.** C'est exactement le §1 de `/threejs-optimisation` — « l'audit s'arrête au fichier ; zéro occurrence est un signal, pas un soulagement » — et ce plan y est tombé sur son propre sujet.

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
| `src/plinth.js` **(modifier)** | accepter une emprise variable ; il garde le congé, les coins en superellipse et le liner |
| `src/ocean.js` **(modifier)** | il recalcule `uCornerR`, `uCornerN`, `buildRimGeometry` sur les mêmes constantes — sans lui, la mer cesse d'épouser le socle |
| `src/dem.js` **(lire)** | la politique à trois voies Mapterhorn / AWS / 404, `:245-263` |
| `src/dem-source.js` **(lire)** | `DEFAULT_SOURCE_ID`, `tilePx`, `maxZoom`, `REGION_ZOOM` |
| `src/block-grid.js` **(modifier)** | `:768` appelle `buildSlabWalls` — 13 fichiers de test, empreintes bit à bit |
| `src/fenetre-finesse.js` **(modifier ou remplacer)** | ⚠️ **il fait déjà la Tâche 7** |
| `src/terrain.js` **(modifier)** | `resMaillage` (`:2016`), `RES_FENETRE_CONTINUE = 384` (`:61`) |
| `src/main.js` **(modifier)** | **le seul endroit qui lit `FLAGS`** pour le globe |
| `src/monde/descente-bornee.js` **(créer)** | borner la descente au débit réellement observé — règle R3 |
| `src/flags.js` **(modifier)** | le drapeau qui isole le globe continu du globe orbital, **qui est en production** |
| `src/globe.js` **(modifier)** | horizon géométrique, frustum, crédit ; puis rebranchement sur la vraie source |
| `src/escalier-zoom.js` **(retirer en fin de parcours)** | les paliers n'existent plus |

---

### ⚠️ IL N'Y A NI TÂCHE 1 NI TÂCHE 2 DANS CE DOCUMENT

Zéro occurrence, vérifié. La numérotation commence à 3 et passe par 4, 4 alpha, 4 bis, 4 ter. **Soit elles existent ailleurs et il faut dire où, soit la numérotation est un vestige et il faut la reprendre.** Un agent qui cherche par où commencer ne peut pas le deviner.

## 6. PHASE 1 — Le flux et la caméra

### Tâche 4 : rendre `MAX_Z` ATTEIGNABLE — et non le descendre ⚠️ EN PREMIER

**Fichiers :** modifier `src/globe.js` (`_traverse`, seuil d'horizon, crédit) · modifier `test/globe-eviction.test.js` (déverrouiller `:204` et `:208`) · modifier `src/flags.js` (le drapeau) — ⚠️ **aucune des trois corrections ne touche `MAX_Z` ni `CACHE_MAX`**, contrairement à ce qu'annonçait ce plan.

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
- ✅ **LE ZOOM DE BASE EST z6 — TRANCHÉ AU BANC, 44 RELEVÉS** : 11 altitudes de 1 600 km à 2 km × 4 latitudes, 304-306 tuiles dessinées, 420 en cache, **0,0 requête par image au repos**. Et **z5 à 60° N** sous 800 km (les tuiles Mercator rétrécissent, `chord/dist` passe sous le seuil un niveau plus tôt). ⚠️ **z7 et « z9 sous 200 km » n'apparaissent pas une seule fois — ne les recopiez pas.** L'altitude n'a **aucun** effet : le globe est aussi grossier à 2 km qu'à 1 600 km. **C'est le symptôme lui-même.**
- ⚠️ **« 124 tuiles dessinées après correction » vient du banc dont le zoom de base n'est pas reproductible. À re-mesurer, ne le prenez pas comme objectif.** Ce qui tient : ce n'est pas 74, qui recollait deux paliers.
- ⚠️ **L'horizon SEUL ne débloque rien** : z7 → z7. Il ne devient utile qu'accompagné du frustum, **qui fait tout le travail**. Un audit lui a attribué un niveau de zoom : c'est faux.
- **Le même relevé donne un cache de 824** — c'est-à-dire **le double de `CACHE_MAX`**. ⚠️ Or l'étape sur le cache ci-dessous propose `5 × visibles` ≈ 370, ce qui **défait** ce que les trois causes viennent de débloquer. **Cette contradiction se tranche par la mesure, pas par un arbitrage d'écriture.**
- **La formule d'horizon a besoin de sa marge de corde.** Transcrite nue, elle écrête au limbe et **crée des trous**. Et les racines `z2` doivent en être exemptées.

#### ⚠️ L'ORDRE DES ÉTAPES EST LE SUJET — mesuré, pas déduit

**Le correctif de crédit appliqué SEUL empire tout** : mesuré à **5 676 requêtes** (×14) et un zoom qui **retombe à 2**. Il ne devient bénéfique qu'une fois la calotte réduite. Le tri spatial d'abord, le budget ensuite. **Ne réordonnez pas ces étapes.**

⚠️ **Et les tests verrouillent le défaut** — `test/globe-eviction.test.js:204` et `:208` : `zoomFinal >= 6` et `visiblesFinal > 200`, avec un commentaire qui explique que z6 est une limite de budget. Le plafond a été compris, puis **inscrit comme contrat**. Pire : `visiblesFinal > 200` **fait échouer le bon correctif**, qui descend à 17-30 tuiles. Les 17 tests passent pendant que le globe est gelé. **Si vous ne déverrouillez pas ces assertions d'abord, le rouge vous fera annuler la correction.**

#### Les étapes

- [ ] **Étape 0 — POSER LE DRAPEAU, ET LE BRANCHER.** ⚠️ **`src/globe.js` n'importe PAS `flags.js` — vérifié, zéro occurrence.** Les seuls lecteurs de `FLAGS` sont `main.js`, `fenetre-reglage.js` et `ui/effects-panel.js`. Un drapeau posé dans `flags.js` sans câbler sa lecture **ne protège rien** : les corrections atterrissent sur le globe de production. Nommez-le, dites **quel fichier le lit**, et faites entrer `src/main.js` au §5 et dans les *Fichiers* de cette tâche.
- [ ] **Étape 1 — établir la base, et l'écrire.** Champ de vision fixé, zoom effectif, tuiles dessinées, taille de cache, requêtes au repos — à six altitudes. **C'est la référence contre laquelle tout le reste se compare.** ⚠️ Deux relevés antérieurs se contredisent (z6 contre z7) : le vôtre fait foi, et il doit être reproductible.
- [ ] **Étape 1 bis — DONNER UNE CAMÉRA AU HARNAIS. ⚠️ SANS ELLE, LES ÉTAPES 2 ET 4 SONT IMPOSSIBLES.** Le seul harnais qui fait voler le globe porte `{ position: new THREE.Vector3() }` (`test/globe-eviction.test.js:145` et `:225`) : **aucune orientation, aucune `projectionMatrix`** — zéro `PerspectiveCamera` dans tous les `test/globe-*.test.js`. Sans elle, l'Étape 4 n'a pas de frustum à tester et l'Étape 2 n'a pas d'écran dont mesurer la couverture. Prescrivez `new THREE.PerspectiveCamera(30, 16/9, orbAlt × 0,2, 1400)` — **les trois valeurs sont dans le dépôt** : `main.js:263`, `modes.js:704`, `modes.js:319`.
- [ ] **Étape 2 — DÉVERROUILLER LES TESTS, avant toute correction.** Les deux assertions de `globe-eviction.test.js` décrivent le défaut comme un contrat. Les réécrire pour qu'elles disent ce qu'on veut vraiment : **la couverture de l'écran ne se dégrade pas** — pas « plus de 200 tuiles dessinées », qui est la mesure du gaspillage, pas de la qualité. ⚠️ **Cette étape ne corrige rien et doit pourtant passer en premier.**
- [ ] **Étape 3 — l'horizon géométrique**, avec sa marge de corde et l'exemption des racines `z2`. `globe.js:770` : `dot < −0.35` est 110,5° en dur, au lieu de `R/|camPos|` — **2,87° à 8 km**, soit une calotte jusqu'à **×1 076 trop large**. ⚠️ **Seul, il ne débloque AUCUN niveau de zoom** — mesuré z7 → z7. Il réduit la calotte parcourue, ce qui rend l'étape 4 possible ; il ne se juge pas sur le zoom. Test : à basse altitude, le nombre de tuiles parcourues chute d'un ordre de grandeur **sans qu'aucune tuile visible ne disparaisse**. ⚠️ La seconde moitié est celle qui attrape l'écrêtage au limbe.
- [ ] **Étape 4 — le test de frustum** dans `_traverse` (zéro occurrence aujourd'hui). ⚠️ **C'EST CETTE ÉTAPE QUI FAIT TOUT LE TRAVAIL** : avec l'horizon, elle porte le zoom de **7 à 11** et les tuiles dessinées à **124**, avec **zéro requête au repos**. Au fov de production, **2 à 4 %** seulement des tuiles dessinées sont dans le champ. ⚠️ Les tuiles hors champ ne coûtent pas des appels de dessin — three les élimine au rendu — **elles consomment les 420 places du cache**, et c'est ce qui affame le crédit de l'étape 5. **Les deux défauts n'en font qu'un.**
- [ ] **Étape 5 — le crédit. ⚠️ BLOQUÉE DERRIÈRE L'ÉTAPE 4, ET À RE-MESURER APRÈS ELLE — elle n'aura peut-être plus d'objet.** Une fois l'emprise passée d'un hémisphère à un cône d'écran, des centaines de places se libèrent dans les 420, et `tiles.size < CACHE_MAX` rend le crédit **naturellement positif**. **Vérifiez-le par la mesure avant d'écrire une ligne.**

  ⚠️ **CE QUE CETTE ÉTAPE NE DOIT PAS FAIRE : ajouter un plancher constant.** Si un réglage reste nécessaire, **le critère d'acceptation porte sur la stabilité image par image** — `zmax` et tuiles dessinées constants sur **20 images**, requêtes au repos à zéro — **jamais sur un relevé à une seule image. C'est exactement ce qui a produit les trois chiffres contradictoires de ce plan.**

  Le détail du défaut, pour mémoire : `globe.js:759`, `_credit = CACHE_MAX − tiles.size + marge` : le prédicat de `marge` (l. 757) exige une tuile prête **ni traversée ni préparée** — ensemble **vide par construction**, puisque tout ce qui n'est ni l'un ni l'autre a déjà été évincé. `marge` vaut donc **0 dès la première image**, et **59 raffinements sont refusés par image, pour toujours**. ⚠️ Le commentaire des lignes **743-752** affirme le contraire, de façon convaincante. Si — et seulement si — l'étape 1 montre que les étapes 3 et 4 n'ont pas suffi : fondez le crédit sur le **récupérable réel**, avec le plancher **mesuré par le protocole ci-dessus**. ⚠️ **Au fov de production, elles ont suffi. Cette étape a de bonnes chances de ne pas devoir être ouverte.**
- [ ] **Étape 6 — rendre évinçables les tuiles bloquées.** ⚠️ **Sans retourner l'ordre d'éviction.** Ce plan a écrit trois fois « profondeur d'abord, récence ensuite » : `globe.js` fait délibérément l'inverse — `a.lastUsed - b.lastUsed || parProfondeur(a, b)`, la **récence au rang 1**, la profondeur au **rang 2 seulement**, avec vingt lignes de commentaire et un test dédié vert (« à ancienneté égale, l'éviction sacrifie la PROFONDE et garde l'ancêtre »). **C'est correct.** Une tuile en `error` ou en `loading` dont la requête ne revient jamais **occupe une place du budget définitivement, sans reprise possible**. C'est le même point fixe, par une autre porte. ⚠️ **MAIS N'ÉVINCEZ PAS UNE TUILE `loading` SANS ANNULER SA REQUÊTE** : le `.then` de `_pump` (`globe.js:726`) ajouterait un maillage orphelin à la scène. Le garde est `if (!this.tiles.has(t.key)) return` au retour — **exigez-le dans le test**. (`_evictJusqua` est à `globe.js:863`.)
- [ ] **Étape 7 — trancher le cache**, avec les chiffres de l'étape 1 et non par principe. ⚠️ Si les corrections réclament 824, une formule qui rend 370 est une régression déguisée en optimisation. **Mesurez avant de choisir.**
- [ ] **Étape 8 — la mémoire retenue pour rien : ~210 Mo sur 327 Mo au cache plein.** `globe.js:238` — le canevas reste vivant via `CanvasTexture.image` après téléversement (**105 Mo**). Et `t.heights` (**105 Mo**) n'est relu que par `setExaggeration` (`:899`), **qui n'a aucun appelant dans tout le dépôt — vérifié**. ⚠️ Le commentaire de `:168` annonce « 380 Mo pour 1 500 tuiles » : la documentation **sous-estime d'un facteur 2,4**.
- [ ] **Étape 9 — les normales de bord.** ⚠️ **l'écrêtage est à `globe.js:257-260`** (`Math.min(..., 254)` / `255`), et non à `:623-648` qui n'en est que le consommateur : `sampleHeights` écrête alors que `tileToLatLon` donne la position complète — pente **407 m au bord contre 853 m au centre**, soit **47,7 % de la vraie pente** — ⚠️ **et ce chiffre n'est pas seulement mesuré, il se DÉRIVE du dépôt** (`gridFor` = 24, plus l'écrêtage) : il vaut donc comme source, pas comme relevé, d'où un liseré d'éclairage autour de chaque tuile.
- [ ] **Étape 10 — LA CLÔTURE DU §0**, puis commit.

**Ce qui est établi :** la base est **z6**, l'altitude n'y change rien, et **le budget de cache est le point fixe** — 304 feuilles z6 pour 420 places. **Réduire l'emprise est donc le seul levier qui attaque la cause.** ⚠️ **Le gain chiffré des étapes 3+4 reste à établir par l'Étape 1 : les deux relevés existants viennent de bancs dont le zoom de base n'est pas reproductible.**

⚠️ **CETTE TÂCHE PASSE AVANT TOUTES LES AUTRES DU BLOC.** Rebrancher la source (4 alpha) d'un quadtree qui n'atteint pas ses niveaux fins ne se verrait pas ; et calibrer un plafond de file (4 bis) avant elle, c'est le calibrer sur un trafic qui va tripler. **L'ordre est 4 → 4 alpha → 4 bis → 4 ter.**


### Tâche 4 alpha : rebrancher le globe sur la vraie source de relief ⚠️ APRÈS LA TÂCHE 4, AVANT LA 4 BIS

**Fichiers :** modifier `src/globe.js` (`TILE_URL` et les **neuf** `256` en dur) · créer `test/globe-source.test.js` · ⚠️ **modifier les trois fichiers de test qui verrouillent le 256** : `test/globe-reseau.test.js:42-43` et `:97-98`, `test/globe-eviction.test.js:59-60`, `test/globe-precision.test.js:79` et `:83`. **Ce plan disait « trois fichiers non déclarés » sans les nommer : les voici.**

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
- **La mémoire passerait de 242 Mo à 968 Mo** si l'on garde le même nombre de tuiles en 512 px. ⚠️ C'est un facteur quatre, pas un ajustement.
- Les étapes 3 et 4 de cette tâche **se contredisent** — l'une demande de rebrancher, l'autre que rien ne change pour le globe orbital. **Elles ne peuvent pas être vraies ensemble tant que la question ci-dessus n'est pas tranchée.**
- **256 est codé en dur** plusieurs fois dans `fetchTile` / `sampleTile` de `globe.js`. Mapterhorn sert du **512**. ⚠️ **Trancher explicitement** : soit le globe accepte les deux tailles, soit il rééchantillonne. **Ne pas laisser ce choix à l'improvisation.**
- `TILE_MEMO_MAX` est calibré pour du 256 (≈ 32 Mo) ; en 512 la même valeur ferait **128 Mo**.
- `resolveRegionMaxZoom` est **asynchrone**, et `_pump` de `globe.js` est **synchrone**. La jonction des deux est le vrai travail de cette tâche.

- [ ] **Étape 1** — test : l'URL construite par le globe passe par `DEM_SOURCES[DEFAULT_SOURCE_ID]`, et la profondeur maximale du globe **n'excède jamais** le `maxZoom` de la source active.
- [ ] **Étape 1 bis** — test : sur une zone **couverte** par Mapterhorn, le globe l'utilise ; sur une zone qui rend 404 à z12, il bascule sur AWS **pour cette zone**, et **continue d'utiliser Mapterhorn ailleurs dans la même session**. ⚠️ C'est l'assertion qui distingue une politique d'une URL.
- [ ] **Étape 2** — le lancer, vérifier qu'il échoue (aujourd'hui l'URL est en dur).
- [ ] **Étape 3 — TRANCHER LA QUESTION OUVERTE, en une ligne écrite ici.** ⚠️ Ce plan écrivait que ses étapes 3 et 4 « ne peuvent pas être vraies ensemble » et laissait l'agent avec l'instruction de le signaler. **Ce n'est pas une tâche, c'est un renvoi.** La question : rebranche-t-on le globe **entier**, ou seulement **sous un zoom donné**, là où le socle vit ? La mesure qui tranche est celle de l'étape 6 — mémoire et requêtes du globe orbital avant/après. **Décidez sur elle, et écrivez la décision dans cette case.**
- [ ] **Étape 4 — la jonction `resolveRegionMaxZoom` async contre `_pump` synchrone.** ⚠️ **C'est le vrai travail de cette tâche, et aucune étape ne le portait.** La sonde par zone est asynchrone ; la pompe qui décide quelle tuile demander ne l'est pas. Dites ce que `_pump` fait pendant que la sonde n'a pas répondu : attendre (et geler), supposer AWS (et perdre Mapterhorn au premier passage), ou demander quand même et corriger après.
- [ ] **Étape 5 — les tailles.** Établir puis remplacer **la liste** des `256` de taille de tuile — ⚠️ **sans toucher aux deux radix terrarium (`globe.js:66` et `:236`)** — et traiter les deux `255` de `:257-260`. Puis `TILE_MEMO_MAX`, dont le budget est exprimé en tuiles et non en octets.
- [ ] **Étape 6 — la mémoire, mesurée avant de décider.** Le passage de 256 à 512 px **multiplie par quatre** l'occupation par tuile : 242 Mo → 968 Mo à nombre de tuiles constant. **Mesurez, puis ajustez le nombre de tuiles — pas l'inverse.**
- [ ] **Étape 7** — ⚠️ **vérifier que le globe orbital reste identique** sur ce que l'étape 3 a décidé de ne pas changer. C'est une fonction en production.
- [ ] **Étape 8** — mutation : revenir à l'URL en dur doit tuer le test.
- [ ] **Étape 9 — LA CLÔTURE DU §0**, les quatre commandes dans l'ordre, puis commit.

**Si cette tâche est jugée trop lourde**, l'alternative honnête est de **plafonner `MAX_Z` à 13 et de l'écrire** — mais alors la décision 1 (« de l'orbite au sol ») devient fausse, et il faut le dire à Adrien.

### Tâche 4 bis : LE FLUX QUI NE SE COINCE PAS ⚠️ APRÈS LES TÂCHES 4 ET 4 ALPHA

⚠️ **CETTE TÂCHE PORTAIT « EN PREMIER ». C'ÉTAIT L'ORDRE INVERSE DE CE QUI EST MESURÉ.** La Tâche 4 change ce que cette tâche est censée calibrer : après horizon + frustum, le pic de `loading` passe de **0 à 246** et le trafic d'un panoramique de **596 à 1 786 requêtes**. `PLAFOND_FILE` ne peut pas se calibrer avant. Et la Tâche 4 alpha fait passer les tuiles de PNG 256 px à WebP 512 px : **le bouchon écrit ici serait périmé le jour où elle s'exécute.**

**L'ordre est donc : 4 → 4 alpha → 4 bis → 4 ter.**

**Fichiers :** créer `src/monde/flux-terrain.js` · modifier `src/globe.js` · tester `test/flux-terrain.test.js`

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
3. `_evictJusqua` (`globe.js:869`) ne filtre que sur `ready` — **une tuile `loading` occupe une entrée pour toujours**, et le cache se remplit de fantômes.

⚠️ **C'est l'interface que le prototype proposait telle quelle pour la Phase 2.**

- [ ] **Étape 1** — écrire le test qui échoue : **un panoramique latéral à basse altitude**, pas une descente. ⚠️ C'est le geste le plus banal de l'application, et celui que le vol de référence ne pouvait pas voir : dans une descente lisse, deux images consécutives demandent presque les mêmes tuiles. Assertion : après 90° de balayage puis 5 s d'immobilité, le nombre de tuiles `loading` revient sous `PLAFOND_FILE` et le zoom effectif rejoint le zoom demandé.
- [ ] **Étape 2** — le lancer, vérifier qu'il échoue (zoom figé, file saturée).

⚠️ **LE HARNAIS DU DÉPÔT FERAIT PASSER CE TEST SUR DU CODE CASSÉ.** `test/globe-reseau.test.js:83-93` résout `fetch` en `setTimeout(0)` et rend la main entre les images : le compte de tuiles `loading` **retombe alors tout seul**, sans plafond, sans annulation, sans éviction. L'étape 2 échouerait à échouer. **Il faut un bouchon de `fetch` à résolution MANUELLE** — les requêtes ne se résolvent que lorsque le test le décide — sinon on ne mesure que l'ordonnanceur de node.
- [ ] **Étape 3** — implémenter les trois corrections.
- [ ] **Étape 4** — vérifier par mutation : retirer le plafond, puis l'annulation, puis l'éviction des `loading` — **chacune doit tuer un test**.
- [ ] **Étape 5** — mesurer le battement : nombre de décodages complets sur un vol de référence. ⚠️ L'attaque en a compté **10 829 pour un cache de 420** ; donner le chiffre après.
- [ ] **Étape 6 — LA CLÔTURE DU §0**, les quatre commandes dans l'ordre, puis commit.

### Tâche 3 : `seuil-socle.js` — quand le socle naît et meurt

**Fichiers :** créer `src/monde/seuil-socle.js` · tester `test/seuil-socle.test.js`

**Interfaces produites :**
- `socleVisible({ altitudeEllipsoideM, visibleAvant })` → `boolean`
- `SEUIL_NAISSANCE_M`, `SEUIL_MORT_M` — **À MESURER.**

⚠️ **UNE VERSION DE CE PLAN AVAIT ÉCRIT 120 km ET 180 km, ET LES AVAIT RÉFUTÉES AVEC UN CHIFFRE QUI N'EXISTE PAS.** « Un socle de 3,56 km » : **cette valeur ne se trouve nulle part dans le dépôt**, et six chiffres de ce plan en descendaient. La vraie largeur vient de `blockExtentMeters(zoom, lat)` (`landmarks.js:22`, avec `BLOCK_TILES = 3`) et **dépend du zoom** — exécuté à 45° de latitude : **z13 = 10,4 km · z14 = 5,2 km · z15 = 2,6 km · z16 = 1,3 km**.

⚠️ **ET CELA REND UNE QUESTION VISIBLE QUE CE PLAN NE TRANCHAIT NULLE PART : À QUEL ZOOM LE SOCLE SE POSE-T-IL ?** Tant qu'elle est ouverte, aucun seuil d'altitude ne peut se calculer — la largeur varie d'un facteur huit entre z13 et z16. **Tranchez-la ici, avant le protocole.**

Pour mémoire, l'erreur d'origine : à un champ de 30°, un socle occupe **5,6 % de l'image** depuis 120 km — et le dépôt lui-même place 120 km au palier **z8** — ⚠️ ce plan écrivait z9, et c'est faux : `pickDiveTier(120000)` rend `{ altM: 200000, zoom: 8 }`, **exécuté** ; z9 couvre 50 à 100 km (`modes.js`, `DIVE_TIERS`), c'est-à-dire précisément l'altitude que la règle R3 qualifie d'« autre carte ».

**Protocole :** partir de la demande d'Adrien — « le crop apparaît quand la Terre occupe une partie assez importante de l'écran » — la traduire en **fraction d'image occupée par le socle**, viser autour de 60 %, et en déduire l'altitude par la trigonométrie du champ de vision. ⚠️ **Puis convertir en altitude, et ne garder QUE l'altitude** : la fraction d'écran dépend du terrain chargé, ce que la règle R1 interdit.

**Ce qui est non négociable**, en revanche : `SEUIL_MORT_M` strictement supérieur à `SEUIL_NAISSANCE_M`. C'est l'écart qui empêche le clignotement, quel que soit le couple retenu.

⚠️ **L'ENTRÉE EST UNE ALTITUDE DE CAMÉRA AU-DESSUS DE L'ELLIPSOÏDE, PAS UNE FRACTION D'ÉCRAN.** Règle R1. Une fraction d'écran dépend de la distance au sol, donc du terrain chargé, donc de `meanM`, qui est lissé — on fabriquerait un oscillateur.

⚠️ **Hystérésis obligatoire** : `SEUIL_MORT_M` strictement supérieur à `SEUIL_NAISSANCE_M`. Même patron que `SPLIT_RATIO` / `MERGE_RATIO` dans `globe.js`, éprouvé sur ce dépôt.

- [ ] **Étape 1** — test : en descendant, le socle naît à `SEUIL_NAISSANCE_M` ; en remontant, il ne meurt qu'à `SEUIL_MORT_M`. Puis celui qui compte : **osciller cent fois autour du seuil de naissance ne produit qu'une seule bascule**.
- [ ] **Étape 1 ter** — test : après trois réponses de tailles et durées connues, `debitObserve` rend leur débit agrégé ; sur un flux neuf, il rend `null` et **non zéro** — zéro se propagerait en « réseau mort » dans `zoomSoutenable`, `debitObserve`.
- [ ] **Étape 2** — le lancer, vérifier qu'il échoue.
- [ ] **Étape 3** — implémenter. ⚠️ **L'AUDIT PRESCRIT LAISSE PASSER TROIS SABOTAGES SUR SIX — MESURÉ AU BANC, PAS DÉDUIT.** Dalle absente (+7,35), mur manquant (+7,95) et **trou couvrant un quart de la surface** (+9,18 contre 9,568 pour le sain, soit **−4 % seulement**) rendent tous un volume positif et **passent pour sains**. Le plan annonçait « 6 sur 6 » : c'est faux.

  **Le correctif tient en une ligne : calculer le volume signé autour de DEUX origines.** Ce n'est pas le signe qui prouve la fermeture, c'est son **indépendance à l'origine**. Écart mesuré : **0,00 % sur le solide sain, 58 à 296 % sur les trois ratés**. ⚠️ Gardez la première origine : elle seule attrape le **solide retourné**, qu'aucun comptage d'arêtes ne voit. Et chiffrez l'epsilon de dégénérescence au lieu de le laisser à l'agent.
- [ ] **Étape 4** — mutation : égaliser les deux seuils tue le test d'oscillation.
- [ ] **Étape 5 — LA CLÔTURE DU §0**, les quatre commandes dans l'ordre, puis commit.

### Tâche 4 ter : la descente bornée par le réseau — règle R3

**Fichiers :** créer `src/monde/descente-bornee.js` · tester `test/descente-bornee.test.js`

**Interfaces produites :** `zoomSoutenable({ debitObserveMbs, zoomDemande })` → `number`

⚠️ **PERSONNE NE PRODUIT `debitObserveMbs` — signalé trois fois, jamais traité, et cette tâche ne peut pas commencer sans.** Il doit sortir de la Tâche 4 bis : ajouter `debitObserve(flux)` → `number` à ses interfaces, alimenté par les tailles et durées des réponses déjà passées par `flux-terrain.js`. **À inscrire là-bas avant d'entamer celle-ci.**

**Les deux points mesurés** : **z11 à 12 Mb/s**, **z9 à 4 Mb/s**. ⚠️ **Deux points ne font pas une courbe.** Commencez par une interpolation logarithmique entre eux, **mesurez un troisième point** (par exemple à 30 Mb/s) et corrigez. Le plan ne peut pas vous donner la loi : il vous donne deux points et l'obligation d'en trouver un troisième.

Mesuré : à froid, le zoom effectif plafonne à **z11 sur 12 Mb/s, z9 sur 4 Mb/s**. À z9 un texel vaut 213 m — **dix-sept texels sur la largeur du socle**. Ce n'est pas le flou de la décision 13, **c'est une autre carte**.

- [ ] **Étape 1** — test : à débit observé faible, `zoomSoutenable` rend un zoom inférieur au demandé, et la caméra ne descend pas plus vite que lui.
- [ ] **Étape 1 ter** — test : après trois réponses de tailles et durées connues, `debitObserve` rend leur débit agrégé ; sur un flux neuf, il rend `null` et **non zéro** — zéro se propagerait en « réseau mort » dans `zoomSoutenable`, `debitObserve`.
- [ ] **Étape 2** — le lancer, vérifier qu'il échoue.
- [ ] **Étape 3** — implémenter. ⚠️ **L'AUDIT PRESCRIT LAISSE PASSER TROIS SABOTAGES SUR SIX — MESURÉ AU BANC, PAS DÉDUIT.** Dalle absente (+7,35), mur manquant (+7,95) et **trou couvrant un quart de la surface** (+9,18 contre 9,568 pour le sain, soit **−4 % seulement**) rendent tous un volume positif et **passent pour sains**. Le plan annonçait « 6 sur 6 » : c'est faux.

  **Le correctif tient en une ligne : calculer le volume signé autour de DEUX origines.** Ce n'est pas le signe qui prouve la fermeture, c'est son **indépendance à l'origine**. Écart mesuré : **0,00 % sur le solide sain, 58 à 296 % sur les trois ratés**. ⚠️ Gardez la première origine : elle seule attrape le **solide retourné**, qu'aucun comptage d'arêtes ne voit. Et chiffrez l'epsilon de dégénérescence au lieu de le laisser à l'agent. ⚠️ **Le débit s'observe, il ne se devine pas** : mesurer les octets réellement reçus par seconde, pas `navigator.connection`, qui ment et n'existe pas partout.
- [ ] **Étape 4** — mutation.
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
2. **Dégénérés.** Un triangle dont l'aire est sous un epsilon relatif à la taille du solide.
3. **NaN.** Un seul suffit à empoisonner la boîte englobante, donc le volume, donc le verdict — **le chercher en premier**.

- [ ] **Étape 1** — écrire **six sabotages** et le test qui les attend tous : solide retourné, dalle absente, mur manquant, trou central, triangle dégénéré, NaN.
- [ ] **Étape 2** — les lancer, vérifier que **chacun** échoue.
- [ ] **Étape 3** — implémenter. ⚠️ **L'AUDIT PRESCRIT LAISSE PASSER TROIS SABOTAGES SUR SIX — MESURÉ AU BANC, PAS DÉDUIT.** Dalle absente (+7,35), mur manquant (+7,95) et **trou couvrant un quart de la surface** (+9,18 contre 9,568 pour le sain, soit **−4 % seulement**) rendent tous un volume positif et **passent pour sains**. Le plan annonçait « 6 sur 6 » : c'est faux.

  **Le correctif tient en une ligne : calculer le volume signé autour de DEUX origines.** Ce n'est pas le signe qui prouve la fermeture, c'est son **indépendance à l'origine**. Écart mesuré : **0,00 % sur le solide sain, 58 à 296 % sur les trois ratés**. ⚠️ Gardez la première origine : elle seule attrape le **solide retourné**, qu'aucun comptage d'arêtes ne voit. Et chiffrez l'epsilon de dégénérescence au lieu de le laisser à l'agent.
- [ ] **Étape 4** — ⚠️ **le test de non-vacuité** : l'audit doit refuser de rendre un verdict sur une géométrie vide, au lieu de la déclarer saine. **C'est ainsi que le test de silhouette du prototype passait à vide.**
- [ ] **Étape 5** — mutation sur chacune des trois détections.
- [ ] **Étape 6 — LA CLÔTURE DU §0**, les quatre commandes dans l'ordre, puis commit.

### Tâche 6 : `fenetre-bornee.js` — l'extraction

**Fichiers :** créer `src/monde/fenetre-bornee.js` · **modifier `src/plinth.js`, `src/ocean.js` et `src/fenetre-clip.js`** · tester `test/fenetre-bornee.test.js` **et les 13 `test/damier-*.test.js`**

⚠️ **AVANT D'ÉCRIRE UNE LIGNE, LISEZ CE QUI EXISTE.** `plinth.js:138` `computeSlab` et `plinth.js:232` `buildSlabWalls` (**douze options** — congé, chanfrein, AO de contact, liner, `masqueArrondi`, `bords`, `baseYFloor`) font déjà l'essentiel de ce que `construireFenetre` prétend faire ; `fenetre-clip.js` détient la forme des coins, dont `plinth.js` **et** `ocean.js` tirent la leur.

⚠️ **ET LE DAMIER APPELLE `buildSlabWalls` (`block-grid.js:768`)** — 13 fichiers de test, 243 tests, **empreintes bit à bit** (`damier-bords.test.js:351`). Ce plan ne prononçait pas une fois le mot « damier ». **Dites ce qu'il advient de `bords`, `masqueArrondi`, `baseYFloor`, `bordsHero`** — et portez la signature de `construireFenetre` aux douze options, ou écrivez pourquoi les sept autres se perdent.

⚠️ **Collision de nom : `exposantCoin` est déjà un export de `fenetre-clip.js:71`. Renommez le paramètre.**

**Interfaces produites :**
- `construireFenetre({ emprise, n, rayonCoin, exposantCoin, profondeurDalle, exageration })` → `{ geometrie, indices, boiteEnglobante }`
⚠️ **QUI PRODUIT `emprise` ? PERSONNE — et trois tâches la consomment (4 bis, 6, 7).** C'est le jumeau non signalé de `debitObserveMbs`. Deux issues, à trancher **avant** d'entamer la Tâche 6 : soit `seuil-socle.js` la rend en même temps que `socleVisible`, soit `dem-emprise.js` la fournit déjà sous un autre nom (`originesEmprise`, `rectFenetre`) — **allez voir avant d'en écrire une neuvième version**.

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
- [ ] **Étape 1 ter** — test : après trois réponses de tailles et durées connues, `debitObserve` rend leur débit agrégé ; sur un flux neuf, il rend `null` et **non zéro** — zéro se propagerait en « réseau mort » dans `zoomSoutenable`, `debitObserve`.
- [ ] **Étape 2** — le lancer, vérifier qu'il échoue.
- [ ] **Étape 3** — implémenter : grille régulière propre à la fenêtre, hauteurs cherchées dans le cache en coordonnées de pixel global, parois dont les sommets hauts **sont** les sommets de bord, dalle en éventail sur le même anneau bas.
- [ ] **Étape 4** — test : sur cent emprises tirées au hasard, dont l'antiméridien et au-delà de 85° de latitude, l'audit passe **cent fois** — ⚠️ **APRÈS `majHauteurs`, sur un flux bouchonné à relief CONNU.**

⚠️ **SANS CETTE PRÉCISION, LE TEST AUDITE CENT PAVÉS DROITS.** `construireFenetre` seule rend une boîte à hauteurs nulles, fermée et orientée **par construction** : elle passerait l'audit cent fois sans que le rééchantillonnage — la raison d'être de la tâche — soit touché par une seule assertion. **Deux assertions qui mordent** : au moins un sommet intérieur diffère du bord, et la hauteur relevée en un point connu vaut celle du relief bouchonné.
- [ ] **Étape 5** — mutation : inverser l'enroulement de la dalle doit tuer le test d'orientation.
- [ ] **Étape 6 — LA CLÔTURE DU §0**, les quatre commandes dans l'ordre, puis commit.

### Tâche 7 : les deux résolutions et la zone morte

⚠️ **CETTE TÂCHE RÉINVENTE `src/fenetre-finesse.js`, QUI EST EN PRODUCTION.** Module pur, testable sous node, il porte déjà `pasFinesse`, `resDeFinesse`, `REPOS_S = 0,4`, `V_REPOS = 2`, `RES_REPOS_MAX = 768` — plus `Terrain.resMaillage` (`terrain.js:2016`) et `RES_FENETRE_CONTINUE = 384` (`terrain.js:61`). **Trancher d'abord : étendre ou remplacer.**

⚠️ **Et ses chiffres sont faux contre le dépôt :** les résolutions `128 | 256` sont **trois fois sous la production** (384 / 768), et le budget « 1,7 / 8,3 ms » vient d'un prototype **sans socle**, alors que ce dépôt mesure **5,5 / 8,7 / 14,6 / 24,5 ms** (script rejouable cité en `plinth.js:876`).

⚠️ **L'invariant que ce dépôt a payé pour apprendre, et que cette tâche perdait : socle et maillage à la même résolution, sinon ils se décollent** (`plinth.js:865-879`).

**Fichiers :** modifier `src/monde/fenetre-bornee.js` · tester `test/fenetre-resolution.test.js`

**Interfaces produites :**
- `resolutionPour({ enMouvement })` → `128 | 256`
- `empriseADerive(precedente, courante)` → `boolean` — vrai si le cadrage a bougé assez pour justifier une reconstruction. **Seuil de départ : 2 % de la diagonale de l'emprise.** ⚠️ **Non sourcé — mais le vrai défaut n'est pas là.**

⚠️ **UN POURCENTAGE DE DIAGONALE CHANGE DE SENS À CHAQUE ZOOM** : 2 % valent **200 m sur z13 et 51 m sur z15**, alors qu'une maille à N=128 vaut environ **80 m**. Le même seuil est donc tantôt plus grossier, tantôt plus fin que la maille qu'il est censé protéger. **Exprimez-le en MAILLES, pas en pourcentage** — c'est la seule unité qui garde le même sens à tous les zooms.

**Protocole :** balayer de **0,25 à 4 mailles**, relever les reconstructions par seconde (médiane et p90) **et le retard de l'emprise à l'arrêt de la caméra** — c'est ce second chiffre qui borne par le haut.

**Mesuré :** N=256 coûte **8,3 ms de médiane** — au-dessus du budget d'une image à 60 Hz, sur une machine très au-dessus de la cible, et **sans mer ni palette ni gravure**. N=128 coûte **1,7 ms**.

⚠️ **Le prototype reconstruisait à CHAQUE image** — le pire cas imaginable. La zone morte est ce qui rend la décision 4 tenable.

⚠️ **RAPPEL DE LA DÉCISION 13, PARCE QUE C'EST ICI QU'ON EST TENTÉ DE L'ENFREINDRE.** Baisser à N=128 pendant le mouvement **rend l'image plus grossière pendant qu'on bouge**. C'est voulu, Adrien l'a validé, et c'est le contrat. **Ne compensez pas** en forçant N=256 dès que « ça a l'air lent » : vous reprendriez les 8,3 ms et les 12 % de dépassement que cette tâche existe pour éviter.

- [ ] **Étape 1** — test : en mouvement `resolutionPour` rend 128, à l'arrêt 256 ; une dérive d'emprise sous le seuil ne déclenche **aucune** reconstruction.
- [ ] **Étape 1 ter** — test : après trois réponses de tailles et durées connues, `debitObserve` rend leur débit agrégé ; sur un flux neuf, il rend `null` et **non zéro** — zéro se propagerait en « réseau mort » dans `zoomSoutenable`, `debitObserve`.
- [ ] **Étape 2** — le lancer, vérifier qu'il échoue.
- [ ] **Étape 3** — implémenter. ⚠️ **L'AUDIT PRESCRIT LAISSE PASSER TROIS SABOTAGES SUR SIX — MESURÉ AU BANC, PAS DÉDUIT.** Dalle absente (+7,35), mur manquant (+7,95) et **trou couvrant un quart de la surface** (+9,18 contre 9,568 pour le sain, soit **−4 % seulement**) rendent tous un volume positif et **passent pour sains**. Le plan annonçait « 6 sur 6 » : c'est faux.

  **Le correctif tient en une ligne : calculer le volume signé autour de DEUX origines.** Ce n'est pas le signe qui prouve la fermeture, c'est son **indépendance à l'origine**. Écart mesuré : **0,00 % sur le solide sain, 58 à 296 % sur les trois ratés**. ⚠️ Gardez la première origine : elle seule attrape le **solide retourné**, qu'aucun comptage d'arêtes ne voit. Et chiffrez l'epsilon de dégénérescence au lieu de le laisser à l'agent.
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

**Phase 6 — la dépose de l'ancien.** Retrait d'`escalier-zoom.js`, nouveau format de partage, reprise des gabarits. ⚠️ **Une partie des 3 062 tests verrouille les statistiques par cadre qu'on débranche. À relire un par un** — lent, ingrat, et que les agents n'accélèrent pas.

---

## 9. Ce qu'Adrien doit trancher en chemin

- **L'effet de transition** globe → socle — Phase 4, en tenant compte du point MapLibre ci-dessus.
- **La récupération de GLOBathy** : Earth Engine impose un compte et des conditions commerciales à vérifier ; le dépôt de l'article est peut-être la meilleure porte.
- **Le trait de côte au-delà de z15.** Mesuré : autour d'un bloc z16 à Brest, les polygones OSM pré-simplifiés à 30 m ne donnent que **51 segments pour 1,2 km de côté** *(le côté du bloc — ce plan écrivait « de côte », ce qui en faisait une longueur de rivage)* — médiane 123 m, pointes à 849 m. Rasterisés à 0,79 m la cellule, ils dessineraient un rivage à facettes. Soit on branche le champ processeur au-delà de z15, soit on raffine la donnée. **Le second est une décision de données, pas de code.**
- **Le déploiement de la mer corrigée**, qui change l'image de manière visible et n'a pas encore été regardée.

## 10. Auto-revue

**Couverture :** les treize décisions et les trois règles ont chacune leur tâche ou leur phase.

⚠️ **DEUX DÉCISIONS N'ONT TOUJOURS AUCUNE TÂCHE** — signalé deux fois : la **décision 6** (format d'impression à l'export) et la **décision 11** (60 img/s sur portable récent). Et `src/palier-machine.js`, **le module qui fait déjà ce tri de matériel dans ce dépôt**, n'est cité nulle part. Le §10 ne peut pas certifier « les treize décisions ont chacune leur tâche » tant que c'est vrai.

**Cohérence des noms** — employés à l'identique partout : `socleVisible`, `SEUIL_NAISSANCE_M`, `SEUIL_MORT_M`, `demanderEmprise`, `PLAFOND_FILE`, `auditerSolide`, `construireFenetre`, `majHauteurs`, `resolutionPour`, `empriseADerive`, `zoomSoutenable`, `debitObserve`.

**Ordre imposé, et il compte :** **4 → 4 alpha → 4 bis → 4 ter** d'abord (voir la Tâche 4). ⚠️ **L'amendement de la Tâche 4 bis réclamé par la 4 ter — l'ajout de `debitObserve(flux)` — se fait DANS la 4 bis, à son tour, pas après.** ⚠️ **Et la Tâche 3 n'apparaît dans aucun énoncé d'ordre : elle passe avant 6, qui consomme son `emprise`.** Puis 4 bis (le flux) **avant** 6 (l'extraction), parce que l'extraction s'appuie sur une interface qui se coince aujourd'hui. Et 5 (l'audit) **avant** 6, parce que sans instrument on ne saura pas si l'extraction marche — le prototype s'est cru étanche pendant tout son vol.

**Le risque principal n'est plus la géométrie** : l'attaque a confirmé qu'on ne peut pas la déchirer. **C'est le flux** — plafond, annulation, éviction — et **le réseau**, qui décide du zoom réellement atteint.

**Ce qui n'est toujours pas vérifié :** aucune image en mouvement n'a jamais été vue (le volet navigateur ne composite pas), et rien n'a été mesuré sur un portable. Les deux valent pour le prototype comme pour son attaque.
