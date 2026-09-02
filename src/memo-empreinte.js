// MÉMO PAR EMPREINTE — PF4, levier n° 3 du profil PF1 (`contexteCrop()`
// reconstruit à chaque image : 14 % des échantillons V8 au crop).
//
// `contexteCrop` lit une centaine de valeurs vivantes (uniformes du socle,
// lampes, MNT, plinthe) et bâtit un objet imbriqué que la chaîne du crop compare
// ensuite à ce qu'elle a posé — pour ne RIEN faire tant que rien n'a changé. Le
// coût, c'est la construction, pas la comparaison. Ici : on relit les MÊMES
// sources dans un tableau plat (des nombres, des identités — aucune allocation
// au-delà du tableau réutilisé), on compare à la lecture précédente, et on ne
// reconstruit que si une valeur a bougé. Une texture est comparée par identité,
// une couleur par ses trois composantes, un vecteur par ses composantes.
//
// ⚠️ La liste des sources DOIT couvrir tout ce que le constructeur lit : une
// source oubliée = un contexte périmé après un réglage. `test/memo-empreinte.
// test.js` vérifie sur le texte que chaque uniforme et chaque paramètre lu par
// `construireContexteCrop` figure dans l'empreinte.

export function creerMemoEmpreinte(lireEmpreinte, construire) {
  let precedente = null
  let valeur
  return function memo() {
    const e = lireEmpreinte()
    if (precedente && memeEmpreinte(precedente, e)) return valeur
    precedente = e.slice()
    valeur = construire()
    return valeur
  }
}

export function memeEmpreinte(a, b) {
  if (!a || !b || a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const x = a[i], y = b[i]
    // NaN vaut NaN : un réglage non fini ne doit pas forcer une reconstruction par image
    if (x !== y && !(x !== x && y !== y)) return false
  }
  return true
}

// Empile une valeur three dans l'empreinte : couleur → 3 nombres, vecteur → ses
// composantes, texture/objet → identité, le reste tel quel.
export function empiler(e, v) {
  if (v == null || typeof v !== 'object') { e.push(v); return }
  if (v.isColor) { e.push(v.r, v.g, v.b); return }
  if (v.isVector4) { e.push(v.x, v.y, v.z, v.w); return }
  if (v.isVector3) { e.push(v.x, v.y, v.z); return }
  if (v.isVector2) { e.push(v.x, v.y); return }
  e.push(v)
}
