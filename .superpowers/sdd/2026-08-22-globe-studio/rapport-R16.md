# Rapport R16 — l'imagerie satellite sur la SURFACE du globe

**Statut : FAIT ET MESURÉ. L'image apparaît à toute distance, du globe entier
au sol.** Étapes 1 à 7 traitées ; l'étape 4 est livrée dans sa forme
« quadtree » (grossier par l'aïeul, puis remplacement par le niveau propre) et
PAS dans sa forme « fournisseur national au-delà de z8 », qui reste ouverte et
dont le coût est chiffré au §8.

**Commit** : `940a8cc` — « R16 - l imagerie va sur la SURFACE du globe, une
texture par tuile de quadtree ».
**Tests** : `npm test` → **4 394 / 4 394 verts** (base 4 369, +25 R16).
`npm run audit:tests` → **226 listés · 226 sur disque · aucun écart**.

---

## 0. CE QU'ADRIEN VOIT MAINTENANT

`.banc/R16/globe-entier-apres.png` — la planète entière, imagerie satellite sur
les terres, rampe bathymétrique turquoise et nuages sur les mers, à
**20 000 km**. `.banc/R16/continent-afrique-apres.png` — Sahara, Sahel, golfe de
Guinée à **3 000 km**, c'est-à-dire **la vue continentale de ses captures**.
`.banc/R16/regional-alpes-apres.png` — les Alpes enneigées à **600 km**.
`.banc/R16/bouton-reunion-orbite.png` — La Réunion, Maurice et Rodrigues vues
de **1 200 km**, l'océan gardant ses zones de fracture.

Le bouton se manœuvre en vue de surface (il n'est pas affiché en orbite,
`monde/visibilite-surface.js` le borne à `vue.boutons`), et **son état traverse
la sortie en orbite** : allumé sur le bloc, la photo est là partout ensuite.
Mesuré : `bouton-reunion-orbite.png`, **40 tuiles dessinées sur 40 avec photo**.

⚠️ **Et le bloc n'a rien perdu** : `.banc/R16/bouton-reunion-surface.png` montre
l'orthophoto IGN sur le crop, crédit « Orthophotos © IGN · NASA GIBS » compris.
Le nuanceur borne la couche de surface par `(1.0 - dedansCrop)` : les deux
couches ne se recouvrent jamais, l'orthophoto nationale à 20 cm/px garde la
priorité là où elle existe.

---

## 1. LA DÉCISION, ET POURQUOI ELLE EST CELLE-LÀ

R12 avait tranché, et sa démonstration tient : **le crop ne peut jamais montrer
un continent**, il naît sous 32,3 km et meurt au-dessus de 40,3 km, où son
emprise fait déjà 1,4 × la hauteur de l'écran à z13 et 1 475 × à z3.

L'imagerie est donc allée sur la **surface** : **une texture par tuile de
quadtree**, demandée par `_traverse`, évincée par la même discipline.

- **Le tri spatial est celui du quadtree, il n'y en a pas un second.** Le cache
  ne décide rien de spatial : `_traverse` lui passe les tuiles **dessinées**,
  et il leur trouve une photo.
- **Le grossier d'abord est gratuit parce que le quadtree est un arbre.** Une
  tuile z12 lit la photo de son aïeul z8 par une sous-fenêtre d'UV
  (`sousFenetre`), donc elle est couverte immédiatement, en basse résolution,
  puis remplacée dès que son propre niveau arrive.
- **Une seule source mondiale** : NASA GIBS Blue Marble (CC0, terre + océan,
  sans nuages), plafond z8. C'est ce qui referme, **sur la surface**, le
  troisième refus de R12 : l'Afrique entière, l'Amérique du Sud et la majeure
  partie de l'Asie ont désormais une photo. C'est aussi ce qui évite le piège
  mesuré par R12 — « swisstopo à z3 rend une TUILE BLANCHE de 1 632 octets » :
  on n'interroge jamais un service national à l'échelle d'un continent.

---

## 2. ÉTAPE 1 — L'INSTRUMENT SE PROUVE AVANT DE COMPTER

`.banc/R16/sonde.mjs`, Chrome sans tête, 1280×800, RTX 3080/ANGLE D3D11.

**⛔ Deux instruments ont menti avant de dire vrai. Les deux sont nommés ici
parce qu'ils invalidaient des chiffres, pas parce que c'est joli.**

1. **`performance.getEntriesByType('resource')` est plafonné à 250 entrées** et
   il ment en silence dès la 251ᵉ. Premier relevé : **249 + 1 = 250 pile**, et
   **zéro requête MNT visible** alors que la carte s'affichait. Le compteur est
   maintenant celui du navigateur (CDP, `page.on('response')`).
2. **`requestAnimationFrame` ne se déclenche pas dans un onglet qui ne
   composite pas** — le piège ⑤ du brief, rencontré tel quel : trois appels de
   suite ont expiré à 45 s dans un volet masqué. Toutes les mesures passent donc
   par Chrome sans tête, jamais par le volet.
3. **Et la première série entière était fausse pour une troisième raison** :
   sans `enterOrbit`, `globe.enabled` reste faux et le quadtree ne parcourt que
   le crop — **112 tuiles, 36 dessinées, z13, à TOUTES les altitudes**.

**Les deux témoins, à chaque exécution :**

| témoin | attendu | mesuré (avant) | mesuré (après) |
|---|---|---|---|
| **NUL** — hôte jamais appelé | 0 | `null` (0) | `null` (0) |
| **NUL** — hôtes d'imagerie, couche éteinte | 0 | **0 requête** | — |
| **POSITIF** — MNT | ≫ 0 | **675 req · 75,5 Mo** | **673 req · 75,4 Mo** |

Si le témoin positif était nul, aucun chiffre de ce rapport ne vaudrait.

**Protocole** : 5 altitudes, **20 images consécutives par relevé**, stabilité
exigée et publiée (`stable=true` sur les 5 paliers, avant comme après).

⚠️ **Correction de protocole, trouvée en mesurant** : `main.js` fait tourner la
planète tout seule après 3 s d'inactivité (`camera.position.applyAxisAngle(UP,
dtAmb * 0.035)`). Mesuré : **~2 °/s de longitude** — une pose sur les Alpes
(lon 8) se relevait **sur l'Ukraine (lon 52)** douze secondes plus tard, et
trois captures ont été prises en croyant viser la Suisse. La sonde bat
maintenant un `wheel` vide toutes les 1,5 s, et **publie la position atteinte,
pas la position demandée**.

---

## 3. ÉTAT DES LIEUX — AVANT (couche éteinte)

| palier | altitude | position | cache MNT | dessinées | visites | z dessinés | photo |
|---|---|---|---|---|---|---|---|
| globe entier | 20 000 km | 10 N / 20 E | 138 | 28 | 40 | z2:10, z3:18 | **0** |
| hémisphère | 9 000 km | 10 N / 20 E | 205 | 61 | 108 | z2:8 z3:7 z4:26 z5:20 | **0** |
| **continent (Afrique)** | 3 000 km | 10 N / 20 E | 301 | 44 | 192 | z2:8 z5:1 z6:35 | **0** |
| régional (Alpes) | 600 km | 46,5 N / 8 E | 465 | 45 | 232 | z2:4 z8:41 | **0** |
| proche (Alpes) | 90 km | 46 N / 7,5 E | 673 | 143 | 364 | z2:4 z10:37 z11:102 | **0** |

**Zéro octet d'imagerie, à toutes les altitudes, sur toute la session.** C'est
l'état des lieux : le globe n'a jamais demandé une seule tuile satellite.

---

## 4. ÉTAPE 3 — LE TRI SPATIAL D'ABORD. CE QUI ENTRE DANS LE CACHE.

**C'est la mesure que le piège ① du brief réclame, et c'est la plus importante
du rapport.**

| palier | cache MNT avant → après | visites avant → après | dessinées avant → après |
|---|---|---|---|
| globe entier | 138 → **138** | 40 → **40** | 28 → **28** |
| hémisphère | 205 → **205** | 108 → **108** | 61 → **61** |
| continent | 301 → **301** | 192 → **192** | 44 → **44** |
| régional | 465 → **465** | 232 → **232** | 45 → **45** |
| proche | 673 → **673** | 364 → **364** | 143 → **143** |

**Rigoureusement identique.** L'imagerie n'a pris **aucune** place dans le cache
d'altitude et n'a **rien** ajouté au parcours : elle est accrochée aux tuiles
**dessinées**, à la fin de `_traverse`, là où le tri spatial a déjà tout décidé.

Et le rapport est lui-même mesuré : à l'orbite, `_traverse` **visite 40 tuiles
pour en dessiner 28** ; au régional, **232 pour 45**. Demander l'imagerie des
232 aurait quintuplé ce qui entre, sans peindre un pixel de plus.

**⑥ Une tuile ne demande QUE son aïeul plafonné** : 64 tuiles de quadtree z12
sous une même tuile d'imagerie z8 font **1 requête**, pas 64
(`test/photo-monde.test.js` ⑥).

---

## 5. ⛔ DEUX DÉFAUTS TROUVÉS EN MESURANT — ET ILS SE VOYAIENT À L'ÉCRAN

### a) Le plafond comptait les ENTRÉES, donc l'attente affamait les textures

Premier jet, Alpes à 600 km, après 14 s de repos (`.banc/R16/diag-noir.png`) :
**192 entrées au plafond, dont 140 EN ATTENTE et 48 prêtes seulement**, file à
141. Les tuiles z8 peignaient avec la photo de leur **aïeul z4** — 600 m/px
devenus 9,6 km/px, un vert quasi noir sur les Alpes. **Le budget de mémoire
vidéo était consommé par des requêtes qui n'avaient pas encore un seul octet en
mémoire vidéo**, et il évinçait de vraies textures pour les loger.

C'est le piège ② du brief, pris par un angle qu'il ne nomme pas : le budget ne
gelait pas, il **se remplissait de vide**.

Deux parades, et les deux sont celles que `globe.js` porte déjà pour son MNT :

1. **le plafond compte les TEXTURES**, pas les entrées ;
2. **la file se purge par image** de ce que l'image courante n'a pas demandé —
   c'est `globe._purgerFile` mot pour mot. Une entrée évincée restait dans la
   file et `demander` en recréait une neuve à l'image suivante : la file
   gonflait d'objets morts.

**Après** : file **0**, entrées **188**, prêtes **188**, évictions **0**, et
chaque tuile z8 lit **sa propre** photo z8 (`uPhotoUv = 0,0,1,1` — vérifié
tuile par tuile). Trois tests le verrouillent (`④bis`).

### b) Sans fondu côtier, l'océan devient noir

Blue Marble peint l'océan quasi noir. Multiplié par la luminance, il **effaçait
la rampe bathymétrique sur les deux tiers de la planète** : capture à 600 km
au-dessus de l'océan Indien, **écran entièrement noir**. R9 avait mesuré
exactement cela sur le crop (« 72,7 % des pixels, écart moyen 93,6/255 »).

Même loi que R9, avec le budget du MONDE : `smoothstep(-uOceanDepth ×
uPhotoFonduMer, 0, h)`, soit **600 m** de bande.

⚠️ **Et la première version de ce correctif était inopérante** : elle
réutilisait `uAerialCoastFade`, qui vaut **0 au repos** (`HABILLAGE_MONDE` :
« c'est le "éteint" du socle ») et ne prend 0,1 que lorsque `poserHabillage`
transmet la valeur vivante du BLOC. **En orbite il n'y a pas de bloc.** L'océan
est resté noir jusqu'à ce que la couche reçoive sa propre valeur.

**Prix déclaré** : une cuvette continentale sous le niveau de la mer perd une
part de sa photo — vallée de la Mort (−86 m) : **93 % gardés** ; Caspienne
(−28 m) : 99 % ; mer Morte (−430 m) : **13 %**. Et **une mer intérieure sans
bathymétrie dans le MNT (h ≈ 0) garde la photo**, donc reste sombre — observé
sur la mer Noire.

---

## 6. ÉTAPES 5 ET 7 — LE COÛT, DANS LES DEUX SENS

### Réseau

| palier | imagerie (requêtes) | MNT (requêtes) |
|---|---|---|
| balayage complet des 5 altitudes | **188 req · 1 974 814 o = 1,88 Mio** | **673 req · 75,4 Mio** |

**L'imagerie pèse 2,5 % du réseau de la session.** Une tuile Blue Marble z8
mesure **10,5 Kio en moyenne** (1 974 814 / 188), contre ~112 Kio pour une tuile
de MNT terrarium.

⚠️ **Et c'est un chiffre de session, pas de vue** : à caméra immobile, une fois
convergé, le réseau d'imagerie retombe à **zéro** (relevés `net={}` sur trois
paliers sur cinq pendant les 20 images).

### Mémoire vidéo

Le calcul est **dérivé, pas annoncé** : une texture 256² en RGBA sans mipmaps
pèse `256 × 256 × 4` = **262 144 octets = 256 Kio pile**.

| palier | entrées prêtes | mémoire vidéo |
|---|---|---|
| globe entier | 33 | **8,3 Mio** |
| hémisphère | 84 | **21,0 Mio** |
| continent | 123 | **30,8 Mio** |
| régional | 188 | **47,0 Mio** |
| proche | 188 | **47,0 Mio** |
| **PIRE CAS, BORNE DURE** | **192** | **48,0 Mio** |

**Pas de mipmaps, et c'est un choix chiffré** : la chaîne ajouterait **+33,3 %**
(48,0 → 64,0 Mio) pour un filtrage dont le globe n'a presque jamais besoin — la
photo est MAGNIFIÉE dès que le quadtree passe z8. **Le prix est dit** : près du
limbe, une tuile vue en biais minifie, et là le linéaire sans mipmap crible.

**⚠️ LA BORNE EXACTE, DITE SANS FLATTERIE.** L'éviction refuse de toucher ce que
l'image courante PORTE — sans quoi elle jetterait la couverture de l'écran pour
la redemander aussitôt. La borne vraie est donc `max(192, clés vues à une
image)`, et c'est le nombre de tuiles **dessinées** qui borne le second terme :
**28 à 143** sur les cinq paliers. Le plafond domine partout. Un test le dit
explicitement plutôt que d'annoncer la valeur flatteuse.

### Formats compressés — MESURÉS SUR CETTE MACHINE

`getSupportedExtensions()` (RTX 3080, ANGLE D3D11), extensions de compression
**réellement présentes** :

    EXT_texture_compression_bptc
    EXT_texture_compression_rgtc
    WEBGL_compressed_texture_s3tc
    WEBGL_compressed_texture_s3tc_srgb

**Ni ETC ni ASTC** — ce sont des formats mobiles ; ils ne sont pas là sur ce
poste, et je ne les rapporte donc pas comme disponibles.

Ce qu'ils changeraient, par arithmétique sur le plafond livré :

| format | octets / tuile 256² | 192 entrées | facteur |
|---|---|---|---|
| RGBA8 (livré) | 262 144 | **48,0 Mio** | — |
| BC7 (`bptc`), 1 o/texel | 65 536 | **12,0 Mio** | ÷ 4 |
| DXT1 (`s3tc` RGB), 0,5 o/texel | 32 768 | **6,0 Mio** | ÷ 8 |

⛔ **ET ILS NE SONT PAS ATTEIGNABLES GRATUITEMENT, ce que le brief mérite
d'entendre.** NASA GIBS sert du **JPEG**. Pour poser du DXT1 sur le GPU il faut
soit (a) un encodeur CPU dans le navigateur, tuile par tuile, avec une seconde
perte par-dessus celle du JPEG, soit (b) **héberger** une pyramide KTX2/Basis
transcodée — c'est-à-dire exactement la leçon des 887 Mo de tuiles routières que
`map/aerial-layer.js` raconte en tête de fichier. Ce que font les grands, c'est
(b), et ils hébergent leur imagerie.

**Et la compression n'est pas la contrainte qui mord ici** : les 48,0 Mio de
borne dure sont déjà **plus petits qu'UNE SEULE mosaïque de crop** (36,0 Mio
pour un bloc z15, table de `aerial-layer.js`). Le levier gratuit, si le poste
devait descendre, est le plafond lui-même : 96 entrées = **24,0 Mio**, au prix
d'un peu plus de recharge sur un panoramique rapide.

### Temps par image — ET CE QUE CHAQUE GRANDEUR MESURE

| palier | `msUpdate` avant → après | `msImage` avant → après |
|---|---|---|
| globe entier | 0,130 → 0,155 | 17,15 → 16,75 |
| hémisphère | 0,110 → 0,215 | 17,30 → 17,44 |
| continent | 0,165 → 0,160 | 17,35 → 17,27 |
| régional | 0,485 → 0,270 | 17,16 → 17,04 |
| proche | 0,610 → 0,425 | 17,43 → 17,16 |

⚠️ **`msImage` NE MESURE PAS NOTRE COÛT, IL MESURE LA VSYNC** : ~17 ms des deux
côtés, c'est l'écran. Publié comme témoin de non-régression, pas comme mesure.

⚠️ **`msUpdate` est le temps de `globe.update()`, et c'est UNE BORNE
INFÉRIEURE** : le chronomètre entoure le calcul, donc **il exclut le
téléversement des sommets et des textures**, qui a lieu au rendu, après nous.
C'est nommément le piège ⑤ du brief.

**Et il faut le lire comme du bruit, pas comme un gain** : deux paliers sont
plus lents après, deux sont plus rapides, sur 20 images chacun. **Je ne
revendique aucune accélération.** Ce que la table établit, c'est qu'aucun palier
ne se dégrade au-delà de ce bruit — l'écart maximal est de **+0,105 ms**
(hémisphère), pour un budget d'image de 16,7 ms.

---

## 7. LE TROISIÈME REFUS — VÉRIFIÉ, ET LA RÉPONSE EST : NON, PAS TOUT SEUL

Le brief demandait de vérifier si le travail sur la surface referme le refus
« No detailed imagery for this area » du Congo. **Réponse en deux parts.**

**Ce qui EST résolu : la couverture.** La surface du globe a désormais une photo
**partout**, y compris là où aucun fournisseur national n'existe. Mesuré :
`continent-afrique-apres.png` (10 N / 20 E, Tchad — aucun fournisseur national)
montre l'imagerie ; `globe-entier-apres.png` la montre sur l'Amérique du Sud et
l'Asie. Le globe ne connaît plus de zone sans photo.

**Ce qui n'est PAS résolu : la garde qui éteint le bouton.** Elle vit dans
`refreshAerialCore` (`p?.global && params.demZoom > 8` → `params.aerialEnabled =
false`), **je ne l'ai pas touchée** — R12 l'a qualifiée de décision de produit,
et mon brief la met explicitement hors périmètre. Or mon câblage lit
`params.aerialEnabled` **après** le cœur, pour que le bouton vert et la planète
disent la même chose. Conséquence : **quand cette garde éteint le bouton, elle
éteint aussi la couche de surface.**

Le correctif tient en une décision, pas en du code : que la garde refuse **la
mosaïque du crop** sans toucher à `params.aerialEnabled`, et le bouton devient
honnête partout — « pas de détail ici, mais la photo du monde reste ». **Ce
n'est pas à moi de la prendre.**

⚠️ **Et je ne prétends pas avoir reproduit le refus.** Mes deux tentatives de
poser le bloc sur le Congo ont échoué à déplacer réellement la carte (le hash
`#s=` n'a pas porté : les deux lieux atterrissaient à la position par défaut ;
`loadRealTerrain({ centreSur })` a chargé mais `enterOrbit` est reparti de la
position par défaut). **Le §7 ci-dessus est donc établi par lecture du code,
pas par une capture**, et il est publié comme tel.

