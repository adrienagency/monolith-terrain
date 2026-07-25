# Nuages v3 — transplanter les recettes Takram dans notre moteur

**Date** : 2026-07-25 · **Statut** : plan proposé, EN ATTENTE DE VALIDATION ADRIEN
**Base** : spike `spike/takram-clouds` (verdict : lib incompatible, échelle planétaire
cuite dans les LUT) + **dissection du code source réel** (`clouds.glsl`,
`clouds.frag`, MIT) — les recettes ci-dessous sont extraites de leurs shaders,
pas de leur doc.
**Objectif d'Adrien** : « on dit au revoir aux nuages carrés et aux blocs
ronds » ; prendre tout ce qui est utile — forme, luminescence, diffusion,
nuages étirés — et l'appliquer directement à notre moteur (`clouds2.js`).
**Référence visuelle** : `scratchpad/shots/k428.png` (leur rendu à échelle 1).

---

## 1. Pourquoi leurs nuages ne sont ni carrés ni ronds (le diagnostic croisé)

Leur silhouette ne vient **ni de primitives** (pas de metaballs, pas de lobes)
**ni d'un seuil sec** : elle naît d'une chaîne de **remaps successifs** —

```
empreinte météo 2D  ×  profil de hauteur  →  enveloppe
enveloppe  ⊖remap  bruit de forme 3D      →  masse chou-fleur
masse      ⊖remap  bruit de détail (près) →  bords fins
           ×  profil de densité croissant avec la hauteur
```

Chez nous : 7 ellipsoïdes soudés + un seuil serré. Nos lobes rabattus vers le
centre (la visualisation SVG l'a montré : jusqu'à 5/6 écrasés sur une couronne)
donnent la « patate Minecraft » ; le seuil donne les bords durs. **La leçon
n'est pas d'ajouter des lobes : c'est de changer de source de silhouette.**

## 2. Les recettes extraites, une à une — prenable ? coût ? gain ?

### A. FORME — tout est prenable, c'est le cœur du chantier

| Recette (leur code) | Ce que ça fait | Chez nous | Coût |
|---|---|---|---|
| **Profil demi-cercle** `1−(2·h^bias−1)²` (`shapeAlteringFunction`) | base plate, sommet arrondi, bias = où gonfle le ventre — un profil PAR GENRE de nuage | remplace notre base/couronne/taper bricolés ; bias par genre (galette 0.3, bourgeon 0.38, tour 0.5) | **2 lignes** |
| **Enveloppe par couverture remappée** `factor = 1−coverage·heightScale ; density = remapClamped(mix(weather,1,w), factor, factor+w)` | la silhouette naît d'une EMPREINTE 2D seuillée en douceur — jamais de bord sec, jamais de boule | par entité : empreinte = retombée radiale × bruit basse fréquence unique (graine), domaine déformé → contours irréguliers garantis ; **les lobes disparaissent** | **moyen** (réécriture de densityAt) |
| **Érosion par remap** (Nubis) `density = remapClamped(density, (1−shape)·amount, 1)` | le bruit RONGE l'enveloppe au lieu d'être soustrait — bourgeons francs, pas de coton | remplace notre `d += (0.5−n)` | **3 lignes** |
| **Détail near-field seulement** (gate mip/jitter) `modifier = mix(pow(detail,6), 1−detail, remap(h,.2,.4))` — « fluffy at the top, whippy at the bottom » | de près : sommets floconneux, bases fouettées ; de loin : rien (gratuit) | gate par distance caméra (on a déjà camDist) ; le détail = notre 3ᵉ octave, réaffectée | **faible** |
| **Profil de densité croissant** `0.75·h + 0.25` (`getLayerDensity`) | dense en haut, TÉNU à la base → règle directement le « trop dense » d'Adrien et donne les bases vaporeuses | multiplie notre dens ; combiné à notre lumière-du-dessus, la base devient sombre ET légère | **1 ligne** |

### B. ÉTIREMENT — prenable, élégant

| Recette | Ce que ça fait | Chez nous | Coût |
|---|---|---|---|
| **Turbulence en déplacement de domaine, pondérée à la BASE** `turb = amp·(tex−.5)·remap(h, 0.3, 0.0)` | les bases sont fouettées/étirées, les sommets restent nets — c'est LE « nuage étiré » | 2 fetches de notre volume en guise de curl, direction alignée sur le VENT (déjà en param) → cisaillement réaliste | **faible** |
| **Advection de l'empreinte** (weather offset) | le dessin interne dérive avec le vent | notre uDrift existe, à brancher sur l'empreinte | trivial |

### C. LUMIÈRE / DIFFUSION — trois greffes ciblées, l'ossature reste la nôtre

