# Tâche R4 — LA TRANSITION CLAQUE, ET LA CAMÉRA SE TÉLÉPORTE

> **Adrien, 2026-08-23, avec une vidéo de 39 s à l'appui :** *« J'ai toujours le
> problème de déplacement de la Terre quand je descends depuis l'orbite. **La
> Terre ne devrait ni bouger ni se recharger.** »*

C'est une **récidive**. Il avait déjà exigé, en majuscules : *« vire absolument
ton système de saut de niveau !!! »*, *« aucun saut, aucun rechargement de la
Terre »*. Une tâche (M) a été livrée là-dessus et a mesuré une descente **sans
saut de caméra**. ⚠️ **Sa mesure est bonne. Son périmètre ne l'était pas.**

---

## 1. LA PREUVE, ET ELLE EST SUR LE DISQUE

**39 images extraites de sa vidéo, une par seconde :**
`C:\Users\adrie\AppData\Local\Temp\claude\G--My-Drive--GITHUB\ed4e3ecd-eb07-4312-a4ba-d4e3ef43c3f0\scratchpad\video\t01.jpg` … `t39.jpg`

**Regarde-les avant d'ouvrir un fichier source.** Adresse filmée, lisible dans la
barre : `?terre=unique&frontiere=1&seuil=1&globe=continu&socle=quadtree&f3=0`.
**Il était donc bien sous le drapeau** — ce n'est pas un faux positif de régime.

### Ce que les images montrent, et que tu dois reproduire avant de corriger

| image | ce qu'on voit |
|---|---|
| `t23` | vue **à la verticale**, aplat vert, pas de bloc |
| `t25` | **toute la page s'assombrit — les panneaux d'interface COMPRIS** |
| `t26` | vue **rasante**, bloc en relief, scène sombre |
| `t30` | le crop, parois terracotta, caméra très basse |

⚠️ **Entre `t23` et `t26`, la caméra ne s'est pas déplacée : elle a changé de
POSE.** Verticale → rasante. C'est ça, « la caméra change de position
bizarrement ».

⚠️ **Et l'assombrissement touche l'interface HTML**, donc ce n'est **pas** un
effet de scène — c'est une surcouche au niveau de la page. **Trouve-la.**

---

## 2. CE QUI EST DÉJÀ ÉTABLI — ne le re-cherche pas

Une enquête a tracé la cause structurelle :

    seuilSocleBranche = seuilSocleActif() || terreUniqueBranchee     (main.js:4646)

⚠️ **Ce `ou` force la bascule active MÊME SANS `&seuil=1`.** Seuils
`SEUIL_NAISSANCE_M = 32 274,3 m` / `SEUIL_MORT_M = 40 342,8 m`
(`seuil-socle.js:254-262`), avec hystérésis.

Et **`uCropOn` vaut 0 ou 1** (`globe.js:962`, `2586`) : **aucun fondu**. Le crop
ne paraît pas, il surgit. `poserTout` / `retirer` (`branchement-crop.js:638-751`)
construisent et démontent toute la chaîne d'un coup.

⚠️ **La Tâche M a mesuré la CAMÉRA (`altitudeFondM`, ratio image à image), pas le
CONTENU.** Un contenu qui apparaît d'un bloc dans un repère continu reste un saut
à l'œil, et aucune de ses métriques ne pouvait le voir. **Ne refais pas sa
mesure : fais celle qui manque.**

⚠️ **Second trou connu** : sa descente partait de **1 600 km**. `MAX_ALT_M` vaut
**60 000 km**. Le segment au-dessus de 1 600 km **n'a jamais été vérifié à
l'écran**.

---

## 3. CE QU'ON ATTEND

- [ ] **Étape 1 — REPRODUIS, et filme.** Une descente instrumentée de l'orbite au
      sol, **image par image**, qui enregistre à chaque image : altitude,
      distance caméra-cible, **orientation de la caméra** (le vecteur de visée),
      `uCropOn`, `veilleCrop.pose`, et un condensé de l'image rendue.
      ⚠️ **C'est l'orientation qui manquait à la Tâche M.** Trace dans `.banc/R4/`.
