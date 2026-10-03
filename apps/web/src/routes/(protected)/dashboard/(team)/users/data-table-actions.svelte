<script lang="ts">
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis';
	import { Button } from '$lib/components/ui/button/index.js';
	import TrashIcon from '@lucide/svelte/icons/trash';
	import ClipboardIcon from '@lucide/svelte/icons/clipboard';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { resolve } from '$app/paths';

	import AlertDeleteUser from '$lib/components/alert-delete-user.svelte';

	let { id }: { id: string } = $props();
	let deleteDialogOpen = $state(false);
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
			<DropdownMenu.Item>
				{#snippet child({ props })}
					<a href={resolve(`/dashboard/users/${id}`)} {...props}>
						<PencilIcon />
						Edit User</a
					>
				{/snippet}
			</DropdownMenu.Item>
			<DropdownMenu.Item onclick={() => navigator.clipboard.writeText(id)}>
				<ClipboardIcon />
				Copy User ID
			</DropdownMenu.Item>
		</DropdownMenu.Group>
		<DropdownMenu.Separator />
		<DropdownMenu.Item variant="destructive" onclick={() => (deleteDialogOpen = true)}>
			<TrashIcon />
			Delete User
		</DropdownMenu.Item>
	</DropdownMenu.Content>
</DropdownMenu.Root>

<AlertDeleteUser bind:open={deleteDialogOpen} />
