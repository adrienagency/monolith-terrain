// LA MOSAÏQUE D'OCCUPATION DU SOL — la partie qui touche le réseau et le GPU.
//
// La règle de la couche (quelles classes, quelle couleur, quelle force, quelle
// adresse, où c'est cuit) vit dans src/occupation-sol.js, qui est pur et testé.
// Ici il n'y a que du canevas et de la texture.
//
// Même forme que src/map/nuit-layer.js, et pour la même raison : ce n'est pas
// un fournisseur de plus dans aerial-layer.js. `AerialLayer` choisit un
// fournisseur selon le pays puis compose un fond mondial dessous ; l'occupation
// du sol n'a ni pays, ni fond, ni trou à boucher.
//
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ CE QUI EST DIFFÉRENT DE TOUTES LES AUTRES MOSAÏQUES DU PROJET
// ═══════════════════════════════════════════════════════════════════════════
//
// Cette texture ne porte PAS une image. Elle porte des CODES DE CLASSE, un par
// octet. Trois réglages qui vont de soi ailleurs la détruiraient ici, et
// aucun des trois ne lèverait la moindre erreur :
//
//   1. `colorSpace = SRGBColorSpace` — le réglage de toutes les autres textures
//      du projet. Il demande au GPU de convertir sRGB→linéaire à la lecture :
//      le code 40 (cultures) ressortirait à ~0,05 au lieu de 0,157, donc en
//      classe 13, qui n'existe pas. On reste en `NoColorSpace`.
//   2. `LinearFilter` — la valeur par défaut de three.js. Il moyennerait les
//      codes voisins : 10 et 80 rendraient 45, qui n'est pas une classe.
//      `NearestFilter` sur les deux filtres, sans exception.
//   3. `generateMipmaps` — un mip est une moyenne, donc le défaut n° 2 répété
//      à toutes les échelles. Coupé.
//
// Le bord doux, lui, ne vient pas du filtrage : il vient du nuanceur, qui
// convertit QUATRE voisins en couleur avant de les mélanger (voir terrain.js).
// C'est la seule façon d'avoir un dégradé sans jamais inventer de classe.

import * as THREE from 'three'
import { tilesForBBox } from './tile-index.js'
import { aerialZoomFor, aerialUvTransform, tileGridMerc, grilleMosaique, SUPERSEDED } from './aerial-layer.js'
import { urlTuileSol, zoomSolBorne, tableLutSol, SOL_ATTRIBUTION, SOL_ZOOM_MAX } from '../occupation-sol.js'

const TUILE_PX = 256

// Le budget de texture. Plus large que celui des lumières nocturnes (1024)
// parce que la source est ici 60 fois plus fine (10 m contre ~600 m) : il y a
// vraiment quelque chose à aller chercher. Plus étroit que celui de la photo
// (4096) parce qu'on peint un LAVIS, pas une image qu'on scrute.
const BUDGET_PX = 2048

/**
 * La texture 256×1 de correspondance code → couleur+force.
 *
 * Elle est fabriquée UNE fois et partagée : elle ne dépend pas de l'emprise, et
 * en refaire une par construction ferait fuir une texture GPU à chaque
 * déplacement de la carte.
 */
export function textureLutSol(forces = null) {
  const tex = new THREE.DataTexture(tableLutSol({ forces }), 256, 1, THREE.RGBAFormat)
  // ⚠️ Les trois mêmes règles que la mosaïque, et pour la même raison : cette
  // table est indexée par un CODE. Interpoler entre l'entrée 10 et l'entrée 11
  // (qui est vide) délaverait toutes les forêts.
  tex.magFilter = tex.minFilter = THREE.NearestFilter
  tex.generateMipmaps = false
  tex.colorSpace = THREE.NoColorSpace
  tex.needsUpdate = true
  return tex
}

export class OccupationSolLayer {
  constructor({ maxTexturePx = BUDGET_PX } = {}) {
    this._budgetPx = Math.min(BUDGET_PX, maxTexturePx)
    this._buildId = 0
    this._texture = null
    this._lut = null
  }

  /** La table de correspondance, fabriquée à la demande puis conservée. */
  lut() {
    if (!this._lut) this._lut = textureLutSol()
    return this._lut
  }

