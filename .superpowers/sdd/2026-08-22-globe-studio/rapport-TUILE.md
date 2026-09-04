# RAPPORT TUILE — LA SURCOUCHE EST RETIRÉE, ET CE N'ÉTAIT PAS UNE COUCHE

Arbre `C:\Dev\wt-tuile`, branche `palier-par-tuile`. Serveur : `npx vite --host
127.0.0.1 --port 9917`, arrêté en partant. Chrome sans tête, 1280 × 720, DPR 1,
ANGLE.

> **`npm test` : 4 982 tests · 4 982 réussis · 0 échec.**
> **`npm run audit:tests` : 270 listés · 270 sur disque, 6 hors suite déclarés,
> aucun écart.**

---

## ⚡ VERDICT EN SIX LIGNES

1. **La surcouche est un PALIER, et le palier était une contrainte inventée.**
   `_cropCouvert` / `_majZoomCrop` (CN2) tenaient tout le bloc au niveau grossier
   tant qu'une seule tuile de bord manquait. D25 l'abroge ; le mécanisme est
   retiré, `_zCropServi` vaut désormais `_zCropCible`.
2. ⚡ **Le défaut se voit au CHANGEMENT D'ÉCHELLE, et nulle part ailleurs.**
   `poserCrop` remettait `_zCropServi` à zéro — donc **tout changement d'échelle**
   (`branchement-crop.js` repose le crop dès que `demZoom` ou `tuilesParBloc`
   bouge) rendait le bloc entier à `ZOOM_SOCLE`. **Mesuré au banc : 500 à 788
   retours en arrière de finesse sur 20 images × 49 points, jusqu'à 3 niveaux, la
   cible restant à z16 et les tuiles z16 encore en cache. Après : 0.**
   **Mesuré dans l'application vivante : z15 → z14 pendant ~1 s. Après : z15
   inchangé pendant toute la manœuvre.**
3. **Le verdict sur R37 : le palier ne faisait que le neutraliser.** La correction
   est un **retrait**, pas une écriture — trois lignes de `_traverse` et une
   méthode supprimée. Le raffinement partiel de R37 marchait déjà.
4. **Le temps jusqu'à la netteté au centre BAISSE de 17 à 20 %** (100 → 80 images
   aux Alpes et en Beauce, 96 → 80 à Majorque), **à cache, requêtes et emprise
   identiques au bit près**.
5. **Les cinq acquis sont tenus**, chacun remesuré sur le banc qui les avait
   produits (§4) — px/texel identiques au centième aux 10 cellules, cartouche
   **0 écart sur 912 images**.
6. ⚠️ **Et le troisième volet n'est PAS clos : la teinte n'est pas invariante d'un
   niveau à l'autre** — jusqu'à **11,9/255 d'écart chromatique** et **× 2 de
   saturation** à Majorque. Mais **la rampe, elle, EST invariante par
   construction** ; ce n'est donc pas elle qu'il faut corriger. Le détail, les
   deux hypothèses que j'ai réfutées, et la piste qui reste, sont au §5.

---

## 1. CE QUI A CHANGÉ — QUATRE RETRAITS, AUCUN AJOUT DE MÉCANISME

| pièce | où | ce qui est fait |
|---|---|---|
| **`_cropCouvert`** | `globe.js` | **supprimée** (48 lignes). C'était la condition du palier atomique. |
| **`_majZoomCrop`** | `globe.js` | le palier tombe : `this._zCropServi = this._zCropCible`, un seul régime dans les deux sens. |
| **la prescription** | `globe.js`, `_traverse` | `zoomCropPrescrit(…, _zCropServi …)` reste **écrit tel quel** — mais `_zCropServi` vaut la cible, donc le crop refend au fil de l'eau et R37 fait le reste. |
| **`_prelireCrop`** | `globe.js` | **supprimée**. Sans palier, sa garde `_zCropCible > zCrop` ne pouvait plus être vraie **une seule fois** : c'était devenu du code mort. Les enfants naissent par `wantSplit`, même crédit, même clé de priorité. |

⛔ **`_zCropServi` n'a PAS été supprimé, et c'est délibéré** : `main.js`
(`getZoomCropServi`) et le cartouche le lisent. Il doit continuer à dire *ce qui
est dessiné* ; sans palier, ce qui est dessiné est la cible.

