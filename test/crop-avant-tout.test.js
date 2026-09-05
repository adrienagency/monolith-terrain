// D27 — LE CROP D'ABORD : l'emprise est posée AVANT que quoi que ce soit ne soit
// dessiné à la nouvelle échelle, et RIEN de ce qui est hors crop ne s'affiche
// pendant la transition entre deux paliers.
//
// > **Adrien, 2026-09-05, vidéo d'un dézoom à La Réunion :** *« honnêtement, c'est
// > bourré de bugs. On ne peut pas lancer le crop avant même d'afficher la terre
// > ou la mer ? Ça évite d'afficher des éléments qui sont hors crop. »*
//
// ⚡ **CES TESTS SONT ROUGES SUR LE DÉPÔT (CA1, 2026-09-05), ET C'EST VOULU** —
// ils décrivent la règle, pas le code. Ce qu'ils rejouent est la MESURE de
// `scripts/sonde-ca1.mjs` (`.banc/CA1/dezoom8.json`, 8 chargements, La Réunion,
// crop z13 CHAUD, trois crans de molette en 120 ms) :
//
//   · le cran arme la molette (`armerSortie`) et la veille du repos se réveille
//     → `poserRepos(false)` → la porte du repos tombe en 30 images ;
//   · la poussée de sortie fait monter la caméra de 8,6 km à 38 km en ~1 s ;
//     dès 19,4 km (`ALT_ESTOMPAGE_FIN_M`) la LOI d'altitude dessine la planète
//     autour du crop VIVANT — 34 000 à 52 000 px hors emprise (sur 320 × 200),
//     206 images d'affilée ;
//   · `WIDENING z12` puis `WIDENING z11` : l'emprise change 276 – 377 ms après
//     l'annonce ; à z11 les parois sont PROVISOIRES pendant 60 images et **la
//     mer et le fond du crop refusent pendant 5,8 s** (`refus: fond+mer`) ;
//   · état mixte (planète dessinée + socle partiel) : 60 images à chaque
//     chargement, 8/8.
//
// Le banc de papier ci-dessous porte donc une LATENCE (parois provisoires N
// appels, mer refusée K reprises) — ⚠️ **sans latence, l'état mixte ne peut pas
// naître** (leçon CN3, TUILE §6) : c'est le test ⑤ qui le prouve.
//
// ⚠️ **`test/vie-crop.test.js` ②/④, `veille-repos` ⑥/⑨ et `estompage-fondu` ④
// encodent la permission de la molette (« si je dézoome EN SCROLLANT, tu peux
// faire réapparaître le reste », 2026-08-23) : ils tiennent pour la SORTIE du
// crop (le crop meurt, puis la planète). Ici le crop VIT de part et d'autre du
// palier — c'est le geste filmé — et D27 dit que rien de ce qui est hors crop
// n'est affiché. Le correcteur devra réconcilier les deux.**
//
// ⚡ **CA2 (le correcteur, 2026-09-05) — CE QUI A CHANGÉ ICI, ET POURQUOI.**
// Les assertions de ①②③④ sont INTACTES. Ce que le correctif a ajouté au
// globe, le globe de papier le porte aussi, sinon il ne pourrait pas le voir :
// `socleCropPret(ctx)` (D27), la SONDE que la veille interroge pendant qu'elle
// laisse l'ancien crop complet à l'écran. Sa latence de papier est la même
// que celle des maillons — N sondes ou N appels avant que les hauteurs d'un
// repère soient là — et elle est comptée PAR REPÈRE, parce que c'est ainsi
// qu'elle se comporte dans l'application : les hauteurs arrivent pour une
// emprise, pas pour un appel. Un globe SANS la sonde (`sondable: false`) rejoue
// le dépôt d'avant D27, pose immédiate et socle partiel : c'est le témoin de
// ⑤, et c'est la morsure de ⑥.
import test from 'node:test'
import assert from 'node:assert/strict'
import { creerVeilleCrop } from '../src/monde/branchement-crop.js'
import { creerVeilleEstompage } from '../src/monde/estompage-terre.js'
import { creerVeilleRepos, SEUIL_BOUGE_LOG } from '../src/monde/veille-repos.js'
import { SEUIL_MORT_M } from '../src/monde/seuil-socle.js'

// ══════════ LE BANC DE PAPIER — la chaîne mesurée, avec sa latence ══════════

