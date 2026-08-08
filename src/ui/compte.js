// ═══════════════════════════════════════════════════════════════════════════
// L'INTERFACE DU COMPTE — la porte, la connexion, mes créations, mon compte
// ═══════════════════════════════════════════════════════════════════════════
//
// Quatre écrans, une seule règle au-dessus de toutes les autres :
// **ShibuMap reste entièrement utilisable sans compte.** `race.mjs` l'écrit en
// tête de fichier (« public and unauthenticated by design ») et le plan le
// répète : jamais de mur, jamais de porte fermée. Concrètement, ici :
//   · la porte à l'export propose DEUX sorties de même poids, et celle qui
//     passe outre marche complètement ;
//   · le panneau « Mes créations » informe le visiteur déconnecté au lieu de
//     lui réclamer une identité : une ligne, un bouton, et aucune barrière —
//     tout ce qui se trouve derrière lui reste atteignable sans compte ;
//   · aucun de ces écrans ne s'ouvre tout seul. Ils répondent à un geste.
//
// Les TEXTES viennent de docs/superpowers/specs/2026-08-07-comptes-textes.md,
// écrits AVANT cette interface, exprès : sur ces écrans-là les mots sont la
// conception. Ils sont recopiés tels quels. Ne les reformulez pas ici sans
// toucher d'abord au document.
//
// Aucune couleur, aucune police, aucun rayon nouveau : tout sort des jetons
// --ce-* de v28.css (voir compte.css, qui n'en déclare aucun).
//
// ───────────────────────────────────────────────────────────────────────────
// LE CONTRAT ATTENDU DE `src/compte.js`
// ───────────────────────────────────────────────────────────────────────────
// `src/compte.js` est écrit en parallèle et n'existait pas quand ce module a
// été posé. L'objet qu'il exposera doit répondre à ceci — c'est l'interface
// contre laquelle tout ce fichier est codé :
//
//   estConnecte()            → booléen
//   adresse()                → chaîne | null   (l'adresse de la session)
//   surChangement(fn)        → fonction de désabonnement ; `fn` est rappelée à
//                              chaque connexion ET déconnexion
//   demanderCode(adresse)    → Promise<void>   refus : { code: 'adresse-invalide'
//                              | 'envoi-impossible' | 'injoignable' }
//   verifierCode(adr, code)  → Promise<void>   refus : { code: 'code-faux'
//                              | 'code-refuse' | 'trop-essais' | 'injoignable' }
//                              ⚠️ 'code-refuse' couvre À LA FOIS un code faux et
//                              un code périmé : Supabase rend le même refus pour
//                              les deux (vérifié sur le vrai service), et on ne
//                              prétend pas trancher ce qu'il ne dit pas.
//   deconnecter()            → Promise<void>
//   mesCartes()              → Promise<Array<{ id, nom, lieu, publieeLe, url }>>
//                              `publieeLe` : millisecondes epoch ou chaîne ISO
//   exporterMesDonnees()     → Promise<void>   (elle remet le fichier elle-même)
//   supprimerMonCompte()     → Promise<void>
//
// ⚠️ TOUT CODE DE REFUS INCONNU RETOMBE SUR « injoignable ». C'est délibéré :
// le texte de « injoignable » est le seul qui commence par rassurer sur la
// carte en cours (« Ta carte, elle, reste intacte »), et c'est exactement la
// bonne chose à dire quand on ne sait pas ce qui s'est passé.
//
// En attendant ce module, `compteInerte` ci-dessous tient sa place : personne
// n'est connecté, l'authentification est injoignable, et ShibuMap fonctionne
// exactement comme avant. Le jour où `src/compte.js` arrive, une seule ligne
// change dans main.js (l'import) — rien ici.

import './compte.css'
import { el, button, segmented } from './kit.js'
import { liquidize } from './liquid.js'
import { Panel } from './shell.js'
import { mesurerPlancher } from '../plancher-ui.js'

// ─────────────────────────────────────────────────────── le socle sans compte
// Un objet nul complet, pas un `null` : le reste du fichier n'a alors AUCUNE
// branche « et si le module d'authentification manquait ». Il répond « non »
// et « injoignable », ce qui est la vérité tant qu'il n'y a pas de session.
export const compteInerte = {
  estConnecte: () => false,
  adresse: () => null,
  surChangement: () => () => {},
  demanderCode: () => Promise.reject({ code: 'injoignable' }),
  verifierCode: () => Promise.reject({ code: 'injoignable' }),
  deconnecter: () => Promise.resolve(),
  mesCartes: () => Promise.resolve([]),
  exporterMesDonnees: () => Promise.reject({ code: 'injoignable' }),
  supprimerMonCompte: () => Promise.reject({ code: 'injoignable' }),
}

// ────────────────────────────────────────────────────────────── les refus, en
// Un refus dit CE QUI S'EST PASSÉ, puis QUOI FAIRE. Jamais d'excuse, jamais de
// vague — c'est la règle de la maison, et la table du document la fixe mot
// pour mot.
const REFUS = {
  'code-faux': 'Ce code ne correspond pas. Vérifie les six chiffres du dernier message reçu.',
  // Supabase ne distingue pas un code faux d'un code périmé : il rend le même
  // `otp_expired` pour les deux. Ce texte-là est celui que la plupart des gens
  // verront, et il doit donc rester vrai dans les deux cas.
  'code-refuse': 'Ce code ne passe pas — il est faux, ou il a expiré. Vérifie les six chiffres du dernier message, ou demande-en un nouveau.',
  'trop-essais': 'Trop de tentatives. Attends une minute avant de réessayer.',
  'adresse-invalide': 'Cette adresse ne ressemble pas à une adresse mail. C’est le seul endroit où ton code sera envoyé.',
  'envoi-impossible': 'Le code n’a pas pu partir. Réessaie dans un instant — ce n’est pas ton adresse qui est en cause.',
  injoignable: 'La connexion ne répond pas. Ta carte, elle, reste intacte : réessaie dans un moment.',
}
export const messageRefus = (err) => REFUS[err?.code] ?? REFUS.injoignable

// ──────────────────────────────────────────────────────── la coquille modale
// Même grammaire que l'export (`.ce-modal-veil` + `.ce-modal.ce-glassbox`), à
// deux ajouts près qui manquaient là-bas et qu'on ne va pas refaire manquer
// ici : le focus entre dans la carte à l'ouverture et REVIENT d'où il venait à
// la fermeture, et la tabulation ne sort pas de la carte tant qu'elle est là.
// Le repli du focus : la première commande vivante de l'interface. Elle est
// cherchée À LA FERMETURE, jamais gardée — les barres se reconstruisent.
function replierFocus() {
  const cible = document.querySelector('.ce-topbar button, .ce-elembar button, .ce-bottombar button')
  cible?.focus?.()
}

