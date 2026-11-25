import assert from 'node:assert/strict';
import { describe, expect, it } from 'vitest';
import { add, emptyCounts, MIN_POSTS, prune, serialise, weights } from '../../src/judge/counts.js';

describe('counts', () => {
	it('counts each word once per post', () => {
		const counts = emptyCounts();
		add(counts, 'pos', ['alpha', 'alpha', 'beta']);
		assert.deepEqual(counts.words.get('alpha'), { pos: 1, neg: 0 });
		assert.equal(counts.docs.pos, 1);
	});

	it('drops words seen in too few posts', () => {
		const counts = emptyCounts();
		for (let i = 0; i < MIN_POSTS; i++) add(counts, 'neg', ['common', `rare${i}`]);
		const pruned = prune(counts);
		assert.ok(pruned.words.has('common'));
		assert.ok(!pruned.words.has('rare0'));
	});

	it('serialises only pruned counts, never anything else', () => {
		const counts = emptyCounts();
		for (let i = 0; i < MIN_POSTS; i++) add(counts, 'neg', ['common']);
		add(counts, 'pos', ['singleton-word-from-one-post']);
		const saved = JSON.parse(serialise(counts));
		expect(Object.keys(saved.words)).toEqual(['common']);
		expect(Object.keys(saved).sort()).toEqual(['docs', 'minPosts', 'version', 'words']);
	});

	it('leans towards the class a word appears in', () => {
		const counts = emptyCounts();
		for (let i = 0; i < 30; i++) add(counts, 'pos', ['chadword']);
		for (let i = 0; i < 30; i++) add(counts, 'neg', ['normalword']);
		const w = weights(counts);
		assert.ok((w.get('chadword') ?? 0) > 0);
		assert.ok((w.get('normalword') ?? 0) < 0);
	});
});
