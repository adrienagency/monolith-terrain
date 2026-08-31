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
 */
export function creerPoseurGlobe({
  sample,
  hauteurM,
  versLatLon,
  echelleBloc,
  meanM = 0,
  exagerationGlobe = 1,
  rayon = R_GLOBE,
}) {
  if (!(echelleBloc > 0)) throw new Error('sol-globe : echelleBloc doit être > 0')
  const echelleGlobe = (rayon / EARTH_RADIUS_M) * exagerationGlobe
  const etat = { refus: 0, points: 0, globe: true, echelleBloc, echelleGlobe, meanM, rayon }

  // ② les deux sens de la conversion verticale, écrits une fois.
  const metresDe = (yBloc) => yBloc / echelleBloc + meanM
  const blocDe = (hM) => (hM - meanM) * echelleBloc

  etat.metresDe = metresDe
  etat.blocDe = blocDe

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
  const liste = globe.tuilesAvecHauteurs?.() ?? null
  if (!liste || !liste.length) return poseurPlat(sample)
  return creerPoseurGlobe({
    sample,
    hauteurM: (lat, lon) => globe.hauteurDessinee(lat, lon, liste),
    versLatLon: (x, z) => worldToLatLon(dem, x, z),
    echelleBloc,
    meanM: dem.meanM ?? 0,
    exagerationGlobe: globe.exaggeration ?? 1,
  })
}
