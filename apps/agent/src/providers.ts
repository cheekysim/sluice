import { z } from "zod";
import { createHash } from "node:crypto";
import { Registry } from "@sluice/core";
import { definitions } from "./provider-manifest.js";

export type ProviderSettings = Record<
  string,
  { enabled: boolean; config: Record<string, unknown> }
>;
export const defaultProviderSettings: ProviderSettings = {
  nginx: { enabled: true, config: {} },
};

export function providerDefinitions() {
  return definitions.map(
    ({ type, name, configSchema, implemented, capabilities }) => {
      const jsonSchema = z.toJSONSchema(configSchema, { io: "input" });
      const version = createHash("sha256")
        .update(JSON.stringify({ type, implemented, schema: jsonSchema }))
        .digest("hex");
      return {
        type,
        name,
        implemented,
        capabilities,
        schema: jsonSchema,
        version,
      };
    },
  );
}

export function validateProviderSettings(input: unknown): ProviderSettings {
  const parsed = z
    .record(
      z.string(),
      z
        .object({
          enabled: z.boolean(),
          config: z.record(z.string(), z.unknown()),
        })
        .strict(),
    )
    .parse(input);
  for (const [type, setting] of Object.entries(parsed)) {
    const definition = definitions.find((item) => item.type === type);
    if (!definition) throw new Error(`Unknown provider: ${type}`);
    const allowed = Object.keys(definition.configSchema.shape);
    if (Object.keys(setting.config).some((key) => !allowed.includes(key)))
      throw new Error(`Unknown configuration field for ${type}`);
    if (setting.enabled) {
      if (!definition.implemented)
        throw new Error(`${definition.name} is not implemented`);
      definition.configSchema.parse(setting.config);
    }
  }
  return parsed;
}

export function createProviderRegistry(settings: unknown): Registry {
  const parsed = validateProviderSettings(settings);
  const registry = new Registry();
  for (const definition of definitions) {
    const setting = parsed[definition.type];
    if (setting?.enabled) {
      const provider = definition.create(setting.config);
      if (
        provider.type !== definition.type ||
        provider.name !== definition.name ||
        provider.configSchema !== definition.configSchema ||
        JSON.stringify(provider.capabilities) !==
          JSON.stringify(definition.capabilities)
      )
        throw new Error(
          `Provider ${definition.type} returned inconsistent metadata`,
        );
      registry.register(provider);
    }
  }
  return registry;
}
