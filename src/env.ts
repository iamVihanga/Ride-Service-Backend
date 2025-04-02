import type { ZodError } from "zod";

import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]),
});

export type EnvSchema = z.infer<typeof envSchema>;

// eslint-disable-next-line import/no-mutable-exports
let env: EnvSchema;

try {
  // eslint-disable-next-line node/no-process-env
  env = envSchema.parse(process.env);

  // eslint-disable-next-line style/brace-style
} catch (e) {
  const error = e as ZodError;
  console.error("❌ Invalid Env.");
  console.error(error.flatten().fieldErrors);
  process.exit(1);
}

export default env;
