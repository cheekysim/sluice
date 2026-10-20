<script lang="ts">
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis';
	import { Button } from '$lib/components/ui/button/index.js';
	import TrashIcon from '@lucide/svelte/icons/trash';
	import RefreshIcon from '@lucide/svelte/icons/refresh-cw';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import InviteDialog from '$lib/components/invite-dialog.svelte';

	import AlertDelete from '$lib/components/alert-delete.svelte';
	import { enhance } from '$app/forms';

	let { id }: { id: string } = $props();
	let deleteDialogOpen = $state(false);
	let inviteDialogOpen = $state(false);
	let newInviteData = $state({ token: '', email: '', inviteValidFor: '' });
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
					<form
						action="?/regenInvite"
						method="post"
						use:enhance={() => {
							return async ({ result }) => {
								if (result.type === 'success' && result.data) {
									inviteDialogOpen = true;
									newInviteData.token = result.data.token as string;
									newInviteData.email = result.data.email as string;
									newInviteData.inviteValidFor = result.data.inviteValidFor as string;
								}
							};
						}}
					>
						<input type="hidden" name="id" value={id} />
						<Button {...props} type="submit" variant="ghost">
							<RefreshIcon />
							<span>Regenerate</span>
						</Button>
					</form>
				{/snippet}
				<RefreshIcon />
				Regenerate
			</DropdownMenu.Item>
		</DropdownMenu.Group>
		<DropdownMenu.Separator />
		<DropdownMenu.Item variant="destructive" onclick={() => (deleteDialogOpen = true)}>
			<TrashIcon />
			Delete Invite
		</DropdownMenu.Item>
	</DropdownMenu.Content>
</DropdownMenu.Root>

<AlertDelete bind:open={deleteDialogOpen} {id} title="Delete Invite?" action="?/deleteInvite">
	This will permanently delete this invite.
</AlertDelete>
<InviteDialog
	bind:open={inviteDialogOpen}
	token={newInviteData.token}
	email={newInviteData.email}
	inviteValidFor={newInviteData.inviteValidFor}
/>
