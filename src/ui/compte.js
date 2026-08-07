// ═══════════════════════════════════════════════════════════════════════════
// L'INTERFACE DU COMPTE — la porte, la connexion, mes cartes, mon compte
// ═══════════════════════════════════════════════════════════════════════════
//
// Quatre écrans, une seule règle au-dessus de toutes les autres :
// **ShibuMap reste entièrement utilisable sans compte.** `race.mjs` l'écrit en
// tête de fichier (« public and unauthenticated by design ») et le plan le
// répète : jamais de mur, jamais de porte fermée. Concrètement, ici :
//   · la porte à l'export propose DEUX sorties de même poids, et celle qui
//     passe outre marche complètement ;
//   · le panneau « Mes cartes » n'existe pas pour un visiteur déconnecté — il
//     naît à la connexion et disparaît à la déconnexion, plutôt que de rester
//     là en réclamant une identité ;
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
//                              | 'code-expire' | 'trop-essais' | 'injoignable' }
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
import { el, button, section, segmented } from './kit.js'
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
  'code-expire': 'Ce code a expiré. Demande-en un nouveau, il arrive tout de suite.',
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
    window.removeEventListener('keydown', onKey, true)
    veil.remove()
    // rendre le focus est un geste d'accessibilité, pas une politesse : sans
    // lui, la tabulation repart du haut du document à chaque fermeture
    if (rendu?.isConnected) rendu.focus?.()
    onClose?.()
  }
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
  // aussi, et fermeraient autre chose derrière la modale
  window.addEventListener('keydown', onKey, true)
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
  const enregistrer = button('Enregistrer mon gabarit', () => {
    onEnregistrerGabarit?.()
    // le libellé change APRÈS le clic, comme la carte de livraison : la carte
    // reste, pour un second enregistrement
    enregistrer.textContent = 'Enregistrer à nouveau'
  })
  enregistrer.classList.add('ce-compte-avis-btn')
  const fermer = el('button', 'ce-compte-avis-x', 'Fermer')
  fermer.type = 'button'
  fermer.addEventListener('click', () => carte.remove())
  carte.append(enregistrer, fermer)
  document.body.append(carte)
  requestAnimationFrame(() => carte.classList.add('show'))
  return carte
}

