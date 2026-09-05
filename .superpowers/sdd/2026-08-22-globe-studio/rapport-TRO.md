# RAPPORT TRO — LES RECTANGLES ROUGES SONT DES PLATEAUX À 0 m QUE LE FOND NE POUVAIT PAS REBÂTIR

**Arbre** `C:\Dev\wt-tro` · branche `trous-mer` · serveur `npx vite --host 127.0.0.1 --port 10711`.
Chrome sans tête 1280 × 720, DPR 1, ANGLE, grain éteint pour la mesure.
`npm test` **5 096 · 0** (5 089 + 7) · `audit:tests` **282 = 282, 6 hors suite déclarés, aucun écart**.
Banc : `scripts/sonde-tro.mjs` (neuf). Relevés et captures : `.banc/TRO/*` (ignoré par git).

## 0. LES LIGNES QUE JE TOUCHE — pour `wt-gel` (chemin de descente, `globe.js` partagé)

| fichier | où | quoi |
|---|---|---|
| `src/globe.js` | ≈ l. 4049, **neuve** `echantillonnerGrille` (exportée), juste avant `sampleHeights` | les (G+1)² hauteurs aux nœuds du maillage |
| `src/globe.js` | `_refaireMaillagesDuFond` (≈ l. 7663-7684) | la garde `!t.heights → continue` devient `!t.heights && !t.grille` ; on ne rebâtit que la calotte du fond et les tuiles qui portent un fond d'avant |
| `src/globe.js` | `_buildMesh` (≈ l. 9676-9702) : `grille` avant `posAt`, et `posAt` lit la grille | **la seule lecture de `t.heights` du maillage passe par la grille** ; ≈ l. 9875 : `mesh.userData.fondCle` |
| `src/globe.js` | `_rechargeTuiles` (≈ l. 10908) | `t.grille = null` avec `t.heights = null` |
| `test/fond-grille-tro.test.js` | neuf, 7 tests, inscrit dans `package.json` | |
| `scripts/sonde-tro.mjs` | neuf | le banc (chemin, couverture, tuiles du crop contre le champ, bandes) |

**Rien** dans `_traverse`, `update`, la file, le crédit, la caméra, le nuanceur,
les parois (`wt-bis`), la mer (`poserMer`), `fondMarinTuile`, `dem.js`, `bathy.js`.
⛔ **Rien n'a été écrit dans `public/data/bathy`** (jonction partagée) : lecture et
comptage seulement.

---

## ⓪ LA RÉPONSE COURTE

