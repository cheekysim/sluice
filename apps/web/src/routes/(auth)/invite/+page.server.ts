import type { PageServerLoad, Actions } from './$types.js';
import { fail, redirect } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { formSchema } from './schema';
import { zod4 } from 'sveltekit-superforms/adapters';
import { eq } from 'drizzle-orm';
import { invite } from '$lib/server/db/schema.js';
import { user } from '$lib/server/db/auth.schema.js';
// import { client } from '$lib/auth-client.js';
import { auth } from '$lib/server/auth.js';

export const load = (async ({ url }) => {
	const token = url.searchParams.get('token');
	const email = url.searchParams.get('email');

	if (!token || !email) {
		return redirect(302, '/login');
	}

	return { token, email, form: await superValidate(zod4(formSchema)) };
}) satisfies PageServerLoad;

export const actions: Actions = {
	default: async (event) => {
		const form = await superValidate(event.request, zod4(formSchema));
		if (!form.valid) {
			return fail(400, { form });
		}

		const token = event.url.searchParams.get('token');

		if (!token) {
			return fail(400, { form, error: 'Missing token' });
		}

		if (!event.locals.db) {
			return fail(500, { form, error: 'Database not available' });
		}

		// Check data against invites
		const inviteRow = await event.locals.db.query.invite.findFirst({
			where: {
				email: form.data.email,
				token: token
			}
		});

		if (!inviteRow) {
			return fail(400, { form, error: 'Invalid invite' });
		}

		const newUser = await auth.api.signUpEmail({
			body: {
				name: form.data.name,
				email: form.data.email,
				password: form.data.password
			}
		});

		await event.locals.db
			.update(user)
			.set({
				provider: 'internal',
				roleId: inviteRow.role_id
			})
			.where(eq(user.id, newUser.user.id));

		await event.locals.db.delete(invite).where(eq(invite.id, inviteRow.id));

		return redirect(302, '/dashboard');
	}
};
