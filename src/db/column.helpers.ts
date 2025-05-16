import { sql } from 'drizzle-orm';
import { timestamp } from 'drizzle-orm/pg-core';

// PostgreSQL uses CURRENT_TIMESTAMP for the current time
const defaultNow = sql`CURRENT_TIMESTAMP`;

export const timestamps = {
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => sql`CURRENT_TIMESTAMP`),
};