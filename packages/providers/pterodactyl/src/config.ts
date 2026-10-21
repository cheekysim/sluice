import { z } from "zod";

export const configSchema = z.object({
  baseUrl: z.string(),
  apiKey: z.string(),
  timeoutSeconds: z.number(),
});

export type Config = z.infer<typeof configSchema>;
