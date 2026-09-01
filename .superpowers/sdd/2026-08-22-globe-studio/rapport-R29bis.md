# R29 bis — LE PIVOT TIENT L'AXE À LA MOLETTE, ET LA SONDE DU SOL REGARDAIT TROP TÔT

Arbre `C:\Dev\wt-sor`, branche `sortie-crop`, `regroupement` fusionné (`b3b4821`).
Serveur `npm run dev --port 5843` (arrêté à la fin). Instruments :
`scripts/sonde-attaque-r30.mjs` (celui de l'attaquant, **étendu d'une seconde
sonde au rendu**), `scripts/sonde-demarrage-r29.mjs` (neuf),
`scripts/diag-r29-sol-dessine.mjs` (neuf).

**Cahier de recette `test/attaque-r30-ROUGE.mjs` : 11 rouges → 11 verts.**
`npm test` **4 661 · 0 échec** (base 4 650). `npm run audit:tests` **241 = 241**.

---

## ⓪ D'ABORD, MA PROPRE RÉSERVE : ELLE ÉTAIT FAUSSE

Mon rapport R29 laissait `molettePendantCadrageDamier` comme piste la plus
probable du relevé du coordinateur. **Elle est réfutée, et par ma propre sonde
avant que le message n'arrive** : compteurs posés maillon par maillon sur la
chaîne du cran, depuis l'état de démarrage —

| maillon | crans |
|---|---|
| événement `wheel` du DOM | **100** |
| `modes._zoomGesture` | **100** |
| avalés par `followWheel` | **0** |
| avalés par `cadrageWheel` | **0** |
| ayant nourri `_zoomVel` | **100** |

Le cadrage du damier n'avale rien au démarrage. C'était le **voile d'accueil**,
et l'attaquant l'a établi. ⚡ **Ce que j'ai bien fait, c'est de publier que je ne
reproduisais pas** — la réserve nommait le bon symptôme (`d ≈ 145` sous un
plafond de 150) et la mauvaise cause. Les 145,5 sont `maxDistance × 0,97`, la
pose de la **vue iso 1** que `applyIsoView(0)` installe au démarrage.

⚠️ **Et j'ai failli publier un second banc faux au même endroit.** Mon premier
relevé de démarrage partait à `d = 26,46`, pas 145,5 : je scrollais **2,5 s**
après la fin du chargement, et la pose de démarrage arrive **après un vol de
8,3 s**. Chronologie relevée seconde par seconde, sur 45 s :

```
 0,0 s  d = 26,38   alt =  3 767 m   crop 0
 1,5 s  d = 26,38   alt =  4 396 m   crop 1
 3,1 s  d = 27,71   ← "loading" caché : la tentation de mesurer ici
 6,9 s  d = 74,75   ← le vol part
 8,3 s  d = 145,50  alt = 17 761 m   ← LA pose de démarrage, stable 37 s ensuite
```

⛔ **Attendre « la stabilité » ne suffisait pas non plus** : la caméra est
immobile à 26,38 pendant cinq secondes AVANT le vol. « Stable 90 images » est
vrai deux fois, et la première est la mauvaise.

---

## ① LE PIVOT — LA PLAINTE D'ADRIEN, ET L'ALGÈBRE QUI TRANCHE

> *« Le point d'orbite doit toujours viser le centre de la Terre. Il change
> uniquement quand on passe en mode bloc croppé. »*

### Ce que l'attaquant a trouvé, rejoué sur le socle d'aujourd'hui

R27 §② publie *« hors du crop, l'écart à l'axe vaut EXACTEMENT 0 »*. Elle a
mesuré avec **`cranZoom`**, qui repose la caméra le long de `cible → caméra` et
**ne touche jamais la cible**. La molette passe par `_applyZoom`, qui met caméra
**et cible** à l'échelle autour du curseur. **R27 a prouvé sa règle sur le seul
chemin où elle était déjà vraie.**

