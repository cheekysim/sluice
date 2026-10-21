import type { Registry, Provider } from "@sluice/core";
import { configSchema, type Config } from "./config.js";

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
