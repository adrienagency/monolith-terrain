# RAPPORT CA2 (fini par CA3) — LE CORRECTEUR DU « CROP D'ABORD » (D27)

Arbre `C:\Dev\wt-ca2`, branche `crop-avant-tout-correctif`, base
`git merge-base HEAD regroupement` = `f695393`. Vite `--host 127.0.0.1 --port
11711 --strictPort`. Chrome sans tête de `puppeteer-core`, un par geste, tué par
le script. **`npm install` non lancé.** Rien écrit dans `public/data/bathy`.

> **Adrien, 2026-09-05 :** *« On ne peut pas lancer le crop avant même
> d'afficher la terre ou la mer ? Ça évite d'afficher des éléments qui sont
> hors crop. »*

## ⚡ LES LIGNES QUE JE TOUCHE — pour la fusion à la main

**`src/globe.js`** (4 endroits, aucune ligne existante réécrite sauf 2 imports) :

| lignes | quoi |
|---|---|
| **33** | `import … latLonDeLocal` ajouté à l'import de `crop-sphere.js` |
| **41** | `import … contourCrop` ajouté à l'import de `parois-crop.js` |
| **923 – 930** | `PAS_SONDE_SOCLE = 2/64`, `N_SONDE_MER = 24` (les pas de la sonde) |
| **5102 – 5194** | `socleCropPret()` et son pavé — **méthode NEUVE**, aucun appelant existant touché |

**`src/monde/branchement-crop.js`** : la veille du crop, en entier (l'attente du
socle, le relais du repos, les accesseurs). **`src/modes.js` et `src/main.js` :
pas touchés** — donc aucun croisement avec `wt-fan` (`regenerateTerrain`),
`wt-obl` (transport de la pose), `wt-gel2` (`globe.js`/`main.js`/`modes.js`,
gardes du double-clic) ni `wt-cam`. Le seul point de contact avec GEL2 est
`src/globe.js`, et il est en **ajout pur** (une méthode neuve + deux constantes
+ deux noms dans deux `import`).

Tests : `test/crop-avant-tout.test.js` (①②③④⑤ + ⑥ neuf),
`test/vie-crop.test.js`, `test/veille-repos.test.js`, `test/estompage-fondu.test.js`.
Bancs : `scripts/sonde-ca1.mjs`, `bilan-ca1.mjs`, `lit-ca1.mjs` — le banc de CA1,
étendu (levier `--attente N`, la seconde altitude `altGlobe`, l'attente et ses
compteurs, le navigateur relançable). **Aucune assertion du banc n'a été
assouplie.**

## ① LE CORRECTIF — deux moitiés, et chacune ferme UNE des deux portes de CA1

CA1 a mesuré deux mécanismes qui dessinaient avant que l'emprise existe. Il y a
donc deux moitiés, et **elles sont indépendantes — mesurées séparément**.

### (a) LE DEHORS RESTE ÉTEINT TANT QUE LE CROP VIT — le conflit de citations, tranché

`branchement-crop.js` : l'état `dehorsPermis` disparaît ; le relais du repos
redevient `const voulu = !!(pose && repos)`. `armerSortie()` n'arme plus que
l'INTENTION de D21 ① (elle autorise la mort), elle ne rallume rien.
`get dehorsPermis()` est **dérivé** : `!pose` — « le dehors a la permission »
≡ « il n'y a plus de crop ».

**La lecture retenue est une DÉDUCTION, et je la dis comme telle.** Les deux
citations d'Adrien sont vraies ensemble si la permission du 2026-08-23 (« si je
dézoome EN SCROLLANT, tu peux faire réapparaître le reste ») vaut pour la
**SORTIE** — le crop meurt, puis la planète — et non entre deux paliers d'un
crop qui vit, qui est exactement le geste filmé le 2026-09-05. C'est
contestable ; ce ne l'est plus après la mesure ci-dessous.

⚠️ Conséquence sur un accesseur voisin : `arriveeBloc` redevient
`reposApplique && auRepos && auBloc`. Depuis la Tâche N, `reposApplique`
impliquait `auRepos` ; il ne l'implique plus, et la vue de trois quarts (D16 ter)
attend toujours la vue stabilisée. Sans ce `&& auRepos`, la bascule de trois
quarts partirait pendant le geste.

