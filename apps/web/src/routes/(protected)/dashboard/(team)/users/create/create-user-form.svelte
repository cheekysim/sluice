<script lang="ts">
	import * as Form from '$lib/components/ui/form/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { formSchema, type FormSchema } from './schema';
	import { type SuperValidated, type Infer, superForm } from 'sveltekit-superforms';
	import { zod4Client } from 'sveltekit-superforms/adapters';

	import InviteDialog from './invite-dialog.svelte';

	let { form: initialForm }: { form: SuperValidated<Infer<FormSchema>> } = $props();

	// svelte-ignore state_referenced_locally
	const form = superForm(initialForm, {
		validators: zod4Client(formSchema)
	});

	const { form: formData, enhance, message } = form;

	let inviteDialogOpen = $state(false);
	let inviteToken = $state('');
	let inviteEmail = $state('');
	let inviteValidFor = $state('');

	message.subscribe((msg) => {
		if (msg) {
			const { token, email, inviteValidFor: expiration } = JSON.parse(msg);
			inviteToken = token;
			inviteEmail = email;
			inviteValidFor = expiration;
			inviteDialogOpen = true;
		}
	});

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

	// TODO: Replace with DB call
	const roles = [
		{ value: 'admin', label: 'Admin' },
		{ value: 'user', label: 'User' }
	];

	const getRoleLabel = (value: string) => {
		const item = roles.find((item) => item.value === value);
		return item ? item.label : '';
	};
</script>

<form method="POST" use:enhance>
	<div class="space-y-4 rounded-md border px-4 py-2">
		<div>
			<h2>User Information</h2>
			<p>Enter the general details for the new user</p>
		</div>
		<Form.Field {form} name="email">
			<Form.Control>
				{#snippet children({ props })}
					<Form.Label>Email</Form.Label>
					<Input {...props} bind:value={$formData.email} placeholder="user@example.com" />
				{/snippet}
			</Form.Control>
			<Form.FieldErrors />
		</Form.Field>
		<Form.Field {form} name="inviteValidFor">
			<Form.Control>
				{#snippet children({ props })}
					<Form.Label>Invite Valid For</Form.Label>
					<Select.Root
						type="single"
						name="inviteValidFor"
						items={inviteTimes}
						bind:value={$formData.inviteValidFor}
					>
						<Select.Trigger class="w-full max-w-48" {...props}>
							<Select.Value>
								{getInviteTimeLabel($formData.inviteValidFor) ?? 'Select a duration'}
							</Select.Value>
						</Select.Trigger>
						<Select.Content>
							<Select.Group>
								{#each inviteTimes as item (item.value)}
									<Select.Item value={item.value}>{item.label}</Select.Item>
								{/each}
							</Select.Group>
						</Select.Content>
					</Select.Root>
				{/snippet}
			</Form.Control>
			<Form.FieldErrors />
		</Form.Field>
		<Form.Field {form} name="role">
			<Form.Control>
				{#snippet children({ props })}
					<Form.Label>Role</Form.Label>
					<Select.Root type="single" name="role" items={roles} bind:value={$formData.role}>
						<Select.Trigger class="w-full max-w-48" {...props}>
							<Select.Value>
								{getRoleLabel($formData.role) ?? 'Select a role'}
							</Select.Value>
						</Select.Trigger>
						<Select.Content>
							<Select.Group>
								{#each roles as item (item.value)}
									<Select.Item value={item.value}>{item.label}</Select.Item>
								{/each}
							</Select.Group>
						</Select.Content>
					</Select.Root>
				{/snippet}
			</Form.Control>
			<Form.FieldErrors />
		</Form.Field>
		<Form.Button>Submit</Form.Button>
	</div>
</form>
<InviteDialog
	bind:open={inviteDialogOpen}
	token={inviteToken}
	email={inviteEmail}
	{inviteValidFor}
/>
