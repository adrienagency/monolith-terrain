# Rapport — Tâche N : LE CROP SEUL

**Statut : LIVRÉE.**
**Hash : `62c05fc`** (branche `regroupement`, commit unique, arbre propre après).
**Tests : `npm test` → 3 806 verts, 0 rouge** (3 770 avant, +36) · **`npm run audit:tests` → 205/205**
· `node --check` sur les six fichiers touchés · page chargée **drapeau levé ET baissé**.

---

## 1. Ce que la mesure AVANT a dit — Étape 1

**Protocole** : chargement neuf, `?terre=unique&globe=continu&socle=quadtree&f3=0&frontiere=1&seuil=1`,
La Réunion, fenêtre 1 280 × 800, `fov = 33` **lu en direct** (le code dit 30). Vue posée.
Données brutes : `.banc/vues-N/AV-repos-bloc.json`, `.banc/vues-N/AV-repos-31km.json`.

**Station A — altitude de bloc, 12 686 m, `uEstompage = 1` (le crop est déjà seul à l'écran) :**

| grandeur | tout le globe | dont **entièrement hors crop** |
|---|---:|---:|
| tuiles en cache | 712 | 652 |
| tuiles **maillées** | 692 | 632 |
| tuiles **dessinées** (appel de dessin parti) | **351** | **315** |
| tuiles **parcourues** par image (`_visites`) | 688 | — |

⚠️ **315 des 351 appels de dessin ne montrent pas un pixel** — leurs fragments sont tous
`discard`és, et pourtant la tuile a été demandée, décodée, maillée et soumise au GPU. C'est
exactement le défaut du cahier des charges : *le pixel meurt, le coût est payé*.
Les 36 restantes sont les 36 tuiles z13 (6 × 6) du crop.

**Station B — 26 594 m, dans la bande d'estompage :** là, les alentours **peignent** pour de
bon (`uEstompage = 0,601`) : 326 dessinées dont **182 hors crop**, 652 parcourues.
`.banc/vues-N/AV-apparie-26km.png` montre le bloc noyé dans une mosaïque délavée.

**⚠️ Dénominateurs.** « Hors crop » = `!tuileDansCrop(z, x, y, repère)`, la MÊME fonction que
`zoomCropPrescrit` — un test de boîte, donc « entièrement hors de l'emprise ». « Dessinée » =
`mesh.visible === true` à l'image, c'est-à-dire un appel de dessin soumis, pas un pixel écrit.
Les deux populations ne sont pas comparables entre elles et ne sont jamais additionnées.

---

## 2. Ce qui est posé — Étape 3

- **`src/monde/veille-repos.js` (neuf, pur)** — l'automate du repos. Il surveille
  **`|Δ ln altitude|` par image**, l'**altitude seule**, pas la position : la consigne nomme le
  geste (« sauf si dézoom ou zoom »), et un panoramique ou une orbite ne demandent rien de plus
  que le crop.
- **`globe.js`** — `poserCropSeul(actif)` et la coupe dans **`_traverse`** (avant `_visites++`),
  **`_children`** (les enfants hors crop ne naissent même pas, donc ne partent pas au réseau) et
  l'**admission** de crédit. Drapeau éteint : le parcours d'avant, tuile pour tuile.
- **`estompage-terre.js`** — `poserRepos`. ⚠️ **La loi n'est pas touchée** : `estompageTerre`
  rend au bit près ce qu'elle rendait, ses bornes se dérivent toujours de `seuil-socle.js`.
  **Ce qui change est QUAND elle s'applique.** Priorités : **orbite → 0**, puis **repos → 1**,
  puis la loi.
- **`branchement-crop.js`** — le relais, avec **un seul point de sortie** (`maj` en avait six).
  Le repos n'est relayé **que si le crop est posé** : sans découpe, l'estompage plein viderait
  l'écran. Deux destinataires sur la même image — l'estompage (le dessin) et le globe (le coût).
- **`main.js`** — la veille est construite et passée à `creerVeilleCrop`. **Aucune seconde
  lecture d'altitude** : un seul `altitudeCadrageM()`, trois consommateurs.

---

## 3. L'hystérésis — mesurée, pas devinée — Étape 4

Trois traces par image relevées dans l'application vivante à 60 Hz
(`.banc/vues-N/AV-trace-{orbite,molette,molette-saccadee}.json`), dépouillées par
`.banc/hysterese-N.mjs` → `.banc/vues-N/hysterese-brut.json`.

| ce qui a été mesuré | valeur |
|---|---|
| traîne d'amortissement après une orbite | **asymptotique** : encore `7,7 × 10⁻¹¹` **603 images (10 s)** après le geste, décroissance de rapport ≈ 0,970 |
| pic du geste délibéré le plus doux (molette) | `4,67 × 10⁻⁴` |

⚠️ **Correction post-relecture (constat groupé ③) :** cette table disait aussi *« au repos
strict, `|Δ ln alt|` exactement 0, sur 3 216 images (53 s) »* comme si c'était un relevé de
l'application vivante. Ça ne l'est pas : le nombre 3 216 n'existe dans aucune trace de
`.banc/vues-N/`. C'est `test/veille-repos.test.js` ③ (« au repos STRICT ») qui rejoue 3 216
fois la MÊME altitude constante — une boucle synthétique qui prouve que `ln(1) = 0` **par
construction**, pas un relevé de 53 s à l'écran. La propriété qualitative reste vraie et n'a
pas besoin d'être mesurée (deux altitudes identiques donnent nécessairement un écart nul) ;
c'était la PRÉSENTER comme une mesure qui était fautif, pas la propriété elle-même.

⚠️ **« Non nul » n'est donc PAS un critère utilisable** — c'est la mesure qui le dit, pas une
intuition : un seuil strictement positif laisserait les alentours allumés pour toujours après
le moindre geste.

**`SEUIL_BOUGE_LOG = 10⁻⁴`** : 4,7 fois sous le pic du geste le plus doux, et il capte ce geste
**en entier** — 48 images au-dessus du seuil, exactement le même compte qu'à `10⁻⁵`, `10⁻⁶` ou
`10⁻⁸` (la molette s'arrête net, sa traîne n'est pas asymptotique). Vérifié dans l'autre sens :
à `10⁻³`, la trace de molette compte **zéro** image au-dessus du seuil — un vrai zoom passerait
pour un repos.

**`IMAGES_CALME = 30`** (0,5 s à 60 Hz), et l'hystérésis est **asymétrique** : une image pour
réveiller, trente pour rendormir. Sur les deux gestes **continus**, le plus long palier calme à
l'intérieur du geste vaut **0 image**. Sur le geste **saccadé**, les deux seuls trous mesurés
valent **1 900 ms et 1 666 ms** — ⚠️ **ce sont mes propres allers-retours d'outil, pas des
pauses humaines.** Les couvrir demanderait `IMAGES_CALME ≈ 115`, donc deux secondes de retard
sur chaque recrop, ce que la consigne ne demande pas. **Réserve assumée, écrite dans le
module** : une pause de plus d'une demi-seconde entre deux salves fait recropper puis rouvrir —
un aller-retour, pas un battement, et le compteur `bascules` les distingue.

---

## 4. Ce que j'ai vu à l'écran — Étape 6

Captures : `.banc/vues-N/`. **Repos → dézoom → repos**, dans la scène vivante.

**A/B apparié, 26 594 m, MÊME caméra, MÊME station, le drapeau basculé en direct** — c'est la
comparaison qui vaut, parce qu'elle ne compare pas deux sessions :

| | dessinées | dont hors crop | parcourues | cache |
|---|---:|---:|---:|---:|
| `AV-apparie-26km.png` | 326 | **182** | 652 | 681 |
| `AP-repos-26km.png` | **144** | **0** | 202 | 490 |

- **AVANT** (`AV-apparie-26km.png`) : le bloc est **noyé**. Une nappe délavée de tuiles à 40 %
  d'opacité couvre tout l'écran, avec des losanges de tuiles visibles, des coutures, et un
  fantôme pâle qui déborde sur le nord du crop. **Les parois du bloc n'existent pas à l'œil** :
  on ne voit pas où le bloc commence.
- **APRÈS** (`AP-repos-26km.png`) : **le bloc seul sur le fond.** Il est détaché, ses parois et
  sa base sont lisibles, la mer du crop se lit comme une nappe. **C'est ce qu'Adrien demande.**
- **PENDANT LE DÉZOOM** (`AP-transition-i20.png`, 21ᵉ image du geste, `uEstompage = 0,586`) :
  **les alentours sont bien revenus** — l'océan, la côte au loin, les losanges de tuiles.
  749 dessinées, 1 220 parcourues. La transition existe, elle n'est pas un trou.
- **APRÈS LE DÉZOOM, REPOSÉ** (`AP-repos-apres-dezoom.png`) : le bloc seul de nouveau, plus
  large (le cran a fait passer le bloc à z10, donc 576 tuiles z13 dans le crop au lieu de 144).

**Le battement, compté et pas espéré.** Le dézoom filmé image par image
(`.banc/vues-N/AP-film-transition.json`, **1 664 images**) : **UNE bascule à l'aller, UNE au
retour**, transition de **1 346 ms**. Zéro battement.

### ⚠️ Ce que je vois et qui n'est PAS réparé — je le dis franchement

1. **La mer du crop et le haut du bloc ne sont pas la même nappe, et ça se voit.** Sur
   `AP-repos-apres-dezoom.png`, le flanc gauche montre **deux arêtes distinctes** : la nappe de
   mer flotte au-dessus du dessus du bloc, décalée. Sur `AP-repos-26km.png`, la nappe **déborde
   à droite et à l'arrière au-delà des parois**, en porte-à-faux. Ce n'est pas la Tâche N — mais
   maintenant que la Terre autour ne le cache plus, **ça devient le premier défaut visible du
   bloc au repos.**
2. **Le liseré de côte est énorme** — un anneau blanc très large autour de l'île, d'autant plus
   large que le bloc est grossier. Habillage, pas mon périmètre.
3. **Les parois sont blanc-gris uni**, elles n'ont pas la matière du socle plat.
   **L'habillage n'est pas porté, ce n'est pas ma tâche, et je ne prétends pas l'avoir
   rattrapé.**
4. **Les alentours pendant la transition sont laids** — losanges de tuiles, coutures, teintes
   délavées. C'est le même habillage manquant, vu pendant le geste.

---

## 5. La campagne de mutation — Étape 5

`.banc/mutations-N.mjs`, dans un **`git worktree` à part** (`C:/Dev/wt-mut-N`), **retiré en
partant** (`git worktree list` ne le montre plus). **Banc dans `.banc/`**, jamais dans un
scratchpad. Journaux : `.banc/vues-N/mutations-N-{brut,tour2,tour3}.txt`.

**25 mutations, dont 16 visent le BRANCHEMENT.** **Trois tours : 19/24 → 24/25 → 25/25.**

Les cinq survivantes du premier tour, et ce qu'elles ont trouvé :

1. **③ — une mutation mal écrite de ma part** : elle *insérait* un appel au lieu de le
   *déplacer*, donc le second corrigeait le premier. Réécrite.
2. **⑦ — CODE MORT (sixième de ce chantier).** Le `modeSurface &&` du relais : **hors surface,
   `pose` est TOUJOURS faux** (`poserMode` appelle `retirer`, et `decider` sort avant de le
   lever). Aucun chemin n'atteignait le relais avec le mode à faux et la pose à vrai.
   **Retiré plutôt que testé à vide.**
3. **㉒ — CODE MORT (septième).** Le `kids.length > 0 &&` de la règle sans-trou :
   `tuileDansCrop` teste **l'intersection d'emprises sur les deux axes**, et les quatre enfants
   **pavent** leur parent — un parent qui recoupe le crop a toujours au moins un enfant qui le
   recoupe. **Retiré.** Ce qui garde réellement l'absence de trou est devenu une assertion
   d'ENSEMBLE : le crop doit être dessiné par **exactement les mêmes tuiles** avec et sans le
   drapeau.
4. **⑫ — un défaut réel que la mutation a rendu visible.** L'oubli de la référence d'altitude ne
   se faisait qu'**à l'aller** vers l'orbite : le retour comparait alors une altitude de surface
   au dernier résidu orbital. **Corrigé — l'oubli se fait à tout changement de mode**, et un
   test garde que l'orbite ne pollue pas les compteurs de la veille (⚠️ ces compteurs servent à
   **compter le battement** ; pollués, le banc mentirait).
