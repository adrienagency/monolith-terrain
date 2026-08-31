# INVENTAIRE STUDIO 2 — LES 127 OPTIONS, ET CE QU'ELLES FONT SOUS LA SPHÈRE

> **Tâche R18, étape 1. ⛔ AUCUNE LIGNE DE `src/` N'A ÉTÉ TOUCHÉE POUR L'ÉCRIRE.**
> Livrés : `scripts/sonde-studio-r18.mjs` (l'écran), `scripts/sonde-uniformes-r18.mjs`
> (la traversée), `scripts/cibles-studio-r18.mjs` (le catalogue partagé),
> `scripts/table-r18.mjs` (la jointure), `scripts/diag-r18-*.mjs` (les diagnostics).
> Traces : `.banc/R18/`.
> Matériel : ANGLE (NVIDIA RTX 3080, D3D11), Chrome sans tête 1280 × 800, port 5561.
> URL : `http://localhost:5561/` — **aucun paramètre**, le mode sphère est le défaut.
> État mesuré : `mode = surface`, `altM = 18 201`, `baseYCrop = −0,1200`, heure 15,1.

## ⚡ CE QUE J'AI CRU MESURER, ET CE QUI M'A DÉTROMPÉ

⛔ **MA PREMIÈRE PASSE DÉCLARAIT 66 OPTIONS MORTES. IL Y EN A 50, ET LA
DIFFÉRENCE EST UNE FAUTE D'INSTRUMENT, PAS DE CODE.** Elle condensait l'image en
64 × 40 — une moyenne de boîte de 20 × 20 pixels. **« Hauteur des vagues » de 0 à
2 rendait 1,45 fois le plancher de bruit** ; deux captures prises côte à côte
(`.banc/R18/mer-seaWaveH-bas.png` / `-haut.png`) montrent des crêtes sur toute la
nappe. Une moyenne de boîte **annule un motif fin** : les crêtes claires et les
creux sombres tombent dans la même case.

⚡ **DEUX CORRECTIONS, ET LES DEUX COMPTENT :**

1. **La grille passe à 256 × 160, et une seconde grandeur arrive** — le
   **gradient** local (|dx| + |dy| sur la luminance), qui mesure la quantité de
   DÉTAIL et non la couleur moyenne. Le calcul reste dans la page : à cette
   finesse, faire traverser 122 880 nombres par relevé coûtait plus cher que le
   rendu.
2. **Le mouvement ambiant est coupé** (`params.animations = false`). La scène
   devient reproductible **au bit près** : le plancher de bruit tombe de
   **0,3693 à 0,0000 sur six relevés consécutifs**. Sans ça, la mer qui bouge
   EST le bruit, et elle noie tout ce qui est plus discret qu'elle.

⛔ **CONSÉQUENCE À NE PAS OUBLIER : LES OPTIONS DE MOUVEMENT NE SE JUGENT PAS
SUR UNE IMAGE FIXE.** Vitesse de dérive, mouvements de caméra, interrupteur
Animations rendent zéro **par construction** sous ce protocole. Elles sont
marquées *(mouvement)* et jugées à la traversée, jamais à l'écran.

## LE PROTOCOLE, EN QUATRE LIGNES

- Les contrôles sont pilotés **par leur vrai nœud du DOM** — `input.value` puis un
  vrai événement `input`, `button.click()` pour les interrupteurs, vignettes et
  chips. **Aucune recopie du corps de `set:`** : c'est le chemin de l'utilisateur.
- Trois états par option : **minimum, maximum, retour à l'origine**. Le retour est
  MESURÉ ; s'il ne revient pas, **la page est rechargée avant l'option suivante**
  (22 rechargements sur la passe de référence).
  ⚠️ C'est cette garde qui manquait au premier tour : une rangée de chips sans
  chip allumée « revenait » sur la première — la scène est restée de nuit et
  **65 lignes ont été mesurées dans le noir**.
- **Deux passes** : à l'état de départ, et **préconditions allumées** (photo
  aérienne, mer animée, bokeh, SSAO, SSS, socle…). Une tirette rangée derrière
  `visibleWhen` mesurée parent éteint rend toujours « ne fait rien » — c'est un
  artefact, pas un verdict. *Exemple : « Intensité du flou » = 0,000 parent
  éteint, **9,815** parent allumé.*
