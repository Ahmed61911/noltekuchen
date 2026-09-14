# Guide développeur et dossier de passation — ERP Nolte Küchen

Tout ce qu'un développeur doit savoir pour comprendre, exploiter, modifier et faire évoluer l'ERP Nolte Küchen : architecture, base de données, sécurité, déploiement, sauvegardes, supervision, recettes de modification et dette technique connue.

[TOC]

# 1. L'essentiel en une page

**Ce qu'est l'application.** Un ERP interne pour un cuisiniste (Nolte Küchen, Maroc). Il couvre le catalogue produits, le stock multi-dépôts, le circuit de vente (devis → commande → vente → livraison → paiements), la facturation, les achats fournisseurs, les retours, les projets de pose de cuisine, les rendez-vous, la GED (documents) et les rapports. Il est utilisé en français, les montants sont en dirhams (DH) TTC.

**Comment il est construit.**

- **Frontend + SSR** : TanStack Start (React 19, TanStack Router et Query, Tailwind CSS 4, composants shadcn/Radix), compilé par Vite et servi par un petit serveur Node 22.
- **Backend** : une pile **Supabase auto-hébergée** : PostgreSQL 15, GoTrue (authentification), PostgREST (API REST générée depuis le schéma), Storage API sur MinIO (fichiers), le tout derrière la passerelle Kong.
- **L'essentiel de la logique métier est en base** : fonctions PL/pgSQL (RPC), triggers pour le stock, politiques RLS pour les droits.
- **Tout tourne dans Docker Compose** derrière nginx (TLS Let's Encrypt), sur un seul VPS.

**Origine.** Le projet a démarré sur la plateforme **Lovable** (Lovable Cloud = Supabase hébergé). Il a ensuite été migré en auto-hébergement, voir `MIGRATION.md`. Des traces de Lovable subsistent (commentaires générés, `wrangler.jsonc`, config Vite Cloudflare remplacée au build).

**Où il tourne.**

| Élément | Valeur |
|---|---|
| Serveur | VPS OVH, Ubuntu 26.04 LTS, 2 vCPU / 3,8 Go RAM / 38 Go disque, **sans swap** |
| Accès | SSH par clé uniquement (pas de root, pas de mot de passe), utilisateur `farah` (groupes `sudo`, `docker`) |
| Répertoire | `/opt/nolte` (clone Git du dépôt) |
| Application | https://noltenador.digital |
| API Supabase | https://supabase.noltenador.digital |
| Supervision | https://noltenador.digital/_ops/ (Grafana) et `/_prom/` (Prometheus) |
| Dépôt Git | `github.com/Ahmed61911/noltekuchen`, branche de production `main` |

**Les trois commandes à connaître.**

```bash
cd /opt/nolte
C="docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.monitoring.yml"
$C ps                      # état de tous les services
$C logs -f --tail=100 app  # journaux d'un service
./scripts/verify-backup.sh # prouve que la dernière sauvegarde est restaurable
```

> **Important :** sur le serveur, lancez **toujours** `docker compose` avec au minimum `-f docker-compose.yml -f docker-compose.prod.yml`. Le fichier de base seul **republie les ports de Postgres (5432), Kong (8000), MinIO (9001) et de l'app (8080) sur Internet**, en contournant le pare-feu (Docker écrit ses propres règles iptables). C'est arrivé le 08/09/2026.

# 2. Architecture

## 2.1 Vue d'ensemble

```text
                         Internet (80/443 uniquement)
                                   │
                           ┌───────▼────────┐
                           │  nginx (TLS)   │  + certbot (rechargement / 6 h)
                           └───┬────────┬───┘
     noltenador.digital        │        │        supabase.noltenador.digital
             ┌─────────────────┘        └──────────────────┐
             │  /           /_ops/        /_prom/          │ /auth/v1  /rest/v1  /storage/v1
       ┌─────▼─────┐   ┌──────────┐   ┌────────────┐   ┌───▼────┐
       │ app (SSR) │   │ grafana  │   │ prometheus │   │  kong  │
       │  Node 22  │   └──────────┘   └────────────┘   └┬──┬───┬┘
       └─────┬─────┘                                    │  │   │
             │ server functions (clé service_role)      │  │   │
             └────────────────► kong ◄──────────────────┘  │   │
                                          ┌────────────────┘   │
                                   ┌──────▼──┐ ┌──────┐ ┌──────▼───┐
                                   │  auth   │ │ rest │ │ storage  │
                                   │ GoTrue  │ │PgRST │ │   API    │
                                   └────┬────┘ └──┬───┘ └──┬────┬──┘
                                        └─────────┼────────┘    │
                                             ┌────▼────┐   ┌────▼────┐
                                             │   db    │   │  minio  │
                                             │ PG 15   │   │   S3    │
                                             └─────────┘   └─────────┘
```

**Le navigateur parle directement à l'API Supabase.** La quasi-totalité des lectures et écritures passe par `supabase-js` côté client : `supabase.from(...)` pour PostgREST et `supabase.rpc(...)` pour les fonctions SQL, avec le JWT de l'utilisateur. **La sécurité repose donc entièrement sur les politiques RLS de Postgres**, et non sur le code React. Masquer un bouton dans l'interface n'est jamais une protection.

Seules les opérations d'administration des comptes (création d'utilisateur, réinitialisation de mot de passe, rôles) passent par des **server functions** TanStack exécutées dans le conteneur `app`. Elles utilisent la clé `service_role`, qui contourne RLS, après avoir vérifié que l'appelant est administrateur.

## 2.2 Les services Docker

| Service | Image | Rôle | Fichier de config |
|---|---|---|---|
| `db` | `supabase/postgres:15.6.1.146` | Base de données (volume `pg_data`) | `backend/volumes/db/init/00-roles.sh` |
| `auth` | `supabase/gotrue:v2.158.1` | Comptes, connexion, JWT, e-mails | variables `GOTRUE_*`, `SMTP_*` |
| `rest` | `postgrest/postgrest:v12.2.3` | API REST automatique sur le schéma `public` | — |
| `storage` | `supabase/storage-api:v1.11.13` | Fichiers (buckets, RLS sur `storage.objects`) | — |
| `minio` | `minio/minio:RELEASE.2024-08-17…` | Stockage objet S3 (volume `minio_data`) | — |
| `minio-init` | `minio/mc` | Tâche ponctuelle : crée les buckets | `docker-compose.yml` |
| `kong` | `kong:2.8` | Passerelle : `/auth/v1`, `/rest/v1`, `/storage/v1` | `backend/volumes/api/kong.yml` |
| `db-migrate` | `supabase/postgres` | Tâche ponctuelle : applique `database/migrations` au premier démarrage | `backend/volumes/db/run-app-migrations.sh` |
| `app` | build `frontend/Dockerfile` | Application TanStack Start (SSR + assets), limite 1 Go | `frontend/` |
| `nginx` | `nginx:1.27-alpine` | Reverse proxy TLS, rate limiting, auth basic `/_ops` | `nginx/` |
| `certbot` | `certbot/certbot:v2.11.0` | Renouvellement Let's Encrypt toutes les 12 h | `docker-compose.prod.yml` |
| `smtp` | `mailhog` | **Dev uniquement** (désactivé en prod) | — |
| `prometheus`, `grafana`, `node-exporter`, `postgres-exporter`, `blackbox-exporter` | voir `docker-compose.monitoring.yml` | Supervision (chapitre 8) | `monitoring/` |
| `loki`, `promtail` | profil `logs` | Agrégation de logs, **non démarrée** (mémoire insuffisante) | `monitoring/` |

