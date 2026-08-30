# Rapport — Tâche K · LA CONTINUITÉ DE TEXTURE

**Statut : livrée, mais elle ne ferme QU'UNE des trois causes des arêtes droites, et je le
montre à l'écran plutôt que de l'écrire.**

- **Commit unique** : `92b8da6` — *« tache K : la loi de texture quitte l espace-tuile »*
  (sur `regroupement`, parent `6fba7dd`). **Arbre propre après commit.**
- **Tests** : `npm test` → **3 717 / 3 717** (3 684 avant, +33 ajoutés) · `npm run audit:tests`
  → **203 / 203** · `node --check` sur les quatre fichiers touchés → OK.
- **Mutation sémantique** : **37 / 37 tuées** (`.banc/mutations-K.mjs`), worktree
  `C:\Dev\wt-mut-K` **retiré en partant** (`git worktree list` ne le porte plus).
- **Page chargée drapeau LEVÉ et BAISSÉ**, sans erreur de console ni de compilation GLSL.
- **Captures** : `.banc/vues-K/` — les deux qui comptent sont
  **`E1-coin-haut-gauche-avant.png`** et **`E1-coin-haut-gauche-apres.png`**.

---

## ① L'ÉTAPE 1 — LA MESURE, ET ELLE N'AVAIT JAMAIS ÉTÉ FAITE

**Banc A/B côté GPU** : on gèle un terme dans un uniforme, on **rend deux images dans le même
bloc synchrone** (aucune image de la boucle rAF entre les deux) et on **compte les pixels qui
CHANGENT**. Ce n'est pas une preuve de couverture : on ne compte pas ce qui est dessiné, on
compte ce qu'un terme DÉCIDE.

**Le témoin vaut 0 pixel exactement, et ce n'est pas un banc qui ne rend rien** — les
variantes, elles, changent des centaines de milliers de pixels sur la même image, et deux
rendus séparés de 60 ms (donc avec un tour de rAF au milieu) diffèrent, eux, sur 74,9 % des
pixels. Le banc rend, et il rend de façon reproductible.

**Conditions** (toutes relevées en direct, aucune supposée) : La Réunion,
`?terre=unique&globe=continu&socle=quadtree&f3=0&frontiere=1&seuil=1`, `demZoom = 11`, bloc
54 762 m, **fov 33 lu en direct** (le code dit 30), cadre 1 088 × 731, cycle jour figé, nuages
éteints, **grain de pellicule (`NoiseEffect`, 0,26, animé par image) et vignette forcés à 0**.
Deux poses à **altitude identique et même jeu de tuiles** : polaire **8°** (quasi-nadir) et
polaire **55°** (isométrique).

### ⚠️ Le premier résultat a été un piège, et il faut le dire en premier

Sur le template réellement chargé, **`uContourOpacity` vaut 0**. Le terme des courbes est donc
multiplié par zéro, et geler `minFade` changeait **exactement 0 pixel** — aux deux angles. Un
banc qui se serait arrêté là aurait conclu « `minFade` ne fait rien » **et se serait trompé**.
Les chiffres ci-dessous sont pris **courbes rallumées à 0,5** (le défaut du dépôt,
`DEFAULT_LOOK.contourOpacity`), et la conséquence pour Adrien est écrite au §⑤.

### Le tableau (fraction de l'image dont la couleur change quand on gèle le terme)

| terme gelé | nadir 8° | isométrique 55° | amplitude moyenne sur les pixels touchés |
|---|---|---|---|
| **`minFade` → 1** | **23,5 %** | **41,0 %** | 22,8 / 18,8 sur 255 |
| grain désindexé de `vUv` | 42,0 % | 28,8 % | 2,7 / 2,7 sur 255 |
| empreinte de `decodeMetersAA` → 0 | 1,9 % | 1,8 % | 8,0 / 7,1 |
| `crowd` → 1 | **0,05 %** | **0,21 %** | 12,5 / 7,1 |

Et sur la **planète rendue opaque** (`uEstompage = 0`, qui retire l'artefact de transparence
décrit au §④), la **fraction PLATE de l'image** (écart-type local 3×3 sous 1,2/255) :

