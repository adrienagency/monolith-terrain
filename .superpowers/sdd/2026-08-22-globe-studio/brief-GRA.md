# GRA — LE MÊME BLOC DOIT AVOIR LA MÊME COULEUR, QUEL QUE SOIT LE ZOOM

Arbre : `C:\Dev\wt-gra` · branche `rampe-grade`. Serveur : port **> 7600**,
`--host 127.0.0.1`. **Lis d'abord `rapport-R31.md` §⑥** (dossier sdd) — le défaut
y est mesuré et laissé ouvert exprès, avec ses chiffres. Puis `rapport-R28.md`
(la colorisation globale), `rapport-B5.md` (la bande de bruit, qui touche la même
fonction) et `regle-D15.md`.

## LE DÉFAUT — mesuré, pas supposé

**`uHeightPivot` et `uHeightContrast` sont GRADÉS sur le domaine du SOCLE**
(`terrain.mapUniforms.uHeightRange`, l'amplitude du MNT chargé, **qui suit le
zoom de la carte**) **et CONSOMMÉS sur le domaine du GLOBE**
(`[uReliefBas ; uLandMax]`, le relief de l'emprise z13 du crop, **qui ne le suit
pas**). Les deux ne coïncident qu'à z12/z13.

Écart du `hNorm` du niveau de la mer, socle contre globe, au même instant :

| | z13 | z12 | z11 | z10 | z9 |
|---|---|---|---|---|---|
| La Réunion | −0,007 | −0,181 | −0,545 | −0,778 | **−0,835** |
| Everest | −0,002 | −0,314 | −0,964 | −1,261 | **−1,271** |

⚡ **Conséquence visible sur un bloc IDENTIQUE** — le crop est toujours z13, ses
ancres n'ont pas bougé d'un octet :

| La Réunion, crop [539,6 ; 3 052,3] m | z13 | z11 | z9 |
|---|---|---|---|
| pivot rendu | 1 519 m | 1 947 m | **2 324 m** |
| fenêtre utile | 1 047 m | 866 m | **513 m** |

➡️ **Le même bloc porte trois échelles de couleur différentes selon le zoom de
la carte sous-jacente — 805 m d'écart de pivot sur un relief qui n'a pas changé.**

## CE QUI REND LA TÂCHE DÉLICATE — et pourquoi R31 ne l'a pas faite

1. ⛔ **La correction repeint le BLOC — donc l'affiche — à tous les zooms sauf
   z13.** C'est le travail de design d'Adrien. **Il l'a demandée**, donc fais-la ;
   mais **montre-lui ce que ça change** : captures avant/après, mêmes lieux,
   z13 / z11 / z9.
2. ⛔ **`uHeightPivot` est un RÉGLAGE D'ADRIEN** — le curseur « Ombrage » et
   l'auto-gradation (`applyAutoShade`, `relief-grade.js`). Le corriger ne doit ni
   figer son curseur, ni changer ce que le curseur veut dire. **Si le curseur ne
   produit plus le même effet qu'avant à z13, c'est un échec** : z13 est la
   référence, c'est là que les deux domaines coïncident déjà.
3. **`block-grid.js:1239-1242`** recopie ces deux uniformes d'un jeu à l'autre —
   vérifie que ta correction ne se fait pas écraser là.

## LA DIRECTION — à établir par la mesure, pas à recevoir de moi

Deux formes possibles, **et c'est toi qui tranches, avec le chiffre** :
- **A — grader sur le domaine où l'on consomme** : calculer le pivot et le
  contraste dans `[uReliefBas ; uLandMax]` (le domaine du globe), au lieu de les
  hériter du socle. Le plus direct ; vérifie que z13 ne bouge pas d'un pixel.
- **B — convertir à l'entrée** : garder le grade du socle et le **transposer**
  d'un domaine à l'autre, comme `intervalleCourbesBloc` et `pasGrilleBloc` le
  font déjà pour d'autres grandeurs (`habillage-crop.js`). ⚠️ **C'est la classe
  de défaut qui est revenue dix fois ici** : si tu prends B, **écris la
  conversion en commentaire, avec son facteur chiffré**, et teste-la aux deux
  bouts.