/**
 * Un globe de papier qui se souvient de ce qu'il a POSÉ, image par image.
 *
 * `paroisLatence` : nombre d'appels de `construireParoisCrop` qui refusent (avec
 * plaque provisoire, comme SOC) après chaque changement de repère.
 * `merLatence` : nombre d'appels de `poserMer` qui refusent après chaque
 * changement de repère (mesuré : ~5,8 s, soit 5 – 6 reprises de 30 images).
 */
function globeDePapier({ paroisLatence = 0, merLatence = 0, sondable = true } = {}) {
  // ⚡ **LA LATENCE EST COMPTÉE PAR REPÈRE (CA2)** : le compteur d'un repère
  // avance à chaque sonde ou appel de maillon pour CE repère, et ne repart
  // jamais à zéro — les hauteurs arrivées pour une emprise ne repartent pas
  // parce qu'on l'a reposée. C'est ce qui rend la sonde COHÉRENTE avec la pose :
  // si elle répond « prêt », les deux maillons prennent dans la même image.
  // ⚠️ **CA3 — ET CHAQUE MAILLON A LE SIEN.** CA2 n'en tenait qu'UN, PARTAGÉ :
  // les appels des parois y payaient la latence de la mer, et `merLatence = 5`
  // ne valait plus « 5 reprises de `poserMer` » mais « 5 avances tous maillons
  // confondus » — **moins de latence que celle que CA1 a mesurée** (mer refusée
  // 5 – 8,6 s, 5 à 6 reprises de 30 images). Un correcteur ne relâche pas le
  // barème du banc : deux compteurs, chacun sa borne, et la sonde les avance
  // TOUS LES DEUX (une image où les hauteurs peuvent arriver les fait arriver
  // pour l'un comme pour l'autre — c'est la même tuile qui porte la hauteur du
  // contour et le nœud du champ de mer).
  const essais = new Map() // demi → { parois, mer }
  const compteurs = (demi) => { let c = essais.get(demi); if (!c) { c = { parois: 0, mer: 0 }; essais.set(demi, c) } return c }
  const avancer = (demi, quoi) => ++compteurs(demi)[quoi]
  const demiDe = ({ zoom, tuilesParBloc = 3 }) => tuilesParBloc / 2 / 2 ** zoom
  const g = {
    repere: null, // la DÉCOUPE posée (uCropDemi)
    paroisRepere: null, provisoire: false,
    merRepere: null,
    cropSeul: true,
    journal: [],
    sondes: 0,
    poserCrop({ zoom, tuilesParBloc = 3 }) {
      const rep = { cx: 0.5, cy: 0.5, demi: demiDe({ zoom, tuilesParBloc }), zoom }
      g.repere = rep
      g.journal.push(['crop', rep.demi])
      return rep
    },
    construireParoisCrop() {
      if (!g.repere) return null
      if (avancer(g.repere.demi, 'parois') <= paroisLatence) {
        // SOC : la plaque provisoire suit la découpe dans la même image
        g.paroisRepere = g.repere.demi; g.provisoire = true
        g.journal.push(['parois-prov', g.repere.demi])
        return { refus: 'couverture', provisoire: true }
      }
      g.paroisRepere = g.repere.demi; g.provisoire = false
      g.journal.push(['parois', g.repere.demi])
      return { refus: null, provisoire: false }
    },
    poserHabillage() {},
    poserRampe() { return { refus: null } },
    async poserMer() {
      if (avancer(g.repere?.demi, 'mer') <= merLatence) { g.journal.push(['mer-refus', g.repere?.demi]); return { refus: 'couverture' } }
      g.merRepere = g.repere?.demi ?? null
      g.journal.push(['mer', g.merRepere])
      return { refus: null }
    },
    retirerCrop() { g.repere = null; g.paroisRepere = null; g.merRepere = null },
    poserCropSeul(v) { g.cropSeul = !!v; g.journal.push(['seul', !!v]); return g.cropSeul },
  }
  if (sondable) {
    // D27 — la sonde : « si je posais ce repère maintenant, parois ET mer
    // prendraient-elles ? » Elle avance les DEUX compteurs du repère comme un
    // appel (une sonde est une image où les hauteurs peuvent arriver), et ne
    // pose rien. ⚠️ **ELLE NE MENT PAS DANS LE SENS DANGEREUX** : elle ne peut
    // répondre « prêt » que si les deux maillons prendraient à l'appel suivant.
    g.socleCropPret = (ctx) => {
      g.sondes++
      const demi = demiDe(ctx)
      const parois = avancer(demi, 'parois')
      const mer = avancer(demi, 'mer')
      const pret = parois >= paroisLatence && mer >= merLatence
      g.journal.push(['sonde', demi, pret])
      return { pret, parois: parois >= paroisLatence ? 1 : 0, mer: mer >= merLatence ? 1 : 0 }
    }
  }
  return g
}

