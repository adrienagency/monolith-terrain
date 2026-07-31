// PRÉCHAUFFAGE DES PROGRAMMES GLSL — pourquoi ce module existe.
//
// MESURÉ le 2026-07-28 (RTX 3080, build de production, cache froid, écran
// 1280×800) : le démarrage contenait UN gel de 1 760 ms pendant lequel le
// navigateur ne produisait pas une seule image. Pas « peu d'images » : ZÉRO,
// vérifié au flux Page.screencast, qui ne livre une image que lorsque le
// compositeur en produit une. La planète de l'écran de chargement s'arrêtait
// net, et c'est très exactement le « lag » que ressent un visiteur.
//
// Ce gel n'était ni du réseau, ni du JavaScript : c'était le pilote graphique
// qui compilait les shaders, sur le fil principal, au premier dessin.
//
// LE MÉCANISME, dans three r172 (renderers/webgl/WebGLProgram.js) :
//   gl.linkProgram() est ASYNCHRONE — elle rend la main immédiatement ;
//   onFirstUse(), appelée par getUniforms() à la PREMIÈRE image qui utilise le
//   matériau, appelle gl.getProgramInfoLog() — et CETTE requête bloque jusqu'à
//   ce que le pilote ait fini. Tout l'arriéré de compilation se paie alors d'un
//   coup, sur le fil principal, au pire moment possible.
//
// ⚠️ PISTE ÉCARTÉE, PARCE QUE MESURÉE : `renderer.debug.checkShaderErrors =
// false` ne gagne RIEN. En neutralisant getProgramInfoLog/getShaderInfoLog, le
// gel se déplace simplement sur getProgramParameter — 3 372 ms au lieu de
// 3 469 ms, blocage total inchangé (5 604 ms contre 5 724 ms, dans le bruit).
// Ce n'est pas la vérification d'erreurs qui coûte, c'est la compilation. La
// désactiver perdrait tous les messages d'erreur GLSL pour zéro milliseconde —
// le pire échange possible. Si quelqu'un repropose cette ligne un jour : elle a
// été essayée, chiffrée, et rejetée.
//
// CE QU'ON FAIT À LA PLACE : `renderer.compile()` link les programmes, puis on
// SONDE leur état via KHR_parallel_shader_compile (COMPLETION_STATUS_KHR), qui
// ne bloque pas. Le pilote compile sur ses propres fils pendant que le fil
// principal reste libre : l'écran de chargement continue de vivre, les tuiles
// d'altitude arrivent, le relief se construit. Le gel devient du temps recouvert.
//
// RÉSULTAT MESURÉ (même machine, même build, cache froid, 2 runs chacun) :
//   pire gel      1 760 ms  ->  354 ms
//   gel cumulé    2 742 ms  ->  705 ms
//   carte visible 7 129 ms  ->  3 873 ms
//
// ⚠️ POURQUOI ON SONDE NOUS-MÊMES, AU LIEU D'APPELER `renderer.compileAsync()`.
// Parce que compileAsync se casse sur une carte vivante, et qu'on l'a mesuré.
// Son sondage interne (r172, WebGLRenderer.js) lit sans garde :
//     properties.get( material ).currentProgram.isReady()
// Or three EFFACE les propriétés d'un matériau sur son évènement `dispose`
// (deallocateMaterial → properties.remove). Un matériau libéré entre deux
// sondages rend donc un objet vide, `currentProgram` vaut undefined, et la
// lecture lève. ShibuMap libère des matériaux EN PERMANENCE pendant le
// démarrage (dalles de relief remplacées, globe évincé) : la course était
// gagnée à chaque chargement de page.
//
// Et ça ne coûtait pas qu'une ligne rouge en console : la levée se produit dans
// un `setTimeout` interne à three, donc HORS de la chaîne de promesses. Rien ne
// pouvait la rattraper — ni notre try/catch, ni un .catch — et la promesse de
// compileAsync ne se réglait JAMAIS. Le préchauffage mourait là, le garde-fou
// de délai finissait par le déclarer perdu, et le premier dessin attendait les
// 6 s entières. MESURÉ sur le build de production (commit d716e79) :
//   TypeError à 3 330 ms, puis {ok:false, raison:'delai', ms:6560}.
// Autrement dit : le module censé supprimer le gel du démarrage ne servait plus
// à rien, en silence. Sonder ici coûte vingt lignes et rend le cas testable.
//
// ⚠️⚠️ OÙ REPRODUIRE CE DÉFAUT — ET SURTOUT OÙ NE PAS LE CHERCHER.
// C'est la partie qui coûte le plus de temps à qui reprend le sujet, parce que
// la combinaison qui échoue est étroite et que TOUTES les autres rendent un
// faux négatif rassurant. MESURÉ le 31/07/2026 (RTX 3080, ANGLE D3D11, Chrome
// headless 1280×800, n=6 par cas) en servant la version pré-correctif à la
// place de celle-ci :
//
//   • SERVEUR DE DEV (`npm run dev`) : ne reproduit JAMAIS. Aucune zone, aucun
//     mode, {ok:true} à tous les coups. Tout y est plus lent et plus étalé, et
//     la course des matériaux libérés ne se gagne pas. Chercher là est une
//     heure perdue — il FAUT `vite build` puis servir `dist/`.
//   • DÉMARRAGE NU (`/?f3=0`, sans lien de partage) + BUILD DE PRODUCTION :
//     reproduit 4 fois sur 6. {ok:false, raison:'delai'}×4 contre {ok:true}×2,
//     et premier dessin 7 607 ms — contre 3 430 ms avec la garde ci-dessous,
//     où les 6 démarrages rendent {ok:true} et zéro TypeError.
//   • AVEC UN LIEN `#s=` (Chamonix 45.92/6.87 z12, La Réunion −21.13/55.53
//     z13) : ne reproduit pas, et c'est STRUCTUREL — un lien de partage boote
//     DIRECTEMENT sur sa zone, donc sans la transition Annecy→zone qui
//     remplace les dalles. Or ce sont ces libérations-là qui gagnent la course.
//     Demander une repro « sur telle zone » est donc une impasse par
//     construction, pas un manque de chance.
//   • EN `?f3=1` : jamais vu échouer (0/6, et 0/10 sur une passe antérieure).
//     La fenêtre 3×3 ne libère pas les mêmes matériaux au démarrage.
//
// Donc : build de production + démarrage nu + f3=0, et rien d'autre.
// `node scripts/sonde-demarrage.mjs` fait cette mesure de bout en bout et rend
// le verdict chiffré ; c'est lui qu'il faut lancer avant/après toute
// intervention sur ce module, sur la chaîne de rendu ou sur le premier dessin.
//
// Module sans DOM ni three : `renderer` n'est qu'un objet portant `compile`,
// `properties.get` et `setRenderTarget`, donc tout est testable en node.

