# PLAN DE FUSION — carte de secours de la campagne R

> **Adrien, 2026-08-23 :** *« Quand tu auras fini tu mergeras toutes les
> avancées. »*
>
> **Adrien, 2026-08-31, avant d'aller se coucher :** *« reprends la suite de la
> reconstruction sur toutes les options utiles pour ce qui est du mode sphère.
> (…) travaille sans t'arrêter, utilise les skills qu'on utilise habituellement. »*

⚠️ **Ce fichier est la carte de secours.** S'il y a coupure, il dit où est chaque
travail et comment le recoudre. Les branches, elles, survivent dans git.

---

## L'ÉTAT AU 2026-09-01, 00 h

**Arbre de fusion : `C:\Dev\wt-merge`, branche `regroupement`.**
**4 572 tests · 0 échec · `audit:tests` 237 = 237.**
✅ **LES CINQ TÂCHES SONT FUSIONNÉES.** Il n'y a plus de branche dehors.

⚡ **Les sept drapeaux sont levés dans `src/flags.js`** — la sphère est le mode de
démarrage. L'URL `?terre=unique&globe=continu&…` ne sert plus à rien.

### Fusionné

| tâche | sujet | branche |
|---|---|---|
| R4→R9 | repos, boutons, dalles, mer, planète éclairée, côtes, jour/nuit, satellite | fusionnées |
| R13 | le pivot de rotation sur le bloc | `pivot-bloc` |
| R18 | le fond marin | fusionnée |
| R19 | les courbes de niveau du crop | `courbes-crop` |
| **R20 bis** | **les nuages — 14 curseurs sur 15 vivants** | `nuages-globe` |
| **R22** | **les parois du bloc et la grille — 4 sur 4, + l'encre de grille en prime** | `parois-grille` |
| **R20 ter** | **le ciel par défaut se voit — ×2,3 à ×16 de pixels selon le lieu** | `nuages-globe` |
| **R23** | **le geste continu, la caméra hors du sol, et le retour à l'orbite** | `vitesse-camera` |
| **R24** | **les points cotés (0 → 14), les sommets bornés, `cities.json` supprimé** | `toponymie-globe` |
| **R21** | **l'éclairage — 6 branchés, 1 déjà vivant, 1 sans objet et caché** | `lumiere-crop` |

**Périmètres attribués, pour que les fusions ne se battent pas :**
- R21 → `light-panel.js`, `eclairage-crop.js`, le nuanceur de `globe.js`
- R22 → `parois-crop.js`, `habillage-crop.js`, le nuanceur de `globe.js`, `map-panel.js`
- R23 → `modes.js`, `zoom-continu.js`, `pivot-bloc.js`, `descente-bornee.js`
- R24 → `peaks.js`, `labels.js`, `cartouche-globe.js`, `sol-globe.js`

⚠️ **R21 et R22 se partagent le nuanceur de `src/globe.js`** — c'est le seul
recouvrement assumé. **Fusionner R22 en premier** : sa grille et ses parois sont
structurelles, l'éclairage de R21 se posera dessus.

---

## L'ORDRE DE FUSION — épuisé

R22, puis l'arbitrage du ciel, puis R23, R24 et R21. **Tout est rentré.**

---

## LE CONFLIT CERTAIN, ET SA RÉSOLUTION

⚠️ **`package.json`, la ligne `test`, à CHAQUE fusion.** C'est une **liste
explicite de fichiers**, pas un glob : un test absent de la liste **ne tourne
jamais**. Ce défaut a déjà frappé ce dépôt.

**Résolution : l'UNION, jamais un choix de camp.** Le script est écrit, vérifié,
et écrit en binaire (donc pas de CRLF) :
`…\scratchpad\fusion-test.py` — il prend le fichier en argument, fait l'union dans
l'ordre, et **échoue bruyamment si un fichier est perdu**.

⛔ **Après CHAQUE fusion : `npm run audit:tests`**, qui compare la liste au
contenu du disque. Un écart = un test qui ne tourne pas.

---

## LA VÉRIFICATION DE FIN

1. `npm test` — **base à battre : 4 572 · 0 échec**
2. `npm run audit:tests` — **aucun écart**
3. **À l'écran**, comparé aux 39 images d'Adrien (`…\scratchpad\video\t01.jpg` …
   `t39.jpg`) : elles sont l'état AVANT de cette campagne.

⛔ **D17 : il n'y a PAS de production.** L'ancienne étape « drapeau baissé, la
production doit être rigoureusement inchangée » est **abrogée** — ne la remets
pas, elle a fait perdre du temps sur presque tous les briefs.

⚠️ **Le panneau navigateur de session ne composite pas toujours** — un banc a
compté « 0 image en 3,7 s ». **Un Chrome sans tête capture l'image composée** ;
patron dans `scripts/sonde-demarrage.mjs`.

---

## ⚠️ L'INVENTAIRE SE CONTREDIT LUI-MÊME EN UN POINT — vérifié

R24 a trouvé que l'option **21 (Sommets)** était donnée ⛔ dans le tableau brut
(lignes 272-273) alors que la **ligne 131 du même fichier dit « ✅ FAIT »** :
R18 l'avait déjà relogée, et le tableau gardait le relevé d'AVANT R18.

➡️ J'ai cherché si d'autres lignes étaient dans ce cas : **`grep` sur les
marqueurs « FAIT » rend une seule occurrence**, celle-là. Le compte des
47 options mortes n'est donc pas surestimé en général — mais **le tableau brut
est un relevé daté, pas un état courant**. Avant chaque nouvelle tranche :
relire la colonne de commentaire, pas seulement le pictogramme.

## CE QUI RESTE OUVERT APRÈS CETTE VAGUE

**Les options mortes du studio** (`inventaire-studio-2.md`), une fois R21/R22/R24
rentrées : il restera ~14 des 47, essentiellement
- **le sélecteur de matière de surface (17 vignettes)** — le globe n'a pas de
  matière PBR de relief ; c'est la plus grosse pièce restante ;
- **nuit (2) et canopée (1)** — des couches éteintes par défaut ;
- **l'automatisation de caméra (2)** — le bouton ciné, éteint exprès parce qu'il
  laissait la caméra **862 m sous le sol** ;
- **la mise au point auto au pointeur (1)** — le flou est inerte.

**Défauts déclarés, non corrigés :**
- `GL_INVALID_OPERATION` à chaque image composée — tracé à un `blit` entre
  `DEPTH_COMPONENT24` et `DEPTH_COMPONENT32F` ;
- le clic sur le globe qui saute onze fois ;
- le saut résiduel ×1,156 au changement de bloc ;
- **la caméra passe encore sous le sol 12 images sur 7 569** (0,16 %) après R23,
  contre 450 sur 505 avant — réserve écrite au §⑥ de `rapport-R23.md` ;
- machine lente ×10 → la bascule de trois quarts arrive à 11,98 s ;
- le bouton photo aérienne inerte hors 16 pays (**arbitrage produit**) ;
- le crop est désormais **plus lisse que le socle** — le grain n'a pas été porté ;
- **la bande 1 147–1 274 km sans nuages** (réserve de R20) ;
- ⚠️ **ARBITRAGE POUR ADRIEN — `cloudAltitude` est en unités de BLOC, pas en
  mètres.** C'est la cause du défaut ci-dessous ; le plancher marin n'en corrige
  que le symptôme. L'exprimer en mètres réels le réglerait partout, **mais
  déplacerait le ciel de TOUS les gabarits enregistrés** — donc l'aspect du
  travail de design d'Adrien. **Ne pas trancher seul.**
