# R37 — LE FLOU DE ZOOM : dessiner les enfants prêts, pas attendre les quatre

Arbre : `C:\Dev\wt-raf` · branche `raffinement-partiel`. Serveur : port **> 6900**,
`--host 127.0.0.1`. **Lis d'abord** `plan-fusion.md` (état courant), `socle-perf.md`
(comment peser, les pièges), `rapport-PF1.md` §② (le profil : l'image est bornée
par le CPU) et `rapport-PF2.md` (la file de priorité, le cache souple, ce que
`_traverse` fait déjà).

## LA DEMANDE — Adrien, vidéo à l'appui

> *« Lors des zooms, je vois les zones déjà chargées qui redeviennent floues puis
> se remettent en haute définition à chaque niveau de transition. Pourquoi ne pas
> simplement garder la zone déjà chargée en bonne définition en attendant de
> mettre la zone plus HD ? Ça éviterait ce vilain flou de chargement. C'est
> faisable ? »*

Sa vidéo (`C:\Users\adrie\AppData\Local\Temp\claude\G--My-Drive--GITHUB\ed4e3ecd-eb07-4312-a4ba-d4e3ef43c3f0\scratchpad\vid33\k001.jpg` → `k040.jpg`,
deux images par seconde) : image 14 nette, **image 16 franchement floue** avec le
message « niveau de détail », image 20 nette à nouveau. Le cycle se répète à
chaque niveau.

## LE MÉCANISME — `src/globe.js` ~8746, la règle sans-trou

```js
let pretes = true
for (const k of kids) {
  if (!this._dansLeChamp(k, camDir)) continue
  k.lastUsed = this.frame
  if (k.state === 'empty') this._request(k)
  if (k.state !== 'ready' || !k.mesh) pretes = false
}
if (pretes) { t.refined = true; for (const k of kids) this._traverse(k, …); return }
t.refined = false   // → le PARENT couvre tout le quadrant
```

**Tout ou rien** : un seul enfant manquant sur quatre garde tout le quadrant en
grossier. Et **la nuance qui change la solution** : Adrien dit « garder la zone
déjà chargée » — c'est ce que le code fait, il garde le parent ; mais **le
parent EST la version grossière**, et en zoomant on l'étire sur deux fois plus
de pixels. Il n'y a pas de « bonne définition » à conserver à cet instant.

## LES QUATRE LEVIERS, par ordre de valeur — à mesurer, pas à supposer

1. **Le raffinement PARTIEL** — le vrai levier. Dessiner **les enfants prêts**,
   garder le parent **seulement sous les manquants**. Le flou passe de « tout le
   quadrant pendant toute l'attente » à « le quart qui manque, le temps qu'il
   arrive ». C'est ce que fait Cesium, qui a abandonné la règle sans-trou
   stricte en profondeur pour cette raison exacte ; PF2 le notait déjà :
   *« quatre tuiles chargées quand une suffit »*.
   ⚠️ **Le risque, et c'est pour ça que la règle existe : la couture** entre un
   enfant fin et le parent grossier à côté. Mesure-la en pixels (différence sur
   l'arête entre les deux) avant et après ; si elle se voit, il faut que le
   parent ne soit dessiné que **sous** l'enfant manquant (masque par quadrant,
   ou le parent en entier avec les enfants prêts **par-dessus** en profondeur).
2. **La prélecture un niveau à l'avance** : pendant un zoom, la direction est
   connue ; demander les enfants **avant** de franchir le seuil, pour qu'ils
   soient souvent déjà là. ⚠️ Ça touche à la file de PF2 (priorité, purge des
   hors-champ) : **réutilise ses clés de priorité**, n'en invente pas.
