import {
  chmod,
  mkdir,
  readFile,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import { dirname } from "node:path";
import { getPublicIP } from "./utils.js";

export function getPublicAgentDetails(config: Record<string, unknown>) {
  const { agentId, agentName, agentIP, agentVersion } = config;
  return { agentId, agentName, agentIP, agentVersion };
}

export async function updateAgentConfig(
  config: Record<string, unknown>,
  update: { agentName?: string; providers?: unknown; providerUpdate?: unknown },
  configPath = process.env.AGENT_CONFIG_PATH || "/app/config/agent.json",
) {
  const next = { ...config, ...update };
  const temporaryPath = `${configPath}.${crypto.randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, JSON.stringify(next), { mode: 0o600 });
    await rename(temporaryPath, configPath);
  } catch (error) {
    try {
      await unlink(temporaryPath);
    } catch (cleanupError) {
      if (!(
        cleanupError instanceof Error &&
        "code" in cleanupError &&
        cleanupError.code === "ENOENT"
      )) {
        console.error(
          "Failed to remove temporary agent configuration:",
          cleanupError,
        );
      }
    }
    throw error;
  }
  Object.assign(config, next);
}

export async function getAgentConfig(
  configPath = process.env.AGENT_CONFIG_PATH || "/app/config/agent.json",
) {
  let parsed: Record<string, unknown> = {};
  try {
    const config: unknown = JSON.parse(await readFile(configPath, "utf-8"));
    if (!config || typeof config !== "object" || Array.isArray(config)) {
      throw new Error(`Agent configuration at ${configPath} must be an object`);
    }
    parsed = config as Record<string, unknown>;
  } catch (error) {
    if (!(
      error instanceof Error &&
      "code" in error &&
      error.code === "ENOENT"
    )) {
      throw error;
    }
  }

  if (!parsed.agentId) {
    parsed.agentId = process.env.AGENT_ID || crypto.randomUUID();
  }
  if (!parsed.agentVersion) {
    parsed.agentVersion = process.env.AGENT_VERSION || "1.0.0";
  }
  if (!parsed.agentName) {
    parsed.agentName = process.env.AGENT_NAME || "default";
  }

  parsed.agentIP = process.env.AGENT_IP || (await getPublicIP());

  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(configPath, JSON.stringify(parsed), { mode: 0o600 });
  await chmod(configPath, 0o600);
  return parsed;
}
