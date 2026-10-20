import { eq, inArray } from 'drizzle-orm';
import { role, rolePermission, permission } from '$lib/server/db/auth.schema';
import type { z } from 'zod';
import type { roleSchema } from './schema';

type Db = App.Locals['db'];
type RoleInput = z.infer<typeof roleSchema>;

/** Creates (or updates when `roleId` is given) a role and replaces its permissions. */
export const saveRole = async (db: Db, input: RoleInput, roleId?: number) =>
	db.transaction(async (tx) => {
		// Ignore any ids that don't correspond to a real permission.
		const permissionIds =
			input.permissions.length > 0
				? (
						await tx
							.select({ id: permission.id })
							.from(permission)
							.where(inArray(permission.id, input.permissions))
					).map((p) => p.id)
				: [];

		if (input.default) {
			await tx.update(role).set({ default: false }).where(eq(role.default, true));
		}

		const values = {
			name: input.name,
			description: input.description || null,
			default: input.default
		};

		let id = roleId;
		if (id === undefined) {
			[{ id }] = await tx.insert(role).values(values).returning({ id: role.id });
		} else {
			await tx.update(role).set(values).where(eq(role.id, id));
			await tx.delete(rolePermission).where(eq(rolePermission.roleId, id));
		}

		if (permissionIds.length > 0) {
			await tx
				.insert(rolePermission)
				.values(permissionIds.map((permissionId) => ({ roleId: id, permissionId })));
		}

		return id;
	});
