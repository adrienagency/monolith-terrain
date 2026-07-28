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
// CE QU'ON FAIT À LA PLACE : `renderer.compileAsync()` link les programmes puis
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
// Module sans DOM ni three : `renderer` n'est qu'un objet portant
// `compileAsync` et `setRenderTarget`, donc tout est testable en node.

/**
 * Précompile, sans bloquer le fil principal, les programmes GLSL de la scène.
 *
 * Ne rejette JAMAIS et ne peut pas retenir le démarrage plus longtemps que
 * `timeoutMs` : ce préchauffage est un confort, pas une dépendance.
 *
 * ⚠️ Le délai n'est pas décoratif. KHR_parallel_shader_compile est une
 * extension ; un pilote qui ne lèverait jamais COMPLETION_STATUS_KHR ferait
 * boucler `compileAsync` pour toujours et la carte ne serait jamais dessinée.
 * Un gel de 2 s est un défaut ; une page morte est une panne.
 *
 * @param {object}  o.renderer  three.WebGLRenderer (ou tout objet à compileAsync)
 * @param {object}  o.scene     la scène de l'application
 * @param {object}  o.camera    sa caméra
 * @param {object=} o.target    cible de rendu contre laquelle compiler — voir plus bas
 * @param {number=} o.timeoutMs abandon (défaut 6 s)
 * @returns {Promise<{ok: boolean, ms: number, raison?: string}>} ne rejette jamais
 */
export function warmupPrograms({ renderer, scene, camera, target = null, timeoutMs = 6000 }) {
  const t0 = maintenant()
  const fin = (r) => ({ ...r, ms: Math.round(maintenant() - t0) })
  if (typeof renderer?.compileAsync !== 'function') return Promise.resolve(fin({ ok: false, raison: 'indisponible' }))

  // POURQUOI compiler contre une cible de rendu. La clé de programme de three
  // dépend de l'espace colorimétrique de SORTIE. Compilé sur le canevas (sRGB,
  // 8 bits) alors que la chaîne de post-traitement rend ensuite dans un tampon
  // HDR, le préchauffage produit des programmes que personne n'utilisera : on
  // en a compté NEUF de trop, et le vrai programme se compilait quand même au
  // premier dessin. En pointant d'abord la cible réelle (composer.inputBuffer),
  // il n'en reste que trois. Même fluidité, cinq fois moins de gâchis.
  const viser = (t) => { if (target !== null && typeof renderer.setRenderTarget === 'function') renderer.setRenderTarget(t) }

  let travail
  try {
    viser(target)
    // `.finally` et pas `.then` : la cible doit revenir à null même si la
    // compilation échoue. Un renderer laissé braqué sur un tampon hors écran
    // dessinerait toutes les images suivantes dans le vide — écran noir
    // définitif, et pas une ligne en console pour l'expliquer.
    travail = renderer.compileAsync(scene, camera).finally(() => viser(null))
  } catch (err) {
    // compileAsync peut lever de façon SYNCHRONE (scène mal formée, contexte
    // WebGL perdu). Ça ne doit pas non plus emporter le démarrage.
    viser(null)
    return Promise.resolve(fin({ ok: false, raison: String(err?.message ?? err) }))
  }

  let minuteur = null
  const garde = new Promise((resolve) => { minuteur = setTimeout(() => resolve({ ok: false, raison: 'delai' }), timeoutMs) })
  return Promise.race([
    travail.then(() => ({ ok: true })).catch((err) => ({ ok: false, raison: String(err?.message ?? err) })),
    garde,
  ]).then((r) => {
    clearTimeout(minuteur)
    return fin(r)
  })
}

// NOTE — la chaîne de post-traitement n'est PAS préchauffée, et c'est mesuré.
// Ses passes (`postprocessing`) exposent chacune leur scène de quad plein
// écran, donc on POURRAIT les passer à compileAsync aussi. Essayé : pire gel
// 363 ms contre 354 ms, gel cumulé 722 ms contre 705 ms — aucun gain, pour du
// code en plus et un couplage aux entrailles de la bibliothèque. Elles paient
// leur compilation au premier dessin, et ça ne se voit pas.

const maintenant = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())
