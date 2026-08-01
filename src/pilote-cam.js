// L'ADAPTATEUR — la seule pièce du pilote qui connaisse three.js et ShibuMap.
//
// Tout le vol est calculé par src/pilote.js, qui est pur : couloirs, garde au
// sol, virages coordonnés, demi-tours. Ici on ne fait que trois choses :
//   1. brancher l'échantillonneur d'altitude sur le relief du bloc,
//   2. écrire les poses dans la caméra three.js,
//   3. APPLIQUER LE ROULIS — c'est la seule chose que le cœur ne peut pas faire
//      lui-même, et c'est justement le tell visuel qui distingue un aéronef d'un
//      drone. Voir `_orienter` plus bas : `camera.up` ne suffit pas.
//
// Si ce module disparaît, le cœur reste utilisable tel quel dans un autre
// projet — c'est tout l'objet de la séparation.

import * as THREE from 'three'
import { planifierVol, creerVol, stepPilote, poseDe, PROFILS } from './pilote.js'

// Les crans du bouton. Deux vols, pas six : un plan de pilote n'est pas un
// effet, c'est une TRAJECTOIRE, et le relief en fournit rarement plus d'une
// bonne par bloc. Le troisième cran arrête. Voir le commentaire du bouton dans
// main.js pour le pourquoi du numéro affiché.
export const VOLS = [
  { id: 'avion', nom: '1', label: 'Survol de vallée — avion' },
  { id: 'helico', nom: '2', label: 'Reconnaissance basse — hélicoptère' },
]

export class PiloteCam {
  constructor({ camera, controls, sampleGround, half, onState = () => {}, onPlan = () => {} }) {
    this.camera = camera
    this.controls = controls
    this.sampleGround = sampleGround
    this.half = half
    this.onState = onState
    this.onPlan = onPlan
    this.active = false
    this.index = -1
    this.plan = null
    this.etat = null
    this._q = new THREE.Quaternion()
    this._m = new THREE.Matrix4()
    this._up = new THREE.Vector3()
    this._axe = new THREE.Vector3()
  }

  get badge() {
    return this.index >= 0 ? VOLS[this.index].nom : null
  }

  // Le profil courant, pour l'affichage et les tests.
  get profil() {
    return this.plan?.profil?.nom ?? null
  }

  // Compose et engage un vol. Retourne le PLAN, ou null si aucun couloir du bloc
  // n'est engageable — et c'est un résultat, pas une panne : le pilote refuse.
  _lancer(id) {
    const plan = planifierVol({
      sampleGround: this.sampleGround,
      half: this.half,
      profil: PROFILS[id] ? id : 'avion',
    })
    if (!plan) return null
    plan.sampleGround = this.sampleGround
    this.plan = plan
    this.etat = creerVol(plan)
    this.active = true
    this.onPlan(plan)
    return plan
  }

  // Cran suivant. TROIS CRANS POUR DEUX VOLS : le cran d'après le dernier est un
  // ARRÊT — sans lui, une fois le bouton engagé la caméra bougerait toujours.
  // Un clic de plus repart au vol 1.
  //
  // Si le bloc ne propose aucun couloir engageable, on passe au cran suivant au
  // lieu de rester bloqué, et le badge le dit en s'effaçant.
  next() {
    const i = this.index + 1
    if (i >= VOLS.length) { this.stop(); return null }
    this.index = i
    if (!this._lancer(VOLS[i].id)) { this.onState(); return VOLS[i].nom }
    this.onState()
    return VOLS[i].nom
  }

  // Interrompt le vol mais GARDE le cran : attraper la caméra en plein vol ne
  // doit pas faire repartir du début au clic suivant. Même règle que
  // CameraShotPlayer.cancel() — c'est la sortie qu'Adrien exige.
  cancel() {
    if (!this.active) return
    this.active = false
    this.plan = null
    this.etat = null
    this._redresser()
    this.onState()
  }

  // Arrêt franc : plus aucun cran, le badge s'efface.
  stop() {
    this.active = false
    this.plan = null
    this.etat = null
    this.index = -1
    this._redresser()
    this.onState()
  }

  // ⚠️ ON REMET L'HORIZON D'APLOMB EN SORTANT. Le roulis vit dans `camera.up`,
  // et OrbitControls s'en sert comme pôle de son repère sphérique : laisser un
  // `up` incliné derrière soi ferait tourner toute la carte au premier glissé.
  // C'est la même raison qui interdit de forcer `up` au nord pour la vue du
  // dessus (voir camera-shots.js, TOP_DOWN_DIR).
  _redresser() {
    if (this.camera) this.camera.up.set(0, 1, 0)
  }

  // LE ROULIS, et pourquoi il ne se met pas dans `camera.up` seul.
  //
  // `lookAt` reconstruit la base caméra à partir de `up`. En inclinant `up`
  // autour de l'axe de visée, l'horizon bascule dans le cadre — c'est
  // exactement l'effet voulu, et c'est la seule façon de l'obtenir sans toucher
  // au quaternion après coup (ce que `lookAt` écraserait à l'image suivante).
  // On tourne donc `up` autour de la DIRECTION DE VISÉE, puis on vise.
  _orienter(pos, cible, roulis) {
    const cam = this.camera
    cam.position.set(pos.x, pos.y, pos.z)
    this._axe.set(cible.x - pos.x, cible.y - pos.y, cible.z - pos.z)
    if (this._axe.lengthSq() < 1e-12) return
    this._axe.normalize()
    this._up.set(0, 1, 0).applyQuaternion(this._q.setFromAxisAngle(this._axe, -roulis))
    cam.up.copy(this._up)
    cam.lookAt(cible.x, cible.y, cible.z)
    // La cible d'OrbitControls suit le regard : si l'utilisateur attrape la
    // caméra juste après, il orbite autour de ce qu'il regardait, pas autour
    // d'un point resté au centre du bloc.
    this.controls.target.set(cible.x, cible.y, cible.z)
  }

  update(dt) {
    if (!this.active || !this.plan || !this.etat) return
    this.etat = stepPilote(this.etat, dt, this.plan, { sampleGround: this.sampleGround })
    const pose = poseDe(this.etat, this.plan, { sampleGround: this.sampleGround })
    this._orienter(pose.pos, pose.target, pose.roulis)

    // UN VOL FINIT. Le pilote se pose sur le cadrage où il en est et rend la
    // main — doctrine du dépôt (camera-shots.js). Le cran reste sélectionné :
    // le clic suivant enchaîne sur le vol d'après.
    if (this.etat.phase === 'fini') {
      this.active = false
      this.plan = null
      this.etat = null
      this._redresser()
      this.onState()
    }
  }
}
