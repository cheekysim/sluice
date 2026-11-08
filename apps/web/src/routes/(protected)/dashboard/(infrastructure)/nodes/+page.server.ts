import type { PageServerLoad } from './$types';
import { hasPermission, requirePermission } from '$lib/server/permissions';

export const load: PageServerLoad = async ({ locals }) => {
	await requirePermission(locals, 'nodes.read');
	const nodes = await locals.db.query.agent.findMany({
		columns: { agentId: true, agentName: true, agentIP: true, agentVersion: true }
	});
	return { nodes, canWrite: await hasPermission(locals, 'nodes.write') };
};
