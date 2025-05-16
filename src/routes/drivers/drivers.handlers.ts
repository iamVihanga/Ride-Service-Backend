import { eq } from 'drizzle-orm';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import * as HttpStatusPhrases from 'stoker/http-status-phrases';

import type { AppRouteHandler } from '@/types';

import { db } from '@/db';
import { drivers, user } from '@/db/schema';
import { ZOD_ERROR_CODES, ZOD_ERROR_MESSAGES } from '@/lib/constants';

import type { CreateRoute, GetOneRoute, ListRoute, PatchRoute, RemoveRoute } from './drivers.routes';

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

  // Check user exists
  const userExists = await db.query.user.findFirst({
    where: eq(user?.id, session.userId),
  });

  if (!userExists) {
    return c.json({ message: HttpStatusPhrases.NOT_FOUND }, HttpStatusCodes.NOT_FOUND);
  }

  const driverData = c.req.valid('json');

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

// Update task route handler
export const patch: AppRouteHandler<PatchRoute> = async (c) => {
  const { id } = c.req.valid('param');
  const updates = c.req.valid('json');

  // Checs at least one field is present in the request body
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

  const result = await db.delete(drivers).where(eq(drivers.id, id));

  if (result.rows.length === 0) {
    return c.json({ message: HttpStatusPhrases.NOT_FOUND }, HttpStatusCodes.NOT_FOUND);
  }

  return c.body(null, HttpStatusCodes.NO_CONTENT);
};
