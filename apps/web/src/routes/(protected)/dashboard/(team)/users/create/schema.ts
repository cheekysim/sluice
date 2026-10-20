import { z } from 'zod';

export const formSchema = z.object({
	email: z.email(),
	inviteValidFor: z.string().min(1).default('3_day'),
	role: z.string().regex(/^[1-9]\d*$/, 'Please select a valid role')
});

export type FormSchema = typeof formSchema;
