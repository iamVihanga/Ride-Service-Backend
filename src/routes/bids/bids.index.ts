import { createRouter } from '@/lib/create-app';

import * as handlers from './bids.handlers';
import * as routes from './bids.routes';

const router = createRouter()
  // Basic CRUD routes
  .openapi(routes.listBids, handlers.listBids)
  .openapi(routes.createBid, handlers.createBid)
  .openapi(routes.getBid, handlers.getBid)
  .openapi(routes.updateBid, handlers.updateBid)
  .openapi(routes.deleteBid, handlers.deleteBid)

  // Specialized routes
  .openapi(routes.getTripsForBid, handlers.getTripsForBid)
  .openapi(routes.getBidsFromDriver, handlers.getBidsFromDriver)
  .openapi(routes.acceptBid, handlers.acceptBid)
  .openapi(routes.rejectBid, handlers.rejectBid);

export default router;
