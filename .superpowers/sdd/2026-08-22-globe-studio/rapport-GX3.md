# GX3 — LE NOTEUR DU TRACÉ GPX : tout remesuré, noté sur 10, et c'est NON

Arbre `C:\Dev\wt-gx3`, branche `gpx-note`. **`git diff -- src/` est vide** : rien
n'a été corrigé. Bancs sous `scripts/banc-gx3-*.mjs` (lib commune
`banc-gx3-lib.mjs`), relevés, JSON et captures sous `.banc/GX3/` (git-ignoré :
tous les chiffres sont recopiés ici). Vite sur `127.0.0.1:10333`.

---

## ⓪ LE VERDICT EN UNE PHRASE

**Le correctif de GX2 fait ce qu'il dit — le tracé est dessiné, au repos et
pendant la lecture, sur les trois tracés, et sa position horizontale est exacte
au pixel — mais il draPE le ruban sur des hauteurs que le GPU ne dessine pas :
au cadrage d'arrivée du Mont-Blanc, le ruban passe jusqu'à 176 m SOUS la
surface rendue et 160 m au-dessus, 673 sommets sur 2 335 sont enterrés de plus
de 5 m, et ça se voit (trait pointillé, cols sans tracé à 25–64 px de leur
vraie place). Ajouté au tracé dessiné dans le vide hors du socle, la note est
**7,5 / 10 — sous le seuil de 9 d'Adrien : je refuse la fusion en l'état.**

---

## ① MON BANC — et en quoi il diffère de ceux de GX1/GX2

Même méthode de comptage (elle est juste) : pixels **par différence** calque
allumé / éteint, témoin A/A, grain et animations coupés, images tirées de la
boucle de l'application par une file de rAF, zone de comptage = la toile
**mesurée au DOM** (bandeau de course, profil et panneaux exclus). Ce que j'ai
changé, parce que la mesure l'exigeait :

