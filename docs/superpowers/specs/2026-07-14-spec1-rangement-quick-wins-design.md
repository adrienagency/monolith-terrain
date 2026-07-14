# Spec 1 — Rangement + quick wins

Date : 2026-07-14
Statut : validé (design approuvé par Adrien)
Suite : Spec 2 — côte / mer vectorielle (chantier dédié, plus tard)

## Contexte

Le clone `C:\Dev\monolith-terrain` (branche `feat/orbital-globe`) porte un gros
tas de travail non commité v37→v40 (mer/eau, éclairage studio, loader brandé,
bouton iso, tutoriel, labels villes, masque océan, palier coarse, exagération).
La prod (`shibumap.com`, HEAD `0ec16d5` = v34) est 6 versions en arrière.

Adrien veut d'abord **ranger** : distinguer ce qui marche vraiment (bon pour la
prod) de ce qui est en développement, retirer deux features non convaincantes
(la mer, l'éclairage studio) **en gardant leur code**, et faire passer quelques
corrections cadrées (« quick wins ») avant de traiter le gros morceau — la
justesse de la côte et de la mer — dans un spec séparé.

Ce spec ne couvre **que** le rangement + les quick wins. Il ne touche pas au
pipeline de données côtières (Spec 2).

## Décisions actées (brainstorming)

- **Mécanisme dev/prod** : feature-flags dans le code (OFF par défaut pour le
  dev), pas de branche séparée ni de dossier `_parked`.
- **Trafic aérien varié** (montgolfière / planeur / parapente, v37) : **ON en
  prod** (validé 7,5–8,5/10, non concerné par le rejet de la mer).
- **Fine-detail au zoom lointain** : **coupure nette à z≤6** (plein à z7+, zéro
  à z6/z5/z4).
- **Palier continent** : ajouter **z4 (~7500 km)** comme bloc plat le plus large
  avant la bascule sur le globe.

## Périmètre — 6 unités

### 0. Infrastructure de flags — `src/flags.js` (nouveau)

Un module unique exportant un objet `FLAGS`. Chaque valeur par défaut = l'état
livré en prod. Un flag OFF doit couper **à la fois** l'initialisation du module
concerné **et** le rendu de sa section d'UI (aucun contrôleur orphelin, aucun
panneau vide).

```js
export const FLAGS = {
  water: false,           // simulation d'eau (ocean.js) — rejetée, code gardé
  lightingPresets: false, // presets studio + tirette 24h (lighting.js) — rejetés, code gardé
}
```

Dépendances : aucune. Interface : import nommé `{ FLAGS }`.

### 1. Fichier de travail — `docs/fonctions.md` (nouveau)

Table vivante, une ligne par fonction, colonnes :
**Fonction · Statut · Flag · Fichier(s) · Note**.

Statuts : 🟢 prod · 🟡 dev-flag (OFF) · ⚪ idée / backlog.

Contenu seedé depuis le code et l'historique v33→v40. Doit lister explicitement
les features v38/v39 non commitées :
- loader brandé, bouton iso, tutoriel, labels villes → **🟢 prod** (non
  controversées, mais vetoables par Adrien dans le doc) ;
- mer (`ocean.js`) → **🟡 dev-flag** `water` ;
- éclairage studio + 24h (`lighting.js`) → **🟡 dev-flag** `lightingPresets`.

Ce fichier est un livrable de référence, pas du code exécuté.

### 2. Mer OFF — flag `water`

`ocean.js` non initialisé quand `FLAGS.water === false`. La section « Water » de
l'UI (Transparency / Sun reflection / Waves) n'est pas rendue. Sous le niveau 0,
c'est la **rampe océan du terrain** (`terrain.js`) qui peint la mer à plat,
comme avant v37 — comportement déjà en place, aucune régression attendue.

`detectLakes` (dans `lake.js`) reste disponible : il est consommé ailleurs et
n'est pas la simulation d'eau. Le vendor `MeshTransmissionMaterial` reste
orphelin (déjà le cas). Réactivation = `water: true`.

Dépendances : `ocean.js`, câblage dans `main.js`, section UI dans
`src/ui/create-panel.js`.

### 3. Éclairage studio OFF — flag `lightingPresets`

