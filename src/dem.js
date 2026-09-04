// Altitude réelle par tuiles terrarium — meters = (R*256 + G + B/256) − 32768.
//
// La source par défaut est MAPTERHORN (512 px/tuile, jeux nationaux agrégés :
// IGN RGE ALTI, swissALTI3D, …), avec le bucket AWS elevation-tiles-prod
// (256 px) en repli. Le choix, la couverture et la bascule vivent dans
// dem-source.js — ici on ne fait que peindre le damier et décoder.
//
// Attribution : « © Mapterhorn » + https://mapterhorn.com/attribution dès que
// la source active est Mapterhorn (crédits ET exports).

// ⚠️ PLUS de `smoothSeaFloor` ici : la branche de mémorisation partait d'un
// main qui l'appelait encore (elle mesurait ses 73 ms), mais le correctif
// Catmull-Rom l'a depuis SORTI du chemin de loadDem — il ne servait plus à
// rien une fois l'agrandissement corrigé, et coûtait 84 ms par bloc. Il reste
// exporté et testé pour une future source côtière (voir le corps du fichier).
import {
  bandeBruitAdmise,
  decodeTerrarium,
  fuseBathymetry,
  lisseAbysse,
  overzoomTile,
  resampleCatmullRom,
  resolutionBathyM,
} from './bathy.js'
import { normalizeIndex, tileMaxZoom, zoneAt } from './bathy-sources.js'
import { vetoTerre, merFranche } from './coast-veto.js'
import { demMemoCle, demMemoLire, demMemoEcrire, demMemoVider } from './dem-memo.js'
import { quantizeElevation, quantizeElevations } from './dem-quant.js'
import {
  DEM_SOURCES,
  DemSourceError,
  activeDemSource,
  demTilePx,
  fallbackToAws,
  peekRegionMaxZoom,
  regionKey,
  resolveRegionMaxZoom,
} from './dem-source.js'
// LA MÉMOIRE DES TUILES DE MNT, PARTAGÉE AVEC LE GLOBE — Tâche R3 (I3).
// Module PUR : il ne connaît ni `three` ni le DOM, et le chargement lui est
// passé en paramètre. C'est ce qui permet à ce fichier de l'importer sans tirer
// `globe.js` — lequel importerait `three`, que les tests node de `dem.js` n'ont pas.
import { tuileMemorisee, viderMemoTuiles } from './monde/memo-tuiles-mnt.js'

export { demTilePx }

// BATHYMÉTRIE FINE — nos propres tuiles, au MÊME encodage terrarium, servies
// depuis le site. Le jeu s'arrête au plafond de la zone (voir juste en dessous) :
// au-delà, on relit l'ancêtre (voir overzoomTile). Absent ⇒ tout continue
// exactement comme avant, ce qui permet de déployer le code avant les données.
const BATHY_URL = (z, x, y) => `data/bathy/${z}/${x}/${y}.png`

// PLAFOND PAR ZONE — depuis le 2026-07-28, le jeu ne s'arrête plus au même
// niveau partout. Là où une source régionale plus fine que GEBCO a été cuite
// (EMODnet à 115 m sur la France, pour commencer), on peut descendre plus bas ;
// ailleurs on reste à z8, qui est la résolution native de GEBCO.
//
// La règle d'Adrien, mot pour mot : « à chaque fois qu'on a une map mieux
// définie, on l'utilise, à défaut on laisse la map GEBCO en soutien ».
//
// ⚠️ L'INDEX EST FACULTATIF, et c'est la propriété qui compte : absent, illisible
// ou 404, `normalizeIndex(null)` rend z8 partout — exactement le comportement
// d'avant. On peut donc déployer ce code sans les données, et les données sans
// redéployer le code. La promesse est mémorisée : un seul aller-retour réseau
// pour toute la session, et un échec ne se retente pas en boucle.
let _bathyIndex = null
// L'index déjà résolu, ou null s'il n'est pas encore arrivé. Sert à l'export,
// qui doit nommer les sources ayant creusé l'emprise et ne peut pas attendre.
let _bathyIndexResolu = null
export const bathySourceIndex = () => _bathyIndexResolu
const bathyIndex = () => {
  if (!_bathyIndex) {
    _bathyIndex = fetch('data/bathy/index.json')
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then(normalizeIndex)
      .then((idx) => { _bathyIndexResolu = idx; return idx })
  }
  return _bathyIndex
}
// PLANCHER DU JEU — le niveau le plus grossier, cuit INTÉGRALEMENT (256 tuiles
// pour le monde entier). C'est lui qui garantit qu'une tuile fine manquante
// trouve toujours un ancêtre à lire.
//
// Sans ce repli, une tuile absente laissait sa case à PLAT au niveau zéro,
// juste à côté d'une case voisine qui, elle, portait la vraie profondeur : la
// mer se couvrait de RECTANGLES nets de la taille d'une tuile (captures Adrien
// sur l'Atlantique et l'Australie). La couverture cuite est partielle par
// construction — 0 % à z4, 50 % à z5, 21 % à z8 — parce que le pré-tri de la
// cuisson saute les tuiles « sans intérêt ». C'est le REPLI qui manquait, pas
// les tuiles.
//
// 🔴 POURQUOI 7 ET PLUS 4. Un repli trop profond ÉCRASE DE LA DONNÉE MEILLEURE
// QUE LUI. `fuseBathymetry` fait qu'au-delà de 25 m de fond la sortie vaut
// EXACTEMENT la source fine (le fondu sature, `out = s`) : un ancêtre grossier
// remplace donc purement et simplement le terrarium. Or les tuiles terrarium
// d'AWS portent de l'ETOPO1 à 1 852 m, tandis que nos niveaux de repli valent,
// à 35,5°N : z7 = 996 m, z6 = 1 992 m, z5 = 3 984 m, z4 = 7 968 m.
//
// Recensement mondial (rapport du 2026-07-28) : 13 891 tuiles z8 présentes,
// 8 946 coutures avec une voisine absente, dont 2 758 retombent à z6 ou pire —
// et sur 796 d'entre elles le repli à z4/z5 DÉGRADE ACTIVEMENT l'ETOPO1 déjà là.
// On abîmait la carte au nom de l'améliorer.
//
// z7 (996 m) reste deux fois meilleur qu'ETOPO1 : c'est le dernier niveau qui
// mérite encore d'écraser le socle. En dessous, ne rien peindre est le bon
// choix — le pixel garde le terrarium, qui est plus fin.
//
// ⚠️ CE PLANCHER NE VAUT QUE POUR LE SURZOOM. `modes.js` charge des blocs
// CONTINENTAUX à z4 et z5 : là, une tuile bathy z4 est la résolution NATIVE de
// l'affichage, pas un repli dégradé, et l'interdire supprimerait la
// bathymétrie de toutes les vues d'ensemble. Le plancher effectif est donc
// `min(BATHY_ZMIN, zoom)` : on ne descend jamais SOUS le zoom demandé.
//
// 🔴 B3 — LE PLANCHER RESTE 7, ET IL A DÉSORMAIS UNE EXCEPTION NOMMÉE.
//
// J'ai d'abord descendu cette constante à 6, et c'était FAUX : cinq tests le
// disent, dont `dem-load.test.js:251` qui encode exactement l'arbitrage
// ci-dessus. Le raisonnement « z6 vaut 1 992 m contre 1 852 m d'ETOPO1, donc
// c'est le même ordre » oublie que le repli s'applique AUSSI là où l'ETOPO1 est
// bon, et le recensement des 796 coutures parle de ce cas-là.
//
// Ce que le plancher protège, c'est **l'ETOPO1 du terrarium**. Or au-delà de
// z10 il n'y a plus d'ETOPO1 à protéger : le terrarium rend **0,000 m pile** sur
// tout le champ immergé (B1, mesuré au GPU à z11 et z12, étendue 9×9 = 0,00 m).
// Là, refuser le repli grossier ne préserve rien — ça interdit la seule donnée
// disponible. Et ce n'est pas un cas de bord : le tuileur n'écrit QUE la frange
// côtière (`SHELF = −500`, scripts/build-bathy-tiles.mjs), donc au large la
// cascade s'arrête souvent bien au-dessus de z7. Mesuré sur disque à
// 35,5°N / 19°E (Méditerranée, plaine ionienne) : z8 ABSENTE, z7 ABSENTE,
// **z6 présente, −3 688 m**. Avec le plancher à 7 et rien d'autre, les DEUX
// chemins rendaient **0 m** — le défaut que B1 laisse ouvert à son §⑨.
//
// L'exception est donc conditionnée, pas globale : `plancher: index.zmin` n'est
// forcé QUE sur une emprise où le terrarium est muet en mer, et seulement après
// que la descente normale a échoué. Voir `terrariumMuetEnMer` (ici et dans
// `src/globe.js`).
const BATHY_ZMIN = 7
// ⚠️ NOS tuiles bathy font 256 px, quelle que soit la taille des tuiles
// d'altitude. La sous-fenêtre SOURCE se mesure donc en pixels de tuile bathy,
// le rectangle DESTINATION en pixels de tuile d'altitude — les confondre,
// depuis le passage au 512, ne lisait plus qu'un quart de la tuile.
const BATHY_TILE_PX = 256
// une tuile manquante est le cas NORMAL (on n'écrit pas les tuiles sans mer) :
// on mémorise les absences pour ne pas les redemander à chaque déplacement
const bathyMisses = new Set()

