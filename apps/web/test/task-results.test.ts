import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import { StringCodec } from 'nats';
import { createServer } from 'vite';

const server = await createServer({
	configFile: false,
	server: { middlewareMode: true, hmr: false, ws: false },
	appType: 'custom',
	plugins: [
		{
			name: 'test-env',
			resolveId(id) {
				if (id === '$env/dynamic/private') return '\0test-env';
			},
			load(id) {
				if (id === '\0test-env')
					return `export const env = { NATS_URL: ${JSON.stringify(process.env.NATS_TEST_URL)} };`;
			}
		}
	]
});
after(() => server.close());

test(
	'aggregates fast node completions and reports failures',
	{ skip: !process.env.NATS_TEST_URL },
	async () => {
		const { getNats, trackTask, getTaskResult } =
			await server.ssrLoadModule('/src/lib/server/nats.ts');
		const nc = await getNats();
		try {
			const taskId = randomUUID();
			const children = [randomUUID(), randomUUID()];
			await trackTask(taskId, children);
			nc.publish(
				`task.done.${children[0]}`,
				StringCodec().encode(JSON.stringify({ status: 'success' }))
			);
			nc.publish(
				`task.done.${children[1]}`,
				StringCodec().encode(JSON.stringify({ status: 'failure' }))
			);
			await nc.flush();
			assert.deepEqual(JSON.parse(await getTaskResult(taskId)), { status: 'failure', taskId });
			const successId = randomUUID();
			const successChild = randomUUID();
			await trackTask(successId, [successChild]);
			nc.publish(
				`task.done.${successChild}`,
				StringCodec().encode(JSON.stringify({ status: 'success' }))
			);
			await nc.flush();
			assert.equal(JSON.parse(await getTaskResult(successId)).status, 'success');
			const timeoutId = randomUUID();
			await trackTask(timeoutId, [randomUUID()], 50);
			assert.equal(JSON.parse(await getTaskResult(timeoutId)).status, 'timeout');
		} finally {
			await nc.close();
		}
	}
);
