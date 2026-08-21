// L'AUDIT DU SOLIDE — Tâche 5 du plan « globe continu »
// (`docs/superpowers/plans/2026-08-08-globe-continu.md`).
//
// Module PUR : ni DOM, ni three.js, ni fetch, ni import. Il prend des nombres
// et rend un verdict. Tout se vérifie sous node (`test/audit-solide.test.js`).
//
// ══════════ 0. POURQUOI CE FICHIER EXISTE ═══════════════════════════════════
//
// Il passe AVANT `fenetre-bornee.js` (Tâche 6) parce que sans lui, on n'a aucun
// moyen de savoir si l'extraction marche. ⚠️ **Le prototype s'est cru étanche
// pendant tout son vol avec un instrument aveugle**, et son appareil de preuve
// ne valait presque rien (§4 du plan) :
//
//   · ses « 231 audits topologiques » étaient UN SEUL — ils portaient sur un
//     tableau d'indices écrit une fois au constructeur ;
//   · son test d'étanchéité n'utilisait QU'UN ANGLE, sous lequel il ne voit ni
//     une dalle retournée — le bug même qu'il dit avoir attrapé — ni une dalle
//     absente, ni un mur entier manquant ;
//   · un trou de 128×128 mailles (1,78 km, la moitié de la fenêtre) rendait
//     ZÉRO PIXEL de trou, le socle occupant 0,66 % du cadre ;
//   · un audit d'arêtes annonce « 0 bord libre » sur un solide RETOURNÉ, et il
//     a raison : retourner un solide ne crée aucun bord libre ;
//   · **un test de silhouette passe À VIDE** si l'objet est hors cadre.
//
// D'où les deux partis pris de ce module : AUCUN RENDU — trois mesures
// arithmétiques en une passe — et **la vacuité est un verdict à part entière**.
//
// ⚠️ **LE PLAN ANNONÇAIT « ENVIRON 10 ms » : C'EST DEUX FOIS TROP OPTIMISTE.**
// Mesuré sur cette machine, banc de `test/audit-solide.test.js` :
// **22,8 ms à n = 384** (`RES_FENETRE_CONTINUE`, 592 896 triangles) et
// **118 ms à n = 768** (`RES_REPOS_MAX`, 2 365 440 triangles). C'est un
// instrument de test et de mise au point, **pas un contrôle par image**.
//
// ══════════ 1. L'INVARIANT — Ā, ET POURQUOI CE N'EST PAS LE VOLUME ══════════
//
// ⚠️ **DEUX VERSIONS DU PLAN ONT PRESCRIT UNE MESURE INSUFFISANTE, ET LA
// SECONDE ÉTAIT AUSSI FAUSSE QUE LA PREMIÈRE.** L'histoire est courte et elle
// justifie tout ce fichier :
//
//   ① « volume signé recentré + dégénérés + NaN », annoncé « 6 sabotages
//      détectés sur 6 ». **Rejoué au banc : trois passent pour sains** — dalle
//      absente (+7,35), mur manquant (+7,95), et un trou couvrant UN QUART DE
//      LA SURFACE (+9,18 contre 9,568 pour le sain, soit −4 % seulement).
//      Le volume d'un maillage ouvert reste positif et plausible.
//      ✅ **REJOUÉ ICI, sur le banc de `test/audit-solide.test.js`** (n = 256,
//      côté 56, profondeur 7, trou de 128×128 mailles) — le plan disait vrai :
//        | sabotage       | volume | écart au sain | ‖Ā‖/aire |
//        | sain           | 29 934 |    0,0 %      | 5,6e-19  |
//        | dalle absente  | 23 494 |  −21,5 %      | 5,75e-1  |
//        | mur manquant   | 24 654 |  −17,6 %      | 7,05e-2  |
//        | trou de 25 %   | 28 693 |   **−4,1 %**  | 1,01e-1  |
//      **Les trois rendent un volume POSITIF**, et le trou d'un quart de nappe
//      ne coûte que 4,1 % — l'ordre de grandeur d'un relief un peu différent.
//      Aucun seuil de volume ne peut le distinguer ; Ā le voit à 1,01e-1, soit
//      **cent millions de fois son seuil**.
//   ② « le volume signé autour de DEUX origines », sans dire lesquelles :
//      l'origine du monde laisse passer deux sabotages sur trois.
//   ③ « une origine oblique » : **exactement aveugle** à un trou de 25 % dès
//      que le décalage est mal orienté.
//
// **La raison est structurelle et se démontre.** Pour deux origines O₁ et O₂ :
//
//     V(O₂) − V(O₁) = −(O₂ − O₁) · Ā       où Ā = Σ_faces (aire orientée)
//
// L'écart s'annule **quand le décalage est orthogonal à Ā**, et **aucune
// amplitude ne répare une mauvaise direction**. Les deux origines n'étaient
// qu'un mauvais sondage de Ā : autant mesurer Ā.
//
// **Ā EST L'INVARIANT.** Somme des vecteurs-aires orientés de toutes les faces,
// soit ½ Σ (b−a)×(c−a). **Sur un solide fermé elle vaut exactement zéro, quelle
// que soit l'origine** — c'est le théorème de la divergence appliqué au champ
// constant. Un mur manquant, une dalle absente ou un trou donnent une Ā non
// nulle **proportionnelle à la surface qui manque**. Plus d'origine à choisir,
// plus de direction aveugle, plus de seuil à deviner.
//
// ⚠️ **ET LE VOLUME SIGNÉ RESTE, EN PLUS** : lui seul attrape le **solide
// retourné**, dont la Ā est nulle (retourner toutes les faces change le signe
// de chaque terme d'une somme déjà nulle). Les deux mesures sont
// complémentaires, aucune ne remplace l'autre.
//
// ══════════ 2. LES TROIS SEUILS, ET CE QU'ILS ATTRAPENT ═════════════════════
//
// ⚠️ **UN SEUIL SE FIXE SUR LE PLUS PETIT DÉFAUT QU'ON VEUT ATTRAPER, ET IL
// S'ÉCRIT.** L'écart de fermeture n'est pas un seuil en soi : il est
// PROPORTIONNEL à l'aire du défaut (68,4 % pour un trou de 25 % de la surface,
// 1,3 % pour 0,4 %).
//
//   · `EPS_FERMETURE = 1e-9` — ‖Ā‖ < 1e-9 × aire totale.
//     **LE PLUS PETIT DÉFAUT VISÉ : UN SEUL TRIANGLE DE LA FENÊTRE LA PLUS
//     FINE (n = 768).** C'est le plus petit défaut qu'un rééchantillonnage
//     puisse produire sans être par ailleurs dégénéré. Mesuré (banc du §1,
//     n = 768, côté 56, profondeur 7, 2 365 440 triangles) :
//        · un triangle retiré  → ‖Ā‖/aire = 3,22e-7 = **322 × le seuil**
//        · une maille retirée  → ‖Ā‖/aire = 6,65e-7 = **665 × le seuil**
//        · le solide sain      → ‖Ā‖/aire = 1,73e-19, soit **10 ordres SOUS**
//     Entre 1,73e-19 et 3,22e-7, le seuil de 1e-9 est logé au milieu de dix
//     ordres de grandeur vides : il n'y a rien à régler finement.
//   · `EPS_DEGENERE = 1e-12` — aire de triangle < 1e-12 × côté².
//     ✅ Valeur du plan, **vérifiée et non devinée** : à n = 768 le plus petit
//     triangle sain de la fenêtre mesure 2,66e-3 pour un seuil de 3,14e-9, soit
//     **5,9 ordres de grandeur de marge** — les « six ordres » annoncés.
//   · `EPS_VOLUME = 1e-12` — |V| < 1e-12 × côté³ : le volume est trop petit
//     pour que son SIGNE veuille dire quelque chose, et l'orientation devient
//     indécidable (`oriente: null`) plutôt que fausse.
//
// ══════════ 3. CE QUI EST FAIT POUR QUE LA MESURE NE MENTE PAS ══════════════
//
//   · **Le NaN est cherché EN PREMIER.** Un seul empoisonne la boîte
//     englobante, donc les seuils, donc le volume, donc le verdict. Quand il y
//     en a un, l'audit ne rend AUCUN verdict calculé : `ferme` et `oriente`
//     valent `null`, pas `false`.
//   · **Sommation compensée (Neumaier) sur les quatre accumulateurs.**
//     ⚠️ **CE COMMENTAIRE A D'ABORD ANNONCÉ QUE LA SOMMATION NAÏVE ÉTAIT « DU
//     MÊME ORDRE QUE LE SEUIL ». MESURÉ, C'EST FAUX** — la borne pessimiste
//     N·ε·aire ≈ 5e-10 ne se réalise pas : sur le solide sain à n = 768, la
//     naïve rend **4,44e-16** contre **1,73e-19** compensée, quand le seuil
//     vaut 1e-9. **Les deux passeraient.** Le gain mesuré est un facteur 2 570,
//     pour un surcoût mesuré de **5,8 ms par 3 millions de termes** (9,2 contre
//     3,4 ms).
//     **Elle est gardée quand même, et c'est un choix, pas une mesure :** le
//     banc a des coordonnées régulières dont les termes s'annulent presque deux
//     à deux dans l'ordre de parcours ; une fenêtre rééchantillonnée depuis des
//     hauteurs float32 quelconques n'a pas cette régularité, et l'audit sert
//     précisément à ne pas avoir à se demander si sa propre arithmétique tient.
//     Il tourne hors boucle de rendu.
//   · **Les arêtes sont prises relativement à `a`** — (b−a)×(c−a) et non
//     b×c − … : les coordonnées d'une fenêtre sont loin de l'origine, et la
//     forme naïve perdrait la moitié des chiffres significatifs.
//   · Un seul produit vectoriel par triangle sert **aux trois mesures** :
//     l'identité (a−c₀)·((b−a)×(c−a)) = det[a−c₀, b−c₀, c−c₀] est exacte.
//
// ══════════ 4. LE CONTRAT D'APPEL — UNE COQUE À LA FOIS ═════════════════════
//
// ⚠️ **LE PLAN N'A JAMAIS DIT QUELLE COQUE ON AUDITE, ET LA QUESTION A ÉTÉ
// POSÉE TROIS FOIS.** La réponse est ici : **UNE COQUE À LA FOIS.** Le socle
// réel en porte deux — les parois et le liner de `plinth.js`. Concaténées, Ā et
// V s'ADDITIONNENT : le défaut de l'une peut être annulé par celui de l'autre,
// et un test le démontre (`test/audit-solide.test.js`, ⑦). Auditez `walls`,
// puis le liner, et lisez deux verdicts.
//
// ══════════ 5. CE QUE CET AUDIT NE VOIT PAS — ÉCRIT AVANT QU'ON LE DÉCOUVRE ═
//
//   · **Deux défauts qui se compensent exactement** : deux trous d'aires
//     orientées opposées (§4). C'est la limite de toute mesure intégrale.
//   · **Les auto-intersections et le non-manifold** : un maillage replié sur
//     lui-même a une Ā nulle et un volume positif. Ā mesure la FERMETURE, pas
//     la simplicité.
//   · **Les faces en double** : deux copies d'une même face doublent son aire
//     mais laissent Ā inchangée si elles sont co-orientées.
//   · **Le relief lui-même** : un solide fermé et orienté peut être un PAVÉ
//     DROIT. C'est le piège de la Tâche 6, et c'est pourquoi ce module rend
//     `hauteurs` (§6).
//
// ══════════ 6. LE DISCRIMINANT QUE LA TÂCHE 6 ATTEND ════════════════════════
//
// ⚠️ **`construireFenetre` seule rend une boîte à hauteurs nulles, fermée et
// orientée PAR CONSTRUCTION** : elle passerait l'audit cent fois sans que le
// rééchantillonnage — la raison d'être de la tâche — soit touché par une seule
// assertion. Le verdict de solidité ne peut pas distinguer les deux : c'est un
// pavé droit PARFAITEMENT SAIN.
//
// D'où `hauteurs = { min, max, amplitude, distinctes, plafonnees }`, relevé sur
// l'axe vertical. **Un pavé droit rend `distinctes: 2`** (le dessus et la
// dalle) ; un maillage rééchantillonné en rend autant que son relief a de
// valeurs. L'assertion qui mord, côté Tâche 6, est `hauteurs.distinctes > 2`.
// Le comptage est plafonné à `PLAFOND_HAUTEURS` — à n = 768 il y aurait 1,2
// million de valeurs, et l'ensemble coûterait plus cher que tout l'audit.