- **Une troisième sonde lit les uniformes** de `globe.uniforms` avant/après.
  C'est elle qui sépare **« la valeur n'a pas traversé »** de **« elle a traversé
  et ne se voit pas »** — deux pannes qui appellent des réparations opposées.

## LES SEUILS, ET LEUR ÉTALON

`moy` = écart absolu moyen des niveaux de gris sur l'image entière (0-255).
`grad` = écart absolu moyen du gradient local.

| verdict | règle |
|---|---|
| ⛔ **écrit dans le vide** | `moy < 0,005` **et** `grad < 0,01` **et** aucun uniforme du globe touché |
| ⚠️ **marche à moitié** | traverse mais ne se voit pas, ou se voit sous le seuil de lisibilité (`moy < 0,06` et `grad < 0,12`) |
| ✅ **marche** | `moy ≥ 0,06` **ou** `grad ≥ 0,12` |

⚡ **L'ÉTALON EST UNE CAPTURE, PAS UN CHOIX** : « Hauteur des vagues » vaut
**0,131** et se voit nettement sur deux captures côte à côte ; « Opacité des
courbes » vaut **0,014** et ne se voit pas. Le seuil est entre les deux.

## LE COMPTE

| panneau | ✅ | ⚠️ | ⛔ | total |
|---|---|---|---|---|
| Caméra | 3 | 0 | 3 | 6 |
| Couches | 0 | 1 | 3 | 4 |
| Carte | 4 | 4 | 5 | 13 |
| Terrain | 27 | 0 | 7 | 34 |
| Fonds | 3 | 0 | 0 | 3 |
| Éléments | 18 | 1 | 22 | 41 |
| Effets | 10 | 1 | 2 | 13 |
| Parcours | 1 | 1 | 5 | 7 |
| Mes créations | 0 | 0 | 1 | 1 |
| Paramètres | 3 | 0 | 2 | 5 |
| **total** | **69** | **8** | **50** | **127** |

⚠️ **« Caméra », « Couches », « Parcours » et « Mes créations » ne sont pas des
panneaux du Studio** — ils sont recensés parce que la sonde balaie tout le DOM,
et parce que leurs pannes sont les mêmes. Les six panneaux demandés (Carte,
Terrain, Fonds, Éléments, Effets, Paramètres/Avancé) font **109 options :
65 ✅, 6 ⚠️, 38 ⛔**.

---

# LE TABLEAU

## Panneau « Caméra »

**Objectif & mise au point**

| # | à l’écran | écrit | lu par | sphère | moy | grad | uniformes du globe |
|---|---|---|---|---|---|---|---|
| 0 | Champ de vision (fov) | params.fov → camera.fov (caméra du bloc) | camera + camGlobe (frontiere-rendu recopie le fov) | ✅ | 49.107 | 8.123 | — |
| 1 | Mise au point auto (pointeur) | params.autoFocus → params seul | tick de main.js → dofPass.focusDistance | ⛔ | 0.000 | 0.000 | — |
| 2 | Flou de profondeur (bokeh) | params.bokehEnabled → setDofEnabled → dofPass.enabled | composer (passe plein écran, après le globe) | ✅ | 6.291 | 4.456 | — |
| 3 | Intensité du flou | params.bokehScale → dofPass.bokehScale | composer | ✅ | 9.815 | 4.843 | — |

**Automatisations**

| # | à l’écran | écrit | lu par | sphère | moy | grad | uniformes du globe |
|---|---|---|---|---|---|---|---|
| 4 | Mouvement *(mouvement)* | params.camMove → cameraAuto.play | camera-automation.js → controls | ⛔ | 0.000 | 0.000 | — |
| 5 | Vitesse *(mouvement)* | params.camSpeed → cameraAuto.setSpeed | camera-automation.js | ⛔ | 0.000 | 0.000 | — |

## Panneau « Couches »

**Couches**

| # | à l’écran | écrit | lu par | sphère | moy | grad | uniformes du globe |
|---|---|---|---|---|---|---|---|
| 6 | Assombrissement | params.nuitAssombrissement → couche Nuit | nuit.js (couche éteinte par défaut) | ⛔ | 0.000 | 0.000 | — |
| 7 | Éclairage | params.nuitEclairage → couche Nuit | nuit.js (couche éteinte par défaut) | ⛔ | 0.000 | 0.000 | — |
| 8 | Force | params.solForce → terrain.mapUniforms.uSolOpacite | socle plat + habillage crop (solOpacite) | ⚠️ | 0.000 | 0.000 | `uSolOpacite` |
| 9 | Force | params.canopeeForce → canopée | canopee.js (couche éteinte par défaut) | ⛔ | 0.000 | 0.000 | — |

