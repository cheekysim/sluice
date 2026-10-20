import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { user } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const load = (async ({ locals, depends }) => {
	depends('app:users');

	const rows = await locals.db.query.user.findMany({
		columns: { id: true, name: true, email: true, roleId: true, image: true, provider: true },
		with: { role: { columns: { name: true } } }
	});
	// Load role name from the role id
	const users = rows.map(({ role, ...u }) => ({ ...u, roleName: role?.name ?? 'Unknown' }));
	return { users };
}) satisfies PageServerLoad;

export const actions = {
	deleteUser: async ({ request, locals }) => {
		const id = (await request.formData()).get('id');
		if (typeof id !== 'string') return fail(400, { success: false });

		if (id === locals.user?.id) {
			return fail(400, { success: false, message: 'You cannot delete your own account' });
		}

		const target = await locals.db.query.user.findFirst({
			where: { id },
			columns: { id: true },
			with: { role: { columns: { name: true } } }
		});
		if (target?.role?.name === 'owner') {
			return fail(403, { success: false, message: 'The owner account cannot be deleted' });
		}

		await locals.db.delete(user).where(eq(user.id, id));

		return { success: true };
	}
} satisfies Actions;
