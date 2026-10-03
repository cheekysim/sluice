import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';

export const load = (async ({ params }) => {
	const { user } = params;

	const userData = await db.query.user.findFirst({
		where: {
			id: user
		}
	});
	return { user: userData };
}) satisfies PageServerLoad;
