# SUR — « la surcouche colorée qui recouvre la belle carte »

Branche `surcouche-couleur`, arbre `C:\Dev\wt-sur`, serveur Vite `127.0.0.1:9833`.
Aucune ligne de `src/` modifiée (`git diff -- src/` vide). `npm test` : **4 982 · 0**.
`npm run audit:tests` : *aucun écart*.

---

## LA RÉPONSE À ADRIEN, EN FRANÇAIS SIMPLE

**Ce n'est pas une couche en plus, et ce n'est pas une carte moins définie.
C'est la RAMPE DE COULEUR D'ALTITUDE — le réglage « Teinte hypsométrique » de
Terrain → Ombrage — qui se RE-NORMALISE sur le nouveau bloc à chaque cran
d'échelle.**

Le relief affiché, lui, ne perd RIEN : il gagne. Mesuré, même lieu, neuf crans
(`.banc/SUR/finesse.json`) :

| cran | m par texel du MNT | amplitude d'altitude du bloc | contraste | pivot |
|---|---|---|---|---|
| 0–2 | **26,5** | 692 – 4 622 m → **3 930 m** | 2,4 | 0,48 |
| 3–4 | **13,3** | 1 124 – 4 629 m → 3 505 m | 2,2 | 0,49 |
| 5–6 | **6,6** | 1 985 – 4 224 m → 2 239 m | 2,2 | 0,47 |
| 7–8 | **3,3** | 2 318 – 3 568 m → 1 250 m | 1,9 | 0,54 |
| 9 | **1,7** | 2 461 – 3 260 m → **799 m** | 2,1 | 0,35 |

La définition est **multipliée par 15,6** (26,5 → 1,7 m/texel) pendant que
l'amplitude d'altitude sur laquelle la rampe s'étale est **divisée par 4,9**
(3 930 → 799 m). Le nuanceur écrit (`src/terrain.js:1009`) :

```glsl
float hNorm = clamp((vWorldPos.y - uHeightRange.x) / max(uHeightRange.y - uHeightRange.x, 1e-4), 0.0, 1.0);
```

et `uHeightRange` est ré-écrit avec le min/max du **bloc courant** à chaque
reconstruction (`terrain.js:2047, 2605, 2792, 2908`). Conséquence : les huit
teintes de la rampe, qui couvraient 3 930 m de dénivelé, se retrouvent tassées
sur 799 m. **La couleur sature, elle inonde tout, et c'est elle qui donne
l'impression d'une carte plus grossière — alors que l'ombrage dessous est cinq
fois plus fin qu'avant.**

Par-dessus ça, `applyAutoShade` (`src/main.js:7620`, règle dans
`src/relief-grade.js`) recalcule contraste et pivot à chaque chargement de
relief. Il y a **un temps de retard mesuré (~300 ms)** : le nouveau bloc est
déjà à l'écran, encore habillé de l'ancienne rampe. C'est le voile franc qu'on
voit passer — `.banc/SUR-SHOT/c7.1.png`, où toute la montagne vire au **vert
uni** l'instant d'un rafraîchissement, avec le cartouche `REFINING … Z14`,
avant de revenir en `c7.2` sur la famille beige/mauve.

---

## PEUT-ON LA RETIRER ? OUI — ET LE RÉGLAGE EXISTE DÉJÀ

⚡ **La réponse est un curseur déjà en place, pas un correctif.**

> **Panneau Terrain → section « Ombrage » → curseur « Teinte hypsométrique »,
> mis à 0.**

C'est `params.mapTint` → uniforme `uTint` (`create-panel.js:536`). À 0, toute la
couleur d'altitude disparaît et il ne reste que l'ombrage — **la belle carte
nette d'Adrien, au pixel près**.

Deux précisions qui comptent :

- Bouger ce curseur **fige ce seul réglage** ; les trois autres continuent de
  suivre le relief (`markShadeDirty`, `main.js:7634`). Le curseur ne sera donc
  plus jamais réécrit au changement d'échelle. C'est exactement le comportement
  voulu ici.
