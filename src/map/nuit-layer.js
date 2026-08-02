// LA MOSAÏQUE DES LUMIÈRES NOCTURNES — la partie qui touche le réseau et le GPU.
//
// La règle de la couche (quelle adresse, quel plafond de zoom, combien l'heure
// allume) vit dans src/nuit.js, qui est pur et testé. Ici il n'y a que du canevas
// et de la texture.
//
// ═══════════════════════════════════════════════════════════════════════════
// POURQUOI CE N'EST PAS UN FOURNISSEUR DE PLUS DANS aerial-layer.js
// ═══════════════════════════════════════════════════════════════════════════
//
// C'était la tentation, et elle était mauvaise. `AerialLayer` choisit UN
// fournisseur selon le pays, puis compose le fond mondial DESSOUS pour boucher
// la mer. Les lumières nocturnes n'ont ni pays, ni fond, ni trou à boucher :
// elles couvrent le globe d'un seul tenant. Les faire entrer dans ce moule
// aurait demandé un drapeau « ne compose pas de fond » et un autre « ignore la
// couverture nationale » — deux exceptions dans un chemin de code déjà chargé,
// pour un cas qui n'en a pas besoin.
//
// Ce qui EST partagé l'est vraiment : `tilesForBBox`, `aerialZoomFor`,
// `tileGridMerc`, `aerialUvTransform` et `loadImage` viennent tous d'à côté.
// L'arithmétique de grille web-mercator ne vit qu'à un endroit.

import * as THREE from 'three'
import { tilesForBBox } from './tile-index.js'
import { aerialZoomFor, aerialUvTransform, tileGridMerc, loadImage, SUPERSEDED } from './aerial-layer.js'
import { urlTuileNuit, zoomNuitBorne, NUIT_ATTRIBUTION, NUIT_ZOOM_MAX } from '../nuit.js'

const TILE_PX = 256

// ⚠️ BEAUCOUP PLUS PETIT QUE LE BUDGET DE LA PHOTO (4096), ET C'EST VOULU.
// Black Marble plafonne à ~600 m/px : au-delà de z8 il n'y a plus d'information
// à aller chercher. Un canevas de 4096 px sur un bloc de 30 km ne ferait
// qu'agrandir 50 pixels de données en 4096 — même image, 64 fois la mémoire.
// 1024 laisse déjà la mosaïque sur-échantillonner la donnée à tous les zooms.
const BUDGET_PX = 1024

export class NuitLayer {
  constructor({ maxTexturePx = BUDGET_PX } = {}) {
    this._budgetPx = Math.min(BUDGET_PX, maxTexturePx)
    this._buildId = 0
    this._texture = null
  }

  /**
   * Bâtit la mosaïque sur l'emprise donnée.
   *
   * ⚠️ `bbox` doit être l'emprise VRAIE du champ chargé (demBounds), jamais
   * patchBounds() : celui-ci élargit de 5 % + 0,01° pour ratisser la donnée, ce
   * qui décalait la photo aérienne d'environ 5 km vers le nord-ouest quand on
   * s'en servait comme empreinte. Même piège ici, mêmes conséquences.
   *
   * Ne lève JAMAIS : une couche décorative qui échoue doit laisser la carte
   * utilisable. Rend `{ texture, uv, attribution, tiles, zoom }`, ou `null` en
   * cas d'échec, ou SUPERSEDED si une construction plus récente a pris la main.
   */
  async build(bbox) {
    const id = ++this._buildId
    if (!bbox) return null

    const z = zoomNuitBorne(aerialZoomFor(bbox, { budgetPx: this._budgetPx, maxZoom: NUIT_ZOOM_MAX }))
    const tuiles = tilesForBBox(bbox, z)
    if (!tuiles.length) return null

    const xs = tuiles.map((t) => t.x), ys = tuiles.map((t) => t.y)
    const x0 = Math.min(...xs), y0 = Math.min(...ys)
    const cols = Math.max(...xs) - x0 + 1, rows = Math.max(...ys) - y0 + 1

    const canvas = document.createElement('canvas')
    canvas.width = cols * TILE_PX
    canvas.height = rows * TILE_PX
    const ctx = canvas.getContext('2d')
    // Le fond est NOIR, pas transparent : le shader additionne, et du noir
    // ajoute exactement zéro. Une tuile manquante devient donc « pas de
    // lumière ici », ce qui est la bonne réponse par défaut — et non un trou.
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Une tuile en échec ne doit pas faire échouer l'emprise : un trou noir
    // dans la mosaïque se lit comme une zone sans lumière, ce qui est bien plus
    // discret qu'une couche absente.
    await Promise.all(
      tuiles.map(async (t) => {
        try {
          const img = await loadImage(urlTuileNuit(t.z, t.x, t.y))
          if (id !== this._buildId) return
          ctx.drawImage(img, (t.x - x0) * TILE_PX, (t.y - y0) * TILE_PX, TILE_PX, TILE_PX)
        } catch {}
      })
    )
    if (id !== this._buildId) return SUPERSEDED

    // On ne dispose la texture précédente qu'ICI, une fois la nouvelle prête :
    // la libérer plus tôt ferait clignoter la couche à chaque déplacement.
    this._texture?.dispose()
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    // ⚠️ ClampToEdge et PAS Repeat. Le fondu de bord de `uvSolDrape` couvre le
    // débordement élastique, mais si un UV sortait quand même de [0,1], un
    // Repeat rapporterait les lumières de Tokyo sur le bord des Alpes.
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
    // Pas de mipmaps : à ce budget la mosaïque sur-échantillonne déjà largement
    // la donnée, et un mip de plus adoucirait des villes déjà molles.
    tex.generateMipmaps = false
    tex.minFilter = THREE.LinearFilter
    this._texture = tex

    return {
      texture: tex,
      uv: aerialUvTransform(bbox, tileGridMerc(x0, y0, cols, rows, z)),
      attribution: NUIT_ATTRIBUTION,
      tiles: tuiles.length,
      zoom: z,
    }
  }

  dispose() {
    this._texture?.dispose()
    this._texture = null
  }
}
