# Tâche J — LA SURFACE PLEINE

**Statut : DONE_WITH_CONCERNS.**
Les **trois trous nommés sont fermés et mesurés dans l'application vivante**. Le quatrième
point (la marge d'une tuile de `reserverHauteurs`) est **non régressé, vérifié à l'écran**.
**Mais le résultat à l'écran n'est pas encore celui du socle**, et le §6 dit exactement
pourquoi, avec le protocole d'élimination qui l'a établi.

- Base : `700df5e` · branche `regroupement`
- `npm test` **3 644** (3 628 avant, **+16**) · `npm run audit:tests` **201/201** ·
  `node --check` sur les sept fichiers touchés · arbre propre après commit
- Captures : `.banc/vues-J/` (**23 images**, dont `J-final-17/18` prises APRÈS le commit, page
  rechargée) · relevés bruts : `.banc/vues-J/J-releves-bruts.json`
- Mutation : **20/20 tuées**, plus une 21ᵉ (`M21`) sur l'appelant oublié → tuée

> ⚠️ **TOUS LES CHIFFRES DE CE RAPPORT SONT LUS DANS L'APPLICATION QUI TOURNE**, par
> `window.__exp`, et sont dans `J-releves-bruts.json`. Aucun n'est recopié d'un test, d'un
> commentaire ou d'une tâche précédente. Deux monnaies apparaissent et sont nommées à
> chaque fois : les **demi-côtés de crop** (la mesure de la découpe, `0` = sa frontière) et
> les **mètres**.

---

## 0. Tour 1 — ce que la relecture a corrigé ici

`relecture-J.md` a posé un ⛔ Critique et deux ⚠️ Important, tous trois traités dans cette
reprise (les deux mineurs sont différés, sur consigne) :

- ⛔ **§1 corrigé, pas juste noté.** La phrase « la texture que le GPU échantillonne dit la
  même chose » était présentée comme une preuve indépendante côté GPU ; ce n'en est pas une
  — `champ.texture` relit le même `Uint16Array` que le calcul JS, sans clone, et aucun chemin
  de relecture GPU n'existe dans ce dépôt pour la mer. **Retirée, remplacée par ce qu'elle
  prouve réellement** (le tableau source est bon) : voir l'encart de correction au §1.
- ⚠️ **Le trou dormant est couvert.** `flux-terrain.js:458` (priorité `9e8`/`1e9` entre
  tuiles de mer et tuiles de bloc) a désormais son test, vérifié tueur dans un `git worktree`
  isolé. Voir le §8 ter.
- ⚠️ **Le script de mutation original reste introuvable** (scratchpad de session d'un agent
  précédent, disparu). Non récupérable — voir le §8 ter, qui explique aussi ce qui a pu être
  refait malgré ça, avec son protocole dans `.banc/mutation-J-tour1.md`.

⚠️ **Rappel de contexte, absent du corps du rapport ci-dessous** (écrit à `de51c53`,
avant que la Tâche J bis ne porte la bathymétrie dans la surface du crop, par-dessus ce
travail) : la base actuelle de la branche est `a5b188e`, à **3 683** tests. Cette reprise
n'y ajoute qu'**un seul test ciblé** (§8 ter) : `npm test` **3 684** (3 683 avant cette
reprise, **+1**) · `npm run audit:tests` **202/202** (inchangé — aucun poste neuf) ·
aucun fichier interdit touché.

---

## 1. Trou n° 1 — la bathymétrie n'était jamais demandée

`contexteCrop()` passe désormais `remplir` à `poserMer`, et c'est `remplirHauteurs` du flux —
donc `fuseBathymetry` sur l'emprise entière, en une passe.

**L'obstacle écrit dans `main.js:4688-4696` était réel** : `demanderEmprise` REMPLACE
`gardeHauteurs` à chaque appel (« un seul flux par globe »), donc un second appel pour la
mer aurait repris au bloc ses réservations. **La sortie n'est pas un second appel, c'est une
seule réservation qui connaît les deux emprises** : `demanderEmprise` est élargie d'un
`aussi` dont le défaut `null` reproduit le dépôt au bit près (patron de `distanceRivage`,
Tâche F). Les **deux** appelants de `main.js` le passent — celui des deux qui l'oublierait
annulerait par image les tuiles de l'autre, et un test le défend (`M21`, tuée).

Mesuré à La Réunion, z12, même caméra, `.banc/vues-J/J-avant-01-temoin.png` contre `J-apres-01.png` :

| | portée (demi-côtés) | couverture du champ | `bathy` |
|---|---|---|---|
| avant (arguments d'avant la Tâche J, reposés à la main) | **29,39** | **0,0125** | **false** |
| après | **3** | **1** | **true** |

Le champ lui-même, relu dans l'application sur les 148 225 nœuds : **0 manquant**,
**97,6 % sous le niveau de la mer**, **0 % de zéro exact**, **min −4 970 m**, max 2 975 m
(le Piton des Neiges culmine à 3 070 m ; 2 975 m est le nœud le plus proche de la grille
de 384).

> ⚠️ **CORRECTION — tour 1 (voir `relecture-J.md`, Critique n°1).** La phrase originale ici
> disait « la texture que le GPU échantillonne dit la même chose », relevé à 0,976 d'eau et
> min −0,2184 unité, présentée comme une preuve **côté GPU**, indépendante du calcul JS.
> **C'est faux, et je le retire au lieu de le laisser.** `_cuireChampMer` construit
> `champ.texture` par `new THREE.DataTexture(demi, cote, cote, …)` (`src/globe.js:2337-2340`) :
> `demi` EST le `Uint16Array` que le calcul JS de couverture/bathy vient de remplir —
> `THREE.DataTexture` ne clone rien, `texture.image.data === demi`. « Décodé dans la page »
> relisait donc ce même tableau, pas un échantillonnage GPU indépendant : `window.__exp`
> n'expose aucun chemin de relecture GPU pour la mer, et l'unique `readRenderTargetPixels`
> du dépôt (`src/main.js:8965`) sert une sonde matérielle sans rapport
> (`sonderMateriel`). **Ce que la mesure prouve réellement : le tableau source que le
> nuanceur va lire est bon** (0,976 d'eau, min −0,2184 unité, cohérent au bit près avec les
> 148 225 nœuds relevés côté JS ci-dessus) — ce qui est déjà beaucoup, et suffit à établir
> que `_cuireChampMer` n'a pas silencieusement tronqué ou décalé la donnée avant l'upload.
> **Ça ne couvre pas un défaut d'upload silencieux** (format, filtrage, alignement de
> texture) : seul un vrai `readRenderTargetPixels` sur un rendu qui échantillonne
> `champ.texture` le ferait, et ce chemin n'existe pas dans ce dépôt. Les captures finales
> (`J-apres-01.png`, `J-final-17-apres-commit.png`) montrent un dégradé de profondeur
> cohérent en mer, ce qui corrobore *indirectement* que la donnée est bien montée au GPU —
> mais ça ne remplace pas la preuve que la phrase retirée prétendait apporter.

⚠️ **La nappe bathymétrique est ASYNCHRONE, et sans un refus la première cuisson serait la
dernière.** `poserMer` gagne donc `couvertureMin` et `exigerBathy`, **tous deux à leur
valeur du dépôt par défaut** (`0` et `false`). `remplirHauteurs` rend désormais un `bathy`
qui dit si la fusion a réellement eu lieu ; un `remplir` muet garde le `true` optimiste
d'avant. Relevé au cran : `refus: ['mer']` à l'instant du cran, `[]` après 1 s — c'est la
reprise de `branchement-crop.js` qui rejoue le maillon `mer` seul, comme prévu.

⚠️ **`exigerBathy` ne s'exige que tant que la nappe n'est pas RÉGLÉE.** Une nappe vide est
le cas normal (« on ne cuit pas de tuile là où il n'y a pas de mer ») : l'exiger au-delà
ferait boucler la reprise pour toujours à Chamonix, en recuisant un champ de 385² toutes
les trente images.

## 2. Trou n° 2 — le champ n'était rempli qu'à un seul zoom

`zoomPourEmprise(emprise, { zoomMax, tuilesMax })` (`flux-terrain.js`) rend **le zoom le
plus fin dont le rectangle de tuiles tienne dans le budget**. Le budget est **25**, et c'est
le chiffre de la Tâche F (« z10 en couvre 100 % pour 25 tuiles »). `main.js` s'en sert pour
l'emprise de la mer, et le passe en `aussi`.

Relevé vivant : `gardeHauteurs` compte **34** clés (le bloc + sa marge d'une tuile + les
tuiles de la mer, dédoublonnées) et `tuilesAvecHauteurs()` en rend **37**.

⚠️ **`flux.demande.zoom` reste celui du BLOC** — `zoomEffectif` s'en sert pour dire ce que
le socle couvre, et y glisser le zoom (plus grossier) de la mer rendrait un socle
« complet » qui ne l'est pas. Mutation `M11`, tuée.

## 3. Trou n° 3 — la mer débordait, et l'estompage ne la touchait pas

Deux gestes, et **la géométrie ne bouge plus** :

- **La portée est bornée à `PORTEE_CROP = 3`**, c'est-à-dire **l'emprise 3×3 du mode plat**
  (`mer-emprise.js` cuit son champ sur `168 = 3 × 56`). La calotte couvre
  `u ∈ [−portée, +portée]`, soit *portée* largeurs de crop : 3 est exactement cette
  emprise-là. Relevé : **29,39 demi-côtés avant, 3 après** — sur un bloc de 13,7 km de
  large, c'est **200 km de mer flottante qui disparaissent**.
- **Le fondu du bord suit l'estompage**, dans le fragment, sur **la mesure de la découpe
  elle-même** : `uCropCoin` et `uCropCoinN` étaient **déclarés dans `MER_FRAG` et lus par
  personne** depuis la Tâche F — deux uniformes morts, exactement ce que le §Q traque. Ils
  portent maintenant le bord. Un `max(|u|,|v|)` aurait laissé la mer déborder aux quatre
  coins arrondis (mutation `M20`, tuée).

La loi (`bordDeMer`, pure, `mer-sphere.js`), relevée dans l'application :

| estompage | `uMerBord` (demi-côtés depuis la frontière du crop) |
|---|---|
| 0 (planète entière) | `[1 ; 2]` — la mer va au bord de la calotte |
| 0,25 | `[0,75 ; 1,5]` |
| 0,6 | `[0,4 ; 0,8]` |
| 0,633 (relevé réel à 26 166 m) | `[0,3666 ; 0,7332]` |
| 1 (il ne reste que le crop) | `[0 ; 0,00786]` — la mer s'arrête **au bloc** |

Le plancher `0,00786` n'est pas choisi : c'est le retrait d'eau du mode plat
(`rayonEauDansSocle = HALF − SOCLE_CHANFREIN − SOCLE_MARGE_EAU`, soit `0,22` unité sur un
demi-côté de 28), converti. **`plinth.js` n'est pas importé — il tire three.js — mais il
est RELU SUR LE DISQUE par le test ⑪a**, comme `mer-emprise.test.js` le fait déjà pour
`CHAMP_RES`. La seule valeur qui reste un choix est `FRACTION_BANDE_BORD = 0,5`, et elle
est écrite comme tel.

## 4. Le quatrième point — `reserverHauteurs` : NON RÉGRESSÉ

La marge de `D = 5/6` est intacte, et la preuve est à l'écran, pas dans le code :
**`veilleCrop.refus` vaut `[]`** en régime établi, aux deux zooms testés. Les parois et la
rampe ne refusent plus pour couverture ; la couverture ne plafonne pas à 0,552.

## 5. Le drapeau baissé — le mode plat est intouché

`http://localhost:5503/?globe=continu&socle=quadtree&f3=0&frontiere=1&seuil=1`, page
chargée jusqu'au bout, **aucune exception** : `terreUniqueBranchee false` ·
`veilleCrop.pose false` · `globe._mer` absent · `uCropOn 0` · `uEstompageOn 0` ·
`uMerRampeOn 0` · `terrain.mesh.visible true`. Capture :
`J-drapeau-baisse-mode-plat.png` — et **c'est la référence**, voir le §6.

`terrain.js`, `plinth.js`, `ocean.js` **ne sont pas modifiés**. Les trois élargissements de
fichiers partagés (`demanderEmprise.aussi`, `remplirHauteurs.bathy`,
`poserMer.couvertureMin`/`.exigerBathy`) ont **tous un défaut qui reproduit le dépôt**, et
chacun a son test de non-régression du défaut.

---

## 6. CE QUE JE VOIS À L'ÉCRAN — et non, ça ne ressemble pas encore au socle

**Ce qui est réparé se voit.** L'aplat gris a disparu : `J-avant-01-temoin.png` montre une
nappe blanchâtre sans fond **et une seconde nappe détachée qui flotte à gauche du bloc,
hors de lui** ; `J-apres-01.png` montre une mer bleue, avec du relief de fond, qui s'arrête
sur le bloc. Le bord suit l'estompage sans arête : à estompage 0,6 la mer déborde d'un peu
moins d'un demi-côté et s'éteint en rond (`J-apres-estompage-0p6.png`).

**Ce qui ne va pas, et c'est le défaut dominant maintenant.** Au-dessus d'environ 20 km, la
mer ne se lit pas comme une nappe mais comme **un marbrage de taches bleues et vertes**
(`J-apres-13-retour-z12.png`, `J-temoin-12-avec-mer-estompage1.png`). J'ai cherché la cause
par élimination plutôt que par lecture :

1. **Mer CACHÉE, estompage forcé à 1** (`J-temoin-11-fond-du-crop-estompage1.png`) : le fond
   du crop est **un plateau vert uniforme**. La *surface* du crop ne porte aucun fond marin.
   `globe.hauteurSurface` en mer rend **0** en deux points sondés sur quatre, **−273 m** au
   troisième.
2. **Houle et clapot mis à zéro, tout le reste identique** (`J-diag-15-houle-eteinte.png`) :
   **le marbrage disparaît entièrement**. La mer redevient une nappe continue qui s'arrête
   proprement sur la superellipse du crop.
3. **Houle rallumée** (`J-diag-16-houle-rallumee.png`) : il revient.

**La cause est donc établie, pas supposée : les creux de houle passent DERRIÈRE le fond
marin.** L'amplitude verticale relevée est de **73 m** (`uMerHoule 0,5` × `uMerLambda
0,006443` unité, exagération 2,8) ; le fond marin du crop est rendu **à l'altitude zéro**,
parce que `_buildMesh` écrête les hauteurs du globe à zéro et que les tuiles n'ont pas de
bathymétrie. Le test de profondeur supprime tout ce qui descend sous zéro, et c'est ce
plateau vert qui apparaît dans les creux. Le critère de déferlement du nuanceur
(`cap = 0.78 · vProfondeur`) est *juste* — il borne le creux à 78 % de la profondeur du
CHAMP —, mais le sol dessiné n'est pas à cette profondeur-là.

⚠️ **Autrement dit : le champ de la mer a un fond, la SURFACE du crop n'en a pas, et c'est
ce désaccord que l'écran montre.** `J-drapeau-baisse-mode-plat.png` dit à quoi ça ressemble
quand les deux s'accordent : en mode plat, le MNT lui-même est fusionné avec la
bathymétrie (`loadDem`), et la mer y est une eau turquoise sur un fond lisible.

**Je n'ai pas corrigé ça, et je dis pourquoi plutôt que de bricoler.** Les trois sorties
possibles sont toutes hors du périmètre nommé de cette tâche :
- donner la bathymétrie aux TUILES (c'est-à-dire à `_buildMesh` et au chemin de texture du
  globe) — c'est un chantier, et il touche un chemin partagé avec `?globe=continu` ;
- couper la houle du crop — ce serait annuler un livrable de la Tâche F sans mesure ;
- passer la mer en `depthTest: false` en faisant du champ la seule autorité — une ligne,
  mais elle laisserait la mer lointaine repeindre par-dessus le volcan aux angles rasants,
  et je n'ai pas mesuré ce cas.

**C'est, à mon avis, la tâche à faire tout de suite après celle-ci** — et sans elle, une
rampe ou un morphing plus beaux ne changeront pas ce qu'on voit.

**Deux autres choses vues au passage, hors périmètre :**
- **Les jupes pendent sous le bloc** (`J-apres-01.png`, sous la base) — déjà au catalogue de
  la Tâche Q.
- **La mer est presque d'un seul bleu** même avec le champ complet : `budgetProfondeurM`
  vaut **1 537 m** ici et le glacis de lagon ne court que sur ses 15 % premiers, or **96 %
  du champ est plus profond que 1 000 m**. Le fond EXISTE dans la donnée et dans la loi ;
  il ne se lit presque pas dans cette gamme de profondeur. C'est un réglage de rampe
  (Tâche P2), pas un trou.

---

## 7. Ce qui a été écrit

| fichier | ce qui change |
|---|---|
| `src/monde/mer-sphere.js` | §⑦ neuf : `PORTEE_CROP`, `RETRAIT_EAU_CROP`, `FRACTION_BANDE_BORD`, `bordDeMer` (pur) |
| `src/monde/flux-terrain.js` | `zoomPourEmprise` (neuf) · `demanderEmprise` élargie d'`aussi` · `remplirHauteurs` rend `bathy` |
| `src/globe.js` | `MER_FRAG` : `uMerBord` + le fondu sur la superellipse · `poserMer` : `couvertureMin`, `exigerBathy`, champ cuit AVANT la calotte · `_majBordMer`, rappelé par `poserEstompage`/`retirerEstompage` · `_cuireChampMer` croit le `bathy` de `remplir` |
| `src/main.js` | `assietteCrop` extraite · `empriseZoomMer` · `fluxMerPret` · `contexteCrop().mer` reçoit `remplir`/`portee`/`couvertureMin`/`exigerBathy` · les deux appelants passent `aussi` |
| tests | `mer-sphere` ⑪a–⑪j (10) · `flux-terrain` (5) · `fenetre-branchee` ⑩h resserré sur les deux appelants |

## 8. La campagne de mutation, et pourquoi elle n'est pas dans un worktree

**20 mutations, 20 tuées, 0 survivant** — plus `M21` (l'appelant qui oublie `aussi`), tuée
aussi. Le script est laissé sur le disque :
`…/scratchpad/mutations-J.py`. Chacune change le **comportement** : sens de l'estompage
inversé, plancher du bord à zéro, bande de largeur fixe, portée remise à l'horizon, retrait
désaccordé de `plinth.js`, boucle de zoom inversée, budget compté sur les colonnes seules,
`aussi` ignoré, `aussi` réservé mais pas demandé, zoom demandé remplacé par celui de la
mer, `bathy` toujours vrai, refus retiré, refus sans la bathymétrie, `bathy` optimiste,
bord non recalé par `poserEstompage`, bord non posé à la cuisson, valeur neutre inversée,
alpha sans le bord, superellipse remplacée par un carré.

⚠️ **EN PLACE, AVEC SAUVEGARDES OCTET PAR OCTET, PAS DANS UN `git worktree`** — et c'est
délibéré : `core.autocrlf` a déjà rendu de faux survivants à quatre agents de ce chantier.
Un aller-retour d'octets ne retraduit aucune fin de ligne, et l'arbre testé est **celui qui
tourne**. L'arbre a été vérifié identique après chaque mutation.

⚠️ **ET LE PIÈGE DE FIN DE LIGNE M'A QUAND MÊME ATTRAPÉ, AILLEURS.** `flux-terrain.js` est
le **seul fichier LF du lot** ; un outil d'édition l'a réécrit en CRLF, et `git diff`
annonçait **1 541 lignes changées pour 87 réelles**. Repéré par `git diff --ignore-cr-at-eol
--stat`, remis en LF avant le commit. **À vérifier après chaque édition dans ce dépôt** :
`git diff --stat` contre `git diff --ignore-cr-at-eol --stat`.

## 8 ter. Tour 1 — le script de mutation reste introuvable

⚠️ **Le chemin `…/scratchpad/mutations-J.py` cité au §8 vivait dans un scratchpad de
session d'un agent précédent, et il n'est pas accessible depuis cette reprise.** `find`
lancé sur tout le disque visible depuis `wt-merge` (racine, `/c/Users`, `C:\Dev`) ne rend
rien pour `*mutations-J*`. **Le « 20/20 tuées » du §8 reste donc, à ce jour, le seul chiffre
de ce rapport qu'on ne peut pas rejouer depuis le dépôt** — contrairement à tous les autres,
qui remontent à `J-releves-bruts.json` (committé) ou aux tests eux-mêmes (committés). Je ne
le retire pas (le relecteur n'a trouvé aucune raison de douter du chiffre lui-même, ma
propre campagne ciblée ci-dessous en confirme la méthode sur un cas précis), mais je ne peux
pas non plus l'étayer davantage : je le laisse marqué non rejouable.

**Ce que j'ai pu faire : rouvrir et refermer le trou dormant signalé par le relecteur**
(`relecture-J.md`, Important n°2 — retirer `secondes.has(t.key) ? 9e8 : 1e9` au profit de
`1e9` ne cassait aucun test). Un test dédié est ajouté à `test/flux-terrain.test.js`
(« la mer passe APRÈS le bloc dans la file : `9e8` contre `1e9` ») : il intercepte
`g._request` et compare, tuile par tuile, la priorité reçue selon qu'elle vient du bloc ou
de la seule emprise de la mer. **Vérifié tueur** dans un `git worktree` isolé
(`../wt-verif-J-tour1`, retiré en partant, comme la Tâche J bis l'a établi) : sous la
mutation exacte du relecteur, ce test — et lui seul — passe au rouge (24/25 sur le fichier,
`1000000000` reçu là où `900000000` était attendu) ; sur le dépôt intact, 25/25. Le
protocole est écrit dans `.banc/mutation-J-tour1.md`, **dans `.banc/` et non dans un
scratchpad de session**, conformément à la convention du chantier.

⚠️ **Page rechargée cette reprise, flag levé ET baissé, aucune exception.** Sandbox de
cette session sans route vers `s3.amazonaws.com` (`net::ERR_CONNECTION_TIMED_OUT` sur les
tuiles terrarium) : `veilleCrop.refus` reste bloqué sur `['fond','parois','rampe','mer']`
faute de hauteurs qui n'arrivent jamais, donc **le régime établi du §8 bis n'a pas pu être
revérifié à l'écran cette fois**. Ce que j'ai pu confirmer : `window.__exp` se peuple sans
throw sur les deux drapeaux (`terreUniqueBranchee: true` puis `false`, `meshVisible` cohérent
avec chacun), donc **aucune régression de démarrage** — et c'était tout ce qui pouvait
changer, puisque cette reprise ne touche aucun fichier source, seulement un test et des
documents. N'a pas été rejoué sur un réseau qui atteint AWS.

## 8 bis. La page rechargée APRÈS le commit

⚠️ **Refaite parce que les fins de ligne de `flux-terrain.js` ont été remises en LF après la
première session d'écran** — un fichier différent d'un octet est un fichier qu'on n'a pas
regardé. Rechargée sur le drapeau LEVÉ, `de51c53` : à la première image la chaîne refuse
`parois, rampe, mer` (l'application repart à 3 140 m, les tuiles ne sont pas là), **puis la
reprise fait son travail** — au régime établi, `refus: []`, `gardeHauteurs` 50,
`tuilesAvecHauteurs` 50, 0 tuile en vol, `portee 3`, `couverture 1`, `bathy true`,
`uMerBord [0 ; 0,0079]`. Captures `J-final-17-apres-commit.png` et
`J-final-18-apres-commit-sans-la-mer.png`.

## 9. Réserves

1. ⛔ **Le marbrage du §6** — le fond marin est dans le champ, pas dans la surface. Défaut
   dominant, cause établie par élimination, non corrigé, et je pense qu'il passe avant K.
2. ⚠️ **Le coût n'a pas été chronométré.** `aussi` ajoute des tuiles à la réservation (34
   clés relevées contre 25 attendues pour le seul bloc élargi) et la nappe bathymétrique est
   désormais cuite sur l'emprise de la MER, donc sur un rectangle plus large. **Aucune mesure
   de temps ni de mémoire n'a été faite** — c'est une lacune, pas un « c'est négligeable ».
3. ⚠️ **`COUVERTURE_MER_MIN = 0,99` n'est pas mesuré**, c'est un seuil posé. Il tient à
   l'écran (couverture relevée : 1,000) mais il n'a pas été éprouvé sur un réseau lent, où
   il pourrait faire boucler la reprise plus longtemps qu'il ne faut.
4. ⚠️ **Un seul lieu regardé** : La Réunion, aux zooms 10 et 12. Rien n'a été vu à haute
   latitude (où `largeurCropM` porte son `cos φ`), ni à cheval sur l'antiméridien, ni sur un
   crop entièrement continental — le chemin `exigerBathy` y est raisonné, pas observé.
5. ⚠️ **`uCoastMaskOn` du globe vaut 0** alors que `contexteCrop().habillage.coastMask`
   est non nul. Constaté en passant, pas creusé — ça pourrait être un maillon
   d'habillage qui ne transmet pas, et c'est du ressort de P2/P4.
6. ⚠️ **La bathymétrie du BLOC est maintenant cuite au zoom de la MER**, donc plus grossière
   au centre sous `?terre=unique`. Sans conséquence attendue (les sources bathy plafonnent à
   `BATHY_BASE_ZMAX = 8`), mais **non vérifié**, et ça touche `terrain.fenetreBornee.minM`,
   qui cale l'intervalle des courbes de niveau.