// L'altitude de la vidéo : le crop z13 est cadré à 8,6 km ; la poussée monte à
// 38 km, sous la mort (40 343 m) — le crop VIT tout du long (mesuré 8/8).
const ALT_DEPART = 8600
const ALT_HAUT = SEUIL_MORT_M * 0.94
const D0 = 103
const bouge = (i) => D0 * Math.exp(SEUIL_BOUGE_LOG * 3 * i)

/**
 * Le geste d'Adrien, image par image : la molette est armée au DOM avant la
 * première image ; la caméra monte ; les paliers tombent aux images données.
 * Rend le relevé par image — ce que les assertions lisent.
 */
async function jouer({ g, paliers, images = 260, molette = true, zoomDepart = 13, altitude = null, veilleOpts = {} }) {
  const ctx = { centre: { lat: -21.2482, lon: 55.7664 }, zoom: zoomDepart, tuilesParBloc: 3, habillage: {} }
  const est = creerVeilleEstompage({ appliquer: () => {} })
  const repos = creerVeilleRepos()
  const veille = creerVeilleCrop({ globe: () => g, contexte: () => ctx, estompage: est, repos, periodeReprise: 30, ...veilleOpts })
  // la naissance, puis le repos : le crop est CHAUD et SEUL avant le geste —
  // ⚠️ la latence de papier joue aussi à la naissance ; on attend que le socle
  // soit complet (reprises comprises), comme le banc chauffe jusqu'à la netteté
  // ⚠️ la mer est ASYNCHRONE (`poserMer` rend une promesse) : chaque image rend
  // la main aux microtâches, comme le navigateur entre deux rAF
  const image = async (alt, d) => { est.avancerFondu(); veille.maj(alt, d); await veille.enVol(); await Promise.resolve() }
  veille.maj(ALT_DEPART, D0); await veille.enVol()
  for (let i = 0; i < 600 && (veille.refus.length || g.provisoire || g.merRepere !== g.repere?.demi); i++) await image(ALT_DEPART, D0)
  for (let i = 0; i < 40; i++) await image(ALT_DEPART, D0)
  assert.equal(veille.pose, true); assert.equal(est.valeur, 1); assert.equal(g.cropSeul, true)
  assert.deepEqual(veille.refus, [], 'le crop n’est pas chaud au départ')
  assert.equal(g.merRepere, g.repere.demi); assert.equal(g.provisoire, false)
  const relevé = []
  if (molette) veille.armerSortie() // le cran arrive au DOM avant la première image
  const altDe = altitude || ((i) => (i < 60 ? ALT_DEPART * Math.exp(Math.log(ALT_HAUT / ALT_DEPART) * i / 60) : ALT_HAUT))
  for (let i = 1; i <= images; i++) {
    if (paliers[i] !== undefined) ctx.zoom = paliers[i] // WIDENING : le bloc a changé d'échelle
    const d = i < 60 ? bouge(i) : bouge(60) // 60 images de geste, puis le calme
    await image(altDe(i), d) // `majEstompage` (sans garde de `busy`) puis la veille
    relevé.push({
      i, zoom: ctx.zoom, pose: veille.pose, decoupe: g.repere?.demi ?? null,
      parois: g.paroisRepere, provisoire: g.provisoire, mer: g.merRepere,
      cropSeul: g.cropSeul, estompage: est.valeur, porte: est.porteRepos, refus: veille.refus,
    })
  }
  return { relevé, veille, est, g }
}
const PALIERS = { 25: 12, 45: 11 } // z13 → z12 → z11, les deux WIDENING de la vidéo
const dehorsDessine = (r) => r.pose && r.estompage < 0.999
const socleIncomplet = (r) => r.pose && (r.parois !== r.decoupe || r.provisoire || r.mer !== r.decoupe)