// Le clavier d'une boîte de dialogue, posé UNE fois pour les deux coquilles
// (la modale de carte, et le voile plein écran de la connexion). Il tient les
// trois gestes qu'on doit à quelqu'un qui n'a pas de souris : Échap ferme, la
// tabulation ne sort pas, et le focus revient d'où il venait.
function clavierPiege(carte, close) {
  const focusables = () =>
    [...carte.querySelectorAll('button, [href], input, select, textarea')].filter((n) => !n.disabled && n.offsetParent !== null)
  const onKey = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); close(); return }
    if (e.key !== 'Tab') return
    const f = focusables()
    if (!f.length) return
    const [premier, dernier] = [f[0], f[f.length - 1]]
    if (e.shiftKey && document.activeElement === premier) { e.preventDefault(); dernier.focus() }
    else if (!e.shiftKey && document.activeElement === dernier) { e.preventDefault(); premier.focus() }
  }
  // en capture : les raccourcis clavier de l'application écoutent Échap eux
  // aussi, et fermeraient autre chose derrière la boîte
  window.addEventListener('keydown', onKey, true)
  return () => window.removeEventListener('keydown', onKey, true)
}

// Le repli du focus à la fermeture — la même règle pour les deux coquilles.
// ⚠️ ON VÉRIFIE QUE LE FOCUS A ATTERRI, plutôt que de vérifier qu'il POUVAIT
// atterrir. Le test `isConnected` seul laissait passer les deux cas réels, tous
// deux mesurés à l'écran : l'entrée de menu qui a ouvert la boîte est retirée du
// DOM en même temps que le menu (isConnected faux), et une porte ouverte APRÈS
// l'export part d'un `<body>` déjà actif — `body.focus()` ne fait rien, et il
// est bel et bien `isConnected`. Dans les deux cas la tabulation repartait du
// haut du document, c'est-à-dire exactement le défaut que cette ligne prétend
// corriger. On regarde donc où le focus est VRAIMENT, et on se rabat sur la
// première commande de l'interface, qui, elle, est toujours là.
function rendreFocus(rendu) {
  if (rendu?.isConnected) rendu.focus?.()
  const pose = document.activeElement
  if (!pose || pose === document.body || pose === document.documentElement) replierFocus()
}

function modale(cls, { onClose } = {}) {
  const rendu = document.activeElement
  const veil = el('div', 'ce-modal-veil ce-compte-veil')
  const carte = el('div', `ce-modal ce-glassbox ${cls}`)
  carte.setAttribute('role', 'dialog')
  carte.setAttribute('aria-modal', 'true')
  veil.append(carte)
  document.body.append(veil)

  let ferme = false
  const close = () => {
    if (ferme) return
    ferme = true
    detache()
    veil.remove()
    // rendre le focus est un geste d'accessibilité, pas une politesse : sans
    // lui, la tabulation repart du haut du document à chaque fermeture
    rendreFocus(rendu)
    onClose?.()
  }
  const detache = clavierPiege(carte, close)
  veil.addEventListener('mousedown', (e) => { if (e.target === veil) close() })

  // titre + corps, montés par l'appelant via `titre()` — l'id relie le titre à
  // la boîte de dialogue pour les lecteurs d'écran
  let n = 0
  const titre = (texte) => {
    const h = el('h3', null, texte)
    h.id = `ce-compte-t${++n}-${Math.random().toString(36).slice(2, 7)}`
    carte.setAttribute('aria-labelledby', h.id)
    return h
  }
  return { veil, carte, close, titre }
}

// ────────────────────────────────────────── la coquille PLEIN ÉCRAN
// La grammaire est celle de l'accueil (`.ce-hubveil`) : un voile qui prend
// toute la fenêtre, la carte floutée et vivante derrière, la croix de sortie au
// coin haut-droit, et les mots au centre. Elle est reprise TELLE QUELLE
// (compte.css n'ajoute que la place et le plan) parce que c'est exactement ce
// qui a été demandé — « un panneau d'overlay complet comme celui quand on
// charge la page au démarrage ».
//
// ⚠️ CE VOILE-LÀ PASSE AU-DESSUS DE TOUT, l'accueil non. `.ce-hubveil` vit en
// z-index 56, SOUS la barre du haut, parce que c'est son logo qui le rappelle.
// Celui-ci s'ouvre DEPUIS la barre du haut : le laisser dessous montrerait la
// pastille qu'on vient de cliquer par-dessus l'écran qu'elle a ouvert.
function voilePlein(cls, { onClose } = {}) {
  const rendu = document.activeElement
  const veil = el('div', `ce-cnx-veil ${cls}`)
  veil.setAttribute('role', 'dialog')
  veil.setAttribute('aria-modal', 'true')

  // la croix REPREND LA CLASSE DE CELLE DE L'ACCUEIL, elle ne la recopie pas :
  // une croix doit rester une croix d'un bout à l'autre du site, et deux
  // géométries jumelles finissent toujours par diverger.
  const croix = el('button', 'ce-hubclose ce-cnx-close', '✕')
  croix.type = 'button'
  croix.setAttribute('aria-label', 'Fermer')
  const scene = el('div', 'ce-cnx-scene')
  veil.append(croix, scene)
  document.body.append(veil)

  let ferme = false
  const close = () => {
    if (ferme) return
    ferme = true
    detache()
    veil.remove()
    rendreFocus(rendu)
    onClose?.()
  }
  const detache = clavierPiege(veil, close)
  croix.addEventListener('click', close)
  veil.addEventListener('mousedown', (e) => { if (e.target === veil) close() })

  // ⚠️ UN REFLOW, PAS UN `requestAnimationFrame` — la même correction que
  // `showLivraison` (ui/toast.js) et `avisSansCompte` plus bas, pour la même
  // raison : un rAF NE SE DÉCLENCHE PAS tant que le document n'est pas
  // composité, et le voile resterait alors à `opacity: 0`.
  void veil.offsetWidth
  veil.classList.add('show')

  let n = 0
  const titre = (texte) => {
    const h = el('h2', 'ce-cnx-titre', texte)
    h.id = `ce-cnx-t${++n}-${Math.random().toString(36).slice(2, 7)}`
    veil.setAttribute('aria-labelledby', h.id)
    return h
  }
  return { veil, scene, close, titre }
}

// ═════════════════════════════════════════════════ A. LA PORTE À L'EXPORT ═══
//
// LE MOMENT LE PLUS DÉLICAT DU PRODUIT. Quelqu'un vient de passer vingt
// minutes sur sa carte et veut son fichier. Ce n'est pas le moment de lui
// présenter une facture déguisée.
//
// ⚠️ LES DEUX SORTIES ONT LE MÊME POIDS VISUEL, et c'est le point le plus
// important de tout cet écran. D'où le choix de dessin : les deux boutons sont
// LE MÊME bouton — même hauteur, même largeur (flex: 1), même fond, même
// bordure, même graisse. Aucun n'est accentué, aucun n'est fantôme. Seul le
// libellé les distingue, parce que c'est le libellé qui porte le choix.
//
// Le réflexe du métier serait de mettre l'accent orange sur « Créer mon
// compte » et de laisser l'autre en lien gris. C'est précisément ce qu'Adrien
// interdit : « quelqu'un qui passe outre ne doit pas se sentir puni ».
//
// `onSuite` part TOUJOURS. La porte informe, elle ne retient jamais.
//
// ⚠️ ELLE NE SE POSE QU'UNE FOIS PAR SESSION. Qui exporte cinq images d'affilée
// a répondu à la question à la première : la reposer quatre fois de plus n'est
// plus une invitation, c'est du harcèlement, et c'est ainsi qu'une porte
// ouverte finit par se lire comme un mur. La réponse ne persiste pas d'une
// visite à l'autre — on n'écrit rien sur la machine de quelqu'un pour ça.
let porteRepondue = false
export const reinitialisePorte = () => { porteRepondue = false } // pour les bancs d'essai

