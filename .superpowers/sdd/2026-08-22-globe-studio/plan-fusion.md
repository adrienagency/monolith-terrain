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
**4 491 tests · 0 échec · `audit:tests` 231 = 231** (après R20 bis, R22 et l'arbitrage du ciel).

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

### En cours — quatre arbres, quatre agents

| tâche | sujet | branche | arbre |
|---|---|---|---|
| **R21** | l'éclairage : ombres, lampe d'appoint, ombrage des pentes (8 options) | `lumiere-crop` | `C:\Dev\wt-lum` |
| **R23** | les deux sauts de caméra restants (×66,67 et la butée à 88,2°) | `vitesse-camera` | `C:\Dev\wt-vit` |
| **R24** | la toponymie : sommets et points cotés (2 options) | `toponymie-globe` | `C:\Dev\wt-top` |

**Périmètres attribués, pour que les fusions ne se battent pas :**
- R21 → `light-panel.js`, `eclairage-crop.js`, le nuanceur de `globe.js`
- R22 → `parois-crop.js`, `habillage-crop.js`, le nuanceur de `globe.js`, `map-panel.js`
- R23 → `modes.js`, `zoom-continu.js`, `pivot-bloc.js`, `descente-bornee.js`
- R24 → `peaks.js`, `labels.js`, `cartouche-globe.js`, `sol-globe.js`

⚠️ **R21 et R22 se partagent le nuanceur de `src/globe.js`** — c'est le seul
recouvrement assumé. **Fusionner R22 en premier** : sa grille et ses parois sont
structurelles, l'éclairage de R21 se posera dessus.

---

## L'ORDRE DE FUSION

1. ~~R22~~ **fusionné**.
2. **R21** (`lumiere-crop`) — l'éclairage, par-dessus.
3. **R23** (`vitesse-camera`) — disjoint, mais c'est celui qui change ce qu'on
   ressent : le fusionner tard permet de le juger seul.
4. **R24** (`toponymie-globe`) — le plus additif, donc le dernier.

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

1. `npm test` — **base à battre : 4 491 · 0 échec**
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
