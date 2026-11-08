<script lang="ts">
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Label } from '$lib/components/ui/label';

	type Rule = {
		id: number;
		host: string;
		port: number;
		protocol: ('TCP' | 'UDP')[];
		providers: string[];
	};

	let {
		open = $bindable(false),
		rule,
		providers
	}: {
		open?: boolean;
		rule: Rule | null;
		providers: readonly { type: string; name: string; available: boolean }[];
	} = $props();

	let host = $state('');
	let port = $state<number | undefined>(undefined);
	let protocols = $state<('TCP' | 'UDP')[]>([]);
	let selectedProviders = $state<string[]>([]);

	const toggle = <T,>(list: T[], item: T, checked: boolean) =>
		checked ? [...new Set([...list, item])] : list.filter((entry) => entry !== item);

	$effect(() => {
		if (!open) return;
		host = rule?.host ?? '';
		port = rule?.port;
		protocols = rule ? [...rule.protocol] : ['TCP'];
		selectedProviders = rule
			? [...rule.providers]
			: providers.filter((p) => p.available).map((p) => p.type);
	});
</script>

<Dialog.Root bind:open>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>{rule ? 'Edit Rule' : 'Create Rule'}</Dialog.Title>
			<Dialog.Description>Set the host, port, and protocols for this proxy rule.</Dialog.Description
			>
		</Dialog.Header>
		<form
			method="POST"
			action="?/saveRule"
			use:enhance={() =>
				async ({ result, update }) => {
					if (result.type === 'success') {
						open = false;
					} else if (result.type === 'failure' && typeof result.data?.message === 'string') {
						toast.error(result.data.message);
					}
					await update();
				}}
		>
			{#if rule}
				<input type="hidden" name="id" value={rule.id} />
			{/if}
			<div class="space-y-4">
				<label class="grid gap-2 text-sm font-medium" for="rule-host">
					Host
					<input
						id="rule-host"
						name="host"
						bind:value={host}
						maxlength="253"
						required
						class="h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-2.5 py-1 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
					/>
				</label>
				<label class="grid gap-2 text-sm font-medium" for="rule-port">
					Port
					<input
						id="rule-port"
						name="port"
						type="number"
						bind:value={port}
						min="1"
						max="65535"
						required
						class="h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-2.5 py-1 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
					/>
				</label>
				<fieldset class="space-y-2">
					<legend class="text-sm font-medium">Protocols</legend>
					<div class="flex gap-4">
						<Label class="flex items-center gap-2 text-sm font-normal">
							<Checkbox
								name="protocol"
								value="TCP"
								checked={protocols.includes('TCP')}
								onCheckedChange={(checked) => (protocols = toggle(protocols, 'TCP', checked))}
							/>
							TCP
						</Label>
						<Label class="flex items-center gap-2 text-sm font-normal">
							<Checkbox
								name="protocol"
								value="UDP"
								checked={protocols.includes('UDP')}
								onCheckedChange={(checked) => (protocols = toggle(protocols, 'UDP', checked))}
							/>
							UDP
						</Label>
					</div>
				</fieldset>
				<fieldset class="space-y-2">
					<legend class="text-sm font-medium">Providers</legend>
					<div class="flex flex-wrap gap-4">
						{#each providers as provider (provider.type)}
							<Label class="flex items-center gap-2 text-sm font-normal">
								<Checkbox
									name="provider"
									value={provider.type}
									disabled={!provider.available && !selectedProviders.includes(provider.type)}
									checked={selectedProviders.includes(provider.type)}
									onCheckedChange={(checked) =>
										(selectedProviders = toggle(selectedProviders, provider.type, checked))}
								/>
								{provider.name}
								{#if !provider.available}<span class="text-xs text-muted-foreground"
										>(not configured)</span
									>{/if}
							</Label>
						{/each}
					</div>
				</fieldset>
				<Dialog.Footer>
					<Button type="button" variant="outline" onclick={() => (open = false)}>Cancel</Button>
					<Button type="submit">{rule ? 'Save Rule' : 'Create Rule'}</Button>
				</Dialog.Footer>
			</div>
		</form>
	</Dialog.Content>
</Dialog.Root>
