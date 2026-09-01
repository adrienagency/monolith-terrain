# R24 — LA TOPONYMIE DE LA SPHÈRE

Arbre `C:\Dev\wt-top`, branche `toponymie-globe`. Serveur `npm run dev --port 5931`
(**arrêté**). Lieu de mesure : **La Réunion, `dem.lat = −21,26 / lon = 55,74`,
z12, emprise 27 354,269 m, exagération 2** — c'est l'endroit où la sphère ouvre
par défaut, drapeaux levés, sans un seul paramètre d'URL.

Relevés : `.banc/R24/` (`avant5.json`, `apres.json`, `ancrage-avant.json`,
`ancrage-apres.json`, `apres-sansfixture.json`).
Sondes : `scripts/sonde-toponymie-r24.mjs`, `scripts/sonde-ancrage-r24.mjs`.

---

## 1. LES DEUX RÉGLAGES, ET ILS N'ÉTAIENT PAS DU MÊME CÔTÉ

| n° | libellé | ce que l'inventaire disait | ce que la mesure dit | issue |
|---|---|---|---|---|
| **21** | Sommets | ⛔ objets accrochés à la scène du bloc | **déjà réparé par R18** (`inventaire-studio-2.md:131` le dit : « ✅ FAIT ») — le tableau ⛔ du brief cite les lignes 272-273, qui sont le relevé BRUT d'avant R18 | **vivant, mais deux défauts restaient** : l'ancrage lisait le sol du BLOC, et l'interrupteur relançait une requête Overpass à chaque bascule (**5 requêtes pour 5 bascules**, mesuré) |
| **22** | Points cotés | ⛔ points cotés du bloc | **mort, et le groupe est PEUPLÉ** : `cotes.total = 14`, `groupeVisible = false` **aux cinq altitudes**, y compris devant le crop | **réparé** : 14 cotes vivantes au sol, 0 au-dessus du crop |

### Le chiffre qui prouve chaque issue

* **21 — Sommets.** Cinq bascules de l'interrupteur, geste réel, requêtes comptées
  au protocole (`.banc/R24/ancrage-{avant,apres}.json` §④) :
  **avant 5 requêtes Overpass · après 0.** Et l'ancrage : à la vue de départ,
  **0 repère sur 5 sous le sol dessiné**, hauteur minimale **122,1 m** au-dessus
  de la surface que le GPU dessine.
* **22 — Points cotés.** `.banc/R24/avant5.json` contre `.banc/R24/apres.json`,
  même parcours, même fixture : **cotes vivantes 0 · 0 · 0 · 0 · 0** devient
  **0 · 0 · 0 · 0 · 14**. Le groupe portait déjà ses 14 plans dans les deux cas.

---

## 2. CE QUE CONTIENT VRAIMENT `cities.json` — ET IL EST PARTI

Lu, pas supposé. **73 448 octets, 2 068 lignes**, un tableau de tuples :

```
["Tokyo",35.687,139.749,35676000,1]     ← [nom, lat, lon, population, capitale]
["Bir Lehlou",26.119,-9.653,500,1]      ← la dernière ligne
```

| | |
|---|---|
| arité | **5**, sur les 2 068 lignes — aucune ligne malformée |
| population | 500 → 35 676 000, **trié décroissant** ; 6 lignes seulement sous 10 000 hab., 1 034 au-dessus de 500 000 |
| capitales | **215** (5ᵉ champ = 0/1) |
| couverture | latitudes **−43,5 → +69,0**, longitudes **−175,2 → +179,2** ; rien au-delà des cercles polaires |
| graphie | locale et accentuée — São Paulo, Ōsaka, Brasília, Ürümqi |
| doublons de nom | 37 |

**Provenance : écrite en clair dans le commit qui l'a ajouté** (`bfcdc7c`,
2026-07-14) — *« Natural Earth 10m, pop>=200k + capitals »*. Le seuil de 200 k se
lit dans la distribution : 29 lignes seulement sous 100 000, et ce sont des
micro-États (Monaco 36 371, Andorre 53 998, Luxembourg 107 260) plus quelques
capitales minuscules — exactement le « + capitals » de la recette.

**Licence : Natural Earth est dans le DOMAINE PUBLIC, sans restriction.**
Ce n'est donc PAS la licence qui le disqualifie.

### ⛔ Ce qui le disqualifie : il est déjà supersédé, et le dépôt l'a écrit

