# B5 — LES PLATEAUX DE PORQUEROLLES : LE ZÉRO DE MER DU TERRARIUM EST UN BRUIT

Arbre `C:\Dev\wt-bat3`, branche `bathy-correctif` (après `git merge regroupement`).
Serveur `npm run dev -- --host 127.0.0.1 --port 6311`.

⚠️ **POUR LA FUSION À LA MAIN — fichiers touchés.** Le tuileur, `dem.js`,
`bathy-sources.js` et l'index ne sont **pas** touchés. Le correctif est dans
**`src/bathy.js`** (quatre blocs : `NOISE_BAND` / `NOISE_MIN_DEPTH` /
`detectNoiseFill` ajoutés après `detectFillLevels` ; dans `fuseBathymetry`,
`bruitZero`, `bruit`, et le fondu `seul = noData || sousNappe`), dans
**`test/bathy.test.js`** (un contrat réécrit, un ajouté) et
**`test/bathy-platier-b5.test.js`** (nouveau, inscrit dans `package.json`).
`globe.js` a porté une sonde de débogage pendant la mesure ; **son diff est
vide** au commit.

**`npm test` → 4 764 · 0 échec · 2 sautés** (4 755 avant B5 ; le fichier
`bathy-platier-b5` ajoute 8 tests, `bathy.test.js` un ; `audit:tests` 254 = 254,
aucun écart). **`attaque-b1-ROUGE` : 4 verts
/ 3 rouges — les mêmes qu'avant. `attaque-b3-REANCRE` : 5 / 5. Manche z10 :
−72,0 m, inchangée.**

---

## ⚡ LA CAUSE, À LA LIGNE

**Le terrarium (Mapterhorn, servi en `.webp`, donc lossy) ne remplit pas sa mer
à zéro pile : il la remplit à zéro ± 0,5 m, étalé sur plusieurs valeurs, des
deux côtés du zéro.** Là où ce bruit est **positif** (+0,2 … +0,5 m), la fusion
le classe TERRE — « un aplat POSITIF est de la terre », `bathy.js`, encart de
`detectFillLevels` — et **ne lit même pas la source fine** : `h = +0,3` sort tel
quel, `h > 0`, le nuanceur peint la première teinte de terre. Le rectangle est
l'emprise de ce remplissage positif ; la mer sombre commence là où il retombe à
0 pile, seul cas que `NODATA_EPS` attrape.

**La preuve n'est pas un raisonnement, c'est un transect** (`scripts/transect-b5.page.js`,
tuile `z13/4237/3010`, colonne 159, nord → sud, un échantillon tous les 8 texels) :

```
terrarium BRUT  : 0.9 1.3 0.6 0.4 0.4 1.6 2.6 3.2 5.1 8.5 11.2 15.9 23.7 … 51.2 18.8
                  | +0.5 +0.2 +0.3 +0.4 +0.4 +0.4 +0.3 +0.3 +0.3 +0.4 +0.4 +0.2 +0.2 +0.2 +0.4 +0.5 +0.3 |  0 0 0 0 0 0 0 0 0
                  |<────────────── ~1 km de MER remplie à +0,2…+0,5 m ─────────────>|<─ 0 exact ─>
fusion AVANT     :  (l'île)  … 18.8 | 0.5 0.2 0.3 0.4 0.4 0.4 0.3 0.3 0.3 0.4 0.4 0.2 0.2 0.2 0.4 0.5 0.3 | −78.3 −79.6 −80 −79.8 −80.1 −82 −84.1 −85.4 −86.5
fusion APRÈS     :  (l'île)  … 18.8 | 0.5 0.2 −3.8 −9 −11.4 −16 −27.6 −39.5 −47.7 −53.7 −57.3 −59.7 −61.6 −63.6 −66.6 −70.1 −74.6 | −78.3 −79.6 −80 …
```

Avant : la source fine (EMODnet, −80 m) ne s'exprime **que** sur le 0 exact ; le
kilomètre de « +0,3 » est rendu à +0,3, c'est-à-dire en terre. Après : le talus
descend en continu de la côte au fond. Les deux premiers échantillons (+0,5 ;
+0,2) restent : ce sont les cellules EMODnet **à cheval sur le rivage** (> −2 m),
et c'est voulu — voir la garde.

Les remplissages **négatifs** déjà relevés dans le dépôt (−0,094 / −0,344 /
−0,406 m à La Ciotat et Nice, −2,781 à Brest) sont **le même bruit, de l'autre
côté du zéro** : « les plateaux rectangulaires à ras de l'eau » de la session
du 2026-07-28 et « les carrés plats » d'Adrien sont **un seul défaut**, et il
n'était réparé que pour les valeurs négatives qui tenaient 10 % à elles seules.