---

## 8. CE QUI RESTE OUVERT, ET SON COÛT

**L'affinage par fournisseur national au-delà de z8.** L'étape 4 du brief est
livrée dans sa forme quadtree (couverture grossière immédiate par l'aïeul, puis
remplacement par le niveau propre — c'est ce que la §5a a fait apparaître). Elle
n'est PAS livrée dans sa forme « source plus fine ».

**Le manque est chiffré** : à 90 km d'altitude, l'écran fait ~65 km de large sur
1 280 px, soit **51 m/px demandés** ; NASA z8 sert **600 m/px**. La photo y est
donc **~12 × plus grossière que l'écran** — c'est visible sur
`proche-alpes-apres.png`, où le relief fin z11 se lit à travers une photo floue.
La fenêtre où cela compte est étroite (entre 40 km, où le crop reprend, et
~150 km), mais elle existe.

**Ce que ça coûterait** : une résolution de fournisseur par tuile, une seconde
famille d'URL, et la gestion des 404 de bord que `aerial-layer.js` documente.
Je ne l'ai pas prise parce que l'étape 3 devait être mesurée d'abord — et,
mesurée, elle suffit à faire apparaître l'image à toute distance.

---

## 9. RÉSERVES

1. **§7 : le bouton reste éteignable par la garde du crop.** Décision de
   produit, non prise.
2. **L'attribution NASA GIBS n'est pas affichée en orbite.** En surface le
   crédit dit « Orthophotos © IGN · NASA GIBS » ; en orbite le bandeau ne porte
   que Mapterhorn et GEBCO. Blue Marble est du domaine public (NASA), donc ce
   n'est pas une infraction de licence — mais c'est un manquement d'usage, et il
   se corrige dans `refreshOsmCredit`, que je n'ai pas touché.
3. **Une mer intérieure sans bathymétrie dans le MNT reste sombre** (h ≈ 0 →
   le fondu côtier ne la voit pas comme de l'eau). Observé sur la mer Noire.
4. **Pas de mipmaps** : filtrage linéaire seul. Près du limbe, une tuile très
   inclinée peut cribler. Non quantifié — je ne l'ai pas mesuré, je le signale.
5. **Le §7 n'a pas de capture**, voir plus haut.
6. **Une seule machine, un seul réseau.** RTX 3080 / ANGLE D3D11, `maxTexture
   16384`, `MAX_TEXTURE_IMAGE_UNITS 16`. Les chiffres de temps ne valent que
   là ; les chiffres de réseau et de mémoire, eux, sont de l'arithmétique.
7. **Le banc emprunte `puppeteer-core` à un dépôt voisin** par une jonction
   `.banc/node_modules → C:\Dev\wt-sat\node_modules`. `package.json` n'a **pas**
   été touché pour cela (sa seule modification est l'ajout de
   `test/photo-monde.test.js` à la liste explicite).

---

## 10. PÉRIMÈTRE — CE QUE J'AI TOUCHÉ, AU FICHIER PRÈS

**Ajoutés**
- `src/monde/photo-monde.js` — le cache d'imagerie (module pur).
- `test/photo-monde.test.js` — 25 tests.

**Modifiés**
- `src/globe.js` — uniformes du nuanceur (`uPhoto`, `uPhotoOn`, `uPhotoUv`,
  `uPhotoMonde`, `uPhotoFonduMer`), bloc de mélange dans le fragment,
  `chargerPhotoTuile`, `_habillerPhoto`, `setPhotoMonde`, un appel dans
  `_traverse`, un dans `update`, un dans `dispose`.
- `src/main.js` — **une ligne fonctionnelle** dans `refreshAerial`
  (`globe.setPhotoMonde(...)`), plus son commentaire.
- `test/crop-eclairage.test.js` (⑤f) et `test/crop-habillage.test.js` (①) — le
  compte de samplers passe de **9 à 10**. ⚠️ **Ces deux assertions bordaient le
  défaut** : elles ont été relues AVANT de coder, comme le piège ⑥ l'exige, et
  leur prose explique pourquoi le compte ne monte que d'un alors qu'il y a une
  texture PAR TUILE.
- `package.json` — la ligne `test` seule.

**PAS touchés**, et je le dis parce que deux tâches tournent en parallèle :
- **rien** dans `src/monde/fond-crop.js`, **rien** à `poserFondCrop`, **rien** à
  `CHAMP_FOND` — le chantier du fond marin est intact ;
- **rien** dans `src/modes.js`, `src/map/aerial-layer.js`, `src/terrain.js` ;
- dans `src/main.js`, **aucun panneau, aucune option du studio** — une seule
  fonction touchée, `refreshAerial`, et une seule ligne fonctionnelle ajoutée.
