import { execFileSync } from "node:child_process";
import { access, readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const agent = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const directory = resolve(agent, "../../packages/providers");
for (const item of await readdir(directory, { withFileTypes: true })) {
  if (!item.isDirectory()) continue;
  const provider = join(directory, item.name);
  const pkg = JSON.parse(
    await readFile(join(provider, "package.json"), "utf8"),
  );
  if (!pkg.name?.startsWith("@sluice/provider-")) continue;
  const config = join(provider, "tsconfig.json");
  await access(config);
  console.log(`Checking ${pkg.name}`);
  execFileSync("pnpm", ["exec", "tsc", "--noEmit", "-p", config], {
    cwd: agent,
    stdio: "inherit",
  });
}
