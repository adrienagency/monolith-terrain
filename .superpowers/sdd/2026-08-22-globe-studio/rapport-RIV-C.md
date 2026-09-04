# RIV-C — L'EAU N'ATTEND PLUS OVERPASS, ET CE QUE ÇA NE PAIE PAS

Arbre `C:\Dev\wt-riv3`, branche `riv-correctif`. Terrain : `src/map/water-layer.js`
et `src/map/overpass.js`, rien d'autre. Banc : `scripts/sonde-riv-c.mjs`
(nouveau) et `scripts/sonde-riv3.mjs` (celui de RIV, réutilisé tel quel pour
l'A/B). Relevés dans `.banc/RIV/riv-c-*.json` et `riv-ab-{avant,apres}.json`.

**Le banc, pour qu'il se compare.** Chrome `--headless=new`, SwiftShader,
1 280 × 800, `vite` en développement sur `127.0.0.1:7431`, mode sphère, drapeaux
au défaut. **Un contexte de navigateur NEUF par cas** — le disjoncteur
d'`overpass.js` se ferme 60 s et rend la branche Overpass gratuite ; deux cas
dans la même page et on ne mesure plus rien. Ce qui diffère de la production :
SwiftShader, et **le réseau d'Adrien**, qui est ici le sujet.

---

## ⚠️ LIRE CECI D'ABORD : LE GAIN N'EST PAS CELUI QU'ON ATTENDAIT

Le brief attendait le premier trait d'eau **sous 1 s**, contre ~13,7 s. **Ce
n'est pas ce que la mesure rend, et je ne vais pas l'écrire.**

### Délai jusqu'au premier trait d'eau — 3 lieux × 2 zooms, **médiane de 3 tours**, session neuve

| lieu · zoom | avant | après | écart |
|---|---|---|---|
| Rhône z12 | 13 699 ms | 13 481 ms | −218 ms |
| Rhône z13 | 8 830 ms | 8 777 ms | −53 ms |
| Mississippi (delta) z12 | 10 836 ms | 11 452 ms | **+616 ms** |
| Mississippi z13 | 10 819 ms | 11 051 ms | **+232 ms** |
| Sahara z12 | *aucun trait* | *aucun trait* | — |
| Sahara z13 | *aucun trait* | *aucun trait* | — |

**Aucun gain. Du bruit, dans les deux sens.** (Le Sahara n'a zéro rivière ni
avant ni après — conforme à RIV.)

### Pourquoi — et c'est la découverte de cette tâche

Sur un **vol**, les deux premières reconstructions **n'ont rien à peindre** :
le MNT n'est pas arrivé, l'emprise est à mi-chemin. Peindre plus tôt ne peint
pas plus tôt quelque chose qui n'existe pas encore. Mesuré, Rhône z12 avant
correction — les quatre reconstructions avec ce qu'elles produisent :

| # | départ après le vol | mur | sommets |
|---|---|---|---|
| 1 | 852 ms | 6 102,6 ms | **0** |
| 2 | 2 470 ms | 6 262,5 ms | **0** |
| 3 | 11 864 ms | 53,6 ms | **0** |
| 4 | 14 639 ms | 261,3 ms | 4 187 |

La n° 3 ne dure que 53,6 ms — **elle ne paie aucune attente** (le disjoncteur
est déjà ouvert) — et elle produit **zéro** quand même. Ce n'est donc pas
Overpass qui la vide. Ce qui décide du premier trait, c'est **l'arrivée du
relief** : ~500 requêtes, **76 Mo** dans la même fenêtre.

➡️ **Les 13,7 s du rapport RIV sont une SOMME DE MURS de reconstruction. Elles
ne sont pas en série devant le premier trait.** RIV ne l'a jamais écrit — c'est
moi qui l'ai lu comme ça, et c'est la première chose que j'ai dû réfuter.

---

## CE QUI EST GAGNÉ, ET C'EST REPRODUCTIBLE

### Le mur BLOQUANT des deux premières reconstructions (médiane de 3 tours)

| lieu · zoom | avant | après | écart |
|---|---|---|---|
| Rhône z12 | 12 197 ms | **10 624 ms** | −1 573 |
| Rhône z13 | 12 118 ms | **10 791 ms** | −1 327 |
| Mississippi z12 | 12 237 ms | **10 823 ms** | −1 414 |
| Mississippi z13 | 12 218 ms | **10 840 ms** | −1 378 |
| Sahara z12 | 12 280 ms | **11 634 ms** | −646 |
| Sahara z13 | 12 284 ms | **11 698 ms** | −586 |

**−0,6 à −1,6 s, dans les six cas, sur trois tours.** Le mécanisme est lisible à
la milliseconde : la n° 1 pose une échéance à `t₁ + 6 000` ; la n° 2, qui entre
à `t₁ + 1 380`, **hérite de 4 620 ms** au lieu de rouvrir 6 000. Relevé après
correction : `4 621,3` ms. Avant : `6 262,5` ms (et jusqu'à `9 988,2` ms).

C'est le **correctif ②** seul. Le **correctif ①** ne déplace pas ce mur — il
déplace la **peinture hors de lui**.

---

## LES TROIS CORRECTIFS

**① Dessiner le local AVANT d'attendre Overpass** (`water-layer.js`). Les deux
requêtes partent au même instant et par le même chemin ; on ne les attend plus
pour peindre. `rebuild` peint (`_peindre(socle, null)`), puis attend, puis
**repeint seulement si Overpass a répondu**. Sur cette machine il ne répond
jamais → **une seule peinture, donc aucun clignotement, et il n'est pas fondu :
il n'existe pas**. On repeint dès qu'Overpass répond, **même vide** — parce que
l'ancienne branche `if (feats)` était vraie pour un tableau vide et écrasait
déjà le repli Natural Earth ; ne pas le reproduire aurait changé les pixels.

**② Une échéance par emprise, partagée** (`overpass.js`). Le cache dédoublonnait
la requête, pas le minuteur. ⚠️ Piège du correctif : `Math.max(0, reste)` rendrait
le job **nu** (`attendreOuAbandonner` : `if (!(ms > 0)) return job`) et l'attente
redeviendrait infinie — le défaut de 42 s que ce module existe pour supprimer.
C'est `Math.max(1, …)`, et 1 ms suffit à ne jamais jeter une réponse déjà
arrivée (une promesse réglée gagne toujours contre un `setTimeout`).

**③ La sonde** (`overpass.js`). Après un échec d'accès franc, la requête neuve
suivante a **1 500 ms**, pas 6 000. 1 500 laisse encore passer le nominal mesuré
du module (927 ms). Toute réponse lue rend le budget plein.

---

## L'ÉTAT DES MIROIRS, VÉRIFIÉ PAR MOI

`curl` POST, même requête (`way["waterway"]`, bbox de Lyon de 0,15°), 4 tours,
2026-09-04 :

| point d'accès | 200 | temps | corps |
|---|---|---|---|
| **overpass-api.de** (celui du code) | **0/4** | expire | — |
| overpass.kumi.systems | **1/4** | 5,7 s | 363 328 o |
| **overpass.osm.ch** | 4/4 | 0,13–0,33 s | **272 o** |
| maps.mail.ru/osm/tools/overpass | 4/4 | 1,1–4,0 s | 363 867 o |

⛔ **`overpass.osm.ch` est un PIÈGE, pas un miroir.** Il répond 200 en 130 ms
avec `"elements": []` — c'est un extrait **suisse**. Sur Lyon, et sur presque
tout le globe, il rend un **succès vide**. Or un succès vide n'emprunte pas le
chemin `null → Natural Earth` : `if (feats)` est vrai pour un tableau vide.
**Le basculer effacerait les rivières de repli au lieu de les laisser** — on
échangerait une lenteur contre une perte de données silencieuse.

⚠️ Et `overpass.kumi.systems`, donné dans le brief pour « 200 en 4,5 s », n'a
répondu qu'**une fois sur quatre** pour moi, en **5,7 s** — sous les 6 s du
budget, mais de peu.

### Recommandation : **NE PAS BASCULER**, et voici le risque écrit

Les trois miroirs sont des services publics gratuits interrogés **par l'IP du
visiteur** (le § damier de `water-layer.js` a déjà chiffré ce que ça coûte) ;
`maps.mail.ru` ajoute une juridiction et une pérennité qu'on ne maîtrise pas.
Et depuis ce correctif, un point d'accès mort ne coûte plus qu'un
**enrichissement manqué** : changer de serveur n'achèterait donc plus de latence,
seulement de la donnée fine, **contre une dépendance de plus et le risque
osm.ch** (un miroir dont on ne connaît pas l'emprise efface des données en
rendant 200). **Le risque de ne pas basculer** : les visiteurs dont le réseau
n'atteint pas Overpass gardent Natural Earth au lieu d'OSM fin sous 24 km —
c'est déjà l'état d'aujourd'hui sur la machine d'Adrien, et ce n'est pas une
régression. La réponse durable reste celle déjà écrite dans ce dépôt : des
tuiles vectorielles auto-hébergées, ou une instance à nous. Un miroir peut
tomber demain ; `public/data/map/rivers.json`, non. Le tableau ci-dessus est
recopié en tête d'`overpass.js` pour que le prochain ne repaie pas la mesure.

---

## LES PIXELS D'EAU STABILISÉS SONT IDENTIQUES

Pas une capture d'écran (SwiftShader + tuiles qui arrivent quand elles veulent :
deux captures ne sont jamais identiques), mais la **signature de la géométrie
d'eau** une fois stabilisée — c'est ce que le calque met à l'écran, et c'est
déterministe. Six lieux × zooms, **trois tours avant et trois tours après** :

| lieu · zoom | objets | sommets | traits | remplis | verdict |
|---|---|---|---|---|---|
| Rhône z12 | 4 | 4 187 | 2 | 2 | **identique** (somme des positions comprise : 616 348,542) |
| Rhône z13 | 1 | 366 | 1 | 0 | **identique** (53 824,205) |
| Mississippi z12 | 3 | 348 | 3 | 0 | comptes **identiques** ⚠️ voir ci-dessous |
| Mississippi z13 | 3 | 330 | 3 | 0 | **identique** (−12 368,747) |
| Sahara z12 | 0 | 0 | 0 | 0 | **identique** |
| Sahara z13 | 0 | 0 | 0 | 0 | **identique** |

⚠️ **Honnêteté sur le Mississippi z12** : la somme des positions varie de
±1,8 sur 13 060, soit **1,4·10⁻⁴**. Et elle varie **à l'intérieur des trois
tours d'AVANT** (−13 061,277 / −13 062,047) autant qu'entre avant et après :
c'est le drapage qui échantillonne un MNT arrivé à un état légèrement différent,
**pas un effet du correctif**. Les comptes, eux, sont identiques partout.

---

## LA PLUS LONGUE TÂCHE IMPUTABLE À L'EAU (A/B, même session)

`scripts/sonde-riv3.mjs --tours 3`. ⚠️ **Refait AVANT ET APRÈS le même jour sur
la même machine** : comparer à l'A/B de RIV (autre jour) n'aurait rien voulu dire.

| Rhône | avant | après (tour 1) | après (tour 2) |
|---|---|---|---|
| z11 · écart plus longue tâche | **+24 ms** | +275 ms | **+35 ms** |
| z13 · écart plus longue tâche | −6 ms | −16 ms | +26 ms |
| z11 · mur du calque ON−OFF | 81,6 ms | 210,9 ms | 95,3 ms |

⚠️ **Cette grandeur est noyée dans le bruit du globe** : trois relevés de trois
tours donnent +24, +275 et +35 ms pour la même chose. Le `+275` du premier tour
d'après **n'est pas une régression** — il ne se reproduit pas, et **à z11 le
chemin de code est inchangé** (z11 < `OSM_MIN_ZOOM`, aucune requête Overpass ne
part, `_peindre` fait exactement ce que faisait l'ancien corps). Ce qui tient :
**le coût CPU du calque ne bouge pas**, et il reste de l'ordre de la centaine de
millisecondes contre une tâche de globe de 1 627 ms.

⛔ **AUCUN GAIN DE FLUIDITÉ N'EST ANNONCÉ ICI.** La saccade appartient au globe.

## RÉSEAU — pas de régression

Nombre de requêtes et octets par arrivée, médiane de 3 tours : Rhône z12
**532 / 76,1 Mo** après contre **531 / 75,7 Mo** avant ; Mississippi z13
**474 / 62,0 Mo** contre **471 / 61,7 Mo**. Toujours **deux** requêtes Overpass
par session, jamais plus — le correctif ne re-sonde rien.

⚠️ **Et le CDP a rendu un chiffre que personne n'avait vu** : ces deux requêtes
ne meurent pas à 12 s comme le supposait RIV, mais à **41,1 à 42,4 s**
(`ERR_CONNECTION_TIMED_OUT`) — parfois **69 s**. C'est le délai TCP du
navigateur, exactement le « 42 s » du § de 2026-07-31.

---

## LES TESTS

`test/eau-attente.test.js`, **9 tests**, inscrit dans `package.json`
(`audit:tests` : *258 listés · 258 sur disque · aucun écart*).
`npm test` : **4 808 · 0**.

**Ils mordent — vérifié en neutralisant chaque correctif séparément :**

| correctif neutralisé | ce que le test rend |
|---|---|
| ① l'ancien `water-layer.js` | `① le calque PEINT pendant qu Overpass est encore en vol` → **actual 0, expected 1** peinture. Les 3 tests ① échouent. |
| ② `reste = attenteMs` | `② …HÉRITE de l échéance` → **1 049 ms** au lieu de 540 |
| ③ `_budget = attenteMs` | `③ …coûte une SONDE` → **5 015 ms** au lieu de 1 506 |

---

## CE QUE J'AI CRU PUIS RÉFUTÉ

1. **« Les 13,7 s d'attente sont devant le premier trait d'eau. »** **FAUX**, et
   c'est le cœur de cette tâche. C'est une somme de murs de reconstruction ; la
   reconstruction n° 3, qui ne paie **aucune** attente (53,6 ms), produit zéro
   sommet elle aussi. Le premier trait est gardé par **l'arrivée du relief**.
   J'avais écrit « après : 852 ms » dans un commentaire de `water-layer.js`
   **avant de l'avoir mesuré** — le chiffre était inventé, il est corrigé.
2. **« Il suffit d'être déjà sur place et de plonger sous 24 km pour voir le
   défaut. »** **FAUX** — deux fois. (a) La descente vers z11 **traverse z12** :
   une paire de requêtes part, abandonne à 6 s et ouvre le disjoncteur ; tout ce
   qu'on mesure dans la minute suivante trouve la branche déjà coupée, donc
   gratuite — **40 ms de creux, « aucun défaut »**. (b) J'ai attendu 130 s pour
   le laisser expirer : **toujours rien**, parce que la requête morte **RÉ-ARME**
   le disjoncteur en se rejetant à 42 s, ce qui le tient ouvert jusqu'à ~108 s,
   parfois ~130 s. **Sur cette machine le disjoncteur est pratiquement toujours
   ouvert après la première descente** — donc le budget de 6 s n'est payé
   qu'**une fois par chargement de page**. C'est exactement le piège que le
   brief annonçait, et je l'ai payé deux fois.
3. **« Le premier trait est la bonne grandeur pour un plongeon. »** **FAUX** :
   l'eau de z11 est encore à l'écran quand le geste part, la sonde voit un trait
   à 40 ms et conclut que tout va bien. Ce que le visiteur voit, c'est l'eau qui
   **s'en va** (`_clear()`) et ne revient pas. La grandeur juste est le **creux**.
   Corrigé dans `sonde-riv-c.mjs`.
4. **« `overpass.kumi.systems` répond, on peut basculer. »** **RÉFUTÉ** : 1 fois
   sur 4 chez moi, en 5,7 s. Et le miroir qui répondait le mieux
   (`overpass.osm.ch`, 4/4 en 130 ms) est un **extrait suisse** qui rend un
   succès vide — il aurait **effacé** les rivières de repli. J'ai failli le
   recommander sur son seul temps de réponse.
5. **`getEntriesByType` mis à part, le filtre d'URL ment aussi** : mon premier
   comptage « 1 requête Overpass, 53 ms » comptait le **module** `overpass.js`
   servi par Vite. Filtrer sur l'hôte, pas sur l'URL — sans quoi on croit
   qu'Overpass répond en 50 ms.

## CE QUI RESTE OUVERT

- Le premier trait d'eau reste à **8,8–13,5 s** sur un vol. **Le levier n'est
  pas dans la couche d'eau** : c'est l'arrivée du MNT (76 Mo, 500 requêtes).
  C'est le terrain de `wt-cib` (priorité des tuiles) et de `wt-cr1`.
- Le budget de 6 s de la n° 1 reste payé une fois par chargement. Le réduire
  serait un arbitrage produit (couper une requête saine de 927 ms), pas une
  correction — et il ne rendrait pas le premier trait plus tôt.
