# RAPPORT GEL — « LE FREEZE ARRIVE AU DOUBLE-CLIC POUR ZOOMER » : REPRODUIT, ET C'EST `busy` QUI NE RETOMBE JAMAIS

## ⓪ LA PHRASE QU'ADRIEN ATTEND

⚡ **OUI, LE GEL EST REPRODUIT — 6 CHARGEMENTS SUR 8 — PAR LE GESTE QU'IL DÉCRIT :
des double-clics gauche pour zoomer, enchaînés depuis l'orbite au-dessus de
Sulawesi (z3 → z5 → z6 → z7). À partir d'un palier, `busy` reste levé POUR
TOUJOURS : la carte continue de se dessiner, l'étiquette s'efface à l'heure, mais
plus un geste ne passe** — il faut actualiser. Sa piste était la bonne.

Ce n'est ni une boucle infinie ni un fil bloqué : c'est **une promesse morte**.
Une exception part dans le `setTimeout` de `regenerateTerrain`, `resolve()` n'est
jamais appelé, et les quatre vols de `modes.js` attendent une réponse qui ne
viendra pas, drapeau `busy` levé.

Arbre `C:\Dev\wt-gel2`, branche `gel-double-clic`, base `be69433` (D27). Serveur
`npx vite --host 127.0.0.1 --port 11466 --strictPort`. Chrome sans tête,
1 280 × 720 (et 2 560 × 1 440 DPR 2 = l'iMac 5K), CPU ×1 et ×4, **un processus
Chrome par geste**. Sonde neuve `scripts/sonde-gel2.mjs` : de VRAIS double-clics
par CDP (`Input.dispatchMouseEvent`, `clickCount` 1 puis 2, bouton gauche ou
droit — pas l'API interne), chien de garde **hors page** (`Runtime.evaluate` à
délai de 4 s, `Debugger.pause` armé pour rendre la pile), puis **l'épreuve de
réponse** : un double-clic de plus, la caméra bouge-t-elle, `busy` est-il
retombé ? Relevés dans `.banc/GEL2/` et `.banc/GEL3/`.

> **`npm test` : 5 121 · 0** (base `be69433` : **5 113 · 0**, rejouée sur cet
> arbre avec la liste de la base — l'écart est exactement les 8 tests neufs).
> **`npm run audit:tests` : 286 listés = 286 sur disque, aucun écart.**
> Un test nouveau, inscrit dans `package.json` : `test/gel-double-clic.test.js`
> (8 tests).

Trois agents ont travaillé ce rapport : **GEL-2** a reproduit, mesuré la pile et
écrit les gardes ; **GEL-3** a corrigé un effet de bord de la première garde et
rejoué une matrice de 12 configurations ; **GEL-4** (moi) a prouvé la morsure par
mutation, rejoué le banc sur l'arbre final, **cru réfuter un quatrième
changement puis découvert qu'il se mesure sur un AUTRE chemin** (§ ⑤ — l'erreur
et sa correction sont racontées entières), et commis.

---

## ① LA CAUSE, AVEC SA PILE

Capturée par la sonde (`pageerror`, `.banc/GEL2/orb-pile`, chargement 0 ; la même
sur les chargements gelés de `orb-gauche-x1`) :

```
TypeError: Cannot read properties of null (reading '18944')
    at sampleHeights        src/globe.js:4111       <- heights[i] sur t.heights = null
    at (anonymous)          src/globe.js:8041
    at interpolerMaille     src/monde/maillage-tuile.js:126
    at hauteurDessinee      src/globe.js:8032
    at hauteurM             src/monde/sol-globe.js:231
    at etat.hauteur         src/monde/sol-globe.js:138
    at sol                  src/labels.js:198
    at createLabels         src/labels.js:242
    at regenerateLabels     src/main.js:2178
    at (anonymous)          src/main.js:4490        <- regenerateTerrain, SECONDE moitié
```

**Le mécanisme, trois maillons — et le double-clic les enfile tous les trois :**

- **①** `poseurPourReconstruction` (`sol-globe.js:225`) prend **une fois** la
  liste `globe.tuilesAvecHauteurs()` « pour la durée d'une reconstruction », et
  la repasse à `hauteurDessinee` pour chacun des milliers de sommets d'un calque.
  Or la liste tient des **objets tuile**, pas des copies : entre sa constitution
  et sa lecture, `_retenirHauteurs` (`globe.js:9979`, la file de 24 tuiles de la
  tâche FLU) fait `v.heights = null` sur une tuile PLUS ANCIENNE de cette même
  liste dès qu'une tuile plus récente est maillée. `sampleHeights(null, …)` lève.
  **Le double-clic produit cette course à coup sûr** : il déclenche un vol
  (`_rescale` / `_dive` → `loadSurface` → `regenerateTerrain`) ET une rafale
  d'atterrissages de tuiles du nouveau palier, au même instant.
- **②** Le second corps de `regenerateTerrain` tourne dans un **`setTimeout`**
  (voulu : un `requestAnimationFrame` ne se déclenche jamais dans un onglet
  caché). Une exception y **ne rejette aucune promesse** : elle part en
  « uncaught », `resolve()` n'est jamais appelé, `rebuildPending` reste `true` —
  et tout `regenerateTerrain` suivant rend alors une promesse **vide**, sans rien
  reconstruire. `loadSurface` n'a jamais sa réponse.
- **③** Dans `modes.js`, `enterOrbit` / `_dive` / `_rescale` / `_loadDive` posent
  `busy = true` puis ne le rabaissent que sur le chemin nominal et sur le `catch`
  de `loadSurface`. Une promesse qui ne revient jamais — ou une levée APRÈS
  l'`await`, hors de ce `catch` — laisse `busy` levé. **`busy` levé =
  `saisiePossible()` faux = plus un geste, plus un cran, plus un double-clic.**

**Ce n'est pas le fil qui se bloque, et c'est mesuré** : sur les chargements
gelés, le chien de garde CDP **n'a jamais mordu**, la plus longue tâche vaut
**128 à 204 ms**, et le compteur d'images monte plus HAUT que sur les chargements
sains (3 222–3 293 contre 1 619–1 763, la sonde observant plus longtemps).
L'étiquette « REFINING » s'efface à l'heure, son `setTimeout` étant indépendant.
C'est exactement la vidéo d'Adrien.

**Le crédit revient à l'agent voisin FAN-2** (`C:\Dev\wt-fan`, `rapport-FAN.md`
§ ⑦) : il a attrapé la même pile depuis son propre banc et a nommé les deux
correctifs possibles avant nous. Il note aussi que **son travail ouvre ce trou
bien plus souvent** (base 0/4, son correctif 6/8) : la caméra bouge encore
pendant les deux moitiés, le globe maille de nouvelles tuiles, et la file en
relâche une que la liste tient déjà. **FAN ne doit pas fusionner sans les gardes
de ce commit.**

