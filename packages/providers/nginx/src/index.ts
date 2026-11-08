import type {
  Registry,
  Provider,
  RuleDesired,
  CurrentState,
  DeployedDelta,
  ProviderDefinition,
} from "@sluice/core";

import { execa } from "execa";
import { mkdir, writeFile, readFile, rename, rm } from "node:fs/promises";
import { join } from "node:path";

import { z } from "zod";

export const ConfigSchema = z.object({
  configDir: z.string().trim().min(1).default("/app/providers/nginx"),
  reloadCmd: z.string().trim().min(1).default("nginx -s reload"),
  startCmd: z.string().trim().min(1).default("nginx"),
  testCmd: z
    .string()
    .trim()
    .min(1)
    .describe(
      "Validation command; the generated test configuration path is appended.",
    )
    .default("nginx -t -c"),
});

export type Config = z.infer<typeof ConfigSchema>;
const capabilities = {
  transports: ["tcp", "udp"],
} satisfies ProviderDefinition["capabilities"];

// Helper function
const paths = (cfg: Config) => ({
  dispatchFile: join(cfg.configDir, "sluice.conf"),
  staging: join(cfg.configDir, "sluice.conf.staging"),
});

// Regex patterns
const RULE_MARKER = /^#\s*sluice:rule\s+id=(\S+)\s*$/;
const SERVER_BLOCK =
  /server\s*\{\s*listen\s+(\d+)(\s+udp)?\s*;\s*proxy_pass\s+([^\s:;]+):(\d+)\s*;/;

async function readRulesFile(file: string): Promise<string> {
  try {
    return await readFile(file, "utf-8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT")
      return "";
    throw error;
  }
}

// Convert RuleDesired[] to nginx config
function renderModel(rules: RuleDesired[]): string {
  return rules
    .map((r) => {
      const { host, port } = r;
      const protocol = r.protocol.map((p) => p.toLowerCase());
      const lines = [`# sluice:rule id=${r.id}`];
      if (protocol.includes("tcp")) {
        lines.push(`server { listen ${port}; proxy_pass ${host}:${port}; }`);
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

    const [, , udp, host, port] = block;
    const protocol = udp ? "udp" : "tcp";
    const existing = rules.get(current.id);
    if (existing) {
      if (!existing.protocol.includes(protocol)) {
        existing.protocol.push(protocol);
      }
    } else {
      rules.set(current.id, {
        id: current.id,
        host,
        port: Number(port),
        protocol: [protocol],
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
  const content = await readRulesFile(file);
  const rules = new Map(parseConfig(content).map((r) => [r.id, r]));
  for (const op of delta.ops) {
    if (op.op === "upsert") rules.set(op.rule.id, op.rule);
    else rules.delete(op.id);
  }
  return [...rules.values()];
}

// Create and test staging config
async function stageConfig(
  delta: DeployedDelta,
  config: Config,
): Promise<string> {
  const { dispatchFile, staging } = paths(config);
  const rendered = renderModel(await mergeRules(dispatchFile, delta));
  await mkdir(config.configDir, { recursive: true });
  await writeFile(staging, rendered);
  const testId = crypto.randomUUID();
  const mockNginxFile = join(config.configDir, `sluice-test-${testId}.conf`);
  const testPidFile = join(config.configDir, `sluice-test-${testId}.pid`);
  const mockNginxBlock = `pid ${testPidFile}; load_module /usr/lib/nginx/modules/ngx_stream_module.so; events {} stream { include ${staging}; }`;
  await writeFile(mockNginxFile, mockNginxBlock);
  try {
    const [testBin, ...testArgs] = config.testCmd.split(" ");
    await execa(testBin, [...testArgs, mockNginxFile]);
    return staging;
  } catch (err) {
    await rm(staging, { force: true });
    throw new Error(`Validation failed: ${err}`);
  } finally {
    await rm(testPidFile, { force: true });
    await rm(mockNginxFile, { force: true });
  }
}

export const createNginx = (input: Partial<Config> = {}): Provider<Config> => {
  const config = ConfigSchema.parse(input);
  return {
    type: "nginx",
    name: "Nginx",
    configSchema: ConfigSchema,
    capabilities,
    validate: async (delta: DeployedDelta) => {
      const staging = await stageConfig(delta, config);
      await rm(staging, { force: true });
    },
    apply: async (delta: DeployedDelta) => {
      const staging = await stageConfig(delta, config);
      const { dispatchFile } = paths(config);
      await rename(staging, dispatchFile);
      const [cmd, ...args] = config.reloadCmd.split(" ");
      try {
        await execa(cmd, args);
      } catch (err) {
        // Reload fails when nginx isn't running yet (no pid file); start it instead
        const [startBin, ...startArgs] = config.startCmd.split(" ");
        console.warn(`Reload failed, starting nginx: ${err}`);
        await execa(startBin, startArgs);
      }
    },
    health: async () => {
      return (
        (await execa("nginx", ["-t"]).catch(() => ({ exitCode: 1 })))
          .exitCode === 0
      );
    },
    status: async (): Promise<CurrentState> => {
      const { dispatchFile } = paths(config);
      const content = await readRulesFile(dispatchFile);
      return { rules: parseConfig(content) };
    },
  };
};

export const register =
  (input: Partial<Config> = {}) =>
  (r: Registry) => {
    r.register(createNginx(input));
  };

export const providerDefinition: ProviderDefinition = {
  type: "nginx",
  name: "Nginx",
  implemented: true,
  capabilities,
  configSchema: ConfigSchema,
  exampleConfig: {},
  create: (config) => createNginx(ConfigSchema.parse(config)),
};
