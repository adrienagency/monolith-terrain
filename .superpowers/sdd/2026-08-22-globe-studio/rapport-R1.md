# Rapport — Tâche R1

**Statut : DONE_WITH_CONCERNS**
**Arbre :** `C:\Dev\wt-merge`, branche `regroupement`, base `4cca4e7`.
**Tests :** 4 142 passent, 0 échec (4 117 au départ). `audit:tests` : 213 = 213, aucun écart.
**Traces :** `.banc/R1/` (tour 1) et `.banc/R1-tour2/` (tour 2 — **captures PNG sur le disque**).

**Commits**

| | |
|---|---|
| `64c90db` | ① le repos surveillait l'altitude, or incliner la vue c'est baisser l'altitude |
| `559a548` | ② les boutons du bas répondaient à la question du maillage plat |
| `1141e08` | relecture **C2** — la grandeur du repos vivait dans `main.js`, où aucun test ne va |
| `c56a501` | relecture **C1** — le bouton ciné n'est pas réversible, il est éteint sous le drapeau |
| `d998717` | relecture **I4 + I6** — deux correctifs de ② étaient livrés sans garde |
| `55a19b4` | relecture **m8** — une assertion comparait deux littéraux du fichier de test |
| `31fe1eb` | relecture **I5** — le crédit d'orthophoto décrivait autre chose que l'écran |
| `f7e0209` | relecture **m10** — la discontinuité au cran est marquée NON REPRISE |

**C3** (le témoin `bascules = 46`) n'a pas de commit : `.superpowers/sdd/` est
ignoré par git. La correction est sur le disque, dans `brief-R1.md`.

---

# I. Ce que la relecture a corrigé chez moi

## ⛔ C1 — le bouton ciné : elle a raison, et je l'ai refait moi-même

J'avais écrit, dans le rapport, dans `boutons-R1.json` **et gravé dans `main.js`** :

> *« C'EST RÉVERSIBLE : `shots.stop()` rend la vue intacte (vérifié : la caméra
> revient à `y = 77,1`, distance 145,5). »*

**C'est faux, et j'ai refait la mesure** — cette fois en Chrome sans tête à
**284 appels de rendu par seconde** (`.banc/R1-tour2/cine.json`, `huit-clics.json`) :

| moment | `camera.position.y` | altitude de cadrage | distance |
|---|---|---|---|
| vue posée sur le crop | 72,72 | 17 761 m | 145,50 |
| pendant le plan 1 | **−7,26** | **−1 773 m** | 12,55 |
| après `shots.stop()`, +2 s | **−2,27** | **−555 m** | 12,41 |
| +6 s, +12 s | **−2,27** | **−555 m** | 12,41 |
| après le **huitième clic** | 20,51 | 5 010 m | 29,95 |

**Ni l'une ni l'autre des deux sorties ne rend la vue.** La capture
`04-apres-stop-12s.png` montre l'écran douze secondes après l'arrêt : un mur
d'eau, la caméra est **dans la mer du crop**, et elle y reste.

Le couple `y = 77,1` / `distance 145,5` est **retiré partout** — vingt-huitième
chiffre retiré par son auteur sur ce chantier. Je l'avais relevé **une** fois,
dans un panneau qui rendait à 10 images/s, et je l'avais écrit comme un fait.
Un relevé unique n'est pas une mesure.

**m9 aussi :** « écran entièrement vide » était faux. C'est une vue **sous la
mer**, pas un écran vide. Corrigé partout. La partie qui porte la décision se
reproduit à un cheveu près : −1 773 m contre mes −1 780 m du tour 1.

➡️ **`cineBtn` est éteint sous `?terre=unique`.** Ce n'est plus arbitrable. Le
§3 de `src/monde/visibilite-surface.js` porte la mesure, les captures, et
surtout **le chemin de retour pour celui qui le rebranchera** : `shots` est
nourri de `terrain.sample`, le champ de hauteurs du bloc **plat**. Donner aux
plans un `sampleGround` de **globe**, *puis* retirer l'exception — pas l'inverse.

Un test interdit que l'exception déborde : sous drapeau, le ciné est le **seul**
éteint ; sans drapeau, les trois réponses sont le même booléen.

## ⛔ C2 — la mutation M9 : le trou le plus grave, et il était chez moi

`distanceCadrageM()` rendant `altitudeCadrageM()` **annulait le correctif ① en
entier** et passait les 4 131 tests. Le constat est juste, et la cause est celle
que le brief m'avait pourtant annoncée : le seul garde-fou côté `main.js` était
une expression régulière qui vérifiait que la fonction **existe**, jamais ce
qu'elle **rend**. Le corps était libre.

C'est exactement le geste que j'avais su faire pour ② avec
`visibilite-surface.js`, le même jour, sans en faire profiter ①.

