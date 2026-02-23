# Deployment Guide — SlopMog

This covers deploying a Next.js + Prisma app behind the shared admakeai Traefik proxy.

> **Reusable template** — for new projects, copy this guide and find-replace `slopmog` with your project name and `slopmog.com` with your domain.

---

## Prerequisites

- Server: `ssh root@152.53.39.233`
- Server already running `admakeai` stack with Traefik (exposes ports 80/443)
- `deploy` alias loaded (see below)
- Cloudflare DNS pointing your domain to the server IP (proxy enabled)
- Git repo accessible from the server

---

## Production Files Overview

These files power the production deployment:

| File | Purpose |
|------|---------|
| `production.yml` | Docker Compose for production (postgres, redis, frontend, queue worker, prisma studio) |
| `compose/production/app/Dockerfile` | Multi-stage Next.js build (standalone output) |
| `compose/production/frontend_queue/Dockerfile` | BullMQ queue worker (ts-node, non-root) |
| `compose/production/prisma_studio/Dockerfile` | Prisma Studio for DB management |
| `compose/production/postgres/Dockerfile` | PostgreSQL 15 |
| `deploy.sh` | Zero-downtime rolling deploy helper (source in `~/.bashrc`) |
| `.dockerignore` | Keeps Docker context lean |
| `.env.production.example` | Template for production env vars |
| `next.config.js` | Must have `output: "standalone"` for Docker |
| `tsconfig.worker.json` | CommonJS tsconfig for ts-node worker process |

---

## 1. Traefik Config (admakeai — one-time per new project)

The traefik routes are already added in `admakeai/compose/production/traefik/traefik.yml`.
On the server, pull the latest admakeai repo and restart traefik:

```bash
cd ~/admakeai
git pull
docker compose -f production.yml up -d traefik
```

For reference, the entries added were:

**Routers** (`slopmog-router`, `slopmog-prisma-router`) routing `slopmog.com` to the frontend and `prisma.slopmog.com` to prisma studio.

**Services** (`slopmog_frontend` → `:3000`, `slopmog_prisma_studio` → `:5555`)

---

## 2. First-Time Deploy

### Setup deploy alias (if not already done):

```bash
echo "source ~/slopmog/deploy.sh" >> ~/.bashrc
source ~/.bashrc
```

### Clone and setup on server:

```bash
cd ~
git clone <your-repo-url> slopmog
cd ~/slopmog
```

### Create `.env.production`:

```bash
cp .env.production.example .env.production
nano .env.production
```

Fill in real values:
- `POSTGRES_PASSWORD` — generate a strong password
- `DATABASE_URL` — use that same password: `postgresql://postgres:YOUR_PASSWORD@postgres:5432/slopmog`
- `NEXTAUTH_SECRET` — generate a strong secret (`openssl rand -base64 32`)
- `NEXTAUTH_URL` — `https://slopmog.com`
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — your Google OAuth credentials
- `STRIPE_SECRET_KEY` — your Stripe secret key
- `STRIPE_WEBHOOK_SECRET` — your Stripe webhook signing secret
- `REDIS_URL` — `redis://redis:6379`

### Build and start:

```bash
docker compose -f production.yml build
docker compose -f production.yml up -d
```

### Run database migrations:

```bash
docker compose -f production.yml run --rm slopmog_prisma_studio env $(cat .env.production | grep -v "#" | xargs) npm run db:deploy
```

### Create Stripe products (first time only):

```bash
docker compose -f production.yml run --rm slopmog_frontend env $(cat .env.production | grep -v "#" | xargs) npm run stripe:products
```

---

## 3. Cloudflare DNS

Add these DNS records (if not already done):

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A | slopmog.com | 152.53.39.233 | Proxied |
| A | prisma.slopmog.com | 152.53.39.233 | Proxied |

SSL/TLS encryption mode: **Full** (not Strict).

