<script lang="ts">
	import type { PageProps } from './$types';
	import DataTable from '$lib/components/data-table/data-table.svelte';
	import { columns } from './columns';

	let { data }: PageProps = $props();
</script>

<div class="space-y-4 p-4">
	<div class="prose dark:prose-invert">
		<h2 class="mb-0">Manage Roles</h2>
		<p>Setup and manage roles within the application</p>
	</div>
	<DataTable
		data={data.roles}
		{columns}
		refreshKey="app:roles"
		filterColumn="name"
		filterPlaceholder="Filter Roles..."
		createHref="/dashboard/roles/create"
		createLabel="Create Role"
	/>
</div>
