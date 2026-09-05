# RAPPORT GEL — « LE LOGICIEL SE FIGE À Z7 » : CE N'EST PAS UNE BOUCLE, C'EST LE FIL SATURÉ

Arbre `C:\Dev\wt-gel`, branche `gel-z7`, base `4199e52` (Fusion VIE). Serveur
`npx vite --host 127.0.0.1 --port 10577`. Chrome sans tête (ANGLE D3D11, RTX 3080),
1280 × 720, DPR 1 et 2, CPU ×1, ×4 et ×6. Sonde : `scripts/sonde-gel.mjs`
(nouvelle), analyse : `.banc/GEL/analyse.py`. Relevés : `.banc/GEL/*/bilan.json`,
`charg-*.cpuprofile`, captures.

> **`npm test` : 5 094 tests · 5 094 réussis · 0 échec** (5 089 + 5).
> **`npm run audit:tests` : 282 listés · 282 sur disque, 6 hors suite déclarés,
> aucun écart.** Un test nouveau, inscrit : `test/cadence-raffinement.test.js`.

---

## 0. LE VERDICT EN SIX LIGNES

1. ⛔ **Le gel total n'a pas été reproduit sur cette machine** : 30 chargements
   (Sulawesi z7 par `flyTo`, par crans, par molette depuis l'orbite ; ×1, ×4,
   ×6 ; DPR 1 et 2) — **0 gel**, la page répond toujours, `busy` retombe, un
   cran de plus déplace la caméra. Un chien de garde hors page (CDP,
   `Runtime.evaluate` à délai, `Debugger.pause` armé) n'a jamais eu à mordre.
2. ⚡ **La vidéo d'Adrien prouve elle-même que le fil n'était PAS dans une boucle
   infinie** : le cartouche « REFINING … Z7 » apparaît à `p_024` et s'efface à
   `p_031`, soit 7 images à ~0,5 s = **3,6 s — c'est `MSG_MS = 3600`, un
   `setTimeout` qui a tiré à l'heure**. Une boucle infinie ou un `await` bloquant
   l'aurait laissé affiché. Pendant ce temps la carte ne bouge plus d'un pixel
   (`p_025 → p_040` : 0 px de différence hors curseur, mesuré).
3. **Ce que le banc montre, et qui est le mécanisme du gel** : de z5 à z7, **le
   fil principal est occupé à 97–99 %** (CPU ×4, DPR 2, profil CDP) par le
   raffinement du socle : `socleRaffine → terrain.rafraichirFenetre` (591 361
   sommets rééchantillonnés, bathymétrie fusionnée, normales) puis
   `plinth.rebuild`, **rejoués à chaque tuile qui atterrit** — 13 à 26 fois par
   palier —, avec pour seule borne un écart FIXE de 350 ms entre deux départs.
   Quand un raffinement coûte plus que l'écart (iMac 2015, écran 5K : la machine
   d'Adrien), le fil ne rend plus la main : la molette est avalée (`busy`,
   `_zoomGesture`), la caméra ne bouge plus, seuls les minuteurs DOM passent
   entre deux tâches. **C'est exactement la vidéo.**
4. **Bissection par fusion : aucune des neuf fusions n'a introduit le défaut.**
   Même banc sur `6275e62` (avant FLU) : **99 % à chaque palier**, 21 × 9 832 ms
   de raffinements à z5, 15 × 7 088 ms à l'arrivée z7 ; sur `cfa7bb6` (FLU) :
   99 %, 14 × 4 429 / 18 × 7 533 ; sur `4199e52` (tout fusionné) : 97–99 %,
   13 × 2 703 / 14 × 3 713. FLU a divisé le coût unitaire par 1,8 ; le
   mécanisme est plus vieux (le socle quadtree, Tâche 6 / R37).
