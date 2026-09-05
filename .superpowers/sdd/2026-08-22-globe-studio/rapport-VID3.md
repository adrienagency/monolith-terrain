# RAPPORT VID3 — LES DEUX VIDÉOS DU MATIN : les glitchs au zoom nommés, le décalage de la terre chiffré, et le reste attribué

**Arbre** `C:\Dev\wt-vid3` · branche `chasse-video3` · HEAD `4199e52` (Fusion VIE, la
base servie à Adrien) · serveur `127.0.0.1:10841`. Second arbre **détaché**
`C:\Dev\wt-vid3-avant` (jonctions `node_modules` + `public/data/*` posées à la main,
rien d'installé), servi sur `127.0.0.1:10842` et promené sur `6275e62`, `71fadd0`
(EAU), `cfa7bb6` (FLU), `f3b15fd` (BLA), `9dfdf84` (SOC), `b6181f3` (CAR),
`bf54801` (NUA) pour attribuer. `git diff -- src/` **vide (0 octet)** · `npm test`
**5 089 · 0** · `audit:tests` **281 listés = 281 sur disque, aucun écart**.

Banc : `scripts/banc-vid3.mjs` (Chrome sans tête d3d11, 1280 × 800 ; **sonde
`requestAnimationFrame` à chaque image** qui projette à l'écran des points
géographiques connus par la chaîne de l'application — emprise de la fenêtre
bornée → `terrain.mesh.matrixWorld` → caméra ; **screencast CDP en PNG, 50–54 i/s**,
toutes les images peintes), `scripts/analyse-vid3.mjs` (décodeur PNG, différences
image à image, boîte englobante, couleur moyenne, décalages), et
`scripts/ajuste-zoom-vid3.mjs` (ajuste une similitude *zoom × point fixe* entre deux
images consécutives d'une **vidéo d'Adrien** — c'est ce qui chiffre ce qu'il a vu, pas
ce que je rejoue). Runs dans `…\scratchpad\vid3\<run>\` (captures, `cast/`,
`journal.json`, `analyse.json`).

⛔ **Aucune correction.** Le chemin est fixé et dit à chaque ligne : vidéo 1 =
`modes.flyTo(−4.43, 121.77, 4)` puis `cranZoom(1)` toutes les 250 ms jusqu'au niveau
suivant (2 à 3 crans par niveau — un cran ne franchit pas toujours), z5 → z7 ; vidéo 2 =
`modes.flyTo(−21.25, 55.77, 12)`, trois `cranZoom(−1)` en 450 ms (WIDENING z11), ou
`flyTo(…, 11)` puis crans z12, z13. Sortie molette, jamais de lien profond.

---

## ⓪ LES DEUX RÉPONSES, EN TÊTE

**« Dans la vidéo aussi tu peux voir des glitchs au zoom. »** — Il y en a **trois**,
nommés au § ①. Le premier, **l'image fantôme**, est une **régression de la nuit :
la fusion FLU (`cfa7bb6`)** — et la même fusion fait apparaître les **trous de la mer**
(§ ③ : absents sur `6275e62` et sur EAU `71fadd0`, présents dès `cfa7bb6`). Il n'existe ni sur `6275e62` ni sur `71fadd0` (EAU) ; il
existe sur `cfa7bb6` et sur HEAD, à chaque cran qui franchit un niveau. Les deux
autres (le **cran sec** et la **bascule au nadir**) sont d'avant la nuit.

**« Au zoom, la terre se décale, comme visible dans la vidéo. »** — Chiffré au § ② :
dans **la vidéo**, à chaque REFINING le zoom ×2 a son point fixe à **16–18 px** du
centre de l'écran (≈ 4,5 km à z6, 2,5 km à z7) ; **au banc, caméra au nadir, le point
visé ne bouge pas d'un pixel** (0–4 px, HEAD comme `6275e62`, avec ou sans glissé
préalable) — **ce n'est pas un espace de coordonnées** : le même lat/lon se re-projette
exactement en (640, 400) après chaque cran sur les deux arbres. Ce qui se décale,
c'est **(a) l'image fantôme** (la terre entière ailleurs pendant une image, régression
FLU) et **(b) en vue oblique, le relief lui-même** : le pivot du zoom est **0,3 unité
sous le sol** (`Y_CIBLE = −0,3`, `loi-altitude.js:64`) et le relief est ré-échelonné
verticalement à chaque niveau — à la Réunion le point visé (flanc de la Fournaise)
part **438 px vers le haut** pendant les crans puis redescend **730 px** au
franchissement, sur les deux arbres. Détail, chiffres et attribution au § ②.

---

## ① LES GLITCHS AU ZOOM, NOMMÉS (60 i/s, vidéo 1 rejouée)

### G1 — L'IMAGE FANTÔME : une image d'une autre région à chaque niveau franchi ⚡ RÉGRESSION FLU

**Ce qu'on voit.** À chaque REFINING, **une image** (17–20 ms) montre **une autre
côte** — le nouveau bloc dessiné sous l'ancienne visée — puis l'image suivante montre
la bonne. Cast `head-sul2/cast/f00152 → f00153 → f00154.png` : Sulawesi, une baie
inconnue, Sulawesi ; **85 % des pixels changent deux fois de suite** (`analyse.json`
: `#153 part 0,85`, `#154 part 0,84`) et la couleur moyenne fait un aller-retour
(163/188/174 → 182/184/159 → 164/187/173). Idem `#572/#573` (z6) et `#995/#996`
(z7) ; avec glissé préalable (`head-pan`) `#156, #565, #985`.

**La sonde, image par image (`head-sul2`, cran z4 → z5, `journal.json` images 784–787) :**

| image | t | busy | emprise | caméra Y | cible | où se projette le point visé |
|---|---|---|---|---|---|---|
| 784 | 0 ms | oui | ancienne | 3,826 | ancienne (−1,64, −5,65) | (640, 342) ✓ |
| **785** | **+111 ms** | **oui** | **NOUVELLE** | **7,664** | **ANCIENNE** | **(1839, 754) — hors écran** |
| 786 | +134 ms | non | nouvelle | 7,664 | nouvelle (6,05, −1,98) | (640, 369) ✓ |

L'image 785 est le fantôme : **la caméra a déjà été convertie** (×2,0 en Y — l'altitude
de fond conservée sur une emprise divisée par deux, c'est `_suivreEmprise`, appelé PAR
IMAGE `modes.js:2012`) **mais la cible est encore l'ancienne** : la nouvelle nappe se
lit donc à l'ancienne position locale, c'est-à-dire ailleurs sur Terre. Même chose
Réunion (`head-reuobl`, image à +735 ms : caméra Y 13,37, cible ancienne, point visé
en y = −69).

