# Guide utilisateur — ERP Nolte Küchen

Le mode d'emploi simple de l'application interne Nolte Küchen : se connecter, trouver son chemin, et réaliser ses tâches de tous les jours selon son rôle (Administrateur, Manager, Commercial, Magasinier, Comptable, Employé).

[TOC]

# 1. Avant de commencer

## À qui s'adresse ce guide ?

À toutes les personnes qui utilisent l'ERP Nolte Küchen au quotidien. Aucune connaissance technique n'est nécessaire.

Le guide est organisé en trois parties :

1. **Les bases** (chapitres 2 et 3) : se connecter, comprendre l'écran, les gestes qui reviennent partout. À lire par tout le monde.
2. **Votre rôle** (chapitres 4 et 5) : ce que vous voyez et ce que vous faites, selon votre fonction. Lisez la section qui vous concerne.
3. **Les écrans pas à pas** (chapitre 6) : la référence détaillée de chaque page. À consulter quand vous en avez besoin.

Un chapitre final répond aux questions fréquentes.

## Comment lire les encadrés

> **[Capture d'écran] Exemple d'emplacement de capture**
>
> Les cadres en pointillés comme celui-ci indiquent l'endroit où une capture d'écran de la page sera insérée. Le texte décrit ce que vous voyez à l'écran.

> **Astuce :** les encadrés verts donnent un conseil pour gagner du temps.

> **Important :** les encadrés orange signalent une action aux conséquences importantes (stock, argent, suppression).

## Vocabulaire de base

| Mot | Signification |
|---|---|
| **Devis** | Proposition de prix envoyée au client. Il ne bouge ni le stock ni l'argent. |
| **Commande** | Engagement du client. Elle se valide, se livre, et reçoit des paiements. |
| **Vente** | Transaction enregistrée. Elle est créée automatiquement quand une commande est validée, ou directement au comptoir. |
| **Facture** | Document comptable adressé au client. |
| **Achat** | Commande passée à un fournisseur. À la réception, la marchandise entre en stock. |
| **Dépôt** | Lieu de stockage (entrepôt, magasin, showroom…). |
| **Mouvement de stock** | Toute entrée ou sortie de marchandise (achat, livraison, retour, casse, inventaire). |
| **TTC / DH** | Les montants sont exprimés toutes taxes comprises, en dirhams. |

# 2. Premiers pas

## 2.1 Se connecter

1. Ouvrez votre navigateur (Chrome, Edge, Firefox ou Safari) à l'adresse **https://noltenador.digital**.
2. Saisissez votre **Adresse e-mail** et votre **Mot de passe**.
3. Cliquez sur **Se connecter**.

Vous arrivez sur le **Tableau de bord**.

> **[Capture d'écran] Page de connexion**
>
> À gauche, une grande photo de cuisine avec le logo Nolte Küchen et la phrase « L'élégance allemande, gérée avec précision. ». À droite, une carte « Heureux de vous revoir » avec les champs Adresse e-mail et Mot de passe, l'icône en forme d'œil pour afficher le mot de passe, et le bouton orange « Se connecter ».

> **Astuce :** cliquez sur l'icône en forme d'œil, dans le champ Mot de passe, pour vérifier ce que vous avez tapé.

**Vous n'avez pas de compte ?** Les comptes sont créés uniquement par un administrateur. Il n'existe pas de bouton « S'inscrire » : adressez-vous à votre administrateur.

**Vous avez oublié votre mot de passe ?** Demandez à un administrateur de le réinitialiser (voir 6.19). Il vous communiquera un mot de passe temporaire, que vous changerez ensuite vous-même (voir 2.4).

## 2.2 Découvrir l'écran

L'écran est toujours composé de trois zones.

> **[Capture d'écran] Écran principal de l'application**
>
> À gauche, le menu latéral avec le logo en haut. Au centre, le contenu de la page (ici le tableau de bord). En haut à droite, les boutons Thème, Notifications et le menu du compte.

### Le menu latéral (à gauche)

Il est découpé en blocs :

- **Principal** : Tableau de bord, Produits, Mouvements de stocks, Devis, Commandes, Ventes, Achats, Retours, Rendez-vous.
- **Opérations** : Projets, Fournisseurs, Dépôts, Documents, Rapports, Journal d'actions.
- **Administration** (administrateurs uniquement) : Utilisateurs, Rôles & permissions, Journal d'audit.
- En bas : **Paramètres**.

La page ouverte est surlignée en orange.

> **Bon à savoir :** vous ne voyez que les menus autorisés pour votre rôle. Si un menu cité dans ce guide n'apparaît pas chez vous, c'est normal : votre rôle n'y a pas accès.

Le bouton en haut à gauche de la barre supérieure (icône de panneau) **réduit le menu** à de simples icônes, pour gagner de la place. Cliquez à nouveau pour le déplier.

### La barre supérieure (en haut à droite)

| Bouton | Rôle |
|---|---|
| Lune / Soleil | Passer du thème clair au thème sombre, et inversement. |
| Cloche | Ouvrir les **notifications**. Le chiffre indique le nombre d'alertes. |
| Initiale + e-mail | Ouvrir le menu du compte : votre e-mail, le badge « Admin » si vous êtes administrateur, et **Déconnexion**. |

### Les notifications

La cloche regroupe automatiquement (mise à jour chaque minute) :

- les **rendez-vous** prévus dans les 24 prochaines heures ;
- les **produits en stock bas** (quantité inférieure ou égale au seuil minimum) ;
- les **commandes en attente de validation**.

Cliquez sur une notification pour ouvrir la page concernée.

## 2.3 Se déconnecter

Cliquez sur votre initiale en haut à droite, puis sur **Déconnexion**.

> **Important :** sur un ordinateur partagé, déconnectez-vous toujours en quittant votre poste.

## 2.4 Changer son mot de passe et le thème

Ouvrez **Paramètres** (en bas du menu).

**Changer le mot de passe :**

1. Saisissez le **Mot de passe actuel**.
2. Saisissez le **Nouveau mot de passe** (8 caractères minimum).
3. Retapez-le dans **Confirmer le nouveau mot de passe**.
4. Cliquez sur **Changer le mot de passe**, puis confirmez.

L'ancien mot de passe cesse immédiatement de fonctionner. Vous restez connecté sur l'appareil en cours.

**Changer l'apparence :** dans la carte **Apparence**, choisissez **Clair** ou **Sombre**.

> **[Capture d'écran] Page Paramètres**
>
> Trois cartes empilées : « Sécurité » (les trois champs de mot de passe), « Apparence » (boutons Clair / Sombre) et « Notifications » (quatre interrupteurs : Alertes stock, Nouveaux projets, Rendez-vous, Commandes).

# 3. Les gestes qui reviennent partout

Toutes les pages de liste fonctionnent de la même manière. Une fois ces gestes connus, vous saurez utiliser tout l'ERP.

## 3.1 Rechercher et filtrer

- **Barre de recherche** : tapez un numéro (ex. `CMD-…`) ou un nom de client. La liste se met à jour pendant la frappe.
- **Listes déroulantes de filtre** : statut, client, dépôt, mode de paiement…
- **Dates « Du » / « Au »** : limitent la liste à une période.
- **Réinitialiser** : apparaît dès qu'un filtre est actif, et remet tout à zéro.
- Le compteur à droite indique combien de lignes sont affichées sur le total.

Si aucune ligne ne correspond, l'écran affiche « Aucun résultat pour ces filtres » avec un bouton pour réinitialiser.

## 3.2 Les pages et le nombre de lignes

En bas des tableaux, la **pagination** permet de passer d'une page à l'autre et de choisir le nombre de **Lignes par page**.

## 3.3 Les badges de statut

Les statuts sont affichés sous forme de pastilles colorées :

- **gris** : brouillon, neutre ;
- **bleu** : envoyé, validé, en cours ;
- **orange** : en attente, partiel, stock faible ;
- **vert** : accepté, livré, payé, reçu ;
- **rouge** : refusé, annulé, impayé, en retard, rupture.

## 3.4 Les icônes d'action

Dans la colonne **Actions** des tableaux :

| Icône | Action |
|---|---|
| Œil | Voir le détail |
| Crayon | Modifier |
| Coche | Valider |
| Camion | Livrer |
| Croix dans un cercle | Annuler |
| Flèche vers le bas | Télécharger le PDF |
| Corbeille | Supprimer |

Passez la souris sur une icône pour afficher son nom.

## 3.5 Les confirmations

Avant toute action importante (valider, livrer, annuler, supprimer, changer un statut qui touche au stock), une fenêtre **explique ce qui va se passer** et demande de confirmer. **Lisez-la** : elle indique par exemple si la marchandise va sortir du stock ou y revenir.

Un message apparaît ensuite en bas de l'écran : vert en cas de succès, rouge en cas d'erreur (avec la raison).

## 3.6 Les documents PDF

Les devis, bons de commande, factures et rapports se téléchargent en PDF, prêts à imprimer ou à envoyer. Le fichier est créé directement dans votre navigateur et enregistré dans votre dossier Téléchargements.

# 4. Qui peut faire quoi ?

## 4.1 Les six rôles

Chaque utilisateur possède **un rôle**. Le rôle détermine les menus visibles et les actions autorisées.

| Rôle | Mission principale |
|---|---|
| **Administrateur** | Accès complet. Gère aussi les utilisateurs, les rôles, le catalogue, les dépôts et les fournisseurs. |
| **Manager** | Pilote l'activité : devis, commandes (y compris validation), ventes, factures, achats, projets et rapports. |
| **Commercial** | Suit les clients : devis, commandes, ventes, projets, rendez-vous. |
| **Magasinier** | Gère la marchandise : mouvements de stock, achats fournisseurs et réceptions, retours, inventaire. |
| **Comptable** | Consulte les ventes, commandes et achats, imprime et exporte les rapports. |
| **Employé** | Consultation : produits, stock, commandes, ventes, projets. |

> **Bon à savoir :** l'administrateur peut modifier les permissions de chaque rôle, et même ajuster les droits d'une personne en particulier. Le tableau ci-dessous décrit la **configuration en place au 14/09/2026**. En cas de doute, l'écran *Rôles & permissions* fait foi.

## 4.2 Tableau récapitulatif

Légende : **✔** = autorisé · **Voir** = consultation seulement · **—** = pas d'accès.

| Écran | Admin | Manager | Commercial | Magasinier | Comptable | Employé |
|---|---|---|---|---|---|---|
| Tableau de bord | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Produits (catalogue) | ✔ | Voir | Voir | Voir | — | Voir |
| Mouvements de stocks (saisie) | ✔ | Voir | Voir | ✔ | Voir | Voir |
| Dépôts | ✔ | Voir | Voir | Voir | Voir | Voir |
| Devis | ✔ | ✔ | ✔ | — | Voir | Voir |
| Commandes (créer, valider, livrer, paiements) | ✔ | ✔ | ✔ | Voir | Voir | Voir |
| Ventes | ✔ | ✔ | ✔ | Voir | Voir | Voir |
| Facturation | ✔ | ✔ | ✔ | Voir | Voir | Voir |
| Achats | ✔ | ✔ | — | ✔ | — | — |
| Retours | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Rendez-vous (les siens) | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Projets | ✔ | ✔ | ✔ | Voir | Voir | Voir |
| Fournisseurs | ✔ | Voir | — | Voir | — | — |
| Documents (les siens) | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Rapports | ✔ | ✔ | ✔ | — | ✔ | — |
| Journal d'actions (le sien) | Tout | ✔ | ✔ | ✔ | ✔ | ✔ |
| Administration | ✔ | — | — | — | — | — |

**Précisions :**

- **Suppression** : seul l'Administrateur peut supprimer des devis, commandes, ventes, factures, achats, projets ou clients.
- **Rendez-vous et Documents** : chacun voit ceux qu'il a créés (et, pour les rendez-vous, ceux qui lui sont assignés). L'Administrateur voit tout.
- **Journal d'actions** : chacun voit ses propres actions ; l'Administrateur voit celles de tout le monde.
- Un menu peut rester visible alors que la liste est vide : cela signifie que votre rôle peut ouvrir la page, mais pas consulter les données (par exemple *Devis* pour le Magasinier).

# 5. Le guide de votre rôle

Chaque section présente votre mission, votre menu et vos tâches courantes, avec un renvoi vers l'écran détaillé du chapitre 6.

## 5.1 Administrateur

**Votre mission :** garantir que l'ERP fonctionne pour tout le monde. Vous avez accès à tout, et vous êtes la seule personne à pouvoir gérer les comptes, les rôles, le catalogue produits, les dépôts et les fournisseurs.

**Votre menu :** l'intégralité du menu, plus le bloc **Administration** (Utilisateurs, Rôles & permissions, Journal d'audit). Le badge « Admin » apparaît dans votre menu de compte.

**Vos tâches courantes :**

| Je veux… | Où / comment |
|---|---|
| Créer un compte pour un nouveau collègue | *Utilisateurs* → **Créer utilisateur** (6.19) |
| Réinitialiser un mot de passe oublié | *Utilisateurs* → icône clé sur la ligne (6.19) |
| Bloquer l'accès d'une personne qui part | *Utilisateurs* → icône **Bloquer** (6.19) |
| Ajuster ce qu'un rôle peut faire | *Rôles & permissions* (6.20) |
| Donner un droit à une seule personne | Fiche utilisateur → onglet **Permissions** (6.19) |
| Ajouter ou modifier un produit | *Produits* → **Ajouter un produit** / crayon (6.2) |
| Créer un dépôt | *Dépôts* → **Nouveau dépôt** (6.4) |
| Ajouter un fournisseur | *Fournisseurs* → **Nouveau fournisseur** (6.14) |
| Corriger une erreur de saisie de stock | *Mouvements de stocks* (6.3) |
| Savoir qui a fait quoi | *Journal d'audit* (6.21) et *Journal d'actions* (6.17) |

> **Important :** la suppression est définitive. Quand un document a déplacé du stock (commande livrée, facture, achat reçu…), sa suppression **réintègre ou retire automatiquement** la marchandise. Préférez **Annuler** à **Supprimer** : l'annulation garde une trace.

**Une bonne routine :**

1. Le matin, ouvrez la **cloche** : commandes en attente, stocks bas, rendez-vous du jour.
2. Chaque semaine, parcourez le **Journal d'audit** pour repérer les anomalies.
3. Au départ d'un collaborateur, **bloquez** son compte le jour même.

## 5.2 Manager

**Votre mission :** piloter l'activité commerciale et logistique au quotidien. Vous transformez les devis en commandes, validez et suivez les commandes, gérez les achats fournisseurs et analysez les résultats.

**Votre menu :** Tableau de bord, Produits, Mouvements de stocks, Devis, Commandes, Ventes, Achats, Retours, Rendez-vous, Projets, Fournisseurs, Dépôts, Documents, Rapports, Journal d'actions, Paramètres.

**Vos tâches courantes :**

| Je veux… | Où / comment |
|---|---|
| Suivre le chiffre d'affaires et les alertes | *Tableau de bord* (6.1) |
| Faire accepter un devis et créer la commande | *Devis* → fiche → **Accepté** (6.5) |
| Valider une commande en attente | *Commandes* → icône coche (6.6) |
| Enregistrer un acompte ou un paiement | Fiche commande → **Paiements** (6.6) |
| Émettre une facture | *Facturation* (6.8) |
| Commander chez un fournisseur | *Achats* → **Nouvel achat** (6.9) |
| Suivre un chantier de cuisine | *Projets* (6.13) |
| Exporter les chiffres du mois | *Rapports* → Excel ou PDF (6.16) |

> **Bon à savoir :** dans la configuration actuelle, la création et la modification des fiches produits, dépôts et fournisseurs sont réservées à l'Administrateur. Si vous devez corriger un produit, demandez-le à un administrateur.

**Le circuit à connaître par cœur :** voir la section 6.0, *Le circuit de vente en un coup d'œil*.

## 5.3 Commercial

**Votre mission :** accompagner le client, du premier rendez-vous jusqu'à la commande et au paiement.

**Votre menu :** Tableau de bord, Produits (consultation), Mouvements de stocks (consultation), Devis, Commandes, Ventes, Retours, Rendez-vous, Projets, Dépôts, Documents, Rapports, Journal d'actions, Paramètres.

**Votre journée type :**

1. **Planifier vos rendez-vous** : *Rendez-vous* → **Nouveau rendez-vous** (6.12). Vous recevez un rappel dans la cloche 24 h avant.
2. **Préparer un devis** : *Devis* → **Nouveau Devis**, saisissez le client, puis ajoutez les produits (6.5).
3. **Envoyer le devis** : téléchargez le PDF, transmettez-le au client, puis cliquez sur **Marquer envoyé**.
4. **Le client accepte** : cliquez sur **Accepté**. Une **commande** est créée automatiquement.
5. **Encaisser un acompte** : ouvrez la commande → **Paiements** → montant et mode → **Ajouter** (6.6).
6. **Suivre le chantier** : créez ou mettez à jour le **Projet** du client (6.13).
7. **Classer les pièces** : plans, contrats et photos dans *Documents* (6.15).

> **Astuce :** avant d'ajouter un produit à un devis ou une commande, regardez la liste **Dépôt** : elle n'affiche que les dépôts qui ont réellement ce produit en stock, avec la quantité disponible.

> **Bon à savoir :** vous pouvez créer et modifier devis, commandes et ventes, mais pas les supprimer. En cas d'erreur, **annulez** le document ou demandez à un administrateur.

## 5.4 Magasinier

**Votre mission :** que le stock affiché corresponde toujours à la réalité des dépôts.

**Votre menu :** Tableau de bord, Produits, Mouvements de stocks, Devis (vide pour votre rôle), Commandes, Ventes, Achats, Retours, Rendez-vous, Projets, Fournisseurs, Dépôts, Documents, Journal d'actions, Paramètres.

**Vos tâches courantes :**

| Situation | Que faire |
|---|---|
| Un fournisseur livre | *Achats* → ligne de l'achat → **Marquer reçu** (6.9). La marchandise entre en stock. |
| Une commande client doit être préparée | *Commandes* → ouvrez la commande pour voir les produits et le dépôt de chaque ligne (6.6). |
| La marchandise part chez le client | Prévenez le Manager ou le Commercial, qui clique sur **Livrer** dans l'ERP à ce moment-là (6.6). |
| Un article est cassé ou abîmé | *Mouvements de stocks* → **Nouveau mouvement** → type **Endommagé** (6.3). |
| Une entrée ou sortie manuelle | *Mouvements de stocks* → **Nouveau mouvement** → **Entrée** ou **Sortie** (6.3). |
| Un client rapporte un article | *Retours* → **Nouveau retour** → **Retour client** (6.10). |
| On renvoie un article au fournisseur | *Retours* → **Nouveau retour** → **Retour fournisseur** (6.10). |
| Faire l'inventaire | *Mouvements de stocks* → tableau d'inventaire → export CSV ou PDF (6.3). |

> **Important :** une commande ne doit être marquée **Livrée** dans l'ERP **qu'au moment où la marchandise quitte réellement le dépôt**. C'est la livraison, et non la validation, qui sort le stock.

> **Bon à savoir :** valider et livrer une commande demande la permission **Modifier** sur les Commandes, que le rôle Magasinier n'a pas dans la configuration actuelle. Si votre organisation préfère que le magasinier livre lui-même, l'administrateur peut vous l'accorder (6.19 ou 6.20).

> **Astuce :** surveillez la cloche : chaque produit dont la quantité est passée sous son **seuil minimum** y apparaît.

## 5.5 Comptable

**Votre mission :** suivre l'argent : ventes, paiements, factures, achats, et produire les états.

**Votre menu :** Tableau de bord, Mouvements de stocks (consultation), Devis, Commandes, Ventes, Retours, Rendez-vous, Projets, Dépôts, Documents, Rapports, Journal d'actions, Paramètres.

**Vos tâches courantes :**

| Je veux… | Où / comment |
|---|---|
| Voir ce qui reste à encaisser | *Commandes* ou *Ventes* → filtre **Paiement** = Impayée / Partielle ; colonnes **Payé** et **Reste** (6.6, 6.7) |
| Repérer les retards | *Commandes* → filtre statut **En retard** (6.6) |
| Consulter et imprimer une facture | *Facturation* → icône PDF (6.8) |
| Obtenir le chiffre d'affaires d'une période | *Rapports* → dates Du / Au → **Excel** ou **PDF** (6.16) |
| Suivre les avoirs clients | *Rapports* (carte *Retours clients*) et *Retours* (6.10, 6.16) |

> **Bon à savoir :** votre rôle est en **consultation, impression et export**. Pour corriger un montant ou enregistrer un paiement, adressez-vous au Manager ou à l'Administrateur.

## 5.6 Employé

**Votre mission :** retrouver rapidement une information (prix, disponibilité, statut d'une commande) pour renseigner un client ou un collègue.

**Votre menu :** Tableau de bord, Produits, Mouvements de stocks, Devis, Commandes, Ventes, Retours, Rendez-vous, Projets, Dépôts, Documents, Journal d'actions, Paramètres.

**Ce que vous pouvez faire :**

- **Vérifier la disponibilité d'un produit** : *Produits* → recherche par nom ou référence → colonne stock et dépôt (6.2).
- **Donner le statut d'une commande** : *Commandes* → recherche par numéro ou client (6.6).
- **Imprimer** un bon de commande ou une fiche.
- **Gérer vos propres rendez-vous et documents** (6.12, 6.15).

> **Bon à savoir :** les boutons de création et de modification des documents commerciaux ne sont pas prévus pour votre rôle. Si une action vous est refusée, un message rouge l'indique : demandez à votre responsable.

# 6. Les écrans pas à pas

## 6.0 Le circuit de vente en un coup d'œil

C'est le cœur de l'ERP. Retenez **quand le stock bouge** et **quand l'argent est enregistré**.

| Étape | Écran | Ce qui se passe | Stock | Argent |
|---|---|---|---|---|
| 1. Devis | Devis | Proposition au client : Brouillon → Envoyé | — | — |
| 2. Acceptation | Devis → **Accepté** | Une **commande** « En attente » est créée automatiquement | — | — |
| 3. Validation | Commandes → **Valider** | Une **vente** est créée automatiquement | — | Les paiements déjà saisis sont repris |
| 4. Livraison | Commandes → **Livrer** | La commande passe « Livrée » | **Sortie** du stock | — |
| 5. Paiements | Fiche commande ou vente | Chaque encaissement met à jour Payé / Reste | — | Impayée → Partielle → Payée |
| Annulation | Commandes / Ventes → **Annuler** | La commande et sa vente sont annulées | **Retour** en stock si elle était livrée | — |

**Raccourci au comptoir :** l'écran *Ventes* → **Nouvelle vente** enregistre une vente et crée en même temps sa commande validée, pour un client qui achète immédiatement.

**Côté fournisseur :** *Achats* → **Nouvel achat** → le fournisseur livre → **Marquer reçu** → la marchandise **entre** en stock, au coût saisi.

## 6.1 Tableau de bord

**Pour quoi faire :** avoir en un coup d'œil l'état de l'activité.

> **[Capture d'écran] Tableau de bord**
>
> En haut, le titre et le sélecteur de période. Une rangée de quatre cartes chiffrées : Stock total, Entrées de stock, Sorties de stock, Chiffre d'affaires. Dessous, la liste des alertes de stock faible et l'activité récente, puis quatre graphiques : CA Mensuel, Devis par statut, Pipeline commandes, Valeur du stock.

**Ce que vous y trouvez :**

- **Période** : Mois, Trimestre, 6 mois, Année ou Total. Elle s'applique aux entrées, sorties et au chiffre d'affaires.
- **Stock total** : quantité actuellement en stock (non liée à la période).
- **Entrées / Sorties de stock** : volumes sur la période choisie.
- **Chiffre d'affaires** : ventes de la période.
- **Alertes stock faible** : produits au seuil minimum ou en dessous (« Aucune alerte » quand tout va bien).
- **Graphiques** : évolution mensuelle du CA, répartition des devis par statut, commandes par étape, valeur du stock.

## 6.2 Produits

**Pour quoi faire :** consulter le catalogue, les prix, les marges et la disponibilité.

> **[Capture d'écran] Liste des produits**
>
> Titre « Produits — Catalogue, prix et marges ». Trois cartes : Total produits, Stock faible, Rupture de stock. Une barre de filtres (recherche, état du stock, prix min / max, dépôt). Un tableau avec la photo, le nom, la référence, le dépôt, les prix et le stock. En haut à droite, le bouton « Ajouter un produit » (administrateurs).

**Rechercher un produit :** tapez le nom, la référence ou la marque. Filtrez par **état du stock** (En stock, Stock faible, Rupture), par **fourchette de prix** ou par **dépôt** (y compris « Sans dépôt »).

**Voir la fiche d'un produit :** cliquez sur son nom. La fiche montre la galerie de photos, le statut de stock (En stock / Stock faible / Rupture de stock), le ou les dépôts, la marque, la référence, les dimensions, la description et l'historique des mouvements.

> **[Capture d'écran] Fiche produit**
>
> À gauche, la grande photo et les miniatures. À droite, le nom, la pastille de stock, les prix et les caractéristiques (Marque, Référence, Dimensions). Le bouton « Modifier » est visible pour les administrateurs.

**Ajouter ou modifier un produit (Administrateur) :**

1. Cliquez sur **Ajouter un produit**, ou sur le crayon d'une ligne.
2. Renseignez au minimum le **nom**. Complétez de préférence la **référence** (ex. `BOS-DWK-90`), la **marque**, la **catégorie**, le **fournisseur**, le **prix d'achat**, le **prix de vente**, le **seuil minimum**, les **dimensions** et la **description**.
3. Ajoutez des **images** : elles sont envoyées au serveur (« Images téléversées »).
4. Cliquez sur **Enregistrer**.

> **Bon à savoir :** la **quantité en stock** et le **dépôt** d'un produit ne se tapent pas dans la fiche. Ils découlent des **mouvements de stock** (achats reçus, livraisons, retours, saisies manuelles). C'est ce qui garantit que les chiffres restent justes.

> **Important :** les prix et quantités négatifs sont refusés. Supprimer un produit conserve son historique de mouvements, mais le produit ne peut plus être sélectionné dans les nouveaux documents.

## 6.3 Mouvements de stocks

**Pour quoi faire :** enregistrer et consulter chaque entrée et sortie de marchandise, et faire l'inventaire.

> **[Capture d'écran] Mouvements de stocks**
>
> Titre « Gestion du stock et inventaire ». Bouton « Nouveau mouvement ». Filtres : produit, dépôt, type, dates, Réinitialiser. Tableau des mouvements (date, produit, type, quantité, dépôt, coût unitaire, motif, auteur). Plus bas, le tableau d'inventaire : Référence, Nom du produit, Quantité en stock, Endommagé, Prix d'achat (TTC), Valeur totale, avec la ligne Total.

**Les types de mouvement :**

| Type | Sens | Créé par |
|---|---|---|
| Entrée | + stock | Saisie manuelle |
| Achat | + stock | Réception d'un achat |
| Retour client | + stock | Retour client |
| Inventaire | + stock | Correction d'inventaire |
| Sortie | − stock | Saisie manuelle |
| Vente | − stock | Livraison d'une commande ou d'une vente, facture |
| Retour fournisseur | − stock | Retour fournisseur |
| Endommagé | stock vendable → stock endommagé | Saisie manuelle |

**Saisir un mouvement manuel (Administrateur, Magasinier) :**

1. Cliquez sur **Nouveau mouvement**.
2. Choisissez le **Produit**.
3. Choisissez le type : **Entrée**, **Sortie** ou **Endommagé**.
4. Indiquez la **Quantité**, le **Coût unitaire** (pour une entrée) et le **Dépôt**.
5. Vérifiez la **Date du mouvement** (aujourd'hui par défaut).
6. Écrivez un **motif** clair (ex. « Vente, livraison, retour… »).
7. Validez.

> **Important :** une sortie ou un passage en « Endommagé » est **refusé si le stock est insuffisant** (message « Stock insuffisant pour ce produit »). Vérifiez le dépôt et la quantité.

> **Important :** ne changez la **date du mouvement** que pour enregistrer un événement réellement survenu à cette date. Un mouvement antidaté fausse les rapports de la période concernée.

**L'inventaire :** le tableau du bas donne pour chaque produit la quantité en stock, la quantité endommagée, le prix d'achat et la **valeur totale**. Exportez-le en **CSV** (`inventaire.csv`) ou en **PDF** (`inventaire.pdf`).

## 6.4 Dépôts

**Pour quoi faire :** lister les lieux de stockage.

> **[Capture d'écran] Dépôts**
>
> Titre « Dépôts — Gérer les dépôts et entrepôts ». Barre de recherche. Tableau : Nom, Marchandises, Responsable, Adresse, Statut (Actif / Inactif), Créé le, Actions.

**Créer un dépôt (Administrateur) :** **Nouveau dépôt** → **Nom du dépôt** et **Marchandises** (obligatoires, ex. « Électroménager Bosch, Caissons, Panneaux »), puis **Responsable**, **Adresse** et **Description** → Enregistrer.

**Désactiver plutôt que supprimer :** un dépôt **Inactif** n'est plus proposé dans les nouveaux documents, mais son historique reste intact. Supprimer un dépôt détache tous les produits qui y étaient rattachés.

## 6.5 Devis

**Pour quoi faire :** préparer une proposition chiffrée et la transformer en commande.

> **[Capture d'écran] Liste des devis**
>
> Titre « Devis — Gérez et générez vos devis clients ». Bouton « Nouveau Devis ». Recherche (numéro, client) et filtre de statut. Tableau : Numéro, Date, Client, Total, Statut, Actions (voir, PDF, supprimer).

**Les statuts :** Brouillon → Envoyé → Accepté ou Refusé. Un devis peut aussi être Expiré ou Annulé. Il est valable 30 jours par défaut.

**Créer un devis :**

1. **Nouveau Devis**.
2. Saisissez le **Nom du client**, son **Téléphone**, son **Email** et son **Adresse**. Laissez le nom vide pour un **prospect**.
3. **Créer** : la fiche du devis s'ouvre, en **Brouillon**.
4. **Ajouter produit** : choisissez le **Produit** (le prix de vente se remplit), ajustez **Prix unitaire**, **Quantité** et **Remise (%)**, puis choisissez le **Dépôt** (seuls les dépôts approvisionnés sont proposés, avec leur stock).
5. Répétez pour chaque ligne. Le **Résumé financier** se met à jour.

> **[Capture d'écran] Fiche devis**
>
> En haut, le numéro, la pastille de statut et les boutons Marquer envoyé / Annuler / Télécharger PDF. Au centre, le tableau « Lignes du devis » (Produit, PU, Qté, Remise, Total) et le bouton « Ajouter produit ». À droite, les cartes « Résumé financier » et « Client ».

**Faire vivre le devis :**

- **Télécharger PDF** : pour l'envoyer au client.
- **Marquer envoyé** : le devis n'est plus modifiable (les lignes ne peuvent être ajoutées qu'en Brouillon).
- **Accepté** : crée automatiquement la **commande** correspondante (message « Devis accepté — Commande … créée ! »).
- **Refusé** : le client décline.
- **Annuler** : possible en Brouillon, Envoyé ou Expiré. Le devis reste consultable.

> **Important :** un devis **Accepté** est lié à sa commande : il ne peut plus être supprimé.

## 6.6 Commandes

**Pour quoi faire :** suivre l'engagement du client jusqu'à la livraison et au paiement complet.

> **[Capture d'écran] Liste des commandes**
>
> Titre « Commandes clients — Cycle de vie, délais et livraison ». Cinq cartes : En attente, Validées, Livrées, Annulées, En retard. Filtres : recherche, statut (dont « En retard »), paiement, client, dépôt, dates. Tableau : N°, Client, Dépôt, Date, Dernier jour, Délai, Total, Payé, Reste, Statut, Paiement, Actions.

**Les statuts :**

- **Commande** : En attente → Validée → Livrée, ou Annulée.
- **Paiement** : Impayée → Partielle → Payée (calculé automatiquement à partir des paiements).
- **Délai** : nombre de jours restants avant le **Dernier jour** ; orange à 3 jours ou moins, rouge « Xj retard » une fois dépassé.

**Créer une commande directement (sans devis) :**

1. **Nouvelle commande**.
2. **Nom du client**, **Date commande** et **Dernier jour** (14 jours plus tard par défaut).
3. Ajoutez les produits :
   - **Ligne** : une ligne à la fois. Choisissez le produit (ou « — Libre — » pour une prestation), le **Dépôt**, la **Qté**, le **PU** et la **Rem %**.
   - **Plusieurs produits** : cochez plusieurs articles d'un coup, avec leurs quantités, puis **Ajouter**.
4. Ajoutez des **Notes** si besoin. Vérifiez le **Total**.
5. **Créer**.

> **[Capture d'écran] Fenêtre « Nouvelle commande »**
>
> Champs client et dates en haut ; tableau des lignes avec les colonnes Produit / Description, Dépôt, Qté, PU, Rem %, Total ; boutons « Plusieurs produits » et « Ligne » ; zone Notes ; total en bas et bouton « Créer ».

> **Astuce :** si « Produit indisponible en stock » ou « Aucun dépôt approvisionné » s'affiche, le produit n'a de stock dans aucun dépôt : prévenez le magasinier ou passez un achat.

**Faire avancer une commande** (icônes de la ligne, ou boutons de la fiche) :

| Action | Quand | Effet |
|---|---|---|
| **Valider** (coche) | Commande « En attente » | Crée la **vente**. Le stock ne bouge pas encore. |
| **Livrer** (camion) | Commande « Validée » | **Sort la marchandise du stock.** |
| **Annuler** (croix) | Tant qu'elle n'est pas annulée | Annule la commande et sa vente ; **réintègre le stock** si elle était livrée. |
| **Supprimer** (corbeille) | Administrateur | Efface la commande ; réintègre le stock si elle était livrée. |

**Enregistrer un paiement :**

1. Ouvrez la commande (clic sur son numéro).
2. Dans **Paiements**, saisissez le **Montant** et le **Mode** : Espèces, Carte, Virement, Chèque ou Crédit.
3. **Ajouter**.

Le **Payé**, le **Reste** et le statut de paiement se mettent à jour. Un montant supérieur au reste à payer est refusé.

> **[Capture d'écran] Fiche commande**
>
> En-tête avec le numéro, l'échéance et les boutons Valider / Livrer / Annuler / Bon de commande. Trois cartes : Client, Statuts (commande et paiement), Total / Payé / Reste. Dessous, « Produits commandés », puis « Paiements » avec le formulaire Montant + Mode + Ajouter et l'historique des paiements.

**Imprimer :** le bouton **Bon de commande** génère le PDF de la commande.

## 6.7 Ventes

**Pour quoi faire :** voir toutes les transactions, encaisser et vendre au comptoir.

> **[Capture d'écran] Liste des ventes**
>
> Titre « Ventes — Transactions encaissées et facturation rapide ». Bouton « Nouvelle vente ». Filtres : recherche, statut, mode, client, dépôt, dates. Tableau : N°, Client (ou « Comptoir »), Dépôt, Date, Total, Payé, Reste, Mode, Échéance, Statut, Actions.

**D'où viennent les ventes ?**

- **Automatiquement**, quand une commande est validée.
- **Manuellement**, via **Nouvelle vente**, pour un achat immédiat. La commande validée correspondante est alors créée en même temps (« Vente enregistrée — commande validée créée »).

**Nouvelle vente (comptoir) :**

1. **Nouvelle vente**. Laissez le **Nom du client** vide pour une vente « Comptoir ».
2. **Date**, **Mode paiement**, **Échéance**.
3. Ajoutez les produits (comme pour une commande).
4. Indiquez le **Montant payé** : le **Reste à payer** se calcule.
5. **Créer**.

**Actions sur une vente :** Voir, **Bon de commande** (PDF), **Livrer** (sort le stock), **Annuler** (réintègre le stock et annule aussi la commande d'origine), Supprimer (Administrateur). La fiche d'une vente permet aussi d'ajouter des **paiements**, avec une note.

## 6.8 Facturation

**Pour quoi faire :** émettre les factures clients.

> **Bon à savoir :** la Facturation n'a pas encore d'entrée dans le menu. Ouvrez-la en tapant **https://noltenador.digital/invoices** dans la barre d'adresse, et ajoutez la page à vos favoris.

> **[Capture d'écran] Facturation**
>
> Titre « Facturation — Factures clients et encaissements ». Bouton « Nouvelle facture ». Filtres : recherche, statut, client, dépôt, dates. Tableau : N°, Client, Dépôt, Date, Échéance, Total TTC, Statut (liste déroulante modifiable), Actions (voir, PDF, supprimer).

**Créer une facture :**

1. **Nouvelle facture**.
2. **Client \*** (obligatoire), **Date facture**, **Échéance**.
3. Ajoutez les lignes : produit ou ligne libre, dépôt, quantité, prix, remise.
4. **Notes** et **Statut initial** : Brouillon, En attente ou Payée.
5. **Créer**.

**Changer le statut :** utilisez la liste déroulante directement dans le tableau. La fenêtre de confirmation vous indique l'effet sur le stock :

- passer en **En attente** ou **Payée** → la marchandise facturée **sort du stock** ;
- revenir en **Brouillon** ou passer en **Annulée** → la marchandise est **réintégrée**.

> **Important :** une facture « En attente » ou « Payée » sort du stock, comme une livraison. **Ne facturez pas une commande déjà livrée avec des lignes produits** : le stock serait sorti deux fois. Pour ce cas, utilisez des lignes libres ou demandez conseil à l'administrateur.

**La fiche facture** affiche le client, les dates, les lignes et le **Total TTC**. Elle permet aussi :

- **Prix de Mr Bouhlalla (optionnel)** : montant affiché sur la facture à titre d'information, sans modifier le total ;
- **Ajouter un prix personnalisé** : un libellé (ex. Montage, Transport) et un montant, soit **ajouté au total**, soit **affiché comme information**.

## 6.9 Achats

**Pour quoi faire :** commander chez les fournisseurs et réceptionner la marchandise.

> **[Capture d'écran] Achats**
>
> Liste des achats avec N°, Fournisseur, Dépôt, Date, Statut et les actions « Marquer reçu », « Annuler », « Supprimer ». Bouton « Nouvel achat ».

**Les statuts :** Brouillon, Envoyé, Confirmé, En préparation, Expédié, **Reçu**, Annulé.

**Créer un achat :**

1. **Nouvel achat**.
2. **Fournisseur**, **Dépôt de réception**, **Date** et **Date prévue**.
3. Lignes **Produits** : produit, **Qté** et **Coût unitaire**.
4. **Notes**, puis créer (« Achat créé »).

**Réceptionner :** à l'arrivée de la marchandise, cliquez sur **Marquer reçu** puis **Recevoir**. La marchandise **entre en stock** dans le dépôt de l'achat, au coût des lignes.

> **Important :** annuler ou supprimer un achat **déjà reçu** retire la marchandise du stock.

## 6.10 Retours

**Pour quoi faire :** enregistrer un article rendu par un client (avoir) ou renvoyé à un fournisseur.

> **[Capture d'écran] Retours**
>
> Filtre « Tous les retours / Retours clients (avoirs) / Retours fournisseurs ». Tableau : N°, Type, Date, Tiers, montant, Statut, action « Annuler le retour ». Bouton « Nouveau retour ».

**Créer un retour :**

1. **Nouveau retour**, puis choisissez le **Type de retour** :
   - **Retour client (avoir)** : la marchandise revient en stock ;
   - **Retour fournisseur** : la marchandise sort du stock.
2. **Date** et **Dépôt**.
3. Retour client : sélectionnez la **Vente liée (optionnel)** ou « Retour libre (sans vente) » avec le **Nom du client**. Retour fournisseur : choisissez le **Fournisseur**.
4. Ajoutez les **Lignes** : au prix de vente pour un client, au coût unitaire pour un fournisseur.
5. Indiquez le **Motif**, puis validez.

**Annuler un retour :** l'icône **Annuler le retour** inverse le mouvement de stock.

## 6.11 Clients

Il n'y a pas d'écran « Clients » séparé : un client est créé automatiquement quand vous saisissez son nom dans un devis, une commande ou une vente. Il apparaît ensuite dans les filtres **Client** de toutes les listes.

> **Astuce :** écrivez le nom du client **toujours de la même façon** (ex. « Karim Benali » plutôt que « Mr Benali »), sinon il apparaîtra en double dans les filtres.

## 6.12 Rendez-vous

**Pour quoi faire :** planifier les visites, prises de mesures, livraisons et poses.

> **[Capture d'écran] Agenda des rendez-vous**
>
> Onglets Mois / Semaine / Jour / Liste. Un calendrier coloré selon le statut (Planifié bleu, Confirmé vert, En cours orange, Terminé gris, Annulé rouge). Filtres statut et client. Bouton « Nouveau rendez-vous ».

**Changer de vue :** **Mois**, **Semaine**, **Jour** ou **Liste** (tableau : Titre, Client, Commercial, Début, Fin, Statut).

**Créer un rendez-vous :**

1. **Nouveau rendez-vous**.
2. **Titre \*** (obligatoire), **Client (optionnel)**, **Commercial assigné**.
3. **Début \*** et **Fin \***, **Lieu**.
4. **Statut** : Planifié, Confirmé, En cours, Terminé ou Annulé.
5. **Description**, **Notes / Commentaires**, **Rappel (minutes avant)**.
6. Enregistrer.

Cliquez sur un rendez-vous pour voir le détail, le modifier ou le supprimer.

> **Bon à savoir :** vous voyez les rendez-vous que vous avez créés et ceux qui vous sont assignés. Les rendez-vous « Planifié » ou « Confirmé » des prochaines 24 h apparaissent dans la cloche.

## 6.13 Projets

**Pour quoi faire :** suivre un chantier de cuisine, de la conception à la réception par le client.

> **[Capture d'écran] Liste des projets**
>
> Bouton « Nouveau projet ». Filtre de statut. Tableau : Projet, Client, Début, Fin prévue, avancement, budget, Statut (En cours, En pause, Terminé, Annulé), Actions.

**Créer un projet :** **Nouveau projet** → **Nom du projet \***, **Nom du client**, **Dépôt**, **Budget (DH)**, **Date de début**, **Date de fin prévue**, **Adresse d'installation**, **Notes** → Créer.

**Les 9 étapes créées automatiquement :** Conception → Validation client → Commande fournisseur → Réception marchandises → Préparation → Livraison → Installation → Contrôle qualité → Terminé.

**La fiche projet** comporte trois onglets :

- **Étapes** : cochez et datez chaque étape. L'**avancement** du projet se calcule tout seul.
- **Documents & Photos** : joignez plans, bons et photos du chantier (« Fichier ajouté »).
- **Historique** : tout ce qui s'est passé sur le projet.

**Éditer le projet** permet de modifier ses informations, et le statut se change depuis la liste ou la fiche.

> **Important :** supprimer un projet efface aussi ses étapes, ses pièces jointes et son historique.

## 6.14 Fournisseurs

**Pour quoi faire :** tenir le carnet de contacts des fournisseurs.

> **[Capture d'écran] Fournisseurs**
>
> Titre « Fournisseurs — Carnet de contacts ». Tableau : Nom, Contact, Email, Téléphone, Actions (administrateurs).

**Ajouter (Administrateur) :** **Nouveau fournisseur** → nom, personne de contact, e-mail, téléphone, adresse → Enregistrer. Supprimer un fournisseur détache les produits qui lui étaient rattachés.

## 6.15 Documents

**Pour quoi faire :** centraliser les fichiers (factures scannées, contrats, plans, photos, SAV).

> **[Capture d'écran] Documents**
>
> Quatre cartes : Total documents, Ce mois-ci, Factures, Contrats. Filtres par catégorie et par client. Tableau : Nom du document, Catégorie (pastille colorée), Client, Date d'ajout, Taille, Actions (Télécharger, Historique, Supprimer).

**Importer un document :**

1. Bouton d'import → **Fichier (PDF, Word, Excel, Image)**.
2. **Nom du document**.
3. **Catégorie** : Factures, Devis, Contrats, Projets cuisines, SAV, Photos ou Autres.
4. **Nom du client** et **Description**.
5. Valider (« Document ajouté »).

**Actions :** **Télécharger**, **Historique** (qui a ajouté ou modifié le document, et quand), **Supprimer**.

> **Bon à savoir :** chacun ne voit que les documents qu'il a importés ; l'administrateur voit tout.

## 6.16 Rapports

**Pour quoi faire :** analyser les ventes, le stock et les marges, et exporter les chiffres.

> **[Capture d'écran] Rapports**
>
> Filtres Du / Au, Client, Produit, Catégorie, Réinitialiser, et boutons d'export Excel et PDF. Six cartes : Chiffre d'affaires net, Achats, Stock endommagé, Retours clients (avoirs), Ventes du mois, Produits en stock. Quatre graphiques : Évolution des ventes, Évolution du stock, Ventes par catégorie, Top 10 produits. Tableau « Performances produits ».

**Utilisation :**

1. Réglez la période (**Du** / **Au**) et, si besoin, un **Client**, un **Produit** ou une **Catégorie**.
2. Lisez les cartes et graphiques.
3. Le tableau **Performances produits** donne pour chaque produit : Référence, Quantité vendue, Chiffre d'affaires, Marge et Marge %.
4. Exportez en **Excel** (« Export Excel généré ») ou en **PDF** (« Export PDF généré »).

## 6.17 Journal d'actions

**Pour quoi faire :** retrouver ce qui a été fait, par qui et quand.

> **[Capture d'écran] Journal d'actions**
>
> Filtres : utilisateur, module, action, période (dont « Aujourd'hui »). Tableau : Date / Heure, Utilisateur, Module, Action (pastille : Création, Modification, Suppression, Connexion, Déconnexion, Export, Validation, Consultation), Description, IP. Clic sur une ligne → « Détail de l'action ».

Cliquez sur une ligne pour voir le détail, y compris les valeurs avant et après modification.

## 6.18 Paramètres

Voir la section 2.4 : mot de passe, thème et préférences de notifications.

> **Bon à savoir :** les interrupteurs de la carte **Notifications** sont enregistrés dans votre navigateur uniquement. Ils ne vous suivent pas sur un autre ordinateur.

## 6.19 Utilisateurs (Administrateur)

> **[Capture d'écran] Utilisateurs**
>
> Titre « Utilisateurs — Gérez les utilisateurs et leurs permissions ». Bouton « Créer utilisateur ». Filtres : recherche (nom ou email), rôle, statut. Tableau : Nom complet, Email, Rôle, Permissions, Statut (Actif, Inactif, Bloqué), Dernière connexion, Actions (Réinitialiser mot de passe, Bloquer / Débloquer, Modifier, Supprimer).

**Créer un compte :**

1. **Créer utilisateur**.
2. **Nom complet**, **Email**, **Téléphone** et **Département**.
3. **Mot de passe** : un mot de passe est proposé ; le bouton **Régénérer** en crée un autre.
4. **Rôle** : les permissions héritées du rôle s'affichent.
5. Validez. Le **mot de passe temporaire** s'affiche **une seule fois** : notez-le et transmettez-le à la personne, qui le changera dans Paramètres.

**Réinitialiser un mot de passe :** icône **Réinitialiser mot de passe** → confirmer → le nouveau mot de passe s'affiche une seule fois.

**Bloquer / Débloquer :** une personne bloquée ne peut plus se connecter. Son historique est conservé.

**La fiche utilisateur** (clic sur le nom) comporte trois onglets :

- **Profil** : Nom complet, Nom d'utilisateur, Téléphone, Département.
- **Permissions** : le détail module par module. Vous pouvez **forcer** un droit pour cette personne seulement ; il apparaît alors avec le badge « override ».
- **Historique** : les actions de la personne.

> **Important :** **Supprimer** retire définitivement le compte et son accès. Pour un départ, préférez **Bloquer**.

## 6.20 Rôles & permissions (Administrateur)

> **[Capture d'écran] Gestion des rôles**
>
> À gauche, la liste des rôles (Admin, Manager, Commercial avec le badge « Système » ; Magasinier, Comptable, Employé). À droite, la matrice du rôle sélectionné : une ligne par module, des cases à cocher Voir / Ajouter / Modifier / Supprimer / Exporter / Imprimer, et le bouton d'enregistrement.

**Modifier les permissions d'un rôle :**

1. Sélectionnez le rôle.
2. Cochez ou décochez les cases de chaque module.
3. Enregistrez puis confirmez. Le changement **s'applique immédiatement à tous les utilisateurs** de ce rôle.

**Créer un rôle :** **Nouveau rôle** → nom (ex. « Chef de dépôt ») → cochez les permissions → créer. Un rôle peut aussi être **renommé** ou **supprimé** (sauf les rôles « Système »). Les personnes qui portaient un rôle supprimé basculent sur un rôle par défaut.

## 6.21 Journal d'audit (Administrateur)

> **[Capture d'écran] Journal d'audit**
>
> Titre « Journal d'audit — Toutes les actions effectuées dans le système ». Recherche (action ou utilisateur) et filtre de module. Tableau : Date, Utilisateur, Action, Module, Entité, Ancien, Nouveau.

Il liste **toutes** les actions de **tous** les utilisateurs, avec l'ancienne et la nouvelle valeur. C'est l'outil de contrôle en cas de doute ou de litige.

# 7. Questions fréquentes

**Je ne vois pas un menu dont parle ce guide.**
Votre rôle n'y a pas accès (voir 4.2). Demandez à un administrateur si vous en avez besoin.

**Un message rouge « permission » ou « violates row-level security » apparaît.**
Votre rôle n'autorise pas cette action. Rien n'a été enregistré. Contactez un administrateur.

**Le stock d'un produit me semble faux.**
Ouvrez *Mouvements de stocks*, filtrez sur le produit et relisez les derniers mouvements. Causes fréquentes : une commande livrée deux fois (ou livrée puis facturée avec les mêmes produits), un achat marqué reçu par erreur, un mouvement antidaté. Corrigez avec un mouvement **Inventaire**, **Entrée** ou **Sortie** et un motif explicite.

**J'ai validé une commande par erreur.**
Cliquez sur **Annuler** : la commande et sa vente sont annulées. Si elle avait été livrée, le stock est réintégré.

**Je ne peux pas ajouter de ligne à mon devis.**
Les lignes ne s'ajoutent qu'en **Brouillon**. Un devis déjà envoyé n'est plus modifiable : créez-en un nouveau.

**« Le montant dépasse le reste à payer ».**
Le paiement saisi est plus grand que ce que le client doit encore. Vérifiez le montant ou les paiements déjà enregistrés.

**« Aucun dépôt approvisionné » quand je choisis un produit.**
Le produit n'a de stock dans aucun dépôt. Il faut d'abord le recevoir (achat) ou saisir une entrée.

**Je n'arrive pas à me connecter.**
Vérifiez l'adresse e-mail (sans espace) et le mot de passe (majuscules). Si le problème persiste, votre compte est peut-être **bloqué** ou le mot de passe doit être réinitialisé : contactez un administrateur.

**Où trouver les factures ?**
À l'adresse **https://noltenador.digital/invoices** (voir 6.8).

**Puis-je utiliser l'ERP sur téléphone ou tablette ?**
Oui, dans le navigateur. Le menu se réduit automatiquement sur les petits écrans. Pour la saisie de documents longs (commandes, factures), un ordinateur reste plus confortable.

---

*Guide rédigé à partir de la version de l'application en production au 14/09/2026. Les emplacements « Capture d'écran » sont à compléter par des captures réelles.*
