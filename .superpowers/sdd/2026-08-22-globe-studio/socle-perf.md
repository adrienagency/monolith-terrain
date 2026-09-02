# SOCLE COMMUN — campagne PERFORMANCE (PF1→PF4)

> **Adrien, 2026-09-01 :** *« Vérifie tout ce qui prend de la puissance de
> calcul et comment l'optimiser au max pour tourner sur des ordinateurs moins
> puissants. Je veux que notre solution soit aussi fluide que Google Earth.
> Utilise les solutions de ce type de logiciel. Ce qui est visible doit toujours
> être calculé en premier ; ce qui est au centre de l'écran est la priorité. La
> mer et les effets n'apparaissent qu'en mode crop. Tu peux aussi chercher les
> bugs. »*

## LES QUATRE TÂCHES, ET LEURS PÉRIMÈTRES (pour que les fusions ne se battent pas)

| tâche | sujet | arbre | terrain |
|---|---|---|---|
| **PF1** | **le profil** : qui consomme, chiffré, sur machine lente | `wt-pp1` | mesure seule, scripts, aucun `src/` sauf sondes |
| **PF2** | **la priorité** : visible d'abord, centre d'abord, à la Cesium | `wt-pp2` | `globe.js` `_traverse` / `_request` / file / éviction |
| **PF3** | **mer et effets seulement en crop** | `wt-pp3` | compositeur et passes (`main.js` ~2389–2710, ~4781–4857), `mer-sphere`, `ecume-mer`, `eau-refraction`, DOF/SSAO/grain, `perf.js` |
| **PF4** | **les bugs** qui coûtent | `wt-pp4` | `GL_INVALID_OPERATION`, le clic qui saute, le palier 0×0, la rotation propre, ce que PF1 exhume |

⛔ **Deux agents caméra tournent aussi** (`wt-orb3`, `wt-att2`) sur `modes.js`,
`zoom-continu.js`, `pivot-bloc.js` et la zone du pivot dans `main.js`
(~13200–13300). **Personne d'autre n'y touche.**

## CE QUI EST DÉJÀ SU — ne le remesure pas, sers-t'en

- **`palier-machine.js` / `perf.js`** : quatre paliers (0 pleine qualité → 3
  ESSENTIAL : pixelRatio 0,85, ombres off, grain off). ⚠️ **Dans le panneau
  navigateur de session, `signaux.ecran` rend `[0, 0]`** → le palier se décide
  sur un écran dégénéré. Relève `window.__palierMachine` **dans chaque mesure**.
- **Le compositeur a porté une seconde caméra + une seconde passe + un
  `ClearPass` pour dessiner UN sprite** (0 triangle sur 60,4 % des images).
  Voir `main.js` ~4781–4857. Vérifie ce qu'il en reste.
- **`GL_INVALID_OPERATION` à chaque image composée** — tracé à un `blit` entre
  `DEPTH_COMPONENT24` et `DEPTH_COMPONENT32F`. Non corrigé.
- **Le globe tourne tout seul** à ~1,88–2 °/s après 3 s d'inactivité
  (`main.js:466` et alentours) → **il n'y a jamais d'image « au repos »**. Google
  Earth et Cesium ne rendent PAS quand rien ne change (`requestRenderMode`).
  Ici, `grep requestRenderMode|needsRender` rend **zéro**.
- **`PLAFOND_FILE = 256`** (`globe.js:838`) et `_refusFile` **relevé à 0** : la
  contre-pression ne se déclenche jamais. **La règle sans-trou**
  (`kids.every(ready)`) charge quatre tuiles quand une suffit — Cesium l'a
  chiffrée puis abandonnée en profondeur.
- **Les tuiles hors champ ne coûtent pas des appels de dessin, elles consomment
  les places du cache** — et c'est ça qui affame le budget. Mesuré ici :
  desserrer le budget avant de réduire l'emprise = **×14 de requêtes** et un
  détail qui retombe plus bas. **Réduis d'abord ce qui entre.**
