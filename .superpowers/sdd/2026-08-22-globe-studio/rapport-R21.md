# RAPPORT R21 — L'ÉCLAIRAGE DU CROP : huit réglages morts

Arbre `C:\Dev\wt-lum`, branche `lumiere-crop`. Serveur `npm run dev -- --port 5601`
(arrêté à la fin). Matériel : ANGLE (NVIDIA RTX 3080, D3D11), Chrome sans tête
1280 × 800. URL **sans aucun paramètre** — le mode sphère est le mode de
démarrage depuis que `src/flags.js` lève ses drapeaux. Lieu et pose relevés :
`mode = surface`, `altM = 18 201,3`, heure 15,1, La Réunion, `uEclairageOn = 1`.

---

## LE TABLEAU, ET IL SE LIT EN UNE LIGNE PAR RÉGLAGE

| n° | libellé | issue | le chiffre qui la prouve |
|---|---|---|---|
| **68** | Douceur des ombres | ⛔ **sans objet sur une sphère** — curseur **caché** en mode sphère | **0,000 / 0,000 sur 5 mesures sur 6** (la sixième est le transitoire du §④ ter), et **quatre constats de code indépendants**, dont `passeSurface.enabled = false` |
| **69** | Appoint (interrupteur) | ✅ **branché** | **moy 0,467 · grad 0,236** — ×23,3 le plancher |
| **70** | Intensité | ✅ **branché** | **moy 1,984 · grad 0,787** — ×99,2 (valeur basse du triplet : 0,466 / 0,236) |
| **71** | Écart au soleil | ✅ **branché** | **moy 0,363 · grad 0,279** — ×18,1 |
| **72** | Hauteur | ✅ **branché** | **moy 0,641 · grad 0,574** — ×32,1 |
| **73** | Couleur | ✅ **branché** | **moy 0,514 · grad 0,153** — ×25,7 |
| **26** | Ombrage auto | ✅ **il l'était déjà** — le ⛔ de l'inventaire est un **défaut de protocole** | **moy 1,404 · grad 0,558** — ×70,2, mesuré avec le bon geste |
| **30** | Ombrage des pentes | ✅ **branché** | **moy 0,119 · grad 0,154** — ×6,0, **reproduit à 0,001 près sur cinq campagnes**, AVANT = 0,000 / 0,000 |

⚡ **ET DEPUIS R21 bis, LES PAROIS DU CROP AUSSI** : appoint à 3, **55 591
pixels** changent contre **0** au témoin éteint — §④ bis.

**Le barème est celui de l'inventaire lui-même** (`inventaire-studio-2.md`) :
✅ = `moy ≥ 0,06` **ou** `grad ≥ 0,12`. **Les sept passent** — six d'entre eux
d'un facteur 3 à 33 au-dessus du seuil, et le n° 30 d'un facteur 1,3
(`grad 0,155` contre 0,12) ; c'est le plus faible des sept, et le §③ dit
pourquoi.

---

## ⚡ L'AVANT/APRÈS SOUS LE **MÊME** PROTOCOLE — et il retourne un verdict

⚠️ **LE GRIEF QUE R21 ADRESSE À L'INVENTAIRE VAUT CONTRE R21.** Reprocher à
quelqu'un d'avoir mesuré sans la précondition, puis publier un « avant » mesuré
sans elle, ce serait la même faute au carré. L'avant a donc été **remesuré avec
les préconditions**, dans la même session et sur le même binaire, en coupant non
pas la loi mais **le TRANSPORT** : `poserHabillage` reçoit l'habillage amputé des
cinq champs neufs (`--simule-avant`). Les gardes du nuanceur ramènent alors
`uAppointIrr` à `(0, 0, 0)` et `uSlopeTint` à 0 — **l'image d'avant cette tâche
au bit près**, et c'est précisément ce qui manquait : le transport, pas la loi.

| n° | AVANT, transport coupé | APRÈS | verdict |
|---|---|---|---|
| **témoin nul** | 0,000 / 0,000 | 0,000 / 0,000 | l'instrument ne bouge pas tout seul |
| **68** Douceur des ombres | 0,000 / 0,000 | **0,000 / 0,000** | ⛔ rien à brancher |
| **69** Appoint | 0,000 / 0,000 | **0,467 / 0,236** | ✅ |
| **70** Intensité | 0,000 / 0,000 | **1,984 / 0,787** | ✅ |
| **71** Écart au soleil | 0,000 / 0,000 | **0,363 / 0,279** | ✅ |
| **72** Hauteur | 0,001 / 0,003 | **0,641 / 0,574** | ✅ |
| **73** Couleur | 0,191 / 0,385 *(valeur basse 0,000)* | **0,514 / 0,153** | ✅ — mais voir §④ bis |
| **26** Ombrage auto | ⚡ **1,390 / 0,546** | 1,404 / 0,558 | ✅ **il marchait déjà** |
| **30** Ombrage des pentes | 0,000 / 0,000 | **0,119 / 0,155** | ✅ |

⚡ **LA LIGNE 26 EST LE RÉSULTAT LE PLUS PARLANT DU TABLEAU.** Transport coupé,
avec R21 entièrement neutralisé, « Ombrage auto » rend **1,390 / 0,546** —
c'est-à-dire **exactement ce qu'il rend après**. Il n'a jamais été mort. Le ⛔ de
l'inventaire ne mesurait pas le réglage : il mesurait un **loquet idempotent**.
**Aucune ligne de code n'a été écrite pour lui**, et c'est la bonne réparation.

**Traces** : `avant` → `.banc/R21/sonde-avant-meme-protocole.json` ; `après` →
`.banc/R21/sonde-apres.json` ; captures `.banc/R21/apres-*.png`. La première
passe, au protocole R18 sans précondition et sur le code d'avant, est dans
`.banc/R21/avant/` (les huit à 0,000 / 0,000, plancher `0,0000027 / 0,0000073`).

---

## ① LA MÉTHODE, ET POURQUOI ELLE A DÛ CHANGER

### Trois des huit zéros n'étaient pas des verdicts

C'est le résultat le plus utile de cette tâche, et il ne vient pas du code.

- **n° 26, « Ombrage auto » — c'est un LOQUET, pas un interrupteur d'effet.**
  `setShadeAuto(v)` fait `params.shadeAuto = v` puis, **si `v` est vrai**,
  `applyAutoShade({force: true})`. L'auto est allumé au départ et ses quatre
  valeurs sont déjà posées : l'éteindre n'écrit rien (`if (!params.shadeAuto)
  return null`), le rallumer recalcule `gradeForDem()` sur le **même MNT** et
  réécrit les **mêmes quatre nombres**. **Un aller-retour idempotent rend 0,000
  par construction.** Le geste qui le voit : figer d'abord un des quatre (bouger
  « Contraste d'altitude » appelle `markShadeDirty`), **puis** rallumer l'auto —
  `force: true` efface le gel et la valeur saute. Mesuré ainsi : **1,404 / 0,558**.