### (b) L'ATTENTE DU SOCLE — « d'abord » veut dire « avec sa mer et ses parois »

`globe.socleCropPret(ctx)` : **une SONDE, pas une pose.** Elle ne touche ni
`_crop`, ni un uniforme, ni un maillage. Elle pose **exactement les deux
questions que les deux maillons poseront, sur les mêmes sources** :
`hauteurDessinee` sur l'anneau du contour (`contourCrop`, `tuilesAvecHauteurs`,
couverture exigée = 1, comme `construireParoisCrop`) et `mer.remplir` sur la
calotte (`empriseCalotte`, `couvertureMin`, `exigerBathy`, comme `poserMer`).
Elle échantillonne plus grossièrement — 128 points de contour au lieu de 512,
625 nœuds de champ au lieu de 385² = 148 225 — parce qu'**un trou de couverture
est une TUILE, pas un point**.

La veille l'interroge toutes les `periodeSonde = 6` images, **jamais au repos**,
et seulement à un **palier concentrique** d'un crop DÉJÀ posé (ni à la
naissance, ni à un déménagement). Pendant l'attente, l'ANCIEN crop reste à
l'écran, complet. Borne : `attenteSocleMax = 120` images ; échue, on pose comme
avant D27. `0` est un levier de banc (D13) qui rejoue la pose immédiate dans la
même page : `scripts/sonde-ca1.mjs --attente 0`.

## ② LE BARÈME N'A PAS ÉTÉ RELÂCHÉ — ce que j'ai rétabli dans le test de l'attaquant

Le correcteur avait modifié `test/crop-avant-tout.test.js`. **Les assertions de
①②③④ sont intactes, au caractère près** (diff relu ligne à ligne contre
`4171e89`). Deux changements du BANC de papier, et l'un des deux relâchait :

1. **Légitime — la latence est comptée PAR REPÈRE et ne repart plus à zéro.**
   CA1 remettait ses compteurs à zéro dans `poserCrop` quand la découpe change.
   Avec D27 la sonde tombe AVANT la pose : sous la règle de CA1, tout ce que la
   sonde apprend serait effacé par la pose elle-même, et **aucune sonde ne
   pourrait jamais être modélisée**. Les hauteurs arrivées pour une emprise ne
   repartent pas parce qu'on l'a reposée : le compteur par repère est le modèle
   juste.
