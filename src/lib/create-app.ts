import { OpenAPIHono } from '@hono/zod-openapi';
import { notFound, onError, serveEmojiFavicon } from 'stoker/middlewares';
import { defaultHook } from 'stoker/openapi';

import { logger } from '@/middlewares/pino-logger';

import { auth } from './auth';

export const createRouter = function (): OpenAPIHono<AppBindings> {
  return new OpenAPIHono<AppBindings>({
    strict: false,
    defaultHook,
  });
};

export default function createApp(): OpenAPIHono<AppBindings> {
  const app = createRouter().basePath('/api');

  // Middleware
  app.use(serveEmojiFavicon('🚀'));
  app.use(logger());

  // -------------------------------------------------
  // Better auth Authentication Middleware
  app.use('*', async (c, next) => {
    try {
      const session = await auth.api.getSession({ headers: c.req.raw.headers });

      if (!session) {
        c.set('user', null);
        c.set('session', null);
        return next();
      }

      c.set('user', session.user);
      c.set('session', session.session);
      return next();
    } catch (error) {
      console.error('Auth middleware error:', error);
      c.set('user', null);
      c.set('session', null);
      return next();
    }
  });

  app.on(['POST', 'GET'], '/auth/*', (c) => {
    return auth.handler(c.req.raw);
  });
  // -------------------------------------------------

  // Error Handelling Middleware with better stack overflow handling
  app.onError((err, c) => {
    console.error('Application error:', err);

    if (err.message?.includes('Maximum call stack size exceeded')) {
      return c.json(
        {
          message: 'Internal server error - circular reference detected',
          error: 'STACK_OVERFLOW'
        },
        500
      );
    }

    return onError(err, c);
  });

  // Not Found Handelling Middleware
  app.notFound(notFound);

  return app;
}
