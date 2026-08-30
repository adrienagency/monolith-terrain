# Tâche P4 — LA MER : l'écume, et la pièce que le crop n'avait pas

**Statut : LIVRÉE.** · Commits **`5897c97`**, **`2bd68df`**, **`11be1ce`**, **`a4ec5b1`** sur
`regroupement` (arbre propre après commit).
`npm test` — **3 947 / 3 947** (3 905 au départ, **+42**) · `npm run audit:tests` — **209 / 209** ·
campagne de mutation — **37 / 37**, dont **25 visant le branchement**.

> **Le noteur, 2026-08-22 :** *« l'écume est 7,7 fois trop étendue — et elle est en
> PLAQUES »* (manque n° 3) · *« la nappe de mer et le dessus du bloc ne sont pas la même
> surface »* (manque n° 4).

**Les deux sont portés. Et le brief se trompait sur les deux causes** — je le dis d'entrée
parce que c'est ce qui a fait gagner du temps, pas ce qui en a fait perdre.

---

## 0. ⛔ CE QUE J'AI VU À L'ÉCRAN, CÔTE À CÔTE AVEC LE SOCLE

**Toutes dans `.banc/vues-P4/` — 51 captures et 9 relevés, `bilan-P4.json` compris.** Cadre
**1 280 × 800**, La Réunion z12, `fov = 33`, **socle RALLUMÉ DANS LA MÊME PAGE** (le protocole
du noteur), rendu **sans compositeur** dans une cible **à profondeur**, **boucle rAF coupée**,
cadrages appariés à **0,087 %** et **0,189 %**.

**Le triptyque à regarder :**

- **`H1-AVANT-CROP-bloc.png` → `F1-CROP-bloc.png` → `F1-SOCLE-apparie.png`.**
  AVANT : la mer est une **dalle blanchâtre**, couverte de plaques d'écume à bords durs qui
  couvrent la moitié de l'eau, et sa nappe **déborde par-dessus l'arête haute de la paroi** au
  flanc est. APRÈS : une nappe bleue continue, **un liseré blanc fin collé au trait de côte**,
  et l'eau **rencontre le mur**. SOCLE : la même chose, en turquoise.
- **`ZA-AVANT-est.png` ↔ `ZB-APRES-est.png` ↔ `ZC-SOCLE-est.png`** (découpes ×3 du même coin) —
  c'est là que le porte-à-faux se lit, et qu'il disparaît.
- **`Z4-SOCLE-avec-jupe-est.png` ↔ `Z4-SOCLE-sans-jupe-est.png`** — l'A/B qui a nommé le
  manque n° 4 (§3).
- **`D1-MER-SEULE.png` / `D2-PAROIS-SEULES.png`** — les deux pièces isolées, qui montrent que
  la lèvre du bloc plonge au fond marin pendant que la nappe reste à zéro.

### ⛔ ET NON, ÇA NE RESSEMBLE TOUJOURS PAS AU SOCLE

Ce qui sépare encore les deux images :

1. ⛔ **LE FOND MARIN DU CROP EST EN TERRASSES, ET C'EST LUI QU'ON VOIT MAINTENANT À TRAVERS
   L'EAU.** Sur `F1-CROP-bloc.png` la mer est parcourue de gradins pâles à bords droits. **Ce
   n'est pas de l'écume** — mesuré : avec l'écume ÉTEINTE, **3 135 des 3 643 pixels « clairs et
   peu saturés » restent**, soit **86 %**. C'est le plateau peu profond du fond du crop, dont
   les tuiles sont beaucoup plus grossières que les **594 434 sommets** du relief du socle. La
   mer du socle est posée sur le même bleu, sur un fond LISSE, et ne montre aucun gradin.
   ➡️ **C'est de la SURFACE, pas de la mer** (Tâche J bis / K). *Autre tâche.*
2. ⛔ **LES JUPES DE TUILES pendent toujours sous le bloc**, et elles sont bleues sous la mer,
   ce qui les rend plus visibles maintenant que la nappe est propre. *Manque n° 5, autre tâche.*
3. **La mer du crop reste moins saturée que celle du socle en teinte** — 0,348 contre 0,319 de
   saturation moyenne, ce qui la met *au-dessus*, mais avec **10,8 % de pixels quasi neutres
   contre 0,48 %**. Ces neutres sont les gradins du point ①.
