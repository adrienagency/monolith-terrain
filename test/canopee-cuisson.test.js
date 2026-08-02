import test from 'node:test'
import assert from 'node:assert/strict'
import { decompresseLzw, defaisPredicteur, nomDalle, MUET, EST_ABSENT } from '../scripts/build-canopee.mjs'
import { CANOPEE_SOL_NU, CANOPEE_H_ABSURDE, forceCanopee } from '../src/canopee.js'

// ═══════════════════════════════════════════════════════════════════════════
// LE DÉCOMPRESSEUR LZW — la seule vraie logique neuve du cuiseur
// ═══════════════════════════════════════════════════════════════════════════
//
// ⚠️ POURQUOI IL FAUT UN ENCODEUR DANS LE TEST, ET PAS UN FICHIER TÉMOIN.
// Un bloc réel du COG ETH pèse ~200 Ko : le figer dans le dépôt pour tester
// 60 lignes serait cher, et surtout ça n'exercerait qu'UN chemin. L'encodeur
// ci-dessous suit la spec TIFF (code de purge en tête, `early change`, EOI en
// queue) et permet de FABRIQUER les cas rares — celui du dictionnaire qui
// déborde, et le KwKwK — qu'un bloc pris au hasard ne contient presque jamais.
//
// Le décodeur, lui, a déjà été confronté à la vraie donnée avant d'être écrit :
// N45E006, blocs des niveaux 3, 5 et 6, 1 048 576 octets rendus à chaque fois.
// Ce test protège contre la RÉGRESSION, il ne remplace pas cette confrontation.
function compresseLzw(src) {
  const bits = []
  let largeur = 9
  const pousse = (code) => {
    for (let i = largeur - 1; i >= 0; i--) bits.push((code >> i) & 1)
  }
  const dico = new Map()
  const raz = () => {
    dico.clear()
    for (let i = 0; i < 256; i++) dico.set(String.fromCharCode(i), i)
    return 258
  }
  let libre = raz()
  pousse(256) // CLEAR en tête, comme l'exige la spec
  let w = ''
  for (const octet of src) {
    const c = String.fromCharCode(octet)
    if (dico.has(w + c)) { w += c; continue }
    pousse(dico.get(w))
    if (libre < 4096) dico.set(w + c, libre++)
    // ⚠️ LE SEUIL DE L'ENCODEUR EST CELUI DU DÉCODEUR PLUS UN, ET C'EST TOUT
    // L'INTÉRÊT DE CE TEST. Le décodeur ajoute son entrée de dictionnaire UN
    // CODE PLUS TARD que l'encodeur (il lui faut le code suivant pour connaître
    // le premier octet de la suite) : il est donc en permanence une entrée en
    // retard. Pour que les deux changent de largeur sur le MÊME code, leurs
    // seuils doivent différer d'exactement un — `libre >= 2^largeur` ici,
    // `libre + 1 >= 2^largeur` là-bas.
    //
    // Écrire le même seuil des deux côtés paraît symétrique et se désynchronise
    // au 254e code : le début du flux est parfait, la suite est du bruit. C'est
    // la faute qui a été commise en écrivant CE test, et le décodeur — lui,
    // déjà confronté à la vraie donnée ETH — avait raison.
    if (libre >= 1 << largeur && largeur < 12) largeur++
    w = c
  }
  if (w !== '') pousse(dico.get(w))
  pousse(257) // EOI
  while (bits.length % 8) bits.push(0)
  const out = Buffer.alloc(bits.length / 8)
  for (let i = 0; i < bits.length; i++) if (bits[i]) out[i >> 3] |= 0x80 >> (i & 7)
  return out
}

const rendu = (src) => Buffer.from(decompresseLzw(compresseLzw(src), src.length))

test('LZW : un aller-retour rend EXACTEMENT les octets de départ', () => {
  const cas = {
    vide: Buffer.alloc(0),
    'un octet': Buffer.from([42]),
    'tous les octets': Buffer.from(Array.from({ length: 256 }, (_, i) => i)),
  }
  for (const [nom, src] of Object.entries(cas)) {
    assert.deepEqual(rendu(src), src, nom)
  }
})

test('LZW : le cas KwKwK — un code qui n’existe pas encore au moment où on le lit', () => {
  // ⚠️ Le piège classique du LZW, et il ne se déclenche que sur des motifs
  // répétés — donc sur les grands aplats (mer, désert, canopée uniforme), et
  // presque jamais sur un bloc de test pris au milieu d'un massif. Un décodeur
  // sans ce cas lève « code inconnu » ou, pire, rend un octet de travers.
  for (const motif of [[7], [3, 9], [1, 1, 2]]) {
    const src = Buffer.from(Array.from({ length: 600 }, (_, i) => motif[i % motif.length]))
    assert.deepEqual(rendu(src), src, `motif ${motif}`)
  }
})

