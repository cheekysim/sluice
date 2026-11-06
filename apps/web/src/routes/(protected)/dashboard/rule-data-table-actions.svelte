<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import TrashIcon from '@lucide/svelte/icons/trash';
	import AlertDelete from '$lib/components/alert-delete.svelte';
	import type { Rule } from './rule-columns';

	let { rule, onEdit }: { rule: Rule; onEdit: (rule: Rule) => void } = $props();
	let deleteDialogOpen = $state(false);
</script>

<div class="flex shrink justify-end gap-1">
	<Button
		variant="ghost"
		size="icon"
		aria-label={`Edit rule for ${rule.host}`}
		onclick={() => onEdit(rule)}
	>
		<PencilIcon />
	</Button>
	<Button
		variant="ghost"
		size="icon"
		aria-label={`Delete rule for ${rule.host}`}
		onclick={() => (deleteDialogOpen = true)}
	>
		<TrashIcon class="text-destructive" />
	</Button>
</div>

<AlertDelete
	bind:open={deleteDialogOpen}
	id={String(rule.id)}
	title="Delete Rule?"
	action="?/deleteRule"
>
	This will permanently delete the rule for {rule.host}:{rule.port}.
</AlertDelete>
