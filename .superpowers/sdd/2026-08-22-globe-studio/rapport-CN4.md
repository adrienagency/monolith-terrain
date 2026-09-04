# CN4 — LE CARTOUCHE RÉPARÉ, ET LA GARDE ③ QUI MORD ENFIN

**Branche `crop-net-cartouche`, arbre `C:\Dev\wt-cn4`.**

⚠️ **`src/main.js` N'EST PAS TOUCHÉ.** `git diff --stat -- src/main.js` est vide :
aucune ligne à fusionner à la main avec `wt-porte`. Le seul fichier de produit
modifié est **`src/ui/create-panel.js`** (une seule fonction,
`contributeTerrainSections`, lignes 703-755), plus une entrée dans
`package.json`.

---

## 0. LE VERDICT, EN HAUT

| ce qui était refusé | état | la preuve |
|---|---|---|
| ⛔ **le cartouche ment à l'écran** | ✅ **RÉPARÉ** | **0 écart sur 3 413 images**, 4 lieux × 4 altitudes, relevé sur le `textContent` du DOM — contre **378 écarts sur 727** sur le même banc, même session, code d'avant |
| ⛔ **la garde ③ ne mord pas** | ✅ **ELLE MORD** | `palier-mort` (la mutation du noteur, mot pour mot) fait rougir le nouveau banc : **159 images sur 160 portent deux finesses** ; `md5(src/globe.js)` identique avant et après |
| ⛔ **le moteur ne doit pas bouger** | ✅ | `md5(src/globe.js) = b71b597466e4a3e42760ae8e3a97336f` — **la valeur exacte que CN3 a inscrite en bas de son rapport** |
| les cinq autres tests inchangés à l'octet | ✅ | `md5(test/crop-nettete-ecran.test.js) = 4b71c1aaaff9fe3acf0ed3d4197d45d2` — **le fichier entier n'a pas été ouvert en écriture** |
| suite | ✅ | `npm test` **4 938 · 4 938 · 0** (4 935 + les 3 nouveaux) · `npm run audit:tests` **267 listés · 267 sur disque, aucun écart** |

⚡ **Et j'ai trouvé une SECONDE faute de cartouche que personne n'avait vue** —
une SUR-promesse d'un niveau, là où la donnée s'arrête sous le socle. §2.3.

---

## 1. ① LE CARTOUCHE — CE QUI N'ALLAIT PAS, EXACTEMENT

### 1.1 Le noteur avait raison sur le fait, pas tout à fait sur la cause

CN3 §8 écrit : *« la liaison ne dépend que du sélecteur de zoom et n'est jamais
relancée »*, et propose *« une ligne de réactivité »*.

**Le fait est exact ; la cause est ailleurs, et je l'ai vérifiée dans
`src/ui/kit.js`.** Le second argument d'`onRefresh(fn, el)` n'est **pas une
dépendance** : c'est l'élément qui sert à **purger** l'entrée quand elle quitte
le document (`refreshables.delete(entry)`). Le libellé n'était donc pas
« abonné au sélecteur » — il était abonné à **`refreshAll()`**, c'est-à-dire à
*n'importe quel* geste d'interface.

⚡ **Et c'est ce qui rend le défaut INTERMITTENT — voilà pourquoi mes chiffres
d'avant ne recopient pas ceux du noteur.** Le cartouche affichait la dernière
valeur vue au dernier `refreshAll()`, d'où qu'il vienne. Mon A/B sur le code
d'avant rend :

| altitude (Majorque, `demZoom` 15) | dessiné | annoncé | images en écart |
|---|---|---|---|
| 5 002 m | z13 | z13 | 0 / 228 ✔ |
| 1 995 m | **z14** | ⛔ **z13** | **151 / 151** |
| 900 m | z15 | z15 | 0 / 121 *(un `refreshAll` était passé)* |
| 300 m | **z16** | ⛔ **z15** | **227 / 227**, et *« plafond »* jamais dit |

