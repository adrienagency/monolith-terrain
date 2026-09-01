// LES BOUTONS DU BAS — Tâche R1 ② du plan « LE STUDIO SUR LE GLOBE ».
//
// **Adrien, 2026-08-23 :** « Il me manque les boutons du bas en UI, ils ont
// disparu (shuffle, affichage photographie aérienne...) »
//
// ══════════ CE QUE CE FICHIER GARDE ════════════════════════════════════════
//
//   ① LA LOI — deux questions, deux réponses. Le bornage du drapeau tient sur
//      le maillage du bloc plat, et **ne déborde pas** sur l'interface.
//   ② LE PATRON DE CÂBLAGE — un poseur de papier, monté comme `main.js` l'est,
//      rendu drapeau levé puis drapeau baissé.
//      ⚠️ **CE N'EST PAS UN TEST DE COMPORTEMENT DE `main.js`, ET L'EN-TÊTE L'A
//      PROMIS À TORT AU PREMIER TOUR.** Le relecteur l'a montré en nommant les
//      morts : sous la mutation qui reconfond les deux questions, ② tombe en
//      même temps que ① et pour la même raison — il consomme la même loi et ne
//      touche jamais `main.js`. Il documente donc la FORME attendue du câblage ;
//      ce qui garde le câblage réel, c'est ③, et surtout son COMPTE.
//   ③ LE CÂBLAGE DE `main.js` — lu, pas chargé (aucun test de ce dépôt ne
//      charge `main.js`). ⚠️ **Le compte des lecteurs est la seule garde de
//      CLASSE** : il ferme d'un coup les treize calques qu'on pouvait rebrancher
//      sur la mauvaise grandeur sans qu'un test bronche.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { visibiliteSurface } from '../src/monde/visibilite-surface.js'

const MAIN = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')

// ══════════════════════════════════════════════════════════════════ ① la loi

test('① DRAPEAU LEVÉ, en surface : le maillage plat est éteint, les boutons sont ALLUMÉS', () => {
  const v = visibiliteSurface({ terreUnique: true, surface: true })
  assert.equal(v.socle, false, 'le bloc plat revient — il y aurait DEUX Terres')
  assert.equal(v.boutons, true, 'les boutons du bas ont disparu — le défaut d’Adrien')
  // ⛔ **SAUF LE CINÉ, ET C'EST MESURÉ** — §3 de la loi : ni `shots.stop()` ni le
  // huitième clic ne rendent la vue, la caméra reste dans la mer du crop.
  assert.equal(v.cine, false, 'le bouton ciné est rallumé sous le drapeau : aller simple sous le sol')
})

test('① DRAPEAU LEVÉ : le CARTOUCHE est allumé — la moitié non réparée du §0', () => {
  // ⛔ **LE DÉFAUT D'ADRIEN DU 2026-08-31**, et c'est le même que celui des
  // boutons : `groundInfo` était resté branché sur `socle` quand les trois
  // boutons passaient sur `boutons`. Le cartouche est posé sur la BASE autour du
  // bloc ; sous le drapeau il y a un bloc, et il a une base (`parois-crop.js`).
  const v = visibiliteSurface({ terreUnique: true, surface: true })
  assert.equal(v.cartouche, true, 'le cartouche Wikipédia reste éteint sous le drapeau')
  // ⚠️ et il s'éteint bien avec la surface — en orbite il n'y a plus de base.
  assert.equal(visibiliteSurface({ terreUnique: true, surface: false }).cartouche, false)
})

test('① DRAPEAU LEVÉ : le ciné est le SEUL éteint — l’exception ne déborde pas', () => {
  // ⚠️ **UNE EXCEPTION QUI S'ÉTENDRAIT SERAIT LE DÉFAUT D'ORIGINE PAR L'AUTRE
  // BOUT** : Adrien demandait ces boutons, on n'en retire qu'un, et pour une
  // raison mesurée.
  assert.deepEqual(visibiliteSurface({ terreUnique: true, surface: true }),
    { socle: false, boutons: true, cine: false, cartouche: true, carto: true, reperes: true, nuages: true })
})