4. **Je ne suis PAS descendu à 3 km** (§7, réserve n° 2).

---

## 1. LE PIÈGE DE CADRAGE — APPARIÉ, ET LE BANC A MENTI D'UNE ONZIÈME FAÇON

`k` est balayé sur un **CLONE** de la caméra du socle, que l'application ne voit jamais.

| | crop | socle | `k` | **écart** |
|---|---|---|---|---|
| **AVANT** (bloc entier, parois et plinthe comprises) | 251 345 px | **251 564 px** | 0,985 | **+0,087 %** |
| **APRÈS** | 251 088 px | **251 563 px** | 0,985 | **+0,189 %** |

➡️ **Appariés à 0,087 % et 0,189 %**, soit **onze** et **cinq** fois mieux que le 1 % demandé.
Deux mesures du même `k` rendent **251 041 et 251 041**, identiques au pixel.

### ⛔ ONZIÈME FAÇON DONT UN BANC MENT ICI, ET ELLE M'A EU

**Le TOUT PREMIER rendu dans une `WebGLRenderTarget` fraîchement créée rend du contenu non
initialisé.** Les deux prises de `masque` diffèrent alors PARTOUT, et le compte sort à
**1 024 000 / 1 024 000** — pas une erreur visible, **un chiffre énorme et plausible**. Deux
rendus jetés après `init()` et le compte retombe sur les 251 302 px vérifiés à la main. C'est
écrit dans l'en-tête du harnais.

### ⛔ ET UNE DOUZIÈME, TOUT AUSSI SILENCIEUSE

**Cacher `globe.group` pour mesurer le bloc rendait 429 693 px** quand la somme — recouvrements
compris — des trois pièces du bloc n'en fait que **282 066**. Objet par objet, `cap-n`, `cap-s`,
le maillage de la planète et `globe-clouds` contribuent **0 pixel chacun**. Le masque du bloc
cache donc **les tuiles, la nappe et les parois**, nommément.

### LES TÉMOINS

| témoin | pixels différents sur 1 024 000 |
|---|---|
| deux rendus consécutifs du même état | **0** |
| aller-retour d'accalmie (vive → neutre → vive) | **0** |
| aller-retour d'extinction d'écume, des deux côtés | **0** |
| ⚠️ **deux rendus à 500 ms d'intervalle** | **58 587** |

⚠️ **La mer est ANIMÉE** (`uMerTemps` avance de 0,552 en 500 ms) : **toute paire doit être
rendue dans la MÊME exécution JS**, et la boucle rAF est coupée pour les balayages.

---

## 2. ⛔ LE BRIEF ACCUSAIT TROIS CONSTANTES. ELLES SONT INNOCENTES.

Le brief : *« Les trois constantes (1,8 / 1,1 / 0,96) et la normalisation du déclin sont à
re-dériver contre celles du socle. »*

**`1.8`, `1.1` et `vec3(0.96)` sont IDENTIQUES des deux côtés et n'ont jamais divergé.** Elles
sont dans `ocean.js` mot pour mot et dans `globe.js` mot pour mot.

**Ce qui avait divergé, ce sont QUATRE ENTRÉES que la calotte ne fournissait pas.**

### ① LE DÉCLIN CÔTIER — le plus gros des quatre, et il est mesuré sur le champ vivant

`ocean.js` ne lit pas la distance au rivage : il lit

```glsl
float shoreD = max((uWaterY - f.r) * 2.0, f.g);   // la PROFONDEUR d'abord
vFade        = smoothstep(0.0, 0.35, shoreD);      // puis un FONDU
```

**La calotte passait `champ.g` TEL QUEL** — la distance brute — à des seuils (`0.002`, `0.03`,
`0.10`, `0.75`) calés pour la grandeur fondue.

**Relevé sur le champ vivant de La Réunion** (385², canal G décodé demi-flottant par
demi-flottant, `5 448` nœuds d'eau à l'intérieur du crop) :

| | avec `champ.g` brut | avec la loi d'`ocean.js` |
|---|---|---|
| nœuds dans la bande de ressac | **68,72 %** | **10,41 %** |
| nœuds à plus de demi-force | **44,53 %** | **10,10 %** |

