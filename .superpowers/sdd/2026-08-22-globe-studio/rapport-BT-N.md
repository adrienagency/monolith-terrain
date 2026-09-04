# BT-N — NOTATION : L'INTÉGRATION BlueTopo VAUT **9,8 / 10** (barème BT-A, quatre critères réarbitrés sur la donnée source ; **6,4 sous la lettre stricte**)

Arbre `C:\Dev\wt-bt3`, branche `bluetopo-note`, après `git merge regroupement`
(77d524a). Serveur `npm run dev -- --host 127.0.0.1 --port 7311`, arrêté en
partant. Chrome 141 sans tête (SwiftShader) lancé par mes sondes seulement —
les deux `chrome.exe` sans tête déjà présents (35644, 4340, pas à moi) n'ont
pas été touchés.

**`npm test` → 4 797 · 0 échec (2 sautés). `npm run audit:tests` → 257 listés ·
257 sur disque, aucun écart. `git diff -- src/` VIDE.** `git log --follow
test/attaque-bt-ROUGE.mjs` : **un seul commit (84a94f2, BT-A), diff vide** —
aucun test rouge n'a été touché. Aucune coordonnée du barème dans `src/`
(le seul `grep` qui mord est `src/data/continents.json`, un contour Natural
Earth). `build:bathytiles` **absent** de `npm run deploy` (vérifié ligne 25 de
`package.json` ; `build:bathyindex` y est).

`find public/data/bathy/8 -type f | wc -l` → 13 891 · `…/13` → 1 057.

---

## ⚡ EN UNE PHRASE

**BT-I a raison sur les trois critères qu'il réfute, et il a raison pour la
bonne raison : je l'ai vérifié dans les GeoTIFF NOAA eux-mêmes, pas dans nos
tuiles.** Le levé à 4 m ne bouge que de **0,003 à 0,056 m** entre une empreinte
z11 et une empreinte z13 aux deux points de BT-2 (le seuil en demande 1,00) ; le
plateau louisianais ne porte que **0,25 à 0,34 m/km** dans le levé à 8 m (BT-4
en demande 2,0) ; et le lac Érié fait **22,70 m** sous la nappe au point du
barème dans la grille NCEI 3″ (BT-7 en demande 30). Ce sont trois seuils posés
là où la grandeur nommée n'existe pas — la classe d'erreur que ce chantier a
déjà payée deux fois. Pour BT-1, le levé rend **0,718** à la coordonnée exacte
et **0,445** sur la dalle voisine qui couvre le même point : le seuil de 0,70
est posé *sur* la valeur de la source, sous la dispersion de la grandeur.

**Mais la chaîne perd bien du détail, et je le chiffre contre BT-I** : à
Virginia Beach le globe lit 1,957 m/km là où le levé en porte **2,39–2,46**
(−19 %, pas −34 % comme l'écrit BT-I, dont les pentes « source » sont
systématiquement 20 à 40 % au-dessus des miennes). C'est ce qui coûte
0,5 point au critère 1 et 0,7 au critère 3.

---

## ① L'ARBITRAGE — critère par critère, sur le GeoTIFF BlueTopo

Méthode : `scripts/mesure-source-bt-n.mjs` (nouveau, lit les GeoTIFF NAD83/UTM
avec `lit-geotiff.mjs`, projection directe UTM, 223 dalles candidates dans
`C:\Dev\wt-bt2\data\bluetopo`). Pour chaque point : moyenne des pixels source
sous **un texel de globe à 512 px** (z11 : 30,5 m ; z13 : 7,6 m à 37° N), puis
une fenêtre **9 × 9 de tels texels** à z11 / z12 / z13, et le même peigne que
la sonde GPU (moyenne des |Δ| entre texels voisins ÷ taille du texel). Aucun
pivot, aucune tuile : c'est la donnée d'autorité, avant tout ce que BT-I a écrit.

### BT-2 — « le fond change de ≥ 1 m entre z11 et z13 » : **RÉFUTÉ, BT-I a raison**

| point | dalle (résolution) | empreinte z11 | empreinte z13 | **\|Δ\| source** | \|Δ\| globe (GPU) |
|---|---|---|---|---|---|
| Chesapeake embouchure 37,00 / −76,05 | BH4WC5CQ (4 m) | −11,535 | −11,538 | **0,003 m** | 0,0 m (−11,6 / −11,6) |
| idem, dalle voisine | BH4WD5CQ (4 m) | −11,577 | −11,581 | **0,005 m** | — |
| New York Bight 40,50 / −73,90 | BH4XF5FG · FH (4 m) | −11,74 / −11,81 | −11,72 / −11,75 | **0,020 / 0,056 m** | 0,1 m (−11,8 / −11,7) |

