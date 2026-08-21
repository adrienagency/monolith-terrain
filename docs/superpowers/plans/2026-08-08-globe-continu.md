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
npm test              # la suite entière — 3 276 verts au 2026-08-21 (Tâche 6 ter incluse)
npm run audit:tests   # disque contre liste
node --check <fichier>  # sur CHAQUE fichier modifié
npm run nettoie:dist && npm run build:mapcells && npx vite build > /tmp/build.log 2>&1 && npm run verifie:dist
```
⚠️ **`nettoie:dist` N'EST PAS UN LUXE, ET SES QUATRE FAITS SONT DANS `scripts/nettoie-dist.mjs` :** `dist/` contient environ **150 000 fichiers**, Windows rend `ENOTEMPTY` quand l'antivirus tient encore un descripteur, et le script réessaie **`TENTATIVES = 7`** fois avec des pauses croissantes. **Un `rm -rf` simple échoue une fois sur deux sur cette machine.**

⚠️ **`npm test` N'EST PAS UN MOTIF DE FICHIERS : c'est une LISTE de 178 chemins écrite à la main dans `package.json`.** Un test ajouté au disque et oublié dans la liste **ne tourne jamais**, et la suite affiche fièrement ses milliers de verts. **Ajoutez votre fichier à la ligne `test`, puis lancez `npm run audit:tests`** — il sort en erreur s'il trouve un orphelin.

⚠️ **`build:mapcells` PASSE AVANT `vite build`, ET CE PLAN L'OUBLIAIT.** `netlify.toml:19` documente exactement cette correction, faite le 2026-08-05 : sans lui, le découpage en cellules de `public/data/map/` n'existe pas, le chargeur retombe sur les monolithes du monde entier, et **le gain de 34 % de poids disparaît en silence**. Quatorze clôtures de ce plan prescrivaient la version courte.

⚠️ **NE PIPEZ JAMAIS `vite build` DANS `tail`.** Le processus survit au shell, et le build suivant lit un `dist/` à moitié écrit.

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
14. **L'EXAGÉRATION VERTICALE DEVIENT UNE COURBE CONTINUE DE L'ALTITUDE** — tranché par Adrien le 2026-08-20. Mêmes valeurs aux mêmes altitudes, **interpolées entre elles au lieu de sauter**. ⚠️ **Raison structurelle : la table actuelle est indexée par les niveaux de zoom, c'est-à-dire par la chose que ce pivot supprime.**

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

Mesuré : à froid, le zoom effectif **plafonne à z11 sur 12 Mb/s et z9 sur 4 Mb/s** au lieu de z13, avec **83 % des images en retard** et un retard moyen de **3,67 niveaux**. À z9 un texel vaut 213 m — **48 texels sur la largeur d'un socle z13** ⚠️ (ce plan écrivait « dix-sept », reste du fantôme des 3,56 km que la Tâche 3 a réfuté).

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

**Remplacement validé par l'attaque :** volume signé recentré + dégénérés + NaN. ⚠️ **CE PLAN A ÉCRIT « 6 SABOTAGES DÉTECTÉS SUR 6 » ET C'EST FAUX** : rejoué au banc, **trois passent pour sains** — dalle absente, mur manquant, et un trou couvrant un quart de la surface (qui ne coûte que 4 % de volume). Il faut **mesurer `Ā` directement** — la somme des vecteurs-aires orientés, nulle sur un solide fermé quelle que soit l'origine. ⚠️ **« Deux origines » était la réponse de la révision précédente, et elle était fausse elle aussi** : `V(O₂) − V(O₁) = −(O₂ − O₁) · Ā` s'annule quand le décalage est orthogonal à `Ā`. ✅ **Tranché et mesuré par la Tâche 5, faite le 2026-08-21.**

---

## 5. Structure des fichiers

| fichier | responsabilité |
|---|---|
| `src/monde/flux-terrain.js` **(créer — ⚠️ après avoir lu `dem-emprise.js`)** | le quadtree en source unique : demander une emprise, recevoir les tuiles — **avec plafond, annulation et éviction des `loading`** |
| `src/monde/fenetre-bornee.js` **(créer — ⚠️ après avoir lu `plinth.js` et `fenetre-clip.js`)** | extraire un maillage fermé par **rééchantillonnage**, jamais par découpe |
| `src/monde/audit-solide.js` ✅ **CRÉÉ LE 2026-08-21** | **aire orientée `Ā`** (la fermeture), volume signé recentré (le retournement), dégénérés, NaN, **vacuité**, et `hauteurs.distinctes` — le discriminant pavé/relief de la Tâche 6. ⚠️ **Une coque à la fois** |
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
| `src/globe.js` **(modifier)** | horizon géométrique, frustum, crédit (Tâche 4) ; **le plancher de `dist` à `:780` et `MAX_Z` (Tâche 4 quater)** ; `CACHE_MAX` si la mesure le réclame ; puis rebranchement sur la vraie source (Tâche 4 alpha) |
| `src/escalier-zoom.js` **(⚠️ NE PAS RETIRER — à découper)** | `main.js:31` en importe **trois** symboles — `intersectionGlobe`, `viseeArrivee`, `ZOOM_PALIER_MIN` — sans rapport avec les paliers. ⚠️ **Et `pasEscalier` survit par `modes.js:80` : il fait tourner l'escalier de surface que la Tâche 2 bis CONSERVE.** Seuls `bornesEscalier`, `paliersRetenus` et `palierDeClic` s'en vont, et **seulement si rien d'autre ne les appelle** |
| `src/modes.js` **(modifier)** | ⚠️ **la caméra, les paliers ET le rideau blanc** — `_dive`, `_rescale`, `_whiteout`, `DIVE_TIERS`, `orbAlt`, `minDistance`. **C'est lui qui fabrique la discontinuité ET le pop-up** |
| `src/style.css` **(modifier)** | `:535-547` — le rideau plein écran du voile |

---

## 6. PHASE 1 — Le flux et la caméra

### ⚠️ PALLIATIF OU PIVOT : LE TRI QUI MANQUAIT À CE PLAN

**Adrien, le 2026-08-20 :** « *ce que je veux au niveau de la navigation, c'est un Google Maps like, **pas des crans**.* »

⚠️ **CE PLAN CONTIENT DEUX FAMILLES DE TÂCHES, ET IL NE LE DISAIT PAS.** Les unes suppriment les **symptômes** du cran — le rideau, le saut, le pop-up, le gel. Les autres suppriment **le cran lui-même**. Les premières travaillent sur un mécanisme que les secondes effacent.

| tâche | après le pivot |
|---|---|
| **1a** — l'instrument d'altitude | ✅ **survit** — c'est lui qui mesure la continuité |
| **1b** — la caméra continue | ✅ **CŒUR DU PIVOT** : une seule caméra exige que le globe et le terrain coexistent |
| **2** — la carte `#loading` | ✅ **survit** : elle doit partir de toute façon |
| **2 bis** — l'escalier de surface | ⚠️ **JETÉE** : `_rescale` disparaît avec les crans |
| **1c** — les verrous d'entrée | ⚠️ **en grande partie jetée** : ils gardent une reconstruction qui n'existera plus |
| **2 ter** — le fondu blanc | ⚠️ **partielle** : ses appelants partent avec leurs fonctions |

⚠️ **CE QUI SUPPRIME LES CRANS, C'EST LE BLOC QUADTREE PUIS LE BLOC FENÊTRE** : le quadtree devient une source **continue** et assez fine, et le socle est **rééchantillonné** depuis son cache au lieu d'être rechargé. Alors il n'y a plus rien à reconstruire quand la caméra descend — c'est la phrase fondatrice de ce plan : **on ne coud pas les tuiles, il n'y a pas de jonction parce qu'il n'y a pas de couture.**