  /**
   * Bâtit la mosaïque sur l'emprise donnée.
   *
   * ⚠️ `bbox` doit être l'emprise VRAIE du champ chargé (demBounds), jamais
   * patchBounds() : celui-ci élargit de 5 % + 0,01° pour ratisser la donnée, ce
   * qui décalait la photo aérienne d'environ 5 km vers le nord-ouest quand on
   * s'en servait comme empreinte.
   *
   * Ne lève JAMAIS. Rend `{ texture, uv, attribution, tiles, tuilesVues, zoom }`,
   * ou `null`, ou SUPERSEDED si une construction plus récente a pris la main.
   *
   * `tuilesVues` est ce qui permet à l'appelant de distinguer « la donnée dit
   * qu'il n'y a rien » de « la donnée n'a pas été cuite ici » — deux choses que
   * l'écran rend identiques, et dont une seule mérite d'éteindre la couche.
   *
   * @param {{zmax?:number}} [options] - `zmax` = le plafond de la ZONE cuite ici
   *   (manifeste). ⚠️ Sans lui, une vue posée sur le socle mondial — cuit en
   *   z8-z9 seulement — irait réclamer du z14 jamais écrit, et rendrait une
   *   mosaïque vide sous un interrupteur allumé.
   */
  async build(bbox, { zmax = SOL_ZOOM_MAX, zmin = 0 } = {}) {
    const id = ++this._buildId
    if (!bbox) return null

    const plafond = Math.min(SOL_ZOOM_MAX, Number.isFinite(zmax) ? zmax : SOL_ZOOM_MAX)
    // ⚠️ LE `null` SE TESTE AVANT LA BORNE, PAS APRÈS. `zoomSolBorne` rend son
    // plafond sur toute entrée non finie : lui passer le `null` d'un budget
    // dépassé transformerait un refus en « prends le zoom le plus fin », soit
    // exactement le contraire de ce qui vient d'être décidé.
    const voulu = aerialZoomFor(bbox, { budgetPx: this._budgetPx, maxZoom: plafond })
    if (voulu === null) return null
    const z = zoomSolBorne(voulu)
    // ⚠️ ET LE PLANCHER DE CUISSON. Sous `zmin`, aucune tuile n'a jamais été
    // écrite : on tomberait en 404 sur la totalité, on ne peindrait rien, et
    // l'interrupteur resterait allumé sur une carte inchangée. On renonce, et
    // l'appelant le DIT — même contrat que la branche « hors zone cuite ».
    if (z < zmin) return null
    const tuiles = tilesForBBox(bbox, z)
    if (!tuiles.length) return null

    // Une seule copie de la règle de grille, partagée avec les trois autres
    // couches drapées — voir `grilleMosaique`. Elle recolle l'enroulement autour
    // de ±180° et refuse un canevas au-dessus du budget de texture.
    const grille = grilleMosaique(tuiles, z, this._budgetPx, 'occupation du sol')
    if (!grille) return null
    const { x0, y0, cols, rows } = grille

    const canvas = document.createElement('canvas')
    canvas.width = cols * TUILE_PX
    canvas.height = rows * TUILE_PX
    const ctx = canvas.getContext('2d', { willReadFrequently: false })
    // ⚠️ LE FOND EST NOIR, c'est-à-dire le CODE 0. Ce n'est pas une couleur,
    // c'est « pas de donnée » : la table de correspondance lui met une force
    // nulle, et le fragment garde exactement la couleur qu'il avait. Une tuile
    // manquante devient donc un non-événement, pas un trou noir.
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // ⚠️ `imageSmoothingEnabled = false` : les tuiles sont dessinées à leur
    // taille exacte, donc le lisseur ne devrait pas intervenir — mais il suffit
    // d'un arrondi de sous-pixel pour qu'il interpole les CODES sur les bords de
    // chaque tuile, et fabrique une couture d'une classe inexistante tous les
    // 256 pixels. On le coupe plutôt que de compter sur l'arrondi.
    ctx.imageSmoothingEnabled = false

    let vues = 0
    await Promise.all(
      tuiles.map(async (t) => {
        try {
          const img = await chargeImageBrute(urlTuileSol(t.z, t.x, t.y))
          if (id !== this._buildId) return
          ctx.drawImage(img, grille.colonne(t) * TUILE_PX, grille.ligne(t) * TUILE_PX, TUILE_PX, TUILE_PX)
          vues++
        } catch {
          // Une tuile absente n'est pas une erreur : le cuiseur n'écrit rien en
          // pleine mer ni hors des zones demandées.
        }
      })
    )
    if (id !== this._buildId) return SUPERSEDED

    this._texture?.dispose()
    const tex = new THREE.CanvasTexture(canvas)
    // ⚠️⚠️ LES QUATRE LIGNES QUI DÉCIDENT DE TOUT — voir l'en-tête du fichier.
    // Aucune ne lève d'erreur si on l'oublie ; toutes rendent des classes qui
    // n'existent pas.
    tex.colorSpace = THREE.NoColorSpace
    tex.magFilter = THREE.NearestFilter
    tex.minFilter = THREE.NearestFilter
    tex.generateMipmaps = false
    // ClampToEdge et pas Repeat : si un UV sortait de [0,1] malgré le fondu de
    // bord, un Repeat rapporterait la forêt de l'autre bout de l'emprise.
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
    this._texture = tex

    return {
      texture: tex,
      lut: this.lut(),
      uv: aerialUvTransform(bbox, tileGridMerc(x0, y0, cols, rows, z)),
      attribution: SOL_ATTRIBUTION,
      tiles: tuiles.length,
      tuilesVues: vues,
      zoom: z,
    }
  }

  dispose() {
    this._texture?.dispose()
    this._texture = null
    this._lut?.dispose()
    this._lut = null
  }
}

/**
 * Charge une tuile SANS que le navigateur ne la gère en couleur.
 *
 * ⚠️ On ne réutilise PAS `loadImage` d'aerial-layer.js, et l'écart tient en un
 * mot : `crossOrigin`. Là-bas il est obligatoire (les tuiles viennent d'un
 * fournisseur tiers, et sans le drapeau le canevas est teinté). Ici les tuiles
 * sont servies par NOUS, en même origine : poser `crossOrigin` déclencherait
 * une requête CORS inutile que le serveur de développement de Vite n'honore pas
 * toujours sur les fichiers statiques.
 *
 * Nos PNG sont écrits à la main, sans morceau gAMA ni iCCP : le navigateur les
 * traite donc en sRGB, ne convertit rien, et les octets de classe arrivent dans
 * le canevas exactement tels qu'ils ont été cuits. C'est cette absence de
 * morceau de couleur qui rend toute la chaîne exacte — si un jour la cuisson
 * passait par une bibliothèque qui en ajoute un, les classes se décaleraient.
 */
function chargeImageBrute(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}
