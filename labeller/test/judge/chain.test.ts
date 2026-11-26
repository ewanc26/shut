import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, vi } from 'vitest';
import { chain, RETRY_FAILED_MS, type Link } from '../../src/judge/chain.js';
import { ChatError } from '../../src/judge/chat.js';
import { openBackends } from '../../src/judge/open.js';
import { readBackends } from '../../src/judge/provider.js';
import { TIMEOUT_MS } from '../../src/judge/shadow.js';

const MINUTE = 60_000;

/** A service that does what it is told, and counts the questions. */
function service(name: string, act: () => string) {
	const state = { asked: 0 };
	const link: Link = {
		name,
		generate: async () => {
			state.asked += 1;
			return act();
		}
	};
	return { link, state };
}

const limited = (ms?: number) => () => {
	throw new ChatError(429, ms);
};
const broken = () => {
	throw new TypeError('echo of the text');
};

const quiet = { log: () => {} };

const rateLimit = (ms: number) => (error: Error) => {
	const { status, retryAfterMs } = error as ChatError;
	assert.equal(status, 429);
	assert.equal(retryAfterMs, ms);
	return true;
};

describe('chain', () => {
	beforeEach(() => vi.useFakeTimers({ now: Date.parse('2026-11-26T12:00:00Z') }));
	afterEach(() => vi.useRealTimers());

	it('asks only the first service while it answers', async () => {
		const first = service('first', () => 'one');
		const second = service('second', () => 'two');
		assert.equal(await chain([first.link, second.link], quiet)('x'), 'one');
		assert.equal(second.state.asked, 0);
	});

	it('leaves a rate limited service alone until its wait is over', async () => {
		let limit = true;
		const first = service('first', () => (limit ? limited(MINUTE)() : 'one'));
		const second = service('second', () => 'two');
		const ask = chain([first.link, second.link], quiet);
		assert.equal(await ask('x'), 'two');
		limit = false;
		assert.equal(await ask('x'), 'two');
		assert.equal(first.state.asked, 1);
		await vi.advanceTimersByTimeAsync(MINUTE);
		assert.equal(await ask('x'), 'one');
	});

	it('moves on from a failure, and tries that service again next time', async () => {
		const first = service('first', broken);
		const second = service('second', () => 'two');
		const lines: string[] = [];
		const ask = chain([first.link, second.link], { log: (line) => lines.push(line) });
		assert.equal(await ask('x'), 'two');
		assert.equal(await ask('x'), 'two');
		assert.equal(first.state.asked, 2);
		assert.deepEqual([...new Set(lines)], ['judge: first failed: TypeError']);
	});

	it('waits for the earliest rate limit when every service has one', async () => {
		const ask = chain(
			[service('first', limited(9 * MINUTE)).link, service('second', limited(MINUTE)).link],
			quiet
		);
		await assert.rejects(ask('x'), rateLimit(MINUTE));
		// Both are now waiting, so neither is asked.
		await vi.advanceTimersByTimeAsync(MINUTE / 2);
		await assert.rejects(ask('x'), rateLimit(MINUTE / 2));
	});

	it('comes back sooner when another service only failed', async () => {
		const ask = chain(
			[service('first', limited(600 * MINUTE)).link, service('second', broken).link],
			quiet
		);
		await assert.rejects(ask('x'), rateLimit(RETRY_FAILED_MS));
	});

	it('passes on the failure when nothing was rate limited', async () => {
		const ask = chain([service('first', broken).link, service('second', broken).link], quiet);
		await assert.rejects(ask('x'), TypeError);
	});

	it('stops when the caller gives up', async () => {
		const stop = new AbortController();
		const first = service('first', () => {
			stop.abort();
			return broken();
		});
		const second = service('second', () => 'two');
		await assert.rejects(chain([first.link, second.link], quiet)('x', stop.signal));
		assert.equal(second.state.asked, 0);
	});
});

describe('chain timing', () => {
	it('gives up on a slow service and asks the next', async () => {
		const slow: Link = {
			name: 'slow',
			generate: (_prompt, signal) =>
				new Promise((_resolve, reject) => {
					signal?.addEventListener('abort', () => reject(signal.reason));
				})
		};
		const next = service('next', () => 'two');
		// An abort timer does not keep Node running by itself.
		const alive = setTimeout(() => {}, 2_000);
		const ask = chain([slow, next.link], { ...quiet, timeoutMs: 20 });
		assert.equal(await ask('x', new AbortController().signal), 'two');
		clearTimeout(alive);
	});
});

describe('openBackends', () => {
	const backends = readBackends({
		AI_JUDGE_FALLBACK_PROVIDER: 'ollama',
		AI_JUDGE_FALLBACK_MODEL: 'small'
	});

	beforeEach(() => {
		vi.spyOn(console, 'log').mockImplementation(() => {});
		vi.spyOn(console, 'warn').mockImplementation(() => {});
	});
	afterEach(() => vi.restoreAllMocks());

	it('carries on without a service that does not start', async () => {
		let closed = 0;
		const judges = await openBackends(backends, 'unused', async ({ provider }) => {
			if (provider === 'opencode') throw new Error('no catalogue');
			return { generate: async () => 'two', close: async () => void (closed += 1) };
		});
		assert.equal(await judges.generate('x'), 'two');
		assert.equal(judges.timeoutMs, TIMEOUT_MS);
		await judges.close();
		assert.equal(closed, 1);
	});

	it('allows time to try every service', async () => {
		const judges = await openBackends(backends, 'unused', async () => ({
			generate: async () => 'x',
			close: async () => {}
		}));
		assert.equal(judges.timeoutMs, 2 * TIMEOUT_MS);
	});

	it('fails if none starts', async () => {
		await assert.rejects(
			openBackends(backends, 'unused', async () => {
				throw new Error('down');
			}),
			/down/
		);
	});
});
