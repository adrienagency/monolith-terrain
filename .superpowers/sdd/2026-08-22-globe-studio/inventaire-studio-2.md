# INVENTAIRE STUDIO 2 — LES 127 OPTIONS, ET CE QU'ELLES FONT SOUS LA SPHÈRE

> **Tâche R18, étape 1. ⛔ CE TABLEAU DÉCRIT L'ÉTAT *AVANT* TOUTE CORRECTION.**
> Livrés : `scripts/sonde-studio-r18.mjs` (l'écran), `scripts/sonde-uniformes-r18.mjs`
> (la traversée), `scripts/cibles-studio-r18.mjs` (le catalogue partagé par les
> deux), `scripts/captures-r18.mjs` (les images), `scripts/table-r18.mjs` (la
> jointure), `scripts/diag-r18-*.mjs` (les diagnostics). Traces : `.banc/R18/`.
> Matériel : ANGLE (NVIDIA RTX 3080, D3D11), Chrome sans tête 1280 × 800, port 5561.
> URL : `http://localhost:5561/` — **aucun paramètre**, le mode sphère est le défaut.
> État mesuré : `mode = surface`, `altM = 18 201`, `baseYCrop = −0,1200`, heure 15,1,
> La Réunion, z12.

## ⚡ DEUX FAUTES D'INSTRUMENT, ET LES DEUX CHANGEAIENT LE VERDICT

⛔ **MA PREMIÈRE PASSE DÉCLARAIT 66 OPTIONS MORTES. IL Y EN A 47.** Les
dix-neuf de différence ne sont pas des corrections de code : ce sont deux
défauts de mesure, trouvés parce qu'une capture contredisait un chiffre.

### ① Une moyenne de boîte ANNULE un motif fin

La sonde condensait l'image en 64 × 40 — des cases de 20 × 20 pixels.
**« Hauteur des vagues » de 0 à 2 rendait 1,45 fois le plancher de bruit**, ce
qui se lit « ne fait rien ». Deux captures prises côte à côte
(`.banc/R18/mer-seaWaveH-bas.png` / `-haut.png`) montrent des crêtes sur toute
la nappe : les crêtes claires et les creux sombres tombaient dans la même case
et **se compensaient**.

⚡ **Deux corrections :** la grille passe à **256 × 160**, et une seconde
grandeur arrive — le **gradient** local (|dx| + |dy| sur la luminance), qui
mesure la quantité de DÉTAIL et non la couleur moyenne. Le calcul reste dans la
page : à cette finesse, faire traverser 122 880 nombres par relevé coûtait plus
cher que le rendu.

### ② Un curseur qu'on ne lâche jamais ne commite rien

La sonde n'émettait que `input`. **« Échelle fine », « Détail fin » et
« Échelle du détail » ne commitent qu'au RELÂCHEMENT** (`change`) — c'est là que
leur panneau accroche `regenerateTerrain`. Les trois étaient déclarés morts ;
re-mesurés avec l'événement, ils rendent **0,188 · 0,191 · 0,184**, c'est-à-dire
qu'ils marchent. `.banc/R18/change2`, `.banc/R18/change3`.

### ③ Et une garde de protocole, qui a failli coûter 65 lignes

Une première passe « remettait à l'origine » une rangée de chips **où aucune
chip n'était allumée au départ** : elle cliquait la première par défaut, et la
scène est restée sur une autre heure. **Les 65 lignes suivantes ont été mesurées
de nuit**, où plus rien ne se voit — elles rendaient toutes « ne fait rien ».
La sonde MESURE désormais le retour à l'origine et **recharge la page** quand il
n'a pas eu lieu (22 rechargements sur la passe de référence).

## LE PROTOCOLE

- Les contrôles sont pilotés **par leur vrai nœud du DOM** — `input.value` puis
  de vrais événements `input` ET `change`, `button.click()` pour les
  interrupteurs, les vignettes et les chips. **Aucune recopie du corps de
  `set:`** : c'est le chemin de l'utilisateur, ou rien.
- **Le mouvement ambiant est coupé** pendant la mesure (`params.animations`).
  La scène devient reproductible **au bit près** : le plancher de bruit tombe de
  **0,3693 à 0,0000 sur six relevés consécutifs**. Sans ça, la mer qui bouge EST
  le bruit, et elle noie tout ce qui est plus discret qu'elle.
  ⛔ **Corollaire à ne pas oublier : les options de MOUVEMENT ne se jugent pas
  sur une image fixe.** Vitesse de dérive, direction du vent, mouvements de
  caméra rendent zéro **par construction** sous ce protocole. Elles sont
  marquées *(mouvement)* et jugées à la traversée.
- **Deux passes** : à l'état de départ, et **préconditions allumées** (photo
  aérienne, mer animée, bokeh, SSAO, SSS, socle…). Une tirette rangée derrière
  `visibleWhen` mesurée parent éteint rend toujours « ne fait rien » — c'est un
  artefact, pas un verdict. *Étalon : « Intensité du flou » = 0,000 parent
  éteint, **9,815** parent allumé.*
