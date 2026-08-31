# D16-b — LA CARTOGRAPHIE S'AFFICHE SUR LA TERRE ENTIÈRE

> **Adrien :** *« Je souhaite avoir la cartographie qui s'affiche sur la Terre
> entière. Pour l'instant elle ne s'affiche que sur certains lieux et avec un
> zoom important. »*

**Statut : ✅ livré, mesuré, testé.** Rivières, lacs et toponymes sont posés sur
la sphère, dans la scène qui est rendue, **de z6 à z12 et partout sur la
planète** — captures dans `.banc/D16b/`.

---

# ⚡ LE CHIFFRE QUI DOIT SURVIVRE À CETTE TÂCHE

> **Le plancher de zoom n'était pour rien dans le défaut d'Adrien, et sur sa
> machine la branche Overpass ne rapporte RIEN — à aucun zoom.**

Mesuré, pas déduit. `scripts/sonde-carto.mjs`, page vivante, mode sphère par
défaut, **avant toute correction** (`.banc/D16b/avant.json`, huit couples
lieu × zoom) :

| | z6 | z8 | z10 | z12 |
|---|---|---|---|---|
| `water` — objets dans le groupe | **8** | 7 | 5 | 3 |
| `places` — objets dans le groupe | **36** | 33 | 30 | 6 |
| scène d'accueil | `scene` | `scene` | `scene` | `scene` |
| `group.visible` | **false** | **false** | **false** | **false** |

➡️ **Les groupes étaient PEUPLÉS à tous les zooms, y compris les petits.** Ils
étaient dans la scène du bloc plat — celle dont D16-a a supprimé la passe — et
éteints par-dessus le marché. **Rien ne manquait dans les données.**

Et l'autre moitié, `scripts/sonde-overpass.mjs`, même chemin que le calque
(`fetchOverpassLines` / `fetchOverpassAreas`), Chamonix :

| emprise | lignes | aires | temps |
|---|---|---|---|
| z12 (20 km) | **REFUS** | REFUS | **6 008 ms** |
| z10 (82 km), page neuve | **REFUS** | REFUS | **6 004 ms** |

**6 000 ms est `OVERPASS_ATTENTE_MS` au chiffre près** : la requête ne revient
jamais. C'est exactement ce que le §« LE BUDGET D'ATTENTE » d'`overpass.js`
avait déjà relevé le 2026-07-31 — *« l'API est injoignable d'ici »*.

⚡ **Donc tout ce qu'Adrien voit, de z6 à z12, vient des données LOCALES déjà
embarquées** : `public/data/map/rivers.json` (10 771 entités),
`lakes.json` (1 345), `places.json` (158 474), plus les tuiles de lacs
mondiales. **Sa Terre entière ne coûte pas une requête réseau.**

---

# LES DEUX CAUSES, ET CE QUI LES FERME

## ① Les couches étaient dessinées dans une scène qui n'est plus rendue

`water-layer.js` et `places-layer.js` faisaient `scene.add(this.group)` **dans
leur constructeur** — la scène du bloc plat. Le rattachement passe désormais par
**`MapLayers.poserScene(scene)`**, un point unique qui **DÉPLACE** au lieu
d'ajouter (deux appels laisseraient sinon deux parents et deux dessins), et que
`main.js` appelle avec `sceneGlobe` sous `fusionDesPasses`.

## ② `mapLayers.setSurfaceVisible(vue.socle)`

`socle` est **borné à faux** sous `terre unique` : accrochée à lui, la carto
était éteinte à toutes les altitudes. `visibilite-surface.js` porte maintenant
une **quatrième réponse, `carto`**, et c'est le même partage qu'au §2 de ce
fichier : `socle` répond à « le maillage du bloc PLAT est-il dessiné », la carto
répond à « sommes-nous en vue de surface, devant un bloc » — et il y a un bloc,
c'est un crop.

⛔ **Pas d'exception ici, contrairement au ciné.** Le §3 éteint le ciné parce
qu'il MANQUE un plancher au crop. La carto ne manque de rien : la brique de
l'étape 1 lui donne le sol du globe.

---

# ÉTAPE 1 — LA BRIQUE, ET CE QU'ELLE N'EST PAS

