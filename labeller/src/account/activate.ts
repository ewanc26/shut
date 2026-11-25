// Turns an existing account into the labeller in one signed-in session, using the signing key
// the server already runs with.

import { Secp256k1Keypair } from '@atproto/crypto';
import { DEFINITIONS } from '../label/definition.js';

export const PROFILE = {
	displayName: 'shut',
	description:
		'A labeller that hides incel language from subscribers.\n\n' +
		'Automated word matching, so quotes and criticism are caught too.\n\n' +
		'Report mistakes: github.com/ewanc26/shut/issues\n' +
		'shut.croft.click'
};

export interface Settings {
	did: string;
	signingKey: string;
	pds: string;
	/** Public HTTPS origin of the label server. */
	endpoint: string;
}

export interface Prompts {
	ask(question: string): Promise<string>;
	secret(question: string): Promise<string>;
	say(message: string): void;
}

interface DidDocument {
	alsoKnownAs?: string[];
	verificationMethod?: { id: string; publicKeyMultibase?: string }[];
	service?: { id: string; serviceEndpoint?: string }[];
}

interface Credentials {
	verificationMethods?: Record<string, string>;
	services?: Record<string, { type: string; endpoint: string }>;
}

class XrpcError extends Error {
	constructor(
		method: string,
		readonly status: number,
		readonly code: string,
		message: string
	) {
		super(`${method} failed (${status} ${code}): ${message}`);
	}
}

export async function activate(
	settings: Settings,
	prompts: Prompts,
	request: typeof fetch = fetch
): Promise<void> {
	const { did, pds } = settings;
	const endpoint = new URL(settings.endpoint);
	if (endpoint.protocol !== 'https:' || endpoint.pathname !== '/') {
		throw new Error('The endpoint must be a bare HTTPS origin, such as https://labels.example.');
	}
	const labelKey = (await Secp256k1Keypair.import(settings.signingKey)).did();

	const json = async <T>(url: string, init?: RequestInit): Promise<T> => {
		const response = await request(url, init);
		const text = await response.text();
		const body = text ? JSON.parse(text) : {};
		if (!response.ok) {
			const name = url.split('/').pop()?.split('?')[0] ?? url;
			throw new XrpcError(name, response.status, body.error ?? 'Error', body.message ?? '');
		}
		return body as T;
	};

	await json(`${endpoint.origin}/xrpc/_health`);
	const document = await json<DidDocument>(`https://plc.directory/${did}`);
	const service = (id: string) =>
		document.service?.find((entry) => entry.id.endsWith(`#${id}`))?.serviceEndpoint;
	const key = (id: string) =>
		document.verificationMethod?.find((entry) => entry.id.endsWith(`#${id}`))?.publicKeyMultibase;
	if (service('atproto_pds') !== new URL(pds).origin) {
		throw new Error(`This account lives on ${service('atproto_pds')}, not ${pds}. Check PDS_URL.`);
	}
	const handle = document.alsoKnownAs?.[0]?.replace('at://', '');
	prompts.say(`Account: @${handle} (${did})`);
	prompts.say(`Server:  ${endpoint.origin}`);
	prompts.say(`Key:     ${labelKey}`);

	const password = await prompts.secret('Account password (not an app password): ');
	const login = (authFactorToken?: string) =>
		json<{ did: string; accessJwt: string }>(`${pds}/xrpc/com.atproto.server.createSession`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ identifier: did, password, authFactorToken })
		});
	const session = await login().catch(async (error) => {
		if (!(error instanceof XrpcError) || error.code !== 'AuthFactorTokenRequired') throw error;
		return login((await prompts.ask('Sign-in code from your email: ')).trim());
	});
	if (session.did !== did) throw new Error('Signed in to a different account.');

	const authorization = `Bearer ${session.accessJwt}`;
	const get = <T>(method: string) =>
		json<T>(`${pds}/xrpc/${method}`, { headers: { authorization } });
	const post = <T>(method: string, body?: unknown) =>
		json<T>(`${pds}/xrpc/${method}`, {
			method: 'POST',
			headers: { authorization, ...(body ? { 'content-type': 'application/json' } : {}) },
			...(body ? { body: JSON.stringify(body) } : {})
		});
	const confirm = async (question: string) =>
		(await prompts.ask(`${question} [y/N] `)).trim().toLowerCase() === 'y';

	const published =
		`did:key:${key('atproto_label')}` === labelKey &&
		service('atproto_labeler') === endpoint.origin;
	if (published) {
		prompts.say('The identity already names this key and server.');
	} else {
		const current = await get<Credentials>('com.atproto.identity.getRecommendedDidCredentials');
		// Never publish an operation that would also move the account or swap its repository key.
		if (
			current.verificationMethods?.atproto !== `did:key:${key('atproto')}` ||
			current.services?.atproto_pds?.endpoint !== service('atproto_pds')
		) {
			throw new Error('The PDS suggests different account credentials. Nothing was changed.');
		}
		await post('com.atproto.identity.requestPlcOperationSignature');
		const token = (await prompts.ask('Identity change code from your email: ')).trim();
		if (!(await confirm('Add the label key and server to this identity?'))) {
			throw new Error('Cancelled. Nothing was changed.');
		}
		const { operation } = await post<{ operation: unknown }>(
			'com.atproto.identity.signPlcOperation',
			{
				token,
				verificationMethods: { ...current.verificationMethods, atproto_label: labelKey },
				services: {
					...current.services,
					atproto_labeler: { type: 'AtprotoLabeler', endpoint: endpoint.origin }
				}
			}
		);
		await post('com.atproto.identity.submitPlcOperation', { operation });
		prompts.say('Identity updated.');
	}

	await post('com.atproto.repo.putRecord', {
		repo: did,
		collection: 'app.bsky.labeler.service',
		rkey: 'self',
		record: {
			$type: 'app.bsky.labeler.service',
			policies: {
				labelValues: DEFINITIONS.map(({ identifier }) => identifier),
				labelValueDefinitions: DEFINITIONS
			},
			createdAt: new Date().toISOString()
		}
	});
	prompts.say('Label definition published.');

	const hasProfile = await get(
		`com.atproto.repo.getRecord?repo=${did}&collection=app.bsky.actor.profile&rkey=self`
	).then(
		() => true,
		(error) => {
			if (error instanceof XrpcError && error.code === 'RecordNotFound') return false;
			throw error;
		}
	);
	if (!hasProfile) {
		prompts.say(`\nProposed profile:\n${PROFILE.displayName}\n${PROFILE.description}\n`);
		if (await confirm('Publish this profile?')) {
			await post('com.atproto.repo.putRecord', {
				repo: did,
				collection: 'app.bsky.actor.profile',
				rkey: 'self',
				record: { $type: 'app.bsky.actor.profile', ...PROFILE }
			});
			prompts.say('Profile published.');
		}
	}

	// Re-submitting the same handle makes the network check it again.
	if (handle) await post('com.atproto.identity.updateHandle', { handle });
	await post('com.atproto.server.deleteSession').catch(() => undefined);
	prompts.say('\nDone.');
}
