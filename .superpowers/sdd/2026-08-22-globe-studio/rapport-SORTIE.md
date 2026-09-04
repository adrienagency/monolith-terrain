# SORTIE — LA MOLETTE SORT DU CROP EN 8 À 9 CRANS, ET LA TROISIÈME SORTIE EST RETIRÉE

Arbre `C:\Dev\wt-sortie`, branche `sortie-molette`. Serveur :
`npm run dev -- --host 127.0.0.1 --port 8433 --strictPort`, **arrêté en
partant**. Les Chrome sans tête sont ceux de `puppeteer-core`, lancés et fermés
par mes scripts ; **aucun autre n'a été touché**.

## LES LIGNES QUE JE TOUCHE — pour les trois agents qui tournent en parallèle

| fichier | ce que j'y fais |
|---|---|
| **`src/monde/sortie-molette.js`** | **NEUF** — la loi pure de la confirmation |
| `src/main.js` | 2 imports en tête ; `intentionZoom` (+1 ligne) ; le bloc `confirmerSortieMolette` / `surBasculeCrop` juste après ; `surBascule:` de `creerVeilleCrop` |
| `src/modes.js` | 2 constantes ; `_sortieCourse` au constructeur ; 3 méthodes + 1 accesseur avant `_applyZoom` ; **1 ligne** dans la branche surface d'`update` |
| `test/sortie-crop.test.js` | **NEUF**, inscrit dans `package.json` |
| `test/crop-intention.test.js` | § ② : trois sorties → **deux** |
| `test/regime-crop.test.js` | ② quater : `surBascule` |
| `regle-D21.md` | ① amendée : **deux sorties**, avec la raison chiffrée |
| `scripts/sonde-sortie.mjs` | **NEUF** — le banc |

⛔ **Je n'ai touché ni `globe.js`, ni `bathy.js`, ni `coast-mask.js`, ni la mer.**
Aucune constante du zoom ordinaire n'a bougé d'un bit.

---

## ① CE QU'ON MESURAIT, ET POURQUOI CE N'ÉTAIT PAS LE PAS DE MOLETTE

**Avant tout correctif**, `scripts/sonde-sortie.mjs --epreuve sortie`, un cran
par lecture, **un geste par chargement**, départ dans le crop à ~466 m :

| | mesuré |
|---|---|
| crans pour tuer le crop | **161 · 162** (`.banc/SORTIE/avant-sortie-2.json`) |
| le même chiffre chez CHASSE (une lecture par image) | 241 – 260 |

Les deux dispositifs disent la même chose : **la molette n'est pas une sortie**.

### ⚡ LES CRANS MORTS — la cause, relevée cran par cran

`.banc/SORTIE/avant-mortes.json`, avec `d`, `maxDistance` et `_levelZoom` à
chaque cran :

```
cran 20  alt= 608 m  d=148,10  max=150  niveau=−0,0139
cran 21  alt= 616 m  d=150,00  max=150  niveau=+0,0115   ← la caméra touche le plafond
…        alt= 616 m  d=150,00  max=150  …                ← 23 crans, PAS UN MÈTRE
cran 43  alt= 616 m  d=150,00  max=150  niveau=+0,6758
cran 44  alt= 652 m  d= 79,70  max=150  niveau=+0,0601   ← franchissement : +36 m
```

⛔ **Ce n'est PAS le pas de molette.** C'est `controls.maxDistance` : la caméra
colle au plafond du niveau, `_applyZoom` clippe le déplacement **mais le
compteur encaisse l'intention** (c'est la correction R23, et elle est juste), et
le franchissement qui finit par libérer la caméra **CONSERVE l'altitude** —
c'est sa définition (`poseApresNiveau`). **Vingt-trois crans passent entièrement
dans un compteur.** Passé le plancher du crop, la loi redevient nominale :
crans 60 → 160, altitude 1 123 → 36 898 m, soit `ln(32,9)/100 = 0,0349` par
cran — **exactement** `BUDGET_NIVEAU / CRANS_PAR_NIVEAU`. Le pas de molette
n'a jamais menti ; il était clippé.

### LA DIRECTION : B, ET LE CHIFFRE QUI ÉCARTE A