**Note:** New domains may take a few minutes to hours for Cloudflare to provision the Universal SSL edge certificate. If you see `ERR_SSL_VERSION_OR_CIPHER_MISMATCH` in the browser, check **SSL/TLS → Edge Certificates** in the Cloudflare dashboard and wait for the status to show **Active**.

---

## 4. Subsequent Deploys

```bash
cd ~/slopmog
git pull
deploy production.yml slopmog_frontend slopmog_queue slopmog_prisma_studio
```

If schema changed, run migrations after deploy:

```bash
docker compose -f production.yml run --rm slopmog_prisma_studio env $(cat .env.production | grep -v "#" | xargs) npm run db:deploy
```

---

## 5. Architecture Overview

```
Internet → Cloudflare → Server:443
                          ↓
                    Traefik (admakeai stack)
                          ↓ (admakeai_traefik_network)
              slopmog_frontend:3000  ← production.yml
                          ↓ (default network)
                    postgres:5432
                    redis:6379
                          ↑
              slopmog_queue (BullMQ worker)
```

- Traefik lives in the `admakeai` compose stack and owns ports 80/443
- Each project joins `admakeai_traefik_network` (external) so Traefik can route to it
- Each project has its own internal `default` network for postgres/redis isolation
- The frontend service name (e.g. `slopmog_frontend`) must match what's in traefik.yml
- The queue worker (`slopmog_queue`) runs on the default network only — no external access needed
- Bull Board admin UI is at `/api/admin` (requires auth) for monitoring queues

---

## Troubleshooting

### Prisma: "Could not find Prisma Schema" during Docker build
The `postinstall` script runs `prisma generate` during `npm ci`. The Dockerfile must copy `prisma/` before `npm ci`, not after. Make sure the deps stage has:
```dockerfile
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci
```

### Traefik not picking up new routes
Docker layer caching can serve a stale `traefik.yml`. Always rebuild with `--no-cache`:
```bash
cd ~/admakeai
docker-compose -f production.yml build --no-cache traefik
docker-compose -f production.yml up -d traefik
```

### `ERR_SSL_VERSION_OR_CIPHER_MISMATCH` in browser
Cloudflare Universal SSL edge cert not provisioned yet. Check **SSL/TLS → Edge Certificates** in Cloudflare dashboard. Can take minutes to hours for new domains.

### Next.js standalone mode required
Docker deployment requires `output: "standalone"` in `next.config.js`. Without it, the `.next/standalone` directory won't exist and the Dockerfile `COPY` will fail.

### `postinstall` removed for production
If `postinstall: "prisma generate"` causes issues, remove it from `package.json` and rely on the explicit `RUN npx prisma generate` in the Dockerfile builder stage instead.

### Queue worker not processing jobs
Check the worker container logs:
```bash
docker compose -f production.yml logs -f slopmog_queue
```
Verify Redis is healthy and `REDIS_URL` is set to `redis://redis:6379` in `.env.production`.

### Stripe webhook not receiving events
Make sure `STRIPE_WEBHOOK_SECRET` in `.env.production` matches the signing secret from the Stripe dashboard for the production webhook endpoint (`https://slopmog.com/api/webhooks/stripe`).

---

## Template for New Projects

To add a new project to this server:

1. Copy `production.yml`, `compose/production/`, `deploy.sh`, `.dockerignore`, `.env.production.example` from this repo
2. Find-replace `slopmog` → `yourproject`
3. Add `output: "standalone"` to `next.config.js`
4. Add `"db:deploy": "prisma migrate deploy"` to `package.json` scripts
5. Add router + service entries to `admakeai/compose/production/traefik/traefik.yml`
6. Add DNS records in Cloudflare
7. First deploy: `docker compose -f production.yml build && docker compose -f production.yml up -d`
8. Run migrations
9. Subsequent deploys: `deploy production.yml yourproject_frontend yourproject_queue yourproject_prisma_studio`
