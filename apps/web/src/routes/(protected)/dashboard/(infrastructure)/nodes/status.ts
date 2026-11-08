import type { Agent, AgentDetails } from './columns';

export function mergeAgentStatus(known: AgentDetails[], online: AgentDetails[]): Agent[] {
	const byId = new Map<string, Agent>(
		known.map((agent) => [agent.agentId, { ...agent, status: 'offline' }])
	);
	for (const agent of online) {
		byId.set(agent.agentId, { ...agent, status: 'online' });
	}
	return [...byId.values()];
}
