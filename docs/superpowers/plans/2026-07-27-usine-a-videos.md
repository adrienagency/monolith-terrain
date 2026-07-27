# Usine à vidéos ShibuMap — rapport de mesure et plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Une commande qui choisit un lieu, l'habille, le filme et rend un clip 10 s publiable, sans intervention.

**Architecture:** Quatre modules PURS et testables en Node (score topographique, générateur de look, grammaire de plans, budget de cadrage), plus un pilote puppeteer/CDP qui les enchaîne au-dessus du pipeline `exportVideo` déjà éprouvé par la skill `shibumap-shots`. Rien de nouveau côté moteur : l'usine ORCHESTRE ce qui existe.

**Tech Stack:** JS vanilla, Three.js r172, `postprocessing` 6.36, Vite, `node --test`, puppeteer-core + CDP, ffmpeg 8.1.2.

## Global Constraints

- **La carte doit rester calme.** C'est l'identité du produit. Toute piste qui accélère, clignote, saccade ou « en met plein la vue » est un échec commercial, pas seulement esthétique. Les vitesses de caméra restent dans l'enveloppe mesurée au §3 ; aucune n'en sort « pour l'effet ».
- **Jamais de texte incrusté, jamais d'audio dans le clip moteur** (règle `shibumap-shots`) — Screenforge pose la musique.
- **Livraison : plans UNIQUES de 10,0 s, 1080×1920, 30 fps**, dans `marketing/shots-v2/`.
- **Lieux : les 132 entrées de `src/landmarks.js`** restent la réserve de référence. Le score du §1 les CLASSE, il ne les remplace pas.
- **L'attribution des exports (`EXPORT_CREDIT`) n'est jamais retirée** — c'est la contrepartie des licences ODbL / Licence Ouverte / GEBCO.
- Tests : `node --test test/<fichier>.test.js`. Tout nouveau test s'ajoute au script `test` de `package.json`.
- **Aucun nouveau paquet npm** sans nécessité démontrée. Les trois modules du plan n'en demandent aucun.

---

# RAPPORT

## Ce que j'ai mesuré, et ce que je suppose

Je sépare les deux partout. Trois campagnes de mesure réelles ont été menées pour ce rapport :

| # | Mesure | Méthode | Statut |
|---|---|---|---|
| A | Score topographique sur 34 lieux | MNT terrarium AWS **réels**, bloc 3×3, 768², script Node conservé dans le scratchpad (`topo-score3.mjs`) | **mesuré** |
| B | Balayage de zoom sur 5 lieux (20 blocs) | idem | **mesuré** |
| C | Budget de cadrage / seuil de gros plan | arithmétique **sur les constantes réelles du dépôt** (`TERRAIN_SIZE=56`, `resolution=768`, `maxDistance=150`, `fov=33`, tuiles Mapterhorn 512 px) | **dérivé, pas observé à l'écran** |
| D | Effets disponibles dans `postprocessing` | inventaire des exports de `node_modules/postprocessing/build/index.js` | **mesuré** |
| E | Filtres temporels de ffmpeg | `ffmpeg -filters` sur la machine | **mesuré** |

**Ce que je n'ai PAS mesuré, et qui compte :**
- **Rien n'a été rendu dans un navigateur pendant cette campagne.** Le seuil de gros plan du §3 est un budget d'échantillonnage, pas un verdict de l'œil. La tâche 2 du plan existe pour le confronter à l'écran.
- Le temps de rendu d'une image (`composer.render()`) en 1080×1920 avec DoF+bloom+SSAO. Toute la comptabilité du flou de mouvement est donc en **coût relatif** (×N), jamais en secondes.
- Le score A utilise les tuiles AWS (768², ~26 m/px à z12 sous nos latitudes) et non Mapterhorn (1536², ~13 m/px). Pour **classer une forme**, c'est sans effet ; pour juger un détail, ça le serait.

---

## 1. Trouver les plus beaux endroits POUR LA TOPOGRAPHIE

### 1.1 Le piège, nommé

Un lieu beau en photographie ne l'est pas forcément en relief nu, et la raison est structurelle : **la photographie se prend depuis le sol, ShibuMap regarde depuis le ciel.** Bonifacio est splendide parce qu'on voit une falaise de 70 m *par le travers*, depuis la mer. Vue de dessus, sur un bloc de 11 km, cette falaise fait 0,6 % de la largeur du cadre. Les Maldives sont un paradis dont l'amplitude altimétrique mesurée est de **6 mètres**.

Le score doit donc mesurer ce que **la silhouette d'un bloc posé sur une table** raconte — pas la réputation du lieu.

### 1.2 Le score, et ses deux branches

Calculé sur le MNT que l'app charge déjà (`dem.data`, bloc 3×3, même emprise que `blockExtentMeters()`), sans aucune donnée externe.

**Branche RELIEF** — ce que la silhouette dit à elle seule :

```
R = 0,40·sat(amplitude, 1100 m) + 0,25·sat(pente_moy, 13°) + 0,35·sat(pente_p95, 32°)
```

**Branche LITTORAL** — terre et mer dans le même cadre, la signature du produit :

```
L = 0,30·sat(densité_côte, 2,0) + 0,40·sat(relief_côtier, 450 m)
  + 0,15·fraction_falaise + 0,15·sat(nb_îles, 2,0)
```

avec `sat(x,k) = x/(x+k)` — la saturation douce déjà employée dans `terrain-analysis.js`, qui ne plafonne jamais vraiment et garde donc un ordre entre les extrêmes.

**Combinaison — et c'est le point qui a demandé deux réécritures :**

```
score = 100 · max(R,L) · (1 + 0,30·min(R,L)),  borné à 100
```

Les deux branches sont des **alternatives**, pas des termes d'une somme. Ma v1 les additionnait : un bloc 100 % terrestre plafonnait mécaniquement à 42/100 et **le Mont Blanc sortait 14e, derrière Capri et Ha Long**. Ma v2 normalisait par `(1 + bonus)`, ce qui punissait de 31 % tout massif intérieur — or le Mont Blanc n'est pas 31 % moins beau qu'un fjord. La forme retenue laisse la branche forte donner la note, la seconde n'ajoute qu'un bonus plafonné à +30 %.

**Définitions précises des termes**, telles qu'implémentées :
- masque de terre : `h > 5 m`, suivi d'une **ouverture morphologique 3×3**. Sans elle, la Camargue et le Flevoland affichent des densités de trait de côte de 64 et 88 — du bruit de pixels à 0 m dans des marais et des polders, pas un littoral découpé.
- `amplitude` = p99 − p01 des altitudes sur la terre.
- `pente` = arctan‖∇h‖ en degrés, gradient centré, pas de grille en mètres réels.
- `densité_côte` = longueur du trait de côte ÷ largeur du bloc (adimensionnel : un littoral rectiligne traversant le cadre vaut ≈ 1 ; Lofoten 5,1 ; Ha Long 32).
- `fraction_falaise` = part des cellules de rivage dont l'altitude maximale **400 m à l'intérieur des terres** dépasse 80 m.
- `relief_côtier` = altitude maximale moyenne dans le kilomètre bordant la côte.

### 1.3 Deux bugs trouvés en validant — la raison d'être de la validation

**Bug 1 — la falaise mesurée au mauvais endroit.** Ma v1 testait la pente *du pixel de rivage lui-même*. Or ce pixel est plat par construction : c'est le niveau de la mer. Résultat mesuré : **les Lofoten obtenaient 0,0 % de falaises.** Absurde. Le correctif regarde l'altitude atteinte 400 m en arrière.

**Bug 2 — le cadre pris pour un rivage.** L'ouverture morphologique laissait l'anneau extérieur du bloc à zéro. Tout bloc 100 % terrestre se retrouvait donc cerné d'un faux littoral de 4×768 pixels — densité de côte de **3,98 pile** (= périmètre ÷ largeur) et 100 % de falaises. **La Beauce décrochait ainsi 49,9 de score littoral et l'erg Chebbi montait au 19e rang.** Correctif : bord répliqué, anneau extérieur exclu.

Sans le jeu d'essai de contrôle, ces deux bugs seraient partis en production comme « le score ».

### 1.4 Le classement mesuré (34 lieux, MNT réels)

```
rang  SCORE  relief littor | lieu                       z  empr.km terre% ampl.m pente° p95°   côte fal.% relCôte îles
  1    76,6   66,0   53,8 | Milford Sound             11   41,8   90,2   1945   32,4  58,4   2,20  92,2    692   0
  2    74,0   62,8   59,6 | Geirangerfjord            12   13,7   88,3   1585   28,3  54,3   2,43  99,8   1069   0
  3    71,0   71,0    0,0 | Everest / Khumbu          11   51,8  100,0   4419   27,7  53,7   0,00   0,0      0   0
  4    70,4   47,5   61,6 | Îles Féroé (Vagar)        11   27,5   63,0    631   15,4  39,9   6,73  77,6    420   2
  5    70,3   61,4   48,8 | Madère (nord)             12   24,7   57,9   1574   26,2  48,6   1,11  97,7    633   0
  6    70,1   40,8   62,5 | Ha Long                   12   27,4   32,1    206   19,4  40,4  32,32  58,3    198  15
  7    68,8   68,8    0,0 | Mont Blanc / Chamonix     12   20,4  100,0   3193   29,8  51,7   0,00   0,0      0   0
  8    68,4   60,4   44,2 | Na Pali (Kauaʻi)          12   27,2   60,8   1362   24,7  53,2   3,66  50,8    337   0
  9    68,0   54,3   58,4 | Stromboli                 14    5,7   36,9    851   27,7  41,8   2,28  95,4    617   1
 10    65,2   55,4   55,9 | Lofoten (Reine)           11   22,1   26,3    737   29,0  54,4   5,09  84,0    535   0
 11    64,9   64,9    0,0 | Cervin / Zermatt          12   20,4  100,0   2324   25,5  49,0   0,00   0,0      0   0
 12    64,8   56,5   49,0 | Amalfi                    13   11,1   48,0   1083   25,5  42,9   1,24 100,0    578   0
 13    62,7   54,0   53,3 | Lysefjord (Preikestolen)  12   15,1   88,6    895   20,1  47,4   2,19 100,0    586   0
 14    62,2   62,2    0,0 | Tre Cime (Dolomites)      13   10,1  100,0   1448   30,5  53,5   0,00   0,0      0   0
 15    61,7   61,7    0,0 | Grand Canyon              11   47,4  100,0   1860   18,7  53,1   0,00   0,0      0   0
 16    61,4   53,4   50,0 | Capri                     14    5,6   19,1    531   25,8  67,3   2,25 100,0    414   0
 17    56,2   49,2   47,7 | Cinque Terre              13   10,5   60,4    707   20,5  34,8   1,40 100,0    465   0
 18    55,2   40,3   49,3 | Santorin                  13   11,8   43,5    393   10,2  36,9   3,93  63,4    201   2
 19    53,8   34,9   48,7 | Bora Bora                 13   14,1   34,4    347    7,2  28,2  14,09  29,1    113   4
 20    52,7   46,1   46,3 | Rio de Janeiro            12   27,0   47,2    699   12,8  34,3  13,24  21,1    141   2
 21    50,8   45,9   35,7 | Le Cap (Table Mountain)   12   24,3   61,2    878    8,9  33,6   8,92  13,6    134   0
 22    41,3   41,3    0,0 | Luberon                   12   21,2  100,0    833    8,1  22,5   0,00   0,0      0   0
 23    30,0   26,2   27,8 | Bonifacio                 13   11,0   55,2    217    6,3  15,5   3,39  12,0     98   0
 24    29,2   29,2    0,0 | Ardennes (Bouillon)       12   18,9  100,0    246    7,1  19,1   0,00   0,0      0   0
 25    18,2   12,8   17,6 | Landes (Mimizan)          12   21,0   93,7     62    2,6   7,4   2,01   0,0     31   0
 26    16,7   16,7    0,0 | Erg Chebbi (Sahara)       12   25,1  100,0    105    3,4   9,6   0,00   0,0      0   0
 27    12,3   12,3    0,0 | Val de Loire (Amboise)    12   19,9  100,0     87    2,1   6,4   0,00   0,0      0   0
 28     4,8   10,7   26,6 | Bahamas (Exuma)           11   53,5    1,1     23    2,6   6,2   2,68   0,0     23   2
 29     4,5    7,5   26,1 | Venise (lagune)           12   20,6    1,0      7    1,8   4,4   2,86   0,0     11   2
 30     4,5    4,5    0,0 | Beauce (Chartres)         12   19,5  100,0     28    0,9   1,9   0,00   0,0      0   0
 31     0,7    8,4   15,1 | Maldives (Malé)           12   29,3    0,3      6    2,2   4,8   0,82   0,0     16   1
 32     0,2    7,1    6,2 | Camargue                  12   21,3    0,1      6    2,0   3,5   0,44   0,0     10   0
 33     0,1    7,6    2,8 | Flevoland (Pays-Bas)      12   17,9    0,0      5    1,5   5,1   0,16   0,0      7   0
 34     0,0   10,7    2,3 | Florida Keys              11   53,3    0,0      9    3,9   4,9   0,02   0,0     24   0
```