**378 écarts sur 727 images.** Le noteur relevait z13 à 900 m et à 300 m ; je
relève z13 à 2 000 m et z15 à 300 m. **Les deux relevés sont vrais** : la valeur
figée dépend du dernier geste, pas de l'altitude. *L'ampleur du défaut n'est pas
reproductible ; sa nature l'est* — la même phrase que CN3 a écrite pour les
chiffres d'avant du §2, appliquée ici.

⛔ **Conséquence pratique : « une ligne de réactivité » n'aurait rien réparé.**
Rebrancher le libellé sur un `refreshAll()` supplémentaire ne sert à rien —
**rien n'appelle `refreshAll()` pendant un vol**. Il fallait une source de
rythme, et la seule qui suive la surface est **l'image**.

### 1.2 Le correctif

`src/ui/create-panel.js`, `contributeTerrainSections` :

1. le corps du `onRefresh` devient une fonction nommée, `majLibelleZoom()` ;
2. elle est appelée par `onRefresh` **et** par une boucle `requestAnimationFrame` ;
3. **elle n'écrit dans le DOM que si le texte change** (`if (lab.textContent !==
   texte)`) : une comparaison de chaîne par image, **zéro reflow** tant que la
   finesse est stable ;
4. la boucle **s'arrête d'elle-même** quand le sélecteur quitte le document —
   même règle de purge que `refreshAll` : on n'abandonne qu'un élément qui a été
   monté **puis** détaché, jamais un élément pas encore inséré.

### 1.3 ⚡ LA FAUTE SYMÉTRIQUE, TROUVÉE PAR LA MESURE

Le brief avertissait : *« annoncer une finesse que la région ne peut pas fournir
serait la même faute dans l'autre sens »*. **Elle existait, et le correctif de
la réactivité seul ne la corrigeait pas.**

Relevé au centre de l'Australie (−23,70 / 133,88), bloc à z15 :

```
getDemMaxZoom() = 12      _zCropServi = 13      libellé : « net à z13 »
```

`_zCropServi` ne descend jamais sous `ZOOM_SOCLE` (13) : c'est le plancher écrit
dans `_majZoomCrop`. Mais la source, là-bas, **s'arrête à z12** — elle rend un
ancêtre surzoomé. Le texel affiché est du z12. Annoncer « net à z13 » était donc
**exactement la sur-promesse de CN1, remise à un niveau**, dans une région entière
du globe.

**Correctif :** l'annonce est bornée par ce que la région sait faire,
`min(prescrit, max)` ; le « plafond de la donnée ici » se déclenche toujours sur
le PRESCRIT (`prescrit >= max`), donc il apparaît bien dans ce cas.

Après : `« Détail (zoom) — maximum atteint pour cette zone (z12) — net à z12,
plafond de la donnée ici »`. **Vrai au texel.**

### 1.4 LE RELEVÉ FINAL — 4 lieux × 4 altitudes, à l'écran

`scripts/sonde-cn4-cartouche.mjs`, Chrome sans tête, 1280 × 720, DPR 1, CPU ×4,
vite sur **127.0.0.1:9601**, bloc à `demZoom = 15`, ≈ 228 images par cellule
(armées à chaque `requestAnimationFrame`, pas une seule image).
**On lit le `textContent` du `.ce-label`, pas la fonction qui l'écrit.**

| altitude | Majorque (max 16) | Beauce · France (max 16) | Zermatt · Suisse (max 17) | Australie (max **12**) |
|---|---|---|---|---|
| 5 000 m | z13 → **« net à z13 »** | z13 → **« net à z13 »** | z13 → **« net à z13 »** | z13 servi → **« net à z12, plafond »** |
| 2 000 m | z14 → **« net à z14 »** | z13 → **« net à z13 »** | z13 → **« net à z13 »** | z13 → **« net à z12, plafond »** |
| 900 m | z15 → **« net à z15 »** | z15 → **« net à z15 »** | z14 → **« net à z14 »** | z13 → **« net à z12, plafond »** |
| 300 m | z16 → **« net à z16, plafond de la donnée ici »** | z16 → **« net à z16, plafond »** | z15 → **« net à z15 »** | z13 → **« net à z12, plafond »** |
| **écarts** | **0 / 771** | **0 / 912** | **0 / 818** | **0 / 912** |

**Total : 0 écart sur 3 413 images.** Et **0 mention de plafond fausse** : la
phrase « plafond de la donnée ici » apparaît si et seulement si le prescrit a
atteint `getDemMaxZoom()` — jamais à Zermatt (max 17, servi ≤ 15), toujours en
Australie (max 12, servi 13).

⚠️ **La cellule exacte que le noteur avait refusée** — Majorque, 300 m — est
**celle-là même qui affiche maintenant `net à z16` pendant que la surface
dessine z16**.

⚠️ **Une correction au passage du brief, mesurée :** « z15 ailleurs » ne se
vérifie pas. `getDemMaxZoom()` rend **16 à Majorque**, et **12** au centre de
l'Australie. Le plafond ne se devine pas par continent ; il se lit.

### 1.5 LA CAPTURE

`.banc/CN4/cliches/majorque-300m-cartouche-page.png` — Majorque, 300 m, bloc à
z15, cartouche ouvert : **« Détail (zoom) — net à z16, plafond de la donnée
ici »** avec le sélecteur sur **15**. C'est la démonstration en une image que
les deux « Z » du panneau répondent à deux questions différentes, et que le
second dit désormais la vérité.
Voir aussi `outback-900m-cartouche.png` (la faute symétrique) et
`zermatt-300m-cartouche.png` (pas de plafond annoncé, à raison).

⚠️ **Un piège payé pour ces captures :** en mode **Explorer** (le mode par
défaut), `.ce-dock-left` est en `display:none`. Le cartouche est **dans le DOM,
et pas à l'écran** — mes quatre premières captures étaient donc vides sans que
rien ne le signale. `scripts/sonde-cn4-capture.mjs` pose
`localStorage['shibumap-workmode'] = 'studio'` **avant le premier script de la
page**, puis déplie le panneau et clique la section. Le script vérifie
`getBoundingClientRect()` non nul avant de déclencher l'obturateur.

---

## 2. ② LA GARDE ③ — POURQUOI ELLE NE MORDAIT PAS, ET CE QUI MORD

### 2.1 J'ai choisi la voie A, et elle marche

Le brief laissait le choix entre **A** (un test unitaire qui fait naître une
image mixte) et **B** (le banc dans l'application, inscrit comme contrôle hors
`npm test`). **A est faisable**, et le diagnostic du noteur donnait la clé :

> *« Le banc de papier résout ses dalles en une microtâche, donc aucune image
> mixte ne peut y naître. »*

Il manquait **une porte sur le réseau**. Le harnais existait déjà dans le dépôt
— `test/raffinement-partiel.test.js` (campagne R37) retient ses réponses de
`fetch` et les lâche à la demande. Je l'ai réemployé tel quel.

### 2.2 Le nouveau fichier — `test/crop-finesse-palier.test.js`

⛔ **`test/crop-nettete-ecran.test.js` N'EST PAS TOUCHÉ.** Son empreinte est
`4b71c1aaaff9fe3acf0ed3d4197d45d2`, identique à celle que CN1 et CN3 ont
inscrite. Les six tests de CN1 restent tels quels, ③ compris ; la garde qui mord
est **à côté**, pas à la place.

Trois tests :

- **ⓐ goutte à goutte** — les dalles arrivent **une toutes les trois images**
  pendant la descente à 600 m. C'est le modèle le plus proche de la production ;
- **ⓑ moitié lâchée** — la moitié des réponses retenues arrive d'un coup, l'autre
  reste en attente. C'est l'unique configuration où `_cropCouvert` a quelque
  chose à **refuser** ;
- **ⓒ témoin de vivacité** — réseau relâché, `_zCropServi` doit dépasser
  `ZOOM_SOCLE`. ⛔ **Sans lui, ⓐ et ⓑ seraient verts sur un globe mort.**

Le relevé compte un **parent partiel** (`_partiel`, quadrants dessinés sous les
enfants manquants) **pour son niveau** : à l'écran ce sont bien deux résolutions
dans le même cadre, et c'est précisément ce qu'Adrien refuse.

### 2.3 LA MORSURE, PROUVÉE PAR MUTATION DU PRODUIT

`scripts/mutation-cn4.mjs` — édition **en binaire** (`Buffer.indexOf`, écriture
d'un `Buffer`, jamais de réécriture de fins de ligne), motif **refusé s'il
apparaît zéro ou plusieurs fois**, restauration dans un `finally` et empreinte
vérifiée à chaque tour.

Deux mutations. La première est **celle du noteur, mot pour mot** :

```
src/globe.js, _traverse (ligne 9888) :
  this._zCropServi || this._zCropEcran || ZOOM_SOCLE
