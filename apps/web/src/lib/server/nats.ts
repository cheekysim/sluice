import { connect, ErrorCode, NatsError, type NatsConnection } from 'nats';
import { env } from '$env/dynamic/private';

let ncPromise: Promise<NatsConnection> | undefined;

export const getNats = () => {
	ncPromise ??= connect({ servers: env.NATS_URL ?? 'nats://nats:4222' }).catch((error) => {
		ncPromise = undefined;
		throw error;
	});
	return ncPromise;
};

export async function ensureAgentConfigStream(nc: NatsConnection) {
	const jsm = await nc.jetstreamManager();
	const verify = (subjects: string[] | undefined) => {
		if (!subjects?.includes('agent.config.>')) {
			throw new Error('JetStream stream "AGENT_CONFIG" must include "agent.config.>"');
		}
	};
	try {
		verify((await jsm.streams.info('AGENT_CONFIG')).config.subjects);
	} catch (error) {
		if (!(error instanceof NatsError) || error.api_error?.code !== 404) throw error;
		try {
			await jsm.streams.add({ name: 'AGENT_CONFIG', subjects: ['agent.config.>'] });
		} catch (addError) {
			try {
				verify((await jsm.streams.info('AGENT_CONFIG')).config.subjects);
			} catch (verifyError) {
				if (verifyError instanceof NatsError && verifyError.api_error?.code === 404) throw addError;
				throw verifyError;
			}
		}
	}
}

const TASK_RESULT_TTL_MS = 5 * 60 * 1000;
const taskResults = new Map<string, Promise<string>>();

/**
 * Subscribes to a task's completion subject before the task is published, so a
 * fast agent can't finish before anyone is listening (core NATS doesn't replay).
 */
export const trackTask = async (
	taskId: string,
	childTaskIds: string[] = [taskId],
	timeoutMs = TASK_RESULT_TTL_MS
) => {
	const nc = await getNats();
	const decoder = new TextDecoder();
	const subscriptions = childTaskIds.map((id) =>
		nc.subscribe(`task.done.${id}`, { max: 1, timeout: timeoutMs })
	);
	await nc.flush();
	const result = Promise.all(
		subscriptions.map(async (sub) => {
			try {
				for await (const msg of sub) {
					try {
						const value: unknown = JSON.parse(decoder.decode(msg.data));
						if (
							value &&
							typeof value === 'object' &&
							'status' in value &&
							value.status === 'success'
						)
							return 'success';
						return 'failure';
					} catch (error) {
						console.error('Invalid task completion:', error);
						return 'failure';
					}
				}
			} catch (error) {
				if (error instanceof NatsError && error.code === ErrorCode.Timeout) return 'timeout';
				console.error('Failed to receive task completion:', error);
				return 'failure';
			}
			return 'timeout';
		})
	).then((statuses) =>
		JSON.stringify({
			status: statuses.includes('failure')
				? 'failure'
				: statuses.includes('timeout')
					? 'timeout'
					: 'success',
			taskId
		})
	);
	taskResults.set(taskId, result);
	void result.then(() => setTimeout(() => taskResults.delete(taskId), TASK_RESULT_TTL_MS).unref());
};

export const getTaskResult = (taskId: string) => taskResults.get(taskId);
