import { error } from '@sveltejs/kit';

type Locals = App.Locals;

export type PermissionSet = { isOwner: boolean; actions: Set<string> };

const OWNER_ROLE = 'owner';

// Permissions are resolved at most once per request.
const cache = new WeakMap<Locals, Promise<PermissionSet>>();

const load = async ({ db, user }: Locals): Promise<PermissionSet> => {
	if (!user) return { isOwner: false, actions: new Set() };

	const row = await db.query.user.findFirst({
		where: { id: user.id },
		columns: {},
		with: {
			role: {
				columns: { name: true },
				with: { permissions: { with: { permission: { columns: { action: true } } } } }
			}
		}
	});

	const actions = new Set(
		(row?.role?.permissions ?? []).flatMap((p) => (p.permission ? [p.permission.action] : []))
	);
	return { isOwner: row?.role?.name === OWNER_ROLE, actions };
};

/** The current user's permissions, loaded once per request. */
export const getPermissions = (locals: Locals) => {
	let permissions = cache.get(locals);
	if (!permissions) {
		permissions = load(locals);
		cache.set(locals, permissions);
	}
	return permissions;
};

/** True when the user holds every given permission. The owner role always passes. */
export const hasPermission = async (locals: Locals, ...required: string[]) => {
	const { isOwner, actions } = await getPermissions(locals);
	return isOwner || required.every((action) => actions.has(action));
};

/**
 * Throws a 401/403 unless the user holds every given permission.
 * Call at the top of every protected `load` and form action:
 *
 *     await requirePermission(locals, 'users.manage');
 */
export const requirePermission = async (locals: Locals, ...required: string[]) => {
	if (!locals.user) error(401, 'Not authenticated');
	if (!(await hasPermission(locals, ...required))) {
		error(403, 'You do not have permission to do this');
	}
};

/** Every permission the user holds, as a plain list that is safe to send to the client. */
export const listPermissions = async (locals: Locals) => {
	const { isOwner, actions } = await getPermissions(locals);
	if (!isOwner) return [...actions];
	const all = await locals.db.query.permission.findMany({ columns: { action: true } });
	return all.map((p) => p.action);
};
