# RAPPORT CN1 — LE CROP NET : LA MESURE, LE BARÈME, LES TESTS ROUGES

Branche `crop-net-attaque` (arbre `C:\Dev\wt-cn1`). **Aucune ligne de `src/` n'est
touchée** — `git diff -- src/` est vide. Ce rapport produit **la mesure de l'état
actuel**, **le barème** et **six tests écrits avant qu'un correcteur existe**.

---

## ⚡ VERDICT EN CINQ LIGNES

1. **Le texel servi dans le crop ne bouge pas d'un bit sur un facteur 33
   d'altitude** : 6,35 à 7,36 m selon le lieu, à 20 000 m comme à 600 m, avec le
   **même histogramme** de niveaux (`{13: n}`) et le **même effectif de cache à
   l'unité près**. C'est un point fixe, pas une loi.
2. **Le chiffre « 15 px / 4 niveaux » n'est PAS le cas général.** En plaine, sur
   un littoral et à Majorque il vaut **4,3 à 6,8 px (2,1 à 2,8 niveaux)**. Il
   n'est atteint — et largement dépassé — **que sur du relief fort** : Alpes,
   **19,3 px à 900 m** et **43,5 px à 600 m**. Le chiffre était juste ; il avait
   été publié **sans son lieu**, et c'est le lieu qui fait le facteur 6.
3. **Le mécanisme observé n'est PAS `_zoomCropEcran`.** Sur toute la plage
   mesurée, `_zCropEcran` rend **13** : il est saturé sur son propre plafond et
   ne décide plus rien sous 20 km. Le limiteur est **`ZOOM_SOCLE = 13` comme
   plafond de `zoomCropPrescrit`** (`globe.js:9528`), et **`MAX_Z = 15`** derrière.
4. **Altitude et texture ne sont pas deux moitiés :** le bloc n'est pas dessiné
   (`terrain.group.visible === false` à toutes les poses), la surface du crop est
   faite de **tuiles de globe**, et une tuile de globe porte **un seul raster** —
   le terrarium, décodé dans le nuanceur pour la hauteur **et** pour la couleur
   hypsométrique. Une seule grille de texels, un seul défaut.
5. **Et le correctif d'instinct casse l'exigence non négociable d'Adrien** :
   muté, le plafond levé rend nets ①, ② et ④ **et fait apparaître deux
   résolutions dans le même cadre** (`[11, 16]` à 5 000 m). Mesuré, §5.

---

## 1. LE BANC — et en quoi il diffère de la production

`scripts/sonde-cn1.mjs` (neuf). Chrome sans tête (`--headless=new`,
`--use-angle=default`), **1280 × 720**, `devicePixelRatio` 1, `vite` de dev sur
**127.0.0.1:8941**, **CPU ×4** (`Emulation.setCPUThrottlingRate`), réseau compté
au protocole CDP. Traces : `.banc/CN1/*.json` (ignoré par git).

