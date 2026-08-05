// Remet en casse de nom propre un titre de course saisi tout en capitales.
// Le studio n'a jamais contraint la casse à la saisie, et beaucoup
// d'organisateurs tapent au clavier verrouillé majuscules — la barre de
// course affichait alors « GRAND RAID REUNION 2025 » criée d'un bout à
// l'autre, plus difficile à lire qu'un titre composé.
//
// ⚠️ CE MODULE EST UN COMPROMIS RAISONNABLE, PAS UNE VÉRITÉ LINGUISTIQUE.
// Quatre tours de relecture ont chacun trouvé un titre réel qui mettait la
// règle en défaut (un mot composé, une élision, un toponyme, une
// incohérence entre deux listes) — et rien ne dit qu'un cinquième
// n'existe pas. La fonction n'a et n'aura JAMAIS de dictionnaire de noms
// propres ou communs : elle raisonne sur la FORME du mot (longueur,
// voyelles, apostrophe, position), jamais sur son SENS. C'est délibéré —
// un dictionnaire fermé serait toujours incomplet face à des milliers de
// noms de course inventés — mais ça veut dire qu'elle peut se tromper sur
// un titre qu'aucun des cas ci-dessous n'anticipe. En cas de doute,
// l'affichage reste réversible : c'est un rendu, jamais la donnée source
// (voir la note FONCTION PURE plus bas).
//
// ⚠️ FONCTION PURE, ET C'EST LA RÈGLE DE FOND. Elle prend une chaîne, en rend
// une autre : c'est course-bar.js qui décide de n'en faire usage qu'à
// L'AFFICHAGE (titleEl.textContent), jamais sur raceState.name ni sur quoi
// que ce soit qui reparte vers le serveur. Le nom saisi par l'organisateur
// reste le sien ; on ne réécrit pas ce que quelqu'un a tapé.
//
// La décision se prend SEGMENT PAR SEGMENT, jamais sur le titre entier —
// c'est ce qui protège un titre déjà bien composé (« Marathon du
// Mont-Blanc ») : un segment qui n'est pas intégralement en capitales n'est
// simplement pas regardé. ⚠️ ET UN SEGMENT N'EST PAS UN MOT ENTOURÉ
// D'ESPACES : un mot à trait d'union (« MONT-BLANC », « ULTRA-TRAIL ») s'est
// fait passer pour « déjà composé » par une première version qui ne
// découpait que sur l'espace — son filtre « entièrement en capitales »
// (lettres seules) ne matchait jamais un jeton contenant un « - », donc il
// ressortait taché de majuscules (« du MONT-BLANC »). Le trait d'union est
// désormais un séparateur de plus, au même titre que l'espace.
// ⚠️ MAIS L'APOSTROPHE N'EST PAS UN SÉPARATEUR UNIVERSEL COMME LE TRAIT
// D'UNION — une première correction l'avait traitée comme telle, et
// « AUJOURD'HUI », « QUELQU'UN », « PRESQU'ÎLE » (des mots réels, plausibles
// dans un nom de course) en ressortaient mal composés (« Aujourd'Hui », un H
// majuscule fautif) : PIRE que le bug d'origine, parce que SILENCIEUX — le
// mot n'a plus l'air suspect, il est juste faux. La règle : on ne recommence
// un mot après l'apostrophe QUE si ce qui précède se réduit à UNE SEULE
// LETTRE — la définition même de l'élision (l', d', j', n', s', c', m', t').
// Au-delà d'une lettre, l'apostrophe est INTERNE au mot et celui-ci se
// compose comme un bloc, voir composerAvecElisions() plus bas.
// Trois catégories pour les segments qui, eux, SONT entièrement en capitales :
//   1. LES UNITÉS DE MESURE (km…) : minuscules, TOUJOURS — jamais de
//      majuscule, quelle que soit leur position dans le titre. Une unité ne
//      nomme rien, et ce n'est pas une question de rôle grammatical comme les
//      mots mineurs ci-dessous : « km » en tête de titre resterait « km ».
//   2. LES MOTS MINEURS (prépositions, articles — et les HUIT LETTRES
//      D'ÉLISION une fois l'apostrophe isolée comme séparateur, voir plus
//      bas) : minuscules, SAUF si le segment est le TOUT PREMIER mot du
//      titre — un titre s'ouvre sur une majuscule, par convention
//      typographique, quel que soit le rôle grammatical de son premier mot.
//      ⚠️ SEUL LE PREMIER, PAS LE DERNIER : forcer aussi la capitale sur le
//      dernier mot est la convention du title case anglophone, pas de la
//      composition française — et elle avait fait capitaliser une unité de
//      mesure en fin de titre (« 100 Km »), qui n'est jamais correct.
//   3. LES SIGLES COURTS (UTMB…) : capitales intactes. Un sigle ne se
//      prononce pas comme un mot — c'est ce qu'approche la plus longue suite
//      de consonnes consécutives : « UTMB » s'épelle (T-M-B, trois d'affilée,
//      injouable en français), « MONT » ou « RAID » se lisent (au plus deux).
//      Le seuil ne s'applique qu'aux mots courts : au-delà de quatre lettres,
//      un mot français a presque toujours de quoi se prononcer.
//   4. LE RESTE (noms propres et communs du titre) : casse de nom, une
//      capitale et le reste en minuscules.

