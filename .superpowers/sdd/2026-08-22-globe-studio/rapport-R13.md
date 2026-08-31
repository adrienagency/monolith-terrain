# R13 — LA ROTATION DE VUE ORBITALE, PORTÉE JUSQU'AU BLOC

**Statut : livré, avec une réserve qui demande l'arbitrage d'Adrien.**

> **Adrien :** *« Le comportement de la rotation de la vue autour de la Terre est
> parfait en mode orbital. Peut-on appliquer celui-là jusqu'au mode crop ? »*

---

## ⚡ LA RÉPONSE EN UNE PHRASE

**Ce n'était pas la vitesse — elle était déjà identique. C'était la cible.**
Le bloc dérivait de **85,5 px** à l'écran pour 100 px de souris ; il dérive
maintenant de **10,7 px**, contre **~10⁻¹³ px** pour la Terre en orbite.

---

## ÉTAPE 1 — LA DIFFÉRENCE, EN CHIFFRES

⛔ **L'hypothèse évidente est fausse, et c'est le résultat le plus utile de la
tâche.** On attendait deux vitesses différentes. Relevé sur un glissé de 100 px
(`.banc/R13/apres.json`, RTX 3080, ANGLE/D3D11) :

| régime | objet qui gère | cible | rotateSpeed | **azimut par pixel** | min/max polaire | amortissement | pan |
|---|---|---|---|---|---|---|---|
| orbite 60 000 km | `OrbitControls` | **(0,0,0)** centre de la Terre | 1 | **0,447079 °/px** | 0° / **180°** | 0,03 | **coupé** |
| orbite 10 000 km | idem | idem | 1 | 0,447753 °/px | 0° / 180° | 0,03 | coupé |
| orbite 1 000 km | idem | idem | 0,219746 | 0,098919 °/px | 0° / 180° | 0,03 | coupé |
| orbite 200 km | idem | idem | 0,043949 | 0,019798 °/px | 0° / 180° | 0,03 | coupé |
| orbite 40 km | idem | idem | **0,015** (plancher) | 0,006716 °/px | 0° / 180° | 0,03 | coupé |
| **le bloc** | **le MÊME `OrbitControls`** | **le point VISÉ au sol** | **1** | **0,447079 °/px** | 0° / **88,2°** | 0,03 | **actif** |

**Il n'y a qu'un seul objet de contrôle** (`main.js:1402`), reconfiguré par
`modes.js:736-740` (orbite) et `modes.js:1000-1003` (surface).

### Ce que ces nombres disent, et que personne n'avait dit

1. ⚡ **À l'endroit où Adrien juge le geste « parfait » — l'orbite haute — la
   vitesse angulaire est EXACTEMENT celle du bloc : 0,447079 °/px des deux
   côtés.** Même bibliothèque, même loi (`2π·dx/hauteur·rotateSpeed`), même
   `rotateSpeed = 1`. **La demande ne porte donc pas sur la vitesse.**
2. ⚡ **Ce qui diffère est la CIBLE.** En orbite c'est le centre de l'objet
   regardé : la Terre reste plantée au milieu du cadre quoi qu'on fasse. Sur le
   bloc c'est le point visé, qui se décentre au premier geste.
3. **`rotateSpeed` orbital est une loi continue** —
   `clamp(1,4·orbAlt/R_GLOBE, 0,015, 1)` (`modes.js:1517`) — qui plafonne à 1
   au-dessus de **4 551 km** et plancherise à 0,015 sous **68,3 km**.
4. **Le clic droit et le deux-doigts ne font pas la même chose** : `enablePan`
   est **faux** en orbite (clic droit, bouton milieu et Maj+gauche inertes ;
   deux doigts = `DOLLY_PAN` avec les deux moitiés coupées, donc rien) et **vrai**
   en surface (clic droit = glisse de terrain en mode continu, sinon pan).
5. **L'inertie est la même des deux côtés** (`enableDamping`, `dampingFactor =
   0,03`, τ ≈ 33 images) : l'élan visible ne diffère que par `rotateSpeed`.

### Les deux témoins, sans lesquels aucun de ces chiffres ne vaut

- **Témoin nul, bouton TENU** : `0,00000 °` de visée, `0,00000` unité de
  position. Le spin d'inactivité de `main.js` est bien gelé — `controlsHeld`
  reste vrai tant que le bouton n'est pas relâché.
- **Témoin du spin, bouton relâché 4,5 s** : **2,803 °** et **50,96 unités**.
  ⚠️ C'est ce qu'une mesure non gelée aurait pris pour du geste.

### Trois pièges payés pendant la mesure, corrigés et écrits dans les sondes

- ⛔ **Le voile `#loading` mange le premier glissé** : `0,000 °` pour 100 px,
  contre `0,447079 °/px` trente secondes plus tard. Sans échauffement, le premier
  candidat de toute liste rendrait zéro et **paraîtrait le meilleur**.