⛔ **Aucun budget n'a été touché** : `_credit`, `CACHE_MAX_CONTINU`,
`PLAFOND_FILE`, `MAX_Z`, `ZOOM_SOCLE`, `PX_PAR_TEXEL_CROP` sont au bit près ceux
du dépôt. La règle du §5 de `/threejs-optimisation` (« un correctif juste appliqué
dans le mauvais ordre se mesure comme une régression ») est respectée par
omission : je n'ai rien desserré.

---

## 2. ⚡ LA PREUVE — LE BANC QUI MANQUAIT À TOUTE LA CAMPAGNE

### Pourquoi les quatre agents précédents ne pouvaient pas voir le défaut

⛔ **Ils mesuraient tous un cache FROID.** Une descente depuis un cache vide ne
peut que **monter** en finesse : « zéro retour en arrière » y est vrai **sans rien
prouver**. Le palier y était *lent*, pas *régressif*. Or Adrien décrit exactement
l'autre chose : *« une belle carte bien définie (…) **recouverte à chaque
changement d'échelle** »* — un crop **déjà net** que l'on recouvre.

`scripts/sonde-tuile.mjs` ajoute donc deux choses au banc de papier :
- une **latence réseau** réglable en images (`--lat`), sans laquelle les dalles
  se résolvent en une microtâche et **le régime transitoire n'existe pas** (le
  constat de CN3, §7) ;
- une lecture **par POINT** et non par cadre : la finesse **rendue** en un point,
  quadrant partiel de R37 compris. Compter les niveaux visibles dans le cadre
  était la grandeur de la contrainte abrogée ; elle ne peut plus rien mesurer.

### Scénario B — le geste d'Adrien, latence 4 images, 20 images × 49 points

| lieu | avant (palier) | après (par tuile) |
|---|---|---|
| Alpes | **500 reculs**, pire **2 niveaux** | **0** |
| Majorque | **788 reculs**, pire **3 niveaux** | **0** |
| Beauce | **720 reculs**, pire **2 niveaux** | **0** |

Et pendant ces 20 images, **`_zCropCible` valait z16 sans discontinuer** : l'écran
demandait le fin, les tuiles fines étaient **encore en cache** (elles avaient été
dessinées à l'image précédente), et le palier dessinait du z13/z14.

### Dans l'application vivante — `scripts/captures-tuile.mjs`, Alpes 600 m

Changement d'échelle z15 → z14 sur un bloc net, relevé de `_zCropServi` :

| | +80 ms | +250 ms | +600 ms | +1 500 ms | +4 000 ms |
|---|---|---|---|---|---|
| **avant** | **z14** | **z14** | **z14** | z15 | z15 |
| **après** | **z15** | **z15** | **z15** | z15 | z15 |

Captures : `.banc/TUILE/cliches/AVANT-alpes-*.png` et `APRES-alpes-*.png`
(⚠️ `.banc` est ignoré par git, les PNG ne voyagent pas avec la branche).

---

## 3. ⚡ LE VERDICT SUR R37 — LE PALIER NE FAISAIT QUE LE NEUTRALISER

**Oui, et c'est mesuré, pas supposé.** R37 pose déjà le raffinement partiel : les
enfants prêts se dessinent, le parent ne couvre que **sous les manquants**
(`masque`, `_dessinerPartiel`). Ce mécanisme est **intact** — je n'y ai pas touché
une ligne.

Ce que faisait le palier, c'est **l'empêcher de servir dans le crop** : en
prescrivant `_zCropServi` (un niveau uniforme, en retard), `wantSplit` valait
`t.z < zCrop` avec le **même** `zCrop` pour toute l'emprise, donc les tuiles ne se
refendaient jamais « en avance » et le masque restait vide. CN2 le disait
lui-même, sans le lire comme un coût (§6, point 8) : le palier a été calibré
**précisément pour supprimer les images où R37 travaille**.

➡️ **La correction est un retrait de 60 lignes.** Aucun mécanisme neuf.

---

## 4. LES CINQ ACQUIS, REVÉRIFIÉS UN PAR UN

Banc : `scripts/sonde-cn1.mjs`, CPU ×4, 20 images consécutives au repos, bloc
`demZoom = 15`, port 9917 — **la sonde de CN1/CN2, inchangée**.

### ① Le crop est NET — px d'écran par texel servi

| altitude | Alpes (CN2) | Alpes (TUILE) | Majorque (CN2) | Majorque (TUILE) |
|---|---|---|---|---|
| 20 000 m | 0,21 | **0,21** | 0,22 | **0,22** |
| **5 000 m** | 0,94 | **0,94** | 0,90 | **0,90** |
| 2 000 m | 3,09 | **3,09** | 1,12 | **1,12** |
| **900 m** | 1,84 | **1,84** | 1,25 | **1,25** |
| **600 m** | 1,21 | **1,21** | 1,88 | **1,88** |

**Identique au centième aux dix cellules.** Le gain de la campagne (43,5 → 1,2 aux
Alpes à 600 m) est intact, et **le cadrage de l'affiche à 5 000 m n'a pas bougé
d'un bit** — z13, `{13}`, 0,94 / 0,90.
⚠️ La cellule ouverte de CN2 (**Alpes 2 000 m : 3,09**) reste ouverte, au même
chiffre. Je ne l'ai ni réparée ni dégradée.

### ② L'emprise ne rétrécit pas

`2 · cropDemi · circonférence · cos lat` : **2 552 m aux Alpes, 2 826 m à
Majorque**, à toutes les altitudes. Barème ≥ 2 400 m ✔ (CN3 mesurait 2 437–2 826).
`params.demZoom` n'est ni lu ni écrit par ce correctif.

### ③ Le coût tient

| grandeur | CN2/CN3 | TUILE |
|---|---|---|
| cache au repos, Alpes | 248 – 285 | **264** |
| cache au repos, Majorque | 248 – 285 | **277** |
| requêtes du poste d'entrée | — | **35 / 32** |
| ms par image (p50), CPU ×4 | — | **17,4 – 17,9** |

Au banc de papier avec latence, scénario A : **cache 940 / 872 / 888 / 920 et
426 requêtes AVANT COMME APRÈS**, aux quatre postes — les mêmes nombres, à
l'unité.

### ④ Le cartouche ne ment pas

`scripts/sonde-cn4-cartouche.mjs`, Majorque, 5 000 / 2 000 / 900 / 300 m :
**0 écart sur 912 images**, plafond faux 0. Libellés : « net à z13 », « z14 »,
« z15 », « z16, plafond de la donnée ici ».

### ⑤ La loi de finesse

`_zoomCropFin` est **inchangée au bit près**, plafond `getDemMaxZoom()` compris.
Ce qui a disparu est le **retard** entre sa sortie et ce qui est dessiné.

### Et le gain, chiffré

**Temps jusqu'à la netteté au centre** (banc de papier, latence 4 images, cache
froid, 300 images) :

