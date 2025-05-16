import { relations } from 'drizzle-orm';

import { drivers, paymentMethods, user, userNotifications } from './index';

export const usersRelations = relations(user, ({ one, many }) => ({
  driver: one(drivers, {
    fields: [user.id],
    references: [drivers.userId],
  }),
  paymentMethods: many(paymentMethods),
  userNotifications: many(userNotifications),
}));
