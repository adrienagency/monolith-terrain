# PORTE — LA PORTE N'EST PAS À SENS UNIQUE, ELLE EST À PENTE

Arbre `C:\Dev\wt-porte`, branche `porte-crop`. Serveur :
`npm run dev -- --host 127.0.0.1 --port 9533 --strictPort`, **arrêté en
partant**. Les Chrome sans tête sont ceux de `puppeteer-core`, lancés et fermés
par mes scripts ; **aucun autre n'a été touché**. `npm install` n'a pas été
lancé (`node_modules` est une jonction partagée).

## ⚡ ① LE DÉFAUT RAPPORTÉ : RÉFUTÉ TEL QUEL, ET REMPLACÉ PAR SA MESURE

> *« La molette sort du crop, mais n'y fait plus rentrer. Porte à sens unique. »*

⛔ **FAUX, 8 chargements sur 8.** `.banc/PORTE/avant-retour-8.json`, un cran par
lecture, aller PUIS retour, sur la branche telle que la Fusion SORTIE l'a
laissée : **le crop renaît 8 fois sur 8**, entre **30 807 et 31 746 m**. La
molette rentre. L'attribution à la Fusion SORTIE d'une porte à sens unique ne
tient pas.

⚡ **MAIS LA MESURE A TROUVÉ AUTRE CHOSE, ET DE VRAI.** La porte n'est pas à sens
unique, **elle est à PENTE — et la pente est de 1 à 3,6** :

| | avant (Fusion SORTIE) |
|---|---|
| crans pour **SORTIR** | **8 · 9 · 9 · 9 · 9 · 9 · 10 · 9** |
| crans pour **RENTRER** | ⛔ **21 · 23 · 25 · 26 · 30 · 31 · 31 · 32** |
| altitude de mort du crop | **41 119 – 58 160 m** (seuil 40 343) |
| altitude **au repos**, après la sortie | ⛔ **45 555 – 63 890 m** |

**Voilà ce qu'Adrien sent.** Il redescend en permanence dans le crop ; chaque
retour lui coûte trois fois son aller, et il n'y a rien à l'écran qui le lui
explique. Un geste qui coûte trois fois son inverse *se vit* comme un geste qui
ne marche pas.

## ② LA CAUSE, ET LA RÉSERVE DE SORTIE TRANCHÉE

> **SORTIE :** *« l'altitude de mort déborde le seuil — 40 726 à 66 836 m au
> lieu de 40 343 »*, avec la réserve : *« sans conséquence, le seuil de
> renaissance est 32 274 m »*.

⛔ **LA RÉSERVE EST FAUSSE, ET C'EST LA RÉPONSE À LA QUESTION ③ DU BRIEF.**
Elle est vraie sur un point et faux sur celui qui compte :

- **vrai** : le débordement n'empêche **pas** la renaissance. Le seuil de
  naissance est bien 32 274 m, il est bien franchi, le crop renaît 8/8. ✅
- ⛔ **faux** : « sans conséquence ». Le débordement **EST** la conséquence.
  `ln(63 890 / 32 274) / 0,0347` = **19,7 crans** de pur survol à repayer, sur
  un retour qui en compte 21 à 32. **Le survol est la quasi-totalité du surcoût
  du retour.**

**Et le survol était écrit en toutes lettres, en un nombre.** `MARGE_SORTIE =
1,6` faisait viser la poussée à `1,6 × SEUIL_MORT_M` = **64 549 m** — très
exactement le 63 890 m relevé au repos. SORTIE la croyait inerte *« puisque la
poussée est arrêtée à la mort du crop »* ; elle ne l'était pas, **et la raison
est mécanique** : le budget de la course est en **log-DISTANCE**, or les
franchissements de niveau **CONSERVENT l'altitude** (c'est leur définition, et
c'est la moitié du diagnostic de SORTIE lui-même). Un budget en log-distance ne
sait pas où il en est en altitude ; il ne peut donc pas s'arrêter à la bonne.

**La seconde moitié du survol est une image de trop.** L'application tourne à
~16 images/s pendant la course (`dt ≈ 0,06 s`) : un pas vaut `6 × 0,06 = 0,36`
nat, c'est-à-dire **×1,43 d'altitude EN UNE IMAGE**. Le dernier pas franchissait
le seuil de 43 % d'un coup. C'est ce qui explique l'étalement des morts relevées
(41 119 → 58 160 m) : **ce n'est pas du bruit, c'est la taille de la dernière
marche.**

## ③ LE CORRECTIF — LA POUSSÉE S'ARRÊTE SUR L'ALTITUDE, ET RÈGLE SON DERNIER PAS