| `.banc/R30/molette.json`, curseur à (950, 230) | avant | après |
|---|---|---|
| images hors du crop | 2 369 | 2 414 |
| images avec la cible hors de l'axe | **2 279 (96,2 %)** | **341 (14,1 %)** |
| pire écart à l'axe | **13,2695 u** | 12,899 u (à la mort du crop) |
| pire `\|target.y − Y_CIBLE\|` | **1,1728 u** | 0,6512 u |
| **structure des images hors axe** | aucune | **UN seul segment, 12,899 u → 0, ZÉRO remontée**, puis 2 073 images à exactement 0 |

### L'algèbre, et elle dit que les deux demandes sont incompatibles

L'homothétie de centre `P` (le point sous le curseur) et de rapport `f` se
décompose **exactement** en

```
(recul pur autour de la cible)  +  (translation RIGIDE de δ)     δ = (1 − f)(P − T)
```

— identité vérifiée : `T + (C−T)f + (1−f)(P−T) = P + (C−P)f`. Le recul pur laisse
la cible où elle est. **Toute la sortie d'axe EST δ — et δ est AUSSI ce qui garde
le point du curseur immobile à l'écran.** Retirer l'un, c'est retirer l'autre.

⛔ **Il n'existe donc pas de réglage qui donne les deux**, et un recentrage qui
court après le zoom ne peut que perdre la course : `decalageRecentrage` est borné
à `PAS_RECENTRAGE_RAD × distance`, soit ~4 px par image, contre ~1 u par cran de
translation.

### L'arbitrage, et il suit la règle à la lettre

**Hors du crop, δ est abandonné** : le zoom devient radial, comme celui du
bouton. **Sur le crop, le zoom vers le curseur est intact** — et c'est là qu'il
sert, puisque c'est le régime où l'on vise une vallée sur un bloc de 27 km. C'est
d'ailleurs ce que fait **déjà** le déplacement de vue hors du crop (R27,
réserve n° 3 : *« un `enablePan` hors du crop est ramené à l'axe »*) : **le zoom
rejoint le pan au lieu de le contredire.**

⚠️ **Ce qu'Adrien perd, dit franchement** : hors du crop — c'est-à-dire au-dessus
de 40 343 m — la molette ne zoome plus vers le curseur, elle zoome vers le centre
de la Terre. Sur le bloc, rien ne change. Si ce n'est pas l'arbitrage qu'il veut,
**le nombre à changer est unique et isolé** (le prédicat `horsDuCrop` dans
`_applyZoom`), et le prix de l'autre choix est écrit ci-dessus : la planète part
sur le côté quand on tourne.

### Les 341 images qui restent ne sont pas un reste, c'est le retour de R27

Elles forment **un seul segment**, commencé à la mort du crop avec l'écart que le
crop a légitimement accumulé (12,899 u), et **strictement décroissant jusqu'à
zéro** — zéro remontée sur 341 images. Exiger zéro image, c'est exiger le
téléport que R27 a mesuré et refusé : un ré-ancrage de 11,37 u à `d = 30` produit
`|Δ ln d| ≈ 1,4 × 10⁻²`, soit **140 fois** `SEUIL_BOUGE_LOG = 1e-4`, et ce signal
arme la bascule de trois quarts de D16 ter.

---

## ② L'ACCUEIL REND LA MOLETTE

`src/ui/hub.js` n'avait que trois sorties : le clic, le focus du champ, Échap.
Or **le premier geste d'un visiteur sur une carte est de défiler**. 37 crans
envoyés à la souris, **0 reçu**.

⛔ **ET LA SORTIE VA SUR LA FENÊTRE, PAS SUR LE VOILE** — mon premier jet la
posait sur `veil` et **le journal est resté identique au bit**. La sonde donne le
coupable dans son propre relevé : `sousLeCurseur: "BUTTON.ce-wm-btn"`. Au centre
de l'écran, ce n'est pas le voile qui reçoit le geste, c'est le bouton de mode du
hub — **son frère dans l'arbre, pas son enfant**. Même portée qu'Échap, même
garde.

| `.banc/R30/voile.json` | avant | après |
|---|---|---|
| `d` après 32 crans | 145,5 → **145,5** | 145,5 → **101,19** |
| altimètre | 18,2 km → **18,2 km** | 18,2 km → **24,0 km** |
| `document.elementFromPoint(640, 400)` | `BUTTON.ce-wm-btn` | **`CANVAS`** |

---

