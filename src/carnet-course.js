// Le Carnet de course — résumé de lecture compact d'un parcours (position
// courante, pente locale, D+ qui reste à monter, prochain point de passage).
// Pur : aucune dépendance DOM/three.js — le rendu vit dans ui/carnet-course.js.
// Alimenté par le même index que GpxLayer.setHover (gpx.js), qu'il vienne
// d'un survol souris, du profil altimétrique, ou de la tête de lecture
// pendant un survol animé — le carnet ne sait pas d'où vient l'index.
//
// ⚠️ TOUT ICI TOURNE À 60 IM/S. carnetALaLigne() est appelé une fois par image
// de lecture (main.js, params.onHoverIndex). Une allocation ou un balayage
// linéaire écrit ici est multiplié par 60 chaque seconde : c'est la raison
// d'être de indexPourKm() (dichotomie au lieu de findIndex) et des bornes
// passées à ascentStats() au lieu d'un slice().

import { ascentStats } from './race-model.js'

// La portée de la bande de pente, EXPORTÉE parce que le libellé affiché
// (« +2 km ») en dépend : écrite en dur dans le rendu, elle devenait fausse
// en silence le jour où on changeait le défaut ici. Une seule source.
export const PORTEE_PENTES = 2

// Le même calcul de pente locale que GpxLayer.setHover (gpx.js l.1267-1271)
// — extrait ici pour être testable sans instancier toute la couche 3D.
export function penteLocale(cumKm, eles, i) {
  if (!cumKm?.length || !eles?.length) return 0
  const j = Math.min(i + 1, eles.length - 1)
  const k = Math.max(i - 1, 0)
  const dKm = cumKm[j] - cumKm[k]
  return dKm > 0 ? ((eles[j] - eles[k]) / (dKm * 1000)) * 100 : 0
}

// Classe une pente en paliers qualitatifs — pas de couleur ici, le rendu
// dérive sa propre teinte depuis la palette du relief affiché.
//
// ⚠️ 'inconnue' N'EST PAS DE LA COQUETTERIE. Un trou de tuile DEM ou un bord
// d'emprise rend NaN : `Math.abs(NaN) < 5` est faux, `< 10` aussi, on tombait
// donc dans le dernier `return` et une altitude MANQUANTE s'affichait
// « raide », en rouge vif, bande de pente comprise. Le coureur voyait un mur
// là où on n'a simplement pas la donnée. Répondre 'douce' mentirait dans
// l'autre sens ; un quatrième palier neutre ne ment ni d'un côté ni de
// l'autre (le CSS le laisse en encre atténuée, sans teinte).
export function classePente(gradePct) {
  if (!Number.isFinite(gradePct)) return 'inconnue'
  const g = Math.abs(gradePct)
  if (g < 5) return 'douce'
  if (g < 10) return 'soutenue'
  return 'raide'
}

// Premier index dont le cumul atteint `km`, par DICHOTOMIE. `cumKm` est trié
// par construction (c'est un cumul de distances positives), donc la recherche
// est en O(log n) au lieu du O(n) d'un findIndex qui repart de zéro. À dix
// appels par image sur une trace de 10 000 points, c'est 100 000 comparaisons
// par image économisées — la raison pour laquelle cette fonction existe.
export function indexPourKm(cumKm, km) {
  if (!cumKm?.length) return 0
  const dernier = cumKm.length - 1
  if (!(km > cumKm[0])) return 0
  if (km >= cumKm[dernier]) return dernier
  let lo = 0
  let hi = dernier
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (cumKm[mid] >= km) hi = mid
    else lo = mid + 1
  }
  return lo
}

// Le dernier point de passage franchi et le prochain à venir, pour un km de
// lecture donné. `waypoints` DOIT être trié par km croissant — le tri est
// fait une fois pour toutes dans syncRaceState() (main.js), pas ici : le
// refaire à chaque image sur une liste déjà triée serait du gâchis, et le
// supposer sans que personne ne le garantisse était un bug (le studio pousse
// les points dans l'ordre de saisie, pas de kilométrage).
export function pointsDePassage(waypoints, km) {
  const wp = Array.isArray(waypoints) ? waypoints : []
  let precedent = null
  let suivant = null
  for (const w of wp) {
    if (w.km <= km) precedent = w
    else { suivant = w; break }
  }
  return { precedent, suivant, kmAvantSuivant: suivant ? Math.max(0, suivant.km - km) : null }
}