export function porteExport(compte, { onSuite, onEnregistrerGabarit, onConnexion } = {}) {
  // déjà connecté, ou déjà répondu : il n'y a rien à demander, l'export part
  if (compte?.estConnecte?.() || porteRepondue) { onSuite?.(); return null }

  // Échap ou clic à côté N'EST PAS une réponse : rien ne part, et la question
  // reste posée pour la prochaine fois. Seuls les deux boutons répondent.
  const m = modale('ce-porte')
  m.carte.append(
    m.titre('Tu veux qu’on garde ta carte ?'),
    el('p', 'ce-compte-corps', 'Avec un compte, tu la retrouves ici la prochaine fois : ton tracé, tes couleurs, tes réglages. Sans compte, l’export part quand même — mais rien n’est gardé de notre côté.')
  )

  const choix = el('div', 'ce-porte-choix')
  const creer = button('Créer mon compte', () => {
    porteRepondue = true
    m.close()
    // La connexion est le MÊME écran que la création : un code à six chiffres
    // sur une adresse inconnue crée le compte, sur une adresse connue ouvre la
    // session. Il n'y a rien à distinguer, donc rien à choisir.
    ouvrirConnexion(compte, {
      onConnecte: () => onSuite?.(),
      // renoncer à la connexion ne renonce pas à l'export : c'est le sens même
      // de la porte, et l'oublier ici reconstruirait le mur par la bande
      onAbandon: () => onSuite?.(),
    })
    onConnexion?.()
  })
  const sans = button('Continuer sans compte', () => {
    porteRepondue = true
    m.close()
    onSuite?.()
    avisSansCompte({ onEnregistrerGabarit })
  })
  for (const b of [creer, sans]) b.classList.add('ce-porte-btn')
  choix.append(creer, sans)
  m.carte.append(choix)
  // ⚠️ ON POSE LE FOCUS SUR LA CARTE, PAS SUR UN BOUTON. Le mettre sur « Créer
  // mon compte » désignait un gagnant avant même qu'on ait lu la question.
  // Ici le clavier reste opérant (Échap ferme, Tab atteint les deux boutons
  // dans l'ordre) sans que l'écran ait choisi à la place de personne.
  m.carte.tabIndex = -1
  m.carte.focus()
  return m
}

// ────────────────────────────── l'avis après « Continuer sans compte »
// « Un message, pas une modale de plus » (le document). Il se pose en bas, sur
// le même plancher que le toast et la carte de livraison, et il ATTEND : il ne
// s'efface pas tout seul, parce qu'il porte un bouton.
//
// ⚠️ CE BOUTON N'EST PAS DÉCORATIF. C'est la seule chose qui rende
// l'avertissement honnête : prévenir sans donner le moyen d'agir, c'est se
// couvrir, pas aider.
export function avisSansCompte({ onEnregistrerGabarit } = {}) {
  document.querySelector('.ce-compte-avis')?.remove()
  mesurerPlancher()
  const carte = el('div', 'ce-compte-avis')
  carte.setAttribute('role', 'status')
  carte.setAttribute('aria-live', 'polite')
  carte.append(el('p', 'ce-compte-avis-texte', 'Ton export est en route. Pense à enregistrer ton gabarit sur ton ordinateur : sans compte, ShibuMap ne le garde pas.'))
  // ⚠️ ELLE PART UNE FOIS QU'ELLE A SERVI, ET PAS AVANT. Tant que personne n'a
  // enregistré son gabarit, l'avertissement tient et la carte attend : c'est
  // tout son objet. Mais une fois le geste fait, il n'y a plus rien à
  // avertir — et une carte qui campe indéfiniment en bas de l'écran finit par
  // se lire comme un décor. Huit secondes laissent la place à un second
  // enregistrement (le libellé le propose) avant qu'elle se retire seule.
  let conge = null
  const enregistrer = button('Enregistrer mon gabarit', () => {
    onEnregistrerGabarit?.()
    // le libellé change APRÈS le clic, comme la carte de livraison : la carte
    // reste, pour un second enregistrement
    enregistrer.textContent = 'Enregistrer à nouveau'
    clearTimeout(conge)
    conge = setTimeout(() => {
      carte.classList.remove('show')
      setTimeout(() => carte.remove(), 320)
    }, 8000)
  })
  enregistrer.classList.add('ce-compte-avis-btn')
  const fermer = el('button', 'ce-compte-avis-x', 'Fermer')
  fermer.type = 'button'
  fermer.addEventListener('click', () => { clearTimeout(conge); carte.remove() })
  carte.append(enregistrer, fermer)
  document.body.append(carte)
  // ⚠️ UN REFLOW, PAS UN `requestAnimationFrame` — LA MÊME CORRECTION QUE
  // `showLivraison` (ui/toast.js), ET POUR LA MÊME RAISON, VÉRIFIÉE ICI.
  // Un rAF NE SE DÉCLENCHE PAS tant que le document n'est pas composité :
  // onglet en arrière-plan, fenêtre réduite, ou simplement masquée. La carte
  // restait alors à `opacity: 0` — mesuré, `document.visibilityState` valant
  // « hidden ». Et c'est très exactement ce que fait quelqu'un qui lance un
  // export : il va voir ailleurs pendant que ça tourne. L'avertissement le plus
  // important de tout l'écran ne s'affichait pas au seul moment où il compte.
  void carte.offsetWidth
  carte.classList.add('show')
  return carte
}