**A — un pas plus grossier au-dessus d'une altitude.** ⛔ **Écartée, pour deux
raisons chiffrées :**
1. **Contre un plafond, la taille du pas ne déplace personne.** Les 23 crans
   morts sont à `d = maxDistance` : un cran dix fois plus gros y produit
   exactement le même déplacement — zéro. A ne corrige pas le défaut qu'il
   prétend corriger.
2. **Et le budget ne tient pas.** Sortir depuis 466 m demande
   `ln(40 343 / 466) = 4,46` nat. Pour « ≤ 10 crans » il faudrait **0,45 nat par
   cran, soit ×1,56** — contre ×1,035 aujourd'hui, **quinze fois plus gros**.
   C'est jeter le zoom doux de D19, noté 9,75/10 par des agents indépendants.

**B — une sortie franche, armée par une intention confirmée.** ✅ Retenue. Elle
ne touche à **aucune** constante du zoom : `ZOOM_TAU`, `ZOOM_IMPULSE`,
`CRANS_PAR_NIVEAU`, `ZOOM_VEL_MAX` sont ceux d'hier, et un test le garde
(`③ quinquies`). Le zoom ordinaire est **le même code, au bit**.

---

## ② LE CORRECTIF, EN TROIS PIÈCES QUI NE SE MÉLANGENT PAS

**① La loi — `src/monde/sortie-molette.js` (neuf).** Un automate qui ne connaît
ni la caméra, ni le crop, ni l'altitude : il compte des crans dans le temps et
rend `true` **une fois**, au cran qui confirme. `CRANS_SORTIE = 3`,
`FENETRE_SORTIE_MS = 1000`. Un cran de zoom avant remet à zéro (la même idée que
`desarmerSortie`, écrite au même endroit) ; hors du crop il ne compte rien.
⚡ **Pure exprès** : `main.js` n'est chargé par aucun test de ce dépôt (§0 du
plan) — une confirmation écrite là-bas ne serait gardée par rien.

**② La poussée — `modes.armerPousseeSortie` / `_avancerPousseeSortie`.** Elle
**pompe l'intention** (`_levelZoom`), le seul levier que le plafond ne clippe
pas, à `TAUX_SORTIE_LOG_S = 6` nat/s, bornée à `DUREE_SORTIE_MAX_S = 6` s. Elle
subit le clip comme `_applyZoom` le subit ; ce sont les franchissements qu'elle
provoque qui montent l'altitude.

**③ La mort reste à D21 ①.** ⚡ **Le correctif ne prononce JAMAIS la mort du
crop.** Il porte l'altitude au-dessus de `SEUIL_MORT_M` et c'est `socleVisible`
qui tranche, avec le `sortieArmee` que le premier cran avait déjà posé. **La loi
de D21 ① n'est pas modifiée d'un caractère** — elle avait raison depuis le
début : il ne manquait que l'altitude.

⚠️ **ET L'EXCÈS DE COMPTEUR EST RENDU À L'ARRÊT.** R29 pose que le compteur
survit (« un niveau par appel, et le reste reste »). Laissé plein après la mort
du crop, il aurait franchi des niveaux tout seul jusqu'à `enterOrbit()` : la
molette aurait eu **deux sorties en une**, dont une que personne n'a demandée.
`annulerPousseeSortie` le borne. Test `② ter`.

---

## ③ LE TABLEAU DU CRITÈRE — 8 chargements par ligne, un geste par chargement

Banc : `scripts/sonde-sortie.mjs`. Traces : `.banc/SORTIE/`.

