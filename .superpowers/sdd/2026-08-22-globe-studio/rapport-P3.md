# Tâche P3 — L'ÉCLAIRAGE DU BLOC, ET LA COUCHE QUE PERSONNE N'AVAIT VUE

**Statut : LIVRÉE.** · Commit **`0700848`** sur `regroupement` (arbre propre après commit).
`npm test` — **3 905 / 3 905** (3 872 au départ, **+33**) · `npm run audit:tests` — **208 / 208** ·
campagne de mutation — **36 / 36**, dont **24 visant le branchement**.

> **L'agent noteur, 2026-08-22 :** *« Le socle est un matériau ÉCLAIRÉ. La tuile du globe
> est une COULEUR NUE. »* — manque n° 1, et *« la couleur des parois »* — manque n° 2.

**Les deux sont portés.** Et en les mesurant j'en ai trouvé un troisième, plus lourd que
`mapTint`, que ce chantier n'avait jamais nommé.

---

## 0. ⛔ CE QUE J'AI VU À L'ÉCRAN, CÔTE À CÔTE AVEC LE SOCLE

**Toutes dans `.banc/vues-P3/`. Cadre 1 280 × 800, La Réunion z12, vue isométrique 0,
`fov = 33`, socle RALLUMÉ DANS LA MÊME PAGE (le protocole du noteur), rendu sans
compositeur dans une cible demi-flottante, cadrages APPARIÉS (§1).**

- **`P3-SURFACE-CROP-nu-P2.png` → `P3-SURFACE-CROP-eclaire.png` → `P3-SURFACE-SOCLE-apparie.png`** —
  **c'est le triptyque à regarder.** AVANT : une île pâle et plate, plus saturée que le socle,
  sans modelé ; le relief ne se lit que par le peigné de P2. APRÈS : **les mêmes ocres, les
  mêmes rouges de rempart, la même couronne blanc cassé que le socle**, et le versant à
  l'ombre du soleil s'assombrit — ce qu'aucune image d'avant ne faisait.
- **`P3-BLOC-ENTIER-eclaire.png`** — le bloc entier, parois comprises : **la tranche est
  terracotta**, comme celle du socle, au lieu du gris-bleu `#d8d4cc` codé en dur.
- **`P3-MOTIF-SOCLE.png` / `P3-MOTIF-CROP.png`** — la couche Apparence isolée sur les deux
  côtés (`uFxBlend = 0`, opacité 1) : **mêmes points, même phase, même pas**. C'est la preuve
  que le motif est calé au même endroit du SOL, et c'est aussi elle qui m'a fait trouver
  l'erreur d'ordre du §4.

### ⛔ ET NON, ÇA NE RESSEMBLE TOUJOURS PAS AU SOCLE

Ce qui sépare encore les deux images, et **aucun de ces points n'est de ma tâche** :

1. **LA MER.** Sur `P3-BLOC-ENTIER-eclaire.png`, la nappe est constellée de **plaques
   blanches à bords durs**, et elle ne rejoint pas le dessus du bloc : deux niveaux, un
   porte-à-faux, des jupes bleues qui pendent. C'est ce qui saute aux yeux maintenant.
   *Manques n° 3 et 4 du noteur, autres tâches.*
2. **LES JUPES DE TUILES** pendent toujours sous le bloc, et **il n'y a toujours aucune
   ombre portée** : rien ne pose le bloc sur quoi que ce soit. *Manque n° 5.*
3. **LE MODELÉ DU RELIEF EST PLUS DOUX QUE CELUI DU SOCLE**, et c'est GÉOMÉTRIQUE, pas
   colorimétrique : les tuiles du globe portent **24 segments de côté** (`gridFor`, z ≥ 6)
   là où le bloc porte **594 434 sommets**. Le soleil éclaire donc une surface plus lisse.
   ⚠️ **Je ne l'ai pas chiffré** — il faudrait mesurer la distribution des normales des
   deux côtés, et je préfère le nommer que d'en donner un chiffre inventé.
4. **Les parois ont la bonne COULEUR, pas la bonne MATIÈRE** : celle du socle est un
   `MeshPhysicalMaterial` avec sa carte de rugosité et son relief ; celle du crop est un
   `ShaderMaterial` à occlusion de contact. Le chanfrein manque toujours.

---

## 1. LE PIÈGE DE CADRAGE — APPARIÉ, ET LE SENS EST L'INVERSE DE CELUI DU NOTEUR

⛔ **À caméra rigoureusement identique, chez moi, c'est le CROP qui est le plus GRAND** :
251 596 px contre **184 232** au socle, soit **×1,366 en aire** — presque exactement le
facteur du noteur, **mais dans l'autre sens** (il avait crop 216 061 contre socle 294 304).
Le `k` est donc **inférieur à 1**, là où le sien valait 1,1588. **Le facteur de cadrage n'est
pas une constante du chantier : il dépend de la caméra du moment, et il se re-balaie.**

Le balayage se fait sur un **CLONE** de la caméra, que l'application ne voit jamais — sa
mise en garde, reprise telle quelle. Deux mesures du même `k` rendent **223 634 et 223 634**,
identiques au pixel.

