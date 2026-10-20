<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import ArrowUpDownIcon from '@lucide/svelte/icons/arrow-up-down';
	import { Button } from '$lib/components/ui/button';

	let {
		label,
		variant = 'ghost',
		...restProps
	}: { label: string } & ComponentProps<typeof Button> = $props();
</script>

<div class="flex flex-row items-center gap-2">
	{label}
	<Button {variant} {...restProps}>
		<ArrowUpDownIcon class="size-4" />
	</Button>
</div>
