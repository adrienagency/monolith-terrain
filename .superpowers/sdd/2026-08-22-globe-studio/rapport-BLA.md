# BLA — LE TERRAIN BLANCHIT AU ZOOM FIN (mode « Naturel »)

Branche `blanc-fin`, arbre `C:\Dev\wt-bla`, serveur Vite `127.0.0.1:9711`.
`npm test` : **5 015 · 0**. `npm run audit:tests` : *aucun écart* (272 listés,
272 sur disque). **12 mutations posées, 12 tuées.**

---

## LA RÉPONSE À ADRIEN, EN FRANÇAIS SIMPLE

**C'est la perspective aérienne.** Son voile « d'altitude » (les basses terres
qui se voilent de gris-bleu) mesurait « bas » et « haut » **sur le morceau de
relief chargé** : quand tu descends d'un cran, ce morceau rétrécit, la moitié
de la vallée devient « basse » et le voile la repeint en gris-blanc. Ce n'est
pas une couche en plus, c'est le même réglage lu dans une échelle qui bouge —
**exactement le défaut de la rampe de RAMP, dans l'autre mode.** La rampe fixe
d'hier ne le couvrait pas : elle n'avait transposé que le pivot et le contraste.

**Maintenant** le voile d'altitude et la limite des arbres lisent le **même
carré de 40 km** que la rampe fixe, à tous les crans ; la brume de distance
compte **en kilomètres réels** (plus en « moitiés de bloc ») ; et ce carré est
posé **sur le lieu** et non sur le centre du bloc, qui à z9 était à 20 km. Le
même point du sol garde la même couleur de z9 à z13 : **0,3/255 en luminance,
2,3/255 en chroma** (rejoué depuis les uniformes vivants), contre 8,9 et 55,9
avant.

⚠️ **Un blanchiment de la vidéo n'est PAS celui-ci** : le brun de `m_010` /
`m_098` est l'image **sans** rampe de crop (la mesure n'a pas encore atterri :
pas de voile du tout), le pâle de `m_020` / `m_070` est l'image **avec**. Le
correctif rend le « avec » stable ; l'instant où il remplace le « sans » est la
latence de pose de la rampe (§⑧), et ce n'est pas ce chantier.

---

## ① LE COUPABLE, PAR EXTINCTION — un uniforme à la fois, même session

`scripts/diag-bla-extinction.mjs`, Provence 44,2 / 5,78 (le lieu de la vidéo),
curseurs de la vidéo (texture 0,98, humidité 0,88, exposition 1, limite des
arbres 0,99, **perspective aérienne 0,68**), chemin fixe z9 → z11 → z13 par
`modes.flyTo`, animations coupées, **témoin à 0,0 / 0,0** (deux captures sans
rien changer). Fenêtre centrale 36 % × 44 % de l'écran, luminance Rec. 709 et
chroma (max − min) moyennes, en niveaux/255. `.banc/BLA/avant/extinction.json`.

| candidat | on éteint | z9 Δlum · Δchroma | z11 | z13 |
|---|---|---|---|---|
| **① perspective aérienne** | `hazeAmt` → 0 | **−21,7 · +25,1** | **−9,4 · +5,7** | **−5,0 · +4,2** |
| ② humidité + exposition | `wetK`, `expoK` → 0 | −2,0 · +3,1 | −2,3 · +2,7 | −2,1 · +2,3 |
| ② bis limite des arbres | `treeLine` → 0,2 | −0,4 · +0,6 | −2,2 · +2,6 | −2,0 · +2,2 |
| ③ éclairage / peigné cuit | `texShade` → 0 | −7,3 · +0,5 | −0,3 · +4,6 | +2,9 · +4,2 |

