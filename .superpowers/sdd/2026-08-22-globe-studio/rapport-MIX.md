# RAPPORT MIX — ① le scintillement, ③ le décalage

Arbre `C:\Dev\wt-mix`, branche `bug-transition`. Serveur Vite `--host 127.0.0.1
--port 7931`.

---

## LES LIGNES QUE JE TOUCHE — pour la fusion à la main

| fichier | ce que je touche |
|---|---|
| `src/monde/estompage-terre.js` | **+5 l.** un import (`IMAGES_CALME`) · **+38 l.** le §8 et `IMAGES_FONDU_REPOS` · **+11 l.** l'état `porteRepos` / `premierRelais` · **le corps de `poser()`** (5 lignes réécrites) · **+26 l.** `poserRepos` + la méthode neuve `avancerFondu()` · **+13 l.** trois accesseurs (`porteRepos`, `fonduAcheve`) |
| `src/monde/branchement-crop.js` | **+10 l.** la déclaration `cropSeulApplique` · **le corps d'`appliquerRepos`** (8 lignes → 38, dont 25 de commentaire) |
| `src/main.js` | **le corps de `majEstompage()`** seul (`6011` → `6027`), 2 lignes de code + 12 de commentaire |
| `test/estompage-terre.test.js` | **②d** : la liste des imports autorisés passe de 1 à 2 |
| `test/veille-repos.test.js` | **⑤ `poserRepos(true)` force UN** : la sortie du repos ne saute plus, elle se fond (+1 import) |
| `package.json` | **+1 entrée** : `test/estompage-fondu.test.js` |
| `test/estompage-fondu.test.js` | **NEUF**, 12 tests |
| `scripts/sonde-mix.mjs`, `scripts/diag-mix-reperes.mjs` | **NEUFS**, bancs seuls |

⛔ **Je ne touche ni `globe.js`, ni la nappe de mer, ni les seuils, ni le tri hors
crop** — les terrains de `wt-cull`, `wt-mer` et `wt-z10`. Mon seul contact avec
`seuil-socle.js` a été **temporaire et annulé** (mesure D23, § « des deux
côtés ») : le fichier est identique à `HEAD`.

---

## LE VERDICT, EN CHIFFRES

| grandeur | avant | après | attendu |
|---|---|---|---|
| **images scintillantes** (la couche « Terre autour » saute de ≥ 0,5 en une image), seuil z7 | **13 / 2 865** | **0 / 2 453** | 0 |
| idem, **seuil remis à z10** localement | **13 / 1 473** | **0 / 2 005** | 0 |
| **pire marche** d'une image sur `uEstompage` | **1,0000** | **0,0499** | — |
| **écart d'alignement socle/crop**, 11 points × toutes les images, crans compris | **2,10 · 10⁻¹⁰ px** | **1,69 · 10⁻¹⁰ px** | ≤ 1 px |
| `npm test` | 4 869 · 0 | **4 881 · 0** | ≥ 4 869 · 0 |
| `npm run audit:tests` | 261 = 261 | **262 = 262** | — |

Bancs : `.banc/MIX/{avant,apres,avant-z10,apres-z10}.json`. Majorque
(39,5696 · 2,6502), douze paliers de **253 km à 9,2 km**, relevé **dans
`composer.render`**, 1 473 à 2 865 images par passage.

---

## ① LE SCINTILLEMENT — LA CAUSE EST LE FONDU, ET LES DEUX AUTRES SONT RÉFUTÉES

### Ce que la mesure montre

À **chaque cran de zoom**, `uEstompage` fait **1 → 0 → 1**, et **chaque flanc
tient dans UNE image** (≈ 15 ms). Entre les deux, la Terre autour du crop est
dessinée **à pleine opacité pendant 550 à 830 ms**. Relevé, palier 0
(253 km → 178 km), `.banc/MIX/avant.json` :

```
i 5090  est 1  cropSeul true   dessinées 297  cache 1105
i 5092  est 0  cropSeul false  dessinées 287  cache  989   ← une image
…
i 5122  est 1  cropSeul true   dessinées 299  cache 1057   ← une image
```

C'est mot pour mot l'« affichage / désaffichage des différentes couches »
d'Adrien : la couche « Terre vue de l'espace » s'allume en une image et s'éteint
en une image, deux fois par cran.

### Le départage des trois causes — mesuré, pas choisi

| cause candidate | ce que j'ai mesuré | verdict |
|---|---|---|
| **combat de profondeur** (z-fighting) | le tampon de dessin relu **image par image**, caméra rigoureusement immobile et `uEstompage` constant, sur **46 à 233 images consécutives à chacun des douze paliers** : **0 pixel sur 64 000 ne change de plus de 64 niveaux** | ⛔ **réfuté** |
| **ordre de rendu / `renderOrder` / `depthWrite`** | `uCropOn`, `uHabOn`, `uMerRampeOn`, la présence des parois : **zéro bascule** sur les mêmes fenêtres au repos | ⛔ **réfuté** |
| **fondu d'estompage mal borné** | `uEstompage` saute de **1,0000 en une image**, 13 fois sur le passage | ✅ **c'est lui** |