// LA PREMIÈRE BARRIÈRE DEVANT — pas « la barrière du point suivant, s'il en
// a une ».
//
// ⚠️ C'ÉTAIT LA MÊME FAUTE DE FORME QUE LES PICTOS : « le X du prochain point »
// au lieu de « le prochain point qui a X ». `cutoff` est un champ LIBRE saisi
// point par point (ui/studio.js, race-model.js) : sur un trail réel, trois
// points sur douze portent une barrière. En ne regardant que le point
// immédiatement devant, le carnet démontait sa rangée Barrière pendant les
// 80 % du temps où le coureur a justement besoin de savoir combien de marge il
// lui reste — et l'en-tête du fichier de rendu jurait l'inverse (« LA BARRIÈRE
// HORAIRE → sa propre rangée »).
// `waypoints` est trié par km une fois pour toutes dans syncRaceState()
// (main.js) : la boucle sort au premier candidat, sur une liste de quelques
// dizaines d'entrées.
export function prochaineBarriere(waypoints, km) {
  const wp = Array.isArray(waypoints) ? waypoints : []
  for (const w of wp) if (w.km > km && w.cutoff) return w
  return null
}

// LA DURÉE QUI RESTE D'APRÈS LA TRACE — et c'est une SOUSTRACTION, pas une
// prédiction.
//
// ⚠️ CE N'EST PAS UN ETA, ET LE LIBELLÉ LE DIT. Le dépôt n'a toujours aucun
// modèle d'allure pour le coureur qui REGARDE (params.gpxFollowSpeed est une
// vitesse de caméra) : inventer « vous y serez dans 3 h 12 » serait un
// mensonge posé avec l'aplomb d'une mesure, exactement ce que entier() et
// signe1() ont été corrigés pour ne plus faire. En revanche la trace, elle,
// SAIT combien de temps elle a mis : `points[i].t` et `points[dernier].t` sont
// deux horodatages du fichier (parseGpx les conserve depuis le 2026-08-04, ils
// étaient jetés). La différence est exacte, sans moyenne glissante ni
// extrapolation — et une pause dans l'enregistrement en fait partie, ce qui
// est honnête puisqu'on annonce « d'après la trace » et rien d'autre.
// Un parcours dessiné à la main n'a pas de <time> : on rend null, l'affichage
// disparaît, personne ne lit un zéro déguisé en durée.
export function dureeRestante(points, i) {
  if (!points?.length) return null
  const idx = Math.max(0, Math.min(i, points.length - 1))
  const t0 = points[idx]?.t
  const t1 = points[points.length - 1]?.t
  if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 <= t0) return null
  return t1 - t0
}

// Ce qu'on trouvera AU PROCHAIN POINT — eau, ravito, dodo, secours.
//
// ⚠️ PLUS DE PORTÉE QUI MASQUE. Une première version n'annonçait les pictos
// qu'à moins de 3 km du point. Or entre deux ravitos espacés de 10 km — le
// cas normal en trail — savoir s'il y a de l'eau là-bas est exactement ce qui
// décide combien on boit MAINTENANT, c'est-à-dire pendant les 7 km où
// l'information était cachée. Les pictos sont donc toujours là ; seul un
// drapeau `loin` gradue l'annonce (le rendu l'atténue, il ne la supprime pas).
//
// ⚠️ ET PLUS DE PICTOS `franchi`. On empilait aussi ceux du point PRÉCÉDENT à
// chaque image, que le rendu filtrait ensuite systématiquement : construits
// soixante fois par seconde pour être jetés soixante fois par seconde.
// ⚠️ ET « PROCHAIN POINT » N'EST PAS « PROCHAIN RAVITO ». Le raisonnement
// ci-dessus (annoncer l'eau de loin, parce que c'est ce qui décide combien on
// boit maintenant) n'était servi qu'UN POINT À LA FOIS : si le point suivant
// est un col ou un point de vue et que le ravito est deux points plus loin, le
// panneau n'annonçait l'eau nulle part. Même faute de forme que la barrière —
// « le X du prochain point » au lieu de « le prochain point qui a X ».
// Cette liste est locale et pas importée de race-labels.js : ce module est
// PUR (race-labels.js tire three.js et une feuille .css, il est intestable en
// node). Elle est ordonnée par ce qu'un coureur cherche en premier.
const RAVITAILLEMENT = ['eau', 'ravito', 'repas', 'dodo']
export function prochainRavitaillement(waypoints, km) {
  const wp = Array.isArray(waypoints) ? waypoints : []
  for (const w of wp) {
    if (w.km <= km || !Array.isArray(w.pictos)) continue
    const cle = RAVITAILLEMENT.find((r) => w.pictos.includes(r))
    if (cle) return { picto: cle, km: w.km }
  }
  return null
}

