# RAPPORT VETO — LE TRAIT DE CÔTE DÉCIDE, PAS UNE SOURCE GROSSIÈRE

**Arbre** `C:\Dev\wt-veto` · branche `veto-trait-cote` · serveur `127.0.0.1:8531`.
Bancs : `scripts/veto-tuiles.mjs` (les chiffres), `scripts/veto-images.mjs`
(les captures). Relevés et images : `.banc/VETO/`.

## ⚠️ LES LIGNES QUE JE TOUCHE DANS `globe.js` (pour la fusion à la main)

**Deux endroits, et rien d'autre** — `wt-cull` travaille ailleurs dans ce fichier :

| endroit | ligne (après correctif) | quoi |
|---|---|---|
| bloc d'imports | **20** | `import { vetoTerre } from './coast-veto.js'` (une ligne AJOUTÉE juste après l'import de `bathy.js`) |
| `fondMarinTuile` | **3618 → 3642** | le calcul de `pasTuileM` sorti en variable, l'appel à `vetoTerre`, et `optsFusion` qui remplace l'ancien ternaire en ligne |

Aucune autre ligne de `globe.js` n'est modifiée (`git diff -U0 src/globe.js`
ne montre que ces deux hunks).

---

## ① CE QUE J'AI LIVRÉ

`src/coast-veto.js` — nouveau module, deux étages :

- **pur** (testable en node, ni DOM ni fetch) : le Mercator normalisé
  (`uDepuisLon` / `vDepuisLat` / `bboxDepuisUV`), et surtout **`erodeTerre`**,
  l'érosion séparable à fenêtre glissante qui recule la terre de
  `TOLERANCE_COTE_M` (30 m, **la constante de `sea-mask.js`, pas une nouvelle**) ;
- **impur** : `vetoTerre({u0,v0,u1,v1,largeur,hauteur,metresParCellule,cle})`,
  qui rasterise les polygones de terre OSM de `public/data/coast-z6` sur la
  grille demandée et **mémoïse le masque sur la clé**.

Les polygones viennent de `loadGridFeatures` / `loadLandFeatures`,
**exportées** de `coast-mask.js` plutôt que recopiées : le veto et le masque du
nuanceur partagent le même `gridCache`, donc **la même vérité et le même
réseau**. Deux chargeurs, ce seraient deux caches qui divergent.

Dans `src/bathy.js`, `fuseBathymetry` accepte `opts.terreVeto`, et **une seule
ligne change** :

```js
const bruit = !(veto && veto[i]) && bruitZero && l >= level - bande && …
```

Câblé aux **trois** sites de fusion :

| fichier | où | forme |
|---|---|---|
| `src/globe.js` | `fondMarinTuile` | masque cuit **par tuile** du quadtree, clé `t/z/x/y/px` |
| `src/dem.js` | `loadDem` | masque cuit sur l'emprise du bloc, clé `b/…` |
| `src/monde/flux-terrain.js` | `demanderBathy` cuit, `remplirHauteurs` relit | masque 1024² sur l'emprise, rééchantillonné aux nœuds |

---

## ② ⛔ LA DÉCISION QUI FAIT TOUT : LE VETO NE FERME QU'**UNE** PORTE

C'est le point que je veux qu'on relise avant de toucher à ce code, parce que
c'est lui qui garde la mer en mer.

`fuseBathymetry` a **quatre** chemins qui peuvent mettre un pixel sous l'eau :
le zéro exact du terrarium, l'aplat de remplissage, la bande de bruit de B5, et
le pixel déjà négatif. **Le veto n'agit que sur la bande de bruit.** C'est la
seule règle du module qui prenne une terre franche et POSITIVE et la reclasse en
mer — l'encart de `NOISE_BAND` le dit déjà en toutes lettres.

**Pourquoi c'est vital :** les étangs de Camargue n'arrivent PAS par la bande de
bruit. Ils arrivent par le **zéro exact** — PLAT l'avait mesuré et je l'ai
revérifié : les pixels muets du terrarium dessinent les contours **organiques**
du Vaccarès. Un veto qui aurait aussi fermé cette porte-là aurait asséché le
delta. Le test `l'étang garde son eau` (`test/coast-veto.test.js`) verrouille
exactement ça : côte disant TERRE **partout**, et la lagune reste en eau.

