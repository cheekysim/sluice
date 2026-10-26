import type {
  Registry,
  Provider,
  RuleDesired,
  CurrentState,
  DeployedDelta,
} from "@sluice/core";

import { execa } from "execa";
import { mkdir, writeFile, readFile, rename, rm } from "node:fs/promises";
import { join } from "node:path";

import { z } from "zod";

export const ConfigSchema = z.object({
  configDir: z.string().min(1).default("/etc/nginx/streams-enabled"),
  reloadCmd: z.string().min(1).default("nginx -s reload"),
});

export type Config = z.infer<typeof ConfigSchema>;

const defaultConfig: Config = {
  configDir: "/opt/nginx/streams-enabled",
  reloadCmd: "nginx -s reload",
};

const paths = (cfg: Config) => ({
  dispatchFile: join(cfg.configDir, "sluice.conf"),
  staging: join(cfg.configDir, "sluice.conf.staging"),
});

const RULE_MARKER = /^#\s*sluice:rule\s+id=(\S+)\s*$/;
const SERVER_BLOCK =
  /server\s*\{\s*listen\s+(\d+)(\s+udp)?\s*;\s*proxy_pass\s+([^\s:;]+):(\d+)\s*;/;

// Convert RuleDesired[] to nginx config
function renderModel(rules: RuleDesired[]): string {
  return rules
    .map((r) => {
      const protocol = r.upstream.protocol; // ["tcp", "udp"]
      const { host, port } = r.upstream;
      const lines = [`# sluice:rule id=${r.id}`];
      if (protocol.includes("tcp")) {
        lines.push(
          `server { listen ${port}; proxy_pass ${host}:${port}; }`,
        );
      }
      if (protocol.includes("udp")) {
        lines.push(
          `server { listen ${port} udp; proxy_pass ${host}:${port}; }`,
        );
      }
      return lines.join("\n");
    })
    .join("\n");
}

// Convert nginx config to RuleDesired[]
function parseConfig(content: string): RuleDesired[] {
  const rules = new Map<string, RuleDesired>();
  let current: { id: string } | undefined;

  for (const raw of content.split("\n")) {
    const line = raw.trim();
    const marker = RULE_MARKER.exec(line);
    if (marker) {
      current = { id: marker[1] };
      continue;
    }
    const block = SERVER_BLOCK.exec(line);
    if (!block || !current) continue;

    const [, , udp, host, upstreamPort] = block;
    const protocol = udp ? "udp" : "tcp";
    const existing = rules.get(current.id);
    if (existing) {
      if (!existing.upstream.protocol.includes(protocol)) {
        existing.upstream.protocol.push(protocol);
      }
    } else {
      rules.set(current.id, {
        id: current.id,
        upstream: { host, port: Number(upstreamPort), protocol: [protocol] },
      });
    }
  }

  return [...rules.values()];
}

// Apply a delta on top of the rules currently on disk
async function mergeRules(
  file: string,
  delta: DeployedDelta,
): Promise<RuleDesired[]> {
  const content = await readFile(file, "utf-8").catch(() => "");
  const rules = new Map(parseConfig(content).map((r) => [r.id, r]));
  for (const op of delta.ops) {
    if (op.op === "upsert") rules.set(op.rule.id, op.rule);
    else rules.delete(op.id);
  }
  return [...rules.values()];
}

export const nginx: Provider<Config> = {
  type: "nginx",
  name: "Nginx",
  configSchema: ConfigSchema,
  capabilities: {
    transports: ["tcp", "udp"],
  },
  validate: async (delta: DeployedDelta) => {
    console.log("Validate Config:", JSON.stringify(delta, null, 2));
    const { dispatchFile, staging } = paths(defaultConfig);
    const rendered = renderModel(await mergeRules(dispatchFile, delta));
    await mkdir(defaultConfig.configDir, { recursive: true });
    await writeFile(staging, rendered);
    try {
      await execa("nginx", ["-t", "-c", staging]);
    } catch (err) {
      throw new Error(`Validation failed: ${err}`);
    } finally {
      await rm(staging, { force: true });
    }
  },
  apply: async (delta: DeployedDelta) => {
    console.log("Apply Config:", JSON.stringify(delta, null, 2));
    const { dispatchFile } = paths(defaultConfig);
    const rendered = renderModel(await mergeRules(dispatchFile, delta));
    await mkdir(defaultConfig.configDir, { recursive: true });
    const tmp = `${dispatchFile}.tmp`;
    await writeFile(tmp, rendered);
    await rename(tmp, dispatchFile);
    // const [cmd, ...args] = defaultConfig.reloadCmd.split(" ");
    // await execa(cmd, args);
  },
  health: async () => {
    return (
      (await execa("nginx", ["-t"]).catch(() => ({ exitCode: 1 }))).exitCode ===
      0
    );
  },
  status: async (): Promise<CurrentState> => {
    const { dispatchFile } = paths(defaultConfig);
    const content = await readFile(dispatchFile, "utf-8").catch(() => "");
    return { rules: parseConfig(content) };
  },
};

export const register = (r: Registry) => {
  r.register(nginx);
};
