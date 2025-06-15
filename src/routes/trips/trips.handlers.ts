import { and, desc, eq, inArray, isNotNull, not } from 'drizzle-orm';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import * as HttpStatusPhrases from 'stoker/http-status-phrases';

import { db } from '@/db';
import { drivers, trips, vehicles } from '@/db/schema';
import type { AppRouteHandler } from '@/types';

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
  StartTripRoute,
  TripFilters,
  UpdateLocationRoute,
  UpdateTripRoute
} from './trips.routes';

// ---------- Trip Handlers ----------

// List trips handler - Fixed query building
export const listTrips: AppRouteHandler<ListTripsRoute> = async (c) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ message: HttpStatusPhrases.UNAUTHORIZED }, HttpStatusCodes.UNAUTHORIZED);
  }

  const { status, driverId } = c.req.query() as TripFilters;

  // Build the query with filters
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

  // Execute query with proper where condition handling
  let items;
  if (whereConditions.length > 0) {
    const combinedCondition =
      whereConditions.length === 1
        ? whereConditions[0]
        : whereConditions.reduce((acc, condition) => and(acc, condition));

    items = await db
      .select()
      .from(trips)
      .where(combinedCondition)
      .orderBy(desc(trips.createdAt));
  } else {
    items = await db
      .select()
      .from(trips)
      .orderBy(desc(trips.createdAt));
  }

  return c.json(items, HttpStatusCodes.OK);
};

// Create trip handler
export const createTrip: AppRouteHandler<CreateTripRoute> = async (c) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ message: HttpStatusPhrases.UNAUTHORIZED }, HttpStatusCodes.UNAUTHORIZED);
  }

  const tripData = c.req.valid('json');

  try {
    const [newTrip] = await db.insert(trips).values({
      ...tripData,
      riderId: user.id,
      status: 'pending',
    }).returning();

    return c.json(newTrip, HttpStatusCodes.CREATED);
  } catch (error) {
    console.error('Error creating trip:', error);
    return c.json(
      {
        message: 'Failed to create trip',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      HttpStatusCodes.UNPROCESSABLE_ENTITY
    );
  }
};

