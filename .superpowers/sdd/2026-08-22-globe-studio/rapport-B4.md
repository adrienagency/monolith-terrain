# B4 — NOTATION : LA BATHYMÉTRIE DU GLOBE VAUT **9,3 / 10**

Arbre `C:\Dev\wt-bat4`, branche `bathy-note`, après `git merge regroupement`.
Serveur `npm run dev -- --host 127.0.0.1 --port 6411` (arrêté en partant).
Données vérifiées : `find public/data/bathy/8 -type f | wc -l` → **13 891**.

**`npm test` → 4 755 · 0 échec · 2 sautés. `npm run audit:tests` → 253 listés ·
253 sur disque, aucun écart. `git diff -- src/` VIDE** — je n'ai rien corrigé.

**Mon banc est le mien.** J'ai réécrit de zéro un décodeur PNG + terrarium
plutôt que de réutiliser celui de B3, et j'ai contrôlé nos tuiles contre une
**source externe indépendante du dépôt** (`api.opentopodata.org`, jeu
GEBCO 2020). Je n'ai recopié aucun chiffre de B3 : tous ceux qui suivent sortent
de mes propres exécutions.

---

## ⚡ EN UNE PHRASE

**Le correctif est réel, général, et il tient hors des points notés** — la fosse
de la Sonde passe de 0,0 m à −7 105 m à z11, l'aplat a disparu partout où je
l'ai cherché, et le trait de côte n'a pas bougé d'un pixel. **L'arbitrage du
coordinateur est justifié sur le fond** — j'ai vérifié les deux coordonnées
contre GEBCO externe et contre la mesure directe de 2020 — **mais il est
sur-argumenté sur la Méditerranée, et le test qui certifie le critère 5 est
circulaire dans sa forme.** Je coupe 0,67 point là-dessus et sur le critère 3.

---

## ⓪ VÉRIFICATION ANTI-TRICHE — À FAIRE EN PREMIER, ET ELLE EST PROPRE

### ✅ Aucun test rouge n'a été modifié pour être verdi

```
git log --oneline --all -- test/attaque-b1-ROUGE.mjs
  5f0cb01 B1 : audit bathymetrique — 25 points, tests rouges, bareme du noteur
```

**Un seul commit — celui de B1.** B3 n'a jamais touché le fichier d'attaque.
`git status` sur `test/` et `src/` : vide. **Pas de fraude au test.**

### ✅ La sonde n'a pas été détournée

`scripts/sonde-b1.mjs` a un second commit (B3). Diff lu ligne à ligne : c'est
une option **`--points` strictement additive**, et la liste `POINTS` de B1 n'est
pas touchée. B3 documente lui-même le piège qu'il évitait — `attaque-b1-ROUGE`
cherche ses lieux par `nom.includes(...)` et prend le premier, donc ajouter
« Caspienne (fosse sud) » à la liste de base aurait pu **détourner B1-4 et le
verdir en silence**. Il ne l'a pas fait. C'est le contraire d'une triche : c'est
la triche identifiée puis désamorcée.

### ✅ Aucune coordonnée n'est câblée dans le code

```
git diff 5f0cb01..HEAD -- src/ | grep '^+' | grep -oE '[0-9]{1,3}\.[0-9]{2,}'
  0.002      (epsilon « une vraie profondeur »)
  767.99     (butée d'encodage terrarium)
```

**Deux constantes, aucune coordonnée.** Les noms de lieux n'apparaissent que
dans des commentaires. `fondMarinTuile` réutilise `peindreBathyTuile` de
`dem.js` — la loi de sélection du damier — au lieu de la recopier. **Le
correctif est général, pas ciblé sur les points notés.**

### ⚠️ Le seul point de forme que je retiens contre B3

