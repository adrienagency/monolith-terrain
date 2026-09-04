# MER — LA NAPPE DÉBORDAIT DU CROP : LA CAUSE, LE CHIFFRE, LE CORRECTIF

Arbre `C:\Dev\wt-mer`, branche `bug-mer-crop`, au-dessus de `adefdb5`
(« Les cinq défauts nommés par Adrien le 2026-09-04 »).
Sonde : `scripts/sonde-mer-crop.mjs` — rejouable, A/B au GPU dans la même
session. Relevés dans `.banc/MER/`, captures dans `.banc/MER/pour-adrien/`.

> **Adrien, 2026-09-04, défaut ②** : *« On a la mer qui prend beaucoup plus que
> la taille du crop, et parfois ne se crope pas du tout. »*

**Les deux questions du brief, séparées, avec le chiffre de chacune :**

| | avant | après |
|---|---|---|
| ① **la GÉOMÉTRIE** de la nappe est-elle plus grande que l'emprise du socle ? | **oui, et par construction** : la calotte couvre `PORTEE_CROP = 3` demi-côtés, soit **3 largeurs de crop, 9× la surface du socle** — 37 249 sommets, 73 728 triangles, pas 192 | **inchangée**, et c'est délibéré (§4) |
| ② le **DÉCOUPAGE** est-il posé, et reçoit-il la bonne emprise ? | **posé, mais sur la MAUVAISE emprise** : `uMerBord` suivait l'estompage de la planète, pas le socle. À estompage 0 la nappe s'éteignait à **+1,992 demi-côté hors du crop**, c'est-à-dire au bord de la calotte | `uMerBord` = **(−0,0157 ; −0,0079)**, constant, l'emprise du socle |
| **mer dessinée hors de l'emprise du socle** (1 280×800) | **407 358 px, 39,8 % de l'écran** | **0 px** |
| silhouette de la nappe à l'écran | 517 270 px | 111 670 px — **×4,63 de moins** |
| sur **huit chargements** × 3 altitudes × 5 estompages | le défaut est là dès que l'estompage n'est pas plein | **0/120 postes en débordement** |
| `npm test` | 4 870 · **5** (les 5 sont `pdf-affiche`, **préexistantes**, vérifiées sur l'arbre propre) | 4 870 · **5**, les mêmes |
| `audit:tests` | 261 = 261 | 261 = 261 |

---

## 1. LA CAUSE, NOMMÉE — et ce n'était pas la géométrie

Une seule ligne, `src/monde/mer-sphere.js` :

```js
const fin = (p - 1) * (1 - e) - RETRAIT_EAU_CROP   // e = estompage, p = portée
```

`bordDeMer(estompage, portee)` faisait **dépendre l'étendue de la nappe de
l'estompage de la Terre autour**. L'intention d'origine (Tâche J) est écrite
dans le module : *« estompage = 0 = la planète est ENTIÈRE : la mer peut aller
jusqu'au bord de la calotte, elle repose sur des océans dessinés »*.

⛔ **Cette intention est fausse depuis D23.** *« La mer animée et les effets ne
s'activent qu'à partir de ce niveau de crop. »* La nappe simulée appartient au
crop ; hors du crop, l'océan est **la bathymétrie peinte par le nuanceur de
tuile** (rapport PF3 §1). Une nappe qui déborde ne repose donc pas sur des
océans dessinés — elle repose sur le fond de l'affiche. C'est le grand voile
bleu de la capture d'Adrien, et c'est ce que montre
`.banc/MER/pour-adrien/1-AVANT-en-mouvement.png`.

**Le facteur mesuré, à `portee = 3` :**

| estompage | `uMerBord.fin` | mer hors emprise (px) | % écran | silhouette (px) |
|---|---|---|---|---|
| 0,00 | **+1,9921** | **407 358** | 39,8 | 517 270 |
| 0,22 | +1,5521 | 407 352 | 39,8 | 517 265 |
| 0,50 | +0,9921 | 324 292 | 31,7 | 434 186 |
| 0,75 | +0,4921 | 204 742 | 20,0 | 314 663 |
| 1,00 | −0,0079 | 0 | 0 | 111 661 |

(La Réunion, crop posé, 31 000 m, 1 280×800, A/B au GPU dans la même session,
`readPixels` après `composer.render`, phase du grain remise à 0 ; **témoin
0 px** et **retour au régime 0 px** sur tous les postes.)

## 2. LE « PARFOIS » — il n'est pas un aléa, c'est le bas d'une rampe

⚡ **L'estompage n'est plein qu'AU REPOS.** `branchement-crop.js` relaie
`estompage.poserRepos(true)` quand `veille-repos.js` a compté **30 images
calmes** ; sinon l'estompage retombe sur la rampe d'altitude
(`estompageTerre`, `ALT_ESTOMPAGE_DEBUT_M = 40 342,8 m` →
`ALT_ESTOMPAGE_FIN_M = 19 364,6 m`).

Relevé par image pendant un **simple zoom à la molette**, aucun réglage forcé,
`--scenario mouvement` :

| départ | estompage minimum | `uMerBord.fin` max | images sous l'estompage plein |
|---|---|---|---|
| 31 000 m | **0,295** | **+1,403** (2,4× la largeur du crop) | **178/180, 180/180, 140/180** |
| 55 000 m | **0,000** | **+1,992** (la calotte entière) | **180/180, 180/180** |

➡️ **« La mer prend beaucoup plus que la taille du crop »** = la rampe entre
0,3 et 1 : à chaque geste. **« Parfois ne se crope pas du tout »** = le
**zéro** de cette rampe, atteint dès qu'on bouge au-dessus de ~40 km — et D21 ①
laisse justement le crop vivre là-haut, puisque sa mort demande une intention.

⚠️ **ET IL Y AVAIT UN SECOND CHEMIN VERS LE MÊME ZÉRO, CELUI QUE LE BRIEF
DÉCRIVAIT.** `_majBordMer` lisait :

```js
const estompage = u.uEstompageOn.value > 0.5 ? u.uEstompage.value : 0
```

**L'interrupteur ÉTEINT valait « planète entière », donc « mer jusqu'au bord de
la calotte ».** Or `retirerCrop()` appelle `retirerEstompage()`, qui remet
`uEstompageOn` à **0** — relevé sur la page vivante : après un `enterOrbit`,
`estompageOn 0` et `veilleEstompage.valeur 0`. Et la veille, elle, **n'appelle
`appliquer` que lorsque la valeur POSÉE change** : un crop reposé derrière un
interrupteur éteint, sur une valeur d'estompage inchangée, gardait donc une
nappe **non découpée** sur un socle **parfaitement découpé** — l'uniforme
d'emprise « posé une seule fois par valeur » du brief. Les deux tuiles et la
mer lisaient le même uniforme éteint et en tiraient des conclusions
**opposées** : `globe.js:1908` prend `1.0` (le crop seul), `_majBordMer`
prenait `0` (la planète entière).

**Le correctif ferme les deux chemins d'un coup** : la mer ne lit plus
l'estompage du tout.

## 3. LE CORRECTIF — trois endroits, aucune loi nouvelle

1. **`src/monde/mer-sphere.js`** — `bordDeMer()` **ne prend plus aucun
   paramètre** et rend toujours l'emprise du socle :
   `fin = −RETRAIT_EAU_CROP`, `debut = fin − RETRAIT_EAU_CROP`.
   C'est **exactement** ce que l'ancienne loi rendait à estompage plein, au bit
   près : le retrait de `plinth.js`
   (`rayonEauDansSocle = HALF − SOCLE_CHANFREIN − SOCLE_MARGE_EAU`), gardé.
   `FRACTION_BANDE_BORD` est retirée — sans anneau extérieur, elle ne module
   plus rien, et une constante que le corps n'atteint plus est la constante
   morte que ce chantier a déjà trouvée cinq fois.
2. **`src/globe.js`, `_majBordMer`** — ne lit plus `uEstompage` ni `portee`.
3. **`src/globe.js`, `poserEstompage` / `retirerEstompage`** — ne rappellent
   plus `_majBordMer`. ⚠️ **Retirer l'appel est ce qui PROUVE l'indépendance** :
   le laisser rendrait la dépendance invisible mais vivante. `poserMer` reste
   le seul appelant.

**La superellipse n'est pas retouchée.** Le fragment mesure toujours `dBord`
avec `uCropCoin` / `uCropCoinN`, c'est-à-dire **la même mesure que le `discard`
des tuiles** — c'est elle qui fait coïncider le bord de la nappe et le bord du
socle, structurellement, sans un pixel d'écart à mesurer.

⛔ **Rien n'a été touché de ce qui ne m'appartenait pas** : ni `dedansCrop()` /
`poserRegimeCrop()` (wt-z10), ni l'alignement des deux Terres (wt-mix), ni le
tri hors crop de `globe.js` (wt-cull).

## 4. LA GÉOMÉTRIE — pourquoi je NE la réduis PAS, et le chiffre

La calotte garde `PORTEE_CROP = 3` : **37 249 sommets, 73 728 triangles**,
3 largeurs de crop, 9× la surface du socle. Après le correctif, **~21,6 %** de
sa surface projetée est encore peinte (111 670 sur 517 270 px au poste mesuré) ;
le reste sort par le `discard` de bord, qui est **la première chose que fait le
fragment**, avant l'écume, le bruit et le Fresnel.

⚠️ **La réduire n'est pas un réglage isolé, et c'est la raison de ne pas y
toucher ici.** `portee` sert à TROIS choses à la fois dans `poserMer` :
l'emprise sur laquelle `_cuireChampMer` cuit le champ (donc la distance au
rivage, donc le ressac de côte), la normalisation `champ.unite` du canal G, et
`champ.profMaxCropM` qui ancre le budget du fond — c'est-à-dire **la couleur de
la mer**. La rétrécir déplacerait le turquoise d'Adrien ; c'est exactement la
régression qu'il a déjà signalée une fois. Le débordement était un défaut de
**découpage**, il se corrige dans le découpage.