// ══════════ 7. LA CAMPAGNE DE MUTATION — CE QUI TIENT VRAIMENT ══════════════
//
// Douze mutations passées sur ce fichier, **douze tuées**. Elles sont listées
// ici parce que trois d'entre elles ont SURVÉCU au premier tour, et que ce sont
// celles-là qui ont appris quelque chose :
//
//   ① fermeture désarmée · ② seuil de fermeture absolu · ③ orientation sur
//   |V| · ⑤ epsilon de dégénérescence à zéro · ⑥ NaN non cherché ·
//   ⑦ la géométrie vide se déclare saine · ⑧ verdicts de vacuité à `false` au
//   lieu de `null` · ⑨ indices hors bornes ignorés · ⑩ hauteurs rendues
//   constantes — **tuées du premier coup**.
//
//   ④ **volume non recentré** · ⑪ **sommation naïve** · ⑫ **aire du triangle
//   au facteur 2** — **ONT SURVÉCU.** Les trois sont des mutations qui ne
//   changent AUCUN verdict sur un solide proche de l'origine : le volume signé
//   est indépendant de l'origine en arithmétique exacte, la naïve reste six
//   ordres sous le seuil, et doubler toutes les aires divise l'écart de
//   fermeture par deux sans franchir dix ordres de marge. **Il a fallu trois
//   assertions à valeur fermée** pour les tuer : l'aire totale vaut exactement
//   2·côté² + 4·côté·profondeur, le volume du solide plat vaut exactement
//   côté²·profondeur, et un solide **translaté de 1e9** rend le même volume à
//   1e-13 près (mesuré sans recentrage : 1,4e-9 ; sans compensation non plus :
//   4,2e-8). ⚠️ **Un test qui n'a que des tolérances larges ne protège pas
//   l'arithmétique de l'instrument, et un instrument est fait de son
//   arithmétique.**

