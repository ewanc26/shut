import { STRONG, WEAK } from 'shut-labeller/lexicon';
import { describe, expect, it } from 'vitest';
import { STRONG_REASONS, WEAK_REASONS } from './reasons.js';

describe('reasons', () => {
	it('describes every strong rule, and nothing else', () => {
		expect(Object.keys(STRONG_REASONS).sort()).toEqual(STRONG.map(({ id }) => id).sort());
	});

	it('describes every weak group, and nothing else', () => {
		expect(Object.keys(WEAK_REASONS).sort()).toEqual(Object.keys(WEAK).sort());
	});
});
