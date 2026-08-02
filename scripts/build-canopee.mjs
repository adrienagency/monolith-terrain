#!/usr/bin/env node
// CUISEUR DE HAUTEUR DE CANOPÉE — ETH Global Canopy Height 10 m (2020),
// CC-BY 4.0, devient des tuiles PNG dans la grille XYZ Web Mercator, comme la
// bathymétrie, les masques d'eau et l'occupation du sol avant elle.
//
//   node scripts/build-canopee.mjs --zone vosges --bbox 6.6,47.8,7.4,48.4 --zmin 8 --zmax 13
//   node scripts/build-canopee.mjs --bbox ... --dry    (compte, n'écrit rien)
//
// ⚠️ CE FICHIER EST LE JUMEAU DE build-occupation-sol.mjs, ET IL LUI RESSEMBLE
// TROP POUR QU'ON LISE L'UN EN CROYANT LIRE L'AUTRE. Trois choses diffèrent, et
// chacune casserait la cuisson en silence si on recopiait la mauvaise :
//
//   1. LE CODEC. WorldCover est en DEFLATE, prédicteur 1 (aucun). L'ETH est en
//      LZW, prédicteur 2 (différence horizontale). `zlib.inflateSync` refuse
//      net le flux LZW ; d'où le décodeur écrit plus bas.
//   2. CE QUE PORTE UN OCTET. Là-bas un CODE DE CLASSE, qu'il est interdit de
//      moyenner. Ici une HAUTEUR EN MÈTRES, qu'on a parfaitement le droit de
//      moyenner — et c'est ce qui rend les aperçus du COG utilisables tels
//      quels, quelle que soit la façon dont l'ETH les a construits.
//   3. LE 255. La source note « pas de donnée » avec la valeur 255. Écrite
//      telle quelle dans la tuile, elle deviendrait une forêt de 255 mètres,
//      c'est-à-dire la couleur la plus sombre de la rampe sur tous les océans
//      et toutes les banquises du monde. On la remet à 0 À LA CUISSON.
//
// ┌─ LES DRAPEAUX QUI COMPTENT ────────────────────────────────────────────────
// │ --reprendre      saute toute tuile DÉJÀ sur le disque. ⚠️ Mettez-le TOUJOURS
// │                  sur une cuisson longue : sans lui, la moindre coupure
// │                  repart de zéro. Le manifeste, lui, s'écrit au fil de l'eau.
// │ --paralleles N   tuiles en vol (défaut 16 ; 32 sur une bonne liaison — le
// │                  gain plafonne vite, voir la constante).
// │ --echantillon N  cuit N tuiles réparties dans la liste, et s'arrête. Le
// │                  sondage de débit, à faire AVANT d'engager des heures.
// │ --sans-masque    désactive le masque de terre. À n'utiliser que pour
// │                  comparer : il triple le coût.
// │ --cache-mo N     plafond du cache de blocs (défaut 512).
// └────────────────────────────────────────────────────────────────────────────
//
// ═══════════════════════════════════════════════════════════════════════════
// POURQUOI ON CUIT, ET PAS AUTRE CHOSE — l'arbitrage, avec ses chiffres
// ═══════════════════════════════════════════════════════════════════════════
//
// Trois voies étaient ouvertes. Elles ont été SONDÉES EN VRAI le 2026-08-02,
// pas supposées :
//
// ═══════════════════════════════════════════════════════════════════════════
// LA SOURCE — DEUX CANDIDATS, ET UN SEUL EXISTAIT ENCORE
// ═══════════════════════════════════════════════════════════════════════════
//
//   · META × WRI 1 m — ÉCARTÉ, ET PAS PAR ARBITRAGE. Le seau annoncé,
//     `s3://dataforgood-fb-forests`, répond `NoSuchBucket` : le nom n'existe
//     plus (sondé le 2026-08-02). Il n'y avait donc rien à peser.
//     Et il aurait perdu de toute façon : le pixel de sortie le plus fin qu'on
//     demande vaut 9,5 m au sol (z14). Le mètre de Meta aurait été jeté par le
//     rééchantillonnage avant d'atteindre l'oeil, en échange d'un volume de
//     données cent fois supérieur.
//
//   · ETH GLOBAL CANOPY HEIGHT 10 m (2020) — RETENU. Lang et al., CC-BY 4.0,
//     dalles de 3°×3° en COG. Sondé sur N45E006 : 407 Mo, 7 images gigognes
//     (36000² à 1/12000 de degré ≈ 9,26 m, puis 18000², 9000², 4500², 2250²,
//     1125², 563² à ~590 m), toutes découpées en tuiles internes de 1024×1024.
//
// ═══════════════════════════════════════════════════════════════════════════
// POURQUOI ON CUIT, ET PAS AUTRE CHOSE — l'arbitrage, avec ses chiffres
// ═══════════════════════════════════════════════════════════════════════════
//
//   (a) LIRE LE COG DEPUIS LE NAVIGATEUR. Impossible, et SONDÉ plutôt que
//       supposé — la consigne était explicite, parce que la réponse aurait pu
//       différer de celle de WorldCover. Elle ne diffère pas :
//       libdrive.ethz.ch répond bien 206 Partial Content sur une requête
//       `Range` (donc le COG est lisible par morceaux), mais sa réponse ne
//       porte AUCUN en-tête `access-control-allow-origin`. Or une requête
//       `Range` n'est pas « simple » au sens CORS : elle EXIGE un contrôle
//       préalable, que rien n'autorise ici. Le navigateur ne peut pas lire ces
//       fichiers, point.
//       (Au passage, l'ancienne adresse share.phys.ethz.ch ne sert plus la
//       donnée du tout : elle redirige en 301 vers une page de DOI.)
//
//   (b) CUIRE. Retenu, pour les mêmes raisons que l'occupation du sol : aucune
//       dépendance à l'exécution, et c'est la forme que le projet connaît déjà
//       par coeur (bathy, water-tiles, lake-tiles, coast-z6, sol).
//
// ⚠️ ET CUIRE NE VEUT PAS DIRE TÉLÉCHARGER LES DALLES. C'est ce qui rend la
// voie (b) effrayante sur le papier : 407 Mo par dalle de 3°. Mais un COG est
// fait pour être lu PAR MORCEAUX — on ne lit que les blocs de 1024² qui
// touchent la tuile de sortie, soit quelques centaines de kilo-octets, pris
// dans l'APERÇU dont la résolution colle au zoom demandé.
//
// ⚠️ SAUF À z14, ET C'EST VÉRIFIÉ : pasDeg y vaut 8,583e-5° quand pasSource(0)
// vaut 8,333e-5°, donc `niveauPour` rend 0 — l'IMAGE PLEINE. Et z14 est bien un
// zoom cuit (Mont-Blanc, Landes et Paris y montent). La phrase « on ne touche
// jamais l'image pleine » qui figurait ici, et plus bas dans `Dalle`, était donc
// fausse au zoom le plus fin — celui, précisément, où elle coûte le plus cher.
//
// ═══════════════════════════════════════════════════════════════════════════
// LES QUATRE OPTIMISATIONS HÉRITÉES — elles viennent de la cuisson mondiale du sol
// ═══════════════════════════════════════════════════════════════════════════
//
// Ce cuiseur naît adulte : il hérite des quatre choix que la cuisson mondiale
// d'occupation du sol a payés en vrai le 2026-08-02. Chacun est la différence
// entre « une heure » et « impossible ». Ils sont documentés à l'endroit où ils
// vivent ; les voici rassemblés, avec les mesures d'origine :
//
//   1. LE MASQUE DE TERRE. ~65 % des tuiles du carré Mercator sont écartées
//      SANS UNE SEULE REQUÊTE. C'est le levier principal. Voir sa section.
//   2. UNE LECTURE D'EN-TÊTE AU LIEU DE HUIT. Le COG range ses IFD dans ses
//      28 premiers kilo-octets : une plage de 64 Ko les couvre tous.
//      Mesuré : 1 116 → 248 requêtes pour 599 tuiles d'Europe.
//   3. UNE BOUCLE DE PIXELS QUI N'ALLOUE RIEN. `await` par pixel, objet de
//      position par pixel, clé de cache par concaténation : 65 536 fois par
//      tuile. Mesuré sur les mêmes 599 tuiles : 58 s → 17 s.
//   4. UN CACHE DE BLOCS COMMUN ET BORNÉ. Par dalle, il retenait 2,6 Go à z8.
//
//   Débit mesuré là-bas au bout du compte : ~36 tuiles/s en zone dense.
//
// ⚠️ ET LA REPRISE (`--reprendre`), qui n'est pas une optimisation mais une
// condition d'existence : une cuisson de plusieurs heures SANS reprise n'est pas
// une cuisson lente, c'est une cuisson qui n'aboutit pas.
//
// ═══════════════════════════════════════════════════════════════════════════
// CE QUE LE SOCLE MONDIAL A COÛTÉ EN VRAI — 2026-08-02
// ═══════════════════════════════════════════════════════════════════════════
//
//   z8 et z9 mondiaux (-180,-60,180,84), --paralleles 32 :
//   68 332 tuiles écrites, 9 544 écartées, 915 s — 85,1 tuiles/s, 856 Mo.
//   2 635 dalles COG ouvertes sur 2 954 sondées, 14 519 requêtes de plage,
//   1 104 Mo lus pour 856 Mo écrits.
//
// ⚠️ ET LE SONDAGE (`--echantillon`) SOUS-ESTIME LE DÉBIT D'UN FACTEUR TROIS,
// systématiquement — il faut le savoir avant d'annoncer une durée. 400 tuiles
// prises tous les 194 rangs tombent chacune sur une dalle différente : le
// sondage a ouvert 512 dalles pour 400 tuiles et n'a réutilisé AUCUN bloc, d'où
// 28 tuiles/s. La vraie cuisson parcourt la liste dans l'ordre géographique :
// 2 635 dalles pour 68 000 tuiles, blocs voisins chauds, 85 tuiles/s. Le
// sondage reste juste sur ce qu'on lui demande vraiment — le POIDS par tuile
// (12,6 Ko annoncés, 12,8 mesurés) et la part de tuiles muettes (11,8 % contre
// 12,3 %) —, mais sa durée est un plafond, pas une prévision.
//
// ⚠️ ET LE COMPTE N'EST PAS LE POIDS. En NOMBRE, cette cuisson est moins chère
// que celle du sol (68 332 tuiles contre 76 060) parce que le filtre muet écarte
// 12,3 % des tuiles terrestres contre 2,3 % là-bas. En POIDS elle est TROIS FOIS
// plus chère (856 Mo contre 286) : une hauteur est un champ continu et bruité,
// une classe d'occupation forme des plaques identiques. Voir le compteur de
// tuiles uniformes dans `main` — 0 ici, 6 301 là-bas, et c'est la même cause.
//
// Le coût de z10, mesuré par sondage le même jour (250 tuiles, 84,8 % écrites,
// 13,6 Ko pièce) sur les 232 546 tuiles terrestres du zoom : ~197 000 tuiles et
// ~2,6 Go, en ~45 min au débit ci-dessus. Il n'a PAS été lancé.
//
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ LE PIÈGE DU VOISIN N'EST PAS LE NÔTRE — ET C'EST CE QUI PIÈGE
// ═══════════════════════════════════════════════════════════════════════════
//
// build-occupation-sol.mjs consacre sa plus longue section à une interdiction :
// NE JAMAIS MOYENNER UN CODE DE CLASSE. Entre 10 (arbres) et 80 (eau) il n'y a
// pas 45, il n'y a rien, et une moyenne y fabrique des classes inexistantes.
//
// ⚠️ CETTE INTERDICTION NE S'APPLIQUE PAS ICI, ET LA RECOPIER PAR RÉFLEXE
// SERAIT UNE FAUTE. La hauteur de canopée est un CHAMP CONTINU, comme la
// bathymétrie : entre 10 m et 12 m il y a 11 m, et 11 m est une hauteur réelle.
// C'est le tuileur bathymétrique — celui qui MOYENNE sur la cellule de sortie —
// qui est le bon modèle mental pour cette donnée-ci, pas le tuileur de classes.
//
// En pratique on ne moyenne rien nous-mêmes : on laisse le COG le faire, en
// choisissant l'APERÇU dont la résolution colle au pixel de sortie puis en y
// prenant le plus proche voisin. La différence avec le voisin est qu'ici on n'a
// même pas besoin de VÉRIFIER comment l'ETH a construit ses aperçus : moyenne ou
// plus proche voisin, les deux rendent une hauteur licite. Là-bas, il avait
// fallu prouver que les 7 niveaux ne contenaient que des codes légaux.
//
// ⚠️ LA SEULE VALEUR QUI N'EST PAS UNE HAUTEUR : 255, le « pas de donnée » de
// la source. Elle DOIT être neutralisée à la cuisson (voir `cuisTuile`), sinon
// elle devient une forêt de 255 m — c'est-à-dire le bout le plus sombre de la
// rampe étalé sur tous les océans et toutes les banquises.
//
// ═══════════════════════════════════════════════════════════════════════════
// CE QU'ON ÉCRIT : DES MÈTRES, PAS UNE COULEUR
// ═══════════════════════════════════════════════════════════════════════════
//
// La tuile est un PNG en NIVEAUX DE GRIS dont chaque octet EST la hauteur de
// canopée EN MÈTRES. Pas la couleur finale, et pas une hauteur remise à
// l'échelle sur 0-255 non plus :
//
//   · la palette reste modifiable sans recuire un seul octet — ce qui compte
//     dans un projet dont les templates vendent justement des palettes ;
//   · un canal au lieu de trois, sur une donnée par grandes plaques : ça se
//     dégonfle beaucoup mieux ;
//   · et une remise à l'échelle (« 45 m sur 255 pour user de toute la
//     dynamique ») ajouterait un facteur à tenir accordé entre CE fichier, la
//     table de src/canopee.js et le nuanceur. Trois endroits, deux occasions de
//     diverger en silence, pour gagner une précision dont une couleur n'a aucun
//     usage. L'octet dit des mètres, et tout le monde le lit comme ça.
//
// Attribution obligatoire, portée par src/canopee.js :
//   « ETH Global Canopy Height 2020 » — CC-BY 4.0.

