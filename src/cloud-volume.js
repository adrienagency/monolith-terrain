// Volume de bruit des nuages — Perlin-Worley tuilable, cuit UNE fois et partagé
// par toutes les entités du ciel. Canal R = billows (un Worley inversé qui
// dilate un FBM de Perlin, d'où des choux-fleurs connectés), canal G = un Worley
// 2D basse fréquence qui sert de champ de couverture.
//
// Ce module est né de l'ancien moteur de nuages (src/clouds.js, SUPPRIMÉ) :
// c'était la seule chose qui méritait d'en être gardée. Le reste — une boîte
// unique raymarchée couvrant toute la carte, seuillée pour sculpter des bancs —
// est remplacé par les ENTITÉS de clouds2.js, et n'a plus à traîner en repli.
//
// ═══════════════════════════════════════════════════════════════════════════
// LE CALCUL N'EST PLUS ICI, ET IL NE BLOQUE PLUS LE DÉMARRAGE
// ═══════════════════════════════════════════════════════════════════════════
//
// MESURÉ (profil V8, build de production servi, cache vidé) : la cuisson coûte
// **455 ms sur le fil principal**, dans la tranche 1000–1750 ms du chargement,
// c'est-à-dire pile pendant que les tuiles d'altitude arrivent et que le relief
// se bâtit. C'était le troisième poste du démarrage, derrière noise.js et three.
//
// Ce qui change : `lanceCuissonVolume()` démarre un Worker le plus tôt possible
// (main.js l'appelle à l'évaluation du module), et quand `bakeCloudVolume()` est
// enfin réclamée — vers 1 000 ms — les données sont déjà là. Le fil principal ne
// paie plus que l'emballage en texture, qui est immédiat.
//
// ⚠️ ET SI LE WORKER N'A PAS FINI ? On cuit sur le fil principal, exactement
// comme avant. **Ce chemin ne peut donc JAMAIS être plus lent que l'ancien** —
// au pire il est identique, et on aura occupé un cœur pour rien. C'est la seule
// forme de ce correctif qui soit sans risque de régression : pas d'attente, pas
// de promesse à tenir, pas d'ordre d'appel à respecter, aucun appelant à changer.
//
// ⚠️ IDENTITÉ AU BIT PRÈS. Le Worker et le repli appellent LA MÊME fonction
// (`cuireDonneesVolume`, dans cloud-volume-noyau.js). Il n'existe pas deux
// versions de l'algorithme à garder d'accord : l'identité est structurelle, pas
// surveillée. Les nuages sont l'identité de la scène — c'était la contrainte non
// négociable de ce chantier.

import * as THREE from 'three'
import { cuireDonneesVolume, VOL } from './cloud-volume-noyau.js'

let sharedVolume = null // { tex, data } — cuit une fois, réutilisé par tous les rebuilds
let donneesPretes = null // données rendues par le Worker, en attente d'emballage
let worker = null

/**
 * Démarre la cuisson en tâche de fond. Idempotent, et sans effet si le volume
 * est déjà cuit ou si un Worker tourne déjà.
 *
 * Ne lève JAMAIS : un navigateur sans Worker de module, une politique de
 * sécurité qui l'interdit, un `new URL(import.meta.url)` qui ne résout pas — tout
 * cela doit laisser le site démarrer, avec le repli synchrone.
 */
export function lanceCuissonVolume() {
  if (sharedVolume || donneesPretes || worker) return
  try {
    worker = new Worker(new URL('./cloud-volume-worker.js', import.meta.url), { type: 'module' })
    worker.onmessage = (e) => {
      // Si le fil principal a déjà cuit le volume pendant que le Worker
      // travaillait, son résultat n'a plus d'emploi : on le jette. Garder les
      // deux, ce serait 524 Ko de doublon et deux textures possibles pour un
      // objet qui est censé être unique.
      if (!sharedVolume) donneesPretes = e.data?.data ?? null
      arreteWorker()
    }
    worker.onerror = () => arreteWorker()
  } catch {
    worker = null
  }
}

function arreteWorker() {
  try { worker?.terminate() } catch { /* déjà mort */ }
  worker = null
}

export function bakeCloudVolume() {
  if (sharedVolume) return sharedVolume
  // le Worker a gagné la course → zéro milliseconde de calcul ici
  const data = donneesPretes ?? cuireDonneesVolume()
  donneesPretes = null
  arreteWorker() // plus personne n'attend son résultat
  const tex = new THREE.Data3DTexture(data, VOL, VOL, VOL)
  tex.format = THREE.RGFormat
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.wrapS = tex.wrapT = tex.wrapR = THREE.RepeatWrapping
  tex.unpackAlignment = 1
  tex.needsUpdate = true
  sharedVolume = { tex, data }
  return sharedVolume
}
