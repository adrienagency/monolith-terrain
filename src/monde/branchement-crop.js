// LE BRANCHEMENT DU CROP — Tâche I du plan « UNE SEULE TERRE »
// (`docs/superpowers/plans/2026-08-21-terre-unique.md`).
//
// Module PUR : ni DOM, ni three.js, ni fetch. Il n'importe que la loi des seuils
// (`seuil-socle.js`) et parle au globe par sa seule interface publique. Tout se
// vérifie sous node (`test/crop-branche.test.js`).
//
// ══════════ 0. POURQUOI CE FICHIER EXISTE ═══════════════════════════════════
//
// ⚠️ **LE PLAN N'AVAIT AUCUNE TÂCHE QUI BRANCHE CE QU'IL CONSTRUIT.** Les Tâches
// A à G ont posé six méthodes sur le globe — `poserCrop`,
// `construireParoisCrop`, `poserHabillage`, `poserRampe`, `poserMer`,
// `poserEstompage` — et, au 2026-08-21, `src/` hors `globe.js` comptait **zéro
// appelant de production** pour les cinq premières. L'application se comportait
// donc exactement comme avant le chantier, et **c'est Adrien qui l'a vu** :
// « j'ai l'impression de ne pas être sur le bon serveur ». Il était sur le bon
// serveur.
//
// ⚠️ **LA VEILLE VIT DANS UN MODULE, comme celle du socle et celle de
// l'estompage, et pour la même raison** : aucun test ne charge `main.js`, et
// l'état inter-images est précisément ce qui se casse en silence.
//
// ══════════ 1. CE QUI EST RÉUTILISÉ, ET CE QUI N'EST PAS REFAIT ═════════════
//
// ⚠️ **LES SEUILS SONT CEUX DU SOCLE, AU BIT PRÈS.** `socleVisible` décide déjà
// quand le socle plat naît (32 274 m) et meurt (40 343 m, hystérésis ×1,25).
// **C'est la MÊME décision pour le crop** — c'est même toute l'idée du chantier :
// le socle DEVIENT une découpe dans la planète. En refaire un second jeu de
// seuils, c'est deux mondes qui divergent d'une image puis d'un palier. Ce
// module n'écrit donc aucun nombre d'altitude.
//
// ⚠️ **ET IL N'ÉCRIT AUCUN `fov` NON PLUS.** Le champ de vision entre par le
// contexte, que `main.js` remplit depuis la caméra VIVANTE. La Tâche F s'est
// fait prendre à porter un `fov = 33` introuvable dans le dépôt ; son correctif
// l'a remplacé par `FOV_DEG = 30`, ce qui est juste pour un DÉFAUT — mais un
// relevé sur l'application vivante (2026-08-21) donne `params.fov = 33`,
// `camera.fov = 33`, `camGlobe.fov = 33`, parce qu'un template appliqué au
// démarrage repose `params.fov` (`templates-user.js` sauvegarde `'fov'`).
// **« 33 n'existe nulle part dans le dépôt » était vrai de la SOURCE et faux de
// l'application qui tourne.** Le fov est donc une entrée, jamais une constante.
//
// ══════════ 2. L'ORDRE DES MAILLONS, ET IL N'EST PAS DÉCORATIF ══════════════
//
// `construireParoisCrop`, `poserRampe` et `poserMer` sortent toutes les trois
// en tête de corps si `this._crop` est nul, et `poserHabillage` y lit sa marge
// de côte (`uMargeCoteM`, `margeCoteDuCrop`). **La découpe passe donc en
// premier, et ce n'est pas un ordre de lecture : c'est une dépendance.** Le
// globe factice du test refuse comme le vrai, de sorte qu'une permutation change
// le COMPORTEMENT et pas seulement l'ordre d'une liste.
//
// ══════════ 3. LE REFUS N'EST PAS UNE FIN — LA REPRISE ══════════════════════
//
// ⚠️ **SANS ELLE, LE BRANCHEMENT NE MONTRE RIEN, ET C'EST ARITHMÉTIQUE.** Au
// moment où le crop naît, le quadtree n'a pas encore les tuiles fines de son
// emprise : `construireParoisCrop` et `poserRampe` rendent un refus de
// couverture. Or leur contrat, écrit dans `globe.js`, est que **« le refus ne
// touche pas à ce qui est en place »** — c'est ce qui les rend acceptables, et
// c'est aussi ce qui fait que **rien n'arrive jamais si personne ne redemande**.
//
// La reprise ne rejoue QUE les maillons qui ont refusé, et jamais la découpe :
// reconstruire les parois coûte un balayage du contour, la rampe 128² points, la
// mer un champ de 385² — les rejouer tous à chaque image serait un gel par
// image. `periodeReprise` est un nombre d'IMAGES, pas un temps : le module est
// pur, il n'a pas d'horloge.
//
// ══════════ 4. CE QUE CE MODULE NE FAIT PAS ════════════════════════════════
//
//   · **il ne cache pas le bloc plat** — c'est `main.js` qui tient la liste des
//     calques de surface, et il n'y en a QU'UNE (cinq accidents de liste
//     dupliquée sont racontés dans ce fichier-là) ;
//   · **il ne décide pas quand il a le droit de décider** — la garde du cran
//     (`modes.busy`, la largeur du bloc désaccordée d'une image) vit dans
//     `main.js`, à côté de celle du seuil du socle, parce que c'est là que ces
//     grandeurs existent ;
//   · **il n'anime pas la mer** — `animerMer(dt)` est une cadence, donc une
//     affaire de boucle d'image.

