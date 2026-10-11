import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const load = (async () => {
	const rows = await db.query.user.findMany({ with: { role: true } });
	// Load role name from the role id
	const users = rows.map(({ role, ...u }) => ({ ...u, roleName: role?.name ?? 'Unknown' }));
	return { users };
}) satisfies PageServerLoad;

export const actions = {
	deleteUser: async ({ request }) => {
		const data = await request.formData();
		const id = data.get('id');
		if (typeof id !== 'string') return { success: false };

		await db.delete(user).where(eq(user.id, id));

		return { success: true };
	}
} satisfies Actions;
