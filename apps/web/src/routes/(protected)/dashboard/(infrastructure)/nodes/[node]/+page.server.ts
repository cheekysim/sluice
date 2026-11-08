import { error, fail } from '@sveltejs/kit';
import { and, eq, sql } from 'drizzle-orm';
import { agent } from '$lib/server/db/agent.schema';
import { requirePermission } from '$lib/server/permissions';
import { ensureAgentConfigStream, getNats } from '$lib/server/nats';
import { createHash } from 'node:crypto';
import { ErrorCode, NatsError, StringCodec } from 'nats';
import { responseSchema, validateProviderConfig } from '$lib/server/provider-schemas';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	await requirePermission(locals, 'nodes.read', 'nodes.write');
	let node = await locals.db.query.agent.findFirst({ where: { agentId: params.node } });
	if (!node) error(404, 'Node not found');
	let schemaNotice: string | null = null;
	try {
		const nc = await getNats();
		const token = createHash('sha256').update(params.node).digest('hex');
		const reply = await nc.request(`agent.schemas.${token}`, StringCodec().encode(''), {
			timeout: 1500
		});
		if (reply.data.length > 128 * 1024) throw new Error('Provider advertisement is too large');
		const advertised = responseSchema.parse(JSON.parse(StringCodec().decode(reply.data)));
		if (advertised.agentId !== params.node)
			throw new Error('Provider advertisement has wrong agent ID');
		await locals.db
			.update(agent)
			.set({ providerSchemas: advertised.providers })
			.where(eq(agent.agentId, params.node));
		if (
			advertised.providerUpdate &&
			node.providerUpdate?.id === advertised.providerUpdate.id &&
			advertised.providerUpdate.status !== 'queued'
		) {
			await locals.db
				.update(agent)
				.set({ providerUpdate: advertised.providerUpdate })
				.where(
					and(
						eq(agent.agentId, params.node),
						sql`${agent.providerUpdate}->>'id' = ${advertised.providerUpdate.id}`
					)
				);
		}
		node = (await locals.db.query.agent.findFirst({ where: { agentId: params.node } })) ?? node;
	} catch (err) {
		if (!(
			err instanceof NatsError &&
			(err.code === ErrorCode.NoResponders || err.code === ErrorCode.Timeout)
		)) {
			console.error('Failed to retrieve provider schemas:', err);
		}
		schemaNotice = node.providerSchemas
			? 'Using cached provider schemas; the agent could not be queried.'
			: 'No provider schemas available. Connect an updated agent and reload this page.';
	}
	const providers = (node.providerSchemas ?? []).map((definition) => {
		const setting = node.providers[definition.type];
		const fields = Object.entries(definition.schema.properties ?? {}).map(([key, field]) => {
			if (typeof field !== 'object' || field === null || !('type' in field)) {
				throw new Error(`Unsupported provider schema field: ${definition.type}.${key}`);
			}
			if (
				field.type !== 'string' &&
				field.type !== 'number' &&
				field.type !== 'integer' &&
				field.type !== 'boolean'
			) {
				throw new Error(`Unsupported provider schema field type: ${definition.type}.${key}`);
			}
			const secret = 'secret' in field && field.secret === true;
			const stored = setting?.config[key];
			const fallback = 'default' in field ? field.default : undefined;
			return {
				key,
				type: field.type,
				secret,
				description:
					'description' in field && typeof field.description === 'string'
						? field.description
						: undefined,
				hasValue: secret && typeof stored === 'string' && stored.length > 0,
				value: secret ? '' : String(stored ?? fallback ?? ''),
				required: (definition.schema.required ?? []).includes(key) && fallback === undefined
			};
		});
		return {
			type: definition.type,
			name: definition.name,
			implemented: definition.implemented,
			version: definition.version,
			enabled: setting?.enabled ?? false,
			fields
		};
	});
	return {
		node: {
			agentId: node.agentId,
			agentName: node.agentName,
			agentIP: node.agentIP,
			agentVersion: node.agentVersion
		},
		providers,
		schemaNotice,
		providerUpdate: node.providerUpdate,
		breadcrumb: node.agentName
	};
};

