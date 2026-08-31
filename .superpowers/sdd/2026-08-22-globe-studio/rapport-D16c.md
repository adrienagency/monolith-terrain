# D16-c — LE CARTOUCHE REVIENT : LE DRAPEAU **ET** LA SCÈNE, PAS L'UN DES DEUX

**Statut : ✅ livré, mesuré, testé.**

> **Adrien :** *« Répare l'apparition de la data autour du socle — données Wikipédia et tout le reste, elles n'apparaissent plus. »*

---

## ⚡ CE QUE LA MESURE A TRANCHÉ AVANT TOUTE ÉCRITURE

### ① LES DONNÉES ARRIVENT — la tâche n'était PAS annulée, mais elle aurait pu l'être

Première chose faite, cinq minutes, mode sphère par défaut (`http://localhost:5545/`,
sans paramètre), La Réunion :

```
info: { name: "Réunion", country: "France",
        title: "Enclos Fouqué",
        description: "The Enclos Fouqué is the most recent caldera built by the
                      Piton de la Fournaise, the active volcano of the isle of la Réunion.",
        coord: "21.2600°S  55.7400°E",
        elevation: "ELEV  -2,116 – 2,626 m  ·  mean 441 m",
        scale: "SCALE  0 ─── 5 ─── 10 km" }
meshes: 8        ← les huit mailles sont GRAVÉES
group.visible: false
group.parent: Scene   ← la scène du bloc, celle que D16-a ne rend plus
```

**Nominatim répond, Wikipédia répond, les canevas sont dessinés.** Le défaut est
entièrement à l'affichage. Une requête muette aurait ressemblé exactement à ça —
elle ne l'était pas.

### ② ⛔ LA CARTE DE D16-b SE TROMPE SUR CE POINT, ET ÇA RACCOURCIT LA TÂCHE

La carte dit, pour `ground-info` : *« posé en unités de bloc à la surface : demande
un **échantillonneur de sol de GLOBE** »*. **C'est faux.**

Le cartouche n'est pas posé sur le relief. Il est posé sur **la BASE** — un plan
horizontal unique, lu par `getBaseY()`, sur lequel `_addPlaneAt` couche les huit
mailles à la même hauteur (`getBaseY() + 0.05`). **Un nombre, pas un champ de
hauteurs.** Et le globe a déjà ce nombre : `parois-crop.js` lui construit une base
(`globe._baseYCrop`).

➡️ **Je n'ai eu besoin d'AUCUN échantillonneur de sol, et je n'en ai écrit aucun.**
La tâche `wt-carto` peut construire le sien sans se soucier de moi ; il n'y en aura
pas deux. **La ligne `ground-info` de la carte de D16-b est à corriger pour les
suivants** — et par symétrie, il vaut la peine de vérifier la même chose pour
`traffic` et `boats` avant de leur chiffrer un échantillonneur.

---

## LE DÉFAUT AVAIT DEUX MOITIÉS, ET LE BRIEF AVAIT RAISON SUR LES DEUX

### Moitié ① — le drapeau, la moitié non réparée du défaut des boutons

`main.js` : `groundInfo.setVisible(vue.socle && params.groundInfo)`.
`vue.socle` répond à « le maillage du bloc **plat** est-il dessiné » — non, sous le
mode sphère, à toutes les altitudes. Le cartouche répond à la même question que les
trois boutons du bas : « **sommes-nous devant un bloc** » — et il y en a un, un crop,
**avec une base**. La loi rend maintenant un quatrième champ, `cartouche`, et le §4
de `monde/visibilite-surface.js` porte la mesure.

### Moitié ② — la SCÈNE, et sans elle le drapeau ne montre rien

D16-a a posé `passeSurface.enabled = false` : **la scène du bloc n'est plus dessinée
du tout.** Le cartouche y vivait. `setVisible(true)` seul n'aurait rien montré — le
brief le disait, et c'est exact.

Il pend désormais d'un **groupe d'ancrage** (`groupeCartouche`), que le branchement
de la frontière de rendu fait adopter par `sceneGlobe`, et que `majCartoucheGlobe()`
pose à chaque image par la similitude.

### ⛔ Moitié ③ — celle que personne n'avait vue : `veilleSocle` NE TOURNE JAMAIS

Une première version de `cartoucheAffiche()` lisait `veilleSocle.visible`, comme
`socleAffiche()`. **Résultat mesuré à l'écran : cartouche toujours éteint.**
`majSeuilSocle` passe la main à `veilleCrop` dès `if (terreUniqueBranchee)` et le
dit en toutes lettres — **`veilleSocle` n'est jamais mise à jour**, son état reste
`socleAuDepart: !terreUniqueBranchee`, c'est-à-dire **faux pour toujours**.

