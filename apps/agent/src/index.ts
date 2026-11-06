import { reconcile, registry, computeDelta } from "@sluice/core";

import { register as pterodactyl } from "@sluice/provider-pterodactyl";
import { register as nginx } from "@sluice/provider-nginx";

import { connect, NatsError, StringCodec } from "nats";

import "dotenv/config";

registry.load({ register: pterodactyl });
registry.load({
  register: nginx({
    configDir: process.env.NGINX_CONFIG_DIR,
    reloadCmd: process.env.NGINX_RELOAD_CMD,
  }),
});

// NATS
const nc = await connect({
  servers: process.env.NATS_URL || "nats://nats:4222",
});
const js = nc.jetstream();
const jsm = await nc.jetstreamManager();
const sc = StringCodec();

const taskStreamConfig = { name: "TASKS", subjects: ["agent.task.>"] };

function assertTaskStreamSubjects(subjects: string[] | undefined) {
  if (!subjects?.includes("agent.task.>")) {
    throw new Error(
      'JetStream stream "TASKS" must include subject "agent.task.>"',
    );
  }
}

try {
  const stream = await jsm.streams.info("TASKS");
  assertTaskStreamSubjects(stream.config.subjects);
} catch (error) {
  if (!(error instanceof NatsError) || error.api_error?.code !== 404)
    throw error;
  try {
    await jsm.streams.add(taskStreamConfig);
  } catch (addError) {
    try {
      const stream = await jsm.streams.info("TASKS");
      assertTaskStreamSubjects(stream.config.subjects);
    } catch (verifyError) {
      if (
        verifyError instanceof NatsError &&
        verifyError.api_error?.code === 404
      ) {
        throw addError;
      }
      throw verifyError;
    }
  }
}

try {
  await jsm.consumers.info("TASKS", "worker-group");
} catch (error) {
  if (!(error instanceof NatsError) || error.api_error?.code !== 404)
    throw error;
  await jsm.consumers.add("TASKS", {
    durable_name: "worker-group",
  });
}

console.log("Agent pulling from JetStream...");

// Plain (non-JetStream) subject: only agents online right now answer
const agentId = process.env.AGENT_ID ?? crypto.randomUUID();
const providerQueries = nc.subscribe("agent.query.providers");
void (async () => {
  for await (const query of providerQueries) {
    const providers = await Promise.all(
      registry.list().map(async (provider) => ({
        type: provider.type,
        name: provider.name,
        capabilities: provider.capabilities,
        healthy: await Promise.resolve(provider.health()).catch(() => false),
      })),
    );
    query.respond(sc.encode(JSON.stringify({ agentId, providers })));
  }
})();

// Bind to the consumer and iterate over incoming queued messages
const consumer = await js.consumers.get("TASKS", "worker-group");
const messages = await consumer.consume();

for await (const msg of messages) {
  const payload = JSON.parse(sc.decode(msg.data));
  console.log(`Processing offline-capable task:`, JSON.stringify(payload, null,2));

  if (payload.action === "reconcile") {
    try {
      const providerRules = payload.providers;
      if (!providerRules || typeof providerRules !== "object") {
        throw new Error("Reconcile task is missing providers");
      }
      for (const [providerType, ruleIds] of Object.entries(
        providerRules,
      )) {
        if (!Array.isArray(ruleIds)) {
          throw new Error(
            `Invalid rule assignments for provider ${providerType}`,
          );
        }
        const proxyProvider = registry.get(providerType);
        const assignedRuleIds = new Set(ruleIds.map(String));
        await reconcile(
          {
            rules: payload.rules
              .filter((rule: { id: number | string }) =>
                assignedRuleIds.has(String(rule.id)),
              )
              .map((rule: { id: number | string; protocol: string[] }) => ({
                ...rule,
                id: String(rule.id),
                protocol: rule.protocol.map((protocol) =>
                  protocol.toLowerCase(),
                ),
              })),
          },
          proxyProvider.status,
          computeDelta,
          proxyProvider.apply,
        );
      }
      const completionData = sc.encode(
        JSON.stringify({ status: "success", taskId: payload.taskId }),
      );
      nc.publish(`task.done.${payload.taskId}`, completionData);
      await nc.flush();
      msg.ack();
    } catch (err) {
      console.error(`Failed to process task ${payload.taskId}:`, err);
      const failureData = sc.encode(
        JSON.stringify({ status: "failure", taskId: payload.taskId }),
      );
      nc.publish(`task.done.${payload.taskId}`, failureData);
      await nc.flush();
      msg.ack();
    }
  }
}

// console.log(registry.list());

// console.log("Reconcile Test: ");
// console.log(nginxProvider);

// const testRules: RuleDesired[] = [
//   {
//     id: "1",
//     upstream: { host: "10.0.10.30", port: 80, protocol: ["tcp"] },
//   },
//   {
//     id: "2",
//     upstream: { host: "10.0.10.30", port: 443, protocol: ["tcp"] },
//   },
//   {
//     id: "3",
//     upstream: { host: "10.0.10.30", port: 25565, protocol: ["tcp"] },
//   },
// ];

// console.log("Current State: ");
// console.log(JSON.stringify(await nginxProvider.status(), null, 2));

// console.log("Reconcile Complete");
// console.log("Current State: ");
// console.log(JSON.stringify(await nginxProvider.status(), null, 2));