⛔ **JE N'AI PAS ÉCRIT DE SECOND ÉCHANTILLONNEUR DE RELIEF. LE DÉPÔT EN A DÉJÀ
UN, ET IL EST EN ESPACE GLOBE :** `globe.hauteurDessinee(lat, lon, candidates)`
(Tâche P11) rend en mètres **la hauteur que le GPU dessine** — la loi de nœud de
`_buildMesh`, fond du crop compris. `hauteurSurface` existe à côté et rend la
DONNÉE ; c'est `hauteurDessinee` qu'il faut, sans quoi la rivière se drape sur la
texture pendant que le maillage passe ailleurs (P11 mesurait **18,94 m d'écart
moyen absolu** entre les deux).

**Ce qui manquait était l'ADAPTATEUR**, et c'est tout `src/monde/sol-globe.js` :
les calques raisonnent en coordonnées de BLOC, la sphère parle lat/lon et mètres.

## Les deux seules conversions, écrites

**① HORIZONTALE — aucun scalaire, une RÉCIPROQUE.** Le calque a fabriqué ses
`(x · z)` avec `latLonToWorld(dem, lat, lon)` ; on revient par
`worldToLatLon(dem, x, z)`, sa réciproque exacte, **dans le même fichier et sur
le même `dem`**. Pas de facteur d'échelle, donc pas de facteur d'échelle à se
tromper. ⛔ **Surtout pas `mondeVersLatLonEmprise`** : c'est une SECONDE loi,
calée sur l'emprise du socle et non sur la grille de tuiles du MNT, et `geo.js`
mesure **jusqu'à un sixième de socle** d'écart entre les deux.

**② VERTICALE — et elle porte une ORIGINE.** `terrain.sample` ne rend pas des
mètres : il rend `(altitude − dem.meanM) × echelle`. **Le zéro du bloc est
l'altitude MOYENNE de son emprise, pas le niveau de la mer.** L'oubli de `meanM`
poserait la carto **1 830 m trop bas** à Chamonix, sans rien casser. Le module
rend les deux sens (`metresDe` / `blocDe`) et le test ① mesure l'oubli.

## ⚡ Le contrôle qui attrape une exagération désaccordée

`echelleGlobe / echelleBloc` **doit valoir le `k` de la similitude**
(`facteurEchelle`, `frontiere-rendu.js`) — et seulement si les deux
exagérations sont la même. Le test ⑤ le confronte **par deux chemins
indépendants** (`rapportSimilitude()` et une recopie délibérée de la formule) au
lieu de le supposer, et le second test ⑤ vérifie qu'un désaccord ×2 **ressort
dans le rapport** au lieu d'être muet.

## Le repli, et pourquoi il n'est pas zéro

`hauteurDessinee` rend `null` hors couverture. ⛔ **`null` n'est pas `0`** :
zéro est le niveau de la mer, et le confondre avec « je ne sais pas » collerait
la rivière à la mer au milieu d'une vallée. Le repli est le **sol du bloc**, et
il se **COMPTE**.

⚡ **Mesuré, et le chiffre est bon : `0` repli.** Sur les **519 404 sommets** de
Chamonix z6 comme sur les **181** de l'Amazonie z12, `poseur.refus = 0`. La
réservation de `reserverHauteurs` couvre ce que les calques demandent.

---

# ÉTAPE 3 — LE RELOGEMENT, ET LES TROIS LONGUEURS QUI TRAVERSENT

**La géométrie reste construite en coordonnées de BLOC** — projection, découpe
sur l'empreinte, `offset: 0.07`, `CLEARANCE: 0.9`, médiane des lacs. **Seul le
dernier geste change** : `poseur.placer(x, z, yBloc)` décide si le point atterrit
sur la dalle plate ou sur la sphère. ➡️ **Il n'y a donc qu'UNE conversion, et
elle est dans un seul fichier.**

⛔ **JE N'AI PAS EMPLOYÉ LA SIMILITUDE POUR TRANSPORTER LES CALQUES, ET C'EST
MESURÉ CONTRE.** Un nœud portant `poseFond` aurait été une ligne, mais il pose le
bloc sur le PLAN TANGENT : le tableau ⑦ de `frontiere-rendu.js` chiffre l'écart à
**132 m à z10, 2,1 km à z8, ~33 km à z6** au bord du bloc. Les rivières
flotteraient au-dessus de la planète, et rien ne pourrait plus les occulter.
**Les calques sont donc en coordonnées de globe pour de bon**, ce que la capture
`final-amazonie-z6.png` montre : le tracé de l'Amazone suit la courbure jusqu'au
limbe.

