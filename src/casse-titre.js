// Remet en casse de nom propre un titre de course saisi tout en capitales.
// Le studio n'a jamais contraint la casse à la saisie, et beaucoup
// d'organisateurs tapent au clavier verrouillé majuscules — la barre de
// course affichait alors « GRAND RAID REUNION 2025 » criée d'un bout à
// l'autre, plus difficile à lire qu'un titre composé.
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
// ressortait taché de majuscules (« du MONT-BLANC »). L'APOSTROPHE EST LE
// MÊME PIÈGE : un titre comme « L'ULTRA-TRAIL » a un segment de tête,
// « L'ULTRA », que le même filtre lettres-seules ne reconnaissait pas non
// plus — « L'Échappée Belle », « L'Ultra-Trail » sont des noms de course
// plausibles. Trait d'union ET apostrophe sont désormais des séparateurs de
// plus, au même titre que l'espace : chaque segment qu'ils isolent suit
// indépendamment la même règle que n'importe quel autre mot.
// Trois catégories pour les segments qui, eux, SONT entièrement en capitales :
//   1. LES UNITÉS DE MESURE (km…) : minuscules, TOUJOURS — jamais de
//      majuscule, quelle que soit leur position dans le titre. Une unité ne
//      nomme rien, et ce n'est pas une question de rôle grammatical comme les
//      mots mineurs ci-dessous : « km » en tête de titre resterait « km ».
//   2. LES MOTS MINEURS (prépositions, articles — et « d »/« l » une fois
//      l'apostrophe de l'élision isolée comme séparateur, voir plus bas) :
//      minuscules, SAUF si le segment est le TOUT PREMIER mot du titre — un
//      titre s'ouvre sur une majuscule, par convention typographique, quel
//      que soit le rôle grammatical de son premier mot.
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
// ⚠️ « d » ET « l », PAS « d' » ET « l' » — la scission sur l'apostrophe,
// juste en dessous, isole l'apostrophe comme séparateur : un segment ne
// contient donc plus jamais le caractère « ' ». Les entrées « d' »/« l' »
// d'une première version étaient du code mort qui avait l'air vivant —
// aucun segment ne pouvait plus jamais les matcher.
const MOTS_MINEURS = new Set([
  'de', 'du', 'des', 'la', 'le', 'les', 'et', 'en', 'à', 'sur', 'd', 'l',
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
  // au-delà de quatre lettres un mot français a presque toujours de quoi se
  // prononcer : le seuil ne sert qu'à départager les mots courts
  if (motMaj.length > 4) return false
  return pireSuiteDeConsonnes(motMaj) >= 3
}

// pas de chiffres dans la classe, et ni le trait d'union ni l'apostrophe non
// plus : les trois sont des séparateurs traités À CÔTÉ (chiffres → jamais
// transformé, trait d'union/apostrophe → découpe en segments), jamais À
// L'INTÉRIEUR d'un segment jugé « entièrement en capitales »
const SEUL_MAJUSCULES = /^[A-ZÀ-Ý]+$/
// l'apostrophe DROITE (l'élision saisie au clavier) et la COURBE (celle
// qu'un correcteur de saisie substitue) : les deux marquent la même élision,
// un titre saisi sur des claviers différents peut porter l'une ou l'autre
const SEPARATEURS = /([-'’])/

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
    if (!SEUL_MAJUSCULES.test(seg)) return seg // pas entièrement en capitales : intact (déjà composé, nombre, ponctuation)
    const enTete = !dejaVuUnMot
    dejaVuUnMot = true
    const minuscule = seg.toLowerCase()
    if (UNITES.has(minuscule)) return minuscule // jamais de majuscule, même en tête : voir la note de UNITES
    if (MOTS_MINEURS.has(minuscule)) return enTete ? casseNom(seg) : minuscule
    if (estUnSigle(seg)) return seg // sigle : capitales intactes, où qu'il soit dans le titre
    return casseNom(seg)
  }

  return titre
    .split(/(\s+)/) // les espaces sont capturés, pas seulement lus : recomposer À L'IDENTIQUE
    .map((jeton) => jeton
      // trait d'union ET apostrophe dans LA MÊME scission : « L'ULTRA-TRAIL »
      // a besoin des deux à la fois (L' puis Ultra puis -Trail), et deux
      // scissions successives (d'abord l'une, puis l'autre sur chaque
      // morceau) referaient courir le même risque d'oubli qui a produit ce
      // bug — un seul passage, aucun caractère de jonction ne peut y échapper
      .split(SEPARATEURS)
      .map((s) => (SEPARATEURS.test(s) ? s : casserSegment(s)))
      .join(''))
    .join('')
}