## Panneau « Carte »

**Calques**

| # | à l’écran | écrit | lu par | sphère | moy | grad | uniformes du globe |
|---|---|---|---|---|---|---|---|
| 10 | Rivières & eau | params.waterEnabled → rebuildMapLayers → mapLayers water | sol-globe.js reloge le calque dans la scène du globe | ⚠️ | 0.046 | 0.047 | — |
| 11 | Opacité de l’eau | params.waterOpacity → mapLayers.setOpacity('water') | le même calque relogé | ✅ | 0.178 | 0.355 | — |
| 12 | Photo aérienne | params.aerialEnabled → refreshAerial → terrain.setAerial | habillage crop (champ `aerial`) | ✅ | 12.428 | 2.057 | `uAerialOn` |
| 13 | Opacité de la photo | params.aerialOpacity → terrain.setAerialOpacity | habillage crop (`aerialOpacite`) | ✅ | 11.303 | 1.685 | `uAerialOpacity` |
| 14 | Fondu à la côte | params.aerialCoastFade → terrain.setAerialCoastFade | habillage crop (`aerialCoastFade`) | ✅ | 3.170 | 0.475 | `uAerialCoastFade` |
| 15 | Villes & lieux | params.placesEnabled → rebuildMapLayers → places | sol-globe.js reloge le calque | ⚠️ | 0.008 | 0.006 | `uAerialOn` |

**Courbes & grille**

| # | à l’écran | écrit | lu par | sphère | moy | grad | uniformes du globe |
|---|---|---|---|---|---|---|---|
| 16 | Intervalle des courbes | params.contourInterval → terrain.mapUniforms.uContourInterval | ⛔ AUCUN côté globe — l'intervalle du crop vient de `amplitudeM`, pas de ce curseur | ⛔ | 0.000 | 0.000 | — |
| 17 | Opacité des courbes | params.contourOpacity → terrain.mapUniforms.uContourOpacity | habillage crop (`contourOpacity`) | ⚠️ | 0.014 | 0.028 | `uContourOpacity` |
| 18 | Épaisseur des courbes | params.contourWeight → terrain.mapUniforms.uContourWeight | habillage crop (`contourWeight`) | ⚠️ | 0.000 | 0.000 | `uContourWeight` |
| 19 | Taille de la grille | params.gridStep → terrain.mapUniforms.uGridStep | ⛔ AUCUN côté globe (pas de grille dans le nuanceur du crop) | ⛔ | 0.000 | 0.000 | — |
| 20 | Opacité de la grille | params.gridOpacity → terrain.mapUniforms.uGridOpacity | ⛔ AUCUN côté globe | ⛔ | 0.000 | 0.000 | — |

**Repères**

| # | à l’écran | écrit | lu par | sphère | moy | grad | uniformes du globe |
|---|---|---|---|---|---|---|---|
| 21 | Sommets | params.peaksEnabled → peaksLayer.setEnabled | peaks.js — objets accrochés à la scène du bloc | ⛔ | 0.000 | 0.000 | — |
| 22 | Points cotés | params.labels → setLabelsVisible | labels.js — points cotés du bloc | ⛔ | 0.000 | 0.000 | — |

## Panneau « Terrain »

**Relief**

| # | à l’écran | écrit | lu par | sphère | moy | grad | uniformes du globe |
|---|---|---|---|---|---|---|---|
| 23 | chips (×1 Réel/×2 Carte/×4 Relief/×8 Drame) | params.demExaggeration (chips ×1..×8) → regenerateTerrain + saveZoomExag | globe.majExageration / lireExageration(params) — exagération partagée | ✅ | 0.226 | 0.237 | — |
| 24 | Échelle fine | params.demExaggeration (fin) → idem, commit au relâchement | idem | ⛔ | 0.000 | 0.000 | — |

**Ombrage**

