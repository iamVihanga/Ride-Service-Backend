import { and, desc, eq, sql } from 'drizzle-orm';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import * as HttpStatusPhrases from 'stoker/http-status-phrases';

import type { AppRouteHandler } from '@/types';

import { db } from '@/db';
import { paymentMethods, payments } from '@/db/schema';
import { ZOD_ERROR_CODES, ZOD_ERROR_MESSAGES } from '@/lib/constants';

import type {
  CreatePaymentMethodRoute,
  CreatePaymentRoute,
  DeletePaymentMethodRoute,
  DeletePaymentRoute,
  GetPaymentMethodRoute,
  GetPaymentRoute,
  ListPaymentMethodsRoute,
  ListPaymentsRoute,
  PaymentQuery,
  UpdatePaymentMethodRoute,
  UpdatePaymentRoute,
} from './payments.routes';

// ---------- Payments Handlers ----------

// List payments handler
export const listPayments: AppRouteHandler<ListPaymentsRoute> = async (c) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ message: HttpStatusPhrases.UNAUTHORIZED }, HttpStatusCodes.UNAUTHORIZED);
  }

  const { page = '1', limit = '10', status } = c.req.query() as PaymentQuery;

  // Convert to numbers and validate
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.max(1, Math.min(100, parseInt(limit))); // Cap at 100 items
  const offset = (pageNum - 1) * limitNum;

  // Build the base query
  let query = db.select().from(payments);
  let countQuery = db
    .select({
      count: sql<number>`cast(count(*) as integer)`,
    })
    .from(payments);

  // Add filters if provided
  const whereConditions = [];

  if (status) {
    whereConditions.push(eq(payments.status, status));
  }

  // Apply where conditions if any exist
  if (whereConditions.length > 0) {
    const combinedCondition = whereConditions.reduce((acc, condition) => and(acc, condition));
    query = query.where(combinedCondition);
    countQuery = countQuery.where(combinedCondition);
  }

  // Execute both queries
  const [countResult] = await countQuery;
  const items = await query.limit(limitNum).offset(offset).orderBy(desc(payments.createdAt));

  const total = countResult?.count || 0;

  return c.json(
    {
      payments: items,
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

// Create payment handler
export const createPayment: AppRouteHandler<CreatePaymentRoute> = async (c) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ message: HttpStatusPhrases.UNAUTHORIZED }, HttpStatusCodes.UNAUTHORIZED);
  }

  const paymentData = c.req.valid('json');

  try {
    const [inserted] = await db.insert(payments).values(paymentData).returning();
    return c.json(inserted, HttpStatusCodes.CREATED);
  } catch (error) {
    console.error('Error creating payment:', error);
    return c.json(
      {
        message: 'Failed to create payment. The trip may already have a payment associated with it.',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      HttpStatusCodes.UNPROCESSABLE_ENTITY
    );
  }
};

// Get payment by ID handler
export const getPayment: AppRouteHandler<GetPaymentRoute> = async (c) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ message: HttpStatusPhrases.UNAUTHORIZED }, HttpStatusCodes.UNAUTHORIZED);
  }

  const { id } = c.req.valid('param');

  const payment = await db.query.payments.findFirst({
    where: eq(payments.id, id),
    with: {
      trip: true,
      paymentMethod: true,
      promoCode: true,
    },
  });

  if (!payment) {
    return c.json({ message: HttpStatusPhrases.NOT_FOUND }, HttpStatusCodes.NOT_FOUND);
  }

  return c.json(payment, HttpStatusCodes.OK);
};

// Update payment handler
export const updatePayment: AppRouteHandler<UpdatePaymentRoute> = async (c) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ message: HttpStatusPhrases.UNAUTHORIZED }, HttpStatusCodes.UNAUTHORIZED);
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

  const [payment] = await db.update(payments).set(updates).where(eq(payments.id, id)).returning();

  if (!payment) {
    return c.json({ message: HttpStatusPhrases.NOT_FOUND }, HttpStatusCodes.NOT_FOUND);
  }

  return c.json(payment, HttpStatusCodes.OK);
};

// Delete payment handler
export const deletePayment: AppRouteHandler<DeletePaymentRoute> = async (c) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ message: HttpStatusPhrases.UNAUTHORIZED }, HttpStatusCodes.UNAUTHORIZED);
  }

  const { id } = c.req.valid('param');

  const result = await db.delete(payments).where(eq(payments.id, id));

  if (result.rows.length === 0) {
    return c.json({ message: HttpStatusPhrases.NOT_FOUND }, HttpStatusCodes.NOT_FOUND);
  }

  return c.body(null, HttpStatusCodes.NO_CONTENT);
};

