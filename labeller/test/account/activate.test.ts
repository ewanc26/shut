import assert from 'node:assert/strict';
import { Secp256k1Keypair } from '@atproto/crypto';
import { describe, it } from 'vitest';
import { activate, type Prompts } from '../../src/account/activate.js';

const signingKey = '1'.repeat(64);
const settings = {
	did: 'did:plc:labeller',
	signingKey,
	pds: 'https://pds.example',
	endpoint: 'https://labels.example'
};

/** A fake network that records every call made to it. */
async function network(options: { published?: boolean; movedPds?: boolean } = {}) {
	const labelKey = (await Secp256k1Keypair.import(signingKey)).did();
	const calls: { method: string; body?: any }[] = [];
	const request = (async (input: string, init?: RequestInit) => {
		const method = input.split('/xrpc/')[1]?.split('?')[0] ?? 'plc';
		calls.push({ method, ...(init?.body ? { body: JSON.parse(init.body as string) } : {}) });
		const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
		const pds = { id: '#atproto_pds', serviceEndpoint: 'https://pds.example' };
		switch (method) {
			case 'plc':
				return reply({
					alsoKnownAs: ['at://labeller.example'],
					verificationMethod: [
						{ id: '#atproto', publicKeyMultibase: 'zRepo' },
						...(options.published
							? [{ id: '#atproto_label', publicKeyMultibase: labelKey.slice(8) }]
							: [])
					],
					service: [
						pds,
						...(options.published
							? [{ id: '#atproto_labeler', serviceEndpoint: 'https://labels.example' }]
							: [])
					]
				});
			case 'com.atproto.server.createSession':
				return reply({ did: settings.did, accessJwt: 'token' });
			case 'com.atproto.identity.getRecommendedDidCredentials':
				return reply({
					verificationMethods: { atproto: 'did:key:zRepo' },
					services: {
						atproto_pds: {
							type: 'AtprotoPersonalDataServer',
							endpoint: options.movedPds ? 'https://elsewhere.example' : 'https://pds.example'
						}
					}
				});
			case 'com.atproto.identity.signPlcOperation':
				return reply({ operation: { signed: true } });
			case 'com.atproto.repo.getRecord':
				return reply({ error: 'RecordNotFound' }, 400);
			default:
				return reply({});
		}
	}) as typeof fetch;
	return { calls, request, labelKey };
}

const prompts = (answer: string): Prompts => ({
	ask: async (question) => (question.includes('[y/N]') ? answer : 'code'),
	secret: async () => 'password',
	say: () => {}
});

const methods = (calls: { method: string }[]) => calls.map(({ method }) => method);

describe('activate', () => {
	it('publishes the running key while keeping the account credentials', async () => {
		const { calls, request, labelKey } = await network();
		await activate(settings, prompts('y'), request);
		const signed = calls.find(({ method }) => method.endsWith('signPlcOperation'))?.body;
		assert.equal(signed.verificationMethods.atproto, 'did:key:zRepo');
		assert.equal(signed.verificationMethods.atproto_label, labelKey);
		assert.equal(signed.services.atproto_pds.endpoint, 'https://pds.example');
		assert.equal(signed.services.atproto_labeler.endpoint, 'https://labels.example');
		assert.equal(calls.filter(({ method }) => method.endsWith('putRecord')).length, 2);
		assert.ok(!JSON.stringify(calls).includes(signingKey));
	});

	it('changes nothing when the identity change is declined', async () => {
		const { calls, request } = await network();
		await assert.rejects(activate(settings, prompts('n'), request), /Cancelled/);
		assert.ok(!methods(calls).some((method) => /signPlc|submitPlc|putRecord/.test(method)));
	});

	it('stops before any change if the PDS suggests other credentials', async () => {
		const { calls, request } = await network({ movedPds: true });
		await assert.rejects(activate(settings, prompts('y'), request), /Nothing was changed/);
		assert.ok(!methods(calls).some((method) => /Plc|putRecord/.test(method)));
	});

	it('skips the identity change when it is already published', async () => {
		const { calls, request } = await network({ published: true });
		await activate(settings, prompts('n'), request);
		assert.ok(!methods(calls).some((method) => /Plc/.test(method)));
		assert.equal(calls.filter(({ method }) => method.endsWith('putRecord')).length, 1);
	});

	it('refuses an endpoint that is not a bare HTTPS origin', async () => {
		const { request } = await network();
		await assert.rejects(
			activate({ ...settings, endpoint: 'http://labels.example' }, prompts('y'), request)
		);
	});
});
