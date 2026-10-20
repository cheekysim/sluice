import { createColumnHelper, renderComponent } from '@tanstack/svelte-table';
import type { DataTableFeatures } from '$lib/components/data-table/features.js';
import DataTableActions from './data-table-actions.svelte';
import DataTableBadge from '$lib/components/data-table/badge.svelte';
import SortButton from '$lib/components/data-table/sort-button.svelte';
import DataTableTitleCase from './data-table-title-case.svelte';

export type Role = {
	id: number;
	name: string;
	description: string | null;
	default: boolean;
	users: { id: string }[];
	permissions: ({ id: number; action: string } | null)[];
};

const columnHelper = createColumnHelper<DataTableFeatures, Role>();

export const columns = columnHelper.columns([
	columnHelper.accessor('name', {
		header: ({ column }) => {
			return renderComponent(SortButton, {
				label: 'Name',
				onclick: column.getToggleSortingHandler()
			});
		},
		cell: ({ row }) => {
			return renderComponent(DataTableTitleCase, {
				text: row.original.name
			});
		}
	}),
	columnHelper.accessor('description', {
		header: 'Description'
	}),
	columnHelper.accessor('users', {
		header: 'Assigned To',
		cell: ({ row }) => {
			return renderComponent(DataTableBadge, {
				badge: `${row.original.users.length} user(s)`,
				capitalize: false
			});
		}
	}),
	columnHelper.accessor('permissions', {
		header: 'Permissions',
		cell: ({ row }) => {
			return renderComponent(DataTableBadge, {
				badge: `${row.original.permissions.length} permission(s)`,
				capitalize: false
			});
		}
	}),
	columnHelper.accessor('default', {
		header: 'Default',
		cell: ({ row }) => {
			return renderComponent(DataTableBadge, { badge: row.original.default ? 'Yes' : 'No' });
		}
	}),
	columnHelper.display({
		id: 'actions',
		cell: ({ row }) => {
			return renderComponent(DataTableActions, {
				id: row.original.id.toString(),
				name: row.original.name
			});
		},
		meta: {
			align: 'right'
		}
	})
]);
