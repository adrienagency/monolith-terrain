# Comptes utilisateurs — plan d'implémentation

> **Pour les agents :** SOUS-COMPÉTENCE REQUISE : `superpowers:subagent-driven-development`. Cases à cocher (`- [ ]`).

**Objectif :** un compte simple où l'utilisateur retrouve **ses cartes, ses fichiers et ses factures**, sans que personne n'en ait besoin pour utiliser ShibuMap.

**Le principe qui gouverne tout :** on ne demande un compte **qu'au moment d'exporter** — impression, vidéo, image — et **on peut sauter l'étape**. Celui qui saute est averti clairement : il doit enregistrer son gabarit sur son ordinateur, ShibuMap ne le gardera pas.

**Architecture :** authentification **sans mot de passe** (code à six chiffres par courriel) chez **Supabase, région Paris** ; la propriété d'une carte s'**ajoute** au jeton existant, elle ne le remplace pas ; les 2,4 Go de données géographiques **restent où ils sont**.

---

## Ce qui est acquis — ne le re-cherchez pas

Deux campagnes de recherche ont établi ceci le 2026-08-05. C'est vérifié et sourcé.

**Le cadre légal.** Adrien est **déjà responsable de traitement** — il vend des affiches par Stripe, donc il traite déjà des courriels, des noms, des adresses. Registre, politique de confidentialité, droit à l'effacement : **il les doit aujourd'hui**, sans compte. Les comptes ajoutent **du volume et un secret à protéger**, pas un régime nouveau. Pas de DPO nécessaire. Un cookie strictement d'authentification est **exempté de bandeau de consentement**. La sanction réelle plafonne à 20 000 € en procédure simplifiée, et naît presque toujours d'une **plainte** — les deux comportements qui la transforment en amende étant *ne pas répondre à un client* et *ne pas répondre à la CNIL*.

**Le prestataire.** **Supabase**, plan Pro à 25 $/mois, 100 000 utilisateurs actifs inclus. **Seul de sa catégorie à avoir un plafond de dépense dur activé par défaut** — Firebase n'a que des alertes, Auth0 grimpe à 2 100 $, Stytch revendique l'absence de plafond. Région à choisir **explicitement** : `eu-west-3` (Paris). Le groupe générique « Europe » inclut Londres et Zurich, **hors UE**.

**Le courriel.** Supabase plafonne son envoi intégré à **2 messages par heure** : brancher Resend est **obligatoire**, pas optionnel. Adrien l'a déjà, son domaine est authentifié.

**Sans mot de passe, et un code plutôt qu'un lien.** Les messageries d'entreprise « visitent » les liens pour les vérifier et **brûlent le jeton avant l'humain**. Un code à recopier n'a pas ce défaut, et marche quand la boîte est sur le téléphone et la carte sur l'ordinateur.

**Ne pas mutualiser les 2,4 Go.** Ce sont deux problèmes de nature opposée : les tuiles sont publiques, immuables, énormes, lues par tous — il leur faut du débit ; les comptes sont privés, minuscules, modifiés sans cesse — il leur faut de l'intégrité. Mêler les deux, c'est payer un tarif de base de données pour un problème de diffusion, et transformer chaque migration future en migration double.

---

## L'état du code, vérifié

**La propriété d'une carte tient dans trois fonctions et un seul point d'appel côté client.** `rememberRaceSecret` / `recallRaceSecret` / `updateRace` (`src/share-link.js:363/381/397`), appelées depuis `src/main.js:7138`. Côté serveur, **une seule** fonction d'autorisation : `secretMatches` (`netlify/functions/race.mjs:118-125`), **un seul** point d'appel (`:494`).

Posséder une carte = avoir dans le stockage local de *ce* navigateur la chaîne de 32 caractères que le serveur a prononcée une fois et oubliée aussitôt.

**Le magasin a un espace de noms libre, exprès.** `ID_RE` (`race.mjs:96`) interdit `_` précisément pour que des clés préfixées ne collisionnent pas — `rl_<ip>` et `rlq_<ip>` y vivent déjà. Des clés `owner/<uid>/<raceId>` s'y posent sans rien inventer.

**Aucun code n'appelle `store.list()`**, mais le SDK sait le faire (`list({ prefix })`).

---

## ⚠️ Les quatre pièges, à traiter avant tout le reste