## Les trois longueurs, nommément

| longueur | ce qu'elle devient | ce qui serait arrivé sinon |
|---|---|---|
| **le point au sol** (`CircleGeometry(0.075)`, unités de bloc) | mis à l'échelle par `k` **et** retourné vers la verticale locale | un disque de **4,8 km de rayon**, vu par la tranche partout sauf au pôle nord |
| **l'échelle du sprite** (`BASE_H × scale`) | **NE se convertit PAS** — `sizeAttenuation: false`, donc unités de CLIP | la convertir rendrait les noms **175 fois trop petits** à z12 |
| **la verticale du nuanceur de lac** (`N = vec3(0,1,0)`, `vWorldPos.xz / uHalf`) | repère local du poseur (`uEst`, `uSud`, `uCentre`, `uHalf` converti) | Fresnel, reflet du soleil **et** rampe de couleur faux de la latitude du lieu |

Et une quatrième, dans le désencombrement : le rejet hors fenêtre lit
`|x| > HALF` en unités de bloc. **Comparé à un point de sphère (~100 unités de
l'origine), il rejetterait TOUS les noms, à tous les zooms** — le défaut qu'on
répare, par l'autre bout. Les coordonnées de bloc sont donc gardées par entrée.

## Le drapage, vérifié au chiffre

Écart de chaque sommet d'eau à la **surface DESSINÉE** du globe, en mètres
(`.banc/D16b/final.json`) :

| | z6 | z8 | z10 | z12 |
|---|---|---|---|---|
| Chamonix, médiane | 700 | 175 | 44 | **11** |
| Chamonix, max | 906 | 304 | 204 | 35 |
| Amazonie, médiane | 1 005 | 250 | 63 | — |

⚡ **CE N'EST PAS UNE DÉRIVE, ET LA MÉDIANE SE PRÉDIT AU DIXIÈME DE MÈTRE.**
Les sommets d'eau sont en écrasante majorité ceux des REMPLISSAGES (lacs et
plans d'eau), dont la marge vaut `+0.06` unité de bloc — pas `0.07`, qui est
celle des LIGNES. Avec l'échelle du bloc relevée dans la page vivante :

| | echelleBloc mesurée (unités de bloc / m) | `0,06 / echelleBloc` | médiane MESURÉE |
|---|---|---|---|
| z6 | 8,5710·10⁻⁵ | **700,0 m** | **700 m** |
| z8 | 3,4284·10⁻⁴ | **175,0 m** | **175 m** |
| z10 | 1,3714·10⁻³ | **43,8 m** | **44 m** |
| z12 | 5,4855·10⁻³ | **10,9 m** | **11 m** |

**Quatre sur quatre.** La marge est en unités de bloc **par construction depuis
toujours** ; elle vaut donc plus de mètres quand le bloc couvre plus de sol, et à
z6 elle représente moins de 0,1 % de l'altitude de la caméra — invisible.

⚡ **Et le `1/k` de ces mêmes emprises, relevé dans la page : 3 · 11 · 44 ·
175** (z6 · z8 · z10 · z12), avec `exagGlobe = 2` (`EXAGERATION_UNIQUE`) et
`echelleGlobe / echelleBloc = k` vérifié à l'exécution. **C'est le facteur que
les trois longueurs du tableau précédent auraient pris en pleine figure.**

---

# ÉTAPE 5 — À L'ÉCRAN, QUATRE ZOOMS, DEUX LIEUX ÉLOIGNÉS

`.banc/D16b/final-{chamonix,amazonie}-z{6,8,10,12}.png`, plus
`lacs-{leman,baikal}-z9.png`. Pose de cadrage identique à tous les zooms (la vue
est reposée en unités de bloc, la similitude la transporte).

| | z6 | z8 | z10 | z12 |
|---|---|---|---|---|
| Chamonix — noms LISIBLES après désencombrement | 12 / 36 | 11 / 33 | 10 / 30 | 2 / 6 |
| Amazonie — noms lisibles | 6 / 18 | 3 / 9 | 4 / 12 | 1 / 3 |
| scène · visible | `sceneGlobe` · **true** | idem | idem | idem |

**Ce qu'on lit dessus** — `final-chamonix-z6.png` : le Rhin, le Rhône, la Seine,
la Loire, le Pô, le Danube, et PARIS · BRUSSELS · ROTTERDAM · KÖLN · PRAGUE ·
MUNICH · VIENNA · MILAN · TURIN · MARSEILLE · ROME. `final-amazonie-z6.png` :
l'Amazone, le Rio Negro, le Madeira, le Tapajós, MANAUS · BOA VISTA · SANTARÉM ·
PORTO VELHO · CAYENNE · MACAPÁ — **avec le limbe de la planète en haut de
l'image**. `lacs-leman-z9.png` : le Léman et Neuchâtel avec leur dégradé et leur
reflet, GENEVA · LAUSANNE · BERN · FRIBOURG · ANNECY · SION.

**Régimes d'avant, vérifiés :** `?terre=deux` et `?frontiere=0` gardent les
calques dans `scene`, drapés à plat (`deux.json`, `nofront.json`, captures). La
loi le dit aussi : drapeau baissé, `carto === socle === boutons`, le même
booléen qu'avant — c'est le test ① de `visibilite-surface.test.js`.

---

# ÉTAPE 6 — LE COÛT, ET C'EST DU CPU

⛔ **JE N'AI PAS EMPLOYÉ LA MÉTHODE GPU.** Ce qui s'ajoute est un
`hauteurDessinee` **par sommet de calque** — une recherche de tuile plus une
interpolation de maille, sur le fil principal. Le GPU dessine **exactement les
mêmes objets qu'avant** : ils ont changé de scène, pas de nombre. Compter les
appels de dessin rendrait zéro et rassurerait à tort.

`scripts/sonde-cout-carto.mjs` — A/B **ALTERNÉ** (poseur de globe / poseur plat),
5 tours, **deux sessions**. ⚠️ **On publie la session la MOINS favorable :**

| | sommets sondés | reconstruction GLOBE | reconstruction PLAT | **écart** | par sommet |
|---|---|---|---|---|---|
| z6 | 519 404 | 2 814 ms | 1 116 ms | **+1 698 ms** | **3,27 µs** |
| z8 | 501 359 | 2 578 ms | 1 184 ms | **+1 438 ms** | 2,87 µs |
| z10 | 126 493 | 848 ms | 489 ms | **+359 ms** | 2,84 µs |
| z12 | 18 648 | 123 ms | 72 ms | **+51 ms** | 2,73 µs |

⚠️ **La dispersion entre les deux sessions va jusqu'à 45 %** (z8 : +1 438 puis
+968 ms) — d'où la publication du pire, pas de la moyenne.