➡️ **À donner à qui reprendra la perf** : à `portee = 3`, le champ de 385²
nœuds ne consacre que ~1/9 de ses texels au crop lui-même. Une portée plus
serrée **améliorerait** la finesse du ressac autant qu'elle économiserait des
sommets — mais elle change la couleur, donc elle demande l'œil d'Adrien.

## 5. LA MER RESTE BELLE — la preuve, et elle est structurelle

**La valeur posée est celle que l'ancienne loi posait à estompage plein, au bit
près.** Au repos — l'état dans lequel Adrien juge son image — **l'image est donc
identique par construction**, et le test ⑪b verrouille cette valeur.

Mesuré, et pas seulement raisonné : à estompage 1, l'A/B « vivant contre
découpage idéal » rend **0 px avant comme après**, et la silhouette de la nappe
vaut 111 661 px avant / 111 670 px après (l'écart est la phase de houle entre
deux sessions, sous le bruit que PF3 §4 documente).

Captures, `.banc/MER/pour-adrien/` (rendues au GPU, dans la même tâche que le
`composer.render` — voir §7.2) :

- `1-AVANT-en-mouvement.png` — estompage 0,22 : **le voile bleu couvre tout le
  cadre**, l'affiche est délavée, le socle flotte dedans.
- `2-APRES-en-mouvement.png` — même pose, même estompage : l'affiche est nette,
  la mer s'arrête au socle. **Houle, écume de côte, dégradé de lagon,
  réfraction : tout est là**, au bit près de l'image de repos.