**1. Le PUT effacerait `ownerId` en silence.** `race.mjs:501-508` reconstruit le payload et ne réinjecte explicitement que `secretHash` et `createdAt`. **Tout champ présent sur l'ancien blob et absent de `readWriteBody` disparaît à la première correction.** Un compte perdrait ses cartes le jour où l'organisateur corrige son tracé, et personne ne le verrait avant. **C'est la première ligne à écrire et à verrouiller par un test.**

**2. Stripe jette l'identifiant client.** `paiement.mjs:86` pose `customer_creation: 'always'`, donc Stripe **crée** une fiche — et le webhook n'en garde que le courriel (`paiement-webhook.mjs:110`). C'est le seul fil qui relierait un achat à un compte. **Une demi-journée, et à faire maintenant** : rien n'a encore été vendu, donc il n'y a rien à rattraper.

**3. Le budget d'octets en lecture est calibré à l'envers.** `debiterLecture` (`race.mjs:292-297`) plafonne à 1 Gio par IP et par 10 minutes, dimensionné pour « un lien, mille lecteurs ». « Mes cartes » est le profil **inverse** : un lecteur, N cartes de 4,26 Mo. **Un organisateur qui ouvre sa liste de 40 cartes brûlerait son propre budget.** Il faut lire les métadonnées depuis l'index, pas les payloads.

**4. Ne jamais résoudre un utilisateur par le courriel Stripe.** C'est ce que l'acheteur a tapé au paiement, jamais vérifié contre le compte. C'est le chemin classique vers deux identités qui divergent.

---

## Contraintes globales

1. **Rien ne déploie sans décision d'Adrien.**
2. **Une seule fonction d'autorisation, côté serveur.** `autorise(req, blob) = secretMatches(en-tête, blob.secretHash) || (blob.ownerId && blob.ownerId === uidDeLaSession(req))`. **Jamais un troisième chemin, jamais « le client dit que c'est à lui ».** `secretMatches` n'est pas touchée — le compte s'ajoute à côté.
3. **Le produit doit continuer sans connexion.** `race.mjs:13-15` l'écrit : « public and unauthenticated by design ». `paiement.mjs:16` en fait la raison pour laquelle le site encaisse sans PCI-DSS. Et le dépôt vitrine publie sans navigateur identifié.
4. **Périmètre de données minuscule.** Identifiant, courriel, dates, liste d'identifiants de cartes, identifiant client Stripe. **Pas de nom, pas d'adresse — Stripe la garde. Pas de téléphone, pas de photo, pas d'IP conservée.** Chaque champ ajouté est un champ à exporter, à effacer et à protéger.
5. **Ne touchez pas** au pavage, au compositeur, au PDF, au coffre local, ni à la vérification de signature du webhook.
6. `package.json` liste les tests **un par un** ; audit disque-vs-liste après tout ajout.
7. ⚠️ **`node --check` sur tout fichier modifié ET `npx vite build`, obligatoires avant commit.** Aucun test ne charge `src/main.js`.
8. Français dans les commentaires, les symboles et les textes affichés. **Toujours un sujet dans les titres.**
9. Un commit par tâche.

---

# PHASE 0 — Les pièges, avant tout

## Tâche 1 : `ownerId` survit au PUT

**Créer** le champ, et le préserver **exactement comme `secretHash`** l'est. Test qui échoue si une correction de tracé perd le propriétaire.

## Tâche 2 : Stripe garde son fil

`paiement.mjs` : ajouter `compte: <uid>` aux métadonnées. `paiement-webhook.mjs` : ajouter `client: s.customer` et `compte: s.metadata?.compte` à la commande, et écrire une entrée `client/<uid>/<session>`.

⚠️ **Ne touchez ni à la signature, ni à l'idempotence, ni à l'ordre « écrire avant d'envoyer ».**

---

# PHASE 1 — L'authentification

## Tâche 3 : le compte chez Supabase

Projet en région **Paris `eu-west-3`** (choix **irréversible** sans migration), plan Pro, plafond de dépense laissé activé, Resend branché comme service d'envoi.

⚠️ **Adrien crée le compte et accepte l'accord de sous-traitance lui-même** — l'agent prépare, il ne signe pas.

## Tâche 4 : connexion par code à six chiffres