**Le test explicite d'Adrien passe largement : Bonifacio 30,0 contre la Beauce 4,5.** Et il passe pour la bonne raison, pas par chance — la Beauce n'a ni relief (28 m d'amplitude, pente p95 à 1,9°) ni littoral.

Les contrôles « beaux en photo, plats en relief » occupent tous le fond du tableau : Florida Keys, Flevoland, Camargue, Maldives, Venise, Bahamas. Le top 10 est une liste qu'on signerait à la main.

**Ce que le score dit de Bonifacio, et qu'il faut entendre.** 30/100, jamais mieux que 33 à aucun zoom (§1.5). Ce n'est pas un défaut du score : Bonifacio est un sujet **médiocre pour ShibuMap** parce que ce qui en fait la beauté — une paroi verticale vue de la mer — est exactement la vue que le produit n'offre pas. Il vaut mieux le savoir avant de tourner.

### 1.5 Le score choisit aussi le CADRAGE (mesuré)

Le même score, appliqué au même lieu à quatre zooms, présente un optimum net là où on l'attend :

| lieu | z10 | z11 | z12 | z13 | z14 | z15 | optimum |
|---|---|---|---|---|---|---|---|
| Santorin | — | 31,9 | 53,5 | **55,2** | 44,5 | — | z13 (11,8 km : toute la caldeira) |
| Lofoten | 66,2 | 65,2 | **72,8** | 71,6 | — | — | z12 (11 km) |
| Mont Blanc | 65,3 | 66,9 | 68,8 | **69,3** | — | — | z13, pente très douce |
| Cervin | — | **66,4** | 64,9 | 63,1 | 64,0 | — | z11 (le Valais entier) |
| Bonifacio | — | — | **33,2** | 30,0 | 30,6 | 27,9 | plat : aucun zoom ne le sauve |

Le score est donc **un optimiseur de cadrage gratuit** : on le calcule sur trois ou quatre zooms candidats et on garde le meilleur. Pour les îles et les caldeiras, l'optimum est franc ; pour un grand massif, la courbe est plate — ce qui est aussi une information utile (le cadrage y est libre).

### 1.6 Les jeux de données extérieurs

⚠️ **Je n'ai vérifié aucune source externe moi-même dans cette campagne.** Les jeux de données listés en annexe A sont des pistes à instruire, pas des faits établis, et l'annexe le dit. **Ne pas les citer comme sourcés** tant que leur licence et leur URL n'ont pas été ouvertes. Je préfère une annexe honnêtement marquée « non vérifié » à une bibliographie de mémoire — deux rapports ont été pris en défaut exactement là-dessus.

Ma position, qui ne dépend d'aucune de ces sources : **ne rien brancher d'extérieur pour la v1.** Le score du §1.2 se calcule sur le MNT que l'app télécharge de toute façon, ne coûte aucune licence, aucune dépendance et aucun octet de plus, et il est validé sur 34 lieux. Les jeux externes (proéminence, indices de rugosité publiés, littoraux classés) ne servent qu'à *découvrir des candidats hors des 132 landmarks* — un problème de deuxième temps, que la tâche 9 place en conséquence.

Un point mérite cependant d'être dit maintenant, parce qu'il vaut aussi pour les sources non vérifiées : **un jeu de « beauté perçue » (type Scenic-Or-Not) note des photographies prises au sol.** C'est exactement le biais que le §1.1 identifie. Un tel jeu ne peut donc pas servir de vérité terrain pour ShibuMap — au mieux de contre-épreuve, pour vérifier que le score s'en écarte là où l'on attend qu'il s'en écarte (Bonifacio, les Maldives).

---

## 2. La génération automatique de templates

### 2.1 Ce qui existe déjà et qu'il ne faut pas réécrire

`shuffleLook()` (`src/main.js:2608`) **est déjà un générateur de template automatique**, et un bon : base cohérente tirée des looks intégrés, palette tirée d'une réserve de plusieurs centaines (`shuffle-pool.js`) filtrée par `isElegantPalette()`, heure aléatoire, shader de surface discret (modes de fusion restreints à Soft light / Overlay / Multiply / Screen / Colour / Luminosity), mer resemée, nuages redessinés dans les plages actuelles, fond par théorie des couleurs (`elegantColorScheme()`), et ombrage réaccordé au MNT chargé (`applyAutoShade`).

Il porte déjà la règle qui compte : **« jamais de random moche »**, matérialisée par des filtres d'entrée (rampe qui bouge d'au moins 0,1 en luminance, mer qui s'assombrit toujours avec la profondeur) plutôt que par des vœux.

**Trois faiblesses, précisément :**

1. **Il ignore le lieu.** L'heure est tirée dans 5,5–19,5 h, uniformément. Or `daycycle.js` calcule la **position solaire réelle** pour la latitude et la longitude du bloc (portage SunCalc / Meeus). L'heure dorée d'un lieu est donc *calculable*, pas à tirer au sort. De même, la palette est tirée sans regard pour le biome, alors que `generateEarthPalette()` sait produire 8 biomes nommés (`EARTH_BIOMES`) et que le MNT dit tout ce qu'il faut pour choisir (amplitude, latitude, fraction de mer, altitude de la limite des arbres).
2. **Il n'est pas reproductible.** `Math.random()` en dur, partout. On ne peut ni rejouer un tirage réussi, ni faire un A/B, ni tester.
3. **Il ne survit pas à l'ajout d'un réglage.** C'est une suite d'affectations écrites à la main. `TEMPLATE_KEYS` compte aujourd'hui **184 clés** (compté) ; `shuffleLook` en touche une soixantaine. Une nouvelle option n'est pas générée tant que personne n'a pensé à éditer la fonction — et rien ne le signale.

### 2.2 Ce qui rend un template BEAU plutôt que valide

Ce n'est pas la valeur de chaque curseur, ce sont **quatre accords** :

| accord | règle | d'où elle sort |
|---|---|---|
| **palette ↔ biome** | une rampe alpine sur une île tropicale ment ; une rampe lagon sur un massif de granit aussi | `EARTH_BIOMES` existe déjà et nomme les 8 biomes |
| **heure ↔ latitude et saison** | 18 h à Chamonix et 18 h aux Lofoten en juillet ne sont pas la même lumière ; `lightingFor(hour, lat, lon)` le sait déjà | `daycycle.js` |
| **ombrage ↔ relief chargé** | `gradeForDem()` cadre le contraste sur les quantiles du MNT courant, pas sur des constantes d'un autre lieu | `relief-grade.js`, déjà appelé par le shuffle |
| **profondeur de champ ↔ distance caméra** | le bokeh doit se voir (directive Adrien : bokehScale 4–6, focusRange 8–15) mais `focusDistance` doit tomber SUR le sujet, ce qui dépend de la pose | `shibumap-shots` |

Et **deux combinaisons qui ne marchent jamais**, observables dans le code existant :
- shader de surface en mode de fusion « Normal » ou dur (burn / dodge / difference) — le shuffle les exclut déjà nommément, c'est un savoir acquis à conserver ;
- fond sombre sans bascule du mode sombre — `autoDarkFromBg()` existe précisément pour ça (cartouche noir sur noir).

### 2.3 Méthode retenue : registre déclaratif + juge, dans cet ordre

**Règles d'abord, juge ensuite. Pas d'exploration guidée.** Justification : l'espace fait ~190 dimensions, la fonction objectif est un jugement humain, et le budget d'évaluation est d'un rendu par point. Une recherche évolutionnaire y est structurellement hors de portée. Les règles couvrent 90 % du chemin pour 5 % du coût ; le juge sert à *écarter les ratés*, pas à *optimiser*.

**Le registre.** Chaque réglage générable devient une ligne de données — exactement le patron de `FX_META`, qui est déjà la source unique que l'UI lit et que le moteur applique :

```js
// src/look-registry.js
export const KNOBS = {
  bokehScale:  { type: 'range', min: 4, max: 6, safe: [4, 6], group: 'dof' },
  sunAzimuth:  { type: 'derived', from: 'solar' },     // calculé, pas tiré
  rampStops:   { type: 'palette', from: 'biome' },
  cloudCoverage: { type: 'range', min: 0.85, max: 2.2, safe: [0.9, 1.6], group: 'sky' },
  fov:         { type: 'fixed', value: 33 },
  // …
}
```

**Le mécanisme qui le fait survivre aux options futures**, et c'est le cœur de la réponse : un test de conformité qui compare `Object.keys(KNOBS)` à `TEMPLATE_KEYS` et **échoue en nommant les clés orphelines**.

```js
test('toute clé de template est classée dans le registre', () => {
  const orphelines = TEMPLATE_KEYS.filter((k) => !(k in KNOBS))
  assert.deepEqual(orphelines, [], `clés non classées : ${orphelines.join(', ')}`)
})
```

Ajouter un réglage à ShibuMap fait donc **rougir la suite de tests** jusqu'à ce que quelqu'un ait écrit une ligne disant comment le générer — ou, tout aussi valable, `{ type: 'fixed' }` pour dire « ne pas y toucher ». C'est la seule forme de survie qui tienne : pas une promesse, un test qui casse.

**Le juge**, ensuite, est un contrôle de recevabilité sur l'image rendue, pas un critique d'art. Quatre sondes calculables sur une vignette 256×256 issue de `exportImage` :
- contraste global dans une fourchette (une carte délavée ou cramée est rejetée) ;
- fraction de pixels saturés en haut et en bas de l'histogramme < 2 % ;
- écart de teinte entre le fond et la terre supérieur à un seuil (sinon le bloc se fond dans le décor) ;
- lisibilité du trait de contour : variance locale non nulle là où le masque de terre est présent.

Chacune est un test unitaire sur une image fixture. Aucune n'est un jugement de goût — et c'est voulu : le goût, c'est le registre qui le porte, en amont.

---

## 3. La grammaire cinématographique d'un objet posé

### 3.1 Le cadre mental juste

ShibuMap ne filme pas un paysage, il filme **une maquette sur une table**. La conséquence est nette et tranche la moitié des questions : la caméra ne peut pas *habiter* la scène. Un plan qui prétend qu'on est dans le paysage (POV, caméra à l'épaule, ras du sol regardant l'horizon) ment, parce qu'à trois mètres du bord la table s'arrête.

Ce qui marche est donc le vocabulaire de la **table de maquette et du plateau tournant** :

| mouvement | verdict | pourquoi |
|---|---|---|
| orbite lente | **oui, le plan de base** | c'est le geste de quelqu'un qui tourne autour d'un objet posé. `CameraAutomation.orbit` existe. |
| plongée qui se redresse (`reveal`) | **oui** | de la carte-vue-de-dessus à l'objet-en-relief : ça raconte exactement l'argument du produit |
| travelling latéral (`pan`) | **oui, court** | lisible tant que le socle reste dans le cadre |
| grue montante (`crane`) | **oui, en ouverture ou en sortie** | quitter l'objet par le haut est une fin naturelle |
| ras de l'eau | **oui, mais seulement là où il y a de la mer ET du relief côtier** | condition mesurable : `relief_côtier > 300 m` dans le score du §1. Sans relief, on filme une surface plate au raz d'une surface plate. |
| push in / pull out (`pushpull`) | **avec réserve** | respirer, oui ; foncer, non — voir l'enveloppe de vitesse §3.3 |
| survol Lissajous (`flyover`) | **non** | il prétend qu'on vole DANS le paysage. Sur une maquette, ça se lit comme une caméra ivre. |
| gros plan macro | **non** — voir §3.2, avec le chiffre | |
| révélation par le socle (la caméra passe sous le plateau) | **non** | le socle n'a pas d'en-dessous rendu ; c'est du vide |

**Enchaîner plusieurs plans en 10 s.** Trois plans de 3,3 s hachent. La forme qui tient, et c'est une règle de montage classique confirmée par la contrainte du produit : **deux plans, 4 s + 6 s, avec une coupe franche sur un mouvement continu** — la caméra bouge dans le même sens de part et d'autre de la coupe, ce qui la rend presque invisible. Ou, mieux encore pour « rester calme » : **un seul mouvement de 10 s** dont l'échelle change (une orbite qui s'élève et s'éloigne fait à elle seule un plan large *et* un plan moyen).

L'assemblage se fait à **ffmpeg**, pas dans Screenforge : la skill `screenforge` établit (vérifié le 2026-07-10) que l'app crée un NOUVEAU projet à chaque import et ne sait donc pas enchaîner N clips. Screenforge polit UN master — musique, ratio, export.

### 3.2 Le gros plan : le seuil chiffré

**Toutes les valeurs ci-dessous sont dérivées des constantes réelles du dépôt, pas observées à l'écran.**

Constantes vérifiées : `TERRAIN_SIZE = 56` unités-monde (`terrain.js:48`), `params.resolution = 768` (`main.js:151`), `controls.maxDistance = 150` (`main.js:862`), `fov = 33°` dans le look d'ouverture (`public/templates/defaults/shibustart.json`), export à `pixelRatio 1` (`export.js`, `applySize`), sortie 1080×1920.

Le convertisseur, en format de livraison (1920 px de haut) :

```
px par unité-monde = 1920 / (2·D·tan(16,5°)) = 3241,3 / D
une maille du maillage 768 = 56/768 = 0,072917 u  →  236,4 / D  pixels
un pixel du MNT central (1536²)                   →  118,2 / D  pixels
un pixel du masque côtier (2048²)                 →   88,6 / D  pixels
```

**Premier résultat, et il tranche la question « qu'est-ce qui craque en premier » : la maille du maillage fait exactement DEUX fois le pixel du MNT, et 2,7 fois le pixel du masque côtier. Le maillage est le plus grossier des trois échantillonneurs, toujours et partout. C'est lui qui craque en premier.** Le MNT et les textures ont une longueur d'avance qu'ils ne perdent jamais, puisque les trois grandeurs sont dans un rapport fixe.

Le budget, en cadrage :

| distance caméra D | hauteur visible | part du bloc | maille en px | verdict |
|---|---|---|---|---|
| 145,5 u (vue d'ouverture) | 86,2 u | 154 % | 1,62 | très large marge |
| 94,5 u | 56,0 u | 100 % (le bloc remplit le cadre) | 2,50 | confortable |
| 59 u | 35,0 u | 62 % | 4,01 | **au budget des moteurs de référence (4–5 px)** |
| 47 u | 27,8 u | 50 % | 5,03 | **limite** |
| 30 u | 17,8 u | 32 % | 7,88 | facettes probables |
| 23,6 u | 14,0 u | 25 % | 10,0 | hors budget |

**Le seuil : ne pas descendre sous ~28 unités-monde de hauteur visible, soit 50 % de la largeur du bloc, soit D ≈ 47 u.** À z12 sous nos latitudes (bloc de 20,4 km), cela veut dire **garder au moins 10 km de terrain dans le cadre**. Autrement dit : ce que le cinéma appellerait un plan moyen serré reste, en langage carte, un plan très large. Le « gros plan » demandé existe — il est simplement à 50 % du bloc, pas à 5 %.

Note de format : en 16:9 (1080 px de haut) la maille vaut `132,9/D`, et le budget de 5 px est atteint à D = 26,6 u seulement. **C'est le format vertical 9:16, celui de la livraison, qui est le plus contraignant** — il a 1,78 fois plus de pixels sur la dimension du champ de vision.

**Le second plafond, celui qui dépend du lieu.** Le MNT n'est fin que là où Mapterhorn couvre. `dem-source.js` documente : z12 garanti sur toute terre émergée, z13 à z17 selon les pays, et `probeMaxZoom()` **sait déjà mesurer la couverture réelle d'une zone**. Comme la maille vaut deux pixels de MNT :

> **Règle : le surzoom ne doit pas dépasser un cran.** À `demZoom = zMax + 1`, le MNT nourrit exactement le maillage. À `demZoom ≥ zMax + 2`, on agrandit de l'interpolation — le relief devient lisse et faux, quelle que soit la distance caméra.

Une zone couverte jusqu'à z12 seulement ne supporte donc aucun plan rapproché. Une zone suisse (swissALTI3D, z17) en supporte beaucoup. **La question n'est pas « gros plans oui ou non », c'est « gros plans là où la donnée les paie ».** Et c'est vérifiable par une requête HEAD que le code sait déjà faire.

**Le grain de détail ne sauve pas le gros plan, et ne le casse pas non plus.** `detail-noise.js` documente la mesure : au réglage par défaut (`detail = 0,02`), le bruit FBM déplace la surface de **0,19 px CSS à la vue d'ouverture**. Converti au cadrage limite (D = 47 u, 1920 px), cela fait **≈ 1,0 px**. Il a été réglé pour être invisible de loin, il reste donc invisible de près. Il n'ajoute pas de crédibilité au rapproché — mais il ne moutonne pas non plus.

**Verdict sur la contradiction n°1.** La directive « jamais de gros plans serrés » n'était pas un caprice : à 25 % du bloc, une maille dépasse 10 px et le maillage devient visible. Elle était en revanche formulée comme un tabou alors que c'est un **budget**. Ce qu'on peut proposer à Adrien : remplacer l'interdit par deux conditions vérifiables — *hauteur visible ≥ 28 u* et *surzoom ≤ 1 cran* — ce qui ouvre le plan moyen serré (50–60 % du bloc) qu'il demande, sans jamais aller là où ça craque. **Décision à lui, pas au code** ; la tâche 2 du plan fournit les images qui la rendront évidente.

### 3.3 Le flou de mouvement : les trois chemins, chiffrés

**D'abord, est-ce que ça vaut le coup ?** Vitesse d'un point du bord du bloc (r = 28 u) sous une orbite ω, à la distance D, en 1920 px :

```
v_écran = r·ω·3241,3/D   px/s        flou à 180° d'obturateur = v/60  px
```

| situation | ω | D | v_écran | flou à 180° |
|---|---|---|---|---|
| vue d'ouverture, orbite douce | 0,09 rad/s | 94,5 u | 86 px/s | **1,4 px** |
| cadrage limite, orbite haute (borne `shibumap-shots`) | 0,12 rad/s | 47 u | 232 px/s | **3,9 px** |

**Sur toute l'enveloppe autorisée par la charte, le flou de mouvement vaut entre 1,4 et 3,9 pixels.** Ce n'est jamais ce qui fait qu'un plan est raté. Sa vraie utilité ici est ailleurs, et elle est réelle : à 232 px/s, une ligne de contour d'un pixel se déplace de 7,7 px par image et **stroboscope**. `SMAAEffect` est un anticrénelage **spatial** : il ne peut rien contre le scintillement entre images. Or un scintillement, c'est de l'agitation — exactement ce que la charte interdit.

**Les trois chemins :**

| | 1. Passe WebGL vélocité | 2. Accumulation à l'export | 3. Suréchantillonnage + ffmpeg |
|---|---|---|---|
| disponible ? | **non** — inventaire des exports de `postprocessing@6.36` : aucun effet de flou de mouvement (Bloom, DOF, TiltShift, Bokeh, RealisticBokeh, LensDistortion… mais rien de temporel) | oui, ~30 lignes dans `export.js` | oui, **zéro ligne** : un argument `fps` et un appel ffmpeg |
| à écrire | tampon de vélocité + matrice image précédente sur **chaque** matériau, dont les 4 shaders maison (relief `surfaceFx`, océan, nuages volumétriques, socle en verre) | boucle de N sous-rendus moyennés | rien |
| coût de rendu | ~1,3× en continu | **exactement ×N** | **exactement ×N** |
| coût sur l'app en production | **oui, sur le GPU de chaque visiteur** | aucun (chemin d'export seul) | aucun |
| exactitude | approximation par reprojection ; **faux sur la transmission et la réfraction** — le socle en verre et l'eau ne se reprojettent pas | exact : c'est l'intégrale d'obturateur | exact (obturateur 360°) |
| bonus | — | **anticrénelage temporel gratuit** | idem |
| angle d'obturateur réglable | oui | oui | 360° seulement (180° coûte ×2N) |

`ffmpeg -filters` sur la machine confirme la disponibilité de `tmix` et `tblend` (ffmpeg 8.1.2). La recette du chemin 3 :

```bash
# rendre à 120 fps au lieu de 30, puis moyenner 4 images consécutives
ffmpeg -i shot-120.mp4 -vf "tmix=frames=4:weights='1 1 1 1',fps=30" -c:v libx264 -crf 18 -pix_fmt yuv420p shot.mp4
```

**Recommandation : chemin 3 d'abord** (une soirée, aucune ligne de moteur touchée, réversible), chemin 2 seulement si l'angle d'obturateur devient un sujet artistique. **Chemin 1 : à écarter**, et pas pour son coût — pour son risque. Il tourne chez tous les visiteurs, et il ment sur les deux matériaux (verre, eau) qui font la signature visuelle du produit.

**Le coût en secondes n'est pas mesuré.** Le coût *relatif* est exactement ×N ; le rendu étant hors ligne, il n'y a aucune contrainte temps réel, seulement du temps d'attente. La tâche 5 du plan commence par chronométrer une image.

---

## 4. Les skills Claude existantes

Recherche menée pour de vrai (`find-skills` sur sept requêtes + parcours des dépôts publics).

**Ce qui existe et qui est utilisable :**

| besoin | skill | où | usage ici |
|---|---|---|---|
| storyboard / découpage | `inference-sh/skills@storyboard-creation` (660 ★), `smixs/visual-skills` (112 ★, direction Murch + syntaxe Seedance/Kling/Veo) | GitHub | **source d'inspiration, pas d'intégration** — ils produisent du texte pour des modèles génératifs, pas des poses de caméra |
| montage automatique | `browser-use/video-use` (17,9 k ★) — coupe pilotée par transcript, suppression des silences, fondus 30 ms | GitHub | **non applicable** : nos clips n'ont ni parole ni transcript |
| presets de caméra ciné | `kevinbadi/blender-skills` (39 ★) — turntable, slow-zoom, dolly-rotate, crane-shot | GitHub | **utile comme référence de nomenclature** pour la grammaire du §3 ; le code est Blender, inutilisable tel quel |
| prompts vidéo générative | `seedance-shot-design`, `seedance-prompt-en` | **déjà installées** | voir §4bis |
| tournage moteur | `shibumap-shots` | **déjà installée** | c'est la fondation du plan |
| montage final | `screenforge` | **déjà installée** | musique + ratio + export, sur UN master |

**Ce qui n'existe pas, nulle part :**

1. **Flou de mouvement / post-traitement de rendu : catégorie vide.** Zéro skill, tous registres confondus. Les résultats de recherche sont tous des faux positifs (framer-motion, floutage de données personnelles).
2. **Caméra cinématique scriptée en three.js / WebGL : rien.** Le seul vrai skill de caméra automatisée cible Blender. `shibumap-shots` occupe une niche que personne n'a publiée.
3. **Générateur de shot list crédible : rien** (le plus gros fait 51 installations).
4. `github.com/anthropics/skills` (17 skills first-party) ne contient **rien** sur la vidéo, la caméra, le storyboard ou la 3D.

**Ce qu'il faut donc écrire nous-mêmes** — une seule skill, et elle est étroite :

> **`shibumap-grammaire`** — la grammaire de plans du §3 : le catalogue des mouvements légitimes pour un objet posé, l'enveloppe de vitesse, le budget de cadrage du §3.2, la règle du surzoom, et la recette de flou de mouvement. Elle est le pendant *artistique* de `shibumap-shots`, qui est la skill *technique*.

Suivre `superpowers:writing-skills` pour l'écrire. **Ne pas l'écrire avant la tâche 6 du plan** : une skill qui code des règles qu'on n'a pas encore éprouvées à l'écran serait une skill de suppositions. C'est la tâche 8.

### 4bis. « Améliorer à l'IA sans inventer » — verdict

**Question posée :** peut-on passer un rendu ShibuMap dans Seedance pour l'embellir, sans qu'il ajoute un arbre là où il n'y en a pas ?

**Réponse : non. C'est illusoire, et pour une raison de construction, pas de réglage.** Les deux skills, invoquées, le disent chacune à leur manière :

1. **Aucun mode d'entrée ne préserve la structure.** Les modes réels sont : première/dernière image, référence de personnage, référence de mouvement de caméra, référence de chorégraphie, réplication d'effets, extension de vidéo, remplacement de personnage, `relight`/restyle. Aucun n'est un mode « fidélité géométrique ». L'exemple canonique de l'édition vidéo dans `seedance-prompt-en` **renverse l'intrigue du plan source** — c'est dire le degré de liberté que le modèle prend. Le modèle **régénère chaque pixel** ; l'hallucination n'est pas un défaut à border, c'est le mécanisme.

2. **Le passage coûte de la résolution.** Nos exports sortent en 1080×1920 (et `exportImage`/`exportVideo` acceptent n'importe quelle taille). Les deux skills ne s'accordent d'ailleurs pas sur le plafond de Seedance — `seedance-specs.md` annonce « 480p / 720p / 1080p », `seedance-prompt-en` annonce « 480p (640×640) à 720p (834×1112) ». **Je signale la contradiction plutôt que de retenir le chiffre flatteur.** Dans les deux lectures, le résultat est le même : Seedance ne peut pas *upscaler* un rendu qui est déjà à son plafond ou au-delà. L'« amélioration » commencerait par une perte.

3. **Et surtout — tout ce qu'Adrien demande sous le mot « IA » est déjà obtenable exactement, sans IA, et mieux :**

| ce qu'il veut | par l'IA | par le moteur | verdict |
|---|---|---|---|
| grain | approximé, inconstant | `NoiseEffect` est **déjà dans la chaîne** (`main.js:1463`), paramètre `grain` déjà dans `TEMPLATE_KEYS` | **déjà là** |
| étalonnage | approximé | `exposure`/`contrast`/`saturation`/tone mapping déjà là ; et `postprocessing` expose **`LUTEffect`** (vérifié dans les exports) — un LUT ciné est une passe à ajouter | **une soirée, exact** |
| flou de mouvement | halluciné | accumulation ou `tmix` — **l'intégrale exacte de l'obturateur** (§3.3) | **exact, et gratuit hors ligne** |
| interpolation d'images | invente les images intermédiaires | **il n'y a rien à interpoler** : le rendu est hors ligne et déterministe, on rend directement à 60 ou 120 fps | **la question ne se pose pas** |
| upscaling | invente le détail | on rend directement en 4K : `exportVideo({width, height})` prend n'importe quelle taille | **la question ne se pose pas** |

L'interpolation et l'upscaling n'existent que pour réparer une capture à débit et résolution figés. **Nous n'en avons pas : nous avons la vérité terrain, à la demande.** Utiliser un modèle génératif pour approximer une information qu'on peut calculer exactement est un pur recul.

**Ce qui resterait honnêtement à l'IA :** produire du plausible organique que le moteur ne rend pas — brume, oiseaux, sillages, canopées. C'est-à-dire exactement la catégorie qu'Adrien interdit. La frontière est nette, et elle tombe du bon côté.

**Recommandation :** ne pas brancher Seedance sur le pipeline vidéo. En revanche, **garder les deux skills pour leur dictionnaire** : `seedance-shot-design` porte un vocabulaire de 50+ mouvements de caméra et un système d'éclairage en trois couches (source / comportement / tonalité) qui est une excellente grille pour écrire notre propre grammaire au §3 — sans jamais lancer une génération.

---

# PLAN

Ordonné par **gain sur risque**, avec une contrainte qui prime : **la tâche 3 produit la première vidéo automatique.** Tout ce qui la précède existe pour elle.

## Structure des fichiers

| fichier | responsabilité | pur ? |
|---|---|---|
| `src/topo-score.js` | métriques + score d'un MNT (§1) | oui — ni DOM, ni three |
| `test/topo-score.test.js` | verrouille le classement et les deux bugs du §1.3 | — |
| `scripts/scout-places.mjs` | classe des lieux hors ligne, écrit `data/topo-scores.json` | Node |
| `src/shot-grammar.js` | métriques + durée → liste de plans (poses de caméra) (§3) | oui |
| `test/shot-grammar.test.js` | verrouille l'enveloppe de vitesse et le budget de cadrage | — |
| `scripts/shoot-auto.mjs` | pilote puppeteer/CDP : lieu + look + plans → `.mp4` | Node |
| `src/look-registry.js` | registre déclaratif des réglages générables (§2.3) | oui |
| `src/look-gen.js` | registre + MNT + graine → un look complet | oui |
| `test/look-gen.test.js` | conformité `KNOBS` ↔ `TEMPLATE_KEYS`, déterminisme | — |

---

## Task 1: le score topographique, en module pur

**Files:**
- Create: `src/topo-score.js`
- Create: `test/topo-score.test.js`
- Modify: `package.json` (ajouter le test à la liste du script `test`)

**Interfaces:**
- Consomme : un objet MNT à la forme de `analyzeDem` — `{ data: Float32Array, size: number, metersPerPixel: number }`.
- Produit :
  - `demMetrics(dem) → { terre, ampl, pente, pente95, coteDens, falaiseFrac, reliefCote, iles }`
  - `topoScore(metrics) → { total: number, relief: number, littoral: number }`
  - `openMask(mask, size) → Uint8Array` (exporté pour le test du bug n°2)

- [ ] **Step 1: écrire le test qui échoue**

Le test encode les deux bugs du §1.3 et l'ordre attendu. Fixtures **synthétiques** (pas de réseau dans les tests) : trois MNT fabriqués à la main.

```js
// test/topo-score.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import { demMetrics, topoScore, openMask } from '../src/topo-score.js'

const SIZE = 128
// un plateau parfaitement plat, 100 m partout : aucune côte, aucun relief
function plateau() {
  return { data: new Float32Array(SIZE * SIZE).fill(100), size: SIZE, metersPerPixel: 30 }
}
// une île conique centrée, 800 m au sommet, mer autour
function ile() {
  const d = new Float32Array(SIZE * SIZE)
  const c = SIZE / 2
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const r = Math.hypot(x - c, y - c)
      d[y * SIZE + x] = r < 40 ? 800 * (1 - r / 40) - 20 : -50
    }
  return { data: d, size: SIZE, metersPerPixel: 30 }
}

test('BUG 2 — un bloc 100 % terrestre n\'a AUCUN littoral', () => {
  const m = demMetrics(plateau())
  assert.equal(m.coteDens, 0, 'le bord du CADRE n\'est pas un rivage')
  assert.equal(m.falaiseFrac, 0)
  assert.equal(m.reliefCote, 0)
})

test('BUG 1 — la falaise se mesure en ARRIÈRE du rivage, pas dessus', () => {
  // le pixel de rivage est au niveau de la mer : sa pente propre est faible,
  // mais l'île monte à 800 m juste derrière → falaise détectée
  const m = demMetrics(ile())
  assert.ok(m.falaiseFrac > 0.5, `falaiseFrac=${m.falaiseFrac}`)
})

test('un plateau plat marque quasiment zéro', () => {
  assert.ok(topoScore(demMetrics(plateau())).total < 10)
})

test('une île en cône bat largement un plateau plat', () => {
  const a = topoScore(demMetrics(ile())).total
  const b = topoScore(demMetrics(plateau())).total
  assert.ok(a > b + 30, `île=${a} plateau=${b}`)
})

test('openMask réplique le bord — pas d\'anneau creux', () => {
  const m = new Uint8Array(16 * 16).fill(1)
  const o = openMask(m, 16)
  assert.equal(o[0], 1, 'le coin doit rester terre')
  assert.equal(o[15], 1)
})
```

- [ ] **Step 2: lancer le test, vérifier qu'il échoue**

Run: `node --test test/topo-score.test.js`
Expected: FAIL — `Cannot find module '../src/topo-score.js'`

- [ ] **Step 3: écrire le module**

Le corps est le script validé du rapport, transposé en module pur. Reprendre `C:\Users\adrie\AppData\Local\Temp\claude\G--My-Drive--GITHUB\ed4e3ecd-eb07-4312-a4ba-d4e3ef43c3f0\scratchpad\topo-score3.mjs` — fonctions `open3` (renommée `openMask`, avec le paramètre `size`), `metrics` (renommée `demMetrics`), `score` (renommée `topoScore`). Points à ne pas perdre en transposant :

```js
// src/topo-score.js — en-tête à écrire, il porte les deux bugs
// SCORE TOPOGRAPHIQUE — « ce lieu fera-t-il un beau BLOC ? », pas « ce lieu
// est-il beau ? ». Une plage de rêve est plate ; les Maldives ont 6 m
// d'amplitude mesurés. Ce qui rend un bloc spectaculaire est mesurable.
//
// ⚠️ DEUX BRANCHES, ALTERNATIVES ET NON CUMULÉES. Une somme plafonnait
// mécaniquement à 42/100 tout bloc 100 % terrestre : le Mont Blanc sortait 14e,
// derrière Capri. Diviser par (1+bonus) le punissait de 31 %. La branche forte
// donne la note, la seconde ajoute au plus +30 %.
//
// ⚠️ LE BORD DU CADRE N'EST PAS UN RIVAGE. Une ouverture morphologique qui
// laisse l'anneau extérieur à zéro donne à tout bloc terrestre un faux littoral
// de densité 3,98 pile (= périmètre/largeur) et 100 % de falaises : la Beauce
// décrochait 49,9 de score littoral. Bord RÉPLIQUÉ, anneau exclu.
//
// ⚠️ LA FALAISE NE SE MESURE PAS SUR LE PIXEL DE RIVAGE. Il est plat par
// construction — c'est le niveau de la mer. Mesuré sur le pixel lui-même, les
// Lofoten affichaient 0,0 % de falaises. On regarde 400 m en arrière.
//
// Module PUR : ni DOM, ni three.js, ni fetch — sur le modèle de
// terrain-analysis.js et relief-grade.js.

const sat = (x, k) => x / (x + k)

export function openMask(mask, size) {
  const at = (m, x, y) =>
    m[Math.min(size - 1, Math.max(0, y)) * size + Math.min(size - 1, Math.max(0, x))]
  const er = new Uint8Array(size * size)
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++)
      er[y * size + x] =
        at(mask, x, y) && at(mask, x - 1, y) && at(mask, x + 1, y) && at(mask, x, y - 1) && at(mask, x, y + 1) ? 1 : 0
  const di = new Uint8Array(size * size)
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++)
      di[y * size + x] =
        at(er, x, y) || at(er, x - 1, y) || at(er, x + 1, y) || at(er, x, y - 1) || at(er, x, y + 1) ? 1 : 0
  return di
}

export function topoScore(m) {
  const R = 0.40 * sat(m.ampl, 1100) + 0.25 * sat(m.pente, 13) + 0.35 * sat(m.pente95, 32)
  const L = 0.30 * sat(m.coteDens, 2.0) + 0.40 * sat(m.reliefCote, 450)
          + 0.15 * m.falaiseFrac + 0.15 * sat(m.iles, 2.0)
  const hi = Math.max(R, L), lo = Math.min(R, L)
  const garde = Math.min(1, m.terre / 0.06)
  return { total: Math.min(100, 100 * hi * (1 + 0.3 * lo) * garde), relief: 100 * R, littoral: 100 * L }
}
```

`demMetrics` : transposer `metrics()` du script, en remplaçant la constante `S = 768` par `dem.size` et `cell` par `dem.metersPerPixel`, et en exposant `extent = dem.size * dem.metersPerPixel` pour la densité de côte.

- [ ] **Step 4: lancer le test, vérifier qu'il passe**

Run: `node --test test/topo-score.test.js`
Expected: PASS, 5 tests.

- [ ] **Step 5: inscrire le test dans package.json**

Ajouter ` test/topo-score.test.js` à la fin de la valeur du script `test`.
Run: `npm test`
Expected: PASS, aucune régression.

- [ ] **Step 6: commit**

```bash
git add src/topo-score.js test/topo-score.test.js package.json
git commit -m "feat(topo): score topographique d'un bloc — relief et littoral, deux branches alternatives"
```

---

## Task 2: confronter le budget de cadrage à l'écran

C'est la tâche qui **transforme la dérivation du §3.2 en verdict**, et la seule qui puisse légitimement faire bouger la directive « jamais de gros plans ». Elle ne produit pas de code de production : elle produit des images et un chiffre.

> ⚠️ **Hors chemin critique.** Si l'objectif immédiat est de publier, faire la **tâche 3 d'abord** et revenir ici. Cette tâche dépend du Step 1 de la tâche 3 (exposition de `offlineHooks`) — sans lui, la boucle rAF replace la caméra entre la pose et la capture.

**Files:**
- Create: `scripts/mesure-cadrage.mjs`
- Sortie : `marketing/mesure-cadrage/` (gitignoré comme le reste de `marketing/`)

**Interfaces:**
- Consomme : le serveur de dev sur `localhost:5199`, `window.__exp` (`camera`, `controls`, `composer`, `renderer`, `offlineHooks`).
- Produit : six PNG 1080×1920 nommés `cadrage-D<distance>.png`, et une ligne de journal par image donnant la taille théorique de la maille.

- [ ] **Step 1: écrire le script de mesure**

Le patron puppeteer/CDP est celui de `shibumap-shots` (§Pipeline). Le cœur :

```js
// scripts/mesure-cadrage.mjs
// Pose la caméra à six distances et exporte l'image. Le but est de RÉPONDRE à
// une question dérivée arithmétiquement au §3.2 du plan usine-à-vidéos :
// à quelle distance le maillage 768 devient-il visible ?
const DISTANCES = [145.5, 94.5, 59, 47, 30, 23.6] // u — voir le tableau du §3.2
const TERRAIN_SIZE = 56, RES = 768, FOV = 33, H = 1920

await page.evaluate(() => window.__exp.offlineHooks.pauseLoop())
for (const D of DISTANCES) {
  const maille = ((TERRAIN_SIZE / RES) * H) / (2 * D * Math.tan((FOV / 2) * Math.PI / 180))
  console.log(`D=${D} u → maille théorique ${maille.toFixed(2)} px`)
  await page.evaluate((d) => {
    const e = window.__exp
    const t = e.controls.target.clone()
    // Direction iso IDENTIQUE à toutes les distances — seule D change, sinon
    // on comparerait deux angles au lieu de deux distances. Vecteur unitaire :
    // 0,5528² + 0,6234² + 0,5528² = 1.
    const [ux, uy, uz] = [0.5528, 0.6234, 0.5528]
    e.camera.position.set(t.x + d * ux, t.y + d * uy, t.z + d * uz)
    e.camera.lookAt(t)
    e.camera.updateMatrixWorld()
  }, D)
  const blob = await page.evaluate(async () => {
    const m = await import('/src/export.js')
    const e = window.__exp
    const b = await m.exportImage({ renderer: e.renderer, composer: e.composer, camera: e.camera, width: 1080, height: 1920 })
    return new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b) })
  })
  // écrire le data URL sur disque
}
```

⚠️ Reprendre de `shibumap-shots` les deux pièges vérifiés : **tuer la boucle rAF de l'app** pendant la pose, et **masquer les pins orange des landmarks** (`#ff4d00`) avant de capturer.

- [ ] **Step 2: lancer sur un lieu à couverture FINE et un lieu à couverture MINIMALE**

Le second plafond du §3.2 dépend de la couverture. Deux lieux :
- Zermatt (45.98, 7.66) — swissALTI3D, `probeMaxZoom` doit rendre 15 à 17.
- Un lieu couvert à z12 seulement — le déterminer en exécutant `probeMaxZoom` plutôt qu'en le devinant :

Run:
```bash
node --input-type=module -e "
import { DEM_SOURCES, probeMaxZoom, tileForZoomAt } from './src/dem-source.js'
for (const [nom, lat, lon, z] of [['Zermatt',45.98,7.66,12],['Kerguelen',-49.3,69.5,10],['Socotra',12.5,54.0,11]]) {
  const tx = Math.floor(((lon+180)/360)*2**z)
  const r=(lat*Math.PI)/180
  const ty = Math.floor(((1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2)*2**z)
  console.log(nom, await probeMaxZoom(DEM_SOURCES.mapterhorn, tileForZoomAt(z,tx,ty), fetch))
}"
```
Expected: une ligne par lieu, avec le zoom maximal réellement servi. Noter les valeurs — elles alimentent la règle du surzoom.

- [ ] **Step 3: rendre le verdict à Adrien**

Écrire dans `marketing/mesure-cadrage/VERDICT.md` : les six images côte à côte, la taille de maille théorique de chacune, et **une seule phrase** disant à quelle distance le maillage devient visible à l'œil. Ne pas décider à sa place : lui présenter le seuil observé face au seuil dérivé (28 u de hauteur visible) et lui demander s'il autorise le plan moyen serré.

- [ ] **Step 4: commit**

```bash
git add scripts/mesure-cadrage.mjs
git commit -m "chore(mesure): confronter le budget de cadrage derive au rendu reel"
```

---

## Task 3: la première vidéo automatique — squelette de bout en bout

**Objectif : une commande, un `.mp4` publiable.** Lieu figé, look figé, un seul mouvement. Tout le reste du plan raffine ce squelette ; rien ne le remplace.

**Files:**
- Modify: `src/main.js` (exposer trois crochets déjà écrits, voir Step 1)
- Create: `scripts/shoot-auto.mjs`
- Sortie : `marketing/shots-v2/shot-auto-<slug>.mp4`

**Interfaces:**
- Consomme : `window.__exp` (`applyTemplate`, `params`, `loadRealTerrain`, `controls`, `camera`, `composer`, `renderer`, plus les trois crochets ajoutés au Step 1), et `/src/export.js` → `exportVideo`.
- Produit : un `.mp4` de 10,0 s exactement, 1080×1920, 30 fps.
- Sera consommé par : la tâche 4 (qui remplace le lieu figé par le meilleur du classement) et la tâche 6 (qui remplace le look figé par un look généré).

- [ ] **Step 1: exposer les crochets d'export hors ligne sur `__exp`**

**C'est le geste qui change tout, et il fait trois lignes.** `main.js` possède DÉJÀ toute la machinerie d'export hors ligne — `loopPaused` (`main.js:3911`), `pauseLoop`/`resumeLoop` (`3938`/`3945`) et `stepScene(t, dt)` (`3912`) — mais elle n'est passée qu'à `openExportModal`, jamais exposée. C'est précisément pourquoi `shibumap-shots` doit « tuer la boucle rAF à la main puis répliquer dans step() le fog lift, le focus DoF et `clouds.update` » : le pipeline de tournage **réimplémente** ce que l'application fait déjà correctement, et toute divergence entre les deux est un bug silencieux.

`stepScene` fait déjà, dans le bon ordre : `updateCameraMotion`, `clouds.update`, `traffic.update`, `camera.updateMatrixWorld`, `raceLabels.update`.

Extraire le littéral d'objet passé à `openExportModal` dans une constante, et l'exposer :

```js
// src/main.js, avant l'appel à openExportModal
// CROCHETS D'EXPORT HORS LIGNE — extraits pour être partagés entre la modale
// d'export et les pilotes de tournage automatisés (scripts/shoot-auto.mjs).
// Sans cette exposition, un script externe doit tuer la boucle rAF à la main
// et RÉIMPLÉMENTER stepScene — deux copies d'une même logique qui divergent.
const offlineHooks = {
  pauseLoop: () => { loopPaused = true; cancelAnimationFrame(rafId); clearTimeout(tickTimer) },
  resumeLoop: () => { loopPaused = false; clock.getDelta(); tick() },
  step: stepScene,
}
```

puis `openExportModal({ renderer, composer, camera, recorder, ...offlineHooks })`, et dans le littéral `window.__exp` :

```js
  offlineHooks,
```

⚠️ **`refreshAll` n'est PAS exposé sur `__exp`** (vérifié). Pour changer un réglage de look depuis un script, passer par `applyTemplate({ look: {...} })`, qui appelle `refreshAll()` en interne (`main.js:2283`). Ne pas écrire `__exp.refreshAll?.()` : l'appel optionnel réussirait en ne faisant rien, et le réglage resterait sans effet à l'écran.

- [ ] **Step 2: écrire le pilote**

```js
// scripts/shoot-auto.mjs — l'usine, version squelette.
// Un lieu, un look, un mouvement, dix secondes. Le pipeline est celui de la
// skill shibumap-shots, éprouvé deux fois : rendu HORS LIGNE image par image,
// pas de capture d'écran, marche même onglet caché.
import puppeteer from 'puppeteer-core'
import fs from 'node:fs'

const LIEU = { nom: 'geiranger', lat: 62.1, lon: 7.1, zoom: 12 } // score 74,0 (§1.4)
const DUREE = 10, FPS = 30, W = 1080, H = 1920

const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' })
const page = (await browser.pages()).find((p) => p.url().includes('localhost:5199'))

// 1) aller sur le lieu et ATTENDRE que le MNT soit posé.
//    ⚠️ loadRealTerrain() ne prend AUCUN argument (main.js:1718) : on pose la
//    localisation dans params, puis on l'appelle — c'est le patron employé
//    partout dans main.js (3035/3045, 3758/3762, 5233/5237).
await page.evaluate(async ({ lat, lon, zoom }) => {
  const p = window.__exp.params
  p.demLat = lat; p.demLon = lon; p.demZoom = zoom; p.source = 'real'
  await window.__exp.loadRealTerrain()
}, LIEU)
await page.waitForFunction(() => window.__exp?.terrain?.dem?.data?.length > 0, { timeout: 60000 })

// 2) masquer les pins orange des landmarks (piège n°2 de shibumap-shots).
//    Via applyTemplate, car refreshAll n'est pas exposé.
await page.evaluate(() => window.__exp.applyTemplate({ look: { placesEnabled: false } }))

// 3) tourner
const dataUrl = await page.evaluate(async ({ DUREE, FPS, W, H }) => {
  const m = await import('/src/export.js')
  const e = window.__exp
  const t = e.controls.target.clone()
  const R0 = 110, R1 = 78            // pull-in doux sur 10 s, reste au-dessus du seuil de 47 u
  const theta0 = Math.PI * 0.25, OMEGA = 0.09   // rad/s — dans l'enveloppe du §3.3

  // ⚠️ ARRÊTER LA BOUCLE rAF DE L'APP, sinon controls.update se bat avec la
  //    caméra scriptée à chaque image (piège n°1 de shibumap-shots).
  e.offlineHooks.pauseLoop()
  try {
    const blob = await m.exportVideo({
      renderer: e.renderer, composer: e.composer, camera: e.camera,
      width: W, height: H, fps: FPS, duration: DUREE,
      step: (tSec, dt) => {
        const u = tSec / DUREE
        const R = R0 + (R1 - R0) * (u * u * (3 - 2 * u))  // smoothstep : ni départ ni arrivée brusques
        const th = theta0 + OMEGA * tSec
        const phi = 0.95 - 0.12 * u                       // se redresse un peu : le « reveal »
        e.camera.position.set(
          t.x + R * Math.sin(phi) * Math.sin(th),
          t.y + R * Math.cos(phi),
          t.z + R * Math.sin(phi) * Math.cos(th)
        )
        e.camera.lookAt(t)
        e.controls.target.copy(t)
        // Le reste de la scène (nuages, trafic, matrices, cartouches) est
        // avancé par stepScene — la MÊME fonction que la boucle temps réel.
        // Rien à répliquer à la main, donc rien qui puisse diverger.
        e.offlineHooks.step(tSec, dt)
      },
    })
    return await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob) })
  } finally {
    e.offlineHooks.resumeLoop()   // même si l'export échoue : sinon l'app reste gelée
  }
}, { DUREE, FPS, W, H })

fs.writeFileSync(`marketing/shots-v2/shot-auto-${LIEU.nom}.mp4`, Buffer.from(dataUrl.split(',')[1], 'base64'))
console.log('écrit')
```

- [ ] **Step 3: lancer et vérifier la durée exacte**

Run:
```bash
npm run dev &
node scripts/shoot-auto.mjs
ffprobe -v error -show_entries format=duration,size -show_entries stream=width,height,r_frame_rate -of default=nw=1 marketing/shots-v2/shot-auto-geiranger.mp4
```
Expected: `duration=10.0`, `width=1080`, `height=1920`, `r_frame_rate=30/1`.

- [ ] **Step 4: regarder le clip**

Critère de recevabilité, à passer AVANT de continuer : le mouvement est continu, la carte est calme, le socle ne sort jamais du cadre, aucun pin orange, aucun texte. Si l'un manque, corriger ici — pas plus loin.

⚠️ **Limite connue de ce squelette : la profondeur de champ est STATIQUE.** La directive d'Adrien demande `autoFocus` désactivé et `focusDistance` posé *sur le sujet* — or la caméra passe ici de 110 à 78 unités, et l'objet `dof` n'est pas exposé sur `__exp`. Deux issues, dans cet ordre de préférence :
1. poser `focusDistance` à la distance MÉDIANE du plan (94 u ici) dans le look avant de tourner — le sujet reste dans la bande de netteté sur toute la course si `focusRange` ≥ 15 ;
2. si cela ne suffit pas, exposer `dof` sur `__exp` de la même façon que `offlineHooks` au Step 1, et écrire `e.dof.target.copy(t)` dans `step`.
Ne pas activer `autoFocus` pour contourner : la directive l'exclut nommément.

- [ ] **Step 5: commit**

```bash
git add src/main.js scripts/shoot-auto.mjs
git commit -m "feat(usine): premiere video automatique de bout en bout — lieu et look figes"
```

---

## Task 4: brancher le score sur le choix du lieu

**Files:**
- Create: `scripts/scout-places.mjs`
- Create: `data/topo-scores.json` (produit par le script, versionné : c'est un catalogue, il doit être relisible)
- Modify: `scripts/shoot-auto.mjs` (lire le classement au lieu du lieu figé)

**Interfaces:**
- Consomme : `LANDMARKS` et `ISLANDS` de `src/landmarks.js`, `demMetrics`/`topoScore` de `src/topo-score.js`.
- Produit : `data/topo-scores.json` = `[{ nom, lat, lon, zoom, total, relief, littoral, metrics }]`, trié décroissant.

- [ ] **Step 1: écrire le batteur de MNT hors ligne**

Le script télécharge les tuiles terrarium AWS (le bucket public, pas Mapterhorn : pas de sondage de couverture à faire, et la résolution suffit pour classer une forme — §« ce que je n'ai pas mesuré »), les met en cache sur disque, et note chaque landmark **à trois zooms** (`zoom−1`, `zoom`, `zoom+1`) pour retenir le meilleur cadrage (§1.5).

Reprendre le décodeur PNG et le chargeur de bloc de `topo-score3.mjs` (scratchpad). Structure :

```js
// scripts/scout-places.mjs
import { LANDMARKS, ISLANDS } from '../src/landmarks.js'
import { demMetrics, topoScore } from '../src/topo-score.js'

const tous = [...Object.values(LANDMARKS).flat(), ...ISLANDS]
const out = []
for (const l of tous) {
  let best = null
  for (const z of [l.zoom - 1, l.zoom, l.zoom + 1]) {
    if (z < 4 || z > 15) continue                    // AWS s'arrête à 15
    const dem = await loadBlock(l.lat, l.lon, z)     // { data, size, metersPerPixel }
    const m = demMetrics(dem)
    const s = topoScore(m)
    if (!best || s.total > best.total) best = { ...s, zoom: z, metrics: m }
  }
  out.push({ nom: l.name, lat: l.lat, lon: l.lon, ...best })
}
out.sort((a, b) => b.total - a.total)
fs.writeFileSync('data/topo-scores.json', JSON.stringify(out, null, 1))
```

⚠️ **Limiter la concurrence à 8 requêtes** et **mettre le cache disque en place dès le premier passage** : 132 landmarks × 3 zooms × 9 tuiles = 3 564 requêtes. Sans cache, chaque itération de mise au point les refait.

- [ ] **Step 2: lancer et lire le haut du classement**

Run: `node scripts/scout-places.mjs && node -e "console.table(require('./data/topo-scores.json').slice(0,20))"`
Expected: 20 lignes. **Critère de recevabilité : aucun lieu manifestement plat dans les 20 premiers.** Si l'un apparaît, c'est le score qu'il faut corriger, pas la liste qu'il faut expurger.

- [ ] **Step 3: faire lire le classement au pilote**

Dans `scripts/shoot-auto.mjs`, remplacer la constante `LIEU` par :

```js
const classement = JSON.parse(fs.readFileSync('data/topo-scores.json', 'utf8'))
const rang = Number(process.argv[2] ?? 0)
const e = classement[rang]
const LIEU = { nom: e.nom.toLowerCase().replace(/[^a-z0-9]+/g, '-'), lat: e.lat, lon: e.lon, zoom: e.zoom }
```

- [ ] **Step 4: tourner les trois premiers**

Run: `for i in 0 1 2; do node scripts/shoot-auto.mjs $i; done`
Expected: trois `.mp4` de 10,0 s dans `marketing/shots-v2/`.

- [ ] **Step 5: commit**

```bash
git add scripts/scout-places.mjs data/topo-scores.json scripts/shoot-auto.mjs
git commit -m "feat(usine): le classement topographique choisit le lieu et le cadrage"
```

---

## Task 5: le flou de mouvement par suréchantillonnage

**Files:**
- Modify: `scripts/shoot-auto.mjs` (paramètre `--blur N`)
- Create: `scripts/assemble.mjs` (l'appel ffmpeg, réutilisable)

**Interfaces:**
- Consomme : le `.mp4` rendu à `N×30` fps.
- Produit : un `.mp4` à 30 fps, obturateur 360°, même durée.

- [ ] **Step 1: chronométrer une image AVANT de multiplier par N**

Le rapport ne l'a pas mesuré ; c'est le premier geste ici.

Run:
```bash
node --input-type=module -e "
import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' })
const p = (await b.pages()).find(x => x.url().includes('localhost:5199'))
console.log(await p.evaluate(() => {
  const e = window.__exp
  e.composer.setSize(1080, 1920, false)
  const t0 = performance.now()
  for (let i = 0; i < 30; i++) e.composer.render()
  return 'ms par image : ' + ((performance.now() - t0) / 30).toFixed(1)
}))"
```
Expected: une valeur en ms. **Elle décide de N** : le rendu d'un clip de 10 s coûte `300 × N × T`. À T = 30 ms et N = 4, c'est 36 s — négligeable. À T = 300 ms et N = 8, c'est 12 min — à peser.

- [ ] **Step 2: rendre à N×30 fps**

Dans `shoot-auto.mjs`, le seul changement : `fps: FPS * N` dans l'appel à `exportVideo`. `exportVideo` calcule `total = duration * fps` et appelle `step(f/fps, 1/fps)` — **la durée reste 10 s et le pas de temps se resserre tout seul**, donc les nuages et la mer avancent correctement. Aucun autre ajustement.

- [ ] **Step 3: écrire l'assembleur**

```js
// scripts/assemble.mjs — moyenne temporelle : l'intégrale exacte de
// l'obturateur, pas une approximation. ffmpeg 8.1.2 fournit tmix (vérifié).
import { execFileSync } from 'node:child_process'
export function motionBlur(src, dst, N, fps = 30) {
  const w = Array(N).fill('1').join(' ')
  execFileSync('ffmpeg', ['-y', '-i', src, '-vf', `tmix=frames=${N}:weights='${w}',fps=${fps}`,
    '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(fps), dst], { stdio: 'inherit' })
}
```

- [ ] **Step 4: comparer avec et sans, sur le plan le plus rapide**

Run:
```bash
node scripts/shoot-auto.mjs 0 --blur 4
ffprobe -v error -show_entries format=duration -of default=nw=1 marketing/shots-v2/shot-auto-*.mp4
```
Expected: `duration=10.0` sur le fichier final.

**Critère de recevabilité :** les lignes de contour ne stroboscopent plus. Si aucune différence n'est visible, c'est le résultat attendu du §3.3 (1,4 px sur un plan lent) — **garder N = 1 par défaut** et ne monter que sur les plans qui bougent vite. Ne pas payer ×4 pour rien.

- [ ] **Step 5: commit**

```bash
git add scripts/assemble.mjs scripts/shoot-auto.mjs
git commit -m "feat(usine): flou de mouvement par sur-echantillonnage temporel + tmix"
```

---

## Task 6: le registre de looks et son test de survie

**Files:**
- Create: `src/look-registry.js`
- Create: `src/look-gen.js`
- Create: `test/look-gen.test.js`
- Modify: `package.json`

**Interfaces:**
- Consomme : `TEMPLATE_KEYS` de `src/templates-user.js`, `EARTH_BIOMES`/`generateEarthPalette` de `src/palette.js`, `lightingFor`/`sunPosition` de `src/daycycle.js`, `gradeForDem` de `src/relief-grade.js`, la sortie de `demMetrics` (tâche 1).
- Produit :
  - `KNOBS` — objet `{ [cléDeTemplate]: descripteur }`
  - `biomeFor(metrics, lat) → string` (l'un des `EARTH_BIOMES`)
  - `goldenHour(lat, lon, date) → number` (heure décimale d'élévation solaire ≈ 8°)
  - `generateLook({ metrics, lat, lon, seed }) → objet look` — les mêmes clés que `captureLook()`

- [ ] **Step 1: écrire le test de conformité — celui qui fait survivre le système**

```js
// test/look-gen.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import { TEMPLATE_KEYS } from '../src/templates-user.js'
import { KNOBS } from '../src/look-registry.js'
import { generateLook, goldenHour } from '../src/look-gen.js'

test('CONFORMITÉ — toute clé de template est classée dans le registre', () => {
  // Ce test est le MÉCANISME DE SURVIE du générateur. Ajouter un réglage à
  // ShibuMap le fait rougir jusqu'à ce que quelqu'un ait dit comment le
  // générer — ou ait dit explicitement de ne pas y toucher ({type:'fixed'}).
  const orphelines = TEMPLATE_KEYS.filter((k) => !(k in KNOBS))
  assert.deepEqual(orphelines, [], `clés non classées dans KNOBS : ${orphelines.join(', ')}`)
})

test('CONFORMITÉ — le registre ne classe rien qui n\'existe pas', () => {
  const fantomes = Object.keys(KNOBS).filter((k) => !TEMPLATE_KEYS.includes(k))
  assert.deepEqual(fantomes, [], `clés du registre absentes de TEMPLATE_KEYS : ${fantomes.join(', ')}`)
})

const M = { terre: 0.6, ampl: 1600, pente: 26, pente95: 48, coteDens: 2.4, falaiseFrac: 0.9, reliefCote: 1050, iles: 0 }

test('DÉTERMINISME — même graine, même look, bit à bit', () => {
  const a = generateLook({ metrics: M, lat: 62.1, lon: 7.1, seed: 4242 })
  const b = generateLook({ metrics: M, lat: 62.1, lon: 7.1, seed: 4242 })
  assert.deepEqual(a, b)
})

test('DÉTERMINISME — graine différente, look différent', () => {
  const a = generateLook({ metrics: M, lat: 62.1, lon: 7.1, seed: 1 })
  const b = generateLook({ metrics: M, lat: 62.1, lon: 7.1, seed: 2 })
  assert.notDeepEqual(a, b)
})

test('l\'heure dorée dépend de la LATITUDE — pas un tirage uniforme', () => {
  const nord = goldenHour(67.9, 13.1, new Date('2026-07-15T00:00:00Z'))
  const sud = goldenHour(14.9, -24.3, new Date('2026-07-15T00:00:00Z'))
  assert.notEqual(nord.toFixed(1), sud.toFixed(1))
})

test('le look généré ne porte QUE des clés de template', () => {
  const look = generateLook({ metrics: M, lat: 62.1, lon: 7.1, seed: 7 })
  for (const k of Object.keys(look)) assert.ok(TEMPLATE_KEYS.includes(k), `clé étrangère : ${k}`)
})

test('les bornes « sûres » du registre sont respectées', () => {
  for (let s = 0; s < 200; s++) {
    const look = generateLook({ metrics: M, lat: 45, lon: 6, seed: s })
    for (const [k, d] of Object.entries(KNOBS)) {
      if (d.type !== 'range' || !(k in look)) continue
      assert.ok(look[k] >= d.safe[0] && look[k] <= d.safe[1], `${k}=${look[k]} hors de [${d.safe}] (graine ${s})`)
    }
  }
})
```

- [ ] **Step 2: lancer, vérifier que ça échoue**

Run: `node --test test/look-gen.test.js`
Expected: FAIL — `Cannot find module '../src/look-registry.js'`

- [ ] **Step 3: écrire le registre**

Une entrée par clé de `TEMPLATE_KEYS`. Quatre types seulement :

```js
// src/look-registry.js
// LE REGISTRE DES RÉGLAGES GÉNÉRABLES — une LIGNE DE DONNÉES par réglage, sur
// le patron de fx-meta.js (source unique que l'UI lit et que le moteur applique).
//
// ⚠️ POURQUOI CE FICHIER EXISTE. shuffleLook() (main.js:2608) est une suite
// d'affectations écrites à la main : il touche ~60 des ~190 clés de
// TEMPLATE_KEYS, et une option nouvelle n'est jamais générée tant que personne
// n'a pensé à éditer la fonction — sans que rien ne le signale. Ici,
// test/look-gen.test.js ROUGIT tant qu'une clé n'est pas classée.
//
// Quatre types, et rien d'autre :
//   range   — tiré dans [safe[0], safe[1]]. `min`/`max` rappellent ce que l'UI
//             permet ; `safe` est ce que le GÉNÉRATEUR s'autorise, toujours
//             plus étroit. La différence est la marge d'élégance.
//   pick    — tiré dans une liste close
//   derived — CALCULÉ (soleil réel, biome, ombrage du MNT) : jamais tiré
//   fixed   — le générateur n'y touche pas. C'est un choix, pas un oubli :
//             le mettre ici est la façon de dire « laisse tranquille ».
export const KNOBS = {
  // --- calculés, jamais tirés
  sunAzimuth:    { type: 'derived', from: 'solar' },
  sunElevation:  { type: 'derived', from: 'solar' },
  timeOfDay:     { type: 'derived', from: 'solar' },
  rampStops:     { type: 'derived', from: 'biome' },
  oceanShallow:  { type: 'derived', from: 'biome' },
  oceanMid:      { type: 'derived', from: 'biome' },
  oceanDeep:     { type: 'derived', from: 'biome' },
  shadeAuto:     { type: 'fixed', value: true },   // relief-grade.js recalcule
  mapTint:       { type: 'derived', from: 'grade' },
  heightContrast:{ type: 'derived', from: 'grade' },
  heightPivot:   { type: 'derived', from: 'grade' },
  slopeTint:     { type: 'derived', from: 'grade' },
  focusDistance: { type: 'derived', from: 'camera' },

  // --- tirés, dans des bornes plus étroites que l'UI
  bokehScale:    { type: 'range', min: 0, max: 32, safe: [4, 6],    group: 'dof' },   // directive Adrien
  focusRange:    { type: 'range', min: 1, max: 80, safe: [8, 15],   group: 'dof' },
  bokehEnabled:  { type: 'fixed', value: true },                                      // « DoF partout »
  autoFocus:     { type: 'fixed', value: false },                                     // idem
  cloudCoverage: { type: 'range', min: 0, max: 3,  safe: [0.9, 1.6], group: 'sky' },
  cloudBillow:   { type: 'range', min: 0, max: 3,  safe: [0.6, 1.8], group: 'sky' },
  seaWaveH:      { type: 'range', min: 0, max: 3,  safe: [0.3, 1.0], group: 'sea' },
  grain:         { type: 'range', min: 0, max: 1,  safe: [0.04, 0.12], group: 'post' },
  // …

  // --- listes closes
  seaBed:        { type: 'pick', values: ['map','sand','lagoon','abyss','seagrass','ink'] },
  plinthFinish:  { type: 'pick', values: ['solid','brushed','matte'] },

  // --- laissés tranquilles, explicitement
  fov:           { type: 'fixed', value: 33 },
  labels:        { type: 'fixed' },
  gpxWidth:      { type: 'fixed' },   // pas de trace dans un clip de com
  // …
}
```

⚠️ **Le remplissage complet est du travail de saisie, pas de conception.** La méthode : lancer le test de conformité, il imprime la liste exacte des clés orphelines ; les classer une par une. Pour chaque clé dont on doute, le bon défaut est `{ type: 'fixed' }` — ne pas générer est toujours sûr, générer au hasard ne l'est pas.

- [ ] **Step 4: écrire le générateur**

```js
// src/look-gen.js — MNT + lieu + graine → un look complet et REPRODUCTIBLE.
//
// ⚠️ RNG À GRAINE, pas Math.random(). shuffleLook() n'est pas rejouable : on ne
// peut ni reproduire un tirage réussi, ni faire d'A/B, ni le tester. Un clip
// publié doit pouvoir être RETOURNÉ à l'identique six mois plus tard.
import { mulberry32 } from './noise.js'          // déjà présent, déjà testé
import { KNOBS } from './look-registry.js'
import { EARTH_BIOMES, generateEarthPalette } from './palette.js'
import { sunPosition, solarHourToDate } from './daycycle.js'
import { gradeForDem } from './relief-grade.js'

// L'HEURE DORÉE, CALCULÉE — pas tirée dans 5,5–19,5 h comme le fait le shuffle.
// daycycle.js porte la vraie position solaire (portage SunCalc/Meeus) : l'heure
// à laquelle le soleil passe à ~8° au-dessus de l'horizon est DÉDUCTIBLE pour
// n'importe quel lieu et n'importe quelle date. 18 h à Chamonix et 18 h aux
// Lofoten en juillet ne sont pas la même lumière ; les tirer au sort le nie.
export function goldenHour(lat, lon, date = new Date(), cible = 8) {
  let meilleure = 18, ecart = Infinity
  for (let h = 12; h <= 22; h += 0.1) {           // recherche dans l'après-midi
    const el = sunPosition(solarHourToDate(h, lon, date), lat, lon).elevation
    const d = Math.abs(el - cible)
    if (d < ecart) { ecart = d; meilleure = h }
  }
  return +meilleure.toFixed(1)
}

// LE BIOME, DÉDUIT DU MNT — pas tiré. Une rampe alpine sur une île tropicale
// ment ; palette.js sait produire 8 biomes nommés, encore faut-il choisir.
export function biomeFor(m, lat) {
  const abs = Math.abs(lat)
  if (abs > 60 && m.coteDens > 1) return 'Arctic fjord'
  if (m.ampl > 2000 || m.pente95 > 45) return 'Alpine'
  if (m.terre < 0.35 && m.reliefCote < 200) return 'Lagoon atoll'
  if (m.falaiseFrac > 0.7 && m.reliefCote > 400) return 'Volcanic'
  if (abs < 25 && m.ampl > 400) return 'Rainforest'
  if (m.pente95 > 35 && m.terre > 0.95) return 'Canyon'
  if (m.ampl < 300) return 'Steppe'
  return 'High desert'
}

export function generateLook({ metrics, lat, lon, seed, date = new Date() }) {
  const rng = mulberry32(seed)
  const look = {}
  const hour = goldenHour(lat, lon, date)
  const sun = sunPosition(solarHourToDate(hour, lon, date), lat, lon)
  const palette = generateEarthPalette(rng, biomeFor(metrics, lat))
  const grade = gradeForDem({ minM: 0, maxM: metrics.ampl, meanM: metrics.ampl / 3 })

  for (const [k, d] of Object.entries(KNOBS)) {
    if (d.type === 'fixed') { if ('value' in d) look[k] = d.value; continue }
    if (d.type === 'range') { look[k] = +(d.safe[0] + rng() * (d.safe[1] - d.safe[0])).toFixed(3); continue }
    if (d.type === 'pick')  { look[k] = d.values[Math.floor(rng() * d.values.length)]; continue }
    // derived
    if (d.from === 'solar') {
      if (k === 'timeOfDay') look[k] = hour
      if (k === 'sunAzimuth') look[k] = +sun.azimuth.toFixed(1)
      if (k === 'sunElevation') look[k] = +sun.elevation.toFixed(1)
    } else if (d.from === 'biome') {
      look[k] = palette[k]
    } else if (d.from === 'grade') {
      look[k] = grade[k]
    }
  }
  return look
}
```

- [ ] **Step 4bis (à faire AVANT le Step 4 si l'on écrit le code dans l'ordre) : étendre `generateEarthPalette` pour accepter un biome imposé**

**Vérifié dans le source :** `generateEarthPalette(rng)` ne prend **qu'un seul argument** et choisit le biome elle-même (`const biome = pickB(EARTH_BIOMES)`, `palette.js:480`). Il faut donc l'étendre — et la façon de le faire n'est pas indifférente.

⚠️ **`palette.test.js` épingle les règles sur 300 graines.** `pickB` consomme un appel à `rng()`. Si on le rend conditionnel, toute la suite du tirage se décale et les 300 tests tombent. Le tirage doit donc rester **inconditionnel**, et l'imposition se faire par écrasement APRÈS :

```js
// src/palette.js — modification de la signature
export function generateEarthPalette(rng = Math.random, biomeImpose = null) {
  // …
  // ⚠️ pickB est appelé DANS TOUS LES CAS : il consomme un rng(), et le rendre
  // conditionnel décalerait tout le tirage suivant — les 300 graines épinglées
  // par palette.test.js tomberaient. On tire, PUIS on écrase.
  const tire = pickB(EARTH_BIOMES)
  const biome = biomeImpose && BIOMES[biomeImpose] ? biomeImpose : tire
  // …le reste inchangé
}
```

Ajouter à `test/palette.test.js` :

```js
test('generateEarthPalette accepte un biome imposé sans changer le tirage par défaut', () => {
  const p = generateEarthPalette(mulberry32(99), 'Arctic fjord')
  assert.ok(p.name.startsWith('ARCTIC FJORD'))
  // et le comportement SANS biome imposé reste bit à bit identique
  assert.deepEqual(generateEarthPalette(mulberry32(99)), generateEarthPalette(mulberry32(99), null))
})
```

Run: `node --test test/palette.test.js`
Expected: PASS — **y compris les 300 graines existantes.** Si l'une tombe, c'est que `pickB` a été rendu conditionnel : revenir en arrière.

Le générateur appelle alors `generateEarthPalette(rng, biomeFor(metrics, lat))`, qui retourne `{ name, rampStops, oceanShallow, oceanMid, oceanDeep, ink }` — les quatre dernières clés étant exactement celles que le registre marque `{ type: 'derived', from: 'biome' }`.

- [ ] **Step 5: lancer les tests jusqu'au vert**

Run: `node --test test/look-gen.test.js`
Expected: PASS, 7 tests. Le test de conformité imprimera la liste des clés à classer tant que le registre est incomplet — c'est sa fonction.

- [ ] **Step 6: brancher sur le pilote et tourner**

Dans `scripts/shoot-auto.mjs`, avant le tournage :

```js
const look = generateLook({ metrics: e.metrics, lat: e.lat, lon: e.lon, seed: rang })
await page.evaluate((l) => window.__exp.applyTemplate({ look: l }), look)
```

Run: `node scripts/shoot-auto.mjs 0` puis regarder.

- [ ] **Step 7: commit**

```bash
git add src/look-registry.js src/look-gen.js test/look-gen.test.js package.json scripts/shoot-auto.mjs
git commit -m "feat(usine): generateur de look declaratif, reproductible, accorde au lieu"
```

---

## Task 7: la grammaire de plans

**Files:**
- Create: `src/shot-grammar.js`
- Create: `test/shot-grammar.test.js`
- Modify: `scripts/shoot-auto.mjs`, `package.json`

**Interfaces:**
- Consomme : la sortie de `demMetrics`, la durée voulue.
- Produit : `planShots({ metrics, duration }) → [{ move, from, to, t0, t1 }]` où `from`/`to` sont `{ R, phi, theta }` en coordonnées sphériques autour de la cible — la même paramétrisation que `CameraAutomation._place`.

- [ ] **Step 1: écrire le test — il encode l'enveloppe du rapport**

```js
// test/shot-grammar.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import { planShots, SEUIL_R_MIN, OMEGA_MAX } from '../src/shot-grammar.js'

const MONTAGNE = { terre: 1, ampl: 3200, pente: 30, pente95: 52, coteDens: 0, falaiseFrac: 0, reliefCote: 0, iles: 0 }
const FJORD = { terre: 0.88, ampl: 1600, pente: 28, pente95: 54, coteDens: 2.4, falaiseFrac: 1, reliefCote: 1070, iles: 0 }
const PLAT = { terre: 1, ampl: 28, pente: 0.9, pente95: 1.9, coteDens: 0, falaiseFrac: 0, reliefCote: 0, iles: 0 }

test('la caméra ne descend JAMAIS sous le seuil de cadrage (§3.2)', () => {
  for (const m of [MONTAGNE, FJORD, PLAT])
    for (const s of planShots({ metrics: m, duration: 10 }))
      for (const p of [s.from, s.to])
        assert.ok(p.R >= SEUIL_R_MIN, `R=${p.R} sous le seuil ${SEUIL_R_MIN}`)
})

test('la vitesse angulaire reste dans l\'enveloppe « carte calme » (§3.3)', () => {
  for (const s of planShots({ metrics: FJORD, duration: 10 })) {
    const omega = Math.abs(s.to.theta - s.from.theta) / (s.t1 - s.t0)
    assert.ok(omega <= OMEGA_MAX, `omega=${omega.toFixed(3)} > ${OMEGA_MAX}`)
  }
})

test('le ras de l\'eau n\'est proposé QUE s\'il y a mer ET relief côtier', () => {
  const avec = planShots({ metrics: FJORD, duration: 10 }).map((s) => s.move)
  const sans = planShots({ metrics: MONTAGNE, duration: 10 }).map((s) => s.move)
  assert.ok(!sans.includes('waterline'), 'pas de ras de l\'eau sans mer')
  assert.ok(avec.includes('waterline') || avec.includes('orbit'))
})

test('les plans couvrent exactement la durée, sans trou ni recouvrement', () => {
  const s = planShots({ metrics: FJORD, duration: 10 })
  assert.equal(s[0].t0, 0)
  assert.equal(s[s.length - 1].t1, 10)
  for (let i = 1; i < s.length; i++) assert.equal(s[i].t0, s[i - 1].t1)
})

test('jamais plus de deux plans en 10 s (§3.1 — trois plans hachent)', () => {
  assert.ok(planShots({ metrics: FJORD, duration: 10 }).length <= 2)
})
```

- [ ] **Step 2: lancer, vérifier l'échec**

Run: `node --test test/shot-grammar.test.js`
Expected: FAIL — module absent.

- [ ] **Step 3: écrire le module**

```js
// src/shot-grammar.js
// LA GRAMMAIRE DE PLANS D'UN OBJET POSÉ SUR UNE TABLE.
//
// ShibuMap ne filme pas un paysage, il filme une MAQUETTE. La caméra ne peut
// donc pas HABITER la scène : à trois mètres du bord, la table s'arrête. Tout
// mouvement qui prétend qu'on vole DANS le paysage (le survol Lissajous de
// camera-automation.js, un POV) se lit comme une caméra ivre.
//
// Deux bornes, toutes deux dérivées et documentées dans
// docs/superpowers/plans/2026-07-27-usine-a-videos.md :
//   SEUIL_R_MIN — sous 47 unités, une maille du maillage 768 dépasse 5 px sur
//     une sortie 1080×1920 et le maillage devient le facteur limitant. Le MNT
//     et les masques ont 2× et 2,7× d'avance : c'est TOUJOURS le maillage qui
//     craque en premier.
//   OMEGA_MAX — au-delà, une ligne de contour d'un pixel se met à
//     stroboscoper, et un stroboscope est de l'agitation.
export const SEUIL_R_MIN = 47      // unités-monde
export const OMEGA_MAX = 0.12      // rad/s — borne haute de shibumap-shots
const R_LARGE = 110

export function planShots({ metrics: m, duration = 10 }) {
  const mer = m.coteDens > 0.5 && m.reliefCote > 300
  const base = { R: R_LARGE, phi: 0.95, theta: Math.PI * 0.25 }

  // Un SEUL mouvement dont l'échelle change fait déjà un plan large ET un plan
  // moyen : c'est la forme la plus calme, et la forme par défaut.
  const orbite = {
    move: 'orbit', t0: 0, t1: duration,
    from: { ...base },
    to: { R: Math.max(SEUIL_R_MIN, 78), phi: 0.83, theta: base.theta + OMEGA_MAX * 0.75 * duration },
  }
  if (!mer) return [orbite]

  // Avec mer ET relief côtier, deux plans 4 s + 6 s, coupe franche sur un
  // mouvement CONTINU : la caméra tourne dans le même sens de part et d'autre,
  // ce qui rend la coupe presque invisible.
  const t = 4
  const thetaMid = base.theta + OMEGA_MAX * 0.6 * t
  return [
    { move: 'orbit', t0: 0, t1: t, from: { ...base }, to: { R: 92, phi: 0.9, theta: thetaMid } },
    {
      move: 'waterline', t0: t, t1: duration,
      from: { R: 88, phi: 1.32, theta: thetaMid },     // phi élevé = caméra basse, rasante
      to: { R: Math.max(SEUIL_R_MIN, 62), phi: 1.36, theta: thetaMid + OMEGA_MAX * 0.55 * (duration - t) },
    },
  ]
}
```

- [ ] **Step 4: lancer jusqu'au vert**

Run: `node --test test/shot-grammar.test.js`
Expected: PASS, 5 tests.

- [ ] **Step 5: faire consommer la grammaire par le pilote**

Remplacer le mouvement écrit en dur de la tâche 3 par une interpolation `smoothstep` entre `from` et `to` du plan actif à `tSec` :

```js
const shots = planShots({ metrics: e.metrics, duration: DUREE })
// dans step(tSec) :
const s = shots.find((x) => tSec >= x.t0 && tSec < x.t1) ?? shots[shots.length - 1]
const u = (tSec - s.t0) / (s.t1 - s.t0)
const k = u * u * (3 - 2 * u)
const R = s.from.R + (s.to.R - s.from.R) * k
const phi = s.from.phi + (s.to.phi - s.from.phi) * k
const th = s.from.theta + (s.to.theta - s.from.theta) * k
```

- [ ] **Step 6: tourner les cinq premiers du classement et regarder**

Run: `for i in 0 1 2 3 4; do node scripts/shoot-auto.mjs $i; done`
Expected: cinq clips de 10,0 s. **Critère : aucun ne trahit le calme.**

- [ ] **Step 7: commit**

```bash
git add src/shot-grammar.js test/shot-grammar.test.js scripts/shoot-auto.mjs package.json
git commit -m "feat(usine): grammaire de plans pour un objet pose — enveloppe de vitesse et budget de cadrage"
```

---

## Task 8: écrire la skill `shibumap-grammaire`

À faire **après** la tâche 7, jamais avant : une skill qui codifierait des règles non éprouvées à l'écran serait une skill de suppositions.

**Files:**
- Create: `C:\Users\adrie\.claude\skills\shibumap-grammaire\SKILL.md`

- [ ] **Step 1: charger la méthode**

Invoquer `superpowers:writing-skills` et la suivre.

- [ ] **Step 2: écrire la skill**

Contenu obligatoire, tiré de ce document et **corrigé par ce que les tâches 2 et 7 auront montré à l'écran** :
- le catalogue des mouvements légitimes et le tableau des verdicts (§3.1) ;
- le budget de cadrage chiffré (§3.2) **avec le seuil observé**, pas seulement le seuil dérivé ;
- la règle du surzoom (`demZoom ≤ probeMaxZoom + 1`) ;
- l'enveloppe de vitesse et le verdict sur le flou de mouvement (§3.3) ;
- le verdict sur Seedance (§4bis), en une ligne, pour que la question ne soit pas reposée.

- [ ] **Step 3: vérifier la skill**

Suivre la procédure de vérification de `superpowers:writing-skills`.

---

## Task 9 (différée) : élargir la réserve de lieux au-delà des 132 landmarks

**À ne lancer que si les tâches 1 à 7 tournent et que la réserve s'épuise.** Le classement des 132 landmarks représente déjà des mois de publications à un clip par jour.

L'approche : balayer une grille mondiale grossière (un point tous les 0,5° sur les terres émergées, ~60 000 points), noter chacun à z11 avec `topoScore`, garder les 500 premiers, dédoublonner par distance minimale, puis raffiner par balayage de zoom. Coût : ~540 000 tuiles au premier passage. Le cache disque et une concurrence bornée à 8 sont obligatoires. Les jeux externes de l'annexe A servent ici — **et seulement ici** — à pré-filtrer la grille pour ne pas noter 60 000 points dont la moitié est plate.

---

## Auto-revue

**Couverture de la demande.**

| demande d'Adrien | où c'est traité |
|---|---|
| trouver les plus beaux endroits pour la topographie | §1 (mesuré), tâches 1 et 4 |
| générer des templates de A à Z, options actuelles ET à venir | §2, tâche 6 — le test de conformité est le mécanisme de survie |
| tourner une vidéo cinéma, plusieurs plans, gros plans, ras de l'eau | §3, tâches 3 et 7 |
| flou de mouvement quand la caméra bouge vite | §3.3 (chiffré), tâche 5 |
| améliorer à l'IA sans inventer | §4bis — **verdict : illusoire par le génératif, entièrement atteignable sans lui** |
| chercher des skills Claude existantes | §4 — recherche menée, trois catégories vides identifiées |
| un plan par gain sur risque, première vidéo au plus vite | tâche 3 = première vidéo ; l'ordre suit gain/risque |
| la carte doit rester calme | contrainte globale, et verrouillée par `OMEGA_MAX` dans `test/shot-grammar.test.js` |

**Deux points où je peux me tromper, et que je signale plutôt que de les lisser :**

1. **Le seuil de 47 unités est dérivé, pas vu.** L'anchor « 4–5 px par maille » vient du rapport bloc-central du 2026-07-27, pas de mes yeux. La tâche 2 existe pour ça et doit être faite avant d'annoncer quoi que ce soit à Adrien sur les gros plans.
2. **Les poids du score du §1 ont été ajustés contre l'intuition**, en trois passages, sur 34 lieux. C'est de la calibration honnête, pas une dérivation : un autre jeu de poids donnerait un autre ordre au milieu du tableau. Les extrémités (top 10, fond de classement) sont en revanche robustes — elles ont survécu aux trois versions et à la correction des deux bugs.

---

## Annexe A — sources et jeux de données externes

*(À compléter au moment de la tâche 9. Les items ci-dessous sont ceux à vérifier, avec leur licence, avant tout branchement.)*

- **Terrain Ruggedness Index** — Riley, DeGloria & Elliot (1999), *Intermountain Journal of Sciences* 5:23-27. Formule : moyenne quadratique des différences d'altitude avec les 8 voisins. Dépendant de la résolution : ne comparer que des grilles de même pas.
- **Vector Ruggedness Measure** — Sappington, Longshore & Thompson (2007), *Journal of Wildlife Management* 71:1419-1426. Découple la rugosité de la pente, ce que le TRI ne fait pas.
- **Topographic Position Index** — Weiss (2001), classification en formes de relief à deux échelles.
- **Proéminence des sommets** — le jeu d'Andrew Kirmse (proéminence calculée mondialement depuis SRTM). Vérifier la licence et l'URL de téléchargement avant usage.
- **GSHHG** — Global Self-consistent Hierarchical High-resolution Geography, pour les traits de côte de référence. Vérifier la licence.
- **Scenic-Or-Not / Seresinhe et al.**, *Using deep learning to quantify the beauty of outdoor places*, Royal Society Open Science — le seul jeu connu de beauté perçue étiquetée par des humains ; utile comme **contrôle** du score, jamais comme source (il note des photographies au sol, pas des blocs vus du ciel — c'est exactement le biais que le §1.1 identifie).

⚠️ **Aucun de ces items n'a été vérifié par mes soins au moment d'écrire.** Ils sont listés comme pistes à instruire, pas comme faits établis. Ne pas les citer comme sourcés tant que la licence et l'URL n'ont pas été ouvertes.
