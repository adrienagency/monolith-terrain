# D18 — LA FIDELITE TOTALE EST LEVEE

> **Adrien, 2026-08-24 :** en reponse a la question « la contrainte *full
> fidelity, no simplification, even if heavy* n'a jamais ete levee, que fait-on ? »
> — **« Je la leve. Routes simplifiees. »**

## CE QUE ÇA ABROGE

⛔ **`docs/superpowers/specs/2026-07-15-map-layers-osm-sp2-design.md:12-21`** :
*« full fidelity — no simplification… even if heavy »*, posee comme contrainte
**non negociable**.

⚠️ **C'est ELLE qui a tue le calque routes le 2026-07-29**, et la chaine est
tracee : la contrainte excluait nommement les jeux pre-simplifies
(Protomaps, OpenMapTiles) et **forcait Overpass**. Le poids qui a fait retirer
les routes est l'arithmetique exacte de ce qui avait ete exige quatorze jours
plus tot.

⚡ **ET LE PLAN DU 2026-07-25 AVAIT POSE LA QUESTION DU REVIREMENT. Elle n'a
jamais ete tranchee. Quatre jours plus tard le calque partait.**
➡️ **Une question de conception laissee ouverte a coute quatorze jours de
travail.** C'est la lecon, plus encore que la decision.

## LE PRIX DE LA CONTRAINTE, MESURE

Boite alpine, meme emprise :

| | poids |
|---|---|
| ossature (`motorway` + `trunk`) | **3,8 Mo** |
| reseau complet, sentiers et marches compris | **~1 Go** |

**Facteur ~263.** Le second n'existait que pour qu'un cran de detail continue
d'afficher les `footway`.

## CE QUE LA LEVEE AUTORISE

✅ **La simplification geometrique par niveau de zoom** (Douglas-Peucker et
successeurs, via `tippecanoe`/`planetiler`).
✅ **Les jeux de tuiles pre-cuits** — Protomaps, OpenMapTiles, ou une cuisson
maison.
✅ **Le filtre par classe**, qui est *le* mecanisme d'allegement :
`highway + major_road` = **67 969 pts a Paris, 61 603 a Tokyo, 6 298 a
Chamonix** — cout quasi constant. Tout afficher = **261 000 / 412 000**.

## ⛔ CE QUE LA LEVEE N'AUTORISE PAS

⛔ **Les `service`, `footway`, `path`, `track` ne reviennent pas.** `service`
seul = **65,6 M de ways**, plus que tout de `motorway` a `unclassified` reuni ;
la falaise est **z11 → z13** (8,4 % → 42,6 % → 68,1 % du reseau mondial).
⛔ **Le cran de detail 3** — la regle a ne jamais rouvrir.
⛔ **Overpass en direct.** Tolerance reelle : **< 100 requetes et < 10 Mo par
JOUR** pour un usage regulier, et le commercial est renvoye vers un serveur
payant. Une requete Chamonix z12 pesait **15 Mo** ; Paris z12 a rendu
**351 414 ways / 238 Mo en 200 OK** — un succes, donc aucun repli.

## LES TROIS REGLES QUI SORTENT DES RECHERCHES

1. ⚡ **Le niveau de tuile se choisit sur la TAILLE DE LA FENETRE, jamais sur le
   zoom camera.** Paris 27 km : z12 = **1,87 Mo**, z10 = **187 Ko**. **Facteur
   10 pour la meme image.** C'est la faute qu'avait commise `ROAD_LOD_LEVELS`.
2. ⚡ **Aucune classe n'apparait par un test booleen.** Elle apparait par une
   valeur continue partant de zero : largeur sous-pixel (OSM Carto fait entrer
   une autoroute a **0,4 px**), opacite qui monte (Positron : 0,5 px + 50 % a
   z6), classes decalees. ⛔ **Un claquement annulerait le travail de D16.**
3. ⚡ **Aucun nom de route.** MapLibre admet dans ses propres commentaires que
   les etiquettes se chevauchent au dezoom rapide. Et un style professionnel
   n'en afficherait aucune sur la plage de ShibuMap. **Corollaire : ne pas
   transporter l'attribut `name`, le plus lourd de la couche.**

## CE QUI DORT DEJA DANS LE DEPOT

⚡ **MapLibre dessine ses routes dans une TEXTURE PAR TUILE, mise en cache,
drapee sur le relief.** Et **`src/map/aerial-layer.js` fait deja exactement ca
ici** : 0 octet deploye, 1,1 a 3,4 Mo par vue.
⚡ **`scripts/build-road-tiles.mjs` existe, supprime mais recuperable.**
⚡ Le drapage est resolu et documente (`densifyWorld` + `drapeWorld`).
⚠️ **Deux corrections verifiees a ses commentaires** : `polygonOffset` n'a
**aucun effet sur `THREE.Line`** (WebGL n'expose pas `POLYGON_OFFSET_LINE`) — ca
ne marche que grace a `Line2`/`LineSegments2` ; et ce n'est **pas** independant
de l'echelle.

## LES DEUX ARBITRAGES QUI RESTENT A ADRIEN

1. ⚠️ **La licence, et il vend des templates.** Afficher a la volee est
   confortable (Produced Work). **Mais des qu'on PERSISTE et qu'on DISTRIBUE de
   la geometrie routiere** — gabarits vendus, paquets hors ligne, fichiers
   `.shibumap-race` — **l'ODbL oblige a offrir gratuitement le jeu derive.**
   ⛔ **Arbitrage produit, pas technique.** Et la lecture est celle des
   recommandations OSMF, **pas celle d'un avocat**.
2. ⚠️ **L'exageration verticale ×2,8.** Les cartographes du relief disent
   l'inverse de ce qu'on croyait : *une ligne ne casse pas un relief ; c'est un
   relief trop fort qui fait flotter la ligne*. **Swisstopo affiche TOUTES les
   routes du pays** sur la carte en relief la plus admiree du monde.

## LA MESURE A FAIRE AVANT LA PREMIERE LIGNE DE CODE

⚡ **Le poids d'un PMTiles mondial borne aux quatre classes hautes.** Estime a
**4-6 Go, NON VERIFIE** — aucune source publique. `tippecanoe --dry-run` le
donne. **C'est le chiffre qui decide de l'hebergement.**
