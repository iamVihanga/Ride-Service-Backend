import type { OpenAPIHono } from '@hono/zod-openapi';
import type { PinoLogger } from 'hono-pino';

import { auth } from '@/lib/auth';

declare global {
  // This is the global type declaration file for the Hono framework
  interface AppBindings {
    Variables: {
      logger: PinoLogger;
      user: typeof auth.$Infer.Session.user | null;
      session: typeof auth.$Infer.Session.session | null;
    };
  }

  type AppOpenAPI = OpenAPIHono<AppBindings>;
}
