# Relecture — Tâche K · LA CONTINUITÉ DE TEXTURE

**Diff jugé** : `6fba7dd..92b8da6` (5 fichiers, 859 insertions, 4 suppressions — confirmé
identique avec et sans `--ignore-cr-at-eol`, aucun faux diff CRLF).

**Méthode** : worktree dédié `C:/Dev/wt-relecK` épinglé sur `92b8da6`, et un second worktree
`C:/Dev/wt-relecK-mut` pour rejouer la campagne de mutation et casser des tests sans toucher à
`C:\Dev\wt-merge`. **Les deux ont été retirés (`--force`) en partant** — `git worktree list`
ne les porte plus. Aucun fichier modifié dans `wt-merge` hormis ce rapport.

## Verdict global

**CONFORMITÉ ✅.** La mesure est réelle, reproductible à la main depuis les JSON, et le témoin
à 0 pixel est une preuve (pas un banc mort — les variantes changent 0,05 % à 42 % de l'image
selon le terme). Le correctif fait ce qu'il annonce, `uMppFacteur = 0` restitue le texte GLSL
du dépôt au caractère près (verrouillé par test), le fov est lu en direct (vérifié dans le code
ET par test), et D5 est intact. La campagne de mutation (37/37) se rejoue à l'identique. Les
réserves du rapport sont honnêtes et confirmées par les captures — rien n'y est enjolivé. Deux
lacunes de couverture réelles trouvées par mutation de mon cru (§④), toutes deux bornées au
chemin `?terre=unique` et sans risque pour la production.

## Décompte par gravité

- Critique : 0
- Important : 2
- Mineur : 1

## Constats

### Important — deux mutations de branchement de mon cru survivent dans `main.js`

J'ai posé trois mutations sémantiques ciblant le branchement de `majLoiTextureMonde` (non
présentes dans `.banc/mutations-K.mjs`) :

- **B** — `hauteurPx: _tailleDessin.y` → `_tailleDessin.x` (largeur au lieu de hauteur) :
  **SURVIT** (33/33 verts). Aucun test ne vérifie QUEL axe du tampon est lu, seulement que
  `getDrawingBufferSize` est appelé et que `clientHeight`/`innerHeight` ne le sont pas. Sur un
  cadre non carré (le cas général), cette mutation fausserait `mppEcran` d'un facteur
  `largeur/hauteur` sans qu'aucun test ne le voie.
- **C** — `lat: Number.isFinite(ancre?.lat) ? ancre.lat : 0` → `lat: 0` (latitude toujours
  forcée à l'équateur) : **SURVIT** (33/33 verts). Aucun test ne vérifie que `ancre.lat` est
  effectivement transmis ; le `cos(lat)` de `resolutionRefM` deviendrait silencieusement faux
  à toute latitude non nulle (La Réunion, −21,115°, y compris).

  (Une troisième mutation, **A** — `const cam = frontiereActive ? camGlobe : camera` →
  `const cam = camera` — survit aussi, mais je l'ai vérifiée ÉQUIVALENTE : `majCameraFond()`,
  appelée juste avant dans `tick()`, pose `camGlobe.fov = camera.fov` à chaque image, donc les
  deux caméras portent toujours le même fov en pratique. Ce n'est pas un trou.)

Ces deux lacunes sont réelles mais **bornées au chemin `?terre=unique`** : `uMppFacteur = 0`
hors drapeau reste garanti par un test dédié, donc la production n'est pas exposée. C'est
exactement le motif que le §0 du plan nomme « la faiblesse répétée de ce chantier » (couverture
de branchement incomplète) — reproduit ici, à signaler avant la tâche suivante plutôt qu'à
bloquer celle-ci.

### Mineur — « configuration par défaut » est une formule trop large

Rapport §⑤.7 : *« Tout le poste `minFade` est donc multiplié par zéro dans la configuration
par défaut. »* Or `DEFAULT_LOOK.contourOpacity` vaut **0,5** dans le dépôt (`main.js:358`), pas
0 — le `uContourOpacity = 0` mesuré vient du template chargé pour le banc, pas de la config par
défaut de l'app. Le fait mesuré est vrai (confirmé : `20/30/40/41-*-mesures.json` montrent tous
`minFade.fracTouchee = 0` avant que les courbes soient rallumées à 0,5) ; c'est la généralisation
« configuration par défaut » qui est en trop. N'affecte aucune conclusion du rapport.

## Ce qui a été vérifié et confirmé conforme

- **① La mesure** — recalculée à la main depuis `.banc/vues-K/90-duo.json` et
  `E0-avant-apres.json` : les quatre lignes du tableau (23,5/41,0 · 42,0/28,8 · 1,9/1,8 ·
  0,05/0,21), les colonnes d'amplitude, le ×1,74, et le tableau fracPlate (38,4→24,9 ·
  36,0→14,3, y compris le 0,3838→0,3835 du grain) **retombent tous exactement** sur
  `nadir_est05/iso_est05` et `nadir_est00/iso_est00` de `90-duo.json`. Le témoin (`temoinZero`)
  vaut 0 dans les quatre sous-objets, et les variantes changent réellement des centaines de
  milliers de pixels : preuve, pas banc mort. `20-` et `30-nadir-mesures.json` sont bien des
  itérations antérieures cassées (témoin à 92,86 % dans `30`, à cause du grain de pellicule
  animé) — exactement le piège n°2 que le rapport avoue en §⑥, pas une preuve maquillée : elles
  sont à bon droit absentes de la liste de traces du §⑦, qui ne cite que les fichiers dont les
  chiffres publiés dépendent réellement, et j'ai vérifié que c'est bien le cas.
