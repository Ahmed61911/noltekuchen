Ajout de 4 modules professionnels à l'ERP Nolte Küchen, en respectant le design system existant (sidebar, cartes, tableaux shadcn, permissions, i18n RTL).

## 1. Module Devis (`/quotes`)

**Base de données** — nouvelle migration :
- `quotes` : quote_number (auto `DEV-YYYY-XXXX`), customer_id, commercial_id, quote_date, expiry_date, subtotal_ht, discount, tax, total_ttc, status (`draft|sent|accepted|refused|expired`), notes
- `quote_items` : quote_id, product_id, description, quantity, unit_price, discount, tax_rate, total
- Séquence `quote_number_seq` + fonction `generate_quote_number()`
- GRANTs + RLS (authenticated, scopé par permissions `quotes`)
- Ajout module `quotes` dans `permissions`

**Frontend** :
- `_app.quotes.index.tsx` : liste + filtres statut, stats (nb devis, taux d'acceptation, CA potentiel, en attente)
- `_app.quotes.$id.tsx` : édition, impression PDF (réutiliser `invoice-pdf.ts`), duplication, conversion en commande (insert dans `orders`+`order_items`), envoi email (via edge fn si connecteur, sinon `mailto:`)
- Entrée sidebar (icône FileText/FileSignature)

## 2. Module Projets clients (`/projects`)

**BDD** :
- `projects` : name, customer_id, commercial_id, start_date, expected_end_date, budget, install_address, status, progress
- `project_stages` : project_id, stage_key (enum 9 étapes), planned_date, actual_date, responsible_id, comment, order_index
- `project_attachments` : project_id, stage_key, file_url, type (`document|photo`), uploaded_by
- `project_activity` : project_id, user_id, action, details, created_at
- GRANTs + RLS

**Frontend** :
- `_app.projects.index.tsx` : cartes/tableau par projet + progression
- `_app.projects.$id.tsx` : timeline verticale des 9 étapes avec checks/dates/commentaires/uploads (bucket `documents`), historique
- Sidebar → Opérations

## 3. Module Commandes fournisseurs (`/purchase-orders`)

**BDD** :
- `purchase_orders` : po_number auto (`ACH-YYYY-XXXX`), supplier_id, order_date, expected_date, received_date, total, status (`draft|sent|confirmed|preparing|shipped|received|cancelled`), stock_applied
- `purchase_order_items` : product_id, quantity, unit_cost, total
- Trigger : quand `status='received'` et `stock_applied=false` → INSERT stock_movements type `in` + set `stock_applied=true`
- Séquence + fonction numérotation

**Frontend** :
- `_app.purchase-orders.index.tsx` + `.$id.tsx`
- Stats : historique, délai moyen (received_date - order_date), total achats par fournisseur
- PDF via même utilitaire, bouton email
- Sidebar → Opérations

## 4. Historique mouvements de stock (fiche produit)

**BDD** :
- Étendre enum `movement_type` : ajouter `sale, purchase, customer_return, supplier_return, inventory, transfer`
- Ajouter colonnes `stock_movements` : `warehouse_id`, `stock_before`, `stock_after`, `document_ref`
- Trigger `apply_stock_movement` mis à jour pour calculer before/after avant l'update

**Frontend** :
- Modifier `_app.products.tsx` : ouvrir un dialog "Détails produit" avec Tabs (Infos / Historique mouvements)
- Tableau historique avec filtres (produit, dépôt, utilisateur, type, période)
- Boutons Export Excel (xlsx via bibliothèque déjà présente ou CSV), Export PDF (jsPDF), Impression (`window.print`)

## Design & i18n
- Réutilisation stricte de : `Card`, `Table`, `Badge`, `Button variant`, `Dialog`, `Sheet`, `Tabs` shadcn
- Icônes Lucide (`FileSignature`, `Kanban`, `PackageCheck`, `Activity`)
- Clés i18n FR/AR ajoutées dans `i18n.tsx`
- Classes logiques `ms-`/`me-`/`start-`/`end-` respectées
- Contrôles d'accès via `usePermissions().can('quotes'|'projects'|'purchase_orders'|'stock', action)`

## Ordre d'exécution
1. Migration BDD unique regroupant les 4 modules (attente approbation)
2. Après approbation : server functions (`quotes.functions.ts`, `projects.functions.ts`, `purchase-orders.functions.ts`)
3. Pages + composants UI
4. Ajout entrées sidebar + i18n
5. Vérification build

## Notes techniques
- L'envoi d'email nécessitera soit un connecteur (Resend/Mailgun) soit un `mailto:` par défaut — je pars sur `mailto:` avec sujet/corps pré-remplis, upgradable ensuite
- La conversion devis→commande copie les lignes et lie `quote_id` sur `orders`
- Les uploads projets utilisent le bucket `documents` existant
