<script lang="ts">
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';

	let { open = $bindable(false), id } = $props();
</script>

<AlertDialog.Root bind:open>
	<AlertDialog.Content size="sm">
		<AlertDialog.Header>
			<AlertDialog.Media
				class="bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive"
			>
				<Trash2Icon />
			</AlertDialog.Media>
			<AlertDialog.Title>Delete Invite?</AlertDialog.Title>
			<AlertDialog.Description>This will permanently delete this invite.</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel variant="outline">Cancel</AlertDialog.Cancel>
			<AlertDialog.Action variant="destructive" onclick={() => console.log('Delete', id)}
				>Delete</AlertDialog.Action
			>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
