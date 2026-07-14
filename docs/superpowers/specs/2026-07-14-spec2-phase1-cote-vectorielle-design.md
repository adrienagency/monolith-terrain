# Spec 2 Phase 1 — Côte vectorielle (Natural Earth) au zoom coarse (z4–z8)

Date : 2026-07-14
Statut : validé (approche ① « tout Natural Earth » approuvée par Adrien)
Suite : Phase 2 — côte fine z9–z12 (Protomaps PMTiles, chantier séparé, plus tard)

## Contexte & problème

L'élévation vient d'AWS Terrain Tiles (terrarium, `dem.js`). La côte et la mer
sont aujourd'hui **déduites de l'altitude** : « sous 0 m = mer », et le trait de
côte est dessiné à l'isoligne 0 m dans le shader terrain (`terrain.js:245`).

À zoom coarse (z6, ~1,2 km/pixel), cette isoligne 0 m est un **mauvais proxy de
la vraie côte** : sur les plaines côtières plates, une erreur verticale minime
décale le trait de plusieurs km, et le lissage bilinéaire arrondit/érode la
forme. Résultat : l'Italie « réduite au niveau de Venise », une France dont le
littoral ne correspond pas aux cartes réelles.

Le Spec 1 a **rendu ce défaut plus visible** (pas plus grave) : en coupant le
fine-detail à z≤6 (Task 3) et en affinant le trait (Task 7), le bruit procédural
qui camouflait l'isoligne bruitée a disparu — le trait de niveau zéro apparaît nu
et manifestement faux. Retour utilisateur : « le trait de niveau zéro ne
correspond à rien ».

Diagnostic vérifié en live : les élévations DEM des villes côtières sont
correctes (Ravenne 5 m, Rimini 7 m…), donc ce **n'est pas** un bug de `seaEps`
ni du flood-fill `sea-mask.js` — c'est intrinsèque à la résolution de la donnée
d'élévation. Le fix est de **découpler la côte de l'altitude** via une vraie
donnée vectorielle.

## Décisions actées (brainstorming + recherche)

- **Portée** : phasée, **coarse d'abord**. Phase 1 = côte juste à z4–z8 (le point
  douloureux). Phase 2 (plus tard) = côte fine z9–z12.
- **Source Phase 1** : **approche ① tout Natural Earth**. NE 10m « land » (domaine
  public, zéro attribution, zéro clé, zéro dépendance runtime) — la recherche
  confirme que NE 10m est un bon match jusqu'à ~z8, exactement la borne de
  Phase 1. Rastérisé en masque terre/mer via la machinerie existante de
  `region-mask.js`.
- **Rejeté pour Phase 1** : Protomaps PMTiles (② — plus lourd : self-host, 3 libs,
  ODbL, spike de taille) → devient Phase 2. Pré-tuilage OSM (③).
- Hors périmètre : `dem.js`, le mode « isolate the zone » (garde son masque
  admin), z9–z12.

## Architecture — 4 unités

### 1. Donnée — `public/data/land-10m.json` (nouveau, lazy-fetch)

Un jeu **Natural Earth 10m « land »** (polygones de toute la terre émergée),
simplifié avec `mapshaper` à un niveau net à z8 (cible ~1–3 Mo), en GeoJSON
lon/lat (WGS84). **Lazy-fetché une seule fois** au runtime (comme
`continents.json` / `cities.json`), jamais dans le bundle initial. Domaine
public → **aucune attribution requise** (noter l'origine en commentaire, comme
`continents.json`).

Préparation (build-time, hors app) : télécharger `ne_10m_land` depuis Natural
Earth, convertir en GeoJSON, `mapshaper -simplify` (garder la forme des côtes
nette à z8, viser la taille cible), export. Documenter la commande exacte dans un
`README`/commentaire à côté du fichier pour reproductibilité.

### 2. Masque terre/mer — `src/coast-mask.js` (nouveau)

Pour le patch courant : charge (lazy, mémoïsé) `land-10m.json`, **filtre les
polygones dont la bbox recoupe la bbox du patch** (perf — ne pas rastériser toute
la Terre), et les rastérise en **masque terre/mer 2048²** aligné au pixel sur le
DEM (terre = blanc/1, mer = noir/0), blur 1.5px, `THREE.CanvasTexture`
(`flipY=false`, mêmes réglages que `region-mask.js`).