**Quatre lieux, trois échelles de terrain, comme le brief l'exige :**
Alpes (45,92 / 6,87 — relief fort) · Bretagne (48,38 / −4,49 — littoral découpé)
· Beauce (48,20 / 1,72 — plaine) · Majorque (39,62 / 2,98 — le lieu des captures
d'Adrien, et celui de CULL et PLF).

**Le geste, et c'est lui qui fait la mesure :**
1. démarrage complet, voile `.ce-hubveil` / `.ce-elemwrap` retiré, **attente que
   le vol de démarrage soit immobile** — il se pose entre 30,7 et 33,6 km, à
   cheval sur `SEUIL_NAISSANCE_M` (**32 274 m**, relu dans la page à chaque
   tirage) ; mesurer avant, c'est un faux constat en puissance ;
2. `diveTo` puis `_rescale({lieu, zoom})` — `zoom = 15`, c'est-à-dire
   `DEFAULT_FINE_ZOOM`, le réglage que voit Adrien ; un tirage de contrôle à 13 ;
3. la caméra est **glissée le long de son axe** vers chaque altitude. ⚠️ **Ce
   n'est PAS un geste de dézoom**, donc D21 ① ne tue pas le crop, et surtout
   **`params.demZoom` n'est écrit par personne** — ce qui est exactement la
   question posée ;
4. attente du calme (file 0, vol 0, cache stable 1,5 s), puis **20 images
   consécutives**, relevées **DANS `update()`**.

**Ce que la sonde lit, et rien n'est dérivé d'une constante :**
- ① le point du sol au **centre du crop** → la tuile **la plus fine DESSINÉE**
  qui le contient (balayage de `globe.tiles`, `mesh.visible`, appartenance par
  `tuileDansCrop`, **la fonction du produit importée du module**) ;
- ② **le texel servi** = largeur au sol de cette tuile ÷ `uTilePx`, **lu sur le
  matériau de la tuile dessinée** — pas sur une constante de source. Mapterhorn
  sert du 512, le repli AWS du 256, un surzoom sert un ancêtre : les trois se
  liraient ici ;
- ③ **le pixel d'écran** = la position monde du maillage de cette tuile
  (`matrixWorld`, donc l'origine relative du §4 de la compétence), projetée
  **par la caméra réellement utilisée pour le rendu** (`camGlobe`), deux fois, à
  **100 m d'écart au sol**, dans la tangente horizontale d'écran et dans la
  verticale.

⛔ **LA PROJECTION EST FAITE À LA MAIN.** On lit `camGlobe.projectionMatrix` et
`camGlobe.matrixWorldInverse` telles qu'elles sont à l'image, on multiplie, on
divise par `w`. Aucune conversion d'unité n'entre dans la chaîne : la seule
grandeur physique est `ORBITAL_M_PER_UNIT`, importée de `/src/geo.js`. **Les
trois espaces de coordonnées sont la classe de défaut revenue dix fois ici**, et
je l'ai payée une fois de plus au §7, point 7.

**Différences avec la production, à écrire pour que le chiffre se compare :** la
pose du bloc vient de `_rescale`, pas de la molette — il n'y a donc pas
l'historique de cache d'une vraie descente. La descente d'altitude est un glissé
d'axe, pas un geste utilisateur. Le viewport est 1280 × 720 à DPR 1 : sur un
écran Retina, **le mètre par pixel est deux fois plus petit et tous les rapports
ci-dessous doublent**.

**Preuve qu'on regarde quelque chose** (§3 de la compétence — CULL a payé deux
faux zéros ici même) : chaque cellule porte `cropVivant`, `tuileCentre`,
`dessineesDansCrop`, et une cellule qui n'a pas ses 20 images valides est
déclarée **invalide**. Les 19 cellules publiées sont toutes valides.

**Domaine de validité : 20 000 m → 600 m.** Sous 600 m les relevés cessent
d'être monotones (aux Alpes : 43,5 à 600 m puis **13,9 à 400 m**), parce que
`controls.minDistance` est réécrit à chaque image par `distanceMinSol` et que la
butée polaire change la géométrie. **Je ne publie aucun chiffre sous 600 m.**
C'est aussi, de fait, le plancher du produit : au bloc z13, la descente s'est
arrêtée d'elle-même à **696 m**.

---

## 2. ① LA MESURE — l'écart entre le texel servi et le pixel affiché

### 2.1 Le chiffre d'Adrien : pixels d'écran par texel servi

Bloc à `DEFAULT_FINE_ZOOM = 15`, médiane de 20 images au repos, direction
horizontale d'écran (la moins raccourcie, donc celle où le texel est le plus
étalé et où le flou se voit).

| altitude de cadrage | Beauce (plaine) | Bretagne (littoral) | Majorque | Alpes (relief) |
|---|---|---|---|---|
| 20 000 m | 0,19 | 0,19 | 0,22 | 0,21 |
| 10 000 m | — | — | — | 0,43 |
| **5 000 m** | **0,77** | **0,78** | **0,90** | **0,94** |
| 2 000 m | 1,94 | 1,96 | — | 3,09 |
| 1 200 m | — | — | — | 7,97 |
| **900 m** | **4,31** | **4,45** | **5,09** | **19,28** |
| **600 m** | **6,45** | **6,79** | — | **43,52** |

**Niveaux de détail manquants (log₂ du rapport) :**

| altitude | Beauce | Bretagne | Majorque | Alpes |
|---|---|---|---|---|
| 5 000 m | −0,37 | −0,36 | −0,15 | −0,09 |
| 2 000 m | 0,95 | 0,97 | — | 1,63 |
| **900 m** | **2,11** | **2,15** | **2,35** | **4,27** |
| **600 m** | **2,69** | **2,76** | — | **5,44** |

**Reproductibilité.** Le tirage des Alpes a été rejoué à l'identique, session
neuve : **19,28 puis 19,44** à 900 m, **43,52 puis 43,52** à 600 m. La dispersion
est de **0,8 %**, très en dessous de l'effet — contrairement au cas de CULL, où
elle était du même ordre. Ces chiffres se signent.

### 2.2 ⛔ CE QUI CONFIRME ET CE QUI INFIRME LE « 15 px, 4 NIVEAUX »

- **INFIRMÉ comme chiffre général.** Sur trois lieux sur quatre, à l'altitude la
  plus basse que le produit autorise, le manque vaut **2,7 niveaux**, pas 4, et
  le rapport vaut **6,5 à 6,8 px**, pas 15.
- **CONFIRMÉ, et dépassé, sur le relief fort.** Aux Alpes : **4,27 niveaux à
  900 m** et **5,44 à 600 m**. Le « 4 » de `rapport-CHASSE.md` est un chiffre de
  montagne.