// ═══════════════════════════════════════════════════════ B. LA CONNEXION ═══
//
// UN ÉCRAN PLEIN, PAS UNE BOÎTE. C'est la demande, mot pour mot : « ça ouvre un
// panneau d'overlay complet comme celui quand on charge la page au démarrage ».
// La grammaire est donc celle de l'accueil — voile flouté, carte vivante
// derrière, croix au coin, les mots au centre — et non celle d'une modale
// posée sur l'interface.
//
// ⚠️ LES DEUX ÉTAPES RESTENT DEUX ÉTAPES. Jamais les deux champs ensemble :
// personne n'a le code avant de l'avoir demandé, et un champ vide qu'on ne peut
// pas remplir est une impasse affichée. Ce qui change ici, c'est le CONTENANT,
// pas le parcours — et les textes sont ceux du document, au caractère près.
//
// ⚠️ LA ZONE DE SAISIE EST LIQUIDE, et c'est la seconde demande explicite :
// « le même système de panneau liquide qui s'adapte à ce qu'il y a dedans que
// pour la barre de menu liquide du bas ». Trois bulles fusionnées par le filtre
// goo — le champ, le bouton, les liens — dont la géométrie est relue à chaque
// changement. Comme les transitions des bulles passent PAR le filtre, la
// silhouette MORPHE au lieu de sauter : entre l'adresse et le code, entre un
// refus qui apparaît et un refus qui s'efface, entre deux libellés de longueurs
// différentes.
//
// ⚠️ ET LA TROISIÈME BULLE NE SURGIT PAS DE NULLE PART. À l'étape de l'adresse
// il n'y a pas de liens : plutôt que de la faire naître d'un coup à l'étape
// suivante (une bulle qui apparaît, c'est un saut, pas un morphe), on la garde
// vivante, RANGÉE SOUS CELLE DU BOUTON — une boîte analytique, la mécanique que
// liquid.js prévoit exactement pour ça. Elle en coule donc à l'étape 2, comme
// une goutte qui se détache de la masse, et y remonte au retour.
export function ouvrirConnexion(compte, { onConnecte, onAbandon } = {}) {
  let abouti = false
  const m = voilePlein('ce-cnx', { onClose: () => { if (!abouti) onAbandon?.() } })
  let adresse = ''

  // les MOTS vivent sur le voile, la SAISIE dans la bulle — la répartition de
  // l'accueil, où le titre est posé au-dessus de la barre et non dedans
  const mots = el('div', 'ce-cnx-mots')
  const bulle = el('div', 'ce-cnx-bulle ce-liquid')
  const zoneChamp = el('div', 'ce-cnx-champ')
  const zoneGo = el('div', 'ce-cnx-go')
  const zoneLiens = el('div', 'ce-cnx-liens')
  bulle.append(zoneChamp, zoneGo, zoneLiens)
  m.scene.append(mots, bulle)

  // La boîte d'un élément DANS le cluster (qui est en position:relative, donc
  // son offsetParent), gonflée comme le fait `inflate`. Elle sert au repos des
  // liens : rangés sous le bouton, ils n'ont pas de géométrie propre à mesurer.
  const GONFLE = 8
  const boiteDe = (n) => ({
    x: n.offsetLeft - GONFLE,
    y: n.offsetTop - GONFLE,
    w: n.offsetWidth + GONFLE * 2,
    h: n.offsetHeight + GONFLE * 2,
  })
  const lq = liquidize(bulle, {
    inflate: GONFLE,
    items: () => [
      { key: '__champ', el: zoneChamp },
      { key: '__go', el: zoneGo },
      zoneLiens.childElementCount
        ? { key: '__liens', el: zoneLiens }
        : { key: '__liens', box: boiteDe(zoneGo) },
    ],
  })

  // ---- étape 1 : l'adresse ------------------------------------------------
  function etapeAdresse() {
    mots.replaceChildren(
      m.titre('On t’envoie un code'),
      el('p', 'ce-compte-corps', 'Pas de mot de passe à retenir. Tu reçois six chiffres, tu les recopies, c’est fini.')
    )
    // libellé AU-DESSUS du champ, jamais en substitut : un libellé qui
    // disparaît à la saisie est un libellé qu'on ne peut plus relire
    const champ = el('label', 'ce-compte-champ')
    champ.append(el('span', 'ce-compte-lab', 'Ton adresse'))
    const inp = el('input', 'ce-compte-input')
    inp.type = 'email'
    inp.placeholder = 'toi@taclub.fr'
    inp.autocomplete = 'email'
    inp.value = adresse
    champ.append(inp)
    const err = el('p', 'ce-compte-err')
    err.setAttribute('role', 'alert')
    const envoyer = button('Envoyer le code', () => partir())
    envoyer.classList.add('ce-compte-primaire')

    async function partir() {
      adresse = inp.value.trim()
      err.textContent = ''
      envoyer.disabled = true
      // le libellé dit ce qui se passe MAINTENANT, jamais « Veuillez patienter »
      envoyer.textContent = 'Envoi du code…'
      // le libellé vient de changer de longueur : la bulle du bouton doit
      // suivre le mot, pas le rattraper au prochain sondage
      lq.refresh()
      try {
        await compte.demanderCode(adresse)
        etapeCode()
      } catch (e) {
        err.textContent = messageRefus(e)
        envoyer.disabled = false
        envoyer.textContent = 'Envoyer le code'
        lq.refresh()
        inp.focus()
      }
    }
    inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') partir() })
    zoneChamp.replaceChildren(champ, err)
    zoneGo.replaceChildren(envoyer)
    zoneLiens.replaceChildren()
    lq.refresh()
    inp.focus()
  }

  // ---- étape 2 : le code --------------------------------------------------
  function etapeCode() {
    // l'adresse en gras DANS la phrase : c'est la seule information que
    // l'utilisateur doit pouvoir vérifier d'un coup d'œil avant d'aller
    // chercher son message
    const corps = el('p', 'ce-compte-corps')
    corps.append(document.createTextNode('On l’a envoyé à '), el('b', null, adresse), document.createTextNode('. Il arrive en quelques secondes et reste valable un quart d’heure.'))
    mots.replaceChildren(m.titre('Ton code est parti'), corps)

    const champ = el('label', 'ce-compte-champ')
    champ.append(el('span', 'ce-compte-lab', 'Les six chiffres'))
    const inp = el('input', 'ce-compte-input ce-compte-code')
    inp.type = 'text'
    inp.inputMode = 'numeric'
    inp.maxLength = 6
    // `one-time-code` : le téléphone propose alors le code du SMS/mail sans
    // qu'on ait à basculer d'application. Gratuit, et c'est le geste réel.
    inp.autocomplete = 'one-time-code'
    inp.setAttribute('aria-label', 'Les six chiffres')
    champ.append(inp)
    const err = el('p', 'ce-compte-err')
    err.setAttribute('role', 'alert')
    // ⚠️ UN RENVOI RÉUSSI DOIT SE DIRE. Le champ se vidait, le focus revenait,
    // et rien n'annonçait qu'un second code était parti : celui qui n'a rien
    // reçu ne pouvait pas savoir si son clic avait servi, donc il recliquait.
    const info = el('p', 'ce-compte-info')
    info.setAttribute('role', 'status')
    const valider = button('Me connecter', () => verifier())
    valider.classList.add('ce-compte-primaire')

    async function verifier() {
      const code = inp.value.trim()
      err.textContent = ''
      info.textContent = ''
      valider.disabled = true
      valider.textContent = 'Connexion…'
      lq.refresh()
      try {
        await compte.verifierCode(adresse, code)
        abouti = true
        m.close()
        onConnecte?.()
      } catch (e) {
        err.textContent = messageRefus(e)
        valider.disabled = false
        valider.textContent = 'Me connecter'
        // le refus vient d'ajouter deux lignes dans le champ : la bulle grandit
        // avec lui, sinon le texte débordait d'une silhouette restée à sa taille
        lq.refresh()
        inp.select()
      }
    }
    // on ne garde que des chiffres : coller « 123 456 » depuis un message est
    // le geste le plus courant, et il ne doit pas échouer sur une espace
    inp.addEventListener('input', () => { inp.value = inp.value.replace(/\D+/g, '').slice(0, 6) })
    inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') verifier() })

    const renvoyer = el('button', 'ce-compte-lien', 'Renvoyer un code')
    renvoyer.type = 'button'
    // ⚠️ ET LE RENVOI SE REPOSE QUELQUES SECONDES. Rien n'empêchait d'enchaîner
    // les clics : chacun invalide le code précédent, si bien qu'à trois renvois
    // d'affilée les trois messages reçus portent des codes morts sauf le
    // dernier. Le décompte est DANS le libellé — un bouton grisé sans raison
    // visible se lit comme un bouton cassé.
    let decompte = null
    const reposer = (secondes) => {
      clearInterval(decompte)
      let reste = secondes
      renvoyer.disabled = true
      renvoyer.textContent = `Renvoyer un code (${reste} s)`
      decompte = setInterval(() => {
        // l'écran a pu se fermer, ou repartir sur l'adresse : un minuteur qui
        // survit à son bouton tourne jusqu'au rechargement
        if (!renvoyer.isConnected) { clearInterval(decompte); return }
        reste -= 1
        if (reste > 0) { renvoyer.textContent = `Renvoyer un code (${reste} s)`; return }
        clearInterval(decompte)
        renvoyer.disabled = false
        renvoyer.textContent = 'Renvoyer un code'
      }, 1000)
    }
    renvoyer.addEventListener('click', async () => {
      err.textContent = ''
      info.textContent = ''
      renvoyer.disabled = true
      try {
        await compte.demanderCode(adresse)
        inp.value = ''
        inp.focus()
        info.textContent = 'Un nouveau code est parti.'
        reposer(15)
      } catch (e) {
        err.textContent = messageRefus(e)
        renvoyer.disabled = false
      }
      lq.refresh()
    })
    const changer = el('button', 'ce-compte-lien', 'Changer d’adresse')
    changer.type = 'button'
    changer.addEventListener('click', () => etapeAdresse())

    zoneChamp.replaceChildren(champ, err, info)
    zoneGo.replaceChildren(valider)
    zoneLiens.replaceChildren(renvoyer, changer)
    lq.refresh()
    inp.focus()
  }

  etapeAdresse()
  return m
}