→ this._zCropCible || this._zCropEcran || ZOOM_SOCLE
```

| | dépôt | `palier-mort` | `couvert-permissif` |
|---|---|---|---|
| `crop-nettete-ecran` ③ (banc de CN1) | ✔ | ✔ ⛔ **aveugle** | ✔ ⛔ **aveugle** |
| **ⓐ goutte à goutte** | ✔ | **✖ 69 / 240** | **✖** |
| **ⓑ moitié lâchée** | ✔ | **✖ 159 / 160** | **✖ 159 / 160** |
| ⓒ témoin | ✔ | ✔ | ✔ |

Le message de ⓑ sous `palier-mort`, mot pour mot :

```
159 images sur 160 portent deux finesses ou plus avec 3 dalles sur deux
arrivées — ex. [[14,15],[14,15],[14,15]]
```

⚡ **C'est le `[11, 16]` de CN1, rejoué — l'exigence non négociable d'Adrien est
enfin protégée par la suite.**

**`md5(src/globe.js)` : `b71b597466e4a3e42760ae8e3a97336f` avant ET après les
quatre exécutions**, à chaque tour, imprimé par le script. `git diff -- src/globe.js`
est vide. **0 CR, 786 LF** dans `create-panel.js`, **0 CR, 247 LF** dans le
nouveau test — comptés en binaire, pas par un outil de texte.

⚠️ **Et ⑤ (la garde de coût) ne mord toujours pas.** Je ne l'ai pas traitée :
elle n'était pas dans mon périmètre, et le noteur la range comme réserve, pas
comme refus. **Elle reste ouverte, et je le dis plutôt que de la déclarer
verte.**

---

## 3. LA PREUVE QUE LE MOTEUR N'A PAS BOUGÉ

```
$ git diff --stat
 package.json           |  2 +-
 src/ui/create-panel.js | 52 +++++++++++++++++++++++++++++++++++++++++++++-----

