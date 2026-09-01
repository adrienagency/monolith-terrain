# R26 — LES TUILES QUI RESTENT `empty` POUR TOUJOURS

Arbre : `C:\Dev\wt-tv` · branche `tuiles-vides` (partie de `regroupement`).
Serveur : `npm run dev` — **port libre au-dessus de 5700**.

## D'OÙ ÇA VIENT — trouvé sans le chercher, par une autre tâche

R21 mesurait tout autre chose (un transitoire de banc). En vérifiant sa
précondition, il a écrit ceci :

> **« La porte "plus aucune tuile en vol" expire à ses 45 s à CHAQUE chargement,
> sans exception : il reste 4 à 9 tuiles `empty` que rien ne remplira. C'était
> une temporisation déguisée. »**

⛔ **Il ne l'a pas corrigé exprès** — le réparer rendrait irreproductibles les
chiffres déjà publiés par la campagne. Il a posé une note dans ses deux sondes et
laissé la tâche ouverte. **C'est toi, la tâche.**

## ⚠️ IL Y A DEUX QUESTIONS ICI, ET ELLES N'ONT PAS LE MÊME POIDS

**① La petite** : la porte du banc est un `sleep(45 s)` déguisé, donc chaque
mesure de cette campagne a coûté 45 s pour rien. Agaçant, borné.

**② La grosse, et c'est elle qui justifie la tâche** : *pourquoi* 4 à 9 tuiles
restent-elles dans l'état de départ pour toujours ?

`src/globe.js` porte le cycle `empty → loading → ready | error` (ligne 7023), et
**trois chemins ramènent `loading` à `empty`** (7161, 7202, 7238) — c'est-à-dire
qu'un échec **rend la place**, en apparence. La question est donc : ces tuiles
ont-elles échoué en boucle, ou n'ont-elles **jamais été demandées** ?

⚡ **La compétence `/threejs-optimisation`, écrite depuis ce dépôt, décrit
exactement ce motif et le donne pour coûteux :**

> *« une entrée EN COURS DE CHARGEMENT dont la requête ne revient jamais occupe
> une place POUR TOUJOURS »* — et : *« tout budget de la forme `capacité −
> occupé` »* fabrique un **point fixe**, où le crédit tombe à zéro et plus
> aucune tuile n'est créée.

Ce dépôt a **déjà** eu ce défaut : `credit = MAX_CACHE − taille + récupérable`,
gelé à saturation, avec un commentaire qui affirmait que le terme `récupérable`
l'évitait — **il ne faisait que le retarder**. Voir aussi `globe.js:7971` :
`t.state === 'empty' && t.lastUsed !== this.frame` sert de test de récupérabilité.

## ⛔ MAIS MON HYPOTHÈSE EST PEUT-ÊTRE FAUSSE, ET TU DOIS LA TESTER D'ABORD

**Sur ce chantier, l'exécutant qui mesurait a eu raison contre mon départage
dix-sept fois sur dix-sept.** L'explication la plus probable est **l'inverse de
l'alarme** :

➡️ **Ces tuiles ne sont peut-être demandées par personne.** `_traverse` élimine
par tronc de vue et par distance ; une tuile créée puis sortie du champ reste
`empty` sans que ce soit un défaut — **et alors c'est la PORTE du banc qui est
fausse**, pas le moteur. Attendre « plus aucune tuile en vol » quand des tuiles
ne sont pas en vol mais au repos est une précondition mal écrite.

**Départage à établir par la mesure, et c'est le cœur de la tâche :**

| si… | alors |
|---|---|
| les 4 à 9 tuiles sont **hors champ / hors distance** | la porte du banc est fausse ; le moteur est sain ; corrige la porte, et **dis que l'alarme était fausse** |
| elles sont **demandées et la requête ne revient jamais** | c'est une fuite de places ; mesure combien de places sur combien, et à quelle vitesse ça grandit |
| elles **échouent puis sont redemandées en boucle** | c'est un cycle ; compte les requêtes par seconde |

⚠️ **Ne conclus pas sur une hypothèse qui réconcilie joliment les faits.** Ce
dépôt a déjà vu une explication commode (« les bancs diffèrent par le champ de
vision ») clore un débat en laissant l'erreur dedans — `grep -ic fov` rendait
**zéro**, et la fonction ne recevait même pas le champ de vision.

## LES INSTRUMENTS QUI MENTENT — chacun a produit un faux constat ici

- ⛔ **Une sonde posée APRÈS la fonction lit un état déjà écrasé.** Une variable
  de budget a rendu **404** là où sa vraie valeur était **0** — un chiffre
  parfaitement plausible **de la mauvaise grandeur** (c'était l'effectif du cache
  moins ses racines). **Instrumente DANS la boucle**, pas autour. ⚠️ **Ce piège
  vise ta tâche en plein.**
