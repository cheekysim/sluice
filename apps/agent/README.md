# Agent configuration

The agent reads and persists its identity and settings in
`/app/config/agent.json` by default. Set `AGENT_CONFIG_PATH` to use another
location; its parent directory is created if necessary. The development
container uses `apps/agent/config/agent.json` in the workspace.

On first startup, missing settings are populated from `AGENT_ID`, `AGENT_NAME`,
`AGENT_VERSION`, and `AGENT_IP`, or generated/defaulted when those variables
are unset. Existing settings take precedence, except that the IP is refreshed
from `AGENT_IP` or public IP discovery at startup. Keep the configuration file between restarts to preserve the
agent ID. Restart or rebuild the development container to apply its configured
path, or set `AGENT_CONFIG_PATH` yourself when running outside it.

Node name edits are stored as desired configuration in the dashboard and sent
through the `AGENT_CONFIG` JetStream stream to a durable consumer specific to
that agent. Updates are queued while the agent is offline, applied in order,
and persisted before acknowledgement. The dashboard reports a queued update,
not confirmation that the agent has applied it. NATS JetStream must be enabled
and its storage retained across server restarts.

Provider settings and enablement are managed on the node edit page. The agent
validates enabled providers against their `configSchema`, persists updates, and
rebuilds its active provider registry. Existing nodes default to an enabled
Nginx provider using its schema defaults. Configure Nginx on the node page
before deploying if its paths or commands differ; the agent no longer reads
`NGINX_CONFIG_DIR` or `NGINX_RELOAD_CMD`. Nginx appends the generated temporary
configuration path to `testCmd`. The Pterodactyl provider
is a stub and cannot be enabled until its implementation is complete.

Each agent advertises every available provider (including disabled providers)
and a version fingerprint of its JSON Schema to the web app. The web app caches
these per node for offline editing; an agent must be online at least once before
its providers can be configured. Updates carry schema versions, and the agent
rejects mismatches instead of applying stale settings. The edit page shows the
latest update as queued, applied, or failed when refreshed. The editor accepts
flat object schemas with string, number, integer, or boolean fields; unsupported
schema constructs are rejected rather than ignored. Agent-side Zod validation
remains authoritative, including constraints not expressible in JSON Schema.

## Adding a provider

Run `pnpm create:provider example "Example Provider"` from the repository root,
then run `pnpm install`. Implement `packages/providers/example/src/index.ts` and
set `implemented` to `true` when it is ready. The package exports one
`providerDefinition` containing its unique type and display name,
`configSchema`, capabilities, a non-secret `exampleConfig` and a factory.
The factory must return a provider with the same type, name, capabilities and
schema. It should parse configuration and implement validation, apply, status
and health; add provider-specific tests for those operations.

The agent's `generate:providers` script discovers workspace packages named
`@sluice/provider-*` under `packages/providers` and generates
`src/provider-manifest.ts` from their package entry points. `dev`, `check` and
`build` regenerate the manifest automatically; `check` and `build` also
type-check each provider using its `tsconfig.json`. Restart the dev process after
adding a package and rebuild agents before deployment. Package dependencies
are installed in the workspace, not registered individually in the web app or
agent. The generated manifest loads provider entry points from the workspace;
deployment must include those packages and their installed dependencies, and
the current source-based package exports require a Node runtime supporting
TypeScript type stripping (the development container uses Node 26).

Run `pnpm --filter agent test:providers` to check every bundled definition and
its advertised schema against the web editor, plus the scaffold and Nginx
behavior tests. Run `pnpm --filter @sluice/provider-example check` to type-check
a scaffolded package. Test provider-specific behavior separately. Supported
schemas are flat objects with string, number, integer or boolean fields and
the constraints accepted in the web app's `provider-schemas.ts`; the contract
test rejects unsupported advertisements. Secret fields use Zod metadata
`meta({ secret: true })`; do not put real credentials in `exampleConfig`.
Schema fingerprints change when the schema or implementation status changes.
The web app caches each node's advertisement when its edit page is opened.

Rule choices are derived from enabled, implemented providers on cached node
advertisements, including offline nodes. Existing assignments to unavailable
providers remain visible and can be removed. Deployments send a separate
durable JetStream task to every configured node, including empty assignments
for enabled providers so removed rules are reconciled. A deployment is rejected
if an assigned provider has no configured node, a node lacks a required
transport, or a target node's provider update is pending or failed. Refresh the
node edit page to retrieve the latest update status before deploying. Disabled
providers are not reconciled; remove their rules before disabling them.

New deployments use the `AGENT_RECONCILE` stream rather than the legacy shared
`TASKS` worker. Upgrade all agents before deploying with this version of the
web app; older agents do not consume the new subjects. Messages remain queued
for offline agents while JetStream storage is retained. The dashboard reports
an aggregate success only after every targeted node reports success; its
in-memory result tracking times out after five minutes and does not survive a
web restart, even though queued JetStream messages may still be applied later.
If publishing fails partway through a multi-node deployment, some nodes may
already have received their task; the error instructs you to retry.

Provider credentials are stored in the dashboard database, agent config file,
and JetStream messages. Restrict access to all three and secure NATS transport
and storage. Credentials are not included in agent discovery responses or
returned to the browser. The agent config file is restricted to its owner.

Before deploying the provider editor to an existing database, apply
`apps/web/migrations/0001_node_providers.sql` with your normal PostgreSQL
migration process, followed by `apps/web/migrations/0002_agent_provider_schemas.sql`,
or use the existing `pnpm --filter web db:push` workflow. These add desired
provider settings and the per-node schema cache without removing existing nodes.

Run the configuration tests with `node --import tsx --test test/config.test.ts`
from this directory.
