import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { role } from '../db/schema';
import { relations } from '../db/relations';

// Roles from the RBAC section of redesign-spec.md. Viewer is the default (least privilege).
const ROLES = [
	{ name: 'owner', description: 'Full access to everything, including role management' },
	{ name: 'admin', description: 'Everything except role management; manages users and keys' },
	{ name: 'operator', description: 'Manages proxy rules and can view providers, stats and audit' },
	{
		name: 'viewer',
		description: 'Read-only access to rules, providers, stats and audit',
		default: true
	}
];

async function main() {
	const { DATABASE_URL } = process.env;

	if (!DATABASE_URL) throw new Error('DATABASE_URL is not set');

	const client = postgres(DATABASE_URL);
	const db = drizzle({ client, relations });

	try {
		const result = await db
			.insert(role)
			.values(ROLES)
			.onConflictDoNothing()
			.returning({ name: role.name });
		if (result.length === 0) {
			console.log('All roles already exist, nothing to seed.');
			return;
		}
		for (const { name } of result) console.log(`Created role: ${name}`);
	} finally {
		await client.end();
	}
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
