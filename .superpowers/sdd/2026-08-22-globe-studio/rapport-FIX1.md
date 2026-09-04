# FIX1 — fusion MIX × REV, le test ④ qui rougissait

## La cause, en une ligne

**Issue A** — le test dérive mal ses altitudes, le code est intact : `ALT_HAUTE`
(161 371,3 m, réutilisée depuis les tests ①-③) est cinq fois au-dessus de
`SEUIL_NAISSANCE_M` (32 274,3 m) depuis le retour de la naissance du crop à z10
(D23) ; le crop de `creerVeilleCrop` ne naît donc jamais dans le scénario du
test ④, et `poserCropSeul` n'est appelé nulle part — le journal reste vide là
où le test attend `[true]`.

## Ce que j'ai cru puis réfuté

- **Cru d'abord** (piste du brief) : que le problème venait des seuils du socle
  (`SEUIL_BLOC_M` / `SEUIL_BLOC_MORT_M`) sur lesquels `branchement-crop.js`
  fonde son automate d'« arrivée au bloc » (lignes 745-746, l'automate
  `auBloc`/D16 ter). **Réfuté** : cet automate est un aparté (la bascule de
  trois quarts), il n'intervient jamais dans le test ④ — `globeDePapier` ne le
  lit pas, et `auBloc` n'est jamais consulté par `appliquerRepos`.
- **Cru ensuite** : que le code du fondu (MIX, `appliquerRepos` /
  `fonduAcheve`) était cassé par le revert. **Réfuté par la mesure** : en
  restaurant `ALT_HAUTE` à une altitude où le crop existe, les 12 tests du
  fichier passent sans toucher un octet de `estompage-terre.js` ni de
  `branchement-crop.js`. Le couple `reposApplique && fonduAcheve` fonctionne
  exactement comme prévu — voir la preuve ci-dessous, où le CASSER
  volontairement fait rougir ④ pour la bonne raison (« le parcours a coupé
  pendant que le fondu courait encore »), pas pour une raison de seuils.
- **Établi** : le problème est purement dans la dérivation d'altitude du test,
  qui suppose implicitement (sans le dire) que « au-dessus de la bande
  d'estompage » implique « le crop peut encore exister ». Cette implication
  était vraie tant que `SEUIL_NAISSANCE_M` valait 600 000 m (bien au-dessus de
  `ALT_HAUTE`). Depuis D23 (`SEUIL_NAISSANCE_M = SEUIL_BLOC_M = 32 274,3 m`),
  l'ordre des seuils est `FIN(19 364,6) < NAISSANCE/BLOC(32 274,3) <
  DÉBUT_FONDU(40 342,8)` : la bande d'estompage tout entière est désormais
  AU-DESSUS de l'altitude de naissance du crop. Il n'existe donc structurellement
  plus d'altitude qui soit à la fois « hors bande » et « le crop peut naître »
  — mais le test ④ n'a en réalité jamais eu besoin de la première condition,
  seulement de la seconde (il ne lit ni `valeur` ni `auSeuil` de l'estompage,
  seulement les appels à `poserCropSeul`).

## Le correctif

`test/estompage-fondu.test.js` :
- import de `SEUIL_NAISSANCE_M` (`src/monde/seuil-socle.js`) ;
- nouvelle constante `ALT_CROP_NE = SEUIL_NAISSANCE_M * 0.9`, avec le
  commentaire qui explique pourquoi `ALT_HAUTE` ne convient plus (voir le
  fichier, lignes ~46-63) ;
- le test ④ (et lui seul) utilise `ALT_CROP_NE` à la place d'`ALT_HAUTE` dans
  ses cinq appels à `v.maj(...)`. Les tests ①-③, qui n'exercent que la loi pure
  `estompageTerre`/`creerVeilleEstompage` sans crop, gardent `ALT_HAUTE`
  intact — leur intention (« une altitude au-dessus de la bande ») reste
  correcte pour eux.

⛔ Aucune part du revert z10 n'est touchée : `SEUIL_NAISSANCE_M`,
`SEUIL_MORT_M`, `SEUIL_BLOC_M`, `SEUIL_BLOC_MORT_M` sont inchangés. Aucune
assertion du test ④ n'est relâchée, sautée ni rendue tolérante — les cinq
`assert.deepEqual` sont restés au mot.

## La preuve que ④ mord toujours

Cassé exprès dans `src/monde/branchement-crop.js`, ligne 806 :
`const seul = reposApplique && acheve` → `const seul = reposApplique` (le
gate MIX sur `fonduAcheve` retiré).

- `node --test test/estompage-fondu.test.js` → ④ **rouge**, avec le message
  exact `'le parcours a coupé pendant que le fondu courait encore'`,
  `actual: [true]`, `expected: []` — la marche qu'Adrien a signalée
  (défaut ①, scintillement) reviendrait bien.
- Restauré à l'octet (`git diff --stat src/monde/branchement-crop.js` → vide).
- Suite rejouée → ④ **vert** de nouveau, 12/12.

## Mesures finales

```
npm test          → tests 4883, pass 4883, fail 0
npm run audit:tests → 262 listés · 262 sur disque · Aucun écart.
```