// ─────────────────────────── NE PAS REDEMANDER CE QU'ON A DÉJÀ ───────────────
//
// Mesuré sur le damier du Var à z12 (campagne de référence, cf.
// docs/superpowers/plans/2026-07-27-damier-optimisation.md) : 6 405 requêtes
// pour 260 URL uniques, dont UNE SEULE tuile bathy demandée 2 070 fois. Deux
// mémoires, et elles n'ont pas la même durée de vie — parce que la contrainte
// qui prime n'est pas la vitesse mais le tas JS, mesuré à 1,76 Go sur un damier
// plein.
//
// · LES TUILES D'ALTITUDE ne se retiennent QUE LE TEMPS DU VOL. Elles se
//   partagent peu entre dalles — le damier aligne des grilles de tuiles
//   disjointes — SAUF EN SURZOOM : au-delà du maxZoom de la source, deux dalles
//   voisines remontent au même ancêtre, donc à la même URL (overzoomTile).
//   C'est sans danger, et même profitable : la mémoire en vol dédoublonne ce
//   partage-là comme le reste. La redondance qui coûtait, elle, était
//   temporelle — la même dalle relancée avant que sa première demande ne soit
//   revenue. Les garder APRÈS coup serait un cache d'images de 1 Mo pièce, pour
//   un partage marginal et sur un tas déjà à 1,76 Go.
// · LES TUILES BATHY, elles, se partagent MASSIVEMENT : nos tuiles s'arrêtent à
//   z8, donc les 9 cases d'un MNT z12 lisent le MÊME ancêtre, et les 25 dalles
//   du damier aussi. Une poignée de fichiers de 256² : les mémoriser coûte
//   quelques centaines de Ko et supprime des milliers de requêtes.
// ⛔ **CE PARAGRAPHE A ÉTÉ DÉMENTI PAR LA MESURE — Tâche R3, correction I3.**
// « Les garder APRÈS coup serait un cache d'images de 1 Mo pièce, pour un partage
// marginal » : le partage n'est marginal qu'ENTRE DALLES DU DAMIER. Il ne l'est
// pas du tout avec **la file du globe**, qui redemande exactement les mêmes neuf
// tuiles z12 du bloc, même URL, à ~1,7 s d'écart — **2,705 Mo par chargement**,
// mesurés sur 9 tirages sous `?terre=unique`.
//
// ⚠️ **ET LA RÉPONSE N'EST PAS UN CACHE DE PLUS, C'EST UN CACHE DE MOINS.** La
// mémoire en vol de ce fichier disparaît au profit de celle du globe, déménagée
// dans un module PUR : même borne (32 Mo), même LRU, un seul propriétaire. Le
// budget total ne bouge pas d'un octet ; ce sont les requêtes qui disparaissent.
// Voir `monde/memo-tuiles-mnt.js` pour ce qui n'est délibérément PAS mémorisé
// (les `null` de 404 : les deux appelants ne les traduisent pas pareil).

// LRU des GRILLES bathy décodées. 32 entrées de 256²·4 o = 8 Mo au pire absolu ;
// en pratique un damier n'en touche qu'une poignée.
//
// ⚠️ ON MÉMORISE LA GRILLE EN MÈTRES, PLUS L'IMAGE. C'est le pivot du correctif
// « fond marin lisse » : tant qu'on gardait un ImageBitmap, le seul moyen de
// l'agrandir était `drawImage`, donc du BILINÉAIRE — dont la pente casse à
// chaque bord de cellule et dessine la grille de carrés de 464 m. Une fois la
// tuile décodée en Float32, l'agrandissement devient de l'arithmétique, et on
// peut la faire en Catmull-Rom (src/bathy.js). Bonus : les 9 cases d'un damier
// qui partagent le même ancêtre ne le décodent plus qu'UNE fois.
const BATHY_MEMO_MAX = 32
const bathyHits = new Map() // url → Promise<{w, h, m: Float32Array}>