➡️ **×6,6.** Le terme de PROFONDEUR est ce qui tue la bande à quelques centaines de mètres
d'une île volcanique ; sans lui la bande courait jusqu'à **20 % de la largeur du crop**.

⚠️ **ET LA « RÉSOLUTION DU CHAMP » QUE LE NOTEUR SOUPÇONNAIT** : mesurée. Le gradient moyen du
canal G près du rivage vaut **0,02722 par texel** ; la montée `smoothstep(0.002, 0.03, ·)`
s'étale donc sur **1,1 texel**. La bordure de la bande était bien quantifiée — mais sur ~5 px
d'écran, ce qui fait une arête, pas une plaque. **Les plaques sont ailleurs** (④).

### ② LES DEUX ACCALMIES — trente et une fois

`ocean.js` multiplie le ressac et le liseré par `uViewCalm × uSurfCalm`, et les moutons par
`uViewCalm`. **Relevé le 2026-08-22 dans la page vivante : `uViewCalm = 0,4039`,
`uSurfCalm = 0,08`.** Le ressac du socle est donc multiplié par **0,0323** ; la calotte le
multipliait par **1**. **30,95 fois** (le test ①g le vérifie sur la loi).

### ③ LE FACTEUR D'ÉCHELLE D'ÉCUME du ressac — `(0,5 + 0,5 × uFoamScale)` — absent.

### ④ LA TAVELURE, INDEXÉE DANS LA MAUVAISE MONNAIE — **ce sont les plaques**

`ocean.js` : `vnoise(xz * 0.33)`, où `xz = vWorld.xz`, **en unités de socle**.
La calotte : `bruitMer(vLocal * 0.33 / uMerLambda * 0.08 + …)` — en espace de **spectre**, avec
un `0,08` qui n'existe nulle part chez `ocean.js`.

Avec les valeurs vivantes (`uMerLambda = 0,0032204`, largeur du crop `0,429` unité de scène) :

| | cellule de tavelure |
|---|---|
| crop | **28,4 % de la largeur du bloc** |
| socle (`1 / 0,33 / 56`) | **5,41 %** |

➡️ **5,25 fois trop large. Ce sont LES PLAQUES**, et elles se comptent sur `F1` contre `H1`.

---

## 3. ⛔ LE MANQUE N° 4 N'EST PAS UN DÉSACCORD. C'EST UNE PIÈCE MANQUANTE.

Le brief : *« Où : l'accord entre `poserMer` et `construireParoisCrop`. »* · *« accord de
géométrie à trois. »*

**Les deux s'accordent parfaitement** : même repère (`repereLocalCrop`, appelé et non recopié),
même contour, mêmes hauteurs. **Il n'y a rien à accorder.**

**Le vrai fait, et il se voit sur `D2-PAROIS-SEULES.png` :** l'anneau haut de la paroi suit la
SURFACE, et sous l'eau la surface est le **FOND MARIN**. Au bord mouillé, la lèvre du bloc
plonge à la bathymétrie (**3 510 m relevés**) pendant que la nappe reste au niveau zéro. Elle
flotte donc au-dessus du vide, et par le trou on voit la face interne de la paroi et le fond du
bloc.

### ⚡ LE SOCLE A EXACTEMENT LE MÊME BLOC ET PAS LE DÉFAUT — A/B DANS LA MÊME PAGE

`ocean.js` bâtit **DEUX maillages** : la surface (**66 049 sommets**, `renderOrder 18`) et une
**jupe** (**1 474 sommets**, `renderOrder 16`).

**Cacher la jupe du socle change 30 453 pixels (2,97 % du cadre) et fait apparaître le MÊME
porte-à-faux au flanc est** (`Z4-SOCLE-sans-jupe-est.png` contre `Z4-SOCLE-avec-jupe-est.png`).

➡️ **Le crop n'avait pas de rideau d'eau. C'est ça, le manque n° 4.**

Le rideau est maintenant bâti (`construireJupeMer`, `mer-sphere.js`) : **1 024 points d'anneau,
2 048 sommets, 2 048 triangles**, en retrait de `RETRAIT_EAU_CROP` — **la largeur exacte du
chanfrein et de la marge d'eau du mode plat**, qui est aussi le rayon auquel `plinth.js` pose
l'eau du socle (`rayonEauDansSocle = HALF − 0,16 − 0,06`).