**Les trois fichiers Compose :**

- `docker-compose.yml` : base, utilisable seule **en développement local uniquement**.
- `docker-compose.prod.yml` : surcouche de prod (`restart: always`, suppression des ports avec `!reset []`, nginx, certbot, rotation des logs, limites mémoire).
- `docker-compose.monitoring.yml` : supervision (tous les services ont un `mem_limit`).

## 2.3 Le frontend

| Sujet | Détail |
|---|---|
| Framework | TanStack Start `^1.168` (SSR), TanStack Router (routage par fichiers), React 19 |
| Données | `@tanstack/react-query` (cache, invalidations), `@supabase/supabase-js` |
| UI | Tailwind CSS 4, composants shadcn (Radix) dans `src/components/ui`, briques maison dans `src/components/data` |
| Graphiques | `recharts` |
| PDF | `jspdf` + `jspdf-autotable`, générés **dans le navigateur** (`src/lib/*-pdf.ts`) |
| Excel | `xlsx` (SheetJS, installé depuis le CDN SheetJS) |
| Notifications | `sonner` (toasts) |
| Gestionnaire de paquets | **Bun** (`bun.lock`) ; le Dockerfile l'installe via npm |

**Build Node.** La config Vite d'origine (Lovable) cible Cloudflare Workers. Le `frontend/Dockerfile` la remplace au build :

- `frontend/vite.config.node.ts` → `vite.config.ts` ;
- `frontend/server-node.ts` → `src/server.ts` ;
- `frontend/serve.mjs` est un serveur HTTP Node minimal : il sert `dist/client/` et transmet le reste au handler `fetch` produit par TanStack Start.

Node **22** est obligatoire : `supabase-js` a besoin du `WebSocket` natif, absent de Node 20.

**Variables `VITE_*`.** Elles sont **injectées au moment du build** (arguments Docker). Changer `VITE_SUPABASE_URL` ou la clé publique impose de **reconstruire** l'image `app`, un simple redémarrage ne suffit pas.

## 2.4 Le parcours d'une requête

1. Le navigateur charge `https://noltenador.digital/commandes…` : nginx → `app:3000` (SSR, puis hydratation React).
2. `AuthProvider` (`src/lib/auth.tsx`) récupère la session GoTrue, stockée dans le navigateur, puis charge les rôles depuis `user_roles`.
3. Une page lit les données : `supabase.from("orders").select(...)` → `https://supabase.noltenador.digital/rest/v1/orders` → nginx (rate limit `api_zone`) → Kong (vérifie la clé `apikey`) → PostgREST → Postgres, **en tant que rôle `authenticated`, avec le JWT** → les politiques RLS filtrent les lignes.
4. Une action métier appelle une RPC : `supabase.rpc("validate_order", …)` → même chemin → la fonction SQL s'exécute dans une transaction ; les triggers ajustent le stock.
5. Un fichier : `supabase.storage.from("product-images").upload(...)` → Storage API → MinIO, avec RLS sur `storage.objects`.

# 3. Le dépôt

## 3.1 Arborescence

| Chemin | Contenu |
|---|---|
| `src/routes/` | Pages (routage par fichiers). `_app.*.tsx` = pages protégées dans la mise en page avec menu. `$id` = paramètre. |
| `src/routeTree.gen.ts` | **Généré automatiquement** par le plugin TanStack Router : ne pas éditer. |
| `src/components/ui/` | Composants shadcn (bas niveau). |
| `src/components/data/` | Briques de pages de données : `PageHeader`, `Toolbar`, `StatCard`, `StatusBadge`, `EmptyState`, `ErrorState`, pagination, squelettes. |
| `src/components/app-sidebar.tsx` | Menu latéral et filtrage par permission. |
| `src/components/app-header.tsx` | Barre supérieure et notifications. |
| `src/lib/auth.tsx` | Session, rôles, `isAdmin`. |
| `src/lib/permissions.tsx` | Hook `usePermissions()` → `can(module, action)`. |
| `src/lib/users.functions.ts`, `roles.functions.ts` | Server functions d'administration (clé `service_role`). |
| `src/lib/*-pdf.ts` | Mise en page des PDF (devis, commande, facture), logos. |
| `src/lib/money.ts` | Calculs de lignes et totaux (`computeLine`, `computeTotals`, `round2`). |
| `src/lib/stock-by-warehouse.ts` | Stock par dépôt, calculé depuis les mouvements. |
| `src/lib/audit-log.ts` | `logAction()` → table `audit_logs`. |
| `src/lib/i18n.tsx` | Dictionnaires FR/AR (**AR désactivé**, voir 10). |
| `src/integrations/supabase/` | Clients Supabase (navigateur, serveur), middleware d'authentification, **types générés** (`types.ts`). |
| `database/migrations/` | **Migrations SQL de l'application** (source de vérité du schéma). |
| `supabase/migrations/` | Anciennes migrations de l'époque Lovable (historique ; ne sont plus appliquées). |
| `backend/volumes/` | Config Kong et scripts d'initialisation Postgres. |
| `frontend/` | Dockerfile et adaptation Node. |
| `nginx/` | `nginx.conf`, `conf.d/app.conf.template` (rendu → `app.conf`, non versionné), `ops.htpasswd` (non versionné). |
| `monitoring/` | Prometheus, règles et tableaux de bord Grafana, blackbox, promtail. |
| `scripts/` | Exploitation (voir 7.9). |
| `docs/` | Ces guides, les outils de génération PDF, notes de design. |
| `agent_docs/` | Notes de travail d'assistants IA précédents (historique, non normatif). |
| `DEPLOY.md`, `MIGRATION.md` | Runbooks d'origine (en anglais). **Attention :** `DEPLOY.md` parle d'un serveur Hetzner, alors que la production actuelle est chez OVH. |
| `.github/workflows/deploy.yml` | Déploiement continu sur push `main` (voir 7.3). |

## 3.2 Branches

| Branche | Rôle |
|---|---|
| `main` | Production. Tout push déclenche le workflow de déploiement. |
| `ops/image-perms-movement-date-monitoring` | Branche de travail actuellement extraite sur le serveur, identique à `main` au 14/09/2026. |
| `v1.1a-redesign`, `v1.1b` | Anciennes branches de fonctionnalités (historique). |

# 4. La base de données

## 4.1 Les tables par domaine

