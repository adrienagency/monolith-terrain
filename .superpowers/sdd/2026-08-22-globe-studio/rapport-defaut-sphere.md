# Le mode sphère devient le mode de démarrage — rapport

**Date** 2026-08-30 · **Arbre** `C:\Dev\wt-merge` · **Branche** `regroupement`
**Base** `8d3cf94` · **Livré** `9ffe101`

---

## Statut

**Livré.** Les sept drapeaux sont levés, les sept tests qui tombaient sont
réécrits, les commentaires qui mentaient sont corrigés, la campagne de mutation
ne laisse **aucun survivant**, et le mode sphère est vérifié **à l'écran, sans
aucun paramètre d'adresse**.

> ⛔ **L'étape 5 (« ce qui casse ailleurs ») a été ANNULÉE en cours de tâche** par
> une correction de cadrage d'Adrien : « le site n'est pas live, il n'est pas
> partagé, on ne cassera rien ». Le partage de liens, le GPX, la boutique, le
> studio et l'export **n'ont donc pas été essayés**, délibérément. Ce rapport ne
> contient aucune réserve d'usage.

---

## Commits

| SHA | Sujet |
|---|---|
| `9ffe101` | Le mode sphère devient le mode de démarrage — sept drapeaux levés, gardes réécrites |

Un seul commit, et c'est délibéré : les tests et le basculement du défaut sont
indissociables — séparés, l'arbre serait rouge à un point de l'historique.

---

## Une ligne de tests

**4 297 tests · 4 297 passent · 0 échec** (`npm test`) — contre 4 293 / 4 286 / 7
au départ. `npm run audit:tests` : **221 listés · 221 sur disque · aucun écart.**

Les quatre tests neufs ferment deux trous mesurés (voir plus bas).

---

## Fichiers touchés

**Rien d'autre que `src/flags.js` et des fichiers de `test/`.** Aucun module de
`src/` hors `flags.js`, rien près de la caméra.

| Fichier | Ce qui a changé |
|---|---|
| `src/flags.js` | 7 valeurs de défaut + **8 blocs de commentaires** réécrits |
| `test/crop-branche.test.js` | ⑦ et ⑦ bis — défaut + **garde de dépendance** |
| `test/planete-eclairee.test.js` | ④ — défaut + **deux gardes de dépendance** |
| `test/soleil-heure-monde.test.js` | ② et ② bis — défaut + échappatoire |
| `test/fenetre-branchee.test.js` | ⑧f, ⑩i, ⑫d — défauts + **garde ⑩i désormais ÉVALUÉE** |
| `test/frontiere-rendu.test.js` | **2 tests NEUFS** — le drapeau n'était pas testé |
| `test/seuil-branche.test.js` | **2 tests NEUFS** — le drapeau n'était pas testé |
| `test/damier-uniformes.test.js` | commentaire « `FLAGS.globeContinu`, ÉTEINT » — faux |
| `test/loi-texture-monde.test.js` | libellé « la production ne bouge pas » — faux |
| `test/veille-repos.test.js` | idem |
| `test/zoom-continu.test.js` | idem |

Les fichiers ont été **normalisés en LF** (`.gitattributes` : `* text=auto eol=lf`).
Vérifié avant d'y toucher : la copie de travail était en CRLF et la
normalisation produit **zéro diff git** — l'index est déjà en LF. Tous les
scripts d'édition écrivent en `Buffer`, jamais en mode texte.

---

## ⚡ Étape 2 — la garde de dépendance, le seul vrai risque

C'est le cœur de la tâche, et il est passé.

Les gardes se testaient **par l'absence de paramètre**. L'absence signifie
maintenant l'inverse. **Trois gardes vivantes seraient devenues décoratives** —
vertes, mais pour la mauvaise raison :

| Garde | Avant (ne prouve plus rien) | Maintenant |
|---|---|---|
| `terreUnique` exige la frontière | `?terre=unique` seul → `false` | `?terre=unique&frontiere=0` → `false` |
| `planeteEclairee` exige `terre unique` | `?planete=eclairee&frontiere=1` | `…&terre=deux` **explicite** |
| `planeteEclairee` exige la frontière | `?planete=eclairee&terre=unique` | `…&frontiere=0` **explicite** |
| `seuilSocle` exige la frontière | *n'était pas évaluée du tout* | `?seuil=1&frontiere=0` → `false` |

Chacune est aussi doublée d'une seconde valeur d'extinction (`?frontiere=crans`,
`?terre=0`) pour que supprimer un seul littéral du `if` ne suffise pas.

### Et la leçon du dépôt s'est retournée