| cadrage | crop | socle | `k` | **écart** |
|---|---|---|---|---|
| **surface seule** (les deux nuanceurs de terrain, rien d'autre) | 223 634 px | **223 526 px** | 0,912 | **−0,048 %** |
| **bloc entier** (crop : tuiles + mer + parois) | 253 211 px | 251 980 px | 0,865 | −0,486 % |

➡️ **Appariés à 0,048 %**, soit **21 fois** mieux que le 1 % demandé.

⛔ **ET LES DEUX MASQUES DOIVENT PORTER LA MÊME CHOSE — MA PREMIÈRE SÉRIE NE LE FAISAIT PAS.**
Côté socle je cache tout sauf `terrain.mesh` ; côté crop, cacher `globe.group` emportait
**les PAROIS (terracotta vif) et la NAPPE DE MER**. Le masque comptait donc des pixels que
l'autre côté n'avait pas, et le premier écart d'albédo que j'ai mesuré (**×2,7**) était en
partie de la maçonnerie. **Toutes les mesures de teinte du §5 sont sur la paire
« surface seule ».**

---

## 2. ⛔ LE PREMIER DIAGNOSTIC N'ÉTAIT PAS LE BON, ET LA MESURE L'A DIT

Le brief annonçait : *« la difficulté n'est pas le GLSL, c'est l'ACCORD D'EXPOSITION »*.
**C'était exact, et ce n'est pas là où je l'attendais.**

### 2.1 ⚡ Le soleil du globe N'EST PAS le soleil de la scène — il suit la CAMÉRA

`main.js`, boucle d'image, mode surface :

```js
_orbSun.copy(camGlobe.position).normalize().applyAxisAngle(_upY, -0.73)
globe.setSunDir(_orbSun)
```

**Le soleil du globe est reposé à chaque image sur la position de la caméra, tournée de 42°**,
pour qu'aucune face visible de la planète ne soit dans la nuit. C'est un bon choix — **pour
une planète**. Pour un bloc, c'est le contraire de ce qu'il faut.

**Relevé le 2026-08-22, La Réunion, drapeau levé :** `uSunDir = (0,2282 · −0,3679 · 0,9014)`
pendant que le soleil de la scène pointait `(0,4392 · 0,5631 · −0,7002)`. **Deux directions
sans rapport, dont une seule est le soleil.** L'ombrage du bloc ne dépendait donc pas de
l'heure, mais de l'endroit d'où on regarde.

Et son amplitude — `col *= 0.74 + 0.30 * diff` — est un rapport de **1,4 : 1**, là où un
Lambert va de 0 à 1.

⚠️ **P2 écrivait « les tuiles du globe ne portent que `vNormalW`, la normale de la SPHÈRE ».
C'est faux, et c'est heureux** : `_buildMesh` calcule des **normales analytiques par
différences centrées sur la surface DÉPLACÉE**, avec la fenêtre corrigée au bord de tuile.
La normale du relief existait ; c'est le soleil qui n'était pas le bon.

### 2.2 ⚡ L'AMBIANTE PÈSE PRESQUE LA MOITIÉ, ET PERSONNE NE L'AVAIT COMPTÉE

Le noteur a mesuré la part de l'hémisphère et celle du soleil. **Il manque un troisième
terme, et c'est le plus gros : `scene.environment`.**

**Protocole**, socle rallumé dans la même page, rendu **sans compositeur** dans une cible
**demi-flottante** (donc en linéaire, sans écrêtage) :

- éclairé par un **hémisphère BLANC d'irradiance 1 et rien d'autre**, le pixel vaut
  exactement `albédo / π` — l'irradiance d'un hémisphère blanc ne dépend pas de la normale,
  `mix(1, 1, w)` vaut 1 ;
- éclairé par le **SEUL environnement**, à son intensité vivante, **moins le spéculaire
  mesuré à part** (albédo forcé à noir : **0,0089 sur 0,2237**, soit 4,0 %) ;
- le rapport des deux, **par pixel, sur 133 786 pixels** :

> **E_env = (2,0155 · 2,0153 · 2,0152)**, écart-type **0,3575** (17,7 %).

À comparer, sur le même relief : soleil ≈ (2,09 · 1,95 · 1,65), hémisphère ≈ (0,16 · 0,33 ·
0,51). ➡️ **L'environnement fait 47 % de l'irradiance totale, et il est RIGOUREUSEMENT
NEUTRE.** C'est lui, la source des « neutres » que le noteur trouve 5,7 fois trop rares.

⛔ **ET UNE CONSTANTE AURAIT ÉTÉ FAUSSE DE 570 % DÈS LE PREMIER ESSAI.** Ma première
version multipliait le coefficient par `material.envMapIntensity` (0,15 sur le relief). Or
`three` (`WebGLRenderer.js`, r172) **ÉCRASE cet uniforme** quand le matériau n'a pas
d'`envMap` à lui et que la scène en a une :

```js
if ( material.isMeshStandardMaterial && material.envMap === null && scene.environment !== null )
    m_uniforms.envMapIntensity.value = scene.environmentIntensity;
```

Relevé : `terrain.material.envMap === null`. ➡️ **`params.envMapIntensity` est du CODE MORT
sur le relief.** Le facteur 6,7 que ça donnait a été attrapé par la mesure du socle, **pas
par la lecture du code**.

### 2.3 ⛔ ET LE PLUS GROS : LA COUCHE « APPARENCE » DU GABARIT D'OUVERTURE

`public/templates/defaults/shibustart.json` pose **`look.surfaceFx = 9`**. Relevé dans
l'application vivante : `uSurfaceFx = 9`, `uFxOpacity = 0,44`, `uFxBlend = 2` (Multiply),
`uFxColA = #14161d`.

**Ce que ça pèse, mesuré** : socle rendu avec un **albédo forcé à BLANC** (`material.color`
= 1, `vertexColors` coupé, `uTint = 0`) sous un hémisphère blanc d'irradiance 1 — le pixel
devrait donc valoir exactement `1 / π` :

| | R | G | B |
|---|---|---|---|
| couche Apparence **allumée** | **0,591** | 0,575 | 0,571 |
| couche Apparence **éteinte** | **0,997** | 0,997 | 0,997 |

➡️ **Elle multiplie l'albédo du socle par 0,59 et le teinte.** Aucune tâche de ce chantier
ne l'avait nommée. Un portage de l'éclairage qui l'aurait ignorée rendait un crop **1,7 fois
trop clair** — et **c'est exactement ce que ma première version a mis à l'écran**, avant
que la mesure ne le dise.

⚠️ **Ce n'est pas une option exotique** : `params.surfaceFx` vaut 0 par défaut dans le code,
mais le **gabarit d'ouverture** — celui que voit tout visiteur — l'allume.

### 2.4 La loi d'albédo est vérifiée dans l'application, pas déduite

`terrain.js:1146` : `diffuseColor.rgb = mix(diffuseColor.rgb, mapCol * paintShade, effTint)`.
Trois rendus du socle au même instant, `uTint` posé à 0, à 1, puis à sa valeur vivante
(0,68) : `mix(albédo₀, albédo₁, 0,68)` reproduit l'albédo vivant à **7,5 × 10⁻⁵** de moyenne
sur **182 997 pixels**.

⛔ **P2 avait LAISSÉ `mapTint` en écrivant « il n'y a rien contre quoi doser ». C'était vrai,
et ça ne l'est plus** : dès qu'il y a une lumière, la couleur de rampe DEVIENT un albédo.

---

## 3. CE QUI A ÉTÉ FAIT — TROIS EXTRACTIONS, AUCUNE COPIE

**D13 §③ : ① adapter · ② extraire en module pur partagé · ③ copier en dernier recours.**
Rien n'a été copié.

| module | ce qu'il porte | qui l'injecte |
|---|---|---|
| `src/monde/eclairage-crop.js` | la loi de **three** (`BRDF_Lambert`, `getHemisphereLightIrradiance`) + la **valeur par sommet** et **`fxShade`** de `terrain.js`, en JS **et** en GLSL | `terrain.js` (`GLSL_OMBRE_PEINTURE` + `natGris` appelé) et `globe.js` (tout) |
| `src/monde/melange-crop.js` | `blLum`/`blClip`/`blSetLum`/`blSat`/`blSetSat`/`blHard`/`fxBlend` | `terrain.js` **et** `globe.js` |
| `src/fx-glsl.js` (existait) | `surfaceFx` | `terrain.js`, `fx-thumbs.js`, **et maintenant `globe.js`** |
| `src/sonde-ambiante.js` | la **mesure** de l'irradiance de `scene.environment` | `main.js` |

⚡ **`GLSL_MELANGE` ferme une dette qui n'était pas la mienne** : `blLum`/`blClip`/`blSetLum`
étaient écrits **deux fois** — dans `terrain.js` et dans `globe.js` —, chacun avec un
commentaire annonçant que deux écritures finiraient par diverger. Le crop devait porter la
couche Apparence, et cette couche EST un mode de mélange : c'était l'occasion de fermer la
dette au lieu d'en créer une troisième.

### La sonde d'ambiante — une MESURE, pas une constante

Une **sphère** d'albédo 1, rugosité 1, regardée de côté par une caméra **orthographique** :
pour une sphère unité vue ainsi, la normale du point qui tombe en `(sx, sy)` de l'écran vaut
`(sx, sy, √(1 − sx² − sy²))`, donc **`N·haut` EST la coordonnée écran `sy`**. On régresse
l'irradiance sur `sy` et on rend **deux irradiances, zénith et nadir**, que l'appelant
**ajoute aux deux couleurs de la lampe hémisphérique** : `mix(sol, ciel, 0,5·ndu + 0,5)` est
déjà la loi de three pour une `HemisphereLight`, et c'est l'approximation du premier ordre
d'un environnement — l'écart-type mesuré de 17,7 % dit qu'une moyenne unique aurait jeté
cette variation. Le spéculaire est retiré **par soustraction** (second rendu, albédo noir).

Relevé sur `RoomEnvironment` : **zénith 2,636 · nadir 0,412**, parfaitement neutres,
à `environmentIntensity = 0,3945`. Cache par texture, résultat **gelé** pour que
`Object.is` le voie stable.

### Le fil, maillon par maillon

`contexteCrop` (`main.js`) → **vingt-sept champs de plus**, tous **scalaires ou chaînes**
(un objet reconstruit à chaque image différerait toujours de lui-même et reposerait
l'habillage soixante fois par seconde). **On lit les LAMPES et le MATÉRIAU, jamais
`params`** :

- `sun.intensity` et non `params.sunIntensity` — `placeSun` porte deux règles que `params`
  ne porte pas : l'atténuation d'un soleil rasant et l'interrupteur `sunOn`, qui met
  l'intensité à zéro **sans retirer la lampe**. Par `params`, le bloc serait resté éclairé
  la nuit, soleil coupé ;
- `plinth.wallMat.color` et non `params.plinthColor` — **c'est le manque n° 2 du noteur**,
  et `setColors` ne retient `params.plinthColor` que si le socle n'est ni en verre ni sur un
  préréglage PBR ;
- l'azimut et l'élévation, eux, viennent de `params` : `applyTimeOfDay` en est le **seul**
  écrivain, et `sun.position` porte en plus le rayon 34.

⚠️ **`fxTime` N'EST PAS dans `CHAMPS_HABILLAGE`, et c'est une obligation** : il avance à
chaque image. Il passe par `globe.poserTempsApparence(terrain.mapUniforms.uFxTime.value)` —
**on recopie l'horloge du socle** plutôt que d'en avancer une seconde, qui se déphaserait.

### Le repère — c'est le vrai branchement de cette tâche

La correspondance **se lit dans le dépôt**, elle ne se devine pas :

- socle — `latLonToWorld` : `x` croît avec la longitude (**est**), `z` croît avec la
  coordonnée de tuile `y` (**sud**) ; le nord est `−z`, le haut `+y` ;
- globe — `latLonToSphere` : `p = R (cos φ sin λ, sin φ, cos φ cos λ)`, d'où par dérivation
  `est = (cos λ, 0, −sin λ)` et `nord = (−sin φ sin λ, cos φ, −sin φ cos λ)` ;
- le soleil, `placeSun` : `(cos az cos el, sin el, sin az cos el)` — sa composante `z` est
  dirigée vers le **sud**, sa composante nord vaut `−sin az cos el`.

⛔ **Sans latitude ni longitude du centre, `poserHabillage` REFUSE d'allumer l'éclairage** —
poser le soleil du golfe de Guinée sur La Réunion serait pire que pas de soleil du tout.
(Mutation 26 : elle tombe.)

### La frontière : la SUPERELLIPSE, pas le carré

`dedansCrop` est la **couverture douce de la superellipse du crop**, celle que les parois
suivent au bit près — pas le carré `dansCrop` qui borne la texture d'analyse. Les confondre
aurait posé une arête d'éclairage droite dans les coins arrondis du bloc, là où il n'y a
déjà plus de bloc. À estompage plein rien n'est dessiné dehors : **aucune couture à voir**.

---

## 4. ⛔ CE QUE LE CADRAGE APPARIÉ A RÉVÉLÉ, ET QUI N'ÉTAIT PAS DANS LE BRIEF

**Une première version portait tout et rendait une image FAUSSE** — délavée, presque
blanche. Mise à côté du socle, la cause s'est nommée toute seule.

> ⚠️ **L'ORDRE : `terrain.js` MÉLANGE LA PEINTURE DANS `diffuseColor` AVANT l'apparence, le
> trait de côte, les courbes et le graticule.** Tous ces postes peignent donc **sur un
> ALBÉDO**. Ma première version fabriquait l'albédo **à la fin**, juste avant la lumière :
> le motif de l'apparence repassait alors dans `mix(fond, x, teinte)` et ressortait délavé.

**Chiffré, et sur des masques appariés** : l'apparence assombrit l'albédo du socle à **0,58**
et celui du crop à **0,73 seulement** — pour un motif pourtant **calé au même endroit du
sol** (`P3-MOTIF-SOCLE.png` ↔ `P3-MOTIF-CROP.png` : mêmes points, même phase). La couleur
était bonne, l'ordre était faux.

`test/crop-eclairage.test.js` ⑤e **exige l'ordre** : albédo → apparence → trait de côte →
courbes → lumière, par les positions dans le texte du fragment.

---

## 5. LES MESURES — ET LEURS DÉNOMINATEURS

**Toutes les données brutes sont sur le disque** : `.banc/vues-P3/` (**12 captures PNG et 2 fichiers de relevés**), `.banc/resultat-mutations-P3.json`, `.banc/harnais-P3.mjs`.

### Le banc rend-il quelque chose ? — la question du §0 du plan

- **Témoin** : deux rendus consécutifs du même état → **0 canal différent sur 3 072 000**.
- **Et ce zéro est une PREUVE, pas un banc vide** : cacher les tuiles du crop change
  **223 634 pixels**, et toutes lampes éteintes + environnement débranché le rendu vaut
  **0 sur les 3 072 000 canaux**.
- Le chemin de mesure est le rendu dans une cible **à profondeur** et **demi-flottante**
  (⚠️ `depth: false` sur le canevas de la page), **sans compositeur**, donc sans le grain de
  pellicule animé.

⚠️ **UNE MESURE QUE J'AI FAILLI PUBLIER FAUSSE.** Juste après un rechargement, cacher les
tuiles changeait **585 891** pixels au lieu de 223 634. Ce n'est pas un défaut du crop :
**les tuiles arrivent du réseau ENTRE les deux rendus du masque**. Deux appels consécutifs
sur une page stabilisée rendent 223 634 et 223 634. **Un masque pris pendant un chargement
ne veut rien dire**, et c'est une dixième façon dont un banc ment ici.

### La chaîne de « look » employée pour les mesures de teinte

Exposition (`params.exposure = 0,94`) → **ACES filmique de three** (celle que
`postprocessing` invoque, avec sa division par 0,6 et ses deux matrices) → sRVB.
⚠️ Une première version employait l'approximation de Narkowicz : même allure, autre épaule,
donc une énergie de détail qui ne veut pas dire la même chose. La saturation (−0,10) et le
contraste (−0,03) ne sont **pas** appliqués : ils s'appliquent identiquement aux deux côtés
(correction du noteur à P2) et ne changent aucun écart entre eux.

### ⚡ CE QUE LA TÂCHE DÉPLACE — paire appariée à 0,048 %, 223 634 px

**« nu » = l'état P2 : éclairage ET apparence éteints, au même instant, dans la même page.**

| critère | crop **nu** (P2) | crop **éclairé** (P3) | socle | écart nu → socle | **écart éclairé → socle** |
|---|---|---|---|---|---|
| luminance moyenne | 164,52 | **189,56** | 187,68 | −12,3 % | **+1,0 %** |
| écart-type de luminance | 34,52 | **22,37** | 21,01 | +64,3 % | **+6,4 %** |
| saturation moyenne | 0,2375 | **0,1640** | 0,1916 | +24,0 % | **−14,4 %** |
| écart-type de saturation | 0,1298 | **0,0772** | 0,0867 | +49,7 % | **−11,0 %** |
| part de neutres | 10,59 % | **21,54 %** | 17,85 % | −40,7 % | **+20,7 %** |
| énergie de détail | 5,424 | **3,371** | 4,194 | +29,3 % | **−19,6 %** |
| hors bande orange | 50,13 % | 50,12 % | 50,60 % | −0,9 % | −0,9 % |

➡️ **Six critères sur sept se rapprochent, et cinq d'entre eux divisent l'écart par plus de
deux.** La luminance moyenne passe de 12,3 % d'écart à **1,0 %** : c'est l'accord
d'exposition, et il tient.

⛔ **DEUX CHIFFRES QUI NE S'AMÉLIORENT PAS, ET JE NE LES CACHE PAS :**

- **« hors bande orange » ne bouge pas** (−0,9 % avant comme après). Le noteur mesurait
  **×65** sur ce critère ; chez moi, dans **cette palette-ci**, les deux côtés sont déjà
  d'accord. Ce n'est donc **pas** une réfutation de sa mesure : c'est que sa palette et la
  mienne ne sont pas la même (voir la réserve n° 1).
- **Les neutres et la saturation DÉPASSENT la cible** (+20,7 % et −14,4 %). Le crop est
  maintenant un peu **plus** neutre et **moins** saturé que le socle, là où il était moins
  neutre et plus saturé. **L'écart a changé de signe, il n'a pas disparu.**

### L'albédo, terme par terme — la mesure qui a piloté la tâche

Socle et crop rendus sous un hémisphère **blanc d'irradiance 1** (donc `pixel = albédo / π`),
couche Apparence **coupée des deux côtés**, sur la paire appariée :

| terme | crop | socle | **rapport** |
|---|---|---|---|
| **le fond** (`params.color` × valeur par sommet), `teinte = 0` | 0,6513 · 0,6840 · 0,7168 | 0,6597 · 0,6915 · 0,7242 | **0,987 · 0,989 · 0,990** |
| **la peinture** (`mapCol × fxShade`), `teinte = 1` | 0,5501 · 0,5945 · 0,5498 | 0,4937 · 0,6551 · 0,5239 | 1,114 · 0,907 · 1,049 |

➡️ **Le portage de la valeur par sommet est juste à 1,1 %.** ⚠️ **Le terme de PEINTURE, lui,
reste écarté de ±11 % et il est moins vert que celui du socle** — cet écart-là est dans la
rampe et le peigné (le domaine de P2) ou dans la mer, pas dans l'éclairage. **Je le laisse
ouvert plutôt que de l'attribuer.**

### ⛔ CE QUE JE N'AI PAS MESURÉ, ET JE NE LE DEVINE PAS

- **LE COÛT.** Pas une milliseconde de chronométrie. La tâche ajoute une vingtaine
  d'uniformes, `FX_GLSL` (90 lignes, dont une boucle de 12 tours pour l'effet 9), `fxBlend`
  et le bloc d'éclairage au fragment des tuiles — **c'est le nuanceur le plus chaud de
  l'application, et il tourne sur 141 tuiles.** La sonde d'ambiante ajoute en plus **une
  compilation de `MeshPhysicalMaterial` et deux rendus 64 × 64** au premier crop. ⚠️ **Rien
  de tout cela n'est chiffré**, et le déclarer négligeable serait exactement ce que P2 a
  refusé de faire pour le coût de liaison de ses deux samplers.
- **La page ne compose pas de frames quand le volet du navigateur est masqué** (`rAF` gelé,
  `document.visibilityState === 'hidden'`) : je n'ai donc **aucune** mesure en mouvement, ni
  aucune capture de l'écran RÉEL passé par le compositeur. Toutes mes images sortent de mon
  propre chemin de rendu.

---

## 6. LE SOCLE DE PRODUCTION — CE QUI EST PROUVÉ, ET CE QUI NE L'EST PAS

⚠️ **JE N'AI PAS REFAIT LA COMPARAISON BIT-À-BIT DE P2, ET JE DIS POURQUOI PLUTÔT QUE DE
LAISSER CROIRE QU'ELLE TIENT.** Cette tâche **modifie** `terrain.js` en deux endroits :
`fxShade` délègue à `natOmbrePeinture`, et la valeur par sommet à `natGris`. Les deux sont
des **transcriptions à l'identique** — `lerp(a, b, t) = a + (b − a)·t` dans `noise.js` est
exactement l'écriture du module, et `test/crop-eclairage.test.js` ②a/②b les confronte sur
576 et 102 points —, mais **une transcription vérifiée n'est pas un rendu comparé**.

Ce qui EST prouvé, drapeau **BAISSÉ** (`?globe=continu&socle=quadtree&f3=0&frontiere=1&seuil=1`),
page chargée ce jour : `uEclairageOn = 0`, `uSurfaceFx = 0`, `uFxOpacite = 0`,
`uSoleilIrr = uCielIrr = uSolIrr = (0,0,0)`, `uAlbedoBase = (1,1,1)`, `uAlbedoTeinte = 1`,
`uParoiCouleur = d8d4cc`, `uCropOn = 0`, `uHabOn = 0`, socle plat **visible**,
**0 programme en erreur**, aucune erreur JS ni de compilation de nuanceur. **Le bloc
d'éclairage n'est pas exécuté : `partBloc` vaut zéro.**

> ⚠️ **REJOUÉE POST-RELECTURE (constat groupé ②, tour de correction du 2026-08-22).** Le
> protocole bit-à-bit de P2 (§6 de `rapport-P2.md`) a été rejoué, camera figée identique,
> socle seul (masque = cacher `terrain.mesh`, compter ce qui change), 1 280 × 800, 4
> chargements de page complets — `AVANT` = `src/terrain.js` à `06b2339` (P2, juste avant
> cette tâche), `APRÈS` = `src/terrain.js` au commit de cette tâche. Résultat, chiffres et
> PNG sur disque (`.banc/vues-P3/GARANTIE-SOCLE-REJOUEE.json`,
> `AVANT-P3{,-B}-socle.png`, `APRES-P3{,-B}-socle.png`) :
>
> | paire | code | pixels changés / 1 024 000 | amplitude moy. |
> |---|---|---:|---:|
> | AVANT vs AVANT-B | **identique** (bruit de fond) | 22 318 (2,18 %) | 1,98 |
> | APRÈS vs APRÈS-B | **identique** (bruit de fond) | 23 324 (2,28 %) | 2,73 |
> | AVANT vs APRÈS | différent | 24 008 (2,34 %) | 2,99 |
> | AVANT vs APRÈS-B | différent | 11 158 (1,09 %) | 1,00 |
> | AVANT-B vs APRÈS | différent | 26 872 (2,62 %) | 4,23 |
> | AVANT-B vs APRÈS-B | différent | 23 187 (2,26 %) | 2,26 |
>
> **Ce n'est PAS le 0 pixel de P2** : même le MÊME code, chargé deux fois, ne rend plus deux
> images strictement identiques — 2,2 % des pixels bougent d'amplitude ~2/255 d'un
> chargement à l'autre, **et ce bruit existe déjà sur l'ANCIEN `terrain.js`** (ligne
> AVANT vs AVANT-B), donc il n'est pas causé par cette tâche. **Ce qui compte : la moyenne
> des quatre paires à code DIFFÉRENT (21 306 px, amplitude 2,62) n'est PAS plus grande que
> la moyenne des deux paires à code IDENTIQUE (22 821 px, amplitude 2,36)** — au contraire,
> légèrement plus basse. Le socle n'a donc PAS mesurablement bougé sous l'effet des deux
> retouches de `terrain.js` de cette tâche ; la différence entre AVANT et APRÈS se confond
> avec le bruit de chargement à chargement déjà présent avant elle. **À l'écran** (mêmes
> PNG), les deux images sont indiscernables à l'œil.
>
> ⚠️ **Ce que cette mesure ne dit pas** : la SOURCE du bruit de fond lui-même (compilation de
> nuanceur, jitter flottant, ou autre) reste inconnue — non creusée, hors du périmètre de ce
> tour de correction.

