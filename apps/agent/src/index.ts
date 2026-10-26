import type { RuleDesired } from "@sluice/core";
import { reconcile, registry, computeDelta } from "@sluice/core";

import { register as pterodactyl } from "@sluice/provider-pterodactyl";
import { register as nginx } from "@sluice/provider-nginx";

registry.load({ register: pterodactyl });
registry.load({ register: nginx });
// console.log(registry.list());

console.log("Reconcile Test: ");
const nginxProvider = registry.get("nginx");
console.log(nginxProvider);

const testRules: RuleDesired[] = [
  {
    id: "1",
    upstream: { host: "10.0.10.30", port: 80, protocol: ["tcp"] },
  },
  {
    id: "2",
    upstream: { host: "10.0.10.30", port: 443, protocol: ["tcp"] },
  },
  {
    id: "3",
    upstream: { host: "10.0.10.30", port: 25565, protocol: ["tcp"] },
  },
];

console.log("Current State: ");
console.log(JSON.stringify(await nginxProvider.status(), null, 2));

await reconcile(
  {
    rules: testRules,
  },
  nginxProvider.status,
  computeDelta,
  nginxProvider.apply,
);

console.log("Reconcile Complete");
console.log("Current State: ");
console.log(JSON.stringify(await nginxProvider.status(), null, 2));