Le prédicat juste se lit tout seul : **le cartouche est posé sur la base du crop ;
s'il y a une base, il y a un bloc.** `globe.baseYCrop` (accès public neuf) rend
`null` tant que les parois ne sont pas posées, et `retirerCrop` l'y remet.

---

## LA CONVERSION D'ESPACE — UNE SEULE HOMOTHÉTIE, ET UN SEUL NOMBRE À LA MAIN

⚠️ **Le brief annonce sept occurrences de la classe « conversion d'espace », dont un
facteur 121,6, un 10 et un 130,4. La parade n'est pas de convertir sept longueurs :
c'est de n'en convertir AUCUNE.**

Tailles de texte, distances au bord, anneau de sécurité `GAP`, rose des vents,
gravure murale : **tout est écrit en unités de bloc dans `ground-info-layer.js`, et
tout est porté ensemble par `group.scale = k`.** Sept occasions de se tromper
deviennent zéro. `1/k` vaut **130,4 à z12** et **2 791 à z16**, mesurés — c'est
exactement le « texte de 1 465 km » que le brief redoute, et le test ② le tue.

**La seule grandeur qui ne traverse pas par `k` est le niveau de la base**, parce
qu'elle n'a pas la même origine des deux côtés :

| | valeur mesurée | en unités de bloc |
|---|---|---|
| `plinth.baseY` (bloc plat, La Réunion) | −17,4074 | −17,4074 |
| `globe.baseYCrop` (fond du crop) | −0,11997936 unité de globe | **−15,6489** |

**1,76 unité d'écart, 11 % de la profondeur du crop.** Transporter `plinth.baseY`
tel quel aurait posé le cartouche **sous** le fond du crop, visible dès qu'on baisse
la caméra. `baseCartoucheEnBloc` porte la division par `k`, et le test tue la
mutation « × au lieu de ÷ » (elle rend −0,00092 au lieu de −15,65).

### La similitude n'est pas supposée — elle est recoupée par trois chemins

`poseFond` appelée sur **l'origine du bloc** (et non sur la cible caméra : c'est le
CROP qu'on suit, et le crop est posé sur le centre du bloc), comparée au maillage
`crop-parois` **déjà posé par le globe** :

| | `poseFond` (origine du bloc) | `globe._parois` |
|---|---|---|
| position | 77,05483557224011 · −36,241237327491284 · 52,43209925138888 | 77,05483557224011 · −36,24123732749129 · 52,43209925138887 |
| quaternion | 0,7295304024548144 · 0,2640562864582355 · −0,38599427266680136 · 0,49906722086751987 | 0,7295304024548144 · 0,2640562864582355 · −0,3859942726668014 · 0,4990672208675199 |

**Identiques à l'epsilon du double.** Troisième recoupement : `k = 0,007667070940797353`,
donc le demi-bloc `28 k = 0,2146780`, quand la boîte englobante des parois mesure
**0,2144811 … 0,2146865** en x. La même transformation, prise par les deux bouts.

➡️ **Le repère du crop EST l'image du repère du bloc par la similitude.** C'est ce
qui rend le relogement court : un groupe, une matrice.

---

## À L'ÉCRAN — `.banc/D16c/`

Banc reproductible : `node scripts/banc-cartouche-d16c.mjs --port 5545`
(Chrome sans tête, 1280×800, `.banc/D16c/releve.json`). Il enregistre, par palier,
la capture **et** la boîte du titre **projetée à l'écran, en pixels** — la seule
mesure qui attrape une erreur d'espace quand le texte sort du cadre.

| capture | état | cartouche | `k` | base servie | titre à l'écran |
|---|---|---|---|---|---|
| `01-reunion-z12.png` | z12, arrivée | **visible** | 0,0076671 | −15,6487 | 571 × 458 px |
| `06-reunion-de-pres.png` | z12, caméra rapprochée | **visible** | 0,0076671 | −15,6487 | **957 × 1 073 px** |
| `02-palier-fin.png` / `03-palier-large.png` | z12, deux distances | visible | 0,0076671 | −15,6487 | 842 × 851 / 552 × 437 px |
| `04-orbite.png` | orbite (crop retiré) | **éteint** | — | (repli −17,4074) | — |
| `05-retour-surface.png` | z5, au-dessus du seuil, crop absent | **éteint** | — | (repli) | — |

