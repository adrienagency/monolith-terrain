# SOCLE COMMUN — campagne GESTES GOOGLE EARTH (GE1 → GE3)

> **Adrien, 2026-09-03 :** *« Je voudrais que tu attribues à notre programme
> exactement les mêmes fonctions à la souris que celles qui sont dans Google
> Earth (clic droit, gauche, et roulette), tout doit fonctionner pareil. Vérifie
> les fonctions de Google Earth, et reproduis-les, puis note avec des agents pour
> vérifier si tout est ok. »*

C'est la suite directe de **D19** (`regle-D19.md`), déjà écrite :
> *« quand je déplace et fais tourner la Terre au clic, la Terre se déplace
> autour de son centre · quand je scrolle pour zoomer, je scrolle vers le point
> visé au centre de l'écran · je veux que les contrôles soient exactement les
> mêmes que pour Google Earth. »*

D19 est **déjà tenue** pour le glissé gauche et la molette (tâche R32, validée
10/10 par un attaquant indépendant : centre de la Terre à **0 px**, point saisi
sous le curseur à **0,2 px**). ⚡ **Ce qui reste, c'est le RESTE du vocabulaire :
clic droit, molette enfoncée, double-clic, modificateurs, et l'inclinaison.**

## L'ÉTAT DES LIEUX — mesuré, à vérifier

`src/boutons-camera.js` documente que **`controls.enableZoom = false` partout**
et que **le bouton du milieu ne fait donc RIEN** aujourd'hui. `src/gestes.js`
existe et explique pourquoi ce n'est pas un simple `enableZoom = true`.
Un `contextmenu` est capté (`main.js:3140`) et une chaîne
`pointerdown/move/up` sert la saisie de la Terre (`main.js:13751`).
**Vérifiez tout cela par la mesure, pas par la lecture.**

## ⛔ CE QUI NE DOIT PAS ÊTRE CASSÉ — acquis, mesuré, verrouillé par des tests

- **D19 glissé gauche** : la Terre tourne autour de **son centre**, le point
  saisi reste sous le curseur (0 à 0,2 px), le centre de la Terre ne bouge pas.
- **D19 molette** : zoom vers le **point au centre de l'écran** (≤ 1,4 px).
- **D16 ter** : la vue de trois quarts n'arrive **qu'au bloc**, jamais avant.
- **`veille-repos`** : `|Δ ln(distance caméra→cible)|` sous **1e-4** — c'est ce
  signal qui arme la bascule de trois quarts. ⛔ **Écrire `controls.target` d'un
  coup vaut 66 × le seuil.** Le motif autorisé est la **translation rigide**
  (caméra ET cible reçoivent le même vecteur) : la distance est invariante **par
  construction**.
- **Le clic sur le globe** : rapport de distance entre deux images ≤ **1,023**
  sur huit clics (tâche R35).
- La suite : `npm test` **4 755 · 0**, `audit:tests` **253 = 253**.

## LES PIÈGES QUI ONT PRODUIT DE FAUX CONSTATS ICI

- ⛔ **Le voile d'accueil avale TOUS les gestes** jusqu'au premier clic — ce
  n'est pas `.ce-hubveil` qui capte mais son frère **`.ce-elemwrap`**. Ferme-le
  **et vérifie** (`document.elementFromPoint` doit rendre le `CANVAS`).
- ⛔ **La pose de démarrage arrive après un vol de 8,3 s**, précédé de 5 s
  d'immobilité : « stable » ≠ « final ».
- ⛔ **Une sonde dans `controls.update` lit trop tôt** : `redresserSurLeSol`
  écrit `camera.position` après. **Relève au rendu.**
- ⛔ **`requestAnimationFrame` ne se déclenche pas dans un panneau qui ne
  composite pas** — Chrome sans tête, et **Vite doit écouter sur
  `--host 127.0.0.1`**, sinon `[::1]` seul et rien ne se dessine.
- **Le globe tourne seul** à ~2 °/s après 3 s : gèle-le ou soustrais-le.
- ✅ **La molette simulée MARCHE** (40/40) — l'ancien avertissement contraire est
  rétracté.
- ⛔ **Ne rends JAMAIS la main « en attendant » un banc** : attends dans la même
  exécution, sinon tu ne reprends jamais.

## RÈGLES DU DÉPÔT

`regle-D16.md`, `regle-D19.md`, `regle-D17.md` (⛔ **il n'y a pas de
production** — n'écris jamais « production inchangée » en étape de fin),
`plan-fusion.md` (état courant).
⚠️ **`package.json` porte une LISTE EXPLICITE de tests** — un test absent ne
tourne jamais. Scripts d'édition **en binaire**, et **relis l'octet écrit**
(`grep | cat -A`). Rapport `rapport-GEx.md` (`git add -f`), avec **« ce que j'ai
cru puis réfuté »** — sur ce chantier elle n'a **jamais** été vide.
