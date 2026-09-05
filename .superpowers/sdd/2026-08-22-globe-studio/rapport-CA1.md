# RAPPORT CA1 — L'ATTAQUANT DU « CROP D'ABORD » (D27) : LE DÉZOOM, IMAGE PAR IMAGE

Arbre `C:\Dev\wt-ca1`, branche `crop-avant-tout-attaque`. Vite `--host 127.0.0.1
--port 11311 --strictPort` (arrêté en partant). Chrome sans tête de
`puppeteer-core`, 1280 × 800, ANGLE, **un Chrome par banc, tué par mon
script**. `npm install` non lancé. **`git diff -- src/` : vide.**

> **Adrien, 2026-09-05 :** *« Voilà la vidéo d'un dézoom, honnêtement, c'est
> bourré de bugs. On ne peut pas lancer le crop avant même d'afficher la terre
> ou la mer ? Ça évite d'afficher des éléments qui sont hors crop. »*

## ⚡ LE VERDICT EN CINQ LIGNES

1. **La vidéo est reproduite 7/8** au banc (La Réunion, crop z13 chaud, trois
   crans de molette en 120 ms) : `WIDENING z12` puis `z11`, **la planète entière
   dessinée autour du crop vivant pendant 105 – 206 images (5,5 – 8,7 s)**, jusqu'à
   **52 000 px hors emprise** sur une cible de 320 × 200 (81 % de l'écran hors
   crop), **60 images de plaque provisoire** et **5,0 – 8,6 s sans la mer du crop**.
   Le 8ᵉ chargement est la SORTIE (le crop meurt à 40,7 km) — c'est l'autre geste.
2. ⚡ **L'ordre réel : le dessin d'abord, l'emprise après.** Le dehors est
   redessiné par **deux mécanismes qui ne regardent pas l'emprise** : la
   permission de la molette (`dehorsPermis`, +37 – 50 ms) qui fait tomber la porte
   du repos, et **la LOI d'altitude, qui saute à l'image même où l'emprise
   change** parce que `altitudeCadrageM` se lit en unités du bloc (23 125 m à la
   pose z12, 37 000 m à la pose z11 : `uEstompage` 1 → 0,885 → 0,13 dans l'image
   de la pose). L'emprise, elle, n'arrive que **276 – 403 ms après l'annonce**
   du WIDENING (le rechargement du bloc), et ses parois sont **provisoires
   pendant 60 images** à z11, sa mer **refusée 5 – 8,6 s**.
3. **Dans l'autre sens (re-zoom z11 → z12), 0 pixel hors emprise 7/7**, parois
   définitives dans l'image de la pose, aucun refus : la règle est déjà tenue au
   zoom avant. C'est le dézoom seul qui la viole.
4. **Trois tests rouges** (`test/crop-avant-tout.test.js` ①②③, inscrits), sur
   la chaîne RÉELLE (`branchement-crop` + `estompage-terre` + `veille-repos`,
   globe de papier **avec latence**) ; morsure prouvée par mutation dans les
   deux sens (§③). Deux gardes vertes (④ re-zoom, ⑤ témoin sans latence).
5. ⚠️ **Le conflit à trancher est nommé** : D27 (« rien hors crop pendant la
   transition ») contredit la permission de la molette du 2026-08-23 (« si je
   dézoome EN SCROLLANT, tu peux faire réapparaître le reste »), que `vie-crop`
   ②/④, `veille-repos` ⑥/⑨ et `estompage-fondu` ④ verrouillent. Ma lecture :
   la permission vaut pour la **sortie** (le crop meurt, puis la planète) ; entre
   deux paliers **d'un crop qui vit**, D27 l'emporte — c'est le geste filmé.

## ① LA MESURE — l'ordre réel, image par image

