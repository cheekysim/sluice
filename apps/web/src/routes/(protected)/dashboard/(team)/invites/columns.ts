import { createColumnHelper, renderComponent } from '@tanstack/svelte-table';
import type { DataTableFeatures } from './data-table-features.js';
import DataTableActions from './data-table-actions.svelte';
import DataTableBadge from './data-table-badge.svelte';
import DataTableEmailButton from './data-table-email-button.svelte';

export type Invite = {
	id: number;
	email: string;
	invited_by: string;
	expires_at: Date;
	role: string;
};

const columnHelper = createColumnHelper<DataTableFeatures, Invite>();

export const columns = columnHelper.columns([
	columnHelper.accessor('email', {
		header: ({ column }) => {
			return renderComponent(DataTableEmailButton, {
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
