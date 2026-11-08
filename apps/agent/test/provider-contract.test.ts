import assert from "node:assert/strict";
import { test } from "node:test";
import { definitions } from "../src/provider-manifest.js";
import { providerDefinitions } from "../src/providers.js";
import {
  advertisementSchema,
  responseSchema,
  validateProviderConfig,
} from "../../web/src/lib/server/provider-schemas.js";

test("all bundled providers satisfy the definition and web schema contract", () => {
  const advertised = providerDefinitions();
  responseSchema.parse({
    agentId: "contract-test",
    providers: advertised,
    providerUpdate: null,
  });
  assert.equal(
    new Set(definitions.map((definition) => definition.type)).size,
    definitions.length,
  );
  for (const definition of definitions) {
    const schema = advertisementSchema.parse(
      advertised.find((item) => item.type === definition.type),
    );
    definition.configSchema.parse(definition.exampleConfig);
    validateProviderConfig(
      { ...schema, implemented: true },
      definition.exampleConfig,
    );
    if (!definition.implemented) continue;
    const provider = definition.create(definition.exampleConfig);
    assert.equal(provider.type, definition.type);
    assert.equal(provider.name, definition.name);
    assert.deepEqual(provider.capabilities, definition.capabilities);
    assert.equal(provider.configSchema, definition.configSchema);
    for (const method of ["validate", "apply", "health", "status"] as const) {
      assert.equal(
        typeof provider[method],
        "function",
        `${definition.type}.${method}`,
      );
    }
  }
});
