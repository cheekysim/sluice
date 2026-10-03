import { createColumnHelper, renderComponent } from '@tanstack/svelte-table';
import type { DataTableFeatures } from './data-table-features.js';
import DataTableActions from './data-table-actions.svelte';
import DataTableBadge from './data-table-badge.svelte';
import DataTableAvatar from './data-table-avatar.svelte';
import DataTableNameButton from './data-table-name-button.svelte';

export type User = {
	id: string;
	name: string;
	email: string;
	role: string;
	image: string;
	provider: string;
};

const columnHelper = createColumnHelper<DataTableFeatures, User>();

export const columns = columnHelper.columns([
	columnHelper.display({
		id: 'avatar',
		cell: ({ row }) => {
			return renderComponent(DataTableAvatar, {
				url: row.original.image,
				name: row.original.name
			});
		}
	}),
	columnHelper.accessor('name', {
		header: ({ column }) => {
			return renderComponent(DataTableNameButton, {
				onclick: column.getToggleSortingHandler()
			});
		}
	}),
	columnHelper.accessor('email', {
		header: 'Email'
	}),
	columnHelper.accessor('role', {
		header: 'Role',
		cell: ({ row }) => {
			return renderComponent(DataTableBadge, { badge: row.original.role });
		}
	}),
	columnHelper.accessor('provider', {
		header: 'Provider',
		cell: ({ row }) => {
			return renderComponent(DataTableBadge, { badge: row.original.provider });
		}
	}),
	columnHelper.display({
		id: 'actions',
		cell: ({ row }) => {
			return renderComponent(DataTableActions, { id: row.original.id });
		},
		meta: {
			align: 'right'
		}
	})
]);
