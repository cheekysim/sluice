import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { after, test } from 'node:test';
import { createServer } from 'vite';
import { providerDefinitions } from '../../agent/src/providers';
import { responseSchema, type ProviderAdvertisement } from '../src/lib/server/provider-schemas';

const advertised = responseSchema.parse({
	agentId: 'node-1',
	providers: providerDefinitions(),
	providerUpdate: null
}).providers;

const state: {
	allowed: boolean;
	permissions?: string[];
	updated?: Record<string, unknown>;
	found: boolean;
	published?: { subject: string; payload: unknown };
	natsFailure: boolean;
	publishFailure: boolean;
	providers: Record<string, { enabled: boolean; config: Record<string, unknown> }>;
	providerSchemas: ProviderAdvertisement[] | null;
	providerUpdate?: { id: string; status: 'queued' | 'applied' | 'failed'; message?: string };
	reportedUpdate?: { id: string; status: 'applied' | 'failed'; message?: string };
} = {
	allowed: true,
	found: true,
	natsFailure: false,
	publishFailure: false,
	providerSchemas: advertised,
	providers: {
		nginx: { enabled: true, config: {} },
		pterodactyl: { enabled: false, config: { apiKey: 'secret-value' } }
	}
};
Object.assign(globalThis, { nodeEditTestState: state });
const getPublished = () => state.published;
const getUpdated = () => state.updated;

const server = await createServer({
	configFile: false,
	server: { middlewareMode: true, hmr: false, ws: false },
	appType: 'custom',
	plugins: [
		{
			name: 'node-edit-test-dependencies',
			resolveId(id) {
				if (id === '$lib/server/provider-schemas')
					return `${process.cwd()}/src/lib/server/provider-schemas.ts`;
				if (id.startsWith('$lib/server/')) return `\0${id}`;
			},
			load(id) {
				if (id === '\0$lib/server/permissions') {
					return `export const requirePermission = async (_, ...permissions) => {
						globalThis.nodeEditTestState.permissions = permissions;
						if (!globalThis.nodeEditTestState.allowed) throw new Error('Forbidden');
					};
					export const hasPermission = async () => globalThis.nodeEditTestState.allowed;`;
				}
				if (id === '\0$lib/server/db/agent.schema') {
					return `export const agent = { agentId: 'id', agentName: 'name' };`;
				}
				if (id === '\0$lib/server/nats') {
					return `export const getNats = async () => {
						if (globalThis.nodeEditTestState.natsFailure) throw new Error('NATS unavailable');
						return { request: async () => ({ data: new TextEncoder().encode(JSON.stringify({
							agentId: 'node-1', providers: globalThis.nodeEditTestState.providerSchemas,
							providerUpdate: globalThis.nodeEditTestState.reportedUpdate ?? null
						})) }), jetstream: () => ({ publish: async (subject, payload) => {
							if (globalThis.nodeEditTestState.publishFailure) throw new Error('publish failed');
							globalThis.nodeEditTestState.published = {
								subject, payload: JSON.parse(new TextDecoder().decode(payload))
							};
						} }) };
					};
					export const ensureAgentConfigStream = async () => {};`;
				}
			}
		}
	]
});
after(() => server.close());

const { actions, load } = await server.ssrLoadModule(
	'/src/routes/(protected)/dashboard/(infrastructure)/nodes/[node]/+page.server.ts'
);
const locals = {
	db: {
		query: {
			agent: {
				findFirst: async ({ where }: { where: { agentId: string } }) =>
					state.found
						? {
								agentId: where.agentId,
								agentName: 'Node name',
								agentIP: '192.0.2.1',
								agentVersion: '1',
								providers: state.providers,
								providerSchemas: state.providerSchemas,
								providerUpdate: state.providerUpdate
							}
						: undefined
			}
		},
		update() {
			return {
				set: (values: Record<string, unknown>) => ({
					where: async () => {
						Object.assign(state, values);
					}
				})
			};
		},
		async transaction(fn: (tx: { update: () => object }) => Promise<boolean>) {
			let staged: Record<string, unknown> | undefined;
			const tx = {
				select() {
					return {
						from: () => ({
							where: () => ({
								for: async () =>
									state.found
										? [
												{
													agentId: 'node-1',
													agentName: 'Node name',
													providers: state.providers,
													providerSchemas: state.providerSchemas
												}
											]
										: []
							})
						})
					};
				},
				update() {
					return {
						set(values: Record<string, unknown>) {
							staged = values;
							return {
								where() {
									return {
										returning: async () => (state.found ? [{ id: 'node-1' }] : []),
										then: (resolve: () => void) => resolve()
									};
								}
							};
						}
					};
				}
			};
			const result = await fn(tx);
			state.updated = staged;
			return result;
		}
	}
};

const params = { node: 'node-1' };

function request(name: string) {
	const form = new FormData();
	form.set('name', name);
	return new Request('http://localhost/', { method: 'POST', body: form });
}

