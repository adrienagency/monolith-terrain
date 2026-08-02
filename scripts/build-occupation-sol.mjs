#!/usr/bin/env node
// CUISEUR D'OCCUPATION DU SOL — ESA WorldCover v200 (2021), 10 m, CC-BY 4.0,
// devient des tuiles PNG dans la grille XYZ Web Mercator, comme la bathymétrie
// et les masques d'eau avant elle.
//
//   node scripts/build-occupation-sol.mjs --bbox 6.6,45.7,7.1,46.0 --zmin 8 --zmax 13
//   node scripts/build-occupation-sol.mjs --bbox ... --dry    (compte, n'écrit rien)
//   npm run build:solmonde                                    (le socle mondial z8-z9)
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
//   (a) LIRE LE COG DEPUIS LE NAVIGATEUR. Impossible en l'état. Le seau public
//       `s3://esa-worldcover` ne porte AUCUN en-tête CORS : un OPTIONS de
//       contrôle préalable rend 403, et une requête `Range` n'est pas
//       « simple » au sens CORS — elle EXIGE ce contrôle préalable. Donc le
//       navigateur ne peut pas lire ce seau, point. (Vérifié sur les trois
//       alias : s3.eu-central-1, s3, s3-eu-central-1 : 206 en curl, zéro
//       `access-control-allow-origin`.)
//       Le miroir Microsoft Planetary Computer, lui, répond bien
//       `access-control-allow-origin: *` sur les plages — mais son adresse doit
//       être SIGNÉE, et la signature expire en ~45 minutes. On aurait donc mis,
//       au démarrage de chaque session, deux services tiers sur le chemin
//       critique d'une couche décorative, plus un analyseur TIFF embarqué.
//
//   (c) UN SERVICE DE TUILES DÉJÀ RENDUES. Le service officiel, la WMTS de
//       Terrascope (VITO), est INJOIGNABLE depuis ici : la poignée de main TLS
//       est coupée (erreur 56), en IPv4 comme en IPv6. Et quand bien même : ses
//       tuiles arrivent déjà PEINTES à la légende ESA — les onze aplats vifs
//       qu'on cherche précisément à ne pas montrer, et qu'on ne pourrait plus
//       recolorer.
//
//   (b) CUIRE. Retenu. Aucune dépendance à l'exécution, et c'est la forme que
//       le projet connaît déjà par cœur (bathy, water-tiles, lake-tiles,
//       coast-z6).
//
// ⚠️ ET CUIRE NE VEUT PAS DIRE TÉLÉCHARGER 2 631 FICHIERS. C'est ce qui rendait
// la voie (b) effrayante sur le papier. Un COG WorldCover pèse ~100 Mo ; les
// 2 631 en pèsent des dizaines de gigaoctets. Mais un COG est fait pour être lu
// PAR MORCEAUX : celui de N45E006, sondé, contient 7 images gigognes
// (36000² à 10 m, puis 18000², 9000², 4500², 2250², 1125², 562² à 640 m),
// toutes découpées en tuiles internes de 1024×1024 en deflate simple
// (compression 8, prédicteur 1). On ne lit donc que les quelques blocs de
// 1024² qui touchent la tuile de sortie — quelques dizaines de kilo-octets.
//
// ═══════════════════════════════════════════════════════════════════════════
// CE QUE LA CUISSON MONDIALE A CHANGÉ (2026-08-02)
// ═══════════════════════════════════════════════════════════════════════════
//
// Le cuiseur avait été écrit pour TROIS ZONES : Mont-Blanc, Nice, Paris, 2 025
// tuiles. Passer au monde entier ne demandait pas d'autre donnée ni d'autre
// algorithme — mais quatre choix qui ne coûtaient rien à petite échelle sont
// devenus, chacun, la différence entre « une heure » et « impossible ». Ils sont
// documentés à l'endroit où ils vivent ; les voici rassemblés, avec leurs
// mesures, parce qu'ils ne se déduisent d'aucune lecture rapide du fichier :
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
//   Débit mesuré au bout du compte : ~36 tuiles/s en zone dense, contre ~10
//   au départ. Et les tuiles écrites sont RIGOUREUSEMENT LES MÊMES : les 591
//   tuiles d'Europe ont été comparées octet pour octet à chaque étape.
//
// ⚠️ ET LA REPRISE (`--reprendre`), qui n'est pas une optimisation mais une
// condition d'existence : une cuisson de plusieurs heures SANS reprise n'est pas
// une cuisson lente, c'est une cuisson qui n'aboutit pas.
//
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ LE PIÈGE CENTRAL : ON NE MOYENNE JAMAIS UN CODE DE CLASSE
// ═══════════════════════════════════════════════════════════════════════════
//
// L'occupation du sol est CATÉGORIELLE. Entre 10 (arbres) et 80 (eau) il n'y a
// pas 45 : il n'y a RIEN. Moyenner ces codes fabrique des classes qui n'existent
// pas, et le défaut ne se voit pas en console — il se voit à l'écran, sous forme
// de zones qui prennent la couleur d'une classe qu'elles ne contiennent pas.
// C'est exactement la famille du défaut terrarium qui a coûté cher ici (on
// interpolait l'ENCODAGE de l'altitude au lieu de l'altitude, et +128 m
// sortaient là où il fallait lire −0,5 m).
//
// Le tuileur bathymétrique, lui, MOYENNE — et il a raison de le faire, la
// profondeur est un champ continu (voir son commentaire « MOYENNE SUR LA CELLULE
// DE SORTIE, pas plus proche voisin »). ⚠️ NE RECOPIEZ PAS CETTE LOGIQUE ICI.
// C'est le même geste qui répare là-bas et qui casse ici.
//
// La parade n'est pas d'écrire un vote majoritaire à la main : c'est de LAISSER
// LE COG LE FAIRE. Ses aperçus ont été fabriqués par l'ESA au plus proche
// voisin (vérifié : les 7 niveaux ne rendent QUE des codes légaux —
// 0,10,20,30,40,50,60,70,80,90,95,100 — là où une moyenne aurait semé du 37 et
// du 63 partout). On choisit donc le niveau d'aperçu dont la résolution colle à
// celle du pixel de sortie, puis on prend le plus proche voisin dedans. Zéro
// arithmétique sur les classes, à aucun moment de la chaîne.
//
// ═══════════════════════════════════════════════════════════════════════════
// CE QU'ON ÉCRIT : UN CODE, PAS UNE COULEUR
// ═══════════════════════════════════════════════════════════════════════════
//
// La tuile est un PNG en NIVEAUX DE GRIS dont chaque octet EST le code de
// classe WorldCover (10, 20, 30…). Pas la couleur finale, et c'est un choix :
//
//   · la palette reste modifiable sans recuire un seul octet — ce qui compte
//     dans un projet dont les templates vendent justement des palettes ;
//   · un canal au lieu de trois, sur une donnée par grandes plaques : ça se
//     dégonfle beaucoup mieux ;
//   · et surtout, une couleur cuite se ferait interpoler par le GPU sans que
//     rien ne paraisse cassé, en fabriquant du turquoise entre une forêt et un
//     lac. Un CODE, lui, oblige l'échantillonnage au plus proche voisin —
//     l'erreur devient impossible à commettre en silence.
//
// Attribution obligatoire, portée par src/occupation-sol.js :
//   « ESA WorldCover 2021 » — CC-BY 4.0.