export function pictosDuCarnet(waypoints, km, { seuilLoinKm = 3, points = null } = {}) {
  const { suivant, kmAvantSuivant } = points || pointsDePassage(waypoints, km)
  const loin = kmAvantSuivant > seuilLoinKm
  const out = (suivant?.pictos || []).map((p) => ({ picto: p, loin, km: null }))
  // le point suivant n'a pas d'eau : on va chercher le premier qui en a, et on
  // l'annonce AVEC SON KILOMÈTRE (sans ancrage, un picto emprunté à un autre
  // point mentirait sur le point affiché). `loin: true` par construction : ce
  // n'est pas le point suivant. Coût : une seconde boucle bornée, et seulement
  // dans ce cas-là.
  if (!out.some((p) => RAVITAILLEMENT.includes(p.picto))) {
    const r = prochainRavitaillement(waypoints, km)
    if (r) out.push({ picto: r.picto, loin: true, km: r.km })
  }
  return out
}

// LE D+ QUI RESTE À MONTER — jusqu'à l'arrivée, et jusqu'au prochain point —
// ET LE D− QUI RESTE À DESCENDRE jusqu'à l'arrivée.
//
// ⚠️ C'EST UN REMPLAÇANT, PAS UN AJOUT. Le carnet affichait le D+ ACCUMULÉ
// depuis le dernier point franchi : un rétroviseur. Ce chiffre ne change
// aucune décision en course — on ne redescend pas ce qu'on a monté. Ce qu'un
// coureur gère, c'est ce qui reste dans les jambes.
// `points` évite de recalculer pointsDePassage() : l'appelant l'a déjà.
//
// ⚠️ dMoinsRestant N'ÉTAIT PAS CALCULÉ DU TOUT — LA COLONNE AFFICHAIT UN
// SOMMET. « D− restant » promet une DESCENTE cumulée, pas l'altitude du point
// culminant qui reste à franchir (deux informations différentes : un sommet
// ne redescend jamais avec la position, un D− restant, si). ascentStats()
// rend dplus ET dminus dans le MÊME balayage — celui qui tournait déjà ici
// pour dplusRestant : dminus était calculé puis jeté. On ne fait donc pas un
// balayage de plus, on arrête d'en jeter un.
export function deniveleRestant(cumKm, eles, i, waypoints, points = null) {
  if (!cumKm?.length || !eles?.length) return { dplusRestant: 0, dplusProchain: null, dMoinsRestant: 0 }
  const idx = Math.max(0, Math.min(i, eles.length - 1))
  const { suivant } = points || pointsDePassage(waypoints, cumKm[idx] ?? 0)
  const { dplus, dminus } = ascentStats(eles, { debut: idx })
  const dplusProchain = suivant
    ? ascentStats(eles, { debut: idx, fin: indexPourKm(cumKm, suivant.km) }).dplus
    : null
  // même contrat d'affichage que dplusProchain, à l'envers : ce chiffre ne
  // sert QUE quand il n'y a pas de prochain point (voir carnetALaLigne, le
  // bloc « prochain point » et le bloc D−/Altitude s'excluent) — null dit
  // « pas la peine de regarder », pas « zéro mètre de descente ».
  const dMoinsRestant = suivant ? null : dminus
  return { dplusRestant: dplus, dplusProchain, dMoinsRestant }
}

