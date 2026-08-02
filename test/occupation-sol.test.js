import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import zlib from 'node:zlib'
import {
  urlTuileSol, zoomSolBorne, SOL_ZOOM_MAX, SOL_ATTRIBUTION, SOL_LICENCE,
  CLASSES_SOL, CODES_SOL, familleDeClasse, forceDeClasse, couleurDeClasse,
  tableLutSol, zoneSolPour, normaliseIndexSol,
} from '../src/occupation-sol.js'
import { nomDalle, encodePngGris, rasteriseTerre, tuileAvecTerre } from '../scripts/build-occupation-sol.mjs'

// ── Les codes de classes ────────────────────────────────────────────────────

test('les onze classes WorldCover sont là, et rien d’autre', () => {
  // La liste est un CONTRAT avec la donnée cuite : un code en trop rendrait une
  // entrée de table de couleurs que personne n'atteint, un code en moins
  // laisserait des pixels de la tuile sans couleur — et ceux-là seraient
  // silencieusement peints avec la force zéro, donc invisibles sans erreur.
  assert.deepEqual(CODES_SOL, [10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 100])
  assert.equal(CLASSES_SOL.length, 11)
})

test('95 est la mangrove et 100 les mousses — l’ordre n’est pas décimal', () => {
  // Le piège d'inattention : 95 s'intercale entre 90 et 100, et une liste
  // triée « à l'œil » le pousse souvent à la fin.
  assert.equal(CLASSES_SOL.find((c) => c.code === 95).nom, 'Mangrove')
  assert.match(CLASSES_SOL.find((c) => c.code === 100).nom, /ousses/)
})

test('un code inconnu ne rend jamais une classe inventée', () => {
  // 45, c'est la moyenne de 10 (arbres) et 80 (eau) : LA valeur que
  // l'interpolation d'un code de classe fabrique. Elle ne doit correspondre à
  // rien, et surtout pas retomber sur une classe voisine par arrondi.
  assert.equal(familleDeClasse(45), null)
  assert.equal(forceDeClasse(45), 0)
  assert.equal(familleDeClasse(0), null)
  assert.equal(forceDeClasse(0), 0)
  assert.equal(familleDeClasse(NaN), null)
  assert.equal(forceDeClasse(255), 0)
})

// ── Les familles, et la direction graphique qu’elles portent ────────────────

test('les familles regroupent les onze classes en six lectures', () => {
  assert.equal(familleDeClasse(10), 'boise')
  assert.equal(familleDeClasse(20), 'boise')
  assert.equal(familleDeClasse(95), 'boise') // la mangrove EST du boisé
  assert.equal(familleDeClasse(30), 'ouvert')
  assert.equal(familleDeClasse(40), 'ouvert')
  assert.equal(familleDeClasse(50), 'bati')
  assert.equal(familleDeClasse(60), 'mineral')
  assert.equal(familleDeClasse(100), 'mineral')
  assert.equal(familleDeClasse(70), 'gele')
  assert.equal(familleDeClasse(80), 'humide')
  assert.equal(familleDeClasse(90), 'humide')
})

test('l’EAU est à force ZÉRO — ShibuMap la dessine déjà, et mieux', () => {
  // C'est la décision la plus lourde de la couche, et la seule qu'un
  // rafraîchissement distrait pourrait défaire sans que rien ne casse : la
  // carte se mettrait alors à peindre une eau de 10 m PAR-DESSUS ses propres
  // masques d'eau (water-tiles, lake-tiles, le masque de mer), qui sont
  // vectoriels et bien plus fins. Deux rivages à un pixel l'un de l'autre.
  assert.equal(forceDeClasse(80), 0)
  // La zone humide HERBACÉE, elle, n'est dessinée nulle part ailleurs : elle
  // garde donc sa voix.
  assert.ok(forceDeClasse(90) > 0)
})

