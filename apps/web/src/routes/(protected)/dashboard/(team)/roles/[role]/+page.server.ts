import type { Actions, PageServerLoad } from './$types';
import { error, fail } from '@sveltejs/kit';
import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { titleCase } from '$lib/utils';
import { roleSchema } from '../schema';
import { saveRole } from '../save-role.server';
import { requirePermission } from '$lib/server/permissions';

const parseId = (value: string) => (/^[1-9]\d*$/.test(value) ? Number(value) : null);

export const load: PageServerLoad = async ({ params, locals }) => {
	await requirePermission(locals, 'roles.manage');
	const id = parseId(params.role);
	const [roleData, permissions] = await Promise.all([
		id === null
			? undefined
			: locals.db.query.role.findFirst({
					where: { id },
					with: { permissions: { columns: { permissionId: true } } }
				}),
		locals.db.query.permission.findMany({ orderBy: { action: 'asc' } })
	]);

	if (!roleData) error(404, 'Role not found');
	if (roleData.name === 'owner') error(403, 'The owner role cannot be edited');

	return {
		breadcrumb: titleCase(roleData.name),
		role: { id: roleData.id, name: roleData.name },
		permissions,
		form: await superValidate(
			{
				name: roleData.name,
				description: roleData.description ?? '',
				default: roleData.default,
				permissions: roleData.permissions.map((p) => p.permissionId)
			},
			zod4(roleSchema)
		)
	};
};

export const actions: Actions = {
	default: async ({ params, request, locals }) => {
		await requirePermission(locals, 'roles.manage');
		const id = parseId(params.role);
		const form = await superValidate(request, zod4(roleSchema));
		if (!form.valid) return fail(400, { form });

		const current =
			id === null ? undefined : await locals.db.query.role.findFirst({ where: { id } });
		if (!current || id === null) error(404, 'Role not found');
		if (current.name === 'owner') error(403, 'The owner role cannot be edited');

		if (form.data.name === 'owner') {
			return setError(form, 'name', 'This name is reserved');
		}
		const duplicate = await locals.db.query.role.findFirst({
			where: { name: form.data.name },
			columns: { id: true }
		});
		if (duplicate && duplicate.id !== id) {
			return setError(form, 'name', 'A role with this name already exists');
		}

		await saveRole(locals.db, form.data, id);

		return message(form, 'Role updated successfully');
	}
};