/** Fermeture : ‖Ā‖ < EPS_FERMETURE × aire totale. Voir le §2. */
export const EPS_FERMETURE = 1e-9

/** Dégénérescence : aire du triangle < EPS_DEGENERE × côté². Voir le §2. */
export const EPS_DEGENERE = 1e-12

/** Orientation indécidable : |V| < EPS_VOLUME × côté³. Voir le §2. */
export const EPS_VOLUME = 1e-12

/** Plafond du comptage des hauteurs distinctes. Voir le §6. */
export const PLAFOND_HAUTEURS = 4096

const AXES = { x: 0, y: 1, z: 2 }

/**
 * Sommation compensée de Neumaier. Voir le §3 : sans elle, l'arrondi de la
 * somme est du même ordre que le seuil de fermeture à n = 768.
 */
function creerSomme () {
  return { s: 0, c: 0 }
}
function ajouter (acc, x) {
  const t = acc.s + x
  acc.c += Math.abs(acc.s) >= Math.abs(x) ? (acc.s - t) + x : (x - t) + acc.s
  acc.s = t
}
const total = (acc) => acc.s + acc.c

/**
 * Extrait le tableau de positions d'une entrée. Accepte un tableau brut, un
 * `BufferGeometry` de three.js (sans l'importer), ou un objet `{ positions }`.
 * ⚠️ Rend `null` — jamais une exception — quand il n'y a rien : la vacuité est
 * un verdict, pas une panne.
 */