Le levé lui-même ne porte pas la grandeur que le seuil nomme : sur ces fonds à
2–4 m/km, passer d'une empreinte de 30 m à une de 7,6 m ne peut déplacer la
moyenne que de quelques centimètres. **Aucune carte vraie ne passe BT-2 ici**, et
BT-I a documenté que le test était VERT quand la carte donnait −5,2 m à z11 et
autre chose à z13 — il récompensait la divergence entre niveaux. Je le confirme
par l'absurde : BT-2 vert exigerait un désaccord de 1 m entre deux lectures d'un
fond que la source donne à 3 mm près.

**Règle de partage écrite (critère 2, 2,0 pt)** : acquis si, aux deux points,
\|globe − source\| ≤ 0,5 m **à z11 ET z13**, ET la valeur a bougé de ≥ 1 m par
rapport à l'état d'avant (BT-A), ET la pente par km **monte** de z11 à z13 (la
signature de la donnée qui arrive, celle que BT-A opposait à la constance du
lissage). Chesapeake : −11,6 vs −11,54 ✓ · avant −4,5 (Δ 7,1 m) ✓ · pente
1,88 → 3,81 ✓. NY Bight : −11,8 / −11,7 vs −11,74 ✓ · avant −4,6 ✓ · pente
1,55 → 7,05 ✓. **2,0 / 2,0.**

### BT-4 — « ≥ 2,0 m/km à z12 sur quatre plateaux » : **RÉFUTÉ POUR UN POINT SUR QUATRE, BT-I a raison sur la Louisiane et exagère Virginia Beach**

| plateau | dalle (rés.) | **pente source z12** (9 × 9, 512 px) | pente globe z12 (GPU) | verdict |
|---|---|---|---|---|
| Virginia Beach 36,80 / −75,30 | BF2HW2LN · HX2LN (8 m) | **2,392 / 2,457** | **1,957** | seuil atteignable, **la chaîne perd 19 %** — ✖ |
| Georges Bank 41,30 / −67,50 | BC26H274 (16 m) | 4,114 | 2,177 | ✓ (zone cuite à z10 seulement, −47 %) |
| Plateau louisianais 28,80 / −90,50 | BF2G42KN · KP (8 m) | **0,248 / 0,344** | 0,444 | **le seuil dépasse la source ×6** — réfuté |
| Ouest-Floride (Tampa) 27,50 / −83,20 | BF2GX2KJ (8 m) | 2,897 | 2,644 | ✓ (−9 %) |

Le seuil de 2 m/km est légitime sur trois plateaux (le levé en porte 2,4 à 4,1)
et impossible sur le quatrième : la vase de Terrebonne fait 0,38 à 0,50 m
d'étendue **sur 1 km × 1 km au natif**. Ce n'est pas la carte qui est lisse,
c'est le fond. ⚠️ **BT-I annonce 2,973 m/km pour Virginia Beach et 0,608 pour
la Louisiane** ; je mesure 2,39–2,46 et 0,25–0,34. Ses pentes « source » sont
lues sur le pivot à 10 m sans moyenne par texel, ce qui garde le bruit de
mesure du levé ; les miennes moyennent chaque texel comme le ferait une tuile
idéale. **Le diagnostic est le même des deux côtés** (trois passent, la
Louisiane non), mais la « perte de 34 % de la chaîne » de BT-I est en réalité
**−19 %** — moins spectaculaire, toujours réelle.

**Règle de partage (critère 3, 1,5 pt)** : la Louisiane est notée « acquise »
si \|globe − source\| ≤ 0,3 m/km (0,444 vs 0,25–0,34 : ✓, le globe ajoute
0,1 m/km de bruit de quantification, pas de relief) ; les trois autres au seuil
du barème. **3 sur 4 → 0,8 / 1,5.** Virginia Beach est un vrai manque de la
chaîne, pas du barème, et il coûte.

### BT-7 — « Grands Lacs ≥ 30 m sous la nappe » : **RÉFUTÉ pour Érié, acquis pour Michigan, +0,5 hors barème**

