# GX2 — LE TRACÉ GPX EST REMIS DANS LA SCÈNE QUI EST RENDUE

Arbre `C:\Dev\wt-gx2`, branche `gpx-correctif`. **Le tracé est dessiné**, au repos
comme pendant la lecture, sur les trois tracés. Le calque passe de **0 pixel** à
**~1 250 pixels** posés au repos sur le Mont-Blanc au cadrage de référence
(témoin `?terre=deux` : 1 283), et à **0 image sans tracé sur 20 relevés de
lecture — sur les TROIS tracés, avec un plancher de bruit de 0 pixel**.

⚡ **Et le défaut avait DEUX moitiés, pas une.** GX1 en avait mesuré la première
(la scène). La seconde — **`vue.socle`, borné à faux sous `terre unique`,
ÉTEIGNAIT le calque** — n'apparaît qu'une fois la première réparée, et c'est
elle qui explique le « **lorsqu'on lance la lecture** » d'Adrien.

---

## ⓪ LIGNES DE `main.js` TOUCHÉES — pour l'agent `wt-ramp`

Quatre endroits, aucun dans `terrain.js`, `rampe-crop.js` ni le panneau de
réglages :

| lignes | ce qui y est écrit |
|---|---|
| **5 026 – 5 045** | le dépôt `gpxPoseGlobe` (objet inerte : caméra + fabrique), juste après `const fusionDesPasses` |
| **5 126 – 5 158** | dans `if (fusionDesPasses)` : la fabrique de poseur devient la constante nommée `faitPoseurGlobe` (déjà utilisée par `mapLayers`, maintenant partagée avec le GPX) + les deux lignes de dépôt |
| **5 683 – 5 702** | dans `poserVisibiliteSocle` : `gpxLayer.setVisible(vue.reperes && …)` au lieu de `vue.socle` |
| **8 530 – 8 541** | après `const gpxLayer = new GpxLayerManager(…)` : `gpxLayer.poserScene(sceneGlobe)` + `gpxPoseGlobe.appliquer(gpxLayer)` |

---

## ① LES DEUX MOITIÉS DU DÉFAUT

### ⓐ La scène — établie par GX1, réparée ici

D16-a a éteint la passe de surface sous `terre unique` et a déménagé un par un
le disque solaire, le cartouche, les nuages, les cotes et la cartographie dans
`sceneGlobe`. **Le calque GPX était le sixième objet de ce déménagement, et il a
été oublié** : `gpx.js` faisait toujours `scene.add(this.group)`.

Le correctif tient en trois gestes, et **le troisième est celui sans lequel les
deux premiers ne valent rien** (GX1 l'avait mesuré : adoption + caméra =
**0 pixel quand même**) :