- **La cause de l'écart n'est pas la donnée, c'est la caméra.** Le texel servi
  est le même partout (6,35–7,36 m) ; c'est le **mètre par pixel** qui s'effondre
  aux Alpes — **0,345 m/px** contre **1,44** en plaine à altitude de cadrage
  identique, un facteur 4,2. Le relief rapproche la surface, et la butée polaire
  (`polaireMaxSol`) couche la caméra.
- ⚡ **Et le rapport passe par 1 vers 4,5–5 km**, c'est-à-dire **exactement à
  l'altitude où le bloc z15 remplit le cadre** (2 · A · tan 15° = 2 552 m donne
  A = 4 762 m). **À l'échelle de l'affiche, le crop est déjà juste** (0,77 à
  0,94). Le déficit d'Adrien commence quand il zoome **sous** le cadrage de son
  affiche, dans une sous-partie du bloc.

### 2.3 ⛔ LE POINT FIXE : rien ne bouge quand l'altitude bouge

| grandeur, bloc z15 | Beauce | Bretagne | Majorque | Alpes |
|---|---|---|---|---|
| **m par texel servi** — identique de 20 000 m à 600 m | **6,369** | **6,346** | **7,360** | **6,647** |
| niveau servi au centre — identique | **z13** | **z13** | **z13** | **z13** |
| `uTilePx` de la tuile dessinée | 512 | 512 | 512 | 512 |
| **histogramme des niveaux dessinés dans l'emprise** | `{13: 4}` | `{13: 2}` | `{13: 4}` | `{13: 2}` |
| effectif de cache, toutes altitudes | **264** | **256** | **273** | **248** |
| `_zCropEcran` | 13 | 13 | 13 | 13 |
| `params.demZoom` pendant toute la descente | 15 | 15 | 15 | 15 |

**C'est le §2 de `/threejs-optimisation` au pied de la lettre :** deux extrêmes
identiques sur un facteur 33 d'altitude. **L'histogramme est figé au bit près** —
le constat de CHASSE est **reproduit**, sur quatre lieux au lieu d'un.

Et `params.demZoom` **n'est écrit par personne** pendant une descente continue :
les seuls écrivains sont des événements de navigation explicite (lien partagé
`main.js:967`, reprise `:1017`, `EMBED_SHOWCASE` `:1062`, `START_VIEW` `:1081`,
`diveTo`/`stepZoom` `:7164`, fenêtre `:9129`, course `:13417`, session `:15051`).
**Aucun ne réagit à la descente de la caméra.** ➡️ Le bloc est cuit une fois.

### 2.4 ⚠️ ALTITUDE ET TEXTURE — la question ne se coupe pas en deux ici

- **`terrain.group.visible === false` à TOUTES les poses mesurées.** Le bloc plat
  n'est pas dessiné. Sous `terreUnique` (**vrai par défaut**, `flags.js:261`), ce
  qu'Adrien regarde est **le crop creusé dans la planète**, c'est-à-dire des
  **tuiles de globe**.
- **Une tuile de globe porte UN SEUL raster** : la dalle terrarium, décodée dans
  le nuanceur pour la **hauteur** et coloriée par la rampe hypsométrique. La
  géométrie et la couleur partagent donc **la même grille de texels**. ⛔ **Ni
  l'une ni l'autre ne domine : ce sont la même chose.** Un correcteur qui
  chercherait « laquelle des deux moitiés » perdrait sa journée sur une question
  qui n'existe pas dans cette configuration.
- **La photo aérienne est ÉTEINTE par défaut** (`map/aerial-layer.js` :
  *« photography is a mode, not the identity »*) et suit sa propre loi de zoom
  (`aerialZoomFor`, bornée par le budget de canevas). Elle est **hors sujet** —
  mais elle rentre dans le sujet dès qu'on l'allume, et personne ne l'a mesurée
  à ces altitudes-là.

### 2.5 ⚠️ LE BLOC ET SON ENVIRONNEMENT — deux lois, et une donnée jetée

| | dans l'emprise (le socle) | autour (le globe) |
|---|---|---|
| qui décide | `zoomCropPrescrit`, plafond `ZOOM_SOCLE = 13` | `chord / dist` contre `SPLIT_RATIO`, plafond `MAX_Z = 15` |
| effet mesuré | **figé à z13** de 20 km à 600 m | **monte** avec la descente (z13 → z15, garde ⓪ du test) |
| tuiles dessinées | 2 à 4 | le reste de l'écran |

