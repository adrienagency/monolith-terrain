# R35 — LES DEUX RESTES DE CAMÉRA : LE NaN N'ÉTAIT PAS DANS `modes.js`, ET LE CLIC EST DEVENU UN GLISSÉ

Arbre `C:\Dev\wt-cam2`, branche `camera-restes`. Serveur `npm run dev --port 5871
--host 127.0.0.1` (⚠️ Vite n'écoute que sur `[::1]` sans `--host` : la sonde
sur `127.0.0.1` ne dessinait jamais — premier quart d'heure perdu là). Instrument :
`scripts/sonde-r35.mjs` — Chrome sans tête 1280 × 800, CDP brut, relevé **au
rendu** (`composer.render` enveloppé) sur **la caméra qui rend** (`camGlobe`
hors orbite) : distance au centre de la Terre, centre de la Terre projeté en
px, `ln d` (distance caméra → cible), mode, `busy`, zoom, détection de NaN.
Voile fermé **après** le vol de présentation (`d = 145,50` atteint, 8,3 s) et
vérifié (`elementFromPoint(640, 400)` = `CANVAS`). Journaux `.banc/R35/`
(ignoré par git) : `flyto-{modes,modes-anim0,exp}-avant.json`,
`flyto-exp-apres.json`, `clic-avant.json`, `clic-apres-{1,2}.json` (deux
passes intermédiaires, chacune a réfuté quelque chose), `clic-apres.json`.
`npm test` **4 744 · 4 742 verts · 0 échec** (base 4 732 ; +12) ·
`npm run audit:tests` **251 = 251**.

---

## ① `flyTo` → NaN : le premier NaN est `main.js:2209`, pas `modes.js`

**Reproduction** (`--scenario flyto`, pose de démarrage : surface, crop, z12,
18 498 m, `d = 145,50`) — trois appels, tous depuis la surface :

| appel | animations | NaN au rendu | arrivée |
|---|---|---|---|
| `modes.flyTo(-21.115, 55.536, 9)` | oui | **aucun** | surface z9, 5 286 m, La Réunion |
| `modes.flyTo(-21.115, 55.536, 9)` | `false` (la condition de PF3) | **aucun** | idem |
| **`__exp.flyTo(-21.115, 55.536, 9)`** (l'appel écrit dans `rapport-PF3.md`) | oui | **image 2905 : `camera.position` = [NaN, NaN, NaN], `camGlobe` NaN, `modes.altM` NaN** | jamais — la caméra ne revient pas |

**La ligne.** `__exp.flyTo` n'est pas `modes.flyTo` : c'est `flyTo(pos, target,
opts)` de `main.js:2203`, qui prend deux **`Vector3`**. Appelé avec des nombres,
**`tween.p1.copy(pos)` (`main.js:2209`)** exécute `Vector3.copy(-21.115)` →
`this.x = (-21.115).x` = `undefined`. Puis `tween.t1.copy(55.536)` de même. À
l'image suivante `camera.position.lerpVectors(tween.p0, tween.p1, e)`
(`main.js:13387`) écrit NaN ; `modes.altM`, l'altimètre, la similitude, tout ce
qui lit la caméra suit, sans exception ni message, et **rien ne remet jamais une
valeur finie** (le tween finit à `t = 1` sur NaN).

**Cause** : deux `flyTo` homonymes de signatures différentes, et une pose
acceptée sans être vérifiée. Ni `acos`, ni division, ni pose sans emprise :
`modes.flyTo` est fini dans les trois cas relevés, avec un traceur posé sur
chacun de ses écrivains (`enterOrbit`, `_updateTravel`, `_dive`, `_posePlongee`,
`_attendreLeBloc`, `_suivreEmprise`, `_rescale`, `_applyZoom`).

**Correctif, à la source** (`src/camera-poses.js`, `src/main.js`) :
`exigerPose(v, nom)` — une pose est un `{x, y, z}` **fini**, sinon `TypeError`
nommant l'appel juste :

```
TypeError: flyTo(pos) : une pose {x, y, z} finie est attendue, reçu le nombre
-21.115 — pour un lat/lon, appeler modes.flyTo(lat, lon, zoom)
```

`flyTo` la lève **avant** la première écriture du tween. Rejoué
(`flyto-exp-apres.json`) : l'exception part de `main.js:2213`, la caméra reste
à [88,49 · 72,72 · 88,49], aucun NaN au rendu. Pas d'`isFinite` en aval.
Tests `test/camera-poses.test.js` R35 ① – ③ (le nombre, `undefined`, la
composante NaN, le `z` manquant ; la vraie pose passe inchangée ; les deux
gardes dans `main.js` avant `tween.p0.copy`) — ① et ③ échouent sans le
correctif.

---

## ② Le clic sur le globe : un glissé d'un niveau, en orbite comme en surface

### Ce qui sautait (`clic-avant.json`, huit clics au centre depuis 60 000 km)

Le brief avait raison à la ligne. Clic 1 : `plongeDepuisGlobe` → `_dive` à
niveau **imposé** z4 → `_posePlongee` borne `distancePourAltitudeFond` à
`surfaceMaxDistance()` = 150 u, et 150 u sur un bloc z4 valent 13 600 km :
**×4,41 d'altitude en une image**. Clics suivants : `diveTo` lisse 30 % puis
`_loadDive` **pose** `distancePresentation` (145,5 u) sur un bloc deux fois
plus petit : **×1,42 en une image** à chaque clic.

### Le choix — D16 et D19 tranchent

D16 : *« on ne vise pas, on se rapproche »* ; D19 : Google Earth zoome vers le
point cliqué, **progressivement**. Le clic ne pose donc plus rien :

- **En orbite** (`plongeDepuisGlobe`, sous le drapeau) : un `travel` de la même
  famille que `flyTo`, marqué `clic`, sans croisière — la direction tourne vers
  le lieu cliqué (le point vient sous la caméra, la caméra vise toujours le
  centre : **la Terre reste plantée**), l'altitude descend d'**un niveau**
  (`FACTEUR_CLIC = exp(−PAS_NIVEAU)` = ½) en géométrique sur 0,9 s. À
  l'arrivée, **la porte géométrique est armée, pas forcée** (`_diveArmed`) :
  `_niveauDArrivee` traverse quand un bloc tient l'altitude, en la conservant
  (la traversée de la Tâche M / D16 — le clic 4 ci-dessous la montre : 7 500 →
  3 745 km puis surface z4 à 3 745 km, ×1,014 au pire).
- **En surface** (`diveTo`, sous le drapeau) : un seul temps de 0,9 s — la cible
  glisse **rigidement** vers le point cliqué (caméra + cible, même vecteur, `y`
  inchangé : l'orbite de R32, altitude constante) pendant que la distance à la
  cible descend d'un niveau en géométrique, le long de **l'axe de vue courant**
  (D16 ter : aucune bascule au clic). Le compteur de niveau (`_levelZoom`) porte
  l'intention image par image, et `_franchirSiBesoin` à l'arrivée recharge le
  niveau fin par `_rescale` → `_suivreEmprise` (la continuité mesurée par R32).
  `_loadDive` ne sert plus qu'au régime hérité.
- **Régime hérité** (`?terre=deux`) : la plongée à palier et le « lean » 30 %
  + `_loadDive`, au bit près (tests ① ter, ② ter).

### La table des huit clics — avant / après

Rapport d'**altitude** de la caméra qui rend, image à image (c'est ce que l'œil
voit ; le rapport de **distance au centre** est plus doux, il est donné aussi) ;
centre de la Terre à l'écran en px (écran de 1280 × 800, centre = 0).

| clic | avant : trajet | avant : pire rapport alt / dist | après : trajet | **après : pire rapport alt / dist** | centre Terre (px) |
|---|---|---|---|---|---|
| 1 | orbite 60 000 km → **surface 13 607 km z4** | **4,407** / 3,321 | orbite 60 000 → 30 000 km | **1,023** / 1,021 | 0 → 0 |
| 2 | → surface 9 358 km z5 | 1,032 / 1,019 | → 15 000 km | **1,013** / 1,009 | 0 → 0 |
| 3 | → 4 680 km z6 | **1,407** / 1,174 | → 7 500 km | **1,013** / 1,008 | 0 → 0 |
| 4 | → 2 340 km z7 | **1,420** / 1,113 | → **surface 3 745 km z4** (traversée) | **1,014** / 1,007 | 0 → 0 |
| 5 | → 1 170 km z8 | **1,427** / 1,066 | → 1 855 km z5 | **1,009** / 1,003 | 0 → 0 |
| 6 | → 586 km z9 | **1,423** / 1,036 | → 919 km z6 | **1,012** / 1,002 | 0 → 0 |
| 7 | → 293 km z10 | **1,424** / 1,019 | → 455 km z7 | **1,019** / 1,002 | 0 → 0 |
| 8 | → 147 km z11 | **1,424** / 1,010 | → 226 km z8 | **1,010** / 1,001 | 0 → 0 |

**Critère « aucun rapport > 1,5 » : tenu, et de loin — pire 1,023.** Séparé
geste / repos (rapport d'altitude sur les images de glissé, puis sur les
images sans glissé ni vol) : avant **4,41 · 1,03 · 1,41 · 1,42 · 1,43 · 1,42 ·
1,42 · 1,42 au repos** (les sauts tombaient APRÈS le tween) ; après **1,000 ·
1,000 · 1,000 · 1,001 · 1,002 · 1,002 · 1,001 · 1,000 au repos**, et 1,009 à
1,023 pendant le glissé — c'est `2^(Δe)` à la cadence du Chrome sans tête.
**Terre plantée : 0 px sur les 8 clics, avant comme après** (le centre est le
pivot dans les deux cas ; c'est l'altitude qui sautait, pas l'axe). D16 ter :
la vue reste au nadir jusqu'au bloc (`_attendreLeBloc` inchangé, pente
conservée au clic — test ②).

**`|Δ ln d|`** (distance caméra → cible, en unités de bloc) : hors geste, hors
chargement et à niveau constant, **0 à 1,6·10⁻⁸** sur les clics 1, 2, 3, 7, 8 ;
**0,65 à 0,68 à chaque REFINING** et 1,4·10⁻² / 3,1·10⁻² après les clics 5 et 6.
⚠️ **Ce ne sont pas des sauts d'écran, ce sont les conversions d'unités** de
`_suivreEmprise` (l'emprise du bloc est divisée par deux : `ln 2 = 0,69`) et
l'arrivée tardive du MNT derrière la fenêtre (3,5 % à z5, documenté dans
`_suivreEmprise`) ; l'altitude de fond, elle, bouge de 1,002 au pire au repos.
Le brief mesure `|Δ ln d|` là où `veille-repos` le lit ; sur ce chemin, la
grandeur qui compte est le rapport d'altitude de la colonne « après ».

### Les trois correctifs de plus, trouvés par le banc — pas par la relecture

1. **Le compteur est POSÉ, pas accumulé** (`_avancerGlisseClic`). Première passe
   (`clic-apres-1.json`) : clics 5 et 7 **sans REFINING**, le niveau ne suivait
   pas, et au clic 8 la caméra butait au plancher (444 → 355 km). La somme des
   pas `ln ½ · (eᵢ − eᵢ₋₁)` télescope à `−ln 2` à un epsilon près, et
   `franchissement` **tronque** `budget / pas` : `−0,99999…` → 0 niveau, un
   clic sur deux. Le compteur vaut maintenant `compteur0 − PAS_NIVEAU · e`,
   exactement `−ln 2` à `e = 1` ; un reste de molette est conservé (test
   ② quinquies) — l'élan de la molette, lui, s'éteint (le glissé tient la
   caméra), et `_resetZoom()` reste au régime hérité.
2. **Le clic n'est plus jeté pendant le vol du MNT** (`main.js`, gestionnaire
   `pointerup`). Deuxième passe (`clic-apres-2.json`) : clic 8 **inerte** — aucun
   glissé armé, `dem` nul (`entrerEnVol` l'annule à chaque franchissement, le
   MNT arrive 13 images plus tard), fenêtre bornée pourtant posée. C'est la
   garde `!dem` seule, la classe de défaut que R32 avait corrigée sur
   `getRefineTarget` ; avant R35 elle était masquée parce que `_loadDive`
   attendait `loadSurface`. Même garde (`!dem && !terrain.fenetreBornee`) et
   même conversion (`latLonDuBloc`) que `viseeAuSol` (test ③). La sonde attend
   aussi `tuilesEnVol() === 0` avant chaque clic — on mesure le geste, pas la
   course.
3. **`--host 127.0.0.1`** pour Vite, sinon la sonde ne dessine jamais (voir en
   tête).

### Tests — `test/clic-glisse.test.js` (10, dans `package.json`)

① orbite : glissé géométrique, pire rapport < 1,05, altitude ÷2, lieu cliqué
sous la caméra, porte armée à l'arrivée, `controls` rendus · ① bis : axe optique
sur le centre de la Terre pendant tout le glissé (< 10⁻⁶ rad) · ① ter : régime
hérité au bit près · ① quater : sous la porte, la traversée part d'elle-même
vers le lieu cliqué, niveau de `_niveauDArrivee` (z4), pas de `DIVE_TIERS` ·
② surface : |Δ ln d| < 0,03 par image, `d₁ = d₀ / 2`, cible translatée en
`xz`, `y` gardé, pente gardée, un franchissement, rien posé · ② bis : au zoom
fin le compteur compte le réel, pas l'intention · ② ter : régime hérité (lean
0,42 s + `_loadDive`) · ② quater : refus pendant chargement / vol / glissé /
hors surface · ② quinquies : compteur à mi-glissé, reste de molette conservé ·
③ la garde du clic dans `main.js`. **① et ② échouent sans le correctif** (avant :
`plongeDepuisGlobe` charge z4 tout de suite, `diveTo` pose `_loadDive`).