Le code arrive par Resend. **Plus « Se connecter avec Google »** en second bouton — gratuit, instantané, et il évacue le problème de délivrabilité pour la moitié des gens.

⚠️ La session doit être **lisible depuis une fonction Netlify**, sans quoi la Tâche 5 n'a rien à vérifier.

---

# PHASE 2 — La propriété

## Tâche 5 : `autorise()` côté serveur

La fonction unique de la contrainte 2, et **l'index** `owner/<uid>/<raceId>` avec `list({ prefix })`.

⚠️ **Deux écritures non transactionnelles** (le blob et l'index). Le mode de panne est réel et silencieux. **Doctrine : le blob est la vérité, l'index est un cache reconstructible**, et la lecture filtre les entrées mortes. Écrivez-le dans le code.

## Tâche 6 : la lecture allégée

Un mode « métadonnées » du GET : nom, lieu, date, vignette. **Sans lui, « Mes cartes » brûle le budget de son propre auteur** (piège 3).

⚠️ **LE CDN METTRAIT « MES CARTES » EN CACHE ET LA SERVIRAIT À UN INCONNU.** Le chemin GET pose sans condition `netlify-cdn-cache-control: public, s-maxage=30` (`race.mjs:329-332`, appliqué au retour). Greffer un mode dépendant de la session sur ce même gestionnaire ferait resservir la liste d'un compte au visiteur suivant pendant 30 secondes — **sans attaquant, sans bruit, et sans que rien ne le signale**. Toute réponse liée à une session doit partir en `no-store` ; le refus 429 juste au-dessus le fait déjà correctement, il suffit de le recopier. *(Trouvé par l'attaquant, 2026-08-06 — les deux autres trouvailles ont été corrigées en Phase 0.)*

## Tâche 7 : le rattachement

`POST /race?claim&id=` avec le secret dans le même en-tête, vérifié par **le même `secretMatches`**. Côté client, une boucle sur les clés déjà connues du navigateur.

⚠️ **Ses limites, à écrire dans l'interface, pas seulement dans le code :**
- il prouve la possession d'un **jeton**, pas une identité — le courriel du dépôt vitrine contient le secret en clair, donc quiconque a reçu ce message transféré peut revendiquer. **Premier arrivé, premier propriétaire**, et il faut l'assumer ;
- il ne couvre que les cartes dont le jeton existe encore. Navigateur vidé, courriel supprimé → **irrécupérable, définitivement**. `secretHash` est un condensat, il n'y a aucun chemin de retour ;
- **son propre seau de débit** : réutiliser celui d'écriture (12 par 10 min) bloquerait un rattachement légitime de 50 cartes au treizième.

---

# PHASE 3 — Ce que l'utilisateur voit

## Tâche 8 : la porte à l'export

**C'est le cœur de la demande d'Adrien.** Ses mots :

> *« On ne demande à l'utilisateur de créer son compte que lorsqu'il veut exporter sa carte (impression, vidéo, image), mais il peut sauter l'étape ; on lui indique que s'il fait ça, il faut qu'il enregistre son template sur son ordinateur, et que celui-là ne sera pas conservé par ShibuMap. »*

Donc : **jamais de mur**. Une invitation au moment de l'export, avec deux issues **également praticables** :
- créer un compte, et tout est gardé ;
- continuer sans, **et l'écran dit alors clairement quoi faire** — enregistrer le gabarit sur sa machine — **et ce qui se perd**.

⚠️ **Le ton décide de tout ici.** Ce n'est pas une menace, c'est une information. Quelqu'un qui saute ne doit pas se sentir puni, et quelqu'un qui crée un compte ne doit pas avoir l'impression d'y avoir été forcé. Le texte de l'issue « sans compte » doit être **aussi soigné** que l'autre.

⚠️ **Trois exports, trois moments.** L'impression passe par le paiement, la vidéo et l'image non. Vérifiez que l'invitation a du sens dans les trois cas, et qu'elle n'apparaît pas deux fois dans le parcours d'impression.

## Tâche 9 : « Mes cartes »

Un panneau du rail droit, avec l'accordéon existant. **Tri par date de création et par lieu** — les deux, Adrien les demande.

