import type { OpenAPIHono } from '@hono/zod-openapi';
import type { PinoLogger } from 'hono-pino';

import { SelectDriver } from '@/db/schema';
import { auth } from '@/lib/auth';

declare global {
  type UserWithDriver = typeof auth.$Infer.Session.user & {
    driver?: SelectDriver;
  };

  // This is the global type declaration file for the Hono framework
  interface AppBindings {
    Variables: {
      logger: PinoLogger;
      user: UserWithDriver | null;
      session: typeof auth.$Infer.Session.session | null;
    };
  }

  type AppOpenAPI = OpenAPIHono<AppBindings>;
}