import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
// ⚠️ La force des classes vient du MODULE CLIENT, elle n'est pas recopiée ici.
// Voir la table `MUET` plus bas : c'est ce qui empêche le cuiseur et l'afficheur
// de diverger en silence sur « qu'est-ce qu'une tuile utile ».
import { forceDeClasse } from '../src/occupation-sol.js'

// ------------------------------------------------------------------ options
const argv = process.argv.slice(2)
const arg = (nom, dflt = null) => {
  const i = argv.indexOf(`--${nom}`)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : dflt
}
const flag = (nom) => argv.includes(`--${nom}`)

const OUT = arg('out', 'public/data/sol')
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

// Le seau public, en lecture anonyme. eu-central-1 est la région native : passer
// par l'alias global ajoute une redirection à chaque plage, et on en fait des
// milliers.
const SEAU = 'https://esa-worldcover.s3.eu-central-1.amazonaws.com'
const PREFIXE = 'v200/2021/map'

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
const urlDalle = (nom) => `${SEAU}/${PREFIXE}/ESA_WorldCover_10m_2021_v200_${nom}_Map.tif`

// ═══════════════════════════════════════════════════════════════════════════
// LE MASQUE DE TERRE — le levier qui divise le coût par trois
// ═══════════════════════════════════════════════════════════════════════════
//
// Le carré Mercator est à ~70 % de l'océan, et WorldCover n'y a RIEN à dire :
// la classe 80 (eau) y règne partout, et sa force est à ZÉRO dans
// src/occupation-sol.js — décision documentée, pas oubli : ShibuMap dessine déjà
// l'eau en vectoriel, avec ses caustiques et sa houle. Cuire la pleine mer,
// c'est donc payer des heures de réseau pour écrire des tuiles que le nuanceur
// jettera texel par texel.
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
//      de l'ordre du kilomètre, et WorldCover, lui, voit à 10 m : sans cette
//      marge, une frange côtière — deltas, polders, cordons littoraux — sortirait
//      du masque alors qu'elle porte de la vraie donnée.
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
 * @param {Uint8Array} gris - w*h octets, un code de classe par pixel
 */