// Rythme du sondage. Même valeur que three : assez fin pour ne pas rallonger le
// démarrage, assez lâche pour ne pas occuper le fil principal qu'on libère.
const INTERVALLE_MS = 10

/**
 * Précompile, sans bloquer le fil principal, les programmes GLSL de la scène.
 *
 * Ne rejette JAMAIS et ne peut pas retenir le démarrage plus longtemps que
 * `timeoutMs` : ce préchauffage est un confort, pas une dépendance.
 *
 * ⚠️ Le délai n'est pas décoratif. KHR_parallel_shader_compile est une
 * extension ; un pilote qui ne lèverait jamais COMPLETION_STATUS_KHR ferait
 * boucler le sondage pour toujours et la carte ne serait jamais dessinée.
 * Un gel de 2 s est un défaut ; une page morte est une panne.
 *
 * @param {object}  o.renderer  three.WebGLRenderer (ou tout objet à compile/properties)
 * @param {object}  o.scene     la scène de l'application
 * @param {object}  o.camera    sa caméra
 * @param {object=} o.target    cible de rendu contre laquelle compiler — voir plus bas
 * @param {number=} o.timeoutMs abandon (défaut 6 s)
 * @returns {Promise<{ok: boolean, ms: number, raison?: string}>} ne rejette jamais
 */