➡️ `src/monde/grandeur-repos.js` — la loi, pure. `main.js` ne fait plus que la
câbler. `test/grandeur-repos.test.js` : sept tests, dont **cinq comportementaux**.

Le plus important pose 40 orbites à rayon constant et exige **deux** choses :
que la grandeur reste immobile à moins de `10⁻¹²`, **et** que la même orbite
fasse chuter la hauteur d'un facteur 4,8. Sans ce second volet, une grandeur
constamment nulle passerait le premier — c'est la moitié du test qui interdit le
`return` muet. Aucune assertion ne compare deux littéraux du fichier de test.

**Les deux formes de M9 rejouées :** le corps de `main.js` rendu à
`altitudeCadrageM()` → test ③ rouge ; la loi elle-même renvoyée sur `camera.y`
→ **11 tests rouges**.

## ⚠️ I4 et I6 — deux correctifs de ② livrés sans garde

**M5** : supprimer le relais `poserVisibiliteSocle(v)` de `setSurfaceVisible`
laissait les quatre boutons `display:flex` **en mode orbital**, sans un test
rouge. Un test lit maintenant cette branche et exige que le relais y soit, qu'il
**précède** `veilleCrop.poserMode(v)`, et qu'il reçoive `v` et **non un littéral**
— `true` rendrait les boutons éternels, `false` les tuerait pour toujours.

**M11/M12** : `labels` et `clouds` pouvaient passer de `vue.socle` à
`vue.boutons` sans qu'un test bronche. La garde est un **compte**, pas une liste
— 11 lecteurs de `vue.socle`, 2 de `vue.boutons`, 1 de `vue.cine`, et rien
d'autre. Vérifier nommément les quatorze calques laisserait passer le quinzième,
ajouté demain sur la mauvaise grandeur.

**Campagne rejouée, chaque mutation seule :**

| | |
|---|---|
| M5 relais de mode supprimé | **TUÉE** (3 tests rouges) |
| M11 `labels` rebranché sur `vue.boutons` | **TUÉE** (3) |
| M12 `clouds` rebranché sur `vue.boutons` | **TUÉE** (3) |
| M13 `mapLayers` rebranché sur `vue.boutons` | **TUÉE** (3) — *ajoutée par moi* |
| M14 `cineBtn` rallumé sous le drapeau | **TUÉE** (5) — *ajoutée par moi* |
| M15 relais de mode forcé à `true` | **TUÉE** (3) — *ajoutée par moi* |

M13, M14 et M15 ne sont pas dans la relecture : je les ai ajoutées pour vérifier
que c'est bien la **classe** qui est fermée, et pas les deux cas qu'on m'a nommés.

## ⚠️ m7, m8, m10, m11 — les mineurs

- **m7** — l'en-tête de `test/visibilite-surface.test.js` ② promettait un test
  de comportement qu'il n'est pas. Le relecteur l'a prouvé en nommant les morts.
  Requalifié : il documente la **forme** du câblage ; ce qui garde le câblage
  réel, c'est ③ et son compte.
- **m8** — `PIC_DIST / PIC_ALT < 1.1` comparait deux littéraux écrits deux
  lignes plus haut. Elle ne gardait rien. Retirée ; ce qui reste lit le seuil et
  exige une marge d'au moins 10 ×. Mutation `10⁻⁴ → 10⁻³` rejouée : 5 tests rouges.
- **m10** — la discontinuité au cran (13,25 / 0,538 / 0,364) porte maintenant son
  statut : **non reprise**, un seul relevé, un seul instrument.
- **m11** — ma réserve « captures hors disque » **était évitable**, et le
  reproche est fondé. Tout le tour 2 est mesuré en Chrome sans tête sur le patron
  de `scripts/sonde-demarrage.mjs` : 228 à 287 appels de rendu par seconde, et
  **les captures sont sur le disque** (`.banc/R1-tour2/*.png`).

## ✅ C3 — le témoin `bascules = 46`

Ma retenue était la bonne réaction, et la relecture l'a tranché. `brief-R1.md`
porte maintenant le retrait, avec la mesure qui le réfute (**2 bascules** sur
chargement propre à 57 img/s, en version altitude **comme** en version distance)
et la raison pour laquelle l'excuse ne tient pas : `bascules` est un compteur
**monotone, jamais remis à zéro**, donc « au chargement » ne peut pas désigner
un cumul de session.

**Vérifié : le chiffre n'a fui nulle part** dans `src/` ni dans `test/` — aucun
commentaire, aucune assertion ne s'appuyait dessus.

---

# II. Là où je contredis la relecture — I5, mesure à l'appui

Le constat est juste : le crédit décrit autre chose que l'écran. **Mais son
attribution ne l'est pas, et le remède proposé ne suffit pas.**

