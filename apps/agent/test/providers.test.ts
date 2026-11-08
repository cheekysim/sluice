import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createProviderRegistry,
  providerDefinitions,
  validateProviderSettings,
} from "../src/providers.js";

test("validates enabled providers against their schemas", () => {
  const registry = createProviderRegistry({
    nginx: { enabled: true, config: {} },
  });

  assert.equal(registry.has("nginx"), true);
  assert.equal(
    createProviderRegistry({ nginx: { enabled: false, config: {} } }).has(
      "nginx",
    ),
    false,
  );
  assert.throws(() =>
    validateProviderSettings({
      nginx: { enabled: true, config: { reloadCmd: "" } },
    }),
  );
  assert.throws(() =>
    validateProviderSettings({
      nginx: { enabled: true, config: { invalid: "value" } },
    }),
  );
  assert.throws(() =>
    validateProviderSettings({ unknown: { enabled: true, config: {} } }),
  );
  assert.throws(
    () =>
      validateProviderSettings({
        pterodactyl: {
          enabled: true,
          config: {
            baseUrl: "https://example.com",
            apiKey: "key",
            timeoutSeconds: 30,
          },
        },
      }),
    /not implemented/,
  );
});

test("nginx uses the configured validation command without overwriting existing files", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "sluice-nginx-test-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const executable = join(dir, "validate");
  const marker = join(dir, "ran");
  const existing = join(dir, "test.conf");
  await writeFile(existing, "existing");
  await writeFile(
    executable,
    `#!/bin/sh\ntest -f "$1" || exit 1\nprintf ok > "${marker}"\n`,
    {
      mode: 0o700,
    },
  );
  const registry = createProviderRegistry({
    nginx: { enabled: true, config: { configDir: dir, testCmd: executable } },
  });
  await registry.get("nginx").validate({ changed: true, ops: [] });
  assert.equal(await readFile(marker, "utf8"), "ok");
  assert.equal(await readFile(existing, "utf8"), "existing");
});

test("nginx applies and observes reconcile deltas and reports health", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "sluice-nginx-contract-"));
  const previousPath = process.env.PATH;
  t.after(async () => {
    if (previousPath === undefined) delete process.env.PATH;
    else process.env.PATH = previousPath;
    await rm(dir, { recursive: true, force: true });
  });
  await writeFile(join(dir, "nginx"), "#!/bin/sh\nexit 0\n", { mode: 0o700 });
  process.env.PATH = `${dir}:${previousPath ?? ""}`;
  const provider = createProviderRegistry({
    nginx: {
      enabled: true,
      config: { configDir: dir, testCmd: "/bin/true", reloadCmd: "/bin/true" },
    },
  }).get("nginx");
  assert.equal(await provider.health(), true);
  const rule = {
    id: "1",
    host: "127.0.0.1",
    port: 8080,
    protocol: ["tcp" as const],
  };
  await provider.apply({ changed: true, ops: [{ op: "upsert", rule }] });
  assert.deepEqual((await provider.status()).rules, [rule]);
  await provider.apply({ changed: true, ops: [{ op: "delete", id: rule.id }] });
  assert.deepEqual((await provider.status()).rules, []);
});

test("exposes provider configuration schemas with sensitive field metadata", () => {
  const definitions = providerDefinitions();
  const nginx = definitions.find((definition) => definition.type === "nginx");
  assert.ok(nginx?.schema.properties?.configDir);
  assert.equal(
    nginx.version,
    "a483dae85221e4713ba2ae4c8af9e7039a6e992819fb2e2e45d35686bdfd17b2",
  );
  const panel = definitions.find(
    (definition) => definition.type === "pterodactyl",
  );
  assert.equal(panel?.implemented, false);
  assert.equal(panel?.schema.properties?.apiKey.secret, true);
  assert.equal(
    panel.version,
    "df67d5cdf8755d491ada250f3bc31fd5468a94e43140c5143f78d2a07f7ecdec",
  );
});