import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
// ⚠️ La force des hauteurs vient du MODULE CLIENT, elle n'est pas recopiée ici.
// Voir la table `MUET` plus bas : c'est ce qui empêche le cuiseur et l'afficheur
// de diverger en silence sur « qu'est-ce qu'une tuile utile ».
import { forceCanopee, CANOPEE_H_ABSURDE } from '../src/canopee.js'

// ------------------------------------------------------------------ options
const argv = process.argv.slice(2)
const arg = (nom, dflt = null) => {
  const i = argv.indexOf(`--${nom}`)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : dflt
}
const flag = (nom) => argv.includes(`--${nom}`)

const OUT = arg('out', 'public/data/canopee')
// Le nom de la zone cuite. Il n'est pas décoratif : il entre dans le manifeste
// `index.json`, que le client lit pour savoir s'il a le droit d'allumer la
// couche ici (voir zoneSolPour dans src/occupation-sol.js).
const ZONE = arg('zone', null)
const ZMIN = +arg('zmin', 8)
const ZMAX = +arg('zmax', 13)
const DRY = flag('dry')
const BBOX = (arg('bbox') || '-180,-60,180,84').split(',').map(Number)
const TUILE = 256

// ⚠️ REPRENDRE — une cuisson mondiale dure des heures, et sans ce drapeau la
// moindre coupure réseau, mise en veille ou Ctrl-C repart de zéro. Avec lui,
// toute tuile DÉJÀ PRÉSENTE SUR LE DISQUE est sautée sans ouvrir un octet.
// Voir la section « LA REPRISE » plus bas pour ce que ça sous-entend.
//
// ⚠️ ÉPROUVÉ, PAS SUPPOSÉ, ET SOUS LE PIRE DES ARRÊTS. Le 2026-08-02, une
// cuisson de 803 tuiles (Amazonie, z8-z12) a été TUÉE à mi-parcours par un
// `Stop-Process -Force` — un SIGKILL, donc AUCUN gestionnaire de signal, aucun
// manifeste d'adieu, rien des politesses que le code prévoit pour un Ctrl-C.
// État trouvé sur le disque : 295 PNG, 0 reliquat `.tmp`, et un manifeste
// n'annonçant que z11 alors que des tuiles z12 étaient déjà écrites — le
// « on n'annonce qu'un zoom TERMINÉ » a tenu tout seul. La reprise a rendu
// 803/803 tuiles IDENTIQUES OCTET POUR OCTET à la cuisson d'une traite (0
// fichier différent, 0 manquant, 0 en trop), manifeste compris.
const REPRENDRE = flag('reprendre')

// Combien de tuiles se cuisent EN MÊME TEMPS. Une requête de plage vers
// Francfort coûte ~120 ms d'aller-retour pendant lesquelles la machine ne fait
// rien ; plusieurs tuiles en vol recouvrent cette attente.
//
// MESURÉ sur les 599 tuiles d'Europe à z8 : 8 → 58 s, 32 → 45 s. Le gain
// s'arrête vite parce qu'une fois l'attente recouverte, c'est le CALCUL qui
// borne (voir la boucle de `cuisTuile`, et ce qu'il a fallu lui enlever).
// 16 est le compromis retenu par défaut ; 32 sur une bonne liaison.
const PARALLELES = Math.max(1, +arg('paralleles', 16))

// Cuire N tuiles PRISES AU HASARD RÉGULIER dans la liste des tuiles à faire, et
// s'arrêter. C'est le sondage de débit : mêmes dalles, même code, même réseau
// que la vraie cuisson, mais en une minute — de quoi annoncer une durée avant
// d'engager les heures. `--echantillon 20` répartit les 20 tuiles sur toute la
// liste, donc sur tous les continents, et pas sur un seul coin de carte.
const ECHANTILLON = +arg('echantillon', 0)

// Le côté de la grille où l'on rastérise la terre Natural Earth. 4096 → une
// cellule de 0,088° ≈ 9,8 km à l'équateur. Voir « LE MASQUE DE TERRE ».
const GRILLE_TERRE = +arg('grille-terre', 4096)
const SANS_MASQUE = flag('sans-masque')
const FICHIER_TERRE = arg('terre', 'public/data/land-10m.json')
// La grille de terre dérivée d'OSM, qui sert de contre-épreuve aux atolls que
// Natural Earth ignore — voir `rattrapeAtolls`.
const DOSSIER_COTE = arg('cote', 'public/data/coast-z6')

// Le dépôt public de l'ETH. C'est un partage Nextcloud, pas un seau S3 : le
// jeton `cO8or7iOe5dT2Rt` EST l'adresse publique du dossier, et le chemin passe
// par des paramètres d'URL plutôt que par des segments.
//
// ⚠️ L'ANCIENNE ADRESSE NE SERT PLUS LA DONNÉE. share.phys.ethz.ch, celle que
// citent la plupart des billets et des dépôts, répond aujourd'hui 301 vers une
// page de DOI : un client qui la suivrait téléchargerait du HTML et le
// prendrait pour un TIFF. Le nombre magique est vérifié à l'ouverture (voir
// `ouvrir`), donc l'erreur est bruyante — mais elle serait cherchée du mauvais
// côté.
//
// ⚠️ CETTE PHRASE A ÉTÉ FAUSSE PENDANT UN TEMPS, et ça valait cher : `dallePour`
// avalait TOUTES les exceptions dans un `catch` vide, y compris celle-là. Le
// corps HTML était donc lu comme « pas de dalle ici », c'est-à-dire de la pleine
// mer. Elle n'est redevenue vraie que le jour où ce `catch` a appris à
// distinguer une absence (404/403) d'une panne.
const SEAU = 'https://libdrive.ethz.ch/index.php/s/cO8or7iOe5dT2Rt/download'
const PREFIXE = '%2F3deg_cogs'

// ------------------------------------------------------------- géographie
const lon2x = (lon, z) => ((lon + 180) / 360) * 2 ** z
const lat2y = (lat, z) => {
  const s = Math.sin((lat * Math.PI) / 180)
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 2 ** z
}
const x2lon = (x, z) => (x / 2 ** z) * 360 - 180
const y2lat = (y, z) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** z))) * 180) / Math.PI

// Le nom du COG qui couvre un point. Les dalles font 3°×3° et portent le nom de
// leur coin SUD-OUEST, arrondi au multiple de 3 inférieur.
//   45,83 N / 6,86 E  →  N45E006
export function nomDalle(lon, lat) {
  const la = Math.floor(lat / 3) * 3
  const lo = Math.floor(lon / 3) * 3
  const ns = la < 0 ? 'S' : 'N'
  const ew = lo < 0 ? 'W' : 'E'
  return `${ns}${String(Math.abs(la)).padStart(2, '0')}${ew}${String(Math.abs(lo)).padStart(3, '0')}`
}
// ⚠️ MÊME GRILLE DE 3° QUE WORLDCOVER, MÊME CONVENTION DE NOM — c'est une
// coïncidence heureuse et pas une garantie : les deux produits ont choisi le
// coin SUD-OUEST arrondi au multiple de 3 inférieur. Vérifié sur N45E006, dont
// l'ancre TIFF (tag 33922) donne bien lon 6 / lat 48, c'est-à-dire le coin
// NORD-ouest d'une dalle dont le sud est à 45.
const urlDalle = (nom) => `${SEAU}?path=${PREFIXE}&files=ETH_GlobalCanopyHeight_10m_2020_${nom}_Map.tif`

// ═══════════════════════════════════════════════════════════════════════════
// LE MASQUE DE TERRE — le levier qui divise le coût par trois
// ═══════════════════════════════════════════════════════════════════════════
//
// Le carré Mercator est à ~70 % de l'océan, et il n'y pousse pas d'arbres : la
// source n'y note que son « pas de donnée » (255), que la cuisson ramène à 0,
// c'est-à-dire à une force nulle. Cuire la pleine mer, c'est donc payer des
// heures de réseau pour écrire des tuiles que le nuanceur jettera texel par
// texel.
//
// ⚠️ LE MASQUE EST ENCORE PLUS RENTABLE ICI QUE POUR L'OCCUPATION DU SOL — mais
// il ne suffit PAS, et c'est important de ne pas le croire. Il écarte l'océan ;
// il n'écarte pas le Sahara, la toundra, les steppes ni les plaines céréalières,
// qui sont muets eux aussi et qui sont de la TERRE. C'est la table `MUET` qui
// les rattrape, après lecture. Les deux économies ne se remplacent pas.
//
// ⚠️ ET LA SEULE FAÇON DE LE SAVOIR SANS LE CUIRE, C'EST DE LE DEMANDER À UNE
// AUTRE SOURCE. Le cuiseur ne peut pas « regarder si la tuile est marine » :
// regarder, c'est déjà avoir payé les requêtes de plage qu'on cherche à éviter.
// On interroge donc la géométrie que le projet a déjà sous la main —
// `public/data/land-10m.json`, les polygones de terre Natural Earth 1:10m
// (domaine public), ceux-là mêmes que `src/coast-mask.js` rastérise pour la
// côte aux zooms grossiers.
//
// LA MÉTHODE, et pourquoi elle ne rate pas d'île :
//
//   1. On rastérise UNE FOIS, dans une grille Mercator de 4096², commune à tous
//      les zooms. Une cellule vaut 0,088° ≈ 9,8 km à l'équateur.
//   2. On MARCHE LES CONTOURS avant de remplir : chaque segment de chaque anneau
//      est parcouru par pas d'une demi-cellule, et toute cellule traversée est
//      allumée. C'est ce qui sauve les îles PLUS PETITES QU'UNE CELLULE — un
//      simple remplissage par balayage les manquerait quand elles passent entre
//      deux centres de cellule, et l'erreur serait muette : une tuile de
//      Polynésie jamais cuite, jamais réclamée, jamais vue.
//   3. On remplit ensuite les intérieurs par balayage pair-impair (les anneaux
//      intérieurs d'un groupe sont les trous : lacs, mers intérieures).
//   4. On DILATE d'une cellule. Natural Earth 1:10m généralise le trait de côte
//      de l'ordre du kilomètre, et l'ETH, lui, voit à 10 m : sans cette marge,
//      une frange côtière — deltas, mangroves, cordons littoraux — sortirait du
//      masque alors qu'elle porte de la vraie donnée. Les MANGROVES rendent cette
//      dilatation plus utile encore ici que pour l'occupation du sol : c'est
//      exactement le genre de forêt qui vit sur le trait de côte généralisé.
//
// À cette granularité le test est EXACT au sens qui compte : s'il y a de la
// terre dans une cellule, soit un contour la traverse (étape 2), soit elle est
// entièrement à l'intérieur (étape 3). Il n'y a pas de troisième cas.
//
// Le masque est CONSERVATEUR par construction : il sur-estime la terre. Une
// tuile faussement gardée coûte quelques requêtes ; une tuile faussement écartée
// est un trou permanent dans la carte. L'asymétrie est voulue.

const clampLatMerc = (lat) => Math.min(85.0511, Math.max(-85.0511, lat))

