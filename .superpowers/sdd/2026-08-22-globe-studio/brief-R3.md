# Tâche R3 — ON NE CHARGE QUE LES DALLES DU SOCLE

> **Adrien, 2026-08-23 :** *« Tu charges beaucoup trop de dalles. Quand on est au
> niveau du premier crop, on ne doit plus charger que la dalle visible. »*
>
> Puis, précisant : *« Je veux dire qu'on ne doit calculer que les dalles qui
> font partie du socle, et pas ce qui est à l'extérieur du socle. »*

⚠️ **C'est la seconde phrase qui fait loi.** Il ne demande pas « une seule
dalle » — il demande **rien au-delà de l'emprise du crop**. C'est exactement
l'intention de `_horsCropSeul`, et **trois chemins la contournent**.

---

## 1. L'ÉTAT DES LIEUX — enquête faite, vérifié à la ligne

**Dessiner ≠ traverser ≠ charger.** Le chantier n'a traité que les deux
premiers. La Tâche N a fait passer `_traverse` de **351 tuiles dessinées à 36** et
de **688 traversées par image à 60** — ce travail est bon et **tu n'y touches
pas**. Le troisième budget, le réseau, n'a jamais reçu la garde.

### Les quatre chemins qui demandent des tuiles

| # | où | gardé ? |
|---|---|---|
| 1 | `_traverse` → `_request` (`globe.js:6177`) | ✅ **gardé** par `_horsCropSeul` (`globe.js:6082`) |
| 2 | `chargeRacines` (`globe.js:2851`) | ❌ hors garde — **mais borné à 16 racines z2, idempotent. Ce n'est PAS la cause, ne le « corrige » pas sans raison.** |
| 3 | `demanderEmprise` (`flux-terrain.js:458`) | ❌ construit sa liste par boîte englobante (`tuilesEmprise`), **sans un seul appel à `_horsCropSeul` ni `tuileDansCrop`**. Actif sous `socle=quadtree`. |
| 4 | ⚡ **`bootInitialView` (`main.js:11599`)** | ❌ **INCONDITIONNEL** |

### ⚡ LE PLUS GROS, ET LE PLUS SIMPLE

    if (params.source === 'real') await loadRealTerrain()     // main.js:11599

**Aucune condition sur le drapeau**, et `source` vaut `'real'` par défaut
(`main.js:281`). ➡️ **L'application télécharge le relief complet du bloc plat à
chaque chargement, pour un bloc qu'elle rend invisible juste après.**
`poserVisibiliteSocle` coupe `terrain.mesh.visible` (`main.js:4564-4566`) —
**masquer un maillage ne coupe pas le réseau.** C'est une file entière, séparée,
hors du `queue` de `globe.js`.

### La contre-pression, enfermée derrière `this.continu`

| mécanisme | ligne | garde |
|---|---|---|
| plafond de file (`PLAFOND_FILE = 256`, `globe.js:679`) | `globe.js:5509` | `if (this.continu && …)` |
| `_purgerFile()` | `globe.js:5612` | `if (!this.continu \|\| …) return 0` |
| rang d'éviction des tuiles bloquées | `globe.js:6327` | `this.continu ? … : []` |

⚠️ **CE N'EST PAS UNE DÉCOUVERTE, C'EST UN ARBITRAGE OUBLIÉ.** Le plan du
2026-08-08 (`docs/superpowers/plans/2026-08-08-globe-continu.md:1554`) l'avait
mesuré et écrit noir sur blanc : *« 473 tuiles en chargement, file à 462, pour un
cache de 600. (…) C'est délibéré, mais ce n'est pas une raison de l'oublier :
à trancher avec Adrien. »* **Quinze jours plus tard, Adrien signale le
symptôme.** L'arbitrage est donc rendu : **on le traite.**

---

## 2. CE QU'ON ATTEND

- [ ] **Étape 1 — L'INSTRUMENT D'ABORD, ET C'EST NON NÉGOCIABLE.**
      ⚠️ **Aucune mesure de ce dépôt ne couvre « caméra posée sur le crop ».**
      Les chiffres 351→36 et 688→60 viennent du harnais `test/veille-repos.test.js:596`,
      qui instancie `new Globe({ globeContinu: true })` — **un régime différent**.
      **Pose des compteurs et RELÈVE L'ÉTAT DE DÉPART avant de corriger quoi que
      ce soit** : demandes réseau par seconde au repos, `globe.queue.length`,
      `globe.inFlight`, `globe.tiles.size`, et **la part de ces demandes qui
      tombe hors du crop** (départage avec `tuileDansCrop`). Trace dans
      `.banc/R3/avant.json`. ⛔ **Sans ce relevé, tu n'auras aucun moyen de dire
      que tu as amélioré quoi que ce soit** — et huit rapports de ce chantier se
      sont déjà arrêtés faute d'une mesure que personne n'avait prise.
