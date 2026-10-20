import { z } from 'zod';

export const formSchema = z.object({
	name: z.string().trim().min(1, 'Name is required'),
	email: z.email(),
	role: z.string().regex(/^[1-9]\d*$/, 'Please select a valid role')
});
