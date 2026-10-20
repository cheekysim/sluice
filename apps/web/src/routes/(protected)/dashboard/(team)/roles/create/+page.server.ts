import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { roleSchema } from '../schema';
import { saveRole } from '../save-role.server';

export const load: PageServerLoad = async ({ locals }) => ({
	form: await superValidate(zod4(roleSchema)),
	permissions: await locals.db.query.permission.findMany({ orderBy: { action: 'asc' } })
});

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const form = await superValidate(request, zod4(roleSchema));
		if (!form.valid) return fail(400, { form });

		if (form.data.name === 'owner') {
			return setError(form, 'name', 'This name is reserved');
		}
		const existing = await locals.db.query.role.findFirst({
			where: { name: form.data.name },
			columns: { id: true }
		});
		if (existing) return setError(form, 'name', 'A role with this name already exists');

		await saveRole(locals.db, form.data);
		redirect(303, '/dashboard/roles');
	}
};