5. **㉓ — un test trop faible.** Il posait le drapeau **après** la descente, donc les enfants
   hors crop étaient déjà en cache et la question ne se posait plus. Refait avec le drapeau levé
   **dès la première image**.

Et au deuxième tour, **⑦ (nouvelle) a survécu pour une raison instructive** : tous mes tests
passaient le globe **par sa valeur**, alors que la production le passe **par une fonction**
(réassignation à la perte de contexte WebGL). **La faute était invisible sous la seule forme que
la production n'emploie pas.** Test ajouté, mutation tuée.

---

## 6. Ce que la tâche NE fait pas, et mes réserves

- ⛔ **Le mode plat n'est pas touché.** `terrain.js`, `plinth.js`, `ocean.js` et le chemin bloc
  sont **intacts** (`git diff --stat` ne les nomme pas). `_cropSeul` naît à `false` et rien ne
  change tant que `poserCropSeul` n'est pas appelée — le patron « on élargit sans changer le
  défaut », et un test le garde.
- **Le cache n'a PAS eu besoin d'être protégé, et c'est arithmétique, pas de la chance.** Au
  repos, `tiles.size` va de 250 à 1 244 pour `cacheMax = 1 700` : **`_evict` ne passe jamais**,
  donc rien n'est rendu au réseau et le dézoom retrouve tout en cache. Vérifié dans le banc
  (« zéro tuile redemandée à la première image du dézoom ») et à l'écran. ⚠️ **Réserve : ce
  raisonnement tient tant que le cache ne déborde pas.** Sur un crop continental très large, ou
  avec un `cacheMax` plus serré, le dehors redeviendrait évinçable et chaque dézoom repaierait
  un chargement. **Ce n'est pas mesuré sur un crop continental** — c'est le point à surveiller.