- **Le crop tourne 36 tuiles ; l'orbite en traverse 283** (z2→z13).
- **Les nuages** : +0,28 ms/image (6 grappes) ; les matières : +0,023 ms ; le
  style monde : +0,017 ms. Tous pesés à la minuterie du pilote.
- **Le voile d'accueil `.ce-hubveil` avale tous les gestes** ; **la pose de
  démarrage arrive après un vol de 8,3 s**, précédé de 5 s d'immobilité.

## COMMENT PESER — sinon tu publieras un faux chiffre, comme huit rapports avant toi

- ⛔ **`gl.finish()` mesure la soumission CPU, pas les fragments.** Réfuté ici :
  ×35 de fragments ⇒ ×0,96 de temps avec `finish`. Pour le GPU :
  **`EXT_disjoint_timer_query_webgl2`, avec un témoin de validité** — multiplier
  les fragments par 16 doit multiplier le temps (mesuré ×8,2 avec la bonne
  minuterie). Une ligne dont le témoin rend ×1,4 est **non valide** : dis-le.
- **40 rendus de chauffe jetés après chaque recompilation** (sans eux la
  première mesure vaut ×6). **Ordre des variantes tournant, différences
  appariées, médianes.**
- **Le temps d'image, pas les i/s** : 60 i/s ne dit pas si on est à 4 ms ou à
  16,4. Relève **p50 et p99**, sur **≥ 20 images consécutives** — ce dépôt a un
  cycle de période 4 documenté.
- **Machine lente = ralentissement CDP (`Emulation.setCPUThrottlingRate`)
  EN MESURANT LA CADENCE** : une tentative à ×8 n'avait rien testé. ×4 et ×6
  minimum, plus `pixelRatio` 1 et 2, plus un profil « GPU intégré » si tu peux
  en émuler un (`--use-angle=swiftshader` pour le pire cas).
- ⛔ **`requestAnimationFrame` ne se déclenche pas dans un panneau qui ne
  composite pas.** Chrome sans tête, patron `scripts/sonde-demarrage.mjs`.
- **`performance.getEntriesByType('resource')` plafonne à 250** — sous-compte de
  79 % mesuré. Compte au protocole (CDP `Network.*`).
- **Un banc différentiel ne distingue pas « rien n'a changé » de « tout est cassé
  pareil »** — lis la console à chaque recompilation de nuanceur.
- **Une sonde posée APRÈS la fonction lit un état écrasé** ; **une sonde dans
  `controls.update` lit trop tôt** pour ce qui écrit la caméra après. Au rendu.
- **Un correctif juste appliqué dans le mauvais ordre se mesure comme une
  régression** — et se fait annuler. Écris l'ordre.

## LES RÈGLES — dans ce dossier

`regle-D15.md` (la planète jamais nue), `regle-D16.md` (une seule caméra, la
vue 3/4 au bloc), `regle-D17.md` (⛔ **il n'y a pas de production**, n'écris
jamais « production inchangée » en étape de fin), `regle-D19.md` (contrôles
Google Earth), `plan-fusion.md` (état courant, 4 667 tests · 0 échec · audit
241 = 241), `lecons-campagne-R.md` (dont la rétractation finale).

**Compétence à invoquer** : `/threejs-optimisation` — écrite depuis ce dépôt.

## L'ATTENDU COMMUN

- Des chiffres **avant/après**, avec le banc décrit (machine, ralentissement,
  pixelRatio, palier, altitude, lieu). Un chiffre sans banc ne se compare à rien.
- ⚠️ **`package.json` porte une LISTE EXPLICITE de tests** — un test absent ne
  tourne jamais. `npm run audit:tests`, aucun écart. `npm test` : **base
  4 667 · 0 échec**.
- ⚠️ **Scripts d'édition en BINAIRE**, et **relis l'octet écrit**
  (`grep | cat -A`) — quatre incidents en une nuit.
- Commits sur ta branche, messages en français. Rapport `rapport-PFX.md` dans ce
  dossier, avec **« ce que j'ai cru puis réfuté »** — elle n'a jamais été vide.
- **Ne pose pas de question : mesure, tranche, corrige.**
