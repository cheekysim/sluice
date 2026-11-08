import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	advertisementSchema,
	responseSchema,
	validateProviderConfig
} from '../src/lib/server/provider-schemas';

const custom = {
	type: 'custom',
	name: 'Custom',
	implemented: true,
	version: 'a'.repeat(64),
	schema: {
		type: 'object',
		properties: {
			url: { type: 'string', format: 'uri', minLength: 1 },
			timeout: { type: 'number', exclusiveMinimum: 0 },
			flag: { type: 'boolean' }
		},
		required: ['url', 'timeout']
	}
};

test('validates advertised required fields, types and constraints', () => {
	const definition = advertisementSchema.parse(custom);
	assert.doesNotThrow(() =>
		validateProviderConfig(definition, { url: 'https://example.com', timeout: 1 })
	);
	assert.throws(() => validateProviderConfig(definition, { timeout: 1 }));
	assert.throws(() => validateProviderConfig(definition, { url: 'not a url', timeout: 1 }));
	assert.throws(() =>
		validateProviderConfig(definition, { url: 'https://example.com', timeout: 0 })
	);
	assert.throws(() =>
		validateProviderConfig(definition, { url: 'https://example.com', timeout: 1, flag: 'yes' })
	);
});

test('rejects unsupported, unsafe and duplicate advertisements', () => {
	assert.throws(() =>
		advertisementSchema.parse({
			...custom,
			schema: { ...custom.schema, $ref: 'https://example.com/schema' }
		})
	);
	assert.throws(() =>
		advertisementSchema.parse({
			...custom,
			schema: { ...custom.schema, properties: { value: { type: 'string', pattern: '(a+)+' } } }
		})
	);
	assert.throws(() =>
		responseSchema.parse({ agentId: 'id', providers: [custom, custom], providerUpdate: null })
	);
});