Mesuré en Chrome sans tête sur `http://localhost:5503/`, **sans aucun drapeau**
(`.banc/R1-tour2/credit-prod.json`) :

| | `terrain.mesh.visible` | crédit affiché |
|---|---|---|
| surface, aérien éteint | vrai | — |
| surface, aérien allumé | vrai | Orthophotos © IGN · NASA GIBS |
| **orbite, aérien allumé** | **faux** | **Orthophotos © IGN · NASA GIBS** |

**En orbite, sans aucun drapeau, le bloc plat n'est pas dessiné — l'orthophoto
n'est donc pas à l'écran — et le crédit s'affiche quand même.** Le défaut
**préexiste à cette tâche**. `?terre=unique` ne le crée pas : il le rend
*permanent* au lieu de *transitoire*, puisque le bloc plat n'y est jamais dessiné.

Et le remède annoncé — *« masquer l'aérien sous le drapeau règle le crédit du
même geste »* — **ne règle rien** : `params.aerialEnabled` peut déjà être vrai au
chargement (état sauvé, gabarit) sans qu'aucun bouton soit cliqué. La garde doit
porter sur le **poussage du crédit**, pas sur le bouton.

**Ce que j'ai fait :** la garde est sur le poussage, et **bornée au drapeau**.
Vérifié à l'écran : drapeau levé, le crédit ne paraît plus ; drapeau baissé,
production identique, crédit compris.

**Ce que je n'ai pas fait, et pourquoi :** le cas de la production est laissé
**intact**. Le corriger changerait le comportement sans drapeau — la seule
garantie que ce chantier a tenue de bout en bout. ➡️ **À trancher par Adrien**
(réserve 1 ci-dessous).

**Et le bouton aérien reste visible**, délibérément : Adrien a nommé
« affichage photographie aérienne » parmi les boutons qui lui manquaient. Il est
inerte sur le crop tant que le globe n'a pas de couche aérienne — c'est écrit à
côté de `buildMapCorner` — mais il ne ment plus sur ce qu'on regarde.

---

# III. Ce qui tenait, et qui tient toujours

## ① la grandeur du repos — remesuré après tout le tour 2

`.banc/R1-tour2/geste.json`, captures `30` à `33` — **vrais gestes de souris et
de molette envoyés par CDP**, 286,9 appels de rendu/s, 0 erreur :

| | altitude | distance | `auRepos` | `bascules` |
|---|---|---|---|---|
| repos initial | 17 761 m | 145,500 | vrai | 2 |
| **après un cliquer-glisser** | **750 m** (÷ 23,7) | **145,500** | **vrai** | **2** |
| après **une** molette | 755 m | 146,956 | **faux** | **3** |
| après stabilisation | 758 m | 147,975 | vrai | **4** |

L'altitude chute d'un facteur 23,7 — `camY` 72,72 → 3,07 — pendant que la
distance ne bouge pas de la troisième décimale, et le repos ne bascule pas. Une
molette le réveille. La vue posée recroppe **une** fois. La capture
`31-apres-glisse.png` montre le crop **seul**, sans alentours.

La mesure d'orbite a maintenant été faite **trois fois** — le brief, moi, la
relecture — à trois cadences différentes, donnant trois pics différents
(`4,862 × 10⁻³`, `1,03 × 10⁻²`, `4,60 × 10⁻²`) et **le même verdict à chaque
fois** : 39/39 images au-dessus du seuil pour l'altitude, **0/39** pour la
distance. Aucune décision ne repose sur un pic absolu.

`SEUIL_BOUGE_LOG` n'a pas bougé, et il ne devait pas : sur le geste de molette
qui l'a calibré, la distance rend **1,079 ×** l'écart de l'altitude à la même
image et capte exactement les mêmes images, 54/54.

## ② les boutons du bas — trois correctifs, trois nécessités

La relecture a vérifié chemin d'appel par chemin d'appel que mon raisonnement
était juste et qu'il n'y avait **aucune sur-correction**. Le point que je
maintiens : **le brief ne désignait que la moitié de la cause**, et corriger
`poserVisibiliteSocle` seule ne change rien à l'écran — sous ce drapeau,
`veilleSocle` n'applique jamais.

## Bouton par bouton, drapeau levé

| bouton | verdict |
|---|---|
| **shuffle** | ✅ marche, et se voit — encre du globe `000000` → `101d12`, texture de rampe refabriquée. ⚠️ agrégat : `seaSeed` et `surfaceFx` écrivent dans `realWater`/`terrain`, invisibles sous le drapeau |
| **iso** | ✅ marche — `isoIndex` 0 → 1, caméra déplacée, 0 erreur |
| **aérien** | ⛔ **inerte** — 0 uniforme d'aérien sur le globe ; visible à la demande d'Adrien, mais il ne ment plus (I5) |
| **ciné** | ⛔ **éteint sous le drapeau** — aller simple sous le sol, mesuré deux fois (C1) |