5. **Le correctif** : l'écart entre deux raffinements suit le **coût mesuré** du
   dernier (nappe + socle), pour que le socle ne prenne jamais plus d'un quart
   du fil (`src/monde/cadence-raffinement.js`, pur, testé ; `socleRaffine`
   dans `main.js`). À coût nul c'est la loi de FLU au bit près ; rien n'est
   sauté, une révision due part dès que l'attente est écoulée. **A/B même
   session, ×4, DPR 2, fenêtre de 15 s après l'arrivée à z7 : raffinements
   16 → 4, tâches ≥ 200 ms 21 × 7 229 ms → 8 × 3 287 ms (÷ 2,2) ; à z6 :
   20 → 8, 27 × 8 906 → 15 × 5 783.**
6. ⚠️ **Ce que le correctif ne fait pas** : la plus longue tâche unique reste
   celle de FLU (~600–700 ms à ×4 : un `rafraichirFenetre` + `plinth.rebuild`
   dans la même seconde, ou un `terrain.rebuild`). Sur une machine deux fois
   plus lente, chacune vaut 1,5 s : c'est le prochain poste (§ 6).

---

## 1. LA DEMANDE, ET CE QUE LA VIDÉO DIT

> **Adrien :** *« J'ai des freezes complets du logiciel qui me forcent à
> actualiser (comme par exemple dans la vidéo quand j'arrive à Z7, je ne peux
> plus rien faire). »*

`video6/p_001…p_040`, `127.0.0.1:5599` (base `4199e52`). Lecture image par
image (différence de pixels, zone carte `[60:540, 200:1080]`) :

| images | ce qui se passe | px ≠ (seuil 24) |
|---|---|---|
| p_001 → p_011 | orbite, molette, la Terre grossit | ~300 000 |
| p_012 | « FX ONLINE — SURFACE MODE ENGAGED » (plongée, z5) | — |
| p_019 | « REFINING — −4,6252, 121,3669 · Z5 » | — |
| p_022 | « … Z6 » | 25 |
| p_023, p_024 | « … Z7 » (`−4,4349, 121,7735`), la carte change encore | 340 276 · 312 184 |
| **p_025 → p_040** | **la carte ne change plus** (seul le curseur bouge) | **0 à 163** |
| p_031 | le cartouche Z7 s'efface (4 318 px dans sa zone) — **3,6 s après p_024** | |

Le cartouche est masqué par `setTimeout(…, MSG_MS = 3600)` (`modes.announce`).
Il a tiré à l'heure : **le fil principal exécutait des minuteurs pendant le
« gel »**. Ce n'est donc ni une boucle infinie ni une promesse qui bloque le
fil — ce sont des tâches longues qui s'enchaînent en laissant passer les
minuteurs entre elles, et pendant lesquelles la molette (`_zoomGesture` sort
sur `busy`) et le rendu ne passent pas. Le rendu, lui, ne passe pas parce que
`tick` est une de ces tâches : une image = un raffinement complet.

---

## 2. LA REPRODUCTION — TRENTE CHARGEMENTS, ZÉRO GEL, ET CE QU'ILS MESURENT

`scripts/sonde-gel.mjs` : page neuve, orbite (12 000 km), puis le chemin
demandé, un `PerformanceObserver` (`longtask`) et un compteur d'images dans la
page, un **chien de garde hors page** (`Runtime.evaluate` par la session CDP,
`Promise.race` à 4 s ; `Debugger.enable` armé avant le vol pour que
`Debugger.pause` puisse interrompre une boucle et rendre la pile), et à la fin
**l'épreuve de réponse** : 12 s après l'arrivée, un cran de plus — la caméra
bouge-t-elle ? `busy` est-il retombé ?

| chemin (`--chemin`) | CPU | DPR | chargements | gels | `busy` après | répond au cran |
|---|---|---|---|---|---|---|
| `vol` : `modes.flyTo(−4,4349, 121,7735, 7)` | ×1 | 1 | 2 | 0 | non | oui |
| `molette` : flyTo z5, `cranZoom(1)` ×2 | ×1 | 1 | 3 | 0 | non | oui |
| idem | ×4 | 2 | 3 | 0 | non | oui |
| `orbite` : orbite centrée, `cranZoom(1)` tous les 600 ms | ×1 | 1 | 4 | 0 | non | oui |
| `roulette` : orbite centrée, **`WheelEvent` sur la toile** tous les 120 ms (le chemin de la vidéo) | ×1 | 1–2 | 5 | 0 | non | oui |
| idem | ×4 | 1–2 | 8 | 0 | non | oui |
| idem | ×6 | 2 | 2 | 0 | non | oui (z5 atteint seulement : la molette est avalée par `busy`) |