⚠️ **Et le témoin de pixels dit une chose de plus, qu'il faut publier même si
elle ne m'arrange pas** : à **tous** les paliers, y compris au repos complet et
crop seul, **59 à 61 % des pixels changent de plus de 8 niveaux d'une image à
l'autre**, d'écart moyen **12,7 niveaux**, sans un seul pixel au-delà de 64.
C'est un bruit global de faible amplitude, identique à 253 km et à 9 km, donc
indépendant de l'estompage. **Mon instrument de pixels est saturé par lui : il
ne peut PAS servir de juge fin.** Il tranche le z-fighting (qui produirait des
écarts forts) et rien d'autre. ➡️ C'est probablement le même « quelque chose
d'autre bouge dans la scène et n'a pas été identifié » que `lecons-campagne-R.md`
④ signale. **Tâche à ouvrir, hors de mon périmètre.**

### La correction

Le §7 de `estompage-terre.js` avait posé le repos comme un **interrupteur**. Un
interrupteur sur une couche pleine page est un flash. La porte du repos devient
**continue** :

- `porteRepos ∈ [0, 1]` rejoint sa cible en **`IMAGES_FONDU_REPOS` images**, et
  la valeur posée est `auSeuil + (1 − auSeuil) · smoothstep(porteRepos)` ;
