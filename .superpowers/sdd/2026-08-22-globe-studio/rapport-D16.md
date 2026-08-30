# RAPPORT D16 — UNE SEULE CAMÉRA

> Arbre `C:\Dev\wt-vue`, branche `vue-unique`, partie de `6157862`.
> Matériel : ANGLE (NVIDIA RTX 3080, D3D11), Chrome sans tête 1280 × 800, port 5537.
> URL : `?terre=unique&frontiere=1&seuil=1&globe=continu&socle=quadtree&f3=0&planete=eclairee&soleil=heure`
> ⚠️ **Un seul poste, un seul lieu** (La Réunion, le lieu de démarrage par défaut).
> Tout chiffre de ce rapport est le mien, relevé par `scripts/sonde-d16.mjs`.

---

# ÉTAPE 1 — LA LIGNE DE BASE EST REPRODUITE

**Statut : ✅ l'instrument marche chez moi et rend les chiffres de l'inventaire.**

Trace `.banc/D16/base-desc1.json` — 1 014 images, 0 erreur de page, descente à la
molette depuis `MAX_ALT_M = 60 000 000` m jusqu'au premier crop.

| ce que l'inventaire annonce | ce que je relève |
|---|---|
| franchissements 11,863 / 6,117 / 2,935 / 1,435 / 0,710° | **11,863 / 6,117 / 2,935 / 1,435 / 0,710°** |
| traversée orbite → surface à ≈ 12 000 km | **11 970 932 m** |
| `dImg` de la traversée 29,00 / 29,01 / 29,30 | **29,050** |
| MAX rapport d'altitude de fond 1,0822 – 1,0884 | **1,0847** |
| MAX déplacement relatif du fond 0,1303 – 1,1312 | **0,13132** |
| axe du bloc au franchissement : 0,000° | **0,000°** |

➡️ **Reproduit au millième sur les cinq franchissements.** Je pars donc de sa
ligne de base sans la rediscuter.

---

# ÉTAPE 2 — L'ANCRE : LA PIRE RUPTURE TOMBE SANS TOUCHER À L'ARCHITECTURE

**Statut : ✅ livré, mesuré, testé.**

## Ce qui a été mesuré AVANT d'écrire une ligne

L'inventaire nomme la cause (`quaternionDeBase(ancre)`, ancre snappée sur la
grille de tuiles) mais ne dit pas par quoi la remplacer. J'ai **étendu la sonde**
— pas reconstruit : `sonde-d16.mjs` relève désormais, par image, le lat/lon de
**trois ancres candidates**, avec l'arithmétique de `geo.js`, et le lecteur en
sort le déplacement en **degrés d'arc d'une image à l'autre**. C'est la grandeur
qui prédit la rupture : `quaternionDeBase` tourne du même angle que l'ancre.

Trace `.banc/D16/ancres1.json` — 1 059 images, mêmes conditions.

| ancre | médiane | p95 | p99 | **MAX** | au cran z3 → z4 |
|---|---|---|---|---|---|
| **centre du bloc** (le dépôt) | 0,000° | 8,538e-7° | 8,538e-7° | **15,2215°** | **15,2215°** |
| aplomb de la **caméra** | 0,03815° | 0,3711° | 1,882° | 6,5938° | 2,0725° |
| **aplomb de la CIBLE** | **0,000159°** | **0,002547°** | **0,005309°** | 7,6643° | **0,2138°** |

Aux quatre franchissements de surface, ancre-centre → ancre-cible :
**15,2215 → 0,2138°**, **7,7183 → 0,0291°**, **3,7829 → 0,0295°**.
Le seul endroit où l'ancre-cible bouge encore beaucoup (7,6643°) est **la
naissance du bloc** à la traversée orbite → surface : il n'y avait pas de cible
avant, ce n'est pas un franchissement.

➡️ **Le centre du bloc est un artefact de la grille de tuiles slippy** : il ne
bouge JAMAIS (médiane exactement 0,000°) puis saute de 15° en une image.
**L'aplomb de la cible traverse le cran** parce que `_rescale` repose la cible
sur le nouveau bloc et que `_suivreEmprise` y raccroche la caméra : le LIEU visé
est continu, par construction.

## Le geste

`poseFond` reçoit un paramètre `origineBloc` (défaut `[0,0,0]` — **le dépôt au bit
près**, verrouillé par un test) qui dit quel point du bloc se pose sur la sphère
au lat/lon donné. `majCameraFond` lui passe l'aplomb de `controls.target`.
⚠️ **x et z seulement, jamais y** : le plan `y = 0` est ce qui se pose sur la
sphère, la cible vit à `Y_CIBLE = −0,3` ; lui retrancher son `y` enfoncerait la
planète de 1 340 m à z12 et de 75 km à z3.

