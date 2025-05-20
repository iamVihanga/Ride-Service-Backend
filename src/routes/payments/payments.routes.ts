import { createRoute, z } from '@hono/zod-openapi';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import { jsonContent, jsonContentRequired } from 'stoker/openapi/helpers';
import { createErrorSchema } from 'stoker/openapi/schemas';

import { notFoundSchema } from '@/lib/constants';
import { serverAuthMiddleware } from '@/middlewares/auth-middleware';
import { driverPayouts, paymentMethods, payments, promoCodes } from '@/routes/payments/payments.schema';

const tags: string[] = ['Payments'];

const IdParamsSchema = z.object({ id: z.string() });

// Create Zod schemas from Drizzle schemas
export const selectPaymentSchema = createSelectSchema(payments);
export const insertPaymentSchema = createInsertSchema(payments, {
  tripId: z.string().uuid(),
  amount: z.number().positive(),
  baseFare: z.number().positive(),
  distanceFare: z.number().positive(),
  timeFare: z.number().positive(),
  serviceFee: z.number().positive(),
  tax: z.number().positive(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const updatePaymentSchema = insertPaymentSchema.partial();

export const selectPaymentMethodSchema = createSelectSchema(paymentMethods);
export const insertPaymentMethodSchema = createInsertSchema(paymentMethods, {
  userId: z.string(), // Text field in your schema
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const updatePaymentMethodSchema = insertPaymentMethodSchema.partial();

// For driver payouts
export const selectDriverPayoutSchema = createSelectSchema(driverPayouts);
export const insertDriverPayoutSchema = createInsertSchema(driverPayouts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const updateDriverPayoutSchema = insertDriverPayoutSchema.partial();

// For promo codes
export const selectPromoCodeSchema = createSelectSchema(promoCodes);
export const insertPromoCodeSchema = createInsertSchema(promoCodes, {
  startDate: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: 'startDate must be a valid date string',
    })
    .transform((val) => new Date(val)),
  endDate: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: 'endDate must be a valid date string',
    })
    .transform((val) => new Date(val)),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const updatePromoCodeSchema = insertPromoCodeSchema.partial();

// Query parameters
const querySchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('10'),
  status: z.string().optional(),
  userId: z.string().optional(),
});

export type PaymentQuery = {
  page?: string;
  limit?: string;
  status?: string;
  userId?: string;
};

// Response schemas for pagination
const paymentsWithPaginationSchema = z.object({
  payments: z.array(selectPaymentSchema),
  pagination: z.object({
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    totalPages: z.number(),
  }),
});

// ---------- Payments Routes ----------

// List payments route
export const listPayments = createRoute({
  tags,
  summary: 'List all payments',
  path: '/',
  method: 'get',
  middleware: [serverAuthMiddleware],
  request: {
    query: querySchema,
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(paymentsWithPaginationSchema, 'List of payments with pagination'),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(z.object({ message: z.string() }), 'Unauthenticated request'),
  },
});

// Create payment route
export const createPayment = createRoute({
  tags,
  summary: 'Create a new payment',
  path: '/',
  method: 'post',
  middleware: [serverAuthMiddleware],
  request: {
    body: jsonContentRequired(insertPaymentSchema, 'Payment details'),
  },
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(selectPaymentSchema, 'The created payment'),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(z.object({ message: z.string() }), 'Unauthenticated request'),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(createErrorSchema(insertPaymentSchema), 'Validation errors'),
  },
});

// Get payment by ID route
export const getPayment = createRoute({
  tags,
  summary: 'Get payment details',
  path: '/{id}',
  method: 'get',
  middleware: [serverAuthMiddleware],
  request: {
    params: IdParamsSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(selectPaymentSchema, 'Payment details'),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(z.object({ message: z.string() }), 'Unauthenticated request'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, 'Payment not found'),
  },
});

// Update payment route
export const updatePayment = createRoute({
  tags,
  summary: 'Update payment details',
  path: '/{id}',
  method: 'patch',
  middleware: [serverAuthMiddleware],
  request: {
    params: IdParamsSchema,
    body: jsonContentRequired(updatePaymentSchema, 'Payment update details'),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(selectPaymentSchema, 'Updated payment details'),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(z.object({ message: z.string() }), 'Unauthenticated request'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, 'Payment not found'),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(createErrorSchema(updatePaymentSchema), 'Validation errors'),
  },
});

// Delete payment route
export const deletePayment = createRoute({
  tags,
  summary: 'Delete a payment',
  path: '/{id}',
  method: 'delete',
  middleware: [serverAuthMiddleware],
  request: {
    params: IdParamsSchema,
  },
  responses: {
    [HttpStatusCodes.NO_CONTENT]: {
      description: 'Payment deleted successfully',
    },
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(z.object({ message: z.string() }), 'Unauthenticated request'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, 'Payment not found'),
  },
});

// ---------- Payment Methods Routes ----------
const paymentMethodsTags: string[] = ['Payment Methods'];

// List payment methods route
export const listPaymentMethods = createRoute({
  tags: paymentMethodsTags,
  summary: 'List all payment methods',
  path: '/',
  method: 'get',
  middleware: [serverAuthMiddleware],
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.array(selectPaymentMethodSchema), 'List of payment methods with pagination'),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(z.object({ message: z.string() }), 'Unauthenticated request'),
  },
});