- **n° 30, « Ombrage des pentes » — la ligne était CACHÉE au moment de la
  mesure.** `create-panel.js` porte `visibleWhen(slopeRow, () => !isNatural())`,
  et le gabarit d'ouverture est en Atlas. Le journal de l'inventaire le dit
  lui-même : la ligne 30 y porte `"cache": true`. Mesurer un contrôle caché ne
  dit rien de son branchement. Précondition : cliquer la vignette « Classique ».

- **n° 70 à 73, l'appoint — quatre curseurs derrière un interrupteur ÉTEINT.**
  `fillLightIntensity(false, x)` rend **0 exactement**. C'est l'étalon que
  l'inventaire documente lui-même (« Intensité du flou » = 0,000 parent éteint,
  **9,815** parent allumé), et il ne l'a pas appliqué à cette rangée-là.

➡️ Livré : `scripts/sonde-lumiere-r21.mjs`, qui **nomme et vérifie la
précondition de chaque scénario**, recharge la page entre chacun, et journalise
l'état de la machine dans le même relevé que la mesure.

### Le palier machine est relevé DANS le relevé, pas supposé

`src/perf.js` peut **éteindre les ombres** (palier T3 « ESSENTIAL »), le grain et
descendre le `pixelRatio`. Mesurer « douceur des ombres » pendant que le palier a
coupé les ombres, c'est lire zéro et condamner un curseur vivant. La sonde
journalise donc à **chaque ligne** : `palier`, `ombres`, `ombresRes`,
`params.shadowMode`, `sun.castShadow`, `sun.shadow.mapSize`.

Relevé sur ce banc, **à chacune des lignes ci-dessus** :

```
palier 0 « PLEINE QUALITÉ » · ombres "dynamic" · ombresRes 1024
params.shadowMode "dynamic" · sun.castShadow true · shadow.mapSize 1024 × 1024
```

**Les ombres ne sont donc PAS éteintes par le palier** quand le n° 68 rend zéro.
⚠️ En revanche `palier.signaux.ecran` vaut **`[800, 600]`** et non la taille du
panneau : le palier se décide au boot, avant `setViewport`. Ça ne change rien
**ici** — le palier 0 est déjà le plus haut, il n'y a pas de dégradation à
craindre — mais c'est un chiffre plausible de la mauvaise grandeur, et il est
publié tel quel.

### Le plancher de bruit, et le témoin nul

Mouvement ambiant coupé (`params.animations = false`), la scène est reproductible
au bit près : **plancher 0,0000 / 0,0000** sur six relevés consécutifs.

⚠️ **ET IL NE TOMBE PAS AVEC LE MOUVEMENT AMBIANT SEUL.** Premier passage de la
sonde : **0,157 / 0,315**. La cause n'est pas la mer — elle est coupée — ce sont
**les tuiles encore en vol**. La sonde attend désormais que le quadtree n'ait
plus une seule tuile `loading` ou `empty` avant de mesurer, et le plancher
retombe à 0,0000. Sans ça, la moitié des ratios de ce rapport auraient été
divisés par un plancher soixante fois trop grand.

⚡ **Et un TÉMOIN NUL ouvre chaque campagne** : le protocole exact — mêmes
attentes, mêmes quatre relevés — **sans toucher un seul contrôle**. Il rend
**0,000 / 0,000**. C'est lui qui a tranché le cas du n° 68 (voir §④).

---

## ② CE QUI A ÉTÉ ÉCRIT, ET OÙ

Un seul module neuf, **`src/monde/lumiere-sphere.js`** — pur (ni DOM, ni three,
ni fetch), porteur de son propre texte GLSL. `globe.js` l'INJECTE ;
`test/lumiere-sphere.test.js` le **traduit et l'exécute** contre les fonctions JS
du module. ⛔ **Ni `soleil-monde.js` ni `planete-eclairee.js` n'ont été
touchés** — ils sont livrés, mesurés, et cette tâche se branche dessus.

| fichier | ce qui change |
|---|---|
| `src/monde/lumiere-sphere.js` | **neuf** — la loi de l'appoint, celle de la pente, la table des huit verdicts, et les conversions d'unité chiffrées |
| `src/globe.js` | 3 uniformes (`uAppointDir`, `uAppointIrr`, `uSlopeTint`), l'injection du GLSL, 2 blocs de fragment, `poserHabillage` + `retirerHabillage` |
| `src/monde/branchement-crop.js` | 5 champs de plus dans `CHAMPS_HABILLAGE` |
| `src/main.js` | 5 champs dans `contexteCrop` ; `lightCtx.surSphere` |
| `src/ui/light-panel.js` | « Douceur des ombres » **cachée** en mode sphère ; la note R18 « l'appoint ne se voit pas » **retirée** parce qu'elle est devenue fausse |
| `scripts/sonde-lumiere-r21.mjs` | **neuf** — la sonde à préconditions |
| `test/lumiere-sphere.test.js` | **neuf** — 27 tests |

---

## ③ ⚠️ LES CONVERSIONS D'UNITÉ, ÉCRITES, AVEC LEUR FACTEUR

Le brief compte **neuf occurrences** de ce défaut sur ce chantier. Voici les
quatre grandeurs que R21 déplace. **Elles valent toutes 1** — et un 1 non écrit
est un 1 non vérifié, donc chacune dit pourquoi.

| grandeur | départ | arrivée | facteur | la preuve |
|---|---|---|---|---|
| **azimut de l'appoint** | degrés, repère du socle | degrés, repère du globe | **1** | `placeFill` bâtit sa position avec `(cos az cos el, sin el, sin az cos el)` — **les trois mêmes termes que `placeSun`**. Le test ③a l'EXÉCUTE : un appoint d'**écart nul** rend, **au bit près**, la direction que `directionSoleilLocale` rend pour le soleil, sur quatre lieux. |
| **élévation de l'appoint** | degrés, **bornée [−10 ; 90]** par `fillDirection` | idem | **1** | ⚠️ la borne basse n'est pas cosmétique : à −10° la lampe éclaire **par-dessous**, et le test ③c le vérifie (`dot(L, haut) < 0`). C'est le comportement du socle. |
| **intensité** | `fillLight.intensity` | irradiance linéaire du nuanceur | **1** | ⚡ **MESURÉ, PAS DÉDUIT** : dans l'application vivante, `sun.intensity = 3,8` et `sun.color = #fff7e6` donnent `uSoleilIrr = (3,800 · 3,534 · 3,007)` — c'est **exactement `couleur_linéaire × intensité`** (linéaire de `#fff7e6` = 1 · 0,9301 · 0,7913). L'appoint entre par la même porte, `poserIrradiance`. Vérifié à l'arrivée : `#ffcf9a` à 0,6 pose `uAppointIrr = (0,600 · 0,374 · 0,194)`. |
| **couleur** | `#rrggbb` sRVB | linéaire | **la conversion de three**, pas une formule écrite ici | `Color.setStyle(hex, SRGBColorSpace)`. |
| **pente** | `1 − clamp(wN.y, 0, 1)` (socle) | `1 − clamp(dot(n, haut), 0, 1)` (globe) | **1** | même grandeur : un cosinus à la verticale **du lieu**, sans dimension. ⛔ **La faute évitée est chiffrée** — voir juste dessous. |