- la question ODbL « conserver et redistribuer » pour les modèles vendus.

**Le mode plat n'est pas supprimé.** Adrien le veut ; l'ordre à tenir est
**reloger les couches du bloc → PUIS supprimer → PUIS optimiser**.

---

## ⚠️ CE DOSSIER EST IGNORÉ, MAIS SES FICHIERS SONT SUIVIS — nuance qui piège

`git add .superpowers/sdd/2026-08-22-globe-studio` **échoue** : le dossier est
ignoré. Mais les fichiers qui y sont déjà suivis le restent, et **ils fusionnent
normalement**. Les deux conséquences :

1. **Un fichier NOUVEAU dans ce dossier ne s'ajoute qu'avec `git add -f`.** Sans
   le `-f`, un rapport reste sur le disque, ne part jamais, et disparaît avec
   l'arbre de travail.
2. **Un nouvel arbre de travail REÇOIT les fichiers suivis** (règles, briefs,
   rapports déjà commités) puisqu'ils sont dans l'index — inutile de les recopier
   à la main, contrairement à ce que j'ai d'abord écrit ici.

⚠️ **Vérifier après chaque fusion que le `rapport-RXX.md` de la tâche est bien
arrivé** : s'il manque, l'agent l'a écrit sans `-f`, et il faut aller le chercher
dans son arbre.

### ⛔ ④ NEUVIÈME occurrence de la classe « unités » — les nuages sous la mer

Trouvée par R20 en pleine mer, et invisible partout ailleurs. `uSeaY` vaut
**−1,80** à La Réunion, **−6,91** aux Alpes, **+13,05 au large du Pacifique** :
la verticale du bloc est normalisée sur l'amplitude **locale** du relief. Au
large, toute la colonne de nuages (7,43 → 13,50) passait **sous l'eau** —
**0 pixel sur 1 024 000, avant comme après**.

Correctif : plancher `Math.max(base, mer + 0,5)`, **neutre au bit près** là où la
mer est déjà dessous (Réunion et Alpes ne bougent pas d'un flottant, vérifié).

⚠️ **Et le défaut n'était pas où on le cherchait** : le littéral `params` de
`main.js` pose `cloudsEnabled: false`, `cloudAltitude: 1`, `cloudOpacity: 2,25`,
alors que l'appli démarre avec `true`, `13,5`, `0,6`. **La vraie source est
`public/templates/defaults/shibustart.json`.** Régler `main.js` n'aurait rien
changé à l'écran. Un test garde ce chemin.

## MESURÉ LE 2026-09-01 À L'ÉCRAN — deux constats qui n'étaient pas au dossier

### ⛔ ① On ne peut PAS revenir au globe en dézoomant. Le cran survit au retour.

Relevé sur `window.__exp`, La Réunion, mode par défaut, molette poussée à
saturation puis `modes.stepWider()` appelé directement :

| | `_levelZoom` | `_empriseVue` | `altM` | `dist` | mode | crop |
|---|---|---|---|---|---|---|
| avant | 0,099284 | 27 354,269 m | 18 684 m | 149,38 | surface | oui |
| après | 0,103424 | **27 354,269 m** | **18 684 m** | **150,00** | surface | oui |

`stepWider` est **saturé** : l'emprise ne bouge pas d'un mètre, `dist` tape la
butée `maxDistance = 150`.

⚡ **Le crop meurt à `SEUIL_MORT_M = 40 342,8 m`. La butée plafonne l'altitude à
18 684 m — 46 % du seuil.** Le crop ne peut donc **jamais** mourir en dézoomant.
La seule sortie est `modes.enterOrbit()`, c'est-à-dire **un bouton** : exactement
le cran que D16 supprime, dans le sens du retour.

⚠️ **Ne pas remonter `maxDistance` sans réfléchir** : la butée (150, unités de
bloc) et le seuil (40 342,8 m) vivent dans **deux espaces différents**. C'est la
classe de défaut revenue neuf fois. → confié à **R23**.

### ⚠️ ② Le palier machine se calcule sur un écran 0×0 dans le panneau

`window.__palierMachine.signaux.ecran` rend **`[0, 0]`** alors que
`window.innerWidth/Height` rend 1280×720. La raison affichée le dit :
*« 0×0 à densité 1 = 0.0 Mpx → charge légère »*.

Le palier était à **PLEINE QUALITÉ** (`ombres: "dynamic"`, `ombresRes: 1024`,
`grain: true`, `dof: true`, `ssao: false`, **`nuages: 0`**) — mais la bannière
**« PERFORMANCE — ESSENTIAL MODE »** s'était affichée en plein écran pendant le
chargement de cette même page.

⛔ **Le palier éteint les ombres et le grain avant les curseurs du studio.** Toute
mesure d'ombre, de grain ou de nuages doit relever `window.__palierMachine`
**dans le même relevé**, sinon elle attribue au curseur ce que fait le palier.
→ signalé à **R21**.

### ✅ ③ La réserve de R22 sur la vue orbitale est levée — vérifié à l'écran

R22 écrivait : *« rien de vérifié à l'écran sur la vue orbitale (invariance
prouvée arithmétiquement seulement) »*. Fait le 2026-09-01 sur `regroupement`
fusionné, `modes.enterOrbit()`, altitude **5 795 km**, océan Indien / Madagascar :

- `gridOpacity = 0,9` → **le graticule se voit**, méridiens et parallèles
  distincts sur l'océan comme sur la terre ;
- `gridOpacity = 0` → **ils disparaissent entièrement**, aucun résidu.

Le fond marin de R18 se lit aussi en clair à cette altitude (zones de fracture
de la dorsale), et le relief de Madagascar est hypsométrique, pas nu.

⚠️ **Un point à ne PAS confondre avec la planète nue** : juste après
`enterOrbit()`, la caméra se pose à **29 381 m** (`dist = 100,46` pour
`R_GLOBE = 100`) et l'écran est alors un **aplat olive uniforme** — c'est le
niveau de tuile non encore raffiné à cette altitude, pas D15 qui aurait lâché.
Dès qu'on dézoome, le relief et la bathymétrie arrivent. **Mesurer avant de
crier au retour du défaut filmé.**

### ✅ ⑤ Le ciel par défaut se voit — vérifié à l'écran après fusion

La Réunion, réglages par défaut, profil vierge : **un nuage franc au-dessus de la
mer**, là où l'écran était vide avant l'arbitrage. Le grain, l'écume et la
bathymétrie de bord se lisent aussi.

⚠️ **Piège d'environnement rencontré en le vérifiant, à ne pas prendre pour une
régression** : le premier chargement est resté **~40 s** sur *« generating
terrain… »* avec `globe._crop = false` et une pluie de 404 et de
`ERR_CONNECTION_TIMED_OUT` en console. Vérifié à la source **avant de conclure** :

