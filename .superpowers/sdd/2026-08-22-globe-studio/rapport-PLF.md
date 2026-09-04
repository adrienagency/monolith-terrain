# RAPPORT PLF — LE PLAFOND DE FINESSE : LE DÉFAUT EST ÉTEINT

Branche `plafond-finesse` (arbre `C:\Dev\wt-plf`).

## ⚡ VERDICT : **A — LE DÉFAUT A DISPARU. JE N'AI RIEN POSÉ.**

`_zoomCropEcran` (fusion CULL, `5c73e06`) **est** le plafond de finesse fonction
de l'altitude que cette tâche demandait. Mesuré dans l'application, crop vivant
à 130 km d'altitude de cadrage, Majorque, CPU ×4, 20 images consécutives au
repos (`scripts/sonde-plf.mjs`) :

| grandeur | **débrayé** (le dépôt d'avant CULL ⑤) | **le dépôt d'aujourd'hui** |
|---|---|---|
| **cache occupé, p50** (plafond dur 1 700) | **1 672 / 1 700 — saturé** | **454** |
| `_credit` p50 | **87** | 1 323 |
| longueur de file p50 | **162** | **0** |
| tuiles parcourues par image, p50 | 2 909 | **399** |
| `_traverse` p50 / p99 (ms) | 11,1 / 15,4 | **1,7 / 2,7** |
| `update` p50 / p99 (ms) | 13,0 / 18,2 | **2,4 / 3,3** |
| **ms/image p50 / p99 à CPU ×4** | **136,5 / 163,7** | **27,3 / 33,4** |
| niveaux DESSINÉS dans l'emprise | 9, 10, 11, 12, 13 — **cinq** | **11 — un seul** |
| borne d'écran (`_zCropEcran`) | — (débrayée) | **z11** |

**×3,7 sur le cache, ×7,3 sur le parcours, ÷5,0 sur le temps d'image**, et les
trois marqueurs de saturation (`cacheMax` atteint, `_credit` au plancher, file
pleine) **disparaissent tous les trois**. Le brief espérait 44,1 → 11,9 ms sur
son banc ; le mien rend 136,5 → 27,3. Les deux bancs ne se comparent pas — la
grandeur qui se compare est la **nature** du plafond, et elle est la même.

⛔ **Poser un second plafond ici serait de la dette pure**, et pire : le socle du
chantier dit que desserrer ou resserrer un budget au mauvais moment donne ×14 sur
les requêtes. Je n'ai touché **ni à `globe.js`, ni à un budget, ni à un seuil**.

## 1. LE BANC — et en quoi il diffère de la production

`scripts/sonde-plf.mjs` (neuf). Chrome sans tête (`--headless=new`,
`--use-angle=default`), 1280×720, `devicePixelRatio` 1, `vite` de dev sur
**127.0.0.1:8837**, **CPU ×4** (`Emulation.setCPUThrottlingRate`), réseau compté
au protocole CDP. Traces : `.banc/PLF/*.json` (ignoré par git).

**Le geste, et c'est lui qui fait la mesure :**
1. démarrage complet, voile `.ce-hubveil` retiré, **attente que le vol de
   démarrage soit immobile** (il se pose entre 30,7 et 33,6 km, à cheval sur
   `SEUIL_BLOC_M` : mesurer avant, c'est un faux constat en puissance) ;
2. `_rescale({lieu, zoom: 13})` → **le crop NAÎT au bloc** (4 416 m). Vérifié et
   journalisé (`cropAuBloc`) ;
3. `_rescale({lieu, zoom: 9})` → le bloc, donc l'emprise du crop, prend la
   taille de l'altitude visée ;
4. la caméra est **glissée le long de son axe** jusqu'à 130 000 m d'altitude de
   cadrage. Ce n'est **pas un geste de dézoom**, donc D21 ① ne tue pas le crop :
   vérifié et journalisé (`cropEnHaut`). C'est la pose de `profil-pf1.mjs` ;
5. attente du calme, puis **20 images consécutives**, relevées **DANS `update()`
   et DANS `_traverse`**, jamais après.

**Différences avec la production, à écrire pour que le chiffre se compare :** le
niveau du bloc est posé par `_rescale` et non atteint à la molette ; il n'y a
donc pas l'historique de cache d'une vraie descente. Les deux colonnes du
tableau partagent ce banc exactement — seul `g.cropZoomEcran` change.

⚠️ **Le compteur de tuiles parcourues est posé dans `_dansLeChamp`**, au moment
de la décision, et le chronomètre de `_traverse` à la racine de la récursion
(compteur de profondeur), pas à chaque nœud.

## 2. CE QUE J'AI CRU PUIS RÉFUTÉ

1. ⚠️ **« Il suffit de monter la caméra pour reproduire le défaut » — FAUX, et
   ce premier tirage m'aurait fait signer « A » pour la mauvaise raison.**
   Monter la caméra de 4,4 km à 130 km **sans re-poser le bloc** laisse le crop
   à son emprise de bloc z13 : `demi = 0,000183`, soit **14,7 km de large**. Le
   relevé rendait alors **236 tuiles de cache et 16,6 ms/image LEVIER DÉBRAYÉ** —
   c'est-à-dire « pas de défaut » dans le dépôt d'avant le correctif, ce qui est
   faux. **L'emprise du crop n'est pas l'altitude : c'est le bloc courant**
   (CULL §2), et sans la re-poser on mesure une scène minuscule. C'est le §3 de
   `/threejs-optimisation`, « prouver d'abord qu'on regarde quelque chose »,
   appliqué à l'emprise et non aux pixels. La sonde porte depuis
   `--zoomhaut` et refuse la cellule si `cropAuBloc` ou `cropEnHaut` est faux.
2. **« Le plafond de `_zoomCropEcran` pourrait être un plafond fantôme »** — le
   piège du `MAX_Z = 11` qui valait 15. Balayé dans l'application sur **un
   facteur 20 d'altitude** : 60 km → **z12**, 130 → **z11**, 300 → **z9**,
   600 → **z8**, 1 200 → **z7**. La sortie bouge à chaque palier, et le cache
   reste entre **283 et 454** tuiles sur toute la plage. Ce n'est pas une
   constante morte.
3. **« Une seule finesse par image, c'est ce que le banc de papier doit
   rendre »** — non : à banc de papier, 60 images, `fetch` immédiat, le crop
   porte **4 niveaux** parce que les parents sont encore dessinés sous leurs
   enfants (la pile de raffinement, pas un éventail de finesses). Dans
   l'application, **au repos**, il en porte **un**. Écrire `=== 1` dans le test
   aurait été un verrou faux ; le test tient la **comparaison à banc identique**
   (débrayé, l'éventail s'élargit strictement).
4. **« Recopier dans le test les niveaux relevés dans l'application »** — écrit,
   puis rouge de naissance : à 60 km le banc de papier rend **z13** là où
   l'application rend **z12**. La caméra du test vise au **nadir exact**, celle
   du produit est de **trois quarts** et son crop est décalé ; un niveau
   d'écart. Le test tient donc la **forme** (décroissance, ampleur ≥ 5 niveaux,
   neutralité au bloc), et les valeurs de l'application restent dans l'en-tête,
   avec leur banc.

## 3. LES DEUX INVARIANTS DU BRIEF, VÉRIFIÉS QUAND MÊME

**⛔ Rien ne change à l'altitude de travail — identique, et ce n'est pas un
argument, c'est un relevé.** Majorque, 5 004 m, CPU ×4, 20 images, les deux
leviers, même banc :

| | levier ON | levier OFF |
|---|---|---|
| cache p50 | **122** | **122** |
| `_credit` p50 | **1 623** | **1 623** |
| tuiles parcourues p50 | **59** | **59** |
| `_traverse` p50 (ms) | 0,2 | 0,2 |
| niveau dessiné dans le crop | **13** | **13** |
| `_zCropEcran` | **13** (= `ZOOM_SOCLE`) | 0 (débrayé) |

La borne vaut exactement `ZOOM_SOCLE` au bloc : la prescription y est celle du
dépôt d'avant, **au bit près**, et le relevé le confirme sur toutes les
grandeurs.

**Une seule finesse par image, aux trois lieux.** Crop vivant à 130 km, levier
ON, 20 images au repos :

| lieu | cache p50 | `_credit` | file | parcourues | `_traverse` p50/p99 | ms/image p50 | niveaux dessinés |
|---|---|---|---|---|---|---|---|
| Majorque | **454** | 1 323 | 0 | 399 | 1,7 / 2,7 | 27,3 | **11** |
| Bretagne | **287** | 1 510 | 0 | 109 | 0,6 / 0,8 | 16,7 | **10** |
| Alpes | **314** | 1 480 | 0 | 109 | 0,6 / 1,3 | 16,7 | **10** |

16,7 ms/image, c'est la cadence de l'écran : à Bretagne et aux Alpes le crop à
130 km **ne coûte plus rien de mesurable**.

## 4. LA PLAGE, ET LE PLAFOND JAMAIS ATTEINT

Majorque, levier ON, CPU ×4, 20 images au repos par altitude :

| altitude de cadrage | `_zCropEcran` | cache p50 | `_credit` | file | parcourues | `_traverse` p50 | ms/image p50 |
|---|---|---|---|---|---|---|---|
| 5 km (le bloc) | 13 | 122 | 1 623 | 0 | 59 | 0,2 | 16,6 |
| 60 km | **12** | 422 | 1 350 | 0 | 403 | 1,3 | 17,7 |
| **130 km** | **11** | **454** | 1 323 | 0 | 399 | 1,7 | **27,3** |
| 300 km | **9** | 315 | 1 480 | 0 | 107 | 0,6 | 16,7 |
| 600 km | **8** | 293 | 1 499 | 0 | 111 | 0,5 | 16,8 |
| 1 200 km | **7** | 283 | 1 506 | 0 | 118 | 0,6 | 16,7 |

⚡ **`CACHE_MAX_CONTINU` (1 700) n'est approché nulle part** : le maximum sur
toute la plage vaut **454**, soit **27 %** du budget. Le pire point est 130 km,
et c'est cohérent : c'est l'altitude où l'emprise est encore large **et** la
finesse encore fine. C'est bien le point qu'il fallait mesurer.

## 5. LES TESTS — `test/crop-plafond-altitude.test.js`, 3 tests, ils MORDENT

Inscrit à la liste explicite de `package.json`.
`npm run audit:tests` : **266 listés · 266 sur disque, aucun écart.**
`npm test` : **4 920 tests · 4 920 réussis · 0 échec** (base 4 917 + 3).

- **①** le point de PLF : crop vivant à 130 km, `demZoom` 6 (emprise de
  1 464 km) — la borne d'écran est strictement sous `ZOOM_SOCLE`, le cache reste
  sous `cacheMax`, et **la mutation est DANS le test** : `cropZoomEcran = false`
  fait descendre le maillage plus bas.
- **②** l'éventail des finesses dessinées s'élargit strictement quand on
  débraye, à banc identique.
- **③** la plage entière (30 km → 1 200 km) : décroissance monotone, ampleur
  ≥ 5 niveaux, et `ZOOM_SOCLE` exactement au bloc.

⛔ **MUTATION PROUVÉE, sur le produit et pas sur le test** : `_zoomCropEcran`
forcé à `return ZOOM_SOCLE` dès l'entrée (le défaut d'origine, mot pour mot) fait
rougir **les trois**. `globe.js` a été restauré depuis une copie binaire et
relu : `git diff` vide, encodage UTF-8 sans CRLF.