Deuxième borne : **la côte se tait près d'elle-même.** Les polygones OSM sont
pré-simplifiés à 30 m ; rasterisés à 0,43 m la cellule ils dessineraient un
rivage à facettes. L'érosion de 30 m rend la forme du rivage au MNT et ne laisse
à la côte que la **topologie**. Chacun ce qu'il sait faire.

---

## ③ LES CHIFFRES — `scripts/veto-tuiles.mjs`, vraies tuiles, vraie bathy

**« Carré plat » traduit en pixels** : une cellule de source bathymétrique
**entièrement** noyée alors que le trait de côte la déclare **entièrement**
terre. C'est le critère d'Adrien, mesurable.

### CAMARGUE 43,45 / 4,60

| z | cellule (px) | carrés avant | carrés PLAT | **carrés VETO** | terre franche noyée av → PLAT → **VETO** |
|---|---|---|---|---|---|
| 11 | 4 | 27 | 27 | **0** | 18 814 → 18 814 → **12 618** |
| 12 | 8 | 3 | 3 | **0** | 24 313 → 24 313 → **12 286** |
| 13 | 16 | 0 | 0 | **0** | 27 460 → 27 460 → **16 053** |
| 15 | 64 | 0 | 0 | **0** | 45 634 → 0 → **0** |
| 17 | 256 | 0 | 0 | **0** | 153 108 → 0 → **0** |

➡️ **Carrés plats = 0 à z11, z12, z13, z15, z17.** Le critère est atteint.

**Et le reste, ventilé** — parce qu'un total ne dit pas s'il est fautif :

| z | reste **sous veto** (⇒ bogue) | reste hors veto (⇒ la côte dit MER) |
|---|---|---|
| 11 | **0** | 12 618 |
| 12 | **0** | 12 286 |
| 13 | **0** | 16 053 |
| 15 / 17 | **0** | 0 |

Zéro pixel noyé sous veto : la règle est appliquée sans fuite. Tout le résidu
est dans une zone que le trait de côte déclare franchement **MER** —
Méditerranée, étangs, salins. **C'est l'eau, et elle doit rester.**

### ⛔ L'EAU RÉELLE — LE CRITÈRE AUSSI IMPORTANT QUE LES CARRÉS

Pixels laissés **sous zéro** par la fusion, **dans les zones que la côte déclare
MER**, avant et après veto :

| lieu | z11 | z12 | z13 | z15 | z17 |
|---|---|---|---|---|---|
| Camargue | 59 342 → **59 342** | 26 358 → **26 358** | 28 567 → **28 567** | 0 → 0 | 0 → 0 |
| Porquerolles | 237 898 → **237 898** | 210 568 → **210 568** | 131 432 → **131 432** | 162 → **162** | 0 → 0 |
| Bretagne | 75 495 → **75 495** | 59 050 → **59 050** | 15 385 → **15 385** | 19 416 → **19 416** | 0 → 0 |
| fjord de Bergen | 21 897 → **21 897** | 74 730 → **74 730** | 233 303 → **233 303** | 208 881 → **208 881** | 262 144 → **262 144** |
| Moorea | 148 012 → **148 012** | 35 770 → **35 770** | 0 → 0 | 0 → 0 | 0 → 0 |

**Identique à l'unité, partout, à tous les zooms, sur cinq littoraux.** Le veto
ne peut pas retirer un pixel d'eau à une zone que la côte déclare mer : c'est
vrai par construction, et c'est mesuré.

### LES TROIS AUTRES LITTORAUX — INCHANGÉS

| lieu | eau totale, PLAT → VETO |
|---|---|
| **Bretagne** (48,65 / −2,02) | **identique aux 5 zooms** : 76 512 / 62 566 / 26 449 / 75 889 / 155 748 |
| **Porquerolles** (43,00 / 6,20) | **identique aux 5 zooms**, et la terre noyée par B5 à z11–z13 (19 292 / 30 436 / 57 865) **ne bouge pas d'un pixel** |
| fjord de Bergen | 21 927 → 21 916 · 74 774 → 74 756 · le reste identique |
| Moorea | 148 040 → 148 032 · 35 874 → 35 856 · le reste identique |