| hôte | état |
|---|---|
| `tiles.mapterhorn.com` | **200** sur z0/z2/z5/z12 · **404** sur deux tuiles d'océan (couverture creuse, comportement normal) |
| `s3.amazonaws.com/elevation-tiles-prod` | **200** partout, 115 Ko — le repli fait son travail |
| `nominatim.openstreetmap.org` | 302, sain |
| **`overpass-api.de`** | ⛔ **délai dépassé à 12 s** — c'est la source des sommets, donc de R24 |

➡️ **Le réseau était dégradé, pas le code** : la page a fini par se charger seule.
⚠️ Mais quatre agents plus moi tapions les mêmes fournisseurs en parallèle —
**une mesure de chargement prise pendant une campagne parallèle ne vaut rien.**

---

## LA SEULE COLLISION DE LA VAGUE, ET LE GARDE-FOU QU'ELLE A PRODUIT

R21 et R22 se partageaient `poserHabillage` — le recouvrement annoncé. Résultat à
la fusion : **six tests de GRILLE en échec, aucun ne parlant de lumière**, sur
`TypeError: Cannot set properties of undefined (setting 'value')`.

Cause : R21 ajoute `uAppointDir`, `uAppointIrr`, `uSlopeTint` ; la **table
d'uniformes factices** de `test/grille-crop.test.js` ne les déclarait pas.

⚠️ **C'est la DEUXIÈME fois** : R22 avait déjà vu treize tests tomber d'un coup
sur la même table. ⛔ **Ajouter l'uniforme manquant ne suffit pas** — c'est ce
qu'on a fait deux fois.

✅ **Garde ⑨ ajoutée** : elle extrait le corps de `poserHabillage` dans
`src/globe.js`, y relève tout `u.uXxx`, et compare à la table du test. **Vérifiée
en la cassant** : elle rend *« la table factice de ce fichier ne déclare pas :
uSlopeTint »* — le nom du coupable, que l'erreur d'origine ne donnait pas.

### ⚠️ Et j'ai payé un piège d'édition en l'écrivant

Mon script Python a écrit la regex `/\bu\./` avec un `\b` **interprété comme un
retour arrière** (0x08) : le test trouvait **0 uniforme sur 68** et se déclarait
« garde inopérante ». Il ne servait à rien tout en étant vert de justesse.

➡️ **C'est le cousin exact de l'incident CRLF** déjà consigné : *un script
d'édition qui écrit du texte non littéral corrompt en silence*. Écrire en
binaire ne suffit pas — **relire l'octet écrit** (`grep | cat -A`) quand on pose
une expression régulière ou une séquence d'échappement.

---

## ⛔ LE BARÈME DE L'INVENTAIRE EST PARTIELLEMENT SOUS LE BRUIT — mesuré, pas supposé

L'inventaire déclare ✅ à partir de **`moy ≥ 0,06` ou `grad ≥ 0,12`**. R21 a
établi que le banc porte un transitoire de **~0,17 / 0,33**, une mesure sur
douze, cause **non identifiée** (`dRetour` nul en 2,7 s).

⚡ **Un transitoire ne peut qu'AJOUTER : il fait un faux ✅, jamais un faux ⛔.**
Les 47 options mortes sont donc hors de cause. Mais **sept des 72 ✅ ont leurs
deux grandeurs dans la bande** :

| option | moy / grad |
|---|---|
| **98** | 0,081 / 0,138 |
| **36** | 0,122 / 0,089 |
| **91** | 0,140 / 0,236 |
| **120** | **0,162 / 0,326** — *le chiffre du transitoire à la troisième décimale* |
| **11** | 0,178 / 0,355 |
| **56** | 0,184 / 0,318 |
| **24** | 0,188 / 0,320 |

⚠️ **Aucune n'est déclarée fausse** — la corrélation n'est pas la preuve. Mais le
**point d'étalonnage du barème (91) tombe lui-même dans la bande**, et n'a
survécu que parce qu'une **capture d'écran** l'a confirmé, pas son chiffre.

➡️ **RÈGLE : entre 0,06 et 0,19, un relevé unique ne décide de rien.** Il faut
une répétition, ou une preuve d'une autre nature (capture, différence par
construction). Toute tranche future qui rouvre une de ces sept doit **remesurer
avant de conclure**.

### Deux acquis de méthode de la même passe

✅ **Faire se désigner ce qu'on mesure, plutôt que le chercher.** La paroi du crop
est une bande étroite qu'une moyenne d'image noie. R21 a rendu **deux images au
même instant**, l'uniforme de la seule paroi mis à zéro dans la seconde : tout
pixel qui diffère **est** un pixel de paroi, par construction. 0 pixel sur
1 024 000 au témoin, 39 799 à l'appoint 0,6, 55 591 à 3.

⚠️ **Un ralentissement qui ne mesure pas la cadence ne teste rien.** La première
tentative à ×8 laissait la cadence assez haute pour que « palier inchangé » soit
un faux négatif. À ×20 et ×60 (57 → 14 puis 0,44 i/s), le palier bascule 3 fois
sur 3 — **et c'est ce qui l'innocente** : l'amplitude ne colle pas (0,038 ou
1,468, jamais 0,17) et `UP_SUSTAIN` vaut 12 s par cran contre 2,7 s observés.

### ✅ Trouvé sans le chercher, puis tranché par R26 : une temporisation déguisée

La porte **« plus aucune tuile en vol » expirait à ses 45 s à CHAQUE chargement,
sans exception** : il reste 4 à 9 tuiles `empty` que rien ne remplira jamais.
Ce n'était pas une condition, c'était un `sleep(45 s)` sous un autre nom.

⚡ **R26 A TRANCHÉ — ET L'ALARME ÉTAIT FAUSSE, C'EST UN BON RÉSULTAT**
(`rapport-R26.md`). Les tuiles résiduelles ne sont **demandées par personne** :
`demanderEmprise` (`monde/flux-terrain.js`, étape 2) les rend à `empty` quand
l'emprise du socle bouge **en plein vol**, et `_horsCropSeul` les écarte ensuite
à la première ligne de `_traverse`. **Pas de fuite de places, pas de point
fixe** : 112 entrées sur 1 700 au repos, `_refus` = 0, `_evictJusqua` jamais
appelé, crédit restant 1 619/1 700. Sous **15 min d'usage** la population
**oscille entre 28 et 37** — elle ne grandit pas.

