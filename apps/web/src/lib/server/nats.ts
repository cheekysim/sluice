import { connect, type NatsConnection } from 'nats';
import { env } from '$env/dynamic/private';

let ncPromise: Promise<NatsConnection> | undefined;

export const getNats = () => {
	ncPromise ??= connect({ servers: env.NATS_URL ?? 'nats://nats:4222' }).catch((error) => {
		ncPromise = undefined;
		throw error;
	});
	return ncPromise;
};

const TASK_RESULT_TTL_MS = 5 * 60 * 1000;
const taskResults = new Map<string, Promise<string>>();

/**
 * Subscribes to a task's completion subject before the task is published, so a
 * fast agent can't finish before anyone is listening (core NATS doesn't replay).
 */
export const trackTask = async (taskId: string) => {
	const nc = await getNats();
	const sub = nc.subscribe(`task.done.${taskId}`, { max: 1, timeout: TASK_RESULT_TTL_MS });
	const decoder = new TextDecoder();
	const result = (async () => {
		for await (const msg of sub) return decoder.decode(msg.data);
		return JSON.stringify({ status: 'timeout', taskId });
	})();
	taskResults.set(taskId, result);
	void result.then(() => setTimeout(() => taskResults.delete(taskId), TASK_RESULT_TTL_MS));
};

export const getTaskResult = (taskId: string) => taskResults.get(taskId);
