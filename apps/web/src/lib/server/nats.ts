import { connect, type NatsConnection } from 'nats';
import { env } from '$env/dynamic/private';

let ncPromise: Promise<NatsConnection> | undefined;

export const getNats = () => {
	ncPromise ??= connect({ servers: env.NATS_URL ?? 'nats://nats:4222' }).catch((error) => {
		ncPromise = undefined;
		throw error;
	});
	return ncPromise;
};