function extrairePositions (geometrie) {
  if (!geometrie) return null
  if (ArrayBuffer.isView(geometrie) || Array.isArray(geometrie)) return geometrie
  const attr = geometrie.attributes?.position
  if (attr?.array) return attr.array
  if (geometrie.positions) return extrairePositions(geometrie.positions)
  if (geometrie.position) return extrairePositions(geometrie.position)
  if (geometrie.array) return extrairePositions(geometrie.array)
  return null
}

function extraireIndices (indices, geometrie) {
  const brut = indices ?? geometrie?.index?.array ?? geometrie?.index ?? geometrie?.indices ?? null
  if (!brut) return null
  if (ArrayBuffer.isView(brut) || Array.isArray(brut)) return brut
  if (brut.array) return brut.array
  return null
}

function verdictVide (raison, sommets = 0, triangles = 0) {
  return {
    vide: true,
    nan: false,
    ferme: null,
    oriente: null,
    degeneres: null,
    sain: false,
    raison,
    sommets,
    triangles,
    indicesInvalides: 0,
    aireTotale: 0,
    aireMin: null,
    aireOrientee: { x: 0, y: 0, z: 0 },
    normeAireOrientee: 0,
    fermetureRelative: null,
    volume: 0,
    volumeRelatif: null,
    boite: null,
    hauteurs: null,
    seuils: null,
  }
}