---

## 7. LES TESTS ET LA CAMPAGNE DE MUTATION

`test/crop-eclairage.test.js` — **+33 tests**, en cinq sections, plus une sixième qui est le
geste neuf de cette tâche :

- **①** la loi pure, et **chaque constante remonte à `terrain.js` ou à `three`** ;
- **⚡ ①b — LA RÉFÉRENCE EST LUE DANS `node_modules/three`.** Le test ouvre
  `common.glsl.js` et `lights_pars_begin.glsl.js`, exige que `BRDF_Lambert` soit
  `RECIPROCAL_PI * diffuseColor`, que `RECIPROCAL_PI` vaille bien `1/π`, et que
  l'hémisphère soit `mix(groundColor, skyColor, 0.5 * dotNL + 0.5)`. **Ce n'est pas une
  transcription qu'on promet d'entretenir : c'est une transcription qui rougit le jour où
  three change d'avis** ;
- **②** le **TEXTE GLSL traduit et EXÉCUTÉ** contre les jumeaux JS — 576 points pour
  `natGris`, 144 × 3 pour `albedoCrop`, 100 × 3 pour `eclairerCrop`. ⚠️ **Le fournisseur de
  `natLuminance` VÉRIFIE l'argument qu'on lui passe** : sans cela, un nuanceur qui
  luminancerait la carte au lieu du fond passerait le test ;
