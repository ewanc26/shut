import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, vi } from 'vitest';
import type { Answer } from '../../src/judge/model.js';
import { MAX_AGE_MS } from '../../src/judge/queue.js';
import { shadowJudge, type Ask } from '../../src/judge/shadow.js';
import { readConfig } from '../../src/server/config.js';

const answer = (sense: Answer['sense']): Answer => ({ sense });

function judge(ask: Ask, dailyLimit = 100, queueLimit?: number) {
	const lines: string[] = [];
	const shadow = shadowJudge({
		ask,
		dailyLimit,
		log: (line) => lines.push(line),
		...(queueLimit ? { queueLimit } : {})
	});
	return { shadow, lines };
}

/** Records what was asked, and answers only when told to. */
function held() {
	const asked: string[] = [];
	const replies: ((answer: Answer) => void)[] = [];
	const ask: Ask = ([text]) => {
		asked.push(text ?? '');
		return new Promise<Answer>((resolve) => replies.push(resolve));
	};
	const reply = async (sense: Answer['sense'] = 'unclear') => {
		replies.shift()?.(answer(sense));
		await new Promise((done) => setImmediate(done));
	};
	return { ask, asked, reply };
}

const limited = { reason: 'rate_limit', status: 429, retryAfterMs: 60_000 };

describe('shadowJudge', () => {
	beforeEach(() => {
		vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
		vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it('logs the address, never the text, and only for the incel sense', async () => {
		const { shadow, lines } = judge(async ([text]) =>
			answer(text === 'secret words' ? 'incel' : 'ordinary')
		);
		shadow.offer('at://one', ['secret words']);
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
		assert.equal(shadow.waiting(), 0);
	});

	it('asks one at a time, in order', async () => {
		const { ask, asked, reply } = held();
		const { shadow } = judge(ask);
		for (const text of ['a', 'b', 'c']) shadow.offer(`at://${text}`, [text]);
		assert.deepEqual(asked, ['a']);
		assert.equal(shadow.waiting(), 2);
		await reply();
		await reply();
		assert.deepEqual(asked, ['a', 'b', 'c']);
	});

	it('keeps records through a rate limit and asks them afterwards', async () => {
		const asked: string[] = [];
		let closed = true;
		const { shadow, lines } = judge(async ([text]) => {
			asked.push(text ?? '');
			if (closed) throw limited;
			return answer('unclear');
		});
		shadow.offer('at://a', ['a']);
		await shadow.idle();
		shadow.offer('at://b', ['b']);
		assert.deepEqual(asked, ['a']);
		assert.equal(shadow.waiting(), 2);
		assert.equal(lines[0], 'judge paused by a rate limit until 2026-01-01T00:01:00.000Z');
		closed = false;
		await vi.advanceTimersByTimeAsync(60_000);
		await shadow.idle();
		assert.deepEqual(asked, ['a', 'a', 'b']);
		assert.equal(shadow.waiting(), 0);
		assert.equal(shadow.total().failed, 0);
	});

	it('waits an hour when a rate limit gives no time', async () => {
		const { shadow, lines } = judge(async () => {
			throw { status: 429 };
		});
		shadow.offer('at://a', ['a']);
		await shadow.idle();
		assert.equal(lines[0], 'judge paused by a rate limit until 2026-01-01T01:00:00.000Z');
		await vi.advanceTimersByTimeAsync(60 * 60 * 1000 - 1);
		assert.equal(shadow.total().calls, 1);
		await vi.advanceTimersByTimeAsync(1);
		assert.equal(shadow.total().calls, 2);
	});

	it('moves on to the next record after a failure', async () => {
		const asked: string[] = [];
		const { shadow } = judge(async ([text]) => {
			asked.push(text ?? '');
			if (text === 'a') throw new Error('timed out');
			return answer('unclear');
		});
		shadow.offer('at://a', ['a']);
		shadow.offer('at://b', ['b']);
		await shadow.idle();
		assert.deepEqual(asked, ['a', 'b']);
		assert.equal(shadow.total().failed, 1);
	});

	it('discards the answer about a version edited during the call', async () => {
		const { ask, asked, reply } = held();
		const { shadow, lines } = judge(ask);
		shadow.offer('at://a', ['old']);
		shadow.offer('at://a', ['new']);
		await reply('incel');
		assert.deepEqual(lines, []);
		await reply('incel');
		assert.deepEqual(asked, ['old', 'new']);
		assert.deepEqual(lines, ['judge would label at://a']);
	});

	it('holds records over the daily limit until the next day', async () => {
		vi.setSystemTime(new Date('2026-01-01T23:00:00Z'));
		const { shadow } = judge(async () => answer('unclear'), 1);
		shadow.offer('at://a', ['a']);
		shadow.offer('at://b', ['b']);
		await shadow.idle();
		assert.equal(shadow.total().calls, 1);
		assert.equal(shadow.waiting(), 1);
		await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
		await shadow.idle();
		assert.equal(shadow.total().calls, 2);
		assert.equal(shadow.waiting(), 0);
	});

	it('never sends a record that was forgotten while waiting', async () => {
		const { ask, asked, reply } = held();
		const { shadow } = judge(ask);
		shadow.offer('at://a', ['a']);
		shadow.offer('at://b', ['b']);
		shadow.forget('at://b');
		await reply();
		assert.deepEqual(asked, ['a']);
	});

	it('does not report or retry a record withdrawn while being asked about', async () => {
		const { ask, reply } = held();
		const { shadow, lines } = judge(ask);
		shadow.offer('at://a', ['a']);
		shadow.forget('at://a');
		await reply('incel');
		assert.deepEqual(lines, []);

		const second = judge(async () => {
			throw limited;
		});
		second.shadow.offer('at://b', ['b']);
		second.shadow.forget('at://b');
		await second.shadow.idle();
		assert.equal(second.shadow.waiting(), 0);
	});

	it('asks about the newest version of an edited record', async () => {
		const { ask, asked, reply } = held();
		const { shadow } = judge(ask);
		shadow.offer('at://a', ['a']);
		shadow.offer('at://b', ['old']);
		shadow.offer('at://b', ['new']);
		await reply();
		assert.deepEqual(asked, ['a', 'new']);
	});

	it('drops the oldest waiting record when the queue is full', async () => {
		const { ask, asked, reply } = held();
		const { shadow } = judge(ask, 100, 2);
		for (const text of ['a', 'b', 'c', 'd']) shadow.offer(`at://${text}`, [text]);
		assert.equal(shadow.total().dropped, 1);
		await reply();
		await reply();
		assert.deepEqual(asked, ['a', 'c', 'd']);
	});

	it('gives up on records that have waited a day', async () => {
		const { shadow } = judge(async () => {
			throw { ...limited, retryAfterMs: MAX_AGE_MS + 1 };
		});
		shadow.offer('at://a', ['a']);
		await shadow.idle();
		await vi.advanceTimersByTimeAsync(MAX_AGE_MS + 1);
		assert.equal(shadow.total().expired, 1);
		assert.equal(shadow.total().calls, 1);
		assert.equal(shadow.waiting(), 0);
	});

	it('abandons the call on close and takes no more', async () => {
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
