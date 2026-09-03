# SOCLE COMMUN — campagne BATHYMÉTRIE (B1→B4)

> **Adrien, 2026-09-03 :** *« Il faut faire un contrôle complet de la
> bathymétrie qui semble en erreur depuis le passage au mode sphère. Fais en
> sorte que toute la zone sous-marine soit le plus juste possible. Si tu peux,
> ajoute une source de bathymétrie des lacs (fonds des lacs) si ça n'implique
> pas de refondre totalement le relief des tuiles existantes. Tu as les mains
> libres. Note minimale 7,5 / 10. »*

## ⚡ CE QUI EST DÉJÀ ÉTABLI — structurel, vérifié par lecture

Le dépôt a **une vraie cascade de sources bathymétriques**, écrite et
documentée : `src/bathy-sources.js` (GEBCO_2026 socle mondial z8 ≈ 464 m,
**EMODnet z10 ≈ 115 m**, **BlueTopo z12 ≈ 2–16 m**, Copernicus côtier), un index
pré-calculé `public/data/bathy/index.json`, `normalizeIndex` / `tileMaxZoom`, et
`fuseBathymetry` dans `src/bathy.js` qui fusionne le terrarium et le fond.

⛔ **MAIS `src/globe.js` ne l'appelle JAMAIS.** Il charge ses tuiles par
`dem-source.js` (URL terrarium/Mapterhorn brutes) et n'importe de `bathy.js`
que `overzoomTile`. `fuseBathymetry`, `loadBathyPatch`, `normalizeIndex` et
`tileMaxZoom` ne vivent que dans `src/dem.js` — consommé par `block-grid.js`,
`terrain.js`, `main.js` et `monde/flux-terrain.js`, c'est-à-dire **le chemin du
BLOC PLAT**.

➡️ **Hypothèse de tête, à confirmer ou réfuter par la mesure** : depuis que la
sphère est le mode par défaut, l'océan affiché est du **terrarium brut**, sans
aucune des quatre sources. C'est exactement « en erreur depuis le passage au
mode sphère ».

⚠️ **Ce n'est qu'une hypothèse.** Sur ce chantier, l'exécutant qui mesurait a eu
raison contre le coordinateur **vingt fois sur vingt**. Si la mesure dit autre
chose, **c'est la mesure qui a raison** — dis-le en premier, avec le chiffre.

## AUTRES FAITS UTILES, déjà mesurés dans la campagne

- **Mapterhorn rend 404 sur des tuiles d'océan** (couverture creuse, normal) ;
  le repli AWS terrarium répond 200 partout. Ce que le terrarium met dans
  l'océan est à établir, pas à supposer.
- `bathy.js` : *« nos tuiles bathymétriques s'arrêtent à z8 — c'est la
  résolution native de GEBCO »*, au-delà `overzoomTile`.
- **R18** a travaillé le fond marin (peigne 0,3219 / 0,5494 → 0,0198 / 0,0032).
  **R28** a rendu **global le budget du fond marin** (113,3 m sur tout l'océan =
  371 592 px, 24,77/255). **R31** a recollé les échelles de rampe entre 2 048 et
  32 768 m. Lis `rapport-R18.md`, `rapport-R28.md`, `rapport-R31.md`.
- **R36 vient de corriger une texture d'altitude retournée en latitude**
  (`Texture.flipY` ignoré sur `ImageBitmap`) : toute mesure de fond antérieure au
  3 septembre ~07 h est suspecte. **Repars de l'état courant.**
- La rampe : `RAMPE_MONDE.profondeur`, `uOceanDepth`, et
  `echelleRampe` (`rampe-crop.js`) qui rend `0,35 × (1 − clamp01(−hM / profondeur))`
  — la mer occupe le bas de la table `uRamp` dans [0 ; 0,35].

## LA VÉRITÉ TERRAIN — sers-t'en, et cite ta source pour chaque point

| lieu | profondeur de référence |
|---|---|
| Fosse des Mariannes (Challenger) | **−10 935 m** |
| Fosse de Porto Rico | −8 376 m |
| Fosse de la Sonde (Java) | −7 290 m |
| Plaine abyssale (Atlantique central) | −5 000 à −5 500 m |
| Dorsale médio-atlantique (crête) | −2 500 à −3 000 m |
| Plateau continental (Manche) | −40 à −120 m |
| Méditerranée, plaine ionienne | −4 000 à −5 100 m |
| Mer Noire | −2 212 m |
| **Lac Baïkal** | **−1 642 m** |
| Lac Tanganyika | −1 470 m |
| Mer Caspienne | −1 025 m |
| Crater Lake (Oregon) | −594 m |
| Lac Supérieur | −406 m |
| Léman | −310 m |

⚠️ **Vérifie chaque référence** plutôt que de me croire : je les cite de mémoire.

## COMMENT MESURER — sinon tu publieras un faux constat

- **Lis la hauteur telle que le GPU la tient**, pas telle que le code la calcule :
  R36 a démasqué une texture retournée en attachant la texture GL à un tampon et
  en faisant `readPixels` (`scripts/sonde-r36.mjs` — **reprends ce patron**).
- ⛔ **`gl.getError()` peut rendre 0 sur un défaut majeur** (le `flipY` ignoré).
  Une console propre ne prouve rien.
- **Le pixel n'est déterministe qu'en orbite** ; ailleurs A/B **dans la même
  session** (mer, nuages, caustiques déphasés).
- **Vite doit écouter sur `--host 127.0.0.1`**, sinon `[::1]` seul et la sonde
  ne dessine jamais.
- **Le voile d'accueil `.ce-hubveil` / `.ce-elemwrap` avale les gestes** ;
  la pose de démarrage arrive **après un vol de 8,3 s** ; le globe tourne seul à
  ~2 °/s ; une sonde dans `controls.update` lit trop tôt (relève au rendu).
- **Un banc différentiel ne distingue pas « rien n'a changé » de « tout est
  cassé pareil »** — lis la console à chaque recompilation de nuanceur.
- ⛔ **Ne rends JAMAIS la main « en attendant » un banc** : attends dans la même
  exécution, sinon tu ne reprends jamais.

## RÈGLES DU DÉPÔT

`regle-D15.md` (la planète jamais nue, et le départage de ce qui **ne peut pas**
devenir global : les masques cuits sur l'emprise du crop ne couvrent pas la
planète) · `regle-D17.md` (⛔ **il n'y a pas de production** — n'écris jamais
« production inchangée » en étape de fin) · `regle-D19.md` (contrôles Google
Earth) · `plan-fusion.md` (état courant).

⚠️ **`package.json` porte une LISTE EXPLICITE de tests** — un test absent ne
tourne jamais. `npm run audit:tests`, aucun écart. `npm test` : base
**4 748 · 0 échec**. Scripts d'édition **en binaire**, et **relis l'octet écrit**
(`grep | cat -A`) : quatre incidents en une nuit.

Rapport `rapport-BX.md` (`git add -f`), avec **« ce que j'ai cru puis réfuté »** —
sur ce chantier elle n'a **jamais** été vide.
