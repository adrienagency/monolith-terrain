# RAPPORT CIB — LA CIBLE : le centre d'abord, la périphérie en basse définition

Branche `cible-tuiles` (arbre `C:\Dev\wt-cib`). Terrain : `src/globe.js`
(`_priorite`, `_distanceEcran`, `_traverse`, `_deciderBarriere`, `planTuile`,
`fetchTile`) et `src/dem-source.js` (la mémoire des trous de couverture). Rien
dans `modes.js`, rien dans les seuils, rien chez les rivières.

> Adrien, 2026-09-04 : *« Les tuiles à charger en priorité sont celles au centre
> de l'écran. (…) une sorte de cible. (…) Dans un premier temps, on peut charger
> uniquement une version low def sur les tuiles non prioritaires, qui ne se
> chargent que quand les tuiles prioritaires ont totalement terminé leur
> chargement. »*

## LE RÉSUMÉ, EN CINQ LIGNES

1. **La cible existait déjà** (PF2). La loi est une décroissance **continue** de
   la distance écran, tracée ici sur 44 tranches de 0,1 NDC. **Rien à changer.**
2. **La basse définition de périphérie existait déjà** (R37 + règle sans-trou) :
   l'ancêtre couvre. **0 trou** sur toutes les descentes, avec la barrière comme
   sans. **Rien à écrire.**
3. **La barrière d'ordonnancement, elle, n'existait pas.** Elle est écrite,
   testée (19 tests), mesurée — et **livrée DÉBRAYÉE**, parce que la mesure dit
   qu'elle **dégrade** le chiffre d'Adrien sur le réseau lent, qui est justement
   le régime que D22 vise.
4. **Le taux d'occupation des créneaux ne tombe pas** (93,2 → 92,6 %) : le
   garde-fou anti-créneau-vide fait son travail. Ce n'est pas lui, le coupable.
5. **Le 404 → AWS** est en place, mais son plafond mesuré est de **7 à 21
   requêtes par descente**, pas les 40 % espérés : les 404 de PF2 sont
   massivement des **premières rencontres**, pas des descendants.

---

## 0. LE BANC — en quoi il diffère de la production

**Sonde** : `scripts/sonde-cib.mjs` (en-tête du fichier : ce qu'elle relève et
pourquoi). Chrome sans tête `--headless=new --use-angle=default`, 1280 × 720,
pixelRatio 1, **serveur `vite` de DEV sur 127.0.0.1:7621** (modules non groupés),
Windows 11, machine **partagée** avec deux autres agents (`wt-cr1`, `wt-riv3`).

**Trois lieux**, posés par `gotoCtl.go` : **Chamonix** (montagne, couverture
Mapterhorn fine), **Nice** (côte : de la mer dans des zones z8 couvertes, donc
des 404 tuile par tuile), **Ajaccio** (île, encore plus de mer).

**Le geste** : altitude posée au bouton vers 590 km, puis **rafale de molette
(40 ms)** jusqu'à 12–15 km — celui de PF2 et de R37. ⚠️ Il est **inertiel, donc
non déterministe** : d'un tirage à l'autre la même consigne rend 550 à 3 400
images et 7,5 à 12 s de geste. **Les fractions et les comptes se comparent ; les
temps absolus, non** — et c'est le nœud de ce rapport (§4).

**L'A/B est un levier de session** (`globe.barriereCible`, `?trous=0`), tirages
**entrelacés** (b0, b1, b0, b1…), **une session neuve par tirage** (un Chrome par
course). Traces brutes : `.banc/CIB/*.json` (ignoré par git).

**Deux régimes**, et le second est celui qui décide :

| régime | ce qu'il représente | goulot mesuré |
|---|---|---|
| **liaison libre, CPU ×4** | une machine lente sur une bonne connexion | le CPU (créneaux vides 15–26 % du temps) |
| **liaison bridée à 1,5 Mb/s, CPU ×1** | le « réseau lent » que l'application classe elle-même chez PF2 (1,4–1,6 Mb/s) | **les six créneaux** (vides 5,4 % du temps) |

