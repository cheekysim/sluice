<script lang="ts">
	import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
	import CircleXIcon from '@lucide/svelte/icons/circle-x';
	import CircleHelpIcon from '@lucide/svelte/icons/circle-help';
	import type { Agent } from './columns';

	let { status }: { status: Agent['status'] } = $props();
</script>

<span class="inline-flex items-center gap-2">
	{#if status === 'online'}
		<CircleCheckIcon class="size-4 text-green-600 dark:text-green-400" aria-hidden="true" />
		Online
	{:else if status === 'offline'}
		<CircleXIcon class="size-4 text-muted-foreground" aria-hidden="true" />
		Offline
	{:else}
		<CircleHelpIcon class="size-4 text-muted-foreground" aria-hidden="true" />
		Unknown
	{/if}
</span>
