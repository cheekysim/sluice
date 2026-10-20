import type { PageServerLoad, Actions } from './$types';
import { v4 as uuidv4 } from 'uuid';
import type { Invite } from './columns.js';
import { invite } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { requirePermission } from '$lib/server/permissions';

export const load = (async ({ locals, depends }) => {
	await requirePermission(locals, 'users.manage');
	depends('app:invites');

	const { db } = locals;
	const rows = await db.query.invite.findMany({
		columns: {
			id: true,
			email: true,
			invited_by: true,
			role_id: true,
			expires_at: true,
			accepted: true
		}
	});

	const invites = (
		await Promise.all(
			rows.map(async (row): Promise<Invite | null> => {
				if (!row.role_id) return null;
				const role = await db.query.role.findFirst({
					where: { id: row.role_id }
				});

				return {
					id: row.id,
					email: row.email,
					invited_by: row.invited_by ?? 'Deleted User',
					expires_at: row.expires_at,
					role: role?.name ?? '',
					accepted: row.accepted
				};
			})
		)
	).filter((invite): invite is Invite => invite !== null);

	return { invites };
}) satisfies PageServerLoad;

export const actions = {
	deleteInvite: async ({ request, locals }) => {
		await requirePermission(locals, 'users.manage');
		const data = await request.formData();
		const id = data.get('id');
		if (typeof id !== 'string') return { success: false };

		await locals.db.delete(invite).where(eq(invite.id, parseInt(id, 10)));

		return { success: true };
	},
	regenInvite: async ({ request, locals }) => {
		await requirePermission(locals, 'users.manage');
		const { db } = locals;
		const data = await request.formData();
		const id = data.get('id');
		if (typeof id !== 'string') return { success: false };

		const token = uuidv4();

		const { email, created_at, expires_at } =
			(await db.query.invite.findFirst({
				where: { id: parseInt(id, 10) },
				columns: {
					email: true,
					created_at: true,
					expires_at: true
				}
			})) ?? {};

		if (!email || !created_at || !expires_at) return { success: false };

		const inviteValidFor = expires_at.getTime() - created_at.getTime();
		const inviteValidForDays = inviteValidFor / (1000 * 60 * 60 * 24);
		const inviteValidForString = `${inviteValidForDays}_day`;

		const inviteValidForExpiresAt = new Date(Date.now() + inviteValidFor);

		await db
			.update(invite)
			.set({ token, expires_at: inviteValidForExpiresAt })
			.where(eq(invite.id, parseInt(id, 10)));

		return { success: true, token, email, inviteValidFor: inviteValidForString };
	}
} satisfies Actions;