## Le résultat, même instrument, même geste

Trace `.banc/D16/ancre-fix1.json` — 1 035 images, 0 erreur de page.

| grandeur | **avant** (`base-desc1`) | **après** (`ancre-fix1`) |
|---|---|---|
| **MAX rotation de visée du fond** | **11,863°** | **1,500°** ⚡ |
| MAX inclinaison image à image du fond | 3,8005° | **0,51860°** |
| **MAX déplacement relatif du fond** | **0,13132** | **0,022875** |
| MAX rapport d'altitude de fond | 1,0847 | **1,0286** |
| p99 `dImg` | 2,333 | **1,462** |
| MAX `dImg` | 29,050 | 28,796 |
| médiane `dImg` | 0,3563 | 0,3521 |

⚡ **LES CINQ FRANCHISSEMENTS ONT DISPARU DU RELEVÉ.** Après correction, les plus
gros déplacements de la caméra de rendu de toute la descente sont des **crans de
molette ORBITAUX** (altitude de fond > 22 000 km, rotation de visée 0,000°,
`dImg` < 0,8) — c'est-à-dire du mouvement voulu, pas une rupture.

**Le 1,500° qui reste est le plafond que R4 s'est donné** (`PAS_POSE_MAX_DEG`) :
sur ces images la caméra du BLOC tourne aussi de 1,500°, donc les deux caméras
sont d'accord. C'est le balayage de pose, traité à l'étape 5, pas un décrochage.

**Effet secondaire non cherché, et il est gros** : la traversée orbite → surface
(rupture ① de l'inventaire) perd elle aussi son mouvement de caméra —
axe **3,376° → 0,192°**, déplacement relatif **3,56e-2 → 2,20e-3**, rapport
d'altitude **1,0003 → 1,0000**. Son `dImg` de 28,8, lui, ne bouge pas : **c'est
un changement de SCÈNE, pas de caméra**, et il reste entier.

## Ce que ça coûte, et je le publie du côté défavorable

⚠️ **Ce n'est pas neutre au bit près, et ça ne peut pas l'être.** La similitude
est exacte au point d'ancrage et approchée ailleurs (plan tangent). Ancrer sur la
cible met l'exactitude **au centre de la vue** au lieu du centre du bloc ; l'écart
entre les deux est du second ordre (`d²/2R`, soit 17 km pour un bloc de
14 005 km à z3 — 0,12 % de sa largeur).
Mesuré : la médiane de `dImg` passe de **0,3563 à 0,3521** et le p95 de **0,9833
à 0,9854** — l'image de régime courant est indiscernable. La naissance du crop
rend `dImg` **15,72** contre 13,32 chez moi et 11,24 / 13,49 / 17,2 dans les trois
sessions de l'inventaire : **c'est dans la dispersion de session, je ne
revendique donc aucune amélioration ni aucune dégradation là-dessus.**

## Fichiers touchés

- `src/monde/frontiere-rendu.js` — `poseFond` gagne `origineBloc`
- `src/main.js` — `latLonOrigineBloc()` généralisée en `latLonDuBloc(x, z)` ;
  `majCameraFond` ancre sur `controls.target`
- `test/frontiere-rendu.test.js` — **+3 tests**, dont celui qui compte : un
  franchissement de niveau simulé (bloc rebâti deux fois plus fin ET recalé
  ailleurs, même géographie visée) rend une pose de fond **identique à 1e-9**
  avec l'ancre-cible, et **plusieurs degrés** avec l'ancre-centre (contre-essai
  obligatoire, sans lui le premier ne prouve rien).
- `scripts/sonde-d16.mjs` — relevé des trois ancres candidates + `dA0/dAC/dAT`

**Tests : 4 296 / 0 échec · audit 221 = 221.** (Base annoncée : 4 293 ; +3 neufs.)

## Réserves de l'étape 2

1. ⚠️ **Un seul poste, un seul lieu.** L'inventaire notait que 11,863° est *une
   valeur, pas un maximum* (borne théorique à z3 ≈ 21°). Je n'ai pas mesuré
   ailleurs : ce que je peux affirmer, c'est que **la cause disparaît**, pas que
   **11,863 était le pire**.
2. ⚠️ **`assietteCrop()` garde le centre du bloc comme ancre du crop**, à dessein :
   c'est une empreinte GÉOGRAPHIQUE, pas une pose de caméra. Le désaccord entre
   les deux est du second ordre. **Vérifié à l'image, pas seulement au calcul —
   voir plus bas.**
3. ⚠️ **La remontée n'est pas encore mesurée** avec la correction.
4. ⚠️ **Le balayage de pose (+32,6 %) n'est PAS traité par cette étape** et ne
   pouvait pas l'être : il vient de `poseFonduArrivee`, pas de l'ancre.