Le chemin dépend de l'état (piège commun) : les quatre ont été joués. Le
dernier, `roulette`, est celui de la vidéo (`p_001` orbite → molette → plongée
z5 → z6 → z7 en ~2 s).

**Ce que les relevés montrent à la place du gel** (`.banc/GEL/base-x4-dpr2-prof`,
profil CDP à 0,5 ms, ×4, DPR 2, fenêtre par palier) :

| palier | durée | fil occupé | `rafraichirFenetre` | `plinth.rebuild` | `terrain.rebuild` |
|---|---|---|---|---|---|
| z5 | 8,1 s | **97 %** | 13 × 2 703 ms | 15 × 1 071 | 2 × 555 |
| z6 | 15 s | **99 %** | 26 × 6 308 | 28 × 2 004 | 3 × 973 |
| z7, 15 s après l'arrivée | 15 s | **76 %** | 14 × 3 713 | 16 × 1 089 | 2 × 642 |

Temps propre sur les 15 s de z7 : `sampleHeights` 2 098 ms · `remplirHauteurs`
742 · `pousse` (plinth) 516 · `fuseBathymetry` 354 · `gridNormals` 343 ·
`ecrireNappe` 244 · `resampleCatmullRom` 203 · `natGris` 162. Par racine :
`socleRaffine < rafraichirFenetre` **3 954 ms**, `socleRaffine < plinth.rebuild`
1 043, `render` 817, `rebuild < _remplirDepuisFlux` 381.

