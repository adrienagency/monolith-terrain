# Relecture — Tâche R1

**Arbre :** `C:\Dev\wt-merge`, branche `regroupement`, base `4cca4e7`.
**Relu :** `64c90db` (①) et `559a548` (②).
**Suite de tests rejouée :** 4 131 passent, 0 échec — le compte du rapport est exact.
**Mes traces :** `.banc/R1-relecture/` (8 captures PNG **sur le disque**, 8 relevés JSON,
`mutations.json`). Chaque chiffre de cette relecture y remonte.

**Conformité au brief : ✅**
**Qualité : à corriger** — trois constats Critiques, tous mesurés, aucun spéculatif.

---

## 0. Comment j'ai mesuré, et pourquoi ça change quelque chose

L'exécutant a travaillé à **10-25 images/s** parce que le panneau navigateur de
session ne compositait pas ; il a dû forcer le repli `setTimeout` et lever
l'étranglement des minuteries. **J'ai rencontré exactement la même panne** — le
panneau ne composite pas, `requestAnimationFrame` est gelé, la page reste sur
« generating terrain… ». Sa réserve 4 est donc **véridique et honnête**.

Mais elle était **évitable**, et c'est la première chose que je note : le dépôt
porte déjà le patron d'un Chrome sans tête piloté par CDP
(`scripts/sonde-demarrage.mjs`), et `puppeteer-core` est installé dans six arbres
voisins (`C:\Dev\wt-warm`, `wt-f3`, `wt-menage`…). J'ai donc mesuré dans un
**Chrome sans tête à 57,3 images/s** (`.banc/R1-relecture/chargement-propre-DISTANCE.json`),
sur des **chargements propres**, avec de **vrais** `PointerEvent` et `WheelEvent`,
et des **captures écrites sur le disque**. Ce chemin lève d'un coup les réserves
4 et 6 du rapport.

⚠️ **Cadence : sa précaution est-elle suffisante ?** Oui pour ①, et je l'ai
vérifié plutôt que supposé.

- L'orbite programmée **ne dépend pas de la cadence** (les poses sont posées à la
  main) : ce qui varie d'une mesure à l'autre, c'est l'amplitude par pas. D'où
  trois pics différents — `4,862 × 10⁻³` (brief), `1,03 × 10⁻²` (exécutant),
  **`4,60 × 10⁻²` (moi)** — et **le même verdict à chaque fois** :
  **39/39 images au-dessus du seuil pour l'altitude, 0/39 pour la distance**
  (`orbite-programmee.json` : distance `2,22 × 10⁻¹⁶`, soit le zéro de la
  machine). **Aucune décision ne repose sur le pic absolu.**
- La seule conclusion qui pourrait dépendre d'un absolu est celle du seuil (§3
  du module). Elle repose sur un **rapport à la même image** (`1,079`), qui est
  immunisé ; et la marge est de **66 ×** le seuil, très au-delà du facteur de
  cadence (2,4 ×). Elle tient à 60 Hz.
- La seule mesure réellement serrée est F (une image à `1,069 × 10⁻⁴`, soit
  `1,07 ×` le seuil, sur 156). À cadence plus haute cet écart **rétrécit** : la
  conclusion « la traversée ne coûte rien » ne peut que se renforcer. Sans
  danger.

**Verdict sur la réserve 4 : suffisante.** Aucune conclusion de ① ne dépend d'un
pic absolu.

---

## 1. ⚡ LE CHIFFRE DU DONNEUR D'ORDRE : `bascules = 46`

### Il est FAUX, et il doit être RETIRÉ — pas nuancé

L'exécutant a eu raison de ne pas le reproduire, et raison de n'en rien
conclure. Je vais plus loin que lui, parce que j'ai pu le trancher.

**a) Structurellement, « 46 au chargement » ne peut pas vouloir dire ce que le
brief lui fait dire.** `bascules` est un compteur **monotone qui n'est JAMAIS
remis à zéro** : `oublier()` ne touche que `precedente` et `calme`
(`src/monde/veille-repos.js`), et personne ne reconstruit la veille. Sa valeur
est donc **l'histoire entière de la session depuis le chargement de la page**.
Sur une page « déjà naviguée deux fois », ce n'est plus un témoin de chargement,
c'est un cumul.

