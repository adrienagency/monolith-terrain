// L'EMBALLAGE PDF — CE QUE LE PRÉFLIGHT REGARDE, VÉRIFIÉ ICI
//
// ⚠️ CE FICHIER NE PROUVE PAS LA CONFORMITÉ PDF/X. Aucun validateur PDF/X libre
// n'existe (veraPDF ne couvre que PDF/A et PDF/UA) : ce qui se vérifie sous node,
// ce sont les GRANDEURS et les STRUCTURES — les boîtes, leur inclusion, leur
// centrage, la position des repères, la présence de l'intention de sortie, du
// profil incorporé et du paquet XMP. Qu'un préflight professionnel les accepte
// se vérifie dans Acrobat Pro, et nulle part ailleurs.
//
// Ce que ce fichier tient, dans l'ordre de ce que ça coûterait :
//   1. les BOÎTES — un TrimBox faux, c'est une affiche coupée au mauvais format ;
//   2. l'INCLUSION et le CENTRAGE — un BleedBox hors MediaBox, c'est un refus ;
//   3. le DÉCALAGE DES REPÈRES — trop court, ils retombent sur le fond perdu et
//      disparaissent sur une affiche sombre (le défaut signalé par Adrien) ;
//   4. la JOINTURE DES BANDES — un cheveu clair en travers de l'affiche ;
//   5. l'ÉTIQUETAGE — un fichier non étiqueté part sur une supposition.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FOND_PERDU_MM } from '../src/print-page.js'
import {
  PT_PAR_POUCE,
  mmVersPt,
  ptVersMm,
  boitesAffiche,
  verifierBoites,
  besoinMargeReperes,
  planReperes,
  placerBandes,
  metadonneesXmp,
  poidsPdfAttendu,
  construirePdfAffiche,
  MARGE_MEDIA_MM,
  REPERES_AUCUN,
  REPERES_COINS,
  DECALAGE_MM_MIN,
  EPAISSEUR_MM_MAX,
  CHEVAUCHEMENT_PT,
  FORMAT_RECOMMANDE,
  SOUS_TYPE_PDFX,
  VERSION_PDFX,
  CONDITION_SORTIE,
} from '../src/pdf-affiche.js'

// Un JPEG 1 × 1 valide, en base64. Sa TAILLE n'a aucune importance : le
// placement d'une image dans un PDF est donné par le rectangle de destination,
// pas par les pixels. Ce qu'on veut d'elle, c'est qu'`embedJpg` l'accepte.
const JPEG_1PX = Buffer.from(
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a'
  + 'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIy'
  + 'MjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIA'
  + 'AhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQA'
  + 'AAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3'
  + 'ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWm'
  + 'p6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEA'
  + 'AwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSEx'
  + 'BhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElK'
  + 'U1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3'
  + 'uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iii'
  + 'gD//2Q==',
  'base64'
)
const bandeJpeg = (hauteurPx) => ({ octets: new Uint8Array(JPEG_1PX), type: 'image/jpeg', hauteurPx })

const PRESQUE = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps

// ═══════════════════════════════════════════════════════════════════════════
// ① L'UNITÉ
// ═══════════════════════════════════════════════════════════════════════════

test('le point PDF vaut 1/72 de pouce, pas le point typographique', () => {
  assert.equal(PT_PAR_POUCE, 72)
  // 210 mm (la largeur d'un A4) = 595,2755… pt. C'est le nombre que tout lecteur
  // de PDF affiche pour un A4 ; s'il change, c'est la conversion qui est fausse.
  assert.ok(PRESQUE(mmVersPt(210), 595.2755905511812, 1e-9))
  assert.ok(PRESQUE(ptVersMm(mmVersPt(123.456)), 123.456, 1e-9))
  assert.equal(mmVersPt(undefined), 0)
})

// ═══════════════════════════════════════════════════════════════════════════
// ② LES BOÎTES
// ═══════════════════════════════════════════════════════════════════════════