/** lon/lat → cellule fractionnaire de la grille Mercator de côté `n`. */
const cellX = (lon, n) => ((lon + 180) / 360) * n
const cellY = (lat, n) => {
  const s = Math.sin((clampLatMerc(lat) * Math.PI) / 180)
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n
}

/**
 * Rastérise les polygones de terre dans une grille Mercator de côté `n`.
 *
 * @param {{geometry:{type:string,coordinates:any}}[]} features - GeoJSON Natural Earth
 * @param {number} n - côté de la grille (puissance de deux, idéalement)
 * @param {{dilate?:number}} [options]
 * @returns {Uint8Array} n*n octets, 1 = « il peut y avoir de la terre ici »
 */
export function rasteriseTerre(features, n, { dilate = 1 } = {}) {
  const g = new Uint8Array(n * n)
  const pose = (x, y) => {
    if (x >= 0 && x < n && y >= 0 && y < n) g[y * n + x] = 1
  }
  // Les croisements du balayage, rangés par ligne. On les accumule pour TOUT le
  // fichier d'un coup plutôt que polygone par polygone : la règle pair-impair
  // s'applique par GROUPE d'anneaux (contour + trous), donc on remet à zéro
  // entre deux groupes.
  const lignes = Array.from({ length: n }, () => [])

  const groupes = []
  for (const f of features) {
    const geo = f?.geometry
    if (!geo) continue
    if (geo.type === 'Polygon') groupes.push(geo.coordinates)
    else if (geo.type === 'MultiPolygon') for (const p of geo.coordinates) groupes.push(p)
  }

  for (const anneaux of groupes) {
    let ymin = n
    let ymax = -1
    for (const anneau of anneaux) {
      for (let i = 0; i < anneau.length; i++) {
        const [lonA, latA] = anneau[i]
        const [lonB, latB] = anneau[(i + 1) % anneau.length]
        const xa = cellX(lonA, n)
        const ya = cellY(latA, n)
        const xb = cellX(lonB, n)
        const yb = cellY(latB, n)

        // (2) LA MARCHE DU CONTOUR. Le pas est d'une demi-cellule : au-delà, un
        // segment oblique sauterait par-dessus des cellules qu'il traverse.
        const pas = Math.max(Math.abs(xb - xa), Math.abs(yb - ya)) * 2
        const etapes = Math.min(100000, Math.ceil(pas))
        for (let k = 0; k <= etapes; k++) {
          const t = etapes ? k / etapes : 0
          pose(Math.floor(xa + (xb - xa) * t), Math.floor(ya + (yb - ya) * t))
        }

        // (3) LES CROISEMENTS pour le remplissage. On teste le CENTRE de la
        // ligne (r + 0,5) et on ferme l'intervalle en bas seulement, la règle
        // usuelle qui évite de compter deux fois un sommet partagé.
        const y0 = Math.min(ya, yb)
        const y1 = Math.max(ya, yb)
        if (y1 === y0) continue
        const r0 = Math.max(0, Math.ceil(y0 - 0.5))
        const r1 = Math.min(n - 1, Math.floor(y1 - 0.5))
        for (let r = r0; r <= r1; r++) {
          const yc = r + 0.5
          if (yc < y0 || yc >= y1) continue
          lignes[r].push(xa + ((yc - ya) / (yb - ya)) * (xb - xa))
        }
        if (r0 < ymin) ymin = r0
        if (r1 > ymax) ymax = r1
      }
    }
    // (3 bis) On remplit, puis on vide les seaux — la parité appartient à ce
    // groupe d'anneaux et à lui seul.
    for (let r = Math.max(0, ymin); r <= Math.min(n - 1, ymax); r++) {
      const xs = lignes[r]
      if (xs.length < 2) { xs.length = 0; continue }
      xs.sort((a, b) => a - b)
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const a = Math.max(0, Math.ceil(xs[i] - 0.5))
        const b = Math.min(n - 1, Math.floor(xs[i + 1] - 0.5))
        for (let x = a; x <= b; x++) g[r * n + x] = 1
      }
      xs.length = 0
    }
  }

  // (4) LA DILATATION. Séparable : une passe horizontale, une passe verticale.
  for (let d = 0; d < dilate; d++) {
    const src = g.slice()
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (src[y * n + x]) continue
        const gauche = src[y * n + (x - 1 + n) % n] // le monde est cyclique en X
        const droite = src[y * n + (x + 1) % n]
        const haut = y > 0 ? src[(y - 1) * n + x] : 0
        const bas = y < n - 1 ? src[(y + 1) * n + x] : 0
        if (gauche || droite || haut || bas) g[y * n + x] = 1
      }
    }
  }
  return g
}

/**
 * LE RATTRAPAGE DES ATOLLS — ce que Natural Earth 1:10m ne connaît pas.
 *
 * ⚠️ VÉRIFIÉ, PAS SUPPOSÉ : la couche `land` de Natural Earth 1:10m compte
 * 2 287 anneaux et s'arrête vers 1 km ; les Maldives et Tuvalu N'Y SONT PAS
 * (les îles mineures vivent dans un autre fichier NE, que le projet n'embarque
 * pas). Sondé sur douze points, le masque nu les rendait `false` — donc jamais
 * cuites, jamais réclamées, jamais vues manquer. C'est exactement le genre de
 * trou qu'un masque doit se faire pardonner par une contre-épreuve.
 *
 * La contre-épreuve est déjà sur le disque : `public/data/coast-z6/`, la grille
 * de terre dérivée d'OSM que `src/coast-mask.js` utilise justement pour les
 * zooms FINS. Sa règle est « le fichier existe ⇒ il y a de la terre ici ».
 *
 * On ne relit pas ses 315 Mo : on ne parcourt QUE les tuiles z6 dont le masque
 * Natural Earth ne dit rien du tout — 135 tuiles, 1,9 Mo, mesuré. Là où NE parle
 * déjà, il n'y a rien à rattraper.
 *
 * @returns {number} le nombre de tuiles z6 rattrapées (0 si la grille est absente)
 */
export function rattrapeAtolls(grille, n, dossier) {
  if (!fs.existsSync(dossier)) return 0
  let rattrapees = 0
  // ⚠️ ON ACCUMULE, PUIS ON RASTÉRISE UNE FOIS. Rastériser tuile par tuile
  // allouerait 135 grilles de 16 Mo et repasserait 135 fois la dilatation sur
  // 16 millions de cellules — deux milliards d'opérations pour 1,9 Mo de
  // géométrie. Le coût est dans la GRILLE, pas dans les polygones.
  const features = []
  for (const x of fs.readdirSync(dossier)) {
    const px = path.join(dossier, x)
    if (!Number.isFinite(+x) || !fs.statSync(px).isDirectory()) continue
    for (const f of fs.readdirSync(px)) {
      if (!f.endsWith('.json')) continue
      // Le test se fait sur le masque D'ORIGINE, avant tout ajout : sinon un
      // rattrapage rendrait les tuiles z6 voisines « déjà couvertes ».
      if (tuileAvecTerre(grille, n, 6, +x, +f.slice(0, -5))) continue
      try {
        const fc = JSON.parse(fs.readFileSync(path.join(px, f), 'utf-8'))
        if (fc.features?.length) features.push(...fc.features)
        rattrapees++
      } catch { /* une tuile illisible n'est pas une raison d'arrêter la cuisson */ }
    }
  }
  if (!features.length) return 0
  const ajout = rasteriseTerre(features, n, { dilate: 1 })
  for (let i = 0; i < grille.length; i++) if (ajout[i]) grille[i] = 1
  return rattrapees
}

/**
 * « Cette tuile XYZ peut-elle contenir de la terre ? »
 *
 * ⚠️ ON PREND LE OU LOGIQUE sur toutes les cellules que la tuile recouvre, pas
 * la cellule de son centre. Une tuile côtière dont le centre tombe en mer porte
 * quand même la moitié d'un continent ; se fier au centre la jetterait.
 *
 * @param {Uint8Array} grille - rendue par rasteriseTerre, de côté n
 * @param {number} n
 */
export function tuileAvecTerre(grille, n, z, tx, ty) {
  const f = n / 2 ** z
  if (f < 1) {
    // La grille est PLUS GROSSIÈRE que la tuile (z > log2(n)) : une tuile tient
    // dans une cellule. On lit celle qui la contient, dilatée d'un cran par le
    // masque lui-même, ce qui reste conservateur.
    const cx = Math.min(n - 1, Math.floor(tx * f))
    const cy = Math.min(n - 1, Math.floor(ty * f))
    return grille[cy * n + cx] === 1
  }
  const x0 = Math.floor(tx * f)
  const y0 = Math.floor(ty * f)
  const x1 = Math.min(n - 1, Math.ceil((tx + 1) * f) - 1)
  const y1 = Math.min(n - 1, Math.ceil((ty + 1) * f) - 1)
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) if (grille[y * n + x]) return true
  }
  return false
}

// ------------------------------------------------------------- encodage PNG
// PNG 8 bits en NIVEAUX DE GRIS (type couleur 0), dégonflé par zlib. Écrit à la
// main, comme dans build-bathy-tiles.mjs, pour ne pas traîner sharp ou canvas.
const tableCrc = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()
const crc32 = (buf) => {
  let c = -1
  for (let i = 0; i < buf.length; i++) c = tableCrc[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}
const morceau = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const corps = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(corps))
  return Buffer.concat([len, corps, crc])
}
/**
 * @param {Uint8Array} gris - w*h octets, une hauteur EN MÈTRES par pixel
 */
export function encodePngGris(gris, w, h) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8 // profondeur
  ihdr[9] = 0 // ⚠️ NIVEAUX DE GRIS : un octet par pixel, et cet octet EST la hauteur en mètres
  // ⚠️ FILTRE « None » (0) ET PAS « Up » (2), à l'inverse du tuileur
  // bathymétrique. Le filtre Up soustrait la ligne précédente : sur un fond
  // marin, deux lignes voisines se ressemblent et la soustraction rend des
  // petits nombres qui se compressent bien. Sur une carte d'occupation du sol,
  // deux lignes voisines sont IDENTIQUES par grandes plaques : sans filtre, la
  // ligne entière est une suite de valeurs répétées que deflate avale d'un
  // coup. Mesuré sur le Mont-Blanc : filtre None ~1,6× plus léger que Up.
  //
  // ⚠️ CE CHOIX VENAIT DU CUISEUR DE SOL, ET SON ARGUMENT NE VAUT PAS ICI — il
  // a donc fallu le REMESURER avant d'engager le monde. Le raisonnement des
  // « plaques identiques » est celui d'une carte de CLASSES ; une hauteur de
  // canopée est un champ continu et bruité, c'est-à-dire le cas où Up gagne
  // d'habitude (c'est la bathymétrie). Un choix inoffensif à trois zones aurait
  // pu coûter des centaines de mégaoctets sur le monde.
  //
  // Vérdict, mesuré le 2026-08-02 sur les 353 tuiles d'un sondage mondial
  // z8-z9, en réencodant les MÊMES octets avec les cinq filtres :
  //   None 100 % · Sub 100,1 % · Up 105,5 % · Avg 126,6 % · Paeth 101,7 %
  //   choix adaptatif par ligne (la méthode des vrais encodeurs) : 97,4 %
  // None reste le meilleur des filtres fixes, et l'adaptatif n'achète que 2,6 %
  // au prix d'un encodeur cinq fois plus lent. Le poids de cette couche ne vient
  // pas d'un mauvais filtre, il vient de l'entropie de la donnée elle-même.
  const raw = Buffer.alloc(h * (1 + w))
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w)] = 0
    gris.subarray(y * w, (y + 1) * w).forEach((v, i) => { raw[y * (1 + w) + 1 + i] = v })
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    morceau('IHDR', ihdr),
    morceau('IDAT', zlib.deflateSync(raw, { level: 9 })),
    morceau('IEND', Buffer.alloc(0)),
  ])
}

// ═══════════════════════════════════════════════════════════════════════════
// LE LECTEUR DE COG — juste ce qu'il faut de TIFF, et rien de plus
// ═══════════════════════════════════════════════════════════════════════════
//
// Pas de geotiff.js : on lit UN format très précis, celui que l'ETH écrit, et
// qui a été relevé au préalable — TIFF classique petit-boutien, 8 bits, une
// bande, tuiles 1024×1024, compression 5 (LZW), prédicteur 2 (différence
// horizontale), géoréférencement EPSG:4326 par ModelPixelScale + ModelTiepoint.
//
// ⚠️ CES DEUX VALEURS ÉTAIENT CELLES DU VOISIN. Il était écrit ici « compression
// 8 (deflate), prédicteur 1 (aucun) », c'est-à-dire la recette de WorldCover, que
// ce fichier décrit d'ailleurs correctement vingt lignes plus bas. Un lecteur qui
// s'y fiait cherchait un décompresseur deflate dans un fichier qui n'en a pas.
//
// Une bibliothèque généraliste apporterait ici surtout les cas qu'on n'a pas.
//
// Le lecteur VÉRIFIE ces hypothèses et se plaint bruyamment si l'ETH change de
// recette : une supposition tacite qui devient fausse en silence est bien pire
// qu'une dépendance.