### ⛔ La faute que la pente aurait produite, chiffrée

Recopier `nMonde.y` au lieu de `dot(nMonde, haut)` était le geste naturel :
c'est *littéralement* ce que `terrain.js:959` écrit. Au lieu par défaut,
La Réunion, **lat −21,26°** :

```
haut = (0,7702 · −0,3626 · 0,5246)      →  haut.y est NÉGATIF
clamp(nMonde.y, 0, 1) = 0               sur un sol RIGOUREUSEMENT PLAT
slope = 1                               le MAXIMUM
```

➡️ **Tout l'hémisphère SUD aurait été peint en brun de versant, à plat.** Dans
l'hémisphère nord la faute est plus discrète et non moins fausse : à Annecy
(45,9°) elle rend **0,282** au lieu de 0. Le test ①d exécute les deux.

### ⚠️ Ce qui reste DIFFÉRENT entre les deux pentes, et il faut le dire

La loi est la même, **la finesse ne l'est pas**. Le socle tire `wN` de
`computeVertexNormals` sur sa grille (**~35,5 m** entre deux sommets pour
l'emprise relevée de 27 354 m) ; le globe tire `nMonde` d'une différence centrée
au pas `max(1/uTilePx, pasEmpreinte)`. **Une pente lue à un pas plus large est
plus douce**, et c'est le `smoothstep(0.3, 0.8, slope)` qui encaisse l'écart —
ce qui explique que le n° 30 rende **×6,0** le plancher là où l'appoint rend
×18 à ×99. **Ce n'est pas une conversion d'unité** (aucun facteur ne la
corrigerait), c'est une résolution : seul un pas égal l'annulerait.

---

## ④ LE N° 68, ET POURQUOI IL EST LE SEUL À MOURIR

Le brief annonce une conversion à faire :

> *« `sun.shadow.radius` est en unités-monde. Si tu le recopies tel quel côté
> globe, tu te trompes du rapport des deux échelles. »*

⛔ **NON, et deux fois.**

**a) L'unité n'est pas celle-là.** `main.js` pose
`renderer.shadowMap.type = THREE.VSMShadowMap`. Sous VSM, `shadow.radius` est le
rayon du flou gaussien appliqué à la **carte d'ombre**, exprimé en **texels de
cette carte** (1 024 × 1 024 ici, valeur donnée par le **palier machine**, pas
par un réglage). Ce n'est pas une longueur de scène : **il n'y a aucun rapport
d'échelle à appliquer**, et un portage « converti » aurait été faux dans les deux
sens.

**b) Il n'y a rien à ombrer.** Quatre constats indépendants :

1. `globe.js` ne contient **pas une seule occurrence** de `shadowmap` /
   `shadowMap` (compté : **0**). Le matériau de tuile est un `ShaderMaterial`
   nu : il ne peut ni couler ni recevoir d'ombre.
2. `visibiliteSurface({terreUnique: true, …}).socle` vaut **`false`**, et
   `terrain.mesh.visible` a été relevé à **`false`** dans l'application vivante.
3. Dans la scène du bloc : **42 objets visibles, 1 receveur, 1 casteur** — le
   casteur est la `DirectionalLight` elle-même, le receveur est un
   `ShadowMaterial`. **Zéro maillage casteur.**
4. ⚡ **Et la plus forte : la scène du bloc n'est plus rendue du tout.**
   `main.js` pose `passeSurface.enabled = false` dès que `fusionDesPasses`
   (`frontiereActive && terreUniqueBranchee`), et `postprocessing` saute une
   passe désactivée.

**Ce qu'on en fait :** le curseur est **caché en mode sphère**
(`visibleWhen` + `reglageAgit`, la table étant dans le module et exécutée par le
test ⑥a/⑥c). ⛔ **On ne le retire pas** : il pilote toujours le bloc plat quand
le bloc plat est dessiné, et il voyage dans les gabarits.

### ⚠️ Le chiffre que je publie contre moi

Sur **six mesures** du n° 68, **cinq** rendent 0,000 / 0,000 et **une** rend
**0,162 / 0,327**. Je publie les deux — leçon ① de `lecons-campagne-R.md`,
*« quand deux valeurs existent, publier les DEUX »*. Ce qui départage n'est pas
la majorité, c'est le §④ bis ci-dessous.

---

## ④ bis ⚡ L'APPOINT SUR LES PAROIS DU CROP — la ligne en attente, faite

R21 avait laissé les parois de côté et l'avait écrit : *« une ligne le jour où
c'est libre »*. C'est libre.

### CE QUI A ÉTÉ ÉCRIT — deux uniformes PARTAGÉS, pas deux jumeaux

⚡ **ET C'EST L'ARGUMENT DE P8 PRIS DANS L'AUTRE SENS.** P8 a démontré que le
relief et la paroi ne voient **pas** le même environnement — un `envMap` est posé
sur UN matériau, et `three` n'écrase `envMapIntensity` que sur ceux qui n'en ont
pas. D'où `uParoiCielIrr` / `uParoiSolIrr`, deux uniformes distincts.

⛔ **L'appoint n'est pas un environnement : c'est une LAMPE.** `fillLight` est une
`THREE.DirectionalLight` de la scène, sans `envMap` et sans ombre : elle éclaire
**tous** les matériaux avec la même irradiance, exactement comme `sun` — dont
`uSoleilIrr` est déjà partagé entre les tuiles et la paroi. La paroi reçoit donc
`this.uniforms.uAppointDir` et `this.uniforms.uAppointIrr`, **les mêmes objets**.
Lui fabriquer un `uParoiAppointIrr` aurait été **deux écritures d'une seule
grandeur**, et la paroi aurait pu diverger de la surface au premier réglage. Le
test ④a bis interdit ce jumeau par son nom.

⛔ **ET LA RÈGLE R22 EST RESPECTÉE** : `uCol` vient toujours de `uParoiCouleur`,
donc l'option 50 reste lue **sur le matériau**. Relevé à l'écran : `c06a44` — la
paroi vivante, pas le `#d8d4cc` de `params`. Le test le verrouille.

### LA MESURE — et l'instrument fait se désigner la paroi

⚠️ **LA PAROI EST UNE BANDE ÉTROITE : une moyenne sur l'image entière la noie.**
C'est le défaut ① de l'inventaire (« une moyenne de boîte annule un motif fin »),
pris par l'autre bout — ici c'est la SURFACE de l'objet mesuré qui est petite.

