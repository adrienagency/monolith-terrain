# RAPPORT R22 — LE MOBILIER DU BLOC : LES PAROIS ET LA GRILLE

> **Arbre** `C:\Dev\wt-par`, branche `parois-grille`.
> **Traces** : `.banc/R22/` — relevés appariés, captures pleine résolution, banc
> d'échelle.
> **Port** : 5731. **GPU** : ANGLE (NVIDIA RTX 3080, Direct3D11) — pas SwiftShader.

---

## 0. LES QUATRE RÉGLAGES, ET LE CHIFFRE QUI LES PROUVE

Même instrument des deux côtés, **fenêtre 1:1 de 512 × 320 pixels du tampon de
dessin** (aucun redimensionnement, aucun filtre), 8 images moyennées, mouvement
ambiant coupé, La Réunion au cadrage d'ouverture. Deux grandeurs : la moyenne
des écarts de couleur et le **gradient** local. Plancher de bruit mesuré **sur
place**, deux témoins consécutifs sans rien toucher.

| n° | réglage | avant | après | plancher |
|---|---|---|---|---|
| **48** | Afficher le socle | **0,0004 / 0,0006** | **2,6981 / 0,5723** | 0,0000 |
| **50** | Couleur de la tranche | **0,0000 / 0,0000** | **2,9824 / 0,5593** | 0,0000 |
| **20** | Opacité de la grille (0 → 1) | **0,0000 / 0,0000** | **8,0105 / 10,9947** | 0,0000 |
| **19** | Taille de la grille (14 → 2) | **0,0000 / 0,0000** | **16,9129 / 21,6906** | 0,0000 |
| *(prime)* | Encre « Grille » (sombre → rouge) | *non mesuré avant* | **14,3926 / 19,2137** | 0,0000 |

Relevés : `.banc/R22/avant-R22.json`, `.banc/R22/apres-R22.json`.
Captures appariées : `.banc/R22/{48-socle,50-tranche,20-opacite,19-taille}-{avant,apres}.png`.

⚠️ **AUCUN CURSEUR AFFICHÉ QUI N'AGISSE PAS.** Les quatre sont visibles et vivants.
Une rangée a été **cachée** : « Couleur de la tranche » sous une tranche de
**verre**, où la couleur du mur est un blanc de base et la teinte vit dans
`attenuationColor` — elle ne peut rien y peindre, ni sur le socle ni sur la
découpe. Même règle qu'« Épaisseur des courbes » en mode sombre.

---

## 1. LA CONVERSION D'UNITÉ POUR LE PAS DE GRILLE

`src/monde/habillage-crop.js`, `pasGrilleBloc` :

```
mètres de sol par unité de scène (horizontal) = largeurSolM / span
pas_m = valeurBloc × largeurSolM / span
```

**À La Réunion, mesuré dans l'application vivante** : `largeurSolM` = **27 356,4 m**,
`span` = 56, donc **488,51 m par unité de scène**. La tirette au défaut
(`gridStep` = 5) trace un carroyage de **2 442,5 m** ; à fond (`gridStep` = 2),
de **977,0 m**.

Le nuanceur (`src/globe.js`) compare ce pas à une coordonnée **en mètres de sol** :

```glsl
vec2 solM = qCrop * uCropDemiM;   // uCropDemiM = largeurCropM(repère) / 2
vec2 gq   = solM / uGridStepM;
```

### ⚡ LES DEUX PIÈGES DE CETTE CONVERSION, ET ILS SONT DIFFÉRENTS

**① Le facteur qui manque est 28, pas un autre.** Posée telle quelle sur `qCrop`,
la tirette à 5 vaudrait cinq demi-largeurs de crop : **une seule ligne, celle du
centre**, sur les 27,4 km du bloc, au lieu de 11,2 cellules. C'est le même
facteur `span / 2 = 28` que `uFxDemiBloc` porte déjà pour la couche d'apparence,
et que l'en-tête de `habillage-crop.js` démontre (`x = 28·u`).

**② ⛔ IL N'Y A PAS D'EXAGÉRATION ICI, ET C'EST LE PIÈGE DU MODÈLE.** Le brief
désigne `intervalleCourbesBloc` comme le patron à copier. Il porte un
`/ exagération` (2,8 côté socle, **18** côté globe) parce qu'un intervalle de
courbes est une longueur **VERTICALE**, mesurée sur un relief déjà exagéré. Le
pas de grille est **HORIZONTAL** : `champXZ()` est du x/z de monde, que
l'exagération ne touche à aucun moment (`_ecrireRelief` ne l'applique qu'à `y`).

