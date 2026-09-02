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
