import { createRoute, z } from '@hono/zod-openapi';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import { jsonContent, jsonContentRequired } from 'stoker/openapi/helpers';
import { createErrorSchema } from 'stoker/openapi/schemas';

import { notFoundSchema } from '@/lib/constants';
import { serverAuthMiddleware } from '@/middlewares/auth-middleware';
import { tripBids } from '@/routes/bids/bids.schema';

const tags: string[] = ['Trip Bids'];

const IdParamsSchema = z.object({ id: z.string() });
const TripIdParamsSchema = z.object({ tripId: z.string() });
const DriverIdParamsSchema = z.object({ driverId: z.string() });

// Create Zod schemas from Drizzle schemas
export const selectTripBidSchema = createSelectSchema(tripBids);

export type SelectTripBid = z.infer<typeof selectTripBidSchema>;

export const insertTripBidSchema = createInsertSchema(tripBids, {
  tripId: z.string().uuid(),
  driverId: z.string().uuid(),
  vehicleId: z.string().uuid(),
  bidAmount: z.number().positive(),
  estimatedArrivalTime: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: 'estimatedArrivalTime must be a valid date string',
    })
    .transform((val) => new Date(val))
    .optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  isSelected: true, // This should be controlled by the system, not user input
});

export type InsertTripBid = z.infer<typeof insertTripBidSchema>;

export const updateTripBidSchema = createInsertSchema(tripBids).partial().omit({
  id: true,
  tripId: true, // Cannot change trip association
  driverId: true, // Cannot change driver association
  vehicleId: true, // Cannot change vehicle association
  createdAt: true,
  updatedAt: true,
});

export type UpdateTripBid = z.infer<typeof updateTripBidSchema>;

// Query parameters for listing bids
const querySchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('10'),
  status: z.string().optional(),
  tripId: z.string().uuid().optional(),
  driverId: z.string().uuid().optional(),
});

export type BidQuery = {
  page?: string;
  limit?: string;
  status?: string;
  tripId?: string;
  driverId?: string;
};

// Response schema for pagination
const bidsWithPaginationSchema = z.object({
  bids: z.array(selectTripBidSchema),
  pagination: z.object({
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    totalPages: z.number(),
  }),
});

// ---------- Trip Bids Routes ----------

// List bids route
export const listBids = createRoute({
  tags,
  summary: 'List all bids',
  path: '/',
  method: 'get',
  middleware: [serverAuthMiddleware],
  request: {
    query: querySchema,
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(bidsWithPaginationSchema, 'List of bids with pagination'),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(z.object({ message: z.string() }), 'Unauthenticated request'),
  },
});

// Create bid route
export const createBid = createRoute({
  tags,
  summary: 'Create a new bid',
  path: '/',
  method: 'post',
  middleware: [serverAuthMiddleware],
  request: {
    body: jsonContentRequired(insertTripBidSchema, 'Bid details'),
  },
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(selectTripBidSchema, 'The created bid'),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(z.object({ message: z.string() }), 'Unauthenticated request'),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(createErrorSchema(insertTripBidSchema), 'Validation errors'),
  },
});

// Get bid by ID route
export const getBid = createRoute({
  tags,
  summary: 'Get bid details',
  path: '/{id}',
  method: 'get',
  middleware: [serverAuthMiddleware],
  request: {
    params: IdParamsSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(selectTripBidSchema, 'Bid details'),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(z.object({ message: z.string() }), 'Unauthenticated request'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, 'Bid not found'),
  },
});

// Update bid route
export const updateBid = createRoute({
  tags,
  summary: 'Update bid details',
  path: '/{id}',
  method: 'patch',
  middleware: [serverAuthMiddleware],
  request: {
    params: IdParamsSchema,
    body: jsonContentRequired(updateTripBidSchema, 'Bid update details'),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(selectTripBidSchema, 'Updated bid details'),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(z.object({ message: z.string() }), 'Unauthenticated request'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, 'Bid not found'),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(createErrorSchema(updateTripBidSchema), 'Validation errors'),
  },
});

// Delete bid route
export const deleteBid = createRoute({
  tags,
  summary: 'Delete a bid',
  path: '/{id}',
  method: 'delete',
  middleware: [serverAuthMiddleware],
  request: {
    params: IdParamsSchema,
  },
  responses: {
    [HttpStatusCodes.NO_CONTENT]: {
      description: 'Bid deleted successfully',
    },
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(z.object({ message: z.string() }), 'Unauthenticated request'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, 'Bid not found'),
  },
});

// Get bids for a trip route
export const getTripsForBid = createRoute({
  tags,
  summary: "Get a trip's bids",
  path: '/trip/{tripId}',
  method: 'get',
  middleware: [serverAuthMiddleware],
  request: {
    params: TripIdParamsSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.array(selectTripBidSchema), 'Bids for the trip'),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(z.object({ message: z.string() }), 'Unauthenticated request'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, 'Trip not found'),
  },
});

// Get bids from a driver route
export const getBidsFromDriver = createRoute({
  tags,
  summary: "Get a driver's bids",
  path: '/driver/{driverId}',
  method: 'get',
  middleware: [serverAuthMiddleware],
  request: {
    params: DriverIdParamsSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.array(selectTripBidSchema), 'Bids from the driver'),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(z.object({ message: z.string() }), 'Unauthenticated request'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, 'Driver not found'),
  },
});

// Accept a bid route
export const acceptBid = createRoute({
  tags,
  summary: 'Accept a bid',
  path: '/{id}/accept',
  method: 'post',
  middleware: [serverAuthMiddleware],
  request: {
    params: IdParamsSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(selectTripBidSchema, 'Accepted bid'),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(z.object({ message: z.string() }), 'Unauthenticated request'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, 'Bid not found'),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(z.object({ message: z.string() }), 'Bid cannot be accepted'),
  },
});

// Reject a bid route
export const rejectBid = createRoute({
  tags,
  summary: 'Reject a bid',
  path: '/{id}/reject',
  method: 'post',
  middleware: [serverAuthMiddleware],
  request: {
    params: IdParamsSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(selectTripBidSchema, 'Rejected bid'),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(z.object({ message: z.string() }), 'Unauthenticated request'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, 'Bid not found'),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(z.object({ message: z.string() }), 'Bid cannot be rejected'),
  },
});

// ---------- Export route types ----------
export type ListBidsRoute = typeof listBids;
export type CreateBidRoute = typeof createBid;
export type GetBidRoute = typeof getBid;
export type UpdateBidRoute = typeof updateBid;
export type DeleteBidRoute = typeof deleteBid;
export type GetTripsForBidRoute = typeof getTripsForBid;
export type GetBidsFromDriverRoute = typeof getBidsFromDriver;
export type AcceptBidRoute = typeof acceptBid;
export type RejectBidRoute = typeof rejectBid;
