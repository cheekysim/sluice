import type { PageServerLoad, Actions } from './$types.js';
import { fail } from '@sveltejs/kit';
import { superValidate, message, setError } from 'sveltekit-superforms';
import { formSchema } from './schema';
import { zod4 } from 'sveltekit-superforms/adapters';
import { v4 as uuidv4 } from 'uuid';
import { invite } from '$lib/server/db/schema.js';

export const load: PageServerLoad = async () => {
	return {
		form: await superValidate(zod4(formSchema))
	};
};

export const actions: Actions = {
	default: async (event) => {
		const form = await superValidate(event, zod4(formSchema));
		if (!form.valid) {
			return fail(400, {
				form
			});
		}

		if (!event.locals.user) {
			return fail(401, {
				form,
				message: 'User not authenticated'
			});
		}

		if (!event.locals.db) {
			return fail(500, {
				form,
				message: 'Database not initialized'
			});
		}

		// Check if email in use

		const existingUser = await event.locals.db.query.user.findFirst({
			where: { email: form.data.email },
			columns: { id: true }
		});

		if (existingUser) {
			return setError(form, 'email', 'A user with this email already exists');
		}

		const existingInvite = await event.locals.db.query.invite.findFirst({
			where: { email: form.data.email },
			columns: { id: true }
		});

		if (existingInvite) {
			return setError(form, 'email', 'An invite for this email already exists');
		}

		const token = uuidv4();

		const daysValidFor: number = parseInt(form.data.inviteValidFor.split('_')[0], 10);

		// Get role ID
		const foundRole = await event.locals.db.query.role.findFirst({
			where: { name: form.data.role },
			columns: { id: true }
		});

		// Save to invite table
		await event.locals.db.insert(invite).values({
			email: form.data.email,
			invited_by: event.locals.user.id,
			created_at: new Date(),
			accepted: false,
			token: token,
			role_id: foundRole?.id,
			expires_at: new Date(Date.now() + daysValidFor * 24 * 60 * 60 * 1000)
		});

		return message(
			form,
			JSON.stringify({
				token: token,
				email: form.data.email,
				inviteValidFor: form.data.inviteValidFor
			})
		);
	}
};