/**
 * Audite UNE coque (§4) : fermeture, orientation, dégénérés, NaN, vacuité.
 *
 * @param {object} entree
 * @param {ArrayLike<number>|object} entree.geometrie positions xyz, ou un
 *   `BufferGeometry`. ⚠️ **Deux arguments, pas un** : `construireFenetre` rend
 *   `geometrie` et `indices` SÉPARÉMENT.
 * @param {ArrayLike<number>} [entree.indices] triplets d'indices. Absent, la
 *   géométrie est lue comme une soupe de triangles.
 * @param {'x'|'y'|'z'} [entree.axeHauteur] axe du relevé de hauteurs (défaut y).
 * @returns {object} le verdict — voir le §6 pour `hauteurs`.
 */
export function auditerSolide (entree) {
  const arg = (entree && (ArrayBuffer.isView(entree) || Array.isArray(entree)))
    ? { geometrie: entree }
    : (entree || {})
  const { geometrie, indices, axeHauteur = 'y' } = arg
  const axe = AXES[axeHauteur]
  if (axe === undefined) throw new Error(`axeHauteur inconnu : ${axeHauteur}`)

  const pos = extrairePositions(geometrie)
  if (!pos || pos.length === 0) return verdictVide('aucun sommet : il n\'y a rien à auditer')
  if (pos.length % 3 !== 0) throw new Error(`positions de longueur ${pos.length} : ce n'est pas un multiple de 3`)
  const sommets = pos.length / 3

  const idx = extraireIndices(indices, geometrie)
  if (idx && idx.length % 3 !== 0) throw new Error(`${idx.length} indices : ce n'est pas un multiple de 3`)
  const nbIndices = idx ? idx.length : pos.length / 3
  const triangles = nbIndices / 3
  if (triangles === 0) return verdictVide('aucun triangle : il n\'y a rien à auditer', sommets)

  // ─── ① LE NaN, EN PREMIER (§3) ───────────────────────────────────────────
  let nombreNaN = 0
  for (let i = 0; i < pos.length; i++) if (!Number.isFinite(pos[i])) nombreNaN++
  if (nombreNaN > 0) {
    const v = verdictVide(`${nombreNaN} coordonnée(s) non finie(s) : tout verdict calculé dessus serait empoisonné`, sommets, triangles)
    v.vide = false
    v.nan = true
    v.nombreNaN = nombreNaN
    return v
  }

  // ─── ② LA BOÎTE ENGLOBANTE, ET LES SEUILS QUI EN DÉCOULENT ───────────────
  let minX = Infinity, minY = Infinity, minZ = Infinity
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity
  for (let v = 0; v < pos.length; v += 3) {
    const x = pos[v], y = pos[v + 1], z = pos[v + 2]
    if (x < minX) minX = x; if (x > maxX) maxX = x
    if (y < minY) minY = y; if (y > maxY) maxY = y
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z
  }
  const cote = Math.max(maxX - minX, maxY - minY, maxZ - minZ)
  if (!(cote > 0)) {
    const v = verdictVide('boîte englobante de côté nul : tous les sommets sont confondus', sommets, triangles)
    v.vide = true
    return v
  }
  const centre = [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2]
  const seuilDegenere = EPS_DEGENERE * cote * cote
  const seuilVolume = EPS_VOLUME * cote * cote * cote

  // ─── ③ LA PASSE UNIQUE : Ā, aire, volume, dégénérés ──────────────────────
  const ax = creerSomme(), ay = creerSomme(), az = creerSomme()
  const vol = creerSomme()
  const aire = creerSomme()
  let degeneres = 0
  let indicesInvalides = 0
  let aireMin = Infinity

  for (let t = 0; t < nbIndices; t += 3) {
    let ia, ib, ic
    if (idx) { ia = idx[t]; ib = idx[t + 1]; ic = idx[t + 2] } else { ia = t; ib = t + 1; ic = t + 2 }
    if (!(ia >= 0 && ia < sommets && ib >= 0 && ib < sommets && ic >= 0 && ic < sommets)) {
      indicesInvalides++
      continue
    }
    const a = ia * 3, b = ib * 3, c = ic * 3
    const ax0 = pos[a], ay0 = pos[a + 1], az0 = pos[a + 2]
    // arêtes relatives à `a` : la forme qui garde les chiffres significatifs (§3)
    const e1x = pos[b] - ax0, e1y = pos[b + 1] - ay0, e1z = pos[b + 2] - az0
    const e2x = pos[c] - ax0, e2y = pos[c + 1] - ay0, e2z = pos[c + 2] - az0
    const nx = e1y * e2z - e1z * e2y
    const ny = e1z * e2x - e1x * e2z
    const nz = e1x * e2y - e1y * e2x

    const aireTri = 0.5 * Math.hypot(nx, ny, nz)
    ajouter(aire, aireTri)
    if (aireTri < seuilDegenere) degeneres++
    else if (aireTri < aireMin) aireMin = aireTri

    // Ā = ½ Σ (b−a)×(c−a)
    ajouter(ax, 0.5 * nx); ajouter(ay, 0.5 * ny); ajouter(az, 0.5 * nz)

    // V = ⅙ Σ (a−c₀)·((b−a)×(c−a)) — identité exacte avec det[a′,b′,c′] (§3)
    const dx = ax0 - centre[0], dy = ay0 - centre[1], dz = az0 - centre[2]
    ajouter(vol, (dx * nx + dy * ny + dz * nz) / 6)
  }

  const aireTotale = total(aire)
  const Ax = total(ax), Ay = total(ay), Az = total(az)
  const normeA = Math.hypot(Ax, Ay, Az)
  const volume = total(vol)

  if (!(aireTotale > 0)) {
    const v = verdictVide('aire totale nulle : tous les triangles sont dégénérés', sommets, triangles)
    v.degeneres = degeneres
    return v
  }

  const seuilFermeture = EPS_FERMETURE * aireTotale
  const fermetureRelative = normeA / aireTotale
  const ferme = normeA < seuilFermeture
  const volumeRelatif = volume / (cote * cote * cote)
  const oriente = Math.abs(volume) < seuilVolume ? null : volume > 0

  // ─── ④ LE RELEVÉ DES HAUTEURS — le discriminant de la Tâche 6 (§6) ───────
  let hMin = Infinity, hMax = -Infinity
  const quantum = cote * 1e-9
  const vues = new Set()
  let plafonnees = false
  for (let v = axe; v < pos.length; v += 3) {
    const h = pos[v]
    if (h < hMin) hMin = h
    if (h > hMax) hMax = h
    if (!plafonnees) {
      vues.add(Math.round(h / quantum))
      if (vues.size >= PLAFOND_HAUTEURS) plafonnees = true
    }
  }

  const sain = !nombreNaN && indicesInvalides === 0 && ferme && oriente === true && degeneres === 0

  return {
    vide: false,
    nan: false,
    nombreNaN: 0,
    ferme,
    oriente,
    degeneres,
    sain,
    raison: sain ? null : raisonDuRefus({ ferme, oriente, degeneres, indicesInvalides }),
    sommets,
    triangles,
    indicesInvalides,
    aireTotale,
    aireMin: Number.isFinite(aireMin) ? aireMin : null,
    aireOrientee: { x: Ax, y: Ay, z: Az },
    normeAireOrientee: normeA,
    fermetureRelative,
    volume,
    volumeRelatif,
    boite: { min: { x: minX, y: minY, z: minZ }, max: { x: maxX, y: maxY, z: maxZ }, cote, centre: { x: centre[0], y: centre[1], z: centre[2] } },
    hauteurs: { min: hMin, max: hMax, amplitude: hMax - hMin, distinctes: vues.size, plafonnees },
    seuils: { fermeture: seuilFermeture, degenere: seuilDegenere, volume: seuilVolume },
  }
}

function raisonDuRefus ({ ferme, oriente, degeneres, indicesInvalides }) {
  const maux = []
  if (indicesInvalides > 0) maux.push(`${indicesInvalides} triangle(s) à indice hors bornes`)
  if (!ferme) maux.push('non fermé : ‖Ā‖ dépasse le seuil, il manque de la surface')
  if (oriente === false) maux.push('retourné : volume signé négatif')
  if (oriente === null) maux.push('orientation indécidable : volume trop petit pour avoir un signe')
  if (degeneres > 0) maux.push(`${degeneres} triangle(s) dégénéré(s)`)
  return maux.join(' · ')
}
