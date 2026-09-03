# BT-A — LES CÔTES AMÉRICAINES AVANT BlueTopo : JUSTES EN MOYENNE, LISSÉES À 490 m

Arbre `C:\Dev\wt-bt1`, branche `bluetopo-audit`. Serveur `npm run dev -- --host
127.0.0.1 --port 6533`. Chrome 141 sans tête (SwiftShader), sonde
`scripts/sonde-bt-a.mjs` (plomberie CDP, pose forcée dans `composer.render` et
lecture au `readPixels` sur la texture GL attachée à un tampon — patron
`sonde-r36.mjs` puis `sonde-b1.mjs`, repris sans le modifier).

**`npm test` → 4 755 · 0 échec. `npm run audit:tests` → 253 listés · 253 sur
disque, aucun écart. `git diff -- src/` VIDE** (je ne corrige rien).

`find public/data/bathy/8 -type f | wc -l` → **13 891** avant la première sonde.

---

## ⚡ EN UNE PHRASE — ET JE CHERCHAIS À AVOIR TORT

**BlueTopo n'a presque rien à corriger sur la profondeur, et tout à corriger sur
la résolution.** Sur les quinze points marins américains, le globe se trompe de
**6,08 m en moyenne à z11** et **5,90 m à z12** — c'est bon. Mais **entre z12 et
z13 l'étendue du fond sur 9 × 9 texels est divisée par 0,500** (moyenne 0,537 sur
treize points ; douze d'entre eux entre 0,495 et 0,563), et **la valeur du fond
ne bouge plus de 0,25 m entre z11 et z13**. C'est la loi exacte de
l'interpolation linéaire d'une surface qui ne reçoit **aucune donnée nouvelle** :
la carte cesse d'ajouter du détail **à z8**, soit **488 m au sol à Chesapeake**,
et le montre en surzoomant le même texel sur cinq niveaux. La promesse
« 2–16 m » du catalogue est fausse d'un facteur **30**.

⚡ **La contre-épreuve est dans le même relevé, et c'est elle qui rend le chiffre
irréfutable** : au Golden Gate, où la fenêtre 9 × 9 chevauche la **côte**, le
rapport z12 → z13 monte à **0,810** et la valeur bouge de **50,1 m**. La terre a
du détail à z13 ; la mer n'en a pas. Même session, même sonde, même pixel.

---

## ① LE TABLEAU — 15 points marins américains + 2 Grands Lacs + 5 témoins

Lecture **au GPU** (`readPixels` sur la texture GL de la tuile la plus fine
prête), damier lu par `loadDem` **au zoom que le globe vient de choisir**, dans
la **même session**. Altitudes forcées 250 / 110 / 60 / 30 km → z10 / z11 / z12 /
z13. Toutes les valeurs sont des **altitudes absolues de fond, en mètres**.

⚠️ **Le pixel réel est indiqué** : à z11 le globe sert du **256 px** et à z12 du
**512 px**. B3 a cru à un excès de relief de ×1,7 à 2 avant de comprendre qu'il
mesurait la tuile, pas le fond. Toutes les pentes ci-dessous sont **divisées par
la taille au sol du texel** : `156 543,03 × cos(lat) / (2^z × px/256)`.

⚠️ **Références externes** relevées le 2026-09-03 sur `api.opentopodata.org`,
jeu **`gebco2020`** (et **`etopo1`** en contrôle croisé, **`ned10m`** pour les
lacs). **Elles sont partiellement circulaires et je le dis en ⑥** : nos tuiles
sont du GEBCO. Elles servent à vérifier que rien ne dérive, pas à absoudre.

