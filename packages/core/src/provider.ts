import { z } from "zod";
import type { CurrentState, DeployedDelta } from "./reconcile.js";

export interface Capabilities {
  transports: ("tcp" | "udp")[];
  readonly?: boolean;
}

export interface Provider<TConfig extends object> {
  readonly type: string;
  readonly name: string;

  readonly configSchema: z.ZodType<TConfig>;
  readonly capabilities: Capabilities;

  validate(delta: DeployedDelta): Promise<void>;
  apply(delta: DeployedDelta): Promise<void>;
  status(): Promise<CurrentState>;
  health(): Promise<boolean>;
}

export interface ProviderDefinition {
  readonly type: string;
  readonly name: string;
  readonly implemented: boolean;
  readonly capabilities: Capabilities;
  readonly configSchema: z.ZodObject;
  readonly exampleConfig: Record<string, unknown>;
  create(config: unknown): Provider<object>;
}

export interface ProviderSchemaV<TConfig> {
  version: number;
  schema: z.ZodType<TConfig>;
}
