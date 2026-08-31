import { WaterLayer } from './water-layer.js'
import { PlacesLayer } from './places-layer.js'

// Orchestrates the SP1 layers. Every layer builds from the same {dem,terrain,params}
// so a new zone/zoom (or a dark-mode/opacity change) is a single rebuild call.
// SP2 will inject an OSM DataProvider here without touching layer code.
//
// PLUS de calque `roads` : il a quitté le site (Adrien, « très lourd, très
// mauvais »). `setLayerVisible`/`setOpacity` filtrent par identifiant, donc un
// vieil appel à 'roads' est simplement ignoré, sans erreur.
export class MapLayers {
  constructor(scene, camera = null) {
    this.water = new WaterLayer()
    this.places = new PlacesLayer(camera)
    this._layers = { water: this.water, places: this.places }
    this._surfaceVisible = true
    this._scene = null
    this.poserScene(scene)
  }
  // ══════════ LE POINT UNIQUE DE RATTACHEMENT — Tâche D16-b, cause ① ════════
  //
  // ⛔ **LES CALQUES SE RATTACHAIENT EUX-MÊMES, ET À LA MAUVAISE SCÈNE.**
  // `scene.add(this.group)` dans chaque constructeur visait la scène du BLOC
  // PLAT ; la Tâche D16-a a supprimé la passe qui la dessine. Les rivières et
  // les toponymes n'étaient pas cachés — ils étaient dessinés dans un tampon
  // que plus personne ne regarde.
  //
  // ⚠️ **UN SEUL ÉCRIVAIN, ET IL DÉPLACE PLUTÔT QU'IL N'AJOUTE.** Deux appels
  // (la construction, puis le relogement de `main.js` quand `sceneGlobe`
  // existe) laisseraient sinon deux parents et deux dessins du même groupe.
  poserScene(scene) {
    if (!scene || scene === this._scene) return
    for (const l of Object.values(this._layers)) {
      l.group.parent?.remove(l.group)
      scene.add(l.group)
    }
    this._scene = scene
  }
  // LE FABRICANT DE POSEUR — ce qui décide, à chaque reconstruction, si la
  // géométrie atterrit sur la dalle plate ou sur la sphère de relief. La loi
  // vit dans `monde/sol-globe.js` ; `main.js` n'apporte que les objets vivants.
  poserFabricantDePoseur(fn) { for (const l of Object.values(this._layers)) l.poserFabricantDePoseur?.(fn) }
  // null-safe: places.refresh()/declutter fall back to "show everything" until
  // a camera is set
  setCamera(camera) { this.places.setCamera?.(camera) }
  async rebuild(ctx) {
    await Promise.all(Object.values(this._layers).map((l) => l.rebuild(ctx)))
    this.setSurfaceVisible(this._surfaceVisible)
  }
  setLayerVisible(id, v) { this._layers[id]?.setVisible(v && this._surfaceVisible) }
  setOpacity(id, v) { this._layers[id]?.setOpacity?.(v) }
  // the day cycle's sun, forwarded to whichever layers respond to light
  setSun(s) { this.water.setSun?.(s) }
  // SP2: OSM attribution (ODbL) + loading state, derived from the live layers
  isOsmActive() { return Object.values(this._layers).some((l) => l.usingOsm) }
  isLoading() { return Object.values(this._layers).some((l) => l.loading) }
  // keep fat-line screen-space widths correct after a viewport resize.
  // La traversée vit maintenant DANS le calque, avec la valeur mémorisée que
  // ses reconstructions reliront (water-layer.js) : la faire ici laissait la
  // prochaine reconstruction repartir de `window.innerHeight`.
  onResize(w, h) {
    for (const l of [this.water]) l.onResize?.(w, h)
  }
  // hide the whole set outside surface mode (globe/export)
  setSurfaceVisible(v) {
    this._surfaceVisible = v
    for (const l of Object.values(this._layers)) l.group.visible = v && l.group.children.length > 0
  }
  dispose() { for (const l of Object.values(this._layers)) l.dispose() }
}