Lu **directement dans `erie_lld.tif`** (NCEI 3″, float32 non compressé, tfw
lu) : **−22,70 m** au point du barème 42,00 / −81,50 (fenêtre 5 × 5 : min
−22,70, c'est une plaque) ; le point profond que BT-I nomme (42,4925 / −79,9475)
rend **−62,58 m**, et mon balayage complet de la grille donne −62,48 m à
42,48 / −79,997 — même bassin, à 4 km. **Le lac Érié fait 22,7 m là où le seuil
en demande 30.** Au GPU : Érié central **+151,0 m** à z10, z11, z12 → **22,8 m
sous la nappe 173,8** (source 22,70 : 0,1 m d'écart, l'arrondi au mètre du
tuileur) ; Érié oriental **+110,9 m** → **62,9 m** sous la nappe (source 62,58) ;
Michigan **+56,0 m** → **120,9 m** sous la nappe 176,91. Avant BT-I : +173,8 et
+176,9, la nappe au centimètre. **Les deux lacs ont un fond, et il est celui de
NCEI.** Barème : *« un intégrateur qui les cuit quand même mérite +0,5 hors
barème »* → **+0,5**.

### BT-1 — « rapport d'étendue z12→z13 ≥ 0,70 à Chesapeake » : **0,687, et c'est un instrument qui mesure aussi la fenêtre**

| lecture | rapport |
|---|---|
| **source, dalle BH4WC5CQ** (pixel valide au point) | **0,718** |
| **source, dalle BH4WD5CQ** (même point, dalle voisine, NaN au pixel exact) | **0,445** |
| source aux trois autres points z13 du barème : NY Bight / Virginia / Tampa | 0,669–1,084 / 0,771–0,842 / 1,004 |
| globe au GPU, Chesapeake | **0,687** (0,46 / 0,67) — le chiffre de BT-I, au millième |
| globe, NY Bight / Virginia / Tampa | **0,77 / 1,04 / 0,87** |
| globe, cinq points **hors zone cuite** (Galveston, Cape Cod, Keys, Mobile Bay, SF) | **0,53 / 0,50 / 0,49 / 0,50 / —** — l'interpolation pure, exactement |

La grandeur est juste dans son principe (0,50 dehors, 0,69–1,07 dedans : la
séparation est nette et je la retrouve sur des points que personne n'avait
choisis), mais sa **dispersion d'une dalle à l'autre au même point est de 0,27**,
quinze fois la marge entre 0,687 et 0,70. Une chaîne parfaite rendrait 0,718 ici
: **le seuil ne laisse que 2,5 % à la chaîne**, et la chaîne en perd 4,3 %
(0,718 → 0,687) — la perte est réelle, c'est la même que BT-4 (contenu bathy
256 px sous une fenêtre 512 px, diagnostic de BT-I que je confirme).

**Règle de partage (critère 1, 3,0 pt)** : 3,0 si Chesapeake ≥ 0,70 (lettre du
barème) ; **2,5** si Chesapeake ≥ 0,60 ET les trois autres points z13 du barème
≥ 0,70 au GPU ET la perte chaîne/source à Chesapeake ≤ 10 % ; 1,5 sinon (le
partiel du barème). Mesuré : 0,687 ✓ · 0,77 / 1,04 / 0,87 ✓ · perte 4,3 % ✓.
**2,5 / 3,0.** La garde « BT-1 vert avec BT-2 rouge = bruit » ne s'applique pas
: BT-2 est remplacé par l'accord à la source (0,06 m), qui exclut le bruit
inventé — au GPU la pente de Chesapeake monte 1,88 → 3,03 → 3,81 m/km quand le
levé fait 1,90 → 2,97 → 3,11 sur la même fenêtre.

---

## ② LA NOTE — critère par critère, avec MA mesure