⚠️ Pourquoi ce n'est pas un gel ICI et c'en est un CHEZ ADRIEN : à ×4 sur un
RTX 3080, un raffinement coûte 200–300 ms pour un écart de 350 ms — le fil
respire 50 à 150 ms par cycle, assez pour une image et un événement. Sur l'iMac
2015 (mémoire du projet : « l'ordi souffle à fond, 3 images par seconde »), à
DPR 2 sur 5K, le même raffinement dépasse l'écart : le cycle n'a plus de trou.
Le banc ×6 le montre déjà : **la molette n'atteint plus z7 en 70 s**, elle est
avalée.

### 2 bis. LE CRITÈRE DU BRIEF, APRÈS CORRECTIF (CPU ×1, DPR 1, chemin `roulette`)

| lieu | chargements | gels | tâche max pendant la descente | trou d'image max | répond au cran, `busy` retombé |
|---|---|---|---|---|---|
| **Sulawesi** −4,4349 / 121,7735 → z7 | **8** | **0** | 102 – 158 ms | 117 – 283 ms | 8/8 |
| désert (Tassili, 25,5 / 9,0) → z7 | 2 | 0 * | 100 ms | 117 ms | oui |
| côte (Brest, 48,38 / −4,49) → z7 | 2 | 0 | 106 – 213 ms | 150 – 350 ms | oui |
| île (La Réunion, −21,1 / 55,5) → z7 | 2 | 0 | 106 – 112 ms | 133 – 150 ms | oui |

\* Le premier chargement du désert a fait mordre le chien de garde à 4 s : la
pile rendue par `Debugger.pause` est `onFirstUse < WebGLProgram.getUniforms <
setProgram < WebGLRenderer.render < tick` — **l'édition des nuanceurs au
démarrage** (`getProgramInfoLog` 1 813 ms à ×1 sur la première page d'un
navigateur neuf, 1 677 à Sulawesi, 3 256 au pire) ; 1,5 s plus tard la pile
est `battre` (la boucle, normale) et le chargement finit sans gel (z7 atteint,
répond). C'est une tâche du DÉMARRAGE, pas de la descente, antérieure aux
fusions (le banc de FLU la relevait déjà comme `composer.render` 2 500 ms), et
elle disparaît dès la deuxième page (cache de programmes du pilote : 264–408 ms).
Rejoué avec un chien de garde à 8 s : 0 gel. **« Fil principal jamais bloqué
> 1 s » est tenu pendant la descente (≤ 213 ms à ×1), pas au démarrage.**

Plus longue tâche unique pendant la descente à ×4 (DPR 2) : **627 ms** (base
593 dans la même session ; FLU : 660 sur son banc) — le critère « ≤ 700 » tient.

---

## 3. LA BISSECTION PAR FUSION — LE DÉFAUT EST PLUS VIEUX QUE LES NEUF FUSIONS

Même sonde, même chemin (`roulette`), ×4, DPR 2, un chargement par commit,
`git checkout --detach` entre deux (la sonde est hors dépôt) :

| commit | z5 : occupé · raffinements | z6 | arrivée z7 (15 s) | tâche max |
|---|---|---|---|---|
| `6275e62` (Fusion RAMP, **avant FLU**) | 99 % · 21 × 9 832 ms | 99 % · 19 × 8 474 | 94 % · 15 × 7 088 | 1 196 ms |
| `cfa7bb6` (**Fusion FLU**) | 99 % · 14 × 4 429 | 99 % · 18 × 6 439 | 99 % · 18 × 7 533 | 705 |
| `4199e52` (tout fusionné, base de la vidéo) | 97 % · 13 × 2 703 | 99 % · 26 × 6 308 | 76 % · 14 × 3 713 | 461 |

Le nombre de raffinements par palier et l'occupation du fil sont les mêmes
avant et après les fusions ; ce qui a changé, c'est le coût unitaire (FLU :
468 → 265 ms par `rafraichirFenetre` à ×4). **La ligne, c'est
`if (t - _socleRaffineDepuis < RAFFINEMENT_SOCLE_MS) return` de `socleRaffine`
(main.js) — un écart fixe, posé par FLU à 350 ms, et avant FLU il n'y avait pas
d'écart du tout** (`_socleLisibles` seul : un raffinement par image dès qu'une
tuile atterrit).

Machine partagée par quatre agents : les valeurs absolues bougent de ±30 % entre
deux relevés (voir FLU §0) ; les rapports entre commits, dans la même heure,
tiennent.

---

## 4. LE CORRECTIF — L'ÉCART SUIT LE COÛT, PAS L'HORLOGE

`src/monde/cadence-raffinement.js` (pur) :

```js
attente = max(RAFFINEMENT_SOCLE_MS = 350, dernierCoutMs / PART_DU_FIL = 0,25)
```

comptée depuis le DÉPART du raffinement précédent (c'est ainsi que
`socleRaffine` compte) ; le coût est celui de `rafraichirFenetre` **plus**
celui du `plinth.rebuild` qui suit à l'image d'après. Un raffinement de 300 ms
ouvre un cycle de 1 200 ms (900 ms de fil libre) ; un de 1 200 ms, un cycle de
4 800. À coût nul (le premier), c'est 350 ms — FLU au bit près.

`src/main.js`, `socleRaffine` : `_socleDernierCoutMs` mesuré autour des deux
appels, `attenteRaffinement({ dernierCoutMs })` à la place de la constante.
Rien d'autre : ni le flux, ni la réservation, ni `rafraichirFenetre`, ni le
plinth.

**A/B même session** (`.banc/GEL/base2-x4-dpr2-prof` contre `fix2-…`, `git
stash` entre les deux, ×4, DPR 2, chemin `roulette`) :