- ⛔ **Le damping étale le geste sur ~33 images** : relever une image après le
  mouvement ne rend que 3 % de l'angle.
- ⛔ **Les dérives se rapportent au CANEVAS, pas à la fenêtre.** Le Race Studio
  occupe la moitié gauche de la page : le canevas fait ~720 px pour une fenêtre
  de 1 280. Le premier jet surestimait toute dérive horizontale d'un facteur
  **1,78** ; les deux runs ont été rejoués.

### ⛔ CE QUE LE BRIEF CROYAIT, ET QUE LA MESURE CORRIGE

**`http://localhost:5549/` sans paramètre ouvre `modes.mode === 'surface'`, pas
`orbital`.** Le « mode sphère » est le RENDU (la Terre en fond, `terre=unique`
devenu le défaut) ; le régime orbital de la machine s'atteint en **dézoomant**.
Une sonde qui pose ses paliers orbitaux dès l'ouverture ne mesure rien — le
premier jet de la mienne a sauté ses six paliers en silence.

---

## ÉTAPE 2 — LE TEST ROUGE

`test/pivot-bloc.test.js`, 15 tests, rouge sur `ERR_MODULE_NOT_FOUND` avant
`src/monde/pivot-bloc.js`, puis rouge sur le branchement absent de `main.js`.

---

## ÉTAPE 3 — LA CIBLE : LES TROIS CANDIDATS, MESURÉS

⚡ **Choix de sensation, pas d'algorithme.** Dérive du centre du bloc à l'écran
pour 100 px de souris, cible décentrée de 21,3 unités (`.banc/R13/cibles.json`) :

| pivot | dérive du centre du bloc | |
|---|---|---|
| **le point visé** (avant R13) | **68,324 px** | ce qu'Adrien subit |
| **l'axe du bloc, au sol** | **0,001 px** | |
| **l'axe du bloc, centre du volume** | **0,000 px** | |
| **le point sous le curseur** | **130,467 px** | deux fois pire |

⚡ **Le choix « centre au sol » contre « centre du volume » est SANS OBJET** : la
correction ne porte que sur l'azimut, et une rotation autour d'un axe vertical
ne connaît pas le `y` du pivot. Les deux rendent le même zéro, et ce n'est pas un
hasard de mesure.

### Ce qui a été implémenté, et pourquoi sous cette forme

⛔ **Écrire `controls.target` sur le centre du bloc est interdit.**
`veille-repos.js` surveille `|Δ ln(distance caméra→cible)|` au seuil
`SEUIL_BOUGE_LOG = 1e-4`, et c'est ce signal qui arme la bascule de trois quarts
de D16 ter (`veilleCrop.repos`). Un ré-ancrage produit :

| pivot | `|Δ ln d|` | × le seuil |
|---|---|---|
| l'axe du bloc, au sol | 6,608 × 10⁻³ | **66 ×** |
| l'axe du bloc, centre du volume | 1,715 × 10⁻² | **171 ×** |
| le point sous le curseur | 6,147 × 10⁻² | **615 ×** |

➡️ **La rotation azimutale est donc RIGIDE : la caméra ET la cible tournent
ensemble autour de l'axe vertical du bloc.** L'identité qui rend la chose simple :

    rot(P, d)(X) − rot(T, d)(X) = (I − Ry(d))·(P − T)

Le membre de droite **ne dépend pas de `X`** : corriger le pivot, c'est ajouter
**le même vecteur** à la caméra et à la cible. La distance devient invariante
**par construction, pas par réglage** — mesuré **2,331 × 10⁻¹⁵**, et
`|Δ ln d| ≤ 4,4 × 10⁻¹⁶` sur tous les relevés. Sa composante verticale vaut 0 :
pas un mètre d'altitude parasite.

### Le résultat, avant et après, projection rapportée au canevas

| glissé de 100 px | avant (`avant-temoin.json`) | après (`apres.json`) | |
|---|---|---|---|
| à l'arrivée sur le bloc | **85,528 px** | **10,691 px** | **−87,5 %** |
| après un décentrage au geste réel | **180,501 px** | **23,186 px** | **−87,2 %** |
| glissé vertical | **116,638 px** | **23,254 px** | **−80,1 %** |
| **référence orbitale** (tous paliers) | ~10⁻¹³ px | ~10⁻¹³ px | la Terre ne dérive jamais |