const TAILLE_TYPE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 }

// ═══════════════════════════════════════════════════════════════════════════
// LE DÉCOMPRESSEUR LZW — la seule vraie différence de code avec le cuiseur du sol
// ═══════════════════════════════════════════════════════════════════════════
//
// WorldCover est en DEFLATE : `zlib.inflateSync` suffisait, et le prédicteur
// valait 1 (aucun). L'ETH est en LZW (compression 5) avec prédicteur 2
// (différence horizontale). Ni l'un ni l'autre n'est dans node.
//
// ⚠️ ET `inflateSync` NE SE TROMPE PAS DE MOITIÉ : il lève « incorrect header
// check » sur un flux LZW. C'est le seul endroit rassurant de l'affaire — un
// codec qui aurait décodé de travers en silence aurait rendu des forêts
// plausibles et fausses.
//
// TROIS DÉTAILS FONT TOUTE LA DIFFÉRENCE ENTRE « ÇA MARCHE » ET « ÇA MARCHE
// PRESQUE », et aucun ne se voit sur un petit bloc de test :
//
//   1. LE « EARLY CHANGE ». TIFF élargit le code à 10 bits quand le prochain
//      code libre atteint 511, pas 512 — un bit d'avance sur le LZW de GIF.
//      Sans lui, le décodage part en vrille au 254e code, c'est-à-dire après
//      quelques centaines d'octets : le début du bloc est PARFAIT et la suite
//      est du bruit. Sur un aperçu de forêt, ça se lit comme une donnée.
//   2. LE CAS KwKwK. Le code qu'on lit peut ne pas encore exister dans le
//      dictionnaire ; il vaut alors « la suite précédente + son premier
//      octet ». C'est rare, et ça n'arrive que sur des motifs répétés — donc
//      typiquement sur les grands aplats d'eau, jamais sur le bloc de test
//      qu'on choisit au milieu d'un massif.
//   3. LE PRÉDICTEUR 2 SE DÉFAIT PAR LIGNE DE TUILE INTERNE, pas par ligne
//      d'image. La largeur est `tuileL` (1024), y compris pour les tuiles de
//      bord qui débordent de l'image : le TIFF les stocke pleines.
//
// Le décodeur a été validé contre la vraie donnée avant d'être écrit ici :
// N45E006, blocs des niveaux 3, 5 et 6 — 1 048 576 octets rendus à chaque fois
// (exactement 1024×1024), en ~9 ms, avec des histogrammes de hauteurs
// plausibles (0 à ~45 m, plus le 255 de « pas de donnée »).
// ══════════ ⚠️ ET IL VÉRIFIE COMBIEN D'OCTETS IL A RENDUS ═══════════════════
//
// LE DÉFAUT, mesuré : la version d'avant s'arrêtait sur la fin du flux et
// rendait `subarray(0, o)` sans jamais comparer `o` à la taille attendue. Un
// flux coupé à 90 % rendait 7 397 octets au lieu de 8 192, SANS EXCEPTION.
//
// Ce qui en découlait est le vrai coût : les pixels manquants restent à 0, la
// tuile reste « parlante », elle est donc ÉCRITE — et `--reprendre`, qui ne
// teste que l'existence du fichier, ne la refera JAMAIS. À l'écran, une bande de
// forêt qui disparaît au milieu d'une tuile, indiscernable d'une clairière.
//
// Le jumeau du sol (build-occupation-sol.mjs) est protégé GRATUITEMENT par
// `zlib.inflateSync`, qui lève `Z_BUF_ERROR` sur un flux tronqué. Celui-ci
// n'était protégé par rien : c'est pour ça que le garde s'écrit ici, à la main,
// et non dans la vigilance de l'appelant.
//
// @param {Buffer} src - le flux LZW
// @param {number} attendu - le nombre EXACT d'octets que le bloc doit rendre
// @param {{strict?:boolean}} [options] - `strict:false` tolère un rendu court, et
//   n'a qu'un seul usage légitime : le test qui colle deux flux bout à bout pour
//   vérifier qu'un code de purge en cours de route ne casse pas le décodeur.
export function decompresseLzw(src, attendu, { strict = true } = {}) {
  // La marge n'est pas du luxe : une suite de dictionnaire s'écrit d'un bloc, et
  // le dernier code d'un flux abîmé peut déborder de quelques octets avant que
  // la boucle ne s'arrête. On alloue large, on tranche juste, on vérifie.
  const out = Buffer.allocUnsafe(attendu + 4096)
  let o = 0
  const pref = new Int32Array(4096)
  const suff = new Uint8Array(4096)
  const pile = Buffer.allocUnsafe(4096)
  let libre = 258
  let largeur = 9
  let bitPos = 0
  const nbits = src.length * 8
  let precedent = -1

  // Déroule une suite du dictionnaire À L'ENVERS dans `pile`, puis l'écrit à
  // l'endroit. Rend son PREMIER octet, dont l'appelant a besoin pour bâtir
  // l'entrée suivante du dictionnaire.
  const ecris = (code) => {
    let n = 0
    let c = code
    while (c >= 258) { pile[n++] = suff[c]; c = pref[c] }
    pile[n++] = c
    for (let i = n - 1; i >= 0; i--) out[o++] = pile[i]
    return c
  }

  while (bitPos + largeur <= nbits) {
    const octet = bitPos >> 3
    const decal = bitPos & 7
    const v = (src[octet] << 16) | (src[octet + 1] << 8) | (src[octet + 2] || 0)
    const code = (v >> (24 - decal - largeur)) & ((1 << largeur) - 1)
    bitPos += largeur
    if (code === 257) break // EOI
    if (code === 256) { libre = 258; largeur = 9; precedent = -1; continue } // CLEAR
    if (precedent < 0) { ecris(code); precedent = code; continue }
    if (code < libre) {
      const premier = ecris(code)
      if (libre < 4096) { pref[libre] = precedent; suff[libre] = premier; libre++ }
    } else {
      // ⚠️ LE CAS KwKwK — voir le point 2 de l'en-tête. Le code n'existe pas
      // encore : sa valeur est la suite précédente suivie de son propre premier
      // octet. Le déduire au lieu de le chercher est la seule issue.
      let c = precedent
      let n = 0
      while (c >= 258) { pile[n++] = suff[c]; c = pref[c] }
      pile[n++] = c
      for (let i = n - 1; i >= 0; i--) out[o++] = pile[i]
      out[o++] = c
      if (libre < 4096) { pref[libre] = precedent; suff[libre] = c; libre++ }
    }
    precedent = code
    // ⚠️ LE EARLY CHANGE — voir le point 1. `libre + 1`, pas `libre`.
    if (libre + 1 >= 1 << largeur && largeur < 12) largeur++
  }
  // ⚠️ LE COMPTE, ET C'EST TOUT LE GARDE. Un flux tronqué sort de la boucle
  // exactement comme un flux complet : sans ce test, la seule différence entre
  // « tuile lue » et « tuile à moitié perdue » est un nombre que personne ne
  // regardait.
  if (strict && o !== attendu) {
    throw new Error(`flux LZW tronqué ou corrompu : ${o} octets rendus, ${attendu} attendus`)
  }
  return out.subarray(0, o)
}

/**
 * Défait le prédicteur 2 (différence horizontale), en place.
 *
 * ⚠️ `largeurPx` EST LA LARGEUR DE LA TUILE INTERNE, pas celle de l'image. Se
 * tromper ne lève rien : ça décale la reconstitution d'un cran de plus à chaque
 * ligne, et rend une image qui « bave » vers la droite en s'aggravant vers le
 * bas — ce qui, sur une carte de forêts, ressemble beaucoup à une carte de
 * forêts.
 */
export function defaisPredicteur(buf, largeurPx) {
  for (let base = 0; base + largeurPx <= buf.length; base += largeurPx) {
    for (let x = 1; x < largeurPx; x++) buf[base + x] = (buf[base + x] + buf[base + x - 1]) & 255
  }
  return buf
}

// ═══════════════════════════════════════════════════════════════════════════
// LE CACHE DE BLOCS — GLOBAL ET BORNÉ, et il fallait qu'il le devienne
// ═══════════════════════════════════════════════════════════════════════════
//
// Chaque dalle rangeait ses propres blocs dégonflés, et la boucle les libérait
// entre deux zooms. Sur trois zones (quelques dalles) c'était sans conséquence.
// ⚠️ SUR LE MONDE, C'EST UN CRASH CERTAIN : un bloc de 1024² fait 1 Mo une fois
// dégonflé, l'ETH compte plus de 2 000 dalles, et un seul zoom les traverse toutes
// avant d'atteindre la ligne « libere() ». Soit 2,6 Go retenus à z8, et
// davantage à z9 où chaque dalle en demande quatre. Le processus meurt à mi-
// cuisson, sans rien dire d'autre qu'un manque de mémoire.
//
// Le cache est donc COMMUN à toutes les dalles et BORNÉ EN OCTETS, avec
// éviction du plus ancien (Map itère dans l'ordre d'insertion). L'ordre de
// parcours des tuiles étant géographique, les blocs voisins restent chauds et
// les lointains sortent d'eux-mêmes — c'est exactement ce qu'on veut.
const PLAFOND_CACHE = Math.max(64, +arg('cache-mo', 512)) * 1024 * 1024
const cacheBlocs = new Map() // `${url}:${niveau}:${index}` → { promesse, taille, pret }
let cacheOctets = 0

function rangeBloc(cle, promesse) {
  const e = { promesse, taille: 0 }
  cacheBlocs.set(cle, e)
  promesse.then((b) => {
    if (cacheBlocs.get(cle) !== e) return
    e.taille = b.length
    cacheOctets += b.length
    while (cacheOctets > PLAFOND_CACHE && cacheBlocs.size > 1) {
      const [vieux, ev] = cacheBlocs.entries().next().value
      if (vieux === cle) break // ne jamais évincer celui qu'on vient de poser
      cacheBlocs.delete(vieux)
      cacheOctets -= ev.taille
    }
  }, () => cacheBlocs.delete(cle))
}

class Dalle {
  constructor(url) {
    this.url = url
    this.ifds = null
    // Les blocs dégonflés ne vivent PLUS ici mais dans `cacheBlocs`, commun et
    // borné — voir sa section : par dalle, ils faisaient 2,6 Go à l'échelle du
    // monde.
    this.octetsLus = 0
    this.requetes = 0
  }

  async plage(a, b) {
    this.requetes++
    for (let essai = 0; essai < 4; essai++) {
      try {
        const r = await fetch(this.url, { headers: { Range: `bytes=${a}-${b}` } })
        // ⚠️ ON EXIGE 206, ET LA LONGUEUR AVEC. La clause d'avant —
        // `!r.ok && r.status !== 206` — était MORTE : 206 satisfait déjà `r.ok`,
        // donc le second terme n'était jamais atteint. Elle acceptait donc
        // exactement ce qu'elle croyait refuser : un `200 OK` d'un serveur qui
        // IGNORE l'en-tête `Range` et renvoie le fichier entier — 407 Mo poussés
        // dans un décodeur qui en attend un mega-octet.
        // ⚠️ 404/403 = LA DALLE N'EXISTE PAS, ET ÇA N'EST PAS UNE PANNE.
        // C'est une réponse DÉFINITIVE du serveur : on ne réessaie pas, et on
        // marque l'erreur pour que l'appelant la distingue d'une coupure réseau.
        // Sans cette distinction, un hôte injoignable se lisait « pleine mer ».
        if (r.status === 404 || r.status === 403) {
          const abs = new Error(`HTTP ${r.status} : dalle absente`)
          abs.absente = true
          throw abs
        }
        if (r.status !== 206) throw new Error(`HTTP ${r.status} : le serveur n'honore pas l'en-tête Range`)
        const buf = Buffer.from(await r.arrayBuffer())
        // La plage demandée est fermée des deux côtés : b - a + 1 octets, ni plus
        // ni moins. Un corps plus court est une réponse tronquée, pas une donnée.
        if (buf.length !== b - a + 1) {
          throw new Error(`plage incomplète : ${buf.length} octets reçus, ${b - a + 1} demandés`)
        }
        this.octetsLus += buf.length
        return buf
      } catch (e) {
        // Une absence avérée ne se réessaie pas : trois tentatives de plus
        // rendraient trois fois le même 404, et masqueraient le compte des
        // vraies pannes derrière du bruit.
        if (e?.absente || essai === 3) throw e
        await new Promise((res) => setTimeout(res, 400 * 2 ** essai))
      }
    }
  }