import { socleVisible } from './seuil-socle.js'

/**
 * Les maillons de la chaîne, dans l'ordre où ils doivent être posés.
 * ⚠️ `crop` en tête : les quatre autres refusent sans lui (voir le §2).
 */
export const MAILLONS = Object.freeze(['crop', 'parois', 'habillage', 'rampe', 'mer'])

// Un maillon rend `{ refus }` — `null` s'il a pris, une chaîne sinon — et,
// pour la mer seule, une `promesse` dont le refus n'arrive que plus tard.
const POSEURS = {
  crop({ globe, centre, zoom, tuilesParBloc }) {
    const rep = globe.poserCrop({ centre, zoom, tuilesParBloc })
    return { refus: rep ? null : 'crop' }
  },
  parois({ globe, parois }) {
    const r = globe.construireParoisCrop(parois || undefined)
    // ⚠️ `null` SIGNIFIE « PAS DE CROP », et c'est un refus comme un autre —
    // `construireParoisCrop` sort à sa première ligne quand `_crop` est nul.
    return { refus: r ? (r.refus ?? null) : 'crop' }
  },
  habillage({ globe, habillage }) {
    globe.poserHabillage(habillage || {})
    // ⚠️ **L'HABILLAGE NE REFUSE JAMAIS**, et ce n'est pas un oubli : il ne
    // mesure rien, il recopie quatre postes du socle. Ce qui manque (une texture
    // pas encore là) se voit par un uniforme éteint, pas par un refus.
    return { refus: null }
  },
  rampe({ globe, rampe }) {
    const r = globe.poserRampe(rampe || undefined)
    return { refus: r ? (r.refus ?? null) : 'crop' }
  },
  mer({ globe, mer }) {
    // ⚠️ **LA SEULE ASYNCHRONE DE LA CHAÎNE** : `poserMer` importe `ocean.js`
    // dynamiquement (three n'est pas résoluble sous node par une importation
    // statique). Son refus n'existe donc PAS encore quand la chaîne rend la
    // main — une reprise qui ne lirait que le retour synchrone laisserait une
    // mer absente pour toujours.
    return { refus: null, promesse: Promise.resolve(globe.poserMer(mer || {})) }
  },
}

