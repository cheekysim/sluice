import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  getAgentConfig,
  getPublicAgentDetails,
  updateAgentConfig,
} from "../src/config.js";

test("creates and reuses a complete agent configuration", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "sluice-agent-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const path = join(dir, "nested", "agent.json");
  const oldIP = process.env.AGENT_IP;
  const oldId = process.env.AGENT_ID;
  process.env.AGENT_IP = "192.0.2.1";
  delete process.env.AGENT_ID;
  t.after(() => {
    if (oldIP === undefined) delete process.env.AGENT_IP;
    else process.env.AGENT_IP = oldIP;
    if (oldId === undefined) delete process.env.AGENT_ID;
    else process.env.AGENT_ID = oldId;
  });

  const first = await getAgentConfig(path);
  assert.match(String(first.agentId), /^[0-9a-f-]{36}$/);
  assert.equal(first.agentIP, "192.0.2.1");
  assert.ok(first.agentName);
  assert.ok(first.agentVersion);
  assert.deepEqual(JSON.parse(await readFile(path, "utf8")), first);

  process.env.AGENT_ID = "different-id";
  process.env.AGENT_IP = "192.0.2.2";
  assert.deepEqual(await getAgentConfig(path), {
    ...first,
    agentIP: "192.0.2.2",
  });
});

test("preserves configured values and fills missing values from the environment", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "sluice-agent-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const path = join(dir, "agent.json");
  await writeFile(
    path,
    JSON.stringify({ agentName: "existing", custom: true }),
  );
  const oldId = process.env.AGENT_ID;
  const oldIP = process.env.AGENT_IP;
  process.env.AGENT_ID = "configured-id";
  process.env.AGENT_IP = "192.0.2.3";
  t.after(() => {
    if (oldId === undefined) delete process.env.AGENT_ID;
    else process.env.AGENT_ID = oldId;
    if (oldIP === undefined) delete process.env.AGENT_IP;
    else process.env.AGENT_IP = oldIP;
  });

  const config = await getAgentConfig(path);
  assert.equal(config.agentId, "configured-id");
  assert.equal(config.agentName, "existing");
  assert.equal(config.agentIP, "192.0.2.3");
  assert.equal(config.custom, true);
});

test("uses AGENT_CONFIG_PATH when no path is passed", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "sluice-agent-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const oldPath = process.env.AGENT_CONFIG_PATH;
  const oldIP = process.env.AGENT_IP;
  const path = join(dir, "agent.json");
  process.env.AGENT_CONFIG_PATH = path;
  process.env.AGENT_IP = "192.0.2.4";
  t.after(() => {
    if (oldPath === undefined) delete process.env.AGENT_CONFIG_PATH;
    else process.env.AGENT_CONFIG_PATH = oldPath;
    if (oldIP === undefined) delete process.env.AGENT_IP;
    else process.env.AGENT_IP = oldIP;
  });

  const config = await getAgentConfig();
  assert.deepEqual(JSON.parse(await readFile(path, "utf8")), config);
});

test("does not overwrite malformed or inaccessible configuration", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "sluice-agent-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const path = join(dir, "agent.json");
  await writeFile(path, "{");
  await assert.rejects(getAgentConfig(path), SyntaxError);
  assert.equal(await readFile(path, "utf8"), "{");
  await writeFile(path, "[]");
  await assert.rejects(getAgentConfig(path), /must be an object/);
  await assert.rejects(getAgentConfig(dir), { code: "EISDIR" });
});

test("persists configuration updates before changing the live config", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "sluice-agent-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const path = join(dir, "agent.json");
  const config = { agentId: "id", agentName: "old", custom: true };
  await writeFile(path, JSON.stringify(config));
  await updateAgentConfig(config, { agentName: "new" }, path);
  assert.deepEqual(config, { agentId: "id", agentName: "new", custom: true });
  assert.deepEqual(JSON.parse(await readFile(path, "utf8")), config);
  await assert.rejects(updateAgentConfig(config, { agentName: "failed" }, dir));
  assert.equal(config.agentName, "new");
  assert.deepEqual(JSON.parse(await readFile(path, "utf8")), config);
});

test("discovery details exclude provider configuration and credentials", () => {
  const details = getPublicAgentDetails({
    agentId: "id",
    agentName: "name",
    agentIP: "192.0.2.1",
    agentVersion: "1",
    providers: { pterodactyl: { config: { apiKey: "secret" } } },
  });
  assert.deepEqual(details, {
    agentId: "id",
    agentName: "name",
    agentIP: "192.0.2.1",
    agentVersion: "1",
  });
});