> **(a) est réfutée pour l'emprise du crop, (b) est réfutée, (c) est réfutée
> telle qu'elle est formulée — et la cause est une quatrième, mesurée :
> les tuiles que le crop dessine sont bâties AVANT que le fond soit posé, avec
> la mer à 0 m (le dépôt : `max(h, 0)`), et `_refaireMaillagesDuFond` ne
> pouvait pas les rebâtir parce qu'il exigeait `t.heights`, relâché dès le
> maillage pour toute tuile hors réservation — c'est-à-dire pour TOUTES celles
> que le crop dessine (réservation au zoom du socle, dessin un ou deux niveaux
> plus fin).**
>
> Le plateau à 0 m fait une **marche de 1,3 à 1,7 km** (× exagération 2) avec
> ses voisines bâties sur le fond ; vue de trois quarts, **sa jupe est le
> rectangle rouge** de `q_038`. C'est exactement ce qu'Adrien a écrit dans sa
> note (*« le quadtree qui met le sol à zéro, créant une espèce d'arche »*) —
> mais à La Réunion **la donnée n'y est pour rien** : la tuile z8 `167/143`
> couvre toute l'île, **0 pixel sans donnée**, fond à −4 152 m.

Chiffres, avant → après (même chemin, même page, même seconde) :

| relevé (crop z12 cadré de trois quarts, au repos) | avant | après |
|---|---|---|
| tuiles dessinées | 36 | 36 |
| **bâties sur un AUTRE fond que celui posé** | **12** | **0** |
| **mer à 0 m là où le champ dit −1 320 à −1 718 m** (le plateau) | **4** | **0** |
| trous de couverture (48 × 48 points, 20 images) | 0 | 0 |
| rectangles rouges dans la mer, capture | **1** (+ 1 plateau pâle, + 1 coin sombre) | **0** |
| 8 chargements × 72 images au repos | — | **0 tuile sur un autre fond, 0 trou, à chaque fois** |

Captures : `.banc/TRO/avant2/03-cadre-calme.png` (le rectangle rouge, le
plateau pâle à sa gauche, le coin sombre en haut à droite) contre
`.banc/TRO/apres/03-cadre-calme.png` (une nappe continue).

---

## ① LE CHEMIN, DIT EN ENTIER (piège commun : l'état dépend du chemin)

`modes.flyTo(−21.2484, 55.7666, 11)` — le cartouche de la vidéo dit
« −21.2484, 55.7666 · Z11 » — puis la pose de la vidéo : le bloc entier de trois
quarts, altitude 1,1 × largeur du crop, 35°, cap 15° (le cadrage de SOC). Le
crop passe à z12 (`_zCropCible` 12) à ce cadrage. Calme (file 0, vol 0, 1,5 s
stable), puis 20 images consécutives relevées dans `globe.update` (hook).

⚠️ **`flyTo(…, 11)` atterrit à 3,7 km d'altitude** sur la terre, à z13 : ce n'est
pas la vue d'Adrien. C'est le cadrage à 1,1 × largeur qui la reproduit.

## ② CE QUE LA SONDE A VU — et pourquoi (a), (b), (c) tombent

**Couverture** : chaque point d'une grille 48 × 48 sur l'emprise `_crop`, en
mercator, contre les tuiles dessinées (entières ou quadrant non masqué d'un
parent partiel, `t._partiel`). **0 trou sur 2 304 points**, 0 doublon, 36 tuiles
z12, 0 partiel, sur les 20 images — **(b) est réfutée** : R37 couvre, le
raffinement par tuile ne laisse pas de trou. (Les 272 « trous » du premier relevé
à 3,7 km d'altitude sont la rangée sud et la colonne est du crop, **hors du
champ de la caméra** — `_dansLeChamp` les écarte, aucun pixel n'en dépend.)

**A/B parois cachées à la même seconde** (`03b-cadre-sans-parois.png`) : le
rectangle rouge **disparaît**, mais on voit alors **des jupes qui pendent sous
le bloc**. Donc le rouge est bien de la paroi, mais **il n'est pas dessiné SOUS
une nappe absente** : la nappe est là, continue (mer cachée : 190 797 px
changent ; parois cachées : 1 174, sous le témoin à 5 001). **(c) est réfutée.**

**Les tuiles contre le champ** (`tuilesCrop` : profondeur du nœud central du
maillage, lue dans la géométrie en monnaie de `hauteurMaillee`, contre la valeur
du champ `_fondCrop.valeurs` au même point) :

```
12/2684/2294 centre 0 champ -1718.4 h=false clé=''
12/2684/2295 centre 0 champ -1319.8 h=false clé=''
12/2684/2296 centre 0 champ -1662.7 h=false clé=''
12/2685/2295 centre 0 champ -1585.1 h=false clé=''
12/2682..2684/2293       clé=…|0.000366…|3|1|3513   (le fond du crop z13 d'avant)
```

Quatre tuiles avec **la mer à 0 m**, sans hauteurs (`h=false`), bâties sans
aucun fond (`clé=''`) ; trois autres bâties sur le fond du crop **précédent**
(demi 0,000366, profondeur max 3 513 m) et jamais rebâties sur le nouveau
(demi 0,000732, 4 282 m). Douze sur trente-six.

**La donnée** : la tuile z8 `167/143` (54,84 → 56,25 E, −20,63 → −21,94 S)
couvre l'île entière et tout le crop : **256 × 256 px, 0 noData, −4 152 → 0 m**.
z7 `83/71` aussi (−4 992 → 0). z9 → z13 : **0 tuile sur l'emprise** (334-335/
286-287 à z9, 12 à z10, 42 à z11, 156 à z12, 552 à z13), ce qui est **normal** :
la zone de base `gebco` a `zmax: 8`, tout est servi en surzoom de z8. **(a) est
réfutée pour le crop.**

## ③ LA CAUSE — trois lignes du dépôt, lues dans l'ordre

1. `_buildMesh` : `altitudeMaillage(sampleHeights(t.heights…), fond ? echantillonnerFond(fond…) : null)`
   — **sans fond, la mer est `max(h, 0)` = 0 m** (le dépôt, « oceans stay on
   the sphere »). Une tuile bâtie pendant la descente, avant `poserFondCrop`,
   a la mer à 0.
2. `_buildMesh`, fin : `if (!this.gardeHauteurs?.has(t.key)) … t.heights = null`
   — **les hauteurs partent dès le maillage**. `gardeHauteurs` est rempli par
   `reserverHauteurs` (`main.js:7127`) → `demanderEmprise(flux, { zoom: ZOOM_SOCLE })` :
   **les clés réservées sont au zoom du socle** (z11 ici), et le crop dessine du
   z12/z13.
3. `_refaireMaillagesDuFond` : `if (t.state !== 'ready' || !t.heights || !t.mesh) continue`
   — **une tuile sans hauteurs n'est jamais rebâtie**. Son propre encart le
   disait : *« le cas ne se pose pas aujourd'hui, mais il se posera si la portée
   du champ dépasse un jour la réservation »*. Il se posait déjà : la
   réservation est au bon endroit mais **au mauvais niveau**.

## ④ LE CORRECTIF — retenir 5 Kio par tuile, pas 1 Mio

`_buildMesh` ne lit de `t.heights` que **les (G+1)² nœuds** : positions à
`(i/G, j/G)`, normales à `±1/G` (bornées dans la tuile — des nœuds), jupe
(l'anneau de bord), origine à `(½, ½)`. On retient donc **la grille des nœuds**
(`t.grille`, `Float64Array`, 625 doubles à z ≥ 6 = **5 Kio** contre 256 Kio à
1 Mio pour `t.heights` ; 600 tuiles en cache = 3 Mo) et `posAt` la lit. Les
hauteurs restent la vérité quand elles sont là (grille recalculée d'elles ; une
tuile rechargée sur place ne relit pas une grille périmée) ; `_rechargeTuiles`
jette la grille avec les hauteurs.

`_refaireMaillagesDuFond` rebâtit alors toute tuile prête **avec hauteurs ou
grille**, bornée à ce qui peut changer : la **calotte du fond** (`repere.demi ×
portee`, `tuileDansCrop`), plus toute tuile qui **porte un fond d'avant**
(`mesh.userData.fondCle`, posé à la construction) — hors calotte et sans fond
avant comme après, `echantillonnerFond` rend `null` et rien ne changerait.
Même clé que le fond posé : pas de reconstruction (le coût de la reprise,
⑧ quater de `fond-crop.test.js`, inchangé).

**Preuve au bit** : `test/fond-grille-tro.test.js` ① bâtit une tuile avec des
hauteurs vallonnées, jette les hauteurs, rebâtit depuis la grille — **positions
identiques au bit** (`deepEqual` sur le `Float32Array`). ② rejoue le défaut :
une tuile sans hauteurs, mer à 0, `poserFondCrop` → **rebâtie, mer au champ**,
et la clé du fond gravée sur le maillage. ② bis : hors calotte sans fond, pas
de reconstruction ; avec un fond d'avant, rebâtie au retrait. ③ `_rechargeTuiles`
jette la grille. ④ des hauteurs neuves priment. **Chaque test a été rouge sur
la mutation qu'il nomme, et je les ai jouées** (garde `!t.heights` remise :
② et ② bis rouges ; `t.grille = null` retiré : ③ rouge ; `posAt` relisant
`sampleHeights(t.heights || zéros)` au lieu de la grille : ① rouge — ⚠️ **mais
seulement depuis que la tuile de ① porte de la TERRE** : sur une tuile toute
en mer, la mutation survivait, parce qu'avec un fond la mer prend le champ
quelle que soit la hauteur de tuile. Une suite verte ne prouve rien — piège
commun, payé ici).

## ⑤ LES BANDES PÂLES (`q_017` → `q_027`) — attribuées, avec le compte de tuiles

Elles apparaissent quand Adrien **sort du crop à la molette** (les trois crans
arrière) : la mer du globe se rallume autour, dans la même teinte que celle du
bloc, et la caméra est tournée (~25° de cap). Reproduit au banc (`bandes6/
B7-dehors-allume.png`, sortie par trois vraies molettes CDP, `deltaY +120`) :
**une bande pâle rectiligne** en bas à droite, **à la longitude 56,25° E** —
l'arête est de la tuile z8 `167/143`. À sa gauche la mer est **striée** (servie
en z8) ; à sa droite elle est **lisse et plus claire** (servie par l'ancêtre z7
`84/71`, parce que z8 `168/143` **n'existe pas**). C'est la « plaque pâle à arête
verticale nette » de B6, mot pour mot. Relevé : **0 marche > 150 m** entre
voisines de même niveau (86 tuiles dessinées) — ce n'est pas une marche de
hauteur, c'est une **différence de finesse** le long d'une arête droite, et
l'éclairage la dessine.

**Le compte** — fenêtre 3 × 3 autour de `167/143` :
- **z8 : 3 tuiles sur 9** ; absentes `166/143 166/144 167/142 167/144 168/143 168/144` (abysse sous −500 m : la garde `!anyShelf` du tuileur, GEB §②).
- **z7 : 9 sur 9** (la recuisson GEB, en place sur la jonction : 213 / 781 / 2 908 / 10 965 tuiles en z4 → z7).

➡️ **Attribuées à (a)**, et la cuisson qui les supprime est celle que GEB a
prescrite, étendue à z8 : `node scripts/build-bathy-tiles.mjs --src
C:/Dev/monolith-terrain/data/gebco --out <bac> --zmin 8 --zmax 8 --all --shelf
-99999` sur l'emprise (bbox `54,-23,57,-20` pour La Réunion ; le monde entier
si on veut la continuité partout — GEB chiffre z8 mondial à ~1,6 Go). ⛔ Je ne
l'ai pas lancée : jonction partagée.

