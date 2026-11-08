import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { after, test } from 'node:test';
import { createServer } from 'vite';

const state = {
	published: [] as {
		subject: string;
		payload: { providers: Record<string, number[]>; rules: unknown[] };
	}[],
	tracked: [] as string[],
	fail: false
};
Object.assign(globalThis, { reconcileTestState: state });
const server = await createServer({
	configFile: false,
	server: { middlewareMode: true, hmr: false, ws: false },
	appType: 'custom',
	plugins: [
		{
			name: 'reconcile-test-dependencies',
			resolveId(id) {
				if (id === '$lib/server/rule-providers') return resolve('src/lib/server/rule-providers.ts');
				if (id === '$lib/server/nats' || id === '$lib/server/permissions.js') return `\0${id}`;
			},
			load(id) {
				if (id === '\0$lib/server/permissions.js')
					return 'export const requirePermission = async () => {};';
				if (id === '\0$lib/server/nats')
					return `
				export const trackTask = async (_, ids) => { globalThis.reconcileTestState.tracked = ids; };
				export const getNats = async () => ({
					jetstreamManager: async () => ({ streams: { info: async () => ({ config: { subjects: ['agent.reconcile.>'] } }) } }),
					jetstream: () => ({ publish: async (subject, data) => {
						if (globalThis.reconcileTestState.fail && globalThis.reconcileTestState.published.length) throw new Error('offline');
						globalThis.reconcileTestState.published.push({ subject, payload: JSON.parse(new TextDecoder().decode(data)) });
					} })
				});`;
			}
		}
	]
});
after(() => server.close());
const { POST } = await server.ssrLoadModule(
	'/src/routes/api/(internal)/trigger-reconcile/+server.ts'
);
const schema = { type: 'object', properties: {} };
const nodes = ['one', 'two'].map((agentId) => ({
	agentId,
	providers: { custom: { enabled: true, config: {} } },
	providerSchemas: [
		{ type: 'custom', name: 'Custom', implemented: true, version: 'a'.repeat(64), schema }
	]
}));
const rules = [{ id: 1, host: 'host', port: 80, protocol: ['TCP'], providers: ['custom'] }];
const locals = {
	db: {
		query: {
			rule: { findMany: async () => rules },
			agent: { findMany: async () => nodes }
		}
	}
};

test('publishes separately to each node and tracks all child results first', async () => {
	state.published = [];
	state.fail = false;
	const response = await POST({ locals });
	assert.equal(response.status, 200);
	assert.equal(state.tracked.length, 2);
	assert.deepEqual(
		state.published.map((entry) => entry.subject),
		nodes.map(
			(node) => `agent.reconcile.${createHash('sha256').update(node.agentId).digest('hex')}`
		)
	);
	assert.deepEqual(
		state.published.map((entry) => entry.payload.providers),
		[{ custom: [1] }, { custom: [1] }]
	);
});

test('reports partial queue failures explicitly', async (t) => {
	state.published = [];
	state.fail = true;
	t.mock.method(console, 'error', () => {});
	const response = await POST({ locals });
	assert.equal(response.status, 503);
	assert.match((await response.json()).message, /Some nodes may already/);
	assert.equal(state.published.length, 1);
	state.fail = false;
});
