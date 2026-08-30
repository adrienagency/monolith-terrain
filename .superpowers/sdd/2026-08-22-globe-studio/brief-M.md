### Tâche M — LA MORT DES PALIERS, ET LA FIN DES RECHARGEMENTS ⚠️ « ULTRA IMPORTANT »

**Adrien, 2026-08-22 :**

> *« Le mouvement de caméra du ciel à la terre comme évoqué, on supprime toutes les zones,
> ultra important, fais-le. Pourquoi toute la terre se recharge alors qu'elle est déjà
> qualitative quand je saute d'un niveau ? Il n'y a qu'à améliorer la zone sur laquelle on
> zoome et pas le reste, limite les zones à améliorer. Je ne veux aucun saut, aucun
> rechargement de la terre. Fluide comme on avait précisé. Il n'y a qu'une terre, vire
> absolument ton système de saut de niveau !!! »*

#### ① LA LOI DE ZOOM — MESURÉE, PAS CHOISIE (D9)

Dix-neuf altitudes relevées par Adrien dans Google Earth, **63 170 km → 126 km**,
**18 intervalles** :

| | |
|---|---|
| rapport global | **501,35** |
| **moyenne géométrique** | **×1,41256** = **0,49832 octave** · `ln = 0,34541` |
| écart-type des rapports | **0,0126** (min 1,4032 · max 1,4600) |
| **racine de 2** | **0,5 octave exactement** · `ln = 0,34657` · **écart 0,12 %** |

➡️ **`STEP = Math.LN2 / 2`. Le rapport est CONSTANT sur toute la descente.**

⛔ **Le dépôt pose `STEP_IN = STEP_OUT = Math.LN2` (`src/modes.js`) — DEUX FOIS TROP.**

⚠️ **Ne code PAS une loi « de moins en moins forte ».** Ce qui rétrécit est l'écart en
kilomètres (18 153 au premier cran, **51 au dernier**), **pas le rapport**. **C'est la
constance qui produit la stabilité qu'Adrien admire** — une loi décroissante la casserait.

⚠️ **Le réglage porte sur le CRAN, pas sur le tour de molette** : le nombre de crans par tour
dépend de la souris.

#### ② TOUT CE QUI RAISONNE PAR PALIERS DOIT MOURIR (chemin `?terre=unique` uniquement)

Inventaire déjà fait, avec appelants —
`.superpowers/sdd/2026-08-21-terre-unique/inventaire-studio.md` §④ :

- `DIVE_TIERS` / `pickDiveTier` (`src/modes.js:62-81`), table à **neuf paliers**
- **`src/escalier-zoom.js` — module entier**
- l'indicateur `ORB` / `Z{n}` — `src/ui/zoom-stepper.js`, câblé dans `src/main.js`
- `_orbitNotch(dir)` (`src/modes.js:779`)
- ⚠️ **`poseCranContinu()` (`src/loi-altitude.js:181`) — C'EST LUI L'ACCROCHAGE DE CAMÉRA** :
  il repose la caméra à `camY × facteurEchelle` à chaque cran, et c'est le coupable documenté
  de la discontinuité d'exagération.
- `niveauDePlongee()` (`src/loi-altitude.js:247`) — **à vérifier avant retrait.**

⛔ **NE TOUCHE PAS AU MODE PLAT** : `src/terrain.js`, `src/plinth.js`, `src/ocean.js` et le
chemin bloc gardent leurs paliers **intacts**. `shibumap.com` est en production dessus.

#### ③ ⚡ D10 — EXAGÉRATION FIXE À ×2 SUR TOUTE LA MAP (décision d'Adrien, 2026-08-22)

> *« On va faire une exagération d'altitude unique à ×2 sur toute la map, ça évitera les
> sauts et les rechargements. »*

⚠️ **CETTE DÉCISION SUPPRIME LE PROBLÈME À LA RACINE, ET ELLE REMPLACE PLUSIEURS CHOSES :**

- **Elle remplace D6** (« ≈2 au zoom maximal, variation limitée ») : **il n'y a plus de
  variation du tout. Une constante, partout, à toute altitude.**
- ➡️ **`setExaggeration` n'est plus appelée en cours de route** → **`_rechargeTuiles()` n'est
  plus déclenchée** → ⛔ **les 12 à 21 secondes de rechargement DISPARAISSENT sans qu'on ait
  à porter le relief dans le nuanceur de sommets.**
