# R28 — UN SEUL STYLE POUR TOUTE LA TERRE, ET LA BANDE VERTE DES CÔTES

Arbre : `C:\Dev\wt-sty` · branche `style-monde` (partie de `regroupement`).
Serveur : `npm run dev` — **port libre au-dessus de 5900**.

## LES DEUX DEMANDES, DANS LES MOTS D'ADRIEN, CE MATIN

> **③** *« Pourquoi y a-t-il une zone verte tout autour des côtes ? »*
>
> **④** *« Pourquoi la différence de style au-dessus de Z10 et tout ce qui est en
> dessous de Z10 est-elle aussi différente ? Je veux que ce soit le style qui est
> utilisé en dessous de Z10 qui habille toute la Terre — excepté l'eau, qu'on
> simule au-dessus de Z10 comme tu le fais avec la vue orbitale. »*

⚠️ **Sa convention de vocabulaire, établie dans le même message** : « au-dessus
de Z10 » = la vue **la plus ÉLOIGNÉE**, « en dessous de Z10 » = la plus
**proche**. Donc : **il veut le style de PRÈS, appliqué partout.**

## CE QU'IL A ENVOYÉ — quatre captures, décrites ici parce que tu ne les as pas

- **Capture 1 (Bornéo, vue moyenne)** : mer turquoise, terres beige-brun, et
  **une bande vert pâle qui suit tout le trait de côte**, côté terre, sur les
  basses altitudes. Toponymes visibles (KOTA KINABALU, SANDAKAN, TAWAU). C'est
  la « zone verte » de sa question ③.