Le résidu de 10,7 px est la part **polaire** du geste, laissée intacte à dessein
(voir la limite ① du module).

---

## ÉTAPE 4 — LA TRANSITION : LE SAUT EXISTE, ET IL EST ANTÉRIEUR À R13

Relevé de part et d'autre de la traversée (`.banc/R13/apres.json`) :

| | juste avant (orbital, 40 km) | juste après (surface) | |
|---|---|---|---|
| `rotateSpeed` | **0,015** | **1** | **× 66,67 en une image** |
| azimut par pixel | 0,006716 °/px | 0,447079 °/px | **× 66,57** |
| distance à la cible | 6 411 km (le centre de la Terre) | 48,8 km (un point du sol) | ÷ 131,3 |
| `maxPolarAngle` | 180° | 88,2° | |
| `enablePan` | faux | vrai | |

⚠️ **Ce saut préexiste à R13 et R13 n'y touche pas** : les colonnes « avant » et
« après » de mes deux runs portent les mêmes `0,006716` et `0,447079`.

⚡ **ET IL EST MOINS UNIVOQUE QU'IL N'EN A L'AIR — c'est la mesure qui le dit.**
En **défilement à l'écran** (le sol qui passe, rapporté au champ visible), les
deux régimes s'inversent :

| | angle de visée | défilement du sol |
|---|---|---|
| orbite à 40 km | 0,006716 °/px | **≈ 2,94 % du champ / px** |
| le bloc à 18 km | 0,447079 °/px | **≈ 1,10 % du champ / px** |

**L'orbite basse est 66,6 × plus lente en ANGLE et 2,7 × plus rapide en
DÉFILEMENT.** Les deux régimes ne font pas la même chose : l'orbite **translate**
(vue au nadir qui glisse), le bloc **tourne**. Porter littéralement la loi
orbitale sur le bloc reviendrait à remplacer la rotation autour du bloc par un
défilement au nadir — c'est-à-dire à supprimer la vue de trois quarts, que D16
ter vient de décider de garder et qu'Adrien appelle la signature du produit.

**Sens inverse (bloc → orbite) :** rien à signaler côté R13 — la correction est
gardée par `busy`, `travel`, `_fonduPose` et `_diveTween`, donc elle ne tourne
jamais pendant `enterOrbit` ni pendant le retour au nadir.

---

## ÉTAPE 5 — LES LIMITES : LA BUTÉE BASSE PASSE SOUS LE SOL

Glissé de 400 px, bien au-delà de la course, relevé image par image
(`.banc/R13/apres.json`, `butees`) :

| butée | départ → arrivée | bornes | pas max | dernier pas |
|---|---|---|---|---|
| vers le nadir | 1,232° → **0,00006°** | min 0° | 1,232° | 0,000000° |
| vers l'horizon | 0,480° → **88,200°** | max 88,2° | **7,980°** | 0,000000° |