⚠️ Le bridage se pose **après** le chargement de la page :
`Network.emulateNetworkConditions` ne sait pas exempter un hôte, et posé au
départ il bride aussi le serveur de dev — l'application ne démarre jamais (90 s
de délai dépassé, mesuré, quatre courses perdues).

---

## 1. ① LA COURBE DE PRIORITÉ — tracée, et le verdict

La loi de PF2, telle qu'elle est écrite :

```
p(d) = 1000 − 1000 × min(d, 4)/4 + (MAX_Z − z) × 0,1
```

où `d` est la distance NDC du **bord** de la tuile (centre projeté moins rayon
projeté) au centre de l'écran. **Tracée sur une descente réelle** (nuage des
3 453 entrées de file suivies, Chamonix, CPU ×4, médiane par tranche de 0,1 NDC) :

| d (NDC) | 0 | 0,2 | 0,4 | 0,6 | **0,798 (R_CIBLE)** | 1,0 | 1,5 | 2,0 | 3,0 | ≥ 4 |
|---|---|---|---|---|---|---|---|---|---|---|
| clé mesurée (médiane) | 1001 | 943 | 902 | 848 | **≈ 800** | 749 | 624 | 499 | 252 | 0,2 |

**44 tranches, 42 strictement décroissantes** ; les 2 restantes sont **au-delà de
d = 4**, où la loi est écrêtée par dessein (tout ce qui est à plus de quatre
unités NDC est hors du tronc de toute façon). Écart maximal à la droite : **0**
— la loi est exactement affine, pas un palier.

**Verdict : la cible existait déjà, et elle est continue.** Il n'y avait pas de
seuil binaire à remplacer.

⚠️ **Et la réécrire n'aurait RIEN changé, pour une raison qui n'est pas une
opinion** : la file est **triée**, et un tri ne voit que l'ORDRE. Toute fonction
strictement décroissante de `d` — linéaire, gaussienne, en 1/d² — produit
**exactement la même file**. Rendre la cible « plus piquée » est un no-op
arithmétique. Ce qui change le comportement, c'est un **seuil** (la barrière),
pas une **forme**. C'est écrit dans `test/globe-cible.test.js` ① pour que
personne ne repasse par là.