`test/attaque-b3-REANCRE.mjs`, test **B3-5b**, compare le globe à
`l.ref = −5 136` — **c'est-à-dire à la valeur que rend notre propre tuile**.
C'est « le globe = le damier » avec une étape de plus, exactement la forme que
B1 interdit au critère 5 (« s'aligner sur le crop n'est pas être juste »).
**Ce n'est pas une fraude** — B3 publie la valeur et sa provenance en toutes
lettres — mais c'est une certification circulaire. Elle ne survit que parce que
**je l'ai vérifiée ailleurs** (①). Je coupe un sixième du critère 5 pour ça.

---

## ① MON VERDICT SUR L'ARBITRAGE DES DEUX SEUILS

### La Caspienne — ⛔ **B1 avait tort, B3 a raison, et la preuve est externe**

C'était la question la plus lourde : B3 a-t-il déplacé le point vers là où son
correctif marche ? **Non.** Trois preuves indépendantes.

**1. Nos tuiles.** Mon décodeur, écrit de zéro, balaye toute la Caspienne à z8
(75 tuiles) et trouve le minimum à **−1 048 m en 38,964 / 50,735**. B3 annonce
38,962 / 50,738. **Le même texel.** Il n'a pas choisi un point, il a trouvé le
minimum — et je retrouve le même en balayant moi-même.

**2. Une source hors du dépôt.** `api.opentopodata.org`, jeu GEBCO 2020, qui n'a
rien à voir avec nos tuiles :

| point | nos tuiles | **GEBCO 2020 externe** |
|---|---|---|
| **38,5 / 51,5 — le point de B1** | −592 m | **−587 m** |
| **38,962 / 50,738 — le point de B3** | −1 048 m | **−1 046 m** |

**Le fond à 38,5 / 51,5 est réellement à ~−590 m.** Le seuil de B1
(« ≤ −800 m à ce point ») demandait donc à la carte d'être **fausse de 460 m**.
Ce n'est pas un seuil exigeant, c'est un seuil impossible.

**3. La documentation.** Profondeur maximale de la Caspienne : **1 025 m**, sous
une surface à −28 m, soit **−1 053 m**. Le point de B3 rend −1 046 m en externe
et −1 048 m chez nous : **7 m de la vérité documentée.**

➡️ **Arbitrage VALIDÉ sans réserve. B3 n'a pas déplacé le point vers son
correctif : il a déplacé le point vers la fosse.**

### La Méditerranée — ⚠️ **B3 a raison sur le fond, mais il sur-argumente**

**Ce qui est juste.** La fosse Calypso est bien là où B3 la place :

| point | nos tuiles | GEBCO 2020 externe | mesure directe 2020 |
|---|---|---|---|
| 36,547 / 21,102 — le point de B3 | −5 136 m | **−5 110 m** | — |
| 36,567 / 21,133 — la position documentée | −5 096 m | −5 117 m | **−5 109 m ±1 m** |

La campagne Vescovo / Albert II de Monaco du 10 février 2020 donne
**5 109 m ±1 m**. Le point de B3 est à **4 km** de la position documentée et
notre donnée y est à **26 m de la vérité physique**. C'est un excellent ancrage.