**Décision du 2026-08-20 : on arrête le palliatif.** La Tâche 2 bis est livrée (elle améliore l'existant en attendant) ; la Tâche 1c est **abandonnée en cours** ; **on enchaîne 1b, puis le bloc quadtree, puis le bloc fenêtre.**


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

⚠️ **CE QUE LE BLOC FERME, MESURÉ SUR LE VRAI `modes.js` (1 800 images, réseau parfait, deux exécutions identiques) :** l'entrée morte passe de **13,77 s (45,9 %) à 7,12 s (23,7 %)** sur la descente de référence, et les sept rideaux tombent à zéro. **Le bloc ferme 48,3 % de l'entrée morte.**

⚠️ **CE QUI RESTE — 23,7 % du vol, une image sur quatre — EST EXACTEMENT SEPT FOIS `loadSurface`, ET AUCUNE DES QUATORZE TÂCHES NE LE TOUCHE.** La Tâche 4 le change de **0,00 s** : `globe.js` n'est pas sur le chemin `loadSurface → fetchAndBuildDem → loadDem`. **Ne promettez donc pas la fluidité totale : promettez la moitié, et dites où est l'autre.** Il reste encore, hors périmètre : le bandeau `.fui-msg` et les **1 516 ms** de cuisson de la Tâche 7.

⚠️ **ET LA MAJORITÉ NE VIENT PAS DE `_dive` : ils viennent de l'escalier de surface** (`_rescale`, `modes.js:452`, appelé par `_refine` `:436` et `_coarsen` `:445`). **Sur les 25 rideaux des quatre trajets, 17 sont posés par `_rescale`.** **C'est la première source du pop-up d'Adrien, et aucune tâche ne la portait.** → **Tâche 2 bis.**

Le réseau étant parfait dans ce banc, **la production est pire que ces chiffres, jamais meilleure.**

### Tâche 1 : la caméra continue — `modes.js` ⚠️ LA DÉCISION 1 N'AVAIT AUCUNE TÂCHE

**Fichiers :** modifier `src/modes.js` · modifier `src/main.js` · tester `test/camera-continue.test.js` (créer)

⚠️ **UNE PREMIÈRE VERSION DE CETTE TÂCHE ACCUSAIT LE MAUVAIS CODE.** Elle désignait `modes.js:397` (`tier.altM × 1,6`) : cette ligne est **dans le `catch`** de `loadSurface` — le chemin d'échec, un filet anti-martèlement, pas la discontinuité. Elle avait été trouvée par `grep`, sans ouvrir la fonction. **C'est le §1 de `/threejs-optimisation` appliqué au plan lui-même.**

**Le chemin nominal (`modes.js:407-429`) ne fait pas un saut d'altitude : il ÉCHANGE LE MOTEUR DE RENDU**, d'un bloc, derrière 960 ms de fondu au blanc. Sept gestes en une image :

1. `globe.setVisible(false)` et `setSurfaceVisible(true)` — **on change de monde**
2. `camera.near` / `camera.far` passent aux valeurs surface (`:414-415`)
3. ~~`camera.up.set(0, 1, 0)` — **le repère bascule du géocentrique au local** (`:417`)~~ ⚠️ **CE GESTE N'EXISTAIT PAS, ET LA TÂCHE 1b L'A REJOUÉ CONTRE LE DÉPÔT : `enterOrbit` écrivait la MÊME ligne.** Les deux modes ont toujours partagé le repère vertical `(0, 1, 0)` ; la ligne était un **no-op** et elle est partie. **Ce qui change bel et bien de repère, c'est la POSITION** — sphère de rayon `R_GLOBE` centrée à l'origine d'un côté, dalle de 56 unités à l'origine de l'autre — et c'est l'Étape 2, pas celle-ci.
4. `camera.position` et `controls.target` sautent à `_arrivalPose` (`:419-420`) — ✅ **c'est LUI qui portait le saut de ÷1,765, et la Tâche 1b l'a supprimé** : la distance d'arrivée se DÉDUIT désormais de l'altitude quittée.
5. `controls.minDistance = 6` (`:420`) — l'échelle change d'ordre de grandeur — ✅ **unifié par la Tâche 1b** (`Modes._poseButees`, site unique).
6. `maxPolarAngle`, `rotateSpeed`, `enableZoom`, `enablePan` réécrits — ⚠️ **INTACTS**, et ils sont de vraies différences de mode (on ne survole pas une sphère comme une dalle) : ils tomberont avec la frontière, pas avant.
7. `this.mode = 'surface'` — ⚠️ **INTACT**, c'est la frontière elle-même.

⚠️ **Le fondu au blanc n'est pas l'ornement du saut : il est là parce que le saut est invisible autrement.**

⚠️ **ET UN PLANCHER ORBITAL INTERDIT PHYSIQUEMENT « DE L'ORBITE AU SOL » :** `controls.minDistance = R_GLOBE + DIVE_ALT_M × 0,85` (`modes.js:326`). Tant qu'il est là, la caméra **ne peut pas** descendre en mode orbital. **Quatre sites écrivent `minDistance`** : `modes.js:326`, `:420`, `:639`, `main.js:1215`.

⚠️ **IL Y EN AVAIT DEUX, ET CE PLAN N'EN NOMMAIT QU'UN — trouvé à la Tâche 1b, on ÉLARGIT la liste ci-dessus, on ne la remplace pas.** Le second est le clamp de `orbAltTarget` à **`DIVE_ALT_M × 0,9` (7 200 m)**, écrit **deux fois** — dans `_zoomGesture` **et** dans `_orbitNotch`. **C'est LUI qui mordait en premier**, puisque 0,9 > 0,85 : retirer celui de `minDistance` sans lui n'aurait strictement rien changé. **Les deux sont partis** (`ALT_PLANCHER_ORBITALE_M = 0`, `loi-altitude.js`) ; le plancher est désormais la sphère elle-même (`minDistance = R_GLOBE`), et il est asymptotique parce que le zoom orbital est multiplicatif.

⚠️ **R1 EST DÉJÀ VIOLÉE EN PRODUCTION, ET CETTE TÂCHE HÉRITE DU DÉFAUT.** `surfaceCamAltMeters()` (`main.js:3594-3599`) rend `camera.position.y / scale + dem.meanM` — une quantité **dérivée du terrain**, lissée — et elle **pilote `enterOrbit`** (`modes.js:303`). Le gain de l'oscillateur est déjà câblé ; la Phase 3 y ajouterait le retard. **À traiter ici, pas à découvrir en Phase 3.**

⚠️ **ET LE TEST NE PEUT PAS ÊTRE UN TEST D'EXÉCUTION.** `Modes` appelle `document.createElement`, **il n'y a pas de jsdom dans ce dépôt** (`grep -c jsdom package.json` → 0), aucun test n'instancie `Modes`. Deux issues, à trancher à l'Étape 0 : **extraire la loi d'altitude en module pur** — patron d'`escalier-zoom.js` et de `fenetre-finesse.js`, tous deux purs et testés sous node — ou **assertion de texte source**, convention employée par **onze fichiers de test** de ce dépôt. ⚠️ **L'extraction est préférable : elle seule donne un test qui mord.**

⚠️ **CETTE TÂCHE EST TROP GROSSE POUR UN SEUL COMMIT, ET C'EST MESURÉ : onze cases sur `modes.js` (758 lignes) et `main.js` (**10 331 lignes**), dont une décision d'architecture que ce plan qualifie lui-même de « geste le plus lourd ».** Toutes les autres tâches du document tiennent dans un commit ; celle-ci non. **Elle se fait en trois, dans cet ordre, chacune close par le §0 et son propre commit.**

#### Tâche 1a — l'instrument, et la mesure

⚠️ **CETTE SOUS-TÂCHE NE POSE PAS D'ASSERTION, ET C'EST DÉLIBÉRÉ.** Une version de ce plan lui faisait écrire « le test qui échoue » **puis** exiger la clôture du §0 — c'est-à-dire `npm test` vert. **Les deux sont incompatibles**, et la sortie la moins chère aurait été de neutraliser l'instrument (`test.todo`, assertion molle), ce qui l'aurait rendu inutile aux Tâches 1b et 1c qui s'appuient dessus. **Elle livre donc un instrument et des chiffres, pas un test rouge. L'assertion appartient à la Tâche 1b.**

- [x] **Étape 0 — trancher la forme de l'instrument.** ⚠️ `Modes` appelle `document.createElement`, **il n'y a pas de jsdom dans ce dépôt** et aucun test n'instancie `Modes`. Deux voies : **extraire la loi d'altitude en module pur** (patron d'`escalier-zoom.js` et de `fenetre-finesse.js`, tous deux purs et testés sous node) ou **assertion de texte source** (onze fichiers de ce dépôt le font). ⚠️ **L'extraction est préférable : elle seule donnera un test qui mord à la Tâche 1b.**
- [x] **Étape 1 — écrire l'instrument**, et un test qui **passe aujourd'hui** : il caractérise le comportement actuel — *l'altitude présente au moins un saut sur une descente de 1 600 km à 2 km*. ⚠️ **Un test de caractérisation, pas un test de spécification** : il documente ce qui est, et la Tâche 1b l'inversera. **Il est vert au commit, et c'est la seule façon honnête de clore cette sous-tâche.** ⚠️ **DEUX PRÉCAUTIONS, PARCE QUE CE PATRON EST EXACTEMENT CELUI QUE LA TÂCHE 4 DÉNONCE À `globe-eviction.test.js:204`** — un défaut gravé comme contrat : **(1)** écrivez en tête du fichier qu'il est **temporaire et destiné à disparaître à la Tâche 1b** ; **(2)** son retrait doit sortir **aussi de la ligne `test` de `package.json`**, faute de quoi `npm run audit:tests` signalera un fantôme. Le plan précédent oubliait les deux.
- [x] **Étape 2 — relever les sauts, et les écrire ici. ⚠️ ET NOMMER LA GRANDEUR : C'EST LE VRAI TROU DE CETTE SOUS-TÂCHE.** La grandeur échantillonnée doit être la **même de part et d'autre de la bascule de mode**, sinon on compare deux repères. ⚠️ **La seule qui traverse les deux modes aujourd'hui est `surfaceCamAltMeters` (`main.js:3594`) — et la Tâche 1c ordonne d'en retirer `dem.meanM` au titre de R1.** Les deux tâches se croisent sur la même fonction. **Tranchez ici : ou bien l'instrument prend une altitude géométrique pure (sans `meanM`), et il survit à la Tâche 1c ; ou bien il prend la fonction telle quelle, et il faudra le refaire.** La première est la bonne. **Cette liste de sauts est le plan de travail des Tâches 1b et 1c.**
- [x] **Étape 3 — LA CLÔTURE DU §0**, les quatre commandes dans l'ordre, puis commit.

**Fait le 2026-08-20.** Fichiers livrés : `src/loi-altitude.js` (créé, pur), `test/camera-continue.test.js` (créé, **temporaire — il part à la Tâche 1b**), `src/modes.js` et `src/main.js` (délégations à l'identique), `package.json` (ligne `test` élargie : 178 → **179** fichiers, `npm run audit:tests` sans écart).

**Étape 0 — la forme tranchée : L'EXTRACTION.** `grep -c jsdom package.json` → **0** (vérifié). La loi d'altitude vit désormais dans `src/loi-altitude.js`, module pur sans DOM ni three.js, sur le patron d'`escalier-zoom.js`. `modes.js` et `main.js` l'appellent : `distanceArrivee` (`_arrivalPose`), `distancePresentation` (`_rescale`, `_loadDive`), `altitudeSortieOrbiteM` (`enterOrbit`), `altitudeOrbitaleM` (`update`), `altitudeSurfaceM` (`main.js`, `surfaceCamAltMeters`). ⚠️ **Aucun comportement changé** : ce sont les mêmes expressions, sorties de leur ligne. Trois constantes ne sont pas importables (`ZOOM_EXAG_DEFAULTS`/`BASE_EXAG` `main.js:3115`/`:3125`, `surfaceMaxDistance: () => 150` `main.js:3636`, la formule d'emprise de `dem.js:516-524`) : elles sont recopiées **et gardées par des assertions de texte source** qui échouent si l'original bouge.

**La grandeur, nommée : l'altitude GÉOMÉTRIQUE au-dessus de l'ellipsoïde, en mètres, SANS `dem.meanM`.** Orbital : `orbAlt × ORBITAL_M_PER_UNIT`. Surface : `camera.position.y ÷ ((TERRAIN_SIZE / dem.extentMeters) × demExaggeration)`. ⚠️ **L'exagération verticale entre dans l'échelle du bloc, donc dans l'altitude en mètres** — et elle change de palier en palier (5 à z5, 4 à z6, 3,2 à z7, 2,8 ensuite) : c'est elle qui rend les trois premiers sauts plus violents que les autres. `main.js` fait maintenant `altitudeSurfaceM(…) + dem.meanM` : la Tâche 1c n'a plus qu'un terme à retirer, et l'instrument y survit.

**Étape 2 — LES SAUTS RELEVÉS.** Mesure : `test/camera-continue.test.js`, profil `profilDescente()` — Mont-Blanc (45,8326°), zoom fin **15** (`DEFAULT_FINE_ZOOM`, `main.js:3091`), budget de niveau `STEP_IN = 1,2` (`modes.js`), 684 points, segments continus échantillonnés à ×1,02 maximum pour que le détecteur (seuil ×1,15) ne puisse pas les confondre avec un saut. **1 600,0 km au départ, 487 m à l'arrivée.**

| # | où | de → vers | écart | facteur | cause |
|---|---|---|---|---|---|
| 1 | `_dive` (`modes.js`, chemin nominal) | 1 600,0 km → **906,6 km** | −693 402 m | ÷1,765 | changement de repère complet ; la pose devient `_ARRIVAL_DIR × (150 × 0,94)`, sans rapport avec l'altitude quittée |
| 2 | `_rescale` z5→z6 | 271,1 km → **583,9 km** | +312 804 m | ×2,154 | téléportation au point de présentation **+ exagération 5 → 4** |
| 3 | `_rescale` z6→z7 | 174,6 km → **364,9 km** | +190 297 m | ×2,090 | idem, exagération 4 → 3,2 |
| 4 | `_rescale` z7→z8 | 109,2 km → **208,5 km** | +99 385 m | ×1,911 | idem, exagération 3,2 → 2,8 |
| 5-11 | `_rescale` z8→z9 … z14→z15 | 62,4 → 104,3 km, puis moitié à chaque cran, jusqu'à 975 m → **1 629 m** | +41 896 m … +655 m | **×1,672 constant** | téléportation seule (l'exagération ne bouge plus) |

⚠️ **LE SIGNE EST LE SUJET, PAS L'AMPLITUDE : les dix `_rescale` FONT MONTER LA CAMÉRA PENDANT QUE L'UTILISATEUR ZOOME.** Le facteur ×1,672 se dérive du dépôt et ne tient à aucun réglage de goût : `(99,93 / 29,89) × ½`, c'est-à-dire le rapport entre le point de présentation (`150 × 0,97`) et la butée du niveau (`× e^−1,2`), divisé par deux parce que l'emprise du bloc est divisée par deux d'un zoom au suivant. **Somme des remontées sur la descente : 685 623 m — on remonte 686 km en descendant de 1 600 km.** C'est l'altitude en dents de scie que la Tâche 2 bis (Étape 5) et la Tâche 1b doivent supprimer.

**Les trois autres régimes, mesurés eux aussi :**

- ⚠️ **`_dive` en plongée orbitale non-stop** (la molette descend sans se stabiliser jusqu'au plancher de `orbAltTarget`, `DIVE_ALT_M × 0,9 = 7 200 m`) : `pickDiveTier(7200)` rend le palier fin, **un seul saut, 7 200 m → 1 581 m, ÷4,554**. Un seul saut mais le plus violent en facteur : **le trajet à moins de sauts est celui où chaque saut est le pire.**
- ⚠️ **`_loadDive`** (clic-plongée, `modes.js`, Tâche 1c Étape 2) — **quatrième site, absent de la liste des sauts connus du plan.** Après le tween d'approche de 30 %, la téléportation au point de présentation de l'étage suivant fait **DESCENDRE** l'altitude de **÷1,423** (÷1,245 sur z7→z8, où l'exagération corrige) : 74,2 km → 52,1 km à z9→z10, 4 637 m → 3 258 m à z13→z14. **Signe opposé à `_rescale` sur le même geste apparent (zoomer d'un cran).**
- **`enterOrbit` (`modes.js:296`) — le saut existe mais il a TROIS régimes, et le plan n'en nommait qu'un :**
  - **automatique** (`entryAltM = null`, molette/stepper au plancher de l'escalier) : **×1,150 exactement**, borné à [15 km, 9 000 km]. Il n'est atteignable qu'à **z3** (`getCoarsenTarget()` rend `null` au plancher) : 2 235,4 km → 2 570,8 km. ⚠️ **Le plus petit saut de tout le trajet** — le plan le rangeait avec les gros.
  - **bouton globe** (`main.js:8442`, `modes.enterOrbit(16000000)`) : depuis la butée z15 (487 m), **487 m → 16 000 km, ×32 835**.
  - **`flyTo`** (`modes.js`, `enterOrbit(1200000)`) : **487 m → 1 200 km, ×2 463**.
  - ⚠️ **Et le régime automatique lit `surfaceCamAltMeters()`, donc `+ dem.meanM`** : c'est le point exact où la violation de R1 pilote une décision de cadrage. À z3 `meanM` est négligeable devant 2 235 km ; **la Tâche 1c doit quand même le retirer, parce que la Tâche 1b va rendre `enterOrbit` atteignable depuis toutes les altitudes.**

**Ce qui n'a PAS été mesuré, et pourquoi :** le glissé orbital (`THREE.MathUtils.damp` dans `update`) et le glissé inertiel de surface (`_applyZoom`) sont **continus par construction** — vérifié, zéro saut détecté sur le segment orbital seul. Le `catch` de `_dive` (`tier.altM × 1,6`) est le chemin d'échec, pas la discontinuité — le plan l'avait déjà tranché. **Hypothèse assumée du profil : l'utilisateur dépense le budget complet du niveau (`STEP_IN`) avant chaque `_rescale`** — c'est le chemin de la molette (`_refine` ne part qu'à la butée) ; par le bouton stepper, `_rescale` peut partir de n'importe quelle distance et le saut n'a alors pas la même amplitude, mais il a le même signe.



#### Tâche 1b — le changement de repère ✅ FAITE LE 2026-08-20 (PREMIÈRE MOITIÉ) — **LE DERNIER SAUT D'ALTITUDE EST PARTI, LA FRONTIÈRE DE RENDU RESTE**

⚠️ **ELLE A ÉTÉ COUPÉE EN DEUX, ET LE PLAN L'AVAIT ANNONCÉ (« le geste le plus lourd »).** Ce qui est livré : **la LOI de la caméra** — l'altitude est continue de l'orbite au sol, les butées sont unifiées, les deux planchers orbitaux sont partis, R1 est réparée, et le troisième appelant de `chargeRacines()` est posé. Ce qui ne l'est pas : **la FRONTIÈRE DE RENDU** — `globe.setVisible(false)` / `setSurfaceVisible(true)` sont intacts, l'un s'éteint toujours quand l'autre s'allume. → **Tâche 1b bis**, écrite juste après, avec sa raison chiffrée.

**Fichiers livrés :** `src/loi-altitude.js` (+ `niveauDePlongee`, `distancePourAltitude`, `altitudePourDistance`, `distanceMinOrbitale`, `planProche`, `PENTE_ARRIVEE_Y`, `ALT_PLANCHER_ORBITALE_M` ; `profilDescente` prend `plongeeContinue`) · `src/modes.js` (`_dive`, `_niveauDePlongee`, `_posePlongee`, `_poseButees`, `_altitudeCadrageM`, `_solSous`) · `src/main.js` (`altitudeCadrageM`, hooks `surfaceCamAltCadrageM` et `echelleVerticaleAuZoom`, `assureRacinesGlobe`) · `test/camera-continue.test.js` (**inversé**, 14 → 23 tests) · `test/escalier-surface.test.js` (six assertions corrigées **en place**). **`npm test` : 3 098 verts** (3 089 avant) · `audit:tests` : 180 / 180, aucun écart.

**LE RÉSULTAT, MESURÉ SUR L'INSTRUMENT DE LA TÂCHE 1a** (Mont-Blanc 45,8326°, zoom fin 15, budget `STEP_IN = ln 2`) :

| | avant la 1b | après |
|---|---|---|
| sauts sur la descente 1 600 km → sol | **1** (`_dive`, ÷1,765) | **0** |
| seuil du détecteur | ×1,15 | **×1,0201** — le pas d'échantillonnage lui-même |
| pas le plus gros du profil entier | ÷1,765 | **×1,019 715** |
| `max │Δ² log altitude│` | 0,927 | **0,019 523** (= `log 1,02`, la borne) |
| altitude d'arrivée à z15 | 418 m | **363,1 m** |
| plongée non-stop depuis 7 200 m | 1 saut, ÷4,554 | **0** |

**LE GESTE, EN UNE PHRASE : `_dive` ne pose plus la caméra pour subir l'altitude qui en résulte — il part de l'altitude.** La plongée ayant DEUX inconnues (le niveau de zoom et la distance), `niveauDePlongee` les résout ensemble : **le niveau le plus fin dont la distance tient sous le plafond d'arrivée**. `DIVE_TIERS` cesse d'être la table qui décide du niveau (elle reste le déclencheur et sert au clic) ; le niveau est **dérivé**, comme la Tâche 2 bis a dérivé le cran. Au Mont-Blanc, plonger depuis 1 600 km atterrit donc sur **z4 à 62,6 unités** et non plus sur z5 à 141.

⚠️ **ET LA TABLE `DIVE_TIERS` ÉTAIT DÉJÀ GÉOMÉTRIQUE SANS LE SAVOIR, DE z8 À z11 :** ses seuils (200 000 · 100 000 · 50 000 · 25 000 m) valent à **1,2 % près** les plafonds calculés (201 740 · 100 870 · 50 435 · 25 217 m). Elle ne divergeait que là où l'exagération change de palier — z3 à z7 — et à la porte fine.

- [x] **Étape 1 — le test qui échoue**, sur l'instrument de la Tâche 1a : *l'altitude est **monotone et sa dérivée seconde bornée** sur une descente de 1 600 km à 2 km*. ⚠️ **C'est l'inverse du test de caractérisation de la 1a : celui-ci passe au rouge et celui-là devient faux. Retirez le test de caractérisation dans le même commit** — deux tests contradictoires verts sont pires qu'aucun.

  ⚠️ **CETTE ÉTAPE A DÉJÀ ÉTÉ FAITE AUX TROIS QUARTS PAR LA TÂCHE 2 bis, ET LA MONOTONIE EST DÉJÀ VRAIE.** Il ne reste **qu'un seul saut** sur le profil, `_dive`, et **il DESCEND** (÷1,765) : la descente est monotone, elle n'est pas continue. **Reformulez donc l'assertion sur la CONTINUITÉ, pas sur la monotonie** — sans quoi elle est verte avant d'être écrite. ⚠️ **Et le test de caractérisation n'a PAS été supprimé** : il a été re-pointé sur la loi d'avant (`cranContinu: false`, `budgetNiveau: 1.2`), qui reste rejouable et prouve que la nouvelle assertion n'est pas une tautologie. **Ne le supprimez pas sans le remplacer par cette preuve-là.**

  → **FAIT, ET LE FICHIER N'A PAS ÉTÉ SUPPRIMÉ : IL A ÉTÉ INVERSÉ.** L'assertion dangereuse était « il reste un saut », pas le fichier ; elle est devenue « il n'en reste aucun », au seuil **×1,0201** — c'est-à-dire le pas d'échantillonnage du profil lui-même, et non un seuil de confort. **Le relevé des onze sauts reste rejouable** contre la loi d'avant (`budgetNiveau: 1,2`, `cranContinu: false`, `plongeeContinue: false`) : c'est lui qui prouve que la nouvelle assertion n'est pas une tautologie, et le supprimer aurait emporté la preuve avec le défaut. `package.json` est donc inchangé et `audit:tests` sans écart. **Le fichier ne porte plus aucune mention « temporaire ».**
- [x] **Étape 1 bis — geste par geste.** `up`, `near`/`far`, pose, `minDistance` : chacun devient une fonction continue de l'altitude, ou disparaît.

  - **`up` — DISPARAÎT, et le plan avait tort** : `enterOrbit` écrivait la même ligne. Voir la correction en place plus haut.
  - **`near` — UNE SEULE LOI, et elle était déjà partagée sans qu'on le sache.** `planProche(hauteur) = clamp(hauteur × 0,2 ; 0,01 ; 0,5)` est la formule que le mode orbital appliquait par image. **Rejouée en surface, elle rend exactement 0,5** — la constante que le mode surface reposait en dur — parce qu'elle SATURE dès 2,5 unités de dégagement. `modes.js` l'appelle maintenant des deux côtés. ⚠️ **Bénéfice inattendu, et il répare un défaut écrit dans `main.js:8451` :** `near` n'est plus RESTAURÉ depuis `_surfCam`, il est DÉDUIT — une valeur déduite ne peut plus transporter le `near` desserré à ≈122 que le cadrage du damier empruntait et qui tranchait la moitié proche de la carte au retour de plongée.
  - **`far` — RESTE À DEUX VALEURS, et c'est arithmétique, pas un renoncement.** Surface 290, orbite 1 400. Une loi unique `far = distance × k` bornée exige `far ≥ distance + 2 × R_GLOBE` en orbite : à `distance = 200` (orbite basse) il faut **400** là où la surface veut **290**, et aucun `k` unique ne satisfait les deux sans desserrer le plan lointain de la surface de 290 à ≈500 — c'est-à-dire dégrader la précision du tampon de profondeur du bloc pour rien. **`far` ne fusionne que si les deux mondes fusionnent** : il appartient à l'Étape 2.
  - **pose — FAIT**, c'est le cœur de la tâche (voir le tableau ci-dessus).
  - **`minDistance` — FAIT**, voir l'Étape 3.
- [x] **Étape 2 — la frontière `globe.js` / `terrain.js`.** ⚠️ **C'est le geste le plus lourd : aujourd'hui l'un s'éteint quand l'autre s'allume.** Dites ce qui les fait coexister — recouvrement, fondu, ou remise du globe au rang de fond lointain.

  ### ⚠️ LA DÉCISION, ÉCRITE : **LE GLOBE DEVIENT UN FOND LOINTAIN RENDU DANS SA PROPRE PASSE — ET LES DEUX AUTRES OPTIONS SONT IMPOSSIBLES, C'EST CALCULÉ**

  Le globe est une **sphère de rayon 100 unités centrée à l'origine** (`R_GLOBE`, `geo.js:11`) ; le bloc est une **dalle de 56 unités, centrée à l'origine elle aussi** (`TERRAIN_SIZE`, `terrain.js:57`). **La dalle est donc ENTIÈREMENT À L'INTÉRIEUR de la sphère.** Les allumer ensemble ne montre pas deux mondes qui se recouvrent : cela montre une planète opaque avec la carte enterrée dedans. **Ni le recouvrement ni le fondu ne peuvent exister tant que les deux objets partagent l'espace.**

  **Et on ne peut pas les remettre à la même échelle.** Le facteur horizontal du bloc vaut `56 / empriseMètres` ; poser le globe à cette échelle demanderait un rayon de `6 371 000 × 56 / emprise` :

  | niveau | emprise du bloc | rayon du globe à cette échelle | verdict |
  |---|---|---|---|
  | z4 | 5 235 km | **68 unités** | la dalle (56) est plus grande que la planète |
  | z5 | 2 618 km | 136 unités | plausible |
  | z10 | 81,8 km | 4 362 unités | déjà tendu |
  | **z15** | **2,56 km** | **139 600 unités** | ⚠️ **float32 mort** — exactement le défaut que le repère relatif `150f817` a corrigé pour le bloc, réintroduit pour le globe |

  **Donc : deux passes de rendu, pas une scène.** Le globe se dessine en **fond**, avec sa propre caméra placée sur une réplique à son échelle et **orientée comme la caméra principale**, sans écriture de profondeur ; le bloc se dessine par-dessus. C'est la solution classique des frustums emboîtés, et **la seule qui survive à z15**.

  ⚠️ **CE QUE ÇA COÛTE, ET POURQUOI CE N'EST PAS DANS CE COMMIT :** cela touche `composer` (`main.js`), le brouillard, le DOF, l'atmosphère, les nuages et l'ordre de rendu — **et aucun test de ce dépôt ne charge `main.js`.** Le seul filet serait de le regarder tourner, ce que ce chantier n'a **jamais** pu faire (« aucune image en mouvement n'a jamais été vue », §10). **Le livrer à l'aveugle dans le même commit que la loi d'altitude, c'est rendre les deux invérifiables à la fois.** → **Tâche 1b bis.**

  ⚠️ **ET LE PIÈGE DE `chargeRacines()` EST DÉSAMORCÉ D'AVANCE, COMME LE PLAN L'EXIGE.** Le troisième appelant est **posé** : `assureRacinesGlobe()` dans `main.js`, idempotent, armé par un `setTimeout` de **20 s** au démarrage — **hors de `hideLoading`**, donc il survit à la Tâche 2, et hors de `setVisible`, donc il survit à l'Étape 2. Le délai n'est pas un réglage de confort : l'A/B qui a créé le chargement différé mesure **la carte visible à 16,2 s dans le pire cas à 3 Mb/s**, donc un filet à 20 s ne tire jamais le premier en usage normal et ne rend pas les 3 730 ms gagnés. **`test/camera-continue.test.js` l'exige, et exige qu'il soit hors de `hideLoading`.**

  ⚠️ **PIÈGE SILENCIEUX, ET IL SE REFERME SUR DEUX TÂCHES À LA FOIS : `chargeRacines()` PERD SES DEUX APPELANTS.** `globe.js:326-336` énumère lui-même son filet — **(1)** `main.js:928`, appelé quand le voile de chargement se lève, **que la Tâche 2 supprime** ; **(2)** `globe.js:893`, `if (v) this.chargeRacines()` dans `setVisible`, **que cette étape-ci dissout**. Les deux partis, **les seize tuiles racines ne sont plus jamais demandées — sans erreur, sans test rouge, sans rien à l'écran.** ⚠️ **Posez le troisième appelant AVANT de retirer l'un des deux, et exigez-le dans le test.**
- [x] **Étape 3 — retirer le plancher orbital `modes.js:326`**, et unifier les **quatre** sites de `minDistance` (`:326`, `:420`, `:639`, `main.js:1215`) en une seule dérivation.

  **Les trois sites de `modes.js` sont devenus `Modes._poseButees(mode)`**, appelé par `enterOrbit`, `_dive` et `_loadDive` ; **le quatrième (`main.js`) importe `DISTANCE_MIN_SURFACE`.** Plus aucun littéral `6`, plus aucune formule recopiée, et les deux constantes vivent dans `loi-altitude.js` — donc le test les voit. ⚠️ **Les deux VALEURS ne fusionnent pas en une, et il faut le dire :** en surface c'est une distance à la CIBLE sur une dalle, en orbite une distance au CENTRE d'une sphère. **Une valeur unique suppose un monde unique — encore l'Étape 2.** Ce qui est unifié, c'est le SITE et la SOURCE.

  ⚠️ **ET LES DEUX PLANCHERS SONT PARTIS**, pas seulement celui que ce plan nommait : voir la liste élargie plus haut.
- [x] **Étape 4 — mutation** : réintroduire un saut doit tuer le test de monotonie de la Tâche 1a.

  `profilDescente({ plongeeContinue: false })` rejoue **exactement** l'ancien `_dive` — niveau lu dans `DIVE_TIERS`, distance fixe `poseArrivee` — et **remet le saut 1 600,0 km → 906,6 km, ÷1,765**, au chiffre près du relevé de la Tâche 1a. Elle tue *« LA DESCENTE DE RÉFÉRENCE EST CONTINUE »*. Trois autres mutations restent armées depuis la Tâche 2 bis (`cranContinu: false`, `budgetNiveau: 1,2`, `STEP_OUT` asymétrique).
- [x] **Étape 5 — LA CLÔTURE DU §0**, les quatre commandes dans l'ordre, puis commit.

#### ⚠️ CE QUI SAUTE ENCORE — TROIS CHOSES, TOUTES MESURÉES, AUCUNE CACHÉE

**1. LE CHAMP VISUEL SAUTE ENCORE DE `exagération(z)` À LA PLONGÉE, ET CE N'EST PAS UN OUBLI : C'EST LA GRANDEUR ELLE-MÊME.** La Tâche 1a a nommé « altitude » la quantité `camY ÷ échelle du bloc`, et cette échelle porte l'exagération **verticale**. Or la largeur de sol vue dans le champ dépend de l'échelle **horizontale**, qui ne la porte pas. **Conserver l'une fait varier l'autre d'exactement `exagération(z)`.** Mesuré au Mont-Blanc, champ de 30° :

| | largeur de sol vue | rapport à l'orbite |
|---|---|---|
| orbite, 1 600 km | 857 km | 1 |
| surface **avant** la 1b (z5, d = 141) | 3 537 km | **×4,125** |
| surface **après** la 1b (z4, d = 62,6) | 3 139 km | **×3,661** |

Le résidu se dérive : **`exagération(z) ÷ pente d'arrivée` = 2,5 / 0,6877 = 3,635**. Le facteur `1 / 0,6877` est LÉGITIME (une vue oblique à 43° voit plus large qu'une vue au nadir) ; **c'est `exagération(z)` qui ne l'est pas.** ⚠️ **Autrement dit : l'ALTIMÈTRE est devenu continu, le CADRAGE ne l'est qu'à moitié — il s'améliore de 11 %, il ne se ferme pas.** Deux issues, et **aucune n'est du code seul** : ou bien l'altitude de cadrage cesse de porter l'exagération — **et les onze sauts mesurés à la Tâche 1a changent tous de valeur**, il faut refaire le relevé —, ou bien **Adrien renonce aux paliers d'exagération** (`{3: 2,5 · 4: 2,5 · 5: 5 · 6: 4 · 7: 3,2 · 2,8 ensuite}`). **→ §9.**

**2. LE CRAN z4 → z5 PEUT ENCORE SAUTER, ET C'EST LA MÊME TABLE QUI EN EST CAUSE.** Un cran divise l'emprise par deux, donc rend ×2 de distance — **sauf de z4 à z5, où l'exagération passe de 2,5 à 5 et où le cran rend ×4**. Le glissé n'ayant dépensé que `ln 2`, la distance d'après vaut le double de celle d'avant le niveau et **dépasse la butée de 150 unités dès qu'on entre dans z4 au-dessus de 75**. Mesuré : **×1,316 à 64° de latitude, ×1,554 en plongeant de 3 000 km, ×1,808 de 7 000 km**. **Le vol de référence du §0 n'en rencontre aucun** (il entre dans z4 à 62,6). L'assertion de borne de `test/camera-continue.test.js` dit **où il peut y en avoir un et nulle part ailleurs** — elle rougit dans les deux sens. **Le remède : `STEP_IN = ln(facteur d'échelle du cran)` au lieu de `ln 2` — c'est le territoire de la Tâche 2 bis, pas celui-ci.**

**3. AU-DESSUS DE 7 230 km LA PLONGÉE EST BORNÉE** (`borne: 'haut'`) : aucun niveau ne peut héberger l'altitude, la caméra atterrit à la distance plafond sur z3, et l'altitude saute. **La vraie porte orbitale est donc GÉOMÉTRIQUE** — 7 230 km au Mont-Blanc, 10 407 km à l'équateur — là où `DIVE_TIERS` la posait à 16 000 km à la main. ⚠️ **Le DÉCLENCHEUR n'a PAS été changé** (`pickDiveTier` décide encore *quand* plonger) : déplacer une porte que l'utilisateur voit sans l'avoir regardée tourner aurait été exactement ce que ce plan reproche à ses propres constantes.

#### Tâche 1b bis — LA FRONTIÈRE DE RENDU ⚠️ LA SECONDE MOITIÉ DE LA 1b, ET ELLE EST VISUELLE

**Fichiers :** modifier `src/main.js` (la passe de composition), `src/modes.js` (`setSurfaceVisible` / `globe.setVisible`), `src/globe.js` · tester : ⚠️ **rien sous node ne peut le faire.**

⚠️ **ELLE NE PEUT PAS ÊTRE LIVRÉE À L'AVEUGLE, ET C'EST LA SEULE TÂCHE DU PLAN DONT ON PUISSE LE DIRE AVEC UN CHIFFRE :** `main.js` n'est chargé par **aucun** test (§0), la scène ne se rend pas sous node, et le §10 constate qu'**aucune image en mouvement n'a jamais été vue** dans tout ce chantier. Les treize autres tâches ont un instrument pur ; celle-ci n'en a pas.

- [ ] **Étape 1 — poser la seconde passe** : le globe rendu en fond, caméra répliquée à son échelle, orientation partagée, sans écriture de profondeur.
- [ ] **Étape 2 — le raccord d'échelle** : la réplique doit voir la planète sous le MÊME angle apparent que le bloc montre son emprise. **C'est là que le facteur `exagération(z)` du point 1 ci-dessus se paiera ou se réglera** — les deux tâches se croisent sur ce seul nombre.
- [ ] **Étape 3 — `setVisible` cesse d'être l'interrupteur.** ⚠️ **`globe.js:893` (`if (v) this.chargeRacines()`) se dissout ici — le troisième appelant est DÉJÀ posé et exigé par le test, ne le retirez pas.**
- [ ] **Étape 4 — brouillard, atmosphère, nuages, DOF, et `camera.far`** : dire lesquels appartiennent à quelle passe. `far` fusionne ici, ou nulle part (voir l'Étape 1 bis de la 1b).
- [ ] **Étape 5 — REGARDER TOURNER, avec Adrien.** Il n'y a pas d'autre garde-fou et il ne faut pas prétendre le contraire.
- [ ] **Étape 6 — LA CLÔTURE DU §0**, les quatre commandes dans l'ordre, puis commit.

#### Tâche 1c — les mécanismes qui figent l'entrée

⚠️ **Aucune version de ce plan ne les nommait, et ils gèlent la caméra plus longtemps que les rideaux.**

- [ ] **Étape 1 — DÉVERROUILLER `this.busy` ET `demBusy`. ⚠️ CE PLAN N'AVAIT ICI QUE DES CONSTATS, SANS UN SEUL VERBE À L'IMPÉRATIF.**
  - `this.busy` — **vingt-huit sites** dans `modes.js` (`:138`, `:203`, `:242`, `:296`, `:308`, `:386`…). Tant qu'il est vrai, **la molette, `flyTo`, les steppers et la caméra sont gelés**.
  - ⚠️ **`demBusy` — DEUXIÈME VERROU, ET IL EN VAUT DEUX À LUI SEUL.** Six sites dans `main.js` (`:3057`, `:3384-3385`, `:3413`, `:3602-3603`, `:3619`), **avec deux contrats opposés sur deux chemins** : `:3384` fait un `return` silencieux, `:3602` lève `throw new Error('terrain busy')` → **bandeau « FAILED » à l'écran**. Il garde aussi `canStep` (`main.js:9475`) **avec** `modes.busy`. **Traitez les deux chemins séparément.**
  - ⚠️ **`rebuildPending` — TROISIÈME VERROU, ZÉRO OCCURRENCE DANS TOUTES LES VERSIONS DE CE PLAN, ET IL MENT À SON APPELANT.** `main.js:3417-3420` : quand une reconstruction est déjà en cours, il rend **`Promise.resolve()`** — l'appelant croit son geste exécuté alors qu'il a été jeté. ⚠️ **Et la cible coalescée le rend DANGEREUX** : elle retire la sérialisation qui l'endormait aujourd'hui. **Traitez-le dans la même étape, ou vous échangerez un gel visible contre une perte silencieuse.**
  - ⚠️ **ET UN QUATRIÈME MÉCANISME, INVISIBLE À TOUS LES BANCS PARCE QU'IL NE LÈVE AUCUN DRAPEAU : `setTimeout(hideLoading, 2600)` DANS LE `catch` DE `loadRealTerrain`** (`main.js:3408-3411`). Quand le chargement échoue, le voile reste **2,6 secondes de plus** alors que `demBusy` est **déjà relâché** — l'application est libre et l'écran ne le dit pas. ⚠️ **Et c'est la réponse, déjà écrite dans le code, à la question du §9 « ce que l'utilisateur voit quand le réseau refuse » : aujourd'hui il voit le voile, deux secondes six.** **Nommez-le, et dites ce qu'il devient.**
  - ⚠️ **LE GESTE : UNE CIBLE COALESCÉE, ET SURTOUT PAS UNE FILE.** Ce plan a écrit « un verrou qui met en file et rejoue » : **mesuré, c'est PIRE que le verrou d'aujourd'hui.** Sur une rafale de six crans en une seconde, l'entrée morte passe de **1,95 s à 11,70 s** ; sur vingt crans hésitants, à **29,75 s sur 30 (99,2 %)**, avec une latence médiane de **896 images** et quatre gestes encore en file à la fin. La file **rejoue l'oscillation littérale** `9→8→9→8` quinze fois de suite. **Sur le trajet de référence, elle ne change l'entrée morte de rien du tout.**
  - **Ce qui marche, mesuré :** garder **le DERNIER geste seulement** — une cible, pas une file. **3,90 s d'entrée morte, latence 4 images, et c'est le seul régime qui atterrit au bon zoom.**
  - **Le seuil, et ⚠️ CE PLAN EN A ÉCRIT TROIS QUI NE MORDENT PAS.** « `busy || demBusy` vrai » : un verrou qui met en file reste vrai. « Zéro geste refusé » : les trois régimes marquent zéro. **Et « latence médiane sous 10 images, traîne sous 0,5 s » est HORS D'ATTEINTE** — mesuré, avec `_whiteout` (960 ms) et `loadSurface` (≈1 s), l'opération dure 1 960 ms à la place de cette tâche dans l'ordre, et **aucun régime ne rend les deux seuils verts** ; ils ne passent ensemble qu'en dessous de **~700 ms d'opération**, sur un chemin qu'aucune des quinze tâches ne touche.
  - ⚠️ **ET LE CRITÈRE NE PEUT PAS ÊTRE L'ENTRÉE MORTE : LE DÉFAUT LA GAGNE. C'EST LA QUATRIÈME FORMULATION, ET LES TROIS PREMIÈRES ÉTAIENT FAUSSES.** Mesuré : sur la **rafale**, la cible coalescée fait **3,93 s contre 1,97 s** au verrou d'aujourd'hui ; sur l'**hésitation**, **9,83 contre 7,87 s**. **Le verrou gagne parce qu'il JETTE cinq gestes sur six** — minimiser le temps bloqué récompense précisément le défaut qu'on veut supprimer.
  - ⚠️ **LA GRANDEUR QUI DISCRIMINE EST L'HONNÊTETÉ DU GESTE, ET ELLE EST BINAIRE : LE ZOOM D'ARRIVÉE EST-IL CELUI QUE L'UTILISATEUR A DEMANDÉ ?** Assertion : **après une rafale de six crans, le zoom final est celui du sixième cran** — aujourd'hui il ne l'est pas, la cible coalescée l'obtient. **C'est le seul régime qui atterrit au bon zoom, et c'est cela qu'il faut tester.** Ajoutez la **latence médiane** comme second critère (elle doit rester bornée), et **ne mesurez plus l'entrée morte comme un succès** : elle sert à décrire, pas à juger.
  - ⚠️ **ET N'ANNONCEZ PAS DE TOTAL EN SECONDES : `_whiteout` FAIT 480 + 480 ms ET IL EST ATTENDU AVANT QUE LE VERROU SE LÈVE.** Sur la descente de référence, ses **sept rideaux encore posés à ce stade** valent **≈6,7 s à eux seuls, réseau instantané compris** — et le §10 ne les retire qu'en toute fin de parcours (Tâche 2 ter). **Tant qu'ils sont là, aucun seuil absolu d'entrée morte n'est atteignable, et c'est arithmétique, pas une question d'effort.**
- [ ] **Étape 2 — `_loadDive` / `diveTo`** — le clic-plongée, **un second chemin de plongée entier**, distinct de `_dive`, avec un recul de caméra de **×3,32 à ×24,25** (le maximum se dérive du dépôt : `surfaceMaxDistance 150 × 0,97 / minDistance 6`).
- [ ] **Étape 3 — `enterOrbit`** (`modes.js:296`) — la remontée. ⚠️ **Mesuré : elle est PIRE que la descente — 11 rideaux contre 8, 35,3 % d'écran blanc, 70,8 % d'entrée morte.**
- [ ] **Étape 3 bis — le bandeau `announce` / `.fui-msg` (`style.css:509`). ⚠️ 11,18 s SUR 30, ET CE PLAN A LONGTEMPS CITÉ LE CHIFFRE SANS NOMMER LE MÉCANISME.** Le bandeau annonce « ACQUIRING SURFACE DATA », « FX ONLINE », « SURFACE DATA UNAVAILABLE — HOLDING ORBIT » : il **raconte les paliers** que ce chantier supprime. **Dites ce qu'il devient** — il disparaît avec eux, ou il change de propos.
- [ ] **Étape 4 — sortir `dem.meanM` de `surfaceCamAltMeters`** (`main.js:3594-3599`, règle R1), ou dire pourquoi il peut rester.
- [ ] **Étape 5 — poser le point d'appel de `zoomSoutenable`. ⚠️ SANS CETTE ÉTAPE, LA RÈGLE R3 N'A AUCUN PROPRIÉTAIRE.** La Tâche 4 ter fabrique la fonction mais délègue ici la moitié caméra, et cette tâche passe **avant** elle. **Posez le point d'appel sur le chemin de descente et laissez-le inerte** (`zoomSoutenable` renvoyant le zoom demandé) jusqu'à ce que la 4 ter le remplisse. Sinon personne ne le pose jamais.
- [ ] **Étape 5 bis — ÉCRIRE LE TEST DE COMPARAISON. ⚠️ AUCUNE ÉTAPE DE CETTE TÂCHE NE L'ÉCRIVAIT, ET L'ÉTAPE SUIVANTE PRÉTEND LE MUTER.** Il rejoue les trois scénarios sur les trois régimes et assère que la cible bat le verrou actuel. C'est lui, et lui seul, qui dira si la tâche a réussi.
- [ ] **Étape 6 — mutation** : remettre le verrou qui refuse doit tuer le test de comparaison.
- [ ] **Étape 7 — LA CLÔTURE DU §0**, les quatre commandes dans l'ordre, puis commit.


### Tâche 2 bis : l'escalier de surface ✅ FAITE LE 2026-08-20 — 17 RIDEAUX SUR 25 ET **DIX DES ONZE SAUTS D'ALTITUDE**

⚠️ **ELLE EST PASSÉE AVANT LES TÂCHES 1b ET 1c, ET C'EST LA MESURE DE LA 1a QUI L'A DÉCIDÉ.** Le plan la rangeait après elles ; le relevé des onze sauts a montré que **dix** sont posés par `_rescale`, c'est-à-dire par cette tâche-ci, et **un seul** par `_dive`, qui reste à la 1b. Le §10 porte le nouvel ordre.

**Fichiers :** modifier `src/modes.js` (`_rescale` `:452`, `_refine` `:436`, `_coarsen` `:445`) · tester `test/escalier-surface.test.js` (créer)

⚠️ **LES REPÈRES DE LIGNE DE CETTE TÂCHE ONT GLISSÉ DE +14 À LA TÂCHE 1a** (les imports de `loi-altitude.js`) : `_rescale` était à `:466` et non `:452`, ses trois `_whiteout` frères à `:326`, `:422`, `:642`. **Cherchez les noms, pas les numéros.**

**C'est la première source du pop-up**, et elle n'était dans aucune tâche. Chaque cran de zoom en mode surface passe par `_rescale`, qui pose un rideau blanc **et téléporte la caméra** au point de présentation.

⚠️ **CETTE TÂCHE ET LA TÂCHE 1 SE MARCHENT DESSUS, ET L'ORDRE COMPTE.** Elles partagent `_arrivalPose` (`modes.js:358`, appelée par `_dive` `:417` **et** par `_rescale` `:469`), `loadSurface` et `_whiteout`. ~~**Faites la Tâche 1 d'abord**~~ — **CONSIGNE INVERSÉE LE 2026-08-20 par la mesure de la Tâche 1a** : c'est `_rescale` qui porte dix des onze sauts, la Tâche 1b n'en porte qu'un. Faire la 1b d'abord aurait corrigé le petit avant le gros. `_arrivalPose` est resté intact : cette tâche ne lui prend que la CIBLE, pas la distance.

⚠️ **À TRANCHER AVEC ADRIEN AVANT DE COMMENCER.** Le commentaire de `:455` porte la mention *« Remplace la continuité d'altitude v42 »* : **une continuité d'altitude a déjà existé ici et Adrien l'a fait retirer.** Il faut savoir pourquoi avant de la rétablir. **C'est une question, pas une tâche.** → **RÉPONDUE PAR LA MESURE, voir « ce que v42 avait probablement contre lui » plus bas.**

- [x] **Étape 0 — trancher la forme du test, comme la Tâche 1a.** ⚠️ **Le test d'exécution n'est écrivable par aucune des deux voies que ce plan nomme** : `Modes` appelle `document.createElement`, pas de jsdom, aucun test ne l'instancie. **Module pur ou assertion de texte source : dites lequel avant l'Étape 1.** → **LES DEUX, et c'est ce qui fait mordre les mutations** : l'instrument pur de la Tâche 1a (`src/loi-altitude.js`, `profilDescente`/`sautsDuProfil`) pour la géométrie, des assertions de texte source pour LIER cet instrument au code — `modes.js` **appelle** `poseCranContinu`, il ne le recopie pas.
- [x] **Étape 1 — le test qui échoue : LE RIDEAU, ET LUI SEUL.** *Un changement de cran en mode surface ne pose aucun `_whiteout`.* ⚠️ **N'y mettez PAS la téléportation** — une version de ce plan l'y avait mise tout en interdisant de la retirer, ce qui rendait la tâche insoluble. → `test/escalier-surface.test.js`, **13 tests**.
- [x] **Étape 2** — le lancer, vérifier qu'il échoue. → **9 tests sur 13 rouges** contre `src/modes.js` et `src/main.js` au niveau de `b88c935`, dont les deux assertions demandées.
- [x] **Étape 3 — retirer le rideau de `_rescale`.** ⚠️ **C'est l'appelant `modes.js:468`, et il appartient à CETTE tâche** — la Tâche 2 ter traite les trois autres. → fait ; **les trois autres sont intacts et le test l'exige** (`enterOrbit`, `_dive`, `_loadDive`).
- [x] **Étape 4 — mutation** : remettre le rideau doit tuer le test. → **tue** *« un changement de cran en mode surface ne pose aucun `_whiteout` »*.
- [x] **Étape 5 — RETIRER LA TÉLÉPORTATION. ✅ ADRIEN A TRANCHÉ LE 2026-08-20 : zoom continu, « exactement comme Google Earth ou Google Maps ».** `modes.js:455-458` (v48) part, l'altitude redevient continue d'un cran à l'autre. ⚠️ **v48 remplaçait une continuité v42 retirée pour une raison qui n'est écrite nulle part** — le garde-fou est le test de la Tâche 1a-1b : altitude monotone, dérivée seconde bornée, arrivée au zoom demandé. **Si le défaut de v42 reparaît, ces trois assertions le montreront.** → fait, **et l'angle de vue de l'utilisateur est gardé** : c'est la moitié de v48 qui était bonne.
- [x] **Étape 6 — mutation** : remettre la téléportation doit tuer le test. → **tue** *« `_rescale` conserve l'altitude métrique au lieu de téléporter »*.
- [x] **Étape 7 — LA CLÔTURE DU §0**, les quatre commandes dans l'ordre, puis commit.

#### Ce que v42 avait probablement contre lui — MESURÉ, PAS DEVINÉ

⚠️ **CONSERVER L'ALTITUDE AU CRAN NE SUFFIT PAS, ET C'EST LE PIÈGE QUI A DÛ TUER v42.** Un cran divise l'emprise du bloc par deux : il rend **×2** de recul. Le budget de zoom du niveau valait **`STEP_IN = 1,2`, soit ×3,32**. Chaque étage consommait donc **×1,66 de plus** que le cran suivant ne rendait.

Tant que `_rescale` téléportait au point de présentation, cet écart n'avait aucune conséquence — le cran effaçait tout, au prix des ×1,672 de remontée. Dès que l'altitude est conservée, il **s'accumule**. Mesuré sur la descente de référence (Mont-Blanc, z5 → z15) :

| budget du niveau | sauts `_rescale` | distance de scène | arrivée z15 | ce qu'on voit |
|---|---|---|---|---|
| **1,2 (inchangé)** | 0 | s'écroule de 141 à **6,00** — le plancher `minDistance` — **dès z8** | 62 m | un neuvième du bloc dans le cadre, et de la donnée z9 (213 m le texel) regardée depuis 4 km |
| **`ln 2` (un cran)** | 0 | se stabilise vers **77**, glisse à 38, le cran la ramène à 77 | **418 m** (487 m avant) | le cadrage ne bouge plus d'un étage à l'autre |

**Et `STEP_OUT` devait suivre, sinon l'aller-retour CLIQUETTE :** avec 1,2 en entrée et 0,55 en sortie, un cran de zoom suivi d'un cran de dézoom rend **14 326 m** là où on était parti de **27 696 m** — on revient **deux fois plus bas** qu'avant d'avoir zoomé, et rien ne le signale. À budgets égaux : **×0,970**, le résidu venant du `y = −0,3` de la cible.

**Le geste, donc :** `STEP_IN = STEP_OUT = Math.LN2`. ⚠️ **Et « au moins 20 crans » (Adrien) est désormais DÉRIVÉ du budget** — `ZOOM_IMPULSE = STEP_IN / (20 × ZOOM_TAU)` — au lieu d'être posé à côté de lui : la valeur littérale (0,05) aurait fait tomber le niveau à 11,5 crans de molette. **Les trois mutations sont gardées par le test** : remettre 1,2 écrase la caméra sur le plancher, remettre 0,55 fait cliqueter l'aller-retour, remettre la téléportation ramène les dix remontées.

⚠️ **CE QUI RESTE À REGARDER À L'ÉCRAN, ET CE PLAN NE PEUT PAS LE TRANCHER :** l'exagération verticale change de palier à `z5→z6`, `z6→z7` et `z7→z8` (5 → 4 → 3,2 → 2,8, `ZOOM_EXAG_DEFAULTS`). L'altitude, elle, est continue — c'est le hook `echelleVerticaleBloc` qui absorbe le changement. Mais **le RELIEF, lui, change de forme à ces trois crans**, et le rideau blanc ne le masque plus. **À voir en vol avant de retirer la carte `#loading` (Tâche 2), qui le couvre encore aujourd'hui.**

### Tâche 2 : retirer la carte `#loading` ⚠️ C'EST LE POP-UP QU'ADRIEN NOMME

**Fichiers :** modifier `src/main.js` (`showLoading` `:908`, `hideLoading` `:912` **et ses trois appelants**, `LOADING_MIN_MS` `:898`, les appels `:3182` et `:3421`, `canStep` `:9475`, **et `:937` — voir le piège**) · modifier `src/style.css` (`#loading` `:19-`, `body.ld-warm #loading-bg` `:168`, `body.ld-warm #app` `:182`, **et le `filter: blur(16px)` de `:186` sous le sélecteur `:has()` de `:185`**) · modifier `index.html` (le balisage, le peintre en ligne, `__ldStart`) · lire `src/ui/loading-hints.js` et `src/ui/hub.js` · tester `test/voile-loading.test.js` (créer)

⚠️ **ÉLARGISSEZ CETTE LISTE, NE LA REMPLACEZ PAS.** Ce plan a commis deux fois la même faute — corriger un repère faux en supprimant les justes qui l'entouraient. **Faites `grep -rn "loading\|ld-warm" src/ index.html` avant de commencer, et ajoutez ce que vous trouvez.**

⚠️ **CE PLAN A CRU QU'IL Y AVAIT TROIS FICHIERS : IL Y EN A SIX.** Cherchez `#loading` partout avant de commencer.

**Ce que c'est :** une carte de marque centrée — nom, baseline, orbe qui tourne — avec `#loading-bg` plein écran et **`LOADING_MIN_MS = 2000`, deux secondes minimum au premier affichage**. `showLoading()` est appelé **à chaque cran de zoom** par `loadSurface → fetchAndBuildDem` (`main.js:3182`).

⚠️ **ET ELLE FLOUTE L'APPLICATION ENTIÈRE À 16 px PENDANT QU'ELLE EST LÀ — À L'ARRÊT** (`style.css:185-186`). **C'est le contraire exact de la décision 13**, qui n'accepte le flou que **pendant** le mouvement.

⚠️ **`hideLoading` PORTE QUATRE EFFETS DE BORD, ET AUCUN N'EST PROTÉGÉ PAR UN TEST — `main.js` n'est chargé par aucun.** Avant d'y toucher, sachez ce qui part avec lui : **(1)** il est **le seul endroit qui pose `ld-warm`** (`:937`) ; **(2)** il appelle **`globe.chargeRacines()`** (`:928`) — l'un des deux seuls chemins qui demandent les seize tuiles racines, **et la Tâche 1b dissout l'autre** ; **(3)** il applique le plancher `LOADING_MIN_MS = 2000` au premier affichage ; **(4)** il est réarmé **2,6 s plus tard** par le `catch` de `loadRealTerrain` (`:3408-3411`). **Traitez les quatre, un par un, et dites-le dans cette case.**

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

⚠️ **IL N'EN RESTE QUE TROIS DEPUIS LE 2026-08-20 : `:468` (`_rescale`) EST PARTI AVEC LA TÂCHE 2 bis**, comme ce plan le prescrivait. Les trois survivants sont `enterOrbit`, `_dive` et `_loadDive`, et **`test/escalier-surface.test.js` exige qu'ils soient encore là** — c'est cette tâche-ci qui les emportera, et c'est elle qui devra donc corriger cette assertion-là. **On élargit une liste, on ne la remplace pas : les repères ci-dessus restent, celui de `_rescale` porte sa date de mort.**

⚠️ **UNE PREMIÈRE VERSION DE CETTE TÂCHE DÉSIGNAIT TROIS LIGNES DE COMMENTAIRE** — `main.js:927`, `:3423`, `:3447`, trouvées en cherchant le mot « voile ». **Le rideau est fabriqué par `Modes` lui-même** : `_buildDom` crée le `div.whiteout` (`modes.js:271-273`) **sans passer par le constructeur**, donc aucun `grep` de `main.js` ne pouvait le voir. `_whiteout` = **480 ms opaque + 480 ms de retour**.

⚠️ **C'EST LA DERNIÈRE TÂCHE DU BLOC.** Le fondu masque le changement de repère de la Tâche 1 et la téléportation de la Tâche 2 bis. **Tant qu'elles ne sont pas faites, l'ôter rend le saut visible au lieu de le supprimer.**

- [ ] **Étape 1 — le test qui échoue** : **assertion de texte source** — aucun appel à `_whiteout` ne subsiste sur le chemin du zoom continu.
- [ ] **Étape 2** — le lancer sur le code d'aujourd'hui, vérifier qu'il échoue. ⚠️ **SI LES TROIS APPELANTS ONT DÉJÀ DISPARU** — les Tâches 1b, 1c et 2 bis passent avant et peuvent les emporter — **le test ne peut plus échouer. C'est une bonne nouvelle, pas un test cassé** : écrivez-le, gardez le test comme garde-fou contre le retour du rideau, et passez à l'Étape 4.
- [ ] **Étape 3 — trancher les TROIS appelants restants** : `:312`, `:408`, `:628`. ⚠️ **`:468` appartient à la Tâche 2 bis** — ce plan l'a réclamé deux fois. ⚠️ **`:408` est celui de `_dive`** : il ne peut partir qu'après les Tâches 1b et 1c. ⚠️ **Et l'un d'eux devient peut-être « l'indicateur discret » de la descente bornée — c'est la PREMIÈRE QUESTION DU §9, sans réponse.** Si elle manque, **posez une transition neutre et signalez-le**.
- [ ] **Étape 4 — mutation** : remettre un appel doit tuer le test.
- [ ] **Étape 5 — LA CLÔTURE DU §0**, les quatre commandes dans l'ordre, puis commit.


### Tâche 4 : rendre `MAX_Z` ATTEIGNABLE — et non le descendre ✅ FAITE LE 2026-08-20 (étapes 0 à 6 et 10) — ⚠️ **ÉTAPES 7, 8 ET 9 REPORTÉES, VOIR LA TÂCHE 4 SEXIES**

**Fichiers :** modifier `src/globe.js` (`_traverse`, seuil d'horizon, crédit) · **modifier `src/main.js`** (le seul fichier qui lit `FLAGS` sur ce chemin) · modifier `src/flags.js` (poser `globeContinu`) · modifier `test/globe-eviction.test.js` (déverrouiller `:204` et `:208`, **et lui donner une caméra**) — ⚠️ **aucune des trois corrections ne touche `MAX_Z` ni `CACHE_MAX`**, contrairement à ce qu'annonçait ce plan.

⚠️ **LA PRÉMISSE DE CETTE TÂCHE ÉTAIT FAUSSE.** Ce plan écrivait « le quadtree s'arrête à z11 ». Il n'y arrive **jamais** : mesuré, il plafonne à **z7**, et `MAX_Z = 11` est du code mort. Monter une constante qui n'est pas atteinte ne produit rien.

⚠️ **ET IL NE SUFFIT PAS DE LE RENDRE ATTEIGNABLE : LA TÂCHE 4 QUATER, JUSTE APRÈS, LÈVE LE VRAI VERROU** — le plancher de `dist` à `:780`, qui arrête le raffinement à z11 **quelle que soit l'altitude et quelle que soit la valeur de `MAX_Z`**. **Cette tâche-ci ne suffit pas seule ; ne vous arrêtez pas à sa clôture.**

⚠️ **Et le `z11` de la règle R3 coïncide avec la constante sans que ce plan dise lequel des deux il mesure** : le débit borne-t-il vraiment à z11, ou bute-t-on simplement sur `MAX_Z` ? **À trancher au banc avant d'écrire la Tâche 4 ter.** **Une tâche doit porter `MAX_Z` au-delà de 11 — ou le plan doit assumer, par écrit, un socle plus grossier que la production actuelle.**

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

- [x] **Étape 0 — POSER LE DRAPEAU `globeContinu`, ET LE BRANCHER.** ⚠️ **`src/globe.js` n'importe PAS `flags.js` — vérifié, zéro occurrence.** Les seuls lecteurs de `FLAGS` sont `main.js`, `fenetre-reglage.js` et `ui/effects-panel.js`. Un drapeau posé dans `flags.js` sans câbler sa lecture **ne protège rien** : les corrections atterrissent sur le globe de production. **Le lecteur est `src/main.js`**, qui construit le globe : il passe l'option au constructeur, et `globe.js` ne connaît qu'un booléen, pas `FLAGS`. Suivre le patron de `FLAGS.fenetreContinue`, déjà en place.
- [x] **Étape 1 — établir la base, et l'écrire. ⚠️ EN FIXANT L'ÉTAT DU CACHE À L'ENTRÉE, SANS QUOI LE CHIFFRE N'EST PAS REPRODUCTIBLE.** Le zoom atteint est une grandeur **à hystérésis** : même code, globe **neuf** à chaque station → **z9** ; globe **promené** sur les stations à la suite → z7 puis **z6, sans jamais remonter**. La cause est dans le fichier — une bouffée de crédit initiale, puis `tiles.size = CACHE_MAX`. ⚠️ **z6, z7 et z9 sont donc TROIS MESURES JUSTES de trois protocoles différents. N'en interdisez aucune : dites laquelle vous mesurez.**

  Six altitudes **nommées** : **1 600 km · 800 km · 200 km · 60 km · 8 km · 2 km**, à **quatre latitudes** (0°, 30°, 45°, 60° N). Relever zoom effectif, tuiles dessinées, taille de cache et **requêtes par image caméra immobile**, **sur 20 images consécutives, en exigeant la stabilité**. ⚠️ **Et NE COMPTEZ PAS DEPUIS L'IMAGE 0 : un globe neuf met quatre images à se stabiliser.** Jetez les cinq premières, puis relevez les vingt suivantes. Sans cette précaution, « 20 images stables » est impossible à obtenir et l'Étape 1 ne se termine jamais.
- [x] **Étape 1 bis — DONNER UNE CAMÉRA AU HARNAIS. ⚠️ SANS ELLE, LES ÉTAPES 2 ET 4 SONT IMPOSSIBLES.** Le seul harnais qui fait voler le globe porte `{ position: new THREE.Vector3() }` (`test/globe-eviction.test.js:145` et `:225`) : **aucune orientation, aucune `projectionMatrix`** — zéro `PerspectiveCamera` dans tous les `test/globe-*.test.js`. Sans elle, l'Étape 4 n'a pas de frustum à tester et l'Étape 2 pas d'écran. Prescrivez `new THREE.PerspectiveCamera(30, 16/9, near, 1400)` avec **`near = clamp(orbAlt × 0,2, 0,01, 0,5)`** — ⚠️ **le `clamp` fait partie de la formule** (`modes.js:704`) ; sans lui, le plan proche part à zéro en orbite haute. Les trois valeurs sont dans le dépôt : `main.js:263`, `modes.js:704`, `modes.js:319`.
- [x] **Étape 2 — DÉVERROUILLER LES TESTS, avant toute correction.** `globe-eviction.test.js:204` (`zoomFinal >= 6`) et `:208` (`visiblesFinal > 200`) décrivent le défaut comme un contrat, et la seconde **fait échouer le bon correctif**.

  ⚠️ **ET L'ASSERTION DE REMPLACEMENT DOIT SORTIR ROUGE AUJOURD'HUI.** Une version de ce plan proposait « toute tuile a un ancêtre `ready` » : **vrai par construction** (racines jamais évincées, règle sans-trou). Une autre disait « le zoom effectif suit l'altitude, au moins trois niveaux distincts » — ⚠️ **ambiguë, et l'une des deux lectures est VERTE aujourd'hui** : les niveaux **dessinés** sur une descente sont {2,3,4,5,6}, soit cinq, et `zoomsDessines` est déjà rempli par `globe-eviction.test.js:159`.

  **La lecture qui mord, et c'est celle-là qu'il faut écrire : `zmax`, relevé sur 20 images stables, prend au moins TROIS valeurs différentes entre les six altitudes nommées de l'Étape 1.** Aujourd'hui il n'en prend qu'une. ⚠️ **Vérifiez le rouge avant d'aller plus loin ; le §0 l'exige.** Et déverrouillez aussi `globe-eviction.test.js:202`.
- [x] **Étape 3 — l'horizon géométrique**, avec sa marge de corde et l'exemption des racines `z2`. `globe.js:770` : `dot < −0.35` est 110,5° en dur, au lieu de `R/|camPos|` — **2,87° à 8 km**, soit une calotte jusqu'à **×1 076 trop large**. ⚠️ **Seul, il ne débloque AUCUN niveau de zoom** — mesuré z7 → z7. Il réduit la calotte parcourue, ce qui rend l'étape 4 possible ; il ne se juge pas sur le zoom. Test : à basse altitude, le nombre de tuiles parcourues chute d'un ordre de grandeur **sans qu'aucune tuile visible ne disparaisse**. ⚠️ La seconde moitié est celle qui attrape l'écrêtage au limbe.
- [x] **Étape 4 — le test de frustum** dans `_traverse` (zéro occurrence aujourd'hui). ⚠️ **ET IL A UN PARAMÈTRE CACHÉ QUI VAUT TROIS NIVEAUX DE ZOOM : LA MARGE DU VOLUME ENGLOBANT.** À l'exagération 18 (`globe.js:278`), le relief sort de la sphère de **2,5 unités, soit 159 km**. Mesuré, 20 images stables : marge **0** → z11, cache 156, crédit 264 ; marge **2,5** (la correcte) → **z10, cache 420, crédit 0**. ⚠️ **Autrement dit, avec la bonne marge, le frustum seul NE SUFFIT PAS — et « 2 à 4 % des tuiles dans le champ » ne se reproduit pas : 55 % mesurés à 8 km.** Prenez la marge juste, mesurez, et n'espérez pas le chiffre facile.
- [x] **Étape 5 — le crédit. ⚠️ À OUVRIR PAR DÉFAUT, après l'Étape 4.** Ce plan a écrit « les deux premières corrections ont suffi » : **faux aux deux altitudes où le socle vit**, une fois donnée au frustum la marge de volume englobant qu'il lui faut. Le crédit reste donc à traiter — mais **après** la réduction d'emprise, jamais avant.

  ⚠️ **CE QUE CETTE ÉTAPE NE DOIT PAS FAIRE : ajouter un plancher constant.** Mesuré, tout plancher ≥ 16 installe un cycle limite de période 4 où la planète retombe à ses 16 racines une image sur quatre. **Le critère d'acceptation porte sur la stabilité image par image** — `zmax` et tuiles dessinées constants sur **20 images**, requêtes au repos à zéro — **jamais sur un relevé à une seule image.**


  Le détail du défaut, pour mémoire : `globe.js:759`, `_credit = CACHE_MAX − tiles.size + marge`. En régime établi `marge = 0` et **54 à 91 raffinements sont refusés par image**. ⚠️ **Mais `marge` n'est PAS « vide par construction » — ce plan l'a écrit deux fois, et c'est faux** : à la discontinuité (téléport), elle vaut 280, 196, 24, puis 0 en quatre images, et finance 280 requêtes. **Le filet anti-gel du commentaire `743-752` tient ; il ne mord qu'aux discontinuités.**
- [x] **Étape 6 — rendre évinçables les tuiles bloquées.** Une tuile en `error` ou en `loading` dont la requête ne revient jamais **occupe une place du budget définitivement**. C'est le même point fixe, par une autre porte. ⚠️ **Sans retourner l'ordre d'éviction** : `globe.js` classe par **récence au rang 1, profondeur au rang 2 seulement**, délibérément, avec vingt lignes de commentaire et un test dédié vert. **C'est correct.** ⚠️ **ET N'ÉVINCEZ PAS UNE `loading` SANS ANNULER SA REQUÊTE** : le `.then` de `_pump` (`globe.js:532`) ajouterait un maillage orphelin. Garde : `if (!this.tiles.has(t.key)) return` — **et EXIGEZ-LE DANS LE TEST** (une révision de ce plan avait supprimé cette exigence en retirant un doublon). ⚠️ **Deux pièges de plus, mesurés :** une tuile remise à `empty` est **redemandée à l'image suivante** (`globe.js:799`), et **annuler une requête déclenche le réessai automatique** du `.catch` de `_pump`. **Le test doit vérifier qu'une tuile évincée ne revient pas d'elle-même.**
- [x] **Étape 7 — trancher le cache** ✅ **APPLIQUÉE LE 2026-08-21 PAR LA TÂCHE 4 SEXIES — `CACHE_MAX` vaut 600**, avec les chiffres de l'Étape 1 et non par principe. ⚠️ Si les corrections réclament 824, une formule qui rend 370 est une régression déguisée en optimisation. **Mesurez avant de choisir.**
- [x] **Étape 8 — la mémoire retenue pour rien ✅ FAITE LE 2026-08-21 (Tâche 4 sexies) — ⚠️ 105 Mo rendus à coup sûr, PAS 210 : voir le bilan là-bas** : : ~210 Mo sur 327 Mo au cache plein.** `globe.js:238` — le canevas reste vivant via `CanvasTexture.image` après téléversement (**105 Mo**). Et `t.heights` (**105 Mo**) n'est relu que par `setExaggeration` (`:899`), **qui n'a aucun appelant dans tout le dépôt — vérifié**. ⚠️ Le commentaire de `:168` annonce « 380 Mo pour 1 500 tuiles » : la documentation **sous-estime d'un facteur 2,4**.
- [x] **Étape 9 — les normales de bord.** ✅ **FAITE LE 2026-08-21 (Tâche 4 sexies) — 48,3 % → 96,6 % de la pente du centre** ⚠️ **l'écrêtage est à `globe.js:257-260`** (`Math.min(..., 254)` / `255`), et non à `:623-648` qui n'en est que le consommateur : `sampleHeights` écrête alors que `tileToLatLon` donne la position complète — pente **407 m au bord contre 853 m au centre**, soit **47,7 % de la vraie pente** — ⚠️ **et ce chiffre n'est pas seulement mesuré, il se DÉRIVE du dépôt** (`gridFor` = 24, plus l'écrêtage) : il vaut donc comme source, pas comme relevé, d'où un liseré d'éclairage autour de chaque tuile.
- [x] **Étape 10 — LA CLÔTURE DU §0**, les quatre commandes dans l'ordre, puis commit.

#### ✅ CE QUI A ÉTÉ FAIT, ET CE QUE ÇA MESURE (2026-08-20)

**Le drapeau et son câblage.** `FLAGS.globeContinu` (`src/flags.js`, `false`), échappatoire d'adresse `?globe=continu` / `?globe=crans` via `globeContinuActif()`, sur le patron de `suiviHelicoActif`. **Le seul lecteur est `src/main.js`** — `new Globe({ ...params, globeContinu: globeContinuActif() })` — et `globe.js` ne connaît qu'un booléen, `this.continu`. ⚠️ **Drapeau BAISSÉ, donc la production est inchangée :** les trois tris vivent dans des branches `if (this.continu)`, et la suite entière (3 111 verts) le vérifie sur l'ancien chemin.

**MON PROTOCOLE DE BASE — « GLOBE NEUF À CHAQUE STATION » (protocole A).** ⚠️ **Il est dit ici parce que le zoom atteint est à hystérésis et que le chiffre n'a aucun sens sans lui.** Un `new Globe` par station, `_tileMemo` vidée, aucune histoire de cache héritée d'une station voisine ; caméra `PerspectiveCamera(30, 16/9, clamp(orbAlt × 0,2 ; 0,01 ; 0,5), 1400)` posée sur la station et regardant le centre de la planète ; à chaque image `update()` puis attente que la file se vide ; **les douze premières images jetées, les vingt suivantes relevées, stabilité exigée.**

⚠️ **ET « JETEZ LES CINQ PREMIÈRES » NE SUFFIT PLUS — ce chiffre datait du globe GELÉ.** La règle sans-trou ne descend que d'**un niveau par image** (une tuile ne se refend qu'une fois ses quatre enfants prêts) : le globe corrigé met donc une image par niveau. Mesuré image par image : convergence à l'image **8** à 200 km, à l'image **9** à 8 km, puis plus un seul changement pendant vingt images. Douze, c'est ce chiffre plus trois de marge.

**LA BASE, AVANT TOUTE CORRECTION** — six altitudes × quatre latitudes (0°, 30°, 45°, 60° N), longitude 6,25° :

| altitude | zmax (lat 0 / 30 / 45 / 60) | dessinées | cache | crédit | req/img au repos |
|---|---|---|---|---|---|
| 1 600 km | z6 / z6 / z6 / z6 | 303-306 | 420 | 0 | 0,0 |
| 800 km | z6 / z6 / z6 / **z5** | 303-307 | 420 | 0 | 0,0 |
| 200 km | z6 / z6 / z6 / **z5** | 303-306 | 420 | 0 | 0,0 |
| 60 km | z6 / z6 / z6 / **z5** | 303-306 | 420 | 0 | 0,0 |
| 8 km | z6 / z6 / z6 / **z5** | 303-306 | 420 | 0 | 0,0 |
| 2 km | z6 / z6 / z6 / **z5** | 303-306 | 420 | 0 | 0,0 |

**À latitude fixée, `zmax` prend UNE seule valeur sur un facteur 800 d'altitude.** C'est le symptôme, reproduit à l'identique.

**APRÈS LES ÉTAPES 3 À 6**, même protocole, latitude 45° :

| altitude | zmax | dessinées | parcourues | refus/img | cache | crédit | req/img au repos | stable sur 20 images |
|---|---|---|---|---|---|---|---|---|
| 1 600 km | **z7** | 57 | 216 | 0 | 216 | 204 | 0,0 | oui |
| 800 km | **z8** | 76 | 252 | 0 | 252 | 168 | 0,0 | oui |
| 200 km | **z10** | 117 | 312 | 0 | 312 | 108 | 0,0 | oui |
| 60 km | **z11** | 168 | 420 | 27 | 420 | 0 | 0,0 | oui |
| 8 km | **z11** | 172 | 420 | 28 | 420 | 0 | 0,0 | oui |
| 2 km | **z11** | 163 | 420 | 28 | 420 | 0 | 0,0 | oui |

**`zmax` prend QUATRE valeurs distinctes (z7, z8, z10, z11), et `MAX_Z = 11` cesse d'être du code mort : il est ATTEINT.** Les tuiles dessinées tombent de ~304 à 57-172, la stabilité est exacte (zmax et dessinées constants à la tuile près sur les vingt images), et **la caméra immobile ne demande plus rien.**

**LE PANORAMIQUE LATÉRAL À BASSE ALTITUDE** — 90° en 60 images à 4 km, le geste que le vol de référence ne voit pas :

| | zoom stabilisé | requêtes / img | **raffinements refusés / img** |
|---|---|---|---|
| avant | z6, 304 dessinées | 3,5 | **66,3, indéfiniment** |
| après | z11, 167 dessinées | 81,5 | **0,5** |

⚠️ **CE 66,3 EST LA CAUSE 1 DU PLAN, REPRODUITE** (« 54 à 91 raffinements refusés par image, indéfiniment »). **Et il montre que l'Étape 5 n'avait rien à écrire :** le crédit n'est pas le plafond, il en est le marqueur. Une fois l'emprise réduite, `CACHE_MAX − tiles.size + marge` redevient positif tout seul (204, 168, 108 aux trois altitudes hautes) et les refus tombent d'eux-mêmes. ⚠️ **AUCUN PLANCHER DE CRÉDIT N'A ÉTÉ AJOUTÉ, et c'est le résultat de l'étape, pas son abandon** — le critère demandé par le plan (stabilité sur 20 images, requêtes au repos à zéro) est vert sans lui, et tout plancher l'aurait cassé.

⚠️ **ET LE FILET ANTI-GEL EST INTACT :** le test « cache saturé puis la planète TOURNE » passe, sur l'ancien chemin comme sur le nouveau.

**CE QUE L'HORIZON SEUL FAIT, SUR MON PROTOCOLE** — il déplace z6 → z7 en haut et z6 → z8 en bas, **mais avec une instabilité résiduelle** (plage z7-z8, 1,8 à 2,0 requête par image au repos à 8 km) : **il ne s'achève qu'avec le frustum.** ⚠️ **Le plan écrivait « z7 → z7, il ne débloque AUCUN niveau » : c'est vrai de SON protocole, faux du mien, et les deux mesures sont justes.** Ce qui ne dépend d'aucun protocole : **seul, il ne donne pas un état stable.**

**LES DEUX FORMULES, ET LEURS MARGES.**

- **Horizon** : `cos limite = R² / ((R + marge_relief) × D)`, plus le demi-angle `theta` de la tuile au centre de la planète — la **marge de corde**, sans laquelle la formule écrête au limbe. Racines `z2` **exemptées**.
- **Volume englobant** : la nappe déplacée occupe la coquille `[R − 0,9 ; R + 2,545]` unités à l'exagération 18 (9 000 m × R_GLOBE/EARTH_RADIUS_M × 18 = **2,545 unités, soit 162 km**, et `skirtDrop` plafonne à 0,9). La sphère est donc centrée **dans** la coquille — `R + (marge − 0,9)/2` — et son rayon vaut `rayon_tuile × ce facteur + (marge + 0,9)/2`, ce qui divise l'épaisseur portée par deux (3,4 → 1,72) sans jamais sortir du volume réel.
- ⚠️ **`t.rayon` n'est PAS la demi-corde diagonale** : c'est la distance maximale du centre aux **quatre coins**, et c'est exact — vérifié numériquement, `max(surface) / max(coins) = 1,00000` sur z2→z11 avec 21×21 échantillons par tuile. La demi-corde sous-estime dès que le carreau n'est pas plat.

⚠️ **LES DEUX MARGES SURVIVENT AU VOL DE RÉFÉRENCE — MESURÉ.** Mises à zéro, **les treize assertions du vol restent vertes** : le bouchon de test vaut 812 m partout (aucun sommet à faire dépasser) et aux six altitudes nommées la planète remplit l'écran (le limbe n'y est jamais). Elles sont donc testées **en géométrie pure**, où leur mutation tue le test sur-le-champ — `test/globe-eviction.test.js`, deux tests dédiés, mutation vérifiée dans les deux sens.

**LES TUILES BLOQUÉES (Étape 6).** Rang 0 d'éviction : `error`, et `loading` de plus de `IMAGES_BLOQUEE = 600` images (10 s à 60 Hz). ⚠️ **L'ordre des deux rangs existants n'est pas touché.** Trois gardes, toutes exigées par le plan et toutes testées :

1. **le maillage orphelin** — `_pump` compare l'OBJET (`this.tiles.get(t.key) !== t`), pas la clé, et jette la texture ;
2. **la quarantaine** — une clé qui a épuisé son réessai renaît directement `error`, jamais `empty`, donc elle ne repart pas sur le réseau à l'image suivante ;
3. ⚠️ **et la quarantaine EXPIRE au bout de `IMAGES_QUARANTAINE = 600` images.** Une quarantaine perpétuelle **casse un contrat écrit ailleurs dans le dépôt** — `test/globe-reseau.test.js` : « la mémoire ne garde aucun souvenir de l'échec qui l'en empêcherait ». Une coupure de trois secondes ne doit pas coûter la session. **La première version était perpétuelle et a fait rougir ce test ; c'est lui qui a tranché.**

**LE BANC ET LES TESTS.** `test/globe-eviction.test.js` passe de 6 à 16 tests (3 098 → **3 111** dans la suite), sans nouveau fichier — donc `audit:tests` reste à zéro écart (181 listés, 181 sur disque). Le harnais a désormais une **vraie caméra** (Étape 1 bis) et les trois assertions qui verrouillaient le défaut (`:202`, `:204`, `:208`) sont devenues des **planchers larges** (`z4`, `zoomFinal > 3`, `visiblesFinal > 12`) avec, en commentaire, la raison de leur desserrage. **L'assertion qui mord a été vérifiée ROUGE avant correction** : « zmax ne prend que **1** valeur sur les six altitudes nommées ».

⚠️ **UNE LIMITE DU BANC, ET ELLE SE DÉRIVE DU DÉPÔT.** Le test « sans trou » (cinq rayons d'écran contre les tuiles allumées) ne tourne qu'aux **quatre altitudes hautes** : la dalle bouchon vaut 812 m partout et l'exagération vaut 18, donc la nappe dessinée est un plateau à **14 616 m**, et une caméra à 8 km ou 2 km est **dessous**. ⚠️ **C'est une propriété du globe de PRODUCTION, pas du bouchon** — c'est exactement ce que la décision 14 (« l'exagération devient une courbe continue de l'altitude ») a pour objet de corriger.


**Ce qui est établi, et qui ne dépend d'aucun banc :** l'altitude ne change rien au zoom atteint, et **le budget de cache est le point fixe** — la couverture d'un hémisphère sature `CACHE_MAX` à elle seule. **Réduire l'emprise est donc le seul levier qui attaque la cause.** ⚠️ **Le gain chiffré des étapes 3+4 reste à établir par l'Étape 1**, avec le protocole que vous aurez écrit.

⚠️ **CETTE TÂCHE PASSE AVANT TOUTES LES AUTRES DU BLOC.** Rebrancher la source (4 alpha) d'un quadtree qui n'atteint pas ses niveaux fins ne se verrait pas ; et calibrer un plafond de file (4 bis) avant elle, c'est le calibrer sur un trafic qui va tripler. **L'ordre est 4 → 4 quater → 4 alpha → 3 → 4 bis → 4 ter.**


### Tâche 4 sexies : LE BUDGET DU CACHE ET LA MÉMOIRE QUI LE PAIE ✅ FAITE LE 2026-08-21 — ⚠️ **ELLE EST PASSÉE AVANT LA 4 QUATER, ARBITRAGE CONFIRMÉ**

**Fichiers :** modifier `src/globe.js` (`CACHE_MAX`, la rétention du canevas, `t.heights`, `setExaggeration`, l'écrêtage de `sampleHeights`) · modifier `test/globe-eviction.test.js`

⚠️ **CE SONT LES ÉTAPES 7, 8 ET 9 DE LA TÂCHE 4, SORTIES DE LEUR TÂCHE ET NON ABANDONNÉES.** La raison est mesurée, pas de confort : **l'Étape 7 est une hausse de mémoire, et c'est l'Étape 8 qui la paie.** Les faire dans le même commit que le tri spatial aurait mélangé un changement vérifiable sous node (le parcours) avec un changement qui ne se vérifie qu'au GPU (la rétention de texture, le réenvoi après perte de contexte). L'Étape 9 (les normales de bord) est orthogonale aux deux.

#### ⚠️ L'ÉTAPE 7 EST DÉJÀ MESURÉE — LA CONTRADICTION « 824 CONTRE 370 » EST TRANCHÉE, ET AUCUN DES DEUX N'AVAIT RAISON

Balayage de `CACHE_MAX` sur le globe **corrigé** (protocole A de la Tâche 4, latitude 45°, 25 images puis 20 relevées) :

| `CACHE_MAX` | 200 km | 60 km | 8 km | 2 km |
|---|---|---|---|---|
| **420** (aujourd'hui) | z10, 117 dess., cache 312 | z11, 168 dess., **28 refus/img** | z11, 172 dess., **28 refus/img** | z11, 163 dess., **28 refus/img** |
| **600** | z10, 117, cache 312 | z11, **249**, 0 refus | z11, **250**, cache **532**, 0 refus | z11, **235**, 0 refus |
| **824** | identique à 600 | identique à 600 | identique à 600 | identique à 600 |
| **1 200** | identique à 600 | identique à 600 | identique à 600 | identique à 600 |

**L'ensemble de travail du globe corrigé SATURE À 532 TUILES.** Donc : **370 serait une régression** (le plan avait raison de s'en méfier), **824 n'achète rien** (le plan avait tort de le craindre), et **600 est la valeur juste, avec 13 % de marge.** ⚠️ **Et le gain n'est pas un niveau de zoom — c'est la COMPLÉTUDE du niveau atteint** : à 420, 28 sous-arbres par image restent grossiers faute de budget, et 172 tuiles couvrent l'écran là où il en faudrait 250.

#### Les étapes

- [x] **Étape 1 — l'Étape 8 D'ABORD : la mémoire retenue pour rien, ~210 Mo sur 327 Mo au cache plein.** `globe.js` — le canevas reste vivant via `CanvasTexture.image` après téléversement (**105 Mo**) ; et `t.heights` (**105 Mo**) n'est relu que par `setExaggeration`, **qui n'a aucun appelant dans tout le dépôt**. ⚠️ Le commentaire de `TILE_MEMO_MAX` annonce « 380 Mo pour 1 500 tuiles » : la documentation **sous-estime d'un facteur 2,4**. ⚠️ **ET CETTE ÉTAPE NE SE VÉRIFIE PAS SOUS NODE** : libérer `CanvasTexture.image` change ce que three réenvoie après une perte de contexte WebGL. **Preuve à l'écran exigée, pas seulement `npm test`.**
- [x] **Étape 2 — porter `CACHE_MAX` à 600**, et rejouer le balayage ci-dessus sur votre banc. ⚠️ **Si l'Étape 1 n'a pas été faite, ne faites pas celle-ci** : +27 % de tuiles sur un budget de 327 Mo, c'est +88 Mo sur un tas déjà mesuré à 1,7-1,9 Go.
- [x] **Étape 3 — l'Étape 9 : les normales de bord.** ⚠️ **L'écrêtage est dans `sampleHeights`** (`Math.min(..., 254)` / `255`), et non dans `_buildMesh` qui n'en est que le consommateur : `sampleHeights` écrête alors que `tileToLatLon` donne la position complète — pente **407 m au bord contre 853 m au centre**, soit **47,7 % de la vraie pente**. ⚠️ **Ce chiffre se DÉRIVE du dépôt** (`gridFor` = 24, plus l'écrêtage) : il vaut comme source, pas comme relevé. D'où un liseré d'éclairage autour de chaque tuile.
- [x] **Étape 4 — LA CLÔTURE DU §0**, les quatre commandes dans l'ordre, puis commit.


#### ✅ CE QUI A ÉTÉ FAIT, ET CE QUE ÇA MESURE (2026-08-21)

**L'ARBITRAGE D'ORDRE EST CONFIRMÉ, ET CETTE TÂCHE EST PASSÉE AVANT LA 4 QUATER.** L'ordre du bloc devient **4 → 4 sexies → 4 quater → 4 alpha → 3 → 4 bis → 4 ter**.

**LE BANC.** Protocole A de la Tâche 4, à l'identique — globe **neuf** par station, `_tileMemo` vidée, `PerspectiveCamera(30, 16/9, clamp(orbAlt × 0,2 ; 0,01 ; 0,5), 1400)` regardant le centre, `update()` puis attente que la file se vide, **douze images jetées, vingt relevées, stabilité exigée**, latitude 45°, longitude 6,25°. ⚠️ **Ce banc a d'abord été validé contre la table de la Tâche 4 : il la reproduit à la tuile près** (z7/57/216, z8/76/252, z10/117/312, puis z11 avec 27-28 refus). C'est ce qui autorise à croire ce qu'il dit ensuite.

**LE BALAYAGE, REJOUÉ — il confirme la table du plan, chiffre pour chiffre :**

| `CACHE_MAX` | 200 km | 60 km | 8 km | 2 km |
|---|---|---|---|---|
| **370** | z10, 117 dess., cache 312 | z11, 129, **40 refus/img** | z11, 137, **41 refus/img** | z11, 136, **41 refus/img** |
| **420** (avant) | z10, 117, cache 312 | z11, 168, **27 refus** | z11, 172, **28 refus** | z11, 163, **28 refus** |
| **600** (posé) | z10, 117, cache 312 | z11, **249**, cache 528, 0 refus | z11, **250**, cache **532**, 0 refus | z11, **235**, cache 532, 0 refus |
| **824** | identique à 600 | identique à 600 | identique à 600 | identique à 600 |
| **1 200** | identique à 600 | identique à 600 | identique à 600 | identique à 600 |

**Toutes les stations stables sur les vingt images, 0,0 requête par image au repos.** ⚠️ **Et 370 n'est pas seulement « moins bien » : il est PIRE que l'existant** — 41 refus par image contre 28, et 137 tuiles à l'écran contre 172. La méfiance du plan envers la formule `5 × visibles` était fondée, et elle se chiffre.

**LA MÉMOIRE — L'ÉTAPE 1 A ÉTÉ FAITE AVANT L'ÉTAPE 2, comme le plan l'exige.**

| | tuiles en cache | `t.heights` retenues | canevas retenus | tas JS + tampons |
|---|---|---|---|---|
| **avant** (`3c9e736`) | 420 | **105,0 Mo** | **420** | **142,0 Mo** |
| **après** | **532** | **0** | **0** | **41,8 Mo** |

⚠️ **`heapUsed` SEUL RÉPOND « AUCUN CHANGEMENT » À CETTE MESURE, ET C'EST UN PIÈGE DU §3 DE LA COMPÉTENCE.** V8 range les tampons de `Float32Array` **hors du tas**, dans `arrayBuffers` : la première version de la sonde a rendu « 12,3 Mo → 12,3 Mo » sur une économie de 105 Mo. La ligne ci-dessus est `heapUsed + arrayBuffers`.

**−100,2 Mo mesurés, avec 27 % de tuiles EN PLUS dans le cache.**

**CE QUI A ÉTÉ PROUVÉ AU NAVIGATEUR** (serveur de développement, `?globe=continu` et sans le drapeau, lecture du tampon de dessin par `readPixels` après `composer.render()`) :

- ✅ **les hauteurs ne sont plus retenues, sur les DEUX chemins** : `420 tuiles → 285 hauteurs retenues` sur `3c9e736`, **0 sur 600** après. Mesuré dans le navigateur, pas déduit.
- ✅ **la perte de contexte WebGL est survécue**, drapeau levé **et** drapeau baissé : `WEBGL_lose_context.loseContext()` puis `restoreContext()`, les deux évènements observés, puis le globe **se repeuple** (511 tuiles prêtes, 373 dessinées, z8, **0 % de pixels noirs, 52 teintes distinctes**) et **zéro avertissement** « Texture marked for update but no image data found ».
- ✅ **le contrôle NÉGATIF, qui rend la contrepartie non négociable** : une `CanvasTexture` téléversée puis privée de son image et remarquée `needsUpdate` fait sortir de three, mot pour mot, `THREE.WebGLRenderer: Texture marked for update but no image data found.` **Sans `rechargeApresContexte()`, le globe reviendrait donc vide d'une réinitialisation de pilote — et aucun test ne rougirait.**

**CE QUE LE NAVIGATEUR A CONTREDIT — ET C'EST LE CHIFFRE DU PLAN QUI ÉTAIT TROP BEAU.** Le plan annonçait **105 Mo de canevas** rendus. **On n'en rend qu'une part, parce que three ne téléverse une texture qu'au premier DESSIN qui l'utilise** et qu'il élimine au frustum juste après. Relevé :

| | tuiles en cache | textures prêtes | canevas rendus | appels de dessin |
|---|---|---|---|---|
| `?globe=continu`, stabilisé à 300 km | 420 | 420 | **132 (31 %, ~33 Mo)** | 41 |
| production (sans drapeau), 400 km | 420 | 420 | **36 (9 %, ~9 Mo)** | **12 pour 307 tuiles marquées visibles** |

⚠️ **N'EN FAITES PAS UN DÉFAUT À CORRIGER.** Forcer le téléversement (`renderer.initTexture`) rendrait bien les 105 Mo — **en les déplaçant dans la mémoire VIDÉO, pour des tuiles que personne ne regarde**. Tel quel, une tuile paie **soit** la RAM (pas encore montrée), **soit** la VRAM (montrée), **jamais les deux**. **Le total honnête de l'Étape 1 est donc : 105 Mo rendus à coup sûr (les hauteurs) + 9 à 33 Mo selon le regard (les canevas), et non 210.**

**LES NORMALES DE BORD (Étape 3) — LA DÉRIVATION A ÉTÉ REJOUÉE AVANT LA CORRECTION, et elle tombe juste.** `G = gridFor(z) = 24`, tuile de 256 px, `x(u) = clamp(u × 256 − 0,5 ; 0 ; 255)` : la fenêtre de hauteur vaut **21,333 px au centre contre 10,167 px au bord**, soit **47,7 %** — donc 407 m lus sur 853 m. **Les deux chiffres du plan sont exacts.**

Le correctif ne touche pas `sampleHeights` : il **borne la fenêtre à la tuile pour la position AUSSI**, de sorte que les deux grandeurs parcourent enfin le même terrain (différence centrée au centre, unilatérale au bord). ⚠️ **On n'extrapole pas au-delà du bord** — la donnée du voisin n'est pas là, et l'inventer ferait un relief qui n'existe nulle part. Mesuré sur un MNT à pente **constante** (40 m/pixel, z8) :

| | pente au bord ouest | pente au centre | bord / centre |
|---|---|---|---|
| avant | 1,5208 | 3,1477 | **48,3 %** |
| après | 3,0396 | 3,1477 | **96,6 %** |

**LES TESTS.** `test/globe-eviction.test.js` passe de 16 à **21 tests** (3 111 → **3 116** dans la suite), sans nouveau fichier — `audit:tests` reste donc à zéro écart. La constante miroir `CACHE_MAX` du harnais suit le module (420 → 600), **en place**. ⚠️ **LES QUATRE CORRECTIFS ONT ÉTÉ VÉRIFIÉS PAR MUTATION, et chacun tue son test et lui seul** : retenir à nouveau les hauteurs, retenir à nouveau le canevas, oublier `chargeRacines()` dans le rechargement, remettre l'écrêtage de la fenêtre. **Un test qui survit à la mutation décore ; aucun de ces quatre ne survit.**

⚠️ **LE PIÈGE QUE `_rechargeTuiles` A FAILLI POSER, et il ne rougissait nulle part :** `_traverse` ne demande que des **enfants**. Des racines z2 remises à `empty` sans `chargeRacines()` ne repartent sur le réseau **pour personne** — pas d'erreur, pas de test rouge, simplement un globe qui ne se remplit plus jamais. C'est le même piège que le « troisième appelant » de la Tâche 1b, à un autre endroit.

**CE QUI N'A PAS PU ÊTRE PROUVÉ, ET IL FAUT LE DIRE.** Le volet navigateur **ne composite pas** : `requestAnimationFrame` n'y est pas cadencé et **aucune capture d'écran n'a pu être prise** (c'est exactement le piège du §3 de `/threejs-optimisation`). Tout ce qui est écrit ci-dessus vient donc de `readPixels` sur le tampon de dessin après un `composer.render()` explicite — **ce qui prouve ce qui est DESSINÉ, pas ce qu'un œil humain voit**. ⚠️ **Le liseré d'éclairage de l'Étape 3 n'a donc PAS été constaté à l'œil, ni avant ni après : il est dérivé, mesuré sur les normales, et corrigé — mais personne ne l'a encore regardé.** Et les 404 et `ERR_CONNECTION_TIMED_OUT` de la console **sont antérieurs** : vérifié en rejouant la même séquence sur `3c9e736`.

⚠️ **ORDRE CONFIRMÉ LE 2026-08-21, ET APPLIQUÉ :** cette tâche est passée **avant la 4 quater**, parce que la 4 quater porte `MAX_Z` à 15 et annonce elle-même **448 Mo à z15** — c'est-à-dire au-dessus du budget d'aujourd'hui avant même de toucher à `CACHE_MAX`. L'ordre du plan est donc **4 → 4 sexies → 4 quater → 4 alpha → 3 → 4 bis → 4 ter**. ⚠️ **ET LA 4 QUATER HÉRITE D'UN BUDGET QUI A CHANGÉ SOUS ELLE :** elle chiffre 448 Mo à z15 sur une tuile qui coûtait ~793 Kio ; la tuile en coûte maintenant ~281 Kio hors canevas non téléversé, et le cache vaut 600 et non 420. **Ses deux lignes de mémoire sont à re-mesurer, pas à recopier.**


### Tâche 4 quater : LEVER LE PLANCHER DE `dist`, PUIS PORTER `MAX_Z` À 15 ✅ **FAITE LE 2026-08-21** — ⚠️ **SES DEUX LIGNES DE MÉMOIRE ÉTAIENT FAUSSES, VOIR LE BILAN**

**Fichiers :** modifier `src/globe.js` (`:780` le plancher de `dist`, puis `MAX_Z`) · tester `test/globe-profondeur.test.js` (créer)

⚠️ **UNE PREMIÈRE VERSION DE CETTE TÂCHE ATTAQUAIT UNE CONSTANTE QUI N'EST PAS LE VERROU — ET LA TÂCHE 4 LA RÉFUTAIT D'AVANCE : « monter une constante qui n'est pas atteinte ne produit rien ».** Preuve mesurée : **`MAX_Z = 16` avec `CACHE_MAX = 8 000` — dix-neuf fois le budget — rend toujours z11.**

**Le vrai plafond est le plancher de `dist`, à `globe.js:780` :**

```
const dist = Math.max(camPos.distanceTo(t.center) - t.chord * 0.5, 1)
```

`R_GLOBE = 100` (`geo.js:11`) pour 6 371 000 m : **une unité de scène vaut 63 710 m, donc ce `1` vaut 63,7 km.** Sous cette altitude, `dist` est constant, **le ratio `chord/dist` cesse de dépendre de l'altitude**, et le raffinement s'arrête — **z11 à froid, z12 avec hystérésis, à TOUTE altitude.** `MAX_Z = 11` n'est pas une politique : **c'est exactement la valeur que le critère atteint déjà.**

⚠️ **ET LE COÛT N'EST CELUI D'AUCUNE DES DEUX VERSIONS QUE CE PLAN A ÉCRITES.** La première disait « chaque niveau **quadruple** les feuilles » ; la seconde, qui la corrigeait, disait « chaque niveau n'ajoute **qu'un anneau** » de 22 tuiles, et chiffrait **120 → 208 tuiles, 261 → 448 Mo**. **LES DEUX SONT FAUSSES**, et la seconde d'un facteur 8.

**Ce qui est vrai, et il se lit dans le relevé par niveau :** le critère `chord / dist` fixe bien la taille **angulaire** d'une feuille, donc chaque niveau pose un **anneau d'écran complet** — et un anneau d'écran, à fov 30° en 16/9, ce n'est pas 22 tuiles, **c'est ~185**. Relevé à 2 km, protocole A : `z10:15 z11:152 z12:195 z13:184 z14:182 z15:232`. Le coût est donc **LINÉAIRE EN NOMBRE DE NIVEAUX**, à ~185 tuiles dessinées par niveau.

**Mesuré sur ce dépôt, tuiles 256 px (la 4 alpha n'est pas passée), protocole A, lat 45° :**

| | tuiles dessinées | ensemble de travail | tas JS + tampons |
|---|---|---|---|
| z11 à 8 km (avant) | 250 | 532 | 32,1 Mo |
| **z14 à 8 km** (après) | **748** | **1 196** | **59,8 Mo** |
| **z15 à 2 km** (après) | **964** | **1 504** | **72,6 Mo** |

⚠️ **`CACHE_MAX = 420` NE TIENT PAS, ET 600 NON PLUS.** À 600, le globe s'arrête à z12 avec **58 raffinements refusés par image** à 8 km : le plancher levé rendrait les niveaux fins ATTEIGNABLES sans les rendre ATTEINTS. **Le budget du chemin continu passe donc à 1 700** (saturation mesurée à 1 504, plus 13 % de marge — la règle même de la Tâche 4 sexies), **et il n'est PAS partagé avec la production** : voir le bilan.

**Et la destination se dérive en une ligne**, à 45° de latitude en tuiles 512 px : z12 = 13,51 m · z13 = 6,76 m · z14 = 3,38 m · **z15 = 1,69 m** — **exactement le besoin du socle à ses quatre niveaux.** ⚠️ **La destination est `MAX_Z = 15`. Ce plan disait « pas de chiffre, délibérément » alors qu'il était gratuit.**

- [x] **Étape 1 — le test qui échoue** : **à 8 km d'altitude**, le zoom effectif atteint **au moins z13**. ⚠️ **Altitude de travail explicite, parce que « une altitude de socle » est produite par la Tâche 3, qui passe APRÈS** — elle pourra la déplacer. Le test échoue aujourd'hui **et après la Tâche 4**.
- [x] **Étape 2** — le lancer, vérifier qu'il échoue, **et vérifier aussi qu'il échoue encore avec `MAX_Z = 16`** : c'est ce qui prouve que la constante n'est pas le verrou.
- [x] **Étape 3 — LEVER LE PLANCHER DE `dist`.** Le `1` de `:780` doit descendre à ce que l'échelle justifie, ou disparaître au profit d'une borne exprimée en mètres. ⚠️ **C'est ce geste, et lui seul, qui débloque les niveaux fins.**
- [x] **Étape 4 — porter `MAX_Z` à 15**, et relever la table ci-dessus sur votre banc — **20 images stables, après en avoir jeté DIX-SEPT.** ⚠️ **CINQ ÉTAIT FAUX, ET DOUZE L'EST DEVENU** : la règle sans-trou ne descend que d'un niveau par image, et cette tâche en ajoute quatre. Mesuré image par image, la convergence tombe à l'image **12 à 8 km** et **13 à 2 km**. ⚠️ **Un banc trop court n'est pas lent, il MENT** : il rend « zmax oscille 14/15 » et « 232 requêtes caméra immobile », c'est-à-dire la signature exacte du défaut cherché. ⚠️ **Si vos chiffres s'écartent de ceux du tableau, ce sont les vôtres qui font foi : écrivez-les ici.**
- [x] **Étape 5 — la borne AWS.** AWS s'arrête à **z15** (`dem-source.js:51`) : au-delà les tuiles reviennent en `error`, **et une tuile `error` est inévinçable tant que la Tâche 4 Étape 6 n'est pas faite.** z15 est donc la destination **et** la limite tant que la 4 alpha n'a pas rebranché Mapterhorn.
- [x] **Étape 6 — mutation** : remettre le plancher de `dist` à 1 doit tuer le test. ⚠️ **Remettre `MAX_Z` à 11 doit AUSSI le tuer** — les deux gestes sont nécessaires, le test doit le prouver.
- [x] **Étape 7 — LA CLÔTURE DU §0**, les quatre commandes dans l'ordre, puis commit.

#### ✅ CE QUI A ÉTÉ FAIT, ET CE QUE ÇA MESURE (2026-08-21)

**LE TEST ROUGE, ET LA PREUVE QUE LA CONSTANTE N'EST PAS LE VERROU.** `test/globe-profondeur.test.js` (créé, 5 tests, ajouté à la ligne `test` de `package.json` — 182 listés, 182 sur disque, `audit:tests` sans écart). L'assertion qui mord : **à 8 km, `zmax` ≥ z13**, protocole A, 20 images stables.

| état du dépôt | `zmax` à 8 km |
|---|---|
| avant (le `1` d'origine) | **z11**, 250 dessinées, cache 532 |
| `MAX_Z = 16` seul | **z11**, 250 dessinées, cache 532 |
| `MAX_Z = 16` **et** `CACHE_MAX = 8 000` (13× le budget) | **z11**, 250 dessinées, **cache 532** |

⚠️ **LA MESURE DU PLAN SE REPRODUIT À LA TUILE PRÈS.** Le cache sature à 532 quel que soit le budget : le point fixe n'était ni la constante ni le budget, **c'était le critère lui-même**, gelé sous 63,7 km.

**LE GESTE.** `PLANCHER_DIST_M = 1` mètre, converti par `R_GLOBE / EARTH_RADIUS_M`, à la place du `1` en unités de scène. Le plancher ne sert plus qu'à empêcher la division par zéro quand la caméra touche la nappe (`dist` devient négatif dès qu'elle entre dans la demi-corde d'une grosse tuile). Puis `MAX_Z = 11 → 15`, **exporté** pour que le test le confronte au plafond déclaré de `dem-source.js` au lieu d'un littéral recopié.

⚠️ **ET LES DEUX GESTES SONT NÉCESSAIRES, LE BANC LE PROUVE :** plancher levé avec `MAX_Z = 11` rend **exactement** la table d'avant (z10/117/312, z11/249/528, z11/250/532, z11/235/532) — pas une tuile de différence. C'est la mutation de l'Étape 6, dans un sens ; dans l'autre, remettre le plancher à 1 avec `MAX_Z = 15` rend z11. **Chacun des deux, seul, ne produit rien.**

**LA TABLE, SUR MON BANC** — protocole A de la Tâche 4 : globe **neuf** par station, `_tileMemo` vidée, `PerspectiveCamera(30, 16/9, clamp(orbAlt × 0,2 ; 0,01 ; 0,5), 1400)` regardant le centre, `update()` puis attente que la file se vide, **dix-sept images jetées, vingt relevées, stabilité exigée**, latitude 45°, longitude 6,25°, `CACHE_MAX_CONTINU = 1 700`. ⚠️ **Ce banc a d'abord été validé contre la table de la Tâche 4 sexies : il la reproduit chiffre pour chiffre** avant toute modification — c'est ce qui autorise à croire ce qu'il dit ensuite.

| altitude | zmax | dessinées | parcourues | refus/img | cache | req/img au repos | stable | tas + tampons |
|---|---|---|---|---|---|---|---|---|
| 1 600 km | **z7** | 57 | 216 | 0 | 216 | 0,0 | oui | 19,9 Mo |
| 800 km | **z8** | 76 | 252 | 0 | 252 | 0,0 | oui | 20,0 Mo |
| 200 km | **z10** | 117 | 312 | 0 | 312 | 0,0 | oui | 22,8 Mo |
| 60 km | **z12** | 255 | 536 | 0 | 536 | 0,0 | oui | 32,3 Mo |
| 8 km | **z14** | 748 | 1 196 | 0 | 1 196 | 0,0 | oui | 59,8 Mo |
| 2 km | **z15** | 964 | 1 504 | 0 | 1 504 | 0,0 | oui | 72,6 Mo |

**`zmax` prend SIX valeurs distinctes sur les six altitudes nommées — une par station.** La Tâche 4 en avait quatre ; avant elle, une seule. **C'est ça, « pas des crans ».**

⚠️ **ET z15 N'EST PAS ATTEINT À 8 km, CE N'EST PAS UN MANQUE DE BUDGET — C'EST LE CRITÈRE QUI A RAISON.** À 8 km il ne refuse **aucun** raffinement (0 refus, cache non saturé à 1 196 sur 1 700) : une tuile z14 mesure 1 729 m à 45°, et le critère `chord > 0,319 × distance` demande 2 555 m pour se refendre. **Le zoom suit l'altitude, il ne court pas après une constante.**

**LE BUDGET — RE-MESURÉ, ET IL A DOUBLÉ.** Balayage de `CACHE_MAX` sur le globe corrigé, même protocole :

| `CACHE_MAX` | 60 km | 8 km | 2 km |
|---|---|---|---|
| **600** (celui de la 4 sexies) | z12, 255 dess. | z12, 301, **58 refus/img** | z12, 286, **59 refus** |
| **900** | z12, 255 | z13, 526, **49 refus** | z13, 511, **55 refus** |
| **1 200** | z12, 255 | z14, 748, 0 refus | z14, 736, **73 refus** |
| **1 700** (posé) | z12, 255 | z14, 748, 0 refus | **z15, 964, 0 refus** |
| **2 400** | identique à 1 700 | identique à 1 700 | identique à 1 700 |

**L'ensemble de travail SATURE À 1 504 TUILES**, contre 532 à z11 : **2,8 fois plus.** 2 400 n'achète rien, 1 700 laisse 13 % de marge. ⚠️ **À 600, lever le plancher n'aurait acheté qu'UN niveau** (z11 → z12) et laissé 58 sous-arbres grossiers par image : **la tâche aurait été livrée verte et à moitié faite.**

⚠️ **CE BUDGET N'EST PAS PARTAGÉ AVEC LA PRODUCTION, ET C'EST MESURÉ, PAS PRUDENTIEL.** Posé pour tout le monde, `CACHE_MAX = 1 700` fait gonfler l'ancien chemin — qui parcourt encore une calotte de deux tiers de planète — **de 600 à 1 700 tuiles, de 439 à 1 264 dessinées, et de 72 à 153 Mo** (station 8 km, mêmes sondes). Il lui offrirait au passage un zoom que personne n'a demandé (z6 → z11) pour une facture que personne n'a arbitrée. Le budget devient donc `this.cacheMax`, posé au constructeur : **600 sans le drapeau, 1 700 avec.** Le plancher de `dist` est gardé de la même façon — la production garde son `1`.

**LA PRODUCTION EST INCHANGÉE, VÉRIFIÉE ET NON ESPÉRÉE.** Même banc, drapeau baissé, avant et après le commit : **z6, 439 dessinées, 600 en cache, 71-75 refus/img, 0,0 requête au repos** — identique à la tuile près aux quatre altitudes basses.

**CE QUI A ÉTÉ VU AU NAVIGATEUR** (`http://localhost:5503/?globe=continu` **et** sans le paramètre, vraie donnée AWS, vrai réseau) :

- ✅ **les deux pages chargent et tournent**, zéro erreur JS, zéro avertissement `THREE.*`. Le drapeau se lit : `globe.continu === true` et `globe.cacheMax === 1700` avec `?globe=continu`, `false` / `600` sans.
- ✅ **le banc de node se retrouve dans le vrai navigateur** : caméra posée à 8 km sur la même station, sur vraie donnée AWS, le globe se stabilise à **z14, 589 dessinées, 1 192 en cache, 0 refus** (contre z14 / 748 / 1 196 sous node — l'écart de tuiles dessinées vient du rapport d'écran réel et du relief réel, qui n'est pas le plateau du bouchon). Tas JS : **373 → 410 Mo** pour 748 tuiles de plus, soit **~50 Kio par tuile**, exactement ce que node mesure.

⚠️ **CE QUE LE NAVIGATEUR A MONTRÉ ET QUE LE BANC NE PEUT PAS VOIR — ET C'EST LA VRAIE LIMITE DE CETTE TÂCHE.** Le banc a un réseau **instantané** ; le vrai n'en a pas. Caméra en orbite, en mouvement, à 15 km : relevé **568 tuiles en `loading` simultanément** et le cache collé à 1 700. Quatre niveaux de plus, c'est quatre fois plus de tuiles à faire venir pendant que la caméra bouge, et `MAX_CONCURRENT = 6` ne fait pas de miracle. **Aucune tuile en `error`, `_echoue` vide** — ce n'est pas une panne, c'est une file. ⚠️ **C'est exactement l'objet de la Tâche 4 bis (« le flux qui ne se coince pas ») et de la règle R3, et le plan a raison de les placer APRÈS celle-ci : elles se calibrent maintenant sur le bon trafic.** **Ne promettez donc pas encore la fluidité : ce commit rend le globe FIN, il ne le rend pas encore FLUIDE.**

**LA BORNE AWS (Étape 5).** `MAX_Z = 15` est la limite du jeu AWS (`dem-source.js`, `aws.maxZoom`), et le test la **lit** au lieu de la recopier : il échouera le jour où la Tâche 4 alpha rebranchera Mapterhorn (z17) sans relever la borne avec elle. Un second test vérifie la borne **à l'exécution** — à 2 km, la station la plus profonde, **aucune tuile z16 ne part sur le réseau, et z15 est bien demandé**. La quarantaine des tuiles en échec (`IMAGES_QUARANTAINE = 600`) n'est pas touchée : les 21 tests de la Tâche 4 et de la 4 sexies restent verts.

**LA MUTATION (Étape 6), DANS LES DEUX SENS.** Remettre `PLANCHER_DIST_M` à 63 710 (soit le `1` d'origine) tue le test — z11. Remettre `MAX_Z` à 11 le tue aussi — z11. **Aucun des deux gestes ne suffit seul, et le test le prouve dans les deux sens.**

**LES TESTS.** `test/globe-profondeur.test.js` créé (5 tests) ; `test/globe-eviction.test.js` inchangé sauf `JETEES` (12 → 17), **corrigé en place avec sa raison**. Suite : **3 116 → 3 121 verts**, `audit:tests` sans écart, `node --check` sur les trois fichiers, `nettoie:dist` + `build:mapcells` + `vite build` + `verifie:dist` — `dist` complet, déploiement autorisé.

⚠️ **CE QUI N'A PAS PU ÊTRE VÉRIFIÉ, ET IL FAUT LE DIRE.** Le volet navigateur **ne composite toujours pas** : aucune capture d'écran n'a pu être prise, et `renderer.info.render.calls` rend `1` (le dernier passage plein écran du compositeur), donc **le nombre réel d'appels de dessin à z14/z15 n'a pas été mesuré**. Tout ce qui est écrit ci-dessus vient de l'état du quadtree et de `performance.memory`, pas d'un œil. **Et la VRAM n'a pas été mesurée du tout** : à 256 Kio par texture de tuile sans mipmap, 964 tuiles dessinées plafonnent à ~241 Mo de textures contre ~60 Mo aujourd'hui — **c'est une projection arithmétique, pas un relevé.** ⚠️ **Le drapeau est baissé en production, donc rien de tout cela n'est encore livré à personne — mais il faudra un vrai relevé GPU avant de le lever.**



### Tâche 4 alpha : rebrancher le globe sur la vraie source de relief ✅ **FAITE LE 2026-08-21** — ⚠️ **REBRANCHÉE À PARTIR DE z12 SEULEMENT, ET LE GLOBE ORBITAL N'A PAS BOUGÉ**

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

- [x] **Étape 1** ✅ — `test/globe-source.test.js` : l'URL vient de `DEM_SOURCES[DEFAULT_SOURCE_ID]`, et `MAX_Z` est confronté au `maxZoom` des DEUX sources. ⚠️ **Et une assertion de plus, que le plan ne demandait pas** : `src/globe.js` ne doit contenir AUCUN gabarit d'URL littéral **dans son code** (les commentaires ont le droit de nommer AWS). Elle remplace celle de `test/globe-profondeur.test.js` qui cherchait `elevation-tiles-prod/terrarium` dans le TEXTE du fichier — après le rebranchement le motif ne survivait plus que dans un commentaire, et **l'assertion serait restée verte sur la foi d'une phrase**.
- [x] **Étape 1 bis** ✅ — deux zones z8 **voisines et opposées** dans le même banc : la couverte est servie par Mapterhorn, celle qui rend 404 bascule sur AWS **pour elle seule**, `activeDemSource()` ne bouge pas, et **les deux sources servent dans la même session** (assertion sur les octets réellement demandés). ⚠️ **Trois cas de 404 et non un** : 404 de SONDE (zone entière non couverte), 404 sur UNE tuile d'une zone couverte — le bord d'un jeu national, que la sonde ne peut pas voir puisqu'elle échantillonne le centre — et **5xx, qui lui replie toute la session**.
- [x] **Étape 2** ✅ — vérifié : les mutations de l'Étape 8 rejouent le défaut d'origine, et il tue les tests.
- [x] **Étape 3 ✅ TRANCHÉE LE 2026-08-21 : ON REBRANCHE À PARTIR DE z12, ET SEULEMENT LÀ. `SEUIL_SOURCE_FINE = DEM_SOURCES.mapterhorn.baseZoom` (`src/globe.js`).**

  ⚠️ **SA CONDITION D'ENTRÉE ÉTAIT REMPLIE, ET ELLE NE L'ÉTAIT PAS QUAND LA CASE A ÉTÉ ÉCRITE.** La Tâche 4 quater a porté `MAX_Z` à 15 et levé le plancher de `dist` : le globe atteint **z15 mesuré** sur le chemin continu. La bande z12–z15 existe, et c'est exactement celle que Mapterhorn sert. La question pouvait donc enfin se trancher.

  **Les trois faits qui la tranchent, chacun rejoué contre le dépôt :**

  1. **`dem-source.js` donne `baseZoom: 12` à Mapterhorn** — son plancher de couverture. Sous z12 la sonde n'a rien à répondre, et l'en-tête du module ajoute que Mapterhorn rend **404 au-dessus de z4 en pleine mer**. La majorité des tuiles d'un globe étant océaniques, rebrancher la bande z5–z11 remplacerait une donnée qu'AWS sert correctement à ces échelles par des trous sur les deux tiers de la planète.
  2. **Le chemin de PRODUCTION plafonne à z11** (`plancher = 1` dans `_traverse`, mesuré par la 4 quater : `MAX_Z = 16` et treize fois le budget rendent toujours z11). La bande z2–z11 **EST** le globe de production. En n'y touchant pas, **l'Étape 7 est tenue par construction et non par un banc** — et c'est ce que le test « LE GLOBE ORBITAL EST INCHANGÉ » vérifie : zéro sonde, zéro URL non-AWS, zmax sous le seuil.
  3. **Le coût de la sonde, mesuré ici et pas estimé.** Le plan annonçait « de l'ordre de 2 520 requêtes HEAD pour une vue orbitale ». Bornée à z12+, la sonde a coûté **24 HEAD** — quatre zones z8 × six zooms candidats — sur une descente complète à 8 km comme à 2 km (`.banc/memoire-4alpha.mjs`). Et la mémoire est **partagée avec le damier** (`src/dem.js`) : une zone déjà sondée par la carte ne coûte rien au globe.

  ⚠️ **ET C'EST CE QUI LÈVE LA CONTRADICTION QUE CE PLAN SIGNALAIT ENTRE SES ÉTAPES 3 ET 4** (« l'une demande de rebrancher, l'autre que rien ne change pour le globe orbital »). Elles ne s'opposaient que tant que « rebrancher » voulait dire « partout ».

  ⚠️ **CE QUE `coast-mask.js` PEUT ET NE PEUT PAS**, puisque cette case l'invoquait : il répond bien terre/mer, mais **ce n'est pas une fonction synchrone et gratuite**. `fetchCoastMask` est asynchrone, exige un `dem`, three.js et le DOM, et va chercher `data/coast-z6/{x}/{y}.json` sur le réseau. La question ne se pose plus une fois la bande bornée à z12+ — mais **l'argument tel qu'il était écrit ne tenait pas**, et il ne faut pas le réutiliser ailleurs sans le vérifier.

- [ ] **Étape 3 — TRANCHER LA QUESTION OUVERTE, et ⚠️ LE FAIT QUI LA TRANCHE EST DÉJÀ DANS LE DÉPÔT — MAIS CE PLAN EN A TIRÉ LA CONCLUSION INVERSE.** `dem-source.js:39` donne `baseZoom: 12` à Mapterhorn : **son plancher de couverture est z12, et le globe plafonne à z11. Les deux intervalles ne se touchent même pas.** Une version de ce plan concluait « rebrancher seulement sous z12 » — **cela désigne une bande que le globe n'atteint jamais.** ⚠️ **La conclusion juste est plus dure : TANT QUE `MAX_Z` RESTE À 11, CETTE TÂCHE NE PEUT RIEN APPORTER AU GLOBE, et la sonde par zone coûterait six requêtes HEAD par zone z8 hors `MAX_CONCURRENT` — de l'ordre de 2 520 pour une vue orbitale — pour renseigner un intervalle que personne ne demande.** `coast-mask.js` répond gratuitement à la seule question utile à ces zooms : terre ou mer.

  **Donc : ou bien cette tâche attend qu'une tâche porte `MAX_Z` au-delà de 11, ou bien elle est reportée. Écrivez la décision dans cette case, et ne la commencez pas avant.**
- [x] **Étape 4 ✅ LA JONCTION — ET C'ÉTAIT BIEN LE VRAI TRAVAIL. Réponse retenue : NI attendre, NI supposer, NI corriger après — on DÉCIDE AVEC LA MÉMOIRE SYNCHRONE ET ON LAISSE LA TUILE `empty`.**

  `_request` appelle `planTuile(z, x, y)`, qui lit `peekRegionMaxZoom` — **synchrone**. Trois issues, plus une quatrième que le damier n'a pas à connaître :
  - un zoom → on y va, en surzoomant au-delà (`overzoomTile`) ;
  - `null` → zone hors couverture → **AWS pour cette tuile**, choix de session intact ;
  - panne → repli AWS pour toute la session ;
  - **`planTuile` rend `null`** → la zone n'est **pas encore sondée**. `_request` lance la sonde à côté (`_sonder`, dédoublonnée par un `Set` de clés de zone) et **rend la main sans rien enfiler**. La tuile reste `empty` — l'état d'où `_request` sait repartir — et `_traverse` la redemandera à l'image suivante.

  ⚠️ **CE N'EST PAS UN MÉCANISME NEUF : c'est mot pour mot la contre-pression de `PLAFOND_FILE`** (Tâche 4 bis), et l'écran ne change pas — **l'ancêtre continue de dessiner**, c'est la règle sans-trou du quadtree. Un test le prouve en gelant les sondes : la tuile reste `empty`, la file reste vide, **zéro octet ne part**, et `_drawn` ne tombe pas à zéro. Les deux mauvaises réponses ont chacune leur mutation, et les deux tuent des tests.

  ⚠️ **ET LE BANC A FAILLI IMITER LE DÉFAUT.** Les helpers `calme()` des tests attendaient « ni en vol, ni en file » — or une tuile qui attend sa sonde n'est ni l'un ni l'autre. La boucle ne rendait donc la main qu'aux MICRO-tâches, les `setTimeout` des sondes n'obtenaient jamais leur tour, et **le globe mesuré restait figé à z11 au milieu de son premier sondage**. Les trois `calme()` du dépôt (`globe-profondeur`, `globe-eviction`, `globe-source`) et celui du harnais testent désormais aussi `globe._sondes.size`.

- [x] **Étape 5 ✅ LES TAILLES — ET LE GLOBE ACCEPTE LES DEUX, IL NE RÉÉCHANTILLONNE PAS.** Le choix était à trancher explicitement : il l'est, et **c'est la politique elle-même qui le force** — une zone hors couverture retombe sur AWS 256 px pendant que sa voisine reste sur Mapterhorn 512 px, dans la même session. Il n'y avait donc pas de taille unique à choisir. `t.size` sort de `fetchTile` et traverse tout : `sampleHeights(heights, u, v, size = 256)`, l'uniforme `uTilePx` (par tuile, pas partagé), et `remplirHauteurs` (`src/monde/flux-terrain.js`).

  **Les littéraux CHANGÉS, la liste exacte** (les repères du plan étaient périmés de quatre tâches ; ceux-ci sont ceux du fichier livré) :
  - `fetchTile` : `c.width = c.height = px` · `getImageData(0, 0, px, px)` · `new Float32Array(px * px)` — trois expressions, plus le `drawImage` de sous-fenêtre qu'exige le surzoom ;
  - `sampleHeights` : `u * size` et `v * size` (2) · les deux **bornes d'index** `255` → `size - 1` · les deux `254` → `size - 2` · `i = y0 * size + x0` · **`heights[i + 256]` → `heights[i + size]`** et **`heights[i + 257]` → `heights[i + size + 1]`** ;
  - le nuanceur : `fwidth(vUv) * 256.0` → `* uTilePx`, avec la déclaration d'uniforme qui va avec ;
  - `TILE_MEMO_MAX = 128` (entrées) → `TILE_MEMO_OCTETS_MAX = 128 * 256 * 256 * 4` (**octets**), et `src/gardien.js` a suivi.

  **Les littéraux ÉPARGNÉS, et pourquoi :**
  - **les deux radix terrarium** — `rgba[i*4] * 256 + … / 256 - 32768` en JS, `t.r * 256.0 + t.g + t.b / 256.0` en GLSL. Mapterhorn utilise **le même encodage** ; les confondre avec une taille de tuile casse toutes les altitudes en silence ;
  - **le `* 255.0` du nuanceur**, qui est une **plage d'octet** et n'a rien à voir avec les `255` d'index de `sampleHeights` ;
  - `PLAFOND_FILE = 256`, qui est une profondeur de FILE ;
  - les `512` de `rebuildRamp` (`c.width = 512`, `fillRect(0, 0, 512, 1)`), qui sont le dégradé hypsométrique.

  ⚠️ **`bathy.js`/`overzoomTile` N'A PAS EU BESOIN D'ÊTRE MODIFIÉ** — le plan l'annonçait « à modifier ». Vérifié : sa signature `(z, x, y, maxZoom)` et sa sortie `{z, x, y, scale, ox, oy}` conviennent telles quelles, et `globe.js` l'importe (module pur, aucun cycle).

- [x] **Étape 6 ✅ LA MÉMOIRE, MESURÉE — ET LES DEUX CHIFFRES DU PLAN ÉTAIENT PÉRIMÉS.** `.banc/memoire-4alpha.mjs`, A/B dans le même binaire (« avant » = source épinglée AWS, ce qui reproduit exactement l'ancien comportement), globe continu, lat 45, **17 images jetées puis 20 relevées, stabilité exigée** :

  | source | alt | zmax | dessinées | cache | **tas JS** | `_tileMemo` | textures des tuiles visibles | GET | HEAD |
  |---|---|---|---|---|---|---|---|---|---|
  | aws | 200 km | z10 | 117 | 312 | 2,2 Mo | 128 / **32,0 Mo** | 29,3 Mo | 312 | 0 |
  | mapterhorn | 200 km | z10 | 117 | 312 | 2,5 Mo | 128 / **32,0 Mo** | 29,3 Mo | 312 | **0** |
  | aws | 8 km | z14 | 748 | 1 196 | 8,8 Mo | 128 / **32,0 Mo** | 187,0 Mo | 1 196 | 0 |
  | mapterhorn | 8 km | z14 | 748 | 1 196 | **8,7 Mo** | 32 / **32,0 Mo** | 607,8 Mo | 1 196 | **24** |
  | aws | 2 km | z15 | 964 | 1 504 | 10,9 Mo | 128 / **32,0 Mo** | 241,0 Mo | 1 504 | 0 |
  | mapterhorn | 2 km | z15 | 964 | 1 504 | **10,8 Mo** | 32 / **32,0 Mo** | 835,8 Mo | 1 504 | **24** |

  ⚠️ **« 242 → 968 Mo » ET « ×4 PAR TUILE » SONT MORTS, ET LA TÂCHE 4 SEXIES LES A TUÉS.** Les deux supposaient que le cache de 1 700 tuiles retient des pixels. Il n'en retient plus : le canevas est relâché au téléversement et `t.heights` à la construction du maillage. **Le tas JS ne bouge pas — 10,8 contre 10,9 Mo à 2 km, cache plein à 1 504 tuiles.**

  ⚠️ **ET LE `_tileMemo` EST INVARIANT PAR CONSTRUCTION : 32 Mo dans les six lignes.** C'est ce que le budget en OCTETS achète — 128 entrées de 256 px, ou 32 de 512 px, **jamais 128 Mo**. Un test le verrouille, et la mutation « revenir à 128 entrées » le tue.

  ⚠️ **CE QUI QUADRUPLE VRAIMENT, C'EST LA TEXTURE — ET C'EST UN MAJORANT, PAS UNE MESURE DE VRAM.** 241 → 836 Mo à 2 km, mais ce total compte les tuiles **marquées `visible`**, et `globe.js` documente que three ne téléverse qu'au premier DESSIN et élimine au frustum : relevé au navigateur dans ce même fichier, **132 canevas téléversés sur 420 (31 %)** à 300 km. **Le vrai chiffre n'a pas été mesuré au navigateur — voir « ce qui n'a pas été vérifié » ci-dessous, et la tâche de suite qui en découle.**

- [x] **Étape 7 ✅ LE GLOBE ORBITAL EST INCHANGÉ, ET C'EST VÉRIFIÉ DEUX FOIS.** Par construction (z2–z11 est sous `SEUIL_SOURCE_FINE`, `planTuile` rend AWS sans une seule requête), par test (`LE GLOBE ORBITAL EST INCHANGÉ` : zéro HEAD, que des URL AWS, zmax sous le seuil), et par le banc — la ligne « 200 km » est **identique au chiffre près** entre les deux sources.

- [x] **Étape 8 ✅ LES MUTATIONS — HUIT, TOUTES TUÉES** (`.banc/mutation-4alpha.py`) : l'URL en dur · `i + size + 1` redevenu `i + 257` · `i + size` redevenu `i + 256` · les bornes d'index redevenues `255`/`254` · la jonction qui suppose AWS · le 404 redevenu une panne · le budget du `_tileMemo` redevenu 128 entrées · la disparition de `SEUIL_SOURCE_FINE`.

  ⚠️ **ET LA SIXIÈME A SURVÉCU AU PREMIER PASSAGE — DEUX FOIS, POUR DEUX RAISONS DIFFÉRENTES, ET LES DEUX ÉTAIENT DES DÉFAUTS RÉELS.** D'abord parce qu'aucun test n'exerçait le 404 **d'une tuile dans une zone couverte** (les autres n'exercent que le 404 de sonde) : test ajouté. Ensuite parce que la classification 404/panne était écrite **deux fois** — `err.status` dans `fetchTile` et la classe `DemSourceError` dans `tileBitmap` — et que la première gagnait, rendant la seconde inobservable. `fetchTile` branche désormais sur la **classe**, et `tileBitmap` est le seul endroit qui décide ce qu'est une panne. **Un mutant équivalent est une redondance qui se cache.**

- [x] **Étape 9 ✅ LA CLÔTURE DU §0** — `npm test` **3 186 verts**, `audit:tests` 186/186 sans écart, `node --check` sur les six fichiers modifiés, `nettoie:dist` + `build:mapcells` + `vite build` + `verifie:dist`. Page chargée avec ET sans `?globe=continu`.

⚠️ **UNE VERSION DE CE PLAN PROPOSAIT ICI « plafonner `MAX_Z` à 13 » COMME ALTERNATIVE HONNÊTE : LA MESURE L'A RENDUE SANS OBJET.** La Tâche 4 quater établit que le verrou n'est pas `MAX_Z` mais le plancher de `dist`. ⚠️ **EN REVANCHE « z15 TIENT DANS LE BUDGET ACTUEL AVEC DEUX FOIS LA MARGE » EST FAUX, ET C'EST MESURÉ :** l'ensemble de travail passe de 532 à **1 504** tuiles, et il a fallu porter le budget du chemin continu de 600 à **1 700**. **L'arbitrage n'a pas disparu, il a été tranché — et il coûte 40 Mo de tas et le TRIPLE de tuiles à l'écran.** Ce qui reste vrai en revanche, et la Tâche 4 alpha l'a mesuré à son tour : **le budget qui compte n'est plus le tas mais la TEXTURE**, et c'est la tâche de suite ci-dessous.

#### ⚠️ CE QUE LA TÂCHE 4 ALPHA N'A PAS PU VÉRIFIER, ET CE QU'ELLE A DÉCOUPÉ

**Non vérifié :** le globe n'a **jamais chargé une seule tuile dans un navigateur** pendant cette tâche. Le bucket AWS (`s3.amazonaws.com/elevation-tiles-prod`) est **injoignable depuis cette machine** — `ERR_CONNECTION_TIMED_OUT` puis blocage CORS — et le voile `#loading` reste levé **avec comme sans la modification** (vérifié en remisant le travail : comportement identique avant/après, donc pré-existant à l'environnement). Ce qui **a** été vérifié au navigateur, en important `src/globe.js` directement dans la page servie par vite :
- le graphe de modules charge sans exception (l'import de `dem-source.js` et `bathy.js` n'ouvre aucun cycle) ;
- `planTuile(8, 132, 92)` rend **AWS, scale 1** — le globe orbital ;
- `planTuile(12, 2119, 1473)` rend **`null`** avant la sonde, puis **Mapterhorn z12** après ;
- la **vraie** sonde sur la région du Mont-Blanc rend **17** : Mapterhorn y sert bien jusqu'à z17 ;
- une **vraie** tuile `tiles.mapterhorn.com/12/2119/1473.webp` fait bien **512×512**, se décode entre **1 899 et 3 978 m**, et `sampleHeights(h, 0,99 ; 0,99 ; 512)` rend **3 419 m** contre **3 251 m** avec le défaut de 256 — **168 m d'écart silencieux**, le piège du plan, démontré sur de la donnée réelle.

**Restent donc à voir de vos yeux :** un globe continu qui descend réellement à z15 sur Mapterhorn, et la mémoire VIDÉO que cela coûte.

#### Tâche 4 septies : LE CRITÈRE DE REFENTE IGNORE LA TAILLE DE TUILE ⚠️ **DÉCOUPÉE DE LA 4 ALPHA, ET MESURÉE**

**Le fait :** `_traverse` refend sur `chord / dist`, un critère **ANGULAIRE** — il fixe la taille à l'ÉCRAN d'une feuille, et ne sait rien du nombre de texels qu'elle porte. Une tuile de 512 px occupe donc la même surface d'écran qu'une tuile de 256 px **en portant quatre fois plus de texels**. Mesuré à 2 km (`.banc/memoire-4alpha.mjs`) : mêmes **964** tuiles dessinées dans les deux cas, **241 Mo** de texture en 256 px contre **836 Mo** en 512 px, pour un écran qui ne peut pas montrer la différence.

**Ce qu'il faudrait :** que le seuil de refente tienne compte de `tilePx` — en pratique, s'arrêter **un niveau plus tôt** sur une tuile de 512 px, ce qui rend la même densité de texels par pixel d'écran pour ~un quart des feuilles. `planTuile` connaît la taille de façon **synchrone** dès que la zone est sondée, donc l'information est disponible au bon endroit.

⚠️ **POURQUOI CE N'EST PAS DANS LA 4 ALPHA :** c'est un changement du critère de refente, c'est-à-dire du cœur du quadtree, et il rejouerait tous les chiffres de la 4 quater et de la 4 sexies. **Et il n'est pas urgent** : la bande z12+ n'est atteinte que sous `?globe=continu`, qui n'est **pas** le défaut (`src/flags.js`, `globeContinu: false`). **La production ne paie rien de ce majorant.**

### Tâche 3 : `seuil-socle.js` — quand le socle naît et meurt ✅ **FAITE LE 2026-08-21** — ⚠️ **`ZOOM_SOCLE = 13`, ET C'EST LA RÈGLE R3 QUI L'A TRANCHÉ**

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

⚠️ **ET IL MANQUE LE LIEN ENTRE LES DEUX RÈGLES, QUE CE PLAN N'ÉCRIT NULLE PART.** Le socle **naît sur une altitude** (règle R1, pour ne pas fabriquer d'oscillateur) mais **se remplit à un zoom** que le réseau borne (règle R3). **Rien ne relie les deux.** Si le réseau ne soutient que z9 alors que le seuil d'altitude appelle un socle z13, **le socle naît vide ou grossier**. **Écrivez ce qui se passe alors** : le socle attend, il naît quand même à la résolution disponible, ou le seuil d'altitude se décale. ⚠️ **Ce n'est pas un détail d'implémentation : c'est la jonction des deux seules règles qui gouvernent l'apparition du socle.** Question posée au §9.

**Ce qui est non négociable**

⚠️ **L'ENTRÉE EST UNE ALTITUDE DE CAMÉRA AU-DESSUS DE L'ELLIPSOÏDE, PAS UNE FRACTION D'ÉCRAN.** Règle R1. Une fraction d'écran dépend de la distance au sol, donc du terrain chargé, donc de `meanM`, qui est lissé — on fabriquerait un oscillateur.

⚠️ **Hystérésis obligatoire** : `SEUIL_MORT_M` strictement supérieur à `SEUIL_NAISSANCE_M`. Même patron que `SPLIT_RATIO` / `MERGE_RATIO` dans `globe.js`, éprouvé sur ce dépôt.

- [x] **Étape 1** — test : en descendant, le socle naît à `SEUIL_NAISSANCE_M` ; en remontant, il ne meurt qu'à `SEUIL_MORT_M`. Puis celui qui compte : **osciller cent fois autour du seuil de naissance ne produit qu'une seule bascule**. — `test/seuil-socle.test.js`, **25 tests**, DEUX oscillations (naissance **et** mort).
- [x] **Étape 2** — le lancer, vérifier qu'il échoue. — `ERR_MODULE_NOT_FOUND` sur `src/monde/seuil-socle.js`.
- [x] **Étape 3** — implémenter `socleVisible` **et** `empriseSocle`, après avoir tranché le zoom du socle et vérifié ce que `dem-emprise.js` fournit déjà.
- [x] **Étape 4** — mutation : égaliser les deux seuils tue le test d'oscillation. — **trois mutations, toutes mordantes** (tableau ⑥ ci-dessous).
- [x] **Étape 5 — LA CLÔTURE DU §0**, les quatre commandes dans l'ordre, puis commit.

#### ✅ CE QUI A ÉTÉ FAIT, ET CE QUE ÇA MESURE (2026-08-21)

**Fichiers :** `src/monde/seuil-socle.js` (créé) · `test/seuil-socle.test.js` (créé, **inscrit à la ligne `test` de `package.json`** — 183 fichiers, `audit:tests` sans écart).

**① LE ZOOM DU SOCLE : `ZOOM_SOCLE = 13`.** La question n'était tranchée nulle part, et sans elle aucun seuil n'existe — la largeur varie d'un facteur huit de z13 à z16. ⚠️ **C'est la règle R3 qui tranche, pas le goût.** R3 mesure le plafond du zoom effectif (**z11 à 12 Mb/s**, **z9 à 4 Mb/s**) et pose son propre chiffre de disqualification : **48 texels sur la largeur du socle**, « ce n'est plus le flou accepté par la décision 13, c'est une autre carte ». Rejoué (`metersPerPixel`, 45°) :

| socle | rempli à z11 (12 Mb/s) | rempli à z9 (4 Mb/s) |
|---|---|---|
| **z13** | **192 texels — du flou** ✅ | 48 texels — refusé |
| z15 | **48 texels — refusé** ❌ | 12 texels — refusé |

⚠️ **Un socle z15 tombe EXACTEMENT sur le chiffre que R3 disqualifie, et il y tombe dès 12 Mb/s** — un réseau ordinaire, pas un cas dégradé. **z13 est le zoom le plus fin dont la dégradation au plafond mesuré reste du flou.** Deux encadrements, tous deux au dépôt : `MAX_Z = 15` (`globe.js:21`) laisse **deux niveaux de marge** au rééchantillonnage ; et `DEFAULT_FINE_ZOOM = 15` (`main.js:3095`) n'est **pas** un argument contraire — le bloc d'aujourd'hui est **cuit** à son zoom, la fenêtre bornée est **rééchantillonnée** : le socle z13 est plus **large**, pas plus grossier.

**② LES DEUX SEUILS, ET LEUR DÉRIVATION.** ⚠️ **Ils ne sont pas écrits en chiffres dans le module : ils s'y RECALCULENT** depuis `blockExtentMeters(13, 45)`, le champ de vision de `main.js:263` et le rapport d'hystérésis de `globe.js:79`. Valeurs d'aujourd'hui :

> **`LARGEUR_SOCLE_M` = 10 377,4 m** (z13 à 45°, `blockExtentMeters`)
> **`SEUIL_NAISSANCE_M` = 32 274,3 m** — 60 % de la **hauteur** de l'image, **linéaire**
> **`SEUIL_MORT_M` = 40 342,8 m** — 48 % de la hauteur, soit **×1,25**

⚠️ **60 % DE LA HAUTEUR, ET LINÉAIRE — LES DEUX MOITIÉS SONT DITES.** Le champ de three.js **est vertical** (`fov: 30`, `main.js:263`) : prendre la largeur déplacerait le seuil du rapport d'aspect, **1,7 en 16/9**. Et le linéaire n'est pas le surfacique : « 60 % des pixels » vaudrait √0,6 = 0,775 en linéaire, soit **1,29 fois plus**. Pour mémoire, ce socle-ci couvre **20 % de la SURFACE** d'une image 16/9. **Le linéaire est retenu**, parce que c'est la grandeur qu'un œil juge.

⚠️ **L'HYSTÉRÉSIS N'EST PAS UN CHIFFRE NEUF :** `RAPPORT_HYSTERESIS = 0,8`, le rapport exact de `MERGE_RATIO = SPLIT_RATIO × 0,8` (`globe.js:79`), appliqué à la même grandeur — une taille angulaire relative. Un test garde la **ligne source** de `globe.js` : si elle bouge, le socle le sait.

⚠️ **LA CIRCULARITÉ EST LEVÉE AVANT LE CALCUL.** La largeur du socle est **FIXE** (celle de `ZOOM_SOCLE`) ; la décision 3 (« le socle suit le cadrage ») porte sur la **position** de l'emprise, pas sur sa largeur. Puis **on ne garde QUE l'altitude** — R1.

**Pour situer — et cela corrige aussi la réfutation elle-même :** le plan avait écrit **120 km / 180 km**. À 120 km, le vrai socle z13 occupe **16,1 %** de la hauteur ; le socle fantôme de 3,56 km n'en occupait que **5,5 %**. Les seuils d'origine étaient donc trop hauts d'un facteur **≈ 3,7** — et non « d'un facteur dix-huit », chiffre qui descendait lui aussi de la largeur fantôme.

**③ LE LIEN R1 / R3 — LA QUESTION DU §9, TRANCHÉE : LE SOCLE NAÎT QUAND MÊME, À LA RÉSOLUTION DISPONIBLE.** Les deux autres issues sont refusées, et pour des raisons vérifiables :
- **il n'attend pas** — attendre est un voile de chargement **sans le voile**, c'est-à-dire le pop-up d'Adrien déguisé en absence ;
- **le seuil ne se décale pas** — le zoom soutenable se déduit du débit **observé**, qui se dégrade quand le socle demande ses tuiles. Un seuil qui en dépendrait fermerait la boucle « socle → trafic → débit → seuil → socle » : ⚠️ **c'est mot pour mot l'oscillateur que R1 interdit**, retard compris. **R1 ne parle pas que de `meanM`** : elle parle de toute grandeur dérivée du chargé, et `zoomEffectif` en est une ;
- **ce qui varie est le REMPLISSAGE, jamais l'EMPRISE.** `empriseSocle` rend toujours la largeur de `ZOOM_SOCLE` ; l'appelant remplit à `min(ZOOM_SOCLE, zoomSoutenable(...))`. Une emprise qui rétrécirait avec la bande passante ferait changer le socle **de taille à l'écran** — le cran, revenu par la porte du réseau ;
- ce que l'utilisateur voit alors est déjà tranché (§9, 2026-08-20) : **un indicateur discret**.

⚠️ **ET LE SOCLE NAÎT DE TOUTE FAÇON UN CRAN GROSSIER, RÉSEAU PARFAIT COMPRIS — DÉRIVÉ DES CONSTANTES DE `globe.js`, PAS MESURÉ À L'EXÉCUTION.** Avec `SPLIT_RATIO = 0,38`, `dist = |cam − centre| − corde/2` et corde = diagonale de tuile : à l'altitude de naissance, le rapport de la tuile `ZOOM_SOCLE` vaut **0,164** et celui de `ZOOM_SOCLE − 1` vaut **0,357 — 6 % sous le seuil de division**. Le quadtree dessine donc **z12** à la naissance et atteint **z13 à 30 639 m, soit 94,9 % de l'altitude de naissance**. ⚠️ **Le calcul est invariant d'échelle** : il ne dépend pas du zoom choisi, seulement du couple (fraction d'écran, `SPLIT_RATIO`) — **il ne pouvait donc PAS servir à trancher le zoom**, seulement à vérifier que 60 % est bien accordé à `SPLIT_RATIO`. **Cinq pour cent de descente entre les deux : un fondu, pas un cran.**

**④ CE QUI A ÉTÉ REPRIS DE `dem-emprise.js` — ET POURQUOI SI PEU.** Les trois candidates ont été rejouées contre le dépôt :
- `originesEmprise` (`dem-emprise.js:183`) rend **neuf origines de tuile ENTIÈRES**. C'est un calage sur la grille : d'un cadrage au suivant, l'emprise saute d'un **tiers de socle**. ⚠️ **C'est un cran, c'est-à-dire exactement ce que ce pivot supprime.** Juste pour ce qu'elle fait — monter un 3×3 de blocs cuits — inutilisable ici.
- `rectFenetre` (`dem-emprise.js:424`) travaille en **pixels de MNT** dans un champ déjà chargé, pas en degrés : c'est un **consommateur** d'emprise, pas son producteur.
- `patchLatLonBBox` (`coast-mask.js:81`) rend bien `{west, south, east, north}` en degrés — mais **d'un `dem` DÉJÀ CHARGÉ**, donc d'une origine entière, donc calée elle aussi ; et elle tire three.js.

**Réutilisé pour de bon :** `blockExtentMeters` / `BLOCK_TILES` (`landmarks.js`), **seul import du module** — et un test verrouille l'emprise **numériquement contre `latLonToTile` / `tileToLatLon` de `geo.js`**, la source de vérité du géoréférencement. La recopie des deux conversions suit le précédent **explicite** de `dem-emprise.js:428`.

**⑤ L'EMPRISE EST CONTINUE, ET C'EST LE PIVOT LUI-MÊME.** `empriseSocle({ centre, zoom = ZOOM_SOCLE })` ne se cale sur aucune grille : un test rejoue **400 déplacements d'un cent-millième de degré** et exige que l'emprise suive **au même pas**. Conventions tenues : `ouest > est` signale l'antiméridien, les latitudes sont **écrêtées** à 85,051 128 78°, et à zoom 0-1 (trois tuiles font le tour du monde) l'emprise rend `-180 … 180` — la convention de `bathy-sources.js:268`.

**⑥ LES TROIS MUTATIONS, TOUTES MORDANTES.**

| mutation | ce qui tombe |
|---|---|
| `RAPPORT_HYSTERESIS = 1` (seuils égalisés) | **8 tests**, dont **les DEUX oscillations** — 200 bascules au lieu d'une |
| `ZOOM_SOCLE = 15` | **2 tests**, dont **R3 à 48 texels** et la garde anti-fantôme des 3,56 km |
| emprise calée sur la grille (`Math.floor`) | **3 tests**, dont **la continuité** et le verrou contre `geo.js` |

**⑦ CE QUI N'A PAS ÉTÉ VÉRIFIÉ — À LIRE AVANT DE S'APPUYER DESSUS.**
- ⚠️ **LA VISÉE EST SUPPOSÉE AU NADIR** — `2 · h · tan(fov/2)`. La caméra d'arrivée est **oblique** (pente 18/19, `loi-altitude.js`), ce qui raccourcit le socle à l'image : **la fraction réelle est un peu SOUS 60 %, donc le socle naît un peu plus tard qu'annoncé.** Aucun test ne rend une image. **C'est la première chose à regarder à l'écran.**
- ⚠️ **LA LATITUDE N'EST PAS DANS LA SIGNATURE**, et c'est un choix. Les seuils sont ancrés à 45°. Conséquence exacte, à seuil constant : le socle occupe **84,9 % de la hauteur à l'équateur** et **42,4 % à 60°** au lieu de 60 %. La rendre variable est une ligne de code — mais c'est une grandeur de plus à faire coïncider entre quatre modules. **À rouvrir si l'écart se voit.**
- **Rien n'est branché.** `socleVisible` et `empriseSocle` ne sont lus par **aucun** module de `src/` : ce sont les Tâches 4 bis, 6 et 7 qui les consommeront.

### Tâche 4 bis : LE FLUX QUI NE SE COINCE PAS ✅ **FAITE LE 2026-08-21** — ⚠️ **ELLE EST PASSÉE AVANT LA 4 ALPHA, ET `PLAFOND_FILE = 256`**

⚠️ **CETTE TÂCHE PORTAIT « EN PREMIER ». C'ÉTAIT L'ORDRE INVERSE DE CE QUI EST MESURÉ.** La Tâche 4 change ce que cette tâche est censée calibrer : après horizon + frustum, le pic de `loading` passe de **0 à 246** et le trafic d'un panoramique de **596 à 1 786 requêtes**. `PLAFOND_FILE` ne peut pas se calibrer avant. Et la Tâche 4 alpha fait passer les tuiles de PNG 256 px à WebP 512 px : **le bouchon écrit ici serait périmé le jour où elle s'exécute.**

**L'ordre est donc : 4 → 4 quater → 4 alpha → 3 → 4 bis → 4 ter.**

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

- [x] **Étape 1** — écrire le test qui échoue : **un panoramique latéral à basse altitude**, pas une descente. ⚠️ C'est le geste le plus banal de l'application, et celui que le vol de référence ne pouvait pas voir : dans une descente lisse, deux images consécutives demandent presque les mêmes tuiles. Assertion : après 90° de balayage puis 5 s d'immobilité, le nombre de tuiles `loading` revient sous `PLAFOND_FILE` et le zoom effectif rejoint le zoom demandé.
- [x] **Étape 1 ter — FABRIQUER `debitObserve(flux)`. ⚠️ SANS CETTE CASE, LA TÂCHE 4 TER NE PEUT PAS COMMENCER** — signalé cinq fois. Test : après trois réponses de tailles et durées connues, `debitObserve` rend leur débit agrégé ; sur un flux neuf il rend `null` et **non zéro** — zéro se propagerait en « réseau mort » dans `zoomSoutenable`.
- [x] **Étape 2** — le lancer, vérifier qu'il échoue (zoom figé, file saturée).

⚠️ **LE HARNAIS DU DÉPÔT FERAIT PASSER CE TEST SUR DU CODE CASSÉ.** `test/globe-reseau.test.js:83-93` résout `fetch` en `setTimeout(0)` et rend la main entre les images : le compte de tuiles `loading` **retombe alors tout seul**, sans plafond, sans annulation, sans éviction. L'étape 2 échouerait à échouer. **Il faut un bouchon de `fetch` à résolution MANUELLE** — les requêtes ne se résolvent que lorsque le test le décide — sinon on ne mesure que l'ordonnanceur de node.
  ⚠️ **Une case par interface, chacune avec SON assertion** — la version précédente les avait regroupées dans une seule case sans aucune assertion, ce qui ne vaut guère mieux :
  - `creerFlux({ globe })` — un flux neuf rend un cache vide et zéro requête.
  - `demanderEmprise(flux, { emprise, zoom })` — après l'appel, les tuiles couvrant l'emprise sont demandées, **et aucune autre**.
  - `tuilesPretes(flux, emprise)` — ne rend que des tuiles `ready` intersectant l'emprise.
  - `zoomEffectif(flux, emprise)` — **inférieur au zoom demandé tant que la couverture est incomplète**, égal ensuite. C'est l'assertion qui distingue « demandé » de « couvert ».
  - `remplirHauteurs(flux, { emprise, n, sortie })` — remplit `(n+1)²` hauteurs **en une passe**, et rend le compte des manquants. ⚠️ **Par lot, jamais par pixel : mesuré, l'interface par pixel coûtait +3,5 ms par reconstruction à N=256.**
  ⚠️ **Et ajoutez-les à l'audit de noms du §10, qui leur était aveugle.**
- [x] **Étape 3 — implémenter les trois corrections du flux** (plafond de file, annulation, éviction des `loading`) **et les cinq interfaces ci-dessus.** ⚠️ **CETTE CASE AVAIT DISPARU : une correction destinée à détailler les interfaces avait emporté la seule case d'implémentation de la tâche, et la numérotation sautait de 2 à 4.** Sixième occurrence de l'accident que le §0 documente.
- [x] **Étape 4** — vérifier par mutation : retirer le plafond, puis l'annulation, puis l'éviction des `loading` — **chacune doit tuer un test**.
- [x] **Étape 5** — mesurer le battement : nombre de décodages complets sur un vol de référence. ⚠️ L'attaque en a compté **10 829 pour un cache de 420** ; donner le chiffre après.
- [x] **Étape 6 — LA CLÔTURE DU §0**, les quatre commandes dans l'ordre, puis commit.

#### ✅ CE QUI A ÉTÉ FAIT, ET CE QUE ÇA MESURE (2026-08-21)

**Fichiers :** `src/monde/flux-terrain.js` (créé) · `src/globe.js` · `test/flux-terrain.test.js` (créé, ajouté à la ligne `test`) · bancs `.banc/pano-latence.mjs`, `.banc/battement.mjs`, `.banc/mutation-4bis.py` (hors dépôt).

##### `PLAFOND_FILE = 256`, et voici sa mesure

Banc `.banc/pano-latence.mjs` — **modèle de latence**, pas bouchon manuel : horloge virtuelle à 16,67 ms l'image, une requête se résout au bout de `octets × 8 / (débit / MAX_CONCURRENT)`, la tuile pesant 87,6 Kio (les 1 401 Ko des seize racines mesurés chez AWS). Stabilisation jusqu'à z15, puis 90° de balayage à 4 km en 60 images, puis 5 s d'immobilité.

| débit | pic de `loading` (avant) | zoom après 5 s (avant) | pic (après) | `loading` après 5 s (après) |
|---|---|---|---|---|
| 12 Mb/s (R3) | **558** | z7 (parti de z15) | **262** | 64 |
| 3 Mb/s (×4) | **554** | z3 | — | — |
| 0,5 Mb/s (×24) | **546** | z3 | — | — |

⚠️ **LE PIC NE DÉPEND PAS DU DÉBIT — 558, 554, 546 sur un facteur 24.** C'est la **frontière du quadtree** qui le fixe, pas le réseau : la règle sans-trou n'ouvre un niveau que lorsque les quatre enfants sont prêts. Le débit ne change que la vitesse à laquelle la file se vide, jamais sa hauteur. L'attaque avait vu le même fait à une autre profondeur (« plafonne à 286 à toutes les latences ») et en avait tiré la mauvaise conclusion.

**256 tient les deux bornes du protocole** : strictement sous le pic mesuré le plus BAS (546, donc 47 %) et strictement sous `CACHE_MAX_CONTINU = 1700` (15 %). Pourquoi pas 512 : une file de 512 à six requêtes de 359 ms met **trente secondes** à se vider — elle travaille encore une demi-minute après que la caméra s'est arrêtée ailleurs.

##### Le navigateur, avant et après — `?globe=continu`, caméra en mouvement en orbite

| | pic de `loading` | file | cache |
|---|---|---|---|
| avant (la mesure qui a motivé la tâche) | **568** | — | collé à 1 700 |
| après (900 images d'orbite, `autoRotate`) | **141** | 9 à 31 | 1 700, dont 1 079 `ready` |

Le banc en trouvait 558 là où le navigateur en trouvait 568 : **le modèle de latence est bon**, et c'est lui qui rend la mesure rejouable.

##### Les trois corrections, et ce que chacune est vraiment

1. **`PLAFOND_FILE`** — testé **AVANT** la marque `loading`, donc une requête refusée **reste `empty`** (jamais un `idle` inventé : les états sont `empty | loading | ready | error`). Elle repart d'elle-même à l'image suivante — c'est de la contre-pression, pas un abandon.
2. **L'annulation** — ⚠️ **elle ne touche PAS au vol, et c'est un choix.** Une entrée encore dans `this.queue` n'a pas de promesse, donc pas de `.catch`, donc **pas de réessai automatique** : c'est exactement le piège mesuré. Et l'`AbortController` reste refusé par la raison déjà écrite dans `fetchTile` — la promesse est partagée par URL, l'abandon de l'un annulerait la tuile des autres. Le gain est dans la file (558) et non dans le vol (6).
   S'y ajoute **`_purgerFile`**, une fois par image : ce que la file contient encore et que l'image courante n'a pas demandé sort. Sans elle, le plafond seul refuse la vue d'après pour garder la vue d'avant.
3. **L'éviction des `loading`** — ⚠️ **le plan la décrivait sur un état du code qui n'existe plus** : la Tâche 4 avait déjà ajouté le rang 0 (`_bloquee`), qui reprend les `error` et les `loading` bloquées depuis plus de `IMAGES_BLOQUEE`. Ce qui manquait vraiment : (a) une victime `loading` ne sortait pas de la file, donc `_pump` finissait par télécharger une orpheline ; (b) les `empty` **périmées** que le plafond et la purge produisent n'étaient candidates à **aucun** des deux rangs — le fantôme chassé, revenu par la porte d'à côté.

##### Les six interfaces, une case et une assertion chacune

`creerFlux` · `demanderEmprise` · `tuilesPretes` · `zoomEffectif` · `remplirHauteurs` · `debitObserve`. **`debitObserve` existe : la Tâche 4 ter peut commencer.** Il rend `null` sur un flux neuf, jamais `0`, et il agrège **en temps mural** (six transferts simultanés de 400 ms font 400 ms, pas 2 400 — sommer les durées diviserait le débit par six). `zoomEffectif` rend lui aussi `null` quand rien ne couvre l'emprise, pour la même raison : `0` est un vrai niveau de zoom.

##### ⚠️ LA CONTRADICTION QUE CETTE TÂCHE A DÛ TRANCHER : `remplirHauteurs` N'AVAIT PLUS DE HAUTEURS À LIRE

La Tâche 4 sexies (Étape 1) **relâche `t.heights` dans `_buildMesh`** — 256 Kio la tuile, 435 Mo à `CACHE_MAX_CONTINU`. Or la Phase 2 rééchantillonne le socle **depuis ce cache**. Les deux tâches se contredisaient, et aucune des deux ne le disait.

**Tranché par la PORTÉE, pas par le retour en arrière** : `globe.gardeHauteurs` est la **réservation du flux** — les seules tuiles de l'emprise du socle (`BLOCK_TILES = 3`, donc **seize au pire**, 4 Mo). Trois mécanismes la respectent : `_buildMesh` garde leurs hauteurs, `_purgerFile` ne les purge pas, `_evictJusqua` ne les évince pas. ⚠️ **Et cette réservation était NÉCESSAIRE au-delà des hauteurs** : les tuiles du socle ne sont demandées par personne dans `_traverse` (le quadtree n'y descend que si la caméra l'y amène), donc leur `lastUsed` ne bouge jamais et la purge les aurait jetées à l'image suivante.

##### Le battement (Étape 5) — vol de référence, 45 s, Atlantique 260 km → Mont-Blanc 2,2 km

| réseau | décodages | requêtes | URL distinctes | rapport |
|---|---|---|---|---|
| 12 Mb/s | **732** | 738 | 738 | **×1,00** |
| réseau rapide (modèle à 1 200 Mb/s) | **11 758** | 11 764 | 11 764 | **×1,00** |

⚠️ **Le rapport est de UN : aucune tuile n'est demandée deux fois sur le vol entier.** L'attaque comptait 10 829 décodages « pour un cache de 420 » — le chiffre à retenir n'est pas leur nombre (il suit mécaniquement la bande passante disponible) mais **leur redondance, qui est nulle**. À 12 Mb/s le vol ne peut de toute façon livrer que 738 tuiles en 45 s : c'est le réseau qui plafonne, pas le cache.

##### La vérification par mutation (Étape 4) — `.banc/mutation-4bis.py`

| mutation | résultat | test tué |
|---|---|---|
| sans le plafond de file | **TUÉE** | le refus reste `empty` · panoramique à 12 Mb/s |
| sans l'annulation | **TUÉE** | la tuile annulée ne revient pas d'elle-même |
| sans la purge de file | **TUÉE** | panoramique à 12 Mb/s |
| sans l'éviction des `empty` périmées | **TUÉE** | l'éviction reprend les `empty` avant les prêtes |

⚠️ **Les deux dernières ont SURVÉCU au premier tour**, et c'est la mesure qui l'a dit : au balayage de référence le cache culmine à 836 tuiles pour un budget de 1 700, donc `_evictJusqua` **ne se déclenche jamais** et la correction restait invisible. Elle a désormais son test dédié, déterministe.

##### ⚠️ CE QUI N'A PAS ÉTÉ FAIT, ET CE QUI RESTE OUVERT

- **Le test du panoramique est SCINDÉ EN DEUX, et la physique l'exige.** Le pic et le retour sous le plafond se mesurent à 12 Mb/s (c'est là que la file sature) ; le retour du globe à sa profondeur ne se mesure qu'à réseau rapide, parce qu'après 90° de balayage tout le cache est périmé et que reconstruire mille tuiles demande une minute à 12 Mb/s. **Mesuré : à 12 Mb/s le globe revient à z6 depuis z14 en cinq secondes, et aucune correction de file n'y peut rien.** Le **zoom effectif de l'emprise**, lui, rejoint `ZOOM_SOCLE` **aux deux débits** — c'est précisément ce que le flux apporte : seize tuiles à priorité maximale, pas mille.
- ⚠️ **LA PRODUCTION PORTE LE MÊME DÉFAUT, ET IL N'EST PAS CORRIGÉ.** Mesuré au navigateur **sans** `?globe=continu`, caméra en mouvement en orbite : **473 tuiles `loading`, file à 462, pour un `CACHE_MAX` de 600** — la file seule occupe 77 % du budget du cache, proportionnellement bien pire que le chemin continu. Toutes les corrections de cette tâche sont derrière `this.continu`, comme le plancher de `dist`, la quarantaine et le rang 0 avant elles. **C'est délibéré** (la production ne prend pas un changement non arbitré), **mais ce n'est pas une raison de l'oublier** : à trancher avec Adrien.
- **`flux-terrain.js` n'a AUCUN appelant dans `src/`.** Il est produit ici, consommé par les Tâches 6 et 7. `vite build` ne le bundle donc pas encore — seuls `node --check` et les tests le couvrent.
- **Le battement au navigateur n'a pas été mesuré**, seulement au banc.
- **Aucun test ne rend une image** : rien ici ne prouve ce que l'œil verra.

### Tâche 4 ter : la descente bornée par le réseau — règle R3 ✅ **FAITE LE 2026-08-21** — ⚠️ **LES DEUX POINTS DU PLAN ONT SURVÉCU AUX QUATRE TÂCHES, ET LE TROISIÈME EST MESURÉ**

**Fichiers :** créer `src/monde/descente-bornee.js` · tester `test/descente-bornee.test.js` — ⚠️ **et ne touchez pas à `flux-terrain.js` : `debitObserve` est fabriqué par la Tâche 4 bis, qui passe avant.**

**Interfaces produites :** `zoomSoutenable({ debitObserveMbs, zoomDemande })` → `number`

✅ **`debitObserve(flux)` est produit par la Tâche 4 bis** (son Étape 1 ter), qui passe avant celle-ci. ⚠️ **Vérifiez que cette case est bien cochée avant de commencer** : le manque a été signalé cinq fois avant d'être posé.

**Les deux points mesurés** : **z11 à 12 Mb/s**, **z9 à 4 Mb/s**. ⚠️ **Deux points ne font pas une courbe.** Commencez par une interpolation logarithmique entre eux, **mesurez un troisième point** (par exemple à 30 Mb/s) et corrigez. Le plan ne peut pas vous donner la loi : il vous donne deux points et l'obligation d'en trouver un troisième.

Mesuré : à froid, le zoom effectif plafonne à **z11 sur 12 Mb/s, z9 sur 4 Mb/s**. À z9 un texel vaut 213 m. ⚠️ **CE PLAN ÉCRIVAIT « dix-sept texels sur la largeur du socle » — c'était le fantôme des 3,56 km que la Tâche 3 a réfuté** (17 × 213 = 3 621 m). La vraie largeur vient de `blockExtentMeters` et dépend du zoom : sur un socle **z13 (10,4 km à 45°), cela fait 48 texels**. Ce n'est pas le flou de la décision 13, **c'est une autre carte.**

- [x] **Étape 1** — test : à débit observé faible, `zoomSoutenable` rend un zoom inférieur au demandé. ⚠️ **La seconde moitié de cette assertion — « et la caméra ne descend pas plus vite que lui » — est HORS DU PÉRIMÈTRE de cette tâche** : elle appartient à la Tâche 1, qui tient la caméra. **Dites ici qui appelle `zoomSoutenable` et où** (`modes.js`, sur le chemin de descente), et laissez l'assertion caméra à la Tâche 1.
- [x] **Étape 2** — le lancer, vérifier qu'il échoue.
- [x] **Étape 3** — implémenter `zoomSoutenable`. ⚠️ **Le débit s'observe, il ne se devine pas** : il vient de `debitObserve(flux)` — octets réellement reçus par seconde — **jamais de `navigator.connection`**, qui ment et n'existe pas partout.

- [x] **Étape 4** — mutation : **rendre `zoomSoutenable` constant (toujours le zoom demandé) doit tuer le test**. ⚠️ Ce plan écrivait le mot « mutation » nu — une mutation qui n'est pas nommée n'est pas exécutable.
- [x] **Étape 5 — LA CLÔTURE DU §0**, les quatre commandes dans l'ordre, puis commit.

#### ✅ CE QUI A ÉTÉ FAIT, ET CE QUE ÇA MESURE (2026-08-21)

**Fichiers :** `src/monde/descente-bornee.js` (créé) · `test/descente-bornee.test.js` (créé, **ajouté à la ligne `test`**, `audit:tests` sans écart : 185 listés · 185 sur disque) · bancs `.banc/zoom-soutenable.mjs`, `.banc/mutation-4ter.py` (hors dépôt). ⚠️ **`flux-terrain.js` n'a pas été touché**, comme la tâche l'exige.

##### ⚠️ LES DEUX POINTS DU PLAN ONT ÉTÉ RE-MESURÉS — ET ILS TIENNENT

Le risque annoncé était réel : « z11 à 12 Mb/s, z9 à 4 Mb/s » avait été relevé sur l'ancien quadtree, avant que `MAX_Z` passe de 11 à 15, le cache de 420 à 1 700, le plancher de `dist` de 63,7 km à 1 m et la file à 256. **Les deux points sont retrouvés à l'identique.** Ce n'étaient pas des artefacts de `MAX_Z = 11`.

**Banc `.banc/zoom-soutenable.mjs`** — même modèle de latence que `.banc/pano-latence.mjs` (celui qui reproduit le navigateur à 2 % près : 558 contre 568). Vol de référence du §0 — 45 s, Atlantique 260 km → Mont-Blanc 2,2 km, 60 Hz, **cache froid** — puis la caméra reste en place, **17 images jetées** (protocole de banc du §0) et **médiane du zoom dessiné sur 300 images**.

| débit | z soutenu | requêtes | cache | file | `debitObserve` |
|---|---|---|---|---|---|
| 2 Mb/s | **z7** | 144 | 216/1 700 | 54 | 1,99 |
| **4 Mb/s** | **z9** ✅ *point du plan* | 282 | 564/1 700 | 140 | 3,97 |
| 8 Mb/s | **z11** | 552 | 1 456/1 700 | 246 | 7,83 |
| **12 Mb/s** | **z11** ✅ *point du plan* | 828 | 1 700/1 700 | 212 | 11,38 |
| **30 Mb/s** | **z13** ⚠️ *le troisième point, exigé par la tâche* | 2 016 | 1 700/1 700 | 256 | 27,82 |
| 64 Mb/s | **z14** | 3 624 | 1 700/1 700 | 256 | 50,08 |

⚠️ **ET LE PROTOCOLE DE BANC N'EST PAS UN DÉTAIL ICI.** Trois grandeurs différentes se disputaient le nom de « zoom soutenu », et elles ne disent pas la même chose : le zoom **en mouvement à basse altitude** (7, 9, 9, 11, 11, 12), le zoom **au repos** (7, 9, 11, 11, 13, 14) et le **maximum atteint** (7, 10, 13, 12, 13, 15). C'est le zoom **au repos, médiane sur 5 s** qui retrouve les deux points du plan à l'identique — donc c'est celui que le plan mesurait, et c'est celui qui fait foi. **Les deux autres sont notés ici pour que personne n'ait à les redécouvrir.**

##### LA LOI : `z = ⌊6,2 + 1,4 × log₂(débit en Mb/s)⌋`

⚠️ **UNE INTERPOLATION LOGARITHMIQUE ENTRE LES DEUX SEULS POINTS DU PLAN AURAIT ÉTÉ FAUSSE**, et c'est exactement ce que la tâche redoutait : entre (4 ; z9) et (12 ; z11) la pente vaut 1,26 niveau par doublement, et elle prédit **z12** à 30 Mb/s là où le banc mesure **z13**. Les quatre points supplémentaires bornent la pente à `]1 ; 1,667[`.

La loi n'est **pas** ajustée aux moindres carrés, et la raison est mesurable : les six relevés sont des **planchers** (un z11 mesuré dit « la grandeur continue est dans [11, 12) »), et un ajustement au centre des points sort des bandes. Les deux coefficients sont pris dans le **polytope des six bandes**.

| débit | mesuré | la loi | |
|---|---|---|---|
| 2 | z7 | 7 | ✅ |
| 4 | z9 | 9 | ✅ |
| 8 | z11 | 10 | ⚠️ −1, le seul écart |
| 12 | z11 | 11 | ✅ |
| 30 | z13 | 13 | ✅ |
| 64 | z14 | 14 | ✅ |

⚠️ **L'ÉCART EST DU BON CÔTÉ, ET C'EST DÉLIBÉRÉ.** 8 Mb/s est aussi le point le plus dispersé des six (médiane 11, mais 9 en mouvement et 13 au maximum). **Sous-estimer d'un niveau donne du flou — ce que la décision 13 accepte. Surestimer donne « une autre carte » — ce que R3 interdit.** Deux tests gardent cette asymétrie : la loi ne dépasse **jamais** un point mesuré, et ne le rate **jamais** de plus d'un niveau.

⚠️ **ET LA LOI CESSE D'ÊTRE UNE LOI DE RÉSEAU AU-DESSUS DE ~30 Mb/s — mesuré.** À 30 et 64 Mb/s la file colle à `PLAFOND_FILE = 256` et le cache à 1 700 : **ce n'est plus le réseau qui borne, c'est le budget.** La loi suit le bon chiffre par accident, elle ne l'explique pas. **Le jour où le budget bouge, ces deux points-là sont à reprendre ; les quatre premiers non.**

##### `null` N'EST PAS ZÉRO — et c'est le piège que la tâche annonçait

`debitObserve` rend `null` sur un flux neuf. Traité comme zéro, il ferait passer un réseau **inconnu** pour un réseau **mort** et clouerait la descente au plancher au tout premier instant, c'est-à-dire quand on n'a encore rien à reprocher au réseau. **Débit inconnu ⇒ zoom demandé, sans rognage.** Un débit mesuré **à** zéro, lui, cloue bien au plancher : les deux cas sont testés séparément.

##### ⚠️ LE POINT D'APPEL — R3 A DÉSORMAIS UN PROPRIÉTAIRE, ET IL EN A UN SEUL SUR DEUX

La Tâche 1c, qui devait poser ce point, a été abandonnée avec le pivot. R3 a **deux moitiés** :

1. **LE REMPLISSAGE — posé ici, et testé.** `remplirBorne(flux, { emprise, zoomDemande })` (`src/monde/descente-bornee.js`) lit `debitObserve(flux)`, le passe à `zoomSoutenable`, et appelle `demanderEmprise` au zoom rogné. ⚠️ **L'EMPRISE NE BOUGE PAS** — contrat de la Tâche 3, « ce qui varie est le remplissage, jamais l'emprise » : une assertion le vérifie octet par octet, et une mutation qui ignore la borne meurt.
2. **LA CAMÉRA — pas posée, et elle appartient à la Tâche 1.** Le chemin de descente est `src/modes.js` : `_dive` (`:566`), `pickDiveTier` (`:80`), `DIVE_TIERS` (`:62`) — relevés le 2026-08-21. ⚠️ **Tant que la Tâche 1 n'est pas faite, R3 borne CE QU'ON DEMANDE, pas la VITESSE à laquelle on le demande.** C'est écrit plutôt que sous-entendu, dans le §4 de `descente-bornee.js`.

##### L'INDICATEUR DISCRET — son ÉTAT est fait, son DESSIN ne l'est pas

Décision d'Adrien du 2026-08-20. `etatIndicateur({ debitObserveMbs, zoomDemande })` rend `{ enRetard, niveaux, zoom }` — **`niveaux`, pas un pourcentage** : un niveau vaut un facteur deux de résolution. ⚠️ **Éteint quand le débit est inconnu** : allumer « ça rame » avant la première réponse serait le même bogue que confondre `null` et zéro, appliqué au visible.

⚠️ **CE MODULE NE LE DESSINE PAS, ET NE PEUT PAS** : il est appelé depuis un module pur, sans DOM. **La place est laissée, et elle est vérifiée sur le dépôt :** `src/main.js:3413-3416`, le `setTimeout(…, 2600)` qui garde la carte de chargement 2,6 s alors que `demBusy` est relâché à la ligne **3418**, dans le `finally` qui s'exécute tout de suite. Le dessin appartient à la **Tâche 2**, comme le §9 le dit.

##### La vérification par mutation (Étape 4) — `.banc/mutation-4ter.py`

| mutation | résultat | test tué |
|---|---|---|
| **`zoomSoutenable` constant (toujours le zoom demandé)** — celle que le plan nomme | **TUÉE** | R3 à débit faible · les six points · `remplirBorne` · l'indicateur |
| `null` lu comme zéro | **TUÉE** | débit inconnu · `remplirBorne` sur flux neuf · indicateur éteint |
| la borne devient une consigne (plus de `min`) | **TUÉE** | « c'est une borne, pas une consigne » |
| `remplirBorne` ignore la borne | **TUÉE** | le point d'appel demande au zoom rogné |

##### ⚠️ CE QUI N'A PAS ÉTÉ VÉRIFIÉ

- **Rien n'a été mesuré au NAVIGATEUR pour cette tâche.** Les six points viennent du banc. Le modèle de latence est validé à 2 % près par la Tâche 4 bis, mais **sur le pic de file, pas sur le zoom soutenu**.
- **`descente-bornee.js` n'a aucun appelant hors de `src/monde/`**, donc `vite build` ne le bundle pas : `node --check` et les tests sont son seul filet, exactement comme `flux-terrain.js`.
- **La moitié caméra de R3 n'est pas posée** (Tâche 1) : la borne existe, personne ne ralentit encore la descente.
- **L'indicateur discret n'est pas dessiné** (Tâche 2) : aujourd'hui, quand le réseau ne suit pas, l'utilisateur voit toujours les 2,6 s de voile de `main.js`.
- **La loi n'est mesurée qu'entre 2 et 64 Mb/s.** En dessous de 2 et au-dessus de 64, elle extrapole — et au-dessus de 30 elle décrit déjà le budget plutôt que le réseau.
- **Aucun test ne rend une image** : rien ici ne prouve ce que l'œil verra.

---

## 7. PHASE 2 — La fenêtre bornée

### Tâche 5 : `audit-solide.js` ✅ **FAITE LE 2026-08-21** — ⚠️ **`Ā` TIENT, ET TROIS MUTATIONS ONT SURVÉCU AU PREMIER TOUR**

> **Bilan mesuré** (banc de `test/audit-solide.test.js`, côté 56 = `TERRAIN_SIZE`, profondeur 7 = `plinthDepth`) :
> · **6 sabotages sur 6 refusés**, et le test ③ verrouille la contre-mesure : **le volume SEUL en laisse passer trois** — dalle absente (−21,5 % de volume), mur manquant (−17,6 %), trou de 25 % (**−4,1 %**, exactement les « −4 % » annoncés par le plan), tous à volume POSITIF. `Ā` les voit à 5,75e-1 · 7,05e-2 · 1,01e-1 contre un seuil de 1e-9.
> · **Seuil de fermeture `EPS_FERMETURE = 1e-9` × aire totale, fixé sur UN SEUL TRIANGLE de la fenêtre la plus fine** (n = 768) : mesuré 3,22e-7, soit **322 fois le seuil** ; une maille entière, 665 fois. Le solide sain rend 1,73e-19 — **dix ordres sous le seuil**.
> · ✅ **L'epsilon de dégénérescence `1e-12 × côté²` est confirmé, PAS deviné** : à n = 768 le plus petit triangle sain mesure 2,66e-3 pour un seuil de 3,14e-9, soit **5,93 ordres de marge** — les « six ordres » du plan.
> · ⚠️ **« environ 10 ms » ÉTAIT DEUX FOIS TROP OPTIMISTE** : mesuré **22,8 ms à n = 384** et **118 ms à n = 768**. C'est un instrument de test, pas un contrôle par image.
> · ⚠️ **LA QUESTION POSÉE TROIS FOIS PAR LES ATTAQUES EST TRANCHÉE — ON AUDITE UNE COQUE À LA FOIS.** Concaténées, `Ā` et V s'additionnent : un test démontre que deux coques trouées peuvent se déclarer fermées ensemble.
> · ⚠️ **LE DISCRIMINANT QUE LA TÂCHE 6 ATTEND EST LIVRÉ** : `hauteurs.distinctes`. Un pavé droit à hauteurs nulles en rend **2** ; un maillage rééchantillonné davantage. C'est l'assertion qui empêche la Tâche 6 d'auditer cent pavés.
> · **Mutation : 12 passées, 12 tuées** — mais **trois ont survécu au premier tour** (volume non recentré, sommation naïve, aire au facteur 2). Il a fallu **trois assertions à valeur fermée** pour les tuer : aire totale = 2·côté² + 4·côté·profondeur exactement, volume du solide plat = côté²·profondeur exactement, et un solide **translaté de 1e9** qui rend le même volume à 1e-13 près (sans recentrage : 1,4e-9).
> · `npm test` **3 215 verts** (3 186 + 29), `audit:tests` 187 listés / 187 sur disque, build complet vert, page chargée avec et sans `?globe=continu` — aucune erreur JS neuve.

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

- [x] **Étape 1** — écrire **six sabotages** et le test qui les attend tous : solide retourné, dalle absente, mur manquant, trou central, triangle dégénéré, NaN.
- [x] **Étape 2** — les lancer, vérifier que **chacun** échoue. ⚠️ **CE PLAN A ANNONCÉ « 6 SUR 6 » COMME MESURÉ, ET C'ÉTAIT FAUX** : avec les trois mesures qu'il prescrivait, **trois passaient pour sains**. Si vos six échouent du premier coup, **c'est votre banc qu'il faut suspecter**, pas votre chance.
- [x] **Étape 3** — implémenter. ⚠️ **L'AUDIT PRESCRIT LAISSE PASSER TROIS SABOTAGES SUR SIX — MESURÉ AU BANC, PAS DÉDUIT.** Dalle absente (+7,35), mur manquant (+7,95) et **trou couvrant un quart de la surface** (+9,18 contre 9,568 pour le sain, soit **−4 % seulement**) rendent tous un volume positif et **passent pour sains**. Le plan annonçait « 6 sur 6 » : c'est faux.

  **Le correctif, et ⚠️ CE PLAN EN A PROPOSÉ DEUX VERSIONS INSUFFISANTES DE SUITE.** « Le volume signé autour de deux origines » d'abord sans dire lesquelles — l'origine du monde laisse passer **deux sabotages sur trois** ; puis « une origine oblique », qui **reste exactement aveugle** à un trou de 25 % dès que le décalage est mal orienté. **La raison est structurelle et se démontre : `V(O₂) − V(O₁) = −(O₂ − O₁) · Ā`.** L'écart s'annule **quand le décalage est orthogonal à `Ā`**, et **aucune amplitude ne répare une mauvaise direction.**

  ⚠️ **MESUREZ `Ā` DIRECTEMENT — c'est l'invariant, et les deux origines n'en étaient qu'un mauvais sondage.** `Ā` est la somme des vecteurs-aires orientés de toutes les faces : **sur un solide fermé, elle vaut exactement zéro**, quelle que soit l'origine. Assertion : `‖Ā‖ < ε_aire`, avec `ε_aire = 1e-9 × (aire totale)`. **Un mur manquant, une dalle absente ou un trou donnent une `Ā` non nulle proportionnelle à la surface qui manque — il n'y a plus ni origine à choisir, ni direction aveugle, ni seuil à deviner.**

  ⚠️ **Gardez le volume signé autour d'UNE origine en plus** : lui seul attrape le **solide retourné**, dont la `Ā` est nulle. ✅ L'epsilon de dégénérescence `1e-12 × côté²` est bon : six ordres de marge à n=768.

  ⚠️ **Et l'écart « 58 à 296 % » n'est pas un seuil : il est proportionnel à l'aire du trou** (68,4 % pour un trou de 25 % de la surface, **1,3 % pour 0,4 %**). **Fixez le seuil sur le plus petit défaut que vous voulez attraper, et écrivez-le.** ✅ L'epsilon `1e-12 × côté²` est bon : six ordres de marge à n=768.
- [x] **Étape 4** — ⚠️ **le test de non-vacuité** : l'audit doit refuser de rendre un verdict sur une géométrie vide, au lieu de la déclarer saine. **C'est ainsi que le test de silhouette du prototype passait à vide.**
- [x] **Étape 5** — mutation sur chacune des trois détections. ✅ **12 mutations, 12 tuées ; 3 ont survécu au premier tour** — voir le bilan.
- [x] **Étape 6 — LA CLÔTURE DU §0**, les quatre commandes dans l'ordre, puis commit.

### Tâche 6 : `fenetre-bornee.js` — l'extraction ✅ **FAITE LE 2026-08-21** — ⚠️ **`plinth.js` ET `ocean.js` N'ONT PAS ÉTÉ TOUCHÉS, ET C'EST UN ARBITRAGE ÉCRIT**

> **Bilan mesuré** (banc `test/fenetre-bornee.test.js`, 29 tests) :
> · **Le cran est remplacé, et le chiffre le dit** : `majHauteurs` coûte **2,367 ms par image à n = 384** (bout en bout — `remplirHauteurs` sur 16 tuiles z13 de 256 px, puis la réécriture des `y`), contre **5,5 / 8,7 / 14,6 / 24,5 ms** pour une reconstruction de bloc (chiffres du dépôt, `plinth.js:876`). Détail : 1,040 ms à n = 256, 2,367 à n = 384, 9,094 à n = 768 (la résolution de REPOS, payée une fois à l'arrêt). ⚠️ **CPU seul** — le téléversement des sommets au GPU est HORS du chronomètre (§3 de `/threejs-optimisation`).
> · La réécriture seule (`appliquerHauteurs`, sans le flux) : **0,504 ms à n = 384**. La construction complète, elle, coûte 2,41 ms — c'est ce qu'on cesse de payer par image.
> · ⚠️ **AUCUNE ALLOCATION, AUCUNE RETRIANGULATION** : le test compare les tampons par IDENTITÉ DE RÉFÉRENCE, pas par contenu — c'est la seule assertion qui distingue « mis à jour » de « reconstruit à l'identique ».
> · **Décision 14, mesure de contrôle : ×2,0000 → ×1,003966.** ⚠️ **Et le vol de contrôle N'EST PAS celui du §0** : les ancres z3–z7 vivent entre **33 049 km et 2 065 km** d'altitude, quand le vol de référence va de 260 km à 2,2 km — il ne les rencontre **jamais**, et la mesure y rend 1 avant comme après. C'est la descente **orbite → socle (z3 → z13, 45 s à 60 Hz)** qui les traverse. Le pas d'échantillonnage y vaut **0,003705 zoom par image** : le résidu de 1,003966 est donc « 1 à la tolérance du pas », et le test écrit sa tolérance EN FONCTION du pas.
> · ⚠️ **LE ×3,661 DU PLAN N'A PAS PU ÊTRE REPRODUIT** : il vient du prototype gitignoré, et sa grandeur (« largeur de sol visible ») n'a pas d'équivalent mesurable dans ce dépôt. La mesure ci-dessus la remplace, **rejouable en une commande**, et elle porte sur ce que la décision 14 change réellement — le rapport d'exagération entre deux images consécutives.
> · ⚠️ **DEUX ASSERTIONS ONT MORDU À LA PREMIÈRE EXÉCUTION, et c'est tout leur intérêt.** ① la courbe **dépassait son ancre la plus haute** — 5,000746 à z = 5,001 — parce que Fritsch–Carlson annule les pentes aux EXTREMUMS locaux et que cette étape manquait ; corrigé, le dépassement tombe à 4,4e-16. ② **une assertion du plan était fausse** : « inverser l'anneau d'un sommet ouvre le socle » — non. Mesuré : `‖Ā‖` relative **1,61e-19** contre un seuil de 1e-9, volume positif, orientation bonne. La bande vrillée reste **topologiquement fermée**, et `Ā` est un invariant de fermeture, pas de justesse. **Ce défaut-là n'est pas gardé par l'audit, il est gardé par la CONSTRUCTION** (les sommets hauts des parois SONT les sommets de bord — le même index, pas une copie).
> · Mutations qui mordent, elles : **dalle retournée** (`ferme` false), **mur entier manquant** (écart 0,105, volume POSITIF à 63 596 — le sabotage que la Tâche 5 a montré invisible au volume seul), **nappe absente** (0,346).
> · **Cent emprises tirées au hasard passent cent fois**, antiméridien et écrêtage de Mercator compris (le test EXIGE que le tirage couvre les deux, sinon il ne prouve rien), **avec `hauteurs.distinctes > 2` à chaque essai** — sans quoi on aurait audité cent pavés droits. Le contre-test est écrit : une fenêtre non remplie rend `distinctes: 2`.
> · **Le coin déborde de 0,46 unité au réglage de production** (`slabCorner = 0,04` → rayon 2,24 ; `slabCornerSmoothing = 0,6` → exposant 4,4), soit **plus de trois mailles à n = 384**. Remapper le seul anneau de bord aurait laissé la nappe DEHORS de son mur : c'est le « liseré de vide dans chaque coin » de `fenetre-clip.js`. On déforme donc le pavé de coin ENTIER, par un facteur d'échelle radial — identité sur les deux arêtes du pavé, donc raccord sans discontinuité, et **jamais un repli** (zéro dégénéré sur cent emprises).
> · **`formeCoin` est la superellipse de `pointCoin` à 1,1e-16** sur 512 directions × 4 exposants : une seule loi, pas deux copies.
> · ⚠️ **`plinth.js` ET `ocean.js` N'ONT PAS ÉTÉ MODIFIÉS.** `block-grid.js:768` appelle `buildSlabWalls`, et 13 fichiers `damier-*.test.js` portent des empreintes BIT À BIT : toucher à sa signature les casse tous. **Cinq options sur douze sont portées** (`depth`, `cornerR`, `cornerExp`, `resolution`, `baseYFloor`) ; **les sept autres sont TRANSPORTÉES, pas perdues** — voir le §7 du module. Raison mécanique et unique : chanfrein, congé, AO de contact, masque et bords sont un **profil cuit qui dépend des hauteurs**, donc incompatibles avec une mise à jour en place. **Le plan les a déjà arbitrées à la décision 5** (« la gravure des parois ne s'écrit qu'à l'ARRÊT de la caméra ») : la coque pendant le mouvement, `buildSlabWalls` à l'arrêt, sur le contour que `contourSocle(fenetre)` publie — même anneau, même `baseY`, même forme de coin.
> · ⚠️ **ET LA MER ÉPOUSE ENCORE LE SOCLE, VÉRIFIÉ ET NON AFFIRMÉ** : un test parcourt 257 directions et exige que le clip d'`ocean.js` (`rayonEauDansSocle` = 27,78 ; `rayonCoinEau(2,24)` = 2,02) reste STRICTEMENT dans l'empreinte de la fenêtre, marge minimale **0,22** = `SOCLE_CHANFREIN` + `SOCLE_MARGE_EAU`. L'empreinte monde n'a pas bougé d'un bit (`COTE_MONDE === TERRAIN_SIZE`), donc il n'y avait rien à transmettre.
> · **La largeur au sol de la fenêtre EST `blockExtentMeters`, au bit près** — parce qu'elle prend `156 543,03392 × 256` et non `2πR` (32 m d'écart, soit 8,0e-7 en relatif : assez pour faire diverger l'échelle verticale en silence).
> · **`zoomDepuisAltitude(SEUIL_NAISSANCE_M, 45°)` rend exactement `ZOOM_SOCLE = 13`** : le pont altitude ↔ zoom n'est pas un second réglage, c'est l'équation de `seuil-socle.js` lue dans l'autre sens.
> · `npm test` **3 244 verts** (3 215 + 29), `audit:tests` 188 listés / 188 sur disque, `node --check` sur les deux fichiers, build complet vert (`nettoie:dist` → `build:mapcells` → `vite build` → `verifie:dist`), page chargée **avec et sans `?globe=continu`** — aucune erreur JS neuve, seulement les deux `ERR_CONNECTION_TIMED_OUT` préexistants du bucket d'altitude injoignable depuis cette machine.
> · ⚠️ **CE QUI N'EST PAS FAIT, ET QUI RESTE À LA TÂCHE SUIVANTE : LE BRANCHEMENT.** `fenetre-bornee.js` **n'est importé par aucun fichier de production** — ni `main.js`, ni `terrain.js`, ni `ocean.js`, ni `gpx.js`. Le module est complet et prouvé ; la fenêtre ne remplace pas encore le bloc à l'écran, et l'exagération continue n'est encore lue par aucun des douze appelants de `params.demExaggeration`. **Tant que ce branchement n'est pas fait, l'utilisateur ne voit AUCUN changement à l'écran.**


⚠️ **CETTE TÂCHE PORTE LA DÉCISION 14 : L'EXAGÉRATION VERTICALE CONTINUE.** Elle ne peut être portée nulle part ailleurs, et voici pourquoi — vérifié au dépôt.

**Aujourd'hui `params.demExaggeration` n'est pas un réglage d'affichage : c'est un facteur CUIT DANS LA GÉOMÉTRIE**, lu à douze endroits — `terrain.js:2136`, `:2203`, `:2237`, `:2433`, `:2598`, `ocean.js:1243`, `:1500`, `gpx.js:1527`, `main.js:3053`, `:3551`, `:3682`, `:5721`. **Le faire varier en continu sur l'architecture actuelle imposerait de reconstruire la géométrie à chaque image.**

**Le geste juste, et il n'est possible qu'ici :** la fenêtre étant **rééchantillonnée** et non cuite, l'exagération s'applique **au rééchantillonnage**, en fonction de l'altitude de caméra. ⚠️ **La mer, le socle et les tracés GPX doivent lire la MÊME valeur au même instant** — c'est la famille de défauts déjà rencontrée deux fois sur ce dépôt : un réglage écrit d'un côté, jamais transmis à l'autre.

⚠️ **LES VALEURS D'ANCRAGE SONT CELLES D'AUJOURD'HUI, ET ELLES SONT RÉGLABLES PAR L'UTILISATEUR :** `ZOOM_EXAG_DEFAULTS = {3: 2.5, 4: 2.5, 5: 5, 6: 4, 7: 3.2}` (`main.js:3129`), `BASE_EXAG = 2.8` (`main.js:3114`), **plus les surcharges d'Adrien stockées dans `localStorage` sous `monolith.zoomExag`** (`:3130-3138`). **La courbe doit passer par ces points ET honorer les surcharges** — les retirer casserait un réglage qu'il utilise.

**Mesure de contrôle :** aujourd'hui, la largeur de sol visible saute de **×3,661** au passage des crans où l'exagération change ; le résidu se dérive exactement — `exagération(z) / pente = 2,5 / 0,6877 = 3,635`. **Après cette tâche, il doit valoir 1 à la tolérance du pas d'échantillonnage.**

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

- [x] **Étape 1** — test : une fenêtre construite puis auditée par `auditerSolide` est fermée, orientée, sans dégénéré ni NaN. ✅ Et le volume à hauteurs nulles vaut **EXACTEMENT** `côté² × profondeur` = 21 952 — une valeur fermée, pas une tolérance.
- [x] **Étape 2** — le lancer, vérifier qu'il échoue. ⚠️ **HONNÊTEMENT : L'ORDRE N'A PAS ÉTÉ TENU** — le module a été écrit avant le test, et la phase rouge n'a donc pas eu lieu sur l'Étape 1. **Ce qui la remplace, et qui vaut mieux qu'une case cochée : DEUX assertions ont mordu à la première exécution** (le dépassement de la courbe d'exagération, et une assertion FAUSSE du plan lui-même). Voir le bilan.
- [x] **Étape 3** — implémenter : grille régulière propre à la fenêtre, hauteurs cherchées dans le cache en coordonnées de pixel global, parois dont les sommets hauts **sont** les sommets de bord, dalle en éventail sur le même anneau bas.
- [x] **Étape 3 bis — écrire `majHauteurs(fenetre, fluxTerrain)`.** ✅ **2,367 ms par image à n = 384**, tampons identiques par référence, topologie inchangée, aucun `x`/`z` déplacé. ⚠️ **Cette interface est déclarée par la tâche et aucune étape ne la fabriquait.** Test : après une mise à jour, les hauteurs de la fenêtre correspondent au flux, **sans reconstruire la géométrie** — c'est toute sa raison d'être.
- [x] **Étape 4** — test : sur cent emprises tirées au hasard, dont l'antiméridien et au-delà de 85° de latitude, l'audit passe **cent fois** — ⚠️ **et le test de non-vacuité de la Tâche 5 refuse de rendre un verdict sur une géométrie vide.**

⚠️ **SANS CETTE PRÉCISION, LE TEST AUDITE CENT PAVÉS DROITS.** `construireFenetre` seule rend une boîte à hauteurs nulles, fermée et orientée **par construction** : elle passerait l'audit cent fois sans que le rééchantillonnage — la raison d'être de la tâche — soit touché par une seule assertion. **Deux assertions qui mordent** : au moins un sommet intérieur diffère du bord, et la hauteur relevée en un point connu vaut celle du relief bouchonné.
- [x] **Étape 5** — mutation : inverser l'enroulement de la dalle doit tuer le test d'orientation. ✅ **Elle tue la FERMETURE** (`Ā` voit la dalle retournée). ⚠️ **Et la mutation jumelle que ce plan proposait — « un anneau décalé d'un sommet » — NE MORD PAS**, mesuré : `‖Ā‖` relative 1,61e-19. Voir le bilan : cette propriété-là est tenue par la construction, pas par l'audit.
- [x] **Étape 6 — LA CLÔTURE DU §0**, les quatre commandes dans l'ordre, puis commit.

### Tâche 6 bis : LE BRANCHEMENT ⚠️ **DÉCOUPÉE EN DEUX LE 2026-08-21 — 6 bis A FAITE, LA SUITE ÉCRITE EN 6 ter ET 6 quater**

> **Bilan mesuré de la 6 bis A — LE PARTAGE D'EXAGÉRATION** (banc `test/fenetre-branchee.test.js`, 20 tests ; `npm test` **3 264 verts**) :
> · **LES DOUZE LECTEURS SONT BRANCHÉS, ET UN TEST ÉCHOUE SI UN SEUL REVIENT EN ARRIÈRE.** `terrain.js` ×5 (`_makeDemSampler`, `sampleChamp`, `_makeGridSampler`, la plage de palette, `uSeaY`), `ocean.js` ×2, `gpx.js` (`_elevations`), `main.js` ×4 (`socleEmprise`, `altitudeCadrageM`, `echelleVerticaleBloc`, `getEchelle`) passent tous par `lireExageration(params)`. Le détecteur **dépouille les commentaires** — sans quoi il aurait compté comme lecteurs les phrases qui expliquent qu'on ne lit plus, et on aurait fini par supprimer des commentaires pour faire passer un test. ⚠️ **Il a mordu une TREIZIÈME fois, sur mon propre code** : l'initialisation du partage lisait `params.demExaggeration` ; elle lit `EXAG_BASE`, et l'accord des deux valeurs (2,8) est lui-même une assertion.
> · ⚠️ **`params.demExaggeration` EST DEVENU UN ACCESSEUR, PAS UN CHAMP** — un seul emplacement de stockage, `exagPartage.valeur`. Ce n'est pas de l'élégance : les écrivains sont **au moins cinq et dispersés** (`syncExagToZoom`, le curseur `ui/create-panel.js:419`, les `Object.assign(params, look)` des gabarits, la restauration de lien partagé, `SHIBU_START`). Une fonction de synchronisation « à appeler partout où il faut » aurait rendu exactement la classe de défaut qu'on ferme.
> · ⚠️ **UN CYCLE D'IMPORT A OBLIGÉ À DÉMÉNAGER LA COURBE, ET IL NE SE SERAIT VU QU'EN PRODUCTION.** `fenetre-bornee.js` importe `TERRAIN_SIZE` de `terrain.js` ; brancher les cinq lecteurs de `terrain.js` dessus fermait `terrain.js → fenetre-bornee.js → terrain.js`, et `export const COTE_MONDE = TERRAIN_SIZE` se serait évalué en zone morte — **`ReferenceError` au chargement**. Les 29 tests de la Tâche 6 importent `fenetre-bornee.js` en PREMIER : ils ne l'auraient jamais vu, et **aucun test ne charge `main.js`**. Les §6, §7 et §8 vivent donc dans `src/monde/exageration-continue.js`, **au caractère près**, ré-exportés par `fenetre-bornee.js` : ses 29 tests passent sans qu'une ligne y change, et un test exige que le nouveau module **n'importe rien du tout**.
> · ⚠️ **LE POINT FIXE, TROUVÉ AVANT D'ÊTRE ÉCRIT.** La première rédaction pilotait la courbe par `altitudeCadrageM()`, qui **divise par l'exagération** : `exag → altitude → zoom → exag` est une boucle fermée dont le gain vaut **1,44 entre z4 et z5** (mesuré sur la vraie courbe : `courbe'(z) / (ln2 · exag)`), donc elle **DIVERGE**. Le pilote retenu est donc **horizontal** — la largeur de sol visible, que l'exagération verticale ne touche pas. Le test le garde des deux côtés : la fonction n'a aucune entrée d'exagération, et l'itération de la boucle qu'on évite s'écarte pour de vrai.
> · **`zoomCadrage` rend EXACTEMENT le zoom du bloc à la pose d'arrivée**, à 1e-12, pour z de 3 à 15 et cinq latitudes. La dérivation fait tomber `tan(fov/2)` et `span` d'eux-mêmes : `zoomCadrage = log2(mpp0 · cos(lat) · 768 · dRef / (d · extentMeters))`. **Ce n'est donc pas une constante posée à l'instinct** (règle 1 du §0) : c'est une identité.
> · **Décision 14, mesure de contrôle refaite : ×2,0000 au cran z4 → z5, ×1 à 1e-12 après.** Et le plus gros saut d'une image à l'autre sur la descente z4 → z5 (270 images) vaut **×1,00466** — non nul, sinon la courbe serait plate.
> · **Coût du branchement, par image : 0,88 ns par lecture** (médiane de 5 × 2e7 appels, `lireExageration` contre l'accès direct). Deux lectures par image sur le chemin chaud (`altitudeCadrageM`, `getEchelle`) → **0,0000018 ms/image**. ⚠️ **Banc node, pas navigateur, et les deux mesures sont enveloppées dans une fonction fléchée qui pèse 11,85 ns à elle seule** : c'est l'ÉCART qui vaut, pas les valeurs absolues.
>
> ⚠️ **ET VOICI CE QUE L'ÉCRAN A DIT — c'était la première tâche visible de ce plan, et elle a dit non.** Descente Z12 → Z4 sur la Réunion, les deux chemins joués le même soir, tampon de mesure vidé de part et d'autre, valeur lue dans le cartouche « Relief » :
>
> | zoom | production (`?globe=crans`) | régime continu calibré au cadrage |
> |---|---|---|
> | Z12 → Z8 | ×2,8 | ×2,8 |
> | Z7 | **×3,2** | ×2,8 |
> | Z6 | **×4** | ×2,8 |
> | Z5 | **×5** | ×2,8 |
> | Z4 | **×2,5** | ×2,8 |
>
> **Le cran disparaît — et la table d'Adrien avec lui.** La cause est structurelle et elle mérite d'être écrite : **le pilote est la grandeur même que `_rescale` CONSERVE d'un cran à l'autre** depuis la Tâche 2 bis (« reposer la caméra à la même altitude métrique »). Toute exagération qui en dépend est donc continue **et constante**. Ce n'est pas la boucle divergente du §2 de `/threejs-optimisation` : c'est sa jumelle, **un point fixe qui GÈLE au lieu de diverger**, et qui se serait vu comme « le relief ne change plus jamais ».
>
> **Décision, conservatrice exprès :** le régime continu prend **son propre drapeau**, `FLAGS.exagContinue` (`?exag=continu`), **éteint**. `?globe=continu` garde donc les paliers d'aujourd'hui — revérifié à l'écran après la correction : **Z7 ×3,2, Z6 ×4, Z5 ×5, Z4 ×2,5, identiques à la production**, zéro erreur JS. ⚠️ **Un régime mesuré faux ne part pas sous le drapeau qu'on demande à Adrien d'ouvrir.**
>
> **Ce que l'écran montre par ailleurs, à `?globe=continu` :** le socle est intact — parois, chanfrein, coins en superellipse, mer qui l'épouse, ligne de côte, tampon de la Réunion. **Aucune erreur JS neuve dans les deux régimes.** Les seuls défauts réseau sont préexistants et **mesurés des deux côtés** : 2 × `ERR_CONNECTION_TIMED_OUT` (bucket d'altitude injoignable depuis cette machine) et **23 × 404 sur la descente Z12 → Z4, sur le chemin de PRODUCTION comme sur l'autre**. J'ai refait la descente deux fois plutôt que de prendre un défaut d'avant pour ma régression.
>
> · `npm test` **3 264 verts** (3 244 + 20), `audit:tests` **189 listés / 189 sur disque**, `node --check` sur les neuf fichiers modifiés, construction complète verte (`nettoie:dist` → `build:mapcells` → `vite build` → `verifie:dist`).
> · ⚠️ **DEUX ASSERTIONS EXISTANTES ÉPINGLAIENT L'ANCIEN TEXTE** (`escalier-surface.test.js:138`, `mer-emprise.test.js:128`) — c'est le §3 de `/threejs-optimisation` mot pour mot, « la suite verte verrouille le défaut ». Elles sont corrigées **EN PLACE**, le motif seul, avec la raison écrite au-dessus ; **les assertions voisines n'ont pas bougé d'un caractère**.

⚠️ **CE QUE LA 6 bis A NE FAIT PAS, ET IL FAUT LE LIRE AVANT DE CROIRE LA TÂCHE FINIE.** `construireFenetre` / `majHauteurs` **ne sont toujours importés par aucun fichier de production** : le socle est encore RECONSTRUIT à chaque cran, pas rééchantillonné. Les Étapes 1, 2, 4 et 5 de l'énoncé d'origine portent sur ce branchement-là. → **Tâche 6 ter.**

> ⚠️ **MISE À JOUR DU 2026-08-21 — LA 6 ter A FAIT CE BRANCHEMENT, ET LA PHRASE CI-DESSUS N'EST PLUS VRAIE QU'À MOITIÉ.** `construireFenetre` est importé par `src/main.js` et **la fenêtre tient le maillage affiché** derrière `?globe=continu` : **quatorze crans sur quatorze ne reconstruisent plus aucune géométrie**, mesuré à l'écran. **`majHauteurs`, lui, n'est toujours appelé par personne en production** — les hauteurs viennent encore du MNT via l'échantillonneur de `terrain.js`, donc `loadSurface` garde la main sur l'attente réseau. Voir le bilan de la 6 ter.

### Tâche 6 ter : LA FENÊTRE À LA PLACE DU BLOC ✅ **FAITE LE 2026-08-21** — ⚠️ **LE CRAN NE RECONSTRUIT PLUS RIEN, ET LE RESTE DE L'ATTENTE EST AILLEURS**

> **Bilan mesuré** (bancs `test/fenetre-bornee.test.js` ⑨ ×6 et `test/fenetre-branchee.test.js` ⑧ ×6 ; `npm test` **3 276 verts**) :
>
> · ⚠️ **LA PREUVE QU'ADRIEN ATTENDAIT, RELEVÉE À L'ÉCRAN ET PAS AU BANC.** Descente Z12 → Z5 puis remontée Z5 → Z12 sur La Réunion, sonde posée sur `terrain.rebuild` : **quatorze crans sur quatorze gardent le MÊME tampon de positions** (`memeTampon: true` ×14). Le témoin, même geste sur `?globe=crans` : **sept sur sept le reconstruisent** (`memeTampon: false` ×7). **C'est le cran qui disparaît, et il disparaît sur l'écran, pas dans un test.**
>
> · **LE COÛT PAR IMAGE, BOUT EN BOUT — `render()` ET `gl.finish()` COMPRIS**, les deux chemins sur LA MÊME PAGE (⚠️ `?globe=continu` allume aussi le tri spatial du globe : d'un chargement à l'autre `renderer.render` ne dessine pas la même scène, et deux relevés de pages différentes ne se comparent pas). La Réunion z12, 11 répétitions, médiane :
>
> | résolution | production | fenêtre bornée | gain |
> |---|---|---|---|
> | res 384 | **16,5 ms** (15,6–18,6) | **11,5 ms** (11,1–12,5) | **−5,0 ms, −30,3 %** |
> | res 768 | **64,7 ms** (62,5–67,3) | **44,6 ms** (43,9–46,5) | **−20,1 ms, −31,1 %** |
>
> ⚠️ **ET LE CHRONOMÈTRE POSÉ AUTOUR DU SEUL CALCUL NE VOIT RIEN DE CE GAIN** — §3 de `/threejs-optimisation`, mot pour mot. `terrain.rebuild` seul coûte **39–51 ms** sous la fenêtre contre **44–55 ms** en production : à peine distinguable. **Tout l'écart est dans le téléversement** d'un tampon neuf contre un tampon marqué sale, et il ne se lit qu'en encadrant jusqu'à `render()`.
>
> · **`majHauteurs` REJOUÉ IN SITU, SUR LE VRAI FLUX** (navigateur, quadtree réel, La Réunion, `zoomEffectif` 13, **0 manquant**, 15 répétitions, médiane) — et ⚠️ **le chiffre du banc node de la Tâche 6 était optimiste** :
>
> | | banc node (Tâche 6) | in situ, navigateur | dont `remplirHauteurs` | dont `appliquerHauteurs` | dont `gridNormals` |
> |---|---|---|---|---|---|
> | n = 256 | 1,040 ms | **2,5 ms** | — | — | — |
> | n = 384 | 2,367 ms | **3,5 ms** | 1,8 ms | 1,7 ms | **1,2 ms** |
> | n = 768 | 9,094 ms | **13,7 ms** | 7,0 ms | 6,5 ms | **4,5 ms** |
>
> **×1,48 à n = 384**, et les normales — qui n'existaient pas quand la Tâche 6 a mesuré — en sont **1,2 ms sur 3,5**. ⚠️ **Le contrôle croisé tombe juste, et il est indépendant** : `grid-normals.js` annonce **4,6 ms à res 768** mesurés sur la géométrie affichée ; ce banc-ci rend **4,5 ms** sur une fenêtre, par un tout autre chemin. **Et `computeVertexNormals()` aurait coûté 83,8 à 120,5 ms au même endroit** — le cran remis, en un appel.
>
> · ⚠️ **`rayonCoin = 0` AU BRANCHEMENT, ET C'EST UNE MESURE QUI L'A DÉCIDÉ, PAS UN GOÛT.** La forme fermée de `gridNormals` suppose un pas RÉGULIER ; `versEmpreinte` contracte la grille sur la superellipse dans les quatre pavés de coin. Écart à `computeVertexNormals`, réglage de PRODUCTION du coin (2,24 / 4,4) : **63,1° au pire et 4,49° en moyenne sur 1 024 sommets à n = 384** (27,9° / 3,55° à n = 64), et **1,47° même hors des pavés**, sur leurs voisins immédiats. À coins vifs : **0,022 °** — l'arrondi Float32, rien d'autre. **Le test ⑨d MESURE ce défaut au lieu de le supposer**, et exige qu'il reste grand : le jour où quelqu'un branchera la fenêtre à coins arrondis, il faudra l'avoir lu. La forme du coin reste donc celle de `plinth.js`, exactement comme aujourd'hui.
>
> · **À `rayonCoin = 0`, LA NAPPE DE LA FENÊTRE EST LE GABARIT DE `gridTemplate`, BIT POUR BIT** — `x`, `z`, `uv` ET index. ⚠️ **L'assertion a MORDU à la première exécution** : la fenêtre émettait son second triangle en `d,b,c` là où `grid-template.js:114` écrit `b,c,d` — même triangle, même enroulement, même normale, **mais pas le même tampon d'index**. Corrigé dans le module. C'est exactement le « deux tampons équivalents qui divergent sans bruit » que ce plan poursuit.
>
> · **ET LES DEUX CHEMINS PEIGNENT LE MÊME BLOC, VÉRIFIÉ ATTRIBUT PAR ATTRIBUT** (test ⑧c, et banc `.banc/compare-chemins.mjs`) : `position`, `normal`, `color`, `uv` et l'index **identiques à zéro d'écart**, `uHeightRange` et `uSeaY` identiques. ⚠️ **Trois composantes de `color` sortent NaN — des DEUX côtés** : `Math.pow(hn, 0.85)` avec `hn < 0` dans `terrain.js:_ecrireRelief`, un défaut **préexistant** que ce branchement n'a ni créé ni corrigé. Le test le constate au lieu de le masquer.
>
> · **`uv` posée UNE FOIS** (elle ne dépend que des `x`/`z`, qui ne bougent jamais), **normales réécrites EN PLACE**, `assert.equal` par identité de référence. ⚠️ **Et une découverte à écrire** : sur le chemin de production, `uv` était **déjà** partagé d'un cran à l'autre — `gridTemplate` mémorise son gabarit. Le test ⑧a le dit, pour qu'on ne croie pas que la 6 ter l'a gagné.
>
> · ⚠️ **LA JUPE PARTAGE SES SOMMETS, DONC SES NORMALES.** Le sommet haut d'une paroi **est** le sommet de bord de la nappe (c'est ce qui rend la couture exacte au bit près) : il porte la normale de la nappe, et la paroi se lirait comme un congé. **Sous ce branchement la jupe n'est pas dessinée du tout** — `setDrawRange` borne le tirage aux `trianglesNappe`, et `plinth.js` continue de fournir le socle affiché. **Le damier n'est pas touché** : `block-grid.js:768` appelle toujours `buildSlabWalls`, les 13 fichiers `damier-*.test.js` sont verts.
>
> · **CE QUE L'ÉCRAN A DIT, DEUX CHARGEMENTS PLUS TARD** : le socle de La Réunion à Z12 sous `?globe=continu` est **indiscernable** de celui de `?globe=crans` — relief éclairé, palette, courbes de niveau, grain, trait de côte, bathymétrie, parois, chanfrein, **coins en superellipse**, mer qui épouse le socle, tampon « RÉUNION ». **Rien de laid, rien de neuf.** C'est ce qu'on voulait : le cran part, l'image ne bouge pas. Vérifié aussi que ce qui est à l'écran EST bien la fenêtre — `position.array === fenetre.geometrie`, 594 434 sommets (769² + 4×768 + 1), `drawRange` 3 538 944 = 768²×6.
>
> · **Les défauts réseau sont préexistants et mesurés des DEUX côtés**, comme la 6 bis A l'exige : `ERR_CONNECTION_TIMED_OUT` (le bucket d'altitude injoignable depuis cette machine) et une vingtaine de 404 par descente, **identiques sur `?globe=crans`**. **Aucune erreur JS neuve, sur aucun des deux chemins.** J'ai refait la descente deux fois.
>
> · `npm test` **3 276 verts** (3 264 + 6 + 6), `audit:tests` **189 listés / 189 sur disque**, `node --check` sur les cinq fichiers modifiés, construction complète verte (`nettoie:dist` → `build:mapcells` → `vite build` → `verifie:dist`).
>
> · ⚠️ **UNE ASSERTION EXISTANTE A DÛ ÊTRE CORRIGÉE EN PLACE, ET ELLE AVAIT RAISON DE MORDRE** : `fenetre-branchee.test.js` ①b comptait **douze** lecteurs de l'exagération et en a vu **treize**. Le treizième est `terrain.fabriqueFenetre` dans `main.js`, qui passe `lireExageration(params)` à `construireFenetre` — **sans lui la fenêtre aurait sa PROPRE échelle verticale**, c'est-à-dire exactement le réglage écrit d'un côté et jamais transmis à l'autre que ce test existe pour interdire. Le compte de `main.js` passe de 4 à 5 ; **les trois autres lignes n'ont pas bougé d'un caractère**.
>
> #### ⚠️ CE QUE CETTE TÂCHE NE FAIT PAS, ET IL FAUT LE LIRE AVANT DE CROIRE LE CRAN MORT
>
> 1. ⚠️ **LES HAUTEURS NE VIENNENT PAS ENCORE DU FLUX.** Sous le branchement, `terrain.js` remplit les `y` avec SON échantillonneur, depuis `this.dem` — donc **`loadSurface` garde la main sur le moment où un cran aboutit**. Ce que la 6 ter supprime, c'est la **reconstruction de géométrie** (et son téléversement) ; ce qu'elle ne touche pas, c'est l'attente réseau du MNT — les **7,88 s sur 30** que le §6 chiffre depuis le début et qu'aucune des quatorze tâches ne prend. `majHauteurs(fenetre, flux)` est prêt, mesuré in situ ci-dessus, et **appelé par personne en production**. → tâche suivante.
> 2. **Le grain, la palette et `uHeightRange` restent à `terrain.js`**, et c'est un arbitrage écrit (§10 de `fenetre-bornee.js`) : les recopier dans la fenêtre ferait une SECONDE source de vérité pour la couleur.
> 3. **`majResFenetre` (mode 3×3, `?f3=1`) alloue toujours** une géométrie neuve : hors périmètre, et son drapeau est éteint.
> 4. **Rien n'a été mesuré sur un portable**, et **aucune image EN MOUVEMENT** n'a été chronométrée — les deux manques que le §10 traîne depuis le prototype.
> 5. **La décision 5 n'est pas exécutée** : `contourSocle` existe, `optionsSocle` transporte les sept options, mais personne n'appelle `buildSlabWalls` à l'arrêt sur le contour de la fenêtre. Le socle affiché reste celui de `plinth.js`, et c'est très bien tant que la nappe est identique.

**Fichiers :** modifier `src/monde/fenetre-bornee.js`, `src/terrain.js`, **`src/main.js`** *(⚠️ le plan l'oubliait : `terrain.js` NE PEUT PAS importer `fenetre-bornee.js` — ce serait le cycle `terrain.js → fenetre-bornee.js → terrain.js`, celui que la 6 bis A a déjà payé. La fenêtre est donc fabriquée et posée depuis `main.js`, et `Terrain` ne connaît d'elle que la forme de ses champs.)* · tester `test/fenetre-branchee.test.js` (élargir) et `test/fenetre-bornee.test.js` (élargir)

⚠️ **LE PLAN APPELAIT ÇA « LE BRANCHEMENT », COMME S'IL SUFFISAIT D'IMPORTER. C'EST FAUX, ET C'EST VÉRIFIABLE EN TRENTE SECONDES :** `construireFenetre` rend `{ geometrie, indices }` — **des positions et des index, rien d'autre**. Pas de `normal`, pas de `uv`, pas de `color`. Or le maillage de production porte les quatre, et son matériau lit `uHeightRange`, `uSeaY`, les masques et l'emprise. **Poser la fenêtre à la place du bloc aujourd'hui donnerait une forme sans relief éclairé ni palette** — et le module n'est pas en cause : la Tâche 6 avait pour périmètre la COQUE, et elle l'a livrée, prouvée et mutée.

⚠️ **ET LES NORMALES NE SE RATTRAPENT PAS PAR `computeVertexNormals()`** : `terrain.js` les écrit à la main précisément parce que cet appel pesait **81 % de la fabrication d'une dalle — 83,8 ms mesurés à Chamonix** (in situ, commentaire de `terrain.js`). L'appeler par image coûterait plus de **cinq fois** le budget d'une image à 60 Hz : il remettrait le cran qu'on enlève. **`src/grid-normals.js` (`gridNormals`) existe et fait ce travail sur une grille régulière — c'est lui qu'il faut brancher, pas three.js.**

- [x] **Étape 1** — test : `majHauteurs` met à jour **normales comprises**, toujours **sans réallouer** — comparaison des tampons par IDENTITÉ DE RÉFÉRENCE, comme la Tâche 6. ✅ `fenetre-bornee.test.js` ⑨b, et `fenetre-branchee.test.js` ⑧b pour le maillage AFFICHÉ.
- [x] **Étape 2** — le lancer, vérifier qu'il échoue. ✅ ⚠️ **REJOUÉ CONTRE LE DÉPÔT AVANT D'ÊTRE ÉCRIT** (`.banc/rejeu-cran.mjs`, hors dépôt) : sur un `Terrain` réel sous node, après un cran, `geometry`, `position.array` et `normal.array` sont **tous les trois des objets neufs**. ⑧a garde ce constat comme TÉMOIN, pour que ⑧b ne puisse pas passer sur un dépôt où plus rien ne se reconstruirait. ⚠️ **HONNÊTEMENT, la phase rouge n'a pas eu lieu sur ⑨** — le module a été écrit avant ses tests, comme à la Tâche 6. **Ce qui la remplace vaut mieux qu'une case cochée : ⑨a a MORDU à la première exécution** et a forcé une vraie correction du module (l'ordre des index, `d,b,c` → `b,c,d`).
- [x] **Étape 3** — implémenter : `uv` posées une fois par `construireFenetre` (elles ne dépendent que des `x`/`z`, qui ne bougent jamais), normales rafraîchies par `gridNormals` dans `appliquerHauteurs`. ✅ Plus les normales de la JUPE, posées une fois elles aussi (§10 du module).
- [x] **Étape 4** — brancher derrière `FLAGS.globeContinu`, le chemin du bloc intact pour la production, et **mesurer le coût par image BOUT EN BOUT, `render()` compris** — ⚠️ §3 de `/threejs-optimisation` : le téléversement des sommets au GPU est HORS d'un chronomètre posé autour du calcul, et il pèse 1,54 Mo par image. ✅ **−30,3 % à res 384, −31,1 % à res 768**, et **le chronomètre posé autour du seul calcul ne voit rien de ce gain** — voir le bilan.
- [x] **Étape 5 — mutation** : réintroduire une reconstruction doit tuer le test de l'Étape 1. ✅ Deux mutations, une par étage : ⑨f réalloue le tampon de normales, ⑧e fait rendre `null` au point de décision du branchement (« remettre le gabarit »).
- [x] **Étape 6 — REGARDER L'ÉCRAN**, descendre du globe au socle, et dire ce qu'on voit, y compris si c'est laid. ✅ **Elle a dit oui**, et c'est la première fois de ce plan : quatorze crans sans une seule reconstruction, socle indiscernable de la production. Voir le bilan.
- [x] **Étape 7 — LA CLÔTURE DU §0**, les quatre commandes dans l'ordre, puis commit.

### Tâche 6 quater : LE PILOTE DE L'EXAGÉRATION CONTINUE ⚠️ **UNE MESURE À L'ÉCRAN L'A OUVERTE**

**Fichiers :** modifier `src/main.js`, `src/monde/exageration-continue.js`, `src/flags.js` · tester `test/fenetre-branchee.test.js` (élargir)

⚠️ **LE DÉFAUT EST MESURÉ, PAS SUPPOSÉ** — voir le tableau Z12 → Z4 du bilan ci-dessus, recopié dans `flags.js` à côté du drapeau. Le pilote actuel (la largeur de sol visible) est **conservé par `_rescale`**, donc l'exagération gèle à ×2,8 partout.

**La piste, et elle ne peut pas geler par construction :** piloter par **la fraction de trajet entre deux crans** — `zc = params.demZoom + f`, avec `f ∈ [0,1[` mesurée sur ce qui DÉCLENCHE le cran (`_levelZoom`, `STEP_OUT`, `modes.js`), et non sur une grandeur que le cran remet en place. Au déclenchement `f → 1` pendant que `demZoom → demZoom+1` : **continu par construction**, et **borné à `[z, z+1]`**, donc il traverse les ancres au lieu de se garer dessus.

⚠️ **À VÉRIFIER AVANT D'ÉCRIRE UNE LIGNE, ET LE §0 L'EXIGE :** que `f` atteigne bien 1 au déclenchement. Si le cran part à `f = 0,8`, il reste un saut de `courbe(z+1) − courbe(z+0,8)` — plus petit que ×2, mais un saut quand même. **Mesurez-le sur le vol de référence avant de conclure.**

- [ ] **Étape 1** — test : sur une descente z3 → z13 échantillonnée à 60 Hz, **aucun rapport d'une image à l'autre ne dépasse la tolérance du pas**, ET la courbe **passe par les ancres**. ⚠️ **Les deux moitiés, sinon le test se contente d'une constante** — c'est exactement ce qui vient d'arriver.
- [ ] **Étape 2** — le lancer, vérifier qu'il échoue (le pilote d'aujourd'hui rend une constante : c'est la SECONDE moitié qui doit mordre).
- [ ] **Étape 3** — implémenter, puis **rejouer la descente Z12 → Z4 à l'écran** et remplir la troisième colonne du tableau.
- [ ] **Étape 4** — allumer `FLAGS.exagContinue` **seulement si la colonne est juste**, et pas avant.
- [ ] **Étape 5 — LA CLÔTURE DU §0**, les quatre commandes dans l'ordre, puis commit.

### Tâche 6 bis — L'ÉNONCÉ D'ORIGINE, CONSERVÉ ⚠️ C'EST ELLE QUI SUPPRIME LES CRANS À L'ÉCRAN

⚠️ **CET ÉNONCÉ EST GARDÉ ENTIER PARCE QUE SA MOITIÉ NON FAITE EST TOUJOURS JUSTE.** Ce qui est livré est en tête de section (6 bis A) ; ce qui reste est en 6 ter et 6 quater. **On élargit, on ne remplace pas.**

**Fichiers :** modifier `src/main.js`, `src/terrain.js`, `src/ocean.js`, `src/gpx.js` · tester `test/fenetre-branchee.test.js` (créer)

⚠️ **TOUTES LES BRIQUES SONT LIVRÉES ET AUCUNE N'EST BRANCHÉE.** `src/monde/` porte cinq modules complets, prouvés, mutés — et **importés par aucun fichier de production**. Tant que ce branchement n'est pas fait, **Adrien ne voit rien changer à l'écran** : le bloc est toujours reconstruit à chaque cran, et l'exagération saute toujours.

**Ce que le branchement doit produire, et c'est le but de tout ce plan :**

1. **Le socle cesse d'être RECONSTRUIT et devient RÉÉCHANTILLONNÉ.** `majHauteurs` met à jour les hauteurs **en place** — aucune allocation, aucune retriangulation, aucun sommet déplacé. Mesuré **2,367 ms/image à n=384** contre **8,7 ms** pour la reconstruction du dépôt. ⚠️ **Ce n'est pas seulement 3,7 fois moins cher : c'est une mise à jour au lieu d'une cuisson, donc il n'y a plus rien à attendre quand la caméra descend.**
2. **L'exagération verticale devient continue** (décision 14). Mesuré : **×2,0000 au cran z4→z5 aujourd'hui, ×1,003966 après**.
3. **Le cran disparaît** : `_refine` / `_coarsen` / `_rescale` n'ont plus de bloc à recharger.

⚠️ **LE PIÈGE PRINCIPAL, ET IL A DÉJÀ MORDU DEUX FOIS SUR CE DÉPÔT : UN RÉGLAGE ÉCRIT D'UN CÔTÉ ET JAMAIS TRANSMIS À L'AUTRE.** `params.demExaggeration` est lu à **douze endroits** — `terrain.js` ×5, `ocean.js` ×2, `gpx.js`, `main.js` ×4. **Les douze doivent lire `partage.valeur` du même partage, au même instant.** La Tâche 6 a livré `creerExagerationPartagee` / `majExageration` exactement pour ça : **un écrivain, N lecteurs.**

⚠️ **ET LES SURCHARGES D'ADRIEN DOIVENT SURVIVRE** : `localStorage` sous `monolith.zoomExag` (`main.js:3130-3138`). La courbe passe par les ancres **et** honore les surcharges — les retirer casserait un réglage qu'il utilise.

⚠️ **NE TOUCHE PAS AU DAMIER.** `block-grid.js:768` appelle `buildSlabWalls`, avec **13 fichiers `test/damier-*.test.js` et 243 tests à empreintes bit à bit**. La Tâche 6 a délibérément laissé `plinth.js` et `ocean.js` intacts pour cette raison. `contourSocle(fenetre)` est le pont prévu vers `buildSlabWalls` **à l'arrêt** (décision 5 : la gravure ne s'écrit qu'à l'arrêt).

- [x] **Étape 1 — le test qui échoue** ✅ **FAITE PAR LA 6 ter LE 2026-08-21** — un changement de cran en mode surface **ne reconstruit aucune géométrie**, l'identité des tampons de position est conservée (`fenetre-branchee.test.js` ⑧b, témoin ⑧a). ⚠️ **Rejouée contre le dépôt AVANT d'être écrite** — `.banc/rejeu-cran.mjs` : les trois tampons étaient neufs.
- [x] **Étape 2** — le lancer, vérifier qu'il échoue.
- [x] **Étape 3 — le partage d'exagération** ✅ **FAITE** — douze lecteurs, un accesseur, un cycle d'import évité, ses douze lecteurs, et un test qui **échoue si un seul lit encore `params.demExaggeration`**.
- [x] **Étape 4 — brancher la fenêtre** ✅ **FAITE PAR LA 6 ter LE 2026-08-21** — normales et `uv` ajoutées au module, fenêtre posée derrière `FLAGS.globeContinu` depuis `main.js` (⚠️ **pas depuis `terrain.js` : le cycle d'import**), chemin du bloc intact pour la production. ⚠️ **Les hauteurs viennent encore du MNT, pas du flux** — voir « ce que cette tâche ne fait pas » dans le bilan de la 6 ter.
- [x] **Étape 5 — mutation** ✅ **FAITE POUR L'EXAGÉRATION** (①d, ②c, ③) ; ✅ **et la moitié « reconstruction » est faite par la 6 ter** — ⑨f réalloue le tampon de normales, ⑧e fait rendre `null` au point de décision du branchement.
- [x] **Étape 6 — REGARDER L'ÉCRAN.** ✅ **FAITE, ET ELLE A DIT NON** — voir le tableau Z12 → Z4 du bilan ⚠️ **C'est la première tâche de ce plan dont le résultat est VISIBLE. Charge la page, descends du globe au socle, et dis ce que tu vois** — y compris si c'est laid.
- [x] **Étape 7 — LA CLÔTURE DU §0**, les quatre commandes dans l'ordre, puis commit.


### Tâche 7 : les deux résolutions et la zone morte

⚠️ **CETTE TÂCHE RÉINVENTE `src/fenetre-finesse.js`, QUI EXISTE DÉJÀ** — module pur, testable sous node : `pasFinesse`, `resDeFinesse`, `REPOS_S = 0,4`, `V_REPOS = 2`, `RES_REPOS_MAX = 768`, plus `Terrain.resMaillage` (`terrain.js:2016`) et `RES_FENETRE_CONTINUE = 384` (`terrain.js:61`). ⚠️ **Nuance que ce plan a écrite trop fort : il n'est PAS « en production » — `flags.js:25` porte `fenetreContinue: false`, et `terrain.js:2017` est court-circuité hors `?f3=1`.** Il est fusionné et testé, pas actif. **Trancher : étendre ou remplacer.**

⚠️ **Et ses chiffres sont faux contre le dépôt :** les résolutions `128 | 256` sont **trois fois sous la production** (384 / 768), et le budget « 1,7 / 8,3 ms » vient d'un prototype **sans socle**, alors que ce dépôt mesure **5,5 / 8,7 / 14,6 / 24,5 ms** (script rejouable cité en `plinth.js:876`).

⚠️ **ET IL Y A 1 516 ms DE GEL QUE CETTE TÂCHE IGNORAIT.** `fenetre-finesse.js:135-149` les mesure : bascule vers 768 **à champ non cuit**, 1,5 s de gel arrivant 0,4 s après que la carte s'est posée, **sans que l'utilisateur ait touché à quoi que ce soit**. La cuisson est **incompressible** (285 ns le point, 5,31 M points) ; **ce qui est déplaçable, c'est le moment** — et le fichier dit lequel : « sous le voile de chargement ». ⚠️ **Or la Tâche 2 retire ce voile. Les deux tâches se contredisent : tranchez.**

⚠️ **ET LE MÊME COMMENTAIRE PRÉVIENT QUE « UN BANC SYNTHÉTIQUE NE L'AURAIT PAS VU — le module pur bascule en zéro milliseconde ».** Cette tâche prescrit précisément un module pur. **Le test de résolution ne verra donc pas le défaut le plus visible de la fonctionnalité.** Prévoyez-en un second, sur le chemin réel.

⚠️ **L'invariant que ce dépôt a payé pour apprendre : socle et maillage à la même résolution, sinon ils se décollent** (`plinth.js:865-879`).

**Fichiers :** ⚠️ **modifier `src/fenetre-finesse.js` et `src/terrain.js` — PAS créer un module neuf** (ou écrire ici pourquoi on les remplace) · modifier `src/monde/fenetre-bornee.js` · tester `test/fenetre-resolution.test.js` **et les sept fichiers de test de la fenêtre continue**

**Interfaces produites :**
- `resolutionPour({ enMouvement, resVoulue })` → `number` — ⚠️ **la signature porte `resVoulue`, sans quoi la fonction ne peut pas respecter le choix de l'utilisateur.** Une version de ce plan déclarait `{ enMouvement }` seul tout en l'assertant avec `resVoulue` : **la déclaration et l'assertion se contredisaient.** ⚠️ **Et PAS `128 | 256` : trois fois sous la production.**
- `empriseADerive(precedente, courante)` → `boolean` — vrai si le cadrage a bougé assez pour justifier une reconstruction. **Seuil de départ : 2 % de la diagonale de l'emprise.** ⚠️ **Non sourcé — mais le vrai défaut n'est pas là.**

⚠️ **UN POURCENTAGE DE DIAGONALE CHANGE DE SENS À CHAQUE ZOOM** : 2 % valent **200 m sur z13 et 51 m sur z15**, alors qu'une maille à N=128 vaut environ **80 m**. Le même seuil est donc tantôt plus grossier, tantôt plus fin que la maille qu'il est censé protéger. **Exprimez-le en MAILLES, pas en pourcentage** — c'est la seule unité qui garde le même sens à tous les zooms.

**Protocole :** balayer de **0,25 à 4 mailles**, relever les reconstructions par seconde (médiane et p90) **et le retard de l'emprise à l'arrêt de la caméra** — c'est ce second chiffre qui borne par le haut.

**Mesuré :** N=256 coûte **8,3 ms de médiane** — au-dessus du budget d'une image à 60 Hz, sur une machine très au-dessus de la cible, et **sans mer ni palette ni gravure**. N=128 coûte **1,7 ms**.

⚠️ **Le prototype reconstruisait à CHAQUE image** — le pire cas imaginable. La zone morte est ce qui rend la décision 4 tenable.

⚠️ **RAPPEL DE LA DÉCISION 13, PARCE QUE C'EST ICI QU'ON EST TENTÉ DE L'ENFREINDRE.** Baisser à N=128 pendant le mouvement **rend l'image plus grossière pendant qu'on bouge**. C'est voulu, Adrien l'a validé, et c'est le contrat. **Ne compensez pas** en forçant N=256 dès que « ça a l'air lent » : vous reprendriez les 8,3 ms et les 12 % de dépassement que cette tâche existe pour éviter.

- [ ] **Étape 1** — test : `resolutionPour({ enMouvement, resVoulue })` **ne dépasse JAMAIS `resVoulue`**, et **rend une résolution de mouvement STRICTEMENT INFÉRIEURE à celle de repos DÈS QUE `resVoulue` dépasse le plafond de mouvement**. ⚠️ **CE PLAN A ÉCRIT DEUX ASSERTIONS FAUSSES DE SUITE, ET AUX MÊMES VALEURS.** « rend 384 et 768 » est faux à `resVoulue` 256 et 384 ; « strictement inférieure au repos » est faux à 128, 256 **et** 384 — parce que `min(resVoulue, plafond)` est alors **égal** des deux côtés. **Le module existant plafonne au choix de l'utilisateur, et c'est voulu** : `resDeFinesse` porte en toutes lettres « ne pas servir `params.resolution` tel quel », et un utilisateur qui choisit 256 doit obtenir 256. **384 et 768 sont les valeurs par DÉFAUT (`RES_FENETRE_CONTINUE`, `RES_REPOS_MAX`), pas un contrat.** ⚠️ **Rejouez votre assertion contre `resDeFinesse` du dépôt AVANT de l'écrire — les deux versions précédentes ne l'ont pas fait.** Une dérive d'emprise sous le seuil ne déclenche **aucune** reconstruction, et **socle et maillage restent à la même résolution** (`plinth.js:865-879`).
- [ ] **Étape 1 bis — `empriseADerive`, ET C'EST LA DERNIÈRE INTERFACE ORPHELINE DU PLAN.** ⚠️ La correction précédente a pourvu les cinq de la Tâche 4 bis et **laissé celle-ci à côté** : elle n'apparaissait qu'à sa déclaration et au §10, sans une seule étape. Test : deux emprises séparées de moins d'une maille rendent `false`, au-delà `true`, **et le seuil s'exprime en mailles** (voir ci-dessus).
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

**Phase 5 — les données.** ⚠️ **`src/canopee.js` EXISTE DÉJÀ et streame par tuile avec manifeste** (`CANOPEE_ZOOM_MAX = 14`, `:67`) — **ne le réinventez pas.** ⚠️ **Et son plafond z14 est SOUS le socle z15/z16 : c'est un déficit à traiter, pas un détail.** **GLOBathy** (1,4 M de plans d'eau, 30 m, **CC0**) reste à récupérer — voir §9.

**Phase 6 — la dépose de l'ancien.** ⚠️ **CELLE-CI NE DEVRAIT PAS ÊTRE REPORTÉE : elle est chiffrable aujourd'hui et ne dépend d'aucune mesure de la Phase 2** — « une partie des 3 062 tests » se compte : **11 fichiers, 193 tests, environ 20 secondes.** ⚠️ **Et `escalier-zoom.js` ne se retire PAS** : `main.js:31` en importe **trois** symboles — `intersectionGlobe`, `viseeArrivee` **et `ZOOM_PALIER_MIN`** — sans rapport avec les paliers. ⚠️ **Et `pasEscalier`, qu'une version de ce plan mettait sur la liste des condamnés, survit par `modes.js:80` : il fait tourner l'escalier de surface que la Tâche 2 bis CONSERVE.** Seuls `bornesEscalier`, `paliersRetenus` et `palierDeClic` s'en vont, **et seulement si rien d'autre ne les appelle — vérifiez-le.** Reste : nouveau format de partage, reprise des gabarits.

---

## 9. Ce qu'Adrien doit trancher en chemin

- ✅ **TRANCHÉ PAR ADRIEN LE 2026-08-20 — CE QUE L'UTILISATEUR VOIT QUAND LE RÉSEAU NE SUIT PAS : UN INDICATEUR DISCRET.** Pas de voile, pas de message bloquant, pas de silence total : un signe non bloquant qui dit que le détail arrive. ⚠️ **Il remplace les 2,6 s de voile que `main.js:3413-3416` pose aujourd'hui alors que l'application est déjà libre** *(⚠️ le plan écrivait « 3408-3411 » ; vérifié le 2026-08-21, le `setTimeout(…, 2600)` est aux lignes 3413-3416 et `demBusy = false` à la ligne 3418, dans le `finally` qui s'exécute tout de suite — le repère a bougé, la thèse est exacte)*. À dessiner dans la Tâche 2, et à réutiliser par la Tâche 4 ter : **son ÉTAT est fabriqué et testé** (`etatIndicateur`, `src/monde/descente-bornee.js`), **son DESSIN reste à faire**.
- ✅ **TRANCHÉ PAR LA TÂCHE 3 LE 2026-08-21 — LE SOCLE NAÎT QUAND MÊME, À LA RÉSOLUTION DISPONIBLE.** Il **naît sur une altitude** (R1) et **se remplit à un zoom** que le réseau borne (R3) ; **ce qui varie est le remplissage, jamais l'emprise.** Il n'attend pas — attendre est le pop-up déguisé en absence — et **le seuil ne se décale pas** : le débit observé se dégrade quand le socle demande ses tuiles, donc un seuil qui en dépendrait fermerait la boucle « socle → trafic → débit → seuil → socle », ⚠️ **l'oscillateur que R1 interdit, mot pour mot.** Ce que l'utilisateur voit reste l'indicateur discret ci-dessus. **Dérivation et chiffres dans le bilan de la Tâche 3.**
- ✅ **TRANCHÉ PAR ADRIEN LE 2026-08-20 — LE ZOOM EST CONTINU, « exactement comme Google Earth ou Google Maps ».** La téléportation au point de présentation de `modes.js:455-458` (v48) **disparaît** : l'altitude redevient continue d'un cran à l'autre. ⚠️ **v48 remplaçait une continuité v42 qui avait été retirée, et la raison de ce retrait n'est pas écrite dans le code.** Le garde-fou est donc le test de la Tâche 1a-1b : **altitude monotone, dérivée seconde bornée, et arrivée au zoom demandé.** Si le défaut de v42 reparaît, il sera visible à ces trois assertions — **et non plus masqué par un rideau blanc.**
- ⚠️ **LES PALIERS D'EXAGÉRATION VERTICALE — NOUVELLE QUESTION, OUVERTE PAR LA MESURE DE LA TÂCHE 1b, ET ELLE COÛTE DEUX CHOSES À LA FOIS.** La table `{3: 2,5 · 4: 2,5 · 5: 5 · 6: 4 · 7: 3,2 · 2,8 ensuite}` (`ZOOM_EXAG_DEFAULTS`, `main.js`) existe pour que le relief reste visible sur un bloc large. Elle facture deux discontinuités, mesurées :
  1. **le champ visuel saute de `exagération(z)` à la plongée** (×3,66 au lieu de ×1 au Mont-Blanc) — l'altimètre est continu, le CADRAGE ne l'est qu'à moitié ;
  2. **le cran z4 → z5 rend ×4 de distance là où le budget du niveau n'en dépense que ×2**, et il dépasse la butée de 150 unités (×1,32 à ×1,81 selon la latitude et l'altitude de départ).

  **Trois issues, et Adrien seul peut trancher entre les deux premières** : (a) **exagération constante** — les deux discontinuités disparaissent d'un coup, le relief des blocs larges s'aplatit ; (b) **paliers conservés** — on garde le rendu et on assume les deux sauts ; (c) **retirer l'exagération de l'altitude de CADRAGE seulement** (elle resterait à l'affichage et au rendu) — cela ferme (1), mais **invalide les onze sauts mesurés à la Tâche 1a** et impose de refaire tout le relevé. ⚠️ **Ce n'est pas une question de goût seule : c'est aussi le seul nombre sur lequel la Tâche 1b bis et la Tâche 2 bis se croisent.**
- ✅ **TRANCHÉ PAR ADRIEN LE 2026-08-20 — L'EXAGÉRATION VERTICALE DEVIENT UNE COURBE CONTINUE DE L'ALTITUDE** (décision 14). Portée par la **Tâche 6**, seule capable de la tenir : ailleurs, elle imposerait de reconstruire la géométrie à chaque image.
- **L'effet de transition** globe → socle
- **La récupération de GLOBathy** : Earth Engine impose un compte et des conditions commerciales à vérifier ; le dépôt de l'article est peut-être la meilleure porte.
- **Le trait de côte au-delà de z15.** Mesuré : autour d'un bloc z16 à Brest, les polygones OSM pré-simplifiés à 30 m ne donnent que **51 segments pour 1,2 km de côté** *(le côté du bloc — ce plan écrivait « de côte », ce qui en faisait une longueur de rivage)* — médiane 123 m, pointes à 849 m. Rasterisés à 0,79 m la cellule, ils dessineraient un rivage à facettes. Soit on branche le champ processeur au-delà de z15, soit on raffine la donnée. **Le second est une décision de données, pas de code.**
- **Le déploiement de la mer corrigée.** ⚠️ **Ce plan écrit ailleurs que « le gain n'est pas visuel aujourd'hui » : les deux ne peuvent pas être vrais.** Ce qui est établi : la correction ajoute 13 162 cellules de mer à Bergen sans en perdre aucune. **Qu'elle se voie ou non à l'écran est précisément ce qu'il faut regarder avant de déployer** — c'est la décision d'Adrien, pas une affirmation du plan.

## 10. Auto-revue

**Couverture — et elle n'est pas complète, c'est écrit en tête du §6.** La **décision 1** (caméra continue) et la **suppression du voile** ont désormais leurs Tâches 1, 2 bis et 2. ⚠️ **Restent QUATRE décisions sans porteur, pas deux** : la **5** (la gravure ne s'écrit qu'à l'arrêt), la **6** (format d'impression à l'export), la **7** (mer, météo, cycle du jour en mode socle uniquement) et la **11** (60 img/s sur portable) — **elles n'existent qu'à la ligne où on les a votées.** Et `src/palier-machine.js`, le module qui fait déjà ce tri de matériel dans ce dépôt, n'est cité nulle part.


**Cohérence des noms** — employés à l'identique partout, ⚠️ **et cette liste était aveugle exactement aux cinq interfaces que la Tâche 4 bis déclarait sans jamais les fabriquer** : `socleVisible`, `empriseSocle`, `SEUIL_NAISSANCE_M`, `SEUIL_MORT_M`, `creerFlux`, `demanderEmprise`, `tuilesPretes`, `zoomEffectif`, `remplirHauteurs`, `PLAFOND_FILE`, `debitObserve`, `auditerSolide`, `construireFenetre`, `majHauteurs`, `resolutionPour`, `empriseADerive`, `zoomSoutenable`, **et les cinq que la Tâche 3 a réellement fabriqués en chemin** : `ZOOM_SOCLE`, `LARGEUR_SOCLE_M`, `LAT_REFERENCE`, `fractionEcran`, `altitudePourFraction`. ⚠️ **Un nom qui n'apparaît qu'à sa déclaration est une interface orpheline : cherchez-les avec `grep -c`, pas à l'œil.** ⚠️ **`socleVisible` et `empriseSocle` ne sont plus orphelins EN AMONT — fabriqués et testés le 2026-08-21 — mais ils le restent EN AVAL : aucun module de `src/` ne les lit encore.** Ce sont les Tâches 4 bis, 6 et 7 qui les branchent.

⚠️ **MISE À JOUR DU 2026-08-21 — la Tâche 4 bis a fabriqué ses SIX interfaces, et elles ne sont plus orphelines en amont :** `creerFlux`, `demanderEmprise`, `tuilesPretes`, `zoomEffectif`, `remplirHauteurs` et `debitObserve` vivent dans `src/monde/flux-terrain.js`, testées une par une dans `test/flux-terrain.test.js` ; `PLAFOND_FILE` vit dans `src/globe.js`. **`empriseSocle` a désormais un lecteur** — `demanderEmprise` la consomme. **Quatre noms s'ajoutent à surveiller**, produits en chemin par la 4 bis : `tuilesEmprise` (`flux-terrain.js`), `gardeHauteurs`, `_purgerFile` et `_annuler` (`globe.js`). ⚠️ **Restent orphelins EN AVAL — aucun module de `src/` ne les lit** : les six interfaces du flux, `socleVisible`, et tout ce que les Tâches 5, 6 et 7 déclarent (`auditerSolide`, `construireFenetre`, `majHauteurs`, `resolutionPour`, `empriseADerive`).

⚠️ **MISE À JOUR DU 2026-08-21 — la Tâche 6 ter a sorti `construireFenetre` de l'orphelinat EN AVAL, et lui seul.** `src/main.js` l'importe et pose la fenêtre sur `terrain.js` (`adopterFenetre`) : c'est le PREMIER module de `src/monde/` hors `exageration-continue.js` qu'un fichier de production lit vraiment. **Trois noms s'ajoutent à surveiller**, produits en chemin : `adopterFenetre` et `fabriqueFenetre` (`terrain.js`), `trianglesNappe` (`fenetre-bornee.js`). ⚠️ **Restent orphelins EN AVAL** — aucun module de `src/` hors `src/monde/` ne les lit : `majHauteurs`, `contourSocle`, `auditerSolide`, `socleVisible`, `empriseSocle` *(⚠️ celui-ci est lu par `main.js` depuis la 6 ter, mais seulement pour NOMMER l'emprise de la fenêtre — pas encore pour la remplir)*, les six interfaces du flux, `remplirBorne`, `etatIndicateur`, `resolutionPour`, `empriseADerive`.

⚠️ **MISE À JOUR DU 2026-08-21 — la Tâche 4 ter a fabriqué `zoomSoutenable`, et il a un LECTEUR :** `remplirBorne`, dans le même fichier `src/monde/descente-bornee.js`, qui est le **point d'appel de R3 côté remplissage**. **Quatre noms s'ajoutent à surveiller** : `remplirBorne`, `etatIndicateur`, `ZOOM_PLANCHER`, `NIVEAUX_PAR_DOUBLEMENT`. ⚠️ **Ils restent orphelins EN AVAL comme tout le bloc : aucun module de `src/` hors `src/monde/` ne les lit encore** — ce sont les Tâches 1, 2, 6 et 7 qui les brancheront, et la Tâche 4 ter dit précisément où (§4 de `descente-bornee.js`).

**Ordre imposé — révisé le 2026-08-21 par la mesure.** ✅ **Livrées : 1a · 2 bis · 1b · 4 · 4 sexies · 4 quater · 3 · 4 bis.** ⚠️ **Puis, et l'ordre a changé : ~~3~~ → ~~4 bis~~ → 4 ter → 4 alpha.** La Tâche 3 produit l'`emprise` que la 4 bis consomme — **et elle est produite depuis le 2026-08-21 : `empriseSocle`, `src/monde/seuil-socle.js`.** **Et la 4 bis passe désormais AVANT la 4 alpha** : la Tâche 4 quater a laissé le flux mesuré à **568 tuiles en `loading` simultanément** caméra en mouvement, avec `MAX_CONCURRENT = 6` — or la 4 alpha multiplie par quatre le poids d'une tuile (256 → 512 px). **Calibrer le flux avant de l'alourdir, comme on a dimensionné le cache avant d'approfondir.** Ensuite le **bloc fenêtre — 5 avant 6, puis 7** : c'est lui qui supprime les crans. Puis **1b bis** (la frontière de rendu). ⚠️ **Enfin seulement les rideaux : 2 (`#loading`) puis 2 ter (`.whiteout`)** — ôter un rideau avant que l'attente ait disparu ne supprime pas le pop-up, il montre le trou qu'il cachait. ⚠️ **La Tâche 1c est ABANDONNÉE** : elle déverrouille une reconstruction que le pivot supprime.

**Le risque principal n'est plus la géométrie** : l'attaque a confirmé qu'on ne peut pas la déchirer. **C'est le flux** — plafond, annulation, éviction — et **le réseau**, qui décide du zoom réellement atteint.

⚠️ **MISE À JOUR DU 2026-08-21 : le flux est calibré, le RÉSEAU reste entier.** Le pic de `loading` passe de 568 à **141 au navigateur**, et la file ne dépasse plus `PLAFOND_FILE = 256`. Mais la mesure a montré autre chose de plus dur : **le pic de file ne dépendait pas du débit** (558 / 554 / 546 sur un facteur 24) alors que **le zoom atteint, lui, n'en dépend que de lui** — à 12 Mb/s, cinq secondes après un balayage de 90°, le globe est à z6 et il lui faut une minute pour revenir à z15. **La 4 ter n'est donc pas un raffinement : c'est la moitié qui reste**, et `debitObserve` l'attend.

**Ce qui n'est toujours pas vérifié :** aucune image en mouvement n'a jamais été vue (le volet navigateur ne composite pas), et rien n'a été mesuré sur un portable. Les deux valent pour le prototype comme pour son attaque.