2. ⛔ **RELÂCHÉ, ET RÉTABLI — un seul compteur pour les deux maillons.** Le
   correcteur n'en tenait qu'UN, partagé : les appels des parois y payaient la
   latence de la mer, et `merLatence = 5` ne valait plus « 5 reprises de
   `poserMer` » mais « 5 avances tous maillons confondus » — **moins de latence
   que celle que CA1 a mesurée** (mer refusée 5 – 8,6 s, 5 à 6 reprises).
   ➡️ Rétabli : **deux compteurs, chacun sa borne**, la sonde les avance tous
   les deux (une image où les hauteurs peuvent arriver les fait arriver pour le
   contour comme pour le champ — c'est la même tuile). ①②③④⑤⑥ restent verts
   avec le banc durci : le correctif tient le barème de CA1, pas un barème
   allégé.

Un troisième changement est un ajout, pas un relâchement : ⑤ prend un globe
`sondable: false` (le dépôt d'avant D27) pour prouver que le banc n'est pas
aveugle, et ⑥ (neuf) prouve la même chose sur un globe sondable via le levier
`attenteSocleMax = 0` **et** que l'attente ne dure jamais plus que sa borne.

### La morsure, par mutation (copie de `src/`, md5 de l'arbre des `.js`)

| arbre | md5 | ① | ② | ③ | ④ | ⑤ | ⑥ |
|---|---|---|---|---|---|---|---|
| dépôt (corrigé) | `55dc5c38fead596081a68dbba4887181` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| **A** — `voulu = pose && repos && !sortieArmee` (la permission molette rendue) | `a03f5cd581589ac74973d0c10b5473f4` | ⛔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| **B** — `if (false) return true` (l'attente du socle arrachée) | `59e824d59f403a18d84ab63e55be6a46` | ✔ | ⛔ | ✔ | ✔ | ✔ | ⛔ |
| **C = A + B** — le dépôt d'avant D27 | `e3a67bfd292a79d7ad47758080fff63f` | ⛔ | ⛔ | ⛔ | ✔ | ✔ | ⛔ |

⚡ **C fait rougir exactement ①②③ — les trois tests de CA1, et eux seuls** ;
④ (le re-zoom, l'acquis) et ⑤ (le témoin) restent verts sous les trois mutants.
Et **③ ne mord que sous C** : l'état mixte est une CONJONCTION (le dehors dessiné
ET le socle partiel), donc chaque moitié du correctif suffit à l'éteindre — c'est
la preuve que les deux portes de CA1 étaient bien deux, et qu'aucune des deux ne
masque l'autre.

## ③ LES TESTS DE VIE, RÉÉCRITS — ce que je change, et pourquoi

Aucun n'est supprimé. Ils gardaient la permission de la molette comme un ÉTAT
qui rallumait le dehors sur un crop vivant ; ils gardent désormais la même
citation dans sa lecture « sortie seulement ».

| test | avant | après |
|---|---|---|
| `vie-crop` ② | « la molette rallume le dehors ; le retour au repos consomme la permission » | « la molette ARME la sortie et ne rallume RIEN tant que le crop vit ; le dehors revient à la MORT du crop » — la seconde moitié du test (la mort, le relais qui retombe) est neuve |
| `vie-crop` ④ | « une permission donnée AU REPOS survit jusqu'au geste (front montant) » | même invariant, porté par `sortieArmee` (D21 ①) : l'intention survit aux images posées, **et le geste qui suit ne rallume rien** |
| `vie-crop` ⑤ | « la naissance et la mort consomment la permission » | « `dehorsPermis` est DÉRIVÉ : vrai exactement quand il n'y a pas de crop » — et `sortieArmee`, lui, est toujours consommé |
| `veille-repos` ⑥ | « un dézoom molette qui bouge RETIRE le crop seul » | « ne le retire PLUS tant que le crop vit ; la veille du repos, elle, se réveille et se rendort » — le réveil est toujours asserté (`repos.auRepos` false puis true), seul son EFFET change |
| `veille-repos` ⑨ | « une distance qui change réveille la vue » (et rallume) | « réveille la VEILLE DU REPOS — et, D27, ne rallume pas le dehors » ; `repos.bascules` et `est.etat.repos` sont assertés à la place |
| `estompage-fondu` ④ | le fondu et son asymétrie joués sur un dézoom molette à crop vivant | mêmes assertions de fondu, jouées sur la **mort puis la renaissance** du crop — l'asymétrie « le parcours ne coupe qu'une fois le fondu achevé » est gardée mot pour mot |

⚡ **Ce que ① et ③ de `vie-crop` gardaient tient toujours, et plus fort** : aucun
geste ne rallume le dehors tant que le crop vit — glissé, inclinaison, bouton,
**et la molette**.

## ④ LA MESURE À L'ÉCRAN — le dézoom rejoué au banc de CA1

`scripts/sonde-ca1.mjs --port 11711 --repete 8 --etiq dezoom8`, `.banc/CA1`,
même lieu (La Réunion), même pose, même rafale (3 crans / 60 ms), même méthode
de comptage (le groupe du globe seul sur fond magenta dans une cible 320 × 200,
témoin à 0 avant chaque geste).

⚠️ **LA FENÊTRE DE LECTURE, ET ELLE EST CELLE DE CA1** : « transition » = du
premier cran jusqu'au palier net, **crop posé de part et d'autre**. La sortie
(le crop meurt) est un autre geste, hors barème — CA1 excluait déjà sa passe 4
pour cette raison. Le tableau distingue donc les chargements qui ont **croisé un
palier** de ceux dont la rafale s'est terminée en **sortie**.

### `dezoom8` — 8 chargements, comptage de pixels, ×1

**3 chargements ont croisé un palier · 5 se sont terminés en sortie · 0 erreur.**

| exigence du barème CA1 | seuil | fenêtre D27, **8/8** | sur les 3 chargements-palier |
|---|---|---|---|
| ⛔ **tuiles dessinées hors emprise** | 0 | **0** 8/8 | **0** 3/3 |
| ⛔ **images estompées** (`uEstompage < 0,999`) | 0 | **0** 8/8 | **0** 3/3 |
| ⛔ **images MIXTES** | 0 | **0** 8/8 | **0** 3/3 |
| **pixels hors emprise** (cible 320 × 200, témoin 0 8/8) | 0 | **0 sur 6 chargements** ; **1 px** sur 2 images pour 2 | **0** sur 2/3 ; **1 px** × 2 images sur 1 |
| **parois provisoires** | 0 | **0** 8/8 | **0** 3/3 |
| **parois d'un autre repère** | 0 | **0** 8/8 | **0** 3/3 |
| **découpe neuve sans SA mer** | 0 | **0 sur 7** ; 66 images sur 1 | 0 · 0 · 66 |
| ⛔ **recul de finesse** (`zServi` min, cible 12) | ≥ 12 | **12** 8/8 | **12** 3/3 |
| **attentes échues** (posées sans socle) | 0 | **0** 8/8 | **0** 3/3 |
| **palier NET** | ≤ 8 981 ms | — | **3 081 · 7 195 · 7 461 ms** ✔ |
| **mer du crop posée** (`finRefusMer`) | ≤ 8 586 ms | — | **2 530 · 6 623 · 6 852 ms** ✔ |
| **requêtes** | ≤ 313 | — | **246 · 252 · 252** ✔ |
| **coût** `dtGesteP50` / `P99` | — | — | 8,3 – 8,5 / 78 – 110 ms (banc pixels, non comparable) |

⚡ **Le 1 pixel n'est pas une fuite, et je le dis parce que la différence
compte** : sur ces images `dessineesHors` vaut **0** et `uEstompage` vaut **1** —
le quadtree n'a rien dessiné dehors et rien du globe n'est visible. C'est un
bord de rastérisation de la silhouette des parois, contre une enveloppe projetée
dilatée de 1,5 px : à 52 000 px la tolérance était invisible, à 0 elle se voit.

⚠️ **Le seul résidu réel : 1 chargement sur 8 montre 66 images de découpe neuve
dont la mer refuse encore.** La sonde échantillonne 24 × 24 nœuds là où
`_cuireChampMer` en remplit 385² : elle peut répondre « prêt » sur une couverture
que le remplissage fin rejette. C'est le prix du « une sonde ne coûte rien » ;
`N_SONDE_MER` est le bouton, et il est écrit à côté de sa mesure.

### `nu-x4` — 3 chargements, sans pixels, CPU ×4 : **le crop vit 3/3, 3 paliers chacun**

| grandeur | seuil CA1 | mesuré |
|---|---|---|
| px hors / tuiles hors / images mixtes / provisoires | 0 | **0 · 0 · 0 · 0**, 3/3 |
| découpe sans sa mer | 0 | **0** sur 2/3, 45 images sur 1 |
| attentes échues | 0 | **0** 3/3 |
| palier net | ≤ 15 868 ms | **10 384 – 11 254 ms** ✔ |
| requêtes | (base 290 – 304) | **253 – 255** ✔ |
| `dtGesteP50` | ≤ 21 ms | **9,2 – 28,3 ms** ⚠️ **un chargement sur trois au-dessus** |
| `dtGesteP99` | ≤ 1 184 ms | **994 – 1 229 ms** ⚠️ un au-dessus |

⚠️ **Je ne maquille pas les deux dépassements** : trois chargements, un écart de
9,2 à 28,3 ms sur le p50, c'est un échantillon trop petit pour trancher, et la
sonde ne l'explique pas (7 à 18 sondes par palier). **À remesurer sur 8
chargements avant de fusionner.**

### `nu3` — 3 chargements, sans pixels, ×1

`dtGesteP50` **1,9 – 2,8 ms** (seuil ≤ 4) ✔ · `dtGesteP99` **62,9 – 89,6 ms**
(≤ 190) ✔ · `mixte` 0, `provisoires` 0, `découpe sans mer` 0, `attentes échues`
0, `zServi` min 12, 3/3. ⛔ **`requêtes` 327 – 335, au-dessus des 313** — mais le
crop y meurt **3/3** et « la sortie recharge tout » (CA1, `z10x3`) ; sur les
chargements qui restent un palier, c'est **246 – 252**.

### ⚠️ CE QUE JE DOIS DIRE AVANT QU'ON FUSIONNE — la rafale sort plus souvent

CA1 mesurait **7 chargements vivants sur 8** ; ici c'est **3 sur 8** au banc
pixels (et **3 sur 3** à CPU ×4, et **3 sur 3** avec `--attente 0`). La rafale de
3 crans pose l'altitude finale **entre 35 722 et 41 179 m** selon le chargement,
c'est-à-dire **à cheval sur `SEUIL_MORT_M` = 40 343** : le crop vit ou meurt au
hasard. **Deux mécanismes écartés, chacun par une mesure** :
- ⛔ **ce n'est pas l'attente qui décale l'altitude** : `altitudeCadrageM()` lit
  `largeurBlocM()` = `terrain.fenetreBornee.largeurM` (`main.js:4551-4555`),
  **jamais l'emprise du crop** — et la trace image par image le montre en clair
  (`L` passe de 13 678 à 27 356 **pendant** que `ATTENTE(1)` tient l'ancien crop
  à l'écran, `scripts/lit-ca1.mjs`) ;
- ⛔ **ce n'est pas un écrêtage manquant** : il existe et il est branché (§⑤-2).
**Je n'ai pas trouvé la troisième explication et je ne l'invente pas.** Ce qui
est acquis : **la fenêtre D27 est propre sur les 8 chargements, morts compris**
— quand la rafale finit en sortie, l'ancien crop reste complet jusqu'à la mort,
puis la planète est légitime.

### Captures — les instants de la vidéo, rejoués (`.banc/CA1/captures/`)

| capture | l'image d'Adrien | avant (CA1) | maintenant |
|---|---|---|---|
| `02-pose-z11-provisoire.jpg` | **`r_014`** | l'île entière dessinée, la mer du globe autour, plaque provisoire pâle sans mer | **l'ancien crop z13, complet — sa mer, ses parois, le papier autour** |
| `03-planete-autour-pic.jpg` | **`r_020`** | planète entière, nuages, crop vivant | **le crop seul, sa mer, son arête ; aucune planète** |
| `05-repos-z11-crop-seul.jpg` | `r_025` | le crop z11 net | inchangé — c'est l'état d'arrivée, et il l'était déjà |

### Le choix « nouveau socle vide » contre « ancien crop complet » — mesuré, les deux

Le levier `--attente 0` rejoue la pose immédiate d'avant D27 **dans la même
page**, avec la moitié (a) du correctif déjà en place. Trois chargements chacun :

| ce qu'on montre entre deux paliers | px hors emprise | images mixtes | **découpe neuve sans SA mer** | parois provisoires | crop mort | requêtes |
|---|---|---|---|---|---|---|
| **le nouveau socle, posé tout de suite** (`--attente 0`, la proposition de CA1) | **0** 3/3 | **0** 3/3 | ⛔ **60 – 126 images**, 3/3 | ⛔ **0 – 60 img** | 0 3/3 | 243 – 255 |
| **l'ancien crop complet** (l'attente, le dépôt) | **0** sur 2/3, 1 px × 2 img sur 1 | **0** 3/3 | **0** sur 2/3, 66 img sur 1 | **0** 3/3 | 0 sur ces 3 | 246 – 252 |

➡️ **L'ancien crop complet gagne, et pour une raison chiffrée** : le nouveau
socle posé tout de suite est **toujours** une découpe sans sa mer pendant 60 à
126 images (1 à 2 s), parce que `poserMer` refuse `couverture` tant que la
bathymétrie de la nouvelle emprise n'est pas arrivée — c'est le refus que CA1 a
mesuré à 5 – 8,6 s et que la proposition « socle vide » ne pouvait pas voir.
Le coût de l'attente est **60 – 78 images d'ancien crop** (1,0 – 1,3 s à 60 Hz ;
42 – 108 à CPU ×4), sous la borne de 120, **`attentesEchues = 0` sur les 14
chargements mesurés**. ⚠️ CA1 écrivait « le nouveau
socle est DÉJÀ posé dans l'image de la pose (SOC), il ne manque que la mer » —
c'est vrai, et c'est précisément pourquoi sa proposition ne tenait pas la
troisième ligne de son propre barème.

## ⑤ ⛔ CE QUE J'AI CRU, PUIS RÉFUTÉ

1. **« La loi d'altitude change d'UNITÉ à la pose — c'est la quinzième confusion
   d'espaces »** (CA1 §2, et le brief le reprend). ⛔ **Faux, et c'est mesuré.**
   Le banc relève désormais DEUX altitudes dans la même image : `alt` =
   `altitudeCadrageM()` (unités du bloc, `camY / ((TERRAIN_SIZE / largeurBlocM) ×
   exagération)`) et `altGlobe` = `(|camGlobe.position| − R_GLOBE) × 63 710`
   — **le rayon du globe vaut 100 unités pour 6 371 000 m, donc 63 710 m par
   unité** (`ORBITAL_M_PER_UNIT`, `geo.js:17`), et cette seconde altitude **ne
   dépend d'aucun bloc**. À l'image de `poserCrop` z12
   (`.banc/CA1/dezoom-att0.json`, 3 chargements) : `alt` × **1,356**,
   `altGlobe` × **1,349** — **0,5 % d'écart**. Les deux espaces voient le MÊME
   saut : **la caméra monte réellement de 35 % dans l'image du WIDENING** (elle
   est REPOSÉE au nouvel étage), la loi ne change pas d'unité. Il n'y avait donc
   **aucun facteur de conversion à écrire avant la pose : il n'y a rien à
   convertir.** Le facteur qui compte, lui, est écrit en commentaire à la
   déclaration de l'attente (`branchement-crop.js`) et dans `sonde-ca1.mjs`.
   ➡️ Ce qui éteint le saut est donc l'AUTRE branche que D27 autorisait —
   **l'estompage gelé pendant le palier** : tant que le crop vit, la porte du
   repos tient à 1 et `estompage-terre.js` pose `auSeuil + (1 − auSeuil) × g`
   avec `g = 1`, c'est-à-dire **1 quelle que soit l'altitude**.
2. **« La poussée de sortie n'écrête pas son budget sur `reste` et va droit au
   seuil »** (l'hypothèse laissée par mon prédécesseur). ⛔ **Faux : l'écrêtage
   existe et il est branché.** `modes.js:1863-1869` lit `s.reste()` AVANT le pas
   et l'écrête (`plafond`), et `main.js:14511` passe `resteSortieLog` —
   `armerPousseeSortie?.(budget, resteSortieLog)`, avec un test de texte source
   qui le garde (`test/porte-crop.test.js`). C'est la correction PORTE, déjà au
   dépôt. Rien à faire là.
3. **« La rafale de 3 crans est un simple dézoom entre paliers, donc si le crop
   meurt c'est un défaut. »** ⛔ **Non : c'est le geste de SORTIE, par
   construction.** `sortie-molette.js` : `CRANS_SORTIE = 3`,
   `FENETRE_SORTIE_MS = 1000` — trois crans en moins d'une seconde **confirment
   l'intention de sortir**, et la mort du crop y est le résultat VOULU (le
   barème de CA1 la liste comme un acquis : « la sortie reste possible »).
   Je n'ai donc pas touché la poussée. ⚠️ **Mais il y a bien un défaut à côté,
   et je le nomme sans le corriger (ce n'est pas mon terrain)** : la même rafale
   pose l'altitude finale **entre 35 722 et 41 179 m** selon les chargements,
   c'est-à-dire **à cheval sur `SEUIL_MORT_M` = 40 343** — le crop vit ou meurt
   au hasard. La cause est le plateau de crans morts à `controls.maxDistance`
   (les 23 crans de SORTIE) : pendant qu'il dure, l'altitude ne bouge pas, donc
   `reste` ne diminue pas et le budget continue de se déverser dans
   `_levelZoom` ; quand les franchissements partent enfin, le WIDENING repose la
   caméra **+35 % en une image** et l'écrêtage par `reste`, lu avant le pas,
   arrive trop tard. ⛔ **Et écrêter le BUDGET sur `reste` — ce que le brief
   propose — casserait l'acquis SORTIE** : `MARGE_SORTIE = 1,6` existe justement
   pour payer les crans clippés qui ne rendent pas d'altitude ; ramené à
   `log(41 150 / alt)`, le budget s'épuise sur le plateau et la sortie repasse de
   8-9 crans à ce qu'elle était. Pour l'équipe SORTIE / PORTE, pas pour D27.
4. **« Le correcteur avait affaibli les assertions du test de CA1. »** ⛔ Non —
   les assertions sont intactes ; c'est le BANC de papier qu'il avait allégé
   (un compteur partagé au lieu de deux). Corrigé, et le correctif tient quand
   même : §②.
5. **« Je peux relire et éditer une source pendant qu'un banc tourne. »**
   ⛔ **Non, et ça m'a coûté deux bancs à 8 chargements.** Le premier est mort au
   4ᵉ sur `window.__ca1 is undefined` : **c'est MOI qui avais édité
   `src/monde/branchement-crop.js` pendant qu'il tournait**, et Vite a rechargé
   la page en plein geste (`[vite] page reload src/monde/branchement-crop.js`
   dans le journal du serveur, à la seconde près). Le second est mort au 6ᵉ sur
   « detached Frame », et **toutes les passes suivantes ont échoué sur le même
   cadre mort** parce que `nav`/`page`/`cdp` étaient des `const`.
   ➡️ Deux corrections au banc, et elles servent à tout le monde : la passe
   cassée est enregistrée comme une **ERREUR** (jamais comptée comme un succès)
   et **le navigateur est relançable** (`lancer()` / `relancer()`, `nav.close()`
   sur SA propre instance — jamais un `taskkill`). Le troisième banc a rendu
   **8 chargements sur 8, 0 erreur**.
   ⚡ **La règle pour la suite : aucune édition sous `src/` pendant qu'un banc
   tourne.** Un banc mesure la page qu'il a chargée, pas celle qu'on écrit.
6. **« Le crop qui meurt pendant la rafale invalide la mesure. »** ⛔ Non, et
   c'est ce qui a débloqué la lecture : sur les 5 chargements qui finissent en
   sortie, la fenêtre D27 (crop vivant, depuis le premier cran) est **propre
   elle aussi** — 0 tuile hors, 0 image estompée, 0 mixte, 0 provisoire.
   L'ancien crop reste complet jusqu'à la mort, et les 52 – 54 images de pixels
   hors emprise que le bilan brut affiche appartiennent toutes à la
   **renaissance** au re-zoom (une NAISSANCE, pas un palier — CA1 mesurait déjà
   la même chose sur sa passe 4, à +49 s).

## ⑥ LES TESTS ET L'AUDIT

- `npm test` : **5 119 tests · 5 119 réussis · 0 échec**. Ma base (`4171e89`,
  les deux commits de CA1) rendait **5 118 · 5 115 · 3 échecs — exactement ①②③**.
  ➡️ **+1 test** (⑥, la morsure de l'attente), **−3 échecs**, **aucun autre test
  ne rougit et aucun n'a disparu**.
- `npm run audit:tests` : **286 listés · 286 sur disque · aucun écart**,
  6 hors suite tous déclarés. `crop-avant-tout.test.js` est inscrit dans la
  liste explicite de `package.json`.
- Fins de ligne : **CR = 0 octet** partout (compté en binaire sur les octets,
  pas par `grep -c` — c'est le piège qui a rendu 0 puis 15 314 sur le même
  fichier).

## LES TRACES

- `.banc/CA1/dezoom8.json` + `dezoom8-bilan.md` + `dezoom8-cast/` (8 chargements,
  courbe par image) ; `dezoom-att0.json` + son bilan (le levier « socle vide »).
  `.banc` est ignoré par git : les JSON ne voyagent pas.
- Suivis : `scripts/sonde-ca1.mjs`, `bilan-ca1.mjs`, `lit-ca1.mjs`,
  `test/crop-avant-tout.test.js`, et les trois tests de VIE réécrits.
- Fins de ligne : **CR = 0 octet** sur `package.json`, les quatre tests et les
  trois scripts (comptés en binaire, pas par `grep -c`).