| lieu, 600 m | avant | après |
|---|---|---|
| Alpes | 100 images | **80** (− 20 %) |
| Majorque | 96 images | **80** (− 17 %) |
| Beauce | 100 images | **80** (− 20 %) |

---

## 5. ⚡ LA TEINTE — CE QUE J'AI MESURÉ, ET CE QUE JE N'AI PAS PROUVÉ

`scripts/sonde-tuile-teinte.mjs` : même cadre, même altitude, `_zoomCropFin`
forcée à un niveau, **20 images consécutives**, lecture du carré central du
tampon d'écran. On sépare **la luminosité** (le même écart sur les trois canaux
= la même carte plus claire) de **la CHROMA** (ce qui reste après retrait de la
moyenne) — parce que la question d'Adrien est la teinte, pas la clarté.

### Alpes, 600 m (deux tirages, reproductibles à 0,03 près)

| transition | Δluminosité | **ΔCHROMA max** | Δsaturation | Δcontraste (σR) |
|---|---|---|---|---|
| z13 → z14 | −8,18 | **0,59 / 255** | −0,0007 | **+4,04** |
| z14 → z15 | −0,76 | **1,41 / 255** | +0,0119 | −0,90 |
| z15 → z16 | −1,07 | **4,52 / 255** | **+0,0398** | −0,36 |

### Majorque, 600 m

| transition | Δluminosité | **ΔCHROMA max** | Δsaturation |
|---|---|---|---|
| z13 → z14 | +26,67 | **9,95 / 255** | **−0,0999** (0,2012 → 0,1013) |
| z14 → z15 | −26,28 | **2,21 / 255** | +0,0308 |
| z15 → z16 | +6,11 | **11,91 / 255** | **+0,0962** |

### ⚡ LE VERDICT : LE DÉFAUT D'ADRIEN EST **LES DEUX**, MAIS PAS COMME ÉCRIT

**① La finesse : oui, et c'est retiré** (§2). C'est la moitié qui se corrige.

**② La teinte : elle n'est PAS invariante — jusqu'à 11,9/255 de chroma et un
facteur 2 de saturation à Majorque, très au-dessus des 2/255 visés.** Et le sens
va bien dans celui d'Adrien : à Majorque, **le niveau GROSSIER z13 est presque
deux fois plus saturé que z14** (0,2012 contre 0,1013).

