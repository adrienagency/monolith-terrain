// Sillage d'étrave suivant le curseur — l'état qui pilote les uniformes du
// shader de l'eau (voir ocean.js bowWake). Module PUR et sans DOM : le
// raycast pointeur → plan d'eau vit dans main.js, la géométrie du sillage vit
// dans le shader, et ce qu'il y a entre les deux — la position lissée, le cap,
// la puissance — est ici, donc testable.
//
// Le curseur n'est pas un bateau : il saute, il s'arrête net, il sort de la
// fenêtre. Trois lissages séparés évitent que le sillage tressaute :
//   · la POSITION rattrape la cible (un curseur qui téléporte ne déchire pas
//     la surface)
//   · le CAP suit la vitesse, et se fige quand on ne bouge plus — sinon la
//     direction part au hasard sur du bruit numérique dès l'arrêt
//   · la PUISSANCE monte vite et retombe lentement, pour que le sillage
//     s'efface au lieu de disparaître d'un coup

export const WAKE_DEFAULTS = {
  follow: 9, // rattrapage de la position, en 1/s
  decay: 2.2, // extinction de la puissance au repos, en 1/s
  speedFull: 14, // unités monde/s pour une étrave à pleine puissance
  turn: 7, // lissage du cap, en 1/s
}

export const WAKE_ZERO = Object.freeze({ x: 0, z: 0, dx: 1, dz: 0, amp: 0 })

// Un onglet en arrière-plan rend un dt énorme au retour ; sans plafond, le
// premier pas rattraperait tout d'un coup et claquerait une vague géante.
const DT_MAX = 0.1

// state, cible {x,z} ou null (curseur hors de l'eau), dt en secondes → state
export function stepWake(state, target, dt, opts = {}) {
  const { follow, decay, speedFull, turn } = { ...WAKE_DEFAULTS, ...opts }
  const s = state ?? WAKE_ZERO
  if (!Number.isFinite(dt) || dt <= 0) return s
  const d = Math.min(dt, DT_MAX)

  // hors de l'eau : le sillage reste où il est et s'éteint
  if (!target || !Number.isFinite(target.x) || !Number.isFinite(target.z)) {
    return { ...s, amp: s.amp * Math.exp(-decay * d) }
  }

  const kp = 1 - Math.exp(-follow * d)
  const x = s.x + (target.x - s.x) * kp
  const z = s.z + (target.z - s.z) * kp

  // vitesse du point SUIVI, pas du curseur : c'est elle qui creuse l'étrave
  const vx = (x - s.x) / d
  const vz = (z - s.z) / d
  const v = Math.hypot(vx, vz)

  let dx = s.dx
  let dz = s.dz
  if (v > 1e-4) {
    const kt = 1 - Math.exp(-turn * d)
    dx += (vx / v - dx) * kt
    dz += (vz / v - dz) * kt
    const len = Math.hypot(dx, dz)
    if (len > 1e-6) {
      dx /= len
      dz /= len
    } else {
      dx = s.dx
      dz = s.dz
    }
  }

  const cible = Math.min(1, v / Math.max(speedFull, 1e-6))
  // montée rapide, descente lente : une étrave se creuse plus vite qu'elle ne
  // s'efface, et c'est aussi ce qui rend le geste lisible
  const ka = 1 - Math.exp(-(cible > s.amp ? follow : decay) * d)
  const amp = Math.min(1, Math.max(0, s.amp + (cible - s.amp) * ka))

  return { x, z, dx, dz, amp }
}

// Le sillage doit garder la même allure quelle que soit l'échelle du bloc :
// une étrave de 3 unités monde sur une vue de ville n'est pas la même chose
// que sur une vue continentale. On l'indexe donc sur l'emprise du terrain.
export function wakeLength(terrainSize, viewScale = 1) {
  return Math.max(0.05, terrainSize * 0.035 * viewScale)
}
