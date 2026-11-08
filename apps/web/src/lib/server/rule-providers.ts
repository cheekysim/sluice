import type {
	ProviderAdvertisement,
	ProviderSettings,
	ProviderUpdateStatus
} from './provider-schemas';

export type ProviderNode = {
	agentId: string;
	providers: ProviderSettings;
	providerSchemas: ProviderAdvertisement[] | null;
	providerUpdate?: ProviderUpdateStatus | null;
};

export type AssignedRule = { id: number; providers: string[] };
type DeployRule = AssignedRule & { protocol: ('TCP' | 'UDP')[] };

export function ruleProviderOptions(nodes: ProviderNode[], rules: AssignedRule[]) {
	const options = new Map<string, { type: string; name: string; available: boolean }>();
	for (const node of nodes) {
		for (const provider of node.providerSchemas ?? []) {
			if (
				provider.implemented &&
				!provider.capabilities?.readonly &&
				node.providers[provider.type]?.enabled
			) {
				options.set(provider.type, { type: provider.type, name: provider.name, available: true });
			}
		}
	}
	for (const rule of rules) {
		for (const type of rule.providers) {
			if (!options.has(type)) options.set(type, { type, name: type, available: false });
		}
	}
	return [...options.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function planReconcile(nodes: ProviderNode[], rules: DeployRule[]) {
	const targets = nodes.flatMap((node) => {
		for (const provider of node.providerSchemas ?? []) {
			if (
				!provider.implemented ||
				provider.capabilities?.readonly ||
				!node.providers[provider.type]?.enabled ||
				!provider.capabilities
			)
				continue;
			for (const rule of rules) {
				if (
					rule.providers.includes(provider.type) &&
					rule.protocol.some(
						(protocol) =>
							!provider.capabilities?.transports.some(
								(transport) => transport.toUpperCase() === protocol
							)
					)
				) {
					throw new Error(
						`Node ${node.agentId} provider ${provider.type} does not support all protocols in rule ${rule.id}`
					);
				}
			}
		}
		const providers = Object.fromEntries(
			(node.providerSchemas ?? [])
				.filter(
					(provider) =>
						provider.implemented &&
						!provider.capabilities?.readonly &&
						node.providers[provider.type]?.enabled
				)
				.map((provider) => [
					provider.type,
					rules.filter((rule) => rule.providers.includes(provider.type)).map((rule) => rule.id)
				])
		);
		return Object.keys(providers).length ? [{ agentId: node.agentId, providers }] : [];
	});
	const available = new Set(targets.flatMap((target) => Object.keys(target.providers)));
	const missing = [...new Set(rules.flatMap((rule) => rule.providers))].filter(
		(type) => !available.has(type)
	);
	if (missing.length) throw new Error(`No configured node for provider(s): ${missing.join(', ')}`);
	if (!targets.length) throw new Error('No enabled providers on nodes with advertised schemas');
	for (const node of nodes) {
		if (
			targets.some((target) => target.agentId === node.agentId) &&
			node.providerUpdate &&
			node.providerUpdate.status !== 'applied'
		) {
			throw new Error(
				`Provider configuration for node ${node.agentId} is ${node.providerUpdate.status}; refresh its edit page and resolve the update before deploying`
			);
		}
	}
	return targets;
}
