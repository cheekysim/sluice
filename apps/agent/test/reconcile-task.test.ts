import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Registry, type DeployedDelta, type Provider } from "@sluice/core";
import { z } from "zod";
import { applyReconcileTask } from "../src/reconcile-task.js";

test("reconcile applies only assigned rules and removes stale rules", async () => {
  const deltas: DeployedDelta[] = [];
  const provider: Provider<object> = {
    type: "custom",
    name: "Custom",
    configSchema: z.object({}),
    capabilities: { transports: ["tcp", "udp"] },
    async validate() {},
    async apply(delta) {
      deltas.push(delta);
    },
    async health() {
      return true;
    },
    async status() {
      return {
        rules: [{ id: "old", host: "old", port: 1, protocol: ["tcp"] }],
      };
    },
  };
  const registry = new Registry();
  registry.register(provider);
  const task = {
    taskId: randomUUID(),
    action: "reconcile",
    providers: { custom: [1] },
    rules: [
      { id: 1, host: "host", port: 80, protocol: ["TCP", "UDP"] },
      { id: 2, host: "ignored", port: 80, protocol: ["TCP"] },
    ],
  };
  await applyReconcileTask(task, registry, true);
  assert.deepEqual(deltas[0].ops, [
    {
      op: "upsert",
      rule: { id: "1", host: "host", port: 80, protocol: ["tcp", "udp"] },
    },
    { op: "delete", id: "old" },
  ]);
  await assert.rejects(
    applyReconcileTask(
      { ...task, providers: { custom: [1], missing: [] } },
      registry,
      true,
    ),
    /Unknown provider/,
  );
  assert.equal(deltas.length, 1);
  await assert.doesNotReject(
    applyReconcileTask(
      { ...task, providers: { missing: [] } },
      registry,
      false,
    ),
  );
  await assert.rejects(
    applyReconcileTask(
      { ...task, rules: [{ ...task.rules[0], protocol: ["SCTP"] }] },
      registry,
      true,
    ),
  );
  await assert.rejects(
    applyReconcileTask(
      { ...task, providers: { custom: [999] } },
      registry,
      true,
    ),
    /Missing assigned rule/,
  );
  provider.capabilities.transports = ["tcp"];
  await assert.rejects(
    applyReconcileTask(task, registry, true),
    /does not support udp/,
  );
  assert.equal(deltas.length, 1);
});
