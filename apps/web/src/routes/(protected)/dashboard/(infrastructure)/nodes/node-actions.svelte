<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import { resolve } from '$app/paths';
	import type { Agent } from './columns';

	let { agent }: { agent: Agent } = $props();
</script>

<Button
	variant="ghost"
	size="icon"
	aria-label={`Edit node ${agent.agentName}`}
	href={resolve('/(protected)/dashboard/(infrastructure)/nodes/[node]', { node: agent.agentId })}
>
	<PencilIcon />
</Button>
