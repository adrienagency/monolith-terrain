# RAPPORT VID — LA VIDÉO D'ADRIEN : REPRODUITE, ATTRIBUÉE, CHIFFRÉE

**Arbre** `C:\Dev\wt-vid` · branche `chasse-video` (contenu de `regroupement`,
HEAD `5624977`) · serveur `127.0.0.1:9207`.
`git diff -- src/` **vide** · `npm test` **4 929 · 0** · `audit:tests`
**265 listés = 265 sur disque, aucun écart**.

⛔ **Aucune correction n'est livrée.** Ce rapport reproduit, attribue et chiffre.

---

## ⓪ LA RÉPONSE À LA PREMIÈRE QUESTION — LA BRANCHE DE LA VIDÉO

> ⚡ **La vidéo tourne sur `regroupement`, c'est-à-dire EXACTEMENT le contenu de
> cette branche. Ce n'est pas une vieille branche, et ce n'est pas `wt-cn2`.**

**La preuve, et elle est au caractère près.** Le serveur de la vidéo écoutait
encore (`[::1]:5503`, pid 36436). J'ai téléchargé la source qu'il sert et je l'ai
diffée contre l'arbre :

```
curl http://[::1]:5503/src/monde/mer-sphere.js  vs  C:\Dev\wt-vid\src\monde\mer-sphere.js
→ 16 lignes de diff, et ce sont LES SEIZE de Vite :
  · 4 réécritures d'import (`'./crop-sphere.js'` → `"/src/monde/crop-sphere.js?t=…"`)
  · 2 lignes de `sourceMappingURL`
→ 1 228 lignes sur 1 228 identiques. Même numérotation :
  `amplitudeLateraleHoule` en 1136, `bandeHouleBord` en 1190, `GLSL_BORD_CROP` en 1210.
```

⚠️ **Le md5 brut ne prouve RIEN et m'a d'abord induit en erreur** : Vite
transforme le fichier qu'il sert, donc *aucun* arbre ne peut matcher au md5. J'ai
failli conclure « la vidéo ne tourne sur aucune branche connue ». C'est faux, et
c'est le premier piège que je signale.

**Confirmé une seconde fois par l'état vivant de la session**, lu en lecture
seule dans la page de la vidéo :

| | session de la vidéo (5503) | `regroupement` (9207) | base d'avant (`6282ea9`) |
|---|---|---|---|
| `_merEtat.compte.sommets` | **4 225** | **4 225** | **37 249** |
| `_merEtat.compte.triangles` | **8 192** | **8 192** | **73 728** |
| `pas` / `pasGeo` | 192 / **64** | 192 / **64** | 192 / — |
| `emprise` | **1** | **1** | **absente** |
| `_mer` sommets (calotte + rideau) | **6 265** | **6 265** | **39 289** |

**4 225 et 8 192, c'est le « après » de MER2 au chiffre près.** La vidéo est
donc postérieure à `Fusion MER2` (`f558ed8`). Elle a les six fusions du jour.

## ⓪ bis — LE LIEU ET LA POSE, QU'ADRIEN N'AVAIT PAS DITS

Lus dans `uCropCentre` de la session vivante :

- **lat −19,7253 · lon 63,3691** → **l'île Rodrigues (Maurice)**, océan Indien.
  L'appli l'affiche elle-même : « RODRIGUES / MAURITIUS ». ⚠️ **Ce n'est PAS le
  lieu par défaut** (le défaut est **La Réunion**, −21,2484 / 55,7666).
- **altitude de cadrage 32 849 m**, `uCropDemi = 0,000732421875`.

⚡ **Et c'est le fait le plus utile du rapport pour reproduire :** Rodrigues est
une **île minuscule au milieu de 4 000 m de fond**, à 600 km de toute autre
terre. **Tous les défauts d'Adrien sont des défauts de PLEINE MER PROFONDE.**
À La Réunion, au même zoom, dans la même session, **le bloc est irréprochable** :
mer pleine, parois nettes, aucune dent (capture § VI). Chercher le bug à La
Réunion, c'est ne rien trouver — j'ai perdu un aller-retour à le découvrir.

