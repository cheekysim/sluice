import { computeDelta, reconcile, type Registry } from "@sluice/core";
import { z } from "zod";

const taskSchema = z.object({
  action: z.literal("reconcile"),
  taskId: z.uuid(),
  providers: z.record(z.string(), z.array(z.union([z.number(), z.string()]))),
  rules: z.array(
    z.object({
      id: z.union([z.number(), z.string()]),
      host: z.string(),
      port: z.number(),
      protocol: z.array(z.enum(["TCP", "UDP", "tcp", "udp"])),
    }),
  ),
});

export async function applyReconcileTask(
  input: unknown,
  registry: Registry,
  targeted: boolean,
) {
  const task = taskSchema.parse(input);
  const entries = Object.entries(task.providers).filter(
    ([type, ids]) => targeted || registry.has(type) || ids.length > 0,
  );
  for (const [type, ids] of entries) {
    const provider = registry.get(type);
    if (provider.capabilities.readonly)
      throw new Error(`Provider ${type} does not support reconciliation`);
    const assigned = new Set(ids.map(String));
    const rules = task.rules.filter((rule) => assigned.has(String(rule.id)));
    if (rules.length !== assigned.size)
      throw new Error(`Missing assigned rule for provider ${type}`);
    for (const rule of rules) {
      for (const protocol of rule.protocol) {
        const transport = protocol.toLowerCase() === "tcp" ? "tcp" : "udp";
        if (!provider.capabilities.transports.includes(transport))
          throw new Error(`Provider ${type} does not support ${transport}`);
      }
    }
  }
  for (const [type, ids] of entries) {
    const provider = registry.get(type);
    const assigned = new Set(ids.map(String));
    await reconcile(
      {
        rules: task.rules
          .filter((rule) => assigned.has(String(rule.id)))
          .map((rule) => ({
            ...rule,
            id: String(rule.id),
            protocol: rule.protocol.map((protocol) =>
              protocol.toLowerCase() === "tcp"
                ? ("tcp" as const)
                : ("udp" as const),
            ),
          })),
      },
      provider.status,
      computeDelta,
      provider.apply,
    );
  }
}
