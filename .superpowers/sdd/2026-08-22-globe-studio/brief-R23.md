# R23 — LES DEUX SAUTS DE CAMÉRA QUI RESTENT

Arbre : `C:\Dev\wt-vit` · branche `vitesse-camera` (partie de `regroupement`).
Serveur : `npm run dev` — **port libre au-dessus de 5800**.

## POURQUOI CETTE TÂCHE PASSE AVANT LES AUTRES RESTES

C'est la règle à laquelle Adrien tient le plus, et il l'a écrite deux fois :

> **D16 :** *« On va faire disparaître la transition entre tous les zooms. Depuis
> le mode orbital jusqu'au premier crop de bloc, la caméra doit être unique et
> sans chargement ni saut de position. (…) Une seule vue qui zoome
> progressivement. »*
>
> **D16 bis :** *« Il ne faut pas deux caméras, il n'en faut plus qu'une seule et
> unique. »*
>
> **Adrien, plus tard :** *« on utilise le centre de la Terre comme point de
> rotation, excepté en mode crop. »*

La campagne a livré la caméra unique et le pivot du bloc. **Deux discontinuités
survivent, toutes deux consignées et non corrigées.** Elles sont ta tâche.

---

## DÉFAUT ① — LE SAUT DE VITESSE AU FRANCHISSEMENT (×66,67)

**Il est déjà mesuré**, dans l'en-tête de `src/monde/pivot-bloc.js` (limite ③) :

> *« `rotateSpeed` passe de **0,015 à 1 en une image** quand la traversée pose le
> mode surface — un facteur **66,67**, et le geste passe de 0,006716 à
> 0,447079 °/px. Ce saut préexiste à R13 et R13 n'y touche pas. »*

Le relevé complet du geste, sur un glissé de 100 px, écran 1280×800
(`.banc/R13/avant.json`) :

| régime | `rotateSpeed` | azimut par pixel |
|---|---|---|
| orbite, 60 000 km | 1 | **0,447079 °/px** |
| orbite, 10 000 km | 1 | 0,447753 °/px |
| orbite, 1 000 km | 0,219746 | 0,098919 °/px |
| orbite, 40 km | **0,015** | **0,006716 °/px** |
| **le bloc** | **1** | **0,447079 °/px** |

Les deux lignes qui comptent : `src/modes.js:1517` applique la loi orbitale
`clamp((orbAlt / R_GLOBE) × 1,4, 0,015, 1)` — donc **0,015 collé au plancher**
en descendant ; `src/modes.js:1001` pose `rotateSpeed = 1` quand le mode surface
s'installe. **Entre les deux images, ×66,67.**

⚠️ **Et le plancher `0,015` est lui aussi suspect.** Il est atteint bien avant le
franchissement : à 1 000 km on est déjà à 0,2197, à 40 km à 0,015. La descente
finit donc sur un geste **66 fois plus lent** que celui qu'Adrien juge « parfait ».
⛔ **Ne suppose pas que la bonne réponse est « supprimer le saut en gardant la
loi ».** Établis d'abord, par la mesure, **quel geste on veut à chaque altitude**,
puis rends la loi continue jusque-là. Le juge est le °/px, pas `rotateSpeed`.

### La contrainte qui rend ça délicat, et il faut l'avoir en tête

`src/monde/pivot-bloc.js` a établi que **la sensation ne vient pas de la vitesse
mais de la CIBLE** : en orbite `controls.target = (0,0,0)`, la Terre reste
plantée au centre du cadre ; sur le bloc la cible est le point visé. R13 a réglé
ça par une **rotation rigide** autour de l'axe du bloc. Lis tout son en-tête
avant de toucher quoi que ce soit — notamment :

⛔ **Écrire `controls.target` est interdit.** `veille-repos.js` surveille
`|Δ ln(distance caméra→cible)|` avec `SEUIL_BOUGE_LOG = 1e-4`, et c'est ce signal
qui arme la bascule de trois quarts de **D16 ter** (*« on passe en vue 3/4 quand
on arrive au bloc, pas avant »*). Déplacer la cible produit **6,608e-3, soit 66 ×
le seuil**. D16 ter est acquis à 0,000 057° d'inclinaison sur 971 images — **on
ne dépense pas ça.**

➡️ Si ton correctif touche la distance caméra→cible, **il est faux**. Vérifie-le :
c'est un test, pas une intention.

---

## DÉFAUT ② — LA BUTÉE À 88,2° LAISSE LA CAMÉRA PASSER SOUS LE SOL

`src/main.js:1414` et `src/modes.js:1000` posent
`controls.maxPolarAngle = Math.PI × 0,49` — **88,2°**. `src/modes.js:738` la
relâche à `Math.PI` (180°) dans l'autre régime.

Deux choses à établir **par la mesure, pas par le raisonnement** :

1. **À quelle altitude et dans quelle configuration la caméra finit-elle sous le
   terrain ?** Un précédent de ce chantier : le bouton ciné laissait la caméra
   **862 m sous le sol** après arrêt, et le constat « c'est réversible » était
   faux — il a fallu mesurer la hauteur, pas croire au bouton.
