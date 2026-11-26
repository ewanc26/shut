import assert from 'node:assert/strict';
import { describe, expect, it } from 'vitest';
import {
	add,
	emptyCounts,
	MIN_POSTS,
	parse,
	prune,
	serialise,
	trim,
	weight
} from '../../src/judge/counts.js';

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
		assert.ok(weight(counts, counts.words.get('chadword')!) > 0);
		assert.ok(weight(counts, counts.words.get('normalword')!) < 0);
	});

	it('forgets the rarest words first when there are too many', () => {
		const counts = emptyCounts();
		for (let i = 0; i < 3; i++) add(counts, 'neg', ['thrice']);
		add(counts, 'neg', ['once', 'also']);
		trim(counts, 1);
		assert.deepEqual([...counts.words.keys()], ['thrice']);
	});

	it('reads back what it saved, and nothing else', () => {
		const counts = emptyCounts();
		for (let i = 0; i < MIN_POSTS; i++) add(counts, 'pos', ['common']);
		assert.deepEqual(parse(serialise(counts)), counts);
		for (const text of ['', 'null', '{}', '{"version":1,"docs":{"pos":1,"neg":1},"words":{}}'])
			assert.throws(() => parse(text), text);
		assert.throws(() => parse('{"version":2,"docs":{"pos":"1","neg":1},"words":{}}'));
	});
});
