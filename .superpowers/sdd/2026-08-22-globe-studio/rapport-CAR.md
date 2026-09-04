# CAR — LE CARTOUCHE DIT VRAI, TOUT DE SUITE, ET NE CLAQUE PLUS

**Arbre** `C:\Dev\wt-car` · branche `cartouche-vrai` · base `faf1c38` · serveur
`127.0.0.1:10711`. **`src/globe.js` n'est pas touché** (`md5 =
59c7774e8e2e31699989985e88f945af`, identique avant/après). `npm test`
**5 014 · 5 014 · 0** · `npm run audit:tests` **272 listés · 272 sur disque,
aucun écart**.

Banc : `scripts/banc-car.mjs` — le vol de VID2 (Provence `flyTo(44.3425,
5.7777, 9)`, caméra à `maxDistance`, un glissé entre chaque palier pour que le
LIEU change, deux crans par palier z10 → z13, puis 3 + 3 crans arrière), **sonde
`requestAnimationFrame` posée dans la page** : chaque image relève
`groundInfo.group.visible`, `lastInfo.coord`, `lastInfo.name`,
`params.demLat/demLon/demZoom`, `modes.busy`, et le rapport
`(échelle du groupe × 56) / largeur des parois` lu sur `globe._parois`.
Dépouillement : `scripts/analyse-car.mjs`. Journaux et captures dans
`.banc/CAR/` (ignoré par git) : `avant2/` (code d'origine), `apres/`.

---

## 0. LE VERDICT, AU CHIFFRE

| grandeur (critère du brief) | attendu | AVANT (`avant2`, sonde rAF) | APRÈS (`apres`, sonde rAF) |
|---|---|---|---|
| **délai bloc → coordonnées justes** | ≤ 1 image | z11 **5 092 ms** · z12 **3 624 ms** · z13 **3 162 ms** · WIDENING **2 420 ms** | **0 ms** partout — la coordonnée juste est là à l'image où `demLat/demLon` change |
| **ancien lieu affiché sur un nouveau bloc** | 0 image | z11 **78 img / 3 297 ms** · z12 **47 / 2 505** · z13 **70 / 1 957** · WIDENING **13 / 1 185** · Réunion à Provence **10 img / 426 ms** | **0 image**, sur 4 100 images de vol |
| **cartouche caché par cran** | 0 ms | z11 **1 797 ms** · z12 **1 111** · z13 **1 203** · WIDENING **1 812** (run 1 : 1 476 · 1 031 · 1 353 · 2 469) | **0 ms**, 0 période cachée, sur tous les crans |
| **cartouche / parois pendant WIDENING** | ≤ 1,1× dès la 1re image | **4,000** (z12 → z10), **1,994–2,000** à chaque cran | **1,000** à chaque image |
| **fragments orange** | 0, ou attribués | présents | **attribués au socle (`crop-parois`), preuve §4** |
| suite | ≥ 5 000 · 0 | 5 000 · 0 | **5 014 · 0**, audit sans écart |

Le nom du lieu, lui, arrive toujours du réseau : **3,4 à 4,6 s** après le cran
(Nominatim) — mais entre-temps le cartouche porte les coordonnées justes, la
barre d'échelle, la plage d'altitude, et **un nom vide**, jamais l'ancien.

---

## 1. N3 — LE CARTOUCHE MENTAIT : CE QUI SE PASSAIT, EXACTEMENT

VID2 avait la cause : `majCartoucheGlobe` remontre le groupe dès que `dem`
revient, `groundInfo.load` attend Nominatim + Wikipédia avant `render`. La sonde
le confirme image par image (`avant2`, cran z11) :

```
26 376 ms  REFINING z11, busy    → v=false (caché)
28 173 ms  v=true  coord=44.3425 (l'ANCIEN)  nom=Provence   ← le MNT est là, on remontre
31 470 ms  coord=44.4535 (le bon)                            ← Nominatim a répondu
```

**3,3 s d'ancien lieu sous un bloc neuf.** Et dans mon premier banc — sans
glissé — le défaut était **invisible** (0 image), parce que la caméra restait
à l'aplomb du centre et que les coordonnées ne changeaient pas d'un palier à
l'autre. Voir §6.1.

### 1.1 Le correctif : deux temps, jamais un ancien lieu

`src/ground-info.js` — **`infoImmediate({ lat, lon, extentMeters, stats })`**,
pure : coordonnées décimales et DMS, barre d'échelle si l'emprise est connue,
plage d'altitude si des stats le sont, **nom seulement si le mémo web a déjà vu
la maille de 0,01°** (`lieuConnu`), sinon vide — pas « UNCHARTED SECTOR », qui
n'a de sens qu'après avoir demandé. Champ `provisoire` pour les bancs.

`src/ground-info-layer.js` —
- **`annonce(lat, lon, { extentMeters })`** : périme toute requête en vol
  (`++reqId`), et grave immédiatement `infoImmediate`. Si les polices ne sont
  pas là (tout premier chargement), il **efface** l'ancien cartouche plutôt que
  de le laisser mentir. Même lieu déjà gravé, rien de plus à dire : ne regrave
  pas (pas de clignotement).
- **`load()`** dessine d'abord ce qu'il sait (coordonnées + altitudes du MNT
  qui vient d'arriver), PUIS attend le réseau et complète.
- `_policesPretes()` lit `document.fonts.check` — pas `load`, qui est
  asynchrone : c'est ce qui autorise un dessin dans la même image.

`src/main.js` — **`loadSurface`, ligne 7301** : `groundInfo.annonce(lat, lon,
{ extentMeters: largeurBlocEstimeeM() })` **avant** `entrerEnVol()` et avant
`fetchAndBuildDem` — c'est là que le lieu est demandé, et `loadSurface` est
le seul appelant d'`entrerEnVol`. **`largeurBlocEstimeeM()` (ligne 4529)** :
l'emprise du palier demandé par `empriseBlocMNT` + `normaliserEmprise`, sans
rien charger — la barre d'échelle est donc juste dès l'annonce.

---

## 2. N4 — LE CLAQUEMENT PAR CRAN, ET POURQUOI IL N'A PLUS DE RAISON

Le brief demandait de **mesurer d'abord pourquoi** le cartouche est caché.
Réponse, lue et mesurée : `!!dem` dans le prédicat de `majCartoucheGlobe`
(`main.js:5368` d'origine), et `groundInfo.setVisible(false)` dans
`entrerEnVol`, tous deux pour **ne pas graver le lieu qu'on quitte pendant le
vol** — c'est-à-dire pour cacher N3. La sonde chiffre le prix : `dem` reste
`null` de `entrerEnVol` jusqu'au retour du MNT, **1,1 à 1,8 s par cran**, et
le groupe est caché tout ce temps.

N3 réglé (le cartouche porte le lieu d'arrivée dès l'annonce), la raison
tombe. **`main.js:5426` `majCartoucheGlobe`** : `voulu = !!params.groundInfo
&& cartoucheAffiche()` — `dem` sort du prédicat. **`main.js:4284`
`entrerEnVol`** : l'extinction ne reste qu'hors mode sphère
(`!fusionDesPasses`), où `majCartoucheGlobe` ne gouverne pas la visibilité et
où `fetchAndBuildDem` rallume comme avant.

Mesuré après : **0 ms caché** sur les quatre crans et les deux sorties,
cartouche visible avec coordonnées justes pendant tout le REFINING.

⚠️ **Les nuages ont le même `!!dem` (`majNuagesGlobe`, `main.js:5479`) et
claquent pareil.** Pas touché — c'est `wt-nua2`. La même suppression y vaut
si le ciel n'a pas, lui, de mensonge à cacher.

---

## 3. N5 — LA TAILLE EST CELLE DES PAROIS, PAS DE L'EMPRISE DEMANDÉE

VID2 avait la cause : `largeurBlocM()` lit la fenêtre bornée, recadrée sur le
nouveau palier dès `entrerEnVol`, quand `globe._parois` garde l'ancienne
taille. Mesuré à la sonde : rapport **1,994 / 1,998 / 2,000** pendant les crans
(caché à ce moment-là en run 1 — mais VISIBLE dès que N4 est réglé, donc il
fallait le corriger avec), et **4,000 pendant 1,2 s** en WIDENING z12 → z10, où
le MNT revient du mémo avant que les parois soient reposées.

**`src/monde/cartouche-globe.js` — `poseDepuisParois({ position, quaternion,
largeur, span })`**, pure : `echelle = largeur / span`. C'est la MÊME
similitude qu'`ancrageCartouche` prise par l'autre bout — le §1 du module
l'avait mesuré à l'epsilon du double, et le test ③ le revérifie sur le relevé
de La Réunion (écart < 1e-15).

**`main.js:5394` `poseDesParois()`** lit `globe._parois` (position,
quaternion, boîte englobante × échelle — calculée **une fois par maillage**,
`poserParoisCrop` en crée un neuf à chaque pose). **`majCartoucheGlobe`** la
prend d'abord, retombe sur la loi sans parois (premières images, retour
d'orbite). **`echelleCartouche()` (ligne 5365)** aussi, donc `getBaseY`
divise `baseYCrop` par la même échelle que celle qui pose le groupe — la base
et l'échelle décrivent le même bloc.

Après : rapport **1,000** à chaque image, y compris pendant WIDENING.

---

## 4. N6 — LES FRAGMENTS ORANGE SONT LE SOCLE, ET C'EST PROUVÉ

`scripts/n6-car.mjs` : z12 au repos, 3 crans arrière, captures toutes les
100 ms, **quatre variantes** du même vol, et un zoom ×4 sur l'arête du crop
quitté (`scripts/zoom-png.mjs`, canevas 2D d'une page vierge — pas la page
WebGL, où `readPixels` rend 0).

| variante | ce qu'on change | le trait orange sur l'arête de l'ancien crop |
|---|---|---|
| `defaut` | rien | **présent** (`zoom-n6-w00-arete.png`) |
| `sansCartouche` | `params.groundInfo = false`, groupe caché | **présent, identique** (`zoom-n6-sansCartouche-w00-arete.png`) |
| `sansGrille` | `uGridOpacity = 0` | déjà **0** au dépôt (`gridOpacity: 0`, `gridColor: 242220` sombre) — la variante ne change rien |
| **`sansParois`** | `globe.setParoisVisibles(false)` | **DISPARU** (`zoom-n6-sansParois-w00-arete.png`) : arête nette, aucun orange |

➡️ **Ce n'est ni le cartouche, ni `applyGridContour`** (l'hypothèse de VID2 est
réfutée : la grille est éteinte, et sa couleur est `#242220`, pas orange). **Ce
sont les parois du crop, `crop-parois`** — leur liseré d'arête, qui reste
peint sur le rectangle du palier quitté jusqu'au retaillage. C'est `globe.js`,
donc **`wt-soc`**. Je le dis et je le laisse.

⚠️ Le comptage brut de pixels orange (41 860 → 11 en 1,2 s) est dominé par le
retour de la Terre entière autour du crop (⑥, `wt-vie`), pas par le trait :
c'est le zoom qui tranche, pas le compteur.

---

## 5. LES TESTS QUI MORDENT — `test/cartouche-vrai.test.js`, 14 tests

Inscrit dans `package.json` derrière `test/cartouche-globe.test.js` (édition
en binaire, **0 CR · 50 LF** comptés). `scripts/mutation-car.mjs` : cinq
mutations du produit en binaire (`Buffer`), motif refusé s'il apparaît 0 ou 2+
fois, restauration `finally` + md5 vérifiée :

| mutation | ce qu'elle retire | résultat |
|---|---|---|
| `sans-rendu-immediat` | le dessin de `load` avant le réseau | **✖ 1** (« dessinées AVANT que le réseau réponde ») |
| `annonce-muette` | `annonce` rend `false` sans rien faire | **✖ 3** |
| `dem-revient-au-predicat` | `!!dem` remis dans `majCartoucheGlobe` | **✖ 1** (④ N4) |
| `echelle-sur-emprise` | `echelleCartouche` ignore les parois | **✖ 1** (④ N5) |
| `parois-largeur-ignoree` | `echelle = largeur / span × 2` | **✖ 2** (③) |

Dépôt : **14 · 0**. Les empreintes des trois fichiers sont identiques avant et
après les cinq tours.

Le test ② « réseau lent » rejoue le scénario de la vidéo : cran vers A, réseau
qui traîne, cran vers B, réponse de A qui arrive après — elle doit être jetée.

---

## 6. CE QUE J'AI CRU, PUIS RÉFUTÉ

1. **« Le premier banc reproduit N3. »** Non : **0 image de mensonge** sur le
   run 1. La caméra restait à l'aplomb du centre, `demLat/demLon` ne changeaient
   pas d'un palier à l'autre, donc l'ancienne coordonnée ÉTAIT la nouvelle. Il a
   fallu le glissé de VID2 (`03-z09-incline`) entre chaque palier pour que le
   lieu bouge — *l'état dépend du chemin*, et le mien était trop propre.
2. **« Les fragments orange sont `applyGridContour` »** (hypothèse VID2). Non :
   `uGridOpacity` vaut **0** au dépôt, `uGridColor` est `#242220`. Le trait
   disparaît quand on cache les **parois**, pas quand on cache la grille ni le
   cartouche.
3. **« Je peux éditer `src/` pendant qu'un banc tourne. »** Non : Vite a
   rechargé la page à chaud, la sonde `__sondeCAR` a disparu, `journal.sonde`
   est sorti `undefined`. Un run perdu, refait sur `git stash`. **Pas une
   ligne de `src/` pendant un banc.**
4. **« Rapport 1,000 après = preuve. »** Par construction seulement : le
   cartouche est posé SUR les parois. Ce qui prouve que c'est la bonne taille,
   c'est l'identité avec la loi au repos (0,989–1,000 mesuré avant, < 1e-15 au
   test ③ sur le relevé de La Réunion).
5. **« Mon test de réseau lent bloque à cause du produit. »** Non, à cause de
   la sonde : les `fetch` partent APRÈS `document.fonts.load` (un tour de
   microtâches), et je lâchais des portes que personne n'avait encore poussées.
   *Une sonde posée avant l'événement n'observe rien.*
6. **« Le `flyTo` a 3,5 s de délai avant les coordonnées justes. »** C'est
   l'orbite : pas de crop, `cartoucheAffiche()` faux, groupe caché à raison. Ce
   qui compte est qu'à la réapparition la coordonnée soit juste — **0 image de
   Réunion à Provence** après, contre 10 images / 426 ms avant.

---

## 7. LES LIGNES DE `main.js` (fichier partagé)

| lignes | quoi |
|---|---|
| 67, 172 | imports `poseDepuisParois`, `normaliserEmprise` |
| 4272–4284 | `entrerEnVol` : extinction du cartouche seulement hors mode sphère |
| 4523–4537 | `largeurBlocEstimeeM()` |
| 5365–5415 | `echelleCartouche()` lit les parois ; `poseDesParois()` |
| 5426–5455 | `majCartoucheGlobe` : `dem` hors du prédicat, parois avant la loi |
| 7295–7301 | `loadSurface` : `groundInfo.annonce` avant le vol |

`git diff --numstat` : `main.js` **+97 −18**, `ground-info-layer.js` +66 −1,
`ground-info.js` +40, `monde/cartouche-globe.js` +29, `package.json` 1 ligne.
**`globe.js`, `modes.js`, les nuages : intacts.**

## 8. LES OUTILS

| fichier | ce qu'il fait |
|---|---|
| `scripts/banc-car.mjs` | le vol de VID2 avec sonde rAF et glissés |
| `scripts/analyse-car.mjs` | dépouille un journal : caché, mensonge, délai, rapport |
| `scripts/preuve-car.mjs` | captures toutes les 100 ms sur un REFINING et un WIDENING (`.banc/CAR/preuve-avant`, `preuve-apres`) |
| `scripts/n6-car.mjs` | les quatre variantes de N6 |
| `scripts/zoom-png.mjs` | agrandit une région d'une capture |
| `scripts/mutation-car.mjs` | la morsure, par mutation en binaire |

Captures : `.banc/CAR/apres/04-z11-00.png` (REFINING, cartouche visible et
juste), `apres/09-sortie2-01.png` (WIDENING, rapport 1), `avant2/04-z11-0*.png`
(caché), `zoom-n6-*-arete.png` (N6, les quatre variantes).
