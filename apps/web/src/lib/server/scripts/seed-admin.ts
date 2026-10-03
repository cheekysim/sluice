import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from '@better-auth/drizzle-adapter/relations-v2';
import * as schema from '../db/schema';
import { user } from '../db/schema';
import { relations } from '../db/relations';

async function main() {
	const { DATABASE_URL, ORIGIN, BETTER_AUTH_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

	if (!DATABASE_URL) throw new Error('DATABASE_URL is not set');
	if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
		throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set');
	}

	const client = postgres(DATABASE_URL);
	const db = drizzle({ client, relations });

	try {
		const [existingUser] = await db.select({ id: user.id }).from(user).limit(1);
		if (existingUser) {
			console.log('Users table is not empty, skipping owner seed.');
			return;
		}

		const auth = betterAuth({
			baseURL: ORIGIN,
			secret: BETTER_AUTH_SECRET,
			database: drizzleAdapter(db, { provider: 'pg', schema }),
			emailAndPassword: { enabled: true }
		});

		const { user: createdUser } = await auth.api.signUpEmail({
			body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, name: 'Owner' }
		});

		await db.update(user).set({ roleId: 1 }).where(eq(user.id, createdUser.id));

		console.log(`Created Owner user: ${ADMIN_EMAIL}`);
	} finally {
		await client.end();
	}
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