// Get trip by ID handler
export const getTrip: AppRouteHandler<GetTripRoute> = async (c) => {
  const { id } = c.req.valid('param');
  const user = c.get('user');

  if (!user) {
    return c.json({ message: HttpStatusPhrases.UNAUTHORIZED }, HttpStatusCodes.UNAUTHORIZED);
  }

  try {
    const trip = await db.query.trips.findFirst({
      where: eq(trips.id, id),
    });

    if (!trip) {
      return c.json({ message: HttpStatusPhrases.NOT_FOUND }, HttpStatusCodes.NOT_FOUND);
    }

    // Check if user has access to this trip
    const isAdmin = user.role === 'admin';
    const isRider = trip.riderId === user.id;
    const isDriver = user.driver && trip.driverId === user.driver.id;

    if (!isAdmin && !isRider && !isDriver) {
      return c.json({ message: HttpStatusPhrases.FORBIDDEN }, HttpStatusCodes.FORBIDDEN);
    }

    return c.json(trip, HttpStatusCodes.OK);
  } catch (error) {
    console.error('Error fetching trip:', error);
    return c.json(
      { message: 'Failed to fetch trip' },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// Update trip handler
export const updateTrip: AppRouteHandler<UpdateTripRoute> = async (c) => {
  const { id } = c.req.valid('param');
  const updates = c.req.valid('json');
  const user = c.get('user');

  if (!user) {
    return c.json({ message: HttpStatusPhrases.UNAUTHORIZED }, HttpStatusCodes.UNAUTHORIZED);
  }

  try {
    // Check if trip exists and user has permission
    const existingTrip = await db.query.trips.findFirst({
      where: eq(trips.id, id),
    });

    if (!existingTrip) {
      return c.json({ message: HttpStatusPhrases.NOT_FOUND }, HttpStatusCodes.NOT_FOUND);
    }

    const isAdmin = user.role === 'admin';
    const isRider = existingTrip.riderId === user.id;
    const isDriver = user.driver && existingTrip.driverId === user.driver.id;

    if (!isAdmin && !isRider && !isDriver) {
      return c.json({ message: HttpStatusPhrases.FORBIDDEN }, HttpStatusCodes.FORBIDDEN);
    }

    const [updatedTrip] = await db
      .update(trips)
      .set(updates)
      .where(eq(trips.id, id))
      .returning();

    return c.json(updatedTrip, HttpStatusCodes.OK);
  } catch (error) {
    console.error('Error updating trip:', error);
    return c.json(
      { message: 'Failed to update trip' },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// Cancel trip handler
export const cancelTrip: AppRouteHandler<CancelTripRoute> = async (c) => {
  const { id } = c.req.valid('param');
  const user = c.get('user');

  if (!user) {
    return c.json({ message: HttpStatusPhrases.UNAUTHORIZED }, HttpStatusCodes.UNAUTHORIZED);
  }

  try {
    const trip = await db.query.trips.findFirst({
      where: eq(trips.id, id),
    });

    if (!trip) {
      return c.json({ message: HttpStatusPhrases.NOT_FOUND }, HttpStatusCodes.NOT_FOUND);
    }

    // Only rider, assigned driver, or admin can cancel
    const isAdmin = user.role === 'admin';
    const isRider = trip.riderId === user.id;
    const isDriver = user.driver && trip.driverId === user.driver.id;

    if (!isAdmin && !isRider && !isDriver) {
      return c.json({ message: HttpStatusPhrases.FORBIDDEN }, HttpStatusCodes.FORBIDDEN);
    }

    // Can only cancel pending or accepted trips
    if (!['pending', 'accepted'].includes(trip.status)) {
      return c.json(
        { message: 'Can only cancel pending or accepted trips' },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const [cancelledTrip] = await db
      .update(trips)
      .set({
        status: 'cancelled',
        cancelledAt: new Date(),
      })
      .where(eq(trips.id, id))
      .returning();

    return c.json(cancelledTrip, HttpStatusCodes.OK);
  } catch (error) {
    console.error('Error cancelling trip:', error);
    return c.json(
      { message: 'Failed to cancel trip' },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// Start trip handler
export const startTrip: AppRouteHandler<StartTripRoute> = async (c) => {
  const { id } = c.req.valid('param');
  const user = c.get('user');

  if (!user || !user.driver) {
    return c.json({ message: 'Only drivers can start trips' }, HttpStatusCodes.FORBIDDEN);
  }

  try {
    const trip = await db.query.trips.findFirst({
      where: eq(trips.id, id),
    });

    if (!trip) {
      return c.json({ message: HttpStatusPhrases.NOT_FOUND }, HttpStatusCodes.NOT_FOUND);
    }

    // Only assigned driver can start the trip
    if (trip.driverId !== user.driver.id) {
      return c.json({ message: HttpStatusPhrases.FORBIDDEN }, HttpStatusCodes.FORBIDDEN);
    }

    // Can only start accepted trips
    if (trip.status !== 'accepted') {
      return c.json(
        { message: 'Can only start accepted trips' },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const [startedTrip] = await db
      .update(trips)
      .set({
        status: 'in_progress',
        startTime: new Date(),
      })
      .where(eq(trips.id, id))
      .returning();

    return c.json(startedTrip, HttpStatusCodes.OK);
  } catch (error) {
    console.error('Error starting trip:', error);
    return c.json(
      { message: 'Failed to start trip' },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// Complete trip handler
export const completeTrip: AppRouteHandler<CompleteTripRoute> = async (c) => {
  const { id } = c.req.valid('param');
  const { actualDistance, actualDuration, finalPrice } = c.req.valid('json');
  const user = c.get('user');

  if (!user || !user.driver) {
    return c.json({ message: 'Only drivers can complete trips' }, HttpStatusCodes.FORBIDDEN);
  }

  try {
    const trip = await db.query.trips.findFirst({
      where: eq(trips.id, id),
    });

    if (!trip) {
      return c.json({ message: HttpStatusPhrases.NOT_FOUND }, HttpStatusCodes.NOT_FOUND);
    }

    // Only assigned driver can complete the trip
    if (trip.driverId !== user.driver.id) {
      return c.json({ message: HttpStatusPhrases.FORBIDDEN }, HttpStatusCodes.FORBIDDEN);
    }

    // Can only complete in-progress trips
    if (trip.status !== 'in_progress') {
      return c.json(
        { message: 'Can only complete in-progress trips' },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const [completedTrip] = await db
      .update(trips)
      .set({
        status: 'completed',
        endTime: new Date(),
        actualDistance,
        actualDuration,
        finalPrice,
      })
      .where(eq(trips.id, id))
      .returning();

    return c.json(completedTrip, HttpStatusCodes.OK);
  } catch (error) {
    console.error('Error completing trip:', error);
    return c.json(
      { message: 'Failed to complete trip' },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// Rate trip handler
export const rateTrip: AppRouteHandler<RateTripRoute> = async (c) => {
  const { id } = c.req.valid('param');
  const { rating, ratingType } = c.req.valid('json');
  const user = c.get('user');

  if (!user) {
    return c.json({ message: HttpStatusPhrases.UNAUTHORIZED }, HttpStatusCodes.UNAUTHORIZED);
  }

  try {
    const trip = await db.query.trips.findFirst({
      where: eq(trips.id, id),
    });

    if (!trip) {
      return c.json({ message: HttpStatusPhrases.NOT_FOUND }, HttpStatusCodes.NOT_FOUND);
    }

    // Can only rate completed trips
    if (trip.status !== 'completed') {
      return c.json(
        { message: 'Can only rate completed trips' },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    let updateData: any = {};

    if (ratingType === 'rider' && trip.riderId === user.id) {
      // Rider rating the driver
      if (trip.driverRating) {
        return c.json(
          { message: 'Driver has already been rated for this trip' },
          HttpStatusCodes.BAD_REQUEST
        );
      }
      updateData.driverRating = rating;
    } else if (ratingType === 'driver' && user.driver && trip.driverId === user.driver.id) {
      // Driver rating the rider
      if (trip.riderRating) {
        return c.json(
          { message: 'Rider has already been rated for this trip' },
          HttpStatusCodes.BAD_REQUEST
        );
      }
      updateData.riderRating = rating;
    } else {
      return c.json({ message: HttpStatusPhrases.FORBIDDEN }, HttpStatusCodes.FORBIDDEN);
    }

    const [ratedTrip] = await db
      .update(trips)
      .set(updateData)
      .where(eq(trips.id, id))
      .returning();

    return c.json(ratedTrip, HttpStatusCodes.OK);
  } catch (error) {
    console.error('Error rating trip:', error);
    return c.json(
      { message: 'Failed to rate trip' },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// Placeholder handlers for other routes
export const addWaypoint: AppRouteHandler<AddWaypointRoute> = async (c) => {
  return c.json({ message: 'Not implemented yet' }, HttpStatusCodes.NOT_IMPLEMENTED);
};

export const getWaypoints: AppRouteHandler<GetWaypointsRoute> = async (c) => {
  return c.json({ message: 'Not implemented yet' }, HttpStatusCodes.NOT_IMPLEMENTED);
};

export const updateLocation: AppRouteHandler<UpdateLocationRoute> = async (c) => {
  return c.json({ message: 'Not implemented yet' }, HttpStatusCodes.NOT_IMPLEMENTED);
};

export const getLocationUpdates: AppRouteHandler<GetLocationUpdatesRoute> = async (c) => {
  return c.json({ message: 'Not implemented yet' }, HttpStatusCodes.NOT_IMPLEMENTED);
};

// Calculate distance function
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in kilometers
}

export const searchAvailableVehicles: AppRouteHandler<SearchAvailableVehiclesRoute> = async (c) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ message: HttpStatusPhrases.UNAUTHORIZED }, HttpStatusCodes.UNAUTHORIZED);
  }

  const {
    pickupLat,
    pickupLng,
    vehicleTypeId,
    maxDistance = 10
  } = c.req.query() as {
    pickupLat?: number;
    pickupLng?: number;
    vehicleTypeId?: string;
    maxDistance?: number;
  };

  try {
    // Build conditions for available vehicles
    const conditions = [
      eq(vehicles.isActive, true),
      eq(drivers.isAvailable, true),
      eq(drivers.isVerified, true),
      isNotNull(vehicles.currentLocationLat),
      isNotNull(vehicles.currentLocationLng),
    ];

    if (vehicleTypeId) {
      conditions.push(eq(vehicles.vehicleTypeId, vehicleTypeId));
    }

    // Get busy driver IDs in a separate query
    const busyDriverIds = await db
      .select({ driverId: trips.driverId })
      .from(trips)
      .where(
        and(
          isNotNull(trips.driverId),
          inArray(trips.status, ['accepted', 'in_progress'])
        )
      );

    const busyDriverIdsList = busyDriverIds.map(d => d.driverId).filter(Boolean);

    // Add condition to exclude busy drivers
    if (busyDriverIdsList.length > 0) {
      conditions.push(not(inArray(drivers.id, busyDriverIdsList)));
    }

    // Query available vehicles with their drivers and users
    const availableVehicles = await db
      .select({
        vehicle: vehicles,
        driver: drivers,
        user: user,
      })
      .from(vehicles)
      .innerJoin(drivers, eq(vehicles.driverId, drivers.id))
      .innerJoin(user, eq(drivers.userId, user.id))
      .where(and(...conditions));

    // Calculate distances if pickup coordinates are provided
    let results = availableVehicles.map(item => ({
      vehicle: item.vehicle,
      driver: {
        id: item.driver.id,
        name: item.user.name || 'Unknown Driver',
        rating: item.driver.rating,
        totalTrips: item.driver.totalTrips,
        isAvailable: item.driver.isAvailable,
      },
      distanceFromPickup: undefined as number | undefined,
      estimatedArrivalTime: undefined as number | undefined,
    }));

    if (pickupLat && pickupLng) {
      results = results
        .map((item) => {
          const distance = calculateDistance(
            pickupLat,
            pickupLng,
            item.vehicle.currentLocationLat!,
            item.vehicle.currentLocationLng!
          );

          const estimatedArrivalTime = Math.round(distance * 2); // 2 minutes per km

          return {
            ...item,
            distanceFromPickup: Math.round(distance * 100) / 100,
            estimatedArrivalTime,
          };
        })
        .filter((item) => item.distanceFromPickup! <= maxDistance)
        .sort((a, b) => a.distanceFromPickup! - b.distanceFromPickup!);
    }

    return c.json(results, HttpStatusCodes.OK);
  } catch (error) {
    console.error('Error searching available vehicles:', error);
    return c.json(
      { message: 'Failed to search available vehicles' },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};