**`01-reunion-z12.png` est la preuve d'Adrien** : titre « RÉUNION / FRANCE » couché
sur la base au sud, coordonnées dessous, plage d'altitude et barre d'échelle au
nord-ouest, la description Wikipédia à l'ouest, le crédit « ↳ via Wikipedia », la
rose des vents au nord-est, et le nom gravé sur le flanc du crop. Lisible, à sa
place, à l'échelle du bloc.

**La taille à l'écran suit la distance** (458 → 1 073 px) : le cartouche vit dans le
monde, pas dans l'écran — c'est ce qu'on veut, et c'est ce qu'une échelle restée à 1
n'aurait pas donné (il aurait rempli l'image à toutes les distances).

**`04-orbite` et `05-retour-surface` prouvent l'extinction**, et par le bon chemin :
`baseYCrop` vaut `null`, donc il n'y a pas de base, donc pas de cartouche.

### Un deuxième `k`, mesuré, mais sans pixels

`gotoCtl.go('45.8326, 6.8652')` (Mont Blanc, z16) : le cartouche se recharge
(**« Auvergne-Rhône-Alpes / France », titre « Mont Blanc »**), `k = 0,00035826204`
— **21 fois plus petit** —, et la base convertie rend **+324,2156 unités de bloc**
(positive, et c'est juste : à z16 le crop fait 1,3 km de large et son fond est vers
2 700 m d'altitude réelle, donc au-dessus du niveau de la mer qui est l'origine du
repère du crop). **Les nombres traversent le changement de palier.**

⛔ **Mais rien n'est dessiné à cet état** — ni le bloc, ni la mer, ni le cartouche :
capture `07-montblanc-z16-crop-absent.png`, message d'application *« détail en
cours… 1 niveau de retard »*. **Ce n'est pas mon relogement** : le crop lui-même est
absent. Reproduit deux fois, en Chrome sans tête ET dans un navigateur avec GPU,
après 30 s et après 60 s d'attente. Voir les réserves.

---

## LA MISE À JOUR AU DÉPLACEMENT — ET CE QU'ELLE NE FAIT PAS

**Au repos, 601 images consécutives** (hook posé sur `load`, `render` et
`setVisible`) :

```
{ images: 601, load: 0, render: 0, setVisible: 0 }
```

**Zéro appel réseau, zéro regravure de canevas, zéro écriture de visibilité.**
L'indicateur qui tournait 38 secondes n'a pas de descendant ici.

**Au changement de lieu**, le rechargement part bien : La Réunion → Mont Blanc a
changé le nom, le pays, le titre Wikipédia et l'extrait, par le chemin qui existait
déjà (`fetchAndBuildDem` → `chargeCartouche`).