Réutilise la primitive de projection/rastérisation de `region-mask.js` : on en
**extrait un helper partagé** `rasterizePolygonsToCanvas(coordinates, dem, size)`
(le remplissage evenodd blanc-sur-noir + blur, **sans** le clip par élévation —
puisque désormais la donnée vectorielle EST la vérité terre/mer). `region-mask.js`
appelle ce helper puis applique son clip élévation ; `coast-mask.js` l'appelle
sans clip.

API : `fetchCoastMask({ lat, lon, zoom, dem }) → { maskTexture } | null`
(null hors z4–z8, ou si le fetch échoue). Filtre bbox + tri des polygones = pur,
testable.

### 3. Shader terrain — `terrain.js`

Nouveaux uniforms `uCoastMask` (sampler2D) / `uCoastMaskOn` (float 0/1) +
`terrain.setCoastMask(tex|null)`.

Quand `uCoastMaskOn == 1` (z4–z8) :
- `float landness = texture(uCoastMask, uv).r;` — même uv monde que `uRegionMask`.
- **terre/mer décidé par le masque** : `bool isSea = landness < 0.5;` — remplace
  le test `vWorldPos.y < uSeaY && seaMask > 0.5` pour la classification.
- **trait de côte** dessiné au **contour 0.5 du masque** (`abs(landness-0.5)` avec
  AA `fwidth`) au lieu de l'isoligne 0 m → la vraie forme du littoral.
- une cellule que NE dit **mer** mais DEM +5 m → peinte mer (rampe océan, profondeur
  plafonnée à ~0) ; une cellule que NE dit **terre** mais DEM −10 m (Pays-Bas) →
  peinte terre (rampe altitude). Côtes inondées **et** faux lacs réglés d'un coup.

Quand `uCoastMaskOn == 0` (z9+ Phase 2 en attente, ou fetch échoué) → **repli
exact** sur le comportement actuel (isoligne 0 m + `sea-mask.js`). Additif et sûr :
aucune régression hors z4–z8.

### 4. Câblage — `main.js`

Dans `fetchAndBuildDem`, après le rebuild terrain : si `demZoom ∈ [4,8]`,
construire le masque côte en **async non-bloquant** (comme `groundInfo.load`) →
`terrain.setCoastMask(tex)` ; sinon `terrain.setCoastMask(null)` → repli. Cache
par clé de patch. `sea-mask.js` reste le garde-fou z9+ (inchangé).

## Interaction avec l'existant

- `sea-mask.js` (flood-fill) : conservé, devient le repli z9+. À z4–z8 le masque
  côte le supersède (le shader préfère `uCoastMask` quand actif).
- Mode « isolate the zone » (`region-mask.js`, `uRegionMask`) : **inchangé**, son
  masque admin est séparé. (Pourra adopter le masque NE terre/mer plus tard —
  hors périmètre.)
- Trait de côte fin/discret (Spec 1 Task 7) : conservé ; c'est le même style de
  trait, juste tracé au contour du masque au lieu de l'isoligne 0 m.

## Critères de succès

- z6 France / z7–z8 Italie : le trait de côte **suit la vraie côte** des cartes
  (la botte italienne, le littoral atlantique/méditerranéen français) au lieu de
  l'isoligne 0 m bruitée.
- Corse (île) : contour d'île net et correct.
- Pays-Bas : la terre sous 0 m **reste terre** (plus inondée).
- Un cas de faux lac coarse (cuvette DEM sous 0 m à l'intérieur des terres) :
  **disparaît** (NE dit terre → terre).
- z9+ : rendu **inchangé** (repli, aucune régression) — Phase 2 le traitera.
- Fetch réseau/masque échoué : repli propre, aucune erreur console, terrain rendu.
- Bundle initial **inchangé** (`land-10m.json` lazy-fetché, pas bundlé).
- Suite de tests verte + tests purs pour le filtre bbox et le helper de
  rastérisation partagé.

## Hors périmètre (→ Phase 2)

- Côte précise z9–z12 (Protomaps PMTiles `earth`/`water`, ODbL attribution,
  fetch par tuile range-request) — la recherche `spec2-data-research.md` a le
  design.
- Bathymétrie / profondeur réelle de la mer (on garde la rampe océan actuelle,
  keyée sur la profondeur DEM là où dispo).
- Adoption du masque NE par le mode « isolate the zone ».
