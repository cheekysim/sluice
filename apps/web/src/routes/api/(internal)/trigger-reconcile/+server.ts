import { NatsError, StringCodec, type NatsConnection } from 'nats';
import { json } from '@sveltejs/kit';
import { planReconcile } from '$lib/server/rule-providers';
import { createHash } from 'node:crypto';
import { getNats, trackTask } from '$lib/server/nats';
import { requirePermission } from '$lib/server/permissions.js';

const sc = StringCodec();

async function ensureTaskStream(jsm: Awaited<ReturnType<NatsConnection['jetstreamManager']>>) {
	try {
		const stream = await jsm.streams.info('AGENT_RECONCILE');
		if (!stream.config.subjects?.includes('agent.reconcile.>')) {
			throw new Error(
				'JetStream stream "AGENT_RECONCILE" must include subject "agent.reconcile.>"'
			);
		}
		return;
	} catch (error) {
		if (!(error instanceof NatsError) || error.api_error?.code !== 404) throw error;
	}

	try {
		await jsm.streams.add({ name: 'AGENT_RECONCILE', subjects: ['agent.reconcile.>'] });
	} catch (addError) {
		try {
			const stream = await jsm.streams.info('AGENT_RECONCILE');
			if (!stream.config.subjects?.includes('agent.reconcile.>')) {
				throw new Error(
					'JetStream stream "AGENT_RECONCILE" must include subject "agent.reconcile.>"',
					{
						cause: addError
					}
				);
			}
		} catch (verifyError) {
			if (verifyError instanceof NatsError && verifyError.api_error?.code === 404) {
				throw addError;
			}
			throw verifyError;
		}
	}
}

export async function POST({ locals }) {
	await requirePermission(locals, 'rules.write');
	console.log('Triggering reconcile task');

	const rules = await locals.db.query.rule.findMany();
	let targets;
	try {
		targets = planReconcile(await locals.db.query.agent.findMany(), rules);
	} catch (error) {
		if (!(error instanceof Error)) throw error;
		return json({ message: error.message }, { status: 409 });
	}
	const nc = await getNats();
	const js = nc.jetstream();
	await ensureTaskStream(await nc.jetstreamManager());
	const taskId = crypto.randomUUID();
	const tasks = targets.map((target) => ({ ...target, taskId: crypto.randomUUID() }));
	await trackTask(
		taskId,
		tasks.map((task) => task.taskId)
	);
	try {
		for (const task of tasks) {
			const token = createHash('sha256').update(task.agentId).digest('hex');
			const payload = sc.encode(
				JSON.stringify({
					taskId: task.taskId,
					action: 'reconcile',
					providers: task.providers,
					rules
				})
			);
			await js.publish(`agent.reconcile.${token}`, payload);
		}
	} catch (error) {
		console.error('Failed to queue deployment:', error);
		return json(
			{
				message:
					'Deployment could not be fully queued. Some nodes may already have received it; retry after resolving the error.'
			},
			{ status: 503 }
		);
	}

	return json({ status: 'queued', message: 'Task added to persistent queue', taskId });
}