Quand `FLAGS.lightingPresets === false` :
- `lighting.js` (8 presets studio + RectAreaLights + spot d'accent) non
  initialisé ;
- la tirette 24h `timeOfDay` et le `<select>` de preset dans le panneau Light
  ne sont pas rendus.

On conserve le **rig soleil/hemi de base** : les sliders azimut / élévation /
intensité / env-fill qui existaient avant v40 restent fonctionnels. Réactivation
= `lightingPresets: true`.

Dépendances : `lighting.js`, câblage `main.js`, section Light de
`src/ui/create-panel.js`.

### 4. Fine-detail coupé net à z≤6

Nouveau helper `syncDetailToZoom()` dans `main.js`, appelé dans
`fetchAndBuildDem()` juste à côté de `syncExagToZoom()` (`main.js:834`).

Règle : si `params.demZoom <= 6` → `params.detail = 0` (relief = vrai DEM nu) ;
sinon → detail normal (défaut 0.02 ou valeur courante).

Même schéma d'override localStorage que l'exagération (`ZOOM_EXAG_DEFAULTS` /
`zoomExagStore`) : un `DETAIL_DEFAULTS` par-zoom + un store persistant, pour que
l'utilisateur garde la main via le slider « detail » sans que le rebuild suivant
n'écrase son choix. Le défaut par-zoom encode la coupure : `{ 4:0, 5:0, 6:0 }`,
z7+ = détail de base.

Résultat visé : la France à z6/z7 sans le stippling procédural (2ᵉ image de
référence d'Adrien), le relief n'apparaît que là où il est réel.

Dépendances : `main.js` uniquement.

### 5. Palier continent z4 (~7500 km)

- `DIVE_TIERS` (`modes.js`) : insérer `{ altM: 8000000, zoom: 4 }` en tête
  (avant z5 @ 4 000 km), ordre fine→coarse conservé.
- `stepZoom` (`modes.js`) : plancher de coarsen 5 → **4**.
- `getCoarsenTarget` (`modes.js`) : seuil de fin de coarsen `<= 5` → **`<= 4`**
  (au-delà de z4, zoomer dehors ouvre le globe).
- `enterOrbit` / sortie orbite (`modes.js`) : plafond d'altitude 4 M → **8 M** m
  pour que la bascule globe se fasse au-dessus du bloc z4.
- `ZOOM_EXAG_DEFAULTS` (`main.js:809`) : ajouter `4: 2.5`.
- `DETAIL_DEFAULTS` (unité 4) : `4: 0` (fine-detail déjà coupé).
- `dem.js` : charge z4 3×3 nativement, aucune modification.

z4 3×3 ≈ 7500 km de large : un continent entier + océan tiennent dans le bloc
plat. Un cran de dézoom de plus avant le globe.

### 6. Labels villes toujours au-dessus du relief — `cities.js`

Le point et le texte du label sont posés à `terrain.sample(x,z) + 0.06`
(`cities.js:99`), avec `depthWrite:false` mais **`depthTest` actif** → un pic
entre la caméra et le label masque les lettres (« PARIS » tronqué sur les
captures d'Adrien).

Fix : `depthTest: false` sur les deux matériaux (point + texte) + `renderOrder`
élevé (ex. 10) → les labels se dessinent toujours par-dessus le relief, quelle
que soit la géométrie intermédiaire.

Tradeoff assumé : une ville sur la face « arrière » du bloc ne sera plus occultée
(elle transparaît). Au cadrage top-down/oblique de l'app c'est marginal et c'est
exactement le comportement demandé (« le nom doit toujours être écrit au-dessus
du relief »). Portée limitée à `cities.js` ; `labels.js` (landmarks topo)
pourrait recevoir le même traitement plus tard, hors périmètre.

Dépendances : `cities.js` uniquement.

## État prod attendu après exécution

Baseline v34 + trafic varié ON + mer OFF + éclairage-presets OFF + fine-detail
coupé au loin (z≤6) + palier continent z4 + labels villes lisibles + polish
v38/v39 (loader, bouton iso, tutoriel, villes). Le **déploiement reste la
décision d'Adrien** : ce spec produit l'état de code propre ; le push en prod est
un dernier feu vert manuel.

## Hors périmètre (→ Spec 2)

- Justesse de la côte / du niveau de la mer sur données réelles.
- Faux lacs restants dus au DEM bruité (le masque `sea-mask.js` v40 reste le
  garde-fou courant).
- Trait de côte maritime précis (donnée vectorielle Natural Earth / OSM).
- Le `/find-skills` d'Adrien sera exploité au Spec 2 (skill de données géo/OSM).

## Critères de succès

- `FLAGS.water = false` → aucune eau animée, aucune section Water, mer à plat via
  la rampe terrain, zéro erreur console.
- `FLAGS.lightingPresets = false` → pas de tirette 24h ni de select preset ; le
  rig soleil de base répond aux sliders.
- Réactiver un flag (`true`) restaure la feature sans autre modification.
- z6 et plus large : relief sans stippling procédural ; z7+ inchangé.
- Dézoom continu surface → z4 → globe sans blocage ; re-plongée z4 OK.
- Labels villes jamais tronqués par un relief, y compris sur un pic.
- `docs/fonctions.md` reflète l'état réel de chaque fonction.
- Suite de tests toujours verte (86/86 au départ) ; nouveaux tests purs pour la
  logique par-zoom (detail) et le palier z4.