| fichier | ce que j'y fais |
|---|---|
| `src/modes.js` | `armerPousseeSortie` prend un `reste` ; `_avancerPousseeSortie` le lit **avant** le pas et l'y écrête |
| `src/main.js` | `ARRET_SORTIE` (neuve), `resteSortieLog` (neuve), le passage du terminus à `armerPousseeSortie` |
| `test/porte-crop.test.js` | **NEUF**, 14 tests, inscrit dans `package.json` |
| `scripts/sonde-porte.mjs` | **NEUF** — le banc, 4 épreuves |

`armerPousseeSortie(budget, reste)` reçoit une **fermeture** qui rend **ce qui
manque en log-altitude** pour que D21 ① prononce la mort. Lue à **chaque image** :
`≤ 0` arrête la course, sinon **le pas de l'image y est écrêté**.

⛔ **CE QUE JE N'AI PAS TOUCHÉ** : `socleVisible` et la loi de D21 ① (c'est
toujours elle qui tue le crop), les quatre seuils de `seuil-socle.js` (D23 — ils
restent **séparés**), `sortie-molette.js` et sa confirmation à trois crans,
`ZOOM_TAU`, `ZOOM_IMPULSE`, `CRANS_PAR_NIVEAU`, `TAUX_SORTIE_LOG_S`. **Aucune
constante du zoom ordinaire n'a bougé d'un bit.**

## ④ LE TABLEAU DU CRITÈRE — 8 chargements par ligne

| situation | attendu | mesuré | verdict |
|---|---|---|---|
| **sortir du crop à la molette** | 8-9 crans, armé au 3ᵉ, 8/8 | **8 · 8 · 8 · 8 · 9 · 9 · 10 · 42** — armé au 3ᵉ 8/8 | ✅ ⚠️ voir la note |
| ⚡ **puis y RENTRER à la molette** | le crop renaît 8/8, chiffré | **le crop renaît 8/8**, en **21 · 21 · 21 · 21 · 21 · 22 · 22 · 28** crans (avant : 21-32) | ✅ |
| **aller-retour TROIS fois de suite** | 3/3 sans dérive | **12/12** (4 chargements × 3 tours) : `8/21 4/20 4/20 · 8/21 4/19 4/20 · 10/22 4/20 4/20 · 8/21 4/20 4/20` | ✅ **aucune dérive** |
| **altitude de mort** | compatible avec la renaissance | **41 124 – 41 814 m** (avant 41 119 – 58 160) ; sur les 12 tours : **40 634 – 41 660** | ✅ |
| **altitude au repos après la sortie** | — | **45 619 – 46 619 m** (avant 45 555 – **63 890**) | ✅ |
| **un cran de dézoom ISOLÉ dans le crop** | le crop vit | `cropPose` **true→true 8/8** (`apres-d19-8.json`, geste `molette-1cran`) | ✅ |
| **bouton map monde puis descente** | le crop renaît 8/8 | voir le § ⑤ | ✅ |
| **incliner au-delà de `SEUIL_MORT_M`** | le crop VIT (D21 ①) | ⚠️ voir le § ⑥ — **le geste ne peut pas atteindre le seuil**, et le crop vit 8/8 partout où il va | ✅ *sous réserve* |
| **D19 — la molette vise le centre** | ≤ 1,4 px | `centre0DerivePx` = **0** sur les 8 | ✅ |
| **D19 — le glissé attrape la Terre** | ≤ 0,2 px | `terreDerivePx` = **0** sur les 8 | ✅ |
| **D19 — `\|Δ ln d\|` glissé / inclinaison** | < 1e-4 | **4,44e-16** et **0** sur les 8 | ✅ |
| **D19 — six crans de zoom AVANT dans le crop** | doux, le crop vit | `rapportAlt` **1,1101 – 1,1138** (SORTIE : 1,1096 – 1,1162), `deltaLndMax` **0,00232 – 0,00266** (SORTIE : 0,00226 – 0,00339), crop **true→true 8/8** | ✅ **indiscernable** |
| `npm test` | ≥ 4 929 · 0 | **4 943 · 0** | ✅ |
| `audit:tests` | sans écart | **266 = 266, aucun écart** | ✅ |

⚠️ **LES DEUX VALEURS ABERRANTES SONT LE MÊME ARTEFACT, ET JE LE DIS AU LIEU DE
LE CACHER** : le **42** de la sortie et le **28** du retour sont tous deux la
**première passe d'un navigateur qui vient de démarrer**, où la compilation des
nuanceurs fait tomber la cadence. ⚡ **La preuve que c'est le banc et non
l'application** : sur cette passe-là l'altitude de mort vaut **41 682 m**, dans
le mille comme les sept autres. **Le correctif tient ; c'est la cadence qui
varie, et le compte de crans mesure un temps.** L'épreuve `ar3` le confirme :
les tours 2 et 3, page déjà chaude, sortent en **4 crans**, 8/8.

