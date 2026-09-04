# GX2 — LE TRACÉ GPX EST REMIS DANS LA SCÈNE QUI EST RENDUE

Arbre `C:\Dev\wt-gx2`, branche `gpx-correctif`. **Le tracé est dessiné.**
Au régime de production (mode sphère, aucun drapeau d'adresse), le calque GPX
passe de **0 pixel** à **1 775 pixels** posés au repos sur le Mont-Blanc, et il
n'y a **aucune image sans tracé sur 20 relevés de lecture**, sur les trois
tracés. Les 7 tests de GX1 sont verts, plus 3 nouveaux **qui, eux, exécutent la
géométrie**.

---

## ⓪ LIGNES DE `main.js` TOUCHÉES — pour l'agent `wt-ramp`

Trois endroits, aucun dans `terrain.js`, `rampe-crop.js` ni le panneau de
réglages :

| lignes (après) | ce qui y est écrit |
|---|---|
| **5 026 – 5 045** | le dépôt `gpxPoseGlobe` (un objet inerte : caméra + fabrique), déclaré juste après `const fusionDesPasses` |
| **5 126 – 5 158** | dans `if (fusionDesPasses)` : la fabrique de poseur devient une constante nommée `faitPoseurGlobe` (elle servait déjà à `mapLayers`, elle sert maintenant aussi au GPX) + les deux lignes de dépôt |
| **8 530 – 8 541** | juste après `const gpxLayer = new GpxLayerManager(…)` : l'adoption `gpxLayer.poserScene(sceneGlobe)` + `gpxPoseGlobe.appliquer(gpxLayer)` |

Rien d'autre de `main.js` n'a bougé (`git diff -U0 src/main.js` : 4 fragments).

---

## ① CE QUI ÉTAIT CASSÉ, ET CE QUE J'AI ÉCRIT

GX1 l'avait établi et je n'ai pas remesuré : **D16-a a éteint la passe de
surface sous `terre unique`** et a déménagé un par un le disque solaire, le
cartouche, les nuages, les cotes et la cartographie dans `sceneGlobe`. **Le
calque GPX était le sixième objet de ce déménagement, et il a été oublié.**

Le correctif tient en trois gestes, et **l'ordre entre eux est le piège** :

1. **L'adoption de scène** — `GpxLayer.poserScene()` / `GpxLayerManager.poserScene()`,
   écrits sur le modèle exact de `MapLayers.poserScene` (un seul écrivain, il
   DÉPLACE au lieu d'ajouter, la scène est RETENUE pour les calques suivants).
2. **La caméra** — `camGlobe` : c'est elle qui dessine, et c'est d'elle que se
   déduisent la taille du curseur de survol et la tolérance de picking.
3. ⛔ **LA SIMILITUDE, sans laquelle les deux premiers ne valent rien.** GX1
   l'avait mesuré : adoption + caméra = **0 pixel quand même**. Le ruban est
   cuit en unités de BLOC (**727,6 m/unité** au Mont-Blanc, 190,0 en Camargue,
   91,0 à Chamonix) ; le crop est une découpe de la sphère `R_GLOBE = 100`
   (**63 710,1 m/unité**). **Facteur 87,56 au cadrage du Mont-Blanc, 335 et 700
   aux deux autres — il DÉPEND DU ZOOM.** Il n'est donc écrit nulle part en dur :
   il est relu à chaque reconstruction par `poseur.rapportSimilitude()`.

**Le chemin est celui qui existait déjà** : `poseurPourReconstruction`
(`monde/sol-globe.js`), la **même fabrique**, la **même expression de
`echelleBloc`** que `mapLayers` — une constante nommée plutôt qu'une seconde
écriture, parce que deux écritures d'une même loi finissent par diverger.

### Où la conversion s'applique, et à quoi

| objet | ce qu'il subit | pourquoi |
|---|---|---|
| ruban, sillage, ligne Line2, halo | **chaque sommet** par `placer` | c'est ce qui porte les pixels ; aucune approximation |
| étiquettes, bornes km, villages | position placée, **échelle NON touchée** | `sizeAttenuation = false` : leur taille est en fraction d'écran, la multiplier par `k` (÷ 87,56) les ferait disparaître |
| arches | similitude de GROUPE **ancrée sur l'arche** | le GLB arrive de façon asynchrone : on ne peut pas convertir ses sommets ; l'ancrage rend la pose exacte au pied de l'arche, et une arche fait dix mètres |
| curseur de survol | position placée, **plancher d'échelle × k** | `0,5` est une longueur de bloc : 0,5 unité de globe = 31 855 m de bille |
| `track.world` | **rien, il reste en unités de bloc** | le profil, la tête de course, le suivi caméra et les cartouches en dépendent tous |

⚡ **Et le sol se lit maintenant SUR LE GLOBE** (`poseur.hauteur`) : sans ça le
ruban se draperait sur les hauteurs du bloc pendant que le GPU dessine celles du
globe. `null` retombe sur le bloc, jamais sur zéro (la règle de `sol-globe.js`).

---

## ② LA PREUVE À L'ÉCRAN — comptée par DIFFÉRENCE, avec témoin de bruit

Banc de référence `scripts/banc-gx1-position.mjs`, **régime de production, sans
aucun drapeau**, grain et animations coupés, images issues de la boucle de
l'application, pixels comptés par différence (tracé allumé / éteint).

### Au repos

| tracé | AVANT (GX1) | **APRÈS** | attendus | témoin `?terre=deux` |
|---|---|---|---|---|
| Mont-Blanc 90 km | **0** (×6) | **1 511** | 2 018 (75 %) | 1 280 (GX1 : 1 053) |
| Camargue 5 km, plat | **0** | **1 440** | 1 437 (**100 %**) | — |
| Chamonix 4 km, montagne | **0** | **236** | 581 (41 %) | **276** (49 %) |

⚠️ **Le témoin A/A vaut 0 pixel** à ces relevés : ce ne sont pas des chiffres de
méthode.

### À quatre échelles, et pendant la lecture

Banc `scripts/banc-gx2-preuve.mjs` (nouveau) — quatre crans de zoom par
`modes.cranZoom(1)`, puis 20 relevés consécutifs de lecture, caméra figée :

| tracé | z0 | z1 | z2 | z3 | lecture (médiane) | **images sans tracé** |
|---|---|---|---|---|---|---|
| Mont-Blanc 90 km | 1 775 | 2 412 | 3 315 | 5 896 | 1 804 px | **0 / 20** |
| Camargue 5 km | 1 977 | 2 594 | 4 124 | 6 620 | 8 828 px | **0 / 20** |

Altitudes de cadrage couvertes : **26 484 m → 18 567 → 12 969 → 9 010 m** au
Mont-Blanc, jusqu'à **2 363 m** en Camargue.

### Les captures pour Adrien — `.banc/GX2/`

| fichier | ce qu'on y voit |
|---|---|
| `mb-z1.png` · `mb-z1-surligne.png` | la même image, et **les pixels du tracé peints en vert** : ils dessinent la boucle du Marathon dans la vallée de Chamonix, bornes kilométriques comprises |
| `mb-z3.png` | le tracé en vermillon sur le relief, cadrage serré |
| `camargue-lect10.png` | **le tracé en pleine lecture**, ruban large, tête de course visible |

⛔ `.banc/` est git-ignoré : tous les chiffres sont recopiés ici.

---

## ③ CE QUI N'A PAS BOUGÉ — et c'est vérifié, pas supposé

| grandeur | GX1 (avant) | **après** | verdict |
|---|---|---|---|
| aller-retour lat/lon (60 points) | 0,00 m moy et max | **0,00 m** | inchangé |
| déformation (40 paires vs géodésique) | 0,01 % moy · 0,13 % max | **0,00 % · 0,13 %** | inchangé |
| échelle du bloc | 727,6 / 190,0 / 91,0 m/u | **727,6 / 190,0 / 91,0** | inchangé |
| drapage, tracé plat (Camargue) | **+2,6 m** | **+2,6 m** (min −1,2 max 3,6) | inchangé au dixième |
| drapage, Chamonix | +2,2 m | **+2,2 m** | inchangé |
| drapage, Mont-Blanc | −4,7 m (min −68,2 max 52,2) | **−4,7 m (−68,2 / 52,2)** | inchangé |

⚡ **Ces trois lignes de drapage sont la meilleure preuve que la conversion est
juste** : le ruban prend désormais sa hauteur sur le GLOBE, et l'écart au sol du
BLOC reste identique au centième — les deux hauteurs sont la même donnée.

**Aucune régression sous `?terre=deux`** : **1 280 px** au même cadrage contre
1 053 mesurés par GX1 (seuil E3 : ≥ 950). Le test ③ du nouveau fichier garde
l'identité de la conversion hors globe, au flottant près.

**Coût** (mesuré au même cadrage, tracé allumé / éteint / rallumé) :

| grandeur | tracé éteint | tracé allumé |
|---|---|---|
| image médiane | 16,60 ms | **16,60 – 16,70 ms** |
| p95 | 17,20 ms | 17,10 – 17,70 ms |
| géométrie du calque | — | 2,03 Mo (25 500 sommets de ruban) — **inchangée** |
| requêtes réseau | — | **0 de plus** (le poseur ne lit que des tuiles déjà chargées) |

La conversion coûte **une passe par RECONSTRUCTION**, jamais par image.

---

## ④ LES TESTS — 7 verts, et un huitième fichier qui MORD LES PIXELS

```
7 tests de GX1  ·  pass 7  ·  fail 0
suite complète  ·  tests 4 992  ·  pass 4 992  ·  fail 0
npm run audit:tests  ·  273 listés · 273 sur disque · Aucun écart
```

⚠️ **L'auteur des sept tests prévient qu'ils gardent le CÂBLAGE, pas les
pixels** — un correctif simulé les rend tous verts en laissant 0 pixel à
l'écran. **J'ai donc rendu une garde sensible à la géométrie**, comme le brief
le demandait :

`test/gpx-pose-globe.test.js` (3 tests, EXÉCUTÉS) prend de vrais sommets de bloc,
les passe par `poseTableauEnPlace` — la fonction que `gpx.js` appelle vraiment,
extraite dans `monde/sol-globe.js` **pour être testable** — et vérifie :

1. qu'ils **quittent l'espace du bloc** (rayon > 90 unités au lieu de < 40) et
   tombent **sur la surface dessinée** (`R_GLOBE + h × echelleGlobe`, à 1e-6) ;
2. que le facteur vaut **87,56 / 335,3 / 700,1** aux trois cadrages — donc qu'il
   n'est pas une constante ;
3. qu'hors globe la conversion est **l'identité**, sommet par sommet.

➡️ **Le correctif simulé de GX1 (adoption + `setCamera`) laisse ce fichier
ROUGE.** C'est la garde qui manquait.

---

## ⑤ ⚠️ LE SEPTIÈME OBJET OUBLIÉ — `boats`

Le brief demandait de chercher s'il restait d'autres calques oubliés dans le même
déménagement. **Relevé au navigateur** (contenu réel des deux scènes, régime de
production) :

| objet resté dans la scène du bloc | `visible` | enfants | lecture |
|---|---|---|---|
| lumières (3) | oui | — | sans objet : `sceneGlobe` porte l'`environment` |
| `plinth` | **non** | 5 | éteint volontairement — le socle vient du crop |
| `real-water` | **non** | 2 | éteint volontairement — la mer vient du globe |
| `traffic` | **non** | 0 | éteint |
| **`boats`** | ⚠️ **OUI** | 0 à ce relevé | **groupe ALLUMÉ dans une scène que personne ne rend** |
| Group anonyme (hud3) | non | 3 | éteint |

⚡ **`boats` (`src/boats.js:43`, `scene.add(this.group)`) est le seul objet
encore ALLUMÉ dans la scène morte.** Son groupe était vide à l'instant du relevé
(aucun bateau engendré sur ce cadrage alpin), donc **je ne l'ai pas corrigé — je
ne l'ai pas vu manquer à l'écran** et je ne voulais pas poser une similitude sur
une flotte sans banc pour la mesurer. **Mais tout dit qu'un bateau engendré au
bord d'une mer, en production, est aujourd'hui dessiné dans le tampon que
personne ne regarde.** C'est le prochain à vérifier, et le geste est le même que
celui de ce rapport.

Deux autres observations, à signaler et pas à corriger :

- **Les arches sont des `MeshStandardMaterial` et `sceneGlobe` ne porte AUCUNE
  lumière** — seulement `environment`. Elles seront donc plus plates que sur le
  bloc. Rien ne le mesure aujourd'hui.
- **Un tracé qui déborde du socle est dessiné DANS LE VIDE** (visible sur
  `mb-z3.png`, la boucle ouest flotte hors du bloc) au lieu d'être écrêté au
  bord. ⚠️ **Ce n'est ni une régression ni un effet de cette tâche** : c'est le
  repli à plat de `rebuild()` pour les points hors bloc, il existait déjà sous
  `?terre=deux`. C'est le point « dans le crop ET hors du crop » du barème, et je
  le rends non tenu.

---

## ⑥ CE QUE J'AI CRU, PUIS RÉFUTÉ

1. **« Les tests verts, c'est fini. »** ⛔ Réfuté par la mesure, exactement comme
   l'attaquant l'avait annoncé : les 7 tests étaient verts **avant** que le
   moindre sommet ne bouge — l'adoption de scène et `setCamera` suffisent à les
   satisfaire. Le premier banc qui a suivi affichait encore **0 pixel** au repos.
   C'est la similitude, écrite après, qui a allumé le tracé.
2. **« Le banc de GX1 dit la vérité tel quel. »** ⛔ **Réfuté deux fois, et ce
   sont les deux faux constats que J'AI produits :**
   - **il projetait avec `e.camera`, la caméra du BLOC**, alors que sous
     `terre unique` l'image sort de `camGlobe`. Résultat : *« 0/48 sommets à
     l'écran, longueur 0 px, attendus 0 »* **sur une image où le tracé occupe le
     centre**. Le banc choisit maintenant la caméra **en mesurant** laquelle met
     le plus de sommets à l'écran, au lieu de la supposer ;
   - **il comptait douze salves fixes avant de mesurer.** Un premier relevé est
     sorti avec le MNT pas encore centré sur le tracé : les 48 sommets à
     `y = DRAPE_LIFT`, drapage `−766,5 m` partout, `dansBloc: false`. Il attend
     maintenant que **le drapage existe** — la seule preuve que le relief est
     arrivé.
3. **« Un zéro est un zéro. »** ⛔ Réfuté : trois relevés de lecture sur vingt
   sont sortis à **exactement 0 pixel de différence pendant que le témoin de
   bruit de la même image en annonçait 2 500**. Deux images identiques au pixel
   près pendant que la scène bouge, **c'est une capture rendue deux fois**, pas
   un tracé absent. Le banc tourne maintenant deux images avant chaque capture et
   **ne déclare une image vide que si deux relevés le confirment** : 0/20.
4. **« ≥ 40 sommets sur 48 à ≤ 6 px, c'est atteignable. »** ⛔ Réfuté **par le
   témoin lui-même** : sous `?terre=deux`, le régime où le tracé a toujours été
   dessiné, le banc rend **13/48, médiane 19,1 px** — le chiffre exact du rapport
   GX1. Après correction, la production rend **12/48, médiane 26,9 px** au
   Mont-Blanc et **3/48 contre 3/48** à Chamonix : **la parité avec le témoin,
   pas un défaut de position.** Ce que cette mesure chiffre n'est pas la position
   (aller-retour 0,00 m) mais **combien du ruban le relief cache** — un ruban de
   1,5 px de large vu de 26 km passe derrière chaque crête.
5. **« Le facteur d'échelle est une constante à écrire une fois. »** ⛔ Réfuté :
   87,56 / 335,3 / 700,1 aux trois cadrages. Il est relu, jamais écrit.
6. **« `_construitRuban` et `rebuild()` peuvent garder deux demi-emprises
   différentes. »** GX1 le signalait comme inerte (§⑧). Je les ai **alignées sur
   `demSpan(dem)/2`** : deux écritures d'une même limite finissent toujours par
   se contredire, et celle-ci était déjà fausse sur une emprise 3×3.

---

## ⑦ COMMENT REJOUER

```bash
node_modules/.bin/vite --host 127.0.0.1 --port 9471 --strictPort

node scripts/banc-gx1-position.mjs --port 9471 --etiquette mb
node scripts/banc-gx1-position.mjs --port 9471 --etiquette mb-deux --adresse "terre=deux"
node scripts/banc-gx1-position.mjs --port 9471 --gpx .banc/court-plat-camargue-5km.gpx --etiquette camargue
node scripts/banc-gx1-position.mjs --port 9471 --gpx .banc/court-montagne-chamonix-4km.gpx --etiquette chamonix

node scripts/banc-gx2-preuve.mjs   --port 9471 --etiquette mb        # 4 échelles + 20 images de lecture + captures surlignées
npm test && npm run audit:tests
```

⚠️ Les deux tracés courts viennent de `C:\Dev\wt-gx1\.banc\` (git-ignoré) et ont
été recopiés dans `.banc/` ; sans eux les deux dernières lignes retombent sur le
Mont-Blanc.