test('le TrimBox est le format fini EXACT, au point près', () => {
  const b = boitesAffiche({ largeurMm: 500, hauteurMm: 700 })
  assert.ok(PRESQUE(b.trimBox[2] - b.trimBox[0], mmVersPt(500)))
  assert.ok(PRESQUE(b.trimBox[3] - b.trimBox[1], mmVersPt(700)))
  // et en millimètres, pour que l'erreur se lise si elle survient
  assert.ok(PRESQUE(ptVersMm(b.trimBox[2] - b.trimBox[0]), 500, 1e-9))
  assert.ok(PRESQUE(ptVersMm(b.trimBox[3] - b.trimBox[1]), 700, 1e-9))
})

test('le BleedBox est le TrimBox plus exactement 3 mm sur chaque bord', () => {
  const b = boitesAffiche({ largeurMm: 420, hauteurMm: 594 })
  assert.equal(FOND_PERDU_MM, 3, 'le plancher normatif vient de print-page.js et ne se change pas ici')
  for (const [bord, trim, signe] of [[0, 0, -1], [1, 1, -1], [2, 2, 1], [3, 3, 1]]) {
    assert.ok(
      PRESQUE(b.bleedBox[bord] - b.trimBox[trim], signe * mmVersPt(FOND_PERDU_MM)),
      `le fond perdu du bord ${bord} ne vaut pas 3 mm`
    )
  }
})

test('MediaBox ⊇ BleedBox ⊇ TrimBox, et les trois sont concentriques', () => {
  for (const [L, H] of [[210, 297], [300, 400], [610, 914], [700, 500]]) {
    const b = boitesAffiche({ largeurMm: L, hauteurMm: H })
    const v = verifierBoites(b)
    assert.ok(v.ok, `${L}×${H} : ${v.erreurs.join(' ; ')}`)
  }
})

test('verifierBoites REFUSE un BleedBox qui sort de la feuille', () => {
  const b = boitesAffiche({ largeurMm: 210, hauteurMm: 297 })
  const casse = { ...b, bleedBox: [-1, -1, b.mediaBox[2] + 1, b.mediaBox[3] + 1] }
  const v = verifierBoites(casse)
  assert.equal(v.ok, false)
  assert.match(v.erreurs.join(' '), /BleedBox sort de MediaBox/)
})

test('verifierBoites REFUSE un format fini décentré', () => {
  const b = boitesAffiche({ largeurMm: 210, hauteurMm: 297 })
  const decale = { ...b, trimBox: [b.trimBox[0] + 5, b.trimBox[1], b.trimBox[2] + 5, b.trimBox[3]] }
  assert.equal(verifierBoites(decale).ok, false)
})

test('la marge de feuille ne descend jamais sous le fond perdu', () => {
  // Un appelant qui demande zéro obtiendrait un BleedBox hors MediaBox : on
  // remonte au fond perdu, ce qui donne MediaBox = BleedBox.
  const b = boitesAffiche({ largeurMm: 210, hauteurMm: 297, margeMediaMm: 0 })
  assert.ok(verifierBoites(b).ok)
  assert.equal(b.mm.marge, FOND_PERDU_MM)
  for (let i = 0; i < 4; i++) assert.ok(PRESQUE(b.mediaBox[i], b.bleedBox[i]))
})

test('la marge s’élargit d’office pour contenir les repères demandés', () => {
  const longs = { decalageMm: 6, longueurMm: 20, epaisseurMm: 0.1 }
  const b = boitesAffiche({ largeurMm: 210, hauteurMm: 297, reperes: longs })
  assert.ok(b.mm.marge >= besoinMargeReperes(longs))
  assert.ok(b.mm.marge > MARGE_MEDIA_MM, 'la marge par défaut ne suffisait pas, elle aurait dû croître')
  assert.ok(verifierBoites(b).ok)
  // et les huit repères tiennent alors dans la feuille
  assert.equal(planReperes(b, longs).segments.length, 8)
})

