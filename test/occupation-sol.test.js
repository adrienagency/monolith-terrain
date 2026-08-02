import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import zlib from 'node:zlib'
import {
  urlTuileSol, zoomSolBorne, SOL_ZOOM_MAX, SOL_ATTRIBUTION, SOL_LICENCE,
  CLASSES_SOL, CODES_SOL, familleDeClasse, forceDeClasse, couleurDeClasse,
  tableLutSol, zoneSolPour, normaliseIndexSol,
} from '../src/occupation-sol.js'
import { nomDalle, encodePngGris } from '../scripts/build-occupation-sol.mjs'

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
