import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const type = process.argv[2];
const name = process.argv.slice(3).join(" ");
if (
  !type ||
  !/^[a-z][a-z0-9-]{0,62}$/.test(type) ||
  !name ||
  name.length > 100
) {
  throw new Error(
    'Usage: pnpm create:provider <lowercase-type> "<display name>"',
  );
}
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dir = resolve(root, "packages/providers", type);
await mkdir(dir);
await mkdir(resolve(dir, "src"));
await writeFile(
  resolve(dir, "package.json"),
  JSON.stringify(
    {
      name: `@sluice/provider-${type}`,
      version: "1.0.0",
      private: true,
      type: "module",
      scripts: { check: "tsc --noEmit" },
      exports: { ".": "./src/index.ts" },
      dependencies: { "@sluice/core": "workspace:*", zod: "^4.6.7" },
      devDependencies: { typescript: "^7.0.2" },
    },
    null,
    2,
  ) + "\n",
  { flag: "wx" },
);
await writeFile(
  resolve(dir, "tsconfig.json"),
  JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        module: "nodenext",
        moduleResolution: "nodenext",
        strict: true,
        skipLibCheck: true,
        noEmit: true,
      },
      include: ["src/**/*"],
    },
    null,
    2,
  ) + "\n",
  { flag: "wx" },
);
await writeFile(
  resolve(dir, "src/index.ts"),
  `import type { ProviderDefinition } from "@sluice/core";
import { z } from "zod";

const configSchema = z.object({});
const capabilities: ProviderDefinition["capabilities"] = { transports: ["tcp", "udp"] };

export const providerDefinition: ProviderDefinition = {
  type: ${JSON.stringify(type)},
  name: ${JSON.stringify(name)},
  implemented: false,
  configSchema,
  exampleConfig: {},
  capabilities,
  create(input) {
    configSchema.parse(input);
    throw new Error("Provider ${type} is not implemented");
  },
};
`,
  { flag: "wx" },
);
console.log(
  `Created ${dir}. Run pnpm install, implement the provider, and set implemented to true.`,
);