### Ce que les trois défenses ne voyaient pas

| défense | ce qu'elle attrape | pourquoi elle rate Porquerolles |
|---|---|---|
| `NODATA_EPS = 1/512` | le zéro **exact** | +0,3 n'est pas 0 |
| `detectFillLevels` | **une** valeur tenant ≥ 10 % du champ immergé | le bruit est étalé sur 0,2 / 0,3 / 0,4 / 0,5 — et il ne regarde que `l < level` |
| « un aplat positif est de la terre » | protège les plaines littorales | c'est la règle qui **fabrique** le plateau |

---

## ② LE CORRECTIF — `src/bathy.js`, deux règles, toutes deux gardées par la PART

**1. Quand la référence est muette, la source fine parle entière.** Le fondu
`t = smooth(|deep| / 25)` était piloté par la profondeur de la source fine
elle-même sur un pixel muet : à −1 m, `t = 0,5 %`, sortie ≈ −0,005 m, arrondi
Int16 (« les demis vont du côté de la terre ») → **0 → terre**. Sur un pixel
muet il n'y a pas de rivage à raccorder ; désormais `t = 1`, borné par
`deep ≤ −SEA_EPS` (elle ne peut toujours pas émerger). La référence **bavarde**
garde le fondu d'origine au bit.

**2. La bande de bruit** (`NOISE_BAND = 0,6 m`, `NOISE_MIN_DEPTH = 2 m`,
`detectNoiseFill`). Parmi les pixels que la source fine dit **franchement
immergés** (< −2 m), on compte la part qui tombe dans `|h − niveau| ≤ 0,6 m`.
Au-delà de `FILL_SHARE` (10 %, le même seuil que les aplats) et de
`FILL_MIN_SONDES`, la bande est un remplissage : ses pixels sont une **absence**,
signe compris. C'est la signature des aplats — **la part, pas la valeur** —
appliquée à une bande au lieu d'une valeur.

⚠️ **Ce qui ne bouge pas, et pourquoi** :
- la bande fait 0,6 m : au-dessus du bruit mesuré (0,2 … 0,5 ; 0,094 … 0,406),
  sous toute plage réelle et loin d'un polder à −4 / −6 m ;
- elle n'agit **que** là où la source fine dit < −2 m : une cellule EMODnet à
  cheval sur le rivage rend −1 ou −2 m sous une vraie plage à +0,3 m, et cette
  plage **reste de la terre** (`test/bathy-platier-b5.test.js`, « une VRAIE
  bande côtière ») ;
- une bande qui n'atteint pas 10 % — un trait de côte, pas un champ — ne
  déclenche rien ;
- **le chemin sans bruit est identique au bit** : `bruitZero` faux ⇒ aucune
  branche nouvelle n'est prise.

⛔ **Un contrat existant a été réécrit, et c'est dit** : `test/bathy.test.js`
« un aplat POSITIF reste de la terre » exigeait qu'une plaine rigoureusement
plate à +0,25 m **posée sur 900 m d'eau** reste de la terre. C'est le défaut
lui-même, en test. Il exige maintenant qu'elle reste de la terre quand la source
fine ne la dit **pas franchement immergée** (cellules à −1,5 m), et un second
test exige qu'à −900 m elle soit rendue à la mer.

---

## ③ LES CINQ VUES, EN PIXELS — `scripts/sonde-b5.mjs`, damier 1536², z12 et z13

**La grandeur** : pixels que le terrarium brut donne ≤ 0 (mer ou absence) et que
la fusion rend **≥ 0** — c'est-à-dire de la terre pour le nuanceur (`sousEau`
faux). ⚠️ Pas une moyenne de profondeur : l'erreur en mètres est de 0,3 m, le
défaut est en pixels.

| vue | zoom | AVANT | après ① (fondu) | **APRÈS ①+②** | recul |
|---|---|---|---|---|---|
| Porquerolles | z12 | 76 903 | 64 797 | **16 546** | **−78 %** |
| Porquerolles | z13 | 131 010 | 129 898 | **17 496** | **−87 %** |
| Port-Cros | z12 | 107 015 | 105 669 | **13 691** | **−87 %** |
| Port-Cros | z13 | 186 380 | 185 067 | **18 310** | **−90 %** |
| Le Levant | z12 | 83 309 | 82 243 | **9 402** | **−89 %** |
| Le Levant | z13 | 109 722 | 105 340 | **13 229** | **−88 %** |
| Marseille / Frioul | z12 | 181 250 | 180 923 | **20 602** | **−89 %** |
| Marseille / Frioul | z13 | 300 599 | 300 168 | **18 599** | **−94 %** |
| Hyères large | z12 | 107 015 | 105 669 | **13 691** | **−87 %** |
| Hyères large | z13 | 124 772 | 124 772 | **13 869** | **−89 %** |