function providerRequest(
	type: string,
	values: Record<string, string>,
	enabled: boolean,
	version = advertised.find((item) => item.type === type)?.version ?? ''
) {
	const form = new FormData();
	form.set('provider', type);
	form.set('schemaVersion', version);
	if (enabled) form.set('enabled', 'on');
	for (const [key, value] of Object.entries(values)) form.set(`config.${key}`, value);
	return new Request('http://localhost/', { method: 'POST', body: form });
}

const nginxValues = {
	configDir: '/etc/nginx/sluice',
	reloadCmd: 'nginx -s reload',
	startCmd: 'nginx',
	testCmd: 'nginx -t -c'
};

test('validates and queues provider configuration while preserving other providers', async () => {
	state.published = undefined;
	const response = await actions.saveProvider({
		locals,
		params,
		request: providerRequest('nginx', nginxValues, true)
	});
	assert.deepEqual(response, { provider: 'nginx', success: true });
	assert.deepEqual(state.updated?.providers, {
		...state.providers,
		nginx: { enabled: true, config: nginxValues }
	});
	assert.deepEqual(getPublished()?.payload, {
		agentId: 'node-1',
		agentName: 'Node name',
		providers: state.updated?.providers,
		updateId: (state.updated?.providerUpdate as { id: string }).id,
		schemaVersions: Object.fromEntries(advertised.map((item) => [item.type, item.version]))
	});
});

test('rejects invalid or unimplemented providers and preserves existing secret values', async () => {
	state.updated = undefined;
	state.published = undefined;
	const invalid = await actions.saveProvider({
		locals,
		params,
		request: providerRequest('nginx', { ...nginxValues, reloadCmd: 'x'.repeat(5000) }, true)
	});
	// Reject oversized configuration before publishing.
	assert.equal(invalid.status, 400);
	assert.equal(state.updated, undefined);
	assert.equal(state.published, undefined);
	const ptero = { baseUrl: 'https://panel.example.com', apiKey: '', timeoutSeconds: '30' };
	const unavailable = await actions.saveProvider({
		locals,
		params,
		request: providerRequest('pterodactyl', ptero, true)
	});
	assert.equal(unavailable.status, 400);
	const saved = await actions.saveProvider({
		locals,
		params,
		request: providerRequest('pterodactyl', ptero, false)
	});
	assert.deepEqual(saved, { provider: 'pterodactyl', success: true });
	assert.deepEqual(getUpdated()?.providers, {
		...state.providers,
		pterodactyl: {
			enabled: false,
			config: { baseUrl: ptero.baseUrl, apiKey: 'secret-value', timeoutSeconds: 30 }
		}
	});
});

test('requires permissions and rolls back provider changes when publishing fails', async (t) => {
	t.mock.method(console, 'error', () => {});
	state.allowed = false;
	state.updated = undefined;
	try {
		await assert.rejects(
			actions.saveProvider({
				locals,
				params,
				request: providerRequest('nginx', nginxValues, true)
			}),
			/Forbidden/
		);
		assert.equal(state.updated, undefined);
	} finally {
		state.allowed = true;
	}
	state.publishFailure = true;
	try {
		const result = await actions.saveProvider({
			locals,
			params,
			request: providerRequest('nginx', nginxValues, true)
		});
		assert.equal(result.status, 503);
		assert.equal(state.updated, undefined);
	} finally {
		state.publishFailure = false;
	}
});

test('uses per-node advertised schemas, rejects stale versions and validates required fields', async () => {
	const dynamic: ProviderAdvertisement = {
		type: 'custom',
		name: 'Custom',
		implemented: true,
		version: 'a'.repeat(64),
		schema: {
			type: 'object',
			additionalProperties: false,
			properties: {
				endpoint: { type: 'string', minLength: 1 },
				port: { type: 'integer', minimum: 1 }
			},
			required: ['endpoint', 'port']
		}
	};
	state.providerSchemas = [...advertised, dynamic];
	try {
		const page = await load({ locals, params });
		assert.ok(page.providers.some((p: { type: string }) => p.type === 'custom'));
		const stale = await actions.saveProvider({
			locals,
			params,
			request: providerRequest('custom', { endpoint: 'ok', port: '10' }, true, 'b'.repeat(64))
		});
		assert.equal(stale.status, 400);
		assert.match(stale.data.message, /schema changed/i);
		const missing = await actions.saveProvider({
			locals,
			params,
			request: providerRequest('custom', { endpoint: '', port: '10' }, true, dynamic.version)
		});
		assert.equal(missing.status, 400);
		const invalid = await actions.saveProvider({
			locals,
			params,
			request: providerRequest('custom', { endpoint: 'ok', port: '0' }, true, dynamic.version)
		});
		assert.equal(invalid.status, 400);
		const saved = await actions.saveProvider({
			locals,
			params,
			request: providerRequest('custom', { endpoint: 'ok', port: '10' }, true, dynamic.version)
		});
		assert.equal(saved.success, true);
		assert.equal(
			(getPublished()?.payload as { schemaVersions: Record<string, string> }).schemaVersions.custom,
			dynamic.version
		);
	} finally {
		state.providerSchemas = advertised;
	}
});