test('LZW : le dictionnaire DÉBORDE des 9 bits, plusieurs fois', () => {
  // C'est là que vit l'`early change`. Une entrée pseudo-aléatoire mais
  // DÉTERMINISTE, assez longue et assez variée pour franchir 511, 1023 et 2047.
  let graine = 12345
  const src = Buffer.from(
    Array.from({ length: 200000 }, () => {
      graine = (graine * 1103515245 + 12345) & 0x7fffffff
      // Des hauteurs plausibles, pas du bruit blanc : c'est ce qui fait grossir
      // le dictionnaire de la même façon que la vraie donnée.
      return (graine >> 16) % 45
    })
  )
  // ⚠️ `.equals()` ET PAS `deepEqual` SUR 200 000 OCTETS. node --test fabrique
  // un diff lisible quand deepEqual échoue : sur deux tampons de cette taille,
  // il met plusieurs MINUTES et le test paraît bloqué au lieu de rouge. C'est
  // exactement ce qui est arrivé en écrivant ce fichier.
  const sortie = rendu(src)
  assert.ok(sortie.equals(src), `aller-retour faux : ${sortie.length} octets rendus sur ${src.length}`)
})

test('LZW : un code de purge en cours de flux remet le dictionnaire à neuf', () => {
  // Un encodeur qui purge à mi-parcours (ce que font beaucoup d'outils quand le
  // taux se dégrade) doit rester lisible. Ici on colle deux flux bout à bout,
  // chacun commençant par son propre CLEAR.
  const a = Buffer.from([5, 5, 5, 9, 9, 12])
  const b = Buffer.from([31, 31, 8])
  const fusion = Buffer.concat([compresseLzw(a).subarray(0, compresseLzw(a).length), compresseLzw(b)])
  // `strict:false` : deux flux colles bout a bout produisent forcement un
  // compte different de l'attendu — c'est le sujet meme du test.
  const sortie = Buffer.from(decompresseLzw(fusion, 64, { strict: false }))
  // On ne vérifie que le début : le raccord binaire de deux flux alignés à
  // l'octet insère du bourrage, et ce test ne prétend qu'à « la purge ne casse
  // pas le décodeur ».
  assert.deepEqual(sortie.subarray(0, a.length), a)
})

// ═══════════════════════════════════════════════════════════════════════════
// LE PRÉDICTEUR 2
// ═══════════════════════════════════════════════════════════════════════════

test('le prédicteur se défait PAR LIGNE, et la ligne est celle de la TUILE INTERNE', () => {
  // ⚠️ Le défaut que ce test ferme ne lève rien : avec la mauvaise largeur, la
  // reconstitution se décale d'un cran de plus à chaque ligne et rend une image
  // qui « bave » vers la droite. Sur une carte de forêts, ça ressemble encore
  // beaucoup à une carte de forêts.
  const largeur = 4
  // Deux lignes : chacune repart de sa PREMIÈRE valeur absolue.
  const diff = Buffer.from([10, 2, 3, 250, /* ligne 2 */ 30, 1, 1, 1])
  assert.deepEqual([...defaisPredicteur(Buffer.from(diff), largeur)], [10, 12, 15, 9, 30, 31, 32, 33])
})

test('le prédicteur reboucle en octet non signé, il ne sature pas', () => {
  // 250 + 10 doit rendre 4, pas 255. Saturer fabriquerait un plafond de forêt
  // à 255 m — c'est-à-dire exactement le « pas de donnée » qu'on neutralise
  // par ailleurs, réintroduit par une autre porte.
  assert.deepEqual([...defaisPredicteur(Buffer.from([250, 10]), 2)], [250, 4])
})

// ═══════════════════════════════════════════════════════════════════════════
// LA GRILLE DE DALLES
// ═══════════════════════════════════════════════════════════════════════════

test('le nom de dalle est celui du coin SUD-OUEST arrondi au multiple de 3', () => {
  // Relevé sur la vraie donnée : l'ancre TIFF de N45E006 donne lon 6 / lat 48,
  // c'est-à-dire le coin NORD-ouest d'une dalle dont le sud est à 45.
  assert.equal(nomDalle(6.86, 45.83), 'N45E006')
  assert.equal(nomDalle(6.0, 45.0), 'N45E006')
  assert.equal(nomDalle(8.99, 47.99), 'N45E006')
  assert.equal(nomDalle(9.0, 48.0), 'N48E009', 'la borne haute bascule sur la dalle suivante')
  // Les hémisphères sud et ouest : `Math.floor` sur un négatif descend, ce qui
  // est bien ce qu'on veut (−1,5 appartient à la dalle qui commence à −3).
  assert.equal(nomDalle(-1.2, 44.4), 'N42W003')
  assert.equal(nomDalle(-60.5, -3.2), 'S06W063')
})