### ⚡ ET LA VÉRIFICATION CONTRE UNE DISTANCE CONNUE AU SOL

**(a) Le compte de cellules, contre le socle.** Le socle trace `span / gridStep`
cellules par construction. Le crop en trace `largeurSolM / pas_m`. Nourris de la
**même** largeur, les deux rendent **exactement le même nombre** : **11,2** au
réglage du produit, **28** à fond. `test/grille-crop.test.js` ②a l'exige sur
40 combinaisons de largeur, de span et de tirette.

**(b) La période à l'écran, contre la trigonométrie de la caméra.**
`scripts/grille-echelle-r22.mjs` isole la grille **par différence** (opacité 0
puis 1, tout le reste identique : il ne reste que le carroyage), au **nadir**, et
cherche la période dominante par transformée directe. La prédiction ne vient
d'aucune image : au nadir un pixel vaut `2·d·tan(fov/2) / hauteurTampon` unités
de scène, soit **0,103675 unité/px** pour `d` = 140, fov 33°, tampon 800 px.

| `gridStep` | pas au sol | période **attendue** | période **mesurée** (3 bandes) | écart |
|---|---|---|---|---|
| 5 | 2 442,5 m | **48,23 px** | **49,00 / 51,00 / 50,50 px** | +1,6 % / +5,7 % / +4,7 % |
| 2 | 977,0 m | **19,29 px** | **19,75 / 20,00 / 20,25 px** | +2,4 % / +3,7 % / +5,0 % |

**Rapport 5 → 2, par bande : 2,481 · 2,550 · 2,494 — pour 2,500 prédit.**

⚠️ **LE RÉSIDU EST DU MÊME SIGNE PARTOUT, ET IL A UNE CAUSE NOMMÉE** : la grille
est peinte **sur le relief**, qui est plus près de la caméra que le plan visé,
donc plus gros à l'écran. Un relief moyen à 4 unités au-dessus de la cible rend
2,9 % — l'ordre de grandeur observé. ⛔ **Je ne l'ai pas mesuré séparément** : je
le donne comme explication vraisemblable, pas comme fait établi.

**Ce que ces 5 % excluent** : une grille sans le facteur 28 serait à **2 800 %**,
une grille portant l'exagération à **1 800 %**. Aucune des deux ne se cache dans
cet intervalle.

---

## 2. OPTION 48 — « AFFICHER LE SOCLE »

⛔ **Le curseur pilotait un objet qui n'est plus rendu.** `params.plinth` va à
`plinth.setVisible`, c'est-à-dire au socle du bloc **PLAT** ; la passe de surface
est éteinte sous la sphère (`socleAffiche()` rend faux). Ce qu'on voit à l'écran
vient de `parois-crop.js`, et **rien ne lui parlait**.

Le correctif est `globe.setParoisVisibles(v)`, appelé de **deux** sites (le doigt
via `onPlinthToggled`, le changement de mode via `poserVisibiliteSocle`).

⚡ **LES DEUX DÉCISIONS QUI PORTENT LE CORRECTIF, ET AUCUNE N'EST DÉCORATIVE :**

1. **C'est un ÉTAT RETENU, pas un `mesh.visible` posé une fois.**
   `construireParoisCrop` fabrique un **mesh neuf à chaque déplacement**. Vérifié
   dans la page vivante : socle éteint, reconstruction forcée par le maillon du
   branchement, **le mesh a un autre `uuid` et `visible` vaut toujours `false`**
   (`.banc/R22/apres-R22.json`, section `persistance`). Sans l'état retenu, le
   socle revenait tout seul au premier pas.
2. **On CACHE, on ne retire pas.** `retirerParoisCrop` remet à nul `_baseYCrop`,
   `_retraitBaseCrop`, `_plancherJupeCrop` et `_retraitJupeCrop` — quatre valeurs
   que le rideau d'eau (P4) et les jupes de tuiles (P7, P13, P14) **lisent**. Un
   réglage d'affichage aurait cassé trois géométries voisines.

⚠️ **Et le branchement n'est PAS accroché à `vue.socle`**, contrairement à la
ligne voisine du socle plat : `vue.socle` dit si le bloc plat est dessiné, et il
est **faux** sous la sphère. Les parois du crop vivent dans la scène du globe,
qui est dessinée précisément quand `vue.socle` est faux.

---