// ═══════════════════════════════════════════════════════════════════════════
// ③ LES REPÈRES
// ═══════════════════════════════════════════════════════════════════════════

test('aucun repère par défaut — les prestataires travaillent aux boîtes', () => {
  assert.equal(REPERES_AUCUN, null)
  const b = boitesAffiche({ largeurMm: 500, hauteurMm: 700 })
  assert.deepEqual(planReperes(b, REPERES_AUCUN).segments, [])
  assert.deepEqual(planReperes(b).segments, [])
})

test('les repères demandés font huit segments, deux par angle', () => {
  const b = boitesAffiche({ largeurMm: 500, hauteurMm: 700, reperes: REPERES_COINS })
  const r = planReperes(b, REPERES_COINS)
  assert.equal(r.segments.length, 8)
  // chacun est soit horizontal soit vertical, jamais oblique
  for (const s of r.segments) {
    assert.ok(PRESQUE(s.x0, s.x1) || PRESQUE(s.y0, s.y1))
  }
})

test('⚠️ LE FOND SOMBRE : aucun repère n’entre dans le fond perdu', () => {
  // C'est LA vérification de ce fichier. Un repère dont l'extrémité intérieure
  // est à moins du fond perdu du trait de coupe est posé SUR L'IMAGE : sur une
  // carte de nuit il devient invisible, et on se met alors à chercher une
  // couleur de trait au lieu de corriger la position.
  const b = boitesAffiche({ largeurMm: 500, hauteurMm: 700, reperes: REPERES_COINS })
  const [tx0, ty0, tx1, ty1] = b.trimBox
  const fond = mmVersPt(FOND_PERDU_MM)
  for (const s of planReperes(b, REPERES_COINS).segments) {
    for (const [x, y] of [[s.x0, s.y0], [s.x1, s.y1]]) {
      // la distance du point à la boîte de coupe, en dehors d'elle
      const dx = Math.max(tx0 - x, x - tx1, 0)
      const dy = Math.max(ty0 - y, y - ty1, 0)
      const dehors = Math.max(dx, dy)
      assert.ok(
        dehors >= fond - 1e-9,
        `un repère passe à ${ptVersMm(dehors).toFixed(2)} mm du trait de coupe : il tombe dans le fond perdu`
      )
    }
  }
})

test('un décalage plus petit que le fond perdu est REMONTÉ, pas accepté', () => {
  const demande = { decalageMm: 0.5, longueurMm: 5, epaisseurMm: 0.1 }
  const b = boitesAffiche({ largeurMm: 210, hauteurMm: 297, reperes: demande })
  const r = planReperes(b, demande)
  assert.equal(r.decalageMm, DECALAGE_MM_MIN)
  assert.equal(DECALAGE_MM_MIN, FOND_PERDU_MM)
})

test('l’épaisseur est bornée à 0,1 mm, quelle que soit la demande', () => {
  const b = boitesAffiche({ largeurMm: 210, hauteurMm: 297, reperes: REPERES_COINS })
  const r = planReperes(b, { ...REPERES_COINS, epaisseurMm: 0.5 })
  assert.equal(r.epaisseurMm, EPAISSEUR_MM_MAX)
  assert.ok(r.epaisseurPt <= mmVersPt(0.1) + 1e-9)
  // une épaisseur nulle ne dessine rien plutôt qu'un trait de largeur zéro, que
  // les RIP rendent à un pixel de LEUR résolution — donc au hasard.
  assert.deepEqual(planReperes(b, { ...REPERES_COINS, epaisseurMm: 0 }).segments, [])
})

test('une feuille sans marge ne produit AUCUN repère plutôt que des repères hors feuille', () => {
  const b = boitesAffiche({ largeurMm: 210, hauteurMm: 297, margeMediaMm: FOND_PERDU_MM })
  // ici la marge a été forcée au fond perdu : il n'y a plus de papier nu
  assert.equal(b.mm.marge, FOND_PERDU_MM)
  assert.deepEqual(planReperes(b, REPERES_COINS).segments, [])
})