| situation | avant | mesuré après | verdict |
|---|---|---|---|
| **crans pour sortir du crop** | 161 · 162 (et 241–260 chez CHASSE) | **8 · 8 · 9 · 9 · 9 · 8 · 9 · 8** — **≤ 10, 8/8** | ✅ |
| **crans pour ARMER la sortie** | — | **3, 8/8** (le reste est la course, l'utilisateur peut lâcher) | ✅ |
| **crans morts en tête** | **23** (crans 21→43, altitude figée à 616 m) | **0** — la course part au 3ᵉ cran | ✅ |
| **un cran de dézoom ISOLÉ** | — | `cropPose` **true→true 8/8** (`apres-isole-8.json`) | ✅ **ne sort pas** |
| altitude de mort | 40 684 · 40 633 m | **40 726 – 66 836 m** (seuil 40 343) | ✅ |
| **zoom molette ordinaire dans le crop** | courbe ci-dessous | **indiscernable** | ✅ |
| **bouton map monde** | sort | `pose` **false** et `mode` **orbital** après le clic, **8/8** | ✅ |
| **hors crop, la molette** | ×1,4859 sur 3 crans | **×1,4859**, au dix-millième, **8/8** | ✅ **inchangée** |
| `npm test` | 4 870 · 0 | **4 908 · 0** | ✅ (≥ 4 893) |
| `audit:tests` | 263 = 263 | **264 = 264, aucun écart** | ✅ |

### LA COURBE DU ZOOM ORDINAIRE, AVANT / APRÈS — la preuve que D19 tient

Rapport d'altitude **cran par cran**, zoom AVANT dans le crop, 12 crans, 4
chargements de chaque côté (`avant-courbe.json` / `apres-courbe.json`) :

```
avant  — 0,9935 0,9912 0,9868 0,9843 0,9841 0,9792 0,9788 0,9783 0,9754 0,9747 0,9741
après  — 0,9935 0,9913 0,9868 0,9844 0,9819 0,9815 0,9788 0,9760 0,9754 0,9747 0,9741
avant  — 0,9935 0,9891 0,9868 0,9866 0,9819 0,9793 0,9788 0,9784 0,9754 0,9748 0,9742
après  — 0,9935 0,9891 0,9890 0,9844 0,9819 0,9793 0,9788 0,9784 0,9754 0,9748 0,9742
```

**Même courbe, même douceur, même monotonie** — l'écart tient dans l'arrondi au
mètre de l'altitude relevée. Rapport sur les 12 crans : **0,809 / 0,795 / 0,809 /
0,803** avant, **0,807 / 0,809 / 0,812** après (la 4ᵉ passe après part de 497 m,
un reste de descente, et n'est pas comparable — je la donne quand même).

⚠️ **DEUX CRANS DE DÉZOOM, PAS DOUZE, DANS CETTE ÉPREUVE — et c'est le sens même
du correctif.** Au-delà de trois crans, un dézoom **EST** une sortie : mesurer
douze crans arrière mesurerait la sortie, pas le zoom ordinaire. Le zoom
ordinaire du crop, c'est le zoom avant et la correction de un ou deux crans —
et ces deux crans laissent le crop vivant, 4/4.

### LA NON-RÉGRESSION D19

Banc `scripts/sonde-ge3.mjs --regime crop --repete 8`, trace
`.banc/SORTIE/ge3-crop8.json` (molette) et `ge3-glisse8.json` (glissé, inclinaison).

| garde D19 | attendu | mesuré, 8 chargements | verdict |
|---|---|---|---|
| **la molette vise le CENTRE** (`molette-1cran`) | ≤ 1,4 px | **`centre0DerivePx` = 0 sur les 8** | ✅ |
| **un cran de molette, le crop** | vit | `cropPose` **true→true 8/8** — *le critère « un cran isolé », confirmé par un SECOND banc, indépendant du mien* | ✅ |
| **six crans de zoom AVANT** (`c1-molette-zoom-avant-6crans`) | le crop vit, le zoom est doux | `cropPose` **true→true 8/8**, `rapportAlt` **1,1096 – 1,1162** (écart 0,6 %), `deltaLndMax` 0,00226 – 0,00339 par image | ✅ |
| **le glissé attrape la Terre** (`gauche-elan`) | ≤ 0,2 px | **`terreDerivePx` = 0 sur les 8** | ✅ |
| **`\|Δ ln d\|` — glissé gauche** | < 1e-4 | **4,44e-16 sur les 8** — *le chiffre exact de REV* | ✅ |
| **`\|Δ ln d\|` — inclinaison dans le crop** (`c1-inclinaison-forte`) | < 1e-4 | **0 sur les 8**, `terreDerivePx` 0, et le crop **vit 8/8** | ✅ |

⚠️ **`curseur0DerivePx` vaut 2,03 – 2,11 px, ET CE N'EST PAS UN ÉCHEC** — c'est
la réfutation n° 5 de REV, et j'ai failli reporter le même mauvais chiffre : D19
pose que la molette zoome vers le **centre de l'écran**, pas vers le curseur. La
grandeur à lire est `centre0DerivePx`, et elle vaut **0**.

⚠️ **ET `saisiVsPointeurPx` VAUT 331 px SUR LE GLISSÉ, CE QUI EST NORMAL ICI :**
dans le crop, le glissé appartient à OrbitControls (gestes-terre ne prend la main
qu'hors du crop, `regimeGeste`), donc « on attrape la Terre » n'y est pas la loi.
Les 0 px de REV sont un relevé **hors crop**. **Je ne présente pas ce chiffre
comme une non-régression**, faute d'un avant mesuré par moi dans le même régime ;
ce que je peux affirmer, c'est qu'**aucune ligne du chemin du glissé n'est
touchée** par ce correctif, et que les deux grandeurs qui SONT le critère du
brief (0,2 px de dérive et `\|Δ ln d\| < 1e-4`) tiennent, 8/8.

---

## ④ `regle-D21.md` AMENDÉE — DEUX SORTIES, ET LA RAISON EST CHIFFRÉE

Le § ① passe de **trois** sorties à **deux**, avec un § neuf qui porte la mesure
de REV (huit chargements) : dans le crop, `mouseButtons` vaut `{LEFT: 0,
MIDDLE: 2, RIGHT: 2}` et le clic droit est **un PAN** — `cropPose` **true→true
8/8**, altitude 10 457 → 8 589 m, *elle descend*. Il n'était une sortie que
grâce à la bande de 568 km qu'ouvrait D21 ②, que D23 a refermée.

⛔ **Je n'ai pas recodé le clic droit** — c'est acté.

⚠️ **MAIS LA LIGNE QUI L'ARME RESTE, ET C'EST VOULU.** Hors du crop, le clic
droit **est** le zoom de D19 : il doit y armer l'intention comme la molette, une
seule écriture du sens du dézoom. Elle n'a simplement plus de crop à tuer. Le
test `② ter` de `crop-intention` dit désormais cela, au lieu d'affirmer une
troisième sortie.

**Les tests remis d'accord :** `crop-intention` (en-tête, titre du § ②, test
`② ter` réécrit, plus une lecture de `regle-D21.md` par le test lui-même — le
nombre de sorties a changé deux fois en un jour, le seul moyen que le code et la
règle ne divergent pas est que l'un lise l'autre) et `regime-crop` (② quater,
`surBascule`).

---

## ⑤ LES TESTS — ils rougissent sans le correctif

`test/sortie-crop.test.js`, **17 tests**, inscrit dans la liste explicite de
`package.json` (`npm run audit:tests` rend **264 = 264, aucun écart** — ce qui
le confirme au lieu de le supposer).

**Vérifié en retirant le correctif** (`git stash` des trois sources, module
neuf mis de côté) :

| | avec | sans |
|---|---|---|
| `test/sortie-crop.test.js` | **17 · 0** | ⛔ **0 · 1** (le fichier ne charge plus) |
| `test/crop-intention.test.js` | **21 · 0** | ⛔ **20 · 1** (② ter : la règle dit encore trois sorties) |

Ce qu'ils gardent : ① la confirmation (un cran isolé mille fois de suite ne
confirme jamais ; trois d'affilée confirment **une** fois ; le zoom avant remet
à zéro ; la fenêtre coud un geste ; hors du crop rien ne compte) ; ② **la
poussée pompe l'intention alors que la caméra est collée au plafond — les 23
crans morts rejoués en unitaire** ; ③ le branchement au GESTE, le seuil lu et
non recopié, l'arrêt à la mort du crop, l'appel par image ; ④ **le pas de
molette intact au bit** ; ⑤ deux sorties dans la règle.

---

## CE QUE J'AI CRU, PUIS RÉFUTÉ

1. **« Le défaut est le pas de molette — une constante à grossir. »**
   ⛔ **Faux, et c'était le classement n° 1 de CHASSE** (« une constante, risque
   faible »). Le relevé cran par cran le dit : aux crans 21 à 43 la caméra est à
   `d = maxDistance` et **ne bouge pas**. Un cran plus gros y produit le même
   zéro. ⚡ **J'ai failli livrer un facteur d'échelle qui n'aurait rien changé
   aux 23 crans morts et abîmé D19 pour rien.** C'est la mesure `d` / `max` /
   `_levelZoom` — trois grandeurs relevées ensemble — qui l'a tranché ; avec
   l'altitude seule, le défaut ressemblait exactement à un pas trop fin.