  async ouvrir() {
    if (this.ifds) return this.ifds
    // Les 64 premiers kilo-octets couvrent le nombre magique, la chaîne d'IFD et
    // leurs tableaux — voir le commentaire dans la boucle ci-dessous.
    const tete = (this.tete = await this.plage(0, 65535))
    if (tete.toString('ascii', 0, 2) !== 'II' || tete.readUInt16LE(2) !== 42) {
      throw new Error(`${this.url} n'est pas un TIFF classique petit-boutien — l'ETH a changé de recette`)
    }
    const ifds = []
    let suivant = tete.readUInt32LE(4)
    while (suivant && ifds.length < 16) {
      // ⚠️ UNE SEULE LECTURE POUR TOUTE LA TÊTE DU FICHIER, et c'est ce qui
      // décide du coût de la cuisson mondiale.
      //
      // La version d'origine lisait 200 Ko PAR APERÇU, « pour éviter un
      // aller-retour par tableau ». Sur trois zones, c'était le bon geste. Sur
      // le monde, deux choses la rendaient ruineuse : le VOLUME (7 × 200 Ko ×
      // 2 631 dalles = 3,7 Go d'en-têtes avant le premier pixel) et surtout le
      // NOMBRE DE REQUÊTES — huit allers-retours vers Francfort par dalle, à
      // ~120 ms pièce, et l'ouverture des dalles devenait le poste dominant
      // (mesuré : 1 116 requêtes pour 599 tuiles d'Europe, dont ~1 000 rien
      // qu'en ouvertures).
      //
      // Or un COG range ses en-têtes AU DÉBUT du fichier — c'est ce qui le rend
      // « cloud optimized ». Sondé sur N45E006 : les 7 IFD et TOUS leurs
      // tableaux d'offsets tiennent dans les 28 premiers kilo-octets. On lit
      // donc 64 Ko une bonne fois, et la chaîne entière se déroule en mémoire :
      // UNE requête par dalle au lieu de huit.
      //
      // La garantie n'étant pas dans la spec TIFF, le repli par plage est
      // conservé sous le nom `differes` : si l'ETH range un jour ses tableaux
      // ailleurs, ça ralentit, ça ne casse pas.
      const dansTete = (a, n) => a >= 0 && a + n <= this.tete.length
      const bloc = dansTete(suivant, 6) ? this.tete.subarray(suivant) : await this.plage(suivant, suivant + 8191)
      const base = dansTete(suivant, 6) ? 0 : suivant // décalage absolu → local
      const n = bloc.readUInt16LE(0)
      const ch = {}
      // Les tableaux qu'on ne résout QUE si on s'en sert : `offsets` (324) et
      // `octets` (325) de l'image PLEINE pèsent 1 296 entrées chacun, et on ne
      // touche jamais l'image pleine à ces zooms.
      const differes = {}
      for (let i = 0; i < n; i++) {
        const o = 2 + i * 12
        const tag = bloc.readUInt16LE(o)
        const type = bloc.readUInt16LE(o + 2)
        const cnt = bloc.readUInt32LE(o + 4)
        const taille = (TAILLE_TYPE[type] || 1) * cnt
        const lire = (b, k) =>
          type === 3 ? b.readUInt16LE(k * 2) : type === 4 ? b.readUInt32LE(k * 4) : type === 12 ? b.readDoubleLE(k * 8) : b[k]
        const decoder = (b) => {
          const vals = []
          for (let k = 0; k < cnt; k++) vals.push(lire(b, k))
          return vals
        }
        if (taille <= 4) {
          ch[tag] = decoder(bloc.subarray(o + 8))
          continue
        }
        const ptr = bloc.readUInt32LE(o + 8)
        if (base === 0 && dansTete(ptr, taille)) {
          ch[tag] = decoder(this.tete.subarray(ptr))
        } else if (ptr >= base && ptr + taille <= base + bloc.length) {
          ch[tag] = decoder(bloc.subarray(ptr - base))
        } else if (tag === 324 || tag === 325) {
          differes[tag] = { ptr, taille, decoder }
        } else {
          ch[tag] = decoder(await this.plage(ptr, ptr + taille - 1))
        }
      }
      // ⚠️ CES TROIS GARDES VALENT PLUS QUE LE CODE QU'ELLES PROTÈGENT. Le
      // lecteur ne connaît qu'UNE recette de TIFF, celle relevée sur l'ETH ; une
      // supposition tacite qui devient fausse en silence est bien pire qu'une
      // dépendance. Et les valeurs attendues ne sont PAS celles du cuiseur de
      // sol : 5 (LZW) au lieu de 8 (deflate), 2 (différence horizontale) au lieu
      // de 1 (aucun).
      if ((ch[259]?.[0] ?? 1) !== 5) throw new Error(`${this.url} : compression ${ch[259]?.[0]} inattendue (5 = LZW attendu)`)
      if ((ch[317]?.[0] ?? 1) !== 2) throw new Error(`${this.url} : prédicteur ${ch[317]?.[0]} inattendu (2 = différence horizontale attendue)`)
      if ((ch[258]?.[0] ?? 8) !== 8) throw new Error(`${this.url} : ${ch[258][0]} bits par échantillon (8 attendus)`)
      ifds.push({
        largeur: ch[256][0],
        hauteur: ch[257][0],
        tuileL: ch[322][0],
        tuileH: ch[323][0],
        offsets: ch[324] || null,
        octets: ch[325] || null,
        differes,
        // Le géoréférencement ne vit que dans l'IFD 0 ; les aperçus couvrent la
        // même emprise avec moins de pixels, on la leur recopie.
        echelle: ch[33550] || ifds[0]?.echelle,
        ancre: ch[33922] || ifds[0]?.ancre,
      })
      suivant = bloc.readUInt32LE(2 + n * 12)
    }
    // L'emprise géographique, prise sur l'image pleine et valable pour tous les
    // niveaux : ancre = [i, j, k, lon, lat, alt] du pixel (0,0), coin NORD-ouest.
    const a = ifds[0].ancre
    const e = ifds[0].echelle
    this.ouest = a[3]
    this.nord = a[4]
    this.est = a[3] + ifds[0].largeur * e[0]
    this.sud = a[4] - ifds[0].hauteur * e[1]
    this.ifds = ifds
    // ⚠️ ON LÂCHE LA TÊTE. 64 Ko retenus par dalle × 2 631 dalles = 168 Mo qui
    // ne servent plus à rien une fois les IFD décodés.
    this.tete = null
    return ifds
  }

  /**
   * Le niveau d'aperçu dont le pixel colle le mieux au pas demandé.
   *
   * ⚠️ ON PREND LE NIVEAU LE PLUS GROSSIER QUI RESTE PLUS FIN OU ÉGAL au pas de
   * sortie. `pasSource` CROÎT avec `i` (le niveau 0 est l'image pleine, les
   * suivants sont des aperçus de plus en plus gros), et la boucle retient donc
   * le DERNIER niveau dont le pixel tient encore sous `pasDeg`.
   *
   * ⚠⚠ CE COMMENTAIRE DISAIT EXACTEMENT L'INVERSE, ET C'ÉTAIT UN PIÈGE ARMÉ.
   * Il annonçait « le plus fin qui reste plus grossier ou égal », ce que le code
   * n'a jamais fait — et ce que le code NE PEUT PAS faire : à z8, aucun aperçu
   * n'atteint le pas demandé, si bien que `choisi` ne désignerait rien. Qui
   * prenait le ⚠️ au sérieux et « réparait » la comparaison en `>=` faisait
   * retomber `choisi` à 0, c'est-à-dire la lecture de l'IMAGE PLEINE 36 000² :
   * 1 296 blocs d'un méga-octet par dalle au lieu d'un seul.
   *
   * C'est le CODE qui a raison, et l'argument est le sur-échantillonnage : lire
   * un niveau plus GROSSIER que le pas de sortie étirerait un pixel source sur
   * plusieurs pixels de tuile. Un niveau plus fin, lui, ne coûte qu'un
   * échantillonnage au plus proche voisin dans un champ déjà agrégé par l'ETH à
   * la construction du COG — et comme la hauteur est un champ CONTINU, cette
   * agrégation est licite quelle qu'elle soit (relire l'en-tête : c'est là que
   * ce cuiseur diverge du sien).
   *
   * @param {number} pasDeg - la taille du pixel de sortie, en degrés
   */
  niveauPour(pasDeg) {
    const pasSource = (i) => this.ifds[0].echelle[0] * (this.ifds[0].largeur / this.ifds[i].largeur)
    let choisi = 0
    for (let i = 0; i < this.ifds.length; i++) {
      if (pasSource(i) <= pasDeg) choisi = i
      else break
    }
    return choisi
  }

  /**
   * Résout les tableaux d'offsets/longueurs différés de ce niveau — voir
   * `ouvrir()`. On ne paye ce petit aller-retour que pour le niveau d'aperçu
   * réellement échantillonné, et une seule fois par dalle.
   */
  async tableaux(niveau) {
    const ifd = this.ifds[niveau]
    if (ifd.offsets && ifd.octets) return ifd
    ifd._enCours ??= (async () => {
      for (const tag of [324, 325]) {
        const d = ifd.differes?.[tag]
        if (!d) continue
        const b = await this.plage(d.ptr, d.ptr + d.taille - 1)
        if (tag === 324) ifd.offsets = d.decoder(b)
        else ifd.octets = d.decoder(b)
      }
      return ifd
    })()
    return ifd._enCours
  }

  async bloc(niveau, index) {
    const cle = `${this.url}:${niveau}:${index}`
    // ⚠️ ON MÉMOÏSE LA PROMESSE, PAS LE RÉSULTAT. Avec plusieurs tuiles en vol
    // (voir PARALLELES), deux d'entre elles réclament le même bloc de 1024²
    // dans le même tour de boucle : mémoïser le résultat les laisserait toutes
    // deux constater l'absence, puis télécharger et dégonfler le même mégaoctet
    // en double. La promesse, elle, est posée AVANT le premier await.
    const e = cacheBlocs.get(cle)
    if (e) return e.promesse
    const p = (async () => {
      const ifd = await this.tableaux(niveau)
      const brut = await this.plage(ifd.offsets[index], ifd.offsets[index] + ifd.octets[index] - 1)
      // ⚠️ DEUX ÉTAPES, ET LA SECONDE EST FACILE À OUBLIER — voir l'en-tête du
      // décompresseur. Sans `defaisPredicteur`, chaque octet vaut la DIFFÉRENCE
      // avec son voisin de gauche : l'image rendue est un champ de bruit centré
      // sur zéro, donc une carte où la canopée n'existe presque nulle part. Pas
      // d'erreur, juste une forêt qui a disparu.
      // `brutTaille` est le nombre EXACT d'octets qu'une tuile interne doit
      // rendre. On le passe tel quel : c'est ce qui permet au decompresseur de
      // lever sur un flux tronque au lieu d'ecrire une tuile a moitie vide.
      // (Avant, on lui passait `brutTaille + 4096`, c'est-a-dire la CAPACITE du
      // tampon : il ne pouvait donc rien verifier du tout.)
      const brutTaille = ifd.tuileL * ifd.tuileH
      return defaisPredicteur(decompresseLzw(brut, brutTaille), ifd.tuileL)
    })()
    rangeBloc(cle, p)
    return p
  }

  /** Où tombe un point : quel bloc, et à quel décalage dedans. null hors emprise. */
  situe(niveau, lon, lat) {
    if (lon < this.ouest || lon >= this.est || lat <= this.sud || lat > this.nord) return null
    const ifd = this.ifds[niveau]
    const px = Math.min(ifd.largeur - 1, Math.floor(((lon - this.ouest) / (this.est - this.ouest)) * ifd.largeur))
    const py = Math.min(ifd.hauteur - 1, Math.floor(((this.nord - lat) / (this.nord - this.sud)) * ifd.hauteur))
    const cols = Math.ceil(ifd.largeur / ifd.tuileL)
    const bx = Math.floor(px / ifd.tuileL)
    const by = Math.floor(py / ifd.tuileH)
    return { index: by * cols + bx, decalage: (py - by * ifd.tuileH) * ifd.tuileL + (px - bx * ifd.tuileL) }
  }

