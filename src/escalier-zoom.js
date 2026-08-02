// L'ESCALIER DE ZOOM — les règles de navigation, sans caméra, sans DOM, sans
// three.js. Tout ce qui se calcule ici est vérifiable sous node
// (test/escalier-zoom.test.js) ; modes.js et main.js n'en font plus que la
// plomberie. Même ton que fenetre-reglage.js et palier-machine.js : la RÈGLE
// vit dans un module pur, le câblage vit là où sont les objets.
//
// Trois questions y sont tranchées, et ce sont les trois qu'Adrien a posées :
//   1. jusqu'où l'escalier descend (les paliers trop larges n'existent plus) ;
//   2. où tombe un clic sur le globe (le point EXACT, pas le centre de l'écran) ;
//   3. où la caméra vise en arrivant (« mon point reste au centre »).

// ══════════ 1. LE PLANCHER DE L'ESCALIER ════════════════════════════════════
//
// Adrien, mot pour mot : « Z1 et Z2 ne doivent pas exister. […] J'arrive en Z3. »
// Sa capture montre le palier le plus large de l'ancien escalier : un bloc de
// 3 tuiles à z4, soit 67° de longitude — la mer noie tout, les continents ne
// sont plus que des taches. Un niveau qui ne dit rien.
//
// SA NUMÉROTATION EST CELLE DES PALIERS, PAS CELLE DES ZOOMS MERCATOR. L'ancien
// escalier commençait à z4 : son Z1 est notre z4, son Z2 notre z5, son Z3 notre
// z6, et « Z4 > Z5 > Z6… » sont z7, z8, z9. C'est la seule lecture qui rende ses
// quatre phrases vraies ensemble — supprimer deux paliers, arriver au troisième
// depuis l'orbite, puis avancer d'un cran à la fois.
//
// ⚠️ SI CETTE LECTURE EST FAUSSE, UN SEUL NOMBRE EST À CHANGER — celui-ci. Rien
// d'autre dans le moteur ne connaît le plancher : ni modes.js, ni main.js, ni
// les paliers de plongée, qui se filtrent tous à partir d'ici.
//
// z6 en 3 tuiles couvre ~17° de longitude, à peu près la France plus ses
// voisins : un pays reste un pays, pas une tache.
export const ZOOM_PALIER_MIN = 6

// Le plafond, lui, n'a pas bougé : c'est le zoom fin choisi par l'utilisateur,
// jamais moins de 12 (en dessous, « fin » ne veut plus rien dire).
export function bornesEscalier(zoomFin, min = ZOOM_PALIER_MIN) {
  const max = Math.max(Number.isFinite(zoomFin) ? zoomFin : 12, 12)
  return { min, max: Math.max(min, max) }
}

// UN palier à la fois, dans les deux sens — c'est le « zoom progressif unitaire »
// d'Adrien, et la symétrie est la moitié de la demande : « dézoome unitaire
// pareil, mais en sens inverse si je remonte ». Un aller-retour doit revenir
// exactement au cadrage qu'on venait de quitter.
//
// ⚠️ MONTER RAMÈNE AU PLANCHER, ET CE N'EST PAS DE LA COQUETTERIE. Un lien de
// partage fabriqué avant ce changement porte un z4 ou un z5 ; sans ce
// `Math.max`, le premier cran de zoom depuis un tel lien atterrirait sur un
// palier qu'on vient justement de supprimer.
export function pasEscalier(zoom, dir, zoomFin = 12, min = ZOOM_PALIER_MIN) {
  const b = bornesEscalier(zoomFin, min)
  // pas de zoom courant lisible : on rend le plancher, pas « le plancher plus
  // un ». Inventer un palier à partir d'un NaN, c'est faire croire à un état
  // qui n'a jamais existé.
  if (!Number.isFinite(zoom)) return b.min
  const z = Math.round(zoom)
  if (dir > 0) return Math.min(Math.max(z + 1, b.min), b.max)
  return Math.max(z - 1, b.min)
}

// Les paliers de plongée depuis l'orbite, amputés de ceux qu'on vient de
// supprimer. Le palier de zoom `null` est le zoom FIN de l'utilisateur : il n'a
// pas de niveau propre et ne se filtre donc jamais.
export function paliersRetenus(paliers, min = ZOOM_PALIER_MIN) {
  return (paliers ?? []).filter((p) => p?.zoom == null || p.zoom >= min)
}

// Où atterrit un clic sur le globe. Le palier de l'altitude courante quand elle
// en désigne un — celui qui a déjà été réglé au cran de molette près — et sinon
// le PLUS LARGE QUI RESTE.
//
// ⚠️ CE `??` EST TOUT LE « J'ARRIVE EN Z3 ». Depuis que les deux paliers larges
// n'existent plus, la porte orbitale s'ouvre au-dessus de 1 600 km : en orbite
// haute, aucun palier ne correspond à l'altitude. Sans ce repli, cliquer sur le
// globe depuis là où on le regarde vraiment ne ferait rien du tout.
export function palierDeClic(paliers, altM) {
  const liste = paliers ?? []
  return liste.find((p) => altM < p.altM) ?? liste[liste.length - 1] ?? null
}