`docs/superpowers/specs/2026-07-15-map-layers-panel-design.md:54` porte la phrase
**« supersedes `cities.json` »**. Le jeu servi aujourd'hui est
`public/data/map/places.json` : **GeoNames cities1000, 158 474 lignes**, seuil
~1 000 habitants au lieu de 200 000, **plus un sixième champ que `cities.json`
n'a pas — `min_zoom`**, celui que `map/place-tier.js` calcule et que
`pickPlaces` applique. Lima, Taipei, Lahore, Riyad : toutes présentes.
Et il est **découpé en cellules** (`build-map-cells.mjs`) : **27 Ko pour Annecy
au lieu de 2 688 Ko**.

Son calque `src/cities.js` a été retiré au commit `ec9f853` quand `MapLayers` a
été branché ; **le fichier de données, lui, est resté**. Et `public/` part dans
`dist/`.

➡️ **Retiré** (commit `9faf3bc`), avec la ligne de `docs/fonctions.md` qui le
citait encore. Build vérifié : `dist/data/cities.json` n'existe plus,
`dist/index.html` oui.

⚠️ **Et il n'y avait rien à en tirer pour cette tâche de toute façon** : le
libellé du curseur dit « Points cotés », c'est-à-dire **des altitudes cotées**,
et la toponymie mondiale est déjà en service par `map/places-layer.js` — que
D16-b a relogé sur la sphère il y a un jour.

---

## 3. LE TABLEAU DES ÉTIQUETTES — CINQ ALTITUDES, AVANT / APRÈS

Protocole : mouvement ambiant coupé (le globe tourne seul à ~1,9 °/s après 3 s),
**20 images consécutives par relevé**, min/médiane/max exigés stables.
Comptage : les repères par l'`opacity` **lue en nombre** sur l'élément DOM ; les
cotes et les toponymes par la visibilité **effective** (produit des `visible` de
toute la chaîne de parents), jamais par `children.length`.

| altitude de cadrage | z | crop ? | Sommets av. → ap. | **Points cotés av. → ap.** | Toponymes av. → ap. |
|---|---|---|---|---|---|
| **1 507 447 m** (orbite haute) | 12 | non | 0 → 0 | **0 → 0** | 1 → 1 |
| **1 000 141 m** (~1 000 km) | 12 | non | 0 → 0 | **0 → 0** | 1 → 1 |
| **100 014 m** (~100 km) | 12 | non | 0 → 0 | **0 → 0** | 1 → 1 |
| **36 269 m** (seuil du crop) | 12 | non | 0 → 0 | **0 → 0** | 1 → 1 |
| **1 101 m** (sol) | 16 | oui | 5 → 5 | **0 → 14** | 0 → 0 |

*(min = médiane = max sur les 20 images, aux dix relevés : le système ne
tremble pas.)*

### ⚡ CE QUE CE TABLEAU DIT, ET CE N'EST PAS CE QUE LE BRIEF CRAIGNAIT

Le brief attendait le piège des routes : *« le nombre d'étiquettes croît avec
l'emprise, et l'emprise en orbite, c'est la Terre »*. **La mesure dit non, et
elle dit pourquoi : le crop n'existe pas en orbite.** `globe.baseYCrop == null`
aux quatre altitudes hautes, et les trois calques y sont bornés à zéro. La
croissance combinatoire n'a pas lieu parce que **ces trois calques sont
CROP-BORNÉS, pas MONDE-BORNÉS** : leur emprise est le bloc, jamais la planète,
à toutes les altitudes. Le nombre maximal d'étiquettes est **5 sommets + 14 cotes
+ N toponymes sur une emprise de 27 km** — pas une fonction de l'altitude.

⛔ **ET IL Y AVAIT QUAND MÊME UN DÉFAUT DERRIÈRE, QUE SEULE LA MESURE A VU.**
La première version corrigée montrait **14 cotes vivantes à 1 507 km, crop
absent** (`.banc/R24/apres-sansfixture.json`) : des étiquettes au-dessus d'un
bloc qui n'existe plus. Cause : `poserVisibiliteSocle` n'est appelée que sur
CHANGEMENT d'état de l'automate (« sans cette garde, quatorze calques seraient
repassés à chaque image ») et `poserCotesVisibles` seulement quand le curseur
bouge — une fois allumées devant le crop, les cotes n'étaient plus jamais
relues. Les SOMMETS n'avaient pas ce défaut parce qu'ils relisent
`reperesAffiches()` à chaque image. **Les cotes le relisent maintenant aussi**
(commit `1821c94`), et la colonne du tableau est passée de 14 à 0 aux quatre
altitudes hautes.