- `3-AVANT-au-repos.png` / `4-APRES-au-repos.png` — le témoin : rien n'a bougé.

## 6. LES TESTS — ils rougissent sans le correctif

Inscrits dans `test/mer-sphere.test.js` (déjà dans la liste explicite de
`package.json` ; `audit:tests` **261 = 261**, aucun fichier neuf) :

| test | ce qu'il ferme |
|---|---|
| ⑪b | la mer s'éteint à `−RETRAIT_EAU_CROP`, DEDANS |
| ⑪c | **la mer ne déborde jamais** — porte les chiffres du §1 et rejoue la loi d'avant en témoin |
| ⑪d | `bordDeMer` **n'a plus aucun paramètre** — lecture de SIGNATURE et de CORPS, plus le comportement sous 10 entrées de bruit |
| ⑪e | la bande de fondu vaut le retrait, strictement positive (pas d'arête dure), et garde le témoin de 0,44 unité de P4 |
| ⑪h | `poserMer` pose le bord au socle **interrupteur d'estompage ÉTEINT**, et les quatre estompages ne le bougent plus d'un bit |
| ⑪h bis | **lecture de source** : `_majBordMer` ne lit plus `uEstompage`, `poserEstompage`/`retirerEstompage` ne l'appellent plus |

**Sans le correctif : 6 rouges** (rejoué par `git stash` sur les seuls fichiers
de `src/`). Avec : `test/mer-sphere.test.js` 109 · 0, `test/ecume-mer.test.js`
53 · 0.

⚠️ **Les 5 échecs de `npm test` sont `test/pdf-affiche.test.js`, et ils sont
PRÉEXISTANTS** — vérifiés sur l'arbre remisé, avant toute modification de ma
part : 29 tests, 24 passent, 5 échouent. Je ne les ai pas touchés et je ne les
maquille pas.

## 7. CE QUE J'AI CRU, PUIS RÉFUTÉ

1. **« Le défaut est intermittent, donc il y a une course ou un ordre »** —
   non. C'est une **rampe continue** : l'estompage vaut 1 au repos et descend
   dès qu'on bouge. Le « parfois » d'Adrien décrit fidèlement ce qu'il voit
   (tantôt cropé, tantôt pas), mais la cause n'a rien d'aléatoire. J'ai perdu
   trois relevés à chercher une course : mes trois premiers postes rendaient
   **0 px** parce que `porter()` attend 2,5 s — c'est-à-dire qu'il attendait
   pile le repos, l'état où le défaut n'existe pas. **Une sonde qui laisse la
   vue se calmer efface le défaut qu'elle cherche.**
2. **« Une capture d'écran de la page montrera le débordement »** — non.
   `page.screenshot` prise après le relevé m'a rendu **trois images
   identiques** pendant que les pixels annonçaient 40 % d'écart : sans
   `preserveDrawingBuffer`, elle lit un tampon déjà recomposé par la boucle
   rAF. L'image se prend **dans la même tâche** que le `composer.render`
   (`toDataURL` juste après). C'est le même piège que « lire la trame
   composée », par l'autre bout.
3. **« C'est `poserMer` qui retombe sur `porteeHorizon` »** — plausible (le
   défaut par défaut du paramètre `portee` est bien l'horizon géométrique,
   `globe.js:6282`), et **faux** : `main.js` passe `portee: PORTEE_CROP`
   explicitement (`contexteCrop`, `mer.portee`). Vérifié sur la page vivante,
   `_merEtat.portee = 3` à tous les postes. Le trou n° 3 de la Tâche J est
   bien fermé ; c'est le fondu qui ne l'était pas.
