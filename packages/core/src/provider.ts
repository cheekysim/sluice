import { z } from "zod";
import type { DeployedDelta, CurrentState } from "./reconcile.js";

export interface Capabilities {
  transports: ("tcp" | "udp" | "tls" | "url-prefix")[];
  readonly?: boolean;
}

export interface Provider<TConfig extends object> {
  readonly type: string;
  readonly name: string;

  readonly configSchema: z.ZodType<TConfig>;
  readonly capabilities: Capabilities;

  validate(config: TConfig): Promise<void>;
  apply(delta: DeployedDelta): Promise<void>;
  status(): Promise<CurrentState>;
  health(): Promise<boolean>;
}

export interface ProviderSchemaV<TConfig> {
  version: number;
  schema: z.ZodType<TConfig>;
}