**Désencombrement (par image, throttlé) : 0 ms/appel** sur 40 appels, à tous les
zooms — sous la résolution du compteur. **Le coût est une reconstruction, pas une
image** : il se paie au changement de zone ou de cran, pas à 60 im/s.

**Une réduction, et je ne la compte pas comme un gain.** `line-segments.js`
échantillonnait chaque point INTÉRIEUR d'un tracé **deux fois** (fin d'un
segment, début du suivant) ; il pose maintenant les points du tracé d'abord.
**Mesuré : 11 % de sommets en moins** (586 745 → 519 404 à z6). ⛔ **Le TEMPS,
lui, ne sort pas du bruit de session** — je ne l'annonce donc pas comme un gain.

---

# ⚡ « WATER ET PLACES EN ONT-ILS VRAIMENT BESOIN ? » — VÉRIFIÉ, PAS SUPPOSÉ

La tâche voisine (D16-c) a trouvé que la carte de D16 se trompait sur
`ground-info` : le cartouche est posé sur la BASE, **un nombre, pas un champ de
hauteurs**. Consigne reçue : ne pas câbler d'échantillonneur à une couche qui
n'en a pas besoin. **J'ai mesuré les deux miennes plutôt que de raisonner.**

**`water` — oui, et ce n'est même pas discutable.** Les rivières suivent le sol
point par point ; et les lacs, plats par nature, tirent leur NIVEAU de la
**médiane des altitudes de sol sous leurs sommets** (`waterLevelOf`) — donc
d'un champ, pas d'un nombre. **519 404 sommets échantillonnés à z6.**

