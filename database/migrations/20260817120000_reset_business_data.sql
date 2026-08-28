-- Remise à zéro des données métier.
--
-- Conserve UNIQUEMENT ce qui touche aux utilisateurs :
--   profiles, roles, permissions, role_permissions, user_roles, user_permissions
--   (+ auth.users, hors schéma public) et company_settings (paramètres de
--   l'application, pas des données métier : sert à l'en-tête des PDF).
--
-- Conserve également le dépôt « Stock endommagé », dont l'écran Mouvements de
-- stock a besoin (sélection automatique pour les mouvements « Endommagé »).
--
-- Tout le reste est vidé : devis, commandes, ventes, factures, mouvements de
-- stock, retours, achats, projets, rendez-vous, documents, clients, ainsi que
-- le catalogue (produits, autres dépôts, catégories, marques, unités,
-- fournisseurs).
--
-- TRUNCATE et non DELETE : les triggers BEFORE DELETE (revert_sale_stock_on_delete,
-- revert_order_stock_on_delete, revert_invoice_stock_on_delete, …) réinjecteraient
-- des mouvements de stock pendant la purge. TRUNCATE ne les déclenche pas.
-- Une seule instruction pour toutes les tables : les clés étrangères croisées
-- (sales.invoice_id <-> invoices.source_sale_id, orders.quote_id) sont gérées.

TRUNCATE TABLE
  public.return_items,
  public.returns,
  public.sale_payments,
  public.sale_items,
  public.sales,
  public.invoice_items,
  public.invoices,
  public.order_payments,
  public.order_items,
  public.orders,
  public.quote_items,
  public.quotes,
  public.purchase_order_items,
  public.purchase_orders,
  public.stock_movements,
  public.project_activity,
  public.project_attachments,
  public.project_stages,
  public.projects,
  public.document_history,
  public.documents,
  public.appointments,
  public.audit_logs,
  public.products,
  public.customers,
  public.suppliers,
  public.categories,
  public.brands,
  public.units
RESTART IDENTITY CASCADE;

-- Les dépôts sont vidés SAUF « Stock endommagé », conservé tel quel (même id).
-- DELETE et non TRUNCATE ici, précisément pour pouvoir en garder une ligne ;
-- toutes les tables qui référencent warehouses viennent d'être vidées, donc
-- aucune contrainte de clé étrangère ne s'y oppose.
DELETE FROM public.warehouses WHERE name <> 'Stock endommagé';

-- Filet de sécurité : le créer s'il n'existait pas encore.
INSERT INTO public.warehouses (name, description, is_active)
SELECT 'Stock endommagé', 'Produits endommagés (hors stock vendable)', true
WHERE NOT EXISTS (SELECT 1 FROM public.warehouses WHERE name = 'Stock endommagé');

-- La numérotation des documents repart à 1 (DEV-AAMM-0001, etc.).
ALTER SEQUENCE public.quote_number_seq          RESTART WITH 1;
ALTER SEQUENCE public.order_number_seq          RESTART WITH 1;
ALTER SEQUENCE public.sale_number_seq           RESTART WITH 1;
ALTER SEQUENCE public.invoice_number_seq        RESTART WITH 1;
ALTER SEQUENCE public.purchase_order_number_seq RESTART WITH 1;
ALTER SEQUENCE public.return_number_seq         RESTART WITH 1;
