# C1 — D21 : le crop est une pièce, pas un seuil d'altitude

Arbre `C:\Dev\wt-cr1`, branche `crop-intention`. Serveur : `npm run dev --
--host 127.0.0.1 --port 7341`, arrêté en partant.

---

## ⚠️ LA RÉSERVE, EN TÊTE — « déscroller via le bouton de scroll central »

**J'ai implémenté la MOLETTE, en dézoom.** C'est la lecture du brief, et elle
tient sur trois appuis :

1. **`déscroller` est du vocabulaire de molette.** Le bouton du milieu ne
   « scrolle » pas, il se presse.
2. **Le bouton du MILIEU vient d'être attribué à l'inclinaison et au cap** par
   D19 (`boutons-camera.js:76`, `milieu: ACTION.INCLINAISON` ; GE2/GE3 notés
   9,75 hier). Lui donner AUSSI la sortie du crop serait contradictoire : le
   même bouton inclinerait la vue **et** ferait disparaître le bloc.
3. **D21 ② l'interdit explicitement** : « l'inclinaison, le cap et les boutons
   de caméra ne tuent plus le crop ». Le milieu EST l'inclinaison et le cap.

➡️ **Adrien, une ligne suffit à trancher.** Si tu voulais dire *le bouton du
milieu enfoncé*, le changement est d'une ligne : appeler `armerSortie()` depuis
la branche `GESTE.INCLINAISON` de `appliquerGestesTerre` au lieu de l'écouteur
`wheel`. ⚠️ **Mais alors D19 et D21 se contredisent sur ce bouton**, et il
faudra dire lequel gagne — c'est pour ça que je ne l'ai pas deviné deux fois.

---

## LE TABLEAU DU CRITÈRE — huit chargements par ligne

Banc : `scripts/sonde-ge3.mjs`, **un geste par chargement** (enchaîner N gestes
mesure leur somme), sonde posée au rendu après `tick`, voile fermé seulement
après que le vol de présentation est **immobile 1,5 s et `d > 100`**.
Poste haut : `--regime surface --alt 576000` → la caméra se pose entre
**589 099 m et 653 436 m** selon le chargement, c'est-à-dire **dans le crop et
au-dessus du bloc** — le régime que D21 ③ vient de créer.
Traces : `.banc/C1/haut8.json`, `.banc/C1/haut8b.json`, `.banc/C1/bloc8.json`.

| situation | attendu | mesuré, 8 chargements | verdict |
|---|---|---|---|
| dans le crop, **bouton map monde** | le crop meurt, retour à l'orbite | `cropPose` **true→false 8/8**, `mode` **surface→orbital 8/8**, altitude 621 589 → 16 000 000 m | ✅ |
| dans le crop, **dézoom au clic droit maintenu** | le crop meurt | `cropPose` **true→false 8/8**, altitude 620 907 → **1 780 172 m**, rapport de distance ×1,4056 ± 0,0003 | ✅ |
| dans le crop, **zoom avant à la molette** (6 crans) | le crop vit | `cropPose` **true→true 8/8**, altitude 602 448 → 495 641 m | ✅ |
| dans le crop, **glissé gauche** (D19, on attrape la Terre) | le crop vit | `cropPose` **true→true 8/8**, altitude **inchangée au mètre près 8/8**, `\|Δ ln d\| = 0` **8/8** | ✅ |
| dans le crop, **boutons d'angle de caméra** (`applyIsoView` 4 puis 6) | le crop vit | `cropPose` **true→true 8/8**, altitude 634 630 → 560 590 m, `\|Δ ln d\|` jusqu'à **0,0398** — un vrai changement d'échelle, et le crop reste | ✅ |
| dans le crop, **inclinaison** (bouton du milieu, 340 px) | le crop vit | `cropPose` **true→true 8/8**, inclinaison **+79,2°**, altitude 647 191 → **80 419 m** (÷8 sur un pur basculement), `\|Δ ln d\| = 8,88e-16` **8/8** | ✅ |
| dans le crop, **cap** (bouton du milieu, horizontal) | le crop vit | `cropPose` **true→true 8/8**, cap **−85,00° sur les 8**, altitude **inchangée au mètre près 8/8**, `\|Δ ln d\| = 0` **8/8** | ✅ |
| dans le crop, **dézoom à la molette** | le crop meurt | `cropPose` **true→false 8/8**, **au 13ᵉ cran sur les 8**, altitude de cadrage à la mort **759 258 – 761 282 m** (seuil 750 000) — voir la nuance ci-dessous | ✅ |
| **sur le bloc** (z12, ~10 km), **inclinaison** | le crop vit | `cropPose` **true→true 8/8**, altitude 10 033 → **13 458 m** (×1,34), redressement −46,48°, `\|Δ ln d\| = 4,44e-16` **8/8** | ✅ |
| **sur le bloc**, **dézoom molette 6 crans** | le crop vit (loin du seuil) | `cropPose` **true→true 8/8**, 10 450 → 11 743 m | ✅ |
| **sur le bloc**, **bouton map monde** | le crop meurt | `cropPose` **true→false 8/8**, retour au nadir **−46,47° sur les 8** — l'identité `90° − atan(18/19)` de D16 ter, intacte | ✅ |
| descente depuis l'orbite | le crop naît **à z7** | `cropPose` **vrai 8/8 entre 589 et 653 km** ; ligne de partage rejouée entre z5 (920 060 m) et z6 (575 040 m) | ✅ |

