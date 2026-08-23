// LA VISIBILITÉ DE SURFACE — Tâche R1 ② du plan « LE STUDIO SUR LE GLOBE »
// (`docs/superpowers/plans/2026-08-22-globe-studio.md`).
//
// Module PUR : ni DOM, ni three.js, et il n'importe RIEN. Tout se vérifie sous
// node (`test/visibilite-surface.test.js`).
//
// ══════════ POURQUOI CE FICHIER EXISTE ══════════════════════════════════════
//
// **Adrien, 2026-08-23 :** « Il me manque les boutons du bas en UI, ils ont
// disparu (shuffle, affichage photographie aérienne...) »
//
// ⛔ **`poserVisibiliteSocle` CONFONDAIT DEUX QUESTIONS SOUS UN SEUL BOOLÉEN.**
// Elle borne son argument à faux sous `terre unique` — ce qui est JUSTE, et
// c'est même tout le geste de la Tâche I : le maillage du bloc plat est opaque
// et se dessine après la passe de fond, donc le laisser vivre remettrait une
// seconde Terre par-dessus la première. Puis elle passait **ce même booléen
// borné** aux trois boutons du bas, qui n'ont rien à voir avec ce maillage.
//
//   · `v` répond à **« le maillage du bloc plat est-il dessiné »** — sous le
//     drapeau, la réponse est NON, à toutes les altitudes.
//   · Les boutons répondent à **« sommes-nous en vue de surface, devant un
//     bloc »** — sous le drapeau, la réponse est OUI. C'est simplement un
//     autre bloc : un crop découpé dans la planète.
//
// Le commentaire posé à côté d'`isoBtn` le disait déjà lui-même — *« the
// isometric shortcut only makes sense over the block »*. Il y a un bloc.
//
// ⚠️ **CE N'ÉTAIT PAS UNE EXCEPTION SILENCIEUSE, ET C'EST CE QUI L'A RENDUE
// INVISIBLE À LA RELECTURE.** Les trois boutons sont construits sans condition
// (`main.js`, `buildCineButton` / `buildIsoButton` / `buildMapCorner`) et sans
// `try` : rien n'échouait, rien ne se plaignait. C'est la classe `.off`, qui
// fait `display:none` (`src/ui/v28.css`), qui les effaçait — sur ordre.
//
// ⚠️ **ET C'EST POUR ÇA QUE LA LOI VIT ICI PLUTÔT QUE DANS `main.js`** : **aucun
// test de ce dépôt ne charge `main.js`**. Une garde écrite là-bas ne serait
// tenue que par des assertions d'expression régulière sur le texte source — et
// ce chantier a déjà vu une mutation survivre à 4 082 tests derrière exactement
// cette protection-là.
//
// ══════════ 3. POURQUOI LES PLANS DE CINÉMA SONT LA SEULE EXCEPTION ═════════
//
// ⛔ **`cineBtn` EST ÉTEINT SOUS LE DRAPEAU, ET CE N'EST PAS UN ARBITRAGE DE
// GOÛT — C'EST UNE RÉGRESSION MESURÉE, SANS RETOUR.** Relevé le 2026-08-23 dans
// un Chrome sans tête à 284 appels de rendu par seconde
// (`.banc/R1-tour2/cine.json`, captures `01`…`04`), drapeau levé, premier plan :
//
//   | moment | `camera.position.y` | altitude de cadrage | distance |
//   |---|---|---|---|
//   | vue posée sur le crop | 72,72 | 17 761 m | 145,50 |
//   | pendant le plan | **−7,26** | **−1 773 m** | 12,55 |
//   | après `shots.stop()` | **−2,27** | **−555 m** | 12,41 |
//   | +6 s, +12 s après l'arrêt | **−2,27** | **−555 m** | 12,41 |
//
// **Ni `shots.stop()` ni le huitième clic ne rendent la vue.** Le huitième clic
// laisse la caméra à `y = 20,51`, altitude 5 010 m, distance 29,95 — au lieu de
// 145,50 (`.banc/R1-tour2/huit-clics.json`). La capture `04-apres-stop-12s.png`
// montre l'écran douze secondes après l'arrêt : un mur d'eau, la caméra est
// **dans la mer du crop**, et elle y reste.
//
// ⛔ **UNE PREMIÈRE VERSION DE CETTE TÂCHE A ÉCRIT « c'est réversible, la caméra
// revient à `y = 77,1`, distance 145,5 ». CE RELEVÉ N'EST PAS REPRODUCTIBLE** —
// deux exécutions, deux sorties différentes, aucune ne rendant la vue. Il a été
// retiré partout. Un bouton visible qui envoie l'utilisateur sous le sol sans
// retour est une régression livrée, pas une fonctionnalité manquante.
//
// **LA CAUSE, POUR CELUI QUI LE REBRANCHERA** : `shots` est construit dans
// `main.js` avec `sampleGround: (x, z) => terrain.sample?.(x, z) ?? 0` — le champ
// de hauteurs du bloc **plat**, celui qui n'est plus dessiné. `camera-shots.js`
// respecte scrupuleusement son plancher (`plancher()`, `altitudeDeSecurite()`) ;
// c'est le plancher d'un autre monde. ➡️ **Donner aux plans un `sampleGround` de
// GLOBE, puis retirer cette exception** — et pas l'inverse.

/**
 * Qui est visible en surface, et à quel titre.
 *
 * ⚠️ **UN SEUL POINT DE DÉCISION, DEUX RÉPONSES.** Rendre les deux ensemble est
 * délibéré : deux fonctions séparées se rebrancheraient un jour l'une sur
 * l'autre, et c'est précisément l'accident qu'on répare.
 *
 * @param {object} arg
 * @param {boolean} arg.terreUnique le drapeau `?terre=unique` est-il branché —
 *   c'est-à-dire le bloc plat a-t-il cédé la place à une découpe dans la
 *   planète. ⚠️ **Il ne gouverne QUE le maillage**, jamais l'interface.
 * @param {boolean} arg.surface sommes-nous en vue de surface, devant un bloc —
 *   ce que l'automate du seuil décide, avant tout bornage.
 * @returns {{socle: boolean, boutons: boolean, cine: boolean}} `socle` pour le
 *   maillage du bloc plat et les quatorze calques qui lui appartiennent ;
 *   `boutons` pour ce qui ne dépend que d'être en vue de surface — le raccourci
 *   isométrique et le coin cartographie (aérien · base · shuffle) ; `cine` pour
 *   les plans de cinéma, qui ont en plus besoin d'un plancher, et n'en ont pas
 *   sous le drapeau (voir §3).
 */
export function visibiliteSurface({ terreUnique, surface }) {
  const s = !!surface
  return {
    // ⚠️ **LE BORNAGE RESTE, ET IL N'EST PAS NÉGOCIABLE** : sans lui il y a deux
    // Terres, et l'écran est rigoureusement celui d'avant le chantier.
    socle: terreUnique ? false : s,
    // ⚠️ **ET IL NE DÉBORDE PAS SUR L'INTERFACE.** Sous le drapeau, il y a un
    // bloc devant nous — c'est un crop, mais c'en est un.
    boutons: s,
    // ⛔ **SAUF LES PLANS DE CINÉMA, ET C'EST UNE RÉGRESSION MESURÉE, PAS UN
    // ARBITRAGE.** Voir le §3 ci-dessus : sous le drapeau, ce bouton est un
    // aller simple sous le sol.
    cine: terreUnique ? false : s,
  }
}
