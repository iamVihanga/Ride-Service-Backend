import { createRoute, z } from '@hono/zod-openapi';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import { jsonContent, jsonContentRequired } from 'stoker/openapi/helpers';

import { serverAuthMiddleware } from '@/middlewares/auth-middleware';

import { insertVehicleSchema, insertVehicleTypeSchema, selectVehicleSchema, selectVehicleTypesSchema } from './vehicles.schema';

const tags: string[] = ['Vehicles'];

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

// ---------- Add Vehicle to Session User ----------
export const addVehicle = createRoute({
  tags,
  summary: 'Add vehicle to session user',
  path: '/',
  method: 'post',
  middleware: [serverAuthMiddleware],
  request: {
    body: jsonContentRequired(insertVehicleSchema, 'Vehicle details with Driver ID'),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(selectVehicleSchema, 'The vehicle details'),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(z.object({ message: z.string() }), 'Unauthenticated request'),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(z.object({ message: z.string() }), 'Access Forbidden'),
  },
});

export type AddVehicleRoute = typeof addVehicle;

// ---------- Get Vehicle types ----------
export const selectVehicleTypes = createRoute({
  tags,
  summary: 'Get vehicle Types',
  path: '/types',
  method: 'get',
  middleware: [serverAuthMiddleware],
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.array(selectVehicleTypesSchema), 'The vehicle types'),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(z.object({ message: z.string() }), 'Unauthenticated request'),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(z.object({ message: z.string() }), 'Access Forbidden'),
  },
});

export type SelectVehicleTypeRoute = typeof selectVehicleTypes;

// ---------- Add Vehicle Types ---------
export const addVehicleType = createRoute({
  tags,
  summary: 'Add vehicle Type',
  path: '/types',
  method: 'post',
  middleware: [serverAuthMiddleware],
  request: {
    body: jsonContentRequired(insertVehicleTypeSchema, 'Vehicle type details'),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(selectVehicleTypesSchema, 'The vehicle details'),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(z.object({ message: z.string() }), 'Unauthenticated request'),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(z.object({ message: z.string() }), 'Access Forbidden'),
  },
});

export type AddVehicleTypeRoute = typeof addVehicleType;
