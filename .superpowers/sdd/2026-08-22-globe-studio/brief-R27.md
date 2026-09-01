# R27 — LE PIVOT RESTE LE CENTRE DE LA TERRE, ET L'ORBITE COMMENCE À Z4

Arbre : `C:\Dev\wt-piv` · branche `pivot-terre` (partie de `regroupement`).
Serveur : `npm run dev` — **port libre au-dessus de 5800**.

## LES DEUX DEMANDES, DANS LES MOTS D'ADRIEN, CE MATIN

> **①** *« Le point d'orbite n'est toujours pas le bon dès qu'on passe en mode
> surface. Il doit toujours viser le centre de la Terre. Il change uniquement
> quand on passe en mode bloc croppé. Si on dézoome depuis le mode croppé, la
> caméra revient automatiquement avec une orbite autour du centre de la Terre. »*
>
> **②** *« Il faudrait passer en mode orbite pour tout ce qui est supérieur à
> Z4. »*

⚠️ **Sa convention de vocabulaire, établie dans le même message** : il écrit
« au-dessus de Z10 » pour la vue **la plus ÉLOIGNÉE** et « en dessous de Z10 »
pour la plus **proche**. Donc **« supérieur à Z4 » = tout ce qui est plus loin
que z4** (z0→z4), **pas** z5 et au-delà. Vérifie que ta lecture rend un
comportement qui a du sens avant de coder ; si la mesure te dit le contraire,
c'est toi qui as raison, mais **dis-le explicitement dans ton rapport**.

## ⛔ CE QUI EXISTE DÉJÀ, ET QUE TU NE DOIS PAS REFAIRE

C'est la troisième passe sur cette zone. **Lis les deux avant d'écrire une
ligne** :

