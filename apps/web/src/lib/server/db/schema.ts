import { pgTable, text, timestamp, boolean, serial, integer } from 'drizzle-orm/pg-core';
import { role } from './auth.schema';

export const invite = pgTable('invite', {
	id: serial('id').primaryKey(),
	email: text('email').notNull(),
	invited_by: text('invited_by').notNull(),
	created_at: timestamp('created_at').defaultNow().notNull(),
	expires_at: timestamp('expires_at').notNull(),
	token: text('token').notNull(),
	accepted: boolean('accepted').default(false).notNull(),
	role_id: integer('role_id').references(() => role.id, { onDelete: 'set null' })
});

export * from './auth.schema';
