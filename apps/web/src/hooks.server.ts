import { redirect, type Handle } from '@sveltejs/kit';
import { building } from '$app/environment';
import { auth } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { db } from '$lib/server/db';

const isProtectedPath = (pathname: string) =>
	pathname === '/dashboard' || pathname.startsWith('/dashboard/');

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	const session = await auth.api.getSession({ headers: event.request.headers });

	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;
	}

	event.locals.db = db;

	// Form actions don't run layout `load` functions, so guard them here as well as pages.
	if (!event.locals.user && isProtectedPath(event.url.pathname)) {
		redirect(303, '/login');
	}

	return svelteKitHandler({ event, resolve, auth, building });
};

export const handle: Handle = handleBetterAuth;
