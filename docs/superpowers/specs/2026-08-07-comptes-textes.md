# Les textes du compte — à coller tels quels

> Écrits avant l'interface, exprès. Sur ces écrans-là, **les mots sont la conception** : la porte à l'export se joue entièrement sur le ton, pas sur la mise en page.

**Règles de la maison**, vérifiées sur tout le produit :
- **Tutoiement**, toujours.
- **Toujours un sujet dans les titres.** « Comment on t'envoie ta carte ? », jamais « Comment tu la reçois ». C'est une exigence répétée d'Adrien, et elle a déjà été corrigée deux fois.
- Le bouton dit **exactement** ce qui va se passer. « Se connecter » puis un écran de connexion ; « Envoyer le code » puis un code envoyé.
- Une erreur dit **ce qui s'est passé**, puis **quoi faire**. Jamais d'excuse, jamais de vague.

---

## A. La porte à l'export

**Le moment le plus délicat du produit.** Quelqu'un vient de passer vingt minutes à composer sa carte et veut son fichier. Ce n'est pas le moment de lui présenter une facture déguisée.

**La règle d'Adrien, mot pour mot :**
> *« On ne demande à l'utilisateur de créer son compte que lorsqu'il veut exporter sa carte, mais il peut sauter l'étape ; on lui indique que s'il fait ça, il faut qu'il enregistre son template sur son ordinateur, et que celui-là ne sera pas conservé par ShibuMap. »*

**Titre** — Tu veux qu'on garde ta carte ?

**Corps** — Avec un compte, tu la retrouves ici la prochaine fois : ton tracé, tes couleurs, tes réglages. Sans compte, l'export part quand même — mais rien n'est gardé de notre côté.

**Bouton principal** — Créer mon compte
**Bouton secondaire** — Continuer sans compte

⚠️ **LES DEUX SORTIES ONT LE MÊME POIDS.** Le second bouton n'est ni un lien gris, ni un « non merci » en petit. Quelqu'un qui passe outre ne doit pas se sentir puni ; quelqu'un qui crée un compte ne doit pas se sentir forcé.

**Après avoir choisi « Continuer sans compte »** — un message, pas une modale de plus :

> Ton export est en route. Pense à enregistrer ton gabarit sur ton ordinateur : sans compte, ShibuMap ne le garde pas.
> **[Enregistrer mon gabarit]**

⚠️ Ce bouton n'est pas décoratif : c'est la seule chose qui rende l'avertissement honnête. Prévenir sans donner le moyen d'agir, c'est se couvrir, pas aider.

---

## B. La connexion

Deux étapes, deux écrans. Jamais les deux champs ensemble : personne n'a le code avant de l'avoir demandé.

### Étape 1 — l'adresse

**Titre** — On t'envoie un code
**Corps** — Pas de mot de passe à retenir. Tu reçois six chiffres, tu les recopies, c'est fini.
**Champ** — Ton adresse · `toi@taclub.fr`
**Bouton** — Envoyer le code

### Étape 2 — le code

**Titre** — Ton code est parti
**Corps** — On l'a envoyé à **{adresse}**. Il arrive en quelques secondes et reste valable un quart d'heure.
**Champ** — Les six chiffres
**Bouton** — Me connecter
**Liens** — Renvoyer un code · Changer d'adresse

### Les refus

| Ce qui arrive | Ce qu'on écrit |
|---|---|
| Code faux | Ce code ne correspond pas. Vérifie les six chiffres du dernier message reçu. |
| Code expiré | Ce code a expiré. Demande-en un nouveau, il arrive tout de suite. |
| Trop d'essais | Trop de tentatives. Attends une minute avant de réessayer. |
| Adresse mal formée | Cette adresse ne ressemble pas à une adresse mail. C'est le seul endroit où ton code sera envoyé. |
| Envoi impossible | Le code n'a pas pu partir. Réessaie dans un instant — ce n'est pas ton adresse qui est en cause. |
| Supabase injoignable | La connexion ne répond pas. Ta carte, elle, reste intacte : réessaie dans un moment. |

