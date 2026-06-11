
# Module Gestion des Utilisateurs

Refonte complète de `/users` (actuellement un stub) avec RBAC granulaire, audit, et sécurité.

## 1. Base de données (migration)

### Étendre `profiles`
Ajouter colonnes : `username`, `phone`, `avatar_url`, `department`, `status` (`active|inactive|blocked`), `last_login_at`. Trigger pour mettre à jour `last_login_at` via un appel server-fn au sign-in.

### Étendre l'enum `app_role`
Ajouter : `manager`, `commercial`, `warehouse`, `accountant`. Garder `admin` et `employee` (employee = "utilisateur standard").

### Nouvelle table `permissions`
`module` (text: products/stock/orders/sales/customers/suppliers/reports/users) + `action` (text: view/create/update/delete/...) → catalogue de permissions.

### Nouvelle table `role_permissions`
`role` (app_role) + `permission_id` → mapping rôle → permissions. Seed par défaut :
- **admin** : toutes les permissions
- **manager** : tout sauf gestion users
- **commercial** : ventes, clients, commandes, produits (view)
- **warehouse** : stock (full), produits (view), commandes (view/validate)
- **accountant** : ventes (view), factures, rapports
- **employee** : view uniquement sur produits, clients

### Nouvelle table `user_permissions` (overrides)
Permissions accordées/refusées par utilisateur (override du rôle). `granted` boolean.

### Nouvelle table `audit_logs`
`user_id`, `action`, `module`, `entity_id`, `old_value` (jsonb), `new_value` (jsonb), `ip_address`, `user_agent`, `created_at`. RLS : admins voient tout, users voient leur propre historique.

### Fonctions SQL
- `user_has_permission(_user_id, _module, _action)` : SECURITY DEFINER, vérifie d'abord user_permissions (override), puis role_permissions.
- `log_audit(...)` : helper pour insérer dans audit_logs.

### GRANT + RLS sur toutes les nouvelles tables.

## 2. Server functions (`src/lib/users.functions.ts`)

Toutes avec `requireSupabaseAuth` + vérification `has_role('admin')` via `supabaseAdmin` (loaded inside handler) :
- `listUsers()` : join profiles + user_roles + auth.users (email, last_sign_in)
- `createUser({ email, full_name, username, phone, role, department, temp_password? })` : génère mot de passe temp si absent, crée via `supabaseAdmin.auth.admin.createUser`, insère profile + role
- `updateUser(id, fields)`
- `resetPassword(id)` : génère nouveau mot de passe temporaire, retourne en clair (affiché 1x à l'admin)
- `setUserStatus(id, status)` : active/inactive/blocked. `blocked` → `supabaseAdmin.auth.admin.updateUserById({ ban_duration: '876000h' })`
- `deleteUser(id)` : `supabaseAdmin.auth.admin.deleteUser`
- `setUserRole(id, role)` + log audit
- `setUserPermissions(id, perms[])`
- `listAuditLogs({ user_id?, module?, limit, offset })`
- `userStats()` : total / actifs / inactifs / connexions aujourd'hui / bloqués

## 3. Routes

### `/_app/users` (refonte complète)
- 5 cartes stats (total, actifs, inactifs, connexions du jour, bloqués)
- Barre de recherche + filtres (rôle, statut, département)
- Tableau colonnes : Photo (Avatar), Nom, Username, Email, Téléphone, Rôle (Badge), Département, Date création, Dernière connexion, Statut (Badge couleur)
- Actions par ligne via DropdownMenu : Voir profil / Modifier / Reset password / Activer-Désactiver / Bloquer-Débloquer / Permissions / Historique / Supprimer
- Bouton "Nouvel utilisateur" → Dialog (email, nom, username, phone, rôle, département, génération auto mot de passe avec affichage 1x + copie)
- Pagination (20/page)
- Export PDF + CSV

### `/_app/users/$id` (page détail)
- Tabs : Profil / Permissions / Historique
- Profil : édition inline
- Permissions : checklist par module (view/create/update/delete...) avec override visible
- Historique : table audit_logs filtré sur l'utilisateur

### `/_app/audit` (nouveau)
Journal d'activité global accessible aux admins. Filtres : utilisateur, module, période. Colonnes : utilisateur, action, module, date, IP, diff ancien/nouveau.

## 4. Sidebar
Mettre à jour le label "Utilisateurs" + ajouter entrée "Journal d'audit" (admin uniquement).

## 5. Sécurité
- Politique mot de passe fort : zod schema min 12 chars, majuscule, minuscule, chiffre, spécial — appliqué côté création/reset.
- Reset password : voir route `/reset-password` (déjà gérée par Supabase recovery flow — créer si manquante).
- Activer **leaked password protection** (HIBP) via `supabase--configure_auth`.
- 2FA : noter dans README que MFA TOTP est disponible via Supabase mais nécessite UI dédiée (hors scope de cette itération — proposer en suivant).
- Déconnexion auto : hook `useIdleTimeout(30min)` dans `_app.tsx` qui appelle `signOut()`.
- Audit middleware : wrapper `logAction(module, action, old, new)` appelé dans les server fns sensibles (création/suppression user, changement rôle, etc.).

## 6. Hors scope (à proposer ensuite)
- UI 2FA TOTP complète (enrolment + challenge)
- Sessions actives multi-device (liste/révocation) — nécessite tracking custom car non exposé par Supabase Auth Admin

## Stack
React 19, TanStack Start, TanStack Query, Supabase, Tailwind, shadcn, lucide-react. Devise: DH. i18n FR. Design cohérent avec modules existants (Cards, Badges, DropdownMenu, Dialog).