- **③** **l'unicité de l'écriture**, formule par formule, **commentaires retirés avant de
  chercher** ;
- **④** le **branchement** — dont **④j, écrit APRÈS la campagne** (voir ci-dessous) ;
- **⑤** les gardes du nuanceur, dont **l'ORDRE** des postes et le compte de samplers
  (huit, **compté par la boucle**, pas annoncé par un commentaire).

⚠️ **QUATRE TESTS EXISTANTS ONT ÉTÉ MIS À JOUR PARCE QUE LA LOI A DÉMÉNAGÉ, PAS PARCE
QU'ILS ÉCHOUAIENT À TORT** — et chacun a été RENFORCÉ en même temps :

1. `fenetre-branchee` ⑫g cherchait `Math.pow(Math.max(0, hn), 0.85)` **dans `terrain.js`**.
   Il exige maintenant **les deux faits** : la délégation dans `terrain.js` **et** la borne
   dans le module, **en JS et en GLSL** — sans quoi il suffirait de réécrire la formule sur
   place pour que la ligne reste verte.
2. `crop-naturel` ③c cherchait `fxBlend` mode 10 dans `terrain.js` : il l'exige maintenant
   dans le module **et** l'injection dans le socle.
3. `crop-habillage` ⑨ : le globe de papier ne portait pas les nouveaux uniformes. ⚠️ **Et sa
   lecture ne prenait que `x` et `y`** : une irradiance dont seul le **BLEU** aurait été mal
   rendu par `retirerHabillage` serait passée inaperçue à ⑨h. Elle lit les trois canaux.

