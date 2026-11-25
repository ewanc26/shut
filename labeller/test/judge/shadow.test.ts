import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import type { Answer } from '../../src/judge/model.js';
import { CONCURRENCY, shadowJudge, type Ask } from '../../src/judge/shadow.js';
import { readConfig } from '../../src/server/config.js';

const answer = (sense: Answer['sense']): Answer => ({ sense });

function judge(ask: Ask, dailyLimit = 100, now?: () => Date) {
	const lines: string[] = [];
	const shadow = shadowJudge({
		ask,
		dailyLimit,
		log: (line) => lines.push(line),
		...(now ? { now } : {})
	});
	return { shadow, lines };
}

describe('shadowJudge', () => {
	it('logs the address, never the text, and only for the incel sense', async () => {
		const { shadow, lines } = judge(async ([text]) =>
			answer(text === 'secret words' ? 'incel' : 'ordinary')
		);
		shadow.offer('at://one', ['secret words']);
		await shadow.idle();
		shadow.offer('at://two', ['other words']);
		await shadow.idle();
		assert.deepEqual(lines, ['judge would label at://one']);
		assert.equal(shadow.total().ordinary, 1);
	});

	it('swallows failures without logging their message', async () => {
		const { shadow, lines } = judge(async () => {
			throw Object.assign(new Error('echoes secret words'), { status: 500 });
		});
		shadow.offer('at://one', ['secret words']);
		await shadow.idle();
		assert.deepEqual(lines, ['judge failed: Error 500']);
	});

	it('skips rather than queues when too many calls are in flight', () => {
		let asked = 0;
		const { shadow } = judge(() => {
			asked += 1;
			return new Promise<Answer>(() => {});
		});
		for (let i = 0; i <= CONCURRENCY; i++) shadow.offer(`at://${i}`, ['x']);
		assert.equal(asked, CONCURRENCY);
		assert.equal(shadow.total().skipped, 1);
	});

	it('waits out a rate limit before asking again', async () => {
		let date = new Date('2026-01-01T00:00:00Z');
		let asked = 0;
		const { shadow, lines } = judge(
			async () => {
				asked += 1;
				throw { reason: 'rate_limit', status: 429, retryAfterMs: 60_000 };
			},
			100,
			() => date
		);
		shadow.offer('at://one', ['x']);
		await shadow.idle();
		shadow.offer('at://two', ['x']);
		assert.equal(asked, 1);
		date = new Date('2026-01-01T00:01:00Z');
		shadow.offer('at://three', ['x']);
		await shadow.idle();
		assert.equal(asked, 2);
		assert.equal(lines[0], 'judge paused by a rate limit until 2026-01-01T00:01:00.000Z');
		assert.equal(shadow.total().skipped, 1);
		assert.equal(shadow.total().failed, 0);
	});

	it('stops at the daily limit and starts again the next day', async () => {
		let date = new Date('2026-01-01T23:00:00Z');
		const { shadow } = judge(
			async () => answer('unclear'),
			1,
			() => date
		);
		shadow.offer('at://one', ['x']);
		await shadow.idle();
		shadow.offer('at://two', ['x']);
		date = new Date('2026-01-02T00:00:00Z');
		shadow.offer('at://three', ['x']);
		await shadow.idle();
		assert.equal(shadow.total().calls, 2);
		assert.equal(shadow.total().skipped, 1);
	});

	it('abandons calls on close and takes no more', async () => {
		const { shadow, lines } = judge(
			(_segments, signal) =>
				new Promise<Answer>((_resolve, reject) => {
					signal.addEventListener('abort', () => reject(new Error('aborted')));
				})
		);
		shadow.offer('at://one', ['x']);
		shadow.close();
		shadow.offer('at://two', ['x']);
		await shadow.idle();
		assert.equal(shadow.total().calls, 1);
		assert.equal(shadow.total().failed, 0);
		assert.equal(lines.length, 1);
		assert.match(lines[0] ?? '', /^judge totals: calls=1 /);
	});
});

describe('AI_JUDGE', () => {
	const env = { LABELER_DID: 'did:plc:test', SIGNING_KEY: 'key' };
	const on = { ...env, AI_JUDGE: 'shadow' };

	it('is off by default', () => {
		assert.equal(readConfig(env).judge, undefined);
	});

	it('needs no key in shadow mode', () => {
		assert.deepEqual(readConfig(on).judge, {
			model: 'deepseek-v4.1-flash-free',
			dailyLimit: 200
		});
	});

	it('refuses other values, bad limits and models that keep inputs', () => {
		assert.throws(() => readConfig({ ...env, AI_JUDGE: 'on' }), /AI_JUDGE/);
		assert.throws(() => readConfig({ ...on, AI_JUDGE_DAILY_LIMIT: '0' }), /DAILY_LIMIT/);
		assert.throws(() => readConfig({ ...on, AI_JUDGE_MODEL: 'big-pickle' }), /AI_JUDGE_MODEL/);
	});
});