⚠️ Aujourd'hui **aucune interface ne liste les cartes publiées de personne**. « Mes courses » (`src/ui/route-panel.js:129-133`) liste les calques GPX de la session, pas des cartes publiées. C'est un écran neuf.

## Tâche 10 : « Mon compte »

Une section dans la modale des Paramètres, qui existe déjà (`src/main.js:8101-8130`, deux sections assemblées ligne 8123 — un `append` de plus). **Ne touchez pas à la barre du haut**, sept emplacements déjà denses.

Elle porte : l'adresse, la déconnexion, **« Exporter mes données »** (un fichier JSON), et **« Supprimer mon compte »** qui efface vraiment.

⚠️ **Ce bouton de suppression n'est pas une politesse** : il transforme une obligation légale en fonctionnalité et évite toute demande manuelle. Deux heures qui épargnent des années.

## Tâche 11 : les factures

La liste des achats, avec le lien vers la facture Stripe. **Stripe garde les données de facturation et assume la conservation de dix ans** — ShibuMap n'en stocke aucune, il affiche.

---

# PHASE 4 — La cohabitation, et c'est là que se logent les bugs muets

## Tâche 12 : un seul chemin de propriété côté client

⚠️ **Les quatre défauts contre lesquels concevoir, tous réels au vu du code actuel :**

**(a) Le plus grave.** Connecté sur une autre machine, `recallRaceSecret` rend `null` (`share-link.js:381`) et `main.js:7150` **publie silencieusement un second identifiant**. Le lien déjà diffusé aux coureurs reste sur l'ancienne version. C'est exactement le bug que le jeton a été inventé pour tuer, revenant par la porte du compte. **La branche « compte » doit être consultée AVANT la boucle de publication, pas après.**

**(b)** Publier en anonyme puis se connecter : si le rattachement n'est pas proposé **automatiquement** à la connexion, personne n'y pensera.

**(c)** `main.js:7171` écrit le jeton dans le stockage local **même pour un utilisateur connecté**. Choisir : cesser d'écrire, ou l'assumer comme repli hors ligne. Mais choisir.

**(d)** `restoredRaceId` (`main.js:790`) n'est **jamais remis à zéro**. Deux onglets, un état de module partagé, et un compte par-dessus : c'est la recette.

**Verrouillez les quatre combinaisons** — jeton seul, compte seul, les deux, aucun — dans `test/race-edit.test.js`, qui a déjà un magasin en mémoire. Et surtout : **ni l'un ni l'autre ne doit jamais faire naître un second identifiant.**

⚠️ **`shareCurrentView` (`main.js:7069-7220`) mêle six responsabilités en 150 lignes** : capture de caméra, rastérisation de logo, double tentative avec et sans logo, corriger-ou-créer, feuille de partage, presse-papier. **C'est le seul endroit difficile à tester, et c'est exactement là que le bug muet se logera.** L'extraire dans un module est la condition d'un travail propre.

---

# PHASE 5 — Ce qu'Adrien doit faire lui-même

Aucun agent ne peut le faire à sa place. **À écrire dans le rapport final, pas à exécuter.**

- Créer le compte Supabase, **choisir la région Paris à la création**, demander l'accord de sous-traitance.
- Écrire la **politique de confidentialité** et la lier depuis chaque page, séparément des CGV. Neuf mentions imposées.
- Remplir le **registre des traitements** (modèle CNIL, trois ou quatre lignes).
- Ouvrir **`privacy@shibumap.com`** — et **la relever**. Ne pas répondre est ce qui transforme une plainte en amende.
- Archiver les accords de sous-traitance de Stripe, Netlify, Resend et Supabase.
- Décider et écrire les **durées de conservation** : compte inactif, factures (dix ans, obligation comptable), journaux techniques.
- Corriger la phrase du courriel de la vitrine, qui promet aujourd'hui « ni compte, ni annuaire, ni page qui la liste ».

---

## Auto-revue

**Ce que ce plan ne couvre pas, délibérément :** la synchronisation des brouillons du Race Studio (v2) ; le module coureur (à ouvrir quand la boutique aura vendu) ; le déplacement des 2,4 Go.

**Le risque principal :** la cohabitation des deux chemins de propriété. C'est la Tâche 12, elle est incompressible, et **la sauter est le seul vrai danger de ce chantier**.

**Effort estimé :** 8 à 9 jours, dont environ 5 incompressibles.