⚠️ **CONCATÉNÉ À LA CALOTTE, PAS POSÉ À CÔTÉ.** Un second maillage aurait eu son propre
nuanceur de sommets, donc une **seconde écriture du déplacement de houle** — et `ocean.js` écrit
lui-même ce que ça coûte : *« si les deux divergeaient d'un millimètre, un jour s'ouvrirait
entre la jupe et la mer sur tout le périmètre du bloc »*. Le haut du ruban porte le MÊME `aCrop`
que la nappe : **la soudure est structurelle**, pas réglée.

### ⛔ ET LA MESURE DU BORD ÉTAIT MUETTE À L'INTÉRIEUR — la vraie cause du débordement

`bordDeMer` portait `fin = max(RETRAIT_EAU_CROP, …)` : à estompage plein la mer allait
**0,22 unité de socle DEHORS**, pleine opacité sur la frontière, fondu au-dessus du vide. Le
mode plat fait l'INVERSE. **0,44 unité d'écart, dans des sens opposés.**

**Mais corriger le signe ne suffisait pas, et l'écran l'a dit tout de suite : la mer a
entièrement disparu.** La raison :

```glsl
vec2 cq = max(abs(vCrop) - (1.0 - uCropCoin), 0.0);   // un max(…, 0)
float dBord = pn - uCropCoin;
```

`cq` est un `max(…, 0)` : **DEDANS il vaut zéro**, donc `pn` vaut zéro et `dBord` se fige à
`−uCropCoin`. ⚠️ **Et `uCropCoin` vaut ZÉRO dans l'application vivante** (relevé). **`dBord`
valait donc 0 sur TOUT l'intérieur du crop.** La mesure ne portait que le dehors : le fondu de
la mer ne pouvait **structurellement pas rentrer**, seulement sortir. Le terme
`min(max(q.x, q.y), 0.0)` — la distance intérieure de la boîte arrondie — le rend signé, et
**vaut exactement zéro dehors**, donc le dehors reste ce qu'il était.

⛔ **ET UN TEST VERROUILLAIT LE DÉFAUT.** `mer-sphere.test.js` ⑪b exigeait
`fin = +RETRAIT_EAU_CROP` — le débordement — depuis la Tâche J. Il est réécrit, avec le motif.

---

## 4. LES MESURES — ET LEUR TÉMOIN D'EXTINCTION