| # | critère | ma mesure (GPU, port 7311, `sonde-bt-n.mjs`) | seuil | points |
|---|---|---|---|---|
| **1** | détail en approche | Chesapeake **0,687** ; NY 0,77 · Virginia 1,04 · Tampa 0,87 ; source 0,718 | ≥ 0,70 / règle ① | **2,5 / 3,0** |
| **2** | fond dégelé | \|Δ\| 0,0 et 0,1 m ; source 0,003 / 0,020 m ; accord à la source ≤ 0,1 m ; Δ vs avant 7,1 / 7,2 m | règle ① | **2,0 / 2,0** |
| **3** | pente des plateaux z12 | Virginia **1,957** ✖ · Georges 2,177 ✓ · Louisiane 0,444 (source 0,25–0,34) ✓ · Tampa 2,644 ✓ | 2,0 m/km ×4 / règle ① | **0,8 / 1,5** |
| **4** | cascade sous z8 aux USA | BT-5 **VERT** (ma session) : Chesapeake bathy z9 1 · z10 7 · **z11 21** ; Puget z10 1 · **z11 8** ; Mississippi ≤ z8 (non cuit) ; **zéro 404** sur 144 requêtes bathy | ≥ 1 tuile z ≥ 9 dans les deux zones, 0 404 | **1,5 / 1,5** |
| **5** | déclaré = cuit | `index.json` : 7 zones `bluetopo` (6 à z13, Georges z10) + 3 `ncei` ; **1 666 tuiles** z9–z13 absentes de l'état d'avant (z9 77 · z10 224 · z11 98 · z12 295 · z13 972), toutes hors `fr-metro` | zone bluetopo zmax ≥ 12 et ≥ 500 tuiles | **1,0 / 1,0** |
| **6** | les baies gagnent | Chesapeake **−11,6 / −11,6 m** à z11 / z12 (≤ −9) ✓ ; \|écart\| moyen des 15 points marins : **4,93 m à z11** (avant 6,08) · **4,75 m à z12** (avant 5,90) ✓ | ≤ −9 ; ≤ 6,08 | **1,0 / 1,0** |
| **7** | ⛔ non-régression | témoins ③ tous ≤ 0,8 m ; **Manche −72,5 / −72,5** ; `npm test` 4 797 · 0 ; `audit:tests` 257 = 257 ; `git diff -- src/` vide ; ROUGE intact | tout ou rien | **1,0 / 1,0** |
| | Grands Lacs (hors barème) | Michigan 120,9 m · Érié 22,8 m (= source 22,7) et 62,9 m sous la nappe | +0,5 plafonné | **+0,5** |

### **TOTAL : grille 9,8 − 0,5 (chaîne, hors grille) + 0,5 (lacs, hors barème) = 9,8 / 10. Le seuil de 7,5 est atteint — mais seulement PAR l'arbitrage.**

⚠️ **Sous la lettre stricte du barème, sans aucun de mes arbitrages** (BT-1
partiel 1,5 · BT-2 rouge 0 · BT-4 deux sur quatre 0,4 · le reste acquis) :
**1,5 + 0 + 0,4 + 1,5 + 1,0 + 1,0 + 1,0 = 6,4**, plus 0,5 de lacs = **6,9 < 7,5**.
La note ne tient donc que si l'on accepte que trois seuils demandaient à la carte
d'inventer ce que le levé NOAA ne contient pas — et c'est précisément ce que ①
établit sur le GeoTIFF, pas sur nos tuiles. Si Adrien refuse l'arbitrage, la
note est 6,9 et le manque est **entièrement dans le barème**, pas dans la
chaîne : aucune cuisson ne fera bouger un fond de 3 mm de 1 m.

⚠️ **Le −0,5 hors grille, et je l'écris pour qu'on puisse me contredire** : le
barème ne voit pas que **la chaîne perd entre 4 et 19 % du détail que la source
lui donne** (0,718 → 0,687 ; 2,42 → 1,96 m/km), pour une cause nommée par BT-I
et que je confirme (contenu bathy en 256 px sous des tuiles d'altitude en 512,
le Catmull-Rom entre deux texels réels), et **non tranchée**. Ce n'est pas propre
à BlueTopo — EMODnet et GEBCO surzoomées la subissent aussi — mais BlueTopo est
la première source assez fine pour que ça se voie. Il compense exactement le
bonus des lacs, et c'est voulu : 9,8 dit « l'intégration est bonne », pas
« elle est finie ». Sans bonus ni malus : 9,8 aussi ; avec le bonus seul : 10.

---

## ③ LA NON-RÉGRESSION — remesurée, sur MON échantillon

### Empreintes SHA-256 — échantillon que j'ai choisi

