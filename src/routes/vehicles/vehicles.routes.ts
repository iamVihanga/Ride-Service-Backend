import { createRoute } from '@hono/zod-openapi';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import { jsonContent } from 'stoker/openapi/helpers';
import { z } from 'zod';

import { serverAuthMiddleware } from '@/middlewares/auth-middleware';

import { selectVehicleSchema } from './vehicles.schema';

const tags = ['Vehicles'];

// const IdParamsSchema = z.object({ id: z.string() });

const querySchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('10'),
  search: z.string().optional(),

  // Todo: Add current location params
});

export type Query = {
  page?: string;
  limit?: string;
  search?: string;
};

const withPaginationSchema = z.object({
  vehicles: z.array(selectVehicleSchema),
  pagination: z.object({
    total: z.number().default(0),
    page: z.number().default(0),
    limit: z.number().default(0),
    totalPages: z.number().default(0),
  }),
});

// ---------- List Vehicles ----------
export const listVehicles = createRoute({
  tags,
  summary: 'List all vehicles',
  path: '/',
  method: 'get',
  middleware: [serverAuthMiddleware],
  request: {
    query: querySchema,
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(withPaginationSchema, 'The list of vehicles'),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(z.object({ message: z.string() }), 'Unauthenticated request'),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(z.object({ message: z.string() }), 'Access Forbidden'),
  },
});

export type ListVehiclesRoute = typeof listVehicles;