- **② Les sept `fwidth`** — les sept sites recomptés dans `src/globe.js` (decodeMetersAA `:717`,
  bordure du crop `:854`, côte `:1015`, mineure `:1023`, majeure `:1044`, minFade `:1072`,
  graticule `:1082`). La garde de `fwidth(landness)` est bien `uHabOn > 0.5 && uCoastMaskOn >
  0.5` (deux uniformes), et ce bloc est situé AVANT le hunk touché par le diff — non modifié,
  comme annoncé.
- **③ Le correctif** — `vProfCam` est un varying posé depuis `-mv.z` (profondeur, pas
  `length()` — testé hors-axe par ④c-bis, qui distingue bien les deux écritures) ;
  `uMppFacteur` vient de `2 tan(fov/2) × m/hauteurPx` ; le fov canonique `FOV_DEG = 30`
  (`seuil-socle.js:193`) est bien ignoré au profit de `cam?.fov ?? camera.fov`, et
  `camGlobe.fov = camera.fov` est resynchronisé à chaque image par `majCameraFond()` — donc 33
  en pratique, conforme au §0 du plan. `uMppFacteur = 0` fait strictement retomber `texel` sur
  `texelTuile` et `grainP` sur `vUv * 941.7 + vLatLon`, verrouillé au caractère près par les
  tests ④f/④g.
- **④ La mutation** — campagne rejouée à l'identique dans un worktree isolé :
  **37/37 tuées**, aucun survivant, arbre propre après coup. Le bench vit bien dans `.banc/`
  (`mutations-K.mjs`, `serveur-vues-K.mjs`), pas dans un scratchpad.
- **⑤ D5** — `terrain.js`, `plinth.js`, `ocean.js` absents du diff ; le seul ajout dans
  `main.js` est l'insertion pure de `majLoiTextureMonde()` + son appel dans `tick()`, aucune
  ligne du chemin bloc classique n'est touchée.
- **⑥ Le non-fait** — vérifié par capture :
  - `E1-coin-haut-gauche-avant/apres.png` : l'arête diagonale visible avant a bien disparu
    après, remplacée par un aplat vert continu. Description du rapport fidèle, pas enjolivée.
  - `E2-iso55-coin-haut-droite-avant/apres.png` : visuellement identiques, patchwork de plaques
    droites (triangle marine, rectangles olive/bleu, trait orange) intact des deux côtés —
    confirme « mon correctif n'y change rien ».
  - `F0-tel-que-livre-45deg.png` : relief de l'île net et détaillé, plateau environnant plat et
    mosaïqué — cohérent avec « le relief se lisait déjà bien, tout ce qui l'entoure reste une
    mosaïque ».
  - `40-nadir-telquel.png` : les plaques diagonales translucides du défaut neuf sont nettement
    visibles, pas minimisées.
  - `G1-drapeau-baisse-planete.png` : un aplat uni, pas une image de la planète entière —
    confirme que la preuve « drapeau baissé » est bien présentée comme indirecte, pas déguisée
    en couverture complète.
  - Réserve #6 (59,6 %/58,1 % d'écart, fracPlate quasi stable 0,3867→0,3872 et
    0,3753→0,3747) : retombe exactement sur `E0-avant-apres.json`.
- **⑦ Casse neuve** — trois tests cassés au hasard (④h en dupliquant un `fwidth`, ⑤e en
  déplaçant l'appel après `globe.update`, ②b en recopiant la circonférence en dur) échouent
  tous les trois avec un diagnostic précis et exploitable (pas un échec muet). Aucun
  `console.log`/scaffolding (`uKminFade` etc.) resté dans `src/`.

## Notes de méthode

- `npm run audit:tests` → 203/203, aucun écart — reproduit.
- `npm test` complet lancé dans le worktree isolé : 3717 tests, 3716 verts, 1 échec —
  **échec non imputable à la Tâche K** (`test/occupation-sol.test.js`, `ENOENT` sur
  `public/data/sol/index.json`, un fichier de données généré et gitignoré absent d'un
  `worktree add` frais, pas du dépôt de production où le rapport a tourné). Le chiffre
  3717/3717 du rapport est donc plausible et cohérent avec le +33 tests observé.
- Brief complémentaire `brief-Kbis.md` lu : confirme que le report des réserves de la Tâche K
  (rampe re-mesurée, `h==0` en branche terre) est repris mot pour mot comme point de départ de
  la tâche suivante — cohérence inter-tâches vérifiée, pas de sujet passé sous silence.