- **Le portage GPU devient donc FACULTATIF, plus un préalable.** ⚠️ **Ne le fais pas dans
  cette tâche** : il reste utile un jour (l'exagération redeviendrait un réglage vivant),
  mais **Adrien a choisi la voie qui n'en a pas besoin.** **Écris-le comme différé, pas
  comme abandonné.**
- **`src/monde/exageration-continue.js`** (la courbe monotone de la Tâche E, ses ancres, ses
  quatorze lecteurs) **devient sans objet sur le chemin `?terre=unique`.**
  ⚠️ **NE LE SUPPRIME PAS** : il sert encore au mode plat et il est gardé par des tests.
  **Fais-le rendre la constante sur ce chemin, et dis-le.**

**La contrepartie est connue et ACCEPTÉE par Adrien — ne perds pas de temps à la démontrer.**
La Tâche E avait relevé qu'à ×2,8 la silhouette du limbe passe de ≈7 px à ≈1 px sur un
cadrage plein disque : à ×2 la Terre vue de l'orbite sera quasiment lisse, comme Google Earth.
**Adrien : « Ne me montre pas, c'est ok pour ×2. »** ➡️ **Pas de banc là-dessus.**

#### ⚡ D11 — IL N'Y A PLUS QU'UN SEUL MODE : LA SPHÈRE

> **Adrien, 2026-08-22 :** *« Il n'y a plus de mode plat !!! Il y a juste un seul mode
> sphère, on ne touche plus au mode plat, c'est juste une sauvegarde. »*

⚠️ **CECI CORRIGE D4.** J'avais écrit que les deux chemins coexistaient et que **« chaque
option est à régler DEUX FOIS »**. **C'est faux désormais :**

- **Le mode plat est une SAUVEGARDE GELÉE**, pas un chemin parallèle à maintenir.
- ⚡ **D12 — L'INTERDICTION EST LEVÉE** (Adrien, 2026-08-22) : *« Il n'y a PAS d'interdiction
  de modifier `terrain.js`, `plinth.js` et `ocean.js`. Il faut absolument les adapter à la
  nouvelle version, ou créer une copie de ces éléments avec un nom différent pour les adapter
  à la vue sphérique. »* ➡️ **Voir la règle d'arbitrage au bas de ce fichier.**
- ➡️ **Tout le travail vise la sphère, et elle seule.** Aucun réglage en double, aucune
  vérification en double. **Ne dépense pas une minute à préserver la parité fonctionnelle
  entre les deux.**
- ⚠️ **Le drapeau `?terre=unique` reste le chemin d'essai et son défaut reste `false`** —
  Adrien n'a pas demandé de basculer la production, et `shibumap.com` est en ligne.

#### ③ bis — CE QUI RESTE DU RECHARGEMENT, POUR MÉMOIRE

`setExaggeration(v)` (`src/globe.js:4252`) appelle **`_rechargeTuiles()`**
(`src/globe.js:4220`), qui pour **CHAQUE tuile prête** relâche **le maillage, la texture, les
hauteurs ET le plan**, la remet à `empty`, puis **repart des racines**.

> Commentaire du dépôt (`globe.js:4249-4251`) : *« relief exaggeration is baked into vertex
> positions — rebuild ready meshes. Les hauteurs ne survivent plus au maillage : la
> reconstruction passe donc par le RÉSEAU, pas par un tampon retenu. »*

**Coût mesuré deux fois, aller et retour, La Réunion z12 : 12 s et 21 s** pour retrouver
~900 tuiles prêtes (`paquet-E-tour1.md:47`).

➡️ **C'EST LA RÉPONSE EXACTE À LA QUESTION D'ADRIEN.** Changer l'exagération **jette la
planète entière et la retélécharge**.

⚠️ **ET LE DÉPÔT NOMME LUI-MÊME LE REMÈDE** (`src/flags.js:344`) : **déplacer le relief dans
le nuanceur de sommets.** Le relief cesserait d'être cuit dans les positions, et changer
l'exagération deviendrait **un uniforme**, pas un rechargement.

- [ ] **Décide, mesure, et dis-le** : le portage dans le nuanceur de sommets est-il faisable
      ici, ou faut-il d'abord retenir les hauteurs ? ⚠️ **L'étude du fondu a établi que le RTC
      est déjà posé correctement** — origine sur la surface **DÉPLACÉE** (`globe.js:2993`),
      avec un commentaire qui explique pourquoi. **Vérifie ce que ça implique si le
      déplacement passe au GPU : l'origine ne peut plus être calculée depuis une hauteur que
      le CPU ne connaît plus.** C'est le piège central de ce portage.
- [ ] ⚠️ **Le second appelant de `_rechargeTuiles` est `rechargeApresContexte()`** (perte de
      contexte WebGL) — **celui-là est légitime et rare. Ne le casse pas.**

#### ④ N'AMÉLIORER QUE LA ZONE VISÉE

Le critère d'affinage est `ratio = t.chord / dist` (`src/globe.js:3360`),
`SPLIT_RATIO = 0,38`, `MERGE_RATIO = 0,304`.

⚠️ **Aucune règle de voisinage n'existe** (`grep` négatif sur toute contrainte de balance),
et **le crop impose déjà un zoom prescrit uniforme** dans son emprise.
**Borne l'affinage à ce qui est visé, et mesure le trafic avant/après.**

#### La clôture

- [ ] Test rouge → implémenter → mutation **visant le BRANCHEMENT** → **REGARDER L'ÉCRAN** →
      clôture.
- [ ] ⚠️ **CRITÈRE MESURABLE, ET C'EST LE CŒUR : une descente de l'orbite au sol ne doit
      contenir AUCUNE reposition de caméra et AUCUN rechargement de tuile déjà prête.**
      Le patron existe : la Tâche 1a a compté les sauts d'un profil de descente —
      **onze au départ, zéro après.**
- [ ] **Captures dans `.banc/vues-M/`.**
