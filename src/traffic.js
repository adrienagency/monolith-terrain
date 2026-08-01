// Ambient traffic over the map — two citizens of the diorama:
//  · occasional AIRCRAFT crossing the scene, one at a time and deliberately
//    rare (the map stays the hero): an airliner (GLB), or one of three
//    procedurally-built gliders of the sky — hot-air balloon, sailplane,
//    paraglider — each with its own altitude band, speed and motion habit;
//  · a SpaceX pad watcher: when the loaded zone contains Starbase (Boca Chica)
//    or Kennedy LC-39A, a user-supplied Starship + launch-tower model appears
//    on the pad and lifts off from time to time.
//
// Models are fetched, not rebuilt:
//  · public/models/plane.glb — "Cesium_Air" from CesiumGS/cesium (Apache-2.0),
//    downloaded into the repo (see public/models/MODELS.md).
//  · public/models/starship.glb + tower.glb — OPTIONAL, user-supplied (free
//    Starship/Mechazilla models exist on Sketchfab et al. but sit behind
//    account walls, so we don't hotlink them). The watcher stays dormant
//    until the files exist.

import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { TERRAIN_SIZE } from './terrain.js'
import { latLonToWorld, demSpan } from './geo.js'

const HALF = TERRAIN_SIZE / 2
const SPAWN_CHECK_S = 14 // roll the dice this often
const SPAWN_CHANCE = 1 / 9 // rare on purpose — a visitor, not a flight corridor
const DESPAWN_QUIET_S = 20 // extra silence after a craft leaves
const PEAK_CLEAR = 1.5 // craft always fly at least this far ABOVE the highest summit

// famous pads the watcher recognises (lat, lon)
const SPACEX_PADS = [
  { name: 'STARBASE — BOCA CHICA', lat: 25.9968, lon: -97.1554 },
  { name: 'KENNEDY LC-39A', lat: 28.6084, lon: -80.6043 },
]

export class Traffic {
  constructor(scene, terrain, params) {
    this.terrain = terrain
    this.params = params
    this.group = new THREE.Group()
    this.group.name = 'traffic'
    scene.add(this.group)
    this.loader = new GLTFLoader()

    this.planeProto = null
    this.craft = null // { type, obj, dir, side, speed, life, baseY, phase }
    this.sinceRoll = 0
    // rayon monde des dalles voisines chargées (damier GPX). >0 → un aéronef
    // continue au-dessus des dalles suivantes au lieu de disparaître au bord du
    // bloc central : il passe de la dalle 1 à la dalle 2 sans coupure (Adrien).
    this.spanExtra = 0
    // ══════════ LE DÉCALAGE DE FENÊTRE (mode continu 3×3) ═══════════════════
    //
    // Adrien, textuellement : « aucun problème si la montgolfière ou l'avion est
    // en dehors du socle, c'est le comportement attendu. » Un aéronef VOLE : il
    // a le droit de sortir du cadre. Ce qu'il n'a pas le droit de faire, c'est
    // de rester COLLÉ À L'ÉCRAN pendant que le paysage défile — un ballon
    // immobile au-dessus d'une vallée qui s'en va, ce n'est plus un ballon.
    //
    // On ne les écrête donc PAS ; on translate leur groupe de −fenêtre, ce qui
    // fait de leur position locale une coordonnée de CHAMP. Ils dérivent alors
    // avec le sol, exactement comme un vrai aéronef vu d'un train qui roule.
    this._fen = { x: 0, z: 0 }

    this.pad = null // { obj, rocket, baseY, state, t }
    this.starshipProto = null
    this.towerProto = null
    // CHARGEMENT DIFFÉRÉ — un seul téléchargement par session, même si la
    // demande arrive de deux endroits. Voir _demanderAvion / _demanderPasDeTir.
    this._avionDemande = false
    this._padDemande = false
    this._zoneDem = null // la dernière zone vue, pour rebâtir le pas de tir à l'arrivée des modèles
  }