⚡ **La parade : on ne cherche pas la paroi, on la fait se désigner.** Deux images
au même instant, même page, appoint allumé dans les deux ; dans la seconde,
l'uniforme d'appoint **de la seule paroi** est remplacé par un vecteur nul privé
(le code d'avant, au bit près, sans recharger ni recompiler). **Tout pixel qui
diffère est un pixel de paroi, par construction.** Livré :
`scripts/sonde-paroi-r21bis.mjs`, pleine résolution **1 280 × 800**.

| état | pixels changés | part de l'image | écart moyen **sur ces pixels** | sur l'image entière | pire |
|---|---|---|---|---|---|
| **témoin, appoint ÉTEINT** | **0** | 0,000 % | — | 0,0000 / grad 0,0000 | 0 |
| appoint à **0,6** (le défaut) | **39 799** | 3,89 % | **14,78 / 255** | 0,5781 / grad 0,1258 | 73 |
| appoint à **3** (le maximum) | **55 591** | 5,43 % | **36,95 / 255** | 2,0062 / grad 0,3050 | 268 |

⚡ **LE TÉMOIN À ZÉRO PIXEL EST LA MOITIÉ DE LA MESURE.** Appoint éteint, la même
bascule ne change **pas un seul pixel sur 1 024 000** : l'instrument ne fabrique
pas sa propre différence. Et l'aller-retour A/C rend **0 pixel** dans les trois
cas — la bascule est réversible au bit près.

⚠️ **PALIER RELEVÉ DANS LE MÊME RELEVÉ**, comme demandé : `palier 0 « PLEINE
QUALITÉ », ombres "dynamic" 1024², pixelRatio 1, canevas 1280 × 800`. Et
`uAppointIrr` global et paroi tenus côte à côte dans le journal : `[3 · 1,8719 ·
0,9694]` des deux côtés — **le partage est vérifié à l'exécution**, pas seulement
dans le source.

⚠️ **UNE RÉSERVE SUR LA BOÎTE, ET JE LA PUBLIE.** La boîte englobante des pixels
changés vaut `[278, 28, 991, 579]` — plus haute que la paroi elle-même. La
profondeur de champ est active au palier 0 (`dof: true`) : elle **étale** une
partie du changement au-delà des pixels de paroi. Le compte de 55 591 est donc
« les pixels que la correction change », pas « les pixels de paroi » au sens
strict. La conclusion ne bouge pas — 0 contre 55 591 —, mais le nombre est un
majorant.

---

## ④ ter ⚡ LE BANC A UN TRANSITOIRE, ET IL A FRAPPÉ LE TÉMOIN NUL

**C'est la trouvaille d'instrument de cette tâche, et elle vaut plus que six des
huit verdicts.**

Un écart d'environ **0,17 de moyenne et 0,33 de gradient** apparaît **sporadiquement**,
sur **une mesure sur douze environ**, et il est **indépendant du contrôle
mesuré** — il a frappé successivement :

| où | quand | moy / grad | valeur basse | `dRetour` |
|---|---|---|---|---|
| **n° 68** « Douceur des ombres » | campagne 2 | 0,162 / 0,327 | **0,000 / 0,000** | **0 / 0** |
| **n° 73** « Couleur », état AVANT (transport coupé) | campagne A/B | 0,191 / 0,385 | **0,000 / 0,000** | **0 / 0** |
| ⚡ **le TÉMOIN NUL** — aucun contrôle touché | campagne de répétition, tour 3 | **0,164 / 0,332** | **0,000 / 0,000** | **0 / 0** |

⚡ **La troisième ligne clôt le débat.** Le témoin nul rejoue le protocole exact
— mêmes attentes, mêmes quatre relevés — **sans toucher un seul contrôle**. Il a
quand même rendu 0,164 / 0,332. **Ce n'est donc aucun des curseurs : c'est le
banc.**

**La signature est constante et elle est reconnaissable :**
- amplitude **0,16 à 0,19** de moyenne, **0,33 à 0,39** de gradient ;
- **valeur basse toujours exactement 0,000** (une des trois paires est identique
  au bit près) ;
- **`dRetour` toujours 0** : l'image de départ et celle d'arrivée sont
  identiques au bit près, donc **l'état revient**.

**Ce que j'ai éliminé, avec la lecture qui l'élimine :**
- ⛔ **la rotation propre du globe** (~1,88–2 °/s après 3 s, que le brief
  signale) : elle est bornée à `mode === 'orbital'` **et** avancée par `dtAmb`,
  qui vaut 0 quand `params.animations` est faux. Nous sommes en `surface`, et
  les animations sont coupées ;
- ⛔ **le mouvement ambiant** (mer, sillages) : même `dtAmb` ;
- ⛔ **les tuiles en vol** : la sonde attend `0` tuile `loading` ou `empty` ;
- ⛔ **un geste d'interface** : le témoin nul n'en fait aucun.

⛔ **LA CAUSE N'EST PAS IDENTIFIÉE, ET JE NE L'INVENTE PAS.** C'est exactement
le cas du « plancher de bruit de 8,97 » de `lecons-campagne-R.md` §④ — *« quelque
chose d'autre bouge dans la scène et n'a pas été identifié »*. **Tâche à
ouvrir.**

### ⚠️ CE QUE ÇA IMPOSE À LA LECTURE DE TOUT CE RAPPORT

➡️ **Un relevé UNIQUE au-dessous de ~0,19 / ~0,39 ne prouve rien**, dans un sens
comme dans l'autre. Deux verdicts de ce rapport tombent dans cette zone et ne
sont donc PAS établis par leur chiffre, mais par leur **reproductibilité** :

| réglage | ce qui l'établit |
|---|---|
| **n° 68**, sans objet | **0,000 / 0,000 sur 5 mesures sur 6** — et surtout **quatre constats de code** qui ne dépendent d'aucun banc |
| **n° 30**, branché | **0,1191 · 0,1191 · 0,1197 · 0,1199 · 0,1191** de moyenne et **0,1537 · 0,1543 · 0,1534 · 0,1542 · 0,1548** de gradient sur **cinq campagnes indépendantes** — reproduit à la **troisième décimale**, avec une valeur basse **jamais nulle** (0,058–0,059). ⚡ **Un transitoire ne se reproduit pas à 0,001 près cinq fois.** Et son AVANT vaut **0,000 / 0,000**. |

Les six autres sont au-dessus de la zone, ou reproduits : le n° 73 rend
**0,5153 · 0,5136 · 0,5140 · 0,514** sur quatre campagnes, le n° 26 rend
**1,390 · 1,393 · 1,404**.

---

## ④ quater ⚡ LA CHASSE AU TRANSITOIRE — R21 bis

> **Le coordinateur :** *« Ne te contente pas d'une corrélation. Reproduis le
> transitoire à volonté avant de nommer sa cause. Si tu n'y arrives pas, dis-le :
> "non reproductible à volonté" est un résultat, pas un échec. »*

Livré : `scripts/sonde-transitoire-r21bis.mjs`. ⚡ **Il ne mesure pas que
l'image, il photographie l'ÉTAT** — la pose de la caméra au millionième (le
grand oubli de R21), le palier machine et les six réglages qu'il commande, le
rapport de pixels, la taille du canevas, l'état activé/désactivé de **chaque
passe du compositeur**, le compte de tuiles par état, l'heure, le ton, la
bannière de performance, et vingt-six uniformes du globe. Quand l'écart tombe,
le banc **différencie** les deux états et nomme ce qui a bougé.

### ⛔ CE QUE LES DEUX PREMIÈRES CHASSES ONT ÉLIMINÉ

| chasse | protocole | passes | écarts |
|---|---|---|---|
| **1 — `--suivi`** | une seule page, **aucun rechargement, aucun geste**, N relevés du même état | **90** | **0** |
| **2 — `--recharge`** | **rechargement à chaque passe**, puis le protocole du témoin nul de R21 (4 relevés espacés) | **24** | **0** |

⚡ **La chasse 1 est le résultat le plus tranchant des deux, et elle est
définitive dans son périmètre :** `moy = 0` et `grad = 0` **à chacune des
90 lignes**, sur près de trois minutes de scène vivante. **Le transitoire
n'existe pas dans une page qui vit.** Cela élimine d'un coup, et par la mesure et
non par la lecture, tout ce qui tourne en régime permanent : le grain, le ton,
l'exposition, un palier qui oscillerait, une dérive de la caméra, un
rafraîchissement périodique.

⚠️ **La chasse 2 ne prouve rien, et il faut le dire.** Zéro sur 24 avec un
transitoire à ~1 sur 13 a **15 % de chances d'arriver par hasard** — c'est trop
pour conclure. Elle a en revanche livré un fait que personne n'avait vu.

### ⛔ CE QUE LA CHASSE 2 A TROUVÉ SANS LE CHERCHER : LA PORTE N'EST PAS UNE PORTE

Le journal, à **chacune des 24 passes**, ligne pour ligne :

```
porte=EXPIREE en 45 002 ms, 4 tuile(s) restante(s)
```

⛔ **L'ATTENTE « PLUS AUCUNE TUILE EN VOL » N'ABOUTIT JAMAIS.** Elle expire à son
délai de 45 s, à **chaque chargement, sans exception**, et il reste en
permanence **4 tuiles** — jusqu'à **9** — dans l'état `loading` ou `empty`.

⚠️ **C'est un garde-fou que R21 a ajouté en croyant fermer une porte, et qui est
en réalité une temporisation de 45 secondes déguisée.** Il a bien fait tomber le
plancher de bruit de 0,157 à 0,0000 — mais **pas pour la raison écrite**. Ce
n'est pas « la file est vide », c'est « on a attendu trois quarts de minute ».
La conclusion de R21 sur ce point est donc **juste par accident**, et sa raison
est **retirée**.

➡️ Corollaire immédiat : **la scène n'est jamais quiescente au sens de cette
mesure.** Un banc qui attend la quiescence attendra toujours son délai.

---

### ⚡ LA CHASSE 3 : LE BRAS SANS LA PORTE — et ce qui bouge tout seul

`--sans-porte` retire l'attente de 45 s : **30 passes, 0 écart.** Et le banc, qui
relève désormais le diff d'état **à chaque passe et pas seulement sur écart**,
donne le fait brut :

```
tuiles = 112/0/4   (total / loading / empty)   à chacun des 4 relevés
ETAT BOUGE : memo : 298 -> 293 ; memo : 293 -> 318 ; memo : 318 -> 307
```

⛔ **RIEN NE BOUGE, SAUF LE TAS JAVASCRIPT.** Ni la caméra, ni le palier, ni le
rapport de pixels, ni les passes du compositeur, ni les 26 uniformes, ni le
compte de tuiles. Et les 4 tuiles « restantes » sont **`empty`, jamais
`loading`** : ce sont des places vides que rien ne remplira, pas un chargement en
cours. **La porte de R21 attendait une condition qui ne peut pas arriver.**

**Bilan des trois chasses : 144 passes, 0 transitoire, sur machine oisive.**

### ⚡ LE BRAS QUI ACCUSE — ET QUI DISCULPE : `--charge`

Les trois chasses tournaient sur une machine **oisive**. Les campagnes de R21,
elles, tournaient pendant que la même machine exécutait `npm test`, des éditions
de sources et d'autres sondes. Et le dépôt a un **gouverneur** (`src/perf.js`)
qui descend d'un palier après **2,5 s sous 30 images/s** et remonte après
**12 s au-dessus de 55** — c'est l'hypothèse ① du coordinateur, et la bannière
« PERFORMANCE — … » qu'il a vue est son `announce()`.

⛔ **ON NE L'APPELLE PAS À LA MAIN** — `setTier` n'est pas exposé, et prouver
qu'un interne change l'image ne prouverait pas que le gouverneur se déclenche.
On ralentit le processeur par CDP (`Emulation.setCPUThrottlingRate`), on relâche,
et on regarde. ⚠️ **Et on MESURE la cadence pendant le ralentissement** : sans ça,
un « palier inchangé » à 45 i/s serait un faux négatif — la première tentative,
à ×8, laissait la page à une cadence que le gouverneur n'a aucune raison de
sanctionner, et elle n'a donc rien testé.

| ralentissement | cadence mesurée | palier atteint | **écart d'image** | **et il revient ?** |
|---|---|---|---|---|
| ×8 | *(non mesurée au 1ᵉʳ essai)* | aucun | 0,000 / 0,000 | — |
| **×20** | 57,4 → **14,0 i/s** | LIGHT | **0,038 / 0,038** — 0,5 % des pixels | ⛔ **non** : retour 0,0388 |
| **×60** | 57,5 → **0,44 i/s** | ESSENTIAL | **1,468 / 2,643** — 78,5 % des pixels | ⛔ **non** : retour 0,0378 |

**3 déclenchements sur 3 passes, aux deux taux : le gouverneur EST reproductible
à volonté.** Le diff d'état le nomme sans ambiguïté — à ×60 :

```
pixelRatio        1 -> 0.85
canvas            [1280,800] -> [1088,680]
params.grain      0.26 -> 0
params.shadowMode "dynamic" -> "off"
sun.cast          true -> false
uni.uMppFacteur   47.179404 -> 55.505182
banniere          null -> "PERFORMANCE — ESSENTIAL MODE"
```

### ⛔ ET C'EST PRÉCISÉMENT CE QUI L'INNOCENTE — DEUX FOIS

⚠️ **J'ai cru tenir la cause. La mesure l'a refusée, et c'est exactement le piège
que le coordinateur m'avait décrit.**

**① L'AMPLITUDE NE COLLE PAS.** Le gouverneur ne peut produire que deux sauts, et
le transitoire n'est ni l'un ni l'autre :

```
un cran (LIGHT)        0,038 / 0,038
LE TRANSITOIRE         0,162 à 0,191  /  0,326 à 0,385     ← quatre fois trop grand
le plancher (ESSENTIAL) 1,468 / 2,643                       ← huit fois trop grand
```

**② IL NE REVIENT PAS, ET LE TRANSITOIRE SI.** `UP_SUSTAIN` vaut **12 s par
cran** : une descente à ESSENTIAL met **36 s** à se défaire, et après 45 s
d'attente il restait encore **0,038** d'écart (le `shadowMode` pas encore rendu).
Or la signature du transitoire est un **`dRetour` de 0 exactement**, entre deux
relevés espacés de **2,7 s**. ⛔ **Le gouverneur ne peut pas produire un
aller-retour bit à bit en 2,7 secondes.** C'est arithmétique, pas une opinion.

➡️ **L'hypothèse ① du coordinateur est RÉFUTÉE PAR LA MESURE**, et pas écartée
par lecture. Elle a coûté quatre bancs — et elle valait le prix : le gouverneur
change bel et bien l'image, personne ne l'avait chiffré, et **on sait maintenant
ce qu'il coûte** (0,038 pour un cran, 1,468 pour le plancher).

⚠️ **Les deux autres pistes du coordinateur, avec ce que j'ai relevé :**
- **② la cuisson de l'analyse (~464 ms)** — non départagée. Elle ne peut pas
  être testée par ce banc : `uAnalysisOn` valait 1 aux 144 passes, l'analyse
  était déjà cuite avant le premier relevé.
- **③ `signaux.ecran` dégénéré** — ⛔ **pas reproduit ici** : la sonde relève
  `[800, 600]`, pas `[0, 0]`, et le palier de démarrage vaut **0** aux quatre
  bancs. Un écran dégénéré aurait fait démarrer bas puis remonter ; ça n'est
  arrivé à aucune passe. **Ça n'exclut pas le défaut dans le panneau navigateur
  du coordinateur — ça dit qu'il n'est pas la cause de CE transitoire-ci.**

### ⛔ LE VERDICT, ET C'EST UN RÉSULTAT

**Le transitoire n'est PAS reproductible à volonté.** 144 passes sur machine
oisive, trois protocoles, plus deux bras de charge contrôlée : il ne s'est pas
montré une seule fois. Sa cause **reste non identifiée** — mais la liste des
suspects s'est réduite, et cette fois **par la mesure** :

| écarté | par quoi |
|---|---|
| tout ce qui tourne en régime (grain, ton, exposition, dérive de caméra, palier qui oscillerait) | chasse 1 : **90 passes, `moy = 0` et `grad = 0` à chaque ligne** |
| le rechargement seul | chasses 2 et 3 : **54 passes, 0 écart** |
| **le gouverneur de performance** | chasses 5 et 6 : **amplitude 0,038 ou 1,468, jamais 0,17 — et il met 12 à 36 s à revenir** |
| l'écran dégénéré au démarrage | `signaux.ecran = [800, 600]`, palier 0 aux quatre bancs |

➡️ **Ce qui reste** : quelque chose qui dure **moins de 2,7 s**, revient **au bit
près**, touche l'image **globalement** (le gradient monte deux fois plus que la
moyenne), et n'apparaît **que sous charge extérieure**. Les voiles de chargement
(`voile-whiteout`, `voile-loading`) et une repose de la chaîne du crop sont les
deux familles qui restent, et **aucune n'est mesurée** : elles ne sont pas dans
la photographie d'état de ce banc. **C'est la première chose à instrumenter au
prochain tour.**