// ═══════════════════════════════════════════════════════ B. LA CONNEXION ═══
//
// Deux étapes, deux écrans, DANS LA MÊME CARTE. Jamais les deux champs
// ensemble : personne n'a le code avant de l'avoir demandé, et un champ vide
// qu'on ne peut pas remplir est une impasse affichée.
export function ouvrirConnexion(compte, { onConnecte, onAbandon } = {}) {
  let abouti = false
  const m = modale('ce-cnx', { onClose: () => { if (!abouti) onAbandon?.() } })
  let adresse = ''

  // ---- étape 1 : l'adresse ------------------------------------------------
  function etapeAdresse() {
    m.carte.replaceChildren(
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
      try {
        await compte.demanderCode(adresse)
        etapeCode()
      } catch (e) {
        err.textContent = messageRefus(e)
        envoyer.disabled = false
        envoyer.textContent = 'Envoyer le code'
        inp.focus()
      }
    }
    inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') partir() })
    const actions = el('div', 'ce-compte-actions')
    actions.append(envoyer)
    m.carte.append(champ, err, actions)
    inp.focus()
  }

  // ---- étape 2 : le code --------------------------------------------------
  function etapeCode() {
    m.carte.replaceChildren(m.titre('Ton code est parti'))
    // l'adresse en gras DANS la phrase : c'est la seule information que
    // l'utilisateur doit pouvoir vérifier d'un coup d'œil avant d'aller
    // chercher son message
    const corps = el('p', 'ce-compte-corps')
    corps.append(document.createTextNode('On l’a envoyé à '), el('b', null, adresse), document.createTextNode('. Il arrive en quelques secondes et reste valable un quart d’heure.'))
    m.carte.append(corps)

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
    const valider = button('Me connecter', () => verifier())
    valider.classList.add('ce-compte-primaire')

    async function verifier() {
      const code = inp.value.trim()
      err.textContent = ''
      valider.disabled = true
      valider.textContent = 'Connexion…'
      try {
        await compte.verifierCode(adresse, code)
        abouti = true
        m.close()
        onConnecte?.()
      } catch (e) {
        err.textContent = messageRefus(e)
        valider.disabled = false
        valider.textContent = 'Me connecter'
        inp.select()
      }
    }
    // on ne garde que des chiffres : coller « 123 456 » depuis un message est
    // le geste le plus courant, et il ne doit pas échouer sur une espace
    inp.addEventListener('input', () => { inp.value = inp.value.replace(/\D+/g, '').slice(0, 6) })
    inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') verifier() })

    const liens = el('div', 'ce-compte-liens')
    const renvoyer = el('button', 'ce-compte-lien', 'Renvoyer un code')
    renvoyer.type = 'button'
    renvoyer.addEventListener('click', async () => {
      err.textContent = ''
      renvoyer.disabled = true
      try { await compte.demanderCode(adresse); inp.value = ''; inp.focus() }
      catch (e) { err.textContent = messageRefus(e) }
      renvoyer.disabled = false
    })
    const changer = el('button', 'ce-compte-lien', 'Changer d’adresse')
    changer.type = 'button'
    changer.addEventListener('click', () => etapeAdresse())
    liens.append(renvoyer, changer)

    const actions = el('div', 'ce-compte-actions')
    actions.append(valider)
    m.carte.append(champ, err, actions, liens)
    inp.focus()
  }

  etapeAdresse()
  return m
}

// ═════════════════════════════════════════════════════════ C. MES CARTES ═══
//
// Panneau du rail droit. Il N'EXISTE PAS pour un visiteur déconnecté : il naît
// à la connexion, disparaît à la déconnexion. Un panneau vide qui réclame une
// identité serait le mur qu'on a promis de ne jamais construire.
//
// L'ÉTAT VIDE mérite autant de soin que les autres : c'est ce que TOUT LE
// MONDE voit le premier jour.
const ICON_CARTES =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20z"/><path d="M9 4v13.5M15 6.5V20"/></svg>'

const DATE_FR = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
const quand = (v) => {
  const d = new Date(v)
  return Number.isFinite(d.getTime()) ? DATE_FR.format(d) : ''
}