**Bissection (même chemin, même banc) :**

| commit | fusion | image fantôme |
|---|---|---|
| `6275e62` | RAMP (avant les neuf) | **aucune** (`avant-sul2` : un seul écart > 60 % par cran) |
| `71fadd0` | EAU | **aucune** (`eau-sul`) |
| `cfa7bb6` | **FLU** | **oui** (`flu-sul` : `#148/#150`, `#536/#537`, `#966/#967`) |
| `4199e52` | HEAD | **oui** (3 runs, 9 crans, 9 fantômes) |

**Cause établie au code.** FLU a coupé `regenerateTerrain` en deux tâches
(`main.js`, poste ④) : `terrain.rebuild` + `plinth.rebuild` + `refreshMatTiling`, puis
**`await new Promise((r) => setTimeout(r, 0))`**, puis eau, calques, étiquettes. Le
commentaire l'annonce : *« Une image entre les deux, pendant laquelle l'eau et les
calques sont ceux d'avant »*. Mais pendant cette image l'emprise est DÉJÀ la nouvelle et
`_rescale` (`modes.js:1508`) n'a pas encore repris la main pour poser
`controls.target` : le suiveur par image convertit la caméra seul. Ce n'est pas l'eau
d'avant qu'on voit, c'est **la terre d'ailleurs**. Le `busy` est passé de 161–186 ms
(avant) à 15–18 ms (HEAD, z6–z7) — la descente est plus vive, et c'est là que le
fantôme est le plus net.

