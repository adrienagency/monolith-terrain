# RAPPORT BIS — LES BISEAUX DU SOCLE ET LEUR RETRAIT, ÉTEINTS DERRIÈRE UN INTERRUPTEUR

Arbre `C:\Dev\wt-bis`, branche `biseaux-off`, au-dessus de `4199e52` (Fusion VIE).
Serveur `npx vite --host 127.0.0.1 --port 10617`. Chrome sans tête 1280 × 800,
ANGLE, lecture du tampon **dans la même tâche** que `composer.render(0)`, comptage
par différence, témoin à 0 à chaque poste.

> **`npm test` : 5 097 tests · 5 097 réussis · 0 échec** (5 089 avant, +8).
> **`npm run audit:tests` : 282 listés · 282 sur disque, 6 hors suite déclarés, aucun écart.**

> **Adrien, 2026-09-05 (citation, c'est une décision) :** *« Jupe de la mer non
> ok, je pense qu'il y a un problème avec les biseaux de bords. Pour l'instant on
> peut les supprimer pour éviter la problématique. »* — *« On va retirer le
> retrait du biseau qui pose plus de problèmes qu'autre chose. »*

## 0. LES LIGNES QUE JE TOUCHE — pour `wt-gel`, `wt-tro`, `wt-gx4`

| fichier | ce que je touche |
|---|---|
| `src/flags.js` | **neuf** `FLAGS.biseauSocle = false` (après `soleilHeureMonde`) et `biseauSocleActif(recherche)` (`?biseau=1` rallume, `?biseau=0` coupe) |
| `src/plinth.js` | **neuves** `chanfreinSocle()`, `arrondiSocle()` ; défauts de `rayonMurSocle`, `rayonEauDansSocle`, `rayonCoinEau`, `buildSlabWalls` (`chanfrein`, `arrondi`) lus par elles. Les constantes `SOCLE_CHANFREIN = 0.16`, `SOCLE_ARRONDI = 0.9`, `SOCLE_MARGE_EAU = 0.06` **ne bougent pas** |
| `src/monde/parois-crop.js` | **neuves** `fractionChanfreinCrop()`, `fractionArrondiCrop()`, `BANDE_JUPE_MUR = 2 × 0,16 / 56` ; défauts de `construireSolideCrop` ; le solide rend **`retraitJupe`** |
| `src/monde/mer-sphere.js` | **neuve** `retraitEauCrop()` ; `bordDeMer()` et le défaut `retrait` de `construireJupeMer` la lisent. `RETRAIT_EAU_CROP` et `MARGE_EAU_CROP` **ne bougent pas** |
| `src/globe.js` | **une seule assignation, l. 8381–8389** : `this._retraitJupeCrop = Number.isFinite(solide.retraitJupe) ? solide.retraitJupe : (ancienne formule)`. Rien d'autre — `_retraitBaseCrop`, `_plancherJupeCrop`, `poserMer`, `_retaillerJupe`, `_effacementLateralActif`, `_traverse`, `update` : intacts |
| tests | `test/biseau-socle.test.js` **neuf** (8 tests, inscrit) ; en tête de `crop-parois`, `mer-sphere`, `socle-matiere`, `fenetre-bornee`, `ecume-mer`, `damier-bords`, `damier-mer-runtime` : `FLAGS.biseauSocle = true` (ils décrivent le régime allumé, §4) ; `crop-parois` P14 « POSE le retrait » : l'assertion « sans chanfrein → 0 » devient `BANDE_JUPE_MUR` ; `socle-plaque` ② : `_retraitBaseCrop > 0` devient `>= 0` |
| scripts | `scripts/sonde-bis.mjs`, `scripts/sonde-bis-dents.mjs` **neufs** ; `sonde-mer-jupe.mjs` gagne `--adresse` (rétro-compatible) |

Rien dans `branchement-crop.js`, `crop-sphere.js`, `main.js`, les nuanceurs, la file, la caméra.

## 1. LE BISEAU ET SON RETRAIT — CHAQUE CONSTANTE, NOMMÉE ET MESURÉE

Le « biseau » d'Adrien, c'est **trois pièces et deux retraits**, dans deux monnaies :

| pièce | mode plat (`plinth.js`, unités monde, bloc de 56) | crop du globe (fraction, `parois-crop.js` / `mer-sphere.js`) | effet géométrique |
|---|---|---|---|
| **chanfrein** haut | `SOCLE_CHANFREIN = 0,16` | `FRACTION_CHANFREIN = 0,16/56` | facette à 45° sous l'arête ; **le mur rentre de `ch` à toute hauteur** sous elle (rang ① et suivants, `d = ch`) — 0,571 % de la largeur |
| **congé** bas | `SOCLE_ARRONDI = 0,9`, 3 segments | `FRACTION_ARRONDI = 0,9/56` | arc de rayon `rd` : **la base rentre de `ch + rd`** — 3,21 % de plus |
| **retrait de la mer** (haut du rideau et bord de la nappe) | `rayonEauDansSocle() = 28 − 0,16 − 0,06` | `RETRAIT_EAU_CROP = (0,16 + 0,06)/28 = 0,7857 %` du demi-côté | `bordDeMer()` éteint la nappe à `−0,7857 %`, fondu sur autant ; le rideau pend à `k = 1 − 0,7857 %` |
| **retrait de la base du rideau** (P13) | — | `_retraitBaseCrop = (ch + rd)/(largeur/2) = 3,786 %` + marge | rideau conique, son bas 4 % en dedans |
| **bande d'effacement des jupes** (P14) | — | `_retraitJupeCrop = ch/(largeur/2) = 0,5714 %` | jupes de bord effacées dans `1 ± 0,57 %` |
| **marge** | `SOCLE_MARGE_EAU = 0,06` | `MARGE_EAU_CROP = 0,06/28 = 0,2143 %` | ce qui tient l'eau **en dedans du mur** — ⚠️ **ce n'est pas le biseau** |

Relevé vivant, La Réunion z11 (`uCropDemi = 0,000732421875`, 26 000 m), avant :
`_retraitBaseCrop = 0,037857`, `_retraitJupeCrop = 0,0057143`,
`_plancherJupeCrop − _baseYCrop = 0,01382` u (le congé), `uMerBord = (−0,015714 ; −0,007857)`.
Après : **`0` · `0,0057143` · `0` · `(−0,004286 ; −0,002143)`** — le chanfrein et le
congé sont partis, la bande de jupe et la marge sont restées, et c'est voulu (§2).

⚡ **CE QUE LE BISEAU N'EST PAS : le « socle à 60,6 u pour 56 de relief ».** Le brief
me disait que c'était « très probablement le biseau ». **Non, mesuré** : la boîte
horizontale des parois vaut **`56,06` u de bloc avant COMME après** à la Réunion
(`56,18` Bretagne, `56,03` Rodrigues), contre l'emprise de la découpe
(`2·demi·2πR·cos φ` → unités de scène, `× 100/6 371 000`). Le chanfrein et le congé
rentrent **vers l'intérieur** ; le sommet du mur ne bouge pas (« LE SOMMET DU MUR NE
BOUGE PAS », rang ⓪). Le socle n'a donc jamais été plus large que le relief à cause
d'eux, et l'écart de 8–9 % que NUA relevait sur `groupeNuages` **n'est pas ici** —
je le lui laisse, sans l'attribuer.

