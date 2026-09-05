#!/usr/bin/env bash
# GX3 — LES TESTS MORDENT-ILS ? Cinq mutations du produit, chacune restaurée à
# l'octet (md5 avant / après). Pour chaque mutation : quels fichiers de test
# rougissent, et combien de tests. Une mutation que rien ne rougit est un trou.
set -u
cd "$(dirname "$0")/.."
TESTS="test/gpx-chemin-ruban.test.js test/drone-cam.test.js test/butee-sol.test.js test/gpx-scene-globe.test.js test/gpx-adoption-scene.test.js test/gpx-pose-globe.test.js test/visibilite-surface.test.js test/gpx-layers.test.js test/gpx.test.js test/sol-globe.test.js"
FICHIERS="src/main.js src/gpx.js src/gpx-layers.js src/monde/sol-globe.js src/drone-cam.js"
md5 () { for f in $FICHIERS; do md5sum "$f"; done; }
AVANT=$(md5)
resume () { # $1 = nom
  local out; out=$(node --test $TESTS 2>&1)
  local pass fail; pass=$(echo "$out" | grep -E '^(ℹ|#) pass' | awk '{print $3}'); fail=$(echo "$out" | grep -E '^(ℹ|#) fail' | awk '{print $3}')
  # ⚠️ le rapporteur par défaut de `node --test` est `spec`, PAS `tap` : un test
  # rouge s'y écrit « ✖ nom (durée) », jamais « not ok N - nom ». Le filtre
  # d'origine (`^not ok`) ne trouvait donc rien et écrivait « — » sur CHAQUE
  # ligne, y compris pour les mutations qui rougissaient (le compte `fail`, lui,
  # était juste). Corrigé par GX7 : sans le nom du test, « ça mord » n'est pas
  # vérifiable — on ne sait pas QUELLE garde a mordu.
  local rouges; rouges=$(echo "$out" | grep -oE '^✖ .*' | sed -E 's/^✖ //; s/ \([0-9.]+ms\)$//' | cut -c1-64 | head -12 | tr '\n' '|')
  echo "  $1 : pass $pass · fail $fail · rouges : ${rouges:-—}"
}
restaure () { git checkout -- $FICHIERS; local APRES; APRES=$(md5); [ "$AVANT" == "$APRES" ] && echo "  restauré à l'octet (md5 identiques)" || { echo "  ⛔ MD5 DIFFÉRENTS"; exit 1; }; }

echo "── témoin (produit intact)"; resume "intact"

echo "── M1 : la similitude retirée (poseTableauEnPlace rend le tableau tel quel)"
sed -i 's/^  if (!poseur?.globe) return positions$/  return positions/' src/monde/sol-globe.js
grep -c '^  return positions$' src/monde/sol-globe.js >/dev/null && resume "M1" ; restaure

echo "── M2 : l'adoption de scène retirée dans main.js (gpxLayer.poserScene(sceneGlobe))"
sed -i 's/^  gpxLayer\.poserScene(sceneGlobe)$/  \/\/ gpxLayer.poserScene(sceneGlobe)/' src/main.js
resume "M2" ; restaure

echo "── M3 : la visibilité rebranchée sur vue.socle"
sed -i 's/gpxLayer\.setVisible(vue\.reperes \&\& params\.gpxVisible)/gpxLayer.setVisible(vue.socle \&\& params.gpxVisible)/' src/main.js
resume "M3" ; restaure

echo "── M4 : la fabrique de poseur n'est plus transmise au calque AJOUTÉ ENSUITE (gpx-layers.js addLayer)"
sed -i 's/^    if (this\._faitPoseur) gpx\.poserFabricantDePoseur(this\._faitPoseur)$/    \/\/ mutation M4/' src/gpx-layers.js
resume "M4" ; restaure

echo "── M5 : le ruban ne passe plus par _versScene (gpx.js, sommets laissés en bloc)"
sed -i 's/new Float32Array(this\._versScene(r\.positions))/new Float32Array(r.positions)/' src/gpx.js
resume "M5" ; restaure

echo "── M6 : la caméra du globe n'est plus déposée (gpxPoseGlobe.setCamera)"
sed -i 's/^  gpxPoseGlobe\.setCamera(camGlobe)$/  \/\/ mutation M6/' src/main.js
resume "M6" ; restaure

echo "── M7 : le sol lu sur le bloc au lieu du globe (_sol ignore le poseur)"
sed -i 's/^    return this\._poseur ? this\._poseur\.hauteur(x, z) : (this\.terrain?\.sample?\.(x, z) ?? 0)$/    return this.terrain?.sample?.(x, z) ?? 0/' src/gpx.js
resume "M7" ; restaure

echo "── M8 : le ruban repasse AVANT le voile nuageux (renderOrder 6, GX6 ①)"
sed -i 's/^    this\.ruban\.renderOrder = 6 + ORDRE_VOILE + ro$/    this.ruban.renderOrder = 6 + ro/' src/gpx.js
resume "M8" ; restaure

echo "── M9 : le recalage de la visée retiré (la tête peut rester derrière la caméra, GX6 ②)"
sed -i 's/^    if (_look\.lengthSq() > 1e-12 \&\& _look\.dot(_fwd) <= 0) this\._viseDisp\.copy(head)$/    \/\/ mutation M9/' src/drone-cam.js
resume "M9" ; restaure

echo "── M10 : le redressement au sol recombat le vol de poursuite (GX6 ③)"
sed -i 's|^  if (drone\.active \&\& params\.gpxFollow \&\& gpxLayer\.isPlaying()) return$|  // mutation M10|' src/main.js
resume "M10" ; restaure

git diff --stat -- src/ | tail -1
echo "diff src vide : $([ -z "$(git diff -- src/)" ] && echo OUI || echo NON)"