⚡ **ET LA DONNÉE FINE EST DÉJÀ SUR LA MACHINE.** Le MNT du bloc à z15 est chargé,
mémoïsé, et vaut **1,592 / 1,587 / 1,840 / 1,662 m par texel** — soit **exactement
quatre fois plus fin** que ce que le crop dessine (6,369 / 6,346 / 7,360 / 6,647).
**1 536 × 1 536 = 2,36 millions d'échantillons téléchargés et jamais montrés en
surface.** Deux niveaux de détail sont déjà payés.

### 2.6 CE QU'ANNONCE L'INDICATEUR — le « 2 » de CHASSE, vérifié

Le cartouche de zoom affiche `` label: `Z${params.demZoom}` `` (`main.js:7348`),
donc **Z15**, pendant que le crop dessine du **z13**. **L'indicateur sur-promet
de deux niveaux exactement.** C'est le « 2 » du rapport CHASSE : il ne décrivait
pas le manque à l'écran (2,1 à 5,4 niveaux selon le lieu et l'altitude), mais
**l'écart entre ce que l'interface promet et ce qui est dessiné**. Les deux
chiffres sont vrais ; ils ne mesurent pas la même chose, et c'est ce qui a fait
croire à une contradiction.

### 2.7 LE PLAFOND RÉEL DE LA DONNÉE

`dem.maxZoom`, lu dans l'application à l'arrivée : **17** aux Alpes et en
Bretagne, **16** en Beauce et à Majorque ; la source servie est **Mapterhorn**
partout, en tuiles de **512 px**. ⚠️ **Le 17 breton n'est pas expliqué** — je l'ai
relevé, pas chassé ; `getDemMaxZoom` et `liftFineZoomToRegion` sont l'endroit où
regarder. **Ce que je signe est la valeur lue, pas son motif.**

### 2.8 LE COÛT D'AUJOURD'HUI — la référence à ne pas dégrader

Au repos, CPU ×4, 1280 × 720, 20 images, quatre lieux, toutes altitudes :

| grandeur | plage mesurée | plafond dur |
|---|---|---|
| cache | **246 – 273** | `CACHE_MAX_CONTINU` = 1 700 |
| `_credit` | **1 524 – 1 543** | — |
| longueur de file | **0** | `PLAFOND_FILE` = 256 |
| `update` p50 / p99 | **0,2 – 0,4 / 0,3 – 0,7 ms** | — |
| **ms par image p50** | **16,5 – 16,7** (60 im/s) | — |
| réseau à l'arrivée | **23 – 32 requêtes, 3,2 – 7,5 Mo** | — |

⚡ **Le budget n'est PAS saturé — il est à 15 % du plafond, et la machine tient
60 images par seconde à CPU ×4.** Ce n'est donc pas un problème de coût : c'est
un plafond de finesse posé à la main. Et c'est une bonne nouvelle pour le
correcteur : **il y a de la marge**, à condition de ne pas la dépenser dehors
(« les objets hors champ ne coûtent pas des appels de dessin, ils consomment les
places du cache »).

---

## 3. ② LE BARÈME — ce qu'« un crop net » veut dire, en chiffres

Le barème s'applique **du cadrage de l'affiche (≈ 5 km pour un bloc z15) jusqu'au
plancher du produit (≈ 600 m)**, sur les quatre lieux, à CPU ×4, 1280 × 720,
DPR 1, **20 images consécutives au repos**, jamais sur une image.

### ⛔ B1 — UNE SEULE FINESSE PAR IMAGE (non négociable)

`card(niveaux DESSINÉS dans l'emprise) == 1`, **à chaque image des 20**, et
**aussi pendant l'affinage** (les 60 images qui suivent l'arrêt du geste), pas
seulement au repos.
**Aujourd'hui : tenu** (`{13: 2}` à `{13: 4}` partout).
**⚠️ Et c'est l'exigence que le correctif d'instinct casse — mesuré au §5.**

### ⛔ B2 — L'EMPRISE NE RÉTRÉCIT PAS (non négociable)

Largeur au sol du crop = `_crop.demi × 2 × 40 075 016,686 × cos(lat)`.
Mesurée aujourd'hui : **2 437 m** (Bretagne), **2 445** (Beauce), **2 552**
(Alpes), **2 826** (Majorque) à `demZoom = 15` ; **10 209 m** à `demZoom = 13`.

> **Seuil : l'emprise ne descend pas sous 2 400 m, et le rapport
> emprise(après) / emprise(avant) à `demZoom` égal reste ≥ 0,99.**

**Et le piège est MESURÉ, plus seulement écrit** (`main.js:3758`) : passer le
bloc de z13 à z15 divise l'emprise par **4,00** (10 209 → 2 552 m) et change la
résolution servie dans le crop de **0,03 %** (6,649 → 6,647 m par texel).
⛔ **Rapetisser l'affiche d'Adrien n'achète EXACTEMENT AUCUNE netteté.** Un
correctif qui monterait `DEFAULT_FINE_ZOOM` a échoué avant d'avoir commencé.