// ══════════════════════════════════════════ B bis. LA PASTILLE DE LA BARRE ═══
//
// LE COMPTE ÉTAIT RANGÉ DANS LES PARAMÈTRES, ET C'EST BIZARRE (Adrien).
// Une roue crantée abrite des réglages d'application ; une identité n'est pas
// un réglage. Le compte reprend donc sa place habituelle : une pastille dans la
// pill de droite, à la fin de la famille des réglages, juste avant « Publier ».
//
// ⚠️ L'ICÔNE EST LA PLUS CONVENTIONNELLE QU'ON PUISSE DESSINER — un buste dans
// un cercle. C'est une demande explicite : « choisis une icône habituelle pour
// les comptes ». Un compte n'est pas l'endroit où l'on invente une métaphore :
// il faut le reconnaître SANS le chercher, du premier coup d'œil, comme partout
// ailleurs. Même facture que le reste du jeu de la barre (grille de 24, trait
// de 1,8, `currentColor`, aucun remplissage).
const ICON_COMPTE =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="10" r="2.9"/><path d="M6.6 18.9a5.6 5.6 0 0 1 10.8 0"/></svg>'

// LA COCHE — un disque plein, la coche en creux dedans. Le disque est ce qui
// rend la marque lisible sur n'importe quel fond : la barre est translucide, et
// un rendu 3D bouge derrière elle. Une coche en trait seul y disparaîtrait la
// moitié du temps.
const ICON_COCHE =
  '<svg class="ce-compte-coche" viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="6"/><path d="M3.3 6.2 5.2 8l3.5-3.9" fill="none" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>'

/**
 * La pastille du compte, telle qu'elle vit dans la pill de droite.
 *
 * DEUX ÉTATS, LISIBLES D'UN COUP D'ŒIL — c'est tout l'objet de ce bouton :
 *   · déconnecté : un ANNEAU d'accent autour de l'icône. Il ne clignote pas et
 *     ne s'agite pas (consigne mot pour mot) : dans une rangée de six pictos en
 *     encre, une seule pastille cerclée d'orange se voit sans avoir à bouger.
 *     Une seule respiration de halo joue à l'arrivée, UNE fois, jamais en
 *     boucle — et pas du tout sous `prefers-reduced-motion` (compte.css).
 *   · connecté : une petite COCHE VERTE sur l'icône, et l'anneau s'en va.
 *     Les deux ne cohabitent jamais : l'anneau appelle, la coche confirme.
 *
 * Le clic mène à l'endroit qui a du sens dans chaque état : l'écran de
 * connexion quand il n'y a personne, « Mes créations » quand il y a quelqu'un —
 * puisque c'est là que vivent désormais les actions du compte.
 */
export function pastilleCompte(compte, { onOuvrirMesCreations } = {}) {
  const b = el('button', 'ce-icon-btn ce-comptebtn')
  b.type = 'button'
  b.innerHTML = ICON_COMPTE + ICON_COCHE

  const rendre = () => {
    const dedans = !!compte?.estConnecte?.()
    b.classList.toggle('dedans', dedans)
    b.classList.toggle('hors', !dedans)
    // ⚠️ LE LIBELLÉ ACCESSIBLE PORTE L'ÉTAT, PAS SEULEMENT LE NOM. Un anneau et
    // une coche sont deux informations purement visuelles : sans ces deux
    // phrases, un lecteur d'écran annonce le même « Mon compte » dans les deux
    // cas, et la seule chose que ce bouton avait à dire disparaît.
    const adresse = dedans ? compte?.adresse?.() : null
    b.setAttribute('aria-label', dedans ? `Mon compte — connecté${adresse ? ` avec ${adresse}` : ''}` : 'Mon compte — tu n’es pas connecté')
    b.setAttribute('data-tip', dedans
      ? 'Mon compte — tes créations, tes cartes publiées et leurs liens.'
      : 'Mon compte — connecte-toi pour retrouver tes créations d’une visite à l’autre.')
  }
  rendre()
  compte?.surChangement?.(rendre)

  b.addEventListener('click', () => {
    if (compte?.estConnecte?.()) { onOuvrirMesCreations?.(); return }
    ouvrirConnexion(compte, { onConnecte: () => onOuvrirMesCreations?.() })
  })
  return b
}