| | tel quel | `minFade` gelé |
|---|---|---|
| nadir 8° | 38,4 % | **24,9 %** |
| isométrique 55° | 36,0 % | **14,3 %** |

**Verdict :** ⭐ **`minFade` domine.** Il touche moins de pixels que le grain mais avec une
amplitude **neuf à douze fois** plus grande, et surtout **c'est le seul qui déplace la
fraction plate** — le grain ne la bouge pas (0,3838 → 0,3835). `crowd` ne décide rien
(0,05 %), `decodeMetersAA` décide peu (2 %).

**Et la part de `minFade` grandit avec l'inclinaison** : à altitude identique, basculer de 8°
à 55° la fait passer de 23,5 % à 41,0 % de l'image (×1,74). **C'est la dépendance à l'angle
qu'Adrien décrit**, mesurée.

⚠️ **Une chose que ce banc NE dit pas** : il compare deux états du même nuanceur. Il ne dit pas
si l'image est belle. C'est le §④ qui le dit.

---

## ② LES SEPT `fwidth` — L'AUDIT DEMANDÉ, ET IL RÉDUIT LA LISTE À UN

`fwidth` mesure une variation **par pixel d'écran**. Ce n'est pas un défaut : une largeur de
trait DOIT se mesurer en pixels, sinon le trait s'épaissit au loin. Ce qui fabrique une arête,
c'est de mesurer **en espace-tuile**. J'ai repris les sept sites (8 appels : `texelTuile` en
porte deux) :

| site | grandeur mesurée | espace | verdict |
|---|---|---|---|
| `decodeMetersAA` — `fwidth(uv)` | l'empreinte du pixel | ⚠️ écrit en tuile, **mais** `fwidth(uv) × étendueAuSol` est la même empreinte **en mètres** quel que soit le niveau | **continu — non touché** |
| bordure du crop — `fwidth(d)` | unités de crop | monde | légitime |
| côte — `fwidth(landness)` | couverture d'un champ **cuit** indexé sur `qCrop` | monde | **légitime — VÉRIFIÉ** |
| courbe mineure — `fwidth(ch)` | `h / intervalle`, donc des **mètres** | monde | légitime (largeur de trait) |
| courbe majeure — `fwidth(ch5)` | idem | monde | légitime |
| graticule — `fwidth(g)` | `vLatLon / 10`, des **degrés** | monde | légitime |
| ⛔ **`minFade` — `fwidth(vUv) × uTilePx`** | **rien de physique** | **tuile de bout en bout** | **c'est lui** |

**Le point 3 du complément est confirmé : `fwidth(landness)` est légitime et n'a pas été
touché.** Son commentaire dit vrai — la garde est `uHabOn > 0.5 && uCoastMaskOn > 0.5`, deux
UNIFORMES, donc tous les fragments d'un quad prennent la même branche et la dérivée est
définie. Un test fige ce constat (④h) : le compte de sept sites et la garde par uniforme.

⚠️ **Et `uTilePx` aggrave `minFade` d'un second cran** que le brief ne nommait pas : il vaut
**256 ou 512 selon la tuile** — relevé à l'écran, la même scène portait **43 tuiles z13 en 512
et 39 en 256**. Deux tuiles de MÊME niveau pouvaient donc déjà diverger d'un facteur deux.

---

## ③ CE QUE J'AI CHANGÉ

Une seule grandeur d'ancrage, posée une fois par image :

> **les mètres de sol par pixel d'écran**, `mppEcran = vProfCam × uMppFacteur`, où `vProfCam`
> est la **profondeur en espace de vue** du fragment et `uMppFacteur = 2 tan(fov/2) ×
> mètresParUnité / hauteurDuTampon`.