---

## ④ quinquies ⛔ LE SEUIL DE 0,06 DE L'INVENTAIRE EST SOUS LE BRUIT — ET VOICI OÙ

> **Le coordinateur :** *« Si un ✅ sur douze est du bruit, l'inventaire des
> 127 options est faux quelque part et personne ne sait où. Si tu confirmes que
> le seuil de 0,06 est sous le bruit, dis-le franchement. »*

**Je le confirme, et je peux dire où.** Le barème de `inventaire-studio-2.md`
déclare ✅ dès **`moy ≥ 0,06` ou `grad ≥ 0,12`**. Le transitoire vaut **0,162 à
0,191 de moyenne et 0,326 à 0,385 de gradient**. ⛔ **Le seuil est donc environ
trois fois sous l'amplitude du bruit qu'on vient de nommer.**

⚠️ **MAIS ÇA NE REND PAS L'INVENTAIRE FAUX PARTOUT, ET LA DISTINCTION EST
ARITHMÉTIQUE.** Un transitoire ne peut qu'**ajouter** de l'écart : il peut donc
transformer un ⛔ en faux ✅, **jamais l'inverse**.

| verdict | exposé au transitoire ? |
|---|---|
| **⛔ (47)** | ⛔ **NON.** La règle exige `moy < 0,005` **et** `grad < 0,01` **et** aucun uniforme touché. Un transitoire pousse vers le haut : il ne peut pas fabriquer un ⛔. *(Les faux ⛔ de ce chantier viennent des défauts de PROTOCOLE du §①, pas du bruit.)* |
| **✅ (72)** | ⚠️ **OUI, pour ceux dont les DEUX grandeurs sont sous le transitoire.** |

