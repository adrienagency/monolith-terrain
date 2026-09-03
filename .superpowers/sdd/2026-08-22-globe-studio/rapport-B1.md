# B1 — LA BATHYMÉTRIE DU GLOBE : CE QUI EST FAUX, ET DE COMBIEN

Arbre `C:\Dev\wt-bat1`, branche `bathy-audit`. Serveur `npm run dev -- --host
127.0.0.1 --port 6311`. Chrome 141 sans tête (SwiftShader), sonde
`scripts/sonde-b1.mjs` (plomberie CDP + pose forcée dans `composer.render`
reprises de `scripts/sonde-r36.mjs` ; lecture au `readPixels` sur la texture GL
attachée à un tampon, décodage terrarium).

**`npm test` → 4 746 · 0 échec · 2 sautés = 4 748. `npm run audit:tests` → 252
listés · 252 sur disque, aucun écart. `git diff -- src/` VIDE** (je ne corrige
rien).

---

## ⚡ EN UNE PHRASE — ET C'EST LA MESURE QUI PARLE, PAS L'HYPOTHÈSE

**L'hypothèse du socle est FAUSSE au repos et VRAIE en approche, et le zoom qui
sépare les deux est z11.** À l'altitude d'orbite le globe montre une vraie
bathymétrie, à **8,5 m près du crop en moyenne sur 25 points**. Dès que sa tuile
passe **z11**, il rend **0,0 m** — la fosse de la Sonde, −7 105 m sur le crop,
devient une plaine au niveau de la mer, **7 105 m d'écart entre les deux
chemins au même point, au même zoom, dans la même session**.

---

## ⚠️ LES DEUX CORRECTIONS DU COORDINATEUR, VÉRIFIÉES

Il m'a écrit en cours de route (« vérifie que ce que je viens d'écrire est
vrai »). Vérifié. **Une des deux est fausse, l'autre est vraie mais ne dit pas ce
qu'il en conclut.**

### ⛔ « Toutes tes mesures ont été prises sans tuiles bathymétriques. Jette-les. » — NON