| fenêtre | | raffinements | plinth | tâches ≥ 200 ms | trou d'image max |
|---|---|---|---|---|---|
| z5 | avant | 15 × 3 371 ms | 17 × 1 322 | 19 × 5 103 | 667 |
| | **après** | **4 × 1 036** | 6 × 636 | **9 × 3 077** | 700 |
| z6 (15 s) | avant | 20 × 5 496 | 23 × 2 220 | 27 × 8 906 | 667 |
| | **après** | **8 × 2 536** | 11 × 1 256 | **15 × 5 783** | 817 |
| z7, 15 s après l'arrivée | avant | 16 × 5 025 | 18 × 1 614 | 21 × 7 229 | 667 |
| | **après** | **4 × 1 364** | 6 × 629 | **8 × 3 287** | 667 |

Le fil rend la main : sur les 15 s de l'arrivée, **3,9 s de tâches longues en
moins**, et la moitié des cycles de raffinement ne sont plus qu'un
raffinement. L'état FINAL est le même (la dernière révision du flux est
toujours servie — test ④), la première image aussi (le premier part au plancher).

**Les gains de FLU restent** : plus longue tâche unique 627 ms à ×4 sur ce banc
(FLU : 660 sur le sien), `terrain.rebuild` 2 × 824 ms à l'arrivée (FLU :
405–435 à Chamonix ; ici Sulawesi z7 avec bathymétrie fusionnée, `BATHY_ZMIN = 7`).

**Ce qui est visible** : pendant qu'un palier charge, le relief se raffine par
paliers un peu plus espacés (4 au lieu de 16 à z7) ; l'image finale est
identique. Au repos, rien ne change.

---

## 5. LE TEST QUI MORD — `test/cadence-raffinement.test.js`

① à coût nul, 350 ms (FLU au bit près, NaN et négatif compris) · ② l'attente
suit le coût, `coût / cycle ≤ 1/4` pour tout coût, une `part` hors (0, 1)
retombe sur celle du dépôt · **③ la morsure par mutation** : 25 tuiles qui
atterrissent (une toutes les 160 ms), un raffinement de 300 ms, 6 s
d'observation — **la loi de FLU (`() => 350`) occupe 60 % du fil, celle-ci 25 %**,
et sur 12 s les deux servent la révision 25 : rien n'est perdu · ④ le premier
part au plancher, le second n'est pas sauté, et pas avant l'attente · ⑤
`main.js` applique la loi dans `socleRaffine` et mesure les DEUX coûts.

`simulerCadence` est la même machine d'états que `socleRaffine` (révision
comparée à chaque image, attente, départ, coût qui s'écoule).

---

## 6. CE QUE J'AI CRU, PUIS RÉFUTÉ

1. **« FLU est le suspect n° 1 »** (le brief, et moi). Réfuté par la
   bissection : la base d'avant FLU est PIRE (99 % partout, 1 196 ms de tâche
   max, 21 raffinements à z5). FLU a réduit le coût unitaire et posé l'écart
   fixe ; il n'a rien introduit.
2. **« Un gel total = boucle infinie ou promesse bloquante »** (le brief). La
   vidéo le réfute (§1, le cartouche s'efface à l'heure) et la sonde aussi
   (`busy` retombe, `travel`/`_diveTween` nuls, le cran suivant bouge la
   caméra, dans les 30 chargements).
3. **« `busy` reste levé : `loadSurface` attend une promesse jamais résolue
   (sondage `probeMaxZoom` en HEAD sur mapterhorn, `data/bathy/index.json`) »**.
   Tout se résout : les 404 de `tiles.mapterhorn.com/13…17/…` vus dans les
   journaux sont les HEAD de `probeMaxZoom` (dem-source.js), en parallèle,
   mémorisés, sans effet sur le fil ; la cascade bathymétrique (`peindreBathyTuile`,
   `overzoomTile`) est bornée par `zmin`.
4. **« z7 est spécial »**. À moitié vrai : `BATHY_ZMIN = 7` — c'est le premier
   palier où la bathymétrie est fusionnée (`fuseBathymetry` 354 ms propres sur
   15 s, `resampleCatmullRom` 203), donc le premier palier de mer coûteux à
   Sulawesi. Mais z5 et z6 sont saturés de la même façon ; Adrien les a
   traversés en 2 s à la molette, et c'est à z7 que la file des trois paliers
   s'est vidée sur son fil.