**Banc** : `scripts/sonde-ca1.mjs` (8 chargements, `.banc/CA1/dezoom8.json`,
bilan `traces-CA1/dezoom8-bilan.md`). Chaque passe : page neuve, `flyTo`
La Réunion z13, la pose de la vidéo (bloc entier, 1,1 × largeur, 35°, cap 15° —
la pose de SOC), **chauffe jusqu'à la netteté** (file et vol vides, aucun
refus, crop seul, `zServi` 13, 60 images stables), **témoin de 20 images**
(`horsPx = 0` **8/8**, dessin ≥ 28 189 px), puis le geste. Relevé **dans un rAF
posé après celui de l'application** (sur l'état DESSINÉ), une ligne par image :
emprise (`_crop.demi`, `uCropDemi`), repère et `provisoire` des parois,
`_cropSeul`, `porteRepos`, `uEstompage`, `dehorsPermis`, `refus` de la veille,
`_zCropServi`, tuiles dessinées et dessinées hors emprise (`tuileDansCrop`, la
loi du produit), **pixels dessinés hors de l'emprise** : le groupe du globe seul
(tuiles + parois) rendu sur fond magenta dans une cible hors écran de 320 × 200
(la méthode de CULL — `readPixels` sur le compositeur rend 0, sur SA cible non),
fragments non magenta hors de l'enveloppe convexe de l'emprise projetée
(8 sommets du haut à 4 000 m × exagération + la boîte des parois, dilatée de
1,5 px). Screencast CDP horodaté sur `performance.timeOrigin` (passe 1).

⚠️ **Deux découvertes de protocole, payées avant le premier chiffre :**
- **un cran isolé ne franchit aucun palier** : `_levelZoom` gagne 0,017 par cran
  pour un niveau à ln 2 = 0,693 — quarante crans isolés pour un niveau. Le
  « dézoom cran par cran » du brief n'existe pas comme geste ; celui d'Adrien
  est un DÉFILEMENT, et **trois crans en moins d'une seconde confirment la
  sortie** (`sortie-molette.js`) : la poussée monte de 8,6 km à 37 km en ~1 s et
  franchit z12 puis z11. Six crans : z10 et la mort. Le banc joue donc **une
  rafale de 3 crans à 60 ms**, puis 4 s de calme ;
- **z10 n'est pas atteignable crop vivant** dans cet arbre : la poussée qui y
  mène passe 40 343 m (`SEUIL_MORT_M`), le crop meurt. Le palier de la vidéo est
  z11 (`r_014`, `r_020`), et c'est lui que le banc mesure.

### Le geste, image par image — passe 1 (les 7 passes vivantes se lisent pareil)