- **Une troisième sonde lit les uniformes** de `globe.uniforms` avant/après.
  C'est elle qui sépare **« la valeur n'a pas traversé »** de **« elle a
  traversé et ne se voit pas »** — deux pannes qui appellent des réparations
  opposées. Les deux sondes partagent **le même catalogue de cibles**
  (`scripts/cibles-studio-r18.mjs`) : sans ça, `[12]` ne désignerait pas la même
  option des deux côtés.

## LES SEUILS, ET LEUR ÉTALON

`moy` = écart absolu moyen des niveaux de gris sur l'image entière (0-255).
`grad` = écart absolu moyen du gradient local.

| verdict | règle |
|---|---|
| ⛔ **écrit dans le vide** | `moy < 0,005` **et** `grad < 0,01` **et** aucun uniforme du globe touché |
| ⚠️ **marche à moitié** | traverse mais ne se voit pas, ou se voit sous le seuil de lisibilité (`moy < 0,06` et `grad < 0,12`) |
| ✅ **marche** | `moy ≥ 0,06` **ou** `grad ≥ 0,12` |

⚡ **L'ÉTALON EST UNE CAPTURE, PAS UN CHOIX** : « Hauteur des vagues » vaut
**0,140** et se voit nettement sur deux captures côte à côte ; « Opacité des
courbes » vaut **0,014** et ne se voit pas (capture
`.banc/R18/captures/17-Carte-Opacité_des_courbes-max.png` : aucune courbe
lisible sur les terres). Le seuil est entre les deux.

## LE COMPTE

| panneau | ✅ | ⚠️ | ⛔ | total |
|---|---|---|---|---|
| Caméra | 3 | 0 | 3 | 6 |
| Couches | 0 | 1 | 3 | 4 |
| Carte | 4 | 4 | 5 | 13 |
| Terrain | 30 | 0 | 4 | 34 |
| Fonds | 3 | 0 | 0 | 3 |
| Éléments | 18 | 1 | 22 | 41 |
| Effets | 10 | 1 | 2 | 13 |
| Parcours | 1 | 1 | 5 | 7 |
| Mes créations | 0 | 0 | 1 | 1 |
| Paramètres | 3 | 0 | 2 | 5 |
| **total** | **72** | **8** | **47** | **127** |

⚠️ **« Caméra », « Couches », « Parcours » et « Mes créations » ne sont pas des
panneaux du Studio** — ils sont recensés parce que la sonde balaie tout le DOM,
et parce que leurs pannes sont les mêmes. **Les six panneaux demandés (Carte,
Terrain, Fonds, Éléments, Effets, Paramètres/Avancé) font 109 options :
68 ✅, 6 ⚠️, 35 ⛔.**

⚠️ **ET DEUX MESURES SONT NON CONCLUANTES, PAS NÉGATIVES.** Les sept options du
panneau « Parcours » sont mesurées **sans aucun tracé GPX chargé** : elles n'ont
rien à peindre, et leur 0,000 ne dit rien de leur branchement. Idem pour les
trois curseurs du panneau « Couches » dont la couche est éteinte par défaut
(Lumières nocturnes, canopée). Ils sont comptés ⛔ parce que la règle est
mécanique ; **ils ne sont pas la cible de cette tâche.**

---

# ÉTAPE 2 — LE CLASSEMENT

## (a) Ce qui se rebranche en déplaçant une écriture — **2 options**

| # | option | ce qu'il faut déplacer |
|---|---|---|
| **21** | **Sommets** | ✅ **FAIT.** Les marqueurs sont du DOM projeté : il leur fallait la caméra du globe (`camGlobe`) et l'adaptateur bloc ↔ globe **qui existe déjà** (`monde/sol-globe.js`, celui des rivières et des toponymes), plus un prédicat qui ne soit pas `socleAffiche()`. |
| **50** | **Couleur de la tranche** | La couleur des parois du crop est lue sur `plinth.wallMat.color` (habillage `paroiCouleur`), et `plinth.setColors` **ignore `params.plinthColor` dès qu'un préréglage PBR est posé** — ce qui est le cas au démarrage. Le curseur écrit donc dans une variable que personne ne relit. C'est un arbitrage de PRIORITÉ (le choix explicite doit-il battre le préréglage ?), pas un branchement. |

