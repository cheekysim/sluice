<script lang="ts">
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis';
	import { Button } from '$lib/components/ui/button/index.js';
	import TrashIcon from '@lucide/svelte/icons/trash';
	import ClipboardIcon from '@lucide/svelte/icons/clipboard';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { resolve } from '$app/paths';

	import AlertDelete from '$lib/components/alert-delete.svelte';

	let { id, name }: { id: string; name: string } = $props();
	let deleteDialogOpen = $state(false);
	const isOwner = $derived(name === 'owner');
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<Button {...props} variant="ghost" size="icon" class="relative size-8 p-0">
				<span class="sr-only">Open menu</span>
				<EllipsisIcon />
			</Button>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content class="mr-4 w-fit">
		<DropdownMenu.Group>
			<DropdownMenu.Label>Actions</DropdownMenu.Label>
			<DropdownMenu.Item disabled={isOwner}>
				{#snippet child({ props })}
					<a href={resolve(`/dashboard/roles/${id}`)} {...props}>
						<PencilIcon />
						Edit Role</a
					>
				{/snippet}
			</DropdownMenu.Item>
			<DropdownMenu.Item onclick={() => navigator.clipboard.writeText(id)}>
				<ClipboardIcon />
				Copy Role ID
			</DropdownMenu.Item>
		</DropdownMenu.Group>
		<DropdownMenu.Separator />
		<DropdownMenu.Item
			variant="destructive"
			disabled={isOwner}
			onclick={() => (deleteDialogOpen = true)}
		>
			<TrashIcon />
			Delete Role
		</DropdownMenu.Item>
	</DropdownMenu.Content>
</DropdownMenu.Root>

<AlertDelete bind:open={deleteDialogOpen} {id} title="Delete Role?" action="?/deleteRole">
	This will permanently delete the {name} role. Roles that are the default or still assigned to users
	cannot be deleted.
</AlertDelete>
