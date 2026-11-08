<script lang="ts">
	import { onMount } from 'svelte';
	import type { PageProps } from './$types';
	import DataTable from '$lib/components/data-table/data-table.svelte';
	import { createColumns, type Agent, type AgentDetails } from './columns';
	import { mergeAgentStatus } from './status';

	let { data }: PageProps = $props();

	// svelte-ignore state_referenced_locally
	let agents = $state<Agent[]>(data.nodes.map((node) => ({ ...node, status: 'unknown' })));
	let loading = $state(true);
	let errorMessage = $state<string | null>(null);
	const columns = $derived(createColumns(data.canWrite));

	async function loadAgents() {
		loading = true;
		errorMessage = null;
		try {
			const res = await fetch('/api/agents');
			if (!res.ok) {
				throw new Error(`Agent request failed with status ${res.status}`);
			}
			const result: unknown = await res.json();
			const values =
				result && typeof result === 'object' && 'agents' in result ? result.agents : result;
			if (
				!Array.isArray(values) ||
				!values.every(
					(agent): agent is AgentDetails =>
						agent !== null &&
						typeof agent === 'object' &&
						typeof agent.agentId === 'string' &&
						typeof agent.agentVersion === 'string' &&
						typeof agent.agentName === 'string' &&
						typeof agent.agentIP === 'string'
				)
			) {
				throw new Error('Invalid agent response');
			}
			agents = mergeAgentStatus(agents, values);
		} catch (err) {
			console.error('Failed to fetch agents:', err);
			agents = agents.map((agent) => ({ ...agent, status: 'unknown' }));
			errorMessage = 'Failed to load nodes. Try refreshing.';
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		void loadAgents();
	});
</script>

<div class="space-y-4 p-4">
	<div class="prose dark:prose-invert">
		<h2 class="mb-0">Nodes</h2>
		<p class="mb-0">Manage the proxy hosts running the agent</p>
	</div>
	{#if errorMessage}
		<p role="alert" class="text-sm text-destructive">{errorMessage}</p>
	{/if}
	<DataTable
		data={agents}
		{columns}
		onRefresh={loadAgents}
		{loading}
		filterColumn="agentName"
		filterPlaceholder="Filter nodes..."
	/>
</div>