Le commentaire de ⑦ bis avertissait : *« l'échappatoire ne se teste que contre un
défaut vrai […] avec `FLAGS.terreUnique === false`, supprimer la ligne
`?terre=deux` ne change RIEN. »*

⛔ **Le basculement a inversé le problème, il ne l'a pas résolu.** C'est désormais
`?terre=unique` qui retombe sur un défaut vrai et ne mord plus. Chaque branche
d'échappatoire est donc maintenant exercée **avec le drapeau forcé au réglage
contraire**, dans les deux sens — pour les sept drapeaux. Le test ne dépend plus
de la valeur du défaut ; c'est un test séparé qui l'épingle.

### Une garde était gardée par le TEXTE SOURCE

`fenetre-branchee` ⑩i prouvait « `socleQuadtree` exige `?globe=continu` » par
`assert.ok(/…if \(!globeContinuActif\(\)\) return false/.test(src))`. L'assertion
d'à côté (`socleQuadtreeActif() === false`) ne la sauvait pas : elle passait
parce que **les deux** drapeaux étaient éteints, sans jamais distinguer laquelle
des deux causes agissait. C'est la classe de défaut que le brief désigne comme la
plus coûteuse du chantier. Elle est maintenant **évaluée** (`?socle=quadtree&globe=crans`
→ `false`), la lecture du source étant conservée **en plus**, jamais à sa place.

---

## Étape 3 — campagne de mutation, sur la suite complète

Chaque drapeau remis à `false` **un par un**, `npm test` complet à chaque fois.

| Drapeau | Tests rouges | Verdict |
|---|---|---|
| `globeContinu` | **3** | ✅ rougit |
| `socleQuadtree` | **2** | ✅ rougit |
| `frontiereRendu` | **5** | ✅ rougit |
| `seuilSocle` | **2** | ✅ rougit |
| `terreUnique` | **3** | ✅ rougit |
| `planeteEclairee` | **1** | ✅ rougit |
| `soleilHeureMonde` | **1** | ✅ rougit |

**Aucun survivant.**

### ⚠️ Deux trous que la campagne aurait révélés, fermés avant elle

Mesuré au `grep`, **avant** d'écrire quoi que ce soit :

- `grep -rn 'FLAGS.frontiereRendu' test/` → **rien**
- `grep -rn 'FLAGS.seuilSocle' test/` → **rien**
- `frontiereRenduActive` n'était importée par **aucun** test du dépôt
- `globeContinuActif` n'était **évaluée nulle part**, ni avec ni sans `location`

Mettre l'un de ces défauts à `false`, ou inverser ses deux branches
d'échappatoire, ne faisait rougir aucun des 4 293 tests. C'est exactement le trou
qui avait laissé passer quatre mutations sur `planeteEclaireeActive`. Il ne
coûtait rien tant que ces drapeaux étaient éteints ; **`frontiereRendu` est celui
dont deux autres dépendent**, et il est maintenant levé au démarrage.

Quatre tests neufs les ferment (`test/frontiere-rendu.test.js`,
`test/seuil-branche.test.js`) — d'où les colonnes « 5 » et « 2 » ci-dessus.

---

## Étape 4 — à l'écran, et c'est la vraie preuve

`http://localhost:5539/` — **adresse nue, aucun paramètre**, `location.search`
relevé à `''` dans la page même.

### Le mode sphère est là au chargement

| Grandeur | Relevé | Attendu |
|---|---|---|
| `veilleCrop.pose` | **`true`** | posé |
| `veilleCrop.bascules` | **1** | une seule bascule |
| `veilleCrop.refus` | **`[]`** | aucun maillon n'a refusé |
| `veilleCrop.signature` | `-21.2484\|55.7666\|12\|3` | La Réunion, z12 |
| **`terrain.mesh.visible`** | **`false`** | ✅ **faux, comme demandé** |
| `veilleSocle.visible` | `false` | l'ancien socle plat n'est pas dessiné |
| `globe.tiles.size` | **112** | (69 mesurée sur un second chargement) |
| `veilleEstompage.valeur` | `1` | |
| `altitudeCadrageM` | 7 036 m | sous le seuil de naissance (32 274 m) |

**Uniformes de style, lus sur `globe.uniforms` :**

```
uCropOn 1 · uHabOn 1 · uMerRampeOn 1 · uMerZeroSousEau 1
uNormaleFineOn 1 · uEstompageOn 1 · uEstompage 1
uMppFacteur 49,3379   ← NON NUL
uSunDir (0,8821 · 0,4545 · 0,1235)
uCropCentre (0,6549 · 0,5604) · uCropDemi 0,000366
```