**`places` — oui, et voici le chiffre.** Un nom est ancré à l'altitude du sol de
SA ville (`groundY + CLEARANCE`), pas à une hauteur fixe. Étendue des altitudes
de sol sous les noms retenus, relevée dans la page (`.banc/D16b/rebase.json`) :

| | noms lisibles | sol, min → max | **étendue** |
|---|---|---|---|
| Chamonix z10 | 10 | 379 → 1 056 m | **677 m** |
| Chamonix z6 | 12 | 3 → 530 m | **527 m** |
| Amazonie z6 | 6 | 9 → 89 m | 80 m |
| Chamonix z12 | 2 | 1 031 → 1 038 m | 7 m |

➡️ **Une altitude unique mettrait un nom jusqu'à 677 m au-dessus ou au-dessous
de sa ville** à Chamonix z10. Un nombre ne suffit pas.

⚡ **ET DE TOUTE FAÇON, JE N'AI ÉCRIT AUCUN ÉCHANTILLONNEUR DE RELIEF.**
`sol-globe.js` **appelle** `globe.hauteurDessinee`, qui existait déjà. Même si
une des deux couches n'en avait pas eu besoin, il n'y aurait pas eu de dette :
il n'y a pas de second champ de hauteurs dans le dépôt, et il n'y en aura pas.

---

# ⛔ LE PIÈGE DE LA VEILLE JAMAIS NOURRIE — je ne suis pas tombé dedans, et voici pourquoi

D16-c a perdu un tour sur `veilleSocle.visible`, **jamais mise à jour sous
`terre unique`** — un état figé à faux ressemble exactement à une couche cachée.

**Je n'ai pas eu à choisir de prédicat : j'ai réutilisé l'écrivain existant.**
`poserVisibiliteSocle(v)` est appelée par `masquerSocle` (entrée en surface) ET
par le relais de mode ; j'y ai seulement fait lire `vue.carto` au lieu de
`vue.socle`. **Mesuré `visible = true` dans les 8 couples lieu × zoom** du relevé
`final.json`, plus les 2 lacs et les 6 relevés de couverture.

⚡ **ET LE PRÉDICAT `globe.baseYCrop != null` AURAIT ÉTÉ FAUX POUR CETTE
COUCHE-CI** — mesuré, pas supposé : à **z6, `veilleCrop.pose` vaut `false`**
(`avant.json` et `final.json`, Chamonix comme Amazonie) et **c'est exactement
l'image qu'Adrien demande** — l'Europe entière avec ses fleuves, ou le bassin
amazonien avec le limbe de la planète. Un prédicat « s'il y a une base, il y a
un bloc » aurait éteint la carto **là où la Terre entière est justement
visible**. Le cartouche est posé SUR la base et a raison de la suivre ; la
cartographie est posée sur la SPHÈRE et suit la vue.

---

# ⚠️ DEUX CHOSES QUE LA CARTE DE D16 DIT ET QUE LA MESURE CONTREDIT

⛔ **① « `places` — le globe a déjà les siens (`peak-labels`, villes). » FAUX,
sur les deux termes.**
· **Il n'existe pas de module `peak-labels`.** `test/peak-labels.test.js` teste
`src/peaks.js`, qui est un calque de **cartouches DOM** posés sur le bloc, pas
des toponymes de globe.
· **`public/data/cities.json` (2 068 villes mondiales) n'est référencé nulle
part** — `grep -rn "cities.json"` sur tout le dépôt hors `node_modules` rend
**zéro ligne**. C'est de la donnée morte.
➡️ **Le globe n'avait AUCUN toponyme.** Il en a maintenant, et ils viennent de
`places.json`, la source que le calque employait déjà.

⛔ **② « ⚠️ Un plancher de zoom en dur … c'est le “zoom important” d'Adrien. »
NON.** Le tableau en tête de ce rapport le mesure : les groupes étaient peuplés
à z6, z8 et z10 comme à z12. Le plancher choisit une SOURCE, pas une PRÉSENCE.
**Il reste à 12**, et `water-layer.js` porte désormais la mesure à côté de la
constante.

---

# ÉTAPE 4 — POURQUOI LE PLANCHER RESTE À 12