⚠️ **Le dernier compte plus qu'il n'y paraît.** Quand l'authentification tombe, la première peur est « j'ai perdu mon travail ». On répond à cette peur-là avant de parler de la panne.

---

## C. Mes cartes

**Titre du panneau** — Mes cartes

**Une ligne** — le nom de la course, le lieu, la date de publication, et le lien.
**Tri** — Par date · Par lieu *(les deux, Adrien les demande explicitement)*

### Quand la liste est vide

C'est ce que **tout le monde** voit le premier jour. Cet écran-là mérite autant de soin que les autres.

**Titre** — Tu n'as pas encore publié de carte
**Corps** — Dès que tu publies une carte, elle apparaît ici — avec son lien, prête à partager.
**Bouton** — Composer ma première carte

### Quand la liste n'a pas pu être lue

**À ne surtout pas confondre avec l'état vide.** Le panneau avalait l'échec et affichait « Tu n'as pas encore publié de carte » : un organisateur qui a douze courses en ligne lisait que son compte était vide, se voyait proposer « Composer ma première carte », et n'avait aucun moyen de réessayer. C'est le cas d'un serveur en panne, d'une session morte, d'un forfait de lectures atteint, ou d'un téléphone hors réseau.

⚠️ **On rassure d'abord sur ce qui n'est pas perdu** — la règle qui tient tous les refus de ce module. La première peur devant un panneau vide, c'est « mes cartes ont disparu ». Le titre y répond avant de parler de la panne.

**Titre** — Tes cartes sont toujours là
**Corps** — C'est la liste qui n'a pas pu être lue — tes cartes publiées et leurs liens n'ont pas bougé. Réessaie dans un instant.
**Bouton** — Réessayer

### Quand une carte est en cours de chargement

Trois lignes grises à la forme des vraies. Pas de roue qui tourne.

### Au téléphone

Sous 700 px, le panneau arrive **replié** : la carte est ce qu'on est venu voir, et 376 px de panneau au milieu de l'écran n'ont été demandés par personne. Sa pastille d'en-tête reste le chemin vers les cartes, et le geste de replier ou déplier est **retenu** d'une visite à l'autre — dans les deux sens.

---

## D. Mon compte

Une section dans la modale de Paramètres, qui existe déjà.

**Titre** — Mon compte
**Ligne d'identité** — Connecté avec **{adresse}**

**Actions**
- Me déconnecter
- Exporter mes données *(un fichier, tout ce qu'on a)*
- Supprimer mon compte

### La suppression

**Titre** — Tu veux supprimer ton compte ?
**Corps** — Tes cartes déjà publiées resteront en ligne — leurs liens continuent de fonctionner pour ceux qui les ont. Tes gabarits, eux, sont enregistrés sur cet ordinateur et y restent. Ce qui disparaît, c'est ton compte et le lien entre tes cartes et toi. C'est définitif.
**Bouton de confirmation** — Supprimer mon compte
**Bouton d'annulation** — Garder mon compte

⚠️ **On dit ce qui NE disparaît pas.** Un organisateur qui a diffusé un lien à trois cents coureurs doit savoir que sa suppression ne casse pas leur lien — sinon il n'ose pas, et il écrit à Adrien.

⚠️ **Les boutons portent l'action**, pas « OK » et « Annuler ». On doit pouvoir lire les deux et savoir lequel fait quoi sans relire la question.

---

## E. Ce qu'on ne dit jamais

- « Oups », « Aïe », « Une erreur est survenue ».
- « Veuillez patienter » — on dit ce qu'on attend.
- « Votre compte » — on tutoie, donc **ton** compte.
- Une promesse d'envoi de courriel avant d'avoir la confirmation qu'il est parti. Le produit a déjà ce réflexe ailleurs, on le garde.