2. **« Il suffit de tuer le crop quand l'intention est confirmée. »**
   ⛔ **Faux, et ça bouclait.** Le crop mort à 466 m **renaît à l'image
   suivante** : `socleVisible` fait naître dès que l'altitude est sous
   `SEUIL_NAISSANCE_M`, et D21 dit expressément que « la naissance garde son
   seuil ». Une sortie qui ne monte pas la caméra n'est pas une sortie : c'est
   un clignotant. D'où une poussée qui vise l'**altitude**, et une mort laissée
   à la loi.

3. **« La poussée peut piloter la DISTANCE, comme le glissé de clic. »**
   ⛔ **Faux, pour la raison même du défaut** : `controls.update()` reclampe à
   `maxDistance`, et le franchissement conserve l'altitude. Piloter `d` en
   boucle ouverte, c'est repousser une caméra qui ne peut pas reculer. Le seul
   levier qui traverse le plafond est le **compteur d'intention** — celui-là
   même que R23 avait rendu insensible au clip. **Le correctif est donc l'enfant
   direct du mécanisme du défaut.**

4. **« Une poussée qui déborde son budget est sans conséquence. »**
   ⛔ **Faux.** Le compteur survit aux images (R29) : un excès laissé en place
   fait franchir des niveaux tout seul jusqu'à `enterOrbit()`. Un dézoom de
   molette aurait fini **en orbite**, ce qui est la sortie de l'autre bouton.
   `annulerPousseeSortie` borne le compteur, et le test `② ter` le garde.