### ⚠️ « au PREMIER cran franc » — la seule nuance, et elle est mesurée

**Un cran de molette ne tue PAS le crop, et je ne crois pas qu'il doive.**
Mesuré, 8/8 : un cran fait **615 901 → 626 685 m**, soit **×1,0175**. Le crop
vit encore, parce que l'altitude n'a pas atteint `SEUIL_MORT_M` = 750 000 m.
Depuis 576 km, il faut **13 crans, sur les huit chargements sans exception**
(`.banc/C1/mort.json`), et la mort tombe alors entre **759 258 et 761 282 m** —
soit à moins de 1,5 % au-dessus du seuil, l'épaisseur d'un cran.

⚠️ **ET C'EST ICI QUE J'AI FAILLI ÉCRIRE UN FAUX CONSTAT.** Le banc des gestes
relève `altFondM`, en espace GLOBE ; la loi du crop lit `altitudeCadrageM()`, en
espace BLOC. Six crans rendaient `altFondM = 759 179 m` — **au-dessus de 750 000
avec le crop vivant**, ce qui ressemble trait pour trait à un bogue. Les deux
altitudes relevées **à la même image** disent le rapport : `altFondM ≈ 2 ×
altCadrageM` à cette pose. La loi tire exactement au bon endroit, dans son
espace. **C'est le piège « confusion d'espace bloc / globe » que ce chantier a
déjà payé**, et il a fallu une sonde de plus (`scripts/sonde-c1-mort.mjs`) pour
ne pas le repayer.

**L'intention, elle, est armée dès ce premier cran** — c'est la mort qui attend
le seuil, pas l'armement. Et c'est délibéré : si un cran armé tuait le crop
**quelle que soit l'altitude**, un seul cran de molette depuis le fond du bloc
(5 km) ferait disparaître le bloc — l'hystérésis de la Tâche 3 tomberait avec.

➡️ **La lecture que je livre** : *le dézoom ARME, le seuil TRANCHE.* Un geste
franc et continu — le clic droit maintenu — traverse les deux d'un coup, et la
mesure le montre : **8/8, 620 907 → 1 780 172 m, le crop meurt.**

