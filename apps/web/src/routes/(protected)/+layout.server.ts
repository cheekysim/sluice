import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { listPermissions } from '$lib/server/permissions';

export const load = (async ({ locals }) => {
	if (!locals.session || !locals.user) {
		return redirect(302, '/login');
	}

	return {
		session: { session: locals.session, user: locals.user },
		userPermissions: await listPermissions(locals)
	};
}) satisfies LayoutServerLoad;
