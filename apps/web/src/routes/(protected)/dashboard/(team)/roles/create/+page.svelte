<script lang="ts">
	import type { PageProps } from './$types';
	import RoleForm from '../role-form.svelte';

	let { data }: PageProps = $props();
</script>

<div class="space-y-4 p-4">
	<div class="prose dark:prose-invert">
		<h2 class="mb-0">Create Role</h2>
		<p>Define a new role and the permissions it grants</p>
	</div>
	<RoleForm data={data.form} permissions={data.permissions} submitLabel="Create Role" />
</div>