  /**
   * La hauteur de canopée au point donné, en allant chercher le bloc s'il le faut.
   * ⚠️ PLUS PROCHE VOISIN, et c'est la seule règle de tout ce fichier.
   *
   * ⚠️ LA CUISSON NE PASSE PAS PAR ICI : voir la boucle de `cuisTuile`, qui
   * refait ce calcul à la main pour ne rien allouer sur 65 536 pixels. Cette
   * méthode reste la forme LISIBLE de la règle, et celle que les tests
   * interrogent.
   */
  async hauteurA(niveau, lon, lat) {
    const ou = this.situe(niveau, lon, lat)
    if (!ou) return null
    const b = await this.bloc(niveau, ou.index)
    return b[ou.decalage]
  }
}

// ------------------------------------------------------------------ cuisson
// Les dalles qui ont ÉCHOUÉ pour cause de PANNE, et non d'absence. Le compte
// sert à deux choses, et les deux comptent : le dire au bilan, et interdire au
// manifeste de déclarer un zoom « complet » qu'on n'a pas pu cuire entièrement.
export const echecsDalles = new Map() // nom → nombre d'échecs
const dalles = new Map() // nom → Promise<Dalle|null>
async function dallePour(lon, lat) {
  const nom = nomDalle(lon, lat)
  // ⚠️ LA PROMESSE EST RANGÉE AVANT LE PREMIER AWAIT. Sans ça, huit tuiles
  // voisines lancées en parallèle ouvrent HUIT FOIS la même dalle : huit
  // en-têtes téléchargés, huit caches de blocs indépendants, et le gain de la
  // parallélisation se retourne en surcoût réseau.
  let p = dalles.get(nom)
  if (p) return p
  p = (async () => {
    const d = new Dalle(urlDalle(nom))
    try {
      await d.ouvrir()
      return d
    } catch (e) {
      // ⚠️ UNE ABSENCE ET UNE PANNE NE SE RESSEMBLENT QUE DANS UN `catch` VIDE.
      //
      // LE DÉFAUT MESURÉ : ce bloc avalait TOUT — les 4 tentatives épuisées
      // comme le corps non-TIFF —, mémoïsait le `null` pour tout le process, et
      // `cuisTuile` le traitait comme un trou. Cuisson lancée sur un hôte
      // injoignable : « ✓ 0 tuiles écrites, 2 écartées », CODE DE SORTIE 0,
      // coche verte, et un index.json annonçant la zone complète jusqu'à z8
      // après 100 % d'échec réseau.
      //
      // ⚠️ ET LE CAS IRRATTRAPABLE EST CELUI-CI : une tuile chevauche 2 à 4
      // dalles (à z8 une tuile fait ~156 km, une dalle 3° en fait ~333 : la
      // MAJORITÉ des tuiles z8 sont à cheval). Si UNE SEULE échoue, les pixels
      // de la dalle vivante rendent la tuile « parlante », elle est écrite
      // VALIDE ET PARTIELLE — et `listeTuiles`, qui ne fait qu'un `existsSync`,
      // la saute pour toujours.
      //
      // Une absence avérée (404/403) reste donc « rien à dire » ; tout le reste
      // est une panne, et une panne doit REMONTER.
      if (e?.absente) return null
      echecsDalles.set(nom, (echecsDalles.get(nom) || 0) + 1)
      throw e
    }
  })()
  dalles.set(nom, p)
  return p
}

// Le « trou » qui remplace une dalle absente : il n'a pas de pixels, mais il a
// les MÊMES BORNES qu'elle aurait eues (3°×3°, coin sud-ouest arrondi). C'est ce
// qui permet à la boucle de pixels de le survoler d'un seul test.
const trous = new Map()
function trouPour(lon, lat) {
  const nom = nomDalle(lon, lat)
  let t = trous.get(nom)
  if (!t) {
    const sud = Math.floor(lat / 3) * 3
    const ouest = Math.floor(lon / 3) * 3
    t = { absente: true, ouest, est: ouest + 3, sud, nord: sud + 3 }
    trous.set(nom, t)
  }
  return t
}

