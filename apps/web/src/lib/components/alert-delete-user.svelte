<script lang="ts">
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import { resolve } from '$app/paths';

	let { open = $bindable(false) } = $props();
</script>

<AlertDialog.Root bind:open>
	<AlertDialog.Content size="sm">
		<AlertDialog.Header>
			<AlertDialog.Media
				class="bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive"
			>
				<Trash2Icon />
			</AlertDialog.Media>
			<AlertDialog.Title>Delete User?</AlertDialog.Title>
			<AlertDialog.Description>
				This will permanently delete this user. View <a href={resolve('/dashboard/settings')}
					>Settings</a
				> to manage any related data.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel variant="outline">Cancel</AlertDialog.Cancel>
			<AlertDialog.Action variant="destructive">Delete</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
