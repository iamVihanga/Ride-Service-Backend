import { eq } from 'drizzle-orm';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import * as HttpStatusPhrases from 'stoker/http-status-phrases';

import type { AppRouteHandler } from '@/types';

import { db } from '@/db';
import { tasks } from '@/db/schema';
import { ZOD_ERROR_CODES, ZOD_ERROR_MESSAGES } from '@/lib/constants';

import type { CreateRoute, GetOneRoute, ListRoute, PatchRoute, RemoveRoute } from './tasks.routes';

// List tasks route handler
export const list: AppRouteHandler<ListRoute> = async (c) => {
  const tasks = await db.query.tasks.findMany();

  return c.json(tasks);
};

// Create new task route handler
export const create: AppRouteHandler<CreateRoute> = async (c) => {
  // Validate Auth
  const session = c.get('session');

  if (!session) {
    return c.json({ message: HttpStatusPhrases.FORBIDDEN }, HttpStatusCodes.FORBIDDEN);
  }

  const task = c.req.valid('json');

  const [inserted] = await db.insert(tasks).values(task).returning();

  return c.json(inserted, HttpStatusCodes.CREATED);
};

// Get single task route handler
export const getOne: AppRouteHandler<GetOneRoute> = async (c) => {
  const { id } = c.req.valid('param');

  const task = await db.query.tasks.findFirst({
    where(fields, operators) {
      return operators.eq(fields.id, id);
    },
  });

  if (!task) return c.json({ message: HttpStatusPhrases.NOT_FOUND }, HttpStatusCodes.NOT_FOUND);

  return c.json(task, HttpStatusCodes.OK);
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

  const [task] = await db.update(tasks).set(updates).where(eq(tasks.id, id)).returning();

  if (!task) {
    return c.json(
      {
        message: HttpStatusPhrases.NOT_FOUND,
      },
      HttpStatusCodes.NOT_FOUND
    );
  }

  return c.json(task, HttpStatusCodes.OK);
};

// Remove task route handler
export const remove: AppRouteHandler<RemoveRoute> = async (c) => {
  const { id } = c.req.valid('param');

  const result = await db.delete(tasks).where(eq(tasks.id, id));

  if (result.rows.length === 0) {
    return c.json({ message: HttpStatusPhrases.NOT_FOUND }, HttpStatusCodes.NOT_FOUND);
  }

  return c.body(null, HttpStatusCodes.NO_CONTENT);
};