  // ---------------------------------------------------------------------------
  // LES MODÈLES NE SE TÉLÉCHARGENT PLUS AU DÉMARRAGE
  // ---------------------------------------------------------------------------
  // Mesuré le 28/07/2026 : ces trois `load()` étaient dans le CONSTRUCTEUR, donc
  // sur le chemin critique de la toute première image, inconditionnellement.
  //   • models/plane.glb = 573 Ko à CHAQUE ouverture de la page — pour un avion
  //     qui n'apparaît que si un dé lancé toutes les 14 s tombe sur 1/9, puis
  //     ressort avion dans 35 % des cas. La grande majorité des visites payait
  //     573 Ko pour ne jamais voir l'objet.
  //   • models/starship.glb et models/tower.glb ne sont PAS livrés dans le dépôt
  //     (voir public/models/MODELS.md) : ces deux requêtes partaient donc pour
  //     ramener deux 404 — 7 Ko de page HTML chacune en développement — à chaque
  //     démarrage, sur une planète (Boca Chica, LC-39A) que la carte affichée ne
  //     contient presque jamais.
  // On charge donc au moment où l'objet est RÉELLEMENT nécessaire, une seule
  // fois, sans jamais bloquer : si le modèle n'est pas encore là, la scène se
  // débrouille (un autre aéronef prend le tour, le pas de tir attend son GLB).

  // Demandé au premier tirage GAGNANT du trafic aérien : à cet instant on sait
  // que cette session verra vraiment passer des aéronefs. Le premier d'entre eux
  // sera un planeur ou un ballon (planeProto est encore vide, _spawnCraft
  // enchaîne alors sur le tirage suivant) ; l'avion est là pour les suivants.
  _demanderAvion() {
    if (this._avionDemande) return
    this._avionDemande = true
    // the airliner (Apache-2.0 Cesium sample model), normalised to ~1.7 units
    this.loader.load(
      'models/plane.glb',
      (gltf) => {
        const obj = gltf.scene
        const box = new THREE.Box3().setFromObject(obj)
        const size = box.getSize(new THREE.Vector3())
        const s = 1.7 / Math.max(size.x, size.y, size.z)
        obj.scale.setScalar(s)
        this.planeProto = obj
      },
      undefined,
      () => {} // missing model — planes simply never spawn
    )
  }

  // Demandé UNIQUEMENT quand la zone chargée contient vraiment un pas de tir.
  // À l'arrivée des modèles (optionnels, fournis par l'utilisateur) on rejoue
  // setZone sur la dernière zone vue : sans ça, le pas n'apparaîtrait qu'au
  // chargement de zone SUIVANT, c'est-à-dire jamais si le visiteur reste là.
  _demanderPasDeTir() {
    if (this._padDemande) return
    this._padDemande = true
    const rejouer = () => this.setZone(this._zoneDem)
    this.loader.load('models/starship.glb', (g) => { this.starshipProto = g.scene; rejouer() }, undefined, () => {})
    this.loader.load('models/tower.glb', (g) => { this.towerProto = g.scene; rejouer() }, undefined, () => {})
  }

  // dominant template colour: a strong mid-high ramp tint (falls back to ink)
  _dominantColor() {
    const stops = this.params.rampStops
    const hex = (stops && (stops[5]?.c || stops[4]?.c)) || this.params.contourColor || '#666666'
    return new THREE.Color(hex)
  }