| # | à l’écran | écrit | lu par | sphère | moy | grad | uniformes du globe |
|---|---|---|---|---|---|---|---|
| 25 | picker (2 vignettes) | params.colorMode (Classique/Atlas) → setColorMode → applyColorParams | habillage crop (texShade/wetK/expoK/treeLine/hazeAmt) | ✅ | 1.257 | 1.135 | `uAnalysisOn` |
| 26 | Ombrage auto | params.shadeAuto → setShadeAuto → applyAutoShade | écrit les uniformes d'ombrage, donc l'habillage | ⛔ | 0.000 | 0.000 | — |
| 27 | Teinte hypsométrique | params.mapTint → terrain.mapUniforms.uTint | habillage crop (`albedoTeinte`) | ✅ | 5.403 | 2.380 | `uAlbedoTeinte` |
| 28 | Contraste d’altitude | params.heightContrast → terrain.mapUniforms.uHeightContrast | habillage crop (`heightContrast`) | ✅ | 1.682 | 0.547 | `uHeightContrast` |
| 29 | Pivot d’altitude | params.heightPivot → terrain.mapUniforms.uHeightPivot | habillage crop (`heightPivot`) | ✅ | 2.083 | 0.632 | `uHeightPivot` |
| 30 | Ombrage des pentes | params.slopeTint → terrain.mapUniforms.uSlopeTint | ⛔ AUCUN côté globe — et la ligne est cachée en mode Atlas | ⛔ | 0.000 | 0.000 | — |
| 31 | Texture des crêtes | params.texShade → applyColorParams → uTexShade | habillage crop (`texShade`) | ✅ | 0.790 | 0.655 | `uTexShade` |
| 32 | Humidité des vallons | params.wetK → uWetK | habillage crop (`wetK`) | ✅ | 0.328 | 0.304 | `uWetK` |
| 33 | Exposition (adret / ubac) | params.expoK → uExpoK | habillage crop (`expoK`) | ✅ | 0.260 | 0.230 | `uExpoK` |
| 34 | Limite des arbres | params.treeLine → uTreeLine | habillage crop (`treeLine`) | ✅ | 0.332 | 0.306 | `uTreeLine` |
| 35 | Perspective aérienne | params.hazeAmt → uHazeAmt | habillage crop (`hazeAmt`) | ✅ | 1.381 | 0.617 | `uHazeAmt` |
| 36 | Couleurs sèches | params.rampDry → rebuild de la table 2D de rampe | habillage crop (`rampe2D`, la table est PARTAGÉE) | ✅ | 0.122 | 0.089 | — |
| 37 | Couleurs humides | params.rampWet → idem | idem | ✅ | 0.272 | 0.247 | — |

**Matière du relief**

| # | à l’écran | écrit | lu par | sphère | moy | grad | uniformes du globe |
|---|---|---|---|---|---|---|---|
| 38 | picker (17 vignettes) | params.terrainSurfaceMat → terrain.setSurfaceMaterial + blockGrid | ⛔ le globe n'a pas de matière PBR de relief ; seule `terrain.material.color` traverse (`albedoBase`) | ✅ | 3.560 | 1.297 | `uAlbedoBase` `uAlbedoTeinte` |

**Effets de surface (shaders)**

| # | à l’écran | écrit | lu par | sphère | moy | grad | uniformes du globe |
|---|---|---|---|---|---|---|---|
| 39 | picker (12 vignettes) | params.surfaceFx → terrain.setSurfaceFx | habillage crop (`surfaceFx` + fx*) | ✅ | 6.616 | 1.560 | `uSurfaceFx` `uAlbedoTeinte` |
| 40 | Opacité | params.fxOpacity → terrain fx uniforms | habillage crop (`fxOpacity`) | ✅ | 25.114 | 3.302 | `uFxOpacite` |
| 41 | Fusion | params.fxBlend → terrain fx uniforms | habillage crop (`fxBlend`) | ✅ | 1.963 | 0.518 | `uFxBlend` |
| 42 | Background | params.fxColA → terrain fx uniforms | habillage crop (`fxColA`) | ✅ | 4.467 | 0.720 | `uFxColA` |
| 43 | Blobs | params.fxColB → terrain fx uniforms | habillage crop (`fxColB`) | ✅ | 0.579 | 0.088 | `uFxColB` |
| 44 | Count | params.fxP1 → terrain fx uniforms | habillage crop (`fxP1`) | ✅ | 0.628 | 0.171 | `uFxP1` |
| 45 | Size | params.fxP2 → terrain fx uniforms | habillage crop (`fxP2`) | ✅ | 0.482 | 0.162 | `uFxP2` |
| 46 | Speed *(mouvement)* | params.fxP3 (vitesse) → terrain fx uniforms | habillage crop (`fxP3`) | ⛔ | 0.000 | 0.000 | — |
| 47 | Scale | params.fxScale → terrain fx uniforms | habillage crop (`fxScale`) | ✅ | 0.990 | 0.273 | `uFxScale` |