### Le coût réseau d'une descente complète

Descente 18 321 m → 1 101 m, z12 → z16, huit crans, sommets et cotes allumés :

| famille | requêtes | octets |
|---|---|---|
| **overpass** | **15** | 93 004 |
| mnt (tuiles de hauteur) | 576 | 42 480 542 |
| carto (cellules de toponymes) | 3 | 16 548 201 |
| cartouche (Wikipédia/Nominatim) | 9 | 2 151 |
| appli (modules ES, mode dev) | 306 | 32 845 628 |
| autre | 259 | 48 221 069 |
| **total** | **1 168** | **133,7 Mo** |

⚠️ **Compté au PROTOCOLE, pas dans la page** : le brief prévient que
`performance.getEntriesByType('resource')` plafonne à 250 entrées — sur 1 168
réponses, il aurait sous-compté de 79 % en silence.

⛔ **ET LE CHIFFRE OVERPASS EST LE MÊME AVANT ET APRÈS : 15 requêtes, 93 004
octets.** Mon cache n'économise RIEN sur une descente, et je l'écris plutôt que
de le taire : chaque cran regarde un rectangle NEUF, donc une clé neuve. Voir
§6, « ce que j'ai cru puis réfuté », pour où il économise vraiment.

Les toponymes : **3 requêtes / 16,5 Mo** pour toute la descente, contre
**15 requêtes / 93 Ko** pour les sommets. La carto pèse **178 fois plus lourd**
que la toponymie de sommets — et c'est le chargement de cellules, déjà borné par
emprise. **Le piège des routes n'est pas là où la tâche le cherchait.**

---

## 4. LES CONVERSIONS D'ALTITUDE, ÉCRITES ET CHIFFRÉES

Relevées au navigateur à La Réunion, z12, `exagération = 2` :

| | conversion | valeur mesurée | où elle vit |
|---|---|---|---|
| ① | **mètres → unités de BLOC** — `span / extentMeters × exagération` = 56 / 27 354,269 × 2 | **4,094 425 e−3** | `monde/sol-globe.js`, `blocDe` / `metresDe` |
| ② | **mètres → unités de GLOBE** — `R_GLOBE / EARTH_RADIUS_M × exagération` | **3,139 225 e−5** | `monde/sol-globe.js`, `echelleGlobe` |
| ③ | **unité de BLOC → unité de GLOBE**, leur rapport `k` | **7,667 071 e−3** | `poseur.rapportSimilitude()` |

**② est mot pour mot la forme que le brief donne comme celle qui marche** —
`R_GLOBE + altitudeAncreM × (R_GLOBE / EARTH_RADIUS_M) × exagération`, c'est-à-dire
`rayonAncre` de `monde/frontiere-rendu.js`, et c'est `poseur.placer` qui
l'applique.

⛔ **AUCUNE DES TROIS N'EST RECOPIÉE DANS `peaks.js` NI DANS `labels.js`.** Le
chantier compte sept défauts de conversion d'espace (facteurs 121,6 · 10 ·
130,4 · 6, une portée de flou de 1 465 km, des toponymes 1 830 m sous les Alpes) ;
une seconde écriture est la façon dont ils naissent. Les deux fichiers passent
par le poseur, et le disent en commentaire avec les chiffres ci-dessus.

**La seule longueur qui traverse à la main** est l'échelle du plan d'une cote :
`mesh.scale = k`. Un plan de 1,5 unité de BLOC laissé tel quel dans l'espace du
GLOBE serait **1 / k = 130,4 fois trop grand** — et 130,4 est nommément l'un des
sept facteurs déjà attrapés ici. `test/cotes-globe.test.js` ④ le tient par la
valeur, pas seulement par l'égalité.

### La preuve qu'un repère n'est pas sous le sol — mesurée, pas supposée

Deux chemins **indépendants** : `globe.hauteurDessinee(lat, lon)` (ce que le GPU
dessine) contre `poseur.metresDe(marqueur.world.y)` (où le repère est planté).