4. **« `retirerCrop` efface `uEstompageOn` derrière le dos de la veille, donc
   la mer reste non découpée pour toute la session »** — le mécanisme est
   **réel** (§2, mesuré : `estompageOn 0` avec `veilleEstompage.valeur 0` après
   un `enterOrbit`), mais je n'ai pas su le **faire tomber sur un crop posé** :
   `decider` nourrit l'estompage **avant** `poserTout`, donc l'interrupteur est
   rallumé avant la naissance de la nappe. Je l'écris comme un chemin fermé par
   le correctif, **pas comme la cause démontrée** — la cause démontrée est la
   rampe.
5. **« `gotoCtl.go(lieu)` place la sonde »** — non, et ça m'a coûté un banc
   entier. `go` prend des **coordonnées**, pas un nom ; et surtout il passe par
   `modes.flyTo`, le chemin que PF3 §7.4 a mesuré à **NaN**. Après un `go`, la
   nappe rend **0 pixel** à toutes les altitudes : **45 postes de « 0 px hors
   emprise » qui ne prouvaient rien.** D'où le garde-fou « ⚠️ AUCUNE MER À
   L'ÉCRAN — poste non probant » que la sonde imprime désormais.
6. **« Un relevé pris juste après la pose est comparable »** — non. À Majorque,
   A et B sont tombés de part et d'autre d'une **repose de la mer** : le A/B
   rendait 15 938 px « hors emprise » **avec le correctif**, c'est-à-dire
   exactement la silhouette entière — la nappe avait disparu entre les deux
   captures, pas débordé. La sonde attend maintenant que `_merEtat` et le
   nombre de tuiles ne bougent plus **deux relevés de suite**.
