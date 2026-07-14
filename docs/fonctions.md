# ShibuMap — état des fonctions

Référence vivante de ce qui tourne en prod, ce qui est en dev derrière un flag,
et ce qui reste à faire.

**Statuts :** 🟢 en prod · 🟡 en dev (flag OFF, code gardé) · ⚪ idée / backlog
**Flags :** définis dans [`src/flags.js`](../src/flags.js). Passer un flag à `true` réactive la fonction (init + UI).

## Rendu & carte

| Fonction | Statut | Flag | Fichier(s) | Note |
|---|---|---|---|---|
| Terrain topo réel (DEM AWS Terrarium) | 🟢 | — | `dem.js`, `terrain.js` | Élévation seule ; côte/mer déduites de l'altitude (→ Spec 2) |
| Rampe hypsométrique 8 teintes | 🟢 | — | `palette.js`, `terrain.js` | Source unique `rampStops` |
| Templates de look (Iceland, Denali, Fallout, Toothpaste…) | 🟢 | — | `templates.js` | Bundle palette/light/surface/toggles |
| Nuages volumétriques (Perlin-Worley) | 🟢 | — | `clouds.js` | + ombres portées au sol |
| Socle 3D + plaque + cartouche cartographique | 🟢 | — | `plinth.js`, `ground-info*.js` | Coins superellipse |
| Trait de côte fin/discret à 0 m | 🟢 | — | `terrain.js` | Affiné Spec 1 (poids 2.5→1.3, opacité 0.9→0.55) |
| Masque océan (anti faux-lacs) | 🟢 | — | `sea-mask.js` | Flood-fill bord ; **garde-fou en attendant Spec 2** |
| Détection lacs d'altitude | 🟢 | — | `lake.js` | `detectLakes` (le verre d'eau, lui, est parti) |
| Isolate the zone (frontières admin) | 🟢 | — | `region-mask.js`, `region-plate.js` | Continent→département selon zoom |
| Labels villes (toujours au-dessus du relief) | 🟢 | — | `cities.js`, `public/data/cities.json` | Fix rendu Spec 1 (depthTest off) |
| Scan (radar / sonar / slice / grid / holo) | 🟢 | — | `scan.js` | |

## Navigation & zoom

| Fonction | Statut | Flag | Fichier(s) | Note |
|---|---|---|---|---|
| Plongée orbite ⇄ surface + globe | 🟢 | — | `modes.js`, `globe.js` | Machine à états, whiteout |
| Paliers de plongée z4→z11 | 🟢 | — | `modes.js` | |
| Palier continent z4 (~7500 km) | 🟢 | — | `modes.js`, `main.js` | Ajouté Spec 1 ; globe s'ouvre au-dessus de z4 |
| Fine-detail coupé au zoom lointain (z≤6) | 🟢 | — | `zoom-detail.js`, `main.js` | Ajouté Spec 1 ; override localStorage possible |
| Exagération verticale par-zoom | 🟢 | — | `main.js` | `ZOOM_EXAG_DEFAULTS` + store |
| Go-to lieu (Nominatim / lat,lon) | 🟢 | — | `goto.js`, `geo.js` | |
| Couche GPX (trace drapée + profil) | 🟢 | — | `gpx.js` | |

## UX / UI

| Fonction | Statut | Flag | Fichier(s) | Note |
|---|---|---|---|---|
| Panneaux dock (Explore/Scan/Create/Camera) | 🟢 | — | `ui/*`, `ui/create-panel.js` | Glassmorphism v28+ |
| Loader brandé | 🟢 | — | `main.js`, `index.html` | v39 |
| Bouton vue isométrique | 🟢 | — | `ui/bars.js` | v39 |
| Tutoriel 9 étapes | 🟢 | — | `ui/tutorial.js` | v39, rejouable via « ? » |
| Trafic aérien varié (avions / ballon / planeur / parapente) | 🟢 | — | `traffic.js` | Validé, gardé ON |
| Export PNG/JPEG/MP4 + REC live | 🟢 | — | `export*.js` | mediabunny |
| Qualité adaptative (paliers FPS) | 🟢 | — | `perf.js` | |
| Porte mobile / lazy-load 3D | 🟢 | — | `boot.js` | |

## En développement (flag OFF)

| Fonction | Statut | Flag | Fichier(s) | Note |
|---|---|---|---|---|
| **Simulation d'eau** (vagues Gerstner, caustiques, transparence) | 🟡 | `water` | `ocean.js` | Rejetée par Adrien (« ne me parlait pas »). Code gardé. Réactiver : `FLAGS.water = true`. (`lake.js` n'est PAS désactivé : son `detectLakes` reste actif — voir ligne « Détection lacs ».) |
| **Éclairage studio** (8 presets + tirette 24h) | 🟡 | `lightingPresets` | `lighting.js` | Rejeté (« pas convaincant »). Rig soleil/hemi de base reste actif. Réactiver : `FLAGS.lightingPresets = true` |

## Backlog / idées

| Fonction | Statut | Note |
|---|---|---|
| **Côte / mer vectorielle réelle** | ⚪ | **Spec 2** — remplacer la côte déduite de l'altitude par Natural Earth (coarse) / OSM (fin). Corrige : Italie « réduite au niveau de Venise », trait noir qui ne colle pas à la mer, faux lacs. Vérif sur vraies cartes. |
| Eau lisible sur template Iceland | ⚪ | Si l'eau revient : params d'eau par template |
| og.png = vraie capture 1200×630 | ⚪ | Actuellement le poster du Creative Center |
| Search Console à déclarer | ⚪ | |

---
_v38/v39 (loader, iso, tuto, villes) marquées 🟢 par défaut — vetoables ici._
_Maintenu à la main. Mise à jour : Spec 1 (rangement + quick wins), 2026-07-14._