| Domaine | Tables |
|---|---|
| Comptes et droits | `profiles` (1-1 avec `auth.users`), `user_roles`, `roles`, `permissions`, `role_permissions`, `user_permissions` |
| Catalogue | `products`, `categories`, `suppliers`, `warehouses` |
| Stock | `stock_movements` (journal immuable ; les quantités de `products` en découlent) |
| Clients | `customers` |
| Vente | `quotes` + `quote_items`, `orders` + `order_items` + `order_payments`, `sales` + `sale_items` + `sale_payments`, `invoices` + `invoice_items` |
| Achats et retours | `purchase_orders` + `purchase_order_items`, `returns` + `return_items` |
| Projets | `projects`, `project_stages`, `project_attachments`, `project_activity` |
| Divers | `appointments`, `documents`, `document_history`, `audit_logs` |
| Technique | `_schema_migrations` (migrations appliquées) |

Pour le détail des colonnes : `docker exec nolte-db-1 psql -U postgres -d postgres -c '\d public.orders'`, ou le fichier généré `src/integrations/supabase/types.ts`.

**Numérotation des documents** (fonctions `generate_*_number`, format préfixe + année-mois + séquence) :

| Document | Préfixe |
|---|---|
| Devis | `DEV-` |
| Commande | `CMD-` |
| Vente | `VTE-` |
| Facture | `FAC-` |
| Achat | `ACH-` |
| Retour client (avoir) | `AV-` |
| Retour fournisseur | `RF-` |

## 4.2 Le moteur de stock

C'est la partie la plus sensible. Règle d'or : **on ne modifie jamais `products.stock_quantity` directement**. Toute variation passe par une ligne dans `stock_movements`.

- **`apply_stock_movement()`** (trigger `BEFORE INSERT` sur `stock_movements`, `SECURITY DEFINER`) :
  - verrouille la ligne produit (`FOR UPDATE`) ;
  - calcule le sens selon `type` : `in`, `purchase`, `customer_return` et `inventory` ajoutent ; `out`, `sale` et `supplier_return` retirent ; `damaged` fait passer du stock vendable au stock endommagé ;
  - **refuse de passer sous zéro** (erreur `23514` « Stock insuffisant ») ;
  - renseigne `stock_before` / `stock_after` ;
  - met à jour `products.stock_quantity` ou `damaged_quantity`. Le drapeau `to_damaged` fait porter un mouvement sur le stock endommagé.
- **`move_document_stock(...)`** (`SECURITY DEFINER`) : helper générique qui crée les mouvements de toutes les lignes d'un document (commande, vente, facture, achat) dans un sens donné.
- **Triggers de documents** (tous `SECURITY DEFINER`) :

| Trigger | Événement | Effet |
|---|---|---|
| `trg_orders_stock` → `apply_order_stock()` | `UPDATE` de `orders.status` | Passage à `delivered` → sortie ; sortie de `delivered` (annulation) → réintégration |
| `trg_orders_stock_delete` → `revert_order_stock_on_delete()` | `DELETE` | Réintègre si la commande était livrée |
| `trg_sale_items_stock` → `apply_sale_stock_deferred()` | `INSERT` de ligne de vente | Vente **sans** commande (comptoir) : sortie ; vente liée à une commande : rien (le stock sort à la livraison) |
| `trg_sales_stock_delete` → `revert_sale_stock_on_delete()` | `DELETE` | Réintègre |
| `trg_invoice_stock` → `apply_invoice_stock()` | `UPDATE` de `invoices.status` | Entrée dans `pending`/`paid` → sortie ; sortie de ces statuts → réintégration |
| `trg_invoice_stock_delete` | `DELETE` | Réintègre |
| `trg_apply_purchase_order_stock` | `UPDATE` de `purchase_orders.status` | Passage à `received` → entrée au coût des lignes ; annulation → sortie |
| `trg_purchase_orders_stock_delete` | `DELETE` | Retire si l'achat était reçu |

Des colonnes drapeaux (`stock_applied`, etc.) évitent d'appliquer deux fois le même document.

- **Stock par dépôt** : il n'y a pas de table stock × dépôt. Le front calcule la répartition à partir des mouvements (`src/lib/stock-by-warehouse.ts`, hook `useStockByWarehouse().depotsFor(productId)`). Le « dépôt d'un produit » découle donc de son stock (commit `643db54`), et non de `products.warehouse_id`.

> **Important :** une facture en `pending`/`paid` **sort** le stock, **indépendamment** de la commande ou de la vente. Facturer avec des lignes produits une commande déjà livrée sort le stock deux fois. C'est un piège fonctionnel connu (voir 10).

## 4.3 Le circuit de vente en base

| Étape | Appel | Détail |
|---|---|---|
| Créer un devis | `insert quotes` + `quote_items` | Totaux recalculés côté client (`recomputeTotals`) |
| Accepter | `rpc accept_quote(_quote_id)` | Crée la commande `pending` et ses lignes ; idempotent (`already: true`) |
| Créer une commande | `rpc create_order(_order jsonb, _items jsonb)` | Transactionnel |
| Valider | `rpc validate_order(_order_id)` | Crée la vente liée (`stock_applied=false`), copie les lignes et reprend les paiements déjà saisis ; idempotent |
| Livrer | `update orders set status='delivered'` | Le trigger sort le stock (`deliver_order()` existe aussi) |
| Annuler | `rpc cancel_order` / `cancel_sale` | Annule le couple commande/vente ; le trigger réintègre si livré |
| Vente comptoir | `rpc create_sale_with_order` | Crée la vente **et** une commande `validated` |
| Facture | `rpc create_invoice` | Le statut initial peut déjà sortir le stock |
| Achat | `rpc create_purchase_order` ; puis `update status='received'` | |
| Retour | `rpc create_return` / `cancel_return` | Crée ou inverse les mouvements |
| Paiements | `insert order_payments` / `sale_payments` | Triggers `sync_order_payment_status` / `sync_sale_payment_status` : `paid_amount` et `payment_status` |

Les RPC `create_*`, `validate_order`, `cancel_*` et `accept_quote` sont **`SECURITY INVOKER`** : elles s'exécutent avec les droits de l'utilisateur, donc **sous RLS**. Valider une commande exige par exemple `orders.update` **et** `sales.create`.

## 4.4 Projets

- `trg_seed_project_stages` (`AFTER INSERT` sur `projects`) crée les 9 étapes : `design`, `client_validation`, `supplier_order`, `goods_reception`, `preparation`, `delivery`, `installation`, `quality_check`, `completed`.
- `trg_recompute_project_progress` recalcule l'avancement à chaque modification d'étape.

## 4.5 Fichiers (Storage)

| Bucket | Public | Usage | Politiques |
|---|---|---|---|
| `product-images` | non | Photos produits | Lecture : authentifiés ; écriture : `user_has_permission(uid,'products','update')` (migration `20260908120000`) |
| `documents` | non | GED et pièces jointes de projets | Selon propriétaire / admin |

Le bucket S3 interne de Storage API s'appelle `STORAGE_S3_BUCKET` (`supabase-storage`) dans MinIO. Les objets y sont rangés sous `supabase-storage/self-hosted/<bucket>/…`.

# 5. Sécurité et permissions

## 5.1 Le modèle

```text
auth.users ──1:1── profiles
     │
     ├── user_roles (user_id, role app_role, role_key text)
     │        └── roles (key, label, is_system)
     │                 └── role_permissions (role, permission_id)
     │                                          └── permissions (module, action, label)
     └── user_permissions (user_id, permission_id, granted)   ← surcharges individuelles
```

