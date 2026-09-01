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
| **68** | Douceur des ombres | ⛔ **sans objet sur une sphère** — curseur **caché** en mode sphère | **0,000 / 0,000 sur 5 mesures sur 6** (la sixième est le transitoire du §④ bis), et **quatre constats de code indépendants**, dont `passeSurface.enabled = false` |
| **69** | Appoint (interrupteur) | ✅ **branché** | **moy 0,467 · grad 0,236** — ×23,3 le plancher |
| **70** | Intensité | ✅ **branché** | **moy 1,984 · grad 0,787** — ×99,2 (valeur basse du triplet : 0,466 / 0,236) |
| **71** | Écart au soleil | ✅ **branché** | **moy 0,363 · grad 0,279** — ×18,1 |
| **72** | Hauteur | ✅ **branché** | **moy 0,641 · grad 0,574** — ×32,1 |
| **73** | Couleur | ✅ **branché** | **moy 0,514 · grad 0,153** — ×25,7 |
| **26** | Ombrage auto | ✅ **il l'était déjà** — le ⛔ de l'inventaire est un **défaut de protocole** | **moy 1,404 · grad 0,558** — ×70,2, mesuré avec le bon geste |
| **30** | Ombrage des pentes | ✅ **branché** | **moy 0,119 · grad 0,154** — ×6,0, **reproduit à 0,001 près sur cinq campagnes**, AVANT = 0,000 / 0,000 |

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

## ④ bis ⚡ LE BANC A UN TRANSITOIRE, ET IL A FRAPPÉ LE TÉMOIN NUL

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

## ⑤ CE QUE J'AI CRU, PUIS RÉFUTÉ

**C'est la section la plus utile du rapport, et elle a six entrées.**

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

### ⑥ J'ai cru pouvoir gater l'ombrage des pentes sur `uAnalysisOn`

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

- ⛔ **Les PAROIS du crop n'ont pas l'appoint.** Elles ont leur propre nuanceur
  (`globe.js`, le matériau des parois), qui appelle `irradianceCrop` avec
  `uParoiCielIrr` / `uParoiSolIrr`. Un appoint fort les laisse **un cran plus
  sombres que la surface** — visible sur `.banc/R21/apres-70-Intensité.png`.
  **Non touché exprès** : le périmètre des parois appartient à un chantier
  parallèle (`C:\Dev\wt-par`), et une fusion y ferait conflit. La correction est
  d'une ligne le jour où ce périmètre est libre : ajouter
  `irradianceAppoint(dot(N, uAppointDir), uAppointIrr)` à la somme, exactement
  comme sur les tuiles.
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

- **`npm test` : 4 449 · 0 échec** (base à battre : 4 422 · 0). **+27**, tous
  dans `test/lumiere-sphere.test.js`.
- **`npm run audit:tests` : 230 listés · 230 sur disque · aucun écart.** Le
  nouveau fichier a été **ajouté à la liste explicite de `package.json`** — sans
  ça il n'aurait jamais tourné.
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
3. *(ce rapport, et le témoin « avant » sous le même protocole)*

---

## ⑨ CE QUI RESTE OUVERT

- ⛔ **Le transitoire du banc (§④ bis) n'a pas de cause identifiée.** Amplitude
  0,17 / 0,33, une mesure sur douze, signature reconnaissable (valeur basse nulle,
  `dRetour` nul). Il fausse tout verdict tiré d'un relevé unique sous ce seuil.
  **Tâche à ouvrir** — et d'ici là, **tout banc de ce dépôt qui publie un chiffre
  sous 0,2 sans répétition est suspect**, y compris rétroactivement.
- ⚠️ **L'appoint sur les PAROIS du crop** — une ligne, dès que le périmètre des
  parois est libre (§⑥).
- ⚠️ **Les 39 autres réglages ⛔ de l'inventaire.** R21 en traite huit. Vu ce que
  le protocole a rendu ici — **trois zéros sur huit n'étaient pas des verdicts** —
  il est prudent de supposer que **le compte de 47 est surévalué**, et de
  re-mesurer chaque rangée avec sa précondition avant de coder quoi que ce soit.
