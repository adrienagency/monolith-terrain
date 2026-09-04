# EAU — UNE MER QUI RESSEMBLE À UNE MER : L'ÉTUDE, LE RENDU, LE COÛT

Arbre `C:\Dev\wt-eau`, branche `mer-vraie-eau`, au-dessus de `6275e62` (« Fusion
RAMP »). Serveur `127.0.0.1:9877`. Sonde neuve, rejouable :
`scripts/sonde-eau.mjs`. Relevés dans `.banc/EAU/EAU.json`, captures dans
`.banc/EAU/pour-adrien/` (3 lieux × 3 cadrages × avant/après, même phase de
houle, même image).

> **Adrien, 2026-09-05** : *« Si jamais tu peux redonner un vrai effet "eau" à la
> mer, ce serait top, car là ce n'est pas la folie visuellement. Base-toi sur ce
> qui fait qu'une mer ressemble vraiment à une mer, il y a des tonnes d'études 3D
> là-dessus. »*

**Les cinq chiffres du critère, séparés :**

| | avant | après |
|---|---|---|
| **Fresnel PEINT** (Δ pixel entre `uSky` blanc et noir, moyenne sur la nappe, même image) — Bretagne au ras 12° / au nadir 88° | 0,117 / 0,0005 | **0,233 / 0,014** — rapport **16,3**, contre 16 pour Schlick à N·V = sin 12° (0,32 / 0,02) ; l'ancienne loi rendait 234 parce que son nadir vaut zéro |
| **spéculaire du soleil** | `pow(N·H, 110)`, tache ronde | Beckmann sur σ² de Cox & Munk, **traînée allongée vers l'observateur** (`Bretagne-ras-15.5h-APRES.png`), et le barycentre des 0,5 % de pixels les plus clairs **bouge avec l'heure** : y = 0,75 à 9 h 30 → 0,86 à 13 h (Rodrigues, ras) |
| **écume** — part quasi blanche de la nappe (min(r,g,b) > 225) | Moorea 45° : 0,76 % ; Saint-Malo : plaques au kilomètre | Moorea : **0,32 %** (Monahan à 10 m/s : 0,99 %) ; côte de Saint-Malo : ressac inchangé (0,054 → 0,054 — c'est la loi de côte du socle, pas les moutons) |
| **tuilage** — pic secondaire d'autocorrélation (passe-haut 24 px, 20 images) | 0,006 – 0,015 | **0,006 – 0,015** — aucun motif répété, des deux côtés |
| **coût GPU** (1600×1000, `EXT_disjoint_timer_query_webgl2`, 6 × 30 images, A/B alterné dans la même page) | passe mer 0,06 – 0,32 ms | **Δ image = −0,28 … +0,24 ms, bruit ± 0,08 – 0,53 ms : sous le bruit**, ≤ +1,0 ms tenu aux 9 postes |
| ⛔ acquis | | **0 px hors arête** (`sonde-mer-jupe` rejouée sur cet arbre, 6 postes × 20 images — §4.3) ; géométrie, `bordDeMer`, D20, D23 : **aucune ligne touchée** |
| `npm test` | 5 000 · 0 | **5 016 · 0** (+13 dans `test/eau-lumiere.test.js`, +3 ⑱) — `audit:tests` **272 = 272** |

---

## 1. L'ÉTUDE — ce qui fait qu'une mer est LUE comme une mer, sourcé

Légende : **[É]** = l'éditeur / l'auteur le dit ; **[M]** = mesuré par un tiers
(océanographie, physique) ; **[F]** = folklore de forum, à ne pas citer comme
preuve.

### 1.1 La forme

| mécanisme | ce que dit la source | statut |
|---|---|---|
| **Spectre de Phillips** | Tessendorf 2001, éq. 23 : `Ph(k) = A · exp(−1/(kL)²) / k⁴ · |k̂·ŵ|²`, `L = V²/g` ; « the cosine factor eliminates waves that move perpendicular to the wind direction » ; damping `exp(−k²ℓ²)`, `ℓ ≪ L` (éq. 24). Exemple : N = 512, patch 1 000 m, vent 31 m/s, ℓ = 1 m. | [É] — et Tessendorf lui-même : « poor convergence properties at high k » |
| **JONSWAP / TMA** | Horvath 2015 (DigiPro) : spectres empiriques (JONSWAP, TMA), fonctions d'étalement directionnel (Donelan-Banner), paramètre « swell » ; Ryan 2025 : Phillips est « rather inaccurate » parce qu'une mer n'est jamais pleinement développée ; JONSWAP porte des constantes mesurées en mer. | [M] (JONSWAP = campagne JONSWAP 1973, mer du Nord) |
| **Gerstner** | Finch, GPU Gems 1 ch. 1 (2004) : cambrure `Q`, contrainte `Qᵢ = Q/(wᵢAᵢ·N)` sinon boucles ; **4 trains géométriques au sommet + ~15 sinus dans une carte de normales 256²** ; « the fine waves in our water texture » portent le réalisme, la géométrie n'est qu'une ondulation. Directions « drawn randomly from some range of directions about the wind direction ». | [É] |
| **FFT** | Tessendorf 2001 §3 : patch Lx × Lz périodique ; « as long as the patch size is large compared to the field of view, this periodicity is unnoticeable […] it may be apparent as repeated structures across the field of view ». Ryan 2025 : « 256×256 or 512×512 being the sweet spots », ≤ 4 cascades, longueurs L sans facteur commun (« if a common factor for any two values of L exists, then the tiling will be visible »). Ubisoft La Forge 2023 : « when tiled over a large area and seen from afar, the tiling becomes visually apparent ». | [É] |
| **Choppiness / Jacobien** | Tessendorf 2001 §3.3, éq. 30 : `J = Jxx·Jyy − Jxy·Jyx`, `J < 0` = la surface se replie — « the folds […] align with the regions in which J < 0 ». Dupuy & Bruneton 2012 : couverture de moutons préfiltrée `W = ½ erf(√2/2 · (ε − μ)/σ) + ½` sur le jacobien. | [É] |
| **Directionnalité du vent** | Phillips `|k̂·ŵ|²` ; Tessendorf fig. 8 : `|k̂·ŵ|⁶` aligne plus fortement. | [É] |
| **Vagues capillaires en normal map** | Finch 2004 (ci-dessus) ; Sea of Thieves (Ang, SIGGRAPH 2018) : trois cascades de normales, de la grosse à la capillaire, sur une base FFT. | [É] |

### 1.2 La lumière

| mécanisme | ce que dit la source | statut |
|---|---|---|
| **Fresnel de Schlick** | Schlick 1994 : `R(θ) = R₀ + (1 − R₀)(1 − cos θ)⁵`, `R₀ = ((n₁−n₂)/(n₁+n₂))²` ; pour l'eau `n = 1,333` (Jensen & Golias 2001) → **R₀ = 0,0204**. Tessendorf 2001 fig. 21 : réflectivité exacte ~2 % au nadir, → 1 au rasant, et : « variation of the reflectivity across an image is an important source of the "texture" or feel of water ». Dupuy & Bruneton `ocean.glsl` : `0.02 + 0.98 * pow(1 - dot(V, H), 5)`. | [M] (Fresnel exact), [É] (Schlick) |
| **Réflexion du ciel** | Jensen & Golias 2001 : « reflection and refraction effects are the primary visual determinants » ; Tessendorf : `color sky = (0.69, 0.84, 1)`, `air` sombre — un ciel n'est pas une couleur unie. Dupuy & Bruneton : `fresnel * meanSkyRadiance(V, N, …)`. | [É] |
| **Spéculaire du soleil** | Cox & Munk 1954 (photos de miroitement depuis un B-17) : `σ² = 0,003 + 0,00512·U` (U à 12,5 m, valide ≤ 14 m/s) ; NOAA PSL : « the ratio of the glitter-pattern width to its length is given by the sine of the source elevation angle » — la traînée est **allongée vers l'observateur** ; « the pdf variance increases approximately linearly with wind speed ». Bruneton, Neyret, Holzschuch 2010 ; Dupuy & Bruneton 2012 (`reflectedSunRadiance`, Beckmann anisotrope + Smith). | [M] |
| **Diffusion sous-surface** | Ang 2018 (Sea of Thieves) : « We blend between a deep water colour and a sub-surface water colour based on a combination of view angle, sun direction and a wave peak mask […] wave peaks […] show more sub-surface due to shorter distance traveled by light through the water ». Atlas (GDC 2019, Mihelich & Tcheblokov) : `SSS = k₁·hauteur × k₂(V·−L) × k₃(N·L) × k₄` × couleur de diffusion × soleil. | [É] |
| **Absorption avec la profondeur** | Beer-Lambert `I = I₀ e^(−a d)` ; Pope & Fry 1997 (Applied Optics 36) : l'absorption de l'eau pure croît du bleu au rouge, d'où le bleu des eaux claires ; Jerlov : types I–III et 1–9 (côtières, plus vertes). | [M] |

### 1.3 La surface

| mécanisme | ce que dit la source | statut |
|---|---|---|
| **Écume** | Tessendorf §3.3 (jacobien) ; Dupuy & Bruneton 2012 ; Ang 2018 : « foam is generated at wave peaks […] progressively blur the result of the foam buffer with feedback ». **Couverture réelle** : Monahan & O'Muircheartaigh 1980, `W = 3,84·10⁻⁶·U^3,41` — **1 % à 10 m/s, 3,4 % à 14 m/s, 0,1 % à 5 m/s**. | [M] (Monahan) |
| **Caustiques** | Tessendorf §4 (caustics, godrays) ; Jensen & Golias 2001. Sous la surface ou sur fond peu profond seulement. | [É] |
| **Réfraction du fond** | Jensen & Golias 2001 (« primary visual determinants ») ; `ocean.js` v44 du dépôt. | [É] |

### 1.4 Le mouvement

| mécanisme | ce que dit la source | statut |
|---|---|---|
| **Pas de tuilage** | Tessendorf (patch grand devant le champ de vue), Ryan 2025 (cascades sans facteur commun), Ubisoft La Forge 2023 (tiling & blending hexagonal). | [É] |
| **Pas de motif qui « nage »** | Finch 2004 : les normales défilent avec le vent, pas sur des axes fixes. | [É] |
| **Vagues qui s'orientent vers la côte** | Réfraction de houle (loi de Snell sur la bathymétrie) — dans le dépôt : `shoreSurf` (`SHORE_SURF_GLSL`, gradient du champ de distance au rivage). | [M] (physique), [É] (implémentation) |

### 1.5 Ce que je classe folklore

- « Un `pow(N·H, 200)` suffit pour le soleil » — [F] : il rend une tache ronde ;
  la traînée allongée est une propriété de la distribution de pentes (NOAA,
  Cox & Munk), pas un réglage d'exposant.
- « Le Fresnel plafonné à 0,5 évite les continents pâles » — [F] du dépôt
  (`ocean.js:526`) : le plafond corrigeait un `dot` pris dans le mauvais repère
  (mesuré par R2 : facteur 16,4), pas une propriété de l'eau.

---

## 2. L'APPLICABILITÉ — ancrée dans `mer-sphere.js` / `MER_FRAG`

La nappe : **4 225 nœuds / 8 192 triangles** (MER2), rendue par `composer`,
passe mer **sous le bruit** (PA : ≈ 0,02 ms), le GPU paie **des pixels**
(2,1 ms/Mpx). Marge en fragment, pas en géométrie.

| mécanisme | dans le dépôt avant | applicable ? | fait |
|---|---|---|---|
| Gerstner 16 trains | oui (`GERSTNER_GLSL`, vendoré) | déjà là | — |
| **FFT** | non | ⛔ **pas tenable, chiffré** : une FFT 256² = 2·log₂256 = 16 passes de 65 536 fragments + spectre + normales ≈ **1,3 Mpx de fragment par image** — 0,4 à 2,7 ms selon la passe (à 0,3–2,1 ms/Mpx), soit **jusqu'à 2,7× le budget de +1 ms** ; et surtout la calotte n'a que **65² sommets** : Nyquist exige 256² sommets pour porter 256² de déplacement, c'est-à-dire **15× la géométrie que D24 vient de retirer**. Le détail fin vit dans le fragment (Finch) — c'est là qu'on l'a mis. | — |
| Fresnel de Schlick | ⛔ `min((1−N·V)⁵, 0.5) × 0.35` : **0 au nadir, 0,175 au rasant** | oui, deux lignes | ✅ `schlickEau`, F₀ = 0,02 |
| Réflexion du ciel | ⛔ `uSky` couleur UNIE, mixée à 0,35 × fres | oui ; ⚠️ **pas l'HDRI** : `sceneGlobe.environment` vaut `roomEnvTex` par défaut — la **RoomEnvironment** de three, un studio, pas un ciel. Refléter ce studio dans la mer serait faux ; l'HDRI n'existe que si `params.bgEnv` est choisi. Dégradé analytique horizon → zénith, pondéré par Schlick. | ✅ `cielReflechi` |
| Spéculaire du soleil | ⛔ `pow(N·H, uGloss)` Blinn-Phong, tache ronde | oui : Beckmann sur σ² de Cox & Munk, `F(V·H)·D/(4 N·V)` ; le vent dérivé de `uWaveH` (`ventDeHoule`) | ✅ `glitterSoleil`, `varianceCoxMunk` |
| Diffusion sous-surface | ⛔ absente | oui : hauteur de houle normalisée (`vHouleH`, sommet) + jacobien (`vCrete`) × `(L·−V)³` × (1 − F) | ✅ `lueurSousSurface` |
| Absorption / profondeur | oui (`corpsEau`, `dLagon`, bathymétrie) | déjà là, précise — **gardée** | — |
| Écume crêtes + côte | oui (`GLSL_ECUME`, partagé avec le socle) | ⚠️ **plaques** : `smoothstep(0.30, 0.60, crete)` couvrait la baie de Saint-Malo de blanc au kilomètre (§4) ; Monahan dit ~1 %. Le crop passe une crête **remise à l'échelle** (`creteMoutonnante`, seuil 0,62) — la loi partagée ne bouge pas. Ressac et liseré de côte : inchangés. | ✅ |
| Caustiques | `uCaustics` retiré hier ; vérifié : **aucune occurrence** dans `src/` | non : invisibles depuis 20–40 km, sur fond bathymétrique à 240 m/échantillon | — |
| Réfraction du fond | oui (R2, grab pass) | déjà là — gardée | — |
| Normales capillaires | 2 bruits (`clapotNormale`), axes fixes | oui : 2 cascades de plus (×4,7, ×7,3 — sans facteur commun avec 1 et 1,9), qui défilent **avec le vent dominant** lu sur le spectre | ✅ `uMerVent` |
| Vagues vers la côte | oui (`shoreSurf`) | déjà là | — |

**Interrupteur d'A/B** : `uMerVraieEau` — 1 = livraison, 0 = l'image d'avant
**au bit près** (les deux lignes historiques sont dans la branche `else`, test
⑥b). C'est ce qui rend les captures et le coût comparables **dans la même
image**, à la même phase de houle.

---

## 3. LE RENDU — ce qui change dans `MER_FRAG`, sous `uMerVraieEau`

Nouveau module pur `src/monde/eau-lumiere.js` (JS + GLSL, une écriture), injecté
dans `MER_FRAG`. Dans le fragment, quand `uMerVraieEau > 0.5` :

1. **Fresnel** : `fres = schlickEau(N·V)` (0,02 → 1) au lieu de
   `min((1−N·V)⁵, 0.5)`. L'opacité garde son plancher `fres × 0,5` : avec
   Schlick il **monte au rasant** — on ne voit plus le fond sous une mer qui
   reflète le ciel.
2. **Ciel** : `col = mix(col, cielReflechi(uSky, R·haut), fres)` — un dégradé
   horizon → zénith (`CIEL.zenith = (0,48 ; 0,62 ; 0,96)` × horizon, sous-horizon
   × 0,8), indexé sur l'élévation du rayon réfléchi dans le repère du bloc
   (`uMerVersMonde`, le repère que R2 a mesuré à 111° d'écart du monde). Pondéré
   par Schlick entier, plus par `0,35`.
3. **Soleil** : `glitterSoleil(N·H, V·H, N·V, varianceCoxMunk(uMerVentMs))`,
   Beckmann `exp(−tan²θh/2σ²)/(2πσ²cos⁴θh)`, radiance `F(V·H)·D/(4 N·V)`, plafond
   6 ; × `uMerSoleilFx` (la tirette du socle), × `L·haut` (rien sous l'horizon),
   × `mix(0,05 ; 1 ; jour)`. Le vent vient de la houle : `ventDeHoule(uWaveH)`
   = 2 + 4·houle m/s, borné à 14 (la plage de Cox & Munk) — relevé **10 m/s** à
   `uWaveH = 2`.
4. **Lueur sous-surface** : `lueurSousSurface(vHouleH, vCrete, L·−V, fres)` ×
   `uMerPeu` (le turquoise du glacis) × soleil × jour. `vHouleH` est un varying
   neuf : `dy / (½ Σ uWaveA[i].w · λ · houle · calme · unité)`, la hauteur
   rapportée à la demi-somme des amplitudes (les seize trains ne sont jamais en
   phase).
5. **Clapot** : deux cascades de plus (`rp × 4,7` et `× 7,3`, sans facteur commun
   avec 1 et 1,9), mélangées à 35 % dans `r1`/`r2`, et qui **défilent avec
   `uMerVent`** — la direction dominante du spectre, pondérée par `uWaveB[i].z`,
   posée par image dans `majReglagesMer`.
6. **Moutons** : `ecumeMer(creteMoutonnante(vCrete), …)` — la crête remise à
   l'échelle (nulle sous 0,62), la loi partagée `GLSL_ECUME` inchangée.

`uMerVraieEau = 0` : les deux lignes historiques (`mix(col, uSky, fres * 0.35)`
et `pow(max(dot(N, H), 0.0), uMerBrillance) * (0.5 + 1.6 * fres)`) et
`fres = min(pow(1 − N·V, 5), 0.5)`, au caractère près (test ⑥b).

## 4. LES CAPTURES ET LES CHIFFRES — 3 lieux × 3 cadrages, 15 h 30, z11

`scripts/sonde-eau.mjs --port 9877` : `modes.flyTo(lat, lon, 11)` (la pose de la
vidéo d'Adrien, DENT §③), heure posée par `applyTimeOfDay`, trois inclinaisons
(12° / 45° / 88°, azimut 45°), **grain et temps des passes gelés**, A/B
`uMerVraieEau` **dans la même tâche que `composer.render`**, `toDataURL` juste
après. Cibles **sur l'eau** : lagon de Moorea (−17,43 / −149,80), baie de
Saint-Malo (48,70 / −2,00), large de Rodrigues (−19,62 / 63,30). Captures :
`.banc/EAU/pour-adrien/<lieu>-<cadrage>-15.5h-AVANT|APRES.png` (+ Rodrigues au
ras à 9 h 30, 13 h et 18 h).

| lieu | cadrage | nappe à l'écran | Fresnel peint avant → après | part quasi blanche avant → après | tuilage (pic) | Δ temporel/px | passe mer avant → après (ms) | Δ image (ms) ± bruit |
|---|---|---|---|---|---|---|---|---|
| Moorea | ras (12°) | 82 % | 0.0089 → **0.0291** | 0.0062 → 0.0033 | 0.0153 | 1.3 | 0.241 → 0.23 | -0.011 ± 0.261 |
| Moorea | 45 (45°) | 94 % | 0.004 → **0.0215** | 0.0076 → 0.0032 | 0.0142 | 1.46 | 0.32 → 0.166 | -0.155 ± 0.395 |
| Moorea | nadir (88°) | 87 % | 0 → **0.0173** | 0 → 0 | 0.0137 | 1.45 | 0.217 → 0.124 | -0.092 ± 0.263 |
| Bretagne | ras (12°) | 23 % | 0.1171 → **0.2333** | 0.0537 → 0.0666 | 0.0106 | 3.5 | 0.064 → -0.016 | -0.081 ± 0.226 |
| Bretagne | 45 (45°) | 64 % | 0.0051 → **0.0217** | 0.0546 → 0.0539 | 0.0061 | 2.41 | 0.298 → 0.016 | -0.282 ± 0.22 |
| Bretagne | nadir (88°) | 56 % | 0.0005 → **0.0143** | 0.0558 → 0.0544 | 0.0069 | 2.43 | 0.063 → 0.196 | 0.133 ± 0.239 |
| Rodrigues | ras (12°) | 100 % | 0.0457 → **0.125** | 0 → 0 | 0.0153 | 1.23 | 0.185 → 0.423 | 0.238 ± 0.531 |
| Rodrigues | 45 (45°) | 96 % | 0.0037 → **0.0187** | 0 → 0 | 0.0139 | 0.77 | 0.207 → 0.159 | -0.047 ± 0.155 |
| Rodrigues | nadir (88°) | 90 % | 0 → **0.0128** | 0 → 0 | 0.0132 | 0.93 | 0.147 → 0.169 | 0.022 ± 0.082 |

- **Fresnel** : le rapport rasant / nadir **après** vaut 16,3 (Bretagne), 1,7
  (Moorea, lagon : le glacis clair domine), 9,8 (Rodrigues). Théorie à 12° : 16.
  Les valeurs absolues sont **celles de l'image** — après réfraction, flou D20,
  tonalité et grain — pas celles du nuanceur ; c'est ce qu'Adrien voit.
- **Soleil** : `Bretagne-ras-15.5h-APRES.png` — la traînée de miroitement est
  en haut à droite, allongée vers la caméra, faite de points (Cox & Munk) là où
  `AVANT` rend des rangées parallèles à la houle. À Rodrigues, le barycentre
  des pixels clairs passe de y = 0,75 (9 h 30) à 0,86 (13 h) ; à 18 h le soleil
  est trop bas (luminance max 210/765) pour qu'un barycentre ait un sens.
- **Écume** : `Moorea-45-*` et `Moorea-nadir-*` — les taches blanches du large
  (AVANT) disparaissent, le ressac de côte reste. `Bretagne-45-*` — les plaques
  de la baie sont **la bande de ressac du socle** (`largeurRessac`, 0,75 de
  15 unités de socle ≈ 3,7 km à ce crop), pas les moutons : je ne l'ai pas
  touchée, c'est la loi partagée, et je le dis plutôt que de la déguiser.
- **Tuilage** : 0,006 à 0,015 sur 20 images à tous les postes, des deux côtés —
  les bruits de clapot sont des bruits de valeur sur `vLocal`, pas des textures.
- **Coût** : Δ image entre −0,28 et +0,24 ms, bruit 0,08 à 0,53 ms : **sous le
  bruit**. La passe mer elle-même (A/B `mer.visible`) vaut 0,02 à 0,42 ms selon
  la couverture — cohérent avec PA (« la passe mer est sous le bruit »).

### 4.3 Les acquis, revérifiés

- **0 px de mer au-delà de l'arête** : `scripts/sonde-mer-jupe.mjs --port 9877
  --etiquette EAU-jupe --repete 1 --alts 28000,12000` rejouée sur cet arbre :
  **6 postes probants sur 6, hors arête max 0 px, total 0 px sur 20 images**,
  témoin `chop = 0` à 0 px (`.banc/MER2/EAU-jupe.json`).
- **Coupe plate (D24), `bordDeMer()`, `portee = 3`, `emprise = 1`** : `git diff
  src/monde/mer-sphere.js` est **vide** ; `MER_VERT` ne change que par le
  varying `vHouleH` (calculé après le déplacement, il ne le modifie pas).
- **D20** (flou) et **D23** (la mer n'existe qu'en crop) : aucune ligne de
  `main.js` touchée ; les captures au large de Rodrigues montrent le flou D20
  sur toute la nappe — c'est lui qui domine l'image de haute mer à z11, pas la
  matière d'eau.
- ⚠️ **À `wt-soc`** : au large de Rodrigues, des **triangles pâles** flottent
  sur la nappe (`Rodrigues-45-15.5h-APRES.png`, `Rodrigues-ras-9.5h-APRES.png`) ;
  ils sont là AVANT comme APRÈS — des morceaux de plaque de socle vus au-dessus
  de l'eau, pas la mer. Je ne les ai pas touchés.

---

## 5. LES TESTS — ils mordent

`test/eau-lumiere.test.js` (neuf, inscrit dans `package.json`, `audit:tests`
**272 = 272**) et `test/mer-sphere.test.js` ⑱a–c.

| test | ce qu'il ferme |
|---|---|
| ①a–c | F₀ **dérivé** de n = 1,333 ; Schlick 0,02 → 1, monotone, rapport 50 ; le GLSL **traduit et exécuté** = le jumeau JS ; l'ancienne loi rejouée en témoin (0 → 0,175) |
| ②a–b | Cox & Munk 1954 au chiffre, moitié par axe, **bornée à 14 m/s** ; vent dérivé de la houle dans la plage mesurée |
| ③a–c | lobe maximal en H = N, décroissant, **s'élargit avec le vent et son pic baisse** ; **l'intégrale de Beckmann vaut 1** (à 5 %) ; GLSL = JS |
| ④a–b | lueur nulle à plat, nulle dos au soleil, nulle si tout est réfléchi ; crête remise à l'échelle nulle sous 0,62 ; Monahan 1 % à 10 m/s ; `MER_FRAG` passe bien `creteEcume` |
| ⑤a | dégradé horizon/zénith/sous-horizon, GLSL = JS |
| ⑥a–b | **une seule écriture** : aucune des six fonctions réécrite dans `globe.js` ni `ocean.js`, les six appelées ; `uMerVraieEau = 0` porte les deux lignes d'avant au caractère près |
| ⑱a–c | `poserMer` pose `uMerVraieEau = 1`, un vent au neutre dérivé de la houle ; `majReglagesMer` **lit** la direction sur le spectre (pondérée, normalisée, inversée quand les poids s'inversent, inchangée si le spectre est muet) et le vent m/s sur la houle |

**Neuf mutations rejouées une par une** (`.banc/EAU/mutations.py`, `src/` seul,
tests inchangés, fichiers restaurés à l'octet — `CR = 0`) :

| mutation | rouges |
|---|---|
| `uMerVraieEau` naît à 0 | ⑱a |
| la crête n'est plus remise à l'échelle | ④b |
| le ciel repondéré par 0,35 | ⑥b |
| le vent n'est plus normalisé | ⑱b |
| le vent m/s ne suit plus la houle | ⑱c |
| F₀ du GLSL à 0,04 (le JS reste à 0,02) | ①c, ③c |
| Beckmann sans le cos⁴ | ③c |
| Cox & Munk non borné à 14 m/s | ②a |
| seuil de crête à 0,30 (la loi du socle) | ④b |

Deux tests de lecture de source **suivis**, pas affaiblis :
`test/ecume-mer.test.js` ③b et `test/trait-cote-mer.test.js` ④ exigent
désormais `ecumeMer(creteEcume, fonduRive, …)` ET la ligne qui définit
`creteEcume` — le fondu par fragment qu'ils gardent est intact.

---

## 6. CE QUE J'AI CRU, PUIS RÉFUTÉ

1. **« Le coût se lit dans la même tâche que la requête »** — non : la première
   campagne a rendu **0,000 ms partout**. `QUERY_RESULT_AVAILABLE` ne passe à
   vrai qu'après un retour à la boucle d'événements ; la boucle d'attente
   sortait sur son plafond et lisait 0. Posé dans une évaluation, lu dans une
   autre (`COUT_POSER` / `COUT_LIRE`).
2. **« Deux rendus identiques rendent le même tampon »** — non : **93 % des
   pixels** différaient et le « masque de la nappe » valait l'écran entier. Le
   grain (`NoiseEffect`) change de phase à chaque image. Gelé comme
   `sonde-mer-crop` le fait (`fullscreenMaterial.time = 0`, `composer.render(0)`).
3. **« L'autocorrélation à 8 px dit s'il y a un motif »** — non : sur une mer
   lisse à dégradé de profondeur, `r(8 px) = 0,76` sans aucun motif. Il faut le
   **passe-haut** (moins la moyenne glissante sur 24 px) et le **premier maximum
   local après le premier minimum**. Après correction : 0,006 à 0,015.
4. **« Les plaques blanches, c'est mon glitter qui sature »** — non : elles
   sont **AVANT comme APRÈS** et dans les mêmes zones. Ce sont les moutons du
   socle (`smoothstep(0.30, 0.60, crete)`) sur une houle de 1,2 km, plus la
   bande de ressac. Monahan (1980) dit ~1 % de couverture à 10 m/s ; le seuil
   0,62 sur la crête ramène Moorea à 0,32 %. La bande de ressac, elle, est une
   loi de côte partagée — laissée.
5. **« La cible du brief (Moorea −17,53 / −149,83) convient au ras »** — non :
   c'est un sommet de l'île ; au ras le cadre est **gris uni** (le relief devant
   l'objectif), à 45° la nappe fait 4 % de l'écran. Cibles déplacées sur l'eau
   (`.banc/EAU/EAU-1.json` et `campagne-1/` gardent la campagne fautive).
6. **« L'intégrale de Beckmann vaut 1, donc le test le vérifie »** — le premier
   jet rendait **0,62** : à 6 m/s le pic dépasse le plafond de 6 et le test
   sautait les échantillons écrêtés. À 12 m/s (pic 4,9) l'intégrale vaut 1 à
   5 %. Le plafond était la cause, pas la loi — et le test le dit maintenant.
7. **« Refléter l'HDRI du pipeline PBR »** — pas ici : `sceneGlobe.environment`
   est **`roomEnvTex`** (la `RoomEnvironment` de three, un studio) tant que
   `params.bgEnv` est vide. Une mer qui reflète un studio serait fausse ; le
   ciel est un dégradé analytique sur `uSky` vivant. Le jour où un ciel HDRI est
   choisi, `cielReflechi` peut être remplacé par un `textureCubeUV` sur
   `scene.environment` (three r172 : `CUBEUV_MAX_MIP = log₂(h) − 2`) — c'est
   écrit, pas fait.
8. **« La part quasi blanche mesure l'écume »** — pas seulement : au ras, le
   miroitement sature aussi au blanc (Bretagne ras 0,054 → 0,067). La colonne
   dit « quasi blanche », pas « écume ».

## 7. À DONNER AUX AUTRES

- **`scripts/sonde-eau.mjs` est rejouable** : `--lieux`, `--cadrages`,
  `--heures`, `--images`, `--cout 0`. Elle gèle le grain, prend l'A/B dans la
  même tâche, mesure le coût en deux temps. Son masque de nappe est un A/B
  `mer.visible` **après gel du grain** — sans le gel il vaut l'écran.
- **`wt-soc`** : les triangles pâles au large de Rodrigues (§4.3).
- **La bande de ressac de côte** (`largeurRessac`, `ecume-mer.js`) est calée
  sur 15 unités de socle : à z11 elle couvre ≈ 3,7 km. Si Adrien la trouve
  trop large, c'est là — et c'est partagé avec `ocean.js`.
- **`ocean.js`** (la mer du socle, mode plat) porte encore l'ancien Fresnel
  (`min(…, 0.5)`, `mix(col, uSky, fres * 0.35)`) et le `pow(N·H, uGloss)`. Le
  module `eau-lumiere.js` est injectable tel quel ; hors périmètre ici (D23 : la
  mer n'existe qu'en crop).

## 7 bis. COMMITS (branche `mer-vraie-eau`, au-dessus de `6275e62`)

- « EAU — la mer reflète, miroite et mousse comme une mer : Schlick, Cox & Munk,
  lueur des crêtes, moutons de Monahan » — `src/monde/eau-lumiere.js` (neuf),
  `src/globe.js` (`MER_VERT` : `vHouleH` ; `MER_FRAG` : la branche `vraieEau` ;
  `poserMer` : trois uniformes ; `majReglagesMer` : le vent), `package.json`,
  `test/eau-lumiere.test.js` (neuf), `test/mer-sphere.test.js` (⑱a–c),
  `test/ecume-mer.test.js` ③b, `test/trait-cote-mer.test.js` ④,
  `scripts/sonde-eau.mjs`, et ce rapport.

---

## 8. SOURCES

- Tessendorf, J. (2001). *Simulating Ocean Water*. SIGGRAPH course notes — https://jtessen.people.clemson.edu/reports/papers_files/coursenotes2002.pdf (texte extrait du PDF, §3 éq. 23–24, §3.3 éq. 30, §4.2 fig. 21).
- Finch, M. (2004). *Effective Water Simulation from Physical Models*, GPU Gems 1 ch. 1 — https://developer.nvidia.com/gpugems/gpugems/part-i-natural-effects/chapter-1-effective-water-simulation-physical-models
- Jensen, L. S. & Golias, R. (2001). *Deep-Water Animation and Rendering* — https://www.gamedeveloper.com/programming/deep-water-animation-and-rendering
- Horvath, C. J. (2015). *Empirical directional wave spectra for computer graphics*, DigiPro '15 — https://dl.acm.org/doi/10.1145/2791261.2791267 ; implémentation https://github.com/blackencino/EncinoWaves
- Ryan, R. (2025). *Ocean Rendering, Part 1 – Simulation* — https://rtryan98.github.io/2025/10/04/ocean-rendering-part-1.html
- Ubisoft La Forge (2023). *Making Waves in Ocean Surface Rendering using Tiling and Blending* — https://www.ubisoft.com/en-us/studio/laforge/news/5WHMK3tLGMGsqhxmWls1Jw/making-waves-in-ocean-surface-rendering-using-tiling-and-blending
- Schlick, C. (1994). *An Inexpensive BRDF Model for Physically-based Rendering* — https://en.wikipedia.org/wiki/Schlick%27s_approximation
- Cox, C. & Munk, W. (1954). *Measurement of the Roughness of the Sea Surface from Photographs of the Sun's Glitter*, J. Opt. Soc. Am. — https://userpages.umbc.edu/~martins/phys650/Cox%20and%20Munk%20Glint%20paper.pdf ; NOAA PSL, *Glittering Light on Water* — https://psl.noaa.gov/outreach/education/science/glitter/
- Bruneton, E., Neyret, F., Holzschuch, N. (2010). *Real-time Realistic Ocean Lighting using Seamless Transitions from Geometry to BRDF*, CGF 29(2) — https://inria.hal.science/inria-00443630v3
- Dupuy, J. & Bruneton, E. (2012). *Real-time Animation and Rendering of Ocean Whitecaps*, SIGGRAPH Asia Technical Briefs — https://dl.acm.org/doi/10.1145/2407746.2407761 ; code https://github.com/jdupuy/whitecaps/blob/master/ocean.glsl (`meanFresnel`, `reflectedSunRadiance`, `whitecapCoverage`)
- Ang, N. (2018). *The Technical Art of Sea of Thieves*, SIGGRAPH Talks — https://history.siggraph.org/wp-content/uploads/2022/09/2018-Talks-Ang_The-Technical-Art-of-Sea-of-Thieves.pdf (texte extrait du PDF, §1.1)
- Mihelich, M. & Tcheblokov, T. (2019). *Wakes, Explosions and Lighting: Interactive Water Simulation in Atlas*, GDC — https://www.gdcvault.com/play/1025819/ ; résumé https://konstantinkz.github.io/blog/water/
- Monahan, E. C. & O'Muircheartaigh, I. (1980). *Optimal Power-Law Description of Oceanic Whitecap Coverage Dependence on Wind Speed*, J. Phys. Oceanogr. 10 — https://journals.ametsoc.org/view/journals/phoc/10/12/1520-0485_1980_010_2094_opldoo_2_0_co_2.xml
- Pope, R. M. & Fry, E. S. (1997). *Absorption spectrum (380–700 nm) of pure water. II*, Applied Optics 36 — https://pubmed.ncbi.nlm.nih.gov/18264420/
- Jerlov water types — https://medium.com/@spoorthisetty99/what-on-earth-are-jerlov-water-types-acbc68ac66d1
- Crest / wave-harmonic *water-resources* (bibliographie) — https://github.com/crest-ocean/water-resources
