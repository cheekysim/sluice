<script lang="ts" generics="TData extends RowData">
	import { cn } from '$lib/utils';
	import { type ColumnDef, type RowData, createTable, FlexRender } from '@tanstack/svelte-table';
	import * as Table from '$lib/components/ui/table';
	import { features, type DataTableFeatures } from './data-table-features.js';
	import Button from '$lib/components/ui/button/button.svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';

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
</script>

<div>
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