**Socle**

| # | à l’écran | écrit | lu par | sphère | moy | grad | uniformes du globe |
|---|---|---|---|---|---|---|---|
| 48 | Afficher le socle | params.plinth → plinth.setVisible | ⛔ le socle plat n'est plus rendu ; les parois du crop viennent de `parois-crop.js` | ✅ | 1.145 | 1.466 | — |
| 49 | Isoler la zone | params.regionMode → setRegionMode → regenerateTerrain + region-mask | la forme du crop (poserCrop) suit la découpe | ✅ | 51.667 | 11.837 | `uSunDir` `uContourInterval` `uOceanDepth` `uLandMax` `uLandBas` `uReliefBas` `uPlancherRampeM` `uMerFondBudgetM` `uResRefM` `uCropCentre` `uCropDemi` `uMargeCoteM` `uSoleilDir` `uHemiHaut` `uAlbedoTeinte` |
| 50 | Couleur de la tranche | params.plinthColor → plinth.setColors → wallMat.color | habillage crop (`paroiCouleur`, LU SUR LE MATÉRIAU) | ⛔ | 0.000 | 0.000 | — |
| 51 | picker (50 vignettes) | params.plinthPbr / plinthGlass / plinthFinish → applyPlinthMaterial | habillage crop (`paroiCouleur` + ambiante de paroi) | ✅ | 7.228 | 2.353 | `uParoiCouleur` `uParoiCielIrr` `uParoiSolIrr` |
| 52 | Cartouche au sol | params.groundInfo → setGroundInfo | cartouche-globe.js (relogé en D16-c) | ✅ | 1.144 | 1.459 | — |

**Qualité**

| # | à l’écran | écrit | lu par | sphère | moy | grad | uniformes du globe |
|---|---|---|---|---|---|---|---|
| 53 | segments | params.resolution/detail/detailScale (preset) → regenerateTerrain | le MNT du bloc — le crop en dépend par `dem` | ✅ | 0.271 | 0.436 | — |
| 54 | Détail (zoom) | params.demZoom → onZoomPicked → chargement MNT | tout le crop | ✅ | 59.588 | 5.620 | `uContourInterval` `uContourOpacity` `uOceanDepth` `uLandMax` `uReliefBas` `uPlancherRampeM` `uMerRampeOn` `uMerFondBudgetM` `uOceanShallow` `uOceanMid` `uOceanDeep` `uResRefM` `uCropOn` `uEstompage` `uHabOn` `uCoastMaskOn` `uMargeCoteM` `uSolOpacite` `uContourWeight` `uAerialCoastFade` `uFondOn` `uFondMetres` `uAnalysisOn` `uTexShade` `uWetK` `uExpoK` `uHemi` `uTreeLine` `uHeightContrast` `uHeightPivot` `uHazeAmt` `uHazeColor` `uEclairageOn` `uSoleilDir` `uSoleilIrr` `uHemiHaut` `uCielIrr` `uSolIrr` `uParoiCielIrr` `uParoiSolIrr` `uAlbedoBase` `uAlbedoTeinte` `uSurfaceFx` `uFxBlend` `uFxOpacite` `uFxColA` `uFxColB` `uFxP1` `uFxP2` `uFxP3` `uParoiCouleur` |
| 55 | Détail fin | params.detail → regenerateTerrain (relâchement) | maillage du bloc plat ; le crop a son propre maillage | ⛔ | 0.000 | 0.000 | — |
| 56 | Échelle du détail | params.detailScale → idem | idem | ⛔ | 0.000 | 0.000 | — |

## Panneau « Fonds »

**Fond**

| # | à l’écran | écrit | lu par | sphère | moy | grad | uniformes du globe |
|---|---|---|---|---|---|---|---|
| 57 | Couleurs auto depuis la carte | params.bgAuto → autoBgColours → applyBackground | scene.background / sceneGlobe | ✅ | 1.002 | 0.222 | — |
| 58 | picker (4 vignettes) | params.bgMode (Uni/Linéaire/Radial/Points) → applyBackground | scene.background — visible derrière le globe | ✅ | 41.446 | 1.919 | `uShadowColor` `uNuitFond` |

**Ciel (HDRI)**

