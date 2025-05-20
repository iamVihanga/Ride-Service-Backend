import { desc, eq, sql } from 'drizzle-orm';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import * as HttpStatusPhrases from 'stoker/http-status-phrases';

import type { AppRouteHandler } from '@/types';

import { db } from '@/db';
import { vehicles, vehicleTypes } from '@/db/schema';

import type { AddVehicleRoute, AddVehicleTypeRoute, ListVehiclesRoute, Query, SelectVehicleTypeRoute } from './vehicles.routes';

// List tasks route handler
export const listVehicles: AppRouteHandler<ListVehiclesRoute> = async (c) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ message: HttpStatusPhrases.FORBIDDEN }, HttpStatusCodes.FORBIDDEN);
  }

  // This filters system admin role
  const isAdmin = user?.role === 'admin';

  const { page = '1', limit = '10' } = c.req.query() as Query;

  // Convert to numbers and validate
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.max(1, Math.min(100, parseInt(limit))); // Cap at 100 items
  const offset = (pageNum - 1) * limitNum;

  // If the user is not an admin, we need to filter by driver
  if (!isAdmin) {
    if (!user.driver) {
      return c.json({ message: HttpStatusPhrases.FORBIDDEN }, HttpStatusCodes.FORBIDDEN);
    }

    const driverVehicles = await db.query.vehicles.findMany({
      where: eq(vehicles.driverId, user.driver.id),
    });

    console.log('Driver vehicles:', driverVehicles);

    return c.json(
      {
        vehicles: driverVehicles,
        pagination: {
          total: driverVehicles.length,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(driverVehicles.length / limitNum),
        },
      },
      HttpStatusCodes.OK
    );
  }

  // If the user is an admin, we can return all vehicles
  // First, get the total count
  const countQuery = db
    .select({
      count: sql<number>`cast(count(*) as integer)`,
    })
    .from(vehicles)
    .$dynamic();

  // Build the main query for items
  const itemsQuery = db.select().from(vehicles).$dynamic();

  // Execute both queries
  const [countResult] = await countQuery;

  const items = await itemsQuery.limit(limitNum).offset(offset).orderBy(desc(vehicles.createdAt));

  const total = countResult.count;

  return c.json(
    {
      vehicles: items,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    },
    200
  );
};

// Add vehicle to driver route handler
export const addVehicle: AppRouteHandler<AddVehicleRoute> = async (c) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ message: HttpStatusPhrases.FORBIDDEN }, HttpStatusCodes.FORBIDDEN);
  }

  const body = c.req.valid('json');

  const addedVehicle = await db.insert(vehicles).values(body).returning();

  return c.json(addedVehicle[0], HttpStatusCodes.OK);
};

// Get vehicle types route handler
export const selectVehicleTypes: AppRouteHandler<SelectVehicleTypeRoute> = async (c) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ message: HttpStatusPhrases.FORBIDDEN }, HttpStatusCodes.FORBIDDEN);
  }

  const allVehicleTypes = await db.select().from(vehicleTypes);

  return c.json(allVehicleTypes, HttpStatusCodes.OK);
};

// Add vehicle type route handler
export const addVehicleType: AppRouteHandler<AddVehicleTypeRoute> = async (c) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ message: HttpStatusPhrases.FORBIDDEN }, HttpStatusCodes.FORBIDDEN);
  }

  const body = c.req.valid('json');

  const createType = await db.insert(vehicleTypes).values(body).returning();

  return c.json(createType[0], HttpStatusCodes.OK);
};