// ═══════════════════════════════════════════════════════════════════════════
// LES DEUX TABLES — et pourquoi elles sont DEUX
// ═══════════════════════════════════════════════════════════════════════════

test('MUET vient du module client, il n’est pas recopié dans le cuiseur', () => {
  // ⚠️ Le jour où quelqu'un abaisse CANOPEE_SOL_NU, les tuiles qu'il attend
  // doivent se mettre à être écrites. Si le seuil était recopié ici, elles
  // auraient été écartées à la cuisson des mois plus tôt, sans trace.
  for (let h = 0; h < 256; h++) {
    assert.equal(MUET[h] === 1, forceCanopee(h) === 0, `hauteur ${h}`)
  }
  assert.equal(MUET[CANOPEE_SOL_NU], 1, 'le plancher lui-même est muet')
  assert.equal(MUET[CANOPEE_SOL_NU + 1], 0)
})

test('EST_ABSENT ne dit PAS la même chose que MUET — un buisson n’est pas un trou', () => {
  // Les deux tables ne servent pas au même geste : MUET décide si la TUILE vaut
  // la peine d'être écrite, EST_ABSENT décide si le PIXEL doit être remis à
  // zéro. Un buisson de 1 m est muet mais présent ; le 255 de la source est
  // absent. Les confondre effacerait les 1-2 m qui servent de plancher propre
  // au filtrage linéaire du GPU, et transformerait chaque lisière en marche.
  assert.equal(MUET[1], 1, '1 m est muet')
  assert.equal(EST_ABSENT[1], 0, '…mais 1 m est une vraie mesure, pas un trou')
  assert.equal(EST_ABSENT[255], 1, 'le « pas de donnée » de la source')
  assert.equal(EST_ABSENT[CANOPEE_H_ABSURDE], 1)
  assert.equal(EST_ABSENT[CANOPEE_H_ABSURDE - 1], 0)
  // Le plus grand arbre du monde monte à 116 m : 40 doit rester une forêt.
  assert.equal(EST_ABSENT[40], 0)
})

// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ UN FLUX TRONQUÉ DOIT LEVER, PAS RENDRE UNE TUILE À MOITIÉ VIDE
// ═══════════════════════════════════════════════════════════════════════════
//
// LE DÉFAUT MESURÉ : `decompresseLzw` s'arrêtait sur la fin du flux et rendait
// `subarray(0, o)` sans jamais comparer `o` à la taille attendue. Un flux coupé
// à 90 % rendait 7 397 octets au lieu de 8 192, SANS AUCUNE EXCEPTION.
//
// Ce qui suit est le vrai coût : les pixels manquants restent à 0, la tuile
// reste « parlante », elle est donc ÉCRITE — et `--reprendre`, qui ne teste que
// l'existence du fichier, ne la refera jamais. À l'écran, une bande de forêt qui
// disparaît au milieu d'une tuile, indiscernable d'une clairière.
//
// Le jumeau du sol est protégé GRATUITEMENT par `zlib.inflateSync`, qui lève
// `Z_BUF_ERROR` sur un flux tronqué. Celui de la canopée n'était protégé par
// rien : c'est la seule raison pour laquelle ce garde doit être écrit à la main.
test('LZW : un flux TRONQUÉ lève, au lieu de rendre une tuile partielle en silence', () => {
  const src = Buffer.from(Array.from({ length: 8192 }, (_, i) => (i * 7 + (i >> 5)) & 0xff))
  const comprime = compresseLzw(src)
  const tronque = comprime.subarray(0, Math.floor(comprime.length * 0.9))
  assert.throws(
    () => decompresseLzw(tronque, src.length),
    /tronqu|incomplet|octets/i,
    'un flux coupé à 90 % doit lever, pas rendre 7 397 octets sur 8 192'
  )
})

test('LZW : le flux ENTIER rend toujours exactement la taille attendue', () => {
  // Le garde ne doit pas rougir sur le cas normal : c'est la vraie donnée ETH
  // qui passe par là, 1 048 576 octets par bloc.
  const src = Buffer.from(Array.from({ length: 4096 }, (_, i) => (i * 13) & 0xff))
  const sortie = decompresseLzw(compresseLzw(src), src.length)
  assert.equal(sortie.length, src.length)
  assert.deepEqual(Buffer.from(sortie), src)
})