✅ **Corrigé** : `Globe.tuilesEnVol()` (`src/globe.js`), **une seule définition**,
appelée par les **TROIS** sondes qui portaient la formule fautive
(`sonde-lumiere-r21.mjs`, `sonde-transitoire-r21bis.mjs` et
`sonde-paroi-r21bis.mjs` — la troisième n'avait jamais été repérée).
**43,4 s gagnées par mesure de banc, 0 ms à l'écran** : le défaut était dans le
banc, pas dans le moteur.

⚠️ **Les chiffres de `rapport-R21.md` restent valables** — mesuré sur 3
chargements avant de corriger : entre la fermeture de la porte corrigée (1,7 s)
et la 45ᵉ seconde, **0 tuile n'arrive et 0 requête ne part**. En revanche un
temps de PRÉPARATION relevé avant R26 ne se compare plus à un relevé d'après :
c'est le banc qui a changé, pas la scène.

---

# ÉTAT AU 2026-09-01, SOIR — 4 667 tests · 0 échec · audit 241 = 241

**Seize tâches fusionnées.** Aucune branche dehors.

## ⚡ LE RÉSULTAT QUI VAUT POUR TOUTE LA SUITE

**« Viser le centre de la Terre » et « zoomer vers le curseur » sont la MÊME
quantité, et donc incompatibles.** Démontré, pas supposé : une homothétie de
centre `P` et de rapport `f` se décompose **exactement** en

> *(recul pur autour de la cible)* + *(translation rigide `δ = (1−f)(P−T)`)*

La sortie d'axe **est** `δ`. Et `δ` est **aussi** ce qui garde immobile le point
sous le curseur. **Retirer l'un retire l'autre.**

✅ **Arbitrage d'Adrien, 2026-09-01 : « je garde ».** Hors du crop, `δ` est
abandonné — zoom radial, comme le bouton. **Sur le crop, le zoom vers le curseur
est intact.** Coût accepté : au-dessus de 40 343 m la molette zoome vers le
centre de la Terre. Le prédicat est **une ligne isolée** si l'arbitrage change.

Mesuré : **96,2 % → 14,1 %** d'images hors axe, les 341 restantes formant **un
seul segment** de 12,899 u à 0, **zéro remontée**.

## ⛔ POURQUOI DEUX PASSES ONT DÉCLARÉ CE DÉFAUT RÉGLÉ À TORT

**Elles ont mesuré `cranZoom` — le chemin des boutons — qui ne touche JAMAIS la
cible.** Elles ont donc prouvé la règle sur le seul chemin où elle était déjà
vraie, et publié « écart : exactement 0 ». Le chemin de la molette est
`_applyZoom`, qui met **caméra ET cible** à l'échelle autour du curseur : la
cible sortait de l'axe sur **2 291 images / 2 361 hors crop (97 %)**, jusqu'à
**12,8964 u = 50 375 m = 616 px**.

➡️ **RÈGLE : un correctif de geste se mesure sur le GESTE, jamais sur l'API qui
lui ressemble.** Compter les appels côté gestionnaire, maillon par maillon.

## LES TROIS DÉFAUTS D'INSTRUMENT DE CETTE PASSE, tous chez le mesureur

1. ⛔ **Le voile d'accueil `.ce-hubveil` avale TOUS les gestes** — 32 crans
   envoyés, **0 reçus**. `d = 145,5` n'est que `150 × 0,97`. Mes quatre nombres
   « le zoom est bloqué » étaient **les trois premiers crans derrière un voile**.
   ⚠️ Les quatre sondes de la campagne le retiraient en première ligne :
   **personne n'avait mesuré ce que voit un visiteur.** `hub.js` n'avait aucun
   écouteur `wheel` — ajouté depuis.
2. ⛔ **La pose de démarrage arrive après un vol de 8,3 s**, et la caméra est
   **immobile à 26,38 pendant cinq secondes AVANT** ce vol. « Attendre la
   stabilité » ne suffit donc pas : on mesure un état qui n'est pas l'état final.
3. ⛔ **Une sonde posée dans `controls.update` lit trop tôt** :
   `redresserSurLeSol` écrit `camera.position` **sans** rappeler
   `controls.update()`. Sol sous la caméra, mêmes gestes :

| | dans `controls.update` | **AU RENDU** |
|---|---|---|
| avant | 42/16 761 · −8,1405 u | 16/10 343 · **−3,5993 u** |
| après | 24/16 743 · −4,4590 u | **0/10 341 · 0,0000 u** |

⚠️ **Le témoin interdit d'en faire une excuse** : **16 images DESSINÉES** sous le
sol avant correctif. Le défaut était réel ; c'est son amplitude qui était
surestimée.

**La cause du sol** : la butée tournait **57 lignes AVANT `_applyZoom`** dans
`tick()` — le dernier code à poser la caméra était le zoom, et plus rien ne
regardait le sol après lui. **C'était un ordre d'appel**, et c'était la réserve
n° 1 d'un rapport précédent, mot pour mot.

## RESTE OUVERT

- **Arbitrages d'Adrien** : `cloudAltitude` en unités de bloc (le corriger
  déplace le ciel de tous les gabarits) · le pivot/contraste de rampe **gradés
  sur le domaine du socle et consommés sur celui du globe** (ils ne coïncident
  qu'à z13 ; à z9 l'écart vaut 0,835 à La Réunion, 1,271 à l'Everest — le bloc
  n'a pas le même rendu selon le zoom d'ouverture).
- `target.y` garde **0,65 u** d'écart hérité du crop · la butée de sol **corrige
  au lieu d'empêcher** (24 images entre deux écritures) · le retour du pivot dure
  **5,7 s** · `GL_INVALID_OPERATION` par image composée · le clic sur le globe
  qui saute onze fois.
- ⚠️ **Sept des 72 options ✅ de l'inventaire ont leurs deux grandeurs sous le
  bruit du banc** (98, 36, 91, 120, 11, 56, 24). À remesurer avant de s'y fier.

---

# ÉTAT AU 2026-09-01, 20 h — sept agents en vol

**`regroupement` : 4 667 tests · 0 échec · audit 241 = 241.** Règles nouvelles :
**D19** (contrôles Google Earth : glisser = la Terre tourne autour de son centre ;
molette = vers le point au centre de l'écran) et **D20** (profondeur de champ :
même flou apparent à tout zoom, mise au point sous le pointeur avec repli au
centre, **active partout** — l'exception à « les effets seulement en crop »).

| tâche | sujet | arbre | branche |
|---|---|---|---|
| **R32** | le pivot = centre de la Terre jusqu'au crop — **confusion d'espace** : quatre passes ont mesuré l'axe du BLOC (le point de surface, `(0,y,0)` en unités de bloc) en l'appelant l'axe de la Terre | `wt-orb3` | `orbite-jusquau-crop` |
| ~~R33~~ | **FUSIONNÉ** (tests rouges seuls) — pivot à **6 263–6 297 km** du centre pour tout glissé vertical ; glissé H = lacet (0,0000° contre 47,97° en orbite) ; 9 rouges sur 10 dans `test/attaque-r33-ROUGE.mjs` | `wt-att2` | `attaque-pivot-globe` |
| **PF1** | le profil : qui consomme, trois postes de vue × trois machines émulées, sonde commune `scripts/profil-pf1.mjs` | `wt-pp1` | `perf-profil` |
| **PF2** | priorité des tuiles : visible d'abord, centre d'abord, à la Cesium (SSE, file de priorité, annulation) | `wt-pp2` | `perf-priorite` |
| **PF3** | mer et effets seulement en crop — **sauf `dofPass`, active partout (D20)** | `wt-pp3` | `perf-crop-seul` |
| **PF4** | les bugs qui coûtent : `GL_INVALID_OPERATION`, rotation propre vs rendu à la demande, palier 0×0, clic qui saute, voile | `wt-pp4` | `perf-bugs` |
| ~~R34~~ | **FUSIONNÉ** — flou en px identique à 130 km / 2 000 km / 15 000 km (29/12/1/12/30) ; la cause était `near`/`far` copiés une fois par valeur, pas le 130,4 ; 4 675 · 0 | `wt-dof` | `flou-zoom` |

⚠️ **Nommage** : la campagne performance s'appelle **PF1→PF4** — les `brief-P2.md`
/ `rapport-P2.md`… sont une campagne **antérieure**, ne pas confondre.

**Ordre de fusion prévu** : R33 (tests rouges, `src/` vide) → R32 → PF4 (format
de profondeur) → PF3 (passes) → R34 (paramètres du flou, dépend de PF3 laissant
`dofPass` active) → PF2 (`globe.js` cache) → PF1 (sondes seules).
Le script `fusion-test.py` pour `package.json` à chaque fois, puis `audit:tests`.

---

# ⛔ SUSPENSION DU 2026-09-02, 22 h 58 — limite de session atteinte, cinq agents tués

Les cinq agents en vol sont morts sur `HTTP 429 — session limit, reset 00:50
Europe/Berlin`. **Rien n'est perdu : chaque arbre garde son travail.** État relevé
à 22 h 58 :

| tâche | arbre | commits au-dessus de `regroupement` | fichiers modifiés non commités | rapport |
|---|---|---|---|---|
| **R32** pivot centre de la Terre | `wt-orb3` | 0 | **7** | `rapport-R32.md` (partiel) |
| **PF1** profil | `wt-pp1` | 1 | 0 | `rapport-PF1.md` (à vérifier : complet ?) |
| **PF2** priorité tuiles | `wt-pp2` | 1 | 3 | — |
| **PF3** mer/effets crop seul | `wt-pp3` | 2 | 0 | — |
| **PF4** bugs | `wt-pp4` | 0 | 5 | — |

**Consigne d'Adrien : relancer tout à 00 h 59.** Procédure, par arbre :
1. `git status` + `git log regroupement..HEAD` + lire le rapport partiel s'il existe ;
2. **tenter d'abord `SendMessage` sur l'agent d'origine** (son contexte survit à
   la coupure) avec : « tu as été tué par la limite de session ; ton arbre
   contient X commits et Y fichiers modifiés ; reprends depuis là, ne refais pas
   ce qui est commité » ;