export function buildMesCartesPanel(ctx) {
  const compte = ctx.compte ?? compteInerte
  const panel = new Panel({
    title: 'Mes cartes',
    icon: ICON_CARTES,
    side: 'right',
    width: 268,
    cls: 'ce-cartes-panel',
    tip: 'Les cartes que tu as publiées, avec leur lien.',
  })

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
  panel.body.append(barreTri, liste)

  let cartes = null // null = pas encore chargé ; [] = chargé et vide

  // Trois lignes grises À LA FORME DES VRAIES, pas une roue qui tourne : le
  // squelette dit déjà ce qui va arriver, le disque ne dit que « attends ».
  function squelette() {
    liste.replaceChildren(...[0, 1, 2].map(() => {
      const l = el('div', 'ce-cartes-ligne ce-cartes-fantome')
      l.append(el('span', 'ce-cartes-os ce-os-nom'), el('span', 'ce-cartes-os ce-os-meta'))
      return l
    }))
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

  function ligne(c) {
    // la ligne ENTIÈRE est le lien : c'est ce qu'on vient y chercher, et un
    // `<a>` donne gratuitement le clic droit « copier l'adresse du lien », le
    // clic milieu, l'appui long — qu'un bouton ne donnerait pas
    const a = el('a', 'ce-cartes-ligne')
    a.href = c.url || '#'
    a.target = '_blank'
    a.rel = 'noopener'
    a.append(el('span', 'ce-cartes-nom', c.nom || 'Carte sans nom'))
    const meta = [c.lieu, quand(c.publieeLe)].filter(Boolean).join(' · ')
    if (meta) a.append(el('span', 'ce-cartes-meta', meta))
    if (c.url) a.append(el('span', 'ce-cartes-url', c.url.replace(/^https?:\/\//, '')))
    return a
  }

  function rendre() {
    // Trier zéro carte n'est pas un choix : la barre de tri ne s'affiche que
    // lorsqu'il y a réellement quelque chose à ranger. Un contrôle qui ne
    // change rien apprend à l'utilisateur que les contrôles ne changent rien.
    barreTri.style.display = cartes?.length > 1 ? '' : 'none'
    if (cartes === null) return squelette()
    if (!cartes.length) return vide()
    const rangees = [...cartes].sort(tri === 'lieu'
      ? (a, b) => String(a.lieu ?? '').localeCompare(String(b.lieu ?? ''), 'fr')
      // par date : la plus récente en tête, c'est celle qu'on vient de publier
      : (a, b) => new Date(b.publieeLe ?? 0) - new Date(a.publieeLe ?? 0))
    liste.replaceChildren(...rangees.map(ligne))
  }

  async function recharger() {
    cartes = null
    rendre()
    try { cartes = (await compte.mesCartes()) ?? [] }
    catch { cartes = [] } // une liste injoignable se lit comme une liste vide :
    // l'état vide dit quoi faire, un message d'erreur dans un panneau ne dirait
    // rien de plus et laisserait le squelette tourner à vide
    rendre()
  }

  // présence : le panneau suit la session, sans que personne ait à le penser
  function majPresence() {
    const dedans = !!compte.estConnecte?.()
    panel.root.hidden = !dedans
    if (dedans) recharger()
    else { cartes = null; liste.replaceChildren() }
  }
  majPresence()
  compte.surChangement?.(majPresence)
  ctx.registerCartesRefresh?.(recharger)

  return { panel, recharger }
}

// ═════════════════════════════════════════════════════════ D. MON COMPTE ═══
//
// Une section de plus dans la modale des Paramètres, qui existe déjà. La barre
// du haut n'est pas touchée : sept emplacements y sont déjà denses.
export function sectionMonCompte(ctx) {
  const compte = ctx.compte ?? compteInerte
  const s = section('Mon compte')
  s.root.classList.add('ce-moncompte')
  const corps = el('div', 'ce-moncompte-corps')
  s.body.append(corps)

  function rendre() {
    corps.replaceChildren()
    if (!compte.estConnecte?.()) {
      // Déconnecté : une porte, pas un discours. Le bouton dit exactement ce
      // qui va se passer, et rien d'autre n'est promis.
      const b = button('Me connecter', () => ouvrirConnexion(compte, { onConnecte: rendre }))
      b.classList.add('ce-compte-primaire')
      corps.append(b)
      return
    }
    const ident = el('p', 'ce-moncompte-ident')
    ident.append(document.createTextNode('Connecté avec '), el('b', null, compte.adresse() || ''))
    corps.append(ident)

    const actions = el('div', 'ce-moncompte-actions')
    actions.append(
      button('Me déconnecter', async () => { await compte.deconnecter(); rendre() }),
      button('Exporter mes données', () => { compte.exporterMesDonnees?.() })
    )
    // La suppression vit à distance des deux autres : elle est définitive, et
    // un destructif rangé au milieu des gestes courants finit par se cliquer.
    const suppr = el('button', 'ce-moncompte-suppr', 'Supprimer mon compte')
    suppr.type = 'button'
    suppr.addEventListener('click', () => confirmerSuppression(compte, { onFait: rendre }))
    corps.append(actions, suppr)
  }
  rendre()
  compte.surChangement?.(rendre)
  return s
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