test('① DRAPEAU LEVÉ, hors surface : tout s’éteint, boutons compris', () => {
  // ⚠️ En orbite la planète EST le sujet : un raccourci isométrique « sur le
  // bloc » n'a plus de bloc, et le coin cartographie n'a plus de carte.
  assert.deepEqual(visibiliteSurface({ terreUnique: true, surface: false }),
    { socle: false, boutons: false, cine: false, cartouche: false, carto: false, reperes: false, nuages: false })
})

test('① DRAPEAU BAISSÉ : la production est INCHANGÉE, les deux réponses se confondent', () => {
  // ⚠️ **C'EST LA GARANTIE QUE TOUT CE CHANTIER A TENUE JUSQU'ICI**, et elle
  // vaut dans les deux sens : sans drapeau, `socle` et `boutons` sont le même
  // booléen, celui d'avant la tâche, au bit près.
  for (const surface of [true, false]) {
    assert.deepEqual(visibiliteSurface({ terreUnique: false, surface }),
      { socle: surface, boutons: surface, cine: surface, cartouche: surface, carto: surface, reperes: surface, nuages: surface },
      'sans drapeau, les QUATRE réponses doivent être le même booléen')
  }
})

test('① les entrées molles sont ramenées à des booléens, pas propagées telles quelles', () => {
  // ⚠️ `setVisible(undefined)` et `mesh.visible = undefined` ne sont pas des
  // erreurs, ce sont des faux SILENCIEUX — et `visible = 0` casse three.js plus
  // loin, pas ici. On borne au bord.
  for (const e of [undefined, null, 0, '', NaN]) {
    assert.deepEqual(visibiliteSurface({ terreUnique: false, surface: e }),
      { socle: false, boutons: false, cine: false, cartouche: false, carto: false, reperes: false, nuages: false })
  }
  for (const e of [1, 'oui', {}]) {
    assert.deepEqual(visibiliteSurface({ terreUnique: false, surface: e }),
      { socle: true, boutons: true, cine: true, cartouche: true, carto: true, reperes: true, nuages: true })
  }
})

// ═══════════════════════════════════════════════════════ ② le comportement

// Le poseur de papier : câblé EXACTEMENT comme `poserVisibiliteSocle` l'est
// dans `main.js` — les calques du bloc plat sur `socle`, les trois boutons sur
// `boutons`. ⚠️ **Il ne recopie pas la LOI**, il la consomme : muter
// `visibilite-surface.js` fait rougir ce test, ce qui est tout l'objet.
function poseurDePapier(terreUnique) {
  const etat = {
    maillage: null, calques: {}, isoBtn: null, cineBtn: null, mapCorner: null,
  }
  return {
    etat,
    poser(v) {
      const vue = visibiliteSurface({ terreUnique, surface: v })
      etat.maillage = vue.socle
      // un échantillon des quatorze calques qui APPARTIENNENT au bloc plat
      etat.calques = { labels: vue.socle, nuages: vue.socle, socleBas: vue.socle, mer: vue.socle }
      etat.isoBtn = vue.boutons
      etat.mapCorner = vue.boutons
      // ⛔ le ciné a sa PROPRE réponse depuis le tour 2 — voir le §3 de la loi
      etat.cineBtn = vue.cine
    },
  }
}

test('② DRAPEAU LEVÉ : `terrain.mesh.visible` reste FAUX pendant que les trois boutons s’affichent', () => {
  const p = poseurDePapier(true)
  p.poser(true) // l'automate du seuil dit « on est en surface, devant un bloc »
  assert.equal(p.etat.maillage, false, 'le maillage du bloc plat est dessiné sous le drapeau')
  for (const [nom, v] of Object.entries(p.etat.calques)) {
    assert.equal(v, false, `le calque \`${nom}\` du bloc plat est allumé sous le drapeau`)
  }
  assert.equal(p.etat.isoBtn, true, 'le bouton isométrie est resté caché')
  assert.equal(p.etat.mapCorner, true, 'le coin cartographie (aérien · base · shuffle) est resté caché')
  assert.equal(p.etat.cineBtn, false, 'le bouton cinéma est rallumé sous le drapeau — aller simple sous le sol')
})