⚠️ **LE CRITÈRE DU NOTEUR COMPTE 86 % DE NON-ÉCUME, ET C'EST LUI QUI L'AVAIT PRESSENTI**
(sa réserve n° 4 : *« elle ne sépare pas l'écume des crêtes claires »*). Sur le masque de la
**mer seule**, avec l'écume ÉTEINTE, **3 135 pixels sur 3 643 restent « clairs et peu saturés »**
côté crop, et **3 452 sur 5 397** côté socle. **Un chiffre d'écume qui ne soustrait pas ce
plancher mesure surtout la couleur de l'eau.**

**Le témoin d'extinction est PUR des deux côtés, et différemment** : côté crop `uMerCalmeVue = 0`
(elle ne multiplie QUE l'écume) ; côté socle `uFoam = 0` **et** `uSurfCalm = 0` — `uViewCalm = 0`
aurait aussi tué les normales de clapot (`uDetail × uViewCalm`) et l'amplitude de `shoreSurf`,
donc n'aurait **pas** été un interrupteur d'écume. **Aller-retour exact des deux côtés.**

### Le tableau, masque de la MER SEULE, même page, même seconde

| | **AVANT** | **APRÈS** | **socle** |
|---|---|---|---|
| surface de mer | 28 683 px | 27 256 px | 87 657 / 87 682 px |
| clairs et peu saturés (critère du noteur) | **11 972 — 41,74 %** | **3 643 — 13,37 %** | 5 376 — 6,13 % |
| **le même, écume ÉTEINTE (témoin)** | — | **3 135** | **3 453 / 3 452** |
| ⚡ **écume VRAIE, par différence** | — | **508 px — 1,86 %** | **1 923 / 1 945 px — 2,19 / 2,22 %** |
| saturation moyenne | **0,127** | **0,348** | 0,319 |
| pixels quasi neutres (sat < 0,10) | **46,52 %** | **10,80 %** | 0,48 % |
| luminance moyenne | 170,99 | 121,88 | 127,23 |

➡️ ⚡ **L'écume vraie du crop vaut 1,86 % de sa mer contre 2,22 % au socle** — elle est
désormais légèrement **en dessous** de la référence, et il ne faut donc **rien lui ajouter**.
➡️ **La saturation passe de 0,127 à 0,348 pour 0,319 au socle** — elle traverse la référence.
➡️ **Les 11,5 points qui restent entre 13,37 % et 1,86 % ne sont pas de l'écume** : c'est le
plateau peu profond du fond du crop (§0, point ①).

### ⛔ CE QUE JE NE PEUX PAS MESURER SUR L'AVANT, ET JE NE L'INVENTE PAS

**L'écume vraie de l'AVANT n'a pas de témoin.** L'ancien nuanceur n'avait aucun interrupteur qui
éteigne le ressac et le liseré sans toucher à la géométrie (`uMerEcume = 0` n'éteint que les
moutons — et il ne change que **8 pixels**, ce qui dit au passage que **la totalité des 11 972
venait du ressac et du liseré**, exactement les deux termes réparés). **Je ne publie donc pas de
« ×N » sur l'écume vraie avant/après.** Ce qui est comparable — même critère, mêmes deux côtés,
même seconde — est la ligne « clairs et peu saturés » : **41,74 % → 13,37 %, pour 6,13 % au
socle.**

**Et le socle est le témoin de comparabilité entre les deux chargements** : son écume vraie rend
**1 923 px (2,194 %)** avec l'ancien `ocean.js` et **1 945 px (2,218 %)** avec le nouveau, sur
des masques appariés à **0,03 %**. **1,1 % d'écart** — c'est le plancher de bruit inter-chargement
de cette grandeur-là sur ce banc, et il est petit.

### ⛔ LA PREUVE BIT-À-BIT DU SOCLE : TENTÉE, PUIS RETIRÉE

Protocole de P2 §6, rejoué : `git checkout 3b332a7 -- src/ocean.js`, chargement, capture caméra
**écrite en dur**, temps de la mer **figé à zéro**, décor caché.

| paire | pixels différents sur 1 024 000 |
|---|---|
| **ancien `ocean.js` vs nouveau** (temps figé) | 323 405 — **31,58 %** |
| ⚠️ **nouveau vs nouveau, deux chargements** (le plancher) | 341 000 — **33,28 %** |

⛔ **LE PLANCHER DE BRUIT À CODE IDENTIQUE EST PLUS GRAND QUE L'EFFET. La mesure ne dit rien
sur `ocean.js`, et je la retire.** (Deux variables au moins m'échappent entre deux chargements :
`uViewCalm`, que l'application repose depuis SA caméra, relevé à 0,9997 ici contre 0,4039
ailleurs, et `uLenScale`, qui dérive de l'état de chargement du relief — 0,231 puis 0,3009.)
**Ce qui tient à la place**, c'est le couple 1 923 / 1 945 ci-dessus, et le fait que les huit
fonctions extraites sont **exécutées** contre leurs jumeaux JS terme par terme (§6, ②).

---

## 5. CE QUI A ÉTÉ FAIT — DEUX EXTRACTIONS, ET UNE TROISIÈME ÉCRITURE TROUVÉE AU PASSAGE

**`src/monde/ecume-mer.js`** — module **pur, aucune importation** — porte la loi d'écume **une
seule fois**, en JS (les jumeaux testables) et en GLSL (`GLSL_ECUME`). **`ocean.js` ET
`globe.js` INJECTENT ce même texte.** C'est le patron de `naturel-crop.js` (P2), pour la même
raison.

**`GLSL_JUPE_MER`** (dans `mer-sphere.js`) — les six lignes de couleur et d'alpha du rideau
d'eau, extraites de `SKIRT_FRAG` plutôt que recopiées.

⚡ **ET LE TEST ③a A TROUVÉ UNE TROISIÈME ÉCRITURE QUE JE N'AVAIS PAS VUE** : le **vertex de la
jupe du socle** portait sa propre copie du déclin côtier (`max((uWaterY − f.r) * 2.0, f.g)` et
`smoothstep(0.0, 0.10, shoreD)`). Trois écritures, pas deux. Elle est passée au module.

⚠️ **L'ORDRE DES FACTEURS EST CELUI D'`ocean.js`, FACTEUR PAR FACTEUR** : la multiplication
flottante n'est pas associative, et réordonner `a * b * c` changerait des bits.

### Le fil, maillon par maillon

`Ocean.setView` (seul écrivain des deux accalmies) → **`RealWater.reglagesMer`**, un accesseur
qui **LIT** les uniformes vivants → `main.js`, **juste après `setView`, à la même image** →
`globe.majReglagesMer` → quatre uniformes de la calotte.

⚠️ **AUCUNE LOI D'ACCALMIE N'EST REDÉRIVÉE.** Les redériver côté globe aurait fait deux lois
pour une grandeur — la faute que D13 §③ nomme et que ce chantier a payée sur `hNorm` (P2 §3).
**Le crop prend les VALEURS du socle**, comme P2 prend `terrain.mapUniforms.uRampTex`.

⚠️ **LE GIVRE VIT SUR LE SECOND MATÉRIAU** — celui de la jupe — et il vaut **0,56** dans la page
vivante, pas 0. Le rideau bâti sans lui rendait un voile PÂLE sur la paroi terracotta (alpha
0,55 au lieu de 0,768) : **vu à l'écran, pas déduit**. Et `uSky` était codé **en dur à
`#bcd8ea`** quand le socle vit à **`#85c2eb`** — la même faute que la couleur des parois du
crop (manque n° 2 du noteur), au même endroit du même objet.

⚠️ **`uMerUnite` — UNE SEULE ÉCRITURE DU FACTEUR.** Il sort de `_cuireChampMer`, la même
expression qui normalise le canal G. Deux écritures remettraient la profondeur et la distance
dans deux monnaies, ce qui est **exactement le défaut réparé**. ⚠️ **Et il est en mètres
MERCATOR, pas en mètres vrais** : `largeurCropM` porte un `cos φ` que `largeurUnites` n'a pas —
**6,8 % d'écart à La Réunion**, et le test ⑫e exige que les deux conventions diffèrent, sinon
il ne distinguerait rien.

### CE QUI N'EST PAS PORTÉ, ET POURQUOI — dit, pas caché

| poste | état |
|---|---|
| l'atténuation par masque côtier (`foam *= 1 − smoothstep(0.35, 0.65, coastLand)`) | ⛔ **LAISSÉE.** Elle est sous `#ifndef IS_LAKE` chez `ocean.js` et sert d'anti-crénelage du trait de côte. Sur la calotte la terre est écartée par un `discard` franc (`vProfondeur <= 0.0`), et l'alpha porte déjà `smoothstep(0, uMerSeuilEau, vProfondeur)`. **La porter demanderait de brancher un second échantillonneur sur la mer du globe pour un service que le `discard` rend déjà.** |
| l'état de mer (`chop`, `houle`, `uFoamScale`, `uLenScale`) | ⛔ **NON BRANCHÉ, ET C'EST UN ÉCART MESURÉ** — voir la réserve n° 1. |
| le jour/nuit du rideau (`uDayLight`) | Le crop passe `1`. `MER_FRAG` n'a **aucune** loi jour/nuit non plus. |

---

## 6. LES TESTS ET LA CAMPAGNE DE MUTATION

`test/ecume-mer.test.js` — **+27 tests**, en six sections ; `test/mer-sphere.test.js` — **+10**,
plus quatre réécrits (§3).

- **①** la loi pure, et **chaque constante remonte à `src/ocean.js` RELU SUR LE DISQUE** ;
- **②** le **TEXTE GLSL traduit et EXÉCUTÉ** contre les jumeaux JS — **5 760 combinaisons pour
  `ecumeMer` seule, le dénominateur COMPTÉ par la boucle et les points non nuls comptés aussi**
  (une grille qui ne rendrait que des zéros passerait sans rien prouver) ;
- **③** **l'unicité de l'écriture**, formule par formule, **commentaires retirés avant de
  chercher** ;
- **④** le **branchement** ;
- **⑤** le rideau d'eau — anneau FERMÉ, retrait, `basY` obligatoire (pas un zéro silencieux) ;
- **⑥** la mesure SIGNÉE du bord, avec **le jumeau JS de l'ancienne mesure exécuté** pour
  montrer qu'elle rendait 0 partout à l'intérieur.

### La campagne — `.banc/mutations-P4.mjs`, worktree `C:/Dev/wt-p4-mut`, **retiré en partant**

`node_modules` en **jonction** vers l'arbre principal ; **`git ls-files --eol` vérifié
`i/lf w/lf`** sur les cinq fichiers touchés — aucun faux survivant possible.

**37 mutations sémantiques, dont 25 visant le BRANCHEMENT.**

- **Premier tour : 28 / 37.** ⛔ **Les NEUF survivantes visaient toutes le même trou** : le
  corps de `majReglagesMer` et les uniformes que `poserMer` écrit n'étaient gardés que par des
  assertions de **SOURCE**. *Une assertion qui lit un fichier prouve qu'un texte est là ; elle
  ne prouve pas qu'il pose la bonne valeur.* **Aucune n'était du code mort** — elles sont toutes
  sur le chemin vivant de l'image. La section ⑫ les EXÉCUTE.
- **Deuxième tour : 35 / 37.** Deux survivantes : `reglagesMer` d'`ocean.js`, gardé par un
  simple `grep` (⑫j l'exécute sur un faux socle qui reproduit exprès le piège du **second**
  matériau), et une mutation NaN.
- ⛔ **UNE MUTATION ÉTAIT NEUTRE, ET JE LE DIS PLUTÔT QUE DE LA COMPTER** : `?? NaN` posé sur un
  `?.value` absent rend `NaN` là où `undefined` passait, et `Number.isFinite` refuse **les
  deux**. Elle ne prouvait rien. Réécrite en une mutation qui laisse vraiment un NaN atteindre
  l'uniforme — et elle a trouvé que **le cas de test ne portait un NaN que sur `uViewCalm`,
  jamais sur `uSurfCalm`**. *Un test qui ne teste qu'une moitié d'un couple ne teste rien.*
- **Quatrième tour : 37 / 37, 0 non appliquée.** `.banc/resultat-mutations-P4.json`.
  **Chaque mutation est remise sur le disque, les tests rejoués pour confirmer l'échec, puis le
  fichier restauré** ; `git diff --stat` du worktree vérifié **vide** avant retrait.

---

## 7. CLÔTURE

- `npm test` — **3 947 / 3 947** (3 905 au départ, **+42**).
- `npm run audit:tests` — **209 / 209**, aucun écart.
- `node --check` — vert sur `src/globe.js`, `src/ocean.js`, `src/main.js`,
  `src/monde/ecume-mer.js`, `src/monde/mer-sphere.js`, `test/ecume-mer.test.js`,
  `test/mer-sphere.test.js`.
- **CRLF** — `git diff --cached --stat` et `git diff --cached --ignore-cr-at-eol --stat`
  rendent **exactement le même compte** : 1 237 insertions, 76 suppressions, 8 fichiers.
- **Arbre propre après commit**, **worktree de mutation retiré** (`git worktree list` ne le
  porte plus, le dossier n'existe plus).
- **Page chargée, drapeau BAISSÉ** (`?globe=continu&socle=quadtree&f3=0&frontiere=1&seuil=1`) :
  `terrain.mesh.visible = true`, plinthe visible, `real-water` visible avec ses **deux**
  maillages, **aucune mer ni paroi de crop**, `renderer.info.programs.length = 28`, **zéro
  erreur** (recherche `shader|GLSL|program|Uncaught|TypeError|ReferenceError`).
- **Page chargée, drapeau LEVÉ** (`?terre=unique&…`) : `refus` **vide**, socle caché,
  `uMerUnite = 0,008 226 96`, `uMerBasY = −0,120 542 9` (= `baseY` des parois),
  `uMerCalmeVue = 0,4039`, `uMerCalmeSurf = 0,08`, `uMerGivre = 0,56`, `uSky = #85c2eb`,
  `uMerBord = (−0,015 714 ; −0,007 857)` — **négatif des deux côtés, la mer RENTRE** —,
  rideau **1 024 / 2 048 / 2 048**, 23 programmes, **zéro erreur**.

---

## 8. MES RÉSERVES

1. ⚠️ **L'ÉTAT DE MER DU CROP N'EST PAS CELUI DU SOCLE, ET CE N'EST PAS BRANCHÉ.** Relevé au
   même instant : le socle vit à `uChop = 1`, `uWaveH = 2`, `uFoam = 1,9`, `uFoamScale = 1`,
   `uLenScale = 0,231` ; la calotte prend les **défauts de `poserMer`** — `chop = 0,7`,
   `houle = 0,5`, `ecumeEchelle = 0,35` — parce que **`contexteCrop().mer` ne passe aucun des
   cinq**. Ce sont deux MERS différentes. **C'est un trou de branchement, exactement du genre
   que P2 a fermé pour les dix curseurs d'Atlas, et je ne l'ai PAS fermé** : il change la
   géométrie des vagues, donc l'image, et le refermer demande sa propre mesure. Conséquence
   chiffrée : les moutons du crop valent `0,931 × 0,35 × calmeVue` contre `1,9 × 1 × calmeVue`
   au socle, soit **5,8 fois plus faibles**. Aujourd'hui ça ne se voit pas — l'écume vraie du
   crop est déjà à 1,86 % contre 2,22 % — mais **ça se verra sur une mer agitée.**
2. ⚠️ **JE NE SUIS PAS DESCENDU À 3 KM, ET LE TROISIÈME FAIT DU BRIEF RESTE OUVERT.** La
   descente s'arrête à `controls.minDistance = 6` ; à ce point `altitudeCadrageM` **cesse de
   suivre** et reste bloquée à **5 445 m** (relevé). À la distance minimale atteignable
   (`J1-CROP-au-plus-pres.png`) **la nappe ne coupe PAS le relief** : le trait de côte est net
   et l'île sort de l'eau. Ce qu'on y voit, ce sont les **gradins du fond marin** à bords
   droits. **Je n'ai donc ni confirmé ni infirmé « la mer coupe le relief en plein milieu du
   crop sous 3 km » ; je dis seulement que je ne l'ai pas atteint.** Et la caméra du socle
   clonée n'est plus comparable à cette distance (`J2` rend un flou de relief), donc je n'ai
   **aucun côte-à-côte** là-bas.
3. ⚠️ **UN SEUL LIEU.** Tout est sur La Réunion, z12. Un crop **continental** (pas de mer) ne
   pose pas de rideau et retombe sur le neutre — vérifié par test (⑫g), **pas à l'écran**. Un
   crop de haute latitude non plus.
4. ⚠️ **LE RIDEAU N'A PAS DE MASQUE CÔTIER.** `ocean.js` éteint sa jupe devant un polder ou une
   Camargue (`coastLand > 0.5 → discard`). Le rideau du crop ne connaît que
   `vProfondeur <= 0.0`. **Sur une côte à polders, un rideau d'eau se dressera devant de la
   terre.** Le cas ne se pose pas à La Réunion et je ne l'ai pas vu ; je le nomme.
5. ⚠️ **LE COÛT N'EST PAS MESURÉ.** Le rideau ajoute 2 048 sommets et 2 048 triangles à une
   calotte qui en porte 37 249 et 73 728 — **+5,5 % de sommets, +2,8 % de triangles** — et le
   fragment gagne une branche. **Je n'ai chronométré ni l'un ni l'autre**, et je préfère le dire
   que d'annoncer « négligeable ».
6. ⚠️ **LA PREUVE BIT-À-BIT DU SOCLE EST RETIRÉE** (§4), plancher de bruit à l'appui. Trois
   nuanceurs de production ont été refactorisés ; ce qui les garde, ce sont les tests exécutés
   du §6 ②, pas une comparaison d'images.
7. ⚠️ **TOUT EST AU REPOS.** Aucune donnée sur le battement de la bande de ressac en mouvement,
   ni sur la soudure du rideau quand une crête passe au bord — la soudure est **structurelle**
   (même `aCrop`, même code de sommet) mais l'interpolation à travers les triangles grossiers
   de la calotte peut laisser un liseré d'un pixel, et **je ne l'ai pas cherché à l'écran**.

---

## 9. CE QUI RESTE SUR LE DISQUE

`.banc/harnais-P4.mjs` (il **IMPORTE** `harnais-P3.mjs`, il ne le recopie pas) ·
`.banc/serveur-vues-P4.mjs` (port 5602) · `.banc/mutations-P4.mjs` ·
`.banc/resultat-mutations-P4.json` · `.banc/vues-P4/` — **51 captures** et **9 relevés bruts**,
dont `bilan-P4.json`, qui rassemble tout ce que ce rapport avance.
