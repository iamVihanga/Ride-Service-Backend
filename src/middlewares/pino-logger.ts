import { pinoLogger } from "hono-pino";
import pino from "pino";
import pretty from "pino-pretty";

import env from "@/env";

function generateRequestId(): string {
  return `${crypto.randomUUID()}`;
}

export function logger() {
  return pinoLogger({
    pino: pino(
      {
        level: env.LOG_LEVEL || "info",
      },
      // eslint-disable-next-line style/comma-dangle
      env.NODE_ENV === "production" ? undefined : pretty()
    ),
    http: {
      referRequestIdKey: generateRequestId(),
    },
  });
}
