# Vague finale — les quatre réserves de la revue

Branche `regroupement`, à partir de `90a89d9`. `npm test` : **2469 → 2472**, tout vert.
Audit disque-vs-liste : **147/147, 0 orphelin, 0 fantôme, 0 doublon** (aucun fichier de
test ajouté). Les deux tests d'architecture (`damier-uniformes`, `garde-plans-eau`) sont
verts et leurs fichiers sont **intacts au diff** — aucune exception ajoutée.

---

## FINDING 1 — les portes de sortie du cadrage caméra

### Ce qui a été corrigé

La revue en nommait deux. Le balayage dérivé (voir plus bas) en a trouvé **onze**, et les
neuf autres ne sont pas de la précaution : trois portent le **même défaut exact** que le
bouton globe.

| porte (main.js) | ce qu'elle confie | le défaut |
|---|---|---|
| bouton globe (`enterOrbit`) | `modes.enterOrbit` | **nommé par la revue** — `_surfCam` sauve le near desserré (≈ 122) et le repose au retour, `maxDistance` retombe à 150 |
| bouton cinéma (`cineBtn.next`) | `shots.next` | **nommé par la revue** — un plan au ras du sol part avec near = 122 |
| `flyTrack` | `pilote.lancerPoursuite` / `drone.start` | survol du tracé au ras du sol |
| `engageGpxFollow` | idem | le suivi de tête, même cause |
| `togglePlay`, `playCamera` | `cameraAuto.start` | l'automation reprend la caméra |
| `loadGpxText`, `explorePanel.flyTo`, `panelCtx.flyTo`, message d'embed | `modes.flyTo` | ⚠️ **même défaut que le bouton globe** : `modes.flyTo` depuis la surface appelle `enterOrbit(1200000)`, donc passe par le même `_surfCam` |
| clic-plongée (`modes.diveTo`) | `modes.diveTo` | `_loadDive` repose `maxDistance` mais **pas** `near`/`far` — il ne les a pas touchés |
| clic sur le globe (`modes.plongeDepuisGlobe`) | — | inatteignable depuis un cadrage ; l'appel est là pour que la règle n'ait aucune exception |

`quitteCadrageDamier()` sort en `false` dès la première ligne quand aucun cadrage n'est en
cours : hors cadrage, aucune de ces onze lignes ne change quoi que ce soit.

### La formulation du test, et pourquoi celle-là

Nouveau test `toute porte qui confie la camera rend D'ABORD ce que le cadrage a emprunte`
(test/damier-cadre.test.js). La liste des portes est **dérivée**, en trois temps :

1. **Qui pilote la caméra** — lu dans la garde par image de main.js
   (`pilote.active || shots.active || … → updateCameraMotion(dt)`). Cette liste s'entretient
   toute seule : un pilote qui n'y figure pas ne bouge jamais la caméra. Un seul nom est
   écrit à la main, `modes`, et c'est celui par lequel le défaut est arrivé.
2. **Quels appels** — pas une liste de verbes de *démarrage* (un verbe inventé demain en
   tomberait dehors) mais la liste des verbes **inertes** (`stop`, `cancel`, `update`,
   `retarget`…), chacun avec sa raison. Tout le reste est une porte jusqu'à preuve écrite
   du contraire : la propriété échoue **du bon côté**.
3. **Où** — sur le *chemin* qui mène à l'appel, à l'intérieur de sa fonction, les branches
   voisines déjà refermées ôtées. Le corps entier de la fonction ne suffisait pas : le clic
   sur la carte porte deux portes dans deux branches exclusives d'un même gestionnaire.

**Preuve que ça attrape la PROCHAINE porte, pas ces onze-là :** en ajoutant
`shots.rejoue()` (un verbe qui n'existe pas) dans `focusOnPeak`, le test rougit avec
`main.js:1657 — « focusOnPeak » confie la camera a shots.rejoue() sans avoir rendu
l'emprunt du cadrage`.

Un canari (`portes.length >= 10`) empêche la panne silencieuse : un renommage de pilote
ferait rougir au lieu de rendre le test vert en ayant cessé de regarder.

Second test ajouté, `les trois sorties historiques rendent toujours l'emprunt` : la
propriété dérivée **ne voit pas** `applyIsoView`, la molette et le repli à 1×1 (aucune ne
confie la caméra à un pilote nommé — les deux premières passent par le `flyTo` *local*), et
la mutation a montré que les retirer ne faisait rougir personne.

> ⚠️ **Le `flyTo` local n'est délibérément pas une porte.** Les presets de vue (pavé
> numérique) volent « au même rayon, seul l'angle change » : leur rendre `maxDistance` en
> plein cadrage ramènerait la butée à 150 sous une caméra posée à ~490, et
> `controls.update()` la happerait à l'image suivante. Un à-coup visible pour corriger un
> plan de coupe qui, sur ce chemin-là, ne coupe rien. `applyIsoView`, lui, calcule sa
> distance **après** avoir rendu — c'est pour ça qu'il peut le faire. C'est écrit dans le
> test.