## 3. OPTION 50 — « COULEUR DE LA TRANCHE »

⛔ **Le curseur écrivait dans une variable que personne ne relisait.** Relevé au
démarrage : `params.plinthColor = #d8d4cc`, `plinth.wallMat.color = #c06a44`. Le
gabarit d'ouverture pose un préréglage PBR, donc `_pbrColored` est vrai, donc
`setColors` refusait la valeur — et le crop lit **le matériau**
(`contexteCrop` → `paroiCouleur` → `uParoiCouleur`).

⚠️ **CE N'EST PAS UN DÉFAUT DE SPHÈRE, ET IL FAUT LE DIRE** : le socle du bloc
plat souffrait exactement du même refus, au même endroit. La sphère ne fait que
l'exposer, parce que c'est elle qu'on regarde.

⚡ **La distinction qui répare existait déjà sans être nommée : une
RECOLORATION AUTOMATIQUE n'est pas un CHOIX D'UTILISATEUR.** `_pbrColored` a été
écrit pour qu'un mode sombre ou une teinte dérivée du fond (`derivePlinthColor`)
n'écrasent pas une matière choisie exprès — et il a raison. Il traitait seulement
le **curseur** comme un de ces automatismes. `setColors(params, { explicite })`
sépare les deux : le doigt gagne, la dérivation perd, et le picker de matières
repose sa propre couleur, donc le **dernier geste** gagne dans les deux sens.
Un test exige que les appels automatiques de `main.js` ne passent **jamais**
`explicite`.

---

## 4. OPTIONS 19 ET 20 — LA GRILLE DE RELEVÉ

Ce n'était pas un rebranchement : **le nuanceur du crop ne portait pas une ligne
de grille**. Le bloc écrit est placé **après les courbes et avant le graticule**
— l'ordre du socle, et c'est un argument : le carroyage passe par-dessus les
courbes, sinon un relief dense l'efface par morceaux.

⛔ **AUCUN `minFade`, ET C'EST LA LEÇON DE R19 APPLIQUÉE AVANT DE LA PAYER.**
Le brief le signalait comme piège n° 1 : sous le crop, `texel` vaut **3,00** et
`clamp(1,6 − 3,00 × 0,55)` rend **zéro**. J'ai vérifié le côté du `mix` avant
d'écrire quoi que ce soit — la ligne corrigée par R19 est
`mix(clamp(1.6 − texel×0.55, 0, 1), 1.0, dedansCrop)`, elle appartient au bloc
des **courbes**, et la grille ne la traverse pas. Le socle, qui est le modèle,
n'a aucun fondu de ce genre sur sa grille non plus. `test/grille-crop.test.js` ③c
interdit qu'on l'y ramène un jour.

⚠️ **`dedansCrop` MULTIPLIE, IL NE GARDE PAS LA BRANCHE.** La garde est faite de
**trois uniformes** (`uGridOpacity > 0.001 && uGridStepM > 0.0 && uCropDemiM > 0.0`),
donc tous les fragments d'un quad prennent la même branche et le `fwidth` a une
dérivée définie. ⛔ Y ajouter `dedansCrop > 0.0` — la tentation, puisque la
grille ne peint que dans la découpe — aurait rendu la dérivée **indéfinie sur
toute la frontière du bloc**. La couverture douce multiplie le résultat, ce qui
fait de plus fondre la grille au bord au lieu d'y poser une arête d'un pixel.

⚡ **EN PRIME, ET CE N'ÉTAIT PAS DEMANDÉ : l'encre.** Le socle a **deux** encres
(`uContourColor` et `uGridColor`). Peindre la grille du crop avec `uInk` —
l'encre des courbes, la seule que le globe avait — aurait donné deux Terres de
couleurs différentes au même réglage. `uGridColor` traverse donc aussi :
**14,3926 / 19,2137**.

---

## 5. TESTS

**`npm test` : 4 460 tests, 4 460 pass, 0 fail.** Base annoncée par le brief :
**4 422 · 0 échec**, reproduite avant de commencer.
**`npm run audit:tests` : 230 listés · 230 sur disque, aucun écart.**
Les 38 tests neufs sont `test/grille-crop.test.js`, inscrit dans la liste
explicite de `package.json`.

### ⚠️ TROIS TESTS EXISTANTS ONT CHANGÉ, ET LES TROIS SONT DES GARDES DE CLASSE