| GX1 / GX2 | GX3 | pourquoi |
|---|---|---|
| Lecture par `dispatchEvent` sur `.cb-play` | **clic souris** (`page.mouse.click`) sur « ▶ Lecture » du panneau Parcours | `.cb-play` est **hors écran** au repos (`y = 1155` sur 1 024, mesuré) : le bouton qu'Adrien voit est celui de `ui/mini-route.js` |
| Un seul cadrage (« d'arrivée », 26 484 m, **studio ouvert**, toile 836 px) | **deux régimes** : A = studio ouvert (le leur), B = studio fermé par la croix | la croix appelle `restoreState` : la caméra REVIENT à la vue d'avant le chargement — Adrien lit le tracé en B, GX1/GX2 ont noté en A |
| Lecture en pause entre deux relevés | **gel du temps** (`performance.now` rendu constant, dt = 0) pendant le vol de poursuite | mettre en pause **arrête la poursuite** (`drone.stop()`, main.js:2355) et `play()` par l'API ne la rengage pas : un premier tour a mesuré une caméra plantée en plein vol, le nez dans un versant (188 px). Vérifié : témoin A/A = 0, `drone.active` reste vrai |
| 20 relevés | **40**, deux par image, sur les trois tracés, ET trois changements de vue au milieu (cran de zoom, vue iso, aller-retour en orbite par `modes.flyTo`) | c'était la porte `vue.socle` |
| Drapage contre `terrain.sample` (le MNT du bloc) | **contre la surface RENDUE** : lancer de rayon radial (du ciel vers le centre) sur les maillages de tuiles du globe, tous les 2 335 sommets | « le sol se lit sur le globe » ne dit pas que c'est le sol que le GPU dessine |
| Position : 48 sommets projetés contre les pixels | **cinq points du GPX brut × quatre zooms** (`modes.flyTo` centré), vérité = `latLonToSphere(lat, lon, R + h·échelle)` avec `h` la hauteur dessinée, en **pixels et en mètres** (m/px calculé à la profondeur du point) | « inchangé » n'est pas « juste » |
| — | **hors du socle** : empreinte des quatre coins du bloc projetée, pixels de tracé comptés dedans / dehors | le point du barème que GX2 rend non tenu |

⚠️ **Le régime B dépend du chemin** : `restoreState` rend la caméra d'avant le
studio, c'est-à-dire la vue de démarrage, qui n'est pas la même à chaque
chargement (6 661 m, 7 893 m, 12 286 m, 20 614 m sur quatre lancements au même
Mont-Blanc). Les chiffres B ci-dessous sont donnés avec leur altitude.

### Les écarts avec GX2 — ils priment

| grandeur | GX2 annonce | **GX3 mesure** | écart |
|---|---|---|---|
| Mont-Blanc au repos, régime A | 1 216 – 1 499 px | **1 223 – 1 516 px** (8 relevés, témoin 0) | ✅ concordant |
| Camargue, régime A | 1 440 px | **1 442 px** (100 % des 1 437 attendus) | ✅ |
| Chamonix, régime A | 236 px (témoin 276) | **236 px** (témoin `?terre=deux` : **274**) | ✅ concordant — **et expliqué, § ④** |
| témoin E3 `?terre=deux` Mont-Blanc | 1 283 px | **1 286 px** | ✅ |
| drapage Mont-Blanc | « −4,7 m, inchangé » (contre le bloc, 48 sommets) | contre la surface **rendue**, 2 335 sommets : **moy +9,5 m, min −176 m, max +160 m** (régime B) ; **min −92 m, max +94 m** (régime A) | ⛔ **c'était mesuré contre la mauvaise surface** |
| lecture | 0/20 sans tracé, compte monotone | figée : 0/40 sur les trois tracés, monotone en vue entière (805 → 943) ; poursuite : **1/40 à 0 px** au second vol du Mont-Blanc (tête derrière la caméra) ; Chamonix : 242 px **d'étiquettes seules**, ruban invisible | ⚠️ tenu par la lettre, pas à l'image — § ⑤ |
| tests | 7 verts, « un huitième qui mord les pixels » | **2 mutations sur 7 rougissent** ; commenter l'adoption (M2) ou retirer `_versScene` du ruban (M5) laisse 4 992 tests verts | ⛔ § ⑧ |
| hors du socle | « non tenu », avoué | **358 px dessinés hors de l'empreinte du socle** au z13 (1 353 sommets sur 2 335 hors bloc), en orange sur la planète nue et le long de la paroi du crop — visible | ⛔ confirmé, chiffré |
| coût | 16,60 → 16,70 ms | image médiane **15,9 / 16,0 / 15,9 ms** (allumé / éteint / rallumé), p95 17,4–17,8, 0 requête, géométrie 1,94 Mo | ✅ |
| `boats` | « à vérifier » | **la passe qui rend la scène du bloc est éteinte** (`composer.passes[1].enabled === false`, scène `1c6228cd` = `__exp.scene` = parent de `boats.group`) : un bateau semé n'est PAS dessiné en production | ⛔ confirmé, § ⑦ |

---

## ② LA POSITION ABSOLUE — 5 points × 4 échelles, Mont-Blanc

`scripts/banc-gx3-position.mjs`. Points pris sur le GPX : **départ** (km 0,
45,92358 / 6,86917, 1 036 m), **arrivée** (km 86,5), **col 1** (km 9,9, 2 485 m
— le sommet du parcours), **col 2** (km 53,1, 2 316 m), **col 3** (km 75,7,
2 209 m). Pour chaque point et chaque zoom : `modes.flyTo(lat, lon, z)` centré
sur le point, repos atteint (témoin 0), puis :

- **« tracé le plus proche »** = distance du pixel de tracé le plus proche de
  la projection de la vérité (là où le tracé EST dessiné) ;
- **« sommet du produit »** = distance entre cette vérité et la projection du
  sommet de ruban le plus proche en lat/lon (là où le produit l'a POSÉ).

| zoom (emprise) | point | crop | tracé le plus proche | sommet du produit | m/px |
|---|---|---|---|---|---|
| **z10** (82 km) | départ | dans | **0,0 px = 0 m** | 0,6 px = 4,8 m | 7,4 |
| | arrivée | dans | **0,0 px = 0 m** | 1,7 px = 12 m | 7,3 |
| | col 1 | dans | ⛔ **63,6 px = 391 m** | 2,3 px = 14 m | 6,2 |
| | col 2 | dans | ⛔ **40,3 px = 249 m** | 2,3 px = 14 m | 6,2 |
| | col 3 | dans | ⛔ **27,6 px = 180 m** | 2,1 px = 14 m | 6,5 |
| **z11** (41 km) | départ | dans | 2,0 px = 15 m | 22 px = 160 m ⚠️ (Δr +121 m : drapé sur les hauteurs du zoom précédent) | 7,3 |
| | arrivée | dans | **0,0 px** | 0,7 px = 6 m | 7,8 |
| | col 1 | dans | ⛔ **41,0 px = 257 m** | 1,1 px = 7 m | 6,3 |
| | col 2 | dans | ⛔ **50,2 px = 323 m** | 1,0 px = 7 m | 6,4 |
| | col 3 | dans | ⛔ **24,8 px = 156 m** | 1,0 px = 6 m | 6,3 |
| **z12** (20 km) | départ | dans | (sous le bandeau) | 0,4 px = 3 m | 7,5 |
| | arrivée | dans | (sous le bandeau) | 0,3 px = 3 m | 8,0 |
| | col 1 | dans | 1,4 px = 9 m | 0,6 px = 3 m | 6,2 |
| | col 2 | dans | ⛔ **16,1 px = 99 m** | 0,5 px = 3 m | 6,2 |
| | col 3 | dans | 5,1 px = 33 m | 0,5 px = 3 m | 6,5 |
| **z13** (10 km) | départ | dans | **0,0 px** | 0,2 px = 1,5 m | 6,9 |
| | arrivée | dans | 19,2 px = 135 m ⚠️ | 0,2 px = 1,5 m | 7,0 |
| | col 1 | dans | 1,4 px = 8 m | 0,3 px = 2 m | 5,7 |
| | col 2 | dans | ⛔ **23,3 px = 142 m** | 0,3 px = 2 m | 6,1 |
| | col 3 | dans | 3,0 px = 19 m | 0,3 px = 2 m | 6,2 |

**Lecture.** La colonne « sommet du produit » est la position : **≤ 2,3 px, soit
≤ 14 m, à toutes les échelles** (hors le transitoire du départ z11) — la
conversion lat/lon → sphère est juste, il n'y a **aucun défaut d'échelle ni de
projection**. La colonne « tracé le plus proche » est ce qu'Adrien voit : aux
trois **cols**, il n'y a **aucun pixel de tracé à moins de 25–64 px** (150–390 m)
de l'endroit exact — le ruban y est posé au bon endroit **et enterré** (§ ③).
Départ et arrivée, en fond de vallée, tombent à 0 px.

⚠️ **Deux transitoires** (départ z11 : sommet à 160 m de sa vérité, Δr +121 m ;
arrivée z13 : 135 m) : après un `flyTo`, le ruban reste drapé sur les hauteurs
du zoom PRÉCÉDENT jusqu'à la reconstruction suivante — le repos du témoin est
atteint, l'image est stable, et le ruban est faux. Même famille que § ③.

---

## ③ LE DRAPAGE — le pire point, contre la surface que le GPU dessine

`scripts/banc-gx3-drapage.mjs`. Rayon radial du ciel (110 u) vers le centre,
premier maillage de tuile rencontré = la surface rendue ; écart = rayon du
sommet de ruban − rayon de la surface, en mètres réels (exagération ×2
divisée). 2 335 sommets, 0 sans intersection.

| cadrage | contre la surface RENDUE : moy · p05 · p95 · **min · max** | sous la surface de > 5 m | contre le MNT du bloc (la mesure de GX1/GX2) |
|---|---|---|---|
| Mont-Blanc, régime B (studio fermé, 12 286 m) | +9,5 · −67 · +73 · **−176 · +160 m** | **673 / 2 335** (271 à plus de +50 m) | +3,2 · **−185 · +154 m** |
| Mont-Blanc, régime A (studio ouvert, 26 484 m) | +4,9 · −29 · +41 · **−92 · +94 m** | 669 / 2 335 | −1,5 · −89 · +49 m |
| Camargue, régime A | −0,9 · −7,1 · +1,7 · **−7,1 · +3,4 m** | 106 / 501 (**sous le plan de mer** `crop-mer`) | +1,4 · −0,6 · +2,1 |
| Chamonix, régime A | +0,1 · −2,8 · +1,5 · **−4,8 · +3,2 m** | 0 (mais 138 / 401 sous la surface) | +1,1 · **+0,02 · +1,8** (jamais dessous) |

**Le pire point** : sommet **i = 1168**, 46,06609 N / 6,93976 E (km ≈ 46,
GPX 1 956 m). Le ruban y est posé à **1 825 m** (hauteur dessinée lue sur la
tuile **z11** : 1 821 m + 4,4 m de garde) ; la tuile que le GPU dessine là est
**`13/4253/2912`**, à **2 001 m** : le ruban est **176 m sous le sol**. En volant
dessus (`flyTo` z13 puis z14), le MNT se recharge, les hauteurs z13/z14 arrivent,
et le même sommet tombe à **+1,1 m puis +2,1 m** au-dessus de la surface, avec
le tracé à 0,0 px : la loi de pose est juste, **ce sont les données d'entrée qui
sont plus grossières que l'image**.

**La cause, lue dans la mesure** : `hauteurDessinee` choisit « la tuile la plus
fine qui a encore ses hauteurs » ; or `_buildMesh` relâche `t.heights` dès le
maillage bâti, sauf les tuiles réservées par `reserverHauteurs` — celles du
zoom du MNT (z11 au cadrage d'arrivée). Le crop, lui, DESSINE des tuiles z12
(régime A) et z13 (régime B). Le ruban est donc drapé sur un relief deux crans
plus grossier que celui qui le cache. Le « −4,7 m inchangé » de GX2 compare
deux MNT entre eux et ne pouvait pas le voir.

**C'est visible** : `pire-B-surligne.png` montre le tracé en pointillés sur les
crêtes (segments manquants là où il plonge) ; § ② mesure l'absence de pixel à
25–64 px des cols.

---

## ④ CHAMONIX 236 CONTRE 274 : expliqué, et compté contre le correctif

Même cadrage (régime A, 3 313 m / 2 367 m), même ruban (1,42 px de large,
409 px de long à l'écran en production ; 1,40 × 404 px sous `?terre=deux`) :
la géométrie prédit la même chose (581 / 565 px). La différence est le
**relief qui cache** :

- `scripts/banc-gx3-occlusion.mjs` — rayon de la caméra vers 401 sommets : sous
  `?terre=deux` **8 / 401 cachés** par le maillage du bloc ; en production
  **401 / 401** touchent la surface du globe AVANT le sommet (marge 6 m) ;
- § ③ le dit autrement : sous `?terre=deux` le ruban est **toujours au-dessus**
  du bloc (+0,02 … +1,8 m) ; en production il est **à cheval** sur la surface
  rendue (−4,8 … +3,2 m, 138 / 401 dessous).

Un ruban de 1,4 px à cheval sur son sol se dessine une fois sur deux : −14 %.
Ce n'est pas une différence de cadrage ni de HUD, c'est le drapage de § ③ à
petite échelle. **Compté contre le correctif** (ligne drapage).

---

## ⑤ LA LECTURE — au clic, 40 relevés, trois tracés, changements de vue

`scripts/banc-gx3-lecture.mjs`. Régime B, clic souris sur « ▶ Lecture ».

### Phase « suivi » — le geste d'Adrien, poursuite allumée, temps gelé aux relevés

| tracé | images sans tracé (< 30 px, deux relevés concordants) | médiane · min | headT | tête dans le tiers central | caméra sous le sol dessiné |
|---|---|---|---|---|---|
| Mont-Blanc 90 km (1ᵉʳ vol) | **0 / 40** | 5 293 · 174 px | 0,02 → 0,72, monotone | (non mesuré) | — |
| Mont-Blanc 90 km (2ᵉ vol, même geste) | ⛔ **1 / 40** (k=1 : **0 px, témoin 0**, headT 0,039 — la tête est DERRIÈRE la caméra, caméra à 278 m du sol en pleine descente) | 5 041 · 0 px | 0,02 → 0,71 | **39 / 40** | 0 / 40 |
| Camargue 5 km | **0 / 40** (mais k=1 : **83 px = le bruit du témoin**, tracé sous le plan de mer) | 3 479 · 83 px | 0,10 → 1,00 | **40 / 40** | 0 / 40 |
| Chamonix 4 km | **0 / 40** | 191 · 191 px ⚠️ | 0,23 → 1,00 (fini au 5ᵉ relevé) | 5 / 5 en lecture ; 0 / 35 après le finale | 0 / 40 (min **+44 m**) |

⚠️ Chamonix : la lecture dure 4 relevés ; le **finale** pose ensuite la caméra à
44 m du sol, la tête hors du tiers central, **et le tracé n'y est plus qu'un
groupe d'étiquettes (191 px)** — `chamonix-suivi-lect20-surligne.png` : de
grands aplats blancs devant l'objectif (nuages vus de l'intérieur, à vérifier),
relief derrière, ruban absent. Ce n'est pas la porte `vue.socle` (le groupe est
visible, 191 px de sprites), c'est la caméra de fin de course.

⚠️ Mont-Blanc : minimum **174 px à headT 0,41** (k = 22) — au moment où la
tête passe une crête, la poursuite ne voit plus que les étiquettes ; à k = 25
(`mb-suivi-lect25-surligne.png`) le ruban n'existe qu'à 150 px autour de la
tête, le reste des 40 km dévoilés est derrière les arêtes ou dessous (§ ③).

### Phase « figée » — suivi coupé avant le clic (E2), et trois changements de vue

Mont-Blanc : **0 / 40 images sans tracé**, témoin 0 partout.

| k | événement | avant → après | ce que ça dit |
|---|---|---|---|
| 0–12 | caméra fixe (7 893 m, vue de démarrage) | 433 → **460, plat** | la part dévoilée (headT ≤ 0,06) est hors champ : plat ≠ monotone, mais pas vide |
| 13 | `modes.cranZoom(1)` | 460 → 215 → 232 | le tracé survit au rechargement du relief |
| 26 | `applyIsoView(+1)` (26 484 m, bloc entier) | 232 → **805 · 812 · 924 · 935 · 932 · 938 · 943** | **croît avec headT** (un creux de 3 px à k=30) — le dévoilement avance |
| 33 | `modes.flyTo` même lieu : `orbital orbital surface …` | 943 → 340 → 357 | **la porte `vue.socle` tient** à l'aller-retour en orbite ; les 357 px = étiquettes, la part dévoilée est hors champ (`banc-gx3-apres-orbite.mjs` : 0 sommet dévoilé dans le champ, et **25 746 px** dès qu'on force le tracé entier dans la même vue) |

**Camargue figée** : 0 / 40, médiane 1 200 px, min 489, headT 0,04 → 0,91
monotone, tête au tiers central 28 / 40, caméra jamais sous le sol.

**Chamonix figée** : 0 / 40 **par la lettre** (206–242 px), mais
`chamonix-figee-lect5-surligne.png` le montre : caméra fixe à 1 521 m du sol,
tête au centre de l'écran (35 / 40), et **les seuls pixels du calque sont les
étiquettes** — le ruban de 4 km, 1 px de large, à cheval sur la surface rendue
(§ ③, § ④), ne pose rien de lisible ; le compte reste **plat à 242 px** de
headT 0,14 à 0,46 au lieu de croître. Ce n'est pas la porte `vue.socle` (le
groupe est visible et les sprites sont là) : c'est le drapage qui enterre un
ruban trop fin pour survivre à ±5 m.

