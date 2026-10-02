import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';

export const load = (async () => {
	const users = await db.query.user.findMany();
	return { users };
}) satisfies PageServerLoad;
