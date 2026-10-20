<script lang="ts">
	import type { PageProps } from './$types';
	import * as Form from '$lib/components/ui/form/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { titleCase } from '$lib/utils';
	import { superForm } from 'sveltekit-superforms';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { formSchema, passwordSchema } from './schema';

	let { data }: PageProps = $props();
	// svelte-ignore state_referenced_locally
	const form = superForm(data.form, {
		validators: zod4Client(formSchema),
		resetForm: false
	});
	const { form: formData, enhance, message } = form;

	// svelte-ignore state_referenced_locally
	const pwForm = superForm(data.passwordForm, {
		validators: zod4Client(passwordSchema),
		resetForm: true
	});
	const { form: pwData, enhance: pwEnhance, message: pwMessage } = pwForm;

	const roles = $derived(
		data.roles.map((role) => ({
			value: role.id.toString(),
			label: titleCase(role.name)
		}))
	);

	const getRoleLabel = (value: string) =>
		roles.find((role) => role.value === value)?.label ?? 'Select a role';
</script>

<div class="space-y-4 p-4">
	<div class="prose dark:prose-invert">
		<h2 class="mb-0">Edit User</h2>
		<p>Update the details and role for {data.user.name}</p>
	</div>

	<form method="POST" use:enhance>
		<div class="space-y-4 rounded-md border px-4 py-2">
			<div>
				<h2>User Information</h2>
				<p>Update the account details below</p>
			</div>
			<Form.Field {form} name="name">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label>Name</Form.Label>
						<Input {...props} bind:value={$formData.name} autocomplete="name" />
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>
			<Form.Field {form} name="email">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label>Email</Form.Label>
						<Input {...props} bind:value={$formData.email} type="email" autocomplete="email" />
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
								<Select.Value>{getRoleLabel($formData.role)}</Select.Value>
							</Select.Trigger>
							<Select.Content>
								<Select.Group>
									{#each roles as role (role.value)}
										<Select.Item value={role.value}>{role.label}</Select.Item>
									{/each}
								</Select.Group>
							</Select.Content>
						</Select.Root>
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>
			{#if $message}
				<p class="text-sm text-green-700" role="status">{$message}</p>
			{/if}
			<Form.Button>Save Changes</Form.Button>
		</div>
	</form>

	<form method="POST" action="?/setPassword" use:pwEnhance>
		<div class="space-y-4 rounded-md border px-4 py-2">
			<div>
				<h2>Set Password</h2>
				<p>Manually set a new password. The user will be signed out of all sessions.</p>
			</div>
			<Form.Field form={pwForm} name="password">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label>New password</Form.Label>
						<Input
							{...props}
							bind:value={$pwData.password}
							type="password"
							autocomplete="new-password"
						/>
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>
			<Form.Field form={pwForm} name="confirmPassword">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label>Confirm password</Form.Label>
						<Input
							{...props}
							bind:value={$pwData.confirmPassword}
							type="password"
							autocomplete="new-password"
						/>
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>
			{#if $pwMessage}
				<p class="text-sm text-green-700" role="status">{$pwMessage}</p>
			{/if}
			<Form.Button>Set Password</Form.Button>
		</div>
	</form>
</div>
