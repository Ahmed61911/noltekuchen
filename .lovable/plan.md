## Module Facturation — Plan d'implémentation

### 1. Base de données (migration Supabase)

**Table `invoices`**
- `id`, `invoice_number` (auto, ex: `FAC-2026-0001`), `customer_id` (FK → customers)
- `invoice_date`, `due_date`
- `status` enum: `draft | pending | paid | cancelled`
- `subtotal_ht`, `tax_amount`, `discount_amount`, `total_ttc` (numeric)
- `notes`, `stock_applied` (bool, pour éviter double décrément)
- `created_by`, `created_at`, `updated_at`

**Table `invoice_items`**
- `id`, `invoice_id` (FK cascade), `product_id` (FK → products)
- `description`, `quantity`, `unit_price`, `tax_rate` (%), `discount_rate` (%)
- `line_total_ht`, `line_tax`, `line_total_ttc`

**Fonctions / triggers**
- `generate_invoice_number()` — séquence annuelle
- Trigger `apply_invoice_stock()` : quand `status` passe à `paid` ou `pending` (validation), pour chaque ligne :
  - INSERT dans `stock_movements` (type=`out`, ref invoice_id) → le trigger existant `apply_stock_movement` décrémente le stock
  - marquer `stock_applied = true`
- Idempotent : ne refait pas si `stock_applied` déjà true. Si annulation après application → mouvements `in` compensatoires.

**RLS + GRANT**
- `authenticated` : SELECT/INSERT/UPDATE/DELETE
- `service_role` : ALL

### 2. Route & navigation

- Nouveau fichier `src/routes/_app.invoices.tsx` (liste + dashboard intégré)
- Nouveau fichier `src/routes/_app.invoices.$id.tsx` (détail + édition + PDF)
- Ajouter entrée "Facturation" (icône `Receipt` ou `FileText`) dans `app-sidebar.tsx` groupe Principal
- Ajouter clés i18n `invoices`, etc.

### 3. Page Liste `/invoices`

- KPI cards en haut : CA total, CA mois courant, Factures payées (count + montant), Impayées, Reste à encaisser
- Barre recherche (numéro / client) + filtres statut + date
- Table : N°, Client, Date, Échéance, Total TTC, Statut (badge coloré), Actions (Voir / PDF / Supprimer)
- Bouton "Nouvelle facture" → ouvre Dialog formulaire

### 4. Formulaire facture (Dialog)

- Sélecteur client (combobox depuis `customers`)
- Date facture / Date échéance (default +30j)
- Lignes produits dynamiques (ajouter/retirer) :
  - Produit (combobox → auto-remplit prix, TVA par défaut 20%)
  - Quantité, PU, TVA %, Remise %
  - Calcul ligne : `HT = qty*pu*(1-remise/100)`, `TVA = HT*tva/100`, `TTC = HT+TVA`
- Récap auto : Sous-total HT, TVA totale, Total TTC
- Statut initial (Brouillon / En attente)
- Notes

### 5. Détail facture `/invoices/$id`

- En-tête société + client
- Tableau lignes
- Totaux
- Actions : Changer statut (passer à Payée déclenche stock), Éditer, Supprimer, Télécharger PDF

### 6. PDF

- Génération côté client avec `jspdf` + `jspdf-autotable` (légers, edge-safe, déjà compatibles)
- Layout : logo Nolte, infos facture, table lignes, totaux, mentions

### 7. Intégration Stock

Géré côté DB via trigger (voir §1). Côté UI : au changement de statut vers "Payée" depuis Brouillon/En attente, afficher toast "Stock mis à jour".

### 8. Devise

DH partout (cohérent avec existant).

### Détails techniques

- Server functions dans `src/lib/invoices.functions.ts` avec `requireSupabaseAuth`
- TanStack Query : `["invoices"]`, `["invoice", id]`, `["invoice-stats"]`
- Composants UI shadcn existants (Dialog, Table, Badge, Card, Select, Combobox via Command)
- Types regenerés après migration

Confirmez pour lancer la migration puis l'implémentation.
