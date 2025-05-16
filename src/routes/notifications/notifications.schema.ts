import { relations } from 'drizzle-orm';
import { boolean, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { user } from '@/db/schema';

/**
 * User Notifications Table - Stores user notifications
 */
export const userNotifications = pgTable(
  'user_notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    message: text('message').notNull(),
    type: text('type').notNull(), // 'trip', 'payment', 'promotion', 'system', etc.
    relatedEntityId: uuid('related_entity_id'), // Could be tripId, paymentId, etc.
    relatedEntityType: text('related_entity_type'), // 'trip', 'payment', etc.
    isRead: boolean('is_read').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('user_notifications_user_id_idx').on(table.userId), index('user_notifications_is_read_idx').on(table.isRead)]
);

export const userNotificationsRelations = relations(userNotifications, ({ one }) => ({
  user: one(user, {
    fields: [userNotifications.userId],
    references: [user.id],
  }),
}));