## 2. L'INTERRUPTEUR — et les deux choses qu'il n'éteint PAS

`FLAGS.biseauSocle = false` par défaut. Éteint :

- **chanfrein 0, congé 0** dans les deux modes : le profil du crop retombe à
  **3 rangs** (surface, bande d'occlusion, fond), le mur est à `d = 0` sur toute sa
  hauteur — `test/biseau-socle.test.js` ③ mesure **0** d'écart horizontal entre le
  rang de surface et les deux rangs sous lui, au bit près ;
- **la mer va à l'arête moins la marge** : `retraitEauCrop() = MARGE_EAU_CROP`,
  `bordDeMer() = (−2 × 0,2143 % ; −0,2143 %)`, rideau droit (`retraitBas = 0 + marge`).

⚠️ **LA MARGE RESTE, ET CE N'EST PAS UN RESTE DE BISEAU.** À retrait nul le rideau
d'eau serait **dans le plan du mur** (conflit de profondeur sur tout le périmètre,
« on voit l'eau à travers le bloc », le défaut du 2026-08-03 que `plinth.js`
raconte), et `bordDeMer` rendrait un fondu de largeur nulle — `smoothstep(a, a, x)`
n'est pas défini en GLSL. 0,06 u sur 56, c'est **0,9 px** au cadrage d'Adrien.

