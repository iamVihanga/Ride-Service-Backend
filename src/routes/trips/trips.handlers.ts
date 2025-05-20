import { and, desc, eq, inArray, isNotNull, not, sql } from 'drizzle-orm';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import * as HttpStatusPhrases from 'stoker/http-status-phrases';

import type { AppRouteHandler } from '@/types';

import { db } from '@/db';
import { drivers, tripLocationUpdates, trips, tripWaypoints, vehicles } from '@/db/schema';
import { ZOD_ERROR_CODES, ZOD_ERROR_MESSAGES } from '@/lib/constants';

import type {
  AddWaypointRoute,
  CancelTripRoute,
  CompleteTripRoute,
  CreateTripRoute,
  GetLocationUpdatesRoute,
  GetTripRoute,
  GetWaypointsRoute,
  ListTripsRoute,
  RateTripRoute,
  SearchAvailableVehiclesRoute,
  SearchQuery,
  StartTripRoute,
  TripFilters,
  UpdateLocationRoute,
  UpdateTripRoute,
} from './trips.routes';

// ---------- Trip Handlers ----------

// List trips handler
export const listTrips: AppRouteHandler<ListTripsRoute> = async (c) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ message: HttpStatusPhrases.UNAUTHORIZED }, HttpStatusCodes.UNAUTHORIZED);
  }

  const { status, driverId } = c.req.query() as TripFilters;

  // Build the query with filters
  let query = db.select().from(trips);

  const whereConditions = [];

  if (status) {
    whereConditions.push(eq(trips.status, status));
  }

  if (driverId) {
    whereConditions.push(eq(trips.driverId, driverId));
  }

  // If user is a driver, only show their trips
  if (user.driver && user.role !== 'admin') {
    whereConditions.push(eq(trips.driverId, user.driver.id));
  }

  // Apply where conditions if any exist
  if (whereConditions.length > 0) {
    const combinedCondition = whereConditions.reduce((acc, condition) => and(acc, condition));
    query = query.where(combinedCondition);
  }

  // Execute query
  const items = await query.orderBy(desc(trips.createdAt));

  return c.json(items, HttpStatusCodes.OK);
};

// Create trip handler
export const createTrip: AppRouteHandler<CreateTripRoute> = async (c) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ message: HttpStatusPhrases.UNAUTHORIZED }, HttpStatusCodes.UNAUTHORIZED);
  }

  const { waypoints, ...tripData } = c.req.valid('json');

  try {
    // Start a transaction to insert trip and waypoints
    const trip = await db.transaction(async (tx) => {
      // Insert trip
      const [insertedTrip] = await tx.insert(trips).values(tripData).returning();

      // Insert waypoints if provided
      if (waypoints && waypoints.length > 0) {
        await tx.insert(tripWaypoints).values(
          waypoints.map((waypoint, index) => ({
            ...waypoint,
            tripId: insertedTrip.id,
            orderIndex: index,
          }))
        );
      }

      return insertedTrip;
    });

    // Fetch the trip with any relations needed
    const tripWithRelations = await db.query.trips.findFirst({
      where: eq(trips.id, trip.id),
      with: {
        vehicleType: true,
        tripWaypoints: {
          orderBy: tripWaypoints.orderIndex,
        },
      },
    });

    return c.json(tripWithRelations, HttpStatusCodes.CREATED);
  } catch (error) {
    console.error('Error creating trip:', error);
    return c.json(
      {
        message: 'Failed to create trip',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      HttpStatusCodes.UNPROCESSABLE_ENTITY
    );
  }
};

// Get trip by ID handler
export const getTrip: AppRouteHandler<GetTripRoute> = async (c) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ message: HttpStatusPhrases.UNAUTHORIZED }, HttpStatusCodes.UNAUTHORIZED);
  }

  const { id } = c.req.valid('param');

  const trip = await db.query.trips.findFirst({
    where: eq(trips.id, id),
    with: {
      driver: true,
      vehicleType: true,
      paymentMethod: true,
      promoCode: true,
      payment: true,
      tripWaypoints: {
        orderBy: tripWaypoints.orderIndex,
      },
      tripBids: true,
    },
  });

  if (!trip) {
    return c.json({ message: HttpStatusPhrases.NOT_FOUND }, HttpStatusCodes.NOT_FOUND);
  }

  // Check authorization for driver-specific trips
  if (user.driver && trip.driverId && trip.driverId !== user.driver.id && user.role !== 'admin') {
    return c.json({ message: HttpStatusPhrases.FORBIDDEN }, HttpStatusCodes.FORBIDDEN);
  }

  return c.json(trip, HttpStatusCodes.OK);
};