**③ ⛔ Mais « rendre la rampe invariante » ne peut pas être le correctif : elle
l'est déjà, par construction, et je l'ai vérifié dans le code.** Les uniformes de
rampe — `uHeightPivot`, `uHeightContrast`, `uLandMax`, `uReliefBas`, `natRampT` —
vivent dans **`this.uniforms`**, un seul jeu partagé par toutes les tuiles
(`materiauTuile`, `globe.js` : `uniforms: { ...this.uniforms, uTex, uTilePx,
uUvParMonde }`). **Aucun d'eux ne dépend de `t.z`.** Ce qui dépend du niveau, ce
sont les **entrées** : la hauteur échantillonnée (un raster deux fois plus
grossier lisse les crêtes vers la moyenne) et `uUvParMonde = 1/2^z`, qui donne la
pente. C'est exactement le constat de CN1 repris par D25 : *une tuile porte un
seul raster décodé pour la hauteur ET la couleur*.

➡️ **Donc le chantier de rampe est un faux chemin** : il n'y a pas de rampe par
niveau à unifier. La couture entre deux finesses voisines se traite par un
**fondu** (mélanger le parent et l'enfant pendant N images), pas par la rampe.
**Je ne l'ai pas posé** : le brief demande de le mesurer avant, et je n'ai pas de
mesure qui dise que le fondu vaut mieux que la bascule sur ce produit.

---

## 6. ⛔ CE QUE J'AI CRU PUIS RÉFUTÉ

1. **« Le palier se voit dès qu'on descend sur un lieu neuf. »** ⛔ **Faux, et
   c'est l'angle mort de toute la campagne.** Sur un cache froid, la finesse ne
   peut que monter : mon scénario A rend **0 recul avant comme après**, aux trois
   lieux et aux quatre altitudes. Le palier y coûte du **temps** (100 images au
   lieu de 80), pas de la régression. Il a fallu **chauffer le crop jusqu'à la
   netteté puis reposer l'échelle** pour que le défaut apparaisse — et alors il
   saute aux yeux (788 reculs). **Quatre agents ont mesuré le mauvais scénario.**
2. **« La teinte vient de `teintePente` : la couleur est tintée par la pente, et
   la pente est lue à la finesse de la tuile. »** Le mécanisme existe bel et bien
   (`col = teintePente(col, penteSol(nMonde, haut), uSlopeTint)`), et l'expérience
   était bonne : forcer `uSlopeTint = 0` et regarder si l'écart chromatique
   s'effondre. **Il n'a pas bougé d'un dixième** (Majorque z13→z14 : 9,95 → 9,88).
   ⛔ **Et l'expérience ne prouve rien pour autant : `uSlopeTint` valait DÉJÀ 0**
   dans le produit — je l'ai relu à l'écran après coup (`uSlopeTint 0`). J'ai
   éteint une lampe éteinte. C'est le *« test de silhouette qui passe à vide »* du
   §3 de la compétence, payé une fois de plus. **L'hypothèse n'est ni confirmée ni
   réfutée ; elle est intestée.**
3. **« Un relevé de teinte à un niveau donné est une propriété de ce niveau. »**
   ⛔ **Non — il dépend du CHEMIN, et deux tirages le montrent.** Au même lieu, à
   la même altitude, avec la **même** finesse servie z15 :
   - arrivée directe : RVB **211,1 / 204,7 / 198,7** (Alpes) · **180,0 / 153,7 /
     146,4**, saturation **0,204** (Majorque) ;
   - en passant par z13 puis z14 : RVB **204,4 / 197,2 / 189,4** (Alpes) ·
     **172,0 / 156,4 / 152,1**, saturation **0,132** (Majorque).
   Soit **7 niveaux de luminosité et 35 % de saturation d'écart pour la même
   image**. C'est très probablement le gel par cran d'`ancrerMesure`
   (`echelle-continue.js`), que GRA §① a déjà attrapé sur un autre axe. **Je ne
   conclus pas** : c'est une piste ouverte, avec ses chiffres, pour qui la
   prendra. Elle explique aussi pourquoi mes deux premiers tirages de teinte se
   contredisaient — et j'aurais publié le premier si je n'avais pas relancé.
4. **« Il faut écrire un fondu entre niveaux. »** Le brief l'autorise « à
   mesurer, pas à poser d'office ». **Rien ne le mesure aujourd'hui**, et le
   défaut qu'il traiterait (la couture) n'est pas celui qu'Adrien décrit. Non
   posé.
5. **« `_prelireCrop` doit rester, il portait l'ordre de service. »** Non :
   l'ordre est porté par le **bonus de `_priorite`** (intact), pas par lui. Sa
   garde était devenue littéralement inatteignable — le §2 de la compétence,
   « une constante peut être du code mort sans que rien ne le signale ».
6. **`readPixels` posé depuis `page.evaluate`, puis dans `renderer.render`.**
   Le premier rend `n = 0` (tampon effacé entre deux images) ; le second **tourne
   et rend des pixels tous à zéro**, parce que le produit rend dans un
   `EffectComposer` : quand `renderer.render` retourne, la cible liée est un
   tampon interne. La sonde s'enveloppe donc autour de **`composer.render`**.
   **Deux faux zéros, tous deux parfaitement plausibles.**

---

## 7. LES TESTS DE L'ANCIENNE CONTRAINTE — RÉÉCRITS, ET ILS MORDENT

⚠️ **Aucun test n'a été supprimé.** Deux fichiers gardaient l'exigence abrogée ;
ils gardent maintenant la vraie demande, sur la bonne grandeur.

### `test/crop-finesse-palier.test.js` (CN4, il mordait)

| avant | après | pourquoi (D25) |
|---|---|---|
| ⓐ « aucune image mixte ne naît » | **ⓐ « aucun point de l'emprise ne recule »** | le mélange de niveaux est le comportement normal d'un quadtree ; ce qu'Adrien refuse est le **recul**. |
| ⓑ « la moitié des dalles arrivée, une seule finesse » | **ⓑ « un crop déjà net ne se recouvre pas au changement d'échelle »** | c'est le geste filmé, et **le banc qui manquait** : un cache chaud, pas froid. |
| ⓒ témoin de vivacité | **ⓒ + « chaque point est peint, à la finesse servie »** | la seconde assertion de CN4 (`niveauxDansCrop === [servi]`) **était la contrainte abrogée elle-même** ; remplacée par plus fort — elle attrape en plus un trou. |

**Preuve de morsure**, `node scripts/mutation-cn4.mjs palier-rendu` (les deux
mutations de CN4 sont devenues introuvables : leur cible n'existe plus) :

| test | dépôt (D25) | `palier-rendu` | **le vrai code de CN2** (`git stash`) |
|---|---|---|---|
| ⓐ | ✔ | ✔ ⚠️ | ✔ ⚠️ |
| **ⓑ** | ✔ | **✖ 98 reculs** | **✖ 735 reculs, z16 → z14** |
| ⓒ | ✔ | ✔ | ✔ |

⚠️ **Et je dis ce que ⓐ ne prouve pas** : il ne rougit ni sous la mutation ni sous
le code de CN2, **et c'est normal** — cache froid (§6, point 1). C'est **ⓑ** qui
garde le défaut d'Adrien. J'ai vérifié la morsure **contre le code réel d'avant**,
pas seulement contre une mutation que j'aurais taillée à ma mesure.
⛔ La restauration du fichier est vérifiée par md5 (`59c7774e…` identique).

### `test/crop-nettete-ecran.test.js` ③ (CN1)

`③ garde — une seule finesse dessinée dans l'emprise` devient **`③ garde — au
repos, chaque point de l'emprise est peint à la finesse servie`**. Ce banc résout
ses dalles en une microtâche : après `tourner`, l'affinage est **fini**. La
propriété qui reste vraie **au repos** est donc plus forte que l'ancienne : aucun
trou, aucun reste plus grossier, vérifié **point par point** et non par un compte
de niveaux. Les cinq autres tests du fichier sont intacts.

---

## 8. CE QUI RESTE OUVERT

- ⚡ **La teinte d'un niveau à l'autre** (§5) : jusqu'à 11,9/255 de chroma et ×2
  de saturation. **Ce n'est pas la rampe** (démontré). Reste à trancher entre le
  fondu et un calcul de normales à un niveau de référence — **et à mesurer avant
  de poser**.
- ⚡ **La teinte dépend du CHEMIN** (§6, point 3) : même lieu, même altitude, même
  finesse servie, deux images différentes de 35 % de saturation. Piste :
  `ancrerMesure` (`echelle-continue.js`), déjà mis en cause par GRA §①.
- **Alpes à 2 000 m : 3,09 px par texel**, la cellule ouverte de CN2, inchangée.
- **Le fondu entre niveaux** : non posé, faute de mesure (§6, point 4).
- **La photo aérienne** suit toujours sa propre loi (`aerialZoomFor`) — rien ici
  ne la couvre, comme dans CN2.