**Et la vidéo d'Adrien le montre tenu.** Sur sa machine, le chargement dure des
secondes : la pose fantôme (caméra convertie, cible ancienne) reste à l'écran **tant
que dure le chargement**. Vidéo 2, `q_032`–`q_033` (1 s) : la caméra est loin, la
nappe plate et le socle rouge immense, puis `q_034` revient — c'est la pose 785 tenue
deux images. Vidéo 1, `p_023` (« REFINING Z7 ») : l'ancien bloc sous une caméra déjà
convertie, juste avant le gel.

**Gravité : haute** — un flash d'une autre région à chaque cran, et sur une machine
lente, une fausse vue qui dure.

### G2 — LE CRAN SEC : ×1,41 en une image, sans aucun fondu (d'avant la nuit)

**Ce qu'on voit.** Le premier cran d'un niveau **saute** : `head-sul2/cast/f00555 →
f00556` (72 % des pixels, l'échelle change d'un coup, la caméra fixe en XZ), idem
`#979` (z7), `avant-sul2 #526/#934`, `eau-sul #535/#936`. **Sonde `head-pan` images
1502 → 1503 : `dist` 7,951 → 6,000 en UNE image** (`_zoomVel` = 0 avant comme après,
`fov` 33 inchangé, `camera.zoom` 1) : `cranZoom` (`modes.js:709-722`) écrit
`camera.position` directement — `voulue = dist × f`, clampée à `minDistance = 6`, puis
`c.update()`. Aucune interpolation : un cran de molette = un saut de ×1,41 (×1,33 ici,
clampé). Le cran suivant, lui, ne bouge plus rien (déjà à 6) et ne fait qu'alimenter le
compteur, jusqu'au franchissement.

**Attribué à : personne.** Ce n'est pas une régression (`6275e62` pareil). ⚠️ Adrien
(2026-08-20) : *« on garde bien un zoom continu, exactement comme Google Earth ou
Google Maps »* — ces deux-là **animent** le cran. À trancher par lui : est-ce le zoom
continu voulu ? **Gravité : moyenne** — c'est le « à-coup » qu'on sent sous la molette.

### G3 — LA BASCULE AU NADIR après le premier cran (d'avant la nuit, dépend du chemin)

Arrivée par `flyTo` : pose oblique à 43° (`_arrivalPose`). Au premier cran, le
niveau franchi, la caméra **pivote seule de 43° au nadir en ~1 s** (`_fonduPose`,
`_armerRetourNadir`, `modes.js:1392`) : cast `#161 → #202` (40 images à 20–35 % de
pixels changés). Le point visé, dessiné 58 px au-dessus du centre à z4 (le sol est
0,34 unité au-dessus de la cible enterrée), **défile de 58 px (≈ 22 km à z5)** jusqu'au
centre. Sur les deux arbres (57,8 px, à l'identique). Dans la vidéo d'Adrien la vue
est déjà au nadir à z4 (il arrive par la molette) : il ne l'a pas vue. **Attribué à :
personne** — à vérifier comme choix (D19 ?), pas comme défaut. **Gravité : basse.**

### Ce que les vidéos montrent d'autre pendant un cran (attribué)

- **Toponymes et cartouche disparaissent au cran** : `p_016 → p_017` (KARTA/SURABAYA
  s'effacent, REFINING Z5), reviennent `p_019` ; `p_022 → p_023` (KENDARI/MAKASSAR
  s'effacent). Le cartouche : **wt-car** (CAR fusionné — *« ne claque plus à chaque
  cran »* ; à revérifier par lui sur cette vidéo). Les toponymes : **personne**.
- **L'étiquette REFINING vit 3,6 s après un chargement de 15–300 ms** (`p_023`–`p_030`,
  `MSG_MS`) : **wt-flu**, connu (VID2 ligne « flu »).
