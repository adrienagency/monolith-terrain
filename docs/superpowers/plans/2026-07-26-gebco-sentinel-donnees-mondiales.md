# GEBCO et Sentinel-2 — deux sources mondiales, deux verdicts opposés

**Date** : 2026-07-26 · **Statut** : plan proposé, EN ATTENTE D'ARBITRAGE
**Origine** : catalogue de sources repéré par Adrien (XYZ/WMS/WFS/WMTS/ArcGIS).
Deux candidats en sortaient : GEBCO pour la bathymétrie, Sentinel-2 cloudless
pour l'imagerie. **Recherche faite : les deux ne se ressemblent pas du tout.**

---

## 1. Le verdict, avant tout le reste

| Source | Licence | Vente d'exports | Verdict |
|---|---|---|---|
| **GEBCO_2026** | domaine public | **explicitement autorisée** | **FEU VERT** |
| **Sentinel-2 cloudless 2018-2025 (EOX)** | CC BY-**NC**-SA 4.0 | interdite | **FEU ROUGE** |
| Sentinel-2 cloudless 2016/2017 (EOX) | CC BY 4.0 | autorisée | fenêtre étroite, à confirmer |
| Sentinel-2 brut (AWS Open Data) | ouverte | autorisée | possible, mais gros travail |
| ESA WorldCover | CC BY 4.0 | autorisée | autre chose (classes, pas photo) |

GEBCO écrit noir sur blanc que l'on peut « **commercially exploit** the GEBCO
Grid […] by including it in their own product or application ». C'est l'exact
opposé du précédent MapTiler qui nous avait fermé la porte.
<https://www.gebco.net/data-products/gridded-bathymetry/terms-of-use>

EOX, lui, réserve les millésimes récents au non-commercial, et sa licence
commerciale payante **interdit de transférer la licence aux utilisateurs
finaux** — or vendre un export d'image à un client ressemble beaucoup à ça.
<https://cloudless.eox.at/documentation/license>

## 2. GEBCO apporte-t-il vraiment quelque chose ?

C'était la question à trancher en premier, parce que nos tuiles AWS terrarium
portent déjà de la bathymétrie. Réponse : **oui, largement**.

| | Résolution océan | Ce qu'on voit |
|---|---|---|
| AWS terrarium (source ETOPO1) | ~1 800 m | bassins lisses, dorsales floues |
| GEBCO_2026 | ~463 m (15″) | canyons, monts sous-marins, plateaux |

Soit ~4× mieux en linéaire, ~15× en surface. Aujourd'hui nos fonds marins sont
peints par rampe hypsométrique faute de mieux ; avec GEBCO ils auraient un
vrai relief. C'est directement la tâche « qualité de la mer » qui traîne.

Source de la composition terrarium :
<https://github.com/tilezen/joerd/blob/master/docs/attribution.md>

## 3. Ce qu'il faut construire pour GEBCO

**Pas de service de tuiles officiel.** GEBCO publie un WMS (sans limite de
débit annoncée — donc à ne pas taper en production) et le grid en GeoTIFF.
La licence nous autorise sans réserve à fabriquer nos propres tuiles : c'est
la seule voie sûre, et c'est exactement le même métier que le plan PMTiles des
routes, qui attend lui aussi un arbitrage.

**P1 — Fabrication (une fois, hors ligne).** Télécharger `gebco_2026_geotiff`
(4 Go zippé, 7,2 Go décompressé), découper en tuiles terrarium-compatibles
(même encodage `R*256 + G + B/256`, donc AUCUN changement dans le décodeur du
terrain), à ranger comme `public/data/gebco-z{n}` avec la même discipline de
gitignore que `coast-z6` (315 Mo, déjà hors dépôt et présent dans les deploys).

