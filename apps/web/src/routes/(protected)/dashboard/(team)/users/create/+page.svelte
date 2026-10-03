<script lang="ts">
	import type { PageProps } from './$types';
	import CreateUserForm from './create-user-form.svelte';

	let { data }: PageProps = $props();
</script>

<div class="space-y-4 p-4">
	<div class="prose dark:prose-invert">
		<h2 class="mb-0">Create User</h2>
		<p>Follow the steps below to create a new user</p>
	</div>
	<CreateUserForm form={data.form} />
</div>
