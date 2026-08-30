# Étude — la révélation progressive des libellés · lecture seule

> **14 couches d'information cataloguées · 3 branchées sur le globe · 11 non branchées,
> dont les SIX systèmes de libellés texte AU COMPLET.**

## ① L'existant

### Les six systèmes de libellés — TOUS éteints sous `terreUniqueBranchee`

1. **`PlacesLayer`** (`src/map/places-layer.js`, 286 l.) — noms de villes, le plus riche.
2. **`WaterLayer`** — même gestionnaire, même bascule (lacs/rivières, **aucun nom de mer**).
3. **`labels.js`** (128 l.) — système **différent et plus ancien** : toponymie **fictive**
   (« HUNTS MESA »…) + cotes d'altitude. **Pas un consommateur de GeoNames.**
4. **`PeaksLayer`** (`src/peaks.js`) — sommets, « même règle que les noms de lieux » (l.26).
5. **`GroundInfoLayer`** — cartouche HUD.
6. **Les annonces de village le long d'une trace GPX** (`src/gpx.js`,
   `_buildVillageMarkers()` ~l.573) — **troisième système, indépendant**, avec sa propre
   constante `VILLAGE_LABEL_BASE_H`.

### ⛔ LA PREUVE QU'AUCUN N'EST BRANCHÉ — chaîne citée, pas déduite

- `mapLayers = new MapLayers(scene, camera)` (`main.js:1819`) est construit sur **`scene`,
  la scène du BLOC PLAT**. Le globe vit dans **`sceneGlobe`** (`main.js:4343`), rendu par
  **`camGlobe`** dans une passe dédiée. `PlacesLayer` s'ajoute à `scene`
  (`places-layer.js:60`) : **elle est dans le mauvais monde depuis le départ.**
- **La preuve décisive** — `poserVisibiliteSocle()` (`main.js:4516-4535`) :
  ```js
  if (terreUniqueBranchee) v = false          // l.4517
  labels.visible = v && params.labels          // l.4519 — labels.js éteint
  groundInfo.setVisible(v && params.groundInfo) // l.4527 — cartouche éteint
  mapLayers.setSurfaceVisible(v)                // l.4530 — PlacesLayer + WaterLayer éteints
  ```
  ⚠️ **Le groupe THREE entier passe à `visible = false`, sans exception.**
- `socleAffiche()` (`main.js:4576-4578`) rend **littéralement `false`, toujours**, sous ce
  drapeau → `PeaksLayer` éteinte aussi.
- **`contexteCrop()`** (`main.js:4814-4916`), **seul contrat** entre `main.js` et le crop,
  **ne porte aucun champ `places` ni `labels`**. Et `branchement-crop.js` énumère ses six
  maillons — `crop`, `parois`, `fond`, `rampe`, `mer`, `habillage`, `estompage` :
  ⛔ **aucun maillon « libellés » n'existe, même en projet.**
  **Ce n'est pas un fil débranché par accident : le plan n'a jamais eu de tâche pour eux.**

### Ce qui EST branché (contraste)
**Occupation du sol · masque de côte · courbes de niveau** — un seul bloc `poserHabillage`,
six paires d'uniformes. **Aérien, nuit, canopée ne le sont pas non plus.**

### La décision d'apparition, aujourd'hui : DEUX mécanismes empilés

**① La sélection — un ZOOM ENTIER DISCRET, pas une altitude.**
`popToMinZoom(pop, capital)` (`place-tier.js:33-43`) : capitale → z3 · ≥1e6 → z4 ·
≥2e5 → z6 · ≥5e4 → z8 · ≥2e4 → z9 · ≥1e4 → z10 · ≥5e3 → z11 · ≥2e3 → z12 · sinon z13.
Comparé à `params.demZoom` (`places-layer.js:96`), **fixé par l'escalier `DIVE_TIERS`**
(`modes.js:62-77`) — **par marches entières**, et le rebuild ne se déclenche **qu'au
changement de `demZoom`**, pas par image.

