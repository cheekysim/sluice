<script lang="ts" generics="TData extends RowData">
	import { cn } from '$lib/utils';
	import { type ColumnDef, type RowData, createTable, FlexRender } from '@tanstack/svelte-table';
	import * as Table from '$lib/components/ui/table';
	import { features, type DataTableFeatures } from './data-table-features.js';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import RefreshIcon from '@lucide/svelte/icons/refresh-cw';
	import PlusIcon from '@lucide/svelte/icons/plus';

	type DataTableProps<TData extends RowData> = {
		columns: ColumnDef<DataTableFeatures, TData>[];
		data: TData[];
	};

	let { data, columns }: DataTableProps<TData> = $props();

	const table = createTable({
		features,
		get data() {
			return data;
		},
		get columns() {
			return columns;
		},
		initialState: {
			pagination: {
				pageIndex: 0,
				pageSize: 10
			}
		}
	});

	const pagination = $derived(table.atoms.pagination.get());

	let pageSizeOpen = $state(false);

	let isRefreshing = $state(false);

	const refreshData = () => {
		// Start icon animation
		isRefreshing = true;

		// Implement your data refresh logic here
		console.log('Refreshing data...');

		// Stop icon animation after data is refreshed
		setTimeout(() => {
			isRefreshing = false;
		}, 1000); // Adjust the timeout as needed
	};
</script>

<div>
	<div class="flex items-center justify-between gap-4 py-4">
		<div class="flex items-center">
			<Input
				placeholder="Filter Users..."
				value={(table.getColumn('name')?.getFilterValue() as string) ?? ''}
				onchange={(e) => {
					table.getColumn('name')?.setFilterValue(e.currentTarget.value);
				}}
				oninput={(e) => {
					table.getColumn('name')?.setFilterValue(e.currentTarget.value);
				}}
				class="max-w-sm"
			/>
		</div>
		<div class="flex flex-row items-center gap-2">
			<Button variant="secondary" onclick={refreshData}
				><RefreshIcon class="h-4 w-4 {isRefreshing ? 'animate-spin' : ''}" /></Button
			>
			<Button href="/dashboard/users/create"><PlusIcon class="h-4 w-4" />Create User</Button>
		</div>
	</div>
	<div class="rounded-md border px-4 py-2">
		<Table.Root>
			<Table.Header>
				{#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
					<Table.Row>
						{#each headerGroup.headers as header (header.id)}
							<Table.Head colspan={header.colSpan}>
								{#if !header.isPlaceholder}
									<FlexRender {header} />
								{/if}
							</Table.Head>
						{/each}
					</Table.Row>
				{/each}
			</Table.Header>
			<Table.Body>
				{#each table.getRowModel().rows as row (row.id)}
					<Table.Row data-state={row.getIsSelected() && 'selected'}>
						{#each row.getVisibleCells() as cell (cell.id)}
							<Table.Cell align={cell.column.columnDef.meta?.align ?? 'left'}>
								<FlexRender {cell} />
							</Table.Cell>
						{/each}
					</Table.Row>
				{:else}
					<Table.Row>
						<Table.Cell colspan={columns.length} class="h-24 text-center">No results</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
		<div class="flex items-center justify-between py-4">
			<div>
				<DropdownMenu.Root bind:open={pageSizeOpen}>
					<DropdownMenu.Trigger>
						{#snippet child({ props })}
							<Button {...props} variant="outline" class="relative h-8">
								<span>{pagination.pageSize}</span>
								<ChevronDownIcon
									data-icon="inline-end"
									class={cn(pageSizeOpen ? 'rotate-180' : '', 'transition-transform')}
								/>
							</Button>
						{/snippet}
					</DropdownMenu.Trigger>
					<DropdownMenu.Content>
						<DropdownMenu.Item onclick={() => table.setPageSize(10)}>10</DropdownMenu.Item>
						<DropdownMenu.Item onclick={() => table.setPageSize(20)}>20</DropdownMenu.Item>
						<DropdownMenu.Item onclick={() => table.setPageSize(50)}>50</DropdownMenu.Item>
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			</div>

			<div class="flex items-center space-x-2">
				<p class="px-2 text-sm text-muted-foreground">
					Page {pagination.pageIndex + 1} of {table.getPageCount()}
				</p>
				<Button
					variant="outline"
					size="sm"
					onclick={() => table.previousPage()}
					disabled={!table.getCanPreviousPage()}
				>
					Previous
				</Button>
				<Button
					variant="outline"
					size="sm"
					onclick={() => table.nextPage()}
					disabled={!table.getCanNextPage()}
				>
					Next
				</Button>
			</div>
		</div>
	</div>
</div>