**À la vue de départ (z12, emprise 27 354 m, dégagement disponible 122,1 m)** —
`.banc/R24/ancrage-apres.json` §① :

| repère | repère (m) | sol dessiné (m) | **hauteur au-dessus du sol** | écart des deux sols |
|---|---|---|---|---|
| 1 | 1 007,9 | 885,5 | **+122,5 m** | +0,4 m |
| 2 | 1 061,3 | 937,3 | **+124,0 m** | +1,8 m |
| 3 | 801,4 | 679,3 | **+122,1 m** | −0,1 m |
| 4 | 123,3 | −0,5 | **+123,8 m** | +1,7 m |
| 5 | −1 096,7 | −1 221,2 | **+124,5 m** | +2,4 m |

**0 repère sur 5 sous le sol. Minimum +122,1 m.**

**Au sol (z16, emprise 1 710 m, dégagement 7,6 m)** — `.banc/R24/apres.json` :
hauteurs **+7,6 / 7,6 / 7,6 / 7,6 / 7,8 m**, **0 sous le sol**.

**Le dégagement de 0,5 unité de bloc vaut donc 122,1 m à z12 et 7,6 m à z16** :
il suit l'emprise, comme la taille apparente du bloc. C'est voulu, et c'est
pourquoi il reste en unités de bloc plutôt que d'être réécrit en mètres.

---

## 5. CE QUI A ÉTÉ CHANGÉ, ET POURQUOI

### `src/peaks.js` — trois lois pures, sorties de la classe

`update()` ne se charge pas sous node (elle touche le DOM), et ce dépôt a vu une
mutation survivre à 4 082 tests derrière une garde par expression régulière : les
lois sont donc exécutables.

1. **`ancrageSommet(solDessine, solPlat)` = `max` des deux + dégagement.** Le sol
   du bloc n'est pas le sol dessiné : grille 13 × 13 à z12, **médiane +1,9 m,
   étendue −72,0 / +98,7 m, et 42 points sur 169 (25 %) où le bloc est SOUS le
   dessin**. Prendre le maximum est la seule règle qui ne peut pas enterrer un
   repère, quel que soit lequel des deux échantillonneurs a raison localement.
   Ré-appliqué toutes les **30 images** : les hauteurs du globe arrivent du
   réseau, un repère construit avant elles resterait sur le repli pour toujours.
2. **`minZoomSommet(eleM)` + `opaciteSommet(eleM, zoom)` — D18, règle 2.** Le
   patron est `popToMinZoom` de `map/place-tier.js` (population → zoom minimal),
   transposé à l'altitude, qui EST l'importance cartographique d'un sommet.
   L'entrée est **continue** : opacité 0 un niveau avant le seuil, 1 au seuil,
   strictement entre les deux au milieu — jamais un test booléen.
   ⛔ `Number(null)` vaut **zéro**, pas `NaN` : sans un test explicite,
   « pas de zoom connu » serait devenu « zoom 0 », donc TOUT masqué, en silence.
   Le test ② bis l'a attrapé.
3. **Cache par emprise, échec compris.** D18 : *« Overpass en direct. Tolérance
   réelle : < 100 requêtes et < 10 Mo par JOUR. »* Voir §3 pour ce qu'il
   économise vraiment, et §6 pour ce qu'il n'économise pas.

### `src/labels.js` — les cotes sur la sphère, une pose par cote

* `poseCoteGlobe(poseur, x, z, y)` rend position + quaternion + échelle.
* ⛔ **Le repère local est pris AU POINT, pas au centre du bloc.**
  `poseur.repereLocal()` rend celui du centre : sur une emprise large, la
  verticale du coin n'est plus la sienne. `repereCote` dérive le repère de DEUX
  appels à `placer`, et le test ② le **confronte** à `repereGlobe` de
  `monde/frontiere-rendu.js` (deux écritures, une loi) au lieu de le recopier.
* ⛔ **Aucune similitude de GROUPE, contrairement au cartouche.** Le cartouche est
  posé sur une BASE, un plan horizontal unique ; une cote est posée sur le
  RELIEF. Le plan tangent dérive de **2,1 km à z8** et de **538 km à z4**
  (la table de courbure de `frontiere-rendu.js`) : une similitude de groupe
  enterrerait les cotes du bord.