**② L'anti-encombrement — CONTINU, en pixels, et il est BON.**
`_declutter()` (`places-layer.js:234-277`) : projette par **population décroissante**,
rectangle écran paddé de `DECLUTTER_PAD_PX = 3`, **rejette tout recouvrement**.
⚠️ **Algorithme glouton, gros-d'abord : c'est déjà, fonctionnellement, le mécanisme de
Google.** Rejoué en continu, throttlé à 0,2 s.

### Les données
`scripts/build-places.mjs` → **GeoNames `cities1000`** (pop > 1 000, CC BY 4.0). Champs :
`name`, `lat`, `lon`, `population`, `capital` (dérivé de `featureCode === 'PPLC'`,
**aucune autre distinction** — pas de chef-lieu, pas de préfecture), `min_zoom` **calculé au
build**. Lacs/rivières/côtes : Natural Earth 10m.

⛔ **CE QUE LA DONNÉE NE CONTIENT PAS, ET QUI MANQUE À TOUTE LA CHAÎNE : aucun pays, aucune
mer nommée, aucune frontière, aucune route.** Ce sont **des points de population, point.**

## ② Le motif de Google Earth, formalisé

| catégorie | apparaît sous | source |
|---|---|---|
| planète nue | — | 63 170 → 22 498 km : rien |
| **pays** + quelques capitales + frontières pointillées | ≈ **22 000 km** | visible à 10 935 |
| **mers** nommées | ≈ **10 000 – 8 000 km** | visible à 7 768, absente à 10 935 |
| capitales et grandes villes densifiées | ≈ **8 000 km** | visible à 7 768 |
| **petits pays** (Moldavie, Slovénie, Monténégro) | ≈ **4 000 km** | visible à 3 918 |
| villes moyennes | ≈ 4 000 – 2 800 km | co-apparaît |
| villes régionales (Cluj-Napoca, Brașov) | ≈ **2 000 km** | visible à 1 976 |
| **routes principales** (E-75, A1) + parcs | ≈ **1 000 km** | visible à 998 |
| petites villes, échangeurs, toponymes | ≈ **500 km** | visible à 497 |

⚠️ **RECOUPEMENT RÉVÉLATEUR** : la table câblée (`place-tier.js`) va de **z3 ≈ 10 600 km** à
z13 ≈ 10 km. **Elle s'arrête à 10 600 km** — donc **rien entre 63 000 et 22 000 km n'est même
dans la table**, une plage **six fois plus large côté haut** que ce que le dépôt sait traiter.

⚠️ **L'agent refuse de graver les seuils intermédiaires** : *« pas assez de captures pour
trancher au km près — exactement le genre de chiffre que ce chantier a déjà vu se faire
retirer six fois pour n'être remonté d'aucune donnée. »* **Seconde passe d'observation
nécessaire sur 22 000→10 935, 7 768→3 918, 2 780→1 976.**

### Les trois réserves sur `_declutter`
1. Il ne connaît **que les villes** — jamais en concurrence avec pays, mers, routes, parcs.
2. Il ne connaît que **le rectangle du NOM** — pas un pictogramme, pas un tracé, pas un
   polygone. ⚠️ **Google fait céder ENTRE catégories** (une route cède à un nom de ville).
3. Il est en **coordonnées écran projetées depuis un monde PLAT** — à refaire sur la sphère.

## ③ Ce qui casse sur une sphère

1. **Position** — `latLonToWorld` est une **projection plane locale centrée sur le DEM**,
   valable sur quelques centaines de km. **Aucun sens à 20 000 km.** Remplacer par
   `latLonToSphere`.
2. **Rejet hors-fenêtre** — `|wx| > HALF || |wz| > HALF` (`places-layer.js:259`) est **un
   test de bord de DALLE CARRÉE**. Sur une sphère il n'y a pas de bord, il y a un horizon.
3. ⛔ **Occlusion par l'horizon — ABSENTE, pas imparfaite.** `ndc.z > 1` élimine ce qui est
   **derrière la caméra**, pas ce qui est **de l'autre côté de la planète**. **C'est
   exactement le bug qu'Adrien anticipe.** La brique existe : `intersectionGlobe()`
   (`escalier-zoom.js:109-123`).
4. ⛔ **Occlusion par le relief — le depth buffer N'EST JAMAIS COMPOSÉ entre les deux
   passes** (`frontiere-rendu.js:190-194` : *« main.js efface la profondeur entre les deux
   passes »*). **Le mécanisme actuel ne peut pas être copié tel quel.**
