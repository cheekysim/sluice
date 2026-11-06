import type { Registry, Provider } from "@sluice/core";
import { z } from "zod";

export const configSchema = z.object({
  baseUrl: z.url(),
  apiKey: z.string().min(1),
  timeoutSeconds: z.number().positive(),
});

export type Config = z.infer<typeof configSchema>;

const defaultConfig: Config = {
  baseUrl: "https://panel.cheekysim.com",
  apiKey: "",
  timeoutSeconds: 30,
};

export const pterodactyl: Provider<Config> = {
  type: "pterodactyl",
  name: "Pterodactyl Panel",
  configSchema,
  capabilities: {
    transports: ["tcp", "udp"],
  },
  validate: async (c: Config) => {
    // Validation Logic
  },
  apply: async (c: Config) => {
    // Apply Logic
  },
  health: async () => {
    // Health Check Logic
    return true;
  },
  status: async () => {
    // Status Logic
    return "ok";
  },
};

export const register = (r: Registry) => {
  r.register(pterodactyl);
};
