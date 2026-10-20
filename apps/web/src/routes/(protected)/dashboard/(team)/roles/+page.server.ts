import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { role } from '$lib/server/db/auth.schema';

export const load = (async ({ locals, depends }) => {
	depends('app:roles');

	const rawRoles = await locals.db.query.role.findMany({
		with: {
			permissions: {
				columns: {
					roleId: false,
					permissionId: false
				},
				with: {
					permission: true
				}
			},
			users: { columns: { id: true } }
		}
	});

	const roles = rawRoles.map((role) => ({
		...role,
		permissions: role.permissions.map((p) => p.permission)
	}));

	return { roles };
}) satisfies PageServerLoad;

export const actions = {
	deleteRole: async ({ request, locals }) => {
		const id = Number((await request.formData()).get('id'));
		if (!Number.isInteger(id) || id <= 0) return fail(400, { message: 'Invalid role' });

		const target = await locals.db.query.role.findFirst({
			where: { id },
			columns: { id: true, name: true, default: true },
			with: { users: { columns: { id: true } } }
		});
		if (!target) return fail(404, { message: 'Role not found' });
		if (target.name === 'owner') return fail(403, { message: 'The owner role cannot be deleted' });
		if (target.default) return fail(400, { message: 'The default role cannot be deleted' });
		if (target.users.length > 0) {
			return fail(400, { message: 'Reassign the users with this role before deleting it' });
		}

		await locals.db.delete(role).where(eq(role.id, id));
		return { success: true };
	}
} satisfies Actions;