| # | lieu | lat / lon | réf. externe | **z11 globe / damier** | **z12 globe / damier** | écart z12 |
|---|---|---|---|---|---|---|
| 1 | Chesapeake — embouchure (Thimble Shoal) | 37,00 / −76,05 | **−10** (otd gebco2020 ; etopo1 −10) | **−4,5** / −4 | **−4,4** / −4 | **5,6 m** |
| 2 | Chesapeake — bassin médian | 38,20 / −76,30 | −13 (otd ; etopo1 −12) | −7,0 / −7 | −7,0 / −7 | 6,0 m |
| 3 | Plateau au large de Virginia Beach | 36,80 / −75,30 | −24 (otd) | −27,1 / −27 | −27,1 / −27 | 3,1 m |
| 4 | New York Bight / sortie de l'Hudson | 40,50 / −73,90 | −10 (otd) | −4,6 / −5 | −4,7 / −5 | 5,3 m |
| 5 | Tête du canyon de l'Hudson | 39,60 / −72,60 | −76 (otd) | −75,2 / −76 | −75,3 / −76 | 0,7 m |
| 6 | Massachusetts Bay | 42,35 / −70,60 | −70 (otd ; etopo1 −70) | −71,6 / −72 | −71,8 / −72 | 1,8 m |
| 7 | Golfe du Maine (Jeffreys Ledge) | 42,90 / −70,30 | −157 (otd) | −158,5 / −158 | −158,2 / −158 | 1,2 m |
| 8 | Georges Bank | 41,30 / −67,50 | −40 (otd) | −39,0 / −39 | −39,0 / −39 | 1,0 m |
| 9 | Plateau louisianais (large de Terrebonne) | 28,80 / −90,50 | −19 (otd) | −16,2 / −16 | −16,2 / −16 | 2,8 m |
| 10 | Golfe du Mexique — canyon du Mississippi | 27,50 / −89,50 | −1 835 (otd) | −1 821,7 / −1 822 | −1 822,3 / −1 822 | 12,7 m |
| 11 | Florida Bay / Keys | 24,80 / −81,30 | −1 (otd) | **−0,0** / 0 | **−0,0** / 0 | 1,0 m |
| 12 | Plateau ouest-Floride (large de Tampa) | 27,50 / −83,20 | −30 (otd) | −28,2 / −28 | −28,2 / −28 | 1,8 m |
| 13 | Détroit de Puget — bassin principal | 47,60 / −122,45 | −203 (otd ; etopo1 −201) | −195,1 / −195 | −195,2 / −195 | 7,8 m |
| 14 | Baie de San Francisco — Golden Gate ⚠️ | 37,82 / −122,50 | −51 (otd) | **−38,2** / **+1** | **−88,1** / −89 | 37,1 m |
| 15 | Cook Inlet (Alaska) ⚠️ | 60,50 / −151,60 | −46 (otd) | −19,3 *(z10)* / −19 | −45,4 *(z12)* / −19 | 0,6 m |
| 16 | **Lac Michigan** (large de Muskegon) | 43,30 / −86,90 | **+76** (nappe +176,91 **ned10m**, ~100 m de fond) | **+176,9** / +177 | **+177,0** / +177 | **101,0 m** |
| 17 | **Lac Érié** (bassin central) | 42,00 / −81,50 | **+114** (nappe +173,80 **ned10m**, ~60 m de fond) | **+173,8** / +174 | **+173,8** / +174 | **59,8 m** |
| T1 | **TÉMOIN** Manche (large de Portland) | 50,00 / −1,50 | −72 (otd) | −72,5 / −72 | −72,5 / −72 | 0,5 m |
| T2 | **TÉMOIN** Rade de Brest (zone EMODnet) | 48,35 / −4,50 | −25 (otd) | −21,2 / −21 | −21,2 / −21 | 3,8 m |
| T3 | **TÉMOIN** Mer Noire (centre) | 43,00 / 34,00 | −2 197 (otd) | −2 199,9 / −2 200 | −2 199,8 / −2 200 | 2,8 m |
| T4 | **TÉMOIN** Fosse de la Sonde (Java) | −10,30 / 109,90 | −7 114 (otd) | −7 105,1 / −7 105 | −7 105,2 / −7 105 | 8,8 m |
| T5 | **TÉMOIN** Léman (point le plus bas) | 46,44064 / 6,59996 | +62 (swissBATHY3D / CIPEL) | +62,0 / +62 | +62,0 / +62 | 0,0 m |

### Les moyennes — et elles disent que la profondeur va bien

| groupe | z11 \|écart\| moyen | médian | max | z12 \|écart\| moyen | médian | max |
|---|---|---|---|---|---|---|
| **15 points marins USA** | **6,08 m** | 3,11 m | 26,7 m | **5,90 m** | 2,79 m | 37,1 m |
| **2 Grands Lacs** | **80,4 m** | — | 100,9 m | **80,4 m** | — | 101,0 m |
| **5 témoins hors USA** | **3,23 m** | 2,92 m | 8,9 m | **3,16 m** | 2,76 m | 8,8 m |

Accord globe / damier : **2,01 m en moyenne à z11**, **1,43 m à z12**. Les deux
chemins racontent la même chose — le correctif de B3 tient, et il tient aussi
sur des côtes qu'aucun de ses seuils ne visait.

⚠️ **Deux points portent une coordonnée discutable, et je les garde marqués.**
Le **Golden Gate** (37,82 / −122,50) est **sur le trait de côte** : la fenêtre
9 × 9 y avale de la terre, d'où une étendue de 268 m et un désaccord de 39 m
avec le damier à z11. Je ne le retire pas — c'est justement lui qui fournit la
contre-épreuve du ⚡, et le retirer aurait embelli la moyenne de 2,1 m.
**Cook Inlet** rend −19,3 m à z10 puis −45,4 m à z12 : c'est la seule descente du
lot où la valeur bouge vraiment, et elle bouge dans le bon sens (la référence est
−46). Une marée de 9 m et un chenal étroit y rendent tout point ponctuel fragile.

---

## ② LA RÉSOLUTION EFFECTIVE — LE CHIFFRE QUI COMPTE VRAIMENT

### La loi mesurée : ×0,500 par niveau, à taille de tuile constante

De z12 à z13, la tuile reste à **512 px** : la fenêtre 9 × 9 couvre **deux fois
moins de sol**. Si la carte n'ajoute rien, l'étendue est **divisée par deux
exactement**. Si une source fine mord, elle ne l'est pas.

