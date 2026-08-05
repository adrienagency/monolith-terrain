// La barre course — plein écran, hauteur fixe, seule survivante à l'écran
// pendant la lecture d'un tracé (le reste de l'UI se replie, voir
// course-bar.css).
//   · LA TÊTE : le titre de la course (serif éditorial) ET les chiffres du
//     parcours — distance, D+, D−, altitudes. Ils ne bougent jamais : on les
//     lit une fois en arrivant, comme la légende d'une carte.
//     ⚠️ ILS ÉTAIENT DANS LE CORPS, sous le profil, et c'est ce qui écrasait
//     le profil : il lui restait ~57 px d'amplitude pour dessiner 2 000 m de
//     dénivelé sur 770 px de large. Remontés ici, ils rendent 41 px au profil
//     et remplissent une tête qui était une bande morte.
//   · LE PARCOURS (gauche) : le profil altimétrique de gpx.js, RÉUTILISÉ tel
//     quel (voir syncCourseBarMode dans main.js).
//   · LA LECTURE (centre) : play, vitesse, caméra. Des outils, donc discrets.
//   · LE CARNET (droite) : ce qui défile avec la tête de lecture.
// Un seul titre, en tête de barre, dans le serif éditorial de ShibuMap —
// gpx.js pose déjà le sien deux fois (nom de course + nom de calque), on ne
// les supprime pas (d'autres écrans en dépendent), on les CACHE en CSS tant
// que le profil est embarqué ici (.cb-embedded dans course-bar.css).
import './course-bar.css'
import { buildCarnetCourse } from './carnet-course.js'
import { casseDeNom } from '../casse-titre.js'

const VITESSES = [0.5, 1, 2, 4]

const ic = (d, extra = '') =>
  `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${d}${extra}</svg>`
// ⚠️ MÊME LANGUE D'ICÔNES POUR TOUTE LA BARRE. Le triangle de lecture, la
// pause et le chevron de repli étaient encore bricolés en bordures CSS —
// exactement la technique que le commentaire ci-dessous condamne, et qui avait
// déjà été payée une fois. Elle coûtait ici plus qu'une incohérence : la pause
// (une barre de 4 px doublée par un box-shadow de 8 px, donc 12 px d'encre
// pour un élément de 4) était CENTRÉE SUR SA BARRE GAUCHE, soit 2,4 px hors
// du centre du disque — sur le seul objet à contraste maximal de l'écran.
// Un tracé, lui, se centre en écrivant ses coordonnées.
const icPlein = (d) => `<svg viewBox="0 0 20 20" fill="currentColor">${d}</svg>`
// centre de gravité du triangle en (10,10), pas son cadre : un triangle centré
// sur sa boîte paraît décalé à gauche, c'est le classique du bouton lecture
const ICONE_LECTURE = icPlein('<path d="M7 4.6 16 10 7 15.4Z"/>')
// deux barres de 2,9 px espacées de 1,8 : l'encre va de 6,2 à 13,8, centre 10
const ICONE_PAUSE = icPlein('<rect x="6.2" y="4.5" width="2.9" height="11" rx="1"/><rect x="10.9" y="4.5" width="2.9" height="11" rx="1"/>')
const ICONE_CHEVRON = ic('<path d="M6 8.4 10 12.4 14 8.4"/>')

