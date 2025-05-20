import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import * as HttpStatusPhrases from 'stoker/http-status-phrases';

import type { AppRouteHandler } from '@/types';

import { db } from '@/db';
import { drivers, trips, tripBids, vehicles } from '@/db/schema';
import { ZOD_ERROR_CODES, ZOD_ERROR_MESSAGES } from '@/lib/constants';

import type {
  AcceptBidRoute,
  BidQuery,
  CreateBidRoute,
  DeleteBidRoute,
  GetBidRoute,
  GetBidsFromDriverRoute,
  GetTripsForBidRoute,
  ListBidsRoute,
  RejectBidRoute,
  UpdateBidRoute,
} from './bids.routes';

// ---------- Trip Bids Handlers ----------

// List bids handler
export const listBids: AppRouteHandler<ListBidsRoute> = async (c) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ message: HttpStatusPhrases.UNAUTHORIZED }, HttpStatusCodes.UNAUTHORIZED);
  }

  const { page = '1', limit = '10', status, tripId, driverId } = c.req.query() as BidQuery;

  // Convert to numbers and validate
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.max(1, Math.min(100, parseInt(limit))); // Cap at 100 items
  const offset = (pageNum - 1) * limitNum;

  // Build the base query
  let query = db.select().from(tripBids);
  let countQuery = db
    .select({
      count: sql<number>`cast(count(*) as integer)`,
    })
    .from(tripBids);

  // Add filters if provided
  const whereConditions = [];

  if (status) {
    whereConditions.push(eq(tripBids.status, status));
  }

  if (tripId) {
    whereConditions.push(eq(tripBids.tripId, tripId));
  }

  if (driverId) {
    whereConditions.push(eq(tripBids.driverId, driverId));
  }

  // Check if the user is a driver, then only show their bids
  if (user.driver && user.role !== 'admin') {
    whereConditions.push(eq(tripBids.driverId, user.driver.id));
  }

  // Apply where conditions if any exist
  if (whereConditions.length > 0) {
    const combinedCondition = whereConditions.reduce((acc, condition) => and(acc, condition));
    query = query.where(combinedCondition);
    countQuery = countQuery.where(combinedCondition);
  }

  // Execute both queries
  const [countResult] = await countQuery;
  const items = await query.limit(limitNum).offset(offset).orderBy(desc(tripBids.createdAt));

  const total = countResult?.count || 0;

  return c.json(
    {
      bids: items,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    },
    HttpStatusCodes.OK
  );
};

// Create bid handler
export const createBid: AppRouteHandler<CreateBidRoute> = async (c) => {
  const user = c.get('user');

  if (!user || !user.driver) {
    return c.json({ message: 'Only drivers can create bids' }, HttpStatusCodes.UNAUTHORIZED);
  }

  const bidData = c.req.valid('json');

  // Verify the driver owns the vehicle
  const vehicle = await db.query.vehicles.findFirst({
    where: and(eq(vehicles.id, bidData.vehicleId), eq(vehicles.driverId, bidData.driverId)),
  });

  if (!vehicle) {
    return c.json(
      {
        message: 'The vehicle does not belong to this driver',
      },
      HttpStatusCodes.UNPROCESSABLE_ENTITY
    );
  }

  // Verify the trip exists and is in 'pending' status
  const trip = await db.query.trips.findFirst({
    where: eq(trips.id, bidData.tripId),
  });

  if (!trip) {
    return c.json(
      {
        message: 'Trip not found',
      },
      HttpStatusCodes.UNPROCESSABLE_ENTITY
    );
  }

  if (trip.status !== 'pending') {
    return c.json(
      {
        message: 'Bids can only be placed on pending trips',
      },
      HttpStatusCodes.UNPROCESSABLE_ENTITY
    );
  }

  try {
    const [inserted] = await db.insert(tripBids).values(bidData).returning();
    return c.json(inserted, HttpStatusCodes.CREATED);
  } catch (error) {
    console.error('Error creating bid:', error);
    return c.json(
      {
        message: 'Failed to create bid. You may have already placed a bid for this trip with this vehicle.',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      HttpStatusCodes.UNPROCESSABLE_ENTITY
    );
  }
};

// Get bid by ID handler
export const getBid: AppRouteHandler<GetBidRoute> = async (c) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ message: HttpStatusPhrases.UNAUTHORIZED }, HttpStatusCodes.UNAUTHORIZED);
  }

  const { id } = c.req.valid('param');

  const bid = await db.query.tripBids.findFirst({
    where: eq(tripBids.id, id),
    with: {
      trip: true,
      driver: true,
      vehicle: true,
    },
  });

  if (!bid) {
    return c.json({ message: HttpStatusPhrases.NOT_FOUND }, HttpStatusCodes.NOT_FOUND);
  }

  // Check authorization - drivers can only see their own bids unless they're admins
  if (user.driver && bid.driverId !== user.driver.id && user.role !== 'admin') {
    return c.json({ message: HttpStatusPhrases.FORBIDDEN }, HttpStatusCodes.FORBIDDEN);
  }

  return c.json(bid, HttpStatusCodes.OK);
};

