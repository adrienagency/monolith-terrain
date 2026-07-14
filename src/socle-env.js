// A dedicated studio environment for the socle block only. The scene already
// has a neutral RoomEnvironment on scene.environment, but it's a soft grey box —
// metals and glass reflect almost nothing punchy, so they read flat. This builds
// a small photo-studio IBL (bright softboxes on a dark room) and hands back a
// PMREM texture we assign to the plinth wall material's OWN envMap, which
// overrides scene.environment for that material only — the terrain is untouched.

import * as THREE from 'three'

// Build the PMREM once. Caller owns the returned texture (dispose on teardown).
export function makeSocleEnvMap(renderer) {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x15171d) // dark room so highlights pop

  const geo = new THREE.PlaneGeometry(1, 1)
  const disposables = [geo]
  const panel = (w, h, color, gain, pos, rot) => {
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(gain), side: THREE.DoubleSide })
    const m = new THREE.Mesh(geo, mat)
    m.scale.set(w, h, 1)
    m.position.set(pos[0], pos[1], pos[2])
    if (rot) m.rotation.set(rot[0], rot[1], rot[2])
    scene.add(m)
    disposables.push(mat)
  }

  // key softbox (large, bright, warm-white) high on the left
  panel(9, 14, 0xffffff, 3.4, [-10, 5, 3], [0, Math.PI / 2.3, 0])
  // cool fill from the right, dimmer
  panel(7, 11, 0xbcd2ff, 1.5, [9, 3, -4], [0, -Math.PI / 2.3, 0])
  // ceiling strip — a long horizon highlight that rakes across metal/glass
  panel(20, 3.5, 0xffffff, 2.2, [0, 11, 0], [Math.PI / 2, 0, 0])
  // warm accent behind, gives coloured glints in the clearcoat
  panel(5, 5, 0xffd8a8, 1.2, [2, 2, 11], [0, Math.PI, 0])
  // dark floor to ground the reflections
  panel(24, 24, 0x0c0d11, 1, [0, -7, 0], [-Math.PI / 2, 0, 0])

  const pmrem = new THREE.PMREMGenerator(renderer)
  pmrem.compileEquirectangularShader()
  const tex = pmrem.fromScene(scene, 0.02).texture
  pmrem.dispose()
  for (const d of disposables) d.dispose()
  return tex
}