$ git diff --stat -- src/globe.js src/main.js src/dem.js
(vide)

$ md5sum src/globe.js test/crop-nettete-ecran.test.js
b71b597466e4a3e42760ae8e3a97336f *src/globe.js
4b71c1aaaff9fe3acf0ed3d4197d45d2 *test/crop-nettete-ecran.test.js
```

`_zoomCropFin`, `_cropCouvert`, `_majZoomCrop`, l'ordre de service et le bonus
`PRIORITE_CROP` sont **au bit près** ceux que le noteur a mesurés sur 8 279
images. **Sa mesure reste valable.**

⚠️ **`package.json`** ne gagne qu'une entrée, `test/crop-finesse-palier.test.js`,
insérée derrière `test/crop-nettete-ecran.test.js`. `npm run audit:tests` :
**267 listés · 267 sur disque · 6 hors suite déclarés · aucun écart.**

---

## 4. CE QUE J'AI CRU, PUIS RÉFUTÉ

1. **« Le noteur dit qu'une ligne de réactivité répare le cartouche ; je la
   pose et j'ai fini. »** ⛔ **Faux, et le brief me disait de ne pas le croire
   sur parole.** Le second argument d'`onRefresh` est un jeton de **purge**, pas
   une dépendance : le libellé n'était pas abonné au sélecteur mais à
   `refreshAll()`. Ajouter une réactivité de plus n'aurait rien changé, puisque
   **rien n'appelle `refreshAll()` pendant un vol**. Il fallait une boucle
   d'image. *Lu dans `ui/kit.js:16-36` avant d'écrire une ligne.*
2. **« Le défaut est stable : le cartouche dit toujours z13. »** Faux. Sur le
   code d'avant, à **900 m**, il disait **z15 — juste**. La valeur figée dépend
   du **dernier geste d'interface**, pas de l'altitude. C'est pour ça que mes
   cellules en écart ne sont pas celles du noteur, et **les deux relevés sont
   vrais**. Sans l'A/B dans la même session j'aurais conclu que le noteur s'était
   trompé.
3. **« Annoncer `_zCropServi` suffit : c'est ce qui est dessiné. »** ⛔ **Faux
   dans une région entière du globe**, et je ne l'ai su qu'en ajoutant un lieu
   hors d'Europe. `_zCropServi` a un plancher (`ZOOM_SOCLE` = 13) ; la source
   australienne s'arrête à **12**. Le niveau prescrit et le niveau de la donnée
   sont deux choses différentes. *Je n'ai trouvé ça qu'en mesurant, pas en
   lisant : c'est le §2 de la compétence, encore.*
4. **« Le brief dit z17 en Suisse, z16 en France, z15 ailleurs — je peux
   asserter dessus. »** Non : **16 à Majorque**, **12 en Australie**. Le
   plafond de la région n'est pas une table de continents ; les seuls chiffres
   de ce rapport viennent de `getDemMaxZoom()` lu dans l'application.
5. **« Le banc de papier ne peut pas modéliser une image mixte — il faudra la
   voie B. »** Faux, et le dépôt portait déjà la réponse : la « porte » de
   `test/raffinement-partiel.test.js`. Le banc de CN1 ne manquait pas d'un banc,
   il manquait d'une **latence**. *J'ai failli assumer une voie B qui n'était pas
   nécessaire.*
6. **« Ma première garde ⓐ (porte entièrement fermée) mord. »** Faux, mesuré :
   sous `palier-mort` elle restait **✔**. Réseau totalement muet, aucun enfant
   n'arrive, donc rien à mélanger — un test qui n'observe pas le phénomène,
   exactement le reproche du noteur, que j'étais en train de reproduire. Je l'ai
   remplacée par le **goutte à goutte** : elle rend maintenant 69 images mixtes
   sur 240. *Je ne l'ai su qu'en mutant le produit avant de publier.*
7. **« Le cartouche est visible sur la capture puisqu'il est dans le DOM. »**
   Faux : en mode Explorer le dock est en `display:none`. Mes quatre premières
   captures étaient vides, et **le journal disait pourtant « libellé trouvé »**.
   La vérification qui l'a attrapé est `getBoundingClientRect()` non nul.

---

## 5. LES OUTILS DE CE RAPPORT

| fichier | ce qu'il fait |
|---|---|
| `test/crop-finesse-palier.test.js` | la garde ⓐⓑⓒ qui mord : porte sur le réseau, dalles lâchées en différé |
| `scripts/mutation-cn4.mjs` | deux mutations du produit en binaire, table des couleurs, restauration md5 vérifiée |
| `scripts/sonde-cn4-cartouche.mjs` | le relevé à l'écran : `textContent` du cartouche contre `_zCropServi` et `getDemMaxZoom()`, ≈ 228 images par cellule |
| `scripts/sonde-cn4-capture.mjs` | ouvre réellement le panneau (mode studio + section) et photographie la ligne |

`.banc/CN4/*.json` (ignoré par git) porte les 3 413 images d'après et les 727
d'avant, image par image ; `.banc/CN4/cliches/` les captures.

**État du dépôt à la remise :** `git diff -- src/globe.js src/main.js` **vide** ·
`md5(src/globe.js) = b71b597466e4a3e42760ae8e3a97336f` ·
`md5(test/crop-nettete-ecran.test.js) = 4b71c1aaaff9fe3acf0ed3d4197d45d2` ·
`npm test` **4 938 · 4 938 · 0** · `npm run audit:tests` **aucun écart**.
