# Refonte majeure — Nador Cuisine ERP

Refonte de l'architecture métier du projet pour correspondre au flux réel : Devis → Commande → Livraison → Vente + Facture.

## User Review Required

> [!IMPORTANT]
> **Fichier DOCX introuvable** — Le fichier `C:\Users\USER\Desktop\AICHA MARHABA 7 (1).docx` n'existe pas à cet emplacement. Merci de vérifier le chemin ou de le copier sur le bureau. En attendant, je vais créer un design PDF premium basé sur le style "Nador Cuisine" avec le logo et les coordonnées de l'entreprise.

> [!WARNING]
> **Suppression de la page Clients** — Les clients actuels en base resteront accessibles, mais la page dédiée sera retirée de la navigation. Les formulaires de devis, commandes et ventes auront un champ client en saisie libre (nom, tél, adresse) ou sélection d'un client existant. **Est-ce bien ce que vous souhaitez ?**

> [!WARNING]
> **Suppression de la page Facturation** — La page `/invoices` sera retirée de la navigation. Les factures continueront d'être créées automatiquement lors de la validation des commandes, et resteront consultables via les ventes. **Confirmez-vous ?**

## Open Questions

> [!IMPORTANT]
> 1. **Logo Nador Cuisine** — Avez-vous un fichier logo (PNG/SVG) pour "Nador Cuisine" ? Si non, j'utiliserai le logo Nolte Küchen existant.
> 2. **Coordonnées Nador Cuisine** — Quelles sont les informations de l'entreprise à afficher sur les PDFs ? (Adresse, ICE, IF, RC, Tél, Email)
> 3. **Prix TTC produits** — Actuellement les produits ont `purchase_price` et `selling_price` sans indication HT/TTC. Quand vous dites "tous les prix doivent être en TTC", cela signifie :
>    - Le `purchase_price` affiché dans les produits = prix d'achat TTC ?
>    - Le `selling_price` est **retiré** des produits (saisi manuellement en devis/commandes) ?
> 4. **Stock endommagé** — Voulez-vous un nouveau type de mouvement ("damaged" / "endommagé") en plus de "in" et "out" ? Ou un champ séparé pour le comptage ?

---

## Proposed Changes

### Phase 1 — Nettoyage structurel

---

#### 1.1 Suppression de la page Clients

##### [MODIFY] [app-sidebar.tsx](file:///c:/Users/USER/Desktop/nolte%20v1.0/noltekuchen/src/components/app-sidebar.tsx)
- Retirer l'entrée `Clients` (`/customers`) du menu de navigation

##### [DELETE] [_app.customers.tsx](file:///c:/Users/USER/Desktop/nolte%20v1.0/noltekuchen/src/routes/_app.customers.tsx)
- Supprimer la route/page client

##### Impact sur les autres pages :
- **Devis, Commandes, Ventes** — Remplacer le sélecteur de client (dropdown lié à la table `customers`) par un **champ de saisie libre** avec autocomplétion sur les clients existants, et possibilité de saisir un nouveau client (nom + tél + adresse) directement dans le formulaire
- Les données `customers` en base restent intactes (pas de suppression de table)

---

#### 1.2 Suppression de la page Facturation

##### [MODIFY] [app-sidebar.tsx](file:///c:/Users/USER/Desktop/nolte%20v1.0/noltekuchen/src/components/app-sidebar.tsx)
- Retirer l'entrée `Facturation` (`/invoices`) du menu

##### Fichiers concernés (retirés de la navigation, **pas supprimés du code** car les factures sont toujours créées automatiquement) :
- `_app.invoices.index.tsx` — Route conservée mais retirée du sidebar
- `_app.invoices.$id.tsx` — Reste accessible via lien direct depuis les ventes

---

### Phase 2 — Produits

---

#### 2.1 Supprimer SKU

##### [MODIFY] [_app.products.index.tsx](file:///c:/Users/USER/Desktop/nolte%20v1.0/noltekuchen/src/routes/_app.products.index.tsx)
- Retirer le champ `sku` du formulaire de création/édition
- Retirer toute référence à SKU dans l'affichage

##### [MODIFY] [_app.products.$id.tsx](file:///c:/Users/USER/Desktop/nolte%20v1.0/noltekuchen/src/routes/_app.products.$id.tsx)
- Retirer le badge `SKU: …` dans le header
- Retirer le champ SKU du formulaire d'édition
- Retirer le tile spec SKU

#### 2.2 Prix en TTC

##### [MODIFY] [_app.products.index.tsx](file:///c:/Users/USER/Desktop/nolte%20v1.0/noltekuchen/src/routes/_app.products.index.tsx)
- Renommer les labels `Prix d'achat` → `Prix d'achat (TTC)`
- Retirer `Prix de vente` et `Marge` du tableau et du formulaire
- Garder uniquement `purchase_price` comme prix TTC du produit

##### [MODIFY] [_app.products.$id.tsx](file:///c:/Users/USER/Desktop/nolte%20v1.0/noltekuchen/src/routes/_app.products.$id.tsx)
- Idem : retirer selling_price des cartes de résumé
- Afficher `Prix d'achat (TTC)` uniquement

