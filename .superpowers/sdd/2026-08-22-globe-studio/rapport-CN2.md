# RAPPORT CN2 — LE CROP NET : LE CORRECTIF, ET POURQUOI CE N'EST PAS LE PLAFOND

Branche `crop-net-correctif` (arbre `C:\Dev\wt-cn2`). Trois fichiers de `src/`
touchés : `globe.js`, `main.js`, `ui/create-panel.js`.

> **`npm test` : 4 935 tests · 4 935 réussis · 0 échec.**
> `npm run audit:tests` : **266 listés · 266 sur disque, 6 hors suite déclarés,
> aucun écart.** Les six tests de CN1 sont verts, et **aucun autre n'a rougi**.

---

## ⚡ VERDICT EN CINQ LIGNES

1. **Le point fixe est cassé.** Le crop suit désormais l'altitude : à Majorque,
   **5,09 → 1,25 px par texel à 900 m** ; aux Alpes — le cas dur —
   **19,28 → 1,84 à 900 m** et **43,52 → 1,21 à 600 m**.
2. **À 5 000 m, rien n'a bougé d'un bit** (0,77 / 0,78 / 0,90 / 0,94, z13,
   histogramme `{13: n}`) : le cadrage de l'affiche était déjà juste, il l'est
   resté. B5 est tenu par construction, pas par chance — voir §3.
3. **Une seule finesse par image, y compris pendant l'affinage.** Le niveau
   dessiné ne change qu'entre deux images **entièrement couvertes** : un
   PALIER ATOMIQUE. Mesuré image par image sur 300 images : **zéro image à deux
   niveaux** au-dessus du socle.
4. **Ce n'est pas le plafond qui a été levé.** `MAX_Z` vaut toujours 15 et
   `ZOOM_SOCLE` toujours 13. Ce qui a changé, c'est **la loi qui décide** : le
   crop se règle sur *pixels d'écran par texel servi* — la grandeur d'Adrien —
   et non plus sur une silhouette de tuile plafonnée à la main.
5. **Les 2,36 millions d'échantillons payés et jamais montrés sont montrés.**
   Le crop sert maintenant **1,840 m par texel** à Majorque : exactement le
   `bloc MNT` que CN1 relevait chargé, mémoïsé et invisible.

---

## 1. CE QUI A CHANGÉ, EN QUATRE PIÈCES

