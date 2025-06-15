import { relations } from 'drizzle-orm';

// Import directly from specific files instead of from index to avoid circular imports
import { user } from '@/db/schema/auth.schema';
import { drivers } from '@/routes/drivers/drivers.schema';
import { userNotifications } from '@/routes/notifications/notifications.schema';
import { paymentMethods } from '@/routes/payments/payments.schema';
import { vehicles } from '@/routes/vehicles/vehicles.schema';

export const usersRelations = relations(user, ({ one, many }) => ({
  driver: one(drivers, {
    fields: [user.id],
    references: [drivers.userId],
  }),
  paymentMethods: many(paymentMethods),
  userNotifications: many(userNotifications),
}));

export const userDriversRelations = relations(drivers, ({ one, many }) => ({
  user: one(user, {
    fields: [drivers.userId],
    references: [user.id],
  }),
  vehicles: many(vehicles),
}));