⚡ **Deux vols de poursuite au même geste ne se ressemblent pas** : le premier
vol du Mont-Blanc n'a jamais perdu le tracé (min 174 px), le second l'a perdu
une image sur quarante avec la tête derrière l'objectif. Le vol de descente
dépend du temps de chargement ; un banc à un seul vol ne le voit pas.

---

## ⑥ LE TRACÉ HORS DU SOCLE — dessiné dans le vide, et Adrien le voit

`scripts/banc-gx3-horscrop.mjs`, régime B, `modes.flyTo` sur le centre du bloc :

| emprise | sommets hors bloc | pixels de tracé DANS l'empreinte du socle | **HORS** |
|---|---|---|---|
| 20 km (z12) | 0 / 2 335 | 10 010 | 135 (bord) |
| 10 km (z13) | **1 353 / 2 335** | 5 629 | **358 px** (6 %) |

`orange-z13.png` / `orange2-sans-gpx.png` : la ligne orange court sur la planète
nue en bas à droite et **grimpe le long de la paroi du crop** ; elle disparaît
quand le groupe GPX s'éteint — c'est bien lui. (Un premier comptage par couleur
la disait « hors du groupe GPX » : l'arête rouge de la paroi passait mon filtre.
Faux constat, réfuté par l'image sans GPX.) ⚠️ Sous le studio ouvert, `cranZoom`
ne change pas l'emprise (41 km aux trois crans) : le débordement ne s'y voit pas,
il se voit dès qu'on explore.

---

## ⑦ `boats` — la scène morte, prouvée

`scripts/banc-gx3-passe-morte.mjs`, Marseille z12, production :
`boats.group.parent === __exp.scene` (uuid `1c6228cd`), et la chaîne de passes
est `[PasseFond(sceneGlobe) · RenderPass(scene, enabled: false) · EffectPass]`.
**La seule passe qui dessine `scene` est éteinte** : un bateau semé
(`build({ force: true })`, modèle chargé, `mesh.visible = true`) n'atteint pas
l'écran. La différence allumé/éteint au pixel n'a rien montré de plus que le
bruit (1 748 px pour 3 685 de témoin, houle et pilules animées) — la preuve est
structurelle, pas pixel. Et sa position projetée par `camGlobe` est (586, 2 114)
: même rendue, elle serait hors écran, parce que personne n'a posé la similitude.
**Défaut vivant, hors du périmètre du correctif, à ne pas confondre avec lui.**

---

## ⑧ LES TESTS MORDENT-ILS ? — sept mutations, restaurées à l'octet

`scripts/banc-gx3-mutations.sh` (md5 des quatre fichiers avant / après chaque
mutation, `git checkout` entre deux ; suite ciblée de 98 tests : les 3 fichiers
de GX1, `gpx-pose-globe`, `visibilite-surface`, `gpx-layers`, `gpx`,
`sol-globe`). Produit intact : 98 · 0.

| mutation | ce qu'elle casse | rouges | verdict |
|---|---|---|---|
| **M1** `poseTableauEnPlace` rend le tableau tel quel (la similitude retirée) | tout le tracé à 6 371 km du crop | **1** (`gpx-pose-globe` ①) | mord |
| **M2** `gpxLayer.poserScene(sceneGlobe)` **commenté** dans `main.js` | le tracé retourne dans la scène morte : 0 px, le défaut d'origine | **0** ⛔ | la garde de `gpx-scene-globe` ① LIT le texte et **un commentaire la satisfait** |
| **M3** `setVisible(vue.socle && …)` rétabli | le tracé éteint à chaque passage de `poserVisibiliteSocle` (seconde moitié du défaut) | **1** (`visibilite-surface` ③, le compte des lecteurs) | mord |
| **M4** la fabrique de poseur n'est plus transmise au calque ajouté ensuite | le DEUXIÈME tracé chargé n'est pas posé sur le globe | **0** ⛔ | le piège de la tâche 22, annoncé par GX2, n'a pas de garde |
| **M5** le ruban ne passe plus par `_versScene` (`gpx.js:1124`) | les 25 500 sommets restent en coordonnées de bloc : **0 px** — c'est LE geste qui porte les pixels | **0** ⛔ | la fonction pure est testée, **son appel ne l'est pas** |
| **M6** `gpxPoseGlobe.setCamera(camGlobe)` retiré | curseur de survol et lancer de rayon mesurés avec la caméra du bloc | **0** ⛔ | aucune garde |
| **M7** `_sol` ignore le poseur (sol lu sur le bloc) | le ruban drapé sur les hauteurs du bloc sous le globe | **0** ⛔ | aucune garde |

**2 mutations sur 7 rougissent.** Cinq réécritures d'une ligne, dont celle
qui rend exactement le défaut d'Adrien (M2) et celle qui efface tous les pixels
(M5), laissent **4 992 tests verts**. GX1 l'avait écrit — « ces tests
garantissent le câblage, pas les pixels » — et GX2 n'a ajouté une garde que sur
la fonction pure. Restauration vérifiée à l'octet après chacune ; `git diff --
src/` : 0 octet. Suite complète ensuite : **4 992 · pass 4 992 · fail 0** ;
`npm run audit:tests` : 273 listés · 273 sur disque · Aucun écart.

---

## ⑨ LA NOTE — ligne par ligne, barème de GX1 + mes observations

Éliminatoires : **E1** ✅ 1 223–1 516 px (≥ 900) · **E2** ✅ 0/40 sur trois
tracés, poursuite et figée · **E3** ✅ 1 286 px sous `?terre=deux` (≥ 950).
Aucun n'est manqué : la note n'est pas plafonnée.

| pts | critère | seuil | **mesuré** | **note** |
|---:|---|---|---|---:|
| 2 | présence au repos, Mont-Blanc | ≥ 900 px et ≥ 45 % des attendus | 1 516 px = 75 % des 2 018 | **2** |
| 1 | présence sur les trois tracés | ≥ 60 % des attendus chacun | MB 75 % · Camargue **100 %** · Chamonix **41 %** (témoin 48 %) | **0,5** — Chamonix sous le seuil, pour la raison de § ④ |
| 2 | lecture continue | 0 image < 30 px, compte monotone | figée : 0/40 ×3, monotone quand la vue contient la part dévoilée ; **mais** poursuite MB 2ᵉ vol **1/40 à 0 px**, Chamonix figée **ruban invisible** (242 px d'étiquettes, plat), Camargue k=1 = le bruit (sous la mer) | **1** |
| 1 | position horizontale | ≥ 40/48 sommets ≤ 6 px ; A/R ≤ 0,5 m | sommets posés à **≤ 2,3 px / ≤ 14 m** de la vérité (20/20) ; mais 12/48 retrouvés à l'écran en régime A (témoin 13/48), 15/15 en B | **1** — la position est exacte, l'absence de pixel est le drapage |
| 1 | échelle et forme | ≤ 0,5 % moy, ≤ 2 % max | 5 points × 4 zooms à ≤ 14 m sur 40–80 km d'emprise (≤ 0,03 %) | **1** |
| 1 | drapage | plat : \|écart\| ≤ 15 m ; montagne : moy ∈ [0 ; +40], **jamais < −80 m** | montagne **−176 m** (B), −92 m (A), 673 sommets enterrés > 5 m ; plat −7 m sous la mer | **0** |
| 1 | dans le crop ET hors du crop | hors socle écrêté, pas dans le vide | **358 px dans le vide**, visible sur la planète et la paroi | **0** |
| 0,5 | échelles z8 → z15 | ≥ 60 % à 4 altitudes | 26 484 m 75 % · 6 661 m 137 % · 3 276 m 304 % · 2 284 m 546 % (MB) ; Camargue 100 % → 463 % | **0,5** |
| 0,5 | caméra de suivi | tête au tiers central ≥ 80 %, jamais sous le sol | MB **39/40** · Camargue 40/40 · Chamonix 5/5 en lecture (puis le finale la met hors tiers, 44 m du sol, devant des aplats blancs) ; jamais sous le sol dessiné | **0,5** |
| 0,5 | coût | +10 % appels, +5 % mémoire, 0 requête, +15 % image | 15,9 / 16,0 / 15,9 ms, p95 17,4–17,8, 0 requête, 1,94 Mo ; appels non lisibles (`renderer.info` remis à zéro par la passe finale) | **0,5** |
| 0,5 | rien d'autre ne bouge | 0 régression | chargement, cadrage, studio, profil (86,5 km · D+ 6 300 · 2 485 m), headT 0 → 1, poursuite engagée au clic, 25 500 sommets, `?terre=deux` 1 286 px, cartouche/nuages/cotes dans `sceneGlobe` | **0,5** |
| | | | | **7,5 / 10** |

Hors barème, à retenir pour la correction : **les gardes ne mordent pas** (§ ⑧,
2 mutations sur 7) — ça n'entre pas dans le chiffre, ça entre dans ce que la
reprise doit livrer.

### Ce qui manque pour atteindre 9

1. **Draper le ruban sur les hauteurs que le GPU dessine** (les tuiles z12/z13
   du crop, pas les z11 réservées), ou re-draper à l'arrivée des tuiles fines —
   c'est 1 point (drapage) et la moitié du point « trois tracés » (Chamonix).
2. **Écrêter le tracé au bord du socle** au lieu de le poser dans le vide —
   1 point.
3. Les transitoires après `flyTo` (ruban sur les hauteurs du zoom précédent)
   tombent avec le 1.
4. **Des gardes qui EXÉCUTENT le chemin du ruban** (M2, M5 au minimum) : une
   garde qui lit du texte accepte un commentaire ; une garde sur la fonction
   pure ne voit pas qu'on a cessé de l'appeler.
5. Un ruban qui reste lisible à 26 km et sur 4 km : à 1,4 px de large, à
   cheval sur son sol, il ne se dessine qu'une fois sur deux (§ ④) — ce n'est
   pas dans le barème, c'est ce qu'Adrien appelle « la lecture ».

Sans les deux premiers, **7,5 / 10 : ne pas fusionner.** Le correctif de GX2
n'est pas faux — il est incomplet, et ce qu'il laisse se voit à l'écran.

---

## ⑩ CE QUE J'AI CRU, PUIS RÉFUTÉ

1. **« Le régime d'arrivée est celui de GX1/GX2. »** Réfuté : `.cb-play` est
   hors écran, le studio est ouvert et la toile fait 836 px ; la croix
   restaure la caméra d'AVANT le chargement (`restoreState`), à une altitude
   qui dépend du démarrage. J'ai dû noter deux régimes.
2. **« Mettre en pause fige la scène. »** Réfuté : la pause tue la poursuite
   (`drone.stop()`), et l'API `play()` ne la rengage pas — vingt relevés d'une
   caméra plantée le nez dans un versant. Le gel de `performance.now` a rendu
   le témoin à 0 en gardant `drone.active`.
3. **« Le drapage à +4,37 m partout, c'est parfait. »** Réfuté : c'est le
   ruban comparé à `hauteurDessinee` — la MÊME fonction qui l'a drapé. Contre la
   surface rendue : −176 / +160 m.
4. **« Un rayon depuis le centre de la sphère mesure la surface. »** Réfuté
   deux fois : il frappe les tuiles par leur face arrière (`FrontSide`, ignorées)
   et ne touchait que les parois et l'atmosphère (+125 km) ; puis, du ciel vers
   le centre, un maillage sans nom à 3,9 unités (la coquille de nuages) passait
   pour « la surface ». Seules les tuiles nommées `z/x/y` et `crop-*` comptent.
5. **« La ligne orange hors du socle n'est pas le groupe GPX »** (un comptage
   par couleur le disait : 479 px restants groupe éteint). Réfuté par l'image :
   c'était l'arête rouge de la paroi du crop qui passait mon filtre. Le
   comptage par couleur ment sur cette carte — GX1 l'avait écrit, je l'ai
   repayé.
6. **« Après l'aller-retour en orbite, le tracé dévoilé a disparu (357 px). »**
   Réfuté : 0 sommet dévoilé dans le champ ; en forçant le tracé entier dans la
   même vue, 25 746 px. La porte `vue.socle` tient.
7. **« Chamonix à 0 px aux crans B-z2/z3, c'est une disparition. »** Réfuté :
   0 sommet à l'écran — la caméra restaurée par la croix regarde 2 km à côté
   du tracé, et les crans y descendent. Même chose pour Camargue B-z3.
8. **« Les pixels attendus de GX1 (longueur × largeur) sont une bonne norme. »**
   Réfuté en régime B : 137 % à 546 % — la formule sous-estime les rubans
   larges (halo, étiquettes) ; je n'en fais qu'un ordre de grandeur, la
   présence se juge aux sommets retrouvés (15/15 à 0,0 px en B).

---

## ⑪ COMMENT REJOUER

```bash
node_modules/.bin/vite --host 127.0.0.1 --port 10333 --strictPort
node scripts/banc-gx3-repos.mjs --etiquette mb                      # A, B, 3 crans
node scripts/banc-gx3-repos.mjs --etiquette mb-deux --adresse terre=deux
node scripts/banc-gx3-repos.mjs --gpx .banc/court-montagne-chamonix-4km.gpx --etiquette chamonix
node scripts/banc-gx3-lecture.mjs --etiquette mb --phase suivi      # clic souris, temps gelé
node scripts/banc-gx3-lecture.mjs --etiquette mb --phase figee      # + zoom, iso, orbite
node scripts/banc-gx3-position.mjs --etiquette mb                   # 5 points × z10..z13
node scripts/banc-gx3-drapage.mjs --etiquette mb --regime B         # rayon ciel → sol
node scripts/banc-gx3-pire.mjs                                      # i=1168, B puis z13, z14
node scripts/banc-gx3-horscrop.mjs --etiquette mb --crans 2
node scripts/banc-gx3-occlusion.mjs [--adresse terre=deux]          # Chamonix, 401 sommets
node scripts/banc-gx3-passe-morte.mjs                               # boats
bash scripts/banc-gx3-mutations.sh && npm test && npm run audit:tests
```