5. **« Une perte de contexte WebGL »**. Aucun `webglcontextlost` n'est écouté
   ni relevé ; sur 30 chargements, 0 erreur de page, 0 erreur console hors 404.
   Non exclu sur l'iMac (le GPU, DPR 2), mais rien ne l'indique dans la vidéo
   (les panneaux DOM restent nets, le cartouche s'efface).
6. **« Un nuanceur se recompile à z7 »** (`syncDetailToZoom` : le détail fin
   s'allume à z7 ; `_gateCouche` pose des `defines`). Mesuré en enveloppant
   `gl.linkProgram`/`getProgramInfoLog`/`getProgramParameter` : à Sulawesi,
   **trois programmes sont recréés à CHAQUE palier de mer** (z3, z5, z6, z7 :
   `#24…#34`, les matériaux d'eau de `ocean.js`), et chacun coûte **5 à 8 ms**
   — la source GLSL est constante (cache de programmes), `_gateCouche` ne sert
   que les couches sol/canopée. Le seul lien coûteux est celui du démarrage
   (§ 2 bis). Au désert, aucun programme ne naît après l'orbite.
7. **« L'occupation du fil est LA mesure »**. Non : à ×4 / DPR 2, le rendu
   seul (`tick` → `composer.render`) prend 40–60 ms par image, donc le fil est
   « occupé » à 85–95 % même sans raffinement. Ce qui distingue le gel, ce
   sont les **tâches ≥ 200 ms** (nombre × ms) et le **trou d'image maximal** —
   d'où les colonnes de `analyse.py`.

---

## 7. CE QUI RESTE, ET CE QUI EST DIT À ADRIEN

- **La plus longue tâche unique n'a pas bougé** (600–800 ms à ×4 : un
  `rafraichirFenetre` complet, ou `terrain.rebuild` à la plongée avec la
  bathymétrie). Le prochain levier est celui que FLU nommait : déporter
  `remplirHauteurs`/`sampleHeights` (2,1 s propres sur 15 s) dans le Worker, et
  ne rééchantillonner que les cases dont la tuile a changé (R37 partiel côté
  globe, pas côté nappe). `plinth.rebuild` (`pousse` : trois `Vector3` par
  triangle) est l'autre moitié.
- **La molette est avalée pendant `busy`** (`_zoomGesture` sort ; `cranZoom`
  encaisse l'intention, pas la molette). Sur une machine lente, c'est ce qui
  fait dire « je ne peux plus rien faire » entre deux paliers. Une ligne à
  discuter, pas à écrire cette nuit.
- ⚠️ **Le gel n'a pas été reproduit ici.** Le correctif s'attaque au mécanisme
  que la vidéo et le banc désignent (le fil saturé par la cadence du socle), et
  il est mesuré ; il n'est pas prouvé sur la machine d'Adrien. **À faire lire à
  Adrien : quelle machine, quel écran (DPR), et si la Console montre un
  « WebGL context lost » au moment du gel.**

## 8. FICHIERS

- `src/monde/cadence-raffinement.js` (neuf, pur) · `src/main.js` (`socleRaffine`,
  import ; la constante `RAFFINEMENT_SOCLE_MS` vit désormais dans le module).
- `test/cadence-raffinement.test.js` (neuf, inscrit dans `package.json`).
- `scripts/sonde-gel.mjs` (neuf : chemins `vol`/`molette`/`orbite`/`roulette`,
  chien de garde CDP, `Debugger.pause`, enveloppes, profil CDP, trous d'image,
  épreuve de réponse) · `.banc/GEL/analyse.py` (tableau par palier).
- Relevés : `.banc/GEL/{base,base-molette,base-orbite,base-roulette*,base-x4-dpr2,
  base-x6-dpr2,base-prof-x4,base-x4-dpr2-prof,bis-6275e62-x4-dpr2,bis-cfa7bb6-x4-dpr2,
  base2-x4-dpr2-prof,fix2-x4-dpr2-prof,crit-*}`.