- **Orbite → surface** `p_008 → p_009` : *« FX ONLINE — SURFACE MODE ENGAGED »*, les
  **nuages disparaissent d'un coup**, la mer bascule de couleur, et l'ajustement dit
  **zoom ×1,6 avec un point fixe à 26 px du centre** (corrélation 0,91). Non rejoué à
  60 i/s (mon cast démarre après l'arrivée) ; nuages : **wt-nua**, couleur : **wt-eau**.

---

## ② LE DÉCALAGE DE LA TERRE AU ZOOM — CHIFFRÉ

### Dans la vidéo d'Adrien (ajustement de similitude entre deux images consécutives, 2 i/s)

| images | ce qui se passe | zoom | point fixe (px, écran 1280 × 626, centre (640, 333)) | écart au centre | un point du terrain au centre se retrouve à |
|---|---|---|---|---|---|
| `p_008 → p_009` | orbite → surface | ×1,60 | (660, 316) | **26 px** | 16 px |
| `p_016 → p_017` | REFINING Z5 après un glissé | ×1,095 | (680, 316) | 43 px | 4 px |
| `p_019 → p_020` | REFINING Z6 | **×2,00** | (656, 320) | **16 px** (≈ 4,5 km à 280 m/px) | 16 px |
| `p_022 → p_023` | REFINING Z7 | **×2,00** | (652, 320) | **18 px** (≈ 2,5 km à 139 m/px) | 18 px |
| `p_009 → p_010`, `p_017 → p_018`, `p_018 → p_019`, `p_020 → p_022` | rien | ×1,00 | — | 0 | 0 (corrélation 0,994–1,000 : l'outil ne voit rien quand il n'y a rien) |
| `q_026 → q_027` | REFINING vers la mer (vidéo 2) | ×2,3 | (1072, 960) | 761 px | **990 px** — l'île passe du haut de l'écran au coin du socle ; ce n'est plus une similitude, la caméra a aussi basculé (pose fantôme G1 tenue) |

Le biais des deux REFINING est le même (+14, −13 px) : **un point fixe un peu à droite
et au-dessus du centre**, c'est-à-dire que le zoom pivote autour d'un point qui n'est
pas le sol sous le curseur — cohérent avec le pivot enterré (`Y_CIBLE`) sous une caméra
légèrement inclinée.

### Au banc, caméra au nadir (Sulawesi, 1280 × 800, centre (640, 400))

| run | cran | point visé (lat/lon sous la cible AU MOMENT du cran) avant → au repos | Δ | zoom mesuré entre les deux captures au repos | point fixe ajusté |
|---|---|---|---|---|---|
| `head-sul2` (HEAD) | z4 → z5 | (640, 342) → (640, 400) | **57,8 px ≈ 21,8 km** (= G3, la bascule au nadir) | ×2,39 | — |
| | z5 → z6 | (640, 400) → (640, 400) | **0 px** | ×1,34 | (640, 400) : **0 px** |
| | z6 → z7 | (640, 400) → (640, 400) | **0 px** | ×2,03 | (640, 396) : 4 px |
| `head-pan` (HEAD, glissé de 150 px avant) | z5 → z6, z6 → z7 | (640, 400) → (640, 400) | **0 px** | ×1,35 · ×2,02 | (636, 400) : 4 px |
| `avant-sul2` (`6275e62`) | z4 → z5 · z5 → z6 · z6 → z7 | 57,8 · 0 · 0 px | identique à HEAD au dixième | ×2,39 · ×1,34 · ×2,03 | 0 · 0 · 4 px |

Kendari, Makassar, Palu se déplacent de 94 à 1 624 px par cran — c'est le zoom
lui-même (rapport des m/px 1,50 · 1,34 · 2,02, selon le nombre de crans consommés),
pas un décalage : ramenés au point fixe, ils tombent où le zoom les met.

➡️ **Au nadir, sur les deux arbres, la terre ne se décale pas.** Le décalage de 16–18 px
de la vidéo n'est pas reproduit au nadir ; il l'est en oblique :

### Au banc, caméra oblique (Réunion, `flyTo(−21.25, 55.77, 11)`, pose à 43°, deux crans)

| run | point visé (flanc de la Fournaise) avant le cran | pendant les crans (min) | au repos après le niveau | hauteur DESSINÉE du même point (`terrain.sample`, unités de bloc → m dessinés / m sans exagération ×2) |
|---|---|---|---|---|
| `head-reuobl` z11 → z12 | (640, **93**) | (640, **−345**) | (640, **386**) | 2,76 u = 2 700 m / 1 350 m → **0,81 u = 396 m / 198 m** |
| `head-reuobl` z12 → z13 | (640, 386) | (640, −636) | (640, 363) | 0,81 u → **2,24 u = 546 m / 273 m** |
| `avant-reuobl` z11 → z12 | (640, 116) | (640, −348) | (640, 306) | 2,77 u → 0,81 u |
| `avant-reuobl` z12 → z13 | (640, 306) | (640, 162) | (640, 162) | 0,81 u → 2,24 u |

Sonde directe (`sonde-hauteur.mjs`, HEAD, même chemin) — **le sommet de la Fournaise
(2 632 m réels) est dessiné** : z11 **3 303 m**, z12 **2 144 m**, z13 **2 039 m**, z14
**1 010 m** (sans exagération ; `exag` = 2 partout, `echelleVerticaleBloc` bien ×2 par
niveau). Saint-Joseph (côte) : 775 / −249 / 586 / 1 039 m.

⚠️ **Deux lectures possibles, je ne tranche pas :** soit `terrain.sample(x, z)` ne lit
pas le même repère que ce qui est dessiné sous la fenêtre bornée (les trois espaces de
coordonnées du fichier de pièges — j'ai écrit le facteur à chaque conversion, mais
`sample` est une boîte noire pour moi), soit **le relief change réellement d'échelle
verticale à chaque niveau** (plancher d'amplitude `rampe-crop.js:94`, rampe par niveau).
Ce qui est sûr et VISUEL : en oblique, **le point visé sort par le haut de l'écran
pendant les crans (438 px) et revient sous le centre au franchissement (730 px)**,
sur les deux arbres — le pivot du zoom est 0,3 unité sous le socle (`Y_CIBLE`), le
relief au-dessus (2,76 u ici), et un zoom autour d'un point enterré pousse le sol vers
le haut. À HEAD, la caméra ressort plus haut qu'avant (`dist` 13,76 contre 11,59 au
repos z12 ; 13,46 contre 11,59 à z13) : la re-pose de SOC/FLU ne rend pas la même
altitude que `6275e62`, sans que je puisse dire laquelle est la bonne.

### Réponse à la question du brief

- **Le pivot (D19) ?** Oui, pour la part oblique : le zoom va bien vers le point au
  centre, mais ce point est **sous le sol** ; la terre au-dessus se décale d'autant que
  la vue est inclinée et le relief haut. Au nadir, rien.
- **La re-pose du crop (SOC, trois poses en 1,1 s) ?** Oui, pour la part « saut » : la
  deuxième pose est le fantôme G1 — et c'est FLU, pas SOC, qui la laisse à l'écran une
  image.
- **Un espace de coordonnées ?** **Non**, réfuté : le même lat/lon se re-projette en
  (640, 400) à ±0 px après chaque cran, sur les deux arbres, avec et sans glissé.
- **Régression de la nuit ?** **G1 oui (FLU)** ; le décalage au nadir : **non** (0 px des
  deux côtés) ; l'oblique : **non** (présent sur `6275e62`, amplitude différente).

---

## ③ LES TROUS DE LA MER (vidéo 2) — bissection, et la note d'Adrien

Même chemin sur chaque commit (`reunion-wide` : `flyTo(…, 12)`, trois crans arrière
en 450 ms → WIDENING z11, capture au repos + 5 s) :

| commit | fusion | la mer à z11 après WIDENING (`<run>/01d-widening-repos.png`) |
|---|---|---|
| `6275e62` | RAMP | **nappe uniforme**, texturée, aucune tache, aucun rouge (`avant-reu`) |
| `71fadd0` | EAU | **nappe uniforme, aucune tache, aucun rouge** (`eau-wide`) — la nouvelle eau n'y est pour rien |
| `cfa7bb6` | FLU | **taches pâles polygonales** (à droite, 1130–1280 × 300–560 ; 1150 × 700–800) + **deux petites dalles rouges** (1050, 540) et (1110, 675) |
| `f3b15fd` | BLA | taches pâles + petites dalles rouges |
| `9dfdf84` | SOC | taches pâles, pas de rouge visible |
| `b6181f3` | CAR | taches pâles + un point rouge |
| `bf54801` | NUA | taches pâles + un point rouge |
| `4199e52` | HEAD (`head-wide`) | taches pâles + **deux rectangles rouges nets** (1000–1180 × 410–490 et 1065–1110 × 740–770), encore là 9 s après ; **et le bord du crop est visible** (la nappe s'arrête, le dehors beige, la rose des vents) — c'est VIE (*« le dehors ne se redessine que sur intention de sortie »*). Un second run HEAD (`head-reu/01d`) : taches pâles + une petite dalle rouge — **la taille des rouges varie d'un run à l'autre** (course de tuiles). |

Au nadir (`head-reu/01e-nadir.png`) : **une bande rouge verticale** de 20 px sur 640 px
dans la mer (x ≈ 1000) et des losanges pâles ; `6275e62` au même endroit : rien.

**Attribué à : wt-tro** (trous) et **wt-bis** (biseaux — les bandes pâles rectilignes de
`q_015`–`q_026`, qui dessinent le rectangle de l'ancien crop et suivent le terrain, sont
les biseaux/arêtes du socle vus à travers la nappe). **La note d'Adrien du matin**
(`note-adrien-trous-mer.md`, citation) dit la cause : *« c'est simplement le quadtree
qui met le sol à zéro, créant une espèce d'arche »* — les dalles rouges sont des
**dalles de fond à 0 m** qui affleurent. Ma bissection ajoute un fait : **ces dalles à
0 m ne se voyaient ni sur `6275e62` ni sur `71fadd0` (EAU), et se voient dès
`cfa7bb6`** : **c'est la fusion FLU** — la descente coupée en tâches courtes et le
raffinement espacé (`RAFFINEMENT_SOCLE_MS`, poste ④) laissent une dalle sans
bathymétrie (sol à 0 m) s'afficher avant que sa voisine, ou son ancêtre z7, ne soit
posée. Les correcteurs doivent viser **le sol à 0 m**
(la note), pas la nappe.

---

## ④ LE CATALOGUE

| # | ce qu'on voit (image) | reproduction | fusion coupable | attribué à | gravité |
|---|---|---|---|---|---|
| **G1** | **image fantôme** — une autre région pendant une image à chaque niveau (`p_023`, `q_032`–`q_033` tenues) | `banc-vid3.mjs 10841 <dir> sulawesi` → `cast/f00153`, `f00572`, `f00995` ; sonde image 785 | **FLU `cfa7bb6`** (`await setTimeout 0` dans `regenerateTerrain`) | **PERSONNE** | **haute** |
| **G2** | **cran sec** ×1,41 (×1,33 clampé) en une image, sans fondu | `cast/f00555 → f00556` ; sonde `dist` 7,95 → 6,00 en une image | d'avant (`6275e62` pareil) | **PERSONNE** — à trancher par Adrien | moyenne |
| **G3** | bascule 43° → nadir en 1 s après le premier cran, la terre défile 58 px / 22 km | `head-sul2` cran z4 → z5, `cast/#161–#202` | d'avant | **PERSONNE** (choix ?) | basse |
| **D1** | **décalage au zoom, vidéo** : point fixe à 16–18 px du centre (4,5 km z6, 2,5 km z7) | `ajuste-zoom-vid3.mjs p_019 p_020` ; au nadir au banc **0 px** | — (non reproduit au nadir) | pivot sous le sol (`Y_CIBLE`) + inclinaison : **PERSONNE** | moyenne |
| **D2** | **décalage en oblique** : le relief sort par le haut (438 px) puis revient (730 px) ; le même sommet dessiné 3 303 / 2 144 / 2 039 / 1 010 m à z11–z14 | `banc-vid3.mjs 10841 <dir> reunion-oblique` ; `sonde-hauteur.mjs` | d'avant (`6275e62` : 464 / 144 px) ; HEAD ressort plus haut (13,76 contre 11,59) | **PERSONNE** (pivot D19 + échelle verticale par niveau, ou `sample` — à trancher) | moyenne-haute en vue inclinée |
| **T1** | dalles **rouges** dans la mer (`q_027`–`q_041`), bande rouge au nadir | `reunion-wide` HEAD : `01d-widening-repos.png` ; `head-reu/01e-nadir.png` | **FLU `cfa7bb6`** (absentes sur EAU `71fadd0`), plus grandes à HEAD (VIE ?) | **wt-tro** — cause : sol à 0 m (note d'Adrien) | haute |
| **T2** | **taches pâles** polygonales dans la mer (`q_025` « bandes pâles »), losanges au nadir | idem, dès `cfa7bb6` | **FLU `cfa7bb6`** | **wt-tro / wt-bis** | haute |
| **B1** | **bandes pâles rectilignes** qui dessinent le rectangle de l'ancien crop (`q_015`–`q_026`) et suivent le terrain | non rejoué (mon glissé est une rotation, voir § ⑤) | — | **wt-bis** (biseaux/arêtes vus à travers la nappe) | haute |
| **B2** | **nappe en marches** au bord du socle (`q_030`–`q_033`), plaque grise au-dessus de la nappe (`q_038`–`q_041`) | non rejoué | — | **wt-bis / wt-soc** | moyenne |
| **F1** | **gel à z7** (`p_024`–`p_040`, 8 s, seul le curseur bouge ; l'étiquette s'éteint `p_031` alors que rien ne vit) | **NON REPRODUIT** : 4 runs atteignent z7, 50–54 i/s, sonde vivante (2 148 images) | — | **wt-gel** | haute |
| **S1** | **WIDENING** : la nappe ne couvre que la moitié basse (`q_009`), plaque sombre de l'ancien crop (`q_006`), paroi pâle à gauche (`q_007`) | `head-reu/01c-widening-encours.png` (label + dalle rouge) | — | **wt-soc** (SOC fusionné, à revérifier) | moyenne |
| **C1** | toponymes effacés à chaque cran (`p_016 → p_017`, `p_022 → p_023`) ; cartouche idem | vidéo | — | cartouche **wt-car** ; toponymes **PERSONNE** | basse-moyenne |
| **N1** | orbite → surface (`p_008 → p_009`) : nuages coupés net, mer qui change de couleur, ×1,6 avec point fixe à 26 px | vidéo (non rejoué à 60 i/s) | — | **wt-nua / wt-eau** | moyenne |
| **E1** | mer à 60 i/s : **tout l'écran change à chaque image** (`head-reuobl` : 979 événements en 19 s — le témoin bouge seul, piège n° 4) | tout run Réunion | EAU | **wt-eau** — c'est la houle ; à vérifier que ce n'est pas un scintillement | basse |
| **R1** | `REFINING` vit 3,6 s pour 15–300 ms de travail | sonde `busy` | — | **wt-flu** (connu) | basse |
| **K1** | console : 2 avertissements HLSL `f_surfaceFx_int`, 1 ressource 404, **58–62 requêtes en échec** (`ERR_ABORTED` mapterhorn) par run, 0 pageerror | `journal.json` | — | **PERSONNE** (connu VID2 N7) | basse |

---

## ⑤ VU UNE FOIS / NON REPRODUIT / CE QUE J'AI CRU PUIS RÉFUTÉ

- ⛔ **« La terre se décale = un espace de coordonnées »** — réfuté : la projection
  par la chaîne de l'application rend (640, 400) à ±0 px pour le point visé après
  chaque cran, HEAD et `6275e62`, avec et sans glissé.
- ⛔ **« Le point visé est dessiné à 58 px du centre à z4 : un bogue »** — non :
  `Y_CIBLE = −0,3`, le sol est à +0,04, la caméra à 43° et à 6 unités : 0,34 u × 160 px/u
  × cos 43° ≈ 58 px. Géométrie, pas défaut. Mais c'est ce même enterrement du pivot qui
  fait D1/D2.
- ⛔ **« Le fantôme est SOC (trois poses en 1,1 s) »** — non : SOC est postérieur à FLU et
  `71fadd0` (EAU, sans FLU) n'a pas de fantôme ; c'est le `setTimeout(0)` de FLU qui
  offre une image à la deuxième pose.
- **Mon « glissé » Réunion (`reunion`, prélude) est une ROTATION** : le bouton gauche
  orbite (`boutonsSouris`, `main.js:3196`), la caméra est descendue à 369 m et a vu la
  mer de profil (`head-reu/01f`). Les runs `reunion` sont donc bons pour WIDENING et
  nadir, **pas** pour « la mer au centre » — B1/B2 ne sont pas rejoués. Le glissé
  d'Adrien (`q_016`–`q_026`) est un vrai panoramique : à rejouer avec le bon bouton.
- **`q_004`** (image double, fantomatique, tout l'écran) : vu une fois, entre deux
  captures à 2 i/s ; ni rejoué ni expliqué (fondu de pose ? encodage ?).
- **Le gel z7** : non reproduit en quatre runs.
- **`terrain.sample`** : lu comme une boîte noire ; les mètres dessinés du § ② sont à
  confirmer par un correcteur qui connaît la fenêtre bornée.

---

## ⑥ LA RECETTE

```
npx vite --host 127.0.0.1 --port 10841                       # ⛔ pas de npm install
node scripts/banc-vid3.mjs 10841 <dir> sulawesi [pan]        # vidéo 1 : G1, G2, G3, D1
node scripts/banc-vid3.mjs 10841 <dir> reunion-oblique       # D2
node scripts/banc-vid3.mjs 10841 <dir> reunion-wide          # T1, T2 (01d-widening-repos.png)
node scripts/analyse-vid3.mjs <dir>                          # événements, décalages, rouges
node scripts/ajuste-zoom-vid3.mjs A.png B.png 640 333        # zoom × point fixe entre deux images
→ G1 : deux écarts > 60 % d'affilée dans analyse.json (diffs), et dans journal.json une
  image busy=true, fenB nouvelle, camY doublé, cible ancienne, point visé hors écran.
→ Bissection : second arbre détaché (git worktree add --detach … <commit>, jonctions
  node_modules et public/data/* recopiées à la main), servi sur 10842.
```

Le second arbre `C:\Dev\wt-vid3-avant` est laissé en place (détaché sur `71fadd0` en
fin de session) ; ses serveurs Vite sont les miens et sont arrêtés.
