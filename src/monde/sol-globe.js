// L'ÉCHANTILLONNEUR DE SOL EN ESPACE GLOBE — Tâche D16-b, étape 1.
//
// ══════════ CE QUE CE FICHIER N'EST PAS ═════════════════════════════════════
//
// ⛔ **CE N'EST PAS UN SECOND ÉCHANTILLONNEUR DE RELIEF.** Le dépôt en a déjà
// un, et il est en espace globe : `globe.hauteurDessinee(lat, lon)` rend, EN
// MÈTRES, la hauteur que le GPU DESSINE au point exact — la loi de nœud de
// `_buildMesh`, fond du crop compris (`globe.js`, Tâche P11). Le brief de la
// tâche prévient : « ne construis pas un second échantillonneur si le dépôt en
// a déjà un ». Il en a un.
//
// ⚡ **CE QUI MANQUAIT N'EST PAS LA HAUTEUR, C'EST L'ADAPTATEUR.** Les calques
// de carte (`map/water-layer.js`, `map/places-layer.js`) raisonnent en
// COORDONNÉES DE BLOC : ils projettent leurs lat/lon en `(x · z)` de bloc,
// découpent sur l'empreinte du bloc, drapent avec `terrain.sample` et ajoutent
// leurs marges (`offset: 0.07`, `CLEARANCE: 0.9`) en unités de bloc. Ce module
// est la CHARNIÈRE : il prend ces `(x · z · y)` de bloc et rend une position
// dans la scène du GLOBE, en lisant la hauteur du globe et non celle du bloc.
//
// ══════════ ⚠️ LES DEUX SEULES CONVERSIONS, ÉCRITES ═════════════════════════
//
// Le brief le dit sans détour : « la classe de défaut la plus fréquente de ce
// chantier est la conversion d'espace — sept occurrences, dont un facteur
// 121,6, un facteur 10, et un facteur 130,4 ». **Il y en a exactement deux ici,
// et aucune autre longueur ne traverse.**
//
// ① **HORIZONTALE — AUCUN SCALAIRE, UNE RÉCIPROQUE.** Le calque a fabriqué ses
//    `(x · z)` avec `latLonToWorld(dem, lat, lon)` (geo.js). On revient par
//    `worldToLatLon(dem, x, z)`, **sa réciproque exacte dans le même fichier et
//    sur le même `dem`**. Pas de facteur d'échelle, donc pas de facteur
//    d'échelle à se tromper. ⛔ **Surtout PAS `mondeVersLatLonEmprise` sur
//    l'emprise bornée** : c'est une SECONDE loi, calée sur l'emprise du socle et
//    non sur la grille de tuiles du MNT (`geo.js` mesure jusqu'à un sixième de
//    socle d'écart entre les deux), et les deux divergeraient en silence.
//
// ② **VERTICALE — `metresParUniteBloc`, ET ELLE PORTE UNE ORIGINE.**
//    `terrain.sample` ne rend PAS des mètres : il rend
//    `(altitude − dem.meanM) × echelle`, où `echelle = span / extentMeters ×
//    exagération` (`terrain.js:_makeDemSampler`). **Le zéro du bloc est
//    l'altitude MOYENNE de son emprise, pas le niveau de la mer** — oublier
//    `meanM` poserait toute la cartographie à la mer sous les Alpes, soit
//    ~1 800 m trop bas à Chamonix. On rend donc les deux sens :
//      · `metresDe(yBloc) = yBloc / echelleBloc + meanM`
//      · `blocDe(hM)      = (hM − meanM) × echelleBloc`
//
// ⚡ **ET LA MONTÉE VERS LE GLOBE EST CELLE DU GLOBE, PAS UNE TROISIÈME.**
// `rayon = R_GLOBE + hM × echelleGlobe`, avec `echelleGlobe = (R_GLOBE /
// EARTH_RADIUS_M) × exagération` — mot pour mot `uUnitesParMetre` (`globe.js`,
// `setExaggeration`) et `dispScale` (`_buildMesh`). Un point posé à la hauteur
// que `hauteurDessinee` vient de rendre tombe donc **sur** la surface dessinée,
// par construction et non par réglage.
//
// ⚠️ **LE PRODUIT DES DEUX ÉCHELLES EST LE `k` DE LA SIMILITUDE**, et c'est le
// contrôle qui attrape une exagération désaccordée : `echelleGlobe /
// echelleBloc = extentMeters / span / ORBITAL_M_PER_UNIT × (exagGlobe /
// exagBloc)`, c'est-à-dire `facteurEchelle()` de `monde/frontiere-rendu.js`
// **si et seulement si les deux exagérations sont la même**. Sous
// `terre unique`, `globe.exagSuivie` est levé et le globe LIT
// `lireExageration(params)` : elles le sont. Le test ⑤ le vérifie plutôt que de
// le supposer, et `rapportSimilitude()` l'expose pour qu'une sonde le relise à
// l'écran.
//
// ══════════ LE REPLI, ET POURQUOI IL N'EST PAS ZÉRO ═════════════════════════
//
// `hauteurDessinee` rend `null` quand aucune tuile chargée AVEC SES HAUTEURS ne
// couvre le point — c'est-à-dire hors de l'emprise que `reserverHauteurs`
// réserve (`main.js`), et pendant les quelques images qui suivent un cran.
//
// ⛔ **`null` N'EST PAS `0`** : zéro est le niveau de la mer, et le confondre
// avec « je ne sais pas » collerait la rivière à la mer au milieu d'une vallée
// (c'est l'encoche que `parois-crop.js` §7 documente). Le repli est donc le
// SOL DU BLOC lui-même — la même donnée, lue par l'autre chemin. Il n'y a
// jamais de trou, et `refus` compte les points repliés pour qu'une sonde
// puisse dire à quel point la couverture a manqué au lieu de le deviner.