7. **« Mes scripts d'édition écrivent ce que je crois »** — non : un
   `open(p,'w')` de Python sous Windows a converti **tout `globe.js` en CRLF**,
   et **11 tests de lecture de source** ont rougi pour ça, dans des fichiers
   que je n'avais pas touchés. Le brief le disait ; je l'ai payé quand même.
   Relu à l'octet depuis : `CR = 0` sur les cinq fichiers.

## 8. À DONNER AUX AUTRES

- ⚡ **UN DÉFAUT QUE JE N'AI PAS CORRIGÉ, ET QUI N'EST PAS LE MIEN** : au
  démarrage par **lien profond** (`#s=` avec `loc`), le champ de la mer est cuit
  **VIDE** — `_merEtat.profMaxUnites = 0.000001` (le plancher) avec
  `couverture: 1` et `bathy: true`, à **quatre lieux sur quatre** (Majorque
  nord, baie de Palma, pointe de Bretagne, La Réunion). La nappe rend alors
  **0 pixel** : il n'y a pas de mer du tout. Au démarrage **sans hash**, au même
  lieu, la mer est là (111 670 px). Reproductible en 30 s avec un
  `#s=<base64url({loc:{lat,lon,zoom}})>`. **C'est ce qui m'a empêché de tenir
  les trois lieux du critère** : je n'ai pu mesurer qu'à La Réunion (île isolée,
  côte est découpée), et je préfère le dire que rendre huit zéros tautologiques.
- **wt-z10** : le prédicat `dedansCrop()` n'est pas touché. Mais le tableau du
  §2 dit une chose qui vous concerne : **le crop vit couramment au-dessus de
  40 km** (D21 ①), altitude à laquelle l'estompage vaut **0**. Tout ce qui
  déduit « on est au bloc » de l'estompage se trompera là.
- **wt-mix** : la nappe ne dépend plus de l'estompage — un fondu entre les deux
  Terres peut désormais bouger `uEstompage` **sans déplacer la mer**.
- **La sonde est rejouable** : `node scripts/sonde-mer-crop.mjs --port 8321
  --scenario estompage|mouvement|poses|intermittence`. Les quatre scénarios,
  leurs pièges et leurs garde-fous sont dans son en-tête.

## 9. COMMITS (branche `bug-mer-crop`, au-dessus de `adefdb5`)

- « La mer ne suit plus l'estompage : elle suit le socle » —
  `mer-sphere.js` (`bordDeMer` sans paramètre, `FRACTION_BANDE_BORD` retirée),
  `globe.js` (`_majBordMer`, `poserEstompage`, `retirerEstompage`),
  `test/mer-sphere.test.js` (⑪b à ⑪h bis), `test/ecume-mer.test.js`,
  `scripts/sonde-mer-crop.mjs`, et ce rapport.
