import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, it } from 'vitest';
import { pauseReason, STALE_MS, writeAdvice } from '../../src/schedule/advice.js';
import { CAUGHT_UP_MS, gate } from '../../src/schedule/gate.js';
import { readConfig } from '../../src/server/config.js';

const HOUR = 3_600_000;

describe('gate', () => {
	it('pauses on advice and resumes when it ends', () => {
		const paused = gate(HOUR);
		assert.equal(paused(false, 0), false);
		assert.equal(paused(true, 0), true);
		assert.equal(paused(true, HOUR / 2), true);
		assert.equal(paused(false, HOUR / 2), false);
	});

	it('runs until caught up once the delay is reached', () => {
		const paused = gate(HOUR);
		assert.equal(paused(true, HOUR), false);
		assert.equal(paused(true, HOUR / 2), false);
		assert.equal(paused(true, CAUGHT_UP_MS + 1), false);
		assert.equal(paused(true, CAUGHT_UP_MS), true);
		assert.equal(paused(true, HOUR - 1), true);
	});

	it('catches up first after a long stop', () => {
		assert.equal(gate(HOUR)(true, 20 * HOUR), false);
	});

	it('does not pause before there is a position to resume from', () => {
		assert.equal(gate(HOUR)(true, undefined), false);
	});
});

describe('advice', () => {
	const directory = mkdtempSync(join(tmpdir(), 'shut-advice-'));
	const path = join(directory, 'schedule.json');
	afterAll(() => rmSync(directory, { recursive: true }));

	it('gives the reason while the advice to pause is current', () => {
		writeAdvice(path, { pause: true, reason: 'memory short', at: 1_000_000 });
		assert.equal(pauseReason(path, 1_000_000 + STALE_MS), 'memory short');
		assert.equal(pauseReason(path, 1_000_000 + STALE_MS + 1), undefined);
		assert.equal(pauseReason(path, 1_000_000 - STALE_MS - 1), undefined);
	});

	it('carries on when told to run, or with no readable advice', () => {
		writeAdvice(path, { pause: false, reason: 'calm', at: 1_000_000 });
		assert.equal(pauseReason(path, 1_000_000), undefined);
		for (const content of ['', 'null', '{"pause":true}', '{"pause":"yes","at":1000000}']) {
			writeFileSync(path, content);
			assert.equal(pauseReason(path, 1_000_000), undefined, content);
		}
		assert.equal(pauseReason(join(directory, 'missing'), 0), undefined);
	});
});

describe('SCHEDULE_FILE', () => {
	const env = { LABELER_DID: 'did:plc:test', SIGNING_KEY: 'key' };

	it('is unset by default, and allows an hour when set', () => {
		assert.equal(readConfig(env).schedule, undefined);
		assert.deepEqual(readConfig({ ...env, SCHEDULE_FILE: '/f' }).schedule, {
			file: '/f',
			maxDelayMs: HOUR
		});
	});

	it('refuses delays that could lose posts', () => {
		for (const minutes of ['0', '1441', 'soon'])
			assert.throws(
				() => readConfig({ ...env, SCHEDULE_MAX_DELAY_MINUTES: minutes }),
				/SCHEDULE_MAX_DELAY_MINUTES/
			);
	});
});