| t (ms depuis le 1ᵉʳ cran) | ce qui se passe | emprise | parois | `uEstompage` | px hors | alt (cadrage) |
|---|---|---|---|---|---|---|
| 0 | cran 1 | z13 | déf. | 1 | 0 | 8 660 m |
| **+42** | `dehorsPermis` = 1, `_cropSeul` = 0, `porteRepos` commence à tomber (30 images) | z13 | déf. | 1 | 0 | 8 666 |
| +306 | la poussée monte (la caméra atteint `maxDistance` ; le crop rétrécit à l'écran : 28 189 → 13 652 px) | z13 | déf. | 1 | 0 | 12 568 |
| **+372** | « WIDENING Z12 », `busy` : le bloc se recharge | z13 | déf. | 1 | 0 | 12 568 |
| **+643** | **`poserCrop` z12** — dans la MÊME image : parois définitives (hauteurs en cache), `refus: fond+mer`, `uEstompage` 1 → **0,885**, **37 825 px hors emprise**, 55 tuiles dessinées hors | **z12** | déf. | 0,885 | **37 825** | **23 125** |
| +716 | « WIDENING Z11 », `busy` | z12 | déf. | 0,879 | 43 629 | 25 130 |
| +914 | `_zCropServi` 13 → **12** (`_zoomCropEcran` suit la caméra) ; **52 030 px hors** (le pic) | z12 | déf. | 0,873 | 52 030 | 34 083 |
| **+1 014** | **`poserCrop` z11** — parois **PROVISOIRES**, `refus: fond+parois+rampe+mer`, `uEstompage` **0,13**, tuiles dessinées DANS l'emprise de z6 à z12 | **z11** | **PROV** | 0,13 | 34 236 | **36 622** |
| +1 120 | fin de la poussée (`_sortieCourse` nulle) | z11 | PROV | 0,10 | 34 445 | 37 452 |
| +2 088 | `uEstompage` 0 : **la planète entière** | z11 | PROV | **0** | ~36 000 | 37 700 |
| **+3 059** | parois définitives (fin des 60 images provisoires) | z11 | déf. | 0 | 36 674 | 39 145 |
| +5 100 | 30 images calmes : repos, `poserRepos(true)`, le fondu remonte | z11 | déf. | 0 → 1 | | 39 483 |
| **+5 992** | la mer et le fond du crop enfin posés (`refus` vide) | z11 | déf. | ~0,9 | | |
| **+6 407** | dernier pixel hors emprise | z11 | déf. | 0,99 | **0** | |
| +6 527 | `_cropSeul` = 1 (fondu achevé) | z11 | déf. | 1 | 0 | |
| +6 729 | palier NET (file, vol, refus vides, parois définitives, crop seul) | z11 | déf. | 1 | 0 | 39 483 |

Puis le re-zoom (rafales de 3 crans vers l'intérieur, une toutes les 4 s) :
**15 rafales avant le premier « REFINING Z12 »** (l'altitude descend de 39 km à
11,4 km sans franchir), et au palier z11 → z12 : **parois définitives dans
l'image de la pose, aucun refus, `_cropSeul` 1, `uEstompage` 1, 0 px hors, 7/7**.

### Les 8 chargements (ms depuis le premier cran du geste qui franchit)

| grandeur | 7 passes vivantes | passe 4 (sortie) |
|---|---|---|
| témoin `horsPx` | **0 × 8** | 0 |
| `dehorsPermis` / `_cropSeul` = 0 | +37 – 50 | +282 |
| annonce WIDENING z12 → pose z12 | +356 – 408 → **+643 – 811** | +4 719 → (mort avant) |
| annonce z11 → pose z11 | +716 – 869 → **+979 – 1 243** | mort à +5 311 (40 726 m) |
| altitude de cadrage à la pose z12 / z11 | 23 125 – 23 133 / 36 622 – 37 277 m | |
| **premier pixel hors emprise** | **= l'image de la pose z12, 7/7** (37 825 – 39 965 px) | +49 221 (renaissance, 3 874 px) |
| premier `uEstompage < 1` | = l'image de la pose z12, 7/7 | +5 311 |
| `zMin` dessiné DANS l'emprise après la pose z11 | **6 – 11** (cible 12) | 12 |
| parois à la pose z12 / z11 | définitives 7/7 / **PROVISOIRES 7/7** | déf. |
| fin des parois provisoires | +2 595 – 4 379 (**30 – 60 images**) | — |
| fin du refus de la mer et du fond | **+5 021 – 8 586** | — |
| dernier pixel hors emprise | +5 486 – 8 721 | +50 198 |
| `_cropSeul` revenu | +5 565 – 8 883 | +50 364 |
| palier net | **+6 045 – 8 981** | +55 217 |
| pic de pixels hors emprise (sur 64 000) | **52 030 – 52 193** | 3 874 |
| images avec des pixels hors emprise | **105 – 206** | 52 |
| images MIXTES (planète dessinée ET socle partiel : provisoire ou mer/fond refusés) | **93 – 186** | 0 |
| images de parois provisoires | 30 – 60 | 0 |
| re-zoom z11 → z12 : px hors / parois / refus | **0 / déf. / aucun, 7/7** | 52 img après la renaissance |
| requêtes réseau (geste + re-zoom) | 285 – 309 | 326 |

⚡ **La réponse à la question d'Adrien** : aujourd'hui **le dessin est posé
avant l'emprise, et par deux portes** :
1. **la porte du repos** — la molette donne `dehorsPermis` à +40 ms, `_cropSeul`
   tombe, le quadtree repart parcourir le dehors ; mais **sous 19 364 m la loi
   d'altitude vaut 1**, donc rien ne se voit tant que la poussée n'a pas franchi
   la bande (c'est pour ça qu'aucun pixel hors n'apparaît avant la pose z12) ;
2. **la loi d'altitude** — `altitudeCadrageM` = `camY × emprise / span` : **elle
   change d'unité dans l'image où l'emprise change** (12 568 → 23 125 m à z12,
   25 130 → 36 622 m à z11, sans que la caméra visible saute). Le franchissement
   de 19 364 m et de 40 343 m à l'estompage est donc **provoqué par la pose du
   crop elle-même**, pas seulement par la montée de la caméra — c'est le
   troisième espace de coordonnées, encore. Résultat : `uEstompage` 1 → 0,885
   dans l'image de `poserCrop` z12, et 0,879 → 0,13 dans celle de z11.

Et **l'emprise arrive en retard sur tout** : 276 – 403 ms après l'annonce (le
rechargement du bloc, `loadSurface` → `regenerateTerrain`), avec des parois
provisoires (z11) et sans mer pendant 5 – 8,6 s. Entre les deux, on voit
**l'ancien crop qui rétrécit** (13 652 → 4 254 px dans la passe 4) puis un saut
d'emprise ×2.

⚠️ **Ce que SOC a réglé, et ce qu'il n'a pas réglé** : la plaque provisoire suit
bien la découpe dans l'image de la pose (7/7, `paroisDemi = cropDemi`, jamais
« ANCIENNES ») — la « plaque grise partiellement posée » de `r_014` n'est plus
une plaque du repère d'avant, c'est **la provisoire, pâle, sans mer** (voir
`traces-CA1/02-pose-z11-provisoire.jpg`). Elle reste 30 – 60 images.

### Captures — les instants de la vidéo, sur le banc (`traces-CA1/`, passe 1)

| capture | t | ce qu'on voit | l'image d'Adrien |
|---|---|---|---|
| `00-avant-geste.jpg` | −50 ms | le crop z13 chaud, vue de trois quarts, papier autour | `r_001` |
| `01-pose-z12.jpg` | +711 | « WIDENING Z12 » : découpe z12, parois, mer ABSENTE (blanc), le globe pâle autour (`uEstompage` 0,885) | `r_010` |
| `02-pose-z11-provisoire.jpg` | +1 043 | « WIDENING Z11 » : **l'île entière dessinée**, la mer du globe autour, la découpe z11 lisible par sa couture de finesse (z12 dedans, z6 autour), plaque provisoire pâle, pas de mer | **`r_014`** |
| `03-planete-autour-pic.jpg` | +2 083 | planète entière, nuages, crop vivant | **`r_020`** |
| `04-fin-provisoire.jpg` | +3 090 | parois définitives, toujours la planète autour | `r_021` |
| `05-repos-z11-crop-seul.jpg` | +6 820 | le crop z11 net, papier autour | `r_025` |

## ② LE BARÈME — « crop d'abord », en chiffres

Mesuré par `scripts/sonde-ca1.mjs` (8 chargements, même lieu, même pose, même
rafale), lu par `scripts/bilan-ca1.mjs`. « Transition » = du premier cran du
geste jusqu'au palier net, **crop posé de part et d'autre** (la sortie — le crop
meurt — est un autre geste, hors barème ; la passe 4 en est une).

| exigence | seuil | aujourd'hui |
|---|---|---|
| ⛔ **pixels hors emprise pendant la transition** (`horsPx`, cible 320 × 200, témoin 0) | **0 à toutes les images, 8/8, dans les deux sens** | 52 000 px, 105 – 206 images au dézoom ; 0 au re-zoom |
| ⛔ **images mixtes** (`uEstompage < 1` ∧ (provisoire ∨ refus fond/mer/parois ∨ parois d'un autre repère)) | **0 image, 8/8** | 93 – 186 |
| **socle complet avant le premier pixel du nouveau palier** — ordre rAF : à l'image où `uCropDemi` change, `paroisDemi = cropDemi` ; aucune image où l'emprise est neuve et la mer refusée | **0 image de découpe neuve sans SA mer et SES parois** (provisoires admises si elles couvrent — voir la proposition) | mer refusée 5 – 8,6 s à chaque palier ; parois provisoires 30 – 60 images |
| **ce qu'on montre entre deux paliers** | **le nouveau socle, complet et vide, dès l'image de la pose** — voir ci-dessous | l'ancien crop rétréci 276 – 403 ms, puis découpe neuve pâle sans mer |
| **temps sans terrain** dans l'emprise (`dedansPx` < 90 % du témoin, ou `zMin` sans parent) | **0 image** (D25 : le parent couvre) | 0 image (`zMin` 6 – 11 : les parents couvrent) |
| **temps jusqu'au palier net** (premier cran → file/vol/refus vides, parois définitives, crop seul) | **≤ 8 981 ms** (pas de régression sur le pire des 7 ; médiane 7 019) | 6 045 – 8 981 |
| **temps jusqu'à la mer du crop** (`finRefusMer`) | **≤ 8 586 ms**, et **jamais visible** : tant qu'elle n'est pas là, on ne montre pas une découpe sans mer | 5 021 – 8 586, visible |
| ⛔ **acquis** | 0 recul de finesse dans la partie déjà dessinée (TUILE : `_zCropServi` ≥ 12 pendant la transition, jamais < cible) ; 0 image de Terre hors intention (VIE : glissé/inclinaison/bouton → 0 image, `sonde-vie.mjs`) ; parois 0 trait (SOC) ; 0 px de mer hors arête (MER2) ; **re-zoom z11 → z12 : 0 px hors, parois définitives à la pose, 7/7** | tenus (zServi min 12 ; re-zoom propre 7/7) |
| coût | `dt` p50 par image pendant le geste (nu, ×4) et requêtes : pas de régression — voir § coût | voir § coût |
| ⚠️ **la sortie reste possible** | 3 crans < 1 s puis la course : le crop meurt à 40 343 m (`sonde-vie.mjs --geste molette`, 8/8) ; après la mort, la planète est légitime | passe 4 : mort à 40 726 m |

**Ma proposition pour « ce qu'on montre entre deux paliers » : le nouveau
socle vide, dès l'image de la pose.** L'ancien crop complet n'est pas tenable :
la poussée fait déjà rétrécir l'ancien crop de 28 000 à 4 254 px avant que
l'emprise change (passe 4), et attendre la mer (5 – 8,6 s) à l'ancienne emprise
laisserait un bloc quatre fois trop petit au milieu de l'écran pendant tout ce
temps. Le nouveau socle, lui, est **déjà** posé dans l'image de la pose (SOC :
`paroisDemi = cropDemi` 7/7), et l'intérieur est **déjà** couvert par les
parents (`zMin` 6 – 11, `dedansPx` ne tombe jamais à zéro) : **le temps sans
terrain est 0 image aujourd'hui**, il doit le rester. Ce qui manque au socle
vide, c'est **la mer** (5 – 8,6 s) et **des parois définitives** (30 – 60
images) — et ce qui le rend « mixte », c'est la planète autour. Le chiffre à
tenir est donc : 0 px hors, 0 image sans terrain, et la découpe neuve **n'est
montrée qu'avec une mer** (provisoire ou définitive — je ne tranche pas la
conception).

