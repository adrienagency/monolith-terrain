# TOUR DE CORRECTION GROUPÉ — quatre tâches, un seul passage

Quatre relectures ont laissé des constats. **Aucun n'est visible à l'écran** ; tous relèvent de
la preuve ou de la couverture. **Trois dispatches séparés coûteraient trois fois le contexte
pour le même résultat.**

⚠️ **Les rapports d'origine sont à côté** (`relecture-J.md` ... `relecture-P2.md`) : lis celui
qui correspond avant de traiter un point.

---

## ⛔ ① CRITIQUE — P2 : un chiffre-titre non traçable à sa propre source

Le rapport de la Tâche P2 annonce **« cadrages appariés à 0,009 %, cent fois mieux que le 1 %
demandé »**, en citant `cadrage-apparie.json`.

**Le relecteur a ouvert le fichier** : il contient **5 essais et non 10**, et **calcule
lui-même −0,05 %** pour la paire retenue. Le rapport a **substitué une mesure ultérieure et
séparée** (251 157 au lieu de 251 258) **pour cette seule ligne, sans le dire**.

⚠️ **C'est la QUINZIÈME occurrence du défaut endémique de ce chantier.**

**Ce qu'on attend :** **republier le chiffre qui remonte à la source** — 0,05 % —, dire qu'il
reste **20× meilleur que la barre du brief**, et **retirer le « cent fois »**.
⚠️ **La conclusion de fond est intacte : ce n'est pas le travail qui est en cause, c'est la
ligne.** *Un chiffre retiré vaut mieux qu'un chiffre faux — quinze l'ont déjà été ici.*

---

## ⛔ ② CRITIQUE DE FAIT — P3 a touché `terrain.js` en deux endroits sans rejouer la garantie de P2

La Tâche P2 avait prouvé que **le socle de production reste bit-identique** : **0 pixel sur
1 024 000, trois chargements, `git stash` à l'appui**. **P3 a modifié `terrain.js` en deux
endroits et déclare ne pas avoir rejoué cette comparaison.**

**Ce qu'on attend :** **rejoue-la.** Si le socle a bougé, **dis de combien et pourquoi** —
ce n'est plus interdit (D13), **mais ça doit être su, pas subi.**

---

## ⚠️ ③ N — une nature de preuve surdéclarée

*« 3 216 images à écart nul, 53 s »* est présenté comme un **relevé vivant**. Le relecteur ne
trouve **aucune trace de cette longueur sur disque** : c'est **une boucle de test synthétique
rejouant la même constante**.

⚠️ **Ce n'est pas un mélange de monnaies : c'est une NATURE de preuve surdéclarée**, et c'est
plus insidieux — **un lecteur ne peut pas le détecter en recalculant.**

**Ce qu'on attend :** produire le relevé vivant (trace dans `.banc/`), **ou** requalifier la
phrase pour dire exactement ce qu'elle prouve : que **la loi**, sur une entrée constante, rend
zéro. **C'est déjà utile — mais ce n'est pas « l'application au repos ne bouge pas ».**

---

## ⚠️ ④ N — `kids.every` → `kids.some` survit dans la règle sans-trou

Dans `_traverse` (`src/globe.js`), muter `kids.every(...)` en `kids.some(...)` **survit à
181 tests**. Ligne **préexistante**, mais ⚠️ **elle est directement invoquée par le
raisonnement qui justifie le retrait du code mort `kids.length > 0`.**

**Ce qu'on attend :** la couvrir. ⚠️ **Une mutation qui transforme « les quatre enfants sont
prêts » en « au moins un » doit produire des TROUS dans la planète** — c'est exactement ce que
la règle existe pour empêcher. **Le test doit mordre sur ce COMPORTEMENT, pas sur la chaîne.**

---

## ⚠️ ⑤ N — la correction « par valeur vs par fonction » ne tient qu'à un fil

La trouvaille était excellente : **tous les tests passaient le globe PAR SA VALEUR alors que la
production le passe PAR UNE FONCTION**. Mais la correction **ne tient qu'à un seul test sur
neuf usages** : juste aujourd'hui, **fragile au premier refactor**.

**Ce qu'on attend :** exercer la forme réelle partout où elle compte, **ou** un test unique qui
**interdise structurellement** la forme que la production n'emploie pas.

---

## ⚠️ ⑥ K — deux mutations survivantes

Échanger **largeur et hauteur du tampon de dessin**, et **forcer la latitude à 0**, survivent.
**Trous réels**, bornés au chemin `?terre=unique`. **Couvre-les.**

---

## ⚠️ ⑦ J bis — la borne `h > 0` d'`altitudeMaillage`

`src/monde/fond-crop.js:89` : la borne **n'est pas testée entre 0 et ~100 m** avec un vrai
champ de fond ; l'élargir à `h > 100` **survit aux 275 tests concernés**.
⚠️ **Le code de production est JUSTE — c'est un trou de couverture, pas un défaut livré.**

---

## Ce qui n'est PAS dans ce tour

Les mineurs de toutes les relectures restent différés. **Et les manques n° 3 à 5 du noteur**
(l'écume, la nappe de mer qui ne rejoint pas le bloc, les jupes et l'ombre portée) **sont des
TÂCHES, pas des corrections** — ne les traite pas ici.
