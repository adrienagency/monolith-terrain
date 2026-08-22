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
 * ⚠️ `crop` en tête : les cinq autres refusent sans lui (voir le §2).
 *
 * ⚠️ **`fond` EST EN DEUXIÈME, ET CE N'EST PAS UN RANGEMENT — Tâche J bis.** Il
 * donne au globe le relief SOUS-MARIN du crop, et les deux maillons qui le
 * suivent le LISENT : `parois` pose la base du bloc sous le point le plus bas de
 * la surface (le « basin guard » de `parois-crop.js`), `rampe` cale ses couleurs
 * sur la profondeur mesurée. Posé après eux, le fond aurait donné un bloc dont
 * le flanc commence deux kilomètres au-dessus de sa propre surface et une rampe
 * calée sur 130,36 m là où il y en a 2 116,3 (les deux chiffres sont relevés dans
 * l'application vivante — `.banc/vues-Jbis/Jbis-releves-bruts.json`).
 */
export const MAILLONS = Object.freeze(['crop', 'fond', 'parois', 'habillage', 'rampe', 'mer'])

/**
 * Les maillons qui LISENT le fond, dans l'ordre de `MAILLONS`.
 *
 * ⚠️ **SANS CETTE LISTE, LA REPRISE LAISSE UN BLOC INCOHÉRENT, ET ÇA A ÉTÉ VU À
 * L'ÉCRAN.** La nappe bathymétrique est ASYNCHRONE : au premier passage le fond
 * REFUSE (couverture ou bathymétrie absente) pendant que `parois` et `rampe`,
 * eux, PRENNENT — sur une surface encore plate. `reprendre` ne rejoue que ce qui
 * a refusé : quand le fond finit par prendre, la rampe garde sa profondeur d'une
 * surface qui n'existe plus. Relevé dans l'application, La Réunion z12 :
 * `uOceanDepth = 130,36 m` avec un fond de **2 116,3 m** sous les pieds.
 *
 * ⚠️ **ET L'HABILLAGE N'EN EST PAS**, ce n'est pas un oubli : il recopie quatre
 * postes du socle et ne mesure aucune hauteur. La mer non plus — elle cuit son
 * propre champ.
 */
export const LECTEURS_DU_FOND = Object.freeze(['parois', 'rampe'])

// ══════════ LE RAFRAÎCHISSEMENT DE L'HABILLAGE — Tâche K ter ════════════════
//
// ⛔ **L'HABILLAGE ÉTAIT POSÉ UNE FOIS, ET UNE SEULE, ET IL ARRIVAIT TROP TÔT.**
// Il « ne refuse jamais » (voir le poseur), donc `reprendre` ne le rejoue jamais ;
// et la chaîne entière ne se repose que si la SIGNATURE DU LIEU change. Or trois
// des choses qu'il transporte n'existent PAS encore quand le crop naît :
//
//   · le masque de côte — cuit par le bloc plat, il arrive après ;
//   · la mosaïque d'occupation du sol — elle n'existe que si l'utilisateur
//     allume la couche, ce qui peut arriver n'importe quand ;
//   · `amplitudeM`, qui CALE l'intervalle des courbes de niveau.
//
// **Relevé dans l'application vivante le 2026-08-22, La Réunion z12** :
// `contexteCrop().habillage.coastMask` **non nul** pendant que le globe portait
// `uCoastMaskOn = 0`, et `uContourInterval = 500` (le défaut mondial) pendant
// qu'`amplitudeM` valait **4 737,2 m**. Et couche d'occupation du sol allumée à
// la main : `terrain.mapUniforms.uSolOn = 1`, `ctx.habillage.sol` et `solLut`
// tous deux posés, **`globe.uniforms.uSolOn` resté à 0**.
//
// ⚠️ **C'EST UNE COURSE, PAS UNE PANNE FRANCHE — ET C'EST CE QUI L'A CACHÉE.**
// Sur un chargement où le masque arrive AVANT la première pose, l'image est
// juste. Sur un autre, elle ne l'est pas. Les deux ont été observés le même
// jour, sur la même machine, à la même URL.
//
// ⚠️ **LA RÉPARATION NE PASSE PAS PAR UN REFUS.** Faire refuser l'habillage
// tant qu'un masque manque le ferait rejouer toutes les `periodeReprise` images
// pour toujours dans les crops CONTINENTAUX, où il n'y a légitimement ni côte ni
// occupation du sol. On compare donc ce qu'on a POSÉ à ce que le contexte
// PORTE, et on ne repose que sur changement — **exactement la garde de
// `creerVeilleEstompage`** (« `appliquer` n'est appelé QUE lorsque la valeur
// posée change »). `poserHabillage` n'écrit que des uniformes : c'est le maillon
// le moins cher de la chaîne, et le seul qu'on puisse surveiller par image.

/**
 * Les champs de l'habillage qui décident de ce que le nuanceur allume.
 *
 * ⚠️ **LA LISTE EST FERMÉE, ET C'EST VOULU.** Comparer `Object.keys` du contexte
 * ferait dépendre le rafraîchissement de ce que `main.js` ajoute un jour dans
 * l'objet ; ici on nomme ce qu'on surveille, et un champ neuf qui devrait l'être
 * se déclare ici. Les trois vecteurs (`solOffset`, `solScale`, `solTexel`) n'y
 * sont pas : ce sont des objets MUTÉS EN PLACE par le socle (`setSol` fait
 * `.set(...)`), donc leur identité ne bouge jamais — mais ils ne changent
 * qu'avec `sol`, dont l'identité, elle, change.
 */
export const CHAMPS_HABILLAGE = Object.freeze([
  'coastMask',
  'sol',
  'solLut',
  'solOpacite',
  'amplitudeM',
  'contourIntervalM',
  'contourOpacity',
  'contourWeight',
  'grainForceM',
  'grainEchelle',
])

/**
 * L'habillage à poser diffère-t-il de celui qui est posé ?
 *
 * ⚠️ **`Object.is`, PAS `==`** : `null` et `undefined` sont deux réponses
 * différentes (« pas de masque » contre « champ absent du contexte »), et un
 * `NaN` d'amplitude ne doit pas se comparer égal à lui-même autrement que par
 * `Object.is` — sans quoi une amplitude devenue `NaN` gèlerait l'intervalle.
 *
 * `null` posé au départ signifie « rien n'a jamais été posé » : tout contexte
 * diffère alors, y compris un contexte vide.
 *
 * @param {object|null} pose - ce que `poserHabillage` a reçu la dernière fois
 * @param {object|null|undefined} voulu - ce que le contexte porte à cette image
 */
export function habillageDifferent(pose, voulu) {
  if (!pose) return true
  const v = voulu || {}
  for (const champ of CHAMPS_HABILLAGE) {
    if (!Object.is(pose[champ], v[champ])) return true
  }
  return false
}

// ══════════ L'ORBITE RETIRE LE CROP — Tâche K ter, défaut n° 4 ══════════════
//
// ⛔ **`poserMode` ÉTAIT ÉCRITE, TESTÉE, ET APPELÉE DE NULLE PART.** `maj` sort
// à sa première ligne utile sur `if (!modeSurface) return pose` — mais rien dans
// `main.js` ne disait jamais à cette veille qu'on avait quitté la surface.
// `veilleSocle` et `veilleEstompage` recevaient le mode depuis
// `setSurfaceVisible` ; celle-ci, non. **C'est un branchement absent, pas un
// réglage**, et c'est exactement la classe d'erreur qui a créé ce fichier.
//
// **Relevé le 2026-08-22, mode `orbital`, 3 000 km d'altitude**
// (`.banc/vues-Kter/AV-orbite.json`) : `uCropOn = 1`, `uHabOn = 1`,
// `uCoastMaskOn = 1`, `uLandMax = 2 584,4 m`, `uOceanDepth = 1 262,0 m`, parois
// ET mer du bloc encore dans la scène. Conséquences, toutes visibles :
//
//   · tout sommet au-dessus de 2 584 m saturait en blanc sur la planète entière,
//     et tout océan plus profond que 1 262 m saturait de même ;
//   · le masque de côte cuit pour La Réunion, lu en `ClampToEdge`, décidait de
//     la terre et de la mer **sur toute la sphère** ;
//   · les parois et la nappe de mer du bloc restaient en orbite.
//
// C'est la réserve n° 3 de la Tâche K bis, et c'est aussi pourquoi son jeu de
// six stations « ne s'améliorait quasiment pas » : la station orbitale portait
// la rampe du dernier crop.
//
// ⚠️ **CE N'EST PAS UN SEUIL DE PLUS — LA CONSIGNE « ZÉRO SAUT » TIENT.** On
// n'introduit aucune altitude : on branche le MÊME interrupteur de mode que les
// deux autres veilles reçoivent déjà, sur la MÊME bascule surface/orbite de
// `modes.js`, qui existe et est franche depuis toujours. La loi continue de
// l'estompage n'est pas touchée — elle reste `estompageTerre(altitude)`, et le
// retrait du crop en orbite est le comportement que `retirerCrop` porte depuis
// la Tâche A.
//
// ⚠️ **ET SOUS `terre unique`, L'ESTOMPAGE N'A QU'UN SEUL ÉCRIVAIN** : cette
// veille relaie `estompage.poserMode` elle-même (voir `poserMode`, plus bas).
// Appeler `veilleEstompage.poserMode` à côté ferait deux chemins pour un seul
// geste — mot pour mot l'argument que `majSeuilSocle` écrit déjà pour `maj`.

/** L'instantané qu'on garde pour la comparaison — les champs surveillés, seuls. */
function instantaneHabillage(habillage) {
  const src = habillage || {}
  const out = {}
  for (const champ of CHAMPS_HABILLAGE) out[champ] = src[champ]
  return out
}

// Un maillon rend `{ refus }` — `null` s'il a pris, une chaîne sinon — et,
// pour la mer seule, une `promesse` dont le refus n'arrive que plus tard.
const POSEURS = {
  crop({ globe, centre, zoom, tuilesParBloc }) {
    const rep = globe.poserCrop({ centre, zoom, tuilesParBloc })
    return { refus: rep ? null : 'crop' }
  },
  fond({ globe, fond }) {
    // ⚠️ **UN GLOBE SANS `poserFondCrop` N'EST PAS UNE PANNE.** Ce module est
    // vérifiable sous node contre un globe de papier (`test/crop-branche.test.js`), et
    // il a toujours accepté les faux globes qui portent les méthodes qu'ils
    // exercent. Un fond absent laisse la surface du dépôt — c'est exactement le
    // comportement d'avant la Tâche J bis, et il ne se signale pas par un refus
    // qui bloquerait la reprise pour toujours.
    if (typeof globe.poserFondCrop !== 'function') return { refus: null }
    const r = globe.poserFondCrop(fond || {})
    // ⚠️ **`neuf` DIT QUE LA SURFACE A CHANGÉ, ET LA REPRISE EN A BESOIN** — voir
    // `LECTEURS_DU_FOND`. `rebati` compte les maillages reconstruits : zéro veut
    // dire « le même fond qu'avant », donc rien à rejouer derrière.
    return { refus: r ? (r.refus ?? null) : 'crop', neuf: !!(r && r.rebati > 0) }
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
  // ⚠️ **CE QU'ON A POSÉ, PAS CE QU'ON A VU** — voir `habillageDifferent`.
  let habillagePose = null
  let rafraichissements = 0
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
    habillagePose = instantaneHabillage(ctx.habillage)
    suivreMer(r.mer, jeton)
  }

  /**
   * ⚠️ **LE SEUL MAILLON QU'ON SURVEILLE PAR IMAGE, ET IL NE COÛTE QUE DES
   * UNIFORMES.** Voir le pavé « LE RAFRAÎCHISSEMENT DE L'HABILLAGE ».
   */
  function rafraichirHabillage(g, ctx) {
    if (!habillageDifferent(habillagePose, ctx.habillage)) return false
    POSEURS.habillage({ globe: g, ...ctx })
    habillagePose = instantaneHabillage(ctx.habillage)
    rafraichissements++
    return true
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
    // ⚠️ **LE FOND ENTRAÎNE SES LECTEURS — Tâche J bis, voir `LECTEURS_DU_FOND`.**
    let fondNeuf = false
    for (const nom of refus) {
      const r = POSEURS[nom]({ globe: g, ...ctx })
      if (nom === 'fond' && !r.refus && r.neuf) fondNeuf = true
      if (nom === 'mer') { const j = ++jeton; suivreMer(r.promesse, j); continue }
      if (r.refus) restant.push(nom)
    }
    if (fondNeuf) {
      for (const nom of LECTEURS_DU_FOND) {
        // ⚠️ **CELUI QUI VIENT D'ÊTRE REJOUÉ NE L'EST PAS DEUX FOIS** : le
        // balayage de la rampe fait `pas²` points et le contour des parois plus
        // de mille — les rejouer pour rien serait payer deux fois la reprise.
        if (refus.includes(nom)) continue
        const r = POSEURS[nom]({ globe: g, ...ctx })
        if (r.refus) restant.push(nom)
      }
    }
    refus = restant
  }

  function retirer(g) {
    jeton++
    g?.retirerCrop()
    pose = false
    signature = null
    refus = []
    // ⛔ **IL Y AVAIT ICI UN `habillagePose = null`, ET C'ÉTAIT DU CODE MORT —
    // TROUVÉ PAR LA CAMPAGNE DE MUTATION, PAS PAR LA RELECTURE.** Le
    // raisonnement écrit à côté était plausible (« `retirerCrop` appelle
    // `retirerHabillage`, donc ce qui est posé n'est plus ce qu'on croyait »), et
    // il était sans effet : **`pose` retombe à faux et `signature` à `null`, donc
    // la première image qui repose passe forcément par `poserTout`**, lequel
    // écrit l'instantané avant que `rafraichirHabillage` ne puisse le lire.
    // Aucun chemin n'atteint le rafraîchissement avec un instantané périmé. Une
    // mutation qui retirait la ligne SURVIVAIT — c'est la définition du code
    // mort que ce chantier a déjà trouvé quatre fois. **Retirée plutôt que
    // testée à vide**, exactement comme la garde `if (nom === 'crop') continue`
    // de `reprendre`, dix lignes plus bas.
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
      // ⚠️ **APRÈS LA REPRISE, ET PAS AVANT.** La reprise peut reposer
      // l'habillage elle-même (s'il figurait dans les refus, ce qui n'arrive
      // pas aujourd'hui mais reste ouvert) ; le rafraîchissement doit juger sur
      // l'état FINAL de l'image, sinon il reposerait deux fois.
      rafraichirHabillage(g, ctx)
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
    /** Combien de fois l'habillage a été RAFRAÎCHI hors pose — Tâche K ter. */
    get rafraichissements() { return rafraichissements },
    /** Le lieu sur lequel la chaîne est posée — pour les sondes et les bancs. */
    get signature() { return signature },
    /** La dernière mer partie, pour qui doit l'attendre (les tests, les bancs). */
    enVol() { return enVol },
  }
}