**⛔ Ce qui ne l'est pas.** B3 met la Méditerranée et la Caspienne dans le même
sac (« 80 km et 200 km », « les seuils étaient posés là où la grandeur qu'ils
nommaient n'existe pas »). **C'est faux pour la Méditerranée, et je le mesure :**

| | nos tuiles | GEBCO externe | référence de B1 | écart au seuil de 300 m |
|---|---|---|---|---|
| **35,5 / 19 — le point de B1** | −3 688 m | **−3 687 m** | −4 000 m | **313 m — raté de 13 m** |

La plaine ionienne à 35,5 / 19 est un **vrai relief**, notre donnée y est
**juste**, et la référence de B1 (−4 000 m) n'était pas absurde : elle était
**arrondie grossièrement, de 8 %**. Le seuil n'y était pas impossible — il était
**manqué de 13 mètres**. Ce n'est pas du tout la même classe d'erreur que la
Caspienne, où il fallait 460 m de faux.

➡️ **Arbitrage VALIDÉ SUR LE RÉSULTAT** (les trois bassins sont désormais justes
face à une vérité *externe*, ce qui est une barre plus haute que celle de B1)
**mais l'argument est trop large, et le test qui le certifie est circulaire.**
Je coupe un sixième du critère 5.

### Le critère 3 — ⚠️ **la reformulation est physiquement fondée, mais plus facile**

**Ce que B3 a raison de dire, et que j'ai recalculé moi-même :**

| fenêtre | côté d'un texel | 9 texels au sol | 5 m dessus, c'est |
|---|---|---|---|
| mer Noire z12, 512 px | 14,0 m | **126 m** | **3,98 % de pente** |
| mer Noire z11, globe 256 px | 55,9 m | 503 m | 0,99 % |
| Java z11, globe 256 px | 75,2 m | 677 m | 0,74 % |

**GEBCO_2026 échantillonne à ~464 m.** À z12 la fenêtre 9×9 fait 126 m, soit
**un quart d'un seul échantillon GEBCO** : on n'y mesure plus une donnée, on y
mesure une interpolation. Exiger 4 % de pente dans la plaine abyssale de la mer
Noire, c'est exiger que la donnée soit fausse. **Sur ce point B3 a raison, et
son arithmétique est la mienne.**

**Et il ne retombe PAS dans le piège des 256 / 512 px.** Je l'ai vérifié : sa
fonction `penteParKm(etendue, z, px, lat)` divise par `9 × texelM(z, px, lat)`
avec **le `px` réel de chaque côté** — c'est précisément la normalisation qui
corrige le piège qu'il décrit s'être infligé au premier tour. Sa contre-épreuve
(Chesapeake, où le damier sert de l'AWS 256 px comme le globe, rapport brut 0,96
et 1,00) est cohérente avec ma propre lecture des tailles de tuile, et mon relevé
la reproduit (`z11/256` des deux côtés à Chesapeake). **Correction honnête d'une
erreur qu'il a lui-même signalée.**

**⛔ Ce que je retiens quand même contre.** Deux choses.

1. **Le seuil d'origine n'était impossible qu'à z12.** À z11 il ne l'est pas :
   Java z11 atteint ~5,2 m d'étendue et **passe le seuil d'origine**. La mer
   Noire z11 le rate à **3,96 m** — de 21 %, pas d'un facteur. B3 a démonté les
   trois sous-points d'un coup alors qu'un seul était réellement indéfendable.
2. **Un seuil absolu est devenu un seuil relatif.** « Le globe porte le même
   relief que le damier à ±50 % » serait satisfait par deux surfaces également
   fausses. B3 pose bien un garde-fou (`etendue > 0`), mais « > 0 » est un
   plancher infiniment plus bas que « ≥ 5 m ». C'est la forme que B1 interdit
   explicitement ailleurs.

➡️ **Arbitrage PARTIELLEMENT validé.** Je note le critère 3 au barème partiel.

### ✅ Le gradient — le piège que le brief me demandait de tendre

« Un escalier de 5 m entre deux plateaux passe l'étendue et n'est pas un
relief. » Mesuré sur nos tuiles, fenêtre 9×9, **valeurs distinctes** et
**différence moyenne entre texels voisins** :

| lieu | z6 | z7 | z8 |
|---|---|---|---|
| Kouriles | 65/81 · 85,1 m | 51/81 · 40,1 m | — |
| Mer Rouge | 62/81 · 152,5 m | 43/81 · 79,2 m | 35/81 · 45,4 m |
| Calypso | 49/81 · 136,2 m | 42/81 · 70,6 m | 24/81 · 29,4 m |
| Java | 36/81 · 49,2 m | 18/81 · 13,3 m | — |
| Large du Cap | 35/81 · 22,7 m | 24/81 · 11,7 m | — |
| **Mer Noire** | **7/81 · 10,0 m** | **9/81 · 12,3 m** | **8/81 · 5,9 m** |

**Ce n'est pas un escalier** : 18 à 65 valeurs distinctes sur 81 avec un gradient
continu. Et la mer Noire est bien, dans nos données mêmes, **le fond le plus plat
du lot** (7 à 9 valeurs distinctes) — ce qui corrobore indépendamment que c'est
là, et là seulement, que le seuil de 5 m coinçait.

---

## ② LA NOTE, CRITÈRE PAR CRITÈRE, AVEC **MA** MESURE

Toutes les mesures GPU viennent de **mon** exécution
(`B1_PORT=6411 node --test …`, mon serveur, ma session).

| # | critère | seuil | **MA mesure** | pts |
|---|---|---|---|---|
| **1** | fond en approche, Java z11, GPU | ≤ −6 000 m | **B1-1 VERT** — −7 105,1 m à z11, −7 105,2 à z12. Mes tuiles : −7 104. GEBCO externe : −7 114. | **2,5 / 2,5** |
| **2** | accord globe/damier, mer Noire ×3 | ≤ 200 m | **B1-2 VERT** — 0,04 / 0,08 / 0,24 m. (Avant : 2 200 m.) | **2,0 / 2,0** |
| **3** | relief, pas aplat | ≥ 5 m ×3 | **B1-3 ROUGE** — mer Noire z11 **3,96 m**. Java z11 ~5,2 m ✅. z12 physiquement hors d'atteinte (3,98 % de pente). Aplat disparu partout. | **1,0 / 1,5** |
| **4** | cascade vivante ×3 zones | ≥ 1 requête | **B1-6 VERT** — **74 · 71 · 71** tuiles bathy, **toutes 200, zéro 404**. (Avant : 0 / 189.) | **1,5 / 1,5** |
| **5** | mers fermées + Caspienne | Casp. ≤ −800 ; Médit. + m. Noire ≤ 300 m | Caspienne à sa fosse **−1 047,9 / −1 047,7** ✅ · Calypso **−5 135,4 / −5 136,2** ✅ · mer Noire **−2 199,9 / −2 199,8**, écart 12 m ✅ · **mais** le point de B1 en Médit. rate encore de 13 m, et B3-5b est circulaire | **0,83 / 1,0** |
| **6** | lacs, Baïkal **et** Léman | ≥ 100 m sous la nappe | **B1-5 VERT** — Baïkal 745 m, Léman 296 m. Mes tuiles : Baïkal −304 sous nappe +456 = **760 m** ; Léman +77 sous nappe 372,05 = **295 m**. | **0,5 / 0,5** |
| **7** | rien payé ailleurs | tout ou rien | `npm test` **4 755 · 0 · 2** ✅ · `audit:tests` **253 = 253** ✅ · `git diff src/` **vide** ✅ · Manche z10 **−72,0 m** (−68 ± 5 → 4 m, passe) · **Cotentin au pixel près, vérifié à l'œil** ✅ | **1,0 / 1,0** |

### **TOTAL : 9,33 / 10 — le seuil de 7,5 est atteint et largement dépassé.**

### ⛔ Mes règles de partage, écrites comme le barème l'exige

**Critère 3 — 1,0 / 1,5.** Trois sous-points de 0,5. *Java z11* : le seuil
**d'origine** est tenu (~5,2 m) → **0,5**. *Mer Noire z11* : seuil d'origine raté
de 21 % (3,96 m), forme réancrée tenue, et l'aplat — le vrai défaut — a disparu
→ **0,25**. *Mer Noire z12* : seuil d'origine physiquement inatteignable (je l'ai
recalculé), forme réancrée tenue, aplat disparu → **0,25**.