// Décode une tuile bathy À SA RÉSOLUTION NATIVE, sans la moindre mise à
// l'échelle : le drawImage est ici strictement 1:1, il n'interpole rien.
function grilleBathy(img) {
  const w = img.width || BATHY_TILE_PX
  const h = img.height || BATHY_TILE_PX
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(img, 0, 0)
  return { w, h, m: decodeTerrarium(ctx.getImageData(0, 0, w, h).data) }
}

// 🟣 LISS — LE LISSAGE DE L'ABYSSE EST POSÉ ICI, ET C'EST TOUT LE CÂBLAGE.
//
// ⚠️ **ICI, ET NULLE PART AILLEURS.** Les TROIS sites de fusion (`loadDem`
// ci-dessous, `globe.js:fondMarinTuile`, `monde/flux-terrain.js`) passent tous
// par `peindreBathyTuile`, donc par `loadBathyTile`. PLAT, VETO et B6 ont dû
// câbler les trois à la main ; ici il n'y a qu'un point de pose, parce qu'on
// agit sur la DONNÉE SOURCE et non sur le résultat de la fusion.
//
// ⚡ ET C'EST GRATUIT, parce que c'est mémoïsé. La tuile est lissée UNE FOIS au
// décodage, puis servie 2 070 fois (le chiffre de l'encart de
// `peindreBathyTuile`). Le lissage au site de fusion aurait coûté 84 ms PAR
// BLOC — c'est le chiffre pour lequel `smoothSeaFloor` a été retiré de `loadDem`
// (voir l'encart correspondant plus bas).
//
// ⚠️ LA MAILLE SE LIT SUR LA TUILE, PAS SUR LE BLOC. C'est `z/x/y` de la tuile
// SOURCE qui donne la maille au sol, et c'est elle qui décide si le rayon vaut
// 5 px (z8), 1 px (z6) ou 0 px (z4, la règle s'éteint). Voir l'encart 🟣 LISS
// de src/bathy.js.
const y2latBathy = (y, z) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** z))) * 180) / Math.PI

function loadBathyTile(url, z, x, y) {
  const memo = bathyHits.get(url)
  if (memo) {
    bathyHits.delete(url)
    bathyHits.set(url, memo) // ré-insertion = most-recently-used
    return memo
  }
  const p = (async () => {
    const r = await fetch(url)
    if (!r.ok) throw new Error('miss')
    const g = grilleBathy(await createImageBitmap(await r.blob()))
    // ⚠️ `mailleM` NON FINIE (appelant qui ne passe pas z/x/y) ⇒ rayon 0 ⇒
    // `lisseAbysse` rend la grille AU BIT. Le lissage ne s'invite jamais.
    if (g.w === g.h && Number.isFinite(z)) {
      lisseAbysse(g.m, g.w, { mailleM: resolutionBathyM(z, y2latBathy(y + 0.5, z)) * (BATHY_TILE_PX / g.w) })
    }
    return g
  })()
  bathyHits.set(url, p)
  // une absence n'a rien à faire ici : c'est bathyMisses qui la retient
  p.then(null, () => {
    if (bathyHits.get(url) === p) bathyHits.delete(url)
  })
  while (bathyHits.size > BATHY_MEMO_MAX) bathyHits.delete(bathyHits.keys().next().value)
  return p
}

// ══════════ LA LOI DE SÉLECTION BATHY, EXTRAITE — Tâche 6 sexies ════════════
//
// ⚠️ **ELLE EST EXTRAITE, PAS RECOPIÉE, ET C'EST LE §1 DE `/threejs-optimisation`
// AU PIED DE LA LETTRE.** `src/monde/flux-terrain.js` doit peindre la même
// bathymétrie que `loadDem`, sur une emprise qui n'est pas un damier de blocs.
// Écrire là-bas une seconde descente « de la tuile la plus fine vers le
// plancher » ferait DEUX lois à faire coïncider — le plafond par zone, le
// plancher `min(BATHY_ZMIN, zoom)`, la mémoire des absences, la sous-fenêtre de
// surzoom mesurée en pixels BATHY et non en pixels d'altitude. Chacune de ces
// quatre subtilités a déjà coûté un défaut visible à l'écran (voir les encarts
// ci-dessus). Il n'y en a donc qu'une, et `loadBathyPatch` l'appelle aussi.
//
// ⚠️ **`index` EST PASSÉ, PAS RELU** : `loadBathyPatch` fait UN aller-retour
// pour tout son damier, et l'appelant du flux fait le sien. Le relire ici, une
// fois par case, rendrait la même promesse mémorisée — mais transformerait une
// fonction synchrone-après-index en une fonction qui `await` toujours.
//
// @returns {Promise<number>} le zoom de la tuile réellement peinte, ou -1
export async function peindreBathyTuile({ zoom, tx, ty, index, dst, dstStride, dx, dy, dw, dh, plancher: forcePlancher }) {
  // ⚠️ `plancher` FORCÉ : le SEUL appelant qui s'en sert est `fondMarinTuile`
  // (src/globe.js), et seulement après avoir constaté que le terrarium est MUET
  // en mer sur cette dalle. `BATHY_ZMIN` protège de l'écrasement de l'ETOPO1 ;
  // quand il n'y a pas d'ETOPO1 à protéger, il n'interdit plus qu'une chose :
  // la seule donnée disponible. Voir l'encart de `fondMarinTuile`.
  const plancher = Math.min(Number.isFinite(forcePlancher) ? forcePlancher : BATHY_ZMIN, zoom)
  // Le plafond se lit AU CENTRE DE CETTE TUILE, pas au centre du bloc : une
  // emprise peut chevaucher la limite d'une source fine, et chaque case doit
  // alors chercher au niveau qui la concerne.
  for (let zt = Math.min(zoom, tileMaxZoom(index, zoom, tx, ty)); zt >= plancher; zt--) {
    const t = overzoomTile(zoom, tx, ty, zt)
    const url = BATHY_URL(t.z, t.x, t.y)
    if (bathyMisses.has(url)) continue
    try {
      // TROUVÉE ⇒ MÉMORISÉE (`loadBathyTile`). Les 9 cases d'un damier lisent le
      // même ancêtre z8, et les 25 dalles du damier de blocs aussi : sans cette
      // mémoire, une seule tuile partait 2 070 fois.
      const g = await loadBathyTile(url, t.z, t.x, t.y)
      // surzoom : on n'agrandit qu'une SOUS-FENÊTRE de l'ancêtre — elle se
      // mesure sur la tuile BATHY (256 px), la case de destination sur la tuile
      // d'altitude (256 ou 512 px). La sous-fenêtre borne ce qu'on AGRANDIT, pas
      // ce qu'on LIT : les voisins hors fenêtre restent de la vraie donnée, donc
      // deux cases servies par le même ancêtre se raccordent sans couture.
      resampleCatmullRom({
        src: g.m, srcW: g.w, srcH: g.h,
        sx: t.ox * g.w, sy: t.oy * g.h, sw: g.w / t.scale, sh: g.h / t.scale,
        dst, dstStride, dx, dy, dw, dh,
      })
      return t.z
    } catch {
      bathyMisses.add(url)
    }
  }
  return -1
}

