import { pgTable, text, serial, integer, json } from 'drizzle-orm/pg-core';

export const rule = pgTable('rule', {
	id: serial('id').primaryKey(),
	host: text('host').notNull(),
	port: integer('port').notNull(),
	protocol: json().notNull().$type<('TCP' | 'UDP')[]>(),
	providers: json().notNull().default(['nginx']).$type<string[]>()
});