import { R_GLOBE, EARTH_RADIUS_M, latLonToSphere, worldToLatLon } from '../geo.js'
import { localCrop, distanceCrop, tuileDansCrop, mercX, mercY } from './crop-sphere.js'

/**
 * Le poseur du BLOC — celui du dépôt, écrit ici pour qu'il n'y ait qu'UNE
 * interface et pas deux chemins de code dans les calques.
 *
 * `hauteur` est le sol en unités de bloc ; `placer` met un point à une hauteur
 * de bloc donnée. Sur le bloc plat, `placer` est l'identité — c'est exactement
 * ce que `line-segments.js` et `water-layer.js` écrivaient en clair.
 *
 * @param {(x:number, z:number) => number} sample
 */
export function poseurPlat(sample) {
  return {
    globe: false,
    hauteur: (x, z) => sample(x, z),
    placer: (x, z, y) => ({ x, y, z }),
    refus: 0,
  }
}

/**
 * Le poseur du GLOBE.
 *
 * @param {object} arg
 * @param {(x:number, z:number) => number} arg.sample le sol du bloc, en unités
 *   de bloc — **le repli**, jamais la source normale.
 * @param {(lat:number, lon:number) => (number|null)} arg.hauteurM la hauteur
 *   DESSINÉE par le globe, en mètres, ou `null` si aucune tuile ne couvre.
 *   ⚠️ **C'est `globe.hauteurDessinee`, avec sa liste de candidates déjà
 *   filtrée** : sans elle, chaque sommet reparcourrait toutes les tuiles.
 * @param {(x:number, z:number) => {lat:number, lon:number}} arg.versLatLon la
 *   RÉCIPROQUE de la projection du calque — `worldToLatLon(dem, …)`.
 * @param {number} arg.echelleBloc unités de bloc par mètre :
 *   `demSpan(dem) / dem.extentMeters × exagération`.
 * @param {number} arg.meanM l'altitude moyenne de l'emprise — le ZÉRO du bloc.
 * @param {number} arg.exagerationGlobe `globe.exaggeration`.
 * @param {number} [arg.rayon] le rayon de la sphère, en unités de scène.
 * @param {{cx:number, cy:number, demi:number}|null} [arg.repereCrop] le repère
 *   du socle en mercator normalisé (`globe._crop`) — GX4 : c'est la LOI DU BORD,
 *   celle des tuiles et de la mer ; sans lui `versCrop` rend `null` et rien
 *   n'est écrêté (hors crop, la planète entière est dessinée).
 * @param {{coin:number, expo:number}} [arg.formeCrop] l'arrondi du socle, en
 *   fraction du demi-côté et exposant — `uCropCoin` / `uCropCoinN`.
 * @param {string} [arg.signature] l'empreinte des tuiles DESSINÉES dans le socle
 *   au moment de la fabrication (`globe.signatureDessineeCrop()`) : le calque
 *   la compare à celle de l'image courante pour savoir si le relief qu'il a
 *   drapé est encore celui que le GPU dessine — GX4 ③.
 */
