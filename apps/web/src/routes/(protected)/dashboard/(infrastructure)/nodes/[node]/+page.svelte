<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const formMessage = $derived(form?.message);
</script>

<div class="space-y-4 p-4">
	<div class="prose dark:prose-invert">
		<h2 class="mb-0">Edit Node</h2>
		<p>Manage configuration for {data.node.agentName}</p>
	</div>

	<form method="POST" action="?/renameNode" use:enhance class="space-y-4 rounded-md border p-4">
		<div>
			<h3 class="font-semibold">Node Details</h3>
			<p class="text-sm text-muted-foreground">
				The ID, IP address and version are reported by the agent.
			</p>
		</div>
		<label for="node-name" class="grid gap-2 text-sm font-medium">
			Name
			<Input
				id="node-name"
				name="name"
				value={form && 'name' in form ? form.name : data.node.agentName}
				maxlength={100}
				required
			/>
		</label>
		{#if form?.message && !('provider' in form)}
			<p role="alert" class="text-sm text-destructive">{form.message}</p>
		{:else if form?.success && !('provider' in form)}
			<p role="status" class="text-sm text-green-700 dark:text-green-400">
				Node saved. The configuration update is queued and will be applied when the agent receives
				it.
			</p>
		{/if}
		<div class="flex gap-2">
			<Button type="submit">Save Changes</Button>
			<Button href={resolve('/dashboard/nodes')} variant="outline">Back to Nodes</Button>
		</div>
	</form>

	<section class="space-y-4">
		<div>
			<h3 class="font-semibold">Providers</h3>
			<p class="text-sm text-muted-foreground">
				Configure and enable providers for this node. Changes are queued until the agent receives
				them.
			</p>
		</div>
		{#if data.schemaNotice}<p role="status" class="text-sm text-muted-foreground">
				{data.schemaNotice}
			</p>{/if}
		{#if data.providerUpdate}
			<p role="status" class="text-sm">
				Last provider update: {data.providerUpdate.status}.
				{#if data.providerUpdate.status === 'failed'}
					{data.providerUpdate.message ?? 'The agent rejected the update.'}{/if}
				Reload the page to refresh its status.
			</p>
		{/if}
		{#each data.providers as provider (provider.type)}
			<form
				method="POST"
				action="?/saveProvider"
				use:enhance
				class="space-y-4 rounded-md border p-4"
			>
				<input type="hidden" name="provider" value={provider.type} />
				<input type="hidden" name="schemaVersion" value={provider.version} />
				<div class="flex items-center justify-between gap-4">
					<h4 class="font-semibold">{provider.name}</h4>
					<label class="flex items-center gap-2 text-sm">
						<input
							type="checkbox"
							name="enabled"
							checked={provider.enabled}
							disabled={!provider.implemented}
						/>
						Enabled
					</label>
				</div>
				{#if !provider.implemented}
					<p class="text-sm text-muted-foreground">
						This provider is not implemented yet and cannot be enabled.
					</p>
				{/if}
				{#each provider.fields as field (field.key)}
					<label class="grid gap-2 text-sm font-medium" for={`${provider.type}-${field.key}`}>
						{field.key}
						{#if field.type === 'boolean'}
							<select
								id={`${provider.type}-${field.key}`}
								name={`config.${field.key}`}
								class="h-9 rounded-md border border-input bg-background px-2"
							>
								<option value="" selected={field.value === ''}>Not set</option>
								<option value="true" selected={field.value === 'true'}>True</option>
								<option value="false" selected={field.value === 'false'}>False</option>
							</select>
						{:else}
							<Input
								id={`${provider.type}-${field.key}`}
								name={`config.${field.key}`}
								type={field.secret ? 'password' : field.type === 'string' ? 'text' : 'number'}
								step={field.type === 'number' ? 'any' : undefined}
								value={field.value}
								placeholder={field.hasValue ? 'Leave blank to keep existing value' : undefined}
								autocomplete={field.secret ? 'new-password' : 'off'}
							/>
						{/if}
						{#if field.description}<span class="text-xs text-muted-foreground"
								>{field.description}</span
							>{/if}
						{#if field.required}<span class="text-xs text-muted-foreground"
								>Required when enabled</span
							>{/if}
					</label>
				{/each}
				{#if form && 'provider' in form && form.provider === provider.type}
					{#if formMessage}
						<p role="alert" class="text-sm text-destructive">{formMessage}</p>
					{:else if form.success}
						<p role="status" class="text-sm text-green-700 dark:text-green-400">
							Provider configuration queued.
						</p>
					{/if}
				{/if}
				<Button type="submit">Save {provider.name}</Button>
			</form>
		{/each}
	</section>
</div>
