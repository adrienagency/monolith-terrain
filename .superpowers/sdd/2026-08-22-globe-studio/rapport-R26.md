# R26 — LES TUILES QUI RESTENT `empty` : L'ALARME ÉTAIT FAUSSE

Arbre : `C:\Dev\wt-tv` · branche `tuiles-vides` · serveur `npm run dev` sur
**5711**. Sondes : `scripts/sonde-tuiles-vides-r26.mjs` (le recensement) et
`scripts/sonde-porte-r26.mjs` (les deux portes). Journaux : `.banc/R26/`.

---

## ⚡ LE DÉPARTAGE, TRANCHÉ — LA PREMIÈRE LIGNE DU TABLEAU DU BRIEF

> | si… | alors |
> |---|---|
> | les 4 à 9 tuiles sont **hors champ / hors distance** | la porte du banc est fausse ; le moteur est sain |

**C'est cette ligne-là.** Les tuiles résiduelles **ne sont demandées par
personne**, et **c'est la porte du banc qui est fausse** — pas le moteur.

⛔ **L'alarme de R21, et donc celle du brief, était fausse.** Il n'y a ni fuite
de places, ni requête qui ne revient jamais, ni cycle d'échec. Je l'écris comme
le brief le demande : **c'est un bon résultat.**

### Le relevé, au repos (3 chargements, 1 280 × 720, La Réunion par défaut)

| | valeur |
|---|---|
| entrées de cache | **112** sur **1 700** (`cacheMax`, régime continu) — **6,6 %** |
| `ready` | 106 à 108 |
| `loading` | **0** |
| `error` | **0** |
| **`empty`** | **4 à 6**, dont **`empty` FRAÎCHES (`lastUsed === frame`) : 0** |
| `empty` **périmées** (`lastUsed < frame`) | **4 à 6**, âge **3 870 à 5 066 images** |
| refus de raffinement faute de crédit (`_refus`) | **0**, cumulé sur 5 103 images |
| refus de file (`_refusFile`) | **0** |
| attentes de sonde de couverture | **0** |
| crédit restant en fin de parcours | **1 619** sur 1 700 |
| évictions (`_evictJusqua`) | **0** — le cache ne s'approche jamais du budget |

⚡ **Le chiffre `112 / 0 loading / 4 empty` est EXACTEMENT celui que R21 avait
publié** (`rapport-R21.md`, chasse 3 : *« tuiles = 112/0/4 »*). Le banc est
reproduit au tuile près avant d'être contredit.

### Demandées ou non ? — la question du brief, répondue à la source

**Elles l'ont été, puis elles ont cessé de l'être.** `t.demandee` est défini sur
les six (donc elles sont bien parties sur le réseau un jour), et **aucune** ne
porte de refus : `_request` a été appelée **112 fois, acceptée 112 fois, refusée
0 fois** — ni quarantaine, ni plafond de file, ni attente de sonde.

⛔ **Et surtout : plus personne ne les offre à `_request`.** Le discriminant est
`lastUsed` : leur dernière visite remonte à l'image ~40 sur 5 100.
`_traverse` les écarte **à sa toute première ligne** (`_horsCropSeul`) — elles
sont **hors du crop**.

### Le mécanisme exact, nommé par un détecteur de transitions

Je n'ai pas supposé l'écrivain : j'ai gardé l'état de chaque clé d'une image à
l'autre et compté **toute** transition `X → empty`, quel qu'en soit le chemin.

```
versEmpty { purge: 0, annule: 29, reessai: 0, recharge: 0, total: 29, de_loading: 29 }
transitions : 12/2680..2684 / 2293..2297, aux images 10, 41 et 70, horsCrop: true
```