⚠️ **Et le fichier n'est pas un doublon de `crop-emprise-ecran.test.js`** : celui
de CULL mesure 900 km avec `demZoom` 4 ; PLF mesure **130 km avec `demZoom` 6**,
un autre zoom d'écran (z11 contre z8) et l'altitude à laquelle Adrien s'arrête
et regarde. C'est la plage qui est le sujet.

## 6. CE QUI RESTE, ET CE QUE JE NE SIGNE PAS

- **Je n'ai mesuré que le REPOS.** Le geste de descente continue, lui, est
  couvert par CULL §5 ; PLF est une question de pose, et c'est ainsi qu'elle est
  posée dans le brief (« s'arrêter et REGARDER »).
- **Le fond du défaut vit toujours dans `assietteCrop` (`main.js`)** :
  l'emprise du crop reste la fenêtre du bloc, jusqu'à 6 376 km de large. CULL
  l'écrit déjà ; ma mesure le confirme d'un autre point (à 130 km l'emprise fait
  1 464 km pour un écran qui en montre ~120). Le correctif la rend inoffensive,
  il ne la supprime pas — **tout nouveau lecteur de `_crop.demi` doit se demander
  si son réglage a été mesuré à cette échelle-là.**
- **`ms/image` à 130 km vaut 27,3 contre 16,7 ailleurs** : il reste un coût réel
  au point le plus chargé de la plage, un peu au-dessus de la cadence d'écran à
  CPU ×4. Il ne justifie **pas** un second plafond (le cache est à 27 % de son
  budget : ce n'est plus un problème d'emprise), et je ne propose rien dessus
  sans une plainte d'Adrien qui le nomme.
- **Les trois lieux ont été mesurés une fois chacun au point de 130 km**, pas
  huit ; le critère « 8 chargements » du brief vise le cas B, qui n'a pas eu
  lieu. Ce qui est répété, c'est la **plage** (six altitudes) et la **paire
  avant/après** au point qui décide.