---

### Phase 3 — Flux métier (Devis → Commande → Vente)

---

#### 3.1 Devis validé → Crée une Commande

##### [MODIFY] [_app.quotes.$id.tsx](file:///c:/Users/USER/Desktop/nolte%20v1.0/noltekuchen/src/routes/_app.quotes.$id.tsx)
- Quand le statut passe à `accepted` :
  1. Créer un enregistrement `orders` avec toutes les lignes du devis copiées dans `order_items`
  2. Lier la commande au devis (`source_quote_id` ou notes)
  3. Afficher un toast "Devis accepté — commande créée"
  4. Permettre la saisie manuelle du `unit_price` (prix de vente) par ligne dans le devis

#### 3.2 Commande livrée → Sort du stock

##### [MODIFY] [_app.orders.$id.tsx](file:///c:/Users/USER/Desktop/nolte%20v1.0/noltekuchen/src/routes/_app.orders.$id.tsx)
- **Déplacer** la déduction de stock du statut `validated` vers le statut `delivered`
- Quand statut → `delivered` : créer les `stock_movements` (type: "out")

#### 3.3 Commande validée → Crée Vente + Facture

##### [MODIFY] [_app.orders.$id.tsx](file:///c:/Users/USER/Desktop/nolte%20v1.0/noltekuchen/src/routes/_app.orders.$id.tsx)
- **Garder** la création de facture + vente lors du passage au statut `validated` (déjà implémenté)
- **Retirer** la déduction de stock de ce statut (déplacée vers `delivered`)
- Bon de commande PDF généré automatiquement (téléchargeable)
- Facture PDF liée à la vente

---

### Phase 4 — Mouvements de stock

---

##### [MODIFY] [_app.stock.tsx](file:///c:/Users/USER/Desktop/nolte%20v1.0/noltekuchen/src/routes/_app.stock.tsx)

1. **Impression** — Ajouter un bouton "Imprimer" qui génère un PDF jsPDF des mouvements filtrés
2. **Stock endommagé** — Ajouter un type de mouvement "damaged" (endommagé) en plus de "in" et "out", avec badge rouge dans la table
3. **Inventaire** — Nouvelle section/onglet "Inventaire" :
   - Vue de l'état actuel du stock par produit (total et par dépôt)
   - Boutons "Exporter CSV" et "Imprimer PDF"
   - Filtres par dépôt

##### [NEW] Migration SQL pour ajouter le type `damaged` à l'enum `movement_type` ou accepter la valeur dans le champ existant

---

### Phase 5 — Tableau de bord

---

##### [MODIFY] [_app.dashboard.tsx](file:///c:/Users/USER/Desktop/nolte%20v1.0/noltekuchen/src/routes/_app.dashboard.tsx)

Ajouter les graphiques suivants en plus des deux existants :

1. **Chiffre d'affaires mensuel** — `BarChart` comparant le CA par mois (depuis les ventes `total_ttc`)
2. **Répartition des devis par statut** — `PieChart` / `DonutChart` (brouillon, envoyé, accepté, refusé)
3. **Commandes en cours** — `BarChart` horizontal montrant le nombre de commandes par statut (en attente, validée, livrée, annulée)
4. **Évolution du stock total** — `LineChart` montrant la valeur totale du stock au fil du temps

---

### Phase 6 — PDFs (Devis & Bon de commande)

---

##### [MODIFY] [quote-pdf.ts](file:///c:/Users/USER/Desktop/nolte%20v1.0/noltekuchen/src/lib/quote-pdf.ts)
- Mettre à jour le design avec les informations "Nador Cuisine" (logo, coordonnées, ICE, IF, RC)
- Design premium inspiré du template DOCX (une fois fourni)

##### [NEW] [order-pdf.ts](file:///c:/Users/USER/Desktop/nolte%20v1.0/noltekuchen/src/lib/order-pdf.ts)
- Nouveau générateur PDF pour les bons de commande, même design que les devis mais avec en-tête "BON DE COMMANDE"

---

### Phase 7 — Push des fichiers AI

---

##### Push des fichiers de configuration AI vers git
- Fichiers `.agents/`, contextes, fichiers `.md` dans le repo pour permettre la continuité sur une autre machine

---

## Verification Plan

### Automated Tests
- Aucun framework de test n'est configuré dans ce projet

### Manual Verification
1. **Navigation** — Vérifier que Clients et Facturation ne sont plus dans le sidebar
2. **Produits** — Vérifier que SKU est retiré, prix affichés en TTC, pas de prix de vente
3. **Devis** — Créer un devis, le valider → vérifier qu'une commande est créée
4. **Commande** — Valider une commande → vérifier que vente + facture sont créées. Livrer → vérifier que le stock est déduit
5. **Stock** — Tester l'impression, le mouvement endommagé, et l'inventaire
6. **Dashboard** — Vérifier les 4 nouveaux graphiques
7. **PDF** — Télécharger un devis et un bon de commande, vérifier le design