1. **L'adoption de scène** — `poserScene()` sur `GpxLayer` et
   `GpxLayerManager`, écrits sur le modèle exact de `MapLayers.poserScene` : un
   seul écrivain, il DÉPLACE au lieu d'ajouter, et la scène est **retenue** pour
   les calques ajoutés ensuite (le piège de la tâche 22 : un défaut qui ne se
   voit qu'au deuxième chargement).
2. **La caméra** — `camGlobe`, celle qui dessine.
3. ⛔ **LA SIMILITUDE.** Le ruban est cuit en unités de BLOC (**727,6 m/unité**
   au Mont-Blanc, 190,0 en Camargue, 91,0 à Chamonix) ; le crop est une découpe
   de la sphère `R_GLOBE = 100` (**63 710,1 m/unité**). **Facteur 87,56 à ce
   cadrage — 335 et 700 aux deux autres : IL DÉPEND DU ZOOM.** Il n'est donc
   écrit nulle part en dur : il est relu à chaque reconstruction par
   `poseur.rapportSimilitude()`. Le chemin est celui qui existait déjà —
   `poseurPourReconstruction` (`monde/sol-globe.js`), **la même fabrique et la
   même expression de `echelleBloc` que `mapLayers`**, extraite en constante
   nommée plutôt que réécrite.

### ⓑ ⚡ LA VISIBILITÉ — trouvée APRÈS, et seulement parce que le banc l'a dit

`main.js` : `gpxLayer.setVisible(vue.socle && params.gpxVisible)`.

⛔ **`vue.socle` est borné à FAUX sous `terre unique`** (`visibilite-surface.js`
le dit en toutes lettres : « sous le drapeau, la réponse est NON, à toutes les
altitudes »). Le tracé était donc **éteint à chaque passage de cette fonction**
— c'est-à-dire à chaque changement de vue, au clic Lecture, pendant le vol de
poursuite.

**C'est la CINQUIÈME occurrence du même partage** : la carto (D16-b), le
cartouche (D16-c), les repères (R18), les nuages (R20), les cotes (R24) — et
maintenant le tracé. Sa question est celle des repères, pas celle du maillage :
depuis l'adoption, le tracé est posé sur la sphère par la même similitude que la
carto. `vue.socle` → **`vue.reperes`**.

**Comment il a été trouvé** : après la réparation ① le tracé était là au repos
(1 200 px) mais les vingt relevés de lecture sortaient à **0 pixel avec un
témoin de bruit à 0** — un calque éteint, pas un calque mal placé. La garde de
CLASSE de `test/visibilite-surface.test.js` (« le compte des lecteurs ») a rougi
**avant** que la moindre ligne de commentaire ne soit écrite : 6 lecteurs de
`vue.socle` au lieu de 7. Elle a fait son travail pour la troisième fois.

### Où la conversion s'applique, et à quoi

| objet | ce qu'il subit | pourquoi |
|---|---|---|
| ruban, sillage, ligne Line2, halo | **chaque sommet** par `placer` | c'est ce qui porte les pixels ; aucune approximation |
| étiquettes, bornes km, villages | position placée, **échelle NON touchée** | `sizeAttenuation = false` : taille en fraction d'écran, la multiplier par `k` (÷ 87,56) les ferait disparaître |
| arches | similitude de GROUPE **ancrée sur l'arche** | le GLB arrive de façon asynchrone, ses sommets ne peuvent pas être convertis un à un ; l'ancrage rend la pose exacte au pied, et une arche fait dix mètres |
| curseur de survol, tolérance de picking | position placée, **planchers × k** | `0,5` et `0,4` sont des longueurs de bloc : 0,5 unité de globe = 31 855 m |
| `track.world` | **rien, il reste en unités de bloc** | le profil, la tête de course, le suivi caméra et les cartouches en dépendent tous. Un jumeau `_worldScene` sert au survol 3D — converti UNE fois par reconstruction, pas 2 400 trigonométries par mouvement de souris |

⚡ **Et le sol se lit maintenant SUR LE GLOBE** (`poseur.hauteur`) : sans ça le
ruban se draperait sur les hauteurs du bloc pendant que le GPU dessine celles du
globe. `null` retombe sur le bloc, jamais sur zéro.

---

## ② LA PREUVE À L'ÉCRAN

Pixels comptés **par DIFFÉRENCE** (tracé allumé / éteint), grain et animations
coupés, images issues de la boucle de l'application, **témoin A/A à chaque
relevé**, comptage **restreint au rendu 3D** (bandeau de course et panneaux
exclus).

### Au repos — banc de référence `scripts/banc-gx1-position.mjs`

| tracé | AVANT (GX1) | **APRÈS** | attendus | témoin `?terre=deux` |
|---|---|---|---|---|
| Mont-Blanc 90 km | **0** (×6) | **1 216 – 1 499** | 2 018 | **1 283** (GX1 : 1 053) |
| Camargue 5 km, plat | **0** | **1 440** | 1 437 (**100 %**) | — |
| Chamonix 4 km, montagne | **0** | **236** | 581 | **276** (le témoin fait 49 %) |

Le témoin A/A vaut **0 pixel**. ⚠️ Les deux tracés courts ont été relevés avant
le correctif ⓑ, qui ne peut qu'augmenter ces chiffres.

### Quatre échelles — banc `scripts/banc-gx2-preuve.mjs`

Zoom par `modes.cranZoom(1)` (⛔ pas `page.mouse.wheel` : le voile l'avale) :

| tracé | cran 0 | cran 1 | cran 2 | cran 3 |
|---|---|---|---|---|
| Mont-Blanc | **1 210** px @ 26 484 m | **2 132** @ 18 567 m | **3 220** @ 12 969 m | **5 767** @ 9 010 m |
| Camargue | **1 977** @ 6 943 m | **2 594** @ 4 868 m | **4 124** @ 3 401 m | **6 620** @ 2 363 m |
| Chamonix | 986 @ 3 313 m | 1 639 @ 2 323 m | 1 749 @ 1 667 m | 809 @ 1 159 m |

Les trois tracés couvrent ensemble **26 484 m → 1 159 m**, soit les quatre
bandes d'altitude du barème. (Les relevés Chamonix contiennent une part de HUD :
ils précèdent le correctif de zone du banc — voir §⑤ ③.)

### Pendant la lecture — l'éliminatoire E2

Caméra **figée avant le clic** (suivi coupé), tracé entier dans le champ, 20
relevés consécutifs, deux mesures par image :

| tracé | médiane sur 20 relevés | **images sans tracé** | bruit médian |
|---|---|---|---|
| **Mont-Blanc 90 km** | **863 px** | **0 / 20** | **0 px** |
| **Camargue 5 km, plat** | **916 px** | **0 / 20** | **0 px** |
| **Chamonix 4 km, montagne** | **979 px** | **0 / 20** | **0 px** |

⚡ **Et le compte CROÎT de façon monotone avec `headT`, sur les trois** — c'est
le dévoilement qui avance, image par image :

```
Mont-Blanc  676 · 742 · 748 · 769 · 778 · 786 · 814 · 823 · 835 · 854 · 863 · 879 · 893
Camargue    840 · 863 · 890 · 916 · 937 · 955 · 978 · 993 · 1038 · 1052
Chamonix    729 · 784 · 836 · 883 · 932 · 979 · 1023 · 1076 · 1120 · 1172
```

⛔ **Rappel du barème : « 0 image sous 30 px » ET « le nombre de pixels croît de
façon monotone avec `headT` ». Les deux sont tenus, sur les trois tracés, avec un
plancher de bruit de 0 pixel.**

### Les captures pour Adrien — `.banc/GX2/`

| fichier | ce qu'on y voit |
|---|---|
| `mb-z0.png` · `mb-z0-surligne.png` | la même image, et **les pixels du tracé peints en vert** : ils dessinent la boucle du Marathon dans la vallée de Chamonix, bornes kilométriques comprises |
| `mb-z3.png` | le tracé en vermillon sur le relief, cadrage serré |
| `camargue-lect10.png` | **le tracé en pleine lecture** : ruban large, net, tête de course visible |
| `chamonix-apres-lecture.png` | fin de lecture : le tracé et ses deux arches, sur le versant |

⛔ `.banc/` est git-ignoré : tous les chiffres sont recopiés ici.

---

## ③ CE QUI N'A PAS BOUGÉ — vérifié, pas supposé

| grandeur | GX1 (avant) | **après** | verdict |
|---|---|---|---|
| aller-retour lat/lon (60 points) | 0,00 m moy et max | **0,00 m** | inchangé |
| déformation (40 paires vs géodésique) | 0,01 % moy · 0,13 % max | **0,02 % · 0,14 %** | inchangé (tirage aléatoire) |
| échelle du bloc | 727,6 / 190,0 / 91,0 m/u | **727,6 / 190,0 / 91,0** | inchangé |
| drapage, Camargue (plat) | **+2,6 m** (−1,2 / +3,6) | **+2,6 m** (−1,2 / +3,6) | inchangé au dixième |
| drapage, Chamonix | +2,2 m | **+2,2 m** | inchangé |
| drapage, Mont-Blanc | −4,7 m (−68,2 / +52,2) | **−4,7 m (−68,2 / +52,2)** | inchangé |

⚡ **Ces trois lignes de drapage sont la meilleure preuve que la conversion est
juste** : le ruban prend désormais sa hauteur SUR LE GLOBE, et l'écart au sol du
BLOC reste identique au dixième de mètre — les deux hauteurs sont la même donnée.

**E3, aucune régression sous `?terre=deux`** : **1 283 px** au même cadrage
contre 1 053 mesurés par GX1 (seuil ≥ 950), drapage et déformation identiques.
Le test ③ de `gpx-pose-globe.test.js` garde l'identité de la conversion hors
globe, au flottant près.

**Coût** (même cadrage, tracé allumé / éteint / rallumé) :

| grandeur | tracé éteint | tracé allumé |
|---|---|---|
| image médiane | 16,60 ms | **16,60 – 16,70 ms** |
| p95 | 17,20 ms | 17,10 – 17,70 ms |
| géométrie du calque | — | 2,03 Mo (25 500 sommets) — **inchangée** |
| requêtes réseau | — | **0 de plus** (le poseur ne lit que des tuiles déjà chargées) |

La conversion coûte **une passe par RECONSTRUCTION**, jamais par image.

---

## ④ LES TESTS — 7 verts, et un huitième fichier qui MORD LES PIXELS

```
7 tests de GX1  ·  pass 7  ·  fail 0
suite complète  ·  tests 4 992  ·  pass 4 992  ·  fail 0
npm run audit:tests  ·  273 listés · 273 sur disque · Aucun écart
```

⚠️ **L'auteur des sept tests prévient qu'ils gardent le CÂBLAGE, pas les
pixels** — un correctif simulé les rend tous verts en laissant 0 pixel à
l'écran. **J'ai donc rendu une garde sensible à la géométrie**, comme le brief le
demandait.

`test/gpx-pose-globe.test.js` (3 tests, **EXÉCUTÉS**) prend de vrais sommets de
bloc, les passe par `poseTableauEnPlace` — la fonction que `gpx.js` appelle
vraiment, extraite dans `monde/sol-globe.js` **pour être testable** — et
vérifie :

1. qu'ils **quittent l'espace du bloc** (rayon > 90 unités au lieu de < 40) et
   tombent **sur la surface dessinée** (`R_GLOBE + h × echelleGlobe`, à 1e-6) ;
2. que le facteur vaut **87,56 / 335,3 / 700,1** aux trois cadrages — donc qu'il
   n'est pas une constante ;
3. qu'hors globe la conversion est **l'identité**, sommet par sommet.

➡️ **Le correctif simulé de GX1 (adoption + `setCamera`) laisse ce fichier
ROUGE.**

Et `test/visibilite-surface.test.js` ③ a été mis à jour comme R20 et R24 l'ont
fait avant : `socle` 7 → **6**, `reperes` 1 → **2**, avec la mesure qui justifie
la redistribution écrite à côté du compte.

---

## ⑤ CE QUE J'AI CRU, PUIS RÉFUTÉ

1. **« Les tests verts, c'est fini. »** ⛔ Réfuté par la mesure, exactement comme
   l'attaquant l'avait annoncé : les 7 tests étaient verts **avant** que le
   moindre sommet ne bouge. Le premier banc qui a suivi affichait encore
   **0 pixel** au repos. C'est la similitude, écrite après, qui a allumé le tracé.
2. **« Le tracé remis dans la bonne scène, c'est réparé. »** ⛔ Réfuté par le
   banc : au repos oui, **en lecture non** — `vue.socle` l'éteignait (§①ⓑ). Une
   seule cause aurait suffi à laisser Adrien avec exactement le même symptôme.
3. **« Le banc de GX1 dit la vérité tel quel. »** ⛔ **Réfuté quatre fois, et ce
   sont MES faux constats :**
   - il projetait avec `e.camera`, **la caméra du BLOC**, alors que l'image sort
     de `camGlobe` : *« 0/48 sommets à l'écran, attendus 0 »* **sur une image où
     le tracé occupe le centre**. Le banc choisit maintenant la caméra **en
     mesurant** laquelle met le plus de sommets à l'écran ;
   - il comptait **douze salves fixes** avant de mesurer : un relevé est sorti
     avec le MNT pas encore centré (drapage `−766,5 m` partout, `dansBloc:false`).
     Il attend maintenant que **le drapage existe** ;
   - il comptait **toute l'image, HUD compris** : un relevé annonçait 2 526
     « pixels de tracé » sur une image où la vue 3D ne montrait **que le ciel** —
     c'étaient le profil et la barre de progression qui avançaient ;
   - il comparait deux captures séparées par **un seul tour** : trois relevés sur
     vingt sortaient à **exactement 0 pixel** pendant que le témoin de bruit de
     la même image en annonçait 2 500. Deux images identiques au pixel près
     pendant que la scène bouge, **c'est une capture rendue deux fois**.
4. **« Il suffit de figer la caméra après le clic Lecture. »** ⛔ Réfuté deux
   fois : arrêtée en plein vol, elle regarde le ciel, ou une vallée où les 4 km
   déjà dévoilés n'entrent pas dans le champ (`mb-lecture-lect10.png`). Vingt
   relevés à 0 pixel **avec un bruit à 0**. Le suivi se coupe donc **avant** le
   clic : la caméra ne quitte plus le cadrage d'arrivée, le tracé entier reste
   dans le champ, et le bruit tombe à 0 sur les vingt relevés.
5. **« ≥ 40 sommets sur 48 à ≤ 6 px, c'est atteignable. »** ⛔ Réfuté **par le
   témoin lui-même** : sous `?terre=deux`, le régime où le tracé a toujours été
   dessiné, le banc rend **13/48, médiane 19,1 px** — le chiffre exact de GX1.
   Après correction, la production rend **12/48, médiane 26,9 px** au Mont-Blanc
   et **3/48 contre 3/48** à Chamonix : **la parité avec le témoin.** Ce que cette
   mesure chiffre n'est pas la position (aller-retour 0,00 m) mais **combien du
   ruban le relief cache** — un ruban de 1,5 px de large vu de 26 km passe
   derrière chaque crête.
6. **« Le facteur d'échelle est une constante à écrire une fois. »** ⛔ Réfuté :
   87,56 / 335,3 / 700,1 aux trois cadrages. Il est relu, jamais écrit.
7. **« `_construitRuban` et `rebuild()` peuvent garder deux demi-emprises
   différentes. »** GX1 le signalait comme inerte (§⑧). Alignées sur
   `demSpan(dem)/2` : deux écritures d'une même limite finissent toujours par se
   contredire.

---

## ⑥ ⚠️ LE SEPTIÈME OBJET OUBLIÉ — `boats`

Relevé au navigateur, contenu réel des deux scènes en production :

| objet resté dans la scène du bloc | `visible` | lecture |
|---|---|---|
| lumières (3) | oui | sans objet : `sceneGlobe` porte l'`environment` |
| `plinth`, `real-water`, `traffic`, hud3 | **non** | éteints volontairement — socle et mer viennent du crop |
| **`boats`** | ⚠️ **OUI** | **groupe ALLUMÉ dans une scène que personne ne rend** |

⚡ **`boats` (`src/boats.js:43`) est le seul objet encore allumé dans la scène
morte.** Son groupe était vide à l'instant du relevé (aucun bateau engendré sur
un cadrage alpin), **je ne l'ai donc pas corrigé — je ne l'ai pas vu manquer à
l'écran**, et je ne voulais pas poser une similitude sur une flotte sans banc
pour la mesurer. Mais tout dit qu'un bateau engendré au bord d'une mer, en
production, est aujourd'hui dessiné dans le tampon que personne ne regarde.
**C'est le prochain à vérifier, et le geste est celui de ce rapport.**

