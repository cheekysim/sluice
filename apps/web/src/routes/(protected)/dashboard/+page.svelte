<script lang="ts">
	import type { PageProps } from './$types';
	let { data }: PageProps = $props();
	import { toast } from 'svelte-sonner';
	import { onMount } from 'svelte';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import RocketIcon from '@lucide/svelte/icons/rocket';
	import { Button } from '$lib/components/ui/button';
	import DataTable from '$lib/components/data-table/data-table.svelte';
	import RuleDialog from './rule-dialog.svelte';
	import { createRuleColumns, type Rule } from './rule-columns';

	let tasks = $state<Record<string, string>>({});
	let ruleDialogOpen = $state(false);
	let selectedRule = $state<Rule | null>(null);
	let activeProviders = $state<Set<string> | null>(null);
	const columns = $derived(
		createRuleColumns(
			data.ruleProviders,
			data.canWrite,
			data.canWrite
				? (rule) => {
						selectedRule = rule;
						ruleDialogOpen = true;
					}
				: undefined,
			activeProviders
		)
	);

	// Best-effort: stays null (no restriction) when no agent answers
	onMount(async () => {
		try {
			const res = await fetch('/api/agents');
			if (!res.ok) return;
			const { agents } = (await res.json()) as { agents: { providers: { type: string }[] }[] };
			if (agents.length > 0) {
				activeProviders = new Set(agents.flatMap((agent) => agent.providers.map((p) => p.type)));
			}
		} catch {
			// Agent discovery is optional
		}
	});

	async function startTask() {
		const res = await fetch('/api/trigger-reconcile', {
			method: 'POST'
		});
		if (!res.ok) {
			const result = await res.json().catch(() => null);
			toast.error(result?.message ?? 'Failed to queue task.');
			return;
		}
		const { taskId } = await res.json();
		const short = String(taskId).slice(0, 8);

		// One toast per task, keyed by its id
		const toastId = toast.loading(`Task ${short}: processing by agent...`, { id: taskId });
		tasks[taskId] = 'Processing by agent...';

		const sse = new EventSource(`/api/tasks/${taskId}/stream`);

		sse.onmessage = (event) => {
			const data = JSON.parse(event.data);
			tasks[taskId] = `Complete! Result: ${data.status}`;
			toast.success(`Task ${short} complete: ${data.status}`, { id: toastId });
			sse.close();
		};

		sse.onerror = () => {
			tasks[taskId] = 'Error listening for completion.';
			toast.error(`Task ${short}: error listening for completion.`, { id: toastId });
			sse.close();
		};
	}
</script>

<div class="space-y-6 p-4">
	<div class="prose dark:prose-invert">
		<h2 class="mb-0">Rules</h2>
		<p>Manage the proxy rules deployed by Sluice</p>
	</div>

	<DataTable
		data={data.rules}
		{columns}
		refreshKey="app:rules"
		filterColumn="host"
		filterPlaceholder="Filter rules..."
	>
		{#snippet actions()}
			<Button variant="outline" onclick={startTask}
				><RocketIcon class="h-4 w-4" />Deploy Changes</Button
			>
			{#if data.canWrite}
				<Button
					onclick={() => {
						selectedRule = null;
						ruleDialogOpen = true;
					}}><PlusIcon class="h-4 w-4" />Create Rule</Button
				>
			{/if}
		{/snippet}
	</DataTable>
</div>

{#if data.canWrite}
	<RuleDialog
		bind:open={ruleDialogOpen}
		rule={selectedRule}
		providers={data.ruleProviders}
		active={activeProviders}
	/>
{/if}
