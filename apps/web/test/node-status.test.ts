import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mergeAgentStatus } from '../src/routes/(protected)/dashboard/(infrastructure)/nodes/status';

const first = { agentId: 'first', agentName: 'First', agentIP: '192.0.2.1', agentVersion: '1' };
const second = { agentId: 'second', agentName: 'Second', agentIP: '192.0.2.2', agentVersion: '1' };

test('marks known nodes offline and incorporates live and newly discovered nodes', () => {
	const updated = { ...first, agentIP: '192.0.2.3', agentVersion: '2' };
	assert.deepEqual(mergeAgentStatus([first, second], [updated]), [
		{ ...updated, status: 'online' },
		{ ...second, status: 'offline' }
	]);
	assert.deepEqual(mergeAgentStatus([], [first]), [{ ...first, status: 'online' }]);
	assert.deepEqual(mergeAgentStatus([first], []), [{ ...first, status: 'offline' }]);
});
