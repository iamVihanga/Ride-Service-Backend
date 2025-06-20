import { OpenAPIHono } from '@hono/zod-openapi';
import { defaultHook } from 'stoker/openapi';

import * as handlers from './trips.handlers';
import * as routes from './trips.routes';

// Create router for main trip operations
const router = new OpenAPIHono({
  defaultHook
});

// Search functionality
router.openapi(routes.searchAvailableVehicles, handlers.searchAvailableVehicles);
router.openapi(routes.searchNearbyDrivers, handlers.searchNearbyDrivers); // Added for driver search

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
router.openapi(routes.acceptTrip, handlers.acceptTrip); // Added for driver accepting a trip
router.openapi(routes.arriveAtPickup, handlers.arriveAtPickup); // Added for driver arrival notification

// Waypoints management
router.openapi(routes.addWaypoint, handlers.addWaypoint);
router.openapi(routes.getWaypoints, handlers.getWaypoints);
router.openapi(routes.updateWaypointStatus, handlers.updateWaypointStatus); // Added for marking waypoints completed

// Location tracking
router.openapi(routes.updateLocation, handlers.updateLocation);
router.openapi(routes.getLocationUpdates, handlers.getLocationUpdates);
router.openapi(routes.getDriverCurrentLocation, handlers.getDriverCurrentLocation); // Added for getting driver's latest location

// Create subrouter for bidding functionality
const biddingRouter = new OpenAPIHono({
  defaultHook
});
biddingRouter.openapi(routes.listBidsForTrip, handlers.listBidsForTrip);
biddingRouter.openapi(routes.placeBid, handlers.placeBid);
biddingRouter.openapi(routes.updateBid, handlers.updateBid);
biddingRouter.openapi(routes.selectBid, handlers.selectBid);
biddingRouter.openapi(routes.getBidById, handlers.getBidById);

// Create subrouter for driver candidates
const driverCandidatesRouter = new OpenAPIHono({
  defaultHook
});
driverCandidatesRouter.openapi(routes.listDriverCandidates, handlers.listDriverCandidates);
driverCandidatesRouter.openapi(routes.addDriverCandidate, handlers.addDriverCandidate);
driverCandidatesRouter.openapi(routes.updateDriverCandidate, handlers.updateDriverCandidate);
driverCandidatesRouter.openapi(routes.removeDriverCandidate, handlers.removeDriverCandidate);

// Attach subrouters to the main router
router.route('/bids', biddingRouter);
router.route('/driver-candidates', driverCandidatesRouter);

export default router;
