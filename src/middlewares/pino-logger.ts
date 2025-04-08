import { pinoLogger } from 'hono-pino';
import pino from 'pino';
import pretty from 'pino-pretty';

import env from '@/env';

export const generateRequestId = function (): string {
  return `${crypto.randomUUID()}`;
};

export const logger = function () {
  return pinoLogger({
    pino: pino(
      {
        level: env.LOG_LEVEL || 'info',
      },
      env.NODE_ENV === 'production' ? undefined : pretty()
    ),
    http: {
      referRequestIdKey: generateRequestId(),
    },
  });
};
