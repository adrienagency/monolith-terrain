// Central feature flags. The default value here is exactly what ships to
// production. OFF (false) means: skip the module's initialisation AND its UI
// section, so there are no orphan controllers and no empty panels. The
// feature's code stays in the repo — flip the flag to true to bring it back.
export const FLAGS = {
  // v39: back on — the wave engine is now the shared "ocean-waves" random
  // spectrum (ocean-lab repo), with a Sea toggle in the Effects panel, OFF by
  // default (params.waterReal). The rejected v37 Beaufort system is replaced.
  water: true,

  // FENÊTRE CONTINUE 3×3 — jalon 1, le plus petit drag qui marche.
  //
  // OFF par défaut, et ce n'est pas une précaution : à ce jalon le mode est
  // volontairement MISÉRABLE — pas d'analyse de relief, pas de masque de mer,
  // pas de trait de côte, aucun calque. Le terrain est peint à la rampe
  // d'altitude nue. Il sert à répondre à UNE question, celle du §7 de l'étude
  // 3×3 : le geste vaut-il le coup ? Rien d'autre.
  //
  // ⚠️ Il charge NEUF MNT au lieu d'un : le premier affichage est nettement
  // plus long. C'est attendu à ce jalon, pas une régression à corriger ici
  // (étude §7, signal 3).
  //
  // S'essaie par l'adresse sans rien reconstruire : `?f3=1`. Et `?f3=0` le
  // coupe, pour le jour où le défaut passera à true.
  fenetreContinue: false,
}
