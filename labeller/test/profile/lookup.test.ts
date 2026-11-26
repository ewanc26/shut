import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { BACKOFF_MS, BATCH_SIZE, profileLookup } from '../../src/profile/lookup.js';

function setup(options: { limit?: number; exempt?: string } = {}) {
	const done = new Set<string>();
	const delivered: [string, unknown][] = [];
	const requests: string[][] = [];
	const state = { time: 0, status: 200, absent: new Set<string>(), during: () => {} };
	const lookup = profileLookup({
		...options,
		checked: {
			has: async (did) => done.has(did),
			add: async (did) => void done.add(did)
		},
		deliver: (did, profile) => {
			delivered.push([did, profile]);
			done.add(did);
		},
		now: () => state.time,
		request: (async (url: URL) => {
			const dids = url.searchParams.getAll('actors');
			requests.push(dids);
			state.during();
			const profiles = dids.filter((did) => !state.absent.has(did)).map((did) => ({ did }));
			return new Response(JSON.stringify({ profiles }), { status: state.status });
		}) as typeof fetch
	});
	return { lookup, done, delivered, requests, state };
}

describe('profileLookup', () => {
	it('fetches each account once, however often it posts', async () => {
		const { lookup, requests, delivered } = setup();
		lookup.want('did:a');
		lookup.want('did:a');
		await lookup.run();
		lookup.want('did:a');
		await lookup.run();
		assert.deepEqual(requests, [['did:a']]);
		assert.deepEqual(delivered, [['did:a', { did: 'did:a' }]]);
	});

	it('asks for no more accounts than one request allows', async () => {
		const { lookup, requests } = setup();
		for (let i = 0; i <= BATCH_SIZE; i++) lookup.want(`did:${i}`);
		await lookup.run();
		assert.equal(requests[0]?.length, BATCH_SIZE);
		assert.equal(lookup.size(), 1);
	});

	it('delivers an account without a visible profile as such', async () => {
		const { lookup, state, delivered } = setup();
		state.absent.add('did:gone');
		lookup.want('did:gone');
		await lookup.run();
		assert.deepEqual(delivered, [['did:gone', undefined]]);
	});

	it('drops a result overtaken by a newer version from the stream', async () => {
		const { lookup, state, delivered } = setup();
		state.during = () => lookup.supersede('did:a');
		lookup.want('did:a');
		lookup.want('did:b');
		await lookup.run();
		assert.deepEqual(
			delivered.map(([did]) => did),
			['did:b']
		);
	});

	it('forgets a waiting account once the stream brings its profile', async () => {
		const { lookup, requests } = setup();
		lookup.want('did:a');
		lookup.supersede('did:a');
		await lookup.run();
		assert.deepEqual(requests, []);
	});

	it('backs off after a failure, and tries the account again when it next posts', async () => {
		const { lookup, state, done, delivered, requests } = setup();
		state.status = 429;
		lookup.want('did:a');
		await lookup.run();
		assert.equal(done.size, 0);
		assert.equal(delivered.length, 0);
		state.status = 200;
		lookup.want('did:a');
		await lookup.run();
		assert.equal(requests.length, 1);
		state.time = BACKOFF_MS;
		await lookup.run();
		assert.equal(delivered.length, 1);
	});

	it('never fetches the labeller itself', async () => {
		const { lookup, requests } = setup({ exempt: 'did:me' });
		lookup.want('did:me');
		await lookup.run();
		assert.deepEqual(requests, []);
	});

	it('drops the account waiting longest when the list is full', async () => {
		const { lookup, requests } = setup({ limit: 2 });
		for (const did of ['did:a', 'did:b', 'did:c']) lookup.want(did);
		await lookup.run();
		assert.deepEqual(requests, [['did:b', 'did:c']]);
	});
});
