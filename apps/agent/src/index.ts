import { reconcile, registry, computeDelta } from "@sluice/core";

import { register as pterodactyl } from "@sluice/provider-pterodactyl";
import { register as nginx } from "@sluice/provider-nginx";

registry.load({ register: pterodactyl });
registry.load({ register: nginx });
// console.log(registry.list());

console.log("Reconcile Test: ");
const nginxProvider = registry.get("nginx");
console.log(nginxProvider);

const testRules = [
  {
    id: "1",
    domain: "cheekysim.com",
    upstream: { host: "127.0.0.1", port: 80 },
    enabled: true,
  },
  {
    id: "2",
    domain: "cheekysim.com",
    upstream: { host: "127.0.0.1", port: 443 },
    enabled: true,
  },
  {
    id: "3",
    domain: "cheekysim.com",
    upstream: { host: "127.0.0.1", port: 8080 },
    enabled: true,
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

await reconcile(
  {
    rules: testRules,
  },
  nginxProvider.status,
  computeDelta,
  nginxProvider.apply,
);

console.log("Reconcile 2 Complete");

console.log("Current State: ");
console.log(JSON.stringify(await nginxProvider.status(), null, 2));

await reconcile(
  {
    rules: [
      {
        id: "1",
        domain: "cheekysim.com",
        upstream: { host: "127.0.0.1", port: 80 },
        enabled: false,
      },
      {
        id: "2",
        domain: "cheekysim.com",
        upstream: { host: "127.0.0.1", port: 443 },
        enabled: true,
      },
      {
        id: "3",
        domain: "cheekysim.com",
        upstream: { host: "127.0.0.1", port: 8080 },
        enabled: true,
      },
    ],
  },
  nginxProvider.status,
  computeDelta,
  nginxProvider.apply,
);

console.log("Reconcile 3 Complete");

console.log("Current State: ");
console.log(JSON.stringify(await nginxProvider.status(), null, 2));
