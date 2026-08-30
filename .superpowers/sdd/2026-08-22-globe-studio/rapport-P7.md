# Tâche P7 — LE TABLIER ET LES JUPES : les deux pièces tournaient dans la mauvaise monnaie

**Statut : LIVRÉE.** · Commits **`dd5ab52`**, **`f7a2adb`**, **`6373339`** sur `regroupement`
(HEAD **`6373339`**, arbre propre après commit).
`npm test` — **4 014 / 4 014** (4 001 au départ, **+13**) · `npm run audit:tests` — **209 / 209** ·
campagne de mutation — **31 / 31**, dont **20 visant le branchement** (64,5 %), **deux mutations
retirées comme NEUTRES plutôt que comptées**.

> **Le brief :** *« LE TABLIER — 41 949 pixels contre 428 au socle, ×98 »* · *« LES JUPES —
> 12 langues, 2 186 px contre 3 px »*.
> **P4, cité par le brief :** *« LE SOCLE A UN RIDEAU D'EAU QUE LE CROP N'AVAIT PAS. »*

**Les deux sont fermés. Et le brief se trompe sur la cause du premier — je le dis d'entrée,
parce que c'est ce qui a fait gagner du temps.**

---

## 0. ⛔ CE QUE J'AI VU À L'ÉCRAN, CÔTE À CÔTE AVEC LE SOCLE

**Tout est dans `.banc/P7/` — 46 captures, 12 relevés JSON, le harnais, le pilote et la
campagne.** Cadre **1 280 × 800 = 1 024 000 px**, La Réunion z12, `fov = 33`, vue isométrique 0,
**socle RALLUMÉ DANS LA MÊME PAGE**, rendu **sans compositeur** dans une cible **à profondeur**,
**boucle rAF coupée**, **look = OCTET LINÉAIRE** (le seul calibré par la notation-02).

**Le triptyque à regarder, et il se lit en une seconde :**

- **`A1-CROP-cote-P7.png` → `Z1-CROP-bloc-FINAL--21.05-P7.png` → `Z2-SOCLE-bloc-apparie-FINAL--21.05-P7.png`.**
  AVANT : le long de tout le flanc mouillé, **une nappe pâle à bord festonné et lobé** passe
  par-dessus l'arête haute de la paroi terracotta — c'est le « tablier ». APRÈS : la mer
  rencontre le mur **le long d'un seul fil cyan**. SOCLE : la même chose.
- **`E0-zoom6-CROP-tel-quel-P7.png` ↔ `E1-zoom6-CROP-sens-retourne-P7.png` ↔ `E2-zoom6-SOCLE-P7.png`**
  (×6, la même découpe, la même seconde) — **l'A/B qui a tout dit.** Le tablier disparaît en
  retournant **deux lignes d'index**, et l'image devient celle du socle.
- **`G0z-CROP-jupes-telquel--21.115-P7.png` ↔ `G1z-CROP-jupes-remontees--21.115-P7.png`** — les
  langues de tuile qui pendent sous le bloc, et leur disparition.
