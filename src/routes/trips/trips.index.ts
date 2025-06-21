import { createRouter } from '@/lib/create-app';

import * as handlers from './trips.handlers';
import * as routes from './trips.routes';

// Create router for main trip operations
const router = createRouter();

// Basic CRUD operations
router.openapi(routes.listTrips, handlers.listTrips);
router.openapi(routes.createTrip, handlers.createTrip);
router.openapi(routes.getTrip, handlers.getTrip);
router.openapi(routes.updateTrip, handlers.updateTrip);

// Trip state management
router.openapi(routes.cancelTrip, handlers.cancelTrip);
router.openapi(routes.startTrip, handlers.startTrip);
router.openapi(routes.completeTrip, handlers.completeTrip);
router.openapi(routes.rateTrip, handlers.rateTrip);

// Waypoints management
router.openapi(routes.addWaypoint, handlers.addWaypoint);
router.openapi(routes.getWaypoints, handlers.getWaypoints);

// Location tracking
router.openapi(routes.updateLocation, handlers.updateLocation);
router.openapi(routes.getLocationUpdates, handlers.getLocationUpdates);

// Search functionality
router.openapi(routes.searchAvailableVehicles, handlers.searchAvailableVehicles);

// Only include routes that are properly defined in the routes file

// Create a sub-router for driver candidates if needed
// This would typically be imported or created here
// const driverCandidatesRouter = createRouter();
// router.route('/driver-candidates', driverCandidatesRouter);

export default router;
