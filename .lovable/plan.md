## Analyse de préparation à la migration locale et options de déploiement production

### 1. État actuel — le projet est-il prêt pour un self-hosting complet ?

**Ce qui est déjà en place (bon état)** :
- `docker-compose.yml` (dev) et `docker-compose.prod.yml` (Nginx + certbot + limites ressources) complets
- Stack Supabase auto-hébergée : Postgres 15, GoTrue, PostgREST, Storage-API, Kong, MinIO (S3), MailHog
- `frontend/Dockerfile` multi-stage qui swap le build Cloudflare Workers vers Node SSR (`frontend/vite.config.node.ts` + `frontend/server-node.ts`)
- Scripts opérationnels : `bootstrap.sh`, `migrate.sh`, `create-admin.sh`, `backup.sh`, `restore.sh`, `export-lovable.sh`, `import-lovable.sh`
- Migrations SQL versionnées dans `database/migrations/` + tracking via `public._schema_migrations`
- Documentation `MIGRATION.md` détaillée (export Lovable → import local, TLS, backup cron)
- RLS + policies + GRANTs corrects sur toutes les tables publiques

**Points à corriger/vérifier avant migration** :

| # | Problème | Impact | Action |
|---|---|---|---|
| 1 | Le code applicatif importe encore `@/integrations/supabase/client.server.ts` qui lit `SUPABASE_SERVICE_ROLE_KEY` — OK côté SSR Node mais **vérifier qu'aucun `.functions.ts` client-reachable ne l'importe au top-level** | Build cassé ou fuite service_role côté client | Audit rapide `rg "client.server" src/` |
| 2 | `wrangler.jsonc` + `vite.config.ts` ciblent Cloudflare Workers — non utilisés en Docker mais restent dans le repo | Confusion | À documenter comme "Lovable-only", pas bloquant |
| 3 | Les mots de passe utilisateurs Lovable ne peuvent PAS être exportés (JWT signing keys différents) | Tous les users devront reset leur mot de passe | Déjà documenté §2.2 — prévenir les users |
| 4 | Les buckets `product-images` et `documents` doivent exister dans MinIO avant l'import | Erreurs d'upload | `minio-init` service le fait déjà — OK |
| 5 | Le SMTP dev = MailHog. En prod il faut un vrai provider (Sendgrid, Resend, AWS SES, Postmark…) sinon reset password, magic links, invitations ne partent pas | Auth cassée en prod | Configurer `SMTP_*` dans `.env` avant `up -d` |
| 6 | Pas de monitoring/log aggregation par défaut (juste `json-file` avec rotation 10Mx5) | Debug prod limité | Optionnel : ajouter Grafana+Loki, ou utiliser Better Stack / Axiom |
| 7 | Backups locaux uniquement (`backups/*.tar.gz`) — il faut rsync off-site | Perte totale si le VPS meurt | Ajouter cron rsync ou restic vers S3/B2 |
| 8 | Pas de CI/CD — chaque déploiement est manuel (`git pull && docker compose build && migrate.sh`) | Friction | Optionnel : GitHub Actions → SSH deploy |
| 9 | Le fichier `supabase/config.toml` référence toujours le project_id Lovable | Cosmétique, ignoré en self-hosted | Peut être supprimé |
| 10 | Pas de rate limiting Nginx ni fail2ban | Exposition brute-force sur `/auth/*` | Ajouter `limit_req` sur `nginx/conf.d/app.conf` pour `/auth/token` |

**Verdict** : la base est **prête à ~90 %**. Les points 5, 7, 10 sont à traiter avant mise en production. Les autres sont cosmétiques ou optionnels.

---

### 2. Options de déploiement production — coût comparé

Hypothèse de charge : ERP interne ~10–30 utilisateurs actifs, 5–20 GB de données produits/documents, quelques centaines de requêtes/minute en pointe.

#### Option A — VPS unique (recommandé pour démarrer)
Tout (app + Supabase + Postgres + MinIO + Nginx) sur une seule machine, exactement ce que `docker-compose.prod.yml` fait.