export function encodePngGris(gris, w, h) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8 // profondeur
  ihdr[9] = 0 // ⚠️ NIVEAUX DE GRIS : un octet par pixel, et cet octet EST la classe
  // ⚠️ FILTRE « None » (0) ET PAS « Up » (2), à l'inverse du tuileur
  // bathymétrique. Le filtre Up soustrait la ligne précédente : sur un fond
  // marin, deux lignes voisines se ressemblent et la soustraction rend des
  // petits nombres qui se compressent bien. Sur une carte d'occupation du sol,
  // deux lignes voisines sont IDENTIQUES par grandes plaques : sans filtre, la
  // ligne entière est une suite de valeurs répétées que deflate avale d'un
  // coup. Mesuré sur le Mont-Blanc : filtre None ~1,6× plus léger que Up.
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
// Pas de geotiff.js : on lit UN format très précis, celui que l'ESA écrit, et
// qui a été relevé au préalable — TIFF classique petit-boutien, 8 bits, une
// bande, tuiles 1024×1024, compression 8 (deflate), prédicteur 1 (aucun),
// géoréférencement EPSG:4326 par ModelPixelScale + ModelTiepoint. Une
// bibliothèque généraliste apporterait ici surtout les cas qu'on n'a pas.
//
// Le lecteur VÉRIFIE ces hypothèses et se plaint bruyamment si l'ESA change de
// recette : une supposition tacite qui devient fausse en silence est bien pire
// qu'une dépendance.

const TAILLE_TYPE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 }