- [ ] **Étape 2 — test rouge.**
- [ ] **Étape 3 — le chemin 4, le gain le plus gros pour le moins de risque.**
      Ne charge plus le relief du bloc plat quand le drapeau est levé.
      ⚠️ **ATTENTION, ET C'EST LE PIÈGE DE CETTE ÉTAPE** : `loadRealTerrain`
      alimente peut-être autre chose que le maillage — l'emprise (`extentMeters`),
      `dem`, le masque de côte, l'occupation du sol. **Le crop en dépend-il ?**
      `contexteCrop()` (`main.js`) lit-il quelque chose qui vient de là ?
      **Vérifie-le AVANT de couper**, sinon tu éteins le crop avec le socle.
      Si la dépendance existe, **charge ce qui est nécessaire et rien de plus**,
      et dis exactement quoi.
- [ ] **Étape 4 — le chemin 3.** Donne à `demanderEmprise` la garde du crop, ou
      dis pourquoi elle ne s'y applique pas.
- [ ] **Étape 5 — la contre-pression.** Lève les trois gardes `this.continu`.
      ⚠️ **RISQUE RÉEL, NOMMÉ PAR L'ENQUÊTE** : ces mécanismes **n'ont jamais été
      exercés sous `continu:false`** — tout le harnais du crop instancie
      `globeContinu: true`. Les lever change le comportement du globe
      **ordinaire** (`?globe=crans`, sans crop du tout). **Écris des tests neufs
      sous `continu:false` AVANT de lever les gardes**, pas seulement rejouer
      ceux qui existent.
- [ ] **Étape 6 — LA MESURE APRÈS**, même instrument, même scène, même durée.
      `.banc/R3/apres.json`. **Annonce l'écart, pas une impression.**
- [ ] **Étape 7 — le coût de démarrage.** ⚠️ **Vérifie que tu n'as pas RALENTI le
      premier affichage** en coupant un chargement dont dépendait la première
      image. Chronomètre le temps jusqu'au premier rendu du crop, avant/après.
- [ ] **Étape 8 — clôture**, drapeau levé ET baissé. ⚠️ **Drapeau baissé, la
      production doit être RIGOUREUSEMENT inchangée** — la Tâche P2 a tenu
      **0 pixel d'écart sur 1 024 000**, trois chargements, `git stash` à
      l'appui. C'est la barre.

---

## 3. CE QUE TU NE FAIS PAS

⛔ **`_rechargeTuiles()` (`globe.js:6400`) — N'Y TOUCHE PAS.** Elle relâche
**toutes** les tuiles prêtes et repart des racines : **12 à 21 secondes** de
rechargement réseau mesurées. Rien dans ce diagnostic ne l'appelle.
⚠️ `_purgerFile` ne touche que les entrées encore en chargement, **jamais une
tuile prête** — c'est ce qui la rend sûre. Garde cette propriété.

⛔ **Ne touche pas au travail de la Tâche N** dans `_traverse` : il est bon,
mesuré, et relu.

⚠️ **DIS LA VÉRITÉ SUR LE PLANCHER.** Le code impose que, pour afficher une
tuile, ses parents jusqu'à la racine existent, et la règle sans-trou
(`kids.every(ready)`, `globe.js:6203`) exige que **toutes** les tuiles pavant le
crop au zoom courant soient prêtes. **Le plancher est « les tuiles du crop », pas
une.** Si ton relevé montre qu'on en est encore loin, dis de combien.

---

## 4. LES RÈGLES DE CE CHANTIER, PAYÉES CHER

- ⛔ **N'invente aucun chiffre.** **Vingt-six ont été retirés par leurs propres
  auteurs ici.** « Non mesuré » est une réponse acceptable.
- ⛔ **Une concordance au défaut n'est pas un branchement** : prouve en DÉPLAÇANT
  la valeur, dans les deux sens.
- ⛔ **Une assertion qui lit le TEXTE SOURCE ne prouve rien** — une mutation a
  survécu à **4 082 tests** parce que la garde était une expression régulière sur
  le source. **Teste le COMPORTEMENT.**
- ⛔ **Un `return` muet rend un test vert et indistinguable d'un test qui a lu.**
- ⚠️ **Une mesure de réseau ment facilement** : le bruit entre deux chargements a
  déjà atteint **33,28 %** sur ce chantier. **Répète tes relevés et donne la
  dispersion**, pas un tirage unique.