## ③ LES TESTS ROUGES — `test/crop-avant-tout.test.js`, inscrit dans `package.json`

Sur la chaîne RÉELLE : `creerVeilleCrop` + `creerVeilleEstompage` +
`creerVeilleRepos`, globe de papier qui se souvient de ce qu'il a posé, **avec la
latence mesurée** (parois provisoires 3 appels, mer refusée 5 reprises de 30
images), l'altitude de la vidéo (8 600 → 38 000 m en 60 images), les paliers
z13 → z12 (image 25) → z11 (image 45), la molette armée avant la première image.

| test | ce qu'il exige | dépôt | mutant A (`armerSortie` ne donne plus `dehorsPermis`) |
|---|---|---|---|
| ① entre deux paliers, le crop vit et RIEN hors de l'emprise n'est dessiné (`est.valeur ≥ 0,999`, `cropSeul` vrai à chaque image) | 0 image | ⛔ **86 images** (première : 34) | ✔ |
| ② une découpe neuve n'est jamais affichée sans SES parois et SA mer | 0 image | ⛔ **170 images** (première : 25, mer du repère d'avant) | ⛔ 170 |
| ③ 0 image d'état mixte (dehors dessiné ∧ socle partiel) | 0 | ⛔ **86** | ✔ |
| ④ re-zoom z11 → z13 sans latence — l'acquis, garde | 0 | ✔ | ✔ |
| ⑤ témoin : sans latence ni molette, aucune assertion ne mord ; avec la latence seule, le socle partiel naît | — | ✔ | ✔ |