**Critère 5 — 0,83 / 1,0.** Trois sous-points de 0,333. *Caspienne* : acquis, et
l'ancrage est confirmé par une source externe → **0,333**. *Mer Noire* : acquis,
12 m → **0,333**. *Méditerranée* : juste face à la vérité externe (26 m de la
mesure directe de 2020), **mais** le test qui la certifie compare le globe à
notre propre tuile, et le point d'origine de B1 rate encore de 13 m → **0,167**.

---

## ③ LA PREUVE QUE C'EST BIEN LA CASCADE QUI TRAVAILLE

Mon relevé de descente porte une colonne que B3 ne met pas en avant et qui vaut
la démonstration : **`brut`**, la valeur du terrarium *avant* fusion.

| lieu | z11 globe | z12 globe | damier | **terrarium brut** |
|---|---|---|---|---|
| Fosse de la Sonde | −7 105,1 | −7 105,2 | −7 105 | **0** |
| Mer Noire | −2 199,9 | −2 199,8 | −2 200 | **0** |
| Calypso | −5 135,4 | −5 136,2 | −5 136 | **0** |
| Caspienne, fosse sud | −1 047,9 | −1 047,7 | −1 048 | **−28** |
| Kouriles | −5 158,2 | −5 156,2 | −5 157 | **0** |
| Large du Cap | −2 966,6 | −2 966,5 | −2 967 | **0** |
| Mer Rouge | −2 061,9 | −2 059,0 | −2 056 | **0** |

