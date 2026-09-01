# Rapport R34 — la profondeur de champ : même flou apparent à tout zoom

Arbre `C:\Dev\wt-dof`, branche `flou-zoom`. Serveur de mesure `localhost:6401`
(arrêté en partant). Relevés dans `traces-R34/` (JSON + captures des mires),
sonde `scripts/sonde-r34-flou.mjs`.

**En une ligne :** le flou agissait déjà (217 725 pixels changent à 5 km) et
l'autofocus écrivait la bonne distance en surface (écrit/réel = 0,999) ; ce qui
« semblait mal fonctionner », c'est que le matériau de cercle de confusion
linéarisait la profondeur avec les plans `near`/`far` **de l'altitude où le bokeh
avait été allumé**, que la plage de netteté était une longueur de bloc convertie
une seule fois (5 620 m, à toutes les altitudes), et qu'en orbite la mise au
point ne suivait rien. Après : la plage vaut `k × distance`, les plans se
resynchronisent, le rayon est lancé contre la Terre affichée à tous les zooms,
et les colonnes du tableau en pixels sont les mêmes à 5 km, 130 km, 2 000 km et
15 000 km.

---

## 1. Le flou agit-il aujourd'hui ? Oui — chiffré

Pixels qui changent entre `dofPass` éteinte et allumée, même image, grain coupé,
témoin (deux rendus identiques) à 0 sur 1 024 000 pixels, seuil 4 par canal :

| altitude | `bokehScale` 3,7 (dépôt) | `bokehScale` 16 | autofocus on → off, pointeur immobile |
|---|---|---|---|
| 5 km (crop z13) | **217 725 px (21,3 %)** | 417 061 px | 0 px |
| 130 km (z9) | 297 230 px (29,0 %) | 558 026 px | 0 px |
| 2 000 km (z4) | 569 670 px (55,6 %) | 823 431 px | 0 px |
| 15 000 km (orbite) | 418 527 px (40,9 %) | 774 135 px | 0 px |