3. si l'agent ne répond plus : **re-dispatcher un agent neuf** avec le même
   brief, plus le paragraphe « lis d'abord `git status`, `git diff`, et le
   rapport partiel — c'est l'état d'un prédécesseur, continue-le » ;
4. R32 reçoit en plus la direction du soir : **deux pivots pour deux gestes** —
   rotation rigide caméra + cible autour du centre de la Terre pour le glissé
   (le motif de `pivoterAutourDuBloc`, axe changé hors crop), inclinaison
   inchangée autour de la cible de surface ; l'objection « le bloc ne suivrait
   pas » est **fausse** (`passeSurface.enabled = false`, rien à faire suivre).
5. Tout brief de mesure porte la consigne : **ne jamais rendre la main « en
   attendant » un banc** — attendre dans la même exécution.

Base au moment de la suspension : **4 675 tests · 0 échec · audit 241 = 241**
(R33 et R34 fusionnés). Ordre de fusion prévu inchangé : R32 → PF4 → PF3 → PF2 → PF1.

---

# LE PROFIL PF1 — 2026-09-03, 01 h — fusionné (sondes seules, `src/` intact)

**L'image est bornée par le CPU principal, pas par le GPU.** Carte réelle :
GPU 0,2–2,7 ms partout ; tick CPU **10–36 ms** sur CPU ×4/×6. GPU logiciel
(portable sans carte) : **337–490 ms/image**, 85–89 % dans le nuanceur des
tuiles, 11–15 % dans l'EffectPass.

| poste (CPU ×4/×6) | part de l'image | qui |
|---|---|---|
| `renderBufferDirect` — **un matériau par tuile, 128 uniformes, 330–637 matériaux** | **23–41 %** | PF4 |
| `updateMatrixWorld` de 346–982 maillages **immobiles** + `projectObject` | **17–21 %** | PF4 |
| `contexteCrop()` **reconstruit à chaque image** (au crop) | **14 % des échantillons V8** | PF4 |
| chargement : maillage + décodage **sur le fil principal** (orbite) | 10 % | PF2 |
| `_traverse` | 5–7 % | PF2 |
| GPU | 1–6 % | — |
| tout le reste (modes, nuages, eau, sommets…) | < 4 % cumulés | — |

⚡ **Le coût du « rien » : 100 % du tick.** Trois images figées consécutives
sont **identiques au bit** et rendues quand même, **13–24 ms de CPU chacune**.
Ce qui l'interdit : **la rotation propre** (+14,7 ms p50 en orbite ×4 ; 20–41
requêtes / 60 images sans geste ; cache poussé à **~1 700 tuiles, ~1,3 Go**) et
**le grain**, qui change chaque pixel. → rendu à la demande = PF4 ; grain éteint
hors crop = PF3.

**Réseau** : **70–84 % des requêtes d'un geste arrivent APRÈS le geste** — la
file n'est purgée que sous contre-pression, jamais déclenchée. `queue.sort`
**dans le `while` de `_pump`** : 0,5–1,2 ms/image, 8 ms en pointe. → PF2.

**Réfuté par PF1** : « le crop tourne 36 tuiles » est un nombre de *draws*, le
cache en garde **406–442 pour 24 draws** ; le tas est plat ; **zéro**
recompilation de nuanceur en usage ; la SSE vraie ne gagne **0 ms** ici (levier
de justesse, et charge *plus* sur Retina). ⚠️ 17–33 Chrome d'autres agents
tournaient pendant la mesure : les valeurs absolues ×4/×6 bougent jusqu'à ×1,8,
**la répartition est stable** — c'est elle qui compte.

Sonde commune : `node scripts/profil-pf1.mjs --port <port>` (`--machines`,
`--postes`, `--cpuprofile`, `--swiftshader`), traces sous `traces-PF1/`.

---

# 2026-09-03, ~03 h — R32, PF4, PF2 fusionnés · 4 717 tests · 0 échec · audit 248 = 248

**✅ R32 — le pivot est le centre de la Terre jusqu'au crop, pour de bon.**
Recette de l'attaquant R33 : **10/10**. Avant → après (1 977 / 130 / 50 km) :
centre de la Terre à l'écran **1 200–3 300 px → 0 px** ; sol parcouru par 200 px
de glissé 0,000° → **5,44° / 0,354° / 0,136°** ; angle rasant 50–68° → **0°** ;
`|Δ ln d|` **0,0** ; point saisi ↔ curseur **200 px → 0–0,2 px** (D19) ; point du
centre sous la molette ≤ 1,4 px. Mécanisme : **translation rigide** caméra +
cible dans le plan du bloc — la similitude étant ancrée sur l'aplomb de la
cible, c'est pour la caméra qui rend une rotation autour du centre de la Terre à
altitude constante (vérifié : axe < 100 km du centre, altitude à 50 m). Écrire
`controls.target` au centre aurait donné `R_bloc = 1 630 u` pour `h = 33 u` : un
cran de 3 % = 190 km sous le sol. `pivot-terre.js` **supprimé**, `saisie-terre.js`
et `pivot-globe.js` créés, quatre tests qui gravaient la confusion réécrits.
Bonus : le point sous la caméra sautait de **466 km à z4 … 550 km à la traversée**
à chaque franchissement de niveau → 0.
Réserves : bloc centré au calage près sur le crop (≤ 9,33 u) ; retour au nadir
inachevé sur le chemin « vue couchée puis molette » (84,9°, préexistant).