| pièce | où | ce qu'elle fait |
|---|---|---|
| **`_zoomCropFin`** | `globe.js` | la CIBLE : `z = ⌈log₂(circ·cos lat / (tuilePx · 2,0 · mppEcran))⌉`, bornée par la source. C'est le barème B4, écrit tel quel. |
| **`_cropCouvert` + `_majZoomCrop`** | `globe.js` | le PALIER : `_zCropServi` ne monte d'un cran que si le niveau visé couvre **toute** l'emprise, **enfants du bord compris**. |
| **`_prelireCrop`** + bonus de `_priorite` | `globe.js` | l'ORDRE : l'affiche et son bord partent devant. Aucun budget desserré. |
| **`majFinesseCrop`** + étiquette « net à z… » | `main.js`, `ui/create-panel.js` | les deux entrées que le moteur ne peut pas deviner (hauteur d'écran, plafond de la région), et la fin de la sur-promesse. |

**Le mécanisme, en une phrase :** le crop tient désormais **deux** niveaux — ce
que l'écran DEMANDE (`_zCropCible`) et ce qui est DESSINÉ (`_zCropServi`) — et le
second ne rejoint le premier que par sauts entiers, sur une emprise entièrement
couverte. `zoomCropPrescrit` reçoit `_zCropServi`, donc la prescription reste
**une seule valeur pour toute l'emprise**, comme avant.

⛔ **`MAX_Z` n'a pas été touché, et c'est délibéré.** Il borne le quadtree de
DISTANCE, c'est-à-dire le globe **autour** du crop ; le monter aurait ouvert les
niveaux fins à toute la calotte — la tempête de requêtes de la Tâche 4. Le
chemin `zCrop` de `_traverse` ne consultait déjà pas `MAX_Z` : le crop pouvait
descendre plus bas depuis toujours, il ne le demandait jamais.

---

## 2. ⛔ LE BARÈME, REMPLI — AVANT / APRÈS, QUATRE LIEUX

Sonde CN1 inchangée (`scripts/sonde-cn1.mjs`), Chrome sans tête, 1280 × 720,
DPR 1, CPU ×4, vite sur `127.0.0.1:9137`, 20 images consécutives au repos, bloc à
`DEFAULT_FINE_ZOOM = 15`. **La colonne « avant » a été REMESURÉE sur cet arbre**
(`git stash push -- src/`) et reproduit CN1 au centième : 0,22 / 0,90 / 5,09 à
Majorque, 0,21 / 0,94 / 19,28 aux Alpes.

### Pixels d'écran par texel servi — **avant → après**

| altitude | Beauce | Bretagne | Majorque | Alpes |
|---|---|---|---|---|
| 20 000 m | 0,19 → **0,19** | 0,19 → **0,19** | 0,22 → **0,22** | 0,21 → **0,21** |
| **5 000 m** | 0,77 → **0,77** | 0,78 → **0,78** | 0,90 → **0,90** | 0,94 → **0,94** |
| 2 000 m | 1,94 → **1,94** | 1,96 → **1,96** | — → **1,12** | 3,09 → **3,09** |
| **900 m** | 4,31 → **1,08** | 4,45 → **1,06** | 5,09 → **1,25** | 19,28 → **1,84** |
| **600 m** | 6,45 → **1,62** | 6,79 → **1,58** | — → **1,88** | 43,52 → **1,21** |

### Niveau servi et histogramme dessiné dans l'emprise

| altitude | Beauce | Bretagne | Majorque | Alpes |
|---|---|---|---|---|
| 20 000 m | `{13}` | `{13}` | `{13}` | `{13}` |
| 5 000 m | `{13}` | `{13}` | `{13}` | `{13}` |
| 2 000 m | `{13}` | `{13}` | `{14}` | `{13}` |
| 900 m | `{15}` | `{15}` | `{15}` | `{14}` |
| 600 m | `{15}` | `{15}` | `{15}` | `{15}` |

**Un seul niveau par cellule, aux vingt cellules.** Et le texel servi cesse
d'être un point fixe : à Majorque **7,360 → 1,840 m** entre 20 km et 900 m,
c'est-à-dire **exactement les deux niveaux que le MNT du bloc portait déjà**.

### ⛔ LA CELLULE QUI NE PASSE PAS, ET JE NE LA MASQUE PAS

**Alpes à 2 000 m : 3,09 px par texel, inchangé.** Le barème B4 demande ≤ 2,0.
C'est **la seule cellule** de la plage 5 000 → 600 m qui reste au-dessus, et elle
est au-dessus **du même chiffre qu'avant** — je n'ai rien dégradé, je n'ai rien
gagné là.

Ce que la mesure dit : aux Alpes, le mètre par pixel vaut **2,148 à 2 000 m** et
**1,803 à 900 m** — un facteur **1,19** pour un facteur **2,2** d'altitude. La
butée polaire (`polaireMaxSol`) couche la caméra et le relief rapproche la
surface : la distance caméra→sol cesse d'être proportionnelle à l'altitude de
cadrage, et une loi fondée sur la distance sous-lit d'un niveau exactement là.
J'ai essayé de résorber l'écart en reportant l'altitude déplacée sur la direction
exacte du centre du crop (§6, point 4) : **mesuré, ça ne bouge pas**. La cellule
reste ouverte.

⚠️ **Et une marge globale ne peut PAS la rattraper.** Le seuil de 2,0 place
Majorque à 5 000 m à `log₂ = 12,98`, c'est-à-dire **à 0,02 niveau de la
bascule** : abaisser le seuil à 1,8 ferait passer le cadrage de l'affiche de z13
à z14, donc casserait B5 (« à 5 000 m, ne dégrade pas »). La loi est calibrée
exactement sur le cadrage d'Adrien ; c'est une propriété, pas une coïncidence.

---

## 3. ⛔ LA PREUVE DE L'EXIGENCE ③ — UNE SEULE FINESSE, MÊME PENDANT L'AFFINAGE

`scripts/sonde-cn2.mjs` (neuf) relève, **à chaque image**, la cible, le palier
servi et **l'ensemble des niveaux dessinés dans l'emprise**. Cinq altitudes ×
60 images sur le banc de papier, soit 300 images :

| ensemble dessiné | images | où |
|---|---|---|
| un seul niveau (`[2]`…`[16]`) | **293** | partout |
| `[11, 12]`, `[12, 13]` | 5 + 5 | **sous `ZOOM_SOCLE`, pendant la descente initiale du quadtree — le dépôt d'avant, inchangé** |
| **deux niveaux au-dessus du socle** | **0** | — |

⚡ **Et le zéro a été gagné, pas constaté.** Ma première version relevait
`[13, 14]` — **une image à deux niveaux à chaque promotion, cinq tirages sur
cinq**. La cause est celle que CN1 avait mesurée sans la nommer : une tuile qui
**chevauche** l'emprise a des enfants entièrement dehors ; tant que l'un manque,
le raffinement partiel (R37) dessine ce parent sous ses enfants prêts, et
`tuileDansCrop` — un test d'**intersection** — le compte comme dessiné dans
l'emprise. C'est très exactement le `[11, 16]` du §5 de CN1. `_cropCouvert`
énumère donc les **parents** et exige leurs **quatre** enfants, pas seulement
ceux du crop.

Dans l'application, l'histogramme au repos vaut `{z: n}` à un seul niveau aux
**vingt** cellules du barème (tableau ci-dessus). Aucun clignotement n'est
possible par construction : entre deux paliers, `_traverse` reçoit la même valeur
prescrite, donc dessine **le même ensemble de tuiles**.

---

## 4. LE RENDU À 5 000 m — LA PREUVE QU'IL EST INCHANGÉ

| grandeur, 5 000 m | Beauce | Bretagne | Majorque | Alpes |
|---|---|---|---|---|
| px par texel, avant | 0,77 | 0,78 | 0,90 | 0,94 |
| px par texel, après | **0,77** | **0,78** | **0,90** | **0,94** |
| m par texel, après | 6,369 | 6,346 | 7,360 | 6,647 |
| niveau servi, avant / après | 13 / **13** | 13 / **13** | 13 / **13** | 13 / **13** |
| histogramme | `{13}` | `{13}` | `{13}` | `{13}` |

**Identique au centième, aux quatre lieux.** Ce n'est pas un réglage : à 5 000 m,
la loi rend `z = ⌈12,98⌉ = 13`, et le palier n'a donc rien à monter. C'est le
même calcul qui, à 900 m, rend 16 et, à 20 000 m, rend 12 (clampé au socle).

---

## 5. LE COÛT, ET L'EMPRISE

| grandeur | avant (CN1) | après (mesuré) | barème |
|---|---|---|---|
| cache au repos, 4 lieux, toutes altitudes | 246 – 273 | **248 – 285** | ≤ 900 |
| cache au banc, pendant l'affinage (80 im.) | — | **≤ 828** | ≤ 1 200 |
| emprise du bloc à `demZoom = 15` | 2 437 – 2 826 m | **inchangée** | ≥ 2 400 m |
| `MAX_Z` / `ZOOM_SOCLE` / `DEFAULT_FINE_ZOOM` | 15 / 13 / 15 | **15 / 13 / 15** | — |

⚡ **+12 tuiles de cache au pire, pour deux niveaux de détail.** Le calcul de
CN1 prévoyait ×16 sur les tuiles de l'emprise ; la mesure rend +4 %. La raison
est le §5 de `/threejs-optimisation` appliqué dans le bon ordre : le crop **ne
demande jamais un niveau qu'il ne va pas dessiner** (la cible ne dépasse pas ce
que l'écran réclame), les tuiles hors crop ne naissent pas (`poserCropSeul`), et
**aucun budget n'a été desserré** — `_credit`, `CACHE_MAX_CONTINU` et
`PLAFOND_FILE` sont au bit près ceux du dépôt. Ce qui a changé est un **ordre de
service**, pas une capacité.

⛔ **L'emprise ne rétrécit pas d'un mètre** : `params.demZoom` n'est ni lu ni
écrit par ce correctif. C'était le piège de CN1 (z13 → z15 divise l'emprise par
4,00 pour 0,03 % de netteté) ; il est évité en ne touchant pas au bloc.

