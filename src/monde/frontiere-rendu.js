// LA FRONTIÈRE DE RENDU — Tâche 1b bis du plan « globe continu »
// (`docs/superpowers/plans/2026-08-08-globe-continu.md`).
//
// ══════════ LE PROBLÈME, EN DEUX NOMBRES ════════════════════════════════════
//
// Le globe est une **sphère de rayon `R_GLOBE` = 100 centrée à l'origine**
// (`geo.js`). Le bloc est une **dalle de `TERRAIN_SIZE` = 56 centrée à la MÊME
// origine** (`terrain.js`). **La dalle est donc entièrement DANS la sphère.**
// Les allumer ensemble ne montre pas deux mondes qui se recouvrent : ça montre
// une planète opaque avec la carte enterrée dedans. C'est pour ça que
// `enterOrbit` éteint l'un en allumant l'autre, et c'est cet échange que les
// trois derniers fondus blancs existent pour masquer.
//
// ⚠️ **ET ON NE PEUT PAS LES REMETTRE À LA MÊME ÉCHELLE DANS UNE SEULE SCÈNE.**
// Poser le globe à l'échelle du bloc demanderait un rayon de
// `6 371 000 × span / emprise` : **68 unités à z4** et **139 600 à z15** —
// float32 mort, exactement le défaut que le repère relatif `150f817` a corrigé
// pour le bloc.
//
// ⚠️ **UNE CORRECTION EN PASSANT, ET ELLE EST REJOUÉE CONTRE LE DÉPÔT.** Le plan
// commente le cas z4 par *« la dalle (56) est plus grande que la planète »* :
// **à la lettre c'est faux** (68 > 56). Ce qui est vrai, et que le test ⑤ mesure,
// c'est que **posée tangente à une sphère de rayon 68, une dalle de 56 a ses
// bords EN DEHORS de la sphère** — le bloc dépasserait de la silhouette de sa
// propre planète. La conclusion du plan tient, sa phrase non.
//
// ══════════ LA SOLUTION : UNE SIMILITUDE, PAS UNE SCÈNE COMMUNE ═════════════
//
// Deux passes de rendu. Le globe garde SON espace (sphère de rayon 100) et sa
// PROPRE caméra ; le bloc garde le sien. Ce module ne fabrique qu'une chose : la
// **similitude** qui envoie l'espace du bloc sur l'espace du globe, et qui
// transporte donc la caméra de l'un vers l'autre.
//
//     M = translation(P₀) ∘ rotation(R) ∘ homothétie(k)
//
//   · `P₀` — le point de la sphère au centre géographique du bloc ;
//   · `R`  — la rotation qui envoie le repère du bloc (+x est, +y haut, +z sud)
//     sur le repère local de la sphère en ce point. Le repère du bloc est
//     **exactement** (est, haut, sud), donc sa matrice est l'IDENTITÉ et `R` se
//     réduit à la base locale du globe. C'est vérifié dans le test, pas supposé.
//   · `k`  — le nombre d'unités-globe par unité-bloc.
//
// **Ce que la similitude donne gratuitement, et qui était l'Étape 2 de la
// tâche :** la caméra de fond a le MÊME champ de vision et le MÊME rapport
// d'image que la principale, et une similitude conserve les angles. **La
// planète est donc vue sous exactement le même angle apparent que le bloc
// montre son emprise**, sans qu'aucun facteur ne soit à régler. Ce qui reste
// différent — et qui doit l'être — c'est la COURBURE : le bloc est plat, la
// planète est ronde, et l'écart entre les deux EST l'horizon.
//
// ══════════ ⚠️ LE FACTEUR `k` PORTE L'ÉCHELLE HORIZONTALE, JAMAIS LA
//            VERTICALE — ET C'EST LE SEUL NOMBRE QUE CETTE TÂCHE TRANCHE ══════
//
// L'Étape 2 du plan annonçait : *« c'est là que le facteur `exagération(z)` du
// point 1 se paiera ou se réglera — les deux tâches se croisent sur ce seul
// nombre »*. Voici la réponse, et elle est arithmétique.
//
// `echelleBloc({extentMeters, span, exageration}) = (span / extent) × exageration`
// est l'échelle **VERTICALE** : c'est elle qui convertit `camera.position.y` en
// mètres, et c'est pour ça qu'`altitudeSurfaceM` (l'altimètre de la Tâche 1a)
// porte l'exagération. Mais ce que la caméra de fond doit reproduire, c'est la
// **largeur de sol vue**, qui ne dépend que de l'échelle **HORIZONTALE**
// `span / extent`.
//
//     k = (extent / span) / ORBITAL_M_PER_UNIT          ← horizontale
//     altitude de fond = camY / (span / extent)         = altitudeSurfaceM × exagération
//
// ⚠️ **PRENDRE L'ALTITUDE DE L'ALTIMÈTRE À LA PLACE RÉTRÉCIRAIT LA PLANÈTE D'UN
// FACTEUR `exagération(z)` — de ×2,5 à ×5 selon le palier** (table d'Adrien :
// `{3: 2,5 · 4: 2,5 · 5: 5 · 6: 4 · 7: 3,2 · 2,8 ensuite}`). C'est **le résidu
// ×3,635 mesuré par la Tâche 1b** (`exagération / pente d'arrivée`), et le fond
// est le seul endroit du chantier où il ne se discute pas : l'exagération est un
// parti pris VERTICAL sur le relief du bloc, elle n'a aucune raison de déformer
// la planète. **Une mutation du test échange les deux et doit tuer.**
//
// ⚠️ **CE MODULE NE SAIT RIEN DE `THREE`, DE LA SCÈNE NI DU COMPOSITEUR** —
// c'est ce qui le rend testable sous node, là où `src/main.js` n'est chargé par
// aucun test (§0 du plan). Il rend des tableaux de nombres ; le branchement
// three.js vit dans `main.js` et n'a, lui, d'autre filet que l'œil.