// ══════════ 2. LE POINT EXACTEMENT SOUS LE DOIGT ════════════════════════════
//
// Adrien : « cliquer me fait zoomer sur la zone sur laquelle je clique,
// exactement à l'endroit où j'ai cliqué ». Le globe est une sphère centrée sur
// l'origine : un rayon la coupe, ou il passe à côté. Rien de plus.
//
// ⚠️ ON REND LA RACINE LA PLUS PROCHE, JAMAIS L'AUTRE. Les deux existent dès
// qu'on vise la planète, et la seconde est le point ANTIPODE — cliquer sur
// l'Europe aurait plongé en Nouvelle-Zélande, une fois sur deux, sans le moindre
// message d'erreur pour l'expliquer.
//
// `origine` et `direction` sont des {x, y, z} nus (le rayon de three.js en
// fournit deux tels quels). La direction est normalisée ici : un appelant qui
// l'oublie aurait une distance juste et un point faux.
export function intersectionGlobe(origine, direction, rayon) {
  if (!origine || !direction || !(rayon > 0)) return null
  const n = Math.hypot(direction.x, direction.y, direction.z)
  if (!(n > 0)) return null
  const dx = direction.x / n, dy = direction.y / n, dz = direction.z / n
  const b = origine.x * dx + origine.y * dy + origine.z * dz
  const c = origine.x ** 2 + origine.y ** 2 + origine.z ** 2 - rayon ** 2
  const disc = b * b - c
  if (disc < 0) return null // le rayon passe à côté de la planète (clic dans le noir)
  const racine = Math.sqrt(disc)
  let t = -b - racine
  if (t < 0) t = -b + racine // caméra à l'intérieur de la sphère
  if (t < 0) return null // la planète est DERRIÈRE la caméra
  return { x: origine.x + dx * t, y: origine.y + dy * t, z: origine.z + dz * t }
}

// ══════════ 3. « MON POINT RESTE AU CENTRE » ════════════════════════════════
//
// Adrien : « Si je dézoome, je garde mon précédent point de vision central au
// centre du dézoome. » Ce n'était pas le cas, et le défaut se COMPOSAIT : mesuré
// au navigateur avant correction, sept crans de dézoome depuis La Réunion
// déplaçaient le centre de (-21,25 ; 55,77) à (-16,64 ; 50,63) — plus de 700 km
// de dérive pour un utilisateur qui n'avait pas touché la caméra.
//
// LA CAUSE EST CELLE DÉJÀ DOCUMENTÉE DANS main.js AUTOUR DE `f3CentreSur` : le
// bloc se cale sur la GRILLE DE TUILES (deux `Math.floor` dans dem.js), donc le
// lieu demandé tombe quelque part DANS la tuile centrale, jamais en son centre —
// jusqu'à 9,33 unités d'écart sur un socle de 56, un sixième du côté.
//
// Mais le décentrage seul ne dériverait pas : il se REJOUERAIT à l'identique. Ce
// qui l'accumulait, c'est que la caméra arrivait en visant le centre GÉOMÉTRIQUE
// du bloc (0, 0), et que le cran suivant relisait un lat/lon sous cette visée —
// c'est-à-dire le centre SNAPPÉ, et non le lieu qu'on avait demandé. Chaque cran
// repartait donc d'un point qu'on n'avait jamais choisi.
//
// LA CORRECTION EST ICI, ET ELLE SUPPRIME LA DÉRIVE AU LIEU DE LA COMPENSER :
// la caméra vise la position monde du lieu DEMANDÉ. Deux conséquences, et la
// seconde vaut plus que la première :
//   — à l'écran, le point cliqué est au centre de la vue, ce qu'Adrien demande ;
//   — au tour suivant, `worldToLatLon(visée)` rend EXACTEMENT le lat/lon de
//     départ (c'est l'inverse exact de `latLonToWorld`, verrouillé par
//     test/fenetre-centrage.test.js). Plus rien à mémoriser, plus rien à
//     recaler : le report du centre devient une identité.
//
// Le socle, lui, se retrouve décadré d'au plus 9,33 unités dans un cadrage qui
// en montre 145 : il tient largement, on ne perd aucun bord.
//
// `monde` est en coordonnées de GÉOMÉTRIE (fenêtre continue déjà retranchée par
// l'appelant, cf. `viseeAuSol` qui fait l'addition dans l'autre sens).
export function viseeArrivee(monde, demiSocle, marge = 0) {
  const lim = Math.max(0, (demiSocle || 0) - marge)
  return { x: borne(monde?.x, lim), z: borne(monde?.z, lim) }
}

const borne = (v, lim) => (Number.isFinite(v) ? Math.min(lim, Math.max(-lim, v)) : 0)