* **La cote annonce le sol que le GLOBE dessine**, pas celui du bloc plat.
* **Toponymie fictive.** `PLACE_NAMES` ne sortait déjà que sur le terrain
  PROCÉDURAL (`!real`), et sous la sphère `params.source` vaut `'real'` : aucun
  nom de Monument Valley n'a jamais atteint la sphère. La garde
  `!real && !surGlobe` rend cette impossibilité **explicite** au lieu de la
  laisser dépendre d'une coïncidence de deux drapeaux ; le test ⑦ pousse le pire
  cas (terrain procédural ET poseur de globe) et exige **9 plans, pas 17**.

### `src/main.js` — le §6 de `visibilite-surface.js` une seconde fois

* `groupeCotes`, groupe d'ancrage adopté par `sceneGlobe` — exactement le geste
  du cartouche (D16-c) et du ciel (R20).
* `poserCotesVisibles` : **un seul corps** pour les deux panneaux, qui écrivaient
  la même ligne deux fois. `labels.visible` suit `vue.reperes`, plus `vue.socle`.
* **`labels.visible` réaffirmé par image** — voir §3, c'est le défaut que la
  mesure a trouvé après le correctif.
* ⚠️ **`f3AncreAuSol` / `f3SuitAuSol` refusent un groupe marqué `espaceGlobe`.**
  Elles ajoutent le décalage de fenêtre aux positions des enfants ; sur la sphère
  ceux-ci sont des points à ~100 unités de l'origine, et le test d'octogone
  (`|x| > demi`) les masquerait TOUS. C'est le défaut que `places-layer.js`
  documente pour son désencombrement, évité avant de le commettre.
* **La zone morte temporelle est réelle** : `poseurDesReperes` est hissée mais
  son corps lit des `let` déclarés 3 400 lignes plus bas, et les cotes se
  construisent AVANT le globe. `typeof` n'y échappe pas. Un drapeau
  (`poseurCotesPret`) porte l'ordre du fichier ; la toute première pose est
  plate, `regenerateLabels()` donne la vraie.

### Aucun curseur affiché en mode sphère s'il n'agit pas (attendu 5)

Les deux curseurs de la section **« Repères »** (`ui/map-panel.js:136-137`) sont
les seuls concernés, et **les deux agissent maintenant**, chiffres du §1 à
l'appui. Aucune note de curseur mort à poser, et aucune à retirer : R18 n'en
avait posé que sur Nuages, Vent, Appoint, Ombres et Courbes.

---

## 6. ⚡ CE QUE J'AI CRU, PUIS RÉFUTÉ

**① « L'option 21 est cassée, l'inventaire le dit. »**
Faux, et je l'ai lu de travers avant de le mesurer. Le tableau du brief cite
`inventaire-studio-2.md:272-273` — le relevé BRUT d'avant R18. La ligne 131 du
même fichier dit **« ✅ FAIT »**. R18 avait déjà donné aux sommets `camGlobe`,
le poseur et le prédicat `reperes`. La moitié de la tâche était faite ; ce qui
restait, ce n'était pas de la faire vivre, c'était **son ancrage et son coût**.

**② « L'explosion combinatoire du nombre d'étiquettes en orbite. »**
Réfuté par le tableau du §3 : **le crop n'existe pas en orbite**, `baseYCrop`
vaut `null` dès 36 269 m, et les trois calques y sont à zéro par construction.
Ces calques sont crop-bornés, pas monde-bornés : leur emprise est le bloc à
toutes les altitudes. Le garde-fou n° 2 du brief — « on ne charge que ce qui est
dans le champ » — était **déjà tenu** (`fetchTopPeaks` interroge `patchBounds`,
`pickPlaces` découpe sur `halfLimit`). J'ai quand même écrit le seuil de zoom par
importance, mais pour la bonne raison : **la lisibilité**, pas le volume.

**③ « Le cache d'emprise va faire fondre le coût réseau d'une descente. »**
**Faux, et mesuré : 15 requêtes Overpass avant, 15 après.** Chaque cran de zoom
regarde un rectangle NEUF, donc une clé neuve : il n'y a rien à réutiliser sur
une descente. Et l'aller-retour de zoom ne montre rien non plus — 1 → 2 → 2 → 3
requêtes, **identique dans les deux versions**, parce que la remontée ne
reconstruit pas le terrain. J'ai failli publier « le cache divise le trafic par
six » sur la seule arithmétique de « une requête par reconstruction ».
⚡ **Ce qu'il économise vraiment s'est trouvé en cherchant le geste, pas le
chemin de code** : **cinq bascules de l'interrupteur « Sommets » = 5 requêtes
avant, 0 après**, parce que `setEnabled` rappelle `refresh()`. C'est le seul
chiffre que je garde.