5. **Échelle apparente** — `BASE_H` est calibré pour **une** caméra ; il y en a **deux**
   désormais. Piège déjà payé une fois (facteur ×3,7 lié au fov).
6. **Orientation** — rien n'exprime « le texte reste lisible le long d'une surface courbe ».

## ④ Découpage en cinq tâches

1. **Rebrancher `PlacesLayer` sur le globe** (projection sphérique, septième maillon de la
   chaîne). ⚠️ Risque : **sans test d'occlusion relief, les noms traverseront les montagnes —
   régression DÉJÀ VÉCUE et corrigée une fois** sur le bloc.
2. **Le test de visibilité géométrique (horizon + antipode).** Techniquement **faible
   risque** (géométrie pure, testable sous node) ⚠️ **mais un mauvais seuil de marge fera
   CLIGNOTER les libellés près du limbe** — même famille d'oscillation que le seuil du socle.
3. **La loi d'altitude continue** remplaçant l'escalier `demZoom`. ⚠️ **La tâche qui touche
   le plus de code partagé** : `place-tier.js`/`place-pick.js` servent aussi `gpx.js` et
   `peaks.js`. **Contrat clair exigé, pas une réécriture locale.**
4. ⛔ **CONSTRUIRE LES COUCHES MANQUANTES : pays, mers, routes, parcs. LA GROSSE TÂCHE —
   AUCUNE de ces données n'existe dans le dépôt.**
   - **Pays** : il faudrait Natural Earth admin-0, **jamais utilisé ici**. `region-mask.js`
     interroge **Nominatim EN DIRECT, par vue** — inadapté à une donnée mondiale statique.
   - **Mers** : aucune donnée. Natural Earth `marine polygons`, **pas dans le pipeline**.
   - ⛔ **ROUTES : LITTÉRALEMENT SUPPRIMÉES DU SITE le 2026-07-29, sur décision d'Adrien,
     citée verbatim dans le code** (`geo-cells.js:44-49`) : *« très lourd, très mauvais, tu
     peux le supprimer »*. ⚠️ **Les rebâtir est un RETOUR EN ARRIÈRE sur une décision produit
     explicite — à confirmer avec Adrien, ce n'est pas une réactivation.**
   - **Parcs nationaux** : **aucune trace nulle part.**
   - ⚠️ Risque : **volume de données statiques** (le pipeline a déjà été retravaillé pour
     cause de poids — cellules de **2,67 Mo → 27 Ko** mesurées) sur un site 100 % statique.
5. **Étendre `_declutter` aux nouvelles catégories, avec priorité INTER-catégories.**
   ⚠️ **Choix éditorial, pas technique** : un pays cède-t-il devant une capitale ?
   **À poser avec Adrien plutôt qu'à deviner.** Dépend entièrement des tâches 1 et 4.

## ⑤ Ce que le contrôleur avait oublié

1. **`public/data/cities.json`** — mégapoles mondiales avec population/capitale, format
   quasi identique à `places.json`, ⛔ **importé PAR PERSONNE** (`grep -rn "cities.json"
   src scripts` → rien). **Donnée morte, ou préparation abandonnée pour exactement le calque
   « villes visibles depuis l'orbite » que cette étude recommande.**
2. **Le calque routes a été SUPPRIMÉ, pas désactivé** — décision d'Adrien citée dans le code.
3. **`region-mask.js` interroge Nominatim en direct** — mécanisme entièrement différent d'un
   futur calque « pays », et câblé exclusivement sur le bloc plat.
4. ✅ **Bonne nouvelle : sélection et anti-encombrement sont DÉJÀ proprement séparés.** La
   tâche 5 n'a pas à réinventer l'anti-recouvrement, seulement à le nourrir.
5. ✅ **`escalier-zoom.js` et `frontiere-rendu.js` sont déjà des modules PURS, testables sous
   node, sans DOM ni three.js** — **le patron est directement réutilisable** pour la loi de
   seuils (tâche 3) et le test d'horizon (tâche 2). **Le chantier a déjà la bonne
   architecture pour accueillir ce travail sans tout faire vivre dans `main.js`.**