// Bande de pente pour la puce visuelle du carnet — `n` segments égaux,
// chacun classé par sa pente moyenne. Segments hors piste (avant 0 ou après
// la fin) omis plutôt qu'inventés à plat.
//
// `versAvant` (le défaut du carnet) ne couvre QUE le terrain à venir,
// [km, km + porteeKm] : en course, ce qu'on a déjà monté ne se redescend
// pas, seul ce qui arrive change une allure. Centré (versAvant:false), la
// moitié gauche de la bande décrit du terrain déjà parcouru — joli, mais
// illisible sans repère « vous êtes ici ».
export function fenetreDePentes(cumKm, eles, km, { porteeKm = PORTEE_PENTES, segments = 5, versAvant = true } = {}) {
  if (!cumKm?.length || !eles?.length) return []
  const totalKm = cumKm[cumKm.length - 1]
  const debut = versAvant ? km : km - porteeKm / 2
  const pasKm = porteeKm / segments
  const out = []
  for (let s = 0; s < segments; s++) {
    const a = debut + s * pasKm
    const b = a + pasKm
    if (b < 0 || a > totalKm) continue
    // dichotomie, pas findIndex : deux balayages complets de cumKm par segment
    // × 5 segments = dix parcours de tableau par image dans la version d'avant
    const i0 = indexPourKm(cumKm, Math.max(0, a))
    const i1 = indexPourKm(cumKm, Math.min(totalKm, b))
    out.push({ classe: classePente(penteLocale(cumKm, eles, Math.round((i0 + i1) / 2))) })
  }
  return out
}

// Le résumé du parcours ENTIER — les « chiffres de la course », ceux qu'on
// lit une fois en arrivant sur la barre, pas ceux qui défilent. Séparé du
// carnet (qui, lui, suit la tête de lecture) parce que ça ne bouge jamais :
// une fois la trace chargée, c'est figé.
export function resumeParcours(cumKm, eles) {
  if (!cumKm?.length || !eles?.length) return null
  const { dplus, dminus } = ascentStats(eles)
  let altMin = Infinity
  let altMax = -Infinity
  // pas de Math.min(...eles) : une trace de 2 400 points passe encore, mais
  // l'étalement d'arguments casse la pile bien avant les traces qu'on veut
  // pouvoir charger un jour
  for (const e of eles) {
    if (e < altMin) altMin = e
    if (e > altMax) altMax = e
  }
  return {
    km: cumKm[cumKm.length - 1] || 0,
    dplus,
    dminus,
    altMin: Math.round(altMin),
    altMax: Math.round(altMax),
  }
}

