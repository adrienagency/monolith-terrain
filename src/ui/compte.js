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
import { el, button } from './kit.js'

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