`sha-echantillon.mjs` (scratchpad) : **toutes** les tuiles z ≥ 9 de l'état
d'avant (1 335 : `fr-metro` z9–z10 et Léman z11–z14), **400 tuiles z ≤ 8 tirées
au sort** (graine 12345), et la tuile de la Manche (50 / −1,5) à chaque niveau
z4–z10 → **1 736 tuiles, 1 736 identiques au SHA-256, 0 différente, 0 absente**
contre `avant.json`. Et une preuve **indépendante du fichier de BT-I** : les
mtime des **21 960** tuiles préexistantes vont du 2026-07-26 au **2026-09-03
08:03 UTC** (les dernières sont les z14 du Léman), soit **quatorze heures avant
la première cuisson de BT-I** (`avant.json` : 22:44). Aucune n'a été réécrite.

### Les cinq témoins hors USA, au GPU (z11 **et** z12)

| témoin | gelé BT-A z11 / z12 | **mesuré z11 / z12** | dérive max |
|---|---|---|---|
| **Manche** | −72,5 / −72,5 | **−72,5 / −72,5** | **0,0 m** (−72 ± 5 ✓ ; pente 10,69 / 11,51 m/km, comme BT-A) |
| Rade de Brest | −21,2 / −21,2 | −22,0 / −22,0 | 0,8 m (le même surzoom EMODnet que BT-I) |
| Mer Noire | −2 199,9 / −2 199,8 | −2 199,9 / −2 199,8 | 0,0 m |
| Fosse de la Sonde | −7 105,1 / −7 105,2 | −7 105,1 / −7 105,2 | 0,0 m |
| Léman | +62,0 / +62,0 | +62,0 / +62,0 | 0,0 m |

Et un **témoin négatif** à 130 km de la bbox (37,0 / −74,5, le talus) :
−1 263 / −1 267 / −1 265 m à z11 / z12 / z13, rapport 0,50, tuiles 256 px —
aucune zone ne déborde.

⚠️ **L'intermittence de BT-8 que BT-I décrit, je l'ai eue aussi** : Brest z12,
Léman z12, Puget z12/z13 rendus `ABSENT` à 8 s d'attente, tous obtenus à 14–25
s. Ce n'est pas une dérive, c'est SwiftShader — et c'est aussi pour ça que
j'ai sondé par lots courts plutôt qu'en une session de 40 min.

---

## ④ LES ÉCARTS AVEC BT-I — et le banc que je crois

| grandeur | BT-I | moi | verdict |
|---|---|---|---|
| BT-1 globe | 0,687 | 0,687 | identique (même sonde, même chaîne) |
| BT-1 source | 0,714 (pivot 10 m) | **0,718** GeoTIFF / 0,445 dalle voisine | d'accord, et la dispersion est plus large que BT-I ne le dit |
| pente source Virginia / Louisiane / Chesapeake / Tampa | 2,973 / 0,608 / 3,297 / 3,382 | **2,39–2,46 / 0,25–0,34 / 2,48–2,97 / 2,90** | **je crois le mien** : lecture directe, moyenne par texel. Les siennes sur-estiment de 20–40 % (bruit du pivot non moyenné). Même verdict qualitatif |
| « la chaîne perd 34 % » | −34 % | **−19 %** | perte réelle, moitié moindre |
| Louisiane globe z12 | 0,755 | 0,444 | bruit de session sur un fond à une marche de quantification (BT-A : 0,010) |
| Érié central | 22,49 m sous nappe | 22,8 m (globe +151,0) ; source **22,70** | d'accord |
| poids | 21,17 Mo | **22,19 Mo décimaux = 21,17 Mio** | exact, en Mio |
| 21 960 identiques | SHA-256 | 1 736 / 1 736 + mtimes | confirmé |
| BT-5 / BT-6 | verts | **verts** (mon exécution, port 7311) | confirmé |
| BT-8 | intermittent, acquis au verdict | 5 témoins ≤ 0,8 m à z11 et z12 | confirmé |

---

## ⑤ POINTS HORS BARÈME — ce que personne n'avait choisi

