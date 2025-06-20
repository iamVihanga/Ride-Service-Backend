import type { ZodError } from 'zod';

import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']),
  DATABASE_URL: z.string().url(),

  // Socket.io configuration
  SOCKET_CORS_ORIGIN: z.string().default('*'),

  // Firebase configuration for push notifications
  FIREBASE_PROJECT_ID: z.string().default('yamu-a89f6'),
  FIREBASE_CLIENT_EMAIL: z.string().default('firebase-adminsdk-fbsvc@yamu-a89f6.iam.gserviceaccount.com'),
  FIREBASE_PRIVATE_KEY: z.string(),
  FIREBASE_DATABASE_URL: z.string().optional(),

  // Google Maps API key for geocoding and distance calculations
  GOOGLE_MAPS_API_KEY: z.string().optional(),

  // Payment gateway configuration
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
});

export type EnvSchema = z.infer<typeof envSchema>;

let env: EnvSchema;

try {
  env = envSchema.parse(process.env);
} catch (e) {
  const error = e as ZodError;
  console.error('❌ Invalid Env.');
  console.error(error.flatten().fieldErrors);
  process.exit(1);
}

export default env;
