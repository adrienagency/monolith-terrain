# GX1 — LE TRACÉ GPX : la panne mesurée, le barème, les tests rouges

Arbre `C:\Dev\wt-gx1`, branche `gpx-attaque`. **`git diff -- src/` est vide** :
rien n'a été corrigé. Bancs sous `scripts/banc-gx1-*.mjs` et
`scripts/diag-gx1-*.mjs`, relevés et captures sous `.banc/GX1/`.

---

## ⓵ LE VERDICT EN UNE PHRASE

**Le tracé GPX n'est pas mal placé : il n'est pas dessiné du tout.** Au régime
de production (mode sphère depuis le 2026-08-30), le calque GPX pose **0 pixel
à l'écran**, à l'arrêt comme en lecture, sur les trois tracés testés. Sa
géométrie, sa position, son échelle et son drapage sont **justes** — mesurés
comme tels. Il vit simplement dans une scène que plus personne ne rend.

**L'hypothèse d'Adrien est CONFIRMÉE, et précisée : ce n'est pas un facteur
d'échelle, c'est une PASSE DE RENDU supprimée.**

---

## ⓶ LE DÉFAUT, CHIFFRÉ

Banc `scripts/banc-gx1-position.mjs`. Chemin fixe : démarrage par défaut →
`__exp.loadGpxText(gpx)` (la porte de « Load GPX… ») → ~30 s de pose →
mesure → **clic sur `.cb-play`**, le vrai bouton Lecture de la barre de course.
Ni lien profond `#s=`, ni `gotoCtl.go`.

### ⓐ Le tracé à l'arrêt — avant même de lancer la lecture

| tracé | régime | pixels posés par le tracé (6 relevés) | attendus par la géométrie | points retrouvés |
|---|---|---|---|---|
| Marathon Mont-Blanc 90 km | **production (sphère)** | **0 0 0 0 0 0** | **2 019** | **0 / 48** |
| Marathon Mont-Blanc 90 km | `?terre=deux` | **1 053 1 053 1 053 1 053** | 2 107 | 13 / 48 (médiane 19,1 px) |
| Camargue 5 km, plat | production | **0** (médiane de 6) | 1 438 | 0 / 48 |
| Chamonix 4 km, montagne | production | **0** (médiane de 6) | 581 | 0 / 48 |

*« attendus »* = longueur du tracé à l'écran (px) × largeur du ruban à l'écran
(px), calculée depuis la demi-largeur monde (0,066 u), la distance caméra et le
champ de vision. *« points retrouvés »* = sur 48 sommets projetés, combien ont
un pixel de tracé à moins de 40 px.

⚠️ **Le témoin de bruit A/A vaut 0 pixel** à chacun de ces relevés : ce ne sont
pas des zéros de méthode.

### ⓑ Pendant la lecture

Caméra figée juste après le clic Lecture (le suivi coupé, le dévoilement
continue), tracé **entièrement dans le champ** — Chamonix 4 km :

```
figée  6..21  headT=1.000  tracé=0 px  bruit=0 px  attendus=5 938  visibles=24/24
```

**16 relevés consécutifs, 0 pixel de tracé sur 5 938 attendus, avec les 24
sommets échantillonnés à l'écran.** Aucune image ne montre le tracé, ni au
début, ni au milieu, ni à la fin de la lecture.

### ⓒ Ce qui est JUSTE — et qu'il ne faut pas « corriger »

| grandeur | mesure | verdict |
|---|---|---|
| conversion lat/lon → monde (aller-retour, 60 points) | **0,00 m** en moyenne **et** au max | exacte |
| échelle / déformation (40 paires vs géodésique) | moy **0,01 %**, max **0,13 %** | exacte |
| échelle du bloc | 727,6 m/unité (Mont-Blanc), 190,0 (Camargue), 91,0 (Chamonix) | cohérente |
| drapage, Mont-Blanc | moy **−4,7 m**, min −68,2, max +52,2 | acceptable, à border |
| drapage, tracé plat (Camargue) | moy **+2,6 m**, min −1,2, max +3,6 | bon |
| drapage, montée courte (Chamonix) | moy **+2,2 m**, min +0,2, max +3,5 | bon |
| lecture (`headT`) | avance de 0 à 1, s'arrête à 1 | fonctionne |
| barre de course, profil, chiffres D+/D− | affichés et à jour | fonctionne |

