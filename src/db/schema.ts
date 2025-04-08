import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'

import { timestamps } from '@/db/column.helpers'

export const tasks = sqliteTable('tasks', {
    id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    done: integer('done', { mode: 'boolean' }).notNull().default(false),
    ...timestamps,
});

export const selectTaskSchema = createSelectSchema(tasks);

export const insertTaskSchema = createInsertSchema(tasks, {
    name: (val) => val.min(1).max(500)
})
    .required({
        done: true
    })
    .omit({
        id: true,
        createdAt: true,
        updatedAt: true,
    })

export const updateTaskSchema = insertTaskSchema.partial()