// Icônes DESSINÉES, pas bricolées en bordures CSS : la première version
// composait ces pictos avec des pseudo-éléments (carrés, triangles obtenus
// par border-color) — à 26 px ils étaient indistinguables les uns des autres.
const CAM_BTNS = [
  { cls: 'top', label: 'Vue de dessus', svg: ic('<rect x="4" y="4" width="12" height="12" rx="2"/><circle cx="10" cy="10" r="1.6" fill="currentColor" stroke="none"/>'), act: (r) => r.setView(5) },
  // setView(8) = cap NORD autour de la tête (drone-cam.js : compass{8:0}) —
  // pas une « vue de suivi », le libellé le disait faux
  { cls: 'nord', label: 'Orienter au nord', svg: ic('<path d="M10 3v14"/><path d="M6.5 6.5 10 3l3.5 3.5"/>'), act: (r) => r.setView(8) },
  { cls: 'gauche', label: 'Pivoter à gauche', svg: ic('<path d="M15.5 12a5.5 5.5 0 1 0-1.9 4.2"/><path d="M4.6 8.2 4.5 12l3.8.1"/>'), act: (r) => r.rotateBy(-18) },
  { cls: 'droite', label: 'Pivoter à droite', svg: ic('<path d="M4.5 12a5.5 5.5 0 1 1 1.9 4.2"/><path d="M15.4 8.2l.1 3.8-3.8.1"/>'), act: (r) => r.rotateBy(18) },
  { cls: 'plus', label: 'Rapprocher', svg: ic('<circle cx="9" cy="9" r="5"/><path d="m13 13 3.5 3.5M9 6.8v4.4M6.8 9h4.4"/>'), act: (r) => r.zoomBy(1 / 1.2) },
  { cls: 'moins', label: 'Éloigner', svg: ic('<circle cx="9" cy="9" r="5"/><path d="m13 13 3.5 3.5M6.8 9h4.4"/>'), act: (r) => r.zoomBy(1.2) },
]

const nb = (v, d = 0) =>
  (Number.isFinite(v) ? v : 0).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d })