// ═══════════════════════════════════════════════════════════════════════════
// LE CACHE DE BLOCS — GLOBAL ET BORNÉ, et il fallait qu'il le devienne
// ═══════════════════════════════════════════════════════════════════════════
//
// Chaque dalle rangeait ses propres blocs dégonflés, et la boucle les libérait
// entre deux zooms. Sur trois zones (quelques dalles) c'était sans conséquence.
// ⚠️ SUR LE MONDE, C'EST UN CRASH CERTAIN : un bloc de 1024² fait 1 Mo une fois
// dégonflé, WorldCover compte 2 631 dalles, et un seul zoom les traverse toutes
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
        if (!r.ok && r.status !== 206) throw new Error(`HTTP ${r.status}`)
        const buf = Buffer.from(await r.arrayBuffer())
        this.octetsLus += buf.length
        return buf
      } catch (e) {
        if (essai === 3) throw e
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
      throw new Error(`${this.url} n'est pas un TIFF classique petit-boutien — l'ESA a changé de recette`)
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
      // conservé sous le nom `differes` : si l'ESA range un jour ses tableaux
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
      if ((ch[259]?.[0] ?? 1) !== 8) throw new Error(`${this.url} : compression ${ch[259]?.[0]} inattendue (8 = deflate attendu)`)
      if ((ch[317]?.[0] ?? 1) !== 1) throw new Error(`${this.url} : prédicteur ${ch[317][0]} inattendu (1 = aucun attendu)`)
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
   * ⚠️ ON PREND LE NIVEAU LE PLUS FIN QUI RESTE PLUS GROSSIER OU ÉGAL au pas de
   * sortie — jamais l'inverse. Choisir un niveau plus FIN que la sortie
   * rendrait un échantillon unique tiré au hasard dans un champ plus détaillé :
   * c'est de l'aliasing pur, et sur des classes il n'a même pas la décence
   * d'être flou, il invente franchement des plaques (une route de 20 m dans une
   * forêt devient tout un pixel de 300 m « bâti »). Le niveau le plus proche
   * PAR EN-DESSOUS, lui, a déjà été voté par l'ESA au plus proche voisin.
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
      return zlib.inflateSync(brut)
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
   * La classe au point donné, en allant chercher le bloc s'il le faut.
   * ⚠️ PLUS PROCHE VOISIN, et c'est la seule règle de tout ce fichier.
   *
   * ⚠️ LA CUISSON NE PASSE PAS PAR ICI : voir la boucle de `cuisTuile`, qui
   * refait ce calcul à la main pour ne rien allouer sur 65 536 pixels. Cette
   * méthode reste la forme LISIBLE de la règle, et celle que les tests
   * interrogent.
   */
  async classeA(niveau, lon, lat) {
    const ou = this.situe(niveau, lon, lat)
    if (!ou) return null
    const b = await this.bloc(niveau, ou.index)
    return b[ou.decalage]
  }
}

