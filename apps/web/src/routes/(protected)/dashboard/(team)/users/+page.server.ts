import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';

export const load = (async () => {
	const rows = await db.query.user.findMany({ with: { role: true } });
	// Load role name from the role id
	const users = rows.map(({ role, ...u }) => ({ ...u, roleName: role?.name ?? 'Unknown' }));
	return { users };
}) satisfies PageServerLoad;
