// D'OÙ VIENT UN TEMPLATE — le marqueur d'origine de la Bibliothèque.
//
// LE PROBLÈME (Adrien, captures du 2026-08-06) : « the main stuff », « Carbon »,
// « yellow glass », « Interlaken » et « Etretat » apparaissaient DEUX FOIS dans
// la liste. Ni la liste livrée ni l'affichage n'y sont pour quelque chose —
// test/templates-livres.test.js interdit déjà le doublon de nom côté livré, et
// la grille se reconstruit par replaceChildren, elle n'empile rien. La seconde
// carte vient du localStorage : ces gabarits ont été FABRIQUÉS dans
// l'application (« Les huit gabarits d'Adrien », commit 0e0360f, et la fournée
// b3b6ca3 avant elle), exportés en .json, puis commités dans
// public/templates/defaults/. La copie de travail, elle, est restée dans
// `shibumap-user-templates`. Le jour où la Bibliothèque du mode avancé s'est
// mise à afficher AUSSI les gabarits livrés, les deux se sont rejointes à
// l'écran. Sur une machine vierge il n'y a aucun doublon — c'est un doublon
// d'AUTEUR, pas de programme, et il ne touche que qui a fabriqué le gabarit.
//
// LA RÉPONSE : on ne supprime rien. Le contenu du localStorage est le travail
// de l'utilisateur ; on se contente de le CLASSER à l'affichage, et le
// classement est recalculé à chaque rendu — donc entièrement réversible.
//
// Trois provenances, dans cet ordre de priorité :
//   1. `origine === 'shibumap'` — gabarit de la maison : livré avec le site ou
//      rapporté de la boutique. Marqueur POSÉ à la source (templates-livres.js,
//      store-catalog.js), pas deviné.
//   2. `origine === 'moi'` — création de l'utilisateur. Marqueur posé par
//      saveCurrentTemplate (main.js).
//   3. AUCUN marqueur : c'est un enregistrement d'AVANT ce chantier, dont on ne
//      connaît pas la provenance. On ne devine pas sur le nom — deux gabarits
//      homonymes de contenus différents ne sont pas un doublon, ce serait un
//      problème de nommage, et les confondre détruirait du travail. On compare
//      le LOOK, filtré par la liste blanche qui sert à l'appliquer : identique à
//      un livré ⇒ c'est bien la copie de travail d'un gabarit de la maison ;
//      sinon ⇒ création, sans discussion. Le doute profite toujours à
//      l'utilisateur : un ancien gabarit inconnu reste dans « Mes créations ».

// Le vocabulaire du champ vit avec le FORMAT (templates-user.js) ; on le
// réexporte ici pour que les panneaux n'aient qu'une porte à pousser.
import { TEMPLATE_KEYS, ORIGINE_SHIBUMAP, ORIGINE_MOI, lisOrigine } from './templates-user.js'
export { ORIGINE_SHIBUMAP, ORIGINE_MOI, lisOrigine }

// JSON à clés triées, récursivement : deux looks égaux doivent produire la même
// chaîne quel que soit l'ordre d'insertion (un look relu d'un fichier n'a pas
// l'ordre d'un look capturé en mémoire).
function stableJson(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v ?? null)
  if (Array.isArray(v)) return `[${v.map(stableJson).join(',')}]`
  const cles = Object.keys(v).sort()
  return `{${cles.map((k) => `${JSON.stringify(k)}:${stableJson(v[k])}`).join(',')}}`
}

// La signature ne retient que les clés que applyUserTemplate applique VRAIMENT.
// C'est ce qui rend la comparaison juste malgré l'histoire : les gabarits livrés
// traînent des clés retirées (waterFill, les fog*, les bloom*…) que la copie
// enregistrée ne porte pas forcément, et l'inverse est vrai pour les clés
// ajoutées depuis. Filtrer les deux côtés par TEMPLATE_KEYS compare ce qui se
// voit à l'écran, pas les scories.
export function signatureLook(look) {
  if (!look || typeof look !== 'object') return ''
  const retenu = {}
  for (const k of TEMPLATE_KEYS) if (k in look) retenu[k] = look[k]
  return stableJson(retenu)
}

export const signaturesLivrees = (livres = []) => new Set(livres.map((t) => signatureLook(t?.look)).filter(Boolean))

// 'officiel' | 'moi' | 'copie'  ('copie' = doublon local d'un gabarit livré)
export function origineTemplate(t, sigLivrees = new Set()) {
  const marque = lisOrigine(t?.origine)
  if (marque === ORIGINE_SHIBUMAP) return 'officiel'
  if (marque === ORIGINE_MOI) return 'moi'
  const sig = signatureLook(t?.look)
  return sig && sigLivrees.has(sig) ? 'copie' : 'moi'
}

// Range les gabarits de l'utilisateur en trois tas. `livres` sert uniquement à
// reconnaître les copies ; il n'est pas recopié dans le résultat, la grille
// officielle affiche les livrés directement.
export function trieTemplates(miens = [], livres = []) {
  const sig = signaturesLivrees(livres)
  const officiels = []
  const perso = []
  const copies = []
  for (const t of miens) {
    const o = origineTemplate(t, sig)
    if (o === 'officiel') officiels.push(t)
    else if (o === 'copie') copies.push(t)
    else perso.push(t)
  }
  return { officiels, miens: perso, copies }
}

// Un homonyme n'est PAS un doublon : deux looks différents qui portent le même
// nom sont un problème de nommage. On le signale sur la carte plutôt que de le
// masquer — l'utilisateur seul peut décider de renommer ou de supprimer.
export function nomsEnCollision(miens = [], livres = []) {
  const nom = (t) => String(t?.name ?? '').trim().toLowerCase()
  const officiels = new Set(livres.map(nom).filter(Boolean))
  return new Set(miens.map(nom).filter((n) => officiels.has(n)))
}