**b) Mesuré, sur le code que le brief mesurait.** J'ai remis la veille sur
l'altitude (l'état d'avant `64c90db`) et rechargé proprement, à 56,9 img/s :

| moment | `bascules` (nourrie de l'ALTITUDE) | `bascules` (nourrie de la DISTANCE) |
|---|---|---|
| chargement + 1 s | 0 | 0 |
| + 2 s | 1 | 1 |
| + 8 s | **2** | **2** |
| + 12 / 20 / 30 s | **2** | **2** |

`.banc/R1-relecture/chargement-propre-ALTITUDE.json` et `-DISTANCE.json`.
**Deux. Exactement ce que la Tâche N attendait.** À une cadence deux fois plus
haute que celle de l'exécutant, et sur les deux grandeurs.

**c) L'explication proposée (« deux navigations, caméra qui a volé
automatiquement ») n'est PAS confirmée non plus.** Deux `modes.flyTo` complets
— surface → orbite → vol → replongée → surface — sur la version **altitude** :
`bascules` reste à **2**, avant comme après
(`.banc/R1-relecture/navigations-ALTITUDE.json`, journal des transitions de mode
à l'appui). C'est logique : `poserMode` appelle `repos.oublier()` **dans les deux
sens** et la veille n'est pas nourrie hors surface.

**Ce qui reste plausible**, et que je n'affirme pas faute de l'avoir mesuré :
une session interactive où l'utilisateur a fait ~22 glissements de souris, chacun
coûtant un aller-retour (+2) sous l'ancienne grandeur. 46 = 2 + 22 × 2. C'est une
hypothèse, pas un relevé.

➡️ **Le chiffre 46 n'est ni reproductible ni attribuable au chargement. Il doit
être retiré de `brief-R1.md` (§« Témoin annexe ») et de
`.banc/orbite-repos/mesure.json` (`temoin_annexe`)** — le vingt-septième. Cela
n'affaiblit en rien le diagnostic ① : celui-ci tient sur la mesure d'orbite, que
j'ai refaite et qui tient trois fois.

---

## 2. ① La grandeur du repos — vérifié, et il marche

### Le diagnostic est juste, et j'ai refait la mesure

`.banc/R1-relecture/orbite-programmee.json` — 40 poses, rayon tenu **exactement**
constant, chargement propre :

| grandeur | pic d'écart log | images au-dessus du seuil |
|---|---|---|
| altitude au-dessus de l'ellipsoïde | `4,60 × 10⁻²` | **39 / 39** |
| distance caméra → cible | `2,22 × 10⁻¹⁶` | **0 / 39** |

Départ identique au sien à quatorze chiffres (`alt 17760,56154321321`,
`dist 145,5`) : nous mesurons bien le même état.

### Et surtout : le geste d'Adrien, à la souris, à l'écran

`.banc/R1-relecture/ecran-relecture.json`, captures `10`/`11`/`12` :

| | altitude | distance | `auRepos` | `bascules` |
|---|---|---|---|---|
| vue posée sur le crop | 17 761 m | 145,50 | vrai | 2 |
| **après un cliquer-glisser** (30 `pointermove`, aucune molette) | **35 170 m** (× 1,98) | **145,50** | **vrai** | **2** |
| **après UNE molette de dézoom** | 35 784 m | 147,98 | faux puis vrai | **4** |

**L'altitude double, le repos ne bouge pas. Une molette le réveille et il
recroppe une fois.** C'est exactement la consigne d'Adrien, vérifiée sur de
vrais événements d'entrée. ✅

### Le seuil n'a pas bougé, et il ne devait pas

`SEUIL_BOUGE_LOG` vaut toujours `1e-4` — lu dans le fichier, et la mutation M8
(`1e-4 → 1e-3`) est **tuée**. La justification (rapport `1,079` à la même image,
54/54 contre 54/54) est tracée dans `.banc/R1/mesure-R1.json` (C) et son
raisonnement est correct : un rapport à la même image ne dépend pas de la
cadence. **Aucun nombre posé au jugé.**

### La discontinuité au cran : je ne l'ai PAS reproduite, et je ne la conteste pas

Les figures déclarées (cible qui saute de **13,25 unités**, distance `0,538`
contre altitude `0,364`) sont tracées dans `.banc/R1/mesure-R1.json` (D). **Mon
instrument n'a pas su capturer le transitoire** : la reprise de pose se joue
entre l'enregistrement de ma sonde `rAF` et son premier appel, et mes 340 images
autour du cran sont toutes identiques (`.banc/R1-relecture/cran-et-cine.json`).
Je n'ai donc **ni confirmé ni infirmé** ces trois nombres.

Ce que j'ai bien mesuré, et qui va dans son sens : **un cran coûte exactement un
aller-retour** — `bascules` passe de 2 à 4 en franchissant un cran, jamais plus.
Sa lecture (« un vrai positif plus gros, pas un réveil de plus ») est cohérente
avec ce relevé. La réserve est correctement écrite dans le §1 du module.

---

## 3. ② Les boutons du bas — son raisonnement est JUSTE, et les trois correctifs
sont NÉCESSAIRES

C'était la vérification prioritaire. **Il a raison sur toute la ligne, et il n'a
pas sur-corrigé.** Voici la preuve, chemin d'appel par chemin d'appel.

1. **`veilleSocle` n'applique jamais sous le drapeau.** `majSeuilSocle`
   (`src/main.js:4730`) sort par `return` à la fin de la branche
   `if (terreUniqueBranchee)`, **avant** `veilleSocle.maj()` (`main.js:4767`).
   `creerVeilleSocle` n'appelle `appliquer` que sur **changement** de `pose`
   (`src/monde/veille-socle.js:86-91`), et sous le drapeau `socleAuDepart` vaut
   faux, `poserMode` n'est pas appelée non plus (elle est hors de la branche).
   `pose` ne change donc **jamais**. ✅ **Corriger `poserVisibiliteSocle` seule
   ne pouvait rien changer à l'écran.** Le brief se trompait sur ce point.
2. **`masquerSocle` était le seul appelant**, et il passait toujours `false`
   (`branchement-crop.js:792`, une fois par entrée en surface). Sans le
   correctif ②, `poserVisibiliteSocle(false)` rend `boutons: false` : la loi
   corrigée n'y change rien. **Le correctif ② est donc indispensable au
   correctif ①**, et réciproquement.
3. **Le correctif ③ est indispensable aussi.** J'ai cherché tous les écrivains
   de la visibilité des trois boutons : `isoBtn`, `cineBtn` et `mapCorner` ne
   sont touchés **qu'aux lignes 4620-4622 de `main.js`**, nulle part ailleurs.
   Sans le relais dans `setSurfaceVisible`, **rien** ne les éteint à l'entrée en
   orbite. Et ce n'est pas une déduction : je l'ai **mesuré à l'écran** en
   supprimant la ligne — les quatre boutons restent `display:flex` en mode
   `orbital` (§5, mutation M5).
4. **Le choix du lieu est juste.** `modes.js` appelle `setSurfaceVisible` avant
   d'écrire `this.mode`, dans les deux sens : lire le mode depuis
   `poserVisibiliteSocle` rendrait l'état d'avant. Vérifié dans `src/modes.js`.

➡️ **Trois correctifs, trois nécessités. Aucune dette de sur-correction.**
C'est la réponse à la question prioritaire du brief.

### À l'écran, drapeau levé et baissé

`.banc/R1-relecture/boutons-drapeau-leve-et-baisse.json`, capture `10-surface-libre.png` :

| | surface | orbite | retour |
|---|---|---|---|
| **drapeau LEVÉ** | 4 boutons `flex`, `terrain.mesh.visible` **faux**, `labels` faux | 4 boutons `none` | 4 boutons `flex`, maillage toujours faux |
| **drapeau BAISSÉ** | 4 boutons `flex`, `terrain.mesh.visible` **vrai**, `labels` **vrai** | 4 boutons `none`, tout éteint | tout restauré |

**La garantie de production est tenue, et rejouée.** Elle est aussi structurelle :
les deux lignes ajoutées vivent dans `if (terreUniqueBranchee)`, et sans drapeau
`visibiliteSurface` rend le même booléen pour les deux réponses. Le seul écart
possible serait la coercition `!!surface` — sans effet, les appelants ne passent
que des booléens.

---

## 4. ⛔ CRITIQUE — le bouton ciné n'est PAS réversible, contrairement à ce qui est écrit

C'est le constat le plus grave de cette relecture, et il porte sur une phrase
écrite **dans le rapport, dans `.banc/R1/boutons-R1.json` ET dans `src/main.js`** :

> *« C'EST RÉVERSIBLE : `shots.stop()` — le huitième clic — rend la vue intacte
> (vérifié : la caméra revient à `y = 77,1`, distance 145,5). »*

**Deux sorties testées, deux fois, aucune ne rend la vue.**

| sortie | `camera.position.y` | altitude de cadrage | distance |
|---|---|---|---|
| avant le clic | 50,98 → 72,72 selon la pose | 12 451 → 17 761 m | 102,88 → 145,50 |
| pendant le premier plan | **−6,91 / −7,30** | **−1 688 / −1 784 m** | 12,5 |
| **après `shots.stop()`** | **−3,53** puis **−3,63** | **−862 / −888 m** | **12,52** |
| stable après stop | inchangé à 2, 4, 6 et 10 s, `tween` faux, `tour` faux | | |
| **après le huitième clic** (les 8 clics espacés de 2,5 s) | **20,52** | **5 010 m** | **29,95** |

`.banc/R1-relecture/aerien-et-cine.json`, `cran-et-cine.json`,
`ecran-relecture.json`, et la capture **`14-cine-apres-stop.png`** : la vue reste
**sous l'eau**, à l'intérieur de la mer du crop, indéfiniment.

**La cause qu'il a nommée est bonne** (`sampleGround` nourri de `terrain.sample`,
le champ de hauteurs du bloc plat), et son chiffre de plongée est exact à un
cheveu près : je relève `−1 688 / −1 784 m` là où il relève `−1 780 m`. **Mais sa
conclusion est fausse** : le bouton n'est pas « un clic pour rien, récupérable »,
c'est **un aller simple vers une vue inutilisable**, sans issue documentée.