// ------------------------------------------------------------------ cuisson
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
    } catch {
      // Pas de dalle ici = pleine mer, ou hors couverture (WorldCover s'arrête
      // à 60° S et 84° N). Ce n'est pas une erreur : c'est « rien à dire ».
      return null
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
// LES CODES QUI NE PEIGNENT RIEN — l'autre économie, et elle est grosse
// ═══════════════════════════════════════════════════════════════════════════
//
// Une tuile n'est pas utile parce qu'elle contient de la donnée : elle est utile
// parce qu'elle CHANGE QUELQUE CHOSE À L'ÉCRAN. Or `src/occupation-sol.js` met
// la force de la classe 80 (eau) à ZÉRO — décision documentée là-bas : ShibuMap
// dessine déjà l'eau en vectoriel, et repeindre par-dessus fabriquerait deux
// rivages à un pixel l'un de l'autre. Le code 0 (pas de donnée) vaut zéro lui
// aussi, par construction de la table de correspondance.
//
// Donc une tuile entièrement faite de 0 et de 80 est, PIXEL POUR PIXEL,
// indiscernable d'une tuile absente. C'est exactement le raisonnement du
// tuileur bathymétrique, qui n'écrit pas une tuile « entièrement à terre » parce
// que l'ancien relief y fait déjà l'affaire. On l'écarte de la même façon.
//
// ⚠️ ET ON LIT LA FORCE DEPUIS LE MODULE, ON NE LA RECOPIE PAS. Écrire
// `code === 80` ici marcherait aujourd'hui et mentirait le jour où quelqu'un
// relèvera la force de l'eau : les tuiles qu'il attend auraient été écartées à
// la cuisson, des mois plus tôt, sans trace. L'import fait que les deux
// fichiers ne peuvent plus diverger en silence.
// Table plutôt que Set : elle est interrogée 65 536 fois par tuile, soit cinq
// milliards de fois sur le monde. Un accès indexé, pas un hachage.
const MUET = (() => {
  const t = new Uint8Array(256)
  for (let c = 0; c < 256; c++) t[c] = forceDeClasse(c) === 0 ? 1 : 0
  return t
})()

/**
 * ⚠️ CETTE BOUCLE EST ÉCRITE POUR NE RIEN ALLOUER, et ce n'est pas de la
 * coquetterie : elle tourne 65 536 fois par tuile et 5 milliards de fois sur le
 * monde. La version lisible — `await dalle.classeA(niveau, lon, lat)` — coûtait
 * par pixel un objet de position, une clé de cache CONSTRUITE PAR CONCATÉNATION
 * DE CHAÎNES, et une microtâche. Mesuré sur les 599 tuiles d'Europe à z8 : 45 s
 * ainsi, 32 s en supprimant l'attente, 15 s en supprimant aussi l'objet et la
 * chaîne. Sur le monde, c'est la différence entre six heures et deux.
 *
 * Le calcul, lui, est RIGOUREUSEMENT celui de `Dalle.classeA` — qui reste à
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
      // WorldCover (au-delà de 84° N, sous 60° S, ou face à une dalle absente)
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
      if (c) {
        // ⚠️ ON ÉCRIT LE CODE MÊME QUAND IL EST MUET. L'eau reste dans la
        // donnée — elle sert de trou propre entre deux classes qui, elles,
        // peignent (voir l'en-tête de src/occupation-sol.js). Ce n'est que la
        // tuile ENTIÈREMENT muette qu'on jette, pas ses pixels muets.
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
  if (!ZONE) return null
  const chemin = path.join(OUT, 'index.json')
  let doc = { attribution: 'ESA WorldCover 2021', licence: 'CC-BY 4.0', url: 'https://esa-worldcover.org', zmin: ZMIN, zones: [] }
  try { doc = { ...doc, ...JSON.parse(fs.readFileSync(chemin, 'utf-8')) } } catch {}

  // ⚠️ ON FIXE LEUR PLAFOND AUX ZONES QUI N'EN ONT PAS, avant toute autre chose.
  //
  // `zmax` par zone est arrivé APRÈS Mont-Blanc, Nice et Paris : ces trois-là ne
  // le portent pas et vivent sur le plafond GLOBAL, que le client leur applique
  // par défaut (normaliseIndexSol). Or le global est désormais déduit des zones.
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
    // MONDIALE existe. Le client borne sa demande à SOL_ZOOM_MAX (14) ; sans
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
        // tuile ÉCARTÉE (marine, muette, hors couverture WorldCover) n'a laissé
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
  console.log(`\nCuiseur d'occupation du sol — ESA WorldCover 2021, z${ZMIN}..${ZMAX}, bbox ${BBOX.join(',')}`)
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
  let uniformes = 0 // tuiles d'une seule classe : la mesure qui tranche le débat
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
        // La question posée était : une tuile d'UNE SEULE classe mérite-t-elle
        // d'être rangée en CONSTANTE au manifeste plutôt qu'en image ? On ne l'a
        // pas tranchée au jugé, on l'a comptée sur la cuisson mondiale :
        //
        //   6 301 tuiles uniformes sur 76 044  (8 %)
        //   2 271 Ko à elles toutes, soit 369 OCTETS pièce
        //   contre 286 Mo pour l'ensemble  →  0,8 % du poids total
        //
        // ⚠️ LA COMPRESSION A DÉJÀ FAIT LE TRAVAIL, et mieux qu'une constante ne
        // le ferait. 65 536 octets identiques, filtre None, deflate 9 : il en
        // reste 369, dont l'essentiel est l'en-tête PNG lui-même. Le gain d'une
        // constante serait de 2,2 Mo — sur 286 — au prix d'un chemin de code
        // client supplémentaire (« cette tuile est-elle une constante ? » avant
        // chaque chargement) et d'un manifeste qui passerait de 2 Ko à plusieurs
        // centaines. On ne l'a donc PAS fait.
        //
        // C'est bien l'économie du tuileur bathymétrique qui s'applique ici,
        // mais à l'autre bout de la chaîne : ce qui vaut le coup, ce n'est pas
        // de mieux ranger une tuile qui ne dit rien, c'est de NE PAS L'ÉCRIRE.
        // Voir `MUET` — 1 816 tuiles écartées à ce titre sur cette cuisson.
        //
        // Le compteur reste : le jour où la palette change, il redira si
        // l'arbitrage tient encore.
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
    const d = await p
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
  if (arrete) process.exit(130)
}

// Importable pour les tests (nomDalle, encodePngGris, rasteriseTerre…) sans
// déclencher la cuisson : `node --test` importe le module, il ne le lance pas.
if (process.argv[1] && process.argv[1].endsWith('build-occupation-sol.mjs')) {
  main().catch((e) => {
    console.error(`\n✖ ${e.message}\n`)
    process.exit(1)
  })
}
