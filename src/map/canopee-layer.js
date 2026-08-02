// LA MOSAÏQUE DE HAUTEUR DE CANOPÉE — la partie qui touche le réseau et le GPU.
//
// La règle de la couche (quelle couleur, quelle force, quelle adresse, où c'est
// cuit) vit dans src/canopee.js, qui est pur et testé. Ici il n'y a que du
// canevas et de la texture.
//
// Même forme que src/map/occupation-sol-layer.js et src/map/nuit-layer.js.
//
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ TOUT CE QUI EST INTERDIT SUR L'OCCUPATION DU SOL EST PERMIS ICI
// ═══════════════════════════════════════════════════════════════════════════
//
// Le fichier voisin, occupation-sol-layer.js, consacre son en-tête à trois
// réglages qui DÉTRUIRAIENT sa texture : `LinearFilter`, les mips, et l'espace
// sRGB. Il faut lire cet en-tête-ci en regard du sien, parce que la conclusion
// est inversée sur deux points sur trois, et qu'un lecteur pressé recopierait
// les précautions du voisin en croyant bien faire.
//
//   1. `LinearFilter` — INTERDIT là-bas (il moyennerait des CODES de classe :
//      10 et 80 rendraient 45, qui n'est pas une classe). ⚠️ CORRECT ICI, et
//      même souhaitable : un octet est une HAUTEUR EN MÈTRES, entre 10 m et
//      12 m il y a 11 m, et 11 m est une hauteur réelle. Le filtrage linéaire
//      donne la lisière douce GRATUITEMENT, là où l'occupation du sol doit se
//      la payer en mélangeant quatre voisins à la main dans le nuanceur.
//
//   2. `generateMipmaps` — INTERDIT là-bas (un mip est une moyenne, donc la
//      faute n° 1 répétée à toutes les échelles). Licite ici pour la même
//      raison qu'au point 1 — mais COUPÉ QUAND MÊME, et pas par prudence : la
//      pyramide coûte un tiers de mémoire de texture en plus par dalle du
//      damier, et c'est exactement ce qui séparerait cette couche à 2 parts
//      d'une couche à 3 au catalogue du Gardien. On la refuse en connaissance
//      de cause, pas par recopie.
//
//   3. `NoColorSpace` — INTERDIT de changer, là-bas comme ici, et c'est le seul
//      des trois qui ne s'inverse pas. `SRGBColorSpace` demande au GPU une
//      conversion sRGB→linéaire à la lecture : l'octet 40 (quarante mètres)
//      ressortirait à ~0,05 au lieu de 0,157, soit une forêt de 13 m. Le canal
//      ne porte pas une couleur, il porte un NOMBRE.

import * as THREE from 'three'
import { tilesForBBox } from './tile-index.js'
import { aerialZoomFor, aerialUvTransform, tileGridMerc, grilleMosaique, SUPERSEDED } from './aerial-layer.js'
import { urlTuileCanopee, zoomCanopeeBorne, tableLutCanopee, CANOPEE_ATTRIBUTION, CANOPEE_ZOOM_MAX } from '../canopee.js'

const TUILE_PX = 256

// Le budget de texture, aligné sur celui de l'occupation du sol : même finesse
// de source (10 m), même usage (un lavis drapé, pas une image qu'on scrute).
const BUDGET_PX = 2048

/**
 * La texture 256×1 de correspondance hauteur → couleur+force.
 *
 * Elle est fabriquée UNE fois et partagée : elle ne dépend pas de l'emprise, et
 * en refaire une par construction ferait fuir une texture GPU à chaque
 * déplacement de la carte.
 */
export function textureLutCanopee() {
  const tex = new THREE.DataTexture(tableLutCanopee(), 256, 1, THREE.RGBAFormat)
  // ⚠️ ET ICI AUSSI, `LinearFilter` — deuxième inversion par rapport à
  // l'occupation du sol, qui doit lire sa table au plus proche voisin sous peine
  // de délaver ses forêts en interpolant vers l'entrée VIDE d'à côté.
  //
  // Notre table, elle, n'a pas d'entrée vide : ses 256 entrées sont remplies,
  // et deux entrées voisines encadrent une hauteur qui existe. Lire l'entrée
  // 12,4 rend la couleur de 12,4 m. Au plus proche voisin, la rampe montrerait
  // ses 45 marches d'un mètre sur un dégradé qu'on a justement écrit pour être
  // continu — un défaut de rendu fabriqué à la main.
  tex.magFilter = tex.minFilter = THREE.LinearFilter
  tex.generateMipmaps = false
  // ⚠️ Celui-là ne s'inverse pas : voir le point 3 de l'en-tête. La table est
  // lue par une COORDONNÉE calculée, pas affichée ; ses couleurs sont converties
  // en linéaire À LA MAIN dans le nuanceur (voir `canopeeEn` dans terrain.js).
  tex.colorSpace = THREE.NoColorSpace
  // Sans ClampToEdge, la lecture de l'entrée 255,5 reboucle sur l'entrée 0 et
  // la valeur la plus absurde de la donnée rendrait la couleur du sol nu.
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
  tex.needsUpdate = true
  return tex
}