### LES SEPT LIGNES CONCERNÉES, NOMMÉES

Comptées sur les 127 lignes chiffrées de l'inventaire : **7 verdicts ✅ sur 72**
ont **à la fois** `moy < 0,19` **et** `grad < 0,39`, c'est-à-dire tiennent
entièrement dans la bande du transitoire.

| n° | libellé | moy | grad |
|---|---|---|---|
| 98 | Réfraction | 0,081 | 0,138 |
| 36 | Couleurs sèches | 0,122 | 0,089 |
| 91 | Hauteur des vagues | 0,140 | 0,236 |
| **120** | **Vitesse du suivi** | **0,162** | **0,326** |
| **11** | **Opacité de l'eau** | **0,178** | **0,355** |
| **56** | **Échelle du détail** | **0,184** | **0,318** |
| **24** | **Échelle fine** | **0,188** | **0,320** |

⚡ **LES QUATRE DERNIÈRES SONT EN GRAS PARCE QU'ELLES SONT LA SIGNATURE, PAS
SEULEMENT LA BANDE.** Le transitoire mesuré vaut **0,162 / 0,327** (n° 68),
**0,164 / 0,332** (témoin nul), **0,191 / 0,385** (n° 73 avant). La ligne 120 —
**0,162 / 0,326** — est ce chiffre-là **à la troisième décimale**.

⛔ **ET JE M'ARRÊTE LÀ, PARCE QUE C'EST UNE CORRÉLATION.** Je ne déclare aucune
de ces sept lignes fausse : je dis que **leur chiffre ne les prouve pas**, et
qu'il faut les re-mesurer en répétition. Deux d'entre elles ont même des raisons
indépendantes d'être vraies :
- **91 « Hauteur des vagues » est l'ÉTALON du barème** — et R18 l'a corroborée
  par **deux captures côte à côte** montrant les crêtes, pas par son chiffre.
  ⚠️ Le point d'étalonnage du seuil tombe donc lui-même dans la bande du bruit,
  et il n'a survécu que parce qu'une IMAGE l'a confirmé.
