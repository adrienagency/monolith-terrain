// Les gabarits LIVRÉS — la bibliothèque que tout visiteur trouve en arrivant,
// par opposition aux gabarits UTILISATEUR (localStorage, templates-user.js) et
// à ceux de la BOUTIQUE (public/templates/data.json, store-catalog.js).
//
// POURQUOI ce module existe : la liste vivait en dur dans src/ui/atelier.js,
// donc le mode SIMPLE (Studio, étape ① Template) était le seul endroit qui la
// connaissait. La Bibliothèque du mode AVANCÉ (ui/templates-panel.js) ne
// listait que les gabarits de l'utilisateur — un gabarit livré était donc
// invisible pour qui reste en avancé. Adrien veut les mêmes gabarits des deux
// côtés : une seule liste, lue par les deux panneaux, est la seule façon que
// l'un ne dérive pas de l'autre à la prochaine fournée.
//
// Ce sont de vrais fichiers .shibumap-template (look COMPLET + vignette JPEG
// en base64 + pose de caméra), pas des rampes de couleurs — distinction
// importante (Adrien) : palette = couleurs seules, template = tout le look.
// Ils vivent dans public/templates/defaults/, donc HORS du bundle : ils ne
// sont chargés qu'à l'ouverture de la bibliothèque, jamais au démarrage.
// (Seule exception : shibustart.json, importé statiquement par main.js parce
// que c'est le look d'ouverture de l'application.)

// shibuStart EN TÊTE : c'est le look sur lequel l'application s'ouvre (voir
// START_VIEW dans main.js), donc le premier de la bibliothèque — il faut
// pouvoir y revenir d'un clic après avoir bricolé.
export const TEMPLATES_LIVRES = [
  'shibustart',
  'the-main-stuff', 'isolated', 'light', 'realistic',
  'bronze', 'white-valley', 'yellow-glass', 'carbon',
  // Fournée du 2026-08-02 (huit gabarits d'Adrien). ⚠️ Ils portent des clés
  // retirées le même jour — waterFill, placesHalo/Density/Size, les fog* et les
  // bloom*. Aucune migration n'a été écrite et c'est VOULU : applyUserTemplate
  // filtre sur TEMPLATE_KEYS (templates-user.js), tout ce qui n'y figure pas
  // tombe en silence, exactement comme 'coastLine' et 'roadsEnabled' avant eux.
  // Le test test/templates-livres.test.js le prouve fichier par fichier plutôt
  // que de le supposer — y compris le cas à part de slabCornerSmoothing, qui
  // est resté dans la liste blanche mais que plus aucun rendu ne relit.
  'highlander', 'interlaken', 'java', 'marvelous-old-school',
  'under-ice', 'blue-is-back', 'elixir', 'etretat',
]

export const urlTemplateLivre = (slug) => `/templates/defaults/${slug}.json`

// Un fichier servi n'est pas de confiance davantage qu'un fichier importé :
// on ne garde que ce qui se déclare bien gabarit ET porte un look.
export const estTemplateLivre = (o) => !!(o && o.format === 'shibumap-template' && o.look && typeof o.look === 'object')

// Charge toute la bibliothèque livrée. Un fichier manquant ou illisible est
// simplement absent de la liste — la bibliothèque ne doit jamais tomber en
// panne parce qu'un gabarit sur dix-sept a échoué. L'ordre de TEMPLATES_LIVRES
// est conservé (Promise.all, pas une course), sinon la grille se réordonnerait
// au gré du réseau d'un chargement à l'autre.
export async function chargeTemplatesLivres(fetchImpl = (...a) => fetch(...a)) {
  const all = await Promise.all(TEMPLATES_LIVRES.map(async (slug) => {
    try {
      const r = await fetchImpl(urlTemplateLivre(slug))
      const t = await r.json()
      return estTemplateLivre(t) ? { ...t, slug } : null
    } catch { return null }
  }))
  return all.filter(Boolean)
}
