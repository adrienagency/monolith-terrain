# Tâche R1 — LE REPOS SE TROMPE DE GRANDEUR, ET LES BOUTONS DE QUESTION

Deux correctifs indépendants, tous deux **entièrement diagnostiqués et mesurés**.
Ne re-diagnostique pas : vérifie, puis corrige. ⚠️ **Mais si tu trouves que le
diagnostic est faux, DIS-LE et arrête-toi** — quatorze fois sur quatorze, sur ce
chantier, l'exécutant qui a contredit son brief avait raison.

---

## ① LE REPOS SURVEILLE UNE GRANDEUR QUE L'ORBITE FAIT BOUGER

> **Adrien, 2026-08-23 :** *« À partir du moment où tu passes en mode crop, je ne
> dois plus voir autre chose que la zone croppée (…) si je modifie la hauteur de
> la caméra **sans scroller** et en me déplaçant, il ne faut pas que le reste de
> ce qui est autour du socle réapparaisse. Si je dézoome **en scrollant**, alors
> là tu peux faire réapparaître le reste. »*

### L'intention du module est déjà la bonne — c'est sa grandeur qui la trahit

`src/monde/veille-repos.js` §1 dit noir sur blanc :

> *« PAS LA POSITION DE LA CAMÉRA, PAS SON ORIENTATION. (…) Un panoramique et une
> orbite ne demandent RIEN de plus que le crop. (…) Surveiller la position ferait
> réapparaître la Terre autour à chaque glissement de souris. »*

Il a donc choisi **l'altitude au-dessus de l'ellipsoïde**, nourrie en un seul
point : `src/monde/branchement-crop.js:772`, `repos.maj(altitudeEllipsoideM)`.

### ⚡ LA MESURE — dans l'application vivante, `.banc/orbite-repos/mesure.json`

Rotation de la caméra autour de `controls.target`, **distance tenue exactement
constante** (c'est ce que fait OrbitControls sur un cliquer-glisser). 39 écarts :

| grandeur | pic d'écart logarithmique | images au-dessus de `SEUIL_BOUGE_LOG` |
|---|---|---|
| altitude au-dessus de l'ellipsoïde | **4,862 × 10⁻³** | **39 / 39** |
| distance caméra → cible | **0** | **0 / 39** |

Le seuil vaut `10⁻⁴`. ⚠️ **Une simple inclinaison le franchit 48 fois, et vaut
10,4 fois le pic du geste de molette (`4,67 × 10⁻⁴`) qui a servi à CALIBRER ce
seuil** — incliner la vue ressemble donc plus à un zoom que le zoom lui-même.

⛔ **UN TÉMOIN ANNEXE A ÉTÉ RETIRÉ DE CE BRIEF — il était faux.** Il annonçait
que **`veilleRepos.bascules` valait 46 au chargement**, là où la Tâche N en
attendait deux. Personne n'a su le reproduire : l'exécutant a relevé 1 à 3 et
s'est abstenu d'en conclure quoi que ce soit — c'était la bonne réaction — puis
la relecture l'a tranché sur un chargement propre à 57 img/s :
**2 bascules, en version altitude COMME en version distance**, et deux
navigations automatiques ne le bougent pas.

⚠️ **Et l'excuse avancée ensuite ne tient pas non plus** (« la page avait déjà
été naviguée deux fois ») : `bascules` est un compteur **monotone, jamais remis
à zéro** — `oublier()` ne touche que `precedente` et `calme` —, donc
« au chargement » ne peut pas désigner un cumul de session.

**Ce que ce retrait ne change pas : rien.** La cause était portée par la mesure
d'orbite ci-dessus, qui a été rejouée trois fois et qui tient. Trace du retrait :
`.banc/orbite-repos/mesure.json`, `CHIFFRE_RETIRE_bascules_46`.

⚠️ **Le donneur d'ordre n'a aucun privilège ici.** Un témoin annexe non reproduit
est un chiffre inventé, quel que soit celui qui l'a écrit.

### Ce qu'on attend

- [ ] **Étape 1 — refais la mesure toi-même** avant de toucher au code, et dis si
      tu retrouves les mêmes ordres de grandeur. Trace dans `.banc/R1/`.
- [ ] **Étape 2 — test rouge** sur la loi : une suite d'altitudes constantes à
      distance variable, et l'inverse.
- [ ] **Étape 3 — nourris la veille du repos avec la DISTANCE caméra↔cible**, pas
      l'altitude. ⚠️ **NE CHANGE PAS `SEUIL_BOUGE_LOG` sans mesure** : le seuil a
      été calibré sur l'écart logarithmique d'altitude d'une molette ; sur celui
      de la distance, la molette produit-elle le même écart ? **Mesure-le, et si
      le nombre doit changer, change-le AVEC sa trace** — n'en pose aucun au jugé.
- [ ] **Étape 4 — LE RISQUE PRINCIPAL, à lever avant de conclure.**
      `controls.target` est-il au même endroit dans tous les modes ? S'il saute
      du point au sol au centre de la planète lors d'une bascule, la distance
      saute avec lui et tu auras remplacé un faux positif par un autre.
      **Mesure la continuité de la distance sur une descente complète**, de
      l'orbite au sol. ⚠️ Si elle est discontinue, **dis-le et propose** — ne
      livre pas en espérant.