⚠️ Deux choses que j'ai éliminées en route, parce qu'elles y ressemblaient :
le **cartouche** (rose des vents, textes — `groundInfo.setVisible(false)` ne
change rien sur la mer) et les **parois** (cachées : 646 px, sous le témoin).
Et pendant le WIDENING lui-même (z12 → z11), une **plaque grise transitoire**
existe dans la mer pendant ~1,5 s (`bandes2/B1-sortie-0300ms.png`,
`1000ms`) : elle est **partie à 2 s** et le repère des parois est celui du crop
à chaque relevé (`même repère true`, `provisoire false`). Je la note, je ne l'ai
pas poursuivie : elle n'est ni dans les tuiles (0 désaccord avec le champ à
1 000 ms) ni dans les parois.

## ⑥ CE QUI RESTE OUVERT, DIT HONNÊTEMENT

- **Le mécanisme d'Adrien existe aussi hors crop.** Sa note dit *« le quadtree
  qui met le sol à zéro »* : hors crop il n'y a pas de fond, et une tuile de mer
  sans bathymétrie fusionnée (aucune tuile bathy jusqu'au plancher z7, ou
  `tuilePorteDeLaMer` faux) reste à `max(h, 0)` = 0 m à côté d'une voisine
  fusionnée à −3 000 m. Au large de La Réunion, z7 est complet depuis GEB, donc
  le cas ne se présente pas ici ; il se présente partout où **z7 manque encore**
  (GEB a recuit z7 mondial : 10 942 écrites, 5 442 terre pure — donc a priori
  nulle part en mer). Je ne l'ai pas mesuré ailleurs.