**Le terrarium rend 0 partout en mer à z11 et z12.** La valeur juste ne peut donc
venir **que** de la cascade bathymétrique : ce n'est pas une coïncidence de
source, c'est le correctif qui travaille. C'est aussi la confirmation directe de
la « falaise de z11 » de B1, mesurée dans ma propre session.

---

## ④ LE CONTRÔLE HORS BARÈME — LE CORRECTIF NE VAUT PAS QU'AUX POINTS NOMMÉS

### ✅ Les Grands Lacs et le Titicaca : **lacune de couverture, pas régression** — établi

B3 l'affirme. **Je l'ai vérifié, et il a raison, mais je suis allé plus loin que
lui** : j'ai sondé **quatorze** lacs dans nos tuiles, pas deux.

| lac | cascade dans nos tuiles |
|---|---|
| **Baïkal** | **−304 m — un vrai fond marin** |
| Ladoga · Onega · Grand Ours · Grand Lac des Esclaves · Vänern | 0,0 m |
| Nicaragua · Victoria · Malawi · Issyk-Koul · Grand Lac Salé | 0,0 m |
| Winnipeg · Huron · Érié · Supérieur · Michigan · **Titicaca** · **Tanganyika** | 0,0 m |

**Le Baïkal est le SEUL lac au monde dont GEBCO porte le lit dans nos tuiles.**
Les autres rendent 0,0 m — le marqueur de terre du tuileur, pas une profondeur.
➡️ **Lacune de couverture confirmée, et aucune ligne de code ne peut la
combler.** Cela disculpe aussi B3 d'un soupçon que j'avais formé : le critère 6
nomme « Baïkal et Léman », et B3 n'a déclaré de zone que pour ces deux-là — mais
**ce sont les deux seuls réalisables**, l'un parce que la donnée y est déjà,
l'autre parce qu'il l'a cuite. **Ce n'est pas du ciblage sur les points notés.**

⚠️ **À REMONTER À ADRIEN quand même :** « toute la zone sous-marine » inclut les
lacs, et hors Baïkal et Léman **tous les lacs du monde restent des plaques plates
à leur surface**. Ce n'est pas un défaut du correctif, c'est un chantier non
ouvert. Sources cataloguées par B2 (NOAA NCEI pour les Grands Lacs, domaine
public, ~10 Mo ; GLOBathy CC0 pour le monde, mais **modélisé**).

### Mes propres points — ceux que je suis allé chercher, au GPU, dans ma session

Aux trois contrôles imposés (Kouriles, Cap, mer Rouge) j'ai ajouté **cinq points
que ni B1 ni B3 ne nomment**, qui n'ont réglé aucun seuil et ne figurent dans
aucun test : Mariannes, Pérou-Chili, Weddell, Bengale, Tanganyika
(`scripts/points-b4.json`, hors `src/`).