1. **`crop-habillage` + `crop-naturel` — leurs tables d'uniformes factices.**
   Treize tests sont tombés d'un coup en `TypeError` dès que le globe a reçu
   quatre uniformes de plus. ⚡ **C'est exactement leur travail** : l'aller-retour
   bit à bit d'`⑨h` ne prouve rien sur une table qui ne ressemble pas à la vraie.
   Les quatre y sont ajoutés.
2. **`loi-texture-monde` ④h — le compte de `fwidth`.** Il fige le nombre de
   `fwidth` du nuanceur en disant *« si quelqu'un en ajoute ou en retire un, la
   question se rouvre »*. Elle s'est rouverte : **7 → 8 sites, 8 → 9 appels**. Le
   huitième est de la **bonne classe** — `gq` vaut des mètres de sol divisés par
   des mètres de sol, il ne dépend ni du niveau de la tuile ni de `uTilePx`, donc
   il ne peut pas fabriquer l'arête de frontière de niveaux que la Tâche K a
   mesurée (23,5 % de l'image au nadir). Le test exige en plus que **sa garde
   reste un uniforme**.
3. **`crop-rampe` ⑦e — une fenêtre de 6 000 caractères.** Il coupait
   `retirerHabillage` à une borne fixe ; R22 n'a fait qu'**ajouter un
   commentaire** quinze lignes plus haut, et le motif cherché est sorti de la
   fenêtre **sans avoir bougé d'une ligne**. ⛔ Un test qui tombe sur la LONGUEUR
   d'un commentaire ne mesure pas ce qu'il croit. Il coupe désormais à l'accolade
   fermante de la méthode — le repère que `crop-habillage` prend déjà.

⚠️ `test/grille-crop.test.js` était **ROUGE avant les correctifs** : ni
`pasGrilleBloc`, ni `setParoisVisibles`, ni le bloc de grille du nuanceur
n'existaient.

---

## 6. FICHIERS TOUCHÉS

⚠️ **`main.js` EST PARTAGÉ AVEC LES CHANTIERS VOISINS (nuages, éclairage) —
VOICI EXACTEMENT CE QUE J'Y AI FAIT.**

**`src/`**
- `src/globe.js` : ① quatre uniformes neufs (`uGridStepM`, `uGridOpacity`,
  `uGridColor`, `uCropDemiM`) — **le compte d'unités de texture est inchangé** ;
  ② le bloc de grille du fragment, entre les courbes et le graticule ;
  ③ la conversion dans `poserHabillage` et sa remise dans `retirerHabillage` ;
  ④ `setParoisVisibles`, le champ `_paroisVisibles`, et une ligne dans
  `construireParoisCrop`.
- `src/monde/habillage-crop.js` : `pasGrilleBloc` et `cellulesGrilleCrop`
  (exports neufs), trois champs dans `HABILLAGE_MONDE`. **Aucune ligne existante
  modifiée.**
- `src/monde/branchement-crop.js` : quatre entrées dans `CHAMPS_HABILLAGE`.
- `src/main.js` : **deux ajouts, aucune suppression.** ① quatre champs dans
  l'objet rendu par `contexteCrop` ; ② deux appels à `globe.setParoisVisibles`.
  ⛔ **Je n'ai touché ni `clouds2`, ni `cloud-shell`, ni une ligne de nuages, ni
  l'éclairage** (ombres, lampe d'appoint, ombrage des pentes) : ces deux
  périmètres appartiennent à `wt-lum` et au chantier des nuages.
- `src/plinth.js` : `setColors` prend `{ explicite }`. Une condition élargie, pas
  remplacée.
- `src/ui/create-panel.js` : la couleur de la tranche passe `{ explicite: true }`
  et rappelle `onPlinthToggled` ; sa rangée est cachée sous le verre.
- `src/ui/map-panel.js` : la note « la grille du bloc n'existe pas » est retirée
  — elle était vraie, elle ne l'est plus, et une note fausse est pire qu'une
  absence de note.

**tests** : `test/grille-crop.test.js` (neuf, 38 tests),
`test/crop-habillage.test.js`, `test/crop-naturel.test.js`,
`test/crop-rampe.test.js`, `test/loi-texture-monde.test.js`, `package.json`.