// une unité ne nomme rien, dans un titre ou ailleurs — contrairement à un
// mot mineur (article, préposition), sa minuscule ne dépend d'AUCUNE
// position : même en tête de titre, « km » resterait « km ».
const UNITES = new Set(['km'])

// ⚠️ « bout » N'EST PLUS ICI — retiré en relecture. Il l'avait rejoint pour
// faire passer « de bout en bout » (minuscule aux deux occurrences), mais ce
// cas de test a lui-même été abandonné : les deux exigences du plan qui le
// justifiaient (jamais forcer le DERNIER mot, ET bout toujours minuscule)
// étaient incompatibles dès qu'un titre plaçait bout ailleurs qu'en fin —
// et le garder en mot mineur avait un coût réel sur un titre comme
// « Trail du Bout du Monde » (bout en minuscule à côté de Monde en
// capitale, sur un toponyme : incohérent à l'œil).
//
// ⚠️ LES HUIT LETTRES, SANS APOSTROPHE — « d », pas « d' ». La scission de
// composerAvecElisions() isole l'apostrophe comme séparateur : un segment ne
// contient donc plus jamais le caractère « ' ». (Une première version avait
// « d' »/« l' » avec l'apostrophe : du code mort qui avait l'air vivant,
// aucun segment ne pouvait plus jamais les matcher une fois la scission
// écrite.)
// ⚠️ ET LES HUIT, PAS DEUX. Le commentaire de composerAvecElisions() décrit
// l'élision comme huit lettres (l d j n s c m t) et la scission les traite
// bien génériquement — mais cette liste n'en contenait que deux (d, l) :
// une incohérence entre le code et son propre commentaire, trouvée en
// relecture. Une élision d'une autre lettre que d'/l', placée APRÈS le
// premier mot du titre (« la course qui n'attend personne »), gardait donc
// à tort sa majuscule (« N'Attend » au lieu de « n'Attend » — c'est le
// PRÉFIXE d'élision qui doit perdre sa capitale hors tête de titre, pas le
// mot qu'il introduit, qui reste un mot comme un autre). Les huit :
// l' (le, la), d' (de), j' (je), n' (ne), s' (se, si), c' (ce), m' (me),
// t' (te) — les seules élisions à une lettre du français courant.
const MOTS_MINEURS = new Set([
  'de', 'du', 'des', 'la', 'le', 'les', 'et', 'en', 'à', 'sur',
  'l', 'd', 'j', 'n', 's', 'c', 'm', 't',
])