**✅ PF4 — les bugs.** `GL_INVALID_OPERATION` : pas un format 24/32F — *« read and
write depth attachments cannot be the same image »* (clone partagé par three
r172) et **SMAA déclarait DEPTH sans la lire** → `profondeur-compositeur.js`,
0/616. « ESSENTIAL MODE » au chargement : le **gouverneur** mesurait la rafale
d'arrivée → `accalmie-gouverneur.js`, palier 0 tenu 100 s à ×4. Rotation propre
(choix v29) gardée, **cadence de repos** (`cadence-repos.js`) : orbite ×4
**31,9 → 13,5 ms** animé, **17,2 → 4,5 ms** figé. Voile : c'était `.ce-elemwrap`,
glissé/double-clic ferment. Clic qui saute : tracé (butée 150 u abroge la
continuité, puis 70 % en une image), non corrigé.
**En cours (PF4 bis)** : matériau partagé des tuiles (23–41 %),
`matrixAutoUpdate=false` (17–21 %), `contexteCrop()` mémoïsé (14 %).

**✅ PF2 — priorité des tuiles.** 20 premières tuiles dans le tronc 80–100 % →
**100 %** ; tuile sous le centre au **rang 0–3** par niveau (avant : rang 84–118
à z10, jamais à z11–12) ; rotation : demandes hors tronc **100 % → 0 %** ;
descente **21,7 → 16,3 Mio (−25 %)** ; cache hors tronc à 1/5/15 min
**114/233/614 → 11/72/346** ; `_traverse` ×4 p99 5,5 → 3,6 ms ; décodage
terrarium en **Worker**. Sept correctifs, sept tests rouges. Réfuté : SSE =
vitesse (non), le tiers central comme dénominateur (trop étroit pour des z6), le
« glissé de planète » existait (non — R32 l'a créé depuis).

**En vol** : PF3 (mer et effets au crop seul, `dofPass` active partout), PF4 bis.

**✅ PF4 bis — les leviers CPU, fusionnés · 4 722 · 0 · audit 249 = 249.**
Ce qui décide : les bancs PF1 *entre sessions* ne tranchent rien (le
ralentissement mesuré varie de ×4,0 à ×4,5 et de ×5,2 à ×7,8 pour la même
demande) → **A/B dans la même session**, alterné avec retour.
- **Matériau partagé** (`monde/materiau-tuile.js`) : `composer.render` p50
  **4,7–4,9 → 3,9–4,0 ms (−17 %)** à ×4 ; borne sans téléversement 1,8 ms (−60 %)
  — les −60 % exigent un UBO pour les 120 uniformes partagés, **non fait,
  chiffré**. Orbite identique au bit. `?tuiles=amont`.
- **Matrices figées** (tuiles, mer, parois, **et `globe.group` + `sceneGlobe`**,
  sinon three propage `force`) : **−15 %**. Vérifié de loin (`--scenario
  pixelab`, quatre hachages égaux). `?matrices=amont`.
- ⛔ **`contexteCrop()` : PF1 RÉFUTÉ.** Chronométré en page : **5,3–6,8 µs par
  appel**, pas 14 % de l'image. Mémo écrit, mesuré, **retiré** (60 lignes pour
  rien).
⚠️ **Le pixel n'est déterministe qu'en orbite** : surface et crop diffèrent
entre deux captures de la même variante (mer, nuages, caustiques à des phases
différentes ; 99,6 % avec grain, 89 % / 30 % sans). Tout A/B pixel hors orbite
se fait **dans la même session**.

---

# 2026-09-03, ~06 h — LA VAGUE EST RENTRÉE · 4 732 tests · 0 échec · audit 249 = 249

**✅ PF3 — la mer et les effets n'existent qu'en crop.** Un prédicat
(`dedansCrop()` = `veilleCrop.pose`), une fonction (`poserRegimeCrop()`, seule à
écrire `aoPass.enabled` et l'opacité du grain), appelée à la naissance/mort du
crop par le crochet `surBascule(pose)` — l'interrupteur par image de `tick()`
est retiré. **DoF intouchée, active partout (D20).** La mer n'avait rien à couper :
`globe._mer` est `null` hors crop. Ce qui était dessiné hors crop et ne devait
pas l'être : **le grain 0,26 du look de démarrage** (77 % des pixels, ±24
niveaux) et, sur demande, N8AO sur la planète (71 %). GPU : surface 130 km
×6 dpr2 Σ **22,6 → 15,4 ms** ; GPU logiciel **621,9 → 559,6 ms (−10 %)** — et
**D20 y coûte +247 ms en orbite** (bokeh rallumé) : à connaître pour les
portables sans carte. Crop identique **0 / 1 024 000**. Sur carte réelle le temps
d'image ne bouge pas : borné par `PasseFond` et le CPU.