### Résultat des mutations

Script rejouable : on retire **un** appel à `quitteCadrageDamier()` à la fois dans
`src/main.js` (16 appels dans le code, commentaires exclus), on rejoue
`test/damier-cadre.test.js`, on remet.

**16 mutants sur 16 tués.** Avant la correction, sur le même protocole : 4 survivants
(dont deux portes réelles). Détail :

- 11 mutants tués par `toute porte qui confie la camera rend D'ABORD…` ;
- 3 par `les trois sorties historiques…` (bouton iso, branche « on s'approche » de la
  molette, repli à 1×1) ;
- 1 par `la molette rend la butee AVANT de laisser l'escalier dezoomer` (existant) ;
- 1 (`modes.diveTo`) n'est tué que depuis que le test regarde le **chemin** et non le corps
  entier de la fonction : avec la version « corps entier », la restitution de la branche
  orbitale voisine le blanchissait. C'est ce mutant survivant qui a fait resserrer ③.

---

## FINDING 2 — le socle coulé à pleine résolution pendant le glissement

### Point 1 (obligatoire) : les deux commentaires menteurs

Corrigés dans `src/main.js` (boucle `f3Tick`) et `src/fenetre-elan.js` (seuil `V_ARRET`),
avec le chiffre réel, sa méthode et le chemin du script.

### Point 2 : **je l'ai pris.** Le socle suit désormais la finesse du maillage

`src/plinth.js` lit `terrain.resMaillage(params)` au lieu de `params.resolution ?? 256`.
`Terrain._resFenetre` a été **rendue publique** sous le nom `resMaillage` (8 remplacements,
tous dans `src/terrain.js`, aucune référence ailleurs) : elle n'est plus l'affaire du seul
maillage, le socle doit lire la même.

**Mesure** — `.superpowers/sdd/2026-08-05-damier-multi-blocs/mesure-socle-fenetre.mjs`,
rejouable, `buildSlabWalls` réelle sur relief analytique (aucun réseau), Ryzen 9 5900X,
médiane de 12 tours après 3 de chauffe :

| res | médiane | sommets |
|---|---|---|
| 128 | 5,5 ms | 19 656 |
| 256 | 8,7 ms | 39 156 |
| 384 | **14,6 ms** | 58 812 |
| 768 | **24,5 ms** | 117 312 |

- **Gain : 9,9 ms par image de glissement (−40 % du poste).**
- Le « 2,2 ms » écrit dans le code était faux d'un facteur **onze** (24,5 mesuré). Une image
  de lancer valait 9,9 + 24,5 = **34,4 ms** (~29 im/s), pas 12 ; elle vaut désormais
  9,9 + 14,6 ≈ **24 ms**.
- Le chiffre est cohérent avec les 26,2 ms de la Tâche 12 sur le **même appel** au même
  maillage — la réconciliation que le rapport de la Tâche 12 listait comme non faite
  (point 5 de sa liste) est faite.

**Pourquoi je l'ai jugé conservateur malgré la consigne de prudence :**

1. **Ce n'est pas un nouveau réglage, c'est la fin d'une incohérence.** `plinth.js` dit
   depuis toujours « match the wall ring to the terrain mesh edge resolution so the top of
   the walls lands exactly on the relief border » — et depuis la fenêtre continue, c'était
   faux **pendant tout glissement** : maillage 384, socle 768. Le contour du mur suivait le
   relief plus finement que le bord de la carte posée dessus. Le correctif ramène
   l'invariant que ce commentaire existe pour tenir.
2. **Hors fenêtre continue, la valeur est identique au bit près.** `resMaillage` rend
   `params.resolution` tel quel dès que l'emprise vaut un bloc. Le bloc ordinaire, le
   damier et la zone isolée ne voient aucun changement. Vérifié :
   `bloc ordinaire → 768 · continu en mouvement → 384 · continu au repos → 768 ·
   utilisateur à 256 → 256`.
3. **Le risque principal — un socle qui « respire » — est neutralisé par le code existant.**
   `baseY = Math.min(baseYFloor, globalMin - depth)` et, en fenêtre continue,
   `socleEmprise()` impose toujours un `baseYFloor` calculé sur le MNT de **toute l'emprise**
   (`dem.minM`), indépendant de la résolution. La partie de `globalMin` qui dépend de la
   résolution est le balayage de **bord** ; le balayage intérieur, lui, est à
   `INTERIOR_STEPS` constant. Le fond du socle ne bouge donc pas avec la finesse.
4. **La bascule est déjà visible de toute façon** : elle se produit à l'image même où le
   relief change de maillage. Le socle la suit au lieu de rester en décalage.

