import { z } from 'zod';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const fieldSchema = z
	.object({
		type: z.enum(['string', 'number', 'integer', 'boolean']),
		description: z.string().max(1000).optional(),
		secret: z.boolean().optional(),
		default: z.union([z.string().max(4096), z.number().finite(), z.boolean()]).optional(),
		minLength: z.number().int().min(0).max(4096).optional(),
		maxLength: z.number().int().min(0).max(4096).optional(),
		format: z.enum(['uri', 'email', 'ipv4', 'ipv6']).optional(),
		minimum: z.number().finite().optional(),
		maximum: z.number().finite().optional(),
		exclusiveMinimum: z.number().finite().optional(),
		exclusiveMaximum: z.number().finite().optional(),
		enum: z
			.array(z.union([z.string().max(4096), z.number().finite(), z.boolean()]))
			.max(100)
			.optional()
	})
	.strict();

const schema = z
	.object({
		$schema: z.literal('https://json-schema.org/draft/2020-12/schema').optional(),
		type: z.literal('object'),
		properties: z.record(z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,63}$/), fieldSchema),
		required: z.array(z.string()).max(100).optional(),
		additionalProperties: z.literal(false).optional()
	})
	.strict()
	.refine((value) => Object.keys(value.properties).length <= 100, 'Too many fields')
	.refine(
		(value) => (value.required ?? []).every((key) => key in value.properties),
		'Unknown required field'
	);

export const advertisementSchema = z
	.object({
		type: z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/),
		name: z.string().min(1).max(100),
		implemented: z.boolean(),
		capabilities: z
			.object({
				transports: z.array(z.enum(['tcp', 'udp'])),
				readonly: z.boolean().optional()
			})
			.strict()
			.optional(),
		version: z.string().regex(/^[0-9a-f]{64}$/),
		schema
	})
	.strict();
export const providerUpdateSchema = z
	.object({
		id: z.string().uuid(),
		status: z.enum(['queued', 'applied', 'failed']),
		message: z.string().max(1000).optional()
	})
	.strict();
export const responseSchema = z
	.object({
		agentId: z.string().min(1).max(256),
		providers: z.array(advertisementSchema).max(50),
		providerUpdate: providerUpdateSchema.nullable()
	})
	.strict()
	.refine(
		(value) => new Set(value.providers.map((p) => p.type)).size === value.providers.length,
		'Duplicate providers'
	);

export type ProviderAdvertisement = z.infer<typeof advertisementSchema>;
export type ProviderUpdateStatus = z.infer<typeof providerUpdateSchema>;
export type ProviderSettings = Record<
	string,
	{ enabled: boolean; config: Record<string, unknown> }
>;

export function validateProviderConfig(
	definition: ProviderAdvertisement,
	config: Record<string, unknown>
) {
	if (!definition.implemented) throw new Error(`${definition.name} is not implemented`);
	const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: true });
	addFormats(ajv);
	const validate = ajv.compile(definition.schema);
	if (!validate(config)) {
		throw new Error(ajv.errorsText(validate.errors, { separator: '; ' }));
	}
}