**Il n'y a donc ni erreur de position horizontale, ni erreur d'échelle, ni
déformation.** Les trois erreurs que le brief demandait de distinguer se
réduisent à une seule : **le tracé n'atteint pas l'écran**.

---

## ⓷ LA CAUSE, ÉTABLIE PAR LA MESURE PUIS RETROUVÉE DANS LE CODE

### La mesure d'abord

`scripts/diag-gx1-scene.mjs` intercepte `renderer.render` et identifie chaque
appel par l'uuid de sa scène. **Une image du régime de production :**

| # | scène | caméra | cible |
|---|---|---|---|
| ① | **`sceneGlobe`** — uuid `0d759b58`, 7 objets | perspective, near 0,168 far 201,9 | tampon |
| ② ③ | passes plein écran du compositeur | orthographique | tampon |
| ④ | passe finale | orthographique | **ÉCRAN** |

`__exp.scene` — uuid **`8685cd6b`**, 10 objets, **parent du groupe `gpx`**
(`gpxParent: true`) — **n'apparaît dans aucune des quatre passes**.

### Le code ensuite

`src/main.js:5025` — Tâche **D16-a** :

```js
const fusionDesPasses = frontiereActive && terreUniqueBranchee
if (fusionDesPasses) {
  passeSurface.enabled = false          // ← la scène du bloc n'est plus rendue
  sceneGlobe.add(sunDisc.sprite)        // D16-a
  sceneGlobe.add(groupeCartouche)       // D16-c
  sceneGlobe.add(groupeNuages)          // R20
  sceneGlobe.add(groupeCotes)           // R24
  mapLayers.poserScene(sceneGlobe)      // D16-b (+ setCamera, + poseur)
}
```

Chaque calque qui devait survivre a été **déménagé un par un**. **Le calque GPX
n'est pas dans la liste.** `src/gpx.js:597` fait toujours
`scene.add(this.group)` — la scène éteinte.

Le commentaire de D16-b décrit mot pour mot ce qui arrive au tracé aujourd'hui :
> *« Ils n'étaient pas cachés : ils étaient dessinés dans un tampon que plus
> personne ne regarde. »*

Et `monde/visibilite-surface.js` l'écrit déjà pour le maillage du bloc :
> *« sous le drapeau, la réponse est NON, à toutes les altitudes. »*

### La bissection des drapeaux le confirme (mesure indépendante)

Pixels posés par le tracé à l'arrêt, même geste, même tracé :

| adresse | pixels | lecture |
|---|---|---|
| *(défaut, production)* | **0** | cassé |
| `?terre=deux` | **1 064** | ✅ le tracé revient |
| `?frontiere=0` | **1 060** | ✅ (coupe aussi `terreUnique`, par la chaîne) |
| `?globe=crans` | 0 | — |
| `?seuil=0` | 0 | — |
| `?socle=mnt` | 0 | — |
| `?planete=nue` | 0 | — |
| `?f3=1` | 0 | — |

**Le drapeau fautif est `terreUnique`, et lui seul.**

---

## ⓸ ⛔ LE PIÈGE DU CORRECTIF — MESURÉ, PAS SUPPOSÉ

**`sceneGlobe.add(couche.group)` tout seul NE SUFFIT PAS.** Essai appliqué au
produit puis remesuré au banc (`.banc/GX1/PATCH-naif*`) : adoption de la scène
du globe **+ caméra du globe**, sans similitude →

```
pixels de tracé : 0 0 0 … (médiane 0)   attendus 2 019
```