- Le toggle **« Ombrage auto »** juste au-dessus fige les quatre réglages, mais
  **il ne suffit PAS** : il ne touche pas à `uHeightRange`, qui est la vraie
  cause de la bascule de teinte. Éteindre l'auto stabilise le contraste et le
  pivot, pas la re-normalisation. Mesuré, pas déduit.

---

## LA PREUVE — LES CANDIDATS ÉTEINTS UN PAR UN

A/B **dans la même session**, pose figée, Alpes suisses `46,0122 / 7,8223`,
sept crans plus bas (bloc 2 318–3 568 m, 3,3 m/texel), `.banc/SUR-ETEINDRE/` :

| capture | ce qu'on éteint | résultat |
|---|---|---|
| `A-tel-quel.png` | rien | voile coloré vert/mauve sur tout le versant |
| `B-teinte-hypso-0.png` | **`uTint` = 0** | ⚡ **le voile disparaît entièrement.** Ombrage gris, détail fin intact, identique au A trait pour trait |
| `C-retour.png` | on remet `uTint` | le voile revient |
| `D-mode-classique.png` | `colorMode` → `classic` | le voile **reste** : ce n'est pas le mode Atlas |
| `E-teinte-0-classique.png` | `uTint` = 0 en Classique | le voile disparaît de nouveau |

Second jeu, `.banc/SUR-AB/`, à 18 km d'altitude, vue d'ensemble du bloc :
`A-tel-quel.png` (bloc rose-ocre) contre `B-uTint-0.png` (bloc gris-bleu, roche
nue). **Le seul et unique responsable est `uTint`.**

Le suivi image par image du franchissement est dans `.banc/SUR-CRAN/suite.json`
et `.banc/SUR-SHOT/` (une capture par échantillon, 300 ms) : `c6.9` → `c7.1` →
`c7.4` montre la séquence complète beige fin → vert uni → beige saturé.

**Candidats explicitement réfutés par la mesure :**

- `aerial-layer.js` — `params.aerialEnabled` vaut **`false`** dans la session
  filmée (`.banc/SUR-ETEINDRE/etat.json`). La couche n'était même pas allumée.
- `occupation-sol-layer.js`, `canopee-layer.js`, `nuit-layer.js` — aucune
  n'apparaît dans les paramètres actifs autrement qu'à l'état de constantes de
  réglage ; éteindre `uTint` suffit à tout faire disparaître, donc rien d'autre
  ne peint.
- Les tuiles cuites (`public/data/map`) et le terrarium : le MNT est un
  1 536 × 1 536 à chaque palier, il ne se dégrade jamais.

---

## CE QUE J'AI CRU, PUIS RÉFUTÉ

1. **« Ce n'est pas une couche en plus, c'est la même surface à une autre
   finesse — un palier grossier peint puis affiné. »** (l'hypothèse du brief, que
   je partageais). **FAUX au sens propre** : la finesse ne redescend JAMAIS.
   26,5 → 13,3 → 6,6 → 3,3 → 1,7 m/texel, monotone. Ce qui redescend, c'est
   l'AMPLITUDE d'altitude du bloc, et c'est elle qui écrase la rampe. La phrase
   juste n'est pas « on redescend en finesse », c'est « on ré-étale les mêmes
   huit couleurs sur cinq fois moins de dénivelé ».

2. **Le relevé à l'œil sur `h_014` / `h_016` / `h_018`.** ⛔ Corrigé : `h_018`
   n'est pas « fin et gris-beige », il est **franchement violacé**, autant que
   `h_016`. Sur la série 014→018 la caméra descend en continu et la teinte
   monte progressivement — il n'y a pas de bascule là. **La vraie bascule est
   entre `h_028` (gris-beige net, propre) et `h_030` / `h_031` (plaques
   rose-rouge molles), puis retour au propre en `h_036`, au passage Z13 → Z14.**
   C'est cette paire-là qui portait le phénomène.