  _mat(color, rough = 0.6) {
    return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 })
  }

  // ------- procedural sky citizens — all built facing +Z, ~diorama scale
  _buildBalloon(tint) {
    const g = new THREE.Group()
    const envelope = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 16), this._mat(tint, 0.5))
    envelope.scale.set(1, 1.15, 1)
    envelope.position.y = 0.95
    const throat = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.25, 12), this._mat(tint.clone().multiplyScalar(0.8)))
    throat.rotation.x = Math.PI
    throat.position.y = 0.35
    const basket = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.16), this._mat(new THREE.Color('#6b4a2f'), 0.9))
    basket.position.y = 0.1
    const ropeMat = this._mat(new THREE.Color('#4a4a4a'), 0.9)
    for (const [dx, dz] of [[-0.06, -0.06], [0.06, -0.06], [-0.06, 0.06], [0.06, 0.06]]) {
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.22, 4), ropeMat)
      rope.position.set(dx, 0.26, dz)
      g.add(rope)
    }
    g.add(envelope, throat, basket)
    return g
  }

  _buildGlider(tint) {
    const g = new THREE.Group()
    const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.05, 1.2, 8), this._mat(tint, 0.35))
    fuselage.rotation.x = Math.PI / 2
    const wing = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.02, 0.17), this._mat(tint, 0.35))
    wing.position.set(0, 0.03, 0.1)
    const tailH = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.015, 0.12), this._mat(tint, 0.35))
    tailH.position.set(0, 0.14, -0.56)
    const tailV = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.16, 0.14), this._mat(tint, 0.35))
    tailV.position.set(0, 0.07, -0.56)
    g.add(fuselage, wing, tailH, tailV)
    return g
  }

  _buildParaglider(tint) {
    const g = new THREE.Group()
    // canopy: an upper-semicircle wing DOMING over the pilot (spans left↔right,
    // arcs up). The old arc was tilted out of plane, which read as flying upside
    // down; a plain ∩ in the vertical plane sits the right way up.
    const canopy = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.05, 6, 22, Math.PI), this._mat(tint, 0.6))
    canopy.rotation.x = 0.12 // a touch of forward pitch, like a glide
    canopy.position.y = 0.24
    const pilot = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.09, 3, 8), this._mat(new THREE.Color('#333333'), 0.8))
    const lineMat = this._mat(new THREE.Color('#555555'), 0.9)
    for (const dx of [-0.25, 0.25]) {
      const line = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.42, 3), lineMat)
      line.position.set(dx * 0.5, 0.22, 0)
      line.rotation.z = dx > 0 ? -0.5 : 0.5
      g.add(line)
    }
    g.add(canopy, pilot)
    return g
  }

  // one craft at a time, chosen by weighted lottery. Each type gets its own
  // altitude band, speed and a small motion habit applied in update():
  //  · balloon — low, very slow, bobs gently, drifts long
  //  · glider — high, quiet, a slow banked weave
  //  · paraglider — hugs the relief band, slow S-turns
  _spawnCraft() {
    const tint = this._dominantColor()
    const cloudAlt = this.params.cloudAltitude ?? 4.5
    const roll = Math.random()
    let type, obj, speed, alt
    if (roll < 0.35 && this.planeProto) {
      type = 'plane'
      obj = this.planeProto.clone(true)
      obj.traverse((n) => {
        if (n.isMesh) {
          n.material = n.material.clone()
          if (n.material.color) n.material.color.copy(tint)
          n.material.map = null
        }
      })
      speed = 3.5 + Math.random() * 2.5
      alt = cloudAlt + 2 + Math.random() * 4
    } else if (roll < 0.62) {
      type = 'balloon'
      obj = this._buildBalloon(tint)
      speed = 0.7 + Math.random() * 0.4
      alt = Math.max(3, cloudAlt - 1 + Math.random() * 2.5)
    } else if (roll < 0.85) {
      type = 'glider'
      obj = this._buildGlider(tint)
      speed = 2.2 + Math.random() * 1.2
      alt = cloudAlt + 1 + Math.random() * 3
    } else {
      type = 'paraglider'
      obj = this._buildParaglider(tint)
      speed = 0.9 + Math.random() * 0.5
      alt = Math.max(2.5, cloudAlt - 2 + Math.random() * 1.5)
    }
    if (!obj) return
    // never fly into the relief: hold every craft at least PEAK_CLEAR above the
    // map's highest summit (uHeightRange.y = max terrain height, world units).
    // Their gentle bob (≤0.6) still stays clear of the peak.
    const peakY = this.terrain?.mapUniforms?.uHeightRange?.value?.y ?? 0
    alt = Math.max(alt, peakY + PEAK_CLEAR)
    // cross the map on a random heading
    const ang = Math.random() * Math.PI * 2
    const dir = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang))
    const side = new THREE.Vector3(-dir.z, 0, dir.x)
    const offset = (Math.random() * 2 - 1) * HALF * 0.6
    // ⚠️ ON NAÎT AU BORD DE LA FENÊTRE, PAS AU CENTRE DE L'EMPRISE. En mode
    // continu la position locale est une coordonnée de CHAMP : sans ce recalage
    // l'aéronef apparaîtrait toujours autour du centre de l'emprise, donc à
    // deux blocs du regard dès qu'on a défilé — un ciel vide pour de bon.
    const start = dir
      .clone()
      .multiplyScalar(-(HALF + 8))
      .addScaledVector(side, offset)
    start.x += this._fen.x
    start.z += this._fen.z
    start.y = alt
    obj.position.copy(start)
    obj.lookAt(start.clone().add(dir))
    this.group.add(obj)
    this.craft = { type, obj, dir, side, speed, life: 0, baseY: alt, phase: Math.random() * Math.PI * 2 }
  }

  // called after a DEM zone loads: shows the pad when a famous site is in view
  setZone(dem) {
    if (this.pad) {
      this.group.remove(this.pad.obj)
      this.pad = null
    }
    this._zoneDem = dem || null
    if (!dem) return
    // Sur une emprise 3×3 le champ fait 168 unités : le pas de tir peut tomber
    // dans une dalle voisine, et il doit s'y planter aussi.
    const demiChamp = (demSpan(dem) / 2) * 0.95
    for (const pad of SPACEX_PADS) {
      const w = latLonToWorld(dem, pad.lat, pad.lon)
      if (Math.abs(w.x) > demiChamp || Math.abs(w.z) > demiChamp) continue
      // ON EST SUR UN PAS DE TIR — et c'est le SEUL endroit qui déclenche le
      // téléchargement des deux GLB. Le test de position passe AVANT la
      // vérification du modèle (l'inverse renvoyait tout le monde à la porte,
      // et faisait payer les deux requêtes à tout le monde).
      this._demanderPasDeTir()
      if (!this.starshipProto) return // pas encore là : _demanderPasDeTir rejouera
      const root = new THREE.Group()
      // launch tower (Mechazilla) if supplied — normalised to ~3.2 units tall
      if (this.towerProto) {
        const tower = this.towerProto.clone(true)
        const tb = new THREE.Box3().setFromObject(tower)
        tower.scale.setScalar(3.2 / Math.max(tb.getSize(new THREE.Vector3()).y, 1e-3))
        tower.position.set(0.9, 0, 0)
        root.add(tower)
      }
      const rocket = this.starshipProto.clone(true)
      const rb = new THREE.Box3().setFromObject(rocket)
      rocket.scale.setScalar(2.8 / Math.max(rb.getSize(new THREE.Vector3()).y, 1e-3))
      root.add(rocket)
      // `terrain.sample` parle en coordonnées de GÉOMÉTRIE, `w` en coordonnées
      // de champ : on retranche le décalage, comme partout ailleurs.
      const groundY = this.terrain.sample ? this.terrain.sample(w.x - this._fen.x, w.z - this._fen.z) : 0
      root.position.set(w.x, groundY, w.z)
      this.group.add(root)
      this.pad = { obj: root, rocket, baseY: groundY, state: 'idle', t: 0, wait: 15 + Math.random() * 25 }
      break
    }
  }

  // le damier a gagné/perdu des dalles voisines → étendre (ou réduire) la zone
  // de vol pour que l'aéronef traverse les dalles chargées sans coupure
  setSpan(worldRadius) {
    this.spanExtra = Math.max(0, worldRadius || 0)
  }

  // Le groupe porte −fenêtre : la position locale d'un aéronef devient une
  // coordonnée de CHAMP, donc il dérive avec le relief. Deux écritures.
  setFenetre(x, z) {
    this._fen.x = x
    this._fen.z = z
    this.group.position.set(-x, 0, -z)
  }

  update(dt) {
    // ---- sky traffic (one craft at a time)
    this.sinceRoll += dt
    if (!this.craft && this.sinceRoll >= SPAWN_CHECK_S) {
      this.sinceRoll = 0
      if (Math.random() < SPAWN_CHANCE) {
        // le ciel de cette session est vivant : c'est ICI que l'avion vaut ses
        // 573 Ko, et pas une image plus tôt (voir _demanderAvion)
        this._demanderAvion()
        this._spawnCraft()
      }
    }
    if (this.craft) {
      const p = this.craft
      p.obj.position.addScaledVector(p.dir, p.speed * dt)
      p.life += dt
      // motion habits
      if (p.type === 'balloon') {
        p.obj.position.y = p.baseY + Math.sin(p.life * 0.45 + p.phase) * 0.35
      } else if (p.type === 'paraglider') {
        // lazy S-turns across the heading
        p.obj.position.addScaledVector(p.side, Math.cos(p.life * 0.5 + p.phase) * 0.5 * dt)
        p.obj.rotation.z = Math.sin(p.life * 0.5 + p.phase) * 0.25
      } else if (p.type === 'glider') {
        p.obj.position.y = p.baseY + Math.sin(p.life * 0.25 + p.phase) * 0.6
        p.obj.rotation.z = Math.sin(p.life * 0.25 + p.phase) * 0.12
      }
      const { x, z } = p.obj.position
      // slow craft get a longer life budget — enough to finish the crossing.
      // The bound sits past the farthest possible spawn point (√(36² + 16.8²)
      // ≈ 39.7) so a steep-heading craft can never despawn on frame one. When
      // neighbour dalles are loaded (spanExtra > 0) the bound extends over them
      // so the craft flies dalle-to-dalle without a cut; the life budget grows
      // with the span so it isn't killed mid-crossing.
      const bound = HALF + 13 + this.spanExtra
      const lifeMax = (p.speed < 1.5 ? 130 : 60) + this.spanExtra / Math.max(p.speed, 0.5)
      // La distance se mesure À LA FENÊTRE, pas à l'origine du champ : en mode
      // continu la position est en coordonnées de champ, et un aéronef parti
      // avec le regard doit rester en vie tant qu'il est dans les parages de ce
      // qu'on voit. Hors mode continu la fenêtre est (0,0) : c'est l'ancien test.
      const dx = x - this._fen.x
      const dz = z - this._fen.z
      if (Math.abs(dx) > bound || Math.abs(dz) > bound || p.life > lifeMax) {
        this.group.remove(p.obj)
        // free the craft's GPU buffers — procedural crafts build fresh
        // geometries/materials each spawn, the plane clones its materials
        p.obj.traverse((n) => {
          if (n.isMesh) {
            n.geometry.dispose()
            for (const m of Array.isArray(n.material) ? n.material : [n.material]) m.dispose()
          }
        })
        this.craft = null
        this.sinceRoll = -DESPAWN_QUIET_S // a beat of empty sky before the next roll
      }
    }

    // ---- Starship launches
    if (this.pad) {
      const s = this.pad
      s.t += dt
      if (s.state === 'idle' && s.t > s.wait) {
        s.state = 'launch'
        s.t = 0
      } else if (s.state === 'launch') {
        // gentle quadratic ascent, slight downrange lean, gone past the deck
        const h = 2.2 * s.t * s.t
        s.rocket.position.y = h
        s.rocket.rotation.z = Math.min(0.12, s.t * 0.02)
        if (h > 26) {
          s.state = 'cooldown'
          s.t = 0
        }
      } else if (s.state === 'cooldown' && s.t > 10) {
        s.rocket.position.y = 0
        s.rocket.rotation.z = 0
        s.state = 'idle'
        s.t = 0
        s.wait = 20 + Math.random() * 30
      }
    }
  }

  setVisible(v) {
    this.group.visible = v
  }
}