⛔ **Porquerolles est le témoin qui compte le plus.** C'est le lieu où B5 est
PROUVÉE nécessaire, et la règle y est intacte : le veto n'y couvre que 6 à 41 %
du champ (l'île), et pas un des 57 865 pixels rendus à la mer à z13 n'est
récupéré. La bande de bruit garde tout son travail là où elle a raison.

Bretagne, fjord et Moorea ne bougent que de **8 à 18 pixels**, tous à
l'intérieur de terres déclarées par la côte.

---

## ④ LE COÛT DE CUISSON — CHIFFRÉ

`scripts/veto-tuiles.mjs`, cache vidé avant chaque mesure :

| poste | mesuré |
|---|---|
| **cuisson d'un masque de tuile 512² (à froid)** | **3,3 à 15 ms** en Camargue et à Porquerolles ; **29 ms** au premier appel en Bretagne et **60 ms** au premier appel à Bergen (c'est le **téléchargement de la tuile z6**, payé une fois pour toute la région) |
| **même masque, cache chaud** | **0,0 à 0,1 ms** |
| **`fuseBathymetry` sans veto → avec veto** | 0,7–3,5 ms → 0,9–2,5 ms, soit **l'épaisseur du bruit de mesure** : la boucle lit un octet de plus par pixel |

**Forme retenue : masque CUIT UNE FOIS PAR TUILE, pas de veto par pixel.**
Le brief demandait de trancher ; c'est tranché par la mesure. Une tuile du
quadtree est recuite à chaque changement de palette, de nappe ou retour d'un
cran : sans mémoïsation on paierait 5 ms à chaque fois, avec on paie 0.

**Verdict : acceptable.** Une tuile du quadtree coûte déjà son
`tileBitmap` + `peindreBathyTuile` (des dizaines de ms de réseau) ; **5 ms de
rasterisation une seule fois** est sous le bruit. Et les 60 ms de Bergen sont
un `fetch` de tuile z6 partagé avec le masque côtier du nuanceur — donc **déjà
payé** par l'application dans le cas courant.

---

## ⑤ LES CAPTURES POUR ADRIEN

`.banc/VETO/camargue-z{11,12,13,17}-{terrarium,avant,apres,masque}.png`
(champ fusionné en fausses couleurs : vert = terre, bleu = eau).

- **`camargue-z12-avant.png`** : l'escalier de rectangles à angles droits en
  plein milieu des terres — **ce sont eux qu'Adrien voit**.
- **`camargue-z12-apres.png`** : ils ont disparu ; la Méditerranée, les salins
  du sud-ouest et les canaux sont là.
- **`camargue-z13-avant.png` / `-apres.png`** : la preuve la plus lisible du
  dossier. Le bloc de marches en haut à droite s'efface, et **toute** l'eau
  organique — le trait de côte, les chenaux, les mares, les drains du marais —
  reste au pixel près.
- **`camargue-z*-masque.png`** : le veto lui-même, pour qu'on voie d'où vient
  chaque décision.

---

## ⑥ CE QUE J'AI CRU, PUIS RÉFUTÉ

1. **« Le veto doit fermer TOUTES les portes de la fusion : si la côte dit
   terre, aucune source marine ne creuse. »** C'était ma première écriture, et
   elle est **fausse et dangereuse**. ➡️ Mesuré : la lagune du Vaccarès et les
   drains du marais entrent par le **zéro exact** du terrarium, pas par la bande
   de bruit. Un veto total les aurait tous asséchés. Le test
   `l'étang garde son eau` a été écrit **pour attraper cette version-là de moi**,
   et il l'attrape.

2. **« La grille des z6 OSM est trop grossière pour arbitrer un rivage à
   0,43 m. »** ➡️ **Vrai, et c'est pour ça qu'elle n'arbitre pas le rivage.**
   Elle arbitre la **topologie** ; l'érosion de 30 m lui interdit de parler près
   du trait. Vérifié dans les chiffres : à Porquerolles le veto ne couvre que
   6 % du champ à z11 et ne récupère **aucun** pixel — la côte se tait sur une
   île étroite, exactement comme prévu.

