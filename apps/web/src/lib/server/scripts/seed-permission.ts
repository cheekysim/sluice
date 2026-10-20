import { drizzle } from 'drizzle-orm/postgres-js';
import { inArray } from 'drizzle-orm';
import postgres from 'postgres';
import { permission, role, rolePermission } from '../db/schema';
import { relations } from '../db/relations';

// Permissions follow "category.name". Based on the RBAC section of redesign-spec.md.
const PERMISSIONS = [
	// Proxy rules
	'rules.read',
	'rules.write',
	// Backend and frontend proxy providers
	'providers.read',
	'providers.write',
	// Proxy hosts running the agent
	'nodes.read',
	'nodes.write',
	// Users, invites and roles
	'users.manage',
	'roles.manage',
	// API keys: manage everyone's, or only your own
	'keys.manage',
	'keys.self',
	// Plugins: install, configure and run route-lifecycle modules
	'plugins.read',
	'plugins.write',
	// Configuration and settings
	'config.read',
	'config.write',
	'settings.write',
	// Audit log and statistics
	'audit.read',
	'stats.read'
];

// Role bundles from the spec. Seeding only ever adds grants, never removes them.
const ROLE_PERMISSIONS: Record<string, string[]> = {
	owner: PERMISSIONS,
	admin: PERMISSIONS.filter((action) => action !== 'roles.manage'),
	operator: [
		'rules.read',
		'rules.write',
		'providers.read',
		'stats.read',
		'audit.read',
		'keys.self'
	],
	viewer: ['rules.read', 'providers.read', 'stats.read', 'audit.read']
};

async function main() {
	const { DATABASE_URL } = process.env;

	if (!DATABASE_URL) throw new Error('DATABASE_URL is not set');

	const client = postgres(DATABASE_URL);
	const db = drizzle({ client, relations });

	try {
		await db
			.insert(permission)
			.values(PERMISSIONS.map((action) => ({ action })))
			.onConflictDoNothing();
		console.log(`Ensured ${PERMISSIONS.length} permissions exist`);

		const permissions = await db
			.select({ id: permission.id, action: permission.action })
			.from(permission)
			.where(inArray(permission.action, PERMISSIONS));
		const idByAction = new Map(permissions.map((p) => [p.action, p.id]));

		const roles = await db
			.select({ id: role.id, name: role.name })
			.from(role)
			.where(inArray(role.name, Object.keys(ROLE_PERMISSIONS)));

		for (const { id, name } of roles) {
			const values = ROLE_PERMISSIONS[name].map((action) => ({
				roleId: id,
				permissionId: idByAction.get(action)!
			}));
			await db.insert(rolePermission).values(values).onConflictDoNothing();
			console.log(`Granted ${values.length} permissions to role: ${name}`);
		}
	} finally {
		await client.end();
	}
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
