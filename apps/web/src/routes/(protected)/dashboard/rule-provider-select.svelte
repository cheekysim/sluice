<script lang="ts">
	import { enhance } from '$app/forms';
	import { tick } from 'svelte';
	import { toast } from 'svelte-sonner';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import { Button } from '$lib/components/ui/button';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import type { Rule } from './rule-columns';
	import type { RuleProviderType } from '$lib/rule-providers';

	let {
		rule,
		providers,
		active = null
	}: {
		rule: Rule;
		providers: readonly { type: RuleProviderType; name: string }[];
		/** Provider types reported by live agents; null while unknown. */
		active?: ReadonlySet<string> | null;
	} = $props();

	let selectedProviders = $derived([...rule.providers]);
	let isSaving = $state(false);
	let form: HTMLFormElement | undefined = $state();

	const toggleProvider = async (provider: RuleProviderType, checked: boolean | 'indeterminate') => {
		if (checked === 'indeterminate') return;
		selectedProviders = checked
			? [...new Set([...selectedProviders, provider])]
			: selectedProviders.filter((selected) => selected !== provider);
		await tick();
		form?.requestSubmit();
	};
</script>

<form
	bind:this={form}
	method="POST"
	action="?/setRuleProviders"
	use:enhance={() => {
		isSaving = true;
		return async ({ result, update }) => {
			if (result.type === 'failure' && typeof result.data?.message === 'string') {
				toast.error(result.data.message);
				selectedProviders = [...rule.providers];
			}
			try {
				await update();
			} finally {
				isSaving = false;
			}
		};
	}}
>
	<input type="hidden" name="id" value={rule.id} />
	{#each selectedProviders as provider (provider)}
		<input type="hidden" name="provider" value={provider} />
	{/each}
</form>

<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<Button {...props} variant="outline" size="sm" disabled={isSaving}>
				{selectedProviders.length ? `${selectedProviders.length} selected` : 'Select providers'}
				<ChevronDownIcon />
			</Button>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content align="start">
		<DropdownMenu.Label>Apply rule with</DropdownMenu.Label>
		<DropdownMenu.Separator />
		{#each providers as provider (provider.type)}
			<DropdownMenu.CheckboxItem
				checked={selectedProviders.includes(provider.type)}
				disabled={isSaving ||
					(active !== null &&
						!active.has(provider.type) &&
						!selectedProviders.includes(provider.type))}
				onCheckedChange={(checked) => toggleProvider(provider.type, checked)}
			>
				{provider.name}
				{#if active !== null && !active.has(provider.type)}
					<span class="text-xs text-muted-foreground">(no agent)</span>
				{/if}
			</DropdownMenu.CheckboxItem>
		{/each}
	</DropdownMenu.Content>
</DropdownMenu.Root>
