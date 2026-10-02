# Proxy Manager — Redesign Specification (v2)

Status: **Draft for review**
Author: Euan Bell
Goal: ground the full-stack rewrite so it can be built against and extended by the community.

## 1. Overview

A self-hosted reverse-proxy manager. A web UI (SvelteKit) drives a set of *providers* that
manage reverse-proxy rules and backend applications (Pterodactyl etc.). The app follows the
existing model: a **provider agent runs on the nginx/proxy host** and applies configuration to
the live service.

Three hard requirements shape every decision in this document:

1. **A provider agent runs on the proxy (nginx) host**, exactly like the current Pangolin-based setup.
2. **Two separate API surfaces**: an internal API (frontend ↔ backend, backend ↔ nodes) and an
   external API that third-party developers can build on.
3. **Providers are community-extensible via PRs** without breaking the sync engine.

## 2. Architecture

```
┌─────────────── Web app (single deployment) ───────────────┐
│  SvelteKit frontend  ──(internal API)──▸  Core backend     │
│                                                             │
│  Core backend: auth, RBAC, config store, rule engine,       │
│  providers registry, event outbox, audit, stats             │
│                                            │                │
│  ┌──────────────────────────┐             │ external API   │
│  │  Postgres (source of     │             ▾  /api/v1        │
│  │  truth)                  │          (API keys, scoped)   │
│  └──────────────────────────┘                                │
└──────────────────────────────────────────────────────────────┘
                    │  internal control channel (WebSocket)
                    ▼
        ┌─────────────────────────────┐
        │  Provider Agent (on nginx   │
        │  host) — reconciler applies │
        │  intent → live config       │
        └─────────────────────────────┘
                    │
         ┌──────────┴──────────┐
         ▼                     ▼
    backend provider      frontend proxy provider
    (Pterodactyl)         (nginx)
```

### 2.1 Internal vs external API

| | Internal API | External API |
|---|---|---|
| Consumers | Frontend ↔ backend; backend ↔ agent/nodes | Third-party developers, scripts, CI |
| Auth | Machine trust: localhost socket / short-lived signed token | API keys (scoped, rate-limited, owning user) |
| Surface | Not versioned; not reachable outside the deployment | Versioned `/api/v1`, OpenAPI-documented |
| Docs | Internal reference | Swagger UI + published schema |
| Default | Everything | Only routes explicitly declared |

**Rule:** the external API is an *explicit, named list* in the code. Only routes deliberately
declared as external appear on `/api/v1`. Everything else is internal and never exposed.

## 3. Tech stack

- **Frontend:** SvelteKit + Tailwind + shadcn-svelte components.
- **Validation & types & docs (single source):** Zod schemas → TS types + validation + OpenAPI
  (zod-openapi / `@asteasolutions/router`). Never hand-write OpenAPI; it is generated.
- **DB:** PostgreSQL (audit + stats justify it over sqlite). **Drizzle ORM** with committed
  migrations (Drizzle Kit).
- **Auth:** JWT (short-lived access) + rotating refresh token; compatible with multiple SSO
  providers via a pluggable strategy.
- **Real-time:** WebSocket for app ↔ agent control channel; SSE/WS for pushing live state to UI.
- **Delivery:** Docker Compose (app + db), agent shipped as its own image/artifact.

## 4. Data model (Postgres / Drizzle)

### Auth & users
- `users` — id, email, password_hash (nullable — SSO-only users), display_name, status,
  timestamps, created_by.
- `identities` — external SSO identity link: user_id, provider (name), provider_subject, raw profile.
- `sessions` / `refresh_tokens` — token jti, user_id, fingerprint, expires_at, revoked_at
  (powers "logout everywhere").
- `roles` — key + display name.
- `permissions` — the atom of authz (see §5).
- `role_permissions` — join; roles are bundles of permissions.

### Access (external API)
- `api_keys` — id, name, prefixed secret hash (`pk_` + random), owner_user_id, scopes (array),
  network_allowlist, rate_limit, expires_at, last_used_at, revoked_at.