| # | à l’écran | écrit | lu par | sphère | moy | grad | uniformes du globe |
|---|---|---|---|---|---|---|---|
| 59 | picker (5 vignettes) | params.bgEnv (HDRI) → setBgEnv → scene.environment + background | toute la scène, globe compris | ✅ | 74.153 | 4.236 | `uShadowColor` `uNuitFond` `uCielIrr` `uSolIrr` |

## Panneau « Éléments »

**Lumière**

| # | à l’écran | écrit | lu par | sphère | moy | grad | uniformes du globe |
|---|---|---|---|---|---|---|---|
| 60 | chips (Aube/Midi/Heure dorée/Nuit) | params.timeOfDay (chips Aube/Midi/…) → applyTimeOfDay | habillage crop (soleil*) + soleil-monde.js | ✅ | 131.545 | 7.773 | `uSunDir` `uShadowColor` `uNuitFond` `uSoleilDir` `uSoleilIrr` `uCielIrr` `uSolIrr` `uParoiCielIrr` `uParoiSolIrr` `uInk` `uContourWeight` |
| 61 | Heure | params.timeOfDay → applyTimeOfDay | idem | ✅ | 131.939 | 7.784 | `uSunDir` `uSoleilDir` `uCielIrr` `uSolIrr` `uParoiCielIrr` `uParoiSolIrr` |
| 62 | Soleil | params.sunEnabled → applySunSwitch → sun.intensity | habillage crop (`soleilIntensite`) | ✅ | 6.374 | 1.476 | `uSoleilIrr` |
| 63 | Azimut | params.sunAzimuth → placeSun | habillage crop (`soleilAzimut`) | ✅ | 2.485 | 1.038 | `uSoleilDir` |
| 64 | Élévation | params.sunElevation → placeSun | habillage crop (`soleilElevation`) | ✅ | 7.520 | 1.575 | `uSoleilDir` `uSoleilIrr` |
| 65 | Intensité du soleil | params.sunGain → applyTimeOfDay | habillage crop (`soleilIntensite`) | ✅ | 12.433 | 2.509 | `uSoleilDir` `uSoleilIrr` |
| 66 | Lumière ambiante | params.hemiGain → applyTimeOfDay | habillage crop (`hemiIntensite`) | ✅ | 3.884 | 0.686 | `uCielIrr` `uSolIrr` `uParoiCielIrr` `uParoiSolIrr` |
| 67 | Éclairage d’environnement | params.envGain → applyTimeOfDay → scene.environmentIntensity | habillage crop (`ambianteIntensite`) + toute la scène | ✅ | 12.859 | 2.734 | `uCielIrr` `uSolIrr` |
| 68 | Douceur des ombres | params.shadowSoftness → setShadowSoftness → sun.shadow.radius | ⛔ ombres portées du bloc plat ; le crop n'en reçoit pas | ⛔ | 0.000 | 0.000 | — |
| 69 | Appoint | params.fillEnabled → setFillEnabled → placeFill | ⛔ lampe d'appoint dans la scène du BLOC | ⛔ | 0.000 | 0.000 | — |
| 70 | Intensité | params.fillIntensity → placeSun | ⛔ idem | ⛔ | 0.001 | 0.002 | — |
| 71 | Écart au soleil | params.fillAzimuthOffset → placeSun | ⛔ idem | ⛔ | 0.000 | 0.000 | — |
| 72 | Hauteur | params.fillElevation → placeSun | ⛔ idem | ⛔ | 0.000 | 0.000 | — |
| 73 | Couleur | params.fillColor → placeSun | ⛔ idem | ⛔ | 0.000 | 0.000 | — |

**Nuages**