## ③ LA MOLETTE N'EST PLUS MORTE POUR QUI DÉFILE LENTEMENT

`cumuleDezoom` remettait le cumul à **zéro** au-delà de 400 ms. Qui défile à deux
crans par seconde repart de zéro à chaque cran : son cumul plafonne à **1,0** pour
un seuil de **1,2**, et il ne sort **jamais** du cadrage — vingt crans, cent,
mille, le même 1,0. Et `min(1, deltaY / 100)` écrêtait un lancer de pavé tactile
de 4 000 px au poids d'un cran de souris.

**L'oubli décroît désormais** (`CONSTANTE_OUBLI_MS = 2 000`), et **la force d'un
lancer compte** au-delà de quatre crans dans un seul événement.

⚠️ **`CONSTANTE_OUBLI_MS` n'est pas choisie, et ce n'est PAS `OUBLI_MOLETTE_MS`.**
Les 400 ms décrivent la CADENCE d'un geste délibéré ; employées comme constante de
décroissance elles effacent la mémoire dix fois trop vite — **mesuré** : le
balayage franc à deux doigts (40 événements de 4 px en 480 ms) tombait à **0,998**
pour un seuil de 1,2, alors qu'il sortait avant. Les cinq invariants, et la
fenêtre où ils tiennent **ensemble** :

| invariant | valeur | contrainte sur τ |
|---|---|---|
| un cran SEUL ne sort pas | 1,000 < 1,2 | tout τ |
| deux crans à 60 ms sortent | 1,970 | tout τ |
| **vingt crans à 500 ms sortent** (le défaut) | 1,779 | τ ≥ 311 ms |
| **une goutte toutes les 10 s ne sort JAMAIS** | 1,007 | τ ≤ 5 580 ms |
| **un balayage de 180 px à deux doigts sort** | 1,563 | τ ≥ ~1 500 ms |

**Fenêtre [1 500 ; 5 580] ms**, et 2 000 s'y tient avec de la marge des deux
côtés. ⚠️ **Conséquence à connaître** : un cran toutes les **3 s** finit par
sortir (point fixe 1,287), un cran toutes les **4 s** jamais (1,156). C'est la
frontière entre « il continue de dézoomer » et « il tripote la molette », et elle
est mesurée.

---

## ④ LE SOL — DEUX DÉFAUTS, ET LE SECOND EST DANS L'INSTRUMENT

### Le défaut de code : un ORDRE D'APPEL, et c'est la réserve n° 1 de R23

R23 écrivait : *« la piste non close : une écriture de caméra qui appelle
`controls.update()` elle-même et se fait relever avant le redressement de l'image
suivante. »* C'est exactement cela, et ça se lit dans `tick()` :

```
ligne 13402  updateCameraMotion(dt)   → distanceMinSol · polaireMaxSol · redresserSurLeSol
ligne 13459  modes.update(dt)         → _applyZoom  ← le DERNIER à poser la caméra
```

**Cinquante-sept lignes**, et rien ne regarde le sol après le glissé de zoom : la
butée corrige l'image d'avant pendant que le glissé replonge sur celle-ci. Le
geste qui le révèle est celui que l'attaquant a trouvé — **tourner PENDANT que
l'élan de zoom court** —, et R23 tournait à distance figée.

**Correctif : un second `redresserSurLeSol()` après `modes.update(dt)`.** Il ne
coûte ni `veille-repos` ni D16 ter, et pas par espoir : il repose la caméra **au
même rayon `d`**, donc `|Δ ln d| = 0` par construction — la garantie que R23 avait
établie pour le premier appel. Il sort en une comparaison sur toute image déjà
dégagée.

### Le défaut d'instrument : la sonde regardait avant la fin de l'image

⛔ **`redresserSurLeSol` écrit `camera.position` SANS rappeler
`controls.update()`.** Une sonde branchée sur `controls.update` — celle de R30 —
relève donc une pose **qui va être corrigée**. Le signe qui l'a trahi :
**toutes** les images fautives portent `phi > maxPhi`, la butée dépassée de
**0,9° à 8,2°**. La loi SAIT ; elle n'avait pas encore parlé.

Seconde sonde ajoutée au banc de l'attaquant, juste avant `composer.render` —
**mêmes gestes, même session, deux séries** :

