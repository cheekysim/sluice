<script lang="ts">
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
	import ClipboardIcon from '@lucide/svelte/icons/clipboard';
	import { toast } from 'svelte-sonner';

	const inviteTimes = [
		{ value: '1_day', label: '1 Day' },
		{ value: '2_day', label: '2 Days' },
		{ value: '3_day', label: '3 Days' },
		{ value: '4_day', label: '4 Days' },
		{ value: '5_day', label: '5 Days' },
		{ value: '6_day', label: '6 Days' },
		{ value: '7_day', label: '7 Days' }
	];

	const getInviteTimeLabel = (value: string) => {
		const item = inviteTimes.find((item) => item.value === value);
		return item ? item.label : '';
	};

	let {
		open = $bindable(false),
		token,
		email,
		inviteValidFor
	}: { open?: boolean; token: string; email: string; inviteValidFor: string } = $props();

	const origin = page.url.origin;
	const inviteLink = $derived(
		`${origin}/invite?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`
	);
</script>

<Dialog.Root bind:open>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>User Invited</Dialog.Title>
			<Dialog.Description
				>The user has been invited. They must access the link below to accept the invitation.
			</Dialog.Description>
		</Dialog.Header>
		<div class="min-w-0 space-y-2">
			<p>This invite will expire in {getInviteTimeLabel(inviteValidFor)}.</p>
			<div class="flex flex-row items-center gap-2 rounded-md border p-2">
				<ScrollArea
					orientation="horizontal"
					class="min-w-0 flex-1 [&_[data-scroll-area-viewport]>div]:block!"
				>
					<div class="whitespace-nowrap">{inviteLink}</div>
				</ScrollArea>
				<Button
					class="shrink-0"
					onclick={() => {
						navigator.clipboard.writeText(inviteLink);
						toast.success('Invite Copied to clipboard');
					}}><ClipboardIcon /></Button
				>
			</div>
		</div>
		<Dialog.Footer>
			<Dialog.Close>Close</Dialog.Close>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
