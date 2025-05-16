import { boolean, doublePrecision, index, jsonb, pgTable, serial, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { user } from '@/db/schema';

/**
 * Surge Pricing Table - Stores dynamic pricing rules based on demand
 */
export const surgePricing = pgTable('surge_pricing', {
  id: uuid('id').primaryKey().defaultRandom(),
  multiplier: doublePrecision('multiplier').notNull(),
  centerLat: doublePrecision('center_lat').notNull(),
  centerLng: doublePrecision('center_lng').notNull(),
  radiusKm: doublePrecision('radius_km').notNull(),
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time').notNull(),
  reason: text('reason'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('surge_pricing_location_idx').on(table.centerLat, table.centerLng),
  index('surge_pricing_time_range_idx').on(table.startTime, table.endTime),
]);

/**
 * App Settings Table - Stores application configuration
 */
export const appSettings = pgTable('app_settings', {
  id: serial('id').primaryKey(),
  settingKey: text('setting_key').notNull().unique(),
  settingValue: text('setting_value').notNull(),
  description: text('description'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  updatedBy: text('updated_by').references(() => user.id),
});

/**
 * Audit Logs Table - Tracks important system events
 */
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').references(() => user.id),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(), // 'user', 'trip', 'payment', etc.
  entityId: uuid('entity_id'),
  oldValues: jsonb('old_values'),
  newValues: jsonb('new_values'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('audit_logs_user_id_idx').on(table.userId),
  index('audit_logs_action_idx').on(table.action),
  index('audit_logs_entity_type_idx').on(table.entityType),
  index('audit_logs_created_at_idx').on(table.createdAt),
]);