test('uses cached schemas offline and synchronizes the latest matching agent status', async (t) => {
	t.mock.method(console, 'error', () => {});
	state.natsFailure = true;
	try {
		const offline = await load({ locals, params });
		assert.match(offline.schemaNotice, /cached/);
		assert.ok(offline.providers.length > 0);
		state.providerSchemas = null;
		const firstContact = await load({ locals, params });
		assert.equal(firstContact.providers.length, 0);
		assert.match(firstContact.schemaNotice, /No provider schemas/);
	} finally {
		state.natsFailure = false;
		state.providerSchemas = advertised;
	}
	const id = crypto.randomUUID();
	state.providerUpdate = { id, status: 'queued' };
	state.reportedUpdate = { id, status: 'failed', message: 'Provider schema changed: nginx' };
	try {
		const page = await load({ locals, params });
		assert.deepEqual(page.providerUpdate, state.reportedUpdate);
		state.reportedUpdate = { id: crypto.randomUUID(), status: 'applied' };
		const newer = await load({ locals, params });
		assert.equal(newer.providerUpdate?.id, id);
	} finally {
		state.providerUpdate = undefined;
		state.reportedUpdate = undefined;
	}
});

test('renames a node with write permission', async () => {
	state.updated = undefined;
	const result = await actions.renameNode({ locals, params, request: request(' Renamed ') });
	assert.deepEqual(state.permissions, ['nodes.read', 'nodes.write']);
	assert.deepEqual(state.updated, { agentName: 'Renamed' });
	assert.deepEqual(state.published, {
		subject: `agent.config.${createHash('sha256').update('node-1').digest('hex')}`,
		payload: { agentId: 'node-1', agentName: 'Renamed' }
	});
	assert.deepEqual(result, { success: true });
});

test('does not save or report success when JetStream is unavailable', async (t) => {
	t.mock.method(console, 'error', () => {});
	state.updated = undefined;
	state.published = undefined;
	state.natsFailure = true;
	try {
		const result = await actions.renameNode({ locals, params, request: request('New name') });
		assert.equal(result.status, 503);
		assert.equal(state.updated, undefined);
		assert.equal(state.published, undefined);
	} finally {
		state.natsFailure = false;
	}
	state.publishFailure = true;
	try {
		const result = await actions.renameNode({ locals, params, request: request('New name') });
		assert.equal(result.status, 503);
		assert.equal(state.updated, undefined);
		assert.equal(state.published, undefined);
	} finally {
		state.publishFailure = false;
	}
});

test('rejects invalid names and unknown nodes', async () => {
	state.updated = undefined;
	const invalid = await actions.renameNode({ locals, params, request: request('   ') });
	assert.equal(invalid.status, 400);
	assert.equal(state.updated, undefined);
	const tooLong = await actions.renameNode({ locals, params, request: request('a'.repeat(101)) });
	assert.equal(tooLong.status, 400);
	state.found = false;
	try {
		const missing = await actions.renameNode({ locals, params, request: request('New name') });
		assert.equal(missing.status, 404);
	} finally {
		state.found = true;
	}
});

test('requires write permission before modifying nodes', async () => {
	state.allowed = false;
	state.updated = undefined;
	try {
		await assert.rejects(
			actions.renameNode({ locals, params, request: request('New name') }),
			/Forbidden/
		);
		assert.deepEqual(state.permissions, ['nodes.read', 'nodes.write']);
		assert.equal(state.updated, undefined);
	} finally {
		state.allowed = true;
	}
});

test('loads the selected node and rejects missing or unauthorized nodes', async () => {
	const result = await load({ locals, params });
	assert.deepEqual(result.node, {
		agentId: 'node-1',
		agentName: 'Node name',
		agentIP: '192.0.2.1',
		agentVersion: '1'
	});
	assert.equal(result.breadcrumb, 'Node name');
	assert.equal(JSON.stringify(result).includes('secret-value'), false);
	const secret = result.providers
		.find((p: { type: string }) => p.type === 'pterodactyl')
		.fields.find((field: { key: string }) => field.key === 'apiKey');
	assert.equal(secret.hasValue, true);
	assert.equal(secret.value, '');
	assert.deepEqual(state.permissions, ['nodes.read', 'nodes.write']);
	state.found = false;
	try {
		await assert.rejects(load({ locals, params }), { status: 404 });
	} finally {
		state.found = true;
	}
	state.allowed = false;
	try {
		await assert.rejects(load({ locals, params }), /Forbidden/);
	} finally {
		state.allowed = true;
	}
});