test('le boisé et le gelé parlent fort, l’ouvert chuchote', () => {
  // L'argument éditorial, transformé en assertion : une carte calme ne peut pas
  // couvrir d'un aplat les prairies et les cultures, qui sont l'essentiel du
  // monde habité. La forêt et la glace, elles, sont des FORMES, et elles ont le
  // droit de se voir.
  assert.ok(forceDeClasse(10) > 0.7)
  assert.ok(forceDeClasse(70) > 0.7)
  assert.ok(forceDeClasse(30) < 0.25)
  assert.ok(forceDeClasse(40) < 0.25)
  assert.ok(forceDeClasse(30) < forceDeClasse(50))
})

test('aucune classe ne dépasse la force pleine', () => {
  for (const c of CLASSES_SOL) {
    assert.ok(c.force >= 0 && c.force <= 1, `${c.code} → ${c.force}`)
  }
})

// ── La table de couleurs ────────────────────────────────────────────────────

test('la table couvre les 256 octets possibles, pas seulement les 11 classes', () => {
  // La texture est indexée par l'OCTET lu dans la tuile. Une table plus courte
  // laisserait le GPU lire hors du tampon sur un octet corrompu.
  const lut = tableLutSol()
  assert.equal(lut.length, 256 * 4)
})

test('la table met l’alpha à zéro partout où il n’y a pas de classe', () => {
  // L'alpha PORTE LA FORCE : un trou de donnée (code 0) doit donc peser
  // exactement rien, sans qu'aucune condition n'ait à le vérifier dans le
  // nuanceur.
  const lut = tableLutSol()
  assert.equal(lut[0 * 4 + 3], 0)
  assert.equal(lut[45 * 4 + 3], 0)
  assert.equal(lut[255 * 4 + 3], 0)
  assert.equal(lut[80 * 4 + 3], 0, "l'eau aussi pèse zéro")
  assert.ok(lut[10 * 4 + 3] > 150, 'les arbres pèsent')
})

test('la table place chaque couleur À L’INDEX DU CODE, pas au rang de la classe', () => {
  // Le piège : ranger les 11 couleurs de 0 à 10 et indexer la texture par
  // `rang / 255`. Ça compile, ça s'affiche, et toute la carte est fausse d'une
  // classe. On vérifie donc l'adresse, pas seulement le contenu.
  const lut = tableLutSol()
  const gele = couleurDeClasse(70)
  assert.deepEqual([lut[70 * 4], lut[70 * 4 + 1], lut[70 * 4 + 2]], gele)
  const boise = couleurDeClasse(10)
  assert.deepEqual([lut[10 * 4], lut[10 * 4 + 1], lut[10 * 4 + 2]], boise)
})

test('le gelé est clair et le boisé sombre — sinon le relief se retourne', () => {
  // Une neige plus sombre que la forêt ne serait pas « une autre palette »,
  // ce serait une carte qu'on lit à l'envers.
  const lum = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]
  assert.ok(lum(couleurDeClasse(70)) > 200)
  assert.ok(lum(couleurDeClasse(10)) < 110)
  assert.ok(lum(couleurDeClasse(60)) > lum(couleurDeClasse(10)))
})

test('la palette reste sobre : aucune couleur criarde', () => {
  // La garde anti-« atlas scolaire », posée en chiffres. Le vert vif de la
  // légende ESA officielle (#006400) a une saturation de 1,0 ; on plafonne bien
  // en dessous.
  for (const c of CLASSES_SOL) {
    const [r, g, b] = couleurDeClasse(c.code)
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
    const sat = mx === 0 ? 0 : (mx - mn) / mx
    assert.ok(sat < 0.45, `${c.nom} : saturation ${sat.toFixed(2)}`)
  }
})

// ── L’adresse des tuiles et le plafond de zoom ──────────────────────────────

test('l’adresse suit la convention OSM {z}/{x}/{y} — PAS le {z}/{y}/{x} de GIBS', () => {
  // ⚠️ La couche nocturne, écrite la veille, utilise l'ordre WMTS inverse. Les
  // deux fichiers se ressemblent beaucoup, et recopier l'un dans l'autre rend
  // une tuile VALIDE prise ailleurs sur Terre : aucune erreur en console.
  // Nos tuiles sont cuites par nous, dans la grille XYZ, comme la bathymétrie.
  const u = urlTuileSol(12, 2125, 1458)
  assert.ok(u.endsWith('/12/2125/1458.png'), u)
  assert.ok(u.includes('data/sol/'), u)
})