| lieu | étendue z12 | étendue z13 | **rapport** |
|---|---|---|---|
| Chesapeake — embouchure | 0,45 m | 0,23 m | **0,500** |
| Chesapeake — bassin médian | 0,08 m | 0,04 m | **0,500** |
| Plateau Virginia Beach | 0,05 m | 0,03 m | **0,500** |
| New York Bight | 0,37 m | 0,19 m | **0,505** |
| Massachusetts Bay | 1,46 m | 0,72 m | **0,495** |
| Golfe du Maine | 1,72 m | 0,88 m | **0,508** |
| Georges Bank | 0,18 m | 0,10 m | **0,556** |
| Plateau louisianais | 0,06 m | 0,04 m | **0,563** |
| Golfe du Mexique — Mississippi | 4,71 m | 2,39 m | **0,507** |
| Plateau ouest-Floride | 0,15 m | 0,08 m | **0,513** |
| TÉMOIN mer Noire | 1,09 m | 0,57 m | **0,522** |
| TÉMOIN fosse de la Sonde | 1,44 m | 0,72 m | **0,501** |
| ⚡ **Golden Gate — la fenêtre touche la CÔTE** | 149,67 m | 121,29 m | **0,810** |
| | | **moyenne (12 points de mer)** | **0,511** |

**0,511 contre 0,810.** La mer est une surface interpolée ; la terre, au même
zoom, dans la même image, ne l'est pas.

### La deuxième preuve : la valeur est gelée

|globe(z13) − globe(z11)|, en mètres, sur trois niveaux de zoom :

| Chesapeake emb. | bassin méd. | Virginia B. | NY Bight | Georges B. | Louisiane | Floride | Mass. Bay | Golfe du Maine | Mississippi |
|---|---|---|---|---|---|---|---|---|---|
| **0,06** | **0,02** | **0,01** | **0,02** | **0,04** | **0,00** | **0,00** | 0,16 | 0,25 | 0,43 |

Un déplacement de **deux niveaux de zoom** — de 976 m de texel à 61 m à 37° N —
change la valeur du fond de **moins de 25 cm** partout. C'est le même texel
GEBCO z8, servi quatre fois.

### La pente par kilomètre, aux quatre zooms

| lieu | z10 | z11 | z12 | z13 |
|---|---|---|---|---|
| Chesapeake — embouchure | 1,96 | 3,00 | 1,25 | 1,20 |
| Chesapeake — bassin médian | 0,35 | 0,39 | 0,61 | 0,63 |
| Plateau Virginia Beach | — | 0,30 | **0,13** | **0,11** |
| New York Bight | 1,00 | 1,08 | 1,18 | 1,17 |
| Tête du canyon de l'Hudson | 1,68 | 0,57 | 0,29 | 0,25 |
| Massachusetts Bay | 9,73 | 11,14 | 10,28 | 10,30 |
| Golfe du Maine | 4,19 | 2,54 | 0,50 | 0,50 |
| Georges Bank | 1,39 | 1,39 | **0,12** | **0,19** |
| Plateau louisianais | 0,08 | **0,01** | **0,01** | **0,01** |
| Golfe du Mexique — Mississippi | 8,68 | 11,79 | 15,96 | 16,28 |
| Florida Bay / Keys | 0,23 | **0,00** | **0,00** | **0,00** |
| Plateau ouest-Floride | 0,92 | 0,49 | 0,65 | 0,66 |
| Détroit de Puget | — | 12,82 | 13,18 | — |
| Lac Michigan | **0,00** | **0,00** | **0,00** | **0,00** |
| Lac Érié | 1,22 | **0,00** | **0,00** | **0,00** |
| **TÉMOIN Manche** | — | 10,69 | **11,51** | — |
| **TÉMOIN Rade de Brest** | — | 7,41 | 1,31 | — |
| **TÉMOIN mer Noire** | 5,09 | 6,61 | 7,25 | 7,24 |
| **TÉMOIN fosse de la Sonde** | 5,76 | 6,52 | 7,22 | 7,20 |
| **TÉMOIN Léman (swisstopo 2 m)** | — | 1,85 | 1,41 | — |

⚠️ **Une pente par kilomètre à peu près CONSTANTE d'un zoom au suivant est la
signature du lissage, pas de la qualité.** Un fond réellement décrit à 16 m
montre des pentes locales **plus fortes** à mesure qu'on descend : la moyenne
d'une dérivée sur une fenêtre qui rétrécit augmente quand la donnée suit. Ici,
mer Noire 5,09 → 7,24 et Java 5,76 → 7,20 : la légère hausse est celle du
noyau Catmull-Rom, pas celle d'un relief. Et **cinq plateaux américains sont
sous 0,70 m/km à z12** (Virginia Beach 0,13 · Georges Bank 0,12 · Louisiane 0,01
· Floride 0,00 · Chesapeake médian 0,61), quand la **Manche rend 11,51 m/km au
même zoom** avec EMODnet à 115 m.

### La résolution effective, en mètres au sol

C'est la taille du texel GEBCO z8, la maille la plus fine qui porte réellement du
fond dans les eaux américaines (établi par le réseau, ③) :

| Chesapeake | New York Bight | Golfe du Maine | Louisiane | Floride | Puget | Cook Inlet |
|---|---|---|---|---|---|---|
| **488 m** | 465 m | 448 m | 536 m | 555 m | 412 m | 301 m |

**Contre les 16 m annoncés par `src/bathy-sources.js` : un facteur 30.**

---

## ③ LE RELEVÉ RÉSEAU — LE ZOOM OÙ LA DESCENTE MEURT : **z8**

