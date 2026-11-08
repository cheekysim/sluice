import { error, json } from '@sveltejs/kit';
import { ErrorCode, NatsError, RequestStrategy, StringCodec } from 'nats';
import { getNats } from '$lib/server/nats';
import { requirePermission } from '$lib/server/permissions';
import type { RequestHandler } from './$types';
import { agent } from '$lib/server/db/schema';
import { sql } from 'drizzle-orm';

const sc = StringCodec();

/** Asks every connected agent for its details. The saved name is the desired configuration. */
export const GET: RequestHandler = async ({ locals }) => {
	await requirePermission(locals, 'nodes.read');

	const agents: { agentId: string; agentName: string; agentIP: string; agentVersion: string }[] =
		[];
	try {
		const nc = await getNats();
		const replies = await nc.requestMany('agent.query', sc.encode(''), {
			strategy: RequestStrategy.Timer,
			maxWait: 1500
		});
		for await (const reply of replies) {
			const value: unknown = JSON.parse(sc.decode(reply.data));
			if (
				!value ||
				typeof value !== 'object' ||
				!('agentId' in value) ||
				typeof value.agentId !== 'string' ||
				!('agentName' in value) ||
				typeof value.agentName !== 'string' ||
				!('agentIP' in value) ||
				typeof value.agentIP !== 'string' ||
				!('agentVersion' in value) ||
				typeof value.agentVersion !== 'string'
			)
				throw new Error('Invalid agent discovery response');
			agents.push({
				agentId: value.agentId,
				agentName: value.agentName,
				agentIP: value.agentIP,
				agentVersion: value.agentVersion
			});
		}
	} catch (err) {
		if (err instanceof NatsError && err.code === ErrorCode.NoResponders) {
			return json({ agents: [] });
		}
		console.error('Failed to query agents:', err);
		error(503, 'Failed to query agents');
	}

	if (agents.length === 0) return json({ agents });

	// Save agents to db
	const savedAgents = await locals.db
		.insert(agent)
		.values(agents)
		.onConflictDoUpdate({
			target: agent.agentId,
			set: {
				agentIP: sql`excluded."agentIP"`,
				agentVersion: sql`excluded."agentVersion"`
			}
		})
		.returning({
			agentId: agent.agentId,
			agentName: agent.agentName,
			agentIP: agent.agentIP,
			agentVersion: agent.agentVersion
		});

	return json({ agents: savedAgents });
};