⚠️ **Le juge n'est pas la formule, c'est l'invariance** : ouvrir le même lieu
depuis z13, z11 et z9 doit donner **la même image du bloc**, aux mêmes couleurs.

## LE CRITÈRE — en pixels, sur le même bloc ouvert à trois zooms

Trois lieux d'amplitudes très différentes (**La Réunion** ~2 500 m, **l'Everest**
~8 000 m, **les Pays-Bas** ~30 m), chacun ouvert à **z13, z11 et z9** :

| grandeur | avant | attendu |
|---|---|---|
| **pivot rendu, en mètres** | 1 519 / 1 947 / 2 324 | **identique aux trois zooms**, à ≤ 2 % |
| fenêtre utile | 1 047 / 866 / 513 m | idem |
| **écart d'image entre deux zooms** (pixels, pleine résolution) | mesuré | **≤ 1 %** de pixels différant de plus de 2 niveaux/255 |
| **z13 avant/après** | — | ⛔ **identique au bit** — c'est la référence |
| le curseur « Ombrage » | mesuré | **même effet qu'avant à z13**, courbe tracée |
| `applyAutoShade` | mesuré | ne se contredit plus entre zooms |

⚠️ **Le pixel n'est déterministe qu'en orbite** : en crop, fais l'A/B **dans la
même session** (mer, nuages, caustiques déphasés — `scripts/profil-pf4.mjs
--scenario pixelab` est le patron).

## PIÈGES — chacun a produit un faux constat ici

- **Une sonde qui lit la trame COMPOSÉE** voit l'écume et le grain par-dessus :
  B5 y a perdu deux heures. **Lis au GPU**, passe brute.
- **Un condensé annule les motifs fins** — pleine résolution.
- **Le terrarium Mapterhorn est `.webp` LOSSY** : son zéro de mer ressort à
  **0 ± 0,5 m des deux côtés du signe** (B5). N'attribue pas à la rampe ce qui
  est du bruit d'encodage.
- **Le voile `.ce-elemwrap`** avale les gestes ; **la pose de démarrage arrive
  après un vol de plusieurs secondes** et tombe entre **30,7 et 33,6 km** — à
  cheval sur le seuil de naissance du crop : **attends-la**, sinon tu mesures un
  bloc qui n'existe pas encore.
- **Vite sur `--host 127.0.0.1`.**
- ⛔ **Ne rends JAMAIS la main « en attendant » un banc.**
- ⛔ **Ne tue que TES Chrome sans tête.**

## L'ATTENDU

1. **Le tableau du critère**, trois lieux × trois zooms, avant/après.
2. **La preuve que z13 n'a pas bougé d'un bit.**
3. **Des captures avant/après** pour Adrien : mêmes lieux, z13 / z11 / z9 —
   c'est son affiche, il doit voir ce qui change.
4. **La direction choisie (A ou B) justifiée par un chiffre**, et si c'est B,
   **la conversion écrite avec son facteur**.
5. **Le curseur « Ombrage » et `applyAutoShade` inchangés dans leur sens.**
6. Tests inscrits dans `package.json`, `audit:tests` sans écart,
   `npm test` ≥ **4 799 · 0**. ⚠️ Scripts **en binaire**, **relis l'octet écrit**.
7. `rapport-GRA.md` (`git add -f`), avec **« ce que j'ai cru puis réfuté »** —
   sur ce chantier elle n'a **jamais** été vide.

⚠️ **Trois autres agents tournent.** `C:\Dev\wt-cib` est dans `globe.js` mais sur
**la file et la priorité des tuiles** (`_priorite`, `_request`, `_pump`) — **toi,
la colorisation** (`natRampT`, `uHeightPivot`, `uHeightContrast`, `rampe-crop.js`,
`relief-grade.js`). Deux régions distinctes du même fichier ; **dis en tête de ton
rapport les lignes que tu touches**, je ferai la fusion à la main. `C:\Dev\wt-cr1`
(crop, `modes.js`) et `C:\Dev\wt-riv3` (rivières) ne te concernent pas.

Ne pose pas de question : mesure, tranche, corrige, mesure encore.
