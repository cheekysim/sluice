import { createColumnHelper, renderComponent } from '@tanstack/svelte-table';
import type { DataTableFeatures } from '$lib/components/data-table/features.js';
import DataTableActions from './data-table-actions.svelte';
import DataTableBadge from '$lib/components/data-table/badge.svelte';
import SortButton from '$lib/components/data-table/sort-button.svelte';

export type Invite = {
	id: number;
	email: string;
	invited_by: string;
	expires_at: Date;
	role: string;
	accepted: boolean;
};

const columnHelper = createColumnHelper<DataTableFeatures, Invite>();

export const columns = columnHelper.columns([
	columnHelper.accessor('email', {
		header: ({ column }) => {
			return renderComponent(SortButton, {
				label: 'Email',
				onclick: column.getToggleSortingHandler()
			});
		}
	}),
	columnHelper.accessor('invited_by', {
		header: 'Invited By',
		cell: ({ row }) => {
			return renderComponent(DataTableBadge, { badge: row.original.invited_by, capitalize: false });
		}
	}),
	columnHelper.accessor('expires_at', {
		header: 'Expires At',
		cell: ({ row }) => {
			return renderComponent(DataTableBadge, {
				badge: row.original.expires_at.toLocaleDateString()
			});
		}
	}),
	columnHelper.accessor('role', {
		header: 'Role',
		cell: ({ row }) => {
			return renderComponent(DataTableBadge, { badge: row.original.role });
		}
	}),
	columnHelper.accessor('accepted', {
		header: 'Accepted',
		filterFn: 'equals',
		cell: ({ row }) => {
			return renderComponent(DataTableBadge, { badge: row.original.accepted ? 'Yes' : 'No' });
		}
	}),
	columnHelper.display({
		id: 'actions',
		cell: ({ row }) => {
			return renderComponent(DataTableActions, { id: String(row.original.id) });
		},
		meta: {
			align: 'right'
		}
	})
]);