- **24 et 56** sont deux des trois options que R18 a **sauvées d'un faux ⛔** en
  découvrant qu'elles ne commitent qu'au relâchement — et elles **régénèrent le
  terrain**, donc elles agissent forcément. **Leurs valeurs (0,188 et 0,184) ne
  le démontrent pourtant pas** : elles sont indiscernables du transitoire.

➡️ **Ce qu'il faut retenir pour la suite du chantier, et c'est la phrase la plus
utile de ce rapport :** ⛔ **un relevé unique entre 0,06 et 0,19 ne décide de
rien.** Au-dessus, le verdict tient ; en dessous de 0,005/0,01, le ⛔ tient. **Ce
qui est entre les deux exige une répétition** — trois campagnes, et on regarde si
le chiffre se reproduit à la troisième décimale (le n° 30 de R21 le fait sur
cinq) ou s'il saute (le n° 68 : 0,000 cinq fois, 0,162 une).

---

## ⑤ CE QUE J'AI CRU, PUIS RÉFUTÉ

**C'est la section la plus utile du rapport, et elle a huit entrées.**

### ① J'ai cru que le brief avait raison sur l'unité de `shadow.radius`

Il l'annonce comme le piège central de la tâche : *« une hauteur de lampe, un
rayon d'ombre, un écart azimutal : chacun a une unité, et personne ne la
vérifie »*, avec un rapport d'échelle `TERRAIN_SIZE` / `R_GLOBE` à appliquer.
J'ai commencé par chercher ce rapport. **Il n'existe pas** : sous
`VSMShadowMap`, `radius` est en texels de carte d'ombre. **Le piège annoncé était
lui-même une erreur d'unité** — et c'est la meilleure illustration possible de
la classe de défaut que le brief dénonce.

### ② J'ai cru que le n° 26 était mort, parce que l'inventaire le dit

Il est ⛔ avec `0.000 / 0.000` et un motif écrit (« écrit les uniformes
d'ombrage, donc l'habillage »). J'allais le brancher. En lisant `applyAutoShade`
j'ai vu que **trois de ses quatre clés atteignaient déjà la sphère** —
`mapTint` → `uAlbedoTeinte` (relevé **0,68 des deux côtés**), `heightContrast`
(**2,5**), `heightPivot` (**0,65**) — par `applyStyle` → `terrain.mapUniforms` →
`contexteCrop` → `poserHabillage`. **Le réglage n'était pas mort : c'est le
GESTE de mesure qui ne pouvait rien voir.** Aucune ligne de code n'a été écrite
pour lui ; seule sa **quatrième** clé, `slopeTint`, manquait — et c'est le n° 30.
Après R21, les quatre voyagent.

### ③ J'ai cru que le n° 30 était mort *et visible*. Il était mort et **caché**

L'exigence n° 2 du brief (« aucun curseur mort visible ») était **déjà tenue**
pour lui, par accident : `visibleWhen(slopeRow, () => !isNatural())` et un
gabarit d'ouverture en Atlas. J'aurais pu « réparer l'interface » d'un curseur
qui n'était pas affiché. Le vrai trou était ailleurs : **dès qu'on passe en
Classique, la ligne apparaît et ne fait rien.** C'est ce cas-là qui est corrigé.

### ④ J'ai cru que `params.animations = false` suffisait à figer la scène

L'inventaire l'écrit : *« le plancher de bruit tombe de 0,3693 à 0,0000 sur six
relevés consécutifs »*. Ma première campagne a rendu **0,157 / 0,315**. J'allais
publier des ratios divisés par ce plancher-là — soit **×0,8 pour le n° 30**,
c'est-à-dire « sous le bruit », c'est-à-dire un **faux constat de mort** pour un
réglage qui marche. La cause n'était pas la mer mais **les tuiles encore en
vol** : la sonde attend maintenant que le quadtree n'ait plus de tuile `loading`
ni `empty`. **Un plancher de bruit trop haut ne rate pas un effet : il en
invente l'absence.**

### ⑤ J'ai cru qu'un témoin nul mesuré UNE fois suffisait

Je l'ai ajouté après le 0,162 du n° 68, et il a rendu 0,000 / 0,000 deux fois de
suite. J'ai failli en conclure « le banc est propre, le 0,162 était une dérive »
— **une conclusion juste, tirée d'une preuve insuffisante**. En le répétant trois
fois de plus, **il a fini par rendre 0,164 / 0,332 lui-même**. Sans cette
répétition, j'aurais publié un banc « à plancher nul » alors qu'il porte un
transitoire d'amplitude **0,17**, c'est-à-dire **plus grand que le signal du
n° 30** que je viens de brancher. ⚡ **Un témoin qui passe une fois ne dit rien
d'un défaut qui frappe une fois sur douze.**

### ⑥ J'ai cru que la porte « plus aucune tuile en vol » fermait quelque chose

Je l'avais ajoutée pour faire tomber le plancher de bruit de 0,157 à 0,0000, et
elle l'a fait. J'ai écrit que la cause était « les tuiles encore en vol ».
⛔ **La chasse 2 a journalisé la porte : elle EXPIRE à ses 45 secondes, à chaque
chargement, sans une seule exception, et il reste en permanence 4 à 9 tuiles.**
Elles sont `empty`, jamais `loading` : des places vides que rien ne remplira.
**La porte attendait une condition qui ne peut pas arriver** — c'était une
temporisation de 45 s déguisée en garde-fou. Le plancher tombe bien, mais **pas
pour la raison que j'avais écrite**, et cette raison est retirée.

### ⑦ J'ai cru tenir le transitoire avec le gouverneur de performance

Tout collait : il change l'image d'un coup, il revient, il est sporadique, il
dépend de la charge — et le coordinateur l'avait mis en tête de ses pistes. Je
l'ai reproduit **3 fois sur 3**, la bannière et le diff d'état à l'appui. Puis
j'ai mesuré l'amplitude : **0,038 pour un cran, 1,468 pour le plancher**, quand
le transitoire vaut **0,17**. Et j'ai regardé le retour : `UP_SUSTAIN` vaut
**12 s par cran**, quand la signature du transitoire est un aller-retour bit à
bit en **2,7 s**. ⛔ **Deux réfutations indépendantes, toutes deux chiffrées.**
Si je m'étais arrêté à la corrélation, j'aurais nommé une cause fausse et fermé
le dossier — c'est exactement ce contre quoi le coordinateur m'avait prévenu, et
c'est arrivé.

### ⑧ J'ai cru pouvoir gater l'ombrage des pentes sur `uAnalysisOn`

C'était le miroir apparemment exact de `uColorMode == 1` côté globe — le
nuanceur du globe n'a pas de `uColorMode`, et `contexteCrop` ne passe l'analyse
que hors du mode Classique. **Faux, et le défaut aurait été intermittent** : en
mode Atlas, `uAnalysisOn` reste à **0** pendant les **~464 ms** où le travailleur
cuit l'analyse (chiffre de `terrain.js`, pour La Réunion sur un retour de zoom),
alors qu'`uColorMode` vaut 1 dès le premier instant. Le brun des versants aurait
**clignoté** à chaque changement de lieu. La garde est donc portée par
`contexteCrop`, qui lit `uColorMode` — l'uniforme même que `setColorMode` écrit.

