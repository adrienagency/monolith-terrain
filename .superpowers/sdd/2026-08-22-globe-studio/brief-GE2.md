# GE2 — L'IMPLÉMENTATION : la souris de Google Earth, dans notre globe

Arbre : `C:\Dev\wt-ge2` · branche `gestes-ge-impl`. Serveur : port **> 6800**.
**Lis d'abord `socle-ge.md`** (même dossier), puis `regle-D19.md`,
`regle-D16.md`, **`rapport-R32.md`** (la saisie de la Terre et la rotation
rigide — **ton patron**), `rapport-R35.md` (le clic et le `flyTo`) et
`rapport-R30.md` / `rapport-R33.md` (les attaquants qui ont mesuré la caméra).

## LA DEMANDE

> **Adrien :** *« Attribue à notre programme exactement les mêmes fonctions à la
> souris que celles qui sont dans Google Earth (clic droit, gauche, roulette),
> tout doit fonctionner pareil. »*

## ⚠️ TU COMMENCES PAR ÉTABLIR LA RÉFÉRENCE TOI-MÊME

Un agent de spécification travaille **en parallèle** dans `C:\Dev\wt-ge1` :
**ne lui parle pas, ne lis pas sa branche** — son barème doit rester
indépendant. **Documente donc la référence Google Earth de ton côté**, depuis
les sources officielles (aide Google Earth **Web** en priorité — c'est une page
web, comme nous ; note l'écart avec **Pro** au lieu de choisir en silence), et
**cite tes URL**.

⛔ **Si tu trouves une contradiction entre D19 et Google Earth — en particulier
« la molette zoome vers le point au CENTRE DE L'ÉCRAN » (D19) contre « vers le
curseur » (peut-être Google Earth) — NE TRANCHE PAS SEUL.** Écris-la en tête de
ton rapport, implémente **la version D19** (c'est la règle écrite d'Adrien), et
laisse le prédicat isolé sur une ligne pour qu'il puisse basculer.

## CE QUI EST DÉJÀ ACQUIS — ne le refais pas, ne le casse pas

- **Le glissé gauche est FAIT** (R32) : rotation rigide caméra + cible autour du
  **centre de la Terre**, le point saisi reste sous le curseur (**0 à 0,2 px**),
  centre de la Terre immobile (**0 px**), `|Δ ln d| = 0`. Module
  `src/monde/saisie-terre.js`. **C'est ton patron pour tout nouveau geste.**
- **La molette est FAITE** : vers le point au centre de l'écran (**≤ 1,4 px**).
- **Le clic est FAIT** (R35) : rapport de distance ≤ **1,023** entre deux images
  sur huit clics.
- **Le crop garde son pivot propre** (axe du bloc) — l'exception qu'Adrien nomme.

## CE QUI RESTE À FAIRE — le vocabulaire manquant

`src/boutons-camera.js` affirme que **`controls.enableZoom = false` partout** et
que **le bouton du milieu ne fait RIEN**. `src/gestes.js` explique pourquoi ce
n'est pas un simple `enableZoom = true`. Un `contextmenu` est capté
(`main.js:3140`). **Vérifie tout ça par la mesure avant de coder.**

À couvrir, chacun selon la référence que tu auras documentée :
**clic droit glissé (vertical ET horizontal)** · **molette enfoncée + glissé** ·
**double-clic** · **modificateurs (Ctrl / Maj / Alt)** · **le menu contextuel** ·
**l'inertie au relâchement**, si Google Earth en a une.

⚡ **L'inclinaison est le point délicat** : D16 ter dit que **la vue de trois
quarts n'arrive qu'au bloc**. Si Google Earth incline au clic droit **partout**,
tu as deux règles qui se croisent. ➡️ **Autorise l'inclinaison MANUELLE partout**
(c'est un geste explicite de l'utilisateur), et **garde D16 ter pour
l'inclinaison AUTOMATIQUE** (celle que la machine décide). Écris la distinction
dans le code, et mesure que la bascule automatique arrive toujours au bloc.

## ⛔ LA CONTRAINTE QUI TUE LES IMPLÉMENTATIONS NAÏVES

`veille-repos` surveille `|Δ ln(distance caméra→cible)|` au seuil **1e-4**, et
c'est ce signal qui arme la bascule de trois quarts. **Écrire `controls.target`
d'un coup vaut 66 × le seuil.** Le motif autorisé, et déjà éprouvé deux fois :
la **translation rigide** — caméra ET cible reçoivent le même vecteur, la
distance est invariante **par construction**, pas par réglage.

## PIÈGES — chacun a produit un faux constat ici

- **Le voile `.ce-elemwrap`** (pas `.ce-hubveil`) avale les gestes : ferme-le et
  **vérifie** que `document.elementFromPoint` rend le `CANVAS`.
- **La pose de démarrage arrive après un vol de 8,3 s.**
- **Sonde au rendu**, pas dans `controls.update`.
- **Vite doit écouter sur `--host 127.0.0.1`.**
- **Le globe tourne seul** à ~2 °/s après 3 s.
- ⛔ **Ne rends JAMAIS la main « en attendant » un banc.**

## L'ATTENDU

1. **La référence documentée** (tableau geste → action → pivot, avec URL, et
   Web/Pro distingués), et **les contradictions avec D19 signalées, non
   tranchées**.
2. **Chaque geste implémenté, mesuré avant/après**, en **pixels à l'écran** ou
   en **degrés** — jamais en unités internes.
3. **La preuve de non-régression** : D19 glissé (point saisi ≤ 0,2 px, centre
   0 px), D19 molette (≤ 1,4 px), clic ≤ 1,023, `|Δ ln d|` < 1e-4, D16 ter
   (bascule automatique au bloc seulement).
4. Tests inscrits dans `package.json` (liste explicite), `audit:tests` sans
   écart, `npm test` **≥ 4 755 · 0**.
5. ⚠️ Scripts d'édition **en binaire**, **relis l'octet écrit** (`grep | cat -A`).
   Commits en français, `rapport-GE2.md` (`git add -f`), avec **« ce que j'ai cru
   puis réfuté »**.

⚠️ **Deux autres agents travaillent sur BlueTopo** (`wt-bt1`, `wt-bt2`) : ils
touchent `bathy-sources.js`, `dem.js`, le tuileur et l'index — **pas la caméra**.
Ton terrain est `main.js` (les écouteurs), `boutons-camera.js`, `gestes.js`,
`modes.js`, `monde/saisie-terre.js`, `monde/pivot-globe.js`.

Ne pose pas de question : documente, mesure, implémente, mesure encore.
