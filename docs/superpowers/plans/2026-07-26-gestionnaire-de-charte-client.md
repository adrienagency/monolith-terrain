# Gestionnaire de charte graphique client

**Date** : 2026-07-26 · **Statut** : conception proposée, EN ATTENTE DE VALIDATION
**Demande d'Adrien** : qu'un client puisse injecter SA charte dans ShibuMap —
palettes étendues automatiquement, logos en plusieurs variantes (PNG + SVG),
ses typographies en remplacement des nôtres, des photos sur les points de
passage au survol, et l'enregistrement du tout comme template de charte.
**Sans serveur pour l'instant** (tout en session), mais avec des comptes
clients prévus plus tard.

---

## 1. Ce qui existe déjà — et qu'il ne faut surtout pas réécrire

L'audit du code a trouvé beaucoup plus de matière que prévu. **Le gros de ce
gestionnaire est de l'assemblage, pas de l'invention.**

| Besoin | Ce qui existe | Où |
|---|---|---|
| N couleurs → rampe 8 teintes | `resampleStops`, `expandToRampStops` | `shuffle-pool.js:48`, `palette.js:212` |
| Refuser une palette illisible | `isElegantPalette` (amplitude, mer monotone) | `shuffle-pool.js:93` |
| Appliquer une palette partout | `applyPalette` (terrain + globe + encre + AO) | `main.js:1888` |
| Format de fichier + import sûr | `serializeTemplate` / `parseTemplate` | `templates-user.js:86` |
| **Assainir un SVG client** | `sanitizeSvgMarkup`, `isValidIconDataUrl`, `rasterizeToCanvas` | `ui/sport-icons.js:85` |
| Poser une image sur le socle | `_addWallPlane`, `setRace` | `ground-info-layer.js:146` |
| **Carte de survol** | `buildHoverCard` + clamp viewport + lâcher hors écran | `peaks.js:51` |
| Recolorer l'UI depuis une rampe | `retheme()` (non exportée) | `ui/store.js:61` |
| Formulaire injecté dans un panneau | `buildPaletteCreation` | `ui/create-panel.js:25` |

## 2. Deux découvertes qui changent le plan

### 2.1 Une faille de sécurité, déjà là

L'upload du logo de course (`ui/studio.js:140-151`) **ne passe pas** par
`sanitizeSvgMarkup`. Un SVG contenant un `<script>` ou un `onload=` entre tel
quel dans `draft.race.logo`, puis ressort dans un `<img src>`
(`race-labels.js:63`). Le pipeline d'assainissement existe pourtant et est
testé — il est juste branché ailleurs (icônes de calque GPX).

**À corriger indépendamment de ce projet**, et avant d'ouvrir l'upload à des
clients. C'est une ligne de code.

### 2.2 localStorage ne tiendra pas

Les templates saturent **déjà** le quota avec de simples vignettes JPEG :
`main.js:2202` gère l'erreur en dépilant l'entrée et en alertant. Une charte,
c'est plusieurs logos plus des photos de points de passage à 1-5 Mo pièce.