⛔ **Et à 88,2°, `camera.position.y = −1,4857`.** La caméra est **sous le niveau
du sol du bloc**. `maxPolarAngle` est un angle, pas une hauteur : il ne peut pas
garantir ce que le brief demande (« passer sous le sol n'a pas de sens »).
**Trouvée, mesurée, PAS corrigée** — voir la réserve n° 2.

⚠️ **Et `minPolarAngle` DOIT rester 0.** D16 ter impose le **nadir** pendant
toute la descente, c'est-à-dire un angle polaire nul : poser un plancher
au-dessus de zéro casserait la règle qu'on vient d'acquérir. La butée haute est
donc juste, et elle ne claque pas (dernier pas 0,000000°).

---

## ÉTAPE 6 — À L'ÉCRAN

`.banc/R13/captures/` — 15 images, trois stations, un glissé de 100 px filmé en
cinq images à chacune, **bouton tenu** (spin gelé) :

| station | mode | altitude | `rotateSpeed` | dérive du centre |
|---|---|---|---|---|
| orbite haute | orbital | 60 000 km | 1 | **0,000 px** |
| mi-descente | orbital | 400 km | 0,0879 | **0,000 px** |
| le bloc | surface | 16 030 m | 1 | **2,938 px** |

Le geste se sent identique du haut en bas : le sujet reste planté au centre du
cadre, ce qu'il ne faisait pas sur le bloc avant R13.

---

## COMMITS

| | |
|---|---|
| `fab6b65` | R13 étape 1 — la différence chiffrée : ce n'est pas la vitesse, c'est la cible |
| `83d45ed` | R13 — tourner autour du bloc et non du point visé : 85,5 px de dérive → 10,7 |

## TESTS

**4 355 tests, 0 échec** (4 340 de base + 15 nouveaux) · **audit 224 = 224** ·
aucun CRLF introduit (tous les scripts d'édition forcent `newline=''`).

**Et la campagne acquise n'a pas bougé**, vérifié à l'écran avec l'instrument de
la campagne (`scripts/sonde-d16.mjs`) :

| | images | `dIncl` bloc MAX |
|---|---|---|
| descente | 1 071 | **0,000057292 °** |
| remontée | 1 037 | **0,000057292 °** |

soit exactement le chiffre acquis, dans les deux sens.

## FICHIERS TOUCHÉS

**Modifiés**
- `src/main.js` — **+49 lignes, un seul bloc** : l'import de `monde/pivot-bloc.js`,
  l'encadrement du `controls.update()` de la branche surface de
  `updateCameraMotion()`, et la fonction `pivoterAutourDuBloc`.
  ⚠️ **Rien d'autre n'est touché** ; en particulier `src/map/aerial-layer.js`
  n'est pas ouvert, et aucune ligne d'imagerie aérienne n'est modifiée.
- `package.json` — une entrée de test ajoutée à la liste explicite.

**Créés**
- `src/monde/pivot-bloc.js` — module pur (`deltaAzimut`, `decalagePivot`).
- `test/pivot-bloc.test.js` — 15 tests.
- `scripts/sonde-geste-rotation.mjs`, `scripts/sonde-cible-rotation.mjs`,
  `scripts/captures-r13.mjs` — les instruments.
- `.banc/R13/` — `avant.json`, `avant-temoin.json`, `apres.json`, `cibles.json`,
  `cibles-apres.json`, `captures/`.

**Non modifiés, alors qu'on aurait pu croire le contraire :** `src/modes.js`
(aucun réglage d'`OrbitControls` déplacé), `src/monde/veille-repos.js`,
`src/monde/grandeur-repos.js`.

---

## RÉSERVES

### 1. ⚠️ Le saut de vitesse au franchissement reste ouvert — et il n'est pas évident à fermer

`rotateSpeed` passe de **0,015 à 1 en une image** à la traversée (× 66,67). R13
ne l'a pas touché **délibérément** : la mesure de l'étape 4 montre que les deux
régimes ne font pas le même geste (l'un translate, l'autre tourne), et qu'un
raccordement naïf de la loi orbitale au bloc **supprimerait la vue de trois
quarts**. Fermer ce saut demande de décider ce que le geste doit faire à 40 km —
et c'est une question de produit, pas d'implémentation. **Je m'arrête là, comme
le brief le demande.**

### 2. ⚠️ On peut regarder le bloc par en dessous, et R13 ne l'a pas corrigé

Mesuré : à la butée `maxPolarAngle = 88,2°`, `camera.position.y = −1,4857`. La
butée est un ANGLE, la contrainte est une HAUTEUR ; les deux ne coïncident qu'à
une distance donnée. ⛔ **Je n'ai pas touché à `maxPolarAngle`** : il est écrit à
deux endroits (`main.js:1409`, `modes.js:1000`), il borne aussi la pose d'arrivée
de trois quarts (46,548°), et le corriger proprement veut dire remplacer un angle
constant par une borne dérivée de la distance au sol — un chantier à part, avec
son propre risque sur D16 ter.

### 3. ⚠️ La rotation POLAIRE tourne toujours autour du point visé

C'est le résidu de 10,7 px. Une rotation rigide autour d'un axe **horizontal**
ferait passer la cible sous le terrain et pencher l'horizon : le geste orbital
n'est portable sur le bloc que pour l'azimut. **Assumé et écrit dans le module.**

### 4. ⚠️ Le pan au clic milieu enfonce la cible sous le sol

Trouvé en passant, hors périmètre : `screenSpacePanning = true` déplace la cible
dans le plan de l'écran — relevé **`target.y = −10,75`** après un pan de 180 px,
soit dix unités sous le terrain. Ça fabrique une situation où plus rien n'est
ancré au sol. Non corrigé, signalé.

### 5. ⚠️ Un seul GPU, un seul lieu

Toutes les mesures viennent d'une RTX 3080 (ANGLE/D3D11), au lieu de démarrage
par défaut. La correction de pivot est de l'arithmétique de position — elle ne
dépend ni de la machine ni du lieu — mais les **dérives en pixels**, elles,
dépendent du champ et de la taille du canevas.