---

## Commits

Voir `git log camera-restes` : ① le NaN (`camera-poses.js`, `main.js`, test) ;
② le glissé de clic (`modes.js`, `main.js`, test, `package.json`) ; ③ la sonde
et ce rapport.

## Cru, puis réfuté

1. **« Le NaN est dans `modes.js` »** (le brief, et moi en le lisant) —
   réfuté par trois reproductions : `modes.flyTo` est fini avec et sans
   animations ; le NaN naît de `Vector3.copy(nombre)` dans le `flyTo` de
   `main.js`, appelé par PF3 avec la signature de l'autre.
2. **« Mon traceur a attrapé `_updateTravel` »** — faux positif : mon premier
   détecteur cherchait `null` dans le JSON de l'état, et `travel: null` en
   contient un. Le traceur réécrit (NaN → `"NaN"` par un remplaceur) n'attrape
   plus rien sur `modes.flyTo`.
3. **« ×4,41 est un rapport de distance »** — PF4 mesurait l'altitude ; sur la
   distance au centre, le même saut vaut ×3,32. Les deux sont dans la table.
4. **« Accumuler l'intention image par image revient au même que la poser »** —
   réfuté au navigateur : la troncature de `franchissement` rate un clic sur
   deux à un epsilon près (`clic-apres-1.json`).
