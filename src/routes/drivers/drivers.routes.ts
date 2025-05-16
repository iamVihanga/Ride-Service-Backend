import { createRoute, z } from '@hono/zod-openapi';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import { jsonContent, jsonContentRequired } from 'stoker/openapi/helpers';
import { createErrorSchema, IdParamsSchema } from 'stoker/openapi/schemas';

import { notFoundSchema } from '@/lib/constants';
import { serverAuthMiddleware } from '@/middlewares/auth-middleware';

import { insertDriverSchema, selectDriverSchema, updateDriverSchema } from './drivers.schema';

const tags: string[] = ['Drivers'];

// List route definition
export const list = createRoute({
  tags,
  summary: 'List all drivers',
  path: '/',
  method: 'get',
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.array(selectDriverSchema), 'The list of tasks'),
  },
});

// Create route definition
export const create = createRoute({
  tags,
  summary: 'Create a new driver record',
  path: '/',
  method: 'post',
  middleware: [serverAuthMiddleware],
  request: {
    body: jsonContentRequired(insertDriverSchema, 'The driver to create'),
  },
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(selectDriverSchema, 'The created driver'),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(z.object({ message: z.string() }), 'Access Forbidden'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(z.object({ message: z.string() }), 'User not found'),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(createErrorSchema(insertDriverSchema), 'The validation error(s)'),
  },
});

// Get single driver route definition
export const getOne = createRoute({
  tags,
  summary: 'Get a single driver',
  method: 'get',
  path: '/{id}',
  middleware: [serverAuthMiddleware],
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(selectDriverSchema, 'Requested driver'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, 'Driver not found'),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(createErrorSchema(IdParamsSchema), 'Invalid ID format'),
  },
});

// Patch route definition
export const patch = createRoute({
  tags,
  summary: 'Update a driver',
  path: '/{id}',
  method: 'patch',
  middleware: [serverAuthMiddleware],
  request: {
    params: z.object({ id: z.string() }),
    body: jsonContentRequired(updateDriverSchema, 'The driver updates'),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(selectDriverSchema, 'The updated driver'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, 'Driver not found'),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(createErrorSchema(updateDriverSchema).or(createErrorSchema(IdParamsSchema)), 'The validation error(s)'),
  },
});

// Remove driver route definition
export const remove = createRoute({
  tags,
  summary: 'Remove a driver',
  path: '/{id}',
  method: 'delete',
  middleware: [serverAuthMiddleware],
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    [HttpStatusCodes.NO_CONTENT]: {
      description: 'Driver deleted',
    },
    [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, 'Driver not found'),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(createErrorSchema(IdParamsSchema), 'Invalid ID format'),
  },
});

export type ListRoute = typeof list;
export type CreateRoute = typeof create;
export type GetOneRoute = typeof getOne;
export type PatchRoute = typeof patch;
export type RemoveRoute = typeof remove;