test('② DRAPEAU BAISSÉ : rien ne change, boutons et maillage suivent le MÊME booléen', () => {
  const p = poseurDePapier(false)
  p.poser(true)
  // ⚠️ le ciné compris : l'exception du §3 est bornée au drapeau
  assert.deepEqual(
    { m: p.etat.maillage, i: p.etat.isoBtn, c: p.etat.cineBtn, k: p.etat.mapCorner },
    { m: true, i: true, c: true, k: true },
  )
  p.poser(false)
  assert.deepEqual(
    { m: p.etat.maillage, i: p.etat.isoBtn, c: p.etat.cineBtn, k: p.etat.mapCorner },
    { m: false, i: false, c: false, k: false },
  )
})

test('② l’ORBITE éteint les boutons, drapeau levé COMME baissé', () => {
  for (const drapeau of [true, false]) {
    const p = poseurDePapier(drapeau)
    p.poser(false)
    assert.equal(p.etat.isoBtn, false, `boutons allumés hors surface (drapeau ${drapeau})`)
    assert.equal(p.etat.mapCorner, false)
  }
})

// ═══════════════════════════════════════ ③ le câblage de `main.js`, LU

test('③ `poserVisibiliteSocle` consomme la loi et ne borne plus rien elle-même', () => {
  const i = MAIN.indexOf('function poserVisibiliteSocle(')
  assert.ok(i > 0, '`poserVisibiliteSocle` a disparu ou changé de nom')
  const corps = MAIN.slice(i, MAIN.indexOf('\n}', i))
  const code = corps.replace(/\/\/[^\n]*/g, '') // le corps CITE le drapeau en prose
  assert.ok(/const vue = visibiliteSurface\(\{ terreUnique: terreUniqueBranchee, surface: v \}\)/.test(code),
    'la loi n’est pas appelée : le bornage est reparti en clair dans `main.js`')
  // ⛔ **PLUS AUCUN SECOND BORNAGE.** C'est la ligne `if (terreUniqueBranchee) v = false`
  // qui a effacé les boutons ; la laisser à côté de la loi ferait deux vérités.
  assert.ok(!/terreUniqueBranchee/.test(code.replace(/visibiliteSurface\(\{[^}]*\}\)/, '')),
    '`terreUniqueBranchee` est encore lu dans le corps, hors de l’appel à la loi')
})

test('③ les trois boutons reçoivent `vue.boutons`, le maillage reçoit `vue.socle`', () => {
  const i = MAIN.indexOf('function poserVisibiliteSocle(')
  const corps = MAIN.slice(i, MAIN.indexOf('\n}', i)).replace(/\/\/[^\n]*/g, '')
  assert.ok(/terrain\.mesh\.visible = vue\.socle/.test(corps), 'le maillage ne suit pas `vue.socle`')
  for (const b of ['isoBtn', 'mapCorner']) {
    assert.ok(new RegExp(b + '\\?\\.setVisible\\(vue\\.boutons\\)').test(corps),
      `\`${b}\` ne suit pas \`vue.boutons\` — il est encore accroché au maillage`)
  }
  // ⛔ **ET LE CINÉ SUIT SA PROPRE RÉPONSE** — §3 de la loi, mesuré.
  assert.ok(/cineBtn\?\.setVisible\(vue\.cine\)/.test(corps),
    '`cineBtn` ne suit pas `vue.cine` : il est rallumé sous le drapeau')
  // et AUCUN des trois ne reçoit encore la grandeur du maillage
  for (const b of ['isoBtn', 'cineBtn', 'mapCorner']) {
    assert.ok(!new RegExp(b + '\\?\\.setVisible\\((v|vue\\.socle)\\)').test(corps),
      `\`${b}\` reçoit encore la visibilité du bloc plat`)
  }
})

