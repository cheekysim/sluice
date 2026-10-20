import { z } from 'zod';

export const formSchema = z.object({
	name: z.string().trim().min(1, 'Name is required'),
	email: z.email(),
	role: z.string().regex(/^[1-9]\d*$/, 'Please select a valid role')
});

export const passwordSchema = z
	.object({
		password: z
			.string()
			.min(8, 'Password must be at least 8 characters long')
			.max(128, 'Password must be at most 128 characters long'),
		confirmPassword: z
			.string()
			.min(8, 'Password must be at least 8 characters long')
			.max(128, 'Password must be at most 128 characters long')
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: 'Passwords must match',
		path: ['confirmPassword']
	});