// Assemble tout ce qu'affiche le carnet pour un index de lecture donné.
// pointsDePassage() est calculé UNE fois et passé aux deux fonctions qui en
// ont besoin : il l'était trois fois par appel, donc cent quatre-vingts fois
// par seconde, pour un résultat identique.
// `trkPoints` est le tableau BRUT de la trace (track.points) : on n'en lit que
// l'horodatage, et on le passe par référence — le mapper en un tableau de
// timestamps ici allouerait soixante tableaux par seconde.
export function carnetALaLigne({ cumKm, eles, waypoints = [], trkPoints = null }, i) {
  if (!cumKm?.length || !eles?.length) return null
  const idx = Math.max(0, Math.min(i, cumKm.length - 1))
  const km = cumKm[idx]
  const total = cumKm[cumKm.length - 1] || 0
  const pente = penteLocale(cumKm, eles, idx)
  const points = pointsDePassage(waypoints, km)
  const { precedent, suivant, kmAvantSuivant } = points
  const barriere = prochaineBarriere(waypoints, km)
  return {
    km,
    // LA question du coureur, celle qu'il se pose tous les kilomètres. Elle
    // n'était nulle part : c'est désormais le gros chiffre du carnet.
    restant: Math.max(0, total - km),
    alt: Math.round(eles[idx]),
    pente,
    // ⚠️ PAS DE `penteClasse` ICI. Il était calculé à chaque image puis jeté :
    // le rendu colore sa bande depuis `fenetrePentes[].classe` et la phrase
    // lue n'utilise que `pente`. classePente() reste appelée par
    // fenetreDePentes(), c'est-à-dire au seul endroit qui la consomme.
    // ⚠️ DISTINGUE « pas de points de passage » DE « tous franchis ».
    // `pointSuivant` vaut null dans les deux cas, et le rendu les confondait :
    // sur un GPX brut sans <wpt> — le cas le PLUS courant — le carnet
    // annonçait « Prochain / Arrivée » du km 0 au km 42 pendant que le gros
    // chiffre d'à côté disait « 42,0 km restants ».
    aDesPoints: Array.isArray(waypoints) && waypoints.length > 0,
    pointActuel: precedent?.name || null,
    pointSuivant: suivant?.name || null,
    // ⚠️ L'EXISTENCE DU POINT, PAS SON NOM. Tout le bloc du bas était piloté
    // par `pointSuivant` — c'est-à-dire par le NOM. Or parseRace() accepte
    // `name: String(w.name || '')` et le studio CRÉE les points avec un nom
    // vide (`waypoints.push({ km: 0, name: '', … })`) : un point sans nom mais
    // avec une barrière effaçait le bloc entier, pictos compris, pendant que
    // le cartouche 3D du MÊME point affichait sa barrière. Deux vérités
    // contradictoires sur le même écran.
    aPointSuivant: !!suivant,
    // La BARRIÈRE HORAIRE : la seule donnée temporelle SAISIE de tout le
    // modèle. On la transporte telle quelle — c'est une chaîne libre
    // (« 12h30 », « J+1 04:00 »), on ne la parse pas, on la recopie.
    // `cutoffSuivant` = celle du point IMMÉDIATEMENT devant (elle seule décide
    // de l'alerte rouge, voir textesDuCarnet) ; `cutoffProchain` = la première
    // devant, quel que soit le point qui la porte (voir prochaineBarriere).
    cutoffSuivant: suivant?.cutoff || null,
    cutoffProchain: barriere?.cutoff || null,
    kmBarriere: barriere ? barriere.km : null,
    kmAvantCutoff: barriere ? Math.max(0, barriere.km - km) : null,
    altSuivant: suivant?.alt ?? null,
    kmAvantSuivant,
    // la durée que la TRACE a mis d'ici à l'arrivée — voir dureeRestante()
    dureeRestante: dureeRestante(trkPoints, idx),
    // dMoinsRestant (dans le spread ci-dessous) remplace l'altitude COURANTE
    // dans la colonne de droite quand il n'y a pas de prochain point — voir
    // deniveleRestant() pour le pourquoi et pour pourquoi ce chiffre ne coûte
    // rien de plus qu'un balayage déjà en cours.
    ...deniveleRestant(cumKm, eles, idx, waypoints, points),
    pictos: pictosDuCarnet(waypoints, km, { points }),
    fenetrePentes: fenetreDePentes(cumKm, eles, km),
  }
}