test('③ LE COMPTE DES LECTEURS — la garde de CLASSE, pas de cas particulier', () => {
  // ⛔ **LES MUTATIONS M11 ET M12 SURVIVAIENT, ET C'EST CE TEST QUI LES TUE.**
  // La relecture a montré qu'on pouvait rebrancher `labels.visible` ou
  // `clouds.setVisible` de `vue.socle` sur `vue.boutons` — donc rallumer un
  // calque du bloc PLAT par-dessus le crop — **sans qu'un seul test ne rougisse**.
  // Seul `terrain.mesh.visible` était gardé, un calque sur quatorze.
  //
  // ⚠️ **LE TROU PRÉEXISTAIT, MAIS LA TÂCHE R1 EN A ÉLARGI LA SURFACE** : avant
  // elle il n'y avait qu'une variable dans cette fonction, il y en a maintenant
  // trois, et deux des trois sont la mauvaise réponse pour un calque de socle.
  //
  // ⚠️ **UN COMPTE, PAS UNE LISTE.** Vérifier nommément les quatorze calques
  // laisserait passer le quinzième, ajouté demain sur la mauvaise grandeur. Le
  // compte, lui, rougit sur toute redistribution — dans les deux sens : muter un
  // lecteur de `vue.socle` vers `vue.boutons` fait 10/3 au lieu de 11/2.
  const i = MAIN.indexOf('function poserVisibiliteSocle(')
  assert.ok(i > 0)
  // on retire les commentaires : le corps CITE les trois noms en prose, et une
  // assertion qui compterait les citations serait rouge sur une correction de
  // style et verte sur un calque rebranché.
  const corps = MAIN.slice(i, MAIN.indexOf('\n}', i)).replace(/\/\/[^\n]*/g, '')
  // ⚠️ **LA BORNE DE MOT N'EST PAS COSMÉTIQUE — D16-b l'a payée.** Sans elle,
  // `compte('carto')` compte AUSSI `vue.cartouche` (D16-c) et rend 2 pour un
  // seul lecteur. Deux champs dont l'un préfixe l'autre suffisent à rendre ce
  // compte — la seule garde de CLASSE de cette fonction — silencieusement faux.
  const compte = (n) => (corps.match(new RegExp('vue\\.' + n + '\\b', 'g')) || []).length
  // ⚠️ **HUIT, ET NON ONZE : TROIS REDISTRIBUTIONS VOULUES SE SONT CROISEES.**
  //   · D16-c : `groundInfo` est passe de `vue.socle` a `vue.cartouche` ;
  //   · D16-b : `mapLayers` est passe de `vue.socle` a `vue.carto`, parce que
  //     les calques de carte ont quitte la scene du bloc plat : ils sont poses
  //     sur la sphere (`monde/sol-globe.js`) ;
  //   · R20 : `clouds` est passe de `vue.socle` a `vue.nuages`, pour la MEME
  //     raison — le volume a quitte la scene du bloc plat et pend d'un groupe
  //     que `sceneGlobe` adopte (`monde/nuages-globe.js`). Mesure : force
  //     visible dans l'ancienne scene, l'ecart a l'ecran valait 0,000 / 0,000.
  // ⚡ **ET CETTE GARDE A FAIT SON TRAVAIL** : R20 a d'abord rebranche le
  // lecteur SANS toucher a ce compte, et les quatre assertions de forme plus
  // ce compte ont rougi ensemble. C'est la seule chose qui separe une
  // redistribution voulue d'un calque de bloc plat rallume par accident.
  // ⚡ **SEPT, ET NON HUIT : UNE QUATRIEME REDISTRIBUTION VOULUE — Tache R24.**
  //   · R24 : `labels` (les COTES D'ALTITUDE, curseur « Points cotes ») est
  //     passe de `vue.socle` a `vue.reperes`, pour la MEME raison que les trois
  //     ci-dessus — le groupe a quitte la scene du bloc plat et pend d'un groupe
  //     d'ancrage (`groupeCotes`) que `sceneGlobe` adopte. Mesure :
  //     `.banc/R24/avant.json`, cinq altitudes de 18 km a 730 m, La Reunion,
  //     `cotes.total = 14` et `groupeVisible = false` AUX CINQ.
  // ⚡ **ET CETTE GARDE A FAIT SON TRAVAIL UNE FOIS DE PLUS** : R24 a rebranche
  // le lecteur, et ce compte a rougi avant que rien ne soit ecrit ici.
  assert.equal(compte('socle'), 7,
    `${compte('socle')} lecteurs de \`vue.socle\` au lieu de 7 -- un calque du bloc plat a change de grandeur`)
  assert.equal(compte('reperes'), 1,
    `${compte('reperes')} lecteur de \`vue.reperes\` au lieu de 1 (labels seul -- les sommets sont du DOM, pas un calque de cette fonction)`)
  assert.equal(compte('nuages'), 1,
    `${compte('nuages')} lecteur de \`vue.nuages\` au lieu de 1 (clouds seul)`)
  assert.equal(compte('cartouche'), 1,
    `${compte('cartouche')} lecteur de \`vue.cartouche\` au lieu de 1 (groundInfo seul)`)
  assert.equal(compte('boutons'), 2,
    `${compte('boutons')} lecteurs de \`vue.boutons\` au lieu de 2 (isoBtn et mapCorner)`)
  assert.equal(compte('cine'), 1,
    `${compte('cine')} lecteur de \`vue.cine\` au lieu de 1 (cineBtn seul)`)
  assert.equal(compte('carto'), 1,
    `${compte('carto')} lecteur de \`vue.carto\` au lieu de 1 (mapLayers seul)`)
  // et la fonction ne lit RIEN d'autre que la loi : pas de quatrième grandeur
  // improvisée à côté.
  assert.equal((corps.match(/vue\.\w+/g) || []).length, 9 + 2 + 1 + 1 + 1,
    'un champ de `vue` autre que `socle`, `boutons`, `cine`, `cartouche` et `carto` est lu dans le corps')
})