export function creerPoseurGlobe({
  sample,
  hauteurM,
  versLatLon,
  echelleBloc,
  meanM = 0,
  exagerationGlobe = 1,
  rayon = R_GLOBE,
  repereCrop = null,
  formeCrop = null,
  uniformsCrop = null,
  signature = null,
}) {
  if (!(echelleBloc > 0)) throw new Error('sol-globe : echelleBloc doit être > 0')
  const echelleGlobe = (rayon / EARTH_RADIUS_M) * exagerationGlobe
  const etat = { refus: 0, points: 0, globe: true, echelleBloc, echelleGlobe, meanM, rayon, signature }

  // ② les deux sens de la conversion verticale, écrits une fois.
  const metresDe = (yBloc) => yBloc / echelleBloc + meanM
  const blocDe = (hM) => (hM - meanM) * echelleBloc

  etat.metresDe = metresDe
  etat.blocDe = blocDe
  // ⚠️ UNE MARGE EN MÈTRES RÉELS → UNITÉS DE BLOC, SANS ORIGINE : `blocDe`
  // porte `meanM`, une différence de hauteur ne le porte pas. `echelleBloc`
  // contient l'exagération, comme `echelleGlobe` : une marge de 2 m de terrain
  // vaut 2 m réels une fois l'exagération divisée par le banc (GX4 ①).
  etat.margeBloc = (metres) => metres * echelleBloc

  // ══════ LE BORD DU SOCLE — GX4 ② ══════════════════════════════════════════
  //
  // Le tracé était dessiné DANS LE VIDE hors du socle : 358 px sur la planète
  // nue et le long de la paroi à z13 (GX3 ⑥). La mer et les tuiles, elles, ne
  // débordent pas d'un pixel : leur fragment mesure `distanceBordCrop(qCrop)` et
  // rejette au-delà de 0. Le ruban prend la MÊME mesure, calculée ici par
  // sommet en coordonnées locales du crop (±1 sur la frontière) — c'est
  // l'`aCrop` de la mer, pas une seconde loi.
  etat.repereCrop = repereCrop
  etat.formeCrop = formeCrop
  // ⚡ **LES UNIFORMES DU CROP, PARTAGÉS PAR RÉFÉRENCE** (`uCropCentre`,
  // `uCropDemi`, `uCropCoin`, `uCropCoinN` du globe) : le socle BOUGE pendant
  // un vol de poursuite (le bloc se recentre sur la tête), et un bord cuit dans
  // la géométrie par rapport au repère d'AVANT rejetait tout le ruban jusqu'au
  // re-drapage suivant — mesuré : 4 à 8 images sur 40 sans tracé, par paires.
  // Le sommet porte donc son MERCATOR (`versMercator`), et c'est le nuanceur
  // qui le rapporte au centre courant, comme le fragment de tuile.
  etat.uniformsCrop = uniformsCrop
  etat.versMercator = (x, z) => {
    const p = versLatLon(x, z)
    return p ? [mercX(p.lon), mercY(p.lat)] : null
  }
  etat.versCrop = (x, z) => {
    if (!repereCrop) return null
    const p = versLatLon(x, z)
    if (!p) return null
    const l = localCrop(p.lat, p.lon, repereCrop)
    return [l.u, l.v]
  }
  // Un point de BLOC est-il dans le socle ? Vrai sans repère (rien à écrêter).
  etat.dansSocle = (x, z) => {
    const q = etat.versCrop(x, z)
    if (!q) return true
    return distanceCrop(q[0], q[1], formeCrop || undefined) <= 0
  }

  etat.hauteur = (x, z) => {
    etat.points++
    const p = versLatLon(x, z)
    const h = p ? hauteurM(p.lat, p.lon) : null
    // ⛔ `null` traverse jusqu'ici et RETOMBE SUR LE BLOC — voir l'en-tête.
    if (h == null || !Number.isFinite(h)) { etat.refus++; return sample(x, z) }
    return blocDe(h)
  }

  etat.placer = (x, z, y, out = null) => {
    const p = versLatLon(x, z)
    // ① aucune conversion horizontale : `versLatLon` est la réciproque exacte
    // de la projection qui a fabriqué `(x · z)`.
    if (!p) return { x, y, z }
    const r = rayon + metresDe(y) * echelleGlobe
    const v = latLonToSphere(p.lat, p.lon, r, out ?? undefined)
    return v
  }

  /**
   * LE REPÈRE LOCAL, POUR LES NUANCEURS QUI EN ONT UN EN DUR.
   *
   * ⚠️ **LE MATÉRIAU DE LAC ÉCRIT `vec3 N = vec3(0.0, 1.0, 0.0)`**
   * (`map/lake-material.js`) : la verticale du BLOC PLAT. Sur la sphère, la
   * verticale d'un lac à 46° N n'a plus rien à voir avec `+Y` — 46° d'écart —,
   * et c'est le Fresnel ET le reflet du soleil qui deviennent faux. Le nuanceur
   * a donc besoin du repère local, et il vient d'ici plutôt que d'une seconde
   * écriture chez lui.
   *
   * ⚠️ **`demi` EST CONVERTI, ET LA CONVERSION EST LA MÊME QUE PARTOUT.** Le
   * fragment normalise ses coordonnées par la demi-largeur du bloc
   * (`uHalf = TERRAIN_SIZE / 2`, 28 unités de BLOC). Laissée telle quelle sur
   * une géométrie de sphère, la rampe saturerait et le grain descendrait à une
   * fréquence invisible. `demi × rapportSimilitude()` la ramène en unités de
   * globe — c'est le `k` de la similitude, et rien d'autre.
   *
   * @param {number} demiBloc la demi-largeur du bloc, en unités de bloc
   */
  etat.repereLocal = (demiBloc) => {
    const p = versLatLon(0, 0)
    if (!p) return null
    const la = (p.lat * Math.PI) / 180
    const lo = (p.lon * Math.PI) / 180
    const sla = Math.sin(la), cla = Math.cos(la)
    const slo = Math.sin(lo), clo = Math.cos(lo)
    // ⚠️ **C'EST `repereGlobe` DE `monde/frontiere-rendu.js`, MOT POUR MOT**, et
    // le test ⑥ le confronte à l'original plutôt que de faire confiance à la
    // recopie. On ne l'importe pas : `frontiere-rendu.js` porte toute la
    // similitude de la caméra, et ce module-ci ne doit rien lui devoir.
    return {
      centre: etat.placer(0, 0, 0),
      est: [clo, 0, -slo],
      sud: [sla * slo, -cla, sla * clo],
      demi: demiBloc * etat.rapportSimilitude(),
    }
  }

  /**
   * Le contrôle de l'en-tête : `echelleGlobe / echelleBloc` DOIT valoir le `k`
   * de la similitude (`facteurEchelle`, `monde/frontiere-rendu.js`). L'exposer
   * plutôt que le supposer est ce qui rend une exagération désaccordée
   * mesurable au lieu d'invisible.
   */
  etat.rapportSimilitude = () => echelleGlobe / echelleBloc

  return etat
}