/**
 * Pose la chaîne entière sur un globe : découpe, parois, habillage, rampe, mer.
 *
 * ⚠️ **ELLE NE TOURNE PAS PAR IMAGE.** Les parois balaient le contour, la rampe
 * `pas²` points, la mer cuit un champ de 385² : décision 5 du plan précédent,
 * « la gravure ne s'écrit qu'à l'arrêt ». C'est la veille qui décide quand.
 *
 * @param {object} arg
 * @param {object} arg.globe le globe (`src/globe.js`), ou n'importe quoi qui en
 *   porte les six méthodes — c'est ce qui rend ce module vérifiable sous node
 * @param {{lat:number, lon:number}} arg.centre le centre du BLOC, pas le lieu
 *   demandé : voir `latLonOrigineBloc()` dans `main.js`
 * @param {number} arg.zoom fixe la LARGEUR du crop, pas sa finesse
 * @param {number} arg.tuilesParBloc
 * @param {object} [arg.habillage] ce que `poserHabillage` attend
 * @param {object} [arg.rampe] ce que `poserRampe` attend
 * @param {object} [arg.parois] ce que `construireParoisCrop` attend
 * @param {object} [arg.mer] ce que `poserMer` attend
 * @returns {{refus: string[], mer: Promise<*>}}
 */
export function poserChaineCrop(arg = {}) {
  const { globe } = arg
  if (!globe || typeof globe.poserCrop !== 'function') {
    throw new TypeError('poserChaineCrop : il faut un globe — une chaîne muette est une chaîne absente')
  }
  const refus = []
  let mer = Promise.resolve(null)
  for (const nom of MAILLONS) {
    const r = POSEURS[nom](arg)
    if (r.refus) refus.push(nom)
    if (r.promesse) mer = r.promesse
  }
  return { refus, mer }
}

/**
 * L'automate qui tient le crop d'une image à l'autre.
 *
 * ⚠️ **IL A LA MÊME FORME QUE `creerVeilleSocle`, ET C'EST VOULU** : deux
 * automates qui décident de la même chose sur la même altitude doivent se lire
 * l'un à côté de l'autre. Ce qu'il a en plus est le §3 (la reprise) et la
 * SIGNATURE du lieu : un crop figé au premier bloc chargé serait le défaut que
 * `recadrerFenetre` a déjà payé une fois (Tâche 6 septies).
 *
 * @param {object} arg
 * @param {object|(() => object)} arg.globe le globe, ou une fonction qui le rend
 *   — `main.js` l'assigne tard, et un `undefined` figé ne se rattraperait pas
 * @param {() => (object|null)} arg.contexte ce que la chaîne doit recevoir à
 *   cette image ; `null` quand il n'y a pas encore de bloc, et **on n'invente
 *   alors aucun lieu**
 * @param {{maj:Function, poserMode:Function}|null} [arg.estompage] la veille de
 *   la Tâche G. ⚠️ **UN SEUL POINT D'ALIMENTATION** : un crop qui naîtrait sur
 *   une altitude et une planète qui s'effacerait sur une autre se contrediraient
 *   à l'écran.
 * @param {((ctx:object) => void)|null} [arg.reserverHauteurs] ⚠️ **SANS LUI, LES
 *   PAROIS ET LA RAMPE REFUSENT POUR TOUJOURS, ET C'EST MESURÉ.** Relevé à
 *   l'écran le 2026-08-21 (La Réunion z12, 600 tuiles de globe en cache) :
 *   `globe.tuilesAvecHauteurs().length` = **0**, donc `couverture` = **0**, donc
 *   `construireParoisCrop` et `poserRampe` rendent `refus: 'couverture'` à
 *   chaque tentative. La cause n'est pas un manque de réseau : `_buildMesh`
 *   RELÂCHE `t.heights` dès le maillage bâti (Tâche 4 sexies), **sauf pour les
 *   clés réservées par `gardeHauteurs`**. Quelqu'un doit donc réserver l'emprise
 *   du crop — `demanderEmprise` du flux —, et ce quelqu'un n'est pas ce module,
 *   qui est pur. Appelé à la pose et à chaque reprise, jamais par image.
 * @param {(() => void)|null} [arg.masquerSocle] ⚠️ **CE QUI FAIT QU'IL N'Y A PLUS
 *   QU'UNE TERRE, ET SANS LUI IL Y EN A DEUX.** Le bloc plat est opaque et se
 *   dessine APRÈS la passe de fond : laissé allumé, il recouvre le crop en
 *   entier et l'écran est exactement celui d'avant le chantier — c'est ce que
 *   l'Étape 6 a vu à la première image, `terrain.mesh.visible === true` avec
 *   `uCropOn === 1`. Appelé **une fois par entrée en surface**, jamais par
 *   image : la liste des calques qu'il touche en compte quatorze.
 * @param {number} [arg.periodeReprise] en IMAGES — voir le §3
 * @param {boolean} [arg.cropAuDepart] l'état de l'application au chargement
 * @param {boolean} [arg.modeSurfaceAuDepart]
 */