`node scripts/sonde-bt-a.mjs --scenario reseau`, quatre zones, 15 s de vol à
110 km chacune, compté par `Network.requestWillBeSent` / `responseReceived`.
Relevé **reproduit à l'identique** par `node --test test/attaque-bt-ROUGE.mjs`
(BT-5, deuxième session, deuxième Chrome).

| zone | tuiles **bathy**, par zoom | tuiles **d'altitude**, par zoom | 404 |
|---|---|---|---|
| **Chesapeake** (37,0 / −76,05) | z3 1 · z4 1 · z5 2 · z6 2 · z7 4 · **z8 4** — **rien au-delà** | z3..z8 13 · **z9 12 · z10 30 · z11 74** | **0** |
| **Détroit de Puget** (47,6 / −122,45) | z3 3 · z4 1 · z5 2 · z6 2 · z7 1 · **z8 4** — **rien au-delà** | z3..z8 13 · **z9 12 · z10 35 · z11 32** | **0** |
| **Golfe du Mexique** (27,5 / −89,5) | z4 1 · z5 2 · z6 4 · z7 4 · **z8 4** — **rien au-delà** | z4..z8 15 · **z9 9 · z10 20 · z11 70** | **0** |
| **TÉMOIN Manche** (50,0 / −1,5) | z3 4 · z4 2 · z5 4 · z6 2 · z7 1 · z8 4 · **z9 12 · z10 36** | z3..z10 66 · z11 4 | **0** |

Requête par requête, à Chesapeake :

```
200  102 030 o  /elevation-tiles-prod/terrarium/5/21/17.png
200   77 681 o  /data/bathy/5/21/17.png
200   82 579 o  /elevation-tiles-prod/terrarium/4/4/6.png
200   44 482 o  /data/bathy/4/4/6.png
200   64 076 o  /elevation-tiles-prod/terrarium/6/18/24.png
…  puis  /elevation-tiles-prod/terrarium/9,10,11  →  200, SANS aucun /data/bathy/ en regard
```

### Le verdict, en trois phrases

1. **La cascade est vivante** — la correction de B3 fonctionne aussi sur les
   côtes américaines : 14, 13 et 15 tuiles bathy demandées, **toutes 200, zéro
   404**, une tuile bathy pour une tuile d'altitude tant que la cascade a
   quelque chose.
2. **Elle meurt à z8** dans les eaux américaines, pendant que la carte continue
   de descendre en altitude jusqu'à **z11**. Les 116 tuiles z9–z11 de Chesapeake
   n'ont **aucun répondant bathymétrique**.
3. **Ce n'est pas un échec de requête, c'est un plafond d'index.** Zéro 404 :
   la carte ne CHERCHE pas plus fin. `index.json` ne déclare que `fr-metro`
   (z10), `leman` (z14) et `baikal` (z8) ; hors de ces trois emprises, le socle
   `{"source":"gebco","zmax":8}` est la butée, et `normalizeIndex` /
   `tileMaxZoom` la font respecter. La Manche, elle, descend bien à z10.

**La descente ne meurt pas d'un défaut : elle meurt d'une absence de zone.**

---

## ④ LE VERDICT SUR LE FILTRE `SHELF` APPLIQUÉ À BlueTopo

`scripts/build-bathy-tiles.mjs` : `SHELF = −500`. Une tuile n'est écrite que si
elle voit de la **terre** (`m >= 0`) ou du **plateau** (`SHELF < m < 0`), et,
après le remplissage, seulement si `anySea && anyShelf`. B3 a payé ce filtre sur
la plaine ionienne. **Il coûterait à BlueTopo, mais pas là où on l'attend.**

Mesuré en appliquant **la règle exacte de `probeWorthIt`** (tamis 32 × 32) à la
meilleure carte de profondeur du disque — nos tuiles GEBCO z8 — sur l'emprise
`us-est` de `scripts/bathy-zones.json` (`[-98, 24, -66, 45]`) :

| zoom | grille complète | échantillon | **gardées** | **écartées** |
|---|---|---|---|---|
| z9 | 1 739 | 1 739 (toutes) | 548 — **31,5 %** | 1 191 — **68,5 %** |
| z10 | 6 808 | 1 702 (1 sur 2×2) | 513 — 30,1 % | 1 189 — 69,9 % |
| z11 | 27 084 | 1 702 (1 sur 4×4) | 509 — 29,9 % | 1 193 — 70,1 % |
| **z12** | **107 604** | 1 702 (1 sur 8×8) | 494 — **29,0 %** | 1 208 — **71,0 %** |

### ⛔ Mais **71 % n'est pas le chiffre à retenir**, et le publier tel quel serait malhonnête

Des 1 208 tuiles z12 écartées, **1 108 sont écartées faute de donnée** : la tuile
GEBCO z8 correspondante **n'existe pas non plus**, écartée un niveau plus haut
par le **même filtre**. C'est l'Atlantique large et le bassin profond du golfe,
que BlueTopo ne couvre pas davantage. Les écarter est **correct**.

Les 100 tuiles réellement perdues se répartissent ainsi :

| bande de profondeur du centre | tuiles z12 écartées (échantillon 1/64) | **extrapolé grille complète** |
|---|---|---|
| **talus, −500 à −2 000 m** | **57** | **≈ 3 650 tuiles** |
| pente, −2 000 à −3 500 m | 29 | ≈ 1 850 |
| abysse, < −3 500 m | 14 | ≈ 900 |