/**
 * Le `k` de la similitude, recalculé depuis les grandeurs du bloc — la MÊME
 * formule que `facteurEchelle` (`monde/frontiere-rendu.js`), recopiée ici
 * uniquement pour que le test ⑤ puisse confronter deux chemins INDÉPENDANTS.
 *
 * ⚠️ **Aucun code de production ne l'appelle** : la production emploie
 * `facteurEchelle`. Deux écritures d'une même loi ne se justifient que quand
 * l'une sert à contredire l'autre, et c'est le cas ici.
 */
export function kAttendu({ extentMeters, span, rayon = R_GLOBE }) {
  return (extentMeters / span) * (rayon / EARTH_RADIUS_M)
}

/**
 * La charnière côté application : construit le poseur du globe à partir des
 * objets vivants, ou rend le poseur plat quand le globe n'a rien à dire.
 *
 * ⚠️ **LA LISTE DES TUILES EST PRISE UNE FOIS, ICI.** `hauteurDessinee` sait
 * accepter une liste pré-filtrée ; sans elle, chacun des milliers de sommets
 * d'un calque reparcourrait `globe.tiles`. C'est le seul endroit qui connaisse
 * à la fois le globe et la durée de vie « une reconstruction ».
 */
export function poseurPourReconstruction({ globe, dem, sample, echelleBloc, actif }) {
  if (!actif || !globe || !dem || !(echelleBloc > 0)) return poseurPlat(sample)
  const liste = globe.tuilesAvecHauteurs?.() ?? []
  const dessinees = tuilesDessineesDansSocle(globe)
  // ⛔ **LE REPLI À PLAT NE VAUT QUE SANS AUCUNE SURFACE.** Il tombait dès que
  // les hauteurs réservées manquaient — et elles manquent pendant chaque
  // recentrage du socle en vol (`gardeHauteurs` change d'emprise, les
  // hauteurs sont relâchées, le MNT n'est pas encore arrivé). Un ruban
  // reconstruit à cet instant l'était en coordonnées de BLOC dans la scène du
  // globe : 6 371 km du crop, **0 pixel pendant 3 relevés sur 40**, deux fois
  // par vol de poursuite (mesuré, banc de lecture GX3, phase suivi). Le
  // maillage dessiné, lui, est là : il suffit à poser le ruban.
  if (!liste.length && !dessinees.length) return poseurPlat(sample)
  // ══════ LA HAUTEUR QUE LE GPU DESSINE, PAS CELLE QU'IL A EN RÉSERVE — GX4 ① ══
  //
  // ⛔ **`hauteurDessinee` LIT `t.heights`, ET `t.heights` N'EXISTE QUE POUR LES
  // TUILES RÉSERVÉES — CELLES DU ZOOM DU MNT (z11 au Mont-Blanc).** Le crop, lui,
  // dessine des tuiles z12/z13 : le ruban était drapé sur un relief deux crans
  // plus grossier que celui qui le cache. Mesuré par GX3 contre la surface
  // rendue (rayon sur les maillages, 2 335 sommets) : moyenne +9,5 m, **min
  // −176 m, max +160 m, 673 sommets enterrés de plus de 5 m** — un tracé
  // pointillé sur les crêtes, des cols à 150–390 m de leur vraie place.
  //
  // ➡️ `hauteurMaillee` LIT LE MAILLAGE (SOC) : la position des sommets que le
  // GPU rasterise, à 0,05 m près, pour toute tuile qui a un maillage. Et la
  // liste est celle des tuiles VISIBLES DANS LE SOCLE — celles que `update()`
  // vient d'allumer — triée du plus fin au plus grossier : la première qui
  // couvre EST celle qui est dessinée là. Une tuile maillée mais éteinte (un
  // enfant dont les trois frères ne sont pas prêts, un parent refendu) n'entre
  // pas : elle n'est pas ce qu'on voit.
  //
  // Le repli garde l'ancien chemin (`hauteurDessinee`, hauteurs réservées) puis
  // le bloc : jamais zéro (voir l'en-tête).
  const brute = dessinees.length
    ? (lat, lon) => globe.hauteurMaillee(lat, lon, dessinees) ?? (liste.length ? globe.hauteurDessinee(lat, lon, liste) : null)
    : (lat, lon) => globe.hauteurDessinee(lat, lon, liste)
  // ⚠️ **LA MER EST UNE SURFACE DESSINÉE AUSSI.** Avec un fond posé
  // (`_fondCrop`), le maillage des tuiles DESCEND sous le niveau de la mer
  // (Camargue : −8 m) et la nappe `crop-mer` est dessinée par-dessus, à
  // l'altitude 0 (`R_GLOBE`). Un ruban drapé sur le fond passait SOUS l'eau :
  // GX3 ③ « Camargue −7,1 m, 106 sommets sous le plan de mer », et le tracé
  // invisible au premier relevé de lecture. Le sol du ruban est donc la plus
  // haute des deux surfaces : le fond, ou la mer. Sans fond, `altitudeMaillage`
  // écrête déjà à 0 (« oceans stay on the sphere ») : rien ne change.
  const hauteurM = globe._fondCrop
    ? (lat, lon) => { const h = brute(lat, lon); return h == null ? h : Math.max(h, 0) }
    : brute
  const u = globe.uniforms
  return creerPoseurGlobe({
    sample,
    hauteurM,
    versLatLon: (x, z) => worldToLatLon(dem, x, z),
    echelleBloc,
    meanM: dem.meanM ?? 0,
    exagerationGlobe: globe.exaggeration ?? 1,
    repereCrop: globe._crop ? { cx: globe._crop.cx, cy: globe._crop.cy, demi: globe._crop.demi } : null,
    formeCrop: u?.uCropCoin && u?.uCropCoinN ? { coin: u.uCropCoin.value, expo: u.uCropCoinN.value } : null,
    // ⚠️ `uCropOn` EN FAIT PARTIE (GX5) : `retirerCrop()` l'éteint et rend le
    // globe entier, mais les autres uniformes gardent la valeur du dernier
    // socle. Sans lui, un ruban compilé avec le bord resterait coupé sur un
    // socle qui n'existe plus — c'est la garde que le fragment de tuile porte
    // depuis toujours (`if (uCropOn > 0.5)`, globe.js), pas une invention.
    uniformsCrop: u?.uCropCentre && u?.uCropDemi && u?.uCropCoin && u?.uCropCoinN && u?.uCropOn
      ? { uCropCentre: u.uCropCentre, uCropDemi: u.uCropDemi, uCropCoin: u.uCropCoin, uCropCoinN: u.uCropCoinN, uCropOn: u.uCropOn }
      : null,
    signature: signatureDessineeCrop(globe),
  })
}