⚡ **La colonne du milieu est la preuve que le fondu n'était pas la cause
principale** : il ne rendait que 1 à 16 % des pixels. C'est la bande de bruit
qui rend le reste. Ce qui reste (9 000 – 20 000 par bloc, 0,4 – 0,9 %) est
l'anneau des cellules EMODnet **à cheval sur le rivage** (> −2 m), que la garde
laisse volontairement au terrarium.

**Compte des zéros exacts** — « des milliers de zéros pile, ce n'est pas une
coïncidence » : avant, **77 903 à 300 599** pixels du damier valaient 0,000 pile
en mer ; ce sont ces +0,2 … +0,5 m que l'Int16 du damier arrondit à 0. Le
compte tombe à 9 402 – 20 602.

### Avant / après à l'écran

`.banc/B5/porquerolles-avant.png` : l'île entourée d'un socle pâle et plat en
rectangles, le halo de côte sur le bord du rectangle, la mer sombre au-delà.
`.banc/B5/porquerolles-apres-B.png` et `marseille-apres-B.png` : l'île pose sur
un talus continu, le halo suit la côte, la mer commence à la côte.

---

## ④ AUCUN RIVAGE N'A BOUGÉ — `scripts/rivage-b5.page.js`

Terre vraie = terrarium brut **≥ 2 m** (Int16, au-dessus de la bande arrondie).
« Noyée » = terre vraie rendue < 0 par la fusion. « Émergée » = mer / absence
rendue ≥ 0 (le plateau).

| vue | zoom | terre vraie | **NOYÉE** | mer / absence | émergée |
|---|---|---|---|---|---|
| Porquerolles | z12 · z13 | 100 980 · 276 886 | **0 · 0** | 2 153 702 · 1 806 036 | 16 546 · 17 496 |
| Port-Cros | z12 · z13 | 248 215 · 215 105 | **0 · 0** | 1 982 841 · 1 927 886 | 13 691 · 18 310 |
| Le Levant | z12 · z13 | 157 468 · 209 991 | **0 · 0** | 2 092 260 · 1 947 035 | 9 402 · 13 229 |
| Marseille / Frioul | z12 · z13 | 1 161 041 · 96 422 | **0 · 0** | 1 151 676 · 2 148 402 | 20 602 · 18 599 |
| Hyères large | z12 · z13 | 248 215 · 136 242 | **0 · 0** | 1 982 841 · 2 092 508 | 13 691 · 13 869 |
| **Polders (Flevoland)** | z12 · z13 | 14 529 · 9 706 | **0 · 0** | 2 333 111 · 2 343 957 | 55 649 · 56 159 |

**Zéro pixel de terre vraie noyé, sur douze vues, polders compris.**

⚠️ **Les polders, à dire précisément.** Le Flevoland est à −6 m dans le
terrarium — donc « mer » pour un test sur le signe, et c'est le masque de côte
(`uCoastMask`, `sousEau = landness < 0.5 && …`) qui le tient en terre à l'écran,
pas la hauteur. Ce qui a changé : à z13, `detectFillLevels` reconnaît −6 comme
un aplat (il tient 10 % du champ), la référence est donc muette, et le fondu
d'origine rendait **1 745 070 pixels à 0** (source fine −2 … −4 m de l'IJsselmeer,
muselée à 0,4 %) ; avec la règle ① ils sortent à −2 … −4 m, **cohérents avec
z12** qui les rendait déjà à −6. La règle ② ne les touche pas (−6 est hors bande).

---

## ⑤ LE TUILEUR N'EST PAS EN CAUSE — la piste n° 1 du brief, réfutée par le compte

`scripts/zeros-b5.mjs`, sur les tuiles **cuites** de la bbox d'Hyères et de
Marseille (toutes présentes, aucune absente — la piste n° 2 tombe aussi) :