---

## ② LES TROIS GARDES — ET POURQUOI IL EN FAUT TROIS

| | où | ce que ça fait | ce que ça NE fait pas |
|---|---|---|---|
| **①** | `globe.js` — `_tuileLaPlusFine(lat, lon, candidates, exige)` | supprime **la cause mesurée** : une tuile dont les hauteurs ont été relâchées n'est plus candidate POUR UN LECTEUR DE HAUTEURS ; la suivante (plus grossière) répond, et `null` traverse s'il n'y en a plus | ne protège de **rien d'autre** : les autres étapes de parure (nuages, sommets, calques) peuvent lever pour d'autres raisons, et le gel serait identique |
| **②** | `main.js` — `try/catch/finally` autour du corps différé de `regenerateTerrain` | garantit que `resolve()` est appelé et que `rebuildPending` retombe **quoi qu'il arrive** : la classe entière de pannes cesse de tuer l'application | ne **répare pas** le terrain : la parure s'est arrêtée en route. Sans ①, Adrien n'aurait plus un gel mais un relief **à moitié habillé**, chaque fois que la course tombe — et sans avertissement |
| **③** | `modes.js` — `finally { this.busy = false }` dans les quatre vols | garantit que **la porte des gestes rouvre**, même quand la panne est EN AMONT de `regenerateTerrain` (réseau, `echelleVerticaleBloc`, `_arrivalPose`, `_suivreEmprise` : tout ce qui suit l'`await` et vit hors du `catch` d'origine) | ne suffit **pas** seul : sans ②, `rebuildPending` resterait `true` pour toujours et **chaque zoom suivant ne reconstruirait plus rien**, en silence. La porte serait ouverte sur une carte qui a cessé de suivre |