- **`app_role`** (enum) : `admin`, `employee`, `manager`, `commercial`, `warehouse`, `accountant`. Les rôles créés depuis l'écran *Rôles* utilisent `role_key` (texte) ; `COALESCE(role_key, role::text)` fait le lien.
- **Modules** : `customers`, `orders`, `products`, `projects`, `purchase_orders`, `quotes`, `reports`, `sales`, `stock`, `suppliers`, `users`.
- **Actions** : `view`, `create`, `update`, `delete`, `export`, `print`, plus des actions spécifiques : `orders.validate`, `orders.cancel`, `sales.invoice`, `stock.in`, `stock.out`, `stock.adjust`, `reports.export_excel`, `reports.export_pdf`, `users.manage_permissions`.
- **Nouvel inscrit** : le trigger `handle_new_user()` crée le profil et le rôle `employee`. En pratique les comptes sont créés par un admin (inscription publique désactivée : `GOTRUE_DISABLE_SIGNUP`).

## 5.2 L'évaluation d'une permission

`user_has_permission(_user_id, _module, _action)` (`SECURITY DEFINER`, `STABLE`) applique, dans l'ordre :

1. une **surcharge individuelle** (`user_permissions.granted`) si elle existe, **même `false`, et même pour un admin** ;
2. sinon, **admin** → `true` ;
3. sinon, une permission accordée via le rôle (`role_permissions`) ;
4. sinon `false`.

`has_role(uid, role)` teste simplement l'appartenance à un rôle. `get_user_permissions(uid)` renvoie la matrice complète au front.

## 5.3 Où les droits sont appliqués

| Couche | Mécanisme | Portée réelle |
|---|---|---|
| **Postgres RLS** | `user_has_permission(auth.uid(), '<module>', '<action>')` ou `has_role(...,'admin')` | **La seule barrière de sécurité effective.** |
| Server functions | `assertAdmin()` puis client `service_role` | Administration des comptes et des rôles |
| Menu | `can(module,'view')` dans `app-sidebar.tsx` | Confort (masquage) |
| Pages | `isAdmin` ou `can()` pour certains boutons | Confort (masquage) |

**État des politiques par table (au 14/09/2026) :**

| Tables | Règle |
|---|---|
| `customers`, `orders`, `quotes`, `sales`, `invoices`, `projects`, `purchase_orders`, `suppliers` | CRUD mappé sur `<module>.<view/create/update/delete>` (`invoices` → module `sales`) |
| Lignes et paiements (`order_items`, `order_payments`, `sale_items`, `sale_payments`, `purchase_order_items`, `project_stages`, `project_attachments`) | `SELECT` = `view` du parent ; toute écriture = `update` du parent |
| `invoice_items` | CRUD sur le module `sales` |
| `products` | lecture : tout authentifié ; écriture : **admin uniquement** |
| `warehouses` | lecture : tous ; écriture : admin |
| `stock_movements` | lecture : `stock.view` ; insertion : `stock.create` **et** `user_id = auth.uid()` ; modification/suppression : admin |
| `appointments`, `documents` | propriétaire (`created_by`, ou `assigned_to` pour les RDV) ou admin |
| `audit_logs` | insertion de ses propres lignes ; lecture des siennes, ou de toutes pour un admin |
| `profiles` | chacun le sien ; admin tout |
| `user_roles`, `roles`, `permissions`, `role_permissions` | lecture authentifiée ; écriture admin |
| `returns`, `return_items` | **`USING (true)` : tout utilisateur connecté peut tout faire** (voir 10) |

## 5.4 Durcissement de l'hôte (état vérifié le 14/09/2026)

