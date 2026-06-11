## Objectif

Séparer la section actuelle `/sales` (stub) en **deux modules distincts** :
- `/sales` → **Ventes** (transactions encaissées, factures, paiements)
- `/orders` → **Commandes clients** (cycle de vie : attente → validée → livrée, avec délais)

Tout en DH, design cohérent avec le reste de l'ERP (cards, table shadcn, sidebar).

---

## 1. Base de données (migration Supabase)

### Table `orders` (commandes clients)
- `order_number` (auto `CMD-YYYY-NNNN`, séquence dédiée)
- `customer_id` → `customers`
- `order_date`, `due_date` (dernier jour)
- `status` enum `order_status` : `pending | validated | delivered | cancelled | late`
- `payment_status` enum `payment_status` : `unpaid | partial | paid`
- `subtotal_ht`, `tax_amount`, `total_ttc`, `paid_amount`, `remaining_amount` (généré)
- `notes`, `created_by`, timestamps
- `stock_applied` boolean (déduction stock à la livraison)

### Table `order_items`
- `order_id`, `product_id`, `description`, `quantity`, `unit_price`, `tax_rate`, `discount_rate`, `line_total_ttc`

### Table `sales` (ventes / transactions encaissées)
- `sale_number` (`VTE-YYYY-NNNN`)
- `customer_id` (nullable pour vente comptoir)
- `sale_date`, `payment_due_date`
- `payment_method` enum : `cash | card | transfer | check | credit`
- `payment_status` : `unpaid | partial | paid`
- `subtotal_ht`, `tax_amount`, `total_ttc`, `paid_amount`, `remaining_amount`
- `invoice_id` nullable → lien vers `invoices` quand facture générée
- `order_id` nullable → vente issue d'une commande
- `created_by`, timestamps

### Table `sale_items`
- mêmes colonnes que `order_items` mais `sale_id`

### Table `order_payments` / `sale_payments`
- Historique paiements : `amount`, `method`, `paid_at`, `note`

### Triggers
- `apply_order_stock()` : déduit le stock quand `status` passe à `delivered` (via `stock_movements` type `out`)
- `update_order_payment_status()` : recalcule `payment_status` quand `paid_amount` change
- `mark_late_orders()` : fonction utilitaire (appelée côté UI via filtre `due_date < now() AND status IN (pending, validated)`)
- `set_updated_at` sur les deux tables

### RLS
- `authenticated` : ALL
- `service_role` : ALL
- GRANTs explicites

---

## 2. Pages frontend

### `/orders` — `src/routes/_app.orders.index.tsx`
**Cartes statistiques (5)** : En attente, Validées, Livrées, Annulées, En retard

**Tableau** : N° / Client / Date / Dernier jour / Délai (badge jours restants — vert/orange/rouge) / Total / Payé / Reste / Statut commande / Statut paiement / Actions

**Filtres** : recherche, statut commande, statut paiement, période

**Actions ligne** : Voir, Modifier, Valider (pending→validated), Livrer (→delivered + stock), Annuler

**Bouton** : Nouvelle commande (dialog avec sélecteur client + lignes produits dynamiques + calcul TVA/TTC + date échéance)

### `/orders/$id` — `src/routes/_app.orders.$id.tsx`
- Bloc Infos client
- Tableau produits commandés
- Historique des changements de statut (timeline)
- Bloc Paiements (liste + ajout paiement)
- Boutons changement de statut + génération facture

### `/sales` — `src/routes/_app.sales.index.tsx` (remplace le stub actuel)
**Cartes statistiques (5)** : CA total, Ventes du jour, Ventes du mois, Encaissé, Restant

**Tableau** : N° / Client / Date / Total / Payé / Reste / Mode paiement / Échéance / Statut paiement / Actions

**Filtres** : recherche, mode, statut, période

**Actions ligne** : Voir détail, Générer facture (crée une `invoice` liée), Imprimer (PDF)

**Bouton** : Nouvelle vente (dialog : client optionnel, lignes produits, mode paiement, montant payé, échéance si crédit)

### `/sales/$id` — `src/routes/_app.sales.$id.tsx`
- Détail vente + paiements + lien facture

---

## 3. Sidebar (`app-sidebar.tsx`)
Dans `main` :
- Ventes → `/sales` (icône `ShoppingCart`)
- Commandes → `/orders` (nouvelle icône `ClipboardList`)

---

## 4. PDF
Réutiliser `src/lib/invoice-pdf.ts` pour Ventes (entête "Bon de vente" ou facture si générée). Nouveau `src/lib/order-pdf.ts` pour bon de commande.

---

## 5. Stack technique
- React 19 + TanStack Start + TanStack Query (`ensureQueryData` + `useSuspenseQuery`)
- Server functions dans `src/lib/orders.functions.ts` et `src/lib/sales.functions.ts` avec `requireSupabaseAuth`
- Toutes les valeurs en **DH**
- Composants shadcn existants (Card, Table, Dialog, Badge, Select)
- Design identique à `/invoices`

---

## Notes
- La page actuelle `/sales` (stub "Module en préparation") est **remplacée** par le vrai module Ventes.
- Les commandes ne déduisent le stock qu'à la **livraison** (pas à la validation).
- Les ventes (encaissement direct) déduisent le stock immédiatement.
- Une commande livrée + payée peut être convertie en vente automatiquement (option).