⚠️ **LA BANDE D'EFFACEMENT DES JUPES RESTE (P14).** Sans chanfrein, le mur est à
l'aplomb du bord des tuiles, donc dans le **même plan** que leurs jupes : c'est
l'état d'avant P13, « 7 traînées sur 10 au socle ». Le mur part de la surface
dessinée (P11), la jupe de bord n'a aucun jour à combler : on continue de l'effacer,
sur `BANDE_JUPE_MUR = 2 × 0,16/56` — la largeur qu'avait le chanfrein dans cette
monnaie, pour atteindre les mêmes marches d'anneau que P14 a mesurées. Le solide
publie `retraitJupe` (le chanfrein s'il y en a un, la bande sinon), `globe.js` le lit.

**Rallumé** (`FLAGS.biseauSocle = true` ou `?biseau=1`) : `test/biseau-socle.test.js`
③ bis compare le solide rallumé au solide bâti avec les fractions explicites —
**positions, normales, chanfrein, congé, rangs, baseY, largeur, retraitJupe
identiques au bit près** (`Object.is` sur 21 426 réels) ; ④ bis fait de même sur le
rideau d'eau ; ⑤ sur le socle plat (`n × 11` triangles par point d'anneau, le
compte de `socle-matiere`). Les sept fichiers de tests du régime allumé passent
**inchangés** derrière `FLAGS.biseauSocle = true`, un processus par fichier.

## 3. CE QU'ON VOIT — la capture d'Adrien, rejouée

Pose : `modes.flyTo(−21,115 ; 55,536 ; 11)` (jamais `gotoCtl.go`, DENT §③), vue
35° / cap 45°, 26 000 m, `uCropDemi = 0,000732421875` au bit près des deux côtés.
`.banc/BIS/reunion/AVANT.png` / `APRES.png`, agrandissements ×3 des deux coins mer
`*-zoom-droit.png`, `*-zoom-gauche.png`. ⚠️ `.banc` est ignoré par git.

**Avant** (biseau) : entre la nappe et le mur, une **marche pâle** — la facette du
chanfrein, éclairée, vue à travers le rideau d'eau translucide — bordée d'**un trait
clair** le long de l'arête ; c'est la « jupe rayée de blanc » de sa capture et le
« liseré des parois » de CAR. **Après** : la mer rejoint le mur sur **une droite
franche**, aucune marche, aucun trait ; le coin est une arête vive.

Chiffres, 20 images consécutives (`uMerTemps` +0,137 s), A/B dans la même image,
**témoin 0 px** partout (deux captures du même état) :

| poste | pixels **clairs** (min(r,g,b) > 130) que le MUR change — le liseré | | pixels rouges que le mur ajoute | |
|---|---|---|---|---|
| | avant | après | avant | après |
| Réunion z11 iso | **440** | **371** | 35 159 | 39 342 |
| Bretagne (coin en terre) | 472 | 393 | 31 | 18 |
| Rodrigues 32 849 m (3 chargements) | 415 · 318 | **234 · 269 · 304** | 20 373 · 20 777 | 23 252–23 334 |

⚠️ **JE DIS LA LIMITE DE CE COMPTEUR PLUTÔT QUE D'ÉCRIRE 0.** Le compteur ne
distingue pas la facette du chanfrein du **contour anti-aliasé** du mur contre le
papier pâle (un périmètre de ~1 500 px en donne ~300) : le plancher est là, et
l'écart avant/après (−16 % à −44 %) est la facette. Le rouge **monte** de 10 % après :
la facette pâle est devenue du mur rouge, c'est la même surface. Et le compteur
« clairs dans ce que le rideau change » (136 → 160 à la Réunion) **ne mesure pas les
bandes** : il compte de l'écume et de l'eau claire dans une zone qui a changé de
forme. Le critère « bandes blanches = 0 » est tenu **à l'œil sur les agrandissements**,
pas par un compteur que je puisse défendre — je préfère l'écrire.

## 4. LES ACQUIS TIENNENT — MER2, SOC, CULL

**MER2 rejouée** (`sonde-mer-jupe.mjs --adresse`, Réunion 26 000 m, 2 postes ×
20 images) :

| | hors arête max / total | témoin `chop = 0` | attribuable à la houle |
|---|---|---|---|
| avant (`?biseau=1`) | 1 px / 20 px | 1 px | 0 |
| après | 227 px / 8 305 px | **227 px** | **0** |