export class CanopeeLayer {
  constructor({ maxTexturePx = BUDGET_PX } = {}) {
    this._budgetPx = Math.min(BUDGET_PX, maxTexturePx)
    this._buildId = 0
    this._texture = null
    this._lut = null
  }

  /** La table de correspondance, fabriquée à la demande puis conservée. */
  lut() {
    if (!this._lut) this._lut = textureLutCanopee()
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
   * Ne lève JAMAIS. Rend `{ texture, lut, uv, attribution, tiles, tuilesVues,
   * zoom }`, ou `null`, ou SUPERSEDED si une construction plus récente a pris
   * la main.
   *
   * `tuilesVues` est ce qui permet à l'appelant de distinguer « la donnée dit
   * qu'il n'y a pas d'arbres » de « la donnée n'a pas été cuite ici » — deux
   * choses que l'écran rend identiques, et dont une seule mérite d'éteindre la
   * couche.
   *
   * @param {{zmax?:number}} [options] - `zmax` = le plafond de la ZONE cuite ici
   *   (manifeste). ⚠️ Sans lui, une vue posée sur une zone grossière irait
   *   réclamer du z14 jamais écrit, et rendrait une mosaïque vide sous un
   *   interrupteur allumé.
   */
  async build(bbox, { zmax = CANOPEE_ZOOM_MAX, zmin = 0 } = {}) {
    const id = ++this._buildId
    if (!bbox) return null

    const plafond = Math.min(CANOPEE_ZOOM_MAX, Number.isFinite(zmax) ? zmax : CANOPEE_ZOOM_MAX)
    // ⚠️ LE `null` SE TESTE AVANT LA BORNE, PAS APRÈS. `zoomCanopeeBorne` rend son
    // plafond sur toute entrée non finie : lui passer le `null` d'un budget
    // dépassé transformerait un refus en « prends le zoom le plus fin », soit
    // exactement le contraire de ce qui vient d'être décidé.
    const voulu = aerialZoomFor(bbox, { budgetPx: this._budgetPx, maxZoom: plafond })
    if (voulu === null) return null
    const z = zoomCanopeeBorne(voulu)
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
    const grille = grilleMosaique(tuiles, z, this._budgetPx, 'hauteur de canopée')
    if (!grille) return null
    const { x0, y0, cols, rows } = grille

    const canvas = document.createElement('canvas')
    canvas.width = cols * TUILE_PX
    canvas.height = rows * TUILE_PX
    const ctx = canvas.getContext('2d', { willReadFrequently: false })
    // ⚠️ LE FOND EST NOIR, c'est-à-dire ZÉRO MÈTRE. Ce n'est pas une couleur,
    // c'est « pas d'arbre » — et la table de correspondance lui donne une force
    // nulle. Une tuile manquante devient donc un non-événement (la carte reste
    // strictement celle d'avant), pas un trou noir.
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // ⚠️ ON LAISSE LE LISSEUR ALLUMÉ, et c'est encore une inversion. Le voisin
    // le coupe parce qu'un arrondi de sous-pixel interpolerait ses CODES et
    // sèmerait une couture d'une classe inexistante tous les 256 pixels. Ici
    // une interpolation de hauteurs sur une couture rend... une hauteur, et la
    // couture disparaît au lieu de se marquer. Rien à couper.

    let vues = 0
    await Promise.all(
      tuiles.map(async (t) => {
        try {
          const img = await chargeImageBrute(urlTuileCanopee(t.z, t.x, t.y))
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
    // ⚠️ LES QUATRE LIGNES QUI DÉCIDENT DE TOUT — voir l'en-tête du fichier, et
    // NE LES RECOPIEZ PAS DEPUIS occupation-sol-layer.js : deux d'entre elles y
    // sont réglées à l'inverse, pour une raison qui ne vaut que là-bas.
    tex.colorSpace = THREE.NoColorSpace
    tex.magFilter = THREE.LinearFilter
    tex.minFilter = THREE.LinearFilter
    tex.generateMipmaps = false
    // ClampToEdge et pas Repeat : si un UV sortait de [0,1] malgré le fondu de
    // bord, un Repeat rapporterait la forêt de l'autre bout de l'emprise.
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
    this._texture = tex

    return {
      texture: tex,
      lut: this.lut(),
      uv: aerialUvTransform(bbox, tileGridMerc(x0, y0, cols, rows, z)),
      attribution: CANOPEE_ATTRIBUTION,
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
 * traite donc en sRGB, ne convertit rien, et les MÈTRES arrivent dans le
 * canevas exactement tels qu'ils ont été cuits. C'est cette absence de morceau
 * de couleur qui rend toute la chaîne exacte — si un jour la cuisson passait
 * par une bibliothèque qui en ajoute un, toutes les forêts changeraient de
 * hauteur.
 */
function chargeImageBrute(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}
