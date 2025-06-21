import { createRoute, z } from '@hono/zod-openapi';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import { jsonContent, jsonContentRequired } from 'stoker/openapi/helpers';
import { createErrorSchema } from 'stoker/openapi/schemas';

import { notFoundSchema } from '@/lib/constants';
import { serverAuthMiddleware } from '@/middlewares/auth-middleware';
import { tripLocationUpdates } from '@/routes/trips/location-updates.schema';
import { trips } from '@/routes/trips/trips.schema';
import { tripWaypoints } from '@/routes/trips/waypoints.schema';
import { selectVehicleSchema } from '@/routes/vehicles/vehicles.schema';

const tags: string[] = ['Trips'];

const IdParamsSchema = z.object({ id: z.string().uuid() });

// Create Zod schemas from Drizzle schemas
export const selectTripSchema = createSelectSchema(trips);
export type SelectTrip = z.infer<typeof selectTripSchema>;

export const insertTripSchema = createInsertSchema(trips, {
  pickupLocationLat: z.number(),
  pickupLocationLng: z.number(),
  dropoffLocationLat: z.number(),
  dropoffLocationLng: z.number(),
  estimatedDistance: z.number().positive(),
  estimatedDuration: z.number().int().positive(),
  estimatedPrice: z.number().positive(),
  finalPrice: z.number().positive(),
  biddingEndTime: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: 'biddingEndTime must be a valid date string',
    })
    .transform((val) => new Date(val))
    .optional(),
}).omit({
  id: true,
  driverId: true, // This will be assigned when a bid is accepted
  createdAt: true,
  updatedAt: true,
  startTime: true,
  endTime: true,
  cancelledAt: true,
  riderRating: true,
  driverRating: true,
  actualDistance: true,
  actualDuration: true,
});

export type InsertTrip = z.infer<typeof insertTripSchema>;

export const updateTripSchema = createInsertSchema(trips).partial().omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type UpdateTrip = z.infer<typeof updateTripSchema>;

// Waypoints schema
export const selectWaypointSchema = createSelectSchema(tripWaypoints);
export type SelectWaypoint = z.infer<typeof selectWaypointSchema>;

export const insertWaypointSchema = createInsertSchema(tripWaypoints, {
  locationLat: z.number(),
  locationLng: z.number(),
}).omit({
  id: true,
  arrivedAt: true,
  createdAt: true,
});

export type InsertWaypoint = z.infer<typeof insertWaypointSchema>;

// Location update schema
export const selectLocationUpdateSchema = createSelectSchema(tripLocationUpdates);
export type SelectLocationUpdate = z.infer<typeof selectLocationUpdateSchema>;

export const insertLocationUpdateSchema = createInsertSchema(tripLocationUpdates, {
  locationLat: z.number(),
  locationLng: z.number(),
}).omit({
  id: true,
  timestamp: true,
});

export type InsertLocationUpdate = z.infer<typeof insertLocationUpdateSchema>;

// Schema for creating a trip with waypoints
export const createTripWithWaypointsSchema = insertTripSchema.extend({
  waypoints: z.array(insertWaypointSchema.omit({ tripId: true })).optional(),
});

// Query parameters
const filterSchema = z.object({
  status: z.string().optional(),
  driverId: z.string().uuid().optional(),
});

export type TripFilters = z.infer<typeof filterSchema>;