// Update bid handler
export const updateBid: AppRouteHandler<UpdateBidRoute> = async (c) => {
  const user = c.get('user');

  if (!user || !user.driver) {
    return c.json({ message: 'Only drivers can update bids' }, HttpStatusCodes.UNAUTHORIZED);
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

  // Get the bid to check authorization
  const existingBid = await db.query.tripBids.findFirst({
    where: eq(tripBids.id, id),
  });

  if (!existingBid) {
    return c.json({ message: HttpStatusPhrases.NOT_FOUND }, HttpStatusCodes.NOT_FOUND);
  }

  // Check authorization - drivers can only update their own bids
  if (existingBid.driverId !== user.driver.id && user.role !== 'admin') {
    return c.json({ message: HttpStatusPhrases.FORBIDDEN }, HttpStatusCodes.FORBIDDEN);
  }

  // Check if the bid can be updated (only pending bids can be updated)
  if (existingBid.status !== 'pending') {
    return c.json(
      {
        message: 'Only pending bids can be updated',
      },
      HttpStatusCodes.BAD_REQUEST
    );
  }

  const [updatedBid] = await db.update(tripBids).set(updates).where(eq(tripBids.id, id)).returning();

  return c.json(updatedBid, HttpStatusCodes.OK);
};

// Delete bid handler
export const deleteBid: AppRouteHandler<DeleteBidRoute> = async (c) => {
  const user = c.get('user');

  if (!user || !user.driver) {
    return c.json({ message: 'Only drivers can delete bids' }, HttpStatusCodes.UNAUTHORIZED);
  }

  const { id } = c.req.valid('param');

  // Get the bid to check authorization
  const existingBid = await db.query.tripBids.findFirst({
    where: eq(tripBids.id, id),
  });

  if (!existingBid) {
    return c.json({ message: HttpStatusPhrases.NOT_FOUND }, HttpStatusCodes.NOT_FOUND);
  }

  // Check authorization - drivers can only delete their own bids
  if (existingBid.driverId !== user.driver.id && user.role !== 'admin') {
    return c.json({ message: HttpStatusPhrases.FORBIDDEN }, HttpStatusCodes.FORBIDDEN);
  }

  // Check if the bid can be deleted (only pending bids can be deleted)
  if (existingBid.status !== 'pending') {
    return c.json(
      {
        message: 'Only pending bids can be deleted',
      },
      HttpStatusCodes.BAD_REQUEST
    );
  }

  await db.delete(tripBids).where(eq(tripBids.id, id));

  return c.body(null, HttpStatusCodes.NO_CONTENT);
};

// Get bids for a trip handler
export const getTripsForBid: AppRouteHandler<GetTripsForBidRoute> = async (c) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ message: HttpStatusPhrases.UNAUTHORIZED }, HttpStatusCodes.UNAUTHORIZED);
  }

  const { tripId } = c.req.valid('param');

  // Check if the trip exists
  const tripExists = await db.query.trips.findFirst({
    where: eq(trips.id, tripId),
  });

  if (!tripExists) {
    return c.json({ message: 'Trip not found' }, HttpStatusCodes.NOT_FOUND);
  }

  const bids = await db.query.tripBids.findMany({
    where: eq(tripBids.tripId, tripId),
    with: {
      driver: true,
      vehicle: true,
    },
    orderBy: [desc(tripBids.bidAmount)],
  });

  return c.json(bids, HttpStatusCodes.OK);
};