5. **« Mon épreuve "hors crop" mesure bien hors du crop. »**
   ⛔ **Faux, et la première version l'a écrit noir sur blanc** : elle relevait
   `crop true→true` et se croyait dehors — un `goto` atterrit **dans** le crop.
   Elle sort désormais par le bouton monde avant de mesurer. Le chiffre
   d'origine (`dLog` 0,24 à 0,36, variable) était celui d'un zoom dans le crop.

**Et une faute de méthode, qui n'a rien réfuté mais qu'il faut dire :** j'ai
d'abord écrit la loi de confirmation **dans `main.js`**, avec ses constantes.
Elle y était invérifiable — aucun test de ce dépôt ne charge `main.js`. Sortie
dans `monde/sortie-molette.js` avant tout commit. La règle du chantier était
écrite trois fichiers plus loin, dans l'en-tête de `crop-intention.test.js`.

---

## LES OCTETS, ET LES OUTILS

- ⚠️ **Toutes les éditions mécaniques faites en binaire**
  (`io.open(..., newline='')`) **et relues à l'octet** : `grep -c $'\r'` rend
  **0** sur `src/main.js`, `src/modes.js`, `src/monde/sortie-molette.js`,
  `package.json`, les trois fichiers de test et `regle-D21.md` ; aucun octet de
  contrôle. C'est le piège qui a fait tomber 15 tests deux fois aujourd'hui.
- **Un banc neuf** : `scripts/sonde-sortie.mjs`, quatre épreuves (`sortie`,
  `isole`, `courbe`, `horscrop`), `127.0.0.1`, vol de démarrage attendu
  (`d > 100`, immobile 1,5 s — la pose tombe **à cheval** sur le seuil de
  naissance), voile levé jusqu'à ce qu'`elementFromPoint` rende le `CANVAS`,
  **un geste par chargement**.
- **Aucune ligne de `src/` touchée par les bancs.**

## LES TRACES

`.banc/SORTIE/` — `avant-sortie-2.json` (161 · 162 crans), **`avant-mortes.json`
(les 23 crans morts, avec `d`, `max` et `_levelZoom`)**, `apres-sortie-8.json`
(8 chargements), `apres-isole-8.json`, `avant-courbe.json` / `apres-courbe.json`,
`avant-horscrop.json` / `apres-horscrop.json`, `ge3-crop8.json` et `ge3-glisse8.json` (D19).
