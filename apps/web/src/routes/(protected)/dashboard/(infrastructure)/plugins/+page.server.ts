import type { PageServerLoad } from './$types';
import { requirePermission } from '$lib/server/permissions';

export const load: PageServerLoad = async ({ locals }) => {
	await requirePermission(locals, 'plugins.read');
};
