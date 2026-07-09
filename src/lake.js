// The water as a GLASS BLOCK — a transparent slab of physical glass filling
// everything below sea level (elevation 0): real PBR transmission shows the
// bathymetric relief through the glass, the environment reflects off its
// polished top, and its colour is user-adjustable. Islands pierce the surface;
// the block hugs the slab footprint (same superellipse corners as the plinth).

import * as THREE from 'three'
import { TERRAIN_SIZE } from './terrain.js'

export class Lake {
  constructor(scene, params) {
    this.group = new THREE.Group()
    this.group.name = 'lake'
    scene.add(this.group)

    this.material = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(params.lakeColor ?? '#8fc6e8'),
      transmission: 1, // full glass — colour comes from `color` as absorption tint
      roughness: params.lakeRoughness ?? 0.08,
      metalness: 0,
      thickness: 2,
      ior: 1.33, // water
      envMapIntensity: 1.1, // the environment reflects in the surface
      depthWrite: false,
    })
    // clip the glass to the slab's superellipse footprint, like the terrain
    const half = TERRAIN_SIZE / 2
    const r = (params.slabCorner ?? 0) * TERRAIN_SIZE
    const n = 2 + (params.slabCornerSmoothing ?? 0) * 4
    this.material.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>\nvarying vec3 vLakeWorld;`
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
  {
    vec2 cq = max(abs(vLakeWorld.xz) - vec2(${(half - r).toFixed(3)}), 0.0);
    float pn = pow(pow(cq.x, ${n.toFixed(2)}) + pow(cq.y, ${n.toFixed(2)}), 1.0 / ${n.toFixed(2)});
    if (pn > ${r.toFixed(3)}) discard;
  }`
        )
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\nvarying vec3 vLakeWorld;`)
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>\nvLakeWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;`
        )
    }

    this.mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), this.material)
    this.mesh.renderOrder = 3
    this.mesh.visible = false
    this.group.add(this.mesh)
  }

  // size the block: from just above the plinth base up to sea level (elevation 0)
  build(seaY, baseY, params) {
    if (!params.lakeEnabled || seaY < -9000 || seaY <= baseY + 0.1) {
      this.mesh.visible = false
      return
    }
    const bottom = baseY + 0.05
    const top = seaY - 0.015 // a hair under the coastline so the shore stays crisp
    this.mesh.scale.set(TERRAIN_SIZE * 0.998, top - bottom, TERRAIN_SIZE * 0.998)
    this.mesh.position.set(0, (top + bottom) / 2, 0)
    this.mesh.visible = true
  }

  updateMaterial(params) {
    this.material.color.set(params.lakeColor ?? '#8fc6e8')
    this.material.roughness = params.lakeRoughness ?? 0.08
  }

  setVisible(v) {
    this.group.visible = v
  }
}
