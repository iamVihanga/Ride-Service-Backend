import { eq } from 'drizzle-orm';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import * as HttpStatusPhrases from 'stoker/http-status-phrases';

import type { AppRouteHandler } from '@/types';

import { db } from '@/db';
import { drivers, user, vehicles } from '@/db/schema';
import { ZOD_ERROR_CODES, ZOD_ERROR_MESSAGES } from '@/lib/constants';

import type { CreateRoute, GetOneRoute, GetVehiclesRoute, ListRoute, PatchRoute, RemoveRoute } from './drivers.routes';

// List drivers route handler
export const list: AppRouteHandler<ListRoute> = async (c) => {
  const drivers = await db.query.drivers.findMany();

  return c.json(drivers);
};

// Create new driver route handler
export const create: AppRouteHandler<CreateRoute> = async (c) => {
  // Validate Auth
  const session = c.get('session');

  if (!session) {
    return c.json({ message: HttpStatusPhrases.FORBIDDEN }, HttpStatusCodes.FORBIDDEN);
  }

  // Check user exists - Fixed the query
  const userExists = await db.query.user.findFirst({
    where: eq(user.id, session.userId),
  });

  if (!userExists) {
    return c.json({ message: HttpStatusPhrases.NOT_FOUND }, HttpStatusCodes.NOT_FOUND);
  }

  const driverData = c.req.valid('json');

  // Check if driver already exists for this user
  const existingDriver = await db.query.drivers.findFirst({
    where: eq(drivers.userId, session.userId),
  });

  if (existingDriver) {
    return c.json({ message: 'Driver record already exists for this user' }, HttpStatusCodes.CONFLICT);
  }

  const [inserted] = await db.insert(drivers).values(driverData).returning();

  return c.json(inserted, HttpStatusCodes.CREATED);
};

// Get single driver route handler
export const getOne: AppRouteHandler<GetOneRoute> = async (c) => {
  const { id } = c.req.valid('param');

  const driver = await db.query.drivers.findFirst({
    where: eq(drivers.id, id),
  });

  if (!driver) return c.json({ message: HttpStatusPhrases.NOT_FOUND }, HttpStatusCodes.NOT_FOUND);

  return c.json(driver, HttpStatusCodes.OK);
};

// Update driver route handler
export const patch: AppRouteHandler<PatchRoute> = async (c) => {
  const { id } = c.req.valid('param');
  const updates = c.req.valid('json');

  // Check at least one field is present in the request body
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

  const [driver] = await db.update(drivers).set(updates).where(eq(drivers.id, id)).returning();

  if (!driver) {
    return c.json(
      {
        message: HttpStatusPhrases.NOT_FOUND,
      },
      HttpStatusCodes.NOT_FOUND
    );
  }

  return c.json(driver, HttpStatusCodes.OK);
};

// Remove driver route handler
export const remove: AppRouteHandler<RemoveRoute> = async (c) => {
  const { id } = c.req.valid('param');

  // Fixed: Check rowCount instead of rows.length
  const result = await db.delete(drivers).where(eq(drivers.id, id));

  if (result.rowCount === 0) {
    return c.json({ message: HttpStatusPhrases.NOT_FOUND }, HttpStatusCodes.NOT_FOUND);
  }

  return c.body(null, HttpStatusCodes.NO_CONTENT);
};

// Get driver vehicles handler
export const getVehicles: AppRouteHandler<GetVehiclesRoute> = async (c) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ message: HttpStatusPhrases.UNAUTHORIZED }, HttpStatusCodes.UNAUTHORIZED);
  }

  // Get driver ID from params
  const { id } = c.req.valid('param');

  // First, check if the driver exists
  const driver = await db.query.drivers.findFirst({
    where: eq(drivers.id, id),
  });

  if (!driver) {
    return c.json({ message: 'Driver not found' }, HttpStatusCodes.NOT_FOUND);
  }

  // Check if user is authorized to access this data
  // Only admins or the driver themselves can access their vehicles
  const isAdmin = user.role === 'admin';
  const isOwnDriver = driver.userId === user.id;

  if (!isAdmin && !isOwnDriver) {
    return c.json({ message: HttpStatusPhrases.FORBIDDEN }, HttpStatusCodes.FORBIDDEN);
  }

  // Fetch the driver's vehicles
  const driverVehicles = await db.query.vehicles.findMany({
    where: eq(vehicles.driverId, id),
  });

  // Return the driver with their vehicles
  return c.json(
    {
      ...driver,
      vehicles: driverVehicles,
    },
    HttpStatusCodes.OK
  );
};