**Il faut IndexedDB dès la phase sans serveur** (rien ne l'utilise dans le
repo aujourd'hui). C'est la contrainte d'architecture la plus structurante,
et elle tombe bien : le modèle « métadonnées en JSON, blobs à part » est
exactement ce qu'un backend demandera plus tard.

## 3. L'architecture proposée

Trois couches, dans l'ordre de dépendance :

**`src/brand.js` — module PUR, testé.** Le modèle de charte, sa whitelist de
clés, sa sérialisation `.shibumap-brand`, sa validation défensive à l'import
(sur le modèle exact de `parseTemplate`, qui refuse un fichier au mauvais
format et re-dérive ce qu'il peut plutôt que de faire confiance). Aucun DOM,
aucun three.js — donc testable en `node --test` comme `race-model.js`.

**`src/brand-store.js` — la persistance.** Métadonnées dans localStorage
(léger, synchrone, déjà notre habitude), **blobs dans IndexedDB** référencés
par identifiant. Une seule interface `get/put/list/delete` que le futur
backend remplacera sans que le reste du code s'en aperçoive.

**`src/ui/brand-panel.js` — le panneau.** Cinq sections dans un `Panel`
existant : Couleurs, Logos, Typographies, Photos, Chartes enregistrées.

### Le point délicat : « étendre » une palette client

`expandToRampStops` interpole entre 4 couleurs **déjà ordonnées** du bas vers
le haut. Personne ne décide *quel rôle* joue une couleur de marque, ni ne
garantit qu'une rampe reste lisible. C'est le seul vrai morceau d'invention.

La mécanique à reprendre est celle de `generateEarthPalette` (`palette.js:269`)
— ancres HSL, interpolation par arc de teinte court, arc de chroma, océan
harmonisé, encre dérivée — mais ses ancres sont **codées en dur par biome**.
Il faut en extraire une fonction paramétrée par les couleurs du client, puis
faire valider le résultat par `isElegantPalette` : si la rampe échoue, on
corrige la luminance plutôt que de livrer quelque chose de moche.

## 4. Les quatre chantiers, par difficulté croissante

**A. Couleurs — facile.** Tout existe. Le client entre 2 à 5 couleurs, on
propose 2-3 rampes candidates, il choisit, `applyPalette` fait le reste.
Bonus quasi gratuit : extraire `retheme()` de la boutique en module pur et
**recolorer l'interface** aux couleurs du client.

**B. Logos — moyen.** Passer du slot unique `race.logo` à une bibliothèque de
variantes avec des rôles (principal / monochrome / horizontal / favicon) et
des emplacements (flanc du socle, cartouche de départ, topbar). Deux pièges
identifiés : le cartouche applique aujourd'hui `filter: brightness(0)
invert(1)` (`race-labels.css:111`), ce qui **écrase les couleurs de marque** —
il faut une vraie variante « sur fond sombre » plutôt qu'un filtre ; et tout
upload doit passer par le sanitizer.

**C. Photos au survol — moyen.** Ajouter un champ `photo` au waypoint
(`studio.js:23`, `race-model.js:61`), ouvrir `pointer-events` sur les
cartouches — aujourd'hui `.rl-root` est en `pointer-events: none`
(`race-labels.css:9`) — et réutiliser la carte de survol de `peaks.js`.
⚠️ Deux détails qui mordent : les étiquettes couvrent une grande partie de
l'écran, ouvrir les événements pointeur risque de **voler les gestes de
caméra** (le studio limite déjà ça aux chips) ; et il faut ajouter `photo` à
la signature `sig()` (`race-labels.js:53`) **par sa longueur**, comme le logo,
sinon soit la vignette ne se rafraîchit jamais, soit on refait un
`JSON.stringify` à chaque image.

**D. Typographies — le plus dur, et de loin.** Il n'y a **aucun** point de
passage unique. Les polices vivent sur trois couches : deux variables CSS
(`v28.css:5`, `store.css:19`), **une quinzaine de `font-family` en dur**
(`style.css`, `hub.css`), et quatre constantes JS pour les textures canvas
(`labels.js:22` en Georgia sans variable ni préchargement,
`ground-info-layer.js:14`, `map/text-label.js:7`).

Quatre façons de se casser les dents, toutes documentées dans le code :
1. **Fallback silencieux** — sans `document.fonts.load()` avant le premier
   `fillText`, tout se dessine en police système sans la moindre erreur.
2. **Textures périmées** — les canvas sont générés une fois ; changer la police
   ne redessine rien tant qu'on n'orchestre pas un re-render global.
3. **Métriques** — l'interlettrage de `textCanvas` est calibré sur nos polices ;
   une police plus large déplace les cartouches du socle.
4. **Poids manquant** — une police client sans axe variable cassera les
   `weight: 700/800` de `text-label.js`.

**Proposition : livrer D en dernier, et en deux temps.** D'abord l'UI et les
étiquettes HTML (variables CSS, effet immédiat, risque nul), et seulement
ensuite les textures 3D avec leur orchestration de re-render.

## 5. Le backend — réponse à la question « Render ? »

Recherche faite sur sept options. **Réponse courte : surtout pas Render**, pour
trois raisons cumulées : il ne fournit **aucune authentification** (donc des
semaines à écrire le composant le plus sensible d'une app à comptes) ; sa
franchise de bande passante est de 5 à 25 Go/mois puis $0,15/Go, ce qui est
structurellement incompatible avec un service qui sert des photos ; et son
palier gratuit est un leurre (veille à 15 min, Postgres détruit à 30 jours,
disques persistants interdits en gratuit).

| | Auth | Base | Fichiers | Egress | Plafond de dépenses | 30 clients | 300 clients |
|---|---|---|---|---|---|---|---|
| **Supabase Pro** | ✅ | Postgres | ✅ | $0,09/Go | ✅ **par défaut** | $25 | ~$48 |
| **Netlify + R2** | ✅ gratuite | ✅ (Neon) | R2 | **$0** | ✅ | ~$20 | ~$21 |
| **Cloudflare** | ❌ à assembler | D1 | R2 | **$0** | ❌ | $0-5 | ~$6 |
| Firebase | ✅ | Firestore | Blaze requis | $0,12/Go | 🔴 **aucun** | ~$7 | ~$62 non borné |
| **Render** | 🔴 **aucune** | Postgres | disque | $0,15/Go | ❌ | ~$44 | ~$115 |

**Recommandation : Supabase Pro à $25/mois**, parce que c'est la seule pile où
authentification, base et fichiers partagent **le même modèle de sécurité**.
Les Row Level Security de Postgres garantissent en quelques lignes de SQL
qu'un client ne peut pas lire les photos d'un autre — garantie appliquée
**dans la base**, pas dans notre code. Pour une personne seule qui héberge des
données clients, c'est le filet qui compte : ailleurs, un `WHERE tenant_id`
oublié est une fuite. C'est aussi le seul acteur dont le plafond de dépenses
est **activé par défaut**, et on en sort avec un `pg_dump`.

**L'optimisation à connaître d'avance** : garder l'authentification et la base
sur Supabase, et basculer **uniquement les photos** sur Cloudflare R2 le jour
où la bande passante dépasse ~250 Go/mois. R2 ne facture **aucun egress** —
c'est le seul poste du dossier où un acteur est un ordre de grandeur devant.
À 300 clients, cela ramène la facture de $48 à ~$26. C'est une bascule de
quelques heures, pas une migration.

**Deux signaux à surveiller si on préférait Netlify** (option 2, séduisante
puisqu'on y est déjà) : le prix du stockage Blobs n'est publié nulle part, et
depuis le 16 juillet 2026 des dizaines de comptes gratuits rapportent des
crédits divisés par dix avec déploiements bloqués, **sans réponse officielle**.
À vérifier avant de s'engager.

## 6. Ordre de livraison proposé

| Lot | Contenu | Dépend de |
|---|---|---|
| **0** | Corriger la faille SVG du studio + réparer le script `test` (deux fichiers fantômes) | rien |
| **1** | `brand.js` pur + tests (modèle, whitelist, sérialisation, import défensif) | rien |
| **2** | `brand-store.js` : métadonnées localStorage + blobs IndexedDB | 1 |
| **3** | Couleurs : marque → rampe validée + recolorage de l'UI | 1 |
| **4** | Logos multi-variantes, via le sanitizer | 2 |
| **5** | Photos de waypoints + survol des cartouches | 2 |
| **6** | Typographies, en deux temps (UI puis textures 3D) | 2 |
| **7** | Chartes enregistrées : export/import `.shibumap-brand`, galerie | 1-6 |

Les lots 3, 4 et 5 sont indépendants entre eux : parallélisables.

## 7. Questions avant de coder

1. **Un client = une charte, ou plusieurs ?** Ça décide si le modèle est un
   objet unique ou une collection nommée (et donc l'UI entière).
2. **Les photos de points de passage : une par point, ou une galerie ?**
   Et au survol : vignette seule, ou vignette cliquable qui agrandit ?
3. **Jusqu'où va « remplacer les typographies » ?** Toute l'app, y compris les
   textes gravés sur le socle et les étiquettes de carte — ou seulement
   l'interface et les cartouches de course ? Le premier cas, c'est le lot 6
   entier ; le second, c'est une demi-journée.
4. **La charte recolore-t-elle l'interface** (panneaux, boutons) ou seulement
   la carte ? Techniquement quasi gratuit, mais c'est un choix de produit.
5. **Backend : je pars sur Supabase le moment venu ?** Ou tu préfères qu'on
   reste chez Netlify avec R2 pour les images ?