| point | z11 / z12 / z13 (m) | rapport z12→z13 | lecture |
|---|---|---|---|
| Chesapeake 37,20 / −76,10 (dans la bbox, hors coordonnée) | −11,4 / −11,4 / −11,4 | 0,63 | BlueTopo servi ailleurs qu'au point du barème ✓ |
| Chesapeake bassin médian 38,20 / −76,30 | −13,1 ×3 | 1,36 | source −13,05 ✓ (pente 0,61 → 2,12) |
| NY Bight 40,45 / −73,85 | −26,8 / −26,8 / −26,7 | 0,47 | ⚠️ rapport d'interpolation malgré la zone : pente monte 1,58 → 3,45, la donnée arrive mais la fenêtre 9 × 9 ne la voit pas — l'instrument BT-1 est bien fragile |
| Ouest-Floride 27,55 / −83,10 | −24,9 / −24,7 / −24,7 | 0,80 | pente 3,4 → 11,1 m/km ✓ |
| Louisiane 28,75 / −90,45 | −19,0 ×3 | 0,93 | plat comme la source |
| Virginia 36,75 / −75,25 | −26,5 / −26,7 / −26,6 | 0,59 | pente 6,9 / 5,0 / 5,7 |
| Galveston Bay · Cape Cod Bay · Keys · Mobile Bay | −5,2 · −24,1 · −6,8 · −4,7 | **0,53 · 0,50 · 0,49 · 0,50** | hors zone : l'interpolation pure, inchangée |
| San Francisco baie centrale 37,82 / −122,35 | −8,9 / −0,9 / −11,2 | — | hors zone, fenêtre côtière : la valeur saute de 10 m entre z12 et z13 (GEBCO surzoomé sur un rivage) |
| Golden Gate (contre-épreuve BT-A) | −38,2 / −88,1 / −88,3 | 0,81 | identique à BT-A |
| **Puget (NCEI)** 47,60 / −122,45 | −198,0 / −198,1 / **−198,1** (z13 à 15 km) | 0,52 | pente 6,2 / 5,8 / 9,3 ; étendue 4,38 / 1,13 / 0,59 |
| Puget, Elliott Bay 47,61 / −122,38 | −13,9 (z12) | — | rivage de Seattle, pente 175 m/km |
| Cook Inlet | −19,3 / **−45,4** / −45,4 | 0,50 | comme BT-A, hors zone |
| Florida Bay / Keys (barème) | −0,9 / −0,9 | — | était −0,0 : c'est B5 (zéro lossy), pas BlueTopo |

⚠️ **Puget mérite une mention à part** : c'est une **autre source** (NCEI 1/3″,
~10 m), déclarée `ncei` dans `index.json` et `bathy-sources.js`, résolution
annoncée 93 m (le pire des deux cas, à raison). Ses valeurs sont justes (−198
contre otd −203) et la cascade y descend (z11 : 8 tuiles). Mais **BT-5 est vert
à Puget grâce à NCEI, pas à BlueTopo** — le barème demandait « Chesapeake ET
Puget » en croyant BlueTopo présent aux deux ; BT-I a établi qu'il n'y a **0
dalle publiée sur 278** dans le détroit. Le critère 4 reste acquis : il mesure
la cascade, pas la source.

---

## ⑥ CE QUE J'AI CRU, PUIS RÉFUTÉ

- ⛔ **« BT-I déplace les seuils vers là où son correctif marche. »** C'est
  l'hypothèse que le brief me demandait de tester en premier, et j'ai lu les
  GeoTIFF pour la trancher. **Faux sur les trois réfutations** : 0,003 m entre
  z11 et z13, 0,25–0,34 m/km en Louisiane, 22,70 m à Érié — la source dit ce
  que BT-I dit. **Vrai à la marge sur les chiffres** : ses pentes « source »
  sont 20–40 % trop hautes et sa « perte de 34 % » est une perte de 19 %.
- ⛔ **« Le rapport d'étendue est un instrument sûr : 0,500 dehors, > 0,70
  dedans. »** Dehors, oui — 0,49 à 0,53 sur quatre baies non cuites, c'est
  d'une régularité de loi physique. Dedans, **non** : 0,445 et 0,718 sur deux
  dalles NOAA qui couvrent le même point, 0,47 à NY Bight à 6 km du point du
  barème alors que la pente y monte de 1,6 à 3,4 m/km. La grandeur détecte
  l'absence de donnée ; elle ne mesure pas sa présence.