➡️ **Arbitrage demandé : NON, ce n'est pas arbitrable en l'état. Il faut
éteindre `cineBtn` sous `?terre=unique`** jusqu'à ce que `shots` reçoive un
`sampleGround` de globe. Un bouton visible qui envoie l'utilisateur sous le sol
sans retour est une régression livrée, et « à trancher avec Adrien » ne
protège personne tant qu'il est cliquable.
➡️ **Et les deux nombres `y = 77,1` / `distance 145,5` doivent être RETIRÉS** du
rapport, de `boutons-R1.json` et du commentaire de `main.js`.

**Une nuance à sa décharge** : « écran entièrement vide » n'est pas ce que je
vois. Ma capture `13-cine.png` montre une vue **sous la surface de la mer**, pas
un écran vide — la différence tient sans doute au lieu. La partie qui porte la
décision (caméra sous le sol, stable) se reproduit exactement.

---

## 5. ⛔ CRITIQUE — deux mutations survivent, dont l'annulation complète du correctif ①

Campagne complète : douze mutations, chacune seule, suite **entière** rejouée à
chaque fois. Détail dans `.banc/R1-relecture/mutations.json`.

**Tuées (10)** — M1 (veille renourrie à l'altitude, 3 échecs), M2 (bornage du
socle retiré), M3 (les deux questions re-confondues — le défaut d'origine),
M4 (`masquerSocle` repassé à `false`), M6 et M7 (boutons raccrochés au maillage),
M8 (seuil × 10), M10 (deux Terres).

### ⛔ M9 SURVIT — et c'est le trou le plus grave

```js
function distanceCadrageM() {
  return camera.position.distanceTo(controls.target)   //  ← remplacé par…
  return altitudeCadrageM()                            //  …ceci
}
```

**4 131 tests passent, 0 échec.** Le correctif ① est **intégralement annulé au
point de mesure** et rien ne rougit. La raison est exactement celle que le brief
avertissait : le seul garde-fou côté `main.js` est une **expression régulière sur
le texte source** — `test/veille-repos.test.js` ⑨ vérifie que
`function distanceCadrageM()` existe et que `veilleCrop.maj(alt, dist)` est
écrit, **jamais ce que la fonction rend**. Le corps est libre.

**Ce que je propose** (deux options, la seconde est la bonne) :
1. minimum : que l'assertion lise aussi le corps
   (`/function distanceCadrageM\(\)\s*\{[^}]*camera\.position\.distanceTo\(controls\.target\)/`) —
   ça ferme cette mutation-ci, pas la classe ;
2. mieux : extraire la grandeur en fonction **pure**
   (`grandeurRepos({ position, cible })` dans `src/monde/`), testée par le
   comportement, `main.js` ne faisant plus que la câbler. C'est exactement le
   geste qu'il a su faire pour ② avec `visibilite-surface.js` ; il ne l'a pas
   fait pour ①.

### ⛔ M5 SURVIT — le correctif ③ de ② n'est gardé par rien

Supprimer `poserVisibiliteSocle(v)` de `setSurfaceVisible` : **4 131 passent,
0 échec**. Et la conséquence est visible : mesurée dans le navigateur, les
**quatre boutons du bas restent `display:flex` en mode orbital**. Trois correctifs
livrés, deux gardés.

### ⚠️ M11 et M12 survivent — les treize autres calques du socle ne sont gardés par rien

`labels.visible = vue.socle && …` → `vue.boutons && …` : vert.
`clouds.setVisible(vue.socle)` → `vue.boutons` : vert.

Seul `terrain.mesh.visible` est gardé (par `test/crop-branche.test.js` ⑧ quater).
Ce trou **préexistait**, mais le changement en **élargit la surface** : avant R1
il n'y avait qu'une variable `v` dans la fonction, il y en a maintenant **deux**,
et la mauvaise des deux rallume un calque du bloc plat par-dessus le crop sans
qu'aucun test ne bronche. Un compte simple dans le test existant
(« exactement 11 lecteurs de `vue.socle`, exactement 3 de `vue.boutons` »)
fermerait la classe entière en une ligne.

---

## 6. Les autres réserves, arbitrées

**Le crédit de licence sous une carte sans orthophoto — Important, pas Critique.**
Reproduit : avant le clic, aucun texte « Orthophoto » dans la page ; après,
« Orthophotos © IGN · NASA GIBS » apparaît, `params.aerialEnabled` vrai,
`terrain.mapUniforms.uAerialOn` à 1, et **aucun uniforme d'aérien nulle part sur
le globe** (mon balayage des matériaux du globe : 49 uniformes sur 3 matériaux,
zéro portant `aerial`/`ortho` — son compte de 88 vient d'un balayage différent,
je ne le conteste pas, la partie qui porte est identique). Gravité : c'est une
**mention de licence qui décrit autre chose que l'écran**, donc un problème de
conformité, pas d'expérience. Elle ne bloque pas la livraison **si** l'aérien est
éteint sous le drapeau — ce qui règle les deux d'un coup. Ne pas la laisser en
l'état.

**Le bouton aérien inerte — Mineur.** Un clic sans effet et une coche qui ment.
Désagréable, sans conséquence. Mais comme il traîne le crédit avec lui, la
décision est la même : le masquer sous le drapeau, ou brancher l'aérien sur le
globe.

**La branche « ensemble » du bouton iso — correctement déclarée non mesurée.**
Rien à redire : il dit ce qu'il n'a pas vu. Je ne l'ai pas mesurée non plus.

**Les captures qui ne sont pas sur le disque — n'invalide aucune conclusion,
mais était évitable.** Aucune de ses conclusions ne repose sur un jugement à
l'œil : chacune est adossée à une lecture d'état (`terrain.mesh.visible`,
`.off`/`display`, `veilleRepos.*`). Sa prudence sur la pose rasante (§ réserve 6)
est même exemplaire. **Mais** `page.screenshot()` d'un Chrome sans tête capture
l'image **composée**, indépendamment de `preserveDrawingBuffer` : les huit
captures de `.banc/R1-relecture/` le prouvent. La réserve 6 tombe, et avec elle
la raison de ne pas donner à Adrien une image à regarder.

**`package.json`, réserve 7 — vérifiée.** `test/visibilite-surface.test.js` est
bien dans la ligne `test`, et `node scripts/audit-tests.mjs` rend
**212 listés · 212 sur disque, aucun écart**. Le geste était nécessaire et il
est propre.

**Réserve 8 (`refreshOsmCredit` ne prend pas d'argument) — exacte**, vérifiée
dans le source.

---

## 7. Deux remarques sur les tests neufs

- **`test/visibilite-surface.test.js` ② n'est pas le test de comportement qu'il
  annonce.** Son en-tête promet qu'il « MORD sur ce qui est posé aux calques et
  aux boutons, pas sur le texte source ». En fait le « poseur de papier »
  **réimplémente le câblage dans le fichier de test** et consomme la même loi
  que ① : il ne peut mourir que des mutations que ① tue déjà. Vérifié en
  nommant les morts — sous M3, exactement deux tests tombent, *« ① DRAPEAU LEVÉ,
  en surface »* et *« ② DRAPEAU LEVÉ : `terrain.mesh.visible` reste FAUX »*,
  c'est-à-dire la même assertion écrite deux fois. Il ne touche jamais
  `main.js`. Ce n'est pas une
  faute (aucun test ne peut charger `main.js`), c'est une **promesse plus large
  que le test**. La formulation devrait être corrigée.
- **`⑨ la molette ne demande PAS de changer SEUIL_BOUGE_LOG` est à moitié
  tautologique.** `PIC_DIST / PIC_ALT < 1.1` compare deux littéraux écrits deux
  lignes plus haut : cette assertion ne peut jamais rougir, quel que soit le
  code. Seules les deux dernières lignes mordent (elles lisent
  `SEUIL_BOUGE_LOG`) — et c'est d'ailleurs elles qui ont tué M8. Le test garde
  donc bien le seuil ; il ne garde pas ce que son nom annonce.

---

## 8. Ce que j'ai vérifié et qui n'appelle rien

Pour que la liste des constats se lise pour ce qu'elle est, voici ce qui est
sain et que j'ai réellement exercé :

- la suite complète, rejouée **quinze fois** (une fois de référence, douze
  mutations, deux vérifications) : 4 131 / 0 à chaque état non muté ;
- la garantie de production, rejouée **dans le navigateur**, aller-retour
  d'orbite compris, drapeau baissé : identique ;
- le seuil `SEUIL_BOUGE_LOG`, inchangé, et sa non-modification justifiée par une
  mesure tracée ;
- la continuité de la distance à la traversée orbite → sol (mesure F), dont le
  raisonnement — `repos.oublier()` dans les deux sens — est vérifié dans
  `branchement-crop.js:864` ;
- les commentaires §1, §2 et §3 de `veille-repos.js` : le principe faux
  (« le même nombre ») est explicitement corrigé et remplacé par le bon
  (« la même image »), et les deux paragraphes portent désormais la mesure qui
  les réfute. L'Étape 5 est faite, et bien faite ;
- `src/globe.js`, `src/ocean.js`, `src/monde/mer-sphere.js`,
  `src/monde/flux-terrain.js` : non touchés, vérifié au diff.

---

## Les constats, classés

### Critique

1. **Le bouton ciné n'est pas réversible** — après `shots.stop()` la caméra reste
   à −862 m sous le sol, stable 10 s, et le huitième clic ne rend pas la vue non
   plus (5 010 m, distance 29,95 au lieu de 145,5) : `y = 77,1` / `distance 145,5`
   est **non reproductible** et doit être retiré du rapport, de `boutons-R1.json`
   et du commentaire de `main.js` ; le bouton doit être **éteint sous le drapeau**,
   pas laissé « à trancher ».
2. **La mutation M9 survit** — `distanceCadrageM()` qui rend `altitudeCadrageM()`
   annule le correctif ① en entier et passe les 4 131 tests : le corps de la
   grandeur du repos n'est gardé que par une expression régulière sur le source.
3. **Le chiffre `veilleRepos.bascules = 46` du brief est faux** — chargement
   propre à 57 img/s, sur la version altitude **comme** sur la version distance :
   **2**, et deux navigations automatiques ne le bougent pas ; le compteur est
   monotone et ne se remet jamais à zéro, donc « au chargement » ne peut pas
   désigner un cumul de session. À **retirer** de `brief-R1.md` et de
   `.banc/orbite-repos/mesure.json`.

### Important

4. **La mutation M5 survit** — supprimer le relais `poserVisibiliteSocle(v)` de
   `setSurfaceVisible` laisse les quatre boutons visibles **en orbite** (mesuré
   à l'écran) et ne fait rougir aucun test : le troisième correctif de ② est
   livré sans garde.
5. **Le crédit « Orthophotos © IGN · NASA GIBS » s'affiche sous une carte qui
   n'en porte aucune** — reproduit ; c'est une mention de licence qui décrit
   autre chose que l'écran, à ne pas laisser en l'état (masquer l'aérien sous le
   drapeau règle le crédit du même geste).
6. **Les mutations M11 et M12 survivent** — un calque du bloc plat (`labels`,
   `clouds`, et onze autres) peut être rebranché sur `vue.boutons` sans qu'aucun
   test ne rougisse ; le trou préexistait mais le passage à deux grandeurs dans
   la même fonction en élargit la surface.

### Mineur

7. **`test/visibilite-surface.test.js` ② n'est pas le test de comportement qu'il
   annonce** — le « poseur de papier » réimplémente le câblage et ne couvre rien
   de plus que ① ; la promesse de l'en-tête est plus large que le test.
8. **Le test `⑨ … SEUIL_BOUGE_LOG` est à moitié tautologique** — la comparaison
   des deux pics porte sur deux littéraux du fichier de test ; seules les deux
   assertions qui lisent le seuil mordent (ce sont elles qui tuent M8).
9. **« écran entièrement vide » n'est pas reproduit** — je relève une vue sous la
   surface de la mer, pas un écran vide (capture `13-cine.png`) ; la partie qui
   porte la décision, elle, se reproduit à un cheveu près.
10. **La discontinuité au cran (13,25 unités / 0,538 / 0,364) n'a pas pu être
    reproduite par mon instrument** — ni confirmée ni infirmée ; le relevé reste
    tracé et sa lecture est cohérente avec ce que j'ai mesuré (un cran coûte
    exactement un aller-retour, `bascules` 2 → 4).
11. **La réserve 6 (captures hors disque) était évitable** — un Chrome sans tête
    capture l'image composée quel que soit `preserveDrawingBuffer`, et le patron
    existe déjà dans `scripts/sonde-demarrage.mjs` ; huit captures dans
    `.banc/R1-relecture/` le démontrent.

---

## Ce que je recommande avant de fusionner

1. Éteindre `cineBtn` sous `?terre=unique` (Critique 1), ou brancher
   `sampleGround` sur le globe ; retirer les deux nombres de réversibilité.
2. Fermer M9 — de préférence en extrayant la grandeur du repos en module pur.
3. Fermer M5 — un test qui exerce le relais de mode sous le drapeau.
4. Retirer le 46 du brief et de `.banc/orbite-repos/mesure.json`.
5. Décider du sort de l'aérien (bouton + crédit) — les deux ensemble.

Les points 1, 2 et 3 sont, à mon sens, bloquants. Le reste est de la dette
nommée, ce qui est déjà beaucoup mieux que de la dette muette.
