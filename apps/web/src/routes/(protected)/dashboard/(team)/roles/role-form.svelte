<script lang="ts">
	import * as Form from '$lib/components/ui/form/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Switch } from '$lib/components/ui/switch/index.js';
	import { superForm, type SuperValidated, type Infer } from 'sveltekit-superforms';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { roleSchema } from './schema';
	import { titleCase } from '$lib/utils';

	let {
		data,
		permissions,
		submitLabel
	}: {
		data: SuperValidated<Infer<typeof roleSchema>>;
		permissions: { id: number; action: string }[];
		submitLabel: string;
	} = $props();

	// svelte-ignore state_referenced_locally
	const form = superForm(data, {
		validators: zod4Client(roleSchema),
		resetForm: false
	});
	const { form: formData, enhance, message } = form;

	// Actions are "category.name"; group by category and show the name within each section.
	const groups = $derived.by(() => {
		const byCategory: Record<string, { id: number; label: string }[]> = {};
		for (const { id, action } of permissions) {
			const [category, ...rest] = action.split('.');
			const key = rest.length > 0 ? category : 'other';
			const label = rest.length > 0 ? rest.join('.') : action;
			(byCategory[key] ??= []).push({ id, label: titleCase(label) });
		}
		return Object.entries(byCategory)
			.map(([category, items]) => ({ category, label: titleCase(category), items }))
			.sort((a, b) => a.label.localeCompare(b.label));
	});
</script>

<form method="POST" use:enhance>
	<div class="space-y-4 rounded-md border px-4 py-2">
		<div>
			<h2>Role Details</h2>
			<p>Name the role and choose what it is allowed to do</p>
		</div>
		<Form.Field {form} name="name">
			<Form.Control>
				{#snippet children({ props })}
					<Form.Label>Name</Form.Label>
					<Input {...props} bind:value={$formData.name} autocomplete="off" />
				{/snippet}
			</Form.Control>
			<Form.Description>Lowercase letters, numbers, "-" and "_".</Form.Description>
			<Form.FieldErrors />
		</Form.Field>
		<Form.Field {form} name="description">
			<Form.Control>
				{#snippet children({ props })}
					<Form.Label>Description</Form.Label>
					<Input {...props} bind:value={$formData.description} autocomplete="off" />
				{/snippet}
			</Form.Control>
			<Form.FieldErrors />
		</Form.Field>
		<Form.Field {form} name="default">
			<Form.Control>
				{#snippet children({ props })}
					<div class="flex items-center gap-2">
						<Switch {...props} bind:checked={$formData.default} />
						<Form.Label>Default role for new users</Form.Label>
					</div>
				{/snippet}
			</Form.Control>
			<Form.Description>Only one role can be the default.</Form.Description>
			<Form.FieldErrors />
		</Form.Field>

		<fieldset class="space-y-4">
			<legend class="text-sm font-medium">Permissions</legend>
			{#if groups.length === 0}
				<p class="text-sm text-muted-foreground">
					No permissions exist yet. Run the permission seed script to create them.
				</p>
			{:else}
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{#each groups as group (group.category)}
						<div class="space-y-2 rounded-md border p-3">
							<h3 class="text-sm font-semibold">{group.label}</h3>
							{#each group.items as permission (permission.id)}
								<label class="flex items-center gap-2 text-sm">
									<input
										type="checkbox"
										name="permissions"
										value={permission.id}
										class="size-4 accent-primary"
										bind:group={$formData.permissions}
									/>
									{permission.label}
								</label>
							{/each}
						</div>
					{/each}
				</div>
			{/if}
		</fieldset>

		{#if $message}
			<p class="text-sm text-green-700" role="status">{$message}</p>
		{/if}
		<Form.Button>{submitLabel}</Form.Button>
	</div>
</form>