3. **Ne jamais évincer une tuile dont le parent est dessiné**, et ne pas
   annuler en vol les enfants du centre de l'écran (R26 : `demanderEmprise →
   _annuler` annule en plein vol). Si une zone déjà nette **redevient** floue
   sans que l'utilisateur n'ait rezoomé, c'est ça — un défaut distinct du
   premier. **Établis lequel des deux Adrien voit**, image par image sur sa vidéo.
4. **Un fondu parent → enfant** au lieu du remplacement sec. Cosmétique ; en
   dernier, et seulement s'il ne coûte rien.

## ⛔ CE QUI VERROUILLE L'ÉTAT ACTUEL — à réécrire, pas à contourner

`test/veille-repos.test.js` ⑦ : *« le crop doit être dessiné par EXACTEMENT les
mêmes tuiles avec et sans le drapeau »*. Et le commentaire du code : *« ce qui
garde réellement l'absence de trou est l'assertion d'ensemble »*. **Un
raffinement partiel change l'ensemble dessiné par construction** — le test
tombera, et c'est normal ; il doit être réécrit pour garder ce qu'il garde
vraiment (**aucun pixel de trou**), pas la liste des tuiles.

## LE CRITÈRE — celui d'Adrien, en pixels

- **La durée et la surface du flou** pendant une descente scriptée de z8 à z13
  sur un lieu de sa vidéo : pour chaque image, la fraction de l'écran couverte
  par un parent étiré (≥ 2× sa résolution native). Avant / après, **p50 et max**.
- **Aucun trou** : zéro pixel non couvert, sur toute la descente.
- **La couture** : différence sur les arêtes enfant/parent, en niveaux sur 255.
- **Le coût** : `_traverse` p50/p99 (PF1 : 5–7 % de l'image ; PF2 : 1,1/3,6 ms
  à ×4), appels de dessin, requêtes par descente (PF2 : 594) — **aucune
  régression**, et surtout **pas de ×14 de requêtes** (l'ordre des correctifs :
  réduis d'abord ce qui entre).
- **Le repos** : `veille-repos` ne doit rien voir (`|Δ ln d|` < 1e-4), D16 ter
  tient — un raffinement n'écrit pas la caméra, vérifie que le tien non plus.

## PIÈGES — chacun a produit un faux constat ici

- **Le pixel n'est déterministe qu'en orbite** ; en surface/crop, A/B **dans la
  même session** (mer, nuages, caustiques déphasés).
- **Un relevé sur UNE image ne prouve rien** : ce dépôt a un cycle de période 4
  documenté. 20 images consécutives, stabilité exigée.
- **Une sonde après la fonction lit un état écrasé** — instrumente **dans**
  `_traverse`, au moment de la décision.
- **Le voile `.ce-elemwrap` avale les gestes** ; la pose de démarrage arrive
  après un vol de 8,3 s ; le globe tourne seul à ~2 °/s.
- ✅ La molette simulée marche (40/40).
- ⛔ **Ne rends JAMAIS la main « en attendant » un banc.**

## PÉRIMÈTRES — trois autres agents tournent

- **B5** (`wt-bat3`) : le nuanceur de `globe.js` côté `sousEau` (~1900) et le
  tuileur bathy. **Toi : `_traverse`, le raffinement, la file d'attente des
  enfants (~8700–8800), et `veille-repos.test.js`.** Deux régions distinctes du
  même fichier — ne touche pas au nuanceur.
- **BT-I** (`wt-bt2`) : tuileur, `dem.js`, `bathy-sources.js`, index — pas toi.
- **GE2** (`wt-ge2`) : la caméra (`modes.js`, `main.js` écouteurs) — pas toi.

## L'ATTENDU

1. **Le diagnostic image par image de la vidéo** : lequel des deux défauts
   (parent étiré, ou éviction d'une zone nette) Adrien voit-il, et dans quelle
   proportion.
2. **Le raffinement partiel livré**, avec la mesure de flou avant/après (p50,
   max, surface), **zéro trou**, la couture chiffrée.
3. **La prélecture** si elle apporte quelque chose de mesuré — sinon dis-le.
4. **Le coût** : `_traverse`, appels de dessin, requêtes — aucune régression.
5. `veille-repos.test.js` ⑦ **réécrit et nommé** ; des tests qui échouent sans
   le correctif ; liste explicite de `package.json` ; `audit:tests` sans écart ;
   `npm test` **≥ 4 755 · 0**.
6. `rapport-R37.md` (`git add -f`), avec **« ce que j'ai cru puis réfuté »**.

Ne pose pas de question : mesure, tranche, corrige, mesure encore.
