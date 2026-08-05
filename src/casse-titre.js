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
// La décision se prend MOT PAR MOT, jamais sur le titre entier — c'est ce qui
// protège un titre déjà bien composé (« Marathon du Mont-Blanc ») : un mot
// qui n'est pas intégralement en capitales n'est simplement pas regardé.
// Trois catégories pour les mots qui, eux, LE SONT :
//   1. LES MOTS MINEURS (prépositions, articles, quelques mots de liaison
//      courts) : minuscules, SAUF aux deux bornes du titre — le premier mot
//      ET le dernier restent capitalisés, la convention typographique d'un
//      titre qui s'ouvre et se referme sur une majuscule.
//   2. LES SIGLES COURTS (UTMB, GR…) : capitales intactes. Un sigle ne se
//      prononce pas comme un mot — c'est ce qu'approche la densité de
//      voyelles : « RAID » et « FOUS » se lisent (deux voyelles chacun),
//      « UTMB » s'épelle (une seule) — le seuil ne s'applique qu'aux mots
//      courts, au-delà de quatre lettres un mot français a presque toujours
//      de quoi se prononcer.
//   3. LE RESTE (noms propres et communs du titre) : casse de nom, une
//      capitale et le reste en minuscules.

// ⚠️ « bout » ET « km » NE SONT PAS DES PRÉPOSITIONS, mais ils jouent le même
// rôle dans un titre : dans « de bout en bout » ou « 100 km de Millau », ils
// ne nomment rien — contrairement à un lieu ou à un événement, rien ne serait
// perdu à les lire en minuscules. Ils rejoignent donc la liste plutôt que
// d'exiger une seconde catégorie pour un seul rôle.
const MOTS_MINEURS = new Set([
  'de', 'du', 'des', 'la', 'le', 'les', 'et', 'en', 'à', 'sur', "d'", "l'",
  'bout', 'km',
])

const VOYELLES = /[AEIOUYÀÂÄÉÈÊËÏÎÔÖÙÛÜ]/g
function estUnSigle(motMaj) {
  // au-delà de quatre lettres un mot français a presque toujours de quoi se
  // prononcer : le seuil ne sert qu'à départager les mots courts
  if (motMaj.length > 4) return false
  const voyelles = motMaj.match(VOYELLES)
  return (voyelles?.length ?? 0) < 2
}

// pas de chiffres dans la classe : « GR20 » ne doit JAMAIS entrer dans la
// transformation, il en ressort tel quel — c'est déjà ce qui le distingue
// d'un mot entièrement en lettres capitales
const SEUL_MAJUSCULES = /^[A-ZÀ-Ý]+$/

const casseNom = (mot) => mot.charAt(0) + mot.slice(1).toLowerCase()

export function casseDeNom(titre) {
  if (!titre) return ''
  // les séparateurs sont CAPTURÉS, pas seulement lus : un titre recomposé
  // doit garder exactement les mêmes espaces et le même « - » qu'à la saisie
  const tokens = titre.split(/(\s+)/)
  // les deux bornes se comptent en mots (des lettres), pas en jetons — dans
  // « … 2025 - DIAGONALE … » le nombre et le tiret ne sont pas des mots, la
  // première et la dernière lettre appartiennent à GRAND et à FOUS
  const indexMots = []
  tokens.forEach((t, i) => { if (/[A-Za-zÀ-ÿ]/.test(t)) indexMots.push(i) })
  const premier = indexMots[0]
  const dernier = indexMots[indexMots.length - 1]

  return tokens
    .map((tok, i) => {
      if (!SEUL_MAJUSCULES.test(tok)) return tok // pas entièrement en capitales : intact (titre déjà composé, nombre, ponctuation)
      const minuscule = tok.toLowerCase()
      const enBordure = i === premier || i === dernier
      if (MOTS_MINEURS.has(minuscule)) return enBordure ? casseNom(tok) : minuscule
      if (estUnSigle(tok)) return tok // sigle : capitales intactes, où qu'il soit dans le titre
      return casseNom(tok)
    })
    .join('')
}