### Config
- `settings` — key/value global config (defaults in code, DB overrides).
- `backend_providers` — name, type (registry key), enabled, config (encrypted JSON), target_host.
- `proxy_providers` — name, type (registry key), enabled, config (encrypted JSON), host.
- `rules` — the proxy rule set: domain/hostname, port/upstream, backend_provider_id,
  proxy_provider_id, enabled, desired_state, deployed_state, timestamps.
- `config_schemas` — provider config **schema versioning** (see §7.2).

### Providers / agents
- `nodes` — a proxy/agent host: name, transport endpoint, status (connected/last_seen), agent_version,
  agent_schema_version.
- `agent_state` — cache of what the agent reports it has deployed; feeds the reconciler.

### Audit & stats
- `audit_log` — immutable append: id, timestamp, actor_type (user/key/system), actor_id,
  action, target_type, target_id, request_id, ip, before/after JSON, result.
- `events` — outbox (see §8). Consumed by audit, stats, webhooks, agent notifications.
- `stat_events` — raw metric events (see §9).
- `stat_daily` / rollups — pre-aggregated with TTL.

## 5. RBAC

Permission model, not role checks. An endpoint answers "does the token carry `X.write`?"

Base permission set (extensible): `rules.read` `rules.write` `providers.read`
`providers.write` `users.manage` `roles.manage` `config.read` `config.write` `audit.read`
`stats.read` `keys.manage` `keys.self` `settings.write`

Roles (bundles of those permissions):
- **Owner** — all permissions.
- **Admin** — all except `roles.manage` (Owner keeps that); can manage users & keys.
- **Operator** — `rules.*`, `providers.read`, `stats.read`, `audit.read`, `keys.self`.
- **Viewer** — `*.read` across rules, providers, stats, audit.

Authz is checked once, in one middleware, against the permission name — never scattered
per-route role checks.

## 6. Auth

### 6.1 Providers
- **Password** (default): Argon2id, email verified (optional but on by default), optional TOTP.
- **SSO:** pluggable strategy; start with OIDC/Google. Provider list extensible via
  config + community PRs (same PR path as node providers).
- Login → issue **access JWT (short-lived, e.g. 15m)** + **rotating refresh token**
  (httpOnly cookie for web; returned for native/extended clients). Refresh rotation: each
  refresh issues a new token and invalidates the old; reuse detector revokes the session.

### 6.2 Secrets
- Master key encrypts provider configs and any stored secrets at rest.
- JWT signing keys: key rotation (kid header), separate signing vs verification.
- Builder password hash: Argon2id (use the `aes-256-gcm` pattern already established, with
  key rotation). Never log secrets or tokens.

### 6.3 External API keys
- `pk_` + random secret, only the **hash** stored; shown once at creation.
- Scoped to permissions; optional network allowlist; expiry; per-key rate limit.
- Actions attributed in audit log to "key `name` (owner: user)".

## 7. Provider system (community extensible)

### 7.1 Two provider kinds, one contract
- **Backend providers** (e.g. Pterodactyl): wrap a backend app's API — ports, instances,
  resource state — so rules can point at real backends.
- **Frontend proxy providers** (e.g. nginx): what actually receives traffic and where rules
  get applied — nginx config generation, reload, streams, TLS.

Both type-checked against a single **`Provider` interface**: typed config schema, list of
capabilities, lifecycle hooks (`validate`, `apply`, `status`, `health`).

### 7.2 Versioned config schemas + contract tests
- Each provider ships a **versioned Zod config schema** stored in `config_schemas`.
- A bundled **contract/fixture test harness** runs a provider against canned fixtures and
  asserts: schema validates, apply is idempotent, validate rejects bad config, no side
  effects outside declared scope.
- **PR gate:** a provider PR must pass the contract harness + schema version stays
  backward-compatible (or bumps). This is what makes community code safe to merge.