---

## ① LE TABLEAU DES DÉFAUTS, CLASSÉS PAR GÊNE

| # | ce qu'on voit | reproduction (lieu, altitude, gestes) | attribué à | reproduit dans `regroupement` ? | gravité |
|---|---|---|---|---|---|
| **④** | **striage vertical + horizontal massif** sur toute la bathymétrie, en peigne, sur des dizaines de km (`f_003`, `f_018`) | Rodrigues −19,7253/63,3691, **67 000 m**, molette arrière depuis le bloc | **PRÉEXISTANT** — pas une fusion du jour (hypothèse : raccord de dalles GEBCO/quadtree) | ✅ **oui, franc** — capture quasi superposable à `f_018` | **haute** — c'est ce qui se voit le plus longtemps dans la vidéo |
| **③ + ⑤** | **plaques rectangulaires** de « terre » (beige/rouge) **en pleine mer à 4 000 m de fond**, bords **rectilignes**, alignées tuile (`z_009`, `f_003`, `f_018`) | Rodrigues, **67 000 m** et vue globe ; visibles sans aucun geste | **PRÉEXISTANT — c'est la famille que PLAT a NOMMÉE et à moitié seulement réparée** (§ IV) | ✅ **oui** — plaques à arête verticale nette en plein océan | **haute** |
| **① + ②** | **socle en bassin rouge, nappe d'eau bien plus petite que le socle, bord en dents de scie** (`z_019`, `f_033`) | Rodrigues, **32 849 m**, crop actif | **hypothèse MER2** (§ V) — ⚠️ **NON tranché**, je ne l'ai pas reproduit moi-même | ⚠️ **constaté vivant sur la session de la vidéo, PAS rejoué par moi** | **haute** (c'est le plus spectaculaire) |
| **SORTIE-bis** | **la molette sort du crop mais n'y rentre plus** — porte à sens unique | Rodrigues : 9 crans arrière → `uCropOn` passe à 0 à 64 km ; **1 cran avant ne le ramène pas** (alt et `uCropDemi` inchangés) | **`Fusion SORTIE` (`aedb2b7`)** — effet de bord non couvert par son rapport | ✅ **oui, mesuré deux fois** | **moyenne** — piège d'usage |
| **⑥** | **scène + interface laiteuses** pendant plusieurs secondes (`f_009`, `f_010`) | n'importe où, au chargement | **PAS UN BUG DE RENDU — c'est le voile d'accueil** | ✅ oui, **et aussi sur la base d'avant `6282ea9`** | **basse** (mais long) |

---

## ② LES TROIS PLUS GRAVES : CAUSE ÉTABLIE / HYPOTHÈSE, SÉPARÉES

### ④ LE STRIAGE — **cause NON établie, mais l'attribution du jour est RÉFUTÉE**

**Établi :** le défaut est **reproduit** sur `regroupement` à Rodrigues à 67 km,
et la capture est quasi superposable à `f_018`. Il porte sur la **bathymétrie**,
en bandes régulières alignées sur les frontières de dalles.

**Établi aussi, et c'est le point :** **aucune des six fusions du jour ne touche
ce chemin à cette échelle.** Démonstration par le garde de PLAT lui-même
(`src/bathy.js:236`) :

```js
return resolutionSourceM > CELLULE_MAX_PX * metersPerPixel ? 0 : NOISE_BAND
```

À 67 km d'altitude, `metersPerPixel` est de l'ordre de **10³ m**, et
`resolutionSourceM` (GEBCO) de **~450 m**. `450 > 32 × 1000` est **faux** →
le garde **ne s'arme pas**, la bande de bruit garde sa valeur d'avant, **au bit**.
Le garde de PLAT ne peut donc rien changer à cette vue. **Idem pour VETO** : il
ne ferme QUE la bande de bruit (son § ②), et en plein océan `coast-z6` ne déclare
aucune terre → `veto` est faux → `bruit` inchangé.

➡️ **Hypothèse restante, non mesurée :** raccord entre dalles bathymétriques de
niveaux voisins (le quadtree sert deux z différents côte à côte). **Je ne l'ai
pas instrumentée. Je la donne comme hypothèse, pas comme diagnostic.**

### ③ + ⑤ LES PLAQUES DE TERRE EN PLEINE MER — **cause établie par PLAT, réparation volontairement partielle**

**Établi — et le code le dit lui-même.** `src/bathy.js` (encart PLAT, l. 154-196)
et `rapport-PLAT.md` § ① nomment exactement ce qu'Adrien filme : *« des
rectangles à angles droits de la taille d'une cellule, et, là où une cellule
reste au-dessus du seuil, un carré resté émergé au milieu de l'eau »*.

**Établi — la réparation est bornée à un seul des quatre chemins.**
`rapport-VETO.md` § ② énumère les **quatre** portes qui mettent un pixel sous
l'eau : le **zéro exact du terrarium**, l'**aplat de remplissage**, la **bande de
bruit**, le **pixel déjà négatif**. **PLAT et VETO n'agissent QUE sur la bande de
bruit.** Les trois autres sont intactes.

⚠️ **Et PLAT le dit en toutes lettres dans son propre en-tête, que je cite parce
qu'il dédouane la fusion :**

> *« CE RAPPORT DIT AUSSI CE QUI N'EST PAS CORRIGÉ. (…) La Camargue montre encore
> ses carrés à l'écran. Ne pas lire ce rapport comme "c'est fait". »*

➡️ **Ce n'est donc PAS une régression du jour : c'est le défaut connu, que PLAT a
diagnostiqué et n'a réparé qu'à moitié — et Adrien vient de le filmer sur l'autre
moitié.** C'est la conclusion la plus actionnable du rapport.

### ① + ② LE BASSIN ROUGE ET LES DENTS DE SCIE — **hypothèse, et je le dis fort**

**Ce qui est établi :**

1. **Le rouge n'est pas un bug de couleur.** C'est le **matériau normal des
   parois du socle** (`_parois`, « crop-parois »). Vérifié à La Réunion sur la
   même branche : les parois y sont du même rouge-brun et **personne ne s'en
   plaint**, parce que la mer couvre le bloc. ⛔ **Le relevé « le fond marin est
   traité en terre émergée » est donc à écarter : ce n'est pas du terrain.**
2. **Le défaut est donc « la nappe ne couvre plus le socle »**, ce qui expose les
   parois par l'intérieur — un bassin.
3. **La géométrie de la nappe a bien changé aujourd'hui** : `emprise = 1`,
   4 225 sommets au lieu de 37 249 (`globe.js:6524-6526`, MER2).

**Ce qui reste une hypothèse — explicitement :**

- ⛔ **Je n'ai PAS reproduit les dents de scie moi-même.** Je les ai constatées
  vivantes dans la session de la vidéo, mais quand j'ai voulu mesurer l'emprise
  de la nappe contre celle des parois, `g._mer` était repassé à `null` (la
  session avait bougé). **La mesure décisive n'a pas été prise.**
- ⛔ **Et une piste évidente est déjà RÉFUTÉE** (§ III) : ce n'est pas
  `RETRAIT_EAU_CROP`.

➡️ **Le suspect n° 1 reste MER2** (`f558ed8`), parce que c'est la seule fusion du
jour qui change l'étendue de la géométrie de la mer. **Mais je ne l'ai pas
prouvé, et je refuse de l'écrire comme si je l'avais fait.**

---

## ③ CE QUE J'AI CRU, PUIS RÉFUTÉ

Six pistes payées, toutes fausses. Elles valent plus que les vraies, parce que le
prochain agent les reprendrait.

1. ⛔ **« La vidéo ne tourne sur aucune branche connue »** — le md5 du fichier
   servi ne matchait aucun arbre. **Faux : c'est Vite qui transforme.** Il faut
   differ le CONTENU, pas hacher les octets.
2. ⛔ **« La densité de maille de la mer s'est effondrée » — `pasGeo` fautif.**
   `globe.js:6525` fait `Math.round(pas × emprise / p)`, ce qui n'est juste que
   si `pas = 192` et `p = 3`. **Mesuré vivant : `pas = 192`, `pasGeo = 64`,
   4 225 sommets. L'arithmétique de MER2 tient. Réfuté.**
3. ⛔ **« La bande de bord est déréglée » — `bande: {debut: 22,2, fin: 88,8}` dans
   `_merEtat`, contre 0,07 attendu.** **Faux : ce n'est pas la bande de mer.**
   C'est `bandeDegradation(bascule)` (`globe.js:6595-6596`), une distance de
   dégradation **en mètres**. Deux champs qui portent le même mot. Réfuté.
4. ⛔ **« `parDemi` a explosé (1,7356 contre 0,2147 dans MER2) »** — j'en ai fait
   un facteur 8,08 suspect. **Faux : les deux sessions n'étaient pas au même
   endroit** (Rodrigues vs La Réunion) ni au même zoom (`uCropDemi` ×2).
   `parDemi` suit la largeur réelle du crop, il fait son travail. Réfuté.
5. ⛔ **« La nappe est rentrée de `RETRAIT_EAU_CROP` »** — calculé sous node :
   **`RETRAIT_EAU_CROP = 0,00786`, soit un retrait de 0,79 %.** La vidéo montre
   un retrait de **~30 %**, soit **38 fois plus**. **Réfuté par le chiffre.**
6. ⛔ **« ⑥ la scène laiteuse est un bug de rendu »** — **c'est le voile
   d'accueil** (« Ta carte, ton design, en 2 minutes »). Il voile **aussi les
   panneaux et le bouton Publier** dans `f_009` : un bug 3D ne fait pas ça.
   **Et il est identique sur la base d'avant `6282ea9`.** Le piège du brief était
   juste. Réfuté.

⚠️ **Et un constat d'Adrien que je corrige :** *« le fond du bloc et ses parois
sont d'un brun-rouge terreux, comme si le fond marin était traité en terre
émergée »*. **Non** : c'est le matériau normal des parois. Le défaut est que la
mer ne les couvre plus, pas que le fond soit peint en terre. La nuance change le
lieu où il faut chercher.

---

## ④ L'A/B CONTRE LA BASE D'AVANT — CE QU'IL A DONNÉ, ET OÙ IL S'EST ARRÊTÉ

`git checkout --detach 6282ea9` (« Fusion FIX1 », le parent des six fusions du
jour), même serveur, même session de banc, même recette.

**Ce qu'il a prouvé :**

- La base est bien la base : **37 249 sommets / 73 728 triangles, pas 192, clé
  `emprise` absente** — le « avant » de MER2, au chiffre.
- **Le voile d'accueil (⑥) est identique sur la base.** Pas une régression.
- **À Rodrigues à 1 586 m, base et branche sont visuellement indiscernables.**

**Où il s'est arrêté, et pourquoi — ⚠️ à savoir avant de le refaire :**

> ⛔ **Sur la base d'avant, la molette ne fait PAS sortir du crop.** J'ai poussé
> 6 crans arrière : `altitudeCadrageM` n'a pas bougé d'un mètre (1 585,947 →
> 1 585,947), `uCropDemi` non plus. **C'est très exactement le bug que
> `Fusion SORTIE` a réparé** — et il rend l'A/B à haute altitude
> **impossible par la molette sur la base**. Il faut un autre chemin
> (poser la caméra par script, ou `demZoom`).
>
> ➡️ **C'est pour ça que ①/② n'est pas tranché.** Ce n'est pas un oubli, c'est
> un blocage nommé, et le prochain agent doit le contourner et non le redécouvrir.

---

## ⑤ CE QUE JE RECOMMANDE

**⛔ NE REVENIR EN ARRIÈRE SUR AUCUNE FUSION.** Aucun des défauts filmés n'est
prouvé être une régression du jour, et deux sont prouvés ne PAS l'être (④ par le
garde d'échelle qui ne s'arme pas, ⑥ par l'A/B sur la base). Un retour en arrière
**rouvrirait** au minimum le bug de molette de SORTIE, qui est réel et que j'ai
mesuré.

**Dans cet ordre :**

1. **③ + ⑤ — finir PLAT.** C'est le plus rentable, et le travail est déjà
   spécifié par son propre § ⑥. La bande de bruit est gardée ; **l'aplat de
   remplissage et le zéro du terrarium ne le sont pas**. Étendre le garde
   d'échelle aux trois autres portes de `fuseBathymetry`.
   ⚠️ **Avec le témoin de PLAT** : les deux lieux z13 doivent rester identiques
   au bit, sinon B5 est cassée.
2. **① + ② — trancher, ne pas corriger à l'aveugle.** La mesure décisive tient en
   une ligne et n'a pas été prise : **la boîte englobante de la calotte
   (4 225 premiers sommets de `_mer`) contre celle de `_parois`, à Rodrigues à
   32 849 m.** Si le ratio est < 1, MER2 est coupable et le chiffre est là. Si
   c'est 1, le défaut est dans le nuanceur et MER2 est innocent.
   **À faire AVANT de toucher `EMPRISE_MER_CROP`.**
3. **SORTIE-bis — la porte à sens unique.** À signaler à SORTIE : sortir en 9
   crans est acquis, **rentrer ne marche pas**.
4. **④ — instrumenter avant de réparer.** Aucune hypothèse n'est mesurée.
5. **⑥ — pas un bug.** Au plus, une question de durée à poser à Adrien.

---

## ⑥ LA RECETTE DE REPRODUCTION, EN CINQ LIGNES

```
npx vite --host 127.0.0.1 --port 9207        # ⛔ PAS npm install : node_modules est une jonction
→ ouvrir http://127.0.0.1:9207/ , Échap (ou la croix) pour lever le voile d'accueil
→ __exp.gotoCtl.go('-19.7253, 63.3691')      # Rodrigues — ⚠️ PAS le lieu par défaut
→ 6 crans de molette arrière                 # ④ et ③/⑤ : striage + plaques de terre en pleine mer
→ s'arrêter à uCropDemi = 0,000732421875     # ①/② : la pose exacte de la vidéo (32 849 m)
```

⚠️ **La molette ne passe pas par `computer:scroll`** (le voile `.ce-elemwrap`
l'avale, exactement comme le brief l'annonce). Il faut la poster à la main sur la
toile :

```js
const cv = __exp.renderer.domElement, r = cv.getBoundingClientRect()
cv.dispatchEvent(new WheelEvent('wheel', { deltaY: 120,
  clientX: r.left + r.width / 2, clientY: r.top + r.height / 2,
  bubbles: true, cancelable: true }))
```

**Les états à lire pour savoir où on est** (tous vérifiés) :
`__exp.altitudeCadrageM()` · `__exp.globe.uniforms.uCropDemi.value` ·
`__exp.globe.uniforms.uCropOn.value` · `__exp.globe._merEtat` ·
`__exp.globe._mer.geometry.attributes.position.count`.

⚠️ **`_merEtat` et `_mer` passent à `null` dès qu'on quitte le crop** — d'où la
mesure manquante du § ②. **Lire pendant, pas après.**
