# Routes & couches carto — quitter Overpass live pour des tuiles vectorielles

**Date** : 2026-07-25 · **Statut** : plan proposé, EN ATTENTE DE DÉCISION ADRIEN
**Déclencheur** : « regarde la possibilité de remplacer le système de route par
ceux proposés par MapTiler, ils ont l'air vraiment efficaces »
**Sources** : recherche externe (tarifs/CGU/docs officiels MapTiler + 10
alternatives) + audit interne complet du pipeline carto (deux rapports d'agents,
2026-07-25).

---

## 1. Verdict en une phrase

**Oui, il faut quitter Overpass live — mais pas pour MapTiler Cloud : ses CGU
interdisent notre cœur de business.** La voie recommandée est **PMTiles
auto-hébergé** (nos propres tuiles, construites avec nos règles, servies en
statique sur Netlify) — elle était d'ailleurs déjà esquissée dans notre code.

---

## 2. Ce que l'audit interne a établi (le constat qui force la décision)

1. **Notre usage actuel d'Overpass est non conforme et l'a déjà prouvé** : le
   repo documente lui-même (scripts/build-road-tiles.mjs) que l'usage
   « backend-style » est listé comme inacceptable par Overpass, et qu'on s'est
   **déjà fait bannir (429) depuis une seule IP en quelques dizaines de
   requêtes**.
2. **Le filet de sécurité ne couvre pas le pire cas** : un patch z12 sur Paris
   renvoie **351 414 ways / 238 Mo en 200 OK** — le repli Natural Earth ne se
   déclenche que sur échec, pas sur succès toxique. Risque accepté, documenté,
   non corrigé.
3. **Le plan B est mort** : les tuiles routes maison (Overture) pèsent ~1 Go,
   n'ont jamais été déployées, et le chemin de code correspondant est mort en
   prod. L'eau vit sur une couverture « peau de léopard » (région alpine riche,
   reste du monde lacs ≥ 5 km² seulement, 3 lacs français dans Natural Earth).
4. **Les échecs sont silencieux partout** : 429/504/timeout → `null` → repli
   pauvre sans que l'utilisateur sache pourquoi sa carte est vide.
5. **Bonne nouvelle structurelle** : le pipeline aval (projection, clip au bloc,
   drapage, batching, tiers de routes) est **déjà agnostique de la source** —
   prouvé trois fois (Natural Earth, Overpass, Overture). Migrer = réécrire
   ~250 lignes de cascades, en conserver ~700.
6. **Les courbes de niveau ne sont PAS un sujet** : elles sont générées dans le
   shader du terrain, coût zéro, aucune donnée externe nécessaire — l'argument
   « MapTiler fournit les contours » ne pèse rien chez nous.

## 3. Ce que la recherche externe a établi

### MapTiler : excellent schéma, CGU incompatibles avec notre modèle
- Le schéma OpenMapTiles est le meilleur du marché pour notre besoin (routes
  classées `class/subclass`, eau, toponymes — même vocabulaire que notre
  `roadRank` actuel, testé compatible).
- **MAIS les CGU du plan Cloud** (citations vérifiées) : cache serveur/CDN
  **interdit**, pré-téléchargement **interdit**, export vidéo limité aux
  réseaux sociaux < 100 k abonnés avec attribution à l'écran, impression
  limitée à l'A4 interne. **Rien ne couvre la vente d'un export HD ou d'une
  carte de course à un client** — notre gagne-pain. Il faudrait un contrat
  sur mesure (prix inconnu). L'On-Prem à 2 500 $/an interdit de surcroît de
  servir depuis un cloud public (Netlify !) sans accord.
- Plancher réel : 360 $/an (le plan gratuit interdit tout usage commercial).

### Le classement final de la recherche
1. MapTiler On-Prem (2 500 $/an) — le plus riche, mais seulement avec un
   accord écrit couvrant exports vendus + hébergement Netlify. Engagement
   sérieux pour un indépendant.
2. **Protomaps / VersaTiles auto-hébergé (PMTiles)** — licence BSD/CC0, coût
   quasi nul, **aucune clause d'export puisque c'est nous qui hébergeons**.
3. OpenFreeMap — gratuit illimité mais porté par une seule personne :
   disqualifié comme dépendance critique d'un produit commercial.
4. Overpass amélioré (instance privée + cache) — coût nul mais ne résout ni la
   généralisation ni la couverture uniforme.