| # | à l’écran | écrit | lu par | sphère | moy | grad | uniformes du globe |
|---|---|---|---|---|---|---|---|
| 74 | chips (Dégagé/Épars/Couvert/Dramatique) | params.cloudsEnabled + 4 params → clouds.build | clouds2/cloud-volume + globe-clouds.js | ⛔ | 0.000 | 0.000 | — |
| 75 | Densité | params.cloudOpacity → uniformes nuages | idem | ⛔ | 0.000 | 0.000 | — |
| 76 | Texture cotonneuse | params.cloudTexMix → uniformes nuages | idem | ⛔ | 0.001 | 0.002 | — |
| 77 | Échelle | params.cloudScale → clouds.build (relâchement) | idem | ⛔ | 0.000 | 0.000 | — |
| 78 | Trouées | params.cloudCoverage → uniformes nuages | idem | ⛔ | 0.000 | 0.000 | — |
| 79 | Bourgeonnement | params.cloudBillow → uniformes nuages | idem | ⛔ | 0.000 | 0.000 | — |
| 80 | Luminosité | params.cloudBrightness → uniformes nuages | idem | ⛔ | 0.000 | 0.000 | — |
| 81 | Contraste | params.cloudContrast → uniformes nuages | idem | ⛔ | 0.000 | 0.000 | — |
| 82 | Translucidité | params.cloudSSS → uniformes nuages | idem | ⛔ | 0.001 | 0.002 | — |
| 83 | Altitude | params.cloudAltitude → clouds.build (relâchement) | idem | ⛔ | 0.000 | 0.000 | — |
| 84 | Étalement en altitude | params.cloudAltSpread → clouds.build (relâchement) | idem | ⛔ | 0.000 | 0.000 | — |
| 85 | Vitesse de dérive *(mouvement)* | params.cloudDrift → uniformes nuages | idem | ⛔ | 0.000 | 0.000 | — |
| 86 | Variation de dérive *(mouvement)* | params.cloudDriftVar → uniformes nuages | idem | ⛔ | 0.001 | 0.002 | — |

**Vent**

| # | à l’écran | écrit | lu par | sphère | moy | grad | uniformes du globe |
|---|---|---|---|---|---|---|---|
| 87 | Direction *(mouvement)* | params.windDir → params seul | clouds-sim.js | ⛔ | 0.000 | 0.000 | — |
| 88 | Force *(mouvement)* | params.windSpeed → params seul | clouds-sim.js | ⛔ | 0.000 | 0.000 | — |

**Mer**

| # | à l’écran | écrit | lu par | sphère | moy | grad | uniformes du globe |
|---|---|---|---|---|---|---|---|
| 89 | Mer animée | params.waterReal → waterRebuild | realWater.reglagesMer → globe.majReglagesMer | ✅ | 1.685 | 0.662 | — |
| 90 | chips (Calme/Brise/Agitée) | seaWaveH/seaChop/seaSpeed (chips) → realWater.setWaves | `etatMerDuSocle` → globe.majReglagesMer | ✅ | 0.334 | 0.378 | — |
| 91 | Hauteur des vagues | params.seaWaveH → realWater.setWaves({height}) | idem | ✅ | 0.140 | 0.236 | — |
| 92 | Transparence du fond | params.waterTransparency → realWater.setLook | `lameEauDuSocle` → globe | ✅ | 6.032 | 1.024 | — |
| 93 | Reflet du soleil | params.waterSunFx → realWater.setLook | `lameEauDuSocle` → globe | ⛔ | 0.000 | 0.000 | — |
| 94 | Couleur de l’eau | params.lakeColor → realWater.setLook | `couleursEauDuSocle` → globe | ✅ | 0.694 | 0.158 | — |
| 95 | picker (6 vignettes) | params.seaBed + ocean* → realWater.setSeabed + rampe | `couleursFondDuSocle` → globe | ✅ | 2.485 | 0.551 | `uOceanShallow` `uOceanMid` `uOceanDeep` |
| 96 | Clapot | params.seaChop → realWater.setWaves({choppiness}) | `etatMerDuSocle` → globe | ✅ | 0.243 | 0.253 | — |
| 97 | Vitesse *(mouvement)* | params.seaSpeed → realWater.setWaves({speed}) | `etatMerDuSocle` → globe | ⚠️ | 0.329 | 0.318 | — |
| 98 | Réfraction | params.seaRefract → realWater.setLook | `refractionDuSocle` → globe | ✅ | 0.081 | 0.138 | — |
| 99 | Tranche de verre | params.seaEdge → waterRebuild (tranche de verre) | ⛔ la tranche est une géométrie du bloc plat | ✅ | 0.431 | 0.344 | — |
| 100 | Givre de tranche | params.seaEdgeFrost → realWater.setLook → uFrost | `givre` de reglagesMer → globe | ✅ | 0.548 | 0.262 | — |

## Panneau « Effets »

**Développement**

