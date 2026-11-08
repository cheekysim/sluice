import { jsonb, pgTable, text } from 'drizzle-orm/pg-core';
import type {
	ProviderAdvertisement,
	ProviderSettings,
	ProviderUpdateStatus
} from '$lib/server/provider-schemas';

export const agent = pgTable('agent', {
	agentId: text('agentId').primaryKey(),
	agentName: text('agentName').notNull(),
	agentIP: text('agentIP').notNull(),
	agentVersion: text('agentVersion').notNull(),
	providers: jsonb('providers')
		.$type<ProviderSettings>()
		.notNull()
		.default({ nginx: { enabled: true, config: {} } }),
	providerSchemas: jsonb('providerSchemas').$type<ProviderAdvertisement[]>(),
	providerUpdate: jsonb('providerUpdate').$type<ProviderUpdateStatus>()
});