⚡ **Le témoin vaut la mesure, donc rien n'est la houle** — c'est exactement l'usage
que MER2 a écrit pour ce témoin. Ce que la sonde compte après, c'est **le liseré
d'un pixel** de la rasterisation du bord : la nappe s'arrête désormais à **0,9 px** de
l'arête (la marge) au lieu de 3,4 px, et ±1 px de bord sur un périmètre de ~800 px
donne ces 227 px (0,6–0,7 % d'une silhouette de 30–37 k px). Par construction, aucun
sommet dessiné ne dépasse `1 − marge` (le rideau) ni `dBord > −marge` (le fragment) —
`biseau-socle` ④ le tient, `mer-sphere` ⑰a/⑰b aussi (rallumé).
« La mer au large » : bande visible sur 2,2–2,7 % de la nappe, témoin 0, comme MER2.

**SOC** : parois pleines, `provisoire: false` aux six postes, `_effacementLateralActif`
intact, bande de P14 active (`_retraitJupeCrop = 0,0057143` des deux côtés).
**CULL** : `_retaillerJupe` n'a pas bougé d'une ligne ; les jupes de bord sont
effacées sur la même bande — le domaine « un mur bâti pour CE repère » est le même.

## 5. LES TESTS MORDENT — huit mutations, `src/` seul, sources restaurées au md5

| mutation | rouges dans `biseau-socle` |
|---|---|
| `biseauSocle: true` | ① ② ③ ③bis ④ ④bis ⑤ ⑥ |
| `fractionChanfreinCrop` rend toujours `FRACTION_CHANFREIN` | ② ③ ③bis ⑥ |
| `retraitEauCrop` rend toujours `RETRAIT_EAU_CROP` | ④ ④bis |
| `retraitJupe` rend 0 sans chanfrein | ③ ⑥ |
| `chanfreinSocle` rend toujours `SOCLE_CHANFREIN` | ② ⑤ |
| `bordDeMer` lit `RETRAIT_EAU_CROP` | ④ |
| `construireJupeMer` : défaut `RETRAIT_EAU_CROP` | ④bis |
| `globe.js` ignore `solide.retraitJupe` | ⑥ |

Aucune survivante. Chaque test a été rougi par au moins une.

## 6. CE QUE J'AI VU ET QUI N'EST PAS LE BISEAU — pour `wt-tro`

- ⚡ **Les dents rouges de Rodrigues** (`.banc/BIS/rodrigues-c130/planche-bord-gauche.png`) :
  sur 5 chargements à la même pose, **2 montrent des parallélogrammes rouges** le
  long du bord — la paroi qui apparaît là où la nappe est en marches — et **l'un
  des deux est `AVANT2`, biseau ALLUMÉ**. Ce sont les « rectangles rouges dans la
  mer du crop » de la vidéo 2 (`q_038`), le terrain de `wt-tro` ; le biseau ne les
  crée ni ne les cache. Leviers rejoués dans la même page (`sonde-bis-dents.mjs`,
  état sain) : parois `FrontSide`, rideau caché, mer cachée — le rouge ajouté par
  les parois ne bouge que de 0,4 % ; il vient des parois seules (× 3,7 tuiles cachées).
- **Une bande bleue au coin** (`.banc/BIS/reunion-c130/APRES-zoom-coin.png`), vue
  **une fois**, sur un chargement qui a mis 148 s à se stabiliser et a atterri à
  z12 au lieu de z11. Rejouée au centre de cette capture (−21,26 / 55,74, z12,
  `planche-coin.png`) : **absente**, avant comme après. Non attribuée, non reproduite.
- Le `socleEnU56` de 56,03–56,18 (§1) : l'écart de NUA n'est pas dans les parois.

## 7. CE QUE J'AI CRU, PUIS RÉFUTÉ

1. ⛔ « Le 60,6 u, c'est le biseau » (le brief) — non, 56,06 avant comme après (§1).
2. ⛔ « Retrait 0 = mer à l'arête » — non : rideau coplanaire au mur et `smoothstep`
   dégénéré. La marge de `plinth.js` est la définition de « où finit le bloc pour
   l'eau », elle survit (§2).
3. ⛔ « Sans chanfrein, plus rien à couper » (le test P14 l'écrivait) — faux : le mur
   vertical est dans le plan des jupes ; on garde la bande (§2).
4. ⛔ « Les dents rouges sont le biseau éteint » — `AVANT2` les montre biseau allumé (§6).
5. ⛔ « 227 px hors arête = régression MER2 » — le témoin `chop = 0` rend les mêmes 227 (§4).
6. ⛔ « Un chargement suffit » — la Réunion `APRES` du premier tour a atterri à z12 ;
   j'ai rejeté la paire et rejoué (`APRES2`, `uCropDemi` égal au bit près).

## 8. À DONNER AUX AUTRES

- `?biseau=1` rend le régime d'avant **sans toucher au code** — c'est l'A/B à témoin
  nul de la règle D13, dans la même page.
- `sonde-bis.mjs` : pose de la capture d'Adrien, A/B rideau / parois, témoin,
  géométrie publiée, PNG ; `sonde-bis-dents.mjs` : leviers un par un au même poste.
- **À `wt-tro`** : les dents rouges de Rodrigues sont chez toi, et elles sont
  indépendantes du biseau (§6).
- Le jour où Adrien rallume le biseau, la seule chose à réparer est **la facette
  du chanfrein vue à travers l'eau** — la marche pâle et son trait — pas le retrait.