export function creerVeilleCrop({
  globe,
  contexte,
  estompage = null,
  masquerSocle = null,
  reserverHauteurs = null,
  periodeReprise = 30,
  cropAuDepart = false,
  modeSurfaceAuDepart = true,
} = {}) {
  if (!globe) {
    throw new TypeError('creerVeilleCrop : il faut un `globe` (ou une fonction qui le rend)')
  }
  if (typeof contexte !== 'function') {
    throw new TypeError('creerVeilleCrop : `contexte` est obligatoire — sans lieu, le crop tomberait au milieu de l’Atlantique')
  }
  const lireGlobe = typeof globe === 'function' ? globe : () => globe

  let pose = !!cropAuDepart
  let modeSurface = !!modeSurfaceAuDepart
  let signature = null
  let refus = []
  let bascules = 0
  let depuisPose = 0
  // ⚠️ **LES PROMESSES EN VOL SONT GARDÉES**, et pas par confort : sans elles un
  // test ne peut pas attendre le refus de la mer, et rien ne l'obligerait à
  // exister. C'est aussi ce qui permet à `retirerCrop` de ne pas se faire
  // écraser par une mer partie avant lui.
  let enVol = Promise.resolve()
  let jeton = 0
  // ⚠️ **UNE FOIS PAR ENTRÉE EN SURFACE, ET LE « UNE FOIS » COMPTE.** La liste
  // de calques que `masquerSocle` rappelle en touche quatorze : la repasser à
  // chaque image serait exactement ce que la garde de `creerVeilleSocle` évite.
  let socleMasque = false

  function suivreMer(promesse, monJeton) {
    enVol = promesse.then((r) => {
      if (monJeton !== jeton) return // une pose plus récente a pris la main
      const echoue = !r || !!r.refus
      const dedans = refus.includes('mer')
      if (echoue && !dedans) refus = [...refus, 'mer']
      else if (!echoue && dedans) refus = refus.filter((n) => n !== 'mer')
    }, () => {})
    return enVol
  }

  function poserTout(g, ctx) {
    // ⚠️ **AVANT LA CHAÎNE, PAS APRÈS.** `_buildMesh` relâche les hauteurs des
    // tuiles NON réservées : une tuile bâtie avant la réservation les a déjà
    // perdues, et `demanderEmprise` doit la redemander. L'ordre n'est pas
    // cosmétique — c'est celui que `flux-terrain.js` écrit déjà pour le socle.
    reserverHauteurs?.(ctx)
    jeton++
    const r = poserChaineCrop({ globe: g, ...ctx })
    refus = r.refus
    depuisPose = 0
    suivreMer(r.mer, jeton)
  }

  // ⚠️ **ELLE NE REJOUE QUE CE QUI A REFUSÉ, ET JAMAIS LA DÉCOUPE.** Rejouer la
  // chaîne entière pour rattraper une paroi coûterait le champ de mer (385²) et
  // le balayage de rampe (128²) à chaque tentative.
  function reprendre(g, ctx) {
    depuisPose = 0
    reserverHauteurs?.(ctx)
    // ⚠️ **IL Y AVAIT ICI UNE GARDE `if (nom === 'crop') continue`, ET C'ÉTAIT DU
    // CODE MORT — TROUVÉ PAR LA CAMPAGNE DE MUTATION, PAS PAR LA RELECTURE.** La
    // muter ne faisait rougir aucun test, et pour cause : `refus` ne peut PAS
    // contenir `'crop'`. `poserCrop` rend toujours son repère, et les trois
    // maillons qui refusent faute de découpe sont poussés sous LEUR nom, pas sous
    // le sien. Une garde qu'aucun chemin n'atteint est une garde qui ment sur ce
    // qu'elle protège ; retirée plutôt que testée à vide. **Si la découpe venait
    // un jour à refuser, la rejouer serait de toute façon le bon geste.**
    const restant = []
    for (const nom of refus) {
      const r = POSEURS[nom]({ globe: g, ...ctx })
      if (nom === 'mer') { const j = ++jeton; suivreMer(r.promesse, j); continue }
      if (r.refus) restant.push(nom)
    }
    refus = restant
  }

  function retirer(g) {
    jeton++
    g?.retirerCrop()
    pose = false
    signature = null
    refus = []
    bascules++
  }

  return {
    /**
     * Une image. `altitudeEllipsoideM` est l'altitude géométrique de la caméra
     * au-dessus de l'ellipsoïde — règle R1, celle que `loi-altitude.js` porte
     * SANS `meanM`. Une altitude non finie conserve l'état, même contrat que
     * `socleVisible`.
     */
    maj(altitudeEllipsoideM) {
      // ⚠️ **L'ESTOMPAGE EST NOURRI MÊME EN ORBITE**, et le §6 de
      // `estompage-terre.js` dit pourquoi : sa veille FORCE zéro hors surface,
      // là où celle du socle GÈLE. La priver de l'image la laisserait sur la
      // dernière valeur de surface — une planète effacée au moment précis où
      // elle redevient le sujet.
      estompage?.maj(altitudeEllipsoideM)
      if (!modeSurface) return pose
      // ⚠️ **LE BLOC PLAT PART AVANT TOUTE DÉCISION D'ALTITUDE, ET C'EST VOULU.**
      // Sous ce drapeau il n'a plus lieu d'exister à aucune altitude : le
      // laisser vivre au-dessus du seuil remettrait un socle devant la planète
      // entière — la capture d'Adrien à Z5, remise au goût du jour.
      if (!socleMasque) { socleMasque = true; masquerSocle?.() }
      const g = lireGlobe()
      if (!g) return pose
      const voulu = socleVisible({ altitudeEllipsoideM, visibleAvant: pose })
      if (!voulu) {
        if (pose) retirer(g)
        return false
      }
      const ctx = contexte()
      // pas encore de bloc : on n'invente pas un lieu, on attend la prochaine image
      if (!ctx || !ctx.centre) return pose
      const s = `${ctx.centre.lat}|${ctx.centre.lon}|${ctx.zoom}|${ctx.tuilesParBloc}`
      if (!pose || s !== signature) {
        // ⚠️ **UN DÉMÉNAGEMENT N'EST PAS UNE NAISSANCE** : le compteur de
        // bascules sert à mesurer le clignotement, pas les déplacements.
        if (!pose) bascules++
        pose = true
        signature = s
        poserTout(g, ctx)
        return true
      }
      depuisPose++
      if (refus.length && depuisPose >= periodeReprise) reprendre(g, ctx)
      return true
    },

    /**
     * Le mode de `modes.js`. ⚠️ Il PRIME : en orbite la planète est le sujet,
     * et une découpe dedans n'a plus aucun sens.
     */
    poserMode(surface) {
      modeSurface = !!surface
      estompage?.poserMode(surface)
      // ⚠️ **L'ORBITE REND SES CALQUES AU SOCLE**, et `modes.js` les rallume en
      // revenant : le masquage se redemande donc à chaque entrée en surface.
      if (!modeSurface) socleMasque = false
      if (!modeSurface && pose) retirer(lireGlobe())
      return pose
    },

    /** Le crop est-il posé ? */
    get pose() { return pose },
    /** Les maillons qui ont refusé et que la reprise redemande. */
    get refus() { return [...refus] },
    /** Combien de fois le crop est né ou mort depuis le chargement. */
    get bascules() { return bascules },
    /** Le lieu sur lequel la chaîne est posée — pour les sondes et les bancs. */
    get signature() { return signature },
    /** La dernière mer partie, pour qui doit l'attendre (les tests, les bancs). */
    enVol() { return enVol },
  }
}