// Get bids from a driver handler
export const getBidsFromDriver: AppRouteHandler<GetBidsFromDriverRoute> = async (c) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ message: HttpStatusPhrases.UNAUTHORIZED }, HttpStatusCodes.UNAUTHORIZED);
  }

  const { driverId } = c.req.valid('param');

  // Check if the driver exists
  const driverExists = await db.query.drivers.findFirst({
    where: eq(drivers.id, driverId),
  });

  if (!driverExists) {
    return c.json({ message: 'Driver not found' }, HttpStatusCodes.NOT_FOUND);
  }

  // Check authorization - drivers can only see their own bids unless they're admins
  if (user.driver && driverId !== user.driver.id && user.role !== 'admin') {
    return c.json({ message: HttpStatusPhrases.FORBIDDEN }, HttpStatusCodes.FORBIDDEN);
  }

  const bids = await db.query.tripBids.findMany({
    where: eq(tripBids.driverId, driverId),
    with: {
      trip: true,
      vehicle: true,
    },
    orderBy: [desc(tripBids.createdAt)],
  });

  return c.json(bids, HttpStatusCodes.OK);
};

// Accept bid handler
export const acceptBid: AppRouteHandler<AcceptBidRoute> = async (c) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ message: HttpStatusPhrases.UNAUTHORIZED }, HttpStatusCodes.UNAUTHORIZED);
  }

  const { id } = c.req.valid('param');

  // Get the bid with related trip
  const bid = await db.query.tripBids.findFirst({
    where: eq(tripBids.id, id),
    with: {
      trip: true,
    },
  });

  if (!bid) {
    return c.json({ message: HttpStatusPhrases.NOT_FOUND }, HttpStatusCodes.NOT_FOUND);
  }

  // Check if the bid can be accepted (only pending bids can be accepted)
  if (bid.status !== 'pending') {
    return c.json(
      {
        message: 'Only pending bids can be accepted',
      },
      HttpStatusCodes.BAD_REQUEST
    );
  }

  // Check if the associated trip is still in a valid state
  if (bid.trip.status !== 'pending') {
    return c.json(
      {
        message: 'The trip is no longer accepting bids',
      },
      HttpStatusCodes.BAD_REQUEST
    );
  }

  // Transaction to update bid and trip status
  try {
    // 1. Set all other bids for this trip to 'rejected'
    await db
      .update(tripBids)
      .set({
        status: 'rejected',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(tripBids.tripId, bid.tripId),
          inArray(
            tripBids.status,
            ['pending'] // Only update pending bids, leave others as they are
          )
        )
      );

    // 2. Set this bid to 'accepted' and mark it as selected
    const [updatedBid] = await db
      .update(tripBids)
      .set({
        status: 'accepted',
        isSelected: true,
        updatedAt: new Date(),
      })
      .where(eq(tripBids.id, id))
      .returning();

    // 3. Update the trip with the driver and change status to 'accepted'
    await db
      .update(trips)
      .set({
        driverId: bid.driverId,
        status: 'accepted',
        updatedAt: new Date(),
      })
      .where(eq(trips.id, bid.tripId));

    return c.json(updatedBid, HttpStatusCodes.OK);
  } catch (error) {
    console.error('Error accepting bid:', error);
    return c.json(
      {
        message: 'Failed to accept bid',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// Reject bid handler
export const rejectBid: AppRouteHandler<RejectBidRoute> = async (c) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ message: HttpStatusPhrases.UNAUTHORIZED }, HttpStatusCodes.UNAUTHORIZED);
  }

  const { id } = c.req.valid('param');

  // Get the bid
  const bid = await db.query.tripBids.findFirst({
    where: eq(tripBids.id, id),
  });

  if (!bid) {
    return c.json({ message: HttpStatusPhrases.NOT_FOUND }, HttpStatusCodes.NOT_FOUND);
  }

  // Check if the bid can be rejected (only pending bids can be rejected)
  if (bid.status !== 'pending') {
    return c.json(
      {
        message: 'Only pending bids can be rejected',
      },
      HttpStatusCodes.BAD_REQUEST
    );
  }

  // Update the bid status to 'rejected'
  const [updatedBid] = await db
    .update(tripBids)
    .set({
      status: 'rejected',
      updatedAt: new Date(),
    })
    .where(eq(tripBids.id, id))
    .returning();

  return c.json(updatedBid, HttpStatusCodes.OK);
};