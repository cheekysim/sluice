import { z } from "zod";

export const configSchema = z.object({
  baseUrl: z.url(),
  apiKey: z.string().min(1),
  timeoutSeconds: z.number().positive(),
});

export type Config = z.infer<typeof configSchema>;