// ⚠️ LA SUITE DE CONSONNES, PAS LE COMPTE DE VOYELLES. Un compte de voyelles
// avait été essayé d'abord (moins de deux voyelles sur un mot de 4 lettres ou
// moins ⇒ sigle) et il flanchait sur « MONT » (dans « MONT-BLANC ») : une
// seule voyelle sur quatre lettres, exactement comme « UTMB », mais un mot
// français ordinaire. Ce qui les sépare vraiment : « UTMB » aligne trois
// consonnes d'affilée (T-M-B), injouable à l'oral en français ; « MONT » n'en
// aligne jamais plus de deux (N-T). Trois consonnes consécutives ou plus,
// c'est le seuil qui ne se prononce (quasiment) jamais sans voyelle entre
// elles.
const VOYELLE = /[AEIOUYÀÂÄÉÈÊËÏÎÔÖÙÛÜ]/
// une apostrophe INTERNE (aujourd'hui, presqu'île) n'est ni une voyelle ni
// une consonne : la retirer avant de compter, sinon elle gonflerait à tort
// une suite de consonnes ou le nombre de lettres du seuil « sigle »
const soloLettres = (s) => s.replace(/['’]/g, '')
function pireSuiteDeConsonnes(motMaj) {
  let max = 0
  let courant = 0
  for (const lettre of motMaj) {
    if (VOYELLE.test(lettre)) courant = 0
    else { courant += 1; if (courant > max) max = courant }
  }
  return max
}
function estUnSigle(motMaj) {
  const lettres = soloLettres(motMaj)
  // au-delà de quatre lettres un mot français a presque toujours de quoi se
  // prononcer : le seuil ne sert qu'à départager les mots courts
  if (lettres.length > 4) return false
  return pireSuiteDeConsonnes(lettres) >= 3
}

// pas de chiffres dans la classe, et pas de trait d'union non plus : les
// deux sont des séparateurs traités À CÔTÉ (chiffres → jamais transformé,
// trait d'union → découpe en segments), jamais À L'INTÉRIEUR d'un segment
// jugé « entièrement en capitales ». L'apostrophe, elle, est TOLÉRÉE ici —
// composerAvecElisions() décide plus bas si elle scinde ou reste interne,
// mais dans les deux cas le morceau qui atteint ce filtre peut en porter
// une (« AUJOURD'HUI » entier, ou « L » puis « ULTRA » séparément) : la
// tester sur les lettres seules, apostrophe retirée, couvre les deux.
const SEUL_MAJUSCULES = /^[A-ZÀ-Ý]+$/
const estEntierementEnCapitales = (s) => SEUL_MAJUSCULES.test(soloLettres(s))

const casseNom = (mot) => mot.charAt(0) + mot.slice(1).toLowerCase()

export function casseDeNom(titre) {
  if (!titre) return ''
  // ⚠️ UN SEUL DRAPEAU POUR TOUT LE TITRE, PAS UN INDEX DE JETON. Repérer
  // « le premier mot » par position de jeton se cassait dès qu'un mot à trait
  // d'union OU à élision ouvrait le titre (son premier SEGMENT, pas le jeton
  // entier, doit porter la bordure) — un drapeau qui se ferme au premier
  // segment alphabétique rencontré, quel que soit le découpage qui l'a
  // produit, n'a pas ce problème.
  let dejaVuUnMot = false

  const casserSegment = (seg) => {
    if (!estEntierementEnCapitales(seg)) return seg // pas entièrement en capitales : intact (déjà composé, nombre, ponctuation)
    const enTete = !dejaVuUnMot
    dejaVuUnMot = true
    const minuscule = seg.toLowerCase()
    if (UNITES.has(minuscule)) return minuscule // jamais de majuscule, même en tête : voir la note de UNITES
    if (MOTS_MINEURS.has(minuscule)) return enTete ? casseNom(seg) : minuscule
    if (estUnSigle(seg)) return seg // sigle : capitales intactes, où qu'il soit dans le titre
    return casseNom(seg)
  }

  // ⚠️ L'APOSTROPHE NE SCINDE QUE SI CE QUI LA PRÉCÈDE FAIT UNE SEULE
  // LETTRE — la définition même de l'élision. « L'ULTRA » (préfixe « L »,
  // une lettre) devient deux mots, « L » puis « ULTRA », composés
  // indépendamment ; « AUJOURD'HUI » (préfixe « AUJOURD », sept lettres)
  // reste UN SEUL mot, dont seule la première lettre se capitalise —
  // casserSegment() gère déjà ce cas tout seul puisqu'il tolère
  // l'apostrophe interne (voir estEntierementEnCapitales). Récursif sur le
  // reste : une élision chaînée (rarissime en français, mais rien ne
  // l'interdit) se scinderait aussi loin qu'il le faut.
  const composerAvecElisions = (segment) => {
    const i = segment.search(/['’]/)
    if (i === 1) return casserSegment(segment.slice(0, 1)) + segment[1] + composerAvecElisions(segment.slice(2))
    return casserSegment(segment)
  }

  return titre
    .split(/(\s+)/) // les espaces sont capturés, pas seulement lus : recomposer À L'IDENTIQUE
    .map((jeton) => jeton
      .split(/(-)/) // le trait d'union aussi : « MONT-BLANC » se compose Mont puis Blanc, pas comme un seul bloc
      .map((s) => (s === '-' ? s : composerAvecElisions(s)))
      .join(''))
    .join('')
}