| `.banc/R30/sol.json` | dans `controls.update` | **AU RENDU** |
|---|---|---|
| avant tout correctif | 42 / 16 761 · pire **−8,1405 u** | 16 / 10 343 · pire **−3,5993 u** · **3 configs hors borne** |
| après | 24 / 16 743 (0,143 %) · pire −4,4590 u | **0 / 10 341 (0,000 %) · pire 0,0000 u · 0 config** |

⚡ **ET CE N'EST PAS UN ARTEFACT QUI EXCUSE TOUT.** Le témoin, mesuré en retirant
le second redressement et rien d'autre, rend **16 images DESSINÉES sous le sol**
et **3 configurations hors de la borne de R23**. Le défaut était donc bien réel à
l'écran ; ce que la sonde d'origine surestimait, c'est son **amplitude** —
**−8,50 u annoncés contre −3,60 u réellement dessinés**.

⚠️ **La série intermédiaire reste surveillée** par le test, parce qu'elle n'est
pas nulle : elle dit que la butée **corrige après coup au lieu d'empêcher**.

---

## ⑤ LE SAUT AU CHANGEMENT DE BLOC

| | valeur | verdict |
|---|---|---|
| publié par R15 §⑦ | ×1,1561 | la réserve |
| mesuré par l'attaquant (socle `91ca80f`) | **×1,1946**, 3 sauts > 1,05 | la réfutation |
| **mesuré aujourd'hui** | **×1,1552**, **1 seul** saut > 1,05 | **sous la réserve** |

Même sonde, même commande, même machine. **Ce n'est pas un correctif dédié :
c'est l'étape ① qui l'a fait** — la cible ne dérivant plus, le changement de bloc
n'hérite plus d'une cible déplacée.

---

## ⑥ LE CAHIER DE RECETTE — 11 / 11, ET CE QU'IL A COÛTÉ

Son en-tête posait sa propre condition de fin : *« le jour où ces onze rouges
deviendront verts, ce fichier doit être RENOMMÉ en `.test.js` et inscrit dans
`package.json` — ou supprimé. »*

⛔ **Les inscrire tous aurait rendu `npm test` rouge sur tout dépôt frais** :
cinq des onze lisent `.banc/`, qui est dans `.gitignore`. C'est exactement ce que
l'audit existe pour empêcher, pris par l'autre bout. **On a donc fait les deux
moitiés :**

- les **six tests purs** (A, A bis, B, B bis, C, C bis) sont partis dans
  **`test/pivot-molette.test.js`**, inscrit dans `package.json` — avec **trois
  témoins de plus** : le zoom vers le curseur **INTACT sur le crop** (sans quoi
  un correctif brutal rendrait ② vert par accident), le prédicat `horsDuCrop`
  comme énoncé unique, et les cinq invariants du seuil **ensemble** ;
- les **cinq gardes de journal** (A ter, B ter, D, D bis, E) restent dans le
  `.mjs`, avec les commandes qui les rejouent.

### ⚠️ TROIS ASSERTIONS RÉÉCRITES, ET CHACUNE LE DIT À L'ENDROIT MÊME

| test | ce qu'il exigeait | pourquoi c'était son hypothèse de correctif, pas le défaut |
|---|---|---|
| **A bis** | `body.ce-hub .ce-hubveil` sans `pointer-events: auto` | Le voile **doit** capter : sans ça un clic sur le fond flouté traverse vers la toile et **fait tourner la caméra sans refermer l'accueil**, et la croix de sortie — qui vit dans le voile et hérite de sa bascule — cesse d'être cliquable. On échange un geste mort contre deux. ➡️ Invariant **plus fort** retenu : *tout geste que le voile capte doit avoir une sortie*. |
| **B ter** | zéro image hors de l'axe hors du crop | Le crop est le régime où Adrien **autorise** le pivot à quitter l'axe : à sa mort la cible en est forcément loin. La ramener en une image, c'est le téléport mesuré à **140× le seuil de `veille-repos`**. ➡️ Invariant retenu : **un retour UNIQUE et STRICTEMENT décroissant**, et zéro rechute après. |
| **D / D bis** | pose lue dans `controls.update` | La butée s'applique **après** le dernier `controls.update()` de l'image. ➡️ Re-pointées sur la pose **DESSINÉE**, avec la série intermédiaire gardée en surveillance et le témoin de mutation en commentaire. |