test('③ LE RELAIS DE MODE — sans lui les boutons survivent à l’orbite (mutation M5)', () => {
  // ⛔ **LA MUTATION M5 SURVIVAIT : supprimer cette ligne laissait les quatre
  // boutons `display:flex` EN MODE ORBITAL, mesuré à l'écran, sans qu'un seul
  // test ne rougisse.** Le troisième correctif de ② était livré sans garde.
  //
  // ⚠️ **UNE ASSERTION DE TEXTE SUFFIT CONTRE UNE SUPPRESSION**, et c'est le seul
  // outil disponible : aucun test de ce dépôt ne charge `main.js`. Elle ne
  // protégerait pas d'une réécriture du corps — c'est pourquoi la grandeur du
  // repos, elle, a été extraite en module (`monde/grandeur-repos.js`) ; ici il
  // n'y a pas de corps à extraire, seulement un appel à ne pas perdre.
  const i = MAIN.indexOf('    setSurfaceVisible(v) {')
  assert.ok(i > 0, '`setSurfaceVisible` a disparu ou changé de forme')
  const corps = MAIN.slice(i, MAIN.indexOf('\n    },', i)).replace(/\/\/[^\n]*/g, '')
  const branche = corps.slice(corps.indexOf('if (terreUniqueBranchee)'), corps.indexOf('return'))
  assert.ok(branche.length > 0, 'la branche `terre unique` de `setSurfaceVisible` a disparu')
  assert.ok(/poserVisibiliteSocle\(v\)/.test(branche),
    'le relais de mode a disparu : les boutons du bas survivront à l’orbite')
  // ⚠️ **ET IL PRÉCÈDE `veilleCrop.poserMode(v)`** : celle-ci retire le crop en
  // partant, donc l'ordre inverse poserait les boutons sur un état déjà démonté.
  assert.ok(branche.indexOf('poserVisibiliteSocle(v)') < branche.indexOf('veilleCrop.poserMode(v)'),
    'le relais des boutons doit précéder le démontage du crop')
  // ⛔ **ET IL PASSE `v`, PAS UN LITTÉRAL** — `poserVisibiliteSocle(true)` ici
  // rendrait les boutons éternels, `false` les tuerait pour toujours.
  assert.ok(!/poserVisibiliteSocle\((true|false)\)/.test(branche),
    'le relais de mode reçoit un littéral au lieu de la transition `v`')
})

