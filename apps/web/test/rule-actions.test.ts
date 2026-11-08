import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { after, test } from 'node:test';
import { createServer } from 'vite';

const state: { saved?: Record<string, unknown> } = {};
Object.assign(globalThis, { ruleActionTestState: state });
const server = await createServer({
	configFile: false,
	server: { middlewareMode: true, hmr: false, ws: false },
	appType: 'custom',
	plugins: [
		{
			name: 'rule-action-dependencies',
			resolveId(id) {
				if (id === '$lib/server/rule-providers') return resolve('src/lib/server/rule-providers.ts');
				if (
					id === '$lib/server/db/rule.schema' ||
					id === '$lib/server/permissions' ||
					id === 'drizzle-orm'
				)
					return `\0${id}`;
			},
			load(id) {
				if (id === '\0$lib/server/db/rule.schema') return 'export const rule = { id: "id" };';
				if (id === '\0$lib/server/permissions')
					return 'export const requirePermission = async () => {}; export const hasPermission = async () => true;';
				if (id === '\0drizzle-orm') return 'export const eq = (_, value) => value;';
			}
		}
	]
});
after(() => server.close());
const { actions } = await server.ssrLoadModule('/src/routes/(protected)/dashboard/+page.server.ts');
const nodes = [
	{
		agentId: 'node',
		providers: { custom: { enabled: true, config: {} } },
		providerSchemas: [
			{
				type: 'custom',
				name: 'Custom',
				implemented: true,
				version: 'a'.repeat(64),
				schema: { type: 'object', properties: {} }
			}
		]
	}
];
const rules = [{ id: 1, host: 'host', port: 80, protocol: ['TCP'], providers: ['missing'] }];
const locals = {
	db: {
		query: { rule: { findMany: async () => rules }, agent: { findMany: async () => nodes } },
		insert: () => ({
			values: async (values: Record<string, unknown>) => {
				state.saved = values;
			}
		}),
		update: () => ({
			set: (values: Record<string, unknown>) => ({
				where: () => ({
					returning: async () => {
						state.saved = values;
						return [{ id: 1 }];
					}
				})
			})
		})
	}
};
const request = (entries: [string, string][]) =>
	new Request('http://localhost', {
		method: 'POST',
		body: new URLSearchParams(entries)
	});

test('allows an advertised provider when creating a rule', async () => {
	state.saved = undefined;
	const result = await actions.saveRule({
		locals,
		request: request([
			['host', 'host'],
			['port', '80'],
			['protocol', 'TCP'],
			['provider', 'custom']
		])
	});
	assert.deepEqual(result, { success: true });
	assert.deepEqual(state.saved?.providers, ['custom']);
});

test('rejects unknown providers while allowing existing unavailable assignments', async () => {
	const invalid = await actions.setRuleProviders({
		locals,
		request: request([
			['id', '1'],
			['provider', 'unknown']
		])
	});
	assert.equal(invalid.status, 400);
	const preserved = await actions.setRuleProviders({
		locals,
		request: request([
			['id', '1'],
			['provider', 'missing'],
			['provider', 'custom']
		])
	});
	assert.deepEqual(preserved, { success: true });
	assert.deepEqual(state.saved?.providers, ['missing', 'custom']);
});