// ═══════════════════════════════════════════════════════════════════════════
// ④ LES BANDES
// ═══════════════════════════════════════════════════════════════════════════

test('les bandes couvrent le BleedBox exactement, du haut au bas', () => {
  const b = boitesAffiche({ largeurMm: 500, hauteurMm: 700 })
  const bandes = [{ hauteurPx: 2048 }, { hauteurPx: 2048 }, { hauteurPx: 2048 }, { hauteurPx: 2247 }]
  const places = placerBandes(b, bandes)
  assert.equal(places.length, 4)
  const [bx0, by0, bx1, by1] = b.bleedBox
  // le bas de la dernière bande tombe sur le bas du fond perdu
  assert.ok(PRESQUE(places[3].y, by0, 1e-9))
  // le haut de la première aussi, en haut
  assert.ok(PRESQUE(places[0].y + places[0].hauteur, by1, 1e-9))
  for (const p of places) {
    assert.ok(PRESQUE(p.x, bx0))
    assert.ok(PRESQUE(p.largeur, bx1 - bx0))
  }
})

test('⚠️ LA JOINTURE : chaque bande sauf la première déborde vers le HAUT', () => {
  // Deux images qui se touchent exactement laissent un cheveu clair. On fait
  // donc recouvrir la précédente par la suivante — et le BAS de chaque bande
  // reste exact, ce qui empêche toute dérive cumulée.
  const b = boitesAffiche({ largeurMm: 297, hauteurMm: 420 })
  const bandes = [{ hauteurPx: 1000 }, { hauteurPx: 1000 }, { hauteurPx: 1000 }]
  const places = placerBandes(b, bandes)
  const [, by0, , by1] = b.bleedBox
  const hauteurNominale = (by1 - by0) / 3
  assert.ok(PRESQUE(places[0].hauteur, hauteurNominale, 1e-9), 'la première bande ne déborde pas')
  for (let i = 1; i < 3; i++) {
    assert.ok(PRESQUE(places[i].hauteur, hauteurNominale + CHEVAUCHEMENT_PT, 1e-9))
    // le haut de la bande i couvre le bas de la bande i−1
    assert.ok(places[i].y + places[i].hauteur > places[i - 1].y)
  }
  // le chevauchement reste sous le dixième de millimètre : il ne peut pas se voir
  assert.ok(ptVersMm(CHEVAUCHEMENT_PT) < 0.1)
})

test('une bande unique n’a aucune jointure — c’est le cas nominal', () => {
  const b = boitesAffiche({ largeurMm: 210, hauteurMm: 297 })
  const [, by0, , by1] = b.bleedBox
  const [p] = placerBandes(b, [{ hauteurPx: 3579 }])
  assert.ok(PRESQUE(p.y, by0, 1e-9))
  assert.ok(PRESQUE(p.hauteur, by1 - by0, 1e-9))
})

// ═══════════════════════════════════════════════════════════════════════════
// ⑤ L'ÉTIQUETAGE
// ═══════════════════════════════════════════════════════════════════════════

test('le XMP porte la version PDF/X et un Trapped explicite', () => {
  const x = metadonneesXmp({ titre: 'Brest & la rade', auteur: 'ShibuMap', date: new Date('2026-08-06T10:00:00Z') })
  assert.match(x, /pdfxid:GTS_PDFXVersion>PDF\/X-4</)
  // ⚠️ « Unknown » est la valeur par défaut de beaucoup de producteurs, et elle
  // fait échouer le contrôle PDF/X sur un fichier par ailleurs impeccable.
  assert.match(x, /pdf:Trapped>False</)
  assert.doesNotMatch(x, /Unknown/)
  // le titre est échappé : une esperluette non échappée casse le paquet entier
  assert.match(x, /Brest &amp; la rade/)
  assert.match(x, /2026-08-06T10:00:00\.000Z/)
})