### ⛔ B3 — LE COÛT RESTE TENABLE (non négociable)

Plafonds, mesurés dans les mêmes conditions que le §2.8 :

| grandeur | aujourd'hui | **plafond du barème** | plafond dur |
|---|---|---|---|
| cache au repos | 246 – 273 | **≤ 900** | 1 700 |
| cache pendant l'affinage, max | — | **≤ 1 200** | 1 700 |
| `_credit` p50 | 1 524 – 1 543 | **≥ 400** | — |
| longueur de file p50 | 0 | **≤ 64** | 256 |
| `update` p99 | 0,3 – 0,7 ms | **≤ 4 ms** | — |
| **ms par image p99, CPU ×4** | ≈ 17 | **≤ 33 ms** (30 im/s) | — |
| octets réseau par arrivée | 3,2 – 7,5 Mo | **≤ 16 Mo** | — |
| requêtes par arrivée | 23 – 32 | **≤ 120** | — |

**D'où viennent ces nombres :** servir deux niveaux de plus sur une emprise
inchangée multiplie par **16** le nombre de tuiles de l'emprise (2–4 → 32–64) et
par 16 les octets. 900 laisse **trois fois** l'état d'aujourd'hui et reste à la
**moitié** du plafond dur, très en dessous des 1 470 / 1 700 où CULL a mesuré la
pathologie. ⚠️ **Et l'ordre compte** : le socle de ce chantier a mesuré **×14 sur
les requêtes** quand on desserre un budget avant d'avoir réduit ce qui entre.
**Le budget ne se touche pas.**

### B4 — LA FINESSE (l'objet de la demande)

> **`pxParTexel ≤ 2,0` au centre du crop**, c'est-à-dire **au plus un niveau de
> détail manquant**, sur toute la plage 5 000 m → 600 m et sur les quatre lieux.

Exprimé en niveaux, ce qui est la grandeur que le banc et l'application
partagent : **`z servi ≥ min(z requis, getDemMaxZoom(région))`**, avec
`z requis = ⌈log₂( 40 075 016,686 · cos lat / (512 · 2 · mppEcran) )⌉`.

**Ce que ça donne concrètement à Majorque** (512 px, plafond de source 16) :
z15 à 2 000 m, **z16 à 900 m et à 600 m**. ⛔ **Donc `MAX_Z = 15` est lui-même un
plafond bloquant** : le barème n'est pas atteignable sans le lever.

⚠️ **ET LA NETTETÉ EST BORNÉE PAR LA DONNÉE.** Quand `z servi` atteint
`getDemMaxZoom` de la région, **B4 est réputé tenu** et ce n'est pas un défaut.
Aux Alpes à 600 m, le mètre par pixel vaut 0,153 : tenir `pxParTexel ≤ 2`
demanderait 0,31 m par texel, c'est-à-dire **du z18-z19 qui n'existe nulle part**.
**Ne demandez pas ça au correcteur ; demandez-lui de l'AFFICHER.**

### B5 — L'ÉTAT DE RÉFÉRENCE À NE PAS DÉGRADER