import { R_GLOBE, ORBITAL_M_PER_UNIT } from '../geo.js'

const D2R = Math.PI / 180

// ══════════ 1. LE REPÈRE LOCAL DE LA SPHÈRE ═════════════════════════════════
//
// `latLonToSphere` (geo.js) : pôle nord +Y, longitude 0 vers +Z, 90°E vers +X.
// On en dérive la base locale par différentiation, pas à la main.
//
// ⚠️ **L'ORDRE EST (est, haut, sud) ET IL N'EST PAS ARBITRAIRE** : c'est celui
// du bloc, dont `geo.js` écrit la convention noir sur blanc — *« World axes: +x
// east, +z south, y up »*. Les deux bases sont directes (est × haut = sud), donc
// `R` est bien une rotation et non une réflexion. Le test le vérifie.
export function repereGlobe(lat, lon) {
  const la = lat * D2R
  const lo = lon * D2R
  const sla = Math.sin(la), cla = Math.cos(la)
  const slo = Math.sin(lo), clo = Math.cos(lo)
  return {
    est: [clo, 0, -slo],
    haut: [cla * slo, sla, cla * clo],
    sud: [sla * slo, -cla, sla * clo],
  }
}

// La rotation du bloc vers le globe, en matrice 3×3 rangée par COLONNES —
// c'est-à-dire l'image des axes du bloc. `THREE.Matrix4.makeBasis(x, y, z)`
// attend exactement ça.
export function rotationVersGlobe(lat, lon) {
  const { est, haut, sud } = repereGlobe(lat, lon)
  return { colonneX: est, colonneY: haut, colonneZ: sud }
}

// ══════════ 2. LE FACTEUR D'ÉCHELLE ═════════════════════════════════════════
//
// Combien d'unités-globe vaut UNE unité-bloc. `extentMeters / span` = mètres par
// unité-bloc (HORIZONTAL, voir l'en-tête) ; `ORBITAL_M_PER_UNIT` = mètres par
// unité-globe.
export function facteurEchelle({ extentMeters, span }) {
  if (!(extentMeters > 0) || !(span > 0)) return 0
  return extentMeters / span / ORBITAL_M_PER_UNIT
}

// L'ALTITUDE QUE LA CAMÉRA DE FOND OCCUPE, EN MÈTRES. C'est `camY` divisé par
// l'échelle HORIZONTALE — donc `altitudeSurfaceM × exagération`. Elle est ici
// pour être mesurable et mutable, pas parce que la pose en aurait besoin : la
// similitude la produit toute seule.
export function altitudeFondM({ camY, extentMeters, span }) {
  if (!(extentMeters > 0) || !(span > 0)) return 0
  return (camY * extentMeters) / span
}