- **`src/monde/pivot-bloc.js`** — son en-tête entier. R13 y a établi, mesuré,
  que la sensation ne vient **pas de la vitesse mais de la CIBLE** : en orbite
  `controls.target = (0,0,0)`, la Terre reste plantée au centre du cadre ; sur le
  bloc la cible est le point visé, qui se décentre (**68,324 px de dérive pour
  100 px de souris**, contre 0,001 px avec le pivot sur l'axe du bloc). La
  solution retenue est une **rotation rigide** de la caméra ET de la cible.
- **`rapport-R23.md`** — la passe de cette nuit : geste continu de l'orbite au
  bloc (aucun rapport > 1,5 entre deux images), caméra sortie de sous le sol
  (−11,84 u → −0,96 u), et **le retour à l'orbite réparé sur le compteur de
  niveau**, sans toucher `maxDistance` ni `SEUIL_MORT_M`.

## ⛔ LA CONTRAINTE QUI TUE LES CORRECTIFS NAÏFS

**Écrire `controls.target` est interdit.** `veille-repos.js` surveille
`|Δ ln(distance caméra→cible)|` avec `SEUIL_BOUGE_LOG = 1e-4`, et c'est ce signal
qui arme la bascule de trois quarts de **D16 ter** (*« on passe en vue 3/4 quand
on arrive au bloc, pas avant »*). Déplacer la cible produit **6,608e-3, soit
66 × le seuil**. D16 ter est acquis à 0,000002° d'inclinaison sur 1 809 images
(R23), et R23 a tenu `|Δ ln d|` à **1,11e-15**.

➡️ **Si ton correctif change la distance caméra→cible, il est faux.** Prouve le
contraire par un relevé, pas par une intention.

⚠️ R23 a aussi réfuté deux pistes qui semblent évidentes : borner par le sommet
du disque **supprimait la vue de trois quarts**, et un échantillonnage de cercle
partant de la cible **n'est pas invariant** (0,25 u par tour) — il aurait dépensé
D16 ter. Ne les repasse pas.

## CE QU'IL Y A À CHANGER, TEL QUE JE LE COMPRENDS — À VÉRIFIER

**La bascule du pivot se fait aujourd'hui trop tôt.** Relevé à l'écran cette
nuit : en `mode = "surface"`, `controls.target` vaut **(−0,171, −1,503, −0,171)**
— **pas** l'origine. Adrien veut que le pivot ne quitte le centre de la Terre
**qu'au crop**, c'est-à-dire quand `globe._crop` existe, et pas quand le mode
surface s'installe. Ce sont **deux événements différents**, séparés par une
longue plage d'altitude.

Les seuils utiles : `SEUIL_NAISSANCE_M = 32 274,3 m` et
`SEUIL_MORT_M = 40 342,8 m` (l'hystérésis de naissance/mort du crop).

⚠️ **Et le retour doit être automatique** : *« si on dézoome depuis le mode
croppé, la caméra revient automatiquement avec une orbite autour du centre de la
Terre »*. La bascule inverse doit donc être **symétrique et sans saut** — c'est
là que se cachera le défaut, parce que revenir demande de **recentrer la cible
sans que `veille-repos` ne le voie**.

## LES INSTRUMENTS QUI MENTENT — chacun a produit un faux constat ici

- ⛔ **Une sonde posée APRÈS la fonction lit un état déjà écrasé.** R23 a relevé
  sa butée à **59,330° sur six mesures à quatre lieux** : c'était la pose
  d'ouverture, jamais touchée. **Instrumente DANS la boucle**, en enveloppant
  `controls.update`.
- **Le lieu de départ est PLAT** (R23) : un défaut de sol y est structurellement
  invisible. Mesure en montagne — Mont-Blanc, Cervin, Everest.
- **Le globe tourne tout seul** à ~1,88–2 °/s après 3 s d'inactivité : ta mesure
  d'azimut doit soustraire cette dérive ou la geler.
- ✅ **La molette simulée MARCHE** (40/40) — l'ancien avertissement contraire est
  **rétracté** (`lecons-campagne-R.md`). Le coupable était le voile d'accueil
  `.ce-hubveil`, qui mange **tous** les gestes. **Ferme-le (Échap) d'abord.**
- **Un relevé sur UNE image ne prouve rien** si le système oscille : 20 images
  consécutives, et exige la stabilité.
- **R23 a mesuré la LATITUDE en croyant mesurer l'inclinaison** (21,26°). Vérifie
  la grandeur que tu lis, pas seulement sa valeur.
- **La suite de tests peut verrouiller le défaut** : relis les assertions qui
  bordent `pivot-bloc`, `veille-repos` et `modes.js` avant de corriger. R24 en a
  trouvé une qui **exigeait** le défaut.

## LES RÈGLES — dans ce dossier

- **D16 / bis / ter** (`regle-D16.md`) — une seule caméra, une seule vue, la vue
  3/4 n'arrive qu'au bloc. C'est ta tâche entière.
- **D17** (`regle-D17.md`) — ⛔ **IL N'Y A PAS DE PRODUCTION.** N'écris jamais
  « production rigoureusement inchangée » en étape de fin : consigne abrogée.
- `plan-fusion.md` — l'état courant du chantier, tenu à jour.

## L'ATTENDU

1. **`controls.target` vaut exactement (0,0,0) partout SAUF sur le crop**, prouvé
   par un relevé sur une descente complète : altitude, mode, `_crop`, `target`,
   à au moins dix jalons.
2. **Le retour depuis le crop recentre automatiquement**, sans saut : relève la
   position de la Terre à l'écran (en pixels) sur les images qui encadrent la
   bascule. **Aucun saut supérieur à quelques pixels.**
3. **L'orbite s'installe au-delà de z4**, et tu écris le seuil en clair avec sa
   conversion en altitude — ⚠️ **une constante de zoom et une constante
   d'altitude ne sont pas la même grandeur**, et ce dépôt a payé neuf fois ce
   genre de confusion.
4. **`veille-repos` ne voit rien** : `|Δ ln d|` relevé, comparé à `1e-4`.
   **D16 ter tient toujours** : la bascule de trois quarts arrive au bloc et pas
   avant, inclinaison relevée sur la descente.
5. Des tests. ⚠️ **`package.json` porte une LISTE EXPLICITE de fichiers de
   test** : un test absent ne tourne **jamais**. `npm run audit:tests`, aucun
   écart.
6. `npm test` — **base à battre : 4 576 · 0 échec**.
7. ⚠️ **Scripts d'édition en BINAIRE**, et **relis l'octet écrit**
   (`grep | cat -A`) : deux agents s'y sont fait prendre cette nuit — un `\b`
   devenu retour arrière, un `0x0D` posé dans un rapport.
8. Commits sur `pivot-terre`, messages en français.
9. Rapport `rapport-R27.md` ici, avec une section **« ce que j'ai cru puis
   réfuté »** — sur ce chantier elle n'a **jamais** été vide.

⚠️ **Un autre agent travaille sur `C:\Dev\wt-sty`** (le style du monde : rampe
hypsométrique, trait de côte, colorisation de `globe.js`). **Ne touche pas à la
colorisation** ; ton terrain est `modes.js`, `zoom-continu.js`, `pivot-bloc.js`,
`veille-repos.js`, `descente-bornee.js` et les contrôles dans `main.js`.

Travaille jusqu'au bout, ne pose pas de question : tranche, mesure, corrige.
