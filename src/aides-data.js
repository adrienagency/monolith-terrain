// LES BULLES D'AIDE — le stock, et rien d'autre.
//
// ────────────────────────────────────────────────────────────────────────────
// AJOUTER UNE AIDE : écris un objet dans la liste ci-dessous. C'est tout.
// Aucun composant à créer, aucun CSS à toucher.
//
//   {
//     id: 'un-id-unique',            // sert de clé de stockage, jamais affiché
//     cible: () => document.getElementById('app'),   // OÙ la bulle se pose
//     pose: 'terrain-bas',           // comment elle se pose dans la cible
//     titre: 'Trois mots',           // facultatif
//     texte: 'Une ou deux phrases.', // ce qu'on fait, concrètement
//     note: 'Une précision.',        // facultatif, plus discret
//     action: 'J’ai compris',        // le bouton qui la fait taire pour de bon
//   }
//
// Puis, à l'endroit où l'option s'allume :  aides.evalue('un-id-unique', actif)
// ────────────────────────────────────────────────────────────────────────────
//
// QUATRE RÈGLES, dans l'ordre où elles comptent. Des tests les font respecter
// (test/aides.test.js) — ce ne sont pas des vœux.
//
// 1. TUTOIEMENT. ShibuMap tutoie. Un test refuse « vous » ici.
//
// 2. DIRE LE GESTE, PAS L'INTENTION. « Maintiens le clic droit » apprend
//    quelque chose ; « explore librement ton terrain » ne fait que se
//    féliciter. Une bulle qui ne contient aucun verbe d'action à faire soi-même
//    n'a pas de raison d'interrompre.
//
// 3. COURT. La bulle se pose SUR le terrain qu'elle explique : chaque ligne de
//    trop cache ce dont elle parle. Deux phrases, plafond dur à 200 signes
//    (test). Ce qui ne rentre pas n'était probablement pas nécessaire.
//
// 4. CALME. Pas d'exclamation, pas d'emoji, pas de superlatif. Cette bulle
//    apparaît sans qu'on l'ait demandée ; elle n'a pas droit en plus au ton
//    enthousiaste. Un test refuse « ! » et les emoji.
//
// ⚠️ LE PRIX D'UNE BULLE DE TROP. Chaque aide ajoutée abaisse l'attention
// portée à toutes les autres : le troisième « J'ai compris » se clique sans
// lire. N'en déclare une que pour une option dont le MODE D'EMPLOI n'est
// devinable ni par son libellé ni par un essai. Une option qu'on comprend en
// la cliquant n'a pas besoin d'aide, elle a besoin d'un bon libellé.

export const AIDES = [
  // ══════════ LE MODE CONTINU 3×3 ═══════════════════════════════════════════
  //
  // Pourquoi celle-ci mérite une bulle : le geste est INDEVINABLE. Le clic
  // gauche est déjà pris (OrbitControls, plus la plongée au point cliqué), donc
  // le glissement du terrain a hérité du clic droit — le seul bouton qui, dans
  // un navigateur, n'ouvre normalement rien d'autre qu'un menu contextuel.
  // Personne n'essaie spontanément le clic droit sur une carte 3D. Sans cette
  // phrase, l'option s'active et il ne se passe visiblement RIEN.
  //
  // Et le rappel élastique est mentionné pour une raison précise : sans lui
  // annoncé, le retour en butée se lit comme un bogue, pas comme une borne.
  //
  // ⚠️ LA NOTE DIT CE QUI A ÉTÉ DÉPLACÉ, ET ELLE N'EST PAS FACULTATIVE. Adrien
  // a essayé le mode et signalé la perte immédiatement : « l'ancien
  // déplacement par clic droit n'existe plus, je ne peux plus me déplacer de
  // cette façon. » Une aide de première activation qui annonce le geste GAGNÉ
  // en taisant le geste DÉPLACÉ est une demi-vérité : elle laisse croire à une
  // fonction perdue. Un test refuse que la note cesse de nommer le repli.
  {
    id: 'fenetre-3x3',
    cible: () => document.getElementById('app'),
    pose: 'terrain-bas',
    titre: 'Glisser le terrain',
    texte: 'Maintiens le clic droit et déplace : le terrain suit. Tu peux t’écarter d’un bloc dans chaque direction, au-delà il résiste et revient.',
    note: 'Le déplacement de caméra passe au bouton du milieu, ou à Maj + clic gauche.',
    action: 'J’ai compris',
  },
]
