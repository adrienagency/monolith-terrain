# R32 — ON ATTRAPE LA TERRE : LE PIVOT EST SON CENTRE JUSQU'AU CROP, MESURÉ EN ESPACE GLOBE

Arbre `C:\Dev\wt-orb3`, branche `orbite-jusquau-crop` (`regroupement` fusionné
deux fois : la recette de l'attaquant R33, puis R34). Serveur `npm run dev
--port 5851` (arrêté à la fin). Instrument : `scripts/sonde-pivot-r32.mjs` —
Chrome sans tête 1280 × 800, gestes à la souris (CDP), relevé dans un
`requestAnimationFrame` posé **après `tick`**, donc après `majCameraFond()`,
sur **`camGlobe`, la caméra qui rend**. Journaux : `.banc/R32/avant.json`,
`.banc/R32/apres.json`. Le cahier de recette de l'attaquant
(`test/attaque-r33-ROUGE.mjs`, journaux `.banc/R33/`) est rejoué en §⑤ :
**10 / 10 verts**. `npm test` **4 695 · 0 échec** (base 4 675),
`npm run audit:tests` **243 = 243**.

**Le brief avait raison sur le défaut et sur la moitié de sa cause. Adrien a fixé
la cible en cours de route (D19 : Google Earth). Les trois mesures d'ouverture
d'abord, puis le choix et son chiffre, puis les tableaux avant / après.**

---

## ⓪ LES TROIS MESURES D'OUVERTURE — l'état d'avant, à 130 km (`avant.json`)

Voile d'accueil fermé et **vérifié** (`elementFromPoint(640, 400)` rend
`CANVAS`) ; pose de départ attendue sur `d` immobile deux secondes (⚠️ fermer le
voile ANNULE le vol de présentation vers `d = 145,5` — Échap à l'ouverture
laisse `d = 28,15` pour toujours : « attendre la stabilité » sans savoir
laquelle est bien le piège du brief) ; `enterOrbit(60 000 km)` ; molette
jusqu'à 129 km d'altitude de fond (mode surface, z9, crop non posé) ; **glissé
horizontal de 200 px, puis vertical de 200 px vers le haut** (vers le bas, `φ`
bute à 0 depuis le nadir — R30 l'avait noté ; ma première passe tirait vers le
bas et rendait un glissé vertical INERTE — première chose crue puis réfutée).

| grandeur, à 129 km de fond hors crop (`avant.json`) | glissé H 200 px | glissé V 200 px |
|---|---|---|
| **① pivot (`controls.target` transporté par la similitude), en mètres du centre de la Terre** | 6 372 437 m — **1 437 m au-dessus de la surface** | idem |
| **② lat/lon du point sous la caméra** | sur une vue au nadir (2 382 km, première manche) : **0,000° / 0,000°** ; vue déjà couchée par la manche précédente : −3,855° / +36,418° (la caméra tourne autour du point de surface à grand rayon) | 0,002° / 0,006° (0,3 km) |
| **③ centre de la Terre à l'écran** | jusqu'à **6 619 px** du centre (écran de 800) | **6 660 px**, saut max 41,7 px/image |
| angle verticale locale / axe optique | 78,5° (hérité) | **67,9° dès le premier glissé vertical, à 2 382 km** |
| point saisi ↔ curseur en fin de glissé | **387 px** (l'image a tourné sur elle-même) | 200 px (il n'a pas bougé) |

Lecture : le pivot n'est pas « à côté » de l'axe — **il est à la surface**
(+1,4 km), et la caméra tourne autour de lui. Au nadir, l'azimut d'OrbitControls
est un **lacet** (l'image tourne, le point sous la caméra ne bouge pas :
0,000°) ; le polaire est une **inclinaison** (la vue se couche à 68°, le centre
de la Terre sort du cadre par le bas — les images 8 à 10 de la vidéo). **C'est
ce que l'attaquant R33 a mesuré de son côté** : axe instantané de rotation de
`camGlobe` à 6 297 km du centre pour le glissé vertical, 0,0000° pour
l'horizontal.

⚠️ **Où le brief se trompait, et ça a décidé l'architecture** : l'axe du bloc
`hypot(target.x, target.z) = 0` était **juste dans son espace** — la similitude
est ancrée sur l'aplomb de la cible, donc l'axe du bloc EST le rayon terrestre.
Le défaut n'est pas l'écart à cet axe, c'est que **la cible, point de la
surface, sert de pivot aux deux angles d'OrbitControls**. Et la conséquence est
l'inverse de celle que le brief redoutait (« le bloc doit alors suivre la
caméra ») : parce que l'ancre est l'aplomb de la cible, **translater
rigidement caméra et cible dans le plan du bloc déplace le point sous la caméra
sur la sphère, à altitude constante** — une orbite, vue par la caméra qui rend.
Et hors du crop le bloc n'est pas dessiné (`passeSurface.enabled = false`,
`main.js`) : il n'y a rien à faire suivre à l'image.

### Deux choses que personne n'avait chiffrées, trouvées en passant

- **Le point sous la caméra SAUTAIT à chaque franchissement de niveau** (descente
  à la molette, `avant.json`, image où `busy` retombe) : **466 km à z4, 197 km à
  z5, 90 à 129 km à z6, 48 à 68 km à z7, 24 km à z8, 12 km à z9, 8,6 km à
  z10**, et **550 km à la traversée orbite → surface**. C'est la re-pose de R27
  sur `(0, Y, 0)` : le centre du bloc **calé sur la grille de tuiles**, jusqu'à
  un sixième de côté du lieu demandé. R27 ne mesurait que le centre du bloc à
  l'écran (0 px après la re-pose) et l'altitude — pas le sol. **Après : 0 saut
  sur les cinq descentes** (`apres.json`, seuil 0,5 km).
- **La molette depuis l'orbite plongeait sur un bloc z3** (`zoom 3` à 2 382 km
  dans `avant.json`) malgré `ZOOM_PALIER_MIN = 4` : `niveauDArrivee` porte un
  `zoomMin = 3` par défaut que `_niveauDArrivee` ne remplaçait pas. Trouvaille
  de l'attaquant, confirmée, corrigée, testée (`pivot-terre.test.js` ③).

---

## ① CE QU'ADRIEN A FIXÉ EN COURS DE ROUTE — D19

> *« quand je déplace et fais tourner la Terre au clic, la Terre se déplace
> autour de son centre ; quand je scrolle pour zoomer ou dézoomer, je scrolle
> vers le point visé au centre de l'écran ; je veux que les contrôles soient
> exactement les mêmes que pour Google Earth. »*

**Google Earth, décrit avant d'être codé (D19 ③)** — Google Earth Pro, souris :

| geste | Google Earth | ici, après R32 |
|---|---|---|
| glissé gauche | la surface saisie **reste sous le curseur** (« on attrape la planète ») ; la Terre tourne autour de son centre, nord en haut, altitude constante ; passé le limbe, la rotation continue au rythme du bord ; au relâché, un élan qui décroît | **identique**, en orbite et en surface hors crop (`monde/saisie-terre.js`, `main.js`) ; sur le crop, le pivot R13 (l'exception d'Adrien), inchangé |
| molette | zoom **vers le point au centre de la vue** (Google Earth Pro ; la version web zoome vers le curseur — Adrien tranche pour le centre) | `_zoomGesture` lit le pivot en `(0, 0)` ; hors crop c'est le zoom radial de R29 bis (identique au nadir), sur le crop c'est le point du cadre — mesuré §⑤ : le point du centre reste au centre à 0 – 1,4 px près sur trois crans, à toutes les altitudes |
| molette enfoncée / Ctrl+glissé | incliner et tourner autour du point visé | **non traité** : hors du crop l'inclinaison manuelle est interdite par D16 ter ; sur le crop, OrbitControls inchangé (le polaire autour de la cible) |
| double-clic | s'approcher du point cliqué | non traité (le clic-plongée existant reste) |
| clic droit / Maj+glissé | zoom | reste le déplacement d'OrbitControls ; hors crop il translate caméra et cible, donc c'est aussi une orbite — non asservie au curseur |

⚠️ **Ce que D19 change au diagnostic** : la vitesse du glissé n'est plus un
réglage. `OrbitControls` tourne de `2π·dx/H` par pixel quelle que soit
l'altitude : à 60 000 km c'est à peu près la saisie (le disque de la Terre fait
~130 px de rayon, donc 0,44 °/px pour 0,447), mais **à 9 250 km c'est déjà 8
fois trop vite** : mesuré en orbite, le point saisi finissait à **134,8 px** du
curseur pour 200 px de glissé (`apres.json`, première passe, avant la saisie en
orbite) ; **1,6 px** après, puis **0 px** avec le modèle itéré. L'« étalon
orbite » du brief n'était pas un étalon : c'est le geste de Google Earth qui
l'est, et il se définit par une contrainte — le point saisi sous le pointeur —
pas par une vitesse.

---

## ② LE CHOIX — A, réalisé par la translation rigide, et le chiffre qui l'a décidé

**B (rester en espace globe jusqu'au crop)** aurait déplacé la traversée de
8 000 km à ~40 km et rendu inertes, entre les deux, **tout le régime de surface
mesuré par sept tâches** : `_applyZoom` et son élan de 20 crans, le compteur de
niveau et `_franchirSiBesoin`, les sept paliers z4→z10 et leurs conversions
d'unités (`_suivreEmprise`), `altitudeCadrageM` (seuil du crop, estompage),
`redresserSurLeSol`, `plongeDepuisGlobe`. Compté dans `modes.js` : **11 chemins
qui lisent `camera.position.y` ou `controls.target` en unités de bloc** entre
8 000 km et 32 km. Et l'orbite aurait gardé son zoom amorti (`orbAltTarget`) là
où Adrien a mesuré le cran ×√2.

**A tel que le brief l'écrit (`controls.target = (0, −R_bloc, 0)`)** casse sur
un seul nombre : à 130 km sur un bloc z9, `R_bloc = 6 371 000 × 56 / 219 000 =
1 630 u` pour `h = 33 u`. `_applyZoom` multiplie la DISTANCE à la cible par
`exp(−vel·dt)` : un cran de 3 % vaudrait **49 u = 190 km sous le sol** au lieu
de 1 u ; `veille-repos` verrait `|Δ ln d| = ln(1663/33) = 3,9` — **39 000 fois
son seuil** — à la pose de la cible ; l'angle polaire deviendrait une latitude,
`getDistance()` passerait de ~150 à ~13 000 u sur un bloc z12. C'est aussi
l'objection du coordinateur, et elle tient.

**Ce qui a décidé : l'ancre de la similitude.** `majCameraFond` ancre
`poseFond` sur `latLonDuBloc(controls.target.x, controls.target.z)` — l'aplomb
de la cible. Donc **le même vecteur ajouté à la caméra ET à la cible dans le
plan du bloc** — le motif exact de `pivoterAutourDuBloc`, l'axe changé — est,
pour la caméra qui rend, une rotation autour du centre de la Terre à altitude
`camY × emprise / span` constante. Vérifié sans navigateur par la similitude du
dépôt (`test/pivot-globe.test.js` ① et la recette R33 ⑤ réécrite) : **axe de
rotation transporté à moins de 100 km du centre, altitude inchangée à 50 m
près, le point sous la caméra se déplace de cos(lat) degré d'arc pour 1° de
longitude**. Rien d'autre ne bouge : ni la distance caméra→cible
(`veille-repos` ne voit rien, par construction — `|Δ ln d| = 0,00e+0` sur tous
les glissés de surface, §③), ni `camY` (altimètre, seuil, paliers), ni le zoom
radial. **Deux pivots pour deux gestes** : le glissé tourne autour du centre de
la Terre ; l'inclinaison, elle, n'existe plus sur le bouton gauche hors du crop
(D16 ter — et c'est ce que le glissé vertical de la vidéo faisait), et reste
autour de la cible de surface sur le crop.

⚠️ **Le bloc suit quand même, par le chemin qui existe** : à chaque
franchissement `_rescale` recharge le bloc centré sur le lieu visé et
`_cibleVisee` y vise **le même lieu** (c'est ce qui a supprimé les sauts de
8,6 à 466 km) ; et si la cible s'éloigne de plus de 20 u de l'axe du bloc, au
repos de la saisie, `modes.recentrerBloc()` recharge au même niveau, sans
annonce, la caméra ne bougeant pas d'un mètre (`_suivreEmprise`). Mesuré à
2 000 km : un glissé de 200 px vaut 8,5 u — le recentrage ne part qu'au-delà de
~470 px de glissé, et **une seule fois par position de cible** (voir §⑥, la
tempête de rechargements).

### Ce qui a changé, fichier par fichier

| fichier | quoi |
|---|---|
| `src/monde/saisie-terre.js` | **neuf, pur** — la loi : `pointSousLeRayon` (sphère, ou limbe), `poseNadir`/`roulisDe`/`pointSousLePixel` (le modèle de la caméra qui rend), `pasDeSaisie` (`S′ = S + (G − D)`, plafonné à 30°/image ; 0,75°/image au limbe), `deplacementDeSaisie` (itère le modèle, ≤ 5 fois), `elanDeSaisie` (τ = 0,35 s, celui d'OrbitControls), `LAT_MAX_DEG = 80` |
| `src/main.js` | « on attrape la Terre » : régime (`regimeSaisie` = orbite, ou surface hors crop), `controls.enableRotate = !regime`, pointeur capturé, pose réelle lue sur `camGlobe`, application (orbite : caméra reposée sur sa sphère nord en haut ; surface : translation rigide caméra + cible via `mondeDuLatLon`), élan, `recentrerSiBesoin` (une demande par position), un cran de molette éteint l'élan ; `surPriseDeCamera`/`surRelacheDeCamera` factorisés (mêmes effets de bord qu'un `start` d'OrbitControls) ; **le recentrage de R27 (`recentrerSurLaTerre`) est retiré** ; crochets `lieuVise`, `zoomCourant` |
| `src/modes.js` | `_cibleVisee` vise le lieu demandé des deux côtés du crop ; `recentrerBloc()` (rechargement silencieux via un drapeau — la signature de `_rescale` est lue par deux cliquets) ; `_zoomGesture` prend son pivot au centre de l'écran (D19) ; `_niveauDArrivee` passe `zoomMin: ZOOM_PALIER_MIN` |
| `src/monde/pivot-terre.js` | **supprimé** (le recentrage vers l'axe du bloc à 4 px/image) |
| `scripts/sonde-pivot-r32.mjs` | **neuf** — l'instrument |
| `test/saisie-terre.test.js` (17), `test/pivot-globe.test.js` (8) | **neufs**, inscrits dans `package.json` |
| `test/pivot-terre.test.js`, `test/pivot-molette.test.js`, `test/pivot-bloc.test.js`, `test/damier-cadre.test.js`, `test/attaque-r33-ROUGE.mjs` | réécrits / amendés — §④ |

---

## ③ LE CRITÈRE D'ACCEPTATION — le geste de la vidéo, avant / après

Deux instruments, deux jeux d'altitudes. **Le banc de l'attaquant** vise les
altitudes du brief à l'altimètre (2 000 / 130 / 50 km ; la caméra qui rend est
au double, exagération ×2) ; **le mien** vise l'altitude de fond, et ses jalons
sont tombés à 1 810 / 102 / 44 km de fond — le troisième SUR le crop
(altimètre 22 km < 32 274 m), donc dans l'exception d'Adrien, où rien ne doit
changer. Les deux disent la même chose.

### Le banc de l'attaquant (`.banc/R33/mesures-altimetre.json`, après) — glissés H 200 px, V 200 px vers le haut

| altimètre (fond) | ① pivot : axe de rotation, distance au centre (méd / max) | ② Δ point sous la caméra H / V | ③ centre Terre à l'écran, dépl. max | ④ angle vert. max | ⑥ saisi ↔ curseur (max / final) |
|---|---|---|---|---|---|
| **1 977 km** (3 950) — avant (R33) | 6 297 km (à la surface) | 0,000° / — | 1 200 à 3 300 px | 50 – 68° | 200 px / 200 px |
| **1 977 km** — après | **0 / 0 m** | **5,44° / 5,43°** | **0 px** | **0°** | **0 / 0 px** |
| **130 km** (260) — après | **0 / 0 m** | **0,354° / 0,354°** | **0 px** | **0°** | **0,1 / 0,1 px** |
| **50 km** (100) — après | **0 / 0 m** | **0,136° / 0,136°** | **0 px** | **0°** | **0,3 / 0,2 px** |
| étalon orbite 60 000 km — après | 0 / 0 m | 68,8° / — | 0 px | 0° | 75 px (le glissé sort du disque de ~130 px de rayon : rien ne peut le suivre) |
| orbite 10 325 km — après | 36 / 299 m | 14,5° / 14,5° | 0 px | 0° | **0 / 0 px** |

### Mon banc (`.banc/R32/avant.json` → `apres.json`) — le même geste, sonde après `tick`

| | 1 810 km de fond (avant → après) | 102 km de fond (avant → après) | 44 km de fond = **sur le crop** (avant → après) |
|---|---|---|---|
| centre de la Terre à l'écran, écart max | 3 957 px → **0 px** | 6 619 px → **0 px** | 10 335 px → 30 827 px (crop couché à 87°, R23 : inchangé) |
| lat/lon sous la caméra, glissé H | 0,000° (lacet) → **−0,059° / −3,83° (336 km)** | 0,000° → **−0 / −0,221° (18,6 km)** | 869 km → 61 km (pivot R13 autour de l'axe du bloc, inchangé) |
| lat/lon sous la caméra, glissé V | 0 → **−3,018° / 0 (336 km)** | 0 → **−0,167° / 0 (18,6 km)** | — |
| angle verticale / axe optique, max | 71,2° → **0°** | 78,5° → **0°** | 82,6° → 87,5° (la bascule de trois quarts puis la butée du crop : inchangé) |
| `\|Δ ln d\|` max pendant les glissés | 4,4e-16 → **0,0e+0** | 3,3e-16 → **0,0e+0** | 4,4e-16 → 3,3e-16 |
| point saisi ↔ curseur, fin de glissé H | 124 px → **0 px** | 387 px → **0 px** | 118 px → 186 px (le pivot du crop n'est pas une saisie : R13) |
| point du centre pendant 6 crans de molette | 2,8 px → **0 px** | 1,1 px → **0 px** | 1,8 → 0,1 px |
| sauts du sol aux franchissements de la descente | 197 km (z5), 90–129 km (z6) → **0** | 48–68 km (z7), 24 km (z8), 12 km (z9) → **0** | 8,6 km (z10) → **0** |

**Au crop, rien ne change** : le pivot de R13 (l'axe du bloc), la bascule de
trois quarts (46,04° à l'arrivée sur le bloc, avant comme après), la butée du
crop. **Le retour depuis le crop** (diagnostic `diag-retour.mjs`, vue couchée à
88,1° puis 190 crans de molette) : le crop meurt à 145 km de fond, l'orbite est
atteinte au cran 190 (R30 : 181 à 187) — le chemin tient sous D19. ⚠️ Mais la
vue reste inclinée après la mort du crop (69,7° à la mort, 61° à z4, puis
`enterOrbit` la rend au nadir) — **c'était déjà ainsi avant** (`avant.json`,
segment `retour` : 84,9°) : le balayage de retour au nadir de D16 ter ne finit
pas sur ce chemin. Réserve n° 2.

---

## ④ LES TESTS QUI GRAVAIENT LA CONFUSION — réécrits, et nommés

| fichier · test | ce qu'il gravait | ce qu'il garde maintenant |
|---|---|---|
| `test/pivot-terre.test.js` ① – ⑦ (15 tests, R27) | `decalageRecentrage` : ramener la cible sur l'AXE DU BLOC à 4 px/image, en l'appelant « le centre de la Terre » | **fichier réécrit** (13 tests) : `_cibleVisee` vise le lieu demandé des deux côtés du crop (①, avec le chiffre des sauts) ; `recentrerBloc` silencieux et ses gardes (②) ; plancher z4 de la plongée (③) ; molette au centre de l'écran (④) ; porte orbitale (⑤, inchangé) |
| `test/pivot-terre.test.js` ⑧ « HORS DU CROP, la visée d'arrivée est l'axe » | la re-pose sur le centre calé du bloc = les sauts de 8,6 à 466 km | ① « la visée d'arrivée est le LIEU DEMANDÉ », ① quater : `_cibleVisee` ne consulte plus `horsDuCrop` |
| `test/pivot-molette.test.js` ② « la cible SUR l'axe de la Terre » | `hypot(target.x, target.z)` appelé « axe de la Terre » | « un cran de molette ne TRANSLATE pas la cible » — même mesure, nommée dans son espace |
| `test/pivot-molette.test.js` ② ter « le zoom vers le curseur est INTACT sur le crop » | l'arbitrage de R29 bis, remplacé par D19 | « SUR LE CROP, le zoom vise le point AU CENTRE DE L'ÉCRAN », et `_zoomNdc.set(0, 0)` gardé par le texte |
| `test/pivot-bloc.test.js` ⑥ « le pivot n'est PAS conditionné au crop » et « le décalage ne lit jamais le `y` : c'est ce qui identifie les deux règles » | *« les deux pivots n'en font qu'un »* — la confusion d'espace elle-même | « l'exception vit à la source, sur le bouton » (`enableRotate = !regime`) ; « `decalagePivot` est aveugle au `y` : une rotation d'axe VERTICAL, le pivot du crop — pas une orbite » |
| `test/attaque-r33-ROUGE.mjs` ② | « ≥ moitié de l'étalon orbite » — l'orbite d'AVANT D19 (0,447 °/px) | le déplacement vaut le sol que 200 px couvrent (5,4° à 4 000 km, 0,14° à 100 km), jamais 0° |
| `test/attaque-r33-ROUGE.mjs` ⑤ · ⑤ bis | la rotation polaire/azimut d'OrbitControls autour de la cible, transportée — *« à réécrire contre le nouveau mécanisme »* (son en-tête) | la translation rigide transportée : axe < 100 km du centre, altitude constante, cos(lat)° pour 1° de longitude ; le témoin d'avant vit dans `pivot-globe.test.js` ① ter |
| `test/damier-cadre.test.js` | — | `recentrerBloc` déclaré inerte, avec sa raison (la caméra n'est pas confiée) |

**Neufs** : `test/saisie-terre.test.js` (17 : la loi, la convergence sur une
vraie projection à quatre altitudes, le limbe, le pôle, l'élan) ;
`test/pivot-globe.test.js` (8 : le mécanisme transporté par `poseFond`, le
branchement dans `main.js`).

---

## ⑤ LA RECETTE DE R33 — 10 / 10

```
node scripts/sonde-attaque-r33.mjs --port 5851 --etiquette altimetre --altitudes 4000000,260000,100000
node scripts/sonde-attaque-r33.mjs --port 5851 --etiquette inclinaison --serie inclinaison --altitudes 4000000,260000,100000
node scripts/lit-sonde-r33.mjs .banc/R33/altimetre.json · node scripts/lit-sonde-r33.mjs .banc/R33/inclinaison.json
node --test test/attaque-r33-ROUGE.mjs   →  tests 10 · pass 10 · fail 0
```

Les deux mesures D19 en pixels, hors du crop, à 1 977 / 130 / 50 km
d'altimètre : **point saisi ↔ curseur en fin de glissé de 200 px : 0 / 0,1 /
0,2 px** (étalon orbite basse : 0 px) ; **point du centre pendant 3 crans de
molette, vue « couchée » (qui ne se couche plus) puis d'aplomb : 1,4 / 1,4 /
1,4 px** (série inclinaison, 2 crans : 0,4 / 0,4 / 0 px).

---

## ⑥ CE QUE J'AI CRU PUIS RÉFUTÉ

1. ⛔ **« Un glissé vertical de 200 px vers le bas couche la vue. »** Depuis le
   nadir, `φ` bute à 0 : mon premier `avant.json` rendait un glissé vertical
   INERTE (tilt 0°, 200 px d'écart) et j'ai failli conclure que le défaut
   n'était que le lacet. R30 l'avait écrit ; l'attaquant tirait vers le haut.
2. ⛔ **« La pose de démarrage est à `d = 145,5`, il suffit d'attendre. »**
   Fermer le voile à son ouverture annule le vol de présentation : `d = 28,15`
   pour toujours, et ma sonde attendait 60 s une valeur qui ne viendrait pas.
3. ⛔ **« Le bloc doit suivre la caméra à chaque image »** (l'objection A du
   brief). L'ancre de la similitude est l'aplomb de la cible : translater
   caméra et cible SUFFIT, et le bloc n'est pas dessiné hors du crop. Ce qui
   doit suivre, c'est la géo du lieu visé aux franchissements — et c'est là que
   R27 sautait de 8,6 à 466 km.
4. ⛔ **« Une pose au nadir se saisit par un simple pas lat/lon. »** À 60 000 km
   la projection est trop courbe : 136 px de résidu après une itération, et le
   plafond de 30° par image mord sur 100 px. D'où le modèle itéré dans l'image
   (`poseNadir`, ≤ 5 itérations, < 0,01 px sous 2 000 km) — et le plafond qui
   n'ÉTALE un saut que sur deux ou trois images.
5. ⛔ **« Au limbe, le pas plafonné à 30° suffit. »** Un glissé de 200 px à
   60 000 km sort du disque (130 px de rayon) ; à 30°/image la caméra partait
   de 63,7° de latitude et 89° de longitude jusqu'au pôle, où la cible bornée
   par `viseeArrivee` déclenchait **un rechargement du bloc à chaque image**
   (`busy` alterné, 2,9 images par seconde), et tout mon premier `apres.json`
   mesurait un cas dégénéré. Trois correctifs mesurés : 0,75°/image au bord,
   latitude bornée à 80°, une demande de recentrage par position de cible.
6. ⛔ **« Le point du centre dérive pendant la molette : le zoom radial vise la
   cible. »** (ROUGE ⑦ bis : 4 · 6,9 · 8,9 px). Instrumenté : aucun écrivain
   de `controls.target` hors OrbitControls (`clampLength`, net nul) et
   `_rescale` ; la dérive avait la forme d'une exponentielle — c'était **l'élan
   du glissé précédent** (τ = 0,35 s, encore à 39 % après les 20 images du
   banc). Un cran de molette éteint l'élan : 1,4 px.
7. ⛔ **« Le glissé horizontal ne change que la longitude. »** À nord constant
   il suit un grand cercle, pas un parallèle : −58,7° de latitude pour 200 px à
   60 000 km. C'est le geste de Google Earth, pas un défaut — mais la sonde
   devait ramener la caméra sur La Réunion avant les jalons de surface.
8. ⛔ **« R27 avait mesuré le bon axe dans le mauvais espace. »** Non : elle
   avait mesuré le bon axe (l'aplomb de la cible EST un rayon terrestre) — mais
   ce n'est pas l'axe qui est faux, c'est le point autour duquel OrbitControls
   incline. Tourner autour d'un rayon sans se déplacer dessus n'est pas
   orbiter.

---

## ⑦ RÉSERVES OUVERTES

1. ⚠️ **Sur le crop, le bloc n'est centré sur la visée qu'au calage près
   (≤ 9,33 u).** Avant R32, R27 posait la caméra sur le centre calé du bloc à
   chaque cran — d'où les sauts. Le prix de la continuité : à la naissance du
   crop, le disque du bloc peut être décentré d'un sixième de côté. Mesuré à
   44 km de fond : bascule de trois quarts à 46,04° comme avant, pivot R13
   inchangé ; **non mesuré** : à z12–z13, où les parois du crop entrent dans le
   cadre, l'asymétrie qu'un décentrage de 4,7 u produit. À regarder avec Adrien.
2. ⚠️ **Le retour au nadir après la mort du crop ne finit pas** sur le chemin
   « vue couchée à la butée, puis molette » : 69,7° à la mort, 61° à z4 —
   comme avant (84,9°). D16 ter le prévoit (`_armerRetourNadir`) ; ce n'est pas
   R32 qui l'a cassé, et je ne l'ai pas rouvert.
3. ⚠️ **Le glissé pendant un chargement** (`busy`) est mis en pause, pas
   appliqué : au retour, le point saisi rejoint le pointeur en une image (le
   plafond de 30° borne le saut). Non mesuré au geste réel.
4. ⚠️ **Un seul poste, un seul navigateur**, Chrome sans tête 1280 × 800 ; pas
   de pavé tactile, pas de deux doigts (le second doigt lâche la saisie et rend
   le pincement à `PinchTracker` — par lecture, pas par mesure).
5. ⚠️ **Le clic droit / Maj+glissé hors du crop** déplace maintenant caméra et
   cible sans le recentrage de R27 : c'est une orbite non asservie au curseur.
   Google Earth y met le zoom ; à trancher, pas dans cette tâche.
6. ⚠️ **Le troisième jalon de ma sonde tombe sur le crop** (44 km de fond =
   22 km d'altimètre) : mon instrument vise l'altitude de fond, le brief
   l'altimètre. Le banc de l'attaquant couvre le 50 km d'altimètre hors crop
   (100 km de fond) : 0 px, 0°, 0,136°. Les deux tableaux sont donnés.

---

## ⑧ LES CHIFFRES DE CLÔTURE

| | valeur |
|---|---|
| `npm test` | **4 695 tests · 0 échec** (base 4 675) |
| `npm run audit:tests` | **243 listés · 243 sur disque · aucun écart** |
| recette R33 | **10 / 10** (`node --test test/attaque-r33-ROUGE.mjs`) |
| tests neufs | 25 (`saisie-terre` 17, `pivot-globe` 8) ; réécrits : `pivot-terre` (13), `pivot-molette` ②/② ter, `pivot-bloc` ⑥ (2), `attaque-r33-ROUGE` ②/⑤/⑤ bis |
| commits sur `orbite-jusquau-crop` | `e9dc9a7` (étape 1 : la loi, le branchement, la sonde) · `d4bd6d1` (fusion `regroupement`, R34) · `46111ec` (étape 2 : limbe, pôle, recentrage unique, la molette éteint l'élan, recette 10/10, plancher z4) · le rapport |
| images relevées | `avant.json` 8 143 Ko, `apres.json` 5 242 Ko ; `.banc/R33/` 4 journaux |