## ⑤ LE BOUTON MAP MONDE — ET LE FAUX CONSTAT QUE J'AI FAILLI ÉCRIRE

⛔ **J'AI D'ABORD RELEVÉ « le crop ne renaît JAMAIS, 6/6 » — ET C'ÉTAIT MON
BANC.** Le bouton monde bascule en mode **orbital** à **16 000 km** : la
descente n'est plus celle du crop, c'est celle de l'orbite entière. Mon plafond
de **120 crans** l'arrêtait en route. Relevé cran par cran, la descente est
**parfaitement monotone** : cran 21 → 2 105 385 m, cran 51 → 799 554 m,
cran 81 → 303 995 m, cran 120 → **79 803 m**, et il restait `ln(79 803/32 274) =
0,9` nat à faire. **Rien n'était bloqué ; le banc avait rendu la main trop tôt.**
Épreuve rejouée à plafond 300 : `apres-monde-8.json`.

⚠️ **Et ce chemin-là ne passe par aucune ligne que j'ai touchée** : la poussée
n'est pas armée (`poussee` faux du début à la fin), le mode est orbital, et
`armerPousseeSortie` refuse de s'armer hors du mode surface (test `② quater` de
`sortie-crop`).

## ⑥ D21 ① ET L'INCLINAISON — CE QUE JE PEUX PROUVER, ET CE QUE JE NE PEUX PAS

Le critère demande : *« dans le crop, incliner au-delà de `SEUIL_MORT_M` — le
crop VIT »*. ⛔ **Je n'ai pas pu construire cette situation, et c'est un
résultat en soi** : mesuré sur **16 chargements**, dans les deux sens de glissé
et depuis deux profondeurs de départ (460 m et 18 611 m), **l'inclinaison FAIT
BAISSER `altitudeCadrageM`** — 18 611 → 2 699 m en trois glissés
(`apres-inclin-z11-8.json`), 465 → 236 m depuis le fond
(`apres-inclin-haut-8.json`). **Le geste d'inclinaison ne peut pas porter la
caméra au-dessus de 40 343 m depuis l'intérieur du crop.**

Ce que je peux affirmer, mesuré : **le crop vit 8/8 dans les deux épreuves**, et
il vit **8/8** aussi sous le `c1-inclinaison-forte` de GE3, qui monte l'altitude
de fond de **×1,25** avec `terreDerivePx = 0` et `|Δ ln d| ≤ 4,44e-16`. Et la
loi elle-même — `socleVisible` refuse la mort sans `sortieArmee` — n'est
**touchée par aucune ligne de ce correctif** ; elle est gardée par
`test/seuil-socle.test.js` depuis la Tâche 3.

⚠️ **Je ne présente donc PAS cette ligne comme prouvée au geste.** Elle est
prouvée en unitaire et non contredite sur 16 chargements.

## ⑦ LES TESTS — ILS MORDENT DANS LES DEUX SENS, ET C'EST VÉRIFIÉ PAR MUTATION

`test/porte-crop.test.js`, **14 tests**, inscrit dans la liste explicite de
`package.json` (`npm run audit:tests` : **266 = 266, aucun écart**).

**Quatre mutations jouées, quatre rougissements :**

| mutation | rouge |
|---|---|
| le pas n'est plus écrêté au reste (`Math.min` sans `plafond`) | ⛔ ① — *le survol est de retour* |
| la poussée est armée sans son terminus (`armerPousseeSortie(budget)`) | ⛔ ③ |
| `ARRET_SORTIE` revient à la visée de **1,6** | ⛔ ③ ter **et** ④ |
| un plafond de pas fixe revient (`PAS_SORTIE_MAX_LOG`) | ⛔ ② , ② bis **et** ② ter |

Ce qu'ils gardent, **des deux côtés de la porte** : ① l'écrêtage du dernier pas
(le survol rejoué en unitaire), l'arrêt à reste nul **sans dépenser l'image**,
le reste relu à chaque image, les entrées non finies ; ② **le taux intact tant
qu'il reste du chemin** — c'est la sortie en 8-9 crans, et le § ② bis interdit
nommément le retour d'un plafond de pas fixe ; ③ le branchement, le seuil **lu
et non recopié**, l'altitude de **cadrage** et non de fond ; ③ ter **les deux
marges séparées** (viser large / s'arrêter court sont des besoins opposés, un
seul nombre ne peut pas les servir) ; ③ quater **les quatre seuils de D23
restent séparés**.

## ⛔ CE QUE J'AI CRU, PUIS RÉFUTÉ

