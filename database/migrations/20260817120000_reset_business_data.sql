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
--
-- La liste est filtrée sur les tables réellement présentes (to_regclass). Le
-- schéma déployé et src/integrations/supabase/types.ts ont divergé : types.ts
-- déclare brands et units, qui ne sont créées par aucune migration. Une
-- instruction TRUNCATE statique échouait donc en bloc sur « relation does not
-- exist ». Ce filtre couvre les deux sens de la divergence : une table absente
-- est ignorée, une table présente mais non déclarée reste vidée.

DO $$
DECLARE
  wanted text[] := ARRAY[
    'return_items','returns',
    'sale_payments','sale_items','sales',
    'invoice_items','invoices',
    'order_payments','order_items','orders',
    'quote_items','quotes',
    'purchase_order_items','purchase_orders',
    'stock_movements',
    'project_activity','project_attachments','project_stages','projects',
    'document_history','documents',
    'appointments','audit_logs',
    'products','customers','suppliers',
    'categories','brands','units'
  ];
  present text[] := ARRAY[]::text[];
  t text;
BEGIN
  FOREACH t IN ARRAY wanted LOOP
    IF to_regclass(format('public.%I', t)) IS NOT NULL THEN
      present := array_append(present, format('public.%I', t));
    END IF;
  END LOOP;

  IF array_length(present, 1) > 0 THEN
    EXECUTE 'TRUNCATE TABLE ' || array_to_string(present, ', ')
         || ' RESTART IDENTITY CASCADE';
  END IF;
END $$;

-- Les dépôts sont vidés SAUF « Stock endommagé », conservé tel quel (même id).
-- DELETE et non TRUNCATE ici, précisément pour pouvoir en garder une ligne ;
-- toutes les tables qui référencent warehouses viennent d'être vidées, donc
-- aucune contrainte de clé étrangère ne s'y oppose.
DELETE FROM public.warehouses WHERE name <> 'Stock endommagé';

-- Filet de sécurité : le créer s'il n'existait pas encore.
INSERT INTO public.warehouses (name, description, is_active)
SELECT 'Stock endommagé', 'Produits endommagés (hors stock vendable)', true
WHERE NOT EXISTS (SELECT 1 FROM public.warehouses WHERE name = 'Stock endommagé');

-- La numérotation des documents repart à 1 (DEV-AAMM-0001, etc.), là encore
-- sans supposer que chaque séquence existe.
DO $$
DECLARE
  seqs text[] := ARRAY[
    'quote_number_seq','order_number_seq','sale_number_seq',
    'invoice_number_seq','purchase_order_number_seq','return_number_seq'
  ];
  s text;
BEGIN
  FOREACH s IN ARRAY seqs LOOP
    IF to_regclass(format('public.%I', s)) IS NOT NULL THEN
      EXECUTE format('ALTER SEQUENCE public.%I RESTART WITH 1', s);
    END IF;
  END LOOP;
END $$;