function plageTuiles(z) {
  const [w, s, e, n] = BBOX
  return {
    x0: Math.max(0, Math.floor(lon2x(w, z))),
    x1: Math.min(2 ** z - 1, Math.ceil(lon2x(e, z)) - 1),
    y0: Math.max(0, Math.floor(lat2y(n, z))),
    y1: Math.min(2 ** z - 1, Math.ceil(lat2y(s, z)) - 1),
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// LES HAUTEURS QUI NE PEIGNENT RIEN — l'autre économie, et elle est ÉNORME ICI
// ═══════════════════════════════════════════════════════════════════════════
//
// Une tuile n'est pas utile parce qu'elle contient de la donnée : elle est utile
// parce qu'elle CHANGE QUELQUE CHOSE À L'ÉCRAN. Or `src/canopee.js` met la force
// à ZÉRO sous 2 m (CANOPEE_SOL_NU) — décision documentée là-bas : la source rend
// 1 ou 2 m sur les cultures, les buissons et le bruit de modèle, et les peindre
// couvrirait les plaines agricoles du monde d'un voile paille.
//
// ⚠️ ET LE GAIN EST BIEN PLUS GROS QUE POUR L'OCCUPATION DU SOL, parce que la
// donnée est plus creuse : là-bas seule l'eau se taisait, ici TOUT ce qui n'est
// pas boisé se tait — déserts, steppes, cultures, villes, glaciers, toundra. Une
// tuile de plaine céréalière ou de Sahara est PIXEL POUR PIXEL indiscernable
// d'une tuile absente, et ne s'écrit donc pas.
//
// ⚠️ ET ON LIT LA FORCE DEPUIS LE MODULE, ON NE LA RECOPIE PAS. Écrire
// `h < 2` ici marcherait aujourd'hui et mentirait le jour où quelqu'un
// abaisserait le plancher : les tuiles qu'il attend auraient été écartées à la
// cuisson, des mois plus tôt, sans trace. L'import fait que les deux fichiers ne
// peuvent plus diverger en silence.
//
// Table plutôt que Set : elle est interrogée 65 536 fois par tuile. Un accès
// indexé, pas un hachage.
export const MUET = (() => {
  const t = new Uint8Array(256)
  for (let h = 0; h < 256; h++) t[h] = forceCanopee(h) === 0 ? 1 : 0
  return t
})()

// Les octets qui ne sont PAS une hauteur du tout — le « pas de donnée » de la
// source (255) et tout ce qui le dépasse en absurdité. Séparé de `MUET` parce
// que les deux tables ne servent pas au même geste : `MUET` décide si la TUILE
// vaut la peine d'être écrite, `EST_ABSENT` décide si le PIXEL doit être remis à
// zéro. Un buisson de 1 m est muet mais présent ; un 255 est absent.
export const EST_ABSENT = (() => {
  const t = new Uint8Array(256)
  for (let h = 0; h < 256; h++) t[h] = h >= CANOPEE_H_ABSURDE ? 1 : 0
  return t
})()

/**
 * ⚠️ CETTE BOUCLE EST ÉCRITE POUR NE RIEN ALLOUER, et ce n'est pas de la
 * coquetterie : elle tourne 65 536 fois par tuile et 5 milliards de fois sur le
 * monde. La version lisible — `await dalle.hauteurA(niveau, lon, lat)` — coûtait
 * par pixel un objet de position, une clé de cache CONSTRUITE PAR CONCATÉNATION
 * DE CHAÎNES, et une microtâche. Mesuré sur les 599 tuiles d'Europe à z8 : 45 s
 * ainsi, 32 s en supprimant l'attente, 15 s en supprimant aussi l'objet et la
 * chaîne. Sur le monde, c'est la différence entre six heures et deux.
 *
 * Le calcul, lui, est RIGOUREUSEMENT celui de `Dalle.hauteurA` — qui reste à
 * côté comme forme lisible de la règle, et c'est elle que les tests
 * interrogent. Le seul état ajouté ici est un souvenir du dernier bloc : à z8-z9
 * une tuile de sortie tient presque toujours dans UN bloc source, donc le test
 * `idx !== idxCourant` échoue une fois par tuile, pas 65 536 fois.
 */
async function cuisTuile(z, tx, ty) {
  const gris = new Uint8Array(TUILE * TUILE) // 0 = « pas de donnée », le défaut
  // Le pas du pixel de sortie EN DEGRÉS DE LONGITUDE. On le mesure en longitude
  // et pas en latitude parce que la source est une grille lon/lat régulière :
  // en Mercator la hauteur d'un pixel varie avec la latitude, la largeur non.
  const pasDeg = 360 / 2 ** z / TUILE
  let parlante = false // au moins un pixel qui PEINT quelque chose

  // Les longitudes ne dépendent que de la colonne : on les calcule une fois
  // pour 256 pixels au lieu de 65 536 fois.
  const lons = new Float64Array(TUILE)
  for (let px = 0; px < TUILE; px++) lons[px] = x2lon(tx + (px + 0.5) / TUILE, z)

  let d = null
  let niveau = 0
  let ifd = null
  let cols = 0
  let idxCourant = -1
  let blocCourant = null

  for (let py = 0; py < TUILE; py++) {
    const lat = y2lat(ty + (py + 0.5) / TUILE, z)
    for (let px = 0; px < TUILE; px++) {
      const lon = lons[px]
      // Une tuile XYZ peut chevaucher jusqu'à quatre dalles de 3° : on
      // rebascule dès qu'on sort de l'emprise courante, sans rouvrir ce qui est
      // déjà ouvert (dallePour mémoïse, y compris les dalles ABSENTES).
      if (!d || lon < d.ouest || lon >= d.est || lat <= d.sud || lat > d.nord) {
        d = (await dallePour(lon, lat)) || trouPour(lon, lat)
        if (!d.absente) {
          niveau = d.niveauPour(pasDeg)
          ifd = d.ifds[niveau]
          cols = Math.ceil(ifd.largeur / ifd.tuileL)
        }
        idxCourant = -1
        blocCourant = null
      }
      // ⚠️ UN TROU PORTE SES BORNES, il ne se contente pas d'être `null`. Sinon
      // le test ci-dessus échoue à chaque pixel, et une tuile hors couverture
      // ETH (au-delà de 84° N, sous 60° S, ou face à une dalle absente)
      // repayait 65 536 `await` pour se faire répondre 65 536 fois « rien ici ».
      if (d.absente) continue
      const ix = Math.min(ifd.largeur - 1, Math.floor(((lon - d.ouest) / (d.est - d.ouest)) * ifd.largeur))
      const iy = Math.min(ifd.hauteur - 1, Math.floor(((d.nord - lat) / (d.nord - d.sud)) * ifd.hauteur))
      const bx = Math.floor(ix / ifd.tuileL)
      const by = Math.floor(iy / ifd.tuileH)
      const idx = by * cols + bx
      if (idx !== idxCourant) {
        blocCourant = await d.bloc(niveau, idx)
        idxCourant = idx
      }
      const c = blocCourant[(iy - by * ifd.tuileH) * ifd.tuileL + (ix - bx * ifd.tuileL)]
      // ⚠️ LE 255 DE LA SOURCE N'EST PAS UNE HAUTEUR, C'EST « PAS DE DONNÉE ».
      // Écrit tel quel, il deviendrait une forêt de 255 m — le bout le plus
      // sombre de la rampe — sur tous les océans, toutes les banquises et toutes
      // les zones que le modèle n'a pas su trancher. On le ramène à 0, qui est
      // le non-événement de toute la chaîne (force nulle dans la table, donc
      // carte strictement inchangée).
      //
      // Le seuil est `CANOPEE_H_ABSURDE` et pas `=== 255` : la source pourrait
      // un jour noter son absence autrement, et aucune valeur au-dessus de 120
      // ne peut être un arbre de toute façon. C'est le MÊME seuil que la table
      // côté client, importé plutôt que recopié.
      if (c && !EST_ABSENT[c]) {
        // ⚠️ ON ÉCRIT LA HAUTEUR MÊME QUAND ELLE EST MUETTE. Les 1 et 2 m
        // restent dans la donnée : ils servent de plancher propre au filtrage
        // linéaire du GPU. Sans eux, une lisière passerait de 0 m (fond noir du
        // canevas) à 25 m sur un texel, et le fondu doux qu'on cherche
        // deviendrait une marche. Ce n'est que la tuile ENTIÈREMENT muette
        // qu'on jette, pas ses pixels muets.
        gris[py * TUILE + px] = c
        if (!MUET[c]) parlante = true
      }
    }
  }
  return parlante ? gris : null
}

// ═══════════════════════════════════════════════════════════════════════════
// LE MANIFESTE — écrit AU FIL DE L'EAU, pas à la fin
// ═══════════════════════════════════════════════════════════════════════════
//
// Il est FUSIONNÉ, jamais réécrit : chaque zone se cuit séparément, et une
// réécriture ferait disparaître les précédentes du champ de vision du client —
// les tuiles resteraient sur le disque, INVISIBLES.
//
// ⚠️ ET IL EST ÉCRIT PENDANT LA CUISSON, PAS APRÈS. Une cuisson mondiale dure
// des heures ; l'écrire seulement à la fin voulait dire que toute interruption
// — coupure réseau, veille, Ctrl-C — laissait des dizaines de milliers de tuiles
// sur le disque SANS AUCUNE ENTRÉE AU MANIFESTE. Le client, qui ne connaît le
// monde que par ce fichier, aurait alors refusé d'allumer la couche partout, en
// affichant « la donnée n'y a pas été cuite » au-dessus de la donnée cuite. Un
// travail entier invisible, sans la moindre erreur nulle part.
//
// L'écriture est ATOMIQUE (fichier temporaire puis renommage) : tuer le
// processus pile pendant un `writeFileSync` de 2 Ko laisserait sinon un JSON
// tronqué, que le client lit en `catch` — donc zéro zone, donc la même panne.
function ecrisManifeste(nbTuiles, zmaxComplet) {
  // ⚠️ SANS `--zone`, AUCUN MANIFESTE N'EST ÉCRIT — ET IL FAUT LE DIRE.
  // Les PNG partent bien sur le disque, mais le client ne connaît le monde que
  // par ce fichier : une cuisson sans `--zone` est donc TOTALEMENT INVISIBLE.
  // `npm run build:sol` et `build:canopee` n'ont pas de `--zone`, ce qui rend le
  // piège très facile à tomber dedans.
  if (!ZONE) {
    if (!ecrisManifeste._prevenu) {
      ecrisManifeste._prevenu = true
      console.warn("  ⚠ pas de --zone : AUCUN manifeste ne sera écrit, et le client n'affichera donc RIEN de cette cuisson.")
    }
    return null
  }
  const chemin = path.join(OUT, 'index.json')
  // ⚠️ LE DOSSIER PEUT NE PAS EXISTER. Si aucune tuile n'a été écrite (tout a
  // échoué), personne n'a encore appelé `mkdirSync` : l'écriture partait en ENOENT
  // avec un message qui désignait le MANIFESTE, alors que la vraie panne est
  // ailleurs. C'est exactement le chemin « tout a raté » qui plantait, donc
  // celui où un message trompeur coûte le plus cher.
  fs.mkdirSync(OUT, { recursive: true })
  let doc = { attribution: 'ETH Global Canopy Height 2020', licence: 'CC-BY 4.0', url: 'https://langnico.github.io/globalcanopyheight/', zmin: ZMIN, zones: [] }
  try { doc = { ...doc, ...JSON.parse(fs.readFileSync(chemin, 'utf-8')) } } catch {}

  // ⚠️ ON FIXE LEUR PLAFOND AUX ZONES QUI N'EN ONT PAS, avant toute autre chose.
  //
  // `zmax` par zone est arrivé APRÈS Mont-Blanc, Landes et Paris : ces trois-là ne
  // le portent pas et vivent sur le plafond GLOBAL, que le client leur applique
  // par défaut (normaliseIndexCanopee). Or le global est désormais déduit des zones.
  // Sans cette reprise, la première zone écrite les ferait toutes retomber au
  // plafond de la nouvelle — Chamonix passerait de z14 à z9 parce qu'on a cuit
  // le monde à côté, sans qu'une seule tuile ne bouge ni qu'un test ne rougisse.
  const globalAncien = Number.isFinite(doc.zmax) ? doc.zmax : ZMAX
  for (const z of doc.zones) if (!Number.isFinite(z.zmax)) z.zmax = globalAncien

  const ancienne = doc.zones.find((z) => z.nom === ZONE)
  doc.zones = doc.zones.filter((z) => z.nom !== ZONE)
  // ⚠️ ON N'ANNONCE QU'UN ZOOM TERMINÉ, et ce n'est pas de la prudence de
  // principe — c'est ce que la première cuisson mondiale a appris.
  //
  // Le manifeste s'écrivant désormais au fil de l'eau (voir plus haut), il
  // annonçait `zmax: 9` dès la première tuile z9 écrite. Une cuisson arrêtée au
  // milieu de z9 laissait donc le client réclamer du z9 SUR TOUTE LA TERRE alors
  // qu'un tiers seulement existait : mosaïque vide sur les deux tiers restants,
  // interrupteur allumé, carte inchangée. Exactement le défaut que le plafond
  // par zone était censé fermer, réintroduit par la porte d'à côté.
  //
  // `zmaxComplet` est le plus haut zoom dont TOUTES les tuiles ont été traitées.
  // Il ne peut que MONTER : recuire une zone en z8 seul ne doit pas effacer les
  // z14 qui dorment sur le disque à côté.
  const zmax = Math.max(zmaxComplet ?? 0, ancienne?.zmax ?? 0)
  // ⚠️ UNE ZONE SANS AUCUN ZOOM TERMINÉ NE S'INSCRIT PAS AU MANIFESTE.
  //
  // La publier avec `zmax: 0` serait le pire des deux mondes : le client la
  // trouverait — donc il n'éteindrait PAS l'interrupteur, et n'afficherait pas
  // sa notice — puis irait réclamer des tuiles z0 qui n'existent pas. Carte
  // inchangée, interrupteur allumé, aucune explication. Tant qu'aucun zoom
  // n'est fini, la vérité est « rien de cuit ici », et c'est ce qu'on écrit :
  // on retire la zone. Ses tuiles restent sur le disque pour `--reprendre`.
  if (zmax < ZMIN) {
    const tmp0 = `${chemin}.tmp`
    doc.zmax = Math.max(...doc.zones.map((z) => z.zmax ?? 0), 0)
    fs.writeFileSync(tmp0, JSON.stringify(doc, null, 2))
    fs.renameSync(tmp0, chemin)
    return doc
  }
  doc.zones.push({
    nom: ZONE,
    bbox: BBOX,
    tuiles: nbTuiles,
    // ⚠️ LE PLAFOND DE ZOOM EST PAR ZONE, et c'est indispensable dès qu'une zone
    // MONDIALE existe. Le client borne sa demande à CANOPEE_ZOOM_MAX (14) ; sans
    // plafond de zone, une vue sur le Kansas — couvert seulement en z8-z9 —
    // réclamerait des tuiles z14 qui n'ont jamais été écrites, obtiendrait une
    // mosaïque vide, et laisserait l'interrupteur allumé sur rien. C'est
    // exactement le « worst of both » que main.js s'interdit ailleurs.
    zmax,
    zmin: Math.min(ZMIN, ancienne?.zmin ?? Infinity),
  })
  doc.zmin = Math.min(doc.zmin ?? ZMIN, ZMIN)
  // ⚠️ LE PLAFOND GLOBAL SE DÉDUIT DES ZONES, il ne se déclare pas. Le déduire
  // de `ZMAX` — le zoom DEMANDÉ en ligne de commande — le faisait annoncer 9
  // alors que rien de z9 n'était terminé. Il sert de valeur par défaut aux zones
  // qui n'ont pas de plafond propre (vieux manifestes) : le surestimer les fait
  // toutes mentir d'un coup.
  doc.zmax = Math.max(...doc.zones.map((z) => z.zmax ?? 0), 0)
  const tmp = `${chemin}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(doc, null, 2))
  fs.renameSync(tmp, chemin)
  return doc
}

/**
 * La liste des tuiles à cuire, dans l'ordre où on les cuira.
 *
 * ⚠️ ON LA CONSTRUIT EN ENTIER AVANT DE COMMENCER, et c'est ce qui rend
 * l'annonce de durée honnête : on sait combien de tuiles TERRESTRES restent,
 * pas combien de tuiles la bbox contient. Sur le monde entier, entre les deux, il
 * y a un facteur trois.
 */
function listeTuiles(masque, nMasque) {
  const liste = []
  // Combien de tuiles chaque zoom attend. C'est ce qui permet de dire « z8 est
  // TERMINÉ » sans se fier au curseur : avec N ouvriers en vol, le curseur a
  // dépassé la frontière d'un zoom bien avant que ses dernières tuiles soient
  // écrites. Voir `ecrisManifeste`.
  const attendus = new Map()
  let marines = 0
  let deja = 0
  for (let z = ZMIN; z <= ZMAX; z++) {
    const r = plageTuiles(z)
    for (let ty = r.y0; ty <= r.y1; ty++) {
      for (let tx = r.x0; tx <= r.x1; tx++) {
        if (masque && !tuileAvecTerre(masque, nMasque, z, tx, ty)) { marines++; continue }
        // LA REPRISE. Une tuile déjà sur le disque n'est pas recuite : c'est
        // tout le drapeau, et il n'a besoin de rien d'autre qu'un existsSync.
        //
        // ⚠️ CE QU'IL NE RATTRAPE PAS, ET POURQUOI CE N'EST PAS GRAVE : une
        // tuile ÉCARTÉE (marine, muette, hors couverture ETH) n'a laissé
        // aucun fichier, donc la reprise la réexamine. Mais l'écarter est
        // devenu presque gratuit — le masque de terre la juge sans réseau, et
        // les rares survivantes (Antarctique, grand Nord) retombent sur une
        // dalle absente déjà mémorisée. Tenir un journal des tuiles vides
        // coûterait plus cher à maintenir qu'il ne fait gagner.
        if (REPRENDRE && fs.existsSync(path.join(OUT, String(z), String(tx), `${ty}.png`))) { deja++; continue }
        liste.push([z, tx, ty])
        attendus.set(z, (attendus.get(z) || 0) + 1)
      }
    }
  }
  // Un zoom sans AUCUNE tuile à cuire est terminé par définition : ou bien tout
  // était déjà sur le disque (reprise), ou bien il n'y a rien à y mettre.
  for (let z = ZMIN; z <= ZMAX; z++) if (!attendus.has(z)) attendus.set(z, 0)
  return { liste, marines, deja, attendus }
}

async function main() {
  console.log(`\nCuiseur de hauteur de canopée — ETH Global Canopy Height 2020, z${ZMIN}..${ZMAX}, bbox ${BBOX.join(',')}`)
  let brut = 0
  for (let z = ZMIN; z <= ZMAX; z++) {
    const r = plageTuiles(z)
    brut += (r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1)
  }

  // LE MASQUE DE TERRE — voir sa section. C'est lui qui divise le coût par trois.
  let masque = null
  const nMasque = GRILLE_TERRE
  if (!SANS_MASQUE) {
    const tm = Date.now()
    const geo = JSON.parse(fs.readFileSync(FICHIER_TERRE, 'utf-8'))
    masque = rasteriseTerre(geo.features || [], nMasque, { dilate: 1 })
    const atolls = rattrapeAtolls(masque, nMasque, DOSSIER_COTE)
    let cellules = 0
    for (let i = 0; i < masque.length; i++) if (masque[i]) cellules++
    console.log(`  masque de terre : grille ${nMasque}², ${((cellules / masque.length) * 100).toFixed(1)} % de terre, en ${((Date.now() - tm) / 1000).toFixed(1)} s`)
    if (atolls) console.log(`  rattrapage atolls : ${atolls} tuile(s) z6 que Natural Earth ignore, reprises depuis coast-z6`)
    else if (!fs.existsSync(DOSSIER_COTE)) {
      // ⚠️ ON LE DIT. Sans coast-z6, les Maldives, Tuvalu et leurs semblables
      // seront ABSENTS de la cuisson, et rien ne le signalera plus tard.
      console.log(`  ⚠ ${DOSSIER_COTE} absent : les atolls que Natural Earth ignore ne seront PAS cuits`)
    }
  }

  const { liste, marines, deja, attendus } = listeTuiles(masque, nMasque)
  console.log(`  ${brut.toLocaleString('fr-FR')} tuiles dans l'emprise`)
  if (masque) console.log(`  − ${marines.toLocaleString('fr-FR')} écartées SANS RÉSEAU par le masque de terre (${((marines / brut) * 100).toFixed(0)} %)`)
  if (REPRENDRE) console.log(`  − ${deja.toLocaleString('fr-FR')} déjà sur le disque (--reprendre)`)
  console.log(`  = ${liste.length.toLocaleString('fr-FR')} tuiles à cuire`)
  if (DRY) {
    console.log("\n--dry : rien n'a été écrit.\n")
    return
  }

  // LE SONDAGE. On garde N tuiles réparties RÉGULIÈREMENT dans la liste — donc
  // sur tous les continents qu'elle traverse — plutôt que les N premières, qui
  // seraient toutes voisines et partageraient leurs dalles, leurs blocs et leur
  // cache. Le débit mesuré sur les N premières serait flatteur et faux.
  let aCuire = liste
  if (ECHANTILLON > 0) {
    const pas = Math.max(1, Math.floor(liste.length / ECHANTILLON))
    aCuire = []
    for (let i = 0; i < liste.length && aCuire.length < ECHANTILLON; i += pas) aCuire.push(liste[i])
    console.log(`  → SONDAGE : ${aCuire.length} tuiles prises tous les ${pas.toLocaleString('fr-FR')} rangs`)
  }

  let ecrites = 0
  let ecartees = 0
  let octets = 0
  let uniformes = 0 // tuiles d'une seule hauteur : la mesure qui tranche le débat
  let octetsUniformes = 0
  let curseur = 0
  const t0 = Date.now()
  let dernierManifeste = 0

  // Le total de tuiles déjà présentes, pour que le manifeste dise la COUVERTURE
  // et pas seulement ce que CE passage a écrit. Sans ça, une reprise qui écrit
  // 200 tuiles annoncerait « zone Monde : 200 tuiles » après 30 000.
  const dejaSurDisque = deja

  // Combien de tuiles chaque zoom a effectivement traitées (écrite OU écartée).
  const faits = new Map()
  /**
   * Le plus haut zoom TERMINÉ, en partant de ZMIN sans trou : un z9 complet
   * alors que z8 ne l'est pas ne vaut pas un plafond de 9, parce que le client
   * descend en z8 dès qu'il dézoome.
   */
  const zoomComplet = () => {
    // ⚠️ AUCUN ZOOM N'EST « COMPLET » S'IL RESTE UNE PANNE DE DALLE. Le compte
    // de `faits` ne mesure que les tuiles TRAITÉES, pas les tuiles réussies : une
    // dalle injoignable laisse des trous que rien d'autre ne signale, et le
    // manifeste annoncerait au client une zone entièrement cuite. Un manifeste
    // qui ment coûte plus cher qu'un manifeste en retard : les tuiles manquantes
    // ne seront jamais redemandées.
    if (echecsDalles.size) return 0
    let haut = 0
    for (let z = ZMIN; z <= ZMAX; z++) {
      if ((faits.get(z) || 0) < attendus.get(z)) break
      haut = z
    }
    return haut
  }

  let dernierComplet = 0
  const majManifeste = () => {
    dernierManifeste = Date.now()
    return ecrisManifeste(dejaSurDisque + ecrites, zoomComplet())
  }

  // Un dernier manifeste si on nous interrompt : c'est la moitié de la reprise.
  // L'autre moitié (les PNG) est déjà sur le disque, écrite tuile par tuile.
  let arrete = false
  const surSignal = () => {
    if (arrete) process.exit(130)
    arrete = true
    console.log('\n  ⏸  interruption demandée — manifeste écrit, relance avec --reprendre\n')
  }
  process.on('SIGINT', surSignal)
  process.on('SIGTERM', surSignal)

  const trace = () => {
    const s = (Date.now() - t0) / 1000
    const debit = ecrites + ecartees ? (ecrites + ecartees) / s : 0
    const restant = aCuire.length - curseur
    const eta = debit > 0 ? restant / debit : 0
    console.log(
      `  ${curseur.toLocaleString('fr-FR')}/${aCuire.length.toLocaleString('fr-FR')} · ${ecrites.toLocaleString('fr-FR')} écrites · ${ecartees.toLocaleString('fr-FR')} écartées · ` +
      `${debit.toFixed(1)}/s · ${(octets / 1024 / 1024).toFixed(1)} Mo (${(octets / Math.max(ecrites, 1) / 1024).toFixed(1)} Ko/tuile) · reste ~${(eta / 60).toFixed(0)} min`
    )
  }

  // N ouvriers qui piochent dans la même liste, un curseur partagé pour toute
  // synchronisation — c'est suffisant parce que JavaScript ne préempte pas entre
  // deux `await`. Une simple boucle `for` laisserait la machine attendre la
  // latence de Francfort ; ici, pendant qu'une tuile attend son bloc, les autres
  // calculent.
  async function ouvrier() {
    while (!arrete) {
      const i = curseur++
      if (i >= aCuire.length) return
      const [z, tx, ty] = aCuire[i]
      const gris = await cuisTuile(z, tx, ty)
      if (!gris) {
        // Pleine mer, hors couverture, ou entièrement MUETTE : rien à dire, on
        // n'écrit rien. Le chargeur traite l'absence comme un non-événement,
        // exactement comme pour la bathymétrie.
        ecartees++
      } else {
        const dir = path.join(OUT, String(z), String(tx))
        fs.mkdirSync(dir, { recursive: true })
        const png = encodePngGris(gris, TUILE, TUILE)
        // ⚠️ ÉCRITURE ATOMIQUE. La reprise croit tout fichier présent sur
        // parole ; un PNG à moitié écrit par un Ctrl-C mal placé serait alors
        // sauté pour toujours, et rendrait une tuile corrompue au navigateur.
        // Le renommage, lui, est indivisible.
        const dest = path.join(dir, `${ty}.png`)
        const tmp = `${dest}.${process.pid}.tmp`
        fs.writeFileSync(tmp, png)
        fs.renameSync(tmp, dest)
        octets += png.length
        ecrites++
        // ═══════════════════════════════════════════════════════════════════
        // LES TUILES UNIFORMES : MESURÉES, PUIS LAISSÉES EN IMAGE
        // ═══════════════════════════════════════════════════════════════════
        //
        // La question posée était : une tuile d'UNE SEULE hauteur mérite-t-elle
        // d'être rangée en CONSTANTE au manifeste plutôt qu'en image ?
        //
        // ⚠️ CE COMPTEUR PORTAIT LES CHIFFRES DU VOISIN, ET C'ÉTAIT LE PIÈGE QUE
        // L'EN-TÊTE DE CE FICHIER DÉNONCE. Il annonçait « 6 301 tuiles uniformes
        // sur 76 044, 286 Mo pour l'ensemble » : c'est la cuisson mondiale de
        // l'OCCUPATION DU SOL, recopiée ici avec le reste du bloc. La cuisson
        // mondiale de canopée, elle, a été comptée le 2026-08-02, et elle dit
        // exactement l'inverse :
        //
        //   0 tuile uniforme sur 68 317  (0 %)
        //
        // ⚠️ ZÉRO, ET C'EST LA MÊME CAUSE QUI FAIT PESER CETTE COUCHE TROIS FOIS
        // LE SOL. Une classe d'occupation forme de grandes plaques strictement
        // identiques — une tuile de Sahara est un seul code répété 65 536 fois,
        // et deflate la ramène à 369 octets. Une hauteur de canopée est un champ
        // CONTINU et bruité : même au milieu du désert, la source rend un fond
        // de 0-1 m qui bouge d'un pixel à l'autre. D'où 12,8 Ko par tuile ici
        // contre 3,9 là-bas, et 856 Mo pour le monde contre 286.
        //
        // La question de la constante est donc CLOSE, mais par l'autre bout :
        // il n'y a rien à ranger, aucune tuile ne se répète. Le chemin de code
        // client supplémentaire (« cette tuile est-elle une constante ? » avant
        // chaque chargement) n'achèterait rien du tout.
        //
        // La seule économie qui marche sur cette donnée est en amont : NE PAS
        // ÉCRIRE la tuile. Voir `MUET` — 9 544 tuiles écartées à ce titre sur
        // 77 861 (12,3 %), contre 2,3 % pour le sol. Le filtre muet est cinq
        // fois plus rentable ici EN NOMBRE ; il ne rattrape pas pour autant le
        // poids, parce que ce qui reste est incompressible.
        //
        // Le compteur reste : le jour où la palette change — donc le plancher de
        // `forceCanopee` — il redira si l'arbitrage tient encore.
        let uniforme = true
        for (let k = 1; k < gris.length; k++) if (gris[k] !== gris[0]) { uniforme = false; break }
        if (uniforme) { uniformes++; octetsUniformes += png.length }
      }
      faits.set(z, (faits.get(z) || 0) + 1)
      if ((ecrites + ecartees) % 250 === 0) trace()
      // Le manifeste toutes les 30 s : assez souvent pour qu'une coupure ne
      // coûte jamais plus d'une demi-minute de visibilité, assez rare pour ne
      // pas réécrire un JSON à chaque tuile.
      //
      // ⚠️ ET IMMÉDIATEMENT DÈS QU'UN ZOOM SE TERMINE, sans attendre le tour
      // d'horloge. C'est le seul instant où le manifeste a quelque chose de
      // NOUVEAU à dire — un plafond qui monte. Le laisser traîner 30 s de plus
      // n'économise rien et ouvre une fenêtre où une interruption perdrait un
      // zoom entier de couverture pourtant écrite sur le disque.
      const complet = zoomComplet()
      if (complet !== dernierComplet) { dernierComplet = complet; majManifeste() }
      else if (ecrites && Date.now() - dernierManifeste > 30000) majManifeste()
    }
  }

  await Promise.all(Array.from({ length: PARALLELES }, ouvrier))

  const doc = majManifeste()
  if (doc) {
    const z = doc.zones.find((x) => x.nom === ZONE)
    console.log(`  manifeste : ${doc.zones.length} zone(s), « ${ZONE} » annoncée jusqu'à z${z?.zmax} → ${path.join(OUT, 'index.json')}`)
    if (zoomComplet() < ZMAX) {
      console.log(`  ⚠ z${zoomComplet() + 1}..z${ZMAX} INCOMPLET — non annoncé au client. Relance avec --reprendre pour finir.`)
    }
  }

  const s = (Date.now() - t0) / 1000
  let req = 0
  let lus = 0
  let ouvertes = 0
  for (const p of dalles.values()) {
    // ⚠️ `catch` OBLIGATOIRE : depuis que `dallePour` fait REMONTER les pannes,
    // ces promesses peuvent être rejetées, et un `await` nu ferait planter le
    // BILAN lui-même — c'est-à-dire le seul endroit qui allait dire ce qui a
    // raté. Les dalles en panne sont comptées dans `echecsDalles`, pas ici.
    const d = await p.catch(() => null)
    if (!d) continue
    ouvertes++
    req += d.requetes
    lus += d.octetsLus
  }
  console.log(`\n✓ ${ecrites.toLocaleString('fr-FR')} tuiles écrites, ${ecartees.toLocaleString('fr-FR')} écartées en ${s.toFixed(0)} s (${((ecrites + ecartees) / s).toFixed(1)}/s)`)
  console.log(`  ${(octets / 1024 / 1024).toFixed(2)} Mo écrits, ${(octets / Math.max(ecrites, 1) / 1024).toFixed(1)} Ko par tuile`)
  if (ecrites) {
    console.log(`  dont ${uniformes.toLocaleString('fr-FR')} tuiles UNIFORMES (${((uniformes / ecrites) * 100).toFixed(0)} %), ${(octetsUniformes / 1024).toFixed(0)} Ko au total, ${(octetsUniformes / Math.max(uniformes, 1)).toFixed(0)} octets pièce`)
  }
  console.log(`  source : ${ouvertes} dalle(s) COG ouverte(s) sur ${dalles.size} sondée(s), ${req} requêtes de plage, ${(lus / 1024 / 1024).toFixed(1)} Mo lus`)
  console.log(`  → ${OUT}\n`)
  // ⚠️ LES PANNES SE DISENT, ET ELLES COÛTENT LE CODE DE SORTIE.
  //
  // Reproduit avant correction : cuisson lancée sur un hôte injoignable →
  // « ✓ 0 tuiles écrites, 2 écartées », CODE DE SORTIE 0, coche verte. Un échec
  // réseau total se lisait comme une cuisson réussie sur de la pleine mer.
  if (echecsDalles.size) {
    const total = [...echecsDalles.values()].reduce((a, b) => a + b, 0)
    console.error(`✖ ${echecsDalles.size} dalle(s) en PANNE (${total} échec(s)) — ce n'est PAS une absence de donnée.`)
    console.error(`  ${[...echecsDalles.keys()].slice(0, 8).join(', ')}${echecsDalles.size > 8 ? '…' : ''}`)
    console.error(`  Aucun zoom n'a été annoncé complet au manifeste. Relance avec --reprendre une fois le réseau rétabli.
`)
    process.exit(1)
  }
  if (arrete) process.exit(130)
}

// Importable pour les tests (nomDalle, encodePngGris, rasteriseTerre…) sans
// déclencher la cuisson : `node --test` importe le module, il ne le lance pas.
if (process.argv[1] && process.argv[1].endsWith('build-canopee.mjs')) {
  main().catch((e) => {
    console.error(`\n✖ ${e.message}\n`)
    process.exit(1)
  })
}