/**
 * Les tuiles dont le maillage est ALLUMÉ dans l'emprise du socle, du plus fin
 * au plus grossier — la surface que le GPU dessine à cette image, et rien
 * d'autre. Étiquetée `trieeFinAbord` pour que `_tuileLaPlusFine` s'arrête à la
 * première qui couvre (Tâche FLU). Vide sans crop.
 *
 * ⚠️ **`mesh.visible`, PAS `state === 'ready'`** : le quadtree n'allume que ses
 * feuilles (`globe.update`), et c'est la feuille que le rayon du noteur frappe.
 */
export function tuilesDessineesDansSocle(globe) {
  const rep = globe?._crop
  const out = []
  if (!rep || !globe.tiles) return out
  // ⚠️ dilatée d'un cheveu, comme `_paroisProvisoires` : un point sur le bord
  // est/sud tombe à `tx = 1`, c'est-à-dire dans la voisine.
  const boite = { cx: rep.cx, cy: rep.cy, demi: rep.demi * (1 + 1e-6) }
  for (const t of globe.tiles.values()) {
    if (t.mesh?.visible && t.mesh.geometry?.attributes?.position && tuileDansCrop(t.z, t.x, t.y, boite)) out.push(t)
  }
  out.sort((a, b) => b.z - a.z)
  out.trieeFinAbord = true
  return out
}