// Search query parameters
const searchQuerySchema = z.object({
  pickupLat: z
    .string()
    .transform((val) => parseFloat(val))
    .optional(),
  pickupLng: z
    .string()
    .transform((val) => parseFloat(val))
    .optional(),
  vehicleTypeId: z.string().uuid().optional(),
  maxDistance: z
    .string()
    .transform((val) => parseFloat(val))
    .default('10'), // Search radius in km
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;

// Combined driver and vehicle search result schema
const availableVehicleSchema = z.object({
  vehicle: selectVehicleSchema,
  driver: z.object({
    id: z.string(),
    name: z.string(),
    rating: z.number().nullable(),
    totalTrips: z.number().nullable(),
    isAvailable: z.boolean().nullable(),
  }),
  distanceFromPickup: z.number().optional(),
  estimatedArrivalTime: z.number().optional(), // in minutes
});

export type AvailableVehicle = z.infer<typeof availableVehicleSchema>;

// ---------- Trip Routes ----------

// List trips route
export const listTrips = createRoute({
  tags,
  summary: 'List all trips',
  path: '/',
  method: 'get',
  middleware: [serverAuthMiddleware],
  request: {
    query: filterSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.array(selectTripSchema), 'List of trips'),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(z.object({ message: z.string() }), 'Unauthenticated request'),
  },
});

// Create trip route
export const createTrip = createRoute({
  tags,
  summary: 'Create a new trip',
  path: '/',
  method: 'post',
  middleware: [serverAuthMiddleware],
  request: {
    body: jsonContentRequired(createTripWithWaypointsSchema, 'Trip details with optional waypoints'),
  },
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(selectTripSchema, 'The created trip'),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(z.object({ message: z.string() }), 'Unauthenticated request'),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(createErrorSchema(createTripWithWaypointsSchema), 'Validation errors'),
  },
});

// Get trip by ID route
export const getTrip = createRoute({
  tags,
  summary: 'Get trip details',
  path: '/{id}',
  method: 'get',
  middleware: [serverAuthMiddleware],
  request: {
    params: IdParamsSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(selectTripSchema, 'Trip details'),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(z.object({ message: z.string() }), 'Unauthenticated request'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, 'Trip not found'),
  },
});

// Update trip route
export const updateTrip = createRoute({
  tags,
  summary: 'Update trip details',
  path: '/{id}',
  method: 'patch',
  middleware: [serverAuthMiddleware],
  request: {
    params: IdParamsSchema,
    body: jsonContentRequired(updateTripSchema, 'Trip update details'),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(selectTripSchema, 'Updated trip details'),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(z.object({ message: z.string() }), 'Unauthenticated request'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, 'Trip not found'),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(createErrorSchema(updateTripSchema), 'Validation errors'),
  },
});