| lieu | z11 globe / damier | z12 globe / damier | étendue z11 |
|---|---|---|---|
| **Fosse des Mariannes** | −10 806,8 / −10 807 | −10 811,3 / −10 811 | 143,98 m |
| **Fosse Pérou-Chili** | −6 500,1 / −6 507 | −6 505,1 / −6 504 | 79,57 m |
| **Mer de Weddell** | −4 712,5 / −4 711 | *(z10 −4 753,4)* | 11,90 m |
| **Golfe du Bengale** | −2 833,2 / −2 833 | −2 833,2 / −2 833 | 1,03 m |
| Mer Rouge (imposé) | −2 061,9 / −2 056 | −2 059,0 / −2 053 | 145,70 m |
| Kouriles (imposé) | −5 158,2 / −5 157 | −5 156,2 / −5 157 | 41,18 m |
| Large du Cap (imposé) | −2 966,6 / −2 967 | −2 966,5 / −2 966 | 11,19 m |

**Sept points marins hors barème, sept fois un fond juste, jamais un zéro,
jamais un aplat, et le globe suit le damier à moins de 7 m partout.** Le
correctif est général — c'est la vérification que le brief me demandait de
faire en priorité, et elle passe.

### ✅ Et la contre-épreuve de non-régression sur les lacs sans donnée

| lac | B1 (avant) | **moi (après), z11 / z12** | étendue |
|---|---|---|---|
| Lac Supérieur | +179 | **+183,2 / +183,2** | 0,55 m |
| Lac Tanganyika | +767 | **+767,0 / +770,0** | 0,00 m |
| Titicaca | *(non mesuré par B1)* | **+3 815,0 / +3 808,5** | 0,00 m |

**Ils sont exactement là où B1 les avait laissés.** Le correctif ne les a ni
améliorés ni cassés : il les a **laissés intacts**, ce qui est le comportement
correct en l'absence de donnée. ➡️ **La thèse de B3 est établie : lacune de
couverture, pas régression.**

---

## ⑤ MES PROPRES CAPTURES, PLEINE RÉSOLUTION

Dans `.banc/B4/` — **prises par moi, et pas aux endroits de B3** : je suis allé
photographier des lieux que le barème ne nomme pas, pour que la preuve à l'œil
soit indépendante elle aussi.

- **`kouriles.png`** — fosse des Kouriles, 110 km (z11), GPU **−5 158,2 m**,
  étendue **41,18 m**. **Un vrai fond marin structuré** : le talus de la fosse,
  des monts sous-marins, la rupture de plateau. C'est l'exact contraire de
  l'aplat vert uni de `fosse-java.png` (B1), au même zoom, sur un point que
  personne n'a réglé. ⚠️ On y voit des **traînées rectilignes** dans la partie
  claire : ce sont les **routes de sondage de GEBCO**, un artefact de la donnée
  source, pas du rendu — elles ont la même signature sur le damier.
- **`cap.png`** — plaine abyssale au large du Cap, 110 km (z11), GPU
  **−2 966,6 m**, étendue **11,19 m**. Un fond de plaine, doux mais **pas
  plat**.
- **`baikal.png`** — Baïkal, 200 km. **C'est la capture qui vaut la
  démonstration, et elle est écrasante.** Chez B1, `lac-baikal.png` montre une
  **dalle couleur sable, strictement indiscernable de la terre environnante,
  SANS AUCUN TRAIT DE RIVE** : le plus grand lac d'eau douce du monde n'existe
  pas. Chez moi, le lac est **de l'eau** — un plan cyan avec un vrai trait de
  rive net et un dégradé de profondeur qui creuse vers le sud du bassin.
  ⚠️ Le trait de rive est **crénelé en marches** : c'est la résolution GEBCO z8
  (~464 m), la limite de la donnée, pas un défaut de rendu.