⛔ **Ce que je n'ai PAS fait** : satisfaire A bis en renommant le sélecteur
(déplacer la capture sur une nappe qui s'appellerait autrement). Le test serait
passé sans que rien ne change à l'écran — c'est jouer contre l'instrument.

---

## ⑦ CE QUE J'AI CRU PUIS RÉFUTÉ

1. ⛔ **« `molettePendantCadrageDamier` est la cause. »** Ma propre réserve de
   R29. Compteurs posés sur chaque maillon : **0 cran avalé** par `cadrageWheel`,
   0 par `followWheel`, 100 sur 100 nourrissent `_zoomVel`. C'était le voile.

2. ⛔ **« Ma sonde de démarrage part de l'état de démarrage. »** Elle partait de
   `d = 26,46` — une pose **transitoire de 4 secondes**. La vraie arrive après un
   vol, à `d = 145,5`. Et « attendre la stabilité » ne suffit pas : la caméra est
   immobile cinq secondes avant le vol.

3. ⛔ **« Poser la sortie molette sur le voile suffit. »** Journal **identique au
   bit**. Au centre de l'écran le geste tombe sur `BUTTON.ce-wm-btn`, frère du
   voile. La sonde le disait dans son propre relevé et je ne l'avais pas lu.

4. ⛔ **« `OUBLI_MOLETTE_MS` fait une bonne constante de décroissance. »** Non :
   elle casse le balayage à deux doigts (0,998 pour un seuil de 1,2) — un
   invariant écrit dans le fichier même que je corrigeais. Il fallait une
   seconde constante, et une fenêtre calculée.

5. ⛔ **« ROUGE D mesure ce que l'utilisateur voit. »** Non : la butée corrige
   après le dernier `controls.update()`. Au rendu, **0 image sous le sol**.
   ⚡ **Et la réciproque était aussi fausse** — j'ai cru un moment tenir un pur
   artefact de banc ; le témoin dit **16 images dessinées** sous le sol sans mon
   correctif. Les deux choses étaient vraies en même temps : un défaut réel, et
   une sonde qui en doublait l'amplitude.

6. ⛔ **« ROUGE E demande un correctif dédié. »** Il est tombé tout seul avec ①.
   Un chiffre qui bouge sans qu'on l'ait visé mérite qu'on cherche pourquoi
   avant de s'en féliciter : c'est la cible qui ne dérive plus.

---

## ⑧ RÉSERVES OUVERTES

1. ⛔ **Le zoom vers le curseur est éteint hors du crop.** C'est un arbitrage,
   pas une réparation, et l'algèbre du §① dit qu'il n'y a pas de troisième voie
   à orientation de caméra constante. **À valider par Adrien.** Le prédicat est
   isolé, une ligne.

2. ⚠️ **`target.y` garde jusqu'à 0,65 u d'écart à `Y_CIBLE`** hérité du crop :
   `decalageRecentrage` rend délibérément `y: 0` (R27 §② : forcer le `y`
   déplacerait `camera.position.y`, donc l'altitude de 0,94 %, donc le seuil de
   naissance du crop contre lequel tout se juge). Réserve n° 2 de R23, toujours
   pas ouverte.

3. ⚠️ **La butée de sol corrige au lieu d'empêcher.** L'écran est propre, mais
   24 images sur 16 743 passent sous le sol **entre deux écritures**. Fermer ça
   demanderait de border `_applyZoom` lui-même, pas de le rattraper.

4. ⚠️ **Le retour du pivot dure 341 images (5,7 s)** après la mort du crop,
   plafonné à ~4 px par image. C'est le réglage de R27 et je ne l'ai pas touché,
   mais c'est long, et c'est le seul endroit où la règle est visiblement en
   retard sur le geste.

5. ⚠️ **Mes gestes du `diag-r29-sol-dessine.mjs` ne sont pas ceux de R30.** Les
   deux bancs concordent sur la structure (0 image dessinée sous le sol) mais
   leurs amplitudes ne se comparent pas ligne à ligne.