**outils** (aucun effet sur l'application) : `scripts/sonde-r22.mjs`,
`scripts/grille-echelle-r22.mjs`.

⚠️ **AUCUNE SONDE DE NUANCEUR N'EST RESTÉE.** Contrairement à R19, je n'ai pas eu
besoin d'en poser une : le défaut de la grille n'était pas un étage qui s'annule,
c'était une absence.

---

## 7. CE QUE J'AI CRU, PUIS RÉFUTÉ

### ⛔ ① « 19 et 20 n'ont aucun sens sur la sphère » — le départage de l'inventaire, et il est faux

`inventaire-studio-2.md`, section (c), range les deux options dans **« ce qui n'a
aucun sens sur la sphère »**, au motif que *« la grille cartographique existe
déjà et n'est pas celle-là : c'est le graticule de latitude/longitude »*, et
conclut que *« deux curseurs qui prétendraient piloter la grille en piloteraient
deux objets différents selon le mode »*.

⚡ **Ce sont bien deux objets — et c'est précisément pourquoi il en faut deux.**
Le graticule est un maillage de **PLANÈTE** : tous les 10°, du pôle à l'équateur,
son propre uniforme, et il ne rétrécit pas quand on zoome. Le carroyage est une
grille de **BLOC** : un pas au sol, en travers de la découpe, qui suit l'emprise.
**Le socle, qui est le modèle de « une seule Terre », trace les DEUX.** Le crop en
trace désormais deux aussi, et rien n'a été refondu. `test/grille-crop.test.js`
③g interdit qu'on les confonde un jour.

**Seize exécutants sur seize ont contredit leur brief. Celui-ci en fait dix-sept.**

### ⛔ ② « L'option 48 marche déjà » — la vignette avait raison de bouger, et tort de conclure

L'inventaire mesure l'option 48 à **1,145 / 1,466** et la marque **✅**, tout en
notant dans la même ligne que *« le socle plat n'est plus rendu »*. J'ai d'abord
cru que le travail était fait.

⛔ **En pleine résolution, l'interrupteur déplace 0,0004.** L'écart de 1,145
existe bel et bien — mais il vient **du cartouche**, pas des parois :
`getBaseY()` et `wallsVisible()` (`main.js`) lisent `params.plinth`, donc les
textes du cartouche se recalent et les gravures murales disparaissent. **Les
parois, elles, n'ont jamais bougé d'un pixel.** Un chiffre juste, sur le mauvais
objet — exactement la classe d'erreur que `lecons-campagne-R.md` ⑤ décrit
(« un instrument aveugle à ce qu'il devait voir »).

### ⛔ ③ « L'erreur d'exagération rendrait la grille 18 fois trop grossière » — c'est l'inverse

Je l'ai écrit dans le code avant de l'exécuter : *« aurait multiplié le pas par
18, soit 0,62 cellule sur tout le bloc — un quadrillage qui aurait disparu »*.
**Le test l'a réfuté à la première exécution** : `intervalleCourbesBloc` **divise**
par `echelleBloc = (span / L) × exagération`, donc elle rend un pas **dix-huit
fois plus COURT** — **201,6 cellules** en travers de 27,4 km, une ligne tous les
**136 m**. ⚡ **Et le sens compte** : ce n'est pas une grille disparue, c'est une
bouillie moirée — mot pour mot ce que `intervalleCourbesBloc` raconte de son
propre cas raté (« neuf mille courbes, donc une bouillie, donc rien »). Le
commentaire a été corrigé, le test porte le bon chiffre.

### ⛔ ④ « Compter les lignes en vue de trois quarts prouvera l'échelle » — l'instrument était le problème

Premier banc d'échelle : compter les pics de la grille isolée le long de bandes
horizontales, en vue de trois quarts. Résultat, **sur trois bandes du MÊME état** :
**20 / 17 / 11 pics**, et un rapport 5 → 2 qui rendait **1,66 · 1,74 · 2,47** pour
2,50 attendu. Une ligne de balayage y croise les **deux** familles de lignes à la
fois, et la perspective resserre le fond du bloc : la période du signal change le
long de la ligne, et les lignes lointaines fusionnent sous le pixel.

⚡ **Au nadir, l'écran EST le plan du sol** : une seule famille, un pas régulier,
une prédiction trigonométrique. Le rapport tombe à **2,481 · 2,550 · 2,494**.
⚠️ **J'ai failli publier le 2,47 de la bande 0,58** — c'était le chiffre le plus
favorable des trois, et c'est le défaut systémique n° ① de `lecons-campagne-R.md`.
Les trois bandes sont publiées, toujours.

### ⛔ ⑤ « `extentMeters` et `largeurCropM`, c'est la même largeur » — 0,0079 % d'écart, et il se voit dans le compte

Les deux mesurent la largeur au sol du crop par deux chemins : **27 354,3 m**
contre **27 356,4 m**. Nourrir le pas de l'une et la coordonnée de l'autre rend
**11,2009 cellules** là où le socle en trace **11,2**. Invisible à l'œil, et faux
quand même — donc une seule largeur, lue une fois, dans `poserHabillage`.

### ⚠️ ⑥ Ce que j'ai cru être une conversion, et qui est la MÊME des deux côtés

J'ai envisagé d'écrire la grille en **unités de bloc** (`qCrop × 28 / uGridStep`),
ce qui aurait été bit-identique au socle sans jamais parler de mètres. Nourries de
la même largeur au sol, **les deux routes sont exactement équivalentes** — le
facteur qui manque est 28 dans un cas, `largeurSolM / span` dans l'autre, et
`largeurSolM / span × span / 2 = largeurSolM / 2 = uCropDemiM`. J'ai gardé la
route métrique parce qu'elle est **vérifiable contre une distance connue au sol**,
ce que le brief exige et ce que la route en unités de bloc ne permet pas.

---

## 8. RÉSERVES

1. ⛔ **JE N'AI RIEN VÉRIFIÉ SUR LA VUE ORBITALE À L'ÉCRAN.** L'invariance de la
   planète nue est prouvée par l'arithmétique (`uGridOpacity` vaut 0 par défaut,
   la garde ne s'ouvre pas ; et si elle s'ouvre, `dedansCrop` vaut 0 hors
   découpe) et par le test d'aller-retour bit à bit de `retirerHabillage` — **pas
   par une capture**. Même réserve que R19 n° 6, et pour la même raison.
2. ⚠️ **LE RÉSIDU DE +2 À +6 % SUR LA PÉRIODE N'EST PAS DÉMONTRÉ.** Je l'attribue
   à la hauteur du relief au-dessus du plan visé, dont l'ordre de grandeur colle
   (2,9 % pour 4 unités sur 140), mais je n'ai pas mesuré la hauteur moyenne du
   relief sous la caméra pour le confirmer. **Le rapport 5 → 2, lui, est
   insensible à cette cause** et il tient à 2 %.
3. ⚠️ **UN SEUL LIEU, UNE SEULE MACHINE.** La Réunion au cadrage d'ouverture,
   zoom du démarrage, 1280 × 800, RTX 3080 / ANGLE D3D11. Un crop continental
   très large, une très haute latitude (où le `cos(lat)` de `largeurCropM` pèse
   le plus) et une machine lente ne sont pas essayés.
4. ⚠️ **LE MODE CONTINU N'EST PAS ESSAYÉ.** `gridSpanBloc` porte le span du bloc
   vivant (`TERRAIN_SIZE × empriseCote`) et un test l'exerce, mais le drapeau de
   la fenêtre continue est éteint : je n'ai vu tourner que le cas `empriseCote`
   absent, où le span vaut 56.
5. ⚠️ **LA GRILLE EST ÉTEINTE AU DÉMARRAGE** (`uGridOpacity` vivant = 0, posé par
   le gabarit d'ouverture) : **rien ne change à l'écran tant que personne ne
   touche le curseur.** C'est un fait, pas une garantie — D17 dit qu'il n'y a pas
   de production à protéger.
6. ⚠️ **LE COÛT PAR FRAGMENT N'EST PAS CHIFFRÉ.** Le bloc de grille est sous
   garde d'uniforme, donc gratuit tant que l'opacité est nulle ; allumé, il
   ajoute un `fwidth`, deux `smoothstep` et une dizaine d'opérations par
   fragment de tuile. Je ne l'ai pas mesuré — et `lecons-campagne-R.md` ② dit
   pourquoi je ne l'ai pas essayé à la légère : **les bancs de ce dépôt mesurent
   le temps de soumission CPU**, indiscernable du temps sans barrière, alors que
   ce correctif n'ajoute que du GPU.
7. ⚠️ **L'ARBITRAGE DE L'OPTION 50 EST UN CHOIX, PAS UNE ÉVIDENCE.** J'ai décidé
   que le doigt bat le préréglage. L'autre lecture — « le picker est le maître,
   le curseur ne sert qu'aux socles nus » — se défend, et elle était l'état du
   dépôt. Si Adrien la préfère, c'est un mot à retirer dans `create-panel.js`.
   Mais alors **le curseur doit disparaître de l'interface dès qu'une matière PBR
   est posée**, sinon on retombe sur un curseur affiché qui n'agit pas.
