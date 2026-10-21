import { z } from "zod";

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
  apply(config: TConfig): Promise<void>;
  status(): Promise<unknown>;
  health(): Promise<boolean>;
}

export interface ProviderSchemaV<TConfig> {
  version: number;
  schema: z.ZodType<TConfig>;
}