2. **88,2° est-il le bon nombre, ou le nombre qui restait ?** Sur une sphère la
   butée polaire n'a pas le même sens que sur un plan : `Math.PI × 0,49` est une
   valeur de mode plat. ⚠️ **C'est exactement la classe de défaut qui est revenue
   NEUF fois sur ce chantier : une constante transportée d'un espace à l'autre
   sans sa conversion.** Facteurs déjà attrapés : 121,6 · 10 · 130,4 · 6, une
   portée de flou de 1 465 km, des toponymes 1 830 m sous les Alpes.

`src/monde/descente-bornee.js` et `src/monde/fenetre-bornee.js` existent — regarde
si la borne du sol y a déjà sa place avant d'en écrire une nouvelle.

---

## LES INSTRUMENTS QUI MENTENT — ils ont déjà produit de faux constats ici

- **`Input.dispatchMouseEvent` type `mouseWheel` n'atteint PAS le gestionnaire de
  l'appli** : **0 cran sur 175** dans un banc réel. ⛔ Ne pilote pas le zoom
  comme ça — c'est le piège numéro un de ta tâche, tu vas vouloir simuler une
  descente. Passe par l'API de l'appli, ou par un événement que tu as **prouvé**
  reçu (compte les appels côté gestionnaire).
- **`requestAnimationFrame` ne se déclenche pas dans un panneau qui ne
  composite pas** — un banc a compté « 0 image en 3,7 s ». Patron qui marche :
  `scripts/sonde-demarrage.mjs` (Chrome sans tête).
- **Le globe tourne tout seul** à ~1,88–2 °/s après 3 s d'inactivité. **Ta mesure
  d'azimut par pixel doit soustraire cette dérive**, ou geler la rotation — sinon
  tu mesures la Terre, pas le geste.
- **Une sonde posée APRÈS la fonction lit un état déjà écrasé.** Une variable de
  budget a rendu **404** là où sa vraie valeur était **0** — un chiffre
  parfaitement plausible de la mauvaise grandeur. **Instrumente DANS la boucle.**
- **Un relevé sur UNE image ne prouve rien** si le système oscille : **20 images
  consécutives**, et exige la stabilité. Trois audits ont rendu trois plafonds
  différents sur ce dépôt pour cette seule raison.
- **La suite de tests peut verrouiller le défaut** : avant de corriger, relis les
  assertions qui bordent `rotateSpeed` et `maxPolarAngle`. Une assertion qui
  décrit le gaspillage comme un contrat fait **échouer le bon correctif**.

⚠️ **Règle du chantier, quinze fois sur quinze : si tu trouves que mon départage
est faux, c'est TOI qui as raison.** Mesure, et écris-le.

## LES RÈGLES — dans ce dossier

- **D16 / bis / ter** (`regle-D16.md`) — à lire en entier, c'est ta tâche.
- **D17** (`regle-D17.md`) — ⛔ **IL N'Y A PAS DE PRODUCTION.** Le site n'est pas
  en ligne. **N'écris jamais « production rigoureusement inchangée » en étape de
  fin** : consigne abrogée, elle a fait perdre du temps.
- `lecons-campagne-R.md` — le défaut systémique du « chiffre le plus favorable ».

## L'ATTENDU

1. **Le geste continu du haut de l'orbite jusqu'au bloc** : une table de °/px sur
   au moins six altitudes couvrant les deux régimes, **avant et après**, et
   **aucun rapport supérieur à 1,5 entre deux images consécutives** au
   franchissement. C'est le critère chiffré, pas « ça a l'air fluide ».
2. **La caméra ne passe jamais sous le sol** : mesure la hauteur caméra−terrain
   sur une descente complète et sur une rotation à butée, et donne le minimum.
3. La distance caméra→cible **inchangée** — `veille-repos` ne doit rien voir.
   Prouve-le : `|Δ ln|` relevé, comparé à `SEUIL_BOUGE_LOG = 1e-4`.
4. **D16 ter tient toujours** : la bascule de trois quarts arrive au bloc et pas
   avant. Relève l'inclinaison sur la descente comme R13 l'a fait.
5. Des tests. ⚠️ **`package.json` porte une LISTE EXPLICITE de fichiers de
   test** : un test absent de la liste **ne tourne jamais**. Ajoute les tiens,
   puis `npm run audit:tests` — **aucun écart**.
6. `npm test` — **base à battre : 4 422 · 0 échec**.
7. ⚠️ **Scripts d'édition en BINAIRE** (ou `newline='\n'`) : le mode texte de
   Windows met les fichiers en CRLF contre le `.gitattributes` — **deux tests
   sont déjà morts dessus**.
8. Commits sur `vitesse-camera`, messages en français.
9. Rapport `rapport-R23.md` dans ce dossier, avec les deux tables de °/px, la
   hauteur minimale caméra−sol, et une section **« ce que j'ai cru puis
   réfuté »** — sur ce chantier c'est la section la plus utile.

Travaille jusqu'au bout, ne pose pas de question : tranche, mesure, corrige.