**Toujours zéro.** Le ruban est cuit en coordonnées de **BLOC**
(`latLonToWorld`, demi-emprise 28 unités autour de l'origine) ; le crop est une
découpe de la **sphère `R_GLOBE = 100`**, posée à ~100 unités de l'origine.

**Les deux espaces, chiffrés au cadrage du banc :**

| espace | mètres par unité | d'où |
|---|---|---|
| **bloc** (là où vit le ruban) | **727,6 m/u** (Mont-Blanc), 190,0 (Camargue), 91,0 (Chamonix) | mesuré sur la paire de points la plus éloignée |
| **globe** (là où vit le crop) | **63 710,1 m/u** | `ORBITAL_M_PER_UNIT = EARTH_RADIUS_M / R_GLOBE` |

➡️ **Facteur 87,56** au cadrage du Mont-Blanc (335 au cadrage de Camargue, 700
à celui de Chamonix : **le facteur dépend du zoom**, ce n'est pas une
constante). Reparenter sans poser la similitude place le tracé à ~100 unités de
globe du crop, soit **≈ 6 371 km** — hors de tout.

**Le chemin qui existe déjà** : `poseurPourReconstruction`
(`src/monde/sol-globe.js`), tel que `mapLayers` le reçoit
(`poserFabricantDePoseur` + `setCamera(camGlobe)`, `main.js:5100`).

⚠️ **Et une contrainte d'ORDRE, payée à l'essai** : `gpxLayer` est construit
**ligne 8 487**, trois mille lignes APRÈS la chaîne de passes (~5 100). Une
adoption écrite dans le bloc `if (fusionDesPasses)` de la chaîne **empêche la
page de démarrer** (zone morte du `const` — la première image n'arrive jamais,
banc en délai de 120 s). L'adoption doit se faire au plus tôt à la construction
du gestionnaire.

---

## ⓹ CE QUE J'AI CRU, PUIS RÉFUTÉ

1. **« Le tracé est masqué par le relief / passe sous le terrain. »** Réfuté :
   `depthTest = false`, `renderOrder = 9999`, matériau opaque → **0 pixel**
   quand même. Rien de ce qui se dessine ne peut être caché à ce régime-là.
2. **« C'est la lecture qui casse le tracé. »** Réfuté : le tracé pose déjà
   **0 pixel à l'arrêt**, avant tout clic Lecture. La lecture ne fait que
   rendre l'absence évidente — c'est à ce moment-là qu'on cherche le tracé des
   yeux. **Le correcteur ne doit pas chercher dans l'animation.**
3. **« C'est un facteur d'échelle entre les trois espaces »** (la classe de
   défaut revenue treize fois ici). Réfuté par la mesure : aller-retour
   lat/lon **0,00 m**, déformation max **0,13 %**. Le facteur 87,56 existe
   bien — mais il est le piège du CORRECTIF, pas la cause du défaut.
4. **« 0 image sans tracé sur 24 : la lecture va bien. »** ⛔ **FAUX CONSTAT
   QUE J'AI PRODUIT MOI-MÊME AU PREMIER TOUR.** Le banc comptait les pixels
   « vermillon » (r > 120, r − b > 55) : il a rendu **44 102 pixels de tracé
   sur une image qui n'en montre aucun** — les rampes hypsométriques de
   ShibuMap sont roses et saumon et passent le test. **Un comptage par couleur
   ment sur cette carte** ; seule la différence avec/sans tracé tient.
5. **« On peut forcer une image avec `composer.render()` pour mesurer. »**
   Réfuté : un rendu forcé hors de la boucle rend une image **globalement
   différente — 586 000 pixels sur 1 474 560**, grain coupé. `tick()` fait plus
   qu'un `render()`. Les images doivent venir de la boucle de l'application,
   capturée par une **file** (un no-op tue la chaîne : plusieurs modules
   appellent `rAF`).
6. **« Le grain de film est négligeable. »** Réfuté : deux images identiques
   diffèrent de **~340 000 pixels** tant que `params.grain = 0.26` tourne.
   Coupé, deux images consécutives au repos diffèrent de **0 pixel**
   (k↔k+1, k↔k+2, k↔k+4 sur 10 images) — le plancher de bruit est nul.
7. **« Le tracé s'affiche mal parce que le socle lit le quadtree. »** Réfuté :
   `?socle=mnt` laisse le tracé à 0 pixel. Un relevé isolé y avait affiché
   97 580 pixels — c'était une image de raffinement de tuiles, pas le tracé.
8. **`_construitRuban` utilise `TERRAIN_SIZE / 2` en dur** là où `rebuild()`
   utilise `demSpan(dem) / 2` (`gpx.js:892` contre `:838`, avec un commentaire
   qui dit explicitement que la valeur en dur était fausse sur une emprise
   3×3). **Écart réel, mais SANS EFFET dans le régime de production**
   (`fenetreContinue` est éteint, l'emprise vaut 1) : à signaler, pas à
   confondre avec la cause.

---

## ⓺ LE BARÈME — note sur 10, seuils chiffrés

**Note minimale exigée par Adrien : 9/10.** Le banc de référence est
`scripts/banc-gx1-position.mjs`, au **régime de production, sans aucun drapeau
d'adresse**, sur les trois tracés de `.banc/` (Mont-Blanc 90 km, Camargue 5 km
plat, Chamonix 4 km montagne). Toute mesure de pixels est faite **par
différence** (tracé allumé / éteint), **grain et animations coupés**, images
issues de la boucle de l'application.

⛔ **TROIS ÉLIMINATOIRES. L'un d'eux manqué ⇒ la note est plafonnée à 4/10**,
quels que soient les autres points.

| # | éliminatoire | seuil |
|---|---|---|
| **E1** | le tracé est DESSINÉ au repos, régime de production | **≥ 900 pixels** sur le Mont-Blanc au cadrage d'arrivée (référence mesurée `?terre=deux` : 1 053 ; aujourd'hui : 0) |
| **E2** | le tracé reste dessiné PENDANT toute la lecture | **0 image sans tracé sur 20 relevés consécutifs**, caméra figée, tracé dans le champ (aujourd'hui : 16/16 images vides) |
| **E3** | aucune régression sous `?terre=deux` | **≥ 950 pixels** au même cadrage (aujourd'hui : 1 053) — la fusion des passes avait déjà fait disparaître le bloc à 17,80 dB de PSNR en s'appliquant au mauvais régime |

### Les 10 points

| pts | critère | seuil chiffré | mesure aujourd'hui |
|---:|---|---|---|
| **2** | **Présence au repos** — pixels posés par le tracé, Mont-Blanc | ≥ 900 px **et** ≥ 45 % des pixels attendus par la géométrie | **0** |
| **1** | **Présence sur les trois tracés** (90 km montagne, 5 km plat, 4 km montagne) | ≥ 60 % des pixels attendus sur chacun | 0 / 0 / 0 |
| **2** | **Lecture continue** — 20 relevés consécutifs, caméra figée, tracé dans le champ | **0 image** sous 30 px de tracé ; et le nombre de pixels **décroît puis croît de façon monotone** avec `headT` (le dévoilement avance) | 16 images vides sur 16 |
| **1** | **Position horizontale** — 48 sommets projetés contre les pixels réellement posés | **≥ 40 sommets sur 48** ont un pixel de tracé à **≤ 6 px** ; aller-retour lat/lon **≤ 0,5 m** en moyenne, **≤ 2 m** au max | 0/48 · 0,00 m (la conversion, elle, est déjà juste) |
| **1** | **Échelle et forme** — 40 paires contre la géodésique | déformation **≤ 0,5 %** en moyenne, **≤ 2 %** au max | 0,01 % / 0,13 % ✅ déjà tenu |
| **1** | **Drapage** — écart du ruban au sol échantillonné | tracé plat : **|écart| ≤ 15 m** partout ; montagne : **moyenne dans [0 ; +40 m]**, **jamais sous −80 m** (le ruban SURVOLE, il ne s'enterre pas) | plat +2,6 m ✅ · Mont-Blanc moy −4,7 m, **min −68,2 m** ⚠️ |
| **1** | **Dans le crop ET hors du crop** — un tracé qui déborde du socle | la part **dans** le socle est dessinée ; la part **hors** socle est **écrêtée au bord**, pas dessinée dans le vide ni supprimée en entier | non évaluable aujourd'hui (rien n'est dessiné) |
| **0,5** | **Aux échelles z8 → z15** | présence tenue (≥ 60 % des pixels attendus) à **quatre altitudes de cadrage au moins** : ~26 000 m, ~10 000 m, ~4 000 m, ~1 500 m | — |
| **0,5** | **La caméra de suivi** | pendant la lecture avec suivi, la tête de course reste dans **le tiers central** de l'écran sur **≥ 80 %** des 24 relevés ; aucune image où la caméra passe **sous le sol** | à mesurer après correction |
| **0,5** | **Coût** | **pas de régression** : appels de dessin par image **+10 % max**, mémoire GPU **+5 % max**, **0 requête réseau supplémentaire**, image la plus lente **+15 % max** — mesurés au même cadrage avant/après | — |
| **0,5** | **Rien d'autre ne bouge** (liste ci-dessous) | zéro régression | — |

### ⛔ CE QUI MARCHE AUJOURD'HUI ET NE DOIT PAS RÉGRESSER

Vérifié au banc, régime de production :

1. **Le chargement d'un GPX** : parsing, cadrage automatique, `frameTrack`,
   passage en vue isométrique, ouverture du Race Studio.
2. **Le profil, la barre de course et les chiffres** : distance 86,5 km,
   D+ 6 300 m, D− 6 302 m, sommet 2 485 m, « restants » qui décomptent.
3. **La lecture elle-même** : `headT` avance de 0 à 1 puis s'arrête ;
   Lecture / Pause / Stop ; les vitesses 0,5× 1× 2× 4×.
4. **Le suivi caméra** : `params.gpxFollow`, l'engagement au clic Lecture, le
   vol de descente (26 484 m → ~1 650 m mesurés).
5. **La géométrie du ruban** : 25 500 sommets, drapage juste, échelle juste.
6. **Le régime `?terre=deux`** : le tracé y est dessiné (1 053 px) — **c'est le
   témoin**, il doit le rester.
7. **Le cartouche, les nuages, les cotes, la cartographie, le disque solaire** :
   déjà déménagés dans `sceneGlobe`, ils ne doivent pas repartir.

---

## ⓻ LES TESTS ROUGES

**7 tests, tous rouges aujourd'hui**, inscrits dans la liste explicite de
`package.json` (**272 listés · 272 sur disque**, `npm run audit:tests` :
« Aucun écart »).

| fichier | ce qu'il garde | tests |
|---|---|---|
| `test/gpx-scene-globe.test.js` | le câblage de `main.js`, **LU** (aucun test de ce dépôt ne charge `main.js`) : adoption du calque par `sceneGlobe`, condition de régime, pose bloc → globe, `poserScene` dans `gpx.js` | 4 |
| `test/gpx-adoption-scene.test.js` | le contrat, **EXÉCUTÉ** : `GpxLayerManager.poserScene` existe, fait suivre **tous** les calques, et la scène posée est retenue pour les calques **ajoutés ensuite** | 3 |

**Preuve de morsure.** Un correctif simulé (adoption + `setCamera`, posé après
la construction du gestionnaire) a été appliqué au produit puis retiré :

```
avant :  ℹ tests 7 · pass 0 · fail 7
après :  ℹ tests 7 · pass 7 · fail 0
```

`git diff -- src/` est revenu à **0 octet**.

⚠️ **UNE SUITE VERTE NE PROUVERA PAS LA CORRECTION.** Ces sept tests
garantissent le CÂBLAGE, pas les pixels : le correctif simulé qui les rend
tous verts laisse encore **0 pixel à l'écran** (voir ⓸). **La note se prend au
banc, au navigateur, pas à `npm test`.**

---

## ⓼ COMMENT REJOUER

```bash
node_modules/.bin/vite --host 127.0.0.1 --port 9233 --strictPort
npm i --no-save puppeteer-core@25.8.0   # ou PUPPETEER_CORE=<chemin>

node scripts/banc-gx1-position.mjs --etiquette mb                      # production
node scripts/banc-gx1-position.mjs --etiquette mb-avant --adresse "terre=deux"
node scripts/banc-gx1-position.mjs --gpx .banc/court-plat-camargue-5km.gpx --etiquette court-plat
node scripts/banc-gx1-position.mjs --gpx .banc/court-montagne-chamonix-4km.gpx --etiquette court-mont
node scripts/diag-gx1-scene.mjs      # quelle scène est réellement rendue
node scripts/diag-gx1-cadence.mjs    # le plancher de bruit (doit être 0)
```

Captures pour Adrien : `.banc/GX1/*.png` — `mb-prod-repos.png` (production, pas
de tracé) contre `bis-terre-deux-01-charge.png` (`?terre=deux`, le tracé est
là), et `court-mont-lecture-figee.png` (lecture en cours, tracé entièrement
dans le champ, invisible).

⚠️ `.banc/` est git-ignoré : les captures ne survivent pas à une fusion, les
chiffres sont donc tous recopiés ci-dessus.
