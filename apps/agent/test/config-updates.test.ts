import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { connect, StringCodec } from "nats";
import { consumeConfigUpdates } from "../src/config-updates.js";
import {
  createProviderRegistry,
  providerDefinitions,
} from "../src/providers.js";
import { listenForProviderSchemas } from "../src/schema-discovery.js";

const server = process.env.NATS_TEST_URL;

test(
  "durably delivers ordered configuration only to the intended agent",
  { skip: !server },
  async (t) => {
    const suffix = randomUUID().replaceAll("-", "");
    const stream = `TEST_CONFIG_${suffix}`;
    const subjectPrefix = `test.config.${suffix}`;
    const dir = await mkdtemp(join(tmpdir(), "sluice-config-stream-"));
    const admin = await connect({ servers: server });
    const jsm = await admin.jetstreamManager();
    await jsm.streams.add({ name: stream, subjects: [`${subjectPrefix}.>`] });
    const connections = [
      await connect({ servers: server }),
      await connect({ servers: server }),
    ];
    const controller = new AbortController();
    t.after(async () => {
      controller.abort();
      await Promise.all(connections.map((nc) => nc.close()));
      await jsm.streams.delete(stream);
      await admin.close();
      await rm(dir, { recursive: true, force: true });
    });

    const firstDir = join(dir, "first");
    const firstPath = join(firstDir, "agent.json");
    const secondPath = join(dir, "second.json");
    const first = { agentId: "first", agentName: "old-first" };
    const names: string[] = [];
    let firstName = first.agentName;
    Object.defineProperty(first, "agentName", {
      enumerable: true,
      get: () => firstName,
      set: (value: string) => {
        firstName = value;
        names.push(value);
      },
    });
    const second = { agentId: "second", agentName: "old-second" };
    let activeRegistry = createProviderRegistry({
      nginx: { enabled: true, config: {} },
    });
    await writeFile(secondPath, JSON.stringify(second));
    const subject = (id: string) =>
      `${subjectPrefix}.${createHash("sha256").update(id).digest("hex")}`;
    const publish = (id: string, value: unknown) =>
      admin
        .jetstream()
        .publish(subject(id), StringCodec().encode(JSON.stringify(value)));

    // These messages exist before either durable consumer is created.
    await publish("first", { agentId: "second", agentName: "wrong-target" });
    await publish("first", {
      agentId: "first",
      agentName: "invalid-provider",
      providers: { nginx: { enabled: true, config: { reloadCmd: "" } } },
    });
    await publish("first", { agentId: "first", agentName: "first-update" });
    await publish("first", { agentId: "first", agentName: "final-update" });
    await publish("first", {
      agentId: "first",
      agentName: "final-update",
      providers: { nginx: { enabled: false, config: {} } },
    });
    await publish("second", { agentId: "second", agentName: "second-update" });

    const errors: string[] = [];
    t.mock.method(console, "error", (...args: unknown[]) => {
      errors.push(String(args[0]));
    });
    const processing = [
      consumeConfigUpdates(connections[0], first, {
        stream,
        subjectPrefix,
        configPath: firstPath,
        signal: controller.signal,
        onProviders: (registry) => {
          activeRegistry = registry;
        },
      }),
      consumeConfigUpdates(connections[1], second, {
        stream,
        subjectPrefix,
        configPath: secondPath,
        signal: controller.signal,
      }),
    ];
    const waitFor = async (predicate: () => boolean) => {
      const deadline = Date.now() + 15000;
      while (!predicate()) {
        if (Date.now() > deadline)
          throw new Error("Timed out waiting for configuration delivery");
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    };
    await waitFor(() => second.agentName === "second-update");
    await waitFor(() =>
      errors.includes("Failed to persist agent configuration update:"),
    );

    assert.ok(errors.includes("Rejecting invalid agent configuration update:"));
    assert.equal(first.agentName, "old-first");
    await mkdir(firstDir);
    await waitFor(
      () => first.agentName === "final-update" && !activeRegistry.has("nginx"),
    );
    assert.deepEqual(names, ["first-update", "final-update", "final-update"]);
    assert.equal(
      JSON.parse(await readFile(firstPath, "utf8")).agentName,
      "final-update",
    );
    assert.deepEqual(JSON.parse(await readFile(firstPath, "utf8")).providers, {
      nginx: { enabled: false, config: {} },
    });
    assert.equal(
      JSON.parse(await readFile(secondPath, "utf8")).agentName,
      "second-update",
    );
    controller.abort();
    await Promise.all(processing);
    await publish("first", { agentId: "first", agentName: "offline-update" });
    const restarted = JSON.parse(await readFile(firstPath, "utf8"));
    const restartController = new AbortController();
    const restartedProcessing = consumeConfigUpdates(
      connections[0],
      restarted,
      {
        stream,
        subjectPrefix,
        configPath: firstPath,
        signal: restartController.signal,
      },
    );
    try {
      await waitFor(() => restarted.agentName === "offline-update");
      assert.equal(
        JSON.parse(await readFile(firstPath, "utf8")).agentName,
        "offline-update",
      );
    } finally {
      restartController.abort();
      await restartedProcessing;
    }
  },
);

test(
  "advertises all schemas and reports version mismatches and applied updates",
  { skip: !server },
  async (t) => {
    const suffix = randomUUID().replaceAll("-", "");
    const stream = `TEST_CONFIG_${suffix}`;
    const subjectPrefix = `test.config.${suffix}`;
    const dir = await mkdtemp(join(tmpdir(), "sluice-schema-stream-"));
    const nc = await connect({ servers: server });
    const jsm = await nc.jetstreamManager();
    await jsm.streams.add({ name: stream, subjects: [`${subjectPrefix}.>`] });
    const id = randomUUID();
    const config: Record<string, unknown> = {
      agentId: id,
      agentName: "node",
      providers: {
        nginx: { enabled: true, config: { secret: "apiKeyValue" } },
      },
    };
    const path = join(dir, "agent.json");
    await writeFile(path, JSON.stringify(config));
    const controller = new AbortController();
    const listener = listenForProviderSchemas(nc, config);
    const processing = consumeConfigUpdates(nc, config, {
      stream,
      subjectPrefix,
      configPath: path,
      signal: controller.signal,
    });
    t.after(async () => {
      controller.abort();
      listener.subscription.unsubscribe();
      await Promise.all([processing, listener.done]);
      await jsm.streams.delete(stream);
      await nc.close();
      await rm(dir, { recursive: true, force: true });
    });
    const subject = `agent.schemas.${createHash("sha256").update(id).digest("hex")}`;
    const codec = StringCodec();
    const reply = await nc.request(subject, codec.encode(""), {
      timeout: 2000,
    });
    const advertised = JSON.parse(codec.decode(reply.data));
    assert.equal(advertised.agentId, id);
    assert.deepEqual(advertised.providers, providerDefinitions());
    assert.ok(
      advertised.providers.some(
        (p: { type: string }) => p.type === "pterodactyl",
      ),
    );
    assert.equal(JSON.stringify(advertised).includes("apiKeyValue"), false);
    const publish = (updateId: string, version: string, name: string) =>
      nc.jetstream().publish(
        `${subjectPrefix}.${createHash("sha256").update(id).digest("hex")}`,
        codec.encode(
          JSON.stringify({
            agentId: id,
            agentName: name,
            updateId,
            providers: { nginx: { enabled: true, config: {} } },
            schemaVersions: { nginx: version },
          }),
        ),
      );
    const waitFor = async (target: string) => {
      const deadline = Date.now() + 10000;
      while (
        (config.providerUpdate as { id?: string } | undefined)?.id !== target
      ) {
        if (Date.now() > deadline)
          throw new Error("Timed out waiting for update status");
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
    };
    t.mock.method(console, "error", () => {});
    const badId = randomUUID();
    await publish(badId, "0".repeat(64), "bad");
    await waitFor(badId);
    assert.deepEqual(config.providerUpdate, {
      id: badId,
      status: "failed",
      message: "Provider schema changed: nginx",
    });
    assert.equal(config.agentName, "node");
    assert.deepEqual(
      JSON.parse(await readFile(path, "utf8")).providerUpdate,
      config.providerUpdate,
    );
    const goodId = randomUUID();
    await publish(
      goodId,
      advertised.providers.find((p: { type: string }) => p.type === "nginx")
        .version,
      "updated",
    );
    await waitFor(goodId);
    assert.deepEqual(config.providerUpdate, { id: goodId, status: "applied" });
    assert.equal(config.agentName, "updated");
    const finalReply = await nc.request(subject, codec.encode(""), {
      timeout: 2000,
    });
    assert.deepEqual(
      JSON.parse(codec.decode(finalReply.data)).providerUpdate,
      config.providerUpdate,
    );
  },
);