Trois autres observations, signalées et non corrigées :

- **Les arches sont des `MeshStandardMaterial` et `sceneGlobe` ne porte AUCUNE
  lumière** — seulement `environment`. Elles seront plus plates que sur le bloc.
- **Un tracé qui déborde du socle est dessiné DANS LE VIDE** (visible sur
  `mb-z3.png`, la boucle ouest flotte hors du bloc) au lieu d'être écrêté au
  bord. ⚠️ Ni une régression ni un effet de cette tâche : c'est le repli à plat
  de `rebuild()` pour les points hors bloc, déjà présent sous `?terre=deux`.
  C'est le point « dans le crop ET hors du crop » du barème, et je le rends
  **non tenu**.
- **`setFenetre` pose un décalage en unités de BLOC sur un groupe qui vit
  maintenant dans la scène du GLOBE.** Inoffensif aujourd'hui (le mode continu
  3×3 est éteint sous `terre unique`, et hors de lui le décalage vaut 0), mais
  un commentaire l'attend dans `gpx.js` : le jour où les deux s'allumeront
  ensemble, il faudra le passer par `k`.

---

## ⑦ COMMENT REJOUER

```bash
node_modules/.bin/vite --host 127.0.0.1 --port 9471 --strictPort

node scripts/banc-gx1-position.mjs --port 9471 --etiquette mb
node scripts/banc-gx1-position.mjs --port 9471 --etiquette mb-deux --adresse "terre=deux"
node scripts/banc-gx1-position.mjs --port 9471 --gpx .banc/court-plat-camargue-5km.gpx --etiquette camargue
node scripts/banc-gx1-position.mjs --port 9471 --gpx .banc/court-montagne-chamonix-4km.gpx --etiquette chamonix

node scripts/banc-gx2-preuve.mjs --port 9471 --etiquette mb                  # 4 échelles + 20 images + captures surlignées
node scripts/banc-gx2-preuve.mjs --port 9471 --etiquette mb-lecture --lecture-seule   # E2 seul, ~6 min
npm test && npm run audit:tests
```

⚠️ Les deux tracés courts viennent de `C:\Dev\wt-gx1\.banc\` (git-ignoré) et ont
été recopiés dans `.banc/`. ⚠️ Un banc peut se bloquer si l'onglet sans tête
cesse de composer : `banc-gx2-preuve.mjs` borne chaque attente à 20 s,
`banc-gx1-position.mjs` non — s'il ne rend pas la main en 15 minutes, il est
bloqué, il faut le relancer.