test('l’adresse est RELATIVE, comme celle de la bathymétrie', () => {
  // Une barre oblique en tête casserait le site quand il est servi sous un
  // sous-chemin (les aperçus de déploiement Netlify le sont).
  assert.ok(!urlTuileSol(8, 1, 1).startsWith('/'))
})

test('le zoom est borné aux 10 m natifs de WorldCover', () => {
  // z14 vaut ~9,5 m/px à l'équateur : c'est exactement la donnée. Au-delà on ne
  // demanderait pas plus de détail, on demanderait des tuiles qui n'existent
  // pas.
  assert.equal(SOL_ZOOM_MAX, 14)
  assert.equal(zoomSolBorne(19), 14)
  assert.equal(zoomSolBorne(12), 12)
  assert.equal(zoomSolBorne(3), 3)
})

test('un zoom absurde retombe sur le plafond, jamais sur NaN', () => {
  // Une couche décorative ne doit jamais faire tomber la carte, et un NaN dans
  // une adresse rend une requête `data/sol/NaN/NaN/NaN.png`.
  assert.equal(zoomSolBorne(NaN), SOL_ZOOM_MAX)
  assert.equal(zoomSolBorne(undefined), SOL_ZOOM_MAX)
  assert.equal(zoomSolBorne(-4), 0)
  assert.equal(zoomSolBorne(11.9), 11)
})

// ── La couverture cuite ─────────────────────────────────────────────────────

const INDEX = {
  zmin: 8, zmax: 14,
  zones: [
    { nom: 'Chamonix', bbox: [6.7, 45.75, 7.05, 46.0] },
    { nom: 'Nice', bbox: [7.0, 43.5, 7.4, 43.85] },
  ],
}

test('une emprise dont le centre tombe dans une zone cuite est servie', () => {
  assert.equal(zoneSolPour(INDEX, { minLon: 6.85, maxLon: 6.95, minLat: 45.9, maxLat: 45.95 })?.nom, 'Chamonix')
})

test('une emprise hors zone cuite est refusée, et le dit', () => {
  // Rendre null plutôt que « rien à l'écran » : c'est ce qui permet à
  // l'appelant d'éteindre l'interrupteur et d'expliquer. Un interrupteur allumé
  // devant une carte inchangée fait croire que la donnée dit « rien ici ».
  assert.equal(zoneSolPour(INDEX, { minLon: 2.2, maxLon: 2.5, minLat: 48.8, maxLat: 48.9 }), null)
})

test('le CENTRE décide, pas le débordement — un bloc de bord reste servi', () => {
  // Une emprise à cheval sur le bord d'une zone cuite garde l'essentiel de sa
  // donnée : la refuser pour quelques pixels manquants serait plus brutal que
  // le bord vide, qui, lui, se fond déjà (les tuiles absentes valent 0).
  const abord = { minLon: 6.98, maxLon: 7.1, minLat: 45.9, maxLat: 45.98 }
  assert.equal(zoneSolPour(INDEX, abord)?.nom, 'Chamonix')
})

test('un index absent ou vide ne fait pas tomber la couche', () => {
  assert.equal(zoneSolPour(null, { minLon: 0, maxLon: 1, minLat: 0, maxLat: 1 }), null)
  assert.equal(zoneSolPour({ zones: [] }, { minLon: 0, maxLon: 1, minLat: 0, maxLat: 1 }), null)
  assert.equal(zoneSolPour(INDEX, null), null)
})

test('l’index normalisé garde ses bornes de zoom dans le domaine utile', () => {
  const n = normaliseIndexSol({ zmin: -3, zmax: 99, zones: [{ nom: 'x', bbox: [0, 0, 1, 1] }] })
  assert.equal(n.zmin, 0)
  assert.equal(n.zmax, SOL_ZOOM_MAX)
  const vide = normaliseIndexSol(null)
  assert.deepEqual(vide.zones, [])
})

// ── Le socle mondial coexiste avec les zones fines ──────────────────────────
//
// Depuis la cuisson mondiale z8-z9, TOUTE vue tombe dans au moins une zone. Ce
// qui était un simple « oui/non » devient un choix entre plusieurs zones de
// finesse différente — et se tromper de zone ne casse rien, ça affiche juste
// moins bien, en silence. D'où ces trois tests.

