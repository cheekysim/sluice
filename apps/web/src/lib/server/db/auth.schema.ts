import { defineRelationsPart } from 'drizzle-orm';
import {
	pgTable,
	text,
	timestamp,
	boolean,
	index,
	integer,
	primaryKey,
	serial
} from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// Base Auth Tables
// ---------------------------------------------------------------------------

export const user = pgTable('user', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	emailVerified: boolean('email_verified').default(false).notNull(),
	image: text('image'),
	// Foreign key link to roles table
	roleId: integer('role_id').references(() => role.id, { onDelete: 'set null' }),
	provider: text('provider').default('internal').notNull(),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at')
		.defaultNow()
		.$onUpdate(() => /* @__PURE__ */ new Date())
		.notNull()
});

export const session = pgTable(
	'session',
	{
		id: text('id').primaryKey(),
		expiresAt: timestamp('expires_at').notNull(),
		token: text('token').notNull().unique(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
		ipAddress: text('ip_address'),
		userAgent: text('user_agent'),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' })
	},
	(table) => [index('session_userId_idx').on(table.userId)]
);

export const account = pgTable(
	'account',
	{
		id: text('id').primaryKey(),
		accountId: text('account_id').notNull(),
		providerId: text('provider_id').notNull(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		accessToken: text('access_token'),
		refreshToken: text('refresh_token'),
		idToken: text('id_token'),
		accessTokenExpiresAt: timestamp('access_token_expires_at'),
		refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
		scope: text('scope'),
		password: text('password'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull()
	},
	(table) => [index('account_userId_idx').on(table.userId)]
);

export const verification = pgTable(
	'verification',
	{
		id: text('id').primaryKey(),
		identifier: text('identifier').notNull(),
		value: text('value').notNull(),
		expiresAt: timestamp('expires_at').notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull()
	},
	(table) => [index('verification_identifier_idx').on(table.identifier)]
);

// ---------------------------------------------------------------------------
// Roles & Permissions Tables
// ---------------------------------------------------------------------------

export const role = pgTable('role', {
	id: serial('id').primaryKey(),
	name: text('name').notNull().unique()
});

export const permission = pgTable('permission', {
	id: serial('id').primaryKey(),
	action: text('action').notNull().unique()
});

export const rolePermission = pgTable(
	'role_permission',
	{
		roleId: integer('role_id')
			.notNull()
			.references(() => role.id, { onDelete: 'cascade' }),
		permissionId: integer('permission_id')
			.notNull()
			.references(() => permission.id, { onDelete: 'cascade' })
	},
	(table) => [primaryKey({ columns: [table.roleId, table.permissionId] })]
);

// ---------------------------------------------------------------------------
// Unified Relations Definition
// ---------------------------------------------------------------------------

export const authRelations = defineRelationsPart(
	{ user, session, account, verification, role, permission, rolePermission },
	(r) => ({
		user: {
			sessions: r.many.session({
				from: r.user.id,
				to: r.session.userId
			}),
			accounts: r.many.account({
				from: r.user.id,
				to: r.account.userId
			}),
			role: r.one.role({
				from: r.user.roleId,
				to: r.role.id
			})
		},
		session: {
			user: r.one.user({
				from: r.session.userId,
				to: r.user.id
			})
		},
		account: {
			user: r.one.user({
				from: r.account.userId,
				to: r.user.id
			})
		},
		role: {
			users: r.many.user({
				from: r.role.id,
				to: r.user.roleId
			}),
			permissions: r.many.rolePermission({
				from: r.role.id,
				to: r.rolePermission.roleId
			})
		},
		permission: {
			roles: r.many.rolePermission({
				from: r.permission.id,
				to: r.rolePermission.permissionId
			})
		},
		rolePermission: {
			role: r.one.role({
				from: r.rolePermission.roleId,
				to: r.role.id
			}),
			permission: r.one.permission({
				from: r.rolePermission.permissionId,
				to: r.permission.id
			})
		}
	})
);
