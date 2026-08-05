// ═══════════════════════════════════════════════════════════════════════════
// LE PAVAGE D'UNE AFFICHE — ET LA PREUVE QU'IL N'Y A PAS DE COUTURE
// ═══════════════════════════════════════════════════════════════════════════
//
// Une couture d'UN PIXEL sur un tirage de 70 cm mesure 0,08 mm et court sur
// toute la hauteur. À l'écran elle n'existe pas ; sur le papier c'est un trait
// clair en travers de l'affiche, et il se découvre après le tirage payé. C'est
// exactement le défaut que `planTuiles` (print-page.js) a été écrit pour éviter,
// et jusqu'ici personne ne l'appelait.
//
// ═══ CE QUE CE FICHIER PROUVE, ET COMMENT ══════════════════════════════════
//
// ① CHAQUE PIXEL EST ÉCRIT UNE FOIS, ET UNE SEULE. C'est une preuve EXACTE,
//    pas une comparaison à un seuil : le support de composition compte les
//    écritures pixel par pixel. Un pixel à zéro écriture est une ligne claire ;
//    un pixel à deux est une bande sombre.
//
// ② LE PAVAGE ET LE RENDU EN UNE PASSE DONNENT LA MÊME IMAGE. On rend une
//    scène de contrôle en une passe, puis en tuiles, et on compare pixel à
//    pixel — à travers la VRAIE arithmétique de projection de three
//    (`PerspectiveCamera.setViewOffset`), pas une maquette de celle-ci.
//
// ⚠️ LE PIÈGE DE LA SCÈNE DE CONTRÔLE, ET IL EST MORTEL : une scène UNIFORME
// ne révèle aucune couture. Un fond uni recollé n'importe comment reste un fond
// uni. La scène de contrôle est donc choisie POUR RENDRE LES COUTURES VISIBLES :
//   · une rampe diagonale — un décalage d'une tuile entière saute aux yeux ;
//   · une onde de PÉRIODE COURTE, quelques pixels — c'est elle qui attrape le
//     décalage d'UN pixel, celui que la rampe laisserait passer.
// Un test dédié (« la scène de contrôle révèle bien une couture ») abîme le
// recollage d'un seul pixel et exige que l'écart explose. Sans lui, tout ce
// fichier pourrait être vert sur une image unie.
//
// ③ AUCUNE IMAGE PLEINE N'EXISTE JAMAIS, sur les sept formats × deux
//    orientations. Le support enregistre le plus grand canevas qu'on lui a
//    demandé d'ouvrir.
//
// ④ LA FENÊTRE RENDUE, RECOUVREMENT COMPRIS, TIENT SOUS 2 048 — le plancher
//    garanti de WebGL2. En dessous, aucune détection matérielle n'est requise.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import {
  exporteAffichePavee, tuileRecouverte, bandesDuPlan, coteTuileUtile,
  MPX_CANEVAS_MAX, exportImage,
} from '../src/export.js'
import { planTuiles, geometriePage, FORMATS_AFFICHE } from '../src/print-page.js'
import { DPI_NOMINAL, COTE_TUILE } from '../src/export-dpi.js'
import { composeDecalage } from '../src/export-cadrage.js'
import { margeSmaa } from '../src/export-effets.js'

// ═══════════════════════════════════════════════════════════════════════════
// LA SCÈNE DE CONTRÔLE
// ═══════════════════════════════════════════════════════════════════════════
//
// Un plan z = 0, peint par une fonction du point du monde. La caméra le regarde
// de face ; chaque pixel tire son rayon et lit la fonction là où il tombe. C'est
// une réduction du vrai chemin de rendu à ce qui nous intéresse : la GÉOMÉTRIE.
// Tout ce qui décide de la couture — la matrice de projection, le découpage de
// `setViewOffset`, le recollage — est le vrai code.

const DISTANCE = 60
const FOV = 50

// Une unité monde vaut environ 0,29 px dans ce cadrage : l'onde de période
// 2,0 unités fait donc ~7 px, et un décalage d'un pixel change sa phase de
// près d'un radian. C'est ce qui rend le test sensible au pixel près, tout en
// restant parfaitement lisse — le bruit de virgule flottante (10⁻¹² unité) n'y
// produit rien de mesurable.
function motif(x, y) {
  const rampe = 0.5 + (x + y) * 0.004
  const onde = 0.22 * Math.sin(x * 3.1) + 0.22 * Math.cos(y * 2.7 + x * 1.3)
  return rampe + onde
}

