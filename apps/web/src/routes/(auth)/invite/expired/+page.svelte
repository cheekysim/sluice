<script lang="ts">
	import { resolve } from '$app/paths';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
</script>

<div class="flex h-dvh items-center justify-center">
	<Card.Root class="m-4 w-full max-w-md">
		<Card.Header class="flex flex-col items-center justify-center">
			<img src="/word_mark_white.png" alt="Logo" class="mb-4" />
			<Card.Title>This invite is expired!</Card.Title>
			<Card.Description class="text-md text-base"
				>Please contact your administrator to issue a new one</Card.Description
			>
		</Card.Header>
		<Card.Content>
			<div class="flex flex-col items-center justify-center gap-4">
				<p>Alternatively, please log in via the button below</p>
				<Button href={resolve('/login')} class="btn btn-primary">Go to Login</Button>
			</div>
		</Card.Content>
	</Card.Root>
</div>
