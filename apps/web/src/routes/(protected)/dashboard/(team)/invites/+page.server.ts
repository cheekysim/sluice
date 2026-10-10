import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import type { Invite } from './columns.js';

export const load = (async () => {
	const rows = await db.query.invite.findMany({
		columns: { id: true, email: true, invited_by: true, role_id: true, expires_at: true }
	});

	const invites = (
		await Promise.all(
			rows.map(async (row): Promise<Invite | null> => {
				if (!row.invited_by) return null;
				const user = await db.query.user.findFirst({
					where: { id: row.invited_by }
				});
				if (!row.role_id) return null;
				const role = await db.query.role.findFirst({
					where: { id: row.role_id }
				});

				return {
					id: row.id,
					email: row.email,
					invited_by: user?.email ?? '',
					expires_at: row.expires_at,
					role: role?.name ?? ''
				};
			})
		)
	).filter((invite): invite is Invite => invite !== null);

	return { invites };
}) satisfies PageServerLoad;