**④ « L'ancrage sur le sol du bloc enterrait des repères. »**
Réfuté aussi, et c'est le plus utile. Le désaccord entre les deux sols est réel —
jusqu'à **72 m** à z12, **12,1 m** à z14 — mais le dégagement disponible vaut
**122,1 m** à z12 et **30,5 m** à z14 : sur les 169 points de la grille à z14,
**0 dépasse le dégagement**. Aucun repère n'était enterré, ni avant ni après, et
les hauteurs relevées avant/après ne diffèrent que de **0,1 m** (122,0 → 122,1).
➡️ La correction ne répare pas un défaut visible : elle **supprime la classe**
(le maximum des deux sols ne PEUT pas enterrer), et elle rend la cote honnête —
une cote qui annonce l'altitude d'une autre surface que celle qu'elle touche est
exactement le mensonge que ce curseur est censé corriger. **Je ne revendique
aucun pixel gagné dessus.**

**⑤ « `cities.json` porte peut-être la toponymie mondiale qui manque. »**
Réfuté par ce qu'il y a dedans, pas en principe. Il la porte — coordonnées,
population, drapeau de capitale, domaine public — mais **avec un seuil de
200 000 habitants et sans champ `min_zoom`**, quand `places.json` sert déjà
**158 474 lignes à partir de 1 000 habitants, avec `min_zoom`, découpées en
cellules**. Ce n'était pas une donnée manquante, c'était **un vestige** : son
calque avait été retiré au commit `ec9f853` et le fichier était resté à partir
dans `dist/`. Retiré.

**⑥ « L'orbite est atteignable au geste, je vais descendre depuis là-haut. »**
Faux sur cette branche, et il a fallu trois manœuvres pour l'admettre :
`cranZoom(-1)` × 12, `stepWider()` × 6 et **une vraie molette × 16** laissent
toutes la vue à **z12 / 18 321 m**, sans bouger d'un mètre. Le dézoom est borné
ici — chantier d'un autre agent (`modes.js`, `zoom-continu.js`). Les cinq
altitudes sont donc obtenues en desserrant `controls.maxDistance`, **déclaré dans
l'en-tête de la sonde**, avec la loi qui les relie : `altM / distance` vaut
**244,3 · 244,2 · 244,2 · 244,2** sur quatre points.

**⑦ Deux instruments qui ont menti, et le brief n'en nommait qu'un.**
* **L'opacité lue en chaîne.** Ma première sonde comptait
  `el.style.opacity === '1'`. Depuis l'entrée en fondu, un repère à 0,5 aurait été
  compté **zéro** : le tableau aurait dit « rien à l'écran » pendant que la
  moitié de la classe apparaissait. Lue en nombre désormais.
* **L'interception de requêtes posée avant `goto`.** Elle a fait **EXPIRER le
  démarrage — 90 s dépassées, `__exp` jamais posé — DEUX FOIS**, avec
  `setRequestInterception` comme avec `Fetch.enable` et son motif d'URL, alors
  que le même chargement sans elle aboutit en ~25 s. J'ai d'abord cru à une
  régression de mon propre correctif ; un chargement témoin l'a innocenté. Le
  robinet ne s'ouvre qu'après la page vivante.

**⑧ Une assertion de la suite exigeait le défaut, exactement comme le brief le
prévoyait.** `test/visibilite-surface.test.js` portait
`assert.ok(/setLabelsVisible: \(v\) => \(labels\.visible = v && socleAffiche\(\)\)/.test(MAIN))`,
avec en commentaire *« Paquet (b), DÉCLARÉ ET NON FAIT ; ce test le grave pour
que personne ne croie que R18 l'a réparé »*. C'était une garde **utile** — elle
interdisait de rebrancher le prédicat sans faire le relogement — mais elle fait
échouer le bon correctif. Elle est **retournée** : elle exige maintenant les deux
ensemble (`sceneGlobe.add(groupeCotes)` **et** `poserCotesVisibles`), et jamais
l'un sans l'autre. Le compte de lecteurs de `vue.socle` passe de 8 à 7, avec la
quatrième redistribution voulue écrite à côté des trois précédentes.