5. **« Le clic 8 inerte est un défaut du glissé »** — réfuté : c'est la garde
   `!dem` du gestionnaire de clic pendant le vol du MNT, préexistante, masquée
   jusqu'ici par l'attente de `_loadDive` (`clic-apres-2.json`).
6. **« `|Δ ln d|` = 0,65 au REFINING est un saut »** — c'est la conversion
   d'unités de `_suivreEmprise` (ln 2) ; l'altitude de fond bouge de 1,002 au
   repos. La grandeur d'écran est le rapport d'altitude, et il tient.

## Réserves

- Le clic est un **simple** clic (le déclencheur de `main.js`, inchangé) ; Google
  Earth zoome au **double**-clic. D19 dit « décrire avant de coder » : la
  décision du déclencheur est à Adrien — le geste, lui, est celui de Google
  Earth (vers le point, progressivement, un niveau).
- Sur le crop, la Terre n'est pas « plantée » au sens du centre à l'écran (vue
  de trois quarts, hors cadre) ; les huit clics du banc restent hors crop
  (226 km à z8). Un clic sur le crop garde l'axe de vue et le pivot R13.
- Le clic en orbite depuis 60 000 km demande trois clics avant la traversée
  (porte géométrique à ~9 000 km) ; c'est la loi « un niveau par clic ».