⚠️ **Ce que j'ajoute par image, et c'est tout** : `majCartoucheGlobe()` — un
`latLonOrigineBloc()`, un `largeurBlocM()`, un `poseFond` (arithmétique pure, pas
d'allocation de matrice), trois écritures sur le groupe. Et **il sort sèchement dès
que le cartouche est caché**.

⚠️ **La visibilité est synchronisée là aussi, et sur CHANGEMENT seulement** (une
comparaison de booléens par image, le patron d'`orthophotoPeinteDerniere`). C'est
nécessaire et pas cosmétique : les quatre sites qui écrivaient la visibilité sont des
**événements** (`entrerEnVol`, `fetchAndBuildDem`, le relais de mode, l'interrupteur
d'interface), alors que sous le mode sphère **le bloc naît et meurt sur une
ALTITUDE**, sans qu'aucun des quatre ne se produise. Sans cette synchro, le cartouche
serait resté posé sur une base retirée — c'est `05-retour-surface` qui le montre.

---

## `hud3` — REGARDÉ, PUIS LAISSÉ, ET VOICI POURQUOI

Le brief autorisait `hud3` et `hud3-pois` au titre du « tout le reste » d'Adrien,
**à condition de regarder ce qu'il affiche**. J'ai regardé.

**`hud3` ne porte AUCUNE information.**

- Le cadran (`platform`) est un décor de type FUI — graduations, croix de visée,
  glyphes aléatoires tirés d'un `mulberry32`. Et il est **déjà éteint ici** :
  `hud3.platform.visible = params.source !== 'real'`, or `params.source === 'real'`
  (vérifié dans l'application vivante). Sur terrain réel, il n'y a rien à montrer.
- Les points d'intérêt (`hud3-pois`) sont **trois boîtes par repère** — une tige de
  0,014 unité, un cube de 0,11, une embase de 0,22. **Aucun texte, aucune étiquette,
  aucun canevas.** `hud3d.js` calcule bien `p.feet` et `p.grid`… **et ne les dessine
  nulle part.** Et `feet` est de toute façon une altitude INVENTÉE
  (`4800 + h * 420`), faite pour du relief procédural.

➡️ **Le rallumer aurait ajouté quinze petits cubes au-dessus des crêtes, pas une
donnée.** Ce qu'Adrien appelle « les données Wikipédia et tout le reste » est porté
**en entier** par le cartouche : nom, pays, coordonnées décimales ET sexagésimales,
plage d'altitude, barre d'échelle, description, anecdote, crédit Wikipédia, rose des
vents, et le nom gravé sur le flanc. C'est ce qui revient à l'écran.

---

## COMMITS

| | |
|---|---|
| `e1aee0c` | **D16-c — le cartouche revient : drapeau ET scène, pas l'un des deux** |

Branche `info-globe`, partie de `83d6f66`.

## TESTS

**4 326 tests, 4 326 passent, 0 échec** (base 4 313 → **+13**) · **audit 222 = 222**
(base 221 ; `test/cartouche-globe.test.js` est **inscrit dans `package.json`**).

Test rouge d'abord : les trois assertions ④ de `cartouche-globe.test.js` (adoption
par `sceneGlobe`, pose par la loi, conversion de base) échouaient sur le dépôt intact
pendant que ①②③ passaient déjà — le module était juste avant que `main.js` ne le
consomme. Côté loi, le compte des lecteurs de `visibilite-surface.test.js` est passé
de **11 → 10 pour `vue.socle`, +1 pour `vue.cartouche`** : la redistribution devait se
déclarer là, et elle s'y déclare.

## FICHIERS TOUCHÉS

| fichier | quoi |
|---|---|
| **`src/monde/cartouche-globe.js`** | **NEUF** — loi pure : `ancrageCartouche` (la similitude) et `baseCartoucheEnBloc` (la seule conversion à la main) |
| **`test/cartouche-globe.test.js`** | **NEUF** — 13 tests, dont le relevé navigateur en dur |
| **`scripts/banc-cartouche-d16c.mjs`** | **NEUF** — banc de captures + boîte du titre en pixels |
| `src/monde/visibilite-surface.js` | §4 (le pourquoi, avec la mesure) + le champ `cartouche` |
| `test/visibilite-surface.test.js` | `cartouche` dans les cinq `deepEqual`, un test dédié, les comptes ③ |
| `src/globe.js` | **+17 lignes**, un seul ajout : l'accès public `get baseYCrop()` |
| `package.json` | la ligne `test` : `+ test/cartouche-globe.test.js` |

### ⚠️ `src/main.js` — LES LIGNES EXACTES, POUR LA FUSION

Deux autres tâches touchent ce fichier. Voici **tout** ce que j'y change, dans
l'ordre du fichier :

| ligne (après) | nature | ce que c'est |
|---|---|---|
| **64** | *modifiée* | `import { poseFond, plansFond, facteurEchelle }` — **un nom ajouté à un import existant** |
| **65** | *ajoutée* | `import { ancrageCartouche, baseCartoucheEnBloc } from './monde/cartouche-globe.js'` |
| **1941-1958** | *ajoutées* | le pavé « LE CARTOUCHE NE VIT PLUS DANS LA SCÈNE DU BLOC » + `const groupeCartouche` (1954) + `scene.add(...)` (1956) ; `new GroundInfoLayer({ scene,` → `scene: groupeCartouche,` (1958) |
| **1963-1973** | *remplacée* | `getBaseY:` — l'expression d'une ligne devient un corps de cinq (1969-1973), la branche `terreUniqueBranchee` en plus. **Hors mode sphère, elle rend la valeur d'avant, au caractère près.** |
| **3807** | *modifiée* | `socleAffiche()` → `cartoucheAffiche()` (le rallumage après chargement de zone) |
| **4722-4725** | *ajoutées* | `sceneGlobe.add(groupeCartouche)` dans le bloc `if (fusionDesPasses)`, à côté de `sceneGlobe.add(sunDisc.sprite)` |
| **4868-4930** | *ajoutées* | le pavé D16-c + `echelleCartouche()` (4892) + `majCartoucheGlobe()` (4910-4930), **juste après `const _IDENTITE`** |
| **5033** | *modifiée* | `groundInfo.setVisible(vue.socle && …)` → `vue.cartouche` (dans `poserVisibiliteSocle`) |
| **5094-5130** | *ajoutées* | `cartoucheAffiche()` (5124) et son pavé, **juste après `socleAffiche()`** |
| **11525** | *modifiée* | `socleAffiche()` → `cartoucheAffiche()` (l'interrupteur d'interface) |
| **12576** | *ajoutée* | `majCartoucheGlobe()` **immédiatement après `majCameraFond()`** dans la boucle |

⛔ **`socleAffiche()` N'EST PAS TOUCHÉE** — son corps est verrouillé au caractère près
par `test/seuil-branche.test.js` et `test/crop-branche.test.js`, et je l'ai laissé
intact. Ses emplois passent de **21 à 19** (le test exige ≥ 18).

⛔ **Rien touché de** `water`, `places`, `layer-manager`, le maillage du bloc,
`plinth`, `clouds2`, `traffic`, `real-water`, `boats`, le ruban GPX.

---

## RÉSERVES

1. ⛔ **LE CROP EST ABSENT À z16 APRÈS `gotoCtl.go`, ET CE N'EST PAS D16-c.**
   `07-montblanc-z16-crop-absent.png` : écran vide, message *« détail en cours… 1
   niveau de retard »*. **Ni bloc, ni mer, ni relief** — le cartouche n'est qu'un
   absent parmi tous les autres. Reproduit deux fois (Chrome sans tête ET navigateur
   avec GPU), après 30 s et après 60 s. Les nombres du cartouche y sont pourtant
   justes (`k`, base, nom, titre Wikipédia). **À regarder par la tâche qui possède
   la descente**, pas par celle-ci.

2. ⚠️ **LA MOLETTE ARRIÈRE ET `stepFiner`/`stepWider` NE CHANGENT PAS DE PALIER**
   dans l'état par défaut mesuré : `params.demZoom` est resté à 12 sur 25 crans de
   molette arrière et sur deux `stepWider()`, et `camera.position.y` a plafonné à
   74,96. La molette AVANT fonctionne. **Je n'ai donc pas pu montrer deux paliers en
   images dans une même session** ; le second `k` est mesuré, pas photographié.
   Symptôme voisin de la réserve ①.

3. ⚠️ **LA RÈGLE DU QUART DE SOCLE EST INERTE DANS L'ÉTAT PAR DÉFAUT.**
   `doitRafraichirCartouche` compare `groundInfo.lastFenetre`, qui vaut `null` tant
   que `dem.empriseCote === 1` — ce qui est le cas ici (mesuré : `terrain.fenetre`
   reste `{x:0, z:0}`, `lastFenetre` reste `null`). La règle **ne peut pas se
   déclencher**, par construction et non par défaut. Le rechargement au changement
   de lieu, lui, marche et est vérifié. **Je n'ai rien changé à ce mécanisme** ; il
   redeviendra actif quand l'emprise 3×3 le sera. À ne pas confondre avec une
   régression du cartouche.

4. ⚠️ **LE CARTOUCHE SERAIT ENTERRÉ SI LES ALENTOURS DU CROP ÉTAIENT DESSINÉS.**
   Il vit **sous** la surface de la sphère (rayon 100 − 0,12 unité) : la Tâche N
   (« on ne calcule pas le dehors », `poserCropSeul`) éteint tout ce qui est hors du
   crop **au repos**, et c'est exactement ce qui le laisse visible. Pendant un zoom,
   l'estompage rallume les alentours ; je n'ai pas vu de recouvrement dans les
   captures, **mais je ne l'ai pas cherché image par image**. Si quelqu'un supprime
   `poserCropSeul`, le cartouche disparaîtra sous le terrain voisin — et ce sera par
   ce chemin-là.

5. ⚠️ **L'ANCRAGE GARDE SA DERNIÈRE POSE QUAND LE CARTOUCHE EST CACHÉ**, puisque
   `majCartoucheGlobe` sort avant de la recalculer. C'est voulu (rien à dessiner),
   et sans conséquence : la première image où il se rallume repose la matrice avant
   le rendu. Écrit pour qu'un relevé de `group.parent.scale` en orbite ne soit pas
   lu comme un bogue — c'est ce que montre `releve.json` au palier `05`.

6. ⚠️ **LE §4 QUE J'AJOUTE À `visibilite-surface.js` CORRIGE LA CARTE DE D16-b PAR
   LA BANDE.** La ligne « `ground-info` : demande un échantillonneur de sol de
   GLOBE » de `rapport-D16.md` reste écrite là-bas, fausse. **Je ne l'ai pas éditée**
   — c'est le rapport d'une autre tâche. Quelqu'un devrait, et devrait au passage
   revérifier `traffic` et `boats` : la même erreur de lecture peut leur avoir été
   appliquée.
