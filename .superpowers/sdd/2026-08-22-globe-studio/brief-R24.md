# R24 — LA TOPONYMIE DE LA SPHÈRE

Arbre : `C:\Dev\wt-top` · branche `toponymie-globe` (partie de `regroupement`).
Serveur : `npm run dev` — **port libre au-dessus de 5900**.

## CE QU'ADRIEN A DEMANDÉ

> *« reprends la suite de la reconstruction sur toutes les options utiles pour ce
> qui est du mode sphère. On a plein de choses qui ne fonctionnent pas encore en
> mode sphère, mais tu as la liste. »*

La liste est `inventaire-studio-2.md`, ici même : **127 options du studio mesurées
une par une**, 72 ✅ / 8 ⚠️ / **47 ⛔**. Tu prends les deux qui portent les
**noms de lieux**, et tu vas trouver qu'elles ne sont pas du tout de même nature.

| n° | libellé | chemin | ce qu'a relevé l'inventaire |
|---|---|---|---|
| 21 | Sommets | `params.peaksEnabled` → `peaksLayer.setEnabled` | ⛔ `peaks.js` — objets accrochés à **la scène du bloc** |
| 22 | Points cotés | `params.labels` → `setLabelsVisible` | ⛔ `labels.js` — points cotés **du bloc** |

## ⚡ DEUX CHOSES QUE J'AI TROUVÉES EN PRÉPARANT CE BRIEF, ET QUI CHANGENT LA TÂCHE

### ① `labels.js` invente des noms de lieux. Ils sont FAUX.

`src/labels.js` (128 lignes) porte une constante `PLACE_NAMES` : *HUNTS MESA,
RAIN GOD MESA, MITCHELL BUTTE, THREE SISTERS, EAR OF THE WIND…* — **la toponymie
de Monument Valley**, posée au hasard (`mulberry32`) sur n'importe quel terrain.
C'est un décor de démonstration, pas de la cartographie.

⛔ **Ne rebranche pas ça tel quel sur la sphère.** Plaquer des noms de l'Arizona
sur les Alpes ou sur La Réunion serait une régression, pas une option rendue
vivante. Le libellé du curseur dit **« Points cotés »** — des altitudes cotées —
et c'est ça qu'il faut servir, pas des toponymes fictifs.

### ② Il existe déjà un jeu de villes, et RIEN ne le lit.

`public/data/cities.json` — **73 448 octets, ~2 000 villes** — est référencé par
**zéro ligne de `src/`**. Vérifié : `grep -rn "cities" src/` ne rend rien.

➡️ **Vérifie ce qu'il contient avant de t'en servir** (champs, couverture,
provenance, licence). S'il porte des coordonnées et une population, c'est la
donnée qui manque à une toponymie mondiale, et elle est déjà sur le disque.
S'il ne vaut rien, dis-le et n'en parle plus — mais **dis-le avec ce que tu as
lu dedans**, pas en principe.

## LE PRÉCÉDENT QUI T'ÉVITE LA MOITIÉ DU TRAVAIL

`src/monde/cartouche-globe.js` a **déjà relogé** le cartouche Wikipédia/Nominatim
de la scène du bloc vers celle du globe. C'est exactement ta manœuvre, faite une
fois et mesurée. **Lis-le en entier avant d'écrire une ligne** : le chemin
d'ancrage, la conversion lat/lon → position sur la sphère, et la façon dont il
survit au passage du seuil sont déjà résolus là-dedans.

`peaks.js` est le cas le plus simple des deux : ses données viennent de
l'**API Overpass** (nœuds OSM `natural=peak`), donc **réelles et mondiales** — il
lui manque l'ancrage sphère, pas la donnée. `src/monde/sol-globe.js` échantillonne
le sol en espace globe et porte `dem.meanM` : c'est probablement là que tu prends
l'altitude d'un repère.

## ⛔ LE DÉFAUT QUI EST REVENU NEUF FOIS SUR CE CHANTIER

**La conversion d'unité entre deux espaces.** Facteurs déjà attrapés : 121,6 ·
10 · 130,4 · 6, une portée de flou de 1 465 km — et, exactement dans ta
matière, **des toponymes plantés 1 830 m SOUS les Alpes**.

Il y a deux espaces : le bloc (`TERRAIN_SIZE = 56` unités pour l'emprise) et le
globe (`R_GLOBE` pour le rayon terrestre). Une altitude de repère traverse en
plus **l'exagération verticale**, qui n'est pas 1.

⚠️ **`frontiere-rendu.js` a payé ce défaut précis et porte la formule qui marche** :
ancrage à `R_GLOBE + altitudeAncreM × (R_GLOBE / EARTH_RADIUS_M) × exagération`.
**Copie cette forme**, et écris le facteur chiffré en commentaire. Une altitude
transportée sans sa conversion écrite est un défaut, même si elle a l'air juste.

## LE COÛT, ET C'EST LA VRAIE QUESTION DE CETTE TÂCHE

Adrien a retiré les routes en juillet pour une raison qu'il a donnée en toutes
lettres : *« les routes mettaient trop de temps à charger, c'était vraiment trop
lourd. »* **La toponymie mondiale est le même piège** : le nombre d'étiquettes
croît avec l'emprise, et l'emprise en orbite, c'est la Terre.

Deux garde-fous non négociables, et ils sont chiffrés ailleurs dans le dépôt :

1. **Un seuil de zoom qui filtre par importance.** Le patron existe :
   `filterByZoom` avec le `min_zoom` de Natural Earth, déjà en service sur les
   rivières. Une ville de 2 000 habitants n'apparaît pas depuis l'orbite.
2. **On ne charge que ce qui est dans le champ.** Précédent mesuré ici :
   **210 367 sommets alpins chargés à 700 km d'Anvers** parce qu'une boîte en
   effleurait une autre de 0,04°. Et un seuil d'horizon écrit en dur
   (`dot < −0,35`, soit 110°) au lieu du vrai horizon géométrique `R / |camPos|`
   — à 8 km d'altitude le vrai horizon vaut **2,87°**, une calotte jusqu'à
   **×1 076 trop large**.

➡️ **Donne le nombre d'étiquettes vivantes à cinq altitudes** (orbite haute,
1 000 km, 100 km, seuil du crop, sol) **avant et après**. Sans ce tableau, la
tâche n'est pas finie.