À **5 000 m** (le cadrage de l'affiche), le crop est **déjà juste** : 0,77 / 0,78
/ 0,90 / 0,94 px par texel. **Aucune valeur ne doit y monter au-dessus de 1,2.**
Et l'histogramme y reste `{z: n}` à un seul niveau.

### B6 — LE TEMPS JUSQU'À LA NETTETÉ, ET LE CLIGNOTEMENT

- **≤ 3 000 ms** après l'arrêt du geste, à 30 Mb/s, pour atteindre B4 sur toute
  l'emprise. ⚠️ **Aujourd'hui ce temps vaut 0 ms — et c'est précisément le
  symptôme** : rien de plus n'est jamais demandé, donc le crop est « fini » tout
  de suite, et flou. CULL a mesuré ce que coûte l'autre extrême : **23 à 34 s**
  quand on cesse de précharger. **C'est le poste de régression n° 1.**
- **Zéro clignotement** : sur les 60 images qui suivent l'arrêt, aucune image ne
  dessine **0 tuile** dans l'emprise, et B1 tient à chacune d'elles.
- Tant que B4 n'est pas atteint, **l'indicateur discret doit être levé**
  (`etatIndicateur`, `monde/descente-bornee.js` — l'état existe déjà, il a deux
  lecteurs, `main.js:3740`).

### B7 — L'INDICATEUR NE SUR-PROMET PLUS

Le cartouche affiche aujourd'hui `Z15` pendant qu'on dessine du z13 : **deux
niveaux de sur-promesse**. Après correctif, l'écart entre ce qu'annonce le
cartouche et le niveau réellement dessiné dans l'emprise doit valoir **0**, et
quand la source est à son plafond régional, cela doit se lire.

---

## 4. ③ LES TESTS ROUGES

`test/crop-nettete-ecran.test.js`, **6 tests**, inscrit dans la liste explicite
de `package.json`. `npm run audit:tests` : **266 listés · 266 sur disque, 6 hors
suite déclarés, aucun écart.**

| # | ce qu'il dit | à la livraison |
|---|---|---|
| ⓪ | **garde** — hors de l'emprise, le niveau maillé MONTE quand la caméra descend | ✔ vert |
| ① | la finesse servie dans le crop monte quand la caméra descend | ⛔ **ROUGE** |
| ② | un texel servi ne couvre pas plus de 2 pixels (2 000 / 900 / 600 m) | ⛔ **ROUGE** |
| ③ | **garde** — une seule finesse dessinée dans l'emprise, à chaque altitude | ✔ vert |
| ④ | le crop est net **sans que son emprise rétrécisse** | ⛔ **ROUGE** |
| ⑤ | **garde** — le cache reste sous le plafond du barème | ✔ vert |

> **`npm test` : 4 935 tests · 4 932 réussis · 3 échecs** — les trois attendus
> (①, ②, ④) et **rien d'autre**. Base 4 929 · 0, plus mes 6 tests.
> ⚠️ **Le compte exact attendu par le correcteur est donc : 3 échecs, et zéro
> quand le crop sera net.**

**⓪ existe parce qu'une suite rouge ne prouve pas plus qu'une suite verte.** Un
test peut être rouge pour une raison stupide : banc mort, seuil inatteignable.
⓪ mesure **la même grandeur, dans les mêmes images, à un endroit où elle DOIT
bouger** — hors de l'emprise, où `_traverse` décide par `chord / dist`. Il rend
z13 à 20 km et z15 à 900 m : le banc est vivant, donc le z13 figé de ① est un
fait sur le produit, pas sur le harnais.

**④ met la netteté et l'emprise dans la MÊME assertion, exprès** : un correcteur
qui atteindrait le seuil de netteté en rétrécissant le bloc ferait passer ② et
tomberait ici.

---

## 5. ⛔ LA PREUVE DE MORSURE — et le résultat le plus utile du rapport

Mutation appliquée à `src/globe.js`, **puis retirée** (`git diff -- src/` est
vide, vérifié) — trois lignes, toutes sur le plafond de finesse :
`MAX_Z = 15 → 16` · `Math.min(z + MARGE_CROP, ZOOM_SOCLE) → …, 16)` ·
`while (z < ZOOM_SOCLE) → while (z < 16)`.

| test | dépôt | mutation **partielle** (2 lignes) | mutation **complète** |
|---|---|---|---|
| ⓪ garde banc vivant | ✔ | **✖** — z14 partout, dedans comme dehors | ✔ |
| ① finesse ~ altitude | ✖ z13 partout | ✖ **z14** partout | **✔** |
| ② px par texel | ✖ 10,99 à 900 m | ✖ **5,49** | **✔** |
| ③ **garde une seule finesse** | ✔ | ✔ | ⛔ **✖ — `[11, 16]` à 5 000 m** |
| ④ net sans rétrécir | ✖ | ✖ | **✔** |
| ⑤ garde coût | ✔ | ✔ | ✔ |

**Trois choses se lisent là-dedans, et elles valent le rapport :**

1. **Les tests mordent.** Les chiffres bougent avec le produit (13 → 14 → 16),
   pas avec une constante du test.
2. **La mutation partielle est instructive** : lever `MAX_Z` et le plafond de
   sortie sans toucher à la boucle `while (z < ZOOM_SOCLE)` ne gagne **qu'un
   seul niveau** — la boucle de `_zoomCropEcran` ne peut structurellement pas
   rendre plus que `ZOOM_SOCLE`. **Il y a trois verrous, pas un.**
3. ⚡ **ET LE CORRECTIF D'INSTINCT CASSE L'EXIGENCE NON NÉGOCIABLE D'ADRIEN.**
   Le plafond levé rend ①, ② et ④ verts, tient l'emprise, tient le coût — **et
   fait apparaître deux résolutions dans le même cadre**. C'est exactement ce que
   B1 existe pour attraper.

---

## 6. ④ CE QUE JE DIS AU CORRECTEUR — les contraintes, pas la conception

**Qui décide de quoi, aujourd'hui :**

| | rôle mesuré |
|---|---|
| `ZOOM_SOCLE = 13` (`monde/seuil-socle.js:170`) | **le limiteur observé.** Plafond de `zoomCropPrescrit`, `globe.js:9528`. C'est lui, pas autre chose. |
| `MAX_Z = 15` (`globe.js:821`) | plafond du quadtree **derrière** le précédent — il bloque aussi B4, qui demande z16 à 900 m. |
| `_zoomCropEcran` (`globe.js:4974`) | **borne d'écran de CULL. Saturée : rend 13 à toutes les altitudes mesurées.** Ne décide plus rien sous 20 km. Sa boucle `while (z < ZOOM_SOCLE)` est un **troisième** verrou. ⛔ **Ne pas la confondre avec la cuisson du bloc** — c'est le piège que le brief signalait, et il est réel. |
| `assietteCrop` (`main.js:6116`) | fabrique l'**emprise** du crop depuis la largeur du bloc courant, `zoom = log2(360·3/large)`. Elle suit `params.demZoom`, pas la caméra. |
| `poserCrop` (`globe.js:4778`) | pose le repère. La bascule de domaine des jupes s'y décide **une fois par pose**, pas par image — CULL a mesuré la repasse par image **pire** (31·57·30 px de trou contre 0·33·17). |
| `params.demZoom` | **écrit uniquement par des navigations explicites.** Aucun écrivain ne suit la descente continue. |

**Les contraintes :**

- **Les trois espaces de coordonnées** : bloc (`TERRAIN_SIZE = 56` unités pour
  `largeurBlocM()` mètres), globe (`R_GLOBE = 100` pour 6 371 km, soit
  `ORBITAL_M_PER_UNIT = 63 710 m` l'unité), caméra d'effets (`cameraDeRendu()`,
  similitude `k = largeurBlocM / 56 / 63 710`). ⛔ **La classe de défaut revenue
  dix fois ici, et je l'ai payée une onzième fois** (§7, point 7).
  ⚠️ **`_crop.demi` n'est dans AUCUN des trois** : il vit en **mercator
  normalisé**. Sa largeur au sol vaut `demi × 2 × 40 075 016,686 × cos(lat)`.
- **Le plafond des sources** : Mapterhorn sert du **z17 en Suisse**, du **z16 en
  France**, z15 ailleurs (`getDemMaxZoom`, `liftFineZoomToRegion`) ; mesuré,
  `dem.maxZoom` rend **17 / 17 / 16 / 16** sur mes quatre lieux, en tuiles de
  512 px. **Quand la région n'a pas mieux, la netteté s'arrête, et il faut que
  l'écran le dise** (B4, B7). Le repli AWS sert du **256 px** : à niveau égal,
  **un texel deux fois plus gros**.
- **La donnée fine est déjà là** : 2,36 millions d'échantillons à 1,59–1,84 m par
  texel, chargés et jamais montrés (§2.5).
- **L'ordre des correctifs** : réduire d'abord ce qui entre dans le cache, jamais
  desserrer un budget d'abord (×14 sur les requêtes, mesuré sur ce chantier).
  Ici le cache est à **15 % de son plafond** : il n'y a rien à desserrer.
- **La reprise du geste** : `_zoomCropEcran` a **un niveau de marge**
  (`MARGE_CROP = 1`) payé par une mesure — sans lui l'arrivée se posait à z12.
  Ne pas le retirer sans le remesurer.

**Les pièges de mesure, chacun a produit un faux constat ici :**
le voile `.ce-elemwrap` avale les gestes · la pose de démarrage arrive après
plusieurs secondes, entre 30,7 et 33,6 km, **à cheval sur le seuil de naissance
du crop (32 274 m)** · un relevé sur une image ne prouve rien (cycle de période
4) · une sonde posée **après** la fonction lit un état écrasé · `renderer.info`
se réinitialise à chaque `render()` · le terrarium est du `.webp` **lossy**
(±0,5 m au zéro de mer) · Vite sur `--host 127.0.0.1` · scripts d'édition en
binaire, relire l'octet écrit.

⚠️ **Et un piège que j'ajoute** : `controls.minDistance` est **réécrit à chaque
image** par `distanceMinSol`. Le poser depuis une sonde ne tient pas ; sous
600 m les relevés cessent d'être monotones. **Le plancher du produit fait partie
de la mesure**, pas de l'instrument.

---

## 7. CE QUE J'AI CRU PUIS RÉFUTÉ

1. **« Le flou vient de `_zoomCropEcran` »** — l'hypothèse de tête, celle que le
   brief demandait de départager. **Non** : `_zCropEcran` rend **13** à toutes
   les altitudes mesurées, sur les quatre lieux. Il est saturé sur son propre
   plafond `ZOOM_SOCLE` et **ne décide rien** dans la plage qui intéresse Adrien.
   Le mécanisme observé est `ZOOM_SOCLE` comme plafond de `zoomCropPrescrit`.
2. **« On regarde le MNT du bloc à z15 »** — **non** : `terrain.group.visible`
   vaut `false` à toutes les poses. 2,36 millions d'échantillons à 1,84 m par
   texel sont téléchargés, mémoïsés, et **jamais dessinés en surface**.
3. **« Il faut départager l'altitude et la texture de couleur »** — la question
   ne se pose pas dans cette configuration : **une tuile de globe porte un seul
   raster**, décodé pour la hauteur et colorié par la rampe. Le brief avait
   raison d'exiger la vérification ; la réponse est qu'il n'y a pas deux moitiés.
   ⚠️ Cela **cesse d'être vrai** si la photo aérienne est allumée.
4. **« Un texel couvre 15 pixels, 4 niveaux de manque »** — **infirmé comme
   chiffre général** (4,3 à 6,8 px, 2,1 à 2,8 niveaux en plaine, sur littoral et
   à Majorque), **confirmé et dépassé sur relief fort** (19,3 puis 43,5 px aux
   Alpes). Le chiffre n'était pas faux : il avait été publié **sans son lieu**.
5. **« L'indicateur se trompe »** — non : il affiche `Z${params.demZoom}`, donc
   le niveau du **bloc**. Il ne ment pas, il **répond à une autre question** que
   celle qu'on lui posait. Les « 2 » de CHASSE et les « 4 » de CHASSE sont deux
   grandeurs différentes, toutes deux justes.
6. **« Le premier seuil de test »** — j'avais écrit « au banc, un texel ne couvre
   pas plus de 4 pixels ». **Le test était inatteignable même par un correctif
   parfait** : avec les tuiles AWS de 256 px du harnais et `MAX_Z = 15`, le
   meilleur rapport possible à 900 m vaut **5,49**. Un test qui ne peut pas
   passer ne décrit rien. Réécrit sur le **niveau servi**, grandeur que le banc
   et la production partagent.
7. **« `_crop.demi` est en unités de globe »** — non, et c'est la onzième fois
   que les trois espaces mordent quelqu'un ici. Ma première conversion rendait
   une **emprise de 6 mètres**. Elle a été attrapée parce que 6 m est absurde ;
   une erreur d'un facteur 3 serait passée. `demi` vit en **mercator normalisé**.
8. **« Il suffit de lever le plafond »** — mesuré, §5 : cela rend ①, ② et ④
   verts **et casse ③**, l'exigence non négociable. Deux résolutions dans le même
   cadre à 5 000 m.
9. **« Le coût est la contrainte »** — non : cache à **15 %** de son plafond,
   `_credit` à 1 530 sur 1 700, file à **0**, **60 images par seconde à CPU ×4**.
   Rien n'est saturé. Le plafond de finesse est posé à la main, pas subi.

---

## 8. ⑤ LES CAPTURES POUR ADRIEN

Majorque (39,62 / 2,98), bloc à `DEFAULT_FINE_ZOOM = 15`, même lieu, trois
altitudes, 1280 × 720 :

| fichier | altitude | ce qu'on part corriger |
|---|---|---|
| `.banc/CN1/cliches/majorque-z15-20000m.png` | 20 033 m | 0,22 px par texel — **la donnée est cinq fois plus fine que l'écran** |
| `.banc/CN1/cliches/majorque-z15-5000m.png` | 4 994 m | 0,90 px par texel — **le cadrage de l'affiche, et il est juste** |
| `.banc/CN1/cliches/majorque-z15-900m.png` | 900 m | **5,09 px par texel, 2,35 niveaux de manque** — le flou d'Adrien |

⚠️ Les trois images sont **rigoureusement le même terrain, à la même finesse de
donnée** (z13, 7,360 m par texel, histogramme `{13: 4}`) : entre la première et
la troisième, **seule la caméra a bougé**. C'est la phrase d'Adrien en trois
images : *« l'image ne gagne pas en détail, elle grossit »*.

Chemin absolu : `C:\Dev\wt-cn1\.banc\CN1\cliches\`. ⚠️ `.banc` est ignoré par
git : les PNG (1,6 Mo pièce) **ne voyagent pas avec la branche**, c'est un choix
et pas un oubli.

---

## 9. CE QUI RESTE OUVERT

- **Le `dem.maxZoom = 17` de la Bretagne n'est pas expliqué.** Relevé, pas
  chassé.
- **Sous 600 m, je n'ai pas de loi.** Les relevés y cessent d'être monotones à
  cause de la butée polaire. Si Adrien travaille sous 600 m, il faut un banc qui
  respecte `distanceMinSol` au lieu de le contourner.
- **La photo aérienne n'a jamais été mesurée à ces altitudes**, et c'est le seul
  cas où « altitude » et « texture » redeviennent deux choses distinctes.
- **Le temps jusqu'à la netteté (B6) n'a pas de test.** Le banc de node rend ses
  dalles en une microtâche : il ne peut pas mesurer une latence réseau. Il faut
  la sonde, pas la suite.
- **Le coût APRÈS correctif n'est pas mesuré** — par construction : il n'y a pas
  de correctif. Les plafonds de B3 sont des **budgets**, pas des relevés.
