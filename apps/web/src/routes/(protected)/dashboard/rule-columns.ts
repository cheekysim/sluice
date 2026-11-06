import { createColumnHelper, renderComponent } from '@tanstack/svelte-table';
import type { DataTableFeatures } from '$lib/components/data-table/features.js';
import SortButton from '$lib/components/data-table/sort-button.svelte';
import RuleDataTableActions from './rule-data-table-actions.svelte';
import RuleProviderSelect from './rule-provider-select.svelte';
import type { RuleProviderType } from '$lib/rule-providers';

export type Rule = {
	id: number;
	host: string;
	port: number;
	protocol: ('TCP' | 'UDP')[];
	providers: RuleProviderType[];
};

const columnHelper = createColumnHelper<DataTableFeatures, Rule>();

export const createRuleColumns = (
	providers: readonly { type: RuleProviderType; name: string }[],
	canWrite: boolean,
	onEdit?: (rule: Rule) => void,
	active: ReadonlySet<string> | null = null
) =>
	columnHelper.columns([
		columnHelper.accessor('host', {
			header: ({ column }) =>
				renderComponent(SortButton, {
					label: 'Host',
					onclick: column.getToggleSortingHandler()
				})
		}),
		columnHelper.accessor('port', {
			header: ({ column }) =>
				renderComponent(SortButton, {
					label: 'Port',
					onclick: column.getToggleSortingHandler()
				})
		}),
		columnHelper.accessor('protocol', {
			header: 'Protocols',
			cell: ({ row }) => row.original.protocol.join(', ')
		}),
		columnHelper.accessor('providers', {
			header: 'Providers',
			cell: ({ row }) =>
				canWrite
					? renderComponent(RuleProviderSelect, {
							rule: row.original,
							providers,
							active
						})
					: row.original.providers
							.map((type) => providers.find((provider) => provider.type === type)?.name ?? type)
							.join(', ') || 'None'
		}),
		...(onEdit
			? [
					columnHelper.display({
						id: 'actions',
						cell: ({ row }) =>
							renderComponent(RuleDataTableActions, {
								rule: row.original,
								onEdit
							}),
						meta: { align: 'right' as const }
					})
				]
			: [])
	]);
