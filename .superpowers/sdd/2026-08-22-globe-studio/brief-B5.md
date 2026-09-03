# B5 — LES CARRÉS PLATS AUTOUR DES CÔTES DU SUD DE LA FRANCE

Arbre : `C:\Dev\wt-bat3` · branche `bathy-correctif` (fais d'abord
`git merge regroupement` : l'audit BlueTopo BT-A y est entré). Serveur : port
**> 6200**, `--host 127.0.0.1`.

## LA DEMANDE — Adrien, cinq captures à l'appui

> *« Dans les zones côtières du sud de la France, j'ai de nombreux carrés plats
> autour des côtes, ce n'est pas normal. Je suis censé avoir une super
> bathymétrie à ce niveau-là. Peux-tu vérifier et corriger ? **Ce n'est pas la
> première fois que ça arrive, il doit y avoir un problème de fond.** »*

**Ce que montrent ses captures** (îles d'Hyères — Porquerolles, Port-Cros, le
Levant — et le large de Marseille, en vue de trois quarts au crop) :
- autour des îles, **des plateaux PLATS, de la couleur de la terre (gris-rose),
  découpés en RECTANGLES à bords en escalier** — des tuiles, sans ambiguïté ;
- ces plateaux **dépassent le vrai trait de côte** et couvrent ce qui devrait
  être de la mer peu profonde ;
- **la mer sombre commence au bord des rectangles**, avec le halo blanc du
  trait de côte dessiné sur **le bord du rectangle**, pas sur le bord de l'île ;
- sur la capture de Marseille, la côte continentale porte les mêmes polygones
  gris, et la mer est un aplat bleu sans relief avec une écume blanche diffuse.

➡️ Lecture la plus probable, **à vérifier avant de coder** : sur ces tuiles, la
mer peu profonde rend **h = 0 exactement**, le nuanceur la classe **TERRE**
(`sousEau = h <= 0` ou `h < 0` selon `uMerZeroSousEau`, `globe.js:1908`), et le
trait de côte se dessine là où le zéro cesse — au bord de la tuile.

## LES PISTES, PAR ORDRE — chacune est une hypothèse, pas un constat

1. **La quantification du tuileur** (`scripts/build-bathy-tiles.mjs:71,357`) :
   `quantStep = 1 m` au-dessus de −60 m, et **`v = raw < 0 ? quantize(raw) : 0`**.
   Une profondeur dans **]−1 m ; 0[** — tout le plateau littoral des calanques,
   des lagunes, du platier — tombe à **0**, qui est **le marqueur « muet »**
   (`bathy.js:208`, `sMuet = level > 0 && |s| < NODATA_EPS`) et donc de la terre
   pour le nuanceur. ⚡ **C'est le « problème de fond » que décrit Adrien : un
   encodage qui ne distingue pas « pas de donnée » de « 0 m de profondeur ».**
2. **Les tuiles EMODnet trouées** : *« EMODnet rebouche ses vides avec GEBCO »*
   — mais **nos** tuiles cuites ? Une tuile z10 absente sur le disque fait
   retomber la cascade sur GEBCO z8 (464 m) ; à cette résolution, un platier
   ≥ 0 rend 0 → terre. Compte les tuiles z9/z10 **présentes** sur la bbox des
   captures (Hyères ≈ 43,0/6,4 ; Marseille ≈ 43,25/5,3), et regarde ce qui
   manque.
3. **`rgba[3] === 0` = « pas peint »** (`dem.js:511`, `bathy.js:565`) contre
   **valeur 0 = « muet »** : deux conventions pour deux absences — vérifie
   qu'elles ne se marchent pas dessus au bord des tuiles.
4. **`terrariumMuetEnMer`** (`dem.js:461`) qui décide d'appeler ou non
   `loadBathyPatch` : sur une tuile côtière où le terrarium n'est PAS muet
   (il porte de l'ETOPO1 jusqu'à z10), la bathy fine est-elle seulement
   demandée ?
5. **`landness < 0.5 && h < uMargeCoteM`** (`globe.js:1931`) : la marge de côte
   peut-elle reclasser un platier en terre ?

## ⛔ LE PIÈGE QUI T'ATTEND — B4 l'a formulé

*« Un noteur qui reprendrait la colonne "écart" pour conclure "ça va bien" se
ferait avoir. »* Ici, **l'erreur en mètres est petite** (un platier à −0,5 m
rendu à 0 m, c'est 0,5 m d'écart) **et le défaut visuel est énorme** (une île
entourée d'un plateau de terre). ➡️ **Ton critère de succès est en PIXELS :
la surface de « terre » rendue là où la vérité dit « mer »**, sur les cinq
captures, avant/après. Pas une moyenne de profondeur.

## COMMENT MESURER

- **Reproduis les cinq vues** (Porquerolles, Port-Cros, le Levant, Marseille /
  Frioul, et une vue large des îles d'Hyères), au crop, vue de trois quarts.
- **Classe chaque pixel de la zone** : terre / mer selon le nuanceur (lis
  `sousEau` — force une sortie de débogage, méthode R19), et compare à la
  vérité : le trait de côte `land-10m.json` ou `coast-z6` du dépôt, et une
  source externe pour la bathy du platier.
- **Lis au GPU**, pas côté code ; **A/B dans la même session** (le pixel n'est
  déterministe qu'en orbite) ; ferme le voile ; **Vite sur `--host 127.0.0.1`**.
- ⚠️ **Un pixel exactement à 0 n'est pas une coïncidence** : compte-les. Si des
  milliers de pixels de mer valent 0,000 pile, c'est l'encodage.

## CE QUI NE DOIT PAS BOUGER

- **Le trait de côte** : `fuseBathymetry` *« ne peut que creuser, jamais
  émerger »* — la terre passe telle quelle. Un correctif qui creuse un pixel
  émergé déplace un rivage : **mesure-le, sur les polders néerlandais** (leçon
  payée une session entière) et sur les cinq captures.
- **Les acquis B3/B4** (9,33/10) : Java z11 à −7 105 m, mer Noire, Caspienne,
  Léman à 310,05 m, Manche à **−72 ± 5 m** (elle a déjà bougé de 4 m —
  **80 % de la tolérance**). Rejoue `test/attaque-b1-ROUGE.mjs` et
  `test/attaque-b3-REANCRE.mjs`.
- `npm test` **≥ 4 755 · 0**, `audit:tests` sans écart.

⚠️ **Un intégrateur BlueTopo travaille en parallèle** dans `C:\Dev\wt-bt2` sur
**le tuileur, `bathy-sources.js`, `dem.js` et l'index**. Si ta cause est dans le
tuileur (piste 1), **corrige-la quand même** — c'est le cœur du défaut — mais
**dis-le en tête de ton rapport avec les lignes touchées**, pour que je fasse la
fusion à la main. Ne lui parle pas, ne lis pas sa branche.

## L'ATTENDU

1. **La cause nommée à la ligne**, prouvée par le compte de pixels à 0 exact et
   par la classification terre/mer avant/après.
2. **Le correctif à la source** — si c'est l'encodage, il faut une valeur
   distincte pour « muet » et pour « 0 m » (par exemple réserver une valeur
   sentinelle, ou porter la quantification à 0,5 m sous −2 m), **avec le coût
   en octets** de la recuisson des tuiles fr-metro.
3. **Les cinq vues avant/après**, en pixels de terre-là-où-il-y-a-de-la-mer.
4. **La preuve qu'aucun rivage n'a bougé** (polders + les cinq vues).
5. Un test qui **échoue sans le correctif**, inscrit dans `package.json`.
6. `rapport-B5.md` (`git add -f`), avec **« ce que j'ai cru puis réfuté »**.

⛔ **Ne rends jamais la main « en attendant » un banc.** Ne pose pas de
question : reproduis, compte, tranche, corrige.