- **Capture 2 (La Réunion, vue éloignée — le style qu'il NE veut PAS)** : le bloc
  est brun/blanc, correct — mais **tout autour, un aplat vert olive uniforme**,
  sans relief, sans bathymétrie. On distingue à peine un liseré de route.
- **Capture 3 (La Réunion, vue proche — LE STYLE QU'IL VEUT)** : relief peint,
  couleurs hypsométriques riches (blanc des sommets, roses, ocres, verts), trait
  de côte net, mer turquoise avec ses hauts-fonds, grain de papier.
- **Capture 4 (le globe entier)** : océan turquoise avec bathymétrie, terres
  ocre/brun, nuages, graticule. **C'est cette eau-là qu'il veut garder** au loin.

⚡ **Sa demande se résume donc à : le style de la capture 3 doit habiller toute la
planète, avec l'eau de la capture 4.** Et l'aplat olive de la capture 2 doit
disparaître.

## ⛔ CE QUE JE CROIS, ET QUI N'EST QU'UNE HYPOTHÈSE

**Sur ce chantier, l'exécutant qui mesurait a eu raison contre mon départage
dix-huit fois sur dix-huit.** Les six dernières tâches ont chacune réfuté au
moins un point de mon brief. Prends donc ceci comme une piste, pas comme un
constat :

- `src/globe.js` peint la mer avec **le BAS de sa propre table** (« `uRamp` dans
  [0 ; 0,35] », commenté ligne 1078). Si le point de partage entre bathymétrie et
  hypsométrie ne tombe pas exactement au zéro des altitudes, **la première bande
  de terre reçoit une couleur de mer, ou l'inverse** — ce qui produirait
  exactement une bande le long des côtes.
- `RAMPE_MONDE` vient de `src/monde/rampe-crop.js`, qui porte le grade
  hypsométrique mondial (**contraste 4,5 / pivot 0,56**, établi sur une médiane
  mesurée de 478 m).
- `uAerialCoastFade` (`globe.js:1326`) est déclaré **avec sa propre valeur, pas
  celle du crop** (commentaire ligne 1356), et `plan-fusion.md` porte une réserve
  ouverte : *« `uAerialCoastFade` non porté : au large, photo pleine côté globe là
  où le socle estompe. Écart non mesuré. »*

➡️ **Commence par établir d'où vient le vert, pixel par pixel.** Pas par
raisonnement : par instrumentation.

## ✅ LA MÉTHODE QUI A MARCHÉ SUR EXACTEMENT CE PROBLÈME

R19 cherchait pourquoi les courbes de niveau du crop étaient invisibles. Il a
**forcé une sortie de débogage à chaque étage du nuanceur** et l'a relue **sur
une passe brute de `sceneGlobe`, HORS du compositeur**. Résultat :

| étage | moyenne sur 255 |
|---|---|
| le témoin `dedansCrop` | 253,78 |
| `minor` (les bandes) | **12,26 — elles existaient** |
| `crowd` | 250,21 — ne coupe rien |
| **`minFade`** | **3,57 — zéro** |

Le coupable était `clamp(1,6 − texel × 0,55)` avec `texel = 3,00`, soit
**exactement zéro** : les courbes étaient **impossibles par construction**.
Correctif : une ligne.

⚠️ **Le détail qui compte** : lu *après* le compositeur, un témoin binaire 0/1
revenait **entre 34 et 128** — donc illisible. **Lis la passe brute.**

✅ **Et si ce que tu mesures est trop petit pour une moyenne d'image** (une bande
de côte l'est), R21 a la manœuvre : **ne cherche pas ta bande, fais-la se
désigner.** Deux images **au même instant**, l'uniforme suspect mis à zéro dans
la seconde ; tout pixel qui diffère **est** un pixel de la bande, par
construction. Témoin : 0 pixel sur 1 024 000.

## ⚠️ LA VRAIE DIFFICULTÉ DU POINT ④ — D15 l'a déjà tranchée à moitié

`regle-D15.md` (**à lire en entier**) établit un départage qui te concerne
directement :

**Ce qui PEUT devenir global** — la donnée existe par tuile : la normale par
fragment, le peigne de crêtes (`uTexShade`), le correctif du zéro
(`uMerZeroSousEau`), la rampe (`uRamp` est **déjà** globale).

⛔ **Ce qui NE PEUT PAS l'être tel quel** : `uCoastMask`, `uSol`, `uAnalysis`
sont **une seule texture cuite sur l'emprise du crop**. Elles ne couvrent **pas**
la planète. Les allumer hors du crop ferait lire un masque hors de son domaine —
**du bruit, ou pire, un motif répété**.

➡️ **« Le style de près partout » ne veut donc PAS dire « plaquer les habillages
du crop sur toute la Terre ».** Il faut départager, poste par poste, ce qui se
recalcule depuis la tuile et ce qui exige la cuisson du crop. ⚠️ **Si tu trouves
que ce départage est faux, c'est TOI qui as raison** — mais mesure-le.

## LE COÛT, ET C'EST LA VRAIE QUESTION

D15 le dit sans détour : la normale par fragment et le peigne de crêtes tournent
aujourd'hui sur **36 tuiles** (le crop). Les rendre globaux les fait tourner sur
**283 tuiles en orbite** (mesuré, z2→z13).

⚠️ **`gl.finish()` NE PÈSE PAS LES FRAGMENTS** — un rapport de ce chantier a été
réfuté là-dessus. Utilise `EXT_disjoint_timer_query_webgl2` **avec un témoin de
validité** : R20 a validé la sienne par ×16 fragments ⇒ ×8,2 de temps, contre
×35 ⇒ ×0,96 pour un banc CPU. Et **jette 40 rendus de chauffe après chaque
recompilation** — sans eux la première mesure vaut ×6.

⛔ **Si le coût est réel, la sortie n'est pas « tant pis » : c'est une atténuation
par distance** — le détail fin près de la caméra, dégradé au loin. Le globe le
fait déjà pour les courbes via `minFade`.

## LES AUTRES INSTRUMENTS QUI MENTENT

- **Un condensé 64×40 annule les motifs fins.** Un rapport a conclu de travers en
  lisant une vignette : il croyait lire « DEM : chargement » là où il était écrit
  « OSM · chargement ». **Pleine résolution, toujours.**
- **Le globe tourne tout seul** à ~1,88–2 °/s après 3 s d'inactivité.
- ✅ **La molette simulée MARCHE** (40/40) : l'avertissement contraire est
  **rétracté**. Le coupable était le voile d'accueil `.ce-hubveil`, qui mange
  **tous** les gestes. **Ferme-le (Échap) avant tout banc.**
- **Relève `window.__palierMachine` DANS chaque relevé** : il pilote ombres,
  grain et `pixelRatio` avant tes réglages, et `signaux.ecran` rend `[0,0]` dans
  le panneau navigateur.
- ⚠️ **Le barème de l'inventaire est partiellement sous le bruit** : R21 a établi
  un transitoire de **~0,17 / 0,33**, une mesure sur douze, cause non
  identifiée. **Entre 0,06 et 0,19, un relevé unique ne décide de rien.**
- **Un relevé sur UNE image ne prouve rien** si le système oscille : 20 images
  consécutives, et exige la stabilité.
- **La suite de tests peut verrouiller le défaut.** Relis les assertions qui
  bordent la rampe et le trait de côte avant de corriger — R24 en a trouvé une
  qui **exigeait** le défaut.

## LES RÈGLES — dans ce dossier

- **D15** (`regle-D15.md`) — ⚠️ **la plus importante pour toi**, lis-la en entier.
- **D16 / bis / ter** — une seule caméra, une seule vue. **N'ajoute ni caméra ni
  passe de rendu sans l'avoir chiffrée.**
- **D17** — ⛔ **IL N'Y A PAS DE PRODUCTION.** N'écris jamais « production
  rigoureusement inchangée » en étape de fin : consigne abrogée.
- `plan-fusion.md` — l'état courant, tenu à jour.

## L'ATTENDU

1. **La bande verte : sa cause nommée, à l'étage du nuanceur, avec le chiffre**
   — pas une hypothèse. Puis corrigée, avec un avant/après en pleine résolution.
2. **Le style de près appliqué à toute la Terre**, avec le **départage écrit** :
   ce qui est devenu global, ce qui reste borné au crop, **et pourquoi, mesuré**.
3. **L'eau garde le rendu de la vue orbitale au loin** — c'est explicite dans sa
   demande.
4. **Le coût en temps GPU**, minuterie du pilote, témoin de validité, **à au
   moins trois altitudes** (orbite, z10, crop). Si tu poses une atténuation par
   distance, donne sa loi et son seuil.
5. **Des captures avant/après aux quatre situations de ses captures** : Bornéo
   vue moyenne, La Réunion loin, La Réunion près, le globe entier.
6. Des tests. ⚠️ **`package.json` porte une LISTE EXPLICITE de fichiers de
   test** : un test absent ne tourne **jamais**. `npm run audit:tests`, aucun
   écart.
7. `npm test` — **base à battre : 4 576 · 0 échec**.
8. ⚠️ **Scripts d'édition en BINAIRE**, et **relis l'octet écrit**
   (`grep | cat -A`) : deux agents s'y sont fait prendre cette nuit — un `\b`
   devenu retour arrière, un `0x0D` posé dans un rapport.
9. Commits sur `style-monde`, messages en français.
10. Rapport `rapport-R28.md` ici, avec une section **« ce que j'ai cru puis
    réfuté »** — elle n'a **jamais** été vide sur ce chantier.

⚠️ **Deux autres agents tournent.** `C:\Dev\wt-mat` tient **le matériau et les
préréglages PBR** (`terrain.setMaterialMode`, `material-presets.js`, la
transmission) — **n'y touche pas**. `C:\Dev\wt-piv` tient **la caméra**
(`modes.js`, `zoom-continu.js`, `pivot-bloc.js`) — n'y touche pas non plus. **Toi
tu tiens la colorisation** : la rampe, le trait de côte, la bathymétrie, le
peigne de crêtes, le grain, et le nuanceur de `globe.js` côté couleur.

Travaille jusqu'au bout, ne pose pas de question : tranche, mesure, corrige.
