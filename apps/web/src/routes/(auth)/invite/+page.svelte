<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	import * as Card from '$lib/components/ui/card';
	import { Separator } from '$lib/components/ui/separator';

	import SignUpForm from './sign-up-form.svelte';
</script>

<div class="flex h-dvh items-center justify-center">
	<Card.Root class="m-4 w-full max-w-md">
		<Card.Header class="flex flex-col items-center justify-center">
			<img src="/word_mark_white.webp" alt="Logo" class="mb-4" />
			<Card.Description class="text-md text-base">You've Been Invited To Join</Card.Description>
		</Card.Header>
		<Separator />
		<Card.Content>
			<SignUpForm form={data.form} email={data.email} />
		</Card.Content>
	</Card.Root>
</div>