---

## 6. CE QUE J'AI CRU PUIS RÉFUTÉ

1. **« Il suffit de prolonger le critère du produit au-delà de `ZOOM_SOCLE`. »**
   C'était la même ligne, donc « la même loi ». **Mesuré : elle réclame z15 à
   5 000 m**, l'altitude où CN1 a mesuré 0,90 px par texel, c'est-à-dire là où le
   crop est **déjà juste** — B5 tombait. `chord / dist` contre `SPLIT_RATIO`
   répond à « la tuile est-elle grosse à l'écran », pas à « combien de pixels
   couvre un texel ». **Ce n'est pas la grandeur du barème.** Réécrit sur les
   pixels par texel, avec `tuilePx` **lu sur la source** et non écrit en dur.
2. **« La hauteur d'écran, c'est le tampon de dessin. »** Non — et ça a coûté un
   tour de mesure : **2,47 px par texel à Majorque à 900 m**, z14 là où le barème
   demande z15. La machine du banc tombe sur un palier à échelle de rendu
   réduite, le tampon fait moins de 720 lignes, et le crop se réglait sur une
   image que personne ne regarde. Adrien juge l'image **affichée** : c'est
   `renderer.getSize`.
3. **« La distance au centre du crop se prend sur la sphère. »** Non, et c'est
   **le cas dur qui l'a dit** : avec le point de sphère, Majorque et la Bretagne
   passaient et **les Alpes ne bougeaient pas d'un bit** — 19,28 px par texel,
   le chiffre d'avant. Le sol y est à 1 500 m, **exagéré 2,8 fois** : la surface
   regardée est des kilomètres plus près que le point de sphère de même
   latitude. On prend l'origine RTC du maillage, que `_buildMesh` pose sur la
   surface **déplacée**.
