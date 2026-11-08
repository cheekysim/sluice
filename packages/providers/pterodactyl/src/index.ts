import type { Provider, ProviderDefinition } from "@sluice/core";
import { z } from "zod";

export const configSchema = z.object({
  baseUrl: z.url(),
  apiKey: z.string().trim().min(1).meta({ secret: true }),
  timeoutSeconds: z.number().positive(),
});

export type Config = z.infer<typeof configSchema>;
const capabilities = {
  transports: ["tcp", "udp"],
} satisfies ProviderDefinition["capabilities"];

export const createPterodactyl = (input: unknown): Provider<Config> => {
  configSchema.parse(input);
  return {
    type: "pterodactyl",
    name: "Pterodactyl Panel",
    configSchema,
    capabilities,
    validate: async () => {
      throw new Error("Pterodactyl provider is not implemented");
    },
    apply: async () => {
      throw new Error("Pterodactyl provider is not implemented");
    },
    health: async () => {
      return false;
    },
    status: async () => {
      throw new Error("Pterodactyl provider is not implemented");
    },
  };
};

export const providerDefinition: ProviderDefinition = {
  type: "pterodactyl",
  name: "Pterodactyl Panel",
  implemented: false,
  capabilities,
  configSchema,
  exampleConfig: {
    baseUrl: "https://example.com",
    apiKey: "example",
    timeoutSeconds: 30,
  },
  create: createPterodactyl,
};