➡️ **Le voile est le seul poste qui bouge de plus de 5 niveaux, et sa force
dépend du cran.** ② est réel mais quatre à huit fois plus petit ; ③ change la
luminance (c'est un ombrage), pas la chroma — ce n'est pas un blanchiment.

⚡ **ET C'EST LE GLOBE QUI PEINT, PAS LE SOCLE** : `terrain.mesh.visible` vaut
`false` sous le crop, cacher le socle ne change **aucun** pixel (essai G), et
éteindre le voile du globe seul (essai F) rend **le même chiffre** que
l'éteindre par le panneau. Le socle est corrigé aussi (il peint hors crop), mais
la vidéo, c'est `globe.js`.

---

## ② LE MÉCANISME — chiffré, pas déduit

`natVoile` (naturel-crop.js) : `fa = 1 − smoothstep(0, hazeAlt, hNorm)`, et
`hNormRelief = (h − uReliefBas) / (uLandMax − uReliefBas)` — le domaine
**vivant** du crop, mesuré sur l'emprise. Relevé au même lieu :

| cran | `[uReliefBas ; uLandMax]` | amplitude | `hNorm` de 1 000 m | `fa` | voile au centre |
|---|---|---|---|---|---|
| z9 | [19 ; 3 792] | 3 772 m | 0,26 | 0,47 | 0,19 |
| z11 | [358 ; 1 770] | 1 412 m | 0,45 | 0,04 | 0,02 |
| z13 | [529 ; 1 614] | 1 085 m | 0,43 | 0,05 | 0,02 |

**Le même point à 1 000 m** reçoit un voile de 0,19 ou de 0,02 selon le cran.
Et le sens s'inverse selon le lieu : sur un crop qui s'effondre sur une vallée,
tout le fond passe sous `hazeAlt` — c'est le blanc de `m_070`. La limite des
arbres (`veg = 1 − smoothstep(treeLine, treeLine + 0,18, hNorm)`) a le même
défaut, en plus petit.

---

## ③ LE CORRECTIF — la correction de RAMP, appliquée aux deux lecteurs restants

**Une conversion affine `hNorm` vivant → `hNorm` de référence**, posée dans les
deux nuanceurs devant `natHumiditeY` et `natVoile` (`natHNormRef`, une seule
écriture GLSL dans `naturel-crop.js`, jumeau JS `hNormRef`) :

    h        = basVivant + hNorm × ampVivant
    hNormRef = (h − basRef) / ampRef = hNorm × a + b
    a = ampVivant / ampRef · b = (basVivant − basRef) / ampRef      (rampe-fixe.js, facteursHNormRef)

**Le facteur, chiffré au lieu de la vidéo** (référence [362 ; 1 823] m) :
`a` = **2,58 à z9**, 0,97 à z11, **0,74 à z13** — relevé vivant après pose :
`uHNormRefA` = 2,274 / 0,966 / 0,742 (le domaine du globe diffère de 1 % de
celui du socle, `uReliefBas` ≠ `dem.minM`).

**Où ça s'écrit — et par qui** :
- globe : `_majGradeBloc`, **l'écrivain unique** de GRA (rappelé par
  `poserHabillage` ET par `_poserUniformesRampe`, donc à chaque glissement
  du domaine par image) ; la référence traverse `contexteCrop` → `refBasM` /
  `refAmpM` (surveillés par la veille, `CHAMPS_HABILLAGE`) ; `retirerHabillage`
  rend (1, 0).
- socle : `appliqueRampeFixe` (les quatre rendez-vous de RAMP), avec le test
  d'égalité élargi aux trois uniformes, puis `diffuseDuCentre` ; `block-grid`
  copie aux 24 dalles voisines.

