# PF1 — LE PROFIL : qui consomme, chiffré, sur une machine lente

Arbre : `C:\Dev\wt-pp1` · branche `perf-profil`. Serveur : port libre **> 6000**.
**Lis d'abord `socle-perf.md`** (même dossier) : la demande d'Adrien, ce qui est
déjà su, comment peser sans publier un faux chiffre, les périmètres.

## TON RÔLE : LA MESURE. Tu ne corriges rien — tu dis OÙ ça part.

Les trois autres agents (PF2 priorité, PF3 mer/effets, PF4 bugs) attendent ton
profil pour savoir si leur cible est la bonne. **Un profil faux les envoie tous
optimiser la mauvaise chose.** Google Earth tient 60 i/s sur un portable à GPU
intégré : c'est l'étalon d'Adrien. Chiffre l'écart.

## CE QU'IL FAUT RENDRE

**① Le budget d'une image, décomposé, à trois postes de vue** — orbite
(2 000 km), surface hors crop (130 km), crop (5 km) — sur **trois machines
émulées** : la tienne ; CPU ×4 ; CPU ×6 + `pixelRatio 2` (portable Retina
lent). Pour chaque cellule : **p50 / p99 du temps d'image**, et la décomposition

| poste | comment le peser |
|---|---|
| GPU par passe du compositeur (`passeFond`, `passeSurface`, N8AO, DOF, effets) | minuterie du pilote, une requête par passe |
| GPU globe seul (tuiles, nuanceur) | idem, `renderer.info.render` (appels, triangles) |
| CPU `_traverse` + `_request` + décodage des tuiles | `performance.mark` DANS la boucle, pas autour |
| CPU couches vectorielles (eau, rivières, étiquettes, sommets) | idem |
| CPU JS total vs `requestAnimationFrame` disponible | Long Tasks, `PerformanceObserver` |
| mémoire GPU (textures, tampons) et tas JS | `renderer.info.memory`, `performance.measureUserAgentSpecificMemory` si dispo, sinon `memory.usedJSHeapSize` sur 60 s |
| réseau : requêtes et octets par minute d'usage | au protocole CDP, pas `getEntriesByType` |

**② Le classement des consommateurs**, du plus cher au moins cher, **avec la
part de chacun en %** du temps d'image, par poste de vue. C'est la livraison.

**③ Le coût du « rien »** : une image où l'utilisateur ne touche à rien. ⚠️ Le
globe tourne tout seul après 3 s → mesure **avec** cette rotation (l'état
actuel) et **en la gelant** (ce que serait un rendu à la demande). Google Earth
ne rend pas une image quand rien ne bouge — **combien ça vaudrait ici ?**

**④ Ce que font Google Earth et Cesium, et que nous ne faisons pas.** Pas une
liste de blog : pour chaque technique, **le poste de ton profil qu'elle
attaquerait et le gain plausible chiffré** depuis tes mesures. Au minimum :
rendu à la demande ; erreur d'espace-écran (SSE) pour choisir le niveau, pas la
distance ; file de requêtes à priorité par distance au centre de l'écran et par
tronc de vue ; annulation des requêtes hors champ ; décodage hors du fil
principal (Worker + `createImageBitmap`) ; compression de textures GPU ;
`preserveDrawingBuffer` off ; `powerPreference` ; fusion des passes.

**⑤ Les bugs qui coûtent**, vus en chemin, pour PF4 : erreurs GL par image,
allocations dans la boucle, `dispose()` manquants, textures recréées,
recompilations de nuanceur en cours d'usage (`renderer.info.programs`).

## PIÈGES PROPRES À CETTE TÂCHE

- ⛔ **Le profil de Chrome DevTools sur un panneau qui ne composite pas ment.**
  Chrome sans tête + CDP (`Tracing`, `Performance.getMetrics`), ou le vrai
  Chrome d'Adrien via `chrome://tracing` — mais **écris lequel**.
- **Le palier machine change tes chiffres sous toi** (il réimpose `setTier` à
  chaque image et dégrade sous charge). Relève `window.__palierMachine` avec
  chaque cellule, et **fixe-le** pour comparer.
- **Ne compare jamais deux cellules prises à deux altitudes qui diffèrent de
  plus de 5 %** — le nombre de tuiles n'est pas le même.

## L'ATTENDU

Le tableau ①, le classement ②, le coût du « rien » ③, le comparatif ④ chiffré,
la liste ⑤ — et un `scripts/profil-pf1.mjs` **rejouable** qui produit ① en une
commande, pour que PF2/PF3/PF4 mesurent leur avant/après avec le **même** banc.
`rapport-PF1.md`. Aucune modification de `src/` hors sondes.