// Cancel trip route
export const cancelTrip = createRoute({
  tags,
  summary: 'Cancel a trip',
  path: '/{id}/cancel',
  method: 'post',
  middleware: [serverAuthMiddleware],
  request: {
    params: IdParamsSchema,
    body: jsonContentRequired(
      z.object({
        cancellationReason: z.string(),
        cancelledBy: z.enum(['rider', 'driver']),
      }),
      'Cancellation details'
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(selectTripSchema, 'Cancelled trip details'),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(z.object({ message: z.string() }), 'Unauthenticated request'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, 'Trip not found'),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(z.object({ message: z.string() }), 'Trip cannot be cancelled'),
  },
});

// Start trip route
export const startTrip = createRoute({
  tags,
  summary: 'Start a trip',
  path: '/{id}/start',
  method: 'post',
  middleware: [serverAuthMiddleware],
  request: {
    params: IdParamsSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(selectTripSchema, 'Started trip details'),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(z.object({ message: z.string() }), 'Unauthenticated request'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, 'Trip not found'),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(z.object({ message: z.string() }), 'Trip cannot be started'),
  },
});

// Complete trip route
export const completeTrip = createRoute({
  tags,
  summary: 'Complete a trip',
  path: '/{id}/complete',
  method: 'post',
  middleware: [serverAuthMiddleware],
  request: {
    params: IdParamsSchema,
    body: jsonContentRequired(
      z.object({
        actualDistance: z.number().positive(),
        actualDuration: z.number().int().positive(),
        finalPrice: z.number().positive(),
      }),
      'Trip completion details'
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(selectTripSchema, 'Completed trip details'),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(z.object({ message: z.string() }), 'Unauthenticated request'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, 'Trip not found'),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(z.object({ message: z.string() }), 'Trip cannot be completed'),
  },
});

// Rate trip route
export const rateTrip = createRoute({
  tags,
  summary: 'Rate a trip',
  path: '/{id}/rate',
  method: 'post',
  middleware: [serverAuthMiddleware],
  request: {
    params: IdParamsSchema,
    body: jsonContentRequired(
      z.object({
        rating: z.number().min(1).max(5),
        feedback: z.string().optional(),
        ratingType: z.enum(['rider', 'driver']),
      }),
      'Rating details'
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(selectTripSchema, 'Rated trip details'),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(z.object({ message: z.string() }), 'Unauthenticated request'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, 'Trip not found'),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(z.object({ message: z.string() }), 'Trip cannot be rated'),
  },
});

// Add waypoint route
export const addWaypoint = createRoute({
  tags,
  summary: 'Add a waypoint to a trip',
  path: '/{id}/waypoints',
  method: 'post',
  middleware: [serverAuthMiddleware],
  request: {
    params: IdParamsSchema,
    body: jsonContentRequired(insertWaypointSchema.omit({ tripId: true }), 'Waypoint details'),
  },
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(selectWaypointSchema, 'The created waypoint'),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(z.object({ message: z.string() }), 'Unauthenticated request'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, 'Trip not found'),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(createErrorSchema(insertWaypointSchema), 'Validation errors'),
  },
});

// Get waypoints route
export const getWaypoints = createRoute({
  tags,
  summary: 'Get waypoints for a trip',
  path: '/{id}/waypoints',
  method: 'get',
  middleware: [serverAuthMiddleware],
  request: {
    params: IdParamsSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.array(selectWaypointSchema), 'List of waypoints'),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(z.object({ message: z.string() }), 'Unauthenticated request'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, 'Trip not found'),
  },
});

// Update driver location route
export const updateLocation = createRoute({
  tags,
  summary: "Update driver's location during a trip",
  path: '/{id}/location',
  method: 'post',
  middleware: [serverAuthMiddleware],
  request: {
    params: IdParamsSchema,
    body: jsonContentRequired(insertLocationUpdateSchema.omit({ tripId: true }), 'Location update'),
  },
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(selectLocationUpdateSchema, 'The location update'),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(z.object({ message: z.string() }), 'Unauthenticated request'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, 'Trip not found'),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(createErrorSchema(insertLocationUpdateSchema), 'Validation errors'),
  },
});

// Get location updates route
export const getLocationUpdates = createRoute({
  tags,
  summary: 'Get location updates for a trip',
  path: '/{id}/location',
  method: 'get',
  middleware: [serverAuthMiddleware],
  request: {
    params: IdParamsSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.array(selectLocationUpdateSchema), 'List of location updates'),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(z.object({ message: z.string() }), 'Unauthenticated request'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, 'Trip not found'),
  },
});

// Search for available vehicles route
export const searchAvailableVehicles = createRoute({
  tags,
  summary: 'Search for available vehicles nearby',
  path: '/search',
  method: 'get',
  middleware: [serverAuthMiddleware],
  request: {
    query: searchQuerySchema,
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.array(availableVehicleSchema), 'List of available vehicles with driver information'),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(z.object({ message: z.string() }), 'Unauthenticated request'),
  },
});

// Export route types
export type ListTripsRoute = typeof listTrips;
export type CreateTripRoute = typeof createTrip;
export type GetTripRoute = typeof getTrip;
export type UpdateTripRoute = typeof updateTrip;
export type CancelTripRoute = typeof cancelTrip;
export type StartTripRoute = typeof startTrip;
export type CompleteTripRoute = typeof completeTrip;
export type RateTripRoute = typeof rateTrip;
export type AddWaypointRoute = typeof addWaypoint;
export type GetWaypointsRoute = typeof getWaypoints;
export type UpdateLocationRoute = typeof updateLocation;
export type GetLocationUpdatesRoute = typeof getLocationUpdates;
export type SearchAvailableVehiclesRoute = typeof searchAvailableVehicles;