3. **« Il faut brancher le veto dans `remplirHauteurs` (fenêtre continue), c'est
   elle qui peint le crop. »** ➡️ **Mauvais endroit, et le banc me l'a dit.**
   `remplirHauteurs` est appelée à CHAQUE raffinement : y lancer un `fetch`
   faisait payer le réseau au chemin d'image. Déplacé dans `demanderBathy`
   (async, déjà attendue), avec un masque 1024² relu par plus-proche-voisin. Le
   chemin d'image ne touche plus au réseau.

4. **« `test/flux-terrain.test.js` échoue à cause de ma fusion. »** ➡️ **FAUX,
   et j'ai failli désactiver le correctif pour ça.** Deux tests tombaient sur
   `1089 hauteurs manquantes` — un défaut de COUVERTURE, pas de fusion. La cause
   : le `globalThis.fetch` du banc route **toute** URL inconnue dans son modèle
   de latence AWS, et mes requêtes `data/coast-z6/` y restaient en attente
   jusqu'à faire perdre ses tuiles au banc. **Le banc était en tort, pas le
   code** — `data/coast-z6/` est servi par le site, comme `data/bathy/`, à qui
   le banc réserve déjà une branche. Une ligne ajoutée à la maquette (404 = « pas
   de terre ici », le repli documenté du module). ⚠️ **Le symptôme d'un banc en
   tort ressemble exactement au symptôme d'un correctif en tort.** J'ai perdu
   deux tours à chercher dans `bathy.js` avant de comparer avec `git stash`.

5. **« La règle d'échelle de PLAT suffit, il ne reste qu'à l'élargir. »**
   ➡️ **FAUX, et c'était déjà écrit dans son §⑥.** Descendre `CELLULE_MAX_PX`
   sous 16 aurait cassé Porquerolles z13, où la bande de bruit est prouvée
   nécessaire. Les deux règles sont **orthogonales** : l'échelle borne le régime
   grossier, le veto tranche le régime où l'échelle est légitime. Elles ne se
   remplacent pas.

---

## ⑦ LES TESTS

`test/coast-veto.test.js` — **13 tests, inscrits dans `package.json`**.
`audit:tests` : **264 = 264**.

Six d'entre eux **échouent sans le correctif** (ils appellent `fuseBathymetry`
avec `terreVeto` sur le champ de Camargue à z12 tel que PLAT l'a mesuré, marais
uniformément à +0,13 m contre EMODnet à −2,04 m). Le premier
(`sans veto, la bande de bruit noie TOUT le marais`) **gèle le défaut** : il
vérifie que sans veto la tuile part à 100 % à la mer, et il passera à rouge le
jour où quelqu'un croira avoir corrigé le problème ailleurs.

Les autres verrouillent : la terre rendue **au bit** (pas d'altitude inventée),
le caractère **local** du veto, **l'étang qui garde son eau**, un veto de la
mauvaise taille **ignoré** plutôt qu'appliqué de travers, et l'identité **au
bit** de l'appel sans `terreVeto`.

---

## ⑧ CE QUI RESTE OUVERT — dit honnêtement

- **À z11 et z12, le Vaccarès n'est plus rendu en eau par la bathymétrie.** Il ne
  l'était pas avant non plus : « avant », il n'y avait que **son contour en
  marches d'escalier**, fabriqué par les cellules EMODnet — ce que PLAT avait
  déjà réfuté par extinction. Le trait de côte OSM classe une lagune fermée
  comme terre (elle n'est pas l'océan), donc le veto s'y applique. **Les plans
  d'eau intérieurs ont leur propre système** (`src/lake.js`, `src/plan-eau.js`,
  `data/water-tiles`), qui ne consulte ni la bathymétrie ni ce veto ; c'est là
  qu'il faudra aller si Adrien veut voir le Vaccarès en bleu à z12. Ce n'est pas
  le sujet de cette tâche, et le rendre à la bathymétrie ferait revenir les
  carrés.
- **`remplirHauteurs` fusionne SANS veto au tout premier remplissage** d'une
  nouvelle emprise, le temps que le masque arrive. C'est un choix : le chemin
  d'image ne doit pas attendre le réseau. En pratique le crop est peint par des
  tuiles **déjà vetées** par `fondMarinTuile`, donc l'effet visible est nul.