**La brume de distance en mètres** : `fd = (d / demi) × uFdFacteur`,
`uFdFacteur = demiM / DISTANCE_VOILE_M` — globe `uCropDemiM` (l'espace du
**crop**, `largeurCropM / 2`, pas `R_GLOBE`, pas la caméra d'effets), socle
`dem.extentMeters / 2`. `DISTANCE_VOILE_M = 80 km`, **mesuré** (§④).

**La référence centrée sur le LIEU** (`centrerFenetreRef`, `majRampeRef`) :
le bloc central est aligné sur les tuiles — son centre est à **44,34 / 5,98 à
z9, 20 km du lieu** (`scratchpad/sonde-ref.mjs`) — et le carré de 40 km de
RAMP, « centré » sur le MNT, valait **[444 ; 2 103] à z9 contre [362 ; 1 823]
à z11**. Il est désormais centré sur `dem.lat / dem.lon` par `latLonToWorld`
et écrêté dans le MNT. ⚠️ Ça déplace aussi la rampe de RAMP à z9 et z10 — dans
le bon sens : la même référence qu'à l'arrivée.

⛔ **Sans référence (option « Re-normaliser » cochée, banc, test, MNT pas
chargé) : `a = 1`, `b = 0`, `uFdFacteur = 1` — `x × 1.0 + 0.0` est `x` au bit
en IEEE 754, vérifié par `Object.is`.** Le mode Classique ne passe pas par ces
lignes (`uColorMode == 1` côté socle) ; le pivot de rampe ne passe pas par
`natHNormRef` (GRA et RAMP le transposent déjà, un test l'interdit).

---

## ④ LE CRITÈRE — le même point du sol, z9 → z13

⛔ **La moyenne d'écran ne juge pas** (RAMP §②, GRA §①⓹) : un cran change le
cadrage. Le juge est `scripts/diag-bla-loi.mjs` : la loi du nuanceur
(`natHNormRef → natVoile → natBrume`, et `natHumiditeY`) rejouée depuis les
**uniformes relevés** à chaque cran, pour une altitude et une distance au centre
fixes, sur la couleur de base #c99f66. `.banc/BLA/loi.json`.

| altitude · distance | AVANT — chroma par cran (z9 / z11 / z13) | étendue | APRÈS | étendue |
|---|---|---|---|---|
| 600 m · 0 | 51,9 / 55,4 / 38,9 | 16,6 | 51,1 / 53,3 / 53,3 | **2,2** |
| 800 m · 5 km | 59,5 / 73,1 / 17,2 | **55,9** | 61,1 / 82,7 / 82,7 | 21,6 → voir ⚠️ |
| 1 000 m · 0 | 76,9 / 120,1 / 117,5 | 43,2 | 116,8 / 117,7 / 117,7 | **0,9** |
| 1 200 m · 5 km | 86,4 / 102,2 / 50,6 | 51,7 | 114,7 / 117,1 / 117,1 | 2,3 |
| 1 400 m · 0 | 104,3 / 122,6 / 122,6 | 18,3 | 122,6 / 122,6 / 122,6 | **0,0** |
| **pire étendue** | **luminance 8,9 · chroma 55,9** | | **luminance 0,3 · chroma 2,3** | |

⚠️ La ligne 800 m · 5 km est celle **avant le recentrage** (référence z9 ≠
z11) ; après recentrage le tableau complet tient sous **0,3 / 2,3** — c'est le
chiffre du `PIRE ÉTENDUE` final. **Critère du brief : ≤ 8 · ≤ 4. Tenu.**

**Les captures pour Adrien** — `.banc/BLA/{avant,apres}/z{9,11,13}-A-tel-quel.png`
(la vidéo : `m_010` ↔ z9, `m_070` ↔ z13), et les extinctions `-B-haze0` etc.
Moyennes d'écran, à titre indicatif seulement :

| | z9 | z11 | z13 | effet du voile (z9 / z11 / z13) |
|---|---|---|---|---|
| avant | lum 175 · chroma 28,7 | 165 · 24,8 | 152 · 22,6 | Δchroma +25,1 / +5,7 / +4,2 |
| après | lum 156 · chroma 35,4 | 157 · 30,2 | 142 · 26,9 | +13,0 / +1,0 / −1,2 |

**La borne de distance — trois candidats, même session** (`diag-bla-distance.mjs`,
chroma de la fenêtre centrale) :

| zoom | demi-crop | D = 20 km | D = 40 km | **D = 80 km** | sans distance | voile éteint |
|---|---|---|---|---|---|---|
| z9 | 84 km | 20,4 | 29,8 | **39,0** | 52,0 | 57,7 |
| z11 | 21 km | 22,2 | 26,6 | **28,1** | 29,0 | 28,9 |
| z13 | 5,3 km | 26,5 | 26,9 | **27,0** | 27,2 | 25,8 |

⛔ **20 km — mon premier choix, « la demi-emprise d'arrivée » — grisait la vue
large** (52 → 20 à z9) : 95 % de l'emprise à pleine brume, sur la « belle carte
bien définie » de `m_010`. 80 km est la demi-emprise la plus large du crop : la
vue large garde son image (facteur 1,05), les vues fines en ont moins — à z13
le bord est à 5 km.

**Les curseurs gardent leur sens** (jumeaux JS, référence [358 ; 1 823]) :

| « Perspective aérienne » | 0 | 0,2 | 0,4 | 0,68 | 1 |
|---|---|---|---|---|---|
| voile à 600 m, au centre | 0 | 0,089 | 0,179 | 0,304 | 0,447 |

| `hazeAlt` (caché) | 0,2 | 0,3 | 0,4 | 0,5 | 0,6 | 0,8 |
|---|---|---|---|---|---|---|
| altitude où le voile s'éteint | 651 m | 798 | 944 | **1 091** | 1 237 | 1 530 |
| voile à 700 m | 0 | 0,051 | 0,153 | 0,224 | 0,271 | 0,324 |

| « Limite des arbres » | 0,2 | 0,4 | 0,5 | 0,6 | 0,8 | 0,99 |
|---|---|---|---|---|---|---|
| altitude de la limite | 651 m | 944 | 1 091 | 1 237 | 1 530 | 1 808 |
| végétation à 1 200 m (Y, wetK 0,1) | 0,500 | 0,501 | 0,804 | 0,986 | 0,986 | 0,986 |

Monotones, même origine, même course — la seule différence est que « 0,5 »
veut dire **1 091 m à tous les crans**, au lieu de 1 905 m à z9 et 1 071 m à z13.

---

## ⑤ CE QUI NE RÉGRESSE PAS

- **RAMP tient** : `uHeightPivot` / `uHeightContrast` ne sont pas touchés, le
  test de GRA compte toujours ses trois écritures ; `rampe-fixe.test.js` 18 · 0.
- **Mode Classique** : le bloc Naturel du socle est sous `uColorMode == 1` ;
  le globe n'applique le voile que sous `uHazeAmt > 0.001` — inchangé.
- **Crop net, raffinement par tuile, D19** : aucune ligne de `_priorite`,
  `_request`, `_pump`, des parois, de la mer ni des gestes. Les cinq autres
  arbres ne sont pas touchés (`wt-eau`, `wt-soc`, `wt-vie` : rien dans leurs
  fichiers).
- **Coût** : trois `float` uniformes par nuanceur, une multiplication-addition
  et un `clamp` par fragment (deux fois), zéro texture, zéro passe. Côté CPU,
  `facteursHNormRef` est deux divisions, dans des fonctions qui tournaient déjà.
- **Les six tables factices** portent les trois uniformes (les gardes ⓪ de
  `crop-naturel` et `crop-habillage` l'exigent) ; `⑤c`, `⑤d` et
  `style-monde ④a` sont amendés pour dire ce qu'ils gardent désormais.

---

## ⑥ LES TESTS MORDENT — 12 mutations, 12 tuées

`test/voile-fixe.test.js`, **15 tests**, inscrit dans `package.json`
(`audit:tests` sans écart). Campagne : `scratchpad/mutations-bla.py`.

| mutation | ce qu'elle arrache | verdict |
|---|---|---|
| M1 | le voile du globe relit `hNormRelief` nu | ✅ tuée (3 tests) |
| M2 | `facteursHNormRef` rend toujours l'identité | ✅ tuée (3) |
| M3 | `contexteCrop` ne transmet plus `refBasM` | ✅ tuée |
| M4 | `fd` du globe sans `uFdFacteur` | ✅ tuée (2) |
| M5 | `centrerFenetreRef` ignore le lieu | ✅ tuée |
| M6 | `refBasM` retiré de la veille | ✅ tuée |
| M7 | les dalles voisines ne reçoivent plus la conversion | ✅ tuée |
| M8 | `DISTANCE_VOILE_M` = 20 km | ✅ tuée |
| M9 | `_majGradeBloc` n'écrit plus les coefficients | ✅ tuée |
| M10 | `appliqueRampeFixe` ne pose pas la conversion du socle | ✅ tuée |
| M11 | la limite des arbres du socle relit `hNorm` vivant | ✅ tuée |
| M12 | `natHNormRef` GLSL sans le `clamp` | ✅ tuée (le texte contre le jumeau) |

---

## ⑦ CE QUE J'AI CRU, PUIS RÉFUTÉ

1. **« 20 km, la demi-emprise d'arrivée, comme `COTE_REF_M` de RAMP. »** ⛔ La
   mesure l'a réfuté avant le rapport : chroma 52 → 20 à z9, la vue large
   grisée. La bonne borne est celle de l'emprise **la plus large** (80 km).
2. **« Le suspect n° 1 est le voile de DISTANCE lu dans le mauvais espace. »**
   ⛔ À l'écran, à z9, le centre du crop est sous la caméra : `fd` ≤ 0,05 sur
   toute la fenêtre. C'est le voile **d'ALTITUDE** qui blanchit, et son espace
   n'est pas une confusion bloc/globe : c'est le DOMAINE (vivant contre
   référence). La distance était fausse aussi — une brume sans échelle — mais
   ce n'est pas elle que la vidéo montre.
3. **« Le socle est ce qu'on voit. »** ⛔ `terrain.mesh.visible = false` sous
   le crop, mesuré (essai G : 0 pixel). Le premier jet de ma sonde le
   RALLUMAIT après chaque extinction ; corrigé (la visibilité d'avant est
   rendue), les chiffres n'ont pas bougé parce que le globe recouvre le socle.
4. **« À z13 ma session reproduit le blanc de `m_070`. »** ⛔ Non : à z13 le
   voile ne pesait que 5/255 dans ma session, parce que le domaine z13
   [529 ; 1 614] met le terrain AU-DESSUS de `hazeAlt`. Le blanc de la vidéo
   vient d'un domaine qui **contient une vallée** (le crop de `m_070` est
   ailleurs dans l'emprise) — la loi est la même, le lieu ne l'est pas. Le juge
   déterministe (§④) est ce qui a permis de ne pas dépendre de la reproduction.
5. **« La référence de RAMP est la même à tous les crans ≥ 40 km. »** ⛔ Elle
   valait [444 ; 2 103] à z9 et [362 ; 1 823] à z11 : le bloc central est aligné
   sur les tuiles, son centre est à 20 km du lieu à z9. Trouvé parce que le juge
   rendait 21/255 de chroma entre z9 et z11 APRÈS le correctif — et le tableau
   de §④ le garde en mémoire.
6. **« La moyenne RGB de l'écran mesure le critère. »** ⛔ Le piège de RAMP,
   payé une seconde fois : lum 175 → 152 entre z9 et z13 avec un correctif qui
   rend la loi constante. Le cadrage change, pas la loi.
7. **Le test de la limite des arbres à `wetK = 1`** ne distinguait pas « dans
   la bande » de « végétation entière » : le gain 4,86 sature l'axe Y dès
   `veg > 0,2`. Réécrit à `wetK = 0,1` — et j'avais aussi exigé une altitude
   (1 900 m) que z11 ne porte pas (il culmine à 1 770 m).
8. **Un accent grave dans un commentaire GLSL** du socle a fermé le gabarit de
   `terrain.js` et cassé huit fichiers de test d'un coup — le piège écrit en
   tête de `naturel-crop.js`, payé quand même.

---

## ⑧ CE QUI RESTE, ET IL EST NOMMÉ

- ⚠️ **Le brun → pâle de la vidéo à CHAQUE changement d'échelle** (`m_098`
  brun « WIDENING », `m_020` pâle « REFINING ») est la pose de la rampe de crop
  (`poserRampe` refuse tant que la couverture n'est pas complète, puis pose) :
  avant la pose, ni rampe de crop ni voile ; après, les deux. Ce chantier rend
  l'« après » stable entre les crans ; il ne raccourcit pas la latence de pose,
  qui est le sujet de TUILE / K ter.
- ⚠️ **`hNorm` est écrêté AVANT la conversion** : une altitude hors du domaine
  vivant (au-dessus de `uLandMax`, sous `uReliefBas`) est ramenée au bord puis
  convertie — donc lue comme le bord du domaine, pas comme sa vraie altitude.
  Le domaine est mesuré sur le crop, ces altitudes n'y sont pas ; ça ne se voit
  que sur les alentours, que `dedansCrop` éteint déjà.
- ⚠️ **La référence glisse encore de 6 km à z11** (le carré de 40 km déborde
  d'un MNT de 42 km centré à 6 km du lieu, et s'écrête au bord). C'est le
  débord, pas l'alignement des tuiles ; l'écart au juge tient sous 2,3/255.
- ⚠️ **`hazeDist` reste un réglage caché** (0,5), et la brume de distance
  reste radiale depuis le centre du crop — en mètres désormais, mais pas depuis
  la caméra. Une vraie perspective aérienne (distance à l'œil) est un autre
  chantier, et il aurait son propre espace de coordonnées à ne pas confondre.
- ⚠️ **Les captures sont des images SwiftShader** (Chrome sans tête) ; aucun
  chiffre du juge n'en dépend.

---

## FICHIERS

**Code** — `src/rampe-fixe.js` (`facteursHNormRef`, `DISTANCE_VOILE_M`,
`facteurDistanceVoile`, `centrerFenetreRef`, `statsFenetre` décalable) ·
`src/monde/naturel-crop.js` (`hNormRef` + `natHNormRef` GLSL) · `src/globe.js`
(3 uniformes, 2 appels, `_majGradeBloc`, `poserHabillage`, `retirerHabillage`)
· `src/terrain.js` (3 uniformes, 2 appels) · `src/main.js` (`contexteCrop`,
`appliqueRampeFixe`, `majRampeRef`) · `src/block-grid.js` (copie aux voisines)
· `src/monde/branchement-crop.js` (veille).

**Tests** — `test/voile-fixe.test.js` (neuf, 15 tests) · `crop-naturel`,
`crop-habillage`, `grille-crop`, `style-monde` (amendés) · `package.json`.

**Sondes** — `scripts/diag-bla-extinction.mjs` (le départage, avec témoin) ·
`scripts/diag-bla-distance.mjs` (les trois bornes) · `scripts/diag-bla-loi.mjs`
(le juge déterministe).

**Mesures et captures** — `.banc/BLA/avant/`, `.banc/BLA/apres/` (captures et
`extinction.json`), `.banc/BLA/distance/`, `.banc/BLA/loi.json`.