➡️ **Une garde qui masque `t.heights` nul sans faire retomber `busy` ne suffit
pas** (elle ne couvre que la cause du jour) ; **un `finally` qui libère `busy`
sans réparer la cause** rendrait la main sur un terrain incomplet, à répétition.
Les trois sont la même panne prise à ses trois étages : la cause, la promesse, le
drapeau.

**L'effet de bord que GEL-3 a corrigé, et il compte.** GEL-2 avait posé
`if (!t.heights) continue` **dans** `_tuileLaPlusFine`, donc pour tous ses
lecteurs. Or `hauteurMaillee` (tâche SOC) lit précisément le MAILLAGE de tuiles
dont les hauteurs ont été relâchées — c'est toute la plaque provisoire du socle :
`test/socle-plaque.test.js` passait au **rouge** (3 tests). Le filtre est devenu
un **paramètre du lecteur** (`exige`) : `hauteurSurface` et `hauteurDessinee` —
les deux seuls qui appellent `sampleHeights(t.heights)` — le passent ;
`hauteurMaillee` ne le passe pas. La pile mesurée passe par `hauteurDessinee` :
la cause est couverte, la plaque provisoire ne l'est plus.

---

## ③ LA MORSURE PAR MUTATION (`.banc/GEL2/morsure.json`)

Chaque mutation est écrite dans l'arbre, la suite rejouée, la source restaurée,
**et le md5 relu avant / muté / restauré** — les trois sont dans le journal.