⚡ **LE PAQUET (a) EST PETIT, ET C'EST UNE BONNE NOUVELLE.** La raison est que
`monde/branchement-crop.js` porte déjà un pont large — `CHAMPS_HABILLAGE`
transporte **une cinquantaine de champs** du socle vers le crop, par image et
sur changement. Tout ce qui passe par `terrain.mapUniforms` et existe dans le
nuanceur du globe est **déjà branché** : les dix curseurs d'Atlas, la teinte
hypsométrique, le contraste et le pivot d'altitude, les huit réglages d'effet de
surface, la photo aérienne et son fondu, l'éclairage entier. **Ce n'est pas
« beaucoup à rebrancher » : c'est un pont posé, et une poignée d'oubliés.**

## (b) Ce qui demande une vraie transcription de loi — **25 options**

| bloc | # | pourquoi c'est une transcription |
|---|---|---|
| **Nuages + Vent** | 74-88 (**15**) | ⛔ **Le groupe `clouds2` est DANS la scène du bloc plat et `visible = false`** — relevé : `Scene/clouds2`, 1 enfant, invisible. Le globe a bien une couche de nuages (`cloud-shell`, visible), mais c'est **un objet sans rapport** : une coquille sphérique portant une texture équirectangulaire procédurale de couverture satellite. Elle n'a ni couverture, ni bourgeonnement, ni altitude, ni dérive au sens des quinze réglages. Les brancher, c'est **porter le volume de nuages sur la sphère**, pas déplacer une écriture. |
| **Appoint + ombres** | 68-73 (**6**) | La lampe d'appoint et la douceur des ombres agissent sur des `THREE.Light` de la scène du BLOC. Le crop, lui, n'est pas éclairé par des lampes : `monde/eclairage-crop.js` reçoit des **irradiances** (`soleilIrr`, `hemiHaut`, `cielIrr`, `solIrr`) et calcule sa couleur. Ajouter une seconde source demande d'étendre cette loi et ses uniformes. **La douceur des ombres n'a rien à étendre du tout : le crop ne reçoit aucune ombre portée.** |
| **Points cotés** | 22 (**1**) | Groupe de GÉOMÉTRIE plate dans la scène du bloc. Même cas que le cartouche : il lui faut l'adoption de `monde/cartouche-globe.js` — la similitude, la conversion de base, et le repère local pour qu'il se couche sur la tangente et non sur `+Y`. |
| **Intervalle des courbes** | 16 (**1**) | Le globe a `uContourInterval`, mais **en MÈTRES**, et `poserHabillage` le cale déjà tout seul sur l'amplitude du crop (`intervalleCourbes`). Le curseur, lui, est en **unités de bloc**. C'est exactement la classe de défaut n° 1 du chantier (SEPT conversions ratées) : `intervalM = valeur × extentMeters / (56 × exagération)`. ⚠️ **Et ça ne se verrait pas** : voir (d). |
| **SSS** | 111-112 (**2**) | Le nuanceur du crop n'a pas de diffusion sous-surfacique. (Le crop est un TERRAIN, pas un objet translucide — voir aussi (c).) |

## (c) Ce qui n'a **aucun sens** sur la sphère — **6 options**

⚡ **C'est le paquet le plus utile à dire franchement, et il est plus petit que
je ne le croyais.**

| # | option | pourquoi |
|---|---|---|
| **19, 20** | **Taille / Opacité de la grille** | La grille du bloc plat est un quadrillage **en unités de bloc**, dessiné dans le plan. Sur une découpe de sphère, la grille cartographique **existe déjà et n'est pas celle-là** : c'est le graticule de latitude/longitude (`uGraticuleOpacity`, tous les 10°). Deux curseurs qui prétendraient piloter « la grille » en piloteraient deux objets différents selon le mode. |
| **30** | **Ombrage des pentes** | Déjà **masqué par l'interface** en colorisation Atlas (`visibleWhen(slopeRow, () => !isNatural())`), et Atlas est le mode de démarrage. Le module `naturel-crop.js` dit pourquoi : le peigné sculpte les versants bien mieux que ce brunissage à plat, et les deux ensemble empâtent la carte. **Rien à faire : il est déjà éteint là où il n'a pas de sens.** |
| **123, 124** | **Ombres / Résolution des ombres** | Elles règlent la carte d'ombre projetée du bloc plat. **Le crop ne reçoit aucune ombre portée** — son ombrage vient des irradiances, pas d'une `shadowMap`. Ces deux réglages appartiennent au moteur du bloc plat, qui n'est plus rendu. |
| **26** | **Ombrage auto** | ⚠️ **Ce n'est pas une panne, c'est un no-op légitime** : l'interrupteur *rend la main* au calcul automatique. Il est déjà ALLUMÉ au démarrage et aucun curseur n'a été figé, donc l'éteindre puis le rallumer ne change rien — par construction. |