- **Elle ne dépend ni du niveau de la tuile** (donc plus d'arête) **ni de l'inclinaison de la
  caméra** (donc la même loi en nadir et en isométrique).
- **`vProfCam` est un `varying`, pas un attribut** : **zéro octet de géométrie ajouté** — à
  comparer aux **+23 %** que l'étude chiffre pour une cible de morphing.
- **Pris en espace de VUE, pas en espace monde** : les sommets sont en RTC exprès pour ne pas
  payer l'ulp float32 (0,486 m à magnitude 100). `length(modelViewMatrix × position)` ne
  reconstruit aucune coordonnée de grande magnitude.
- **La PROFONDEUR, pas la longueur du vecteur.** Un pixel couvre `2 z tan(fov/2) / hauteurPx`
  d'un plan perpendiculaire à l'axe de vue : `length(mv.xyz)` surestimerait de `1/cos θ` sur
  les bords (**+8 % au coin à fov 33**) et **ferait varier la loi avec la position à l'écran**.
  ⚠️ **Cette mutation a SURVÉCU au premier tour** — elle passe tous les tests de loi pure. Le
  test ④c-bis la tue en évaluant l'expression **hors axe**, là où les deux écritures diffèrent.

Les deux termes en espace-tuile s'y indexent :

- **`minFade`** : `texel = mppEcran / uResRefM` au lieu de `fwidth(vUv) × uTilePx`.
  `uResRefM` est **la résolution du socle** — `ZOOM_SOCLE = 13`, tuile 256 px (AWS, la source
  qui couvre toujours), circonférence **importée** de `habillage-crop.js` — soit **17,83 m par
  texel à la latitude de La Réunion**. La règle se lit : *les courbes restent tant que l'écran
  résout la donnée du socle.*
- **le grain de papier** : indexé sur le **mètre de sol absolu** tiré de `vLatLon`, ramené en
  pixels. **La fréquence se dérive, elle ne se pose pas** : `941,7 / 256 = 3,678` cellules par
  pixel — le 941,7 du dépôt, à la condition de référence d'un texel par pixel. Le grain garde
  donc son grain ; c'est son **ancrage** qui change. C'est la discipline que l'habillage
  applique déjà avec `qCrop` (*« sinon le grain se répéterait à chaque tuile »*).

**`uMppFacteur = 0` rend le dépôt AU BIT PRÈS**, et la loi n'est posée que sous
`?terre=unique` : **la vue orbitale en production ne bouge pas.** C'est le patron
`distanceRivage` / `aussi: null` / `fond`. Deux tests figent les expressions éteintes au
caractère près (④f, ④g). **`terrain.js`, `plinth.js`, `ocean.js` et le chemin bloc n'ont pas
été ouverts.**

**Fichiers** : `src/monde/loi-texture-monde.js` (neuf, pur, testable sous node),
`src/globe.js` (nuanceurs + `poserLoiMonde` / `retirerLoiMonde`), `src/main.js`
(`majLoiTextureMonde`, appelée par image, fov **lu en direct**, hauteur du **tampon de
dessin** — pas du CSS, sinon les courbes disparaîtraient sur les seuls écrans Retina),
`test/loi-texture-monde.test.js`, `package.json`.

---

## ④ CE QUE J'AI VU À L'ÉCRAN — dit franchement

**Témoin exigé, témoin fourni** : même image, même caméra, même jeu de tuiles, **seul
`uMppFacteur` bascule**. Rien d'autre ne change entre les deux captures.

### Ce que ça ferme — `E1-coin-haut-gauche-avant.png` → `E1-coin-haut-gauche-apres.png`

**AVANT : une arête parfaitement droite coupe le coin en deux champs plats**, un vert-kaki
sombre et un vert clair. **APRÈS : l'arête a disparu**, le vert est continu. C'est exactement
le défaut décrit par Adrien, et c'est exactement ce que la tâche devait fermer.

**Le mécanisme, une fois vu, est plus laid que « des courbes qui manquent »** : sur une tuile
grossière, `dch` explose, `minor` sature à 1 partout, et le terme des courbes **dégénère en un
APLAT** qui assombrit la tuile entière de ~27 %. L'ancien `minFade` laissait cet aplat à pleine
force précisément là où il fallait l'éteindre, **parce qu'une tuile grossière a une dérivée
d'UV petite** — le nuanceur la lisait comme « bien résolue ». La loi de distance la lit comme
« loin », et l'éteint.

### Ce que ça NE ferme PAS, et il faut le regarder aussi — `E2-…` et `F0-tel-que-livre-45deg.png`

**Autour du bloc, la mer reste un patchwork de plaques aux arêtes droites** : un grand plateau
**vert uniforme**, des rectangles bleus de teintes différentes, des losanges beiges, un trait
orange rectiligne. **Mon correctif n'y change rien** — les deux captures E2 sont à l'œil
identiques. Ce n'est ni `minFade` ni le grain : c'est la **couleur** elle-même (§⑤).

**Non, ça ne ressemble toujours pas au socle.** Le relief de l'île se lit bien — **et il se
lisait déjà bien avant, je ne l'ai pas amélioré** ; ce que j'ai retiré est dans les champs
autour. Tout ce qui entoure l'île est encore une mosaïque.

### Un troisième défaut, découvert en mesurant, et qui n'est à personne

**À estompage intermédiaire (le régime d'une descente), l'image se couvre de petites plaques
diagonales translucides** (`40-nadir-telquel.png`). J'ai isolé la cause par le même protocole :
elles **disparaissent entièrement** quand on force `uEstompage = 0` (planète opaque) ou `= 1`
(crop seul). **Ce sont les tuiles et leurs jupes rendues semi-transparentes par l'estompage et
mélangées dans un ordre arbitraire.** ⛔ **C'est le défaut le plus voyant du régime de descente,
il est indépendant de ma tâche, et aucune tâche du chantier ne le porte.**

---

## ⑤ MES RÉSERVES — ce que je NE prétends PAS fermer

1. ⛔ **La résolution réelle de la donnée diffère par niveau.** Fait de la source. Aucune
   interpolation ne fabrique l'information manquante. Intact.
2. ⛔ **Le crop impose un zoom prescrit uniforme** (`zCrop`), donc **à sa frontière le saut de
   résolution n'est PAS borné à un niveau**, contrairement au reste du globe — et **aucune
   règle de voisinage n'existe** dans ce dépôt. Intact.
3. ⛔ **L'ÉCHELLE DE LA RAMPE EST RE-MESURÉE PAR POSE, et c'est la cause du vert.** Relevé sur
   la même session : `uLandMax` passe de **5 600 m** (`RAMPE_MONDE`) à **2 691,25 m** sur le
   crop de La Réunion, `uOceanDepth` de **6 000 m** à **5 133,89 m**. La même altitude physique
   reçoit donc une couleur différente selon l'altitude de la caméra. **Je n'y ai pas touché** :
   c'est un chantier à part (`rampe-crop.js`, `poserRampe`, une loi continue à écrire dans
   l'esprit d'`exageration-continue.js`), et le mélanger à celui-ci aurait fait une tâche qu'on
   ne peut plus relire. **Le périmètre élargi du complément est trop large pour une seule
   tâche : je le dis plutôt que de le survoler.**
4. ⛔ **`h == 0` PREND LA BRANCHE TERRE, et c'est LE grand aplat vert.** `sousEau = h < 0.0` :
   à `h == 0` exactement, `t` vaut `0,35` — la première teinte de TERRE. Les tuiles terrarium
   encodent l'océan à zéro sur de vastes surfaces, donc **la mer se peint en vert le plus bas**.
   Le nuanceur le documente déjà (*« le plateau vert uniforme de la Tâche J »*). **Une lettre
   sépare `h < 0.0` de `h <= 0.0`, et c'est précisément pour ça que je n'y touche pas sans
   mesure** : le masque de côte, qui trancherait correctement, n'existe qu'À L'INTÉRIEUR du
   crop.
5. ⛔ **La dégradation de la mer par distance caméra** (`globe.js`, per-sommet, avec sortie
   anticipée quand `richesseMer <= 0`) : **hors périmètre, non touchée.** Mon banc la distingue
   de ce que je change — toutes mes comparaisons se font **à caméra strictement identique**,
   donc à `richesseMer` identique ; elle ne peut pas contribuer à un écart mesuré.
6. ⚠️ **Le critère de sortie n'est atteint qu'à MOITIÉ.** *« Deux vues du même lieu à la même
   altitude, sous deux angles, doivent rendre la même LOI de texture. »* La loi est désormais
   la même — elle ne dépend que de la distance. **Mais l'IMAGE diffère encore**, et
   légitimement : en oblique, le sol est 1,74 fois plus loin, donc moins résolu.
   ⚠️ **Et ce que le correctif produit à 22 km n'est PAS un retour des courbes de niveau.**
   Mesuré après coup, à cadre identique : il change **59,6 %** de l'image au nadir et
   **58,1 %** à 55°, mais **la fraction plate ne bouge pas** (0,3867 → 0,3872 au nadir ;
   0,3753 → 0,3747 à 55°). Ce qu'il retire, c'est **l'APLAT** décrit au §④ — les champs
   deviennent uniformément clairs au lieu d'uniformément sombres, et l'arête entre eux
   disparaît. **Les courbes, elles, restent absentes aux deux angles à cette altitude.**
   **Je ne sais pas dire si c'est ce qu'Adrien veut voir** — c'est cohérent, ce n'est
   peut-être pas ce qu'il attend.
7. ⚠️ **Sur le template livré, les courbes de niveau du globe sont ÉTEINTES**
   (`params.contourOpacity = 0`). **Tout le poste `minFade` est donc multiplié par zéro dans la
   configuration par défaut** : mon correctif n'y change rien tant qu'Adrien ne rallume pas les
   courbes. Mesuré, pas supposé.
8. ⚠️ **Le grain de pellicule de post-traitement** (`NoiseEffect`, opacité 0,26, mélange
   OVERLAY, **redessiné à chaque image**) recouvre toute la carte et **noie le grain de papier
   du nuanceur**. `params.grain = 0` ne l'éteint pas — seul `grain.blendMode.opacity` le fait.
   C'est le *« tout est noyé dans le grain »* du rapport I. Non touché.
9. ⚠️ **La preuve « drapeau baissé » est indirecte.** Je n'ai pas réussi à cadrer la planète
   entière : le contrôleur orbital replaque la caméra à ~100 unités (la surface) et rend un
   aplat turquoise (`G0`, `G1`). Ce sur quoi je m'appuie : **440 tuiles dessinées**, nuanceur
   **compilé** (26 programmes), **zéro erreur de console**, `uMppFacteur = 0` **relevé**, et
   deux tests qui figent les expressions éteintes au caractère près. **Ce n'est pas une image
   de la planète, et je ne la présente pas comme telle.**
10. ⚠️ **`uResRefM = 17,83 m` déplace le seuil du fondu.** Contours pleins sous ~24 km, éteints
    au-delà de ~64 km d'altitude. **C'est un choix de calibrage**, dérivé de `ZOOM_SOCLE` et de
    la tuile AWS 256 — pas une mesure perceptive. **Un seul nombre à bouger si Adrien le
    trouve mal placé.**
11. ⚠️ **Une mutation reste équivalente et je le dis** : rendre `uTilePx` conditionnel dans
    `_materialFor` ne change rien, parce que `uTilePx` n'est pas dans `this.uniforms`. Elle a
    été **retirée** de la campagne plutôt que comptée comme tuée — 37/37 porte donc sur 37
    mutations réellement discriminantes.

---

## ⑥ CE QUE MON BANC A FAILLI ME FAIRE ÉCRIRE — trois pièges attrapés

1. **`uContourOpacity = 0`** : le terme mesuré était multiplié par zéro. « 0 pixel changé » ne
   voulait pas dire « ce terme n'y est pour rien ».
2. **Le grain de pellicule animé** : deux rendus consécutifs différaient de **12,5/255 sur
   92,9 % des pixels** avant que je ne l'éteigne — un plancher de bruit plus grand que l'effet
   cherché.
3. **Un banc qui gardait la valeur d'un uniforme qu'il venait lui-même de remettre à zéro** :
   une comparaison avant/après a rendu **0 pixel de différence** alors que les deux branches
   étaient identiques. Le témoin était nul **parce que le banc ne comparait rien** — corrigé,
   la même mesure rend 58,1 %.

## ⑦ TRACES SUR LE DISQUE

`.banc/vues-K/` (151 fichiers) · `.banc/mutations-K.mjs` · `.banc/serveur-vues-K.mjs`.
Les JSON de mesure brute : `40-nadir-mesures.json`, `41-iso55-mesures.json`,
`60-nadir-courbes.json`, `71-iso55.json`, `80-nadir.json`, `90-duo.json` (l'Étape 1),
`E0-avant-apres.json` (l'après). **Tout chiffre de ce rapport y remonte.**