/**
 * L'index des sources bathymétriques, mémorisé — UN aller-retour par session.
 * ⚠️ **EXPORTÉ POUR LE FLUX** (`peindreBathyTuile` le prend en paramètre).
 */
export const indexBathy = bathyIndex

/** Remise à zéro des mémoires de tuiles — tests uniquement. */
export function _resetTileCaches() {
  viderMemoTuiles()
  bathyHits.clear()
  bathyMisses.clear()
  demMemoVider()
}

// Zoom max réellement servi pour la dernière zone chargée — l'UI s'en sert pour
// dire « zoom maximum atteint ». null tant qu'aucun DEM n'a été chargé.
let lastMaxZoom = null
export const getDemMaxZoom = () => lastMaxZoom

// `originTile` (optionnel) : origine-tuile EXPLICITE {x, y} du coin haut-gauche
// — le damier (block-grid.js) charge les blocs voisins alignés sur la grille de
// tuiles du bloc central (originTileX ± tilesAcross) : zéro couture entre blocs.
//
// `memo` : mémorise le bloc FINI (fusionné, lissé, statistiques faites) pour le
// retour de zoom — 145 ms de fil principal figé et 20 ms de réseau rendus, voir
// dem-memo.js. C'est une DEMANDE et non le défaut : le damier tient sa propre
// mémoire de MNT voisins, l'y faire entrer doublerait la facture et chasserait
// le bloc central à chaque extension.
export async function loadDem({ lat, lon, zoom, tilesAcross = 3, originTile = null, bathy = true, memo = false }) {
  const n = 2 ** zoom
  const half = Math.floor(tilesAcross / 2)
  let cx, cy
  if (originTile) {
    cx = originTile.x + half
    cy = originTile.y + half
    // lat/lon deviennent le CENTRE réel de cette grille de tuiles (métadonnée
    // + metersPerPixel cohérents avec le géoréférencement)
    const cxF = cx + 0.5, cyF = cy + 0.5
    lon = (cxF / n) * 360 - 180
    lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * cyF) / n))) * 180) / Math.PI
  } else {
    const latRad0 = (lat * Math.PI) / 180
    cx = Math.floor(((lon + 180) / 360) * n)
    cy = Math.floor(((1 - Math.log(Math.tan(latRad0) + 1 / Math.cos(latRad0)) / Math.PI) / 2) * n)
  }
  const latRad = (lat * Math.PI) / 180

  // --- quelle source, et jusqu'à quel zoom voit-elle ICI ? -------------------
  // Trois issues, et elles ne se valent pas :
  //   un zoom  → on y va, en surzoomant au-delà (overzoomTile)
  //   null     → zone hors couverture (pleine mer) → AWS POUR CE CHARGEMENT,
  //              sans toucher au choix de session : le bloc d'à côté, sur la
  //              terre ferme, doit continuer à profiter de Mapterhorn
  //   panne    → repli AWS pour TOUTE la session (dem-source.js)
  let source = activeDemSource()
  let maxZoom
  try {
    maxZoom = await resolveRegionMaxZoom(source, zoom, cx, cy)
  } catch (err) {
    source = fallbackToAws(err)
    maxZoom = source.maxZoom
  }
  if (maxZoom == null) {
    source = DEM_SOURCES.aws
    maxZoom = source.maxZoom
  }
  lastMaxZoom = maxZoom

  const TILE_PX = source.tilePx
  // MÉMOIRE DU BLOC — la clé se ferme ICI et pas plus tôt : `maxZoom` en fait
  // partie (il décide du surzoom) et il vient d'être résolu. Le sondage de
  // couverture, lui, est déjà mémorisé par dem-source.js : sur un retour de
  // zoom l'await ci-dessus ne coûte rien.
  const cleMemo = memo
    ? demMemoCle({
        source: source.id, zoom, maxZoom, ox: cx - half, oy: cy - half,
        tilesAcross, tilePx: TILE_PX, lat, lon, bathy: bathy !== false,
      })
    : null
  if (cleMemo) {
    const dejaVu = demMemoLire(cleMemo)
    if (dejaVu) return dejaVu
  }
  const sizePx = tilesAcross * TILE_PX
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = sizePx
  const ctx = canvas.getContext('2d', { willReadFrequently: true })

  // ⚠️ UNE TUILE EN ÉCHEC NE DOIT PLUS EMPORTER TOUT LE BLOC. Avant, le moindre
  // `throw` sur un coin du damier faisait échouer le Promise.all et la carte
  // entière restait vide — alors qu'un trou de couverture est le cas NORMAL au
  // bord d'un jeu national. Une tuile absente peint du vide (alpha 0, décodé
  // comme ABSENCE de mesure plus bas) et le reste du bloc vit sa vie.
  let painted = 0
  let hardFail = null
  const jobs = []
  // on retient l'emplacement de chaque dalle : la réparation par tuile (plus
  // bas) doit pouvoir la redemander à l'autre source et la repeindre au bon endroit
  const slots = []
  for (let dy = -half; dy <= half; dy++) {
    for (let dx = -half; dx <= half; dx++) {
      const tx = (cx + dx + n) % n
      const ty = cy + dy
      if (ty < 0 || ty >= n) continue
      const t = overzoomTile(zoom, tx, ty, maxZoom)
      const ox = (dx + half) * TILE_PX
      const oy = (dy + half) * TILE_PX
      slots.push({ tx, ty, ox, oy })
      jobs.push(
        fetchTerrainTile(source, t)
          .then((img) => {
            if (!img) return // 404 : trou de couverture, on laisse du vide
            // surzoom : on n'agrandit qu'une SOUS-FENÊTRE de l'ancêtre
            const s = TILE_PX / t.scale
            ctx.drawImage(img, t.ox * TILE_PX, t.oy * TILE_PX, s, s, ox, oy, TILE_PX, TILE_PX)
            painted++
          })
          .catch((err) => {
            if (err instanceof DemSourceError) hardFail ??= err
          })
      )
    }
  }
  await Promise.all(jobs)

  // panne de la source fine : on rejoue CE chargement sur AWS (la bascule est
  // retenue pour la session, donc l'appel récursif repart d'emblée sur AWS)
  if (hardFail && source.id !== DEM_SOURCES.aws.id) {
    fallbackToAws(hardFail)
    return loadDem({ lat, lon, zoom, tilesAcross, originTile, bathy, memo })
  }
  // plus rien du tout : c'est une panne, pas un trou — l'UI doit le dire
  if (!painted) throw hardFail ?? new Error(`aucune tuile d'altitude à ${zoom}/${cx},${cy} (${source.id})`)

  let rgba = ctx.getImageData(0, 0, sizePx, sizePx).data

  // ⚠️ LA SOURCE FINE SERT L'OCÉAN EN TUILES VIDES, AVEC UN HTTP 200.
  // Mesuré aux Canaries, z8 : Mapterhorn rend 52 octets de WebP uniforme là où
  // AWS en sert 130 Ko d'ETOPO1. Aucun code de statut ne l'attrape — la dalle
  // arrive « valide » et se décode à zéro partout, ce qui donne un plateau plat
  // au niveau de la mer. Ce sont les carrés blancs signalés par Adrien, larges
  // d'exactement un tiers de bloc, donc d'une tuile.
  //
  // On répare DALLE PAR DALLE plutôt que de basculer tout le bloc : un damier à
  // cheval sur une île et sur le large doit garder le relief fin sur l'île. AWS
  // porte de l'ETOPO1 sur tout l'océan, c'est exactement le socle qui manque.
  if (source.id !== DEM_SOURCES.aws.id) {
    const vides = []
    for (const slot of slots) {
      if (slotIsBlank(rgba, sizePx, slot.ox, slot.oy, TILE_PX)) vides.push(slot)
    }
    if (vides.length) {
      const aws = DEM_SOURCES.aws
      await Promise.all(
        vides.map((slot) =>
          fetchTerrainTile(aws, overzoomTile(zoom, slot.tx, slot.ty, aws.maxZoom))
            .then((img) => {
              if (!img) return
              const t = overzoomTile(zoom, slot.tx, slot.ty, aws.maxZoom)
              const s = aws.tilePx / t.scale
              // la tuile AWS fait 256 px, la dalle 512 : drawImage met à
              // l'échelle. De l'ETOPO1 à ~1 850 m ne perd rien à être agrandi.
              ctx.drawImage(img, t.ox * aws.tilePx, t.oy * aws.tilePx, s, s, slot.ox, slot.oy, TILE_PX, TILE_PX)
            })
            .catch(() => {}) // le socle est un bonus : son échec ne casse rien
        )
      )
      rgba = ctx.getImageData(0, 0, sizePx, sizePx).data
    }
  }

  // BATHYMÉTRIE : on peint le même damier dans un second canevas, puis on
  // fusionne. Tout échec est silencieux et sans conséquence — la carte reste
  // celle d'avant.
  const nappeBathy = bathy === false
    ? null
    : await loadBathyPatch({ zoom, cx, cy, half, n, sizePx, tilePx: TILE_PX, muet: terrariumMuetEnMer(rgba) })
  const seaData = nappeBathy?.patch ?? null
  // ⚠️ FLOAT32, ET PAS INT16 — LA MESURE, POUR QUE PERSONNE NE LA REFASSE.
  //
  // 1536² × 4 octets = 9,44 Mo par bloc. Le passer en Int16 rendrait 4,72 Mo et
  // ~9 % du temps de lecture. C'est tentant, et c'est un piège dès qu'on choisit
  // une unité ABSOLUE : quantifier le relief ajoute du bruit exactement à la
  // fréquence de Nyquist du maillage, et src/grid-normals.js vient de prouver
  // que c'est précisément ce que les normales révèlent à l'œil.
  //
  // Mesuré sur MNT réel (banc `.banc/f3-int16.mjs`), écart angulaire des
  // normales contre le Float32 actuel, res 768, La Réunion z13 et Chamonix z12 :
  //
  //   quantification            | pas    | écart moyen     | pire
  //   mètre entier (±32767 m)   | 1 m    | 0,57° à 1,09°   | 5,1° à 7,4°
  //   demi-mètre   (±16383 m)   | 0,5 m  | 0,29° à 0,54°   | 2,3° à 3,6°
  //   AFFINE PAR BLOC           | 4–6 cm | 0,035° à 0,044° | 0,30°
  //   (le terrarium natif)      | 3,9 mm | 0,005° à 0,006° | 0,03°
  //
  // Une unité absolue réinjecte donc entre un tiers et deux tiers de l'erreur de
  // normales qu'on venait justement de supprimer (3,2° à La Réunion). Elle est
  // exclue — et le demi-mètre est le maximum qui couvre encore la Terre entière
  // (Everest 8 849 m, Challenger Deep −10 935 m), donc il n'y a pas de réglage
  // absolu plus fin disponible.
  //
  // La SEULE voie tenable est AFFINE PAR BLOC : stocker `(h − minM) × 65534 /
  // (maxM − minM)` et porter `minM` et le facteur à côté du tableau. Le pas
  // devient 4 à 6 cm sur un bloc alpin, millimétrique sur un bloc plat — et le
  // bruit tombe à 0,04°, sept fois le plancher d'arrondi Float32 mais
  // soixante-dix fois moins que la version « mètre ». ⚠️ Deux réserves à lever
  // avant de l'écrire :
  //   — le ZÉRO n'est plus exactement représentable, et les seuils terre/mer se
  //     jouent au décimètre (seaLevelM 0,5 ; LAND_MIN_ELEV_M 0,3) : il faut
  //     vérifier que la topologie du flood-fill de sea-mask.js ne bouge pas ;
  //   — `fuseBathymetry` ne doit CREUSER QUE LA MER (« la terre ne bouge
  //     jamais », src/bathy.js) : la fusion doit se faire AVANT la
  //     quantification, jamais après.
  //
  // Non fait ici parce que la fenêtre continue 3×3 remplace les neuf reliefs par
  // UN SEUL : l'offset et le facteur devront alors porter sur l'emprise entière,
  // exactement comme `uHeightRange`. Le faire maintenant serait à refaire.
  const data = new Float32Array(sizePx * sizePx)
  let minM = Infinity
  let maxM = -Infinity
  let sum = 0
  let measured = 0
  for (let i = 0; i < data.length; i++) {
    // ⚠️ ALPHA 0 = AUCUNE TUILE PEINTE ICI, PAS UNE FOSSE ABYSSALE. Le triplet
    // (0,0,0) d'un canevas vierge se décode en −32768 m (voir bathy.js, même
    // piège côté mer). On rend 0, que fuseBathymetry lit comme une ABSENCE de
    // mesure — la bathymétrie fine peut donc y creuser normalement.
    if (rgba[i * 4 + 3] === 0) {
      data[i] = 0
      continue
    }
    const m = rgba[i * 4] * 256 + rgba[i * 4 + 1] + rgba[i * 4 + 2] / 256 - 32768
    data[i] = m
    if (m < minM) minM = m
    if (m > maxM) maxM = m
    sum += m
    measured++
  }
  if (!measured) { minM = 0; maxM = 0 }

  // La fusion ne peut que CREUSER la mer : la terre et le trait de côte
  // restent ceux du terrarium (voir src/bathy.js, et la session polders).
  // 🔴 B3 — LA NAPPE DU LAC, SI LA ZONE EN DÉCLARE UNE.
  // Sans elle, `seaLevel = 0` et un lac d'altitude est de la TERRE : le Léman à
  // +372 m sort inchangé, la source lacustre n'est même pas lue, et on aurait
  // déployé des tuiles pour zéro pixel changé, sans une erreur en console (B2).
  // ⚠️ **UN SEUL `seaLevel` PAR EMPRISE** : si une dalle contient deux lacs de
  // cotes différentes, un seul niveau s'applique. La sentinelle de
  // `fuseBathymetry` fait que l'autre lac est simplement ignoré, jamais creusé
  // — c'est une limite à écrire, pas à découvrir.
  const zoneIci = seaData ? zoneAt(await bathyIndex(), lat, lon) : null
  const nappeZone = zoneIci?.waterLevelM
  // 🔵 BT-I — LA BANDE DE FONDU, SI LA ZONE EN DÉCLARE UNE.
  // `fuseBathymetry` fond la source fine vers le rivage sur 25 m de
  // PROFONDEUR, en se servant de la profondeur comme substitut de la
  // DISTANCE À LA CÔTE. Bon pour GEBCO à 464 m ; faux pour BlueTopo à 4 m,
  // où une baie de 11,6 m à 20 km de toute côte sortait à −5,21 m (45 %).
  // ⚠️ Champ absent ⇒ rien n'est passé ⇒ BLEND_DEPTH = 25 comme avant, AU BIT.
  const fonduZone = zoneIci?.blendDepthM
  // 🔴 PLAT — LA BANDE DE BRUIT NE VAUT QU'À ÉCHELLE COMPARABLE.
  // On compare la maille de la tuile bathy la plus GROSSIÈRE réellement peinte
  // au pas du bloc. Au-delà de `CELLULE_MAX_PX`, `bandeBruitAdmise` rend 0 et la
  // reclassification terre → mer est suspendue — le reste de la fusion ne bouge
  // pas d'un bit. Voir l'encart de `bandeBruitAdmise` (src/bathy.js) et le
  // tableau des six lieux mesurés.
  // ⚠️ `metersPerPixel` est calculé PLUS BAS dans la fonction ; on refait ici le
  // même produit plutôt que de le remonter — le remonter changerait l'ordre de
  // `latRad` et personne ne verrait la différence avant un bloc de travers.
  const pasBlocM = ((156543.03392 * Math.cos(latRad)) / 2 ** zoom) * (256 / TILE_PX)
  const bandeBruit = seaData
    ? bandeBruitAdmise(resolutionBathyM(nappeBathy.zPire, lat), pasBlocM)
    : undefined
  // 🔴 VETO — LE TRAIT DE CÔTE SUR L'EMPRISE DU BLOC. Même module, même érosion
  // de 30 m qu'au globe et qu'à la fenêtre continue : les TROIS sites de fusion
  // doivent le porter, sinon le damier et le crop divergeraient sur la même
  // emprise — l'écart que B3 a mis une session à diagnostiquer. `null` (hors
  // couverture, panne réseau) ⇒ comportement d'avant, AU BIT.
  const argCote = {
    u0: (cx - half) / n, u1: (cx - half + tilesAcross) / n,
    v0: (cy - half) / n, v1: (cy - half + tilesAcross) / n,
    largeur: sizePx, hauteur: sizePx, metresParCellule: pasBlocM, zoom,
    cle: `b/${zoom}/${cx - half}/${cy - half}/${tilesAcross}/${sizePx}`,
  }
  // 🔴 B6 — ET SON AVIS INVERSE, PRIS SUR LA MÊME PROMESSE MÉMOÏSÉE : « la côte
  // a répondu, et elle ne déclare aucune terre ici ». Voir l'encart 🔴 B6 de
  // `src/bathy.js`. Coût réseau supplémentaire : ZÉRO (même clé de cache).
  const [veto, franche] = seaData
    ? await Promise.all([vetoTerre(argCote), merFranche(argCote)])
    : [null, false]
  const optsFusion =
    Number.isFinite(nappeZone) || Number.isFinite(fonduZone) || bandeBruit === 0 || veto || franche
      ? {
          ...(Number.isFinite(nappeZone) ? { seaLevel: nappeZone + 0.5 } : {}),
          ...(Number.isFinite(fonduZone) ? { blendDepth: fonduZone } : {}),
          ...(bandeBruit === 0 ? { noiseBand: 0 } : {}),
          ...(veto ? { terreVeto: veto } : {}),
          ...(franche ? { merFranche: true } : {}),
        }
      : undefined
  const fused = seaData ? fuseBathymetry(data, seaData, optsFusion) : data
  // ⚠️ PLUS DE `smoothSeaFloor` ICI, ET C'EST UN CHOIX MESURÉ, PAS UN OUBLI.
  //
  // Ce flou existait pour cacher les facettes de l'agrandissement BILINÉAIRE
  // (« l'effet creusement par cube » signalé par Adrien). Il traitait le
  // symptôme en aval ; le Catmull-Rom traite la cause en amont. Mesuré sur une
  // dalle z12 de la baie de Tokyo, en CASSURE D'INCLINAISON entre facettes
  // voisines — c'est exactement ce que `computeVertexNormals` révèle à l'œil :
  //
  //                                   baie 0-40 m      large > 200 m
  //   bilinéaire seul                  max 4,66°         max 31,71°
  //   bilinéaire + lissage             max 3,22°         max  2,13°
  //   Catmull-Rom seul                 max 0,82°         max  4,43°
  //   Catmull-Rom + lissage            max 0,69°         max  2,43°
  //
  // Trois raisons de le retirer :
  //  · DANS LA BAIE, IL NE SERVAIT DÉJÀ PRESQUE À RIEN — il s'atténue sous 40 m
  //    de fond pour ne pas bouger le rivage, or 91 % de la baie de Tokyo fait
  //    moins de 40 m (force moyenne du lissage : 47 %, et 4 % sur la tranche
  //    0-10 m). Le Catmull-Rom seul y fait déjà 4× mieux que le lissage.
  //  · AU LARGE, il rendait un chiffre flatteur en floutant du RELIEF RÉEL : les
  //    4,43° du Catmull-Rom sont une courbure douce et distribuée, pas une arête
  //    sur une ligne de grille (le saut de pente aux bords de cellule tombe de
  //    3,825 à 0,006 m/cellule).
  //  · IL COÛTAIT 84 ms PAR BLOC (1536², rayon 16), contre 14 ms pour tout
  //    l'agrandissement Catmull-Rom. Sur un damier de 25 blocs, 2 s de fil
  //    principal rendues à la carte.
  //
  // `smoothSeaFloor` reste exporté et testé : le jour où une source côtière
  // fine arrivera avec ses propres coutures, il sera là.
  if (fused !== data) {
    minM = Infinity; maxM = -Infinity; sum = 0
    for (let i = 0; i < fused.length; i++) {
      const m = fused[i]
      if (m < minM) minM = m
      if (m > maxM) maxM = m
      sum += m
    }
    measured = fused.length
  }

  // ══════════ LE CHAMP PASSE EN INT16, ET C'EST ICI QUE ÇA SE JOUE ══════════
  //
  // Après la fusion, jamais avant. `bathy.js` raisonne au 1/256 de mètre
  // (NODATA_EPS, SEA_EPS, la détection des aplats de remplissage compte des
  // valeurs EXACTES) : le quantifier en amont lui retirerait la finesse dont
  // sa règle dépend. Ici, tout est décidé.
  //
  // 9,44 Mo → 4,72 Mo par bloc 1536², et la lecture y gagne 9,5 % (localité de
  // cache). L'unité reste LE MÈTRE : aucun des huit consommateurs de
  // `dem.data` n'a de facteur d'échelle à connaître, donc aucun ne peut
  // l'oublier. Le garde-fou terre/mer et sa mesure sur MNT réel : dem-quant.js.
  const champ = quantizeElevations(fused)

  // Les EXTREMA décrivent le champ RENDU, donc ils se quantifient avec lui.
  // `uHeightRange`, `elevationHistogram` et l'échelle de couleurs normalisent
  // CE tableau-ci : un maximum resté à 1234,5 m pour un champ qui plafonne à
  // 1235 laisserait un sommet DÉBORDER de l'échelle — la septième statistique
  // globale de l'étude 3×3, en miniature.
  //
  // Une simple relecture des deux bornes suffit, sans reparcourir le champ :
  // `quantizeElevation` est monotone, donc les extrema du champ quantifié sont
  // les quantifiés des extrema.
  //
  // ⚠️ `meanM` N'EST PAS TOUCHÉ, ET C'EST VOLONTAIRE. Il ne normalise rien : il
  // sert à caler verticalement les dalles voisines les unes sur les autres. Sa
  // somme, elle, EXCLUT les pixels non mesurés (alpha nul) — une information
  // que le champ quantifié ne porte plus, puisqu'un pixel absent y vaut 0 comme
  // n'importe quelle plage au niveau de la mer. Le recalculer ici polluerait la
  // moyenne avec les trous du damier ; le décalage de quantification, lui, est
  // borné à un demi-mètre sur une valeur qui n'en demande pas tant.
  minM = quantizeElevation(minM)
  maxM = quantizeElevation(maxM)

  // ⚠️ 156543·cos(lat)/2^z est la résolution d'une tuile de 256 px. Une tuile
  // de 512 px décrit la MÊME étendue au sol avec deux fois plus de pixels : la
  // résolution est donc moitié moindre. Sans ce facteur, extentMeters doublait
  // et le bloc entier se retrouvait à la mauvaise échelle (relief écrasé,
  // tracés GPX décalés, damier de blocs voisins désaligné).
  const metersPerPixel = ((156543.03392 * Math.cos(latRad)) / 2 ** zoom) * (256 / TILE_PX)
  const bloc = {
    data: champ, // Int16Array, en MÈTRES (voir dem-quant.js)
    size: sizePx,
    tilePx: TILE_PX,
    demSource: source.id,
    maxZoom,
    metersPerPixel,
    extentMeters: metersPerPixel * sizePx,
    minM,
    maxM,
    meanM: measured ? sum / measured : 0,
    lat,
    lon,
    zoom,
    // exact georeference: fractional tile coords of the canvas top-left corner,
    // so lat/lon ↔ world XZ conversions are pixel-accurate (see geo.js)
    originTileX: cx - half,
    originTileY: cy - half,
  }
  return cleMemo ? demMemoEcrire(cleMemo, bloc) : bloc
}