## (d) Ce qui traverse et ne se voit pas — **2 options ⛔, et 6 ⚠️ de la même famille**

⚡ **Les trente-cinq ⛔ des six panneaux se rangent en 2 + 25 + 6 + 2.** Les deux
derniers sont ici : **« Reflet du soleil »** (93) et **« Speed » des effets de
surface** (46, une vitesse — invisible sur une image figée par construction).


⚠️ **LES COURBES DE NIVEAU DU CROP SONT QUASI INVISIBLES SUR LES TERRES.**
« Opacité des courbes » **traverse** (`uContourOpacity` change sur le globe) et
« Épaisseur des courbes » aussi (`uContourWeight`), mais de 0 à 1 l'écran bouge
de **0,014** — sous le seuil. La capture le montre : à opacité maximale, on
distingue quelques courbes **dans la mer** (bathymétrie) et **aucune sur la
terre**.

➡️ **C'est un seul défaut derrière trois curseurs (16, 17, 18).** Régler
l'intervalle avant d'avoir rendu les courbes visibles reviendrait à empiler un
réglage sur une panne. **Le travail utile est de trouver pourquoi elles
s'effacent** — le nuanceur porte un `minFade` fondé sur les texels par pixel
d'écran (`clamp(1,6 − texel × 0,55)`), et c'est le premier suspect.

⚠️ **Autres « traverse mais invisible », mesurés** : « Reflet du soleil »
(`uMerSoleilFx` passe bien de 0,72 à 0 puis à 2 sur le matériau `crop-mer`, et
l'écran bouge de 0,0001 : la géométrie soleil/vue de ce cadrage ne produit pas
de glint), « Villes & lieux » (0,008 — les toponymes SONT relogés, ils sont
juste minuscules à cette échelle), « Rivières & eau » (0,046).

## CE QUE J'AI VÉRIFIÉ ET QUI CONTREDIT LE BRIEF

⚡ **« la mer et la matière écrivent dans `realWater` et `terrain`, donc dans le
vide » — CE N'EST PLUS VRAI POUR LA MER.** Sur les **douze** options de la
section Mer, **dix marchent, une à moitié, une écrit dans le vide** : mer animée
**1,685**, couleur de l'eau **0,694**, givre de tranche **0,548**, tranche de
verre **0,431**, chips d'état de mer **0,334**, vitesse **0,329** *(mouvement)*,
clapot **0,243**, hauteur des vagues **0,140**, réfraction **0,081**,
transparence du fond **6,032**, fond marin **2,485**. Seul « Reflet du soleil »
rend **0,0001** — et il TRAVERSE (voir (d)).
Les tâches P4 à R2 ont posé le pont : `globe.majReglagesMer({...realWater.reglagesMer})`
est appelé **à chaque image**, et il LIT les uniformes du socle. Écrire dans
`realWater` n'est plus écrire dans le vide.

⚡ **Et la MATIÈRE du relief se voit, elle aussi** — **3,561** mesuré sur le
picker de dix-sept vignettes. Le crop n'a pas de matériau PBR, mais
`terrain.material.color` traverse par `albedoBase` : la **couleur** d'une
matière arrive, sa **texture** non. C'est un ⚠️ déguisé en ✅, et il faut le
dire : changer « Verre » pour « Marbre » repeint le crop sans lui donner du
marbre.

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
| 24 | Échelle fine | params.demExaggeration (fin) → idem, commit au relâchement | idem | ✅ | 0.188 | 0.320 | — |

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
| 55 | Détail fin | params.detail → regenerateTerrain (relâchement) | maillage du bloc plat ; le crop a son propre maillage | ✅ | 0.191 | 0.333 | — |
| 56 | Échelle du détail | params.detailScale → idem | idem | ✅ | 0.184 | 0.318 | — |

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