## LES INSTRUMENTS QUI MENTENT — ils ont déjà produit de faux constats ici

- **`requestAnimationFrame` ne se déclenche pas dans un panneau qui ne
  composite pas** — un banc a compté « 0 image en 3,7 s ». Patron qui marche :
  `scripts/sonde-demarrage.mjs` (Chrome sans tête).
- **Un condensé 64×40 annule les motifs fins.** ⚠️ **Du texte EST un motif fin** :
  juge tes étiquettes en pleine résolution. Un rapport a déjà conclu de travers
  en lisant une vignette réduite — il avait lu « DEM : chargement » là où il était
  écrit « OSM · chargement », et tout son diagnostic était faux.
- **Le globe tourne tout seul** à ~1,88–2 °/s après 3 s d'inactivité : des
  étiquettes projetées chaque image bougeront toutes seules entre deux relevés.
- **`performance.getEntriesByType('resource')` plafonne à 250 entrées** — si tu
  comptes des requêtes Overpass, ce plafond te fera sous-compter en silence.
- **Un relevé sur UNE image ne prouve rien** si le système oscille : 20 images
  consécutives, et exige la stabilité.
- **La suite de tests peut verrouiller le défaut** : une assertion « plus de N
  objets dessinés » décrit le gaspillage comme un contrat et fait **échouer le bon
  correctif**. Relis les assertions qui bordent `peaks` et `labels` avant de
  corriger.

⚠️ **Règle du chantier, quinze fois sur quinze : si tu trouves que mon départage
est faux, c'est TOI qui as raison.** Mesure, et écris-le.

## LES RÈGLES — dans ce dossier

- **D15** (`regle-D15.md`) — la planète ne doit plus jamais être nue, et ⛔ le
  départage de ce qui **ne peut pas** devenir global : les masques cuits sur
  l'emprise du crop ne couvrent pas la planète.
- **D16 / bis / ter** (`regle-D16.md`) — une seule caméra, une seule vue, la vue
  3/4 n'arrive qu'au bloc. N'ajoute ni caméra ni passe.
- **D17** (`regle-D17.md`) — ⛔ **IL N'Y A PAS DE PRODUCTION.** Le site n'est pas
  en ligne. **N'écris jamais « production rigoureusement inchangée » en étape de
  fin** : consigne abrogée, elle a fait perdre du temps.
- **D18** (`regle-D18.md`) — les trois règles héritées des routes : le zoom d'une
  tuile dépend de la taille de la fenêtre ; **pas d'apparition en tout-ou-rien
  d'une classe** ; pas de noms de routes. Les deux premières te concernent
  directement.

## L'ATTENDU

1. **Les sommets (21) vivants sur la sphère**, ancrés à la bonne altitude — la
   conversion écrite en commentaire avec son facteur chiffré, et **la preuve
   qu'un repère n'est pas sous le sol** (mesure la hauteur, ne la suppose pas).
2. **Les points cotés (22) tranchés** : soit de vraies altitudes cotées prises du
   MNT, soit une vraie toponymie si `cities.json` la porte — **et dans les deux
   cas, plus jamais les noms de Monument Valley plaqués ailleurs**. Si tu conclus
   que l'option n'a pas de sens sur une sphère, dis-le **avec la mesure**, et
   cache le curseur hors du mode bloc.
3. **Le tableau du nombre d'étiquettes à cinq altitudes, avant et après.** Plus le
   coût réseau (requêtes, octets) sur une descente complète.
4. **Aucune apparition en tout-ou-rien** (D18) : les étiquettes entrent
   progressivement, par importance.
5. **Aucun curseur affiché en mode sphère s'il n'agit pas.**
6. Des tests. ⚠️ **`package.json` porte une LISTE EXPLICITE de fichiers de
   test** : un test absent de la liste **ne tourne jamais**. Ajoute les tiens,
   puis `npm run audit:tests` — **aucun écart**.
7. `npm test` — **base à battre : 4 442 · 0 échec**.
8. ⚠️ **Scripts d'édition en BINAIRE** (ou `newline='\n'`) : le mode texte de
   Windows met les fichiers en CRLF contre le `.gitattributes` — **deux tests
   sont déjà morts dessus**.
9. Commits sur `toponymie-globe`, messages en français.
10. Rapport `rapport-R24.md` ici, avec le tableau des étiquettes, les conversions
    écrites, ce que contient vraiment `cities.json`, et une section **« ce que
    j'ai cru puis réfuté »** — c'est la section la plus utile du rapport.

Travaille jusqu'au bout, ne pose pas de question : tranche, mesure, corrige.