/**
 * L'empreinte des tuiles dessinées dans le socle — une chaîne qui change dès
 * qu'une tuile s'allume ou s'éteint dans l'emprise. C'est ce que le calque GPX
 * compare pour se re-draper quand les tuiles fines arrivent (GX4 ③) : après un
 * `flyTo`, le ruban restait drapé sur les hauteurs du zoom PRÉCÉDENT jusqu'à la
 * reconstruction suivante (GX3 ② : départ z11 à 160 m de sa vérité).
 */
export function signatureDessineeCrop(globe) {
  const liste = tuilesDessineesDansSocle(globe)
  let s = liste.length + ':'
  for (const t of liste) s += t.key ?? `${t.z}/${t.x}/${t.y}`, s += ' '
  return s
}

/**
 * LE PASSAGE D'UN TABLEAU DE SOMMETS DU BLOC À LA SCÈNE — Tâche GX2.
 *
 * ⚠️ **C'EST LE GESTE QUI PORTE LES PIXELS**, et c'est pour ça qu'il vit ici
 * plutôt qu'en ligne dans `gpx.js` : un correctif qui se contente d'adopter la
 * scène du globe (et même d'y ajouter la caméra) laisse la géométrie en
 * coordonnées de BLOC et rend **0 pixel** — mesuré. Une fonction pure se teste
 * en exécution ; une ligne noyée dans une méthode de 200 lignes ne se garde
 * qu'en lisant du texte, et ce chantier a déjà vu une mutation survivre à
 * 4 082 tests derrière une garde qui ne faisait que lire.
 *
 * `positions` est un tableau plat `[x, y, z, x, y, z, …]` en unités de BLOC,
 * modifié EN PLACE. Avec `poseurPlat`, c'est l'identité au flottant près.
 *
 * @param {ArrayLike<number>} positions
 * @param {{globe:boolean, placer:Function}} poseur
 */
export function poseTableauEnPlace(positions, poseur) {
  if (!poseur?.globe) return positions
  for (let i = 0; i < positions.length; i += 3) {
    // ⚠️ `placer(x, z, y)` — l'ordre du poseur, pas celui du tableau.
    const v = poseur.placer(positions[i], positions[i + 2], positions[i + 1])
    positions[i] = v.x; positions[i + 1] = v.y; positions[i + 2] = v.z
  }
  return positions
}