test('le poids d’un PDF de JPEG se déduit ; celui d’un PDF de PNG ne se déduit pas', () => {
  assert.equal(FORMAT_RECOMMANDE, 'image/jpeg')
  const p = poidsPdfAttendu({ octetsBandes: 12_000_000, bandes: 12 })
  assert.ok(p > 12_000_000 && p < 12_100_000)
  // chaque bande de plus coûte un objet image et quatre lignes de tracé
  assert.ok(poidsPdfAttendu({ octetsBandes: 0, bandes: 12 }) > poidsPdfAttendu({ octetsBandes: 0, bandes: 1 }))
  // pdf-lib décode le PNG et le recompresse sans prédicteur : le résultat n'a
  // plus de rapport avec le poids du PNG. On rend null plutôt qu'un nombre faux.
  assert.equal(poidsPdfAttendu({ octetsBandes: 12_000_000, type: 'image/png' }), null)
})

// ═══════════════════════════════════════════════════════════════════════════
// ⑥ LE FICHIER — RELU, PAS SEULEMENT ÉCRIT
// ═══════════════════════════════════════════════════════════════════════════

test('le PDF produit se relit, et ses trois boîtes sont celles qu’on a demandées', async () => {
  const { PDFDocument } = await import('@cantoo/pdf-lib')
  const r = await construirePdfAffiche({
    largeurMm: 500,
    hauteurMm: 700,
    bandes: [bandeJpeg(2048), bandeJpeg(2048)],
    titre: 'Contrôle',
    date: new Date('2026-08-06T10:00:00Z'),
  })
  const relu = await PDFDocument.load(r.octets, { updateMetadata: false })
  const page = relu.getPage(0)
  const trim = page.getTrimBox()
  const bleed = page.getBleedBox()
  const media = page.getMediaBox()
  assert.ok(PRESQUE(ptVersMm(trim.width), 500, 1e-6))
  assert.ok(PRESQUE(ptVersMm(trim.height), 700, 1e-6))
  assert.ok(PRESQUE(ptVersMm(bleed.width), 500 + 2 * FOND_PERDU_MM, 1e-6))
  assert.ok(PRESQUE(ptVersMm(bleed.height), 700 + 2 * FOND_PERDU_MM, 1e-6))
  assert.ok(PRESQUE(ptVersMm(media.width), 500 + 2 * MARGE_MEDIA_MM, 1e-6))
  // l'inclusion, relue sur le fichier et non sur le calcul
  assert.ok(bleed.x >= media.x - 1e-6 && bleed.x + bleed.width <= media.x + media.width + 1e-6)
  assert.ok(trim.x >= bleed.x - 1e-6 && trim.x + trim.width <= bleed.x + bleed.width + 1e-6)
})

