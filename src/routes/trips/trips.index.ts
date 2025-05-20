import { createRouter } from '@/lib/create-app';

import * as handlers from './trips.handlers';
import * as routes from './trips.routes';

const router = createRouter()
  // Search functionality
  .openapi(routes.searchAvailableVehicles, handlers.searchAvailableVehicles)

  // Basic CRUD operations
  .openapi(routes.listTrips, handlers.listTrips)
  .openapi(routes.createTrip, handlers.createTrip)
  .openapi(routes.getTrip, handlers.getTrip)
  .openapi(routes.updateTrip, handlers.updateTrip)

  // Trip state management
  .openapi(routes.cancelTrip, handlers.cancelTrip)
  .openapi(routes.startTrip, handlers.startTrip)
  .openapi(routes.completeTrip, handlers.completeTrip)
  .openapi(routes.rateTrip, handlers.rateTrip)

  // Waypoints management
  .openapi(routes.addWaypoint, handlers.addWaypoint)
  .openapi(routes.getWaypoints, handlers.getWaypoints)

  // Location tracking
  .openapi(routes.updateLocation, handlers.updateLocation)
  .openapi(routes.getLocationUpdates, handlers.getLocationUpdates);

export default router;