// ═══════════════════════════════════════════════════════ C. MES CRÉATIONS ═══
//
// Panneau du rail droit. Il s'appelait « Mes cartes » ; il s'appelle « Mes
// créations », parce qu'on n'y range pas que des cartes publiées.
//
// ⚠️ IL EXISTE DÉSORMAIS AUSSI QUAND PERSONNE N'EST CONNECTÉ, et c'est un
// renversement demandé mot pour mot : « si la personne n'est pas connectée,
// elle verra une info type "pour voir tes créations et tes cartes, connecte
// toi" + un lien pour se connecter directement ici ». Le panneau naissait
// `hidden` — l'intention était bonne (ne pas réclamer d'identité), le résultat
// l'était moins : rien, nulle part, ne disait qu'un compte servait à quelque
// chose. Une porte qu'on ne voit pas n'est pas une absence de mur, c'est une
// absence de porte.
//
// ⚠️ CE N'EST TOUJOURS PAS UN MUR. Le panneau INFORME et propose ; il ne
// bloque rien, ne s'ouvre jamais tout seul, et tout ShibuMap reste utilisable
// sans jamais le regarder.
//
// L'ÉTAT VIDE mérite autant de soin que les autres : c'est ce que TOUT LE
// MONDE voit le premier jour d'une session ouverte.
const ICON_CARTES =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20z"/><path d="M9 4v13.5M15 6.5V20"/></svg>'

const DATE_FR = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
const quand = (v) => {
  const d = new Date(v)
  return Number.isFinite(d.getTime()) ? DATE_FR.format(d) : ''
}

// ⚠️ « PAR LIEU » TRIAIT UNE CHAÎNE, ET DONC PAS DES LIEUX.
// `compte-app.js` fabrique le champ sous la forme « 45,92° N 6,87° E ».
// Comparé avec `localeCompare`, « 9,50° N » se range APRÈS « 45,92° N » —
// le tri paraissait juste tant que toutes les latitudes avaient deux chiffres,
// et se trompait dès la première à un chiffre. On lit donc les NOMBRES, avec
// leur hémisphère : sans le signe, une latitude sud se rangerait au milieu des
// latitudes nord de même valeur absolue.
const SIGNE = { N: 1, S: -1, E: 1, O: -1, W: -1 }
export function coordonneesDuLieu(lieu) {
  const trouve = [...String(lieu ?? '').matchAll(/(-?\d+(?:[.,]\d+)?)\s*°?\s*([NSEOW])?/gi)]
    .map(([, n, c]) => Number(n.replace(',', '.')) * (SIGNE[String(c || '').toUpperCase()] ?? 1))
    .filter(Number.isFinite)
  return { lat: trouve[0], lon: trouve[1] }
}
// Une carte sans coordonnées lisibles ne se glisse pas au milieu des autres :
// elle va en fin de liste, rangée entre semblables par son texte.
const parLieu = (a, b) => {
  const ca = coordonneesDuLieu(a?.lieu)
  const cb = coordonneesDuLieu(b?.lieu)
  const va = Number.isFinite(ca.lat)
  const vb = Number.isFinite(cb.lat)
  if (va !== vb) return va ? -1 : 1
  if (!va) return String(a?.lieu ?? '').localeCompare(String(b?.lieu ?? ''), 'fr')
  if (ca.lat !== cb.lat) return ca.lat - cb.lat
  return (Number.isFinite(ca.lon) ? ca.lon : 0) - (Number.isFinite(cb.lon) ? cb.lon : 0)
}