export const actions = {
	renameNode: async ({ locals, params, request }) => {
		await requirePermission(locals, 'nodes.read', 'nodes.write');
		const name = (await request.formData()).get('name');
		if (typeof name !== 'string' || !name.trim() || name.trim().length > 100) {
			return fail(400, {
				message: 'Name is required and must be at most 100 characters',
				name: typeof name === 'string' ? name : ''
			});
		}
		const node = await locals.db.query.agent.findFirst({ where: { agentId: params.node } });
		if (!node) return fail(404, { message: 'Node not found', name });

		let nc;
		try {
			nc = await getNats();
			await ensureAgentConfigStream(nc);
		} catch (err) {
			console.error('Failed to prepare agent configuration delivery:', err);
			return fail(503, { message: 'Could not queue the node configuration. Try again.', name });
		}

		const agentName = name.trim();
		const token = createHash('sha256').update(params.node).digest('hex');
		class PublishError extends Error {}
		try {
			const updated = await locals.db.transaction(async (tx) => {
				const [row] = await tx
					.update(agent)
					.set({ agentName })
					.where(eq(agent.agentId, params.node))
					.returning({ id: agent.agentId });
				if (!row) return false;
				try {
					await nc
						.jetstream()
						.publish(
							`agent.config.${token}`,
							StringCodec().encode(JSON.stringify({ agentId: params.node, agentName }))
						);
				} catch (err) {
					throw new PublishError('Failed to publish agent configuration', { cause: err });
				}
				return true;
			});
			if (!updated) return fail(404, { message: 'Node not found', name });
		} catch (err) {
			if (!(err instanceof PublishError)) throw err;
			console.error('Failed to queue agent configuration:', err);
			return fail(503, { message: 'Could not queue the node configuration. Try again.', name });
		}
		return { success: true };
	},
	saveProvider: async ({ locals, params, request }) => {
		await requirePermission(locals, 'nodes.read', 'nodes.write');
		const form = await request.formData();
		const type = form.get('provider');
		if (typeof type !== 'string') return fail(400, { message: 'Unknown provider.' });
		const enabled = form.get('enabled') === 'on';
		let nc;
		try {
			nc = await getNats();
			await ensureAgentConfigStream(nc);
		} catch (err) {
			console.error('Failed to prepare provider configuration delivery:', err);
			return fail(503, {
				message: 'Could not queue provider configuration. Try again.',
				provider: type
			});
		}
		class PublishError extends Error {}
		class ValidationError extends Error {}
		try {
			const result = await locals.db.transaction(async (tx) => {
				const [node] = await tx
					.select()
					.from(agent)
					.where(eq(agent.agentId, params.node))
					.for('update');
				if (!node) return false;
				const definition = node.providerSchemas?.find((item) => item.type === type);
				if (!definition)
					throw new ValidationError(
						'Provider schema is unavailable. Reconnect the agent and reload.'
					);
				if (form.get('schemaVersion') !== definition.version)
					throw new ValidationError('Provider schema changed. Reload this page before saving.');
				const fields = Object.entries(definition.schema.properties);
				const config: Record<string, unknown> = {};
				for (const [key, field] of fields) {
					if (typeof field !== 'object' || field === null || !('type' in field))
						throw new Error(`Unsupported provider field ${key}`);
					const raw = form.get(`config.${key}`);
					if (typeof raw !== 'string')
						throw new ValidationError(`Missing configuration field: ${key}`);
					if (raw.length > 4096)
						throw new ValidationError(`Configuration field is too long: ${key}`);
					if (field.type === 'boolean' && raw !== '' && raw !== 'true' && raw !== 'false')
						throw new ValidationError(`Invalid boolean value: ${key}`);
					const secret = 'secret' in field && field.secret === true;
					if (secret && raw === '') {
						const existing = node.providers[definition.type]?.config[key];
						if (existing !== undefined) config[key] = existing;
					} else if (raw !== '') {
						config[key] =
							field.type === 'number' || field.type === 'integer'
								? Number(raw)
								: field.type === 'boolean'
									? raw === 'true'
									: raw;
					}
				}
				const providers = { ...node.providers, [definition.type]: { enabled, config } };
				try {
					if (enabled) validateProviderConfig(definition, config);
					for (const advertised of node.providerSchemas ?? []) {
						const setting = providers[advertised.type];
						if (setting?.enabled) validateProviderConfig(advertised, setting.config);
					}
				} catch (err) {
					throw new ValidationError(
						err instanceof Error ? err.message : 'Invalid provider configuration'
					);
				}
				const updateId = crypto.randomUUID();
				const schemaVersions = Object.fromEntries(
					(node.providerSchemas ?? []).map((p) => [p.type, p.version])
				);
				const agentProviders = Object.fromEntries(
					Object.entries(providers).filter(([key]) => key in schemaVersions)
				);
				await tx
					.update(agent)
					.set({ providers, providerUpdate: { id: updateId, status: 'queued' } })
					.where(eq(agent.agentId, params.node));
				try {
					const token = createHash('sha256').update(params.node).digest('hex');
					await nc.jetstream().publish(
						`agent.config.${token}`,
						StringCodec().encode(
							JSON.stringify({
								agentId: params.node,
								agentName: node.agentName,
								providers: agentProviders,
								updateId,
								schemaVersions
							})
						)
					);
				} catch (err) {
					throw new PublishError('Failed to publish provider configuration', { cause: err });
				}
				return true;
			});
			if (!result) return fail(404, { message: 'Node not found.', provider: type });
		} catch (err) {
			if (err instanceof ValidationError)
				return fail(400, { message: err.message, provider: type });
			if (!(err instanceof PublishError)) throw err;
			console.error('Failed to queue provider configuration:', err);
			return fail(503, {
				message: 'Could not queue provider configuration. Try again.',
				provider: type
			});
		}
		return { provider: type, success: true };
	}
} satisfies Actions;