**Le socle retrouve sa pleine finesse au repos** — vérifié sur les deux chemins :
`f3Tick` (le raffinement pose `terrain.resFenetre = 768` puis met `refait = true`, ce qui
force `plinth.rebuild` dans la même image) et `f3Fige` (`terrain.resFenetre = resVoulue`
est écrit **avant** `plinth.rebuild`, lignes 2805-2815).

**Verrou de non-régression** : `test/plinth.test.js` gagne
`Plinth.rebuild coule le socle a la resolution du MAILLAGE`. Mutation vérifiée : remettre
`params.resolution ?? 256` fait rougir.

---

## FINDING 3 — la justification surdimensionnée de la mer

Vérifié avant de réécrire :

- les deux carrés **ne diffèrent que sous zone isolée** — sur le chemin GPX, `_poseCarre`
  pose exactement le carré que `cellsForTrack` vient de calculer, `empriseVivante()` et
  `carreCourant()` coïncident ;
- les dalles de zone n'existent que quand `params.regionMode` est vrai (`applyRegionMode`
  appelle `syncRegionGrid(null)` dès qu'il est faux) ;
- `ocean.js` : `if (seaY > -9000 && !params.regionMode) {` ouvre à la ligne 1250 et **ferme
  à la 1416** — la mer ouverte **et sa jupe** sont dedans, donc sautées en zone isolée ;
- ce qui reste concerné est en **amont** du `if` : `_bakeField` (ligne 1220, qui lit
  `this._emprise.span/res/centre`) et les **lacs**, dont les matériaux reçoivent
  `uSpan = this._span` et `uCentre` (lignes 1538-1541).

Réécrit aux quatre endroits : `src/main.js` (`carreDeMer`), `src/ocean.js` (`@param carre`
de `rebuild`), `src/damier-carre.js` (`empriseDeMer`), et le message d'assertion de
`test/damier-mer.test.js:487`. La règle n'a pas bougé.

Les deux jumeaux qui ne parlent pas de la mer — `ground-info-layer.js` (« écarterait les
textes du mauvais montant ») et `vue-ensemble.js` (« laisserait deux rangées de dalles hors
champ ») — sont **justes** : ni les textes ni le cadrage ne sont désactivés par
`regionMode`. Laissés tels quels.

---

## FINDING 4 — `carreCourant()`

`src/block-grid.js` : l'accesseur porte maintenant un avertissement explicite — réservée au
CHARGEMENT, plafonnée à 3×3, aveugle aux dalles de zone isolée, **plus aucun lecteur de
production depuis le 2026-08-05**, seuls les tests l'appellent, et tout ce qui est géométrie
lit `empriseVivante()`. Vérifié par balayage : les seuls appels hors `block-grid.js` sont
dans `test/damier-carre.test.js`, `test/damier-palier.test.js` et
`test/damier-reseau.test.js`.

---

## Ce que je n'ai PAS pu vérifier

1. **Rien à l'écran.** Aucune session graphique. Le bouton globe pendant un cadrage 3×3, le
   bouton cinéma, le clic-plongée, le suivi de tête, et surtout **la fenêtre continue** — le
   mode que la revue signale comme jamais vu par un agent — n'ont été observés que par le
   code et par des bancs node. C'est la réserve principale, et elle porte sur le FINDING 2.
2. **Le gain de 9,9 ms n'est pas un gain d'images par seconde mesuré.** Il est mesuré sur
   `buildSlabWalls` seule, hors navigateur, hors GPU. Le reste de `plinth.rebuild` (dispose
   de l'ancienne géométrie, téléversement de la neuve) s'y ajoute : le chiffre est un
   **plancher**, exactement comme celui de la Tâche 12.
3. **La stabilité de `baseY` est raisonnée, pas mesurée sur un vrai MNT.** L'argument
   (`baseYFloor` couvre toute l'emprise, donc gagne toujours le `Math.min`) tient sur la
   lecture du code ; il faudrait un relief réel très plat, où le grain FBM descendrait sous
   le minimum du MNT de l'emprise, pour le mettre en défaut. Si le socle « respirait » en
   glissant, c'est le premier endroit où regarder.
4. **La bande d'occlusion de contact** (`aoBande`, calibrée sur `topMax` du contour) varie
   très légèrement avec la résolution du contour. Pas mesuré, jugé sous le seuil du visible.
5. **Les portes atteintes depuis `__exp`** (console, scripts de tournage) : `__exp.shots`,
   `__exp.drone`, `__exp.cameraAuto` sont exportés et permettent de contourner toutes les
   portes. La propriété ne lit que main.js ; elle ne protège pas la console.
6. **La mutation ne couvre que `test/damier-cadre.test.js`.** Retirer un appel et rejouer la
   suite complète (147 fichiers) × 16 aurait pris ~1 h ; j'ai rejoué le fichier concerné.
   La suite complète est verte une fois, à la fin.
