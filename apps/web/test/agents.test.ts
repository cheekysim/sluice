import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { ErrorCode, NatsError } from 'nats';
import { createServer } from 'vite';

const state: {
	replies: unknown[];
	inserted: unknown[] | undefined;
	permission: string | undefined;
	failure: Error | undefined;
	saved: unknown[] | undefined;
	conflict: { set: Record<string, unknown> } | undefined;
	returnedColumns: Record<string, unknown> | undefined;
} = {
	replies: [],
	inserted: undefined,
	permission: undefined,
	failure: undefined,
	saved: undefined,
	conflict: undefined,
	returnedColumns: undefined
};

Object.assign(globalThis, { agentTestState: state });

const server = await createServer({
	configFile: false,
	server: { middlewareMode: true, hmr: false, ws: false },
	appType: 'custom',
	plugins: [
		{
			name: 'agent-test-dependencies',
			resolveId(id) {
				if (id.startsWith('$lib/server/')) return `\0${id}`;
			},
			load(id) {
				if (id === '\0$lib/server/nats') {
					return `export const getNats = async () => {
						if (globalThis.agentTestState.failure) throw globalThis.agentTestState.failure;
						return {
						requestMany: async () => (async function* () {
							for (const reply of globalThis.agentTestState.replies)
								yield { data: new TextEncoder().encode(JSON.stringify(reply)) };
						})()
					}; };`;
				}
				if (id === '\0$lib/server/permissions') {
					return `export const requirePermission = async (_, permission) => {
						globalThis.agentTestState.permission = permission;
					};`;
				}
				if (id === '\0$lib/server/db/schema') {
					return `export const agent = {
						agentId: 'id', agentName: 'name', agentIP: 'ip', agentVersion: 'version'
					};`;
				}
			}
		}
	]
});
after(() => server.close());

const { GET } = await server.ssrLoadModule('/src/routes/api/(internal)/agents/+server.ts');

const locals = {
	db: {
		insert() {
			return {
				values(values: unknown[]) {
					state.inserted = values;
					return {
						onConflictDoUpdate(conflict: { set: Record<string, unknown> }) {
							state.conflict = conflict;
							return {
								returning: async (columns: Record<string, unknown>) => {
									state.returnedColumns = columns;
									return state.saved ?? values;
								}
							};
						}
					};
				}
			};
		}
	}
};

test('returns an empty list without inserting when no agents reply', async () => {
	state.replies = [];
	state.inserted = undefined;
	const response = await GET({ locals });
	assert.deepEqual(await response.json(), { agents: [] });
	assert.equal(state.permission, 'nodes.read');
	assert.equal(state.inserted, undefined);
});

test('returns and saves agent replies', async () => {
	const agent = {
		agentId: 'agent-1',
		agentName: 'test',
		agentIP: '192.0.2.1',
		agentVersion: '1.0.0'
	};
	state.replies = [agent];
	state.inserted = undefined;
	const response = await GET({ locals });
	assert.deepEqual(await response.json(), { agents: [agent] });
	assert.deepEqual(state.inserted, [agent]);
	assert.equal('agentName' in (state.conflict?.set ?? {}), false);
});

test('does not insert or return provider configuration from discovery replies', async () => {
	const reported = {
		agentId: 'agent-1',
		agentName: 'test',
		agentIP: '192.0.2.1',
		agentVersion: '1.0.0',
		providers: { example: { config: { secret: 'sensitive-value' } } }
	};
	state.replies = [reported];
	const response = await GET({ locals });
	const body = await response.json();
	assert.equal(JSON.stringify(body).includes('sensitive-value'), false);
	assert.equal(JSON.stringify(state.inserted).includes('sensitive-value'), false);
	assert.deepEqual(Object.keys(state.returnedColumns ?? {}).sort(), [
		'agentIP',
		'agentId',
		'agentName',
		'agentVersion'
	]);
});

test('returns the saved dashboard name for a rediscovered agent', async () => {
	const reported = {
		agentId: 'agent-1',
		agentName: 'agent-reported',
		agentIP: '192.0.2.2',
		agentVersion: '2.0.0'
	};
	const saved = { ...reported, agentName: 'dashboard name' };
	state.replies = [reported];
	state.saved = [saved];
	try {
		const response = await GET({ locals });
		assert.deepEqual(await response.json(), { agents: [saved] });
		assert.deepEqual(state.inserted, [reported]);
		assert.deepEqual(Object.keys(state.conflict?.set ?? {}).sort(), ['agentIP', 'agentVersion']);
	} finally {
		state.saved = undefined;
	}
});

test('returns an empty list when NATS reports no responders', async () => {
	state.failure = new NatsError('No responders', ErrorCode.NoResponders);
	state.inserted = undefined;
	try {
		const response = await GET({ locals });
		assert.deepEqual(await response.json(), { agents: [] });
		assert.equal(state.inserted, undefined);
	} finally {
		state.failure = undefined;
	}
});

test('surfaces NATS failures rather than returning an empty list', async (t) => {
	state.failure = new Error('NATS unavailable');
	t.mock.method(console, 'error', () => {});
	try {
		await assert.rejects(GET({ locals }), { status: 503 });
	} finally {
		state.failure = undefined;
	}
});