Le diagnostic était bon (l'arbre était nu), mais **je l'avais trouvé et réparé
avant de mesurer la moindre valeur** : jonction NTFS vers
`C:\Dev\monolith-terrain\public\data\bathy`, puis contrôle
`curl /data/bathy/index.json → 200` et `/data/bathy/8/120/120.png → 200` **avant
la première sonde**. État courant : `find public/data/bathy/8 -type f | wc -l`
→ **13 891**.

**Et la preuve n'est pas mon récit, c'est le relevé réseau** : le crop y demande
`/data/bathy/10/516/342.png → 200, 20 702 octets` dans la Manche (③ ci-dessous).
Une application sans données n'aurait pas pu servir ce corps. **Les relevés
tiennent.**

### ⚠️ « `globe.js` appelle bien `fuseBathymetry` via `flux-terrain.js`, mon hypothèse est fausse » — VRAI SUR LE CODE, FAUX SUR LA CONSÉQUENCE

`src/monde/flux-terrain.js:157` importe bien `fuseBathymetry`, et
`demanderBathy` / `remplirHauteurs` l'appliquent. **Mais `remplirHauteurs` n'a
que deux appelants**, et ni l'un ni l'autre n'est le pipeline de tuiles du
globe : `src/monde/fenetre-bornee.js:777` (la **fenêtre bornée**, le socle posé
sur la sphère) et `src/main.js:6582` (le **champ de la mer**). Les textures que
`_buildMesh` déplace et que le nuanceur colore ne passent jamais par là.

**Mesuré, pas déduit** — `node scripts/sonde-b1.mjs --scenario fusion` :
`window.fetch` instrumenté, 54 s de vol en mode sphère sur trois zones dont la
Manche (à l'intérieur de la zone EMODnet) :

| | tuiles d'altitude | **tuiles `/data/bathy/`** | `flux.bathy` |
|---|---|---|---|
| mode sphère, trois zones, 54 s | **544** | **0** | jamais créé |

**544 contre 0.** `demanderBathy` n'a pas tourné une seule fois. Et `flags.js`,
dans le paragraphe même que cite le coordinateur, l'écrit :
*« `src/dem.js` FUSIONNE la bathymétrie GEBCO … ; **`src/globe.js` sert le
terrarium nu** »*. Le « FAIT — Tâche 6 sexies » qui suit corrige
`remplirHauteurs`, c'est-à-dire **le socle**, pas le globe.

➡️ **L'hypothèse du socle survit donc au niveau structurel** (le globe ne fusionne
rien), et c'est **la mesure en mètres** qui la démonte au repos — pas la lecture
du code. Voir ②.

---

## ⚠️ ET DONC : L'ARBRE N'ÉTAIT PAS PRÊT, ET ÇA AURAIT FABRIQUÉ UN FAUX CONSTAT

Le brief annonçait « dépendances et données déjà liées ». **Ni l'un ni l'autre.**
`C:\Dev\wt-bat1` n'avait **pas de `node_modules`** et **pas un seul dossier de
données cuites** — `public/data/bathy/` absent, comme `coast-z6`, `lake-tiles`,
`water-tiles` (tous `.gitignore`, cf. `.gitignore:16-32`).

Un audit lancé là-dessus aurait conclu « la cascade bathymétrique est morte
partout, crop compris » — et ç'aurait été **le neuvième rapport faux**. J'ai donc
d'abord raccroché les données du clone de déploiement `C:\Dev\monolith-terrain`
(jonctions NTFS) et fait un vrai `npm install`. **Toutes les mesures qui suivent
sont prises avec les 21 557 tuiles bathymétriques réellement déployées.**

---

## ① LE TABLEAU DES VINGT-CINQ POINTS

Pose forcée à **2 500 km** (altitude d'orbite de repos), colonne crop lue par
`loadDem({ zoom: 8, tilesAcross: 1, bathy: true })`, colonne « sans bathy » par
le même appel avec `bathy: false`. Toutes les valeurs sont des **altitudes
absolues du fond, en mètres** (pas des profondeurs sous une surface — voir
l'avertissement sur les lacs plus bas).

| régime | lieu | lat / lon | référence (m) | **lu sur le globe (GPU)** | écart | écart % | **lu sur le crop** | crop sans bathy |
|---|---|---|---|---|---|---|---|---|
| fosse | Fosse des Mariannes (Challenger) | 11.373 / 142.591 | −10 935 | −10 601 *(z7)* | +334 | 3,1 % | −10 347 | −10 347 |
| fosse | Fosse de Porto Rico (Milwaukee) | 19.8 / −66.8 | −8 376 | −8 354 *(z7)* | +22 | 0,3 % | −8 345 | −8 345 |
| fosse | Fosse de la Sonde (Java) | −10.3 / 109.9 | −7 290 | −7 071 *(z7)* | +219 | 3,0 % | −7 105 | −7 065 |
| fosse | Fosse des Tonga (Horizon) | −23.28 / −174.75 | −10 800 | −10 565 *(z6)* | +235 | 2,2 % | −10 774 | −10 544 |
| abyssale | Plaine abyssale Atlantique central | 35 / −50 | −5 200 | −5 431 *(z6)* | −231 | 4,4 % | −5 374 | −5 374 |
| abyssale | Plaine abyssale d'Angola | −15 / 3 | −5 100 | −5 560 *(z7)* | −460 | 9,0 % | −5 558 | −5 558 |
| abyssale | Bassin central Pacifique | 10 / −150 | −5 300 | −5 167 *(z7)* | +133 | 2,5 % | −5 140 | −5 140 |
| abyssale | Bassin de Somalie ⚠️ | 0 / 55 | −5 000 | −3 555 *(z7)* | +1 445 | 28,9 % | −3 663 | −3 663 |
| dorsale | Dorsale médio-atlantique nord ⚠️ | 30 / −41.5 | −2 700 | −4 229 *(z6)* | −1 529 | 56,6 % | −4 232 | −4 232 |
| dorsale | Dorsale médio-atlantique sud | −25 / −13.5 | −2 800 | −2 493 *(z7)* | +307 | 11,0 % | −2 488 | −2 488 |
| dorsale | Dorsale Pacifique Est | −15 / −113 | −2 700 | −2 866 *(z7)* | −166 | 6,1 % | −2 800 | −2 800 |
| dorsale | Dorsale de Reykjanes ⚠️ | 58 / −32 | −2 000 | −1 273 *(z6)* | +727 | 36,4 % | −1 301 | −1 301 |
| plateau | Manche (au large de Portland) | 50 / −1.5 | −60 | −66 *(z6)* | −6 | 10,0 % | **−71** | **0** |
| plateau | Mer du Nord (Dogger Bank) | 55 / 3 | −40 | −23 *(z6)* | +17 | 42,5 % | −23 | −23 |
| plateau | Plateau du golfe de Gascogne | 46 / −3 | −100 | −113 *(z6)* | −13 | 13,0 % | −120 | −105 |
| plateau | Plateau au large de Chesapeake ⚠️ | 37 / −74.5 | −40 | −1 339 *(z6)* | −1 299 | 3 247 % | −1 376 | −1 456 |
| plateau | Grand Banc de Terre-Neuve | 45 / −50 | −80 | −65 *(z6)* | +15 | 18,8 % | −58 | −65 |
| mer fermée | Méditerranée, plaine ionienne | 35.5 / 19 | −4 000 | −3 681 *(z6)* | +319 | 8,0 % | −3 699 | −3 699 |
| mer fermée | Mer Noire (centre) | 43 / 34 | −2 212 | −2 180 *(z6)* | +32 | 1,4 % | **−2 200** | **0** |
| mer fermée | Caspienne sud | 38.5 / 51.5 | −1 053 | −520 *(z6)* | +533 | 50,6 % | **−590** | **−28** |
| lac | Lac Baïkal (le plus profond) | 53.5 / 108.1 | −1 187 | **+449** *(z6)* | +1 636 | 137,8 % | +455 | +455 |
| lac | Lac Tanganyika | −6 / 29.6 | −697 | **+767** *(z7)* | +1 464 | 210,0 % | +770 | +770 |
| lac | Lac Supérieur | 47.5 / −87.5 | −223 | **+179** *(z6)* | +402 | 180,3 % | +183 | +183 |
| lac | Crater Lake (Oregon) | 42.94 / −122.11 | +1 289 | **+1 854** *(z6)* | +565 | 43,8 % | +1 882 | +1 882 |
| lac | Léman (Grand Lac) | 46.45 / 6.55 | +63 | **+366** *(z6)* | +303 | 481,0 % | +372 | +372 |

⚠️ **Quatre points portent une référence, pas une mesure, et la mesure a raison.**
Bassin de Somalie (0°, 55° E) est **sur le plateau des Seychelles**, pas dans le
bassin ; Chesapeake (37°, −74,5°) est **au-delà de la rupture de pente**, sur le
talus ; la dorsale médio-atlantique à 30° N tombe dans un **sillon**, Reykjanes à
58° N sur un **flanc**. Globe et crop y donnent la même valeur à 110 m près :
c'est ma coordonnée qui est fausse, pas la donnée. Je les laisse dans le tableau
avec leur marque — **les retirer aurait embelli la moyenne de 250 m.**

### Moyennes par régime, à 2 500 km

| régime | globe, \|écart\| moyen | écart % moyen | crop, \|écart\| moyen | **globe − crop** |
|---|---|---|---|---|
| fosse (4) | 202,5 m | 2,1 % | 207,5 m | **5,0 m** |
| plaine abyssale (4) | 567,3 m | 11,2 % | 532,3 m | **35,0 m** |
| dorsale (4) | 682,3 m | 27,5 % | 660,8 m | **21,5 m** |
| plateau continental (5) | 270,0 m | 666 % | 281,2 m | **11,2 m** |
| mer fermée (3) | 294,7 m | 20,0 % | 258,7 m | **36,0 m** |
| lac (5) | 874,0 m | 210,6 % | 883,4 m | **9,4 m** |
| **tous (25)** | **496,5 m** | — | **488,0 m** | **8,5 m** |

---

## ② LE VERDICT SUR L'HYPOTHÈSE DU SOCLE

### ⛔ FAUSSE telle qu'elle est écrite — le chiffre : **8,5 m**

> *« Depuis que la sphère est le mode par défaut, l'océan affiché est du
> terrarium brut, sans aucune des quatre sources. »*

Sur 25 points, le globe se trompe en moyenne de **496,5 m** et le crop de
**488,0 m**. **8,5 m d'écart entre les deux.** Si le globe montrait du terrarium
nu et le crop de la bathymétrie fusionnée, cet écart se compterait en milliers de
mètres. Il ne se compte pas.

**La raison, décodée et non supposée** (③ ci-dessous) : **le terrarium brut n'est
pas muet en mer** à ces zooms. Les tuiles AWS `elevation-tiles-prod` que le globe
demande à z3–z10 portent de l'**ETOPO1**, c'est-à-dire une vraie bathymétrie à
~1 850 m. La fusion GEBCO n'y change presque rien : **sur 17 points sur 25, le
crop `bathy: true` et le crop `bathy: false` rendent le MÊME nombre au mètre
près.** La cascade n'était donc pas ce qui tenait l'océan debout au repos.

### ✅ VRAIE en approche, à partir de z11 — le chiffre qui tranche : **7 105 m**

Le même point, la même session, quatre altitudes, le globe lu au GPU et le crop
lu **au zoom que le globe vient de choisir** :

| lieu | 250 km | 110 km | 60 km | 30 km | crop (tous zooms) | référence |
|---|---|---|---|---|---|---|
| Fosse de la Sonde | −7 067,6 *(z10)* | **0,0** *(z11)* | **0,0** *(z12)* | **0,0** *(z13)* | −7 105 | −7 290 |
| Mer Noire | −2 194,1 *(z10)* | **0,0** *(z11)* | **0,0** *(z12)* | **0,0** *(z13)* | −2 200 | −2 212 |
| Méditerranée ionienne | −3 696,8 *(z10)* | **0,0** *(z11)* | **0,0** *(z12)* | **0,0** *(z13)* | 0 ⚠️ | −4 000 |
| Manche | −68,0 *(z10)* | −68,0 *(z11)* | −68,0 *(z11)* | — | −72 | −60 |
| Caspienne | **−29,0** *(z10)* | **−29,0** *(z11)* | −28,0 *(z12)* | — | −594 | −1 053 |

**Le seuil est net et reproductible : z10 → juste, z11 → zéro.** Ce n'est pas
Mapterhorn (à z11 la tuile fait encore 256 px, donc AWS) : c'est que **le
terrarium, quelle que soit sa source, cesse de décrire la mer au-delà de z10**,
et que le globe n'a **rien** pour prendre le relais. Le crop, lui, a
`fuseBathymetry` + `overzoomTile` : il tient −7 105 m jusqu'à z13.

**Écart globe / crop à z11, fosse de la Sonde : 7 105 m. C'est le chiffre du
rapport.**

### ⚠️ Et un défaut que le socle n'annonçait pas : la Caspienne dès z8

Le globe rend **−29 m** dès z8 là où le fond est à −1 053 m. Ce n'est pas un
zéro : c'est **l'aplat de remplissage de la source fine**, calé sur le niveau de
la Caspienne (−28 m). `bathy.js` sait le reconnaître (`detectFillLevels`,
`FILL_SHARE`) — mais `bathy.js` n'est pas dans le chemin du globe. **1 024 m
d'erreur, deux zooms plus tôt que les autres.**

---

## ③ LE RELEVÉ RÉSEAU — requête par requête, au protocole

`node scripts/sonde-b1.mjs --scenario reseau`, trois zones, 15 s de vol chacune,
compté par `Network.requestWillBeSent` / `responseReceived`.

### Ce que demande le GLOBE

| zone | AWS terrarium | Mapterhorn | **/data/bathy/** | EMODnet | BlueTopo |
|---|---|---|---|---|---|
| EMODnet — Manche / mer du Nord (51°, 1,5° E) | 44 · 200 | 0 | **0** | 0 | 0 |
| BlueTopo — côte est des É.-U. (37°, −74,5°) | 74 · 200 | 0 | **0** | 0 | 0 |
| large — plaine abyssale Atlantique (35°, −50°) | 71 · 200 | 0 | **0** | 0 | 0 |

Et au compteur `window.fetch` (scénario `fusion`, 54 s de vol) : **544 tuiles
d'altitude, 0 tuile bathymétrique.**

**189 tuiles d'altitude demandées, zéro tuile bathymétrique.** Le globe ne
consulte **jamais** `data/bathy/index.json` ni une seule tuile de la cascade —
établi par le réseau, pas par la lecture du code. La moitié structurelle de
l'hypothèse du socle est donc **confirmée** ; c'est sa conséquence chiffrée qui
ne l'était pas.

### Ce que demande le CROP, au même endroit (`loadDem` z10)

| zone | ce qu'il demande, dans l'ordre |
|---|---|
| Manche | `mapterhorn/17,16,15,14,13` → **404** · `mapterhorn/12/2066/1370` → 200 · `mapterhorn/10/516/342` → 200 · **`/data/bathy/10/516/342.png` → 200, 20 702 o** |
| Chesapeake | `mapterhorn/17…12` → **404 ×6** · `aws/terrarium/10/300/398.png` → 200 · **`/data/bathy/8/75/99.png` → 200, 32 768 o** |
| Atlantique | `mapterhorn/17…12` → **404 ×6** · `aws/terrarium/10/369/405.png` → 200 · **`/data/bathy/8/92/101.png` → 200** puis **`/data/bathy/7/46/50.png` → 200** (la descente de `loadBathyPatch`) |

### La cascade DÉCLARÉE n'est pas la cascade CUITE

`public/data/bathy/index.json`, tel que le serveur le rend :

```json
{"version":1,"base":{"source":"gebco","zmax":8},"zmin":4,
 "zones":[{"id":"fr-metro","source":"emodnet","zmax":10,"bbox":[-6,41,10,52]}]}
```

**Une seule zone.** Le disque le confirme — 21 556 tuiles :
z4 : 189 · z5 : 556 · z6 : 1 499 · z7 : 4 490 · **z8 : 13 891** (le socle GEBCO
mondial) · **z9 : 223 · z10 : 708** (EMODnet, France métropolitaine seulement).

`bathy-sources.js` catalogue **quatre** fournisseurs. **BlueTopo (z12, 2–16 m) et
Copernicus (100 m) n'ont aucune zone et aucune tuile.** Sur la côte est des
États-Unis, le plafond retombe donc au socle GEBCO **z8, soit 498 m de résolution
au lieu des 16 m annoncés** — et c'est vrai **sur les deux chemins**, crop
compris. Aucune URL EMODnet, BlueTopo, NOAA ou Copernicus n'est jamais demandée à
l'exécution : ces sources sont cuites hors ligne, et trois des quatre ne l'ont
jamais été.

⚠️ **`npm run deploy` n'appelle pas `build:bathytiles`.** Les tuiles ne survivent
que parce qu'elles dorment sur le disque de la machine qui déploie ;
`verifie:dist` les compte (`data/bathy: 20000`) et c'est le seul filet.

---

## ④ CE QUE LE DÉFAUT DONNE À L'ŒIL, ET LE CONTRASTE

Trois captures pleine résolution, avant tout correctif, dans `.banc/B1/` :

- **`fosse-java.png`** — fosse de la Sonde, 110 km (z11). **Un aplat vert uni sur
  tout l'écran.** La fosse la plus profonde de l'océan Indien est peinte à la
  couleur de terre du niveau zéro : pas de mer, pas de relief, pas de rampe
  bathymétrique. C'est la capture qui vaut la démonstration.
- **`plateau-manche.png`** — Manche, 200 km (z10). **Correct** : le Cotentin,
  les hauts-fonds, la teinte de mer. C'est l'acquis à ne pas casser.
- **`lac-baikal.png`** — Baïkal, 200 km (z10). **Une dalle parfaitement plate**
  à la couleur du terrain de +449 m, encastrée entre les montagnes. Ni trou, ni
  eau, ni fond : une plaine.

### Le contraste, en mètres — étendue max − min sur 9 × 9 texels, lue au GPU

⚠️ **Sur la grandeur demandée.** Le brief attribue à R18 un peigne « 0,0198 /
0,0032 ». Ces nombres **ne sont pas dans `rapport-R18.md`** : `grep` les trouve
dans `notation-01.md`, où ce sont des **pourcentages d'appariement de pixels**
entre deux cadrages. Il n'y a pas de grandeur R18 à reprendre. Je publie donc le
contraste **en mètres**, ce que le brief exige par ailleurs de tout seuil.

| lieu | z10 (globe / crop) | **z11 (globe / crop)** | z12 (globe / crop) |
|---|---|---|---|
| Fosse de la Sonde | 42,66 / 5,00 | **0,00** / 3,00 | **0,00** / 1,00 |
| Mer Noire | 12,66 / 4,00 | **0,00** / 2,00 | **0,00** / 1,00 |
| Méditerranée ionienne | 13,39 / 7,00 | **0,00** / 0,00 ⚠️ | **0,00** / 0,00 |
| Manche | 1,31 / 5,00 | 0,69 / 3,00 | — |
| Caspienne | **0,00** / 9,00 | **0,00** / 5,00 | **0,00** / 2,00 |
| Baïkal | **0,00** / 0,00 | **0,00** / 0,00 | — |

**« 0,00 m sur 9 × 9 texels » n'est pas un fond lisse : c'est l'absence de
donnée.** Aucun fond marin réel ne vaut la même valeur au mètre près sur neuf
texels consécutifs. Le crop garde 1 à 5 m partout où il a une tuile.

⚠️ **Le crop n'est pas innocent : la plaine ionienne tombe à 0 m elle aussi dès
z11**, alors que la mer Noire tient à −2 200 m au même zoom. C'est un défaut
côté crop, distinct, et le correcteur doit le traiter séparément — sinon il
« corrigera » le globe en le raccordant à un crop qui a le même trou.

---

## ⑤ LES LACS — l'état de départ

**Ce n'est ni un trou, ni de la terre : c'est le niveau de la surface, à ±7 m,
partout, à tous les zooms, sur les deux chemins.**

| lac | surface | fond réel | globe (GPU) | crop | **manque** | étendue 9×9 |
|---|---|---|---|---|---|---|
| Baïkal | +456 m | −1 187 m | **+449 m** | +455 m | **1 636 m** | 0,00 m |
| Tanganyika | +773 m | −697 m | **+767 m** | +770 m | **1 464 m** | 0,00 m |
| Supérieur | +183 m | −223 m | **+179 m** | +183 m | **402 m** | 0,00 m |
| Crater Lake | +1 883 m | +1 289 m | **+1 854 m** | +1 882 m | **565 m** | 0,00 m |
| Léman | +372 m | +63 m | **+366 m** | +372 m | **303 m** | 0,00 m |

⚠️ **La table du socle donne des PROFONDEURS, pas des altitudes de fond, et les
confondre inverse la conclusion.** Le Léman fait 309 m de fond mais son lit est à
**+63 m au-dessus du niveau de la mer** : y écrire « −310 m » ferait couler le
lac 373 m trop bas. J'ai converti les cinq lacs (surface − profondeur) et je
donne les deux nombres. Idem pour la Caspienne : surface −28 m, fond 1 025 m plus
bas, soit **−1 053 m**.

**Ce qu'il y a à remplacer, pour B2/B3** : rien à retirer. Les cinq lacs sont des
**plaques strictement plates** (étendue 9 × 9 = 0,00 m sur les deux chemins, à
tous les zooms testés). Une source de fonds de lacs n'a donc **aucun relief
existant à écraser** — elle n'a qu'à creuser sous une surface constante, ce qui
est exactement le contrat de `fuseBathymetry` (« la source fine ne peut que
creuser sous le niveau, jamais émerger »). **La condition d'Adrien — « si ça
n'implique pas de refondre le relief des tuiles existantes » — est remplie, et
c'est mesuré, pas espéré.**

---

## ⑥ LES TESTS ROUGES

`test/attaque-b1-ROUGE.mjs` — **hors** de la liste `test` de `package.json`
(`audit:tests` reste à 252 = 252). La commande est en tête du fichier :

```
npm run dev -- --host 127.0.0.1 --port 6311
node --test test/attaque-b1-ROUGE.mjs
```

**Sept tests, sept rouges**, chacun sur un défaut confirmé et **chaque seuil en
mètres de profondeur ou en nombre de requêtes** — aucune unité interne, aucun
ratio : un correctif ne peut pas les verdir en changeant une échelle de rampe ou
un uniforme.

| test | seuil | ce qu'il rend aujourd'hui |
|---|---|---|
| **B1-1** fosse de la Sonde à 110 km | fond ≤ **−6 000 m** | `globe 0.0 m à z11 (crop −7 105 m, référence −7 290 m)` |
| **B1-2** accord globe / crop, mer Noire, 3 altitudes | écart ≤ **200 m** | `à 110 km (z11) : globe 0.0 m, crop −2 200 m — écart 2 200,0 m` |
| **B1-3** le fond n'est pas un aplat | étendue 9 × 9 ≥ **5 m** | `Java @110 km (z11) : étendue = 0.00 m (crop : 3 m)` |
| **B1-4** Caspienne | fond ≤ **−800 m** | `globe −29.0 m à z11 (crop −593 m, référence −1 053 m)` |
| **B1-5** les lacs ont un fond | ≥ **100 m** sous la surface | `Baïkal : globe 449.0 m, soit 7,0 m sous la surface (+456 m)` |
| **B1-6** le globe consulte la cascade | ≥ **1** requête `/data/bathy/` par zone | `44 tuiles d'altitude demandées, 0 tuile bathymétrique` |
| **B1-7** cascade déclarée = cascade cuite | **0** source sans zone | `absentes de l'index : bluetopo, copernicus` |

B1-1 à B1-5 partagent **une seule session de navigateur** (mémoïsée) : le pixel
n'est déterministe qu'en orbite, et l'A/B doit se faire dans la même session.

---

## ⑦ LE BARÈME POUR B4 — sept critères, 10 points

Adrien exige **7,5 / 10**. Ce barème est écrit pour que 7,5 se mérite : les
critères ①②③ pèsent 6 points à eux seuls et **aucun n'est atteignable en câblant
le globe sur un crop qui a le même trou**.

| # | critère | mesure | seuil « acquis » | points |
|---|---|---|---|---|
| **1** | **Le fond existe en approche** | `attaque-b1-ROUGE` B1-1, fosse de la Sonde à 110 km (z11), lue au GPU | fond ≤ **−6 000 m** (aujourd'hui **0,0 m**). Partiel : ≤ −3 000 m → 1 pt | **2,5** |
| **2** | **Globe et crop s'accordent** | B1-2, mer Noire à 250 / 110 / 60 km, même session | écart ≤ **200 m aux trois altitudes** (aujourd'hui **2 200 m** à z11). Partiel : ≤ 500 m → 1 pt | **2,0** |
| **3** | **Le fond porte du relief, pas un aplat** | B1-3, étendue max − min sur 9 × 9 texels, au GPU | ≥ **5 m** sur Java z11, mer Noire z11 **et** z12 (aujourd'hui **0,00 m**). Un seul point à 0,00 m → 0 | **1,5** |
| **4** | **La cascade est vivante sur le globe** | B1-6, comptage réseau au protocole | ≥ **1** requête `/data/bathy/` **dans les trois zones** (aujourd'hui **0 / 189**) | **1,5** |
| **5** | **Les mers fermées et la Caspienne** | B1-4 + relevé Méditerranée / mer Noire aux quatre altitudes | Caspienne ≤ **−800 m** ; Méditerranée et mer Noire à **≤ 300 m** de leur référence **à z11 et z12** — ⚠️ **y compris sur le crop**, dont la plaine ionienne tombe déjà à 0 m | **1,0** |
| **6** | **Les lacs** | B1-5 | Baïkal **et** Léman ≥ **100 m** sous leur surface (aujourd'hui 7 m et 6 m). Si B2 ne trouve pas de source : **acquis quand même** si le globe descend au niveau du crop et que le rapport le documente | **0,5** |
| **7** | **Rien n'a été payé ailleurs** | `npm test` **4 748 · 0**, `audit:tests` **sans écart**, `git diff` propre, **et** la Manche à z10 reste à −68 ± 5 m et le Cotentin au même pixel (`plateau-manche.png`) | tout ou rien — **une régression du trait de côte annule le critère** | **1,0** |

**Règles de notation, pour qu'elles ne se contournent pas :**

- ⛔ **Une mesure lue autrement qu'au GPU ne compte pas.** `t.heights` est
  relâché dès le maillage bâti (`globe.js:8243`) : une lecture « côté code »
  ne voit pas ce que l'écran montre. R36 a démasqué un défaut majeur exactement
  là, et `gl.getError()` rendait 0.
- ⛔ **Un critère n'est acquis que si la valeur tient à z11 ET à z12.** Le défaut
  naît à z11 ; un correctif calé sur z11 seul le repousserait d'un cran.
- ⛔ **« Le globe rend la même chose que le crop » ne suffit pas au critère 5** :
  le crop rend 0 m dans la plaine ionienne à z11. Les deux doivent être justes.
- ⛔ **Le critère 7 est éliminatoire pour la moitié haute de la note** : sans lui,
  le plafond est **6,5**.

---

## ⑧ CE QUE J'AI CRU PUIS RÉFUTÉ

- ⛔ **« `public/data/bathy/` n'existe pas, donc la cascade est morte pour tout le
  monde, crop compris. »** C'est ce que montrait l'arbre au premier `ls`, et
  j'allais l'écrire. **C'est le worktree qui était nu, pas le produit** : le clone
  de déploiement porte **21 556 tuiles** et l'index. Le socle prévient qu'un banc
  différentiel ne distingue pas « rien n'a changé » de « tout est cassé pareil » ;
  ici c'était « l'établi est vide » qui se déguisait en « le produit est cassé ».
  **Une heure de plus, et c'était le neuvième faux constat.**
- ⛔ **« Le globe montre du terrarium brut, donc de l'eau plate. »** L'hypothèse de
  tête, et je l'ai crue en ouvrant `globe.js` (il n'importe bien que
  `overzoomTile` de `bathy.js`). **Mesuré : faux au repos.** Le terrarium AWS
  **porte de l'ETOPO1 jusqu'à z10** — vraie bathymétrie à ~1 850 m. Preuve
  indépendante : `bathy: true` et `bathy: false` rendent le **même nombre sur 17
  points sur 25**. La cascade ne tenait pas l'océan debout ; c'est le repli AWS
  qui le tenait.
- ⛔ **« Le coupable est Mapterhorn, muet en mer, quand il prend le relais à
  z12. »** Séduisant, et documenté dans `bathy.js` (« au large de Toulon à z12,
  100 % à zéro exact »). **Faux d'un cran : le zéro arrive à z11, sur une tuile de
  256 px, c'est-à-dire encore AWS.** C'est le terrarium *en général* qui cesse de
  décrire la mer au-delà de z10 — pas une source en particulier. Un correctif
  visant Mapterhorn aurait laissé z11 cassé.
- ⛔ **« Le crop est juste, il suffit de brancher le globe dessus. »** Le crop rend
  **0 m dans la plaine ionienne à z11**, exactement comme le globe, alors qu'il
  tient −2 200 m en mer Noire au même zoom. Le raccordement seul livrerait une
  régression déguisée en correctif — d'où le critère 5 du barème.
- ⛔ **« Le peigne de R18 vaut 0,0198 / 0,0032, je reprends sa grandeur. »** Le
  brief le dit ; `grep` dit non. **Ces nombres ne sont pas dans `rapport-R18.md`**
  — ce sont des pourcentages d'appariement de pixels de `notation-01.md`. J'ai
  publié le contraste en mètres plutôt que d'inventer une continuité.
- ⛔ **« La vérité terrain du socle est une liste d'altitudes de fond. »** Ce sont
  des **profondeurs**. Pour les cinq lacs et la Caspienne, altitude de fond =
  surface − profondeur : le lit du Léman est à **+63 m**, pas à −310 m ; celui de
  Crater Lake à **+1 289 m**. Prise au pied de la lettre, la table aurait fait
  paraître le Léman 373 m trop haut et conclu à un défaut inverse du vrai.
- ⛔ **« Le coordinateur a raison : `flux-terrain.js` fusionne, donc le globe
  fusionne. »** Je l'ai cru en lisant son message, et l'import est bien là
  (`flux-terrain.js:157`). **Mesuré : 544 tuiles d'altitude contre 0 tuile
  bathymétrique en 54 s de mode sphère.** `remplirHauteurs` n'a que deux
  appelants — la **fenêtre bornée** et le **champ de la mer** — et aucun n'est le
  pipeline de tuiles du globe. Un import n'est pas un appel, et un appel dans le
  module voisin n'est pas un appel dans le chemin qu'on regarde.
- ⛔ **« Mes relevés sont à jeter, l'arbre était vide. »** Il l'était ; je l'avais
  réparé avant la première sonde, et le relevé réseau le prouve tout seul
  (`/data/bathy/10/516/342.png → 200, 20 702 octets`). **J'ai failli les refaire
  sur ordre** — deux heures de banc pour retrouver les mêmes nombres.
- ✅ **Ce que je confirme du socle** : le globe **ne demande jamais** une tuile
  bathymétrique (0 sur 189 requêtes, compté au protocole) ; Mapterhorn rend bien
  404 en mer (6 sur 6 hors zone couverte) ; et la lecture au GPU était
  indispensable — `t.heights` est relâché, et `gl.getError()` a rendu **0** à
  chacune de mes 130 lectures, y compris sur les aplats à 0,00 m.

---

## ⑨ RESTE OUVERT

- ⚠️ **Le crop tombe à 0 m dans la plaine ionienne à partir de z11** (mais pas en
  mer Noire). Non diagnostiqué : c'est un défaut du surzoom bathy ou de la sortie
  anticipée `if (s >= level)` de `fuseBathymetry`, à part du défaut du globe.
- ⚠️ **`npm run deploy` n'appelle jamais `build:bathytiles`.** Les 21 556 tuiles
  ne tiennent que par le disque local de la machine de déploiement. Même classe
  de défaut que le `build:mapcells` du 2026-08-05.
- ⚠️ **BlueTopo et Copernicus sont catalogués, crédités et testés, mais jamais
  cuits.** `creditsForBounds` ne les citera jamais — ce qui est juste, mais rend
  la promesse « 2–16 m sur la côte est » caduque.
- Les sondes restent : `scripts/sonde-b1.mjs --scenario points | descente |
  reseau | vue`. Les relevés bruts sont dans `.banc-b1-*.json`, les captures dans
  `.banc/B1/`.
