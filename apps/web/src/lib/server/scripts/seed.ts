import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Order matters: permissions are granted to roles, and the admin user needs the owner role.
const SCRIPTS = ['seed-role.ts', 'seed-permission.ts', 'seed-admin.ts'];

for (const script of SCRIPTS) {
	console.log(`\n> Running ${script}`);
	const result = spawnSync(
		process.execPath,
		['--import', 'tsx', fileURLToPath(new URL(script, import.meta.url))],
		{ stdio: 'inherit' }
	);
	if (result.status !== 0) {
		console.error(`${script} failed, aborting.`);
		process.exit(result.status ?? 1);
	}
}

console.log('\nAll seeds completed.');