---

## ⑥ CE QUE R21 N'A PAS FAIT, ET IL FAUT LE SAVOIR

- ✅ **~~Les PAROIS du crop n'ont pas l'appoint~~ — FAIT au tour R21 bis**, le
  périmètre étant libéré par R22. Voir §④ bis : 55 591 pixels contre 0 au
  témoin. C'était bien une ligne.
- ⚠️ **L'ombrage des pentes agit sur TOUTE la planète, pas seulement sur le
  crop.** C'est délibéré et conforme à D15 (« rendre la planète éclairée et
  reliefée **partout** ») : la pente ne lit **aucune** donnée cuite sur
  l'emprise du crop, seulement `nMonde` et `haut`, tous deux locaux. Et
  `retirerHabillage` remet `uSlopeTint` à 0 à la mort du crop — c'est la garde
  contre la fuite d'`uContourInterval` (la planète entière restée à 250 m).
- ⚠️ **Un seul lieu, un seul zoom, une seule machine.** Tous les chiffres de ce
  rapport valent pour La Réunion, z12, `altM = 18 201`, sur une RTX 3080. Un
  autre lieu (relief plus doux) donnerait un n° 30 plus faible ; c'est
  précisément l'objet du §③, « ce qui reste différent ».

---

## ⑦ LES TESTS

- **R21** — `npm test` : **4 449 · 0 échec** (base 4 422), **+27** dans
  `test/lumiere-sphere.test.js` ; `audit:tests` **230 = 230**.
- **R21 bis**, après fusion de `regroupement` — `npm test` : **4 573 · 0 échec**
  (base à battre 4 572), **+1** : `④a bis`, qui verrouille l'appoint des parois,
  le PARTAGE des deux uniformes (et interdit le jumeau `uParoiAppoint` par son
  nom), et le fait que l'option 50 reste lue sur le matériau (règle R22).
  `audit:tests` **237 = 237**, aucun écart.
- ⚠️ **La collision R21/R22 signalée par le coordinateur est vérifiée de mon
  côté** : la garde ⑨ de `test/grille-crop.test.js` extrait le corps de
  `poserHabillage` et le compare à la table factice. Je n'ai ajouté aucun
  uniforme à `this.uniforms` ce tour-ci — la paroi ne fait que LIRE ceux de R21
  —, donc elle n'avait rien à me rappeler.
- Quatre fichiers existants ont été touchés, et seulement là où la forme du
  nuanceur a changé : `crop-aerien` et `crop-eclairage` ancraient l'ordre des
  étapes sur `vec3 colBloc = col * irradianceCrop(`, devenu
  `vec3 irrBloc = irradianceCrop(…) + irradianceAppoint(…)`. **L'ancre a changé
  de forme, pas de sens** : c'est toujours l'étape « la lumière multiplie », et
  elle doit toujours venir en dernier. `crop-habillage` et `crop-naturel`
  portent le postiche d'uniformes du globe et reçoivent les trois neufs — sans
  eux, ⑨h ne verrait pas un `retirerHabillage` qui les oublierait.
- ⚠️ **Tout a été écrit en LF** (scripts d'édition en `newline='\n'`, vérifié
  octet par octet : `0` CR dans chaque fichier touché).

---

## ⑧ LES COMMITS, SUR `lumiere-crop`

1. **`75b8a5c` — R21 étape 1 : l'appoint et l'ombrage des pentes arrivent sur la
   sphère.** Le module pur `monde/lumiere-sphere.js`, les trois uniformes, les
   deux blocs de nuanceur, les cinq champs de `contexteCrop` et de
   `CHAMPS_HABILLAGE`, les 27 tests, et les conversions d'unité chiffrées.
2. **`88ff56d` — R21 étape 2 : le n° 68 est CACHÉ en mode sphère, et la sonde à
   préconditions.** Les quatre constats qui tuent le n° 68, la réfutation de
   l'unité annoncée par le brief, `scripts/sonde-lumiere-r21.mjs`, et les trois
   corrections d'instrument (palier machine journalisé, attente des tuiles,
   témoin nul).
3. **`16353de` — R21 étape 3 : le rapport, l'avant/après sous le même protocole,
   et un transitoire de banc que le témoin nul a fini par attraper.**
4. **R21 bis — l'appoint sur les parois, et la chasse au transitoire.** La paroi
   reçoit les deux uniformes PARTAGÉS de l'appoint (55 591 pixels contre 0 au
   témoin) ; `scripts/sonde-paroi-r21bis.mjs` et
   `scripts/sonde-transitoire-r21bis.mjs` ; le gouverneur reproduit à volonté
   puis **réfuté par l'amplitude et par le temps de retour** ; les sept lignes de
   l'inventaire dont le chiffre ne prouve rien, nommées.

---

## ⑨ CE QUI RESTE OUVERT

- ⛔ **Le transitoire n'a toujours pas de cause identifiée, mais la chasse a
  réduit la liste PAR LA MESURE** (§④ quater). **Non reproductible à volonté** :
  144 passes sur machine oisive, trois protocoles, deux bras de charge contrôlée.
  ➡️ **Ce qu'il reste à instrumenter au prochain tour** : les voiles de
  chargement (`voile-whiteout`, `voile-loading`) et une repose de la chaîne du
  crop — les deux seules familles qui durent moins de 2,7 s et reviennent, et les
  deux qui **ne sont pas** dans la photographie d'état de la sonde.
- ⛔ **La porte « plus aucune tuile en vol » est à réparer dans les deux sondes
  qui la portent** (`sonde-lumiere-r21.mjs`, `sonde-transitoire-r21bis.mjs`).
  Elle expire toujours : compter les `loading` **sans** les `empty`, et assumer
  la temporisation au lieu de la déguiser. ⚠️ **Je ne l'ai PAS corrigée dans ce
  tour, et c'est délibéré** : la changer maintenant rendrait irreproductibles
  tous les chiffres publiés avec elle. Elle se corrige au tour suivant, avec une
  re-mesure du plancher.
- ⛔ **Les sept lignes du §④ quinquies** — à re-mesurer en répétition avant de
  s'appuyer dessus. Et **le coût du gouverneur est désormais chiffré** (0,038 un
  cran, 1,468 le plancher) : c'est un chiffre que personne n'avait.
- ⚠️ **Les 39 autres réglages ⛔ de l'inventaire.** R21 en traite huit. Vu ce que
  le protocole a rendu ici — **trois zéros sur huit n'étaient pas des verdicts** —
  il est prudent de supposer que **le compte de 47 est surévalué**, et de
  re-mesurer chaque rangée avec sa précondition avant de coder quoi que ce soit.