- **La plaque grise du WIDENING** (⑤), 1,5 s, non attribuée.
- **`_refaireMaillagesDuFond` coûte plus qu'avant** : il rebâtit toute la
  calotte (jusqu'à ~150 tuiles à z12/z13, 625 nœuds chacune) au lieu des seules
  réservées. Non chronométré ; c'est le prix d'une nappe juste, et il ne se paie
  qu'au changement de clé du fond (pas par image, pas à chaque reprise).
- **Le premier plancher du crop** : `01-arrivee-z11` compte 272 points « sans
  tuile » qui sont hors champ. La sonde ne distingue pas « hors champ » de
  « trou » ; elle ne le devait pas pour ce brief (le cadrage entier a 0 trou),
  mais un banc qui voudrait mesurer une caméra rasante devra filtrer par
  `_dansLeChamp`.

## ⑦ PIÈGES PAYÉS

- ⚠️ **J'ai lu 24 tuiles « sous le plancher » qui n'y étaient pas** : mon premier
  `hmin` prenait tous les sommets du maillage, **jupe comprise** — et la jupe est
  bornée au plancher du bloc (−6 082 m en monnaie `hauteurMaillee`). `G` vaut
  **24** à z ≥ 6 (`segmentsTuile`), pas 64 : lire les (G+1)² premiers sommets,
  et le nœud central est le `(12, 12)`.
- ⚠️ **`cranZoom(−1)` n'est pas la molette** : trois crans en 360 ms élargissent
  le crop (WIDENING z12 → z11) mais ne le quittent pas et n'allument pas le
  dehors (VIE). Trois `Input.dispatchMouseEvent mouseWheel deltaY +120` par CDP
  sortent du crop et rallument la mer du globe — c'est l'état des images
  d'Adrien.
- ⚠️ **Le premier `--court` a rendu 3,6 Mo de sortie** parce que j'imprimais
  `_fondCrop.valeurs` (148 225 flottants). Imprimer la clé, pas le champ.
- ⚠️ **`flyTo(lat, lon, 11)` n'est pas la vue de la vidéo** (3,7 km d'altitude,
  z13 au sol) ; le cadrage à 1,1 × largeur l'est.
- ⚠️ `pngjs` n'est pas dans `node_modules` : les tuiles bathy se lisent avec
  PIL (`python -c "from PIL import Image"`), et le triplet terrarium se décode
  `r·256 + g + b/256 − 32768`.