// Le banc : un « moteur de rendu » qui peint la scène de contrôle dans un
// tampon de la taille demandée, à travers la caméra three qu'on lui donne.
function bancDeControle() {
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 1000)
  camera.position.set(0, 0, DISTANCE)
  camera.lookAt(0, 0, 0)
  const toile = { largeur: 1, hauteur: 1, pixels: new Float64Array(1) }
  let w = 1
  let h = 1
  const p = new THREE.Vector3()
  const dir = new THREE.Vector3()
  return {
    camera,
    renderer: {
      setPixelRatio() {},
      getPixelRatio: () => 1,
      getContext: () => null, // aucune limite lisible : rien n'est raboté
      getSize: (v) => { v.x = w; v.y = h; return v },
      domElement: toile,
    },
    composer: {
      setSize(nw, nh) {
        w = nw
        h = nh
        toile.largeur = nw
        toile.hauteur = nh
        toile.pixels = new Float64Array(nw * nh)
      },
      render() {
        camera.updateMatrixWorld(true)
        const px = toile.pixels
        for (let j = 0; j < h; j++) {
          const ndcY = 1 - ((j + 0.5) / h) * 2
          for (let i = 0; i < w; i++) {
            const ndcX = ((i + 0.5) / w) * 2 - 1
            p.set(ndcX, ndcY, -1).unproject(camera)
            dir.copy(p).sub(camera.position)
            // intersection avec le plan z = 0
            const t = -camera.position.z / dir.z
            px[j * w + i] = motif(camera.position.x + dir.x * t, camera.position.y + dir.y * t)
          }
        }
      },
    },
  }
}

// Le support de composition en mémoire : il compte les écritures, retient la
// plus grande toile ouverte, et rend les pixels au lieu d'un blob.
function supportPreuve({ decalage = 0 } = {}) {
  const compte = { canevasMaxPx: 0, toiles: 0 }
  return {
    compte,
    creerToile(largeur, hauteur) {
      const pixels = new Float64Array(largeur * hauteur)
      const ecritures = new Uint16Array(largeur * hauteur)
      compte.canevasMaxPx = Math.max(compte.canevasMaxPx, largeur * hauteur)
      compte.toiles++
      return {
        largeur,
        hauteur,
        poser(src, sx, sy, sw, sh, dx, dy, dw, dh) {
          assert.equal(sw, dw, 'aucune mise à l’échelle ne doit être nécessaire')
          assert.equal(sh, dh, 'aucune mise à l’échelle ne doit être nécessaire')
          // `decalage` est la MUTATION : il abîme le recollage d'un pixel.
          const dxx = dx + decalage
          for (let y = 0; y < sh; y++) {
            for (let x = 0; x < sw; x++) {
              const cx = dxx + x
              if (cx < 0 || cx >= largeur) continue
              const d = (dy + y) * largeur + cx
              pixels[d] = src.pixels[(sy + y) * src.largeur + (sx + x)]
              ecritures[d]++
            }
          }
        },
        encoder: () => Promise.resolve({ pixels, ecritures, largeur, hauteur }),
        liberer() {},
      }
    },
  }
}

// Le geste de la scène, tel que main.js le fait : UN SEUL `setViewOffset`, celui
// que `composeDecalage` compose. C'est ce branchement-là qu'on éprouve.
function preparerTuileDe(camera, acheteur) {
  return ({ cadrage }) => {
    const sauve = camera.view ? { ...camera.view } : null
    const vue = composeDecalage({ ...acheteur, aspect: cadrage.fullWidth / cadrage.fullHeight }, cadrage)
    if (vue) camera.setViewOffset(vue.fullWidth, vue.fullHeight, vue.offsetX, vue.offsetY, vue.width, vue.height)
    else camera.clearViewOffset()
    camera.updateProjectionMatrix()
    return {
      restaurer() {
        if (sauve?.enabled) camera.setViewOffset(sauve.fullWidth, sauve.fullHeight, sauve.offsetX, sauve.offsetY, sauve.width, sauve.height)
        else camera.clearViewOffset()
        camera.updateProjectionMatrix()
      },
    }
  }
}