// Une tuile d'altitude → ImageBitmap, `null` si elle n'existe pas (404), et
// DemSourceError si c'est la SOURCE qui a un problème (réseau, 5xx, DNS, image
// indécodable — un navigateur sans WebP, par exemple).
function fetchTerrainTile(source, t) {
  const url = source.url(t.z, t.x, t.y)
  return tuileMemorisee(url, async () => {
    let res
    try {
      res = await fetch(url)
    } catch (err) {
      throw new DemSourceError(`${source.id} ${t.z}/${t.x}/${t.y} → ${err?.message || err}`)
    }
    if (res.status === 404) return null
    if (!res.ok) throw new DemSourceError(`${source.id} ${t.z}/${t.x}/${t.y} → HTTP ${res.status}`)
    try {
      return await createImageBitmap(await res.blob())
    } catch (err) {
      throw new DemSourceError(`${source.id} ${t.z}/${t.x}/${t.y} illisible → ${err?.message || err}`)
    }
  })
}

// bilinear sample of the height grid at fractional pixel coords
export function sampleDem(dem, px, py) {
  const { data, size } = dem
  const x = Math.min(Math.max(px, 0), size - 1.001)
  const y = Math.min(Math.max(py, 0), size - 1.001)
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const fx = x - x0
  const fy = y - y0
  const i = y0 * size + x0
  const a = data[i]
  const b = data[i + 1]
  const c = data[i + size]
  const d = data[i + size + 1]
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy
}

