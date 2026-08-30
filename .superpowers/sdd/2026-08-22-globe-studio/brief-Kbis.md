### Tâche K bis — L'ÉCHELLE DE COULEUR CONTINUE ⚠️ LE VERT, LE TURQUOISE, LE BLEU

**Fichiers :** `src/monde/rampe-crop.js`, `src/globe.js` (pose des uniformes), tests.
⛔ **Interdit : `terrain.js`, `plinth.js`, `ocean.js`.**

**Ce qu'Adrien voit**, onze captures de l'orbite à Z13 :

> « On dirait qu'il y a plein de façons de traiter l'affichage de la terre… la mer est bleu
> profond, puis clair, puis verte. On ne peut pas conserver une texture unique à tous les
> niveaux ? »

**La cause, établie dans le code :**

- La couleur vaut `t = 0.35 * (1.0 - clamp(-h / uOceanDepth, 0.0, 1.0))` sous l'eau,
  `t = 0.35 + 0.65 * clamp((h - uLandBas) / (uLandMax - uLandBas), 0.0, 1.0)` au-dessus.
- ⛔ **`uOceanDepth`, `uLandBas` et `uLandMax` sont RE-MESURÉS SUR LE CROP à chaque pose**
  (`globe.js:2089-2091`, `poserRampe` → `echelleRampe`), et **le crop rétrécit quand on
  descend**. Hors crop, `retirerRampe` rend `RAMPE_MONDE` : **0 / 5 600 / 6 000 m**
  (`rampe-crop.js:377-382`).
- **Relevés réels :** `uLandMax` **5 600 → 2 691,25 m** (Tâche K) ; `uOceanDepth`
  **6 000 → 2 106 m**, et **130 m** avant la Tâche J bis.
- ➡️ **La même profondeur physique reçoit une couleur DIFFÉRENTE à chaque altitude.** Quand
  l'échelle devient petite, tout le fond remonte vers **`t = 0,35`** — **la limite mer/terre,
  donc la PREMIÈRE TEINTE DE TERRE : le vert.**
- ⚠️ **Et un second mécanisme, relevé par la Tâche K : `h == 0` prend la branche TERRE.**
  C'est **le grand aplat vert** qu'Adrien voit au nadir. **À traiter ici.**

## ⚠️ LA SORTIE N'EST NI L'UNE NI L'AUTRE — LIS CECI AVANT DE CODER

**Revenir à l'échelle mondiale figée serait une régression connue.** La Tâche C l'a mesurée
et Adrien l'a rejetée en ces termes : le crop rendait **« une masse plate et orange »**,
parce que La Réunion n'occupe que **163 texels sur 512** d'une rampe calibrée sur 5 600 m.
La rampe locale en occupe **368 — ×2,26**. **C'est ce gain qu'il ne faut pas perdre.**

**Ce qu'on attend : une échelle qui varie CONTINÛMENT et LENTEMENT avec l'altitude**, jamais
re-mesurée par saut à chaque pose. Le patron existe dans ce dépôt :
**`src/monde/exageration-continue.js`** — une courbe monotone Fritsch-Carlson entre des
ancres, **un écrivain, N lecteurs**, et **ce module n'importe RIEN** (règle gardée par un
test). **Lis-le avant de concevoir.**

⚠️ **Le critère d'Adrien, et il est dur :** *la même profondeur physique doit rendre la même
couleur à toutes les altitudes.* Une échelle qui glisse ne le tient pas exactement — **dis
quel écart résiduel tu acceptes, mesure-le, et ne prétends pas qu'il est nul.**

- [ ] **Étape 1 — la mesure AVANT.** Le même point de mer, à cinq altitudes de l'orbite au
      sol : relève **la couleur rendue** et l'écart maximal. **C'est ton témoin.**
- [ ] **Étape 2** — test rouge.
- [ ] **Étape 3 — implémenter.** ⚠️ **`h == 0` ne doit plus prendre la branche terre.**
- [ ] **Étape 4** — mutation sémantique, worktree à part, **banc dans `.banc/`**.
- [ ] **Étape 5 — REGARDER L'ÉCRAN**, la même descente qu'Adrien : ORB, Z4, Z6, Z9, Z11, Z13.
      **Captures dans `.banc/vues-Kbis/`.**
- [ ] **Étape 6** — clôture, page chargée drapeau levé ET baissé.

⚠️ **CE QUE TU NE FERMES PAS, et que tu ne dois pas prétendre fermer :** la mer autour du
bloc reste **un patchwork de plaques droites** — c'est la dégradation **per-sommet** par
distance caméra (`globe.js:148-157`), **hors de ton périmètre**. **Ton banc doit la
DISTINGUER de ce que tu changes, sinon il te mentira.**