// ══════════ ① LE DEHORS RESTE ÉTEINT ENTRE DEUX PALIERS DU CROP ═════════════

test('① entre deux paliers, le crop vit et RIEN hors de l’emprise n’est dessiné (dézoom à la molette)', async () => {
  const g = globeDePapier({ paroisLatence: 3, merLatence: 5 })
  const { relevé } = await jouer({ g, paliers: PALIERS })
  assert.ok(relevé.every((r) => r.pose), 'le crop est mort pendant le geste — ce n’est pas la sortie, c’est le palier')
  const allume = relevé.filter(dehorsDessine)
  assert.equal(allume.length, 0, `le dehors est dessiné sur ${allume.length} images (première : i=${allume[0]?.i}, estompage ${allume[0]?.estompage}) — mesuré 206 images dans l’application`)
  const parcouru = relevé.filter((r) => r.pose && !r.cropSeul)
  assert.equal(parcouru.length, 0, `le quadtree parcourt le dehors sur ${parcouru.length} images`)
})

// ══════════ ② LE SOCLE EST COMPLET AVANT LA DÉCOUPE NEUVE ═══════════════════

test('② une découpe neuve n’est jamais affichée sans SES parois et SA mer — l’ancien crop complet, ou le nouveau socle complet', async () => {
  // ⚠️ la latence est celle mesurée : parois provisoires puis définitives, mer
  // refusée pendant plusieurs reprises (5,8 s dans l'application)
  const g = globeDePapier({ paroisLatence: 3, merLatence: 5 })
  const { relevé } = await jouer({ g, paliers: PALIERS, molette: false })
  const partiel = relevé.filter(socleIncomplet)
  assert.equal(partiel.length, 0, `${partiel.length} images montrent une découpe dont le socle n’est pas le sien (première : i=${partiel[0]?.i}, découpe ${partiel[0]?.decoupe}, parois ${partiel[0]?.parois}${partiel[0]?.provisoire ? ' PROVISOIRES' : ''}, mer ${partiel[0]?.mer})`)
  // et la découpe a bien fini par changer : on ne gagne pas en ne changeant jamais
  assert.equal(relevé[relevé.length - 1].decoupe, 3 / 2 / 2 ** 11, 'le crop n’a jamais atteint z11')
})

// ══════════ ③ L'ÉTAT MIXTE — planète dessinée + socle partiel : 0 image ═════

test('③ 0 image d’état mixte : jamais la planète autour ET un socle partiel', async () => {
  const g = globeDePapier({ paroisLatence: 3, merLatence: 5 })
  const { relevé } = await jouer({ g, paliers: PALIERS })
  const mixte = relevé.filter((r) => dehorsDessine(r) && socleIncomplet(r))
  assert.equal(mixte.length, 0, `${mixte.length} images mixtes (première : i=${mixte[0]?.i}) — mesuré 60 par chargement, 8/8`)
})

// ══════════ ④ LE ZOOM AVANT — l'acquis, dans l'autre sens ═══════════════════

test('④ au re-zoom (z11 → z12 → z13), même règle — ACQUIS : mesuré propre dans l’application (tuiles et mer en cache), ce test est vert et garde', async () => {
  // ⚠️ sans latence, comme mesuré au re-zoom : les parois sont définitives dans
  // l'image de la pose et la mer ne refuse pas (`.banc/CA1/dezoom8.json`)
  const g = globeDePapier()
  const { relevé, veille } = await jouer({ g, paliers: { 25: 12, 45: 13 }, molette: false, zoomDepart: 11, altitude: () => ALT_DEPART })
  veille.desarmerSortie()
  assert.ok(relevé.every((r) => r.pose))
  assert.equal(relevé.filter(dehorsDessine).length, 0, 'le zoom avant a rallumé le dehors')
  const partiel = relevé.filter(socleIncomplet)
  assert.equal(partiel.length, 0, `${partiel.length} images de socle partiel au zoom avant (première : i=${partiel[0]?.i})`)
})

// ══════════ ⑤ TÉMOIN DE VIVACITÉ — sans latence, la règle est tenable ═══════