// Update trip handler
export const updateTrip: AppRouteHandler<UpdateTripRoute> = async (c) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ message: HttpStatusPhrases.UNAUTHORIZED }, HttpStatusCodes.UNAUTHORIZED);
  }

  const { id } = c.req.valid('param');
  const updates = c.req.valid('json');

  // Check if at least one field is present in the request body
  if (Object.keys(updates).length === 0) {
    return c.json(
      {
        success: false,
        error: {
          issues: [
            {
              code: ZOD_ERROR_CODES.INVALID_UPDATES,
              path: [],
              message: ZOD_ERROR_MESSAGES.NO_UPDATES,
            },
          ],
          name: 'ZodError',
        },
      },
      HttpStatusCodes.UNPROCESSABLE_ENTITY
    );
  }

  // Get the trip to check authorization and status
  const existingTrip = await db.query.trips.findFirst({
    where: eq(trips.id, id),
  });

  if (!existingTrip) {
    return c.json({ message: HttpStatusPhrases.NOT_FOUND }, HttpStatusCodes.NOT_FOUND);
  }

  // Check authorization for driver-specific trips
  if (user.driver && existingTrip.driverId && existingTrip.driverId !== user.driver.id && user.role !== 'admin') {
    return c.json({ message: HttpStatusPhrases.FORBIDDEN }, HttpStatusCodes.FORBIDDEN);
  }

  // Check if the trip can be updated based on its status
  if (['completed', 'cancelled'].includes(existingTrip.status)) {
    return c.json(
      {
        message: 'Cannot update a completed or cancelled trip',
      },
      HttpStatusCodes.BAD_REQUEST
    );
  }

  try {
    const [updatedTrip] = await db.update(trips).set(updates).where(eq(trips.id, id)).returning();

    return c.json(updatedTrip, HttpStatusCodes.OK);
  } catch (error) {
    console.error('Error updating trip:', error);
    return c.json(
      {
        message: 'Failed to update trip',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      HttpStatusCodes.UNPROCESSABLE_ENTITY
    );
  }
};

