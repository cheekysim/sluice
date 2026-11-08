import { createHash } from "node:crypto";
import { AckPolicy, NatsError, StringCodec, type NatsConnection } from "nats";
import { updateAgentConfig } from "./config.js";
import { createProviderRegistry, providerDefinitions } from "./providers.js";
import type { Registry } from "@sluice/core";

const codec = StringCodec();

export async function consumeConfigUpdates(
  nc: NatsConnection,
  config: Record<string, unknown>,
  options: {
    stream?: string;
    subjectPrefix?: string;
    configPath?: string;
    signal?: AbortSignal;
    onProviders?: (registry: Registry) => void;
  } = {},
) {
  if (typeof config.agentId !== "string" || !config.agentId) {
    throw new Error("Agent configuration must contain a valid agentId");
  }
  const token = createHash("sha256").update(config.agentId).digest("hex");
  const streamName = options.stream ?? "AGENT_CONFIG";
  const subjectPrefix = options.subjectPrefix ?? "agent.config";
  const subject = `${subjectPrefix}.${token}`;
  const durable = `config-${token}`;
  const jsm = await nc.jetstreamManager();

  try {
    const stream = await jsm.streams.info(streamName);
    if (!stream.config.subjects?.includes(`${subjectPrefix}.>`)) {
      throw new Error(
        `JetStream stream "${streamName}" must include "${subjectPrefix}.>"`,
      );
    }
  } catch (error) {
    if (!(error instanceof NatsError) || error.api_error?.code !== 404)
      throw error;
    try {
      await jsm.streams.add({
        name: streamName,
        subjects: [`${subjectPrefix}.>`],
      });
    } catch (addError) {
      let stream;
      try {
        stream = await jsm.streams.info(streamName);
      } catch (verifyError) {
        if (
          verifyError instanceof NatsError &&
          verifyError.api_error?.code === 404
        )
          throw addError;
        throw verifyError;
      }
      if (!stream.config.subjects?.includes(`${subjectPrefix}.>`)) {
        throw new Error(
          `JetStream stream "${streamName}" must include "${subjectPrefix}.>"`,
        );
      }
    }
  }

  try {
    const consumer = await jsm.consumers.info(streamName, durable);
    if (
      consumer.config.filter_subject !== subject ||
      consumer.config.max_ack_pending !== 1 ||
      consumer.config.ack_policy !== AckPolicy.Explicit
    ) {
      throw new Error(`Invalid JetStream configuration consumer ${durable}`);
    }
  } catch (error) {
    if (!(error instanceof NatsError) || error.api_error?.code !== 404)
      throw error;
    await jsm.consumers.add(streamName, {
      durable_name: durable,
      filter_subject: subject,
      ack_policy: AckPolicy.Explicit,
      max_ack_pending: 1,
    });
  }

  const consumer = await nc.jetstream().consumers.get(streamName, durable);
  const messages = await consumer.consume();
  const stop = () => messages.stop();
  options.signal?.addEventListener("abort", stop, { once: true });
  if (options.signal?.aborted) stop();
  try {
    for await (const msg of messages) {
      let update: unknown;
      let nextRegistry: Registry | undefined;
      let updateId: string | undefined;
      try {
        update = JSON.parse(codec.decode(msg.data));
        if (
          !update ||
          typeof update !== "object" ||
          !("agentId" in update) ||
          update.agentId !== config.agentId ||
          !("agentName" in update) ||
          typeof update.agentName !== "string" ||
          !update.agentName.trim() ||
          update.agentName !== update.agentName.trim() ||
          update.agentName.length > 100
        ) {
          throw new Error("Invalid agent configuration update");
        }
        if ("updateId" in update) {
          if (
            typeof update.updateId !== "string" ||
            !/^[0-9a-f-]{36}$/.test(update.updateId)
          ) {
            throw new Error("Invalid configuration update ID");
          }
          updateId = update.updateId;
        }
        if ("providers" in update) {
          if (updateId) {
            if (
              !("schemaVersions" in update) ||
              !update.schemaVersions ||
              typeof update.schemaVersions !== "object" ||
              Array.isArray(update.schemaVersions)
            ) {
              throw new Error("Missing provider schema versions");
            }
            const versions = update.schemaVersions as Record<string, unknown>;
            const definitions = providerDefinitions();
            if (
              !update.providers ||
              typeof update.providers !== "object" ||
              Array.isArray(update.providers)
            )
              throw new Error("Invalid provider settings");
            for (const type of Object.keys(update.providers)) {
              const definition = definitions.find(
                (entry) => entry.type === type,
              );
              if (!definition || versions[type] !== definition.version)
                throw new Error(`Provider schema changed: ${type}`);
            }
          }
          nextRegistry = createProviderRegistry(update.providers);
        }
      } catch (error) {
        console.error("Rejecting invalid agent configuration update:", error);
        if (updateId) {
          try {
            await updateAgentConfig(
              config,
              {
                providerUpdate: {
                  id: updateId,
                  status: "failed",
                  message:
                    error instanceof Error &&
                    error.message.startsWith("Provider schema changed:")
                      ? error.message
                      : "Agent rejected provider configuration. Review settings and agent logs.",
                },
              },
              options.configPath,
            );
            msg.ack();
          } catch (persistError) {
            console.error(
              "Failed to persist provider update status:",
              persistError,
            );
            msg.nak(5000);
          }
          continue;
        }
        msg.term();
        continue;
      }
      try {
        await updateAgentConfig(
          config,
          {
            agentName: update.agentName,
            ...("providers" in update ? { providers: update.providers } : {}),
            ...(updateId
              ? { providerUpdate: { id: updateId, status: "applied" } }
              : {}),
          },
          options.configPath,
        );
        if (nextRegistry) options.onProviders?.(nextRegistry);
        msg.ack();
      } catch (error) {
        console.error("Failed to persist agent configuration update:", error);
        msg.nak(5000);
      }
    }
  } finally {
    options.signal?.removeEventListener("abort", stop);
    messages.stop();
  }
}
