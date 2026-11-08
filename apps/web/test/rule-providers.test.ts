import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	planReconcile,
	ruleProviderOptions,
	type ProviderNode
} from '../src/lib/server/rule-providers';

const schema = { type: 'object' as const, properties: {} };
const provider = (type: string, extra = {}) => ({
	type,
	name: type.toUpperCase(),
	implemented: true,
	version: 'a'.repeat(64),
	schema,
	...extra
});
const nodes: ProviderNode[] = [
	{
		agentId: 'one',
		providers: { custom: { enabled: true, config: {} }, disabled: { enabled: false, config: {} } },
		providerSchemas: [provider('custom'), provider('disabled')]
	},
	{
		agentId: 'two',
		providers: { other: { enabled: true, config: {} }, custom: { enabled: true, config: {} } },
		providerSchemas: [provider('other'), provider('custom')]
	}
];

test('options include enabled advertisements and preserve unavailable assignments', () => {
	assert.deepEqual(ruleProviderOptions(nodes, [{ id: 1, providers: ['missing'] }]), [
		{ type: 'custom', name: 'CUSTOM', available: true },
		{ type: 'missing', name: 'missing', available: false },
		{ type: 'other', name: 'OTHER', available: true }
	]);
});

test('plans each enabled provider on each node, including empty assignments for deletions', () => {
	assert.deepEqual(planReconcile(nodes, [{ id: 1, providers: ['custom'], protocol: ['TCP'] }]), [
		{ agentId: 'one', providers: { custom: [1] } },
		{ agentId: 'two', providers: { other: [], custom: [1] } }
	]);
	assert.throws(
		() => planReconcile(nodes, [{ id: 2, providers: ['missing'], protocol: ['TCP'] }]),
		/No configured node/
	);
	assert.throws(() => planReconcile([], []), /No enabled providers/);
});

test('rejects assignments unsupported by a target node transport capability', () => {
	const node: ProviderNode = {
		...nodes[0],
		providerSchemas: [provider('custom', { capabilities: { transports: ['tcp'] } })]
	};
	assert.throws(
		() => planReconcile([node], [{ id: 1, providers: ['custom'], protocol: ['UDP'] }]),
		/does not support all protocols/
	);
	assert.doesNotThrow(() =>
		planReconcile([node], [{ id: 1, providers: ['custom'], protocol: ['TCP'] }])
	);
});

test('excludes disabled, unimplemented and readonly providers', () => {
	const node: ProviderNode = {
		agentId: 'x',
		providers: {
			disabled: { enabled: false, config: {} },
			stub: { enabled: true, config: {} },
			readonly: { enabled: true, config: {} }
		},
		providerSchemas: [
			provider('disabled'),
			provider('stub', { implemented: false }),
			provider('readonly', { capabilities: { transports: ['tcp'], readonly: true } })
		]
	};
	assert.deepEqual(ruleProviderOptions([node], []), []);
	assert.throws(() => planReconcile([node], []), /No enabled providers/);
});

test('does not deploy against pending or failed provider configuration', () => {
	for (const status of ['queued', 'failed'] as const) {
		assert.throws(
			() => planReconcile([{ ...nodes[0], providerUpdate: { id: 'id', status } }], []),
			new RegExp(status)
		);
	}
	assert.doesNotThrow(() =>
		planReconcile([{ ...nodes[0], providerUpdate: { id: 'id', status: 'applied' } }], [])
	);
});