test('③ LE CRÉDIT D’ORTHOPHOTO ne s’affiche pas sous une carte qui n’en porte pas', () => {
  // ⛔ **UNE MENTION DE LICENCE QUI DÉCRIT AUTRE CHOSE QUE L'ÉCRAN.** Sous le
  // drapeau, le clic sur l'aérien posait `terrain.mapUniforms.uAerialOn` à 1 —
  // sur le bloc PLAT, jamais dessiné — et « Orthophotos © IGN · NASA GIBS »
  // apparaissait quand même. `refreshOsmCredit` pose deux fois l'obligation
  // inverse dans ses propres commentaires (« only while it is »).
  //
  // ⛔⛔ **CE TEST EXIGEAIT LE TEXTE DE LA GARDE — ET LE TEXTE EST DEVENU FAUX.**
  // Il assertait `if (aerialAttribution && !terreUniqueBranchee) …` mot pour
  // mot. La Tâche R9 a branché la photo aérienne SUR LA DÉCOUPE : la prémisse de
  // cette garde (« sous `terre unique` l'orthophoto n'est jamais à l'écran ») est
  // tombée, et l'assertion de texte s'est mise à **verrouiller la régression** —
  // elle rougissait sur la correction juste. C'est la classe de défaut la plus
  // coûteuse de ce chantier, prise par l'autre bout : d'ordinaire le grep laisse
  // passer une mutation, ici il interdisait la réparation.
  //
  // ⚠️ **CE QUI SE VÉRIFIE ICI DÉSORMAIS, C'EST LE COMPORTEMENT** — « le crédit
  // décrit-il ce qui est peint ? » — et il vit dans une loi EXÉCUTÉE,
  // `monde/credit-orthophoto.js`, gardée par `test/credit-orthophoto.test.js`.
  // Il ne reste ici que ce qu'aucune loi ne peut porter : que `main.js`
  // l'APPELLE, et qu'il ne pousse pas l'attribution à côté.
  const i = MAIN.indexOf('function refreshOsmCredit()')
  assert.ok(i > 0, '`refreshOsmCredit` a disparu ou changé de nom')
  const corps = MAIN.slice(i, MAIN.indexOf('\n}', i)).replace(/\/\/[^\n]*/g, '')
  assert.ok(/creditOrthophoto\(\{/.test(corps),
    '`refreshOsmCredit` n’appelle plus la loi du crédit d’orthophoto')
  // ⚠️ **ET IL LUI PASSE LES TROIS ENTRÉES VIVANTES**, pas des littéraux : un
  // `peinte: true` en dur rendrait la loi verte et l'écran menteur.
  assert.ok(/terreUnique: terreUniqueBranchee/.test(corps), 'le drapeau n’est plus passé à la loi')
  assert.ok(/attribution: aerialAttribution/.test(corps), 'l’attribution n’est plus passée à la loi')
  assert.ok(/peinte: orthophotoPeinteSurLeCrop\(globe\?\.uniforms\)/.test(corps),
    'l’état PEINT n’est plus lu sur le globe vivant — le crédit ne décrirait plus l’écran')
  // ⚠️ **ET UN SEUL SITE LE POUSSE** — deux écritures d'une obligation de licence
  // dont une seule peut suivre un changement de source, c'est la faute que
  // `SOL_LICENCE` a déjà coûtée à ce fichier.
  assert.equal((corps.match(/parts\.push\(creditAerien\)/g) || []).length, 1,
    'le crédit d’orthophoto est poussé depuis plusieurs endroits')
  assert.equal((corps.match(/parts\.push\(aerialAttribution\)/g) || []).length, 0,
    'l’attribution est poussée en direct, en court-circuitant la loi')
})

test('③ LE CRÉDIT EST RESYNCHRONISÉ QUAND LE CROP PREND LA PHOTO — sinon la correction ne s’affiche jamais', () => {
  // ⛔ **LA COURSE DE LA TÂCHE K ter, SUR LE CRÉDIT.** `refreshAerialCore` pose
  // la mosaïque sur le socle puis appelle `refreshOsmCredit` — à cet instant, le
  // globe ne l'a PAS encore : `veilleCrop` la lui donne à l'image SUIVANTE. Sans
  // cette resynchronisation, le crédit serait calculé sur un crop vierge et rien
  // ne le redemanderait : la mention resterait absente pendant que la photo est à
  // l'écran, c'est-à-dire le défaut même qu'on répare.
  const i = MAIN.indexOf('function majSeuilSocle()')
  assert.ok(i > 0, '`majSeuilSocle` a disparu ou changé de nom')
  const corps = MAIN.slice(i, MAIN.indexOf('\nfunction ', i + 10)).replace(/\/\/[^\n]*/g, '')
  const iVeille = corps.indexOf('veilleCrop.maj(alt, dist)')
  const iSync = corps.indexOf('orthophotoPeinteSurLeCrop(globe?.uniforms)')
  assert.ok(iVeille > 0, 'la veille du crop n’est plus nourrie ici')
  assert.ok(iSync > iVeille, 'le crédit est relu AVANT que la veille pose l’habillage — il jugerait sur l’image d’avant')
  // ⚠️ **ET IL NE SE REDEMANDE QUE SUR CHANGEMENT** : `refreshOsmCredit`
  // reconstruit une chaîne et touche le DOM. Sans la garde, soixante fois par
  // seconde — la faute que `CHAMPS_HABILLAGE` évite deux lignes plus loin.
  assert.ok(/if \(peinte !== orthophotoPeinteDerniere\) \{/.test(corps),
    'le crédit est relu à chaque image, sans garde de changement')
  assert.ok(/orthophotoPeinteDerniere = peinte/.test(corps), 'la mémoire n’est pas remise à jour : la garde ne retomberait jamais')
  assert.match(MAIN, /let orthophotoPeinteDerniere = null/,
    'la mémoire ne part pas de `null` : la première image ne trancherait pas')
})

test('③ `main.js` importe la loi plutôt que de la réécrire', () => {
  assert.ok(/import \{ visibiliteSurface \} from '\.\/monde\/visibilite-surface\.js'/.test(MAIN),
    'la loi n’est pas importée')
})

// ══════════════════════════════════════ ④ LES REPÈRES — Tâche R18, paquet (a)
//
// > **Adrien, 2026-08-31 :** « On a plein de choses qui ne fonctionnent pas
// > encore en mode sphère. »
//
// ⛔ **« Sommets » ET « Points cotés » SONT LE §5 UNE TROISIÈME FOIS.** Les deux
// interrupteurs de la section « Repères » du panneau Carte passaient par
// `socleAffiche()`, borné à FAUX sous le drapeau : `setLabelsVisible(v && socleAffiche())`
// et `peaksLayer.update(camera, w, h, socleAffiche())`. Mesuré à l'écran
// (`.banc/R18/fige-defaut`, mouvement ambiant coupé, plancher de bruit 0,0000
// sur six relevés) : **écart moyen 0,000 et gradient 0,000** aux deux bouts de
// chaque interrupteur — l'image est identique AU BIT PRÈS.
//
// ⚡ **ET LEUR QUESTION EST CELLE DES BOUTONS, PAS CELLE DU MAILLAGE** : un
// sommet nommé se pose sur le relief qu'on regarde, et le relief qu'on regarde
// est le crop. C'est le raisonnement du §4 (cartouche) et du §5 (carto), mot
// pour mot, appliqué au troisième groupe qui l'attendait.
test('④ DRAPEAU LEVÉ, en surface : les repères (sommets, points cotés) sont ALLUMÉS', () => {
  const v = visibiliteSurface({ terreUnique: true, surface: true })
  assert.equal(v.reperes, true,
    'les sommets et les points cotés restent éteints sous la sphère — mesuré 0,000 à l’écran')
  // ⚠️ ET ILS SUIVENT LA VUE, PAS LE DRAPEAU : hors surface, personne.
  assert.equal(visibiliteSurface({ terreUnique: true, surface: false }).reperes, false,
    'les repères survivent à la sortie de la vue de surface')
  // ⚠️ SANS DRAPEAU, RIEN NE CHANGE — c'est le comportement du bloc plat.
  assert.equal(visibiliteSurface({ terreUnique: false, surface: true }).reperes, true)
  assert.equal(visibiliteSurface({ terreUnique: false, surface: false }).reperes, false)
})

test('④ LES SOMMETS ONT CHANGÉ DE PRÉDICAT, DE CAMÉRA ET D’ESPACE', () => {
  // ⚠️ **`socleAffiche()` GARDE SES LECTEURS, ET C'EST JUSTE** : les calques du
  // bloc PLAT lui appartiennent, et le bornage à faux est le geste même de la
  // Tâche I. Ce qui se vérifie ici, c'est que les sommets en sont SORTIS — et
  // qu'ils sont sortis vers le bon prédicat, la bonne caméra, le bon espace.
  const sansCommentaires = MAIN.replace(/\/\/[^\n]*/g, '')
  assert.ok(/function reperesAffiches\(\)/.test(sansCommentaires), 'le prédicat des repères n’existe pas')
  // ⚠️ **TROIS, ET NON DEUX — Tâche R24.** La définition, le lecteur des SOMMETS
  // (`peaksLayer.update`), et celui des COTES (`cotesAffichees`, qui n'est que
  // son alias de lecture : les deux interrupteurs sont côte à côte sous le même
  // titre « Repères » et répondent à la même question).
  assert.equal((sansCommentaires.match(/reperesAffiches\(\)/g) || []).length, 3,
    'le prédicat des repères n’a pas exactement ses deux lecteurs (plus sa définition)')
  // ⛔ **ET IL NE LIT PAS `veilleSocle`** — jamais nourrie sous la sphère, elle
  // reste FAUSSE pour toujours : c'est le piège n° 1 de ce chantier.
  const iPred = MAIN.indexOf('function reperesAffiches()')
  const corps = MAIN.slice(iPred, MAIN.indexOf('\n}', iPred))
  assert.ok(/globe\?\.baseYCrop != null/.test(corps),
    'le prédicat des repères ne lit pas la base du crop — s’il y a une base, il y a un bloc')

  // ⚠️ **LA CAMÉRA SUIT LA SCÈNE.** Sous la sphère, les marqueurs se projettent
  // avec `camGlobe` ; avec celle du bloc ils calculeraient sur un autre monde.
  const i = MAIN.indexOf('peaksLayer.update(')
  assert.ok(i > 0, '`peaksLayer.update` a disparu')
  const appel = MAIN.slice(i, MAIN.indexOf(')', MAIN.indexOf('poseurDesReperes()', i)) + 1)
  assert.ok(/terreUniqueBranchee \? camGlobe : camera/.test(appel),
    'les sommets sont encore projetés avec la caméra du bloc sous la sphère')
  assert.ok(/reperesAffiches\(\)/.test(appel), 'les sommets ne lisent pas le prédicat des repères')
  assert.ok(/poseurDesReperes\(\)/.test(appel), 'les sommets n’ont pas d’adaptateur bloc ↔ globe')

  // ⚡ **CE QUI RESTAIT EST FAIT — Tâche R24, et la garde change de sens.**
  // R18 avait écrit ici : « Points cotés (`labels`) est un GROUPE DE GÉOMÉTRIE
  // dans la scène du bloc plat, pas des marqueurs de DOM ; le rallumer ne
  // montrerait rien — il lui faudrait être ADOPTÉ par la scène du globe. »
  // ⛔ **CETTE ASSERTION EXIGEAIT DONC LE DÉFAUT**, exprès, pour que personne
  // ne rebranche le prédicat sans faire le relogement. Elle est retournée : on
  // exige maintenant LES DEUX ENSEMBLE, et jamais l'un sans l'autre.
  assert.ok(!/labels\.visible = v && socleAffiche\(\)/.test(MAIN),
    'les points cotés lisent encore `socleAffiche()`, borné à faux sous la sphère')
  assert.ok(/setLabelsVisible: \(v\) => poserCotesVisibles\(v\)/.test(MAIN),
    'les deux panneaux ne passent pas par le MÊME corps : deux écritures d’une loi divergent en silence')
  assert.ok(/sceneGlobe\.add\(groupeCotes\)/.test(sansCommentaires),
    'le groupe des cotes n’est PAS adopté par la scène du globe — le rallumer ne montre rien')
  // ⛔ **ET SON POSEUR EST CELUI DU DÉPÔT, PAS UN SECOND.** Une cote posée par
  // une similitude de groupe tomberait sur le plan tangent — 2,1 km d'écart à
  // z8 (`monde/frontiere-rendu.js`, table de la courbure).
  assert.ok(/poseur: poseurDesCotes\(\)/.test(sansCommentaires),
    'les cotes n’ont pas d’adaptateur bloc ↔ globe')
})
