-- Compléter les permissions des rôles existants (aucun nouveau rôle).
--
-- Le trou bloquant : la policy stock_movements_insert exige stock/create, et
-- le Magasinier ne l'avait pas. Il pouvait consulter le stock (stock/view)
-- mais n'enregistrait aucun mouvement — c'est-à-dire son métier. Vérifié
-- avant correctif : user_has_permission(<magasinier>,'stock','create') = false.
--
-- Le reste comble les manques de contexte : un magasinier qui prépare une
-- commande ne voyait ni le client ni la vente associée, un comptable ne
-- pouvait pas exporter les ventes qu'il facture, etc.
--
-- Le module `users` reste volontairement réservé à l'admin : l'écran
-- Utilisateurs est déjà masqué aux non-admins et la gestion des comptes ne
-- doit pas se déléguer implicitement.

-- ============================================== MAGASINIER (warehouse) ====
-- Son métier : enregistrer les mouvements, préparer, réceptionner.
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'warehouse', id FROM public.permissions
WHERE (module = 'stock'           AND action IN ('create','update','export','print'))
   OR (module = 'products'        AND action IN ('export','print'))
   OR (module = 'suppliers'       AND action IN ('export','print'))
   OR (module = 'orders'          AND action IN ('export','print'))
   OR (module = 'purchase_orders' AND action IN ('export','print'))
   -- contexte indispensable pour préparer une expédition
   OR (module = 'customers'       AND action = 'view')
   OR (module = 'sales'           AND action = 'view')
ON CONFLICT DO NOTHING;

-- ================================================ COMMERCIAL (commercial) =
-- Face client : doit vérifier la dispo avant de s'engager, suivre ses chiffres.
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'commercial', id FROM public.permissions
WHERE (module = 'stock'    AND action = 'view')
   OR (module = 'projects' AND action IN ('create','update'))
   OR (module = 'reports'  AND action IN ('view','export','export_pdf','export_excel','print'))
   OR (module = 'orders'   AND action = 'cancel')
ON CONFLICT DO NOTHING;

-- ================================================ COMPTABLE (accountant) ==
-- Lecture et sortie de données, aucune écriture métier.
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'accountant', id FROM public.permissions
WHERE (module = 'orders'          AND action IN ('view','export','print'))
   OR (module = 'sales'           AND action IN ('export','print'))
   OR (module = 'customers'       AND action IN ('export','print'))
   OR (module = 'purchase_orders' AND action IN ('export','print'))
   OR (module = 'reports'         AND action IN ('export','print'))
   OR (module = 'stock'           AND action = 'view')
ON CONFLICT DO NOTHING;

-- ==================================================== EMPLOYÉ (employee) ==
-- Strictement consultation : on ajoute l'impression de ce qu'il voit déjà,
-- et la vue du stock. Aucune création, modification ni suppression.
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'employee', id FROM public.permissions
WHERE (module = 'stock' AND action = 'view')
   OR (module IN ('products','customers','orders','sales') AND action = 'print')
ON CONFLICT DO NOTHING;