// Cancel trip handler
export const cancelTrip: AppRouteHandler<CancelTripRoute> = async (c) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ message: HttpStatusPhrases.UNAUTHORIZED }, HttpStatusCodes.UNAUTHORIZED);
  }

  const { id } = c.req.valid('param');
  const { cancellationReason, cancelledBy } = c.req.valid('json');

  // Get the trip to check authorization and status
  const existingTrip = await db.query.trips.findFirst({
    where: eq(trips.id, id),
  });

  if (!existingTrip) {
    return c.json({ message: HttpStatusPhrases.NOT_FOUND }, HttpStatusCodes.NOT_FOUND);
  }

  // Check authorization for driver-specific cancellations
  if (cancelledBy === 'driver' && (!user.driver || (existingTrip.driverId !== user.driver.id && user.role !== 'admin'))) {
    return c.json({ message: HttpStatusPhrases.FORBIDDEN }, HttpStatusCodes.FORBIDDEN);
  }

  // Check if the trip can be cancelled based on its status
  if (['completed', 'cancelled'].includes(existingTrip.status)) {
    return c.json(
      {
        message: 'Cannot cancel a completed or already cancelled trip',
      },
      HttpStatusCodes.BAD_REQUEST
    );
  }

  try {
    const [cancelledTrip] = await db
      .update(trips)
      .set({
        status: 'cancelled',
        cancellationReason,
        cancelledBy,
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(trips.id, id))
      .returning();

    return c.json(cancelledTrip, HttpStatusCodes.OK);
  } catch (error) {
    console.error('Error cancelling trip:', error);
    return c.json(
      {
        message: 'Failed to cancel trip',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// Start trip handler
export const startTrip: AppRouteHandler<StartTripRoute> = async (c) => {
  const user = c.get('user');

  if (!user || !user.driver) {
    return c.json({ message: 'Only drivers can start trips' }, HttpStatusCodes.UNAUTHORIZED);
  }

  const { id } = c.req.valid('param');

  // Get the trip to check authorization and status
  const existingTrip = await db.query.trips.findFirst({
    where: eq(trips.id, id),
  });

  if (!existingTrip) {
    return c.json({ message: HttpStatusPhrases.NOT_FOUND }, HttpStatusCodes.NOT_FOUND);
  }

  // Check authorization - only the assigned driver can start the trip
  if (existingTrip.driverId !== user.driver.id && user.role !== 'admin') {
    return c.json({ message: HttpStatusPhrases.FORBIDDEN }, HttpStatusCodes.FORBIDDEN);
  }

  // Check if the trip can be started based on its status
  if (existingTrip.status !== 'accepted') {
    return c.json(
      {
        message: 'Only accepted trips can be started',
      },
      HttpStatusCodes.BAD_REQUEST
    );
  }

  try {
    const [startedTrip] = await db
      .update(trips)
      .set({
        status: 'in_progress',
        startTime: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(trips.id, id))
      .returning();

    return c.json(startedTrip, HttpStatusCodes.OK);
  } catch (error) {
    console.error('Error starting trip:', error);
    return c.json(
      {
        message: 'Failed to start trip',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// Complete trip handler
export const completeTrip: AppRouteHandler<CompleteTripRoute> = async (c) => {
  const user = c.get('user');

  if (!user || !user.driver) {
    return c.json({ message: 'Only drivers can complete trips' }, HttpStatusCodes.UNAUTHORIZED);
  }

  const { id } = c.req.valid('param');
  const { actualDistance, actualDuration, finalPrice } = c.req.valid('json');

  // Get the trip to check authorization and status
  const existingTrip = await db.query.trips.findFirst({
    where: eq(trips.id, id),
  });

  if (!existingTrip) {
    return c.json({ message: HttpStatusPhrases.NOT_FOUND }, HttpStatusCodes.NOT_FOUND);
  }

  // Check authorization - only the assigned driver can complete the trip
  if (existingTrip.driverId !== user.driver.id && user.role !== 'admin') {
    return c.json({ message: HttpStatusPhrases.FORBIDDEN }, HttpStatusCodes.FORBIDDEN);
  }

  // Check if the trip can be completed based on its status
  if (existingTrip.status !== 'in_progress') {
    return c.json(
      {
        message: 'Only in-progress trips can be completed',
      },
      HttpStatusCodes.BAD_REQUEST
    );
  }

  try {
    // Update driver statistics in a transaction
    const [completedTrip] = await db.transaction(async (tx) => {
      // Update trip
      const [updatedTrip] = await tx
        .update(trips)
        .set({
          status: 'completed',
          endTime: new Date(),
          actualDistance,
          actualDuration,
          finalPrice,
          updatedAt: new Date(),
        })
        .where(eq(trips.id, id))
        .returning();

      // Update driver statistics
      await tx
        .update(drivers)
        .set({
          totalTrips: sql`${drivers.totalTrips} + 1`,
          totalEarnings: sql`${drivers.totalEarnings} + ${finalPrice}`,
          accountBalance: sql`${drivers.accountBalance} + ${finalPrice}`,
          updatedAt: new Date(),
        })
        .where(eq(drivers.id, existingTrip.driverId!));

      return [updatedTrip];
    });

    return c.json(completedTrip, HttpStatusCodes.OK);
  } catch (error) {
    console.error('Error completing trip:', error);
    return c.json(
      {
        message: 'Failed to complete trip',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// Rate trip handler
export const rateTrip: AppRouteHandler<RateTripRoute> = async (c) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ message: HttpStatusPhrases.UNAUTHORIZED }, HttpStatusCodes.UNAUTHORIZED);
  }

  const { id } = c.req.valid('param');
  const { rating, feedback, ratingType } = c.req.valid('json');

  // Get the trip to check authorization and status
  const existingTrip = await db.query.trips.findFirst({
    where: eq(trips.id, id),
  });

  if (!existingTrip) {
    return c.json({ message: HttpStatusPhrases.NOT_FOUND }, HttpStatusCodes.NOT_FOUND);
  }

  // Check if the trip is completed
  if (existingTrip.status !== 'completed') {
    return c.json(
      {
        message: 'Only completed trips can be rated',
      },
      HttpStatusCodes.BAD_REQUEST
    );
  }

  // Check authorization for driver ratings
  if (ratingType === 'driver' && user.driver && existingTrip.driverId !== user.driver.id && user.role !== 'admin') {
    return c.json({ message: HttpStatusPhrases.FORBIDDEN }, HttpStatusCodes.FORBIDDEN);
  }

  try {
    // Update based on rating type
    let update = {};
    if (ratingType === 'driver') {
      update = {
        driverRating: rating,
        driverFeedback: feedback,
      };
    } else {
      update = {
        riderRating: rating,
        riderFeedback: feedback,
      };
    }

    const [ratedTrip] = await db.update(trips).set(update).where(eq(trips.id, id)).returning();

    // If it's a driver rating, update the driver's average rating
    if (ratingType === 'rider' && existingTrip.driverId) {
      // Calculate new average rating for the driver
      const driverTrips = await db
        .select({ rating: trips.riderRating })
        .from(trips)
        .where(and(eq(trips.driverId, existingTrip.driverId), sql`${trips.rider_rating} IS NOT NULL`));

      if (driverTrips.length > 0) {
        const totalRating = driverTrips.reduce((sum, trip) => sum + (trip.rating || 0), 0);
        const averageRating = totalRating / driverTrips.length;

        await db.update(drivers).set({ rating: averageRating }).where(eq(drivers.id, existingTrip.driverId));
      }
    }

    return c.json(ratedTrip, HttpStatusCodes.OK);
  } catch (error) {
    console.error('Error rating trip:', error);
    return c.json(
      {
        message: 'Failed to rate trip',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// Add waypoint handler
export const addWaypoint: AppRouteHandler<AddWaypointRoute> = async (c) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ message: HttpStatusPhrases.UNAUTHORIZED }, HttpStatusCodes.UNAUTHORIZED);
  }

  const { id } = c.req.valid('param');
  const waypointData = c.req.valid('json');

  // Check if trip exists
  const existingTrip = await db.query.trips.findFirst({
    where: eq(trips.id, id),
  });

  if (!existingTrip) {
    return c.json({ message: HttpStatusPhrases.NOT_FOUND }, HttpStatusCodes.NOT_FOUND);
  }

  // Check authorization for driver-specific trips
  if (user.driver && existingTrip.driverId && existingTrip.driverId !== user.driver.id && user.role !== 'admin') {
    return c.json({ message: HttpStatusPhrases.FORBIDDEN }, HttpStatusCodes.FORBIDDEN);
  }

  // Get current max order index
  const maxOrderResult = await db
    .select({ maxOrder: sql<number>`COALESCE(MAX(${tripWaypoints.orderIndex}), -1)` })
    .from(tripWaypoints)
    .where(eq(tripWaypoints.tripId, id));

  const nextOrderIndex = (maxOrderResult[0]?.maxOrder ?? -1) + 1;

  try {
    const [waypoint] = await db
      .insert(tripWaypoints)
      .values({
        ...waypointData,
        tripId: id,
        orderIndex: nextOrderIndex,
      })
      .returning();

    return c.json(waypoint, HttpStatusCodes.CREATED);
  } catch (error) {
    console.error('Error adding waypoint:', error);
    return c.json(
      {
        message: 'Failed to add waypoint',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      HttpStatusCodes.UNPROCESSABLE_ENTITY
    );
  }
};

// Get waypoints handler
export const getWaypoints: AppRouteHandler<GetWaypointsRoute> = async (c) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ message: HttpStatusPhrases.UNAUTHORIZED }, HttpStatusCodes.UNAUTHORIZED);
  }

  const { id } = c.req.valid('param');

  // Check if trip exists
  const existingTrip = await db.query.trips.findFirst({
    where: eq(trips.id, id),
  });

  if (!existingTrip) {
    return c.json({ message: HttpStatusPhrases.NOT_FOUND }, HttpStatusCodes.NOT_FOUND);
  }

  // Check authorization for driver-specific trips
  if (user.driver && existingTrip.driverId && existingTrip.driverId !== user.driver.id && user.role !== 'admin') {
    return c.json({ message: HttpStatusPhrases.FORBIDDEN }, HttpStatusCodes.FORBIDDEN);
  }

  const waypoints = await db.select().from(tripWaypoints).where(eq(tripWaypoints.tripId, id)).orderBy(tripWaypoints.orderIndex);

  return c.json(waypoints, HttpStatusCodes.OK);
};

// Update location handler
export const updateLocation: AppRouteHandler<UpdateLocationRoute> = async (c) => {
  const user = c.get('user');

  if (!user || !user.driver) {
    return c.json({ message: 'Only drivers can update location' }, HttpStatusCodes.UNAUTHORIZED);
  }

  const { id } = c.req.valid('param');
  const locationData = c.req.valid('json');

  // Check if trip exists and is assigned to this driver
  const existingTrip = await db.query.trips.findFirst({
    where: eq(trips.id, id),
  });

  if (!existingTrip) {
    return c.json({ message: HttpStatusPhrases.NOT_FOUND }, HttpStatusCodes.NOT_FOUND);
  }

  // Check authorization - only the assigned driver can update location
  if (existingTrip.driverId !== user.driver.id && user.role !== 'admin') {
    return c.json({ message: HttpStatusPhrases.FORBIDDEN }, HttpStatusCodes.FORBIDDEN);
  }

  // Check if the trip is in a valid state for location updates
  if (!['accepted', 'in_progress'].includes(existingTrip.status)) {
    return c.json(
      {
        message: 'Location can only be updated for accepted or in-progress trips',
      },
      HttpStatusCodes.BAD_REQUEST
    );
  }

  try {
    const [locationUpdate] = await db
      .insert(tripLocationUpdates)
      .values({
        ...locationData,
        tripId: id,
      })
      .returning();

    return c.json(locationUpdate, HttpStatusCodes.CREATED);
  } catch (error) {
    console.error('Error updating location:', error);
    return c.json(
      {
        message: 'Failed to update location',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      HttpStatusCodes.UNPROCESSABLE_ENTITY
    );
  }
};

// Get location updates handler
export const getLocationUpdates: AppRouteHandler<GetLocationUpdatesRoute> = async (c) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ message: HttpStatusPhrases.UNAUTHORIZED }, HttpStatusCodes.UNAUTHORIZED);
  }

  const { id } = c.req.valid('param');

  // Check if trip exists
  const existingTrip = await db.query.trips.findFirst({
    where: eq(trips.id, id),
  });

  if (!existingTrip) {
    return c.json({ message: HttpStatusPhrases.NOT_FOUND }, HttpStatusCodes.NOT_FOUND);
  }

  // No need to check authorization as location updates are public for trip participants

  const locationUpdates = await db.select().from(tripLocationUpdates).where(eq(tripLocationUpdates.tripId, id)).orderBy(desc(tripLocationUpdates.timestamp));

  return c.json(locationUpdates, HttpStatusCodes.OK);
};

// Add these imports


// Add SearchAvailableVehiclesRoute to the imports at the top

// Add this function for calculating distance between coordinates (using Haversine formula)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in km
  return distance;
}

// Add this new handler function
// Search available vehicles handler
export const searchAvailableVehicles: AppRouteHandler<SearchAvailableVehiclesRoute> = async (c) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ message: HttpStatusPhrases.UNAUTHORIZED }, HttpStatusCodes.UNAUTHORIZED);
  }

  const { pickupLat, pickupLng, vehicleTypeId, maxDistance } = c.req.query() as SearchQuery;

  // Base query to get active vehicles with their drivers
  const query = db
    .select({
      vehicle: vehicles,
      driver: drivers,
      user: user,
    })
    .from(vehicles)
    .innerJoin(drivers, eq(vehicles.driverId, drivers.id))
    .innerJoin(user, eq(drivers.userId, user.id))
    .where(
      and(
        eq(vehicles.isActive, true),
        eq(drivers.isAvailable, true),
        eq(drivers.isVerified, true),
        // Add vehicle type filter if provided
        vehicleTypeId ? eq(vehicles.vehicleTypeId, vehicleTypeId) : undefined,
        // Only include vehicles that have location data
        isNotNull(vehicles.currentLocationLat),
        isNotNull(vehicles.currentLocationLng),
        // Exclude vehicles that are already assigned to an in-progress trip
        not(
          inArray(
            vehicles.driverId,
            db
              .select({ driverId: trips.driverId })
              .from(trips)
              .where(and(isNotNull(trips.driverId), inArray(trips.status, ['accepted', 'in_progress'])))
          )
        )
      )
    );

  const availableVehicles = await query;

  // If pickup coordinates are provided, calculate distances and filter by max distance
  let results = availableVehicles;

  if (pickupLat && pickupLng) {
    results = availableVehicles
      .map((item) => {
        const distance = calculateDistance(pickupLat, pickupLng, item.vehicle.currentLocationLat!, item.vehicle.currentLocationLng!);

        // Calculate estimated arrival time (rough estimation: assume 30 km/h average speed in city)
        // This gives arrival time in minutes
        const estimatedArrivalTime = Math.round((distance / 30) * 60);

        return {
          ...item,
          distanceFromPickup: distance,
          estimatedArrivalTime,
        };
      })
      .filter((item) => item.distanceFromPickup <= maxDistance)
      // Sort by distance (closest first)
      .sort((a, b) => a.distanceFromPickup - b.distanceFromPickup);
  }

  // Format response to match the expected schema
  const formattedResults = results.map((item) => ({
    vehicle: item.vehicle,
    driver: {
      id: item.driver.id,
      name: `${item.user.firstName} ${item.user.lastName}`,
      rating: item.driver.rating,
      totalTrips: item.driver.totalTrips,
      isAvailable: item.driver.isAvailable,
    },
    distanceFromPickup: 'distanceFromPickup' in item ? item.distanceFromPickup : undefined,
    estimatedArrivalTime: 'estimatedArrivalTime' in item ? item.estimatedArrivalTime : undefined,
  }));

  return c.json(formattedResults, HttpStatusCodes.OK);
};
