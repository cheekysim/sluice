import { NatsError, StringCodec, type NatsConnection } from 'nats';
import { json } from '@sveltejs/kit';
import { RULE_PROVIDERS } from '$lib/rule-providers';
import { getNats } from '$lib/server/nats';
// import { requirePermission } from '$lib/server/permissions.js';

const sc = StringCodec();

async function ensureTaskStream(jsm: Awaited<ReturnType<NatsConnection['jetstreamManager']>>) {
	try {
		const stream = await jsm.streams.info('TASKS');
		if (!stream.config.subjects?.includes('agent.task.>')) {
			throw new Error('JetStream stream "TASKS" must include subject "agent.task.>"');
		}
		return;
	} catch (error) {
		if (!(error instanceof NatsError) || error.api_error?.code !== 404) throw error;
	}

	try {
		await jsm.streams.add({ name: 'TASKS', subjects: ['agent.task.>'] });
	} catch (addError) {
		try {
			const stream = await jsm.streams.info('TASKS');
			if (!stream.config.subjects?.includes('agent.task.>')) {
				throw new Error('JetStream stream "TASKS" must include subject "agent.task.>"');
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
	// TODO: await requirePermission(locals, 'PERMISSION');
	console.log('Triggering reconcile task');

	const nc = await getNats();
	const js = nc.jetstream();
	await ensureTaskStream(await nc.jetstreamManager());
	const taskId = crypto.randomUUID();

	// Construct the payload for the reconcile task
	const rules = await locals.db.query.rule.findMany();
	const providers = {
		proxy: Object.fromEntries(
			RULE_PROVIDERS.map(({ type }) => [
				type,
				rules.filter((rule) => rule.providers.includes(type)).map((rule) => rule.id)
			])
		)
	};
	const payload = sc.encode(JSON.stringify({ taskId, action: 'reconcile', providers, rules }));

	// Publish asynchronously to JetStream instead of waiting for a reply
	await js.publish('agent.task.reconcile', payload);

	return json({ status: 'queued', message: 'Task added to persistent queue', taskId });
}