**Jusqu'à quel zoom ?** La bonne unité n'est pas un niveau mais **464 m par
pixel** (15″ à l'équateur). Traduit en Web Mercator, tuiles de 256 px :

| zoom | m/pixel | tuiles monde | ce que ça vaut |
|---|---|---|---|
| 6 | 2 446 | 4 096 | l'ETOPO1 des tuiles AWS (1 800 m) est **déjà plus fin** |
| 7 | 1 223 | 16 384 | GEBCO commence à gagner, mais on jette 2,6× son détail |
| **8** | **611** | **65 536** | **quasi natif — le bon compromis** |
| 9 | 306 | 262 144 | natif atteint, plus rien à gagner au-delà |
| 10+ | ≤ 153 | ≥ 1 M | sur-échantillonnage pur |

Deux conséquences que je n'avais pas vues dans la première version de ce plan :

1. **En dessous de z7, GEBCO n'apporte RIEN** : l'ETOPO1 déjà présent dans les
   tuiles AWS est plus fin que le pixel. Inutile de fabriquer z0-z6.
2. **z0-7 était une erreur** : à 1 223 m/pixel on gaspille les deux tiers de la
   donnée. Il faut monter à **z8**, et z9 est le vrai plafond utile.

Poids (seules les tuiles à l'eau comptent, ~65 % après déformation Mercator ;
le fond abyssal est lisse donc les PNG compressent bien) :

| couverture | tuiles à l'eau | poids estimé |
|---|---|---|
| jusqu'à z8 | ~57 000 | **0,4 à 0,8 Go** |
| jusqu'à z9 | ~227 000 | 1,8 à 3,3 Go |

**Recommandation : z7-z8, et z9 réservé aux plateaux continentaux.** Au-delà de
z8 le relief intéressant est côtier ; les plaines abyssales n'ont rien de plus
à montrer et représentent l'essentiel du volume. Au-dessus de la dernière
tuile disponible, le loader interpole — ce qui est honnête, un fond marin à
464 m est lisse par nature.

**P2 — Fusion avec le terrarium.** Là où le terrarium donne un pixel sous 0 m,
préférer GEBCO. Le fondu doit se faire dans le loader de tuiles, pas dans le
shader : le shader ne doit jamais savoir d'où vient une altitude. Garde-fou :
le trait de côte doit rester EXACTEMENT là où il est (on vient de passer une
session entière sur les polders), donc la fusion ne touche que le strictement
négatif, avec le masque côtier existant comme arbitre.

**P3 — Attribution et mentions.** Ajouter GEBCO au bandeau de crédits et un
avertissement « ne pas utiliser pour la navigation » (exigé par les CGU) dans
l'Aide. Relever le DOI exact du millésime 2026 avant mise en ligne.

**Coût** : P1 est un script de build à lancer une fois (comparable à
`build:watertiles`), P2 est une trentaine de lignes dans le loader, P3 est du
texte. Le vrai coût est le POIDS des tuiles et le temps de fabrication.

## 4. Sentinel-2 : ce que je propose

**Ne pas intégrer EOX.** Le NonCommercial est rédhibitoire pour un produit qui
vend des exports, et la porte de sortie commerciale d'EOX bloque justement la
sous-licence à l'acheteur final. On rejouerait MapTiler.

Trois issues, par ordre de rapport valeur/effort :

1. **Ne rien faire.** Notre photo aérienne actuelle couvre déjà les zones qui
   comptent, et l'identité de ShibuMap est la carte stylisée, pas la photo.
2. **ESA WorldCover** (CC BY 4.0, 10 m, commercial autorisé) : ce ne sont pas
   des photos mais des CLASSES d'occupation du sol (forêt, prairie, urbain,
   neige…). Ça ne remplace pas l'aérien — ça donnerait autre chose, et
   peut-être mieux pour nous : colorer le relief par biome réel au lieu d'une
   rampe d'altitude. À creuser comme une FEATURE, pas comme un remplacement.
3. **Sentinel-2 brut sur AWS Open Data** : la donnée Copernicus est ouverte et
   commercialement exploitable ; c'est la MOSAÏQUE sans nuages d'EOX qui ne
   l'est pas. Refaire cette mosaïque (compositing multi-dates, harmonisation
   radiométrique) est précisément le travail qu'EOX facture. Gros chantier,
   à ne lancer que si l'imagerie mondiale devient stratégique.

## 5. Ce qui reste incertain — à ne pas deviner

- **DOI et formulation d'attribution exacte de GEBCO_2026** : à relever sur la
  page du millésime avant toute mise en ligne.
- **Termes propres au WMS GEBCO** (par opposition au grid) : pas écrits
  explicitement. Sans objet si on fabrique nos tuiles, ce qui est le plan.
- **Statut CC BY 4.0 du millésime EOX 2016** : attesté en 2017, pas réaffirmé
  sur la page de licence actuelle. À faire confirmer par écrit si on y va.
- **Licence EMODnet** (WMTS bathymétrique tout prêt, ~100 m en Europe) : non
  instruite. Ce serait l'échappatoire si fabriquer nos tuiles s'avérait trop
  lourd — à instruire avant, pas après.

## 6. Trois questions pour Adrien

1. **On lance GEBCO ?** Le feu est vert juridiquement et le gain est réel sur
   les côtes et les reliefs sous-marins. Le prix est quelques centaines de Mo
   de tuiles à fabriquer et à héberger.
2. **z8 partout (0,4-0,8 Go) ou z9 sur les côtes en plus ?** z8 est le
   compromis honnête ; z9 quadruple le poids pour un gain visible uniquement
   près des plateaux continentaux. Ma recommandation : z8 d'abord, z9 côtier
   plus tard si le fond paraît mou en zoom rapproché.
3. **WorldCover : feature ou pas ?** Colorer le relief par occupation réelle du
   sol est une idée forte et libre de droits — mais c'est un autre projet que
   « remplacer la photo aérienne ».