const INDEX_MONDE = {
  zmin: 8, zmax: 14,
  zones: [
    // volontairement rangé AVANT les zones fines : c'est le piège qu'on teste
    { nom: 'Monde', bbox: [-180, -60, 180, 84], zmax: 9 },
    { nom: 'Chamonix', bbox: [6.7, 45.75, 7.05, 46.0], zmax: 14 },
  ],
}

test('sur une zone fine, c’est la PLUS PETITE emprise qui gagne, pas la première', () => {
  // Sans cette règle, la finesse affichée au Mont-Blanc dépendrait de l'ORDRE
  // DES LIGNES d'un fichier JSON : recuire le monde remettrait sa zone en tête
  // du tableau et ferait retomber Chamonix de z14 à z9, sans erreur nulle part.
  const z = zoneSolPour(INDEX_MONDE, { minLon: 6.85, maxLon: 6.95, minLat: 45.9, maxLat: 45.95 })
  assert.equal(z.nom, 'Chamonix')
  assert.equal(z.zmax, 14)
})

test('hors zone fine, le socle mondial répond — mais en annonçant SON plafond', () => {
  // Le Kansas est cuit, en z8-z9 seulement. Rendre `zmax: 14` ici ferait
  // réclamer au client des tuiles jamais écrites : mosaïque vide, interrupteur
  // allumé, et l'utilisateur lit « la donnée dit qu'il n'y a rien ici ».
  const z = zoneSolPour(normaliseIndexSol(INDEX_MONDE), { minLon: -98, maxLon: -97, minLat: 38, maxLat: 39 })
  assert.equal(z.nom, 'Monde')
  assert.equal(z.zmax, 9)
})

test('une zone SANS plafond propre hérite du plafond global — les vieux manifestes restent lisibles', () => {
  const doc = normaliseIndexSol({ zmin: 8, zmax: 14, zones: [{ nom: 'ancienne', bbox: [0, 0, 1, 1] }] })
  assert.equal(doc.zones[0].zmax, 14)
})

test('⚠️ un zoom INCOMPLET ne doit pas être annoncé — le socle mondial reste à son dernier zoom fini', () => {
  // Le défaut qu'a failli livrer la première cuisson mondiale. Le manifeste
  // s'écrit au fil de l'eau ; s'il annonçait `zmax: 9` dès la première tuile z9,
  // une cuisson arrêtée à mi-parcours ferait réclamer du z9 SUR TOUTE LA TERRE
  // alors qu'un tiers seulement existe — mosaïque vide, interrupteur allumé.
  // Le cuiseur n'annonce donc qu'un zoom dont TOUTES les tuiles sont traitées
  // (voir `zoomComplet` dans build-occupation-sol.mjs) ; ce test verrouille le
  // contrat côté lecture : le client obéit au plafond, quel qu'il soit.
  const partiel = normaliseIndexSol({
    zmin: 8, zmax: 14,
    zones: [
      { nom: 'Monde', bbox: [-180, -60, 180, 84], zmax: 8 }, // z9 en cours
      { nom: 'Chamonix', bbox: [6.7, 45.75, 7.05, 46.0], zmax: 14 },
    ],
  })
  assert.equal(zoneSolPour(partiel, { minLon: -98, maxLon: -97, minLat: 38, maxLat: 39 }).zmax, 8)
  // et la zone fine, elle, n'est pas rabotée par la zone mondiale qui l'englobe
  assert.equal(zoneSolPour(partiel, { minLon: 6.85, maxLon: 6.95, minLat: 45.9, maxLat: 45.95 }).zmax, 14)
})

// ── Le masque de terre : le levier qui divise le coût de la cuisson par trois ─