## La garantie de production

Rejouée en Chrome sans tête, aller-retour d'orbite compris, **après tout le
tour 2** : surface → les **quatre** boutons `flex`, ciné compris,
`terrain.mesh.visible` **vrai** ; orbite → les quatre `none`.
**Inchangée.** C'est structurel autant que mesuré : sans drapeau,
`visibiliteSurface` rend le même booléen pour les trois réponses, et tout ce que
j'ai ajouté vit dans la branche `if (terreUniqueBranchee)`.

---

# IV. Mes réserves

1. **⛔ Le crédit d'orthophoto est faux EN PRODUCTION, et je ne l'ai pas
   corrigé.** Mesuré : en orbite, sans aucun drapeau, « Orthophotos © IGN ·
   NASA GIBS » s'affiche alors que le bloc plat n'est pas dessiné. C'est une
   mention de licence qui décrit autre chose que l'écran, et elle est antérieure
   à ce chantier. Le corriger demande de toucher la production. **À trancher par
   Adrien** — c'est la seule décision que ce rapport laisse ouverte sur un point
   de conformité.

2. **⚠️ Deux boutons ne font toujours rien de bon sous le drapeau.** L'**aérien**
   est inerte : le clic coche, écrit dans le bloc plat, et le crop ne bouge pas.
   Il reste visible parce qu'Adrien l'a nommé. Le **ciné** est maintenant éteint,
   ce qui règle le danger mais laisse une fonctionnalité manquante. Les deux se
   rebranchent de la même façon : donner au globe ce qui lui manque — une couche
   aérienne, un `sampleGround` — et non rallumer le bouton.

3. **⚠️ La branche « ensemble » du bouton iso n'est toujours pas vérifiée.**
   `cadreLeDamier` dépend de `blockGrid` et `TERRAIN_SIZE`. `modeBoutonCamera()`
   rend « bloc », donc `flyIso` va droit à `applyIsoView`, qui est générique et
   qui marche. Ni moi ni la relecture n'avons su poser un damier multi-cases sous
   le drapeau. **Non mesuré**, aux deux tours.

4. **⚠️ La discontinuité au cran n'a été vue qu'une fois.** Les trois figures
   (cible qui saute de 13,25 unités, distance `0,538` contre altitude `0,364`)
   sont tracées et portent leur statut dans le §1 du module : **non reprise**.
   L'instrument de la relecture n'a pas su capturer le transitoire. Ce qu'elle a
   bien mesuré va dans le même sens — un cran coûte exactement un aller-retour,
   `bascules` 2 → 4.

5. **⚠️ `poserVisibiliteSocle` est gardée par des assertions de TEXTE, et c'est
   une limite assumée.** Elles tuent les suppressions et les redistributions —
   les six mutations le montrent — mais elles ne protégeraient pas d'une
   réécriture complète du corps, comme M9 l'a fait pour la grandeur du repos.
   Là où il y avait un corps à extraire, il l'a été (`grandeur-repos.js`) ; ici
   il n'y a qu'une liste d'appels dans `main.js`, qu'aucun test de ce dépôt ne
   peut charger. **Le compte des lecteurs est le meilleur outil disponible, pas
   une preuve d'exécution.**

6. **⚠️ Ma leçon du tour 1, écrite ici pour qu'elle serve.** Deux de mes chiffres
   ont été retirés : le `y = 77,1` de la réversibilité du ciné, et la formulation
   « écran entièrement vide ». Les deux venaient d'un **relevé unique**, pris dans
   un panneau qui rendait à 10 images/s, et écrits comme des faits. Ce n'est pas
   la cadence qui était en cause — c'est d'avoir mesuré une seule fois. Tout le
   tour 2 est mesuré deux fois, sur un instrument qui rend vraiment.

---

# V. Fichiers touchés

**Périmètre :** `src/monde/veille-repos.js`, `src/monde/branchement-crop.js`,
`src/main.js`, `src/monde/visibilite-surface.js` *(nouveau)*,
`src/monde/grandeur-repos.js` *(nouveau)*.

**Hors périmètre :** `package.json` *(la ligne `test` est une liste explicite —
sans l'ajout, mes deux fichiers de test n'auraient jamais tourné ; `audit:tests`
rend 213 = 213)*, `test/veille-repos.test.js`, `test/crop-branche.test.js`,
`test/seuil-branche.test.js`, `test/visibilite-surface.test.js` *(nouveau)*,
`test/grandeur-repos.test.js` *(nouveau)*.

**`src/globe.js` n'a pas été touché**, ni `src/ocean.js`, ni
`src/monde/mer-sphere.js`, ni `src/monde/flux-terrain.js`. Rien à gérer à la
fusion de ce côté, aux deux tours.