export function buildCourseBar({ container, onTogglePlay, onQuit, getSpeed, setSpeed, getCameraRig, isPlaying }) {
  const bar = document.createElement('div')
  // ⚠️ .ce-glassbox EST LE VERRE DU SYSTÈME, PAS UNE DÉCORATION À RECOPIER.
  // La barre redéclarait à la main les cinq propriétés de .ce-glassbox, avec
  // deux valeurs qui avaient DÉRIVÉ (blur 22 / saturate 1,6 contre 20 / 1,5) —
  // c'est-à-dire le péché que cette feuille condamne pour les trois boutons,
  // commis un cran au-dessus, sur le conteneur, et visible dans la MÊME image :
  // le panneau de profil qu'elle héberge porte, lui, .ce-glassbox (gpx.js).
  // Ne reste qu'une différence, décidée et qualifiée : le verre FORT
  // (--ce-glass-strong), parce que ce panneau porte le contenu le plus dense
  // de l'écran par-dessus un rendu 3D qui bouge. Voir .cb-bar.ce-glassbox.
  bar.className = 'cb-bar ce-glassbox cb-hidden'
  // ⚠️ UNE RÉGION NOMMÉE, PARCE QUE LE MODE COURSE VIDE LA PAGE. Entrer en
  // course fait disparaître tout le reste de l'interface (course-bar.css,
  // règle body.ce-course-mode) et dépose le focus sur Lecture : sans rôle ni
  // nom accessible, un utilisateur de lecteur d'écran entendait « Lecture,
  // bouton » et rien d'autre — ni que les panneaux venaient d'être retirés, ni
  // comment nommer la zone où il vient d'atterrir, ni de quoi la retrouver à
  // la navigation par région. Le <h2> du titre existait déjà mais n'étiquetait
  // rien : on lui donne un id et la barre s'en sert.
  bar.setAttribute('role', 'region')
  bar.setAttribute('aria-labelledby', 'cb-titre')
  // id stable : le bouton Replier doit pouvoir DÉSIGNER ce qu'il replie
  // (aria-controls), sinon un lecteur d'écran annonce « replié » sans dire
  // replié quoi. Un seul exemplaire de barre existe, l'id fixe suffit.
  //
  // ⚠️ LES CLASSES ce-* NE SONT PAS DÉCORATIVES : ce sont les composants du
  // système (v28.css). La barre les REDESSINAIT à la main — segmenté, bouton
  // d'icône, bouton texte — avec des valeurs qui avaient dérivé sur chaque axe
  // (rail, rayon, hauteur, graisse, police), au point d'être la seule surface
  // de ShibuMap dont les contrôles ne ressemblent à aucun autre écran.
  bar.innerHTML = `
    <div class="cb-head">
      <h2 class="cb-title" id="cb-titre"></h2>
      <dl class="cb-chiffres"></dl>
      <div class="cb-head-actions">
        <button class="cb-collapse ce-icon-btn" type="button" aria-controls="cb-body" aria-expanded="true">${ICONE_CHEVRON}</button>
        <button class="cb-quit ce-btn" type="button">Quitter</button>
      </div>
    </div>
    <div class="cb-body" id="cb-body">
      <section class="cb-zone cb-zone-parcours">
        <div class="cb-profil"></div>
      </section>
      <section class="cb-zone cb-zone-lecture">
        <div class="cb-outils">
          <button class="cb-play" type="button" aria-label="Lecture">${ICONE_LECTURE}</button>
          <div class="cb-stack">
            <div class="cb-speeds ce-seg" role="group" aria-label="Vitesse de lecture"></div>
            <div class="cb-cam" role="group" aria-label="Caméra"></div>
          </div>
        </div>
      </section>
      <section class="cb-zone cb-zone-carnet"></section>
    </div>
    <p class="cc-sr" id="cb-sr"></p>
  `
  container.appendChild(bar)

  const titleEl = bar.querySelector('.cb-title')
  const playBtn = bar.querySelector('.cb-play')
  const speedsEl = bar.querySelector('.cb-speeds')
  const camEl = bar.querySelector('.cb-cam')
  const profileZone = bar.querySelector('.cb-profil')
  const chiffresEl = bar.querySelector('.cb-chiffres')
  // ⚠️ LA RÉGION LIVE EST HORS DU CORPS REPLIABLE, ET C'EST STRUCTUREL. Elle
  // vivait dans .cc-body, donc dans .cb-body : replier la barre (geste
  // purement visuel, demande n°5 du client) pose `bodyEl.inert` et
  // `visibility: hidden`, et les deux retirent le sous-arbre de l'arbre
  // d'accessibilité — replier COUPAIT toutes les annonces de course, pendant
  // que le carnet continuait d'écrire dedans soixante fois par seconde. Posée
  // ici, à côté de .cb-head, elle est clippée à 1 px et n'occupe aucune place :
  // le repli continue de cacher ce qui se voit, et laisse parler ce qui
  // s'entend.
  const carnet = buildCarnetCourse({
    container: bar.querySelector('.cb-zone-carnet'),
    srNode: bar.querySelector('#cb-sr'),
  })

  for (const v of VITESSES) {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'cb-speed-btn ce-seg-btn'
    // ⚠️ la valeur vit dans le dataset, PAS dans le libellé : celui-ci est
    // francisé (« 0,5× ») et le relire avec parseFloat casserait en silence
    b.dataset.v = String(v)
    b.textContent = `${v}×`.replace('.', ',')
    b.setAttribute('aria-label', `Vitesse ${v}×`.replace('.', ','))
    b.addEventListener('click', () => { setSpeed(v); syncSpeed() })
    speedsEl.appendChild(b)
  }
  function syncSpeed() {
    const cur = getSpeed()
    for (const b of speedsEl.children) {
      const on = Math.abs(parseFloat(b.dataset.v) - cur) < 0.01
      b.classList.toggle('on', on)
      b.setAttribute('aria-pressed', on ? 'true' : 'false')
    }
  }

  for (const c of CAM_BTNS) {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = `cb-cam-btn ce-icon-btn cb-cam-${c.cls}`
    b.setAttribute('aria-label', c.label)
    b.title = c.label
    b.innerHTML = c.svg
    b.addEventListener('click', () => { const r = getCameraRig?.(); if (r) c.act(r) })
    camEl.appendChild(b)
  }
  // ⚠️ GARDE D'ÉGALITÉ, COMME syncPlay — elle manquait ICI ET ELLE COÛTE PLUS.
  // tick() est appelé par syncCourseBarMode() à CHAQUE image de la boucle de
  // rendu : on réécrivait `b.disabled` sur les six boutons soixante fois par
  // seconde, ce qui repasse par les étapes de changement d'attribut et
  // invalide le style :disabled pour rien.
  // Et surtout : si le rig caméra se désactive pendant qu'un bouton caméra a le
  // focus, `disabled = true` fait retomber le focus sur <body> — exactement la
  // discipline que show()/hide() mettent en place ailleurs. On rapatrie donc
  // le focus sur Lecture AVANT de désactiver.
  let _camVu = null
  function syncCamAvailable() {
    const off = !getCameraRig?.()
    if (_camVu === off) return
    _camVu = off
    if (off && camEl.contains(document.activeElement)) playBtn.focus?.({ preventScroll: true })
    camEl.classList.toggle('cb-cam-off', off)
    for (const b of camEl.children) b.disabled = off
  }

  playBtn.addEventListener('click', onTogglePlay)

  // ⚠️ UN SEUL ENDROIT ÉCRIT L'ÉTAT DU BOUTON REPLIER, et il est appelé
  // depuis les DEUX chemins qui replient ou déplient. La version d'avant
  // n'écrivait aria-expanded que dans le gestionnaire de clic : au montage
  // l'attribut n'existait pas (aucun état annoncé tant qu'on n'avait pas
  // cliqué), et show() retirait la classe cb-collapsed sans le remettre à
  // « true » — replier, Quitter, relancer une course, et la barre était
  // visuellement dépliée mais annoncée « replié ». Le libellé aussi restait
  // figé sur « Replier » alors que le bouton déplie.
  const collapseBtn = bar.querySelector('.cb-collapse')
  const bodyEl = bar.querySelector('.cb-body')
  function syncCollapse(replie) {
    collapseBtn.setAttribute('aria-expanded', replie ? 'false' : 'true')
    const mot = replie ? 'Déplier la barre' : 'Replier la barre'
    collapseBtn.setAttribute('aria-label', mot)
    collapseBtn.title = mot
    // le corps replié fait 0 px de haut sous overflow:hidden : sans inert,
    // ses onze boutons restent atteignables à la tabulation dans une boîte
    // invisible (visibility:hidden le fait aussi côté CSS ; inert couvre le
    // focus programmatique et les navigateurs qui laissent passer)
    bodyEl.inert = replie
  }
  syncCollapse(false)
  collapseBtn.addEventListener('click', () => { syncCollapse(bar.classList.toggle('cb-collapsed')) })
  bar.querySelector('.cb-quit').addEventListener('click', onQuit)

  // le glyphe est ÉCHANGÉ, pas transformé : deux tracés distincts valent mieux
  // qu'un carré qu'on déforme (voir ICONE_LECTURE / ICONE_PAUSE). Garde
  // d'égalité parce que tick() rappelle ceci à chaque image.
  let _playVu = null
  function syncPlay() {
    const p = !!isPlaying()
    if (_playVu !== p) {
      _playVu = p
      playBtn.classList.toggle('cb-playing', p)
      playBtn.innerHTML = p ? ICONE_PAUSE : ICONE_LECTURE
      playBtn.setAttribute('aria-label', p ? 'Pause' : 'Lecture')
    }
  }

  function setTitle(name) {
    // ⚠️ LA CASSE NE TOUCHE QUE L'AFFICHAGE. `name` reste EXACTEMENT ce que
    // l'appelant a passé (raceState.name ou le nom du calque, voir
    // syncCourseBarMode dans main.js) — casseDeNom() est pure, elle ne fait
    // que dériver une chaîne d'affichage, jamais réécrire la donnée
    // d'origine. Beaucoup d'organisateurs saisissent au clavier verrouillé
    // majuscules : « GRAND RAID REUNION 2025 » se lisait moins bien qu'un
    // titre composé.
    titleEl.textContent = (name && casseDeNom(name)) || 'Parcours'
    titleEl.classList.toggle('cb-empty', !name)
  }

  // Les chiffres de la COURSE (figés) — pas ceux du carnet, qui défilent.
  // Le D− est là parce qu'il était CALCULÉ ET JETÉ (resumeParcours le rend) :
  // pour un traileur c'est la descente qui détruit les quadriceps et fait
  // exploser les fins de course, elle s'anticipe autant que la montée.
  // ⚠️ SOMMET, PLUS AMPLITUDE. Le quatrième bloc affichait « Altitude
  // 320–1840 m », c'est-à-dire EXACTEMENT l'échelle Y du profil dessiné vingt
  // pixels plus bas (gpx.js : eMin/eMax sont ces deux nombres). Le commentaire
  // du responsive le reconnaissait — « elle sert d'échelle au profil, qui est
  // juste en dessous » — et en tirait la conclusion inverse : il gardait le
  // chiffre là où le profil est le plus large, donc le plus redondant, et le
  // supprimait là où le profil rétrécit. Le profil porte désormais sa propre
  // échelle (les deux altitudes extrêmes écrites dessus), et la tête garde le
  // seul chiffre d'altitude qui décide quelque chose pour un coureur : le
  // point haut du parcours.
  // ⚠️ AUCUNE DONNÉE TIERCE ICI : que des nombres passés par nb(). Le nom de
  // la course, lui, ne passe JAMAIS par innerHTML — voir setTitle().
  function setResume(r) {
    if (!r) { chiffresEl.innerHTML = ''; return }
    chiffresEl.innerHTML = `
      <div class="cb-chiffre"><dt>Distance</dt><dd>${nb(r.km, 1)}<span>km</span></dd></div>
      <div class="cb-chiffre"><dt>D+</dt><dd>${nb(r.dplus)}<span>m</span></dd></div>
      <div class="cb-chiffre cb-chiffre-dmoins"><dt>D−</dt><dd>${nb(r.dminus)}<span>m</span></dd></div>
      <div class="cb-chiffre cb-chiffre-sommet"><dt>Sommet</dt><dd>${nb(r.altMax)}<span>m</span></dd></div>
    `
  }

  function show() {
    bar.classList.remove('cb-hidden')
    // on rouvre toujours dépliée : un repli est un geste de consultation, pas
    // une préférence à retenir d'une course à l'autre
    bar.classList.remove('cb-collapsed')
    syncCollapse(false)
    bar.inert = false
    // la garde d'égalité de syncCamAvailable est REMISE À ZÉRO à l'entrée :
    // la barre a pu être cachée pendant que le rig changeait d'état, et une
    // garde qui survit à une disparition d'écran est une garde qui ment
    _camVu = null
    syncSpeed(); syncCamAvailable(); syncPlay()
    // ⚠️ LE FOCUS DOIT ATTERRIR QUELQUE PART. Le mode course fait disparaître
    // (display:none) l'élément qui avait le focus : sans ce rappel, le focus
    // retombe sur <body> et la navigation clavier repart du tout début du
    // document. preventScroll parce que la page n'a pas à bouger pour ça.
    playBtn.focus?.({ preventScroll: true })
  }
  function hide() {
    bar.classList.add('cb-hidden')
    // inert et pas seulement pointer-events : la barre reste montée dans body
    // toute la vie de l'application, ses treize boutons ne doivent pas être
    // tabulables sur des écrans où aucune course n'existe.
    bar.inert = true
    syncPlay()
  }
  // état de départ : la barre est MONTÉE (classe cb-hidden), donc elle doit
  // aussi être hors d'atteinte dès maintenant. On ne passe pas par hide() :
  // il appelle isPlaying(), et le call site le fournit sous forme de fermeture
  // sur des variables déclarées plus bas dans main.js.
  bar.inert = true
  // ce qui peut changer sans clic (fin de lecture, poursuite qui rend la main)
  function tick() { syncPlay(); syncCamAvailable() }

  return { bar, profileZone, carnet, show, hide, tick, setTitle, setResume, dispose: () => bar.remove() }
}
