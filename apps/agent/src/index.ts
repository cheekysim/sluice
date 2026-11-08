import {
  createProviderRegistry,
  defaultProviderSettings,
} from "./providers.js";

import { connect, NatsError, StringCodec } from "nats";

import "dotenv/config";
import { getAgentConfig, getPublicAgentDetails } from "./config.js";
import { consumeConfigUpdates } from "./config-updates.js";
import { listenForProviderSchemas } from "./schema-discovery.js";
import { nodeReconcileConsumer } from "./reconcile-consumer.js";
import { applyReconcileTask } from "./reconcile-task.js";

const agentConfig = await getAgentConfig();
const agentId = agentConfig.agentId;
if (typeof agentId !== "string" || !agentId)
  throw new Error("Invalid agent ID");

let registry = createProviderRegistry(
  agentConfig.providers ?? defaultProviderSettings,
);

// NATS
const nc = await connect({
  servers: process.env.NATS_URL || "nats://nats:4222",
});
const js = nc.jetstream();
const jsm = await nc.jetstreamManager();
const sc = StringCodec();

void consumeConfigUpdates(nc, agentConfig, {
  onProviders: (next) => {
    registry = next;
  },
}).catch((error) => {
  console.error("Agent configuration consumer failed:", error);
  process.exitCode = 1;
  void nc.close();
});

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

// Agent.query.providers
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

void listenForProviderSchemas(nc, agentConfig).done.catch((error) => {
  console.error("Provider schema discovery failed:", error);
  process.exitCode = 1;
  void nc.close();
});

// Agent.query
const agentQueries = nc.subscribe("agent.query");
void (async () => {
  for await (const query of agentQueries) {
    console.log(
      `Received agent query from subject: ${query.subject}. Agent ID: ${agentId}`,
    );
    query.respond(
      sc.encode(JSON.stringify(getPublicAgentDetails(agentConfig))),
    );
  }
})();

// Bind to the consumer and iterate over incoming queued messages
const consumer = await js.consumers.get("TASKS", "worker-group");
const messages = await consumer.consume();
const nodeConsumer = await nodeReconcileConsumer(nc, agentId);
const nodeMessages = await nodeConsumer.consume();

let previousTask = Promise.resolve();
async function processMessages(
  messages: typeof nodeMessages,
  targeted = false,
) {
  for await (const msg of messages) {
    const previous = previousTask;
    let release!: () => void;
    previousTask = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    let taskId: string | undefined;
    try {
      const payload: unknown = JSON.parse(sc.decode(msg.data));
      if (
        payload &&
        typeof payload === "object" &&
        "taskId" in payload &&
        typeof payload.taskId === "string" &&
        /^[0-9a-f-]{36}$/i.test(payload.taskId)
      ) {
        taskId = payload.taskId;
      }
      await applyReconcileTask(payload, registry, targeted);
      const completionData = sc.encode(
        JSON.stringify({ status: "success", taskId }),
      );
      nc.publish(`task.done.${taskId}`, completionData);
      await nc.flush();
      msg.ack();
    } catch (err) {
      console.error(`Failed to process task ${taskId ?? "(invalid ID)"}:`, err);
      if (taskId) {
        nc.publish(
          `task.done.${taskId}`,
          sc.encode(JSON.stringify({ status: "failure", taskId })),
        );
        await nc.flush();
      }
      msg.ack();
    } finally {
      release();
    }
  }
}

void processMessages(nodeMessages, true).catch((error) => {
  console.error("Node reconcile consumer failed:", error);
  process.exitCode = 1;
  void nc.close();
});
await processMessages(messages);

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