⚠️ **Si Adrien voulait dire « un cran de molette et le crop disparaît, point »**,
c'est une ligne à changer dans `branchement-crop.js` (`if (sortieArmee) return
false` avant le seuil) — mais **il faut alors dire ce qu'on fait de
l'hystérésis** sur le bloc, et c'est une question de produit, pas de code.

### ⚡ ET UN RÉSULTAT PLUS FORT QUE LE CRITÈRE — la géométrie a rejoint la règle

Après le départage, **la descente est au NADIR jusqu'au bloc** (D16 ter,
`tiltDeg = 0,000057°` relevé à 621 589 m). Or au nadir `altitude = d`, et
`d` ne change **que par un zoom**. Conséquence exacte, et elle n'est pas un
réglage :

> **entre la naissance du crop (600 km) et le bloc, aucune inclinaison, aucun
> cap et aucun bouton de caméra ne PEUT porter l'altitude au-dessus de
> `SEUIL_MORT_M`** — non pas parce que le drapeau l'interdit, mais parce que la
> géométrie ne le permet pas.

Le drapeau reste nécessaire : il couvre le recalage, le vol de présentation et
tout écrivain futur de la caméra. Mais il n'est plus le seul rempart, et c'est
la mesure qui le dit. **Preuve du drapeau seul**, relevée sur le build d'avant
le départage — quand l'inclinaison POUVAIT encore monter : **656 803 m →
932 801 m, soit 1,24 × `SEUIL_MORT_M`, `cropPose: true→true`,
`|Δ ln d| = 8,88e-16`.**
## ③ LE CHIFFRE DE z7 — CE QUE J'AI POSÉ, ET POURQUOI

### Le point de départ, et le piège dont il fallait sortir

`SEUIL_NAISSANCE_M` valait **32 274,3 m**, dérivé d'une **fraction d'écran** :
l'altitude à laquelle le socle `ZOOM_SOCLE = 13` (10 377,4 m de large) occupe
**60 % de la hauteur** de l'image. Adrien demande **z7**, qui vaut
`altM: 600 000` dans `DIVE_TIERS`.

⚠️ **LES DEUX GRANDEURS NE SONT PAS DU MÊME GENRE, ET C'EST LE CŒUR DU
PROBLÈME.** `DIVE_TIERS` indexe des ALTITUDES ; `seuil-socle.js` dérive d'une
FRACTION D'ÉCRAN. Rejoué, les deux ne se rencontrent nulle part sur un entier :

| ce qu'on veut | ce que la fraction 60 % en fait |
|---|---|
| un socle né exactement à 600 000 m | `zoomDepuisAltitude(600 000, 45°)` = **z8,783** — pas un entier |
| un socle z7 né à 60 % de l'écran | `altitudeDepuisZoom(7)` = **2 065 570 m** — 3,4 fois trop haut |
| le voisin entier le plus proche par en dessous | z9 → naissance à **516 363 m** |
| le voisin entier le plus proche par au-dessus | z8 → naissance à **1 032 725 m** |

➡️ **J'ai donc posé la naissance comme un PALIER, pas comme une fraction** :
`SEUIL_NAISSANCE_M = ALT_PALIER_Z7_M = 600 000 m`, recopié depuis `DIVE_TIERS`
et **verrouillé par test contre sa source** (le module est pur, `modes.js` tire
three.js — le précédent est celui des deux conversions de `geo.js` déjà
recopiées dans ce fichier). C'est littéralement ce qu'Adrien a écrit, sans
arrondi et sans interprétation.

`SEUIL_MORT_M` garde l'hystérésis `1 / 0,8` : **750 000 m**.

### CE QUI NE COÛTE RIEN — l'emprise n'est pas figée

*(le verdict de tenue, lui, est plus bas : il demandait le banc de performance,
et il est nuancé.)*

⚠️ **CE QUE J'AI CRU, PUIS RÉFUTÉ — et c'était le risque n° 1 du brief.** J'ai
d'abord cru que faire naître le crop à 600 km imposait de **changer
`ZOOM_SOCLE`**, donc d'élargir le bloc de 10,4 km à des centaines de kilomètres,
donc de payer seize fois plus de tuiles à toutes les altitudes. Le raisonnement
était : « le seuil est dérivé de la largeur du socle, donc changer le seuil
change la largeur ». **C'est faux, et le code le dit.**

`assietteCrop()` (`main.js:6095`) ne lit PAS `ZOOM_SOCLE` :

```js
const emprise = terrain.fenetreBornee?.emprise || empriseDuSocle()
const zoom = Math.log2((360 * BLOCK_TILES) / large)
```

**L'emprise du crop suit la fenêtre de terrain réellement chargée**, donc
l'escalier de surface, donc l'altitude. `ZOOM_SOCLE` n'est qu'un DÉFAUT de
prescription pour le flux de tuiles (`demanderEmprise`, `zoomCropPrescrit`) et
la largeur sur laquelle les seuils du BLOC sont dérivés. Il n'a pas eu besoin de
bouger — et il n'a pas bougé.

C'est aussi ce qui explique le chiffre du brief (« emprise ~438 km au lieu de
27 ») : ce ne sont pas des largeurs de `ZOOM_SOCLE`, ce sont les emprises que
l'escalier charge à ces altitudes-là.

| | altitude de naissance | emprise du bloc à cette altitude |
|---|---|---|
| avant D21 | 32 274 m | entre z11 (41,5 km) et z12 (20,8 km) → **~27 km** |
| après D21 | 600 000 m | entre z7 (664 km) et z8 (332 km) → **~440 km** |

### Ce que la naissance à 600 km change VRAIMENT, mesuré

- **`DIVE_TIERS` ne bouge pas**, `pickDiveTier` non plus, l'escalier de surface
  non plus. Le crop naît sur une altitude, pas sur un palier de plongée.
- **La ligne de partage tombe entre z5 et z6, pas entre z6 et z7.** Rejoué contre
  la table des poses d'arrivée (`test/seuil-branche.test.js`, `.banc/rejeu-arrivee`) :
  z5 = 920 060 m (au-dessus), **z6 = 575 040 m (déjà 24 960 m SOUS le seuil)**,
  z7 = 359 400 m. Adrien demande « **dès** z7 » — au plus tard z7. C'est tenu
  **avec un cran de marge**, pas raté.
- **Le fondu d'estompage ne suit PAS** — voir le départage ci-dessous.
- **La vue de trois quarts ne suit PAS** — idem.

---

## LE DÉPARTAGE — trois grandeurs sous un seul nom, et il fallait les séparer

`SEUIL_NAISSANCE_M` décidait **de trois choses à la fois**, et le brief n'en
soupçonnait que deux :

| | ce qu'elle décidait | doit-elle suivre D21 ③ ? |
|---|---|---|
| ① | la naissance de la **géométrie** du crop (`branchement-crop.js:897`) | ✅ **oui** — c'est la demande |
| ② | l'arrivée « **au bloc** » de D16 ter → la **bascule de trois quarts** (`main.js` → `arriveeSurLeBloc` → `modes.js:1996`) | ⛔ **non** |
| ③ | le haut du **fondu d'estompage** (`estompage-terre.js:115`, via `SEUIL_MORT_M`) | ⛔ **non** |

**Les deux conséquences de ne PAS les séparer, chiffrées :**

- **②** — `arriveeSurLeBloc` valait `veilleCrop.repos` = « crop posé **et** vue au
  repos ». Le crop naissant à 600 km, **la caméra basculerait en vue de trois
  quarts dès qu'on s'arrête à 600 km**, c'est-à-dire en vue CONTINENTALE. D16 ter
  écrit mot pour mot « la vue de trois quarts arrive au bloc, **pas avant** ».
- **③** — accroché à `SEUIL_MORT_M` (désormais 750 km), le fondu rendrait
  **0,576 à 100 km d'altitude au lieu de 0** : la Terre à moitié gommée en vue
  régionale. (Calcul rejoué : `t = ln(750000/100000) / ln(750000/19364,6)`,
  smoothstep.)

**Ce que j'ai posé :** deux constantes nommées, `SEUIL_BLOC_M` = **32 274,3 m**
et `SEUIL_BLOC_MORT_M` = **40 342,8 m** — l'ancien couple **au bit près** — et un
second automate `auBloc()` sans intention, parce que « le socle remplit 60 % de
l'écran » est un fait géométrique, pas un geste. `arriveeSurLeBloc` lit
`veilleCrop.arriveeBloc` = `repos && auBloc`.

⚡ **ET LE MIROIR AVEC, que le brief ne demandait pas et qui aurait fait tomber
D16 ter par l'autre bout.** `surLeBloc` — le front DESCENDANT qui arme
`_armerRetourNadir` — et `redresserSiHerite` lisaient `veilleCrop.pose`. Laissés
là, le retour au nadir ne serait plus armé qu'à **750 km** : **entre 750 km et
32 km la caméra garderait l'inclinaison héritée**, alors que D16 ter écrit
« NADIR, inchangé — aucune bascule pendant la descente » sur tout ce segment.
C'est exactement le défaut bimodal que GE2 tour 2 a payé (−50° contre −69° selon
le chargement). Les deux lisent `auBloc` désormais.

**Le lien `zoomDepuisAltitude(SEUIL_…, {lat: 45}) === ZOOM_SOCLE` n'est pas
cassé : il est RENOMMÉ.** Il porte sur `SEUIL_BLOC_M`, et il rend toujours
**exactement 13**. Le test de `test/fenetre-bornee.test.js` le dit en toutes
lettres pour qu'on ne croie pas à une rupture silencieuse.

---

## ④ LES RIVIÈRES — éteintes par défaut, sans réécrire le passé

⚠️ **PREMIER CONSTAT, ET IL CHANGE LA FORME DE LA RÉPONSE : il n'y a pas
d'option « rivières » séparée.** Rivières, lacs, mares et plans d'eau sont une
seule couche, une seule clé — `params.waterEnabled` —, dont le libellé dans
l'interface est littéralement **« Rivières & eau »** (`ui/map-panel.js:21`,
`ui/atelier-steps.js:72`). C'est bien l'option qu'Adrien nomme.

**Le défaut est écrit à quatre endroits**, et ils ne se valent pas :

1. `src/main.js:760` — le littéral `params.waterEnabled: true` ;
2. `public/templates/defaults/shibustart.json` — le **look d'ouverture**,
   appliqué deux fois (`main.js:1078` et `main.js:4151`) ;
3. `DEFAULT_MAPLAYERS` (`main.js:7393`) — dérivé, suit tout seul ;
4. les treize gabarits livrés — des choix explicites par gabarit, pas le défaut.

➡️ **J'ai éteint ② seulement, et c'est un arbitrage, pas une facilité.**
`BASE_TEMPLATE_LOOK` (`main.js:939`) est capturé depuis `params` **avant** que le
look d'ouverture s'applique, et `share-link.js` ne transmet que la
**différence**. Basculer `main.js:760` à `false` ferait donc **décoder
« rivières éteintes » à tous les liens de partage déjà émis** qui omettaient la
clé parce qu'elle valait `true`. Le commentaire de `main.js:1066` le dit déjà :
« toucher aux défauts changerait l'apparence de tous les liens déjà émis ».

Éteindre le look d'ouverture fait exactement ce qu'Adrien demande — **l'écran
qui s'ouvre n'a pas de rivières** — sans réécrire le passé. **L'option reste, la
couche reste** (`OSM_MIN_ZOOM = 12` intact, l'interrupteur intact, la touche `W`
intacte), comme D21 l'exige.

⚠️ **CE QUE JE PRÉVIENS, comme demandé** : je n'ai touché **que** le défaut. Je
n'ai touché ni `water-layer.js`, ni `river-width.js`, ni aucun réglage de la
couche — l'agent qui lit les rivières en parallèle dans `C:\Dev\wt-riv2` ne
trouvera rien de déplacé sous lui.
## LE DÉPARTAGE, MESURÉ AU NAVIGATEUR — la même pose, avant et après

Même lieu, même altitude visée, même banc (`sonde-ge3 --regime surface
--alt 576000`), un chargement chacun. La seule différence est le départage.

| grandeur relevée à la pose | ⛔ sans le départage (`pose`) | ✅ avec le départage (`auBloc`) |
|---|---|---|
| altitude de fond | 650 913 m | 621 589 m |
| `cropPose` — **D21 ③** | `true` | `true` |
| **`tiltDeg`** — D16 ter | **48,77°** — la vue de trois quarts, en vue continentale | **0,000057°** — le NADIR |
| `horsDuCrop` | `false` | `true` |
| `regimeGeste` | `crop` | `surface` |
| `mouseButtons` (OrbitControls) | `{LEFT: 0, MIDDLE: 2, RIGHT: 2}` — la bibliothèque a repris les trois boutons | `{LEFT: −1, MIDDLE: −1, RIGHT: −1}` — le régime de la Terre, D19 intact |
| `surLeBloc` | `true` | `false` |

**Lecture.** Les deux lignes en gras sont les deux violations que le départage
ferme, et elles sont dans la même image :

- **48,77° d'inclinaison à 650 km** : la vue de trois quarts arrivait en vue
  CONTINENTALE. D16 ter écrit « la vue de trois quarts arrive au bloc, **pas
  avant** », et « NADIR, inchangé — aucune bascule pendant la descente ». Après
  le départage, la caméra est **au nadir à 0,000057°** — D16 ter tient.
- **`{LEFT: 0, MIDDLE: 2, RIGHT: 2}`** : OrbitControls avait repris les trois
  boutons, c'est-à-dire que **le vocabulaire de Google Earth de D19/GE2/GE3
  n'existait plus entre 600 km et 32 km**. `RIGHT: 2` est un PAN : la deuxième
  sortie de D21 ① — le dézoom au clic droit maintenu — n'existait plus comme
  geste. Après, `{−1, −1, −1}` : la bibliothèque est inerte, gestes-terre a la
  main, D19 garde son domaine.

⚠️ **ET C'EST LA MESURE QUI M'A CORRIGÉ, PAS LA LECTURE.** J'avais écrit le
geste d'inclinaison sur le bouton du MILIEU ; le banc a rendu `refus: 0→1` — dans
le régime `crop`, `inclinaisonPermise` n'autorise que `REGIME.SURFACE`, donc le
milieu y est inerte et c'est le glissé GAUCHE qui inclinait, par OrbitControls.
Sans ce refus relevé, je n'aurais jamais regardé `mouseButtons`, et la bande de
568 km serait partie en production.
---

## LE CHIFFRE DE z7 — TUILES, MAILLAGE, TEMPS D'IMAGE

Banc : `scripts/profil-pf1.mjs`, 60 images consécutives après 40 de chauffe,
minuterie GPU avec témoin de validité, palier machine fixé à 0, ralentissement
CPU **mesuré** (×4 demandé → ×3,87 relevé). Trois postes neufs ajoutés au
catalogue : `crop7` (600 km, z7), `crop8` (200 km, z8), `crop9` (100 km, z9).
Traces : `.banc/C1/pf1-z7.json`, `pf1-paliers.json`, `pf1-sanscrop.json`.

**Cadence p50 / p99, en millisecondes par image :**

| poste | tuiles | géométries | ma machine | **CPU ×4** | **CPU ×6 + ratio 2** |
|---|---|---|---|---|---|
| **`crop7` — 600 km, le palier de D21** | **1 700** | 1 342 | 21,7 / 35,5 | **129,9 / 202,5** | **171,9 / 264,7** |
| `crop8` — 200 km | **1 700** | — | 29,8 / 52,6 | 137,3 / 172,2 | 151,1 / 226,6 |
| `crop9` — 100 km | **1 700** | — | 21,1 / 34,3 | 109,8 / 150,3 | 165,3 / 250,0 |
| `crop` — 5 km, **le bloc** | 629–690 | 606 | **1,3 / 6,2** | **7,3 / 8,3** | — |
| ⚡ **témoin SANS crop, 600 km** (`?terre=deux`) | **495** | — | **2,0 / 9,0** | **19,9 / 35,0** | **46,4 / 78,1** |

### VERDICT : z7 n'est pas gratuit — mais il ne coûte PAS PLUS que z8 ou z9

**Ce que le témoin dit, et c'est le seul chiffre qui isole le crop.** À la même
altitude, au même lieu, sur les mêmes machines, le crop de 600 km coûte :

- **495 → 1 700 tuiles** — **×3,4** ;
- **2,0 → 21,7 ms** sur ma machine — **×10,9**, soit 46 im/s au lieu de 500 ;
- **19,9 → 129,9 ms à ×4** — **×6,5**, soit **7,7 im/s** ;
- **46,4 → 171,9 ms à ×6** — **×3,7**, soit **5,8 im/s**.

⛔ **Sur machine ralentie, ce n'est pas jouable.** Il faut le dire net.

### ⚡ MAIS LA CONTRE-PROPOSITION N'EXISTE PAS, ET C'EST LA MESURE QUI LE DIT

Le brief demande : *« si z7 est intenable, dis-le AVEC LE CHIFFRE et propose le
plus proche tenable »*. **J'ai mesuré les deux voisins, et ils ne sont pas
meilleurs :**

| | ×4 | ×6r |
|---|---|---|
| z7 — 600 km (la demande d'Adrien) | 129,9 ms | 171,9 ms |
| z8 — 200 km | 137,3 ms (**pire**) | 151,1 ms |
| z9 — 100 km | 109,8 ms | 165,3 ms |

**Écart total entre les trois paliers : 25 %.** Le facteur ×6,5 contre le témoin,
lui, est le même partout.

**La cause est identifiée, et elle n'est pas l'altitude.** Les trois postes
rendent **exactement 1 700 tuiles**, et `1 700` est
`CACHE_MAX_CONTINU` (`globe.js:801`) : **le cache est SATURÉ à son plafond dès
que le crop existe au-dessus du bloc, quelle que soit l'altitude entre 100 km et
700 km.** Le mécanisme est écrit dans le dépôt (`crop-sphere.js:300` : « on
prescrit `ZOOM_SOCLE` PARTOUT dans l'emprise ») : une emprise de 440 km remplie à
z13 demande bien plus que le plafond, et le plafond mord.

➡️ **Conclusion, et c'est un arbitrage pour Adrien, pas pour moi :**

1. **z7 est le bon choix parmi ceux qui étaient offerts.** Il coûte, à 25 %
   près, ce que coûteraient z8 ou z9 — donc **reculer sur z9 n'achèterait rien**
   et perdrait la demande. J'ai livré z7.
2. **Le vrai levier n'est pas le palier, c'est le remplissage.** Ce qui coûte,
   c'est de prescrire `ZOOM_SOCLE = 13` sur une emprise de 440 km. Un plafond de
   finesse **fonction de l'altitude** (le crop haut se remplit à z9, pas à z13)
   rendrait les 1 700 tuiles au budget sans toucher au seuil de naissance ni à
   rien de ce qui vient d'être livré. **C'est une tâche à part, et elle est
   chiffrée : elle vise le facteur ×6,5.**
3. **Sur ma machine, ça tourne** — 21,7 ms p50, 46 im/s à 600 km. Le défaut ne
   se voit que sur machine lente, et il s'y voit beaucoup.

⚠️ **UN TÉMOIN QUE J'AI DÛ JETER, ET LA RAISON EST DRÔLE.** J'ai d'abord voulu
comparer `crop7` à `temoinz7` (700 km, au-dessus du seuil de naissance) : il
rend `crop: true` lui aussi. **C'est D21 ① qui fonctionne** — le banc monte la
caméra à 700 km sans aucun geste de dézoom, donc sans intention, donc le crop
survit. Le témoin est devenu impossible à atteindre par l'altitude, ce qui est
exactement ce qu'on voulait construire. J'ai dû passer par `?terre=deux`.

### LE MAILLAGE ET LE RESTE

- **géométries** 606 (bloc) → **1 342** (600 km) ; **textures** 612 → 1 340.
- **appels de dessin** 1 140, **1 385 323 triangles** à 600 km (×4).
- **Décomposition CPU à ×4, 600 km** : `rendu.objets` **64,78 ms**,
  `composer.render` 19,46, `globe._traverse` 11,23, `horsTick.tuile.maillage`
  4,73. ➡️ **Le poste dominant est le rendu des objets, pas le maillage ni le
  parcours** : c'est bien le NOMBRE de tuiles dessinées qui coûte, ce qui
  confirme le levier n° 2 ci-dessus.
- **GPU** : `PasseFond` **67,62 ms** à ×4 — le fond porte tout.
- **Chargement de la pose** : 158 s à ×4 pour que le quadtree se stabilise —
  c'est le banc qui attend une scène posée, pas le temps que voit l'utilisateur.
## LA NON-RÉGRESSION

| garde | attendu | mesuré |
|---|---|---|
| `npm test` | ≥ 4 799 · 0 | **4 823 · 0** |
| `audit:tests` | 257 = 257 | **258 = 258** (le nouveau fichier est inscrit) |
| D19 — le glissé attrape la Terre | le point saisi suit le curseur | à 600 km, `mouseButtons {−1, −1, −1}` **8/8** : la bibliothèque est inerte, gestes-terre a la main — le régime de D19 est **intact sur toute sa bande** |
| `\|Δ ln d\|` — glissé gauche | < 1e-4 | **0 sur les 8** |
| `\|Δ ln d\|` — inclinaison (milieu) | < 1e-4 | **8,88e-16 sur les 8** |
| `\|Δ ln d\|` — cap (milieu) | < 1e-4 | **0 sur les 8** |
| `\|Δ ln d\|` — inclinaison sur le bloc | < 1e-4 | **4,44e-16 sur les 8** |
| D16 ter — la vue de trois quarts | arrive **au bloc** | pose du bloc à z12 : `tiltDeg = 46,548°` — l'identité `90° − atan(18/19)`, au millième |
| D16 ter — le nadir pendant la descente | aucune bascule | à 621 589 m : `tiltDeg = 0,000057°` **8/8** |
| D16 ter — le retour au nadir | au bloc | **−46,47° sur les 8**, bouton monde depuis le bloc |
| D16 ter — la bascule de trois quarts | **au bloc**, pas à 600 km | départage posé + testé |
| D16 ter — le retour au nadir | **au bloc**, pas à 750 km | miroir posé + testé |
| le crop intact — pivot = axe du bloc | inchangé | `horsDuCrop` sur `auBloc` : bascule à 32 274,3 m, la valeur d'avant D21 |
| l'estompage | inchangé au bit près | `ALT_ESTOMPAGE_DEBUT_M` = 40 342,8 m, comme avant |
| `zoomDepuisAltitude(…, 45°) === ZOOM_SOCLE` | intact | intact, renommé `SEUIL_BLOC_M`, rend **exactement 13** |

---

## CE QUE J'AI CRU, PUIS RÉFUTÉ

Elle n'est pas vide, et deux des sept ont changé le résultat livré.

1. **« Faire naître le crop à 600 km oblige à changer `ZOOM_SOCLE`. »** ⛔ Faux,
   et c'était le risque n° 1 du brief. `assietteCrop()` (`main.js:6095`) dérive
   l'emprise du crop de `terrain.fenetreBornee.emprise`, **pas** de
   `ZOOM_SOCLE` : l'emprise suit la fenêtre chargée, donc l'altitude. Si j'avais
   suivi ma première lecture, j'aurais élargi le socle de 10,4 km à 166 km et
   payé seize fois plus de tuiles **à toutes les altitudes**, pour rien.

2. **« Le seuil de mort du socle EST le haut du fondu d'estompage — le module le
   dit en gras. »** ⛔ Vrai jusqu'à D21, faux après. Le commentaire écrit
   « C'EST LE SEUIL DE MORT DU SOCLE, PAS UN VOISIN » — mais son RAISONNEMENT
   parle de la grandeur du socle À L'IMAGE. Rejoué : accroché à
   `SEUIL_MORT_M` = 750 km, le fondu rend **0,576 à 100 km au lieu de 0**. Le
   commentaire nommait la constante, pas la grandeur.

3. **« Le bouton du milieu est l'inclinaison qui tue le crop. »** ⛔ Faux, et
   **mesuré** : dans le crop, `inclinaisonPermise(regime)` n'autorise que
   `REGIME.SURFACE`, donc le milieu y est **inerte** — le banc rend
   `refus: 0→1`. L'inclinaison qui fait monter l'altitude dans le crop est le
   **glissé GAUCHE**, par OrbitControls, autour de l'axe du bloc (R13). J'ai
   écrit le geste de mesure sur le mauvais bouton avant que le banc me corrige.

4. **« Il suffit de séparer la naissance du crop de la bascule de trois
   quarts. »** ⛔ Insuffisant. La bascule a un **miroir** — `surLeBloc`, le front
   descendant qui arme `_armerRetourNadir`, et `redresserSiHerite`. Laissés sur
   `pose`, le retour au nadir ne partait plus qu'à 750 km : l'inclinaison
   héritée restait posée **de 750 km à 32 km**, et D16 ter tombait par l'autre
   bout — le défaut bimodal exact que GE2 tour 2 a payé.

5. **« `horsDuCrop` ne sert qu'au pivot. »** ⛔ **La plus lourde des sept.** Il
   décide aussi du RÉGIME DE GESTES. Sur `pose`, D21 ③ amputait D19 d'une bande
   de **568 km** (600 km → 32 km) où les trois gestes de Google Earth
   repassaient à OrbitControls — et **la deuxième sortie de D21 ① disparaissait
   avec**, le clic droit y redevenant un PAN. J'ai failli livrer ça.

6. **« La ligne de partage tombera entre z6 et z7. »** ⛔ Mesuré : elle tombe
   entre **z5 (920 060 m)** et **z6 (575 040 m)**. La pose d'arrivée z6 est
   24 960 m **sous** le seuil. « Dès z7 » est tenu avec un cran de marge.

7. **« Éteindre `params.waterEnabled` est le bon endroit. »** ⛔ Faux :
   `BASE_TEMPLATE_LOOK` est capturé avant le look d'ouverture, et `share-link`
   ne transmet que la différence — tous les liens déjà émis auraient changé de
   sens. C'est le **look d'ouverture** qu'il fallait éteindre.

**Et une faute de méthode, qui n'a rien réfuté mais qu'il faut dire :** j'ai
lancé un remplacement global de `0,575` sur tout `src/` pour corriger un chiffre
de ce rapport, et il a touché **deux fichiers sans rapport** (`globe.js`,
`melange-crop.js`) où `0,575` était une mesure d'albédo de nuanceur. Rattrapé au
`git diff` avant le commit, `git checkout` sur les deux. **Le scalpel, pas la
hache** — c'est la règle « scripts d'édition en binaire, relis l'octet écrit »
lue trop vite.

---

## LES RÉSERVES OUVERTES — trois, et elles se tranchent en une ligne chacune

1. ⚠️ **« bouton de scroll central »** — voir en tête. J'ai posé la MOLETTE.
2. ⚠️ **Le clic droit sous 32 km.** Entre 600 km et 32 km il zoome et arme la
   sortie. **Sous 32 km, sur le bloc, il est rendu à OrbitControls** (PAN) —
   c'est la décision mesurée de GE2 (« le régime de la Terre s'ARRÊTE au crop »,
   `main.js:3163` ; la rendre à gestes-terre avait laissé la vue **totalement
   inerte sur le bloc**, 0 px et 0° sur les quatre gestes). **Là, les sorties
   sont la molette et le bouton monde.** Si Adrien veut le clic droit comme
   sortie **aussi sur le bloc**, c'est R13/GE2 à rouvrir, et ça se mesure.
3. ⚠️ **`params.waterEnabled` reste `true`** dans `main.js:760` — c'est le
   référentiel des liens de partage déjà émis, pas ce que voit l'utilisateur. Si
   Adrien veut aussi le littéral à `false`, il faut accepter que les liens
   anciens qui omettaient la clé décodent désormais « eau éteinte ».

---

## LES COMMITS

| | |
|---|---|
| `c9558c0` | **D21 ①** — la sortie du crop est une intention, plus un effet de bord de l'altitude |
| `bea4eb8` | **D21 ②** — le départage : la vue de trois quarts n'arrive pas à 600 km |
| `1126401` | **D21** — le régime de gestes reste au bloc : D19 gardait 568 km à perdre |
| *(celui-ci)* | le rapport, les traces et la sonde du point de mort |

⚠️ **UNE FAUTE DE DÉCOUPE, ET JE LA DIS** : le premier commit porte les quatre
demandes à la fois (l'intention, les seuils, les gestes, les rivières) au lieu
des quatre commits que le chantier mérite. Les deux suivants sont propres. Ce
n'est pas rattrapable sans réécrire l'historique, et ça ne vaut pas le risque.

---

## LE SERVEUR

`npm run dev -- --host 127.0.0.1 --port 7341 --strictPort`, **arrêté en
partant**. Les Chrome sans tête du banc sont ceux de `puppeteer-core`, lancés et
fermés par les scripts ; aucun autre n'a été touché.

## LES TRACES

`.superpowers/sdd/2026-08-22-globe-studio/traces-C1/` (les séries par image
sont retirées — elles pesaient 4,5 Mo pour rien ; les résumés portent tout ce que
le rapport affirme) — `haut8.json` (6 gestes × 8 à 600 km), `haut8b.json` (inclinaison,
cap, molette 6 crans × 8), `bloc8.json` (3 gestes × 8 sur le bloc à 10 km),
`mort.json` (le point de mort cran par cran, 8 passes, les deux espaces
d'altitude), `pf1-z7.json` · `pf1-paliers.json` · `pf1-temoin.json` ·
`pf1-sanscrop.json` (le banc de performance).

Deux sondes ajoutées, aucune ligne de `src/` touchée par elles :
`scripts/sonde-c1-mort.mjs` (neuve) et neuf gestes `c1-*` dans
`scripts/sonde-ge3.mjs`, plus trois postes dans `scripts/profil-pf1.mjs`.