5. Mapbox/Carto/Thunderforest/etc. — écartés (prix, opacité, ou rigidité).

## 4. La décision produit à assumer

Notre spec SP2 a écrit : « Full fidelity — no simplification… This rules out
Protomaps/OpenMapTiles ». Migrer vers des tuiles = **revirement de cette
contrainte**. Deux faits la rendent tenable :
- La contrainte est **déjà entamée** : les lake-tiles monde sont simplifiées au
  build (« a sub-pixel tolerance is a rendering detail, not a modification »).
- Elle est **déjà trahie en pratique** : sous z12, les routes viennent de
  Natural Earth 1:10m — bien plus grossier que n'importe quelle tuile MVT.
- Et surtout : en construisant NOS tuiles, **nous choisissons le niveau de
  simplification** — y compris « aucune » aux zooms fins si Adrien y tient.

## 5. Le plan recommandé : PMTiles maison (« ShibuTiles »)

### Phase 0 — mitigation immédiate (une soirée, indépendante du reste)
- AbortController + timeout client sur Overpass ; toast discret sur échec
  (fin des cartes vides inexpliquées) ; garde « succès toxique » (Content-Length
  > seuil → repli volontaire).

### Phase 1 — le pipeline de tuiles (offline, script)
- `scripts/build-shibutiles.mjs` : depuis les extraits **Overture/OSM**
  (données ODbL, déjà utilisées), générer un **PMTiles planet** des couches
  dont on a besoin : `transportation` (classes que `roadRank` consomme déjà),
  `waterway`, `water`. Simplification PAR ZOOM réglée par nous (agressive au
  loin, nulle ou sous-pixel au près — la contrainte d'Adrien est respectée là
  où elle se voit).
- Hébergement : un fichier .pmtiles sur Netlify/R2, lu par **range-requests**
  (la lib pmtiles fait ~15 Ko) — zéro backend, zéro clé, zéro quota, cache CDN
  natif. Estimation : quelques Go pour le monde en 3 couches, ~11 $/mois au
  pire sur R2.

### Phase 2 — l'adaptateur client (~250 lignes)
- Décodeur MVT léger (`pbf` + `@mapbox/vector-tile`, MIT, quelques Ko) →
  reprojection tuile→monde (math slippy triviale, `tile-index.js` réutilisable)
  → sortie aux **deux formats internes existants** (polylignes `{coords, rank}`
  et polygones `{outer, holes}`). Le pipeline aval ne bouge pas d'une ligne.
- Les 3 cascades (roads/water) remplacées par UNE source uniforme mondiale.

### Phase 3 — nettoyage
- Suppression : Overpass pour roads/water (gardé pour peaks/transports qui ont
  besoin de tags exotiques), fallback Natural Earth roads/rivers/lakes
  (~40 Mo), water-tiles alpines (76 Mo), lake-tiles (177 Mo). **Jusqu'à
  ~290 Mo de déploiement en moins.**

### Ce qu'on gagne / ce qu'on perd
| Gagné | Perdu |
|---|---|
| Fin du risque 429/504/238 Mo | Fraîcheur à la minute (non nécessaire chez nous) |
| Couverture mondiale UNIFORME (fin de la boîte alpine) | Requêtes ad hoc 3 lignes (peaks/transports restent sur Overpass) |
| Généralisation cohérente par zoom, temps de rebuild prévisible | La pureté « géométrie brute » aux zooms lointains (déjà perdue en pratique) |
| ~290 Mo de deploy en moins, zéro dépendance commerciale | — |

## 6. Et MapTiler alors ?
À garder en tête pour UNE chose : si un jour on veut leur Terrain RGB + Ocean
RGB (bathymétrie potentiellement meilleure que Terrarium), la discussion
commerciale se fera à ce moment-là, avec la question des exports vendus posée
par écrit d'entrée. Pour les routes : non — le beau rendu « outdoor » de leur
démo est un *style* de leur moteur, pas leurs données ; nos données seront les
mêmes (OSM), et notre rendu est le nôtre.

## 7. À trancher avec Adrien
1. **Le revirement de contrainte** : accepter la simplification par zoom là où
   elle est sous-pixel (en gardant la fidélité brute aux zooms fins) ?
2. Périmètre v1 du pipeline : monde entier d'emblée, ou Europe d'abord (fichier
   plus léger, itération plus rapide) ?
3. Phase 0 (mitigation Overpass) : à livrer tout de suite même si le reste
   attend ?
