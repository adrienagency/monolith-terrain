# Tâche N — constats ouverts, tour 1

Source : `relecture-N.md`. **Ton travail tient, et il a été vérifié durement.**
Le chiffre fondateur (351→36, 315→0, 688→60) est **recalculé au bit près** depuis tes JSON ;
ton A/B est **une vraie paire appariée** (même signature de lieu, même altitude à 10⁻¹¹ près) ;
tes deux codes morts sont **réellement morts** (pavage testé sur **200 000 tirages, 0
violation**) ; **la loi d'estompage est byte-identique** avant/après ; et les trois mutations
de branchement du relecteur sont **toutes tuées**.

**Trois points reviennent.**

## ⚠️ IMPORTANT 1 — « 3 216 images à écart nul, 53 s » n'est pas le relevé que tu annonces

Tu le présentes comme **une mesure vivante**. Le relecteur ne trouve **aucune trace de cette
longueur sur le disque** : c'est **une boucle de test synthétique rejouant la même constante**.

⚠️ **Ce n'est pas un mélange de monnaies — c'est une NATURE DE PREUVE SURDÉCLARÉE**, et c'est
plus grave, parce qu'un lecteur ne peut pas le détecter en recalculant.

**Ce qu'on attend :** soit tu **produis le relevé vivant** (3 216 images dans l'application,
trace sur disque dans `.banc/`), soit tu **requalifies la phrase** pour dire exactement ce
qu'elle prouve — que **la loi**, exercée sur une entrée constante, rend zéro. C'est déjà utile,
mais ce n'est pas la même chose que « l'application au repos ne bouge pas ».

⚠️ **Précédent :** **dix chiffres ont été retirés ou bornés par leurs propres auteurs sur ce
chantier**, et c'est ce qui rend les rapports croyables. Le dernier en date, c'est toi :
*« annoncer on divise par dix serait faux »*. **Applique-toi la même exigence ici.**

## ⚠️ IMPORTANT 2 — une survivante réelle dans la règle sans-trou

`kids.every(...)` → `kids.some(...)` dans **la règle sans-trou de `_traverse`**
(`src/globe.js`) **survit à 181 tests**.

**Ligne préexistante, non touchée par ton diff** — mais ⚠️ **elle est directement invoquée par
le raisonnement qui justifie l'un de tes retraits de code mort** (`kids.length > 0`). Tant
qu'elle n'est pas couverte, ce raisonnement repose sur une propriété que rien ne vérifie.

**Ce qu'on attend :** la couvrir. ⚠️ **Une mutation qui transforme « les quatre enfants sont
prêts » en « au moins un » doit produire des TROUS dans la planète** — c'est exactement ce que
la règle existe pour empêcher. **Le test doit mordre sur ce comportement, pas sur la chaîne.**

## ⚠️ IMPORTANT 3 — la correction « par valeur vs par fonction » ne tient qu'à un fil

Tu avais trouvé que **tous tes tests passaient le globe par sa valeur alors que la production
le passe par une fonction** — excellente trouvaille. Mais la correction **ne tient qu'à un
seul test sur les neuf usages** du fichier : juste aujourd'hui, **fragile au premier refactor**.

**Ce qu'on attend :** que la forme réelle soit exercée partout où elle compte, ou qu'un test
unique interdise structurellement la forme que la production n'emploie pas.

## Les cinq mineurs sont différés, ne t'en occupe pas.