| Recette | Ce que ça fait | Chez nous | Coût |
|---|---|---|---|
| **Phase HG + Draine** (constantes ajustées numériquement, dans leur code) | pic avant plus juste que le double HG → liseré argenté plus fin, contre-jour plus crédible | remplace notre mix HG/−HG ; constantes copiables telles quelles (MIT) | **faible** |
| **Albédo < 1** `extinction = scattering + absorption` | les cœurs très épais absorbent un peu → gris réalistes au lieu de blanc saturé | scinder notre extinction (albédo ~0.97) | **2 lignes** |
| **Irradiance ciel dégradée en hauteur** `mix(minSky, maxSky, h)` | l'ambiante n'est pas une couleur unique : sombre dessous, ton du ciel dessus | min/max dérivés de NOS couleurs de fond (bgStops → déjà en CSS vars/uniforms) — cohérence totale avec nos palettes | **faible** |
| **Rebond du sol** (`GROUND_BOUNCE`) | la base des nuages reçoit la couleur du terrain | teinte moyenne de la carte (on l'a via la rampe) × soleil, injectée sous h<0.3 | **faible, optionnel** |
| Bruit bleu temporel (STBN) | moins de banding à pas égal | notre jitter hash suffit à 26 pas ; à revisiter si on baisse les pas | **non retenu v3** |

### D. NON PRENABLE — et pourquoi (prouvé au spike)

- **Atmosphère de Bruneton** : rayon terrestre cuit dans les LUT (16 Mo),
  échelle 1 unité = 1 m obligatoire, planète miniature = impasse testée
  (courbure qui barre le diorama, 14.8 ms GPU). **La part utile — couleur du
  soleil/ciel selon l'élévation — on l'a déjà via `sunLook`**, partagée avec la
  mer ; la recette C-3 (dégradé d'irradiance) en capte l'essentiel à coût nul.
- **Upscale temporel + resolve** : moucheté noir prouvé à notre échelle, et
  notre coût actuel (~0 ms) ne le justifie pas.
- **Beer Shadow Maps en cascades** : notre ombre par entités suffit au diorama.
- **UV cube-sphère, ECEF, cascades** : géodésie sans objet sur 56 unités.

## 3. Budget de coût GPU (l'échange qui rend le plan raisonnable)

On SUPPRIME la boucle SDF de 7 lobes étirés (7 × length + smin par
échantillon, ~50 ALU × 26 pas × 3 marches) et on la remplace par :
empreinte (2 fetches) + forme (1) + détail (gate, 1) + turbulence (2 gated).
**Bilan estimé : neutre ou négatif.** Verrou : mesure avant/après à la frame
(on a le banc), budget max +0.5 ms sur la 3080, palier T3 mobile inchangé.

## 4. Le plan, en 3 phases courtes (chacune vérifiable à l'œil)

**P1 — La forme (½ à 1 journée)** : réécrire `densityAt` autour de
empreinte × profil demi-cercle → érosion-remap → détail near-field → profil de
densité croissant. Suppression des lobes. Les genres (bourgeon/galette/voile/
tour) deviennent des jeux de {bias, exposant d'empreinte, amount}. La sim
(vies, fusions, divisions, humeurs, vent) **ne bouge pas d'une ligne**.
Vérif : sonde vue de dessus (zéro carré), 6 graines côte à côte vs k428.png.

**P2 — Étirement + allègement (½ journée)** : turbulence de base alignée vent,
advection de l'empreinte, densité globale recalée (le « trop dense »).
Vérif : voiles réellement filandreux, bases fouettées sous grand vent.

**P3 — Lumière (½ journée)** : phase HG+Draine, albédo 0.97, irradiance ciel
dégradée depuis nos couleurs de fond, rebond du sol optionnel.
Vérif : contre-jour au couchant, midi, nuit (l'assombrissement nocturne
existant est conservé tel quel).

**Hors plan (déjà en file)** : P2-orographie (les nuages butent les montagnes)
reste la phase suivante, inchangée — l'empreinte 2D par entité la simplifiera
même (le soulèvement modulera l'empreinte).

## 5. Critères d'arrêt

- Plus AUCUNE silhouette carrée (sonde de dessus automatisée) ni « boule ».
- Six graines affichées côte à côte : six silhouettes qu'on ne confond pas.
- Densité : ciel par défaut nettement plus léger (cible : alpha max ~0.85,
  voiles ≤ 0.35).
- 60 fps tenus sur la machine de dev, palier mobile inchangé.
- Les acquis restent : vie/fusion/division, humeurs, vent, parallaxe, ombres
  au sol sur terre ET mer, nuit sombre, occlusion relief, 294 tests verts.