// Create payment method route
export const createPaymentMethod = createRoute({
  tags: paymentMethodsTags,
  summary: 'Create a new payment method',
  path: '/',
  method: 'post',
  middleware: [serverAuthMiddleware],
  request: {
    body: jsonContentRequired(insertPaymentMethodSchema, 'Payment method details'),
  },
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(selectPaymentMethodSchema, 'The created payment method'),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(z.object({ message: z.string() }), 'Unauthenticated request'),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(createErrorSchema(insertPaymentMethodSchema), 'Validation errors'),
  },
});

// Get payment method by ID route
export const getPaymentMethod = createRoute({
  tags: paymentMethodsTags,
  summary: 'Get payment method details',
  path: '/{id}',
  method: 'get',
  middleware: [serverAuthMiddleware],
  request: {
    params: IdParamsSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(selectPaymentMethodSchema, 'Payment method details'),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(z.object({ message: z.string() }), 'Unauthenticated request'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, 'Payment method not found'),
  },
});

// Update payment method route
export const updatePaymentMethod = createRoute({
  tags: paymentMethodsTags,
  summary: 'Update payment method details',
  path: '/{id}',
  method: 'patch',
  middleware: [serverAuthMiddleware],
  request: {
    params: IdParamsSchema,
    body: jsonContentRequired(updatePaymentMethodSchema, 'Payment method update details'),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(selectPaymentMethodSchema, 'Updated payment method details'),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(z.object({ message: z.string() }), 'Unauthenticated request'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, 'Payment method not found'),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(createErrorSchema(updatePaymentMethodSchema), 'Validation errors'),
  },
});

// Delete payment method route
export const deletePaymentMethod = createRoute({
  tags: paymentMethodsTags,
  summary: 'Delete a payment method',
  path: '/{id}',
  method: 'delete',
  middleware: [serverAuthMiddleware],
  request: {
    params: IdParamsSchema,
  },
  responses: {
    [HttpStatusCodes.NO_CONTENT]: {
      description: 'Payment method deleted successfully',
    },
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(z.object({ message: z.string() }), 'Unauthenticated request'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, 'Payment method not found'),
  },
});

// ---------- Export route types ----------
export type ListPaymentsRoute = typeof listPayments;
export type CreatePaymentRoute = typeof createPayment;
export type GetPaymentRoute = typeof getPayment;
export type UpdatePaymentRoute = typeof updatePayment;
export type DeletePaymentRoute = typeof deletePayment;

export type ListPaymentMethodsRoute = typeof listPaymentMethods;
export type CreatePaymentMethodRoute = typeof createPaymentMethod;
export type GetPaymentMethodRoute = typeof getPaymentMethod;
export type UpdatePaymentMethodRoute = typeof updatePaymentMethod;
export type DeletePaymentMethodRoute = typeof deletePaymentMethod;