Le **0,000 de l'inventaire (option 1)** n'est pas un flou inerte : basculer
« Mise au point auto » gèle la valeur COURANTE, il ne change rien à l'image par
construction. L'inventaire lisait un interrupteur qui n'agit que sur le futur.
(R21 avait noté « le flou est inerte » sous `?terre=unique` AVANT D16-a, qui l'a
remis en route — 151 243 px ; c'est bien confirmé.)

## 2. Ce qui faisait mal fonctionner l'autofocus — mesuré

### 2a. La distance écrite était juste en surface, absente en orbite

Vingt images, pointeur en déplacement de (25 %, 35 %) à (75 %, 65 %) de l'écran,
distance écrite dans le nuanceur (`cocMaterial.focusDistance` × 63 710 m)
contre la **distance réelle du point sous le pointeur** relue dans le tampon de
profondeur (même espace, même calcul que le nuanceur — voir l'instrument §4).
Rapport écrit/réel, puis valeur convergée pointeur immobile 60 images :

| altitude | rapport pendant le déplacement (20 images) | convergé : écrit / réel (m) | rapport |
|---|---|---|---|
| 5 km | 0,943 … 1,060 | 10 520 / 10 514 | **1,0006** |
| 130 km | 0,981 … 1,019 | 264 566 / 264 908 | **0,9987** |
| 2 000 km | 0,957 … 1,007 | 4 128 613 / 4 211 138 | 0,9804 |
| 15 000 km (orbite) | 0,240 … 0,274 | 4 101 565 / 17 110 222 | **0,2397** |

Les écarts pendant le déplacement sont le RETARD (`dt × 8`, 125 ms), pas une
unité : ils changent de signe avec le sens du mouvement. Le facteur 130,4 de
D16-a n'y est plus (D16-a l'avait corrigé, et `camera-continue.test.js` le
verrouillait). Les 2 % à 2 000 km : le rayon était marché contre le **bloc
plat** (`terrain.sample`) alors que la Terre affichée est la sphère — à z4 le
bloc fait 7 000 km, l'écart croît vers les bords. En orbite : **aucun
autofocus** (`modes.mode === 'surface'` en garde), la valeur restait celle de la
dernière surface — 4 100 km écrits pour 17 100 km réels.

### 2b. Ce qui cassait réellement l'image : les plans `near`/`far` figés

`DepthOfFieldEffect.cocMaterial.copyCameraSettings(camera)` copie `near` et
`far` **par valeur, une seule fois** (à la construction et sur `mainCamera =`) ;
seules les matrices passent par référence. Or `camGlobe.near` vaut 0,0246 à 5 km
et **0,5 dès 130 km** (`planProche`). Le bokeh allumé à 5 km linéarisait donc la
profondeur de toutes les autres altitudes avec le mauvais `near`. Preuve par la
mire posée EXACTEMENT à la distance de mise au point (profondeur relue / d =
1,000) :

| altitude (avant) | near/far de camGlobe | near/far dans le matériau | CoC de la mire au focus | flou au focus |
|---|---|---|---|---|
| 5 km | 0,0246 / 201 | 0,0246 / 201 | 0,00 | 1 px (net) |
| 130 km | 0,5 / 205 | 0,0246 / 201 | **1,00** | **32 px** |
| 2 000 km | 0,5 / 264 | 0,0246 / 201 | **1,00** | 30 px |
| 15 000 km | 0,5 / 1 400 | 0,0246 / 201 | **1,00** | 30 px |

### 2c. Et la plage était une longueur de bloc, convertie une fois

`focusRange = 23` unités de bloc × k(z13) = 0,0882 unité de globe = **5 620 m**,
posée à l'allumage et jamais reposée : plage/focus = 0,53 à 5 km, 0,021 à 130 km,
**0,0014 à 2 000 km** — tout était flou sauf une pastille au centre.

### 2d. Et le pointeur sur un panneau était suivi

`pointermove` sur `window` : le focus suivait le pointeur SOUS le panneau « Mes
créations » (130 km : 4,43 → 4,72 u, le relief sous le panneau, au lieu du centre
4,05 u). Pas de repli.

## 3. La chaîne d'unités, chaque facteur chiffré

Écrite en tête de `poserMiseAuPoint` (`src/main.js`) :

```
point de focus                params.focusDistance        MÈTRES RÉELS (plus jamais en unités de bloc)
  ÷ metresParUniteEffets()    63 710 m/unité              camGlobe (fusion, orbite ET surface) — ORBITAL_M_PER_UNIT
                              largeurBlocM() / 56         hors fusion en surface : 488 m/u à z12, 244 m/u à z13
  = cocMaterial.focusDistance unités de la caméra qui lit la profondeur
plage de netteté              params.focusRatio = k       sans unité (0,3 par défaut, curseur « Plage de netteté »)
  = cocMaterial.focusRange    k × focusDistance           donc k × distance en mètres aussi
cercle de confusion           smoothstep(0, k·f, |d − f|) → à ±20 % : smoothstep(0,2/k) = 0,75, à tout zoom
rayon de flou                 CoC × bokehScale texels     (kernel de rayon ≤ 1 texel, tampon interne 720 px de haut)
plans near/far                copyCameraSettings(cam)     resynchronisés à chaque écriture si l'un des deux a changé
```

⚠️ **Le brief supposait `focusDistance` normalisé dans [0, 1] entre `near` et
`far`.** C'était vrai des versions < 6.30 de postprocessing ; en 6.36.4 le
nuanceur de cercle de confusion calcule `length(viewPosition)` et compare des
longueurs de monde. Vérifié : profondeur relue / d = 1,000 sur toutes les mires.
Le `k` de la similitude (`_kFond`, 0,003 83 à z13, 0,007 67 au lieu de démarrage
— le `1/k = 130,4` de D16-a) ne sert plus à la mise au point : en mètres ÷
63 710, la similitude est déjà dedans.

Sous le pointeur, en espace globe : `distance (unités) × 63 710 = mètres`. Hors
fusion en surface : `distance (bloc) × largeurBlocM / 56 = mètres`
(`blocVersMetres`, aussi pour le point de netteté mémorisé par l'affiche).

## 4. L'instrument — décrit

`scripts/sonde-r34-flou.mjs`, Chrome sans tête, ANGLE D3D11, 1 280 × 800,
palier machine 0 (RTX 3080), grain coupé, `params.animations = false` (gèle la
rotation de veille), voile d'accueil retiré et `elementFromPoint` au centre
vérifié = CANVAS. `window.__exp.THREE` est exposé pour elle (une seconde copie
de three ne partagerait ni caches ni `instanceof`).

1. **Vérité de profondeur** — un quad plein écran relit
   `composer.depthTexture` avec le calcul de `circle-of-confusion.frag`
   (`perspectiveDepthToViewZ` → `projectionMatrixInverse` → `length`) dans une
   cible flottante, lue au pixel voulu. C'est la distance que le flou compare,
   relief exagéré compris, sans rien supposer du relief.
2. **Mires** — cinq panneaux noir | blanc (texture 2 × 1, `NearestFilter`), face
   caméra, 110 px de large quelle que soit la distance, sur les rayons de cinq
   positions d'écran (x = −0,8 · −0,4 · 0 · 0,4 · 0,8), à `d = f × {0,1 · 0,8 · 1
   · 1,2 · 2}` où `f` est la mise au point réellement écrite. `depthFunc:
   AlwaysDepth`, `depthWrite`, **transparentes et `renderOrder` maximal** (les
   tuiles du globe sont transparentes, donc dessinées après tout opaque — une
   mire opaque était recouverte). `−100 %` serait la caméra : la mire proche est
   à 0,1 f ou 1,5 × near, le plus grand (0,19 à 0,21 f à 5 et 130 km).
3. **Largeur de transition 10 → 90 %** — luminance sur la ligne qui traverse
   l'arête, image nette (`dofPass` éteinte) et image floue, distance en pixels
   entre le franchissement de 10 % et de 90 % de la marche. Arête nette : 1 px.
4. **Cercle de confusion relu** — `dof.renderTargetCoC` (R proche, G lointain)
   au centre de la mire, × `bokehScale` = rayon nominal en texels.

Limite connue : derrière le focus, la passe « fill » (filtre max) dilate le blanc
sur le noir ; à 5 km la mire 2 f contre un relief clair donne 17 px de
transition pour un CoC de 1,00 identique aux 30 px des autres altitudes
(`mires-*-5km-bokeh16.png`). À saturation, la colonne CoC est la lecture fiable.

## 5. Le tableau du flou en pixels — avant / après

Transition 10 → 90 % en pixels (CoC relu entre parenthèses), `bokehScale = 16`,
même `k` (après : 0,3 ; avant : la plage figée de 5 620 m).

**AVANT**

| altitude | focus (m) | à −100 % (0,1–0,2 f) | à −20 % | au focus | à +20 % | à +100 % |
|---|---|---|---|---|---|---|
| 5 km | 11 226 | 29 (1,00) | 6 (0,36) | 1 (0,00) | 6 (0,36) | 17 (1,00) |
| 130 km | 258 036 | 29 (1,00) | 30 (1,00) | **32 (1,00)** | 30 (1,00) | 30 (1,00) |
| 2 000 km | 4 006 021 | 29 (1,00) | 30 (1,00) | **30 (1,00)** | 31 (1,00) | 30 (1,00) |
| 15 000 km | 4 101 565 (réel 14 998 294) | 29 (1,00) | 16 (1,00) | **30 (1,00)** | 14 (1,00) | 30 (1,00) |

**APRÈS**

| altitude | focus (m) | à −100 % (0,1–0,2 f) | à −20 % | au focus | à +20 % | à +100 % |
|---|---|---|---|---|---|---|
| 5 km | 11 039 | 29 (1,00) | 12 (0,75) | 1 (0,00) | 12 (0,75) | 17 (1,00)* |
| 130 km | 257 838 | 29 (1,00) | 12 (0,75) | 1 (0,00) | 12 (0,75) | 30 (1,00) |
| 2 000 km | 3 997 294 | 29 (1,00) | 12 (0,75) | 1 (0,00) | 12 (0,75) | 30 (1,00) |
| 15 000 km | 14 998 107 | 29 (1,00) | 12 (0,75) | 1 (0,00) | 12 (0,75) | 30 (1,00) |

\* la limite de l'instrument (§4), CoC identique.

À `bokehScale = 3,7` (le dépôt), après : **4 · 3 · 1 · 3 · 4 px** aux quatre
altitudes (CoC 1,00 · 0,75 · 0 · 0,75 · 1,00) ; avant : 4 · 2 · 1 · 2 · 4 à 5 km,
**4 · 4 · 4 · 4 · 4** partout ailleurs.

Mise au point après, convergée : 1,0012 (5 km), 0,9987 (130 km), 0,9979
(2 000 km), 0,9944 (orbite — le point visé est près du limbe, où une différence
radiale minime entre la sphère marchée et les tuiles dessinées s'étire le long
du rayon ; 0,6 % de f, soit un CoC de 0,02 avec k = 0,3, invisible).

## 6. Le repli au centre, et son temps de glissement

Quand le pointeur quitte la toile (`e.target !== canvas`, `pointerout` sans
`relatedTarget`, `blur`), la **visée** (NDC) glisse vers le centre avec τ =
250 ms, puis la distance suit avec τ = 125 ms (`dt × 8`, inchangé). Mesuré :
pointeur à (80 %, 60 %) sur la toile, puis déplacé sur le panneau « Mes
créations » ; distance écrite relevée à chaque image jusqu'à la valeur du centre
(`traces-R34/flou-apres.json`, `repli`) :

| altitude | départ (u) → arrivée (u) = centre | 63 % | 90 % | 95 % | cadence |
|---|---|---|---|---|---|
| 130 km | 4,220 → 4,047 = 4,047 | 204 ms | 299 ms | 348 ms | 57 Hz |
| 2 000 km | 67,15 → 62,74 = 62,74 | 235 ms | 469 ms | 553 ms | 56 Hz |
| 15 000 km | 286,0 → 235,4 = 235,4 | 216 ms | 419 ms | 517 ms | 48 Hz |

(À 5 km le point choisi et le centre ne différaient que de 2 % en distance : le
seuil est franchi dans le bruit, la ligne ne dit rien.) Le ciel sous le pointeur
(rayon qui manque la Terre) vise aussi le centre ; si le centre manque, la
dernière valeur est gardée.

Coût de la marche (JavaScript pur, pendule autour de 500 appels sur 100 visées
différentes) : **0,08 ms** (5 km), 0,09 (130 km), 0,17 (2 000 km), 0,21 (orbite,
28 % de rayons vers le ciel) par marche ; mémoïsée tant que ni la visée ni la
caméra n'ont bougé. Avant l'optimisation (liste des tuiles refaite à chaque
lecture du relief) : 0,32 à 0,64 ms.

## 7. Le coût de la passe hors crop, trois machines émulées

`EXT_disjoint_timer_query_webgl2`, `disjoint` faux sur tous les relevés. Deux
mesures : la **passe seule** (une requête posée autour de `dofPass.render`, 60
images, médiane) et la **différence d'image** (7 paires de blocs de 30 images
alternés avec/sans, médiane des différences ; CPU = pendule autour de
`composer.render`). Palier machine 0 partout ; sous CPU ×4 et ×6 le gouverneur
de rendu ramène le tampon à 1 088 × 680 (ratio 0,85) — c'est le comportement
réel du produit sur machine lente, et il est publié tel quel.

| machine | tampon | passe seule (GPU) | différence d'image GPU / CPU, 2 000 km | idem, orbite |
|---|---|---|---|---|
| native (×1, dpr 1) | 1 280 × 800 | 0,376 – 0,381 ms | +0,40 / +0,51 ms | +0,50 / +0,66 ms |
| CPU ×4, dpr 2 | 1 088 × 680 | 0,36 – 0,65 ms (min 0,36) | +3,4 / +3,5 ms | +5,2 / +5,9 ms |
| CPU ×6, dpr 2 | 1 088 × 680 | 0,36 – 0,66 ms (min 0,35) | +2,6 / +12,9 ms | +7,0 / +4,4 ms |

Lecture : le GPU de la passe vaut **≈ 0,37 ms** et ne dépend guère de la
résolution (ses tampons internes sont plafonnés à 720 px de haut). Sur machine
lente, ce qui coûte est la **soumission CPU des sept sous-passes** (3 à 6 ms à
×4/×6, bruité : la minuterie GPU y mesure aussi les creux d'attente du CPU) —
c'est le chiffre que PF3 doit peser pour décider de l'activation, et il est là.
Avant/après ne diffèrent pas (0,377/0,381 → 0,376/0,378 ms) : ce chantier n'a
pas touché à la passe elle-même.

## 8. Ce qui a changé

- `src/main.js` : `params.focusDistance` en mètres, `params.focusRatio` (k)
  remplace `focusRange` ; `poserMiseAuPoint(distanceM, ratio)` avec
  `metresParUniteEffets`, `blocVersMetres`, resynchronisation `near`/`far` ;
  `distanceSousLaVisee` (globe + relief dessiné sous la fusion, bloc sinon),
  `rayonAffiche`, mémoïsation sur la pose ; tick sans garde de mode, visée
  glissante, `pointeurSurToile` ; brassage, affiche, applyLook sur `focusRatio` ;
  `THREE` et les fonctions de mise au point exposés dans `__exp`.
- `src/autofocus.js` : `focusRayHitGlobe` (saut analytique à la coque, marche
  proportionnelle, bissection bornée par la précision) — 7 tests.
- `src/ui/camera-panel.js` : curseur « Plage de netteté (× distance) ».
- `src/templates-user.js`, tests `templates-user`, `share-link` : `focusRatio`.
- `test/camera-continue.test.js` : le test qui verrouillait `facteurFond` et
  `worldFocusRange = porteeBloc × f` est réécrit sur la nouvelle chaîne, et un
  test vérifie l'absence de garde de mode, le glissement et le rayon contre le
  globe.
- Gabarits : `public/templates` porte encore deux `focusRange` (20, 23) — ignorés
  sans effet, le k par défaut s'applique. Non réécrits : ce sont des fichiers
  livrés, à passer avec le prochain lot de gabarits.

Hors périmètre, non touché : `modes.js`, `pivot-bloc.js`, l'ordre et
l'activation des passes (`setEffectsEnabled` coupe toujours le DoF en orbite —
PF3), `palier-machine.js`.

## 9. Tests

- `npm test` : **4 675 tests, 0 échec** (base 4 667 + 7 `autofocus` + 1
  `camera-continue`).
- `npm run audit:tests` : **241 listés · 241 sur disque · aucun écart** (aucun
  fichier de test ajouté).
- Scripts d'édition en binaire, octets relus (`grep | cat -A`) : UTF-8, LF.

## 10. Commits (`flou-zoom`)

1. `R34 etape 1 — l instrument : mires injectees, profondeur relue, et le releve
   AVANT (le flou agit, near/far figes a 5 km)`
2. `R34 etape 2 — la mise au point en metres, la plage = k x distance, near/far
   resynchronises, le rayon contre la Terre affichee a tous les zooms, repli
   glissant au centre`
3. `R34 etape 3 — le rapport, le releve APRES et le cout de la passe sur trois
   machines`

## 11. Ce que j'ai cru puis réfuté

1. **Cru (le brief) : `focusDistance` est normalisé dans [0, 1] entre `near` et
   `far`.** Réfuté : postprocessing 6.36.4 compare `length(viewPosition)` à des
   longueurs de monde ; profondeur relue / d = 1,000 sur toutes les mires.
2. **Cru : l'autofocus « semble mal fonctionner » à cause du facteur 130,4.**
   Réfuté par la mesure : écrit/réel = 0,999 en surface. Le défaut était
   ailleurs — `near`/`far` figés dans le matériau (CoC 1,00 AU focus dès 130 km),
   plage figée à 5 620 m, aucun suivi en orbite (0,24), suivi sous les panneaux.
3. **Cru : la sphère étant le mode de démarrage, l'application démarre en
   `orbital`.** Réfuté : `modes.mode = 'surface'`, z12, 5,1 km ; la porte
   orbitale ne s'ouvre que vers 12 000 km. « 2 000 km » est un bloc z4 vu de
   haut, en mode surface — l'ancien autofocus y tournait, contre un bloc plat.
4. **Cru : le 0,000 de l'inventaire prouve un flou inerte.** Réfuté : 217 725
   px changent ; l'interrupteur ne change rien à l'image par construction.
5. **Cru : une mire opaque à `AlwaysDepth` s'impose au relief.** Réfuté : les
   tuiles du globe sont transparentes, dessinées après ; la mire au focus était
   coupée en diagonale par le z-fighting (capture de mise au point).
6. **Cru : le premier relevé avant/après pouvait servir tel quel.** Réfuté : le
   run de coût a écrasé `flou-avant.json` (même nom) — nommage corrigé, campagne
   rejouée entièrement.
7. **Cru : marcher le globe coûterait trop (0,3–0,6 ms mesurés d'abord).**
   Réfuté après lecture de `hauteurDessinee` : la liste des tuiles était refaite
   à chaque lecture ; passée une fois par marche, 0,08–0,2 ms, puis mémoïsée.
8. **Cru : le repli mesuré à 90 ms à 5 km était un glissement rapide.** Réfuté :
   le point de départ et le centre y ont la même distance à 2 % près, le seuil
   est franchi dans le bruit ; les trois autres altitudes donnent 204–235 ms à
   63 %.