// ══════════ 3. LA POSE DE LA CAMÉRA DE FOND ═════════════════════════════════
//
// `positionBloc` et `quaternionBloc` sont ceux de la caméra principale, dans
// l'espace du bloc. On rend la position et le quaternion de la caméra de fond,
// dans l'espace du globe.
//
// ⚠️ **L'APPROXIMATION EST CELLE DU PLAN TANGENT, ET ELLE N'EST PAS PETITE À
// TOUS LES ZOOMS — C'EST LA COURBURE DE LA TERRE, ET ELLE APPARTIENT AU BLOC,
// PAS À CETTE FRONTIÈRE.** On pose le bloc sur le plan tangent en `P₀` au lieu
// de l'enrouler sur la sphère ; l'écart au sol vaut `d² / 2R`. Calculé, et
// re-mesuré par le test (`test/frontiere-rendu.test.js`, ⑦) :
//
//   | niveau | demi-emprise | le bloc plat est AU-DESSUS de la sphère de |
//   |--------|--------------|--------------------------------------------|
//   | z4     | 2 618 km     | **538 km**                                  |
//   | z8     | 164 km       | **2,1 km**                                  |
//   | z10    | 41 km        | **132 m**                                   |
//   | z13    | 5,1 km       | **2,0 m**                                   |
//   | z15    | 1,3 km       | **0,13 m**                                  |
//
// ⚠️ **AUCUNE SIMILITUDE NE PEUT RÉCONCILIER UNE DALLE PLATE DE 5 235 km AVEC
// UNE SPHÈRE**, et ce n'est donc pas un réglage à trouver : c'est la dalle qui
// est plate. En pratique, aux zooms où le bloc occupe l'écran (z10 et plus fin),
// l'écart est sous le mètre-texel du globe ; aux zooms continentaux, le bord du
// bloc surplombe la planète et **ça se verra à l'horizon**. C'est écrit ici pour
// qu'on ne le découvre pas à l'écran en croyant à un bogue de raccord.
export function poseFond({ lat, lon, positionBloc, quaternionBloc, extentMeters, span }) {
  const k = facteurEchelle({ extentMeters, span })
  const { est, haut, sud } = repereGlobe(lat, lon)
  const [bx, by, bz] = positionBloc
  const position = [0, 1, 2].map(
    (i) => haut[i] * R_GLOBE + k * (bx * est[i] + by * haut[i] + bz * sud[i])
  )
  return {
    position,
    quaternion: multiplieQuaternion(quaternionDeBase(est, haut, sud), quaternionBloc),
    k,
  }
}

// ══════════ 4. LES PLANS DE LA CAMÉRA DE FOND ═══════════════════════════════
//
// ⚠️ **`camera.far` NE FUSIONNE PAS — ET CETTE TÂCHE EST L'ENDROIT OÙ LE PLAN
// DISAIT « ICI OU NULLE PART ».** La réponse est : **nulle part, et il n'y a
// plus rien à fusionner.** L'Étape 1 bis de la Tâche 1b avait montré qu'aucun
// `far` unique ne satisfait les deux mondes (surface 290, orbite 1 400) sans
// desserrer le plan lointain du bloc de 290 à ≈500, c'est-à-dire dégrader son
// tampon de profondeur pour rien. Avec DEUX caméras, la question ne se pose
// plus : chacune porte les siens. Le bloc garde 290, et le fond prend de quoi
// contenir la sphère entière depuis là où il est.
//
// `far` = distance au centre + `R_GLOBE`, plus une marge : c'est le point le
// plus lointain de la sphère, quelle que soit l'altitude, y compris le limbe.
//
// ⚠️ **LE PLANCHER DE `near` N'EST PAS CELUI DE `planProche`, ET C'EST MESURÉ.**
// `planProche` (loi-altitude.js) cale `near` à **0,01 unité-globe, soit 637 m** :
// à 500 m d'altitude la caméra de fond clipperait le sol qu'elle survole. Le
// fond prend donc un plancher mille fois plus bas. **Le prix est un rapport
// `far/near` large, et il est sans conséquence ICI** : la seule chose que ce
// tampon de profondeur doit séparer, c'est l'avant de la sphère de son arrière,
// soit 200 unités d'écart — et il n'est **jamais** composé avec celui du bloc,
// puisque `main.js` efface la profondeur entre les deux passes.
export function plansFond({ position, planProcheMin = 1e-5, planProcheMax = 0.5 }) {
  const d = Math.hypot(position[0], position[1], position[2])
  const hauteur = Math.max(d - R_GLOBE, 0)
  const near = Math.min(Math.max(hauteur * 0.2, planProcheMin), planProcheMax)
  return { near, far: d + R_GLOBE + 1 }
}

// ---------------------------------------------------------------- quaternions
//
// Fabriqués à la main plutôt qu'importés de three : ce module doit rester
// chargeable sans WebGL ni scène (voir l'en-tête). La formule est celle de
// `Quaternion.setFromRotationMatrix`, sur une matrice donnée par ses colonnes.
function quaternionDeBase(cx, cy, cz) {
  const m00 = cx[0], m10 = cx[1], m20 = cx[2]
  const m01 = cy[0], m11 = cy[1], m21 = cy[2]
  const m02 = cz[0], m12 = cz[1], m22 = cz[2]
  const trace = m00 + m11 + m22
  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1)
    return [(m21 - m12) * s, (m02 - m20) * s, (m10 - m01) * s, 0.25 / s]
  }
  if (m00 > m11 && m00 > m22) {
    const s = 2 * Math.sqrt(1 + m00 - m11 - m22)
    return [0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s]
  }
  if (m11 > m22) {
    const s = 2 * Math.sqrt(1 + m11 - m00 - m22)
    return [(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s]
  }
  const s = 2 * Math.sqrt(1 + m22 - m00 - m11)
  return [(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s]
}

function multiplieQuaternion(a, b) {
  const [ax, ay, az, aw] = a
  const [bx, by, bz, bw] = b
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ]
}