// ---------------------------------------------------------------- le texte
// CE QUE LE CARNET ÉCRIT, décidé ici et pas dans le DOM.
//
// Deux raisons, et la seconde est une leçon payée cher :
//   1. c'est testable sans navigateur (test/course-bar.test.js) — le choix
//      des mots selon l'état est de la règle, pas de la mise en page ;
//   2. le rendu ne manipule plus que des CHAÎNES posées par textContent. Le
//      carnet interpolait `c.pointActuel` dans un innerHTML — un nom de point
//      de passage vient d'un <wpt><name> de GPX ou du payload d'un lien /r/,
//      que n'importe qui peut publier (voir le commentaire de share-link.js :
//      « anyone can POST to the publish endpoint »). Un point nommé
//      `<img src=x onerror=…>` s'exécutait dans la page. Le texte ne
//      s'échappe pas : il ne devient jamais du HTML.
// ⚠️ LES FORMATEURS SONT HISSÉS, ET C'EST LA MÊME LEÇON QUE LE DOM PAR
// DIFFÉRENCE. textesDuCarnet() est appelé sans condition par update(), donc
// SOIXANTE FOIS PAR SECONDE, et il fabriquait cinq à sept
// `Number.prototype.toLocaleString('fr-FR', {…})` par appel — chacun résolvant
// un Intl.NumberFormat neuf, c'est-à-dire la partie chère. L'écriture par
// différence protégeait le DOM (le vrai gain) et laissait passer tout le
// formatage. Un objet Intl par gabarit, construit une fois : la sortie est
// identique au caractère près, donc les tests existants verrouillent la
// refonte.
const FMT1 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const FMT0 = new Intl.NumberFormat('fr-FR')
const km1 = (v) => FMT1.format(Number.isFinite(v) ? v : 0)
// ⚠️ « PAS DE DONNÉE » N'EST PAS « ZÉRO ». Ces deux formateurs rendaient 0
// pour tout ce qui n'était pas fini : une altitude manquante s'affichait
// « 0 m » et une pente manquante « +0,0 % », c'est-à-dire un mensonge plat
// posé avec l'aplomb d'une mesure. classePente() a déjà son palier 'inconnue'
// et le CSS le rend en encre atténuée : le chemin honnête existait, il n'était
// simplement pas alimenté côté texte. Un tiret cadratin ne se lit pas comme un
// nombre, ni à l'œil ni au lecteur d'écran.
const TIRET = '—'
const entier = (v) => (Number.isFinite(v) ? FMT0.format(Math.round(v)) : TIRET)
// ⚠️ les chiffres arrivent LISSÉS, donc en flottant (365.4958428002… au lieu
// de 365) : les formater sans arrondir a produit un débordement en production
// le 2026-08-04. Un chiffre affiché est un chiffre arrondi, sans exception.
const signe1 = (v) => {
  if (!Number.isFinite(v)) return TIRET
  return `${v >= 0 ? '+' : '−'}${FMT1.format(Math.abs(v))}`
}
// une durée se lit « 3 h 12 », pas « 192 min » ni « 3.2 h ». Sous l'heure, les
// minutes seules : un coureur à 40 min de l'arrivée ne veut pas lire « 0 h 40 ».
const dureeTexte = (ms) => {
  if (!Number.isFinite(ms) || ms <= 0) return ''
  const min = Math.round(ms / 60000)
  if (min < 60) return `${min} min`
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`
}
// ⚠️ LA BARRIÈRE EST DU TEXTE LIBRE TIERS, ET ELLE ATTERRIT DANS UNE BOÎTE À
// LARGEUR CONTRAINTE. `cutoff: String(w.cutoff || '')` n'impose aucune
// longueur (race-model.js) et le studio l'expose en <input> libre : une
// barrière saisie « dim. 12h30 (stricte) » se faisait trancher AU GLYPHE par
// l'overflow du panneau et se lisait « dim. 12h30 (str » — une heure qui a
// l'air valide et qui ne l'est pas, c'est-à-dire la « faute visuelle
// terminale » que .cb-title documente pour les chiffres de la tête. On borne
// à la source ; le CSS ajoute l'ellipse comme filet.
const MAX_CUTOFF = 14

// le repli quand un point de passage n'a PAS de nom — le studio en crée ainsi
// (`waypoints.push({ km: 0, name: '', … })`) et rien n'oblige l'organisateur à
// le remplir. Un libellé neutre et vrai vaut mieux qu'un bloc effacé : le point
// existe, sa distance et sa barrière sont connues, c'est son nom qui manque.
const POINT_SANS_NOM = 'Point de passage'

export function textesDuCarnet(c) {
  if (!c) return null
  // ⚠️ L'EXISTENCE DU POINT, PAS SON NOM — voir `aPointSuivant` dans
  // carnetALaLigne(). Le `|| !!c.pointSuivant` couvre les appelants qui
  // fabriquent un état à la main (tests) sans passer par carnetALaLigne.
  const aSuivant = !!(c.aPointSuivant || c.pointSuivant)
  // « depuis » : le point QUITTÉ. Il a perdu la vedette (il était en 13,5 px
  // gras en tête de panneau, plus gros que le point à venir) — ce qu'on vient
  // de quitter ne règle plus ni l'allure ni la gestion d'eau.
  let depuis = ''
  if (c.aDesPoints) depuis = c.pointActuel ? `depuis ${c.pointActuel}` : 'depuis le départ'

  // Sous-ligne du prochain point : la distance, puis UN SEUL complément.
  //
  // ⚠️ LA BARRIÈRE N'EST PLUS EN CONCURRENCE ICI, ET C'EST LE POINT DE LA
  // RÉVISION. Elle passait en PREMIÈRE priorité d'une chaîne `if/else if`, ce
  // qui supprimait le D+ jusqu'au prochain point EXACTEMENT quand il sert le
  // plus : dès qu'un organisateur a saisi des barrières — le cas produit visé
  // par Race Studio — le coureur lisait « Col de Test — dans 5,4 km · barrière
  // 12h30 » sans jamais apprendre que ces 5,4 km contiennent 700 m de montée.
  // Or c'est le COUPLE (distance, dénivelé) qui dit si la barrière est
  // tenable : seule, elle n'est pas actionnable. Et le chiffre était déjà
  // calculé à chaque image (deniveleRestant → ascentStats) puis jeté.
  // La barrière a donc sa propre rangée dans la colonne de droite (champ
  // `barriere` ci-dessous) : plus de concurrence, plus de règle à contourner,
  // et la sous-ligne garde UNE seule ligne — la contrainte de hauteur fixe et
  // d'`overflow: hidden` reste respectée (incident du 2026-08-04, rangée
  // coupée en deux).
  const duree = dureeTexte(c.dureeRestante)

  const bits = []
  if (aSuivant) {
    bits.push(`dans ${km1(c.kmAvantSuivant)} km`)
    if (Number.isFinite(c.dplusProchain) && c.dplusProchain > 0) bits.push(`+${entier(c.dplusProchain)} m`)
    else if (Number.isFinite(c.altSuivant)) bits.push(`${entier(c.altSuivant)} m`)
  }

  return {
    depuis,
    km: `km ${km1(c.km)}`,
    restant: km1(c.restant),
    pente: signe1(c.pente),
    // la durée que la TRACE met d'ici à l'arrivée, dite avec sa source dans le
    // même souffle. Sans « sur la trace », un coureur lirait un ETA personnel
    // que rien dans le modèle ne permet de calculer (voir dureeRestante()).
    duree: duree ? `${duree} sur la trace` : '',
    dplusRestant: entier(c.dplusRestant),
    alt: entier(c.alt),
    // LE D− RESTANT — mètres de descente cumulée jusqu'à l'arrivée, qui
    // remplace l'altitude courante partout où la pastille du profil dit déjà
    // celle-ci (voir carnet-course.css). Pas de signe ici : comme dplusRestant
    // (« D+ »), c'est le LIBELLÉ qui porte le signe, la valeur reste une
    // magnitude — un « D− −70 m » doublerait le signe pour rien.
    dMoinsRestant: entier(c.dMoinsRestant),
    aDMoinsRestant: Number.isFinite(c.dMoinsRestant),
    // ⚠️ LA BARRIÈRE A SA PROPRE RANGÉE. C'est la seule donnée de tout le
    // modèle qui puisse mettre un coureur HORS COURSE, et elle était le plus
    // petit et le plus pâle texte du panneau : 11 px, mono, encre atténuée,
    // derrière un « · » dans la sous-ligne du prochain point. L'ordre des
    // tailles disait donc l'inverse de l'ordre d'importance (demandes 6 et 9
    // d'Adrien). Elle monte au même palier que le D+ restant, avec la teinte
    // d'alerte du système (--cc-raide).
    // ⚠️ ET C'EST LA PREMIÈRE BARRIÈRE DEVANT, PAS CELLE DU POINT SUIVANT.
    // Voir prochaineBarriere() : la rangée était démontée les 80 % du temps où
    // le coureur a justement besoin de savoir combien de marge il lui reste.
    // Elle ne dépend PLUS du nom du point ni même du point suivant : une
    // barrière trois points plus loin s'affiche, avec son ancrage.
    barriere: c.cutoffProchain ? String(c.cutoffProchain).slice(0, MAX_CUTOFF) : '',
    // ⚠️ UNE HEURE SANS LIEU NE DÉSIGNE RIEN. « BARRIÈRE 12h30 » seul laissait
    // croire que la limite tombe au point suivant ; elle peut être trois points
    // plus loin. L'ancrage tient dans le suffixe d'unité de la rangée (mono
    // 11 px), donc sans une ligne de plus dans un budget de hauteur qui n'en a
    // pas.
    barriereOu: c.cutoffProchain && Number.isFinite(c.kmBarriere) ? `km ${entier(c.kmBarriere)}` : '',
    aBarriere: !!c.cutoffProchain,
    // ⚠️ L'ALERTE EST UN ÉTAT, PAS UNE COLONNE. La teinte --cc-raide était
    // posée dès qu'un cutoff EXISTAIT : un rouge toujours rouge n'est pas une
    // alerte, c'est une couleur de rangée — et c'était la seule teinte
    // sémantique du panneau, dépensée sur un état qui ne variait jamais. Elle
    // ne s'allume donc que quand la barrière est portée par le point
    // IMMÉDIATEMENT suivant ; plus loin sur le parcours, encre pleine.
    barriereImminente: !!(c.cutoffSuivant && c.cutoffProchain),
    // aSuivant décide de TOUT le bloc du bas : un prochain point, ou — quand
    // il n'y en a pas (trace sans points de passage, ou dernier déjà franchi)
    // — l'altitude courante. Pas un « Arrivée » de remplissage qui contredit
    // le gros chiffre « X km restants » juste à côté.
    aSuivant,
    prochainNom: aSuivant ? (c.pointSuivant || POINT_SANS_NOM) : '',
    prochainSous: bits.join(' · '),
    portee: `+${PORTEE_PENTES} km`,
  }
}

// Le résumé lu à voix haute par les lecteurs d'écran. Volontairement une
// PHRASE, pas une liste de nombres : elle est annoncée ENTIÈRE, et donc
// rarement — ~8 s, le temps réel qu'une synthèse vocale met à la dire, et
// seulement si elle a CHANGÉ (voir le bridage dans ui/carnet-course.js). Le
// bridage d'avant, à 1,2 s, réécrivait la région six fois plus vite qu'elle ne
// se lit : la file d'annonces ne se vidait jamais, on n'entendait que des
// débuts de phrase, et plus AUCUNE autre annonce de la page ne passait.
export function phraseDuCarnet(c) {
  if (!c) return ''
  const t = textesDuCarnet(c)
  // le signe est un caractère (« + », « − » U+2212) : lu tel quel, un lecteur
  // d'écran dit « tiret » ou ne dit rien du tout. On le met en toutes lettres.
  const pente = t.pente === TIRET
    ? null
    : t.pente.replace('−', 'moins ').replace('+', 'plus ')
  // ⚠️ LA VOIX SUIT LA MÊME HIÉRARCHIE QUE L'ŒIL. La pente était énoncée en
  // DEUXIÈME, avant le prochain point et avant la barrière, alors que
  // l'en-tête de ui/carnet-course.js la classe cinquième — et que la bande, à
  // l'écran, est passée sous le chiffre héros pour la même raison. Un ordre
  // d'énonciation est un ordre d'importance : deux ordres contradictoires pour
  // la même donnée, c'est l'un des deux qui ment.
  const bouts = [`${t.restant} kilomètres restants`]
  if (t.duree) bouts.push(t.duree)
  if (t.aSuivant) bouts.push(`${t.prochainNom} ${t.prochainSous}`)
  // ⚠️ LA PHRASE NE SUIT PAS LA MEDIA QUERY. À l'écran, la colonne montre le
  // D− restant au-dessus de 680 px et l'altitude courante en dessous (la
  // pastille du profil porte déjà celle-ci quand le profil est là). Ici on dit
  // TOUJOURS le D− restant : une annonce qui changerait de sens selon la
  // largeur de fenêtre serait une information différente pour la même page, et
  // l'altitude courante n'aide personne à décider quoi que ce soit.
  else if (t.aDMoinsRestant) bouts.push(`dénivelé négatif restant ${t.dMoinsRestant} mètres`)
  else bouts.push(`altitude ${t.alt} mètres`)
  bouts.push(pente ? `pente ${pente} pour cent` : 'pente inconnue')
  // la barrière est énoncée EN DERNIER et en toutes lettres : c'est la seule
  // information de la phrase qui peut mettre hors course, elle ne doit pas
  // arriver noyée au milieu d'une énumération de distances. Son ANCRAGE part
  // avec elle : « barrière horaire 12h30 au km 42 » — sans le lieu, un lecteur
  // d'écran reçoit une heure qui ne désigne rien.
  if (t.aBarriere) bouts.push(`barrière horaire ${t.barriere}${t.barriereOu ? ` au ${t.barriereOu}` : ''}`)
  return bouts.join(', ')
}

// L'étiquette de la bande de pente — DYNAMIQUE. Elle portait un aria-label
// figé (« Pente des 2 prochains kilomètres ») qui décrivait la bande sans
// jamais dire ce qu'elle MONTRE : un utilisateur non-voyant recevait le
// libellé et aucune donnée.
export function libelleFenetrePentes(fenetre) {
  const segs = fenetre || []
  if (!segs.length) return `Pente des ${PORTEE_PENTES} prochains kilomètres : hors parcours`
  return `Pente des ${PORTEE_PENTES} prochains kilomètres : ${segs.map((s) => s.classe).join(', ')}`
}