- ⛔ **« Un 9,8 est de la complaisance, le brief m'a prévenu. »** J'ai cherché
  le défaut caché : témoin négatif à 130 km (rien ne déborde), quatre baies
  hors zone (rien n'a bougé), 1 736 empreintes, deux Chrome distincts pour
  BT-5. Le seul défaut réel est la perte de 4–19 % de la chaîne, et je le
  facture 0,5 hors grille au lieu de le taire.
- ⛔ **« San Francisco à 37,75 / −122,40 est dans la baie. »** Non : +11 m, c'est
  Potrero Hill. Recommencé à 37,82 / −122,35. Une coordonnée fausse de 5 km fait
  une mesure fausse sans un message d'erreur — la Caspienne, encore.
- ✅ **Ce que je confirme de BT-A** : la contre-épreuve du Golden Gate (0,81)
  est reproductible au centième ; l'écart moyen des 15 points marins était bien
  ~6 m et n'était pas le sujet ; et BT-8 était le bon test à rendre éliminatoire.

---

## ⑦ CE QUI REVIENT À ADRIEN

- **L'étendue.** 21,17 Mio pour ~4 deg² (10 zones). Les extrapolations de BT-I
  sont cohérentes avec ce que je compte (5,26 Mo pour 0,42 deg² à z13) : **≈ 92
  Mo** pour z10 sur toute la couverture, **≈ 273 Mo** pour z12 littoral, **≈ 959
  Mo** pour z13 littoral — ce dernier double `dist/`. Le ciblage est un choix
  d'Adrien, pas d'agent.
- **NCEI pour Puget Sound, et sa licence.** `bathy-sources.js` déclare « œuvre
  du gouvernement fédéral, 17 U.S.C. §105 ». C'est vrai pour NOAA ; ⚠️ mais les
  DEM régionaux NCEI **compilent des données tierces** (pour Puget : levés
  USGS, université de Washington, USACE), et la page du jeu, pas le script,
  fait foi sur d'éventuelles restrictions d'usage des contributeurs. À vérifier
  une fois avant de publier, comme Copernicus l'a été.
- **Les 233 dalles de 16 m du large** (35,31 Go, 302 deg², 100 % sous −500 m) :
  `cuisson-bluetopo.mjs` passe déjà `--shelf -99999`, donc rien à coder ; c'est
  ≈ 92 Mo de tuiles z10 et 35 Go à télécharger. Le canyon du Mississippi (écart
  12,7 m, le plus gros du tableau hors côte) en dépend.
- **Le 256 / 512.** Le seul défaut de chaîne mesuré : cuire les niveaux fins en
  512 px (BT-I : +150 % d'octets, et BT-1 baisse) ou changer l'interpolation
  bathy avant fusion. À trancher avec le budget, pas ici.
- **Georges Bank cuit à z10 seulement** (dalle de 16 m) : à z12 la pente est
  déjà à −47 % de la source. Cohérent avec la résolution, mais c'est le seul
  point du barème où la zone s'arrête sous z12.

---

## ⑧ LES TESTS ROUGES — état après ma passe

`BTA_PORT=7311 node --test --test-name-pattern "BT-5|BT-6" test/attaque-bt-ROUGE.mjs`
→ **2 / 2 verts** (75 s).

**Passe complète** `BTA_PORT=7311 node --test test/attaque-bt-ROUGE.mjs` (13 min
de sonde, une seule session Chrome) : **3 verts (BT-3, BT-5, BT-6), 5 rouges**.
BT-1, BT-2, BT-4, BT-7 rouges comme attendu (①). **BT-8 rouge par
`AssertionError : point absent du relevé : TEMOIN Manche à z12`** — la tuile
n'était pas `ready` à 8 s dans la session de 88 lectures, exactement
l'intermittence que BT-I décrit. Ce n'est pas une dérive : dans mes lots courts
(14 s d'attente) la Manche rend **−72,5 m à z11 ET z12**, et les quatre autres
témoins sont à ≤ 0,8 m à z11 et z12 (③). Le critère 7 reste acquis sur la
mesure ; le **test**, lui, a besoin d'une attente adaptative avant d'entrer
dans la liste `test` de `package.json` — ce que BT-I avait signalé et que je
confirme sans l'excuser : un éliminatoire qui échoue sur un délai n'est pas un
bon éliminatoire.

Le fichier de tests est **byte pour byte** celui de BT-A (un seul commit dans son
historique). BT-1, BT-2, BT-4 et BT-7 restent rouges **dans le fichier**, et
doivent le rester tant qu'ils portent des seuils que la source ne peut pas
remplir : c'est au coordinateur de réécrire BT-2 (accord à la source),
BT-4 (Louisiane à la source) et BT-7 (Érié à 22,7 ou à un autre point), pas à
l'intégrateur de les verdir.

Fichiers : `scripts/sonde-bt-n.mjs` (copie de `sonde-bt-a.mjs` + `--points`),
`scripts/mesure-source-bt-n.mjs` (le GeoTIFF), relevés bruts dans le scratchpad
de session (`banc-*.json`).
