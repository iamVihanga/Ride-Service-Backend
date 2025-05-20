import env from '@/env';
import createApp from '@/lib/create-app';
import configureOpenAPI from '@/lib/open-api-config';
import drivers from '@/routes/drivers/drivers.index';
import index from '@/routes/index.route';
import payments, { methodsRouter } from '@/routes/payments/payments.index';
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
  .route('/payment-methods', methodsRouter);

export type AppType = typeof _app;

export default {
  port: env.PORT,
  fetch: app.fetch,
};