⚠️ **`uMppFacteur = 49,34` est la mesure qui compte le plus.** C'est
exactement la raison d'être de la garde `planeteEclairee → terre unique` : ce
facteur n'est posé que par `poserLoiMonde`, et à zéro le pas du gradient de la
normale fine retombe au texel. Il est non nul : la chaîne complète est passée.

**Zéro erreur console** sur un chargement complet, suivi console armé **avant** la
navigation (`onlyErrors`, puis un second passage filtré sur
`THREE|WebGL|shader|Failed|404|undefined|NaN` : aucun message).

**Captures :** bloc gravé dans la planète, parois de crop visibles sur deux
arêtes, horizon de la sphère au-dessus, mer bathymétrique à l'est, crédit
« Mapterhorn · Bathymétrie GEBCO_2026 ».

### L'échappatoire marche encore — `?terre=deux`

| Grandeur | Relevé |
|---|---|
| `terreUniqueBranchee` | `false` |
| `veilleCrop.pose` / `.bascules` | `false` / **0** |
| `terrain.mesh.visible` | **`true`** — le bloc plat est rendu |
| `veilleSocle.visible` | `true` — le socle est là |
| `uCropOn` · `uHabOn` | 0 · 0 |
| **`uNormaleFineOn` · `uMppFacteur`** | **0 · 0** |

⚡ Les deux dernières lignes sont un contrôle croisé gratuit : `?terre=deux`
**éteint aussi `planeteEclairee`**, à l'exécution et dans le navigateur — la garde
de dépendance que les tests exercent sous node se vérifie ici sur la vraie
chaîne. Écran : le bloc classique, socle terracotta, cartouche « RÉUNION FRANCE »,
rose des vents, cranteur Z12, étiquettes de lieux. Zéro erreur console.

---

## Ce que j'ai observé sans le mesurer

Une seule chose, dite parce que je l'ai vue, pas parce que je l'ai cherchée :

- **Un bandeau « PERFORMANCE — ESSENTIAL MODE » est apparu** sur un des
  chargements en mode sphère. Le gouverneur de performance a donc déclassé la
  machine. **Je n'ai pas mesuré si c'est dû au mode sphère** ou à cet
  environnement (Chrome piloté, GPU partagé) — je n'ai pas de relevé du même
  bandeau sous `?terre=deux` pour comparer. À ne pas prendre pour une conclusion.

---

## Réserves

1. **Rien n'est mesuré au-delà du seuil de naissance.** La molette est cranée et
   plafonnait dans cet environnement : je n'ai pas fait franchir les 32 274 m à la
   caméra, donc **je n'ai pas vu de mes yeux la planète remplacer le crop**.
   `seuilSocleActif()` est prouvé sous node, pas à l'écran.

2. **Les réserves écrites au drapeau `socleQuadtree` ne sont pas levées** — elles
   sont seulement dépassées par la décision d'Adrien, et je les ai laissées
   écrites dans `flags.js` : le coût par image du raffinement n'est pas
   chronométré `render()` compris, le pic mémoire des `fetchAndBuildDem`
   concurrents n'est pas mesuré, **rien n'a été mesuré sur un portable**. Le vol
   sans attente (`VOL_SANS_ATTENTE`) part maintenant au démarrage.

3. **Les quatre défauts visuels connus du crop restent entiers** — arêtes vives
   (Tâche B), jupes de tuiles qui pendent (Tâche E), arêtes droites aux raccords
   de niveaux (Tâche G), mer du crop sans bathymétrie. Le basculement n'en répare
   aucun ; il les met sous les yeux d'Adrien, ce qui est ce qu'il demande.

4. **`soleilHeureMonde` levé rend le terminateur vrai** : à 03h22 la vue orbitale
   devient nocturne. C'était la réserve écrite au drapeau, et elle tient. Le
   drapeau disait « c'est à Adrien de trancher » — il a tranché.

5. **Les tableaux de mesure de `flags.js` n'ont pas été réécrits**, y compris
   quand leur colonne s'appelle « production » : elle désigne le régime d'avant,
   `?globe=crans`. Une mesure ne se réécrit pas parce qu'un défaut a bougé, elle
   se date — c'est écrit dans le nouveau bandeau en tête du fichier.

6. **Un chiffre du brief que je n'ai pas retrouvé** : il annonçait « 4 293 tests,
   audit 221 = 221 » comme base. L'audit est exact. Le total de tests l'est aussi
   (4 293), mais la suite en rendait **4 286 verts et 7 rouges** au départ, pas
   4 293 verts. Les deux chiffres du brief étaient donc justes et cohérents ; je
   le note pour que personne ne lise « 4 293 » comme un compte de verts.