**Le seul défaut de forme trouvé**, et il est bénin : le départage par niveau
(`(MAX_Z − z) × 0,1`, jusqu'à 1,3 point) vaut **0,0052 NDC** de distance écran.
Il peut donc inverser deux tuiles distantes de moins de 5 millièmes d'écran.
Invisible dans un tri — mais **il n'a rien à faire dans un seuil** : la barrière
se compare donc à `_distanceEcran`, la grandeur géométrique nue, extraite pour
l'occasion.

### Le rayon de la cible, dérivé

L'écran est le carré NDC `[−1, 1]²`, d'aire 4. Le disque qui couvre **la moitié
des pixels** vérifie `π R² = 2`, donc

```
R_CIBLE = √(2/π) = 0,7979 NDC
```

Aucun réglage : « la moitié de l'écran » est une phrase, pas un nombre. Il tombe
entre le garde-fou de la prélecture (0,6 NDC, R37) et le disque inscrit (1,0),
et reste sous la demi-diagonale (1,414). Vérifié par test.

---

## 2. ② LA BASSE DÉFINITION DE PÉRIPHÉRIE — acquise, avec la mesure qui tranche

**Elle est acquise, et c'est le parent.** La règle sans-trou (avant R37) et le
raffinement partiel (depuis R37) garantissent que tout point de planète visible
est dessiné par la tuile la plus fine **disponible** — donc par un ancêtre tant
que l'enfant n'est pas là. C'est mot pour mot la « version low def » d'Adrien,
et elle ne coûte pas une requête.

La mesure qui tranche, sur une grille de **32 × 18 points d'écran** séparée en
deux populations par `R_CIBLE`, pendant toute la descente :

| | Chamonix | Nice | Ajaccio |
|---|---|---|---|
| **trous — planète visible sans aucune tuile dessinée** | **0** | **0** | **0** |
| trous en PÉRIPHÉRIE, max par image | **0** | **0** | **0** |
| images avec au moins un trou | **0** | **0** | **0** |
| retard ≥ 1 niveau, CENTRE (moyenne) | 5,6 % | 6,2 % | 6,3 % |
| retard ≥ 1 niveau, PÉRIPHÉRIE (moyenne) | 11,2 % | 12,3 % | 13,2 % |

**La périphérie est deux fois plus en retard que le centre, et jamais vide.**
C'est exactement « basse définition en périphérie, haute au centre » — déjà, sans
barrière. Et sous barrière (§4) la couverture ne bouge pas : trous toujours **0**.

**Il n'y avait donc pas de seconde mécanique à écrire, et je n'en ai pas écrit.**
Le test ② le verrouille : sous barrière forcée et réseau tenu, dix images de
suite, quelque chose est toujours dessiné.

---

## 3. ③ LA BARRIÈRE — ce qui est livré

### Où elle est posée, et pourquoi pas ailleurs

⚠️ **Dans `_traverse`, à l'admission du raffinement — PAS dans `_pump`.** Le
brief le dit avant la mesure et la mesure le confirme : retenir dans la pompe une
entrée **déjà enfilée** ne peut faire qu'une chose, laisser un créneau vide. Or
« annuler six requêtes ne rachète rien ; vider la file rachète tout » (PF2).
Posée à l'admission, la barrière empêche la périphérie **d'entrer** dans la file :
les six créneaux vont aux descendants du centre, que le parcours produit en
abondance, et le **crédit de cache** part au centre aussi — c'est l'ordre du §5
de `/threejs-optimisation` (« réduis d'abord ce qui entre »).

### Ce qu'elle retient exactement

`_barriereRetient(t)` = la barrière est armée **et** `t` est hors de la cible
**et** `t` n'a **aucun** enfant en cache.

- **Hors de la cible** : `_distanceEcran(t) > R_CIBLE`.
- **Aucun enfant** — et pas « pas les quatre » : un enfant déjà parti a déjà pris
  son créneau. Le retenir lui ferait perdre son `lastUsed`, donc sa protection
  contre l'éviction et la purge de file : on paierait sa requête **deux fois**.
- **Conséquence structurelle** : la barrière **ne peut jamais rendre un pixel
  plus grossier qu'il ne l'était**. Elle diffère des requêtes ; elle n'efface
  rien. C'est ce qui la rend compatible avec R37, dont tout le travail a été de
  tuer le recul.

### Quand elle est armée — et les trois garde-fous

`_deciderBarriere(dt)`, appelée **en tête d'image**, sur le vol du moment :

```
armée  ⟺  le centre attend (`_centreEnAttente` > 0, relevé DANS `_traverse`)
      ET  inFlight + queue ≥ MAX_CONCURRENT      ← anti-créneau-vide
      ET  pas d'échéance anti-famine dépassée
      ET  le crédit n'a rien refusé à l'image d'avant
```

⚠️ **En tête d'image, et c'est une mesure qui l'a décidé.** Ma première version
décidait en fin d'image. `test/globe-eviction` ⑤ enchaîne `update()` puis un
**drain complet** du réseau : la décision de fin d'image lisait donc six créneaux
pourvus, et le parcours suivant appliquait cette barrière-là à un vol déjà vide.
Résultat mesuré : **cycle de période 2** — tuiles dessinées oscillant entre 328
et 337 sur 20 images, et **12 requêtes caméra strictement immobile** là où le
contrat dit 0.

⚠️ **Le garde-fou du crédit n'est pas décoratif non plus.** À cache saturé,
`_credit < 4` refuse le raffinement du **centre** : `_centreEnAttente` ne retombe
jamais à zéro, la barrière tient pour toujours, la périphérie retenue perd son
`lastUsed`, s'évince, se redemande. Le même cycle limite, par une autre porte.
La barrière est un ordonnanceur de **réseau** ; quand le goulot est le cache,
elle n'a rien à y faire — §5 de la compétence, mot pour mot.

### L'échéance anti-famine — et sa mesure

⚠️ **Elle se compte en ABSENCE DE PROGRÈS, pas en durée.** Une barrière qui se
lève « au bout de 1,5 s » se lèverait sur une descente **saine** dès que le
réseau traîne (les tirages à 2 s de vol médian de PF2). Le compteur repart à zéro
**chaque fois que le centre avance** d'une tuile ; l'échéance ne tombe donc que
sur un centre **réellement bloqué**.

`BARRIERE_ECHEANCE_MS = 1500` — au-delà du vol médian des bancs sains (156 à
487 ms, PF2 §3), en deçà de ce qu'un œil appelle « ça ne vient jamais ».

**Session de famine mesurée** (`--famine 1` : toutes les tuiles ≥ z11 sont
avortées au protocole CDP — le cas d'Adrien, « si le centre échoue », et non une
coupure globale) :

| grandeur | valeur |
|---|---|
| niveau final atteint au centre | z8 (le centre **n'aboutit jamais**) |
| **échéances déclenchées** | **2** |
| **images où la barrière est DÉSARMÉE par la famine** | **3 540** |
| images où la barrière tient malgré tout | 9,7 % |
| absence de progrès, maximum | 60 337 ms |
| **trous à l'écran** | **0** |
| retard, centre et périphérie | 97 % (tout est grossier — le réseau est coupé) |

**La périphérie n'est pas restée bloquée** : passé l'échéance, la barrière tombe
et se réarme au premier progrès. C'est le contrat, et il est tenu sur la seule
session où il pouvait se mesurer.

### Le taux d'occupation des créneaux — le chiffre que le brief exige

Échantillonné **toutes les 5 ms hors rAF** (un relevé par image ne voit pas ce
qui se passe pendant les tâches longues — 46 à 56 par descente chez PF2 — or
c'est exactement là qu'un créneau vide coûte). 8 200 à 13 800 échantillons par
course.

| course | occupation (temps) | six créneaux pleins | créneaux **vides** | raffinements retenus |
|---|---|---|---|---|
| Chamonix ×4, sans | 71,7 % | 68,9 % | 26,1 % | 0 |
| **Chamonix ×4, avec** | **72,6 %** | 70,1 % | 25,5 % | 563 |
| Nice ×4, sans | 77,1 % | 73,5 % | 20,7 % | 0 |
| **Nice ×4, avec** | **86,4 %** | 83,4 % | 11,1 % | 616 |
| Ajaccio ×4, sans | 82,0 % | 78,8 % | 15,7 % | 0 |
| **Ajaccio ×4, avec** | **80,4 %** | 77,0 % | 16,9 % | 1 506 |
| Chamonix 1,5 Mb/s, sans | 93,2 % | 92,7 % | 5,4 % | 0 |
| **Chamonix 1,5 Mb/s, avec** | **92,6 %** | 92,1 % | 6,0 % | 1 342 |
| Nice 1,5 Mb/s, sans | 93,3 % | 93,0 % | 5,6 % | 0 |
| Nice 1,5 Mb/s, avec | 84,6 % | 81,7 % | 11,6 % | 420 |

**L'occupation ne tombe pas** — c'est le point que le brief demandait de vérifier
avant tout, et le garde-fou anti-créneau-vide le tient : −0,6 point sur la paire
la plus propre (Chamonix bridé, 12 431 et 11 575 échantillons), +0,9 et −1,6
ailleurs. La seule chute (Nice bridé, 93,3 → 84,6) appartient à un tirage dont la
trajectoire a divergé (2 132 images contre 3 418, retard 58 % des deux côtés) :
c'est du bruit de geste, pas la barrière — et je le signale au lieu de le cacher,
parce que c'est le seul chiffre du tableau qui irait dans mon sens si je le
lisais à l'envers.

---

## 4. ⛔ LE VERDICT : LA BARRIÈRE COÛTE, ET ELLE EST LIVRÉE DÉBRAYÉE

**Le chiffre d'Adrien** — temps jusqu'à la première image nette au centre, défini
comme l'instant après lequel `zCentre` (le niveau de la tuile **dessinée** sous le
centre exact de l'écran) ne redescend plus sous sa valeur finale.

⚠️ **Le chronomètre part au DÉBUT du geste, pas à son arrêt.** La définition de
PF2 (« après l'arrêt ») valait pour SA descente, qui finissait au-dessus du crop ;
ici le socle prescrit z13 au centre **avant** la fin de la molette, et le chiffre
tombait à **0 ms des deux côtés** — une grandeur qui ne bouge jamais ne compare
rien. Les deux sont donnés.

### Liaison libre, CPU ×4, trois lieux, sessions neuves, tirages entrelacés

| grandeur | Chamonix | Nice | Ajaccio |
|---|---|---|---|
| **netteté au centre (ms), sans → avec** | 36 496 → **33 291** | 43 767 → **48 693** | 48 886 → **47 610** |
| durée du geste (ms), sans → avec | 38 384 → 33 819 | 44 089 → 50 889 | 50 827 → 47 846 |
| **netteté ÷ durée du geste** | 0,951 → 0,984 | 0,993 → 0,957 | 0,962 → 0,995 |
| retard du CENTRE (moy, %) | 5,6 → 5,7 | 6,2 → 6,0 | 6,3 → 6,3 |
| retard de la périphérie (moy, %) | 11,2 → 12,0 | 12,3 → 13,0 | 13,2 → 13,3 |
| requêtes par descente | 545 → 544 | 550 → 542 | 551 → 590 |
| cache max | 839 → 839 | 835 → 839 | 831 → 843 |
| `_traverse` p50 / p99 (ms) | 1,5 / 3,1 → 1,4 / 2,9 | 2,0 / 4,2 → 2,2 / 19,0 | — |

⛔ **La netteté suit la durée du geste, pas la barrière.** Elle baisse de 9 % là
où le geste a duré 12 % de moins, monte de 11 % là où le geste a duré 15 % de
plus. Normalisée, elle fait +3,5 %, −3,6 %, +3,4 % — **du bruit, dans les deux
sens.** Le retard du centre, lui, est une **fraction** (donc indépendante de la
durée du geste) : 5,6 → 5,7 · 6,2 → 6,0 · 6,3 → 6,3. **Plat.**

Ce régime n'était pas le bon banc, et la sonde le dit : **15 à 26 % des créneaux
sont vides**. Quand le tuyau n'est pas plein, retenir la périphérie ne libère
rien. La barrière ne pouvait rien y gagner — ni y perdre.

### Liaison bridée à 1,5 Mb/s — LE régime que D22 vise

C'est là que les six créneaux **sont** le goulot (créneaux vides : 5,4 %).

| grandeur | Chamonix, sans → avec | Nice, sans → avec |
|---|---|---|
| **netteté au centre (ms)** | 21 249 → **40 464** | 22 038 → **27 102** |
| **retard du CENTRE (moy, %)** | **18,5 → 28,4** | 17,1 → 57,9 |
| retard de la périphérie (moy, %) | 37,2 → 34,0 | 31,5 → 58,6 |
| centre : premier z12 / z13 (ms) | 5 910 / 7 208 → 6 964 / **9 175** | 6 566 / 8 374 → — |
| occupation des créneaux | 93,2 → 92,6 % | 93,3 → 84,6 % |
| cache max | 580 → **543** | 603 → 766 |
| requêtes / Mio | 98 / 10,66 → 102 / 11,01 | 104 / 11,28 → 293 / 6,33 |

⛔ **La barrière DÉGRADE le centre, exactement là où elle devait le servir.** Le
retard du centre passe de 18,5 % à 28,4 % sur la paire propre (Chamonix, mêmes
3 395 images des deux côtés, gestes à 10,2 et 12,0 s) ; le centre atteint z13
**2 s plus tard** ; la netteté double. Et ce n'est **pas** l'occupation des
créneaux : elle ne bouge pas (−0,6 point).

**Décision : la barrière est livrée DÉBRAYÉE** (`this.barriereCible = false`).
Le mécanisme est écrit, commenté, testé (19 tests, campagne de mutation), et il
s'allume d'une ligne le jour où la cause ci-dessous sera levée. Livrer levé ce
qui dégrade le chiffre d'Adrien serait exactement l'erreur que le §5 de la
compétence décrit : *« un correctif juste, appliqué dans le mauvais ordre, se
mesure comme une régression — et se fait annuler. »*

### La piste — signalée comme piste, PAS comme conclusion

⚠️ **Je ne l'ai pas vérifiée, et la compétence prévient explicitement contre
l'explication commode qui réconcilie deux mesures sans avoir été testée** (§2 :
le champ de vision qu'on accusait, et qui ne pouvait rien y changer).

Le seul couplage visible dans les chiffres : `cache max` **580 → 543** sur la
paire propre (−6,4 %). Un parent de périphérie retenu **n'engendre pas**, donc il
ne compte pas ses enfants dans `_porteuses`, donc la cible du **cache souple**
(`_porteuses + CACHE_SOUPLE`) descend, donc `_evictJusqua` mord plus fort — et à
1,5 Mb/s chaque tuile réévincée puis redemandée se paie en secondes. Ce serait
deux défauts qui n'en font qu'un, et le second appliqué avant le premier.

**Ce qu'il faudrait mesurer pour trancher** : compter, sur une course bridée, les
tuiles **évincées puis redemandées** avec et sans barrière (le compteur
`evicteesDessinees` de la sonde R37 en donne la moitié) ; si l'écart est là,
exclure du calcul de `_porteuses` l'effet de la barrière — c'est-à-dire compter
les enfants **qu'on aurait faits** — et remesurer. Une heure de banc, pas une
réécriture.

---

## 5. ④ LE 404 → AWS — en place, et son plafond mesuré

### Ce qui est écrit

`src/dem-source.js` tient une **mémoire des trous, tuile par tuile** (plafond
4 096 clés, vidée avec la source). `fetchTile` note le trou **avant** de rattraper
sur AWS, sur la tuile **réellement demandée** (qui peut être un ancêtre surzoomé).
`planTuile` **remonte les ancêtres** jusqu'au plancher de couverture de la source
et route les descendants d'un trou **droit chez AWS**.

⛔ **La session ne bascule pas.** Un 404 est un trou de couverture, pas une panne
— `dem-source.js` le dit en toutes lettres — et `fallbackToAws` n'est pas appelé.
La tuile d'à côté, sur la terre ferme, garde Mapterhorn. Vérifié par test
(`isFallbackActive()` reste faux).

### Ce que ça économise — et pourquoi c'est bien moins que 40 %

⛔ **L'A/B naïf (drapeau levé / baissé) ne compare RIEN, et c'est mesuré** : la
molette est inertielle, les deux descentes ne visitent pas les mêmes tuiles, et
le premier essai a rendu **PLUS** de 404 avec le correctif qu'avec (71 contre 51
à Ajaccio, 150 contre 95 à Nice) — du bruit de trajectoire, pas un effet.

La grandeur exacte se compte **sur une seule course** : les 404 dont un
**ancêtre** a déjà rendu 404. Chacun est un aller-retour que la mémoire supprime.

| course | 404 Mapterhorn | dont **descendants d'un 404 connu** | part |
|---|---|---|---|
| Ajaccio, routage débranché | 83 | **8** | 10 % |
| Ajaccio, routage branché | 112 | 8 | 7 % |
| Nice, routage débranché | 61 | **7** | 11 % |
| Nice, routage branché | 64 | 21 | 33 % |
| Chamonix bridé (4 courses) | 15 | **7** | 47 % |

**Le plafond de ce correctif est donc de 7 à 21 requêtes par descente**, pas les
40 % de PF2 §5. ⚠️ Et **il en passe encore quelques-unes avec le correctif
branché** (8 à Ajaccio) : la mémoire est **réactive**, elle ne s'écrit qu'à la
réponse ; les descendants demandés **dans la même salve**, avant que le 404 du
parent ne revienne, partent quand même. C'est inhérent au mécanisme, ce n'est
pas un défaut de l'implémentation, et je ne l'ai pas fermé (il faudrait retenir
les demandes derrière une réponse en vol : une seconde file, non bornée).

Les octets par descente ne bougent pas hors du bruit (43 à 57 Mio, ±20 % d'un
tirage à l'autre au même endroit).

---

## 6. CE QUE J'AI CRU PUIS RÉFUTÉ

1. **« La cible n'est peut-être qu'un seuil binaire à remplacer par une
   décroissance. »** Non : `1000 − 250 d`, tracée sur 44 tranches, strictement
   affine. **Et surtout : la reformer n'aurait rien changé** — la file est
   **triée**, un tri ne voit que l'ordre, donc toute fonction strictement
   décroissante de `d` produit la MÊME file. J'ai failli écrire une gaussienne
   qui aurait été un no-op arithmétique, avec un rapport pour le célébrer.
2. **« Il faut écrire une seconde mécanique pour la basse définition de
   périphérie. »** Non : R37 la donne. **0 trou** sur 6 descentes × 3 lieux, et la
   périphérie est à 11–13 % de retard contre 5–6 % au centre. C'était la sixième
   fois sur ce chantier, le brief le disait, et la mesure lui a donné raison.
3. **« La barrière se pose dans `_pump`. »** Non, et le brief avait raison avant
   la mesure : retenir une entrée **déjà enfilée** ne peut que vider un créneau.
   Posée à l'admission du raffinement, elle empêche d'ENTRER — et l'occupation
   ne bouge pas (93,2 → 92,6 %).
4. **« La barrière se décide en fin d'image, avec le reste. »** Faux, et c'est un
   test qui l'a dit : `globe-eviction` ⑤ draine le réseau **entre** deux images,
   donc la décision de fin d'image s'appliquait à un vol déjà vide. **Cycle de
   période 2, 12 requêtes caméra strictement immobile.** Déplacée en tête
   d'image : vert.
5. **« La barrière n'a qu'à retenir tout ce dont les quatre enfants ne sont pas
   là. »** Non : un enfant déjà parti a déjà pris son créneau. Le retenir lui fait
   perdre son `lastUsed`, donc sa protection : on paie sa requête deux fois. Le
   garde-fou est `_aucunEnfant` — **et une mutation a survécu à sa relâche**
   (l'invariant du parcours reste vrai quand on retient PLUS), ce qui a forcé à
   extraire le prédicat pour l'interroger de face.
6. **« Le crédit n'a rien à voir avec la barrière. »** Faux, mesuré : à cache
   saturé, `_credit < 4` refuse le raffinement du CENTRE, `_centreEnAttente` ne
   retombe jamais, la barrière tient pour toujours. Un ordonnanceur de réseau ne
   doit pas s'armer quand le goulot est le cache.
7. **« Un banc à CPU ×4 sur une bonne liaison juge une barrière
   d'ordonnancement. »** Non : **15 à 26 % des créneaux y sont VIDES**. Les six
   premiers relevés (« la barrière ne change rien ») ne disaient pas « elle est
   inutile », ils disaient « ce banc ne la teste pas ». Il a fallu brider le
   réseau à 1,5 Mb/s pour que la question ait un sens — et la réponse a alors été
   **non**, ce qui est un vrai résultat.
8. **« Le temps jusqu'à la première image nette est LE chiffre. »** Il l'est pour
   Adrien, mais **il est dominé par la durée du geste**, qui varie de 30 % d'un
   tirage à l'autre parce que la molette est inertielle. Normalisé, il fait
   ±3,5 % dans les deux sens. La grandeur qui porte le signal est le **retard du
   centre en fraction d'écran** — et c'est elle qui a condamné la barrière.
9. **« La définition de PF2 (après l'arrêt du geste) se transpose. »** Non : le
   socle prescrit z13 au centre AVANT la fin de la molette, donc le chiffre valait
   **0 ms des deux côtés**. Une grandeur qui ne bouge jamais ne compare rien.
10. **« Les 679 sur 1 704 requêtes (40 %) de PF2 §5 sont des descendants de
    404. »** Non : ce sont des **404**, dont seulement **7 à 21 par descente** ont
    un ancêtre déjà troué. La sonde de zone à z8 attrape déjà les grands trous ;
    ce qui reste est du détail de trait de côte, où chaque 404 est une première
    rencontre. Le correctif est juste, son plafond est petit, et je l'annonce
    petit.
11. **« Le bridage réseau se pose au lancement du Chrome. »** Non :
    `emulateNetworkConditions` bride aussi le serveur `vite` de dev, et
    l'application ne démarre jamais (90 s de délai dépassé, quatre courses
    perdues). Il se pose après le chargement de la page.
12. **« Un `git checkout --` sur un fichier suivi est sans risque après une
    campagne de mutation. »** Il a effacé deux correctifs non commités (le levier
    `?trous=0` et le débrayage par défaut). Récupérés depuis la sauvegarde du
    script de mutation. Noté ici parce que c'est le genre de perte qui, non
    remarquée, aurait fait publier un rapport décrivant du code absent.

---

## 7. CE QUI RESTE

- **Lever la barrière** : mesurer le couplage `_porteuses` → cache souple →
  éviction (§4), puis remesurer sur liaison bridée. C'est la seule chose qui
  sépare la barrière de la production.
- **La course d'un 404 en vol** : les descendants demandés dans la même salve que
  leur parent troué partent quand même (8 par descente). Les retenir demanderait
  une file d'attente derrière une réponse en vol — non bornée, donc non écrite.
- **Le p99 de `_traverse` à 19 ms** sur un tirage de Nice (contre 4,2 ms sur son
  jumeau) : machine partagée, pas le code — mais c'est à revérifier sur une
  machine au repos avant de publier un chiffre de coût.
- **`test/globe-eviction` ⑤ ne garde plus la barrière** depuis qu'elle est
  débrayée par défaut : c'est `test/globe-cible.test.js` ④ qui tient le garde-fou
  du crédit. Si quelqu'un lève la barrière, les deux doivent être relus ensemble.

---

## 8. TESTS, MUTATIONS, COMMITS

- **`npm test` : 4 818 tests · 4 818 réussis · 0 échec** (base `cible-tuiles`
  4 799 + 19 tests CIB).
- **`npm run audit:tests` : 258 listés · 258 sur disque, aucun écart**
  (`test/globe-cible.test.js` inscrit dans la liste explicite de `package.json` ;
  octet relu après écriture, JSON revalidé).
- **Campagne de mutation — 11 mutants, 11 morts** (deux ont d'abord survécu et
  ont fait écrire du code et un test) :

| mutant | test qui rougit |
|---|---|
| garde « six créneaux pourvus » retirée | ④ créneaux (2 échecs) |
| échéance anti-famine retirée | ④ famine |
| garde du crédit retirée | ④ crédit |
| cible inversée (`>=` au lieu de `<=`) | ① et ③ (2 échecs) |
| distinction centre / périphérie retirée | ③ de face |
| `_aucunEnfant` relâchée en `!_enfantsPresents` | ③ de face ⚠️ **a d'abord SURVÉCU** |
| `_aucunEnfant` retirée | ③ de face |
| levier `barriereCible` ignoré | ③ débrayé |
| barrière jamais décidée | ③ et ④ (2 échecs) |
| remontée des ancêtres du 404 retirée | ⑤ (4 échecs) |
| routage 404 → AWS retiré | ⑤ (2 échecs) |
| levier `?trous=0` ignoré | ⑤ levier |
| plafond de la mémoire des trous retiré | ⑤ plafond |
| remise à zéro des trous retirée | ⑤ remise à zéro |

  ⚠️ **La mutation survivante a changé le code, pas seulement le test** : un
  prédicat écrit en ligne dans `_traverse` ne se teste que de biais, parce que
  l'invariant du parcours (« un parent de périphérie vierge n'engendre pas »)
  reste vrai quand on retient PLUS. `_barriereRetient` / `_barriereArmeeIci` ont
  été extraits pour qu'on puisse poser la question de face.

- **Commits sur `cible-tuiles`** : `23c7b18` (la barrière, le 404 → AWS, la sonde
  et les tests), puis le levier `?trous=0`, le débrayage par défaut, l'extraction
  du prédicat et ce rapport (`git add -f`).
- **Serveur de dev 7621 arrêté en partant.** Aucun Chrome sans tête laissé en vie
  (seuls les miens ont été fermés — `nav.close()` en fin de chaque course).
