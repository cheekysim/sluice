import { Provider, ProviderSchemaV } from "./provider.js";

export class ProviderNotFoundError extends Error {
  constructor(readonly providerType: string) {
    super(`Unknown provider type: ${providerType}`);
  }
}

type AnyProvider = Provider<object>;

export class Registry {
  private entries = new Map<string, AnyProvider>();
  private schemas = new Map<string, ProviderSchemaV<object>[]>();

  register(p: AnyProvider, version = 1): void {
    if (this.entries.has(p.type)) {
      throw new Error(`Provider type ${p.type} already registered`);
    }
    this.entries.set(p.type, p);
    this.schemas.set(p.type, [
      ...(this.schemas.get(p.type) ?? []),
      { version, schema: p.configSchema },
    ]);
  }

  get(type: string): AnyProvider {
    const p = this.entries.get(type);
    if (!p) {
      throw new ProviderNotFoundError(type);
    }
    return p;
  }

  has(type: string): boolean {
    return this.entries.has(type);
  }

  list(): AnyProvider[] {
    return [...this.entries.values()];
  }

  load(plugin: { register: (r: Registry) => void }): void {
    // TODO: Check if plugin is enabled
    plugin.register(this);
  }
}

export const registry = new Registry();