// Une dalle est-elle VIDE au sens « rien de mesuré » ? On échantillonne une
// grille clairsemée : dès qu'un pixel s'écarte du niveau zéro, la dalle porte
// une information et on la garde. Un océan réel n'est jamais plat au mètre près
// sur toute une tuile — sauf justement quand la source n'a rien à en dire.
//
// Le seuil de 1/256 m est un pas de quantification terrarium : c'est la plus
// petite valeur non nulle représentable, donc la frontière exacte entre
// « exactement zéro » et « une vraie mesure ».
const BLANK_STEP = 16 // un pixel sur 16 dans chaque sens : 1024 sondes par dalle
function slotIsBlank(rgba, sizePx, ox, oy, tilePx) {
  for (let y = 0; y < tilePx; y += BLANK_STEP) {
    for (let x = 0; x < tilePx; x += BLANK_STEP) {
      const i = ((oy + y) * sizePx + ox + x) * 4
      if (rgba[i + 3] === 0) continue // pas peint : ce n'est pas un verdict
      const m = rgba[i] * 256 + rgba[i + 1] + rgba[i + 2] / 256 - 32768
      if (Math.abs(m) > 1 / 256) return false
    }
  }
  return true
}

// Assemble le damier de tuiles BATHYMÉTRIQUES, en mètres, case par case.
// Rend `null` dès que rien d'utile n'a été trouvé — l'appelant continue alors
// avec le seul terrarium, sans le savoir.
//
// ⚠️ PLUS AUCUN CANEVAS À LA TAILLE DU BLOC, ET PLUS AUCUN `drawImage`
// AGRANDISSANT. C'est LE correctif : agrandir une tuile z8 par drawImage se
// faisait en bilinéaire, dont la pente casse à chaque bord de cellule — mesuré
// 3,825 m/cellule dans la baie de Tokyo, soit 0,67° de cassure d'inclinaison à
// l'exagération 2,8, que `computeVertexNormals` révèle en grille de carrés de
// 464 m. En Catmull-Rom : 0,006 m/cellule, 615 fois moins (src/bathy.js).
async function loadBathyPatch({ zoom, cx, cy, half, n, sizePx, tilePx, muet = false }) {
  // NaN = case non peinte, que `fuseBathymetry` ignore comme n'importe quelle
  // valeur non finie (c'est ce que faisait l'alpha nul du canevas d'avant)
  const patch = new Float32Array(sizePx * sizePx).fill(NaN)
  let painted = 0
  // 🔴 PLAT — LE NIVEAU LE PLUS GROSSIER RÉELLEMENT PEINT. C'est lui qui décide
  // si la source fine a encore le droit de RECLASSER de la terre en mer (voir
  // `bandeBruitAdmise`, src/bathy.js) : une emprise servie par une seule cellule
  // EMODnet z10 étalée sur 256 px de bloc n'est pas une source fine, c'est un
  // carré. On prend le PLUS GROSSIER des niveaux peints, pas le plus fin : la
  // règle est globale au bloc, et c'est la cellule la plus large qui dessine les
  // carrés qu'Adrien voit.
  let zPire = -1
  const jobs = []
  // Un seul aller-retour pour tout le damier : l'index est mémorisé, et les 25
  // dalles du damier de blocs attendent la MÊME promesse.
  const index = await bathyIndex()
  for (let dy = -half; dy <= half; dy++) {
    for (let dx = -half; dx <= half; dx++) {
      const tx = (cx + dx + n) % n
      const ty = cy + dy
      if (ty < 0 || ty >= n) continue
      const ox = (dx + half) * tilePx
      const oy = (dy + half) * tilePx
      // On descend de la tuile la plus fine disponible vers le plancher : la
      // première qui répond gagne. Une absence reste le cas NORMAL à un niveau
      // donné, mais elle ne doit plus laisser la case à plat.
      // ⚠️ **LA DESCENTE « FIN → PLANCHER » VIT DANS `peindreBathyTuile`**
      // (Tâche 6 sexies) : le flux du socle la partage mot pour mot.
      jobs.push(
        peindreBathyTuile({
          zoom, tx, ty, index,
          dst: patch, dstStride: sizePx, dx: ox, dy: oy, dw: tilePx, dh: tilePx,
        }).then((z) => {
          if (z >= 0) { painted++; if (zPire < 0 || z < zPire) zPire = z; return }
          // 🔴 B3 — LA SECONDE CHANCE, ET SEULEMENT QUAND ELLE NE COÛTE RIEN.
          // La case n'a rien trouvé au-dessus du plancher de `BATHY_ZMIN`. Si le
          // terrarium était bavard ici, on s'arrête : c'est exactement
          // l'arbitrage des 796 coutures, et l'écraser avec du 8 km dégraderait
          // la carte. Mais si le terrarium est MUET (à 0,000 m pile sur tout le
          // champ immergé — c'est le cas au-delà de z10), il n'y a rien à
          // dégrader et le repli grossier remplit un vide au lieu d'écraser une
          // mesure. Sans ça, la plaine ionienne reste à 0 m sur les DEUX chemins.
          if (!muet) return
          return peindreBathyTuile({
            zoom, tx, ty, index, plancher: index.zmin,
            dst: patch, dstStride: sizePx, dx: ox, dy: oy, dw: tilePx, dh: tilePx,
          }).then((z2) => { if (z2 >= 0) { painted++; if (zPire < 0 || z2 < zPire) zPire = z2 } })
        })
      )
    }
  }
  await Promise.all(jobs)
  return painted ? { patch, zPire } : null
}

/**
 * Le relief de référence n'a-t-il RIEN à dire de la mer sur cette dalle ?
 *
 * ⚠️ **ON LIT LES OCTETS, PAS LES MÈTRES** : `data` n'est décodé qu'APRÈS la
 * bathymétrie, et c'est cette réponse-là qui décide de la descente. Un pixel
 * porte une vraie profondeur dès que son triplet terrarium décode sous
 * −0,002 m ; on s'arrête au PREMIER, donc une vraie mer coûte quelques
 * itérations. Le cas coûteux — la dalle entièrement muette — est celui où l'on
 * a de toute façon un aller-retour réseau à faire ensuite.
 * ⚠️ Alpha 0 = case non peinte : une absence, pas une profondeur.
 */
function terrariumMuetEnMer(rgba) {
  if (!rgba) return false
  for (let i = 0, n = rgba.length; i < n; i += 4) {
    if (rgba[i + 3] === 0) continue
    const m = rgba[i] * 256 + rgba[i + 1] + rgba[i + 2] / 256 - 32768
    if (m < -0.002) return false
  }
  return true
}