- ⚠️ **`_visites` compte désormais autre chose.** La coupe est **avant** `_visites++`, donc la
  grandeur mesure « ce qui est réellement parcouru » et non « ce qui a été considéré ». C'est
  voulu (c'est l'instrument par lequel ce dépôt mesure l'emprise), mais **tout banc antérieur
  qui compare des `_visites` à travers cette tâche compare deux monnaies.**
- ⚠️ **Le gain rétrécit quand le bloc se fait grossier.** À l'altitude de bloc (z12), le crop
  fait 36 tuiles z13 sur 351 dessinées — le gain est massif. Au cran z10, le crop fait
  576 tuiles z13 et la station AVANT en dessinait 746 : **le gain tombe à environ un quart.**
  C'est mécanique (le crop grandit avec le cran) et ce n'est pas un défaut, mais **annoncer « on
  divise le dessin par dix » serait faux** : ça dépend du cran.
- ⚠️ **Le seuil de repos n'a été mesuré que sur UNE machine, UN taux d'images (60 Hz) et UN
  périphérique de zoom (une molette injectée).** Un pavé tactile à inertie, ou une machine à
  30 Hz, produiront d'autres écarts par image. Le seuil est en **échelle** (donc indépendant de
  l'altitude) mais **pas du taux d'images** : à 30 Hz le même geste physique double son écart
  par image, ce qui va dans le bon sens (il réveille plus facilement), et le délai de 30 images
  devient une seconde. **Non mesuré.**
- ⚠️ **Une capture manque : le drapeau baissé.** Le volet du navigateur s'est masqué en fin de
  session, ce qui étrique `rAF` et bloque `toDataURL`. Le contrôle a été fait **en relevés
  lus en direct** (`.banc/vues-N/CLOTURE-releves.json`) : `uCropOn = 0`, `uEstompageOn = 0`,
  `_cropSeul = false`, bloc plat visible, 7 348 images rendues, aucune exception. **Je ne
  prétends pas avoir REGARDÉ cette page-là ; j'ai lu son état.**
- **Ce que le banc ne peut pas dire** : si l'image est belle, et si la transition se voit comme
  un à-coup à l'œil d'Adrien. Le fondu dure 1,3 s ; je le trouve doux, mais **je l'ai déclenché
  par une molette injectée, pas par une main.**

---

## 7. Où sont les données brutes

Tout est dans **`.banc/`** (jamais dans un scratchpad) :

- `.banc/vues-N/AV-repos-bloc.json`, `AV-repos-31km.json` — la mesure AVANT
- `.banc/vues-N/AP-repos-bloc.json`, `AP-repos-26km.json`, `AP-repos-apres-dezoom.json` — APRÈS
- `.banc/vues-N/AV-apparie-26km.json` + `.png` — l'A/B apparié
- `.banc/vues-N/AV-trace-{orbite,molette,molette-saccadee}.json` — les traces par image
- `.banc/vues-N/hysterese-brut.json` — le dépouillement des seuils candidats
- `.banc/vues-N/AP-film-transition.json` — le dézoom filmé image par image
- `.banc/vues-N/mutations-N-{brut,tour2,tour3}.txt` — les trois tours de campagne
- `.banc/vues-N/CLOTURE-releves.json` — la page, drapeau levé et baissé
- `.banc/hysterese-N.mjs`, `.banc/paliers-N.mjs`, `.banc/mutations-N.mjs`,
  `.banc/serveur-vues-N.mjs` — les outils
