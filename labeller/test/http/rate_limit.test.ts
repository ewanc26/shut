import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
	FALLBACK_WAIT_MS,
	limitedFetch,
	MAX_QUOTA_WAIT_MS,
	MAX_WAIT_MS,
	rateLimiter
} from '../../src/http/rate_limit.js';

const START = 1_800_000_000_000;

function fakeClock() {
	const slept: number[] = [];
	let time = START;
	return {
		slept,
		now: () => time,
		sleep: async (ms: number) => {
			slept.push(ms);
			time += ms;
		}
	};
}

const answer = (status: number, headers: Record<string, string> = {}) =>
	new Response(null, { status, headers });
const quota = (remaining: number, reset: number, status = 200) =>
	answer(status, {
		'ratelimit-limit': '100',
		'ratelimit-remaining': String(remaining),
		'ratelimit-reset': String(reset),
		'ratelimit-policy': '100;w=300'
	});

describe('rateLimiter', () => {
	async function waits(response: Response, requests = 1) {
		const clock = fakeClock();
		const limiter = rateLimiter(clock);
		limiter.update(response);
		for (let i = 0; i < requests; i++) await limiter.permit();
		return clock.slept;
	}

	it('lets requests through before anything is known', async () => {
		assert.deepEqual(await waits(answer(200), 3), []);
	});

	it('waits as long as a bare 429 asks, in seconds or as a date', async () => {
		assert.deepEqual(await waits(answer(429, { 'retry-after': '30' }), 2), [30_000]);
		const date = new Date(START + 90_000).toUTCString();
		assert.deepEqual(await waits(answer(429, { 'retry-after': date })), [90_000]);
	});

	it('waits a fixed time after a 429 that says nothing', async () => {
		assert.deepEqual(await waits(answer(429)), [FALLBACK_WAIT_MS]);
		assert.deepEqual(await waits(answer(429, { 'retry-after': '0' })), [FALLBACK_WAIT_MS]);
	});

	it('waits out the full reset a 429 reports, as a delta or an epoch time', async () => {
		assert.deepEqual(await waits(quota(0, 200, 429)), [200_000]);
		assert.deepEqual(await waits(quota(0, START / 1000 + 200, 429)), [200_000]);
		assert.deepEqual(await waits(quota(0, START + 200_000, 429)), [200_000]);
	});

	it('never waits more than a day', async () => {
		assert.deepEqual(await waits(answer(429, { 'retry-after': '9999999' })), [MAX_WAIT_MS]);
	});

	it('keeps some of the quota spare, and waits only a while without a 429', async () => {
		assert.deepEqual(await waits(quota(17, 200), 2), []);
		assert.deepEqual(await waits(quota(15, 200)), [MAX_QUOTA_WAIT_MS]);
		assert.deepEqual(await waits(quota(15, 20)), [20_000]);
	});

	it('counts each request against the quota', async () => {
		assert.equal((await waits(quota(17, 200), 3)).length, 1);
	});
});

describe('limitedFetch', () => {
	it('holds back only the server that refused, and returns the 429', async () => {
		const clock = fakeClock();
		const warnings: string[] = [];
		let calls = 0;
		const send = limitedFetch({
			clock,
			warn: (message) => warnings.push(message),
			request: (async () =>
				answer(calls++ ? 200 : 429, { 'retry-after': '5' })) as unknown as typeof fetch
		});
		assert.equal((await send('https://a.example/x')).status, 429);
		await send('https://b.example/x');
		assert.deepEqual(clock.slept, []);
		await send('https://a.example/y');
		assert.deepEqual(clock.slept, [5_000]);
		assert.match(warnings[0] as string, /a\.example: waiting 5 s/);
	});

	it('starts the timeout when the request is sent', async () => {
		let signal: AbortSignal | undefined;
		const send = limitedFetch({
			timeoutMs: 1000,
			request: (async (_: unknown, init: RequestInit) => {
				signal = init.signal as AbortSignal;
				return answer(200);
			}) as unknown as typeof fetch
		});
		await send('https://a.example');
		assert.equal(signal?.aborted, false);
	});

	it('stops waiting when the caller gives up', async () => {
		const send = limitedFetch({
			warn: () => {},
			request: (async () => answer(429, { 'retry-after': '60' })) as unknown as typeof fetch
		});
		await send('https://a.example');
		const stop = new AbortController();
		const waiting = send('https://a.example', { signal: stop.signal });
		stop.abort();
		await assert.rejects(waiting, { name: 'AbortError' });
	});
});