- **UFW** actif : entrées refusées par défaut, seuls 22, 80 et 443 autorisés (IPv4 et IPv6).
- Seul **nginx** publie des ports (80/443). `db`, `kong`, `minio` et `app` utilisent `ports: !reset []`.
- **SSH** : pas de connexion root, pas de mot de passe. **fail2ban** actif (jails `sshd` et `nginx-ratelimit` sur les 429). **unattended-upgrades** actif.
- nginx : limitation de débit `auth_zone` sur `/auth/v1/(token|signup|recover|otp|verify|magiclink)` et `api_zone` sur le reste de l'API ; en-têtes de sécurité.
- `/_ops/` et `/_prom/` : authentification basique nginx (`nginx/conf.d/ops.htpasswd`, utilisateur `ops`), plus la connexion Grafana.
- Prometheus : `--web.enable-lifecycle` **retiré** (pas d'arrêt à distance).
- `postgres-exporter` : rôle dédié en lecture seule `nolte_exporter` (`pg_monitor`), et non le superutilisateur.
- Une entrée sudoers limitée `/etc/sudoers.d/90-claude-ufw` (`ufw` uniquement) a été ajoutée pendant l'audit : **à supprimer** si elle n'est plus utile.

# 6. Développer en local

## 6.1 Prérequis

Docker (Desktop ou Engine + plugin Compose), `openssl`, `python3`, `bash`, et Bun ou Node 22 pour travailler hors conteneur.

## 6.2 Démarrer la pile complète

```bash
git clone git@github.com:Ahmed61911/noltekuchen.git
cd noltekuchen
scripts/bootstrap.sh      # génère .env : secrets aléatoires + clés anon/service_role signées
docker compose up -d      # premier démarrage ~2 min ; db-migrate applique database/migrations
scripts/create-admin.sh admin@example.com 'MotDePasse!123'
```

| Service | URL locale |
|---|---|
| Application | http://localhost:8080 |
| API Supabase (Kong) | http://localhost:8000 |
| Console MinIO | http://localhost:9001 |
| MailHog (e-mails capturés) | http://localhost:8025 |
| Postgres | `localhost:5432` |

Réinitialiser complètement : `docker compose down -v`, puis `up -d`.

## 6.3 Itérer sur le frontend

Le conteneur `app` est une image de production : chaque changement de code impose `docker compose build app && docker compose up -d app`. Pour itérer vite, lancez Vite en local contre l'API Docker :

```bash
bun install
# dans .env : VITE_SUPABASE_URL=http://localhost:8000 et la clé publique générée
bun run dev
```

> **Bon à savoir :** la config Vite du dépôt est celle de Lovable (`@lovable.dev/vite-tanstack-config`, cible Cloudflare). Si `bun run dev` pose problème, utilisez la config Node : `bunx vite dev --config frontend/vite.config.node.ts`. Les server functions ont besoin de `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` dans l'environnement.

**Qualité :** `bun run lint` (ESLint) et `bun run format` (Prettier). Il n'y a **pas de tests automatisés** dans le dépôt.

## 6.4 Travailler sur une copie des données de prod

Pour reproduire un bug sur des données réelles sans toucher la prod :

1. Récupérez une archive `backups/backup-*.tar.gz` du serveur (`scp`).
2. En local, pile démarrée : `scripts/restore.sh backups/backup-XXXX.tar.gz`.

> **Important :** ces archives contiennent des données personnelles (clients, comptes, hachages de mots de passe). Ne les stockez pas hors d'un disque chiffré et supprimez-les après usage.

# 7. Déployer et exploiter

## 7.1 Raccourci

Toutes les commandes ci-dessous supposent :

```bash
cd /opt/nolte
C="docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.monitoring.yml"
```

## 7.2 Déployer une nouvelle version (manuel)

```bash
cd /opt/nolte
git fetch origin && git status          # vérifier : aucune modification locale non commitée
git checkout main && git pull --ff-only
$C build app                            # ~3-5 min ; surveiller la RAM (pas de swap)
./scripts/migrate.sh                    # applique les nouvelles migrations + NOTIFY pgrst
$C up -d app                            # coupure de quelques secondes

# Seulement si nginx/ a changé :
./scripts/render-nginx.sh && docker exec nolte-nginx-1 nginx -t && docker exec nolte-nginx-1 nginx -s reload
# Seulement si kong.yml a changé :
$C up -d --force-recreate kong
# Seulement si docker-compose.monitoring.yml ou monitoring/ a changé :
$C up -d --no-deps prometheus grafana postgres-exporter
```

Vérification : `curl -sI https://noltenador.digital/ | head -1` (200 ou 307), puis un parcours rapide dans le navigateur.

## 7.3 Déploiement continu (GitHub Actions)

`.github/workflows/deploy.yml` se déclenche à chaque push sur `main` :

1. connexion SSH au serveur (secrets `SSH_HOST`, `SSH_USER`, `SSH_KEY`, `SSH_PORT`, `DEPLOY_PATH`) ;
2. `git fetch` puis **`git checkout main && git reset --hard origin/main`** ;
3. `build app` → `scripts/migrate.sh` → `up -d app` ;
4. si `nginx/` a changé : rendu et **restart** de nginx ;
5. `docker image prune -f`.

> **Important :**
>
> - **`reset --hard` écrase toute modification locale non commitée sur le serveur.** Ne modifiez jamais de fichier suivi directement sur le serveur sans le commiter aussitôt.
> - Le workflow **ne redéploie ni la supervision, ni Kong, ni certbot**.
> - Vérifiez dans *GitHub → Settings → Secrets and variables → Actions* que les secrets existent. Leur présence n'a pas été vérifiée lors de la passation. Sans eux, les pushes ne déploient rien et il faut suivre 7.2.
> - Une clé de déploiement GitHub en écriture (`nolte-prod-deploy`, `~/.ssh/nolte_github` sur le serveur) permet de pousser depuis le serveur : `GIT_SSH_COMMAND="ssh -i ~/.ssh/nolte_github -o IdentitiesOnly=yes" git push git@github.com:Ahmed61911/noltekuchen.git HEAD:main`.

## 7.4 Migrations de base de données

- Emplacement : `database/migrations/AAAAMMJJHHMMSS_description.sql`, appliquées **par ordre alphabétique**.
- Suivi : `public._schema_migrations(filename)`. Un fichier déjà appliqué **n'est jamais rejoué** : ne modifiez jamais une migration publiée, créez-en une nouvelle.
- Application : `scripts/migrate.sh` (via `docker compose exec db psql`), qui envoie ensuite `NOTIFY pgrst, 'reload schema'`. **Sans ce NOTIFY, PostgREST ne voit pas les nouvelles colonnes ou fonctions** (erreur `PGRST202`).
- Il n'y a **pas de migrations descendantes**. Pour annuler : une nouvelle migration inverse, ou une restauration.
- `scripts/migrate.sh` n'utilise que `docker-compose.yml` pour `exec` : sans danger, car `exec` ne recrée aucun conteneur.

**Écrire une bonne migration :**

```sql
-- Pourquoi (le problème), quoi (la solution), comment c'est vérifié.
begin;

alter table public.orders add column if not exists delivery_address text;

-- Toujours penser RLS pour une nouvelle table :
-- alter table public.x enable row level security;
-- create policy x_select on public.x for select to authenticated
--   using (public.user_has_permission(auth.uid(), 'orders', 'view'));

commit;
```

Tester avant la prod : restaurez la dernière sauvegarde en local (6.4), appliquez la migration, et vérifiez l'application. Mettez ensuite à jour `src/integrations/supabase/types.ts` si des colonnes changent (générateur Supabase, ou édition manuelle cohérente).

## 7.5 nginx et certificats TLS

- `nginx/conf.d/app.conf.template` est rendu en `app.conf` par `scripts/render-nginx.sh` (substitution des domaines).
- `upstream` dynamiques (`resolver 127.0.0.11`) : nginx démarre même si un service est absent, et suit les changements d'IP des conteneurs.
- **Certificats** : `certbot` exécute `certbot renew` toutes les 12 h sur le volume `letsencrypt`, et **nginx se recharge toutes les 6 h** (boucle dans la commande du service) pour prendre en compte les certificats renouvelés. Vérifier l'expiration :

```bash
echo | openssl s_client -connect noltenador.digital:443 -servername noltenador.digital 2>/dev/null | openssl x509 -noout -enddate
```

- Premier certificat ou nouveau domaine : `scripts/init-letsencrypt.sh` (`--staging` d'abord).

## 7.6 Sauvegardes et restauration

| Quoi | Quand | Où | Journal |
|---|---|---|---|
| `scripts/backup.sh` : `pg_dump` complet (`public`, `auth`, `storage`) + miroir des buckets MinIO → `backups/backup-AAAAMMJJ-HHMMSS.tar.gz`, **14 archives conservées** | tous les jours à 03:00 (cron de `farah`) | `/opt/nolte/backups/` | `/opt/nolte/logs/nolte-backup.log` |
| `scripts/verify-backup.sh` : restaure la dernière archive dans un **Postgres jetable sans réseau** et compare utilisateurs, objets et tables avec la prod | le dimanche à 04:30 | — | `/opt/nolte/logs/nolte-verify-backup.log` |
| `scripts/backup-offsite.sh` (restic) | **non configuré** | — | — |

> **Important :** **toutes les sauvegardes sont sur le même serveur.** Si le disque ou le VPS est perdu, tout est perdu. Configurer la copie hors site est la priorité n°1 de la passation (voir 11) : renseigner `RESTIC_REPOSITORY` et `RESTIC_PASSWORD` (plus les identifiants du fournisseur) dans `.env`, lancer `restic init`, puis relancer `scripts/install-cron.sh`.

**Restaurer** (destructif, demande confirmation) :

```bash
./scripts/restore.sh backups/backup-AAAAMMJJ-HHMMSS.tar.gz
```

Le script rejoue d'abord les `DROP` du dump en tolérant les erreurs, puis purge `auth` et `storage` (`CASCADE`), et recrée tout **dans une transaction unique** (`scripts/lib/restore-db.sh`). Il remet ensuite les propriétaires des schémas `auth` et `storage`, et réinjecte les fichiers MinIO. Ce fonctionnement a été testé sur base vide **et** sur base peuplée.

**Tester une sauvegarde à la demande :** `./scripts/verify-backup.sh` (sortie `PASS` / `FAIL`).

## 7.7 Supervision et alertes

| Outil | Accès | Rôle |
|---|---|---|
| Grafana | https://noltenador.digital/_ops/ : auth basic `ops`, puis compte `admin` (`GRAFANA_ADMIN_PASSWORD` dans `.env`) | Tableau de bord « Nolte overview », alertes |
| Prometheus | https://noltenador.digital/_prom/ (auth basic `ops`) | Métriques brutes, *Status → Targets* |

**Cibles collectées** (`monitoring/prometheus.yml`) : `prometheus`, `node` (hôte), `postgres`, `blackbox_app` (le site répond avec le bon contenu), `blackbox_api` (santé de l'API), `blackbox_tls` (expiration des certificats).

**Règles d'alerte** (`monitoring/grafana/provisioning/alerting/rules.yml`) :

- disque > 85 % ;
- mémoire disponible < 300 Mo ;
- application qui ne sert pas le contenu attendu ;
- santé de l'API Supabase en échec ;
- Postgres injoignable ;
- certificat TLS expirant sous 14 jours ;
- cible Prometheus tombée.

**Envoi par e-mail** : point de contact `nolte-email` → **noltenador@gmail.com** (`contact-points.yml`), via le SMTP de `.env` (Gmail et mot de passe d'application). **Activation en attente** au 14/09/2026 :

```bash
./scripts/set-gmail-smtp.sh noltenador@gmail.com   # demande le mot de passe d'application sans l'afficher
$C up -d --no-deps grafana auth
# puis Grafana → Alerting → Contact points → nolte-email → Test
```

Ce même SMTP fait fonctionner les e-mails de GoTrue (réinitialisation de mot de passe, invitations), aujourd'hui **non fonctionnels** car les valeurs SMTP sont des exemples.

## 7.8 Retour arrière

- **Code seul** : `git checkout <sha-sain>` → `$C build app` → `$C up -d app`. Remettez ensuite `main` au bon état, sinon le prochain push redéploiera la version fautive.
- **Migration fautive** : nouvelle migration corrective, ou restauration de la sauvegarde précédant le déploiement (perte des écritures intermédiaires).

## 7.9 Les scripts

| Script | Usage |
|---|---|
| `bootstrap.sh` | Génère `.env` (secrets et clés JWT) pour une nouvelle installation |
| `create-admin.sh email 'mdp'` | Crée un compte administrateur |
| `migrate.sh` | Applique les migrations en attente |
| `backup.sh` / `restore.sh` / `verify-backup.sh` | Sauvegarde, restauration, preuve de restaurabilité |
| `lib/restore-db.sh` | Logique de rejeu d'un dump (partagée) |
| `backup-offsite.sh` | Envoi hors site (restic) |
| `install-cron.sh` | Installe les tâches cron (idempotent) |
| `render-nginx.sh` | Rend `app.conf` depuis le modèle |
| `init-letsencrypt.sh` | Premier certificat TLS |
| `create-exporter-role.sh` | (Re)crée le rôle `nolte_exporter` |
| `set-gmail-smtp.sh` | Configure le SMTP Gmail dans `.env` |
| `harden-host.sh` | Durcissement initial de l'hôte (UFW, fail2ban, démon Docker) |
| `export-lovable.sh` / `import-lovable.sh` | Migration unique depuis Lovable Cloud (historique) |

## 7.10 Reprise après sinistre (serveur perdu)

1. Nouveau VPS : suivre `DEPLOY.md` §1 à §4 (utilisateur, Docker, clone, `harden-host.sh`, `bootstrap.sh`, DNS, `init-letsencrypt.sh`, `up -d`).
2. Récupérer une archive (hors site, voir 7.6) et `scripts/restore.sh <archive>`.
3. Repointer les DNS `noltenador.digital` et `supabase.noltenador.digital`.
4. Redémarrer la supervision : `.env` (`GRAFANA_ADMIN_PASSWORD`, `POSTGRES_EXPORTER_PASSWORD`, SMTP), `create-exporter-role.sh`, `ops.htpasswd`, puis `$C up -d`.
5. Réinstaller les crons : `scripts/install-cron.sh`.
6. Les utilisateurs se reconnectent : les sessions sont invalidées si le secret JWT change, mais les mots de passe sont conservés.

# 8. Modifier l'application : recettes

## 8.1 Ajouter une page

1. Créez `src/routes/_app.ma-page.tsx` :

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/data/page-header";

export const Route = createFileRoute("/_app/ma-page")({ component: MaPage });

function MaPage() {
  return <PageHeader title="Ma page" subtitle="À quoi elle sert" />;
}
```

2. Le plugin régénère `src/routeTree.gen.ts` au prochain `dev` ou `build` (à commiter).
3. Ajoutez l'entrée dans `src/components/app-sidebar.tsx` (tableau `main` ou `ops`), avec le `module` de permission qui conditionne l'affichage.
4. Réutilisez les briques de `src/components/data` (`Toolbar`, `SearchField`, `StatusBadge`, `DataPagination`, `EmptyState`, `ErrorState`) pour rester cohérent avec les autres listes.

## 8.2 Lire et écrire des données

```tsx
const { data = [], isLoading, error } = useQuery({
  queryKey: ["orders"],
  queryFn: async () => {
    const { data, error } = await supabase.from("orders").select("*, customers(name)");
    if (error) throw error;
    return data;
  },
});

const save = useMutation({
  mutationFn: async (payload) => {
    const { error } = await supabase.rpc("create_order", payload);
    if (error) throw error;
  },
  onSuccess: () => {
    toast.success("Commande créée");
    qc.invalidateQueries({ queryKey: ["orders"] }); // + toutes les listes impactées (stock, ventes…)
  },
  onError: (e: Error) => toast.error(e.message),
});
```

**Règles :**

- Toute opération qui touche **plusieurs tables ou le stock** doit être une **RPC SQL** transactionnelle, pas une suite d'appels depuis le navigateur.
- Après une action sur le stock, invalidez aussi `["products"]`, `["movements"]` et `["inventory"]`.
- Les messages d'erreur SQL (`RAISE EXCEPTION '…'`) sont affichés tels quels à l'utilisateur : rédigez-les en français clair.
- Confirmez les actions sensibles avec `useConfirm()` et une description qui **dit l'effet sur le stock et l'argent**.

## 8.3 Ajouter une permission ou un module

1. Migration : `insert into public.permissions(module, action, label) values ('livraisons','view','Voir les livraisons') on conflict do nothing;`, puis accordez-la aux rôles concernés dans `role_permissions`.
2. Politiques RLS de la table avec `public.user_has_permission(auth.uid(), 'livraisons', 'view')`.
3. Front : `const { can } = usePermissions(); can("livraisons", "create")` pour masquer les boutons, et `module: "livraisons"` dans le menu.
4. Vérifiez que l'écran *Rôles & permissions* affiche le nouveau module (les libellés d'actions viennent de `src/routes/_app.roles.tsx`).

## 8.4 Écrire une fonction SQL (RPC)

- `SECURITY INVOKER` par défaut (respecte RLS) ; `SECURITY DEFINER` uniquement pour les triggers internes, avec `SET search_path TO 'public'`.
- Idempotence pour les transitions d'état (voir `validate_order`, qui renvoie `already: true`).
- Verrouillez les lignes modifiées (`SELECT … FOR UPDATE`).
- Renvoyez du `jsonb` avec les numéros créés, pour les messages de l'interface.
- Terminez la migration par rien de spécial : `scripts/migrate.sh` envoie le `NOTIFY pgrst`.

## 8.5 Modifier un PDF

Les mises en page sont dans `src/lib/quote-pdf.ts`, `order-pdf.ts` et `invoice-pdf.ts` (jsPDF + autotable). L'en-tête des factures utilise `nado-logo-pdf.ts` (« Nado Cuisine », mentions légales `NADO_LEGAL_LINES`). Les autres documents utilisent `nolte-logo-pdf.ts`. `pdf-safe.ts` nettoie les caractères non supportés par les polices PDF standard. Testez en téléchargeant un document réel dans le navigateur.

## 8.6 Réactiver l'arabe dans l'interface

`src/lib/i18n.tsx` contient les dictionnaires `fr` et `ar`, mais le fournisseur force `lang: "fr"`. Pour réactiver :

1. exposer la vraie valeur `lang` et un sélecteur (Paramètres) ;
2. poser `dir="rtl"` et `lang="ar"` sur `<html>` ;
3. compléter les nombreux libellés codés en dur en français dans les pages (la plupart ne passent pas par `t()`).

Le menu gère déjà le côté droit (`side={lang === "ar" ? "right" : "left"}`), et les classes Tailwind logiques (`ms-`, `me-`, `start-`) sont utilisées.

## 8.7 Server function avec droits élevés

Modèle : `src/lib/users.functions.ts`.

```ts
export const maFonction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])       // JWT de l'appelant → context.userId, context.supabase
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);  // TOUJOURS vérifier avant
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // supabaseAdmin contourne RLS : ne jamais l'exposer au navigateur
  });
