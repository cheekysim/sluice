import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// Redirects users based on their authentication status.
export const load = (async ({ locals }) => {
	if (!locals.session || !locals.user) {
		return redirect(302, '/login');
	} else {
		return redirect(302, '/dashboard');
	}
}) satisfies PageServerLoad;