// ---------- Payment Methods Handlers ----------

// List payment methods handler
export const listPaymentMethods: AppRouteHandler<ListPaymentMethodsRoute> = async (c) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ message: HttpStatusPhrases.UNAUTHORIZED }, HttpStatusCodes.UNAUTHORIZED);
  }

  // Build the base query
  const items = await db.select().from(paymentMethods).where(eq(paymentMethods.userId, user.id)).orderBy(desc(paymentMethods.createdAt));

  return c.json(items, HttpStatusCodes.OK);
};

// Create payment method handler
export const createPaymentMethod: AppRouteHandler<CreatePaymentMethodRoute> = async (c) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ message: HttpStatusPhrases.UNAUTHORIZED }, HttpStatusCodes.UNAUTHORIZED);
  }

  const paymentMethodData = c.req.valid('json');

  // If this is set as default, unset any existing default payment methods
  if (paymentMethodData.isDefault) {
    await db.update(paymentMethods).set({ isDefault: false }).where(eq(paymentMethods.userId, paymentMethodData.userId));
  }

  const [inserted] = await db.insert(paymentMethods).values(paymentMethodData).returning();
  return c.json(inserted, HttpStatusCodes.CREATED);
};

// Get payment method handler
export const getPaymentMethod: AppRouteHandler<GetPaymentMethodRoute> = async (c) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ message: HttpStatusPhrases.UNAUTHORIZED }, HttpStatusCodes.UNAUTHORIZED);
  }

  const { id } = c.req.valid('param');

  const paymentMethod = await db.query.paymentMethods.findFirst({
    where: eq(paymentMethods.id, id),
    with: {
      user: true,
    },
  });

  if (!paymentMethod) {
    return c.json({ message: HttpStatusPhrases.NOT_FOUND }, HttpStatusCodes.NOT_FOUND);
  }

  // Check authorization - users can only access their own payment methods unless they're admins
  if (paymentMethod.userId !== user.id && user.role !== 'admin') {
    return c.json({ message: HttpStatusPhrases.FORBIDDEN }, HttpStatusCodes.FORBIDDEN);
  }

  return c.json(paymentMethod, HttpStatusCodes.OK);
};

// Update payment method handler
export const updatePaymentMethod: AppRouteHandler<UpdatePaymentMethodRoute> = async (c) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ message: HttpStatusPhrases.UNAUTHORIZED }, HttpStatusCodes.UNAUTHORIZED);
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

  // Get the payment method to check authorization
  const existingMethod = await db.query.paymentMethods.findFirst({
    where: eq(paymentMethods.id, id),
  });

  if (!existingMethod) {
    return c.json({ message: HttpStatusPhrases.NOT_FOUND }, HttpStatusCodes.NOT_FOUND);
  }

  // Check authorization - users can only update their own payment methods unless they're admins
  if (existingMethod.userId !== user.id && user.role !== 'admin') {
    return c.json({ message: HttpStatusPhrases.FORBIDDEN }, HttpStatusCodes.FORBIDDEN);
  }

  // If this is being set as default, unset any existing default payment methods
  if (updates.isDefault) {
    await db.update(paymentMethods).set({ isDefault: false }).where(eq(paymentMethods.userId, existingMethod.userId));
  }

  const [updatedMethod] = await db.update(paymentMethods).set(updates).where(eq(paymentMethods.id, id)).returning();

  return c.json(updatedMethod, HttpStatusCodes.OK);
};

// Delete payment method handler
export const deletePaymentMethod: AppRouteHandler<DeletePaymentMethodRoute> = async (c) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ message: HttpStatusPhrases.UNAUTHORIZED }, HttpStatusCodes.UNAUTHORIZED);
  }

  const { id } = c.req.valid('param');

  // Get the payment method to check authorization
  const existingMethod = await db.query.paymentMethods.findFirst({
    where: eq(paymentMethods.id, id),
  });

  if (!existingMethod) {
    return c.json({ message: HttpStatusPhrases.NOT_FOUND }, HttpStatusCodes.NOT_FOUND);
  }

  // Check authorization - users can only delete their own payment methods unless they're admins
  if (existingMethod.userId !== user.id && user.role !== 'admin') {
    return c.json({ message: HttpStatusPhrases.FORBIDDEN }, HttpStatusCodes.FORBIDDEN);
  }

  await db.delete(paymentMethods).where(eq(paymentMethods.id, id));

  return c.body(null, HttpStatusCodes.NO_CONTENT);
};