3. **« C'est le mode Atlas (`colorMode: natural`) qui salit. »** Réfuté :
   `D-mode-classique.png`. Le voile survit au retour en Classique.

4. **« Le toggle Ombrage auto suffira. »** Réfuté par lecture confirmée à la
   mesure : `uHeightRange` n'est pas dans les quatre réglages que l'auto pilote.

5. **Deux pièges d'instrumentation payés ici, notés pour le suivant :**
   - `readPixels` sur le tampon par défaut et `drawImage` depuis le canvas WebGL
     rendent **0 partout** dans ce dépôt (rendu via composer, pas de
     `preserveDrawingBuffer`). Le chiffre « chroma 0 » de mes deux premières
     sondes est un artefact, pas une mesure. **La capture d'écran est la seule
     lecture fiable du pixel ici.**
   - `page.mouse.wheel` ne bouge **rien** : 14 crans, altitude inchangée au
     mètre (18 737 m). C'est le voile `.ce-elemwrap` qui avale le geste.
     `modes.cranZoom(1)` marche, lui — et il faut ~3 crans pour franchir un
     niveau (le budget `_levelZoom`).

---

## COÛT ET RISQUE DE LA RECOMMANDATION

Ce que la teinte **apporte** quand elle est là : la lecture d'altitude à petite
échelle (on voit d'un coup d'œil ce qui est haut et ce qui est bas), les
couleurs de terrain des planches, et tout le caractère « affiche » du produit.
La retirer donne une carte de relief **grise**, très lisible en détail mais
muette sur l'altitude — et **tous les templates de la boutique perdent leur
identité**, puisqu'ils sont d'abord des rampes de couleur.

Son coût technique est **nul** : `uTint` est un `float` uniforme. Zéro tuile,
zéro octet réseau, zéro milliseconde. Il n'y a rien à économiser en la coupant,
et rien à payer pour la garder.

**Recommandation, à trancher par Adrien — je n'applique rien :**

1. **Immédiat, zéro risque, zéro code** : baisser « Teinte hypsométrique » vers
   **0,25–0,35** (au lieu de 0,68) aux zooms fins. La couleur reste, l'ombrage
   reprend la main. Un simple mouvement de curseur, qui se fige de lui-même.
2. **Si Adrien veut que ça se règle tout seul** : la piste n'est PAS de retirer
   une couche, c'est de **cesser de re-normaliser la rampe sur le bloc** —
   garder `uHeightRange` sur une amplitude *géographique* stable pendant une
   descente, comme le globe garde son `uLandMax = 5600 m` fixe. C'est un
   changement de rendu réel (couleurs stables d'un cran à l'autre, plaines
   voisines plus ternes) et il touche `terrain.js` en quatre points ; à chiffrer
   sur un chantier à part, avec la contrainte de `rampe-crop.js` (décision 4 du
   2026-08-21 : « la rampe se calcule SUR LE CROP »), qui dit l'inverse et qu'il
   faudrait rouvrir.
3. **Petit gain gratuit au passage** : le décalage de ~300 ms entre le nouveau
   bloc et son grade est un vrai clignotement (`c7.1`, le vert). Poser
   `applyAutoShade` dans le même tour que la pose du MNT le supprimerait sans
   rien changer d'autre. À décider séparément.

---

## FICHIERS

- Sondes (non commitées dans `src/`) : `scripts/sonde-sur.mjs`,
  `sonde-sur-ab.mjs`, `sonde-sur-cran.mjs`, `sonde-sur-eteindre.mjs`,
  `sonde-sur-finesse.mjs`.
- Mesures et captures : `.banc/SUR/finesse.json`, `.banc/SUR-AB/`,
  `.banc/SUR-CRAN/suite.json`, `.banc/SUR-SHOT/`, `.banc/SUR-ETEINDRE/`.
