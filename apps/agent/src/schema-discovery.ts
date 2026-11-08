import { createHash } from "node:crypto";
import { StringCodec, type NatsConnection } from "nats";
import { providerDefinitions } from "./providers.js";

export function listenForProviderSchemas(
  nc: NatsConnection,
  config: Record<string, unknown>,
) {
  if (typeof config.agentId !== "string" || !config.agentId)
    throw new Error("Invalid agent ID");
  const agentId = config.agentId;
  const subject = `agent.schemas.${createHash("sha256").update(agentId).digest("hex")}`;
  const subscription = nc.subscribe(subject);
  const codec = StringCodec();
  const done = (async () => {
    for await (const query of subscription) {
      query.respond(
        codec.encode(
          JSON.stringify({
            agentId,
            providers: providerDefinitions(),
            providerUpdate: config.providerUpdate ?? null,
          }),
        ),
      );
    }
  })();
  return { subscription, done };
}