- [ ] **Étape 2 — CHIFFRE LE SAUT.** À quelle image l'orientation change-t-elle,
      et **de combien de degrés** ? ⛔ **N'écris pas « ça saute » : donne l'angle
      et le numéro d'image.**
- [ ] **Étape 3 — trouve la surcouche sombre.** Elle assombrit le DOM. Un
      élément HTML ? une classe CSS ? `_whiteout` (`modes.js:574`) est déclaré
      mort sous le drapeau — **vérifie-le au lieu de le croire.**
- [ ] **Étape 4 — test rouge** sur la continuité du contenu.
- [ ] **Étape 5 — LE FONDU.** Transforme la naissance/mort du crop en
      transition continue. ⚠️ **Adrien accepte la transition** — *« si je dézoome
      en scrollant, alors là tu peux faire réapparaître le reste »* — **il refuse
      le claquement.** Un fondu croisé sur l'intervalle des deux seuils est la
      piste évidente ; **si elle ne marche pas, dis pourquoi et propose.**
- [ ] **Étape 6 — LA POSE DE CAMÉRA.** L'orientation ne doit pas sauter. ⚠️ **Si
      la cause est que les deux mondes n'ont pas la même convention de haut,
      dis-le explicitement** — c'est la sixième fois sur ce chantier qu'une
      grandeur juste est exprimée dans le mauvais repère.
- [ ] **Étape 7 — le segment jamais mesuré** : rejoue la descente **depuis
      `MAX_ALT_M`**, pas depuis 1 600 km.
- [ ] **Étape 8 — MESURE APRÈS, même instrument**, et **compare aux 39 images
      d'Adrien**. Captures dans `.banc/R4/`.
- [ ] **Étape 9 — clôture**, drapeau levé ET baissé. ⚠️ **Drapeau baissé, la
      production doit être rigoureusement inchangée.**

---

## 4. CE QUE TU NE TRAITES PAS

⛔ **Le relief absent de Z6 à Z10** (`t11` à `t23`, l'aplat olive) — **c'est la
Tâche R6**, une enquête séparée tourne dessus. ⚠️ Note : la table
`DETAIL_DEFAULTS` (`src/zoom-detail.js:16`) n'éteint le détail **que de z3 à
z6** — elle n'explique donc pas un aplat jusqu'à z9. **N'y touche pas.**

⛔ **L'éclairage** : la scène est lumineuse en orbite et nocturne sur le crop,
**à horloge identique (03h22 du début à la fin)**. Hypothèse ouverte, tâche R7.
⚠️ **Mais si ton fondu croise ces deux éclairages, tu le VERRAS** — dans ce cas,
**dis-le**, ne le corrige pas.

---

## 5. LES RÈGLES DE CE CHANTIER, PAYÉES CHER

- ⛔ **N'invente aucun chiffre.** **Vingt-neuf ont été retirés par leurs propres
  auteurs ici** — dont deux par le donneur d'ordre. « Non mesuré » est acceptable.
- ⛔ **Une assertion qui lit le TEXTE SOURCE ne prouve rien** — une mutation a
  survécu à **4 082 tests** ici pour cette raison. **Teste le COMPORTEMENT.**
- ⛔ **Un `return` muet rend un test vert et indistinguable d'un test qui a lu.**
- ⚠️ **Le grain de film est ANIMÉ** ; **un onglet caché met `camera.aspect` à
  `NaN`** (écran blanc, aucune erreur) ; **`autoClear` vaut `false`**.
- ⚡ **LE COÛT DE RENDU EST MESURABLE, ET LA MÉTHODE EXISTE MAINTENANT** — voir
  `rapport-R2.md` : rendu piloté, `gl.finish()` aux deux bouts, 40 rendus de
  chauffe jetés après chaque recompilation, ordre tournant, différences
  appariées. **Huit rapports d'affilée avaient échoué à le faire. Ne sois pas le
  neuvième.**