```

## 8.8 Mettre à jour la documentation

Les guides sont en Markdown dans `docs/`. Après modification :

```bash
docs/outils/generer-pdf.sh
```

Le script construit une image Docker jetable (WeasyPrint et polices Noto, arabe compris) et régénère les trois PDF. Conventions d'encadrés : voir l'en-tête de `docs/outils/md2pdf.py`.

# 9. Mettre à niveau

| Composant | Où | Conseils |
|---|---|---|
| Dépendances JS | `package.json` / `bun.lock` | `bun update` par petits lots ; rebuild ; parcours complet de l'app. TanStack Start évolue vite (nitro en bêta `3.0.x`) : lire les notes de version avant un saut majeur. |
| Node | `frontend/Dockerfile` (`node:22-alpine`) | Rester ≥ 22 (WebSocket natif requis). |
| Images Supabase | `docker-compose.yml` (tags figés) | Mettre à jour une image à la fois, sauvegarde et `verify-backup.sh` d'abord. GoTrue et Storage appliquent leurs propres migrations au démarrage. |
| Postgres majeur (15 → 16+) | `db` | **Jamais par simple changement de tag** : dump, nouveau volume, restauration. À tester sur une copie. |
| nginx, certbot, Kong | `docker-compose.prod.yml` / `docker-compose.yml` | Changement de tag puis `up -d` du service ; `nginx -t` avant. |
| Supervision | `docker-compose.monitoring.yml` | Garder les `mem_limit`. Loki/Promtail : ajouter un swap avant. |
| OS | Ubuntu | `unattended-upgrades` gère la sécurité ; redémarrages noyau planifiés hors heures ouvrées (`live-restore` Docker activé). |

**Capacité :** 3,8 Go de RAM, environ 1 Go libre, **pas de swap**. Un `build app` pendant les heures d'activité peut provoquer un arrêt par manque de mémoire (OOM). Ajouter un fichier d'échange de 2 Go est recommandé avant toute nouvelle charge.

# 10. Dette technique et problèmes connus

Classés par priorité. **P1** = risque de perte de données ou de sécurité ; **P2** = bug fonctionnel ou incohérence ; **P3** = amélioration.

| # | Prio | Problème | Piste de correction |
|---|---|---|---|
| 1 | P1 | **Aucune sauvegarde hors site** : les 14 archives sont sur le même disque. | Configurer restic (B2 ou S3) → `backup-offsite.sh` (7.6). |
| 2 | P1 | **Mouvements de stock antidatables** : le champ « Date du mouvement » écrit `created_at` (qui sert aussi d'horodatage d'audit) sans limite ; seul l'admin peut corriger après coup. | Colonne `movement_date` séparée, `created_at = now()` ; ou contrainte `CHECK` / trigger bornant la date. |
| 3 | P1 | **`returns` / `return_items` : RLS `USING (true)`** : tout compte connecté peut créer, modifier et supprimer des retours, donc déplacer du stock. | Politiques basées sur une permission (`stock.create` ou nouveau module `returns`). |
| 4 | P1 | **Pas de swap**, RAM tendue ; plusieurs services sans limite mémoire (db, kong, auth, rest, storage, minio, nginx). | Swap de 2 Go ; limites mémoire. |
| 5 | P2 | **E-mails non fonctionnels** (SMTP d'exemple) : alertes, réinitialisation de mot de passe. | `scripts/set-gmail-smtp.sh` (7.7). |
| 6 | P2 | **Facturation absente du menu** (`/invoices` accessible par URL uniquement). | Ajouter l'entrée dans `app-sidebar.tsx` (module `sales`). |
| 7 | P2 | **Double sortie de stock possible** : facture `pending`/`paid` avec lignes produits d'une commande déjà livrée. | Lier facture ↔ commande/vente et ne pas mouvementer si déjà livré ; ou factures sans effet stock. |
| 8 | P2 | **Interface ≠ matrice de permissions** : produits, fournisseurs et dépôts sont masqués par `isAdmin`, alors que la matrice accorde `create`/`update` au Manager ; `products` et `warehouses` ont une RLS admin-only. Les boutons de commande et de vente s'affichent pour tous, même sans droit (l'action échoue alors avec une erreur RLS). | Utiliser partout `can(module, action)` et aligner la RLS de `products` sur `user_has_permission`. |
| 9 | P2 | **Permissions sans effet** : `orders.validate`, `orders.cancel`, `stock.in/out/adjust` et `sales.invoice` ne sont vérifiées nulle part ; valider exige en réalité `orders.update` + `sales.create`. Le Magasinier (qui a `validate`) ne peut donc pas valider ; le Manager (qui a `in/out/adjust` mais pas `create`) ne peut pas saisir de mouvement. | Soit utiliser ces actions dans la RLS et les RPC, soit les retirer du catalogue. |
| 10 | P2 | **Menus mal reliés** : *Devis* s'affiche selon `sales.view` (RLS sur `quotes.view`) ; *Achats* selon `suppliers.view` (RLS sur `purchase_orders.view`). | Utiliser le bon module dans `app-sidebar.tsx`. |
| 11 | P2 | **Préférences de notifications décoratives** : enregistrées dans `localStorage`, jamais lues par `app-header.tsx`. | Les lire dans `useNotifications`, ou les stocker dans `profiles`. |
| 12 | P2 | **Clients en double** : chaque saisie de nom dans un devis, une commande ou une vente crée une nouvelle ligne `customers`. | Sélecteur de client existant avec recherche, et création explicite. |
| 13 | P3 | **Arabe désactivé** dans l'interface (`lang` forcé à `fr`, libellés codés en dur). | Voir 8.6. |
| 14 | P3 | **Libellé métier codé en dur** « Prix de Mr Bouhlalla » sur les factures. | Paramétrer ou supprimer. |
| 15 | P3 | **Pas de tests automatisés**, pas de CI de lint ou de build avant déploiement. | Au minimum `bun run lint` + `vite build` dans le workflow avant le SSH ; tests SQL des RPC de stock. |
| 16 | P3 | **Documentation d'origine obsolète par endroits** (`DEPLOY.md` : Hetzner, domaines génériques ; `monitoring/README.md` : ports). | Aligner sur ce guide. |
| 17 | P3 | Liste des mouvements limitée aux 2 000 plus récents dans l'écran Stock ; les mouvements antidatés peuvent en sortir. | Pagination serveur. |
| 18 | P3 | Loki/Promtail prêts mais non démarrés (mémoire). | Après ajout de swap : `--profile logs`. |

# 11. Checklist de passation

## 11.1 Accès à transmettre (hors de ce document, par canal sûr)

| Accès | Détenteur actuel / emplacement |
|---|---|
| Dépôt GitHub `Ahmed61911/noltekuchen` (droits admin) | Propriétaire du compte GitHub |
| Secrets GitHub Actions (`SSH_*`, `DEPLOY_PATH`) | GitHub → Settings → Secrets |
| Compte OVH (VPS, facturation, console de secours) | Propriétaire du compte OVH |
| Registrar et DNS de `noltenador.digital` | À identifier |
| SSH au serveur (clé publique à ajouter dans `~/.ssh/authorized_keys`) | Administrateur système |
| Fichier `/opt/nolte/.env` (**tous les secrets** : Postgres, JWT, MinIO, Grafana, exporter, SMTP) | Serveur uniquement, **ne jamais le commiter** |
| Mot de passe `ops` (Grafana/Prometheus) | Seul le hachage est dans `nginx/conf.d/ops.htpasswd` : le redéfinir si inconnu |
| Compte administrateur de l'ERP | Utilisateurs admin existants |
| Boîte `noltenador@gmail.com` (alertes, mot de passe d'application SMTP) | Propriétaire de la boîte |
| E-mail Let's Encrypt (`LETSENCRYPT_EMAIL`) | `.env` |

## 11.2 Première semaine du nouveau développeur

1. Lire les chapitres 1, 2, 4 et 5 de ce guide.
2. Se connecter en SSH, lancer `$C ps`, ouvrir Grafana, lancer `./scripts/verify-backup.sh`.
3. Monter la pile en local (6.2), restaurer une sauvegarde anonymisée ou de test (6.4).
4. Faire un aller-retour complet : petite modification → branche → PR → merge `main` → vérifier le déploiement (7.3), ou déployer manuellement (7.2).
5. Traiter les points **P1** du chapitre 10, en commençant par la sauvegarde hors site.
6. Activer les e-mails (7.7) et tester une alerte.
7. Révoquer ce qui n'est plus nécessaire : entrée sudoers `90-claude-ufw`, clé de déploiement GitHub si inutile, anciens comptes.

## 11.3 Contrôles réguliers

| Fréquence | Contrôle |
|---|---|
| Quotidien (automatique) | Sauvegarde 03:00 → `logs/nolte-backup.log` |
| Hebdomadaire (automatique) | Restauration test → `logs/nolte-verify-backup.log` (doit finir par `PASS`) |
| Hebdomadaire | Coup d'œil Grafana (disque, mémoire, cibles), boîte d'alertes |
| Mensuel | Mises à jour d'images mineures, espace disque (`docker system df`), revue des comptes utilisateurs |
| Trimestriel | Test de reprise après sinistre sur un VPS jetable (7.10) |

# Annexe A. Variables d'environnement (`.env`)

| Variable | Rôle |
|---|---|
| `NODE_ENV`, `APP_PORT`, `APP_URL`, `SESSION_SECRET` | Application |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` | Injectées **au build** dans le code navigateur (URL publique de l'API, clé anon) |
| `SUPABASE_URL` | URL interne de Kong pour le serveur (`http://kong:8000`) |
| `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET` | Clés JWT (anon, service_role) et secret de signature |
| `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | Base de données (superutilisateur) |
| `POSTGRES_EXPORTER_PASSWORD` | Rôle lecture seule de supervision |
| `GOTRUE_SITE_URL`, `GOTRUE_URI_ALLOW_LIST`, `GOTRUE_DISABLE_SIGNUP`, `GOTRUE_MAILER_AUTOCONFIRM`, `GOTRUE_JWT_EXP` | Authentification |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_ADMIN_EMAIL`, `SMTP_SENDER_NAME` | E-mails (GoTrue et alertes Grafana) |
| `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `STORAGE_S3_BUCKET`, `STORAGE_S3_ENDPOINT`, `STORAGE_S3_REGION` | Stockage objet |
| `DOMAIN_APP`, `DOMAIN_SUPABASE`, `LETSENCRYPT_EMAIL` | Domaines et TLS |
| `GRAFANA_ADMIN_PASSWORD` | Compte admin Grafana |
| `RESTIC_REPOSITORY`, `RESTIC_PASSWORD` (+ identifiants fournisseur) | Sauvegarde hors site (à créer) |
| `LOVABLE_*` | Migration unique historique, à vider |

# Annexe B. Commandes utiles

```bash
# État, logs, ressources
$C ps
$C logs -f --tail=200 app auth rest
docker stats --no-stream
df -h / && docker system df

# Base de données
docker exec -it nolte-db-1 psql -U postgres -d postgres
docker exec nolte-db-1 psql -U postgres -d postgres -c "select * from _schema_migrations order by 1 desc limit 5"
docker exec nolte-db-1 psql -U postgres -d postgres -c "NOTIFY pgrst, 'reload schema'"

# Stock d'un produit : historique complet
docker exec nolte-db-1 psql -U postgres -d postgres -c \
  "select created_at, type, quantity, stock_before, stock_after, reason from stock_movements
   where product_id = '<uuid>' order by created_at"

# Donner le rôle admin à un utilisateur existant
docker exec nolte-db-1 psql -U postgres -d postgres -c \
  "insert into user_roles(user_id, role) select id, 'admin' from auth.users where email='x@y.z' on conflict do nothing"

# nginx
docker exec nolte-nginx-1 nginx -t && docker exec nolte-nginx-1 nginx -s reload

# Sauvegardes
ls -lh backups/ && tail -20 logs/nolte-backup.log
./scripts/backup.sh && ./scripts/verify-backup.sh

# Pare-feu et sécurité
sudo ufw status verbose
sudo fail2ban-client status
```

---

*Document établi le 14/09/2026 à partir du code (commit `ddbe4a2`), de la base et de la configuration de production. En cas de divergence, le code et la base font foi : mettez ce guide à jour (8.8).*
