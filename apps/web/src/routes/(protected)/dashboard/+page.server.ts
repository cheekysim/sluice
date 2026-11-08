import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { rule } from '$lib/server/db/rule.schema';
import { hasPermission, requirePermission } from '$lib/server/permissions';
import { ruleProviderOptions } from '$lib/server/rule-providers';

export const load: PageServerLoad = async ({ locals, depends }) => {
	await requirePermission(locals, 'rules.read');
	depends('app:rules');

	const rules = await locals.db.query.rule.findMany({ orderBy: { host: 'asc' } });
	const nodes = await locals.db.query.agent.findMany();
	return {
		rules,
		canWrite: await hasPermission(locals, 'rules.write'),
		ruleProviders: ruleProviderOptions(nodes, rules)
	};
};

export const actions = {
	saveRule: async ({ request, locals }) => {
		await requirePermission(locals, 'rules.write');
		const formData = await request.formData();
		const idValue = formData.get('id');
		const id = idValue === null ? undefined : Number(idValue);
		const host = String(formData.get('host') ?? '').trim();
		const port = Number(formData.get('port'));
		const protocols = formData.getAll('protocol');

		if (id !== undefined && (!Number.isInteger(id) || id <= 0)) {
			return fail(400, { message: 'Invalid rule' });
		}
		if (!host || host.length > 253) {
			return fail(400, { message: 'Host is required and must be at most 253 characters' });
		}
		if (!Number.isInteger(port) || port < 1 || port > 65535) {
			return fail(400, { message: 'Port must be between 1 and 65535' });
		}
		const selectedProtocols = protocols.filter(
			(protocol): protocol is 'TCP' | 'UDP' => protocol === 'TCP' || protocol === 'UDP'
		);
		if (selectedProtocols.length === 0 || selectedProtocols.length !== protocols.length) {
			return fail(400, { message: 'Select at least one valid protocol' });
		}

		const requestedProviders = formData.getAll('provider');
		const rules = await locals.db.query.rule.findMany();
		const options = ruleProviderOptions(await locals.db.query.agent.findMany(), rules);
		const existing =
			id === undefined ? [] : (rules.find((rule) => rule.id === id)?.providers ?? []);
		const selectedProviders = requestedProviders.filter(
			(provider): provider is string =>
				typeof provider === 'string' &&
				options.some(
					(option) => option.type === provider && (option.available || existing.includes(provider))
				)
		);
		if (selectedProviders.length !== requestedProviders.length) {
			return fail(400, { message: 'Invalid provider selection' });
		}

		const values = {
			host,
			port,
			protocol: [...new Set(selectedProtocols)],
			providers: [...new Set(selectedProviders)]
		};
		if (id === undefined) {
			await locals.db.insert(rule).values(values);
		} else {
			const [updated] = await locals.db
				.update(rule)
				.set(values)
				.where(eq(rule.id, id))
				.returning({ id: rule.id });
			if (!updated) return fail(404, { message: 'Rule not found' });
		}

		return { success: true };
	},
	setRuleProviders: async ({ request, locals }) => {
		await requirePermission(locals, 'rules.write');
		const formData = await request.formData();
		const id = Number(formData.get('id'));
		const requestedProviders = formData.getAll('provider');

		if (!Number.isInteger(id) || id <= 0) return fail(400, { message: 'Invalid rule' });

		const rules = await locals.db.query.rule.findMany();
		const options = ruleProviderOptions(await locals.db.query.agent.findMany(), rules);
		const existing = rules.find((rule) => rule.id === id)?.providers ?? [];
		const selectedProviders = requestedProviders.filter(
			(provider): provider is string =>
				typeof provider === 'string' &&
				options.some(
					(option) => option.type === provider && (option.available || existing.includes(provider))
				)
		);
		if (selectedProviders.length !== requestedProviders.length) {
			return fail(400, { message: 'Invalid provider selection' });
		}

		const [updated] = await locals.db
			.update(rule)
			.set({ providers: [...new Set(selectedProviders)] })
			.where(eq(rule.id, id))
			.returning({ id: rule.id });
		if (!updated) return fail(404, { message: 'Rule not found' });

		return { success: true };
	},
	deleteRule: async ({ request, locals }) => {
		await requirePermission(locals, 'rules.write');
		const id = Number((await request.formData()).get('id'));
		if (!Number.isInteger(id) || id <= 0) return fail(400, { message: 'Invalid rule' });

		const [deleted] = await locals.db
			.delete(rule)
			.where(eq(rule.id, id))
			.returning({ id: rule.id });
		if (!deleted) return fail(404, { message: 'Rule not found' });

		return { success: true };
	}
} satisfies Actions;
