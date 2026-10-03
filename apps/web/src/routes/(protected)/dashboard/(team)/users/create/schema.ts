import { z } from 'zod';

export const formSchema = z.object({
	email: z.email(),
	inviteValidFor: z.string().min(1).default('3_day'),
	role: z.string().min(1).default('user')
});

export type FormSchema = typeof formSchema;
