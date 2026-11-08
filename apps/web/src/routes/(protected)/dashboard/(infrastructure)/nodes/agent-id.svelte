<script lang="ts">
	import * as Tooltip from '$lib/components/ui/tooltip';

	let { id }: { id: string } = $props();
</script>

<Tooltip.Root>
	<Tooltip.Trigger class="cursor-help">{id.split('-')[0]}</Tooltip.Trigger>
	<Tooltip.Content>{id}</Tooltip.Content>
</Tooltip.Root>