// Rend une affiche et recolle ses bandes en une image de test. ⚠️ C'est LE TEST
// qui tient l'image pleine, jamais l'orchestrateur : elle fait 133 000 pixels.
async function rendre({ pleine, cote, acheteur = { x: 0, y: 0 }, effets = { smaaActif: false }, decalage = 0 }) {
  const banc = bancDeControle()
  const support = supportPreuve({ decalage })
  const bandes = []
  const r = await exporteAffichePavee({
    renderer: banc.renderer,
    composer: banc.composer,
    camera: banc.camera,
    totalPx: pleine,
    dpi: 300,
    cote,
    effets,
    support,
    preparerTuile: preparerTuileDe(banc.camera, acheteur),
    surBande: (b) => { bandes.push(b) },
  })
  const [W, H] = pleine
  const image = new Float64Array(W * H)
  const ecritures = new Uint16Array(W * H)
  for (let k = 0; k < bandes.length; k++) {
    const b = bandes[k]
    const src = b.blob
    for (let y = 0; y < b.hauteur; y++) {
      image.set(src.pixels.subarray(y * W, y * W + W), (b.y + y) * W)
      ecritures.set(src.ecritures.subarray(y * W, y * W + W), (b.y + y) * W)
    }
  }
  return { image, ecritures, resultat: r, support, W, H }
}

function ecart(a, b) {
  let max = 0
  for (let i = 0; i < a.length; i++) max = Math.max(max, Math.abs(a[i] - b[i]))
  return max
}

// Une affiche minuscule, mais aux dimensions VOLONTAIREMENT INDIVISIBLES : 421
// et 317 sont premiers, et 97 ne divise ni l'un ni l'autre. C'est le cas où le
// découpage naïf (`Math.floor(W / n)` répété) perd son reste — donc le seul cas
// qui prouve quelque chose.
const PLEINE = [421, 317]
const COTE = 97

// ═══════════════════════════════════════════════════════════════════════════
// ① CHAQUE PIXEL, UNE FOIS ET UNE SEULE
// ═══════════════════════════════════════════════════════════════════════════

test('chaque pixel de l’affiche est écrit exactement une fois — le pavage ne laisse ni trou ni chevauchement', async () => {
  const { ecritures, resultat, W, H } = await rendre({ pleine: PLEINE, cote: COTE })
  assert.equal(resultat.plan.tuiles.length, 20, '5 colonnes × 4 lignes sur un format indivisible')
  const zero = []
  const deux = []
  for (let i = 0; i < ecritures.length; i++) {
    if (ecritures[i] === 0) zero.push(i)
    if (ecritures[i] > 1) deux.push(i)
  }
  assert.equal(zero.length, 0, `${zero.length} pixels jamais écrits — autant de lignes claires sur le tirage`)
  assert.equal(deux.length, 0, `${deux.length} pixels écrits deux fois — autant de bandes sombres`)
  // et la propriété de `planTuiles` elle-même, relue à travers le recollage
  assert.equal(resultat.plan.tuiles.reduce((s, t) => s + t.w * t.h, 0), W * H)
})

test('la couverture reste exacte AVEC recouvrement — le rognage rend exactement sa part', async () => {
  const { ecritures } = await rendre({ pleine: PLEINE, cote: COTE, effets: { smaaActif: true } })
  assert.ok(margeSmaa() > 0, 'le recouvrement de SMAA doit être non nul, sinon le test ne teste rien')
  assert.ok(ecritures.every((e) => e === 1), 'une marge de recouvrement mal rognée écrit deux fois ou pas du tout')
})

// ═══════════════════════════════════════════════════════════════════════════
// ② PAVÉ = UNE PASSE
// ═══════════════════════════════════════════════════════════════════════════
//
// La référence est le MÊME orchestrateur avec une seule tuile : le cadrage y
// est identifié comme l'identité par `composeDecalage`, qui rend `null`, et le
// chemin retombe donc sur `clearViewOffset()` — le rendu plein cadre d'avant
// tout ce chantier.

test('le pavage rend la MÊME image qu’une passe unique — aucune couture', async () => {
  const pave = await rendre({ pleine: PLEINE, cote: COTE })
  const plein = await rendre({ pleine: PLEINE, cote: 100000 })
  assert.equal(plein.resultat.plan.tuiles.length, 1, 'la référence doit bien être une passe unique')
  const e = ecart(pave.image, plein.image)
  assert.ok(e < 1e-9, `écart maximal ${e} entre le pavage et la passe unique`)
})