**Morsure** : le mutant A est une copie de `src/` (md5 `2563db4f…` →
`4f23259f…`, une ligne : `dehorsPermis = true` retirée d'`armerSortie`) — ① et ③
passent au vert, ② reste rouge (il mesure la latence de la mer, pas la
permission) ; ⑤ prouve que les assertions sont tenables sans latence et que la
latence seule fait naître le socle partiel : **« un banc sans latence ne peut
pas faire naître un état mixte »** (CN3). `npm run audit:tests` : 286 = 286,
aucun écart. Comptes attendus après correction : ① 0, ② 0, ③ 0, ④ 0, ⑤ inchangé.

⚠️ **Le mutant A fait rougir `vie-crop` ②/④ et `estompage-fondu` ④** : c'est le
conflit du § verdict, point 5. Le correcteur ne peut pas retirer la permission ;
il doit la réconcilier avec D27 (la permission ne vaut que pour la sortie, ou
elle ne rallume rien tant qu'un palier est en cours — je ne conçois pas).

## ④ CE QU'IL FAUT DIRE AU CORRECTEUR — les pièges du chemin, sans la conception

- **`dehorsPermis` / `porteRepos` / `_cropSeul` (VIE, MIX)** : la molette donne
  la permission 40 ms après le cran, le fondu du repos dure 30 images, le crop
  seul ne revient que `IMAGES_CALME` (30) images après le DERNIER mouvement, puis
  30 images de fondu : c'est ce qui fait 5,5 – 8,7 s de planète. Et
  **`majSeuilSocle` s'arrête sur `modes.busy`** : la veille du crop ne décide pas
  pendant le rechargement (276 – 403 ms), `avancerFondu` si.
- **La loi d'altitude change d'unité à la pose** (`altitudeCadrageM` en unités
  du bloc) : `uEstompage` saute dans l'image de `poserCrop`. Un correctif qui ne
  toucherait que la permission laisserait cette porte-là ouverte au-dessus de
  19 364 m ; un qui ne toucherait que la loi laisserait la permission.
- **La plaque provisoire (SOC)** suit la découpe 7/7, mais elle est pâle et
  vit 30 – 60 images ; la mer et le fond refusent 5 – 8,6 s (`refus: fond+mer`,
  reprise toutes les 30 images) — le banc de papier du test ② modélise ces deux
  latences, un banc sans elles ne peut rien voir.
- **`_zoomCropEcran` (CULL)** : `_zCropServi` tombe 13 → 12 **avant** la pose z11
  (+914 ms), sur l'ancienne emprise — ce n'est pas un recul (TUILE mesure la
  cible), mais un correctif qui déplacerait l'instant de la pose doit remesurer
  `zServiMin` (12 aujourd'hui).
- **Le raffinement par tuile (TUILE, D25)** : à la pose z11 l'intérieur est à
  z6 – z12 (parents), la couture de finesse dessine le carré de la découpe dans
  l'île (`02-pose-z11-provisoire.jpg`). Pas de palier atomique ; le parent couvre
  **dans l'emprise**.
- **`regenerateTerrain` (FLU) et l'image fantôme — `wt-fan` y travaille en ce
  moment** : la fenêtre `busy` de 276 – 403 ms entre l'annonce et la pose est
  la sienne ; si `wt-fan` déplace l'instant où `fenetreBornee.emprise` change,
  l'instant de `poserCrop` bouge avec (la veille lit `assietteCrop`). Ne pas
  fusionner à l'aveugle : rejouer `sonde-ca1.mjs` après.
- **`_suivreEmprise` (modes.js)** : la caméra est reposée dans le même tick que
  l'emprise ; la poussée de sortie (`_sortieCourse`) continue pendant `busy`.
  Passe 4 : la poussée a franchi 40 343 m pendant le WIDENING z11 et le crop est
  mort — la même rafale de 3 crans sort 1 fois sur 8.
- **Trois espaces de coordonnées** : `_crop.demi` en mercator normalisé, les
  parois en unités du globe (R = 100, RTC par `matrixWorld`), l'altitude de
  cadrage en unités du bloc ; la sonde projette tout dans l'espace du globe avec
  `camGlobe` (facteurs écrits en commentaire dans `sonde-ca1.mjs`).

## § COÛT — la référence pour le noteur (même geste, 3 chargements chacun)

⚠️ La sonde de pixels coûte 8 – 12 ms par image (un rendu + `readPixels`) : le
coût se lit sur les bancs **nus** (`--pixels 0`, `--screencast 0`), pas sur
`dezoom8`. « geste » = les 8 s qui suivent le premier cran.

| banc | `dt` p50 / p99 sur la passe | `dt` p50 / p99 pendant le geste | requêtes (geste + re-zoom) | pose z12 / z11 | mer posée | palier net | provisoires |
|---|---|---|---|---|---|---|---|
| `nu3` (CPU ×1) | 16,2 – 16,3 / 22 – 24 ms | **3,1 – 3,9 / 182 – 190 ms** | **310 – 313** | +702 – 750 / +1 030 – 1 170 | +3 990 – 4 704 | **+5 163 – 5 631** | 60 img 3/3 |
| `nu-x4` (CPU ×4) | 20,2 – 21,6 / 127 – 158 ms | **18 – 21 / 1 038 – 1 184 ms** | 290 – 304 | +2 223 – 2 775 / +3 496 – 3 930 | +12 091 – 13 247 | **+14 645 – 15 868** | **0** 3/3 (les hauteurs arrivent avant la pose) |
| `dezoom8` (pixels, ×1) | 11 – 18 / 26 – 48 ms | 8 – 21 / 104 – 305 ms | 285 – 326 | +643 – 811 / +979 – 1 243 | +5 021 – 8 586 | +6 045 – 8 981 | 30 – 60 img |

Seuils pour le noteur : `dtGesteP50` ≤ 4 ms (×1) et ≤ 21 ms (×4), `dtGesteP99`
≤ 190 ms (×1) et ≤ 1 184 ms (×4), requêtes ≤ 313 (×1), palier net ≤ 5 631 ms
(×1) et ≤ 15 868 ms (×4) — **pas de régression sur le pire des 3**. ⚠️ Le p99
du geste est le rechargement du bloc (une image de 180 ms à ×1, 1,1 s à ×4) :
c'est le terrain de `wt-fan`, pas un plafond à durcir ici.

**`z10x3` (rafales jusqu'à z10)** : le crop **meurt 3/3** pendant le WIDENING
(poussée au-delà de 40 343 m), renaît au re-zoom ; 76 – 96 images de planète
autour AVANT la mort (le même défaut, écourté par la sortie), requêtes 657 – 726
(la sortie recharge tout). **Aucun `busy` bloqué** — voir « cru puis réfuté » 5.

## ⛔ CE QUE J'AI CRU, PUIS RÉFUTÉ

1. **« Le dézoom cran par cran jusqu'à z10, comme le brief le dit. »** ⛔ Faux
   deux fois : un cran isolé ne franchit rien (0,017 de budget sur 0,693 — 40
   crans isolés = 1 niveau, mesuré 12 crans × 1,5 s : `demZoom` 13 inchangé,
   `d` 103 → 126) ; et z10 n'est atteint qu'en tuant le crop (poussée au-delà de
   40 343 m). Le geste de la vidéo est une rafale, et son palier est z11.
2. **« Le premier pixel hors crop vient de la caméra qui monte dans la bande
   d'estompage. »** ⛔ À moitié : il apparaît **dans l'image même de la pose
   z12, 7/7**, parce que l'altitude de cadrage change d'UNITÉ à la pose (12 568
   → 23 125 m). Sans le relevé image par image des deux grandeurs ensemble
   (`cropDemi` et `alt`), j'aurais attribué la Terre à la poussée seule.
3. **« La plaque grise partiellement posée de `r_014` est la plaque du repère
   d'avant (SOC ②). »** ⛔ Faux sur cet arbre : `paroisDemi = cropDemi` 7/7 dès
   l'image de la pose. Ce qu'on voit est la **provisoire**, pâle et sans mer,
   pendant 30 – 60 images. SOC a réglé le repère, pas l'apparence.
4. **« La mer du crop est là à la pose, c'est le globe qui la recouvre. »** ⛔
   Faux : `refus: fond+mer` pendant 5 021 – 8 586 ms à chaque palier, sur les
   7 passes. Le blanc dans la découpe de `01-pose-z12.jpg` est l'absence de mer.
5. **« `busy` peut rester bloqué après un WIDENING z10 »** (essai 2 : 80 s à
   `busy` sur z10, crop vivant à 44 km, pendant une mise au point). ⛔ **Non
   reproduit** : `z10x3` rejoue trois fois la rafale qui y mène, `busyBloque`
   0/3, le crop meurt 3/3 comme la porte le veut. Je le laisse écrit comme un
   « vu une fois » (la trace est `.banc/CA1/essai2.json`, image 9 066 ms), pas
   comme un défaut.
6. **« Un comptage de couleur sur les captures suffirait. »** ⛔ Le papier est
   beige comme les plaines de l'île ; seul le rendu du globe seul sur magenta
   sépare « dessiné » de « fond ». Témoin à 0 sur 8 chargements avant chaque
   geste, et `dedansPx` = `dessinPx` au repos (l'enveloppe projetée est juste).
7. **« ② est vert si le correcteur retire la permission. »** ⛔ Non — le mutant
   A le laisse rouge à 170 : la mer manque 5 reprises quoi qu'il arrive. C'est
   le test qui garde « l'emprise avant la mer », indépendamment du dehors.

## LES TRACES

- `.banc/CA1/dezoom8.json` (8 chargements, courbe complète par image),
  `dezoom8-bilan.md`, `dezoom8-cast/` (screencast passe 1, 50 i/s, index
  horodaté), `captures/` ; `essai1..3` (mises au point) ; `z10x3`, `nu3`,
  `nu-x4` (coût). `.banc` est ignoré par git : les JSON ne voyagent pas.
- Suivis : `scripts/sonde-ca1.mjs` (le banc), `scripts/bilan-ca1.mjs` (la
  synthèse + les captures), `scripts/lit-ca1.mjs` (une passe, image par image),
  `scripts/diag-ca1.mjs` (le diagnostic du cran), `test/crop-avant-tout.test.js`,
  `traces-CA1/` (6 captures + bilan).
- `npm test` (après les bancs, hors contention) : **5 118 tests · 5 115 réussis · 3 échecs — exactement ①②③ de `crop-avant-tout`**, rien d'autre ne rougit. `audit:tests` 286 = 286.
- Fins de ligne : CR = 0 sur `package.json`, le test et les quatre scripts
  (comptés en binaire).