### La campagne — `.banc/mutations-P3.mjs`, worktree `C:/Dev/wt-p3-mut`, **retiré en partant**

**36 mutations sémantiques, dont 24 visant le BRANCHEMENT** (le fil, la liste de
surveillance, les deux poseurs, la sonde, la boucle d'image).

⚠️ `node_modules` est une **jonction** vers l'arbre principal, et **`core.autocrlf = false`** :
les cinq fichiers mutés sortent en **LF pur** dans le worktree (vérifié : 0 CRLF), donc pas
de faux survivant.

**Premier tour : 33 / 36.** ⛔ **Trois VRAIES survivantes, et elles ont trouvé un trou réel :
`centreLat`, `albedoBase` et `albedoTeinte` pouvaient être FIGÉS À UNE CONSTANTE dans
`contexteCrop` sans qu'un seul test bouge.** Mon ④c nommait quinze champs sur vingt-sept.

**Le correctif ne nomme plus à la main** : ④j lit `CHAMPS_HABILLAGE`, retrouve chaque champ
dans le texte de `contexteCrop` et exige que sa valeur commence par une **source vivante**
(`terrain.`, `sun.`, `hemi.`, `scene.`, `plinth.`, `centre.`, `coefAmbiante(`, `params.sun`).
Un champ ajouté demain est donc couvert dès son ajout — **c'est la leçon que `uHemi` a
coûtée à P2**, dont le ④c ne vérifiait que trois curseurs sur dix.

**Second tour : 36 / 36, 0 non appliquée.** `.banc/resultat-mutations-P3.json`.

---

## 8. CLÔTURE

- `npm test` — **3 905 / 3 905** (3 872 au départ, **+33**).
- `npm run audit:tests` — **208 / 208**, aucun écart.
- `node --check` — vert sur `src/globe.js`, `src/main.js`, `src/terrain.js`,
  `src/monde/eclairage-crop.js`, `src/monde/melange-crop.js`,
  `src/monde/branchement-crop.js`, `src/sonde-ambiante.js`, `test/crop-eclairage.test.js`,
  `test/crop-habillage.test.js`, `test/crop-naturel.test.js`, `test/fenetre-branchee.test.js`.
- **CRLF** — `git diff --cached --stat` et `git diff --cached --ignore-cr-at-eol --stat`
  rendent **exactement le même compte** : **2 203 insertions, 57 suppressions, 12 fichiers**.
  Aucun faux diff.
- **Arbre propre après commit** (`git status --porcelain` vide), **worktree de mutation
  retiré** (`git worktree list` ne le porte plus, le dossier n'existe plus).
- **Page chargée, drapeau BAISSÉ** : voir §6. **La production est intouchée.**
- **Page chargée, drapeau LEVÉ** (`?terre=unique&…`) : `refus` **vide**, `uEclairageOn = 1`,
  `uSoleilIrr = (3,736 · 3,475 · 2,957)`, `uCielIrr = (2,826 · 3,073 · 3,309)`,
  `uSolIrr = (0,468 · 0,447 · 0,431)`, `uAlbedoBase = (0,855 · 0,896 · 0,939)`,
  `uAlbedoTeinte = 0,68`, **`uParoiCouleur = c06a44` ET `plinth.wallMat.color = c06a44`**,
  `uSurfaceFx = 9` des deux côtés, `uFxOpacite = 0,44` des deux côtés,
  `uFxDemiBloc = 28 = uSlabHalf`, et — les vérifications de P2, toujours vraies —
  `terrain.mapUniforms.uAnalysis.value === globe.uniforms.uAnalysis.value` et
  `terrain.mapUniforms.uRampTex.value === globe.uniforms.uRampCrop.value`.
- **Aucune erreur JS, aucune erreur de compilation de nuanceur**, des deux côtés du drapeau
  (recherche par motif `uncaught|TypeError|ReferenceError|shader|GLSL|program` : zéro
  résultat ; **0 programme non exécutable** dans `renderer.info.programs`). Les seules
  erreurs de console sont des `404` sur les tuiles, présentes des deux côtés.

⚠️ **UNE FAUTE ATTRAPÉE AU NAVIGATEUR ET PAS PAR LES TESTS, ET ELLE VAUT D'ÊTRE DITE** :
mes premiers commentaires GLSL portaient des **accents graves** — dans un template literal
JS, ils le TERMINENT. La page rendait `SyntaxError: Unexpected identifier 'dedans'` et ne
démarrait pas, **`node --check` rougissait**, et aucun test n'aurait pu le voir puisque
aucun ne charge `main.js`. `terrain.js`, `ocean.js` et `naturel-crop.js` documentent tous
les trois ce piège ; je l'ai payé quand même.

---

## 9. MES RÉSERVES

1. ⚠️ **LA PALETTE DE MA SESSION N'EST PAS CELLE DU NOTEUR, ET AUCUN DE MES CHIFFRES NE SE
   COMPARE AUX SIENS.** Son socle est vert-brun sombre (luminance moyenne 91,85) ; le mien
   est blanc-terracotta pâle (187,68) — et un rendu **sans aucun tone mapping** du mien
   donne 184,12, donc **ce n'est pas la chaîne de look, c'est la palette**. C'est le piège
   qu'il a lui-même documenté. **Mes deux côtés partagent la même palette, ce qui est la
   seule chose qui compte pour un écart** — mais « hors bande orange ×65 » chez lui et
   « −0,9 % » chez moi ne se contredisent pas : ils ne parlent pas de la même carte.
2. ⚠️ **UN SEUL LIEU, UN SEUL CADRAGE, UN SEUL MOMENT DE LA JOURNÉE.** La Réunion, z12, vue
   isométrique 0, soleil à 34,26° d'élévation. **Je n'ai pas vérifié à l'écran** un crop
   continental, un crop de haute latitude, ni le bloc **de nuit** — or l'éclairage du crop
   suit maintenant le cycle horaire, et c'est justement la nuit que les deux lois (celle du
   bloc et celle de la planète) divergent le plus.
3. ⚠️ **LE COÛT N'EST PAS MESURÉ** (§5). C'est la réserve la plus lourde : le fragment des
   tuiles vient de grossir d'un bloc d'éclairage, de `FX_GLSL` et de `fxBlend`, et il
   s'exécute sur toutes les tuiles visibles.
4. ⚠️ **LA COUTURE À LA FRONTIÈRE DU BLOC EN COURS DE FONDU, ET JE NE L'AI PAS CHERCHÉE À
   L'ÉCRAN.** À estompage plein, rien n'est dessiné dehors. **En cours de fondu**, la loi
   change exactement au bord du bloc, et **au pixel de frontière `colPlanete` est calculée
   sur une couleur à demi convertie en albédo**. C'est UN pixel sur une silhouette, et
   l'alternative — porter deux couleurs dans tout le nuanceur — ferait peindre deux fois
   l'apparence, le trait de côte, les courbes et le graticule. **Mais je ne l'ai pas vu.**
5. ⚠️ **LE MOTIF DE L'APPARENCE EST ANCRÉ AU BLOC, PAS AU MONDE.** `champXZ()` du socle vaut
   `vWorldPos.xz + uFenetre` ; le crop calcule `qCrop × uSlabHalf + uFenetre`. Les deux
   coïncident **pour le bloc central** — vérifié à l'écran, `P3-MOTIF-*.png` —, mais le
   `qCrop` du crop est relatif au CENTRE DU CROP : si le centre bouge, le motif du crop
   suit le bloc au lieu de rester collé au sol. **Je ne l'ai pas vérifié en mouvement**
   (voir la note sur `rAF` au §5).
6. ⚠️ **LE `tint[i] * 0.05` DE `terrain.js` N'EST PAS PORTÉ.** C'est un champ de bruit
   **pré-cuit sur la grille du bloc** (`detail-noise.js`) que le crop n'a pas. ±0,05 sur un
   terme qui pèse 0,32 de l'albédo, soit **±1,6 %**.
7. ⚠️ **L'APPOINT (`fillLight`) N'EST PAS PORTÉ.** Il vaut 0 dans le gabarit d'ouverture,
   mais c'est une option du studio, et D3 dit qu'aucune ne se perd. Le jour où quelqu'un
   l'allume, le bloc ne le verra pas.
8. ⚠️ **LE SPÉCULAIRE DE L'ENVIRONNEMENT N'EST PAS PORTÉ NON PLUS** — mesuré à **4,0 %** de
   la sortie du socle, et retiré de la sonde par soustraction précisément pour ne pas le
   compter deux fois. Le crop est un Lambert pur.
9. ⚠️ **`params.envMapIntensity` EST DU CODE MORT SUR LE RELIEF** (§2.2), et je n'y ai pas
   touché : le corriger est une décision sur le socle, pas sur le crop. **Le curseur du
   panneau ne fait rien tant que le matériau n'a pas d'`envMap` à lui.**

---

## 10. CE QUI RESTE SUR LE DISQUE

`.banc/serveur-vues-P3.mjs` (port 5601, sert aussi le harnais) · `.banc/harnais-P3.mjs`
(appariement, masques, mesures, chaîne de look) · `.banc/mutations-P3.mjs` ·
`.banc/resultat-mutations-P3.json` · `.banc/vues-P3/` — **12 captures PNG et 2 fichiers de
relevés** (`P3-bilan-surface.json`, `P3-bilan-1.json`), dont les trois paires du §0.
