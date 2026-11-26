import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, vi } from 'vitest';
import { paced } from '../../src/label/pace.js';

describe('paced', () => {
	beforeEach(() => vi.useFakeTimers({ now: 1_000_000 }));
	afterEach(() => vi.useRealTimers());

	it('spaces a burst out and keeps its order', async () => {
		const run = paced(250);
		const done: [number, number][] = [];
		for (let i = 0; i < 4; i++) run(() => done.push([i, Date.now() - 1_000_000]));
		await vi.advanceTimersByTimeAsync(1_000);
		assert.deepEqual(done, [
			[0, 0],
			[1, 250],
			[2, 500],
			[3, 750]
		]);
	});

	it('runs at once after a quiet spell, but not straight after another', async () => {
		const run = paced(250);
		let count = 0;
		run(() => count++);
		await vi.advanceTimersByTimeAsync(100);
		run(() => count++);
		assert.equal(count, 1);
		await vi.advanceTimersByTimeAsync(150);
		assert.equal(count, 2);
		await vi.advanceTimersByTimeAsync(1_000);
		run(() => count++);
		assert.equal(count, 3);
	});

	it('carries on after a task throws', async () => {
		const run = paced(250);
		let count = 0;
		run(() => {});
		run(() => {
			throw new Error('broken');
		});
		run(() => count++);
		await assert.rejects(vi.advanceTimersByTimeAsync(250));
		await vi.advanceTimersByTimeAsync(250);
		assert.equal(count, 1);
	});
});