**⑨ Overpass est injoignable depuis cette machine, et ce n'est pas le code.**
`overpass-api.de` : `Connect Timeout` sur ses **quatre** adresses, au node comme
au Chrome, avec et sans bac à sable. `kumi.systems` et `private.coffee` : **502**.
`overpass.osm.jp` : échec. `maps.mail.ru` : expiration. Sans sommets, la moitié
de la mesure n'existait pas. La sonde sert donc une réponse fabriquée sur place
dont les nœuds sont posés sur une grille de l'emprise demandée et **SANS balise
`ele`** : ce qui est simulé, c'est la LISTE ; l'altitude et le sol restent ceux
du dépôt, par le chemin de repli que `peaks.js` emprunte déjà pour les nœuds OSM
non cotés. ⛔ Aucun nom fabriqué ne sort du banc.

---

## 7. VÉRIFICATIONS

| | |
|---|---|
| `npm test` | **4 461 tests · 4 461 pass · 0 fail** (base à battre : 4 442 · 0 échec — **+19**) |
| `npm run audit:tests` | **232 listés · 232 sur disque · aucun écart** |
| fins de ligne | LF sur les six fichiers touchés — édités en binaire (`newline=''`), le `.gitattributes` est respecté |
| build | `npx vite build` passe ; `dist/data/cities.json` absent, `dist/index.html` présent |
| serveur | port **5931** (> 5900), **arrêté** |

### Les tests ajoutés

* `test/cotes-globe.test.js` — **9 tests.** Repère orthonormé ; **confronté à
  `repereGlobe` de `frontiere-rendu.js`** ; suit le point et non le centre ;
  l'échelle EST `k` et `1/k > 100` ; la pose monte dans le bon sens et d'exactement
  une unité de bloc convertie ; le dégagement ne se convertit pas deux fois ;
  **aucun nom de Monument Valley sur la sphère même en mode procédural** ; hors
  sphère le décor est intact et le poseur plat est l'identité ; **la cote annonce
  le sol du GLOBE et non celui du bloc plat**.
* `test/sommets-seuil.test.js` — **10 tests.** Seuil monotone ; sans altitude pas
  d'importance ; **entrée continue et monotone, valeur strictement entre 0 et 1 à
  mi-chemin** ; `null` n'est pas zoom 0 ; l'ancre est au-dessus des DEUX sols
  toujours ; `null` n'est pas zéro ; **mutation** — sans le maximum, le naïf perd
  59 % du dégagement disponible sur le pire point relevé ; la clé de cache
  arrondit à ~11 m et pas plus ; deux reconstructions de la même emprise = **une**
  requête ; **l'échec est mémorisé** (3 tentatives, 1 requête).

---

## 8. LES COMMITS

| | |
|---|---|
| `aeab88d` | R24 étape 1 — les sommets s'ancrent sur le sol DESSINÉ, entrent en fondu, et ne rejouent plus Overpass |
| `ba1de7a` | R24 étape 2 — les points cotés vivent sur la sphère, et la toponymie fictive ne peut plus y arriver |
| `1821c94` | R24 étape 3 — les cotes relisent leur prédicat par IMAGE, et les deux sondes |
| `9faf3bc` | R24 — `cities.json` est retiré : 73 448 octets de données mortes qui partaient dans `dist` |

---

## 9. CE QUE JE LAISSE, ET QUI N'EST PAS À MOI

* ⛔ **Le dézoom est borné à z12 / 18 321 m** depuis l'ouverture par défaut.
  Trois gestes différents le confirment. C'est `modes.js` / `zoom-continu.js`,
  périmètre d'un autre agent — je le signale, je n'y touche pas.
* ⚠️ **Le seuil d'importance des sommets n'a pas pu être vu à l'écran**, parce
  qu'aucun zoom plus large que z12 n'est atteignable au geste ici. Sa loi est
  tenue par le test, sa valeur ne l'est pas encore par une image.
* ⚠️ **La toponymie a rendu 1 seul nom de ville à La Réunion à z12, 0 à z14+.**
  Ce n'est pas un défaut de calque : l'île porte peu de villes au-dessus du seuil,
  et à z14 l'emprise de 6,8 km n'en contient aucune. Une campagne de mesure de la
  carto sur un massif dense (Paris, la Ruhr) dirait autre chose — elle n'était
  pas dans cette tâche.