| Fournisseur | Specs | Prix/mois |
|---|---|---|
| **Hetzner CX32** (Allemagne/Finlande) | 4 vCPU, 8 GB RAM, 80 GB SSD | **~7 €** |
| **Hetzner CPX41** (perf AMD) | 8 vCPU, 16 GB RAM, 240 GB SSD | ~26 € |
| **OVH VPS Value 4** | 4 vCPU, 8 GB, 160 GB | ~13 € |
| **DigitalOcean Droplet** | 4 vCPU, 8 GB, 160 GB | ~48 $ |
| **Scaleway DEV1-L** | 4 vCPU, 8 GB, 80 GB | ~18 € |

**Coûts annexes** :
- Domaine : ~10–15 €/an
- Backups off-site (Backblaze B2 ou Hetzner Storage Box 1 TB) : **~3–4 €/mois**
- SMTP transactionnel : Resend 3000 mails/mois **gratuit**, puis 20 $/mois pour 50k

**Total réaliste : 10–15 €/mois** (Hetzner CX32 + Storage Box + domaine).

#### Option B — VPS + Postgres managé
Séparer la DB pour bénéficier de backups automatiques et haute dispo.

- App VPS (Hetzner CX22, 2 vCPU / 4 GB) : ~4 €
- Postgres managé : Neon (10 GB free tier, puis 19 $), Supabase Cloud Pro (25 $), Hetzner Managed PG (~17 €)
- MinIO reste sur le VPS, ou remplacé par Backblaze B2 (0.005 $/GB/mois)

**Total : ~25–40 €/mois**. Plus résilient mais plus complexe (deux réseaux, migrations à cibler la DB managée).

#### Option C — Container platforms (Fly.io / Railway / Render)
Push d'images Docker, TLS auto, scaling.

| Plateforme | Config équivalente | Prix/mois estimé |
|---|---|---|
| **Fly.io** | 2 machines shared-cpu-2x + PG 4GB + Tigris (S3) | ~30–45 $ |
| **Railway** | App + PG + volumes | ~20–40 $ selon usage |
| **Render** | Web service Standard + PG Standard | ~35 $ |

Simple à opérer, mais coût qui monte vite avec le trafic. Pas de MinIO — utiliser leur S3 équivalent.

#### Option D — Kubernetes managé (overkill pour votre taille)
GKE/EKS/DOKS + Cloud SQL + Cloud Storage.

- Cluster minimal : ~70 $ (control plane) + nodes ~50 $ + PG ~30 $ + storage ~10 $
- **Total : 150–250 $/mois**. À ignorer sauf besoin de multi-tenant ou multi-région.

#### Option E — Rester sur Lovable Cloud
Plans Lovable Pro à Business selon usage : ~20–50 $/mois. Zéro ops.

---

### 3. Recommandation

**Pour cet ERP interne** : **Option A avec Hetzner CX32** (~10 €/mois tout compris).
- Ratio prix/performance imbattable en Europe (RGPD OK)
- Le stack Docker existant fonctionne tel quel
- Migration en ~2 h : provision VPS → `bootstrap.sh` → import Lovable → certbot → DNS

Passer à l'**Option B** (Postgres managé) uniquement si :
- Vous voulez du PITR (point-in-time recovery) sans gérer WAL
- Vous prévoyez >100 utilisateurs concurrents
- La perte de 24 h de données (backup quotidien) est inacceptable

---

### 4. Actions concrètes avant "go production" (par ordre)

1. Choisir un provider SMTP (Resend recommandé) et renseigner `SMTP_*` dans `.env`
2. Ajouter rate-limiting Nginx sur `/auth/*` (protection brute-force)
3. Configurer rsync/restic vers un stockage off-site (Backblaze B2 ou Hetzner Storage Box)
4. Provisionner le VPS, pointer les DNS (`app.` et `supabase.`)
5. Suivre §3–4 de `MIGRATION.md`
6. Optionnel : nettoyer `wrangler.jsonc`, `vite.config.ts`, `supabase/config.toml` (résidus Lovable) et supprimer les scripts `export-lovable.sh`/`import-lovable.sh` une fois la migration faite
7. Optionnel : GitHub Action de déploiement (SSH + `docker compose pull && up -d`)

Voulez-vous que j'implémente ces corrections (rate-limiting, cleanup Lovable, CI/CD) dans un plan de build ?
