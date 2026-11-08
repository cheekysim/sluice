import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { test } from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const exec = promisify(execFile);

test("scaffolding a package automatically adds it to the generated manifest", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "sluice-scaffold-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await Promise.all([
    mkdir(join(dir, "scripts"), { recursive: true }),
    mkdir(join(dir, "packages/providers"), { recursive: true }),
    mkdir(join(dir, "apps/agent/scripts"), { recursive: true }),
    mkdir(join(dir, "apps/agent/src"), { recursive: true }),
  ]);
  await Promise.all([
    copyFile(
      join(root, "scripts/create-provider.mjs"),
      join(dir, "scripts/create-provider.mjs"),
    ),
    copyFile(
      join(root, "apps/agent/scripts/generate-providers.mjs"),
      join(dir, "apps/agent/scripts/generate-providers.mjs"),
    ),
  ]);
  await exec(process.execPath, [
    join(dir, "scripts/create-provider.mjs"),
    "sample",
    "Sample Provider",
  ]);
  await exec(process.execPath, [
    join(dir, "apps/agent/scripts/generate-providers.mjs"),
  ]);
  const pkg = JSON.parse(
    await readFile(join(dir, "packages/providers/sample/package.json"), "utf8"),
  );
  const source = await readFile(
    join(dir, "packages/providers/sample/src/index.ts"),
    "utf8",
  );
  const manifest = await readFile(
    join(dir, "apps/agent/src/provider-manifest.ts"),
    "utf8",
  );
  assert.equal(pkg.name, "@sluice/provider-sample");
  assert.match(source, /implemented: false/);
  assert.match(manifest, /packages\/providers\/sample\/src\/index\.ts/);
  await symlink(
    join(root, "apps/agent/node_modules"),
    join(dir, "packages/providers/sample/node_modules"),
    "dir",
  );
  await exec(join(root, "apps/agent/node_modules/.bin/tsc"), [
    "--noEmit",
    "-p",
    join(dir, "packages/providers/sample/tsconfig.json"),
  ]);
  await writeFile(join(dir, "apps/agent/package.json"), '{"type":"module"}');
  await symlink(
    join(root, "apps/agent/node_modules"),
    join(dir, "apps/agent/node_modules"),
    "dir",
  );
  await exec(join(root, "apps/agent/node_modules/.bin/tsx"), [
    join(dir, "apps/agent/src/provider-manifest.ts"),
  ]);
  await assert.rejects(
    exec(process.execPath, [
      join(dir, "scripts/create-provider.mjs"),
      "sample",
      "Sample Provider",
    ]),
  );
  await assert.rejects(
    exec(process.execPath, [
      join(dir, "scripts/create-provider.mjs"),
      "../bad",
      "Bad",
    ]),
  );
});
