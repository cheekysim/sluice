import { json } from '@sveltejs/kit';
import { RequestStrategy, StringCodec } from 'nats';
import { getNats } from '$lib/server/nats';
import { requirePermission } from '$lib/server/permissions';
import type { RequestHandler } from '../$types';

const sc = StringCodec();

/** Asks every connected agent which providers it has registered. */
export const GET: RequestHandler = async ({ locals }) => {
	await requirePermission(locals, 'rules.read');

	const agents: unknown[] = [];
	try {
		const nc = await getNats();
		const replies = await nc.requestMany('agent.query.providers', sc.encode(''), {
			strategy: RequestStrategy.Timer,
			maxWait: 1500
		});
		for await (const reply of replies) {
			try {
				agents.push(JSON.parse(sc.decode(reply.data)));
			} catch {
				// Ignore malformed replies
			}
		}
	} catch {
		// No responders or NATS unavailable: report no agents
		return json({ agents: [] });
	}

	return json({ agents });
};