## Bilan de la campagne performance (PF1→PF4), sur CPU ×4, orbite 2 000 km
| levier | gain | où |
|---|---|---|
| cadence de repos (rotation propre à 1/2, figé 1/30) | p50 **31,9 → 13,5 ms** animé, **17,2 → 4,5** figé | PF4 |
| matériau partagé des tuiles | `composer.render` **−17 %** | PF4 bis |
| matrices figées (jusqu'à la scène) | **−15 %** | PF4 bis |
| file de priorité, cache souple, Worker | **−25 % d'octets**, hors tronc 100 → 0 % en rotation, centre au rang 0–3 | PF2 |
| N8AO/grain hors crop | GPU ×6 dpr2 **−32 %**, logiciel −10 % | PF3 |
| `GL_INVALID_OPERATION` / gouverneur / voile | 0 erreur ; palier 0 tenu ; gestes qui ferment | PF4 |

## RESTE OUVERT, par ordre de valeur
1. ⛔ **`flyTo` → caméra `NaN`** (trouvé par PF3, non tracé) — `modes.js`.
2. **Le clic qui saute** — tracé par PF4 à la ligne : `_posePlongee` borne à
   `surfaceMaxDistance()` = 150 u (×4,41 en une image), puis `diveTo` lisse 30 %
   et `_loadDive` repose à `distancePresentation` (70 % en une image). `modes.js`.
3. **Le retour au nadir après la mort du crop** inachevé sur « vue couchée puis
   molette » (84,9°, préexistant) — R32 §réserves.
4. **UBO pour les 120 uniformes partagés** : −60 % de `composer.render` possible,
   chiffré, non fait (réécriture des déclarations d'un nuanceur de 192 uniformes).
5. **Arbitrages d'Adrien** : `cloudAltitude` en unités de bloc ; pivot/contraste
   de rampe gradés sur le domaine du socle et consommés sur celui du globe.
6. Sept options ✅ de l'inventaire sous le bruit (98, 36, 91, 120, 11, 56, 24).

**✅ R35 — les deux restes de caméra, fusionnés.** Le `flyTo` → NaN n'était
**pas dans `modes.js`** : `main.js:2209`, `tween.p1.copy(pos)` — le `flyTo(pos,
target)` de `main.js` (deux `Vector3`) est l'**homonyme** de `modes.flyTo(lat,
lon, zoom)` ; appelé avec un lat/lon, `Vector3.copy(-21.115)` rend `undefined`
et l'image suivante pose la caméra à NaN pour toujours. Correctif à la source :
`exigerPose()` (`camera-poses.js`) lève une `TypeError` nommant l'appel juste
avant la première écriture. Le clic : **×4,407 → 1,023** au premier clic, puis
**1,42 → 1,01** sur les sept suivants, centre de la Terre à 0 px, D16 ter tenu ;
en orbite un `travel` géométrique (altitude ÷2 sur 0,9 s), en surface une
translation rigide vers le point + distance ÷2. Réserve d'Adrien : le déclencheur
reste le **simple clic** (Google Earth : double-clic). Piège d'instrument neuf :
Vite sans `--host 127.0.0.1` n'écoute que sur `[::1]` — la sonde ne dessinait
jamais. **Plus aucun agent en vol.**

---

# CAMPAGNE BATHYMÉTRIE (B1→B4) — 2026-09-03 · **NOTÉE 9,33 / 10** (exigence : 7,5)

**Le vrai défaut n'était pas celui qu'on croyait.** Au repos, globe et damier
étaient d'accord (496,5 contre 488,0 m d'erreur moyenne) : le terrarium AWS
**porte de l'ETOPO1 jusqu'à z10**. ⛔ **La falaise était à z11** — fosse de la
Sonde, même session : **z10 → −7 067,6 m, z11 → 0,0 m**, écart globe/damier
**7 105 m**. Et **le globe ne demandait jamais `/data/bathy/`** : 544 requêtes
contre 0 en 54 s.

| critère | avant | après | note |
|---|---|---|---|
| fond en approche (Java z11) | 0,0 m | **−7 105,1 m** | 2,5/2,5 |
| accord globe/damier (mer Noire) | 2 200 m | **0,04–0,24 m** | 2,0/2,0 |
| relief, pas aplat | aplat 0,00 | pente 0,87–1,09 du damier | 1,0/1,5 |
| cascade vivante sur le globe | **0/189 requêtes** | **74 · 71 · 71**, zéro 404 | 1,5/1,5 |
| mers fermées + Caspienne | Casp. −29 · Médit. **0** | Casp. **−1 047,9** · Calypso **−5 135** | 0,83/1,0 |
| lacs | surface ±7 m | **Baïkal −745 m · Léman −296 m** | 0,5/0,5 |
| rien payé ailleurs | 4 748·0 | **4 755·0**, audit 253=253 | 1,0/1,0 |

**Bonus non demandé** : la plaine ionienne réparée **sur les deux chemins**
(0 → −3 686 m). Cause : `SHELF = −500` dans le tuileur — les tuiles purement
abyssales n'avaient **jamais été cuites**.

**Léman** : swissBATHY3D (swisstopo, 2 m, licence commerciale explicite),
404 tuiles, **3,22 Mo**, fond **310,05 m contre 309,70 m** CIPEL. Le pivot
retrouve le point le plus profond **à la position documentée sans qu'on la lui
donne**. Deux gardes indépendantes protègent la vallée du Rhône (sans elles,
**347,67 m** détruits : l'exutoire de Genève est sous la cote du lac).
**Baïkal : zéro octet ajouté** — son lit était dans GEBCO, il manquait la nappe.

## ⚠️ CE QUI RESTE OUVERT, remonté par le noteur
- **Hors Baïkal et Léman, tous les lacs du monde sont des plaques plates.**
  Quatorze sondés : le Baïkal est **le seul au monde** dont GEBCO porte le lit.
  Lacune de couverture, pas régression (Supérieur, Tanganyika, Titicaca sont
  exactement où B1 les avait laissés).
- **Le réseau DOUBLE au large** — coût assumé de la cascade vivante.
- **La Manche a bougé de 4 m**, soit **80 % de la tolérance** du critère
  éliminatoire. À surveiller au prochain travail sur le fond.
- **BlueTopo** cuisible (S3 public, CC0) mais gros téléchargement ;
  **Copernicus exige un compte** — décision d'Adrien. Les deux restent
  catalogués-non-cuits ; ⛔ **ne pas les retirer de `SOURCES` pour verdir un test**.
- Pour le 10 : plancher absolu d'étendue (+0,25) · mer Noire z12, qui **exige une
  cuisson** (+0,25) · ancrer Calypso sur la mesure de 2020, −5 109 m (+0,17).

## LEÇON DE MÉTHODE — le barème lui-même peut être faux
Deux seuils étaient **ancrés sur de mauvaises coordonnées** (Caspienne et
Calypso, à 80 et 200 km des fosses réelles) : ils exigeaient que la carte soit
fausse de 460 m. Le coordinateur a réancré **sans changer les seuils**, et le
noteur a **vérifié l'arbitrage avant de l'appliquer**, avec un décodeur réécrit
de zéro et une source **hors du dépôt** (`api.opentopodata.org`). Verdict :
arbitrage validé sur la Caspienne, **juste mais sur-argumenté** sur la
Méditerranée (B3 mettait les deux cas dans le même sac ; la plaine ionienne
ratait de 13 m, pas de 200 km). ➡️ **Un noteur qui applique un barème sans le
vérifier note la mauvaise chose.**

---

# 2026-09-03, soir — cinq agents en vol

| tâche | sujet | arbre | état |
|---|---|---|---|
| **BT-A** | audit BlueTopo — **fusionné** : côtes US justes à 6,08 m, mais **la carte cesse d'ajouter du détail à z8 (488 m)**, facteur 30 sur le catalogue ; la descente meurt sur un **plafond d'index**, zéro 404 ; le tuileur ignore `waterLevelM` → **lac Érié rendrait zéro tuile sans erreur** ; barème 7 critères, éliminatoire sur la non-régression | `wt-bt1` | ✅ |
| **BT-I** | intégration BlueTopo (reconnaissance de l'index vivant, cuisson Chesapeake, branchement, poids) | `wt-bt2` | en vol |
| **GE1** | spécification souris Google Earth (Web vs Pro, URL), état actuel mesuré, barème + tests rouges | `wt-ge1` | en vol |
| **GE2** | implémentation : clic droit, molette enfoncée, double-clic, modificateurs, menu contextuel, inertie — inclinaison **manuelle** partout, D16 ter pour l'**automatique** | `wt-ge2` | en vol |
| **B5** | **carrés plats autour des côtes du sud** (Hyères, Marseille) — piste n° 1 : la quantification à 1 m + `v = raw < 0 ? quantize : 0` fait tomber le platier ]−1 ; 0[ sur **0 = marqueur muet = terre** ; critère en **pixels de terre là où la vérité dit mer** | `wt-bat3` (B3 repris) | en vol |

**En attente de `globe.js` libre** (BT-I y touche peut-être) : le **raffinement
partiel** demandé par Adrien contre le flou de zoom — dessiner les enfants prêts
et ne garder le parent que sous les manquants (`_traverse`, boucle `pretes`,
`globe.js` ~8746), prélecture un niveau à l'avance, ne jamais évincer une tuile
dont le parent est dessiné, fondu parent→enfant. ⚠️ `test/veille-repos.test.js` ⑦
verrouille « le crop est dessiné par exactement les mêmes tuiles » — à réécrire,
pas à contourner.

⚠️ **Conflit prévu** : B5 et BT-I peuvent toucher `scripts/build-bathy-tiles.mjs`
et `dem.js`. B5 a ordre de le dire en tête de rapport ; fusion à la main.
| **R37** | **raffinement partiel** contre le flou de zoom (dessiner les enfants prêts, parent seulement sous les manquants ; prélecture ; pas d'éviction sous un parent dessiné) — `_traverse` ~8746, `veille-repos.test.js` ⑦ à réécrire | `wt-raf` | en vol |
| ~~GE2~~ | **FUSIONNÉ** — clic droit V = zoom (centre 0 px), clic droit H inerte (doc muette), milieu/Ctrl/Maj = inclinaison +20,31° et cap −50,000° à |Δln d| = 0, Alt = saisie seule 0,06 px, double-clic droit, inertie 4,35 °/s ; D19 glissé 0,00 px, molette 0,00 px, clic 1,0171, D16 ter 0,000° sur 1 194 images ; **arbitrage ouvert `PIVOT_VERS_LE_CURSEUR`** (double-clic : Google = curseur, D19 = centre) ; 4 774 · 0, audit 254 | `wt-ge2` | ✅ |
| ~~GE1~~ | **FUSIONNÉ** — référence Web/Pro avec URL ; **contradiction non tranchée** : Google publie « zoom toward cursor » (double-clic) et rien sur la molette, D19 dit « centre » ; barème C0 éliminatoire + C1–C8, 13 tests rouges (`GE_VISEE=centre|curseur`) ; ⚠️ **D19 §1 bimodale 5/8** (point saisi 0 ou ~752 px, facteur 4,65) — R32 sous-échantillonnée, pas contredite ; ⚠️ **le socle disait « le globe tourne seul à ~2 °/s » : témoin 0,000° sur 90 images et 5 s → à retirer du socle** ; Échap **fige** le vol de démarrage là où il en est | `wt-ge1` | ✅ |
| ~~R37~~ | **FUSIONNÉ** — le défaut vu par Adrien était **le recul** (zone nette qui redevient floue, 63–72 % du flou), pas le parent étiré : `demanderEmprise` jetait les tuiles prêtes du centre pour relire leurs hauteurs ; raffinement partiel + rechargement sur place + éviction protégée + prélecture au centre ; flou moyen **13 % → 3,9 %**, p90 50 % → **0**, recul **100 % → 0 %**, trous 0 ; `_traverse` 0,3/1,3 → 0,4/1,4 ms, requêtes 568 → 610 ; `veille-repos` ⑦ réécrit | `wt-raf` | ✅ |
| ~~B5~~ | **FUSIONNÉ** — les carrés plats du sud : **pas la quantification** (515–849 px dans ]−1;0[ contre 77 000–300 000 de plateau), **le terrarium Mapterhorn en `.webp` lossy** dont le zéro de mer ressort à **0 ± 0,5 m, des deux côtés du signe** ; les +0,3 étaient classés TERRE sans lire EMODnet (−80 m dessous) ; bande de bruit `|h| ≤ 0,6 m` sur ≥ 10 % des pixels que la source fine dit < −2 m ; pixels de mer émergés Porquerolles **131 010 → 17 496**, Frioul **300 599 → 18 599** ; rivage vrai noyé = 0 sur 12 vues, Manche −72,0 ; **zéro octet recuit**, tout dans `bathy.js` | `wt-bat3` | ✅ |
| ~~GE3~~ | **FUSIONNÉ — NOTE 6/10, sous la barre.** C0 éliminatoire passée 9/9 (D19 §1 **8/8 sur HEAD** — la bimodalité 5/8 de GE1 était réelle AVANT GE2 : `LEFT: -1` a retiré le second consommateur du glissé) ; **C4 0/1,5** (double-clic gauche = plongée R35, 470 px du centre) et **C5 0/1** (clic simple ×2 — Google : *« Single-click to stop »*) = le même geste, 2,5 pts → 8,4 ; C6 0,67 (cap bimodal −50°/−69,35° + 17° de roulis, 2 chargements sur 4) ; C1 1,25 (asymétrie avant/arrière 12 %) ; C8 0,25 (élan non plafonné). Molette : aucune cible publiée par Google → D19 tient. ⚠️ GE3 a tué tous les chrome.exe de la machine à 23:39 | `wt-ge3` | ✅ |
| ~~BT-I~~ | **FUSIONNÉ** — BlueTopo : index horodaté deux fois (fichier + couche), relu à chaque cuisson ; 8 203 dalles / 89 Go, 35 % sans donnée, **Puget Sound absent** (remplacé par NCEI 1/3″) ; Chesapeake **−4,4 → −11,6 m** aux quatre niveaux, pente 2,16 → 3,81 m/km, rapport d'étendue 0,687 (seuil 0,70) ; **21 960 tuiles existantes identiques au bit**, 1 666 ajoutées, **21,17 Mo / 13 zones** ; extension z10 partout ≈ 92 Mo, z12 littoral ≈ 273 Mo, z13 ≈ 959 Mo ; trois défauts silencieux du tuileur corrigés (arrondi au mètre, lac d'altitude → zéro tuile sans erreur, zones de 0,4° écartées de l'index) ; BT-I déclare BT-2, BT-7 et la moitié de BT-4 « réfutés sur la donnée source » → **à faire arbitrer par un noteur** ; 4 797 · 0, audit 257 | `wt-bt2` | ✅ |

⛔ **Suspension 2026-09-04 (limite de session, reset 02 h 50 Berlin)** : BT-N (noteur BlueTopo, `wt-bt3`) et GE2 bis (corrections C4/C5/C6/C1/C8, `wt-ge2`) tués en vol ; relancés par `SendMessage` sur les agents d origine dès la levée.
| ~~BT-N~~ | **FUSIONNÉ — BlueTopo noté 9,8/10 sur le barème arbitré (6,4–6,9 sous la lettre stricte)**. Arbitrage tranché **sur le GeoTIFF NOAA** (223 dalles, lecture UTM directe) : BT-2 « fond dégelé z11→z13 » = 0,003 m **dans le levé lui-même** (la grandeur n'existe pas) ; BT-4 Louisiane 0,25–0,34 m/km à la source (seuil ×6 trop haut) ; BT-7 Érié 22,70 m dans `erie_lld.tif` ; BT-1 source 0,718 / voisine 0,445 (seuil posé sous la dispersion). **Un vrai manque de chaîne** : perte 256/512, −4,3 % sur BT-1 et −19 % de pente à Virginia (BT-I disait −34 % : ses pentes source non moyennées par texel). Non-régression : **1 736/1 736 empreintes identiques** sur un échantillon propre, Manche −72,5, poids **21,17 Mio** (BT-I disait « Mo »). BT-8 intermittent (« Manche z12 absent » à 8 s, présent à 14 s) → test à rendre adaptatif. Arbitrages Adrien : étendue (92/273/959 Mo), **licence NCEI Puget** (données tierces compilées), 233 dalles 16 m (35 Go, canyon du Mississippi), 256/512 | `wt-bt3` | ✅ |
