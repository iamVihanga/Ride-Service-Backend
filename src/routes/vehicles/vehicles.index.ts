import { createRouter } from '@/lib/create-app';

import * as handlers from './vehicles.handlers';
import * as routes from './vehicles.routes';

const router = createRouter().openapi(routes.listVehicles, handlers.listVehicles);

export default router;