➡️ **Le talus continental est le seul endroit où `SHELF` fait mal, et c'est
précisément le plus mauvais.** C'est la rupture de pente au large de Chesapeake,
de l'Hudson et de Georges Bank — le trait le plus RAIDE de toute la côte est,
celui qui se voit à l'œil, et celui où B1 s'était trompé de coordonnée
(« Chesapeake −40 m » alors qu'il sondait le talus à −1 376 m).

### Point par point : la tuile qui porte chacun de mes points serait-elle écrite ?

| lieu | GEBCO z8 | z10 | z11 | z12 |
|---|---|---|---|---|
| Chesapeake embouchure / médian / Virginia Beach | −11 / −13 / −27 | ÉCRITE | ÉCRITE | ÉCRITE |
| New York Bight · canyon de l'Hudson · Mass. Bay | −11 / −76 / −72 | ÉCRITE | ÉCRITE | ÉCRITE |
| Golfe du Maine · Georges Bank · Louisiane | −160 / −39 / −19 | ÉCRITE | ÉCRITE | ÉCRITE |
| Floride · Tampa · Puget · San Francisco · Cook Inlet | −1 / −28 / −196 / −84 / −45 | ÉCRITE | ÉCRITE | ÉCRITE |
| ⛔ **Golfe du Mexique — canyon du Mississippi** | **−1 816** | **ÉCARTÉE** | **ÉCARTÉE** | **ÉCARTÉE** |

**Quatorze de mes quinze points marins passent le filtre.** Le seul écarté est
celui qui est sous −500 m — et il n'est pas anodin : le canyon du Mississippi est
une zone BlueTopo réelle, et c'est aussi le point de mon tableau qui a **le plus
gros écart après le Golden Gate (12,7 m)**.

### ⛔ ET LE DÉFAUT QUE `SHELF` CACHE : les Grands Lacs sont hors d'atteinte de ce tuileur

Ce n'est pas `SHELF` qui les tue, c'est la ligne au-dessus :
`const raw = m == null || m >= 0 ? 0 : m` — **le tuileur n'écrit que ce qui est
sous le niveau de la MER**, et il n'a **aucune notion de `waterLevelM`**
(`grep waterLevel scripts/build-bathy-tiles.mjs` → rien ; les tuiles du Léman
viennent de `scripts/pivot-swissbathy3d.mjs`, un autre script).

| lac | nappe | fond le plus bas | ce que le tuileur en ferait |
|---|---|---|---|
| Supérieur | +183 m | −223 m | seuls les 223 m **sous 0** sont écrits ; les 183 m du haut sont aplatis à 0 |
| Michigan | +176 m | −105 m | idem, 105 m sur 281 |
| Huron | +176 m | −53 m | idem, 53 m sur 229 |
| **Érié** | **+174 m** | **+110 m** | ⛔ **aucun pixel sous 0 : `anySea` reste faux, la tuile n'est JAMAIS écrite** |
| Ontario | +75 m | −169 m | 169 m sur 244 |

**Le lac Érié est intégralement au-dessus du niveau de la mer.** Aucune valeur de
`SHELF` ne le sauve. Et mon point du lac Michigan, à 43,3 / −86,9, est à environ
**+86 m** : il serait aplati à 0 lui aussi, donc marqué « pas de la mer ».

⚡ **La preuve que ce qu'on affiche aujourd'hui est bien la NAPPE, et pas un
fond** : `api.opentopodata.org/v1/ned10m` (USGS 10 m, terrestre) rend **176,91 m**
et **173,80 m** aux deux coordonnées. Le globe rend **+176,9** et **+173,8**.
**À un centimètre près.** Étendue 9 × 9 : **0,00 m à z10, z11, z12 et z13**, aux
deux points. C'est une plaque.

➡️ **Cuire les Grands Lacs demande deux choses que `build-bathy-tiles.mjs` n'a
pas** : une nappe par zone dans le tuileur, et une sentinelle « 0 = absence »
(que `src/bathy.js` a déjà, gardée par `level > 0`, écrite par B3).
Un intégrateur qui déclare la zone et lance le tuileur obtiendra **zéro tuile**,
sans message d'erreur — c'est exactement le défaut discret que le brief redoute.

### ✅ Une bonne nouvelle, vérifiée : la source est bien là

`https://noaa-ocs-nationalbathymetry-pds.s3.amazonaws.com/?list-type=2&prefix=BlueTopo/&delimiter=/`
répond **200** et liste les préfixes de tuiles (`BlueTopo/BC24C27G/`, …) **sans
compte ni signature**. La note de `bathy-zones.json` est exacte, et le seul
verrou juridique du dossier (Copernicus, qui exige un compte) ne s'applique pas
ici : **CC0-1.0**, crédit déjà écrit dans `src/bathy-sources.js`.

---

## ⑤ LES TESTS ROUGES

`test/attaque-bt-ROUGE.mjs` — **hors** de la liste `test` de `package.json`
(`audit:tests` reste **253 = 253**, vérifié après l'écriture du fichier).
La commande est en tête du fichier :

```
npm run dev -- --host 127.0.0.1 --port 6533
node --test test/attaque-bt-ROUGE.mjs
```

Variables : `BTA_PORT` (6533), `BTA_CHROME`. Les tests de fond partagent **une
seule session de navigateur** (mémoïsée) : le pixel n'est déterministe qu'en
orbite. Compter ~40 min pour la passe complète, ~2 min pour `BT-5|BT-6` seuls
(`--test-name-pattern`).

**Huit tests : sept rouges, un vert et qui doit le rester.** Chaque seuil est en
**mètres de fond**, en **pente par kilomètre** ou en **nombre de requêtes** —
aucune unité interne, aucun ratio de rampe : un correctif ne peut pas les verdir
en changeant une échelle ou un uniforme.

| test | seuil | ce qu'il rend aujourd'hui |
|---|---|---|
| **BT-1** la carte ajoute du détail z12 → z13 (Chesapeake) | rapport d'étendue ≥ **0,70** | ✖ **0,500** — l'interpolation pure. Côte au Golden Gate : 0,810 |
| **BT-2** le fond change entre z11 et z13 | ≥ **1,00 m** | ✖ Chesapeake **0,06 m** · New York Bight **0,02 m** |
| **BT-3** la baie de Chesapeake a un fond | ≤ **−9,0 m** à z11 **et** z12 | ✖ **−4,5** et **−4,4 m** (externe −10 ; chenal dragué à −16,8) |
| **BT-4** les plateaux portent de la pente à z12 | ≥ **2,0 m/km** ×4 | ✖ Virginia Beach **0,131** · Georges Bank **0,125** · Louisiane **0,010** · Tampa 0,647 |
| **BT-5** la cascade descend sous z8 aux USA | ≥ **1** tuile bathy z≥9, Chesapeake **et** Puget | ✖ **0 sur 27** tuiles bathy, toutes ≤ z8, pendant 116 + 79 tuiles d'altitude z9–z11 |
| **BT-6** BlueTopo catalogué ⇒ BlueTopo cuit | ≥ **1** zone `bluetopo`, `zmax ≥ 12` | ✖ zones présentes : `fr-metro/emodnet`, `leman/swisstopo`, `baikal/gebco` |
| **BT-7** les Grands Lacs ont un fond | ≥ **30 m** sous la nappe `ned10m` | ✖ Michigan **−0,09 m** · Érié **+0,05 m** sous la nappe |
| **BT-8 ⛔ NON-RÉGRESSION** les 5 témoins hors USA | ≤ **5 m** de dérive, z11 **et** z12 | ✅ **VERT — et il doit le rester** |

⚠️ **BT-8 est vert exprès.** C'est le seul test du fichier qui ne demande pas un
progrès : il interdit une régression. Les dix valeurs qu'il gèle ont été
relevées au GPU dans la session du tableau ①, et l'externe est écrit en
commentaire au-dessus de chacune.

---

## ⑥ LE BARÈME POUR LE NOTEUR — sept critères, 10 points

Adrien exige **7,5 / 10**. Ce barème est écrit pour que 7,5 se **mérite** : les
critères ① et ② pèsent **5 points** et **aucun des deux ne s'obtient en cuisant
des tuiles grossières** — ils mesurent le détail à z12/z13, pas la moyenne.

⚠️ **Chaque seuil est ancré sur une coordonnée que j'ai vérifiée** contre
`api.opentopodata.org` le 2026-09-03, et la valeur externe figure dans le
tableau ①. Deux seuils du barème précédent visaient 80 et 200 km à côté de la
fosse qu'ils croyaient sonder ; ici, **aucun seuil ne demande à la carte d'être
fausse** : le plus exigeant (BT-4, 2 m/km) est **six fois sous** ce que la Manche
rend déjà avec EMODnet.

| # | critère | mesure | seuil « acquis » | points |
|---|---|---|---|---|
| **1** | **La carte ajoute enfin du détail en approche** | `BT-1` — rapport d'étendue 9 × 9 entre z12 et z13, à 512 px des deux côtés, Chesapeake embouchure | **≥ 0,70** (aujourd'hui **0,500**). Partiel : ≥ 0,60 → 1,5 pt. ⛔ Un rapport ≥ 0,95 sans que `BT-2` bouge = du bruit ajouté, **0 pt** | **3,0** |
| **2** | **Le fond n'est plus gelé** | `BT-2` — \|globe(z13) − globe(z11)\| au GPU, Chesapeake **et** New York Bight | **≥ 1,00 m aux deux points** (aujourd'hui 0,06 et 0,02 m). Partiel : un seul point → 1,0 pt | **2,0** |
| **3** | **Les plateaux portent de la pente** | `BT-4` — pente par kilomètre à z12, quatre plateaux | **≥ 2,0 m/km sur les quatre** (aujourd'hui 0,131 · 0,125 · 0,010 · 0,647). Trois sur quatre → 0,8 pt · deux → 0,4 pt | **1,5** |
| **4** | **La cascade descend sous z8 dans les eaux américaines** | `BT-5` — comptage au protocole, **Chesapeake ET Puget**, 15 s à 110 km | **≥ 1 tuile `/data/bathy/` à z ≥ 9 dans les DEUX zones, et zéro 404** (aujourd'hui 0 / 27). ⛔ Des 404 en série = la zone est déclarée sans être cuite : **0 pt** | **1,5** |
| **5** | **Déclaré = cuit** | `BT-6` + `find public/data/bathy/{9,10,11,12} -type f \| wc -l` | zone `bluetopo` dans `index.json` avec **`zmax ≥ 12`**, **et** au moins **500 tuiles** réellement sur le disque à z ≥ 9 hors emprise `fr-metro`. ⛔ Une zone déclarée sans tuiles : **0 pt et le critère 4 tombe avec** | **1,0** |
| **6** | **La profondeur des baies gagne, ou au moins ne perd pas** | `BT-3` + le tableau ① rejoué | Chesapeake embouchure **≤ −9,0 m** à z11 **et** z12 → 0,5. **Et** l'écart moyen des 15 points marins **≤ 6,08 m** (l'état d'avant) à z11 **et** z12 → 0,5. ⚠️ **Un intégrateur qui dégrade la moyenne pour gagner du détail perd ce demi-point, pas les critères 1–3** | **1,0** |
| **7** | **⛔ NON-RÉGRESSION — ÉLIMINATOIRE** | `BT-8` + `npm test` + `audit:tests` + `git diff -- src/` | **TOUT OU RIEN.** Les 5 témoins hors USA à **≤ 5 m** de dérive **à z11 ET z12** (Manche −72,5 · Brest −21,2 · mer Noire −2 199,9 · Java −7 105,1 · Léman +62,0) ; la **Manche à −72 ± 5 m** ; `npm test` **≥ 4 755 · 0 échec** ; `audit:tests` **253 = 253 sans écart** ; `git diff -- src/` cohérent avec le correctif annoncé | **1,0** |

### ⛔ Les règles de notation, écrites pour qu'elles ne se contournent pas

- ⛔ **Le critère 7 est ÉLIMINATOIRE : sans lui, la note est plafonnée à 5,0 et
  ne peut pas atteindre 7,5.** La Manche a déjà bougé de 4 m sur ce chantier,
  soit **80 % de la tolérance**. Une dérive de plus d'un mètre sur elle mange le
  reste, et une zone BlueTopo dont la `bbox` déborde sur l'Atlantique nord peut
  très bien déplacer Java ou la mer Noire par un plafond mal normalisé.
- ⛔ **Une mesure lue autrement qu'au GPU ne compte pas.** `t.heights` est
  relâché dès le maillage bâti ; `gl.getError()` a rendu **0** sur les 88
  lectures de cette campagne, y compris sur les aplats à 0,00 m des Grands Lacs.
- ⛔ **Aucun critère n'est acquis à z11 seul.** Les critères 1, 2 et 3 se jugent
  **à z12 et z13** : c'est là que 16 m se distingue de 464 m, et un plafond
  `zmax: 10` verdirait la moyenne sans rien changer au détail.
- ⛔ **Le pixel réel doit être divisé.** À z11 le globe sert du 256 px et à z12 du
  512 : comparer deux étendues brutes fabrique un facteur 2. B3 a payé ce piège.
  Toute pente doit être rapportée à `156 543 × cos(lat) / (2^z × px/256)`.
- ⛔ **Un rapport d'étendue qui monte sans que la valeur bouge (BT-1 vert,
  BT-2 rouge) est du bruit, pas du relief** — critère 1 à 0. Le contrôle est
  gratuit : les deux tests lisent la même session.
- ⚠️ **Les Grands Lacs ne sont PAS au barème.** `BT-7` est rouge et documenté,
  mais `build-bathy-tiles.mjs` n'a aucune notion de nappe et le lac Érié est
  entièrement au-dessus du niveau de la mer (④) : l'exiger serait demander un
  second chantier. **Un intégrateur qui les cuit quand même mérite +0,5 point
  hors barème, plafonné à 10.**
- ⚠️ **Le filtre `SHELF` n'est pas au barème non plus, et c'est délibéré** : sur
  quinze points marins, quatorze passent. Mais il coûte **≈ 3 650 tuiles z12 sur
  le talus continental**, et un intégrateur qui l'assouplit **doit le mesurer en
  octets** avant de le faire — `dist/` fait déjà 968 Mo dont 336 de bathymétrie,
  et le plan Netlify est à plafond dur.

---

## ⑦ CE QUE J'AI CRU, PUIS RÉFUTÉ

- ⛔ **« Les côtes américaines sont fausses, comme la fosse de la Sonde l'était
  avant B3. »** C'est ce que le brief laisse espérer et ce que j'ai cherché
  pendant quatre heures. **Faux : l'écart moyen est de 6,08 m à z11 sur quinze
  points**, et l'accord globe / damier de 2,01 m. Le correctif de B3 tient sur
  des côtes qu'aucun de ses seuils ne visait. **C'est le résultat le plus utile
  de ce rapport** — il dit que BlueTopo ne répare pas un bogue, il augmente une
  résolution, et le barème doit donc noter le DÉTAIL, pas la moyenne.
- ⛔ **« L'erreur moyenne en mètres suffit à mesurer l'apport de BlueTopo. »**
  Elle le rate complètement. Un fond juste en moyenne et lissé à 490 m passe tous
  les seuils de profondeur du barème précédent. La grandeur qui le démasque est
  le **rapport d'étendue à taille de tuile constante** — 0,500 mesuré contre
  0,500 théorique pour l'interpolation pure — et il ne se contourne pas.
- ⛔ **« La contre-épreuve est impossible : je ne peux pas prouver qu'un fond
  plat n'est pas simplement un fond plat. »** Je l'ai cru en écrivant BT-1. **Le
  Golden Gate la fournit gratuitement** : sa fenêtre 9 × 9 chevauche la côte,
  donc du terrarium terrestre, et son rapport monte à **0,810** quand douze
  points de mer sont à 0,511 — même image, même sonde, même pixel. Le lissage
  n'est pas une propriété du fond, c'est une propriété de la donnée bathy.
- ⛔ **« `SHELF = −500` va priver BlueTopo de 71 % de sa zone. »** Le premier
  balayage le disait, et j'allais l'écrire. **1 108 des 1 208 tuiles écartées le
  sont faute de donnée**, la tuile GEBCO z8 correspondante n'existant pas non
  plus : c'est l'Atlantique large, que BlueTopo ne couvre pas davantage. La perte
  réelle est de **≈ 3 650 tuiles z12 sur le talus continental** — dix fois moins
  spectaculaire, et bien plus gênante, parce que c'est le trait le plus raide de
  la côte est.
- ⛔ **« Le problème des Grands Lacs, c'est `SHELF`. »** Non : c'est la ligne
  au-dessus, `raw = m >= 0 ? 0 : m`. Le tuileur n'a **aucune notion de
  `waterLevelM`** (vérifié par `grep`, les tuiles du Léman viennent d'un autre
  script) et **le lac Érié est entièrement au-dessus du niveau de la mer**
  (nappe +174, fond +110). Aucune valeur de `SHELF` ne le sauve. Déclarer la
  zone et lancer le tuileur rendrait **zéro tuile, sans message d'erreur**.
- ⛔ **« La descente meurt parce que les tuiles fines manquent, donc j'aurai des
  404. »** **Zéro 404 sur les quatre zones.** Elle meurt d'un **plafond
  d'index** : hors `fr-metro` / `leman` / `baikal`, le socle `zmax: 8` est la
  butée et `normalizeIndex` la fait respecter. La carte ne cherche même pas. Un
  intégrateur qui cuirait les tuiles **sans ajouter la zone à
  `scripts/bathy-zones.json`** verrait exactement le même relevé qu'aujourd'hui.
- ⛔ **« Mes références externes tranchent. »** Elles sont **partiellement
  circulaires** : `gebco2020` et nos tuiles GEBCO_2026 descendent de la même
  famille, et c'est pour ça que l'écart moyen est si petit. Les deux mesures
  vraiment indépendantes du lot sont **`ned10m`** aux Grands Lacs (176,91 et
  173,80 m — nos deux valeurs **au centimètre**, ce qui prouve qu'on affiche la
  nappe) et **la carte NOAA 12222** à Chesapeake (chenal dragué à 16,8 m, fonds
  naturels 10–14 m, contre **−4,4 m** chez nous). **Un noteur qui reprendrait ma
  colonne « écart » pour conclure « les côtes vont bien » se ferait avoir par ma
  propre méthode** : c'est le ② qui tranche, pas le ①.
- ✅ **Ce que je confirme du socle et de B3** : la cascade est bien vivante sur le
  chemin du globe (14 · 13 · 15 tuiles bathy, zéro 404, une pour une avec
  l'altitude) ; les cinq témoins hors USA sont stables au mètre à z11 **et** z12 ;
  et la lecture au GPU était indispensable — `gl.getError()` a rendu **0** aux
  88 lectures, y compris sur les 0,00 m parfaitement plats des Grands Lacs.

---

## ⑧ RESTE OUVERT — pour Adrien, pas contre l'intégrateur

- ⚠️ **Le canyon du Mississippi (27,5 / −89,5) est écarté par `SHELF` aux trois
  zooms**, alors qu'il est en zone BlueTopo. C'est aussi le deuxième plus gros
  écart de mon tableau (12,7 m). Il mérite une décision explicite, pas un oubli.
- ⚠️ **Le talus continental perd ≈ 3 650 tuiles z12.** Assouplir `SHELF` à
  −3 000 m pour la seule emprise `us-est` est faisable (`--shelf` est déjà un
  argument), mais le coût en octets n'est pas mesuré et `dist/` est à 968 Mo.
- ⚠️ **Les Grands Lacs demandent un second chantier** : une nappe dans
  `build-bathy-tiles.mjs`, une sentinelle « 0 = absence », et une source (NOAA
  NCEI Grands Lacs 90 m, domaine public, déjà cataloguée par B2).
- ⚠️ **`npm run deploy` n'appelle toujours pas `build:bathytiles`** (B3 l'a
  tranché sciemment). Une zone BlueTopo cuite ne survivra que par le disque local
  de la machine qui déploie, et `verifie:dist` est le seul filet.
- ⚠️ **Cook Inlet est un mauvais point de contrôle** : marée de 9 m, chenaux
  étroits, valeur qui bouge de 26 m entre z10 et z12. Je le garde au tableau
  mais je ne l'ai mis dans **aucun** seuil.
- Les relevés bruts : `.banc-bta-usa.json` (88 lectures GPU) et
  `.banc-bta-reseau.json`. Les sondes : `scripts/sonde-bt-a.mjs --scenario
  usa | reseau | vue`. Le comptage `SHELF` se rejoue par
  `node scripts/shelf-bt-a.mjs` (règle `probeWorthIt` recopiée ligne pour ligne).