- **`Y1-zoom6-CROP-masques-FINAL-P7.png`** — la carte fausses couleurs des quatre pièces
  (magenta = nappe, **jaune = rideau d'eau**, vert = paroi, bleu = tuile nue). C'est elle qui
  nomme chaque chose au lieu de la deviner.

### ⛔ ET NON, ÇA NE RESSEMBLE TOUJOURS PAS AU SOCLE

Ce qui sépare encore les deux images, sur MON cadrage :

1. ⛔ **DEUX LAMES SOMBRES DE RIDEAU PASSENT DEVANT LA PAROI — et c'est MOI qui les ai rendues
   visibles.** Mesuré : **467 px**, en deux langues effilées. Avant ma réparation le rideau
   était éliminé au culling, il ne pouvait donc rien traverser. **La cause est mesurée**
   (§5) : le HAUT du ruban prend le déplacement **horizontal** de houle pendant que son bas est
   cloué au fond du bloc — il se cisaille et sort de la frontière. **Je ne l'ai pas fermé, et
   je dis pourquoi au §5, réserve n° 1 du §8.**
2. ⛔ **La mer du crop reste plus claire et sans bleu profond** — manque n° 2 du noteur, autre
   tâche. Sur `Z3` contre `Z4`, le socle est un bleu de nuit et le crop un turquoise.
3. ⛔ **Le relief du crop reste brun-rosé là où le socle est olive** — manque n° 5, autre tâche.
   Visible d'un coup d'œil sur `F1` contre `F3` au cadrage intérieur.
4. **Je n'ai rien mesuré en MOUVEMENT** (§8, réserve n° 6).

---

## 1. ⛔ LE BRIEF ET P4 SE TROMPENT SUR LA CAUSE DU TABLIER

Le brief : *« Ne repars pas de zéro : la Tâche P4 a déjà trouvé pourquoi… LE SOCLE A UN RIDEAU
D'EAU QUE LE CROP N'AVAIT PAS. »* Et : *« Le noteur classe ce point “cher — accord de géométrie
à trois”. »*

**Le crop AVAIT son rideau d'eau. P4 l'a bâti et livré : 1 020 points d'anneau, 2 040 sommets,
2 040 triangles, relevés dans la page vivante. Il ne se DESSINAIT pas.**

`construireJupeMer` posait ses triangles ainsi :

```js
indices[m++] = i; indices[m++] = n + i; indices[m++] = j
indices[m++] = j; indices[m++] = n + i; indices[m++] = n + j
```

`construireSolideCrop` (`parois-crop.js` §④), **sur le MÊME anneau, avec le MÊME agencement**
(0…n−1 en haut, n…2n−1 en bas), pose :

```js
indices[w++] = k; indices[w++] = j; indices[w++] = n + k
indices[w++] = j; indices[w++] = n + j; indices[w++] = n + k
```

**C'est l'exact inverse.** Le commentaire de P4 écrivait pourtant, juste au-dessus : *« Le sens
de parcours suit celui des parois. »* Il ne le suivait pas. Les faces avant du rideau pointaient
vers l'**intérieur** du bloc.

⚡ **ET LE MATÉRIAU EST EN `FrontSide`.** Relevé dans la page vivante le 2026-08-22 :
`globe._mer.material.side = 0`, quand la jupe du socle est `side = 2` (`DoubleSide`, choisi
explicitement par `ocean.js`). **Sur chaque flanc tourné vers la caméra, le rideau était donc
éliminé au culling** ; ce qui restait, c'étaient les faces internes des flancs LOINTAINS, que
le bloc cache presque entièrement.

**Mesuré, solide éteint** (`.banc/P7/S4-rideau-P7.json`) :

| le rideau seul, rendu | pixels |
|---|---|
| `FrontSide` (l'état livré) — les flancs LOINTAINS, face interne | **52 264** |
| `BackSide` — les flancs PROCHES, face externe | **19 888** |
| `DoubleSide` | 68 526 |
| ⛔ **`FrontSide`, avec le bloc devant** | **1 519** |

➡️ **Le rideau existait à 52 264 px de géométrie et n'en rendait 1 519.** Par le trou, on voyait
la lèvre nue du fond marin passer par-dessus l'arête haute de la paroi : **c'est ça, le
tablier.**

⚠️ **ET CE N'ÉTAIT PAS CHER.** Le noteur classait le poste « cher — un accord de géométrie à
trois ». **La réparation fait deux lignes**, et elle consiste à écrire ce que le commentaire
prétendait déjà.

---

## 2. LA MESURE DU TABLIER — ET POURQUOI JE NE PUBLIE PAS DE « ×98 »

⚠️ **JE N'AI PAS RETROUVÉ LA CONVENTION DU NOTEUR, ET JE NE L'INVENTE PAS.** Son script n'est
pas sur le disque ; seuls ses résultats le sont (`M-nappe-contre-paroi-N02.json` : nappe dans la
bande de la paroi, **41 949** contre **428**). J'ai calculé **cinq** définitions plausibles sur
les mêmes masques, au même endroit, dans la même page (`.banc/P7/S2-zooms-P7.json`) :

| définition | crop | socle |
|---|---|---|
| bande verticale de la paroi, colonne par colonne | 824 | 739 |
| intersection nue des deux masques | 135 | 7 |
| mer hors de la silhouette du bloc | 211 | 11 313 |
| bande GLOBALE des lignes de paroi | 53 650 | 70 626 |
| au-dessous du haut du mur, par colonne | 824 | 739 |

**Aucune ne rend 41 949 / 428.** ➡️ **Je ne reprends donc pas son « ×98 ».** J'écris la mienne,
je la déclare, et — c'est ce qui compte — **elle est validée ailleurs** : la même convention,
appliquée aux JUPES, retombe **au pixel et à la colonne** sur ses chiffres à lui (§4).

### LA MESURE QUE J'EMPLOIE : LE LISÉRÉ NU SUR LES COLONNES MOUILLÉES

Pour chaque colonne d'écran : la dernière ligne de mer, la première ligne de mur, et ce qu'il y
a entre — c'est-à-dire **les pixels de fond marin NU qui restent entre la nappe et l'arête haute
de la paroi.**

⚠️ **ET ON NE COMPTE QUE LES COLONNES MOUILLÉES**, c'est-à-dire celles où le SOCLE, lui, amène
son eau jusqu'à son mur (liséré ≤ 5 px). **Sur une colonne de TERRE les deux blocs ont le même
grand écart** — la plage, la falaise — et la compter mélangerait deux choses : ma première
version, qui les comptait toutes, rendait **48 906 pour le crop et 44 196 pour le socle**, un
rapport de 1,1 qui ne disait rien. **Ce chiffre-là est retiré.**

### L'A/B, À TÉMOIN NUL, DANS LA MÊME PAGE

On retourne le sens de parcours des 2 040 triangles **directement dans le tampon d'index** —
aucune source modifiée (`.banc/P7/S5-ab-rideau-P7.json`) :

| sur les **210 colonnes mouillées** | liséré nu | rideau visible |
|---|---|---|
| **tel quel** | **5 314 px** (25,3 px/colonne, pire 43) | 1 519 px |
| ⚡ **sens retourné** | **186 px** | **6 642 px** |
| `DoubleSide` sur le sens fautif | 186 px | 6 695 px |
| retourné + `DoubleSide` | 186 px | 6 695 px |
| **retour** | **5 314 px** | **1 519 px** — ⚡ **au pixel** |
| **SOCLE, apparié** | **441 px** | — |

➡️ **Le liséré tombe de 5 314 à 186 px. Le socle en rend 441.**
➡️ ⚡ **`DoubleSide` rend EXACTEMENT la même image que le sens corrigé** : il ne fait que
rattraper le culling. **On répare le sens, on ne paie pas la seconde face** — le ruban est un
anneau fermé autour d'un bloc opaque, sa moitié lointaine est de toute façon cachée.

**Re-mesuré APRÈS le commit**, dans une exécution neuve : liséré crop **179 px**, socle
**436 px**, sur 207 colonnes mouillées.

⚠️ **ET JE NE RÉCLAME PAS D'AVOIR FAIT MIEUX QUE LE SOCLE.** 179 contre 436, c'est
**0,86 px par colonne contre 2,1** : deux façons de rendre un liséré d'antialiasing d'un ou deux
pixels. **Ce n'est pas « mieux », c'est « la même chose ».**

---

## 3. ⛔ CE QUE LA CAROTTE A MONTRÉ, ET QUI VAUT PLUS QUE LE CHIFFRE

Avant de coder, j'ai relevé **l'empilement vertical des masques colonne par colonne**
(`.banc/P7/S3-carottes-P7.json`). Colonne 368, crop contre socle, même page, même seconde :

| | crop (avant) | socle |
|---|---|---|
| | `T:349-350` tuiles nues | `E:351-381` **EAU SEULE** (la jupe du socle) |
| | `MCT:351-450` mer sur tuiles | `ET:382-490` eau sur relief |
| | ⛔ **`T:451-490` — 40 LIGNES DE TUILE NUE** | `T:491-492` — **2 lignes** |
| | `P:491-543` paroi | `P:493-539` plinthe |

➡️ **Le socle a une pièce d'EAU SEULE de 31 lignes là où le crop n'a rien, et 2 lignes de fond
nu là où le crop en a 40.** C'est le rideau, et c'est ce que la carotte dit sans qu'on ait à
regarder une image.

---

## 4. LES JUPES DE TUILE — UNE VALEUR JUSTE DANS LA MAUVAISE MONNAIE, LA QUATRIÈME

`_buildMesh` rabat le contour de chaque tuile vers le centre de la planète pour cacher les
fentes entre niveaux de détail :

```js
const skirtDrop = Math.min(Math.max(t.chord * 0.012, 0.1), 0.9)
```

**Entre 0,1 et 0,9 unité de scène, sur une planète de rayon 100.** Le bloc du crop, lui, fait
**0,0507 unité d'épaisseur** au cadrage intérieur et **0,0955** au cadrage côte (relevé). **La
jupe traverse donc le fond du bloc et pend dessous.** C'est la même faute que la tavelure de P4,
que le budget de fond de P5 et que la houle de P6.

**Mesuré au cadrage intérieur, avant** (`.banc/P7/S7-ab-jupes--21.115-P7.json`) :

| | pixels sous l'arête basse | langues |
|---|---|---|
| **crop** | **2 186** | **12** |
| socle apparié | 0 | 0 |

⚡ **ET CE SONT, AU PIXEL ET À LA COLONNE, LES CHIFFRES DU NOTEUR.** Son `F-jupes-N02.json`
donne `2186`, `12`, et les colonnes
`[269, 328, 380, 436, 498, 711, 766, 823, 869, 917, 962, 982]` — **les miennes sont les mêmes,
dans le même ordre.** ➡️ **Sa convention de mesure et la mienne sont la même**, et c'est ce qui
autorise à lire le §2 malgré le désaccord sur le tablier.

### L'A/B, À TÉMOIN NUL

On remonte les sommets de jupe au plancher du bloc **dans le tampon de positions**, aucune
source modifiée :

| | sous l'arête basse | langues |
|---|---|---|
| tel quel | 2 186 px | 12 |
| ⚡ **jupes remontées au plancher** | **1 px** | **1** |
| **retour** | **2 186 px** | **12** — ⚡ **colonne pour colonne** |

### ⛔ ET L'ORDRE EST LE PIÈGE — C'EST LUI QUI FAIT LE TRAVAIL, PAS LA BORNE

**Les parois exigent des tuiles bâties** (elles échantillonnent leurs hauteurs pour leur
`couverture`), donc **le fond du bloc naît TOUJOURS après les tuiles du premier bloc**. Borner
dans `_buildMesh` seulement n'aurait rien changé au bloc d'ouverture — et ça se serait vu à
l'écran, pas en test.

D'où la forme livrée :
- `rabattementBorne(rabattement, rayonSommet, rayonPlancher)` — **loi pure**, dans
  `parois-crop.js`, testable sous node ;
- `Globe._rayonPlancherCrop(t)` — **deux gardes** : pas de parois → pas de plancher ; tuile hors
  de l'emprise (`tuileDansCrop`, le même test que le raffinement) → pas de plancher ;
- `Globe._retaillerJupe(t)` — **IDEMPOTENTE**, elle recalcule chaque sommet de jupe **depuis son
  sommet de BORD**, jamais depuis sa position courante ;
- appelée par `_buildMesh` (tuile qui arrive sur un bloc déjà là) **ET** par `poserParoisCrop`
  (bloc qui arrive sur des tuiles déjà là) ;
- `retirerParoisCrop` **remet `_baseYCrop` à nul — il survivait** — et rend aux jupes leur pleine
  longueur.

### ⛔ ET LA SECONDE SORTIE DU NOTEUR NE POUVAIT PAS MARCHER — MESURÉ

Le brief : *« Deux sorties nommées, aucune mesurée : couper la jupe par sa hauteur radiale, ou
ne pas bâtir de jupe sur une tuile qui touche la frontière. »*

**Relevé dans la page vivante : 168 tuiles sur 168 ont des sommets de jupe sous le plancher**, y
compris en plein milieu du bloc. Ce qu'on VOIT, ce n'est pas « les jupes de frontière », c'est
**ce qui dépasse de la SILHOUETTE**. ➡️ **La seconde sortie aurait laissé les douze langues.**

### APRÈS, DANS LA SOURCE

| | crop | socle |
|---|---|---|
| cadrage intérieur — sous l'arête basse | **1 px, 1 langue** *(avant : 2 186, 12)* | 0 |
| cadrage côte — sous l'arête basse | **0 px, 0 langue** *(avant : 29, 4)* | 0 |
| sommets de jupe sous le plancher | **0 sur 36 tuiles visibles** *(avant : 29 tuiles, pique 0,004 49 unité)* | — |

⚠️ **LE PLANCHER EST UN PLAN, ON LE BORNE PAR UNE SPHÈRE, ET L'ÉCART EST CHIFFRÉ** : la flèche
du crop vaut **3,68 m**, soit **5,8·10⁻⁵ unité de scène**, **0,06 % de l'épaisseur du bloc**,
c'est-à-dire **six centièmes de pixel** au cadrage de ce banc. Dit dans le code plutôt que caché.

---

## 5. ⛔ CE QUE J'AI CASSÉ EN RÉPARANT, ET JE LE MESURE

**Le rideau, désormais dessiné, passe DEVANT la paroi sur 467 px, en deux lames effilées.**
Visible sur `Z3-zoom6-CROP-flanc-FINAL--21.05-P7.png`, absent de `Z4` (le socle).

**La cause, mesurée, aller-retour exact** (`.banc/P7/S11-houle-P7.json`) :

| | rideau devant la paroi |
|---|---|
| houle vive (`uMerHoule = 2`) | **467 px** |
| ⚡ **`uMerHoule = 0`** | **115 px** |
| retour | **467 px** |

➡️ **352 px sur 467 (75 %) viennent du déplacement HORIZONTAL de houle.**

**Le mécanisme, et il est arithmétique.** `MER_VERT` applique au HAUT du ruban
`p.x += disp.x ; p.z += disp.z` — comme à la nappe, et c'est **délibéré** : c'est ce qui les
soude « au bit près » (Tâche P4). Son BAS, lui, est cloué au fond du bloc. **Le ruban se
cisaille donc.** Amplitude relevée le même instant :

| | valeur |
|---|---|
| `uMerHoule × uMerCalmeVue × uMerUnite` | **0,007 122** unité de scène |
| retrait d'eau du crop (`RETRAIT_EAU_CROP` × demi-côté) | **0,000 845** unité de scène |
| ⛔ **rapport** | ⛔ **8,4 fois** |

**Le haut du ruban balance huit fois plus loin que son retrait.** Il sort donc régulièrement de
la frontière, et passe devant le mur.

**Et le socle ne fait PAS ça** : `SKIRT_VERT` (`ocean.js`) n'applique à sa jupe que la verticale
— `y = uWaterY + dy` puis `vWorld = vec3(p.x, y, p.z)` — **son xz est FIXE**. Là-bas la nappe est
découpée sur `vWorld.xz` **DÉPLACÉE**, donc son bord ne quitte jamais la dalle ; ici elle est
découpée sur `vCrop`, c'est-à-dire sur `aCrop` **NON déplacé**.

**⚠️ POURQUOI JE NE L'AI PAS FERMÉ — et ce n'est pas de la prudence de façade.**
Ne plus déplacer le haut du ruban **défait la soudure que P4 a bâtie** : la nappe s'éteint au
paramètre 0,992 143 et sa géométrie y est déplacée de ±0,007 unité pendant que le ruban, lui,
resterait immobile. `ocean.js` écrit lui-même ce que ça coûte : *« si les deux divergeaient d'un
millimètre, un jour s'ouvrirait entre la jupe et la mer sur tout le périmètre du bloc. »*
**Ce n'est donc pas un signe à changer, c'est un arbitrage à trancher entre trois pièces** — et
il touche `bordDeMer`, ses tests, et le choix de P4 de faire s'arrêter la nappe **en retrait**
là où celle du socle va **jusqu'au mur**. ⚠️ **J'ai tenté l'expérience à l'écran et elle n'a
pas conclu** : le maillage de mer a été rebâti sous mon témoin, l'aller-retour a rendu
**63 707 canaux d'écart** au lieu de zéro, **et je retire cette mesure-là** plutôt que d'en tirer
un verdict (`.banc/P7/S12-vertical-P7.json`, gardé sur le disque avec ce défaut).

➡️ **Poste ouvert, chiffré, et nommé : 467 px, dont 352 de houle horizontale.** À mettre en face
des **5 314 px** de tablier qu'il remplace.

---

## 6. LES TESTS ET LA CAMPAGNE DE MUTATION

**+13 tests** : `test/ecume-mer.test.js` §⑤bis (4, le sens du rideau), `test/crop-parois.test.js`
(4, la loi pure), `test/globe-precision.test.js` (5, le branchement de la jupe).

Ce qu'ils gardent, et **pourquoi les précédents ne le gardaient pas** :

- ⑤bis-a **le rideau pose EXACTEMENT le même tableau d'indices que les PAROIS** — l'étalon n'est
  pas une convention recopiée, **c'est l'autre pièce**, dont `test/crop-parois.test.js` exige
  déjà le volume signé positif ;
- ⑤bis-b **chaque triangle regarde DEHORS**, normale calculée, et **la normale est horizontale**
  (sans cette seconde assertion, un ruban couché à plat passerait le signe) ;
- ⑤bis-c **MUTATION : le ruban retourné passe la fermeture et tombe sur le VOLUME SIGNÉ** —
  `auditerSolide`, l'instrument du dépôt, pas un second écrit pour l'occasion ;
- ⑤a, ⑤b et ⑤c **ne pouvaient pas le voir** : un ruban retourné a le même compte de triangles,
  le même retrait et les mêmes erreurs.

### La campagne — `.banc/P7/mutations-P7.mjs`, worktree `C:/Dev/wt-p7-mut`, **retiré en partant**

`node_modules` en **jonction** ; **`git ls-files --eol` vérifié `i/lf w/lf`** sur les **neuf**
fichiers en jeu — aucun faux survivant possible.

**31 mutations sémantiques, dont 20 visant le BRANCHEMENT (64,5 %).**

- **Premier tour : 24 / 31**, une non appliquée.
- ⛔ **Les trois vraies survivantes visaient toutes le même angle mort, et je les nomme :**
  - **4c** — un sommet de jupe écrit sous un AUTRE sommet de bord. **La permutation était
    appliquée PARTOUT**, y compris à la construction : tous les comptes, toutes les distances et
    même la comparaison « avant / après » restaient d'accord avec eux-mêmes. Le test exige
    désormais la **colinéarité** de chaque sommet de jupe avec le sien.
  - **4d** — `needsUpdate` non levé : le tampon change et **le GPU garde l'ancien**. Aucune
    comparaison de tampon ne peut le voir ; `attr.version` est le seul témoin.
  - **4e** — une tuile SANS jupe comptée comme retaillée : le compte devenait un compte de
    tuiles.
- ⛔ **DEUX MUTATIONS ONT ÉTÉ RETIRÉES COMME NEUTRES PLUTÔT QUE COMPTÉES**, et c'est écrit dans
  le fichier de campagne :
  - `!(rayonPlancher > 0)` → `!(rayonPlancher >= 0)` : avec un plancher NUL le corps rend
    `min(rabattement, max(0, rayonSommet))` = `rabattement` dès que le rayon dépasse le
    rabattement — **c'est-à-dire toujours**, sur une planète de rayon 100. Elle ne prouvait rien.
  - la suppression de `this._baseYCrop = null` **du CONSTRUCTEUR** :
    `Number.isFinite(undefined)` est faux exactement comme `Number.isFinite(null)`. Cette ligne
    est une **déclaration de lisibilité**, pas une garde. **La compter aurait fait croire à un
    trou de test.**
  Les deux sont remplacées par des mutations qui mordent, sur le même branchement.
- **Second tour : 31 / 31, une seule non appliquée corrigée, aucune survivante.**
  `.banc/P7/resultat-mutations-P7.json`.
- **Chaque mutation est remise sur le disque, les tests rejoués pour confirmer l'échec, puis le
  fichier restauré** ; `git diff --stat` du worktree vérifié **vide** avant retrait.

---

## 7. CLÔTURE

- `npm test` — **4 014 / 4 014** (4 001 au départ, **+13**).
- `npm run audit:tests` — **209 / 209**, aucun écart.
- `node --check` — vert sur `src/globe.js`, `src/monde/parois-crop.js`, `src/monde/mer-sphere.js`,
  `test/crop-parois.test.js`, `test/globe-precision.test.js`, `test/fond-crop.test.js`,
  `test/ecume-mer.test.js`.
- **CRLF, SUR TOUTE LA PLAGE DE MES COMMITS** — `git diff --stat f78cb3f..HEAD` et
  `git diff --ignore-cr-at-eol --stat f78cb3f..HEAD` rendent **exactement le même compte** :
  **626 insertions, 7 suppressions, 7 fichiers**.
- **Arbre propre après commit**, **worktree de mutation retiré** (`git worktree list` ne le porte
  plus, le dossier n'existe plus).
- **Page chargée, drapeau BAISSÉ** (`?globe=continu&socle=quadtree&f3=0&frontiere=1&seuil=1`) :
  `terrain.mesh.visible = true`, plinthe visible, `real-water` visible avec ses **deux**
  maillages, **aucune mer ni paroi de crop**, `_baseYCrop = null`, **946 tuiles dont 754 portent
  `userData.jupe`**, 30 programmes, **zéro erreur grave** (recherche
  `shader|GLSL|program|Uncaught|TypeError|ReferenceError`).
- **Page chargée, drapeau LEVÉ** (`?terre=unique&…`) : `refus` **vide**, rideau
  **1 020 / 2 040 / 2 040**, `uMerBord = (−0,015 714 ; −0,007 857)`,
  `uMerBasY = −0,095 512 = baseY des parois`, **0 sommet de jupe sous le plancher sur 36 tuiles
  visibles**, 23 programmes, **témoin nul à 0 canal sur 3 072 000**.
- **Appariement du bloc entier**, balayé en deux passes sur un **CLONE** de la caméra du socle,
  dans la même exécution JS que la mesure : cible **215 797 px**, socle **215 756 px** à
  `k = 0,9894` → ⚡ **−0,019 %**, soit **52 fois mieux** que le 1 % demandé. Deux mesures du même
  `k` rendent **215 756 et 215 756**, identiques au pixel.

---

## 8. MES RÉSERVES

1. ⛔ **J'AI INTRODUIT UN DÉFAUT, ET IL EST DANS L'IMAGE LIVRÉE.** 467 px de rideau devant la
   paroi, en deux lames, dont **352 px imputables au déplacement horizontal de houle** (témoin
   `uMerHoule = 0`, retour exact). §5. **Il remplace 5 314 px de tablier — c'est un gain net,
   pas une réussite propre.**
2. ⛔ **UN TÉMOIN NON CONCLUANT, GARDÉ COMME TEL.** Mon essai « le haut du ruban ne prend que la
   verticale » a rendu un aller-retour à **63 707 canaux** au lieu de zéro : le maillage de mer a
   été rebâti sous le témoin. **Aucun verdict n'en est tiré**, et le relevé fautif reste sur le
   disque (`S12-vertical-P7.json`) plutôt que d'être effacé.
3. ⚠️ **JE N'AI PAS REPRODUIT LE « ×98 » DU NOTEUR.** Cinq conventions essayées, aucune ne rend
   41 949 / 428 (§2). **Sa mesure des JUPES, elle, se reproduit AU PIXEL ET À LA COLONNE**, ce
   qui borne le désaccord au seul poste du tablier. **Le sens et l'ordre de grandeur du progrès
   ne font aucun doute ; son facteur exact n'est pas une grandeur que je défends.**
4. ⚠️ **UN CHIFFRE RETIRÉ.** Ma première version du liséré comptait TOUTES les colonnes et
   rendait 48 906 contre 44 196 — un rapport de 1,1 qui mesurait surtout la plage et la falaise.
   **Retiré, remplacé par la restriction aux colonnes mouillées.**
5. ⚠️ **UN SEUL LIEU, DEUX CADRAGES.** Tout est sur La Réunion z12, aux deux endroits de
   notation-01/02. **Un crop continental (pas de mer, donc pas de rideau) ne prend le chemin que
   par test, pas à l'écran** ; un crop de haute latitude non plus.
6. ⚠️ **TOUT EST AU REPOS, BOUCLE GELÉE.** Aucune donnée sur le battement du rideau en
   mouvement, ni sur la soudure quand une crête passe au bord — et c'est précisément là que vit
   le défaut du §5.
7. ⛔ **CE BANC N'EST PAS LA PAGE QU'ADRIEN REGARDE.** Le volet de navigateur de cette session
   n'est pas affiché : `document.visibilityState = 'hidden'` et
   **`requestAnimationFrame` rend 0 image en 3 701 ms** — la chaîne du crop ne se pose JAMAIS
   (`refus` reste à quatre maillons). J'ai donc piloté un **Chrome à part** (puppeteer-core
   emprunté à `C:/Dev/wt-f3`), 1 280 × 800, GPU réel
   (`ANGLE (NVIDIA GeForce RTX 3080, Direct3D11)`). Même code, même GPU, **autre profil**.
   `.banc/P7/NOTE-VOLET.txt`.
8. ⚠️ **LE COÛT N'EST PAS MESURÉ.** `_retaillerJupes()` parcourt TOUTES les tuiles à chaque pose
   de parois — **946 au drapeau baissé, 256 au drapeau levé** — et touche 96 sommets par tuile
   concernée. **Je n'ai chronométré ni ça, ni le rideau désormais dessiné (6 642 px de fond
   transparent de plus).** Je préfère le dire que d'annoncer « négligeable ».
9. ⚠️ **LE `_baseYCrop` REMIS À NUL EST UN CHANGEMENT DE COMPORTEMENT POUR `poserMer` AUSSI.**
   Sa garde `Number.isFinite(basY)` devient vraie après un retrait de parois — c'est ce qu'elle
   voulait dire depuis P4, mais **elle ne le faisait pas**, et je le signale plutôt que de le
   ranger sous « nettoyage ».
10. ⚠️ **`side` RESTE `FrontSide`, ET C'EST UN CHOIX.** `DoubleSide` rend la même image (mesuré,
    186 px des deux façons) pour une seconde face payée. **Si un jour la caméra entre dans le
    bloc** — ce que `_materiauParois` prévoit déjà pour les parois — le rideau, lui, disparaîtra.

