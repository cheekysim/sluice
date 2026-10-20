import { z } from 'zod';

export const roleSchema = z.object({
	name: z
		.string()
		.trim()
		.min(2, 'Name must be at least 2 characters')
		.max(50, 'Name must be at most 50 characters')
		.regex(/^[a-z0-9][a-z0-9_-]*$/, 'Use lowercase letters, numbers, "-" and "_" only'),
	description: z.string().trim().max(200, 'Description must be at most 200 characters').default(''),
	default: z.boolean().default(false),
	permissions: z.array(z.number().int().positive()).default([])
});

export type RoleSchema = typeof roleSchema;
