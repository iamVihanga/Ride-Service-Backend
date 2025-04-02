import type { OpenAPIHono } from "@hono/zod-openapi";
import type { PinoLogger } from "hono-pino";

declare global {
  // This is the global type declaration file for the Hono framework
  interface AppBindings {
    Variables: {
      logger: PinoLogger;
    };
  }

  type AppOpenAPI = OpenAPIHono<AppBindings>;
}