test('le masque de terre distingue la pleine mer d’un continent', () => {
  // Un carré de terre de 10° autour de (0,0). Tout ce qui est dedans doit
  // sortir vrai, la haute mer autour doit sortir faux — sans quoi le masque
  // n'écarte rien, ou écarte tout.
  const carre = [{ geometry: { type: 'Polygon', coordinates: [[[-5, -5], [5, -5], [5, 5], [-5, 5], [-5, -5]]] } }]
  const n = 1024
  const g = rasteriseTerre(carre, n, { dilate: 0 })
  const tx = (lon, z) => Math.floor(((lon + 180) / 360) * 2 ** z)
  const ty = (lat, z) => {
    const s = Math.sin((lat * Math.PI) / 180)
    return Math.floor((0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 2 ** z)
  }
  assert.equal(tuileAvecTerre(g, n, 8, tx(0, 8), ty(0, 8)), true, 'le centre du carré est de la terre')
  assert.equal(tuileAvecTerre(g, n, 8, tx(0, 8), ty(0, 8)), true)
  assert.equal(tuileAvecTerre(g, n, 8, tx(60, 8), ty(0, 8)), false, 'la haute mer est écartée')
  assert.equal(tuileAvecTerre(g, n, 8, tx(0, 8), ty(60, 8)), false)
})

test('⚠️ une île PLUS PETITE QU’UNE CELLULE est quand même vue', () => {
  // LE défaut que ce masque doit s'interdire. Un remplissage par balayage seul
  // rate un polygone qui passe entre deux centres de cellule : la tuile n'est
  // jamais cuite, jamais réclamée, et le trou ne se voit que sur la carte finie.
  // La parade est la MARCHE DU CONTOUR, testée ici sur une île de 0,002°
  // (~200 m) alors qu'une cellule en fait 0,35° à cette résolution.
  const ilot = [{ geometry: { type: 'Polygon', coordinates: [[[40.000, 10.000], [40.002, 10.000], [40.002, 10.002], [40.000, 10.002], [40.000, 10.000]]] } }]
  const n = 1024
  const g = rasteriseTerre(ilot, n, { dilate: 0 })
  const tx = Math.floor(((40.001 + 180) / 360) * 2 ** 9)
  const s = Math.sin((10.001 * Math.PI) / 180)
  const ty = Math.floor((0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 2 ** 9)
  assert.equal(tuileAvecTerre(g, n, 9, tx, ty), true)
})

test('les trous d’un polygone restent des trous — une mer intérieure n’est pas de la terre', () => {
  // Règle pair-impair : l'anneau intérieur creuse. Sans elle, la mer Caspienne
  // et les grands lacs seraient cuits comme de la terre — des milliers de tuiles
  // de classe 80, muettes, payées plein tarif.
  const anneau = [{
    geometry: {
      type: 'Polygon',
      coordinates: [
        [[-20, -20], [20, -20], [20, 20], [-20, 20], [-20, -20]],
        [[-5, -5], [5, -5], [5, 5], [-5, 5], [-5, -5]],
      ],
    },
  }]
  const n = 1024
  const g = rasteriseTerre(anneau, n, { dilate: 0 })
  const tx = (lon, z) => Math.floor(((lon + 180) / 360) * 2 ** z)
  const ty = (lat, z) => {
    const s = Math.sin((lat * Math.PI) / 180)
    return Math.floor((0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 2 ** z)
  }
  assert.equal(tuileAvecTerre(g, n, 8, tx(12, 8), ty(0, 8)), true, 'la couronne est de la terre')
  assert.equal(tuileAvecTerre(g, n, 9, tx(0, 9), ty(0, 9)), false, 'le trou ne l’est pas')
})

test('le masque prend le OU sur toute la tuile, jamais son seul centre', () => {
  // Une tuile côtière dont le centre tombe en mer porte quand même la moitié
  // d'un continent. Se fier au centre la jetterait — et avec elle tout le
  // littoral, c'est-à-dire précisément ce qui se regarde.
  const bande = [{ geometry: { type: 'Polygon', coordinates: [[[-180, 40], [180, 40], [180, 80], [-180, 80], [-180, 40]]] } }]
  const n = 1024
  const g = rasteriseTerre(bande, n, { dilate: 0 })
  const lat2ty = (lat, z) => {
    const s = Math.sin((lat * Math.PI) / 180)
    return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 2 ** z
  }
  // la tuile z6 qui contient la latitude 40 : son centre est au SUD de la côte
  const ty = Math.floor(lat2ty(40, 6))
  assert.equal(tuileAvecTerre(g, n, 6, 10, ty), true)
})

// ── L’attribution, qui est une obligation de licence ────────────────────────

test('l’attribution CC-BY est présente, au mot près', () => {
  // CC-BY 4.0 impose la mention. La reformuler ou l'abréger fait tomber le
  // droit d'usage — même contrat que les crédits de bathy-sources.js.
  assert.equal(SOL_ATTRIBUTION, 'ESA WorldCover 2021')
  assert.equal(SOL_LICENCE, 'CC-BY 4.0')
})

// ── Le cuiseur : les deux fonctions pures qu’il expose ──────────────────────

test('le nom de dalle est celui du coin SUD-OUEST, arrondi à 3°', () => {
  // Une dalle porte le nom de son coin sud-ouest, mais son point d'ancrage
  // TIFF est le coin NORD-ouest. Confondre les deux décale toute la cuisson de
  // 3° vers le nord — soit environ 333 km, et pas un pixel de moins.
  assert.equal(nomDalle(6.86, 45.83), 'N45E006')
  assert.equal(nomDalle(2.35, 48.85), 'N48E000')
  assert.equal(nomDalle(7.26, 43.7), 'N42E006')
})

test('le nom de dalle arrondit VERS LE BAS, y compris en négatif', () => {
  // Math.floor et pas Math.trunc : à -1,5° la troncature rend 0 et vise une
  // dalle de l'hémisphère nord.
  assert.equal(nomDalle(-1.5, -1.5), 'S03W003')
  assert.equal(nomDalle(-0.1, 51.5), 'N51W003')
  assert.equal(nomDalle(0, 0), 'N00E000')
})

test('le PNG cuit est en NIVEAUX DE GRIS, un octet par pixel', () => {
  // Le type couleur 0 est ce qui permet de lire la classe telle quelle. En RVB
  // (type 2) le fichier pèserait trois fois plus pour la même information.
  const png = encodePngGris(new Uint8Array(4 * 4).fill(10), 4, 4)
  assert.equal(png.readUInt32BE(16), 4)
  assert.equal(png[24], 8, 'profondeur 8 bits')
  assert.equal(png[25], 0, 'type couleur 0 = niveaux de gris')
})

test('le PNG cuit se relit à l’octet près — aucune classe n’est altérée', () => {
  // La boucle complète : si l'encodeur abîmait un octet, la carte peindrait la
  // mauvaise classe sans qu'aucune erreur ne remonte.
  const src = new Uint8Array(8 * 8)
  const codes = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 100]
  for (let i = 0; i < src.length; i++) src[i] = codes[i % codes.length]
  const png = encodePngGris(src, 8, 8)
  // On déballe l'IDAT à la main plutôt que d'ajouter un décodeur PNG.
  let o = 8
  const parts = []
  while (o < png.length) {
    const len = png.readUInt32BE(o)
    if (png.toString('ascii', o + 4, o + 8) === 'IDAT') parts.push(png.subarray(o + 8, o + 8 + len))
    o += 12 + len
  }
  const brut = zlib.inflateSync(Buffer.concat(parts))
  for (let y = 0; y < 8; y++) {
    assert.equal(brut[y * 9], 0, 'filtre None sur chaque ligne')
    for (let x = 0; x < 8; x++) assert.equal(brut[y * 9 + 1 + x], src[y * 8 + x])
  }
})

// ── La donnée réellement cuite dans ce dépôt ────────────────────────────────

test('l’index cuit existe et n’annonce que des zones plausibles', () => {
  const p = 'public/data/sol/index.json'
  if (!existsSync(p)) return // les tuiles vivent hors dépôt (voir shibumap-deploiement)
  const doc = normaliseIndexSol(JSON.parse(readFileSync(p, 'utf-8')))
  assert.ok(doc.zones.length > 0)
  for (const z of doc.zones) {
    const [w, s, e, n] = z.bbox
    assert.ok(w < e && s < n, `${z.nom} : emprise retournée`)
    assert.ok(s >= -60 && n <= 84, `${z.nom} : WorldCover ne couvre pas ces latitudes`)
  }
})
