import { registry } from "@sluice/core";
import { register as pterodactyl } from "@sluice/provider-pterodactyl";

registry.load({ register: pterodactyl });
console.log(registry.list());