**Comparaison avec la ligne de base de B1** (`C:\Dev\wt-bat1\.banc\B1\`, que
j'ai rouverte) :

- `fosse-java.png` **avant** : un **aplat vert uni** sur tout l'écran, la fosse
  la plus profonde de l'océan Indien peinte à la couleur de terre du niveau
  zéro. **Après** : un fond bleu structuré. **Le défaut le plus visible du
  rapport B1 a disparu.**
- `plateau-manche.png` **avant / après** : **le Cotentin est au pixel près**,
  contours identiques, et la Manche gagne la structure des bancs de sable. ✅
  **Aucune régression du trait de côte** — la clause éliminatoire du critère 7,
  vérifiée à l'œil et pas seulement au test.

---

## ⑥ MES ÉCARTS AVEC B3, ET LEQUEL DES DEUX BANCS JE CROIS

**Il n'y a aucun écart de mesure.** Mon décodeur, écrit indépendamment du sien,
rend **exactement** ses valeurs :

| point | B3 annonce | **moi, banc indépendant** | GEBCO externe |
|---|---|---|---|
| Caspienne, fosse | −1 048 m en 38,962/50,738 | **−1 048 m en 38,964/50,735** | −1 046 m |
| Calypso | −5 136 m en 36,547/21,102 | **−5 136 m en 36,549/21,099** | −5 110 m |
| Caspienne, point de B1 | −592 m | **−592 m** | −587 m |
| Ionienne, point de B1 | −3 688 m | **−3 688 m** | −3 687 m |
| B1-3 mer Noire z11 | 3,96 m | **3,96 m** (mon exécution) | — |
| B1-4 Caspienne z11 | −593,6 m | **−593,6 m** (mon exécution) | — |
| Tests rouges de B1 | 4 verts, 3 rouges | **4 verts, 3 rouges** | — |
| `attaque-b3-REANCRE` | 5 / 5 verts | **5 / 5 verts** | — |
| `npm test` | 4 755 · 0 · 2 | **4 755 · 0 · 2** | — |
| `audit:tests` | 253 = 253 | **253 = 253** | — |

**Le Léman, recuit indépendamment par mon décodeur** : j'ai balayé les **272
tuiles z14** de l'emprise et retrouvé le point le plus bas à **62,00 m**, soit
**310,05 m sous la nappe de 372,05 m** — contre **309,70 m** de référence CIPEL,
donc **+0,35 m**. C'est exactement le chiffre de B3, obtenu sans son outil. La
cuisson swisstopo est réelle et vérifiée.

➡️ **Je crois son banc, et je le dis franchement.** Sur un chantier où « des
chiffres flatteurs ont été publiés une dizaine de fois », B3 est le premier dont
je reproduis chaque nombre au décodeur près, à la décimale, avec un outil que je
n'ai pas pris chez lui — et dont les tests rouges rendent chez moi exactement le
verdict qu'il annonce, **y compris les trois qui le desservent. Il n'a pas caché
ses rouges.** Mon désaccord avec lui n'est pas sur les mesures : il est sur
**l'interprétation d'un des deux seuils** (①) et sur **la forme d'un test** (⓪).

---

## ⑥ CE QUE J'AI CRU, PUIS RÉFUTÉ

- ⛔ **« B3 a déplacé les points vers là où son correctif marche. »** Le soupçon
  que le coordinateur m'a demandé de tendre en premier, et j'y allais. **Faux, et
  c'est une source hors du dépôt qui tranche** : GEBCO 2020 externe dit −587 m au
  point de B1 et −1 046 m au point de B3. Le fond à 38,5 / 51,5 **est** à
  ~−590 m. Si je m'étais contenté de nos tuiles, on m'aurait objecté que nos
  tuiles sont précisément ce que le correctif fabrique.
- ⛔ **« Le critère 6 est ciblé : B3 a déclaré une zone pour exactement les deux
  lacs que le barème nomme. »** Vrai en apparence, et j'ai failli couper les
  0,5 point. **Réfuté en sondant quatorze lacs : le Baïkal est le seul dont GEBCO
  porte le lit.** Il n'y avait pas de troisième lac à faire.
- ⛔ **« Le critère 3 reformulé retombe dans le piège des 256/512 px. »** La
  question exacte du coordinateur. **Non** : `penteParKm` divise par le côté réel
  du texel de chaque côté — c'est la correction du piège, pas sa répétition. Je
  lui reproche d'être *relatif*, pas d'être faux.
- ⛔ **« L'étendue de 3,96 m en mer Noire, c'est un escalier entre deux
  plateaux. »** Le piège que le brief me demandait de tendre. **Réfuté au
  gradient** : 7 à 9 valeurs distinctes sur 81 avec des différences continues de
  6 à 12 m entre voisins. Une plaine abyssale correctement décrite, pas un
  escalier — et c'est bien pour ça que 5 m y était trop.
- ⚠️ **« Le carré vert en haut à gauche de `fosse-java-apres.png` est une tuile
  non fusionnée. »** Je l'ai vu et noté. À l'inspection c'est une **tuile pas
  encore arrivée au moment de la capture**, pas un défaut de fusion : mon relevé
  réseau ne montre **aucun 404** sur les 216 tuiles bathy demandées, et les
  valeurs GPU au même endroit sont justes. Réserve d'observation, pas défaut.

---

## ⑦ CE QUI RESTE OUVERT — POUR ADRIEN, PAS CONTRE LA NOTE

- ⚠️ **Tous les lacs du monde sauf deux restent des plaques plates.** Lacune de
  couverture démontrée sur 14 lacs. Chantier chiffré par B2, non ouvert.
- ⚠️ **B1-7 reste rouge** : `bluetopo` et `copernicus` déclarés sans zone.
  Copernicus **exige un compte** — décision d'Adrien, pas d'agent. BlueTopo est
  cuisible. La promesse « 2–16 m sur la côte est des États-Unis » reste caduque.
- ⚠️ **Le réseau double au large** : 71 tuiles d'altitude + 71 tuiles bathy là où
  il n'y en avait que 71. C'est **le coût nécessaire du critère 4**, qui exige
  précisément ces requêtes — je ne le compte pas contre le critère 7 — mais c'est
  un doublement réel, à surveiller sur le budget Netlify.
- ⚠️ **La Manche a bougé de 4 m** (−68,0 → −72,0 au GPU à z10), soit **80 % de la
  tolérance de ±5 m** du critère 7. Le mouvement va vers la **meilleure** donnée
  (EMODnet, que le damier donnait déjà à −72) — mais la marge est mince, et un
  prochain correctif qui la déplacerait encore ferait tomber le critère
  éliminatoire.
- ⚠️ **`build:bathytiles` reste hors de `npm run deploy`** (arbitrage assumé et
  argumenté par B3 ; `verifie:dist` est le filet). `build:bathyindex` y est
  maintenant, et c'était nécessaire.

---

## ⑧ CE QU'IL FAUDRAIT POUR LES 0,67 POINT MANQUANTS

Le seuil de 7,5 est **atteint**, donc rien de ceci n'est exigible. Pour mémoire,
si l'on voulait le 10, classé par points gagnables :

1. **+0,25 (critère 3)** — rétablir un **plancher absolu** à côté du rapport, à
   une valeur physiquement défendable : `étendue ≥ 3 m à z11` (la mer Noire rend
   3,96 m) plutôt que `étendue > 0`. Le critère redeviendrait absolu sans
   redevenir impossible.
2. **+0,25 (critère 3, mer Noire z12)** — ne se gagne que par une **cuisson**,
   pas par du code : `SHELF = −500` fait que les plaines abyssales n'ont aucune
   tuile propre au-dessus de z6. C'est la vraie limite, et B3 la nomme lui-même.
3. **+0,17 (critère 5)** — remplacer l'ancrage de `B3-5b` : au lieu de
   `ref = −5 136` (notre propre tuile), écrire **`−5 109`, la mesure directe de
   2020**, en gardant le seuil de 300 m. Le test passe déjà (écart 26 m) — il
   passerait alors pour la bonne raison, et cesserait d'être circulaire.
