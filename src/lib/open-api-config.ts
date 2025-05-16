import { apiReference } from '@scalar/hono-api-reference';

import packageJson from '../../package.json';

export default function configureOpenAPI(app: AppOpenAPI): void {
  app.doc('/doc', {
    openapi: '3.0.0',
    info: {
      version: packageJson.version,
      title: 'Taxi Service Backend API',
    },
  });

  app.get(
    '/reference',
    apiReference({
      theme: 'deepSpace',
      url: '/doc',
    })
  );
}