1. **Il n'ajouterait aucune donnée.** Overpass REFUSE à z12 comme à z10 sur cette
   machine, en 6 004 ms.
2. **Il étendrait l'attente de 6 s à tous les zooms** sous 12.
3. **Sur une machine qui atteint Overpass, il noierait un service public
   gratuit** — le dépôt mesure z10 Chamonix à **234 594 ways / 286 Mo**.
4. ⚡ **Et la donnée fine n'a pas de sens à petite échelle.** À z8, le bloc fait
   ~330 km pour ~1 280 px : **un pixel vaut 256 m**. Les traits sont dessinés en
   largeur d'**ÉCRAN** (`riverWidthPx` : 0,9 à 3,5 px, `LineSegments2`) : y
   verser 50 000 ways ne donnerait pas des rivières plus fines, **ça donnerait un
   aplat bleu**. Le champ `min_zoom` de Natural Earth EST la généralisation
   cartographique de ce cas, et `filterByZoom` l'applique déjà.

⛔ **Je n'ai PAS mesuré z8 contre le point d'accès public**, et la sonde refuse
de le faire : ce serait demander à un service gratuit de balayer un pays entier
pour un chiffre déductible. La raison est écrite dans son en-tête.

---

# ⚡ UN DÉFAUT TROUVÉ DANS LA GARDE PARTAGÉE, EN REBASANT SUR D16-c

Le compte des lecteurs de `visibilite-surface.test.js` — **la seule garde de
CLASSE de `poserVisibiliteSocle`** — comptait avec
`new RegExp('vue\.' + n, 'g')`, **sans borne de mot**. D16-c a introduit
`vue.cartouche`, D16-b introduit `vue.carto` : ⛔ **`compte('carto')` rendait 2
pour un seul lecteur**, parce que `vue.carto` est un préfixe de
`vue.cartouche`.

**Deux champs dont l'un préfixe l'autre suffisaient à rendre ce compte
silencieusement faux** — et c'est lui qui doit rougir quand un calque change de
grandeur. Une `` le répare, et le commentaire dit pourquoi.

⚡ **ET LE COMPTE DE `vue.socle` TOMBE À NEUF, PAS À DIX.** Les deux tâches l'ont
chacune fait descendre de un (D16-c : `groundInfo` → `cartouche` ; D16-b :
`mapLayers` → `carto`) et chacune a écrit `10` de son côté. **La fusion des deux
donne 9**, et le test le dit maintenant explicitement.

---

# Commits

Rebasés sur `regroupement` (par-dessus D16-c, `8c09a4f`).

| | |
|---|---|
| `26adc81` | **étapes 1 + 2** — la brique et son test rouge |
| `425f9d2` | **étape 3** — `water` et `places` relogées dans la scène du globe |
| `a979631` | **étapes 4 + 6** — le plancher reste à 12, le coût est chiffré |

⚠️ **Conflits résolus, tous les trois dans le partage de `visibiliteSurface`** :
`cartouche` (D16-c) et `carto` (D16-b) coexistent, la ligne `test` de
`package.json` porte les deux tests neufs, et le compte des lecteurs est refait
à neuf. **Rien d'autre ne s'est croisé** : D16-c n'a touché ni `water`, ni
`places`, ni `layer-manager`.

# Tests

**4 340 / 0 échec · audit 223 = 223**, après rebase sur `regroupement`
(4 326 chez D16-c + 14 de `sol-globe.test.js`).

# Fichiers touchés

- `src/monde/sol-globe.js` — **NEUF**, la brique : les deux conversions, le
  repli compté, le repère local, le contrôle de similitude
- `src/monde/visibilite-surface.js` — la quatrième réponse, `carto`
- `src/map/layer-manager.js` — `poserScene` (point unique de rattachement),
  `poserFabricantDePoseur`
- `src/map/water-layer.js` — plus de `scene.add`, poseur, pas de plans de coupe
  en espace globe, repère du lac ; **et la mesure à côté d'`OSM_MIN_ZOOM`**
- `src/map/places-layer.js` — plus de `scene.add`, poseur, disque redressé et mis
  à l'échelle, désencombrement en coordonnées de bloc avec la bonne caméra
- `src/map/line-segments.js` — `poseur` au lieu de `sample`, un point posé une
  fois
