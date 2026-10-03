import type { PageServerLoad, Actions } from './$types.js';
import { fail } from '@sveltejs/kit';
import { superValidate, message } from 'sveltekit-superforms';
import { formSchema } from './schema';
import { zod4 } from 'sveltekit-superforms/adapters';
import { v4 as uuidv4 } from 'uuid';

export const load: PageServerLoad = async () => {
	return {
		form: await superValidate(zod4(formSchema))
	};
};

export const actions: Actions = {
	default: async (event) => {
		const form = await superValidate(event, zod4(formSchema));
		console.log(form.data);
		if (!form.valid) {
			return fail(400, {
				form
			});
		}

		// Create login link (Token)
		const token = uuidv4();

		return message(
			form,
			JSON.stringify({
				uuid: token,
				email: form.data.email,
				inviteValidFor: form.data.inviteValidFor
			})
		);
	}
};
