import { createColumnHelper, renderComponent } from '@tanstack/svelte-table';
import type { DataTableFeatures } from '$lib/components/data-table/features.js';
import SortButton from '$lib/components/data-table/sort-button.svelte';
import AgentId from './agent-id.svelte';
import NodeStatus from './node-status.svelte';
import NodeActions from './node-actions.svelte';

export type AgentDetails = {
	agentId: string;
	agentVersion: string;
	agentName: string;
	agentIP: string;
};
export type Agent = AgentDetails & { status: 'online' | 'offline' | 'unknown' };

const columnHelper = createColumnHelper<DataTableFeatures, Agent>();

export const createColumns = (canWrite: boolean) =>
	columnHelper.columns([
		columnHelper.accessor('status', {
			header: 'Status',
			cell: ({ row }) => renderComponent(NodeStatus, { status: row.original.status })
		}),
		columnHelper.accessor('agentName', {
			header: ({ column }) =>
				renderComponent(SortButton, {
					label: 'Name',
					onclick: column.getToggleSortingHandler()
				})
		}),
		columnHelper.accessor('agentId', {
			header: 'Agent ID',
			cell: ({ row }) => renderComponent(AgentId, { id: row.original.agentId })
		}),
		columnHelper.accessor('agentIP', { header: 'IP Address' }),
		columnHelper.accessor('agentVersion', { header: 'Version' }),
		...(canWrite
			? [
					columnHelper.display({
						id: 'actions',
						header: 'Actions',
						cell: ({ row }) => renderComponent(NodeActions, { agent: row.original }),
						meta: { align: 'right' as const }
					})
				]
			: [])
	]);