- `src/map/lake-material.js` — verticale et plan locaux (`uGlobe`, `uCentre`,
  `uEst`, `uSud`)
- `src/main.js` — `poserScene(sceneGlobe)`, `setCamera(camGlobe)`, le fabricant
  de poseur, `vue.carto`
- `test/sol-globe.test.js` — **NEUF**, 14 tests
- `test/visibilite-surface.test.js` — la **cinquième** réponse (`cartouche` de
  D16-c reste) ; le compte des lecteurs de `vue.socle` passe à **9**,
  expressément, et **la borne de mot qui manquait au compteur**
- `test/fenetre-branchee.test.js` — le seizième `lireExageration`, légitime :
  le poseur doit lire la MÊME exagération que `_makeDemSampler`
- `scripts/sonde-carto.mjs`, `scripts/sonde-overpass.mjs`,
  `scripts/sonde-cout-carto.mjs` — **NEUFS**
- `package.json` — la ligne `test`

---

# Réserves

1. ⚠️ **+1 698 ms de fil principal à z6, et je ne l'ai pas réduit.** C'est un
   coût de RECONSTRUCTION (changement de zone ou de cran), pas d'image, mais il
   s'ajoute à une reconstruction qui coûtait déjà 1 116 ms. **La piste est
   nommée et non explorée** : `_tuileLaPlusFine` (`globe.js`) parcourt TOUTE la
   liste des candidates par sommet alors que `tuilesAvecHauteurs()` la rend
   **triée du plus fin au plus grossier** — le premier point couvrant EST déjà
   le meilleur. Un `break` y serait exactement équivalent *pour cet appelant*,
   mais `candidates` est un paramètre public et rien ne garantit le tri chez les
   autres. **Je n'y ai pas touché** : c'est un chemin partagé, hors périmètre.
2. ⚠️ **La conversion verticale suppose que `dem.meanM` est le zéro du bloc**,
   ce que `terrain._makeDemSampler` écrit aujourd'hui. Si un jour le sampler
   change d'origine, **rien ne rougira** : le test ① garde la LOI du module, pas
   l'accord entre le module et `terrain.js`. Les deux formules sont à trois
   lignes l'une de l'autre dans mon commentaire, c'est tout ce que j'ai.
3. ⚠️ **Le grain FBM du bloc n'existe pas sur le globe, et je ne l'ai pas
   mesuré.** `terrain.sample` ajoute un bruit fin au-dessus de 90 m ;
   `hauteurDessinee` ne le porte pas. Les rivières suivent donc la surface du
   globe et non celle du bloc — ce qui est **exactement ce qu'on veut** puisque
   c'est le globe qui est dessiné —, mais **je n'ai pas chiffré l'amplitude de
   ce grain**, donc je ne peux pas dire de combien les deux drapages diffèrent
   là où ils coexisteraient.
4. ⚠️ **Aucun toponyme à Baïkal z9** (`places 0 obj`) — vérifié à l'écran.
   C'est la loi de sélection (`pickPlaces` / `place-tier.js`), **inchangée par
   cette tâche**, pas le relogement. Je le signale parce que « la Terre
   entière » invite à y regarder, et je ne l'ai pas creusé.
5. ⚠️ **Le mode `?f3=1` (fenêtre continue 3×3) et le globe ne sont pas exercés
   ensemble.** Les plans de coupe sont fabriqués en coordonnées de bloc et
   couperaient un hémisphère ; je les COUPE explicitement en espace globe et je
   l'ai écrit à l'endroit exact. Aujourd'hui les deux ne se croisent pas
   (`empriseFootprint()` rend `null` dès que `empriseCote` vaut 1), **mais rien
   ne le garantira le jour où ils se croiseront.**
6. ⚠️ **Overpass est injoignable depuis ce poste**, comme le dépôt le notait
   déjà. **Mes conclusions de l'étape 4 sur la CHARGE d'une emprise z10/z8
   reposent donc sur les chiffres du dépôt, pas sur les miens** — les miens ne
   disent que « refus en 6 s ». Un poste qui atteint le service donnerait un
   verdict de charge que je n'ai pas pu produire.
7. ⚠️ **Un seul poste, un seul navigateur, SwiftShader sans tête.** Les temps
   CPU sont des ordres de grandeur d'ici, pas de la machine d'Adrien.
