// LE VOLUME DE NUAGES DOIT ÊTRE IDENTIQUE AU BIT PRÈS, ET CE TEST EST LÀ POUR ÇA.
//
// Contexte : la cuisson coûtait 455 ms MESURÉES sur le fil principal, en plein
// chargement. Elle est passée dans un Worker (src/cloud-volume-worker.js) qui
// appelle EXACTEMENT la même fonction que le repli synchrone — l'identité est
// donc structurelle. Mais « structurelle » vieillit : le jour où quelqu'un
// déroulera une boucle, changera un `Math.round` ou touchera au hachage, il
// n'aura ni test rouge ni erreur, juste des nuages différents. Or les nuages
// sont l'identité de la scène ; c'était la contrainte NON NÉGOCIABLE du
// chantier de performance.
//
// L'empreinte ci-dessous a été relevée sur le code d'origine (commit b13eac6,
// avant tout déplacement). Si elle change, ce n'est pas le test qu'il faut
// mettre à jour : c'est le calcul qui a dérivé, et il faut savoir pourquoi.
import test from 'node:test'
import assert from 'node:assert/strict'
import { cuireDonneesVolume, VOL } from '../src/cloud-volume-noyau.js'

// Une seule cuisson pour tout le fichier : elle coûte ~0,4 s.
const volume = cuireDonneesVolume()

const empreinte = (a) => {
  let x = 0
  for (let i = 0; i < a.length; i++) x = (x * 31 + a[i]) >>> 0
  return x
}
const somme = (a) => {
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i]
  return s
}

test('la forme du volume : 64³ voxels, deux canaux, un octet chacun', () => {
  assert.equal(VOL, 64)
  assert.ok(volume instanceof Uint8Array)
  assert.equal(volume.length, VOL * VOL * VOL * 2)
})

test('EMPREINTE DE RÉFÉRENCE — relevée avant le passage au Worker', () => {
  // Ces deux nombres viennent du code d'origine. Ils verrouillent le calcul
  // entier : un seul octet qui bouge les fait bouger tous les deux.
  assert.equal(empreinte(volume), 3474881748, 'le volume de nuages a CHANGÉ — voir l’en-tête de ce fichier')
  assert.equal(somme(volume), 95283372, 'le volume de nuages a CHANGÉ — voir l’en-tête de ce fichier')
})

test('la cuisson est DÉTERMINISTE : deux appels donnent le même octet', () => {
  // C'est ce qui autorise le Worker : le fil principal et lui appellent la même
  // fonction, mais dans deux contextes JavaScript différents. Sans déterminisme,
  // le repli synchrone rendrait un ciel différent du chemin nominal — et ce
  // serait un défaut INTERMITTENT, le pire de tous à diagnostiquer.
  const bis = cuireDonneesVolume()
  assert.notEqual(bis, volume, 'chaque appel doit rendre un tampon NEUF (il est transféré au Worker)')
  assert.deepEqual(bis, volume)
})

test('aucune valeur aberrante : tout tient dans un octet, sans NaN', () => {
  // `Math.round(NaN)` vaut NaN, et l'écrire dans un Uint8Array donne 0 en
  // silence — un ciel troué au lieu d'une erreur. On vérifie donc que les deux
  // canaux occupent vraiment leur plage au lieu de se croire remplis.
  let minR = 255, maxR = 0, minG = 255, maxG = 0
  for (let i = 0; i < volume.length; i += 2) {
    if (volume[i] < minR) minR = volume[i]
    if (volume[i] > maxR) maxR = volume[i]
    if (volume[i + 1] < minG) minG = volume[i + 1]
    if (volume[i + 1] > maxG) maxG = volume[i + 1]
  }
  assert.ok(maxR > minR, 'le canal R (billows) est constant : le bruit ne s’écrit plus')
  assert.ok(maxG > minG, 'le canal G (couverture) est constant : le champ ne s’écrit plus')
  assert.equal(maxR, 255, 'le canal R n’atteint plus son plafond')
})

test('le volume est TUILABLE : les faces opposées se recollent', () => {
  // Tout le module existe pour ça — un volume non tuilable fait apparaître une
  // couture rectiligne dans le ciel quand la texture se répète. On ne peut pas
  // exiger l'égalité stricte (le voxel 63 n'est pas le voxel −1, il en est le
  // voisin), mais un saut franc trahirait la perte du repliement.
  const at = (x, y, z, c) => volume[((z * VOL + y) * VOL + x) * 2 + c]
  let pireX = 0
  for (let z = 0; z < VOL; z += 7)
    for (let y = 0; y < VOL; y += 7) {
      // l'écart entre les deux bords doit rester de l'ordre d'un pas de voxel,
      // c'est-à-dire comparable à l'écart entre deux voxels voisins au centre
      const bord = Math.abs(at(0, y, z, 0) - at(VOL - 1, y, z, 0))
      if (bord > pireX) pireX = bord
    }
  assert.ok(pireX < 120, `couture en X : écart maximal de ${pireX} — le volume n’est plus tuilable`)
})