**29 transitions, toutes `loading → empty`, toutes par `_annuler`, aux trois
premières secondes du chargement.** Le seul appelant hors éviction est
**`demanderEmprise`** (`src/monde/flux-terrain.js:424`, étape 2 : *« ce qui sort
de l'emprise sort de la file »*).

➡️ **Le récit complet, et il tient en une phrase :** au chargement, le socle
réclame une emprise, puis une autre, puis une troisième pendant que la première
vole encore ; à chaque changement, `_annuler` sort de la file ce qui n'est plus
réclamé et **le rend à `empty`** — le seul état d'où `_request` sait repartir.
Ces tuiles-là sont le **liseré** de l'emprise précédente ; elles tombent hors du
crop, donc `_traverse` ne les regarde plus, donc personne ne les redemande.
**Ce n'est pas un défaut : c'est un abandon propre.**

⚡ **Et `_annuler` n'a d'effet QUE sur ce qui est encore dans la file** — une
tuile déjà `ready` qui sort de l'emprise reste `ready`. C'est pourquoi le résidu
naît **au chargement** (le crop se pose pendant que le socle vole) et pas quand
on déplace une emprise déjà servie. Ce point m'a coûté un test rouge ; il est
maintenant épinglé.

### Les places : combien sur combien, et est-ce que ça retient quoi que ce soit

**4 à 6 entrées sur 1 700, soit 0,24 % à 0,35 % du budget** — et **elles ne
retiennent rien pour de bon** : `_bloquee` les reprend au **rang 0** de
l'éviction (`state === 'empty' && lastUsed !== frame`), donc ce sont les
**premières** victimes le jour où le cache saturerait. Un test le fixe.

⛔ **Il n'y a donc AUCUN point fixe.** Le brief craignait `crédit = capacité −
occupé` gelé à zéro : mesuré **dans la boucle**, le crédit restant vaut **1 619
sur 1 700** en fin de parcours et `_refus` vaut **0 sur 5 103 images**. Le motif
de `/threejs-optimisation` §2 ne s'applique pas ici — il s'appliquait à l'ancien
défaut de ce dépôt, qui est corrigé.

---

## ⏱ EST-CE QUE ÇA GRANDIT ? — relevé à 1, 5 et 15 minutes D'USAGE

⚠️ **Au repos strict, la question ne se pose pas** : rien ne change l'emprise,
donc rien ne peut fuir. Mesuré quand même — **20 images consécutives, série
identique** (`[4,4,4,…,4]`), sur 3 952 images : `min 0 · max 16 · série 4`. Le
système **n'oscille pas** ; le max de 16 est le transitoire de chargement.

Le relevé qui compte est donc celui **sous usage** : glissers + molette en
continu, une page unique, sans rechargement.

| jalon | entrées de cache | `ready` | `empty` fraîches | **`empty` périmées** | Δ | `loading` | `error` | `_refus` | `_refusFile` | évictions |
|---|---|---|---|---|---|---|---|---|---|---|
| **t + 1 min** | 636 / 1 700 | 599 | **0** | **37** | — | 0 | 0 | 0 | 0 | 0 |
| **t + 5 min** | 712 / 1 700 | 684 | **0** | **28** | **−9** | 0 | 0 | 0 | 0 | 0 |
| **t + 15 min** | 780 / 1 700 | 746 | **0** | **34** | **+6** | 0 | 0 | 0 | 0 | 0 |

⛔ **ÇA NE GRANDIT PAS. ÇA OSCILLE ENTRE 28 ET 37.** Quinze minutes de glissers et
de molette en continu, et la population résiduelle **redescend** entre la
première et la cinquième minute. Ce n'est pas une fuite : c'est un **liseré qui
se renouvelle** — les tuiles abandonnées par l'emprise précédente sont reprises
dès que la caméra repasse dessus.

⚡ **Et la stabilité est vérifiée sur 20 images consécutives à chaque jalon**, comme
le brief l'exige : `[37 × 20]`, `[28 × 20]`, `[34 × 20]`. **Aucune oscillation
image à image** — pas de cycle de période 4.

⚠️ **CE QUI GRANDIT, C'EST LE CACHE `ready`** (599 → 684 → 746), et c'est son
travail : chaque nouvelle région visitée y entre. À quinze minutes d'usage
soutenu il occupe **46 % du budget** ; `_evictJusqua` **n'a pas tourné une seule
fois**. Le crédit de raffinement en fin de parcours vaut **1 639 sur 1 700**.

### ⚠️ Deux réserves honnêtes sur ce relevé

1. **La page a rechargé deux fois** (à 189 s et 216 s ; un de mes glissers a dû
   déclencher une navigation). L'instrument a été reposé à chaque fois, et le
   compteur d'images repart. **Le segment propre est t+5 min → t+15 min** : une
   seule page, **33 901 images consécutives**, 28 → 34 tuiles périmées. C'est ce
   segment qui porte la conclusion « ça ne grandit pas » ; le point t+1 min vient
   d'une page antérieure et je ne le présente pas comme le début d'une série
   continue.
2. **La cause dominante change avec le régime**, et c'est cohérent :
   `horsCrop` au repos, `horsFrustum` (29) + `horsHorizon` (8) en plein
   panoramique. **`dansLeChamp` vaut 0 à tous les relevés**, sans exception :
   aucune tuile résiduelle n'est à la fois dans le crop, devant l'horizon et
   dans le tronc de vue.

### Le deuxième écrivain, que seul l'usage révèle

Au repos, `_purgerFile` ne s'exerce jamais (`purgees = 0`). Sous usage il devient
**majoritaire** : `versEmpty { purge: 264, annule: 31 }` à la première minute.
C'est la même famille — une entrée de file que l'image courante n'a pas demandée
est rendue à `empty`, et si la caméra ne revient pas, personne ne la redemande.
**Aucun refus dans les deux régimes** : `_refus` 0, `_refusFile` 0, quarantaine 0
(8 à 28 attentes de sonde de couverture, toutes résolues).

---

## 🚪 CE QUE LES 45 SECONDES ACHETAIENT — mesuré AVANT de corriger

`scripts/sonde-porte-r26.mjs` lance **les deux portes au même instant**, chacune
avec son chronomètre — sans quoi la première décalerait la seconde.

| chargement | voile parti | **porte NEUVE** | **porte ANCIENNE** | tuiles arrivées après la neuve, en 45 s | requêtes | `tuilesEnVol` max |
|---|---|---|---|---|---|---|
| #1 | 6 472 ms | **2 443 ms** | **45 006 ms — EXPIRÉE** | **0** | **0** | **0** |
| #2 | 3 149 ms | **1 214 ms** | **45 015 ms — EXPIRÉE** | **0** | **0** | **0** |
| #3 | 3 384 ms | **1 319 ms** | **45 010 ms — EXPIRÉE** | **0** | **0** | **0** |
| **moyenne** | **4 335 ms** | **1 659 ms** | **45 010 ms** | | | |

⛔ **La porte d'origine expire 30 fois sur 30** : 24 chargements chez R21, 3 dans
mes relevés de repos, 3 ici. **Sans une seule exception**, comme R21 l'avait écrit.

⚡ **ET LES 45 SECONDES N'ACHETAIENT RIEN — c'est le résultat qui autorise la
correction.** Le commentaire de `sonde-lumiere-r21.mjs` interdisait de corriger
la porte sans re-mesurer le plancher de bruit publié derrière elle. Mesuré
autrement, et plus directement que par le plancher : **entre la fermeture de la
porte corrigée et la 45ᵉ seconde, 0 tuile n'arrive, 0 requête ne part, et
`tuilesEnVol` ne remonte jamais au-dessus de 0**, sur les trois chargements.
La scène était déjà posée à 1,7 s. **Les chiffres de `rapport-R21.md` ne sont
donc pas invalidés** — ils restent reproductibles avec la porte corrigée.

### ⏱ LE TEMPS GAGNÉ — et ce n'est PAS du temps de chargement

⛔ **Zéro milliseconde gagnée à l'écran.** Le défaut était dans le banc, pas dans
le moteur : rien de ce qui a changé ne touche ce que voit un visiteur. **Le
chargement de l'application n'est pas plus rapide, et je ne prétends pas qu'il
le soit.**

⚡ **43,4 secondes gagnées PAR MESURE DE BANC** (45 010 − 1 659 ms, moyenne sur
3 chargements). Sur les 144 passes des trois chasses de R21 bis, cela représente
**environ 1 h 44 d'attente pure**. Multiplié par les trois sondes concernées et
par le nombre de tours de cette campagne, c'est le vrai coût du défaut.

⚠️ **Les temps de chargement ci-dessus (4,3 s en moyenne) ne valent que comme
ordre de grandeur** : un autre agent travaillait en parallèle sur `C:\Dev\wt-mat`
pendant ces mesures, et le brief est formel — *une mesure de chargement prise
pendant une campagne parallèle ne vaut rien*. **Le gain de 43,4 s, lui, ne
dépend pas du réseau** : il oppose une attente bornée par un état interne à un
délai d'expiration fixe.

---

## 🔧 LES CORRECTIFS, ET L'ORDRE

⚠️ **L'ORDRE EST LE SUJET, ET IL EST PLUS COURT QUE PRÉVU.** Le brief prévient :
*« réduis d'abord ce qui entre dans le cache, souvent le second correctif devient
inutile »*. Ici **il n'y a pas de second correctif** : ce qui entre dans le cache
n'a pas besoin d'être réduit (112 tuiles pour 1 700 places, 0 raffinement refusé),
et le budget n'a pas besoin d'être desserré (crédit restant 1 619/1 700).
**Toucher au cache ou au budget aurait été le correctif juste appliqué au mauvais
défaut** — la variante du piège d'ordre que le brief décrit.

### ① `Globe.tuilesEnVol()` — une seule définition, dans `src/globe.js`

Le correctif n'est pas « réécrire la formule dans les sondes » : c'est **retirer
la formule des sondes**. Elle vit désormais dans le moteur, où `npm test` la garde.

```js
tuilesEnVol() {
  let n = this.queue.length + this.inFlight
  for (const t of this.tiles.values()) {
    if (t.state === 'loading') n++
    else if (t.state === 'empty' && t.lastUsed === this.frame) n++
  }
  return n
}
```

⚡ **Le discriminant est `lastUsed`, et il porte les deux moitiés du contrat :**
une `empty` **fraîche** attend encore quelque chose (une sonde de couverture, un
créneau de file, la fin d'une quarantaine) et `_traverse` la redemandera à
l'image suivante — **l'image va donc encore changer, la porte doit rester
ouverte**. Une `empty` **périmée** n'attend rien ni personne.

⚠️ `queue.length` et `inFlight` sont comptés **en plus** des `loading`. C'est un
double comptage assumé : la seule lecture utile est « est-ce zéro », et ces deux
termes gardent la porte fermée si une entrée de file survivait à sa tuile.

### ② Les **TROIS** sondes appellent la même méthode

Le brief en annonçait deux. `grep` sur la formule en rend **trois** :

| sonde | état |
|---|---|
| `scripts/sonde-lumiere-r21.mjs` | corrigée |
| `scripts/sonde-transitoire-r21bis.mjs` | corrigée, + `emptyPerimees` journalisées à côté de `enVol` |
| **`scripts/sonde-paroi-r21bis.mjs`** | **corrigée — personne ne l'avait vue** |

### ③ Ce que je n'ai **pas** corrigé, et pourquoi

⛔ **Je n'ai pas fait disparaître les `empty` périmées.** C'était tentant : les
supprimer de la `Map` dans `demanderEmprise` rendrait l'invariant « zéro `empty`
au repos » vrai, et la formule d'origine se fermerait. **Ce serait corriger le
moteur pour arranger le banc.** Trois raisons mesurées :

1. l'état `empty` est **le seul d'où `_request` sait repartir** — c'est écrit
   trois fois dans `globe.js`, et une tuile supprimée devrait être recréée ;
2. supprimer l'entrée rendrait `_enfantsPresents` faux pour son parent, qui
   **repaierait 4 crédits** à chaque retour de caméra ;
3. elles coûtent **0,24 à 0,35 % du budget** et sont **rang 0** à l'éviction.

⚠️ **D17 s'applique : il n'y a pas de production à protéger.** Ce n'est donc pas
de la prudence, c'est un arbitrage de coût : le défaut coûtait 45 s **par mesure
de banc** et **0** à l'écran.

---

## ✅ LES TESTS

### Trois tests, dans `test/flux-terrain.test.js` — le fichier dont c'est déjà le sujet

⚠️ **Pas un nouveau fichier, et c'est un choix.** Le harnais qui sait faire voler
des tuiles sur une horloge virtuelle (`neuf()`, `avancer()`, `demanderEmprise`)
vit déjà là. Le recopier ailleurs aurait fabriqué la même duplication que celle
qui a laissé la porte fausse vivre dans trois sondes. **Corollaire pratique :
`package.json` n'a pas bougé, donc aucun risque qu'un test absent de la liste ne
tourne jamais** — `npm run audit:tests` : **237 listés · 237 sur disque · aucun
écart.**

| ligne | test |
|---|---|
| `flux-terrain.test.js:1128` | **la porte d'origine ne peut PAS se fermer** — la formule fautive est recopiée telle quelle dans le test, et le test vérifie **qu'elle reste > 0** ; il vérifie aussi que ces tuiles sont bien rang 0 à l'éviction (`_bloquee`) |
| `flux-terrain.test.js:1153` | **`tuilesEnVol` compte ce qui vole et retombe à zéro** — puis, après deux déplacements d'emprise **en plein vol**, les deux formules divergent |
| `flux-terrain.test.js:1179` | **`tuilesEnVol` ne coupe pas trop tôt** — sous `PLAFOND_FILE`, une `empty` **fraîche** est comptée |

### ⚡ VÉRIFIÉS PAR MUTATION — « cassez le code, s'il passe encore il décore »

| mutation de `tuilesEnVol` | résultat |
|---|---|
| retirer la clause `empty && lastUsed === frame` (la porte ignore toutes les `empty`) | **1 test rouge** (`ne coupe pas trop tôt`) |
| compter toutes les `empty` (retour à la formule d'origine) | **2 tests rouges** |

### La suite complète

```
npm test          →  4 576 tests · 0 échec   (base à battre : 4 573 · 0)
npm run audit:tests → 237 listés · 237 sur disque · aucun écart
```

⚠️ **Les assertions qui bordent le cache ont été relues AVANT de corriger**, comme
le brief l'impose : `test/flux-terrain.test.js` épinglait déjà « une tuile
annulée redevient `empty` » et « l'éviction reprend les `empty` périmées ».
**Aucune n'écrivait le défaut comme un contrat** — il n'y avait rien à
déverrouiller.

⚠️ **Édition en binaire, octets relus.** Tous les scripts d'édition de cette
tâche écrivent en `newline=''` et chaque motif est vérifié par `assert` avant
remplacement ; une recherche d'octet 0x0D rend **0** sur les cinq fichiers
touchés.

⚡ **ET LE PIÈGE A MORDU DANS CE RAPPORT MÊME.** En écrivant la phrase ci-dessus,
mon script a posé un **retour chariot réel (0x0D)** là où je croyais écrire les
cinq caractères d'une commande. C'est mot pour mot l'incident du `` devenu un
retour arrière, cité par le brief. **Trouvé en relisant l'octet, pas en relisant
le texte** — à l'écran, la ligne était parfaite.

---

## 🧠 CE QUE J'AI CRU PUIS RÉFUTÉ

### ① J'ai cru que `_rechargeTuiles` était le coupable. ⛔ RÉFUTÉ.

Le brief cite trois chemins `loading → empty` (7161, 7202, 7238). En lisant, j'en
ai trouvé un **quatrième**, non cité : `_rechargeTuiles` (`globe.js:8077`) rend
à `empty` **toutes** les tuiles prêtes puis ne redemande que les seize racines.
Le raisonnement était beau : `setExaggeration` est appelé au chargement, donc le
résidu serait le reliquat d'un rechargement. Il collait même avec
`retried: false` (que `_rechargeTuiles` remet à zéro).

**Mesuré : `nbRecharges = 0`.** `_rechargeTuiles` n'est appelé **aucune fois**
après la pose de l'instrument. L'explication était *commode* et *fausse* —
exactement l'avertissement du brief (« ne conclus pas sur une hypothèse qui
réconcilie joliment les faits »). C'est le détecteur de transitions, posé parce
que je me méfiais de ma propre liste d'écrivains, qui a nommé le vrai.

### ② J'ai cru que les trois écrivains cités par le brief étaient les seuls. ⛔ RÉFUTÉ.

Le vrai écrivain, `demanderEmprise` → `_annuler`, vit dans **un autre fichier**
(`src/monde/flux-terrain.js`). Un `grep` de `_annuler` limité à `src/*.js` le
manque : il faut `src/`. C'est le §1 de `/threejs-optimisation` mot pour mot —
*« les plus gros défauts sont hors du fichier audité »*.

### ③ J'ai cru que le brief avait raison sur « deux sondes ». ⛔ RÉFUTÉ : il y en a TROIS.

`grep` sur la formule fautive rend **`sonde-lumiere-r21.mjs`,
`sonde-transitoire-r21bis.mjs` ET `sonde-paroi-r21bis.mjs`**. La troisième
temporisait 45 s elle aussi, sans que personne ne l'ait jamais noté. C'est
l'argument de la définition unique en une ligne : **une formule recopiée se
corrige autant de fois qu'elle a été recopiée, et on en oublie une.**

### ④ J'ai cru pouvoir écrire le test « l'emprise bouge → des `empty` restent ». ⛔ RÉFUTÉ par mon propre test.

Premier jet : charger une emprise **en entier**, puis la déplacer, et constater
le résidu. **Rouge.** `_annuler` ne touche que ce qui est **encore dans la
file** ; une tuile `ready` qui sort de l'emprise reste `ready`. Le résidu exige
que l'emprise bouge **en plein vol** — ce qui est précisément la situation du
chargement, et pas celle d'un panoramique sur une scène posée. Le test rouge a
corrigé ma description du mécanisme, pas l'inverse.

### ⑤ J'ai cru que `_credit` lu après `update()` dirait quelque chose. ⛔ ÉCARTÉ D'AVANCE.

Le brief prévient qu'une sonde posée après la fonction lit un état écrasé. Ici
c'est pire que « écrasé » : `_credit`, `_refus`, `_refusFile`, `_attentesSonde`
et `_purgees` sont **remis à zéro au début** de `update()`. Un `page.evaluate`
tombe sur une image quelconque, souvent une image où rien ne s'est passé.
**Tout l'instrument de cette tâche est donc DANS la boucle** : enveloppé autour
de `update` (recensement à la sortie, dans le même appel) et autour de
`_request` (état avant/après + delta des deux compteurs de refus, ce qui **nomme
la cause** au lieu de la deviner). Le piège n'a pas mordu parce qu'il était
nommé ; je le consigne pour la suivante.

### ⑥ Ce que je n'ai PAS mesuré, et que je ne prétends pas savoir

- **La règle sans-trou n'est pas en cause ici** — le brief demandait de le dire
  si elle l'était. `kids.every(ready)` fait bien charger quatre tuiles pour une,
  mais aucune des tuiles résiduelles ne l'attend : elles ne sont **pas
  parcourues du tout**. Je ne l'innocente pas en général, je dis qu'elle n'a
  aucun rôle dans **ce** phénomène.
- **La classification `dansLeChamp` du recensement a une limite connue.** Elle
  rejoue les trois tris de `_traverse` sur la tuile elle-même, mais une tuile
  peut aussi n'être jamais atteinte parce que **son parent n'a pas voulu se
  refendre**. Sur tous les relevés, `dansLeChamp` vaut **0**, donc l'ambiguïté
  ne s'est jamais présentée — mais si une tranche future y lit un chiffre non
  nul, **ce ne sera pas une preuve de fuite**.


---

## 📌 CE QUI RESTE OUVERT

- ⚠️ **Deux rechargements de page inexpliqués** pendant le banc d'usage (189 s et
  216 s), sur un glisser. Ce n'est pas dans mon périmètre (le cache), mais une
  page qui recharge sous un geste mérite d'être regardée — c'est peut-être le
  parent du défaut déjà listé « le clic sur le globe qui saute onze fois ».
- ⚠️ **Les chiffres publiés par R21 restent valables** (mesuré ci-dessus : les
  45 s n'achetaient rien), **mais un relevé d'AVANT R26 ne se compare pas à un
  relevé d'APRÈS sur le temps de préparation** : ce n'est pas la scène qui a
  changé, c'est le banc. La note est posée dans l'en-tête de
  `sonde-transitoire-r21bis.mjs`.
- ⚡ **Le bras `--sans-porte` de `sonde-transitoire-r21bis.mjs` perd son intérêt.**
  Il existait pour retirer une attente de 45 s ; il ne retire plus que ~1,7 s. Je
  ne l'ai pas supprimé — il reste le témoin « sans aucune attente » — mais son
  en-tête le dit désormais.

## 📝 LES COMMITS, SUR `tuiles-vides`

1. **`18dbca2`** — *la porte des bancs est fausse, et `tuilesEnVol` la remplace
   par une seule définition* : la méthode dans `src/globe.js`, les deux sondes
   annoncées, les trois tests, les deux sondes de mesure de R26.
2. **`8da10d2`** — *une TROISIÈME sonde portait la même porte fausse*.
3. le présent rapport.