test('le pavage rend la même image AVEC le cadrage de l’acheteur — les deux décalages se composent', async () => {
  const acheteur = { x: 0.37, y: -0.21 }
  const pave = await rendre({ pleine: PLEINE, cote: COTE, acheteur })
  const plein = await rendre({ pleine: PLEINE, cote: 100000, acheteur })
  const e = ecart(pave.image, plein.image)
  assert.ok(e < 1e-9, `écart maximal ${e} : le cadrage de l’acheteur ne survit pas au pavage`)
})

test('le pavage rend la même image AVEC recouvrement — la marge est rendue puis rognée, pas décalée', async () => {
  const pave = await rendre({ pleine: PLEINE, cote: COTE, effets: { smaaActif: true } })
  const plein = await rendre({ pleine: PLEINE, cote: 100000, effets: { smaaActif: true } })
  const e = ecart(pave.image, plein.image)
  assert.ok(e < 1e-9, `écart maximal ${e} : le rognage du recouvrement décale l’image`)
})

// ═══════════════════════════════════════════════════════════════════════════
// LE TEST QUI EMPÊCHE LES QUATRE PRÉCÉDENTS D'ÊTRE VIDES
// ═══════════════════════════════════════════════════════════════════════════

test('la scène de contrôle révèle bien une couture d’UN SEUL pixel', async () => {
  const juste = await rendre({ pleine: PLEINE, cote: COTE })
  const tordu = await rendre({ pleine: PLEINE, cote: COTE, decalage: 1 })
  const e = ecart(juste.image, tordu.image)
  // Un décalage d'un pixel sur une onde de ~7 px de période change la valeur de
  // plusieurs dixièmes. Le seuil des tests de fidélité est 10⁻⁹ : le motif est
  // donc sensible huit ordres de grandeur au-delà de ce qu'on tolère.
  assert.ok(e > 0.1, `un décalage d’un pixel ne produit qu’un écart de ${e} : la scène de contrôle est trop unie`)
  // et la couverture, elle, se casse aussi — deux filets pour un même défaut
  assert.ok(tordu.ecritures.some((v) => v !== 1), 'un décalage doit laisser des pixels non écrits')
})

test('une scène UNIFORME ne prouverait rien — la démonstration du piège', () => {
  // Le motif appliqué à deux points distants d'un pixel doit différer. Si
  // quelqu'un adoucit un jour la scène de contrôle « pour réduire le bruit »,
  // c'est ici que ça rougit, et pas trois mois plus tard sur un tirage.
  const parPixel = (2 * DISTANCE * Math.tan((FOV * Math.PI) / 360)) / PLEINE[1]
  assert.ok(Math.abs(motif(0, 0) - motif(parPixel, 0)) > 0.02,
    'la scène de contrôle doit varier sensiblement d’un pixel au suivant')
})

// ═══════════════════════════════════════════════════════════════════════════
// ③ ET ④ — LES DEUX BUDGETS, SUR LES SEPT FORMATS × DEUX ORIENTATIONS
// ═══════════════════════════════════════════════════════════════════════════

const COMBINAISONS = FORMATS_AFFICHE.flatMap((f) => ['portrait', 'paysage'].map((o) => [f.id, o]))

test('aucun canevas de composition ne dépasse le plafond — jamais d’image pleine', () => {
  for (const [format, orientation] of COMBINAISONS) {
    const geo = geometriePage({ format, dpi: DPI_NOMINAL[format], orientation })
    const cote = coteTuileUtile(geo.totalPx, margeSmaa())
    const plan = planTuiles(geo.totalPx, cote)
    const bandes = bandesDuPlan(plan)
    const max = Math.max(...bandes.map((b) => b.largeur * b.hauteur))
    assert.ok(max <= MPX_CANEVAS_MAX,
      `${format} ${orientation} : bande de ${(max / 1e6).toFixed(2)} Mpx au-dessus du plafond`)
    // et la bande reste MASSIVEMENT sous l'image pleine : c'est tout l'objet
    const pleine = geo.totalPx[0] * geo.totalPx[1]
    assert.ok(max < pleine, `${format} ${orientation} : la bande vaut l’image pleine`)
  }
})

