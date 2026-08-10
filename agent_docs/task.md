# Refonte majeure — Task List

## Phase 1 — Nettoyage structurel
- [ ] 1.1 Retirer "Clients" du sidebar
- [ ] 1.2 Retirer "Facturation" du sidebar
- [ ] 1.3 Supprimer le fichier `_app.customers.tsx`

## Phase 2 — Produits
- [ ] 2.1 Supprimer SKU de `_app.products.index.tsx`
- [ ] 2.2 Supprimer SKU de `_app.products.$id.tsx`
- [ ] 2.3 Prix en TTC + retirer selling_price des produits (index)
- [ ] 2.4 Prix en TTC + retirer selling_price des produits (detail)

## Phase 3 — Flux métier
- [ ] 3.1 Devis accepté → crée une commande
- [ ] 3.2 Commande validée → crée vente + facture (déjà fait, vérifier)
- [ ] 3.3 Commande livrée → sort du stock (déplacer la logique)
- [ ] 3.4 Permettre saisie manuelle du prix de vente dans devis/commandes

## Phase 4 — Mouvements de stock
- [ ] 4.1 Bouton imprimer (PDF des mouvements)
- [ ] 4.2 Type de mouvement "endommagé"
- [ ] 4.3 Vue inventaire avec export/impression

## Phase 5 — Tableau de bord
- [ ] 5.1 Graphique CA mensuel
- [ ] 5.2 Graphique répartition devis par statut
- [ ] 5.3 Graphique commandes par statut
- [ ] 5.4 Graphique évolution du stock

## Phase 6 — PDFs
- [ ] 6.1 Mettre à jour le PDF devis (branding Nador Cuisine)
- [ ] 6.2 Créer le PDF bon de commande

## Phase 7 — Git
- [ ] 7.1 Push des fichiers AI agents vers git