- [ ] **Étape 5 — corrige le §1 et le §3 du commentaire du module.** Ils
      argumentent longuement pour l'altitude ; ils doivent maintenant porter la
      mesure qui les réfute. ⚠️ **Et corrige explicitement le principe faux** :
      *« trois automates qui décident sur la même image doivent décider sur le
      même nombre »*. C'est lui, l'erreur de fond — l'estompage demande *à
      quelle distance du sol suis-je*, le repos demande *l'utilisateur
      change-t-il d'échelle*. Deux questions, deux grandeurs.
- [ ] **Étape 6 — À L'ÉCRAN.** Charge la page sous
      `?terre=unique&frontiere=1&seuil=1&globe=continu&socle=quadtree&f3=0`,
      pose-toi sur le crop, puis **incline et fais tourner la vue sans toucher à
      la molette** : `veilleRepos.auRepos` doit rester vrai et `.bascules` ne
      doit pas bouger. Puis **une molette de dézoom** : il doit passer à faux.
      Captures et traces dans `.banc/R1/`.

---

## ② LES BOUTONS DU BAS SONT ACCROCHÉS À LA MAUVAISE QUESTION

> **Adrien :** *« Il me manque les boutons du bas en UI, ils ont disparu
> (shuffle, affichage photographie aérienne...) »*

### Le mécanisme, déjà tracé de bout en bout

Dans `src/main.js:4564`, `poserVisibiliteSocle(v)` commence par borner son
argument à faux sous le drapeau — ce qui est **correct** pour la géométrie du
bloc plat — puis passe **ce même `v` borné** à trois boutons :
`isoBtn?.setVisible(v)` (`main.js:4579`), `cineBtn?.setVisible(v)`
(`main.js:4580`), `mapCorner?.setVisible(v)` (`main.js:4581`, qui porte l'aérien
ET le shuffle), avant `refreshOsmCredit()`.

⚠️ **La fonction confond DEUX questions.** `v` répond à « le maillage du bloc
plat est-il dessiné » — et sous le drapeau la réponse doit être non. Mais les
trois boutons répondent à « sommes-nous en vue de surface, devant un bloc » —
et sous le drapeau **la réponse est OUI**, c'est simplement un autre bloc.
Le commentaire à côté le dit lui-même : *« the isometric shortcut only makes
sense over the block »*. Il y a un bloc.

Ce ne sont PAS des exceptions silencieuses : la construction est
inconditionnelle (`main.js:10643`, `10667`, `10680`), sans `try`. Et la classe
`.off` fait `display:none` (`src/ui/v28.css:2989` et `3046`).

### Ce qu'on attend

- [ ] **Étape 1 — test rouge** : sous drapeau levé et en mode surface, les trois
      boutons doivent être visibles et `terrain.mesh.visible` doit rester faux.
      ⚠️ **Le test doit mordre sur le COMPORTEMENT**, pas lire le texte source :
      sur ce chantier, une mutation a survécu à 4 082 tests parce que la garde
      était une assertion d'expression régulière sur le fichier source.
- [ ] **Étape 2 — sépare les deux questions** dans `poserVisibiliteSocle` :
      garde le bornage à faux pour la géométrie du socle, et fais suivre aux
      trois boutons (et à `refreshOsmCredit`) **la valeur d'entrée avant
      bornage**.
- [ ] **Étape 3 — DIS LA VÉRITÉ SUR CE QUI SERA MORT.** Une enquête a établi,
      chemin d'appel à l'appui :
      · **la photo aérienne n'a AUCUNE source sur le globe** — `refreshAerialCore`
        (`main.js:8322`) n'écrit que dans `terrain.setAerial` (`main.js:8386`), et
        une recherche de « aerial » dans `src/monde/` ne rend rien. Le bouton
        sera **inerte**.
      · **shuffle est un agrégat** : palette et encre **sont** branchées
        (`globe.rebuildRamp` / `globe.setInk`, `main.js:5827`, `5834`, `5930`) ;
        la mer et la matière écrivent dans `realWater` / `terrain`, **invisibles
        sous le drapeau** — cette part tourne dans le vide.
      · **iso et ciné : NON TRANCHÉ.** `applyIsoView` semble générique, mais
        `cadreLeDamier` dépend de `blockGrid` et `TERRAIN_SIZE` propres au socle,
        et `src/camera-shots.js` n'a pas été lu. **Vérifie-le, et si un bouton
        plante sous le crop, ne le rallume pas en silence.**
      Rends ces boutons visibles comme Adrien le demande, **et écris dans ton
      rapport, bouton par bouton, ce qui marche et ce qui ne marche pas.** ⛔ Ne
      décris pas comme « rétabli » un bouton qui n'agit sur rien.
- [ ] **Étape 4 — à l'écran**, drapeau levé ET baissé. ⚠️ **Drapeau baissé, la
      production doit être inchangée** — c'est la garantie que tout ce chantier
      a tenue jusqu'ici.

---

## Les règles de ce chantier

- ⛔ **N'invente aucun chiffre.** Vingt-six ont été retirés par leurs auteurs ici.
  Si tu n'as pas mesuré, écris « non mesuré ».
- ⛔ **Une concordance au défaut n'est pas un branchement** : prouve en DÉPLAÇANT
  la valeur, dans les deux sens.
- ⛔ **Un `return` muet rend un test vert et indistinguable d'un test qui a lu.**
- ⚠️ **Le grain de film est ANIMÉ** : deux captures consécutives diffèrent si tu
  ne le gèles pas. Et le canevas de la page est construit sans tampon de
  profondeur — rends dans une cible à profondeur, sinon un bloc opaque
  ressemble à du verre.
- **Commits séparés pour ① et ②.** La suite de tests doit rester verte
  (4 117 au départ).