export function warmupPrograms({ renderer, scene, camera, target = null, timeoutMs = 6000 }) {
  const t0 = maintenant()
  const fin = (r) => ({ ...r, ms: Math.round(maintenant() - t0) })
  // Un three trop ancien (pas de `compile()` qui rende ses matériaux) ou un
  // renderer sans `properties` : on passe son tour. Le préchauffage est un
  // confort, jamais une condition du démarrage.
  const sondable = typeof renderer?.compile === 'function' && typeof renderer?.properties?.get === 'function'
  if (!sondable) return Promise.resolve(fin({ ok: false, raison: 'indisponible' }))

  // POURQUOI compiler contre une cible de rendu. La clé de programme de three
  // dépend de l'espace colorimétrique de SORTIE. Compilé sur le canevas (sRGB,
  // 8 bits) alors que la chaîne de post-traitement rend ensuite dans un tampon
  // HDR, le préchauffage produit des programmes que personne n'utilisera : on
  // en a compté NEUF de trop, et le vrai programme se compilait quand même au
  // premier dessin. En pointant d'abord la cible réelle (composer.inputBuffer),
  // il n'en reste que trois. Même fluidité, cinq fois moins de gâchis.
  const viser = (t) => { if (target !== null && typeof renderer.setRenderTarget === 'function') renderer.setRenderTarget(t) }

  let restants
  try {
    viser(target)
    // `compile()` est SYNCHRONE : elle parcourt la scène et demande un
    // programme par matériau (c'est là que la cible de rendu est lue), puis
    // rend l'ensemble des matériaux concernés. Seul le LINK part en tâche de
    // fond côté pilote — c'est lui qu'on sonde ensuite.
    restants = renderer.compile(scene, camera)
  } catch (err) {
    // compile() peut lever (scène mal formée, contexte WebGL perdu). Ça ne
    // doit pas non plus emporter le démarrage.
    viser(null)
    return Promise.resolve(fin({ ok: false, raison: String(err?.message ?? err) }))
  }
  // La cible revient à null TOUT DE SUITE : elle n'avait d'utilité que pendant
  // `compile()`, qui vient de rendre la main. Un renderer laissé braqué sur un
  // tampon hors écran dessinerait toutes les images suivantes dans le vide —
  // écran noir définitif, et pas une ligne en console pour l'expliquer.
  viser(null)
  if (!restants || typeof restants.delete !== 'function') return Promise.resolve(fin({ ok: false, raison: 'indisponible' }))

  const pret = (materiau) => {
    // Un matériau LIBÉRÉ pendant qu'on l'attendait n'a plus de propriétés :
    // three les efface sur `dispose`, et `properties.get()` rend alors un objet
    // vide. Pas de programme, donc plus rien à attendre de lui — c'est très
    // exactement la garde qui manque à compileAsync (voir l'en-tête).
    const programme = renderer.properties.get(materiau)?.currentProgram
    return programme === undefined || programme.isReady()
  }

  return new Promise((resolve) => {
    let sonde = null
    let garde = null
    const conclure = (r) => { clearTimeout(sonde); clearTimeout(garde); resolve(fin(r)) }
    const sonder = () => {
      try {
        // Retirer d'un Set pendant qu'on le parcourt est légal en JS.
        for (const materiau of restants) if (pret(materiau)) restants.delete(materiau)
      } catch (err) {
        return conclure({ ok: false, raison: String(err?.message ?? err) })
      }
      if (restants.size === 0) return conclure({ ok: true })
      sonde = setTimeout(sonder, INTERVALLE_MS)
    }
    garde = setTimeout(() => conclure({ ok: false, raison: 'delai' }), timeoutMs)
    sonder()
  })
}

// NOTE — la chaîne de post-traitement n'est PAS préchauffée, et c'est mesuré.
// Ses passes (`postprocessing`) exposent chacune leur scène de quad plein
// écran, donc on POURRAIT les passer à `compile()` aussi. Essayé : pire gel
// 363 ms contre 354 ms, gel cumulé 722 ms contre 705 ms — aucun gain, pour du
// code en plus et un couplage aux entrailles de la bibliothèque. Elles paient
// leur compilation au premier dessin, et ça ne se voit pas.

const maintenant = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())
