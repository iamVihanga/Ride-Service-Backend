import env from '@/env';
import createApp from '@/lib/create-app';
import configureOpenAPI from '@/lib/open-api-config';
import bids from '@/routes/bids/bids.index';
import drivers from '@/routes/drivers/drivers.index';
import index from '@/routes/index.route';
import payments, { methodsRouter, promoCodesRouter } from '@/routes/payments/payments.index';
import trips from '@/routes/trips/trips.index';
import vehicles from '@/routes/vehicles/vehicles.index';

const app = createApp();

configureOpenAPI(app);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _app = app
  .route('/', index)
  // .route('/tasks', tasks)
  .route('/drivers', drivers)
  .route('/vehicles', vehicles)
  .route('/payments', payments)
  .route('/payment-methods', methodsRouter)
  .route('/promo-codes', promoCodesRouter)
  .route('/bids', bids)
  .route('/trips', trips);

export type AppType = typeof _app;

// Create HTTP server for Socket.io
import { initializeSocketService } from '@/modules/socket/socket-service';
import { createServer } from 'http';

// Create HTTP server and initialize Socket.io
const server = createServer((req, res) => {
  // Use an immediately invoked async function
  (async () => {
    try {
      const response = await app.fetch(req as any, { ip: req.socket.remoteAddress || '' as any });

      res.writeHead(response.status, Object.fromEntries(response.headers.entries()));

      if (response.body) {
        await response.body.pipeTo(
          new WritableStream({
            write(chunk) {
              res.write(chunk);
            },
            close() {
              res.end();
            },
          })
        );
      } else {
        res.end();
      }
    } catch (error) {
      console.error('Request handling error:', error);
      res.writeHead(500);
      res.end('Internal Server Error');
    }
  })();
});

// Initialize Socket.io
const socketService = initializeSocketService(server);

export default {
  port: env.PORT,
  fetch: app.fetch,
  server: server, // Export server for direct usage
};