export function buildMesCartesPanel(ctx) {
  const compte = ctx.compte ?? compteInerte
  const panel = new Panel({
    title: 'Mes créations',
    icon: ICON_CARTES,
    side: 'right',
    width: 268,
    cls: 'ce-cartes-panel',
    tip: 'Tes créations et les cartes que tu as publiées, avec leur lien.',
  })

  // ⚠️ AU TÉLÉPHONE, CE PANNEAU CAMPAIT AU MILIEU DE LA CARTE.
  // La reprise du rail droit (compte.css) est juste sur grand écran — mais le
  // mode par défaut EST celui du téléphone : mesuré à 390 × 844, connecté, le
  // panneau déplié occupait 270 × 376 en (106, 120), soit 69 % de la largeur et
  // 30,8 % de la surface, planté sur la carte à CHAQUE chargement, sans que
  // personne l'ait demandé.
  // Sous 700 px il arrive donc REPLIÉ : sa pastille d'en-tête reste le chemin
  // vers ses cartes — on ne retire pas la fonction, on lui rend la carte.
  // ⚠️ ET LE GESTE EST RETENU, dans les deux sens. Le replier à chaque visite
  // était l'autre moitié du défaut : un réglage qu'il faut refaire à chaque
  // fois n'est pas un réglage.
  // ⚠️ SUR GRAND ÉCRAN, SANS PRÉFÉRENCE ENREGISTRÉE, RIEN NE CHANGE : le
  // panneau s'ouvre exactement comme avant.
  // ⚠️ DÉCONNECTÉ, PAS UNE CLÉ N'EST ÉCRITE : on ne fait que LIRE au montage, et
  // le panneau est `hidden` — il n'y a aucun clic à retenir.
  const CLE_REPLI = 'shibumap.cartes.replie'
  const repliVoulu = () => {
    try {
      const v = localStorage.getItem(CLE_REPLI)
      if (v === 'oui') return true
      if (v === 'non') return false
    } catch {}
    return !!window.matchMedia?.('(max-width: 699px)')?.matches
  }
  // On n'appelle setCollapsed QUE pour replier : `setCollapsed(false)` replie
  // les voisins du rail (accordéon exclusif), et déplié est déjà l'état par
  // défaut du panneau — l'appeler au montage changerait le rail des autres.
  if (repliVoulu()) panel.setCollapsed(true)
  const noterRepli = () => {
    try { localStorage.setItem(CLE_REPLI, panel.collapsed ? 'oui' : 'non') } catch {}
  }
  // Les deux gestes de repli : le chevron (qui arrête sa propagation vers
  // l'en-tête) et l'en-tête entier. Ces écouteurs sont posés APRÈS ceux du
  // constructeur, donc `panel.collapsed` porte déjà le nouvel état.
  panel.collapseBtn.addEventListener('click', noterRepli)
  panel.head.addEventListener('click', noterRepli)

  let tri = 'date'
  const barreTri = segmented({
    options: [
      { label: 'Par date', value: 'date' },
      { label: 'Par lieu', value: 'lieu' },
    ],
    get: () => tri,
    set: (v) => { tri = v; rendre() },
  })
  const liste = el('div', 'ce-cartes-liste')
  // « MON COMPTE » VIT ICI, EN PIED DE PANNEAU — il a quitté les Paramètres,
  // où le ranger obligeait à ouvrir une modale de réglages pour se déconnecter.
  // Il se rend lui-même et suit la session : déconnecté, il est vide, et
  // `:empty` le retire du flux.
  const pied = piedMonCompte(compte)
  panel.body.append(barreTri, liste, pied)

  let cartes = null // null = pas encore chargé ; [] = chargé et vide
  // ⚠️ LE TROISIÈME ÉTAT. « Chargé et vide » et « pas pu lire » ne sont pas la
  // même chose, et les confondre faisait dire à l'écran quelque chose de FAUX
  // sur les données de quelqu'un : un organisateur qui a douze courses en ligne
  // lisait « Tu n'as pas encore publié de carte » dès que `race?mine=1`
  // répondait 500, 401 sur session morte, 429, ou rien du tout hors ligne.
  let panne = false

  // Trois lignes grises À LA FORME DES VRAIES, pas une roue qui tourne : le
  // squelette dit déjà ce qui va arriver, le disque ne dit que « attends ».
  function squelette() {
    liste.replaceChildren(...[0, 1, 2].map(() => {
      const l = el('div', 'ce-cartes-ligne ce-cartes-fantome')
      l.append(el('span', 'ce-cartes-os ce-os-nom'), el('span', 'ce-cartes-os ce-os-meta'))
      return l
    }))
  }

  // ⚠️ L'ÉTAT DÉCONNECTÉ — CE QUE VOIT L'IMMENSE MAJORITÉ DES VISITEURS.
  // Une ligne qui dit à quoi sert un compte, un bouton qui y mène. Rien de
  // plus : ni argumentaire, ni liste de promesses, ni compte à rebours. On ne
  // vend pas une inscription au milieu d'une carte, on répond à la question
  // « pourquoi ce panneau est-il là ».
  // ⚠️ ET LE BOUTON OUVRE LA CONNEXION SUR PLACE — « un lien pour se connecter
  // directement ici ». Il n'envoie pas dans les Paramètres, il ne déroule pas
  // un sous-menu : il ouvre l'écran de connexion, point.
  function invite() {
    const bloc = el('div', 'ce-cartes-vide ce-cartes-invite')
    bloc.append(el('p', 'ce-cartes-invite-corps', 'Pour voir tes créations et tes cartes, connecte-toi.'))
    const b = button('Me connecter', () => ouvrirConnexion(compte))
    b.classList.add('ce-compte-primaire')
    bloc.append(b)
    liste.replaceChildren(bloc)
  }

  function vide() {
    const bloc = el('div', 'ce-cartes-vide')
    bloc.append(
      el('p', 'ce-cartes-vide-titre', 'Tu n’as pas encore publié de carte'),
      el('p', 'ce-cartes-vide-corps', 'Dès que tu publies une carte, elle apparaît ici — avec son lien, prête à partager.')
    )
    const b = button('Composer ma première carte', () => {
      // composer, c'est avoir la carte sous les yeux : le panneau s'efface
      panel.setCollapsed(true)
      ctx.composerPremiereCarte?.()
    })
    b.classList.add('ce-compte-primaire')
    bloc.append(b)
    liste.replaceChildren(bloc)
  }

  // ⚠️ ON RASSURE D'ABORD SUR CE QUI N'EST PAS PERDU — la règle qui a guidé
  // tous les autres refus de ce module. La première peur, devant un panneau qui
  // ne montre plus rien, c'est « mes cartes ont disparu ». Elles n'ont pas
  // bougé : c'est la LISTE qui n'a pas pu être lue. On le dit dans cet ordre,
  // puis on donne le geste — et pas « Composer ma première carte », qui était
  // la mauvaise action proposée à quelqu'un qui en a déjà douze.
  function pasPuLire() {
    const bloc = el('div', 'ce-cartes-vide ce-cartes-panne')
    bloc.append(
      el('p', 'ce-cartes-vide-titre', 'Tes cartes sont toujours là'),
      el('p', 'ce-cartes-vide-corps', 'C’est la liste qui n’a pas pu être lue — tes cartes publiées et leurs liens n’ont pas bougé. Réessaie dans un instant.')
    )
    const b = button('Réessayer', () => recharger())
    b.classList.add('ce-compte-primaire')
    bloc.append(b)
    liste.replaceChildren(bloc)
  }

  function ligne(c) {
    // la ligne ENTIÈRE est le lien : c'est ce qu'on vient y chercher, et un
    // `<a>` donne gratuitement le clic droit « copier l'adresse du lien », le
    // clic milieu, l'appui long — qu'un bouton ne donnerait pas
    const a = el('a', 'ce-cartes-ligne')
    a.href = c.url || '#'
    a.target = '_blank'
    a.rel = 'noopener'
    // ⚠️ LE NOM TRONQUÉ DOIT RESTER LISIBLE QUELQUE PART. Le panneau fait
    // 268 px : « Ultra Tour du Beaufortain, boucle intégrale des cinq cols »
    // demande 350 px pour 232 disponibles et s'arrête à « boucle in… ».
    // Sans `title`, personne ne peut lire le nom entier de SA PROPRE carte —
    // ni au survol, ni autrement.
    const nom = el('span', 'ce-cartes-nom', c.nom || 'Carte sans nom')
    nom.title = c.nom || 'Carte sans nom'
    a.append(nom)
    const meta = [c.lieu, quand(c.publieeLe)].filter(Boolean).join(' · ')
    if (meta) a.append(el('span', 'ce-cartes-meta', meta))
    if (c.url) a.append(el('span', 'ce-cartes-url', c.url.replace(/^https?:\/\//, '')))
    return a
  }

  function rendre() {
    const dedans = !!compte.estConnecte?.()
    // Trier zéro carte n'est pas un choix : la barre de tri ne s'affiche que
    // lorsqu'il y a réellement quelque chose à ranger. Un contrôle qui ne
    // change rien apprend à l'utilisateur que les contrôles ne changent rien.
    barreTri.style.display = dedans && cartes?.length > 1 ? '' : 'none'
    if (!dedans) return invite()
    if (panne) return pasPuLire()
    if (cartes === null) return squelette()
    if (!cartes.length) return vide()
    const rangees = [...cartes].sort(tri === 'lieu'
      ? parLieu
      // par date : la plus récente en tête, c'est celle qu'on vient de publier
      : (a, b) => new Date(b.publieeLe ?? 0) - new Date(a.publieeLe ?? 0))
    liste.replaceChildren(...rangees.map(ligne))
  }

  async function recharger() {
    cartes = null
    panne = false
    rendre()
    // ⚠️ LE `catch` SAIT QU'IL A ÉCHOUÉ — il ne jette plus l'information.
    // Il avalait l'échec dans `cartes = []`, et l'écran affirmait alors à un
    // organisateur qu'il n'avait aucune carte, lui proposait la mauvaise action
    // et ne lui laissait aucun moyen de réessayer sans recharger la page.
    try { cartes = (await compte.mesCartes()) ?? [] }
    catch { cartes = []; panne = true }
    rendre()
  }

  // présence : le panneau suit la session, sans que personne ait à le penser.
  // ⚠️ IL NE SE CACHE PLUS. Il change de contenu — l'invitation, ou les
  // cartes — mais il reste à sa place : c'est ce qui permet à quelqu'un de
  // découvrir qu'un compte existe sans qu'on le lui ait mis en travers.
  function majPresence() {
    const dedans = !!compte.estConnecte?.()
    if (dedans) recharger()
    else { cartes = null; panne = false; rendre() }
  }
  majPresence()
  compte.surChangement?.(majPresence)
  ctx.registerCartesRefresh?.(recharger)

  // LA PORTE DEPUIS LA BARRE DU HAUT. La pastille de compte amène ici, et
  // « amener » veut dire que le panneau est OUVERT à l'arrivée — au téléphone
  // comme sur grand écran il naît replié, et un clic qui ne déplierait rien
  // aurait l'air de n'avoir rien fait.
  // ⚠️ ET LE DÉPLIAGE EST NOTÉ, comme s'il venait du chevron : sans ça, le
  // panneau se refermerait à la visite suivante alors qu'on vient de demander à
  // le voir — c'est très exactement le défaut que `CLE_REPLI` a corrigé.
  const ouvrir = () => {
    panel.setCollapsed(false)
    noterRepli()
    panel.root.scrollIntoView?.({ block: 'nearest' })
  }

  return { panel, recharger, ouvrir }
}

// ═════════════════════════════════════════════════════════ D. MON COMPTE ═══
//
// ⚠️ IL A QUITTÉ LES PARAMÈTRES, ET C'EST LE POINT DE DÉPART DE TOUTE CETTE
// REPRISE. Une roue crantée abrite des réglages d'application — la performance,
// la fenêtre continue, l'aide. Une identité n'est pas un réglage, et l'y cacher
// obligeait à ouvrir une modale de réglages pour se déconnecter.
//
// Ses actions descendent donc AU BAS DU PANNEAU « MES CRÉATIONS » : là où l'on
// est déjà quand on pense à son compte, sous les cartes dont on vient de
// vérifier les liens. La pastille de la barre du haut y mène en un clic.
//
// ⚠️ ET IL N'A PLUS DE BRANCHE « DÉCONNECTÉ ». C'est le panneau entier qui la
// porte maintenant (`invite()`, plus haut) : deux boutons « Me connecter » à
// deux endroits d'un même panneau seraient une redite, pas une commodité.
export function piedMonCompte(compte) {
  const corps = el('div', 'ce-moncompte-corps ce-moncompte-pied')

  function rendre() {
    corps.replaceChildren()
    // Déconnecté, le pied n'a rien à dire : l'invitation du panneau tient déjà
    // ce discours, et `:empty` le retire du flux (compte.css) — pas de trait de
    // séparation flottant sous une invitation.
    if (!compte.estConnecte?.()) return
    const ident = el('p', 'ce-moncompte-ident')
    ident.append(document.createTextNode('Connecté avec '), el('b', null, compte.adresse() || ''))

    // ⚠️ DEUX BOUTONS QUI AVALAIENT TOUT — SUCCÈS COMME ÉCHEC.
    // « Exporter mes données » lançait la promesse sans l'attendre ni la
    // rattraper : succès et échec rendaient exactement le même écran (rien),
    // plus un rejet non géré dans la console. « Me déconnecter » attendait sans
    // rattraper : une déconnexion en panne laissait l'écran affirmer qu'on est
    // connecté, sans un mot. Les deux disent maintenant ce qui se passe pendant
    // (le libellé, comme partout ailleurs dans ce fichier), puis ce qui s'est
    // passé — un refus dans la même grammaire que les autres écrans.
    const ecart = el('p', 'ce-compte-err')
    ecart.setAttribute('role', 'alert')
    const dit = el('p', 'ce-compte-info')
    dit.setAttribute('role', 'status')

    const sortir = button('Me déconnecter', async () => {
      ecart.textContent = ''
      dit.textContent = ''
      sortir.disabled = true
      sortir.textContent = 'Déconnexion…'
      try {
        await compte.deconnecter()
        rendre() // l'écran entier est refait : rien à remettre en état ici
      } catch (e) {
        ecart.textContent = messageRefus(e)
        sortir.disabled = false
        sortir.textContent = 'Me déconnecter'
      }
    })
    const exporter = button('Exporter mes données', async () => {
      ecart.textContent = ''
      dit.textContent = ''
      exporter.disabled = true
      exporter.textContent = 'Préparation…'
      try {
        await compte.exporterMesDonnees()
        dit.textContent = 'Ton fichier est parti.'
      } catch (e) {
        ecart.textContent = messageRefus(e)
      }
      exporter.disabled = false
      exporter.textContent = 'Exporter mes données'
    })
    const actions = el('div', 'ce-moncompte-actions')
    actions.append(sortir, exporter)
    // La suppression vit à distance des deux autres : elle est définitive, et
    // un destructif rangé au milieu des gestes courants finit par se cliquer.
    const suppr = el('button', 'ce-moncompte-suppr', 'Supprimer mon compte')
    suppr.type = 'button'
    suppr.addEventListener('click', () => confirmerSuppression(compte, { onFait: rendre }))
    corps.append(el('p', 'ce-moncompte-titre', 'Mon compte'), ident, actions, ecart, dit, suppr)
  }
  rendre()
  compte.surChangement?.(rendre)
  return corps
}

// ───────────────────────────────────────────────── la suppression, confirmée
// ⚠️ ON DIT CE QUI NE DISPARAÎT PAS. Un organisateur qui a diffusé un lien à
// trois cents coureurs doit savoir que sa suppression ne casse pas leur lien —
// sinon il n'ose pas, et il écrit à Adrien.
//
// ⚠️ LES BOUTONS PORTENT L'ACTION, pas « OK » et « Annuler ». On doit pouvoir
// lire les deux et savoir lequel fait quoi sans relire la question.
export function confirmerSuppression(compte, { onFait } = {}) {
  const m = modale('ce-suppr')
  m.carte.append(
    m.titre('Tu veux supprimer ton compte ?'),
    // ⚠️ CE TEXTE A MENTI, ET C'EST CORRIGÉ. Il annonçait la disparition des
    // « gabarits enregistrés » — or ils vivent dans le stockage local de CETTE
    // machine, sans aucun lien avec le compte, et on a délibérément choisi de
    // ne pas les détruire : effacer sans retour la bibliothèque de quelqu'un
    // parce qu'il ferme un compte en ligne serait pire que la promesse tenue.
    // Le texte dit donc maintenant ce que le code fait — dans les deux sens.
    el('p', 'ce-compte-corps', 'Tes cartes déjà publiées resteront en ligne — leurs liens continuent de fonctionner pour ceux qui les ont. Tes gabarits, eux, sont enregistrés sur cet ordinateur et y restent. Ce qui disparaît, c’est ton compte et le lien entre tes cartes et toi. C’est définitif.')
  )
  const err = el('p', 'ce-compte-err')
  err.setAttribute('role', 'alert')
  const garder = button('Garder mon compte', () => m.close())
  const supprimer = button('Supprimer mon compte', async () => {
    err.textContent = ''
    supprimer.disabled = true
    supprimer.textContent = 'Suppression…'
    try { await compte.supprimerMonCompte(); m.close(); onFait?.() }
    catch (e) {
      err.textContent = messageRefus(e)
      supprimer.disabled = false
      supprimer.textContent = 'Supprimer mon compte'
    }
  })
  supprimer.classList.add('ce-moncompte-suppr-go')
  const actions = el('div', 'ce-compte-actions ce-suppr-actions')
  actions.append(garder, supprimer)
  m.carte.append(err, actions)
  // le focus se pose sur CELUI QUI NE DÉTRUIT RIEN : une touche Entrée réflexe
  // sur un écran qu'on n'a pas fini de lire ne doit rien effacer
  garder.focus()
  return m
}

