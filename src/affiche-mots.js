// LES MOTS DE L'AFFICHE QUI SE MESURENT — la taille écrite sous la feuille, et
// la cause d'une densité dégradée.
//
// ═══════════════════════════════════════════════════════════════════════════
// POURQUOI CES DEUX-LÀ VIVENT ICI ET PAS DANS `src/ui/affiche.js`
// ═══════════════════════════════════════════════════════════════════════════
//
// Même raison que src/affiche-nettete.js : `src/ui/affiche.js` importe une
// feuille de style, donc il ne se charge pas sous node, donc tout ce qu'il
// contient ne se vérifie que par RELECTURE DE SOURCE — on peut y attraper un
// libellé qui repart en arrière, jamais un calcul qui se trompe.
//
// Or ces deux phrases-ci ne sont pas des libellés fixes : elles se FABRIQUENT à
// partir de nombres (des millimètres, deux densités) et elles ont chacune une
// condition de silence. Une chaîne construite se teste avec des valeurs, pas
// avec une expression régulière posée sur du code source.
//
// Elles ne connaissent ni le DOM, ni WebGL, ni la sonde. Elles reçoivent des
// nombres et rendent du texte français.

/**
 * La taille écrite SOUS LA FEUILLE — « 50 × 70 cm · paysage ».
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠️ LA SEULE INFORMATION QU'ON N'A PAS LE DROIT D'ENTERRER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Elle existait déjà — en 11 px, en tête de la ligne de vérité, collée au
 * bouton d'achat, à cinq cents pixels du visuel qu'elle décrit. Or c'est la
 * question qu'on se pose EN REGARDANT la feuille : « ça fait quelle taille,
 * cette chose ? » La réponse doit être à côté de la chose.
 *
 * ⚠️ ET L'ORDRE DES DEUX NOMBRES EST CELUI DE `ligneVerite`, PAS LE CÔTÉ COURT
 * D'ABORD. En paysage la feuille mesure vraiment 70 de large sur 50 de haut ;
 * écrire « 50 × 70 » sous une feuille couchée obligerait à réfléchir pour
 * retrouver quel nombre va avec quel côté. Le mot qui suit lève le dernier
 * doute — et c'est lui qui fait que les deux ordres ne se contredisent pas.
 *
 * @param {{largeurMm:number, hauteurMm:number}} geo - la géométrie de la page
 * @param {'portrait'|'paysage'} orientation
 * @returns {string} vide si la géométrie manque
 */
export function tailleSousFeuille(geo, orientation) {
  if (!geo || !(geo.largeurMm > 0) || !(geo.hauteurMm > 0)) return ''
  const sens = orientation === 'portrait' ? 'portrait' : 'paysage'
  return `${geo.largeurMm / 10} × ${geo.hauteurMm / 10} cm · ${sens}`
}

/**
 * La note qui explique une densité PLUS BASSE QUE LA NOMINALE.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠️ UN CHIFFRE DÉGRADÉ SANS CAUSE EST UN CHIFFRE QUI FAIT RENONCER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * La ligne de vérité annonce parfois 250 dpi, ou 210. C'est honnête —
 * `degradePour` a baissé la densité pour que CETTE machine-ci puisse rendre le
 * fichier, et c'est la décision d'Adrien : dégrader d'abord, cacher ensuite.
 * Mais c'est muet. Quelqu'un qui a lu « 300 dpi » partout ailleurs lit « 210 »
 * et en conclut que le produit est au rabais, alors que c'est SA machine qui
 * est en cause et que son affiche sera nette quand même.
 *
 * La note dit donc les deux choses, dans cet ordre :
 *   ① D'OÙ VIENT LE CHIFFRE — sa carte graphique. Sans la cause, il cherche le
 *      réglage qui remonterait la qualité, et il n'existe pas.
 *   ② CE QUE ÇA CHANGE — rien, à cette taille-là. Une cause sans conséquence
 *      laisse le doute entier : « d'accord, mais est-ce que ce sera moche ? »
 *
 * ⚠️ ET ELLE NE PARLE QUE QUAND IL Y A QUELQUE CHOSE À DIRE. À densité nominale
 * elle rend une chaîne vide : une note permanente qui rassure sur un problème
 * inexistant finit par le faire chercher.
 *
 * ⚠️ AUCUN JUGEMENT SUR LA MACHINE. « Ta carte graphique ne tient pas les
 * 300 dpi » est un fait ; « ton ordinateur est trop faible » est un reproche, et
 * on ne reproche rien à quelqu'un qui est en train d'acheter.
 *
 * @param {object} o
 * @param {number} o.dpi - la densité retenue pour ce couple (format, sens)
 * @param {number} o.nominal - la densité nominale du format
 * @param {number} o.largeurCm
 * @param {number} o.hauteurCm
 * @returns {string} vide si rien n'a été dégradé
 */
export function noteDensite({ dpi, nominal, largeurCm, hauteurCm } = {}) {
  if (!(dpi > 0) || !(nominal > 0) || dpi >= nominal) return ''
  if (!(largeurCm > 0) || !(hauteurCm > 0)) return ''
  const petit = Math.min(largeurCm, hauteurCm)
  const grand = Math.max(largeurCm, hauteurCm)
  return `Ta carte graphique ne tient pas les ${nominal} dpi sur ce format : ton affiche sort en ${dpi} dpi. À ${petit} × ${grand} cm, elle reste nette.`
}
