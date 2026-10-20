import type { Actions, PageServerLoad } from './$types';
import { error, fail } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { user } from '$lib/server/db/auth.schema';
import { auth } from '$lib/server/auth';
import { account, session } from '$lib/server/db/auth.schema';
import { formSchema, passwordSchema } from './schema';
import { requirePermission } from '$lib/server/permissions';

export const load: PageServerLoad = async ({ params, locals }) => {
	await requirePermission(locals, 'users.manage');
	const [userData, roles] = await Promise.all([
		locals.db.query.user.findFirst({
			where: { id: params.user },
			columns: { id: true, name: true, email: true, roleId: true },
			with: { role: { columns: { name: true } } }
		}),
		locals.db.query.role.findMany({
			columns: { id: true, name: true },
			where: { name: { ne: 'owner' } }
		})
	]);

	if (!userData) {
		error(404, 'User not found');
	}
	if (userData.role?.name === 'owner') {
		error(403, 'The owner account cannot be edited here');
	}
	if (roles.length === 0) {
		error(500, 'No editable roles are configured');
	}

	return {
		breadcrumb: userData.name,
		user: { id: userData.id, name: userData.name },
		roles,
		form: await superValidate(
			{
				name: userData.name,
				email: userData.email,
				role: (userData.roleId ?? roles[0].id).toString()
			},
			zod4(formSchema),
			{ id: 'details' }
		),
		passwordForm: await superValidate(zod4(passwordSchema), { id: 'password' })
	};
};

export const actions: Actions = {
	default: async ({ params, request, locals }) => {
		await requirePermission(locals, 'users.manage');
		const { db } = locals;
		const form = await superValidate(request, zod4(formSchema), { id: 'details' });
		if (!form.valid) {
			return fail(400, { form });
		}

		const [userData, selectedRole, existingUser] = await Promise.all([
			db.query.user.findFirst({
				where: { id: params.user },
				columns: { id: true, email: true, roleId: true },
				with: { role: { columns: { name: true } } }
			}),
			db.query.role.findFirst({
				where: { id: Number(form.data.role), name: { ne: 'owner' } },
				columns: { id: true }
			}),
			db.query.user.findFirst({
				where: { email: form.data.email },
				columns: { id: true }
			})
		]);

		if (!userData) {
			error(404, 'User not found');
		}
		if (userData.role?.name === 'owner') {
			error(403, 'The owner account cannot be edited here');
		}
		if (!selectedRole) {
			return setError(form, 'role', 'Please select a valid role');
		}
		if (existingUser && existingUser.id !== params.user) {
			return setError(form, 'email', 'A user with this email already exists');
		}

		await db
			.update(user)
			.set({
				name: form.data.name,
				email: form.data.email,
				emailVerified: form.data.email === userData.email ? undefined : false,
				roleId: selectedRole.id
			})
			.where(eq(user.id, params.user));

		return message(form, 'User updated successfully');
	},
	setPassword: async ({ params, request, locals }) => {
		await requirePermission(locals, 'users.manage');
		const form = await superValidate(request, zod4(passwordSchema), { id: 'password' });
		if (!form.valid) return fail(400, { form });

		const target = await locals.db.query.user.findFirst({
			where: { id: params.user },
			columns: { id: true },
			with: { role: { columns: { name: true } } }
		});
		if (!target) error(404, 'User not found');
		if (target.role?.name === 'owner') error(403, 'The owner account cannot be edited here');

		const { password: passwordHasher } = await auth.$context;
		const hash = await passwordHasher.hash(form.data.password);

		await locals.db.transaction(async (tx) => {
			const updated = await tx
				.update(account)
				.set({ password: hash })
				.where(and(eq(account.userId, target.id), eq(account.providerId, 'credential')))
				.returning({ id: account.id });

			// SSO-only users have no credential account yet.
			if (updated.length === 0) {
				await tx.insert(account).values({
					id: crypto.randomUUID(),
					accountId: target.id,
					providerId: 'credential',
					userId: target.id,
					password: hash
				});
			}

			// Sign the user out everywhere so the old password stops working immediately.
			await tx.delete(session).where(eq(session.userId, target.id));
		});

		return message(form, 'Password updated. The user has been signed out of all sessions.');
	}
};
