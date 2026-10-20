<script lang="ts">
	import type { PageProps } from './$types';
	import DataTable from '$lib/components/data-table/data-table.svelte';
	import { columns } from './columns';

	let { data }: PageProps = $props();
</script>

<div class="space-y-4 p-4">
	<div class="prose dark:prose-invert">
		<h2 class="mb-0">Manage Invites</h2>
		<p>Manage User invites within the application</p>
	</div>
	<DataTable
		data={data.invites}
		{columns}
		refreshKey="app:invites"
		filterColumn="email"
		filterPlaceholder="Filter Invites..."
		createHref="/dashboard/users/create"
		createLabel="Invite User"
		toggleFilter={{ columnId: 'accepted', label: 'Show Accepted' }}
	/>
</div>
