import type { Actions, PageServerLoad } from './$types';
import { error, fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { user } from '$lib/server/db/auth.schema';
import { formSchema } from './schema';

export const load: PageServerLoad = async ({ params, locals }) => {
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
			zod4(formSchema)
		)
	};
};

export const actions: Actions = {
	default: async ({ params, request, locals }) => {
		const { db } = locals;
		const form = await superValidate(request, zod4(formSchema));
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
	}
};