test('le PDF porte l’intention de sortie PDF/X, le profil incorporé et le XMP', async () => {
  const r = await construirePdfAffiche({
    largeurMm: 210,
    hauteurMm: 297,
    bandes: [bandeJpeg(3508)],
    titre: 'Contrôle',
    date: new Date('2026-08-06T10:00:00Z'),
  })
  const texte = Buffer.from(r.octets).toString('latin1')
  assert.match(texte, /^%PDF-1\.6/, 'PDF/X-4 se fonde sur PDF 1.6')
  assert.match(texte, /\/OutputIntents/)
  assert.match(texte, new RegExp(`/${SOUS_TYPE_PDFX}`), 'le sous-type distingue PDF/X de PDF/A')
  assert.match(texte, /\/DestOutputProfile/)
  assert.match(texte, /\/Trapped \/False/)
  assert.match(texte, /\/ID \[/)
  assert.equal(r.versionPdfx, VERSION_PDFX)
  assert.equal(r.conditionSortie, CONDITION_SORTIE)
  // le profil sRGB IEC61966-2.1 fait 3 144 octets ; s'il disparaît, le fichier
  // repart sur une SUPPOSITION d'espace de couleur.
  assert.equal(r.profilOctets, 3144)
  // et le surcoût d'emballage reste marginal (structure + profil + XMP)
  assert.ok(r.surcout > 0 && r.surcout < 20_000, `surcoût inattendu : ${r.surcout} o`)
})

test('rien ne se déclare conforme', async () => {
  const r = await construirePdfAffiche({ largeurMm: 210, hauteurMm: 297, bandes: [bandeJpeg(100)] })
  assert.match(r.conformite, /sous réserve/)
})

test('un format absurde ou des bandes absentes lèvent, ils ne produisent pas un fichier', async () => {
  await assert.rejects(() => construirePdfAffiche({ largeurMm: 210, hauteurMm: 297, bandes: [] }), /aucune bande/)
  await assert.rejects(() => construirePdfAffiche({ largeurMm: 0, hauteurMm: 297, bandes: [bandeJpeg(10)] }), /format invalide/)
})

test('les repères demandés se retrouvent dans le contenu de la page', async () => {
  const sans = await construirePdfAffiche({ largeurMm: 210, hauteurMm: 297, bandes: [bandeJpeg(100)] })
  const avec = await construirePdfAffiche({ largeurMm: 210, hauteurMm: 297, bandes: [bandeJpeg(100)], reperes: REPERES_COINS })
  assert.equal(sans.reperes.segments.length, 0)
  assert.equal(avec.reperes.segments.length, 8)
  // huit traits de plus, c'est huit tracés de plus : le fichier grossit
  assert.ok(avec.octets.length > sans.octets.length)
})

// ═══════════════════════════════════════════════════════════════════════════
// LE NOM DU FICHIER — CE QUI ACCOMPAGNE L'AFFICHE CHEZ L'IMPRIMEUR
// ═══════════════════════════════════════════════════════════════════════════

test('le nom dit le lieu, le format et la densité — et n’en garde que de l’ASCII', async () => {
  const { nomFichierAffiche } = await import('../src/pdf-affiche.js')
  assert.equal(
    nomFichierAffiche({ titre: 'Chamonix-Mont-Blanc', format: '50x70', orientation: 'paysage', dpi: 250 }),
    'shibumap-chamonix-mont-blanc-50x70-paysage-250dpi.pdf'
  )
  // ⚠️ LES ACCENTS ET LES APOSTROPHES TYPOGRAPHIQUES NE TRAVERSENT PAS. Un
  // « Vallée d’Aoste » arrivé en `Vall_e_d_Aoste.pdf` chez le prestataire, ce
  // n'est pas une question de goût : c'est un en-tête `Content-Disposition` ou
  // un dépôt FTP qui a fait ce qu'il a pu.
  assert.equal(
    nomFichierAffiche({ titre: 'Vallée d’Aoste', format: 'a2', orientation: 'portrait', dpi: 300 }),
    'shibumap-vallee-d-aoste-a2-portrait-300dpi.pdf'
  )
  assert.match(nomFichierAffiche({ titre: 'Vallée d’Aoste' }), /^[a-z0-9.-]+$/)
})

test('un titre vide, absurde ou immense donne quand même un nom utilisable', async () => {
  const { nomFichierAffiche } = await import('../src/pdf-affiche.js')
  assert.equal(nomFichierAffiche({}), 'shibumap-affiche.pdf')
  assert.equal(nomFichierAffiche({ titre: '☃☃☃', format: 'a4', dpi: 300 }), 'shibumap-affiche-a4-300dpi.pdf')
  const long = nomFichierAffiche({ titre: 'a'.repeat(300), format: '50x70', orientation: 'paysage', dpi: 250 })
  assert.ok(long.length < 90, long)
  // et jamais de tiret orphelin au raccord : `…aaa-.pdf` est un nom qu'on relit
  // deux fois pour savoir s'il manque quelque chose
  assert.ok(!/--|-\./.test(long), long)
})
