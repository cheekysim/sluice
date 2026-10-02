<script lang="ts">
	import type { PageProps } from './$types';
	import DataTable from './data-table.svelte';
	import { columns } from './columns';

	let { data }: PageProps = $props();
</script>

<div class="space-y-4 p-4">
	<div class="prose dark:prose-invert">
		<h2 class="mb-0">Manage Users</h2>
		<p>Setup and manage users within the application</p>
	</div>
	<DataTable data={data.users} {columns} />
</div>