test('⑤ témoin : sans latence ni molette, aucune assertion ne mord — les tests mesurent la latence, pas l’impossible', async () => {
  const g = globeDePapier()
  const { relevé } = await jouer({ g, paliers: PALIERS, molette: false })
  assert.equal(relevé.filter(dehorsDessine).length, 0)
  assert.equal(relevé.filter(socleIncomplet).length, 0)
  assert.equal(relevé.filter((r) => dehorsDessine(r) && socleIncomplet(r)).length, 0)
  assert.equal(relevé[relevé.length - 1].decoupe, 3 / 2 / 2 ** 11)
  // et la latence seule fait naître le socle partiel — c'est elle que ② mesure.
  // ⚡ CA2 : sur un globe SANS la sonde de D27 (le dépôt d'avant), la pose est
  // immédiate et la latence se voit — c'est la preuve que le banc n'est pas
  // aveugle. Avec la sonde, ② exige zéro.
  const g2 = globeDePapier({ paroisLatence: 3, merLatence: 5, sondable: false })
  const r2 = (await jouer({ g: g2, paliers: PALIERS, molette: false })).relevé
  assert.ok(r2.some(socleIncomplet), 'la latence de papier ne produit aucun socle partiel : le banc est aveugle')
  assert.equal(r2[r2.length - 1].decoupe, 3 / 2 / 2 ** 11)
})

// ══════════ ⑥ LA MORSURE — l'attente du socle, et pas autre chose ═══════════

test('⑥ CA2 : c’est l’ATTENTE DU SOCLE qui tient ② — le levier `attenteSocleMax = 0` (la pose immédiate d’avant D27) rend le socle partiel, et l’attente ne dure pas plus que sa borne', async () => {
  // le levier de banc (règle D13) : pose immédiate, découpe neuve sans socle
  const g0 = globeDePapier({ paroisLatence: 3, merLatence: 5 })
  const r0 = (await jouer({ g: g0, paliers: PALIERS, molette: false, veilleOpts: { attenteSocleMax: 0 } })).relevé
  assert.ok(r0.some(socleIncomplet), 'sans attente, la latence ne se voit plus : le levier est mort')
  assert.equal(g0.sondes, 0, 'à `attenteSocleMax = 0`, la sonde ne doit jamais être interrogée')
  // l'attente réelle : l'ancien crop reste COMPLET, la découpe ne change qu'avec son socle
  const g = globeDePapier({ paroisLatence: 3, merLatence: 5 })
  const { relevé, veille } = await jouer({ g, paliers: PALIERS, molette: false })
  assert.equal(relevé.filter(socleIncomplet).length, 0)
  assert.ok(g.sondes > 0, 'la sonde n’a jamais été interrogée')
  assert.equal(veille.attentes, 2, `${veille.attentes} attentes ouvertes pour deux paliers`)
  assert.equal(veille.attentesEchues, 0, 'une attente a été échue alors que la latence tient dans la borne')
  // la découpe n'a changé qu'avec son socle — et le palier z12, annoncé à i=25,
  // a été SUPPLANTÉ par z11 (i=45) avant que son socle soit prêt (6 sondes à
  // 6 images) : une seule découpe neuve, celle de z11, jamais une sans socle
  const changements = relevé.filter((r, i) => i > 0 && r.decoupe !== relevé[i - 1].decoupe)
  assert.ok(changements.length >= 1 && changements.length <= 2, `${changements.length} changements de découpe pour deux paliers`)
  for (const c of changements) {
    assert.equal(c.parois, c.decoupe); assert.equal(c.provisoire, false); assert.equal(c.mer, c.decoupe)
  }
  // et la borne : une latence plus longue que `attenteSocleMax` finit par poser quand même (comme avant D27)
  const g3 = globeDePapier({ paroisLatence: 3, merLatence: 5 })
  g3.socleCropPret = () => ({ pret: false }) // un socle qui ne vient jamais (réseau muet)
  const j3 = await jouer({ g: g3, paliers: { 25: 12 }, molette: false, veilleOpts: { attenteSocleMax: 30 } })
  assert.equal(j3.veille.attentesEchues, 1, 'une attente plus longue que sa borne n’a pas été échue')
  assert.equal(j3.relevé[j3.relevé.length - 1].decoupe, 3 / 2 / 2 ** 12, 'la découpe n’a jamais changé : l’attente est sans fin')
  const premiere = j3.relevé.find((r) => r.decoupe === 3 / 2 / 2 ** 12)
  assert.ok(premiere.i >= 25 + 30 && premiere.i <= 25 + 31, `la pose échue tombe à i=${premiere.i}, attendu 55`)
})