test('la fenêtre rendue, recouvrement compris, tient sous le plancher garanti de WebGL2', () => {
  // Le bokeh au maximum qu'un look aléatoire produit (main.js:4476 : rnd(5, 18))
  for (const bokehScale of [0, 3.7, 18]) {
    for (const [format, orientation] of COMBINAISONS) {
      const geo = geometriePage({ format, dpi: DPI_NOMINAL[format], orientation })
      // la marge du plan, calculée comme l'orchestrateur : sur le côté nominal
      const marge = Math.ceil(2 * bokehScale + 6 + (4 * COTE_TUILE) / 720)
      const cote = coteTuileUtile(geo.totalPx, Math.max(marge, margeSmaa()))
      const plan = planTuiles(geo.totalPx, cote)
      for (const t of plan.tuiles) {
        const r = tuileRecouverte(plan, t, Math.max(marge, margeSmaa()))
        assert.ok(Math.max(r.cadrage.width, r.cadrage.height) <= COTE_TUILE,
          `${format} ${orientation} bokeh ${bokehScale} : fenêtre ${r.cadrage.width}×${r.cadrage.height} > ${COTE_TUILE}`)
      }
    }
  }
})

test('le nombre de tuiles reste celui de la table du plan — la marge ne coûte pas de tuile', () => {
  const attendu = { a4: 4, '30x40': 6, a3: 6, '40x50': 9, a2: 12, '50x70': 12, '61x91': 12 }
  for (const [format, orientation] of COMBINAISONS) {
    const geo = geometriePage({ format, dpi: DPI_NOMINAL[format], orientation })
    const cote = coteTuileUtile(geo.totalPx, Math.ceil(2 * 3.7 + 6 + (4 * COTE_TUILE) / 720))
    const plan = planTuiles(geo.totalPx, cote)
    assert.equal(plan.tuiles.length, attendu[format], `${format} ${orientation}`)
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// LE CÔTÉ DE TUILE — SES DEUX CONTRAINTES, ET LEUR ORDRE
// ═══════════════════════════════════════════════════════════════════════════

test('coteTuileUtile retire le recouvrement du côté au lieu de l’ajouter', () => {
  assert.equal(coteTuileUtile([1000, 1000], 0, 2048, 0), 2048)
  assert.equal(coteTuileUtile([1000, 1000], 25, 2048, 0), 1998)
  // et la fenêtre rendue retombe donc pile sous le côté nominal
  const plan = planTuiles([4796, 5977], coteTuileUtile([4796, 5977], 25))
  for (const t of plan.tuiles) {
    const r = tuileRecouverte(plan, t, 25)
    assert.ok(Math.max(r.cadrage.width, r.cadrage.height) <= 2048)
  }
})

test('coteTuileUtile ne descend que si la bande RÉELLE dépasse — pas sur mpx/largeur', () => {
  // A2 paysage : borner le côté à mpx/W donnerait 1 679 et une cinquième
  // colonne. La hauteur de bande réelle (1 678) passe : le côté doit rester à
  // 1 998, et le format garder ses douze tuiles.
  const c = coteTuileUtile([7087, 5032], 25)
  assert.equal(c, 1998)
  assert.equal(planTuiles([7087, 5032], c).colonnes, 4)
})

test('coteTuileUtile descend vraiment quand une bande ne passe pas', () => {
  // une affiche absurdement large : la bande ne peut pas tenir à 2 048 de haut
  const totalPx = [20000, 8000]
  const c = coteTuileUtile(totalPx, 0)
  const plan = planTuiles(totalPx, c)
  const max = Math.max(...bandesDuPlan(plan).map((b) => b.largeur * b.hauteur))
  assert.ok(c < 2048, 'le côté aurait dû descendre')
  assert.ok(max <= MPX_CANEVAS_MAX, `bande de ${(max / 1e6).toFixed(2)} Mpx`)
})

// ═══════════════════════════════════════════════════════════════════════════
// LA FENÊTRE D'UNE TUILE
// ═══════════════════════════════════════════════════════════════════════════

test('tuileRecouverte borne la marge à l’image — un bord d’affiche n’a pas de voisin', () => {
  const plan = planTuiles([400, 300], 100)
  const coin = plan.tuiles[0]
  const r = tuileRecouverte(plan, coin, 20)
  assert.equal(r.cadrage.offsetX, 0)
  assert.equal(r.cadrage.offsetY, 0)
  assert.equal(r.rogneX, 0, 'rien à rogner du côté où rien n’a été ajouté')
  assert.equal(r.rogneY, 0)
  assert.equal(r.cadrage.width, coin.w + 20, 'la marge n’existe que du côté intérieur')

  const milieu = plan.tuiles.find((t) => t.i === 1 && t.j === 1)
  const m = tuileRecouverte(plan, milieu, 20)
  assert.equal(m.rogneX, 20)
  assert.equal(m.rogneY, 20)
  assert.equal(m.cadrage.width, milieu.w + 40)
  assert.equal(m.cadrage.height, milieu.h + 40)
})

test('tuileRecouverte à marge nulle EST cadrageTuile — le chemin sans effets ne change pas', () => {
  const plan = planTuiles([421, 317], 97)
  for (const t of plan.tuiles) {
    const r = tuileRecouverte(plan, t, 0)
    assert.deepEqual(r.cadrage, { fullWidth: 421, fullHeight: 317, offsetX: t.x, offsetY: t.y, width: t.w, height: t.h })
    assert.equal(r.rogneX, 0)
    assert.equal(r.rogneY, 0)
  }
})

test('bandesDuPlan rend une ligne de tuiles par bande, dans l’ordre, sans trou', () => {
  const plan = planTuiles([421, 317], 97)
  const bandes = bandesDuPlan(plan)
  assert.equal(bandes.length, plan.lignes)
  let y = 0
  for (const b of bandes) {
    assert.equal(b.y, y)
    assert.equal(b.largeur, 421)
    assert.equal(b.tuiles.length, plan.colonnes)
    assert.equal(b.tuiles.reduce((s, t) => s + t.w, 0), 421, 'une bande couvre toute la largeur')
    y += b.hauteur
  }
  assert.equal(y, 317, 'les bandes couvrent toute la hauteur')
})

// ═══════════════════════════════════════════════════════════════════════════
// LE PIÈGE Nº 1 — LA RECONSTRUCTION PENDANT L'EXPORT
// ═══════════════════════════════════════════════════════════════════════════
//
// L'arbitrage retenu : on RE-RÈGLE À CHAQUE TUILE plutôt que de geler la
// scène. Ce qui rend l'arbitrage sûr, c'est que le cycle est FERMÉ sur chaque
// tuile : traverser, poser, rendre, remettre. Un matériau né entre deux tuiles
// est donc pris au tour suivant, avec sa référence d'écran intacte — et un
// matériau déjà réglé n'est jamais réglé deux fois, ce qui composerait les
// échelles. Les deux moitiés se testent.

test('preparerTuile est rappelé à CHAQUE tuile — un calque reconstruit en route est repris', async () => {
  const banc = bancDeControle()
  const appels = []
  const r = await exporteAffichePavee({
    renderer: banc.renderer, composer: banc.composer, camera: banc.camera,
    totalPx: PLEINE, cote: COTE, dpi: 300, effets: { smaaActif: false },
    support: supportPreuve(),
    preparerTuile: ({ tuile, largeur, hauteur }) => {
      appels.push({ i: tuile.i, j: tuile.j, largeur, hauteur, rendu: false })
      return { restaurer() { appels[appels.length - 1].rendu = true } }
    },
  })
  assert.equal(appels.length, r.plan.tuiles.length, 'une préparation par tuile, pas une par affiche')
  assert.ok(appels.every((a) => a.rendu), 'chaque préparation doit être restaurée avant la suivante')
  // et la taille reçue est celle VRAIMENT servie au compositeur (réserve nº 3
  // de la tâche 5 : l'épaisseur se règle sur ce qui est peint)
  for (let k = 0; k < appels.length; k++) {
    const t = r.plan.tuiles[k]
    const c = tuileRecouverte(r.plan, t, r.recouvrementPx)
    assert.equal(appels[k].largeur, c.cadrage.width)
    assert.equal(appels[k].hauteur, c.cadrage.height)
  }
})

test('l’aspect servi au compositeur est celui de l’AFFICHE, jamais celui de la tuile', async () => {
  // ⚠️ TROIS COLONNES ET QUATRE LIGNES : aucune tuile n'a l'aspect de
  // l'affiche, donc l'erreur ne peut pas se cacher derrière une coïncidence.
  // three construit le frustum COMPLET à partir de `camera.aspect`, puis
  // `setViewOffset` y découpe une fenêtre : lui donner l'aspect d'une tuile
  // étire chaque tuile, et c'est le défaut nº 2 de la tâche 2.
  const banc = bancDeControle()
  const vus = []
  await exporteAffichePavee({
    renderer: banc.renderer, composer: banc.composer, camera: banc.camera,
    totalPx: PLEINE, cote: COTE, dpi: 300, effets: { smaaActif: false },
    support: supportPreuve(),
    // on lit l'aspect À L'ENTRÉE de la préparation, c'est-à-dire ce
    // qu'`applySize` vient de poser et avant que `setViewOffset` ne le réécrive
    preparerTuile: ({ cadrage }) => {
      vus.push({ aspect: banc.camera.aspect, tuile: cadrage.width / cadrage.height })
      return { restaurer() {} }
    },
  })
  const attendu = PLEINE[0] / PLEINE[1]
  for (const v of vus) {
    assert.ok(Math.abs(v.aspect - attendu) < 1e-12, `aspect ${v.aspect} au lieu de ${attendu}`)
    assert.ok(Math.abs(v.tuile - attendu) > 0.05, 'aucune tuile ne doit avoir l’aspect de l’affiche, sinon le test est vide')
  }
})

test('la restauration d’une tuile passe même si le rendu jette', async () => {
  const banc = bancDeControle()
  let poses = 0
  let restaurees = 0
  banc.composer.render = () => { poses++; if (poses === 3) throw new Error('tuile perdue') }
  await assert.rejects(() => exporteAffichePavee({
    renderer: banc.renderer, composer: banc.composer, camera: banc.camera,
    totalPx: PLEINE, cote: COTE, dpi: 300, effets: { smaaActif: false },
    support: supportPreuve(),
    preparerTuile: () => ({ restaurer() { restaurees++ } }),
  }), /tuile perdue/)
  assert.equal(restaurees, 3, 'la tuile qui a échoué doit être restaurée comme les autres')
})

test('avantTirage est attendu UNE FOIS, avant la première tuile', async () => {
  const banc = bancDeControle()
  const ordre = []
  await exporteAffichePavee({
    renderer: banc.renderer, composer: banc.composer, camera: banc.camera,
    totalPx: PLEINE, cote: COTE, dpi: 300, effets: { smaaActif: false },
    support: supportPreuve(),
    avantTirage: async () => { await Promise.resolve(); ordre.push('repos') },
    preparerTuile: () => { ordre.push('tuile'); return { restaurer() {} } },
  })
  assert.equal(ordre.filter((o) => o === 'repos').length, 1, 'un seul instant de carte, pas un par tuile')
  assert.equal(ordre[0], 'repos', 'la mise au repos passe avant la première tuile')
})

test('l’état du moteur est rendu à la fin, et aussi sur erreur', async () => {
  const banc = bancDeControle()
  banc.composer.setSize(1280, 720)
  banc.camera.aspect = 1.777
  await exporteAffichePavee({
    renderer: banc.renderer, composer: banc.composer, camera: banc.camera,
    totalPx: PLEINE, cote: COTE, dpi: 300, effets: { smaaActif: false },
    support: supportPreuve(), preparerTuile: () => ({ restaurer() {} }),
  })
  const taille = banc.renderer.getSize(new THREE.Vector2())
  assert.equal(taille.x, 1280, 'la vue interactive doit retrouver sa taille')
  assert.equal(taille.y, 720)
  assert.equal(banc.camera.aspect, 1.777)
})

test('l’annulation s’arrête entre deux bandes et rend quand même l’état', async () => {
  const banc = bancDeControle()
  banc.composer.setSize(800, 600)
  let bandes = 0
  await assert.rejects(() => exporteAffichePavee({
    renderer: banc.renderer, composer: banc.composer, camera: banc.camera,
    totalPx: PLEINE, cote: COTE, dpi: 300, effets: { smaaActif: false },
    support: supportPreuve(), preparerTuile: () => ({ restaurer() {} }),
    annule: () => bandes++ >= 2,
  }), /annul/i)
  assert.equal(banc.renderer.getSize(new THREE.Vector2()).x, 800)
})

// ═══════════════════════════════════════════════════════════════════════════
// LE PIÈGE Nº 3 — LES BANDES NE S'ACCUMULENT PAS NON PLUS
// ═══════════════════════════════════════════════════════════════════════════

test('les blobs ne sont pas conservés quand surBande les prend', async () => {
  const banc = bancDeControle()
  const pris = []
  const r = await exporteAffichePavee({
    renderer: banc.renderer, composer: banc.composer, camera: banc.camera,
    totalPx: PLEINE, cote: COTE, dpi: 300, effets: { smaaActif: false },
    support: supportPreuve(), preparerTuile: () => ({ restaurer() {} }),
    surBande: (b) => { pris.push(b.blob) },
  })
  assert.equal(pris.length, r.plan.lignes)
  assert.ok(pris.every(Boolean), 'chaque bande doit arriver encodée à l’appelant')
  assert.ok(r.bandes.every((b) => b.blob === null),
    'garder les douze bandes d’un A2, c’est reconstituer l’image pleine sous une autre forme')
})

test('sans surBande, les bandes sont rendues à l’appelant — il est alors seul juge', async () => {
  const banc = bancDeControle()
  const r = await exporteAffichePavee({
    renderer: banc.renderer, composer: banc.composer, camera: banc.camera,
    totalPx: PLEINE, cote: COTE, dpi: 300, effets: { smaaActif: false },
    support: supportPreuve(), preparerTuile: () => ({ restaurer() {} }),
  })
  assert.ok(r.bandes.every((b) => b.blob), 'un appelant qui ne consomme pas doit tout recevoir')
})

// ═══════════════════════════════════════════════════════════════════════════
// LE PIÈGE Nº 2 — `rabote` ET L'INCRUSTATION DU CRÉDIT
// ═══════════════════════════════════════════════════════════════════════════
//
// Quand le plafond matériel mord, `applySize` rend une taille RÉDUITE. Tant que
// `stampCredit` recevait la taille DEMANDÉE, il redessinait le tampon raboté
// dans un canevas plus grand — un ré-échantillonnage silencieux, de notre main
// cette fois.
//
// ⚠️ ET CETTE BRANCHE N'EST PAS THÉORIQUE. Le pavage la rend inatteignable pour
// l'affiche (tuiles sous 2 048), mais `exportImage` sert aussi le menu d'export
// d'écran, dont le cran 4K demande 3 840 px sur une machine qui peut n'admettre
// que 2 048 — le minimum autorisé par la spécification WebGL2.

function bancIncrustation(limite) {
  const canevas = []
  const doc = {
    createElement: () => {
      const c = {
        width: 0, height: 0,
        getContext: () => ({
          drawImage(_, x, y, w, h) { c.dessine = { x, y, w, h } },
          fillText() {}, set font(v) {}, set textAlign(v) {}, set textBaseline(v) {},
          set shadowColor(v) {}, set shadowBlur(v) {}, set fillStyle(v) {},
        }),
        toBlob: (cb) => cb({ marque: true }),
      }
      canevas.push(c)
      return c
    },
  }
  return {
    canevas,
    installer() {
      const anciens = { document: globalThis.document, createImageBitmap: globalThis.createImageBitmap, warn: console.warn }
      globalThis.document = doc
      globalThis.createImageBitmap = async () => ({ close() {} })
      console.warn = () => {}
      return () => {
        globalThis.document = anciens.document
        globalThis.createImageBitmap = anciens.createImageBitmap
        console.warn = anciens.warn
      }
    },
    contexte: {
      renderer: {
        setPixelRatio() {},
        getPixelRatio: () => 1,
        getContext: () => (limite > 0
          ? { MAX_TEXTURE_SIZE: 0x0d33, MAX_RENDERBUFFER_SIZE: 0x84e8, getParameter: () => limite }
          : null),
        getSize: (v) => { v.x = 100; v.y = 100; return v },
        domElement: { toBlob: (cb) => cb({ brut: true }) },
      },
      composer: { setSize() {}, render() {} },
      camera: { aspect: 1, updateProjectionMatrix() {} },
    },
  }
}

test('le crédit s’incruste à la taille VRAIMENT rendue quand le plafond mord', async () => {
  const banc = bancIncrustation(2048)
  const rendre = banc.installer()
  try {
    await exportImage({ ...banc.contexte, width: 3840, height: 2160, credit: 'test' })
  } finally { rendre() }
  const c = banc.canevas[0]
  assert.ok(c, 'stampCredit doit avoir ouvert un canevas')
  // 3840 × 2160 sous une limite de 2048 → 2048 × 1152, l'aspect préservé
  assert.equal(c.width, 2048, 'le canevas d’incrustation doit faire la taille rendue, pas la taille demandée')
  assert.equal(c.height, 1152)
  assert.deepEqual(c.dessine, { x: 0, y: 0, w: 2048, h: 1152 },
    'redessiner aux dimensions demandées étirerait le tampon raboté')
})

test('sans rabotage, l’incrustation ne change strictement rien', async () => {
  const banc = bancIncrustation(0) // aucune limite lisible
  const rendre = banc.installer()
  try {
    await exportImage({ ...banc.contexte, width: 1920, height: 1080, credit: 'test' })
  } finally { rendre() }
  const c = banc.canevas[0]
  assert.equal(c.width, 1920)
  assert.equal(c.height, 1080)
})