- **la LOI n'est pas touchée** — bornes dérivées, rampe logarithmique, pas
  d'hystérésis. Un test le verrouille au bit près (`③ hors repos, la valeur posée
  est la LOI`) ;
- **la durée n'est pas posée, elle est LUE** : `IMAGES_FONDU_REPOS = IMAGES_CALME`
  (`veille-repos.js`), l'hystérésis qui *décide* que la vue est stabilisée. Le
  fondu dure donc exactement le temps qu'il a fallu pour prendre la décision qu'il
  applique — et une machine qui rame, qui a déjà « besoin de plus de repos, pas de
  moins », obtient aussi un fondu plus long. **30 images = 0,5 s à 60 Hz, 1 s à
  30 Hz.** Un test refuse tout chiffre écrit en dur ;
- **le premier relais reste FRANC.** `veille-repos.js` écrit noir sur blanc qu'il
  démarre au repos, sinon « la planète entière pendant la demi-seconde qui suit
  l'arrivée, exactement l'image qu'Adrien refuse ». Il n'y a d'ailleurs rien à
  fondre : le crop vient d'apparaître.

### Le second maillon, sans lequel le fondu ne se verrait pas

`globe.poserCropSeul` était **pairé à l'image près** avec le relais de repos.
Appliqué à la première image du repos, il faisait disparaître d'un coup les
tuiles que le fondu commence à estomper : **cache 1 105 → 989 et 297 → 287
dessinées en UNE image**. Il attend désormais `estompage.fonduAcheve`.
L'asymétrie est celle de `veille-repos.js` : **on redessine le dehors dès la
première image du geste, on cesse de le dessiner seulement quand il est
entièrement effacé.** L'invariant « pas de coût sans dessin » reste tenu à l'état
stable, le seul où il ait un sens.

### Le troisième maillon — et c'est celui qui aurait tout annulé

`avancerFondu()` est appelée depuis **`majEstompage()`**, pas depuis
`veilleCrop.maj`. ⛔ **`majSeuilSocle` s'arrête sur `modes.busy`, c'est-à-dire
sur toutes les images du cran** — précisément celles pendant lesquelles le fondu
doit courir. Posé derrière cette garde, il aurait gelé et rendu la marche qu'il
existe pour supprimer. Un test lit `main.js` et refuse que `avancerFondu`
apparaisse après `modes?.busy`.

### La forme obtenue, image par image (après, palier 0)

```
i 7559  est 1,0000  cropSeul true   dess 297
i 7562  est 0,9967  cropSeul false  dess 289
i 7566  est 0,9259                  dess 291
i 7576  est 0,5000                  dess 297
i 7586  est 0,0741                  dess 304
i 7591  est 0,0000                  dess 308
```

Un smoothstep de 30 images, **660 ms**, dérivée nulle aux deux bouts ; les tuiles
dessinées montent de 289 à 313 au lieu de tomber de 297 à 287 en une image.

---

## ③ LE DÉCALAGE — JE NE LE REPRODUIS PAS, ET VOICI CE QUE J'AI ÉLIMINÉ

⚠️ **Le juge est un chiffre, et le chiffre est zéro.**

### Mesure 1 — les deux lois de « où tombe ce point du bloc »

Sur **onze points du bloc** (centre, quatre coins, quatre milieux d'arêtes, deux
intermédiaires), à **chaque image** des passages, cran et images `busy`
comprises — **1 506 images** :

| écriture | source |
|---|---|
| **le socle** | `mondeVersLatLonEmprise(emprise, x, z)` (`geo.js:114`) — la loi du MNT, du masque de côte, de l'analyse, des toponymes, du drapage |
| **le crop** | `latLonDeLocal(x/half, z/half, globe._crop)` (`crop-sphere.js:149`) — la loi que le NUANCEUR applique pour découper et pour habiller |

**Pire écart : 2,37 · 10⁻⁹ m au sol et 1,93 · 10⁻¹⁰ px à l'écran.** C'est le
bruit de `double`. Critère « ≤ 1 px » tenu par **dix ordres de grandeur**,
avant comme après.

### Mesure 2 — les repères eux-mêmes, à cinq crans de zoom

`scripts/diag-mix-reperes.mjs`, Majorque, z10 → z6, relevé dans l'application
vivante. Le repère du crop (`cx`, `cy`, `demi`) reconverti en emprise, confronté
à `terrain.fenetreBornee.emprise` :

```
ecartM : { ouest 0, est 0, nord 0, sud 0 }        ← à CHAQUE cran
demiMercX = demiMercY = 0,00146484375             ← l'emprise est un carré de mercator exact
uCropCentre = [0,50732421875 · 0,38037109375] = (cx · cy)  ← l'uniforme est le repère
```

**Zéro mètre d'écart, à tous les crans.** L'emprise du bloc est bien un carré de
mercator (donc `demi` unique est légitime), et `latLonOrigineBloc()` en est bien
le centre **en mercator**, pas en latitude — c'est ce qui rend la conversion
exacte, et je n'ai trouvé **aucune** conversion manquante, doublée ni inversée.

### Ce que j'ai cru, puis réfuté

1. ⛔ **« Le repère du crop est centré sur le bloc, la caméra de fond sur
   l'aplomb de la cible : les deux ancres diffèrent, donc les deux Terres se
   décalent. »** Faux. Il n'y a **qu'une seule Terre dessinée** sous
   `?terre=unique` : `fusionDesPasses` désactive la passe de surface, et le crop
   est **découpé dans les tuiles du globe**, pas superposé. Les deux ancres
   servent à deux choses différentes qui ne se comparent jamais à l'écran.
2. ⛔ **« Le `demi` unique de `repereCrop` est isotrope alors que l'emprise ne
   l'est pas — le crop est étiré en latitude. »** Faux, mesuré :
   `demiMercX = demiMercY` au bit près, à tous les crans.
3. ⛔ **« Les habillages (masque de côte, analyse, sol) sont cuits sur
   l'empreinte du MNT, qui n'est pas l'emprise du crop — geo.js:135 mesure
   jusqu'à un sixième de socle d'écart. »** Faux ici : `dem.lat/lon`,
   `dem.extentMeters` et `fenetreBornee.largeurM` coïncident exactement à tous
   les crans relevés.
4. ⛔ **« `majCameraFond` n'a pas la garde `modes.busy` de `majSeuilSocle` : elle
   pose donc la similitude sur le couple désaccordé `largeurBlocM` / `camY`
   pendant une image, et la Terre saute d'un facteur 2. »** **Non reproduit** :
   pire rapport de distance-globe entre deux images consécutives = **1,0224**,
   sur un passage entier, `largeur` inchangée de part et d'autre. L'hypothèse
   était bonne à écrire, elle est fausse à l'exécution.
5. ⛔ **Mon témoin de pixels comme juge du scintillement** — voir ① : saturé à
   60 % par un bruit global de 12,7 niveaux. Retiré comme juge fin, gardé comme
   juge du z-fighting seul.

### Ce qui reste ouvert sur ③, et pour qui

⚡ **La seule fenêtre où les deux représentations coexistent réellement est le
flash de ①.** Au repos, `_cropSeul` fait que **rien n'est dessiné hors du crop**
— mesuré : ma sonde de couture ne trouve **aucune** tuile dessinée à l'extérieur
à aucun des douze paliers au repos. Il n'y a donc, au repos, pas deux Terres à
désaligner.

➡️ Reste **une** hypothèse que je n'ai pas pu chiffrer : **pendant** le flash, le
crop force `z = ZOOM_SOCLE = 13` à l'intérieur tandis que le quadtree choisit par
la distance à l'extérieur ; le trait de côte dessiné dehors est donc celui d'un
MNT beaucoup plus grossier, et il ne peut pas rejoindre celui du crop.
⚠️ **Mon instrument ne peut pas le mesurer, et je le dis plutôt que de le
supposer** : `_buildMesh` **relâche `t.heights`** pour toute tuile non réservée
(les tuiles hors crop le sont toutes), donc la hauteur dessinée à l'extérieur
n'est **pas lisible côté CPU**. `st.couture()` de `scripts/sonde-mix.mjs` est
écrite, appelée, et rend `0 point` pour cette raison — pas parce qu'il n'y a rien.
➡️ **Pour `wt-cull`** : c'est le tri hors crop, c'est son terrain, et le
correctif de ① réduit déjà la fenêtre où ça peut se voir de « deux flashes francs
par cran » à « un fondu ».

---

## LES DEUX CÔTÉS DU SEUIL — z7 ET z10 (⚠️ demandé par le brief)

Le seuil de naissance du crop a été posé **localement et temporairement** à
`SEUIL_BLOC_M` / `SEUIL_BLOC_MORT_M` (le z10 de D23), les deux passages refaits,
puis `seuil-socle.js` **restauré à l'octet près** (`git status` le confirme).

| | images scintillantes | pire marche |
|---|---|---|
| avant, seuil z7 (l'arbre tel quel) | **13 / 2 865** | 1,0000 |
| avant, **seuil z10** | **13 / 1 473** | 1,0000 |
| après, seuil z7 | **0 / 2 453** | 0,0499 |
| après, **seuil z10** | **0 / 2 005** | 0,0499 |

➡️ **Le défaut ① survit entièrement à z10 : c'est bien le mien à corriger.** Et
la raison est arithmétique : sous z10 le crop vit entre **40 342,8 m et 19 364,6 m**
d'altitude, c'est-à-dire **exactement la bande d'estompage**, où l'amplitude de la
marche vaut `1 − loi(altitude)` — donc **1,000 à la naissance du crop**.

⚠️ **Un fait de D21 ① qu'il faut connaître pour lire ce tableau** : même avec le
seuil à z10, le crop reste posé à 253 km, parce que sa mort demande une
**intention** de sortie et qu'un cran de zoom n'en est pas une. Les deux colonnes
mesurent donc bien la même trajectoire.

---

## NON-RÉGRESSION

- `npm test` : **4 881 · 0** (était 4 869 · 0 ; +12, mes tests neufs).
- `npm run audit:tests` : **262 = 262**.
- **D16 ter n'est pas touchée, et c'était le risque.** `veilleCrop.arriveeBloc`
  vaut `reposApplique && auBloc` : j'ai gardé `reposApplique` et son compteur
  `basculesRepos` **rigoureusement inchangés** — c'est `cropSeulApplique`, un
  état neuf et séparé, qui porte le report. Les tests D16 ter / `veille-repos` /
  `pivot-globe` / `pivot-molette` passent tous.
- **`|Δ ln d|`, D19 glissé, molette** : aucun code de caméra ni de geste n'est
  touché ; les tests correspondants passent.
- **Deux tests existants ont été mis à jour, et c'est assumé** : ils encodaient
  la marche d'une image (`test/veille-repos.test.js` ⑤) et la liste des imports
  autorisés (`test/estompage-terre.test.js` ②d). Le nouveau texte de ⑤ vérifie
  **davantage** que l'ancien : que la sortie du repos ne saute pas, ET qu'elle
  rend la main à la loi une fois le fondu achevé.

## LES TESTS QUI ÉCHOUENT SANS LE CORRECTIF

`test/estompage-fondu.test.js` (12 tests), inscrit dans `package.json`. Vérifié :
les trois fichiers de `src/` remisés, **le fichier entier échoue** (l'import de
`IMAGES_FONDU_REPOS` fait partie du correctif). Les tests ② ③ ④ ⑤ échouent
individuellement sur la sémantique, pas seulement sur l'import :

- **②** aucune image ne déplace la couche de ≥ 0,5, sortie ET retour, sur
  20 images consécutives de chaque côté — le critère du brief ;
- **③** la loi n'est pas altérée ; sous 19 364 m le fondu est invisible ;
  l'orbite prime toujours et **sans** fondu ; le premier relais reste franc ;
- **④** `poserCropSeul(true)` n'est posé qu'une fois le fondu achevé, et
  `poserCropSeul(false)` dès la première image du geste (globe de papier) ;
- **⑤** `majEstompage` avance le fondu **avant** la garde `busy` dans `main.js`.

## LES BANCS

- `scripts/sonde-mix.mjs` — le passage complet : douze paliers, état par image
  **dans `composer.render`**, alignement des deux lois par image, témoin de
  pixels, couture, captures.
- `scripts/diag-mix-reperes.mjs` — les repères confrontés au même instant, cran
  par cran.
- ⛔ Les deux **ne tuent que leur propre Chrome** (PID connu, profil temporaire
  jeté), consigne du 2026-09-03.