### 7.3 Registry
- Registry maps `type → provider implementation + schema`. Defaults: backend = pterodactyl,
  frontend = nginx. Third-party types load from enabled packages; unknown types are refused
  with a clear validation error.

## 8. Config propagation & the agent

- **App ↔ agent transport:** internal WebSocket (control channel). Agent connects out to the
  app (friendly to NAT/proxy hosts), auto-reconnects with backoff, negotiates
  `agent_schema_version`.
- **Intent vs live:** `rules.desired_state` (what the spec says) vs `deployed_state` (what the
  agent reports). The agent runs a **reconciler**: diff desired vs live, compute minimal
  change, apply, reload nginx only when something actually changed, report back.
- **Idempotency:** apply operations are pure/idempotent; safe to re-run.
- Out-of-band drift (manual change on the host): agent detects, reports, and either restores
  or flags it (configurable) — never silently overwrites in the "flag" mode.

## 9. Events, audit, stats

- **Event outbox** — the single source of truth for change. Any mutation emits an event
  (rule changed, deploy done, login failed, key created). Consumers subscribe:
  - **Audit log** writes an immutable row per security-relevant event.
  - **Stats** records metrics.
  - **Webhooks** (optional, configurable endpoints) notify externally.
- **Stats:** sources defined up front — nginx access logs / `stub_status` / prometheus
  endpoint; pterodactyl resource usage. Metric model: requests, domains, upstream, response
  codes, latency, active backends. **Retention/TTL + daily rollups** — raw stat_events
  expire (e.g. 30d), rollups kept longer. Prevents unbounded DB growth.

## 10. OpenAPI

- Generated from the same Zod schemas used for validation (single source of truth).
- Swagger UI mounted in-app; also exportable file for the docs site.
- External API (`/api/v1`) is fully documented; internal API is documented as reference
  only and not published externally.

## 11. Deployment & layout

Monorepo / packages:
```
apps/web        — SvelteKit (frontend + internal API routes)
apps/agent      — provider agent (runs on nginx host)
packages/core   — backend logic: registry, reconciler, RBAC, outbox
packages/schemas — Zod schemas (shared, the single source)
packages/keys    — secrets, JWT, encryption
packages/providers/<pterodactyl|nginx|...>
infra/          — docker-compose, migrations, agent image
docs/           — this spec, ADRs, provider authoring guide
```
- Docker Compose: `app` + `db`. Agent is a separate image deployed to the proxy host.
- Migrations: Drizzle committed, applied on startup; never mutate schema ad hoc.
- Self-host single-tenant (roles within one deployment), as chosen — multi-tenant deferred.

## 12. ADRs (decisions to revisit)
1. Provider agent runs on the proxy host; agent dials *out* to the app over WebSocket.
2. External API is an explicit, key-authed, versioned surface; everything else internal.
3. Zod is the single source for validation + types + OpenAPI (no hand-written docs).
4. Postgres + Drizzle; sqlite dropped (audit/stats).
5. Permission-based authz, not role checks in handlers.
6. Desired-state vs deployed-state reconciler; minimal-change, idempotent applies.

## 13. Proposed build order
1. Repo scaffold + monorepo + Postgres + Drizzle migration baseline.
2. Zod schemas package + DTOs.
3. Auth: password, JWT + refresh rotation, sessions/revocation, RBAC middleware.
4. Users/roles management UI.
5. Internal API + SvelteKit app shell, shadcn UI.
6. Provider contract + registry + pterodactyl & nginx providers + contract test harness.
7. Agent (WebSocket control channel + reconciler) on nginx host.
8. Rules CRUD wired end-to-end (UI → core → agent → nginx).
9. Event outbox + audit log UI.
10. External API keys (self-serve key manager UI) + `/api/v1` routes + OpenAPI.
11. Stats collection + retention.
12. SSO/OIDC provider.
13. Webhooks, polish, docs site, provider authoring guide for community PRs.