| # | à l’écran | écrit | lu par | sphère | moy | grad | uniformes du globe |
|---|---|---|---|---|---|---|---|
| 101 | chips (Naturel/Doux/Contrasté) | exposure/contrast/saturation/vignette/grain (chips) → passes du composer | composer — plein écran | ✅ | 19.861 | 2.686 | — |
| 102 | Exposition | params.exposure → exposureFx.uniforms | composer | ✅ | 149.754 | 3.300 | — |
| 103 | Contraste | params.contrast → contrastFx.uniforms | composer | ✅ | 44.841 | 6.289 | — |
| 104 | Saturation | params.saturation → hueSat.saturation | composer | ✅ | 14.483 | 0.858 | — |
| 105 | Vignettage | params.vignette → vignette.darkness | composer | ✅ | 49.058 | 1.874 | — |
| 106 | Grain | params.grain → grain.blendMode.opacity | composer | ✅ | 2.872 | 5.415 | — |

**Rendu**

| # | à l’écran | écrit | lu par | sphère | moy | grad | uniformes du globe |
|---|---|---|---|---|---|---|---|
| 107 | Ombrage des creux (SSAO) | params.ssaoEnabled → aoPass (tick de main.js) | composer — profondeur de la scène rendue | ✅ | 0.244 | 0.149 | — |
| 108 | Intensité de l’ombrage | params.ssaoIntensity → ssao.intensity | composer | ✅ | 1.430 | 0.485 | — |
| 109 | Diffusion dans la matière (SSS) | params.sssEnabled → terrain.setSSS | ⛔ nuanceur du bloc plat | ✅ | 0.192 | 0.386 | — |
| 110 | Force de la diffusion | params.sssStrength → terrain.setSSS | ⛔ idem | ✅ | 0.192 | 0.386 | — |
| 111 | Netteté du halo | params.sssPower → terrain.setSSS | ⛔ idem | ⛔ | 0.000 | 0.000 | — |
| 112 | Teinte traversante | params.sssColor → terrain.setSSS | ⛔ idem | ⛔ | 0.000 | 0.000 | — |
| 113 | Animations *(mouvement)* | params.animations → animationsActives() | nuages, mer, faune, grain | ⚠️ | 1.945 | 2.631 | — |

## Panneau « Parcours » — *hors mode Studio*

**Style du tracé**

| # | à l’écran | écrit | lu par | sphère | moy | grad | uniformes du globe |
|---|---|---|---|---|---|---|---|
| 114 | chips (Fine/Classique/Épaisse) | gpx lineWidth (chips) → gpxLayer | calque de parcours (hors mode Studio) | ⛔ | 0.000 | 0.000 | — |
| 115 | Couleur | params.gpxColor → gpxLayer | idem | ⛔ | 0.000 | 0.000 | — |
| 116 | Épaisseur | params.gpxWidth → gpxLayer | idem | ⛔ | 0.000 | 0.000 | — |

**Options de lecture**

| # | à l’écran | écrit | lu par | sphère | moy | grad | uniformes du globe |
|---|---|---|---|---|---|---|---|
| 117 | Altitude en direct | params.raceAlt → course | idem | ⛔ | 0.000 | 0.000 | — |
| 118 | Pente en direct | params.racePente → course | idem | ⛔ | 0.000 | 0.001 | — |
| 119 | Suivi | suivi → poursuite.js | idem | ⚠️ | 0.007 | 0.013 | — |
| 120 | Vitesse du suivi | vitesse du suivi → poursuite.js | idem | ✅ | 0.162 | 0.326 | — |

## Panneau « Mes créations »

**(sans section)**

| # | à l’écran | écrit | lu par | sphère | moy | grad | uniformes du globe |
|---|---|---|---|---|---|---|---|
| 121 | segments | onglet Mes créations → interface seule | — | ⛔ | 0.000 | 0.000 | — |

## Panneau « Paramètres »

**Performance**

| # | à l’écran | écrit | lu par | sphère | moy | grad | uniformes du globe |
|---|---|---|---|---|---|---|---|
| 122 | Échelle de rendu | params.pixelRatio → applyRenderSize | renderer + composer | ✅ | 7.157 | 6.688 | — |
| 123 | Ombres | params.shadowMode → applyShadowMode | ombres du bloc plat + renderer.shadowMap | ⛔ | 0.000 | 0.000 | — |
| 124 | Résolution des ombres | params.shadowRes → setShadowRes | idem | ⛔ | 0.000 | 0.000 | — |
| 125 | Résolution du maillage | params.resolution → regenerateTerrain | maillage du bloc plat | ✅ | 0.288 | 0.488 | — |
| 126 | Mode continu 3×3 (glisser le terrain) | fenêtre continue 3×3 → f3Applique (recharge la zone) | terrain.fenetre + damier | ✅ | 13.141 | 2.672 | `uCoastMaskOn` |
