import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { role } from '../db/schema';
import { relations } from '../db/relations';

async function main() {
	const { DATABASE_URL } = process.env;

	if (!DATABASE_URL) throw new Error('DATABASE_URL is not set');

	const client = postgres(DATABASE_URL);
	const db = drizzle({ client, relations });

	try {
		const [existingRole] = await db.select({ role: role.role }).from(role).limit(1);
		if (existingRole) {
			console.log('Roles table is not empty, skipping owner seed.');
			return;
		}

		await db.insert(role).values({ role: 'owner' });
		console.log(`Created Owner role: owner`);
		await db.insert(role).values({ role: 'admin' });
		console.log(`Created Admin role: admin`);
		await db.insert(role).values({ role: 'user' });
		console.log(`Created User role: user`);
	} finally {
		await client.end();
	}
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
