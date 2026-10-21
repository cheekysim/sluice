import type {
  Registry,
  Provider,
  RuleDesired,
  CurrentState,
} from "@sluice/core";
import { configSchema, type Config } from "./config.js";

let inMemoryConfig: RuleDesired[] = [
  {
    id: "1",
    domain: "cheekysim.com",
    upstream: { host: "127.0.0.1", port: 80 },
    enabled: true,
  },
  {
    id: "2",
    domain: "cheekysim.com",
    upstream: { host: "127.0.0.1", port: 443 },
    enabled: true,
  },
];

export const nginx: Provider<Config> = {
  type: "nginx",
  name: "Nginx",
  configSchema,
  capabilities: {
    transports: ["tcp", "udp"],
  },
  validate: async (c: Config) => {
    // Validation Logic
  },
  apply: async (delta) => {
    console.log("Apply Config:\n", JSON.stringify(delta, null, 2));
    delta.ops.forEach((op) => {
      if (op.op === "upsert") {
        const existingIndex = inMemoryConfig.findIndex(
          (r) => r.id === op.rule.id,
        );
        if (existingIndex !== -1) {
          inMemoryConfig[existingIndex] = op.rule;
        } else {
          inMemoryConfig.push(op.rule);
        }
      }
      else if (op.op === "delete") {
        inMemoryConfig = inMemoryConfig.filter((r) => r.id !== op.id);
      }
    });
  },
  health: async () => {
    // Health Check Logic
    return true;
  },
  status: async (): Promise<CurrentState> => {
    // Status Logic
    return { rules: inMemoryConfig };
  },
};

export const register = (r: Registry) => {
  r.register(nginx);
};