---

## 9. CE QUI RESTE SUR LE DISQUE

`.banc/P7/` — **46 captures PNG**, **12 relevés JSON**, `harnais-P7.mjs` (il **IMPORTE**
`../vues-notation-02/harnais-N02.mjs` → P5 → P4 → P3, il ne les recopie pas), `pilote-P7.mjs`
(le Chrome piloté, cadrage côte ou intérieur au choix), `pilote-bas-P7.mjs` (le drapeau baissé),
`recois-P7.mjs` (port 5610), `mutations-P7.mjs`, `resultat-mutations-P7.json`,
`NOTE-VOLET.txt`, et les onze scripts de page `s1` à `s12`.

**Les paires à regarder d'abord :**

- `A1-CROP-cote-P7.png` ↔ `Z1-CROP-bloc-FINAL--21.05-P7.png` — **avant / après, même cadrage**
- `E0-zoom6-CROP-tel-quel-P7.png` ↔ `E1-zoom6-CROP-sens-retourne-P7.png` ↔ `E2-zoom6-SOCLE-P7.png`
  — **l'A/B du sens, ×6, et le socle à côté**
- `G0z-…--21.115-P7.png` ↔ `G1z-…--21.115-P7.png` — **les douze langues, et leur disparition**
- `Y1-zoom6-CROP-masques-FINAL-P7.png` — **qui est quoi**, en quatre couleurs
- `Z3-zoom6-CROP-flanc-FINAL--21.05-P7.png` ↔ `Z4-zoom6-SOCLE-flanc-FINAL--21.05-P7.png` — **ce
  qui reste : les deux lames de rideau du §5**
- `X0-zoom6-CROP-houle-vive-P7.png` ↔ `X1-zoom6-CROP-houle-nulle-P7.png` — **le témoin qui
  attribue 352 px des 467 à la houle horizontale**