| emprise | z | tuiles | pixels = 0 | pixels < 0 | **dans ]−1 ; 0[** |
|---|---|---|---|---|---|
| Hyères | z10 | 4 / 4 | 102 364 | 159 780 | **515** |
| Marseille | z10 | 4 / 4 | 147 097 | 115 047 | **849** |

Les 100 000 zéros d'une tuile sont **la terre** (le marqueur du tuileur) ; le
platier écrasé par la quantification à 1 m tient en **515 à 849 pixels par
groupe de quatre tuiles**, contre **77 000 à 300 000 pixels de plateau par
bloc**. Deux ordres de grandeur : l'encodage n'est pas le problème de fond, et
**il n'y a rien à recuire — zéro octet**. Le coût de la recuisson demandée par
le brief est donc nul, et la valeur sentinelle qu'il proposait n'aurait pas
touché un seul de ces pixels (ils viennent du terrarium, pas de nos tuiles).

---

## ⑥ CE QUE J'AI CRU, PUIS RÉFUTÉ — dans l'ordre où je l'ai payé

- ⛔ **« C'est la quantification du tuileur (piste 1) »** — 515 à 849 pixels par
  groupe de tuiles. Compté avant de coder, et c'est ce qui a évité une recuisson
  de fr-metro pour rien.
- ⛔ **« C'est le fondu qui musèle le platier »** — vrai, corrigé, et **ce n'était
  que 1 à 16 % des pixels**. J'ai failli m'arrêter là : le test unitaire était
  vert, les zéros avaient baissé de 16 %, l'image n'avait pas bougé. C'est le
  compte en pixels, pas le test, qui a dit « continue ».
- ⛔ **« Les rectangles sont des tuiles de zoom grossier restées visibles sous
  les fines »** — cacher `mesh.visible` n'a rien changé, et pour cause :
  `_traverse` remet `visible` à chaque image. Puis, en cachant le **matériau**
  (qui survit), rien non plus : les tuiles grossières n'y étaient pour rien.
- ⛔ **« C'est le champ de la mer / du fond (384², cuit une fois) qui est resté
  grossier »** — `uMerChamp` et `uFondChamp` relus au CPU : 1 zéro sur 148 225,
  −80 … −150 m sur le plateau, exactement `_fondCrop.valeurs`. Faux.
- ⛔ **« C'est la lame d'eau (glacis de rivage, `champ.g`) »** — eau rendue
  transparente (`uMerSeuilEau`), le plateau reste. Faux.
- ⛔ **« C'est le masque de côte »** — lu **au GPU** par `readPixels`, pas
  seulement au CPU : 2048², **0 % de terre** (l'arbre n'a pas `coast-z6`, le
  masque z13 est vide). Pourtant `sousEau` sortait faux… parce que ma sonde de
  débogage lisait **la trame composée**, où la lame d'eau et l'écume
  recouvrent les couleurs du nuanceur. Une sortie de débogage dans le
  nuanceur ne vaut que si rien ne se dessine par-dessus. Deux heures.
- ⛔ **« Les bords en escalier sont les terrasses de 4 m de la quantification
  EMODnet »** — le champ du fond n'a que **0,2 % de cellules plates**
  (Catmull-Rom les efface). Faux.
- ⛔ **« `land-10m.json` fera la vérité terrain »** — il ne contient **pas
  Porquerolles** (1:10 M), et donne 12 à 29 % de « terre sur mer » avant comme
  après. La vérité qui tient est le terrarium brut lui-même : ≥ 2 m = terre,
  ≤ 0 = mer ou absence. Le brief le suggérait ; c'est faux à cette échelle.
- ✅ **Ce qui a tranché** : lire la **texture de la tuile au GPU** et le
  **terrarium brut redemandé à sa source**, au même texel, sur un transect. Une
  colonne de 64 nombres a dit ce que vingt captures n'avaient pas dit.
- ✅ **Ce que je confirme du brief** : « des milliers de zéros exacts, ce n'est
  pas une coïncidence » — c'étaient des +0,2 … +0,5 arrondis à 0 par l'Int16.
  L'intuition était juste, le signe était faux, et c'est le signe qui faisait
  que rien ne les attrapait.

---

## ⑦ RESTE OUVERT

- ⚠️ **L'anneau des cellules à cheval** (> −2 m d'EMODnet, 9 000 – 20 000 pixels
  par bloc) reste au terrarium — c'est la garde qui protège les vraies plages.
  Il n'est plus rectangulaire (il suit la côte à 115 m), mais il existe.
- ⚠️ **Le bruit `.webp` de Mapterhorn est une propriété de la source**, pas de
  ce dépôt : 0 ± 0,5 m en mer, et probablement autant sur terre — inoffensif
  là. Une source servie en PNG n'aurait pas ce défaut ; le coût serait le poids.
- ⚠️ `coast-z6` est absent de cet arbre (jonction non faite) : mes mesures de
  masque sont celles d'un masque vide. Le défaut est indépendant du masque
  (prouvé masque forcé à 0), mais un noteur qui rejoue dans un arbre **avec**
  `coast-z6` verra un halo de côte différent — pas le plateau.
- Les sondes restent : `scripts/sonde-b5.mjs` (compte en pixels),
  `scripts/rivage-b5.page.js` (rivage), `scripts/transect-b5.page.js` (le
  transect brut / fusion), `scripts/capture-b5.mjs --eval` (une vue, un état).