- ⛔ **`performance.getEntriesByType('resource')` plafonne à 250 entrées.** R24 a
  mesuré que le comptage naïf **sous-comptait de 79 %** ; il a un protocole qui
  marche, dans `rapport-R24.md`.
- **Un relevé sur UNE image ne prouve rien** si le système oscille. Ce dépôt a
  déjà vu un cycle de **période 4** où la planète retombait à ses 16 racines une
  image sur quatre. **20 images consécutives, et exige la stabilité.**
- **La règle sans-trou** (`kids.every(ready)`) fait charger quatre tuiles quand
  une suffit — juste à petite échelle, goulot à grande. Cesium l'a chiffrée puis
  **abandonnée** en profondeur. Si elle est en cause, dis-le.
- **`requestAnimationFrame` ne se déclenche pas dans un panneau qui ne
  composite pas** — patron : `scripts/sonde-demarrage.mjs`.
- ✅ **La molette simulée MARCHE** (40/40) : l'ancien avertissement contraire est
  **rétracté**. Le coupable était le voile d'accueil `.ce-hubveil`, qui mange
  **tous** les gestes. **Ferme-le (Échap) avant tout banc.**
- **La suite de tests peut verrouiller le défaut** : une assertion « plus de N
  objets dessinés » décrit le gaspillage comme un contrat et **fait échouer le
  bon correctif**. Relis les assertions qui bordent le cache avant de corriger.

## ⚠️ ET SI TU CORRIGES : L'ORDRE DES CORRECTIFS EST LE SUJET

Mesuré sur ce dépôt : desserrer le budget **avant** de réduire ce qui entre dans
le cache donne **×14 sur les requêtes** et un niveau de détail qui **retombe plus
bas qu'avant correction**. Les objets hors champ ne coûtent pas des appels de
dessin — **ils consomment les places du cache**, et c'est ça qui affame le budget.
**Réduis d'abord ce qui entre. Souvent le second correctif devient inutile.**

⛔ **Un correctif juste, appliqué dans le mauvais ordre, se mesure comme une
régression — et se fait annuler.**

## LES RÈGLES — dans ce dossier

- **D16 / bis / ter** — une seule caméra, une seule vue, la vue 3/4 n'arrive
  qu'au bloc. Ne change pas la caméra pour arranger le cache.
- **D17** — ⛔ **IL N'Y A PAS DE PRODUCTION.** N'écris jamais « production
  rigoureusement inchangée » en étape de fin : consigne abrogée.
- `lecons-campagne-R.md` — dont la **rétractation** en fin de fichier, à lire :
  un faux constat y a survécu à quatre tâches parce qu'il avait l'air d'une leçon
  durement acquise.

## L'ATTENDU

1. **Le départage tranché, avec les chiffres** : combien de tuiles, dans quel
   état, demandées ou non, sur combien de places, et **est-ce que ça grandit**
   (relève après 1, 5 et 15 minutes d'usage — une fuite se voit dans le temps).
2. **Si c'est la porte du banc qui est fausse** : corrige-la, et **dis clairement
   que l'alarme de R21 — et donc la mienne — était fausse**. C'est un bon
   résultat, pas un échec.
3. **Si c'est une vraie fuite** : le correctif, dans le bon ordre, avec le nombre
   de requêtes avant/après sur une descente complète.
4. **Le temps de chargement gagné**, s'il y en a, mesuré sur au moins trois
   chargements — ⚠️ et **pas pendant qu'un autre agent travaille** : quatre
   agents en parallèle ont saturé les fournisseurs cette nuit,
   `overpass-api.de` était injoignable. **Une mesure de chargement prise pendant
   une campagne parallèle ne vaut rien.**
5. Des tests. ⚠️ **`package.json` porte une LISTE EXPLICITE de fichiers de
   test** : un test absent ne tourne **jamais**. `npm run audit:tests`, aucun
   écart.
6. `npm test` — **base à battre : 4 573 · 0 échec**.
7. ⚠️ **Scripts d'édition en BINAIRE**, et **relis l'octet écrit**
   (`grep | cat -A`) quand tu poses une expression régulière : un `\b` est devenu
   un **retour arrière** cette nuit, et le test trouvait 0 sur 68 en restant vert.
8. Commits sur `tuiles-vides`, messages en français.
9. Rapport `rapport-R26.md` ici, avec une section **« ce que j'ai cru puis
   réfuté »** — elle n'a jamais été vide sur ce chantier.

Travaille jusqu'au bout, ne pose pas de question : tranche, mesure, corrige.