1. **« La porte est à sens unique — la molette ne fait plus rentrer. »**
   ⛔ **Faux, 8/8, et c'était l'hypothèse qu'on m'a donnée en entrant.** Le crop
   renaît à chaque fois, entre 30 807 et 31 746 m. ⚡ **Si je l'avais crue, j'aurais
   cherché un verrou de renaissance qui n'existe pas** — et le vrai défaut, une
   pente de 1 à 3,6 entre l'aller et le retour, serait resté. **Une attribution
   n'est pas une mesure**, et celle-ci désignait le bon fichier pour la mauvaise
   raison.

2. **« C'est la poussée qui reste armée après la sortie. »**
   ⛔ **Faux** — c'était l'hypothèse la plus probable du brief. `poussee` est
   relevée à **false** dès la mort du crop dans les 8 passes ; `annulerPousseeSortie`
   fait son travail, `surBasculeCrop` aussi. Le défaut n'est pas que la poussée
   *continue*, c'est **où elle s'arrête**.

3. **« Il suffit de plafonner le pas par image. »**
   ⛔ **Faux, et je l'ai écrit, mesuré, puis retiré.** `PAS_SORTIE_MAX_LOG = 0,12`
   borne magnifiquement le survol — mort à **40 366 – 41 654 m, 8/8** — mais à
   `dt = 0,06 s` il **divise le taux par trois**, et la sortie passe de 8-9 crans
   à **15 · 18 · 19 · 22 · 22 · 24 · 25 · 40** (`apres-retour-8.json`).
   ⚡ **J'ai failli livrer un correctif qui rachetait une moitié du critère en
   perdant l'autre**, et le tableau aurait été vert sur la ligne que je regardais.
   Écrêter au **RESTE** donne les deux : pleine vitesse tant qu'il reste du
   chemin, pas d'à-coup au bout. Le test `② bis` interdit nommément son retour.

4. **« Le bouton map monde ne fait plus renaître le crop — 6 chargements sur 6. »**
   ⛔ **Faux, et c'était MON banc.** Plafond de 120 crans sur une descente
   orbitale qui part de 16 000 km. La courbe était monotone du premier au dernier
   cran. ⚡ **C'est le même piège que le voile `.ce-elemwrap` de SORTIE** : un
   dispositif qui rend la main trop tôt et un agent qui écrit « c'est cassé ».

5. **« Les 42 crans de la première passe sont une régression. »**
   ⛔ **Faux** : l'altitude de mort de cette passe vaut 41 682 m, dans le mille
   comme les sept autres. Le compte de crans **mesure un temps** (la poussée
   court seule, l'utilisateur a lâché depuis le 3ᵉ cran), donc il mesure la
   cadence — et la première passe compile les nuanceurs. **Le vrai critère de
   la sortie n'est pas le nombre de crans, c'est l'altitude atteinte** ; le
   nombre de crans est ce qu'Adrien voit, et il faut le donner, mais il ne faut
   pas le lire comme un effort.

6. **« L'inclinaison peut monter au-dessus de `SEUIL_MORT_M`. »**
   ⛔ **Faux, 16 chargements** : elle fait BAISSER l'altitude de cadrage, dans
   les deux sens de glissé. La ligne du critère est donc invérifiable au geste,
   et je le dis plutôt que de cocher une case (§ ⑥).

## LES OCTETS, ET LES OUTILS

- ⚠️ **Fins de ligne relues à l'octet** : `grep -c $'\r'` rend **0** sur
  `src/main.js`, `src/modes.js`, `test/porte-crop.test.js`, `package.json` et
  `scripts/sonde-porte.mjs`. `package.json` a été édité **en binaire**
  (`io.open(..., newline='')`), pas par un outil de texte.
- **Un banc neuf** : `scripts/sonde-porte.mjs` — épreuves `retour`, `ar3`,
  `monde`, `inclin` ; `127.0.0.1`, vol de démarrage attendu (distance stable
  1,5 s, `d > 100` — la pose tombe **à cheval** sur le seuil de naissance), voile
  levé jusqu'à ce qu'`elementFromPoint` rende le `CANVAS`, **sonde au rendu**
  (`altitudeCadrageM`, espace bloc — jamais `altFondM`), un chargement par
  situation.
- **Aucune ligne de `src/` touchée par les bancs.**

## LES TRACES

`.banc/PORTE/` — **`avant-retour-8.json`** (le défaut : sortie 8-10 / retour
21-32, mort 41 119 – 58 160 m), `apres-retour-8.json` (le plafond de pas fixe,
réfutation n° 3), **`apres2-retour-8.json`** (le correctif : sortie 8-10 / retour
21-22, mort 41 124 – 41 814 m), **`apres-ar3-4.json`** (12 allers-retours),
`apres-monde-8.json`, `apres-inclin-haut-8.json`, `apres-inclin-z11-8.json`,
**`apres-d19-8.json`** (la non-régression D19, quatre gestes × 8 chargements).