4. **« Le reste de l'écart aux Alpes vient du décalage horizontal du centre de
   tuile. »** Hypothèse plausible (1,9 km à z13, donc des centaines de mètres
   d'altitude aux Alpes) — **réfutée par la mesure** : reporter le rayon déplacé
   sur la direction exacte du centre du crop **ne change rien** à la cellule
   2 000 m (3,09 avant comme après). Le correctif est resté (il est juste), la
   cellule reste ouverte.
5. **« La plus petite des deux distances (sphère nue / surface déplacée). »**
   Réparait un banc et en cassait un autre : dans `veille-repos` ⑦, la caméra
   frôle la surface exagérée, la distance tombait à ~1 km et le crop réclamait du
   z16 sur une emprise de 29 km — **1 025 tuiles en cache**. La bonne condition
   n'est ni le min ni le max : **le terme de relief ne vaut que quand la caméra
   est au-dessus de la surface**, ce qui est le cas de toute pose réelle.
6. **« Le palier atomique s'applique à toute la plage. »** Non : appliqué aussi
   **sous** `ZOOM_SOCLE`, il a rejoué CULL ⑤ mot pour mot. Sur une emprise
   continentale (6 376 km à `demZoom = 4`), la couverture n'arrive jamais, donc
   le palier ne redescendait pas, donc le crop restait prescrit à z13 sur toute
   la planète. `test/crop-plafond-altitude.test.js` ① et ② l'ont attrapé au
   premier `npm test`. Sous le socle, la borne d'écran est suivie **sans délai**,
   exactement comme dans le dépôt.
7. **« Servir l'emprise en priorité suffit. »** Non : au premier essai j'ai rendu
   **`[14, 15, 16]` à 900 m**. En servant le crop d'abord, j'affamais ses
   **frères du bord** — les enfants hors emprise des tuiles qui la chevauchent —
   et le raffinement partiel remettait leur parent à l'écran. Le bonus de
   priorité couvre donc aussi les tuiles **dont le parent** chevauche l'emprise.
8. **« La couverture se vérifie au niveau visé. »** Insuffisant, et c'est le
   point 7 vu depuis l'autre bout : il faut vérifier **les quatre enfants de
   chaque parent** de l'emprise, sinon il reste une image à deux niveaux à chaque
   promotion.
9. **« Et donc il faut attendre les enfants hors crop. »** ⛔ **Non, et ça a
   cloué le crop à z14 aux quatre lieux** (Majorque 900 m : 2,47 au lieu de
   1,25). Sous `poserCropSeul` — l'état de production — ces enfants ne sont
   **jamais créés** : les attendre, c'est attendre une tuile que personne ne
   demandera. La liste de `_cropCouvert` doit être **exactement celle de
   `_children`**, `_horsCropSeul` compris. Deux réglages symétriques, deux
   mesures, une seule ligne juste.
10. **« Le coût va exploser (×16 sur les tuiles de l'emprise). »** C'était le
    calcul de CN1, et il était honnête. **Mesuré : +4 % de cache.** Ce qui coûte
    n'est pas la finesse du crop, c'est ce qu'on charge autour.

---

## 7. LES DEUX RÉPONSES QUE LE BRIEF EXIGE NOMMÉMENT

**⑤ Les 2,36 millions d'échantillons chargés et jamais montrés.** Ils sont
**montrés**. CN1 relevait, aux quatre lieux, un `bloc MNT` à 1,592 / 1,587 /
1,840 / 1,662 m par texel pendant que le crop dessinait 6,369 / 6,346 / 7,360 /
6,647. Après correctif, le crop sert **1,592 / 1,586 / 1,840 / 1,662** à 600 m :
**la même donnée, au millième**. Il n'y avait rien à ré-utiliser au sens d'un
transfert — les tuiles du bloc et celles du globe sont les mêmes objets de cache
(`tuiles-mutualisees`) ; ce qui manquait, c'est que le crop les **demande**.
⚠️ Le MNT du bloc reste plafonné par `params.demZoom` : sous 600 m, le crop peut
dépasser ce que le bloc a cuit, et c'est alors une vraie tuile de plus.

**⑥ Quand la région n'a pas de donnée plus fine.** `main.js` écrit
`globe.zoomCropMax = getDemMaxZoom()` à chaque image, et `_plafondCrop()` le
borne à `ZOOM_CROP_MAX_DUR = 17` (swissALTI3D). Le crop s'arrête donc **là où la
source s'arrête** : z17 en Suisse, z16 en France et à Majorque, z15 ailleurs.
Au-delà, la source rendrait un ancêtre surzoomé — pas un texel de gagné, quatre
fois plus de tuiles payées. **Et l'écran le dit** : l'étiquette « Détail (zoom) »
affiche `— net à z15` et, au plafond, `— net à z16, plafond de la donnée ici`.
C'est la fin des deux niveaux de sur-promesse de CN1 (§2.6) : le cartouche
annonçait `Z${params.demZoom}` — le cran d'**emprise** — pendant que la surface
dessinait du z13. Les deux chiffres étaient justes ; ils ne répondaient pas à la
même question.

---

## 8. LES CAPTURES POUR ADRIEN

Avant : `C:\Dev\wt-cn2\.banc\CN2\cliches-avant\` ·
après : `C:\Dev\wt-cn2\.banc\CN2\cliches\` (⚠️ `.banc` est ignoré par git : les
PNG ne voyagent pas avec la branche, c'est un choix).

| fichier | lieu / altitude | avant → après |
|---|---|---|
| `*-majorque-20000m.png` | Majorque, 20 033 m | 0,22 → 0,22 — **identique** |
| `*-majorque-5000m.png` | Majorque, 4 994 m | 0,90 → 0,90 — **identique, le cadrage de l'affiche** |
| `*-majorque-900m.png` | Majorque, 900 m | **5,09 → 1,25** |
| `*-alpes-20000m.png` | Alpes, 20 033 m | 0,21 → 0,21 |
| `*-alpes-5000m.png` | Alpes, 4 995 m | 0,94 → 0,94 |
| `*-alpes-900m.png` | Alpes, 900 m | **19,28 → 1,84** |

---

## 9. CE QUI RESTE OUVERT

- **Alpes à 2 000 m : 3,09 px par texel** (§2). La seule cellule au-dessus du
  barème, inchangée. La piste testée et réfutée est au §6 point 4 ; celle qui
  reste est de mesurer la demande **au point le plus proche de l'emprise** et non
  à son centre — mais tout élargissement de ce type fait basculer Majorque à
  5 000 m de z13 à z14 et casse B5. Il faudrait une loi qui distingue les deux,
  et je n'en ai pas de mesurée.
- **Le temps jusqu'à la netteté (B6) n'a toujours pas de test** — le banc de node
  résout ses dalles en une microtâche. La sonde montre que le palier converge en
  **moins de 60 images** au banc et avant le calme dans l'application, mais je
  n'ai pas de chiffre en millisecondes à 30 Mb/s.
- **L'indicateur discret (`etatIndicateur`) n'est pas levé pendant l'affinage.**
  L'état existe et a deux lecteurs ; le brancher sur `_zCropServi < _zCropCible`
  est une ligne, mais elle n'a pas de mesure derrière et je ne la pose pas à
  l'aveugle.
- **La photo aérienne** suit toujours sa propre loi (`aerialZoomFor`) : allumée,
  « altitude » et « texture » redeviennent deux choses distinctes, et **rien ici
  ne la couvre**.
- **Sous 600 m**, comme pour CN1, je ne publie aucun chiffre : les relevés
  cessent d'être monotones à cause de `distanceMinSol`.
- **Le `dem.maxZoom = 17` de la Bretagne** n'est toujours pas expliqué. Il est
  désormais **utilisé** (`zoomCropMax`) — donc s'il est faux, il coûte des
  tuiles. À chasser.