| | fichier | mutation | rouges | md5 restauré |
|---|---|---|---|---|
| **M1** | `globe.js` | le filtre `exige` retiré de `_tuileLaPlusFine` | **3** (① × 3) | `776325b6` ✅ |
| **M2** | `main.js` | le `try/catch/finally` retiré de `regenerateTerrain` (corps d'origine) | **1** (②) | `1c7ec1d7` ✅ |
| **M3** | `modes.js` | `busy = false` retiré du `finally` de `_rescale` | **2** (③ comportement + ③ source) | `39a90e30` ✅ |
| **M4** | `modes.js` | idem `_dive` | **1** (③ source) | `39a90e30` ✅ |
| **M5** | `modes.js` | idem `_loadDive` | **1** (③ source) | `39a90e30` ✅ |
| **M6** | `modes.js` | idem `enterOrbit` | **1** (③ source) | `39a90e30` ✅ |
| **M7** | `main.js` | l'épingle rendue à l'horloge MURALE (`jusquA`) | **1** (④) | `1c7ec1d7` ✅ |
| — | arbre intact, avant ET après les sept | | **0** (8 · 0) | — |

**Le test qui compte est le ③ « comportement »** : un vrai `Modes` bâti sur le
stub DOM de `test/retour-orbite.test.js`, avec un hook `echelleVerticaleBloc` qui
lève **à sa seconde lecture** — c'est-à-dire APRÈS `loadSurface`, hors du
`try/catch` d'origine, exactement le cas du gel. Sans le `finally`, `busy` reste
levé et le test rougit. Les ② et ③-source sont des contrats de SOURCE
(`regenerateTerrain` n'est pas exportable) ; leur preuve de comportement est le
banc, § ④, colonne `rtErr`.

---

## ④ LA PREUVE AU GESTE — DE VRAIS DOUBLE-CLICS CDP

### 4.1 AVANT (base `be69433`, sonde identique)

| relevé | geste | gels durs (`busy` levé pour toujours) | où il s'arrête |
|---|---|---|---|
| `.banc/GEL2/orb-gauche-x1` | **orbite 12 000 km → double-clics gauche → z7**, ×1 | ⚡ **6 / 8** | z5 (×3), z6 (×2), z7 (×1) |
| `.banc/GEL2/orb-pile` | idem, 3 chargements | **1 / 3**, AVEC la pile | z6 |
| `.banc/GEL2/sul-gauche-x1` | Sulawesi z5 → z7, ×1 | 0 dur, mais `busy` encore levé à l'épreuve de réponse **5 / 8** | z7 |

Lecture : **le chemin de la vidéo (depuis l'orbite) est celui qui gèle**, et il
gèle trois fois sur quatre. Le chemin « déjà sur le bloc » ne fige pas
complètement mais laisse la porte fermée un temps anormal.

### 4.2 APRÈS — l'arbre FINAL, un processus Chrome par geste

Six gestes, **56 chargements**, **un processus Chrome par geste** (un seul Chrome
gèle au 8e), relevés sous `.banc/GEL2/`. ⚠️ **Les six premiers (`f-…`) ont tourné
pendant la parenthèse du § ⑤**, c'est-à-dire avec les trois gardes du gel MAIS
l'épingle revenue au dépôt ; le dernier (`g-…`) tourne sur l'arbre exactement
commis. L'épingle ne touche que `gestesTerre.epingle`, qu'aucune ligne de
`modes.js` ni de `globe.js` ne lit : **elle ne peut pas peser sur `busy`**, et
les deux côtés donnent le même verdict.

| relevé | geste | gels | `busy` retombe | `rtErr` | où il arrive |
|---|---|---|---|---|---|
| `f-orb-gauche-x1` | ⚡ **le geste de la vidéo** : orbite 12 000 km → double-clics gauche, ×1 | **0/8** | **8/8** | 0 | **z7 sur 8/8** (avant : bloqué à z5 ou z6 sur 5 des 6 gelés) |
| `f-orb-gauche-x4-dpr2` | le même, CPU ×4 / DPR 2 (l'iMac 5K sur une machine chargée) | **0/8** | **8/8** | 0 | z7 sur 8/8 |
| `f-sul-ench-x4-dpr2` | ⚡ **le double-clic PENDANT la reconstruction** (le second part 250 ms après le premier), ×4 / DPR 2 | **0/8** | **8/8** | 0 | z6 sur 8/8 |
| `f-reu-gauche-x1` | La Réunion **en CROP** z12 → z14 : le double-clic gauche y est la plongée R35, donc `_loadDive` | **0/8** | **8/8** | 0 | z14 sur 8/8 |
| `f-sul-ggdd-x1` · `f-sul-ggdd-x4-dpr2` | **deux gauches puis deux DROITS**, hors du crop (le seul chemin où le bouton droit agit) | **0/8** · **0/8** | **8/8** · **8/8** | 0 | z7 puis retour z6, 16/16 |
| `g-sul-ench-x4-dpr2` | l'enchaîné ×4 rejoué après la remise de l'épingle (§ ⑤) | **0/8** | **8/8** | 0 | z6 sur 8/8 |

Le chien de garde CDP n'a **jamais** mordu ; `rtErr` (`__exp.regenerateTerrainErreurs`,
la sonde de la garde ②) vaut **0 sur les 56 chargements**, et 0 sur les 96 de
GEL-3 : après la garde ①, la
levée ne se produit plus du tout — la ceinture n'a pas eu à servir.

### 4.3 APRÈS — la matrice de GEL-3 (12 configurations, 96 chargements)

Rejouée par GEL-3 **sur l'arbre exactement commis** (les trois gardes ET
l'épingle en budget), elle couvre tout ce que le brief demande et donne le même
verdict : **0 gel, `busy` retombe 8/8 partout, `rtErr` = 0 partout.** Avec le
§ 4.2, cela fait **152 chargements sans un seul gel**, des deux côtés du seul
point qui sépare les deux arbres.

| relevé (`.banc/GEL3/`) | geste | gels | `busy` retombe | `rtErr` |
|---|---|---|---|---|
| `orb-gauche-x1` · `orb-gauche-x4-dpr2` | orbite → z7, ×1 et ×4 / DPR 2 | 0/8 · 0/8 | 8/8 · 8/8 | 0 |
| `sul-gauche-x1` · `sul-gauche-x4-dpr2` | Sulawesi z5 → z7 | 0/8 · 0/8 | 8/8 · 8/8 | 0 |
| `sul-gauche-ench-x1` · `sul-ench-x4-dpr2` | **double-clic PENDANT la course du premier** (250 ms) | 0/8 · 0/8 | 8/8 · 8/8 | 0 |
| `reu-gauche-x1` · `reu-gauche-x4-dpr2` | La Réunion en CROP z12 → z14 (chemin `_loadDive`) | 0/8 · 0/8 | 8/8 · 8/8 | 0 |
| `sul-droit-x1` · `sul-droit-x4-dpr2` | bouton DROIT, Sulawesi z7 | 0/8 · 0/8 | 8/8 · 8/8 | 0 |
| `reu-droit-x1` · `reu-droit-x4-dpr2` | bouton DROIT, La Réunion z12 | 0/8 · 0/8 | 8/8 · 8/8 | 0 |

⚠️ **Les quatre relevés « droit » ci-dessus ne mesurent PAS le dézoom** : partis
d'un `flyTo` au zoom fin, ils tombent en **régime CROP**, où le double-clic droit
est **inerte par décision** (GE3 : « crop : double-clic gauche = la plongée R35,
droit rien ») — `alt ×1,000`, `Δaz 0°`, 8/8. Ils prouvent l'absence de gel, rien
de plus. Le dézoom au bouton droit se mesure hors du crop, § ⑥.

### 4.4 Le faux gel de `orb-gauche-x1-apres`, chargement 7 (GEL-2)

Pile dans `bakeCloudVolume → worley2` sous `new Clouds2` à `main.js:2096` — **le
haut de module**, donc une page en train de se recharger. Les horodatages le
disent : GEL-2 écrivait dans `src/` (sa copie `.banc/GEL2/mut/`, 10:48–10:51)
pendant que son banc tournait, **Vite a rechargé la page**, `__gel` a disparu et
`Runtime.evaluate` est resté muet. Ce n'est pas un gel de l'application. GEL-3 et
GEL-4 n'ont touché à `src/` pendant aucun banc. **Réserve** : la cuisson
synchrone du volume de nuages au démarrage (455 ms mesurées) quand le Worker perd
la course existe bel et bien — c'est un coût de CHARGEMENT, pas le gel du
double-clic.

---

## ⑤ CE QUE J'AI CRU, PUIS RÉFUTÉ

1. ⚡ **« Le changement d'épingle de GEL-2 ne mesure rien, il sort du commit. »**
   **J'ai eu tort, et l'erreur vaut d'être racontée.** GEL-2 avait fait passer
   l'épingle du double-clic d'une **échéance murale** (`jusquA = now + 2500 ms`)
   à un **budget de temps de simulation** (`resteMs`, décompté par `dt`), en
   citant un chiffre (« 103 à 196 px à ×4 ») **dont aucun bilan n'existait sur
   disque** — son banc avait été interrompu avant de l'écrire.

   J'ai donc fait l'A/B moi-même… **sur le chemin non enchaîné**, et il ne montre
   rien :

   | Sulawesi z5 → z7, CPU ×4 / DPR 2, **NON enchaîné** | dérive du point cliqué |
   |---|---|
   | épingle murale (`sul-gauche-x4-dpr2-avantepingle`, 4 chargements) | 134,96 · 139,20 · 134,96 · 135,23 px |
   | épingle en budget (`sul-gauche-x4-dpr2-apres`, 8 chargements) | 133,69 à 138,20 px |

   J'ai conclu « inerte », retiré le changement, retiré son test et sa mutation,
   et rejoué tout le banc. **C'est ce banc-là qui m'a détrompé** : sur le chemin
   **ENCHAÎNÉ** (le second double-clic 250 ms après le premier, pendant la course
   du premier), mon relevé donnait 195,54 px là où celui de GEL-3, aux mêmes
   paramètres au bit près, donnait 0,00 px. J'ai remis le changement et rejoué
   l'enchaîné **dans la même session** :

   | Sulawesi z5, CPU ×4 / DPR 2, **ENCHAÎNÉ** | dérive du point cliqué |
   |---|---|
   | épingle murale (`f-sul-ench-x4-dpr2`, 8 chargements) | ⚠️ **195,54 px sur 7/8**, 159,65 px sur 1/8 |
   | épingle en budget (`g-sul-ench-x4-dpr2`, 8 chargements) | ✅ **0,00 px sur 8/8** |
   | (GEL-3, budget, `.banc/GEL3/sul-ench-x4-dpr2`) | 0,00 px sur 8/8 |

   ➡️ **Le changement est prouvé, et il reste.** Le « 196 px » de GEL-2 était le
   bon chiffre ; c'est le relevé qu'il citait qui n'était pas le bon. ⚡ **La
   leçon est le piège des pièges communs : « l'état dépend du CHEMIN ».** Le même
   A/B, à la même charge machine, sur le même lieu et le même zoom, dit « aucun
   effet » sur un chemin et « 195 px contre 0 » sur l'autre. J'ai failli commettre
   la suppression d'un correctif juste parce que je l'avais mesuré au mauvais
   endroit — et j'aurais eu, pour l'appuyer, quatre chargements très propres.

2. **« L'étiquette qui s'efface pendant le gel prouve une boucle infinie. »**
   Non : le fil respire (tâche max 128–204 ms), les images montent, et
   l'étiquette a son propre `setTimeout`. C'est une **promesse morte**, et
   `rapport-GEL.md` ne pouvait pas la voir — il n'avait pas fait de double-clic
   (30 chargements par `flyTo`, crans et molette, 0 gel).
3. **« `if (!t.heights) continue` dans `_tuileLaPlusFine` est la bonne garde »**
   (GEL-2) : elle casse la plaque provisoire du socle, qui lit exprès des
   maillages sans hauteurs — 3 rouges dans `test/socle-plaque.test.js`. Le filtre
   appartient au LECTEUR, pas au choix de tuile (§ ②).
4. **« Les relevés au bouton droit couvrent le dézoom. »** Non : partis d'un
   `flyTo` au zoom fin, ils tombent en régime CROP, où le double-clic droit est
   inerte par décision — `alt ×1,000` sur 32 chargements. Il faut la séquence
   `ggdd` hors du crop pour que le bouton droit agisse (§ ⑥).
5. **« `Δaz` d'OrbitControls mesure le roulis parasite du double-clic droit. »**
   Non : il rend **0,000° partout**, y compris là où le sol tourne bel et bien.
   Le « roulis du sol » de GE3 est l'angle entre les deux points SOUS LA CAMÉRA ;
   je l'ai ajouté à la sonde (`sc`, un vecteur unité, et `roulisDeg`) — § ⑥.
6. **« Le `finally` de `modes.js` est une ceinture inutile puisque ① supprime la
   cause. »** `rtErr` vaut **0 partout** après ① — donc la ceinture ne sert
   effectivement jamais **dans ces bancs**. Mais ② et ③ couvrent une CLASSE :
   toute levée dans la parure, hier comme demain, figeait l'application avant FLU
   comme après. FAN-2 dit la même chose de son côté.

---

## ⑥ D19 AU DOUBLE-CLIC — MESURÉ, PAS CRÉÉ

La sonde relève, entre l'état d'avant le premier double-clic mesuré et l'état
8 s après le dernier : la **dérive du point cliqué** (en pixels, dans l'espace
GLOBE — le même où l'épingle travaille), le rapport d'altitude, `Δaz`
d'OrbitControls, et — ajouté par moi — le **roulis du sol**, l'angle entre les
deux points SOUS LA CAMÉRA. C'est cette dernière grandeur qui est la « rotation
parasite » de GE3 ; `Δaz` ne la mesure pas (il rend `0,000°` partout).

| chemin | dérive du point cliqué | altitude | roulis du sol |
|---|---|---|---|
| **gauche, hors crop, Sulawesi z5 → z7, ×1** (`.banc/GEL3/sul-gauche-x1`) | **0,00 px, 8/8** ✅ | ×0,7235 | — |
| **gauche depuis l'orbite → z7, ×1** (`f-orb-gauche-x1`) | **0,01 px, 8/8** ✅ | ×0,065 | 16,76° (c'est le VOYAGE orbite → bloc, pas un parasite) |
| **gauche depuis l'orbite → z7, ×4 / DPR 2** (`f-orb-gauche-x4-dpr2`) | 0,01 px (6/8), **6,15 et 6,49 px** (2/8) ⚠️ | ×0,065 | 16,76–16,80° |
| **gauche enchaîné, ×4 / DPR 2** (`g-sul-ench-x4-dpr2`) | **0,00 px, 8/8** ✅ | ×0,725 | 2,50° |
| **DROIT (dézoom ×4), hors crop, ×1 et ×4 / DPR 2** (`f-sul-ggdd-x1`, `f-sul-ggdd-x4-dpr2`) | **0,00 px, 16/16** ✅ | ×4,163 (soit ÷2 par double-clic, exact) | ⚡ **0,85°, 16/16** |
| **gauche, non enchaîné, ×4 / DPR 2** (`sul-gauche-x4-dpr2-*`) | **133,7 à 139,2 px** ⚠️ réserve, § ⑧ | ×0,7235 | 2,54–2,55° |
| **gauche, La Réunion en CROP** (`f-reu-gauche-x1`) | 157,5 à 161,5 px — **c'est le geste voulu** : la plongée R35 RECENTRE sur le point cliqué, elle ne l'épingle pas | ×0,55 | 0,05° |

⚡ **La rotation parasite du double-clic droit, mesurée et non créée : 0,85° sur
16 chargements** (le point cliqué à 193 px du centre, `P = (820, 290)` dans
1 280 × 720), pour un dézoom de deux niveaux. La réserve de GE3 annonçait
**3,71–3,92°** pour ÷2 depuis un point à 233 px du centre — sur MON chemin
(hors crop, deux double-clics, depuis z7) elle vaut le quart de ça et passe
**sous le seuil de 2°** que le barème GE1 avait écrit. Je ne la corrige pas et
je n'y touche pas ; je la chiffre. ⚠️ Elle dépend de la distance au centre et du
nombre de crans : ce n'est pas une réfutation de GE3, c'est une seconde mesure
sur un autre chemin, et les deux doivent être lues ensemble.

Le **critère « ≤ 1,4 px »** est donc tenu sur tous les chemins où l'épingle est
le geste (0,00–0,01 px, sauf deux chargements à 6,2–6,5 px depuis l'orbite à
CPU ×4), **sauf** le chemin non enchaîné à CPU ×4 — réserve § ⑧, antérieure au
correctif et mesurée des deux côtés.

---

## ⑦ LIGNES TOUCHÉES, ET LA FUSION AVEC FAN-2

| fichier | lignes (arbre corrigé) | quoi |
|---|---|---|
| `src/globe.js` | `4085–4088` | la constante `AVEC_HAUTEURS` |
| | `7992`, `8031` | `hauteurSurface` / `hauteurDessinee` passent le filtre |
| | `8113` | `_tuileLaPlusFine(…, exige = null)` |
| | `8130–8145` | le `continue` du filtre, et son commentaire |
| `src/main.js` | `4410–4423` | l'en-tête de garde + `try {` dans `regenerateTerrain` |
| | `4529–4543` | `catch` (journal + compteur) et `finally` (la main revient) |
| | `14587` | la sonde `__exp.regenerateTerrainErreurs` |
| | `14575`, `14746–14767`, `15070–15071` | l'épingle du double-clic : budget `resteMs` au lieu de l'échéance murale `jusquA`, décompté par `dt` (§ ⑤ — **c'est un correctif D19, pas un correctif du gel**) |
| `src/modes.js` | `879–952` `enterOrbit` · `1206–1292` `_dive` · `1498–1564` `_rescale` · `1768–1799` `_loadDive` | **une indentation sous `try/finally`, pas une réécriture** : `git diff -w` rend **20 lignes ajoutées, 0 retirée** (4 × 5) |

`regenerateTerrain` n'est ni déplacé ni renommé (pour `wt-fan`) ; le pivot n'est
pas touché (`wt-obl`) ; `branchement-crop.js` n'est pas touché (`wt-ca2`).

**⚠️ Le conflit annoncé par FAN-2 sur `_rescale`, et sa fusion.** FAN-2 pose
`this._rescaleEnCours = next` autour de l'`await loadSurface` et le remet à `null`
sur ses **deux** sorties ; mon hunk ré-indente tout ce corps sous
`try { … } finally { this.busy = false }`. **La fusion tient en deux lignes :**

1. `this._rescaleEnCours = continu ? next : null` **juste avant** l'`await
   this.hooks.loadSurface(next.lat, next.lon, next.zoom)`, à l'intérieur de mon
   `try` (vers la ligne 1520) ;
2. **un seul** `this._rescaleEnCours = null` **dans mon `finally`** (ligne 1561),
   à la place de ses deux remises à zéro — le `finally` couvre par construction
   les deux sorties qu'il visait, et une troisième qu'il n'avait pas : la levée.

Ses autres hunks (`178–181`, `434–443`, `568–594`, `776–813`, `2188–2190`) ne
croisent aucun des miens. **Et il ne doit pas fusionner sans ce commit** : son
propre relevé dit base 0/4, son correctif 6/8 (§ ①).

---

## ⑧ RÉSERVES

1. ⚠️ **La dérive de ~135 px du double-clic gauche à CPU ×4 / DPR 2, chemin NON
   enchaîné** (`sul-gauche-x4-dpr2-avantepingle` 134,96–139,20 px ·
   `-apres` 133,69–138,20 px · `.banc/GEL3/sul-gauche-x4-dpr2` 132,72–138,78 px).
   Elle est **antérieure au correctif, mesurée des deux côtés de l'épingle, et
   non corrigée**. À CPU ×1 elle vaut **0,00 px sur 8 chargements** : c'est un
   effet de la LENTEUR, pas de la loi de zoom. Piste non vérifiée : pendant le
   rechargement du palier, `saisiePossible()` est faux et l'épingle ne peut rien,
   alors que la course du zoom, elle, continue de courir (`_applyZoom` s'exécute
   même à `busy` — FAN-2 § ③) ; à ×4 le palier dure plus longtemps que la course.
   **Ce n'est pas le gel**, et je ne l'ai pas traitée pour ne pas mélanger deux
   sujets dans un commit qu'Adrien attend.
2. **Deux chargements sur huit à 6,15 et 6,49 px** depuis l'orbite à CPU ×4 —
   au-dessus des 1,4 px, très en dessous de la réserve 1. Même famille.
3. **Le roulis du double-clic droit vaut 0,85° sur mon chemin, 3,71–3,92° sur
   celui de GE3.** Les deux mesures sont bonnes ; la grandeur dépend de la
   distance du point au centre et du nombre de niveaux. Si Adrien veut trancher
   la réserve GE3, il faut refaire la mesure de GE3 avec le roulis du sol
   (`sc` / `roulisDeg`, ajoutés à `sonde-gel2.mjs`) — pas avec `Δaz`, qui rend 0.
4. **`rtErr` = 0 sur 56 chargements** : la ceinture ② n'a jamais eu à servir une
   fois la garde ① posée. La sonde `__exp.regenerateTerrainErreurs` est laissée
   EXPRÈS : si elle se met à compter en vrai, c'est qu'une autre étape de parure
   lève, et le journal de la console nommera laquelle.
5. **La cuisson synchrone du volume de nuages au démarrage** (455 ms mesurées,
   `main.js:328`) quand le Worker perd la course : réelle, vue une fois au banc,
   **coût de CHARGEMENT et non gel au double-clic** (§ 4.4).
6. **Avant le correctif, `sul-gauche-x1` laissait `busy` levé à l'épreuve de
   réponse 5 fois sur 8 sans gel dur.** Je n'ai pas cherché pourquoi (un
   raffinement légitime en cours, sans doute) ; après, c'est 0 sur 8 partout.
7. **Ce banc prouve l'absence de gel SUR CES GESTES.** Rien ne dit qu'aucune
   autre course n'existe — mais ② et ③ font qu'elle ne serait plus fatale : la
   main revient, la porte rouvre, et le compteur le dit.

---

## ⑨ LA RECETTE

```
npx vite --host 127.0.0.1 --port 11466 --strictPort

# le geste de la vidéo (celui qui gèle sur la base) — 8 chargements, un Chrome
node scripts/sonde-gel2.mjs --port 11466 --etiq X --lieu orbite   --bouton gauche --cpu 1 --dpr 1 --n 8
# la machine lente et l'écran 5K
node scripts/sonde-gel2.mjs --port 11466 --etiq X --lieu orbite   --bouton gauche --cpu 4 --dpr 2 --n 8
# le double-clic PENDANT la reconstruction (le second part 250 ms après le premier)
node scripts/sonde-gel2.mjs --port 11466 --etiq X --lieu sulawesi --bouton gauche --cpu 4 --dpr 2 --n 8 --enchaine 1
# le CROP (La Réunion) : le double-clic gauche y est la plongée R35, donc `_loadDive`
node scripts/sonde-gel2.mjs --port 11466 --etiq X --lieu reunion  --bouton gauche --cpu 1 --dpr 1 --n 8
# le bouton DROIT là où il agit : deux gauches puis deux droits, D19 mesuré au 3e
node scripts/sonde-gel2.mjs --port 11466 --etiq X --lieu sulawesi --seq ggdd --mesure 2 --cpu 1 --dpr 1 --n 8

node --test test/gel-double-clic.test.js
# morsure : retirer `if (exige && !exige(t)) continue` de globe.js -> 3 rouges ;
#           retirer le try/finally de regenerateTerrain -> 1 rouge ;
#           retirer `this.busy = false` d'un des quatre `finally` -> 1 ou 2 rouges.
npm test && npm run audit:tests
```
